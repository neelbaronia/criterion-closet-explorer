"use client";
/* eslint-disable @next/next/no-img-element -- Posters are remote archive data. */

import { useEffect, useMemo, useState } from "react";
import filmsData from "../data/films.json";
import { DreamListMatcher } from "./DreamListMatcher";

type Film = (typeof filmsData)[number];
type SortKey = "featured" | "title" | "year-desc" | "year-asc";

const films = filmsData as Film[];
const sourceUrl = "https://www.criterion.com/closet-picks";

function watchUrl(title: string) {
  return `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`;
}

function channelUrl(title: string) {
  return `https://www.criterionchannel.com/search?q=${encodeURIComponent(title)}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState("All visitors");
  const [era, setEra] = useState("All decades");
  const [sort, setSort] = useState<SortKey>("featured");
  const [activeFilm, setActiveFilm] = useState<Film | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedReady, setSavedReady] = useState(false);

  const pickers = useMemo(
    () =>
      [...new Set(films.flatMap((film) => film.pickers))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [],
  );

  const decades = useMemo(
    () =>
      [...new Set(films.map((film) => Math.floor(film.year / 10) * 10))].sort(
        (a, b) => b - a,
      ),
    [],
  );

  const filteredFilms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const results = films.filter((film) => {
      const searchable = [
        film.title,
        film.director,
        film.year.toString(),
        ...film.pickers,
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesPicker =
        picker === "All visitors" || film.pickers.includes(picker);
      const matchesEra =
        era === "All decades" ||
        Math.floor(film.year / 10) * 10 === Number(era);
      return matchesQuery && matchesPicker && matchesEra;
    });

    return [...results].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "year-desc") return b.year - a.year;
      if (sort === "year-asc") return a.year - b.year;
      return b.pickers.length - a.pickers.length;
    });
  }, [era, picker, query, sort]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("closet-index-saved");
      if (stored) setSaved(JSON.parse(stored));
      setSavedReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!savedReady) return;
    window.localStorage.setItem("closet-index-saved", JSON.stringify(saved));
  }, [saved, savedReady]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveFilm(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function toggleSaved(id: string) {
    setSaved((current) =>
      current.includes(id)
        ? current.filter((filmId) => filmId !== id)
        : [...current, id],
    );
  }

  function clearFilters() {
    setQuery("");
    setPicker("All visitors");
    setEra("All decades");
  }

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="The Closet Index home">
          <span className="wordmark-mark">C</span>
          <span>
            THE CLOSET
            <br />
            INDEX
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#explore">Explore</a>
          <a href="#dream-list">Build yours</a>
          <a href="#about">About</a>
          <a className="variations-link" href="/design-variations.html">
            5 design directions ↗
          </a>
        </nav>
        <div className="saved-count" aria-label={`${saved.length} saved films`}>
          Saved <span>{String(saved.length).padStart(2, "0")}</span>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span>Unofficial archive</span>
          <span>Est. 2010</span>
          <span>Prototype edition · 040 films</span>
        </div>
        <h1>
          What&apos;s in
          <br />
          <em>their</em> tote bag?
        </h1>
        <div className="hero-bottom">
          <p>
            Search the films that directors, actors, and artists carried out of
            the Criterion Closet—and find your next watch.
          </p>
          <a className="round-link" href="#explore" aria-label="Start exploring">
            ↓
          </a>
        </div>
        <div className="marquee" aria-hidden="true">
          <span>
            CHRISTOPHER NOLAN · AGNÈS VARDA · JUDE LAW · GUILLERMO DEL TORO ·
            RYUSUKE HAMAGUCHI · JOHN LEGUIZAMO · PABLO LARRAÍN ·&nbsp;
          </span>
        </div>
      </section>

      <section className="explorer" id="explore">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The working index</p>
            <h2>Find a film</h2>
          </div>
          <p className="section-note">
            A sourced prototype with 40 selections from 12 visitors. The data
            structure is ready for the complete archive.
          </p>
        </div>

        <div className="search-panel">
          <label className="search-field">
            <span className="sr-only">Search films, directors, or visitors</span>
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Film, director, or closet visitor"
              type="search"
            />
            <kbd>⌘ K</kbd>
          </label>
          <label>
            <span>Visitor</span>
            <select
              value={picker}
              onChange={(event) => setPicker(event.target.value)}
            >
              <option>All visitors</option>
              {pickers.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Decade</span>
            <select value={era} onChange={(event) => setEra(event.target.value)}>
              <option>All decades</option>
              {decades.map((decade) => (
                <option key={decade} value={decade}>
                  {decade}s
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Order</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="featured">Most picked</option>
              <option value="title">Title A–Z</option>
              <option value="year-desc">Newest first</option>
              <option value="year-asc">Oldest first</option>
            </select>
          </label>
        </div>

        <div className="results-bar">
          <p>
            Showing <strong>{filteredFilms.length}</strong> of {films.length}{" "}
            films
          </p>
          {(query || picker !== "All visitors" || era !== "All decades") && (
            <button type="button" onClick={clearFilters}>
              Clear filters ×
            </button>
          )}
        </div>

        {filteredFilms.length ? (
          <div className="film-grid">
            {filteredFilms.map((film, index) => {
              const isSaved = saved.includes(film.id);
              return (
                <article className="film-card" key={film.id}>
                  <div className="poster-wrap">
                    <button
                      className="poster-button"
                      type="button"
                      onClick={() => setActiveFilm(film)}
                      aria-label={`View details for ${film.title}`}
                    >
                      <img
                        src={film.poster}
                        alt={`${film.title} poster`}
                        loading={index < 6 ? "eager" : "lazy"}
                      />
                      <span className="poster-action">View title ↗</span>
                    </button>
                    <span className="catalog-number">
                      CI—{String(index + 1).padStart(3, "0")}
                    </span>
                    <button
                      className={`save-button ${isSaved ? "is-saved" : ""}`}
                      type="button"
                      onClick={() => toggleSaved(film.id)}
                      aria-pressed={isSaved}
                      aria-label={`${isSaved ? "Remove" : "Add"} ${film.title} ${
                        isSaved ? "from" : "to"
                      } saved films`}
                    >
                      {isSaved ? "★" : "☆"}
                    </button>
                  </div>
                  <button
                    className="film-copy"
                    type="button"
                    onClick={() => setActiveFilm(film)}
                  >
                    <span className="film-year">{film.year}</span>
                    <h3>{film.title}</h3>
                    <p>{film.director}</p>
                  </button>
                  <div className="picked-by">
                    <span>Picked by</span>
                    <p>{film.pickers.join(" + ")}</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <span>∅</span>
            <h3>That shelf is empty.</h3>
            <p>Try another visitor, decade, or search term.</p>
            <button type="button" onClick={clearFilters}>
              Reset the index
            </button>
          </div>
        )}
      </section>

      <DreamListMatcher />

      <section className="about" id="about">
        <p className="eyebrow">About the archive</p>
        <div>
          <h2>A map of taste, one tote bag at a time.</h2>
          <p>
            The Closet Index is an independent, searchable companion to
            Criterion&apos;s Closet Picks series. This first build proves the
            browsing model; the next data pass can expand it to every recorded
            visitor and selection.
          </p>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Visit the official Closet Picks archive ↗
          </a>
        </div>
        <div className="about-stats">
          <p>
            <strong>40</strong>
            <span>films indexed</span>
          </p>
          <p>
            <strong>12</strong>
            <span>closet visitors</span>
          </p>
          <p>
            <strong>1946—2021</strong>
            <span>years represented</span>
          </p>
        </div>
      </section>

      <footer>
        <p>THE CLOSET INDEX © 2026</p>
        <p>
          Film data sourced from Criterion. Poster imagery via TMDB. This
          project is not affiliated with The Criterion Collection.
        </p>
        <a href="#top">Back to top ↑</a>
      </footer>

      {activeFilm && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveFilm(null);
          }}
        >
          <section
            className="film-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            <button
              className="drawer-close"
              type="button"
              onClick={() => setActiveFilm(null)}
              aria-label="Close details"
            >
              Close ×
            </button>
            <div className="drawer-poster">
              <img
                src={activeFilm.poster}
                alt={`${activeFilm.title} poster`}
              />
            </div>
            <div className="drawer-content">
              <p className="eyebrow">Closet selection</p>
              <h2 id="drawer-title">{activeFilm.title}</h2>
              <p className="drawer-meta">
                {activeFilm.year} · Directed by {activeFilm.director}
              </p>
              <div className="drawer-picker">
                <span>Carried out of the closet by</span>
                <strong>{activeFilm.pickers.join(" + ")}</strong>
              </div>
              <div className="watch-links">
                <a
                  href={watchUrl(activeFilm.title)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Check streaming options ↗
                </a>
                <a
                  href={channelUrl(activeFilm.title)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Search Criterion Channel ↗
                </a>
                <a href={sourceUrl} target="_blank" rel="noreferrer">
                  See Closet Picks source ↗
                </a>
              </div>
              <p className="availability-note">
                Streaming rights change frequently. Links open live search
                results for the current U.S. availability.
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
