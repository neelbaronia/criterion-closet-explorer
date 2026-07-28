# The Closet Index

An unofficial, navigable companion to the Criterion Closet Picks series. Explore
films by title, year, director, decade, or the person who chose them, then jump
to live streaming-availability searches.

The repository includes:

- a responsive, searchable film table
- 5,738 movie-pick rows covering 1,262 unique films from 396 published
  Closet pick lists
- box-set picks expanded into the individual films Criterion lists in each set
- poster artwork and verified U.S. subscription availability across Criterion
  Channel, Netflix, Prime Video, and Max for the currently checked titles
- director photos where available and official Criterion images for every picker
- a video icon and interview date for every published pick-list page
- default reverse-chronological video-release order, plus sorting by title, film
  year, director, or picker
- filters for Closet picker, director, and decade
- progressive 100-row rendering so the full archive remains fast to browse
- an interactive picker Taste Map built from 36 quantified film dimensions,
  rare shared picks, and director affinity
- a keyboard-navigable 3D Semantic Islands view of all 1,262 unique films,
  with picker spotlights, island filters, and clickable film neighborhoods
- [five complete visual directions](./public/design-variations.html) in one
  standalone HTML comparison file
- a [twelve-direction similarity-map design lab](./public/semantic-map-designs.html)

## Run locally

Node.js 22.13 or newer is required.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. The live Taste Map is at
`http://localhost:3000/taste-map`; the 3D film map is at
`http://localhost:3000/semantic-islands`; the visual studies are at
`http://localhost:3000/design-variations.html` and
`http://localhost:3000/semantic-map-designs.html`.

## Data and archive sync

The generated pick records live in [`data/films.json`](./data/films.json):

```json
{
  "id": "724-984-1",
  "filmId": "724",
  "title": "The Killers",
  "year": 1946,
  "director": "Robert Siodmak",
  "picker": "Christopher Nolan",
  "collectionId": "984",
  "poster": "https://s3.amazonaws.com/criterion-production/films/..."
}
```

Refresh the snapshot from Criterion’s current archive with:

```bash
npm run data:sync
```

The sync reads Criterion’s official visit archive, all 396 published collection
pages, the complete film browse list, and selected box-set contents. It writes
the film picks, interview metadata, and audit counts to `data/`. The generated
audit currently has no unmatched visits, collection pages, or film records.

Direct interview links, official recorded dates, video-release dates, and picker
images live in
[`data/closet-videos.json`](./data/closet-videos.json). Video-release dates
drive the default newest-first order, while each row displays Criterion’s
interview-recording date.
Current tracked streaming availability lives in
[`data/streaming-availability.json`](./data/streaming-availability.json) and is
date-stamped so it can be refreshed as catalogs change.

Selection data is sourced from the
[official Criterion Closet Picks archive](https://www.criterion.com/closet-picks)
and [visit-date index](https://www.criterion.com/closet-picks/search). Cover art
and picker images are delivered by Criterion. Director photos use Wikimedia
Commons, with a TMDB fallback where already available. Direct video URLs and
release dates are matched by Criterion collection ID using the
[Closet Picks machine-readable export](https://closetpicks.westenb.org/llm-export/).
Streaming links open provider searches because availability changes by date and
region.

## Taste Map

The generated similarity model lives in
[`data/taste-map.json`](./data/taste-map.json). Every unique film gets a
0–100 profile across 36 interpretable mood, form, theme, mode, and context
dimensions. Picker profiles are rarity-weighted averages; oversized box sets are
capped so they cannot dominate a person’s taste.

The default match score combines:

- 60% film-dimension similarity
- 25% rarity-weighted exact film overlap
- 15% rarity-weighted director overlap

Map coordinates come from principal component analysis, and the interface
exposes shared traits, contrasts, directors, and rare shared films for each
match. Refresh the generated profiles with:

```bash
npm run data:taste
```

The 3D view projects every film profile onto the first three principal
components and groups the original 36-dimensional profiles into eight semantic
islands. Click the map, then use the arrow keys to turn and travel; `A`/`D`
strafe, `W`/`S` rise and descend, `F` focuses the selected picker, and Space
resets the camera.

The model is inspired by the continuous relevance approach of the
[MovieLens Tag Genome](https://grouplens.org/datasets/movielens/tag-genome/),
but does not redistribute that research dataset. Instead, it derives its
automated exploratory signals from Criterion metadata and
[English Wikipedia](https://en.wikipedia.org/) summaries and categories. These
scores are a navigation aid, not authoritative film criticism.

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
