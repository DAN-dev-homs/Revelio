// ============================================================
// REVELIO — i18n System (i18n.js)
// Gestion des traductions FR/EN
// ============================================================

const i18n = (() => {
  let currentLang = localStorage.getItem('revelio_lang') || 'fr';
  let translations = {};

  /** Charge les fichiers de traduction */
  async function load() {
    const [fr, en] = await Promise.all([
      fetch('/assets/i18n/fr.json').then(r => r.json()),
      fetch('/assets/i18n/en.json').then(r => r.json()),
    ]);
    translations = { fr: fr.fr, en: en.en };
    applyToDOM();
  }

  /** Retourne la valeur pour une clé "section.key" */
  function t(key) {
    const parts  = key.split('.');
    let   result = translations[currentLang];
    for (const part of parts) {
      result = result?.[part];
      if (result === undefined) break;
    }
    return result ?? key;
  }

  /** Applique data-i18n="key" dans tout le DOM */
  function applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
  }

  /** Bascule la langue */
  function toggle() {
    currentLang = currentLang === 'fr' ? 'en' : 'fr';
    localStorage.setItem('revelio_lang', currentLang);
    applyToDOM();
    // Mettre à jour le badge langue
    const badge = document.getElementById('lang-toggle');
    if (badge) badge.textContent = currentLang.toUpperCase();
    // Ré-afficher la page active
    window.dispatchEvent(new CustomEvent('langChanged'));
  }

  function getLang()  { return currentLang; }

  /** Traduit un texte dynamique généré par les utilisateurs (base supposée FR) */
  async function translateDynamic(text) {
    if (!text || currentLang === 'fr') return text;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${currentLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      let translatedText = '';
      if (data && data[0]) {
        data[0].forEach(item => { if (item[0]) translatedText += item[0]; });
        return translatedText;
      }
    } catch(e) {
      console.warn("Translation failed", e);
    }
    return text;
  }

  return { load, t, toggle, getLang, applyToDOM, translateDynamic };
})();

window.i18n = i18n;
