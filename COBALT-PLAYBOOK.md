# Cobalt Gallery — Page Reskin Playbook

**Repeatable checklist to apply the Cobalt Gallery design system to ANY single page.**
The gold-standard reference is `index.html` (already reskinned). The canonical
stylesheet is `css/cobalt-gallery.css` — read it once; never fork it.

> This is a **VISUAL reskin only** — palette, type, spacing, components, motion.
> You never change copy, SEO/meta, JSON-LD, pricing, funnel logic, forms, images,
> scripts, or section order. See the **PRESERVE — NEVER TOUCH** list at the bottom.

---

## 0. The tokens (never guess these)

| Token | Hex | Use |
|---|---|---|
| `--bone` | `#FAF8F2` | page canvas — every background that was white/off-white |
| `--ink` | `#15120D` | text, dark UI, dark panels (was `#111111`/black) |
| `--cobalt` | `#2B5196` | the ONE accent — buttons, links, eyebrow rule, italic word, tags, mark (was green `#2A5C3F`) |
| `--sky` | `#A9C0D8` | soft fills / hover washes |
| `--stone` | `#C9C0AE` | muted UI, image placeholders |
| `--line` | `#ECE6D9` | borders, dividers (was `#E0E0E0`) |
| `--muted` | `#4D4940` | sub-copy, captions (was `#666`) |

**Fonts:** Display = **Fraunces** (weight **300**, `letter-spacing:-.025em`, line-height ~1.0, italic emphasis word in cobalt). Body/UI = **Inter** (400–600).
**Eyebrow:** Inter 600, 12px, UPPERCASE, `letter-spacing:.22em`, cobalt, preceded by a 26×2px cobalt rule.
**Pills:** buttons `border-radius:44px`. **Media corners:** `14px`. **Motion:** calm fade+rise (~600ms), always reduced-motion-guarded.
**Rule of color:** restraint — ONE cobalt pop per view. Color is an event, not wallpaper.

---

## 1. Add to `<head>` (exact, in this order)

Inside `<head>`, where the old font `<link>` was:

```html
<!-- Google Fonts: Fraunces (display) + Inter (body/UI) — Cobalt Gallery -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<!-- Cobalt Gallery canonical design system (shared across all pages) -->
<link rel="stylesheet" href="css/cobalt-gallery.css">
```

> Adjust the `css/` path to the page's depth (e.g. `../css/cobalt-gallery.css`
> if the page lives in a subfolder). Most ECS pages are at site root → `css/...`.

Also flip the theme-color meta if present: `content="#111111"` → `content="#FAF8F2"`.
**Do not remove** the existing Calendly CSS `<link>` or any other head asset.

---

## 2. Retarget the page's `:root` (the one move that re-themes everything)

ECS pages carry their own inline `<style>` with a legacy `:root`. **Do not delete the
class names** — just remap the token values so every existing rule re-themes at once.
Replace the legacy `:root` block with:

```css
:root {
  --black:     #15120D;   /* ink */
  --white:     #FFFFFF;   /* paper — keep TRUE white for cards/forms only */
  --bone:      #FAF8F2;   /* canvas */
  --green:     #2B5196;   /* COBALT (legacy name kept) */
  --green-dk:  #234277;   /* cobalt hover-darken */
  --off-white: #F4F1E8;   /* warm sand — alt section bg */
  --gray:      #4D4940;   /* muted */
  --gray-lt:   #79746A;   /* lighter caption */
  --border:    #ECE6D9;   /* hairline */
}
```

Then in the `body` rule: `font-family: 'Inter', system-ui, …` and `background: var(--bone);`.

### Find-and-replace sweep (run after the `:root` swap)
- `font-family: 'DM Sans'…` → `'Inter', …` (CSS **and** any inline/JS strings, incl. escaped `\'DM Sans\'`).
- `Georgia, serif` on display/quote elements → `'Fraunces', Georgia, serif`.
- Literal old greens anywhere (CSS, inline styles, JS template strings):
  `#2A5C3F` / `#2F5D43` / `#2F6B47` / `#1e4430` → `#2B5196`.
- Green-tinted rgba like `rgba(42,92,63,.06)` → `rgba(43,81,150,.06)`.
- Full-section backgrounds that were `var(--white)` → `var(--bone)`. **Leave**
  card/form/input backgrounds as `var(--white)` (paper lifts off the bone).
- The dark header bg → `rgba(250,248,242,0.92)` + `backdrop-filter:blur(8px)`.

**Verify zero leftovers:**
```bash
grep -ciE "DM Sans|#2A5C3F|#2F5D43|#2F6B47|#1e4430" <page>.html   # must be 0
```

---

## 3. Class mappings (old → new component)

Most ECS pages share `index.html`'s class vocabulary. Re-theme in place — **do not rename
classes** (other pages/JS depend on them):

