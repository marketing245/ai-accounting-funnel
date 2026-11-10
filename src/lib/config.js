'use strict';
// Single source of truth for pricing, product names and site settings.
// Amounts are in INR rupees. Razorpay receives paise (x100).

const PRICING = {
  currency: 'INR',
  base: 1499,              // course price before tax
  regular: 5000,           // regular (MRP) price shown struck through
  gstPercent: 18,
};

const PRODUCT = {
  id: 'aiae-course',
  name: 'AI in Accounting — Course by CA Varsha Varyani',
  shortName: 'AI in Accounting Course',
  brand: 'CA Varsha Varyani',
  supportEmail: process.env.SUPPORT_EMAIL || 'hello@aiaccountingengineer.com',
  siteUrl: process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  whatsappGroupUrl: process.env.WHATSAPP_GROUP_URL || null,
};

// Optional add-ons offered at checkout (same product and price as the SuperProfile course checkout bump).
// Files live in the private Blob store under shared/addons/<id>/ (upload once: node scripts/addon-files.js upload).
const ADDONS = [
  {
    id: 'aiae-23-skills',
    name: '23 AI Skills - Ready to Use for CA, CMA, CS & BCom Graduates',
    shortName: '23 AI Skills pack',
    price: 999,
    files: [
      { name: 'AI Skills E-book Close, AP & AR.pdf', type: 'application/pdf' },
      { name: 'Files-to-add_1.zip', type: 'application/zip' },
    ],
  },
];

function cleanAddonIds(ids) {
  const wanted = new Set((Array.isArray(ids) ? ids : []).map(String));
  return ADDONS.filter((a) => wanted.has(a.id)).map((a) => a.id); // known ids only, catalogue order, no duplicates
}

function computeAmount(addonIds) {
  const ids = cleanAddonIds(addonIds);
  const base = PRICING.base;
  const addons = ids.reduce((sum, id) => sum + ADDONS.find((a) => a.id === id).price, 0);
  const subtotal = base + addons;
  const gst = Math.round(subtotal * PRICING.gstPercent) / 100;
  const total = Math.round(subtotal + gst);
  return { currency: PRICING.currency, base, addons, addonIds: ids, subtotal, gstPercent: PRICING.gstPercent, gst: Math.round(gst), total, totalPaise: total * 100 };
}

// 'razorpay' when keys exist, 'test' only when explicitly enabled, otherwise 'disabled'.
function paymentMode() {
  const explicit = (process.env.PAYMENT_MODE || '').toLowerCase();
  const hasRzp = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  if (explicit === 'razorpay') return hasRzp ? 'razorpay' : 'disabled';
  if (explicit === 'test') return 'test';
  if (hasRzp) return 'razorpay';
  if (process.env.VERCEL_ENV === 'production') return 'disabled';
  return 'test';
}

module.exports = { PRICING, PRODUCT, ADDONS, cleanAddonIds, computeAmount, paymentMode };
