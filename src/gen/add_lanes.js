// Add extra timed hazard lanes (lightning / icicles / hail) across a level's shortest route, keeping it valid.
// node gen/add_lanes.js <in.json> <out.json> <nLanes> <seed> [dirs]
const fs = require('fs'), path = require('path');
const SIM = new Function(fs.readFileSync(path.join(__dirname, '..', 'sim.js'), 'utf8'))();
const { analyze } = require('../solve.js');
const [inp, out, nL, sd, dirs] = process.argv.slice(2); let seed = +sd || 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pick = (a) => a[Math.floor(rnd() * a.length)];
let def = JSON.parse(fs.readFileSync(inp, 'utf8')); def.period = def.period || 4;
function check(d) { let r; try { r = analyze(d); } catch (e) { return null; }
  if (!r.win || r.dead.length || r.unsafe.length || r.shards < r.L.shards.length || r.win.some((t) => t.endsWith('>dead'))) return null; return r; }
function routeCells(d, r) { const L = SIM.parseLevel(d); let st = SIM.newState(L); const seen = new Set();
  SIM.setTrace((s) => seen.add(Math.floor(s.x / 48) + ',' + Math.floor(s.y / 48)));
  for (const a of r.win) { const x = a === 'w' ? SIM.simulate(L, st, 'WAIT', r.WAIT / SIM.timeScale(L, st.x, st.y)) : SIM.simulate(L, st, a.split('>')[0]); st = x.st; }
  SIM.setTrace(null); return [...seen].map((k) => k.split(',').map(Number)); }
let r = check(def); if (!r) { console.log('input invalid'); process.exit(1); }
const m0 = r.win.filter((t) => t !== 'w').length; let added = 0;
for (let t = 0; t < 400 && added < +nL; t++) {
  const cells = routeCells(def, r); const [ci, cj] = pick(cells); const w = ri(2, 4), h = ri(2, 3), i = ci - ri(0, w - 1), j = cj - ri(0, h - 1);
  let ok = true; for (let y = j; y < j + h && ok; y++) for (let x = i; x < i + w && ok; x++) { const row = def.map[y]; if (!row || row[x] !== '.') ok = false; }
  for (const o of def.hail || []) if (i < o.i + o.w + 1 && o.i < i + w + 1 && j < o.j + o.h + 1 && o.j < j + h + 1) ok = false;
  if (!ok) continue;
  const d2 = JSON.parse(JSON.stringify(def)); (d2.hail = d2.hail || []).push({ i, j, w, h, d: pick((dirs || 'D').split(',')), n: 1, phase: pick([0, 0.25, 0.5, 0.75]) });
  const r2 = check(d2); if (!r2) continue;
  def = d2; r = r2; added++; console.error('lane', added, JSON.stringify(d2.hail[d2.hail.length - 1]), 'moves', r2.win.filter((x) => x !== 'w').length, 'deaths', r2.deaths.length);
}
fs.writeFileSync(out, JSON.stringify(def)); console.log('added', added, 'moves', m0, '->', r.win.filter((t) => t !== 'w').length, 'deaths', r.deaths.length, 'states', r.states);
