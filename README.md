# WorkHours — Free Work Hours, Pay & Salary Breakdown Calculators

**Live:** https://zakidebach.github.io/workhours/ (French: `/fr/`, Arabic: `/ar/`). It is hosted on GitHub Pages and redeploys on every push to `main`.
Next steps (Search Console, custom domain, AdSense) are in [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md).

WorkHours is a simple, fast and private website for U.S. workers with three free tools:

| Tool | URL | What it does |
|---|---|---|
| **Work Hours Calculator** | `/work-hours-calculator/` | Start time + end time + break → total time, break, net hours (h:mm and decimal). 12/24-hour input, overnight shifts. |
| **Pay Calculator** | `/pay-calculator/` | Hourly rate × hours for a Daily / Weekly / Biweekly / Monthly / Annual period. Optional overtime hours, optional 1.5× rate, step-by-step breakdown, equivalents for all periods. **No taxes or deductions are invented.** |
| **Salary Breakdown** | `/salary-breakdown/` | Monthly income split across editable categories (add / rename / delete). Totals, left over, % per category, savings rate, donut chart, over-budget warning, Reset, Print / Save as PDF. |

Plus: Home, About Us, Contact Us, Privacy Policy, Terms of Use, Disclaimer and a 404 page.

**Currencies:** the Pay Calculator and Salary Breakdown have a searchable **Currency** picker listing all 155 official currencies in circulation (ISO 4217, reviewed for 2026, in `assets/js/currencies.js`). You can search by name, code or symbol, in any of the three languages. USD is the default. The choice is saved in the browser (`localStorage` key `wh:currency`) and shared by both tools and all languages. Amounts are formatted with `Intl.NumberFormat`, which sets the correct decimals per currency (e.g. JPY 0, KWD 3). Changing the currency **never converts** amounts: there are no exchange rates.

**Languages:** every page exists in **English** (`/`), **French** (`/fr/`) and **Arabic** (`/ar/`, full right-to-left layout), for 27 pages in total. A language switcher in the header links to the same page in the other languages. The calculators, error messages, results and budget categories are translated too. French accepts decimal commas (`18,50`) and shows `1 234,56 $US`. Arabic accepts Arabic-Indic digits (`٨:٣٠`, `٤٠٠٠`) and صباحًا/مساءً.

**Tech:** HTML5, CSS3 and vanilla JavaScript only. No frameworks, CDNs, external fonts, database, backend, login or cookies. All calculations run in the visitor's browser; entries are kept only in that browser's `localStorage` so nothing is lost on refresh.

---

## 1. Run it locally

Any static web server works. With Python installed:

```
python -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly with `file://` loads pages, but folder links such as `pay-calculator/` need a server.)

## 2. Project structure

```
/
├── index.html                       Home page (generated)
├── work-hours-calculator/index.html Each page in its own folder → clean URLs
├── pay-calculator/index.html
├── salary-breakdown/index.html
├── about/ contact/ privacy-policy/ terms-of-use/ disclaimer/
├── 404.html
├── sitemap.xml  robots.txt  site.webmanifest  _config.yml
├── assets/
│   ├── css/style.css                All styles (tokens, layout, components, responsive, print)
│   ├── js/calc.js                   Pure calculation engine (time parsing, shifts, pay, budget)
│   ├── js/main.js                   Shared UI: mobile menu, animations, storage, 12/24h time inputs
│   ├── js/workhours.js              Work Hours Calculator
│   ├── js/pay.js                    Pay Calculator
│   ├── js/budget.js                 Salary Breakdown + SVG donut chart
│   ├── js/contact.js                Contact form (opens the visitor's email app)
│   └── img/                         favicon.svg, PNG icons, og-image.png (1200×630)
├── fr/ …                            French pages (same folder names)
├── ar/ …                            Arabic pages (dir="rtl")
├── assets/js/i18n.js                Calculator interface strings in EN / FR / AR
├── _src/                            SOURCE — not published
│   ├── site.json                    Site URL, contact email, last-updated date
│   ├── i18n.json                    Menu, footer, tool-card and language-switcher text in EN / FR / AR
│   ├── pages.json                   English: title, meta description, breadcrumbs, FAQs per page
│   ├── pages.fr.json  pages.ar.json Same for French and Arabic
│   ├── content/*.html               English page content
│   ├── content/fr/*.html            French page content
│   └── content/ar/*.html            Arabic page content
└── _tools/                          NOT published
    ├── build.py                     Generates every page + sitemap.xml + robots.txt
    └── check_links.py               Finds broken links, duplicate IDs, leftover placeholders
```

