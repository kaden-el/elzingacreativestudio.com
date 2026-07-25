#!/usr/bin/env python3
"""
Publish a blog post to elzingacreativestudio.com.

This is the script the `ecs-blog-post` skill has always referenced. The original
died with the old brain; this is a rebuild against the live blog markup.

    python3 scripts/new_blog.py draft.txt
    python3 scripts/new_blog.py draft.txt --dry-run
    cat draft.txt | python3 scripts/new_blog.py -

Input is exactly what the skill emits: a metadata block, then the body, ending
with a line containing only END.

    TITLE: Do Twilight Photos Help Sell Homes Faster in West Michigan?
    TAG: Real Estate
    SLUG: do-twilight-photos-sell-homes-grand-rapids
    DATE: 2026-06-01
    IMAGE: DSC08468-HDR.jpg
    DESCRIPTION: ...140-155 chars...
    EXCERPT: ~20 words
    READ_MIN: 7
    CTA_TEXT: Add a real twilight session to\\nyour next listing.
    CTA_LINK: real-estate-photography-grand-rapids.html

    [opening paragraph, no heading]

    # Section Heading
    Paragraph text.

    END

A post is four files, not one. This writes blog/<slug>.html and then wires the
post into blog.html (visible card + ItemList JSON-LD), feed.xml, and sitemap.xml
— the step that gets forgotten when posts are hand-built.

Safe to run unattended: it validates first, writes nothing if any check fails,
and refuses to overwrite an existing post unless --force is passed.
"""

import argparse
import html
import json
import os
import re
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLOG = os.path.join(ROOT, "blog")
DONOR = os.path.join(BLOG, "do-twilight-photos-sell-homes-grand-rapids.html")
BASE = "https://elzingacreativestudio.com/"
AUTHOR = "Kaden Elzinga"

REQUIRED = ["TITLE", "TAG", "SLUG", "DATE", "IMAGE", "DESCRIPTION", "EXCERPT", "READ_MIN", "CTA_TEXT", "CTA_LINK"]
VALID_TAGS = {"Real Estate", "Senior Portraits", "Commercial", "Weddings", "Videography"}


class Problem(Exception):
    pass


# --------------------------------------------------------------------- parsing

def parse(text):
    meta, body_lines, in_body = {}, [], False
    for raw in text.splitlines():
        if not in_body:
            m = re.match(r"^([A-Z_]+):\s*(.*)$", raw.strip())
            if m and m.group(1) in REQUIRED:
                meta[m.group(1)] = m.group(2).strip()
                continue
            # first non-metadata, non-blank line starts the body
            if raw.strip() and not raw.strip().startswith("```"):
                in_body = True
            else:
                continue
        if raw.strip() == "END":
            break
        body_lines.append(raw)
    return meta, "\n".join(body_lines).strip()


def validate(meta, body):
    missing = [k for k in REQUIRED if not meta.get(k)]
    if missing:
        raise Problem(f"missing metadata fields: {', '.join(missing)}")
    if meta["TAG"] not in VALID_TAGS:
        raise Problem(f"TAG must be one of {sorted(VALID_TAGS)}, got {meta['TAG']!r}")
    if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", meta["SLUG"]):
        raise Problem(f"SLUG must be kebab-case, got {meta['SLUG']!r}")
    try:
        datetime.strptime(meta["DATE"], "%Y-%m-%d")
    except ValueError:
        raise Problem(f"DATE must be YYYY-MM-DD, got {meta['DATE']!r}")
    if not str(meta["READ_MIN"]).isdigit():
        raise Problem(f"READ_MIN must be an integer, got {meta['READ_MIN']!r}")
    d = len(meta["DESCRIPTION"])
    if not 120 <= d <= 165:
        raise Problem(f"DESCRIPTION should be ~140-155 chars, got {d}")
    if '"' in meta["DESCRIPTION"]:
        raise Problem("DESCRIPTION must not contain double quotes")
    img = os.path.join(ROOT, "images", meta["IMAGE"])
    web = web_image(meta["IMAGE"])
    if not os.path.exists(img) and not os.path.exists(os.path.join(ROOT, web)):
        raise Problem(f"IMAGE not found: images/{meta['IMAGE']} (nor {web})")
    if not os.path.exists(os.path.join(ROOT, meta["CTA_LINK"].split("#")[0])):
        raise Problem(f"CTA_LINK target does not exist: {meta['CTA_LINK']}")
    if len(body.split()) < 400:
        raise Problem(f"body is only {len(body.split())} words; the skill calls for 700-1,100")
    if not re.search(r"^# ", body, re.M):
        raise Problem("body has no '# ' section headings")
    return True


