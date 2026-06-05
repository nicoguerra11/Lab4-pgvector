require("dotenv").config();

const fs   = require("fs");
const path = require("path");
const { parse }        = require("csv-parse/sync");
const { Pool }         = require("pg");
const { CohereClient } = require("cohere-ai");

const DATA_PATH = process.env.DATA_PATH ||
  path.resolve(__dirname, "..", "..", "data", "tmdb_5000_movies.csv");

const BATCH_SIZE  = 50;
const BATCH_DELAY = 6000; // ms entre batches — tier free de Cohere: 100k tokens/min

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

const pool = new Pool({
  host:     process.env.PGHOST     || "localhost",
  port:     Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "app_db",
  user:     process.env.PGUSER     || "app_user",
  password: process.env.PGPASSWORD || "app_password",
});

function parseJsonNames(jsonStr) {
  try {
    const arr = JSON.parse(jsonStr);
    return Array.isArray(arr) ? arr.map((x) => x.name).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function buildText(movie) {
  const genres   = parseJsonNames(movie.genres).join(", ");
  const keywords = parseJsonNames(movie.keywords).join(", ");
  return [
    `Title: ${movie.title}.`,
    movie.overview ? `Overview: ${movie.overview}.` : null,
    genres         ? `Genres: ${genres}.`            : null,
    keywords       ? `Keywords: ${keywords}.`        : null,
  ]
    .filter(Boolean)
    .join(" ");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateEmbeddings(texts) {
  const response = await cohere.embed({
    texts,
    model:     "embed-multilingual-v3.0",
    inputType: "search_document",
  });
  return response.embeddings;
}

async function main() {
  console.log(`📂 Leyendo CSV desde ${DATA_PATH} ...`);
  const content = fs.readFileSync(DATA_PATH, "utf-8");
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  console.log(`✅ ${records.length} películas encontradas en el CSV\n`);

  const db = await pool.connect();

  try {
    console.log("🔍 Verificando registros existentes en la BD...");
    const { rows } = await db.query("SELECT title FROM movies");
    const existingTitles = new Set(rows.map((r) => r.title));

    const toProcess = records.filter((r) => !existingTitles.has(r.title));
    const skipped   = records.length - toProcess.length;
    console.log(`📊 ${toProcess.length} nuevas | ${skipped} ya existen\n`);

    if (toProcess.length === 0) {
      console.log("✅ Nada que procesar. La base de datos ya está al día.");
      return;
    }

    let inserted = 0;

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch      = toProcess.slice(i, i + BATCH_SIZE);
      const texts      = batch.map(buildText);
      const embeddings = await generateEmbeddings(texts);
      await sleep(BATCH_DELAY);

      for (let j = 0; j < batch.length; j++) {
        const movie     = batch[j];
        const embedding = embeddings[j];
        const genres    = parseJsonNames(movie.genres);
        const keywords  = parseJsonNames(movie.keywords);
        const releaseYear = movie.release_date
          ? parseInt(movie.release_date.split("-")[0], 10) || null
          : null;

        try {
          await db.query(
            `INSERT INTO movies
               (title, overview, genres, keywords,
                release_year, vote_average, vote_count, popularity, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              movie.title,
              movie.overview  || null,
              genres,
              keywords,
              releaseYear,
              parseFloat(movie.vote_average) || null,
              parseInt(movie.vote_count, 10) || null,
              parseFloat(movie.popularity)   || null,
              `[${embedding.join(",")}]`,
            ]
          );
        } catch (err) {
          if (err.code !== "23505") throw err; // ignorar duplicados por título
        }

        inserted++;
        if (inserted % 100 === 0) console.log(`  → ${inserted}/${toProcess.length} insertadas...`);
      }
    }

    console.log(`\n✅ Ingesta completa: ${inserted} insertadas, ${skipped} saltadas\n`);

    const countResult = await db.query(
      "SELECT COUNT(*) AS n FROM movies WHERE embedding IS NOT NULL"
    );
    const total = parseInt(countResult.rows[0].n, 10);

    if (total > 0) {
      console.log(`🔧 Creando índice HNSW sobre ${total} vectores...`);
      await db.query("DROP INDEX IF EXISTS movies_embedding_idx");
      await db.query(`
        CREATE INDEX movies_embedding_idx
          ON movies USING hnsw (embedding vector_cosine_ops)
          WITH (m = 16, ef_construction = 64)
      `);
      console.log("✅ Índice HNSW creado exitosamente");
    }
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Error fatal:", err.message);
  process.exit(1);
});
