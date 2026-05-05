// ============================================================
// REVELIO — Profile Routes (routes/profile.js)
// ============================================================
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET /api/profile/me — profil complet
router.get('/me', auth, async (req, res) => {
  try {
    let user;
    try {
      user = await req.db.prepare(
        'SELECT id, name, email, streak_days, total_hours, created_at, avatar_url, badge FROM users WHERE id = ?'
      ).get(req.user.id);
    } catch (e) {
      // Si le champ badge n'existe pas, faire la requête sans lui
      user = await req.db.prepare(
        'SELECT id, name, email, streak_days, total_hours, created_at, avatar_url FROM users WHERE id = ?'
      ).get(req.user.id);
      if (user) user.badge = 'bronze'; // Badge par défaut
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let booksCompleted = 0;
    try {
      booksCompleted = (await req.db.prepare(
        'SELECT COUNT(*) as c FROM reading_sessions WHERE user_id = ? AND progress_pct = 100'
      ).get(req.user.id)).c;
    } catch (e) {
      console.error('Error counting books completed:', e);
      booksCompleted = 0;
    }

    res.json({ 
      ...user, 
      books_completed: booksCompleted,
      // Assurer que tous les champs nécessaires existent
      streak_days: user.streak_days || 0,
      total_hours: user.total_hours || 0,
      badge: user.badge || 'bronze'
    });
  } catch (error) {
    console.error('Profile route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/profile/search?q=query — rechercher des utilisateurs
router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json([]);
  }

  try {
    const searchTerm = `%${q.trim().toLowerCase()}%`;
    const users = await req.db.prepare(`
      SELECT id, name, email, avatar_url, badge, created_at, streak_days, total_hours
      FROM users 
      WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ?
      ORDER BY name ASC
      LIMIT 20
    `).all(searchTerm, searchTerm);

    // Ajouter le nombre de livres complétés pour chaque utilisateur
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const booksCompleted = (await req.db.prepare(
        'SELECT COUNT(*) as c FROM reading_sessions WHERE user_id = ? AND progress_pct = 100'
      ).get(user.id)).c;
      
      return {
        ...user,
        books_completed: booksCompleted
      };
    }));

    res.json(usersWithStats);
  } catch (e) {
    console.error('Search users error:', e);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/profile/:id — profil public d'un utilisateur
router.get('/:id', auth, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    let user;
    try {
      user = await req.db.prepare(
        'SELECT id, name, avatar_url, badge, created_at, streak_days, total_hours FROM users WHERE id = ?'
      ).get(userId);
    } catch (e) {
      // Si le champ badge n'existe pas
      user = await req.db.prepare(
        'SELECT id, name, avatar_url, created_at, streak_days, total_hours FROM users WHERE id = ?'
      ).get(userId);
      if (user) user.badge = 'bronze';
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Statistiques de l'utilisateur
    const booksCompleted = (await req.db.prepare(
      'SELECT COUNT(*) as c FROM reading_sessions WHERE user_id = ? AND progress_pct = 100'
    ).get(userId)).c;

    // Posts récents de l'utilisateur
    const recentPosts = await req.db.prepare(`
      SELECT id, content, type, likes_count, comments_count, created_at
      FROM community_posts 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all(userId);

    res.json({
      ...user,
      books_completed: booksCompleted,
      recent_posts: recentPosts
    });
  } catch (e) {
    console.error('Get user profile error:', e);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// GET /api/profile/saved-books
router.get('/saved-books', auth, async (req, res) => {
  const books = await req.db.prepare(`
    SELECT b.* FROM saved_books sb
    JOIN books b ON b.id = sb.book_id
    WHERE sb.user_id = ?
    ORDER BY sb.saved_at DESC
  `).all(req.user.id);
  res.json(books);
});

// GET /api/profile/reading — livres en cours
router.get('/reading', auth, async (req, res) => {
  const sessions = await req.db.prepare(`
    SELECT b.*, rs.progress_pct, rs.updated_at
    FROM reading_sessions rs
    JOIN books b ON b.id = rs.book_id
    WHERE rs.user_id = ? AND rs.progress_pct < 100
    ORDER BY rs.updated_at DESC
  `).all(req.user.id);
  res.json(sessions);
});

// GET /api/profile/posts-history — historique des posts utilisateur
router.get('/posts-history', auth, async (req, res) => {
  try {
    const posts = await req.db.prepare(`
      SELECT p.*, COUNT(c.id) as comments_count
      FROM posts p
      LEFT JOIN comments c ON c.post_id = p.id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(req.user.id);
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts history:', error);
    res.json([]); // Retourner un tableau vide en cas d'erreur
  }
});

// PATCH /api/profile/me — mettre à jour le profil
router.patch('/me', auth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  await req.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user.id);
  res.json({ success: true });
});

// PATCH /api/profile/password — changer le mot de passe
router.patch('/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = await req.db.prepare('SELECT id, password FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await req.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
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

router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  await req.db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.id);
  
  res.json({ success: true, avatar_url: avatarUrl });
});

module.exports = router;
