// ============================================================
// REVELIO — Notifications System (notifications.js)
// ============================================================

const NotificationPanel = (() => {
  let panelEl = null;
  let refreshInterval = null;
  let lastUnreadCount = 0;

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.05); // A5 note

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Ignorer si non supporté ou bloqué
    }
  }

  function init() {
    // Injecter le HTML du panneau s'il n'existe pas
    if (!document.getElementById('notif-panel')) {
      const div = document.createElement('div');
      div.id = 'notif-panel';
      div.className = 'notif-panel';
      div.innerHTML = `
        <div class="notif-header">
          <h3 style="font-size: 16px; font-weight: 700;">Notifications</h3>
          <button class="icon-btn tap-feedback" id="notif-close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="notif-body" id="notif-list">
          <div class="spinner" style="margin: 32px auto;"></div>
        </div>
      `;
      document.getElementById('app').appendChild(div);

      // Événements
      div.querySelector('#notif-close-btn').addEventListener('click', closePanel);
      
      // Fermer si clic en dehors (on écoute sur window mais de manière prudente)
      window.addEventListener('click', (e) => {
        if (panelEl && panelEl.classList.contains('active')) {
          if (!panelEl.contains(e.target) && !e.target.closest('#notif-btn')) {
            closePanel();
          }
        }
      });
    }
    panelEl = document.getElementById('notif-panel');
  }

  function updateHomeBadge(unreadCount) {
    const badge = document.querySelector('#notif-btn + .badge');
    if (!badge) return;
    if (unreadCount > 0) {
      badge.style.display = 'flex';
      badge.textContent = unreadCount;
    } else {
      badge.style.display = 'none';
    }
  }

  async function refreshUnreadBadge() {
    try {
      const data = await api.getNotifications();
      const unread = data?.unreadCount || 0;
      updateHomeBadge(unread);
      if (unread > lastUnreadCount) playNotificationSound();
      lastUnreadCount = unread;
    } catch (e) {
      // Ignorer silencieusement (ex: expiration session)
    }
  }

  function startAutoRefresh() {
    if (!panelEl) init();
    stopAutoRefresh();
    refreshUnreadBadge();
    refreshInterval = setInterval(refreshUnreadBadge, 15000);
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  async function openPanel() {
    if (!panelEl) init();
    panelEl.classList.add('active');
    playNotificationSound(); // Jouer le son d'ouverture / de notification

    const listEl = document.getElementById('notif-list');
    listEl.innerHTML = `<div class="spinner" style="margin: 32px auto;"></div>`;

    try {
      const data = await api.getNotifications();
      renderNotifications(data.notifications);
      
      // Si on a ouvert le panneau, on marque tout comme lu
      if (data.unreadCount > 0) {
        await api.markNotificationsRead();
        lastUnreadCount = 0;
        updateHomeBadge(0);
      }
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state"><p>Erreur de chargement</p></div>`;
    }
  }

  function closePanel() {
    if (panelEl) panelEl.classList.remove('active');
  }

  function renderNotifications(notifs) {
    const listEl = document.getElementById('notif-list');
    if (!notifs || notifs.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          <p style="margin-top: 8px;">Aucune notification pour le moment.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = notifs.map(n => {
      let icon = '';
      let color = '';
      if (n.type === 'like') {
        icon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
        color = 'var(--accent-red)';
      } else if (n.type === 'comment') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
        color = '#3B82F6';
      } else {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        color = '#10B981';
      }

      const bg = n.is_read ? 'transparent' : 'var(--bg-surface-2)';
      const date = new Date(n.created_at).toLocaleDateString();

      return `
        <div class="notif-item" style="background: ${bg};">
          <div class="notif-icon" style="color: ${color}; background: ${color}22;">
            ${icon}
          </div>
          <div class="notif-content">
            <p>${n.content}</p>
            <span class="notif-time">${date}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  return { init, openPanel, closePanel, startAutoRefresh, stopAutoRefresh, refreshUnreadBadge };
})();

window.NotificationPanel = NotificationPanel;
