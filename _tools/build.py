#!/usr/bin/env python3
"""
WorkHours static site builder (English, French, Arabic).

Assembles every page from the shared layout below plus the page bodies, then writes:
  English  ->  /<page>/index.html          from _src/pages.json      + _src/content/*.html
  French   ->  /fr/<page>/index.html       from _src/pages.fr.json   + _src/content/fr/*.html
  Arabic   ->  /ar/<page>/index.html (RTL) from _src/pages.ar.json   + _src/content/ar/*.html
  plus 404.html, sitemap.xml (with hreflang alternates) and robots.txt

Interface text shared by all pages (menu, footer, tool cards...) lives in _src/i18n.json.

Usage (Python 3.8+, no packages needed):
    python _tools/build.py

Change site_url / contact_email in _src/site.json, then rebuild.
Folders starting with "_" are ignored by GitHub Pages (Jekyll), so _src and _tools are not published.
"""
import json
import html
import os
import re
from datetime import date
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "_src")


def load_json(*parts):
    with open(os.path.join(SRC, *parts), encoding="utf-8") as fh:
        return json.load(fh)


CFG = load_json("site.json")
SITE_URL = CFG["site_url"].rstrip("/")
SITE_NAME = CFG["site_name"]
EMAIL = CFG["contact_email"]
BUILD_DATE = CFG.get("last_updated") or date.today().isoformat()
BASE_PATH = (urlparse(SITE_URL).path or "").rstrip("/") + "/"
# Optional: Google Search Console "HTML tag" verification token (only the content="..." value).
GSC_TOKEN = (CFG.get("google_site_verification") or "").strip()

UI = load_json("i18n.json")

LANGS = {
    "en": {"prefix": "", "pages": "pages.json", "content": "content", "dir": "ltr", "og": "en_US", "html": "en-US"},
    "fr": {"prefix": "fr/", "pages": "pages.fr.json", "content": os.path.join("content", "fr"), "dir": "ltr", "og": "fr_FR", "html": "fr"},
    "ar": {"prefix": "ar/", "pages": "pages.ar.json", "content": os.path.join("content", "ar"), "dir": "rtl", "og": "ar_AR", "html": "ar"},
}
LANG_ORDER = ["en", "fr", "ar"]

PAGES = {lang: load_json(LANGS[lang]["pages"]) for lang in LANG_ORDER}
SLUGS = {lang: {p["path"] for p in PAGES[lang]} for lang in LANG_ORDER}

NAV = ["work-hours-calculator/", "pay-calculator/", "salary-breakdown/", "about/"]

LOGO = ('<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#0f2b52"/>'
        '<circle cx="20" cy="21" r="11" fill="none" stroke="#fff" stroke-width="3"/>'
        '<path d="M20 15v6.5l4.5 3" fill="none" stroke="#5fd3a8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
        '<path d="M16 6h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>')

ARROW = ('<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
         'stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>')
GLOBE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
         'stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>')

# The three tools ("Other free tools" cards). Names/descriptions come from _src/i18n.json.
TOOLS = [
    {"path": "work-hours-calculator/", "key": "hours", "tone": "blue",
     "icon": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'},
    {"path": "pay-calculator/", "key": "pay", "tone": "green",
     "icon": '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 10v5M18 10v5"/>'},
    {"path": "salary-breakdown/", "key": "budget", "tone": "amber",
     "icon": '<path d="M21 12a9 9 0 11-9-9v9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/>'},
]


def esc(s):
    return html.escape(s, quote=True)


def u(lang, key):
    """Interface string for a language (falls back to English)."""
    return UI[lang].get(key, UI["en"][key])


def abs_url(lang, path):
    return SITE_URL + "/" + LANGS[lang]["prefix"] + path


def faq_html(items):
    out = ['<div class="faq-list">']
    for q, a in items:
        out.append('<details class="faq-item"><summary>%s</summary><div class="faq-body"><p>%s</p></div></details>' % (esc(q), a))
    out.append("</div>")
    return "\n".join(out)


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s)


