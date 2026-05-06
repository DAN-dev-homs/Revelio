// ============================================================
// REVELIO — Public Profile Screen (public_profile.js)
// ============================================================

const PublicProfilePage = (() => {
  let cachedProfile = null;
  let cachedPosts = [];

  async function render(container, userId) {
    console.log('👤 Début chargement profil public:', userId);
    
    try {
      // Récupérer les données du profil utilisateur
      const userProfile = await api.getUserProfile(userId);
      console.log('✅ Profil utilisateur reçu:', userProfile);
      
      cachedProfile = userProfile;
      
      // Utiliser les posts déjà récupérés dans userProfile
      const userPosts = userProfile.recent_posts || [];
      cachedPosts = userPosts;
      
      console.log('📊 Posts de l utilisateur:', userPosts.length);
      
      // Afficher le profil
      renderProfile(container);
      
    } catch (error) {
      console.error('❌ Erreur chargement profil public:', error);
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
          <h3 style="margin-bottom: 8px;">Profil introuvable</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">Ce profil n'existe pas ou n'est pas accessible.</p>
          <button onclick="window.location.hash = 'community'" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">Retour</button>
        </div>
      `;
    }
  }

  function renderProfile(container) {
    const profile = cachedProfile;
    const posts = cachedPosts;
    
    container.innerHTML = `
      <header class="page-header">
        <button class="icon-btn tap-feedback" onclick="window.location.hash = 'community'" aria-label="Retour">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 class="page-title">Profil de ${profile.name}</h1>
        <div style="width:36px;height:36px;"></div>
      </header>

      <!-- Carte profil -->
      <div class="profile-header-card hover-lift">
        <div class="profile-avatar" style="cursor: default;">
          ${profile.avatar_url 
            ? `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">` 
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>`}
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="profile-name">${profile.name}</div>
            ${profile.badge ? `
              <span class="profile-badge-icon" style="
                font-size: 24px;
                font-weight: bold;
                ${profile.badge === 'bronze' ? 'color: #CD7F32; text-shadow: 0 1px 2px rgba(205, 127, 50, 0.3);' : ''}
                ${profile.badge === 'silver' ? 'color: #C0C0C0; text-shadow: 0 1px 2px rgba(192, 192, 192, 0.3);' : ''}
                ${profile.badge === 'gold' ? 'color: #FFD700; text-shadow: 0 1px 2px rgba(255, 215, 0, 0.4);' : ''}
                ${profile.badge === 'diamond' ? 'color: #00CED1; text-shadow: 0 1px 2px rgba(0, 206, 209, 0.4);' : ''}
              " title="${profile.badge.charAt(0).toUpperCase() + profile.badge.slice(1)} badge">
                ${profile.badge === 'bronze' ? '🥉' : ''}
                ${profile.badge === 'silver' ? '🥈' : ''}
                ${profile.badge === 'gold' ? '🥇' : ''}
                ${profile.badge === 'diamond' ? '💎' : ''}
              </span>
            ` : ''}
          </div>
          <div class="profile-email" style="font-size: 12px; color: var(--text-secondary);">
            Membre depuis ${new Date(profile.created_at).toLocaleDateString('fr-FR')}
          </div>
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
          <div class="stat-value">${profile.books_completed || 0}</div>
          <div class="stat-label">Livres lus</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <div class="stat-value">${Math.round(profile.total_hours || 0)}</div>
          <div class="stat-label">Heures de lecture</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div class="stat-value">${profile.streak_days || 0}</div>
          <div class="stat-label">Jours consécutifs</div>
        </div>
      </div>

      <!-- Posts de l'utilisateur -->
      <h2 class="section-title">Posts de ${profile.name}</h2>
      <div style="max-height: 400px; overflow-y: auto; padding-right: 4px;">
        ${posts.length > 0 ? posts.map(post => `
          <article class="post-card" style="margin-bottom:16px;">
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
        `).join('') : `
          <div class="empty-state">
            <p>Aucun post publié pour le moment.</p>
          </div>
        `}
      </div>
    `;
  }

  return { render };
})();

window.PublicProfilePage = PublicProfilePage;
