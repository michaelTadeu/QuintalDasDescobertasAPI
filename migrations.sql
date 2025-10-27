CREATE TABLE IF NOT EXISTS guardians (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  relationship TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  birthdate DATE,
  classroom TEXT,
  guardian_id INTEGER REFERENCES guardians(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_students_name ON students (LOWER(name));
