// ============================================================
// REVELIO — Home Screen (home.js)
// ============================================================

const HomePage = (() => {

  async function render(container) {
    const user    = JSON.parse(localStorage.getItem('revelio_user') || '{}');
    const reading = await api.getReadingList().catch(() => []);
    const notifsData = await api.getNotifications().catch(() => ({ unreadCount: 0 }));
    const allBooks = await api.getBooks().catch(() => []); // Fetch suggestions

    const suggestions = [...allBooks].sort(() => 0.5 - Math.random()).slice(0, 5); // 5 suggestions aléatoires

    const firstName = user.name?.split(' ')[0] || 'Sarah';
    const streak    = user.streak_days || 0;
    const unreadCount = notifsData.unreadCount || 0;

    container.innerHTML = `
      <header class="page-header">
        <div>
          <h1>${i18n.t('home.welcome')}, ${firstName}</h1>
          <p class="text-secondary text-sm" style="margin-top:4px" data-i18n="home.subtitle">
            ${i18n.t('home.subtitle')}
          </p>
        </div>
        <div class="flex gap-sm items-center">
          <div class="notif-badge">
            <button class="icon-btn" id="notif-btn" aria-label="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </button>
            <span class="badge" style="display: ${unreadCount > 0 ? 'flex' : 'none'}">${unreadCount}</span>
          </div>
          <button class="lang-badge" id="lang-toggle" onclick="i18n.toggle()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
            </svg>
            ${i18n.getLang().toUpperCase()}
          </button>
        </div>
      </header>

      <!-- Recherche -->
      <div class="search-input-wrapper" style="margin-bottom:var(--spacing-xl)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input id="home-search" class="search-input" type="search"
          data-i18n-placeholder="home.search_placeholder"
          placeholder="${i18n.t('home.search_placeholder')}">
      </div>

      <!-- Streak Banner -->
      <div class="streak-banner hover-lift" style="margin-bottom:var(--spacing-2xl)"
        onclick="App.navigateTo('profile')">
        <div class="streak-text">
          <div class="streak-title">
            <span class="flame-icon">🔥</span>
            <span>${streak} ${i18n.t('home.streak_title')}</span>
          </div>
          <div class="streak-sub" data-i18n="home.streak_sub">${i18n.t('home.streak_sub')}</div>
        </div>
        <div class="streak-icon-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
            <polyline points="16 7 22 7 22 13"/>
          </svg>
        </div>
      </div>

      <!-- Catégories -->
      <h2 class="section-title" data-i18n="home.categories_title">${i18n.t('home.categories_title')}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-md);margin-bottom:var(--spacing-2xl)">
        ${['healing','faith','identity','discipline'].map(cat => `
          <button class="category-row-card tap-feedback"
            onclick="App.navigateTo('explore'); setTimeout(()=>ExplorePage.filterByCategory('${cat}'),300)">
            <span data-i18n="home.${cat}">${i18n.t('home.' + cat)}</span>
          </button>
        `).join('')}
      </div>

      <!-- Continue Reading -->
      ${reading && reading.length > 0 ? `
        <h2 class="section-title" data-i18n="home.continue_reading">${i18n.t('home.continue_reading')}</h2>
        <div class="flex flex-col gap-md stagger-children" style="margin-bottom:var(--spacing-2xl)">
          ${reading.slice(0, 3).map(book => renderContinueCard(book)).join('')}
        </div>
      ` : ''}

      <!-- Suggestions -->
      ${suggestions && suggestions.length > 0 ? `
        <h2 class="section-title">✨ Suggestions pour vous</h2>
        <div style="display:flex; overflow-x:auto; gap:var(--spacing-md); padding-bottom:var(--spacing-md); scroll-snap-type: x mandatory; margin-bottom:var(--spacing-2xl); scrollbar-width: none;">
          ${suggestions.map(book => `
            <div class="book-card hover-lift tap-feedback" style="min-width: 140px; scroll-snap-align: start;" onclick="App.navigateTo('book-detail', {id: ${book.id}})">
              <div class="book-cover" style="background:${book.cover_color}; height: 180px; border-radius: 12px; position:relative; overflow:hidden; ${book.cover_url ? `background-image:url('${book.cover_url}');background-size:cover;background-position:center;` : ''}">
                <div class="book-cover-gradient" style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.8), transparent);"></div>
              </div>
              <div class="book-info" style="padding: 10px 4px;">
                <div class="book-title" style="font-size: 13px; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${book.title}</div>
                <div class="book-author" style="font-size: 11px; color: var(--text-secondary);">${book.author}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Recherche depuis home → redirect vers explore
    document.getElementById('home-search').addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (q.length > 1) {
        App.navigateTo('explore');
        setTimeout(() => ExplorePage.setSearch(q), 300);
      }
    });

    // Notifications Panel
    const notifBtn = document.getElementById('notif-btn');
    if (notifBtn) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        NotificationPanel.openPanel();
      });
    }
  }

  function renderContinueCard(book) {
    return `
      <div class="continue-book-card tap-feedback" onclick="App.navigateTo('book-detail', {id: ${book.id}})" style="cursor:pointer;">
        <div class="continue-cover" style="background:${book.cover_color}; ${book.cover_url ? `background-image:url('${book.cover_url}');background-size:cover;` : ''}"></div>
        <div class="continue-info">
          <div class="continue-title">${book.title}</div>
          <div class="continue-author">${book.author}</div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${book.progress_pct}%"></div>
          </div>
          <div class="progress-label">${book.progress_pct}%</div>
        </div>
      </div>`;
  }

  return { render };
})();

window.HomePage = HomePage;
