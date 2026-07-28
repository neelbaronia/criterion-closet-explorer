import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".cache", "taste-map");
const CACHE_FILE = path.join(CACHE_DIR, "wikipedia.json");
const FILMS_FILE = path.join(ROOT, "data", "films.json");
const VIDEOS_FILE = path.join(ROOT, "data", "closet-videos.json");
const OUTPUT_FILE = path.join(ROOT, "data", "taste-map.json");
const WIKIPEDIA_API = "https://en.m.wikipedia.org/w/api.php";
const USER_AGENT =
  "CriterionClosetExplorer/0.1 (https://github.com/neelbaronia/criterion-closet-explorer; research prototype)";
const refresh = process.argv.includes("--refresh");

const dimensions = [
  {
    id: "warm",
    label: "Warmth",
    family: "Mood",
    keywords: ["warm", "tender", "heartwarming", "compassion", "gentle", "uplifting"],
  },
  {
    id: "bleak",
    label: "Bleakness",
    family: "Mood",
    keywords: ["bleak", "despair", "grim", "tragedy", "tragic", "pessimistic", "depressing"],
  },
  {
    id: "tense",
    label: "Tension",
    family: "Mood",
    keywords: ["tense", "suspense", "thriller", "anxiety", "psychological", "mystery"],
  },
  {
    id: "funny",
    label: "Humor",
    family: "Mood",
    keywords: ["comedy", "comic", "humor", "satire", "farce", "funny", "parody"],
  },
  {
    id: "romantic",
    label: "Romance",
    family: "Mood",
    keywords: ["romance", "romantic", "love story", "relationship", "lovers"],
  },
  {
    id: "disturbing",
    label: "Disturbance",
    family: "Mood",
    keywords: ["disturbing", "shocking", "controversial", "nightmare", "trauma", "abuse"],
  },
  {
    id: "emotional",
    label: "Emotional intensity",
    family: "Mood",
    keywords: ["emotional", "melodrama", "grief", "mourning", "heartbreak", "tearjerker"],
  },
  {
    id: "contemplative",
    label: "Contemplation",
    family: "Mood",
    keywords: ["contemplative", "meditative", "poetic", "philosophical", "reflective"],
  },
  {
    id: "experimental",
    label: "Experimentation",
    family: "Form",
    keywords: ["experimental", "avant-garde", "avant garde", "radical", "structural film"],
  },
  {
    id: "surreal",
    label: "Surrealism",
    family: "Form",
    keywords: ["surreal", "surrealist", "dreamlike", "dream-like", "absurdist", "fantastical"],
  },
  {
    id: "nonlinear",
    label: "Nonlinearity",
    family: "Form",
    keywords: ["nonlinear", "non-linear", "fragmented narrative", "metafiction", "anthology"],
  },
  {
    id: "visual",
    label: "Visual stylization",
    family: "Form",
    keywords: ["stylized", "visual style", "cinematography", "expressionist", "technicolor", "visual effects"],
  },
  {
    id: "dialogue",
    label: "Dialogue",
    family: "Form",
    keywords: ["dialogue", "conversation", "talking", "screenplay", "verbal", "monologue"],
  },
  {
    id: "slow",
    label: "Slow cinema",
    family: "Form",
    keywords: ["slow cinema", "long take", "long takes", "minimalist", "austere", "deliberate pace"],
  },
  {
    id: "kinetic",
    label: "Kinetic energy",
    family: "Form",
    keywords: ["action film", "action thriller", "chase", "martial arts", "fast-paced", "adventure"],
  },
  {
    id: "minimalist",
    label: "Minimalism",
    family: "Form",
    keywords: ["minimalist", "minimalism", "sparse", "austere", "restrained", "low-budget"],
  },
  {
    id: "crime",
    label: "Crime",
    family: "Theme",
    keywords: ["crime", "criminal", "gangster", "film noir", "neo-noir", "detective", "police"],
  },
  {
    id: "political",
    label: "Politics",
    family: "Theme",
    keywords: ["political", "politics", "revolution", "fascism", "communism", "government", "activist"],
  },
  {
    id: "family",
    label: "Family",
    family: "Theme",
    keywords: ["family", "father", "mother", "parent", "siblings", "marriage", "domestic"],
  },
  {
    id: "coming-of-age",
    label: "Coming of age",
    family: "Theme",
    keywords: ["coming-of-age", "coming of age", "adolescence", "teenager", "youth", "childhood"],
  },
  {
    id: "identity",
    label: "Identity",
    family: "Theme",
    keywords: ["identity", "gender", "sexuality", "lgbtq", "race", "immigrant", "self-discovery"],
  },
  {
    id: "social",
    label: "Social critique",
    family: "Theme",
    keywords: ["social commentary", "social criticism", "class conflict", "inequality", "poverty", "colonialism"],
  },
  {
    id: "spiritual",
    label: "Spirituality",
    family: "Theme",
    keywords: ["spiritual", "religion", "religious", "faith", "god", "buddhist", "christian"],
  },
  {
    id: "war",
    label: "War",
    family: "Theme",
    keywords: ["war film", "world war", "military", "soldier", "occupation", "anti-war"],
  },
  {
    id: "realist",
    label: "Realism",
    family: "Mode",
    keywords: ["realism", "realist", "neorealism", "slice of life", "naturalistic", "docudrama"],
  },
  {
    id: "fantasy",
    label: "Fantasy",
    family: "Mode",
    keywords: ["fantasy film", "fairy tale", "mythology", "magic", "supernatural", "fantastical"],
  },
  {
    id: "horror",
    label: "Horror",
    family: "Mode",
    keywords: ["horror", "monster", "vampire", "ghost", "slasher", "occult", "zombie"],
  },
  {
    id: "documentary",
    label: "Documentary",
    family: "Mode",
    keywords: ["documentary", "non-fiction", "nonfiction", "essay film", "concert film"],
  },
  {
    id: "animation",
    label: "Animation",
    family: "Mode",
    keywords: ["animated", "animation", "anime", "stop-motion", "stop motion"],
  },
  {
    id: "epic",
    label: "Epic scale",
    family: "Mode",
    keywords: ["epic film", "historical epic", "saga", "large-scale", "spectacle"],
  },
  {
    id: "intimate",
    label: "Intimacy",
    family: "Mode",
    keywords: ["intimate", "chamber drama", "personal", "relationship drama", "domestic drama"],
  },
  {
    id: "cerebral",
    label: "Cerebral",
    family: "Mode",
    keywords: ["cerebral", "philosophical", "intellectual", "metaphysical", "existential", "allegory"],
  },
  {
    id: "classic",
    label: "Classic cinema",
    family: "Context",
    direct: (film) => clamp((1985 - (film.year ?? 1985)) / 65),
  },
  {
    id: "contemporary",
    label: "Contemporary cinema",
    family: "Context",
    direct: (film) => clamp(((film.year ?? 1980) - 1980) / 45),
  },
  {
    id: "international",
    label: "International cinema",
    family: "Context",
    keywords: [
      "french film",
      "italian film",
      "japanese film",
      "korean film",
      "iranian film",
      "indian film",
      "german film",
      "spanish film",
      "swedish film",
      "polish film",
      "mexican film",
      "brazilian film",
      "soviet film",
      "hong kong film",
      "chinese film",
      "senegalese film",
      "czech film",
    ],
  },
  {
    id: "black-and-white",
    label: "Black & white",
    family: "Context",
    keywords: ["black-and-white film", "black and white film", "monochrome film"],
  },
];

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

