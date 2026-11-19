/*
 * Ronde Suisse — logique du système suisse (appariements, points, départages).
 * Utilisable dans le navigateur (window.Swiss) et dans Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Swiss = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WIN = 3;
  const DRAW = 1;
  const FLOOR = 1 / 3; // plancher des pourcentages (règle officielle : 33 %)
  const EPS = 1e-9;

  function shuffle(array, rng) {
    const r = rng || Math.random;
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Un match est terminé s'il s'agit d'un bye ou si un résultat est saisi. */
  function isComplete(match) {
    return match.p2 === null || !!match.result;
  }

  /**
   * Calcule les statistiques de chaque joueur à partir des rondes jouées.
   * Seuls les matchs terminés sont comptés.
   */
  function computeStats(players, rounds) {
    const stats = new Map();
    players.forEach((p) => {
      stats.set(p.id, {
        id: p.id,
        name: p.name,
        dropped: !!p.dropped,
        points: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        gamePoints: 0,
        games: 0,
        gameWins: 0,
        gameLosses: 0,
        byes: 0,
        opponents: [],
      });
    });

    rounds.forEach((round) => {
      round.matches.forEach((m) => {
        const a = stats.get(m.p1);
        if (!a) return;
        if (m.p2 === null) {
          // Bye : victoire 2-0
          a.points += WIN;
          a.matches += 1;
          a.wins += 1;
          a.byes += 1;
          a.gamePoints += 2 * WIN;
          a.games += 2;
          a.gameWins += 2;
          return;
        }
        if (!m.result) return;
        const b = stats.get(m.p2);
        if (!b) return;
        const g1 = m.result.g1 || 0;
        const g2 = m.result.g2 || 0;
        const gd = m.result.gd || 0;
        a.matches += 1;
        b.matches += 1;
        a.opponents.push(b.id);
        b.opponents.push(a.id);
        a.games += g1 + g2 + gd;
        b.games += g1 + g2 + gd;
        a.gamePoints += g1 * WIN + gd * DRAW;
        b.gamePoints += g2 * WIN + gd * DRAW;
        a.gameWins += g1;
        a.gameLosses += g2;
        b.gameWins += g2;
        b.gameLosses += g1;
        if (g1 > g2) {
          a.points += WIN;
          a.wins += 1;
          b.losses += 1;
        } else if (g2 > g1) {
          b.points += WIN;
          b.wins += 1;
          a.losses += 1;
        } else {
          a.points += DRAW;
          b.points += DRAW;
          a.draws += 1;
          b.draws += 1;
        }
      });
    });

    stats.forEach((s) => {
      s.mwp = s.matches > 0 ? Math.max(FLOOR, s.points / (WIN * s.matches)) : 0;
      s.gwp = s.games > 0 ? Math.max(FLOOR, s.gamePoints / (WIN * s.games)) : 0;
    });
    stats.forEach((s) => {
      const opps = s.opponents.map((id) => stats.get(id));
      s.omw = opps.length ? opps.reduce((t, o) => t + o.mwp, 0) / opps.length : 0;
      s.ogw = opps.length ? opps.reduce((t, o) => t + o.gwp, 0) / opps.length : 0;
    });
    return stats;
  }

  function compareStats(a, b) {
    if (a.points !== b.points) return b.points - a.points;
    if (Math.abs(a.omw - b.omw) > EPS) return b.omw - a.omw;
    if (Math.abs(a.gwp - b.gwp) > EPS) return b.gwp - a.gwp;
    if (Math.abs(a.ogw - b.ogw) > EPS) return b.ogw - a.ogw;
    return 0;
  }

  /** Classement trié avec rang (les ex aequo parfaits partagent le rang). */
  function standings(players, rounds) {
    const list = Array.from(computeStats(players, rounds).values());
    list.sort((a, b) => compareStats(a, b) || a.name.localeCompare(b.name, 'fr'));
    list.forEach((s, i) => {
      s.rank = i > 0 && compareStats(list[i - 1], s) === 0 ? list[i - 1].rank : i + 1;
    });
    return list;
  }

  function pairKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  /**
   * Apparie une liste ordonnée (meilleurs en premier) par retour arrière,
   * en évitant les revanches. Retourne null si impossible.
   */
  function pairList(list, played, allowRematch, budget) {
    if (list.length === 0) return [];
    if (--budget.left < 0) return null;
    const first = list[0];
    for (let i = 1; i < list.length; i++) {
      const other = list[i];
      if (!allowRematch && played.has(pairKey(first, other))) continue;
      const rest = list.slice(1, i).concat(list.slice(i + 1));
      const sub = pairList(rest, played, allowRematch, budget);
      if (sub) return [[first, other]].concat(sub);
      if (budget.left < 0) return null;
    }
    return null;
  }

  /**
   * Génère les appariements de la prochaine ronde.
   * - Ronde 1 : aléatoire.
   * - Rondes suivantes : joueurs à égalité de points ensemble (ordre aléatoire
   *   au sein d'un même total), sans revanche.
   * - Nombre impair : bye au joueur le moins bien classé n'en ayant pas eu.
   * Retourne [{p1, p2}] où p2 === null signifie un bye.
   */
  function pairNextRound(players, rounds, rng) {
    const active = players.filter((p) => !p.dropped);
    if (active.length < 2) throw new Error('Il faut au moins 2 joueurs actifs.');

    const toMatches = (pairs, bye) => {
      const matches = pairs.map(([p1, p2]) => ({ p1, p2 }));
      if (bye !== undefined && bye !== null) matches.push({ p1: bye, p2: null });
      return matches;
    };

    if (rounds.length === 0) {
      const ids = shuffle(active.map((p) => p.id), rng);
      const bye = ids.length % 2 === 1 ? ids.pop() : null;
      const pairs = [];
      for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
      return toMatches(pairs, bye);
    }

    const stats = computeStats(players, rounds);
    const activeIds = new Set(active.map((p) => p.id));
    // Groupes par points, mélangés à l'intérieur de chaque groupe.
    const groups = new Map();
    active.forEach((p) => {
      const pts = stats.get(p.id).points;
      if (!groups.has(pts)) groups.set(pts, []);
      groups.get(pts).push(p.id);
    });
    const order = Array.from(groups.keys())
      .sort((a, b) => b - a)
      .flatMap((pts) => shuffle(groups.get(pts), rng));

    const played = new Set();
    rounds.forEach((r) =>
      r.matches.forEach((m) => {
        if (m.p2 !== null && activeIds.has(m.p1) && activeIds.has(m.p2)) played.add(pairKey(m.p1, m.p2));
      })
    );

    const tryPair = (allowRematch) => {
      if (order.length % 2 === 0) {
        const pairs = pairList(order, played, allowRematch, { left: 200000 });
        return pairs ? toMatches(pairs, null) : null;
      }
      // Candidats au bye : du moins bien classé au mieux classé, ceux sans bye d'abord.
      const ranked = standings(players, rounds).filter((s) => activeIds.has(s.id)).reverse();
      const candidates = ranked.filter((s) => s.byes === 0).concat(ranked.filter((s) => s.byes > 0));
      for (const c of candidates) {
        const rest = order.filter((id) => id !== c.id);
        const pairs = pairList(rest, played, allowRematch, { left: 50000 });
        if (pairs) return toMatches(pairs, c.id);
      }
      return null;
    };

    return tryPair(false) || tryPair(true);
  }

  /** Vainqueur d'un match : id, 'draw', ou null si pas de résultat. */
  function winnerOf(match) {
    if (match.p2 === null) return match.p1;
    if (!match.result) return null;
    const { g1, g2 } = match.result;
    if (g1 > g2) return match.p1;
    if (g2 > g1) return match.p2;
    return 'draw';
  }

  return {
    shuffle,
    isComplete,
    computeStats,
    standings,
    pairNextRound,
    winnerOf,
    POINTS: { WIN, DRAW, LOSS: 0 },
  };
});
