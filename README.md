# Vision Estimators — Website (India → serving overseas clients)

A complete, multi-page marketing website for **Vision Estimators**, an India-based construction cost-estimating company serving overseas clients (Australia, USA, UK, Canada, New Zealand & beyond).

Adapted from the Australia edition: the region/content was changed to India-serving-overseas, and the theme was recoloured to a **civil-engineering palette (steel blue + safety yellow)**.

## Pages (21)

- `index.html` — Home
- `about.html`, `why-us.html`, `industries.html`, `process.html`, `contact.html`
- `our-services.html` — services overview + FAQ
- `services.html` — Construction Estimating (detail)
- 10 individual service pages: `service-earthwork-estimation`, `service-roofing-estimation`, `service-sheet-metal-hvac`, `service-quantity-takeoff`, `service-tender-bid-management`, `service-drywall-estimation`, `service-plumbing-estimation`, `service-electrical-estimation`, `service-facade-cladding`, `service-structural-framing`
- `privacy-policy.html`, `terms-of-service.html`, `404.html`

## Structure

```
vision estimator.com/
├── *.html                 # 21 pages
├── favicon.ico
├── css/styles.css         # full design system (~2,100 lines)
├── js/
│   ├── icons.js           # inline SVG icon engine (data-icon="…")
│   └── main.js            # loader, cursor, scroll progress, reveal, nav, theme toggle, form
└── assets/images/         # app_logo.png, hero-bg.jpg, no_image.png
```

## Design — "the estimate as a document"

Steel-blue drafting ink with a disciplined burnt-orange accent reclaimed from the logo. Colours are driven by CSS variables in `css/styles.css` (`:root` light + `[data-theme="dark"]`):

| Token | Light | Dark |
|-------|-------|------|
| `--primary` (steel blue) | `#1c4e80` | `#4e90d2` |
| `--accent` (burnt orange, from logo) | `#c24e12` | `#f5822e` |
| `--background` | `#fafaf7` (warm drafting paper) | `#0a1826` (blueprint navy) |

The site defaults to **light mode** (warm paper). A header theme toggle (sun/moon) persists the choice in `localStorage` (`ve-theme`) and works on desktop and mobile. All accent tints are driven from `--primary-rgb` / `--accent-rgb`, so a palette change is a token edit in both blocks — no find/replace.

### Typography (all self-hosted, no external requests)
- **Space Grotesk** — display / headings / wordmark
- **IBM Plex Mono** — figures, section eyebrows, spec labels, 01–04 sequences, form labels (tabular)
- **Plus Jakarta Sans** — body copy

`assets/fonts/fonts.css` holds every `@font-face` (Plus Jakarta Sans + Space Grotesk + IBM Plex Mono) pointing at local `.woff2`.

### Signature
The section eyebrow is a **dimension-line annotation**: a lead rule + an orange tick square + mono tracked caps. It appears at section headers only — not scattered into cards.

## Features

- Light/dark theme toggle (sun/moon) in the header; WCAG AA contrast in both themes
- Sticky header with a Services mega-dropdown; full mobile menu
- Restrained reveal-on-scroll (respects `prefers-reduced-motion`), blueprint/grid backgrounds used with intent
- SVG icon system (Heroicons) injected from `data-icon` attributes — no image requests
- Fully responsive

## Running it

Open `index.html` in any browser, or serve locally:

```bash
python -m http.server 8000   # then open http://localhost:8000
```

## Fully self-contained

The site has **no external dependencies** — it renders identically online or offline:
- **Font** (Plus Jakarta Sans) is self-hosted in `assets/fonts/` (local `.woff2` + `fonts.css`).
- **All images** are local in `assets/images/` (hero, industry tiles, testimonial avatars, service photos — nothing loaded from the internet).

## Before going live

1. **Contact form** (`contact.html`) is front-end only — wire it to an email/form service (Formspree, Web3Forms) or your backend.
2. **Contact details** — email/website are `visionestimators.com`; add a real phone and India office address.
3. Update **testimonials / stats** with your real figures and client quotes.
