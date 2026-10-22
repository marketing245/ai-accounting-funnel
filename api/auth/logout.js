'use strict';
const { send, allow, wrap } = require('../_lib/http');
const auth = require('../_lib/auth');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  auth.clearSession(res, req);
  send(res, 200, { ok: true });
});
