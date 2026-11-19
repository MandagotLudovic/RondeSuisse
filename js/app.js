/*
 * Ronde Suisse — interface : navigation entre les étapes, écrans, timer.
 */
(function () {
  'use strict';

  let state = Store.load();
  const app = document.getElementById('app');
  const stepper = document.getElementById('stepper');

  // ---------- Utilitaires ----------

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pct = (x) => (x * 100).toFixed(1).replace('.', ',') + ' %';
  const playerById = (id) => state.players.find((p) => p.id === id);
  const nameOf = (id) => (playerById(id) ? playerById(id).name : '?');
  const currentRoundNumber = () => state.rounds.length;
  const lastRound = () => state.rounds[state.rounds.length - 1];

  function commit() {
    Store.save(state);
    render();
  }

  function parsePlayers(text) {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function duplicates(names) {
    const seen = new Map();
    names.forEach((n) => {
      const k = n.toLocaleLowerCase('fr');
      seen.set(k, (seen.get(k) || 0) + 1);
    });
    return names.filter((n, i) => seen.get(n.toLocaleLowerCase('fr')) > 1 && names.indexOf(n) === i);
  }

  const STEP_TITLES = {
    draft: 'Draft',
    seating: 'Placement à la table',
    build: 'Construction de deck',
  };

  // ---------- Timer ----------

  function timerKey() {
    if (state.step === 'round') return 'round-' + currentRoundNumber();
    if (['draft', 'seating', 'build'].includes(state.step)) return state.step;
    return null;
  }

  function getTimer(key) {
    if (!state.timers[key]) {
      const minutes = key.startsWith('round-') ? state.durations.round : state.durations[key];
      state.timers[key] = Timer.create(Number(minutes) || 0);
    }
    return state.timers[key];
  }

  function timerHtml(key, label) {
    const t = getTimer(key);
    const minutes = Math.round(t.duration / Timer.MIN);
    return `
      <section class="timer card" id="timer">
        <div class="timer-head">
          <span class="timer-label">${esc(label)}</span>
          <label class="timer-duration">Durée
            <input type="number" min="1" max="600" step="1" value="${minutes}" data-change="timer-duration" ${Timer.isRunning(t) ? 'disabled' : ''}> min
          </label>
        </div>
        <div class="timer-display" data-timer-display>${Timer.format(Timer.remaining(t))}</div>
        <div class="timer-bar"><div data-timer-bar></div></div>
        <div class="timer-controls">
          <button class="btn btn-primary btn-lg" data-action="timer-toggle" data-timer-toggle>Démarrer</button>
          <button class="btn" data-action="timer-reset">Réinitialiser</button>
          <span class="timer-adjust">
            <button class="btn" data-action="timer-add" data-min="-5">−5</button>
            <button class="btn" data-action="timer-add" data-min="-1">−1</button>
            <button class="btn" data-action="timer-add" data-min="1">+1</button>
            <button class="btn" data-action="timer-add" data-min="5">+5</button>
            <span class="muted">min</span>
          </span>
          <button class="btn" data-action="timer-fullscreen" title="Plein écran">⛶ Plein écran</button>
        </div>
      </section>`;
  }

  // Garde l'écran allumé pendant qu'un timer tourne (téléphone / tablette).
  let wakeLock = null;
  let wakeLockPending = false;
  function keepAwake(on) {
    if (!('wakeLock' in navigator)) return;
    if (on && !wakeLock && !wakeLockPending && document.visibilityState === 'visible') {
      wakeLockPending = true;
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          wakeLock = lock;
          lock.addEventListener('release', () => {
            wakeLock = null;
          });
        })
        .catch(() => {})
        .finally(() => {
          wakeLockPending = false;
        });
    } else if (!on && wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  function tick() {
    const key = timerKey();
    const el = document.getElementById('timer');
    if (!key || !el) {
      document.title = 'Ronde Suisse';
      keepAwake(false);
      return;
    }
    const t = getTimer(key);
    const rem = Timer.remaining(t);
    const running = Timer.isRunning(t);
    el.querySelector('[data-timer-display]').textContent = Timer.format(rem);
    const ratio = t.duration > 0 ? Math.max(0, Math.min(1, rem / t.duration)) : 0;
    el.querySelector('[data-timer-bar]').style.width = ratio * 100 + '%';
    el.classList.toggle('is-running', running);
    el.classList.toggle('is-warn', rem > 0 && rem <= Timer.warnThreshold(t));
    el.classList.toggle('is-over', rem <= 0);
    const toggle = el.querySelector('[data-timer-toggle]');
    toggle.textContent = running ? 'Pause' : rem === t.duration ? 'Démarrer' : 'Reprendre';
    const input = el.querySelector('[data-change="timer-duration"]');
    if (input) input.disabled = running;
    document.title = (running ? Timer.format(rem) + ' · ' : '') + 'Ronde Suisse';
    keepAwake(running);
    if (running && rem <= 0 && !t.alerted) {
      t.alerted = true;
      Store.save(state);
      Timer.beep(4);
      if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
    }
  }
  setInterval(tick, 250);

  // ---------- Barre d'étapes ----------

  function renderStepper() {
    const nbRounds = Math.max(Store.BASE_ROUNDS, state.rounds.length);
    const order = ['setup', 'draft', 'seating', 'build'];
    const items = [
      { id: 'setup', label: 'Configuration' },
      { id: 'draft', label: 'Draft' },
      { id: 'seating', label: 'Placement' },
      { id: 'build', label: 'Construction' },
    ];
    for (let i = 1; i <= nbRounds; i++) items.push({ id: 'round-' + i, label: 'Ronde ' + i, extra: i > Store.BASE_ROUNDS });
    items.push({ id: 'final', label: 'Résultats' });

    let currentIdx;
    if (order.includes(state.step)) currentIdx = order.indexOf(state.step);
    else if (state.step === 'final') currentIdx = items.length - 1;
    else currentIdx = 3 + currentRoundNumber();

    const canGoBack = state.rounds.length === 0;
    stepper.innerHTML = items
      .map((it, i) => {
        const status = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'todo';
        const clickable = canGoBack && i < currentIdx && i < 4;
        return `<li class="step ${status} ${it.extra ? 'extra' : ''}">
          ${clickable ? `<button data-action="goto" data-step="${it.id}">${esc(it.label)}</button>` : `<span>${esc(it.label)}</span>`}
        </li>`;
      })
      .join('');
    const cur = stepper.querySelector('.step.current');
    if (cur) stepper.scrollLeft = cur.offsetLeft - stepper.clientWidth / 2 + cur.clientWidth / 2;
  }

  // ---------- Écrans ----------

  function viewSetup() {
    const names = state.players.map((p) => p.name).join('\n');
    const d = state.durations;
    return `
      <h2>Configuration du tournoi</h2>
      <div class="grid-2">
        <section class="card">
          <label class="field">Nom du tournoi
            <input type="text" id="t-name" value="${esc(state.name)}" placeholder="Draft du vendredi">
          </label>
          <label class="field">Joueurs <span class="muted">(un par ligne)</span>
            <textarea id="t-players" rows="12" placeholder="Alice&#10;Bob&#10;Chloé&#10;…">${esc(names)}</textarea>
          </label>
          <p id="players-info" class="muted"></p>
        </section>
        <section class="card">
          <h3>Durées des étapes</h3>
          <p class="muted">Durées par défaut, modifiables ensuite à chaque étape.</p>
          <div class="durations">
            ${durationField('draft', 'Draft', d.draft)}
            ${durationField('seating', 'Placement à la table', d.seating)}
            ${durationField('build', 'Construction de deck', d.build)}
            ${durationField('round', 'Chaque ronde (BO3)', d.round)}
          </div>
          <h3>Format</h3>
          <ul class="muted format">
            <li>3 rondes suisses en BO3, et des rondes supplémentaires si besoin</li>
            <li>Ronde 1 tirée au sort, puis les joueurs à égalité de points s'affrontent</li>
            <li>Victoire 3 pts · Nul 1 pt · Défaite 0 pt · Bye = victoire 2-0</li>
            <li>Départage : OMW %, puis GW %, puis OGW %</li>
          </ul>
        </section>
      </div>
      <div class="actions">
        <span></span>
        <button class="btn btn-primary btn-lg" data-action="start">Commencer le tournoi →</button>
      </div>`;
  }

  function durationField(key, label, value) {
    return `<label class="field-inline"><span>${esc(label)}</span>
      <span><input type="number" min="1" max="600" value="${Number(value)}" data-duration="${key}"> min</span></label>`;
  }

  function viewTimerStep(step, prevLabel, nextLabel, nextAction, extra) {
    return `
      <h2>${esc(STEP_TITLES[step])}</h2>
      ${timerHtml(step, STEP_TITLES[step])}
      ${extra || ''}
      <div class="actions">
        <button class="btn" data-action="prev">← ${esc(prevLabel)}</button>
        <button class="btn btn-primary btn-lg" data-action="${nextAction}">${esc(nextLabel)} →</button>
      </div>`;
  }

  function viewSeating() {
    const ids = state.seating;
    const n = ids.length;
    const seats = ids
      .map((id, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const x = 50 + 40 * Math.cos(angle);
        const y = 50 + 40 * Math.sin(angle);
        return `<div class="seat" style="left:${x}%;top:${y}%"><span class="seat-num">${i + 1}</span><span class="seat-name">${esc(nameOf(id))}</span></div>`;
      })
      .join('');
    const list = ids.map((id) => `<li>${esc(nameOf(id))}</li>`).join('');
    const extra = `
      <section class="card seating">
        <div class="seating-head">
          <h3>Places autour de la table</h3>
          <button class="btn" data-action="reshuffle">🎲 Nouveau tirage</button>
        </div>
        <div class="seating-body">
          <div class="table-circle"><div class="table-top">Table</div>${seats}</div>
          <ol class="seat-list">${list}</ol>
        </div>
      </section>`;
    return viewTimerStep('seating', 'Draft', 'Construction de deck', 'next', extra);
  }

  const QUICK_RESULTS = [
    [2, 0],
    [2, 1],
    [1, 0],
    [1, 1],
    [0, 0],
    [0, 1],
    [1, 2],
    [0, 2],
  ];

  function resultText(m) {
    if (m.p2 === null) return 'Bye (2-0)';
    if (!m.result) return '—';
    return m.result.g1 + ' - ' + m.result.g2 + (m.result.g1 === m.result.g2 ? ' (nul)' : '');
  }

  function viewRound() {
    const n = currentRoundNumber();
    const round = lastRound();
    const done = round.matches.filter(Swiss.isComplete).length;
    const total = round.matches.length;
    const rows = round.matches
      .map((m, i) => {
        if (m.p2 === null) {
          return `<div class="match bye">
            <div class="match-table">—</div>
            <div class="match-p p1 winner">${esc(nameOf(m.p1))}</div>
            <div class="match-res"><span class="badge">Bye · victoire 2-0</span></div>
            <div class="match-p p2"></div>
          </div>`;
        }
        const w = Swiss.winnerOf(m);
        const btns = QUICK_RESULTS.map(([a, b]) => {
          const sel = m.result && m.result.g1 === a && m.result.g2 === b && !m.result.gd;
          const cls = a > b ? 'r-win' : a < b ? 'r-loss' : 'r-draw';
          return `<button class="res ${cls} ${sel ? 'selected' : ''}" data-action="result" data-match="${i}" data-g1="${a}" data-g2="${b}">${a}-${b}</button>`;
        }).join('');
        return `<div class="match ${m.result ? 'has-result' : ''}">
          <div class="match-table">Table ${i + 1}</div>
          <div class="match-p p1 ${w === m.p1 ? 'winner' : ''} ${w === 'draw' ? 'draw' : ''}">${esc(nameOf(m.p1))}</div>
          <div class="match-res">
            <div class="res-buttons">${btns}</div>
            ${m.result ? `<button class="link" data-action="clear-result" data-match="${i}">effacer</button>` : ''}
          </div>
          <div class="match-p p2 ${w === m.p2 ? 'winner' : ''} ${w === 'draw' ? 'draw' : ''}">${esc(nameOf(m.p2))}</div>
        </div>`;
      })
      .join('');
    return `
      <h2>Ronde ${n}${n > Store.BASE_ROUNDS ? ' <span class="badge">supplémentaire</span>' : ''}</h2>
      ${timerHtml('round-' + n, 'Ronde ' + n + ' · BO3')}
      <section class="card">
        <div class="round-head">
          <h3>Appariements et résultats</h3>
          <span class="progress ${done === total ? 'ok' : ''}">${done} / ${total} résultats saisis</span>
        </div>
        <p class="muted small">Score en parties, vu du joueur de gauche (ex. 2-1 = victoire du joueur de gauche). 1-1 et 0-0 = match nul.</p>
        <div class="matches">${rows}</div>
      </section>
      <div class="actions">
        <button class="btn btn-danger-ghost" data-action="cancel-round">Annuler les appariements</button>
        <button class="btn btn-primary btn-lg" data-action="validate-round" ${done === total ? '' : 'disabled'}>Valider la ronde ${n} →</button>
      </div>`;
  }

  function standingsTable(withActions) {
    const st = Swiss.standings(state.players, state.rounds);
    const rows = st
      .map(
        (s) => `<tr class="${s.dropped ? 'dropped' : ''} ${s.rank <= 3 ? 'top' + s.rank : ''}">
          <td class="rank">${s.rank}</td>
          <td class="name">${esc(s.name)}${s.dropped ? ' <span class="badge">abandon</span>' : ''}</td>
          <td class="pts">${s.points}</td>
          <td>${s.wins}-${s.losses}-${s.draws}</td>
          <td>${s.matches ? pct(s.omw) : '—'}</td>
          <td>${s.games ? pct(s.gwp) : '—'}</td>
          <td>${s.matches ? pct(s.ogw) : '—'}</td>
          ${
            withActions
              ? `<td><button class="link" data-action="toggle-drop" data-player="${esc(s.id)}">${s.dropped ? 'Réintégrer' : 'Abandon'}</button></td>`
              : ''
          }
        </tr>`
      )
      .join('');
    return `<div class="table-wrap"><table class="standings">
      <thead><tr><th>#</th><th>Joueur</th><th>Pts</th><th>V-D-N</th>
      <th title="Taux de victoire moyen des adversaires">OMW %</th>
      <th title="Taux de parties gagnées">GW %</th>
      <th title="Taux de parties gagnées des adversaires">OGW %</th>
      ${withActions ? '<th></th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  function roundRecap(round, n) {
    const rows = round.matches
      .map((m, i) => {
        if (m.p2 === null) return `<li><span class="muted">—</span> <b>${esc(nameOf(m.p1))}</b> : bye</li>`;
        const w = Swiss.winnerOf(m);
        const p1 = w === m.p1 ? `<b>${esc(nameOf(m.p1))}</b>` : esc(nameOf(m.p1));
        const p2 = w === m.p2 ? `<b>${esc(nameOf(m.p2))}</b>` : esc(nameOf(m.p2));
        return `<li><span class="muted">T${i + 1}</span> ${p1} <span class="score">${resultText(m)}</span> ${p2}</li>`;
      })
      .join('');
    return `<h3>Résultats de la ronde ${n}</h3><ul class="recap">${rows}</ul>`;
  }

  function viewStandings() {
    const n = currentRoundNumber();
    const more = n < Store.BASE_ROUNDS;
    return `
      <h2>Classement après la ronde ${n}</h2>
      <section class="card">${standingsTable(true)}
        <p class="muted small">« Abandon » retire le joueur des prochains appariements ; il reste dans le classement.</p>
      </section>
      <section class="card">${roundRecap(lastRound(), n)}</section>
      <div class="actions">
        <button class="btn" data-action="edit-round">← Modifier les résultats de la ronde ${n}</button>
        <span class="actions-right">
          ${
            more
              ? `<button class="btn" data-action="finish">Terminer maintenant</button>
                 <button class="btn btn-primary btn-lg" data-action="next-round">Lancer la ronde ${n + 1} →</button>`
              : `<button class="btn" data-action="next-round">+ Ajouter une ronde supplémentaire</button>
                 <button class="btn btn-primary btn-lg" data-action="finish">Terminer le tournoi →</button>`
          }
        </span>
      </div>`;
  }

  function viewFinal() {
    const st = Swiss.standings(state.players, state.rounds);
    const podium = st
      .slice(0, 3)
      .map(
        (s, i) => `<div class="podium-place p${i + 1}">
          <div class="medal">${['🥇', '🥈', '🥉'][i]}</div>
          <div class="podium-name">${esc(s.name)}</div>
          <div class="muted">${s.points} pts · ${s.wins}-${s.losses}-${s.draws}</div>
        </div>`
      )
      .join('');
    const recaps = state.rounds.map((r, i) => `<details><summary>Ronde ${i + 1}</summary>${roundRecap(r, i + 1)}</details>`).join('');
    return `
      <h2>Résultats finaux${state.name ? ' · ' + esc(state.name) : ''}</h2>
      <div class="podium">${podium}</div>
      <section class="card"><h3>Classement final</h3>${standingsTable(false)}</section>
      <section class="card"><h3>Historique des rondes</h3>${recaps}</section>
      <div class="actions">
        <button class="btn" data-action="unfinish">← Revenir au classement</button>
        <button class="btn" data-action="export">Exporter le tournoi</button>
      </div>`;
  }

  function render() {
    document.getElementById('t-title').textContent = state.name || '';
    renderStepper();
    let html;
    switch (state.step) {
      case 'draft':
        html = viewTimerStep('draft', 'Configuration', 'Placement à la table', 'next');
        break;
      case 'seating':
        html = viewSeating();
        break;
      case 'build':
        html = viewTimerStep('build', 'Placement', 'Lancer la ronde 1', 'next-round');
        break;
      case 'round':
        html = viewRound();
        break;
      case 'standings':
        html = viewStandings();
        break;
      case 'final':
        html = viewFinal();
        break;
      default:
        html = viewSetup();
    }
    app.innerHTML = html;
    if (state.step === 'setup') updatePlayersInfo();
    tick();
  }

  function updatePlayersInfo() {
    const ta = document.getElementById('t-players');
    const info = document.getElementById('players-info');
    if (!ta || !info) return;
    const names = parsePlayers(ta.value);
    const dups = duplicates(names);
    let txt = names.length + ' joueur' + (names.length > 1 ? 's' : '');
    if (names.length % 2 === 1) txt += ' · nombre impair : un joueur aura un bye à chaque ronde';
    info.innerHTML = esc(txt) + (dups.length ? `<br><span class="error">Doublons : ${esc(dups.join(', '))}</span>` : '');
  }

  // ---------- Actions ----------

  function startTournament() {
    const name = document.getElementById('t-name').value.trim();
    const names = parsePlayers(document.getElementById('t-players').value);
    const dups = duplicates(names);
    if (names.length < 2) return alert('Il faut au moins 2 joueurs.');
    if (dups.length) return alert('Chaque joueur doit avoir un nom unique. Doublons : ' + dups.join(', '));
    document.querySelectorAll('[data-duration]').forEach((inp) => {
      const v = Number(inp.value);
      state.durations[inp.dataset.duration] = v > 0 ? v : state.durations[inp.dataset.duration];
    });
    // On conserve les identifiants des joueurs existants (retour à la configuration).
    const prev = new Map(state.players.map((p) => [p.name.toLocaleLowerCase('fr'), p]));
    let maxId = state.players.reduce((m, p) => Math.max(m, Number(String(p.id).slice(1)) || 0), 0);
    const players = names.map((n) => {
      const old = prev.get(n.toLocaleLowerCase('fr'));
      return old ? Object.assign(old, { name: n }) : { id: 'p' + ++maxId, name: n, dropped: false };
    });
    const sameSet =
      players.length === state.players.length && players.every((p) => state.players.some((q) => q.id === p.id));
    if (!sameSet) state.seating = [];
    state.players = players;
    state.name = name;
    // Les timers non démarrés prennent les nouvelles durées par défaut.
    Object.keys(state.timers).forEach((k) => {
      const t = state.timers[k];
      if (!Timer.isRunning(t) && t.remaining === t.duration) delete state.timers[k];
    });
    state.step = 'draft';
    commit();
  }

  function shuffleSeats() {
    state.seating = Swiss.shuffle(state.players.map((p) => p.id));
  }

  function nextRound() {
    const matches = Swiss.pairNextRound(state.players, state.rounds);
    state.rounds.push({ matches: matches.map((m) => Object.assign(m, { result: null })) });
    delete state.timers['round-' + state.rounds.length];
    state.step = 'round';
    commit();
    window.scrollTo(0, 0);
  }

  function exportState() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const slug = (state.name || 'tournoi').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    a.href = URL.createObjectURL(blob);
    a.download = 'ronde-suisse-' + (slug || 'tournoi') + '-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importState(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!Store.isValid(s)) throw new Error('format');
        if (!confirm('Remplacer le tournoi en cours par le fichier importé ?')) return;
        state = Object.assign(Store.newState(), s);
        commit();
      } catch (e) {
        alert("Ce fichier n'est pas une sauvegarde Ronde Suisse valide.");
      }
    };
    reader.readAsText(file);
  }

  function toggleFullscreen() {
    const el = document.getElementById('timer');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el && el.requestFullscreen) el.requestFullscreen();
  }

  const actions = {
    start: startTournament,
    goto: (btn) => {
      state.step = btn.dataset.step;
      commit();
    },
    prev: () => {
      const order = ['setup', 'draft', 'seating', 'build'];
      state.step = order[Math.max(0, order.indexOf(state.step) - 1)];
      commit();
    },
    next: () => {
      if (state.step === 'draft') {
        if (!state.seating.length) shuffleSeats();
        state.step = 'seating';
      } else if (state.step === 'seating') state.step = 'build';
      commit();
    },
    reshuffle: () => {
      shuffleSeats();
      commit();
    },
    'timer-toggle': () => {
      Timer.unlockAudio();
      const t = getTimer(timerKey());
      if (Timer.isRunning(t)) Timer.pause(t);
      else Timer.start(t);
      Store.save(state);
      tick();
    },
    'timer-reset': () => {
      const t = getTimer(timerKey());
      if (Timer.isRunning(t) && !confirm('Réinitialiser le timer en cours ?')) return;
      Timer.reset(t);
      Store.save(state);
      tick();
    },
    'timer-add': (btn) => {
      Timer.add(getTimer(timerKey()), Number(btn.dataset.min));
      Store.save(state);
      tick();
    },
    'timer-fullscreen': toggleFullscreen,
    result: (btn) => {
      const m = lastRound().matches[Number(btn.dataset.match)];
      m.result = { g1: Number(btn.dataset.g1), g2: Number(btn.dataset.g2), gd: 0 };
      commit();
    },
    'clear-result': (btn) => {
      lastRound().matches[Number(btn.dataset.match)].result = null;
      commit();
    },
    'validate-round': () => {
      if (!lastRound().matches.every(Swiss.isComplete)) return;
      const t = state.timers['round-' + currentRoundNumber()];
      if (t) Timer.pause(t);
      state.step = 'standings';
      commit();
      window.scrollTo(0, 0);
    },
    'cancel-round': () => {
      const n = currentRoundNumber();
      if (!confirm('Annuler les appariements de la ronde ' + n + ' ? Les résultats saisis pour cette ronde seront perdus.')) return;
      state.rounds.pop();
      delete state.timers['round-' + n];
      state.step = state.rounds.length ? 'standings' : 'build';
      commit();
    },
    'edit-round': () => {
      state.step = 'round';
      commit();
    },
    'next-round': () => {
      const active = state.players.filter((p) => !p.dropped).length;
      if (active < 2) return alert('Il faut au moins 2 joueurs actifs pour lancer une ronde.');
      if (state.step === 'standings' && currentRoundNumber() >= Store.BASE_ROUNDS) {
        if (!confirm('Ajouter la ronde supplémentaire ' + (currentRoundNumber() + 1) + ' ?')) return;
      }
      nextRound();
    },
    'toggle-drop': (btn) => {
      const p = playerById(btn.dataset.player);
      if (!p) return;
      if (!p.dropped && !confirm(p.name + ' abandonne le tournoi ? Il ne sera plus apparié.')) return;
      p.dropped = !p.dropped;
      commit();
    },
    finish: () => {
      if (currentRoundNumber() < Store.BASE_ROUNDS && !confirm('Terminer le tournoi avant la ronde 3 ?')) return;
      state.step = 'final';
      commit();
      window.scrollTo(0, 0);
    },
    unfinish: () => {
      state.step = 'standings';
      commit();
    },
    export: exportState,
    import: () => document.getElementById('import-file').click(),
    reset: () => {
      if (!confirm('Commencer un nouveau tournoi ? Le tournoi actuel sera effacé (pensez à l’exporter).')) return;
      const durations = Object.assign({}, state.durations);
      state = Store.newState();
      state.durations = durations;
      commit();
    },
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const fn = actions[btn.dataset.action];
    if (fn) fn(btn);
  });

  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-change="timer-duration"]')) {
      const v = Number(e.target.value);
      if (v > 0) {
        Timer.setDuration(getTimer(timerKey()), v);
        Store.save(state);
      }
      tick();
    } else if (e.target.id === 'import-file' && e.target.files[0]) {
      importState(e.target.files[0]);
      e.target.value = '';
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 't-players') updatePlayersInfo();
  });

  document.addEventListener('fullscreenchange', tick);

  render();
})();
