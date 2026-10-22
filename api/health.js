'use strict';
const { send, wrap } = require('./_lib/http');
const { paymentMode } = require('./_lib/config');
const store = require('./_lib/store');
module.exports = wrap(async (req, res) => {
  send(res, 200, { ok: true, service: 'ai-accounting-funnel', paymentMode: paymentMode(), storage: store.hasBlob ? 'vercel-blob' : 'local', time: new Date().toISOString() });
});
