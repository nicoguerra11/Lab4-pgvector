import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const TMDB_GENRES = [
  "Action","Adventure","Animation","Comedy","Crime","Documentary",
  "Drama","Family","Fantasy","Foreign","History","Horror",
  "Music","Mystery","Romance","Science Fiction","Thriller","TV Movie","War","Western",
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────────
const ICONS = {
  film:    "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z",
  chat:    "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
  grid:    "M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z",
  star:    "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  fire:    "M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-1 .23-1.98.68-2.83 1.27-2.89 2.1-4.09 5.84-3.52 9.29.07.41-.05.83-.33 1.14-.27.3-.68.43-1.05.3-1.84-.76-2.82-2.6-2.82-4.22-1.94 3.11-2.32 7.3.32 10.27 2.07 2.28 5.14 3.38 8.03 3.38 3.18 0 6.12-1.27 8.02-3.7 1.6-2 2.04-4.62 1.37-7.1-.35-1.28-.97-2.5-1.49-3.41z",
  search:  "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  sparkle: "M12 1l2.39 7.26H22l-6.19 4.5 2.38 7.26L12 15.52 5.81 20l2.38-7.26L2 8.26h7.61z",
  moon:    "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  sun:     "M12 9c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3m0-2c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM1 13h2c.55 0 1-.45 1-1s-.45-1-1-1H1c-.55 0-1 .45-1 1s.45 1 1 1zm20 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 1v2c0 .55.45 1 1 1s1-.45 1-1V1c0-.55-.45-1-1-1s-1 .45-1 1zm0 20v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z",
  clock:   "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
  chart:   "M5 21H3V9h2v12zm4 0H7V3h2v18zm4 0h-2v-7h2v7zm4 0h-2V7h2v14zm4 0h-2v-4h2v4z",
  close:   "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  filter:  "M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z",
  similar: "M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z",
};

function Icon({ name, size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
         className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("theme") === "dark"; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);
  return [dark, setDark];
}

function useSearchHistory() {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("searchHistory") || "[]"); } catch { return []; }
  });
  const add = (q) => setHistory((prev) => {
    const next = [q, ...prev.filter((x) => x !== q)].slice(0, 5);
    try { localStorage.setItem("searchHistory", JSON.stringify(next)); } catch {}
    return next;
  });
  const clear = () => {
    setHistory([]);
    try { localStorage.removeItem("searchHistory"); } catch {}
  };
  return [history, add, clear];
}

