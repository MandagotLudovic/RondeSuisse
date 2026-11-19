// Lancer avec : node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Swiss = require('../js/swiss.js');

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + 1), name: 'Joueur ' + (i + 1), dropped: false }));
}

// Générateur pseudo-aléatoire reproductible
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const RESULTS = [
  { g1: 2, g2: 0, gd: 0 },
  { g1: 2, g2: 1, gd: 0 },
  { g1: 1, g2: 2, gd: 0 },
  { g1: 0, g2: 2, gd: 0 },
  { g1: 1, g2: 1, gd: 0 },
];

function playRound(players, rounds, rng) {
  const matches = Swiss.pairNextRound(players, rounds, rng);
  matches.forEach((m) => {
    if (m.p2 !== null) m.result = RESULTS[Math.floor(rng() * RESULTS.length)];
  });
  rounds.push({ matches });
  return matches;
}

function allPairs(rounds) {
  const keys = [];
  rounds.forEach((r) =>
    r.matches.forEach((m) => {
      if (m.p2 !== null) keys.push([m.p1, m.p2].sort().join('|'));
    })
  );
  return keys;
}

test('ronde 1 : chaque joueur est apparié exactement une fois', () => {
  const players = makePlayers(8);
  const matches = Swiss.pairNextRound(players, [], seeded(1));
  assert.equal(matches.length, 4);
  const ids = matches.flatMap((m) => [m.p1, m.p2]);
  assert.equal(new Set(ids).size, 8);
});

test('ronde 1 : appariement aléatoire (varie selon le tirage)', () => {
  const players = makePlayers(8);
  const a = JSON.stringify(Swiss.pairNextRound(players, [], seeded(1)));
  const b = JSON.stringify(Swiss.pairNextRound(players, [], seeded(99)));
  assert.notEqual(a, b);
});

test('aucune revanche sur 3 rondes à 8 joueurs (nombreux tirages)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = seeded(seed);
    const players = makePlayers(8);
    const rounds = [];
    for (let r = 0; r < 3; r++) playRound(players, rounds, rng);
    const keys = allPairs(rounds);
    assert.equal(new Set(keys).size, keys.length, 'revanche détectée (seed ' + seed + ')');
  }
});

test('nombre impair : un seul bye par ronde, jamais deux fois le même joueur', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed);
    const players = makePlayers(7);
    const rounds = [];
    const byes = [];
    for (let r = 0; r < 4; r++) {
      const matches = playRound(players, rounds, rng);
      const b = matches.filter((m) => m.p2 === null);
      assert.equal(b.length, 1);
      byes.push(b[0].p1);
      const ids = matches.flatMap((m) => [m.p1, m.p2]).filter((x) => x !== null);
      assert.equal(new Set(ids).size, 7);
    }
    assert.equal(new Set(byes).size, byes.length, 'bye attribué deux fois (seed ' + seed + ')');
    const keys = allPairs(rounds);
    assert.equal(new Set(keys).size, keys.length, 'revanche détectée (seed ' + seed + ')');
  }
});

test('le bye compte comme une victoire 2-0', () => {
  const players = makePlayers(3);
  const rounds = [{ matches: [{ p1: 'p1', p2: 'p2', result: { g1: 2, g2: 1, gd: 0 } }, { p1: 'p3', p2: null }] }];
  const st = Swiss.computeStats(players, rounds).get('p3');
  assert.equal(st.points, 3);
  assert.equal(st.wins, 1);
  assert.equal(st.gameWins, 2);
  assert.equal(st.gwp, 1);
  assert.equal(st.omw, 0); // le bye ne compte pas comme adversaire
});

test('les joueurs ayant le même nombre de points se rencontrent', () => {
  const players = makePlayers(8);
  const rounds = [
    {
      matches: [
        { p1: 'p1', p2: 'p2', result: { g1: 2, g2: 0, gd: 0 } },
        { p1: 'p3', p2: 'p4', result: { g1: 2, g2: 0, gd: 0 } },
        { p1: 'p5', p2: 'p6', result: { g1: 2, g2: 0, gd: 0 } },
        { p1: 'p7', p2: 'p8', result: { g1: 2, g2: 0, gd: 0 } },
      ],
    },
  ];
  const winners = new Set(['p1', 'p3', 'p5', 'p7']);
  for (let seed = 1; seed <= 50; seed++) {
    const matches = Swiss.pairNextRound(players, rounds, seeded(seed));
    matches.forEach((m) => assert.equal(winners.has(m.p1), winners.has(m.p2)));
  }
});

test('départages : points, puis OMW%, GW%, OGW% avec plancher à 33 %', () => {
  const players = makePlayers(4);
  const rounds = [
    {
      matches: [
        { p1: 'p1', p2: 'p2', result: { g1: 2, g2: 0, gd: 0 } },
        { p1: 'p3', p2: 'p4', result: { g1: 2, g2: 1, gd: 0 } },
      ],
    },
    {
      matches: [
        { p1: 'p1', p2: 'p3', result: { g1: 2, g2: 1, gd: 0 } },
        { p1: 'p2', p2: 'p4', result: { g1: 2, g2: 1, gd: 0 } }, // p2 et p3 à égalité de points et d'OMW, départagés au GW%
      ],
    },
  ];
  const st = Swiss.standings(players, rounds);
  assert.deepEqual(st.map((s) => s.id), ['p1', 'p3', 'p2', 'p4']);
  const p4 = st.find((s) => s.id === 'p4');
  assert.equal(p4.points, 0);
  assert.ok(Math.abs(p4.mwp - 1 / 3) < 1e-9, 'plancher 33 %');
  // p1 : adversaires p2 (50 %) et p3 (50 %) => OMW 50 %
  assert.ok(Math.abs(st[0].omw - 0.5) < 1e-9);
  // p1 : 4 parties gagnées sur 5 => GW 80 %
  assert.ok(Math.abs(st[0].gwp - 0.8) < 1e-9);
});

test('match nul (1-1) : 1 point chacun', () => {
  const players = makePlayers(2);
  const rounds = [{ matches: [{ p1: 'p1', p2: 'p2', result: { g1: 1, g2: 1, gd: 0 } }] }];
  const st = Swiss.computeStats(players, rounds);
  assert.equal(st.get('p1').points, 1);
  assert.equal(st.get('p2').points, 1);
});

test('les joueurs ayant abandonné ne sont plus appariés', () => {
  const players = makePlayers(6);
  const rng = seeded(5);
  const rounds = [];
  playRound(players, rounds, rng);
  players[0].dropped = true;
  const matches = Swiss.pairNextRound(players, rounds, rng);
  const ids = matches.flatMap((m) => [m.p1, m.p2]);
  assert.ok(!ids.includes('p1'));
  assert.equal(matches.filter((m) => m.p2 === null).length, 1); // 5 actifs => 1 bye
});

test('rondes supplémentaires : revanche autorisée seulement si inévitable', () => {
  const players = makePlayers(4);
  const rng = seeded(3);
  const rounds = [];
  for (let r = 0; r < 3; r++) playRound(players, rounds, rng);
  // 4 joueurs, 3 rondes : toutes les paires ont été jouées
  assert.equal(new Set(allPairs(rounds)).size, 6);
  const matches = Swiss.pairNextRound(players, rounds, rng);
  assert.equal(matches.length, 2); // une 4e ronde reste possible
});
