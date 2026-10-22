'use strict';
// Single source of truth for pricing, product names and site settings.
// Amounts are in INR rupees. Razorpay receives paise (x100).

const PRICING = {
  currency: 'INR',
  base: 1499,              // course price before tax
  regular: 5000,           // regular (MRP) price shown struck through
  bump: 399,               // optional prompt & SOP pack
  gstPercent: 18,
};

const PRODUCT = {
  id: 'aiae-course',
  name: 'AI in Accounting — Course by CA Varsha Varyani',
  shortName: 'AI in Accounting Course',
  bumpId: 'aiae-prompt-pack',
  bumpName: '50+ Claude Prompts & SOP Pack',
  brand: 'AI Accounting Engineer',
  supportEmail: process.env.SUPPORT_EMAIL || 'hello@aiaccountingengineer.com',
  siteUrl: process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  whatsappGroupUrl: process.env.WHATSAPP_GROUP_URL || null,
};

function computeAmount(withBump) {
  const base = PRICING.base;
  const bump = withBump ? PRICING.bump : 0;
  const subtotal = base + bump;
  const gst = Math.round(subtotal * PRICING.gstPercent) / 100;
  const total = Math.round(subtotal + gst);
  return { currency: PRICING.currency, base, bump, subtotal, gstPercent: PRICING.gstPercent, gst: Math.round(gst), total, totalPaise: total * 100 };
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

module.exports = { PRICING, PRODUCT, computeAmount, paymentMode };