// ─── MovieCard ────────────────────────────────────────────────────────────────────
function MovieCard({ movie, showSimilarity = false, showPopularity = false }) {
  const [expanded,    setExpanded]    = useState(false);
  const [showSim,     setShowSim]     = useState(false);
  const [simMovies,   setSimMovies]   = useState([]);
  const [loadingSim,  setLoadingSim]  = useState(false);

  const genres   = Array.isArray(movie.genres)   ? movie.genres   : [];
  const keywords = Array.isArray(movie.keywords) ? movie.keywords : [];
  const ratingVal = parseFloat(movie.vote_average);
  const rating    = !isNaN(ratingVal) && ratingVal > 0 ? ratingVal.toFixed(1) : "N/D";
  const isLong    = movie.overview && movie.overview.length > 160;
  const overview  = movie.overview
    ? expanded || !isLong ? movie.overview : movie.overview.slice(0, 157) + "…"
    : null;

  async function handleSimilar() {
    if (showSim) { setShowSim(false); return; }
    if (simMovies.length > 0) { setShowSim(true); return; }
    setLoadingSim(true);
    try {
      const res  = await fetch(`${API_URL}/movies/${movie.id}/similar`);
      const data = await res.json();
      setSimMovies(data.movies || []);
      setShowSim(true);
    } catch { /* silencioso */ }
    finally { setLoadingSim(false); }
  }

  return (
    <div className={`movieCard${expanded ? " movieCardExpanded" : ""}`}>
      <div className="movieCardTop">
        <h3 className="movieTitle">{movie.title}</h3>
        {movie.release_year && <span className="yearBadge">{movie.release_year}</span>}
      </div>

      {genres.length > 0 && (
        <div className="genreList">
          {genres.slice(0, 4).map((g) => <span key={g} className="genreChip">{g}</span>)}
        </div>
      )}

      <div className="movieMeta">
        <span className="rating"><Icon name="star" size={14} />{rating}</span>
        {showSimilarity && movie.similarity != null && (
          <div className="simInfo">
            <span className="simBadge">{Math.max(0, Math.round(movie.similarity * 100))}% match</span>
            <span className="distBadge">dist: {Math.max(0, 1 - movie.similarity).toFixed(3)}</span>
          </div>
        )}
        {showPopularity && movie.popularity != null && (
          <span className="popBadge">
            <Icon name="fire" size={12} />{parseFloat(movie.popularity).toFixed(1)}
          </span>
        )}
      </div>

      {overview && (
        <div className="movieOverview">
          <p>{overview}</p>
          {isLong && (
            <button className="expandBtn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Ver menos ↑" : "Ver más ↓"}
            </button>
          )}
        </div>
      )}

      {expanded && keywords.length > 0 && (
        <div className="keywordSection">
          <p className="keywordLabel">Keywords</p>
          <div className="keywordList">
            {keywords.slice(0, 12).map((k) => <span key={k} className="keywordChip">{k}</span>)}
          </div>
        </div>
      )}

      <button className="similarBtn" onClick={handleSimilar} disabled={loadingSim}>
        {loadingSim
          ? <span className="btnSpinnerSm" />
          : <Icon name="similar" size={13} />}
        {showSim ? "Ocultar similares" : "Ver similares"}
      </button>

      {showSim && simMovies.length > 0 && (
        <div className="similarSection">
          <p className="similarLabel">Películas similares por embedding</p>
          <div className="similarList">
            {simMovies.map((s) => (
              <div key={s.id} className="similarItem">
                <span className="similarTitle">{s.title}</span>
                {s.release_year && <span className="similarYear">{s.release_year}</span>}
                <span className="simBadge">{Math.max(0, Math.round(s.similarity * 100))}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CustomSelect ─────────────────────────────────────────────────────────────────
function CustomSelect({ value, onChange, options, placeholder = "Todos" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="customSelect" ref={ref}>
      <button
        type="button"
        className={`customSelectTrigger${open ? " customSelectOpen" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{value || placeholder}</span>
        <svg className={`customSelectChevron${open ? " chevronUp" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
      {open && (
        <div className="customSelectMenu">
          <div
            className={`customSelectItem${!value ? " customSelectItemActive" : ""}`}
            onClick={() => { onChange(""); setOpen(false); }}
          >
            {placeholder}
          </div>
          {options.map((opt) => (
            <div
              key={opt}
              className={`customSelectItem${value === opt ? " customSelectItemActive" : ""}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────────────
function BarChart({ data, labelKey, valueKey, color = "var(--primary)" }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="barChart">
      {data.map((item) => (
        <div key={item[labelKey]} className="barRow">
          <span className="barLabel">{item[labelKey]}</span>
          <div className="barTrack">
            <div className="barFill" style={{ width: `${(item[valueKey] / max) * 100}%`, background: color }} />
          </div>
          <span className="barValue">{Number(item[valueKey]).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── StatsTab ─────────────────────────────────────────────────────────────────────
function StatsTab() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/stats`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setStats(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loadingState"><div className="spinner" /><p>Calculando estadísticas…</p></div>;
  if (error)   return <div className="errorBox"><strong>Error</strong><span>{error}</span></div>;
  if (!stats)  return null;

  return (
    <div className="statsTab">
      <div className="statsKpis">
        <div className="kpiCard">
          <span className="kpiValue">{stats.total.toLocaleString()}</span>
          <span className="kpiLabel">Películas en la BD</span>
        </div>
        <div className="kpiCard">
          <span className="kpiValue">{stats.genreDistribution.length}</span>
          <span className="kpiLabel">Géneros distintos</span>
        </div>
        <div className="kpiCard">
          <span className="kpiValue">{stats.byDecade.length}</span>
          <span className="kpiLabel">Décadas cubiertas</span>
        </div>
      </div>

      <div className="statsGrid">
        <div className="statsCard statsCardWide">
          <h3 className="statsCardTitle"><Icon name="grid" size={15} />Distribución por género</h3>
          <BarChart data={stats.genreDistribution} labelKey="genre" valueKey="count" color="var(--primary)" />
        </div>

        <div className="statsCard">
          <h3 className="statsCardTitle"><Icon name="chart" size={15} />Películas por década</h3>
          <BarChart
            data={stats.byDecade.map((d) => ({ ...d, decade: `${d.decade}s` }))}
            labelKey="decade" valueKey="count" color="var(--sim)"
          />
        </div>

        <div className="statsCard">
          <h3 className="statsCardTitle"><Icon name="fire" size={15} />Top 10 más populares</h3>
          <ol className="topList">
            {stats.topByPopularity.map((m, i) => (
              <li key={m.id} className="topItem">
                <span className="topRank">{i + 1}</span>
                <span className="topTitle">{m.title}</span>
                <span className="popBadge"><Icon name="fire" size={11} />{parseFloat(m.popularity).toFixed(0)}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="statsCard">
          <h3 className="statsCardTitle"><Icon name="star" size={15} />Top 10 mejor calificadas</h3>
          <ol className="topList">
            {stats.topByRating.map((m, i) => (
              <li key={m.id} className="topItem">
                <span className="topRank">{i + 1}</span>
                <span className="topTitle">{m.title}</span>
                <span className="rating"><Icon name="star" size={12} />{parseFloat(m.vote_average).toFixed(1)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── ComparisonSection ────────────────────────────────────────────────────────────
function ComparisonSection({ vectorMovies, textMovies }) {
  const [open, setOpen] = useState(false);
  const textIds    = new Set(textMovies.map((m) => m.id));
  const vectorIds  = new Set(vectorMovies.map((m) => m.id));
  const onlyVector = vectorMovies.filter((m) => !textIds.has(m.id));
  const onlyText   = textMovies.filter((m) => !vectorIds.has(m.id));
  const overlap    = textMovies.filter((m) => vectorIds.has(m.id));

  return (
    <div className="comparisonSection">
      <button className="comparisonToggle" onClick={() => setOpen((v) => !v)}>
        <Icon name="filter" size={13} />
        Comparación: búsqueda vectorial vs textual
        <span>{open ? "↑" : "↓"}</span>
      </button>

      {open && (
        <div className="comparisonBody">
          <p className="comparisonExplain">
            La búsqueda <strong>vectorial</strong> entiende el <em>significado semántico</em> de tu consulta.
            La <strong>textual</strong> (SQL LIKE) solo matchea palabras exactas en título y sinopsis.
          </p>
          <div className="comparisonCols">
            <div className="comparisonCol">
              <div className="compColHeader colVector">
                <Icon name="sparkle" size={13} /> Solo vectorial ({onlyVector.length})
              </div>
              {onlyVector.length === 0
                ? <p className="compEmpty">—</p>
                : onlyVector.map((m) => (
                    <div key={m.id} className="compItem">
                      <span>{m.title}</span>
                      <span className="simBadge">{Math.max(0, Math.round(m.similarity * 100))}%</span>
                    </div>
                  ))}
            </div>
            <div className="comparisonCol">
              <div className="compColHeader colOverlap">Coincidencia ({overlap.length})</div>
              {overlap.length === 0
                ? <p className="compEmpty">Ninguna en común</p>
                : overlap.map((m) => <div key={m.id} className="compItem"><span>{m.title}</span></div>)}
            </div>
            <div className="comparisonCol">
              <div className="compColHeader colText">
                <Icon name="search" size={13} /> Solo textual ({onlyText.length})
              </div>
              {onlyText.length === 0
                ? <p className="compEmpty">—</p>
                : onlyText.map((m) => <div key={m.id} className="compItem"><span>{m.title}</span></div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ChatTab ──────────────────────────────────────────────────────────────────────
function ChatTab() {
  const [query,       setQuery]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [messages,    setMessages]    = useState([]);
  const [cohereHist,  setCohereHist]  = useState([]);
  const [error,       setError]       = useState(null);
  const [history, addToHistory, clearHistory] = useSearchHistory();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSearch(q) {
    const trimmed = (q || query).trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    addToHistory(trimmed);
    setMessages((prev) => [...prev, { type: "user", text: trimmed }]);
    setQuery("");

    try {
      const res  = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, chatHistory: cohereHist }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al buscar");
      setCohereHist(data.chatHistory || []);
      setMessages((prev) => [...prev, {
        type: "bot", text: data.response,
        movies: data.movies || [], textMovies: data.textMovies || [],
        genre: data.genre,
        correctedQuery: data.correctedQuery || null,
        corrections: data.corrections || [],
      }]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function reset() { setMessages([]); setCohereHist([]); setError(null); setQuery(""); }

  return (
    <div className="chatTab">
      {messages.length === 0 && (
        <>
          <div className="chatIntro">
            <h2>Encontrá tu próxima película</h2>
            <p>Describí qué tipo de película querés ver y te recomendaré las que mejor encajen usando búsqueda vectorial + IA.</p>
          </div>
          {history.length > 0 && (
            <div className="historyBar">
              <Icon name="clock" size={14} className="historyIcon" />
              <div className="historyChips">
                {history.map((h) => (
                  <button key={h} className="historyChip" onClick={() => handleSearch(h)}>{h}</button>
                ))}
              </div>
              <button className="historyClear" onClick={clearHistory}><Icon name="close" size={14} /></button>
            </div>
          )}
        </>
      )}

      {messages.length > 0 && (
        <div className="conversation">
          {messages.map((msg, i) =>
            msg.type === "user" ? (
              <div key={i} className="userMessage">
                <span className="userBubble">{msg.text}</span>
              </div>
            ) : (
              <div key={i} className="botTurn">
                {msg.correctedQuery && (
                  <div className="correctionNote">
                    Corregí:{" "}
                    {msg.corrections.map((c, i) => (
                      <span key={i}>
                        <span className="correctionFrom">{c.from}</span>
                        {" → "}
                        <strong className="correctionTo">{c.to}</strong>
                        {i < msg.corrections.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                )}
                <div className="llmResponse">
                  <div className="llmAvatar"><Icon name="sparkle" size={22} /></div>
                  <div className="llmBubble">
                    {msg.text.split("\n").filter(Boolean).map((line, j) => <p key={j}>{line}</p>)}
                  </div>
                </div>
                {msg.movies.length > 0 && (
                  <section className="recommendedSection">
                    <h3 className="sectionTitle"><Icon name="sparkle" size={13} /> Resultados vectoriales</h3>
                    <div className="movieGrid">
                      {msg.movies.map((m) => <MovieCard key={m.id} movie={m} showSimilarity />)}
                    </div>
                  </section>
                )}
                {msg.textMovies && msg.textMovies.length > 0 && (
                  <ComparisonSection vectorMovies={msg.movies} textMovies={msg.textMovies} />
                )}
              </div>
            )
          )}
          {loading && (
            <div className="loadingState" style={{ marginTop: 16 }}>
              <div className="spinner" /><p>Buscando películas similares…</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {!messages.length && loading && (
        <div className="loadingState"><div className="spinner" /><p>Buscando películas similares…</p></div>
      )}
      {error && <div className="errorBox"><strong>Error</strong><span>{error}</span></div>}

      <div className={messages.length > 0 ? "chatInputWrap chatInputSticky" : "chatInputWrap"}>
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="searchForm">
          <input
            type="text" className="searchInput" value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={messages.length > 0
              ? "Seguí la conversación o hacé otra búsqueda…"
              : "Ej: una película de ciencia ficción con viajes en el tiempo…"}
            disabled={loading} autoFocus
          />
          <button type="submit" className="searchBtn" disabled={loading || !query.trim()}>
            {loading ? <span className="btnSpinner" /> : "Buscar"}
          </button>
        </form>
        {messages.length > 0 && (
          <button className="resetBtn" onClick={reset}>Nueva conversación</button>
        )}
      </div>
    </div>
  );
}

// ─── MoviesTab ────────────────────────────────────────────────────────────────────
function MoviesTab() {
  const LIMIT = 20;
  const [search,    setSearch]    = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [page,      setPage]      = useState(1);
  const [movies,    setMovies]    = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showF,     setShowF]     = useState(false);
  const [genre,     setGenre]     = useState("");
  const [yearFrom,  setYearFrom]  = useState("");
  const [yearTo,    setYearTo]    = useState("");
  const [minRating, setMinRating] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const p = new URLSearchParams({ page, limit: LIMIT });
        if (debSearch) p.set("search",    debSearch);
        if (genre)     p.set("genre",     genre);
        if (yearFrom)  p.set("yearFrom",  yearFrom);
        if (yearTo)    p.set("yearTo",    yearTo);
        if (minRating) p.set("minRating", minRating);
        const res  = await fetch(`${API_URL}/movies?${p}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        setMovies(data.movies); setTotal(data.total);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    }
    load();
  }, [page, debSearch, genre, yearFrom, yearTo, minRating]);

  const hasFilters = genre || yearFrom || yearTo || minRating;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function clearFilters() {
    setGenre(""); setYearFrom(""); setYearTo(""); setMinRating(""); setPage(1);
  }

  return (
    <div className="moviesTab">
      <div className="moviesHeader">
        <input type="text" className="searchInput" value={search}
          onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título…" />
        <button
          className={`filterToggleBtn${showF || hasFilters ? " filterToggleActive" : ""}`}
          onClick={() => setShowF((v) => !v)} title="Filtros"
        >
          <Icon name="filter" size={16} />
          {hasFilters && <span className="filterDot" />}
        </button>
        {!loading && (
          <span className="moviesCount">{total.toLocaleString()} película{total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {showF && (
        <div className="filterPanel">
          <div className="filterRow">
            <label className="filterLabel">Género</label>
            <CustomSelect
              value={genre}
              onChange={(v) => { setGenre(v); setPage(1); }}
              options={TMDB_GENRES}
            />
          </div>
          <div className="filterRow">
            <label className="filterLabel">Año</label>
            <div className="filterYearRange">
              <input type="number" className="filterInput" placeholder="Desde"
                value={yearFrom} min="1900" max="2030"
                onChange={(e) => { setYearFrom(e.target.value); setPage(1); }} />
              <span className="filterSep">—</span>
              <input type="number" className="filterInput" placeholder="Hasta"
                value={yearTo} min="1900" max="2030"
                onChange={(e) => { setYearTo(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="filterRow">
            <label className="filterLabel">Rating mín.</label>
            <input type="number" className="filterInput" placeholder="Ej: 7.0"
              value={minRating} min="0" max="10" step="0.5"
              onChange={(e) => { setMinRating(e.target.value); setPage(1); }} />
          </div>
          {hasFilters && (
            <button className="clearFiltersBtn" onClick={clearFilters}>Limpiar filtros</button>
          )}
        </div>
      )}

      {loading && <div className="loadingState"><div className="spinner" /><p>Cargando películas…</p></div>}
      {error && <div className="errorBox"><strong>Error</strong><span>{error}</span></div>}

      {!loading && !error && movies.length > 0 && (
        <>
          <div className="movieGrid">
            {movies.map((m) => <MovieCard key={m.id} movie={m} showPopularity />)}
          </div>
          <div className="paginationBar">
            <button className="paginationBtn" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>← Anterior</button>
            <span className="paginationInfo">Página {page} de {totalPages}</span>
            <button className="paginationBtn" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Siguiente →</button>
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
  const [dark, setDark] = useDarkMode();

  return (
    <div className="app">
      <header className="appHeader">
        <div className="appBrand">
          <Icon name="film" size={24} className="brandSvg" />
          <span className="brandName">MovieMatch</span>
        </div>
        <nav className="tabNav">
          <button className={`tabBtn${activeTab === "chat"   ? " tabBtnActive" : ""}`} onClick={() => setActiveTab("chat")}>
            <Icon name="chat"  size={15} />Chat
          </button>
          <button className={`tabBtn${activeTab === "movies" ? " tabBtnActive" : ""}`} onClick={() => setActiveTab("movies")}>
            <Icon name="grid"  size={15} />Películas
          </button>
          <button className={`tabBtn${activeTab === "stats"  ? " tabBtnActive" : ""}`} onClick={() => setActiveTab("stats")}>
            <Icon name="chart" size={15} />Stats
          </button>
        </nav>
        <button className="darkToggle" onClick={() => setDark((v) => !v)} title={dark ? "Modo claro" : "Modo oscuro"}>
          <Icon name={dark ? "sun" : "moon"} size={18} />
        </button>
      </header>

      <main className="appContent">
        {activeTab === "chat"   && <ChatTab />}
        {activeTab === "movies" && <MoviesTab />}
        {activeTab === "stats"  && <StatsTab />}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
