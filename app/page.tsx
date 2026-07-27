"use client";
/* eslint-disable @next/next/no-img-element -- Posters are remote archive data. */

import { useEffect, useMemo, useRef, useState } from "react";
import closetVideosData from "../data/closet-videos.json";
import filmsData from "../data/films.json";
import peopleData from "../data/people.json";
import streamingAvailabilityData from "../data/streaming-availability.json";

type Film = {
  collectionId: string;
  criterionUrl: string;
  director: string;
  filmId: string;
  id: string;
  pickedAs: string;
  picker: string;
  poster: string;
  slug: string;
  title: string;
  year: number | null;
};
type ClosetVideo = {
  collectionId: string;
  criterionUrl: string;
  picker: string;
  pickerImage: string;
  publishedOn: string;
  recordedOn: string;
  title: string;
  url: string;
};
type Provider = "criterion" | "netflix" | "prime" | "max";
type Availability = {
  providers: Provider[];
  source: string;
};
type SortField = "closet" | "title" | "year" | "director" | "picker";
type SortDirection = "asc" | "desc";
const pageSize = 100;

const films = filmsData as unknown as Film[];
const peopleImages = peopleData as Record<string, string>;
const closetVideos = closetVideosData as Record<string, ClosetVideo>;
const streamingAvailability = streamingAvailabilityData as {
  region: string;
  checkedOn: string;
  titles: Record<string, Availability>;
};
const closetReleaseScores = new Map(
  Object.entries(closetVideos)
    .sort(([, a], [, b]) =>
      (a.publishedOn || a.recordedOn).localeCompare(
        b.publishedOn || b.recordedOn,
      ),
    )
    .map(([collectionId], index) => [collectionId, index + 1]),
);
const verifiedAvailabilityCount = Object.keys(
  streamingAvailability.titles,
).length;
const sourceUrl = "https://www.criterion.com/closet-picks";

function channelUrl(title: string) {
  return `https://www.criterionchannel.com/search?q=${encodeURIComponent(title)}`;
}

function netflixUrl(title: string) {
  return `https://www.netflix.com/search?q=${encodeURIComponent(title)}`;
}

function primeVideoUrl(title: string) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(title)}&i=instant-video`;
}

function maxUrl(title: string) {
  return `https://www.justwatch.com/us/provider/hbo-max/movies?q=${encodeURIComponent(title)}`;
}

const providerDetails: Record<
  Provider,
  { label: string; url: (title: string) => string }
> = {
  criterion: { label: "Criterion", url: channelUrl },
  netflix: { label: "Netflix", url: netflixUrl },
  prime: { label: "Prime", url: primeVideoUrl },
  max: { label: "Max", url: maxUrl },
};

const videoDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function formatVideoDate(value: string) {
  return videoDateFormatter.format(new Date(`${value}T12:00:00Z`));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((part) => part !== "&")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function closetReleaseScore(film: Film) {
  return closetReleaseScores.get(film.collectionId) ?? 0;
}

function PersonAvatar({ image, name }: { image?: string; name: string }) {
  const source = image || peopleImages[name];
  return (
    <span
      className={`person-avatar${source ? "" : " person-avatar--initials"}`}
      aria-hidden="true"
    >
      <span>{initials(name)}</span>
      {source && (
        <img
          src={source}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.parentElement?.classList.add(
              "person-avatar--initials",
            );
          }}
        />
      )}
    </span>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState("All closet pickers");
  const [director, setDirector] = useState("All directors");
  const [decade, setDecade] = useState("All decades");
  const [sortField, setSortField] = useState<SortField>("closet");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const searchRef = useRef<HTMLInputElement>(null);

  const pickers = useMemo(
    () =>
      [...new Set(films.map((film) => film.picker))].sort((a, b) =>
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
      [
        ...new Set(
          films
            .filter(
              (film): film is Film & { year: number } => film.year !== null,
            )
            .map((film) => Math.floor(film.year / 10) * 10),
        ),
      ].sort(
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
        film.year?.toString() ?? "",
        film.picker,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (picker === "All closet pickers" || film.picker === picker) &&
        (director === "All directors" || film.director === director) &&
        (decade === "All decades" ||
          (film.year !== null &&
            Math.floor(film.year / 10) * 10 === Number(decade)))
      );
    });

    return results.sort((a, b) => {
      let comparison = 0;
      if (sortField === "closet") {
        comparison = closetReleaseScore(a) - closetReleaseScore(b);
      }
      if (sortField === "title") comparison = a.title.localeCompare(b.title);
      if (sortField === "year") {
        comparison = (a.year ?? -Infinity) - (b.year ?? -Infinity);
      }
      if (sortField === "director") {
        comparison = a.director.localeCompare(b.director);
      }
      if (sortField === "picker") {
        comparison = a.picker.localeCompare(b.picker);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [decade, director, picker, query, sortDirection, sortField]);

  const filtersActive =
    Boolean(query) ||
    picker !== "All closet pickers" ||
    director !== "All directors" ||
    decade !== "All decades";
  const visibleFilms = filteredFilms.slice(0, visibleCount);

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
    setVisibleCount(pageSize);
  }

  function toggleSort(field: SortField) {
    setVisibleCount(pageSize);
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection(field === "year" ? "desc" : "asc");
  }

  function changeSort(value: string) {
    const [field, direction] = value.split(":") as [
      SortField,
      SortDirection,
    ];
    setSortField(field);
    setSortDirection(direction);
    setVisibleCount(pageSize);
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
        <h1 className="visually-hidden" id="database-title">
          Criterion Closet picks
        </h1>

        <div
          className="filter-panel"
          aria-label="Search, sort, and filter the film table"
        >
          <label className="search-field">
            <span>Search</span>
            <div>
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(pageSize);
                }}
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
              onChange={(event) => {
                setPicker(event.target.value);
                setVisibleCount(pageSize);
              }}
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
              onChange={(event) => {
                setDirector(event.target.value);
                setVisibleCount(pageSize);
              }}
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
              onChange={(event) => {
                setDecade(event.target.value);
                setVisibleCount(pageSize);
              }}
            >
              <option>All decades</option>
              {decades.map((value) => (
                <option key={value} value={value}>
                  {value}s
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Order</span>
            <select
              value={`${sortField}:${sortDirection}`}
              onChange={(event) => changeSort(event.target.value)}
            >
              <option value="closet:desc">Newest Closet interviews</option>
              <option value="title:asc">Title A–Z</option>
              <option value="title:desc">Title Z–A</option>
              <option value="year:desc">Film year: newest</option>
              <option value="year:asc">Film year: oldest</option>
              <option value="director:asc">Director A–Z</option>
              <option value="director:desc">Director Z–A</option>
              <option value="picker:asc">Picker A–Z</option>
              <option value="picker:desc">Picker Z–A</option>
            </select>
          </label>
        </div>

        <div className="table-status" aria-live="polite">
          <p>
            Showing <strong>{visibleFilms.length}</strong> of{" "}
            {filteredFilms.length} matching / {films.length} total movie picks
          </p>
          <p className="availability-note">
            Streaming checked for {verifiedAvailabilityCount} titles / U.S. /{" "}
            {streamingAvailability.checkedOn}.
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
                    <button
                      type="button"
                      onClick={() => toggleSort("director")}
                    >
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
                {visibleFilms.map((film, index) => {
                  const availability = streamingAvailability.titles[film.slug];
                  const video = closetVideos[film.collectionId];
                  return (
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
                      <td className="year-cell">{film.year ?? "—"}</td>
                      <td className="director-cell">
                        <div className="person-entry">
                          <PersonAvatar name={film.director} />
                          <span>{film.director}</span>
                        </div>
                      </td>
                      <td className="picker-cell">
                        <div className="person-entry">
                          <PersonAvatar
                            image={video?.pickerImage}
                            name={film.picker}
                          />
                          <span className="picker-video-list">
                            <span className="picker-video-item">
                              <span className="picker-metadata">
                                <span>{film.picker}</span>
                                {video?.recordedOn && (
                                  <time dateTime={video.recordedOn}>
                                    {formatVideoDate(video.recordedOn)}
                                  </time>
                                )}
                              </span>
                              {video && (
                                <a
                                  className="video-icon-link"
                                  href={video.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Watch ${film.picker}'s Closet Picks interview`}
                                >
                                  <span aria-hidden="true">▶</span>
                                </a>
                              )}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="watch-links">
                          {availability?.providers.length ? (
                            availability.providers.map((provider) => (
                              <a
                                href={providerDetails[provider].url(film.title)}
                                key={provider}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Watch ${film.title} on ${providerDetails[provider].label}`}
                              >
                                {providerDetails[provider].label} ↗
                              </a>
                            ))
                          ) : (
                            <span className="no-streams">
                              Availability not checked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

            {visibleFilms.length < filteredFilms.length && (
              <div className="load-more">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((current) => current + pageSize)
                  }
                >
                  Load next{" "}
                  {Math.min(pageSize, filteredFilms.length - visibleFilms.length)}{" "}
                  picks
                </button>
                <span>
                  {visibleFilms.length} / {filteredFilms.length}
                </span>
              </div>
            )}
          </div>
          <div className="sprocket-rail" aria-hidden="true" />
        </div>

        <footer>
          <p>
            Film selections, cover art, picker photos, and interview dates
            sourced from Criterion. Director photos via Wikimedia Commons and
            TMDB where available.
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
