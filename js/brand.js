/* ==========================================================================
   ELZINGA — Edition 03 "PROOF." interaction layer.
   Self-bootstrapping: <script src="js/brand.js" defer> and it wires
   everything it finds. Null-safe, idempotent, gated by reduced-motion.

   Edition 03 is deliberately quiet. This file wires exactly four things:
     1. html.ez-motion gate (reduced-motion aware)
     2. scroll reveal — [data-reveal] / [data-reveal-stagger]
     3. the marking layer — .ez-keep (keeper ellipse) / .ez-cull (strike),
        SVGs injected here so authors write plain spans
     4. copy-swatch + toast — [data-ez-copy] / legacy [data-hex]
   Everything Edition 02 injected (grain, dot cursor, progress bar, marquee,
   scramble, tilt, magnet, spotlight) is retired.
   ========================================================================== */
/* ── GA4 measurement (added 2026-07-09) ────────────────────────────────
   Bookings must be attributable. The site fires funnel events into
   dataLayer (booking_request from js/booking.js; lead_form_submit from the
   index + realtors forms) but the GTM container GTM-T9PX92WS is empty, so
   nothing reaches GA4. This loads gtag.js directly and exposes window.gtag,
   which the conversion points call with a `generate_lead` event. Meta Pixel
   conversions are already live and independent of this.
   ACTIVATE: paste the GA4 Measurement ID (G-XXXXXXXXXX) into GA4_ID below.
   Empty string = no-op (safe to ship; nothing loads). */
(function () {
  'use strict';
  var GA4_ID = 'G-1BZCS0HDRF';           // ECS GA4 property (created 2026-07-09)
  if (GA4_ID.indexOf('G-') !== 0) return;
  if (window.__ezGA4) return;
  window.__ezGA4 = true;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  (document.head || document.documentElement).appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID);
})();

/* ── Lift SDK v1 (Phase 1: instrument-only, log-only) ──────────────────
   Vendored from ~/Desktop/lift/sdk/lift.js — edit there, re-vendor here.
   Adds the funnel events this site is missing on top of the gtag loaded
   above: lift_form_start (first focus on a lead form), lift_form_abandon
   (started, never attempted submit), and contact (tel:/sms: clicks, which
   ECS didn't track). Successful submits stay on the existing generate_lead.
   FAIL OPEN: fully wrapped; a no-op without gtag. Never breaks the page. */
(function () {
  try {
    var cfg = window.__LIFT = { site: "ecs",
      forms: "#inquiry-form, #lead-form, #ecsbk-ov form", trackContact: true };
    var FORMS = cfg.forms;

    function send(name, params) {
      try {
        if (!window.gtag) return;
        params = params || {};
        params.lift_v = "1";
        params.lift_site = cfg.site;
        window.gtag("event", name, params);
      } catch (_) {}
    }

    function leadForm(el) {
      try {
        var f = el && el.form ? el.form : el;
        if (!f || f.tagName !== "FORM" || !f.matches) return null;
        return f.matches(FORMS) ? f : null;
      } catch (_) { return null; }
    }

    function key(f) {
      return f.id || f.getAttribute("data-lead-form") || "form";
    }

    var started = {}; // key -> { t0, touched, attempted }

    document.addEventListener("focusin", function (e) {
      try {
        var f = leadForm(e.target);
        if (!f) return;
        var k = key(f);
        var field = e.target.name || e.target.id || "?";
        if (started[k]) { started[k].touched[field] = 1; return; }
        started[k] = { t0: Date.now(), touched: {}, attempted: false };
        started[k].touched[field] = 1;
        send("lift_form_start", { form: k });
      } catch (_) {}
    });

    document.addEventListener("submit", function (e) {
      try {
        var f = leadForm(e.target);
        if (!f) return;
        var k = key(f);
        if (!started[k]) started[k] = { t0: Date.now(), touched: {} };
        started[k].attempted = true;
      } catch (_) {}
    }, true);

    window.addEventListener("pagehide", function () {
      try {
        for (var k in started) {
          var s = started[k];
          if (s.attempted) continue;
          send("lift_form_abandon", {
            form: k,
            seconds_in_form: Math.round((Date.now() - s.t0) / 1000),
            fields_touched: Object.keys(s.touched).length
          });
        }
        started = {};
      } catch (_) {}
    });

    document.addEventListener("click", function (e) {
      try {
        var t = e.target;
        var a = t && t.closest ? t.closest('a[href^="tel:"], a[href^="sms:"]') : null;
        if (!a) return;
        var sms = a.getAttribute("href").lastIndexOf("sms:", 0) === 0;
        send("contact", { method: sms ? "sms" : "phone" });
      } catch (_) {}
    });
  } catch (_) {}
})();

(function () {
  'use strict';
  if (window.__ezBrand3) return;
  window.__ezBrand3 = true;

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else { fn(); }
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* Rough grease-pencil ellipse: a full pass that overshoots into a second
     partial pass — the way a real china marker circles a keeper.
     TEXT ONLY — never draw marks over photographs (the work stays clean). */
  var KEEP_D = 'M12,24 C10,11 33,4 54,4 C78,4 96,9 95,21 C94,34 72,40 48,39 ' +
               'C25,38 9,33 10,22 C11,11 31,5 52,6 C69,7 83,9 91,13';

  function makeSvg(cls, viewBox, paths) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    paths.forEach(function (d) {
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('pathLength', '100');
      svg.appendChild(p);
    });
    return svg;
  }

  onReady(function () {
    var root = document.documentElement;
    if (!reduced) root.classList.add('ez-motion');

    /* 3. Marking layer — inject keeper SVGs (idempotent, text only).
       .ez-cull gets NO overlay: culled frames dim via CSS when .in lands. */
    document.querySelectorAll('.ez-keep').forEach(function (el) {
      if (el.querySelector('img, picture')) {       /* guard: never circle a photo */
        el.classList.remove('ez-keep');
        var old = el.querySelector('.ez-keep-svg');
        if (old) old.remove();
        return;
      }
      if (!el.querySelector('.ez-keep-svg')) {
        el.appendChild(makeSvg('ez-keep-svg', '0 0 104 44', [KEEP_D]));
      }
    });
    document.querySelectorAll('.ez-cull .ez-cull-svg').forEach(function (svg) {
      svg.remove();  /* strip any legacy strike overlays */
    });

    /* 2+3. One observer marks reveals and dims/draws when they enter view. */
    var targets = document.querySelectorAll(
      '[data-reveal], [data-reveal-stagger], .ez-keep, .ez-cull');

    if (targets.length) {
      if (reduced || !('IntersectionObserver' in window)) {
        targets.forEach(function (el) { el.classList.add('in'); });
      } else {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        targets.forEach(function (el) { io.observe(el); });
      }
    }

    /* 4. Copy-swatch (brand guide) — new + legacy hooks. */
    document.querySelectorAll('[data-ez-copy], [data-hex]').forEach(function (el) {
      el.addEventListener('click', function () {
        var val = el.getAttribute('data-ez-copy') ||
                  el.getAttribute('data-hex') || el.textContent.trim();
        var done = function () {
          var t = document.createElement('div');
          t.className = 'ez-toast';
          t.textContent = 'Copied ' + val;
          document.body.appendChild(t);
          setTimeout(function () { t.remove(); }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val).then(done, done);
        } else { done(); }
      });
    });
  });
})();