def json_ld(obj):
    return '<script type="application/ld+json">%s</script>' % json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def schemas(page, lang):
    out = []
    url = abs_url(lang, page["path"])
    home = abs_url(lang, "")
    org = {"@type": "Organization", "name": SITE_NAME, "url": SITE_URL + "/",
           "logo": SITE_URL + "/assets/img/icon-512.png"}
    in_lang = LANGS[lang]["html"]
    if page["path"] == "":
        out.append({"@context": "https://schema.org", "@type": "WebSite", "name": SITE_NAME, "url": home,
                    "description": page["description"], "inLanguage": in_lang, "publisher": org})
    crumbs = page.get("crumbs")
    if crumbs:
        items = [{"@type": "ListItem", "position": 1, "name": u(lang, "home"), "item": home}]
        for i, (name, p) in enumerate(crumbs, start=2):
            items.append({"@type": "ListItem", "position": i, "name": name, "item": abs_url(lang, p)})
        out.append({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items})
    if page.get("kind") == "tool":
        out.append({"@context": "https://schema.org", "@type": "WebApplication", "name": page["app_name"],
                    "url": url, "description": page["description"], "applicationCategory": "BusinessApplication",
                    "operatingSystem": "Any (web browser)", "browserRequirements": "Requires JavaScript",
                    "isAccessibleForFree": True, "inLanguage": in_lang,
                    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}, "publisher": org})
    if page.get("faq"):
        out.append({"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": in_lang, "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)}}
            for q, a in page["faq"]]})
    return "\n".join(json_ld(o) for o in out)


def lang_switch(lang, slug, site_root):
    """Links to the same page in the other languages (falls back to that language's home page)."""
    links = []
    for other in LANG_ORDER:
        target = slug if slug in SLUGS[other] else ""
        href = site_root + LANGS[other]["prefix"] + target
        cur = ' aria-current="true"' if other == lang else ""
        links.append('<a href="%s" hreflang="%s" lang="%s"%s>%s</a>' % (href or "./", other, other, cur, UI[other]["lang_name"]))
    return ('<li class="lang-item"><div class="lang-switch" role="group" aria-label="%s">%s%s</div></li>'
            % (esc(u(lang, "language")), GLOBE, "".join(links)))


def header(lang, lang_root, site_root, active, slug):
    links = []
    for p in NAV:
        cur = ' aria-current="page"' if active == p else ""
        links.append('<li><a href="%s%s"%s>%s</a></li>' % (lang_root, p, cur, esc(u(lang, "nav." + p.strip("/")))))
    return """<a class="skip-link" href="#main">%(skip)s</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="%(home)s" aria-label="%(home_label)s">%(logo)s<span>Work<b>Hours</b></span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="%(menu)s">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
    <nav id="main-nav" class="main-nav" aria-label="%(nav_label)s">
      <ul>%(links)s%(switch)s</ul>
    </nav>
  </div>
</header>""" % {"home": lang_root or "./", "logo": LOGO, "links": "".join(links), "skip": esc(u(lang, "skip")),
                 "home_label": esc(u(lang, "home_label")), "menu": esc(u(lang, "menu")), "nav_label": esc(u(lang, "nav_label")),
                 "switch": lang_switch(lang, slug, site_root)}


def breadcrumbs(lang, lang_root, crumbs):
    if not crumbs:
        return ""
    parts = ['<li><a href="%s">%s</a></li>' % (lang_root or "./", esc(u(lang, "home")))]
    for i, (name, p) in enumerate(crumbs):
        if i == len(crumbs) - 1:
            parts.append('<li aria-current="page">%s</li>' % esc(name))
        else:
            parts.append('<li><a href="%s%s">%s</a></li>' % (lang_root, p, esc(name)))
    return '<nav class="breadcrumbs container" aria-label="%s"><ol>%s</ol></nav>' % (esc(u(lang, "breadcrumb")), "".join(parts))


def footer(lang, r):
    def link(path, key):
        return '<li><a href="%s%s">%s</a></li>' % (r, path, esc(u(lang, key)))
    return """<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <a class="brand" href="%(home)s">%(logo)s<span>Work<b>Hours</b></span></a>
        <p>%(about)s</p>
      </div>
      <div>
        <h2>%(h_tools)s</h2>
        <ul>%(tools)s</ul>
      </div>
      <div>
        <h2>%(h_company)s</h2>
        <ul>%(company)s</ul>
      </div>
      <div>
        <h2>%(h_legal)s</h2>
        <ul>%(legal)s</ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; <span data-year>%(year)s</span> WorkHours. %(rights)s</span>
      <span>%(note)s</span>
    </div>
  </div>
</footer>""" % {
        "home": r or "./", "logo": LOGO, "year": BUILD_DATE[:4],
        "about": esc(u(lang, "footer_about")), "rights": esc(u(lang, "rights")), "note": esc(u(lang, "footer_note")),
        "h_tools": esc(u(lang, "h_tools")), "h_company": esc(u(lang, "h_company")), "h_legal": esc(u(lang, "h_legal")),
        "tools": link("work-hours-calculator/", "tool.hours.name") + link("pay-calculator/", "tool.pay.name") + link("salary-breakdown/", "tool.budget.name"),
        "company": link("about/", "nav.about") + link("contact/", "contact"),
        "legal": link("privacy-policy/", "privacy") + link("terms-of-use/", "terms") + link("disclaimer/", "disclaimer"),
    }


