require("dotenv").config();

const express          = require("express");
const cors             = require("cors");
const { Pool }         = require("pg");
const { CohereClient } = require("cohere-ai");

const app  = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5174" }));

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

// ─── Detección de género y preambles ────────────────────────────────────────────

const GENRE_KEYWORDS = {
  action:      ["acción", "accion", "action", "pelea", "lucha", "explosión", "adrenalina", "combate", "batalla"],
  adventure:   ["aventura", "adventure", "exploración", "expedición", "viaje épico"],
  animation:   ["animación", "animacion", "animation", "cartoon", "animada", "pixar", "disney"],
  comedy:      ["comedia", "comedy", "gracioso", "divertida", "humor", "risa", "chistosa", "cómica"],
  crime:       ["crimen", "crime", "policial", "detective", "robo", "mafia", "delito", "gangster"],
  documentary: ["documental", "documentary", "historia real", "basada en hechos reales"],
  drama:       ["drama", "dramática", "emocional", "sentimental", "profunda", "reflexiva"],
  family:      ["familia", "family", "niños", "infantil", "para chicos", "para toda la familia"],
  fantasy:     ["fantasía", "fantasia", "fantasy", "magia", "mágica", "dragones", "hechicero"],
  foreign:     ["extranjera", "foreign", "cine europeo", "cine asiático", "subtitulada"],
  history:     ["histórica", "historica", "history", "época", "antigua", "guerra mundial", "medieval"],
  horror:      ["terror", "horror", "miedo", "susto", "aterrador", "scary", "fantasma", "zombies"],
  music:       ["música", "musica", "music", "musical", "cantante", "banda"],
  mystery:     ["misterio", "mystery", "enigma", "secreto", "intriga", "quién lo hizo"],
  romance:     ["romance", "romántica", "romantica", "amor", "amorosa", "pareja"],
  scifi:       ["ciencia ficción", "ciencia ficcion", "sci-fi", "futuro", "robots", "alien", "espacio", "naves espaciales"],
  thriller:    ["thriller", "suspenso", "suspense", "tensión", "intriga policial"],
  tvmovie:     ["tv movie", "telefilm", "película de tv"],
  war:         ["guerra", "bélica", "belica", "military", "soldados", "guerra mundial"],
  western:     ["western", "vaqueros", "oeste", "cowboy", "far west"],
  // "ficción" sola en español significa "narrativa" (opuesto a documental),
  // NO "ciencia ficción" — capturarla aquí evita el fallback por resultado.
  general:     ["ficcion", "ficción", "narrativa", "ficcion dramatica", "ficción dramática"],
};

