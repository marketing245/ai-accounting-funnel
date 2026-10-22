'use strict';
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const auth = require('../../lib/auth');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!auth.sameOrigin(req, res)) return;
  const user = await auth.loadSessionUser(req, res, { requireAccess: false }); if (!user) return;
  const body = await readJson(req);
  const password = String(body.password || '');
  if (password.length < 8 || password.length > 128) return fail(res, 400, 'Password must be at least 8 characters.');
  if (user.passwordHash) {
    if (!auth.verifyPassword(String(body.currentPassword || ''), user.passwordHash)) return fail(res, 400, 'Current password is incorrect.');
  }
  user.passwordHash = auth.hashPassword(password);
  user.passwordSetAt = new Date().toISOString();
  await auth.saveUser(user);
  auth.setSession(res, req, user); // re-issue: older sessions (other devices) are now invalid
  send(res, 200, { ok: true });
});
