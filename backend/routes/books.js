// ============================================================
// REVELIO — Books Routes (routes/books.js)
// ============================================================
const router = require('express').Router();
const { auth } = require('../middleware/auth');

async function updateUserBadge(db, userId) {
  const booksCompleted = (await db.prepare(
    'SELECT COUNT(*) as c FROM reading_sessions WHERE user_id = ? AND progress_pct = 100'
  ).get(userId)).c;

  let newBadge = 'bronze';
  if (booksCompleted >= 10000) {
    newBadge = 'diamond';
  } else if (booksCompleted >= 1000) {
    newBadge = 'gold';
  } else if (booksCompleted >= 100) {
    newBadge = 'silver';
  }

  try {
    await db.prepare('UPDATE users SET badge = ? WHERE id = ?').run(newBadge, userId);
  } catch (e) {
    // Si le champ badge n'existe pas, ignorer silencieusement
    console.log('Badge field not found, skipping badge update');
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
  const book = await req.db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const session = await req.db.prepare(
    'SELECT * FROM reading_sessions WHERE user_id = ? AND book_id = ?'
  ).get(req.user.id, req.params.id);

  const saved = await req.db.prepare(
    'SELECT id FROM saved_books WHERE user_id = ? AND book_id = ?'
  ).get(req.user.id, req.params.id);

  const tags = await req.db.prepare('SELECT type, name FROM book_tags WHERE book_id = ?').all(req.params.id);
  const likesCount = (await req.db.prepare('SELECT COUNT(*) as count FROM book_likes WHERE book_id = ?').get(req.params.id)).count;
  const isLiked = !!(await req.db.prepare('SELECT id FROM book_likes WHERE user_id = ? AND book_id = ?').get(req.user.id, req.params.id));

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

// POST /api/books/:id/like — toggle like on a book
router.post('/:id/like', auth, async (req, res) => {
  const { id } = req.params;
  const existing = await req.db.prepare(
    'SELECT id FROM book_likes WHERE user_id = ? AND book_id = ?'
  ).get(req.user.id, id);

  if (existing) {
    await req.db.prepare('DELETE FROM book_likes WHERE user_id = ? AND book_id = ?').run(req.user.id, id);
    res.json({ liked: false });
  } else {
    await req.db.prepare('INSERT INTO book_likes (user_id, book_id) VALUES (?, ?)').run(req.user.id, id);
    res.json({ liked: true });
  }
});

// POST /api/books/:id/save — toggle save
router.post('/:id/save', auth, async (req, res) => {
  const { id } = req.params;
  const existing = await req.db.prepare(
    'SELECT id FROM saved_books WHERE user_id = ? AND book_id = ?'
  ).get(req.user.id, id);

  if (existing) {
    await req.db.prepare('DELETE FROM saved_books WHERE user_id = ? AND book_id = ?').run(req.user.id, id);
    res.json({ saved: false });
  } else {
    await req.db.prepare('INSERT INTO saved_books (user_id, book_id) VALUES (?, ?)').run(req.user.id, id);
    res.json({ saved: true });
  }
});

// PATCH /api/books/:id/progress — mettre à jour la progression
router.patch('/:id/progress', auth, async (req, res) => {
  const { progress_pct } = req.body;
  if (progress_pct == null) return res.status(400).json({ error: 'progress_pct required' });

  const session = await req.db.prepare(
    'SELECT id, progress_pct FROM reading_sessions WHERE user_id = ? AND book_id = ?'
  ).get(req.user.id, req.params.id);

  const pct = parseInt(progress_pct, 10) || 0;

  if (session) {
    if (session.progress_pct < 100 && pct === 100) {
      let book;
      try {
        book = await req.db.prepare('SELECT reading_time_min FROM books WHERE id = ?').get(req.params.id);
      } catch (e) {
        // Si le champ reading_time_min n'existe pas, utiliser duration_min
        book = await req.db.prepare('SELECT duration_min FROM books WHERE id = ?').get(req.params.id);
        if (book) book.reading_time_min = book.duration_min || 5;
      }
      if (book) {
        await req.db.prepare('UPDATE users SET total_hours = total_hours + ? WHERE id = ?').run((book.reading_time_min || 5) / 60, req.user.id);
        await updateUserBadge(req.db, req.user.id);
      }
    }
    await req.db.prepare(
      `UPDATE reading_sessions SET progress_pct = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND book_id = ?`
    ).run(pct, req.user.id, req.params.id);
  } else {
    if (pct === 100) {
      let book;
      try {
        book = await req.db.prepare('SELECT reading_time_min FROM books WHERE id = ?').get(req.params.id);
      } catch (e) {
        // Si le champ reading_time_min n'existe pas, utiliser duration_min
        book = await req.db.prepare('SELECT duration_min FROM books WHERE id = ?').get(req.params.id);
        if (book) book.reading_time_min = book.duration_min || 5;
      }
      if (book) {
        await req.db.prepare('UPDATE users SET total_hours = total_hours + ? WHERE id = ?').run((book.reading_time_min || 5) / 60, req.user.id);
        await updateUserBadge(req.db, req.user.id);
      }
    }
    await req.db.prepare(
      'INSERT INTO reading_sessions (user_id, book_id, progress_pct) VALUES (?, ?, ?)'
    ).run(req.user.id, req.params.id, pct);
  }
  res.json({ success: true });
});

module.exports = router;
