/* ═══════════════════════════════════════════════════════════════════════
   ECS booking — shared "request a shoot" form + modal.
   Replaces Calendly across the site. Reuses the site's EmailJS pipeline
   (window.ELZINGA_CONFIG) and self-loads it on pages that don't already,
   with an SMS/mailto fallback so a lead is never lost.

   Usage on a page:
     <script src="js/booking.js" data-ecs-booking="portrait" defer></script>
   Any button can open it:  onclick="openBooking(); return false;"
   (openCalendly() is kept as an alias so existing buttons keep working.)
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__ecsBooking) return;            // guard against double-load
  window.__ecsBooking = true;

  var KADEN_CELL = '+16162584578', KADEN_EMAIL = 'kaden@elzingacreativestudio.com';

  /* ── page context (from the <script data-ecs-booking="…"> include) ── */
  var TYPES = {
    'real-estate': { opt: 'Real estate',          service: 'Real Estate — Shoot Request',        addr: true },
    'branding':    { opt: 'Branding / brand day',  service: 'Branding — Session Request' },
    'commercial':  { opt: 'Commercial',            service: 'Commercial — Shoot Request' },
    'senior':      { opt: 'Senior portraits',      service: 'Senior Portraits — Session Request' },
    'wedding':     { opt: 'Wedding',               service: 'Wedding — Inquiry' },
    'social':      { opt: 'Social content',        service: 'Social Content — Request' },
    'portrait':    { opt: 'Portrait session',      service: 'Portrait — Session Request' },
    'general':     { opt: 'Not sure yet',          service: 'Shoot Request' }
  };
  var OPTIONS = ['Real estate', 'Portrait session', 'Branding / brand day', 'Wedding',
                 'Senior portraits', 'Commercial', 'Social content', 'Other', 'Not sure yet'];

  var PAGE_TYPE = (function () {
    var s = document.querySelector('script[data-ecs-booking]');
    var t = s && s.getAttribute('data-ecs-booking');
    return TYPES[t] ? t : 'general';
  })();

  /* ── make sure the EmailJS SDK + config are present (only index preloads them) ── */
  function ensure(test, src) { if (!test()) { var el = document.createElement('script'); el.src = src; document.head.appendChild(el); } }
  ensure(function () { return !!window.ELZINGA_CONFIG; }, 'config.js');
  ensure(function () { return !!window.emailjs; }, 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js');
  (function initEJS(n) {
    if (window.emailjs && window.ELZINGA_CONFIG) { try { emailjs.init(window.ELZINGA_CONFIG.emailjsPublicKey); } catch (_) {} return; }
    if (n < 60) setTimeout(function () { initEJS(n + 1); }, 150);
  })(0);

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ── styles (scoped, ride the page's design tokens with safe fallbacks) ── */
  var CSS = '' +
    '#ecsbk-ov{position:fixed;inset:0;z-index:2147483000;display:none;align-items:flex-start;justify-content:center;padding:5vh 16px;overflow-y:auto;background:rgba(18,19,21,.62);backdrop-filter:saturate(120%) blur(3px);-webkit-backdrop-filter:saturate(120%) blur(3px)}' +
    '#ecsbk-ov.open{display:flex}' +
    '.ecsbk-panel{position:relative;width:100%;max-width:460px;margin:auto;background:#fff;color:var(--ink,#17181A);border:1px solid var(--line,rgba(20,21,23,.16));border-radius:4px;box-shadow:0 30px 80px rgba(0,0,0,.35);padding:30px 28px 26px;font-family:inherit;animation:ecsbk-in .22s cubic-bezier(.2,.7,.3,1)}' +
    '@keyframes ecsbk-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.ecsbk-panel{animation:none}}' +
    '.ecsbk-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border:0;background:transparent;color:var(--ink,#17181A);opacity:.5;font-size:22px;line-height:1;cursor:pointer;border-radius:3px}' +
    '.ecsbk-x:hover{opacity:1;background:var(--bone,#F4F5F2)}' +
    '.ecsbk-kick{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--accent,#B22A12);margin:0 0 6px}' +
    '.ecsbk-h{font-family:Archivo,Georgia,serif;font-size:24px;font-weight:300;letter-spacing:-.02em;margin:0 0 4px}' +
    '.ecsbk-sub{font-size:13px;line-height:1.5;color:rgba(20,21,23,.6);margin:0 0 18px}' +
    '.ecsbk-f{margin-bottom:13px}' +
    '.ecsbk-row{display:flex;gap:12px}.ecsbk-row>.ecsbk-f{flex:1}' +
    '.ecsbk-l{display:block;font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:rgba(20,21,23,.6);margin-bottom:5px}' +
    '.ecsbk-l .req{color:var(--accent,#B22A12)}' +
    '.ecsbk-panel input,.ecsbk-panel select,.ecsbk-panel textarea{width:100%;padding:11px 12px;font-family:inherit;font-size:16px;color:var(--ink,#17181A);background:#fff;border:1px solid var(--line,rgba(20,21,23,.16));border-radius:3px;-webkit-appearance:none;appearance:none}' +
    '.ecsbk-panel textarea{min-height:74px;resize:vertical}' +
    '.ecsbk-panel select{background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'%2317181A\' stroke-width=\'1.5\' fill=\'none\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:30px}' +
    '.ecsbk-panel input:focus,.ecsbk-panel select:focus,.ecsbk-panel textarea:focus{outline:2px solid var(--accent,#B22A12);outline-offset:1px;border-color:var(--accent,#B22A12)}' +
    '.ecsbk-panel .bad{border-color:var(--accent,#B22A12);background:#fdf4f2}' +
    '.ecsbk-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '.ecsbk-go{width:100%;margin-top:6px;padding:14px;font-family:inherit;font-size:14px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:var(--accent,#B22A12);border:0;border-radius:3px;cursor:pointer}' +
    '.ecsbk-go:hover{background:var(--accent-dk,#8F2110)}.ecsbk-go:disabled{opacity:.6;cursor:default}' +
    '.ecsbk-fine{font-size:11.5px;line-height:1.5;color:rgba(20,21,23,.5);margin:12px 0 0;text-align:center}' +
    '.ecsbk-fine a{color:inherit}' +
    '.ecsbk-done{text-align:center;padding:14px 4px}' +
    '.ecsbk-done h3{font-family:Archivo,Georgia,serif;font-weight:300;font-size:26px;margin:0 0 8px}' +
    '.ecsbk-done p{font-size:14px;line-height:1.6;color:rgba(20,21,23,.7);margin:0 0 18px}' +
    '.ecsbk-tick{width:46px;height:46px;border-radius:50%;background:var(--accent,#B22A12);margin:0 auto 16px;position:relative}' +
    '.ecsbk-tick:after{content:"";position:absolute;left:17px;top:10px;width:8px;height:16px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}';

  /* ── build the modal once, lazily ── */
  var ov, form, doneEl, lastFocus;

  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

    var t = TYPES[PAGE_TYPE], addr = !!t.addr;
    var opts = OPTIONS.map(function (o) {
      return '<option' + (o === t.opt ? ' selected' : '') + '>' + o + '</option>';
    }).join('');
    var subjLabel = addr ? 'Property address or area' : 'What are we shooting?';
    var subjPh = addr ? 'Address, or just the city / neighborhood' : 'Place, occasion, or a quick description';

    ov = document.createElement('div'); ov.id = 'ecsbk-ov';
    ov.innerHTML =
      '<div class="ecsbk-panel" role="dialog" aria-modal="true" aria-label="Request a shoot">' +
        '<button type="button" class="ecsbk-x" aria-label="Close">&times;</button>' +
        '<form novalidate>' +
          '<p class="ecsbk-kick">No calendar to wrangle</p>' +
          '<h3 class="ecsbk-h">Request a shoot</h3>' +
          '<p class="ecsbk-sub">Tell me what you need and a rough window — I&rsquo;ll text you back to lock the exact time.</p>' +
          '<div class="ecsbk-hp" aria-hidden="true"><label>Leave empty<input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>' +
          '<div class="ecsbk-f"><label class="ecsbk-l" for="ecsbk-type">Shoot type</label>' +
            '<select id="ecsbk-type" name="type">' + opts + '</select></div>' +
          '<div class="ecsbk-row">' +
            '<div class="ecsbk-f"><label class="ecsbk-l" for="ecsbk-name">First name <span class="req">*</span></label>' +
              '<input id="ecsbk-name" name="name" type="text" autocomplete="given-name" required></div>' +
            '<div class="ecsbk-f"><label class="ecsbk-l" for="ecsbk-phone">Cell <span class="req">*</span></label>' +
              '<input id="ecsbk-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(616) 555-0123" required></div>' +
          '</div>' +
          '<div class="ecsbk-f"><label class="ecsbk-l" for="ecsbk-email">Email <span style="opacity:.6;text-transform:none;letter-spacing:0;font-weight:500">(optional)</span></label>' +
            '<input id="ecsbk-email" name="email" type="email" autocomplete="email"></div>' +
          '<div class="ecsbk-f"><label class="ecsbk-l" for="ecsbk-subj">' + subjLabel + '</label>' +
            '<input id="ecsbk-subj" name="subj" type="text" placeholder="' + subjPh + '"></div>' +
          '<div class="ecsbk-row">' +
            '<div class="ecsbk-f"><label class="ecsbk-l" for="ecsbk-when">Preferred timing</label>' +
              '<select id="ecsbk-when" name="when">' +
                '<option value="">No preference</option><option>This week</option><option>Within 2 weeks</option>' +
                '<option>Later this month</option><option>Flexible</option><option>Just exploring</option></select></div>' +
            '<div class="ecsbk-f"><label class="ecsbk-l" for="ecsbk-tod">Time of day</label>' +
              '<select id="ecsbk-tod" name="tod">' +
                '<option value="">Any</option><option>Mornings</option><option>Midday</option>' +
                '<option>Afternoons</option><option>Evenings</option></select></div>' +
          '</div>' +
          '<div class="ecsbk-f"><label class="ecsbk-l" for="ecsbk-notes">Anything else?</label>' +
            '<textarea id="ecsbk-notes" name="notes" placeholder="Details, deadlines, questions…"></textarea></div>' +
          '<button type="submit" class="ecsbk-go">Send my request</button>' +
          '<p class="ecsbk-fine">No spam, ever. I&rsquo;ll text you back from (616) 258-4578. <a href="privacy-policy.html">Privacy</a>.</p>' +
        '</form>' +
        '<div class="ecsbk-done" style="display:none"><div class="ecsbk-tick"></div><h3>Got it.</h3>' +
          '<p class="ecsbk-msg"></p><a class="ecsbk-go ecsbk-send" style="display:none;text-decoration:none;box-sizing:border-box"></a></div>' +
      '</div>';
    document.body.appendChild(ov);

    form = ov.querySelector('form');
    doneEl = ov.querySelector('.ecsbk-done');
    ov.querySelector('.ecsbk-x').addEventListener('click', close);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('open')) close(); });
    ov.addEventListener('keydown', trap);
    form.addEventListener('submit', onSubmit);
  }

  function trap(e) {
    if (e.key !== 'Tab') return;
    var f = ov.querySelectorAll('button,input,select,textarea,a[href]');
    f = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null && !el.disabled; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open(typeOverride) {
    if (!ov) build();
    if (typeOverride && TYPES[typeOverride]) {
      var sel = form.type; for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].text === TYPES[typeOverride].opt) sel.selectedIndex = i; }
    }
    lastFocus = document.activeElement;
    ov.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { var n = form.name; if (n) n.focus(); }, 40);
  }
  function close() {
    if (!ov) return;
    ov.classList.remove('open');
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (form.company.value) return;                                   // honeypot
    var name = form.name, phone = form.phone, ok = true;
    [name, phone].forEach(function (el) { var b = !el.value.trim(); el.classList.toggle('bad', b); if (b) ok = false; });
    if (((phone.value.match(/\d/g) || []).length) < 10) { phone.classList.add('bad'); ok = false; }
    if (!ok) { var b = form.querySelector('.bad'); if (b) b.focus(); return; }

    var nm = name.value.trim(), ph = phone.value.trim(), em = form.email.value.trim(),
        type = form.type.value, subj = form.subj.value.trim(),
        when = form.when.value, tod = form.tod.value, notes = form.notes.value.trim();
    var svc = (TYPES[PAGE_TYPE] || TYPES.general).service;

    var message =
      'SHOOT REQUEST — elzingacreativestudio.com\n' +
      'Shoot type: ' + (type || '—') + '\n' +
      'Name: ' + nm + '\n' +
      'Cell: ' + ph + '\n' +
      'Email: ' + (em || '—') + '\n' +
      'Details: ' + (subj || '—') + '\n' +
      'Preferred timing: ' + (when || 'no preference') + (tod ? ' · ' + tod : '') + '\n' +
      'Notes: ' + (notes || '—');

    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'booking_request', shoot_type: type });
      if (window.gtag) window.gtag('event', 'generate_lead', { form: 'booking_request', shoot_type: type });
      if (window.fbq) fbq('track', 'Lead', { content_name: 'booking-' + PAGE_TYPE });
    } catch (_) {}

    var go = form.querySelector('.ecsbk-go');

    if (window.emailjs && window.ELZINGA_CONFIG && window.ELZINGA_CONFIG.emailjsServiceId) {
      go.disabled = true; go.textContent = 'Sending…';
      emailjs.send(window.ELZINGA_CONFIG.emailjsServiceId, window.ELZINGA_CONFIG.emailjsTemplateId,
        { first_name: nm, last_name: '', email: em, service: svc, message: message }
      ).then(function () {
        finish('Thanks ' + esc(nm) + '! Got it — I&rsquo;ll text you back shortly to lock a time.', null, null);
      }).catch(function () { fallback(nm, ph, em, message); });
      return;
    }
    fallback(nm, ph, em, message);
  }

  function fallback(nm, ph, em, message) {
    var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent), mobile = ios || /Android/i.test(navigator.userAgent);
    var url = mobile
      ? 'sms:' + KADEN_CELL + (ios ? '&' : '?') + 'body=' + encodeURIComponent(message)
      : 'mailto:' + KADEN_EMAIL + '?subject=' + encodeURIComponent('Shoot request — ' + nm) + '&body=' + encodeURIComponent(message);
    finish('Thanks ' + esc(nm) + '! One tap to send the message I just opened, and I&rsquo;ll text you right back.',
           url, mobile ? 'Send my text' : 'Send my email');
  }

  function finish(copy, composerUrl, sendLabel) {
    doneEl.querySelector('.ecsbk-msg').innerHTML = copy;
    var send = doneEl.querySelector('.ecsbk-send');
    if (composerUrl) { send.style.display = ''; send.href = composerUrl; send.textContent = sendLabel; }
    else { send.style.display = 'none'; }
    form.style.display = 'none';
    doneEl.style.display = '';
    if (composerUrl) setTimeout(function () { window.location.href = composerUrl; }, 250);
  }

  /* ── public API (openCalendly kept as an alias for existing buttons) ── */
  window.openBooking = open;
  window.openCalendly = function () { open(); return false; };
})();
