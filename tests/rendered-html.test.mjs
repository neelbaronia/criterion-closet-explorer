import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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
  assert.match(html, /Netflix/);
  assert.match(html, /Prime/);
  assert.match(html, /Max/);
  assert.match(html, /No tracked streams/);
  assert.doesNotMatch(html, /All services/);
  assert.match(html, /All closet pickers/);
  assert.match(html, /Newest Closet videos/);
  assert.match(html, /sprocket-rail/);
  assert.match(html, /poster-frame/);
  assert.match(html, /person-avatar/);
  assert.match(html, /Wikimedia Commons/);
  assert.match(
    html,
    /https:\/\/www\.youtube\.com\/watch\?v=t9fgFt-Ibik/,
  );
  assert.match(
    html,
    /Watch Christopher Nolan&#x27;s Closet Picks on YouTube/,
  );
  assert.ok(
    html.indexOf("Boyhood") < html.indexOf("El Norte"),
    "Christopher Nolan's picks should render before John Leguizamo's picks",
  );
  assert.doesNotMatch(html, /Roll the|dream reel|film-grid/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
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
  assert.equal(payload.matches[0].name, "Ryusuke Hamaguchi");
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
