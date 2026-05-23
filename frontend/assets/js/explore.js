// ============================================================
// REVELIO — Courses Explore Screen (explore.js)
// ============================================================

const ExplorePage = (() => {
  let allBooks    = [];
  let filters     = { category: 'all', duration: 'all', level: 'all', q: '', author: '' };
  let categories  = ['healing', 'faith', 'identity', 'discipline'];

  async function render(container) {
    const [books, dynamicCategories] = await Promise.all([
      api.getBooks(),
      api.getBookCategories().catch(() => [])
    ]);
    allBooks = books;
    if (Array.isArray(dynamicCategories) && dynamicCategories.length > 0) {
      categories = dynamicCategories;
      if (!categories.includes(filters.category)) filters.category = 'all';
    }
    container.innerHTML = buildLayout();
    renderBooks(container);
    bindEvents(container);
  }

  function buildLayout() {
    const cats = [
      { key: 'all',        label: i18n.t('explore.filter_all')       },
      ...categories.map(cat => ({ key: cat, label: cat }))
    ];
    const durations = [
      { key: 'all',   label: i18n.t('explore.time_all')   },
      { key: 'lt20',  label: i18n.t('explore.time_20')    },
      { key: '20-30', label: i18n.t('explore.time_20_30') },
      { key: 'gt30',  label: i18n.t('explore.time_30')    },
    ];
    const levels = [
      { key: 'all',          label: i18n.t('explore.level_all')          },
      { key: 'beginner',     label: i18n.t('explore.level_beginner')      },
      { key: 'intermediate', label: i18n.t('explore.level_intermediate')  },
      { key: 'advanced',     label: i18n.t('explore.level_advanced')      },
    ];

    return `
      <header class="page-header">
        <h1 class="page-title" data-i18n="explore.title">${i18n.t('explore.title')}</h1>
      </header>

      <div class="search-input-wrapper" style="margin-bottom:var(--spacing-sm)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input id="search-books" class="search-input" type="search"
          placeholder="${i18n.t('explore.search_books')}">
      </div>

      <div class="search-input-wrapper" style="margin-bottom:var(--spacing-lg)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input id="search-author" class="search-input" type="search"
          placeholder="${i18n.t('explore.search_author')}">
      </div>

      <!-- Filtre catégorie -->
      <div class="chips-row" id="filter-category" style="margin-bottom:var(--spacing-md)">
        ${cats.map(c => `
          <button class="chip ${c.key === filters.category ? 'active' : ''}" data-cat="${c.key}">
            ${c.label}
          </button>`).join('')}
      </div>

      <!-- Filtre durée -->
      <div class="chips-row" id="filter-duration" style="margin-bottom:var(--spacing-md)">
        ${durations.map(d => `
          <button class="chip ${d.key === filters.duration ? 'active' : ''}" data-dur="${d.key}">
            ${d.label}
          </button>`).join('')}
      </div>

      <!-- Filtre niveau -->
      <div class="chips-row" id="filter-level" style="margin-bottom:var(--spacing-lg)">
        ${levels.map(l => `
          <button class="chip ${l.key === filters.level ? 'active' : ''}" data-lvl="${l.key}">
            ${l.label}
          </button>`).join('')}
      </div>

      <div id="books-count" class="books-count"></div>
      <div id="books-grid" class="books-grid stagger-children"></div>
    `;
  }

  function renderBooks(container) {
    const filtered = applyFilters();
    const grid  = container.querySelector('#books-grid');
    const count = container.querySelector('#books-count');
    if (!grid) return;

    count.textContent = `${filtered.length} ${i18n.t('explore.books_count')}`;

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
        </svg>
        <p>Aucun enseignement trouvé</p>
      </div>`;
      return;
    }

    grid.innerHTML = filtered.map(book => `
      <div class="book-card hover-lift tap-feedback" data-id="${book.id}" onclick="App.navigateTo('book-detail', {id: ${book.id}})">
        <div class="book-cover" style="background:${book.cover_color}; ${book.cover_url ? `background-image:url('${book.cover_url}');background-size:cover;background-position:center;` : ''}">
          <div class="book-cover-gradient"></div>
        </div>
        <div class="book-info">
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
          <div class="book-meta">
            <span class="book-tag">${book.duration_min} min</span>
            <span class="book-tag">${book.level}</span>
          </div>
        </div>
        <div style="padding:0 var(--spacing-md) var(--spacing-md);display:flex;justify-content:flex-end">
          <button class="chip ${book.is_saved ? 'active' : ''} save-btn"
            data-book-id="${book.id}" style="font-size:11px;padding:4px 10px">
            ${book.is_saved ? '✓ ' + i18n.t('explore.saved') : i18n.t('explore.save')}
          </button>
        </div>
      </div>
    `).join('');

    // Bind save buttons
    container.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.bookId;
        const res = await api.toggleSaveBook(id);
        const book = allBooks.find(b => String(b.id) === id);
        if (book) book.is_saved = res.saved;
        renderBooks(container);
      });
    });
  }

  function applyFilters() {
    return allBooks.filter(b => {
      if (filters.category !== 'all' && b.category !== filters.category) return false;
      if (filters.level    !== 'all' && b.level    !== filters.level)    return false;
      if (filters.duration === 'lt20'  && b.duration_min >= 20) return false;
      if (filters.duration === '20-30' && (b.duration_min < 20 || b.duration_min > 30)) return false;
      if (filters.duration === 'gt30'  && b.duration_min <= 30) return false;
      if (filters.q && !b.title.toLowerCase().includes(filters.q.toLowerCase()))  return false;
      if (filters.author && !b.author.toLowerCase().includes(filters.author.toLowerCase())) return false;
      return true;
    });
  }

  function bindEvents(container) {
    // Filtres catégorie
    container.querySelector('#filter-category').addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      container.querySelectorAll('#filter-category .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      filters.category = btn.dataset.cat;
      renderBooks(container);
    });

    // Filtres durée
    container.querySelector('#filter-duration').addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      container.querySelectorAll('#filter-duration .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      filters.duration = btn.dataset.dur;
      renderBooks(container);
    });

    // Filtres niveau
    container.querySelector('#filter-level').addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      container.querySelectorAll('#filter-level .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      filters.level = btn.dataset.lvl;
      renderBooks(container);
    });

    // Recherche titre (debounce)
    let debounce;
    container.querySelector('#search-books').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { filters.q = e.target.value; renderBooks(container); }, 300);
    });

    // Recherche enseignant
    container.querySelector('#search-author').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { filters.author = e.target.value; renderBooks(container); }, 300);
    });
  }

  // API publique pour navigation inter-pages
  function filterByCategory(cat) {
    filters.category = cat;
    const active = document.querySelector(`#filter-category .chip[data-cat="${cat}"]`);
    document.querySelectorAll('#filter-category .chip').forEach(c => c.classList.remove('active'));
    active?.classList.add('active');
    renderBooks(document.getElementById('page-explore'));
  }

  function setSearch(q) {
    filters.q = q;
    const input = document.getElementById('search-books');
    if (input) input.value = q;
    renderBooks(document.getElementById('page-explore'));
  }

  return { render, filterByCategory, setSearch };
})();

window.ExplorePage = ExplorePage;
