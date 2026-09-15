import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join } from 'node:path';
import { MOVE_BATCH_MAX_ITEMS_DEFAULT, UPLOAD_BATCH_MAX_ITEMS_DEFAULT } from '@gdoc/shared';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

// `dotenv/config`'s default lookup resolves `.env` relative to `cwd`, but
// npm workspace scripts run with cwd = apps/api, not the repo root where
// .env actually lives. Resolve it explicitly so `npm run migrate --workspace
// apps/api` and friends work the same as running from the repo root.
// Real process.env values (e.g. set by the SessionStart hook) still win —
// dotenv never overrides an already-set variable.
loadDotenv({ path: join(REPO_ROOT, '.env') });

// Same cwd mismatch applies to any relative filesystem path read from env
// (e.g. STORAGE_SIGNER_KEY_PATH) — anchor it to the repo root instead of cwd.
function resolveRepoPath(value: string | undefined): string | undefined {
  if (!value) return value;
  return isAbsolute(value) ? value : join(REPO_ROOT, value);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

// Endereço canônico do manual do usuário publicado por este repositório —
// deve ser igual a `site_url` de `docs/manual/mkdocs.yml` (change
// corrige-alcance-do-manual, design.md D1). A duplicação é deliberada e
// vigiada por um teste que lê o mkdocs.yml e falha se os dois divergirem;
// não é derivada em runtime (a imagem da API não carrega `docs/`) nem em
// build (colidiria com o allowlist "docs-only pula deploy" do deploy.yml —
// uma mudança de `site_url` ficaria sem efeito em produção até tocar
// código fora de docs/).
export const CANONICAL_MANUAL_URL = 'https://carlossalesnaturaltec.github.io/GDoc/';

// Resolução do endereço do manual (change corrige-alcance-do-manual,
// design.md D2/D5): trata `undefined` e string vazia como o mesmo caso —
// ausência de escolha — e devolve o canônico nos dois. Exportada como
// função pura (entrada explícita, sem ler `process.env`) para ser testada
// diretamente, em vez de através do singleton `config` que já leu o
// ambiente no carregamento do módulo.
export function resolveManualUrl(rawValue: string | undefined): string {
  return rawValue || CANONICAL_MANUAL_URL;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '8080')),

  databaseUrl: required('DATABASE_URL'),
  databaseSsl: optional('DATABASE_SSL', 'false') === 'true',

  storageDriver: optional('STORAGE_DRIVER', 'fake-gcs') as 'gcs' | 'fake-gcs',
  storageBucket: required('STORAGE_BUCKET'),
  storageEmulatorHost: process.env.STORAGE_EMULATOR_HOST,
  gcpProjectId: required('GCP_PROJECT_ID'),
  storageSignerKeyPath: resolveRepoPath(process.env.STORAGE_SIGNER_KEY_PATH),
  storageSignerClientEmail: process.env.STORAGE_SIGNER_CLIENT_EMAIL,

  // Diretório do build da SPA (`apps/web/dist`). Ausente = comportamento de
  // hoje, nenhum estático servido (dev usa o Vite) — design.md D3.
  webDistDir: resolveRepoPath(process.env.WEB_DIST_DIR),

  signedUrlViewTtlSeconds: Number(optional('SIGNED_URL_VIEW_TTL_SECONDS', '300')),
  signedUrlDownloadTtlSeconds: Number(optional('SIGNED_URL_DOWNLOAD_TTL_SECONDS', '1800')),

  // Prazo **próprio** da URL assinada de envio (change
  // `corrige-defeitos-envio-lote`, design.md D3). Antes o envio pegava
  // emprestado o TTL de download, por conveniência registrada em comentário
  // no `gcs-storage-port.ts` — não por decisão. Envio e download não têm
  // relação: uma pasta inteira leva dezenas de minutos numa conexão comum
  // (1.000 arquivos de escritório somam ~1,07 GB, que a 5 Mbps levam 31 min),
  // enquanto o download de um arquivo é pontual. Ampliar só o de envio não
  // afrouxa leitura alguma: a URL de envio autoriza **exclusivamente** a
  // escrita de um `object_path` que ainda não existe, com `Content-Type`
  // fixado na assinatura, sob o prefixo `/{unit_id}/{owner_id}/{uuid}` já
  // reservado por uma linha `pending` do próprio autor — não lê nada, não
  // alcança outro objeto, não cruza unidade.
  signedUrlUploadTtlSeconds: Number(optional('SIGNED_URL_UPLOAD_TTL_SECONDS', '3600')),
  storageQuotaBytesPerUser: Number(
    optional('STORAGE_QUOTA_BYTES_PER_USER', String(10 * 1024 * 1024 * 1024)),
  ),

  // Retenção da lixeira em dias (design.md D6/D7) — corte do expurgo diário.
  trashRetentionDays: Number(optional('TRASH_RETENTION_DAYS', '30')),

  // Janela de antecedência do aviso prévio de expiração de permissão (change
  // `expiracao-permissoes`, design.md D6) — default de 7 dias confirmado
  // pelo cliente, configurável por ambiente e nunca fixo no código.
  grantExpiringNoticeWindowDays: Number(optional('GRANT_EXPIRING_NOTICE_WINDOW_DAYS', '7')),

  // Tetos do manifesto de download de pasta (change download-pasta-zip,
  // design.md D5): compactação acontece no navegador, então o limite
  // protege a memória do cliente, não o servidor. Configuráveis por
  // ambiente, nunca hardcoded — se apertarem demais em uso real, o ajuste é
  // uma variável de ambiente, sem deploy de código.
  downloadManifest: {
    maxBytes: Number(optional('DOWNLOAD_MANIFEST_MAX_BYTES', String(50 * 1024 * 1024))),
    maxFiles: Number(optional('DOWNLOAD_MANIFEST_MAX_FILES', '100')),
  },

  // Teto de destinatários por requisição de concessão (change
  // `concessao-multipla-e-nomenclatura-colaborador`, design.md D4) — mesmo
  // molde do teto do manifesto de download, configurável por ambiente.
  grants: {
    maxSubjects: Number(optional('GRANTS_MAX_SUBJECTS', '50')),
  },

  // Teto de itens por operação de mover em lote (change
  // `mover-itens-em-lote`, design.md D1) — POST /files/move e
  // POST /folders/move, cada requisição avaliada contra este teto
  // independentemente. Mesmo molde do teto de grants/manifesto de download,
  // configurável por ambiente. O padrão é compartilhado com a SPA
  // (`MOVE_BATCH_MAX_ITEMS_DEFAULT` em `packages/shared`) para a recusa de
  // envio acontecer antes da requisição, sem endpoint de leitura novo.
  moveBatch: {
    maxItems: Number(optional('MOVE_BATCH_MAX_ITEMS', String(MOVE_BATCH_MAX_ITEMS_DEFAULT))),
  },

  // Teto de itens por requisição de emissão de URLs de envio
  // (`POST /files/upload-urls`) — change `corrige-defeitos-envio-lote`,
  // design.md D2. Mesmo molde dos demais tetos por requisição, com o padrão
  // compartilhado na `packages/shared` para a SPA recusar antes de emitir a
  // requisição. Deliberadamente **não** derivado de `requestBodyMaxBytes`:
  // são guardas de coisas diferentes (a transação que faz N
  // `ensureFolderPath` + N `INSERT` sequenciais, versus a memória do parser),
  // e amarrar um ao outro reproduz o acoplamento que causou o defeito do
  // corpo de 100 KB.
  uploadBatch: {
    maxItems: Number(optional('UPLOAD_BATCH_MAX_ITEMS', String(UPLOAD_BATCH_MAX_ITEMS_DEFAULT))),
  },

  // Teto de corpo aceito pelo parser de JSON (change
  // `corrige-defeitos-envio-lote`, design.md D1). O padrão do `express.json()`
  // sem `limit` é 100 KB, e um lote de 1.000 itens com nomes reais e
  // subpastas pesa 153 KB — o teto de rota ficava refém do padrão de uma
  // biblioteca, e estourá-lo respondia 500. 1 MB acomoda o teto de itens
  // acima com folga larga no pior caso medido (153 bytes por item).
  requestBodyMaxBytes: Number(optional('REQUEST_BODY_MAX_BYTES', String(1024 * 1024))),

  secretsDriver: optional('SECRETS_DRIVER', 'env') as 'env' | 'secret-manager',

  // Autenticação da notificação de finalização (push do Pub/Sub → API).
  // Em prod o push chega com um JWT OIDC assinado pelo Google para a SA
  // `${name_prefix}-pubsub-push`, com `aud` = o próprio push_endpoint. A
  // validação é ligada por env em prod e fica desligada em dev (o atalho
  // direto não tem token) — mesma filosofia de paridade dos demais seams.
  pubsubOidc: {
    validationEnabled: optional('PUBSUB_OIDC_VALIDATION', 'false') === 'true',
    // `aud` esperado — a URL do push_endpoint (…/internal/storage-events).
    expectedAudience: process.env.PUBSUB_PUSH_AUDIENCE,
    // (Opcional) e-mail da SA emissora; se definido, é conferido além do aud.
    expectedServiceAccountEmail: process.env.PUBSUB_PUSH_SA_EMAIL,
  },

  authArgon2: {
    memoryCost: Number(optional('AUTH_ARGON2_MEMORY_COST', '19456')),
    timeCost: Number(optional('AUTH_ARGON2_TIME_COST', '2')),
    parallelism: Number(optional('AUTH_ARGON2_PARALLELISM', '1')),
  },

  // TTL da sessão (proposta do design: 8h) — payload mínimo (`sub`, `exp`).
  authSessionTtlSeconds: Number(optional('AUTH_SESSION_TTL_SECONDS', String(8 * 60 * 60))),

  bootstrapAdmin: {
    email: optional('BOOTSTRAP_ADMIN_EMAIL', 'admin.global@gdoc.dev'),
    password: optional('BOOTSTRAP_ADMIN_PASSWORD', 'dev-password-only'),
  },

  // Identificação do cliente exibida na tela de login/shell (change
  // rebranding-doc7-setes, design.md D8) — dado público, servido por
  // GET /auth/public-config; não passa pelo SecretsPort. Vazia/ausente ⇒
  // nenhuma identificação de cliente é exibida.
  appClientName: optional('APP_CLIENT_NAME', ''),

  // Endereço do manual do usuário exibido no rodapé do shell (change
  // acesso-ao-manual-no-shell, design.md D2/D4) — dado público, não passa
  // pelo SecretsPort. Ausente ou vazia ⇒ endereço canônico (change
  // corrige-alcance-do-manual, design.md D2) — não há valor que suprima o
  // acesso (design.md D3). Validado (esquema http/https) no arranque de
  // `createApp` (app.ts), não aqui — design.md D5.
  appManualUrl: resolveManualUrl(process.env.APP_MANUAL_URL),
};
