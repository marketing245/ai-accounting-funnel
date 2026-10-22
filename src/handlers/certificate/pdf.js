'use strict';
// GET /api/certificate/pdf — the logged-in student's certificate as a downloadable PDF.
const { fail, allow, wrap } = require('../../lib/http');
const auth = require('../../lib/auth');
const cert = require('../../lib/certificate');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const session = auth.requireSession(req, res); if (!session) return;
  const user = await auth.getUser(session.email);
  if (!user || !user.purchases || user.purchases.length === 0) return fail(res, 403, 'No active course purchase on this account.');
  const c = await cert.ensureCertificate(user);
  if (!c) return fail(res, 409, 'Complete all modules to unlock your certificate.');
  const pdf = await cert.buildPdf({ id: c.id, name: user.name, issuedAt: c.issuedAt });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="AI-Accounting-Engineer-Certificate-${c.id}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(pdf);
});
