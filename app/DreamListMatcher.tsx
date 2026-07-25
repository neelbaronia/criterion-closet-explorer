"use client";
/* eslint-disable @next/next/no-img-element -- Posters are remote archive data. */

import { FormEvent, useEffect, useMemo, useState } from "react";
import filmsData from "../data/films.json";

type CatalogFilm = (typeof filmsData)[number];

type DreamFilm = {
  id: string;
  title: string;
  year?: number;
  director?: string;
  poster?: string;
  custom?: boolean;
};

type Match = {
  name: string;
  score: number;
  signature: string;
  signals: string[];
  pickCount: number;
};

type MatchResponse = {
  method: "openai-embeddings" | "metadata-fallback";
  matches: Match[];
  note: string;
  error?: string;
};

const catalog = filmsData as CatalogFilm[];
const sampleIds = ["stalker", "paris-burning", "local-hero", "late-spring"];

function toDreamFilm(film: CatalogFilm): DreamFilm {
  return {
    id: film.id,
    title: film.title,
    year: film.year,
    director: film.director,
    poster: film.poster,
  };
}

export function DreamListMatcher() {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [dream, setDream] = useState<DreamFilm[]>([]);
  const [dreamReady, setDreamReady] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const suggestions = useMemo(() => {
    const query = input.trim().toLowerCase();
    if (!query) return [];
    const chosenIds = new Set(dream.map((film) => film.id));
    return catalog
      .filter(
        (film) =>
          !chosenIds.has(film.id) &&
          `${film.title} ${film.director} ${film.year}`
            .toLowerCase()
            .includes(query),
      )
      .slice(0, 5);
  }, [dream, input]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem("closet-index-dream-list");
        if (stored) setDream(JSON.parse(stored) as DreamFilm[]);
      } finally {
        setDreamReady(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!dreamReady) return;
    window.localStorage.setItem("closet-index-dream-list", JSON.stringify(dream));
  }, [dream, dreamReady]);

  function addCatalogFilm(film: CatalogFilm) {
    setDream((current) => [...current, toDreamFilm(film)].slice(0, 20));
    setInput("");
    setResult(null);
    setError("");
  }

  function addCustomFilm(title: string) {
    const normalized = title.trim();
    if (!normalized) return;
    setDream((current) =>
      [
        ...current,
        {
          id: `custom-${crypto.randomUUID()}`,
          title: normalized,
          custom: true,
        },
      ].slice(0, 20),
    );
    setInput("");
    setResult(null);
    setError("");
  }

  function addFromInput(event: FormEvent) {
    event.preventDefault();
    if (suggestions[0]) {
      addCatalogFilm(suggestions[0]);
      return;
    }
    addCustomFilm(input);
  }

  function removeFilm(id: string) {
    setDream((current) => current.filter((film) => film.id !== id));
    setResult(null);
  }

  function loadSample() {
    setDream(
      sampleIds
        .map((id) => catalog.find((film) => film.id === id))
        .filter((film): film is CatalogFilm => Boolean(film))
        .map(toDreamFilm),
    );
    setResult(null);
    setError("");
  }

  async function findMatch() {
    if (dream.length < 3) {
      setError("Add at least three films so the match has something real to read.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          films: dream.map(({ id, title, year, director, custom }) => ({
            id: custom ? undefined : id,
            title,
            year,
            director,
          })),
        }),
      });
      const payload = (await response.json()) as MatchResponse;
      if (!response.ok) throw new Error(payload.error || "The match could not be calculated.");
      setResult(payload);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The match could not be calculated.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="dream-section" id="dream-list">
      <div className="dream-intro">
        <p className="eyebrow">Reel 02 / Your turn in the closet</p>
        <h2>
          Cut your own
          <br />
          <em>dream reel.</em>
        </h2>
        <p>
          Pick at least three films—inside or outside the current index. We&apos;ll
          compare the shape of your taste with every indexed Closet visitor.
        </p>
        <div className="dream-method">
          <span>How the match works</span>
          <p>
            The server compares your collection with each visitor&apos;s complete
            indexed profile. With an API key, it uses OpenAI text embeddings;
            without one, it falls back to transparent film, director, era, and
            theme overlap.
          </p>
        </div>
      </div>

      <div className="dream-builder">
        <div className="builder-heading">
          <div>
            <span>Dream reel</span>
            <strong>{String(dream.length).padStart(2, "0")} / 20</strong>
          </div>
          {dream.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setDream([]);
                setResult(null);
              }}
            >
              Empty the tote
            </button>
          ) : (
            <button type="button" onClick={loadSample}>
              Try an example
            </button>
          )}
        </div>

        <form className="dream-search" onSubmit={addFromInput}>
          <label htmlFor="dream-title">Add a film</label>
          <div>
            <span aria-hidden="true">＋</span>
            <input
              id="dream-title"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
              placeholder="Search the index or type any title"
              autoComplete="off"
              maxLength={160}
            />
            <button type="submit" disabled={!input.trim()}>
              Add
            </button>
          </div>
          {isFocused && input.trim() && (
            <div className="dream-suggestions" role="listbox">
              {suggestions.map((film) => (
                <button
                  key={film.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addCatalogFilm(film)}
                  role="option"
                  aria-selected="false"
                >
                  <img src={film.poster} alt="" />
                  <span>
                    <strong>{film.title}</strong>
                    <small>
                      {film.year} · {film.director}
                    </small>
                  </span>
                  <b>＋</b>
                </button>
              ))}
              <button
                className="custom-suggestion"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addCustomFilm(input)}
                role="option"
                aria-selected="false"
              >
                <span>
                  <strong>Add “{input.trim()}”</strong>
                  <small>Custom title outside this prototype index</small>
                </span>
                <b>＋</b>
              </button>
            </div>
          )}
        </form>

        <div className={`dream-stack ${dream.length ? "" : "is-empty"}`}>
          {dream.length ? (
            dream.map((film, index) => (
              <article className="dream-item" key={film.id}>
                <span className="dream-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {film.poster ? (
                  <img src={film.poster} alt="" />
                ) : (
                  <div className="custom-cover" aria-hidden="true">
                    C
                  </div>
                )}
                <div>
                  <h3>{film.title}</h3>
                  <p>
                    {film.director
                      ? `${film.year} · ${film.director}`
                      : "Custom dream selection"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFilm(film.id)}
                  aria-label={`Remove ${film.title}`}
                >
                  ×
                </button>
              </article>
            ))
          ) : (
            <div>
              <span>∅</span>
              <p>Your reel is empty. Start with the film you&apos;d thread first.</p>
            </div>
          )}
        </div>

        <div className="match-action">
          <div>
            <span>{Math.max(0, 3 - dream.length)} more to unlock</span>
            <p>Your list stays saved on this device.</p>
          </div>
          <button
            type="button"
            onClick={findMatch}
            disabled={dream.length < 3 || loading}
          >
            {loading ? "Reading your taste…" : "Find my Closet match ↗"}
          </button>
        </div>
        {error && <p className="match-error">{error}</p>}
      </div>

      {result && (
        <div className="match-results" aria-live="polite">
          <div className="results-heading">
            <div>
              <p className="eyebrow">Your closest shelves</p>
              <h3>
                You shop like
                <br />
                <em>{result.matches[0]?.name}.</em>
              </h3>
            </div>
            <span className="method-badge">
              {result.method === "openai-embeddings"
                ? "Semantic embedding match"
                : "Metadata preview match"}
            </span>
          </div>
          <div className="match-list">
            {result.matches.map((match, index) => (
              <article className="match-card" key={match.name}>
                <div className="match-rank">0{index + 1}</div>
                <div className="match-person">
                  <h4>{match.name}</h4>
                  <p>{match.signature}</p>
                </div>
                <div className="match-score">
                  <strong>{match.score}</strong>
                  <span>taste affinity</span>
                </div>
                <div className="score-line">
                  <span style={{ width: `${match.score}%` }} />
                </div>
                <ul>
                  {match.signals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="method-note">{result.note}</p>
        </div>
      )}
    </section>
  );
}
