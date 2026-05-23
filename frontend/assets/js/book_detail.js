// ============================================================
// REVELIO — Book Detail Screen (book_detail.js)
// Format A.C.T.I.O.N.
// ============================================================

const BookDetailPage = (() => {
  let currentBook = null;

  async function render(container, bookId) {
    if (!bookId) {
      App.navigateTo('explore');
      return;
    }

    try {
      currentBook = await api.getBookDetails(bookId);
      
      let displayBook = JSON.parse(JSON.stringify(currentBook));
      
      if (i18n.getLang() !== 'fr') {
        container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p style="margin-top:16px;">Traduction en cours...</p></div>`;
        displayBook.summary = await i18n.translateDynamic(displayBook.summary);
        displayBook.title = await i18n.translateDynamic(displayBook.title);
        displayBook.category = await i18n.translateDynamic(displayBook.category);
        if (displayBook.key_points && Array.isArray(displayBook.key_points)) {
          displayBook.key_points = await Promise.all(displayBook.key_points.map(kp => i18n.translateDynamic(kp)));
        }
      }

      container.innerHTML = buildLayout(displayBook);
      bindEvents(container, currentBook);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Impossible de charger cet enseignement.</p></div>`;
    }
  }

  function buildLayout(b) {
    const coverUrl = b.cover_url || '';
    const coverStyle = coverUrl ? `background-image: url('${coverUrl}'); background-size: cover;` : `background: ${b.cover_color};`;

    // Parsing simple du Markdown pour l'enseignement - style lisible
    const parseSummary = (text) => {
      if (!text) return '<p style="color: #7a756f; font-style: italic;">Aucun enseignement disponible.</p>';
      let html = text.replace(/^### (.*$)/gim, '<h3 style="font-family: Georgia, serif; font-size: 22px; font-weight: 600; color: #5a544d; margin: 24px 0 14px 0; padding-bottom: 8px; border-bottom: 1px solid #e0dcd4;">$1</h3>')
                     .replace(/^## (.*$)/gim, '<h2 style="font-family: Georgia, serif; font-size: 26px; font-weight: 600; color: #4a453d; margin: 28px 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #d0ccc4;">$1</h2>')
                     .replace(/^# (.*$)/gim, '<h1 style="font-family: Georgia, serif; font-size: 30px; font-weight: 700; color: #3a352f; margin: 32px 0 20px 0; text-align: center;">$1</h1>')
                     .replace(/\*\*(.*)\*\*/gim, '<strong style="font-weight: 700; color: #2a2520;">$1</strong>')
                     .replace(/\*(.*)\*/gim, '<em style="color: #5a544d;">$1</em>')
                     .replace(/\n\n/gim, '</p><p style="margin-bottom: 20px;">')
                     .replace(/\n/gim, '<br>');
      return `<p style="margin-bottom: 20px; font-family: Georgia, serif; font-size: 20px; line-height: 1.9;">${html}</p>`;
    };

    let keyPointsHtml = '';
    if (b.key_points && Array.isArray(b.key_points)) {
      keyPointsHtml = b.key_points.map(kp => `<li style="margin-bottom:8px;">${kp}</li>`).join('');
    }

    return `
      <!-- Navigation Back -->
      <header class="page-header" style="position: sticky; top: 0; background: var(--bg-primary); z-index: 10;">
        <button class="icon-btn tap-feedback" id="back-btn" aria-label="Retour">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 class="page-title" style="font-size: 18px; margin: 0 auto; padding-right: 40px;">${b.title}</h1>
      </header>

      <div style="padding-bottom: 80px;">
        <!-- 1. HEADER (Fiche cours) -->
        <div style="display:flex; gap:16px; margin-bottom: 24px;">
          <div style="width: 100px; height: 140px; border-radius: 8px; ${coverStyle}"></div>
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">${b.category}</div>
            <h2 style="font-size: 20px; font-weight: 700; line-height: 1.2; margin-bottom: 8px;">${b.title}</h2>
            <div style="color: var(--text-secondary); margin-bottom: 16px;">${b.author}</div>
            
            <!-- Quick Actions -->
            <div style="display: flex; gap: 8px;">
              <button class="btn-primary" style="flex:1; padding: 8px; font-size: 14px;" onclick="window.scrollTo(0, document.getElementById('section-summary').offsetTop - 60)">📖 Étudier</button>
              ${b.audio_url ? `<button class="btn-primary" style="flex:1; padding: 8px; background:var(--bg-surface-2); color:var(--text); font-size: 14px;" onclick="window.scrollTo(0, document.getElementById('section-audio').offsetTop - 60)">🎧 Écouter</button>` : ''}
            </div>
          </div>
        </div>

        <!-- 9. TAGS INTELLIGENTS -->
        ${b.tags && b.tags.length ? `
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;">
            ${b.tags.map(t => `<span style="background: var(--bg-surface-2); padding: 4px 10px; border-radius: 12px; font-size: 12px; color: var(--text-secondary);">#${t.name}</span>`).join('')}
          </div>
        ` : ''}

        <!-- 2. VIDÉO (Format Prioritaire) -->
        ${b.video_url ? `
          <div style="margin-bottom: 32px;" id="section-video">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Vidéo de l'enseignement</h3>
            <video id="book-video" controls poster="${b.thumbnail_url || ''}" style="width: 100%; border-radius: 12px; background: #000; aspect-ratio: 16/9; object-fit: cover;">
              <source src="${b.video_url}" type="video/mp4">
              Votre navigateur ne supporte pas la vidéo.
            </video>
          </div>
        ` : ''}

        <!-- 4. AUDIO (Accessibilité) -->
        ${b.audio_url ? `
          <div style="margin-bottom: 32px; background: var(--bg-surface); padding: 16px; border-radius: 12px;" id="section-audio">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Écouter l'enseignement</h3>
            <div style="display: flex; align-items: center; gap: 12px;">
              <button id="audio-play-btn" style="background: var(--primary); color: white; width: 40px; height: 40px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <div style="flex: 1;">
                <input type="range" id="audio-progress" value="0" min="0" max="100" style="width: 100%;">
              </div>
              <button id="audio-speed-btn" style="background: transparent; border: 1px solid var(--border-color); color: var(--text); padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">1x</button>
            </div>
          </div>
        ` : ''}

        <!-- 5. POINTS CLÉS -->
        ${keyPointsHtml ? `
          <div style="margin-bottom: 32px; background: var(--bg-surface-2); padding: 20px; border-radius: 12px;">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              Points clés de l'enseignement
            </h3>
            <ul style="padding-left: 20px; line-height: 1.6;">${keyPointsHtml}</ul>
          </div>
        ` : ''}

        <!-- 3. ENSEIGNEMENT ÉCRIT -->
        <div style="margin-bottom: 32px;" id="section-summary">
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Enseignement complet</h3>
          <div style="
            background: linear-gradient(135deg, #fefefe 0%, #f8f6f1 100%);
            border-radius: 12px;
            padding: 28px 24px;
            box-shadow: 
              0 2px 8px rgba(0,0,0,0.06),
              0 4px 20px rgba(0,0,0,0.04),
              inset 0 1px 0 rgba(255,255,255,0.8);
            position: relative;
            border: 1px solid #e8e4dc;
          " class="paper-summary">
            <!-- Texture papier subtile -->
            <div style="
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background-image: 
                repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(200,180,160,0.03) 28px, rgba(200,180,160,0.03) 29px);
              pointer-events: none;
              border-radius: 12px;
            "></div>
            <div style="
              font-family: Georgia, serif;
              font-size: 20px;
              line-height: 1.9;
              color: #3a352f;
              position: relative;
              z-index: 1;
            ">
              ${parseSummary(b.summary)}
            </div>
          </div>
        </div>

        <!-- 6. PASSERELLE VERS LE LIVRE (Amazon) -->
        ${b.amazon_url ? `
          <div style="margin-bottom: 32px; text-align: center; padding: 24px; border: 1px solid var(--border-color); border-radius: 12px;">
            <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">
              Cet enseignement est une introduction. L'enseignement complet vous accompagne vers une mise en pratique plus profonde.
            </p>
            <a href="${b.amazon_url}" target="_blank" class="btn-primary" style="display: inline-block; width: auto; padding: 12px 24px; text-decoration: none;">
              Accéder à la ressource complète
            </a>
          </div>
        ` : ''}

        <!-- 7. INTERACTION UTILISATEUR -->
        <div style="display: flex; gap: 16px; border-top: 1px solid var(--border-color); padding-top: 24px;">
          <button id="book-like-btn" class="post-action-btn ${b.is_liked ? 'liked-active' : ''}" style="flex: 1; justify-content: center; background: var(--bg-surface-2); padding: 12px; border-radius: 8px;">
            <svg viewBox="0 0 24 24" fill="${b.is_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="24" height="24">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            <span style="font-weight: 600;">${b.likes_count || 0} Likes</span>
          </button>
          
          <button id="book-share-btn" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent; border: 1px solid var(--border-color); color: var(--text); border-radius: 8px; cursor: pointer; font-weight: 600;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Partager
          </button>
        </div>
      </div>
    `;
  }

  function bindEvents(container, b) {
    // Bouton retour
    container.querySelector('#back-btn').addEventListener('click', () => {
      // Retour à la page précédente (simplifié : explore par défaut)
      App.navigateTo('explore');
    });

    // Like
    const likeBtn = container.querySelector('#book-like-btn');
    likeBtn.addEventListener('click', async () => {
      if (likeBtn.disabled) return; // Prevent multiple clicks
      
      likeBtn.disabled = true;
      const originalLiked = b.is_liked;
      const originalCount = b.likes_count;
      
      // Optimistic update
      b.is_liked = !originalLiked;
      b.likes_count = originalLiked ? Math.max(0, originalCount - 1) : originalCount + 1;
      likeBtn.classList.toggle('liked-active', b.is_liked);
      likeBtn.querySelector('span').textContent = `${b.likes_count} Likes`;
      const svg = likeBtn.querySelector('svg');
      svg.setAttribute('fill', b.is_liked ? 'currentColor' : 'none');
      svg.style.animation = 'heartPulse 0.5s ease';
      
      try {
        const res = await api.toggleBookLike(b.id);
        // Use server response for accurate count
        b.is_liked = res.liked;
        b.likes_count = res.likes_count || b.likes_count;
        likeBtn.classList.toggle('liked-active', res.liked);
        likeBtn.querySelector('span').textContent = `${b.likes_count} Likes`;
        svg.setAttribute('fill', res.liked ? 'currentColor' : 'none');
      } catch (e) {
        // Revert on error
        b.is_liked = originalLiked;
        b.likes_count = originalCount;
        likeBtn.classList.toggle('liked-active', originalLiked);
        likeBtn.querySelector('span').textContent = `${b.likes_count} Likes`;
        svg.setAttribute('fill', originalLiked ? 'currentColor' : 'none');
        console.error('Like error:', e);
      } finally {
        likeBtn.disabled = false;
        setTimeout(() => svg.style.animation = '', 500);
      }
    });

    // Partage
    container.querySelector('#book-share-btn').addEventListener('click', () => {
      // Simulation de copie de lien
      navigator.clipboard.writeText(`Découvre cet enseignement chrétien : ${b.title} sur Revelio !`).then(() => {
        alert('Lien copié dans le presse-papier !');
      });
    });

    // Lecteur Audio Global (remplace le lecteur local)
    if (b.audio_url) {
      const playBtn = container.querySelector('#audio-play-btn');
      const progress = container.querySelector('#audio-progress');
      const speedBtn = container.querySelector('#audio-speed-btn');
      const video = container.querySelector('video');

      // Restaurer l'état visuel au chargement si ce cours est déjà en cours
      const state = AudioManager.getPlaybackState(b.id);
      if (state.isActive) {
        if (state.isPlaying) {
          playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        }
        if (state.duration) progress.value = (state.currentTime / state.duration) * 100;
        speedBtn.textContent = `${state.speed}x`;
      }

      playBtn.addEventListener('click', () => {
        // Pause video si en cours de lecture
        if (video && !video.paused) {
          video.pause();
        }

        if (!AudioManager.isBookPlaying(b.id) && !AudioManager.getPlaybackState(b.id).isActive) {
           AudioManager.playBook(b); // Lancer ce cours pour la première fois
        } else {
           AudioManager.togglePlay(); // Play/Pause du lecteur en cours
        }
      });

      // Synchronisation visuelle depuis AudioManager
      AudioManager.onSync(
        (currentTime, duration) => {
          if (duration) progress.value = (currentTime / duration) * 100;
        },
        (isPlaying) => {
          if (isPlaying) {
            playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
          } else {
            playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>`;
          }
        }
      );

      progress.addEventListener('input', (e) => {
        if (AudioManager.getPlaybackState(b.id).isActive) {
          AudioManager.seek(e.target.value);
        }
      });

      speedBtn.addEventListener('click', () => {
        if (AudioManager.getPlaybackState(b.id).isActive) {
          const s = AudioManager.toggleSpeed();
          speedBtn.textContent = `${s}x`;
        }
      });
      
      // Pause audio automatically if user starts playing video
      if (video) {
        video.addEventListener('play', () => {
           if (AudioManager.isBookPlaying(b.id)) {
             AudioManager.togglePlay();
           }
        });
      }
    }

    // Suivi de la progression vidéo
    const videoEl = container.querySelector('#book-video');
    if (videoEl) {
      videoEl.addEventListener('ended', () => {
        api.updateProgress(b.id, 100).catch(e => console.error(e));
      });
      videoEl.addEventListener('pause', () => {
        if (videoEl.duration) {
          const pct = Math.round((videoEl.currentTime / videoEl.duration) * 100);
          api.updateProgress(b.id, pct).catch(e => console.error(e));
        }
      });
    }

    // Suivi de la progression basé sur un timer de 1 minute
    const summarySection = container.querySelector('#section-summary');
    if (summarySection) {
      let timerInterval = null;
      let startTime = null;
      let timeRemaining = 60; // 1 minute en secondes
      let isActive = false;
      
      // Clé pour sauvegarder l'état du timer pour ce cours
      const timerStateKey = `timer_state_${b.id}`;
      
      // Récupérer l'état sauvegardé du timer
      const loadTimerState = () => {
        try {
          console.log('🔍 Clé de recherche:', timerStateKey);
          const savedState = localStorage.getItem(timerStateKey);
          console.log('📦 État brut trouvé:', savedState);
          
          if (savedState) {
            const state = JSON.parse(savedState);
            console.log('📂 État du timer chargé:', state);
            
            // Vérifier que l'état est valide
            if (state && typeof state === 'object' && state.bookId === b.id) {
              return state;
            } else {
              console.warn('⚠️ État invalide, nettoyage...');
              clearTimerState();
            }
          } else {
            console.log('ℹ️ Aucun état sauvegardé trouvé');
          }
        } catch (e) {
          console.error('❌ Erreur chargement état timer:', e);
          clearTimerState(); // Nettoyer en cas d'erreur
        }
        return null;
      };
      
      // Sauvegarder l'état du timer
      const saveTimerState = () => {
        try {
          const state = {
            timeRemaining,
            isActive,
            startTime,
            bookId: b.id,
            lastSaved: Date.now()
          };
          
          // Vérifier que l'état est cohérent avant de sauvegarder
          if (timeRemaining >= 0 && timeRemaining <= 60) {
            localStorage.setItem(timerStateKey, JSON.stringify(state));
            console.log('💾 État du timer sauvegardé:', state);
            console.log('🔑 Clé utilisée:', timerStateKey);
          } else {
            console.warn('⚠️ Éat incohérent, pas de sauvegarde:', { timeRemaining, isActive });
          }
        } catch (e) {
          console.error('❌ Erreur sauvegarde état timer:', e);
        }
      };
      
      // Nettoyer l'état du timer quand terminé
      const clearTimerState = () => {
        try {
          localStorage.removeItem(timerStateKey);
          console.log('🧹 État du timer nettoyé pour la clé:', timerStateKey);
        } catch (e) {
          console.error('❌ Erreur nettoyage état timer:', e);
        }
      };
      
      // Forcer une sauvegarde immédiate pour debugging
      const forceSaveState = () => {
        console.log('🔥 Force save de l\'état actuel');
        saveTimerState();
      };
      
      // Ajouter un indicateur de timer visible
      const timerIndicator = document.createElement('div');
      timerIndicator.style.cssText = `
        position: sticky;
        top: 10px;
        background: var(--primary);
        color: white;
        padding: 12px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 16px;
        z-index: 10;
        text-align: center;
        max-width: 250px;
        margin-left: auto;
        margin-right: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      timerIndicator.innerHTML = `
        <div style="margin-bottom: 4px;">⏱️ Temps d'étude</div>
        <div style="font-size: 18px;">1:00</div>
        <button id="start-timer-btn" style="
          margin-top: 8px;
          padding: 6px 12px;
          background: white;
          color: var(--primary);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
        ">Commencer l'enseignement</button>
        <button id="debug-save-btn" style="
          margin-top: 4px;
          padding: 4px 8px;
          background: #ff6b6b;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 600;
        ">Debug Save</button>
      `;
      summarySection.insertBefore(timerIndicator, summarySection.firstChild);
      
      const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };
      
      const updateTimerDisplay = () => {
        const timeDisplay = timerIndicator.querySelector('div:nth-child(2)');
        const startBtn = timerIndicator.querySelector('#start-timer-btn');
        
        if (isActive) {
          timeDisplay.textContent = formatTime(timeRemaining);
          startBtn.textContent = 'Pause';
          startBtn.style.background = '#ff6b6b';
          startBtn.style.color = 'white';
        } else if (timeRemaining === 60) {
          timeDisplay.textContent = formatTime(timeRemaining);
          startBtn.textContent = 'Commencer l\'enseignement';
          startBtn.style.background = 'white';
          startBtn.style.color = 'var(--primary)';
        } else {
          timeDisplay.textContent = formatTime(timeRemaining);
          startBtn.textContent = 'Reprendre';
          startBtn.style.background = 'white';
          startBtn.style.color = 'var(--primary)';
        }
      };
      
      const startTimer = () => {
        console.log('▶️ Tentative de démarrage du timer, isActive:', isActive);
        if (!isActive) {
          console.log('✅ Démarrage du timer autorisé');
          isActive = true;
          startTime = Date.now() - (60 - timeRemaining) * 1000;
          
          console.log('⏱️ Timer démarré - startTime:', startTime, 'timeRemaining:', timeRemaining);
          
          timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            timeRemaining = Math.max(0, 60 - elapsed);
            
            // Calculer la progression
            const progress = Math.round(((60 - timeRemaining) / 60) * 100);
            
            console.log('⏰ Timer tick - elapsed:', elapsed, 'timeRemaining:', timeRemaining, 'progress:', progress + '%');
            
            // Mettre à jour l'affichage
            updateTimerDisplay();
            
            // Sauvegarder l'état toutes les secondes
            saveTimerState();
            
            // Envoyer la progression au backend
            api.updateProgress(b.id, progress).catch(e => console.error('Erreur updateProgress:', e));
            
            // Marquer comme complété à 100%
            if (timeRemaining === 0) {
              console.log('🎉 Timer terminé !');
              clearInterval(timerInterval);
              isActive = false;
              clearTimerState(); // Nettoyer l'état quand terminé
              if (timerIndicator) {
                timerIndicator.innerHTML = `
                  <div style="margin-bottom: 4px;">✅ Enseignement terminé</div>
                  <div style="font-size: 18px; color: #4CAF50;">100%</div>
                  <div style="font-size: 12px; margin-top: 4px;">Enseignement marqué comme terminé</div>
                `;
              }
            }
          }, 1000);
        } else {
          console.log('⚠️ Timer déjà actif, démarrage ignoré');
        }
      };
      
      const pauseTimer = () => {
        if (isActive) {
          clearInterval(timerInterval);
          isActive = false;
          saveTimerState(); // Sauvegarder l'état quand on pause
          updateTimerDisplay();
        }
      };
      
      // Initialiser le timer avec l'état sauvegardé
      const initializeTimer = () => {
        console.log('🔧 Initialisation du timer pour le cours:', b.id);
        const savedState = loadTimerState();
        
        if (savedState && savedState.bookId === b.id) {
          console.log('📂 État sauvegardé trouvé:', savedState);
          // Restaurer l'état sauvegardé
          timeRemaining = savedState.timeRemaining;
          isActive = savedState.isActive;
          
          // Calculer le temps écoulé depuis la sauvegarde (toujours, sauf si terminé)
          if (savedState.lastSaved && timeRemaining > 0) {
            const elapsedSinceSave = Math.floor((Date.now() - savedState.lastSaved) / 1000);
            timeRemaining = Math.max(0, timeRemaining - elapsedSinceSave);
            
            console.log('⏰ Temps écoulé depuis sauvegarde:', elapsedSinceSave, 'secondes');
            console.log('⏱️ Temps restant après calcul:', timeRemaining, 'secondes');
            
            if (timeRemaining === 0) {
              // Le timer est terminé pendant que l'onglet était fermé
              console.log('✅ Timer terminé pendant la fermeture');
              clearTimerState();
              isActive = false;
              if (timerIndicator) {
                timerIndicator.innerHTML = `
                  <div style="margin-bottom: 4px;">✅ Enseignement terminé</div>
                  <div style="font-size: 18px; color: #4CAF50;">100%</div>
                  <div style="font-size: 12px; margin-top: 4px;">Enseignement marqué comme terminé</div>
                `;
              }
            } else {
              // Reprendre automatiquement le timer là où il s'est arrêté
              console.log('🔄 Reprise automatique du timer, temps restant:', timeRemaining);
              startTimer();
            }
          } else if (timeRemaining === 0) {
            // Timer était déjà terminé
            console.log('✅ Timer déjà terminé');
            clearTimerState();
            isActive = false;
            if (timerIndicator) {
              timerIndicator.innerHTML = `
                <div style="margin-bottom: 4px;">✅ Enseignement terminé</div>
                <div style="font-size: 18px; color: #4CAF50;">100%</div>
                <div style="font-size: 12px; margin-top: 4px;">Enseignement marqué comme terminé</div>
              `;
            }
          } else {
            // Cas par défaut : reprendre quand même pour être sûr
            console.log('🔄 Reprise par défaut du timer, temps restant:', timeRemaining);
            startTimer();
          }
        } else {
          // Pas d'état sauvegardé, commencer automatiquement
          console.log('🚀 Pas d\'état sauvegardé, démarrage automatique du timer');
          startTimer();
        }
      };
      
      // Gérer le bouton start/pause
      const startBtn = timerIndicator.querySelector('#start-timer-btn');
      startBtn.addEventListener('click', () => {
        if (isActive) {
          pauseTimer();
        } else {
          startTimer();
        }
      });
      
      // Gérer le bouton de debugging
      const debugBtn = timerIndicator.querySelector('#debug-save-btn');
      debugBtn.addEventListener('click', () => {
        console.log('🔍 Debug: État actuel du timer:', {
          timeRemaining,
          isActive,
          startTime,
          bookId: b.id,
          timerStateKey
        });
        
        // Forcer une sauvegarde
        forceSaveState();
        
        // Vérifier ce qui est dans localStorage
        const saved = localStorage.getItem(timerStateKey);
        console.log('🔍 Debug: Contenu de localStorage:', saved);
        
        // Essayer de recharger
        const reloaded = loadTimerState();
        console.log('🔍 Debug: État rechargé:', reloaded);
      });
      
      // Nettoyage quand on quitte la page ou ferme l'onglet
      const cleanup = () => {
        if (timerInterval) {
          clearInterval(timerInterval);
          saveTimerState(); // Sauvegarder l'état au nettoyage
        }
      };
      
      // Écouter les événements de fermeture d'onglet
      window.addEventListener('beforeunload', cleanup);
      window.addEventListener('pagehide', cleanup);
      
      // Initialiser le timer automatiquement
      initializeTimer();
    }
  }

  return { render };
})();

window.BookDetailPage = BookDetailPage;
