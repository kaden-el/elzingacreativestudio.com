# Elzinga Creative Studio — Brand & Design System
## "PROOF." · Edition 03 · shipped 2026-07-03

The single source of truth for the site's look. Every page and every agent builds from this. No page invents its own colors, type, or motion.

**Feel:** the studio's proof room. Cool print-paper white, photographic carbon strips where the photos live, ONE china-marker red used only to mark decisions, Archivo Expanded display, Fragment Mono metadata. The signature device is **the keeper mark** — the hand-drawn red circle around what survives the cull.

**The brand story (why this can't be anyone else's):** Kaden shoots hundreds of frames and delivers only the ones that survive his standard — *"the photographer who's never satisfied, and that's exactly why your photos are."* Edition 03 turns that working process (contact sheets, china-marker circles, struck culls, frame numbers, EXIF metadata) into the entire visual system, built from his real filenames and real photographs.

> **Edition 03** supersedes "ELZINGA." Ed. 02 (Syne/cobalt/bone/grain, 2026-06-24) and "Cobalt Gallery" Ed. 01. Full rationale: `docs/superpowers/specs/2026-07-03-edition-03-proof-rebrand-design.md`. Living reference: **`brand-guide.html`**.

---

## ⚙️ Architecture — how the look is wired (read this first)

The entire brand lives in **two files**, linked by every page:

| File | Owns |
|---|---|
| **`css/brand.css`** | all tokens (palette, type, motion), the keeper/cull/plate/strip/sheet-label devices, editorial components, keyframes, reduced-motion gating. The ONLY place colors + fonts are named. |
| **`js/brand.js`** | the lean interaction layer. Self-bootstrapping: `<script src="js/brand.js" defer>` wires reveal, strip stagger, and keeper draw-on. Null-safe, idempotent, gated by `prefers-reduced-motion`. |

Pages carry inline `<style>` for their own layout, but tokens + fonts resolve to brand.css (back-compat aliases map `--bone`/`--cobalt`/`--green` to Edition 03 values).

### 🔁 The pipeline — re-skin the whole site in one pass
```bash
python3 scripts/apply-brand.py            # convert every page
python3 scripts/apply-brand.py --dry-run  # preview, write nothing
python3 scripts/apply-brand.py index.html # specific page(s)
```
`apply-brand.py` is idempotent: swaps the fonts link, injects brand.css/js, rewrites legacy palette hexes → Edition 03, swaps inline font names (Syne/Spline Sans/Fraunces/Inter → Archivo; monos → Fragment Mono), normalizes the nav wordmark. App pages (dashboards, intake, login) get the visual rebrand, not the flourish JS.

## Palette (Edition 03 — "the proof room")
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F4F5F2` | cool print-paper — light sections, reading, UI |
| `--ink` | `#17181A` | text on paper |
| `--carbon` | `#141517` | photographic black — the lightbox strips where photos live |
| `--carbon-2` | `#1E2023` | raised surface on carbon |
| `--mark` | `#D93A1F` | china-marker red — keeper circles, culls, CTAs. A marking tool, never wallpaper. |
| `--mark-deep` | `#B22A12` | small-text links + hover (AA on paper) |
| `--silver` | `#75797E` | metadata on paper (`--silver-carbon: #9BA0A6` on carbon) |
| `--line` | `rgba(20,21,23,.16)` | hairlines on paper (`--line-carbon: rgba(255,255,255,.14)`) |

**Rules of color:** photographs live on carbon; copy lives on paper; red appears ONLY where a decision is shown (keeper, cull, CTA). If red isn't marking something, it doesn't belong.

## Typography (Edition 03)
- **`Archivo`** (variable, wdth 62–125 / wght 100–900). **Display voice:** Expanded (`font-stretch:125%`) 800–900, UPPERCASE, `line-height:.9`, tracking `-.01em` — the wordmark **ELZINGA** is Archivo Expanded Black. **Body voice:** normal width, 400–600, 15–16px/1.6.
- **`Fragment Mono`** — the metadata layer: frame plates, sheet labels, eyebrows, nav meta, stats, footers. 11–13px, letter-spacing `.08–.14em`, uppercase for labels.
- Loaded once via `@import` in brand.css + per-page `<link>` for first paint.

## Signature devices
1. **Keeper mark** `.ez-keep` — rough red SVG ellipse around the chosen thing (headline keyword, recommended tier, surviving frame). Draws on scroll; static under reduced-motion. Never perfect/geometric — it's a grease pencil, not a border-radius.
2. **Cull strike** `.ez-cull` — red X strike + dimmed frame for rejects and "not this" content.
3. **Frame plate** `.ez-plate` — mono strip under photos: `DSC07048 · GRAND RAPIDS MI`. Use real filenames.
4. **Sheet label** `.ez-sheet` — mono section header `SHEET 02 / PRICING` over a hairline. Sections are sheets of the studio's contact book.
5. **Contact strip** `.ez-strip` — full-bleed carbon band of frames with plates.

## Motion (one moment, everything else quiet)
- Reveal: `[data-reveal]` fade+rise, **.5s**, 12px, `cubic-bezier(.2,.7,.2,1)`; `[data-reveal-stagger]` 60ms steps.
- Keeper draw-on: stroke-dashoffset, .7s, when in view.
- The orchestrated hero cull (frames dim → strikes land → keeper circles) lives ONLY on index.html, page-local.
- **Killed forever:** grain, dot cursor, progress bar, marquee, scramble, tilt, spotlight, magnet, shimmer.
- ALWAYS honor `prefers-reduced-motion` (static end states) + `(pointer:fine)`.

## Layout
- Paper sections: generous margins, max-width 1180px, hairline rules, square corners (`--radius-media: 2px` — prints aren't rounded). CTAs are rectangular `--mark` blocks, white text, mono microcopy allowed.
- Carbon strips: full-bleed, photos edge-to-edge in rows with plates, 2–4px gutters (film sleeve).
- Section pattern: **sheet label → display headline (one keeper-marked word max) → support line → content → CTA**.
- Photography is always the hero. UI recedes; the markup layer (red) only points at things.

## Voice
Direct, craft-first, measurable. Numbers over adjectives ("$245. Every photo the listing needs. Delivered by tomorrow."). The QC standard is copy: "Verticals true. Windows balanced. Sky real. Nothing in the frame that shouldn't be." No urgency pressure, no "affordable", no satisfaction-speak. Manifesto verbatim: *"The photographer who's never satisfied — and that's exactly why your photos are."*

## Keep — do NOT touch
Copy meaning, SEO/meta/H1 keywords, JSON-LD, URLs, town-page content, pricing (`$245 / $375 / $525`), the 24h offer, CRO funnel logic, Calendly + `booking_complete`/`lead_form_submit` events, fbq, EmailJS/Supabase/Turnstile wiring, perf budget, a11y floor, IndexNow, sitemap.

## Perf & a11y floor
- Fonts: preconnect + `display=swap`; two families only.
- Contrast: ink-on-paper ✓; small red text uses `--mark-deep` (≥4.5:1 on paper); white-on-`--mark` for button text ≥4.5:1.
- Preserve `:focus-visible`, reduced-motion gating, labels, alt text.

## Status (2026-07-03)
Edition 03 shipped sitewide via `apply-brand.py` + hand-rebuilt index/money pages. Reference: `brand-guide.html`.
