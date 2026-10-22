'use strict';
const { send, allow, wrap, getQuery, fail } = require('../../lib/http');
const admin = require('../../lib/admin');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  if (!admin.requireAdmin(req, res)) return;
  const id = String(getQuery(req).id || '');
  if (!/^order_[A-Za-z0-9_]{6,64}$/.test(id)) return fail(res, 400, 'Invalid order id');
  const d = await admin.orderDetail(id);
  if (!d) return fail(res, 404, 'Order not found');
  send(res, 200, { ok: true, ...d });
});
