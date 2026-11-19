/*
 * Ronde Suisse — installation sur mobile (PWA).
 */
(function () {
  'use strict';

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* hors HTTPS ou non supporté : l'app fonctionne quand même */
      });
    });
  }

  // Bouton « Installer » (Chrome / Android) quand le navigateur le propose.
  const btn = document.getElementById('install-btn');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
  });
})();
