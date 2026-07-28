import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Closet Index product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>The Closet Index — Explore Criterion Closet Picks<\/title>/i,
  );
  assert.match(html, /Criterion Closet picks/);
  assert.match(html, /Where to watch/);
  assert.match(html, /Criterion/);
  assert.match(html, /Availability not checked/);
  assert.doesNotMatch(html, /All services/);
  assert.match(html, /All closet pickers/);
  assert.match(html, /Newest Closet interviews/);
  assert.match(html, /Movie Hall of Fame: most picks/);
  assert.match(html, /Director Hall of Fame: most picks/);
  assert.match(html, /\/taste-map/);
  assert.match(html, /\/semantic-islands/);
  assert.match(html, /sprocket-rail/);
  assert.match(html, /poster-frame/);
  assert.match(html, /person-avatar/);
  assert.match(html, /Wikimedia Commons/);
  assert.match(
    html,
    /https:\/\/www\.youtube\.com\/watch\?v=t9fgFt-Ibik/,
  );
  assert.match(html, /Jun 19, 2026/);
  assert.match(html, /dateTime="2026-06-19"/);
  assert.match(
    html,
    /Watch Christopher Nolan&#x27;s Closet Picks interview/,
  );
  assert.match(html, /Matt Damon/);
  assert.match(html, /https:\/\/vimeo\.com\/1213276700/);
  assert.match(html, /dateTime="2026-07-16"/);
  assert.match(html, /5749/);
  assert.match(html, /total movie picks/);
  assert.doesNotMatch(html, /Roll the|dream reel|film-grid/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the quantified Closet Taste Map", async () => {
  const response = await render("/taste-map");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Taste Map — The Closet Index<\/title>/i);
  assert.match(html, /Closet Taste Map/);
  assert.match(html, /Criterion Genome/);
  assert.match(html, /quantified dimensions/);
  assert.match(html, /Christopher Nolan/);
  assert.match(html, /Wikipedia/);
  assert.match(html, /Design study/);
  assert.match(html, /3D islands/);
});

test("server-renders the navigable 3D Semantic Islands explorer", async () => {
  const response = await render("/semantic-islands");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>3D Semantic Islands — The Closet Index<\/title>/i);
  assert.match(html, /3D Semantic Islands/);
  assert.match(html, /PC1/);
  assert.match(html, /PC2/);
  assert.match(html, /PC3/);
  assert.doesNotMatch(html, /Picker spotlight/);
  assert.doesNotMatch(html, /Design lab/);
  assert.match(html, /Change POV/);
  assert.match(html, /Navigate/);
  assert.match(html, /Criterion Genome PCA/);
  assert.match(html, /not yet an OpenAI text-embedding projection/i);
});

