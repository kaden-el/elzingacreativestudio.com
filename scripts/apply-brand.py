#!/usr/bin/env python3
"""
apply-brand.py — roll the ELZINGA brand system across every page.

This is the pipeline that makes a brand drop apply to the WHOLE site in one
pass. The look lives in two files (css/brand.css + js/brand.js); this script
does the per-page wiring so every HTML page (root + blog/) inherits it:

  1. swap the Google-Fonts <link> to the brand's families
  2. inject  <link rel="stylesheet" href="css/brand.css">  into <head>
  3. rewrite legacy palette hexes -> Edition-03 hexes (catches inline :root
     overrides + any hardcoded uses; Ed.01 AND Ed.02 hexes both mapped)
  4. swap hardcoded font-family names in inline styles
  5. keep the proof mark (red period) on the nav wordmark
  6. inject  <script src="js/brand.js" defer></script>  before </body>
     (skipped on private app pages — see APP_PAGES)

Blog pages live one level down: asset paths become ../css/… and ../js/….

Idempotent: safe to re-run. After a future brand change, edit css/brand.css +
js/brand.js + the maps below, then re-run this script. See DESIGN.md.

Usage:
    python3 scripts/apply-brand.py            # convert all pages (root + blog/)
    python3 scripts/apply-brand.py --dry-run  # report only, write nothing
    python3 scripts/apply-brand.py index.html # convert specific page(s)
"""
import re
import sys
import glob
import os

# ── Edition 03 brand constants ──────────────────────────────────────────────
FONTS_LINK = ('<link href="https://fonts.googleapis.com/css2?'
              'family=Archivo:ital,wdth,wght@0,62..125,300..900;1,62..125,300..900&'
              'family=Fragment+Mono:ital@0;1&display=swap" rel="stylesheet">')

# legacy hex  ->  Edition 03 hex   (lowercase keys; matched case-insensitively)
# Sources cover Edition 01 (Cobalt Gallery) AND Edition 02 (warm editorial).
PALETTE = {
    # canvases
    '#faf8f2': '#F4F5F2',   # Ed.01 bone
    '#f2eee5': '#F4F5F2',   # Ed.02 bone          -> print paper
    '#eae4d7': '#EBEDE8',   # Ed.02 soft surface  -> cool soft
    # inks
    '#15120d': '#17181A',   # Ed.01 ink
    '#19150f': '#17181A',   # Ed.02 ink           -> photographic ink
    # accents (used inline as links/buttons -> AA-safe deep mark)
    '#2b5196': '#B22A12',   # Ed.01 cobalt
    '#1e5c8b': '#B22A12',   # Ed.02 cobalt        -> china-marker deep
    '#234277': '#8F2110',   # Ed.01 hover
    '#184b73': '#8F2110',   # Ed.02 hover         -> mark hover
    # supports
    '#c9b79c': '#A7ACA3',   # Ed.02 clay          -> cool support
    '#44504d': '#3E4348',   # Ed.02 slate
    '#4d4940': '#5A5E63',   # Ed.02 muted
    '#a9c0d8': '#C6CBD1',   # sky alias
    '#c9c0ae': '#B9BDB4',   # stone alias
    '#b23a2e': '#B22A12',   # Ed.02 error         -> unified mark family
    # secondary warm surfaces (blog + section tints) -> cool print equivalents
    '#ece6d9': '#E7E9E4',
    '#f4f1e8': '#EBEDE8',
    '#e8e0d8': '#E2E5E0',
    '#faf7f2': '#F4F5F2',
    '#ede4d8': '#E7E9E4',
    '#f5efe8': '#EFF1ED',
    '#fdecea': '#FBEAE6',
    # warm grays / stray accents found in the long tail
    '#79746a': '#75797E',   # warm gray text -> silver
    '#64748b': '#5A5E63',   # slate-blue text -> muted
    '#b04040': '#B22A12',   # old error red -> mark family
    '#f1f5f9': '#EFF1ED',   # bluish-white bg -> cool paper
    '#eef2ff': '#EBEDE8',   # indigo-white bg -> cool soft
    '#4f46e5': '#B22A12',   # dashboard indigo -> mark
    # the app pages' brown theme (intake / login / dashboards) -> proof room
    '#8b6347': '#B22A12',
    '#5c3d28': '#3E4348',
    '#7a6355': '#5A5E63',
    '#3d2b1f': '#17181A',
    '#2c1f14': '#141517',
    '#2b2620': '#1E2023',
    '#d4c4b0': '#E2E5E0',
    '#f0d9be': '#EFF1ED',
    '#fff8e7': '#F4F5F2',
}

# Old palette written as rgb()/rgba() triples — hex maps can't catch these.
# (old r,g,b) -> "r,g,b" replacement; alpha and prefix are preserved.
RGB_TRIPLES = [
    ((169, 192, 216), '198,203,209'),   # sky -> silver-light
    ((250, 248, 242), '244,245,242'),   # Ed.01 bone -> paper
    ((242, 238, 229), '244,245,242'),   # Ed.02 bone -> paper
    ((43, 81, 150),   '178,42,18'),     # Ed.01 cobalt -> mark-deep
    ((30, 92, 139),   '178,42,18'),     # Ed.02 cobalt -> mark-deep
    ((25, 21, 15),    '23,24,26'),      # Ed.02 ink -> ink
    ((21, 18, 13),    '23,24,26'),      # Ed.01 ink -> ink
    ((234, 228, 215), '235,237,232'),   # Ed.02 soft -> cool soft
]

# Prints aren't rounded: square every px-radius (circles/50% stay untouched).
RADIUS_RE = re.compile(r'(border-radius:\s*)(\d+)px', re.IGNORECASE)
RADIUS_VAR_RE = re.compile(r'(--radius[\w-]*:\s*)(\d+)px', re.IGNORECASE)

