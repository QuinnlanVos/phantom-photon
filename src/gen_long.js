// Long multi-section level generator (chapters 2-6). Random sections + chapter features, then hill-climb walls to make the
// solver's shortest route longer while keeping: solvable, no dead ends, no unsafe resting spots, every feature/hazard used.
// node gen_long.js '<json cfg>' <seed> <restarts> <climb> <out.json>
const fs = require('fs');
const SIM = new Function(fs.readFileSync(__dirname + '/sim.js', 'utf8'))();
const { analyze } = require('./solve.js');
const CFG = JSON.parse(process.argv[2]); let seed = +process.argv[3] || 1;
const RESTARTS = +process.argv[4] || 50, CLIMB = +process.argv[5] || 200, OUT = process.argv[6];
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pick = (a) => a[Math.floor(rnd() * a.length)];
const K = (i, j) => i + ',' + j;
function base() {
  const { W, H, nsec, orient } = CFG; const g = [];
  for (let j = 0; j < H; j++) { g.push([]); for (let i = 0; i < W; i++) g[j].push(i === 0 || j === 0 || i === W - 1 || j === H - 1 ? '#' : '.'); }
  const c = { g, lock: new Set(), div: new Set(), f: {}, secs: [], gaps: [], tiles: [] };
  const n = orient === 'v' ? H - 2 : W - 2, cuts = [];
  for (let s = 1; s < nsec; s++) cuts.push(Math.round(1 + s * n / nsec + ri(-1, 1)));
  const lo = [1].concat(cuts.map((x) => x + 1)), hi = cuts.map((x) => x - 1).concat([n]);
  // sections listed from the START (bottom / left) to the EXIT (top / right)
  for (let s = 0; s < nsec; s++) c.secs.push(orient === 'v' ? { x0: 1, x1: W - 2, y0: lo[s], y1: hi[s] } : { x0: lo[s], x1: hi[s], y0: 1, y1: H - 2 });
  if (orient === 'v') c.secs.reverse();
  cuts.forEach((x, k) => {
    const gw = CFG.gapW || 2, len = orient === 'v' ? W : H, at = ri(2, len - 3 - gw);
    const cells = [];
    for (let t = 1; t < len - 1; t++) { const [i, j] = orient === 'v' ? [t, x] : [x, t]; if (t >= at && t < at + gw) cells.push([i, j]); else { g[j][i] = '#'; c.div.add(K(i, j)); } }
    cells.forEach(([i, j]) => c.lock.add(K(i, j)));
    // guide wall beside the gap on the side the photon arrives from (you can only fly along a wall you touch)
    const side = rnd() < 0.5 ? at - 1 : at + gw, gl = ri(1, Math.max(1, Math.floor(n / nsec) - 2));
    for (let q = 1; q <= gl; q++) { const [i, j] = orient === 'v' ? [side, x + q] : [x - q, side]; if (g[j] && g[j][i] === '.' && i > 0 && j > 0 && i < W - 1 && j < H - 1) { g[j][i] = '#'; c.div.add(K(i, j)); } }
    c.gaps.push({ cells, k: orient === 'v' ? cuts.length - 1 - k : k });
  });
  c.gaps.sort((a, b) => a.k - b.k);     // gap k joins section k and k+1 (counted from the start)
  return c;
}
const isE = (c, i, j) => c.g[j] && c.g[j][i] === '.' && !c.lock.has(K(i, j));
const rectE = (c, i, j, w, h) => { for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) if (!isE(c, x, y)) return false; return true; };
const lockR = (c, i, j, w, h) => { for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) c.lock.add(K(x, y)); };
const inSec = (s, m) => [ri(s.x0 + (m || 0), s.x1 - (m || 0)), ri(s.y0 + (m || 0), s.y1 - (m || 0))];
const add = (c, k, o) => { (c.f[k] = c.f[k] || []).push(o); return o; };
function point(c, s, m) { for (let t = 0; t < 60; t++) { const [i, j] = inSec(s, m); if (isE(c, i, j)) return [i, j]; } return null; }
const FEAT = {
  tile(c, s, ch) { const p = point(c, s, 1); if (!p) return false; c.g[p[1]][p[0]] = pick(ch.split('')); c.lock.add(K(...p)); c.tiles.push(p); return true; },
  pad(c, s) { for (let t = 0; t < 60; t++) { const [i, j] = inSec(s, 0); const cand = [[i, s.y0 - 1], [i, s.y1 + 1], [s.x0 - 1, j], [s.x1 + 1, j]].filter(([a, b]) => c.g[b] && c.g[b][a] === '#' && !c.div.has('x'));
      if (cand.length) { const [a, b] = pick(cand); if (a <= 0 || b <= 0 || a >= CFG.W - 1 || b >= CFG.H - 1) { c.g[b][a] = 'P'; return true; } } } return false; },
  mover(c, s) { for (let t = 0; t < 60; t++) { const axis = pick(['x', 'y']), range = ri(2, 4), [i, j] = inSec(s, 1);
      const w = axis === 'x' ? 2 + range : 2, h = axis === 'x' ? 1 : 1 + range;
      if (rectE(c, i, j, w, h)) { lockR(c, i, j, w, h); add(c, 'movers', { i, j, w: 2, h: 1, axis, range, phase: pick([0, 0.25, 0.5, 0.75]) }); return true; } } return false; },
  cloud(c, s) { const [i, j] = inSec(s, 1); add(c, 'clouds', { i, j, w: ri(3, 5), h: ri(3, 4) }); return true; },
  curve(c, s) { const cand = []; const r = 3;
    for (let j = s.y0; j + r - 1 <= s.y1; j++) for (let i = s.x0; i + r - 1 <= s.x1; i++) {
      if (!rectE(c, i, j, r, r)) continue;
      for (const cc of ['NW', 'NE', 'SW', 'SE']) { const wy = cc[0] === 'N' ? j - 1 : j + r, wx = cc[1] === 'W' ? i - 1 : i + r; let ok = true;
        for (let q = 0; q < r && ok; q++) { if (c.g[wy][i + q] !== '#' || c.g[j + q][wx] !== '#') ok = false; }
        if (ok) cand.push({ i, j, r, c: cc }); } }
    if (!cand.length) return false; const o = pick(cand); lockR(c, o.i, o.j, 3, 3); add(c, 'curves', o); return true; },
  wind(c, s) { const w = ri(2, 5), h = ri(2, 4); const [i, j] = inSec(s, 0); if (i + w - 1 > s.x1 || j + h - 1 > s.y1) return false;
    add(c, 'winds', { i, j, w, h, d: pick(['L', 'R', 'U', 'D']), s: 2600 }); return true; },
  well(c, s) { const p = point(c, s, 2); if (!p) return false; add(c, 'wells', { i: p[0], j: p[1], r: 2.6 }); c.lock.add(K(...p)); return true; },
  rock(c, s) { for (let t = 0; t < 60; t++) { const [i, j] = inSec(s, 1), mv = rnd() < 0.6, axis = pick(['x', 'y']), range = ri(2, 3);
      const w = mv && axis === 'x' ? range + 1 : 1, h = mv && axis === 'y' ? range + 1 : 1;
      if (rectE(c, i, j, w, h)) { lockR(c, i, j, w, h); add(c, 'rocks', mv ? { i, j, r: 0.8, axis, range, phase: pick([0, 0.25, 0.5, 0.75]) } : { i, j, r: 0.8 }); return true; } } return false; },
  ring(c, s) { for (let t = 0; t < 60; t++) { const [i, j] = inSec(s, 3); if (rectE(c, i - 3, j - 3, 7, 7)) { lockR(c, i - 3, j - 3, 7, 7);
      add(c, 'rings', { i, j, r: 2.25, w: 0.6, gaps: 2, gap: 110, spin: pick([1, -1]), a0: ri(0, 8) * 20 }); return true; } } return false; },
  hail(c, s) { for (let t = 0; t < 80; t++) { const w = ri(2, 4), h = ri(2, 4), [i, j] = inSec(s, 0); if (i + w - 1 > s.x1 || j + h - 1 > s.y1) continue;
      if (rectE(c, i, j, w, h)) { lockR(c, i, j, w, h); add(c, 'hail', { i, j, w, h, d: CFG.hailDirs ? pick(CFG.hailDirs) : 'D', n: 1, phase: pick([0, 0.25, 0.5, 0.75]) }); return true; } } return false; },
  bow(c, s, cloud) { for (let t = 0; t < 120; t++) { const r = ri(2, 4), a0 = pick([0, 90, 180, 270]), span = pick([90, 180]), [i, j] = [ri(s.x0, s.x1), ri(s.y0, s.y1)];
      const cells = new Set(); let ok = true;
      for (let q = 0; q <= 24 && ok; q++) { const a = (a0 + span * q / 24) * Math.PI / 180, x = Math.round(i + Math.cos(a) * r), y = Math.round(j + Math.sin(a) * r);
        if (x < s.x0 || x > s.x1 || y < s.y0 || y > s.y1 || !isE(c, x, y)) ok = false; cells.add(K(x, y)); }
      if (!ok) continue; cells.forEach((k) => c.lock.add(k)); const o = { i, j, r, a0, a1: a0 + span }; if (cloud !== undefined) o.cloud = cloud; add(c, 'bows', o); return true; } return false; },
  prism(c, s, col) { const p = point(c, s, 1); if (!p) return false; c.lock.add(K(...p)); add(c, 'prisms', { i: p[0], j: p[1], c: col || pick(['r', 'b', 'g', 'v']) }); return true; },
  rain(c, s) { for (let t = 0; t < 60; t++) { const w = ri(2, 3), h = 2, [i, j] = inSec(s, 1); if (rectE(c, i, j, w, h)) { lockR(c, i, j, w, h);
      const k = (c.f.rain || []).length; add(c, 'rain', { i, j, w, h }); return k; } } return false; },
  fall(c, s) { for (let t = 0; t < 60; t++) { const h = ri(2, 4), [i, j] = inSec(s, 1); if (rectE(c, i, j, 1, h)) { lockR(c, i, j, 1, h); add(c, 'falls', { i, j, w: 1, h }); return true; } } return false; },
  sun(c, s) { for (let t = 0; t < 60; t++) { const [i, j] = inSec(s, 1); if (rectE(c, i, j, 2, 2)) { lockR(c, i, j, 2, 2); add(c, 'suns', { i, j, w: 2, h: 2 }); return true; } } return false; },
  lantern(c, s) { const p = point(c, s, 1); if (!p) return false; c.lock.add(K(...p)); add(c, 'lanterns', { i: p[0], j: p[1] }); return (c.f.lanterns.length - 1); },
};
const rectOf = (cells) => { const xs = cells.map((p) => p[0]), ys = cells.map((p) => p[1]); const i = Math.min(...xs), j = Math.min(...ys); return { i, j, w: Math.max(...xs) - i + 1, h: Math.max(...ys) - j + 1 }; };
function build() {
  const c = base();
  // gap plugs: each gap may need a mechanic from an earlier section
  c.gaps.forEach((gp, k) => {
    const plug = CFG.plugs ? CFG.plugs[k % CFG.plugs.length] : null, before = c.secs[ri(0, k)];
    if (plug === 'gate') { const col = pick(['r', 'b', 'g', 'v', 'o']); if (FEAT.prism(c, before, col)) add(c, 'gates', Object.assign(rectOf(gp.cells), { c: col })); }
    if (plug === 'ice') { const l = FEAT.lantern(c, before); if (l !== false) add(c, 'ice', Object.assign(rectOf(gp.cells), { l })); }
    if (plug === 'glacier') { if (FEAT.sun(c, before)) add(c, 'glaciers', rectOf(gp.cells)); }
    if (plug === 'crack') { if (FEAT.fall(c, before)) add(c, 'cracks', rectOf(gp.cells)); }
  });
  for (const s of c.secs) for (const [name, lo, hi, arg] of CFG.feats) { const n = ri(lo, hi); for (let q = 0; q < n; q++) FEAT[name](c, s, arg); }
  if (CFG.hiddenBows) for (let q = 0; q < CFG.hiddenBows; q++) { const s = pick(c.secs), k = FEAT.rain(c, s); if (k !== false) FEAT.bow(c, pick(c.secs), k); }
  for (const s of c.secs) { const n = ri(CFG.stubs[0], CFG.stubs[1]); for (let q = 0; q < n; q++) { const p = point(c, s, 0); if (!p) continue; c.g[p[1]][p[0]] = '#';
      if (rnd() < 0.5) { const [a, b] = rnd() < 0.5 ? [p[0] + 1, p[1]] : [p[0], p[1] + 1]; if (isE(c, a, b) && a <= s.x1 && b <= s.y1) c.g[b][a] = '#'; } } }
  c.S = placeSE(c, c.secs[0], true); c.E = placeSE(c, c.secs[c.secs.length - 1], false);
  return c.S && c.E ? c : null;
}
function placeSE(c, s, needWall) { for (let t = 0; t < 80; t++) { const [i, j] = inSec(s, 0); if (!isE(c, i, j)) continue;
    if (needWall && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => c.g[j + dy][i + dx] === '#')) continue; return [i, j]; } return null; }
