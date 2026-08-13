/**
 * CENTRAL CONFIGURATION
 * ----------------------------------------------------------------
 * Every value that the business might need to change later (payment
 * number, WhatsApp number, admin bootstrap login) lives HERE ONLY.
 * Nothing else in the codebase should hardcode these values again -
 * always import them from this file.
 *
 * All of these can be overridden with environment variables without
 * touching any code (see .env.example).
 * ----------------------------------------------------------------
 */

// ---- tiny built-in .env loader (no extra dependency needed) ----
(function loadDotEnv() {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  });
})();

module.exports = {
  // ---- PAYMENT (temporary manual UPI number given by the owner) ----
  // Change this ONE value any time the payment number changes.
  PAYMENT_NUMBER: process.env.PAYMENT_NUMBER || '9336738879',

  // ---- WHATSAPP ----
  // Kept as a separate config value from PAYMENT_NUMBER on purpose.
  // NOTE: placeholder until the owner supplies the real WhatsApp number -
  // update via .env (WHATSAPP_NUMBER=91XXXXXXXXXX) without touching code.
  WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER || '910000000000',

  // ---- ADMIN BOOTSTRAP (used only once, to seed the first admin user) ----
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'naman9yadav@gmail.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '222202',

  // ---- SESSION ----
  SESSION_SECRET: process.env.SESSION_SECRET || 'classic-choice-dev-secret-change-me',

  // ---- DELIVERY ----
  DELIVERY_CHARGE: Number(process.env.DELIVERY_CHARGE || 0),

  // ---- BUSINESS INFO ----
  BUSINESS: {
    name: 'CLASSIC CHOICE COLLECTION',
    tagline: 'Ladies Night Wear',
    positioning: 'Whole Salers and Dealer',
    productsLine: 'Maxi, Night Gowns, Nighties etc.',
    email: 'classic_choice9717@gmail.com',
    phones: ['7304129717', '7304549717'],
    address: 'D48/7, Mishir Pokhra, Behind Sanatan Dharam School, Nai Sarak, Varanasi'
  },

  PORT: process.env.PORT || 3000
};