function tokenSet(value) {
  return new Set(
    normalize(value)
      .split(/\s+/)
      .filter((token) => token.length > 1 && !["the", "a", "an"].includes(token)),
  );
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection || 1);
}

function slug(value) {
  return normalize(value).replace(/\s+/g, "-");
}

async function readJson(filename, fallback) {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch {
    return fallback;
  }
}

function scoreWikipediaCandidate(page, film) {
  const filmTokens = tokenSet(film.title);
  const pageTokens = tokenSet(page.title.replace(/\([^)]*\)/g, ""));
  const text = normalize(`${page.title} ${page.extract ?? ""}`);
  const directorTokens = [...tokenSet(film.director)];
  const year = String(film.year ?? "");
  let score = jaccard(filmTokens, pageTokens) * 70;

  if (normalize(page.title).includes(normalize(film.title))) score += 24;
  if (/\bfilm\b/i.test(page.title)) score += 12;
  if (year && text.includes(year)) score += 10;
  if (directorTokens.some((token) => text.includes(token))) score += 22;
  if (normalize(page.title) === normalize(film.director)) score -= 80;
  if (/\bfilmography\b/i.test(page.title)) score -= 30;
  if (/\bdisambiguation\b/i.test(page.title)) score -= 80;
  return score;
}

