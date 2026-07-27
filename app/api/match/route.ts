import { NextResponse } from "next/server";
import filmsData from "../../../data/films.json";

type CatalogFilm = {
  director: string;
  filmId: string;
  id: string;
  picker: string;
  slug: string;
  title: string;
  year: number | null;
};

type DreamFilm = {
  id?: string;
  title: string;
  year?: number;
  director?: string;
};

type Profile = {
  name: string;
  films: CatalogFilm[];
  signature: string;
};

const signatures: Record<string, string> = {
  "Agnès Varda": "playful humanism, feminist cinema, new waves, and intimate lives",
  "Alec Baldwin": "classic Hollywood craft, mystery, and studio-era storytelling",
  "Andrew Stanton": "warm humanism, bittersweet comedy, adventure, and outsiders",
  "Christopher Nolan": "formal ambition, fractured identity, time, and American auteurs",
  "Gaspar Noé": "transgression, obsession, bodies, death, and cinematic extremity",
  "Guillermo del Toro": "outsiders, dark fantasy, obsession, tactile worlds, and auteur craft",
  "Jeremy Pope": "Black and queer lives, performance, community, and social history",
  "John Leguizamo": "migration, resistance, race, social justice, and human dignity",
  "Jude Law": "existential suspense, European noir, atmosphere, and moral pressure",
  "Pablo Larraín": "desire, memory, identity, Latin cinema, and romantic ambiguity",
  "Roger Corman": "classic Hollywood, war, crime, spectacle, and maverick filmmaking",
  "Ryusuke Hamaguchi": "psychology, alienation, Japanese masters, patience, and moral ambiguity",
};

const filmTags: Record<string, string[]> = {
  "boyhood": ["coming-of-age", "family", "time", "realism"],
  "lost-highway": ["surreal", "noir", "identity", "psychological"],
  "malcolm-x": ["biography", "politics", "race", "history"],
  "el-norte": ["migration", "politics", "family", "social-realism"],
  "do-the-right-thing": ["race", "community", "politics", "urban"],
  "a-man-escaped": ["resistance", "faith", "minimalism", "war"],
  "y-tu-mama-tambien": ["coming-of-age", "desire", "road-movie", "class"],
  "all-about-my-mother": ["melodrama", "identity", "performance", "chosen-family"],
  "certified-copy": ["romance", "identity", "art", "ambiguity"],
  "local-hero": ["comedy", "community", "environment", "bittersweet"],
  "worst-person": ["romance", "identity", "coming-of-age", "bittersweet"],
  "paper-moon": ["comedy", "road-movie", "family", "classic-hollywood"],
  "brazil": ["dystopia", "satire", "fantasy", "bureaucracy"],
  "night-hunter": ["noir", "gothic", "childhood", "suspense"],
  "stalker": ["philosophy", "science-fiction", "slow-cinema", "spiritual"],
  "purple-noon": ["noir", "desire", "crime", "identity"],
  "wages-of-fear": ["suspense", "survival", "masculinity", "politics"],
  "devil-blue-dress": ["noir", "race", "crime", "history"],
  "paris-burning": ["queer", "community", "performance", "documentary"],
  "one-night-miami": ["race", "history", "performance", "politics"],
  "gunfighter": ["western", "classic-hollywood", "fate", "violence"],
  "war-and-peace": ["epic", "war", "history", "romance"],
  "raging-bull": ["obsession", "masculinity", "biography", "violence"],
  "targets": ["horror", "violence", "hollywood", "modernity"],
  "amarcord": ["memory", "comedy", "coming-of-age", "surreal"],
  "la-promesse": ["social-realism", "morality", "migration", "family"],
  "tiny-furniture": ["comedy", "coming-of-age", "family", "independent"],
  "angel-table": ["biography", "womanhood", "art", "family"],
  "maria-braun": ["melodrama", "womanhood", "history", "politics"],
  "band-outsiders": ["new-wave", "crime", "romance", "playful"],
  "crumb": ["documentary", "art", "outsider", "psychological"],
  "magician": ["gothic", "performance", "faith", "mystery"],
  "400-blows": ["coming-of-age", "new-wave", "childhood", "rebellion"],
  "thin-red-line": ["war", "philosophy", "nature", "spiritual"],
  "la-haine": ["race", "politics", "urban", "youth"],
  "cure": ["psychological", "horror", "crime", "identity"],
  "late-spring": ["family", "tradition", "slow-cinema", "bittersweet"],
  "my-darling-clementine": ["western", "classic-hollywood", "community", "myth"],
  "mishima": ["biography", "art", "obsession", "identity"],
  "salo": ["transgressive", "politics", "violence", "power"],
};

