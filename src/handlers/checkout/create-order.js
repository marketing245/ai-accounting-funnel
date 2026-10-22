'use strict';
const crypto = require('crypto');
const { readJson, send, fail, allow, wrap, clientIp } = require('../../lib/http');
const { PRODUCT, computeAmount, paymentMode } = require('../../lib/config');
const store = require('../../lib/store');
const auth = require('../../lib/auth');
const rzp = require('../../lib/razorpay');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  const body = await readJson(req);
  const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const email = auth.normalizeEmail(body.email);
  const phone = String(body.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

  if (name.length < 2) return fail(res, 400, 'Please enter your full name.');
  if (!EMAIL_RE.test(email)) return fail(res, 400, 'Please enter a valid email address — it becomes your login.');
  if (!PHONE_RE.test(phone)) return fail(res, 400, 'Please enter a valid 10-digit Indian mobile number.');

  const mode = paymentMode();
  if (mode === 'disabled') return fail(res, 503, 'Payments are not configured yet. Please try again later.');

  const amount = computeAmount();
  const items = [{ id: PRODUCT.id, name: PRODUCT.name, price: amount.base, qty: 1 }];

  const clean = (t) => t && typeof t === 'object' ? Object.fromEntries(['source', 'medium', 'campaign', 'term', 'content', 'gclid', 'fbclid', 'referrer', 'landing', 'at'].map((k) => [k, String(t[k] || '').slice(0, 200)])) : null;
  const a = body.attribution && typeof body.attribution === 'object' ? body.attribution : {};
  const attribution = { first: clean(a.first), last: clean(a.last), page: String(a.page || '').slice(0, 300), screen: String(a.screen || '').slice(0, 20), userAgent: String(req.headers['user-agent'] || '').slice(0, 200) };

  const order = {
    id: null, gateway: mode, status: 'created',
    customer: { name, email, phone },
    items, amount,
    createdAt: new Date().toISOString(), paidAt: null, paymentId: null,
    ip: clientIp(req),
    attribution,
  };

  let response;
  if (mode === 'razorpay') {
    const receipt = `aiae_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const r = await rzp.createOrder({ amountPaise: amount.totalPaise, receipt, notes: { email, phone, name, product: PRODUCT.id } });
    order.id = r.id; order.receipt = receipt;
    response = {
      gateway: 'razorpay', orderId: r.id, keyId: rzp.keyId(), amountPaise: amount.totalPaise, currency: 'INR',
      description: PRODUCT.shortName,
      prefill: { name, email, contact: `+91${phone}` },
    };
  } else {
    order.id = `order_test_${crypto.randomBytes(8).toString('hex')}`;
    response = { gateway: 'test', orderId: order.id, amountPaise: amount.totalPaise, currency: 'INR', testToken: auth.signTestPayment(order.id) };
  }

  await store.writeJson(`orders/${order.id}.json`, order);
  send(res, 200, { ok: true, ...response, amount });
});