The `.html` pages are **generated** by `_tools/build.py` from `_src/` so the header, footer, SEO tags and structured data are identical everywhere. CSS and JS in `assets/` are used directly. GitHub Pages ignores folders starting with `_`.

### Editing

1. Change text in `_src/content/*.html`, or titles/descriptions/FAQs in `_src/pages.json`.
2. Rebuild (Python 3.8+, no packages needed):
   ```
   python _tools/build.py
   python _tools/check_links.py
   ```

### Translations (English, French, Arabic)

| What to change | Where |
|---|---|
| Page text | `_src/content/` (English), `_src/content/fr/`, `_src/content/ar/` |
| Titles, meta descriptions, FAQs | `_src/pages.json`, `_src/pages.fr.json`, `_src/pages.ar.json` |
| Menu, footer, "Other free tools" cards, switcher | `_src/i18n.json` |
| Calculator messages, results, default budget categories | `assets/js/i18n.js` |

The build adds `<html lang dir>`, `hreflang` alternate links (plus `x-default` → English), `og:locale`, and a sitemap with `xhtml:link` alternates for every language. Saved calculator entries are kept separately per language in the browser. Legal pages in French and Arabic say that the English version prevails if the translations differ. Have a native speaker or legal professional review them before launch if you need legal certainty.

To add another language: add a block to `_src/i18n.json` and `assets/js/i18n.js`, create `pages.xx.json` and `content/xx/`, then register it in the `LANGS` table at the top of `_tools/build.py`.

## 3. Before you publish: set your domain and email

Edit `_src/site.json`:

```json
{
  "site_url": "https://www.YOUR-DOMAIN.com",
  "site_name": "WorkHours",
  "contact_email": "you@YOUR-DOMAIN.com",
  "last_updated": "2026-11-25"
}
```

- `site_url` feeds canonical URLs, Open Graph tags, structured data, `sitemap.xml` and `robots.txt`.
  For a GitHub project site use `https://USERNAME.github.io/REPO-NAME`.
- `contact_email` appears on Contact, Privacy and Terms pages.

Then run `python _tools/build.py`.
*(No Python? Find-and-replace `https://www.example.com` and `contact@example.com` in every `.html`, `sitemap.xml` and `robots.txt`, and in `404.html` set `<base href="/">` to `/REPO-NAME/` for a project site.)*

## 4. Deploy free on GitHub Pages

1. Sign in to github.com → **New repository** → name it (e.g. `workhours`) → **Public** → Create.
2. Upload the files:
   - **Browser:** *Add file → Upload files*, drag in everything from this project (including `_src`, `_tools`, `_config.yml`), then **Commit changes**.
   - **Git:**
     ```
     git init
     git add .
     git commit -m "WorkHours website"
     git branch -M main
     git remote add origin https://github.com/USERNAME/workhours.git
     git push -u origin main
     ```
3. Repository **Settings → Pages** → *Build and deployment*: **Deploy from a branch**, branch **main**, folder **/ (root)** → **Save**.
4. After 1–2 minutes the site is live at `https://USERNAME.github.io/workhours/`.
5. Put that URL (or your custom domain) in `_src/site.json`, rebuild, and push again.

