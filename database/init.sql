CREATE EXTENSION IF NOT EXISTS vector;

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
    embedding    VECTOR(1024),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Evita duplicados en la ingesta (mismo título y año)
CREATE UNIQUE INDEX IF NOT EXISTS movies_title_year_idx
    ON movies (title, release_year);

CREATE TABLE IF NOT EXISTS query_cache (
    id              SERIAL PRIMARY KEY,
    query_text      TEXT        NOT NULL,
    query_embedding VECTOR(1024) NOT NULL,
    response        JSONB       NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS query_cache_embedding_idx
    ON query_cache USING hnsw (query_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
