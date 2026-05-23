// Rate limiting en mémoire (stateless-friendly pour petites/moyennes charges)
function createRateLimiter({ windowMs = 60_000, max = 100, message = 'Trop de requêtes, réessayez plus tard.' } = {}) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits.entries()) {
      if (now - bucket.start > windowMs) hits.delete(key);
    }
  }, windowMs).unref?.();

  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl || req.path}`;
    const now = Date.now();
    let bucket = hits.get(key);

    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      hits.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - bucket.start)) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 300 });
const authLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 30, message: 'Trop de tentatives de connexion.' });

module.exports = { createRateLimiter, apiLimiter, authLimiter };
