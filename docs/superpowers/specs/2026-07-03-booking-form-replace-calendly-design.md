# Design — Replace Calendly with a shared "request a shoot" form

**Date:** 2026-07-03
**Site:** elzingacreativestudio.com (static HTML → GitHub Pages)
**Status:** approved (design), pending implementation plan

## Problem

Calendly is embedded across 11 pages. It is a separate third-party tool with its own
dashboard/calendar/availability that is painful to manage whenever someone actually books.
We want to drop it in favor of a form that behaves like the rest of the site — no external
calendar, no dashboard, no availability to babysit.

## Decision

Replace every Calendly surface with a **request-a-shoot form**: the visitor submits their
details + a rough preferred window, it emails Kaden instantly (same EmailJS path the rest of
the site uses), and Kaden replies/texts to lock the exact time. No live self-booking calendar.

Chosen booking model: **request form → Kaden confirms** (not a replacement scheduler).
Chosen surface for popup pages: **modal** (Option A) — least invasive drop-in, preserves each
page's existing CTA placement, one shared component everywhere.

## Reuse — this is not new infrastructure

The site already has a mature, hands-free lead form on `realtors.html` (and the existing
`#book-form` on `book-a-listing.html`). The new component is a faithful copy of that pattern:

- Honeypot spam trap (hidden `company` field).
- `novalidate` + JS validation.
- Analytics on submit: `dataLayer.push({event:'booking_request', ...})` + `fbq('track','Lead')`.
  This **replaces** the old `calendly.event_scheduled` conversion signal.
- **Primary delivery: EmailJS** — `emailjs.send(serviceId, templateId, {first_name, last_name,
  email, service, message})` using the same `window.ELZINGA_CONFIG` service/template/public key
  already injected at build time from GitHub secrets. Hands-free, no extra tap.
- **Fallback: prefilled SMS (mobile) / mailto (desktop) composer** so a lead is never lost if
  EmailJS/config is unavailable. Constants already on site: `KADEN_CELL = +16162584578`,
  `KADEN_EMAIL = kaden@elzingacreativestudio.com`.
- Success screen after send.

No Supabase, no new backend, no new dependency. (Supabase/`client_intake.html` is post-sale
onboarding and is out of scope.)

## Architecture — one shared component

New files:
- `js/booking.js` — single-file component: renders the form, owns submit logic, owns the modal,
  **and injects its own scoped CSS** (one `<style>` block appended once on load). Decision: CSS
  lives inside `booking.js`, not a separate stylesheet — so each page adds exactly one `<script>`
  include and nothing else. Styles use existing CSS custom properties (`--accent`, `--border`,
  etc.) so the form matches each page's theme with no per-page styling work.

The component supports two render modes from the same code:
1. **Inline** — renders into a mount element `<div data-booking-form data-service="..."></div>`.
2. **Modal** — `openBooking(service)` opens an overlay containing the same form.

A `data-service` value drives two things: the default **shoot type** selected in the form and
the `service` label sent in the EmailJS payload / fallback message. Two values:
- `real-estate` → default shoot type "Real estate", subject field label "Property address or area".
- `portrait` → default shoot type by page (portrait/brand/wedding/senior/commercial/social),
  subject field label "What are we shooting?".

### Form fields
- First name* , Email* , Phone* (match realtors required-field rules)
- Shoot type (select; default from `data-service`)
- Subject (text; label adapts by service — address vs. "what are we shooting?")
- Preferred day window (select: This week / Within 2 weeks / Later this month / Flexible)
- Preferred time of day (select: Mornings / Midday / Afternoons / Evenings / Any)
- Notes (optional textarea)
- Hidden honeypot `company`

### Submit message body
A readable multi-line summary (mirroring realtors.html) containing: shoot type, subject/address,
name, phone, email, preferred day window + time of day, notes.

## Page-by-page changes (11 pages)

**Inline (1):** `book-a-listing.html`
- Delete the `#calendly` column ("Option 1: pick a time") and its `.calendly-inline-widget`.
- Promote the existing `#book-form` ("Option 2: send details") to the single path; adjust the
  two-column `.booking-wrap` to single-column.
