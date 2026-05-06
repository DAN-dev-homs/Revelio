// ============================================================
// REVELIO — Profile Screen (profile.js)
// ============================================================

const ProfilePage = (() => {
  let isSettingsView = false;
  let cachedProfile = null;
  let cachedSavedBooks = [];
  let cachedPostsHistory = [];

  async function render(container) {
    console.log('👤 Début chargement profil...');
    try {
      console.log('🔄 Appel des APIs...');
      
      // Test individuel des APIs pour un meilleur debugging
      let profile, savedBooks, postsHistory;
      
      try {
        console.log('🔍 Test API getProfile...');
        profile = await api.getProfile();
        console.log('✅ Profil reçu:', profile);
      } catch (e) {
        console.error('❌ Erreur getProfile:', e);
        throw new Error('Erreur profil: ' + e.message);
      }
      
      try {
        console.log('🔍 Test API getSavedBooks...');
        savedBooks = await api.getSavedBooks();
        console.log('📚 Livres sauvegardés reçus:', savedBooks);
      } catch (e) {
        console.error('❌ Erreur getSavedBooks:', e);
        savedBooks = [];
      }
      
      try {
        console.log('🔍 Test API getPostsHistory...');
        postsHistory = await api.getPostsHistory();
        console.log('📝 Posts historique reçus:', postsHistory);
      } catch (e) {
        console.error('❌ Erreur getPostsHistory:', e);
        postsHistory = [];
      }
      
      console.log('🎯 Données chargées, mise en cache...');
      cachedProfile = profile;
      cachedSavedBooks = savedBooks;
      cachedPostsHistory = postsHistory;
      
      console.log('🎨 Début rendu HTML...');
      renderCurrentView(container);
      console.log('✅ Rendu terminé');
      
    } catch (error) {
      console.error('💥 Erreur globale chargement profil:', error);
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
          <h3 style="margin-bottom: 8px;">Erreur de chargement</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">Une erreur est survenue lors du chargement du profil.</p>
          <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 16px;">Détail: ${error.message}</p>
          <button onclick="location.reload()" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">Réessayer</button>
        </div>
      `;
    }
  }

  function renderCurrentView(container) {
    if (isSettingsView) {
      container.innerHTML = buildSettingsPage(cachedProfile);
      bindSettingsEvents(container);
      return;
    }
    container.innerHTML = buildProfilePage(cachedProfile, cachedSavedBooks, cachedPostsHistory);
    bindProfileEvents(container);
  }

  function buildProfilePage(profile, savedBooks, postsHistory) {
    return `
      <header class="page-header">
        <h1 class="page-title" data-i18n="profile.title">${i18n.t('profile.title')}</h1>
        <button class="icon-btn tap-feedback" id="settings-btn" aria-label="${i18n.t('profile.settings')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </header>

      <!-- Carte profil -->
      <div class="profile-header-card hover-lift">
        <div class="profile-avatar tap-feedback" id="avatar-upload-btn" style="cursor:pointer; position:relative; overflow:hidden;">
          ${profile.avatar_url 
            ? `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>`}
          <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.5); font-size:9px; text-align:center; padding:2px 0; color:white;">Edit</div>
        </div>
        <input type="file" id="avatar-input" accept="image/*" style="display:none;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="profile-name">${profile.name}</div>
            ${profile.badge ? `
              <span class="profile-badge-icon" style="
                font-size: 20px;
                ${profile.badge === 'bronze' ? 'color: #CD7F32;' : ''}
                ${profile.badge === 'silver' ? 'color: #C0C0C0;' : ''}
                ${profile.badge === 'gold' ? 'color: #FFD700;' : ''}
                ${profile.badge === 'diamond' ? 'color: #00CED1;' : ''}
              " title="${profile.badge.charAt(0).toUpperCase() + profile.badge.slice(1)} badge">
                ${profile.badge === 'bronze' ? '🥉' : ''}
                ${profile.badge === 'silver' ? '🥈' : ''}
                ${profile.badge === 'gold' ? '🥇' : ''}
                ${profile.badge === 'diamond' ? '💎' : ''}
              </span>
            ` : ''}
          </div>
          <div class="profile-email">${profile.email}</div>
        </div>
        ${profile.church ? `
          <div style="margin-top: 8px; padding: 8px 12px; background: var(--surface2); border-radius: 8px; border-left: 3px solid var(--primary);">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Église</div>
            <div style="font-weight: 500; color: var(--primary);">${profile.church}</div>
          </div>
        ` : ''}
      </div>

      <!-- Stats -->
      <div class="flex gap-md stagger-children" style="margin-bottom:var(--spacing-2xl)">
        <div class="stat-card">
          <div class="stat-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            </svg>
          </div>
          <div class="stat-value">${profile.books_completed}</div>
          <div class="stat-label" data-i18n="profile.books_completed">${i18n.t('profile.books_completed')}</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <div class="stat-value">${Math.round(profile.total_hours)}</div>
          <div class="stat-label" data-i18n="profile.hours_spent">${i18n.t('profile.hours_spent')}</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div class="stat-value">${profile.streak_days}</div>
          <div class="stat-label" data-i18n="profile.current_streak">${i18n.t('profile.current_streak')}</div>
        </div>
      </div>

      <!-- Livres sauvegardés -->
      <h2 class="section-title" data-i18n="profile.saved_books">${i18n.t('profile.saved_books')}</h2>
      ${savedBooks.length > 0 ? `
        <div class="h-scroll stagger-children" style="margin-bottom:var(--spacing-2xl)">
          ${savedBooks.map(b => `
          <div class="saved-book-card" style="display:flex; align-items:center; gap:12px; padding:12px; background:var(--bg-surface-2); border-radius:12px; margin-bottom:8px; position: relative;">
            <button class="delete-saved-book-btn" data-book-id="${b.id}" style="
              position: absolute;
              top: 8px;
              right: 8px;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              cursor: pointer;
              font-size: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
            " title="Supprimer des livres sauvegardés">×</button>
            <div style="width:40px; height:56px; background:${b.cover_color}; border-radius:4px; display:flex; align-items:center; justify-content:center; color:white; font-size:10px; font-weight:600;">${b.title.substring(0,2).toUpperCase()}</div>
            <div style="flex:1;">
              <div style="font-weight:600; font-size:14px; margin-bottom:2px;">${b.title}</div>
              <div style="font-size:12px; color:var(--text-secondary);">${b.author} • ${b.category}</div>
            </div>
          </div>
        `).join('')}
        </div>` : `
        <div class="empty-state" style="margin-bottom:var(--spacing-2xl)">
          <p>Aucun livre sauvegardé</p>
        </div>`
      }

      <!-- Bouton déconnexion -->
      <h2 class="section-title">Historique de mes posts</h2>
      <div style="max-height: 280px; overflow-y: auto; padding-right: 4px; margin-bottom: var(--spacing-xl);">
        ${postsHistory.length > 0 ? postsHistory.map(post => `
          <article class="post-card" style="margin-bottom:12px; position: relative;">
            <button class="delete-post-btn" data-post-id="${post.id}" style="
              position: absolute;
              top: 8px;
              right: 8px;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              cursor: pointer;
              font-size: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
            " title="Supprimer ce post">×</button>
            <div class="post-meta" style="margin-bottom:8px;">
              <span class="post-type-badge">${post.type === 'testimony' ? 'Témoignage' : 'Pensée'}</span>
              <span class="post-time">${new Date(post.created_at).toLocaleString('fr-FR')}</span>
            </div>
            <p class="post-content">${post.content}</p>
            <div class="post-actions">
              <span style="font-size:12px;color:var(--text-secondary);">❤️ ${post.likes_count || 0}</span>
              <span style="font-size:12px;color:var(--text-secondary);">💬 ${post.comments_count || 0}</span>
            </div>
          </article>
        `).join('') : '<div class="empty-state"><p>Aucun post publié pour le moment.</p></div>'}
      </div>

      <button class="btn-primary" id="scroll-top-btn"
        style="background:var(--bg-surface-2);color:var(--text-secondary);margin-bottom:12px">
        Revenir en haut
      </button>

      <button class="btn-primary" id="logout-btn"
        style="background:var(--bg-surface-2);color:var(--text-secondary);margin-top:8px"
        data-i18n="profile.logout">${i18n.t('profile.logout')}</button>
        
    `;
  }

  function buildSettingsPage(profile) {
    return `
      <header class="page-header">
        <button class="icon-btn tap-feedback" id="back-to-profile-btn" aria-label="Retour au profil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 class="page-title">Paramètres</h1>
        <div style="width:36px;height:36px;"></div>
      </header>

      <div class="profile-header-card" style="display:block;">
        <div style="margin-bottom: 16px;">
          <label style="display:block; font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Nom complet</label>
          <input type="text" id="edit-name" value="${profile.name}" class="search-input" style="width: 100%; border: 1px solid var(--border-color); border-radius: 8px; padding-left: 16px;">
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display:block; font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Église</label>
          <input type="text" id="edit-church" value="${profile.church || ''}" class="search-input" style="width: 100%; border: 1px solid var(--border-color); border-radius: 8px; padding-left: 16px;" placeholder="Nom de votre église">
        </div>
        
        <div style="margin-bottom: 24px;">
          <label style="display:block; font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Email (lecture seule)</label>
          <input type="email" value="${profile.email}" disabled class="search-input" style="width: 100%; opacity: 0.6; border: 1px solid var(--border-color); border-radius: 8px; padding-left: 16px;">
        </div>

        <div style="margin-bottom: 10px;">
          <label style="display:block; font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Mot de passe actuel</label>
          <input type="password" id="current-password" class="search-input" style="width: 100%; border: 1px solid var(--border-color); border-radius: 8px; padding-left: 16px;">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display:block; font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Nouveau mot de passe</label>
          <input type="password" id="new-password" class="search-input" style="width: 100%; border: 1px solid var(--border-color); border-radius: 8px; padding-left: 16px;">
        </div>
        
        <button class="btn-primary" id="save-profile-btn">Enregistrer les modifications</button>
      </div>
    `;
  }

  function bindProfileEvents(container) {
    container.querySelector('#logout-btn').addEventListener('click', () => {
      api.clearToken();
      localStorage.removeItem('revelio_user');
      window.location.reload();
    });
    container.querySelector('#scroll-top-btn').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const uploadBtn = container.querySelector('#avatar-upload-btn');
    const fileInput = container.querySelector('#avatar-input');
    
    uploadBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const res = await api.uploadAvatar(file);
        
        // Update localStorage
        const user = JSON.parse(localStorage.getItem('revelio_user') || '{}');
        user.avatar_url = res.avatar_url;
        localStorage.setItem('revelio_user', JSON.stringify(user));
        
        // Update UI
        uploadBtn.innerHTML = `
          <img src="${res.avatar_url}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">
          <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.5); font-size:9px; text-align:center; padding:2px 0; color:white;">Edit</div>
        `;
      } catch (err) {
        alert("Upload failed: " + err.message);
      }
    });

    const settingsBtn = container.querySelector('#settings-btn');
    
    settingsBtn.addEventListener('click', () => {
      isSettingsView = true;
      renderCurrentView(container);
    });

    // Delete post buttons
    container.querySelectorAll('.delete-post-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const postId = btn.dataset.postId;
        if (confirm('Êtes-vous sûr de vouloir supprimer ce post ?')) {
          try {
            await api.deletePost(postId);
            // Recharger les posts
            const postsHistory = await api.getPostsHistory();
            cachedPostsHistory = postsHistory;
            renderCurrentView(container);
          } catch (error) {
            console.error('Failed to delete post:', error);
            alert('Erreur lors de la suppression du post');
          }
        }
      });
    });

    // Delete saved book buttons
    container.querySelectorAll('.delete-saved-book-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const bookId = btn.dataset.bookId;
        if (confirm('Êtes-vous sûr de vouloir supprimer ce livre sauvegardé ?')) {
          try {
            await api.deleteSaveBook(bookId);
            // Recharger les livres sauvegardés
            const savedBooks = await api.getSavedBooks();
            cachedSavedBooks = savedBooks;
            renderCurrentView(container);
          } catch (error) {
            console.error('Failed to unsave book:', error);
            alert('Erreur lors de la suppression du livre sauvegardé');
          }
        }
      });
    });
  }

  function bindSettingsEvents(container) {
    container.querySelector('#back-to-profile-btn').addEventListener('click', () => {
      isSettingsView = false;
      renderCurrentView(container);
    });

    container.querySelector('#save-profile-btn').addEventListener('click', async () => {
      const newName = container.querySelector('#edit-name').value.trim();
      const newChurch = container.querySelector('#edit-church').value.trim();
      const currentPassword = container.querySelector('#current-password').value;
      const newPassword = container.querySelector('#new-password').value;
      if (!newName) return;
      
      const btn = container.querySelector('#save-profile-btn');
      btn.textContent = '...';
      
      try {
        await api.updateProfile(newName, newChurch);
        if (currentPassword || newPassword) {
          if (!currentPassword || !newPassword) {
            throw new Error('Veuillez renseigner le mot de passe actuel et le nouveau mot de passe.');
          }
          await api.updatePassword(currentPassword, newPassword);
          container.querySelector('#current-password').value = '';
          container.querySelector('#new-password').value = '';
        }
        
        // Mettre à jour localstorage
        const user = JSON.parse(localStorage.getItem('revelio_user') || '{}');
        user.name = newName;
        user.church = newChurch;
        localStorage.setItem('revelio_user', JSON.stringify(user));
        cachedProfile.name = newName;
        cachedProfile.church = newChurch;
        
        isSettingsView = false;
        renderCurrentView(container);
      } catch (err) {
        alert('Erreur: ' + err.message);
      } finally {
        btn.textContent = 'Enregistrer les modifications';
      }
    });
  }

  return { render };
})();

window.ProfilePage = ProfilePage;
