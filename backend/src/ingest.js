/**
 * ingest.js — Carga el dataset tmdb_5000_movies.csv en PostgreSQL
 * con embeddings embed-multilingual-v3.0 (1024 dims) vía Cohere SDK.
 *
 * Uso:
 *   node src/ingest.js
 *
 * Variables de entorno necesarias (igual que index.js + COHERE_API_KEY).
 */

require("dotenv").config();

const fs   = require("fs");
const path = require("path");
const { parse }        = require("csv-parse/sync");
const { Pool }         = require("pg");
const { CohereClient } = require("cohere-ai");

// ─── Configuración ─────────────────────────────────────────────────────────────

const DATA_PATH = process.env.DATA_PATH ||
  path.resolve(__dirname, "..", "..", "data", "tmdb_5000_movies.csv");

const BATCH_SIZE = 50; // seguro por debajo del límite de Cohere (96)

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

const pool = new Pool({
  host:     process.env.PGHOST     || "localhost",
  port:     Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "app_db",
  user:     process.env.PGUSER     || "app_user",
  password: process.env.PGPASSWORD || "app_password",
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Extrae nombres de un JSON string tipo [{"id":1,"name":"Action"}, ...] */
function parseJsonNames(jsonStr) {
  try {
    const arr = JSON.parse(jsonStr);
    return Array.isArray(arr) ? arr.map((x) => x.name).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Construye el texto que se va a embeddear */
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

/** Llama a embed-multilingual-v3.0 y devuelve array de embeddings para el batch */
async function generateEmbeddings(texts) {
  const response = await cohere.embed({
    texts,
    model:     "embed-multilingual-v3.0",
    inputType: "search_document",
  });
  return response.embeddings; // float[][]
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Leer CSV
  console.log(`📂 Leyendo CSV desde ${DATA_PATH} ...`);
  const content = fs.readFileSync(DATA_PATH, "utf-8");
  const records = parse(content, {
    columns:           true,
    skip_empty_lines:  true,
    trim:              true,
  });
  console.log(`✅ ${records.length} películas encontradas en el CSV\n`);

  const db = await pool.connect();

  try {
    // 2. Obtener títulos ya existentes (idempotencia)
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

    // 3. Procesar en batches
    let inserted = 0;

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);

      // 3a. Generar embeddings para todo el batch de una sola llamada
      const texts      = batch.map(buildText);
      const embeddings = await generateEmbeddings(texts);

      // 3b. Insertar cada película
      for (let j = 0; j < batch.length; j++) {
        const movie     = batch[j];
        const embedding = embeddings[j];

        const genres   = parseJsonNames(movie.genres);
        const keywords = parseJsonNames(movie.keywords);
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
              `[${embedding.join(",")}]`,   // formato que acepta pgvector
            ]
          );
        } catch (err) {
          // Conflicto por título duplicado con año distinto → saltar silencioso
          if (err.code !== "23505") throw err;
        }

        inserted++;

        // Progreso cada 100 películas
        if (inserted % 100 === 0) {
          console.log(`  → ${inserted}/${toProcess.length} insertadas...`);
        }
      }
    }

    // Reporte final
    console.log(`\n✅ Ingesta completa: ${inserted} insertadas, ${skipped} saltadas\n`);

    // 4. Crear índice ivfflat DESPUÉS de cargar los datos
    const countResult = await db.query(
      "SELECT COUNT(*) AS n FROM movies WHERE embedding IS NOT NULL"
    );
    const total = parseInt(countResult.rows[0].n, 10);

    if (total > 0) {
      // Heurística: lists ≈ √n, mínimo 10, máximo 100
      const lists = Math.max(10, Math.min(Math.ceil(Math.sqrt(total)), 100));
      console.log(`🔧 Creando índice ivfflat sobre ${total} vectores (lists=${lists})...`);

      await db.query("DROP INDEX IF EXISTS movies_embedding_idx");
      await db.query(`
        CREATE INDEX movies_embedding_idx
          ON movies USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = ${lists})
      `);

      console.log("✅ Índice ivfflat creado exitosamente");
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
