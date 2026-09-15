variable "project_id" {
  description = "ID do projeto GCP onde a fundação de produção é provisionada."
  type        = string
}

variable "region" {
  description = <<-EOT
    Região GCP para TODOS os recursos regionais (Cloud Run, Cloud SQL, buckets
    do Cloud Storage, Artifact Registry, Cloud Scheduler/Jobs e NEG serverless)
    — fonte única da verdade da região, sem região literal em nenhum recurso.

    Fase de testes: `us-central1` por custo (~20-35% mais barato que
    `southamerica-east1` nos componentes principais). Trade-off ACEITO nesta
    fase: usuários no Brasil ↔ Iowa somam ~140-180 ms de RTT em TODA requisição
    e no tráfego direto de bytes (PUT/GET nas URLs assinadas do bucket).

    Gatilho de reavaliação: voltar para uma região próxima dos usuários ANTES
    de operar com carga/uso real sensível a latência. Fazê-lo COM dados reais
    é um change de migração de verdade (export/import do Postgres + rsync do
    bucket + janela de indisponibilidade), não a simples troca deste valor —
    recursos regionais do GCP têm região imutável (destruir e recriar). Mesmo
    padrão da anotação do PITR em `cloud_sql.tf`. Ver
    `openspec/changes/archive/*-migra-infra-us-central1/`.
  EOT
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Nome do ambiente, usado como sufixo de nomes de recursos. Só 'prod' está em escopo nesta mudança (staging fica para o futuro)."
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Prefixo de nome usado em todos os recursos deste app."
  type        = string
  default     = "gdoc"
}

variable "db_tier" {
  description = "Tier de máquina do Cloud SQL. Padrão é o menor disponível (MVP, baixo custo) — revisar para carga real de produção."
  type        = string
  default     = "db-f1-micro"
}

variable "db_name" {
  description = "Nome do banco de dados da aplicação no Cloud SQL."
  type        = string
  default     = "gdoc"
}

variable "db_user" {
  description = "Usuário Postgres da aplicação (dono das tabelas; RLS usa FORCE ROW LEVEL SECURITY para restringi-lo mesmo assim)."
  type        = string
  default     = "gdoc_app"
}

