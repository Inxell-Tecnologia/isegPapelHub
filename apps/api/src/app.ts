import express, { type Express, type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import type { Ports } from './ports/index.js';
import { healthRouter } from './routes/health.js';
import { filesRouter } from './routes/files.js';
import { foldersRouter } from './routes/folders.js';
import { usersRouter } from './routes/users.js';
import { unitsRouter } from './routes/units.js';
import { grantsRouter } from './routes/grants.js';
import { authRouter } from './routes/auth.js';
import { storageEventsRouter, type StorageEventsOptions } from './routes/storage-events.js';
import { trashRouter } from './routes/trash.js';
import { auditRouter } from './routes/audit.js';
import { dashboardRouter } from './routes/dashboard.js';
import { searchRouter } from './routes/search.js';
import { notificationsRouter } from './routes/notifications.js';
import { attachTenantContext } from './middleware/tenant-context.js';
import { config } from './config.js';
import { isApiPath } from './lib/api-prefixes.js';

export interface CreateAppOptions {
  webDistDir?: string;
  /** Injeção do verificador/flag OIDC do endpoint de finalização (testes). */
  storageEvents?: StorageEventsOptions;
  /** Override de `config.appManualUrl` (testes) — ver validação abaixo. */
  appManualUrl?: string;
}

export function createApp(ports: Ports, options: CreateAppOptions = {}): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Validação do endereço do manual do usuário (change
  // acesso-ao-manual-no-shell, design.md D5): mesmo padrão de fail-fast do
  // WEB_DIST_DIR abaixo — um esquema fora de http/https (ex.: `javascript:`
  // colado por engano) não deve chegar intacto ao `href` renderizado.
  // Vazio não é inválido — é a ausência tratada em D4. O override passa pela
  // mesma resolução da variável de ambiente (change corrige-alcance-do-manual,
  // design.md D2): um override vazio ou ausente também cai no valor já
  // resolvido de `config.appManualUrl` (canônico, se nada estiver configurado).
  const appManualUrl = options.appManualUrl || config.appManualUrl;
  if (appManualUrl) {
    let scheme: string | null;
    try {
      scheme = new URL(appManualUrl).protocol;
    } catch {
      scheme = null;
    }
    if (scheme !== 'http:' && scheme !== 'https:') {
      throw new Error(`APP_MANUAL_URL inválida: "${appManualUrl}" não é um endereço http/https`);
    }
  }

  app.use(healthRouter(ports));
  app.use(storageEventsRouter(ports, options.storageEvents));
  app.use(authRouter(ports, appManualUrl));

  // Serving da SPA em produção (mesma origem que a API) — design.md D1-D4 do
  // change `deploy-frontend-gcp`. Ausente (dev/testes) = comportamento de
  // hoje, nenhum estático servido.
  //
  // Montado aqui — antes dos routers tenant-scoped abaixo, não depois deles
  // como a princípio caberia — porque `attachTenantContext(ports)` é
  // aplicado via `app.use(mw, router)`: sem path próprio, o Express roda
  // `mw` para QUALQUER caminho (não só os do router em questão), inclusive
  // para caminhos que não correspondem a nenhuma rota de API. Se o fallback
  // ficasse depois desses `app.use`, um `GET /busca` sem sessão seria barrado
  // com 401 pelo primeiro deles antes mesmo de chegar ao fallback — quebrando
  // o cenário de deep-link para visitantes não autenticados. A guarda
  // `isApiPath` abaixo preserva o contrato de API de qualquer forma: um
  // caminho sob prefixo de API sempre continua para os routers reais,
  // independente da posição de montagem.
  const webDistDir = options.webDistDir ?? config.webDistDir;
  if (webDistDir) {
    // Fail-fast: em produção o caminho é garantido pelo Dockerfile, então um
    // diretório ausente/sem index.html só ocorre por misconfiguração e deve
    // gritar no arranque, não degradar silenciosamente para uma API sem
    // frontend (design.md D3).
    if (!existsSync(webDistDir) || !existsSync(join(webDistDir, 'index.html'))) {
      throw new Error(`WEB_DIST_DIR inválido: "${webDistDir}" não existe ou não contém index.html`);
    }

    app.use(
      express.static(webDistDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.startsWith(join(webDistDir, 'assets') + sep)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );

    // Fallback de index.html para deep-link de rota client-side — só
    // GET/HEAD fora de prefixo de API, para nunca sombrear um contrato de
    // API (ex.: 404 de rota inexistente) — spec "Rotas de API nunca
    // sombreadas pelo estático".
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || isApiPath(req.path)) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(join(webDistDir, 'index.html'));
    });
  }

  // `attachTenantContext` só deve rodar para caminhos que de fato pertencem
  // a um destes routers — sem o path aqui, `app.use(mw, router)` aplicaria
  // `mw` a QUALQUER requisição (o Express trata o mount como '/'), inclusive
  // a caminhos sem rota nenhuma, que deveriam cair no 404 padrão (ou, com a
  // SPA configurada, no fallback de index.html acima). `auditRouter` e
  // `searchRouter` vivem sob `/files` (`/files/:id/audit`, `/files/search`),
  // por isso não têm prefixo próprio na lista.
  const tenantScopedPrefixes = [
    '/files',
    '/folders',
    '/users',
    '/units',
    '/grants',
    '/trash',
    '/dashboard',
    '/notifications',
  ];
  app.use(tenantScopedPrefixes, attachTenantContext(ports));
  app.use(filesRouter(ports));
  app.use(foldersRouter(ports));
  app.use(usersRouter(ports));
  app.use(unitsRouter(ports));
  app.use(grantsRouter(ports));
  app.use(trashRouter(ports));
  app.use(auditRouter(ports));
  app.use(dashboardRouter(ports));
  app.use(searchRouter(ports));
  app.use(notificationsRouter(ports));

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  };
  app.use(errorHandler);

  return app;
}
