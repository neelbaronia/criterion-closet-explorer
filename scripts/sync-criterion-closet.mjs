import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".cache", "criterion");
const DATA_DIR = path.join(ROOT, "data");
const READER_URL = "https://r.jina.ai/";
const YOUTUBE_FEED_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCAP57cF-FSjJKzzXg7ntPlQ";
const YOUTUBE_CHANNEL_URL =
  "https://www.youtube.com/@criterioncollection/videos";
const REQUEST_HEADERS = {
  "User-Agent":
    "CriterionClosetExplorer/0.1 (+https://github.com/neelbaronia/criterion-closet-explorer)",
};
const refresh = process.argv.includes("--refresh");
const refreshIndexes = refresh || process.argv.includes("--indexes");

const monthNumbers = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    lt: "<",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    quot: '"',
    rsquo: "’",
    lsquo: "‘",
  };

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name] ?? entity);
}

function cleanHtml(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’‘]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

function pickerFromTitle(title) {
  return title
    .replace(/(?:[’']s|s[’'])\s+Closet Picks.*$/u, "")
    .trim();
}

function youtubeUrl(value) {
  return /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(
    value ?? "",
  )
    ? value
    : "";
}

function youtubeVideoId(value) {
  return (
    value?.match(/[?&]v=([^&]+)/)?.[1] ??
    value?.match(/youtu\.be\/([^?]+)/)?.[1] ??
    ""
  );
}

function isoDate(month, day, year) {
  return `${year}-${monthNumbers[month]}-${String(day).padStart(2, "0")}`;
}

function cachePath(kind, id, extension) {
  return path.join(CACHE_DIR, `${kind}-${id}.${extension}`);
}

function isReaderChallenge(text) {
  return (
    /<title>Just a moment\.\.\.<\/title>/i.test(text) ||
    /Enable JavaScript and cookies to continue/i.test(text) ||
    /challenge-platform\/[^"']*orchestrate\/chl_/i.test(text)
  );
}

async function fetchWithRetry(
  url,
  format,
  attempts = 5,
  validate = () => true,
) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${READER_URL}${url}`, {
        headers: format === "html" ? { "X-Return-Format": "html" } : {},
        signal: AbortSignal.timeout(90_000),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text.trim()) throw new Error("empty response");
      const readerError = text.match(
        /^Warning: Target URL returned error (\d{3}):/m,
      );
      if (readerError) {
        throw new Error(`reader target returned ${readerError[1]}`);
      }
      if (isReaderChallenge(text)) {
        throw new Error("reader returned an anti-bot challenge");
      }
      if (!validate(text)) {
        throw new Error("reader response failed content validation");
      }
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const message = String(error);
        const delay = message.includes("429")
          ? attempt * 10_000
          : message.includes("anti-bot") || message.includes("validation")
            ? attempt * 5_000
            : attempt * 1_000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Could not fetch ${url}: ${lastError}`);
}