def web_image(image):
    """images/<name>.jpg -> images/web/<stem>-1600.jpg when a web cut exists."""
    stem, ext = os.path.splitext(image)
    cand = f"images/web/{stem}-1600.jpg"
    if os.path.exists(os.path.join(ROOT, cand)):
        return cand
    cand2 = f"images/web/{stem}-1600.avif"
    if os.path.exists(os.path.join(ROOT, cand2)):
        return cand2
    return f"images/{image}"


# -------------------------------------------------------------------- rendering

def body_to_html(body, cta_text, cta_link):
    """Plain text with '# ' headings -> the site's post-content markup."""
    blocks, cur = [], []
    for line in body.split("\n"):
        if line.strip().startswith("# "):
            if cur:
                blocks.append(("p", "\n".join(cur).strip()))
                cur = []
            blocks.append(("h2", line.strip()[2:].strip()))
        elif not line.strip():
            if cur:
                blocks.append(("p", "\n".join(cur).strip()))
                cur = []
        else:
            cur.append(line.strip())
    if cur:
        blocks.append(("p", "\n".join(cur).strip()))

    # Drop the CTA in at roughly two-thirds through, immediately BEFORE a heading
    # so it closes the previous section rather than splitting a heading from its
    # own first paragraph.
    h2_idx = [i for i, (k, _) in enumerate(blocks) if k == "h2"]
    cta_before = h2_idx[max(1, int(len(h2_idx) * 0.66))] if len(h2_idx) >= 3 else None

    cta = (
        '    <div class="post-cta-inline">\n'
        f'      <span class="post-cta-text">{cta_text}</span>\n'
        f'      <a href="../{cta_link}" class="btn-cta">Book a Listing Shoot</a>\n'
        "    </div>"
    )

    out = []
    for i, (kind, txt) in enumerate(blocks):
        if cta_before is not None and i == cta_before:
            out.append(cta)
        out.append(f"    <h2>{inline(txt)}</h2>" if kind == "h2" else f"    <p>{inline(txt)}</p>")
    return "\n".join(out)


def inline(text):
    """Markdown-lite: **bold**, *em*, and [text](url) — everything else escaped."""
    text = html.escape(text, quote=False)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)
    return text


def existing_posts():
    """[(slug, tag, title, date)] for every published post, newest first."""
    out = []
    for f in os.listdir(BLOG):
        if not f.endswith(".html"):
            continue
        a = open(os.path.join(BLOG, f), encoding="utf-8").read()
        t = re.search(r'<h1 class="post-h1">(.*?)</h1>', a, re.S)
        tag = re.search(r'<span class="post-tag-header">(.*?)</span>', a, re.S)
        d = re.search(r'"datePublished":\s*"(\d{4}-\d{2}-\d{2})"', a)
        if t and tag:
            out.append((f[:-5], tag.group(1).strip(), re.sub(r"<[^>]+>", "", t.group(1)).strip(), d.group(1) if d else "0000-00-00"))
    return sorted(out, key=lambda r: r[3], reverse=True)


def related_grid(tag, slug):
    posts = [p for p in existing_posts() if p[0] != slug]
    same = [p for p in posts if p[1] == tag][:3]
    if len(same) < 3:
        same += [p for p in posts if p not in same][: 3 - len(same)]
    rows = "\n".join(
        f'    <a class="related-card" href="{p[0]}.html">\n'
        f'      <span class="related-tag">{p[1]}</span>\n'
        f'      <span class="related-title">{html.escape(p[2])}</span>\n'
        f"    </a>"
        for p in same
    )
    return rows


