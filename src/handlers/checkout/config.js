'use strict';
const { send, allow, wrap } = require('../../lib/http');
const { PRICING, PRODUCT, ADDONS, computeAmount, paymentMode } = require('../../lib/config');
const rzp = require('../../lib/razorpay');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const mode = paymentMode();
  send(res, 200, {
    ok: true,
    mode,
    formToken: require('../../lib/auth').issueFormToken(),
    keyId: mode === 'razorpay' ? rzp.keyId() : null,
    pricing: PRICING,
    product: { id: PRODUCT.id, name: PRODUCT.name, supportEmail: PRODUCT.supportEmail },
    amount: computeAmount(),
    addons: ADDONS.map((a) => ({ id: a.id, name: a.name, shortName: a.shortName, price: a.price, amountWith: computeAmount([a.id]) })),
    states: require('../../lib/states').STATES,
    amountWithAllAddons: computeAmount(ADDONS.map((a) => a.id)),
  });
});
