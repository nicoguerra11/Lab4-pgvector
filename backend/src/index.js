require("dotenv").config();

const express          = require("express");
const cors             = require("cors");
const { Pool }         = require("pg");
const { CohereClient } = require("cohere-ai");

const app  = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));

// ─── DB pool ────────────────────────────────────────────────────────────────────
const pool = new Pool({
  host:                    process.env.PGHOST     || "localhost",
  port:                    Number(process.env.PGPORT || 5432),
  database:                process.env.PGDATABASE || "app_db",
  user:                    process.env.PGUSER     || "app_user",
  password:                process.env.PGPASSWORD || "app_password",
  max:                     10,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,
});

// ─── Cohere client ──────────────────────────────────────────────────────────────
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

// ─── GET / ──────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    service:   "pgvector movie backend",
    endpoints: ["GET /api/health", "POST /api/chat", "GET /api/movies"],
  });
});

// ─── GET /api/health ────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  let client;
  try {
    client = await pool.connect();

    const [dbRow, vecRow, movRow] = await Promise.all([
      client.query("SELECT current_database() AS db, current_user AS usr, NOW() AS ts"),
      client.query(`
        SELECT
          EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS enabled,
          COALESCE((SELECT extversion FROM pg_extension WHERE extname = 'vector'), 'not installed') AS version
      `),
      client.query("SELECT COUNT(*) AS total FROM movies"),
    ]);

    res.json({
      status:   "ok",
      database: { name: dbRow.rows[0].db, user: dbRow.rows[0].usr, checkedAt: dbRow.rows[0].ts },
      pgvector: { enabled: vecRow.rows[0].enabled, version: vecRow.rows[0].version },
      movies:   { total: parseInt(movRow.rows[0].total, 10) },
    });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  } finally {
    if (client) client.release();
  }
});

// ─── POST /api/chat ─────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "El campo 'query' es requerido." });
  }

  let client;
  try {
    // 1. Generar embedding de la query (inputType: "search_query" para búsqueda)
    const embResult = await cohere.embed({
      texts:     [query.trim()],
      model:     "embed-multilingual-v3.0",
      inputType: "search_query",
    });
    const queryVector = embResult.embeddings[0];

    // 2. Buscar top-5 más similares por distancia coseno
    client = await pool.connect();
    const { rows: movies } = await client.query(
      `SELECT
         id, title, overview, genres, keywords,
         release_year, vote_average, vote_count, popularity,
         1 - (embedding <=> $1::vector) AS similarity
       FROM   movies
       WHERE  embedding IS NOT NULL
       ORDER  BY embedding <=> $1::vector
       LIMIT  5`,
      [`[${queryVector.join(",")}]`]
    );

    if (movies.length === 0) {
      return res.json({
        response: "No encontré películas en la base de datos. Asegurate de haber corrido el script de ingest.",
        movies:   [],
      });
    }

    // 3. Construir contexto para el LLM
    const context = movies
      .map((m, i) => {
        const genres   = Array.isArray(m.genres)   ? m.genres.join(", ")   : "N/D";
        const keywords = Array.isArray(m.keywords) ? m.keywords.join(", ") : "N/D";
        return [
          `${i + 1}. ${m.title} (${m.release_year ?? "s/f"})`,
          `   Géneros: ${genres}`,
          `   Rating: ${m.vote_average ?? "N/D"} / 10  |  Popularidad: ${m.popularity ?? "N/D"}`,
          `   Sinopsis: ${m.overview || "Sin sinopsis disponible."}`,
          `   Keywords: ${keywords}`,
        ].join("\n");
      })
      .join("\n\n");

    // 4. Llamar al LLM con el contexto
    const chatResponse = await cohere.chat({
      model:    "command-r-plus-08-2024",
      preamble: `Sos un experto en cine que recomienda películas de manera conversacional, en español rioplatense.
Recibirás una consulta del usuario y un listado de películas obtenidas por búsqueda vectorial de similitud.
Tu tarea es recomendar esas películas de forma natural y entusiasta, justificando brevemente por qué cada una encaja con la búsqueda.
Para cada recomendación mencioná: el título, el año, el género principal y un dato concreto de la sinopsis que la conecte con lo pedido.
Limitá tu respuesta a las películas del contexto. Sé conciso pero cálido.`,
      message:  `El usuario busca: "${query.trim()}"\n\nPelículas relevantes:\n\n${context}`,
    });

    // 5. Retornar respuesta + metadatos de películas
    res.json({
      response: chatResponse.text,
      movies:   movies.map((m) => ({
        id:           m.id,
        title:        m.title,
        overview:     m.overview,
        genres:       m.genres,
        keywords:     m.keywords,
        release_year: m.release_year,
        vote_average: parseFloat(m.vote_average),
        vote_count:   m.vote_count,
        popularity:   parseFloat(m.popularity),
        similarity:   parseFloat(parseFloat(m.similarity).toFixed(4)),
      })),
    });
  } catch (err) {
    console.error("[/api/chat] Error:", err.message);
    res.status(500).json({ error: "Error al procesar la consulta.", detail: err.message });
  } finally {
    if (client) client.release();
  }
});

// ─── GET /api/movies ────────────────────────────────────────────────────────────
app.get("/api/movies", async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const search = (req.query.search || "").trim();
  const offset = (page - 1) * limit;

  // Parámetros separados para data query y count query (posiciones distintas)
  const dataWhere   = search ? "WHERE title ILIKE $3" : "";
  const countWhere  = search ? "WHERE title ILIKE $1" : "";
  const dataParams  = search ? [limit, offset, `%${search}%`] : [limit, offset];
  const countParams = search ? [`%${search}%`] : [];

  let client;
  try {
    client = await pool.connect();

    const [dataResult, countResult] = await Promise.all([
      client.query(
        `SELECT id, title, overview, genres, release_year,
                vote_average, vote_count, popularity
         FROM   movies
         ${dataWhere}
         ORDER  BY popularity DESC NULLS LAST
         LIMIT  $1 OFFSET $2`,
        dataParams
      ),
      client.query(
        `SELECT COUNT(*) AS total FROM movies ${countWhere}`,
        countParams
      ),
    ]);

    res.json({
      movies: dataResult.rows,
      total:  parseInt(countResult.rows[0].total, 10),
      page,
      limit,
    });
  } catch (err) {
    console.error("[/api/movies] Error:", err.message);
    res.status(500).json({ error: "Error al consultar películas.", detail: err.message });
  } finally {
    if (client) client.release();
  }
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────────
process.on("SIGINT",  async () => { await pool.end(); process.exit(0); });
process.on("SIGTERM", async () => { await pool.end(); process.exit(0); });

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend escuchando en puerto ${port}`);
});
