import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import { setupTestDatabase } from './test-db.js';
import type { Ports } from '../ports/index.js';

describe('Serving da SPA (apps/web/dist) pela API — deploy-frontend-gcp', () => {
  let pool: Pool;
  let ports: Ports;
  let webDistDir: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;

    const secrets = new EnvSecretsPort();
    const database = new PgDatabasePort();
    ports = {
      database,
      notifications: new InAppNotificationPort(database),
      storage: new InMemoryStoragePort(),
      secrets,
      auth: new Argon2AuthPort(secrets),
    };

    webDistDir = mkdtempSync(join(tmpdir(), 'gdoc-web-dist-'));
    writeFileSync(join(webDistDir, 'index.html'), '<!doctype html><html><body>SPA</body></html>');
    mkdirSync(join(webDistDir, 'assets'));
    writeFileSync(join(webDistDir, 'assets', 'app.abc123.js'), 'console.log("app")');
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
    rmSync(webDistDir, { recursive: true, force: true });
  });

  describe('cenários felizes', () => {
    it('GET / responde 200 com index.html e Cache-Control no-store', async () => {
      const app = createApp(ports, { webDistDir });
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('SPA');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('GET /assets/<hash>.js responde 200 com Cache-Control immutable', async () => {
      const app = createApp(ports, { webDistDir });
      const res = await request(app).get('/assets/app.abc123.js');
      expect(res.status).toBe(200);
      expect(res.text).toContain('console.log');
      expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    });

    it('GET /busca (deep-link de rota client-side) responde 200 com index.html', async () => {
      const app = createApp(ports, { webDistDir });
      const res = await request(app).get('/busca');
      expect(res.status).toBe(200);
      expect(res.text).toContain('SPA');
    });
  });

  describe('cenários de guarda: rotas de API nunca sombreadas', () => {
    it('GET /files/rota-inexistente devolve resposta da API, nunca HTML', async () => {
      const app = createApp(ports, { webDistDir });
      const res = await request(app).get('/files/rota-inexistente');
      expect(res.status).not.toBe(200);
      expect(res.text).not.toContain('SPA');
    });

    it('GET /files/quota sem sessão responde como API (401), não index.html (change envio-multiplas-pastas-com-prechecagem)', async () => {
      // A rota tem dois segmentos sob o prefixo `/files`, já em
      // `API_PREFIXES` — nenhuma das três pontas (api-prefixes.ts,
      // vite.config.ts, locals.tf) muda. O teste é a guarda de que
      // continua assim.
      const app = createApp(ports, { webDistDir });
      const res = await request(app).get('/files/quota');
      expect(res.status).toBe(401);
      expect(res.text).not.toContain('SPA');
    });

    it('GET /auth/me sem sessão mantém o contrato atual da API (401)', async () => {
      const app = createApp(ports, { webDistDir });
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'not authenticated' });
    });

    it('GET /notifications sem sessão mantém o contrato da API (401), não HTML (change expiracao-permissoes)', async () => {
      const app = createApp(ports, { webDistDir });
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(401);
      expect(res.text).not.toContain('SPA');
    });

    it('POST /caminho-desconhecido devolve 404 sem HTML da SPA', async () => {
      const app = createApp(ports, { webDistDir });
      const res = await request(app).post('/caminho-desconhecido');
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('SPA');
    });
  });

  describe('cenários de configuração', () => {
    it('sem webDistDir, GET / responde como hoje (404, sem index.html)', async () => {
      const app = createApp(ports);
      const res = await request(app).get('/');
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('SPA');
    });

    it('webDistDir inválido (sem index.html) faz createApp lançar erro no arranque', () => {
      const emptyDir = mkdtempSync(join(tmpdir(), 'gdoc-web-dist-empty-'));
      try {
        expect(() => createApp(ports, { webDistDir: emptyDir })).toThrow();
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it('webDistDir apontando para diretório inexistente faz createApp lançar erro', () => {
      expect(() => createApp(ports, { webDistDir: join(webDistDir, 'nao-existe') })).toThrow();
    });
  });
});
