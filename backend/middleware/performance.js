const fs = require('fs');
const path = require('path');

function resolveFrontendDir() {
  const candidates = [
    path.join(__dirname, '..', 'frontend'),
    path.join(__dirname, '..', '..', 'frontend'),
    path.join(__dirname, 'frontend')
  ];
  return candidates.find(dir => fs.existsSync(path.join(dir, 'index.html'))) || candidates[0];
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

function cacheStaticAssets(req, res, next) {
  if (req.method === 'GET' && /\.(css|js|png|jpg|jpeg|webp|ico|woff2?)$/i.test(req.path)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  }
  next();
}

module.exports = { resolveFrontendDir, securityHeaders, cacheStaticAssets };
