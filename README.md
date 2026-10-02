# Vision Estimators — Website

Plain HTML/CSS/JS website (no framework, no build step) — white theme with construction photography and 3D scenes. Header menu: Services · Dedicated Estimator · About Us · Contact (Home, Industries and Our Process are linked from the logo and footer). Upload the site files in this folder to any static host.

## Pages

| Page | File |
|------|------|
| Home (full-screen 3D hero, who we are, 3D scroll story, services, built for contractors, industries, dedicated estimator, where we work, why choose us, 3D closing CTA) | `index.html` |
| Services overview + 16 service pages (each has a highlighted "Dedicated estimator available" block, `#dedicated`) | `services.html`, `service-*.html` |
| Dedicated Estimator | `dedicated-estimator.html` |
| Industries, About Us, Our Process, Projects | `industries.html`, `about.html`, `process.html`, `projects.html` |
| Contact (form + file upload), FAQ | `contact.html`, `faq.html` |
| Privacy Policy, Terms & Conditions, 404 | `privacy-policy.html`, `terms-and-conditions.html`, `404.html` |

Also included: `sitemap.xml`, `robots.txt`, `site.webmanifest`, `favicon.ico`.

## Logo & favicon

All generated from the official Vision Estimators logo artwork:

| File | Use |
|------|-----|
| `assets/img/logo.png` | Header logo (transparent background, for light backgrounds) |
| `assets/img/logo-white.png` | Footer logo (white + orange, for the navy footer) |
| `favicon.ico` (16/32/48) and `assets/img/favicon-32.png` | Browser tab icon — white VE mark on a navy tile, so it stays visible in dark-mode tabs |
| `assets/img/apple-touch-icon.png` (180), `icon-192.png`, `logo-512.png` | Home-screen / app icons and the schema.org logo |
| `assets/img/og-image.jpg` | Social share image (shows the new logo) |

## Structure

```
css/main.css              design system (colour tokens at the top, in :root)
js/main.js                navigation, reveal, counters, tilt, scroll story, accordion,
                          project filters, form validation/upload, lazy 3D loader
js/scenes.js              the four Three.js scenes (hero, story, civil, cta)
assets/vendor/three.min.js  slim Three.js build (loaded only when a 3D scene is near)
assets/img/               WebP photos, 3D fallback images, OG image, logo PNGs
assets/fonts/             Archivo, IBM Plex Sans, IBM Plex Mono (self-hosted)
```

## 3D + performance

- 3D loads **after** the page, only on capable devices. It is skipped for reduced-motion, Save-Data, very low-memory devices, or with `?no3d` in the URL — a static image of the same scene is shown instead.
- Scenes pause when off-screen, drop resolution automatically on slow devices, and use simplified materials on mobile.
- Works when opened directly from disk (`index.html`) or served: `python -m http.server 8000`.

## Company details used on the site

All visible placeholders have been replaced. Sources:

