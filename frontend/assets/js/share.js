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

  const TOAST_VISIBLE_MS = 2500;

  function getToastEl() {
    let el = document.getElementById('share-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'share-toast';
      el.className = 'share-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  function hideToast(el) {
    el.classList.remove('is-visible');
    clearTimeout(el._removeTimer);
    el._removeTimer = setTimeout(() => {
      if (!el.classList.contains('is-visible')) {
        el.textContent = '';
      }
    }, 350);
  }

  function showToast(message, isError = false) {
    const el = getToastEl();
    el.textContent = message;
    el.classList.toggle('is-error', isError);

    clearTimeout(el._hideTimer);
    clearTimeout(el._removeTimer);
    el.classList.remove('is-visible');

    // Reflow pour relancer l’animation si le toast est réaffiché rapidement
    void el.offsetWidth;

    requestAnimationFrame(() => {
      el.classList.add('is-visible');
    });

    el._hideTimer = setTimeout(() => hideToast(el), TOAST_VISIBLE_MS);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) { /* fallback below */ }
    }

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  async function shareLink({ title, text, url }) {
    const payload = { title: title || 'Revelio', text: text || '', url };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        showToast('Partagé avec succès');
        return { method: 'native' };
      } catch (e) {
        if (e.name === 'AbortError') return { method: 'cancelled' };
      }
    }

    const copied = await copyToClipboard(url);
    if (copied) {
      showToast('Lien copié ! Collez-le pour partager.');
      return { method: 'clipboard' };
    }

    showToast('Copie impossible — copiez le lien manuellement', true);
    prompt('Copiez ce lien :', url);
    return { method: 'manual' };
  }

  async function shareBook(book) {
    if (!book?.id) throw new Error('Enseignement invalide');
    return shareLink({
      title: book.title,
      text: `Découvre « ${book.title} » par ${book.author} sur Revelio`,
      url: bookUrl(book.id)
    });
  }

  async function sharePost(post) {
    if (!post?.id) throw new Error('Publication invalide');
    const preview = String(post.content || '').slice(0, 80);
    return shareLink({
      title: `Publication de ${post.author_name || 'Revelio'}`,
      text: preview ? `${preview}…` : 'Publication sur Revelio',
      url: postUrl(post.id)
    });
  }

  return { bookUrl, postUrl, shareLink, shareBook, sharePost, showToast };
})();

window.Share = Share;
