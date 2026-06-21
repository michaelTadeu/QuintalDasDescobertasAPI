require('dotenv').config();

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL não definida.');
}

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction
    ? { rejectUnauthorized: false }
    : databaseUrl.includes('supabase.com') || databaseUrl.includes('pooler.supabase.com')
      ? { rejectUnauthorized: false }
      : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool Postgres:', err);
});

async function testConnection() {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
    console.log('DB pronta.');
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  testConnection
};