// ============================================================
// REVELIO — Admin Panel JS (admin.js)
// ============================================================

const API = '/api';
let adminToken = localStorage.getItem('admin_token');
let adminUser  = JSON.parse(localStorage.getItem('admin_user') || 'null');

// ── Boot ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (adminToken && adminUser?.role === 'admin') {
    showShell();
    loadMonitoring();
    loadCategories();
    loadBooks();
    loadUsers();
    loadNotificationUsers();
  }

  // Event listener pour le sélecteur de destinataire de notification
  const recipientSelect = document.getElementById('notification-recipient');
  if (recipientSelect) {
    recipientSelect.addEventListener('change', (e) => {
      const userGroup = document.getElementById('notification-user-group');
      if (e.target.value === 'specific') {
        userGroup.style.display = 'block';
      } else {
        userGroup.style.display = 'none';
      }
    });
  }
});

// ── Auth ─────────────────────────────────────────────────
async function adminLogin() {
  const email    = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const alertEl  = document.getElementById('login-alert');
  const btn      = document.getElementById('login-btn');
  alertEl.innerHTML = '';
  btn.textContent = '...'; btn.disabled = true;

  try {
    const res  = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
    if (data.user.role !== 'admin') throw new Error('Accès refusé : vous n\'êtes pas administrateur.');

    adminToken = data.token;
    adminUser  = data.user;
    localStorage.setItem('admin_token', adminToken);
    localStorage.setItem('admin_user', JSON.stringify(adminUser));

    showShell();
    loadMonitoring();
    loadCategories();
    loadBooks();
    loadUsers();
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    btn.textContent = 'Se connecter'; btn.disabled = false;
  }
}

function adminLogout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  location.reload();
}

function showShell() {
  document.getElementById('login-page').style.display  = 'none';
  document.getElementById('admin-shell').style.display = 'flex';
  if (adminUser) document.getElementById('sidebar-admin-name').textContent = adminUser.name;
}

