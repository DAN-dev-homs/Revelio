// ============================================================
// REVELIO — Admin Routes (routes/admin.js)
// ============================================================
const router = require('express').Router();
const { auth, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { uploadToCloudinary } = require('../config/cloudinary');

// ── Helper : log d'activité ──────────────────────────────
async function logActivity(db, userId, action, detail, ip) {
  try {
    await db.prepare('INSERT INTO activity_log (user_id, action, detail, ip) VALUES (?, ?, ?, ?)')
      .run(userId || null, action, detail || null, ip || null);
  } catch (e) { /* silently ignore */ }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function cleanupUploadedFiles(files) {
  if (!files) return;
  Object.values(files).flat().forEach((file) => {
    if (file?.path) {
      fs.unlink(file.path, (err) => {
        if (err) console.error('Error deleting local upload:', err);
      });
    }
  });
}

async function uploadBookFiles(files, existingBook = {}) {
  const urls = {
    cover_url: existingBook.cover_url || null,
    video_url: existingBook.video_url || null,
    audio_url: existingBook.audio_url || null
  };

  if (files?.['cover']) {
    urls.cover_url = await uploadToCloudinary(files['cover'][0].path, 'revelio/books/covers');
  }
  if (files?.['video']) {
    urls.video_url = await uploadToCloudinary(files['video'][0].path, 'revelio/books/videos');
  }
  if (files?.['audio']) {
    urls.audio_url = await uploadToCloudinary(files['audio'][0].path, 'revelio/books/audio');
  }

  return urls;
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
const upload = multer({ 
  storage, 
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedMediaTypes = ['image/', 'video/', 'audio/'];

    if (allowedMediaTypes.some(type => file.mimetype.startsWith(type))) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image, video ou audio sont autorises'), false);
    }
  }
}); // 100MB

// Middleware de gestion d'erreurs pour multer
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop grand (max 100MB)' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}

// Protéger toutes les routes admin
router.use(auth);
router.use(isAdmin);

// ═══════════════════════════════════════════════════════
// ── MONITORING / STATS ──────────────────────────────────
// ═══════════════════════════════════════════════════════

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  const db = req.db;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 19).replace('T', ' ');

  const totalUsers      = (await db.prepare('SELECT COUNT(*) as c FROM users').get()).c;
  const totalAdmins     = (await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get()).c;
  const newUsersMonth   = (await db.prepare('SELECT COUNT(*) as c FROM users WHERE created_at >= ?').get(thirtyDaysAgo)).c;
  const totalBooks      = (await db.prepare('SELECT COUNT(*) as c FROM books').get()).c;
  const booksWithVideo  = (await db.prepare('SELECT COUNT(*) as c FROM books WHERE video_url IS NOT NULL').get()).c;

  // Meilleurs lecteurs de la semaine (7 derniers jours)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 19).replace('T', ' ');

  const topReadersWeek = await db.prepare(`
    SELECT u.id, u.name, u.avatar_url, u.badge,
           COUNT(DISTINCT rs.book_id) as books_read,
           SUM(rs.progress_pct) as total_progress
    FROM users u
    LEFT JOIN reading_sessions rs ON u.id = rs.user_id AND rs.updated_at >= ?
    WHERE u.role = 'user'
    GROUP BY u.id
    ORDER BY books_read DESC, total_progress DESC
    LIMIT 10
  `).all(weekAgo);

  // Meilleurs lecteurs du mois (30 derniers jours)
  const topReadersMonth = await db.prepare(`
    SELECT u.id, u.name, u.avatar_url, u.badge,
           COUNT(DISTINCT rs.book_id) as books_read,
           SUM(rs.progress_pct) as total_progress
    FROM users u
    LEFT JOIN reading_sessions rs ON u.id = rs.user_id AND rs.updated_at >= ?
    WHERE u.role = 'user'
    GROUP BY u.id
    ORDER BY books_read DESC, total_progress DESC
    LIMIT 10
  `).all(thirtyDaysAgo);
  const booksWithAudio  = (await db.prepare('SELECT COUNT(*) as c FROM books WHERE audio_url IS NOT NULL').get()).c;
  const totalPosts      = (await db.prepare('SELECT COUNT(*) as c FROM posts').get()).c;
  const totalComments   = (await db.prepare('SELECT COUNT(*) as c FROM comments').get()).c;
  const totalLikes      = (await db.prepare('SELECT SUM(likes_count) as s FROM posts').get()).s || 0;
  const totalSaved      = (await db.prepare('SELECT COUNT(*) as c FROM saved_books').get()).c;

  const recentActivity  = await db.prepare(`
    SELECT al.*, u.name as user_name, u.email as user_email
    FROM activity_log al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC LIMIT 20
  `).all();

  const recentUsers = await db.prepare(`
    SELECT id, name, email, role, created_at FROM users
    ORDER BY created_at DESC LIMIT 5
  `).all();

  // Livres les plus lus (basé sur reading_sessions)
  let mostReadBooks = [];
  try {
    mostReadBooks = await db.prepare(`
      SELECT b.id, b.title, b.author, b.cover_color, b.cover_url,
             COUNT(DISTINCT rs.user_id) as readers_count
      FROM books b
      LEFT JOIN reading_sessions rs ON b.id = rs.book_id
      GROUP BY b.id, b.title, b.author, b.cover_color, b.cover_url
      ORDER BY readers_count DESC
      LIMIT 10
    `).all();
  } catch (e) {
    console.error('Error fetching most read books:', e);
    mostReadBooks = [];
  }

  // Livres les plus sauvegardés
  let mostSavedBooks = [];
  try {
    mostSavedBooks = await db.prepare(`
      SELECT b.id, b.title, b.author, b.cover_color, b.cover_url,
             COUNT(DISTINCT sb.user_id) as saves_count
      FROM books b
      LEFT JOIN saved_books sb ON b.id = sb.book_id
      GROUP BY b.id, b.title, b.author, b.cover_color, b.cover_url
      ORDER BY saves_count DESC
      LIMIT 10
    `).all();
  } catch (e) {
    console.error('Error fetching most saved books:', e);
    mostSavedBooks = [];
  }

  // Livres les plus likés (basé sur les posts qui mentionnent des livres)
  let mostLikedBooks = [];
  try {
    mostLikedBooks = await db.prepare(`
      SELECT b.id, b.title, b.author, b.cover_color, b.cover_url,
             COALESCE(SUM(p.likes_count), 0) as total_likes
      FROM books b
      LEFT JOIN posts p ON p.book_id = b.id
      GROUP BY b.id, b.title, b.author, b.cover_color, b.cover_url
      ORDER BY total_likes DESC
      LIMIT 10
    `).all();
  } catch (e) {
    console.error('Error fetching most liked books:', e);
    mostLikedBooks = [];
  }

  res.json({
    users: { total: totalUsers, admins: totalAdmins, regular: totalUsers - totalAdmins, newThisMonth: newUsersMonth },
    books: { total: totalBooks, withVideo: booksWithVideo, withAudio: booksWithAudio },
    engagement: { posts: totalPosts, comments: totalComments, likes: totalLikes, savedBooks: totalSaved },
    recentActivity,
    recentUsers,
    topReaders: {
      week: topReadersWeek,
      month: topReadersMonth
    },
    topBooks: {
      mostRead: mostReadBooks,
      mostSaved: mostSavedBooks,
      mostLiked: mostLikedBooks
    }
  });
});

