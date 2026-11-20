// Frozen Light (chapter 6) map preprocessor: authoring characters -> level fields understood by sim.js
//   1 2 3 lantern (index 0..2)   A B C ice melted by lantern 1 / 2 / 3   Y glacier (4-connected blobs = one glacier)
//   K crack (only a small photon fits)   w waterfall (shrinks)   u sunlight shaft (makes big)
function blobs(rows, ch) {
  const H = rows.length, W = rows[0].length, seen = new Set(), out = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (rows[j][i] !== ch || seen.has(j * W + i)) continue;
    const q = [[i, j]]; seen.add(j * W + i); let x0 = i, x1 = i, y0 = j, y1 = j;
    while (q.length) { const [a, b] = q.pop(); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = a + dx, d = b + dy; if (c < 0 || d < 0 || c >= W || d >= H || rows[d][c] !== ch || seen.has(d * W + c)) continue; seen.add(d * W + c); q.push([c, d]); } }
    out.push({ i: x0, j: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out;
}
module.exports = function pre(lv) {
  const rows = lv.map, def = Object.assign({}, lv);
  def.lanterns = []; def.ice = []; def.cracks = blobs(rows, 'K'); def.falls = blobs(rows, 'w'); def.suns = blobs(rows, 'u'); def.glaciers = blobs(rows, 'Y');
  rows.forEach((r, j) => r.split('').forEach((c, i) => { if ('123'.includes(c)) def.lanterns[+c - 1] = { i, j }; }));
  ['A', 'B', 'C'].forEach((c, l) => blobs(rows, c).forEach((b) => def.ice.push(Object.assign(b, { l }))));
  def.map = rows.map((r) => r.replace(/[123ABCYKwu]/g, '.'));
  for (const k of ['lanterns', 'ice', 'cracks', 'falls', 'suns', 'glaciers']) if (!def[k].length) delete def[k];
  return def;
};
