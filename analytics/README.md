# Analytics — SEAP-UdeA

Click and pageview tracking via **Cloudflare Worker + KV**, following the same pattern as [drz-academy.github.io](https://github.com/jorgezuluaga/drz-academy.github.io).

## Events

| Event | When |
|-------|------|
| `page_view` | Home page view |
| `gallery_page_view` | Gallery page view |
| `app_click` | Click on an interactive app |
| `gallery_click` | Click on gallery entry points |
| `repo_click` | Click on a repository / paper link |
| `external_click` | Click on external links (GitHub, etc.) |

Each event stores IP, country (Cloudflare), path, referrer, and details (`targetId`, `targetName`, `href`).

## Deploy the Worker (once)

```bash
cd analytics/worker

# 1. Create KV namespace
npx wrangler kv namespace create VISITOR_LOGS
# Copy the id into wrangler.toml → [[kv_namespaces]].id

# 2. Secret token for reading logs (/stats.html)
npx wrangler secret put LOG_READ_TOKEN

# 3. Deploy
npx wrangler deploy
# or from the repo root:
make worker-deploy
```

Expected Worker URL:

```
https://seap-udea-visitor-log.drz-academy.workers.dev
```

Update these metas after deploy (already set in this repo):

- `index.html`, `gallery/index.html` → `visitor-log-endpoint` → `…/log`
- `stats.html` → `visitor-log-read-endpoint` → `…/logs`

Endpoints:

- `POST /log` — ingest events (public)
- `GET /logs?token=…` — read events (requires `LOG_READ_TOKEN`)

Optional in `wrangler.toml`:

```toml
[vars]
EXCLUDED_LOG_IPS = "your.public.ip"
```

## Stats panel

After deploying the site:

```
https://seap-udea.github.io/stats.html
```

Enter `LOG_READ_TOKEN` on first visit (stored in `sessionStorage`), or pass it in the URL:

```
https://seap-udea.github.io/stats.html?LOG_READ_TOKEN=YOUR_TOKEN
```

The page is **not linked** from the public nav (`noindex`).

## Site files

| File | Role |
|------|------|
| `js/visitor-tracker.js` | POST events to the worker |
| `js/site-analytics.js` | Page views + `[data-track]` clicks |
| `js/stats-page.js` | Stats dashboard |
| `stats.html` | Dashboard UI |
| `analytics/events.json` | Optional promo markers on the chart |
| `index.html` / `gallery/index.html` | Meta endpoint + tracking attributes |

## Local preview

```bash
make sync-site start
# open http://127.0.0.1:8000/stats.html
```

Tracking only works once the Worker URL metas point to a deployed worker.
