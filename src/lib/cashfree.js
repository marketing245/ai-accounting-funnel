'use strict';
// Cashfree Payment Gateway (PG API version 2023-08-01).
// Env: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV=production|sandbox (default production).
// Flow: createOrder → payment_session_id → browser opens Cashfree checkout (JS SDK v3) → server confirms with getOrder.
// Webhooks: order_meta.notify_url → POST /api/checkout/webhook, signed base64(HMAC_SHA256(timestamp + raw body, secret)).
const crypto = require('crypto');

const VERSION = '2023-08-01';
const env = () => (String(process.env.CASHFREE_ENV || 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production');
const base = () => (env() === 'sandbox' ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg');
const configured = () => !!(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);

function headers() {
  if (!configured()) { const e = new Error('Cashfree is not configured'); e.status = 503; throw e; }
  return {
    'x-client-id': process.env.CASHFREE_APP_ID,
    'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    'x-api-version': VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function call(method, path, body) {
  const r = await fetch(base() + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('cashfree', method, path, r.status, data && (data.code || data.type), data && data.message);
    const e = new Error(method === 'POST' ? 'Could not start the payment. Please try again.' : 'Could not check the payment with Cashfree.');
    e.status = 502; e.cashfree = { status: r.status, code: data && data.code, message: data && data.message };
    throw e;
  }
  return data;
}

// amount in rupees (Cashfree takes rupees, not paise)
function createOrder({ orderId, amount, customer, returnUrl, notifyUrl, note, tags }) {
  return call('POST', '/orders', {
    order_id: orderId,
    order_amount: Number(amount),
    order_currency: 'INR',
    customer_details: {
      customer_id: customer.id,
      customer_phone: customer.phone,
      ...(customer.email ? { customer_email: customer.email } : {}),
      ...(customer.name ? { customer_name: customer.name } : {}),
    },
    order_meta: { return_url: returnUrl, ...(notifyUrl ? { notify_url: notifyUrl } : {}) },
    order_note: String(note || '').slice(0, 200),
    order_tags: tags || {},
  });
}

const getOrder = (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}`);
const getPayments = (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}/payments`);

function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function verifyWebhookSignature(rawBody, timestamp, signature) {
  if (!configured() || !timestamp || !signature) return false;
  const expected = crypto.createHmac('sha256', process.env.CASHFREE_SECRET_KEY).update(String(timestamp) + rawBody.toString('utf8')).digest('base64');
  return safeEqual(expected, signature);
}

// Confirms with Cashfree that the order is paid for exactly the expected amount; returns { paid, paymentId, payer, status }.
async function confirmPaid(orderId, expectedRupees) {
  const o = await getOrder(orderId);
  const status = String(o.order_status || '');
  if (status !== 'PAID') return { paid: false, status };
  if (Math.round(Number(o.order_amount) * 100) !== Math.round(Number(expectedRupees) * 100)) return { paid: false, status: 'AMOUNT_MISMATCH' };
  let paymentId = '';
  try {
    const list = await getPayments(orderId);
    const ok = (Array.isArray(list) ? list : []).find((p) => p.payment_status === 'SUCCESS');
    if (ok) paymentId = String(ok.cf_payment_id);
  } catch (e) { /* the order is PAID; the payment id is nice to have */ }
  const c = o.customer_details || {};
  return {
    paid: true, status, paymentId: paymentId ? `cf_${paymentId}` : `cf_order_${o.cf_order_id || orderId}`,
    payer: { email: String(c.customer_email || '').trim().toLowerCase(), phone: String(c.customer_phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '') },
  };
}

module.exports = { env, configured, createOrder, getOrder, getPayments, verifyWebhookSignature, confirmPaid };
