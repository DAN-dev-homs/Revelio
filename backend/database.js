// ============================================================
// REVELIO — Database Setup (database.js)
// Support PostgreSQL via DATABASE_URL, fallback SQLite for local development.
// ============================================================
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path   = require('path');

const DB_PATH = path.join(__dirname, 'revelio.db');
const DATABASE_URL = process.env.DATABASE_URL;

function convertQuestionMarks(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function createSqliteClient() {
  const raw = new Database(DB_PATH);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  return {
    type: 'sqlite',
    prepare(sql) {
      const stmt = raw.prepare(sql);
      return {
        async get(...params) { return stmt.get(...params); },
        async all(...params) { return stmt.all(...params); },
        async run(...params) { return stmt.run(...params); }
      };
    },
    async exec(sql) { return raw.exec(sql); }
  };
}

function createPostgresClient(pool) {
  return {
    type: 'postgres',
    prepare(sql) {
      const converted = convertQuestionMarks(sql);
      return {
        async get(...params) {
          const result = await pool.query(converted, params);
          return result.rows[0] || null;
        },
        async all(...params) {
          const result = await pool.query(converted, params);
          return result.rows;
        },
        async run(...params) {
          const finalSql = sql.trim().toUpperCase().startsWith('INSERT') && !/RETURNING\s+/i.test(sql)
            ? `${converted} RETURNING id`
            : converted;
          const result = await pool.query(finalSql, params);
          return {
            rowCount: result.rowCount,
            rows: result.rows,
            command: result.command,
            lastInsertRowid: result.rows?.[0]?.id
          };
        }
      };
    },
    async exec(sql) {
      return pool.query(convertQuestionMarks(sql));
    }
  };
}

async function ensureSchema(db) {
  if (db.type === 'sqlite') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        email       TEXT    NOT NULL UNIQUE,
        password    TEXT    NOT NULL,
        role        TEXT    DEFAULT 'user',
        avatar_url  TEXT,
        streak_days INTEGER DEFAULT 0,
        total_hours REAL    DEFAULT 0,
        badge       TEXT,
        created_at  TEXT    DEFAULT (datetime('now'))
      );`);

    // Migration pour ajouter le champ badge s'il n'existe pas
    try {
      await db.exec(`ALTER TABLE users ADD COLUMN badge TEXT`);
    } catch (e) {
      // Le champ existe déjà, ignorer l'erreur
    }

    // Migration pour ajouter le champ reading_time_min s'il n'existe pas
    try {
      await db.exec(`ALTER TABLE books ADD COLUMN reading_time_min INTEGER DEFAULT 5`);
    } catch (e) {
      // Le champ existe déjà, ignorer l'erreur
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS books (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT    NOT NULL,
        author        TEXT    NOT NULL,
        cover_color   TEXT    DEFAULT '#4CAF93',
        cover_url     TEXT,
        category      TEXT    NOT NULL,
        duration_min  INTEGER NOT NULL,
        level         TEXT    NOT NULL,
        video_url     TEXT,
        thumbnail_url TEXT,
        audio_url     TEXT,
        audio_duration INTEGER,
        summary       TEXT,
        key_points    TEXT,
        reading_time_min INTEGER DEFAULT 5,
        amazon_url    TEXT,
        created_at    TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS book_tags (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        type    TEXT    NOT NULL,
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
        image_url   TEXT,
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

      CREATE TABLE IF NOT EXISTS community_posts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        image_url   TEXT,
        likes_count INTEGER DEFAULT 0,
        created_at  TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS community_comments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id    INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content    TEXT    NOT NULL,
        created_at TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS community_post_likes (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(post_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        is_read     INTEGER DEFAULT 0,
        created_at  TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action      TEXT    NOT NULL,
        detail      TEXT,
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
  } else {
    // Migration pour ajouter le champ badge s'il n'existe pas (PostgreSQL)
    try {
      console.log('🔄 Migration PostgreSQL: ajout du champ badge...');
      await db.exec(`ALTER TABLE users ADD COLUMN badge TEXT`);
      console.log('✅ Champ badge ajouté avec succès');
    } catch (e) {
      console.log('ℹ️ Champ badge déjà existant ou erreur:', e.message);
      // Le champ existe déjà, ignorer l'erreur
    }

    // Migration pour ajouter le champ reading_time_min s'il n'existe pas (PostgreSQL)
    try {
      console.log('🔄 Migration PostgreSQL: ajout du champ reading_time_min...');
      await db.exec(`ALTER TABLE books ADD COLUMN reading_time_min INTEGER DEFAULT 5`);
      console.log('✅ Champ reading_time_min ajouté avec succès');
    } catch (e) {
      console.log('ℹ️ Champ reading_time_min déjà existant ou erreur:', e.message);
      // Le champ existe déjà, ignorer l'erreur
    }

    // Migration pour ajouter le champ image_url s'il n'existe pas (PostgreSQL)
    try {
      console.log('🔄 Migration PostgreSQL: ajout du champ image_url...');
      await db.exec(`ALTER TABLE posts ADD COLUMN image_url TEXT`);
      console.log('✅ Champ image_url ajouté avec succès');
    } catch (e) {
      console.log('ℹ️ Champ image_url déjà existant ou erreur:', e.message);
      // Le champ existe déjà, ignorer l'erreur
    }

    // Migration pour ajouter le champ church s'il n'existe pas (PostgreSQL)
    try {
      console.log('🔄 Migration PostgreSQL: ajout du champ church...');
      await db.exec(`ALTER TABLE users ADD COLUMN church TEXT`);
      console.log('✅ Champ church ajouté avec succès');
    } catch (e) {
      console.log('ℹ️ Champ church déjà existant ou erreur:', e.message);
      // Le champ existe déjà, ignorer l'erreur
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        TEXT    NOT NULL,
        email       TEXT    NOT NULL UNIQUE,
        password    TEXT    NOT NULL,
        role        TEXT    DEFAULT 'user',
        avatar_url  TEXT,
        streak_days INTEGER DEFAULT 0,
        total_hours REAL    DEFAULT 0,
        badge       TEXT,
        church      TEXT,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS books (
        id            SERIAL PRIMARY KEY,
        title         TEXT    NOT NULL,
        author        TEXT    NOT NULL,
        cover_color   TEXT    DEFAULT '#4CAF93',
        cover_url     TEXT,
        category      TEXT    NOT NULL,
        duration_min  INTEGER NOT NULL,
        level         TEXT    NOT NULL,
        video_url     TEXT,
        thumbnail_url TEXT,
        audio_url     TEXT,
        audio_duration INTEGER,
        summary       TEXT,
        key_points    TEXT,
        reading_time_min INTEGER DEFAULT 5,
        amazon_url    TEXT,
        created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS book_tags (
        id      SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        type    TEXT    NOT NULL,
        name    TEXT    NOT NULL
      );

      CREATE TABLE IF NOT EXISTS book_likes (
        id      SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(book_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS reading_sessions (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id      INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        progress_pct INTEGER DEFAULT 0,
        started_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS saved_books (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        saved_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, book_id)
      );

      CREATE TABLE IF NOT EXISTS posts (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        image_url   TEXT,
        likes_count INTEGER DEFAULT 0,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS post_likes (
        id      SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(post_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id         SERIAL PRIMARY KEY,
        post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content    TEXT    NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS community_posts (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        image_url   TEXT,
        likes_count INTEGER DEFAULT 0,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS community_comments (
        id         SERIAL PRIMARY KEY,
        post_id    INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content    TEXT    NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS community_post_likes (
        id      SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(post_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        is_read     INTEGER DEFAULT 0,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action      TEXT    NOT NULL,
        detail      TEXT,
        ip          TEXT,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS topics (
        id    SERIAL PRIMARY KEY,
        name  TEXT NOT NULL,
        color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id    SERIAL PRIMARY KEY,
        name  TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}

async function seedData(db) {
  const hash = bcrypt.hashSync('password123', 10);
  const newAdminHash = bcrypt.hashSync('Lungu@221000', 10);

  const resultAdmin = await db.prepare(
    'INSERT INTO users (name, email, password, role, streak_days, total_hours, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run('Sarah Mitchell (Admin)', 'sarah.m@example.com', hash, 'admin', 7, 24, null);
  const adminId = resultAdmin.lastInsertRowid;

  const resultNewAdmin = await db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run('danielhomelema22', 'danielhomelema22@gmail.com', newAdminHash, 'admin');
  const newAdminId = resultNewAdmin.lastInsertRowid;

  const resultUser = await db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run('John Doe', 'user@example.com', hash, 'user');
  const userId = resultUser.lastInsertRowid;

  const book1 = {
    title: 'The Purpose Driven Life',
    author: 'Rick Warren',
    cover_color: '#4CAF93',
    category: 'faith',
    duration_min: 25,
    level: 'beginner',
    summary: `Ce livre révolutionnaire de Rick Warren vous guidera dans un voyage spirituel de 40 jours pour répondre à la question la plus importante de la vie : "Pourquoi suis-je ici ?".\n\n### La grande question\nLe but de votre vie dépasse largement votre accomplissement personnel, votre paix intérieure, ou même votre bonheur. Il a ses racines dans le cœur de Dieu.`,
    key_points: JSON.stringify([
      'Vous n\'êtes pas un accident. Dieu a prévu votre naissance.',
      'Vous avez été conçu pour le plaisir de Dieu.',
      'Vous avez été formé pour faire partie de la famille de Dieu.',
      'Vous avez été créé pour devenir comme Christ.',
      'Vous avez été façonné pour servir Dieu.'
    ]),
    amazon_url: 'https://amazon.com/dp/031033750X'
  };

  const resultBook = await db.prepare(
    'INSERT INTO books (title, author, cover_color, category, duration_min, level, summary, key_points, reading_time_min, amazon_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    book1.title, book1.author, book1.cover_color, book1.category, book1.duration_min, book1.level,
    book1.summary, book1.key_points, 8, book1.amazon_url
  );
  const bookId1 = resultBook.lastInsertRowid;

  const insTag = db.prepare('INSERT INTO book_tags (book_id, type, name) VALUES (?, ?, ?)');
  await insTag.run(bookId1, 'theme', 'purpose');
  await insTag.run(bookId1, 'theme', 'faith');
  await insTag.run(bookId1, 'emotion', 'hope');

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
  for (const book of books) {
    await insNormalBook.run(...book);
  }

  await db.prepare('INSERT INTO reading_sessions (user_id, book_id, progress_pct) VALUES (?, ?, ?)').run(adminId, 1, 65);
  await db.prepare('INSERT INTO reading_sessions (user_id, book_id, progress_pct) VALUES (?, ?, ?)').run(adminId, 2, 30);

  await db.prepare('INSERT INTO saved_books (user_id, book_id) VALUES (?, ?)').run(adminId, 1);
  await db.prepare('INSERT INTO saved_books (user_id, book_id) VALUES (?, ?)').run(adminId, 3);

  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();

  await db.prepare('INSERT INTO posts (user_id, type, content, likes_count, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(adminId, 'testimony', "After 2 years of struggling with anxiety, I finally found peace through daily prayer and meditation on God's word.", 24, threeHoursAgo);
  await db.prepare('INSERT INTO posts (user_id, type, content, likes_count, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(adminId, 'thought', "Reading 'The Purpose Driven Life' changed my perspective on why I exist. Every page feels like a letter written just for me.", 17, fiveHoursAgo);

  const topics = [
    ['Love', '#10B981'], ['Anxiety', '#2563EB'], ['Prayer', '#7C3AED'],
    ['Forgiveness', '#B91C1C'], ['Purpose', '#D97706'], ['Peace', '#0891B2']
  ];
  const insTopic2 = db.prepare('INSERT INTO topics (name, color) VALUES (?, ?)');
  for (const [name, color] of topics) {
    await insTopic2.run(name, color);
  }

  const categories = ['faith', 'healing', 'identity', 'discipline', 'relations'];
  const insCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
  for (const cat of categories) {
    await insCategory.run(cat);
  }

  await db.prepare('INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)').run(adminId, 'system', 'Bienvenue sur Revelio ! Explorez votre première lecture.', 0);
  await db.prepare('INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)').run(newAdminId, 'system', 'Bienvenue sur Revelio ! Explorez votre première lecture.', 0);
  await db.prepare('INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)').run(adminId, 'like', 'Un membre a aimé votre post.', 0);

  console.log('✅ Database seeded successfully (with admin user and new Book model)');
}

async function initDB() {
  if (DATABASE_URL) {
    const useSsl = DATABASE_URL.includes('sslmode=require') || process.env.NODE_ENV === 'production';
    const pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false
    });
    await pool.connect().then(client => client.release());
    const db = createPostgresClient(pool);
    await ensureSchema(db);
    await ensureAdminUser(db);
    const count = await db.prepare('SELECT COUNT(*) as c FROM users').get();
    if (!count || !count.c) await seedData(db);
    return db;
  }

  const db = createSqliteClient();
  await ensureSchema(db);
  await ensureAdminUser(db);
  const count = await db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (!count || !count.c) await seedData(db);
  return db;
}

async function ensureAdminUser(db) {
  const adminEmail = 'danielhomelema22@gmail.com';
  const adminHash = bcrypt.hashSync('Lungu@221000', 10);
  const existingAdmin = await db.prepare('SELECT id, role FROM users WHERE email = ?').get(adminEmail);

  if (!existingAdmin) {
    await db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).run('danielhomelema22', adminEmail, adminHash, 'admin');
  } else if (existingAdmin.role !== 'admin') {
    await db.prepare(
      'UPDATE users SET role = ?, password = ? WHERE id = ?'
    ).run('admin', adminHash, existingAdmin.id);
  }
}

module.exports = { initDB };

