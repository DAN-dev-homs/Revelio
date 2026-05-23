// ============================================================
// REVELIO — Share routes (Open Graph previews for social apps)
// ============================================================
const router = require('express').Router();

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text, max = 200) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function getBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  return `${req.protocol}://${req.get('host')}`;
}

function absoluteAsset(base, url) {
  if (!url) return `${base}/assets/images/icon-192.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function buildShareHtml({ title, description, image, canonicalUrl, redirectUrl }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(canonicalUrl);
  const safeRedirect = escapeHtml(redirectUrl);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">
  <link rel="canonical" href="${safeUrl}">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Revelio">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:locale" content="fr_FR">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImage}">

  <meta http-equiv="refresh" content="0;url=${safeRedirect}">
  <style>
    body { margin:0; font-family: system-ui, sans-serif; background:#0a0a0b; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; }
    .card { max-width:420px; background:#1a1a1e; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,.08); box-shadow:0 16px 40px rgba(0,0,0,.5); }
    .card img { width:100%; aspect-ratio:16/9; object-fit:cover; display:block; background:#232328; }
    .card .body { padding:20px; }
    h1 { font-size:20px; margin:0 0 8px; line-height:1.3; }
    p { margin:0 0 16px; color:#9ca3af; font-size:14px; line-height:1.5; }
    a { display:inline-block; background:#e53935; color:#fff; text-decoration:none; padding:12px 20px; border-radius:999px; font-weight:600; font-size:14px; }
  </style>
</head>
<body>
  <div class="card">
    <img src="${safeImage}" alt="">
    <div class="body">
      <h1>${safeTitle}</h1>
      <p>${safeDesc}</p>
      <a href="${safeRedirect}">Ouvrir dans Revelio</a>
    </div>
  </div>
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`;
}

router.get('/enseignement/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const book = await req.db.prepare(
      'SELECT id, title, author, summary, cover_url, thumbnail_url FROM books WHERE id = ?'
    ).get(id);

    if (!book) return res.status(404).send('Enseignement introuvable');

    const base = getBaseUrl(req);
    const canonicalUrl = `${base}/s/enseignement/${book.id}`;
    const redirectUrl = `${base}/?open=enseignement&id=${book.id}`;
    const title = `${book.title} — ${book.author}`;
    const description = truncate(book.summary || `Découvrez cet enseignement chrétien sur Revelio.`);
    const image = absoluteAsset(base, book.thumbnail_url || book.cover_url);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildShareHtml({ title, description, image, canonicalUrl, redirectUrl }));
  } catch (e) {
    console.error('Share enseignement error:', e);
    res.status(500).send('Erreur serveur');
  }
});

router.get('/post/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const post = await req.db.prepare(`
      SELECT p.id, p.content, p.type, p.image_url, p.created_at, u.name AS author_name
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
    `).get(id);

    if (!post) return res.status(404).send('Publication introuvable');

    const base = getBaseUrl(req);
    const canonicalUrl = `${base}/s/post/${post.id}`;
    const redirectUrl = `${base}/?open=post&id=${post.id}`;
    const typeLabel = post.type === 'testimony' ? 'Témoignage' : 'Réflexion';
    const title = `${typeLabel} de ${post.author_name} — Revelio`;
    const description = truncate(post.content || 'Publication sur la communauté Revelio.');
    const image = absoluteAsset(base, post.image_url);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildShareHtml({ title, description, image, canonicalUrl, redirectUrl }));
  } catch (e) {
    console.error('Share post error:', e);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
