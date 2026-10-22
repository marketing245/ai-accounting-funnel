'use strict';
const { send, allow, wrap } = require('../../lib/http');
const auth = require('../../lib/auth');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const user = await auth.loadSessionUser(req, res, { requireAccess: false }); if (!user) return;
  const last = user.purchases[user.purchases.length - 1] || null;
  send(res, 200, { ok: true, user: { name: user.name, email: user.email, phone: user.phone, hasPassword: !!user.passwordHash,
    hasAccess: auth.hasAccess(user), purchasedAt: last ? last.at : null } });
});
