'use strict';
const { send, allow, wrap } = require('../../lib/http');
const { PRICING, PRODUCT, computeAmount, paymentMode } = require('../../lib/config');
const rzp = require('../../lib/razorpay');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const mode = paymentMode();
  send(res, 200, {
    ok: true,
    mode,
    keyId: mode === 'razorpay' ? rzp.keyId() : null,
    pricing: PRICING,
    product: { id: PRODUCT.id, name: PRODUCT.name, supportEmail: PRODUCT.supportEmail },
    amount: computeAmount(),
  });
});
