import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const films = JSON.parse(
  await readFile(path.join(root, "data", "films.json"), "utf8"),
);
const peoplePath = path.join(root, "data", "people.json");
const people = JSON.parse(await readFile(peoplePath, "utf8"));
const directors = [...new Set(films.map((film) => film.director))].filter(
  (name) => name && !people[name] && name !== "Director unavailable",
);

function chunks(items, size) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) => items.slice(index * size, (index + 1) * size),
  );
}

async function fetchBatch(names) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    piprop: "thumbnail",
    pithumbsize: "600",
    prop: "pageimages",
    redirects: "1",
    titles: names.join("|"),
  });
  let response;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    response = await fetch(
      `https://en.wikipedia.org/w/api.php?${params.toString()}`,
      {
        headers: {
          "User-Agent":
            "CriterionClosetExplorer/0.1 (https://github.com/neelbaronia/criterion-closet-explorer)",
        },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (response.ok) break;
    if (response.status !== 429 || attempt === 4) {
      throw new Error(`Wikipedia API returned ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
  }

  const payload = await response.json();
  const aliases = new Map(names.map((name) => [name, name]));
  for (const item of payload.query?.normalized ?? []) {
    aliases.set(item.to, aliases.get(item.from) ?? item.from);
  }
  for (const item of payload.query?.redirects ?? []) {
    aliases.set(item.to, aliases.get(item.from) ?? item.from);
  }

  let matched = 0;
  for (const page of Object.values(payload.query?.pages ?? {})) {
    const originalName = aliases.get(page.title) ?? page.title;
    if (page.thumbnail?.source && names.includes(originalName)) {
      people[originalName] = page.thumbnail.source;
      matched += 1;
    }
  }
  return matched;
}

let matched = 0;
const batches = chunks(directors, 10);
for (let index = 0; index < batches.length; index += 1) {
  matched += await fetchBatch(batches[index]);
  console.log(`Fetched director photos ${index + 1}/${batches.length}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const sorted = Object.fromEntries(
  Object.entries(people).sort(([left], [right]) => left.localeCompare(right)),
);
await writeFile(peoplePath, `${JSON.stringify(sorted, null, 2)}\n`);

console.log(
  `Added ${matched} director photos; ${directors.length - matched} names still use initials.`,
);
