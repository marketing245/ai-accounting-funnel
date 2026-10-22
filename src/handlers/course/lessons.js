'use strict';
const { send, fail, allow, wrap } = require('../../lib/http');
const auth = require('../../lib/auth');
const { CURRICULUM, publicCurriculum } = require('../../lib/course');
const bunny = require('../../lib/bunny');
const { PRODUCT } = require('../../lib/config');

// Everything the portal needs, in one authenticated call. Video embed URLs are generated per request (signed when enabled).
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const user = await auth.loadSessionUser(req, res); if (!user) return;

  const videos = await bunny.resolveVideos(CURRICULUM);
  const modules = publicCurriculum().map((m) => {
    const v = videos[m.id];
    return {
      ...m,
      duration: bunny.durationLabel(v && v.lengthSec, m.duration),
      embedUrl: v && v.ready ? bunny.embedUrl(v.videoId) : null,
      videoStatus: v ? v.statusText : 'missing',
    };
  });
  send(res, 200, {
    ok: true,
    user: { name: user.name, email: user.email, phone: user.phone },
    course: { title: PRODUCT.name, modules, videoProtected: bunny.signed(), whatsappGroupUrl: PRODUCT.whatsappGroupUrl, supportEmail: PRODUCT.supportEmail },
    progress: user.progress || { completed: [] },
  });
});