- Update the hero: remove the "Pick a time on the calendar" button; keep "send listing details".
- Note: `#book-form` already exists and already uses EmailJS. Decision: **adopt the shared
  component** for one source of truth — replace `#book-form`'s bespoke handler/markup with the
  `data-booking-form data-service="real-estate"` inline mount. Verify against the current form
  before/after so there is no regression (same fields captured, same email delivered, same
  success behavior).

**Popup → modal (10):**
- Real-estate (`data-service="real-estate"`): `preferred-photographer.html`,
  `real-estate-photography-grand-rapids.html`, `twilight.html`
- Portrait (`data-service="portrait"`): `brand-day.html`,
  `commercial-photography-grand-rapids.html`, `faq.html`, `index.html`,
  `senior-portraits-grand-rapids.html`, `social-media-marketing-grand-rapids.html`,
  `wedding-photographer-grand-rapids.html`

For each popup page:
- Remove `<script src="https://assets.calendly.com/assets/external/widget.js">` and the
  `calendly...widget.css` link.
- Remove the `CALENDLY_URL` constant and the `openCalendly()` body; either rename the trigger to
  `openBooking('<service>')` or keep `openCalendly()` as a thin alias that calls `openBooking`.
  Existing buttons (`onclick="openCalendly(); return false;"` and the nav variant
  `openCalendly(); closeMenu(); return false;`) keep working with the least edits.
- Add `<script src="js/booking.js" defer>` (and the CSS include if a separate file is used).
- EmailJS is already loaded on these pages; keep the existing init.

City location pages (`real-estate-photography-<city>.html`) do **not** reference Calendly — out
of scope, no change.

## Cleanup / done criteria
- Zero references to `calendly` remain in the 11 pages (widget.js, widget.css, popup URLs,
  `event_scheduled`).
- Every former Calendly CTA now opens the request form (modal) or, on book-a-listing, the inline
  form; a successful submit emails Kaden and fires the `Lead` conversion event.
- SMS/mailto fallback verified when `ELZINGA_CONFIG`/EmailJS is absent.
- Site still deploys cleanly via the existing GitHub Pages workflow on push to `main`.

## Implementation notes (what actually shipped, 2026-07-03)

Two realities surfaced during build that adjusted the plan:

1. **`book-a-listing.html` is a redirect tombstone.** Lines 4–6 `<meta http-equiv="refresh">`
   + `location.replace("realtors.html#start")` — the page was consolidated into
   `realtors.html` on 2026-06-25 and redirects instantly. Its inline Calendly widget was
   therefore never actually shown to users. The live real-estate booking surface is
   **`realtors.html`**, which already uses the EmailJS lead form (no Calendly). Action taken:
   removed the Calendly column + assets from `book-a-listing.html` as hygiene (so nothing
   Calendly loads even briefly before the redirect), kept its existing rich form intact. It
   does **not** load `js/booking.js` (it has its own handler and redirects anyway).

2. **Only `index.html` preloaded EmailJS + `config.js`.** The other 9 popup pages had Calendly
   only. So `js/booking.js` is **self-loading**: it injects `config.js` + the EmailJS SDK when
   absent, inits, and falls back to SMS/mailto if config never arrives. One `<script>` include
   per page is all that's needed.

Shipped: `js/booking.js` (shared form + modal, self-contained CSS/JS), wired into the 10 popup
pages via `openBooking()` (with `openCalendly()` kept as an alias so existing buttons are
untouched). QA verified in a headless browser: modal opens with the correct default shoot type
per page (Wedding, Real estate, "Not sure yet" for general), correct subject-label variant
(address vs. "what are we shooting"), required-field validation, and the success screen. Zero
Calendly references remain repo-wide.

## Out of scope (YAGNI)
- Any real availability/calendar or self-serve time selection.
- Supabase logging (realtors form doesn't do it; keep parity — can be added later).
- Redesigning page layouts beyond removing the Calendly column and reflowing.
- The `client_intake.html` onboarding flow.