function apiHeaders() {
  return { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
}

async function apiFetch(method, path, body) {
  const opts = { method, headers: apiHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${API}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

// ── Navigation ────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  document.getElementById(`nav-${name}`).classList.add('active');
  
  // Charger les données appropriées pour chaque onglet
  if (name === 'team') loadTeam();
  if (name === 'partners') loadPartners();
  if (name === 'contact') loadContactMessages();
}

// ══════════════════════════════════════════════════════════
// ── MONITORING ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
async function loadMonitoring() {
  const container = document.getElementById('stats-container');
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const d = await apiFetch('GET', '/admin/stats');
    container.innerHTML = `
      <!-- Stat Cards -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="icon">👥</div>
          <div class="label">Total utilisateurs</div>
          <div class="value">${d.users.total}</div>
          <div class="sub">+${d.users.newThisMonth} ce mois</div>
        </div>
        <div class="stat-card">
          <div class="icon">🔐</div>
          <div class="label">Administrateurs</div>
          <div class="value">${d.users.admins}</div>
          <div class="sub">${d.users.regular} utilisateurs réguliers</div>
        </div>
        <div class="stat-card">
          <div class="icon">📚</div>
          <div class="label">Total livres</div>
          <div class="value">${d.books.total}</div>
          <div class="sub">🎥 ${d.books.withVideo} vidéos · 🎧 ${d.books.withAudio} audios</div>
        </div>
        <div class="stat-card">
          <div class="icon">💬</div>
          <div class="label">Posts communauté</div>
          <div class="value">${d.engagement.posts}</div>
          <div class="sub">${d.engagement.comments} commentaires · ${d.engagement.likes} likes</div>
        </div>
        <div class="stat-card">
          <div class="icon">❤️</div>
          <div class="label">Livres sauvegardés</div>
          <div class="value">${d.engagement.savedBooks}</div>
          <div class="sub">Total dans toutes les bibliothèques</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <!-- Derniers utilisateurs -->
        <div class="card">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">🆕 Derniers inscrits</h3>
          ${d.recentUsers.map(u => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-weight:700;">
                ${(u.name || '?')[0].toUpperCase()}
              </div>
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:500;">${u.name}</div>
                <div style="font-size:12px;color:var(--muted);">${u.email}</div>
              </div>
              <span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role}</span>
            </div>
          `).join('')}
        </div>

        <!-- Journal d'activité -->
        <div class="card">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">📋 Journal d'activité</h3>
          <div style="max-height: 320px; overflow-y: auto;">
            ${d.recentActivity.length === 0 ? '<p style="color:var(--muted);font-size:13px;">Aucune activité enregistrée.</p>' :
              d.recentActivity.map(a => {
                const icons = { login: '🔑', register: '✅', create_book: '📚', delete_book: '🗑️', create_user: '👤', update_user: '✏️', delete_user: '❌', reset_password: '🔑' };
                const colors = { login: '#3B82F6', register: '#10B981', create_book: '#F59E0B', delete_book: '#E53935', create_user: '#10B981', update_user: '#F59E0B', delete_user: '#E53935', reset_password: '#7C3AED' };
                const icon  = icons[a.action]  || '📌';
                const color = colors[a.action] || '#888';
                const time  = new Date(a.created_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
                return `
                  <div class="activity-item">
                    <div class="activity-icon" style="background:${color}22;color:${color};">${icon}</div>
                    <div class="activity-info">
                      <div class="activity-action">${a.detail || a.action}</div>
                      <div class="activity-detail">${a.user_name ? `Par ${a.user_name}` : 'Action système'}</div>
                    </div>
                    <div class="activity-time">${time}</div>
                  </div>`;
              }).join('')
            }
          </div>
        </div>
      </div>`;

    // Afficher les meilleurs lecteurs
    renderTopReaders(d.topReaders.week, 'top-readers-week');
    renderTopReaders(d.topReaders.month, 'top-readers-month');

    // Afficher les livres populaires
    renderTopBooks(d.topBooks.mostRead, 'most-read-books', 'readers_count');
    renderTopBooks(d.topBooks.mostSaved, 'most-saved-books', 'saves_count');
    renderTopBooks(d.topBooks.mostLiked, 'most-liked-books', 'total_likes');
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function renderTopReaders(readers, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!readers || readers.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:13px;">Aucune donnée disponible.</p>';
    return;
  }

  container.innerHTML = readers.map((reader, index) => {
    const badgeIcon = reader.badge ? {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      diamond: '💎'
    }[reader.badge] : '';
    const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">
          ${rankIcon}
        </div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:500;">${reader.name}</div>
          <div style="font-size:12px;color:var(--muted);">${reader.books_read} livres · ${Math.round(reader.total_progress || 0)}% progression</div>
        </div>
        ${badgeIcon ? `<span style="font-size:16px;">${badgeIcon}</span>` : ''}
      </div>
    `;
  }).join('');
}

