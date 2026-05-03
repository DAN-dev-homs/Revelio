// ============================================================
// REVELIO — Profile Routes (routes/profile.js)
// ============================================================
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET /api/profile/me — profil complet
router.get('/me', auth, (req, res) => {
  const user = req.db.prepare(
    'SELECT id, name, email, streak_days, total_hours, created_at, avatar_url FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const booksCompleted = req.db.prepare(
    'SELECT COUNT(*) as c FROM reading_sessions WHERE user_id = ? AND progress_pct = 100'
  ).get(req.user.id).c;

  res.json({ ...user, books_completed: booksCompleted });
});

// GET /api/profile/saved-books
router.get('/saved-books', auth, (req, res) => {
  const books = req.db.prepare(`
    SELECT b.* FROM saved_books sb
    JOIN books b ON b.id = sb.book_id
    WHERE sb.user_id = ?
    ORDER BY sb.saved_at DESC
  `).all(req.user.id);
  res.json(books);
});

// GET /api/profile/reading — livres en cours
router.get('/reading', auth, (req, res) => {
  const sessions = req.db.prepare(`
    SELECT b.*, rs.progress_pct, rs.updated_at
    FROM reading_sessions rs
    JOIN books b ON b.id = rs.book_id
    WHERE rs.user_id = ? AND rs.progress_pct < 100
    ORDER BY rs.updated_at DESC
  `).all(req.user.id);
  res.json(sessions);
});

// GET /api/profile/posts-history — historique des posts utilisateur
router.get('/posts-history', auth, (req, res) => {
  const posts = req.db.prepare(`
    SELECT p.*, COUNT(c.id) as comments_count
    FROM posts p
    LEFT JOIN comments c ON c.post_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(req.user.id);
  res.json(posts);
});

// PATCH /api/profile/me — mettre à jour le profil
router.patch('/me', auth, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  req.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user.id);
  res.json({ success: true });
});

// PATCH /api/profile/password — changer le mot de passe
router.patch('/password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = req.db.prepare('SELECT id, password FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  req.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

// POST /api/profile/avatar — uploader une photo de profil
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'avatars');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

router.post('/avatar', auth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  req.db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.id);
  
  res.json({ success: true, avatar_url: avatarUrl });
});

module.exports = router;
