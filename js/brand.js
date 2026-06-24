/* ==========================================================================
   ELZINGA. — Brand interaction layer · Edition 02
   Self-bootstrapping. Drop <script src="js/brand.js" defer></script> on any
   page and it injects the fixed chrome (grain, scroll-progress, dot cursor)
   and wires every brand interaction it finds:

     [data-reveal] / [data-reveal-stagger]  scroll reveal (IntersectionObserver)
     .ez-marquee .track                      scroll-velocity kinetic marquee
     [data-ez-tilt]                          3D pointer tilt
     [data-ez-magnet]                        magnetic springy hero dot
     [data-ez-scramble]                      scramble-decode headline
     [data-ez-spot] / [data-ez-spot-glow]    cursor spotlight
     [data-ez-weight] + [data-ez-tester]     type-tester weight slider
     [data-hex]                              click-to-copy swatch + toast

   Everything is null-safe (works on a page that has none of these), idempotent
   (guards re-runs), and fully gated behind prefers-reduced-motion + pointer.
   Source: Claude Design "Elzinga Brand Guide" handoff.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__ezBrand) return;
  window.__ezBrand = true;

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE   = window.matchMedia && window.matchMedia('(pointer:fine)').matches;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  // Inject a fixed-chrome element once (by class), return it.
  function ensure(cls, attrs) {
    var el = document.querySelector('.' + cls);
    if (el) return el;
    el = document.createElement('div');
    el.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    document.body.appendChild(el);
    return el;
  }

  ready(function () {
    document.documentElement.classList.add('ez-motion');

    /* ── Fixed chrome ─────────────────────────────────────────────────── */
    ensure('ez-grain', { 'aria-hidden': 'true' });
    var bar = ensure('ez-progress', { 'aria-hidden': 'true' });

    var onScroll = function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ── Scroll reveal ────────────────────────────────────────────────── */
    if ('IntersectionObserver' in window) {
      var revealTargets = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
      if (revealTargets.length) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
        revealTargets.forEach(function (t) { io.observe(t); });
      }
    }

    if (REDUCE) return; // everything below is motion; honor the setting.

    /* ── Custom dot cursor ────────────────────────────────────────────── */
    if (FINE) {
      var cursor = ensure('ez-cursor', { 'aria-hidden': 'true' });
      var tx = window.innerWidth / 2, ty = window.innerHeight / 2, cx = tx, cy = ty;
      (function loop() {
        cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
        cursor.style.left = cx + 'px'; cursor.style.top = cy + 'px';
        requestAnimationFrame(loop);
      })();
      window.addEventListener('mousemove', function (e) {
        tx = e.clientX; ty = e.clientY; cursor.style.opacity = '1';
        var t = e.target;
        var interactive = t && t.closest && t.closest('a,button,input,select,textarea,[contenteditable],[data-ez-tilt],[data-hex],[role="button"]');
        cursor.classList.toggle('is-interactive', !!interactive);
      }, { passive: true });
      document.addEventListener('mouseleave', function () { cursor.style.opacity = '0'; });
    }

    /* ── 3D tilt ──────────────────────────────────────────────────────── */
    document.querySelectorAll('[data-ez-tilt]').forEach(function (card) {
      card.addEventListener('mousemove', function (ev) {
        var r = card.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width - 0.5;
        var py = (ev.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateY(' + (px * 9) + 'deg) rotateX(' + (-py * 9) + 'deg) translateZ(14px)';
        card.style.boxShadow = (-px * 36) + 'px ' + (py * 36 + 26) + 'px 70px rgba(25,21,15,.32)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = 'perspective(900px) rotateY(0) rotateX(0) translateZ(0)';
        card.style.boxShadow = 'none';
      });
    });

    /* ── Cursor spotlight (manifesto) ─────────────────────────────────── */
    var spot = document.querySelector('[data-ez-spot]');
    var glow = document.querySelector('[data-ez-spot-glow]');
    if (spot && glow) {
      spot.addEventListener('mousemove', function (ev) {
        var r = spot.getBoundingClientRect();
        glow.style.background = 'radial-gradient(420px circle at ' + (ev.clientX - r.left) + 'px ' + (ev.clientY - r.top) +
          'px, color-mix(in srgb, var(--accent) 38%, transparent), transparent 70%)';
        glow.style.opacity = '1';
      });
      spot.addEventListener('mouseleave', function () { glow.style.opacity = '0'; });
    }

    /* ── Kinetic marquee (scroll-velocity reactive) ───────────────────── */
    var track = document.querySelector('.ez-marquee .track');
    if (track) {
      var offset = 0, boost = 0, dir = 1, half = 0, lastY = window.scrollY;
      var measure = function () { half = track.scrollWidth / 2; };
      measure();
      (function tick() {
        var speed = 1.1 + Math.min(Math.abs(boost), 38);
        offset += dir * speed;
        if (half > 0) { if (offset >= half) offset -= half; if (offset < 0) offset += half; }
        track.style.transform = 'translateX(' + (-offset) + 'px)';
        boost *= 0.92;
        requestAnimationFrame(tick);
      })();
      window.addEventListener('scroll', function () {
        var y = window.scrollY, dy = y - lastY; lastY = y;
        if (dy !== 0) dir = dy > 0 ? 1 : -1;
        boost = Math.abs(dy) * 0.9;
      }, { passive: true });
      window.addEventListener('resize', measure);
    }

    /* ── Magnetic springy hero dot ────────────────────────────────────── */
    var magnet = document.querySelector('[data-ez-magnet]');
    if (magnet && FINE) {
      var mx = 0, my = 0, dxv = 0, dyv = 0;
      var spring = function () {
        dxv += (mx - dxv) * 0.12; dyv += (my - dyv) * 0.12;
        magnet.style.transform = 'translate(' + dxv + 'px,' + dyv + 'px)';
        requestAnimationFrame(spring);
      };
      setTimeout(spring, 1500);
      window.addEventListener('mousemove', function (e) {
        var r = magnet.getBoundingClientRect();
        var ccx = r.left + r.width / 2, ccy = r.top + r.height / 2;
        var dist = Math.hypot(e.clientX - ccx, e.clientY - ccy);
        var pull = Math.max(0, 1 - dist / 460);
        mx = (e.clientX - ccx) * 0.5 * pull;
        my = (e.clientY - ccy) * 0.5 * pull;
      }, { passive: true });
    }

    /* ── Scramble-decode headline ─────────────────────────────────────── */
    var scrambleEl = document.querySelector('[data-ez-scramble]');
    if (scrambleEl && 'IntersectionObserver' in window) {
      var glyphs = '▚▞▙█▛◆◇✳/\\<>=+*·';
      var nodes = [];
      (function walk(n) {
        n.childNodes.forEach(function (c) {
          if (c.nodeType === 3 && c.textContent.trim()) nodes.push({ node: c, final: c.textContent });
          else if (c.nodeType === 1) walk(c);
        });
      })(scrambleEl);
      var started = false;
      var run = function () {
        if (started) return; started = true;
        var total = nodes.reduce(function (a, n) { return a + n.final.length; }, 0);
        var start = performance.now(), dur = 900;
        var frame = function (t) {
          var prog = Math.min(1, (t - start) / dur);
          var revealCount = Math.floor(prog * total), seen = 0;
          nodes.forEach(function (o) {
            var out = '';
            for (var i = 0; i < o.final.length; i++) {
              if (seen < revealCount || o.final[i] === ' ') out += o.final[i];
              else out += glyphs[Math.floor(Math.random() * glyphs.length)];
              seen++;
            }
            o.node.textContent = out;
          });
          if (prog < 1) requestAnimationFrame(frame);
          else nodes.forEach(function (o) { o.node.textContent = o.final; });
        };
        requestAnimationFrame(frame);
      };
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { run(); io2.disconnect(); } });
      }, { threshold: 0.5 });
      io2.observe(scrambleEl);
    }

    /* ── Type tester weight slider ────────────────────────────────────── */
    var slider = document.querySelector('[data-ez-weight]');
    var tester = document.querySelector('[data-ez-tester]');
    if (slider && tester) {
      var label = document.querySelector('[data-ez-weight-label]');
      var sync = function () {
        tester.style.fontWeight = slider.value;
        if (label) label.textContent = slider.value;
      };
      slider.addEventListener('input', sync);
      sync();
    }

    /* ── Click-to-copy swatches ───────────────────────────────────────── */
    var swatches = document.querySelectorAll('[data-hex]');
    if (swatches.length) {
      var toastTimer;
      swatches.forEach(function (sw) {
        sw.addEventListener('click', function () {
          var hex = sw.getAttribute('data-hex');
          if (!hex) return;
          try { if (navigator.clipboard) navigator.clipboard.writeText(hex); } catch (_) {}
          var old = document.querySelector('.ez-toast');
          if (old) old.remove();
          var toast = document.createElement('div');
          toast.className = 'ez-toast';
          toast.textContent = 'Copied ' + hex;
          document.body.appendChild(toast);
          clearTimeout(toastTimer);
          toastTimer = setTimeout(function () { toast.remove(); }, 1500);
        });
      });
    }
  });
})();
