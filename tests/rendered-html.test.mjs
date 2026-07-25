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
  assert.match(html, /What&#x27;s in/);
  assert.match(html, /Find a film/);
  assert.match(html, /Build your/);
  assert.match(html, /dream collection/);
  assert.match(html, /Criterion Closet/);
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