function renderTopBooks(books, containerId, countField) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!books || books.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:13px;">Aucune donnée disponible.</p>';
    return;
  }

  container.innerHTML = books.map((book, index) => {
    const count = book[countField] || 0;
    const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const coverStyle = book.cover_url
      ? `background-image: url('${book.cover_url}'); background-size: cover; background-position: center;`
      : `background: ${book.cover_color || '#4CAF93'};`;
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">
          ${rankIcon}
        </div>
        <div style="width:36px;height:48px;border-radius:6px;${coverStyle}display:flex;align-items:center;justify-content:center;">
          ${!book.cover_url ? '<span style="font-size:16px;">📖</span>' : ''}
        </div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:500;">${book.title}</div>
          <div style="font-size:12px;color:var(--muted);">${book.author}</div>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--primary);">${count}</div>
      </div>
    `;
  }).join('');
}

// ══════════════════════════════════════════════════════════
// ── CATEGORIES ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
async function loadCategories() {
  const select = document.getElementById('b-category');
  try {
    const categories = await apiFetch('GET', '/admin/categories');
    select.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  } catch (e) { console.error('Failed to load categories', e); }
}

async function promptAddCategory() {
  const name = prompt("Nom de la nouvelle catégorie :");
  if (!name || !name.trim()) return;
  
  try {
    const res = await apiFetch('POST', '/admin/categories', { name: name.trim() });
    await loadCategories();
    document.getElementById('b-category').value = res.name;
  } catch (e) {
    alert("Erreur lors de l'ajout de la catégorie : " + e.message);
  }
}

// ══════════════════════════════════════════════════════════
// ── LIVRES ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
async function loadBooks() {
  const tbody = document.getElementById('books-table-body');
  try {
    const books = await apiFetch('GET', '/admin/books');
    tbody.innerHTML = books.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px;">Aucun livre</td></tr>'
      : books.map(b => `
        <tr>
          <td><strong>${b.title}</strong></td>
          <td>${b.author}</td>
          <td><span class="badge badge-yellow">${b.category}</span></td>
          <td>
            ${b.video_url ? '🎥' : ''} ${b.audio_url ? '🎧' : ''} ${b.cover_url ? '🖼️' : ''}
            ${!b.video_url && !b.audio_url && !b.cover_url ? '<span style="color:var(--muted)">—</span>' : ''}
          </td>
          <td style="color:var(--muted);font-size:12px;">${new Date(b.created_at).toLocaleDateString('fr-FR')}</td>
          <td>
            <div class="actions">
              <button class="btn btn-ghost btn-sm" onclick="openEditBookModal(${b.id})">✏️ Editer</button>
              <button class="btn btn-danger btn-sm" onclick="deleteBook(${b.id}, '${b.title.replace(/'/g, "\\'")}')">Supprimer</button>
            </div>
          </td>
        </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="alert alert-error">${e.message}</td></tr>`;
  }
}

function openBookModal() {
  document.getElementById('b-id').value = '';
  document.getElementById('book-modal-title').textContent = 'Ajouter un livre';
  document.getElementById('save-book-btn').textContent = 'Enregistrer';
  
  // Clear inputs
  ['b-title', 'b-author', 'b-summary', 'b-keypoints', 'b-tags', 'b-amazon', 'b-cover', 'b-video', 'b-audio'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('b-duration').value = '15';
  document.getElementById('b-color').value = '#4CAF93';
  
  document.getElementById('modal-book').classList.add('active');
  document.getElementById('book-form-alert').innerHTML = '';
}

async function openEditBookModal(id) {
  try {
    const b = await apiFetch('GET', `/admin/books/${id}`);
    
    document.getElementById('b-id').value = b.id;
    document.getElementById('book-modal-title').textContent = 'Modifier le livre';
    document.getElementById('save-book-btn').textContent = 'Mettre à jour';
    
    document.getElementById('b-title').value = b.title;
    document.getElementById('b-author').value = b.author;
    document.getElementById('b-category').value = b.category;
    document.getElementById('b-duration').value = b.duration_min;
    document.getElementById('b-level').value = b.level;
    document.getElementById('b-color').value = b.cover_color;
    document.getElementById('b-summary').value = b.summary || '';
    document.getElementById('b-amazon').value = b.amazon_url || '';
    
    document.getElementById('b-keypoints').value = b.key_points ? JSON.parse(b.key_points).join('\n') : '';
    document.getElementById('b-tags').value = b.tags ? b.tags.map(t => t.name).join(', ') : '';
    
    // Clear files inputs to avoid accidental overwrite
    ['b-cover', 'b-video', 'b-audio'].forEach(id => document.getElementById(id).value = '');
    
    document.getElementById('book-form-alert').innerHTML = '';
    document.getElementById('modal-book').classList.add('active');
  } catch (e) {
    alert("Impossible de charger les détails du livre : " + e.message);
  }
}

async function saveBook() {
  const btn = document.getElementById('save-book-btn');
  btn.textContent = '...'; btn.disabled = true;

  const formData = new FormData();
  formData.append('title',       document.getElementById('b-title').value.trim());
  formData.append('author',      document.getElementById('b-author').value.trim());
  formData.append('category',    document.getElementById('b-category').value);
  formData.append('duration_min',document.getElementById('b-duration').value);
  formData.append('level',       document.getElementById('b-level').value);
  formData.append('cover_color', document.getElementById('b-color').value);
  formData.append('summary',     document.getElementById('b-summary').value);
  formData.append('amazon_url',  document.getElementById('b-amazon').value);

  const kpRaw = document.getElementById('b-keypoints').value.trim();
  if (kpRaw) formData.append('key_points', JSON.stringify(kpRaw.split('\n').filter(l => l.trim())));

  const tagsRaw = document.getElementById('b-tags').value.trim();
  if (tagsRaw) formData.append('tags', JSON.stringify(tagsRaw.split(',').map(t => ({ type: 'theme', name: t.trim() }))));

  const coverFile = document.getElementById('b-cover').files[0];
  const videoFile = document.getElementById('b-video').files[0];
  const audioFile = document.getElementById('b-audio').files[0];
  if (coverFile) formData.append('cover', coverFile);
  if (videoFile) formData.append('video', videoFile);
  if (audioFile) formData.append('audio', audioFile);

  try {
    const bookId = document.getElementById('b-id').value;
    const url = bookId ? `${API}/admin/books/${bookId}` : `${API}/admin/books`;
    const method = bookId ? 'PUT' : 'POST';

    const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${adminToken}` }, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    closeModal('modal-book');
    loadBooks();
    loadMonitoring();
  } catch (e) {
    document.getElementById('book-form-alert').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  } finally { 
    btn.textContent = document.getElementById('b-id').value ? 'Mettre à jour' : 'Enregistrer'; 
    btn.disabled = false; 
  }
}

