// Merge src/levels_rocks.js into chapters.json as chapter 4 "Rocks from Space" (idempotent).
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, 'chapters.json'), CH = JSON.parse(fs.readFileSync(P, 'utf8'));
delete require.cache[require.resolve('./levels_rocks.js')];
const ch = { id: 'rocks', name: 'Rocks from Space', sub: 'Deep space. Asteroids, dust rings and cosmic hail.', dark: false, theme: 'void', scroll: true,
  levels: require('./levels_rocks.js') };
const k = CH.findIndex((c) => c.id === 'rocks'); if (k >= 0) CH[k] = ch; else CH.push(ch);
fs.writeFileSync(P, JSON.stringify(CH, null, 1));
console.log('chapters:', CH.map((c) => c.name + ' (' + c.levels.length + ')').join(', '));
