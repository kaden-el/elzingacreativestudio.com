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