async function fetchDirectWithRetry(url, attempts = 5) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      if (!text.trim()) throw new Error("empty response");
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const delay = String(error).includes("429")
          ? attempt * 10_000
          : attempt * 1_000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Could not fetch ${url}: ${lastError}`);
}

async function cachedBoxsetFetch(id, url) {
  if (!refresh) {
    for (const extension of ["html", "md"]) {
      try {
        return await readFile(cachePath("boxset", id, extension), "utf8");
      } catch {
        // Try the other cache format or fetch a fresh document.
      }
    }
  }

  const text = await fetchWithRetry(url, "markdown");
  await writeFile(cachePath("boxset", id, "md"), text);
  return text;
}

async function cachedJson(kind, id, url, force = refresh) {
  const filename = cachePath(kind, id, "json");
  let cachedPayload;
  try {
    cachedPayload = JSON.parse(await readFile(filename, "utf8"));
    if (!force) return cachedPayload;
  } catch {
    // Cache miss.
  }

  try {
    const payload = JSON.parse(await fetchDirectWithRetry(url));
    await writeFile(filename, `${JSON.stringify(payload, null, 2)}\n`);
    return payload;
  } catch (error) {
    if (cachedPayload !== undefined) {
      console.warn(`Could not refresh ${url}; using cached JSON: ${error}`);
      return cachedPayload;
    }
    throw error;
  }
}

async function cachedDirectFetch(
  kind,
  id,
  url,
  force = refresh,
  extension = "xml",
) {
  const filename = cachePath(kind, id, extension);
  let cachedText;

  try {
    cachedText = await readFile(filename, "utf8");
    if (!force) return cachedText;
  } catch {
    // Cache miss.
  }

  try {
    const text = await fetchDirectWithRetry(url);
    await writeFile(filename, text);
    return text;
  } catch (error) {
    if (cachedText) {
      console.warn(`Could not refresh ${url}; using cached response: ${error}`);
      return cachedText;
    }
    throw error;
  }
}

async function cachedFetch(
  kind,
  id,
  url,
  format = "markdown",
  force = refresh,
  validate = () => true,
) {
  const extension = format === "html" ? "html" : "md";
  const filename = cachePath(kind, id, extension);
  let cachedText;

  try {
    cachedText = await readFile(filename, "utf8");
    if (!force && validate(cachedText) && !isReaderChallenge(cachedText)) {
      return cachedText;
    }
  } catch {
    // Cache miss.
  }

  try {
    const text = await fetchWithRetry(url, format, 5, validate);
    await writeFile(filename, text);
    return text;
  } catch (error) {
    if (
      cachedText &&
      validate(cachedText) &&
      !isReaderChallenge(cachedText)
    ) {
      console.warn(`Could not refresh ${url}; using cached page: ${error}`);
      return cachedText;
    }
    throw error;
  }
}

async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

function parseArchive(markdown) {
  const visits = [];
  const linePattern =
    /^!\[Image \d+\]\(([^)]+)\)(.+?)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/gm;

  for (const match of markdown.matchAll(linePattern)) {
    const [, image, rawTitle, month, day, year] = match;
    const title = rawTitle.trim();
    visits.push({
      image,
      picker: pickerFromTitle(title),
      recordedOn: isoDate(month, day, year),
      title,
    });
  }

  return visits;
}

function parseCollectionUrls(markdown) {
  return [
    ...new Set(
      markdown.match(
        /https:\/\/www\.criterion\.com\/shop\/collection\/\d+-[^)\s]+/g,
      ) ?? [],
    ),
  ].sort((a, b) => {
    const aId = Number(a.match(/collection\/(\d+)/)?.[1] ?? 0);
    const bId = Number(b.match(/collection\/(\d+)/)?.[1] ?? 0);
    return bId - aId;
  });
}

function parseGuestVisits(payload) {
  const collectionUrls = [];
  const visitsByCollection = new Map();

  for (const guest of payload.data ?? []) {
    const visits = guest.visits?.length ? guest.visits : [guest];
    for (const visit of visits) {
      if (!visit.criterion_page_url) continue;
      const collectionId = visit.criterion_page_url.match(
        /collection\/(\d+)/,
      )?.[1];
      if (!collectionId) continue;
      collectionUrls.push(visit.criterion_page_url);
      visitsByCollection.set(collectionId, {
        publishedOn: visit.episode_date ?? "",
        url: youtubeUrl(visit.youtube_video_url),
      });
    }
  }

  return { collectionUrls, visitsByCollection };
}

function parseTrackedVisits(videos) {
  const collectionUrls = [];
  const visitsByCollection = new Map();

  for (const video of Object.values(videos)) {
    if (!video.criterionUrl || !video.collectionId) continue;
    collectionUrls.push(video.criterionUrl);
    visitsByCollection.set(video.collectionId, {
      publishedOn: video.publishedOn ?? "",
      url: video.url ?? "",
    });
  }

  return { collectionUrls, visitsByCollection };
}

function parseYoutubeClosetFeed(xml) {
  const episodes = [];

  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1];
    const title = decodeHtml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const url = decodeHtml(
      entry.match(/<link rel="alternate" href="([^"]+)"\s*\/?\s*>/)?.[1] ??
        "",
    );
    const publishedOn =
      entry.match(/<published>(\d{4}-\d{2}-\d{2})T/)?.[1] ?? "";
    const picker = pickerFromTitle(title);

    if (!youtubeUrl(url) || !publishedOn || picker === title) continue;
    episodes.push({ picker, publishedOn, title, url });
  }

  return episodes;
}

function extractAssignedJson(document, marker) {
  const markerIndex = document.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const objectStart = document.indexOf("{", markerIndex + marker.length);
  if (objectStart < 0) return undefined;

  let depth = 0;
  let escaped = false;
  let inString = false;
  for (let index = objectStart; index < document.length; index += 1) {
    const character = document[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(document.slice(objectStart, index + 1));
        } catch {
          return undefined;
        }
      }
    }
  }

  return undefined;
}

function parseYoutubeChannelPage(html) {
  const initialData =
    extractAssignedJson(html, "var ytInitialData =") ??
    extractAssignedJson(html, "window[\"ytInitialData\"] =");
  if (!initialData) return [];

  const episodesByVideoId = new Map();
  function addEpisode(videoId, title) {
    const cleanTitle = decodeHtml(title ?? "").replace(/\s+/g, " ").trim();
    const picker = pickerFromTitle(cleanTitle);
    if (!videoId || !cleanTitle || picker === cleanTitle) return;
    episodesByVideoId.set(videoId, {
      picker,
      publishedOn: "",
      title: cleanTitle,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }

  function visit(value) {
    if (!value || typeof value !== "object") return;
    const lockup = value.lockupViewModel;
    if (lockup?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
      addEpisode(
        lockup.contentId,
        lockup.metadata?.lockupMetadataViewModel?.title?.content,
      );
    }
    const video = value.videoRenderer;
    if (video) {
      addEpisode(
        video.videoId,
        video.title?.runs?.map((run) => run.text).join("") ??
          video.title?.simpleText,
      );
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(initialData);

  return [...episodesByVideoId.values()];
}

function parseYoutubePublishedOn(html) {
  return (
    html.match(/"(?:publishDate|uploadDate)":"(\d{4}-\d{2}-\d{2})/)?.[1] ??
    html.match(
      /itemprop="datePublished"\s+content="(\d{4}-\d{2}-\d{2})/,
    )?.[1] ??
    ""
  );
}

function mergeYoutubeEpisodes(...episodeGroups) {
  const episodesByKey = new Map();
  for (const episode of episodeGroups.flat()) {
    const key = youtubeVideoId(episode.url) || normalize(episode.title);
    if (!key) continue;
    const previous = episodesByKey.get(key);
    episodesByKey.set(key, {
      ...previous,
      ...episode,
      publishedOn: episode.publishedOn || previous?.publishedOn || "",
    });
  }
  return [...episodesByKey.values()];
}

function mergeCollectionUrls(...urlGroups) {
  const urlsByCollectionId = new Map();

  for (const url of urlGroups.flat()) {
    const collectionId = url.match(/collection\/(\d+)/)?.[1];
    if (collectionId && !urlsByCollectionId.has(collectionId)) {
      urlsByCollectionId.set(collectionId, url);
    }
  }

  return [...urlsByCollectionId.values()].sort((a, b) => {
    const aId = Number(a.match(/collection\/(\d+)/)?.[1] ?? 0);
    const bId = Number(b.match(/collection\/(\d+)/)?.[1] ?? 0);
    return bId - aId;
  });
}

function youtubeEpisodeForCollection(collection, episodes) {
  const collectionTitle = normalize(collection.title);
  return episodes.find(
    (episode) => normalize(episode.title) === collectionTitle,
  );
}

function findPendingYoutubeEpisodes(episodes, trackedVideos, guestMetadata) {
  const knownVideoIds = new Set([
    ...Object.values(trackedVideos).map((video) => youtubeVideoId(video.url)),
    ...[...guestMetadata.visitsByCollection.values()].map((visit) =>
      youtubeVideoId(visit.url),
    ),
  ]);
  const knownTitles = new Set(
    Object.values(trackedVideos).flatMap((video) => [
      normalize(video.title ?? ""),
      normalize(video.picker ?? ""),
    ]),
  );

  return episodes.filter((episode) => {
    const videoId = youtubeVideoId(episode.url);
    return (
      (!videoId || !knownVideoIds.has(videoId)) &&
      !knownTitles.has(normalize(episode.title)) &&
      !knownTitles.has(normalize(episode.picker))
    );
  });
}

function collectionSlug(title) {
  return normalize(title).replace(/\s+/g, "-");
}

async function discoverCollectionUrl(episode, candidateIds) {
  for (const collectionId of candidateIds) {
    const url = `https://www.criterion.com/shop/collection/${collectionId}-${collectionSlug(episode.title)}`;
    try {
      const document = await fetchWithRetry(url, "html", 1);
      const collection = parseCollectionDocument(document, url);
      if (
        collection.selections.length > 0 &&
        (normalize(collection.title) === normalize(episode.title) ||
          normalize(collection.picker) === normalize(episode.picker))
      ) {
        await writeFile(cachePath("collection", collectionId, "html"), document);
        return url;
      }
    } catch {
      // The guessed collection ID is not this episode; try the next one.
    }
  }

  return "";
}