function toDef(c, shards) {
  const g = c.g.map((r) => r.slice()); g[c.S[1]][c.S[0]] = 'S'; g[c.E[1]][c.E[0]] = 'E'; for (const [i, j] of shards || []) g[j][i] = '*';
  const d = { name: 'gen', map: g.map((r) => r.join('')) }; for (const k in c.f) d[k] = JSON.parse(JSON.stringify(c.f[k]));
  if (d.movers || d.rocks || d.rings || d.hail) d.period = CFG.period || 4;
  return d;
}
function route(def, win, WAIT) {   // replay the shortest route: events + every cell the photon flies through
  const L = SIM.parseLevel(def); let st = SIM.newState(L); const ev = new Set(), cells = []; const seen = new Set();
  SIM.setTrace((s) => { const k = Math.floor(s.x / 48) + ',' + Math.floor(s.y / 48); if (!seen.has(k)) { seen.add(k); cells.push(k.split(',').map(Number)); } });
  for (const a of win) { const r = a === 'w' ? SIM.simulate(L, st, 'WAIT', WAIT / SIM.timeScale(L, st.x, st.y)) : SIM.simulate(L, st, a.split('>')[0]); (r.events || []).forEach((e) => ev.add(e.type)); st = r.st; if (st.mode === 'dead') { ev.add('death'); st = SIM.clone(st); SIM.respawn(L, st); } }
  SIM.setTrace(null); return { ev, cells, seen };
}
function score(c) {
  const def = toDef(c); const L = SIM.parseLevel(def); if (!SIM.contacts(L, ...L.start).length) return null;
  let r; try { r = analyze(def); } catch (e) { if (process.env.DBG) console.error(e); return null; }
  if (process.env.DBG) console.error("win", !!r.win, r.dead.length, r.unsafe.length);
  if (!r.win || r.dead.length || r.unsafe.length) return null;
  const moves = r.win.filter((x) => x !== 'w').length; if (moves < (CFG.minMoves || 0) * 0.5) return null;
  const rt = route(def, r.win, r.WAIT);
  let miss = (CFG.need || []).filter((e) => !rt.ev.has(e)).length;
  if (r.win.some((t) => t.endsWith('>dead'))) miss += 2;     // the shortest route must not need a death
  for (const h of (def.hail || [])) { let hit = false; for (let y = h.j; y < h.j + h.h; y++) for (let x = h.i; x < h.i + h.w; x++) if (rt.seen.has(x + ',' + y)) hit = true; if (!hit) miss++; }
  if ((def.hail || def.rocks || def.rings || CFG.needDeaths) && !r.deaths.length) miss++;
  let lonely = 0, inner = 0;
  for (const sc of c.secs) for (let j = sc.y0; j <= sc.y1; j++) for (let i = sc.x0; i <= sc.x1; i++) if (c.g[j][i] === '#' && !c.div.has(K(i, j))) { inner++;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => c.g[j + dy][i + dx] === '#')) lonely++; }
  const tg = CFG.target || 20;
  return { moves, sc: Math.min(moves, tg) * 4 + Math.min(Math.max(0, moves - tg), 6) * 0.5 - lonely * 0.6 - inner * 0.1 + Math.min(r.states, 120) / 20 + rt.ev.size * 2 - miss * 15 - Math.max(0, moves - (CFG.maxMoves || 99)) * 3, miss, r, rt, def };
}
function clone(c) { return { g: c.g.map((r) => r.slice()), lock: c.lock, div: c.div, f: c.f, secs: c.secs, gaps: c.gaps, tiles: c.tiles, S: c.S, E: c.E }; }
let best = null; const t0 = Date.now();
for (let k = 0; k < RESTARTS || (!best && Date.now() - t0 < (CFG.maxSec || 150) * 400); k++) { const c = build(); if (!c) continue; const s = score(c); if (s && (!best || s.sc > best.s.sc)) best = { c, s }; }
if (!best) { console.log('no valid start'); process.exit(1); }
console.error('start', best.s.moves, ((Date.now() - t0) / 1000).toFixed(1) + 's');
for (let it = 0; it < CLIMB; it++) {
  const c = clone(best.c), op = rnd();
  if (op < 0.7) { const s = pick(c.secs); const [i, j] = inSec(s, 0); if (c.lock.has(K(i, j)) || c.div.has(K(i, j)) || (c.S + '') === (i + ',' + j) || (c.E + '') === (i + ',' + j)) continue;
    if (c.g[j][i] === '.') { c.g[j][i] = '#'; if (rnd() < 0.4) { const [a, b] = pick([[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]); if (isE(c, a, b) && a >= s.x0 && a <= s.x1 && b >= s.y0 && b <= s.y1 && (c.S + '') !== (a + ',' + b) && (c.E + '') !== (a + ',' + b)) c.g[b][a] = '#'; } }
    else if (c.g[j][i] === '#') c.g[j][i] = '.'; else continue; }
  else if (op < 0.85) { const p = placeSE(c, c.secs[0], true); if (!p) continue; c.S = p; }
  else { const p = placeSE(c, c.secs[c.secs.length - 1], false); if (!p) continue; c.E = p; }
  const s = score(c); if (s && s.sc >= best.s.sc) { if (s.moves > best.s.moves) console.error('it', it, 'moves', s.moves); best = { c, s }; }
  if (Date.now() - t0 > (CFG.maxSec || 150) * 1000) break;
}
// shards along the route (spread out, on empty cells outside hazards)
const def0 = best.s.def, hz = new Set(); for (const h of (def0.hail || [])) for (let y = h.j; y < h.j + h.h; y++) for (let x = h.i; x < h.i + h.w; x++) hz.add(x + ',' + y);
const cand = best.s.rt.cells.filter(([i, j]) => best.c.g[j][i] === '.' && !hz.has(i + ',' + j) && !(best.c.S + '' === i + ',' + j) && !(best.c.E + '' === i + ',' + j));
const nS = CFG.shards || 3, sh = []; for (let k = 0; k < nS && cand.length; k++) sh.push(cand[Math.floor((k + 0.6) * cand.length / (nS + 0.3))]);
const def = toDef(best.c, sh); const r = analyze(def);
console.log(JSON.stringify({ miss: best.s.miss, moves: r.win.filter((x) => x !== 'w').length, states: r.states, deaths: r.deaths.length, dead: r.dead.length, unsafe: r.unsafe.length, shards: r.shards + '/' + r.L.shards.length, events: [...best.s.rt.ev].join(','), pretty: r.pretty }));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(def));
console.log(def.map.join('\n')); const o = Object.assign({}, def); delete o.map; console.log(JSON.stringify(o));
