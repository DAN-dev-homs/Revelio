// ============================================================
// REVELIO — SPA Router & App Shell (app.js)
// ============================================================

const App = (() => {
  const PAGES = ['home', 'explore', 'community', 'profile', 'book-detail'];
  let currentPage = 'home';
  let currentParams = {};
  let selectedImageUrl = null;

  /** Initialise l'application */
  async function init() {
    await i18n.load();

    // Vérifier authentification
    if (!api.getToken()) {
      showLoginScreen();
      return;
    }

    buildShell();
    NotificationPanel.init();
    NotificationPanel.startAutoRefresh();
    await navigateTo('home');

    // Écouter les changements de langue
    window.addEventListener('langChanged', () => {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      loadPage(currentPage, currentParams);
    });
  }

  /** Construit le shell de l'app (nav + conteneurs de pages) */
  function buildShell() {
    document.getElementById('app').innerHTML = `
      <main id="pages-container">
        ${PAGES.map(p => `<section class="page" id="page-${p}" role="main"></section>`).join('')}
      </main>
      ${buildBottomNav()}
      ${buildPostModal()}
    `;
    bindNavEvents();
  }

  /** Barre de navigation bottom */
  function buildBottomNav() {
    return `
    <nav class="bottom-nav" role="navigation" aria-label="Navigation principale">
      ${[
        { id: 'home',      icon: iconHome(),      key: 'nav.home'      },
        { id: 'explore',   icon: iconExplore(),   key: 'nav.explore'   },
        { id: 'community', icon: iconCommunity(), key: 'nav.community' },
        { id: 'profile',   icon: iconProfile(),   key: 'nav.profile'   },
      ].map(item => `
        <button class="nav-item tap-feedback" id="nav-${item.id}"
          aria-label="${i18n.t(item.key)}" data-page="${item.id}">
          ${item.icon}
          <span data-i18n="${item.key}">${i18n.t(item.key)}</span>
        </button>
      `).join('')}
    </nav>`;
  }

  /** Modal pour créer un post */
  function buildPostModal() {
    return `
    <div class="overlay" id="post-overlay" role="dialog" aria-modal="true">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <h3 class="modal-title" data-i18n="community.modal_title">${i18n.t('community.modal_title')}</h3>
        <div class="modal-type-selector">
          <button class="modal-type-btn active" data-type="testimony" id="type-testimony"
            data-i18n="community.testimony">${i18n.t('community.testimony')}</button>
          <button class="modal-type-btn" data-type="thought" id="type-thought"
            data-i18n="community.thought">${i18n.t('community.thought')}</button>
        </div>
        <textarea class="modal-textarea" id="post-content" maxlength="1000"
          data-i18n-placeholder="community.share_placeholder"
          placeholder="${i18n.t('community.share_placeholder')}"></textarea>
        
        <!-- Image preview -->
        <div id="post-image-preview" style="display:none; margin: 12px 0; border-radius: var(--border-radius-md); overflow: hidden; max-height: 200px;">
          <img id="post-image-img" src="" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">
          <button id="remove-image-btn" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 18px;">×</button>
        </div>

        <!-- Upload button -->
        <label style="display: block; margin-bottom: 12px; cursor: pointer;">
          <input type="file" id="post-image-input" accept="image/*" style="display: none;">
          <div style="border: 2px dashed var(--border-color); border-radius: var(--border-radius-md); padding: 12px; text-align: center; color: var(--text-secondary); font-size: 13px;">
            📸 Cliquez pour ajouter une image
          </div>
        </label>

        <button class="btn-primary" id="publish-btn" data-i18n="community.publish">
          ${i18n.t('community.publish')}
        </button>
      </div>
    </div>`;
  }

  /** Lie les événements de navigation */
  function bindNavEvents() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // Fermer modal au clic sur l'overlay
    document.getElementById('post-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'post-overlay') closePostModal();
    });

    // Sélection du type de post
    document.querySelectorAll('.modal-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Upload d'image
    const imageInput = document.getElementById('post-image-input');
    if (imageInput) {
      imageInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const publishBtn = document.getElementById('publish-btn');
        publishBtn.disabled = true;
        publishBtn.textContent = '⏳ Upload...';

        try {
          const result = await api.uploadPostImage(file);
          selectedImageUrl = result.image_url;
          
          // Afficher l'aperçu
          const preview = document.getElementById('post-image-preview');
          const img = document.getElementById('post-image-img');
          img.src = selectedImageUrl;
          preview.style.display = 'block';
          preview.style.position = 'relative';
        } catch (err) {
          alert('Erreur lors de l\'upload: ' + err.message);
          imageInput.value = '';
        } finally {
          publishBtn.disabled = false;
          publishBtn.textContent = i18n.t('community.publish');
        }
      });
    }

    // Supprimer l'image
    const removeBtn = document.getElementById('remove-image-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedImageUrl = null;
        document.getElementById('post-image-preview').style.display = 'none';
        imageInput.value = '';
      });
    }

    // Publier un post
    document.getElementById('publish-btn')?.addEventListener('click', submitPost);
  }

  /** Navigation vers une page */
  async function navigateTo(page, params = {}) {
    if (!PAGES.includes(page)) page = 'home';
    currentPage = page;
    currentParams = params;

    // Mettre à jour la nav
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page);
    });

    // Masquer toutes les pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    await loadPage(page, params);
  }

  /** Charge et affiche une page */
  async function loadPage(page, params) {
    const el = document.getElementById(`page-${page}`);
    if (!el) return;

    el.innerHTML = `<div class="flex items-center justify-center" style="min-height:60vh">
      <div class="spinner"></div></div>`;
    el.classList.add('active');

    try {
      switch (page) {
        case 'home':        await HomePage.render(el);      break;
        case 'explore':     await ExplorePage.render(el);   break;
        case 'community':   await CommunityPage.render(el); break;
        case 'profile':     await ProfilePage.render(el);   break;
        case 'book-detail': await BookDetailPage.render(el, params.id); break;
      }
    } catch (err) {
      el.innerHTML = `<div class="empty-state">
        <p data-i18n="common.error">${i18n.t('common.error')}</p>
        <button class="btn-primary" style="margin-top:16px" onclick="App.navigateTo('${page}')">
          ${i18n.t('common.retry')}
        </button>
      </div>`;
    }
  }

  /** Ouvre le modal de post */
  function openPostModal() {
    const overlay = document.getElementById('post-overlay');
    overlay?.classList.add('active');
    document.getElementById('post-content')?.focus();
  }

  /** Ferme le modal de post */
  function closePostModal() {
    document.getElementById('post-overlay')?.classList.remove('active');
    const ta = document.getElementById('post-content');
    if (ta) ta.value = '';
    selectedImageUrl = null;
    document.getElementById('post-image-preview').style.display = 'none';
    document.getElementById('post-image-input').value = '';
  }

  /** Soumet un nouveau post */
  async function submitPost() {
    const content = document.getElementById('post-content')?.value?.trim();
    const type = document.querySelector('.modal-type-btn.active')?.dataset.type || 'thought';
    if (!content) return;

    const btn = document.getElementById('publish-btn');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      await api.createPost(type, content, selectedImageUrl);
      closePostModal();
      await navigateTo('community');
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = i18n.t('community.publish');
    }
  }

  /** Écran de login/register */
  function showLoginScreen() {
    document.getElementById('app').innerHTML = `
      <div class="page active" style="display:flex;flex-direction:column;justify-content:center;min-height:100vh;padding:32px 24px;">
        <div style="text-align:center;margin-bottom:36px;">
          <img src="/assets/images/revelio-logo.png" alt="Revelio"
            style="width:88px;height:88px;object-fit:contain;margin:0 auto 12px;">
          <h1 style="font-size:28px;font-weight:700;margin-bottom:6px;">Revelio</h1>
          <p style="color:var(--text-secondary);font-size:14px;">Votre parcours spirituel commence ici</p>
        </div>

        <!-- Onglets -->
        <div style="display:flex;background:var(--bg-surface);border-radius:12px;padding:4px;margin-bottom:24px;">
          <button id="tab-login" onclick="App.switchAuthTab('login')"
            style="flex:1;padding:10px;border-radius:10px;font-weight:600;font-size:14px;background:var(--accent-red);color:white;border:none;cursor:pointer;transition:all .2s;">
            Se connecter
          </button>
          <button id="tab-register" onclick="App.switchAuthTab('register')"
            style="flex:1;padding:10px;border-radius:10px;font-weight:600;font-size:14px;background:transparent;color:var(--text-secondary);border:none;cursor:pointer;transition:all .2s;">
            Créer un compte
          </button>
        </div>

        <!-- Formulaire Connexion -->
        <div id="form-login" style="display:flex;flex-direction:column;gap:12px;">
          <div class="search-input-wrapper">
            <input class="search-input" id="login-email" type="email" placeholder="Email" style="padding-left:16px;">
          </div>
          <div class="search-input-wrapper">
            <input class="search-input" id="login-password" type="password" placeholder="Mot de passe" style="padding-left:16px;">
          </div>
          <p id="login-error" style="color:var(--accent-red);font-size:13px;text-align:center;min-height:18px;"></p>
          <button class="btn-primary" id="login-btn">Se connecter</button>
          <p style="text-align:center;color:var(--text-muted);font-size:12px;">
            Compte démo&nbsp;: sarah.m@example.com / password123
          </p>
        </div>

        <!-- Formulaire Inscription -->
        <div id="form-register" style="display:none;flex-direction:column;gap:12px;">
          <div class="search-input-wrapper">
            <input class="search-input" id="reg-name" type="text" placeholder="Votre nom complet" style="padding-left:16px;">
          </div>
          <div class="search-input-wrapper">
            <input class="search-input" id="reg-email" type="email" placeholder="Email" style="padding-left:16px;">
          </div>
          <div class="search-input-wrapper">
            <input class="search-input" id="reg-password" type="password" placeholder="Mot de passe (min. 6 caractères)" style="padding-left:16px;">
          </div>
          <div class="search-input-wrapper">
            <input class="search-input" id="reg-confirm" type="password" placeholder="Confirmer le mot de passe" style="padding-left:16px;">
          </div>
          <p id="reg-error" style="color:var(--accent-red);font-size:13px;text-align:center;min-height:18px;"></p>
          <button class="btn-primary" id="reg-btn">Créer mon compte</button>
        </div>
      </div>`;

    // ---- Login ----
    document.getElementById('login-btn').addEventListener('click', async () => {
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const errEl    = document.getElementById('login-error');
      if (!email || !password) { errEl.textContent = 'Veuillez remplir tous les champs'; return; }
      errEl.textContent = '';
      const btn = document.getElementById('login-btn');
      btn.textContent = '...'; btn.disabled = true;
      try {
        const data = await api.login(email, password);
        if (!data) return;
        api.setToken(data.token);
        localStorage.setItem('revelio_user', JSON.stringify(data.user));
        buildShell();
        NotificationPanel.init();
        NotificationPanel.startAutoRefresh();
        await navigateTo('home');
      } catch (err) {
        errEl.textContent = err.message;
        btn.textContent = 'Se connecter'; btn.disabled = false;
      }
    });
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('login-btn').click();
    });

    // ---- Register ----
    document.getElementById('reg-btn').addEventListener('click', async () => {
      const name     = document.getElementById('reg-name').value.trim();
      const email    = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirm  = document.getElementById('reg-confirm').value;
      const errEl    = document.getElementById('reg-error');
      if (!name || !email || !password)  { errEl.textContent = 'Tous les champs sont requis'; return; }
      if (password.length < 6)           { errEl.textContent = 'Le mot de passe doit faire au moins 6 caractères'; return; }
      if (password !== confirm)          { errEl.textContent = 'Les mots de passe ne correspondent pas'; return; }
      errEl.textContent = '';
      const btn = document.getElementById('reg-btn');
      btn.textContent = '...'; btn.disabled = true;
      try {
        const data = await api.register(name, email, password);
        if (!data) return;
        api.setToken(data.token);
        localStorage.setItem('revelio_user', JSON.stringify(data.user));
        buildShell();
        NotificationPanel.init();
        NotificationPanel.startAutoRefresh();
        await navigateTo('home');
      } catch (err) {
        errEl.textContent = err.message;
        btn.textContent = 'Créer mon compte'; btn.disabled = false;
      }
    });
  }

  /** Switcher onglets login/register */
  function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('form-login').style.display    = isLogin ? 'flex' : 'none';
    document.getElementById('form-register').style.display = isLogin ? 'none' : 'flex';
    document.getElementById('tab-login').style.background    = isLogin ? 'var(--accent-red)' : 'transparent';
    document.getElementById('tab-login').style.color         = isLogin ? 'white' : 'var(--text-secondary)';
    document.getElementById('tab-register').style.background = isLogin ? 'transparent' : 'var(--accent-red)';
    document.getElementById('tab-register').style.color      = isLogin ? 'var(--text-secondary)' : 'white';
  }

  // ── Icônes SVG ──────────────────────────────────────────
  function iconHome()      { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>`; }
  function iconExplore()   { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5L16 8l-2.5 6.5L8 16l1.5-4.5z"/></svg>`; }
  function iconCommunity() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`; }
  function iconProfile()   { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`; }
  function iconSettings()  { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`; }

  // Exposer certaines fonctions globalement
  return { init, navigateTo, openPostModal, closePostModal, switchAuthTab };
})();

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());
