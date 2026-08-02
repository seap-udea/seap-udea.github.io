# SEAP gallery previews

Repositories that publish a gallery via `.seap-udea-gallery.json` should ship
lightweight WebP thumbnails next to the originals so the site grid/filmstrip
stay fast on mobile.

## Config

Root of the repo:

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

## Generate previews

From this site repo (or copy the script into the target repo):

```bash
# inside the target repository (must contain .seap-udea-gallery.json)
/path/to/seap-udea.github.io/bin/seap-udea-gallery.sh

# or
/path/to/seap-udea.github.io/bin/seap-udea-gallery.sh /path/to/PRisma
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

Commit and push `.gallery/` so GitHub Pages / raw.githubusercontent.com can serve the thumbs.

## How the site uses them

- **Filmstrip + grid** → `.gallery/<stem>.webp` (lazy)
- **Main stage / View / Fullscreen / Download** → original file

If a preview is missing, the page falls back to the original.
