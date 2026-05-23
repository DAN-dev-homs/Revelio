// ============================================================
// REVELIO — Global Audio Manager (audio_manager.js)
// ============================================================

const AudioManager = (() => {
  let audioEl = null;
  let miniPlayerEl = null;
  let currentBook = null;
  let isPlaying = false;
  let currentSpeed = 1;
  const SPEEDS = [1, 1.25, 1.5, 2];

  // Callback listeners pour mettre à jour la fiche cours (si elle est ouverte)
  let onTimeUpdateCb = null;
  let onPlayStateChangeCb = null;

  function init() {
    audioEl = document.getElementById('global-audio');
    miniPlayerEl = document.getElementById('mini-player');
    
    if (!audioEl || !miniPlayerEl) return;

    audioEl.addEventListener('timeupdate', () => {
      updateMiniPlayerProgress();
      if (onTimeUpdateCb) onTimeUpdateCb(audioEl.currentTime, audioEl.duration);
    });

    audioEl.addEventListener('play', () => {
      isPlaying = true;
      updateMiniPlayerUI();
      if (onPlayStateChangeCb) onPlayStateChangeCb(true);
    });

    audioEl.addEventListener('pause', () => {
      isPlaying = false;
      updateMiniPlayerUI();
      if (onPlayStateChangeCb) onPlayStateChangeCb(false);
      if (currentBook && audioEl.duration) {
         const pct = Math.round((audioEl.currentTime / audioEl.duration) * 100);
         api.updateProgress(currentBook.id, pct).catch(e => console.error(e));
      }
    });

    audioEl.addEventListener('ended', () => {
      isPlaying = false;
      updateMiniPlayerUI();
      if (onPlayStateChangeCb) onPlayStateChangeCb(false);
      if (currentBook) {
         api.updateProgress(currentBook.id, 100).catch(e => console.error(e));
      }
    });

    // Événements du Mini-Player
    miniPlayerEl.querySelector('.mp-play-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    miniPlayerEl.querySelector('.mp-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      closePlayer();
    });

    // Clic sur le Mini-Player entier -> ouvrir la page du cours
    miniPlayerEl.addEventListener('click', () => {
      if (currentBook) App.navigateTo('book-detail', { id: currentBook.id });
    });
  }

  function playBook(book) {
    if (!book.audio_url) return;

    // Si c'est déjà le même cours, on toggle juste Play/Pause
    if (currentBook && currentBook.id === book.id) {
      togglePlay();
      return;
    }

    currentBook = book;
    audioEl.src = book.audio_url;
    audioEl.playbackRate = currentSpeed;
    audioEl.play().catch(e => console.error("Audio playback error:", e));

    showMiniPlayer();
    updateMiniPlayerUI();
  }

  function togglePlay() {
    if (!audioEl.src) return;
    if (audioEl.paused) {
      audioEl.play().catch(e => console.error("Audio play error:", e));
    } else {
      audioEl.pause();
    }
  }

  function seek(percentage) {
    if (audioEl.duration) {
      audioEl.currentTime = (percentage / 100) * audioEl.duration;
    }
  }

  function toggleSpeed() {
    let idx = SPEEDS.indexOf(currentSpeed);
    idx = (idx + 1) % SPEEDS.length;
    currentSpeed = SPEEDS[idx];
    audioEl.playbackRate = currentSpeed;
    return currentSpeed;
  }

  function closePlayer() {
    audioEl.pause();
    audioEl.src = '';
    currentBook = null;
    hideMiniPlayer();
    if (onPlayStateChangeCb) onPlayStateChangeCb(false);
  }

  // --- UI du Mini-Player ---

  function showMiniPlayer() {
    miniPlayerEl.style.display = 'flex';
    requestAnimationFrame(() => miniPlayerEl.classList.add('active'));
    const container = document.getElementById('pages-container');
    if (container) container.style.paddingBottom = '72px';
  }

  function hideMiniPlayer() {
    miniPlayerEl.classList.remove('active');
    const container = document.getElementById('pages-container');
    if (container) container.style.paddingBottom = '0';
    setTimeout(() => {
      if (!miniPlayerEl.classList.contains('active')) {
        miniPlayerEl.style.display = 'none';
      }
    }, 400);
  }

  function updateMiniPlayerUI() {
    if (!currentBook) return;
    
    // Titre
    miniPlayerEl.querySelector('.mp-title').textContent = currentBook.title;
    
    // Couverture
    const coverEl = miniPlayerEl.querySelector('.mp-cover');
    if (currentBook.cover_url) {
      coverEl.style.backgroundImage = `url('${currentBook.cover_url}')`;
      coverEl.style.backgroundSize = 'cover';
    } else {
      coverEl.style.background = currentBook.cover_color || '#4CAF93';
    }

    // Play/Pause icon
    const playBtn = miniPlayerEl.querySelector('.mp-play-btn');
    if (isPlaying) {
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    } else {
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    }
  }

  function updateMiniPlayerProgress() {
    if (!audioEl.duration) return;
    const pct = (audioEl.currentTime / audioEl.duration) * 100;
    miniPlayerEl.querySelector('.mp-progress-fill').style.width = `${pct}%`;
  }

  // --- API externe pour la fiche cours ---
  
  function isBookPlaying(bookId) {
    return currentBook && currentBook.id === bookId && isPlaying;
  }

  function getPlaybackState(bookId) {
    if (currentBook && currentBook.id === bookId) {
      return {
        isActive: true,
        isPlaying: isPlaying,
        currentTime: audioEl.currentTime,
        duration: audioEl.duration,
        speed: currentSpeed
      };
    }
    return { isActive: false };
  }

  function onSync(cbTime, cbPlayState) {
    onTimeUpdateCb = cbTime;
    onPlayStateChangeCb = cbPlayState;
  }

  // Initialisation à la charge (defer)
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(init, 100); // léger délai pour que le DOM app.js injecte le cas échéant (quoique global est dans index.html)
  });

  return {
    playBook, togglePlay, seek, toggleSpeed, closePlayer,
    isBookPlaying, getPlaybackState, onSync
  };
})();

window.AudioManager = AudioManager;
