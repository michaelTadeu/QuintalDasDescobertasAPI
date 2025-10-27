// db.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // descomente se necessário (ex: Heroku)
});

// // Determina se precisa habilitar SSL (Heroku / RDS costumam precisar)
// const needSsl = process.env.NODE_ENV === 'production' ||
//                 (databaseUrl && /amazonaws|heroku|ec2|render/.test(databaseUrl));

async function applyMigrations() {
  try {
    const migrationsPath = path.join(__dirname, 'migrations.sql');
    if (!fs.existsSync(migrationsPath)) return;
    const sql = fs.readFileSync(migrationsPath, 'utf8');
    await pool.query(sql);
    console.log('Migrations aplicadas com sucesso (ou já existentes).');
  } catch (err) {
    console.error('Erro aplicando migrations:', err.message);
    throw err;
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  applyMigrations
};
