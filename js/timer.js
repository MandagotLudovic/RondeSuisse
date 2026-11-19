/*
 * Ronde Suisse — timer.
 * L'état du timer est un objet simple (sérialisable) :
 *   { duration: ms, remaining: ms, endAt: timestamp | null, alerted: bool }
 * Quand il tourne, le temps restant est calculé à partir de endAt :
 * il reste exact même si l'onglet est en arrière-plan ou rechargé.
 */
(function (root) {
  'use strict';

  const MIN = 60 * 1000;

  function create(minutes) {
    const d = Math.max(0, Math.round(minutes * MIN));
    return { duration: d, remaining: d, endAt: null, alerted: false };
  }

  function isRunning(t) {
    return t.endAt !== null;
  }

  function remaining(t, now) {
    if (t.endAt === null) return t.remaining;
    return t.endAt - (now || Date.now()); // peut être négatif (temps dépassé)
  }

  function start(t) {
    if (t.endAt === null) t.endAt = Date.now() + t.remaining;
  }

  function pause(t) {
    if (t.endAt !== null) {
      t.remaining = t.endAt - Date.now();
      t.endAt = null;
    }
  }

  function reset(t) {
    t.endAt = null;
    t.remaining = t.duration;
    t.alerted = false;
  }

  function setDuration(t, minutes) {
    t.duration = Math.max(0, Math.round(minutes * MIN));
    reset(t);
  }

  function add(t, minutes) {
    const delta = minutes * MIN;
    if (t.endAt !== null) t.endAt += delta;
    else t.remaining += delta;
    if (remaining(t) > 0) t.alerted = false;
  }

  function format(ms) {
    const neg = ms < 0;
    const total = Math.ceil(Math.abs(ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    const body = h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
    return (neg ? '+' : '') + body;
  }

  /** Seuil d'alerte orange : 5 min, ou 20 % de la durée pour les timers courts. */
  function warnThreshold(t) {
    return Math.min(5 * MIN, t.duration * 0.2);
  }

  let audioCtx = null;
  function beep(times) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const n = times || 3;
      for (let i = 0; i < n; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const at = audioCtx.currentTime + i * 0.45;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
        osc.start(at);
        osc.stop(at + 0.4);
      }
    } catch (e) {
      /* son indisponible */
    }
  }

  /** À appeler depuis un geste utilisateur pour débloquer le son sur certains navigateurs. */
  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {
      /* ignore */
    }
  }

  root.Timer = { MIN, create, isRunning, remaining, start, pause, reset, setDuration, add, format, warnThreshold, beep, unlockAudio };
})(typeof self !== 'undefined' ? self : this);
