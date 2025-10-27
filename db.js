// db.js
// Gerenciamento de conexão com Postgres e aplicação de migrations
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL || null;

// Determina se precisa habilitar SSL (Heroku / RDS costumam precisar)
const needSsl = process.env.NODE_ENV === 'production' ||
                (databaseUrl && /amazonaws|heroku|ec2|render/.test(databaseUrl));

const pool = new Pool({
  connectionString: databaseUrl,
  ...(needSsl ? { ssl: { rejectUnauthorized: false } } : {})
});

// Log de erro do pool (útil no Heroku)
pool.on('error', (err) => {
  console.error('Unexpected error on pg Pool', err);
});

/**
 * Aplica migrations lendo o arquivo migrations.sql (se existir).
 * - Verifica conexão
 * - Lê arquivo migrations.sql no mesmo diretório
 * - Executa o SQL completo (caso já existam tabelas, CREATE IF NOT EXISTS não cria duplicadas)
 */
async function applyMigrations() {
  const migrationsPath = path.join(__dirname, 'migrations.sql');

  try {
    console.log('Iniciando verificação de conexão com o banco...');
    const client = await pool.connect();
    client.release();
    console.log('Conexão com o banco OK.');

    if (!fs.existsSync(migrationsPath)) {
      console.log('Arquivo migrations.sql não encontrado em:', migrationsPath);
      return;
    }

    const sql = fs.readFileSync(migrationsPath, 'utf8');

    if (!sql || !sql.trim()) {
      console.log('Arquivo migrations.sql está vazio. Nada a aplicar.');
      return;
    }

    console.log('Aplicando migrations a partir de', migrationsPath);
    // Executa o SQL (pode conter múltiplas instruções separadas por ;)
    await pool.query(sql);
    console.log('Migrations aplicadas com sucesso (ou já existentes).');
  } catch (err) {
    // Log completo para facilitar investigação pelo heroku logs
    console.error('Erro aplicando migrations:', err);
    throw err;
  }
}

/**
 * Exporta função query, pool e applyMigrations
 */
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  applyMigrations
};
