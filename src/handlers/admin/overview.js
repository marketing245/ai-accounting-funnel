'use strict';
const { send, allow, wrap } = require('../../lib/http');
const admin = require('../../lib/admin');
const { paymentMode } = require('../../lib/config');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  if (!admin.requireAdmin(req, res)) return;
  const data = await admin.overview();
  send(res, 200, { ok: true, paymentMode: paymentMode(), generatedAt: new Date().toISOString(), ...data });
});
