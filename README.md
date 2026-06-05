# Hussein Kanaan — Portfolio

Personal portfolio website built with plain HTML, CSS, and vanilla JavaScript. No frameworks, no build tools — deploy directly to GitHub Pages.

## Deploy to GitHub Pages

### Option A — Automatic (recommended)

1. Push this repo to GitHub (the `main` branch).
2. Go to **Settings → Pages**.
3. Under **Source**, select **Deploy from a branch** → `main` → `/ (root)`.
4. Click **Save**. Your site will be live at `https://<your-username>.github.io/<repo-name>/` within a minute.

### Option B — GitHub Actions (auto-deploy on push)

Create `.github/workflows/pages.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Local Preview

Just open `index.html` in any browser — no server required.

## Customisation

| What to change | Where |
|---|---|
| Projects 2 & 3 | `index.html` → `.project-placeholder` cards |
| Social / GitHub links | `index.html` → hero socials + project links |
| Accent colour | `style.css` → `--accent` variable |
| Typewriter phrases | `script.js` → `phrases` array |

## Structure

```
.
├── index.html   # all markup
├── style.css    # all styles (CSS custom properties, mobile-first)
├── script.js    # nav toggle, scroll reveal, typewriter, active link
└── README.md
```
