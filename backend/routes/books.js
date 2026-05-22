// ============================================================
// REVELIO — Books Routes (routes/books.js)
// ============================================================
const router = require('express').Router();
const { auth } = require('../middleware/auth');

async function updateUserBadge(db, userId) {
  // Vérifier si l'utilisateur a déjà un badge manuel (attribué par l'admin)
  const user = await db.prepare('SELECT badge FROM users WHERE id = ?').get(userId);

  // Si l'utilisateur a déjà un badge manuel (autre que bronze par défaut), ne pas l'écraser
  // Le bronze par défaut peut être remplacé automatiquement
  if (user && user.badge && user.badge !== 'bronze' && user.badge !== null) {
    console.log('🏆 Badge manuel détecté, pas de mise à jour automatique:', user.badge);
    return;
  }

  // Sinon, calculer le badge automatiquement
  const booksCompleted = (await db.prepare(`
    SELECT COUNT(*) as c
    FROM (
      SELECT book_id, MAX(progress_pct) as max_progress
      FROM reading_sessions
      WHERE user_id = ?
      GROUP BY book_id
      HAVING MAX(progress_pct) = 100
    ) AS completed_books
  `).get(userId)).c;

  let newBadge = null; // Par défaut, aucun badge
  if (booksCompleted >= 200) {
    newBadge = 'diamond';
  } else if (booksCompleted >= 100) {
    newBadge = 'gold';
  } else if (booksCompleted >= 30) {
    newBadge = 'silver';
  }
  // Si <30 livres, newBadge reste null (aucun badge)

  try {
    await db.prepare('UPDATE users SET badge = ? WHERE id = ?').run(newBadge, userId);
    console.log('🏆 Badge automatique mis à jour:', newBadge, 'pour', booksCompleted, 'livres');
  } catch (e) {
    // Si le champ badge n'existe pas, ignorer silencieusement
    console.log('Badge field not found, skipping badge update');
  }
}

async function recordReadingActivity(db, userId, bookId, progressPct) {
  try {
    await db.prepare(
      'INSERT INTO reading_activity (user_id, book_id, progress_pct) VALUES (?, ?, ?)'
    ).run(userId, bookId, progressPct);
  } catch (e) {
    console.log('Reading activity table unavailable, skipping activity log:', e.message);
  }
}

// GET /api/books/categories — catégories disponibles pour les filtres
router.get('/categories', auth, async (req, res) => {
  const categories = await req.db.prepare('SELECT name FROM categories ORDER BY name ASC').all();
  res.json(categories.map(c => c.name));
});

// GET /api/books — liste filtrée
router.get('/', auth, async (req, res) => {
  const { category, level, duration, q, author } = req.query;
  let sql = 'SELECT * FROM books WHERE 1=1';
  const params = [];

  if (category && category !== 'all') { sql += ' AND category = ?'; params.push(category); }
  if (level    && level    !== 'all') { sql += ' AND level = ?';    params.push(level); }
  if (author) { sql += ' AND LOWER(author) LIKE ?'; params.push(`%${author.toLowerCase()}%`); }
  if (q)      { sql += ' AND LOWER(title)  LIKE ?'; params.push(`%${q.toLowerCase()}%`); }

  if (duration === 'lt20') { sql += ' AND duration_min < 20'; }
  else if (duration === '20-30') { sql += ' AND duration_min BETWEEN 20 AND 30'; }
  else if (duration === 'gt30')  { sql += ' AND duration_min > 30'; }

  sql += ' ORDER BY title ASC';
  const books = await req.db.prepare(sql).all(...params);

  // Ajouter si le livre est sauvegardé par l'utilisateur
  const savedIds = (await req.db.prepare(
    'SELECT book_id FROM saved_books WHERE user_id = ?'
  ).all(req.user.id)).map(r => r.book_id);

  res.json(books.map(b => ({ ...b, is_saved: savedIds.includes(b.id) })));
});

// GET /api/books/:id — détail
router.get('/:id', auth, async (req, res) => {
  const bookId = req.params.id;
  const userId = req.user.id;

  if (!bookId) return res.status(400).json({ error: 'book_id required' });
  if (!userId) return res.status(401).json({ error: 'user not authenticated' });

  const book = await req.db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const session = await req.db.prepare(
    'SELECT * FROM reading_sessions WHERE user_id = ? AND book_id = ?'
  ).get(userId, bookId);

  const saved = await req.db.prepare(
    'SELECT id FROM saved_books WHERE user_id = ? AND book_id = ?'
  ).get(userId, bookId);

  const tags = await req.db.prepare('SELECT type, name FROM book_tags WHERE book_id = ?').all(bookId);
  const likesCount = (await req.db.prepare('SELECT COUNT(*) as count FROM book_likes WHERE book_id = ?').get(bookId)).count;
  const isLiked = !!(await req.db.prepare('SELECT id FROM book_likes WHERE user_id = ? AND book_id = ?').get(userId, bookId));

  if (book.key_points) {
    try { book.key_points = JSON.parse(book.key_points); } catch(e) {}
  }

  res.json({ 
    ...book, 
    tags,
    likes_count: likesCount,
    is_liked: isLiked,
    progress_pct: session?.progress_pct || 0, 
    is_saved: !!saved 
  });
});

