# Elzinga Creative Studio — Brand & Design System
## "Cobalt Gallery"  ·  locked 2026-06-12

The single source of truth for the site's look. Every page and every agent builds from this. No page invents its own colors, type, or motion.

**Feel:** architectural, editorial, calm, premium. Photography-first — the interface gets out of the way so the work fills the room. Inspired by the warm-editorial restraint of godaylight.com, translated to a confident cobalt pop on a warm bone canvas.

**This is a VISUAL reskin** — palette + type + motion + layout polish. It does NOT change copy, SEO, structured data, pricing, funnel logic, or page structure.

---

## Palette
| Token | Hex | Use |
|---|---|---|
| `--bone` (canvas) | `#FAF8F2` | page background, everywhere |
| `--ink` (text) | `#15120D` | headlines, body, dark UI |
| `--cobalt` (accent) | `#2B5196` | the ONE pop: buttons, links, eyebrow rules, italic emphasis word, tags, logo mark |
| `--sky` (soft accent) | `#A9C0D8` | soft fills, hover washes, subtle backgrounds |
| `--stone` (neutral) | `#C9C0AE` | muted UI, image placeholders |
| `--line` (hairline) | `#ECE6D9` | borders, dividers |
| `--muted` (text-2) | `#4D4940` | sub-copy, captions |

**Rule of color:** restraint. Bone canvas, ink text, ONE confident cobalt pop per view. Color is an event, not a wallpaper.

## Typography
- **Display:** `Fraunces` (serif), weight **300**, letter-spacing `-.025em`, line-height ~1.0. Italic emphasis word in `--cobalt`. Variable optical size — large `opsz` on big headlines.
- **Body / UI:** `Inter`, 400–600.
- **Eyebrow label:** Inter 600, 12px, UPPERCASE, letter-spacing `.22em`, color `--cobalt`, preceded by a 26×2px cobalt rule.
- **Scale:** display `clamp(48px, 5.8vw, 86px)` · sub `18px/1.62` · body `16px/1.6`.

## Motion (calm, buttery, never flashy)
- **Scroll reveal:** fade + rise (`translateY(16px)→0`, ~600ms ease), gently staggered.
- **Hover:** subtle — links grow an underline, buttons lift/darken slightly (~200ms).
- **Hero:** soft cobalt SVG contour-line motif drifting slowly at low opacity (the Daylight nod).
- **Imagery:** restrained reveal masks / slight scale-on-scroll.
- **ALWAYS** honor `prefers-reduced-motion`: drop transforms, keep opacity-only or none.

## Layout
- Generous whitespace, asymmetric editorial grid, large type.
- Photography is the hero — full-bleed and framed-in-grid; UI recedes.
- Media corners ~14px; buttons are ~44px pills.
- Section intro pattern: **eyebrow → display → sub → CTA row → meta strip**.

## Canonical components (reused on every page)
- **Nav:** logo + cobalt mark, text links, cobalt pill CTA.
- **Hero:** editorial split (copy left / photo right) or centered.
- **Eyebrow label** (rule + tracked uppercase cobalt).
- **Buttons:** primary = cobalt pill (bone text); secondary = ghost link with cobalt arrow.
- **Photo card:** rounded, tag pill bottom-left, price pill top-right.
- **Meta strip:** cobalt dots + short facts.
- **Reveal wrapper:** the scroll-in animation container.

## Keep — do NOT touch
Copy, SEO/meta, JSON-LD structured data, the 48 town-page content, pricing `$245 / $325 / $495`, CRO funnel logic, Calendly + `booking_complete`/`lead_form_submit` events, the perf budget (homepage < ~3.2MB), the a11y floor, IndexNow, sitemap.

## Perf & a11y floor
- Fonts: preconnect + `display=swap` (or self-host) — no layout shift.
- Contrast: ink-on-bone is strong; verify cobalt `#2B5196` text/buttons hit AA on bone.
- Preserve `:focus-visible`, `prefers-reduced-motion`, form labels, alt text.

## Rollout (111 pages · inline styles · no shared stylesheet today)
1. **Phase 1 — reference build:** define the canonical token + component block; build the **homepage** fully as the gold-standard reference. Get Kaden's sign-off on the live page.
2. **Phase 2 — money pages:** RE hubs, `preferred-photographer`, pricing, `book-a-listing`, luxury, `about`, contact, FAQ.
3. **Phase 3 — long tail:** 48 town pages + ~44 blog posts (templated → agent fan-out).
- Every page carries the SAME tokens + components from this file. Agents may not introduce new colors/type/motion.
