'use strict';
// GET /api/certificate/verify?id=AAE-2026-XXXXXX — public check used by /verify and by LinkedIn viewers.
const { send, allow, wrap, getQuery } = require('../_lib/http');
const cert = require('../_lib/certificate');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const id = String(getQuery(req).id || '').trim().toUpperCase();
  const r = await cert.getPublicRecord(id);
  if (!r) return send(res, 200, { ok: true, valid: false, id });
  send(res, 200, { ok: true, valid: true, certificate: r }, { 'Cache-Control': 'public, max-age=300' });
});
