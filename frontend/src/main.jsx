import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ─── MovieCard ────────────────────────────────────────────────────────────────────
function MovieCard({ movie, showSimilarity = false, showPopularity = false }) {
  const genres  = Array.isArray(movie.genres) ? movie.genres : [];
  const rating  =
    typeof movie.vote_average === "number" && !isNaN(movie.vote_average)
      ? movie.vote_average.toFixed(1)
      : "N/D";
  const overview =
    movie.overview
      ? movie.overview.length > 160
        ? movie.overview.slice(0, 157) + "…"
        : movie.overview
      : null;

  return (
    <div className="movieCard">
      <div className="movieCardTop">
        <h3 className="movieTitle">{movie.title}</h3>
        {movie.release_year && (
          <span className="yearBadge">{movie.release_year}</span>
        )}
      </div>

      {genres.length > 0 && (
        <div className="genreList">
          {genres.slice(0, 4).map((g) => (
            <span key={g} className="genreChip">
              {g}
            </span>
          ))}
        </div>
      )}

      <div className="movieMeta">
        <span className="rating">⭐ {rating}</span>
        {showSimilarity && movie.similarity != null && (
          <span className="simBadge">
            {Math.max(0, Math.round(movie.similarity * 100))}% match
          </span>
        )}
        {showPopularity && movie.popularity != null && (
          <span className="popBadge">
            🔥 {parseFloat(movie.popularity).toFixed(1)}
          </span>
        )}
      </div>

      {overview && <p className="movieOverview">{overview}</p>}
    </div>
  );
}

// ─── ChatTab ──────────────────────────────────────────────────────────────────────
function ChatTab() {
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res  = await fetch(`${API_URL}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al buscar");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chatTab">
      {/* Intro */}
      <div className="chatIntro">
        <h2>Encontrá tu próxima película</h2>
        <p>
          Describí qué tipo de película querés ver y te recomendaré las que
          mejor encajen usando búsqueda vectorial + IA.
        </p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSearch} className="searchForm">
        <input
          type="text"
          className="searchInput"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej: una película de ciencia ficción con viajes en el tiempo y giros inesperados…"
          disabled={loading}
          autoFocus
        />
        <button
          type="submit"
          className="searchBtn"
          disabled={loading || !query.trim()}
        >
          {loading ? <span className="btnSpinner" /> : "Buscar"}
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="loadingState">
          <div className="spinner" />
          <p>Buscando películas similares…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="errorBox">
          <strong>Error</strong>
          <span>{error}</span>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="chatResult">
          {/* Respuesta del LLM */}
          <div className="llmResponse">
            <div className="llmAvatar">🤖</div>
            <div className="llmBubble">
              {result.response
                .split("\n")
                .filter(Boolean)
                .map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
            </div>
          </div>

          {/* Cards de películas */}
          {result.movies.length > 0 && (
            <section className="recommendedSection">
              <h3 className="sectionTitle">Películas encontradas</h3>
              <div className="movieGrid">
                {result.movies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} showSimilarity />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MoviesTab ────────────────────────────────────────────────────────────────────
function MoviesTab() {
  const LIMIT = 20;

  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page,            setPage]            = useState(1);
  const [movies,          setMovies]          = useState([]);
  const [total,           setTotal]           = useState(0);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);

  // Debounce 300 ms — también resetea la página
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch cada vez que cambia la página o la búsqueda
  React.useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page, limit: LIMIT });
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res  = await fetch(`${API_URL}/movies?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar películas");
        setMovies(data.movies);
        setTotal(data.total);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="moviesTab">
      {/* Barra de búsqueda + contador */}
      <div className="moviesHeader">
        <input
          type="text"
          className="searchInput"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título…"
        />
        {!loading && (
          <span className="moviesCount">
            {total.toLocaleString()} película{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="loadingState">
          <div className="spinner" />
          <p>Cargando películas…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="errorBox">
          <strong>Error</strong>
          <span>{error}</span>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && movies.length > 0 && (
        <>
          <div className="movieGrid">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} showPopularity />
            ))}
          </div>

          {/* Paginación */}
          <div className="paginationBar">
            <button
              className="paginationBtn"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              ← Anterior
            </button>
            <span className="paginationInfo">
              Página {page} de {totalPages}
            </span>
            <button
              className="paginationBtn"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              Siguiente →
            </button>
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !error && movies.length === 0 && (
        <div className="placeholderTab">
          <span className="placeholderIcon">🔍</span>
          <p>No se encontraron películas{search ? ` para "${search}"` : ""}.</p>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────────
function App() {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <div className="app">
      <header className="appHeader">
        <div className="appBrand">
          <span className="brandIcon">🎬</span>
          <span className="brandName">MovieMatch</span>
        </div>
        <nav className="tabNav">
          <button
            className={`tabBtn${activeTab === "chat" ? " tabBtnActive" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            💬 Chat
          </button>
          <button
            className={`tabBtn${activeTab === "movies" ? " tabBtnActive" : ""}`}
            onClick={() => setActiveTab("movies")}
          >
            🎞️ Películas
          </button>
        </nav>
      </header>

      <main className="appContent">
        {activeTab === "chat" ? <ChatTab /> : <MoviesTab />}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
