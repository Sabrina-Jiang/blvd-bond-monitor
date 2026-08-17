# Blvd & Bond Monitor

Tracks the floor-plan listings at [blvdbond.com](https://www.blvdbond.com/floor-plans/apartments) — new units, price changes, and availability changes — and publishes them as a static dashboard on GitHub Pages.

## How it works

- `src/scraper.js` fetches the public floor-plans page (and its "load more" pages) directly with HTTP requests — the listing data is server-rendered in the HTML, so no headless browser is needed.
- `scripts/scrape.js` runs the scraper, diffs the result against the last snapshot in `docs/data/units.json`, and appends any changes (new listings, removed listings, price up/down, availability changes) to `docs/data/events.json`. Every unit gets one price-history point recorded per calendar day, whether or not its price changed, so every unit has a real trend line rather than just the units that happened to move.
- `.github/workflows/scrape.yml` runs that script on GitHub Actions **every hour** and commits the updated JSON back to the repo.
- `docs/` is a static site (plain HTML/CSS/JS, no build step) that reads the JSON and renders:
  - `index.html` — current listings, filterable by bedrooms/building/price/sqft, with units first seen in the last 24h flagged **NEW**, a days-listed column, a favorites star per unit (saved to your browser's localStorage), a "recent change" column, a "lowest ever" badge, and an inline price-trend sparkline per unit
  - `history.html` — full change log
  - `unit.html?id=...` — per-unit price history with a full-size chart

Because everything is static, GitHub Pages serves it directly — there's no server to keep running. Favorites are stored per-browser (localStorage), not synced anywhere.

## Local development

```bash
npm install
npm run scrape        # runs one scrape, updates docs/data/*.json
```

Then open `docs/index.html` via a local static server (e.g. `npx serve docs` or `python3 -m http.server --directory docs`) — opening the file directly with `file://` will block the `fetch()` calls in most browsers.

## Deployment (GitHub Pages)

Pages is configured to serve from the `docs/` folder on `main`. Once enabled, the site is live at the repo's Pages URL, and the hourly Action keeps `docs/data/*.json` up to date automatically — no manual redeploy needed.
