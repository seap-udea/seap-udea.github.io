# SEAP-UdeA

Website for the **Solar, Earth and Planetary Physics Group** at Universidad de Antioquia.

Live site: [https://seap-udea.github.io](https://seap-udea.github.io)

## Contents

- Group overview
- Featured open-source repositories
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

## Interactive apps

Apps live under `apps/` and are built as static exports in CI.

- [Cloud Academy](https://seap-udea.github.io/apps/cloud_academy/) — bubble-chamber particle tracks
- [Lighting Black Holes](https://seap-udea.github.io/apps/lighting-black-holes/) — black-hole light visualization

Locally:

```bash
make build-apps   # npm ci && next build (all apps under apps/)
make start        # serves _site including /apps/cloud_academy/ and /apps/lighting-black-holes/
```

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
