// ============================================================
// REVELIO — About Routes (routes/about.js)
// ============================================================
const router = require('express').Router();

// GET /api/about/stats — Obtenir les statistiques pour la page about
router.get('/stats', async (req, res) => {
  try {
    const db = req.db;

    // Nombre total d'utilisateurs
    const totalUsers = (await db.prepare('SELECT COUNT(*) as count FROM users').get()).count;

    // Nombre total de livres
    const totalBooks = (await db.prepare('SELECT COUNT(*) as count FROM books').get()).count;

    res.json({
      users: totalUsers,
      books: totalBooks
    });
  } catch (e) {
    console.error('Error fetching about stats:', e);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/about/team — Obtenir les membres de l'équipe
router.get('/team', async (req, res) => {
  try {
    const db = req.db;
    const team = await db.prepare('SELECT * FROM team_members ORDER BY order_index ASC').all();
    res.json(team);
  } catch (e) {
    console.error('Error fetching team:', e);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// GET /api/about/partners — Obtenir les partenaires
router.get('/partners', async (req, res) => {
  try {
    const db = req.db;
    const partners = await db.prepare('SELECT * FROM partners ORDER BY order_index ASC').all();
    res.json(partners);
  } catch (e) {
    console.error('Error fetching partners:', e);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

// POST /api/about/contact — Envoyer un message de contact
router.post('/contact', async (req, res) => {
  try {
    const db = req.db;
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    await db.prepare(
      'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)'
    ).run(name, email, message);

    res.json({ success: true });
  } catch (e) {
    console.error('Error sending contact message:', e);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
