// ============================================================
// REVELIO — Admin Routes (routes/admin.js)
// ============================================================
const router = require('express').Router();
const { auth, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// ── Helper : log d'activité ──────────────────────────────
function logActivity(db, userId, action, detail, ip) {
  try {
    db.prepare('INSERT INTO activity_log (user_id, action, detail, ip) VALUES (?, ?, ?, ?)')
      .run(userId || null, action, detail || null, ip || null);
  } catch (e) { /* silently ignore */ }
}

// ── Dossier pour les médias des livres ───────────────────
const MEDIA_DIR = path.join(__dirname, '..', 'uploads', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `book-${Date.now()}-${Math.round(Math.random()*1000)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// Protéger toutes les routes admin
router.use(auth);
router.use(isAdmin);

// ═══════════════════════════════════════════════════════
// ── MONITORING / STATS ──────────────────────────────────
// ═══════════════════════════════════════════════════════

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const db = req.db;

  const totalUsers      = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalAdmins     = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get().c;
  const newUsersMonth   = db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now', '-30 days')").get().c;
  const totalBooks      = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
  const booksWithVideo  = db.prepare('SELECT COUNT(*) as c FROM books WHERE video_url IS NOT NULL').get().c;
  const booksWithAudio  = db.prepare('SELECT COUNT(*) as c FROM books WHERE audio_url IS NOT NULL').get().c;
  const totalPosts      = db.prepare('SELECT COUNT(*) as c FROM posts').get().c;
  const totalComments   = db.prepare('SELECT COUNT(*) as c FROM comments').get().c;
  const totalLikes      = db.prepare('SELECT SUM(likes_count) as s FROM posts').get().s || 0;
  const totalSaved      = db.prepare('SELECT COUNT(*) as c FROM saved_books').get().c;

  const recentActivity  = db.prepare(`
    SELECT al.*, u.name as user_name, u.email as user_email
    FROM activity_log al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC LIMIT 20
  `).all();

  const recentUsers = db.prepare(`
    SELECT id, name, email, role, created_at FROM users
    ORDER BY created_at DESC LIMIT 5
  `).all();

  res.json({
    users: { total: totalUsers, admins: totalAdmins, regular: totalUsers - totalAdmins, newThisMonth: newUsersMonth },
    books: { total: totalBooks, withVideo: booksWithVideo, withAudio: booksWithAudio },
    engagement: { posts: totalPosts, comments: totalComments, likes: totalLikes, savedBooks: totalSaved },
    recentActivity,
    recentUsers
  });
});

// ═══════════════════════════════════════════════════════
// ── GESTION DES LIVRES ──────────────────────────────────
// ═══════════════════════════════════════════════════════

router.get('/books', (req, res) => {
  const books = req.db.prepare('SELECT * FROM books ORDER BY created_at DESC').all();
  res.json(books);
});

const cpUpload = upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]);

router.post('/books', cpUpload, (req, res) => {
  const { title, author, cover_color, category, duration_min, level, summary, key_points, amazon_url, tags } = req.body;
  if (!title || !author || !category || !duration_min || !level)
    return res.status(400).json({ error: 'Missing required fields' });

  const cover_url = req.files?.['cover'] ? `/uploads/media/${req.files['cover'][0].filename}` : null;
  const video_url = req.files?.['video'] ? `/uploads/media/${req.files['video'][0].filename}` : null;
  const audio_url = req.files?.['audio'] ? `/uploads/media/${req.files['audio'][0].filename}` : null;

  const result = req.db.prepare(`
    INSERT INTO books (title, author, cover_color, cover_url, category, duration_min, level, video_url, audio_url, summary, key_points, amazon_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, author, cover_color || '#4CAF93', cover_url, category, parseInt(duration_min), level, video_url, audio_url, summary || null, key_points || null, amazon_url || null);

  const bookId = result.lastInsertRowid;

  if (tags) {
    try {
      const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      const insTag = req.db.prepare('INSERT INTO book_tags (book_id, type, name) VALUES (?, ?, ?)');
      parsedTags.forEach(t => insTag.run(bookId, t.type || 'theme', t.name));
    } catch (e) { console.error('Tag parse error', e); }
  }

  const users = req.db.prepare('SELECT id FROM users').all();
  const insertNotif = req.db.prepare(
    'INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)'
  );
  users.forEach(u => {
    insertNotif.run(u.id, 'system', `Nouveau livre disponible : "${title}"`, 0);
  });

  logActivity(req.db, req.user.id, 'create_book', `Created book: "${title}"`, req.ip);
  res.status(201).json(req.db.prepare('SELECT * FROM books WHERE id = ?').get(bookId));
});

router.get('/books/:id', (req, res) => {
  const book = req.db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const tags = req.db.prepare('SELECT type, name FROM book_tags WHERE book_id = ?').all(book.id);
  res.json({ ...book, tags });
});