function validWikipediaCandidate(page, film) {
  const extract = page.extract ?? "";
  const text = normalize(extract);
  const directorTokens = [...tokenSet(film.director)].filter(
    (token) => token.length > 3 && token !== "director" && token !== "unavailable",
  );
  const hasDirector = directorTokens.some((token) => text.includes(token));
  const hasMediaTitle = /\b(film|movie|documentary|series)\b/i.test(
    page.title ?? page.pageTitle ?? "",
  );
  const hasYearFilm =
    film.year &&
    new RegExp(
      `\\b${film.year}\\b.{0,80}\\b(film|movie|documentary|series|miniseries)\\b`,
      "i",
    ).test(extract);
  const titleSimilarity = jaccard(
    tokenSet(film.title),
    tokenSet((page.title ?? page.pageTitle ?? "").replace(/\([^)]*\)/g, "")),
  );
  return (
    !/\bdisambiguation\b/i.test(page.title ?? page.pageTitle ?? "") &&
    titleSimilarity >= 0.3 &&
    (hasDirector || hasMediaTitle || hasYearFilm)
  );
}

function wikipediaMetadata(page, score) {
  return {
    categories: (page.categories ?? []).map((item) =>
      item.title.replace(/^Category:/, ""),
    ),
    extract: page.extract ?? "",
    matched: true,
    pageTitle: page.title,
    score: Math.round(score),
    url: `https://en.wikipedia.org/?curid=${page.pageid}`,
  };
}

function wikipediaCandidateTitles(film) {
  return [
    film.title,
    `${film.title} (film)`,
    film.year ? `${film.title} (${film.year} film)` : "",
  ].filter(Boolean);
}

async function fetchWikipediaBatch(films) {
  const titles = [
    ...new Set(films.flatMap((film) => wikipediaCandidateTitles(film))),
  ];
  const params = {
    action: "query",
    titles: titles.join("|"),
    prop: "extracts|categories",
    exintro: "1",
    exlimit: "20",
    explaintext: "1",
    cllimit: "max",
    redirects: "1",
    format: "json",
    formatversion: "2",
  };
  const body = new URLSearchParams(params);

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(WIKIPEDIA_API, {
        body,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        method: "POST",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const payload = await response.json();
      const candidates = (payload.query?.pages ?? []).filter(
        (page) => !page.missing && page.extract,
      );
      return films.map((film) => {
        const ranked = candidates
          .filter((page) => validWikipediaCandidate(page, film))
          .map((page) => ({
            page,
            score: scoreWikipediaCandidate(page, film),
          }))
          .sort((a, b) => b.score - a.score);
        const winner = ranked[0];
        if (!winner || winner.score < 55) return { matched: false };

        return wikipediaMetadata(winner.page, winner.score);
      });
    } catch (error) {
      if (attempt === 6) {
        return films.map(() => ({ error: String(error), matched: false }));
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    }
  }

  return films.map(() => ({ matched: false }));
}

async function searchWikipedia(film) {
  const query = `${film.title} ${film.year ?? ""} film ${film.director}`;
  const url = new URL(WIKIPEDIA_API);
  const params = {
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "0",
    gsrlimit: "5",
    prop: "extracts|categories",
    exintro: "1",
    explaintext: "1",
    cllimit: "max",
    format: "json",
    formatversion: "2",
  };
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const payload = await response.json();
      const winner = (payload.query?.pages ?? [])
        .filter(
          (page) => page.extract && validWikipediaCandidate(page, film),
        )
        .map((page) => ({
          page,
          score: scoreWikipediaCandidate(page, film),
        }))
        .sort((left, right) => right.score - left.score)[0];
      if (!winner || winner.score < 45) return { matched: false };
      return wikipediaMetadata(winner.page, winner.score);
    } catch (error) {
      if (attempt === 4) {
        return { error: String(error), matched: false };
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 3_000));
    }
  }

  return { matched: false };
}

function rawDimensionScore(film, metadata, dimension) {
  if (dimension.direct) return dimension.direct(film);
  if (!metadata?.matched) return null;
  const text = normalize(
    `${film.title} ${film.director} ${metadata.extract} ${(metadata.categories ?? []).join(" ")}`,
  );
  let score = 0;
  for (const keyword of dimension.keywords ?? []) {
    const term = normalize(keyword);
    if (!term) continue;
    if (text.includes(term)) {
      score += term.includes(" ") ? 1.45 : 1;
    }
  }
  return 1 - Math.exp(-score / 2.6);
}

