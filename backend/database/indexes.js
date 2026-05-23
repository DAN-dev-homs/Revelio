// Index de performance pour requêtes fréquentes à grande échelle
async function ensurePerformanceIndexes(db) {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)',
    'CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_book ON reading_sessions(user_id, book_id)',
    'CREATE INDEX IF NOT EXISTS idx_saved_books_user ON saved_books(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_books_category ON books(category)',
    'CREATE INDEX IF NOT EXISTS idx_books_title_lower ON books(title)',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'
  ];

  for (const sql of indexes) {
    try {
      await db.exec(sql);
    } catch (e) {
      // Tables legacy (community_posts vs posts) — ignorer si colonne/table absente
      if (!/does not exist|no such table/i.test(e.message)) {
        console.warn('[indexes]', e.message);
      }
    }
  }
}

module.exports = { ensurePerformanceIndexes };
