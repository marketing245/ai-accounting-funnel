'use strict';
const crypto = require('crypto');

const API = 'https://api.razorpay.com/v1';

function creds() {
  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) { const e = new Error('Razorpay is not configured'); e.status = 503; throw e; }
  return { id, secret, basic: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') };
}

async function createOrder({ amountPaise, receipt, notes }) {
  const { basic } = creds();
  const r = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: basic, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes: notes || {} }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data?.error?.description || 'Could not create payment order'); e.status = 502; throw e; }
  return data; // { id: 'order_...', amount, currency, status, ... }
}

async function fetchPayment(paymentId) {
  const { basic } = creds();
  const r = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: basic } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('Could not fetch payment'); e.status = 502; throw e; }
  return data;
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

// Checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
function verifyPaymentSignature(orderId, paymentId, signature) {
  const { secret } = creds();
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature || '');
}

// Webhook signature = HMAC_SHA256(raw body, webhook_secret) in X-Razorpay-Signature
function verifyWebhookSignature(rawBody, signature) {
  const ws = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!ws) return false;
  const expected = crypto.createHmac('sha256', ws).update(rawBody).digest('hex');
  return safeEqual(expected, signature || '');
}

module.exports = { createOrder, fetchPayment, verifyPaymentSignature, verifyWebhookSignature, keyId: () => process.env.RAZORPAY_KEY_ID || null };
