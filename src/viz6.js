// ASCII viewer + solver run for chapter-6 (Frozen Light) levels.  node viz6.js [levelIndex]
const fs = require('fs'), path = require('path');
const SIM = new Function(fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8'))();
delete require.cache[require.resolve('./levels_ice.js')];
const DEFS = require('./levels_ice.js');
const { analyze } = require('./solve.js');
DEFS.forEach((def, n) => {
  if (process.argv[2] !== undefined && +process.argv[2] !== n) return;
  const L = SIM.parseLevel(def);
  console.log(`\n== 6-${n + 1} ${def.name} (${L.w}x${L.h})  lanterns ${L.lanterns.length} ice ${(def.ice || []).length} glaciers ${L.glaciers.length} falls ${L.falls.length} suns ${L.suns.length} cracks ${(def.cracks || []).length}`);
  console.log(def.src.map((r, j) => String(j).padStart(2) + ' ' + r).join('\n'));
  console.log('   ' + Array.from({ length: L.w }, (_, i) => i % 10).join(''));
  const r = analyze(def);
  console.log(`solve: states=${r.states} moves=${r.win ? r.win.length : '-'} ${r.pretty}`);
  console.log(`shards ${r.shards}/${r.L.shards.length}; dead-ends: ${r.dead.length ? r.dead.slice(0, 10).join(' ') : 'none'}; events: ${[...r.mech].join(',')}`);
});