| Old element / class | New Cobalt treatment |
|---|---|
| `.section-label` (eyebrow) | Inter 600, 12px, `.22em` tracking, cobalt, **add `::before` 26×2 cobalt rule**; hide any legacy `.m-tick` svg |
| `.section-title`, `.hero-title`, `.hero-h1`, `.svc-name`, `.about-title`, `.osvc-name`, `.contact-info h3`, `.p-price`, `.osvc-price-num` | **Fraunces 300**, `letter-spacing:-.02em…-.03em`, line-height ~1.0–1.04. Add `em { font-style:italic; color:var(--green); }` |
| `.btn-green` / primary CTA | cobalt **pill** (`border-radius:44px`, 15px/600, bone text), darken on hover |
| `.btn-black` / secondary | ink pill, same shape |
| `.btn-outline` | ghost pill — 1.5px ink border, **fills cobalt** on hover |
| ghost/text link with arrow | `color:var(--ink)`, arrow span `color:var(--cobalt)`, slide arrow `translateX(5px)` on hover |
| nav links | Inter 500, 13px, normal case, hover→cobalt; CTA = cobalt pill |
| photo/portfolio tile | rounded `14px`, tag pill bottom-left (cobalt), price pill top-right (`rgba(21,18,13,.5)` + blur) — use `.photo-card` from the canonical CSS for new cards |
| meta strip | cobalt `.dot` + short facts |
| Georgia quote mark / blockquote | Fraunces italic; quote mark weight 300 cobalt |

**Italic emphasis:** wrap ONE word per major headline in `<em>…</em>` (it renders
cobalt italic). Pick an existing word — never add or remove words. Examples already in
`index.html`: "Three disciplines, *one studio.*" · "Simple *pricing.*" · "Crafted with *purpose.*"

If a page needs a brand-new component (hero, card, button) rather than re-theming an
existing one, use the canonical classes directly: `.display`, `.eyebrow`, `.sub`, `.btn`,
`.btn-ghost`/`.arr`, `.cg-nav`, `.photo-card`/`.tag`/`.price`, `.meta-strip`/`.dot`,
`.hero-split` / `.hero-center`, `.cg-contour`.

---

## 4. Wrap sections in `.reveal` (calm scroll-in)

Add `reveal` (single element) or `reveal-stagger` (animate children in sequence) to each
section's intro block and to grids. They start hidden and ease in when scrolled into view.

```html
<div class="section-header reveal"> … </div>
<div class="pricing-cards reveal-stagger"> … cards … </div>
```

> `index.html` also carries a legacy motion vocabulary (`.m-reveal`, `.m-stagger`,
> `.m-rise`) that still works — you may keep those on existing pages. On NEW pages,
> prefer `.reveal` / `.reveal-stagger`. The observer below handles both.

### IntersectionObserver snippet — include once, before `</body>`

```html
<script>
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('cg-motion');   // unlocks the hidden state
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.querySelectorAll('.reveal, .reveal-stagger').forEach(function (el){ io.observe(el); });
})();
</script>
```

Reduced-motion + JS-off + no-IO all degrade to **fully visible** (nothing hidden). The
canonical CSS gates `.reveal`'s hidden state behind `html.cg-motion`, which only this
script adds — so if the script never runs, content shows normally. The
`@media (prefers-reduced-motion: reduce)` block in `cobalt-gallery.css` force-disables
all transforms/animation.

*(On `index.html` the existing observer was extended to add `cg-motion` and observe
`.reveal, .reveal-stagger` alongside the legacy classes — one observer, both systems.)*

---

## 5. Optional hero contour motif

For a hero, drop a low-opacity cobalt SVG line drawing absolutely-positioned behind the
copy and give it `class="cg-contour"`. It drifts slowly (38s) and is auto-disabled under
reduced-motion. Keep it subtle — it's the Daylight nod, not a focal point.

---

## 6. Verify before you finish

1. Render and eyeball: bone canvas, cobalt accents, Fraunces headlines, calm reveals.
   Because the working dir is outside the browse sandbox, copy the page + `css/` +
   `images/` into `/tmp/…` and load `file:///tmp/…/<page>.html`.
2. `grep -ciE "DM Sans|#2A5C3F|#2F5D43|#2F6B47|#1e4430" <page>.html` → **0**.
3. Diff copy/JSON-LD/meta vs `git show main:<page>.html` — text, structured data,
   pricing, links, alts, scripts must be **byte-identical** (only styling/markup-for-
   styling changed). The word-set of visible text must not gain or lose any word.

---

## PRESERVE — NEVER TOUCH

**This is law. A reskin that breaks any of these is rejected.**

- **Copy / text** — every word, in order. (You may wrap an existing word in `<em>` for
  the cobalt italic, but never add, remove, or reword.)
- **Pricing** — `$245 / $325 / $495` and every add-on number, exactly.
- **All `<meta>`, `<title>`, `<link rel="canonical">`, Open Graph / Twitter tags.**
- **All JSON-LD `application/ld+json` blocks** — byte-for-byte. Must still parse.
- **All scripts** — GTM, Meta Pixel (`fbq`), Calendly, EmailJS, `config.js`, the
  lightbox/gallery JS.
- **All analytics events** — `dataLayer`, `gtag`, `booking_complete`,
  `lead_form_submit`, `calendly.event_scheduled`, `fbq('track', …)`.
- **All forms** — fields, `name`/`id` attrs, labels, `onsubmit`/`handleSubmit`.
- **All `<img>` + `alt` text + `<picture>`/`srcset`** — every source and alt unchanged.
- **All links / `href`s** (only the font + `cobalt-gallery.css` links are added).
- **Section order and structure** — never delete or reorder a section.
- **A11y floor** — keep `:focus-visible`, `prefers-reduced-motion`, form labels, alt text.
- **Perf budget** — homepage < ~3.2MB; don't add heavy assets.
```
