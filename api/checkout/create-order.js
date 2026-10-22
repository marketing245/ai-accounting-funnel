'use strict';
const crypto = require('crypto');
const { readJson, send, fail, allow, wrap, clientIp } = require('../_lib/http');
const { PRODUCT, computeAmount, paymentMode } = require('../_lib/config');
const store = require('../_lib/store');
const auth = require('../_lib/auth');
const rzp = require('../_lib/razorpay');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  const body = await readJson(req);
  const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const email = auth.normalizeEmail(body.email);
  const phone = String(body.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const bump = body.bump === true || body.bump === 'true';

  if (name.length < 2) return fail(res, 400, 'Please enter your full name.');
  if (!EMAIL_RE.test(email)) return fail(res, 400, 'Please enter a valid email address — it becomes your login.');
  if (!PHONE_RE.test(phone)) return fail(res, 400, 'Please enter a valid 10-digit Indian mobile number.');

  const mode = paymentMode();
  if (mode === 'disabled') return fail(res, 503, 'Payments are not configured yet. Please try again later.');

  const amount = computeAmount(bump);
  const items = [{ id: PRODUCT.id, name: PRODUCT.name, price: amount.base, qty: 1 }];
  if (bump) items.push({ id: PRODUCT.bumpId, name: PRODUCT.bumpName, price: amount.bump, qty: 1 });

  const order = {
    id: null, gateway: mode, status: 'created',
    customer: { name, email, phone },
    bump, items, amount,
    createdAt: new Date().toISOString(), paidAt: null, paymentId: null,
    ip: clientIp(req),
  };

  let response;
  if (mode === 'razorpay') {
    const receipt = `aiae_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const r = await rzp.createOrder({ amountPaise: amount.totalPaise, receipt, notes: { email, phone, name, product: PRODUCT.id, bump: String(bump) } });
    order.id = r.id; order.receipt = receipt;
    response = {
      gateway: 'razorpay', orderId: r.id, keyId: rzp.keyId(), amountPaise: amount.totalPaise, currency: 'INR',
      description: PRODUCT.shortName + (bump ? ' + ' + PRODUCT.bumpName : ''),
      prefill: { name, email, contact: `+91${phone}` },
    };
  } else {
    order.id = `order_test_${crypto.randomBytes(8).toString('hex')}`;
    response = { gateway: 'test', orderId: order.id, amountPaise: amount.totalPaise, currency: 'INR', testToken: auth.signTestPayment(order.id) };
  }

  await store.writeJson(`orders/${order.id}.json`, order);
  send(res, 200, { ok: true, ...response, amount });
});
