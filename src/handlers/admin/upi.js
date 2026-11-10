'use strict';
// POST /api/admin/upi — direct-UPI orders: approve (grant access + access link), reject, or get the access link again.
// Body: { action: 'approve' | 'reject' | 'link', orderId, reason? }
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const admin = require('../../lib/admin');
const auth = require('../../lib/auth');
const store = require('../../lib/store');
const { fulfil } = require('../../lib/fulfil');
const { PRODUCT, UPI } = require('../../lib/config');

function accessMessage(order, link) {
  const first = String((order.customer && order.customer.name) || '').split(' ')[0] || 'there';
  return `Hi ${first}, your payment for ${PRODUCT.shortName} is confirmed. Open this link to create your password and start the course (valid for 14 days):\n${link}\n\nAfter that, log in any time at ${PRODUCT.siteUrl.replace(/\/$/, '')}/login with your email ${order.customer.email}.\n\n- Team CA Varsha Varyani`;
}

async function linkFor(order) {
  const user = await auth.getUser(order.customer.email);
  if (!user) return null;
  const link = `${PRODUCT.siteUrl.replace(/\/$/, '')}/api/auth/access?t=${auth.signAccess(user, order.id)}`;
  return { link, message: accessMessage(order, link), email: order.customer.email, phone: order.customer.phone, name: order.customer.name, hasPassword: !!user.passwordHash };
}

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!auth.sameOrigin(req, res)) return;
  if (!admin.requireAdmin(req, res)) return;
  const body = await readJson(req);
  const action = String(body.action || '');
  const orderId = String(body.orderId || '').trim();
  if (!/^order_upi_[a-f0-9]{16}$/.test(orderId)) return fail(res, 400, 'Invalid order id.');
  const order = await store.readJson(`orders/${orderId}.json`);
  if (!order || order.gateway !== 'upi') return fail(res, 404, 'UPI order not found.');
  if (!(order.customer && order.customer.email)) return fail(res, 409, 'This order has no email yet.');
  const now = new Date().toISOString();

  if (action === 'approve') {
    if (order.status !== 'paid') {
      if (!order.upi || !order.upi.utr) return fail(res, 409, 'The buyer has not submitted a UTR for this order.');
      order.upi.approvedAt = now; order.upi.rejectedAt = null; order.upi.rejectReason = '';
      await fulfil(order, `upi_${order.upi.utr}`, 'admin-upi'); // marks paid, creates the student, sends the Purchase signal
    }
    return send(res, 200, { ok: true, status: 'paid', ...(await linkFor(order)) });
  }
  if (action === 'reject') {
    if (order.status === 'paid') return fail(res, 409, 'This order is already approved. Remove access manually if needed.');
    order.status = 'rejected';
    order.upi = Object.assign(order.upi || {}, { rejectedAt: now, rejectReason: String(body.reason || '').slice(0, 200) });
    await store.writeJson(`orders/${order.id}.json`, order);
    return send(res, 200, { ok: true, status: 'rejected', email: order.customer.email, phone: order.customer.phone, name: order.customer.name,
      message: `Hi ${String(order.customer.name || '').split(' ')[0] || 'there'}, we could not find a UPI payment of ₹${order.amount.total.toLocaleString('en-IN')} to ${UPI.vpa} with UTR ${order.upi.utr || '-'}. Please reply with a screenshot of the payment and we will sort it out.\n\n- Team CA Varsha Varyani` });
  }
  if (action === 'link') {
    if (order.status !== 'paid') return fail(res, 409, 'Approve the payment first.');
    return send(res, 200, { ok: true, status: 'paid', ...(await linkFor(order)) });
  }
  return fail(res, 400, 'Unknown action.');
});
