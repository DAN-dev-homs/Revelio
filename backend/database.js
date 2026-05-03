// ============================================================
// REVELIO — Database Setup (database.js)
// Utilise node:sqlite (intégré Node.js v22+, sans compilation)
// ============================================================
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path   = require('path');

const DB_PATH = path.join(__dirname, 'revelio.db');

function initDB() {
  const db = new DatabaseSync(DB_PATH);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  // ── Schéma ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      role        TEXT    DEFAULT 'user', -- 'admin' ou 'user'
      avatar_url  TEXT,
      streak_days INTEGER DEFAULT 0,
      total_hours REAL    DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      author       TEXT    NOT NULL,
      cover_color  TEXT    DEFAULT '#4CAF93',
      cover_url    TEXT,
      category     TEXT    NOT NULL,
      duration_min INTEGER NOT NULL,
      level        TEXT    NOT NULL,
      
      -- Format A.C.T.I.O.N.
      video_url    TEXT,
      thumbnail_url TEXT,
      audio_url    TEXT,
      audio_duration INTEGER, -- En secondes
      summary      TEXT,      -- Markdown ou HTML
      key_points   TEXT,      -- JSON array
      amazon_url   TEXT,      -- Lien d'achat
      
      created_at   TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS book_tags (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      type    TEXT    NOT NULL, -- 'emotion', 'theme', 'format'
      name    TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS book_likes (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(book_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS reading_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id      INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      progress_pct INTEGER DEFAULT 0,
      started_at   TEXT    DEFAULT (datetime('now')),
      updated_at   TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_books (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      saved_at   TEXT    DEFAULT (datetime('now')),
      UNIQUE(user_id, book_id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      likes_count INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL, -- 'system', 'like', 'comment'
      content     TEXT    NOT NULL,
      is_read     INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    );


    CREATE TABLE IF NOT EXISTS activity_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action      TEXT    NOT NULL, -- 'login', 'register', 'create_book', 'delete_book', 'create_admin', 'reset_password', ...
      detail      TEXT,             -- JSON or plain text describing the action
      ip          TEXT,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS topics (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed si vide
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count === 0) seedData(db);

  return db;
}

function seedData(db) {
  const hash   = bcrypt.hashSync('password123', 10);
  // Compte Admin
  const adminId = db.prepare(
    'INSERT INTO users (name, email, password, role, streak_days, total_hours, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run('Sarah Mitchell (Admin)', 'sarah.m@example.com', hash, 'admin', 7, 24, null).lastInsertRowid;

  // Compte User
  const userId = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run('John Doe', 'user@example.com', hash, 'user').lastInsertRowid;

  // Création du livre riche "The Purpose Driven Life" (A.C.T.I.O.N. Format)
  const book1 = {
    title: 'The Purpose Driven Life',
    author: 'Rick Warren',
    cover_color: '#4CAF93',
    category: 'faith',
    duration_min: 25,
    level: 'beginner',
    summary: `Ce livre révolutionnaire de Rick Warren vous guidera dans un voyage spirituel de 40 jours pour répondre à la question la plus importante de la vie : "Pourquoi suis-je ici ?".\n\n### La grande question\nLe but de votre vie dépasse largement votre accomplissement personnel, votre paix intérieure, ou même votre bonheur. Il a ses racines dans le cœur de Dieu.`,
    key_points: JSON.stringify([
      "Vous n'êtes pas un accident. Dieu a prévu votre naissance.",
      "Vous avez été conçu pour le plaisir de Dieu.",
      "Vous avez été formé pour faire partie de la famille de Dieu.",
      "Vous avez été créé pour devenir comme Christ.",
      "Vous avez été façonné pour servir Dieu."
    ]),
    amazon_url: 'https://amazon.com/dp/031033750X'
  };

  const insBook = db.prepare(
    'INSERT INTO books (title, author, cover_color, category, duration_min, level, summary, key_points, amazon_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  
  const bookId1 = insBook.run(
    book1.title, book1.author, book1.cover_color, book1.category, book1.duration_min, book1.level,
    book1.summary, book1.key_points, book1.amazon_url
  ).lastInsertRowid;

  // Ajout des tags pour Book 1
  const insTag = db.prepare('INSERT INTO book_tags (book_id, type, name) VALUES (?, ?, ?)');
  insTag.run(bookId1, 'theme', 'purpose');
  insTag.run(bookId1, 'theme', 'faith');
  insTag.run(bookId1, 'emotion', 'hope');

  // Autres livres normaux
  const books = [
    ['Boundaries',              'Henry Cloud',     '#5DADE2', 'healing',    30, 'intermediate'],
    ['Mere Christianity',       'C.S. Lewis',      '#A569BD', 'faith',      20, 'intermediate'],
    ['The Alchemist',           'Paulo Coelho',    '#E59866', 'identity',   18, 'beginner'],
    ['Atomic Habits',           'James Clear',     '#52BE80', 'discipline', 28, 'intermediate'],
    ['The Anxious Generation',  'Jonathan Haidt',  '#2563EB', 'healing',    35, 'advanced']
  ];
  
  const insNormalBook = db.prepare(
    'INSERT INTO books (title, author, cover_color, category, duration_min, level) VALUES (?, ?, ?, ?, ?, ?)'
  );
  books.forEach(b => insNormalBook.run(...b));

  // Sessions de lecture en cours
  db.prepare('INSERT INTO reading_sessions (user_id, book_id, progress_pct) VALUES (?, ?, ?)').run(adminId, 1, 65);
  db.prepare('INSERT INTO reading_sessions (user_id, book_id, progress_pct) VALUES (?, ?, ?)').run(adminId, 2, 30);

  // Livres sauvegardés
  db.prepare('INSERT INTO saved_books (user_id, book_id) VALUES (?, ?)').run(adminId, 1);
  db.prepare('INSERT INTO saved_books (user_id, book_id) VALUES (?, ?)').run(adminId, 3);

  // Posts communauté
  db.prepare("INSERT INTO posts (user_id, type, content, likes_count, created_at) VALUES (?, ?, ?, ?, datetime('now', '-3 hours'))")
    .run(userId, 'testimony', "After 2 years of struggling with anxiety, I finally found peace through daily prayer and meditation on God's word.", 24);
  db.prepare("INSERT INTO posts (user_id, type, content, likes_count, created_at) VALUES (?, ?, ?, ?, datetime('now', '-5 hours'))")
    .run(adminId, 'thought', "Reading 'The Purpose Driven Life' changed my perspective on why I exist. Every page feels like a letter written just for me.", 17);

  // Topics
  const topics = [
    ['Love', '#10B981'], ['Anxiety', '#2563EB'], ['Prayer', '#7C3AED'],
    ['Forgiveness', '#B91C1C'], ['Purpose', '#D97706'], ['Peace', '#0891B2'],
  ];
  const insTopic = db.prepare('INSERT INTO topics (name, color) VALUES (?, ?)');
  topics.forEach(([name, color]) => insTopic.run(name, color));

  // Categories
  const categories = ['faith', 'healing', 'identity', 'discipline', 'relations'];
  const insCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
  categories.forEach(cat => insCategory.run(cat));

  // Notifications
  db.prepare("INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)").run(adminId, 'system', 'Bienvenue sur Revelio ! Explorez votre première lecture.', 0);
  db.prepare("INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)").run(adminId, 'like', 'Un membre a aimé votre post.', 0);

  console.log('✅ Database seeded successfully (with admin user and new Book model)');
}

module.exports = { initDB };
