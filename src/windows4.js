// Timing-window report for chapter-4 routes: for every move on the solver's route, the share of the hazard cycle
// in which that move works (100% = no timing needed), and in brackets the longest single window. node windows4.js [levelIndex]
const fs = require('fs'), path = require('path');
const SIM = new Function(fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8'))();
const { analyze } = require('./solve.js');
function windows(def) {
  const L = SIM.parseLevel(def), r = analyze(def); if (!r.win) return null;
  const toks = []; for (const t of r.win) { if (t === 'w' || t.endsWith('>dead')) continue; toks.push(t);
    while (toks.length >= 2) { const a = toks[toks.length - 2].split('>')[1], b = toks[toks.length - 1].split('>')[1], p = toks.length >= 3 ? toks[toks.length - 3].split('>')[1] : L.start.join(',');
      if (b === p && a !== 'exit') toks.splice(toks.length - 2, 2); else break; } }
  let st = SIM.newState(L); const out = [];
  for (const tok of toks) {
    const [a, res] = tok.split('>'); const N = 120, good = [];
    for (let k = 0; k < N; k++) { const x = SIM.simulate(L, st, a, k * L.period / N + 1e-6); good.push(x.ok && (x.st.mode === 'exit' ? 'exit' : x.st.mode === 'stuck' ? x.st.i + ',' + x.st.j : x.st.mode) === res); }
    let best = [-1, 0]; for (let k = 0; k < N; k++) { if (!good[k] || good[(k + N - 1) % N]) continue; let len = 0; while (len < N && good[(k + len) % N]) len++; if (len > best[1]) best = [k, len]; }
    if (best[0] < 0) best = good.every(Boolean) ? [0, N] : [0, 0];
    out.push([tok, best[1] / N, good.filter(Boolean).length / N]);
    const wk = (best[0] + Math.floor(best[1] / 2)) % N; if (wk) st = SIM.simulate(L, st, 'WAIT', wk * L.period / N + 1e-6).st;
    st = SIM.simulate(L, st, a).st;
  }
  return out;
}
module.exports = { windows };
if (require.main === module) {
  const DEFS = require('./levels_rocks.js');
  DEFS.forEach((d, n) => { if (process.argv[2] !== undefined && +process.argv[2] !== n) return; const w = windows(d);
    console.log(`4-${n + 1} ${d.name}: ` + (w ? w.map(([t, f, o]) => `${t}:${Math.round(o * 100)}%` + (f < 0.999 ? `(${Math.round(f * 100)})` : '')).join('  ') + `   min open ${Math.round(Math.min(...w.map(x => x[2])) * 100)}%` : 'NO ROUTE')); });
}
