// ============================================================
// REVELIO — Notifications Routes (routes/notifications.js)
// ============================================================
const router = require('express').Router();
const { auth } = require('../middleware/auth');

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  const notifications = await req.db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = $1 
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(req.user.id);

  const unreadCount = (await req.db.prepare(`
    SELECT COUNT(*) as c FROM notifications 
    WHERE user_id = $1 AND is_read = 0
  `).get(req.user.id)).c;

  res.json({ notifications, unreadCount });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', auth, async (req, res) => {
  await req.db.prepare(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE user_id = $1 AND is_read = 0
  `).run(req.user.id);
  
  res.json({ success: true });
});

// POST /api/notifications/send - Admin only: send notification to user
router.post('/send', auth, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé: réservé aux administrateurs' });
  }

  const { user_id, type, content } = req.body;

  if (!user_id || !type || !content) {
    return res.status(400).json({ error: 'Champs manquants: user_id, type, content requis' });
  }

  try {
    await req.db.prepare(`
      INSERT INTO notifications (user_id, type, content, is_read)
      VALUES ($1, $2, $3, 0)
    `).run(user_id, type, content);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notifications/broadcast - Admin only: send notification to all users
router.post('/broadcast', auth, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé: réservé aux administrateurs' });
  }

  const { type, content } = req.body;

  if (!type || !content) {
    return res.status(400).json({ error: 'Champs manquants: type, content requis' });
  }

  try {
    // Get all users
    const users = await req.db.prepare('SELECT id FROM users').all();

    // Insert notification for each user
    for (const user of users) {
      await req.db.prepare(`
        INSERT INTO notifications (user_id, type, content, is_read)
        VALUES ($1, $2, $3, 0)
      `).run(user.id, type, content);
    }

    res.json({ success: true, count: users.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
