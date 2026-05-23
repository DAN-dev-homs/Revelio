// ============================================================
// REVELIO — Express Server (server.js)
// ============================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const { initDB } = require('./database');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
const { resolveFrontendDir, securityHeaders, cacheStaticAssets } = require('./middleware/performance');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = resolveFrontendDir();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : true;

async function start() {
  const db = await initDB();

  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(compression());
  app.use(cors({
    origin: corsOrigins === true ? '*' : corsOrigins,
    credentials: corsOrigins !== true
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cacheStaticAssets);

  app.use(express.static(FRONTEND_DIR));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use((req, _res, next) => { req.db = db; next(); });

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), db: db.type });
  });

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/books', require('./routes/books'));
  app.use('/api/community', require('./routes/community'));
  app.use('/api/profile', require('./routes/profile'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/about', require('./routes/about'));

  app.use('/s', require('./routes/share'));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });

  app.use((err, _req, res, _next) => {
    console.error('[ERROR]', err.message || err);
    if (res.headersSent) return;
    const message = err.message || 'Internal Server Error';
    const status = err.status || err.http_code || 500;
    res.status(status).json({ error: message });
  });

  const server = app.listen(PORT, () => {
    console.log(`🚀 Revelio API running at http://localhost:${PORT}`);
    console.log(`📁 Frontend: ${FRONTEND_DIR}`);
    console.log(`🗄️  Database: ${db.type}`);
  });

  server.timeout = 15 * 60 * 1000;
  server.requestTimeout = 15 * 60 * 1000;
  server.headersTimeout = 16 * 60 * 1000;
}

start().catch(err => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
