// Merge src/levels_ice.js into chapters.json as chapter 6 "Frozen Light" (idempotent).
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, 'chapters.json'), CH = JSON.parse(fs.readFileSync(P, 'utf8'));
delete require.cache[require.resolve('./levels_ice.js')];
const levels = require('./levels_ice.js').map((d) => { const o = Object.assign({}, d); delete o.src; return o; });
const ch = { id: 'ice', name: 'Frozen Light', sub: 'An ice world. Lanterns, glaciers, waterfalls and sunlight.', dark: false, theme: 'ice', scroll: true, levels };
const k = CH.findIndex((c) => c.id === 'ice'); if (k >= 0) CH[k] = ch; else CH.push(ch);
fs.writeFileSync(P, JSON.stringify(CH, null, 1));
console.log('chapters:', CH.map((c) => c.name + ' (' + c.levels.length + ')').join(', '));