async function deleteBook(id, title) {
  if (!confirm(`Supprimer "${title}" ? Cette action est irréversible.`)) return;
  await apiFetch('DELETE', `/admin/books/${id}`);
  loadBooks(); loadMonitoring();
}

// ══════════════════════════════════════════════════════════
// ── UTILISATEURS ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════
async function loadUsers(searchQuery = '') {
  const tbody = document.getElementById('users-table-body');
  try {
    const endpoint = searchQuery ? `/admin/users/search?q=${encodeURIComponent(searchQuery)}` : '/admin/users';
    const users = await apiFetch('GET', endpoint);
    tbody.innerHTML = users.map(u => {
      const badgeIcon = u.badge && u.badge !== 'bronze' ? {
        silver: '🥈',
        gold: '🥇',
        diamond: '💎'
      }[u.badge] : '';
      
      return `
      <tr>
        <td>
          <div style="font-weight:500;">${u.name}</div>
          <div style="font-size:11px;color:var(--muted);">ID #${u.id}</div>
        </td>
        <td style="color:var(--muted);">${u.email}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role}</span></td>
        <td style="font-size:12px;color:var(--muted);">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
        <td>
          ${u.badge && u.badge !== 'bronze' ? `
          <span class="badge badge-${u.badge}" style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
          ">
            ${badgeIcon}
            <span>${u.badge}</span>
          </span>
          ` : '<span style="color:var(--muted);font-size:12px;">-</span>'}
        </td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" onclick="openEditUser(${u.id}, '${u.name.replace(/'/g,"\\'")}', '${u.email}', '${u.role}')">✏️</button>
            <button class="btn btn-purple btn-sm" onclick="openBadgeModal(${u.id}, '${u.name.replace(/'/g,"\\'")}', '${u.badge || 'bronze'}')">🏆 Badge</button>
            <button class="btn btn-blue btn-sm" onclick="openResetPwd(${u.id}, '${u.email}')">🔑 MDP</button>
            ${u.id !== adminUser.id ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.name.replace(/'/g,"\\'")}')">✕</button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="alert alert-error">${e.message}</td></tr>`;
  }
}

// Fonction de recherche d'utilisateurs
async function searchUsers() {
  const searchInput = document.getElementById('user-search');
  const query = searchInput.value.trim();
  loadUsers(query);
}

// ══════════════════════════════════════════════════════════
// ── POSTS ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
async function loadPosts(searchQuery = '') {
  const tbody = document.getElementById('posts-table-body');
  try {
    const endpoint = searchQuery ? `/admin/posts/search?q=${encodeURIComponent(searchQuery)}` : '/admin/posts';
    const posts = await apiFetch('GET', endpoint);
    tbody.innerHTML = posts.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px;">Aucun post</td></tr>'
      : posts.map(p => `
        <tr>
          <td>
            <div style="font-weight:500;">${p.author_name}</div>
            <div style="font-size:11px;color:var(--muted);">${p.author_email}</div>
          </td>
          <td>
            <div style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${p.content}
            </div>
          </td>
          <td><span class="badge badge-${p.type}">${p.type}</span></td>
          <td style="font-size:12px;color:var(--muted);">${p.likes_count || 0}</td>
          <td style="font-size:12px;color:var(--muted);">${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
          <td>
            <div class="actions">
              <button class="btn btn-danger btn-sm" onclick="deletePost(${p.id}, '${p.author_name.replace(/'/g, "\\'")}')">🗑️ Supprimer</button>
            </div>
          </td>
        </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="alert alert-error">${e.message}</td></tr>`;
  }
}

async function deletePost(postId, authorName) {
  if (!confirm(`Supprimer le post de "${authorName}" ? Cette action est irréversible.`)) return;
  try {
    await apiFetch('DELETE', `/admin/posts/${postId}`);
    loadPosts(); // Recharger la liste des posts
  } catch (e) {
    alert('Erreur lors de la suppression du post: ' + e.message);
  }
}

// Fonction de recherche de posts
async function searchPosts() {
  const searchInput = document.getElementById('post-search');
  const query = searchInput.value.trim();
  loadPosts(query);
}

// ── BADGE MODAL ───────────────────────────────────────────────
function openBadgeModal(userId, userName, currentBadge) {
  document.getElementById('badge-user-id').value = userId;
  document.getElementById('badge-user-name').textContent = userName;
  document.getElementById('current-badge').textContent = currentBadge;
  
  // Set radio button for current badge
  document.querySelectorAll('input[name="badge"]').forEach(radio => {
    radio.checked = radio.value === currentBadge;
  });
  
  document.getElementById('modal-badge').classList.add('active');
  document.getElementById('badge-form-alert').innerHTML = '';
}

async function grantBadge() {
  const userId = document.getElementById('badge-user-id').value;
  const badge = document.querySelector('input[name="badge"]:checked')?.value;
  const alertEl = document.getElementById('badge-form-alert');
  const btn = document.getElementById('grant-badge-btn');
  
  if (!badge) {
    alertEl.innerHTML = '<div class="alert alert-error">Veuillez sélectionner un badge</div>';
    return;
  }
  
  btn.textContent = '...';
  btn.disabled = true;
  
  try {
    const res = await fetch(`${API}/admin/users/${userId}/badge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ badge })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    closeModal('modal-badge');
    loadUsers(); // Reload users to show updated badge
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  } finally {
    btn.textContent = 'Accorder le badge';
    btn.disabled = false;
  }
}

function openCreateUserModal() {
  document.getElementById('cu-name').value = '';
  document.getElementById('cu-email').value = '';
  document.getElementById('cu-password').value = '';
  document.getElementById('cu-role').value = 'user';
  document.getElementById('create-user-alert').innerHTML = '';
  document.getElementById('modal-create-user').classList.add('active');
}

async function createUser() {
  const alertEl = document.getElementById('create-user-alert');
  const body = {
    name:     document.getElementById('cu-name').value.trim(),
    email:    document.getElementById('cu-email').value.trim(),
    password: document.getElementById('cu-password').value,
    role:     document.getElementById('cu-role').value
  };
  if (!body.name || !body.email || !body.password) { alertEl.innerHTML = `<div class="alert alert-error">Tous les champs sont requis</div>`; return; }
  try {
    await apiFetch('POST', '/admin/users', body);
    closeModal('modal-create-user');
    loadUsers(); loadMonitoring();
  } catch (e) { alertEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
}

function openEditUser(id, name, email, role) {
  document.getElementById('eu-id').value    = id;
  document.getElementById('eu-name').value  = name;
  document.getElementById('eu-email').value = email;
  document.getElementById('eu-role').value  = role;
  document.getElementById('edit-user-alert').innerHTML = '';
  document.getElementById('modal-edit-user').classList.add('active');
}

async function saveUser() {
  const alertEl = document.getElementById('edit-user-alert');
  const id   = document.getElementById('eu-id').value;
  const body = {
    name:  document.getElementById('eu-name').value.trim(),
    email: document.getElementById('eu-email').value.trim(),
    role:  document.getElementById('eu-role').value
  };
  try {
    await apiFetch('PATCH', `/admin/users/${id}`, body);
    closeModal('modal-edit-user');
    loadUsers(); loadMonitoring();
  } catch (e) { alertEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
}

function openResetPwd(id, email) {
  document.getElementById('rp-id').value = id;
  document.getElementById('rp-info').textContent = `Un mot de passe temporaire sécurisé sera généré pour : ${email}`;
  document.getElementById('rp-result').innerHTML = '';
  document.getElementById('rp-confirm-btn').style.display = 'inline-block';
  document.getElementById('modal-reset-pwd').classList.add('active');
}

async function confirmResetPwd() {
  const id = document.getElementById('rp-id').value;
  try {
    const data = await apiFetch('POST', `/admin/users/${id}/reset-password`);
    document.getElementById('rp-result').innerHTML = `
      <div class="temp-pass-box">
        <div class="label">✅ Mot de passe temporaire généré :</div>
        <div class="pass">${data.tempPassword}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:8px;">Copiez et transmettez ce mot de passe à l'utilisateur. Il devra le changer à sa prochaine connexion.</div>
      </div>`;
    document.getElementById('rp-confirm-btn').style.display = 'none';
  } catch (e) {
    document.getElementById('rp-result').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function deleteUser(id, name) {
  if (!confirm(`Supprimer l'utilisateur "${name}" ? Cette action est irréversible.`)) return;
  await apiFetch('DELETE', `/admin/users/${id}`);
  loadUsers(); loadMonitoring();
}

// ══════════════════════════════════════════════════════════
// ── NOTIFICATIONS ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════
async function loadNotificationUsers() {
  try {
    const users = await apiFetch('GET', '/admin/users');
    const select = document.getElementById('notification-user');
    select.innerHTML = '<option value="">Sélectionner un utilisateur...</option>';
    users.forEach(u => {
      select.innerHTML += `<option value="${u.id}">${u.name} (${u.email})</option>`;
    });
  } catch (e) {
    console.error('Erreur lors du chargement des utilisateurs pour notifications:', e);
  }
}

async function sendNotification() {
  const recipient = document.getElementById('notification-recipient').value;
  const userId = document.getElementById('notification-user').value;
  const type = document.getElementById('notification-type').value;
  const content = document.getElementById('notification-content').value.trim();
  const alertEl = document.getElementById('notification-alert');

  if (!content) {
    alertEl.innerHTML = '<div class="alert alert-error">Le contenu de la notification est requis</div>';
    return;
  }

  if (recipient === 'specific' && !userId) {
    alertEl.innerHTML = '<div class="alert alert-error">Veuillez sélectionner un utilisateur</div>';
    return;
  }

  try {
    if (recipient === 'all') {
      await apiFetch('POST', '/notifications/broadcast', { type, content });
      alertEl.innerHTML = '<div class="alert alert-success">Notification envoyée à tous les utilisateurs</div>';
    } else {
      await apiFetch('POST', '/notifications/send', { user_id: parseInt(userId), type, content });
      alertEl.innerHTML = '<div class="alert alert-success">Notification envoyée à l\'utilisateur</div>';
    }
    document.getElementById('notification-content').value = '';
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

// ── Utils ─────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Fermer les modals en cliquant à l'extérieur
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('overlay')) e.target.classList.remove('active');
});

// ══════════════════════════════════════════════════════════
// ── GESTION DE L'ÉQUIPE ──────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadTeam() {
  const tbody = document.getElementById('team-table-body');
  try {
    const team = await apiFetch('GET', '/admin/team');
    tbody.innerHTML = team.map(member => `
      <tr>
        <td>
          ${member.photo_url 
            ? `<img src="${member.photo_url}" alt="${member.name}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">` 
            : `<div style="width:40px;height:40px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;">${member.name[0]}</div>`
          }
        </td>
        <td>${member.name}</td>
        <td>${member.role}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editTeamMember(${member.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTeamMember(${member.id}, '${member.name.replace(/'/g, "\\'")}')">✕</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Erreur: ${e.message}</td></tr>`;
  }
}

function openTeamModal(member = null) {
  const modal = document.getElementById('modal-team');
  const title = document.getElementById('team-modal-title');
  
  if (member) {
    title.textContent = 'Modifier le membre d\'équipe';
    document.getElementById('team-id').value = member.id;
    document.getElementById('team-name').value = member.name;
    document.getElementById('team-role').value = member.role;
    document.getElementById('team-bio').value = member.bio || '';
    document.getElementById('team-linkedin').value = member.linkedin || '';
    document.getElementById('team-twitter').value = member.twitter || '';
    document.getElementById('team-order').value = member.order_index || 0;
    document.getElementById('team-existing-photo').value = member.photo_url || '';
  } else {
    title.textContent = 'Ajouter un membre d\'équipe';
    document.getElementById('team-id').value = '';
    document.getElementById('team-name').value = '';
    document.getElementById('team-role').value = '';
    document.getElementById('team-bio').value = '';
    document.getElementById('team-linkedin').value = '';
    document.getElementById('team-twitter').value = '';
    document.getElementById('team-order').value = 0;
    document.getElementById('team-existing-photo').value = '';
    document.getElementById('team-photo').value = '';
  }
  
  modal.classList.add('active');
}

function editTeamMember(id) {
  apiFetch('GET', '/admin/team').then(team => {
    const member = team.find(m => m.id === id);
    if (member) openTeamModal(member);
  });
}

async function saveTeamMember() {
  const id = document.getElementById('team-id').value;
  const name = document.getElementById('team-name').value;
  const role = document.getElementById('team-role').value;
  const bio = document.getElementById('team-bio').value;
  const linkedin = document.getElementById('team-linkedin').value;
  const twitter = document.getElementById('team-twitter').value;
  const order = document.getElementById('team-order').value;
  const photo = document.getElementById('team-photo').files[0];
  const existingPhoto = document.getElementById('team-existing-photo').value;
  
  if (!name || !role) {
    alert('Nom et rôle sont requis');
    return;
  }
  
  const formData = new FormData();
  formData.append('name', name);
  formData.append('role', role);
  formData.append('bio', bio);
  formData.append('linkedin', linkedin);
  formData.append('twitter', twitter);
  formData.append('order_index', order);
  formData.append('existing_photo', existingPhoto);
  if (photo) formData.append('photo', photo);
  
  try {
    const endpoint = id ? `/admin/team/${id}` : '/admin/team';
    const method = id ? 'PUT' : 'POST';
    
    const response = await fetch(`${API}${endpoint}`, {
      method,
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: formData
    });
    
    if (!response.ok) throw new Error('Erreur lors de l\'enregistrement');
    
    closeModal('modal-team');
    loadTeam();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

async function deleteTeamMember(id, name) {
  if (!confirm(`Supprimer ${name} ?`)) return;
  
  try {
    await apiFetch('DELETE', `/admin/team/${id}`);
    loadTeam();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════
// ── GESTION DES PARTENAIRES ────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadPartners() {
  const tbody = document.getElementById('partners-table-body');
  try {
    const partners = await apiFetch('GET', '/admin/partners');
    tbody.innerHTML = partners.map(partner => `
      <tr>
        <td>
          ${partner.logo_url 
            ? `<img src="${partner.logo_url}" alt="${partner.name}" style="width:50px;height:30px;object-fit:contain;">` 
            : '<span style="color:var(--muted);">Pas de logo</span>'
          }
        </td>
        <td>${partner.name}</td>
        <td>${partner.website_url ? `<a href="${partner.website_url}" target="_blank">${partner.website_url}</a>` : '-'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editPartner(${partner.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deletePartner(${partner.id}, '${partner.name.replace(/'/g, "\\'")}')">✕</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Erreur: ${e.message}</td></tr>`;
  }
}

function openPartnerModal(partner = null) {
  const modal = document.getElementById('modal-partner');
  const title = document.getElementById('partner-modal-title');
  
  if (partner) {
    title.textContent = 'Modifier le partenaire';
    document.getElementById('partner-id').value = partner.id;
    document.getElementById('partner-name').value = partner.name;
    document.getElementById('partner-website').value = partner.website_url || '';
    document.getElementById('partner-description').value = partner.description || '';
    document.getElementById('partner-order').value = partner.order_index || 0;
    document.getElementById('partner-existing-logo').value = partner.logo_url || '';
  } else {
    title.textContent = 'Ajouter un partenaire';
    document.getElementById('partner-id').value = '';
    document.getElementById('partner-name').value = '';
    document.getElementById('partner-website').value = '';
    document.getElementById('partner-description').value = '';
    document.getElementById('partner-order').value = 0;
    document.getElementById('partner-existing-logo').value = '';
    document.getElementById('partner-logo').value = '';
  }
  
  modal.classList.add('active');
}

function editPartner(id) {
  apiFetch('GET', '/admin/partners').then(partners => {
    const partner = partners.find(p => p.id === id);
    if (partner) openPartnerModal(partner);
  });
}

async function savePartner() {
  const id = document.getElementById('partner-id').value;
  const name = document.getElementById('partner-name').value;
  const website = document.getElementById('partner-website').value;
  const description = document.getElementById('partner-description').value;
  const order = document.getElementById('partner-order').value;
  const logo = document.getElementById('partner-logo').files[0];
  const existingLogo = document.getElementById('partner-existing-logo').value;
  
  if (!name) {
    alert('Nom est requis');
    return;
  }
  
  const formData = new FormData();
  formData.append('name', name);
  formData.append('website_url', website);
  formData.append('description', description);
  formData.append('order_index', order);
  formData.append('existing_logo', existingLogo);
  if (logo) formData.append('logo', logo);
  
  try {
    const endpoint = id ? `/admin/partners/${id}` : '/admin/partners';
    const method = id ? 'PUT' : 'POST';
    
    const response = await fetch(`${API}${endpoint}`, {
      method,
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: formData
    });
    
    if (!response.ok) throw new Error('Erreur lors de l\'enregistrement');
    
    closeModal('modal-partner');
    loadPartners();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

async function deletePartner(id, name) {
  if (!confirm(`Supprimer ${name} ?`)) return;
  
  try {
    await apiFetch('DELETE', `/admin/partners/${id}`);
    loadPartners();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════
// ── MESSAGES DE CONTACT ────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadContactMessages() {
  const tbody = document.getElementById('contact-table-body');
  try {
    const messages = await apiFetch('GET', '/admin/contact-messages');
    tbody.innerHTML = messages.map(msg => `
      <tr style="${msg.is_read ? 'opacity:0.6;' : ''}">
        <td>${new Date(msg.created_at).toLocaleDateString('fr-FR')}</td>
        <td>${msg.name}</td>
        <td>${msg.email}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${msg.message}</td>
        <td>
          ${!msg.is_read ? `<button class="btn btn-ghost btn-sm" onclick="markAsRead(${msg.id})">✓</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteContactMessage(${msg.id})">✕</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);">Erreur: ${e.message}</td></tr>`;
  }
}

async function markAsRead(id) {
  try {
    await apiFetch('PATCH', `/admin/contact-messages/${id}/read`);
    loadContactMessages();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

async function deleteContactMessage(id) {
  if (!confirm('Supprimer ce message ?')) return;
  
  try {
    await apiFetch('DELETE', `/admin/contact-messages/${id}`);
    loadContactMessages();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}
