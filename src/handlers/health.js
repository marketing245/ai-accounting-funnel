'use strict';
const { send, wrap } = require('../lib/http');
const { paymentMode } = require('../lib/config');
const store = require('../lib/store');
module.exports = wrap(async (req, res) => {
  send(res, 200, { ok: true, service: 'ai-accounting-funnel', paymentMode: paymentMode(), storage: store.hasBlob ? 'vercel-blob' : 'local', time: new Date().toISOString() });
});
