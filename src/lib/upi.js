'use strict';
// Direct-UPI payments (PAYMENT_MODE=upi): payment link + QR for the instructor's UPI ID, UTR checks.
const crypto = require('crypto');
const { UPI, PRODUCT } = require('./config');

// Short reference the buyer sees in the UPI note, so the payment is easy to spot in the UPI app.
function newRef() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'VV' + Array.from(crypto.randomBytes(6), (b) => abc[b % abc.length]).join('');
}

// upi://pay deep link (NPCI linking spec): opens any UPI app with payee, amount and note filled in.
function link({ amount, ref }) {
  // The UPI ID stays unencoded: several UPI apps reject "%40" in place of "@".
  const vpa = UPI.vpa.replace(/[^A-Za-z0-9.\-_@]/g, '');
  const tn = `${PRODUCT.shortName} ${ref}`.slice(0, 50);
  return `upi://pay?pa=${vpa}&pn=${encodeURIComponent(UPI.payeeName)}&am=${Number(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(tn)}`;
}

async function qrSvg(text) {
  return require('qrcode').toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0f1b2d', light: '#ffffff' } });
}

// UTR / UPI reference number: 12 digits in every Indian UPI app.
function cleanUtr(v) { return String(v || '').replace(/\D/g, ''); }
function validUtr(utr) { return /^\d{12}$/.test(utr); }

module.exports = { newRef, link, qrSvg, cleanUtr, validUtr };
