// ============================================================
// REVELIO — Profile Routes (routes/profile.js)
// ============================================================
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { uploadToCloudinary } = require('../config/cloudinary');

// GET /api/profile/me — profil complet
router.get('/me', auth, async (req, res) => {
  try {
    console.log('👤 Début requête profil pour user:', req.user.id);
    
    let user;
    try {
      console.log('🔍 Requête utilisateur avec badge...');
      user = await req.db.prepare(
        'SELECT id, name, email, streak_days, total_hours, created_at, avatar_url, badge, church FROM users WHERE id = $1'
      ).get(req.user.id);
      console.log('📊 Utilisateur trouvé:', user);
    } catch (e) {
      console.log('❌ Erreur requête avec badge:', e.message);
      console.log('🔄 Tentative requête sans badge...');
      // Si le champ badge n'existe pas, faire la requête sans lui
      try {
        user = await req.db.prepare(
          'SELECT id, name, email, streak_days, total_hours, created_at, avatar_url, church FROM users WHERE id = $1'
        ).get(req.user.id);
        if (user) {
          // Ne pas écraser le badge existant, utiliser null si non trouvé
          user.badge = null;
        }
        console.log('⚠️ Utilisateur sans champ badge, badge laissé à null');
      } catch (e2) {
        console.log('❌ Erreur requête sans badge:', e2.message);
        // Essayer avec les champs minimums
        user = await req.db.prepare(
          'SELECT id, name, email, created_at, church FROM users WHERE id = $1'
        ).get(req.user.id);
        if (user) {
          user.streak_days = 0;
          user.total_hours = 0;
          user.avatar_url = null;
          user.badge = null; // Ne pas écraser avec bronze
        }
        console.log('🔄 Utilisateur avec champs minimums:', user);
      }
    }
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé');
      return res.status(404).json({ error: 'User not found' });
    }

    let booksCompleted = 0;
    try {
      // Compter chaque livre unique terminé une seule fois
      // Utiliser une sous-requête pour éviter de recompter les livres relus
      const booksResult = await req.db.prepare(`
        SELECT COUNT(*) as c
        FROM (
          SELECT book_id, MAX(progress_pct) as max_progress
          FROM reading_sessions
          WHERE user_id = $1
          GROUP BY book_id
          HAVING MAX(progress_pct) = 100
        ) AS completed_books
      `).get(req.user.id);
      booksCompleted = booksResult.c;
      console.log('📚 Livres uniques complétés calculés:', booksCompleted);
    } catch (e) {
      console.error('❌ Erreur comptage livres complétés:', e);
      booksCompleted = 0;
    }

    // Calculer dynamiquement les heures de lecture réelles
    let totalHours = 0;
    try {
      const readingSessions = await req.db.prepare(`
        SELECT updated_at, progress_pct 
        FROM reading_sessions 
        WHERE user_id = $1 AND progress_pct > 0
        ORDER BY updated_at ASC
      `).all(req.user.id);
      
      console.log('📚 Sessions de lecture trouvées:', readingSessions.length);
      
      // Calculer les heures basées sur le temps de lecture réel
      // Chaque session représente environ 1 minute (60 secondes) pour 100% de progression
      // Donc 1% = 0.6 secondes = 0.01 minutes = 0.000167 heures
      for (const session of readingSessions) {
        const hoursFromSession = (session.progress_pct / 100) * (1/60); // 1 minute = 1/60 heures
        totalHours += hoursFromSession;
      }
      
      console.log('⏱️ Heures calculées dynamiquement:', totalHours);
      
      // Mettre à jour la base de données avec les nouvelles valeurs
      await req.db.prepare(`
        UPDATE users 
        SET total_hours = $1
        WHERE id = $2
      `).run(totalHours, req.user.id);
      
      console.log('✅ Base de données mise à jour pour total_hours');
      
    } catch (e) {
      console.error('❌ Erreur calcul heures:', e);
      totalHours = user.total_hours || 0;
    }

    // Calculer le streak actuel (jours consécutifs avec lecture)
    let streakDays = 0;
    try {
      // Récupérer toutes les dates de lecture uniques pour cet utilisateur
      const dbType = req.db.type || 'sqlite';
      
      let dateQuery;
      if (dbType === 'postgres') {
        dateQuery = `SELECT DISTINCT DATE(updated_at) as read_date 
                     FROM reading_sessions 
                     WHERE user_id = $1 AND progress_pct > 0
                     ORDER BY read_date DESC`;
      } else {
        // SQLite - utiliser substr pour extraire la date (YYYY-MM-DD)
        dateQuery = `SELECT DISTINCT substr(updated_at, 1, 10) as read_date 
                     FROM reading_sessions 
                     WHERE user_id = ? AND progress_pct > 0
                     ORDER BY read_date DESC`;
      }
      
      const readDates = await req.db.prepare(dateQuery).all(req.user.id);
      console.log('📅 Dates de lecture trouvées:', readDates.map(d => d.read_date));
      
      if (readDates.length > 0) {
        // Convertir les dates en objets Date pour faciliter la comparaison
        const dates = readDates.map(d => new Date(d.read_date));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Vérifier si l'utilisateur a lu aujourd'hui ou hier
        const lastReadDate = dates[0];
        lastReadDate.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - lastReadDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        console.log('📊 Dernier jour de lecture:', lastReadDate.toISOString().split('T')[0]);
        console.log('📊 Différence en jours:', diffDays);
        
        // Si le dernier jour de lecture était il y a plus d'1 jour, le streak est cassé
        if (diffDays > 1) {
          streakDays = 0;
        } else {
          // Calculer le streak en comptant les jours consécutifs
          streakDays = 1; // Au moins 1 jour (le dernier jour de lecture)
          
          for (let i = 1; i < dates.length; i++) {
            const prevDate = new Date(dates[i - 1]);
            const currDate = new Date(dates[i]);
            prevDate.setHours(0, 0, 0, 0);
            currDate.setHours(0, 0, 0, 0);
            
            const dayDiff = (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
            
            if (dayDiff === 1) {
              streakDays++;
            } else {
              break;
            }
          }
        }
      }
      
      console.log('🔥 Streak calculé:', streakDays);
      
      // Mettre à jour la base de données avec le nouveau streak
      await req.db.prepare(`
        UPDATE users 
        SET streak_days = $1
        WHERE id = $2
      `).run(streakDays, req.user.id);
      
      console.log('✅ Base de données mise à jour pour streak_days');
    } catch (e) {
      console.error('❌ Erreur calcul streak:', e);
      streakDays = user.streak_days || 0;
    }

    // Calculer le badge en fonction des livres lus (nouvelle logique)
    let calculatedBadge = 'bronze';
    if (booksCompleted >= 30 && booksCompleted < 100) calculatedBadge = 'silver';
    if (booksCompleted >= 100 && booksCompleted < 200) calculatedBadge = 'gold';
    if (booksCompleted >= 200) calculatedBadge = 'diamond';
    
    console.log('🏆 Badge calculé:', calculatedBadge, 'pour', booksCompleted, 'livres lus');

    // Utiliser le badge manuel de l'admin s'il existe, sinon utiliser le badge calculé
    const finalBadge = user.badge || calculatedBadge;
    
    console.log('🎖️ Badge final:', finalBadge, '(manuel:', user.badge, ', calculé:', calculatedBadge, ')');

    const profileData = { 
      ...user, 
      books_completed: booksCompleted,
      // Utiliser les valeurs calculées dynamiquement
      streak_days: streakDays,
      total_hours: totalHours,
      badge: finalBadge
    };
    
    console.log('✅ Données profil finales:', profileData);
    res.json(profileData);
  } catch (error) {
    console.error('💥 Erreur route profil:', error);
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
      WHERE LOWER(name) LIKE $1 OR LOWER(email) LIKE $2
      ORDER BY name ASC
      LIMIT 20
    `).all(searchTerm, searchTerm);

    // Ajouter le nombre de livres complétés pour chaque utilisateur (comptage unique)
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const booksCompleted = (await req.db.prepare(`
        SELECT COUNT(*) as c
        FROM (
          SELECT book_id, MAX(progress_pct) as max_progress
          FROM reading_sessions
          WHERE user_id = $1
          GROUP BY book_id
          HAVING MAX(progress_pct) = 100
        ) AS completed_books
      `).get(user.id)).c;

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

// GET /api/profile/saved-books
router.get('/saved-books', auth, async (req, res) => {
  const books = await req.db.prepare(`
    SELECT b.* FROM saved_books sb
    JOIN books b ON b.id = sb.book_id
    WHERE sb.user_id = $1
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
    WHERE rs.user_id = $1 AND rs.progress_pct < 100
    ORDER BY rs.updated_at DESC
  `).all(req.user.id);
  res.json(sessions);
});

// GET /api/profile/posts-history — historique des posts utilisateur
router.get('/posts-history', auth, async (req, res) => {
  try {
    console.log('📝 Requête posts-history pour user:', req.user.id);
    
    // Vérifier d'abord si des posts existent
    try {
      const allPosts = await req.db.prepare('SELECT COUNT(*) as count FROM posts').get();
      console.log('📊 Total posts dans la table posts:', allPosts);
    } catch (e) {
      console.error('❌ Erreur COUNT posts:', e.message);
      res.json([]);
      return;
    }
    
    try {
      const userPosts = await req.db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = $1').get(req.user.id);
      console.log('👤 Posts pour cet utilisateur:', userPosts);
    } catch (e) {
      console.error('❌ Erreur COUNT user posts:', e.message);
      res.json([]);
      return;
    }
    
    try {
      console.log('🔍 Requête posts avec comments...');
      const posts = await req.db.prepare(`
        SELECT p.*, COUNT(c.id) as comments_count
        FROM posts p
        LEFT JOIN comments c ON c.post_id = p.id
        WHERE p.user_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `).all(req.user.id);
      
      console.log('✅ Posts trouvés:', posts.length);
      res.json(posts);
    } catch (e) {
      console.error('❌ Erreur requête posts avec comments:', e.message);
      // Essayer sans les commentaires
      try {
        console.log('🔄 Tentative requête posts sans comments...');
        const posts = await req.db.prepare(`
          SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC
        `).all(req.user.id);
        
        console.log('✅ Posts trouvés (sans comments):', posts.length);
        res.json(posts.map(p => ({...p, comments_count: 0})));
      } catch (e2) {
        console.error('❌ Erreur requête posts simple:', e2.message);
        res.json([]);
      }
    }
  } catch (error) {
    console.error('💥 Erreur globale posts history:', error);
    res.json([]); // Retourner un tableau vide en cas d'erreur
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
        'SELECT id, name, avatar_url, badge, created_at, streak_days, total_hours, church FROM users WHERE id = $1'
      ).get(userId);
    } catch (e) {
      // Si le champ badge n'existe pas
      user = await req.db.prepare(
        'SELECT id, name, avatar_url, created_at, streak_days, total_hours, church FROM users WHERE id = $1'
      ).get(userId);
      if (user) user.badge = null; // Ne pas écraser avec bronze
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Statistiques de l'utilisateur - compter chaque livre unique terminé une seule fois
    const booksCompleted = (await req.db.prepare(`
      SELECT COUNT(*) as c
      FROM (
        SELECT book_id, MAX(progress_pct) as max_progress
        FROM reading_sessions
        WHERE user_id = $1
        GROUP BY book_id
        HAVING MAX(progress_pct) = 100
      ) AS completed_books
    `).get(userId)).c;

    // Posts récents de l'utilisateur
    const recentPosts = await req.db.prepare(`
      SELECT id, content, type, likes_count, created_at
      FROM posts 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all(userId);

    // Calculer le badge en fonction des livres lus (nouvelle logique)
    let calculatedBadge = 'bronze';
    if (booksCompleted >= 30 && booksCompleted < 100) calculatedBadge = 'silver';
    if (booksCompleted >= 100 && booksCompleted < 200) calculatedBadge = 'gold';
    if (booksCompleted >= 200) calculatedBadge = 'diamond';
    
    // Utiliser le badge manuel de l'admin s'il existe, sinon utiliser le badge calculé
    const finalBadge = user.badge || calculatedBadge;

    res.json({
      ...user,
      books_completed: booksCompleted,
      recent_posts: recentPosts,
      badge: finalBadge
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
    WHERE sb.user_id = $1
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
    WHERE rs.user_id = $1 AND rs.progress_pct < 100
    ORDER BY rs.updated_at DESC
  `).all(req.user.id);
  res.json(sessions);
});

// GET /api/profile/posts-history — historique des posts utilisateur
router.get('/posts-history', auth, async (req, res) => {
  try {
    console.log('📝 Requête posts-history pour user:', req.user.id);
    
    // Vérifier d'abord si des posts existent
    try {
      const allPosts = await req.db.prepare('SELECT COUNT(*) as count FROM posts').get();
      console.log('📊 Total posts dans la table posts:', allPosts);
    } catch (e) {
      console.error('❌ Erreur COUNT posts:', e.message);
      res.json([]);
      return;
    }
    
    try {
      const userPosts = await req.db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = $1').get(req.user.id);
      console.log('👤 Posts pour cet utilisateur:', userPosts);
    } catch (e) {
      console.error('❌ Erreur COUNT user posts:', e.message);
      res.json([]);
      return;
    }
    
    try {
      console.log('🔍 Requête posts avec comments...');
      const posts = await req.db.prepare(`
        SELECT p.*, COUNT(c.id) as comments_count
        FROM posts p
        LEFT JOIN comments c ON c.post_id = p.id
        WHERE p.user_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `).all(req.user.id);
      
      console.log('✅ Posts trouvés:', posts.length);
      res.json(posts);
    } catch (e) {
      console.error('❌ Erreur requête posts avec comments:', e.message);
      // Essayer sans les commentaires
      try {
        console.log('🔄 Tentative requête posts sans comments...');
        const posts = await req.db.prepare(`
          SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC
        `).all(req.user.id);
        
        console.log('✅ Posts trouvés (sans comments):', posts.length);
        res.json(posts.map(p => ({...p, comments_count: 0})));
      } catch (e2) {
        console.error('❌ Erreur requête posts simple:', e2.message);
        res.json([]);
      }
    }
  } catch (error) {
    console.error('💥 Erreur globale posts history:', error);
    res.json([]); // Retourner un tableau vide en cas d'erreur
  }
});

// PATCH /api/profile/me — mettre à jour le profil
router.patch('/me', auth, async (req, res) => {
  const { name, church } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  if (church !== undefined) {
    await req.db.prepare('UPDATE users SET name = $1, church = $2 WHERE id = $3').run(name.trim(), church.trim(), req.user.id);
  } else {
    await req.db.prepare('UPDATE users SET name = $1 WHERE id = $2').run(name.trim(), req.user.id);
  }
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

  const user = await req.db.prepare('SELECT id, password FROM users WHERE id = $1').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await req.db.prepare('UPDATE users SET password = $1 WHERE id = $2').run(hash, req.user.id);
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

  try {
    // Upload to Cloudinary
    const avatarUrl = await uploadToCloudinary(req.file.path, 'revelio/avatars');
    
    // Delete local file after upload
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting local file:', err);
    });
    
    await req.db.prepare('UPDATE users SET avatar_url = $1 WHERE id = $2').run(avatarUrl, req.user.id);
    
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

module.exports = router;