// ═══════════════════════════════════════════════════════
// ── GESTION DES LIVRES ──────────────────────────────────
// ═══════════════════════════════════════════════════════

router.get('/books', async (req, res) => {
  const books = await req.db.prepare('SELECT * FROM books ORDER BY created_at DESC').all();
  res.json(books);
});

const cpUpload = upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]);

router.post('/books', cpUpload, handleUploadError, asyncHandler(async (req, res) => {
  const { title, author, cover_color, category, duration_min, level, summary, key_points, amazon_url, tags } = req.body;
  if (!title || !author || !category || !duration_min || !level)
    return res.status(400).json({ error: 'Missing required fields' });

  let uploadedUrls;
  try {
    uploadedUrls = await uploadBookFiles(req.files);
  } finally {
    cleanupUploadedFiles(req.files);
  }

  const { cover_url, video_url, audio_url } = uploadedUrls;
  console.log('Cloudinary book upload - cover:', cover_url, 'video:', video_url, 'audio:', audio_url);

  const result = await req.db.prepare(`
    INSERT INTO books (title, author, cover_color, cover_url, category, duration_min, level, video_url, audio_url, summary, key_points, amazon_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, author, cover_color || '#4CAF93', cover_url, category, parseInt(duration_min), level, video_url, audio_url, summary || null, key_points || null, amazon_url || null);

  const bookId = result.lastInsertRowid;

  if (tags) {
    try {
      const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      const insTag = req.db.prepare('INSERT INTO book_tags (book_id, type, name) VALUES (?, ?, ?)');
      for (const t of parsedTags) {
        await insTag.run(bookId, t.type || 'theme', t.name);
      }
    } catch (e) { console.error('Tag parse error', e); }
  }

  const users = await req.db.prepare('SELECT id FROM users').all();
  const insertNotif = req.db.prepare(
    'INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)'
  );
  for (const u of users) {
    await insertNotif.run(u.id, 'system', `Nouveau livre disponible : "${title}"`, 0);
  }

  await logActivity(req.db, req.user.id, 'create_book', `Created book: "${title}"`, req.ip);
  const createdBook = await req.db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  res.status(201).json(createdBook);
}));

router.get('/books/:id', async (req, res) => {
  const book = await req.db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const tags = await req.db.prepare('SELECT type, name FROM book_tags WHERE book_id = ?').all(book.id);
  res.json({ ...book, tags });
});

router.put('/books/:id', cpUpload, handleUploadError, asyncHandler(async (req, res) => {
  const bookId = parseInt(req.params.id);
  const existingBook = await req.db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!existingBook) return res.status(404).json({ error: 'Book not found' });

  const { title, author, cover_color, category, duration_min, level, summary, key_points, amazon_url, tags } = req.body;
  
  let uploadedUrls;
  try {
    uploadedUrls = await uploadBookFiles(req.files, existingBook);
  } finally {
    cleanupUploadedFiles(req.files);
  }

  const { cover_url, video_url, audio_url } = uploadedUrls;
  console.log('Cloudinary book update - cover:', cover_url, 'video:', video_url, 'audio:', audio_url);

  await req.db.prepare(`
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
      await req.db.prepare('DELETE FROM book_tags WHERE book_id = ?').run(bookId);
      const insTag = req.db.prepare('INSERT INTO book_tags (book_id, type, name) VALUES (?, ?, ?)');
      for (const t of parsedTags) {
        await insTag.run(bookId, t.type || 'theme', t.name);
      }
    } catch (e) { console.error('Tag parse error', e); }
  }

  await logActivity(req.db, req.user.id, 'update_book', `Updated book: "${title || existingBook.title}"`, req.ip);
  const updatedBook = await req.db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  res.json(updatedBook);
}));

