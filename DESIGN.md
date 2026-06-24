# Elzinga Creative Studio — Brand & Design System
## "ELZINGA." · Edition 02  ·  shipped 2026-06-24

The single source of truth for the site's look. Every page and every agent builds from this. No page invents its own colors, type, or motion.

**Feel:** warm editorial. Bone paper, ONE cobalt accent, a geometric display face (Syne), and the recurring **"dot"** (the period after `Elzinga.`) as the signature device. Restraint over decoration. *"We don't decorate. We decide."*

**This is a VISUAL system** — palette + type + motion + the dot. It does NOT change copy, SEO, structured data, pricing, funnel logic, or page structure.

> **Edition 02** supersedes "Cobalt Gallery" (Ed. 01, locked 2026-06-12). Same cobalt-on-bone DNA, evolved: serif → geometric display, deeper cobalt, warmer bone, and the dot motif + the full editorial motion layer. Source design: Claude Design "Elzinga Brand Guide" handoff. The living guide is **`brand-guide.html`**.

---

## ⚙️ Architecture — how the look is wired (read this first)

The entire brand lives in **two files**, linked by every page:

| File | Owns |
|---|---|
| **`css/brand.css`** | all tokens (palette, type families, motion, grain), the dot helpers, fixed-chrome styles, editorial components, keyframes, reduced-motion gating. The ONLY place colors + fonts are named. |
| **`js/brand.js`** | the interaction layer. Self-bootstrapping: inject `<script src="js/brand.js" defer>` and it adds the grain + scroll-progress + dot cursor and wires every interaction it finds (reveal, marquee, tilt, magnet, scramble, spotlight, type-tester, copy-swatch). Null-safe, idempotent, fully gated by `prefers-reduced-motion` + `(pointer:fine)`. |

Pages still carry inline `<style>` blocks for their own layout, but **tokens + fonts now resolve to brand.css** (back-compat aliases map the old `--bone`/`--cobalt`/`--green` names to Edition 02 values), so the look is centralized.

### 🔁 The pipeline — re-skin the whole site in one pass
A new Claude Design brand drop applies to all 77 pages by editing the two files above, then running:

```bash
python3 scripts/apply-brand.py            # convert every page
python3 scripts/apply-brand.py --dry-run  # preview, write nothing
python3 scripts/apply-brand.py index.html # one or more specific pages
```

`apply-brand.py` is **idempotent** (safe to re-run) and does the per-page wiring: swap the Google-Fonts link, inject `brand.css`, rewrite legacy palette hexes → new hexes, swap inline font-family names, add the accent dot to the nav wordmark, inject `brand.js`. Private app pages (dashboards, intake, login) get the visual rebrand but not the flourish JS — see `APP_PAGES` in the script.

**To ship the next brand:** (1) update tokens in `brand.css` + the `@import` font line, (2) tweak `brand.js` if interactions change, (3) update the `PALETTE` / `FONT_SWAPS` / `FONTS_LINK` maps in `apply-brand.py`, (4) run it, (5) screenshot a few pages, (6) commit. That's it.

---

## Palette (Edition 02)
| Token | Hex | Use |
|---|---|---|
| `--paper` / `--bone` (canvas) | `#F2EEE5` | page background, everywhere |
| `--ink` (text) | `#19150F` | headlines, body, dark UI / sections |
| `--accent` / `--cobalt` (accent) | `#1E5C8B` | the ONE pop: buttons, links, eyebrow rules, italic emphasis word, tags, and **the dot** |
| `--accent-dk` | `#184B73` | cobalt hover-darken |
| `--soft` | `#EAE4D7` | secondary surface, hover washes |
| `--clay` | `#C9B79C` | support / warm neutral |
| `--slate` | `#44504D` | support / cool neutral |
| `--line` (hairline) | `rgba(25,21,15,.14)` | 1px rules, dividers, card-grid bleed |
| `--muted` (text-2) | `#4D4940` | sub-copy, captions |
| `--error` | `#B23A2E` | misuse ✕ / "Not" tags only |

