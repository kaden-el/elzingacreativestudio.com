#!/usr/bin/env python3
"""
apply-brand.py — roll the ELZINGA. brand system across every page.

This is the pipeline that makes a Claude Design brand drop apply to the WHOLE
site in one pass. The look lives in two files (css/brand.css + js/brand.js);
this script does the per-page wiring so all 77 HTML pages inherit it:

  1. swap the Google-Fonts <link> to the brand's display + text families
  2. inject  <link rel="stylesheet" href="css/brand.css">  into <head>
  3. rewrite legacy palette hexes  ->  Edition-02 hexes (catches inline :root
     overrides + any hardcoded uses)
  4. swap hardcoded font-family names in inline styles
  5. add the signature accent "dot" to the nav wordmark
  6. inject  <script src="js/brand.js" defer></script>  before </body>
     (skipped on private app pages — see APP_PAGES)

Idempotent: safe to re-run. After a future brand change, edit css/brand.css +
js/brand.js + the maps below, then re-run this script. See DESIGN.md.

Usage:
    python3 scripts/apply-brand.py            # convert all pages
    python3 scripts/apply-brand.py --dry-run  # report only, write nothing
    python3 scripts/apply-brand.py index.html # convert specific page(s)
"""
import re
import sys
import glob
import os

# ── Edition 02 brand constants ──────────────────────────────────────────────
FONTS_LINK = ('<link href="https://fonts.googleapis.com/css2?'
              'family=Syne:wght@400;500;600;700;800&'
              'family=Spline+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">')

# legacy hex  ->  Edition 02 hex   (lowercase keys; matched case-insensitively)
PALETTE = {
    '#faf8f2': '#F2EEE5',   # Bone / canvas
    '#2b5196': '#1E5C8B',   # Cobalt accent (legacy --green / --cobalt)
    '#234277': '#184B73',   # Cobalt hover-darken (legacy --green-dk)
    '#15120d': '#19150F',   # Ink
}

# inline font-family swaps (quoted forms only — safe)
FONT_SWAPS = [
    ("'Fraunces'", "'Syne'"), ('"Fraunces"', '"Syne"'),
    ("'Inter'", "'Spline Sans'"), ('"Inter"', '"Spline Sans"'),
]

# Private/app pages get the visual rebrand but NOT the flourish JS
# (grain/cursor/progress would be odd on a dashboard, calculator, or login).
APP_PAGES = {
    'agency_dashboard.html', 'client_dashboard.html', 'client_intake.html',
    'login_portal.html', 'elzinga-pricing-calculator.html',
}
# Never touch the guide itself (already authored in the brand).
SKIP = {'brand-guide.html'}

BRAND_CSS_LINK = '<link rel="stylesheet" href="css/brand.css">'
BRAND_JS_TAG = '<script src="js/brand.js" defer></script>'


def convert(html, fname):
    changes = []

    # 1. Google-Fonts link → Syne + Spline (matches any css2 link mentioning Fraunces)
    def _font_link(m):
        return FONTS_LINK
    new, n = re.subn(
        r'<link[^>]*fonts\.googleapis\.com/css2\?family=Fraunces[^>]*>',
        _font_link, html)
    if n:
        html = new
        changes.append(f'fonts→Syne/Spline ({n})')

    # 2. inject brand.css after cobalt-gallery.css (or after the fonts link)
    if 'css/brand.css' not in html:
        if 'css/cobalt-gallery.css' in html:
            html = re.sub(r'(<link[^>]*css/cobalt-gallery\.css[^>]*>)',
                          r'\1\n  ' + BRAND_CSS_LINK, html, count=1)
        elif FONTS_LINK in html:
            html = html.replace(FONTS_LINK, FONTS_LINK + '\n  ' + BRAND_CSS_LINK, 1)
        else:  # fall back to right after <head>
            html = re.sub(r'(<head[^>]*>)', r'\1\n  ' + BRAND_CSS_LINK, html, count=1)
        changes.append('+brand.css')

    # 3. palette hexes (case-insensitive, preserve nothing)
    pal = 0
    for old, new_hex in PALETTE.items():
        html, c = re.subn(re.escape(old), new_hex, html, flags=re.IGNORECASE)
        pal += c
    if pal:
        changes.append(f'palette×{pal}')

    # 4. inline font-family names
    fs = 0
    for old, new_name in FONT_SWAPS:
        before = html
        html = html.replace(old, new_name)
        fs += (before != html)
    if fs:
        changes.append(f'fonts-inline×{fs}')

    # 5. accent dot on the nav wordmark (idempotent)
    if 'class="logo-full">Elzinga Creative Studio<' in html:
        html = html.replace(
            '<span class="logo-full">Elzinga Creative Studio</span>',
            '<span class="logo-full">Elzinga<span class="ez-dot-accent">.</span> Creative Studio</span>')
        changes.append('+dot')

    # 6. brand.js before </body> (skip app pages)
    if fname not in APP_PAGES and 'js/brand.js' not in html and '</body>' in html:
        html = html.replace('</body>', '  ' + BRAND_JS_TAG + '\n</body>', 1)
        changes.append('+brand.js')

    return html, changes


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    files = args if args else sorted(glob.glob('*.html'))
    touched = 0
    for f in files:
        if f in SKIP:
            print(f'  skip   {f}  (guide)')
            continue
        if not os.path.exists(f):
            print(f'  MISS   {f}')
            continue
        with open(f, encoding='utf-8') as fh:
            html = fh.read()
        new, changes = convert(html, f)
        if changes and new != html:
            touched += 1
            tag = '[dry] ' if dry else ''
            print(f'  {tag}edit {f:<52} {" · ".join(changes)}')
            if not dry:
                with open(f, 'w', encoding='utf-8') as fh:
                    fh.write(new)
        else:
            print(f'  ok     {f:<52} (already current)')
    print(f'\n{"Would touch" if dry else "Touched"} {touched} file(s).')


if __name__ == '__main__':
    main()
