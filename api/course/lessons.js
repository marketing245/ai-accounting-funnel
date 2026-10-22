'use strict';
const { send, fail, allow, wrap } = require('../_lib/http');
const auth = require('../_lib/auth');
const { CURRICULUM, RESOURCES, publicCurriculum } = require('../_lib/course');
const bunny = require('../_lib/bunny');
const { PRODUCT } = require('../_lib/config');

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
    user: { name: user.name, email: user.email, phone: user.phone, hasBump: !!user.hasBump },
    course: { title: PRODUCT.name, modules, resources: RESOURCES, videoProtected: bunny.signed(), whatsappGroupUrl: PRODUCT.whatsappGroupUrl, supportEmail: PRODUCT.supportEmail },
    progress: user.progress || { completed: [] },
  });
});
