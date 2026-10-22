'use strict';
const crypto = require('crypto');

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '786834';

// Bunny Stream embed URL. If BUNNY_TOKEN_AUTH_KEY is set (Stream library > Security > Embed view token authentication),
// the URL is signed and expires, so it cannot be shared or embedded elsewhere.
function embedUrl(videoId, ttlSeconds = 6 * 3600) {
  const params = new URLSearchParams({ autoplay: 'false', loop: 'false', muted: 'false', preload: 'true', responsive: 'true' });
  const key = process.env.BUNNY_TOKEN_AUTH_KEY;
  if (key) {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = crypto.createHash('sha256').update(`${key}${videoId}${expires}`).digest('hex');
    params.set('token', token);
    params.set('expires', String(expires));
  }
  return `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${videoId}?${params.toString()}`;
}

module.exports = { embedUrl, LIBRARY_ID, signed: () => !!process.env.BUNNY_TOKEN_AUTH_KEY };