test("keeps 3D map navigation legible and off the React render loop", async () => {
  const [component, styles] = await Promise.all([
    readFile(
      new URL("../app/semantic-islands/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/semantic-islands/semantic-islands.module.css",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(component, /requestAnimationFrame\(animateKeyboard\)/);
  assert.match(component, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
  assert.match(component, /label: "PC1"/);
  assert.match(component, /label: "PC2"/);
  assert.match(component, /label: "PC3"/);
  assert.match(component, /gridLines/);
  assert.match(
    component,
    /Number\(keys\.has\("w"\)\) - Number\(keys\.has\("s"\)\)/,
  );
  assert.match(component, /keys\.has\("arrowup"\)\) camera\.pitch \+= look/);
  assert.match(component, /keys\.has\("arrowdown"\)\) camera\.pitch -= look/);
  assert.match(component, /island\.count >= 40/);
  assert.match(component, /Every major cluster is labeled/);
  assert.doesNotMatch(
    component,
    /setRenderTick|setCameraDisplay|shadowBlur|Picker spotlight|viewMode/,
  );
  assert.match(styles, /\.viewport\s*\{[^}]*background: #efede5/s);
});

test("returns ranked dream-list matches without requiring an API key", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("match-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/match", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        films: [
          {
            id: "stalker",
            title: "Stalker",
            year: 1979,
            director: "Andrei Tarkovsky",
          },
          {
            id: "cure",
            title: "Cure",
            year: 1997,
            director: "Kiyoshi Kurosawa",
          },
          {
            id: "late-spring",
            title: "Late Spring",
            year: 1949,
            director: "Yasujiro Ozu",
          },
        ],
      }),
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.method, "metadata-fallback");
  assert.equal(payload.matches.length, 3);
  assert.ok(payload.matches.every((match) => match.score > 0));
  assert.ok(payload.matches.every((match) => match.pickCount > 0));
});

test("ships the complete generated Closet archive snapshot", async () => {
  const films = JSON.parse(
    await readFile(new URL("../data/films.json", import.meta.url), "utf8"),
  );
  const stats = JSON.parse(
    await readFile(
      new URL("../data/archive-stats.json", import.meta.url),
      "utf8",
    ),
  );
  const videos = JSON.parse(
    await readFile(
      new URL("../data/closet-videos.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(stats.visits, 397);
  assert.equal(stats.collections, 397);
  assert.deepEqual(stats.archiveOnlyVisits, []);
  assert.deepEqual(stats.missingFilms, []);
  assert.deepEqual(stats.unmatchedCollections, []);
  assert.equal(stats.filmPicks, films.length);
  assert.equal(stats.filmPicks, 5_749);
  assert.equal(stats.uniqueFilms, 1_262);
  assert.equal(Object.keys(videos).length, 397);
  assert.equal(films[0].picker, "Matt Damon");
  assert.equal(videos[films[0].collectionId].publishedOn, "2026-07-27");
  assert.equal(videos[films[0].collectionId].recordedOn, "2026-07-16");
});

test("ships a quantified and explainable picker Taste Map", async () => {
  const tasteMap = JSON.parse(
    await readFile(new URL("../data/taste-map.json", import.meta.url), "utf8"),
  );

  assert.equal(tasteMap.meta.pickerCount, 391);
  assert.equal(tasteMap.meta.uniqueFilms, 1_262);
  assert.equal(tasteMap.meta.dimensions.length, 36);
  assert.equal(tasteMap.meta.filmIslands.length, 8);
  assert.ok(tasteMap.meta.filmCoverage >= 90);
  assert.equal(tasteMap.pickers.length, 391);
  assert.ok(tasteMap.edges.length > 500);

  for (const film of Object.values(tasteMap.films)) {
    assert.ok(film.x >= 0 && film.x <= 1);
    assert.ok(film.y >= 0 && film.y <= 1);
    assert.ok(film.z >= 0 && film.z <= 1);
    assert.ok(film.island >= 0 && film.island < 8);
  }

  for (const picker of tasteMap.pickers) {
    assert.equal(picker.profile.length, 36);
    assert.ok(picker.profile.every((value) => value >= 0 && value <= 100));
    assert.ok(picker.x >= 0 && picker.x <= 1);
    assert.ok(picker.y >= 0 && picker.y <= 1);
  }

  const nolan = tasteMap.pickers.find(
    (picker) => picker.name === "Christopher Nolan",
  );
  assert.ok(nolan);
  assert.equal(tasteMap.matches[nolan.id].length, 12);
  assert.ok(
    tasteMap.matches[nolan.id].every(
      (match) =>
        match.coverage >= 0 &&
        match.coverage <= 100 &&
        match.sharedTraits.length > 0,
    ),
  );
});

test("ships a standalone five-direction design study", async () => {
  const html = await readFile(
    new URL("../public/design-variations.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /The Archive/);
  assert.match(html, /The Filmstrip/);
  assert.match(html, /The Card File/);
  assert.match(html, /The Poster Wall/);
  assert.match(html, /The Ledger/);
  assert.equal((html.match(/class="direction-tab/g) ?? []).length, 5);
});

test("ships a standalone semantic-map design lab", async () => {
  const html = await readFile(
    new URL("../public/semantic-map-designs.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /A hybrid taste vector/);
  assert.match(html, /Picker spotlight/);
  assert.match(html, /Multi-picker overlay/);
  assert.match(html, /Semantic islands/);
  assert.match(html, /Small multiples/);
  assert.match(html, /Film neighborhood/);
  assert.match(html, /TMDB overview/);
  assert.match(html, /illustrative coordinates/i);
  assert.equal((html.match(/class="latent-tab(?: active)?"/g) ?? []).length, 5);
  assert.equal(
    (html.match(/class="latent-example(?: active)?"/g) ?? []).length,
    5,
  );
  assert.match(html, /Semantic constellation/);
  assert.match(html, /Explainable match cards/);
  assert.match(html, /Prototype scores are illustrative/);
  assert.match(html, /Taste neighborhoods/);
  assert.match(html, /Similarity matrix/);
  assert.match(html, /Picker fingerprints/);
  assert.match(html, /Taste subway/);
  assert.match(html, /Pairwise comparison/);
  assert.match(html, /Poster taste atlas/);
  assert.equal((html.match(/class="short-tab(?: active)?"/g) ?? []).length, 6);
  assert.equal(
    (html.match(/class="short-example(?: active)?"/g) ?? []).length,
    6,
  );
  assert.equal((html.match(/class="concept-tab(?: active)?"/g) ?? []).length, 12);
  assert.equal((html.match(/class="concept(?: active)?"/g) ?? []).length, 12);
});

test("checks the live Closet archive on a six-hour schedule", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/refresh-closet.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /cron: "17 \*\/6 \* \* \*"/);
  assert.match(workflow, /npm run data:sync:indexes/);
  assert.match(workflow, /npm run data:taste/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /git push origin HEAD:main/);
});

test("loads verified main-branch snapshots without a site redeploy", async () => {
  const [home, tasteMap, semanticIslands, archiveRoute, tasteRoute] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/taste-map/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/semantic-islands/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/api/archive/route.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/api/taste-data/route.ts", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(home, /fetch\("\/api\/archive"/);
  assert.match(tasteMap, /fetch\("\/api\/taste-data"/);
  assert.match(semanticIslands, /fetch\("\/api\/taste-data"/);
  assert.match(archiveRoute, /criterion-closet-explorer\/main\/data/);
  assert.match(tasteRoute, /criterion-closet-explorer\/main\/data/);
  assert.match(archiveRoute, /s-maxage=900/);
  assert.match(tasteRoute, /s-maxage=900/);
});
