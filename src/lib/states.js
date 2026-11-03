'use strict';
// Indian states and union territories with their GST state codes (first two digits of a GSTIN).
const STATES = [
  ['35', 'Andaman and Nicobar Islands'], ['37', 'Andhra Pradesh'], ['12', 'Arunachal Pradesh'], ['18', 'Assam'],
  ['10', 'Bihar'], ['04', 'Chandigarh'], ['22', 'Chhattisgarh'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['07', 'Delhi'], ['30', 'Goa'], ['24', 'Gujarat'], ['06', 'Haryana'], ['02', 'Himachal Pradesh'],
  ['01', 'Jammu and Kashmir'], ['20', 'Jharkhand'], ['29', 'Karnataka'], ['32', 'Kerala'], ['38', 'Ladakh'],
  ['31', 'Lakshadweep'], ['23', 'Madhya Pradesh'], ['27', 'Maharashtra'], ['14', 'Manipur'], ['17', 'Meghalaya'],
  ['15', 'Mizoram'], ['13', 'Nagaland'], ['21', 'Odisha'], ['34', 'Puducherry'], ['03', 'Punjab'],
  ['08', 'Rajasthan'], ['11', 'Sikkim'], ['33', 'Tamil Nadu'], ['36', 'Telangana'], ['16', 'Tripura'],
  ['09', 'Uttar Pradesh'], ['05', 'Uttarakhand'], ['19', 'West Bengal'],
].map(([code, name]) => ({ code, name }));

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const byCode = (code) => STATES.find((s) => s.code === String(code || ''));

/** Returns { state, gstin } or { error } for the checkout form. State is required, GSTIN optional. */
function checkPlaceOfSupply(stateCode, gstinRaw) {
  const state = byCode(stateCode);
  if (!state) return { error: 'Please select your state.' };
  const gstin = String(gstinRaw || '').toUpperCase().replace(/\s+/g, '');
  if (!gstin) return { state, gstin: '' };
  if (!GSTIN_RE.test(gstin)) return { error: 'Please enter a valid 15-character GSTIN, or leave it blank.' };
  if (gstin.slice(0, 2) !== state.code) {
    const other = byCode(gstin.slice(0, 2));
    return { error: `This GSTIN is registered in ${other ? other.name : 'another state'}. Please select that state or check the GSTIN.` };
  }
  return { state, gstin };
}

module.exports = { STATES, GSTIN_RE, byCode, checkPlaceOfSupply };
