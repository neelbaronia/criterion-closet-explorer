"use client";
/* eslint-disable @next/next/no-img-element -- Posters and picker portraits are remote Criterion archive data. */

import {
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import peopleData from "../../data/people.json";
import tasteMapData from "../../data/taste-map.json";
import SiteNavigation from "../site-navigation";
import styles from "./semantic-islands.module.css";

type Dimension = {
  family: string;
  id: string;
  label: string;
};

type Film = {
  director: string;
  island: number;
  poster: string;
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
  image: string;
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

type SemanticLeaderboardEntry = {
  entity: "director" | "picker";
  filmIds: string[];
  image: string;
  name: string;
  spread: number;
};

type MapSearchOption = {
  display: string;
  id: string;
  kind: "director" | "film" | "picker";
  name: string;
};

const initialData = tasteMapData as unknown as TasteData;
const initialPeopleImages = peopleData as Record<string, string>;
const islandColors = [
  "#d9472f",
  "#365ed1",
  "#078764",
  "#8e46ae",
  "#aa7900",
  "#bc3f77",
  "#187d91",
  "#bd641f",
];
const axisColors = ["#9f3529", "#2857ae", "#08745a"];
// Start square to the PCA plane; visitors can orbit into depth from here.
const initialCamera: Camera = {
  pitch: 0,
  x: 0,
  y: 0,
  yaw: 0,
  z: -1_450,
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

function pickerColor(name: string) {
  let hash = 2_166_136_261;
  for (const character of name) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  const unsignedHash = hash >>> 0;
  const hue = ((unsignedHash & 0xffff) / 0xffff) * 360;
  const saturation = 64 + ((unsignedHash >>> 16) & 0x0f);
  const lightness = 36 + ((unsignedHash >>> 20) & 0x0f);
  return `hsl(${hue.toFixed(2)} ${saturation}% ${lightness}%)`;
}

function semanticSpread(filmIds: string[], films: Record<string, Film>) {
  const points = [...new Set(filmIds)]
    .map((filmId) => films[filmId])
    .filter(Boolean);
  if (points.length < 5) return undefined;
  const centroid = {
    x: points.reduce((sum, film) => sum + film.x, 0) / points.length,
    y: points.reduce((sum, film) => sum + film.y, 0) / points.length,
    z: points.reduce((sum, film) => sum + film.z, 0) / points.length,
  };
  return Math.sqrt(
    points.reduce(
      (sum, film) =>
        sum +
        (film.x - centroid.x) ** 2 +
        (film.y - centroid.y) ** 2 +
        (film.z - centroid.z) ** 2,
      0,
    ) / points.length,
  );
}

export default function SemanticIslandsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coordinatesRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera>({ ...initialCamera });
  const drawFrameRef = useRef<() => void>(() => undefined);
  const drawRequestRef = useRef<number | null>(null);
  const keyboardFrameRef = useRef<number | null>(null);
  const keyboardTimeRef = useRef(0);
  const pressedKeysRef = useRef(new Set<string>());
  const pickerSpritesRef = useRef(new Map<string, HTMLCanvasElement>());
  const projectedRef = useRef<ProjectedFilm[]>([]);
  const pointerRef = useRef({
    dragging: false,
    moved: false,
    pointerId: -1,
    x: 0,
    y: 0,
  });
  const [data, setData] = useState(initialData);
  const [selectedFilmId, setSelectedFilmId] = useState(
    Object.keys(initialData.films)[0],
  );
  const [hoveredFilmId, setHoveredFilmId] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("all");
  const [selectedPickerId, setSelectedPickerId] = useState("all");
  const [selectedDirectorName, setSelectedDirectorName] = useState("all");
  const [mapQuery, setMapQuery] = useState("");
  const [mapSearchStatus, setMapSearchStatus] = useState("");
  const [leaderboardEntity, setLeaderboardEntity] = useState<
    "director" | "picker"
  >("picker");
  const [leaderboardSort, setLeaderboardSort] = useState<
    "consistent" | "diverse"
  >("diverse");
  const [hasFocus, setHasFocus] = useState(false);

  const filmEntries = useMemo(() => Object.entries(data.films), [data.films]);
  const filmPoints = useMemo(
    () =>
      filmEntries.map(([id, film]) => ({
        film,
        id,
        world: filmWorld(film),
      })),
    [filmEntries],
  );
  const pickerOptions = useMemo(
    () =>
      [...data.pickers].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    [data.pickers],
  );
  const directorOptions = useMemo(() => {
    const filmsByDirector = new Map<string, string[]>();
    for (const [filmId, film] of filmEntries) {
      const filmIds = filmsByDirector.get(film.director) ?? [];
      filmIds.push(filmId);
      filmsByDirector.set(film.director, filmIds);
    }
    return [...filmsByDirector]
      .map(([name, filmIds]) => ({ filmIds, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [filmEntries]);
  const mapSearchOptions = useMemo<MapSearchOption[]>(() => {
    const films = filmEntries.map(([id, film]) => ({
      display: `Film · ${film.title}${formatYear(film.year)} — ${film.director}`,
      id,
      kind: "film" as const,
      name: film.title,
    }));
    const directors = directorOptions.map((director) => ({
      display: `Director · ${director.name}`,
      id: director.name,
      kind: "director" as const,
      name: director.name,
    }));
    const pickers = pickerOptions.map((picker) => ({
      display: `Picker · ${picker.name}`,
      id: picker.id,
      kind: "picker" as const,
      name: picker.name,
    }));
    return [...films, ...directors, ...pickers].sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.kind.localeCompare(right.kind),
    );
  }, [directorOptions, filmEntries, pickerOptions]);
  const pickerMembership = useMemo(() => {
    const membership = new Map<string, Picker[]>();
    for (const picker of data.pickers) {
      for (const filmId of picker.filmIds) {
        const members = membership.get(filmId) ?? [];
        members.push(picker);
        membership.set(filmId, members);
      }
    }
    return membership;
  }, [data.pickers]);
  const selectedPicker = useMemo(
    () =>
      selectedPickerId === "all"
        ? undefined
        : data.pickers.find((picker) => picker.id === selectedPickerId),
    [data.pickers, selectedPickerId],
  );
  const selectedPickerFilmIds = useMemo(
    () => new Set(selectedPicker?.filmIds ?? []),
    [selectedPicker],
  );
  const selectedDirector = useMemo(
    () =>
      selectedDirectorName === "all"
        ? undefined
        : directorOptions.find(
            (director) => director.name === selectedDirectorName,
          ),
    [directorOptions, selectedDirectorName],
  );
  const selectedDirectorFilmIds = useMemo(
    () => new Set(selectedDirector?.filmIds ?? []),
    [selectedDirector],
  );
  const activeHighlight = selectedPicker ?? selectedDirector;
  const activeHighlightFilmIds = selectedPicker
    ? selectedPickerFilmIds
    : selectedDirectorFilmIds;
  const activeHighlightColor = selectedPicker
    ? pickerColor(selectedPicker.name)
    : selectedDirector
      ? pickerColor(`Director: ${selectedDirector.name}`)
      : "";
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
  const semanticLeaderboards = useMemo(() => {
    const pickerCandidates = data.pickers
      .map((picker): SemanticLeaderboardEntry | undefined => {
        const filmIds = picker.filmIds.filter((filmId) => data.films[filmId]);
        const spread = semanticSpread(filmIds, data.films);
        if (spread === undefined) return undefined;
        return {
          entity: "picker",
          filmIds,
          image: picker.image,
          name: picker.name,
          spread,
        };
      })
      .filter((candidate): candidate is SemanticLeaderboardEntry =>
        Boolean(candidate),
      )
      .sort(
        (left, right) =>
          right.spread - left.spread || left.name.localeCompare(right.name),
      );
    const directorCandidates = directorOptions
      .map((director): SemanticLeaderboardEntry | undefined => {
        const spread = semanticSpread(director.filmIds, data.films);
        if (spread === undefined) return undefined;
        return {
          entity: "director",
          filmIds: director.filmIds,
          image: initialPeopleImages[director.name] ?? "",
          name: director.name,
          spread,
        };
      })
      .filter((candidate): candidate is SemanticLeaderboardEntry =>
        Boolean(candidate),
      )
      .sort(
        (left, right) =>
          right.spread - left.spread || left.name.localeCompare(right.name),
      );

    return {
      director: directorCandidates,
      picker: pickerCandidates,
    };
  }, [data.films, data.pickers, directorOptions]);
  const activeLeaderboard = semanticLeaderboards[leaderboardEntity];
  const orderedLeaderboard =
    leaderboardSort === "diverse"
      ? activeLeaderboard
      : [...activeLeaderboard].reverse();

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
          console.warn(
            "Using the bundled 3D semantic-map snapshot.",
            error,
          );
        }
      });
    return () => controller.abort();
  }, []);

  const requestDraw = useCallback(() => {
    if (drawRequestRef.current !== null) return;
    drawRequestRef.current = window.requestAnimationFrame(() => {
      drawRequestRef.current = null;
      drawFrameRef.current();
      const camera = cameraRef.current;
      if (coordinatesRef.current) {
        coordinatesRef.current.textContent =
          `X ${Math.round(camera.x)} · Y ${Math.round(camera.y)} · ` +
          `Z ${Math.round(camera.z)}`;
      }
    });
  }, []);

  useEffect(() => {
    pickerSpritesRef.current.clear();
    requestDraw();
  }, [pickerMembership, requestDraw]);

  function resetCamera() {
    cameraRef.current = { ...initialCamera };
    requestDraw();
  }

  function selectPicker(pickerId: string) {
    setSelectedPickerId(pickerId);
    setSelectedDirectorName("all");
    setSelectedIsland("all");
    if (pickerId === "all") return;
    const nextPicker = data.pickers.find((picker) => picker.id === pickerId);
    const firstFilmId = nextPicker?.filmIds[0];
    if (firstFilmId) setSelectedFilmId(firstFilmId);
  }

  function selectDirector(directorName: string) {
    setSelectedDirectorName(directorName);
    setSelectedPickerId("all");
    setSelectedIsland("all");
    if (directorName === "all") return;
    const director = directorOptions.find(
      (option) => option.name === directorName,
    );
    const firstFilmId = director?.filmIds[0];
    if (firstFilmId) setSelectedFilmId(firstFilmId);
  }

  function selectSearchedFilm(filmId: string) {
    const film = data.films[filmId];
    if (!film) return;
    setSelectedFilmId(filmId);
    setSelectedPickerId("all");
    setSelectedDirectorName("all");
    setSelectedIsland("all");
  }

  function chooseSearchOption(option: MapSearchOption) {
    setMapQuery(option.display);
    if (option.kind === "director") {
      selectDirector(option.name);
      setMapSearchStatus(`Highlighted director ${option.name}`);
    } else if (option.kind === "picker") {
      selectPicker(option.id);
      setMapSearchStatus(`Highlighted picker ${option.name}`);
    } else {
      selectSearchedFilm(option.id);
      setMapSearchStatus(`Selected ${option.name}`);
    }
  }

  function searchMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = mapQuery.trim().toLocaleLowerCase();
    if (!query) {
      setMapSearchStatus("Enter a film, director, or picker");
      return;
    }
    const match =
      mapSearchOptions.find(
        (option) => option.display.toLocaleLowerCase() === query,
      ) ??
      mapSearchOptions.find(
        (option) => option.name.toLocaleLowerCase() === query,
      ) ??
      mapSearchOptions.find((option) =>
        option.name.toLocaleLowerCase().startsWith(query),
      ) ??
      mapSearchOptions.find((option) =>
        option.name.toLocaleLowerCase().includes(query),
      );
    if (match) {
      chooseSearchOption(match);
    } else {
      setMapSearchStatus("No matching film, director, or picker");
    }
  }

  function animateKeyboard(timestamp: number) {
    const keys = pressedKeysRef.current;
    if (!keys.size) {
      keyboardFrameRef.current = null;
      keyboardTimeRef.current = 0;
      return;
    }

    const camera = cameraRef.current;
    const elapsed = keyboardTimeRef.current
      ? Math.min((timestamp - keyboardTimeRef.current) / 1_000, 0.04)
      : 0;
    keyboardTimeRef.current = timestamp;
    const look = 1.35 * elapsed;
    const travel = 470 * elapsed;

    if (keys.has("arrowleft")) camera.yaw -= look;
    if (keys.has("arrowright")) camera.yaw += look;
    if (keys.has("arrowup")) camera.pitch += look;
    if (keys.has("arrowdown")) camera.pitch -= look;
    camera.pitch = clamp(camera.pitch, -1.12, 1.12);
    const forward =
      Number(keys.has("w")) - Number(keys.has("s"));
    const strafe = Number(keys.has("d")) - Number(keys.has("a"));
    camera.x +=
      (Math.sin(camera.yaw) * forward +
        Math.cos(camera.yaw) * strafe) *
      travel;
    camera.z +=
      (Math.cos(camera.yaw) * forward -
        Math.sin(camera.yaw) * strafe) *
      travel;
    requestDraw();
    keyboardFrameRef.current = window.requestAnimationFrame(animateKeyboard);
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
      " ",
    ];
    if (!controlledKeys.includes(event.key)) return;
    event.preventDefault();
    const key = event.key.toLowerCase();
    if (key === " ") {
      if (!event.repeat) resetCamera();
      return;
    }
    pressedKeysRef.current.add(key);
    if (keyboardFrameRef.current === null) {
      keyboardFrameRef.current =
        window.requestAnimationFrame(animateKeyboard);
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLCanvasElement>) {
    pressedKeysRef.current.delete(event.key.toLowerCase());
  }

  function stopKeyboardMotion() {
    pressedKeysRef.current.clear();
    keyboardTimeRef.current = 0;
    if (keyboardFrameRef.current !== null) {
      window.cancelAnimationFrame(keyboardFrameRef.current);
      keyboardFrameRef.current = null;
    }
  }

  useEffect(
    () => () => {
      if (drawRequestRef.current !== null) {
        window.cancelAnimationFrame(drawRequestRef.current);
      }
      if (keyboardFrameRef.current !== null) {
        window.cancelAnimationFrame(keyboardFrameRef.current);
      }
    },
    [],
  );

  function hitTest(event: MouseEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    for (let index = projectedRef.current.length - 1; index >= 0; index -= 1) {
      const point = projectedRef.current[index];
      const distance = Math.hypot(point.screenX - x, point.screenY - y);
      if (distance <= Math.max(8, point.radius + 4)) return point;
    }
    return undefined;
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
      requestDraw();
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
    requestDraw();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    function draw() {
      if (!canvas || !context) return;
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      const pixelWidth = Math.max(1, Math.floor(bounds.width * scale));
      const pixelHeight = Math.max(1, Math.floor(bounds.height * scale));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);

      const gradient = context.createLinearGradient(0, 0, 0, bounds.height);
      gradient.addColorStop(0, "#f7f5ee");
      gradient.addColorStop(0.68, "#efede5");
      gradient.addColorStop(1, "#e5e1d6");
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

      context.lineWidth = 1;
      context.strokeStyle = "rgba(17,17,19,.1)";
      for (let grid = -600; grid <= 600; grid += 200) {
        const gridLines = [
          [
            { x: -600, y: -430, z: grid },
            { x: 600, y: -430, z: grid },
          ],
          [
            { x: grid, y: -430, z: -600 },
            { x: grid, y: -430, z: 600 },
          ],
        ];
        for (const [start, end] of gridLines) {
          const screenStart = project(start);
          const screenEnd = project(end);
          if (!screenStart || !screenEnd) continue;
          context.beginPath();
          context.moveTo(screenStart.x, screenStart.y);
          context.lineTo(screenEnd.x, screenEnd.y);
          context.stroke();
        }
      }

      const axes = [
        {
          color: axisColors[0],
          end: { x: 680, y: 0, z: 0 },
          label: "PC1",
          point: (position: number) => ({ x: position, y: 0, z: 0 }),
          start: { x: -680, y: 0, z: 0 },
        },
        {
          color: axisColors[1],
          end: { x: 0, y: 480, z: 0 },
          label: "PC2",
          point: (position: number) => ({ x: 0, y: position, z: 0 }),
          start: { x: 0, y: -480, z: 0 },
        },
        {
          color: axisColors[2],
          end: { x: 0, y: 0, z: 680 },
          label: "PC3",
          point: (position: number) => ({ x: 0, y: 0, z: position }),
          start: { x: 0, y: 0, z: -680 },
        },
      ];

      for (const axis of axes) {
        const start = project(axis.start);
        const end = project(axis.end);
        if (!start || !end) continue;
        context.strokeStyle = axis.color;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();

        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const perpendicularX = -Math.sin(angle) * 4;
        const perpendicularY = Math.cos(angle) * 4;
        for (const position of [-400, -200, 0, 200, 400]) {
          const tick = project(axis.point(position));
          if (!tick) continue;
          context.beginPath();
          context.moveTo(
            tick.x - perpendicularX,
            tick.y - perpendicularY,
          );
          context.lineTo(
            tick.x + perpendicularX,
            tick.y + perpendicularY,
          );
          context.stroke();
        }

        context.fillStyle = axis.color;
        context.beginPath();
        context.moveTo(end.x, end.y);
        context.lineTo(
          end.x - Math.cos(angle - 0.5) * 9,
          end.y - Math.sin(angle - 0.5) * 9,
        );
        context.lineTo(
          end.x - Math.cos(angle + 0.5) * 9,
          end.y - Math.sin(angle + 0.5) * 9,
        );
        context.closePath();
        context.fill();

        context.font = "600 11px monospace";
        context.textAlign = "center";
        const label = `${axis.label}+`;
        const labelWidth = context.measureText(label).width;
        context.fillStyle = "rgba(247,245,238,.94)";
        context.fillRect(
          end.x - labelWidth / 2 - 4,
          end.y - 25,
          labelWidth + 8,
          16,
        );
        context.fillStyle = axis.color;
        context.fillText(label, end.x, end.y - 13);
      }

      const projected: {
        depth: number;
        film: Film;
        id: string;
        filterHighlighted: boolean;
        islandVisible: boolean;
        radius: number;
        screenX: number;
        screenY: number;
      }[] = [];
      for (const { film, id, world } of filmPoints) {
        const screen = project(world);
        if (
          !screen ||
          screen.x <= -30 ||
          screen.x >= bounds.width + 30 ||
          screen.y <= -30 ||
          screen.y >= bounds.height + 30
        ) {
          continue;
        }
        const islandVisible =
          selectedIsland === "all" || film.island === Number(selectedIsland);
        const filterHighlighted =
          !activeHighlight || activeHighlightFilmIds.has(id);
        const scaleByDepth = clamp(focal / screen.depth, 0.75, 2.1);
        projected.push({
          depth: screen.depth,
          film,
          filterHighlighted,
          id,
          islandVisible,
          radius: 3.1 * scaleByDepth,
          screenX: screen.x,
          screenY: screen.y,
        });
      }
      projected.sort((left, right) => right.depth - left.depth);

      const orderedPoints = activeHighlight
        ? [
            ...projected.filter((point) => !point.filterHighlighted),
            ...projected.filter((point) => point.filterHighlighted),
          ]
        : projected;

      projectedRef.current = orderedPoints.map(
        ({ depth, id, radius, screenX, screenY }) => ({
          depth,
          id,
          radius,
          screenX,
          screenY,
        }),
      );

      function getPickerSprite(filmId: string) {
        const cached = pickerSpritesRef.current.get(filmId);
        if (cached) return cached;

        const sprite = document.createElement("canvas");
        const size = 32;
        const center = size / 2;
        const radius = 14;
        sprite.width = size;
        sprite.height = size;
        const spriteContext = sprite.getContext("2d");
        if (!spriteContext) return sprite;

        const memberships = pickerMembership.get(filmId) ?? [];
        if (memberships.length <= 1) {
          spriteContext.beginPath();
          spriteContext.arc(center, center, radius, 0, Math.PI * 2);
          spriteContext.fillStyle = memberships[0]
            ? pickerColor(memberships[0].name)
            : "#77756e";
          spriteContext.fill();
        } else {
          const slice = (Math.PI * 2) / memberships.length;
          memberships.forEach((picker, index) => {
            const start = -Math.PI / 2 + slice * index;
            spriteContext.beginPath();
            spriteContext.moveTo(center, center);
            spriteContext.arc(
              center,
              center,
              radius,
              start,
              start + slice + 0.002,
            );
            spriteContext.closePath();
            spriteContext.fillStyle = pickerColor(picker.name);
            spriteContext.fill();
          });
        }

        pickerSpritesRef.current.set(filmId, sprite);
        return sprite;
      }

      for (const point of orderedPoints) {
        const isSelected = point.id === selectedFilmId;
        const isHovered = point.id === hoveredFilmId;
        const fadedByIsland = !point.islandVisible;
        const radius =
          point.radius +
          (activeHighlight && point.filterHighlighted ? 1.3 : 0) +
          (isSelected || isHovered ? 2 : 0);
        const opacity = activeHighlight
          ? point.filterHighlighted
            ? fadedByIsland
              ? 0.18
              : 0.98
            : 0.035
          : fadedByIsland
            ? 0.08
            : 0.92;

        context.save();
        context.globalAlpha = opacity;
        if (activeHighlight && point.filterHighlighted) {
          context.beginPath();
          context.arc(
            point.screenX,
            point.screenY,
            radius + 2.2,
            0,
            Math.PI * 2,
          );
          context.strokeStyle = "rgba(255,255,255,.96)";
          context.lineWidth = 2.4;
          context.stroke();
          context.beginPath();
          context.arc(
            point.screenX,
            point.screenY,
            radius,
            0,
            Math.PI * 2,
          );
          context.fillStyle = activeHighlightColor;
          context.fill();
        } else if (activeHighlight) {
          context.beginPath();
          context.arc(
            point.screenX,
            point.screenY,
            radius,
            0,
            Math.PI * 2,
          );
          context.fillStyle = "#77756e";
          context.fill();
        } else {
          const sprite = getPickerSprite(point.id);
          context.drawImage(
            sprite,
            point.screenX - radius,
            point.screenY - radius,
            radius * 2,
            radius * 2,
          );
        }
        context.restore();

        if (isSelected || isHovered) {
          context.beginPath();
          context.arc(
            point.screenX,
            point.screenY,
            radius + (isSelected ? 4.5 : 2.5),
            0,
            Math.PI * 2,
          );
          context.strokeStyle = isSelected
            ? "#111113"
            : "rgba(17,17,19,.72)";
          context.lineWidth = isSelected ? 1.8 : 1;
          context.stroke();
        }
      }

      const majorClusterLabels = data.meta.filmIslands
        .map((island, index) => ({
          center: project(
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
          ),
          index,
          island,
        }))
        .filter(
          ({ center, index, island }) =>
            center !== undefined &&
            center.x > -100 &&
            center.x < bounds.width + 100 &&
            center.y > -100 &&
            center.y < bounds.height + 100 &&
            (island.count >= 40 || selectedIsland === String(index)) &&
            (selectedIsland === "all" || selectedIsland === String(index)),
        )
        .sort((left, right) => right.island.count - left.island.count);
      const placedLabels: {
        bottom: number;
        left: number;
        right: number;
        top: number;
      }[] = [];
      const labelOffsets = [
        [0, -42],
        [0, 18],
        [-80, -42],
        [80, -42],
        [-80, 18],
        [80, 18],
        [0, -68],
        [0, 44],
      ];

      for (const { center, index, island } of majorClusterLabels) {
        if (!center) continue;
        const label =
          `${island.name.toUpperCase()} · ${island.count} FILMS`;
        context.font = "600 10px monospace";
        context.textAlign = "center";
        const labelWidth = context.measureText(label).width + 14;
        const labelHeight = 20;
        let box = {
          bottom: center.y - 22,
          left: center.x - labelWidth / 2,
          right: center.x + labelWidth / 2,
          top: center.y - 42,
        };
        for (const [offsetX, offsetY] of labelOffsets) {
          const left = clamp(
            center.x + offsetX - labelWidth / 2,
            6,
            Math.max(6, bounds.width - labelWidth - 6),
          );
          const top = clamp(
            center.y + offsetY,
            6,
            Math.max(6, bounds.height - labelHeight - 6),
          );
          const candidate = {
            bottom: top + labelHeight,
            left,
            right: left + labelWidth,
            top,
          };
          const overlaps = placedLabels.some(
            (placed) =>
              candidate.left < placed.right + 6 &&
              candidate.right + 6 > placed.left &&
              candidate.top < placed.bottom + 6 &&
              candidate.bottom + 6 > placed.top,
          );
          box = candidate;
          if (!overlaps) break;
        }
        placedLabels.push(box);

        const labelCenterX = (box.left + box.right) / 2;
        const labelEdgeY = box.top > center.y ? box.top : box.bottom;
        context.strokeStyle = `${islandColors[index]}99`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(center.x, center.y);
        context.lineTo(labelCenterX, labelEdgeY);
        context.stroke();
        context.fillStyle = "rgba(247,245,238,.96)";
        context.fillRect(
          box.left,
          box.top,
          box.right - box.left,
          labelHeight,
        );
        context.strokeStyle = islandColors[index];
        context.strokeRect(
          box.left,
          box.top,
          box.right - box.left,
          labelHeight,
        );
        context.fillStyle = "#111113";
        context.fillText(label, labelCenterX, box.top + 13);
      }
    }

    drawFrameRef.current = draw;
    requestDraw();
    const resizeObserver = new ResizeObserver(requestDraw);
    resizeObserver.observe(canvas);
    return () => {
      resizeObserver.disconnect();
      drawFrameRef.current = () => undefined;
    };
  }, [
    activeHighlight,
    activeHighlightColor,
    activeHighlightFilmIds,
    data.meta.filmIslands,
    filmPoints,
    hoveredFilmId,
    pickerMembership,
    requestDraw,
    selectedFilmId,
    selectedIsland,
  ]);

  return (
    <main className={styles.page}>
      <SiteNavigation active="mapping" />

      <section className={styles.controlBar} aria-label="Semantic map controls">
        <label className={styles.pickerFilter}>
          <span>Highlight picker</span>
          <div>
            <i
              className={selectedPicker ? "" : styles.allPickers}
              style={
                selectedPicker
                  ? { background: pickerColor(selectedPicker.name) }
                  : undefined
              }
            />
            <select
              aria-label="Highlight a closet picker"
              value={selectedPickerId}
              onChange={(event) => selectPicker(event.target.value)}
            >
              <option value="all">All pickers</option>
              {pickerOptions.map((picker) => (
                <option key={picker.id} value={picker.id}>
                  {picker.name}
                </option>
              ))}
            </select>
          </div>
          <small>
            {selectedPicker
              ? `${selectedPicker.filmIds.length} films highlighted`
              : `${pickerOptions.length} picker colors`}
          </small>
        </label>
        <label className={styles.directorFilter}>
          <span>Highlight director</span>
          <div>
            <i
              className={selectedDirector ? "" : styles.allDirectors}
              style={
                selectedDirector
                  ? {
                      background: pickerColor(
                        `Director: ${selectedDirector.name}`,
                      ),
                    }
                  : undefined
              }
            />
            <select
              aria-label="Highlight a director"
              value={selectedDirectorName}
              onChange={(event) => selectDirector(event.target.value)}
            >
              <option value="all">All directors</option>
              {directorOptions.map((director) => (
                <option key={director.name} value={director.name}>
                  {director.name}
                </option>
              ))}
            </select>
          </div>
          <small>
            {selectedDirector
              ? `${selectedDirector.filmIds.length} films highlighted`
              : `${directorOptions.length} directors`}
          </small>
        </label>
        <form className={styles.filmSearch} onSubmit={searchMap}>
          <span>Search map</span>
          <div>
            <input
              aria-label="Search films, directors, or pickers"
              autoComplete="off"
              list="semantic-map-search-options"
              placeholder="Search films, directors, or pickers"
              type="search"
              value={mapQuery}
              onChange={(event) => {
                const value = event.target.value;
                setMapQuery(value);
                setMapSearchStatus("");
                const exactMatch = mapSearchOptions.find(
                  (option) => option.display === value,
                );
                if (exactMatch) chooseSearchOption(exactMatch);
              }}
            />
            <button type="submit">Find</button>
          </div>
          <datalist id="semantic-map-search-options">
            {mapSearchOptions.map(({ display, id, kind }) => (
              <option key={`${kind}-${id}`} value={display} />
            ))}
          </datalist>
          <small aria-live="polite">
            {mapSearchStatus ||
              `${filmEntries.length.toLocaleString()} films · ${directorOptions.length.toLocaleString()} directors · ${pickerOptions.length.toLocaleString()} pickers`}
          </small>
        </form>
        <div className={styles.axisGuide}>
          <span>Orientation</span>
          <div>
            {axisColors.map((color, index) => (
              <b key={color}>
                <i style={{ background: color }} />
                {`PC${index + 1}`}
              </b>
            ))}
          </div>
        </div>
        <p>
          The three axes are principal components: compressed mixtures of all
          36 film dimensions. Distance is meaningful; no axis is a single genre.
        </p>
        <div className={styles.cameraActions}>
          <button type="button" onClick={resetCamera}>
            Reset <kbd>Space</kbd>
          </button>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.viewport}>
          <canvas
            ref={canvasRef}
            aria-label="Navigable three-dimensional semantic map of Criterion Closet films. Drag to orbit on touch screens; use arrow keys to change point of view and WASD to move with a keyboard."
            onBlur={() => {
              stopKeyboardMotion();
              setHasFocus(false);
            }}
            onFocus={() => setHasFocus(true)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onMouseLeave={() => setHoveredFilmId("")}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            tabIndex={0}
          />
          <div className={styles.crosshair} aria-hidden="true" />
          <div className={styles.mapLegend}>
            <b>
              {selectedPicker
                ? `${selectedPicker.name} · ${selectedPicker.filmIds.length} films`
                : selectedDirector
                  ? `${selectedDirector.name} · ${selectedDirector.filmIds.length} films`
                : "Picker colors + PCA axes"}
            </b>
            {selectedPicker ? (
              <span>
                Their picks are enlarged in one stable color; all other films
                are dimmed for context.
              </span>
            ) : selectedDirector ? (
              <span>
                Their directed films are enlarged in one stable color; all
                other films are dimmed for context.
              </span>
            ) : (
              <span>
                Each picker has a stable color. Divided dots were picked by
                several people; cluster labels retain island colors.
              </span>
            )}
          </div>
          <div ref={coordinatesRef} className={styles.coordinates}>
            X {Math.round(initialCamera.x)} · Y {Math.round(initialCamera.y)} · Z{" "}
            {Math.round(initialCamera.z)}
          </div>
          <div
            className={`${styles.controlNotice} ${
              hasFocus ? styles.focused : ""
            }`}
          >
            <b className={styles.keyboardControl}>
              <kbd>← ↑ ↓ →</kbd> Change POV
            </b>
            <b className={styles.keyboardControl}>
              <kbd>W A S D</kbd> Navigate
            </b>
            <b className={styles.touchControl}>
              <kbd>Drag</kbd> Orbit map
            </b>
            <span className={styles.keyboardControl}>
              {hasFocus ? "Controls active" : "Click map to activate"}
            </span>
            <span className={styles.touchControl}>
              Tap a dot to inspect a film
            </span>
          </div>
          {hoveredFilm && (
            <div className={styles.hoverCard}>
              <b>{hoveredFilm.title}</b>
              <span>
                {hoveredFilm.year ?? "Year unknown"} · {hoveredFilm.director}
              </span>
            </div>
          )}
        </div>

        <aside className={styles.inspector}>
          {selectedFilm && (
            <section className={styles.filmDetail}>
              <div className={styles.selectedFilmOverview}>
                <img
                  className={styles.selectedPoster}
                  src={selectedFilm.poster}
                  alt={`${selectedFilm.title} poster`}
                />
                <div>
                  <span>Selected film</span>
                  <h2>{selectedFilm.title}</h2>
                  <p>
                    {selectedFilm.year ?? "Year unknown"} ·{" "}
                    {selectedFilm.director}
                  </p>
                  <div className={styles.islandBadge}>
                    <i
                      style={{
                        background: islandColors[selectedFilm.island],
                      }}
                    />
                    {data.meta.filmIslands[selectedFilm.island].name}
                  </div>
                </div>
              </div>
              <div className={styles.pickerGallery}>
                <span>Picked by</span>
                <div className={styles.pickerCardGrid}>
                  {(pickerMembership.get(selectedFilmId) ?? []).map((picker) => (
                    <article
                      className={styles.pickerCard}
                      key={picker.id}
                      style={{ borderColor: pickerColor(picker.name) }}
                    >
                      {picker.image ? (
                        <img
                          src={picker.image}
                          alt={`${picker.name}, Criterion Closet picker`}
                          loading="lazy"
                        />
                      ) : (
                        <i aria-hidden="true">
                          {picker.name
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </i>
                      )}
                      <b>{picker.name}</b>
                    </article>
                  ))}
                </div>
              </div>
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
                    <img
                      src={film.poster}
                      alt={`${film.title} poster`}
                      loading="lazy"
                    />
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
            onClick={() => setSelectedIsland(String(index))}
          >
            <i style={{ background: islandColors[index] }} />
            <span>{island.name}</span>
            <b>{island.count}</b>
          </button>
        ))}
      </section>

      <section
        className={styles.semanticAwards}
        aria-labelledby="semantic-awards-title"
      >
        <header>
          <div>
            <span>Semantic leaderboard / 3D projection</span>
            <h2 id="semantic-awards-title">Taste Range Leaderboard</h2>
          </div>
          <p>
            Ranked from the widest-ranging film taste to the tightest, most
            consistent cluster.
          </p>
        </header>
        <div className={styles.leaderboard}>
          <div className={styles.leaderboardToolbar}>
            <div
              className={styles.leaderboardTabs}
              role="tablist"
              aria-label="Semantic leaderboard type"
            >
              <button
                aria-controls="semantic-leaderboard-panel"
                aria-selected={leaderboardEntity === "picker"}
                id="picker-leaderboard-tab"
                onClick={() => setLeaderboardEntity("picker")}
                role="tab"
                type="button"
              >
                Closet pickers
                <b>{semanticLeaderboards.picker.length}</b>
              </button>
              <button
                aria-controls="semantic-leaderboard-panel"
                aria-selected={leaderboardEntity === "director"}
                id="director-leaderboard-tab"
                onClick={() => setLeaderboardEntity("director")}
                role="tab"
                type="button"
              >
                Directors
                <b>{semanticLeaderboards.director.length}</b>
              </button>
            </div>
            <button
              aria-label={`Sort by RMS spread: ${
                leaderboardSort === "diverse"
                  ? "most diverse first"
                  : "most consistent first"
              }`}
              className={styles.leaderboardSort}
              onClick={() =>
                setLeaderboardSort((current) =>
                  current === "diverse" ? "consistent" : "diverse",
                )
              }
              type="button"
            >
              <span>
                {leaderboardSort === "diverse"
                  ? "Most diverse first"
                  : "Most consistent first"}
              </span>
              <b aria-hidden="true">
                {leaderboardSort === "diverse" ? "↓" : "↑"}
              </b>
            </button>
          </div>
          <div className={styles.leaderboardColumns} aria-hidden="true">
            <span>Rank</span>
            <span>{leaderboardEntity === "picker" ? "Picker" : "Director"}</span>
            <span>Mapped films</span>
            <span>RMS spread</span>
            <span>Films</span>
          </div>
          <ol
            aria-labelledby={`${leaderboardEntity}-leaderboard-tab`}
            className={styles.leaderboardList}
            id="semantic-leaderboard-panel"
            role="tabpanel"
          >
            {orderedLeaderboard.map((candidate, index) => {
              const initials = candidate.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("");
              const candidateFilms = [...new Set(candidate.filmIds)]
                .map((filmId) => ({
                  film: data.films[filmId],
                  id: filmId,
                }))
                .filter(
                  (entry): entry is { film: Film; id: string } =>
                    Boolean(entry.film),
                )
                .sort(
                  (left, right) =>
                    (left.film.year ?? Number.MAX_SAFE_INTEGER) -
                      (right.film.year ?? Number.MAX_SAFE_INTEGER) ||
                    left.film.title.localeCompare(right.film.title),
                );

              return (
                <li key={`${candidate.entity}-${candidate.name}`}>
                  <b className={styles.leaderboardRank}>
                    {String(index + 1).padStart(3, "0")}
                  </b>
                  <div className={styles.leaderboardIdentity}>
                    {candidate.image ? (
                      <img
                        src={candidate.image}
                        alt={`${candidate.name}, Criterion Closet picker`}
                        loading="lazy"
                      />
                    ) : (
                      <i aria-hidden="true">{initials}</i>
                    )}
                    <div>
                      <h3>{candidate.name}</h3>
                      <span>
                        {candidate === activeLeaderboard[0]
                          ? "Most diverse"
                          : candidate === activeLeaderboard.at(-1)
                            ? "Most consistent"
                            : candidate.entity === "picker"
                              ? "Closet picker"
                              : "Director"}
                      </span>
                    </div>
                  </div>
                  <b className={styles.leaderboardFilmCount}>
                    {candidate.filmIds.length}
                  </b>
                  <div className={styles.leaderboardScore}>
                    <b>{candidate.spread.toFixed(3)}</b>
                  </div>
                  <div
                    aria-label={`${candidate.name}'s mapped films`}
                    className={styles.leaderboardFilmography}
                  >
                    {candidateFilms.map(({ film, id }) => (
                      <figure
                        key={id}
                        title={`${film.title}${formatYear(film.year)}`}
                      >
                        <div>
                          {film.poster ? (
                            <img
                              alt={`${film.title} poster`}
                              loading="lazy"
                              src={film.poster}
                            />
                          ) : (
                            <span aria-hidden="true">No poster</span>
                          )}
                        </div>
                        <figcaption>
                          <b>{film.title}</b>
                          <span>{film.year ?? "Year unknown"}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <footer>
          RMS spread is the average 3D distance of a person&apos;s film points
          from their centroid. Rankings require at least five mapped films;
          lower spread means a tighter, more consistent cluster.
        </footer>
      </section>

      <footer className={styles.method}>
        <span>
          {data.meta.filmCoverage}% description coverage ·{" "}
          {data.meta.dimensions.length} dimensions · 8 computed islands
        </span>
      </footer>
    </main>
  );
}
