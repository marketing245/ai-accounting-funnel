'use strict';
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const store = require('../../lib/store');
const auth = require('../../lib/auth');
const rzp = require('../../lib/razorpay');
const { fulfil } = require('../../lib/fulfil');
const { paymentMode } = require('../../lib/config');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!auth.sameOrigin(req, res)) return;
  const body = await readJson(req);
  const orderId = String(body.orderId || body.razorpay_order_id || '').trim();
  if (!/^order_[A-Za-z0-9_]{6,64}$/.test(orderId)) return fail(res, 400, 'Invalid order reference.');

  const order = await store.readJson(`orders/${orderId}.json`);
  if (!order) return fail(res, 404, 'Order not found.');

  let paymentId;
  if (order.gateway === 'razorpay') {
    paymentId = String(body.paymentId || body.razorpay_payment_id || '');
    const signature = String(body.signature || body.razorpay_signature || '');
    if (!paymentId || !rzp.verifyPaymentSignature(orderId, paymentId, signature)) {
      return fail(res, 400, 'Payment could not be verified. If money was deducted, it will be refunded automatically by Razorpay.');
    }
    // Belt and braces: confirm amount with Razorpay itself.
    const p = await rzp.fetchPayment(paymentId);
    if (p.order_id !== orderId || Number(p.amount) !== order.amount.totalPaise || !['captured', 'authorized'].includes(p.status)) {
      return fail(res, 400, 'Payment details do not match this order.');
    }
  } else if (order.gateway === 'test') {
    if (paymentMode() !== 'test') return fail(res, 400, 'Test orders cannot be completed on the live site. Please start a new checkout.');
    if (!auth.verifyTestPayment(orderId, String(body.testToken || ''))) return fail(res, 400, 'Invalid test payment token.');
    paymentId = `pay_test_${orderId.slice(-8)}`;
  } else {
    return fail(res, 400, 'Unknown gateway.');
  }

  const { order: paidOrder, user } = await fulfil(order, paymentId, 'checkout');
  if (!user.firstLoginAt) { user.firstLoginAt = new Date().toISOString(); user.lastLoginAt = user.firstLoginAt; user.loginCount = (user.loginCount || 0) + 1; await auth.saveUser(user); }
  auth.setSession(res, req, user);
  send(res, 200, { ok: true, orderId: paidOrder.id, needsPassword: !user.passwordHash, next: `/thank-you?order=${encodeURIComponent(paidOrder.id)}` });
});