function parseBrowseFilms(html) {
  const films = new Map();
  const rowPattern =
    /<tr class="gridFilm"[^>]*data-href="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g;

  for (const match of html.matchAll(rowPattern)) {
    const [, url, row] = match;
    const poster = row.match(/<img[^>]+src="([^"]+)"[^>]*>/)?.[1] ?? "";
    const title = cleanHtml(
      row.match(/<td class="g-title">([\s\S]*?)<\/td>/)?.[1] ?? "",
    );
    const director = cleanHtml(
      row.match(/<td class="g-director">([\s\S]*?)<\/td>/)?.[1] ?? "",
    );
    const yearText = cleanHtml(
      row.match(/<td class="g-year">([\s\S]*?)<\/td>/)?.[1] ?? "",
    );
    const parsedYear = Number(yearText);
    const year = parsedYear >= 1800 ? parsedYear : null;

    if (!title) continue;
    films.set(url, {
      criterionUrl: url,
      director: director || "Director unavailable",
      filmId: url.match(/\/films\/(\d+)/)?.[1] ?? normalize(title),
      poster: poster.replace("_thumbnail.", "_small."),
      slug: url.replace(/^.*\/films\/\d+-/, ""),
      title,
      year,
    });
  }

  return films;
}

function trackedFilmCatalog(filmPicks) {
  const films = new Map();
  for (const film of filmPicks) {
    if (!film.criterionUrl || films.has(film.criterionUrl)) continue;
    films.set(film.criterionUrl, {
      criterionUrl: film.criterionUrl,
      director: film.director,
      filmId: film.filmId,
      poster: film.poster,
      slug: film.slug,
      title: film.title,
      year: film.year,
    });
  }
  return films;
}