function buildProfiles(): Profile[] {
  const byPicker = new Map<string, Map<string, CatalogFilm>>();

  for (const film of filmsData as unknown as CatalogFilm[]) {
    const pickerFilms =
      byPicker.get(film.picker) ?? new Map<string, CatalogFilm>();
    pickerFilms.set(film.filmId, film);
    byPicker.set(film.picker, pickerFilms);
  }

  return [...byPicker.entries()].map(([name, filmMap]) => ({
    name,
    films: [...filmMap.values()],
    signature: signatures[name] ?? "wide-ranging international and auteur cinema",
  }));
}

function filmDescription(film: DreamFilm | CatalogFilm) {
  const year = film.year ? ` (${film.year})` : "";
  const director = film.director ? `, directed by ${film.director}` : "";
  return `${film.title}${year}${director}`;
}

function profileDescription(profile: Profile) {
  return [
    `${profile.name}'s Criterion Closet taste: ${profile.signature}.`,
    `Selected films: ${profile.films.map(filmDescription).join("; ")}.`,
  ].join(" ");
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] ** 2;
    normB += b[index] ** 2;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function intersection<T>(left: Set<T>, right: Set<T>) {
  return [...left].filter((value) => right.has(value));
}

function overlapSignals(dream: DreamFilm[], profile: Profile) {
  const dreamTitles = new Set(dream.map((film) => film.title.toLowerCase()));
  const dreamDirectors = new Set(
    dream
      .map((film) => film.director)
      .filter((director): director is string => Boolean(director)),
  );
  const profileDirectors = new Set(profile.films.map((film) => film.director));
  const exactTitles = profile.films
    .filter((film) => dreamTitles.has(film.title.toLowerCase()))
    .map((film) => film.title);
  const sharedDirectors = intersection(dreamDirectors, profileDirectors);
  const dreamTags = new Set(
    dream.flatMap((film) => (film.id ? (filmTags[film.id] ?? []) : [])),
  );
  const profileTags = new Set(
    profile.films.flatMap((film) => filmTags[film.slug] ?? []),
  );
  const sharedTags = intersection(dreamTags, profileTags).slice(0, 4);

  const signals: string[] = [];
  if (exactTitles.length) signals.push(`You both chose ${exactTitles.join(", ")}`);
  if (sharedDirectors.length) {
    signals.push(`Shared director pull: ${sharedDirectors.join(", ")}`);
  }
  if (sharedTags.length) signals.push(`Shared currents: ${sharedTags.join(", ")}`);
  if (!signals.length) signals.push(`Closest overall to ${profile.signature}`);
  return signals.slice(0, 2);
}

function normalizeScores(
  scored: { profile: Profile; rawScore: number }[],
  floor: number,
) {
  const values = scored.map(({ rawScore }) => rawScore);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  return scored
    .map(({ profile, rawScore }) => ({
      profile,
      score:
        maximum === minimum
          ? floor
          : Math.round(floor + (95 - floor) * ((rawScore - minimum) / (maximum - minimum))),
    }))
    .sort((a, b) => b.score - a.score);
}

