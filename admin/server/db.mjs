import pg from 'pg';

const { Pool } = pg;

function buildConnectionString() {
  const fromUrl = String(process.env.DATABASE_URL || '').trim();
  if (fromUrl) return fromUrl;

  const host = String(process.env.DB_HOST || '').trim();
  const port = String(process.env.DB_PORT || '5432').trim();
  const name = String(process.env.DB_NAME || '').trim();
  const user = String(process.env.DB_USER || '').trim();
  const password = String(process.env.DB_PASSWORD || '').trim();

  if (!host || !name || !user) return '';
  const auth = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);
  return `postgresql://${auth}@${host}:${port}/${name}`;
}

const connectionString = buildConnectionString();

export const dbConfigured = Boolean(connectionString);

export const pool = dbConfigured
  ? new Pool({
      connectionString,
      // Host "postgres" só resolve dentro da rede Docker.
      // Fora do Docker, use DB_HOST=localhost (ou o IP do servidor).
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    })
  : null;

export async function query(text, params = []) {
  if (!pool) {
    throw new Error(
      'Postgres não configurado. Defina DATABASE_URL ou DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.'
    );
  }
  return pool.query(text, params);
}

export async function checkDatabase() {
  if (!pool) {
    return {
      ok: false,
      configured: false,
      message: 'Variáveis de banco não configuradas',
    };
  }

  try {
    const result = await pool.query(
      'select current_database() as database, current_user as user, now() as now'
    );
    const row = result.rows[0] || {};
    return {
      ok: true,
      configured: true,
      database: row.database,
      user: row.user,
      now: row.now,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message: error instanceof Error ? error.message : 'Falha ao conectar no Postgres',
    };
  }
}