def render_post(meta, body):
    donor = open(DONOR, encoding="utf-8").read()
    slug, title, tag = meta["SLUG"], meta["TITLE"], meta["TAG"]
    url = f"{BASE}blog/{slug}.html"
    img_url = BASE + web_image(meta["IMAGE"])
    desc = meta["DESCRIPTION"]
    pretty = datetime.strptime(meta["DATE"], "%Y-%m-%d").strftime("%B %-d, %Y")

    out = donor

    # --- head -------------------------------------------------------------
    out = re.sub(r"<title>.*?</title>", lambda _: f"<title>{html.escape(title)}</title>", out, count=1, flags=re.S)
    out = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda m: m.group(1) + html.escape(desc, quote=True) + m.group(2), out, count=1)
    out = re.sub(r'(<link rel="canonical" href=")[^"]*(")', lambda m: m.group(1) + url + m.group(2), out, count=1)
    for prop in ("og:title", "twitter:title"):
        out = re.sub(rf'((?:property|name)="{prop}" content=")[^"]*(")', lambda m: m.group(1) + html.escape(title, quote=True) + m.group(2), out, count=1)
    for prop in ("og:description", "twitter:description"):
        out = re.sub(rf'((?:property|name)="{prop}" content=")[^"]*(")', lambda m: m.group(1) + html.escape(desc, quote=True) + m.group(2), out, count=1)
    out = re.sub(r'(property="og:url" content=")[^"]*(")', lambda m: m.group(1) + url + m.group(2), out, count=1)
    for prop in ("og:image", "twitter:image"):
        out = re.sub(rf'((?:property|name)="{prop}" content=")[^"]*(")', lambda m: m.group(1) + img_url + m.group(2), out, count=1)

    schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "description": desc,
        "image": img_url,
        "datePublished": meta["DATE"],
        "dateModified": meta["DATE"],
        "author": {"@type": "Person", "name": AUTHOR},
        "publisher": {"@id": BASE + "#business"},
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
    }
    out = re.sub(
        r'<script type="application/ld\+json">\s*\{.*?\}\s*</script>',
        lambda _: '<script type="application/ld+json">\n' + json.dumps(schema, indent=2) + "\n  </script>",
        out, count=1, flags=re.S,
    )

    # --- header block -----------------------------------------------------
    out = re.sub(r'(<p class="post-breadcrumb">.*?<a href="\.\./blog\.html">Blog</a> &nbsp;/&nbsp; )[^<]*(</p>)',
                 lambda m: m.group(1) + html.escape(tag) + m.group(2), out, count=1, flags=re.S)
    out = re.sub(r'(<span class="post-tag-header">)[^<]*(</span>)', lambda m: m.group(1) + html.escape(tag) + m.group(2), out, count=1)
    out = re.sub(r'<h1 class="post-h1">.*?</h1>', lambda _: f'<h1 class="post-h1">{inline(title)}</h1>', out, count=1, flags=re.S)
    out = re.sub(r'(<span class="post-date-label">)[^<]*(</span>)',
                 lambda m: m.group(1) + f"{pretty} &nbsp;·&nbsp; {meta['READ_MIN']} min read" + m.group(2), out, count=1)

    # --- body -------------------------------------------------------------
    new_body = body_to_html(body, meta["CTA_TEXT"].replace("\\n", "<br>"), meta["CTA_LINK"])
    out = re.sub(r'(<div class="post-content reveal">\n).*?(\n\s*</div>\s*</section>\s*<section id="related")',
                 lambda m: m.group(1) + new_body + m.group(2), out, count=1, flags=re.S)

    # --- related ----------------------------------------------------------
    out = re.sub(r'(<div class="related-grid">\n).*?(\n\s*</div>)',
                 lambda m: m.group(1) + related_grid(tag, slug) + m.group(2), out, count=1, flags=re.S)

    return out


# -------------------------------------------------------------------- wiring in

def wire_blog_index(meta, dry_run):
    path = os.path.join(ROOT, "blog.html")
    src = open(path, encoding="utf-8").read()
    slug = meta["SLUG"]
    if f'href="blog/{slug}.html"' in src:
        return "already listed"
    pretty = datetime.strptime(meta["DATE"], "%Y-%m-%d").strftime("%B %-d, %Y")
    card = (
        f'<a class="post-card" href="blog/{slug}.html">\n'
        f'      <div class="post-thumb">\n'
        f'        <img src="{web_image(meta["IMAGE"])}" alt="{html.escape(meta["TITLE"], quote=True)}" loading="lazy" width="1200" height="800">\n'
        f"      </div>\n"
        f'      <div class="post-meta">\n'
        f'        <span class="post-tag">{meta["TAG"]}</span>\n'
        f'        <span class="post-date">{pretty}</span>\n'
        f"      </div>\n"
        f'      <h2 class="post-title">{html.escape(meta["TITLE"])}</h2>\n'
        f'      <p class="post-excerpt">{html.escape(meta["EXCERPT"])}</p>\n'
        f"    </a>\n\n    "
    )
    m = re.search(r'<a class="post-card"', src)
    if not m:
        raise Problem("could not find the post-card grid in blog.html")
    out = src[: m.start()] + card + src[m.start():]

    # ItemList JSON-LD entry
    entry = (
        '      {\n        "@type": "BlogPosting",\n'
        f'        "headline": {json.dumps(meta["TITLE"])},\n'
        f'        "url": "{BASE}blog/{slug}.html",\n'
        f'        "datePublished": "{meta["DATE"]}",\n'
        '        "author": { "@type": "Person", "name": "Kaden Elzinga" }\n      },\n'
    )
    m2 = re.search(r'      \{\n        "@type": "BlogPosting",', out)
    if m2:
        out = out[: m2.start()] + entry + out[m2.start():]
    if not dry_run:
        open(path, "w", encoding="utf-8").write(out)
    return "card + schema added"