- **Office address** (Plot No 57, Ground Floor, LP Tower, Hitech City Road, Madhapur, Hyderabad, Telangana 500081), **"part of Remote Teams IT Solutions"**, **5+ years serving clients worldwide** and **engineering-qualified team** — from [remote-teams.in](https://remote-teams.in/).
- **Markets served (AU · US · UK · CA · NZ)** and **48-hour typical turnaround** — from the previous visionestimators.com site.
- **Measurement standards and file formats** — typical of the civil-estimating industry. Software is described generically ("industry-standard takeoff and CAD tools"); no product names are claimed. Add product names to the home page "Where we work" section and the FAQ if you want to list them.

Owner decisions (30 Sep 2026): no phone number — email only; keep "Get a Free Estimate" (carried over from the previous site's "Get Free Quote … No obligation"); no software product names.

Owner decisions (1 Oct 2026): wording follows UK / Australian industry style (BOQ, tender, metric, UK spelling) — services are named "… Estimating", not "… Estimation" (page URLs keep their old names so links still work); the Hyderabad office address appears only in the footer, on the Contact page and in the legal pages, not in marketing copy. The "Not sure which service you need?" band under the home page services grid was removed. MEP Estimating was split into three services — Electrical, Plumbing and Mechanical (HVAC) Estimating — and Whole Building Estimating (every trade in one estimate) was added, giving 15 services. On the Home and Services grids, Whole Building is a wide card (`svc-card--wide`, styles in `css/main.css`) so the grid fills evenly; fire services are covered on the Plumbing page. The home page hero is full-screen: the 3D site model fills the whole hero at every screen size, with only a soft glow behind the text (no white panel on the left). Camera framing per screen width is set in `sceneHero` (`st.onResize`) in `js/scenes.js`; the static fallbacks `hero-3d.webp` / `hero-3d-mobile.webp` were re-rendered to match (open `index.html?capture` to render frames).

Positioning (1 Oct 2026): the site is written for contractors and subcontractors (trade estimating), not as a civil estimating firm. Service order everywhere: 01 Roofing, 02 Cladding (new page `service-cladding-estimating.html`; the old `service-facade-cladding.html` URL redirects to it), 03 Structural, 04 Electrical, 05 Plumbing, 06 Whole Building, then Mechanical, Concrete, Quantity Takeoffs, Material Takeoffs, BOQ Preparation, Cost, Labour, Tender & Bid Support, Civil and Earthworks last. The home page civil 3D section was replaced by a "Built for Contractors & Subcontractors" section with an illustrative takeoff card (sample figures, marked "not a quotation"); `civil-3d.webp` and the civil scene in `js/scenes.js` are no longer used on any page.

Still to do before going live:
- Privacy Policy and Terms: company details are filled in, but the text is still a template — **must be reviewed by a legal adviser** (sections are flagged). Fee validity, payment terms and liability cap now refer to each proposal/agreement.
- Projects page shows representative project types (no client names or locations). Replace with approved case studies when available.
- A commented-out testimonials block is ready in `index.html` for verified testimonials.

## Publishing to visionestimators.com (cPanel)

A ready-to-upload package is next to this folder: `../visionestimators-website-upload.zip` (site files only — no README/credits). Rebuild it after future edits by zipping the same files: all `*.html`, `css/`, `js/`, `assets/`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, `.htaccess`.

1. **Back up the current site.** cPanel → File Manager → `public_html` → Select All → Compress → download the archive.
2. In File Manager **Settings**, tick **Show Hidden Files (dotfiles)** so `.htaccess` is visible.
3. **Delete the old website files** in `public_html` (old `.html` pages, `css`, `js`, images, old `.htaccess`). **Keep** `.well-known` and `cgi-bin` if present.
4. **Upload** `visionestimators-website-upload.zip` into `public_html` → right-click → **Extract** → then delete the zip.
5. **Purge the host cache** (the current host caches pages for about 2 hours — use the hosting dashboard's "purge cache" or wait).
6. **Check:** `https://www.visionestimators.com` loads the new site; `http://…` and `visionestimators.com` (no www) redirect to `https://www.…`; a made-up address such as `/test-404` shows the 404 page; old links such as `/why-us.html` redirect.
   - If the browser shows **"too many redirects"**, open `.htaccess` and delete the three lines under "One canonical address".
7. **Activate the contact form** — see "Contact form → email" below (one test submission + one activation email).
8. Optional: submit `https://www.visionestimators.com/sitemap.xml` in Google Search Console.

`.htaccess` handles: HTTPS + www redirect, the custom 404 page (the live server currently returns 500 errors for missing pages), `/about` → `about.html` pretty URLs, 301 redirects for old page names, compression and browser caching.

## Contact form → email

The form on `contact.html` emails every request (all fields plus attached drawings, up to 10 MB in total) to **info@visionestimators.com** using the free service [FormSubmit](https://formsubmit.co). No server or account is needed.

**One-time activation (required):**
1. Upload the site, open the Contact page and submit the form once with your own details.
2. FormSubmit sends an **"Activate Form"** email to info@visionestimators.com — click the button in that email.
3. From then on every request arrives in that inbox. The visitor also receives an automatic confirmation email and is redirected to `thank-you.html`.

To send to a different address, change the email in the form's `action` (`https://formsubmit.co/your@email.com`) in `contact.html`. After activation FormSubmit also gives you a random alias you can use instead of the plain email address (keeps it hidden from spam bots).

Links can preselect a service: `contact.html?service=civil-estimating`.

## Images

Photos are in `assets/img/` (WebP, 1200px and 640px). Sources and licences are listed in `IMAGE-CREDITS.md` — newly sourced photos are CC0 / public domain.

## SEO

Canonical URLs, Open Graph and sitemap use `https://www.visionestimators.com`. If the live domain differs, find/replace it across the HTML files, `sitemap.xml` and `robots.txt`.

Old URLs from the previous site are kept as small redirect pages (noindex) so existing links keep working: `our-services.html` → `services.html`, `why-us.html` → `about.html`, `terms-of-service.html` → `terms-and-conditions.html`, `service-drywall-estimation.html` → `service-material-takeoff.html`, `service-electrical-estimation.html` → `service-electrical-estimating.html`, `service-plumbing-estimation.html` → `service-plumbing-estimating.html`, `service-sheet-metal-hvac.html` → `service-mechanical-estimating.html`, `service-mep-estimating.html` → `services.html` (MEP was split into three services), `service-facade-cladding.html` → `services.html`. On a server, proper 301 redirects are better.