function percentile(values, position) {
  if (!values.length) return 0;
  const index = (values.length - 1) * position;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;
  return values[lower] * (1 - fraction) + values[upper] * fraction;
}

function normalizeDimensionScores(rawScores) {
  const output = rawScores.map(() => new Array(dimensions.length).fill(0));

  dimensions.forEach((dimension, dimensionIndex) => {
    const direct = Boolean(dimension.direct);
    const values = rawScores
      .map((scores) => scores[dimensionIndex])
      .filter((value) => value !== null)
      .sort((a, b) => a - b);
    const low = direct ? 0 : percentile(values, 0.12);
    const high = direct ? 1 : percentile(values, 0.94);

    rawScores.forEach((scores, filmIndex) => {
      const value = scores[dimensionIndex];
      output[filmIndex][dimensionIndex] =
        value === null
          ? null
          : clamp((value - low) / Math.max(0.08, high - low));
    });
  });

  return output;
}

function averageVectors(entries, vectorLength) {
  const totals = new Array(vectorLength).fill(0);
  const weights = new Array(vectorLength).fill(0);

  for (const { vector, weight = 1 } of entries) {
    vector.forEach((value, index) => {
      if (value === null || !Number.isFinite(value)) return;
      totals[index] += value * weight;
      weights[index] += weight;
    });
  }

  return totals.map((total, index) =>
    weights[index] ? total / weights[index] : 0,
  );
}

function euclideanSimilarity(left, right) {
  let squared = 0;
  for (let index = 0; index < left.length; index += 1) {
    squared += (left[index] - right[index]) ** 2;
  }
  return clamp(1 - Math.sqrt(squared / left.length));
}

function weightedJaccard(left, right, weights) {
  const union = new Set([...left, ...right]);
  let intersectionWeight = 0;
  let unionWeight = 0;
  for (const value of union) {
    const weight = weights.get(value) ?? 1;
    unionWeight += weight;
    if (left.has(value) && right.has(value)) intersectionWeight += weight;
  }
  return unionWeight ? intersectionWeight / unionWeight : 0;
}

function powerIteration(matrix, orthogonalTo) {
  const size = matrix.length;
  let vector = Array.from(
    { length: size },
    (_, index) => Math.sin((index + 1) * 1.618) + 0.2,
  );

  for (let iteration = 0; iteration < 160; iteration += 1) {
    let next = matrix.map((row) =>
      row.reduce((sum, value, index) => sum + value * vector[index], 0),
    );
    for (const basis of orthogonalTo) {
      const projection = next.reduce(
        (sum, value, index) => sum + value * basis[index],
        0,
      );
      next = next.map((value, index) => value - projection * basis[index]);
    }
    const magnitude = Math.sqrt(next.reduce((sum, value) => sum + value ** 2, 0));
    vector = next.map((value) => value / (magnitude || 1));
  }
  return vector;
}

function pcaPositions(profiles) {
  const size = dimensions.length;
  const means = Array.from({ length: size }, (_, dimensionIndex) =>
    profiles.reduce((sum, profile) => sum + profile[dimensionIndex], 0) /
    profiles.length,
  );
  const centered = profiles.map((profile) =>
    profile.map((value, index) => value - means[index]),
  );
  const covariance = Array.from({ length: size }, () =>
    new Array(size).fill(0),
  );

  for (const profile of centered) {
    for (let row = 0; row < size; row += 1) {
      for (let column = row; column < size; column += 1) {
        covariance[row][column] +=
          (profile[row] * profile[column]) / Math.max(1, profiles.length - 1);
        covariance[column][row] = covariance[row][column];
      }
    }
  }

  const first = powerIteration(covariance, []);
  const second = powerIteration(covariance, [first]);
  const raw = centered.map((profile) => [
    profile.reduce((sum, value, index) => sum + value * first[index], 0),
    profile.reduce((sum, value, index) => sum + value * second[index], 0),
  ]);

  const axes = [0, 1].map((axis) =>
    raw.map((point) => point[axis]).sort((a, b) => a - b),
  );
  const bounds = axes.map((values) => [
    percentile(values, 0.02),
    percentile(values, 0.98),
  ]);
  return raw.map(([x, y], index) => ({
    x: clamp((x - bounds[0][0]) / Math.max(0.001, bounds[0][1] - bounds[0][0])),
    y: clamp((y - bounds[1][0]) / Math.max(0.001, bounds[1][1] - bounds[1][0])),
    jitter: ((index * 7919) % 97) / 97,
  }));
}