def wire_feed(meta, dry_run):
    path = os.path.join(ROOT, "feed.xml")
    src = open(path, encoding="utf-8").read()
    slug = meta["SLUG"]
    url = f"{BASE}blog/{slug}.html"
    if url in src:
        return "already in feed"
    pub = datetime.strptime(meta["DATE"], "%Y-%m-%d").strftime("%a, %d %b %Y 09:00:00 -0400")
    item = (
        f"    <item>\n"
        f"      <title>{html.escape(meta['TITLE'])}</title>\n"
        f"      <link>{url}</link>\n"
        f'      <guid isPermaLink="true">{url}</guid>\n'
        f"      <pubDate>{pub}</pubDate>\n"
        f"      <dc:creator>{AUTHOR}</dc:creator>\n"
        f"      <description><![CDATA[{meta['DESCRIPTION']}]]></description>\n"
        f"      <category>{meta['TAG']}</category>\n"
        f"    </item>\n\n"
    )
    m = re.search(r"    <item>", src)
    if not m:
        raise Problem("could not find an <item> anchor in feed.xml")
    out = src[: m.start()] + item + src[m.start():]
    if not dry_run:
        open(path, "w", encoding="utf-8").write(out)
    return "item added"


def wire_sitemap(meta, dry_run):
    path = os.path.join(ROOT, "sitemap.xml")
    src = open(path, encoding="utf-8").read()
    url = f"{BASE}blog/{meta['SLUG']}.html"
    if url in src:
        return "already in sitemap"
    entry = (
        f"  <url>\n    <loc>{url}</loc>\n    <lastmod>{meta['DATE']}</lastmod>\n"
        f"    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n"
    )
    out = src.replace("</urlset>", entry + "</urlset>")
    if not dry_run:
        open(path, "w", encoding="utf-8").write(out)
    return "url added"


# ----------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("draft", help="path to the draft file, or - for stdin")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true", help="overwrite an existing post")
    args = ap.parse_args()

    text = sys.stdin.read() if args.draft == "-" else open(args.draft, encoding="utf-8").read()
    meta, body = parse(text)

    try:
        validate(meta, body)
    except Problem as e:
        print(f"REJECTED: {e}", file=sys.stderr)
        return 2

    dest = os.path.join(BLOG, meta["SLUG"] + ".html")
    if os.path.exists(dest) and not args.force:
        print(f"REJECTED: blog/{meta['SLUG']}.html already exists (pass --force to replace)", file=sys.stderr)
        return 2

    try:
        page = render_post(meta, body)
    except Problem as e:
        print(f"REJECTED: {e}", file=sys.stderr)
        return 2

    # Render-time sanity: the donor's placeholders must all be gone.
    for leak in ("Do Twilight Photos Help Sell Homes", "do-twilight-photos-sell-homes"):
        if leak in page and meta["SLUG"] != "do-twilight-photos-sell-homes-grand-rapids":
            print(f"REJECTED: donor content leaked into the rendered post ({leak!r})", file=sys.stderr)
            return 2

    if not args.dry_run:
        open(dest, "w", encoding="utf-8").write(page)

    print(f"post   : blog/{meta['SLUG']}.html ({len(body.split())} words, {len(page)} bytes)")
    print(f"index  : {wire_blog_index(meta, args.dry_run)}")
    print(f"feed   : {wire_feed(meta, args.dry_run)}")
    print(f"sitemap: {wire_sitemap(meta, args.dry_run)}")
    print(f"url    : {BASE}blog/{meta['SLUG']}.html")
    if args.dry_run:
        print("(dry run — nothing written)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
