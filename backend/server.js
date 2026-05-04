// ============================================================
// REVELIO — Express Server (server.js)
// ============================================================
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDB } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

async function start() {
  const db = await initDB();

  // ── Middleware ───────────────────────────────────────────
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // Servir le frontend statique
  app.use(express.static(path.join(__dirname, 'frontend')));

  // Servir les uploads statiquement
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Injecter db dans les requêtes
  app.use((req, _res, next) => { req.db = db; next(); });

  // ── Routes API ───────────────────────────────────────────
  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/books',     require('./routes/books'));
  app.use('/api/community', require('./routes/community'));
  app.use('/api/profile',       require('./routes/profile'));
  app.use('/api/admin',         require('./routes/admin'));
  app.use('/api/notifications', require('./routes/notifications'));

  // ── SPA Fallback ─────────────────────────────────────────
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  });

  // ── Gestion globale des erreurs ──────────────────────────
  app.use((err, _req, res, _next) => {
    console.error('[ERROR]', err.message || err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Revelio API running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