router.delete('/books/:id', async (req, res) => {
  const book = await req.db.prepare('SELECT title FROM books WHERE id = ?').get(req.params.id);
  await req.db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  await logActivity(req.db, req.user.id, 'delete_book', `Deleted book: "${book?.title}"`, req.ip);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════
// ── GESTION DES CATEGORIES ──────────────────────────────
// ═══════════════════════════════════════════════════════

router.get('/categories', async (req, res) => {
  const categories = await req.db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(categories);
});

router.post('/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const result = await req.db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
    await logActivity(req.db, req.user.id, 'create_category', `Created category: "${name}"`, req.ip);
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed') || err.code === '23505') {
      return res.status(409).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// ═══════════════════════════════════════════════════════
// ── GESTION DES UTILISATEURS ────────────────────────────
// ═══════════════════════════════════════════════════════

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const users = await req.db.prepare(`
    SELECT id, name, email, role, avatar_url, streak_days, total_hours, created_at, church 
    FROM users ORDER BY created_at DESC
  `).all();
  res.json(users);
});

// GET /api/admin/users/search — Rechercher des utilisateurs
router.get('/users/search', async (req, res) => {
  try {
    const { q } = req.query;
    const searchTerm = `%${q.trim().toLowerCase()}%`;
    
    const users = await req.db.prepare(`
      SELECT id, name, email, role, avatar_url, streak_days, total_hours, created_at, church 
      FROM users 
      WHERE (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(church) LIKE ?)
      ORDER BY created_at DESC
      LIMIT 100
    `).all(searchTerm, searchTerm, searchTerm);
    
    res.json(users);
  } catch (e) {
    console.error('Search admin users error:', e);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// POST /api/admin/users — Créer un compte (admin ou user)
router.post('/users', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });

  const exists = await req.db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const assignedRole = role === 'admin' ? 'admin' : 'user';
  const result = await req.db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, hash, assignedRole);

  await req.db.prepare(
    'INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)'
  ).run(result.lastInsertRowid, 'system', 'Bienvenue sur Revelio ! Explorez votre première lecture.', 0);

  await logActivity(req.db, req.user.id, 'create_user', `Created ${assignedRole} account for: ${email}`, req.ip);
  res.status(201).json({ success: true, id: result.lastInsertRowid });
});

