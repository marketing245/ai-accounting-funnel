'use strict';
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const admin = require('../../lib/admin');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!process.env.ADMIN_PASSWORD) return fail(res, 503, 'ADMIN_PASSWORD is not configured on the server.');
  const body = await readJson(req);
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  if (!admin.checkPassword(String(body.password || ''))) return fail(res, 401, 'Wrong password.');
  admin.setAdminSession(res, req);
  send(res, 200, { ok: true });
});
