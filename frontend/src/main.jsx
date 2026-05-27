import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ─── SVG Icons (cross-platform, heredan color del CSS) ───────────────────────────
const ICONS = {
  film:    "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z",
  chat:    "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
  grid:    "M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z",
  star:    "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  fire:    "M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-1 .23-1.98.68-2.83 1.27-2.89 2.1-4.09 5.84-3.52 9.29.07.41-.05.83-.33 1.14-.27.3-.68.43-1.05.3-1.84-.76-2.82-2.6-2.82-4.22-1.94 3.11-2.32 7.3.32 10.27 2.07 2.28 5.14 3.38 8.03 3.38 3.18 0 6.12-1.27 8.02-3.7 1.6-2 2.04-4.62 1.37-7.1-.35-1.28-.97-2.5-1.49-3.41z",
  search:  "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  sparkle: "M12 1l2.39 7.26H22l-6.19 4.5 2.38 7.26L12 15.52 5.81 20l2.38-7.26L2 8.26h7.61z",
};

function Icon({ name, size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
         className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

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
            <span key={g} className="genreChip">{g}</span>
          ))}
        </div>
      )}

      <div className="movieMeta">
        <span className="rating">
          <Icon name="star" size={14} />
          {rating}
        </span>
        {showSimilarity && movie.similarity != null && (
          <span className="simBadge">
            {Math.max(0, Math.round(movie.similarity * 100))}% match
          </span>
        )}
        {showPopularity && movie.popularity != null && (
          <span className="popBadge">
            <Icon name="fire" size={12} />
            {parseFloat(movie.popularity).toFixed(1)}
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
      <div className="chatIntro">
        <h2>Encontrá tu próxima película</h2>
        <p>
          Describí qué tipo de película querés ver y te recomendaré las que
          mejor encajen usando búsqueda vectorial + IA.
        </p>
      </div>

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
        <button type="submit" className="searchBtn" disabled={loading || !query.trim()}>
          {loading ? <span className="btnSpinner" /> : "Buscar"}
        </button>
      </form>

      {loading && (
        <div className="loadingState">
          <div className="spinner" />
          <p>Buscando películas similares…</p>
        </div>
      )}

      {error && (
        <div className="errorBox">
          <strong>Error</strong>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="chatResult">
          <div className="llmResponse">
            <div className="llmAvatar">
              <Icon name="sparkle" size={22} />
            </div>
            <div className="llmBubble">
              {result.response
                .split("\n")
                .filter(Boolean)
                .map((line, i) => <p key={i}>{line}</p>)}
            </div>
          </div>

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

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

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

      {loading && (
        <div className="loadingState">
          <div className="spinner" />
          <p>Cargando películas…</p>
        </div>
      )}

      {error && (
        <div className="errorBox">
          <strong>Error</strong>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && movies.length > 0 && (
        <>
          <div className="movieGrid">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} showPopularity />
            ))}
          </div>

          <div className="paginationBar">
            <button className="paginationBtn" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              ← Anterior
            </button>
            <span className="paginationInfo">Página {page} de {totalPages}</span>
            <button className="paginationBtn" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              Siguiente →
            </button>
          </div>
        </>
      )}

      {!loading && !error && movies.length === 0 && (
        <div className="placeholderTab">
          <Icon name="search" size={48} className="placeholderSvg" />
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
          <Icon name="film" size={24} className="brandSvg" />
          <span className="brandName">MovieMatch</span>
        </div>
        <nav className="tabNav">
          <button
            className={`tabBtn${activeTab === "chat" ? " tabBtnActive" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <Icon name="chat" size={15} />
            Chat
          </button>
          <button
            className={`tabBtn${activeTab === "movies" ? " tabBtnActive" : ""}`}
            onClick={() => setActiveTab("movies")}
          >
            <Icon name="grid" size={15} />
            Películas
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
