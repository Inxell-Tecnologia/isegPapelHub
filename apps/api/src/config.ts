import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join } from 'node:path';

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

  // Endereço do manual do usuário publicado, exibido no rodapé do shell
  // (change acesso-ao-manual-no-shell, design.md D2/D4) — mesmo tratamento
  // de appClientName: dado público, não passa pelo SecretsPort. Vazio ⇒
  // nenhum acesso ao manual é apresentado. Validado (esquema http/https) no
  // arranque de `createApp` (app.ts), não aqui — design.md D5.
  appManualUrl: optional('APP_MANUAL_URL', ''),
};
