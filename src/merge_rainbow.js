// Merge src/levels_rainbow.js into chapters.json as chapter 5 "Song of Rainbows" (idempotent).
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, 'chapters.json'), CH = JSON.parse(fs.readFileSync(P, 'utf8'));
delete require.cache[require.resolve('./levels_rainbow.js')];
const ch = { id: 'rainbow', name: 'Song of Rainbows', sub: 'Cheerful skies. Rainbow paths, prisms and rain clouds.', dark: false, theme: 'rainbow', scroll: true,
  levels: require('./levels_rainbow.js') };
const k = CH.findIndex((c) => c.id === 'rainbow'); if (k >= 0) CH[k] = ch; else CH.push(ch);
fs.writeFileSync(P, JSON.stringify(CH, null, 1));
console.log('chapters:', CH.map((c) => c.name + ' (' + c.levels.length + ')').join(', '));