function metadataMatches(dream: DreamFilm[], profiles: Profile[]) {
  const dreamIds = new Set(dream.map((film) => film.id).filter(Boolean));
  const dreamDirectors = new Set(dream.map((film) => film.director).filter(Boolean));
  const dreamDecades = new Set(
    dream.map((film) => film.year && Math.floor(film.year / 10) * 10).filter(Boolean),
  );
  const dreamTags = new Set(
    dream.flatMap((film) => (film.id ? (filmTags[film.id] ?? []) : [])),
  );

  const scored = profiles.map((profile) => {
    const profileIds = new Set(profile.films.map((film) => film.slug));
    const profileDirectors = new Set(profile.films.map((film) => film.director));
    const profileDecades = new Set(
      profile.films
        .map((film) => film.year && Math.floor(film.year / 10) * 10)
        .filter(Boolean),
    );
    const profileTags = new Set(
      profile.films.flatMap((film) => filmTags[film.slug] ?? []),
    );
    const exact = intersection(dreamIds, profileIds).length;
    const directors = intersection(dreamDirectors, profileDirectors).length;
    const decades = intersection(dreamDecades, profileDecades).length;
    const tags = intersection(dreamTags, profileTags).length;
    const tagScale = Math.max(1, Math.sqrt(dreamTags.size * profileTags.size));

    return {
      profile,
      rawScore: exact * 4 + directors * 2 + decades * 0.2 + (tags / tagScale) * 5,
    };
  });

  return normalizeScores(scored, 48).slice(0, 3).map(({ profile, score }) => ({
    name: profile.name,
    score,
    signature: profile.signature,
    signals: overlapSignals(dream, profile),
    pickCount: profile.films.length,
  }));
}

async function embeddingMatches(
  dream: DreamFilm[],
  profiles: Profile[],
  apiKey: string,
) {
  const input = [
    `My dream Criterion collection: ${dream.map(filmDescription).join("; ")}.`,
    ...profiles.map(profileDescription),
  ];
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
      encoding_format: "float",
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error("Embedding request failed");

  const payload = (await response.json()) as {
    data: { index: number; embedding: number[] }[];
  };
  const vectors = [...payload.data]
    .sort((a, b) => a.index - b.index)
    .map(({ embedding }) => embedding);
  const dreamVector = vectors[0];
  const scored = profiles.map((profile, index) => ({
    profile,
    rawScore: cosineSimilarity(dreamVector, vectors[index + 1]),
  }));

  return normalizeScores(scored, 64).slice(0, 3).map(({ profile, score }) => ({
    name: profile.name,
    score,
    signature: profile.signature,
    signals: overlapSignals(dream, profile),
    pickCount: profile.films.length,
  }));
}

export async function POST(request: Request) {
  let body: { films?: DreamFilm[] };

  try {
    body = (await request.json()) as { films?: DreamFilm[] };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const dream = (body.films ?? [])
    .filter((film) => typeof film?.title === "string" && film.title.trim())
    .slice(0, 20)
    .map((film) => ({
      id: film.id?.slice(0, 80),
      title: film.title.trim().slice(0, 160),
      year: typeof film.year === "number" ? film.year : undefined,
      director: film.director?.trim().slice(0, 120),
    }));

  if (dream.length < 3) {
    return NextResponse.json(
      { error: "Add at least three films to find a meaningful match." },
      { status: 400 },
    );
  }

  const profiles = buildProfiles();
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (apiKey) {
    try {
      const matches = await embeddingMatches(dream, profiles, apiKey);
      return NextResponse.json({
        method: "openai-embeddings",
        matches,
        note: "Compared with OpenAI text embeddings across every indexed visitor profile.",
      });
    } catch {
      // A live result is more useful than failing the builder when the API is unavailable.
    }
  }

  return NextResponse.json({
    method: "metadata-fallback",
    matches: metadataMatches(dream, profiles),
    note: apiKey
      ? "Embeddings were temporarily unavailable, so this result uses film, director, decade, and theme overlap."
      : "Preview match using film, director, decade, and theme overlap. Add OPENAI_API_KEY to activate embeddings.",
  });
}
