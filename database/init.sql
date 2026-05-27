-- Habilitar la extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla principal de películas
CREATE TABLE IF NOT EXISTS movies (
    id           SERIAL PRIMARY KEY,
    title        TEXT        NOT NULL,
    overview     TEXT,
    genres       TEXT[],
    keywords     TEXT[],
    release_year INT,
    vote_average NUMERIC(4, 2),
    vote_count   INT,
    popularity   NUMERIC(10, 4),
    embedding    VECTOR(1024),          -- voyage-3 → 1024 dimensiones
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único para idempotencia en el ingesta
CREATE UNIQUE INDEX IF NOT EXISTS movies_title_year_idx
    ON movies (title, release_year);
