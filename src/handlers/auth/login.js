'use strict';
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const auth = require('../../lib/auth');

const MAX_ATTEMPTS = 6, LOCK_MINUTES = 15;

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  const body = await readJson(req);
  const email = auth.normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) return fail(res, 400, 'Enter your email and password.');

  const user = await auth.getUser(email);
  const generic = () => fail(res, 401, 'Email or password is incorrect.');
  if (!user) return generic();
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return fail(res, 429, `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`);
  if (!user.passwordHash) return fail(res, 409, 'Your login password is not set yet. Use the link from your purchase confirmation, or contact support.', { code: 'NO_PASSWORD' });
  if (!auth.verifyPassword(password, user.passwordHash)) {
    user.failedLogins = (user.failedLogins || 0) + 1;
    if (user.failedLogins >= MAX_ATTEMPTS) { user.failedLogins = 0; user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(); }
    await auth.saveUser(user);
    return generic();
  }
  if (user.failedLogins || user.lockedUntil) { user.failedLogins = 0; user.lockedUntil = null; await auth.saveUser(user); }
  if (!user.purchases || user.purchases.length === 0) return fail(res, 403, 'No active course purchase on this account.');
  auth.setSession(res, req, user);
  send(res, 200, { ok: true, user: { name: user.name, email: user.email } });
});
