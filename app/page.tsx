"use client";
/* eslint-disable @next/next/no-img-element -- Posters are remote archive data. */

import { useEffect, useMemo, useRef, useState } from "react";
import closetVideosData from "../data/closet-videos.json";
import filmsData from "../data/films.json";
import peopleData from "../data/people.json";
import SiteNavigation from "./site-navigation";

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
type SortField =
  | "closet"
  | "title"
  | "year"
  | "director"
  | "picker"
  | "moviePicks"
  | "directorPicks";
type SortDirection = "asc" | "desc";
type PickerVideoEntry = {
  collectionId: string;
  picker: string;
  video?: ClosetVideo;
};
type TableRow = {
  kind: "director" | "movie" | "pick";
  key: string;
  pickCount: number;
  pickerVideos: PickerVideoEntry[];
  primary: Film;
  records: Film[];
  uniqueFilms: Film[];
};
const pageSize = 100;

const initialFilms = filmsData as unknown as Film[];
const initialPeopleImages = peopleData as Record<string, string>;
const initialClosetVideos = closetVideosData as Record<string, ClosetVideo>;

const videoDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function formatVideoDate(value: string) {
  return videoDateFormatter.format(new Date(`${value}T12:00:00Z`));
}

function youtubeVideoUrl(video?: ClosetVideo) {
  return video &&
    /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(
      video.url,
    )
    ? video.url
    : undefined;
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

function closetReleaseScore(film: Film, scores: Map<string, number>) {
  return scores.get(film.collectionId) ?? 0;
}

function moviePickCount(film: Film, counts: Map<string, number>) {
  return counts.get(film.filmId) ?? 0;
}

function directorPickCount(film: Film, counts: Map<string, number>) {
  return counts.get(film.director) ?? 0;
}

function PersonAvatar({
  fallbackImage,
  image,
  name,
}: {
  fallbackImage?: string;
  image?: string;
  name: string;
}) {
  const source = image || fallbackImage;
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

function collectPickerVideos(
  records: Film[],
  closetVideos: Record<string, ClosetVideo>,
) {
  const entries = new Map<string, PickerVideoEntry>();
  for (const film of records) {
    if (!entries.has(film.collectionId)) {
      entries.set(film.collectionId, {
        collectionId: film.collectionId,
        picker: film.picker,
        video: closetVideos[film.collectionId],
      });
    }
  }
  return [...entries.values()].sort((left, right) => {
    const leftDate =
      left.video?.publishedOn || left.video?.recordedOn || "";
    const rightDate =
      right.video?.publishedOn || right.video?.recordedOn || "";
    return rightDate.localeCompare(leftDate) ||
      left.picker.localeCompare(right.picker);
  });
}

function PickerVideoLinks({ entries }: { entries: PickerVideoEntry[] }) {
  return (
    <span className="aggregate-picker-list">
      {entries.map((entry) => {
        const videoUrl = youtubeVideoUrl(entry.video);
        return videoUrl ? (
          <a
            className="aggregate-picker-link"
            href={videoUrl}
            key={entry.collectionId}
            target="_blank"
            rel="noreferrer"
            aria-label={`Watch ${entry.picker}'s Closet Picks interview`}
          >
            <span>{entry.picker}</span>
            <i aria-hidden="true">▶</i>
          </a>
        ) : (
          <span
            className="aggregate-picker-link aggregate-picker-link--missing"
            key={entry.collectionId}
          >
            {entry.picker}
          </span>
        );
      })}
    </span>
  );
}

export default function Home() {
  const [archive, setArchive] = useState({
    closetVideos: initialClosetVideos,
    films: initialFilms,
    peopleImages: initialPeopleImages,
  });
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState("All closet pickers");
  const [director, setDirector] = useState("All directors");
  const [decade, setDecade] = useState("All decades");
  const [sortField, setSortField] = useState<SortField>("closet");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const infiniteScrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { closetVideos, films, peopleImages } = archive;

  const closetReleaseScores = useMemo(
    () =>
      new Map(
        Object.entries(closetVideos)
          .sort(([, a], [, b]) =>
            (a.publishedOn || a.recordedOn).localeCompare(
              b.publishedOn || b.recordedOn,
            ),
          )
          .map(([collectionId], index) => [collectionId, index + 1]),
      ),
    [closetVideos],
  );

  const {
    directorPickCounts,
    directorRecords,
    moviePickCounts,
    movieRecords,
  } = useMemo(() => {
    const movieCollections = new Map<string, Set<string>>();
    const directorCollections = new Map<string, Set<string>>();
    const movieRecords = new Map<string, Film[]>();
    const directorRecords = new Map<string, Film[]>();
    for (const film of films) {
      const movieSet =
        movieCollections.get(film.filmId) ?? new Set<string>();
      movieSet.add(film.collectionId);
      movieCollections.set(film.filmId, movieSet);
      const movieGroup = movieRecords.get(film.filmId) ?? [];
      movieGroup.push(film);
      movieRecords.set(film.filmId, movieGroup);

      const directorSet =
        directorCollections.get(film.director) ?? new Set<string>();
      directorSet.add(film.collectionId);
      directorCollections.set(film.director, directorSet);
      const directorGroup = directorRecords.get(film.director) ?? [];
      directorGroup.push(film);
      directorRecords.set(film.director, directorGroup);
    }
    return {
      directorPickCounts: new Map(
        [...directorCollections].map(([name, collections]) => [
          name,
          collections.size,
        ]),
      ),
      moviePickCounts: new Map(
        [...movieCollections].map(([filmId, collections]) => [
          filmId,
          collections.size,
        ]),
      ),
      directorRecords,
      movieRecords,
    };
  }, [films]);

  const pickers = useMemo(
    () =>
      [...new Set(films.map((film) => film.picker))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [films],
  );

  const directors = useMemo(
    () =>
      [...new Set(films.map((film) => film.director))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [films],
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
    [films],
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
      if (sortField === "moviePicks") {
        comparison =
          moviePickCount(a, moviePickCounts) -
          moviePickCount(b, moviePickCounts);
        if (comparison !== 0) {
          return sortDirection === "asc" ? comparison : -comparison;
        }
        return (
          a.title.localeCompare(b.title) ||
          closetReleaseScore(b, closetReleaseScores) -
          closetReleaseScore(a, closetReleaseScores)
        );
      }
      if (sortField === "directorPicks") {
        comparison =
          directorPickCount(a, directorPickCounts) -
          directorPickCount(b, directorPickCounts);
        if (comparison !== 0) {
          return sortDirection === "asc" ? comparison : -comparison;
        }
        return (
          a.director.localeCompare(b.director) ||
          a.title.localeCompare(b.title) ||
          closetReleaseScore(b, closetReleaseScores) -
          closetReleaseScore(a, closetReleaseScores)
        );
      }
      if (sortField === "closet") {
        comparison =
          closetReleaseScore(a, closetReleaseScores) -
          closetReleaseScore(b, closetReleaseScores);
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
  }, [
    closetReleaseScores,
    decade,
    director,
    directorPickCounts,
    films,
    moviePickCounts,
    picker,
    query,
    sortDirection,
    sortField,
  ]);

  const tableRows = useMemo<TableRow[]>(() => {
    if (sortField === "moviePicks") {
      const filmIds = [...new Set(filteredFilms.map((film) => film.filmId))];
      return filmIds.map((filmId) => {
        const records = movieRecords.get(filmId) ?? [];
        const primary = records[0]!;
        return {
          kind: "movie",
          key: `movie-${filmId}`,
          pickCount: moviePickCounts.get(filmId) ?? records.length,
          pickerVideos: collectPickerVideos(records, closetVideos),
          primary,
          records,
          uniqueFilms: [primary],
        };
      });
    }

    if (sortField === "directorPicks") {
      const names = [...new Set(filteredFilms.map((film) => film.director))];
      return names.map((name) => {
        const records = directorRecords.get(name) ?? [];
        const uniqueFilms = [
          ...new Map(records.map((film) => [film.filmId, film])).values(),
        ].sort(
          (left, right) =>
            (moviePickCounts.get(right.filmId) ?? 0) -
              (moviePickCounts.get(left.filmId) ?? 0) ||
            left.title.localeCompare(right.title),
        );
        return {
          kind: "director",
          key: `director-${name}`,
          pickCount: directorPickCounts.get(name) ?? records.length,
          pickerVideos: collectPickerVideos(records, closetVideos),
          primary: (uniqueFilms[0] ?? records[0])!,
          records,
          uniqueFilms,
        };
      });
    }

    return filteredFilms.map((film) => ({
      kind: "pick",
      key: film.id,
      pickCount: 1,
      pickerVideos: collectPickerVideos([film], closetVideos),
      primary: film,
      records: [film],
      uniqueFilms: [film],
    }));
  }, [
    closetVideos,
    directorPickCounts,
    directorRecords,
    filteredFilms,
    moviePickCounts,
    movieRecords,
    sortField,
  ]);

  const filtersActive =
    Boolean(query) ||
    picker !== "All closet pickers" ||
    director !== "All directors" ||
    decade !== "All decades";
  const visibleRows = tableRows.slice(0, visibleCount);
  const totalRows =
    sortField === "moviePicks"
      ? movieRecords.size
      : sortField === "directorPicks"
        ? directorRecords.size
        : films.length;
  const rowLabel =
    sortField === "moviePicks"
      ? "movies"
      : sortField === "directorPicks"
        ? "directors"
        : "movie picks";

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

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/archive", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (
          Array.isArray(payload.films) &&
          payload.films.length >= initialFilms.length &&
          payload.videos &&
          payload.people
        ) {
          setArchive({
            closetVideos: payload.videos,
            films: payload.films,
            peopleImages: payload.people,
          });
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.warn("Using the bundled Closet archive snapshot.", error);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const sentinel = infiniteScrollRef.current;
    if (!sentinel || visibleCount >= tableRows.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisibleCount((current) =>
          Math.min(current + pageSize, tableRows.length),
        );
      },
      { rootMargin: "800px 0px", threshold: 0.01 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [tableRows.length, visibleCount]);

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
      <SiteNavigation active="db" />

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
              <option value="moviePicks:desc">
                Movie Hall of Fame: most picks
              </option>
              <option value="directorPicks:desc">
                Director Hall of Fame: most picks
              </option>
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
            Showing <strong>{visibleRows.length}</strong> of {tableRows.length}{" "}
            matching / {totalRows} total {rowLabel}
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
                    {sortField === "directorPicks" ? "Posters" : "Poster"}
                  </th>
                  <th scope="col" aria-sort={ariaSort("title")}>
                    <button type="button" onClick={() => toggleSort("title")}>
                      {sortField === "directorPicks" ? "Picked films" : "Title"}{" "}
                      <span>{sortMark("title")}</span>
                    </button>
                  </th>
                  <th scope="col" aria-sort={ariaSort("year")}>
                    <button type="button" onClick={() => toggleSort("year")}>
                      {sortField === "directorPicks" ? "Years" : "Year"}{" "}
                      <span>{sortMark("year")}</span>
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
                      {sortField === "moviePicks" ||
                      sortField === "directorPicks"
                        ? "Closet pickers"
                        : "Closet picker"}{" "}
                      <span>{sortMark("picker")}</span>
                    </button>
                  </th>
                  <th className="buy-column" scope="col">
                    Buy from Criterion
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const film = row.primary;
                  const video = closetVideos[film.collectionId];
                  const videoUrl = youtubeVideoUrl(video);

                  if (row.kind === "director") {
                    const years = row.uniqueFilms
                      .map((entry) => entry.year)
                      .filter((year): year is number => year !== null);
                    const firstYear = years.length ? Math.min(...years) : null;
                    const lastYear = years.length ? Math.max(...years) : null;
                    return (
                      <tr className="hall-of-fame-row" key={row.key}>
                        <td className="poster-cell">
                          <div className="poster-frame poster-collage">
                            {row.uniqueFilms.slice(0, 4).map((entry) => (
                              <img
                                src={entry.poster}
                                alt={`${entry.title} poster`}
                                key={entry.filmId}
                                loading={index < 4 ? "eager" : "lazy"}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="title-cell">
                          <span className="ranked-metadata">
                            <strong>
                              {row.uniqueFilms.length} picked films
                            </strong>
                            <span className="director-film-list">
                              {row.uniqueFilms.slice(0, 7).map((entry) => (
                                <span key={entry.filmId}>{entry.title}</span>
                              ))}
                              {row.uniqueFilms.length > 7 && (
                                <span>
                                  +{row.uniqueFilms.length - 7} more
                                </span>
                              )}
                            </span>
                          </span>
                        </td>
                        <td className="year-cell">
                          {firstYear === null
                            ? "—"
                            : firstYear === lastYear
                              ? firstYear
                              : `${firstYear}–${lastYear}`}
                        </td>
                        <td className="director-cell">
                          <div className="person-entry">
                            <PersonAvatar
                              fallbackImage={peopleImages[film.director]}
                              name={film.director}
                            />
                            <span className="ranked-metadata">
                              <span>{film.director}</span>
                              <span className="hall-of-fame-count">
                                {row.pickCount} Closet picks
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="picker-cell picker-cell--aggregate">
                          <PickerVideoLinks entries={row.pickerVideos} />
                        </td>
                        <td>
                          <div className="criterion-buy-list">
                            {row.uniqueFilms.map((entry) => (
                              <a
                                className="criterion-buy-link"
                                href={entry.criterionUrl}
                                key={entry.filmId}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Buy ${entry.title} from Criterion`}
                              >
                                {entry.title} ↗
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      className={
                        row.kind === "movie" ? "hall-of-fame-row" : undefined
                      }
                      key={row.key}
                    >
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
                        <span className="ranked-metadata">
                          <strong>{film.title}</strong>
                          {row.kind === "movie" && (
                            <span className="hall-of-fame-count">
                              {row.pickCount} Closet picks
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="year-cell">{film.year ?? "—"}</td>
                      <td className="director-cell">
                        <div className="person-entry">
                          <PersonAvatar
                            fallbackImage={peopleImages[film.director]}
                            name={film.director}
                          />
                          <span className="ranked-metadata">
                            <span>{film.director}</span>
                          </span>
                        </div>
                      </td>
                      <td
                        className={`picker-cell${
                          row.kind === "movie"
                            ? " picker-cell--aggregate"
                            : ""
                        }`}
                      >
                        {row.kind === "movie" ? (
                          <PickerVideoLinks entries={row.pickerVideos} />
                        ) : (
                          <div className="person-entry">
                            <PersonAvatar
                              fallbackImage={peopleImages[film.picker]}
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
                                {videoUrl && (
                                  <a
                                    className="video-icon-link"
                                    href={videoUrl}
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
                        )}
                      </td>
                      <td>
                        <a
                          className="criterion-buy-link"
                          href={film.criterionUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Buy ${film.title} from Criterion`}
                        >
                          Buy from Criterion ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!tableRows.length && (
              <div className="empty-state">
                <strong>No films found.</strong>
                <p>Try another title, director, picker, or decade.</p>
                <button type="button" onClick={clearFilters}>
                  Reset filters
                </button>
              </div>
            )}

            {visibleRows.length < tableRows.length && (
              <div
                className="infinite-scroll-sentinel"
                ref={infiniteScrollRef}
                role="status"
                aria-live="polite"
              >
                <span>Scroll to load more {rowLabel}</span>
                <b>
                  {visibleRows.length} / {tableRows.length}
                </b>
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
