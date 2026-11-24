import { cpSync } from 'node:fs';

// tsc não copia arquivos não-TS: sem isto, dist/db/migrations não existe e
// runMigrations() (migrate.ts) falha com ENOENT ao rodar o dist compilado
// (bootstrap.js em produção — tsx em dev/teste lê direto de src/, por isso
// nunca pegou esse gap).
cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true });