// PATCH /api/admin/users/:id — Modifier un utilisateur
router.patch('/users/:id', async (req, res) => {
  const { name, email, role } = req.body;
  const userId = parseInt(req.params.id);

  const user = await req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updName  = name  || user.name;
  const updEmail = email || user.email;
  const updRole  = (role === 'admin' || role === 'user') ? role : user.role;

  // Empêcher de se rétrograder soi-même
  if (userId === req.user.id && updRole !== 'admin') {
    return res.status(400).json({ error: 'You cannot demote yourself' });
  }

  await req.db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?')
    .run(updName, updEmail, updRole, userId);

  await logActivity(req.db, req.user.id, 'update_user', `Updated user ${user.email}: role=${updRole}`, req.ip);
  const updatedUser = await req.db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(userId);
  res.json({ success: true, user: updatedUser });
});

// POST /api/admin/users/:id/reset-password — Réinitialiser le MDP
router.post('/users/:id/reset-password', async (req, res) => {
  const userId = parseInt(req.params.id);
  const user = await req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Générer un mot de passe temporaire
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let tempPassword = 'Rev-';
  for (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

  const hash = bcrypt.hashSync(tempPassword, 10);
  await req.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);

  await logActivity(req.db, req.user.id, 'reset_password', `Reset password for user: ${user.email}`, req.ip);
  res.json({ success: true, tempPassword, message: `Mot de passe temporaire pour ${user.email}` });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete yourself' });

  const user = await req.db.prepare('SELECT email FROM users WHERE id = ?').get(req.params.id);
  await req.db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  await logActivity(req.db, req.user.id, 'delete_user', `Deleted user: ${user?.email}`, req.ip);
  res.json({ success: true });
});

