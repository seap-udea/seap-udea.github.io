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

## Deployment

The site is published with **GitHub Actions** (same pattern as [drz-academy.github.io](https://github.com/drz-academy/drz-academy.github.io)):

1. On every push to `main`, `.github/workflows/deploy.yml` assembles `_site/` and deploys it to GitHub Pages.
2. You can also run it manually: **Actions → Deploy to GitHub Pages → Run workflow**.

Public URL: https://seap-udea.github.io

## Notes

- The `context/` directory is for local working materials and is ignored by git (see `.gitignore`).
- `_site/` is a build artifact (local + CI) and is gitignored.
- Site content is in English.
