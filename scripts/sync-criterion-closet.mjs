import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".cache", "criterion");
const DATA_DIR = path.join(ROOT, "data");
const READER_URL = "https://r.jina.ai/";
const refresh = process.argv.includes("--refresh");

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

function isoDate(month, day, year) {
  return `${year}-${monthNumbers[month]}-${String(day).padStart(2, "0")}`;
}

function cachePath(kind, id, extension) {
  return path.join(CACHE_DIR, `${kind}-${id}.${extension}`);
}

async function fetchWithRetry(url, format, attempts = 5) {
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

async function cachedJson(kind, id, url) {
  const filename = cachePath(kind, id, "json");
  if (!refresh) {
    try {
      return JSON.parse(await readFile(filename, "utf8"));
    } catch {
      // Cache miss.
    }
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  const payload = await response.json();
  await writeFile(filename, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function cachedFetch(kind, id, url, format = "markdown") {
  const extension = format === "html" ? "html" : "md";
  const filename = cachePath(kind, id, extension);

  if (!refresh) {
    try {
      return await readFile(filename, "utf8");
    } catch {
      // Cache miss.
    }
  }

  const text = await fetchWithRetry(url, format);
  await writeFile(filename, text);
  return text;
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
        url:
          visit.youtube_video_url ??
          (visit.vimeo_video_id
            ? `https://vimeo.com/${visit.vimeo_video_id}`
            : ""),
      });
    }
  }

  return { collectionUrls, visitsByCollection };
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

  console.log("Fetching official archive indexes...");
  const [indexMarkdown, searchMarkdown, browseHtml, guestExport] =
    await Promise.all([
      cachedFetch(
        "index",
        "closet-picks",
        "https://www.criterion.com/closet-picks",
      ),
      cachedFetch(
        "search",
        "closet-picks",
        "https://www.criterion.com/closet-picks/search",
      ),
      cachedFetch(
        "browse",
        "all-films",
        "https://www.criterion.com/shop/browse/list",
        "html",
      ),
      cachedJson(
        "community",
        "guests",
        "https://closetpicks.westenb.org/exports/guests.json",
      ),
    ]);

  const visits = parseArchive(searchMarkdown);
  const guestMetadata = parseGuestVisits(guestExport);
  const urlsByCollectionId = new Map();
  for (const url of [
    ...parseCollectionUrls(indexMarkdown),
    ...guestMetadata.collectionUrls,
  ]) {
    const collectionId = url.match(/collection\/(\d+)/)?.[1];
    if (collectionId && !urlsByCollectionId.has(collectionId)) {
      urlsByCollectionId.set(collectionId, url);
    }
  }
  const collectionUrls = [...urlsByCollectionId.values()].sort((a, b) => {
    const aId = Number(a.match(/collection\/(\d+)/)?.[1] ?? 0);
    const bId = Number(b.match(/collection\/(\d+)/)?.[1] ?? 0);
    return bId - aId;
  });
  const browseFilms = parseBrowseFilms(browseHtml);

  console.log(
    `Found ${visits.length} visits, ${collectionUrls.length} collections, and ${browseFilms.size} Criterion film records.`,
  );

  const collections = await mapLimit(collectionUrls, 8, async (url, index) => {
    const id = url.match(/collection\/(\d+)/)?.[1];
    const document = await cachedFetch("collection", id, url, "html");
    if ((index + 1) % 20 === 0 || index + 1 === collectionUrls.length) {
      console.log(`Fetched ${index + 1}/${collectionUrls.length} collections`);
    }
    return parseCollectionDocument(document, url);
  });

  const matchedCollections = matchVisits(collections, visits);
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

  const closetVideos = {};
  const filmPicks = [];
  const missingFilms = new Set();
  let expandedBoxsetFilms = 0;

  for (const collection of matchedCollections) {
    const visit = collection.visit;
    const published = guestMetadata.visitsByCollection.get(
      collection.collectionId,
    );
    closetVideos[collection.collectionId] = {
      collectionId: collection.collectionId,
      criterionUrl: collection.sourceUrl,
      picker: collection.picker,
      pickerImage: visit?.image ?? "",
      publishedOn: published?.publishedOn || visit?.recordedOn || "",
      recordedOn: visit?.recordedOn ?? "",
      title: collection.title,
      url: published?.url || collection.videoUrl || collection.sourceUrl,
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
    matchedCollections
      .map((collection) => collection.visit?.title)
      .filter(Boolean),
  );
  const archiveOnlyVisits = visits.filter(
    (visit) => !matchedVisitTitles.has(visit.title),
  );
  const stats = {
    archiveOnlyVisits: archiveOnlyVisits.map((visit) => ({
      picker: visit.picker,
      recordedOn: visit.recordedOn,
      title: visit.title,
    })),
    collections: collections.length,
    expandedBoxsetFilms,
    filmPicks: filmPicks.length,
    generatedOn: new Date().toISOString(),
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
    `Wrote ${filmPicks.length} movie picks covering ${stats.uniqueFilms} unique films across ${collections.length} Closet collections.`,
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

await main();
