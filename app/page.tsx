"use client";
/* eslint-disable @next/next/no-img-element -- Posters are remote archive data. */

import { useEffect, useMemo, useRef, useState } from "react";
import filmsData from "../data/films.json";

type Film = (typeof filmsData)[number];
type SortField = "title" | "year" | "director" | "picker";
type SortDirection = "asc" | "desc";

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
  const [picker, setPicker] = useState("All closet pickers");
  const [director, setDirector] = useState("All directors");
  const [decade, setDecade] = useState("All decades");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");
  const searchRef = useRef<HTMLInputElement>(null);

  const pickers = useMemo(
    () =>
      [...new Set(films.flatMap((film) => film.pickers))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [],
  );

  const directors = useMemo(
    () =>
      [...new Set(films.map((film) => film.director))].sort((a, b) =>
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
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const results = films.filter((film) => {
      const searchable = [
        film.title,
        film.director,
        film.year.toString(),
        ...film.pickers,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (picker === "All closet pickers" || film.pickers.includes(picker)) &&
        (director === "All directors" || film.director === director) &&
        (decade === "All decades" ||
          Math.floor(film.year / 10) * 10 === Number(decade))
      );
    });

    return results.sort((a, b) => {
      let comparison = 0;
      if (sortField === "title") comparison = a.title.localeCompare(b.title);
      if (sortField === "year") comparison = a.year - b.year;
      if (sortField === "director") {
        comparison = a.director.localeCompare(b.director);
      }
      if (sortField === "picker") {
        comparison = a.pickers.join(", ").localeCompare(b.pickers.join(", "));
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [decade, director, picker, query, sortDirection, sortField]);

  const filtersActive =
    Boolean(query) ||
    picker !== "All closet pickers" ||
    director !== "All directors" ||
    decade !== "All decades";

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function clearFilters() {
    setQuery("");
    setPicker("All closet pickers");
    setDirector("All directors");
    setDecade("All decades");
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection(field === "year" ? "desc" : "asc");
  }

  function ariaSort(
    field: SortField,
  ): "none" | "ascending" | "descending" {
    if (sortField !== field) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  }

  function sortMark(field: SortField) {
    if (sortField !== field) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  return (
    <main id="top">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="The Closet Index home">
          [ C—INDEX ]
        </a>
        <p>Criterion Closet Picks / Unofficial database</p>
        <nav aria-label="Archive links">
          <a href="/design-variations.html">Design study</a>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Criterion source ↗
          </a>
        </nav>
      </header>

      <section className="database-shell" aria-labelledby="database-title">
        <div className="database-heading">
          <div>
            <p className="eyebrow">The working index</p>
            <h1 id="database-title">Criterion Closet picks</h1>
          </div>
          <div className="database-count">
            <strong>{String(films.length).padStart(3, "0")}</strong>
            <span>films indexed</span>
          </div>
        </div>

        <div className="filter-panel" aria-label="Filter the film table">
          <label className="search-field">
            <span>Search</span>
            <div>
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title, director, picker, or year"
                type="search"
              />
              <kbd>⌘ K</kbd>
            </div>
          </label>

          <label>
            <span>Closet picker</span>
            <select
              value={picker}
              onChange={(event) => setPicker(event.target.value)}
            >
              <option>All closet pickers</option>
              {pickers.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Director</span>
            <select
              value={director}
              onChange={(event) => setDirector(event.target.value)}
            >
              <option>All directors</option>
              {directors.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Decade</span>
            <select
              value={decade}
              onChange={(event) => setDecade(event.target.value)}
            >
              <option>All decades</option>
              {decades.map((value) => (
                <option key={value} value={value}>
                  {value}s
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-status" aria-live="polite">
          <p>
            Showing <strong>{filteredFilms.length}</strong> of {films.length}{" "}
            films
          </p>
          <p className="availability-note">
            Watch links open current U.S. availability searches.
          </p>
          {filtersActive && (
            <button type="button" onClick={clearFilters}>
              Clear filters ×
            </button>
          )}
        </div>

        <div className="filmstrip-table">
          <div className="sprocket-rail" aria-hidden="true" />
          <div className="table-wrap">
            <table>
            <thead>
              <tr>
                <th className="poster-column" scope="col">
                  Poster
                </th>
                <th scope="col" aria-sort={ariaSort("title")}>
                  <button type="button" onClick={() => toggleSort("title")}>
                    Title <span>{sortMark("title")}</span>
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort("year")}>
                  <button type="button" onClick={() => toggleSort("year")}>
                    Year <span>{sortMark("year")}</span>
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort("director")}>
                  <button type="button" onClick={() => toggleSort("director")}>
                    Director <span>{sortMark("director")}</span>
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort("picker")}>
                  <button type="button" onClick={() => toggleSort("picker")}>
                    Closet picker <span>{sortMark("picker")}</span>
                  </button>
                </th>
                <th className="watch-column" scope="col">
                  Where to watch
                </th>
              </tr>
            </thead>
              <tbody>
                {filteredFilms.map((film, index) => (
                  <tr key={film.id}>
                    <td className="poster-cell">
                      <div className="poster-frame">
                        <img
                          src={film.poster}
                          alt={`${film.title} poster`}
                          loading={index < 8 ? "eager" : "lazy"}
                        />
                      </div>
                    </td>
                    <td className="title-cell">
                      <strong>{film.title}</strong>
                    </td>
                    <td className="year-cell">{film.year}</td>
                    <td>{film.director}</td>
                    <td className="picker-cell">{film.pickers.join(" + ")}</td>
                    <td>
                      <div className="watch-links">
                        <a
                          href={watchUrl(film.title)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          JustWatch ↗
                        </a>
                        <a
                          href={channelUrl(film.title)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Criterion Channel ↗
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredFilms.length && (
              <div className="empty-state">
                <strong>No films found.</strong>
                <p>Try another title, director, picker, or decade.</p>
                <button type="button" onClick={clearFilters}>
                  Reset filters
                </button>
              </div>
            )}
          </div>
          <div className="sprocket-rail" aria-hidden="true" />
        </div>

        <footer>
          <p>
            Film selections sourced from Criterion. Poster imagery via TMDB.
          </p>
          <p>
            Independent project; not affiliated with The Criterion Collection.
          </p>
          <a href="#top">Back to top ↑</a>
        </footer>
      </section>
    </main>
  );
}
