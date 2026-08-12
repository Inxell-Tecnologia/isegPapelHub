# Estimativa de custos de infraestrutura (GCP)

Material de apoio para formalizar propostas comerciais do PapelHub. Responde
"quanto custa hospedar para este cliente?" separando **aplicação**, **banco de
dados** e **armazenamento**, para acervos de 200 GB a 50 TB e times de 50 a 300
pessoas.

| Arquivo | O que é |
| --- | --- |
| `estimativa.html` | O documento em si. Abrir no navegador. Escrito para leitor **não técnico** — é o material que vai junto da proposta. |
| `modelo.py` | O cálculo que produziu os números. Sem dependências: `python3 modelo.py`. |

## Data-base: os valores são congelados de propósito

O HTML traz **números estáticos**, não um cálculo ao vivo, e exibe a data-base
em destaque logo abaixo do título. Isso é deliberado: uma proposta precisa citar
valores estáveis e auditáveis — o cliente tem que poder conferir seis meses
depois exatamente o número que foi apresentado, e não um valor que mudou sozinho
entre a cotação e a assinatura.

A contrapartida é que os valores **envelhecem**. O Google altera preços sem
aviso prévio.

> Reconferir antes de fechar qualquer proposta, e obrigatoriamente em contratos
> com mais de 12 meses.

## Como atualizar

1. Consulte os preços de lista em [Cloud Storage](https://cloud.google.com/storage/pricing),
   [Cloud SQL](https://cloud.google.com/sql/pricing) e [Cloud Run](https://cloud.google.com/run/pricing),
   **selecionando a região `us-central1`** no seletor de cada tabela (as páginas
   abrem em outra região por padrão).
2. Ajuste o dicionário `P` e a constante `PRICE_DATE` em `modelo.py`.
3. Rode `python3 modelo.py`.
4. Transponha os números para `estimativa.html` — os valores ficam em atributos
   `data-usd` nas células, e o texto exibido é gerado a partir deles.
5. **Atualize a data-base no topo de `estimativa.html`.** É o passo que mais se
   esquece e o que mais estraga uma proposta.

## Premissas que mudam o resultado

Estão listadas no próprio documento, na seção "Premissas do cálculo", e vivem no
topo de `modelo.py`:

- **Atividade por pessoa/mês** — 40 envios, 250 leituras, 1.500 ações de navegação.
- **Porte do banco por faixa de usuários** (`SQL_TIER`) — o banco guarda só
  metadados, então acompanha usuários simultâneos, não o tamanho do acervo.
- **Horas/mês com o servidor ativo** (`HORAS_ATIVAS`).
- **Renovação do acervo** — 3% ao mês, o que define o custo da retenção de 7 dias.
- **Perfis de download** (`PERFIS_EGRESS`) — 2, 8 ou 25 GB por pessoa/mês.

O tráfego de download é o único item genuinamente imprevisível e fica em tabela
separada de propósito: a recomendação é cotá-lo como franquia mensal em GB mais
excedente por GB, nunca embutido num valor fechado.

## Condicionantes que travam proposta

Documentados na seção "Antes de assinar", e vale repetir aqui porque são
decisões de produto, não de planilha:

- **Cota de 10 GB por pessoa** (`storage_quota_bytes_per_user` no Terraform)
  limita o acervo a ~2,9 TB com 300 usuários. Toda a faixa de 10 a 50 TB do
  documento exige elevar essa cota antes da contratação.
- **O banco não tem SLA hoje.** O Google só garante disponibilidade de Cloud SQL
  com HA regional; a instância atual é `ZONAL` com tier shared-core, e
  shared-core é explicitamente excluído do SLA.
- **PITR está desligado** (`point_in_time_recovery_enabled = false`), então o RPO
  atual é de ~24 h.
- **Os dados estão nos EUA** (`us-central1`), por decisão de custo registrada em
  `infra/terraform/variables.tf`. Precisa ser declarado se houver exigência de
  residência de dados no Brasil.
- **Arquivamento automático para Nearline não existe** — a economia de 35% acima
  de 10 TB citada no documento é uma melhoria a implementar, não um recurso
  disponível. Não incluir em proposta sem confirmar prazo.

## Fonte da configuração

O dimensionamento parte da infraestrutura declarada em `infra/terraform/`
(`cloud_run.tf`, `cloud_sql.tf`, `storage.tf`, `variables.tf`). Ao alterar região,
tier do banco, cota por usuário ou retenção da lixeira, revisar este documento
no mesmo commit.
