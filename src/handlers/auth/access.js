'use strict';
// GET /api/auth/access?t=<token> — the link sent to a buyer after their UPI payment is approved in /admin.
// Valid token → session cookie → /thank-you (create a password, then the portal). Anything else → /login.
const { allow, wrap, getQuery } = require('../../lib/http');
const auth = require('../../lib/auth');

const go = (res, to) => { res.statusCode = 302; res.setHeader('Location', to); res.setHeader('Cache-Control', 'no-store'); res.end(); };

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const p = auth.verifyAccess(String(getQuery(req).t || ''));
  if (!p) return go(res, '/login?link=expired');
  const user = await auth.getUser(p.e);
  const pv = user && user.passwordSetAt ? Date.parse(user.passwordSetAt) : 0;
  if (!user || !auth.hasAccess(user) || pv !== p.pv) return go(res, '/login?link=used');
  if (!user.firstLoginAt) { user.firstLoginAt = new Date().toISOString(); user.lastLoginAt = user.firstLoginAt; user.loginCount = (user.loginCount || 0) + 1; await auth.saveUser(user); }
  auth.setSession(res, req, user);
  go(res, user.passwordHash ? '/portal' : `/thank-you${p.o ? '?order=' + encodeURIComponent(p.o) : ''}`);
});
