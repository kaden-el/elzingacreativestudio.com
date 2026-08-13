/* ═══════════════════════════════════════════════════════════════════════
   ECS lead delivery — one hardened path for every form on the site.

   WHY THIS EXISTS (2026-08-05 funnel audit). Every public form used to do
   its own version of "if (window.emailjs) send() else open a composer".
   That leaked leads three ways:

     1. THE RACE. The EmailJS SDK is loaded `defer` off a CDN. A visitor who
        fills the form fast — or is on a slow phone, or has a content blocker
        that stalls jsdelivr — hits `if (window.emailjs)` while it is still
        undefined, and gets dumped into a mail composer they must send by
        hand. Nothing was wrong with the account; the script just had not
        landed yet. This module WAITS for it instead of testing it once.

     2. NO RETRY. One network hiccup = one lost lead. Now: 3 attempts with
        backoff before we ever fall back.

     3. NO RECORD. If delivery failed and the visitor did not complete the
        composer, the lead evaporated with no trace anywhere. Now it is
        written to a local outbox and re-sent on the next page view.

   The site is static (GitHub Pages) so there is no server to catch a lead.
   Until there is one, this is the most durability that is honestly available:
   wait properly, retry properly, remember what failed, and never tell a
   visitor "got it" unless it actually sent.

   Usage:
     <script src="js/lead.js" defer></script>
     const res = await ECSLead.deliver({
       first_name, last_name, email, service, message, form: 'realtors_funnel'
     });
     if (res.ok) { showConfirmed(); } else { showComposerFallback(); }
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.ECSLead) return;

  var OUTBOX_KEY = 'ecs_lead_outbox';
  var MAX_QUEUED = 25;            // don't grow a device's storage without bound
  var MAX_ATTEMPTS = 12;          // give a queued lead ~a dozen chances, then stop
  var TTL_DAYS = 14;              // after two weeks a stale lead is noise, not a lead
  var SDK_WAIT_MS = 9000;         // how long to wait for the CDN before giving up
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';

  /* ── storage helpers (private mode / disabled storage must not throw) ── */
  function readOutbox() {
    try {
      var raw = window.localStorage.getItem(OUTBOX_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function writeOutbox(arr) {
    try { window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(arr.slice(-MAX_QUEUED))); return true; }
    catch (_) { return false; }
  }

  function uid() {
    return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ── make sure the SDK + config are actually present, don't just test once ──
     Pages that already ship the CDN tag get it for free; pages that don't (or
     whose tag stalled) get it injected here. Either way we WAIT.            */
  var sdkPromise = null;
  function sdkReady() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve) {
      var started = Date.now();

      if (!window.ELZINGA_CONFIG && !document.querySelector('script[src$="config.js"]')) {
        var c = document.createElement('script'); c.src = 'config.js'; document.head.appendChild(c);
      }
      if (!window.emailjs && !document.querySelector('script[src*="@emailjs/browser"]')) {
        var s = document.createElement('script'); s.src = SDK_URL; document.head.appendChild(s);
      }

      (function poll() {
        var cfg = window.ELZINGA_CONFIG;
        if (window.emailjs && cfg && cfg.emailjsServiceId && cfg.emailjsPublicKey) {
          try { window.emailjs.init(cfg.emailjsPublicKey); } catch (_) {}
          return resolve(true);
        }
        if (Date.now() - started > SDK_WAIT_MS) return resolve(false);
        setTimeout(poll, 120);
      })();
    });
    return sdkPromise;
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ── the params every form sends ──
     `reply_to` is the load-bearing one: the EmailJS template binds its Reply-To
     header to it, so hitting Reply on a lead notification answers the LEAD.
     Without it the reply went back to our own inbox and the lead heard nothing.
     The name/email aliases exist because the template's header lines read
     {{name}} / {{from_email}}; sending only first_name/email rendered them blank. */
  function paramsFor(lead) {
    var first = lead.first_name || '';
    var last  = lead.last_name || '';
    var full  = (first + ' ' + last).trim();
    var email = lead.email || '';
    return {
      first_name: first,
      last_name:  last,
      name:       full,
      from_name:  full,
      user_name:  full,
      email:      email,
      from_email: email,
      user_email: email,
      reply_to:   email,
      service:    lead.service || 'Shoot Request',
      message:    lead.message || ''
    };
  }

  /* ── one delivery attempt against EmailJS ── */
  function sendOnce(params) {
    var cfg = window.ELZINGA_CONFIG;
    return window.emailjs.send(cfg.emailjsServiceId, cfg.emailjsTemplateId, params);
  }

  /* ── try hard: wait for the SDK, then 3 attempts with backoff ── */
  async function attempt(params, tries) {
    var ready = await sdkReady();
    if (!ready) return false;
    var backoff = [0, 1200, 3000];
    for (var i = 0; i < (tries || 3); i++) {
      if (backoff[i]) await wait(backoff[i]);
      try { await sendOnce(params); return true; } catch (_) { /* next */ }
    }
    return false;
  }

  /* ── the public call ── */
  async function deliver(lead) {
    var params = paramsFor(lead);

    if (await attempt(params)) return { ok: true, via: 'emailjs' };

    // Delivery failed. Remember it so it is not gone, then tell the caller
    // honestly so the visitor is shown the composer instead of a fake "got it".
    var box = readOutbox();
    box.push({ id: uid(), at: Date.now(), attempts: 1, form: lead.form || '', params: params });
    var stored = writeOutbox(box);
    return { ok: false, via: stored ? 'queued' : 'none', queued: stored };
  }

  /* ── flush anything that failed on an earlier visit ──
     Runs quietly on every page load. A lead that failed because the CDN was
     blocked or the network dropped gets delivered the next time this device
     opens the site.                                                        */
  async function flush() {
    var box = readOutbox();
    if (!box.length) return;

    var cutoff = Date.now() - TTL_DAYS * 86400000;
    box = box.filter(function (it) { return it.at > cutoff && it.attempts < MAX_ATTEMPTS; });
    if (!box.length) { writeOutbox(box); return; }

    if (!(await sdkReady())) return;   // try again next page view

    var keep = [];
    for (var i = 0; i < box.length; i++) {
      var it = box[i];
      var p = Object.assign({}, it.params);
      // Entries queued before reply_to existed still carry only `email`.
      if (!p.reply_to) p = Object.assign(p, paramsFor({
        first_name: p.first_name, last_name: p.last_name,
        email: p.email, service: p.service, message: p.message
      }));
      var age = Math.round((Date.now() - it.at) / 60000);
      // Flag it so a late arrival is never mistaken for a fresh lead.
      p.message = '[DELAYED DELIVERY — this lead was submitted ' + age +
                  ' min ago and could not send at the time]\n\n' + p.message;
      it.attempts++;
      try { await sendOnce(p); } catch (_) { keep.push(it); }
    }
    writeOutbox(keep);
  }

  /* ── shared analytics push, so every form reports the same way ── */
  function track(eventName, data) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, data || {}));
      if (window.gtag) window.gtag('event', 'generate_lead', data || {});
      if (window.fbq) window.fbq('track', 'Lead', { content_name: (data && data.form) || eventName });
    } catch (_) {}
  }

  /* ── prefilled SMS (mobile) / email (desktop) composer, the last resort ── */
  function composerUrl(name, body) {
    var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    var mobile = ios || /Android/i.test(navigator.userAgent);
    return {
      mobile: mobile,
      label: mobile ? 'Send my text' : 'Send my email',
      url: mobile
        ? 'sms:+16162584578' + (ios ? '&' : '?') + 'body=' + encodeURIComponent(body)
        : 'mailto:kaden@elzingacreativestudio.com?subject=' +
          encodeURIComponent('New inquiry — ' + name) + '&body=' + encodeURIComponent(body)
    };
  }

  window.ECSLead = {
    deliver: deliver,
    paramsFor: paramsFor,
    track: track,
    composerUrl: composerUrl,
    flush: flush,
    pending: function () { return readOutbox().length; }
  };

  // Don't compete with the page's own first paint.
  if (document.readyState === 'complete') setTimeout(flush, 1500);
  else window.addEventListener('load', function () { setTimeout(flush, 1500); });
})();
