// Print a level with reachable resting spots (o) and the flight path of a given move sequence.
// node viz.js <levelIndex> [moves e.g. "R U TAP"]
const fs = require('fs'), path = require('path');
const SIM = new Function(fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8'))();
const LEVELS = JSON.parse(fs.readFileSync(path.join(__dirname, 'levels.json'), 'utf8'));
const n = +process.argv[2], def = LEVELS[n], L = SIM.parseLevel(def);
const g = def.map.map((r) => r.split(''));
const seen = new Set(), q = [SIM.newState(L)]; seen.add(L.start + '');
while (q.length) { const s = q.shift(); for (const a of ['L','R','U','D','TAP']) { const r = SIM.simulate(L, s, a); if (r.ok && r.st.mode === 'stuck' && !seen.has(r.st.i + ',' + r.st.j)) { seen.add(r.st.i + ',' + r.st.j); q.push(r.st); } } }
for (const k of seen) { const [i, j] = k.split(',').map(Number); if (g[j][i] === '.') g[j][i] = 'o'; }
let st = SIM.newState(L);
for (const m of (process.argv[3] || '').split(' ').filter(Boolean)) {
  const s0 = JSON.parse(JSON.stringify(st)); s0.events = [];
  const r = SIM.checkMove(L, s0.i, s0.j, m);
  if (m !== 'TAP' && !r.ok) { console.log(m, 'illegal', r.why); break; }
  if (m === 'TAP') { const d = SIM.padLaunchDir(L, s0.i, s0.j, s0.normal); if (!d) { console.log('TAP no pad'); break; } SIM.startFlight(s0, d, true); } else SIM.startFlight(s0, m, false);
  while (s0.mode === 'fly') { SIM.step(L, s0, 1 / 120); const i = Math.floor(s0.x / 48), j = Math.floor(s0.y / 48); if (g[j] && 'o.'.includes(g[j][i])) g[j][i] = '~'; }
  console.log(m, '->', s0.mode, s0.i, s0.j, s0.events.map((e) => e.type).join(','));
  st = s0;
}
console.log(g.map((r) => r.join(' ')).join('\n'));