variable "api_image" {
  description = <<-EOT
    Imagem de container do Cloud Run para a API. Antes do primeiro deploy via
    CI/CD (seção 7 do tasks.md), usa a imagem de exemplo pública do Cloud Run
    só para o serviço existir; o Terraform ignora mudanças nesse campo depois
    (o CI/CD passa a ser dono da imagem publicada).
  EOT
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "api_cpu" {
  description = "CPU alocada ao container da API no Cloud Run."
  type        = string
  default     = "1"
}

variable "api_memory" {
  description = "Memória alocada ao container da API no Cloud Run."
  type        = string
  default     = "512Mi"
}

variable "api_min_instances" {
  description = <<-EOT
    Instâncias mínimas do Cloud Run da API. **Permanece 0 (escala a zero) por
    decisão de custo** — 1 instância sempre alocada é cobrada mesmo parada
    (tarifa ociosa), e o MVP não justifica isso.

    O preço dessa escolha é conhecido e aceito: a primeira visita depois de um
    período ocioso chega a um serviço sem instância, e o Cloud Run só enfileira
    a requisição por max(10s, 3,5x o tempo médio de arranque) antes de o Google
    Front End recusar com `429 Rate exceeded.` — justamente na tela de login,
    que dispara várias requisições em paralelo (index.html, assets, /auth/me,
    /auth/public-config) na mesma janela fria.

    O que sobra contra esse caso, sem custo ocioso: `startup_cpu_boost`
    encurta o arranque (e com ele a janela de recusa), e a SPA retenta GET em
    429/503 (`apps/web/src/lib/api-client.ts`), absorvendo o arranque a frio
    sem o usuário ver erro. O login é POST e não é retentado — aí a tela
    orienta a tentar de novo.

    Subir para 1 elimina o caso de vez, ao custo da instância ociosa.
  EOT
  type        = number
  default     = 0
}

variable "api_max_instances" {
  description = <<-EOT
    Teto de instâncias do Cloud Run da API. Era 3, baixo demais: quando as
    instâncias saturam, o Google Front End não acha instância livre e devolve
    `429 Rate exceeded.` sem chegar ao container.

    O teto é limitado pelo banco, não pelo Cloud Run:
    `api_max_instances x api_db_pool_max` precisa caber no `max_connections`
    do tier do Cloud SQL (25 no `db-f1-micro`), com folga para os Jobs
    (migração, bootstrap, expurgo, avisos). 8 x 2 = 16 deixa essa folga.
    Subir daqui exige subir o `db_tier` junto — ver o README.
  EOT
  type        = number
  default     = 8
}

variable "api_request_concurrency" {
  description = <<-EOT
    Requisições simultâneas por instância do Cloud Run. O padrão do Cloud Run
    (80) é alto demais para este container: 512Mi de memória com argon2id a
    19 MiB por verificação de senha, e um pool de banco muito menor que 80 —
    o excedente só enfileira dentro da instância, aumentando a latência sem
    aumentar a vazão, até a instância ser morta por memória. 20 mantém a fila
    dentro do que a instância realmente serve.
  EOT
  type        = number
  default     = 20
}

variable "api_request_timeout_seconds" {
  description = <<-EOT
    Timeout de requisição do Cloud Run da API. O padrão (300s) deixa uma
    requisição travada segurando um slot de concorrência por cinco minutos —
    é assim que poucas requisições lentas saturam o serviço inteiro. Bytes
    não passam pela API (URLs assinadas), então nenhuma rota legítima precisa
    de minutos; o manifesto de download de pasta, a rota mais pesada, é
    limitado a 100 arquivos.
  EOT
  type        = number
  default     = 120
}

variable "api_db_pool_max" {
  description = <<-EOT
    Teto de conexões do pool `pg` por instância da API (`DATABASE_POOL_MAX`).
    Sem isso o `pg` usa 10 por processo: com o teto antigo de 3 instâncias já
    eram 30 conexões possíveis contra as 25 do `db-f1-micro`, e as recusadas
    penduravam a requisição em `pool.connect()` — a origem do 429. Ver o
    cálculo do envelope em `api_max_instances`.
  EOT
  type        = number
  default     = 2
}

variable "cors_allowed_origins" {
  description = <<-EOT
    Origens (browser) autorizadas a fazer upload/download direto no bucket de
    arquivos via CORS. O default traz só o dev server do Vite — em produção,
    defina em terraform.tfvars a(s) URL(s) do serviço Cloud Run da API (mesma
    origem que serve o SPA). Enquanto não houver domínio custom, o Cloud Run
    expõe duas formas de URL (-hash-<região>.a.run.app e
    -<nº-projeto>.<região>.run.app) e AMBAS precisam constar aqui, senão o
    preflight OPTIONS do upload direto falha na forma ausente. Ver
    openspec/specs/platform-infrastructure (requisito de CORS do bucket).
  EOT
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "pubsub_push_audience" {
  description = <<-EOT
    Audience esperada no token OIDC do push do Pub/Sub que chama
    POST /internal/storage-events. Sem `audience` explícito na subscription
    (pubsub.tf), o Pub/Sub emite o token com `aud` = o próprio push_endpoint,
    ou seja a URL do serviço Cloud Run da API + "/internal/storage-events".
    Defina em terraform.tfvars como "<api_url>/internal/storage-events" (o
    `api_url` é o output do serviço). Definir este valor LIGA a validação OIDC
    na API (PUBSUB_OIDC_VALIDATION=true); vazio (default) mantém a validação
    desligada — usado só em dev, onde o endpoint é chamado direto, sem token.
  EOT
  type        = string
  default     = ""
}

variable "frontend_domain" {
  description = <<-EOT
    Domínio customizado do SPA (ex.: app.gdoc.exemplo.com.br). Vazio (padrão)
    significa "sem domínio ainda": o bucket do frontend e o Cloud CDN são
    criados, mas o balanceador de carga + certificado gerenciado (que exigem
    um domínio real para o Google emitir o certificado) ficam de fora até um
    domínio ser definido.
  EOT
  type        = string
  default     = ""
}

variable "signed_url_view_ttl_seconds" {
  description = "TTL da URL assinada de visualização. Ver design.md, Decisão 1."
  type        = number
  default     = 300
}

variable "signed_url_download_ttl_seconds" {
  description = "TTL da URL assinada de download/upload. Ver design.md, Decisão 1."
  type        = number
  default     = 1800
}

variable "storage_quota_bytes_per_user" {
  description = "Cota de armazenamento por usuário, em bytes."
  type        = number
  default     = 10737418240 # 10 GiB
}

variable "trash_purge_schedule" {
  description = "Expressão cron (fuso do Cloud Scheduler) do expurgo diário da lixeira. Ver design.md: 03:00."
  type        = string
  default     = "0 3 * * *"
}

variable "trash_retention_days" {
  description = "Dias de retenção da lixeira antes do expurgo permanente (Épico 6, change epico-6-lixeira-retencao, design.md D6/D7)."
  type        = number
  default     = 30
}

variable "scheduler_time_zone" {
  description = "Fuso horário usado pelo Cloud Scheduler."
  type        = string
  default     = "America/Sao_Paulo"
}

variable "notify_expiring_grants_schedule" {
  description = <<-EOT
    Expressão cron (fuso do Cloud Scheduler) da rotina diária de avisos de
    expiração de permissão (change expiracao-permissoes, design.md D7).
    Horário deliberadamente separado das 03:00 do expurgo da lixeira — os
    dois jobs têm domínios e falhas independentes, e não devem concorrer por
    conexões de banco no mesmo instante.
  EOT
  type        = string
  default     = "30 3 * * *"
}

variable "grant_expiring_notice_window_days" {
  description = <<-EOT
    Janela de antecedência (dias) do aviso prévio de vencimento de permissão
    (design.md D6) — default de 7 dias confirmado pelo cliente.
  EOT
  type        = number
  default     = 7
}

variable "bootstrap_admin_email" {
  description = <<-EOT
    E-mail do administrador global criado pelo Job de bootstrap
    (name_prefix-bootstrap). A senha correspondente vem do secret
    bootstrap-admin-password (ver secret_manager.tf), nunca de uma variável do
    Terraform. Ver openspec/changes/bootstrap-admin-producao/design.md D3/D7.
  EOT
  type        = string
}

variable "bootstrap_admin_unit" {
  description = "Nome da unidade do administrador global de bootstrap."
  type        = string
  default     = "Administração"
}

variable "labels" {
  description = "Labels aplicadas a todos os recursos que suportam labels."
  type        = map(string)
  default     = {}
}

variable "app_client_name" {
  description = <<-EOT
    Identificação do cliente exibida abaixo do nome da aplicação na tela de
    login e no shell (change rebranding-doc7-setes, design.md D8). Não é
    segredo — texto exibido publicamente a qualquer visitante da tela de
    login — por isso vai como env var comum do Cloud Run, não Secret Manager.
    Vazio (padrão) = nenhuma identificação de cliente é exibida.
  EOT
  type        = string
  default     = ""
}

variable "app_manual_url" {
  description = <<-EOT
    Override opcional do endereço do manual do usuário desta implantação,
    exibido no rodapé do shell autenticado (change acesso-ao-manual-no-shell,
    design.md D2). Não é segredo — aponta para o site MkDocs público — mesmo
    tratamento de app_client_name: env var comum do Cloud Run, não Secret
    Manager. Vazio (padrão) = a aplicação adota o endereço canônico do manual
    publicado por este repositório (change corrige-alcance-do-manual,
    design.md D2) — não existe valor que suprima o acesso. Se preenchido,
    deve ser um endereço http/https válido — a API falha no arranque caso
    contrário.
  EOT
  type        = string
  default     = ""
}

variable "github_repository" {
  description = <<-EOT
    Repositório GitHub ("owner/repo") autorizado a assumir a service account
    de deploy do CI/CD via Workload Identity Federation — sem chave exportada
    (ver cicd.tf). Só esse repositório específico pode se passar pela SA.
  EOT
  type        = string
  default     = "CarlosSalesNaturalTec/GDoc"
}
