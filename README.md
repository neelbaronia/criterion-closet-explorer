# The Closet Index

An unofficial, navigable companion to the Criterion Closet Picks series. Explore
films by title, year, director, decade, or the person who chose them, then jump
to live streaming-availability searches.

The repository includes:

- a responsive, searchable film table
- 40 sourced selections from 12 Closet visitors as a starter dataset
- poster artwork and verified U.S. subscription availability across Criterion
  Channel, Netflix, Prime Video, and Max
- director and Closet-picker profile photos
- direct links from every Closet picker to their official Criterion YouTube
  video
- default reverse-chronological Closet-video order, plus sorting by title, film
  year, director, or Closet picker
- filters for Closet picker, director, and decade
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
Closet-video chronology lives in
[`data/closet-release-order.json`](./data/closet-release-order.json), newest
first. Films selected by more than one visitor are placed with the newest
relevant Closet video.
Official YouTube links live in
[`data/closet-videos.json`](./data/closet-videos.json).
Current tracked streaming availability lives in
[`data/streaming-availability.json`](./data/streaming-availability.json) and is
date-stamped so it can be refreshed as catalogs change.

Selection data is sourced from the
[official Criterion Closet Picks archive](https://www.criterion.com/closet-picks).
Poster imagery is delivered by TMDB. Profile photos are delivered by Wikimedia
Commons, with a TMDB fallback. Streaming links intentionally open current
JustWatch and Criterion Channel searches because availability changes by date
and region.

## Design directions

The standalone study contains five visual systems:

1. **The Archive** — warm, editorial, cover-forward
2. **The Filmstrip** — dark, cinematic, horizontally kinetic
3. **The Card File** — analog, personal, slightly playful
4. **The Poster Wall** — graphic, saturated, museum-like
5. **The Ledger** — typographic, fast, information-dense

The production explorer uses a table-focused version of **The Filmstrip**
direction.

## Notes

This is an independent prototype and is not affiliated with The Criterion
Collection. Film artwork remains the property of its respective rights holders.
