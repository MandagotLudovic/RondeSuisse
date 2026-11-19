/*
 * Ronde Suisse — données du tournoi et sauvegarde automatique (localStorage).
 */
(function (root) {
  'use strict';

  const KEY = 'ronde-suisse-v1';
  const BASE_ROUNDS = 3;

  function newState() {
    return {
      version: 1,
      name: '',
      players: [], // { id, name, dropped }
      durations: { draft: 50, seating: 5, build: 30, round: 50 }, // minutes
      seating: [], // ids dans l'ordre des places
      step: 'setup', // setup | draft | seating | build | round | standings | final
      rounds: [], // { matches: [{ p1, p2|null, result: {g1,g2,gd}|null }] }
      timers: {}, // clé d'étape -> état du timer
    };
  }

  function isValid(s) {
    return (
      s &&
      typeof s === 'object' &&
      Array.isArray(s.players) &&
      Array.isArray(s.rounds) &&
      typeof s.step === 'string' &&
      s.durations &&
      typeof s.durations === 'object'
    );
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return newState();
      const s = JSON.parse(raw);
      return isValid(s) ? Object.assign(newState(), s) : newState();
    } catch (e) {
      return newState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* stockage indisponible : le tournoi continue en mémoire */
    }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      /* ignore */
    }
  }

  root.Store = { KEY, BASE_ROUNDS, newState, isValid, load, save, clear };
})(typeof self !== 'undefined' ? self : this);