router.put('/books/:id', cpUpload, (req, res) => {
  const bookId = parseInt(req.params.id);
  const existingBook = req.db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!existingBook) return res.status(404).json({ error: 'Book not found' });

  const { title, author, cover_color, category, duration_min, level, summary, key_points, amazon_url, tags } = req.body;
  
  const cover_url = req.files?.['cover'] ? `/uploads/media/${req.files['cover'][0].filename}` : existingBook.cover_url;
  const video_url = req.files?.['video'] ? `/uploads/media/${req.files['video'][0].filename}` : existingBook.video_url;
  const audio_url = req.files?.['audio'] ? `/uploads/media/${req.files['audio'][0].filename}` : existingBook.audio_url;

  req.db.prepare(`
    UPDATE books 
    SET title = ?, author = ?, cover_color = ?, cover_url = ?, category = ?, duration_min = ?, level = ?, video_url = ?, audio_url = ?, summary = ?, key_points = ?, amazon_url = ?
    WHERE id = ?
  `).run(
    title || existingBook.title, 
    author || existingBook.author, 
    cover_color || existingBook.cover_color, 
    cover_url, 
    category || existingBook.category, 
    duration_min ? parseInt(duration_min) : existingBook.duration_min, 
    level || existingBook.level, 
    video_url, 
    audio_url, 
    summary !== undefined ? summary : existingBook.summary, 
    key_points !== undefined ? key_points : existingBook.key_points, 
    amazon_url !== undefined ? amazon_url : existingBook.amazon_url, 
    bookId
  );

  if (tags) {
    try {
      const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      req.db.prepare('DELETE FROM book_tags WHERE book_id = ?').run(bookId);
      const insTag = req.db.prepare('INSERT INTO book_tags (book_id, type, name) VALUES (?, ?, ?)');
      parsedTags.forEach(t => insTag.run(bookId, t.type || 'theme', t.name));
    } catch (e) { console.error('Tag parse error', e); }
  }

  logActivity(req.db, req.user.id, 'update_book', `Updated book: "${title || existingBook.title}"`, req.ip);
  res.json(req.db.prepare('SELECT * FROM books WHERE id = ?').get(bookId));
});

router.delete('/books/:id', (req, res) => {
  const book = req.db.prepare('SELECT title FROM books WHERE id = ?').get(req.params.id);
  req.db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  logActivity(req.db, req.user.id, 'delete_book', `Deleted book: "${book?.title}"`, req.ip);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════
// ── GESTION DES CATEGORIES ──────────────────────────────
// ═══════════════════════════════════════════════════════

router.get('/categories', (req, res) => {
  const categories = req.db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(categories);
});

router.post('/categories', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  
  try {
    const result = req.db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
    logActivity(req.db, req.user.id, 'create_category', `Created category: "${name}"`, req.ip);
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// ═══════════════════════════════════════════════════════
// ── GESTION DES UTILISATEURS ────────────────────────────
// ═══════════════════════════════════════════════════════

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = req.db.prepare(`
    SELECT id, name, email, role, avatar_url, streak_days, total_hours, created_at 
    FROM users ORDER BY created_at DESC
  `).all();
  res.json(users);
});

// POST /api/admin/users — Créer un compte (admin ou user)
router.post('/users', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });

  const exists = req.db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const assignedRole = role === 'admin' ? 'admin' : 'user';
  const result = req.db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, hash, assignedRole);

  req.db.prepare(
    'INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)'
  ).run(result.lastInsertRowid, 'system', 'Bienvenue sur Revelio ! Explorez votre première lecture.', 0);

  logActivity(req.db, req.user.id, 'create_user', `Created ${assignedRole} account for: ${email}`, req.ip);
  res.status(201).json({ success: true, id: result.lastInsertRowid });
});

// PATCH /api/admin/users/:id — Modifier un utilisateur
router.patch('/users/:id', (req, res) => {
  const { name, email, role } = req.body;
  const userId = parseInt(req.params.id);

  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updName  = name  || user.name;
  const updEmail = email || user.email;
  const updRole  = (role === 'admin' || role === 'user') ? role : user.role;

  // Empêcher de se rétrograder soi-même
  if (userId === req.user.id && updRole !== 'admin') {
    return res.status(400).json({ error: 'You cannot demote yourself' });
  }

  req.db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?')
    .run(updName, updEmail, updRole, userId);

  logActivity(req.db, req.user.id, 'update_user', `Updated user ${user.email}: role=${updRole}`, req.ip);
  res.json({ success: true, user: req.db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(userId) });
});

// POST /api/admin/users/:id/reset-password — Réinitialiser le MDP
router.post('/users/:id/reset-password', (req, res) => {
  const userId = parseInt(req.params.id);
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Générer un mot de passe temporaire
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let tempPassword = 'Rev-';
  for (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

  const hash = bcrypt.hashSync(tempPassword, 10);
  req.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);

  logActivity(req.db, req.user.id, 'reset_password', `Reset password for user: ${user.email}`, req.ip);
  res.json({ success: true, tempPassword, message: `Mot de passe temporaire pour ${user.email}` });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete yourself' });

  const user = req.db.prepare('SELECT email FROM users WHERE id = ?').get(req.params.id);
  req.db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  logActivity(req.db, req.user.id, 'delete_user', `Deleted user: ${user?.email}`, req.ip);
  res.json({ success: true });
});

module.exports = router;