def tool_icon(t):
    return ('<span class="tool-icon tone-%s"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg></span>') % (t["tone"], t["icon"])


def more_tools(lang, r, current):
    """Full-width section of large cards for the other tools (shown right after a calculator)."""
    cards = []
    for t in TOOLS:
        if t["path"] == current:
            continue
        k = "tool." + t["key"] + "."
        cards.append(
            '<a class="other-tool tone-%s" href="%s%s">%s'
            '<span class="ot-body"><span class="ot-tag">%s</span><strong>%s</strong><span class="ot-desc">%s</span></span>'
            '<span class="ot-cta">%s %s</span></a>'
            % (t["tone"], r, t["path"], tool_icon(t), esc(u(lang, "free_tool")), esc(u(lang, k + "name")),
               esc(u(lang, k + "desc")), esc(u(lang, k + "cta")), ARROW))
    return ('<section class="container more-tools" aria-labelledby="more-tools-title">'
            '<div class="more-tools-head"><h2 id="more-tools-title">%s</h2><p>%s</p></div>'
            '<div class="other-tools-grid">%s</div></section>') % (esc(u(lang, "more_tools")), esc(u(lang, "more_tools_sub")), "".join(cards))


def sidebar_tools(lang, r, current):
    """Compact visual cards for the sticky sidebar."""
    items = []
    for t in TOOLS:
        if t["path"] == current:
            continue
        k = "tool." + t["key"] + "."
        items.append('<a class="mini-tool tone-%s" href="%s%s">%s<span><strong>%s</strong><small>%s</small></span>%s</a>'
                     % (t["tone"], r, t["path"], tool_icon(t), esc(u(lang, k + "name")), esc(u(lang, k + "desc")), ARROW))
    return '<div class="card side-tools"><h2>%s</h2>%s</div>' % (esc(u(lang, "more_tools")), "".join(items))


def ad_slot(name):
    # Empty on purpose: the slot stays hidden (CSS :empty) until real AdSense code is pasted in.
    return ('<!-- AD SLOT "%s": paste your approved Google AdSense <ins> code inside this div. -->\n'
            '<div class="ad-slot" data-ad-slot="%s"></div>') % (name, name)


def alternates(page, lang):
    """hreflang links for every language that has this page, plus x-default (English)."""
    out = []
    for other in LANG_ORDER:
        if page["path"] in SLUGS[other]:
            out.append('<link rel="alternate" hreflang="%s" href="%s">' % (other, abs_url(other, page["path"])))
    if page["path"] in SLUGS["en"]:
        out.append('<link rel="alternate" hreflang="x-default" href="%s">' % abs_url("en", page["path"]))
    return "\n".join(out)


