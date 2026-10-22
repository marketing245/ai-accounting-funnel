'use strict';
const { send, allow, wrap } = require('../_lib/http');
const auth = require('../_lib/auth');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const session = auth.requireSession(req, res); if (!session) return;
  const user = await auth.getUser(session.email);
  if (!user) { auth.clearSession(res, req); return send(res, 401, { ok: false, error: 'Session expired.', code: 'UNAUTHENTICATED' }); }
  const last = user.purchases[user.purchases.length - 1] || null;
  send(res, 200, { ok: true, user: { name: user.name, email: user.email, phone: user.phone, hasPassword: !!user.passwordHash, hasBump: !!user.hasBump,
    hasAccess: user.purchases.length > 0, purchasedAt: last ? last.at : null } });
});
