# WorkHours launch checklist

Live site: https://zakidebach.github.io/workhours/
Repository: https://github.com/zakidebach/workhours
Hosting: GitHub Pages, branch `main`, folder `/` (free). Every push to `main` redeploys the site automatically within 1–2 minutes.

## Done
- [x] Git and GitHub CLI installed; repository created and pushed
- [x] GitHub Pages enabled (HTTPS enforced) and the build succeeded
- [x] `site_url` set to the live address; canonical, hreflang, Open Graph and sitemap use it
- [x] All 27 pages + assets return 200 on the live site; `_src/`, `_tools/`, `README.md` are not published
- [x] Calculators tested on the live site in English, French and Arabic
- [x] Search Console support built in: `google_site_verification` in `_src/site.json`

## 1. Google Search Console (needs your Google account)
1. Go to https://search.google.com/search-console and click **Add property**.
2. Choose **URL prefix** and enter `https://zakidebach.github.io/workhours/`.
3. Choose the **HTML tag** method. Copy only the `content="…"` value.
4. Put it in `_src/site.json` → `"google_site_verification": "PASTE_VALUE"`, then:
   ```
   python _tools/build.py
   git commit -am "Add Search Console verification"
   git push
   ```
5. Wait ~2 minutes, click **Verify**, then open **Sitemaps** and submit `sitemap.xml`
   (full URL: `https://zakidebach.github.io/workhours/sitemap.xml`).

Note: Google only reads `robots.txt` at the root of a host, so on `zakidebach.github.io/workhours/` the file in this repo is ignored. Submitting the sitemap in Search Console covers this. With a custom domain, `robots.txt` works normally.

## 2. Custom domain (recommended; needed in practice for AdSense)
Buy a domain yourself (about $10–15/year for a `.com`) from any registrar, such as Cloudflare Registrar, Porkbun or Namecheap. Nothing has been purchased.

DNS records to add at the registrar (GitHub Pages official addresses):

| Type | Host | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | zakidebach.github.io |

Then:
1. Repository **Settings → Pages → Custom domain** → `www.yourdomain.com` → Save (GitHub adds a `CNAME` file).
   Optional: verify the domain under GitHub **Settings → Pages → Verified domains** to prevent takeover.
2. Set `"site_url": "https://www.yourdomain.com"` in `_src/site.json`, run `python _tools/build.py`, commit and push.
3. When the certificate is issued, tick **Enforce HTTPS**.
4. In Search Console, add a **Domain** property for the new domain (DNS TXT verification) and submit the sitemap again.

## 3. Google AdSense (needs your account; apply after the domain works)
AdSense asks you to add a site you own at the root of the domain and to publish `ads.txt` at that root. A path on `github.io` (`/workhours/`) can't serve a root `ads.txt`, so apply **after** the custom domain is live.
1. Sign up at https://adsense.google.com and add your domain.
2. Paste the AdSense `<script>` where `_tools/build.py` says `<!-- Google AdSense: ... -->` (it is in the `<head>` template).
3. Create `ads.txt` in the repo root with the exact line AdSense shows you.
4. Rebuild, commit, push, then click **Request review** in AdSense.
5. After approval: put ad units in the empty `ad-slot` placeholders (edit `ad_slot()` in `_tools/build.py` to fill all 27 pages at once), update the "Advertising" section of the Privacy Policy (EN/FR/AR), and enable Google's consent message for visitors from the EEA, UK and Switzerland.

## 4. Before launch
- Review the French and Arabic translations, especially the legal pages, with a native speaker.
- The contact email shown on the site is the one set in `_src/site.json` (`contact_email`). Change it there if you prefer a dedicated address, then rebuild and push.
