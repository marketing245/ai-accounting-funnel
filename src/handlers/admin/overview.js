'use strict';
const { send, allow, wrap, getQuery } = require('../../lib/http');
const admin = require('../../lib/admin');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  if (!admin.requireAdmin(req, res)) return;
  const q = getQuery(req);
  const days = q.days === 'all' ? 'all' : Math.max(1, Math.min(365, parseInt(q.days, 10) || 30));
  const data = await admin.overview({ days, force: q.refresh === '1' });
  send(res, 200, { ok: true, generatedAt: new Date().toISOString(), ...data });
});
