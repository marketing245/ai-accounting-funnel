'use strict';
// GET /api/certificate — status for the logged-in student; issues the certificate once all modules are complete.
const { send, fail, allow, wrap } = require('../lib/http');
const auth = require('../lib/auth');
const cert = require('../lib/certificate');
const { CURRICULUM } = require('../lib/course');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const session = auth.requireSession(req, res); if (!session) return;
  const user = await auth.getUser(session.email);
  if (!user || !user.purchases || user.purchases.length === 0) return fail(res, 403, 'No active course purchase on this account.');
  const total = CURRICULUM.length, left = cert.remaining(user);
  if (left > 0 && !(user.certificate && user.certificate.id)) {
    return send(res, 200, { ok: true, ready: false, completed: total - left, total, remaining: left });
  }
  const c = await cert.ensureCertificate(user);
  const issued = new Date(c.issuedAt);
  const linkedin = 'https://www.linkedin.com/profile/add?' + new URLSearchParams({
    startTask: 'CERTIFICATION_NAME', name: cert.COURSE_TITLE, organizationName: 'AI Accounting Engineer',
    issueYear: String(issued.getFullYear()), issueMonth: String(issued.getMonth() + 1), certUrl: cert.verifyUrl(c.id), certId: c.id,
  }).toString();
  send(res, 200, { ok: true, ready: true, completed: total, total, certificate: { id: c.id, issuedAt: c.issuedAt, pdfUrl: '/api/certificate/pdf', verifyUrl: cert.verifyUrl(c.id), linkedinUrl: linkedin } });
});
