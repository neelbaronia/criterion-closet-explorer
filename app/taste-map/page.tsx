"use client";
/* eslint-disable @next/next/no-img-element -- Picker portraits are remote Criterion archive data. */
/* eslint-disable @next/next/no-html-link-for-pages -- View switches use full navigation so the large archive route cannot stall an RSC transition. */

import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import tasteMapData from "../../data/taste-map.json";
import styles from "./taste-map.module.css";

type Dimension = {
  id: string;
  label: string;
  family: string;
};

type Picker = {
  id: string;
  name: string;
  image: string;
  cluster: number;
  collections: string[];
  coverage: number;
  filmIds: string[];
  pickCount: number;
  profile: number[];
  topTraits: number[];
  x: number;
  y: number;
};

type Match = {
  contrasts: number[];
  coverage: number;
  directorScore: number;
  id: string;
  overlapScore: number;
  score: number;
  semanticScore: number;
  sharedDirectors: string[];
  sharedFilms: string[];
  sharedTraits: number[];
};

type Film = {
  director: string;
  title: string;
  wikipediaUrl: string;
  year: number | null;
};

type TasteData = {
  meta: {
    clusters: string[];
    dimensions: Dimension[];
    filmCoverage: number;
    generatedOn: string;
    method: string;
    pickerCount: number;
    sources: { label: string; url: string }[];
    uniqueFilms: number;
  };
  edges: { source: string; target: string; score: number }[];
  films: Record<string, Film>;
  matches: Record<string, Match[]>;
  pickers: Picker[];
};

const initialData = tasteMapData as unknown as TasteData;
const clusterColors = [
  "#ef3b2d",
  "#2454ff",
  "#18a776",
  "#9857c7",
  "#e5b300",
  "#e45f9c",
  "#3a9eae",
  "#785b3a",
];
const defaultPickerId =
  initialData.pickers.find((picker) => picker.name === "Christopher Nolan")
    ?.id ?? initialData.pickers[0].id;

function formattedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function TasteMapPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState(defaultPickerId);
  const [compareId, setCompareId] = useState(
    data.matches[defaultPickerId]?.[0]?.id ?? "",
  );
  const [hoveredId, setHoveredId] = useState("");
  const [cluster, setCluster] = useState("all");
  const [semanticWeight, setSemanticWeight] = useState(60);
  const [overlapWeight, setOverlapWeight] = useState(25);
  const [directorWeight, setDirectorWeight] = useState(15);

  const pickersById = useMemo(
    () => new Map(data.pickers.map((picker) => [picker.id, picker])),
    [data.pickers],
  );
  const selected = pickersById.get(selectedId) ?? data.pickers[0];
  const visiblePickers = useMemo(
    () =>
      cluster === "all"
        ? data.pickers
        : data.pickers.filter((picker) => picker.cluster === Number(cluster)),
    [cluster, data.pickers],
  );
  const visibleIds = useMemo(
    () => new Set(visiblePickers.map((picker) => picker.id)),
    [visiblePickers],
  );

  const adjustedMatches = useMemo(() => {
    const total = semanticWeight + overlapWeight + directorWeight || 1;
    return [...(data.matches[selected.id] ?? [])]
      .map((match) => ({
        ...match,
        adjustedScore: Math.round(
          (match.semanticScore * semanticWeight +
            match.overlapScore * overlapWeight +
            match.directorScore * directorWeight) /
            total,
        ),
      }))
      .sort((left, right) => right.adjustedScore - left.adjustedScore);
  }, [
    data.matches,
    directorWeight,
    overlapWeight,
    selected.id,
    semanticWeight,
  ]);

  const comparison =
    adjustedMatches.find((match) => match.id === compareId) ??
    adjustedMatches[0];
  const comparedPicker = comparison
    ? pickersById.get(comparison.id)
    : undefined;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/taste-data", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (
          payload?.meta?.dimensions?.length ===
            initialData.meta.dimensions.length &&
          payload?.pickers?.length >= initialData.pickers.length
        ) {
          setData(payload);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.warn("Using the bundled Taste Map snapshot.", error);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    function draw() {
      const bounds = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(bounds.width * scale));
      canvas.height = Math.max(1, Math.floor(bounds.height * scale));
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      context.fillStyle = "#f3f1e9";
      context.fillRect(0, 0, bounds.width, bounds.height);

      context.strokeStyle = "rgba(0,0,0,.055)";
      context.lineWidth = 1;
      for (let x = 0; x < bounds.width; x += 42) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, bounds.height);
        context.stroke();
      }
      for (let y = 0; y < bounds.height; y += 42) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(bounds.width, y);
        context.stroke();
      }

      const positions = new Map(
        visiblePickers.map((picker) => [
          picker.id,
          {
            x: picker.x * bounds.width,
            y: picker.y * bounds.height,
          },
        ]),
      );

      for (const edge of data.edges) {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        if (!source || !target) continue;
        const highlighted =
          edge.source === selected.id || edge.target === selected.id;
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.strokeStyle = highlighted
          ? "rgba(239,59,45,.42)"
          : "rgba(0,0,0,.075)";
        context.lineWidth = highlighted ? 1.4 : 0.65;
        context.stroke();
      }

      if (cluster === "all") {
        data.meta.clusters.forEach((name, clusterIndex) => {
          const members = visiblePickers.filter(
            (picker) => picker.cluster === clusterIndex,
          );
          if (!members.length) return;
          const x =
            members.reduce((sum, picker) => sum + picker.x, 0) /
            members.length;
          const y =
            members.reduce((sum, picker) => sum + picker.y, 0) /
            members.length;
          context.fillStyle = `${clusterColors[clusterIndex]}1b`;
          context.font = "700 12px Arial";
          context.textAlign = "center";
          context.fillText(
            name.toUpperCase(),
            x * bounds.width,
            y * bounds.height - 22,
          );
        });
      }

      const nodes = [...visiblePickers].sort((left, right) => {
        if (left.id === selected.id) return 1;
        if (right.id === selected.id) return -1;
        return left.pickCount - right.pickCount;
      });
      for (const picker of nodes) {
        const position = positions.get(picker.id);
        if (!position) continue;
        const selectedNode = picker.id === selected.id;
        const hoveredNode = picker.id === hoveredId;
        const radius =
          (selectedNode ? 9 : 3.3 + Math.sqrt(picker.pickCount) * 0.48) +
          (hoveredNode ? 2 : 0);
        context.beginPath();
        context.arc(position.x, position.y, radius, 0, Math.PI * 2);
        context.fillStyle = clusterColors[picker.cluster];
        context.fill();
        if (selectedNode || hoveredNode) {
          context.lineWidth = selectedNode ? 3 : 2;
          context.strokeStyle = "#090909";
          context.stroke();
        }

        if (selectedNode || hoveredNode || picker.pickCount >= 38) {
          context.fillStyle = "#171714";
          context.font = `${selectedNode ? "700" : "500"} ${
            selectedNode ? 11 : 9
          }px Arial`;
          context.textAlign = "left";
          context.fillText(
            picker.name,
            position.x + radius + 5,
            position.y + 3,
          );
        }
      }
    }

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [
    cluster,
    data.edges,
    data.meta.clusters,
    hoveredId,
    selected.id,
    visiblePickers,
  ]);

  function pickerAt(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const bounds = canvas.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    return visiblePickers
      .map((picker) => ({
        picker,
        distance: Math.hypot(
          pointerX - picker.x * bounds.width,
          pointerY - picker.y * bounds.height,
        ),
      }))
      .filter(({ distance }) => distance < 15)
      .sort((left, right) => left.distance - right.distance)[0]?.picker;
  }

  function selectPicker(id: string) {
    const picker = pickersById.get(id);
    if (!picker) return;
    if (!visibleIds.has(id)) setCluster("all");
    setSelectedId(id);
    setCompareId(data.matches[id]?.[0]?.id ?? "");
  }

  function handleCanvasMove(event: MouseEvent<HTMLCanvasElement>) {
    const picker = pickerAt(event);
    setHoveredId(picker?.id ?? "");
    event.currentTarget.style.cursor = picker ? "pointer" : "crosshair";
  }

  const hovered = hoveredId ? pickersById.get(hoveredId) : undefined;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/">[ C—INDEX ]</a>
        <span>Criterion Genome / quantified taste map</span>
        <nav>
          <a href="/semantic-islands">3D islands</a>
          <a href="/semantic-map-designs.html" target="_blank" rel="noreferrer">
            Design study
          </a>
          <a href="/">Film table ↗</a>
        </nav>
      </header>

      <section className={styles.intro}>
        <div>
          <span className={styles.kicker}>Live prototype / 36 dimensions</span>
          <h1>Closet Taste Map</h1>
        </div>
        <p>
          A transparent similarity model built from film attributes, rare shared
          picks, and director affinity. Select any point to inspect its cinematic
          fingerprint and closest neighbors.
        </p>
      </section>

      <section className={styles.metrics} aria-label="Taste map methodology">
        <span>
          <b>{data.meta.pickerCount}</b> picker profiles
        </span>
        <span>
          <b>{data.meta.dimensions.length}</b> quantified dimensions
        </span>
        <span>
          <b>{data.meta.filmCoverage}%</b> film metadata coverage
        </span>
        <span>
          <b>60 / 25 / 15</b> dimensions · overlap · directors
        </span>
      </section>

      <section className={styles.workspace}>
        <div className={styles.mapPanel}>
          <div className={styles.controls}>
            <label>
              <span>Find a picker</span>
              <select
                value={selected.id}
                onChange={(event) => selectPicker(event.target.value)}
              >
                {data.pickers.map((picker) => (
                  <option key={picker.id} value={picker.id}>
                    {picker.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Taste community</span>
              <select
                value={cluster}
                onChange={(event) => setCluster(event.target.value)}
              >
                <option value="all">All communities</option>
                {data.meta.clusters.map((name, index) => (
                  <option key={`${index}-${name}`} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <p>Near = similar dimensional profiles. Lines = strongest matches.</p>
          </div>

          <div className={styles.canvasWrap}>
            <canvas
              ref={canvasRef}
              onClick={(event) => {
                const picker = pickerAt(event);
                if (picker) selectPicker(picker.id);
              }}
              onMouseLeave={() => setHoveredId("")}
              onMouseMove={handleCanvasMove}
              aria-label="Interactive map of Criterion Closet picker similarity"
            />
            {hovered && hovered.id !== selected.id && (
              <div
                className={styles.tooltip}
                style={{
                  left: `${hovered.x * 100}%`,
                  top: `${hovered.y * 100}%`,
                }}
              >
                <b>{hovered.name}</b>
                <span>{hovered.pickCount} films</span>
              </div>
            )}
            <div className={styles.mapLegend}>
              {data.meta.clusters.map((name, index) => (
                <button
                  type="button"
                  key={`${index}-${name}`}
                  onClick={() => setCluster(String(index))}
                >
                  <i style={{ background: clusterColors[index] }} />
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className={styles.profilePanel}>
          <div className={styles.pickerHero}>
            {selected.image && <img src={selected.image} alt="" />}
            <div>
              <span>Selected picker</span>
              <h2>{selected.name}</h2>
              <p>
                {selected.pickCount} unique films · {selected.collections.length}{" "}
                Closet {selected.collections.length === 1 ? "visit" : "visits"}
              </p>
            </div>
          </div>

          <div className={styles.coverage}>
            <div>
              <span>Dimension coverage</span>
              <b>{selected.coverage}%</b>
            </div>
            <i>
              <span style={{ width: `${selected.coverage}%` }} />
            </i>
            <p>
              Remaining films use director and collection-level fallback
              profiles.
            </p>
          </div>

          <section className={styles.traits}>
            <div className={styles.sectionTitle}>
              <span>Distinctive dimensions</span>
              <small>Relative to the full Closet</small>
            </div>
            {selected.topTraits.map((dimensionIndex) => {
              const dimension = data.meta.dimensions[dimensionIndex];
              const value = selected.profile[dimensionIndex];
              return (
                <div className={styles.trait} key={dimension.id}>
                  <span>{dimension.label}</span>
                  <i>
                    <span style={{ width: `${value}%` }} />
                  </i>
                  <b>{value}</b>
                </div>
              );
            })}
          </section>
        </aside>
      </section>

      <section className={styles.matchesSection}>
        <div className={styles.matchControls}>
          <div>
            <span className={styles.kicker}>Similarity mixer</span>
            <h2>Closest to {selected.name}</h2>
            <p>
              Reweight the evidence to see how the neighborhood changes. Scores
              are recomputed across the twelve strongest default candidates.
            </p>
          </div>
          <div className={styles.sliders}>
            <label>
              <span>Dimensions <b>{semanticWeight}%</b></span>
              <input
                type="range"
                min="0"
                max="100"
                value={semanticWeight}
                onChange={(event) => setSemanticWeight(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Exact picks <b>{overlapWeight}%</b></span>
              <input
                type="range"
                min="0"
                max="100"
                value={overlapWeight}
                onChange={(event) => setOverlapWeight(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Directors <b>{directorWeight}%</b></span>
              <input
                type="range"
                min="0"
                max="100"
                value={directorWeight}
                onChange={(event) => setDirectorWeight(Number(event.target.value))}
              />
            </label>
          </div>
        </div>

        <div className={styles.matchWorkspace}>
          <ol className={styles.matchList}>
            {adjustedMatches.slice(0, 8).map((match, index) => {
              const picker = pickersById.get(match.id);
              if (!picker) return null;
              return (
                <li key={match.id}>
                  <button
                    className={
                      match.id === comparison?.id ? styles.activeMatch : ""
                    }
                    type="button"
                    onClick={() => setCompareId(match.id)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{picker.name}</strong>
                    <small>{match.coverage}% evidence coverage</small>
                    <b>{match.adjustedScore}%</b>
                  </button>
                </li>
              );
            })}
          </ol>

          {comparison && comparedPicker && (
            <article className={styles.evidence}>
              <div className={styles.evidenceHead}>
                <div>
                  <span>Why they match</span>
                  <h3>
                    {selected.name} × {comparedPicker.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => selectPicker(comparedPicker.id)}
                >
                  Recenter map ↗
                </button>
              </div>
              <div className={styles.scoreBreakdown}>
                <span>
                  <b>{comparison.semanticScore}</b> dimension similarity
                </span>
                <span>
                  <b>{comparison.overlapScore}</b> exact overlap
                </span>
                <span>
                  <b>{comparison.directorScore}</b> director affinity
                </span>
              </div>
              <div className={styles.evidenceGrid}>
                <div>
                  <h4>Shared dimensions</h4>
                  <p>
                    {comparison.sharedTraits
                      .map((index) => data.meta.dimensions[index].label)
                      .join(" · ") || "No strong shared dimensions"}
                  </p>
                </div>
                <div>
                  <h4>Strongest contrasts</h4>
                  <p>
                    {comparison.contrasts
                      .map((index) => data.meta.dimensions[index].label)
                      .join(" · ")}
                  </p>
                </div>
                <div>
                  <h4>Shared directors</h4>
                  <p>
                    {comparison.sharedDirectors.join(" · ") ||
                      "No exact director overlap"}
                  </p>
                </div>
                <div>
                  <h4>Rare shared films</h4>
                  <p>
                    {comparison.sharedFilms.length
                      ? comparison.sharedFilms
                          .map((filmId) => {
                            const film = data.films[filmId];
                            return film
                              ? `${film.title}${film.year ? ` (${film.year})` : ""}`
                              : "";
                          })
                          .filter(Boolean)
                          .join(" · ")
                      : "Their match comes from adjacent taste, not identical picks."}
                  </p>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>

      <section className={styles.methodology}>
        <div>
          <span className={styles.kicker}>Transparent by design</span>
          <h2>The Criterion Genome</h2>
        </div>
        <div>
          <p>
            Each film receives 0–100 scores across 36 interpretable dimensions.
            Picker profiles are rarity-weighted averages with box-set influence
            capped. Map coordinates use the first two principal components of
            those profiles; match scores add exact film and director overlap.
          </p>
          <p>
            Metadata is derived from Criterion’s archive and Wikipedia
            summaries/categories. Scores are automated signals for exploration,
            not authoritative criticism.
          </p>
          <div className={styles.sources}>
            {data.meta.sources.map((source) => (
              <a
                href={source.url}
                key={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.label} ↗
              </a>
            ))}
          </div>
        </div>
        <small>
          Generated {formattedDate(data.meta.generatedOn)} · {data.meta.method}
        </small>
      </section>
    </main>
  );
}