function parseCollection(markdown, url) {
  const collectionId = url.match(/collection\/(\d+)/)?.[1];
  const title =
    markdown.match(/^Title: (.+)$/m)?.[1]?.trim() ??
    markdown.match(/^# (.+)$/m)?.[1]?.trim() ??
    `Closet Picks ${collectionId}`;
  const selections = [];
  const seen = new Set();
  const itemPattern =
    /!\[Image \d+: ([^\]]+)\]\((https?[^)]+)\)[^\n]*?\]\((https:\/\/www\.criterion\.com\/(films|boxsets)\/[^)\s]+)\)/g;

  for (const match of markdown.matchAll(itemPattern)) {
    const [, titleAlt, poster, productUrl, type] = match;
    if (seen.has(productUrl)) continue;
    seen.add(productUrl);
    selections.push({ poster, productUrl, title: titleAlt, type });
  }

  const videoMatch = markdown.match(
    /https:\/\/(?:vimeo\.com\/[^)\s]+|(?:www\.)?youtube\.com\/watch\?v=[^)&\s]+)/,
  )?.[0];
  let videoUrl = videoMatch;
  if (videoMatch?.includes("vimeo.com")) {
    const videoId = videoMatch.match(/(\d{6,})\/?$/)?.[1];
    if (videoId) videoUrl = `https://vimeo.com/${videoId}`;
  }

  return {
    collectionId,
    picker: pickerFromTitle(title),
    selections,
    sourceUrl: url,
    title,
    videoUrl,
  };
}

