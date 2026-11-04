# Gallapp (SEAP-UdeA)

Online gallery for figures published by [SEAP-UdeA](https://seap-udea.github.io/) repositories. It is the site deployment of [Gallery App](https://github.com/seap-udea/gallapp), adapted to load images from GitHub instead of a local folder.

## Open it

```text
https://seap-udea.github.io/gallapp/?repo=PRisma
https://seap-udea.github.io/gallapp/?repo=PRisma&multi=true
https://seap-udea.github.io/gallapp/?repo=PRisma&session=alice&multi=true
```

The repository must expose `.seap-udea-gallery.json` at its root (same config as before). Optional `id=` selects one entry when that file is an array.

Legacy `/gallery/?repo=…` URLs redirect here and keep the query string.

## Persist mode (browser session)

GitHub Pages cannot write files. Gallapp therefore keeps `.gallapp_*` sidecars as **temporary browser-session entities** (`sessionStorage`):

1. On open, any committed `.gallapp_*` in the image path are **read** (seed).
2. Likes, classes, labels, and position update only in this tab’s session.
3. **Export sidecars** downloads the current entities so you can commit them back to the repo.
4. **Import sidecars** loads exported text files into the session.

Closing the tab clears unsaved session data.

## Features

Same interaction model as local Gallery App: browse, like filters, named sessions, multi-class tagging (`multi=true`), Edit classes / Shift+glyph, export/import sidecars, Copy status.

Filmstrip and grid prefer lightweight WebP previews under `<path>/.gallery/` (from `bin/seap-udea-gallery.sh`); the main stage loads the original image.

## Query API

| Parameter | Meaning | Example |
|---|---|---|
| `repo` | SEAP repository name (required) | `repo=PRisma` |
| `id` | Gallery id when `.seap-udea-gallery.json` is an array | `id=kepler51` |
| `session` | Named review session | `session=alice` |
| `multi` | Multi-class mode | `multi=true` |
| `persist` | Always `session` online | `persist=session` |
| `n`, `likes` / `class`, `filter`, `grid`, `strip` | Same as local Gallery App | |

## Local development of this site copy

From the `seap-udea.github.io` root:

```bash
make sync-site
make start
# open http://127.0.0.1:8000/gallapp/?repo=PRisma
```

The standalone local app (with folder writes via `server.py`) remains in the separate Gallery App / MVROC `code/gallapp` tree.

## Author

- **Jorge I. Zuluaga** — [jorge.zuluaga@udea.edu.co](mailto:jorge.zuluaga@udea.edu.co)
