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
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
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
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="font-weight:500;">${u.name}</div>
          <div style="font-size:11px;color:var(--muted);">ID #${u.id}</div>
        </td>
        <td style="color:var(--muted);">${u.email}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role}</span></td>
        <td style="font-size:12px;color:var(--muted);">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
        <td>
          <span class="badge badge-${u.badge || 'bronze'}">${u.badge || 'bronze'}</span>
        </td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" onclick="openEditUser(${u.id}, '${u.name.replace(/'/g,"\\'")}', '${u.email}', '${u.role}')">✏️</button>
            <button class="btn btn-purple btn-sm" onclick="openBadgeModal(${u.id}, '${u.name.replace(/'/g,"\\'")}', '${u.badge || 'bronze'}')">🏆 Badge</button>
            <button class="btn btn-blue btn-sm" onclick="openResetPwd(${u.id}, '${u.email}')">🔑 MDP</button>
            ${u.id !== adminUser.id ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.name.replace(/'/g,"\\'")}')">✕</button>` : ''}
          </div>
        </td>
      </tr>`).join('');
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
async function loadPosts() {
  const tbody = document.getElementById('posts-table-body');
  try {
    const posts = await apiFetch('GET', '/admin/posts');
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

// ── Utils ─────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Fermer les modals en cliquant à l'extérieur
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('overlay')) e.target.classList.remove('active');
});