const GENRE_PREAMBLES = {
  action:
    "Sos un crítico de cine especializado en películas de acción. Respondé con energía y entusiasmo explosivo. Usá lenguaje dinámico: destacá la adrenalina, las persecuciones y el ritmo trepidante. Respondé en español rioplatense.",
  adventure:
    "Sos un crítico de cine aventurero. Respondé con emoción y espíritu explorador. Destacá los paisajes épicos, los desafíos y la sensación de aventura. Respondé en español rioplatense.",
  animation:
    "Sos un crítico especializado en animación. Respondé con alegría desbordante. Destacá la magia visual, los personajes entrañables y los mensajes que dejan estas películas. Respondé en español rioplatense.",
  comedy:
    "Sos un crítico de cine con mucho humor. Respondé de forma divertida y descontracturada. Si podés hacer algún chiste relacionado con las pelis, dale. Respondé en español rioplatense.",
  crime:
    "Sos un crítico especializado en cine policial. Respondé con tono serio y analítico, como un detective. Destacá los giros de trama, la tensión y los personajes complejos. Respondé en español rioplatense.",
  documentary:
    "Sos un apasionado de los documentales. Respondé con tono informativo y comprometido. Explicá por qué el tema de cada documental importa y vale la pena verlo. Respondé en español rioplatense.",
  drama:
    "Sos un crítico que aprecia el drama humano. Respondé con sensibilidad y reflexión. Destacá el impacto emocional, los temas universales y el desarrollo de personajes. Respondé en español rioplatense.",
  family:
    "Sos un crítico de cine familiar. Respondé con calidez y entusiasmo. Destacá los valores, los momentos divertidos y lo que disfruta toda la familia. Respondé en español rioplatense.",
  fantasy:
    "Sos un crítico especializado en fantasía. Respondé con imaginación desbordante y asombro. Describí los mundos mágicos y las aventuras épicas como si fueran reales. Respondé en español rioplatense.",
  foreign:
    "Sos un crítico cinéfilo especializado en cine internacional. Respondé con entusiasmo cultural. Destacá la perspectiva única que aporta cada país o cultura al cine mundial. Respondé en español rioplatense.",
  history:
    "Sos un crítico apasionado por el cine histórico. Respondé con tono culto e informativo. Destacá el contexto histórico y lo que se aprende de cada época representada. Respondé en español rioplatense.",
  horror:
    "Sos un crítico experto en terror. Respondé con tono oscuro, misterioso y tenso. Describí las películas de forma que genere suspenso sin spoilear el final. Respondé en español rioplatense.",
  music:
    "Sos un crítico apasionado por la música y los musicales. Respondé con ritmo y pasión. Destacá las bandas sonoras, las actuaciones y la energía musical. Respondé en español rioplatense.",
  mystery:
    "Sos un crítico especializado en misterio. Respondé con tono enigmático e intrigante. Dejá pistas sobre la trama sin revelar demasiado, haciendo que el usuario quiera descubrirlo. Respondé en español rioplatense.",
  romance:
    "Sos un crítico romántico. Respondé con calidez y un toque poético. Destacá las historias de amor, los momentos emotivos y la química entre personajes. Respondé en español rioplatense.",
  scifi:
    "Sos un crítico apasionado por la ciencia ficción. Respondé con entusiasmo intelectual y visión futurista. Destacá los conceptos científicos, filosóficos y las preguntas que plantea cada película. Respondé en español rioplatense.",
  thriller:
    "Sos un crítico especializado en thrillers. Respondé con tensión y urgencia, como si el tiempo se acabara. Hacé sentir al usuario la adrenalina del suspenso. Respondé en español rioplatense.",
  tvmovie:
    "Sos un crítico especializado en películas para televisión. Respondé de forma accesible y cercana. Destacá lo que hace especial a cada historia televisiva. Respondé en español rioplatense.",
  war:
    "Sos un crítico especializado en cine bélico. Respondé con solemnidad y respeto, destacando el sacrificio humano, la valentía y la crudeza de la guerra. Respondé en español rioplatense.",
  western:
    "Sos un crítico especializado en westerns. Respondé directo y con carácter, como el viejo oeste. Destacá los duelos, los paisajes áridos y los personajes de ley y fuera de la ley. Respondé en español rioplatense.",
  general:
    "Sos un experto en cine que recomienda películas de manera conversacional y entusiasta. Respondé en español rioplatense.",
};

// Mapeo de nombres de género en inglés (como están en la BD) a claves internas
const GENRE_DB_MAP = {
  "action": "action", "adventure": "adventure", "animation": "animation",
  "comedy": "comedy", "crime": "crime", "documentary": "documentary",
  "drama": "drama", "family": "family", "fantasy": "fantasy",
  "foreign": "foreign", "history": "history", "horror": "horror",
  "music": "music", "mystery": "mystery", "romance": "romance",
  "science fiction": "scifi", "thriller": "thriller", "tv movie": "tvmovie",
  "war": "war", "western": "western",
};

/**
 * Detecta el género principal a partir del texto de la query
 * y, como fallback, del género más frecuente en las películas recuperadas.
 */
