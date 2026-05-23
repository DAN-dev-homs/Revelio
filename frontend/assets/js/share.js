// ============================================================
// REVELIO — Share helper (share.js)
// ============================================================

const Share = (() => {
  function baseUrl() {
    return window.location.origin.replace(/\/$/, '');
  }

  function bookUrl(bookId) {
    return `${baseUrl()}/s/enseignement/${bookId}`;
  }

  function postUrl(postId) {
    return `${baseUrl()}/s/post/${postId}`;
  }

  async function shareLink({ title, text, url }) {
    const payload = { title: title || 'Revelio', text: text || '', url };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        return { method: 'native' };
      } catch (e) {
        if (e.name === 'AbortError') return { method: 'cancelled' };
      }
    }

    await navigator.clipboard.writeText(url);
    return { method: 'clipboard' };
  }

  async function shareBook(book) {
    const url = bookUrl(book.id);
    const result = await shareLink({
      title: book.title,
      text: `Découvre « ${book.title} » par ${book.author} sur Revelio`,
      url
    });
    return result;
  }

  async function sharePost(post) {
    const url = postUrl(post.id);
    const preview = String(post.content || '').slice(0, 80);
    const result = await shareLink({
      title: `Publication de ${post.author_name}`,
      text: preview ? `${preview}…` : 'Publication sur Revelio',
      url
    });
    return result;
  }

  function notifyShareResult(result) {
    if (result.method === 'clipboard') {
      alert('Lien copié ! Collez-le pour partager.');
    } else if (result.method === 'cancelled') {
      /* noop */
    }
  }

  return { bookUrl, postUrl, shareLink, shareBook, sharePost, notifyShareResult };
})();

window.Share = Share;
