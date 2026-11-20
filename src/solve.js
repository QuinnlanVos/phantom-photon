// Level solver / sanity checker: BFS over resting states using the real game sim.
// Levels with moving platforms are explored in time too: every resting spot is sampled at WAIT-second
// phases of the platform cycle (the player may wait before moving), so timing puzzles are covered.
// Usage: node solve.js [chapters.json] [chapterIndex]
const fs = require('fs'), path = require('path');
const SIM = new Function(fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8'))();
const CH = JSON.parse(fs.readFileSync((require.main === module && process.argv[2]) || path.join(__dirname, 'chapters.json'), 'utf8'));
const WAIT = 0.25;
function analyze(def) {
  const L = SIM.parseLevel(def), timed = SIM.isTimed(L);
  const WAIT = def.solveWait || (L.wells.length ? 0.1 : 0.25);    // finer timing sampling for slow-motion levels
  const nb = timed ? Math.round(L.period / WAIT) : 1;
  const key = (s) => (s.ride ? `r${s.ride.m}:${s.ride.rx},${s.ride.ry}` : `${s.i},${s.j}`) + (timed ? '@' + (Math.round((s.time % L.period) / WAIT) % nb) : '') + (s.color ? ':' + s.color : '') + (s.rain ? '~' + s.rain : '') + (s.size !== undefined && s.size !== 1 ? 's' + s.size : '') + (s.lit ? '^' + s.lit : '') + (s.ice ? '%' + s.ice : '');
  const st0 = SIM.newState(L);
  const seen = new Map([[key(st0), { st: st0, path: [] }]]); const q = [st0];
  const edges = new Map(); let win = null; const deaths = [], shardsSeen = new Set(), mech = new Set();
  while (q.length) {
    const s = q.shift(), node = seen.get(key(s)); edges.set(key(s), []);
    for (const a of ['L', 'R', 'U', 'D', 'TAP'].concat(timed ? ['WAIT'] : [])) {
      const r = a === 'WAIT' ? SIM.simulate(L, s, 'WAIT', WAIT / SIM.timeScale(L, s.x, s.y)) : SIM.simulate(L, s, a);   // inside a gravity well a real-time wait advances the world less
      if (!r.ok) continue;
      r.events.forEach((e) => { if (e.type === 'shard') shardsSeen.add(e.k); mech.add(e.type); });
      const p = node.path.concat(a === 'WAIT' ? 'w' : a + (r.st.mode === 'stuck' ? '>' + (r.st.ride ? 'ride' + r.st.ride.m : r.st.i + ',' + r.st.j) + (r.st.color !== s.color && r.st.color ? '(' + r.st.color + ')' : '') + (r.st.size !== s.size ? ['(small)', '(normal)', '(big)'][r.st.size] : '') : '>' + r.st.mode));
      if (r.st.mode === 'exit') { if (!win || p.length < win.length) win = p; edges.get(key(s)).push('EXIT'); continue; }
      if (r.st.mode === 'dead') {
        if (a !== 'WAIT' || deaths.length < 50) deaths.push(p.join(' ') + ' (' + r.st.deathType + ')');
        const rs = SIM.clone(r.st); SIM.respawn(L, rs); const k = key(rs);   // respawn at last wall: still a reachable state
        edges.get(key(s)).push(k); if (!seen.has(k)) { seen.set(k, { st: rs, path: p }); q.push(rs); }
        continue;
      }
      const k = key(r.st); edges.get(key(s)).push(k);
      if (!seen.has(k)) { seen.set(k, { st: r.st, path: p }); q.push(r.st); }
    }
  }
  const canWin = new Set(); let changed = true;
  while (changed) { changed = false; for (const [k, es] of edges) if (!canWin.has(k) && es.some((e) => e === 'EXIT' || canWin.has(e))) { canWin.add(k); changed = true; } }
  // Rocks from Space: hazards only hit a flying orb, so no resting spot may ever be inside one (static + platform rides)
  const unsafe = [];
  if (L.rocks.length || L.rings.length || L.hail.length) for (const { st } of seen.values()) {
    if (st.mode !== 'stuck') continue;
    if (!st.ride) { const hz = SIM.hazardEver(L, st.x, st.y); if (hz) unsafe.push(`${st.i},${st.j}(${hz})`); }
    else for (let q = 0; q < 48; q++) { const t = q * L.period / 48, r = SIM.moverRect(L, L.movers[st.ride.m], t), x = r.x0 + st.ride.rx, y = r.y0 + st.ride.ry;
      if (SIM.hazardAt(L, x, y, t)) { unsafe.push(`ride${st.ride.m}@${t.toFixed(2)}`); break; } }
  }
  const dead = [...edges.keys()].filter((k) => !canWin.has(k));
  const pretty = win ? win.join(' ').replace(/(?:w ?)+/g, (m) => 'wait' + (m.trim().split(' ').length * WAIT).toFixed(2) + 's ') : 'NONE';
  return { unsafe, WAIT, L, win, pretty, states: seen.size, dead, deaths, shards: shardsSeen.size, shardSet: shardsSeen, mech };
}
module.exports = { analyze };
if (require.main === module) {
  let bad = 0;
  CH.forEach((ch, c) => {
    if (process.argv[3] !== undefined && +process.argv[3] !== c) return;
    console.log(`== Chapter ${c + 1}: ${ch.name}`);
    ch.levels.forEach((def, n) => {
      const r = analyze(def);
      if (!r.L.start || SIM.contacts(r.L, ...r.L.start).length === 0) { console.log('  start not on a wall'); bad++; }
      console.log(`  ${c + 1}-${n + 1} "${def.name}": states=${r.states} moves=${r.win ? r.win.filter((x) => x !== 'w').length : '-'}  ${r.pretty}`);
      console.log(`     shards ${r.shards}/${r.L.shards.length}; dead-ends: ${r.dead.length ? r.dead.slice(0, 8).join(' ') : 'none'}; deaths possible: ${r.deaths.length}; events seen: ${[...r.mech].join(',')}`);
      if (r.unsafe.length) console.log('     UNSAFE resting spots: ' + r.unsafe.slice(0, 8).join(' '));
      if (!r.win || r.dead.length || r.shards < r.L.shards.length || r.unsafe.length) bad++;
    });
  });
  process.exit(bad ? 1 : 0);
}