function detectGenre(query, movies = []) {
  const q = query.toLowerCase();

  // 1. Buscar coincidencia en el texto de la query
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) return genre;
  }

  // 2. Fallback: género más frecuente entre las películas recuperadas
  const counts = {};
  for (const movie of movies) {
    for (const g of Array.isArray(movie.genres) ? movie.genres : []) {
      const key = g.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  const topGenre = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const mapped   = GENRE_DB_MAP[topGenre] || "general";

  // Evitar recomendar en tono "documental" si el usuario no lo pidió explícitamente
  if (mapped === "documentary" && !GENRE_KEYWORDS.documentary.some((kw) => q.includes(kw))) {
    return "general";
  }
  return mapped;
}

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
  const { query, chatHistory = [] } = req.body;

  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "El campo 'query' es requerido." });
  }

  let client;
  try {
    // 1. Embedding de la query
    const embResult = await cohere.embed({
      texts:     [query.trim()],
      model:     "embed-multilingual-v3.0",
      inputType: "search_query",
    });
    const queryVector = embResult.embeddings[0];

    client = await pool.connect();

    // 2. Vector search + text search en paralelo
    const safe = query.trim().replace(/[%_\\]/g, "\\$&");
    const [vectorResult, textResult] = await Promise.all([
      client.query(
        `SELECT id, title, overview, genres, keywords,
                release_year, vote_average, vote_count, popularity,
                1 - (embedding <=> $1::vector) AS similarity
         FROM   movies WHERE embedding IS NOT NULL
         ORDER  BY embedding <=> $1::vector LIMIT 5`,
        [`[${queryVector.join(",")}]`]
      ),
      client.query(
        `SELECT id, title, overview, genres, release_year,
                vote_average, vote_count, popularity
         FROM   movies
         WHERE  title ILIKE $1 OR overview ILIKE $1
         ORDER  BY popularity DESC NULLS LAST LIMIT 5`,
        [`%${safe}%`]
      ),
    ]);

    const movies     = vectorResult.rows;
    const textMovies = textResult.rows;

    if (movies.length === 0) {
      return res.json({
        response:    "No encontré películas en la base de datos.",
        movies:      [],
        textMovies:  [],
        chatHistory: chatHistory,
      });
    }

    // 3. Contexto para el LLM
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

    // 4. Detectar género y preamble
    const detectedGenre = detectGenre(query.trim(), movies);
    const preamble      = GENRE_PREAMBLES[detectedGenre] || GENRE_PREAMBLES.general;
    console.log(`[/api/chat] género detectado: ${detectedGenre}`);

    // 5. Historial para Cohere (últimas 6 entradas = 3 turnos)
    const trimmedHistory = chatHistory.slice(-6);
    const cohereHistory  = trimmedHistory.map((h) => ({
      role:    h.role === "user" ? "USER" : "CHATBOT",
      message: h.message,
    }));

    // 6. Llamar al LLM con historial
    const chatResponse = await cohere.chat({
      model:       "command-r-plus-08-2024",
      preamble,
      chatHistory: cohereHistory,
      message:     `El usuario busca: "${query.trim()}"\n\nPelículas relevantes:\n\n${context}`,
    });

    // 7. Historial actualizado para el frontend
    const updatedHistory = [
      ...trimmedHistory,
      { role: "user",      message: query.trim() },
      { role: "assistant", message: chatResponse.text },
    ];

    const fmt = (m) => ({
      id:           m.id,
      title:        m.title,
      overview:     m.overview,
      genres:       m.genres,
      keywords:     m.keywords || [],
      release_year: m.release_year,
      vote_average: parseFloat(m.vote_average),
      vote_count:   m.vote_count,
      popularity:   parseFloat(m.popularity),
      similarity:   parseFloat(parseFloat(m.similarity ?? 0).toFixed(4)),
    });

    res.json({
      response:    chatResponse.text,
      genre:       detectedGenre,
      movies:      movies.map(fmt),
      textMovies:  textMovies.map((m) => ({ ...fmt(m), similarity: undefined })),
      chatHistory: updatedHistory,
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
  const page      = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit     = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const search    = (req.query.search   || "").trim();
  const genre     = (req.query.genre    || "").trim();
  const yearFrom  = parseInt(req.query.yearFrom,  10) || null;
  const yearTo    = parseInt(req.query.yearTo,    10) || null;
  const minRating = parseFloat(req.query.minRating)   || null;
  const offset    = (page - 1) * limit;

  // Build dynamic WHERE
  const conditions   = [];
  const filterParams = [];

  if (search) {
    filterParams.push(`%${search}%`);
    conditions.push(`title ILIKE $${filterParams.length}`);
  }
  if (genre) {
    filterParams.push(genre);
    conditions.push(`EXISTS(SELECT 1 FROM unnest(genres) AS g WHERE g ILIKE $${filterParams.length})`);
  }
  if (yearFrom) {
    filterParams.push(yearFrom);
    conditions.push(`release_year >= $${filterParams.length}`);
  }
  if (yearTo) {
    filterParams.push(yearTo);
    conditions.push(`release_year <= $${filterParams.length}`);
  }
  if (minRating) {
    filterParams.push(minRating);
    conditions.push(`vote_average >= $${filterParams.length}`);
  }

  const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const dataParams  = [...filterParams, limit, offset];
  const li          = filterParams.length + 1;
  const oi          = filterParams.length + 2;

  let client;
  try {
    client = await pool.connect();

    const [dataResult, countResult] = await Promise.all([
      client.query(
        `SELECT id, title, overview, genres, release_year,
                vote_average, vote_count, popularity
         FROM   movies ${whereClause}
         ORDER  BY popularity DESC NULLS LAST
         LIMIT  $${li} OFFSET $${oi}`,
        dataParams
      ),
      client.query(
        `SELECT COUNT(*) AS total FROM movies ${whereClause}`,
        filterParams
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

// ─── GET /api/movies/:id/similar ────────────────────────────────────────────────
app.get("/api/movies/:id/similar", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT id, title, overview, genres, release_year,
              vote_average, vote_count, popularity,
              1 - (embedding <=> (SELECT embedding FROM movies WHERE id = $1)) AS similarity
       FROM   movies
       WHERE  id != $1 AND embedding IS NOT NULL
       ORDER  BY embedding <=> (SELECT embedding FROM movies WHERE id = $1)
       LIMIT  6`,
      [id]
    );
    res.json({
      movies: rows.map((m) => ({
        id:           m.id,
        title:        m.title,
        overview:     m.overview,
        genres:       m.genres,
        release_year: m.release_year,
        vote_average: parseFloat(m.vote_average),
        popularity:   parseFloat(m.popularity),
        similarity:   parseFloat(parseFloat(m.similarity).toFixed(4)),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
});

// ─── GET /api/stats ──────────────────────────────────────────────────────────────
app.get("/api/stats", async (_req, res) => {
  let client;
  try {
    client = await pool.connect();
    const [genreRows, decadeRows, topPop, topRated, totalRow] = await Promise.all([
      client.query(`
        SELECT g AS genre, COUNT(*) AS count
        FROM   movies, unnest(genres) AS g
        GROUP  BY g ORDER BY count DESC LIMIT 15`),
      client.query(`
        SELECT (release_year / 10 * 10) AS decade, COUNT(*) AS count
        FROM   movies
        WHERE  release_year IS NOT NULL AND release_year BETWEEN 1900 AND 2030
        GROUP  BY decade ORDER BY decade`),
      client.query(`
        SELECT id, title, popularity, vote_average
        FROM   movies WHERE popularity IS NOT NULL
        ORDER  BY popularity DESC LIMIT 10`),
      client.query(`
        SELECT id, title, vote_average, vote_count
        FROM   movies WHERE vote_count >= 100 AND vote_average IS NOT NULL
        ORDER  BY vote_average DESC LIMIT 10`),
      client.query("SELECT COUNT(*) AS total FROM movies"),
    ]);

    res.json({
      total:             parseInt(totalRow.rows[0].total, 10),
      genreDistribution: genreRows.rows.map((r) => ({ genre: r.genre, count: parseInt(r.count, 10) })),
      byDecade:          decadeRows.rows.map((r) => ({ decade: parseInt(r.decade, 10), count: parseInt(r.count, 10) })),
      topByPopularity:   topPop.rows.map((r) => ({ id: r.id, title: r.title, popularity: parseFloat(r.popularity), vote_average: parseFloat(r.vote_average) })),
      topByRating:       topRated.rows.map((r) => ({ id: r.id, title: r.title, vote_average: parseFloat(r.vote_average), vote_count: r.vote_count })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