**Rule of color:** restraint. Bone canvas, ink text, ONE confident cobalt pop per view. Recommended balance ≈ **Bone 62 / Ink 20 / Clay 8 / Slate 6 / Accent 4**. Color is an event, not a wallpaper.

## Typography (Edition 02)
- **Display:** `Syne` (geometric sans), weights **500–800**. Wordmark + headlines at 600; section numerals at 800. Tight tracking (`-.02em`) on big type.
- **Text / UI:** `Spline Sans`, 400–600.
- **Eyebrow label:** Spline Sans 600, 11–12px, UPPERCASE, letter-spacing `.22–.24em`, color `--accent`.
- **Scale:** wordmark `clamp(88px,17vw,232px)` · section numeral `clamp(66px,8.5vw,112px)` · h2 46px · body 15px/1.6 · eyebrow 11–13px.
- Loaded once via `@import` in `brand.css` (and a `<link>` per page for first paint).

## The Dot (signature device)
The period after **`Elzinga.`** is the brand. Always `--accent`. Three forms: `.ez-dot-accent` (plain accent period), `.ez-dot` (shimmering light-sweep, for hero/footer wordmarks), and the magnetic hero dot (`data-ez-magnet`). Never drop the dot, never recolour it, never distort the wordmark (see `brand-guide.html` › Misuse).

## Motion (full editorial flourish, all gated)
- **Grain** — fixed fractal-noise film over the bone canvas, `multiply`, opacity `.28` (photo-safe).
- **Scroll-progress** — 3px cobalt bar pinned to top.
- **Dot cursor** — 14px accent dot follows the pointer; expands to a 46px ring over interactive elements. Desktop + fine-pointer only; native cursor stays.
- **Scroll reveal** — `[data-reveal]` / `[data-reveal-stagger]` fade + rise, `.9s`, `cubic-bezier(.2,.7,.2,1)`.
- **Kinetic marquee** — scroll-velocity-reactive band (`.ez-marquee`).
- **Magnetic hero dot · scramble-decode headline · 3D tilt · cursor spotlight** — see `js/brand.js`.
- **Primary easing everywhere:** `cubic-bezier(.2,.7,.2,1)`.
- **ALWAYS** honor `prefers-reduced-motion`: every effect drops to its static end state; the dot cursor hides.

## Layout
- Generous whitespace, asymmetric editorial grid, large type.
- Photography is the hero — full-bleed and framed-in-grid; UI recedes.
- Hairline card-grids: container `background: var(--line)` + `gap:1px`, cells `var(--paper)` → crisp 1px rules.
- Media corners ~14px; primary CTAs are ~44px cobalt pills (legacy marketing pages keep their pills; the guide uses square editorial buttons).
- Section intro pattern: **eyebrow → display → sub → CTA row → meta strip**.

## Keep — do NOT touch
Copy, SEO/meta, JSON-LD structured data, the town-page content, pricing (`$245 / $375 / $525`), CRO funnel logic, Calendly + `booking_complete`/`lead_form_submit` events, the perf budget, the a11y floor, IndexNow, sitemap.

## Perf & a11y floor
- Fonts: preconnect + `display=swap` — no layout shift.
- Contrast: ink-on-bone is strong; cobalt `#1E5C8B` is deeper than Ed. 01 — verify text/buttons hit AA on bone.
- Preserve `:focus-visible`, `prefers-reduced-motion`, `(pointer:fine)` gating, form labels, alt text.
- Grain is subtle (`.28`) so it warms the canvas without muddying the photography — the product stays the hero.

## Status (2026-06-24)
Edition 02 shipped across all 77 pages in one pass via `apply-brand.py`. Reference + QA surface: `brand-guide.html`. Foundation (`css/brand.css`, `js/brand.js`, `scripts/apply-brand.py`) verified on desktop + mobile across homepage, town, about, money, and FAQ page types.
