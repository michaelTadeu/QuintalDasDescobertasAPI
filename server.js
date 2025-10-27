// server.js
require('dotenv').config();

// Carrega o arquivo .env de acordo com o ambiente (se necessário)
if (process.env.NODE_ENV === 'production') {
    require("dotenv").config({ path: '.env.production' });
  } else {
    require("dotenv").config({ path: '.env.development' });
  }

const express = require('express');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const db = require('./db');
const app = express();

// Defina a URL dependendo do ambiente
const hostUrl = process.env.NODE_ENV === 'development'
  ? 'localhost:3000'
  : 'quintasdasdescobertasapi-e4035394de2a.herokuapp.com';

const scheme = process.env.NODE_ENV === 'development' ? 'http' : 'https';

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

(async () => {
  try {
    await db.applyMigrations();
    console.log('DB pronta.');
  } catch (err) {
    console.error('Falha ao inicializar DB', err);
    process.exit(1);
  }
})();

/* ---------- GUARDIANS (responsáveis) ---------- */

// Listar todos
app.get('/guardians', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM guardians ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obter por id
app.get('/guardians/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM guardians WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Guardian not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar
app.post('/guardians',
  [
    body('name').notEmpty().withMessage('name is required'),
    body('email').optional().isEmail().withMessage('invalid email'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, email, relationship } = req.body;
    try {
      const result = await db.query(
        `INSERT INTO guardians (name, phone, email, relationship) VALUES ($1,$2,$3,$4) RETURNING *`,
        [name, phone || null, email || null, relationship || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Atualizar
app.put('/guardians/:id',
  [
    body('name').optional().notEmpty(),
    body('email').optional().isEmail()
  ],
  async (req, res) => {
    const id = req.params.id;
    const { name, phone, email, relationship } = req.body;
    try {
      const { rows } = await db.query('SELECT id FROM guardians WHERE id = $1', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Guardian not found' });

      const updated_at = new Date().toISOString();
      const result = await db.query(
        `UPDATE guardians
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             relationship = COALESCE($4, relationship),
             updated_at = $5
         WHERE id = $6
         RETURNING *`,
        [name, phone, email, relationship, updated_at, id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Deletar
app.delete('/guardians/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM guardians WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Guardian not found' });

    await db.query('DELETE FROM guardians WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- STUDENTS (estudantes) ---------- */

// Listar todos (opcional ?guardian_id=)
app.get('/students', async (req, res) => {
  try {
    const { guardian_id } = req.query;
    if (guardian_id) {
      const { rows } = await db.query('SELECT * FROM students WHERE guardian_id = $1 ORDER BY name', [guardian_id]);
      return res.json(rows);
    }
    const { rows } = await db.query(`
      SELECT s.*, g.name AS guardian_name, g.phone AS guardian_phone, g.email AS guardian_email
      FROM students s
      LEFT JOIN guardians g ON s.guardian_id = g.id
      ORDER BY s.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obter por id
app.get('/students/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, g.name AS guardian_name, g.phone AS guardian_phone, g.email AS guardian_email
      FROM students s
      LEFT JOIN guardians g ON s.guardian_id = g.id
      WHERE s.id = $1
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar
app.post('/students',
  [
    body('name').notEmpty().withMessage('name is required'),
    body('guardian_id').optional().isInt().withMessage('guardian_id must be integer'),
    body('birthdate').optional().isISO8601().toDate()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, birthdate, classroom, guardian_id } = req.body;
    try {
      if (guardian_id) {
        const { rows: g } = await db.query('SELECT id FROM guardians WHERE id = $1', [guardian_id]);
        if (!g.length) return res.status(400).json({ error: 'guardian_id invalid' });
      }

      const result = await db.query(
        `INSERT INTO students (name, birthdate, classroom, guardian_id) VALUES ($1,$2,$3,$4) RETURNING *`,
        [name, birthdate || null, classroom || null, guardian_id || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Atualizar
app.put('/students/:id',
  [
    body('name').optional().notEmpty(),
    body('guardian_id').optional().isInt()
  ],
  async (req, res) => {
    const id = req.params.id;
    const { name, birthdate, classroom, guardian_id } = req.body;
    try {
      const { rows: exists } = await db.query('SELECT id FROM students WHERE id = $1', [id]);
      if (!exists.length) return res.status(404).json({ error: 'Student not found' });

      if (guardian_id) {
        const { rows: g } = await db.query('SELECT id FROM guardians WHERE id = $1', [guardian_id]);
        if (!g.length) return res.status(400).json({ error: 'guardian_id invalid' });
      }

      const updated_at = new Date().toISOString();
      const result = await db.query(
        `UPDATE students
         SET name = COALESCE($1, name),
             birthdate = COALESCE($2, birthdate),
             classroom = COALESCE($3, classroom),
             guardian_id = COALESCE($4, guardian_id),
             updated_at = $5
         WHERE id = $6
         RETURNING *`,
        [name, birthdate || null, classroom || null, guardian_id || null, updated_at, id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Deletar
app.delete('/students/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM students WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });

    await db.query('DELETE FROM students WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Health check */
app.get('/', (req, res) => res.json({ message: 'Quintal API (Postgres) ok' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});