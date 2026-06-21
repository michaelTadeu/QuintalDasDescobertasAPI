// server.js

const path = require('path');

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';

require('dotenv').config({ path: path.resolve(__dirname, envFile) });

const express = require('express');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ---------- HEALTH CHECK ---------- */

app.get('/', (req, res) => {
  res.json({
    message: 'Quintal API (Postgres) ok',
    environment: process.env.NODE_ENV || 'development'
  });
});

/* ---------- GUARDIANS ---------- */

app.get('/guardians', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM guardians ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('Erro em GET /guardians:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/guardians/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM guardians WHERE id = $1',
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Guardian not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erro em GET /guardians/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post(
  '/guardians',
  [
    body('name').notEmpty().withMessage('name is required'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('invalid email')
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, relationship } = req.body;

    try {
      const result = await db.query(
        `
        INSERT INTO guardians (name, phone, email, relationship)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [name, phone || null, email || null, relationship || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erro em POST /guardians:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.put(
  '/guardians/:id',
  [
    body('name').optional().notEmpty(),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = req.params.id;
    const { name, phone, email, relationship } = req.body;

    try {
      const { rows } = await db.query(
        'SELECT id FROM guardians WHERE id = $1',
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Guardian not found' });
      }

      const result = await db.query(
        `
        UPDATE guardians
        SET name = COALESCE($1, name),
            phone = COALESCE($2, phone),
            email = COALESCE($3, email),
            relationship = COALESCE($4, relationship),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
        `,
        [
          name ?? null,
          phone ?? null,
          email ?? null,
          relationship ?? null,
          id
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erro em PUT /guardians/:id:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.delete('/guardians/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id FROM guardians WHERE id = $1',
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Guardian not found' });
    }

    await db.query('DELETE FROM guardians WHERE id = $1', [req.params.id]);

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Erro em DELETE /guardians/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- STUDENTS ---------- */

app.get('/students', async (req, res) => {
  try {
    const { guardian_id } = req.query;

    if (guardian_id) {
      const { rows } = await db.query(
        'SELECT * FROM students WHERE guardian_id = $1 ORDER BY name',
        [guardian_id]
      );

      return res.json(rows);
    }

    const { rows } = await db.query(`
      SELECT
        s.*,
        g.name AS guardian_name,
        g.phone AS guardian_phone,
        g.email AS guardian_email
      FROM students s
      LEFT JOIN guardians g ON s.guardian_id = g.id
      ORDER BY s.name
    `);

    res.json(rows);
  } catch (err) {
    console.error('Erro em GET /students:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/students/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT
        s.*,
        g.name AS guardian_name,
        g.phone AS guardian_phone,
        g.email AS guardian_email
      FROM students s
      LEFT JOIN guardians g ON s.guardian_id = g.id
      WHERE s.id = $1
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erro em GET /students/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post(
  '/students',
  [
    body('name').notEmpty().withMessage('name is required'),
    body('guardian_id').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('guardian_id must be integer'),
    body('birthdate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('birthdate must be ISO8601')
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, birthdate, classroom, guardian_id } = req.body;

    try {
      if (guardian_id) {
        const { rows: guardians } = await db.query(
          'SELECT id FROM guardians WHERE id = $1',
          [guardian_id]
        );

        if (!guardians.length) {
          return res.status(400).json({ error: 'guardian_id invalid' });
        }
      }

      const result = await db.query(
        `
        INSERT INTO students (name, birthdate, classroom, guardian_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          name,
          birthdate || null,
          classroom || null,
          guardian_id || null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erro em POST /students:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.put(
  '/students/:id',
  [
    body('name').optional().notEmpty(),
    body('guardian_id').optional({ nullable: true, checkFalsy: true }).isInt(),
    body('birthdate').optional({ nullable: true, checkFalsy: true }).isISO8601()
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = req.params.id;
    const { name, birthdate, classroom, guardian_id } = req.body;

    try {
      const { rows: exists } = await db.query(
        'SELECT id FROM students WHERE id = $1',
        [id]
      );

      if (!exists.length) {
        return res.status(404).json({ error: 'Student not found' });
      }

      if (guardian_id) {
        const { rows: guardians } = await db.query(
          'SELECT id FROM guardians WHERE id = $1',
          [guardian_id]
        );

        if (!guardians.length) {
          return res.status(400).json({ error: 'guardian_id invalid' });
        }
      }

      const result = await db.query(
        `
        UPDATE students
        SET name = COALESCE($1, name),
            birthdate = COALESCE($2, birthdate),
            classroom = COALESCE($3, classroom),
            guardian_id = COALESCE($4, guardian_id),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
        `,
        [
          name ?? null,
          birthdate ?? null,
          classroom ?? null,
          guardian_id ?? null,
          id
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erro em PUT /students/:id:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.delete('/students/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id FROM students WHERE id = $1',
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await db.query('DELETE FROM students WHERE id = $1', [req.params.id]);

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Erro em DELETE /students/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- START SERVER ---------- */

async function startServer() {
  try {
    if (typeof db.testConnection === 'function') {
      await db.testConnection();
    } else {
      await db.query('SELECT 1');
      console.log('DB pronta.');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Falha ao inicializar DB:', err);
    process.exit(1);
  }
}

startServer();