function pcaPositions3D(profiles) {
  const size = dimensions.length;
  const means = Array.from({ length: size }, (_, dimensionIndex) =>
    profiles.reduce((sum, profile) => sum + profile[dimensionIndex], 0) /
    profiles.length,
  );
  const centered = profiles.map((profile) =>
    profile.map((value, index) => value - means[index]),
  );
  const covariance = Array.from({ length: size }, () =>
    new Array(size).fill(0),
  );

  for (const profile of centered) {
    for (let row = 0; row < size; row += 1) {
      for (let column = row; column < size; column += 1) {
        covariance[row][column] +=
          (profile[row] * profile[column]) / Math.max(1, profiles.length - 1);
        covariance[column][row] = covariance[row][column];
      }
    }
  }

  const first = powerIteration(covariance, []);
  const second = powerIteration(covariance, [first]);
  const third = powerIteration(covariance, [first, second]);
  const raw = centered.map((profile) =>
    [first, second, third].map((axis) =>
      profile.reduce((sum, value, index) => sum + value * axis[index], 0),
    ),
  );
  const bounds = [0, 1, 2].map((axis) => {
    const values = raw.map((point) => point[axis]).sort((a, b) => a - b);
    return [percentile(values, 0.02), percentile(values, 0.98)];
  });

  return raw.map(([x, y, z], index) => ({
    x: clamp((x - bounds[0][0]) / Math.max(0.001, bounds[0][1] - bounds[0][0])),
    y: clamp((y - bounds[1][0]) / Math.max(0.001, bounds[1][1] - bounds[1][0])),
    z: clamp((z - bounds[2][0]) / Math.max(0.001, bounds[2][1] - bounds[2][0])),
    jitter: ((index * 7919) % 97) / 97,
  }));
}

function kMeans(profiles, clusterCount = 8) {
  const centroids = [profiles[0].slice()];
  while (centroids.length < clusterCount) {
    let nextIndex = 0;
    let nextDistance = -1;
    profiles.forEach((profile, index) => {
      const distance = Math.min(
        ...centroids.map((centroid) => 1 - euclideanSimilarity(profile, centroid)),
      );
      if (distance > nextDistance) {
        nextDistance = distance;
        nextIndex = index;
      }
    });
    centroids.push(profiles[nextIndex].slice());
  }

  let assignments = new Array(profiles.length).fill(0);
  for (let iteration = 0; iteration < 35; iteration += 1) {
    assignments = profiles.map((profile) => {
      let best = 0;
      let bestSimilarity = -Infinity;
      centroids.forEach((centroid, index) => {
        const similarity = euclideanSimilarity(profile, centroid);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          best = index;
        }
      });
      return best;
    });

    for (let cluster = 0; cluster < clusterCount; cluster += 1) {
      const members = profiles
        .map((profile, index) => ({ profile, index }))
        .filter(({ index }) => assignments[index] === cluster)
        .map(({ profile }) => ({ vector: profile }));
      if (members.length) {
        centroids[cluster] = averageVectors(members, dimensions.length);
      }
    }
  }

  return { assignments, centroids };
}

