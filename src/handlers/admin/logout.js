'use strict';
const { send, allow, wrap } = require('../../lib/http');
const admin = require('../../lib/admin');
module.exports = wrap(async (req, res) => { if (!allow(req, res, ['POST'])) return; admin.clearAdminSession(res, req); send(res, 200, { ok: true }); });