// POST /api/admin/users/:id/badge — Accorder manuellement un badge
router.post('/users/:id/badge', async (req, res) => {
  const { badge } = req.body;
  const userId = parseInt(req.params.id);

  if (!badge) return res.status(400).json({ error: 'Badge is required' });

  const validBadges = ['none', 'bronze', 'silver', 'gold', 'diamond'];
  if (!validBadges.includes(badge)) {
    return res.status(400).json({ error: 'Invalid badge. Must be: none, bronze, silver, gold, or diamond' });
  }

  const user = await req.db.prepare('SELECT name, email, badge as current_badge FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Convertir 'none' en null pour la base de données
  const badgeValue = badge === 'none' ? null : badge;
  await req.db.prepare('UPDATE users SET badge = ? WHERE id = ?').run(badgeValue, userId);

  await logActivity(req.db, req.user.id, 'grant_badge', `Granted ${badge} badge to user: ${user.email}`, req.ip);

  res.json({
    success: true,
    message: `Badge ${badge} accordé à ${user.name}`,
    user: { id: userId, name: user.name, email: user.email, badge: badge }
  });
});

// POST /api/admin/recalculate-badges — Recalculer tous les badges automatiquement
router.post('/recalculate-badges', async (req, res) => {
  try {
    const users = await req.db.prepare('SELECT id FROM users').all();
    let updatedCount = 0;

    for (const user of users) {
      // Compter les livres terminés pour cet utilisateur
      const booksCompleted = (await req.db.prepare(`
        SELECT COUNT(*) as c
        FROM (
          SELECT book_id, MAX(progress_pct) as max_progress
          FROM reading_sessions
          WHERE user_id = ?
          GROUP BY book_id
          HAVING MAX(progress_pct) = 100
        ) AS completed_books
      `).get(user.id)).c;

      let newBadge = null; // Par défaut, aucun badge
      if (booksCompleted >= 200) {
        newBadge = 'diamond';
      } else if (booksCompleted >= 100) {
        newBadge = 'gold';
      } else if (booksCompleted >= 30) {
        newBadge = 'silver';
      }
      // Si <30 livres, newBadge reste null (aucun badge)

      // Mettre à jour le badge seulement si l'utilisateur n'a pas de badge manuel
      const currentUser = await req.db.prepare('SELECT badge FROM users WHERE id = ?').get(user.id);
      if (currentUser && (!currentUser.badge || currentUser.badge === 'bronze')) {
        await req.db.prepare('UPDATE users SET badge = ? WHERE id = ?').run(newBadge, user.id);
        updatedCount++;
      }
    }

    res.json({ success: true, updatedCount });
  } catch (e) {
    console.error('Error recalculating badges:', e);
    res.status(500).json({ error: 'Failed to recalculate badges' });
  }
});

// GET /api/admin/posts — Lister tous les posts avec infos auteurs
router.get('/posts', async (req, res) => {
  try {
    const posts = await req.db.prepare(`
      SELECT 
        p.id,
        p.content,
        p.type,
        p.likes_count,
        p.created_at,
        u.name as author_name,
        u.email as author_email
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `).all();
    
    res.json(posts);
  } catch (e) {
    console.error('Get admin posts error:', e);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// GET /api/admin/posts/search — Rechercher des posts
router.get('/posts/search', async (req, res) => {
  try {
    const { q } = req.query;
    const searchTerm = `%${q.trim().toLowerCase()}%`;
    
    const posts = await req.db.prepare(`
      SELECT 
        p.id,
        p.content,
        p.type,
        p.likes_count,
        p.created_at,
        u.name as author_name,
        u.email as author_email
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE (LOWER(p.content) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)
      ORDER BY p.created_at DESC
      LIMIT 100
    `).all(searchTerm, searchTerm, searchTerm);
    
    res.json(posts);
  } catch (e) {
    console.error('Search admin posts error:', e);
    res.status(500).json({ error: 'Failed to search posts' });
  }
});

// DELETE /api/admin/posts/:id — Supprimer un post
router.delete('/posts/:id', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    
    // Récupérer les infos du post pour le log
    const post = await req.db.prepare(`
      SELECT p.content, u.name as author_name, u.email as author_email
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Supprimer le post
    await req.db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
    
    // Logger l'action
    await logActivity(req.db, req.user.id, 'delete_post', 
      `Deleted post by ${post.author_email}: "${post.content.substring(0, 50)}..."`, 
      req.ip
    );
    
    res.json({ success: true, message: 'Post supprimé avec succès' });
  } catch (e) {
    console.error('Delete admin post error:', e);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ═══════════════════════════════════════════════════════
// ── GESTION DE L'ÉQUIPE ────────────────────────────────
// ═══════════════════════════════════════════════════════

router.get('/team', isAdmin, async (req, res) => {
  try {
    const team = await req.db.prepare('SELECT * FROM team_members ORDER BY order_index ASC').all();
    res.json(team);
  } catch (e) {
    console.error('Error fetching team:', e);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.post('/team', isAdmin, upload.single('photo'), handleUploadError, async (req, res) => {
  try {
    const { name, role, bio, linkedin, twitter, order_index } = req.body;
    
    // Upload to Cloudinary if file exists
    let photo_url = null;
    if (req.file) {
      photo_url = await uploadToCloudinary(req.file.path, 'revelio/team');
      // Delete local file after upload
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting local file:', err);
      });
    }
    
    console.log('☁️ Cloudinary team upload - URL:', photo_url);
    
    await req.db.prepare(
      'INSERT INTO team_members (name, role, photo_url, bio, linkedin, twitter, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(name, role, photo_url, bio, linkedin, twitter, order_index || 0);
    
    await logActivity(req.db, req.user.id, 'create_team_member', `Added team member: ${name}`, req.ip);
    
    res.json({ success: true, photo_url });
  } catch (e) {
    console.error('Error adding team member:', e);
    res.status(500).json({ error: 'Failed to add team member: ' + e.message });
  }
});

router.put('/team/:id', isAdmin, upload.single('photo'), handleUploadError, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, role, bio, linkedin, twitter, order_index } = req.body;
    
    // Upload to Cloudinary if new file exists
    let photo_url = req.body.existing_photo;
    if (req.file) {
      photo_url = await uploadToCloudinary(req.file.path, 'revelio/team');
      // Delete local file after upload
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting local file:', err);
      });
    }
    
    console.log('☁️ Cloudinary team update - URL:', photo_url);
    
    await req.db.prepare(
      'UPDATE team_members SET name = ?, role = ?, photo_url = ?, bio = ?, linkedin = ?, twitter = ?, order_index = ? WHERE id = ?'
    ).run(name, role, photo_url, bio, linkedin, twitter, order_index || 0, id);
    
    await logActivity(req.db, req.user.id, 'update_team_member', `Updated team member: ${name}`, req.ip);
    
    res.json({ success: true, photo_url });
  } catch (e) {
    console.error('Error updating team member:', e);
    res.status(500).json({ error: 'Failed to update team member: ' + e.message });
  }
});

router.delete('/team/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await req.db.prepare('DELETE FROM team_members WHERE id = ?').run(id);
    
    await logActivity(req.db, req.user.id, 'delete_team_member', `Deleted team member ID: ${id}`, req.ip);
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting team member:', e);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});

// ═══════════════════════════════════════════════════════
// ── GESTION DES PARTENAIRES ────────────────────────────
// ═══════════════════════════════════════════════════════

router.get('/partners', isAdmin, async (req, res) => {
  try {
    const partners = await req.db.prepare('SELECT * FROM partners ORDER BY order_index ASC').all();
    res.json(partners);
  } catch (e) {
    console.error('Error fetching partners:', e);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

router.post('/partners', isAdmin, upload.single('logo'), handleUploadError, async (req, res) => {
  try {
    const { name, website_url, description, order_index } = req.body;
    
    // Upload to Cloudinary if file exists
    let logo_url = null;
    if (req.file) {
      logo_url = await uploadToCloudinary(req.file.path, 'revelio/partners');
      // Delete local file after upload
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting local file:', err);
      });
    }
    
    console.log('☁️ Cloudinary partner upload - URL:', logo_url);
    
    await req.db.prepare(
      'INSERT INTO partners (name, logo_url, website_url, description, order_index) VALUES (?, ?, ?, ?, ?)'
    ).run(name, logo_url, website_url, description, order_index || 0);
    
    await logActivity(req.db, req.user.id, 'create_partner', `Added partner: ${name}`, req.ip);
    
    res.json({ success: true, logo_url });
  } catch (e) {
    console.error('Error adding partner:', e);
    res.status(500).json({ error: 'Failed to add partner: ' + e.message });
  }
});

router.put('/partners/:id', isAdmin, upload.single('logo'), handleUploadError, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, website_url, description, order_index } = req.body;
    
    // Upload to Cloudinary if new file exists
    let logo_url = req.body.existing_logo;
    if (req.file) {
      logo_url = await uploadToCloudinary(req.file.path, 'revelio/partners');
      // Delete local file after upload
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting local file:', err);
      });
    }
    
    console.log('☁️ Cloudinary partner update - URL:', logo_url);
    
    await req.db.prepare(
      'UPDATE partners SET name = ?, logo_url = ?, website_url = ?, description = ?, order_index = ? WHERE id = ?'
    ).run(name, logo_url, website_url, description, order_index || 0, id);
    
    await logActivity(req.db, req.user.id, 'update_partner', `Updated partner: ${name}`, req.ip);
    
    res.json({ success: true, logo_url });
  } catch (e) {
    console.error('Error updating partner:', e);
    res.status(500).json({ error: 'Failed to update partner: ' + e.message });
  }
});

router.delete('/partners/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await req.db.prepare('DELETE FROM partners WHERE id = ?').run(id);
    
    await logActivity(req.db, req.user.id, 'delete_partner', `Deleted partner ID: ${id}`, req.ip);
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting partner:', e);
    res.status(500).json({ error: 'Failed to delete partner' });
  }
});

// ═══════════════════════════════════════════════════════
// ── MESSAGES DE CONTACT ────────────────────────────────
// ═══════════════════════════════════════════════════════

router.get('/contact-messages', isAdmin, async (req, res) => {
  try {
    const messages = await req.db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
    res.json(messages);
  } catch (e) {
    console.error('Error fetching contact messages:', e);
    res.status(500).json({ error: 'Failed to fetch contact messages' });
  }
});

router.patch('/contact-messages/:id/read', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await req.db.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (e) {
    console.error('Error marking message as read:', e);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

router.delete('/contact-messages/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await req.db.prepare('DELETE FROM contact_messages WHERE id = ?').run(id);
    
    await logActivity(req.db, req.user.id, 'delete_contact_message', `Deleted contact message ID: ${id}`, req.ip);
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting contact message:', e);
    res.status(500).json({ error: 'Failed to delete contact message' });
  }
});

module.exports = router;
