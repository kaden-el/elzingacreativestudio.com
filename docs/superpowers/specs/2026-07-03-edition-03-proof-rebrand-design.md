# Edition 03 — "PROOF." · Full Rebrand Design Spec
**Date:** 2026-07-03 · **Status:** approved for build (autonomous session, Kaden directive: "100% redone, fully rebranded, unmistakably mine — go")

## Why Edition 02 failed the ownability test
Edition 02 (bone `#F2EEE5` + cobalt accent + Syne + grain/marquee/dot-cursor + "Crafted with *purpose*.") is, verbatim, the dominant AI-generated site formula of 2025–26: warm cream canvas, one accent, geometric display face, eyebrow → display → italic-accent-word, noise grain, kinetic marquee. Any business could put their name on it. Kaden's brief: nobody else could.

## The concept: PROOF
The only assets no competitor can claim: **Kaden's name, Kaden's photographs, and Kaden's standard.** The documented brand truth (brain: `brand-positioning.md`) is *"the photographer who is never satisfied — and that's exactly why your photos are"* — he shoots hundreds of frames and delivers only the ones that survive his cull.

Edition 03 turns that working process into the entire visual system. The site behaves like the studio's proof room: contact sheets on a lightbox, china-marker keeper circles, struck-through culls, real frame numbers, EXIF-style metadata. Every device is an artifact of how the work is actually made.

**The one aesthetic risk:** the whole site chrome is a working contact sheet — even pricing is presented as frames, with the recommended tier circled in grease pencil. Justified because it encodes the true story (ruthless selection = quality) and doubles as conversion guidance.

## Palette — "the proof room"
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F4F5F2` | cool print-paper white (NOT warm cream) — light sections |
| `--ink` | `#17181A` | text on paper |
| `--carbon` | `#141517` | photographic black — dark "lightbox" strips where photos live |
| `--carbon-2` | `#1E2023` | raised surface on carbon |
| `--mark` | `#D93A1F` | china-marker red — keeper circles, culls, CTAs, big accents |
| `--mark-deep` | `#B22A12` | small-text links / hover (AA on paper) |
| `--silver` | `#75797E` | metadata gray on paper; `#9BA0A6` on carbon |
| `--line` | `rgba(20,21,23,.16)` | hairlines on paper; `rgba(255,255,255,.14)` on carbon |

Rule: photographs live on carbon (they pop like film on a lightbox); reading and UI live on paper. Red is a *marking tool*, never a wallpaper — it appears only where a decision is being shown (keeper, cull, CTA).

Back-compat aliases (legacy inline styles): `--bone→#F4F5F2`, `--cobalt→#B22A12`, `--cobalt-dk→#8F2110`, `--green/--green-dk→ same`, `--sky→#C6CBD1`, `--stone→#B9BDB4`, `--soft→#EBEDE8`, `--clay→#A7ACA3`, `--slate→#3E4348`, `--muted→#5A5E63`.

## Typography
- **Display + body: `Archivo`** (variable, `wdth` 62–125, `wght` 100–900). Display voice = Expanded (font-stretch 125%) 800–900, uppercase, tight leading — the wordmark **ELZINGA** in Archivo Expanded Black is the logotype. Body = normal width 400–600. One family, two voices; "Archivo" is literally the archive — on-brand for a studio defined by what it keeps.
- **Utility: `Fragment Mono`** — frame plates, EXIF captions, eyebrows/sheet labels, nav meta, footers. This is the voice of the metadata layer.
- Kill list: Syne, Spline Sans (Ed. 02), Fraunces, Inter (Ed. 01).

## Signature devices
1. **The keeper mark** (`.ez-keep`) — a rough hand-drawn red ellipse (inline SVG, double-pass stroke) circling the chosen thing: the key word in a headline, the recommended pricing tier, the surviving frame in a contact sheet, "Elzinga" in the footer. Draws itself on scroll (stroke-dashoffset), instant under reduced-motion.
2. **The cull strike** (`.ez-cull`) — rough red X / diagonal strike + dimmed frame, for rejected frames and "what we don't do" content.
3. **The frame plate** (`.ez-plate`) — Fragment Mono caption strip under photos: `DSC07048 · GRAND RAPIDS MI` (real filenames — they ship in the repo).
4. **Sheet labels** — sections headed `SHEET 02 / PRICING` in mono over a hairline, replacing eyebrow-words. Encodes real sequence (a contact sheet's pages), not decoration.
5. **Contact strips** (`.ez-strip`) — full-bleed carbon bands carrying rows of frames with plates; the homepage hero strip runs the cull: four frames dim and take strikes, one gets circled.

## Chrome: killed vs kept
**Killed** (AI-slop tells): grain overlay, dot cursor, scroll-progress bar, kinetic marquee, scramble-decode, 3D tilt, cursor spotlight, magnetic dot, shimmer. **Kept/added:** fast subtle reveal (.5s, 12px), keeper draw-on, strip stagger, `:focus-visible`, full `prefers-reduced-motion` + `(pointer:fine)` gating. One orchestrated moment (the hero cull) lives on index.html only.

## Voice
Direct, craft-first, measurable (Kaden's documented taste: objective offers, no "satisfaction" language, no urgency pressure). Manifesto line verbatim. Numbers over adjectives: "$245. Every photo the listing needs. Delivered by tomorrow." QC standard as copy: "Verticals true. Windows balanced. Sky real. Nothing in the frame that shouldn't be."

## What does NOT change (the funnel is load-bearing)
SEO titles/meta/H1 keywords, JSON-LD, URLs, sitemap/robots/IndexNow, pricing ($245/$375/$525), the ratified 24h offer, Calendly wiring + `booking_complete`/`lead_form_submit` events, fbq, form backends (EmailJS/Supabase/Turnstile), town-page content, blog content, a11y floor, perf budget.

## Implementation plan (phases = session task list)
1. **Core system:** rewrite `css/brand.css` (tokens, devices, components) + `js/brand.js` (lean interaction layer) + update `scripts/apply-brand.py` maps (fonts link, palette hexes incl. Ed.02 hexes → Ed.03, font swaps Syne→Archivo / Spline Sans→Archivo, wordmark treatment). Run sitewide.
2. **Homepage:** ground-up structural rebuild (carbon hero with the cull, keeper-marked pricing, strips) keeping section IDs/anchors + all preserved wiring.
3. **Money pages:** realtors, book-a-listing, about, free-audit, case-studies + new brand-guide (Edition 03 reference).
4. **Long tail:** pipeline pass over ~45 town pages, 49 blog pages, service/app pages; Sonnet 5 agents verify per-group and fix stragglers.
5. **QA:** desktop+mobile screenshots per page type, contrast, reduced-motion, Calendly/forms, console errors.
6. **Ship:** commit → push main → GitHub Pages → live verification. Rollback = `git revert`.
