// ============================================================
// REVELIO — API Client (api.js)
// Toutes les appels REST vers le backend Express
// ============================================================

const API_BASE = '/api';
const API_ORIGIN = API_BASE.replace('/api', '');

const api = (() => {
  /** Récupère le token JWT stocké */
  function getToken() { return localStorage.getItem('revelio_token'); }
  function setToken(t) { localStorage.setItem('revelio_token', t); }
  function clearToken() { localStorage.removeItem('revelio_token'); localStorage.removeItem('revelio_user'); }

  function absolutizeMediaUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
    return url;
  }

  function normalizeMediaUrls(value) {
    if (Array.isArray(value)) return value.map(normalizeMediaUrls);
    if (!value || typeof value !== 'object') return value;

    const out = {};
    Object.keys(value).forEach((key) => {
      const v = value[key];
      if (
        typeof v === 'string' &&
        (
          key.endsWith('_url') ||
          key === 'avatar_url' ||
          key.endsWith('_avatar') ||
          key.includes('avatar')
        )
      ) {
        out[key] = absolutizeMediaUrl(v);
      } else if (v && typeof v === 'object') {
        out[key] = normalizeMediaUrls(v);
      } else {
        out[key] = v;
      }
    });
    return out;
  }

  /** Requête générique avec gestion d'erreur */
  async function request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers, cache: 'no-store' };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      clearToken();
      window.location.hash = '#login';
      return null;
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return normalizeMediaUrls(data);
  }

  const get    = (path)        => request('GET',   path);
  const post   = (path, body)  => request('POST',  path, body);
  const patch  = (path, body)  => request('PATCH', path, body);
  const del    = (path)        => request('DELETE', path);

  return {
    getToken, setToken, clearToken,

    // Auth
    login:    (email, password) => post('/auth/login',    { email, password }),
    register: (name, email, password) => post('/auth/register', { name, email, password }),

    // Books
    getBooks:       (filters={})=> {
      const q = new URLSearchParams(filters).toString();
      return get(`/books?${q}`);
    },
    getBookCategories: ()        => get('/books/categories'),
    getBookDetails: (id)        => get(`/books/${id}`),
    toggleSaveBook: (id)        => post(`/books/${id}/save`),
    toggleBookLike: (id)        => post(`/books/${id}/like`),
    updateProgress: (id, pct)   => patch(`/books/${id}/progress`, { progress_pct: pct }),

    // Community
    getPosts:       ()          => get('/community/posts'),
    createPost:     (type, content, image_url) => post('/community/posts', { type, content, image_url }),
    uploadPostImage: async (file) => {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${API_BASE}/community/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
        cache: 'no-store'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return normalizeMediaUrls(data);
    },
    toggleLike:     (id)        => post(`/community/posts/${id}/like`),
    getComments:    (id)        => get(`/community/posts/${id}/comments`),
    addComment:     (id, content) => post(`/community/posts/${id}/comments`, { content }),

    // Notifications
    getNotifications:      () => get('/notifications'),
    markNotificationsRead: () => patch('/notifications/read-all', {}),

    // Discover
    getTopics:      ()          => get('/discover/topics'),
    search:         (q)         => get(`/discover/search?q=${encodeURIComponent(q)}`),

    // Profile
    getProfile:     ()          => get('/profile/me'),
    getSavedBooks:  ()          => get('/profile/saved-books'),
    getReadingList: ()          => get('/profile/reading'),
    getPostsHistory: ()         => get('/profile/posts-history'),
    updateProfile:  (name)      => patch('/profile/me', { name }),
    updatePassword: (currentPassword, newPassword) => patch('/profile/password', { currentPassword, newPassword }),
    uploadAvatar:   async (file) => {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch(`${API_BASE}/profile/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
        cache: 'no-store'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return normalizeMediaUrls(data);
    },
  };
})();

window.api = api;
