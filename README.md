# SEAP-UdeA

Website for the **Solar, Earth and Planetary Physics Group** at Universidad de Antioquia.

Live site: [https://seap-udea.github.io](https://seap-udea.github.io)

## Contents

- Group overview
- Featured open-source repositories
- Interactive apps
- Image gallery (per-repo `.seap-udea-gallery.json`)
- Click / pageview analytics (`/stats.html`)
- Project contributors
- Contact information

## Local preview

```bash
make start    # assembles _site/ and serves http://127.0.0.1:8000
make stop
make restart
make status
make help
```

Use another port with `PORT=3000 make start`.

## Books

Book HTML from other SEAP repositories can be published under `/books/…` at build time (sparse git clone; not vendored in this repo).

Currently:

| Book | Source | URL |
|------|--------|-----|
| Relatividad-Zuluaga | `seap-udea/Relatividad-Zuluaga` → `html/` | [/books/Relatividad-Zuluaga/](https://seap-udea.github.io/books/Relatividad-Zuluaga/) |

```bash
make sync-books   # publishes into _site/books/ (also runs inside make sync-site)
```

Mark the repo in `repos.json` with `"site": "books/<RepoName>/"` so a **Read** button appears on its card (preserved by `make repos`).

To add another book, edit the `BOOKS` list in `bin/sync_books.sh`.

### Keeping deploys fast (avoid cloning every time)

`sync_books.sh` / CI use this order:

1. **Vendored `books/` in this repo** (if present) → deploy only copies, no network.
2. **GitHub Actions cache** of `.cache/books`, keyed by the remote book commit SHA → after the first fill, later deploys restore the cache and **copy only** when the tip is unchanged.
3. **Sparse clone** only on cache miss or when the book repo moved forward.

To vendor (optional, ~50 MB for Relatividad) and never clone in CI:

```bash
./bin/sync_books.sh /tmp/seap-books
rm -rf books && mkdir -p books
cp -R /tmp/seap-books/books/Relatividad-Zuluaga books/Relatividad-Zuluaga
git add books && git commit -m "Vendor Relatividad-Zuluaga HTML"
```

Emergency deploy without books: `SKIP_BOOKS=1` in the assemble step / env.

## Interactive apps

Apps live under `apps/` and are built as static exports in CI.

- [Cloud Academy](https://seap-udea.github.io/apps/cloud_academy/) — bubble-chamber particle tracks
- [Lighting Black Holes](https://seap-udea.github.io/apps/lighting-black-holes/) — black-hole light visualization
- [La calculadora de Drake](https://seap-udea.github.io/apps/drake-calculator/) — interactive Drake equation and Milky Way visualization

Locally:

```bash
make build-apps   # npm ci && next build (all apps under apps/)
make start        # serves _site including all apps listed above
```

## Gallery

Any SEAP repository can publish a gallery by adding `.seap-udea-gallery.json` at its root. The site page is:

```
https://seap-udea.github.io/gallery?repo=PRisma
```

### Config

```json
{
  "title": "…",
  "path": "pipeline/kepler_51/results/figures/",
  "start_with": null,
  "configuration": {
    "preview": true,
    "grid": true
  }
}
```

- `path` — directory with the original images
- `start_with` — filename to open first, or `null` for the first image
- `configuration.preview` / `grid` — show the filmstrip and/or the grid

On this site, mark the repo in `repos.json` with `"gallery": true` so a **Gallery** button appears next to Public on its card (the field is preserved by `make repos`).

### Generate lightweight previews

Repositories should ship WebP thumbnails next to the originals so the grid and filmstrip stay fast on mobile. Only the main stage loads the full original.

From this site repo (or copy the script into the target repo):

```bash
# inside the target repository (must contain .seap-udea-gallery.json)
./bin/seap-udea-gallery.sh

# or
./bin/seap-udea-gallery.sh /path/to/PRisma
```

Creates:

```
<path>/.gallery/<stem>.webp
```

for every image in `<path>/` (max width 640px by default).

Options:

```bash
MAX_WIDTH=480 QUALITY=70 FORCE=1 ./bin/seap-udea-gallery.sh
```

Requires `python3` + Pillow (preferred), or `sips` + `cwebp`.

Commit and push `.gallery/` so the site can load the thumbs.

How the site uses them:

- **Filmstrip + grid** → `.gallery/<stem>.webp` (lazy)
- **Main stage / View / Fullscreen / Download** → original file

If a preview is missing, the page falls back to the original.

## Analytics

Click and pageview tracking via **Cloudflare Worker + KV**, following the same pattern as [drz-academy.github.io](https://github.com/jorgezuluaga/drz-academy.github.io).

### Events

| Event | When |
|-------|------|
| `page_view` | Home page view |
| `gallery_page_view` | Gallery page view |
| `app_click` | Click on an interactive app |
| `gallery_click` | Click on gallery entry points |
| `repo_click` | Click on a repository / paper link |
| `external_click` | Click on external links (GitHub, etc.) |

Each event stores IP, country (Cloudflare), path, referrer, and details (`targetId`, `targetName`, `href`).

### Deploy the Worker (once)

```bash
cd analytics/worker

# 1. Create KV namespace
npx wrangler kv namespace create SEAP_VISITOR_LOGS
# Copy the id into wrangler.toml → [[kv_namespaces]].id
# (binding name in wrangler.toml stays VISITOR_LOGS)

# 2. Secret token for reading logs (/stats.html) — do not commit this value
npx wrangler secret put LOG_READ_TOKEN

# 3. Deploy
npx wrangler deploy
# or from the repo root:
make worker-deploy
```

Worker URL (current):

```
https://seap-udea-visitor-log.drz-academy.workers.dev
```

Metas already set in this repo:

- `index.html`, `gallery/index.html` → `visitor-log-endpoint` → `…/log`
- `stats.html` → `visitor-log-read-endpoint` → `…/logs`

Endpoints:

- `POST /log` — ingest events (public)
- `GET /logs?token=…` — read events (requires Wrangler secret `LOG_READ_TOKEN`)

Optional in `wrangler.toml`:

```toml
[vars]
EXCLUDED_LOG_IPS = "your.public.ip"
```

### Stats panel

```
https://seap-udea.github.io/stats.html
```

Enter `LOG_READ_TOKEN` on first visit (stored in `sessionStorage`), or pass it in the URL as `?LOG_READ_TOKEN=…` (the value is never stored in this repository).

The page is **not linked** from the public nav (`noindex`).

| File | Role |
|------|------|
| `js/visitor-tracker.js` | POST events to the worker |
| `js/site-analytics.js` | Page views + `[data-track]` clicks |
| `js/stats-page.js` | Stats dashboard |
| `stats.html` | Dashboard UI |
| `analytics/events.json` | Optional promo markers on the chart |
| `analytics/worker/` | Cloudflare Worker source |

Locally: `make sync-site start` then open `http://127.0.0.1:8000/stats.html`.

## Deployment

The site is published with **GitHub Actions** (same pattern as [drz-academy.github.io](https://github.com/drz-academy/drz-academy.github.io)):

1. On every push to `main`, `.github/workflows/deploy.yml` builds Next.js apps, assembles `_site/`, and deploys to GitHub Pages.
2. You can also run it manually: **Actions → Deploy to GitHub Pages → Run workflow**.

Featured repositories are driven by `repos.json` (`featured: true`, in file order). Refresh metadata with:

```bash
make repos
```

Public URL: https://seap-udea.github.io

## Notes

- The `context/` directory is for local working materials and is ignored by git (see `.gitignore`).
- `_site/` is a build artifact (local + CI) and is gitignored.
- Site content is in English.
- Never commit `LOG_READ_TOKEN` or other Wrangler secrets; set them only with `npx wrangler secret put …`.
