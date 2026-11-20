// Print a chapter-4 level with hazard overlays and the solver's result.
// node viz4.js <levelIndex 0-4> [defs file]   overlays: R rock core, r rock track, % dust band, ~ hail lane, o reachable rest spot
const fs = require('fs'), path = require('path');
const SIM = new Function(fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8'))();
const { analyze } = require('./solve.js');
const DEFS = require(path.resolve(process.argv[3] || path.join(__dirname, 'levels_rocks.js')));
const idx = process.argv[2] === undefined ? DEFS.map((_, k) => k) : [+process.argv[2]];
for (const n of idx) {
  const def = DEFS[n], L = SIM.parseLevel(def), T = SIM.T, g = def.map.map((r) => r.split(''));
  for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) {
    if (g[j][i] !== '.') continue; const x = i * T + T / 2, y = j * T + T / 2;
    for (const h of L.hail) if (x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1) g[j][i] = '~';
    for (const rg of L.rings) { const d = Math.hypot(x - rg.x, y - rg.y); if (d >= rg.R - rg.hw && d <= rg.R + rg.hw) g[j][i] = '%'; }
    for (let q = 0; q < 40; q++) for (const r of L.rocks) { const [rx, ry] = SIM.rockPos(L, r, q * L.period / 40); if (Math.hypot(x - rx, y - ry) < r.hit) g[j][i] = q === 0 ? 'R' : (g[j][i] === 'R' ? 'R' : 'r'); }
  }
  const r = analyze(def);
  for (const { st } of [...(new Map())]) {}
  console.log(`== ${n + 1} ${def.name} ${L.w}x${L.h} states=${r.states} win: ${r.pretty}`);
  console.log(`   shards ${r.shards}/${L.shards.length} dead-ends ${r.dead.length ? r.dead.slice(0, 6).join(' ') : 'none'} deaths ${r.deaths.length} unsafe ${r.unsafe.join(' ') || 'none'} events ${[...r.mech].join(',')}`);
  if (process.env.DEATHS) console.log('   ' + r.deaths.slice(0, +process.env.DEATHS).join('\n   '));
  if (!process.env.QUIET) console.log(g.map((row, j) => String(j).padStart(2) + ' ' + row.join(' ')).join('\n'));
}
