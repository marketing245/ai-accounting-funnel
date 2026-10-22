'use strict';
const { send, allow, wrap } = require('../../lib/http');
const auth = require('../../lib/auth');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  auth.clearSession(res, req);
  send(res, 200, { ok: true });
});