# inline font-family swaps (quoted forms only — safe)
FONT_SWAPS = [
    ("'Syne'", "'Archivo'"), ('"Syne"', '"Archivo"'),
    ("'Spline Sans'", "'Archivo'"), ('"Spline Sans"', '"Archivo"'),
    ("'Fraunces'", "'Archivo'"), ('"Fraunces"', '"Archivo"'),
    ("'Inter'", "'Archivo'"), ('"Inter"', '"Archivo"'),
    ("'Space Grotesk'", "'Archivo'"), ('"Space Grotesk"', '"Archivo"'),
    ("'Space Mono'", "'Fragment Mono'"), ('"Space Mono"', '"Fragment Mono"'),
    ("'IBM Plex Mono'", "'Fragment Mono'"), ('"IBM Plex Mono"', '"Fragment Mono"'),
    # app pages (intake/login/dashboards) ran on system fonts + Georgia
    ("'Helvetica Neue',Arial", "'Archivo',Arial"),
    ("'Helvetica Neue', Arial", "'Archivo', Arial"),
    ("font-family:Helvetica Neue,Arial", "font-family:'Archivo',Arial"),
    ("'Georgia',serif", "'Archivo',sans-serif"),
    ("'Georgia', serif", "'Archivo', sans-serif"),
    ("font-family:Georgia,serif", "font-family:'Archivo',sans-serif"),
    ("'Courier New',monospace", "'Fragment Mono',monospace"),
    ("font-family:Courier New,monospace", "font-family:'Fragment Mono',monospace"),
]

# Any Google-Fonts css2 link that names a retired family gets swapped whole.
RETIRED_FAMILY_LINK = re.compile(
    r'<link[^>]*fonts\.googleapis\.com/css2\?family='
    r'(?:Fraunces|Syne|Spline\+Sans|Inter|Space\+Grotesk)[^>]*>')

# Private/app pages get the visual rebrand but NOT the flourish JS.
APP_PAGES = {
    'agency_dashboard.html', 'client_dashboard.html', 'client_intake.html',
    'login_portal.html', 'elzinga-pricing-calculator.html',
}
# Never touch the guide itself (authored in the brand by hand).
SKIP = {'brand-guide.html'}


def asset_prefix(fname):
    """blog/foo.html links assets as ../css/…; root pages as css/…"""
    return '../' if os.path.dirname(fname) else ''


def convert(html, fname):
    changes = []
    pre = asset_prefix(fname)
    css_link = f'<link rel="stylesheet" href="{pre}css/brand.css">'
    js_tag = f'<script src="{pre}js/brand.js" defer></script>'

    # 1. Google-Fonts link → Archivo + Fragment Mono
    new, n = RETIRED_FAMILY_LINK.subn(FONTS_LINK, html)
    if n:
        html = new
        changes.append(f'fonts→Archivo/FragmentMono ({n})')

    # 2. inject brand.css (after cobalt-gallery.css, the fonts link, or <head>)
    if 'css/brand.css' not in html:
        if 'css/cobalt-gallery.css' in html:
            html = re.sub(r'(<link[^>]*css/cobalt-gallery\.css[^>]*>)',
                          r'\1\n  ' + css_link, html, count=1)
        elif FONTS_LINK in html:
            html = html.replace(FONTS_LINK, FONTS_LINK + '\n  ' + css_link, 1)
        else:
            html = re.sub(r'(<head[^>]*>)', r'\1\n  ' + css_link, html, count=1)
        changes.append('+brand.css')

    # 3. palette hexes (case-insensitive)
    pal = 0
    for old, new_hex in PALETTE.items():
        html, c = re.subn(re.escape(old), new_hex, html, flags=re.IGNORECASE)
        pal += c
    if pal:
        changes.append(f'palette×{pal}')

    # 3b. rgb()/rgba() forms of the old palette
    rgbn = 0
    for (r, g, b), new_triple in RGB_TRIPLES:
        pat = re.compile(r'(rgba?\(\s*)%d\s*,\s*%d\s*,\s*%d' % (r, g, b))
        html, c = pat.subn(r'\g<1>' + new_triple, html)
        rgbn += c
    if rgbn:
        changes.append(f'rgb×{rgbn}')

    # 4. inline font-family names
    fs = 0
    for old, new_name in FONT_SWAPS:
        before = html
        html = html.replace(old, new_name)
        fs += (before != html)
    if fs:
        changes.append(f'fonts-inline×{fs}')

    # 4b. square the corners (pills → rects, media → prints)
    def _sq(m):
        return m.group(1) + ('2px' if int(m.group(2)) > 3 else m.group(2) + 'px')
    html, r1 = RADIUS_RE.subn(_sq, html)
    html, r2 = RADIUS_VAR_RE.subn(_sq, html)
    if r1 + r2:
        changes.append(f'squared×{r1 + r2}')

    # 5. proof mark (red period) on the nav wordmark (idempotent)
    if 'class="logo-full">Elzinga Creative Studio<' in html:
        html = html.replace(
            '<span class="logo-full">Elzinga Creative Studio</span>',
            '<span class="logo-full">Elzinga<span class="ez-dot-accent">.</span> Creative Studio</span>')
        changes.append('+mark')

    # 6. brand.js before </body> (skip app pages)
    base = os.path.basename(fname)
    if base not in APP_PAGES and 'js/brand.js' not in html and '</body>' in html:
        html = html.replace('</body>', '  ' + js_tag + '\n</body>', 1)
        changes.append('+brand.js')

    return html, changes


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    files = args if args else sorted(glob.glob('*.html')) + sorted(glob.glob('blog/*.html'))
    touched = 0
    for f in files:
        if os.path.basename(f) in SKIP:
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
