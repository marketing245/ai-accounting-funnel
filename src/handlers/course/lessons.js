'use strict';
const { send, fail, allow, wrap } = require('../../lib/http');
const auth = require('../../lib/auth');
const { CURRICULUM, publicCurriculum } = require('../../lib/course');
const bunny = require('../../lib/bunny');
const { PRODUCT } = require('../../lib/config');

// Everything the portal needs, in one authenticated call. Video embed URLs are generated per request (signed when enabled).
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const session = auth.requireSession(req, res); if (!session) return;
  const user = await auth.getUser(session.email);
  if (!user || !user.purchases || user.purchases.length === 0) return fail(res, 403, 'No active course purchase on this account.', { code: 'NO_ACCESS' });

  const modules = publicCurriculum().map((m) => {
    const src = CURRICULUM.find((c) => c.id === m.id);
    return { ...m, embedUrl: src.bunnyVideoId ? bunny.embedUrl(src.bunnyVideoId) : null };
  });
  send(res, 200, {
    ok: true,
    user: { name: user.name, email: user.email, phone: user.phone },
    course: { title: PRODUCT.name, modules, videoProtected: bunny.signed(), whatsappGroupUrl: PRODUCT.whatsappGroupUrl, supportEmail: PRODUCT.supportEmail },
    progress: user.progress || { completed: [] },
  });
});
