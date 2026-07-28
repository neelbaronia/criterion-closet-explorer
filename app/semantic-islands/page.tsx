"use client";

import Link from "next/link";
import {
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import tasteMapData from "../../data/taste-map.json";
import styles from "./semantic-islands.module.css";

type Dimension = {
  family: string;
  id: string;
  label: string;
};

type Film = {
  director: string;
  island: number;
  title: string;
  wikipediaUrl: string;
  x: number;
  y: number;
  year: number | null;
  z: number;
};

type Picker = {
  filmIds: string[];
  id: string;
  name: string;
  pickCount: number;
};

type FilmIsland = {
  center: number[];
  count: number;
  name: string;
  traits: number[];
};

type TasteData = {
  films: Record<string, Film>;
  meta: {
    dimensions: Dimension[];
    filmCoverage: number;
    filmIslands: FilmIsland[];
    generatedOn: string;
    uniqueFilms: number;
  };
  pickers: Picker[];
};

type Camera = {
  pitch: number;
  x: number;
  y: number;
  yaw: number;
  z: number;
};

type ProjectedFilm = {
  depth: number;
  id: string;
  radius: number;
  screenX: number;
  screenY: number;
};

type ViewMode = "islands" | "spotlight";

const data = tasteMapData as unknown as TasteData;
const islandColors = [
  "#ff4b37",
  "#6e82ff",
  "#1bd6a2",
  "#c979ff",
  "#ffd924",
  "#ff79b9",
  "#42d8ec",
  "#ff9d52",
];
const defaultPicker =
  data.pickers.find((picker) => picker.name === "Christopher Nolan") ??
  data.pickers[0];
const initialCamera: Camera = {
  pitch: -0.04,
  x: 0,
  y: 0,
  yaw: 0,
  z: -1_480,
};

function filmWorld(film: Film) {
  return {
    x: (film.x - 0.5) * 1_180,
    y: (0.5 - film.y) * 820,
    z: (film.z - 0.5) * 1_180,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatYear(year: number | null) {
  return year ? ` (${year})` : "";
}

export default function SemanticIslandsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ ...initialCamera });
  const projectedRef = useRef<ProjectedFilm[]>([]);
  const pointerRef = useRef({
    dragging: false,
    moved: false,
    pointerId: -1,
    x: 0,
    y: 0,
  });
  const [renderTick, setRenderTick] = useState(0);
  const [cameraDisplay, setCameraDisplay] = useState(initialCamera);
  const [selectedPickerId, setSelectedPickerId] = useState(defaultPicker.id);
  const [selectedFilmId, setSelectedFilmId] = useState(
    defaultPicker.filmIds[0] ?? Object.keys(data.films)[0],
  );
  const [hoveredFilmId, setHoveredFilmId] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("spotlight");
  const [hasFocus, setHasFocus] = useState(false);

  const pickerById = useMemo(
    () => new Map(data.pickers.map((picker) => [picker.id, picker])),
    [],
  );
  const selectedPicker =
    pickerById.get(selectedPickerId) ?? data.pickers[0];
  const selectedPickerFilms = useMemo(
    () => new Set(selectedPicker.filmIds),
    [selectedPicker],
  );
  const filmEntries = useMemo(() => Object.entries(data.films), []);
  const pickerMembership = useMemo(() => {
    const membership = new Map<string, string[]>();
    for (const picker of data.pickers) {
      for (const filmId of picker.filmIds) {
        const names = membership.get(filmId) ?? [];
        names.push(picker.name);
        membership.set(filmId, names);
      }
    }
    return membership;
  }, []);
  const selectedFilm = data.films[selectedFilmId];
  const hoveredFilm = hoveredFilmId ? data.films[hoveredFilmId] : undefined;

  const nearestFilms = useMemo(() => {
    if (!selectedFilm) return [];
    return filmEntries
      .filter(([filmId]) => filmId !== selectedFilmId)
      .map(([filmId, film]) => ({
        film,
        filmId,
        distance: Math.hypot(
          film.x - selectedFilm.x,
          film.y - selectedFilm.y,
          film.z - selectedFilm.z,
        ),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 5);
  }, [filmEntries, selectedFilm, selectedFilmId]);

  const pickerIslandCounts = useMemo(() => {
    const counts = new Array(data.meta.filmIslands.length).fill(0);
    for (const filmId of selectedPicker.filmIds) {
      const film = data.films[filmId];
      if (film) counts[film.island] += 1;
    }
    return counts;
  }, [selectedPicker]);

  const updateView = () => {
    setCameraDisplay({ ...cameraRef.current });
    setRenderTick((value) => value + 1);
  };

  function resetCamera() {
    cameraRef.current = { ...initialCamera };
    updateView();
  }

  function focusPicker() {
    const films = selectedPicker.filmIds
      .map((filmId) => data.films[filmId])
      .filter(Boolean);
    if (!films.length) return;
    const center = films.reduce(
      (total, film) => {
        const point = filmWorld(film);
        total.x += point.x;
        total.y += point.y;
        total.z += point.z;
        return total;
      },
      { x: 0, y: 0, z: 0 },
    );
    cameraRef.current = {
      pitch: 0,
      x: center.x / films.length,
      y: center.y / films.length,
      yaw: 0,
      z: center.z / films.length - 1_000,
    };
    updateView();
  }

  function moveCamera(key: string) {
    const camera = cameraRef.current;
    const step = 85;
    if (key === "ArrowLeft") camera.yaw -= 0.1;
    if (key === "ArrowRight") camera.yaw += 0.1;
    if (key === "ArrowUp") {
      camera.x += Math.sin(camera.yaw) * step;
      camera.z += Math.cos(camera.yaw) * step;
    }
    if (key === "ArrowDown") {
      camera.x -= Math.sin(camera.yaw) * step;
      camera.z -= Math.cos(camera.yaw) * step;
    }
    if (key.toLowerCase() === "a") {
      camera.x -= Math.cos(camera.yaw) * step;
      camera.z += Math.sin(camera.yaw) * step;
    }
    if (key.toLowerCase() === "d") {
      camera.x += Math.cos(camera.yaw) * step;
      camera.z -= Math.sin(camera.yaw) * step;
    }
    if (key.toLowerCase() === "w") camera.y += 65;
    if (key.toLowerCase() === "s") camera.y -= 65;
    if (key.toLowerCase() === "f") focusPicker();
    if (key === " ") resetCamera();
    camera.pitch = clamp(camera.pitch, -1.12, 1.12);
    updateView();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const controlledKeys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "a",
      "A",
      "d",
      "D",
      "w",
      "W",
      "s",
      "S",
      "f",
      "F",
      " ",
    ];
    if (!controlledKeys.includes(event.key)) return;
    event.preventDefault();
    moveCamera(event.key);
  }

  function hitTest(event: MouseEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    return [...projectedRef.current]
      .reverse()
      .map((point) => ({
        ...point,
        distance: Math.hypot(point.screenX - x, point.screenY - y),
      }))
      .find((point) => point.distance <= Math.max(8, point.radius + 4));
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      dragging: true,
      moved: false,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const pointer = pointerRef.current;
    if (pointer.dragging && pointer.pointerId === event.pointerId) {
      const deltaX = event.clientX - pointer.x;
      const deltaY = event.clientY - pointer.y;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 2) pointer.moved = true;
      cameraRef.current.yaw += deltaX * 0.005;
      cameraRef.current.pitch = clamp(
        cameraRef.current.pitch + deltaY * 0.004,
        -1.12,
        1.12,
      );
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      updateView();
      return;
    }
    const film = hitTest(event);
    setHoveredFilmId(film?.id ?? "");
    event.currentTarget.style.cursor = film ? "pointer" : "grab";
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const pointer = pointerRef.current;
    if (!pointer.dragging || pointer.pointerId !== event.pointerId) return;
    if (!pointer.moved) {
      const film = hitTest(event);
      if (film) setSelectedFilmId(film.id);
    }
    pointer.dragging = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const camera = cameraRef.current;
    const amount = clamp(event.deltaY, -140, 140);
    camera.x -= Math.sin(camera.yaw) * amount;
    camera.z -= Math.cos(camera.yaw) * amount;
    updateView();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    function draw() {
      if (!canvas || !context) return;
      const bounds = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(bounds.width * scale));
      canvas.height = Math.max(1, Math.floor(bounds.height * scale));
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);

      const gradient = context.createLinearGradient(0, 0, 0, bounds.height);
      gradient.addColorStop(0, "#08080b");
      gradient.addColorStop(0.62, "#111116");
      gradient.addColorStop(1, "#070709");
      context.fillStyle = gradient;
      context.fillRect(0, 0, bounds.width, bounds.height);

      const camera = cameraRef.current;
      const cosYaw = Math.cos(camera.yaw);
      const sinYaw = Math.sin(camera.yaw);
      const cosPitch = Math.cos(camera.pitch);
      const sinPitch = Math.sin(camera.pitch);
      const focal = Math.min(bounds.width, bounds.height) * 0.92;

      function project(point: { x: number; y: number; z: number }) {
        const dx = point.x - camera.x;
        const dy = point.y - camera.y;
        const dz = point.z - camera.z;
        const rotatedX = cosYaw * dx - sinYaw * dz;
        const yawDepth = sinYaw * dx + cosYaw * dz;
        const rotatedY = cosPitch * dy - sinPitch * yawDepth;
        const depth = sinPitch * dy + cosPitch * yawDepth;
        if (depth < 45) return undefined;
        return {
          depth,
          x: bounds.width / 2 + (rotatedX * focal) / depth,
          y: bounds.height / 2 - (rotatedY * focal) / depth,
        };
      }

      context.strokeStyle = "rgba(255,255,255,.055)";
      context.lineWidth = 1;
      for (let ring = 180; ring <= 900; ring += 180) {
        context.beginPath();
        for (let step = 0; step <= 64; step += 1) {
          const angle = (step / 64) * Math.PI * 2;
          const projected = project({
            x: Math.cos(angle) * ring,
            y: 410,
            z: Math.sin(angle) * ring,
          });
          if (!projected) continue;
          if (step === 0) context.moveTo(projected.x, projected.y);
          else context.lineTo(projected.x, projected.y);
        }
        context.stroke();
      }

      const projected = filmEntries
        .map(([id, film]) => {
          const screen = project(filmWorld(film));
          if (!screen) return undefined;
          const chosen = selectedPickerFilms.has(id);
          const islandVisible =
            selectedIsland === "all" || film.island === Number(selectedIsland);
          const scaleByDepth = clamp(focal / screen.depth, 0.3, 2.2);
          return {
            chosen,
            depth: screen.depth,
            film,
            id,
            islandVisible,
            radius: (chosen ? 4.1 : 2.4) * scaleByDepth,
            screenX: screen.x,
            screenY: screen.y,
          };
        })
        .filter(
          (
            point,
          ): point is {
            chosen: boolean;
            depth: number;
            film: Film;
            id: string;
            islandVisible: boolean;
            radius: number;
            screenX: number;
            screenY: number;
          } => Boolean(point),
        )
        .filter(
          (point) =>
            point.screenX > -30 &&
            point.screenX < bounds.width + 30 &&
            point.screenY > -30 &&
            point.screenY < bounds.height + 30,
        )
        .sort((left, right) => right.depth - left.depth);

      projectedRef.current = projected.map(
        ({ depth, id, radius, screenX, screenY }) => ({
          depth,
          id,
          radius,
          screenX,
          screenY,
        }),
      );

      for (const point of projected) {
        const isSelected = point.id === selectedFilmId;
        const isHovered = point.id === hoveredFilmId;
        const fadedByPicker = viewMode === "spotlight" && !point.chosen;
        const fadedByIsland = !point.islandVisible;
        const opacity = fadedByIsland ? 0.035 : fadedByPicker ? 0.12 : 0.92;
        const color =
          viewMode === "spotlight" && point.chosen
            ? "#ff4b37"
            : islandColors[point.film.island];

        context.beginPath();
        context.arc(
          point.screenX,
          point.screenY,
          point.radius + (isSelected || isHovered ? 2 : 0),
          0,
          Math.PI * 2,
        );
        context.fillStyle = `${color}${Math.round(opacity * 255)
          .toString(16)
          .padStart(2, "0")}`;
        context.shadowBlur =
          !fadedByIsland && (point.chosen || isSelected) ? 14 : 0;
        context.shadowColor = color;
        context.fill();
        context.shadowBlur = 0;

        if (isSelected || (viewMode === "islands" && point.chosen)) {
          context.beginPath();
          context.arc(
            point.screenX,
            point.screenY,
            point.radius + (isSelected ? 5 : 2.5),
            0,
            Math.PI * 2,
          );
          context.strokeStyle = isSelected
            ? "#ffffff"
            : "rgba(255,255,255,.7)";
          context.lineWidth = isSelected ? 1.6 : 0.75;
          context.stroke();
        }
      }

      if (viewMode === "islands") {
        data.meta.filmIslands.forEach((island, index) => {
          if (selectedIsland !== "all" && Number(selectedIsland) !== index) {
            return;
          }
          const center = project(
            filmWorld({
              director: "",
              island: index,
              title: "",
              wikipediaUrl: "",
              x: island.center[0],
              y: island.center[1],
              year: null,
              z: island.center[2],
            }),
          );
          if (!center) return;
          context.fillStyle = islandColors[index];
          context.font = "600 9px monospace";
          context.textAlign = "center";
          context.fillText(island.name.toUpperCase(), center.x, center.y - 18);
        });
      }
    }

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [
    filmEntries,
    hoveredFilmId,
    renderTick,
    selectedFilmId,
    selectedIsland,
    selectedPickerFilms,
    viewMode,
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">[ C—INDEX ]</Link>
        <span>Film latent space / three axes</span>
        <nav aria-label="Explorer views">
          <Link href="/">Film table</Link>
          <Link href="/taste-map">2D taste map</Link>
          <a href="/semantic-map-designs.html" target="_blank" rel="noreferrer">
            Design lab
          </a>
        </nav>
      </header>

      <section className={styles.titleBar}>
        <div>
          <span>Live map / Criterion Genome PCA</span>
          <h1>3D Semantic Islands</h1>
        </div>
        <p>
          Fly through {data.meta.uniqueFilms.toLocaleString()} films. Nearby
          dots share more of their mood, form, theme, mode, and era profile.
        </p>
      </section>

      <section className={styles.controlBar} aria-label="Map controls">
        <label>
          <span>Spotlight a picker</span>
          <select
            value={selectedPicker.id}
            onChange={(event) => {
              setSelectedPickerId(event.target.value);
              const picker = pickerById.get(event.target.value);
              if (picker?.filmIds[0]) setSelectedFilmId(picker.filmIds[0]);
              setViewMode("spotlight");
            }}
          >
            {data.pickers.map((picker) => (
              <option key={picker.id} value={picker.id}>
                {picker.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.modeControl}>
          <span>Color mode</span>
          <div>
            <button
              className={viewMode === "spotlight" ? styles.activeButton : ""}
              type="button"
              onClick={() => setViewMode("spotlight")}
            >
              Picker spotlight
            </button>
            <button
              className={viewMode === "islands" ? styles.activeButton : ""}
              type="button"
              onClick={() => setViewMode("islands")}
            >
              Semantic islands
            </button>
          </div>
        </div>
        <div className={styles.cameraActions}>
          <button type="button" onClick={focusPicker}>
            Focus picks <kbd>F</kbd>
          </button>
          <button type="button" onClick={resetCamera}>
            Reset <kbd>Space</kbd>
          </button>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.viewport}>
          <canvas
            ref={canvasRef}
            aria-label="Navigable three-dimensional semantic map of Criterion Closet films. Use arrow keys to turn and move."
            onBlur={() => setHasFocus(false)}
            onFocus={() => setHasFocus(true)}
            onKeyDown={handleKeyDown}
            onMouseLeave={() => setHoveredFilmId("")}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            tabIndex={0}
          />
          <div className={styles.crosshair} aria-hidden="true" />
          <div className={styles.coordinates}>
            X {Math.round(cameraDisplay.x)} · Y {Math.round(cameraDisplay.y)} ·
            Z {Math.round(cameraDisplay.z)}
          </div>
          <div
            className={`${styles.focusPrompt} ${
              hasFocus ? styles.focused : ""
            }`}
          >
            {hasFocus ? "Keyboard navigation active" : "Click map to fly"}
          </div>
          {hoveredFilm && (
            <div className={styles.hoverCard}>
              <b>{hoveredFilm.title}</b>
              <span>
                {hoveredFilm.year ?? "Year unknown"} · {hoveredFilm.director}
              </span>
            </div>
          )}
          <div className={styles.keyGuide}>
            <span>
              <kbd>←</kbd>
              <kbd>→</kbd> turn
            </span>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> travel
            </span>
            <span>
              <kbd>A</kbd>
              <kbd>D</kbd> strafe
            </span>
            <span>
              <kbd>W</kbd>
              <kbd>S</kbd> rise
            </span>
            <span>drag orbit · scroll dolly</span>
          </div>
        </div>

        <aside className={styles.inspector}>
          <section className={styles.pickerSummary}>
            <span>Picker spotlight</span>
            <h2>{selectedPicker.name}</h2>
            <p>{selectedPicker.pickCount} unique films across the map</p>
            <div className={styles.pickerBars}>
              {pickerIslandCounts
                .map((count, island) => ({ count, island }))
                .filter(({ count }) => count > 0)
                .sort((left, right) => right.count - left.count)
                .slice(0, 5)
                .map(({ count, island }) => (
                  <button
                    key={island}
                    type="button"
                    onClick={() => {
                      setSelectedIsland(String(island));
                      setViewMode("islands");
                    }}
                  >
                    <i
                      style={{
                        background: islandColors[island],
                        width: `${Math.max(
                          10,
                          (count / selectedPicker.pickCount) * 100,
                        )}%`,
                      }}
                    />
                    <span>{data.meta.filmIslands[island].name}</span>
                    <b>{count}</b>
                  </button>
                ))}
            </div>
          </section>

          {selectedFilm && (
            <section className={styles.filmDetail}>
              <span>Selected film</span>
              <h2>{selectedFilm.title}</h2>
              <p>
                {selectedFilm.year ?? "Year unknown"} · {selectedFilm.director}
              </p>
              <div className={styles.islandBadge}>
                <i
                  style={{
                    background: islandColors[selectedFilm.island],
                  }}
                />
                {data.meta.filmIslands[selectedFilm.island].name}
              </div>
              <dl>
                <div>
                  <dt>Picked by</dt>
                  <dd>
                    {(pickerMembership.get(selectedFilmId) ?? []).join(" · ")}
                  </dd>
                </div>
              </dl>
              {selectedFilm.wikipediaUrl && (
                <a
                  className={styles.sourceLink}
                  href={selectedFilm.wikipediaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Film source ↗
                </a>
              )}
            </section>
          )}

          <section className={styles.neighbors}>
            <span>Closest in this 3D projection</span>
            <ol>
              {nearestFilms.map(({ film, filmId }, index) => (
                <li key={filmId}>
                  <button
                    type="button"
                    onClick={() => setSelectedFilmId(filmId)}
                  >
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <span>
                      {film.title}
                      <small>
                        {formatYear(film.year)} · {film.director}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </section>

      <section className={styles.islandStrip} aria-label="Semantic islands">
        <button
          className={selectedIsland === "all" ? styles.selectedIsland : ""}
          type="button"
          onClick={() => setSelectedIsland("all")}
        >
          <i className={styles.allIslands} />
          <span>All islands</span>
          <b>{data.meta.uniqueFilms}</b>
        </button>
        {data.meta.filmIslands.map((island, index) => (
          <button
            className={
              selectedIsland === String(index) ? styles.selectedIsland : ""
            }
            key={`${index}-${island.name}`}
            type="button"
            onClick={() => {
              setSelectedIsland(String(index));
              setViewMode("islands");
            }}
          >
            <i style={{ background: islandColors[index] }} />
            <span>{island.name}</span>
            <b>{island.count}</b>
          </button>
        ))}
      </section>

      <footer className={styles.method}>
        <p>
          The map uses three principal components of the same 36-dimension
          Criterion Genome as the 2D Taste Map. It is computed from Criterion
          metadata and Wikipedia descriptions/categories; it is not yet an
          OpenAI text-embedding projection.
        </p>
        <span>
          {data.meta.filmCoverage}% description coverage ·{" "}
          {data.meta.dimensions.length} dimensions · 8 computed islands
        </span>
      </footer>
    </main>
  );
}
