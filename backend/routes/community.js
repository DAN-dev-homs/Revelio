// ============================================================
// REVELIO — Community Routes (routes/community.js)
// ============================================================
const router = require('express').Router();
const { auth } = require('../middleware/auth');

// GET /api/community/posts
router.get('/posts', auth, async (req, res) => {
  const posts = await req.db.prepare(`
    SELECT p.*, u.name AS author_name, u.avatar_url AS author_avatar
    FROM posts p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all();

  const likedIds = (await req.db.prepare(
    'SELECT post_id FROM post_likes WHERE user_id = ?'
  ).all(req.user.id)).map(r => r.post_id);

  const commentCounts = (await req.db.prepare(
    'SELECT post_id, COUNT(*) as cnt FROM comments GROUP BY post_id'
  ).all()).reduce((acc, r) => { acc[r.post_id] = r.cnt; return acc; }, {});

  res.json(posts.map(p => ({
    ...p,
    is_liked:      likedIds.includes(p.id),
    comments_count: commentCounts[p.id] || 0,
  })));
});

// POST /api/community/posts — créer un post
router.post('/posts', auth, async (req, res) => {
  const { type, content } = req.body;
  if (!type || !content?.trim())
    return res.status(400).json({ error: 'type and content are required' });
  if (!['testimony', 'thought'].includes(type))
    return res.status(400).json({ error: 'type must be testimony or thought' });
  if (content.length > 1000)
    return res.status(400).json({ error: 'Content too long (max 1000 chars)' });

  const result = await req.db.prepare(
    'INSERT INTO posts (user_id, type, content) VALUES (?, ?, ?)'
  ).run(req.user.id, type, content.trim());

  const post = await req.db.prepare(
    'SELECT p.*, u.name AS author_name, u.avatar_url AS author_avatar FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({ ...post, is_liked: false, comments_count: 0 });
});

// POST /api/community/posts/:id/like — toggle like
router.post('/posts/:id/like', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  const post = await req.db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = await req.db.prepare(
    'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?'
  ).get(postId, req.user.id);

  if (existing) {
    await req.db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(postId, req.user.id);
    await req.db.prepare('UPDATE posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(postId);
    res.json({ liked: false });
  } else {
    await req.db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(postId, req.user.id);
    await req.db.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').run(postId);

    if (post.user_id !== req.user.id) {
      const liker = await req.db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
      await req.db.prepare(
        'INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)'
      ).run(post.user_id, 'like', `${liker?.name || 'Quelqu’un'} a aimé votre post.`, 0);
    }

    res.json({ liked: true });
  }
});

// GET /api/community/posts/:id/comments
router.get('/posts/:id/comments', auth, async (req, res) => {
  const comments = await req.db.prepare(`
    SELECT c.*, u.name AS author_name, u.avatar_url AS author_avatar
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

// POST /api/community/posts/:id/comments
router.post('/posts/:id/comments', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

  const post = await req.db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const result = await req.db.prepare(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, content.trim());

  const comment = await req.db.prepare(`
    SELECT c.*, u.name AS author_name, u.avatar_url AS author_avatar
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  if (post.user_id !== req.user.id) {
    await req.db.prepare(
      'INSERT INTO notifications (user_id, type, content, is_read) VALUES (?, ?, ?, ?)'
    ).run(post.user_id, 'comment', `${comment.author_name} a commenté votre post.`, 0);
  }

  res.status(201).json(comment);
});

module.exports = router;
