// ASCII viewer + checks for chapter-5 (Song of Rainbows) levels: overlays rainbows (~ shown, : hidden until rain),
// prisms (colour letter, upper case), gates (lower case), rain clouds (%), then validates rainbow paths and runs the solver.
// Usage: node viz5.js [levelIndex] [--paths]
const fs = require('fs'), path = require('path');
const SIM = new Function(fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8'))();
delete require.cache[require.resolve('./levels_rainbow.js')];
const DEFS = require('./levels_rainbow.js');
const T = SIM.T;
const CHF = '/tmp/ch5_only.json';
fs.writeFileSync(CHF, JSON.stringify([{ name: 'Song of Rainbows', levels: DEFS }]));
process.argv[2] = process.argv[2]; // keep
const { analyze } = require('./solve.js');
DEFS.forEach((def, n) => {
  if (process.argv[2] !== undefined && /^\d+$/.test(process.argv[2]) && +process.argv[2] !== n) return;
  const L = SIM.parseLevel(def);
  const g = def.map.map((r) => r.split(''));
  const put = (i, j, ch) => { if (g[j] && g[j][i] !== undefined && '.'.includes(g[j][i])) g[j][i] = ch; };
  for (const c of L.rain) for (let j = c.j; j < c.j + c.h; j++) for (let i = c.i; i < c.i + c.w; i++) put(i, j, '%');
  const problems = [];
  L.bows.forEach((b, k) => {
    const n = Math.ceil((b.t1 - b.t0) * b.R / 4);
    for (let q = 0; q <= n; q++) {
      const th = b.t0 + (b.t1 - b.t0) * q / n, x = b.x + b.R * Math.cos(th), y = b.y + b.R * Math.sin(th);
      const i = Math.floor(x / T), j = Math.floor(y / T);
      if (Math.abs(x - (i * T + T / 2)) < 14 && Math.abs(y - (j * T + T / 2)) < 14) put(i, j, b.cloud >= 0 ? ':' : '~');
      for (const [ox, oy] of [[-SIM.H, -SIM.H], [SIM.H, -SIM.H], [-SIM.H, SIM.H], [SIM.H, SIM.H], [0, 0]]) {
        const ci = Math.floor((x + ox * 0.95) / T), cj = Math.floor((y + oy * 0.95) / T), t = SIM.cell(L, ci, cj);
        if (t !== '.' && t !== 'Q' && t !== 'E') { problems.push(`bow${k} hits '${t}' at ${ci},${cj}`); break; }
      }
    }
    for (const th of [b.t0, b.t1]) { const x = b.x + b.R * Math.cos(th), y = b.y + b.R * Math.sin(th);
      const fx = (x - T / 2) / T, fy = (y - T / 2) / T; if (Math.abs(fx - Math.round(fx)) > 1e-6 || Math.abs(fy - Math.round(fy)) > 1e-6) problems.push(`bow${k} end not on tile centre`); }
  });
  for (const q of L.prisms) g[q.j][q.i] = q.c.toUpperCase();
  for (const k in L.gateC) { const i = k % L.w, j = Math.floor(k / L.w); g[j][i] = L.gateC[k]; }
  console.log(`\n== 5-${n + 1} ${def.name} (${L.w}x${L.h})`);
  console.log(g.map((r, j) => String(j).padStart(2) + ' ' + r.join('')).join('\n'));
  console.log('   ' + Array.from({ length: L.w }, (_, i) => i % 10).join(''));
  if (problems.length) console.log('PROBLEMS: ' + [...new Set(problems)].slice(0, 10).join('; '));
  const r = analyze(def);
  console.log(`solve: states=${r.states} moves=${r.win ? r.win.length : '-'} ${r.pretty}`);
  console.log(`shards ${r.shards}/${r.L.shards.length}; dead-ends: ${r.dead.length ? r.dead.slice(0, 10).join(' ') : 'none'}; deaths: ${r.deaths.slice(0, 4).join(' | ')}; events: ${[...r.mech].join(',')}`);
});
