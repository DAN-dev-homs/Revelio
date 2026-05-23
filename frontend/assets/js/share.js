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

  function showToast(message, isError = false) {
    let el = document.getElementById('share-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'share-toast';
      el.style.cssText = `
        position: fixed; left: 50%; bottom: calc(var(--nav-height, 68px) + 16px);
        transform: translateX(-50%) translateY(120%);
        background: #1a1a1e; color: #fff; padding: 12px 20px;
        border-radius: 999px; font-size: 14px; font-weight: 600; z-index: 10000;
        box-shadow: 0 8px 24px rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.1);
        transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        max-width: min(90vw, 360px); text-align: center; pointer-events: none;
      `;
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.background = isError ? '#b91c1c' : '#1a1a1e';
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.style.transform = 'translateX(-50%) translateY(120%)';
    }, 2800);
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