// POST /api/books/:id/like — like/unlike
router.post('/:id/like', auth, async (req, res) => {
  const bookId = req.params.id;
  const userId = req.user.id;

  if (!bookId) return res.status(400).json({ error: 'book_id required' });
  if (!userId) return res.status(401).json({ error: 'user not authenticated' });

  const existing = await req.db.prepare(
    'SELECT id FROM book_likes WHERE user_id = ? AND book_id = ?'
  ).get(userId, bookId);

  if (existing) {
    await req.db.prepare('DELETE FROM book_likes WHERE user_id = ? AND book_id = ?').run(userId, bookId);
    const likesCount = (await req.db.prepare('SELECT COUNT(*) as count FROM book_likes WHERE book_id = ?').get(bookId)).count;
    res.json({ liked: false, likes_count: likesCount });
  } else {
    await req.db.prepare('INSERT INTO book_likes (user_id, book_id) VALUES (?, ?)').run(userId, bookId);
    const likesCount = (await req.db.prepare('SELECT COUNT(*) as count FROM book_likes WHERE book_id = ?').get(bookId)).count;
    res.json({ liked: true, likes_count: likesCount });
  }
});

// POST /api/books/:id/save — toggle save
router.post('/:id/save', auth, async (req, res) => {
  const bookId = req.params.id;
  const userId = req.user.id;

  if (!bookId) return res.status(400).json({ error: 'book_id required' });
  if (!userId) return res.status(401).json({ error: 'user not authenticated' });

  const existing = await req.db.prepare(
    'SELECT id FROM saved_books WHERE user_id = ? AND book_id = ?'
  ).get(userId, bookId);

  if (existing) {
    await req.db.prepare('DELETE FROM saved_books WHERE user_id = ? AND book_id = ?').run(userId, bookId);
    res.json({ saved: false });
  } else {
    await req.db.prepare('INSERT INTO saved_books (user_id, book_id) VALUES (?, ?)').run(userId, bookId);
    res.json({ saved: true });
  }
});

// PATCH /api/books/:id/progress — mettre à jour la progression
router.patch('/:id/progress', auth, async (req, res) => {
  const { progress_pct } = req.body;
  const bookId = req.params.id;
  const userId = req.user.id;

  if (progress_pct == null) return res.status(400).json({ error: 'progress_pct required' });
  if (!bookId) return res.status(400).json({ error: 'book_id required' });
  if (!userId) return res.status(401).json({ error: 'user not authenticated' });

  const session = await req.db.prepare(
    'SELECT id, progress_pct FROM reading_sessions WHERE user_id = ? AND book_id = ?'
  ).get(userId, bookId);

  const rawPct = parseInt(progress_pct, 10) || 0;
  const pct = Math.max(0, Math.min(100, rawPct));
  await recordReadingActivity(req.db, userId, bookId, pct);

  if (session) {
    const previousPct = Number(session.progress_pct) || 0;
    const nextPct = Math.max(previousPct, pct);
    const completedNow = previousPct < 100 && nextPct === 100;

    if (completedNow) {
      let book;
      try {
        book = await req.db.prepare('SELECT reading_time_min FROM books WHERE id = ?').get(bookId);
      } catch (e) {
        // Si le champ reading_time_min n'existe pas, utiliser duration_min
        book = await req.db.prepare('SELECT duration_min FROM books WHERE id = ?').get(bookId);
        if (book) book.reading_time_min = book.duration_min || 5;
      }
      if (book) {
        await req.db.prepare('UPDATE users SET total_hours = total_hours + ? WHERE id = ?').run((book.reading_time_min || 5) / 60, userId);
      }
    }
    await req.db.prepare(
      `UPDATE reading_sessions SET progress_pct = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND book_id = ?`
    ).run(nextPct, userId, bookId);

    if (completedNow) {
      await updateUserBadge(req.db, userId);
    }
  } else {
    if (pct === 100) {
      let book;
      try {
        book = await req.db.prepare('SELECT reading_time_min FROM books WHERE id = ?').get(bookId);
      } catch (e) {
        // Si le champ reading_time_min n'existe pas, utiliser duration_min
        book = await req.db.prepare('SELECT duration_min FROM books WHERE id = ?').get(bookId);
        if (book) book.reading_time_min = book.duration_min || 5;
      }
      if (book) {
        await req.db.prepare('UPDATE users SET total_hours = total_hours + ? WHERE id = ?').run((book.reading_time_min || 5) / 60, userId);
      }
    }
    await req.db.prepare(
      'INSERT INTO reading_sessions (user_id, book_id, progress_pct) VALUES (?, ?, ?)'
    ).run(userId, bookId, pct);

    if (pct === 100) {
      await updateUserBadge(req.db, userId);
    }
  }
  res.json({ success: true });
});

// DELETE /api/books/:id/save — supprimer un livre sauvegardé
router.delete('/:id/save', auth, async (req, res) => {
  try {
    const bookId = req.params.id;
    const userId = req.user.id;

    if (!bookId) return res.status(400).json({ error: 'book_id required' });
    if (!userId) return res.status(401).json({ error: 'user not authenticated' });

    const result = await req.db.prepare(
      'DELETE FROM saved_books WHERE user_id = ? AND book_id = ?'
    ).run(userId, bookId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Book not found in saved books' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting saved book:', e);
    res.status(500).json({ error: 'Failed to delete saved book' });
  }
});

module.exports = router;
