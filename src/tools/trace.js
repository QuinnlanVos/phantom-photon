// Debug: print a level map with wind zones / curves / wells and (optionally) a move sequence's path.
// node tools/trace.js <levels.json|chapters.json> <chapter> <level> ["R U L ..."]
const fs = require('fs'), path = require('path');
const SIM = new Function(fs.readFileSync(path.join(__dirname, '..', 'sim.js'), 'utf8'))();
const [file, ci, li, seq] = process.argv.slice(2);
const CH = JSON.parse(fs.readFileSync(file, 'utf8')); const def = CH[+ci].levels[+li];
const L = SIM.parseLevel(def), T = SIM.T;
const g = def.map.map((r) => r.split(''));
for (const w of L.winds) for (let j = w.j; j < w.j + w.h; j++) for (let i = w.i; i < w.i + w.w; i++) if (g[j][i] === '.') g[j][i] = { L: '<', R: '>', U: '^', D: 'v' }[w.d];
for (const c of L.curves) for (let j = c.j; j < c.j + c.r; j++) for (let i = c.i; i < c.i + c.r; i++) g[j][i] = 'c';
for (const w of L.wells) for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) if (g[j][i] === '.' && Math.hypot(SIM.center(i) - w.x, SIM.center(j) - w.y) < w.R) g[j][i] = '~';
let st = SIM.newState(L);
if (seq) {
  let n = 0;
  for (const a of seq.split(/\s+/).filter(Boolean)) {
    if (a.startsWith('w')) { SIM.step(L, st, +a.slice(1) || 0.25); continue; }
    const r = SIM.simulate(L, st, a);
    if (!r.ok) { console.log('move', a, 'rejected', r.why); break; }
    // re-run with path sampling
    const s2 = SIM.clone(st);
    if (a === 'TAP') SIM.startFlight(s2, SIM.padLaunchDir(L, s2), true, L); else SIM.startFlight(s2, a, false, L);
    while (s2.mode === 'fly') { SIM.step(L, s2, 1 / 120); const i = Math.floor(s2.x / T), j = Math.floor(s2.y / T); if (g[j] && '.<>^v~c'.includes(g[j][i])) g[j][i] = 'o'; }
    st = r.st; n++;
    const evs = r.events.map((e) => e.type).filter((t) => t !== 'graze');
    console.log(`${n}: ${a} -> ${st.mode} ${st.mode === 'stuck' ? (st.ride ? 'ride' + st.ride.m : st.i + ',' + st.j) : ''}  [${[...new Set(evs)].join(',')}]`);
    if (st.mode === 'stuck' && !st.ride) g[st.j][st.i] = String(n % 10);
    if (st.mode === 'dead') { SIM.respawn(L, st); }
  }
}
console.log('    ' + [...Array(L.w).keys()].map((i) => i % 10).join(''));
g.forEach((r, j) => console.log(String(j).padStart(3) + ' ' + r.join('')));
