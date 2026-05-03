// ============================================================
// REVELIO — Notifications Routes (routes/notifications.js)
// ============================================================
const router = require('express').Router();
const { auth } = require('../middleware/auth');

// GET /api/notifications
router.get('/', auth, (req, res) => {
  const notifications = req.db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(req.user.id);

  const unreadCount = req.db.prepare(`
    SELECT COUNT(*) as c FROM notifications 
    WHERE user_id = ? AND is_read = 0
  `).get(req.user.id).c;

  res.json({ notifications, unreadCount });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', auth, (req, res) => {
  req.db.prepare(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE user_id = ? AND is_read = 0
  `).run(req.user.id);
  
  res.json({ success: true });
});

module.exports = router;
