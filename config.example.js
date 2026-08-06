// ─────────────────────────────────────────────────────────────────
// config.example.js  —  SAFE TO COMMIT
// Copy this to config.js and fill in your real values
// EmailJS is the only live backend the public site uses.
// ─────────────────────────────────────────────────────────────────
window.ELZINGA_CONFIG = {
  emailjsPublicKey:  'YOUR_EMAILJS_PUBLIC_KEY',   // EmailJS dashboard → Account → Public Key
  emailjsServiceId:  'YOUR_EMAILJS_SERVICE_ID',   // EmailJS dashboard → Email Services
  emailjsTemplateId: 'YOUR_EMAILJS_TEMPLATE_ID',  // EmailJS dashboard → Email Templates
  turnstileSiteKey:  'YOUR_TURNSTILE_SITE_KEY',   // Cloudflare dashboard → Turnstile → Site Key
};
