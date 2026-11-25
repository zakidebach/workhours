#!/usr/bin/env python3
"""Check built pages for broken internal links/assets, duplicate IDs and leftover {{placeholders}}.
Usage: python _tools/check_links.py"""
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {"_src", "_tools", ".git"}


class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.ids = [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for k in ("href", "src"):
            if k in a and a[k]:
                self.refs.append(a[k])
        if "id" in a:
            self.ids.append(a["id"])


def pages():
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if f.endswith(".html"):
                yield os.path.join(d, f)


errors = 0
count = 0
for page in pages():
    if os.path.basename(page) == "404.html":
        continue  # uses <base href>, checked manually
    count += 1
    text = open(page, encoding="utf-8").read()
    rel = os.path.relpath(page, ROOT)
    if "{{" in text:
        print("PLACEHOLDER", rel, re.findall(r"\{\{[^}]*\}\}", text)[:3]); errors += 1
    c = Collector(); c.feed(text)
    dup = {i for i in c.ids if c.ids.count(i) > 1}
    if dup:
        print("DUPLICATE ID", rel, dup); errors += 1
    ids = set(c.ids)
    for ref in c.refs:
        if re.match(r"^(https?:|mailto:|data:)", ref):
            continue
        if ref.startswith("#"):
            if ref != "#" and ref[1:] not in ids:
                print("MISSING ANCHOR", rel, ref); errors += 1
            continue
        target = os.path.normpath(os.path.join(os.path.dirname(page), ref.split("#")[0].split("?")[0]))
        if os.path.isdir(target):
            target = os.path.join(target, "index.html")
        if not os.path.exists(target):
            print("BROKEN", rel, "->", ref); errors += 1

print("Checked %d pages, %d problem(s)." % (count, errors))
sys.exit(1 if errors else 0)
