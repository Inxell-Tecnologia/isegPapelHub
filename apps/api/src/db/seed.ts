import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { config } from '../config.js';

/**
 * Seed condicional de desenvolvimento. Idempotente por "existe algum
 * `global_admin`?" (não por "`users` está vazia"), para que reexecutar
 * depois que a administração já cadastrou pessoas continue sendo no-op
 * (US 1.1, cenário "seed é no-op quando já há administrador").
 *
 * Quando não há nenhum `global_admin`: se a base estiver totalmente vazia,
 * cria o dataset de exemplo (duas unidades, um usuário de cada papel — só
 * para exercitar RLS e a prova ponta a ponta; nenhum dado de feature do
 * PRD além disso), usando as credenciais de bootstrap
 * (`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`) para o
 * `global_admin`. Se já houver pessoas mas nenhum `global_admin` (caso
 * raro), cria só o bootstrap numa unidade "Administração" dedicada —
 * resolve o círculo "admin cria pessoa <-> pessoa precisa existir para
 * logar" (design.md Decisão D5).
 */
export async function seedIfEmpty(pool?: Pool): Promise<boolean> {
  // Trava de produção (design.md D5): fecha o furo de dados de demonstração
  // com senha pública mesmo se `npm run seed` for disparado por engano contra
  // produção. Inicialização de produção usa `npm run bootstrap` (bootstrap.ts).
  if (config.nodeEnv === 'production') {
    throw new Error(
      'seed: recusado em produção (NODE_ENV=production). Use "npm run bootstrap" (apps/api/src/db/bootstrap.ts) para inicializar o administrador global.',
    );
  }

  const ownedPool = pool ?? new Pool({ connectionString: config.databaseUrl });
  try {
    // As duas contagens de guarda rodam sob o MESMO bypass das escritas
    // abaixo, e não na conexão nua.
    //
    // Sem ele a guarda não guardava nada: `users` tem FORCE ROW LEVEL
    // SECURITY, a policy nega sem `app.current_unit`/`app.user_role`, as
    // contagens voltavam **zero** num banco já semeado, e o seed concluía
    // "não há admin, o banco está vazio" — tentando recriar 'Unidade A' e
    // morrendo em `units_name_uidx`. Ou seja, `npm run seed` só funcionava na
    // primeira vez, contrariando a idempotência que o hook de SessionStart
    // promete. Mesma armadilha de `0012_password_changed_at.sql`, documentada
    // no topo de `0020_sectors.sql`: sob FORCE RLS, consulta sem contexto não
    // erra — mente.
    const guardas = await ownedPool.connect();
    let adminCount: string;
    let totalCount: string;
    try {
      await guardas.query('BEGIN');
      await guardas.query("SELECT set_config('app.user_role', 'global_admin', true)");
      const { rows: adminRows } = await guardas.query<{ count: string }>(
        "SELECT count(*)::text FROM users WHERE role = 'global_admin'",
      );
      const { rows: totalRows } = await guardas.query<{ count: string }>(
        'SELECT count(*)::text FROM users',
      );
      adminCount = adminRows[0]?.count ?? '0';
      totalCount = totalRows[0]?.count ?? '0';
      await guardas.query('COMMIT');
    } catch (err) {
      await guardas.query('ROLLBACK');
      throw err;
    } finally {
      guardas.release();
    }

    if (Number(adminCount) > 0) {
      return false;
    }

    const isEmpty = Number(totalCount) === 0;

    // As tabelas têm FORCE ROW LEVEL SECURITY (ver 0002_enable_rls.sql):
    // mesmo o dono das tabelas é restringido pela policy, então o seed
    // precisa rodar sob o papel global_admin (o mesmo bypass que qualquer
    // admin global usaria), não como uma conexão "especial".
    const client = await ownedPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_role', 'global_admin', true)");

      const bootstrapPasswordHash = await argon2.hash(config.bootstrapAdmin.password, {
        type: argon2.argon2id,
      });

      if (isEmpty) {
        const demoPasswordHash = await argon2.hash('dev-password-only', { type: argon2.argon2id });

        const { rows: unitRows } = await client.query<{ id: string }>(
          `INSERT INTO units (name) VALUES ('Unidade A'), ('Unidade B') RETURNING id`,
        );
        const [unitA, unitB] = unitRows;
        if (!unitA || !unitB) throw new Error('seed: expected two units to be created');

        // Setores por unidade (change `funcao-e-setor-na-identidade`): a
        // homologação precisa ver a lista fechada com conteúdo, e a tela
        // inicial precisa de alguém COM cargo e setor e de alguém SEM — é a
        // diferença entre apresentar a função e recair no rótulo do papel.
        const { rows: setorRows } = await client.query<{ id: string; name: string }>(
          `INSERT INTO sectors (unit_id, name) VALUES
             ($1, 'Governança'), ($1, 'CME'), ($2, 'Centro Cirúrgico')
           RETURNING id, name`,
          [unitA.id, unitB.id],
        );
        const setorGovernanca = setorRows.find((s) => s.name === 'Governança');
        const setorCentroCirurgico = setorRows.find((s) => s.name === 'Centro Cirúrgico');
        if (!setorGovernanca || !setorCentroCirurgico) {
          throw new Error('seed: expected demo sectors to be created');
        }

        await client.query(
          `INSERT INTO users (unit_id, email, password_hash, role, full_name, job_title, sector_id) VALUES
             ($1, 'colaborador.a@gdoc.dev', $3, 'collaborator', 'Colaborador A', NULL, NULL),
             ($1, 'admin.a@gdoc.dev', $3, 'unit_admin', 'Admin Unidade A', 'Gerente de Governança', $6),
             ($2, 'colaborador.b@gdoc.dev', $3, 'collaborator', 'Colaborador B', 'Técnica de Enfermagem', $7),
             ($1, $4, $5, 'global_admin', 'Administrador Global', NULL, NULL)`,
          [
            unitA.id,
            unitB.id,
            demoPasswordHash,
            config.bootstrapAdmin.email,
            bootstrapPasswordHash,
            setorGovernanca.id,
            setorCentroCirurgico.id,
          ],
        );

        // Compartilhamento entre unidades (change
        // `compartilhamento-entre-unidades`, tasks.md 9.1): a Unidade A é a
        // SEDE, e a pasta "Governança" dela é compartilhada com a Unidade B
        // inteira, só para visualizar — o caso real do cliente, reproduzível
        // em dev (o Colaborador B a encontra em "Compartilhados comigo").
        await client.query('UPDATE units SET is_headquarters = true WHERE id = $1', [unitA.id]);
        const { rows: governancaRows } = await client.query<{ id: string; owner_id: string }>(
          `INSERT INTO folders (unit_id, owner_id, parent_id, name)
           SELECT $1, id, NULL, 'Governança' FROM users WHERE email = 'admin.a@gdoc.dev'
           RETURNING id, owner_id`,
          [unitA.id],
        );
        const governanca = governancaRows[0];
        if (!governanca) throw new Error('seed: expected demo shared folder to be created');
        await client.query(
          `INSERT INTO cross_unit_grants
             (unit_id, resource_type, resource_id, subject_unit_id, permission, granted_by)
           VALUES ($1, 'folder', $2, $3, 'view', $4)`,
          [unitA.id, governanca.id, unitB.id, governanca.owner_id],
        );
      } else {
        const { rows: unitRows } = await client.query<{ id: string }>(
          `INSERT INTO units (name) VALUES ('Administração') RETURNING id`,
        );
        const unit = unitRows[0];
        if (!unit) throw new Error('seed: expected bootstrap unit to be created');

        await client.query(
          `INSERT INTO users (unit_id, email, password_hash, role, full_name)
           VALUES ($1, $2, $3, 'global_admin', 'Administrador Global')`,
          [unit.id, config.bootstrapAdmin.email, bootstrapPasswordHash],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return true;
  } finally {
    if (!pool) await ownedPool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty()
    .then((seeded) => {
      console.log(seeded ? 'Seed applied.' : 'Seed skipped (global_admin already present).');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