function parseCollectionHtml(html, url) {
  const collectionId = url.match(/collection\/(\d+)/)?.[1];
  const title = cleanHtml(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ??
      html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.split("|")[0] ??
      `Closet Picks ${collectionId}`,
  );
  const selections = [];
  const seen = new Set();
  const itemPattern = /<div class="filmWrap">([\s\S]*?)<\/li>/g;

  for (const match of html.matchAll(itemPattern)) {
    const item = match[1];
    const productUrl = item.match(
      /href="(https:\/\/www\.criterion\.com\/(films|boxsets)\/[^"]+)"/,
    )?.[1];
    if (!productUrl || seen.has(productUrl)) continue;
    const type = productUrl.includes("/boxsets/") ? "boxsets" : "films";
    const image = item.match(/<img[^>]+src="([^"]+)"[^>]*>/)?.[1] ?? "";
    const titleAlt =
      cleanHtml(item.match(/<dt>([\s\S]*?)<\/dt>/)?.[1] ?? "") ||
      cleanHtml(item.match(/alt="([^"]+)"/)?.[1] ?? "");
    seen.add(productUrl);
    selections.push({
      poster: decodeHtml(image),
      productUrl,
      title: titleAlt,
      type,
    });
  }

  const videoMatch = html.match(
    /https:\/\/(?:vimeo\.com\/[^"'<\s]+|(?:www\.)?youtube\.com\/watch\?v=[^"&'<\s]+)/,
  )?.[0];
  let videoUrl = decodeHtml(videoMatch ?? "");
  if (videoUrl.includes("vimeo.com")) {
    const videoId = videoUrl.match(/(\d{6,})\/?$/)?.[1];
    if (videoId) videoUrl = `https://vimeo.com/${videoId}`;
  }

  return {
    collectionId,
    picker: pickerFromTitle(title),
    selections,
    sourceUrl: url,
    title,
    videoUrl: videoUrl || undefined,
  };
}

function parseCollectionDocument(document, url) {
  return document.includes("<html")
    ? parseCollectionHtml(document, url)
    : parseCollection(document, url);
}

function parseBoxsetFilmUrls(document) {
  const productSection = document.includes("<html")
    ? document
    : document.split(/\nSpecial Features\b/i)[0];
  return [
    ...new Set(
      productSection.match(
        /https:\/\/www\.criterion\.com\/films\/\d+-[^)"'<\s]+/g,
      ) ?? [],
    ),
  ];
}

function matchVisits(collections, visits) {
  const unused = new Set(visits.map((_, index) => index));

  return collections.map((collection) => {
    const exactIndex = visits.findIndex(
      (visit, index) =>
        unused.has(index) && normalize(visit.title) === normalize(collection.title),
    );
    let matchIndex = exactIndex;

    if (matchIndex < 0) {
      const pickerKey = normalize(collection.picker);
      matchIndex = visits.findIndex(
        (visit, index) =>
          unused.has(index) && normalize(visit.picker) === pickerKey,
      );
    }

    if (matchIndex >= 0) {
      unused.delete(matchIndex);
      return { ...collection, visit: visits[matchIndex] };
    }

    return { ...collection, visit: undefined };
  });
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });
  const incremental = refreshIndexes && !refresh;

  const [trackedVideos, trackedFilmPicks, trackedStats] = await Promise.all([
    readFile(path.join(DATA_DIR, "closet-videos.json"), "utf8").then(
      JSON.parse,
    ),
    readFile(path.join(DATA_DIR, "films.json"), "utf8").then(JSON.parse),
    readFile(path.join(DATA_DIR, "archive-stats.json"), "utf8").then(
      JSON.parse,
    ),
  ]);

  console.log("Fetching official archive indexes...");
  const [
    indexMarkdown,
    searchMarkdown,
    browseHtml,
    youtubeFeedXml,
    youtubeChannelHtml,
  ] =
    await Promise.all([
      cachedFetch(
        "index",
        "closet-picks",
        "https://www.criterion.com/closet-picks",
        "markdown",
        refreshIndexes,
      ).catch((error) => {
        console.warn(
          `Criterion's featured Closet index was unavailable; continuing with verified and feed-discovered collection URLs: ${error}`,
        );
        return "";
      }),
      cachedFetch(
        "search",
        "closet-picks",
        "https://www.criterion.com/closet-picks/search",
        "markdown",
        refreshIndexes,
      ),
      cachedFetch(
        "browse",
        "all-films",
        "https://www.criterion.com/shop/browse/list",
        "html",
        refreshIndexes,
        (document) => parseBrowseFilms(document).size > 0,
      ).catch((error) => {
        console.warn(
          `Criterion's full film index was unavailable; using verified film metadata already in the archive: ${error}`,
        );
        return "";
      }),
      cachedDirectFetch(
        "youtube",
        "criterion-feed",
        YOUTUBE_FEED_URL,
        refreshIndexes,
      ).catch((error) => {
        console.warn(
          `YouTube's RSS feed was unavailable; continuing with the channel page and verified metadata: ${error}`,
        );
        return "";
      }),
      cachedDirectFetch(
        "youtube",
        "criterion-channel",
        YOUTUBE_CHANNEL_URL,
        refreshIndexes,
        "html",
      ).catch((error) => {
        console.warn(
          `YouTube's channel page was unavailable; continuing with Criterion and verified metadata: ${error}`,
        );
        return "";
      }),
    ]);

  const visits = parseArchive(searchMarkdown);
  let youtubeEpisodes = mergeYoutubeEpisodes(
    parseYoutubeChannelPage(youtubeChannelHtml),
    parseYoutubeClosetFeed(youtubeFeedXml),
  );
  const trackedMetadata = parseTrackedVisits(trackedVideos);
  let guestMetadata;
  try {
    const guestExport = await cachedJson(
      "community",
      "guests",
      "https://closetpicks.westenb.org/exports/guests.json",
      refreshIndexes,
    );
    guestMetadata = parseGuestVisits(guestExport);
  } catch (error) {
    console.warn(
      `Community video metadata was unavailable; using the last verified snapshot: ${error}`,
    );
    guestMetadata = parseTrackedVisits(trackedVideos);
  }
  const trackedCollectionIds = new Set(Object.keys(trackedVideos));
  let collectionUrls = mergeCollectionUrls(
    incremental ? trackedMetadata.collectionUrls : [],
    parseCollectionUrls(indexMarkdown),
    guestMetadata.collectionUrls,
  );
  let pendingYoutubeEpisodes = findPendingYoutubeEpisodes(
    youtubeEpisodes,
    trackedVideos,
    guestMetadata,
  );
  pendingYoutubeEpisodes = await mapLimit(
    pendingYoutubeEpisodes,
    4,
    async (episode) => {
      if (episode.publishedOn) return episode;
      const videoId = youtubeVideoId(episode.url);
      if (!videoId) return episode;
      try {
        const videoPage = await cachedDirectFetch(
          "youtube-video",
          videoId,
          episode.url,
          refreshIndexes,
          "html",
        );
        return {
          ...episode,
          publishedOn: parseYoutubePublishedOn(videoPage),
        };
      } catch (error) {
        console.warn(
          `Could not resolve the release date for ${episode.title}: ${error}`,
        );
        return episode;
      }
    },
  );
  youtubeEpisodes = mergeYoutubeEpisodes(
    youtubeEpisodes,
    pendingYoutubeEpisodes,
  );
  const maxTrackedCollectionId = Math.max(
    0,
    ...[...trackedCollectionIds].map(Number),
  );
  const candidateIds = Array.from(
    { length: 16 },
    (_, index) => maxTrackedCollectionId + index + 1,
  );

  for (const episode of pendingYoutubeEpisodes) {
    const expectedSlug = collectionSlug(episode.title);
    const alreadyDiscovered = collectionUrls.some((url) =>
      url.endsWith(`-${expectedSlug}`),
    );
    if (alreadyDiscovered) continue;
    const discoveredUrl = await discoverCollectionUrl(episode, candidateIds);
    if (discoveredUrl) {
      collectionUrls = mergeCollectionUrls(collectionUrls, [discoveredUrl]);
    }
  }

  const collectionUrlsToFetch = incremental
    ? collectionUrls.filter((url) => {
        const collectionId = url.match(/collection\/(\d+)/)?.[1];
        return collectionId && !trackedCollectionIds.has(collectionId);
      })
    : collectionUrls;
  const liveBrowseFilms = parseBrowseFilms(browseHtml);
  const browseFilms = trackedFilmCatalog(trackedFilmPicks);
  for (const [url, metadata] of liveBrowseFilms) {
    browseFilms.set(url, metadata);
  }

  console.log(
    `Found ${visits.length} visits, ${collectionUrls.length} collections (${collectionUrlsToFetch.length} to fetch), ${youtubeEpisodes.length} recent YouTube episodes, ${liveBrowseFilms.size} live Criterion film records, and ${browseFilms.size} usable film records.`,
  );

  const collections = await mapLimit(
    collectionUrlsToFetch,
    8,
    async (url, index) => {
      const id = url.match(/collection\/(\d+)/)?.[1];
      const document = await cachedFetch(
        "collection",
        id,
        url,
        "html",
        refreshIndexes,
        (candidate) => {
          const parsed = parseCollectionDocument(candidate, url);
          return Boolean(parsed.collectionId && parsed.selections.length);
        },
      );
      if (
        (index + 1) % 20 === 0 ||
        index + 1 === collectionUrlsToFetch.length
      ) {
        console.log(
          `Fetched ${index + 1}/${collectionUrlsToFetch.length} collections`,
        );
      }
      return parseCollectionDocument(document, url);
    },
  );

  const invalidCollections = collections.filter(
    (collection) => !collection.collectionId || collection.selections.length === 0,
  );
  if (invalidCollections.length) {
    throw new Error(
      `Could not parse complete metadata for collection(s): ${invalidCollections
        .map((collection) => collection.sourceUrl)
        .join(", ")}`,
    );
  }

  const matchedCollections = matchVisits(collections, visits);
  const unresolvedYoutubeEpisodes = pendingYoutubeEpisodes.filter(
    (episode) =>
      !collections.some(
        (collection) =>
          youtubeEpisodeForCollection(collection, [episode]) !== undefined,
      ),
  );
  if (unresolvedYoutubeEpisodes.length) {
    console.warn(
      `Waiting for Criterion to publish collection metadata for: ${unresolvedYoutubeEpisodes
        .map((episode) => episode.title)
        .join(", ")}. The next scheduled refresh will try again.`,
    );
  }
  const boxsetUrls = [
    ...new Set(
      collections.flatMap((collection) =>
        collection.selections
          .filter((selection) => selection.type === "boxsets")
          .map((selection) => selection.productUrl),
      ),
    ),
  ];

  console.log(`Expanding ${boxsetUrls.length} selected box sets...`);
  const boxsets = new Map(
    await mapLimit(boxsetUrls, 2, async (url, index) => {
      const id = url.match(/boxsets\/(\d+)/)?.[1];
      const document = await cachedBoxsetFetch(id, url);
      if ((index + 1) % 20 === 0 || index + 1 === boxsetUrls.length) {
        console.log(`Fetched ${index + 1}/${boxsetUrls.length} box sets`);
      }
      return [url, parseBoxsetFilmUrls(document)];
    }),
  );

  const closetVideos = incremental ? { ...trackedVideos } : {};
  const filmPicks = incremental ? [...trackedFilmPicks] : [];
  const missingFilms = new Set();
  let expandedBoxsetFilms = incremental
    ? trackedStats.expandedBoxsetFilms
    : 0;

  if (incremental) {
    for (const [collectionId, previous] of Object.entries(closetVideos)) {
      const published = guestMetadata.visitsByCollection.get(
        collectionId,
      );
      const youtubeEpisode = youtubeEpisodeForCollection(
        previous,
        youtubeEpisodes,
      );
      closetVideos[collectionId] = {
        ...previous,
        publishedOn:
          youtubeEpisode?.publishedOn ||
          published?.publishedOn ||
          previous.publishedOn,
        url:
          youtubeUrl(youtubeEpisode?.url) ||
          youtubeUrl(published?.url) ||
          youtubeUrl(previous.url) ||
          previous.criterionUrl,
      };
    }
  }

  const videoPublishedDates = new Map();
  const collectionsNeedingVideoDates = matchedCollections.filter(
    (collection) =>
      !guestMetadata.visitsByCollection.get(collection.collectionId)
        ?.publishedOn && collection.videoUrl?.includes("vimeo.com"),
  );
  await mapLimit(collectionsNeedingVideoDates, 4, async (collection) => {
    const videoId = collection.videoUrl.match(/vimeo\.com\/(\d+)/)?.[1];
    if (!videoId) return;
    try {
      const metadata = await cachedJson(
        "vimeo",
        videoId,
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(collection.videoUrl)}`,
      );
      const publishedOn = metadata.upload_date?.slice(0, 10);
      if (publishedOn) {
        videoPublishedDates.set(collection.collectionId, publishedOn);
      }
    } catch (error) {
      console.warn(
        `Could not resolve the Vimeo release date for collection ${collection.collectionId}: ${error}`,
      );
    }
  });

  for (const collection of matchedCollections) {
    const visit = collection.visit;
    const published = guestMetadata.visitsByCollection.get(
      collection.collectionId,
    );
    const youtubeEpisode = youtubeEpisodeForCollection(
      collection,
      youtubeEpisodes,
    );
    closetVideos[collection.collectionId] = {
      collectionId: collection.collectionId,
      criterionUrl: collection.sourceUrl,
      picker: collection.picker,
      pickerImage: visit?.image ?? "",
      publishedOn:
        youtubeEpisode?.publishedOn ||
        published?.publishedOn ||
        videoPublishedDates.get(collection.collectionId) ||
        visit?.recordedOn ||
        "",
      recordedOn: visit?.recordedOn ?? "",
      title: collection.title,
      url:
        youtubeUrl(youtubeEpisode?.url) ||
        youtubeUrl(published?.url) ||
        youtubeUrl(collection.videoUrl) ||
        collection.sourceUrl,
    };

    let position = 0;
    for (const selection of collection.selections) {
      const filmUrls =
        selection.type === "films"
          ? [selection.productUrl]
          : boxsets.get(selection.productUrl) ?? [];
      if (selection.type === "boxsets") {
        expandedBoxsetFilms += filmUrls.length;
      }

      for (const filmUrl of filmUrls) {
        const metadata = browseFilms.get(filmUrl);
        if (!metadata) {
          missingFilms.add(filmUrl);
          continue;
        }
        position += 1;
        filmPicks.push({
          ...metadata,
          collectionId: collection.collectionId,
          id: `${metadata.filmId}-${collection.collectionId}-${position}`,
          pickedAs:
            selection.type === "boxsets" ? selection.title : metadata.title,
          picker: collection.picker,
        });
      }
    }
  }

  if (incremental && collections.length > 0 && missingFilms.size > 0) {
    throw new Error(
      `New collection metadata references ${missingFilms.size} film(s) absent from Criterion's film index; refusing a partial update.`,
    );
  }

  filmPicks.sort((a, b) => {
    const aDate = closetVideos[a.collectionId]?.publishedOn ?? "";
    const bDate = closetVideos[b.collectionId]?.publishedOn ?? "";
    return (
      bDate.localeCompare(aDate) ||
      Number(b.collectionId) - Number(a.collectionId)
    );
  });

  const unmatchedCollections = matchedCollections.filter(
    (collection) => !collection.visit,
  );
  const matchedVisitTitles = new Set(
    Object.values(closetVideos)
      .map((video) => video.title)
      .filter(Boolean),
  );
  const archiveOnlyVisits = visits.filter(
    (visit) => !matchedVisitTitles.has(visit.title),
  );
  const archiveChanged =
    JSON.stringify(filmPicks) !== JSON.stringify(trackedFilmPicks) ||
    JSON.stringify(closetVideos) !== JSON.stringify(trackedVideos);
  const stats = {
    archiveOnlyVisits: archiveOnlyVisits.map((visit) => ({
      picker: visit.picker,
      recordedOn: visit.recordedOn,
      title: visit.title,
    })),
    collections: Object.keys(closetVideos).length,
    expandedBoxsetFilms,
    filmPicks: filmPicks.length,
    generatedOn:
      incremental && !archiveChanged
        ? trackedStats.generatedOn
        : new Date().toISOString(),
    missingFilms: [...missingFilms],
    unmatchedCollections: unmatchedCollections.map((collection) => ({
      collectionId: collection.collectionId,
      picker: collection.picker,
      title: collection.title,
    })),
    uniqueFilms: new Set(filmPicks.map((film) => film.filmId)).size,
    visits: visits.length,
  };

  await Promise.all([
    writeFile(
      path.join(DATA_DIR, "films.json"),
      `${JSON.stringify(filmPicks, null, 2)}\n`,
    ),
    writeFile(
      path.join(DATA_DIR, "closet-videos.json"),
      `${JSON.stringify(closetVideos, null, 2)}\n`,
    ),
    writeFile(
      path.join(DATA_DIR, "archive-stats.json"),
      `${JSON.stringify(stats, null, 2)}\n`,
    ),
  ]);

  console.log(
    `Wrote ${filmPicks.length} movie picks covering ${stats.uniqueFilms} unique films across ${stats.collections} Closet collections.`,
  );
  if (missingFilms.size) {
    console.warn(`Skipped ${missingFilms.size} film URLs missing from browse data.`);
  }
  if (unmatchedCollections.length || archiveOnlyVisits.length) {
    console.warn(
      `${unmatchedCollections.length} collections lacked an archive-date match; ${archiveOnlyVisits.length} archive visits lacked a collection page.`,
    );
  }
}

export {
  findPendingYoutubeEpisodes,
  mergeCollectionUrls,
  mergeYoutubeEpisodes,
  parseGuestVisits,
  parseTrackedVisits,
  parseYoutubeChannelPage,
  parseYoutubeClosetFeed,
  parseYoutubePublishedOn,
  youtubeEpisodeForCollection,
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