function topIndices(values, count, compare = (a, b) => b - a) {
  return values
    .map((value, index) => ({ index, value }))
    .sort((left, right) => compare(left.value, right.value))
    .slice(0, count)
    .map(({ index }) => index);
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const films = JSON.parse(await readFile(FILMS_FILE, "utf8"));
  const videos = JSON.parse(await readFile(VIDEOS_FILE, "utf8"));
  const uniqueFilms = [
    ...new Map(films.map((film) => [film.filmId, film])).values(),
  ];
  const cache = refresh ? {} : await readJson(CACHE_FILE, {});

  console.log(
    `Building Criterion Genome for ${uniqueFilms.length} unique films...`,
  );
  const unresolved = uniqueFilms.filter(
    (film) => !cache[film.filmId]?.matched,
  );
  const batches = [];
  for (let index = 0; index < unresolved.length; index += 6) {
    batches.push(unresolved.slice(index, index + 6));
  }
  let completed = uniqueFilms.length - unresolved.length;
  let processed = 0;
  for (const batch of batches) {
    const results = await fetchWikipediaBatch(batch);
    batch.forEach((film, index) => {
      cache[film.filmId] = results[index];
    });
    completed += batch.length;
    processed += batch.length;
    if (processed % 60 === 0 || completed === uniqueFilms.length) {
      console.log(`Resolved ${completed}/${uniqueFilms.length} films`);
      await writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const searchNeeded = uniqueFilms.filter(
    (film) =>
      !cache[film.filmId]?.matched ||
      !validWikipediaCandidate(
        {
          extract: cache[film.filmId]?.extract,
          pageTitle: cache[film.filmId]?.pageTitle,
        },
        film,
      ),
  );
  for (let index = 0; index < searchNeeded.length; index += 2) {
    const batch = searchNeeded.slice(index, index + 2);
    const results = await Promise.all(batch.map((film) => searchWikipedia(film)));
    batch.forEach((film, resultIndex) => {
      cache[film.filmId] = results[resultIndex];
    });
    if (index % 20 === 0 || index + batch.length >= searchNeeded.length) {
      console.log(
        `Searched ambiguous titles ${Math.min(index + batch.length, searchNeeded.length)}/${searchNeeded.length}`,
      );
      await writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const rawScores = uniqueFilms.map((film) =>
    dimensions.map((dimension) =>
      rawDimensionScore(film, cache[film.filmId], dimension),
    ),
  );
  const normalizedScores = normalizeDimensionScores(rawScores);
  const filmIndex = new Map(
    uniqueFilms.map((film, index) => [film.filmId, index]),
  );
  const matchedCount = uniqueFilms.filter(
    (film) => cache[film.filmId]?.matched,
  ).length;

  const directorMeans = new Map();
  for (const film of uniqueFilms) {
    const index = filmIndex.get(film.filmId);
    if (!cache[film.filmId]?.matched) continue;
    const entries = directorMeans.get(film.director) ?? [];
    entries.push({ vector: normalizedScores[index] });
    directorMeans.set(film.director, entries);
  }
  const globalMean = averageVectors(
    normalizedScores
      .filter((_, index) => cache[uniqueFilms[index].filmId]?.matched)
      .map((vector) => ({ vector })),
    dimensions.length,
  );
  const directorProfiles = new Map(
    [...directorMeans].map(([director, entries]) => [
      director,
      averageVectors(entries, dimensions.length),
    ]),
  );

  normalizedScores.forEach((scores, index) => {
    const fallback = directorProfiles.get(uniqueFilms[index].director) ?? globalMean;
    scores.forEach((value, dimensionIndex) => {
      if (value === null) scores[dimensionIndex] = fallback[dimensionIndex];
    });
  });

  const collectionVideo = new Map(
    Object.values(videos).map((video) => [video.collectionId, video]),
  );
  const pickerRows = new Map();
  for (const film of films) {
    const rows = pickerRows.get(film.picker) ?? [];
    rows.push(film);
    pickerRows.set(film.picker, rows);
  }

  const pickerCount = pickerRows.size;
  const filmPickerFrequency = new Map();
  for (const rows of pickerRows.values()) {
    for (const filmId of new Set(rows.map((film) => film.filmId))) {
      filmPickerFrequency.set(
        filmId,
        (filmPickerFrequency.get(filmId) ?? 0) + 1,
      );
    }
  }
  const filmWeights = new Map(
    [...filmPickerFrequency].map(([filmId, frequency]) => [
      filmId,
      Math.log((pickerCount + 1) / (frequency + 1)) + 1,
    ]),
  );

  const pickerProfiles = [];
  for (const [name, rows] of [...pickerRows].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const uniqueRows = [
      ...new Map(
        rows.map((film) => [
          `${film.collectionId}:${film.filmId}`,
          film,
        ]),
      ).values(),
    ];
    const groupSizes = new Map();
    for (const film of uniqueRows) {
      const key = `${film.collectionId}:${film.pickedAs}`;
      groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
    }
    const entries = [];
    let analyzedWeight = 0;
    let totalWeight = 0;
    for (const film of uniqueRows) {
      const index = filmIndex.get(film.filmId);
      if (index === undefined) continue;
      const groupSize =
        groupSizes.get(`${film.collectionId}:${film.pickedAs}`) ?? 1;
      const groupWeight = Math.min(1, 3 / groupSize);
      const weight = (filmWeights.get(film.filmId) ?? 1) * groupWeight;
      totalWeight += weight;
      if (cache[film.filmId]?.matched) analyzedWeight += weight;
      entries.push({ vector: normalizedScores[index], weight });
    }
    const profile = averageVectors(entries, dimensions.length);
    const collections = [...new Set(uniqueRows.map((film) => film.collectionId))];
    const newestVideo = collections
      .map((collectionId) => collectionVideo.get(collectionId))
      .filter(Boolean)
      .sort((left, right) =>
        (right.publishedOn || right.recordedOn).localeCompare(
          left.publishedOn || left.recordedOn,
        ),
      )[0];
    pickerProfiles.push({
      id: slug(name),
      name,
      image: newestVideo?.pickerImage ?? "",
      collections,
      filmIds: [...new Set(uniqueRows.map((film) => film.filmId))],
      pickCount: new Set(uniqueRows.map((film) => film.filmId)).size,
      profile,
      coverage: totalWeight ? analyzedWeight / totalWeight : 0,
    });
  }

  const positions = pcaPositions(
    pickerProfiles.map((picker) => picker.profile),
  );
  const { assignments, centroids } = kMeans(
    pickerProfiles.map((picker) => picker.profile),
  );
  const clusterNames = centroids.map((centroid) =>
    topIndices(
      centroid.map((value, index) => value - globalMean[index]),
      2,
    )
      .map((index) => dimensions[index].label)
      .join(" + "),
  );

  const filmPositions = pcaPositions3D(normalizedScores);
  const {
    assignments: filmIslandAssignments,
    centroids: filmIslandCentroids,
  } = kMeans(normalizedScores);
  const filmIslandNames = filmIslandCentroids.map((centroid) =>
    topIndices(
      centroid.map((value, index) => value - globalMean[index]),
      2,
    )
      .map((index) => dimensions[index].label)
      .join(" + "),
  );
  const filmIslandCounts = new Array(filmIslandCentroids.length).fill(0);
  filmIslandAssignments.forEach((island) => {
    filmIslandCounts[island] += 1;
  });

  const filmLookup = Object.fromEntries(
    uniqueFilms.map((film, index) => [
      film.filmId,
      {
        director: film.director,
        island: filmIslandAssignments[index],
        title: film.title,
        year: film.year,
        wikipediaUrl: cache[film.filmId]?.url ?? "",
        x: Math.round(filmPositions[index].x * 10_000) / 10_000,
        y: Math.round(filmPositions[index].y * 10_000) / 10_000,
        z: Math.round(filmPositions[index].z * 10_000) / 10_000,
      },
    ]),
  );
  const directorFrequency = new Map();
  const pickerFilmSets = pickerProfiles.map(
    (picker) => new Set(picker.filmIds),
  );
  const pickerDirectorSets = pickerProfiles.map((picker) => {
    const directors = new Set(
      picker.filmIds.map((filmId) => filmLookup[filmId]?.director).filter(Boolean),
    );
    for (const director of directors) {
      directorFrequency.set(
        director,
        (directorFrequency.get(director) ?? 0) + 1,
      );
    }
    return directors;
  });
  const directorWeights = new Map(
    [...directorFrequency].map(([director, frequency]) => [
      director,
      Math.log((pickerCount + 1) / (frequency + 1)) + 1,
    ]),
  );

  const similarities = Array.from({ length: pickerProfiles.length }, () => []);
  for (let left = 0; left < pickerProfiles.length; left += 1) {
    for (let right = left + 1; right < pickerProfiles.length; right += 1) {
      const semantic = euclideanSimilarity(
        pickerProfiles[left].profile,
        pickerProfiles[right].profile,
      );
      const overlap = weightedJaccard(
        pickerFilmSets[left],
        pickerFilmSets[right],
        filmWeights,
      );
      const directors = weightedJaccard(
        pickerDirectorSets[left],
        pickerDirectorSets[right],
        directorWeights,
      );
      const score = 0.6 * semantic + 0.25 * overlap + 0.15 * directors;
      const coverage = Math.sqrt(
        pickerProfiles[left].coverage * pickerProfiles[right].coverage,
      );
      similarities[left].push({ index: right, score, semantic, overlap, directors, coverage });
      similarities[right].push({ index: left, score, semantic, overlap, directors, coverage });
    }
  }

  const matches = {};
  pickerProfiles.forEach((picker, pickerIndex) => {
    matches[picker.id] = similarities[pickerIndex]
      .sort((left, right) => right.score - left.score)
      .slice(0, 12)
      .map((match) => {
        const other = pickerProfiles[match.index];
        const sharedFilmIds = [...pickerFilmSets[pickerIndex]].filter((filmId) =>
          pickerFilmSets[match.index].has(filmId),
        );
        const sharedDirectors = [...pickerDirectorSets[pickerIndex]]
          .filter((director) => pickerDirectorSets[match.index].has(director))
          .sort(
            (left, right) =>
              (directorWeights.get(right) ?? 0) -
              (directorWeights.get(left) ?? 0),
          )
          .slice(0, 4);
        const differences = picker.profile.map((value, dimensionIndex) => ({
          dimensionIndex,
          difference: Math.abs(value - other.profile[dimensionIndex]),
          sharedStrength:
            Math.min(value, other.profile[dimensionIndex]) -
            globalMean[dimensionIndex],
        }));
        return {
          coverage: Math.round(match.coverage * 100),
          directorScore: Math.round(match.directors * 100),
          id: other.id,
          overlapScore: Math.round(match.overlap * 100),
          score: Math.round(match.score * 100),
          semanticScore: Math.round(match.semantic * 100),
          sharedDirectors,
          sharedFilms: sharedFilmIds
            .sort(
              (left, right) =>
                (filmWeights.get(right) ?? 0) - (filmWeights.get(left) ?? 0),
            )
            .slice(0, 5),
          sharedTraits: differences
            .sort((left, right) => right.sharedStrength - left.sharedStrength)
            .slice(0, 4)
            .map(({ dimensionIndex }) => dimensionIndex),
          contrasts: differences
            .sort((left, right) => right.difference - left.difference)
            .slice(0, 3)
            .map(({ dimensionIndex }) => dimensionIndex),
        };
      });
  });

  const edges = [];
  const edgeKeys = new Set();
  pickerProfiles.forEach((picker) => {
    for (const match of matches[picker.id].slice(0, 3)) {
      const key = [picker.id, match.id].sort().join("|");
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({
        source: picker.id,
        target: match.id,
        score: match.score,
      });
    }
  });

  const outputPickers = pickerProfiles.map((picker, index) => {
    const distinctive = picker.profile.map((value, dimensionIndex) => ({
      dimensionIndex,
      value: value - globalMean[dimensionIndex],
    }));
    return {
      ...picker,
      cluster: assignments[index],
      coverage: Math.round(picker.coverage * 100),
      profile: picker.profile.map((value) => Math.round(value * 100)),
      topTraits: distinctive
        .sort((left, right) => right.value - left.value)
        .slice(0, 6)
        .map(({ dimensionIndex }) => dimensionIndex),
      x: Math.round(
        clamp(positions[index].x * 0.94 + 0.03 + (positions[index].jitter - 0.5) * 0.008) *
          10_000,
      ) / 10_000,
      y: Math.round(
        clamp(positions[index].y * 0.9 + 0.05 + (positions[index].jitter - 0.5) * 0.008) *
          10_000,
      ) / 10_000,
    };
  });

  const payload = {
    meta: {
      clusters: clusterNames,
      dimensions: dimensions.map(({ id, label, family }) => ({
        id,
        label,
        family,
      })),
      filmCoverage: Math.round((matchedCount / uniqueFilms.length) * 100),
      filmIslands: filmIslandNames.map((name, island) => {
        const members = filmPositions.filter(
          (_, index) => filmIslandAssignments[index] === island,
        );
        const center = ["x", "y", "z"].map(
          (axis) =>
            members.reduce((sum, point) => sum + point[axis], 0) /
            Math.max(1, members.length),
        );
        return {
          center: center.map((value) => Math.round(value * 10_000) / 10_000),
          count: filmIslandCounts[island],
          name,
          traits: topIndices(
            filmIslandCentroids[island].map(
              (value, index) => value - globalMean[index],
            ),
            3,
          ),
        };
      }),
      generatedOn: new Date().toISOString(),
      method:
        "60% dimension similarity + 25% rarity-weighted exact overlap + 15% director affinity",
      pickerCount: pickerProfiles.length,
      sources: [
        {
          label: "Criterion Closet Picks",
          url: "https://www.criterion.com/closet-picks",
        },
        {
          label: "Wikipedia (CC BY-SA)",
          url: "https://en.wikipedia.org/",
        },
        {
          label: "Wikimedia Terms of Use",
          url: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use",
        },
      ],
      uniqueFilms: uniqueFilms.length,
    },
    edges,
    films: filmLookup,
    matches,
    pickers: outputPickers,
  };

  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Wrote ${OUTPUT_FILE}: ${pickerProfiles.length} picker profiles, ${edges.length} links, ${matchedCount}/${uniqueFilms.length} films matched to Wikipedia.`,
  );
}

await main();