**Custom domain (recommended for SEO and AdSense):** Settings → Pages → *Custom domain* → enter `www.yourdomain.com`. At your registrar add a `CNAME` record `www → USERNAME.github.io` (and GitHub's `A` records for the bare domain). Tick **Enforce HTTPS** when available. `robots.txt` only works at a domain root, so a custom domain (or a `USERNAME.github.io` user site) is best.

**After launch:** add the site to Google Search Console and submit `https://YOUR-DOMAIN/sitemap.xml`.

## 5. Adding Google AdSense after approval

The site is **not connected to AdSense** and shows no ads. Reserved ad slots are empty `<div class="ad-slot">` elements that are invisible (CSS `:empty`) until you paste real ad code. They sit outside the calculator cards, below each tool and at the end of content, never next to Calculate buttons.

| Location | File | Marker |
|---|---|---|
| Home page (between "How it works" and "Why") | `_src/content/home.html` (+ `fr/`, `ar/` copies) | `{{ad:home}}` |
| Below each tool | `_src/content/work-hours.html`, `pay.html`, `salary-breakdown.html` (+ `fr/`, `ar/`) | `{{ad:below-tool}}` |
| End of content on each tool page | same files | `{{ad:end-of-content}}` |

Easiest option for all 27 pages at once: edit the `ad_slot()` function in `_tools/build.py` so it outputs your AdSense unit, then rebuild.

Steps after approval:

1. **Site-wide script:** open `_tools/build.py`, find the comment `<!-- Google AdSense: ... -->` in the `<head>` template, and paste the `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>` tag from your AdSense account right after it.
2. **Ad units:** in the content files, replace a marker such as `{{ad:below-tool}}` with:
   ```html
   <div class="ad-slot">
     <!-- paste the <ins class="adsbygoogle" ...></ins> and its <script> from AdSense here -->
   </div>
   ```
   (Or keep the marker and edit `ad_slot()` in `build.py` to output your unit for every slot.) The "Advertisement" label appears automatically.
3. **ads.txt:** create `ads.txt` in the project root with the line AdSense gives you (e.g. `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0`).
4. **Privacy Policy:** in `_src/content/privacy.html`, section 4, change "no advertising is displayed" to say ads are active. If you serve visitors in the EEA, UK or Switzerland, enable a Google-certified consent message (AdSense → Privacy & messaging).
5. Run `python _tools/build.py` and push.

Never click your own ads or ask others to.

## 6. SEO included

- Unique `<title>`, meta description and one H1 per page; structured H2s; original, useful content.
- Canonical URLs, Open Graph + Twitter Card tags, share image, favicon (SVG + PNG + Apple touch icon), web manifest.
- JSON-LD only where accurate: `WebSite` (home), `BreadcrumbList`, `WebApplication` for each free tool, `FAQPage` generated from the same FAQ text shown on the page.
- Internal links between all tools (including "Calculate pay for these hours" and "Plan a budget with this monthly pay" hand-offs), `sitemap.xml`, `robots.txt`, a 404 page.
- Keywords used naturally: free work hours calculator, calculate hours worked, work time calculator, hourly pay calculator, salary breakdown calculator, monthly budget calculator.

## 7. Calculation rules

- **Net hours** = (end − start) − break. If end is earlier than start, the shift ends the next day (+24 h). Same start/end, or a break ≥ the shift, shows a clear error.
- **Gross pay** = rate × hours + overtime hours × (rate × 1 or 1.5). The 1.5× option is off by default and labeled as an estimate (exempt employees and state rules differ).
- **Period equivalents:** annual = period pay × (260 daily | 52 weekly | 26 biweekly | 12 monthly | 1 annual); others = annual ÷ their factor.
- **Budget:** total expenses = all categories except Savings; left over = income − expenses − savings; share = amount ÷ income; savings rate = savings ÷ income. Over-budget warning when expenses + savings > income.
- **Validation:** empty required fields, non-numbers, negatives, impossible hours (e.g. > 24 per day, > 168 per week) and amounts over $1 billion are rejected with field-level messages. Results update live after the first calculation and clear while an input is invalid, so they are never stale.

## 8. Testing performed

- 20 unit checks on `calc.js` (time parsing, midnight, overnight, invalid times, break longer than shift, pay with 1× and 1.5× overtime, all period conversions, budget totals, over-budget, zero income) — all pass.
- Browser end-to-end tests: empty inputs, negative numbers, very large amounts, overnight shift (10 PM–6:30 AM), the 8 AM–5 PM / 1-hour example (= 8:00), overtime ($20 × 40 + 5 OT at 1.5× = $950), expenses greater than income (warning + shortfall), adding/renaming/deleting categories (incl. Savings), changing inputs after results, data surviving a page reload.
- `check_links.py`: 9 pages, 0 broken links, 0 duplicate IDs. No console errors on any page. No horizontal scrolling at 375 px (phone) width.

---

## ملخص سريع بالعربية

- **التشغيل محلياً:** نفّذ `python -m http.server 8000` ثم افتح `http://localhost:8000`.
- **قبل النشر:** عدّل `site_url` و`contact_email` في `_src/site.json` ثم شغّل `python _tools/build.py`.
- **النشر المجاني:** ارفع الملفات إلى مستودع عام على GitHub، ثم من **Settings → Pages** اختر الفرع `main` والمجلد `/ (root)`.
- **AdSense بعد الموافقة:** ضع سكربت AdSense في قالب `<head>` داخل `_tools/build.py` عند التعليق "Google AdSense"، وضع وحدات الإعلان مكان العلامات `{{ad:...}}` في ملفات `_src/content`، وأنشئ ملف `ads.txt`، وحدّث سياسة الخصوصية، ثم أعد البناء.
