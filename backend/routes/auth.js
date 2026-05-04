// ============================================================
// REVELIO — Auth Routes (routes/auth.js)
// POST /api/auth/login  POST /api/auth/register
// ============================================================
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'revelio_secret_2024';

async function logActivity(db, userId, action, detail, ip) {
  try {
    await db.prepare('INSERT INTO activity_log (user_id, action, detail, ip) VALUES (?, ?, ?, ?)')
      .run(userId || null, action, detail || null, ip || null);
  } catch (e) { /* ignore if table not ready */ }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  const user = await req.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  const hasWelcome = await req.db.prepare(
    "SELECT id FROM notifications WHERE user_id = ? AND type = 'system' AND content LIKE ? LIMIT 1"
  ).get(user.id, 'Bienvenue sur Revelio%');
  if (!hasWelcome) {
    await req.db.prepare(
      'INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)'
    ).run(user.id, 'system', 'Bienvenue sur Revelio ! Explorez votre première lecture.', 0);
  }

  await logActivity(req.db, user.id, 'login', `User logged in: ${email}`, req.ip);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url, streak_days: user.streak_days, total_hours: user.total_hours } });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  const exists = await req.db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const result = await req.db.prepare(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
  ).run(name, email, hash);

  await req.db.prepare(
    'INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)'
  ).run(result.lastInsertRowid, 'system', 'Bienvenue sur Revelio ! Explorez votre première lecture.', 0);

  await logActivity(req.db, result.lastInsertRowid, 'register', `New user registered: ${email}`, req.ip);
  const token = jwt.sign({ id: result.lastInsertRowid, email, role: 'user' }, SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: result.lastInsertRowid, name, email, role: 'user', avatar_url: null, streak_days: 0, total_hours: 0 } });
});

module.exports = router;
