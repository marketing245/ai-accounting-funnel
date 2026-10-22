'use strict';
const { readJson, send, fail, allow, wrap } = require('../_lib/http');
const auth = require('../_lib/auth');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  const session = auth.requireSession(req, res); if (!session) return;
  const body = await readJson(req);
  const password = String(body.password || '');
  if (password.length < 8 || password.length > 128) return fail(res, 400, 'Password must be at least 8 characters.');
  const user = await auth.getUser(session.email);
  if (!user) return fail(res, 401, 'Session expired.');
  if (user.passwordHash) {
    if (!auth.verifyPassword(String(body.currentPassword || ''), user.passwordHash)) return fail(res, 400, 'Current password is incorrect.');
  }
  user.passwordHash = auth.hashPassword(password);
  user.passwordSetAt = new Date().toISOString();
  await auth.saveUser(user);
  send(res, 200, { ok: true });
});
