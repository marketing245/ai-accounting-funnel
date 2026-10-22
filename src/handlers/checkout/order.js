'use strict';
const { send, fail, allow, wrap, getQuery } = require('../../lib/http');
const store = require('../../lib/store');
const auth = require('../../lib/auth');

// Order summary for the thank-you page. Only the buyer (logged-in session) can read it.
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const session = auth.requireSession(req, res); if (!session) return;
  const id = String(getQuery(req).id || '');
  if (!/^order_[A-Za-z0-9_]{6,64}$/.test(id)) return fail(res, 400, 'Invalid order reference.');
  const order = await store.readJson(`orders/${id}.json`);
  if (!order || auth.normalizeEmail(order.customer.email) !== session.email) return fail(res, 404, 'Order not found.');
  send(res, 200, { ok: true, order: { id: order.id, status: order.status, gateway: order.gateway, paymentId: order.paymentId, paidAt: order.paidAt,
    customer: { name: order.customer.name, email: order.customer.email }, items: order.items, amount: order.amount } });
});
