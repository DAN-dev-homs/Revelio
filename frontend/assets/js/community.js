// ============================================================
// REVELIO — Community Screen (community.js)
// ============================================================

const CommunityPage = (() => {
  let activeTab = 'community';
  let posts     = [];

  async function render(container) {
    posts = await api.getPosts();
    container.innerHTML = buildLayout();
    renderFeed(container);
    bindEvents(container);
  }

  function buildLayout() {
    return `
      <div class="tab-bar">
        <button class="tab-item ${activeTab === 'today' ? 'active' : ''}" id="tab-today"
          data-i18n="community.tab_today">${i18n.t('community.tab_today')}</button>
        <button class="tab-item ${activeTab === 'community' ? 'active' : ''}" id="tab-community"
          data-i18n="community.tab_community">${i18n.t('community.tab_community')}</button>
      </div>

      <!-- Bouton partage -->
      <div class="add-post-bar tap-feedback" id="open-post-modal">
        <div class="add-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <span class="add-post-placeholder"
          data-i18n="community.share_placeholder">${i18n.t('community.share_placeholder')}</span>
      </div>

      <!-- Feed -->
      <div id="community-feed" class="flex flex-col gap-md stagger-children"></div>
    `;
  }

  function renderFeed(container) {
    const feed = container.querySelector('#community-feed');
    if (!feed) return;

    const filtered = activeTab === 'today'
      ? posts.filter(p => isToday(p.created_at))
      : posts;

    if (filtered.length === 0) {
      feed.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        <p>Aucun post pour l'instant</p>
      </div>`;
      return;
    }

    feed.innerHTML = filtered.map(post => renderPostCard(post)).join('');

    // Bind like buttons
    feed.querySelectorAll('.post-action-btn[data-post-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id  = parseInt(btn.dataset.postId);
        const res = await api.toggleLike(id);
        const post = posts.find(p => p.id === id);
        if (post) {
          post.is_liked = res.liked;
          post.likes_count = res.likes_count;
        }
        btn.classList.toggle('liked-active', res.liked);
        btn.querySelector('span').textContent = res.likes_count;
        btn.querySelector('svg').style.animation = 'heartPulse 0.5s ease';
        setTimeout(() => { btn.querySelector('svg').style.animation = ''; }, 500);
      });
    });

    // Bind comment buttons
    feed.querySelectorAll('.post-action-btn[data-comment-post-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        // Prevent click from bubbling up if post card has click handler
        e.stopPropagation();
        const id = parseInt(btn.dataset.commentPostId);
        const postCard = feed.querySelector(`#post-${id}`);
        let commentsSection = postCard.querySelector('.comments-section');
        
        if (commentsSection) {
          commentsSection.remove();
          return;
        }

        commentsSection = document.createElement('div');
        commentsSection.className = 'comments-section anim-fade-in';
        commentsSection.style.marginTop = '16px';
        commentsSection.style.borderTop = '1px solid var(--border-color)';
        commentsSection.style.paddingTop = '16px';
        commentsSection.innerHTML = `<div class="spinner" style="margin: 0 auto;"></div>`;
        postCard.appendChild(commentsSection);

        const comments = await api.getComments(id);
        const post = posts.find(p => p.id === id);
        
        const renderComments = () => {
          return comments.map(c => {
            const cAvatar = c.author_avatar 
              ? `<img src="${c.author_avatar}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
              : (c.author_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??');
            return `
              <div class="flex gap-sm" style="margin-bottom: 12px;">
                <div class="post-avatar" style="width:28px; height:28px; font-size:10px;">${cAvatar}</div>
                <div style="background: var(--bg-surface-2); padding: 8px 12px; border-radius: var(--border-radius-md); font-size: var(--font-sm); flex: 1;">
                  <div style="font-weight: var(--font-weight-semibold); margin-bottom: 4px;">${c.author_name}</div>
                  <div>${c.content}</div>
                </div>
              </div>
            `;
          }).join('');
        };

        const updateCommentsUI = () => {
          commentsSection.innerHTML = `
            <div class="comments-list" style="margin-bottom: 16px; max-height: 200px; overflow-y: auto; padding-right: 4px;">
              ${comments.length ? renderComments() : '<div class="text-secondary text-sm">Aucun commentaire pour le moment.</div>'}
            </div>
            <div class="flex gap-sm">
              <input type="text" class="search-input comment-input" placeholder="Ajouter un commentaire..." style="flex:1; padding: 8px 16px;">
              <button class="btn-primary submit-comment" style="width:auto; padding: 8px 16px;">Envoyer</button>
            </div>
          `;

          const submitBtn = commentsSection.querySelector('.submit-comment');
          const input = commentsSection.querySelector('.comment-input');

          submitBtn.addEventListener('click', async () => {
            const content = input.value.trim();
            if (!content) return;
            submitBtn.disabled = true;
            try {
              const newComment = await api.addComment(id, content);
              comments.push(newComment);
              if (post) post.comments_count++;
              btn.querySelector('span').textContent = post.comments_count;
              updateCommentsUI();
            } catch (err) {
              alert(err.message);
            }
          });
        };
        
        updateCommentsUI();
      });
    });
  }

  function renderPostCard(post) {
    const initials  = post.author_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??';
    const avatarHtml = post.author_avatar 
      ? `<img src="${post.author_avatar}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
      : initials;
    const timeLabel = formatTime(post.created_at);
    const typeLabel = post.type === 'testimony'
      ? i18n.t('community.testimony')
      : i18n.t('community.thought');

    return `
      <article class="post-card tap-feedback" id="post-${post.id}" style="cursor:default;">
        <div class="post-header">
          <div class="post-avatar">${avatarHtml}</div>
          <div>
            <div class="post-author-name">${post.author_name}</div>
            <div class="post-meta">
              <span class="post-type-badge">${typeLabel}</span>
              <span class="post-time">${timeLabel}</span>
            </div>
          </div>
        </div>
        <p class="post-content">${post.content}</p>
        ${post.image_url ? `<div class="post-image" style="margin-top:12px; border-radius:16px; overflow:hidden;
          background-image:url('${post.image_url}'); background-size:cover; background-position:center; height:220px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);"></div>` : ''}
        <div class="post-actions">
          <button class="post-action-btn ${post.is_liked ? 'liked-active' : ''}"
            data-post-id="${post.id}" aria-label="Like">
            <svg viewBox="0 0 24 24" fill="${post.is_liked ? 'currentColor' : 'none'}"
              stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            <span>${post.likes_count}</span>
          </button>
          <button class="post-action-btn" aria-label="Commentaires" data-comment-post-id="${post.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <span>${post.comments_count}</span>
          </button>
        </div>
      </article>`;
  }

  function bindEvents(container) {
    // Tabs
    container.querySelector('#tab-today').addEventListener('click', () => {
      activeTab = 'today';
      container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      container.querySelector('#tab-today').classList.add('active');
      renderFeed(container);
    });
    container.querySelector('#tab-community').addEventListener('click', () => {
      activeTab = 'community';
      container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      container.querySelector('#tab-community').classList.add('active');
      renderFeed(container);
    });

    // Ouvrir modal post
    container.querySelector('#open-post-modal').addEventListener('click', () => App.openPostModal());
  }

  function isToday(dateStr) {
    const d = new Date(dateStr);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() &&
           d.getMonth()    === n.getMonth()    &&
           d.getDate()     === n.getDate();
  }

  function formatTime(dateStr) {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 3600)   return `${Math.floor(diff / 60)}${i18n.t('common.ago_minutes')}`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}${i18n.t('common.ago_hours')}`;
    return `${Math.floor(diff / 86400)}${i18n.t('common.ago_days')}`;
  }

  return { render };
})();

window.CommunityPage = CommunityPage;
