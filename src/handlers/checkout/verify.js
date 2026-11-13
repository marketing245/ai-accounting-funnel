'use strict';
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const store = require('../../lib/store');
const auth = require('../../lib/auth');
const rzp = require('../../lib/razorpay');
const { fulfil } = require('../../lib/fulfil');
const { paymentMode } = require('../../lib/config');

function payerFrom(p) {
  return {
    email: auth.normalizeEmail(p.email || ''),
    phone: String(p.contact || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''),
  };
}

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!auth.sameOrigin(req, res)) return;
  const body = await readJson(req);
  const orderId = String(body.orderId || body.razorpay_order_id || '').trim();
  if (!/^order_[A-Za-z0-9_]{6,64}$/.test(orderId)) return fail(res, 400, 'Invalid order reference.');

  const order = await store.readJson(`orders/${orderId}.json`);
  if (!order) return fail(res, 404, 'Order not found.');

  let paymentId;
  let payment = null;
  if (order.gateway === 'razorpay') {
    paymentId = String(body.paymentId || body.razorpay_payment_id || '');
    const signature = String(body.signature || body.razorpay_signature || '');
    if (!paymentId || !rzp.verifyPaymentSignature(orderId, paymentId, signature)) {
      return fail(res, 400, 'Payment could not be verified. If money was deducted, it will be refunded automatically by Razorpay.');
    }
    // Belt and braces: confirm amount with Razorpay itself.
    const p = await rzp.fetchPayment(paymentId);
    payment = p;
    if (p.order_id !== orderId || Number(p.amount) !== order.amount.totalPaise || !['captured', 'authorized'].includes(p.status)) {
      return fail(res, 400, 'Payment details do not match this order.');
    }
  } else if (order.gateway === 'cashfree') {
    // Only the browser that created the order holds its token (the order id alone travels in URLs, so it is not enough).
    if (!auth.verifyClaim(orderId, String(body.verifyToken || ''))) return fail(res, 403, 'This payment session is not valid on this device. Please contact support if money was deducted.');
    // Never trust the browser: ask Cashfree whether this order is PAID for the exact amount.
    if (order.status !== 'paid') {
      const r = await require('../../lib/cashfree').confirmPaid(orderId, order.amount.total);
      if (!r.paid) {
        const msg = r.status === 'ACTIVE' ? 'The payment was not completed. Nothing has been charged. Please try again.' : 'Payment details do not match this order. If money was deducted, please contact support.';
        return fail(res, 402, msg, { code: 'NOT_PAID', status: r.status });
      }
      paymentId = r.paymentId;
      if (order.flow === 'payfirst') order.payer = { email: r.payer.email || '', phone: r.payer.phone || (order.payer && order.payer.phone) || '' };
    } else paymentId = order.paymentId;
  } else if (order.gateway === 'test') {
    if (paymentMode() !== 'test') return fail(res, 400, 'Test orders cannot be completed on the live site. Please start a new checkout.');
    if (!auth.verifyTestPayment(orderId, String(body.testToken || ''))) return fail(res, 400, 'Invalid test payment token.');
    paymentId = `pay_test_${orderId.slice(-8)}`;
  } else {
    return fail(res, 400, 'Unknown gateway.');
  }

  // Pay-first (express checkout): mark paid now, ask for email/phone next. Razorpay's own contact details are kept as a fallback.
  if (order.flow === 'payfirst' && !(order.customer && order.customer.email)) {
    if (payment) order.payer = payerFrom(payment);
    const { order: paidOrder } = await fulfil(order, paymentId, 'checkout');
    return send(res, 200, { ok: true, claim: true, orderId: paidOrder.id, claimToken: auth.signClaim(paidOrder.id), payer: paidOrder.payer || {}, amount: paidOrder.amount });
  }

  const { order: paidOrder, user } = await fulfil(order, paymentId, 'checkout');
  if (!user.firstLoginAt) { user.firstLoginAt = new Date().toISOString(); user.lastLoginAt = user.firstLoginAt; user.loginCount = (user.loginCount || 0) + 1; await auth.saveUser(user); }
  auth.setSession(res, req, user);
  send(res, 200, { ok: true, orderId: paidOrder.id, needsPassword: !user.passwordHash, next: `/thank-you?order=${encodeURIComponent(paidOrder.id)}` });
});
module.exports.payerFrom = payerFrom;
