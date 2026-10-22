/**
 * AI Accounting Engineer - Marketing Funnel Engine Server
 * Pure Node.js zero-dependency HTTP server
 * Optimized for instant Railway / Vercel / Docker deployment
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'ai-accounting-funnel-engine',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
    return;
  }

  if (pathname === '/api/funnel-metrics' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      product: 'AI Accounting Engineer',
      basePrice: 1499,
      orderBumpPrice: 399,
      upsellPrice: 2999,
      variations: [
        { id: 'v1', name: 'Direct-to-Offer + Order Bump & Upsell', targetAOV: 2150, estimatedROAS: '3.2x' },
        { id: 'v2', name: 'Free Lead Magnet + WhatsApp Nurture', targetAOV: 1499, estimatedROAS: '4.5x (Blended)' },
        { id: 'v3', name: '₹99 Live Sunday Workshop', targetAOV: 1850, estimatedROAS: '3.8x' },
        { id: 'v4', name: 'LinkedIn Organic Authority', targetAOV: 1499, estimatedROAS: 'Infinite (Zero Ad Spend)' },
        { id: 'v5', name: 'B2B CA Firm Team License', targetAOV: 18999, estimatedROAS: '6.0x' }
      ]
    }));
    return;
  }

  // Static File Serving
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  } else if (safePath === '/portal' || safePath === '/portal/') {
    safePath = '/portal.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AI Accounting Funnel Engine running at http://0.0.0.0:${PORT}`);
  });
}

module.exports = server;
