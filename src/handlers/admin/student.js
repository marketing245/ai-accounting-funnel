'use strict';
const { send, allow, wrap, getQuery, fail } = require('../../lib/http');
const admin = require('../../lib/admin');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  if (!admin.requireAdmin(req, res)) return;
  const email = String(getQuery(req).email || '').trim();
  if (!email) return fail(res, 400, 'email required');
  const d = await admin.studentDetail(email);
  if (!d) return fail(res, 404, 'Student not found');
  send(res, 200, { ok: true, ...d });
});
