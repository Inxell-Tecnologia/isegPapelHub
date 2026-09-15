import { Pool, type PoolClient } from 'pg';
import type { DatabasePort, TenantContext } from '../ports/database-port.js';
import { config } from '../config.js';

export class PgDatabasePort implements DatabasePort {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
      // Teto de conexões por processo e espera limitada por uma conexão
      // livre — ver a justificativa em `config.ts` (o pool sem teto e sem
      // timeout é o que satura as instâncias do Cloud Run e faz o Google
      // Front End devolver `429 Rate exceeded.`).
      max: config.databasePoolMax,
      connectionTimeoutMillis: config.databasePoolConnectionTimeoutMs,
      idleTimeoutMillis: config.databasePoolIdleTimeoutMs,
    });

    // Sem este handler, um erro em conexão **ociosa** (o Cloud SQL derruba a
    // conexão, a instância do banco reinicia) emite 'error' no pool sem
    // listener e o Node derruba o processo inteiro — uma instância a menos
    // servindo, justamente sob a pressão que este conserto endereça.
    this.pool.on('error', (err) => {
      console.error('[pg] erro em conexão ociosa do pool:', err.message);
    });
  }

  async withTenantTransaction<T>(
    ctx: TenantContext,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(async (client) => {
      // SET LOCAL (não SET) é essencial: escopo por transação, seguro sob
      // connection pooling (o pooler pode reusar a conexão para outra
      // requisição depois do COMMIT). Ver design.md, Decisão 2.
      await client.query('SELECT set_config($1, $2, true)', ['app.current_unit', ctx.unitId]);
      await client.query('SELECT set_config($1, $2, true)', ['app.user_role', ctx.role]);
      return fn(client);
    });
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
