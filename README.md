# The Closet Index

An unofficial, navigable companion to the Criterion Closet Picks series. Explore
films by title, year, director, decade, or the person who chose them, then jump
to live streaming-availability searches.

The repository includes:

- a responsive, interactive film explorer
- 40 sourced selections from 11 Closet visitors as a starter dataset
- poster artwork and live “where to watch” links
- saved films stored locally in the browser
- a detail drawer for every title
- a locally saved dream-collection builder
- ranked Closet-person matches with optional OpenAI semantic embeddings
- [five complete visual directions](./public/design-variations.html) in one
  standalone HTML comparison file

## Run locally

Node.js 22.13 or newer is required.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. The design study is at
`http://localhost:3000/design-variations.html`.

## Semantic Closet matching

Visitors can add indexed films or type any custom title into a dream Criterion
collection. The server compares that list with every indexed Closet visitor and
returns the three closest taste profiles.

The matcher works in two modes:

- with `OPENAI_API_KEY`, it compares the collection and visitor profiles using
  [`text-embedding-3-small`](https://developers.openai.com/api/docs/models/text-embedding-3-small)
- without a key, it provides a transparent preview based on overlapping films,
  directors, decades, and hand-curated thematic tags

Copy `.env.example` to `.env.local` to enable embeddings locally. Never expose
the key in client-side code; hosted keys should be set through the deployment
environment.

## Data

The starter records live in [`data/films.json`](./data/films.json):

```json
{
  "id": "stalker",
  "title": "Stalker",
  "year": 1979,
  "director": "Andrei Tarkovsky",
  "pickers": ["Jude Law"],
  "poster": "https://media.themoviedb.org/t/p/w500/..."
}
```

The UI is ready for a complete archive: add verified records to this file and
they automatically become searchable, filterable, and sortable.

Selection data is sourced from the
[official Criterion Closet Picks archive](https://www.criterion.com/closet-picks).
Poster imagery is delivered by TMDB. Streaming links intentionally open current
JustWatch and Criterion Channel searches because availability changes by date
and region.

## Design directions

The standalone study contains five visual systems:

1. **The Archive** — warm, editorial, cover-forward
2. **The Filmstrip** — dark, cinematic, horizontally kinetic
3. **The Card File** — analog, personal, slightly playful
4. **The Poster Wall** — graphic, saturated, museum-like
5. **The Ledger** — typographic, fast, information-dense

The production explorer currently uses **The Filmstrip** direction.

## Notes

This is an independent prototype and is not affiliated with The Criterion
Collection. Film artwork remains the property of its respective rights holders.