def render(page, lang, is_404=False):
    L = LANGS[lang]
    out_path = L["prefix"] + page["path"]
    site_root = "" if is_404 else "../" * out_path.count("/")
    lang_root = site_root + L["prefix"]
    with open(os.path.join(SRC, L["content"], page["content"]), encoding="utf-8") as fh:
        body = fh.read()
    if page.get("faq"):
        body = body.replace("{{faq}}", faq_html(page["faq"]))
    body = body.replace("{{more_tools}}", more_tools(lang, lang_root, page["path"]))
    body = body.replace("{{sidebar_tools}}", sidebar_tools(lang, lang_root, page["path"]))
    body = body.replace("{{root}}", lang_root).replace("{{site_root}}", site_root)
    body = body.replace("{{home}}", lang_root or "./").replace("{{email}}", EMAIL).replace("{{updated}}", BUILD_DATE)
    body = re.sub(r"\{\{ad:([a-z0-9-]+)\}\}", lambda m: ad_slot(m.group(1)), body)
    url = abs_url(lang, page["path"])
    title, desc = page["title"], page["description"]
    robots = "noindex, follow" if page.get("noindex") else "index, follow, max-image-preview:large"
    base = '<base href="%s">\n' % BASE_PATH if is_404 else ""
    scripts = ['<script src="%sassets/js/%s" defer></script>' % (site_root, s)
               for s in ["i18n.js", "calc.js", "main.js"] + page.get("scripts", [])]
    head_links = "" if is_404 else '<link rel="canonical" href="%s">\n%s\n' % (url, alternates(page, lang))
    og_url = "" if is_404 else '<meta property="og:url" content="%s">\n' % url
    og_alt = "".join('<meta property="og:locale:alternate" content="%s">\n' % LANGS[o]["og"]
                     for o in LANG_ORDER if o != lang and page["path"] in SLUGS[o])
    return """<!DOCTYPE html>
<html lang="%(html_lang)s" dir="%(dir)s" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
%(base)s<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<meta name="robots" content="%(robots)s">
%(head_links)s%(gsc)s<meta name="theme-color" content="#0f2b52">
<meta property="og:type" content="website">
<meta property="og:site_name" content="WorkHours">
<meta property="og:locale" content="%(og_locale)s">
%(og_alt)s<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
%(og_url)s<meta property="og:image" content="%(site)s/assets/img/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="%(og_img_alt)s">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%(title)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="twitter:image" content="%(site)s/assets/img/og-image.png">
<link rel="icon" href="%(root)sassets/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="%(root)sassets/img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="%(root)sassets/img/apple-touch-icon.png">
<link rel="manifest" href="%(root)ssite.webmanifest">
<link rel="stylesheet" href="%(root)sassets/css/style.css">
<!-- Google AdSense: after approval, paste the AdSense <script> tag from your AdSense account here. -->
%(schema)s
</head>
<body>
%(header)s
%(crumbs)s
<main id="main">
%(body)s
</main>
%(footer)s
%(scripts)s
</body>
</html>
""" % {
        "html_lang": L["html"], "dir": L["dir"], "base": base, "title": esc(title), "desc": esc(desc), "robots": robots,
        "gsc": ('<meta name="google-site-verification" content="%s">\n' % esc(GSC_TOKEN)) if GSC_TOKEN and not is_404 else "",
        "head_links": head_links, "og_locale": L["og"], "og_alt": og_alt, "og_url": og_url, "site": SITE_URL,
        "og_img_alt": esc(u(lang, "og_alt")), "root": site_root,
        "schema": "" if is_404 else schemas(page, lang),
        "header": header(lang, lang_root, site_root, page["path"], page["path"]),
        "crumbs": breadcrumbs(lang, lang_root, page.get("crumbs")), "body": body.strip(), "footer": footer(lang, lang_root),
        "scripts": "\n".join(scripts),
    }


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def main():
    entries = []
    for lang in LANG_ORDER:
        for page in PAGES[lang]:
            out_rel = LANGS[lang]["prefix"] + page["path"]
            write(os.path.join(ROOT, out_rel, "index.html"), render(page, lang))
            if not page.get("noindex"):
                entries.append((lang, page))
        print("built %d %s pages" % (len(PAGES[lang]), lang.upper()))

    # 404 page: GitHub Pages serves it at any missing URL, so it uses <base href> + root-relative links.
    p404 = {"path": "", "title": "Page Not Found | WorkHours", "description": "The page you were looking for could not be found.",
            "content": "404.html", "noindex": True}
    write(os.path.join(ROOT, "404.html"), render(p404, "en", is_404=True).replace(' aria-current="page"', ""))
    print("built 404.html")

    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for lang, page in entries:
        alts = "".join('\n    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (o, abs_url(o, page["path"]))
                       for o in LANG_ORDER if page["path"] in SLUGS[o])
        if page["path"] in SLUGS["en"]:
            alts += '\n    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>' % abs_url("en", page["path"])
        sm.append("  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n    <priority>%s</priority>%s\n  </url>"
                  % (abs_url(lang, page["path"]), BUILD_DATE, page.get("priority", "0.6"), alts))
    sm.append("</urlset>")
    write(os.path.join(ROOT, "sitemap.xml"), "\n".join(sm) + "\n")
    write(os.path.join(ROOT, "robots.txt"), "User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE_URL)
    print("built sitemap.xml (%d URLs), robots.txt" % len(entries))


if __name__ == "__main__":
    main()
