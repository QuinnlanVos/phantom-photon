// ============================================================================
// Phantom Photon - core movement simulation (pure JS, no GDevelop dependency).
// The same code runs inside the game (JavaScript event) and in Node for the
// level solver / tests (src/solve.js). The body of this file is wrapped in an
// IIFE by build_project.py, so it ends with a `return`.
// Tiles: '#' wall  'P' launch pad  'a'-'d' ramps  'M' mirror block  'm' '/' mirror  'n' '\' mirror
//        'O' black hole  'X' burning star  'E' exit  '*' shard  'S' start   (+ level.movers: moving platforms)
// Solar Winds (chapter 3) adds level lists:
//   winds:  [{i,j,w,h,d:'L'|'R'|'U'|'D',s}]  wind zones: a flying orb is accelerated along d (s px/s^2) - tailwinds speed you
//           up (past top speed), headwinds brake and can blow you back, crosswinds bend the flight
//   curves: [{i,j,r,c:'SE'|'SW'|'NE'|'NW'}]   quarter-pipe boost walls filling an r x r block whose solid corner is c:
//           a flight entering the block rides the arc (lane-snapped, deterministic) and exits along the tangent at BOOST_V
//   wells:  [{i,j,r}]                        gravity wells: time runs slower near them (TS_MIN at the core) - everything,
//           the orb and the moving platforms alike, so timing windows open up
// Rocks from Space (chapter 4) adds level lists (all on world time st.time, periodic in level.period -> solver-exact):
//   rocks:  [{i,j,r,axis?,range?,phase?,k?}]  asteroids: lethal discs (radius r tiles); optional ping-pong drift along axis
//           (range tiles, k round trips per period) on a dotted track
//   rings:  [{i,j,r,w,gaps,gap,spin,a0}]       rings of space dust: a band (radius r, width w tiles) around a calm eye, with
//           `gaps` openings of `gap` degrees each, turning `spin` revolutions per period (sign = direction)
//   hail:   [{i,j,w,h,d,n,phase,safe,tele}]    cosmic hail lanes: n cycles per period; calm for `safe` of each cycle, then a
//           `tele`-second telegraph shimmer (harmless), then the barrage (lethal) until the cycle ends
// Hazards only hit a flying orb; the solver verifies that no resting spot is ever inside one.
// ============================================================================
const T = 48;                    // tile size (world px)
const H = T / 2 - 0.5;           // collision half-size of the orb (a box ~1 tile)
const V0 = 260, VMAX = 960, ACC = 7000;   // launch speed, top speed (px/s), ease-in accel (px/s^2)
const PAD_V0 = 620;              // launch-pad kick starts faster
const G = 3.0e7;                 // black-hole gravity strength (px^3/s^2)
const G_RANGE = 3.6 * T;         // influence radius of a black hole
const KILL = 0.42 * T;           // swallow radius
const EXIT_R = 0.42 * T, SHARD_R = 0.6 * T;
const STAR_R = 0.65 * T;          // a burning star consumes the orb inside this radius
const BOOST_V = 1560;            // exit speed off a curved boost wall (decays back to VMAX)
const BOOST_DECAY = 0.6;         // boost fades over ~1.7 s of flight
const WIND_VMAX = 1560, WIND_S = 2600;    // fastest a tailwind can push you; default wind strength (px/s^2)
const OVER_DECAY = 1400;         // px/s^2: extra speed (from wind) bleeds off once outside the wind
const TS_MIN = 0.3;              // gravity well: time scale at its core
const MAX_FLIGHT = 5;            // seconds; a flight that never lands is treated as lost
const SUB = 1 / 600;             // fixed sub-step (game and solver produce identical paths)
const ROCK_PAD = 10;             // px added to an asteroid's core hit radius (0.82 r) for the orb
const RING_PAD = 0.26 * T;       // the orb's radius against dust bands and gap edges
const HAIL_PAD = 0.18 * T;       // the orb counts as in a hail lane once its centre is this close to the lane
const DIRS = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
const OPP = { L: 'R', R: 'L', U: 'D', D: 'U' };
const RAMPS = { a: { solid: 'SE', back: 'RD', line: '/' }, b: { solid: 'SW', back: 'LD', line: '\\' },
                c: { solid: 'NW', back: 'LU', line: '/' }, d: { solid: 'NE', back: 'RU', line: '\\' } };
const DIAG_MIRRORS = { m: '/', n: '\\' };

function parseLevel(def) {
  const rows = def.map.slice();
  const L = { w: rows[0].length, h: rows.length, cells: [], start: null, exit: null, shards: [], holes: [], pads: [], ramps: [],
              mirrors: [], stars: [], movers: [], period: def.period || 4 };
  for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) {
    const ch = rows[j][i] || '#';
    let t = '.';
    if (ch === '#') t = '#';
    else if (ch === 'P') { t = 'P'; L.pads.push([i, j]); }
    else if (ch === 'M') { t = 'M'; L.mirrors.push([i, j, 'M']); }
    else if (DIAG_MIRRORS[ch]) { t = ch; L.mirrors.push([i, j, ch]); }
    else if (RAMPS[ch]) { t = ch; L.ramps.push([i, j, ch]); }
    else if (ch === 'S') L.start = [i, j];
    else if (ch === 'E') L.exit = [i, j];
    else if (ch === '*') L.shards.push([i, j]);
    else if (ch === 'O') L.holes.push([i, j]);
    else if (ch === 'X') L.stars.push([i, j]);
    L.cells.push(t);
  }
  // moving platform: {i, j, w, h (tiles), axis 'x'|'y', range (tiles, +/-), phase 0..1}; ping-pongs with ease over L.period
  for (const m of (def.movers || [])) L.movers.push(Object.assign({ w: 1, h: 1, axis: 'x', range: 2, phase: 0 }, m));
  L.winds = (def.winds || []).map((w) => { const [dx, dy] = DIRS[w.d]; const s = w.s || WIND_S;
    return Object.assign({ x0: w.i * T, y0: w.j * T, x1: (w.i + w.w) * T, y1: (w.j + w.h) * T, ax: dx * s, ay: dy * s }, w); });
  L.curves = (def.curves || []).map((c) => {
    const sx = c.c.includes('E') ? 1 : -1, sy = c.c.includes('S') ? 1 : -1;
    const x0 = c.i * T, y0 = c.j * T, x1 = x0 + c.r * T, y1 = y0 + c.r * T;
    for (let j = c.j; j < c.j + c.r; j++) for (let i = c.i; i < c.i + c.r; i++) L.cells[j * L.w + i] = 'C';   // passable, never stickable
    return Object.assign({ sx, sy, x0, y0, x1, y1, cx: sx > 0 ? x0 : x1, cy: sy > 0 ? y0 : y1 }, c);
  });
  L.wells = (def.wells || []).map((w) => Object.assign({ x: center(w.i), y: center(w.j), R: (w.r || 2.5) * T }, w));
  L.rocks = (def.rocks || []).map((r) => Object.assign({ axis: 'x', range: 0, phase: 0, k: 1, r: 0.8 }, r, { x: center(r.i), y: center(r.j) }));
  L.rocks.forEach((r) => { r.R = r.r * T; r.hit = r.r * T * 0.82 + ROCK_PAD; });
  L.rings = (def.rings || []).map((g) => { const o = Object.assign({ r: 2.25, w: 0.6, gaps: 2, gap: 100, spin: 1, a0: 0 }, g);
    return Object.assign(o, { x: center(g.i), y: center(g.j), R: o.r * T, hw: o.w * T / 2, gapR: o.gap * Math.PI / 180 }); });
  L.hail = (def.hail || []).map((h) => Object.assign({ d: 'D', n: 1, phase: 0, safe: 0.5, tele: 0.8 }, h,
    { x0: h.i * T, y0: h.j * T, x1: (h.i + h.w) * T, y1: (h.j + h.h) * T }));
  return L;
}
function cell(L, i, j) { return (i < 0 || j < 0 || i >= L.w || j >= L.h) ? '#' : L.cells[j * L.w + i]; }
const isFlat = (t) => t === '#' || t === 'P';
const center = (i) => i * T + T / 2;
const toCell = (x) => Math.floor(x / T);

// ---------------------------------------------------------------- moving platforms
function moverOffset(L, m, time) {       // tiles along its axis
  const u = time / L.period + m.phase;
  return m.range * (0.5 - 0.5 * Math.cos(2 * Math.PI * u));
}
function moverRect(L, m, time) {
  const o = moverOffset(L, m, time) * T;
  const x0 = m.i * T + (m.axis === 'x' ? o : 0), y0 = m.j * T + (m.axis === 'y' ? o : 0);
  return { x0, y0, x1: x0 + m.w * T, y1: y0 + m.h * T };
}
function windAt(L, x, y) {
  let ax = 0, ay = 0, any = false;
  for (const w of L.winds) if (x > w.x0 && x < w.x1 && y > w.y0 && y < w.y1) { ax += w.ax; ay += w.ay; any = true; }
  return any ? [ax, ay] : null;
}
// time scale at a point: 1 far from wells, TS_MIN near a well's core (smooth in space, so no hidden state)
function timeScale(L, x, y) {
  let ts = 1;
  for (const w of L.wells) {
    const d = Math.hypot(x - w.x, y - w.y); if (d >= w.R) continue;
    const u = Math.min(1, (w.R - d) / (w.R * 0.45)), k = u * u * (3 - 2 * u);
    ts = Math.min(ts, 1 - (1 - TS_MIN) * k);
  }
  return ts;
}
// ---------------------------------------------------------------- Rocks from Space hazards (pure functions of world time)
function isTimed(L) { return L.movers.length > 0 || L.rings.length > 0 || L.hail.length > 0 || L.rocks.some((r) => r.range > 0); }
function rockPos(L, r, t) {
  if (!r.range) return [r.x, r.y];
  const o = r.range * T * (0.5 - 0.5 * Math.cos(2 * Math.PI * (r.k * t / L.period + r.phase)));
  return r.axis === 'x' ? [r.x + o, r.y] : [r.x, r.y + o];
}
function ringAngle(L, g, t) { return g.a0 * Math.PI / 180 + 2 * Math.PI * g.spin * t / L.period; }
// angular distance (radians) from angle a to the nearest gap centre of ring g at time t
function gapOffset(L, g, a, t) {
  const step = 2 * Math.PI / g.gaps; let u = (a - ringAngle(L, g, t)) % step; if (u < 0) u += step;
  return Math.min(u, step - u);
}
// hail lane phase at time t: { ph: 'calm'|'tele'|'hail', u: 0..1 progress through that phase, cyc: cycle length (s) }
function hailPhase(L, h, t) {
  const cyc = L.period / h.n; let u = (t / cyc + h.phase) % 1; if (u < 0) u += 1;
  const te = Math.min(0.45, h.tele / cyc), s0 = h.safe, s1 = Math.min(0.95, h.safe + te);
  if (u < s0) return { ph: 'calm', u: u / s0, cyc };
  if (u < s1) return { ph: 'tele', u: (u - s0) / (s1 - s0), cyc };
  return { ph: 'hail', u: (u - s1) / (1 - s1), cyc };
}
// which hazard (if any) hits an orb centred at (x,y) at world time t: 'rock' | 'dust' | 'hail' | null
function hazardAt(L, x, y, t) {
  for (const r of L.rocks) { const [rx, ry] = rockPos(L, r, t); if (Math.hypot(x - rx, y - ry) < r.hit) return 'rock'; }
  for (const g of L.rings) {
    const d = Math.hypot(x - g.x, y - g.y);
    if (d < g.R - g.hw - RING_PAD || d > g.R + g.hw + RING_PAD) continue;
    const off = gapOffset(L, g, Math.atan2(y - g.y, x - g.x), t), need = Math.asin(Math.min(1, RING_PAD / Math.max(d, 1)));
    if (off > g.gapR / 2 - need) return 'dust';
  }
  for (const h of L.hail) {
    if (x > h.x0 - HAIL_PAD && x < h.x1 + HAIL_PAD && y > h.y0 - HAIL_PAD && y < h.y1 + HAIL_PAD && hailPhase(L, h, t).ph === 'hail') return 'hail';
  }
  return null;
}
// can a hazard ever reach the point (x,y)? (static check over the whole period, used for resting spots)
function hazardEver(L, x, y) {
  for (const g of L.rings) { const d = Math.hypot(x - g.x, y - g.y); if (d >= g.R - g.hw - RING_PAD && d <= g.R + g.hw + RING_PAD) return 'dust'; }
  for (const h of L.hail) if (x > h.x0 - HAIL_PAD && x < h.x1 + HAIL_PAD && y > h.y0 - HAIL_PAD && y < h.y1 + HAIL_PAD) return 'hail';
  for (let q = 0; q < 240; q++) { const t = q * L.period / 240; for (const r of L.rocks) { const [rx, ry] = rockPos(L, r, t); if (Math.hypot(x - rx, y - ry) < r.hit) return 'rock'; } }
  return null;
}
const overlap = (x, y, r) => x + H > r.x0 && x - H < r.x1 && y + H > r.y0 && y - H < r.y1;

// Does tile (i,j) present a flat, stickable face on `side` (the side facing the orb)?
function faceFrom(L, i, j, side) {
  const t = cell(L, i, j);
  if (isFlat(t)) return true;
  if (RAMPS[t]) return RAMPS[t].back.includes(side);
  return false;                           // empty tiles and mirrors: nothing to stick to
}
// Walls the orb (stuck in cell i,j) is touching: list of directions from orb to wall.
function contacts(L, i, j) {
  const out = [];
  for (const d in DIRS) { const [dx, dy] = DIRS[d]; if (faceFrom(L, i + dx, j + dy, OPP[d])) out.push(d); }
  return out;
}
function stuckContacts(L, st) { return st.ride ? [st.ride.side] : contacts(L, st.i, st.j); }
// Movement rule: a swipe in `d` is legal only if it is parallel to a wall the orb touches
// and it is not straight into a wall face.
function checkMove(L, st, d) {
  if (typeof st === 'number') { st = { i: arguments[1], j: arguments[2], ride: null }; d = arguments[3]; }   // legacy (L, i, j, d)
  const c = stuckContacts(L, st);
  const horiz = d === 'L' || d === 'R';
  const parallel = c.some((k) => horiz ? (k === 'U' || k === 'D') : (k === 'L' || k === 'R'));
  if (c.includes(d)) return { ok: false, why: 'into' };
  if (!parallel) return { ok: false, why: 'away' };
  return { ok: true };
}
// Launch pad: returns the direction away from a pad the orb touches (prefer `prefer` = side of last impact).
function padLaunchDir(L, i, j, prefer) {
  if (typeof i === 'object') { const st = i; if (st.ride) return null; prefer = st.normal; j = st.j; i = st.i; }
  const ds = Object.keys(DIRS).filter((d) => { const [dx, dy] = DIRS[d]; return cell(L, i + dx, j + dy) === 'P'; });
  if (!ds.length) return null;
  const d = ds.includes(prefer) ? prefer : ds[0];
  return OPP[d];
}

// Is the orb box at (x,y) blocked by tile (i,j)? Ramps are only solid from their flat back sides.
function tileBlocks(L, i, j, x, y) {
  const t = cell(L, i, j);
  if (isFlat(t) || t === 'M') return true;
  if (!RAMPS[t]) return false;
  const x0 = i * T, y0 = j * T, x1 = x0 + T, y1 = y0 + T, back = RAMPS[t].back;
  if (x >= x1 && back.includes('R')) return true;
  if (x <= x0 && back.includes('L')) return true;
  if (y >= y1 && back.includes('D')) return true;
  if (y <= y0 && back.includes('U')) return true;
  return false;
}
// first blocking rect for the orb box at (x,y): {x0,y0,x1,y1, mirror, mover}
let GHOST = -1;   // the platform the orb just launched from: ignored until the orb has cleared it
function boxHit(L, x, y, refX, refY, time) {
  const i0 = toCell(x - H), i1 = toCell(x + H), j0 = toCell(y - H), j1 = toCell(y + H);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (tileBlocks(L, i, j, refX, refY))
    return { x0: i * T, y0: j * T, x1: i * T + T, y1: j * T + T, mirror: cell(L, i, j) === 'M', mover: -1 };
  for (let k = 0; k < L.movers.length; k++) { if (k === GHOST) continue; const r = moverRect(L, L.movers[k], time); if (overlap(x, y, r)) return Object.assign(r, { mirror: false, mover: k }); }
  return null;
}

function startFlight(st, d, kick, L) {
  const [dx, dy] = DIRS[d];
  st.ghost = -1;
  if (st.ride && L) st.ghost = st.ride.m;
  if (st.ride && L) {   // leaving a moving platform: line up with the nearest free lane across the launch direction
    GHOST = st.ghost;
    const v = dx ? st.y : st.x, c0 = toCell(v), cands = [c0 - 1, c0, c0 + 1].sort((a, b) => Math.abs(center(a) - v) - Math.abs(center(b) - v));
    for (const c of cands) {
      const x = dx ? st.x : center(c), y = dx ? center(c) : st.y;
      if (!boxHit(L, x, y, x, y, st.time)) { st.x = x; st.y = y; break; }
    }
    GHOST = -1;
    st.ride = null;
  } else if (st.ride) st.ride = null;
  st.mode = 'fly'; st.dir = d; st.t = 0; st.acc = 0; st.rail = null; st.boost = 0;
  st.speed = kick ? PAD_V0 : V0; st.vx = dx * st.speed; st.vy = dy * st.speed;
  st.events = [];
}
function newState(L) {
  const [i, j] = L.start;
  return { mode: 'stuck', i, j, x: center(i), y: center(j), vx: 0, vy: 0, speed: 0, normal: null, lastStuck: [i, j], ride: null,
           got: L.shards.map(() => false), events: [], t: 0, time: 0, acc: 0 };
}

// Advance the world by dt seconds in fixed sub-steps: moving platforms (carrying a riding orb) and the orb's flight.
// Pushes events: shard, deflect, mirror, graze, stick, exit, swallow, burn, crush, lost.
function step(L, st, dt) {
  st.acc = (st.acc || 0) + dt;
  while (st.acc >= SUB - 1e-9 && (st.mode === 'fly' || st.mode === 'stuck')) {
    st.acc -= SUB;
    const ts = L.wells.length ? timeScale(L, st.x, st.y) : 1; st.ts = ts;
    st.time = (st.time || 0) + SUB * ts;
    if (st.mode === 'stuck') { stuckSub(L, st); continue; }
    flySub(L, st, SUB * ts);
  }
}
function stuckSub(L, st) {
  if (!L.movers.length) return;
  if (st.ride) {
    const r = moverRect(L, L.movers[st.ride.m], st.time);
    st.x = r.x0 + st.ride.rx; st.y = r.y0 + st.ride.ry;
    // carried into a static wall -> crushed
    const i0 = toCell(st.x - H + 1), i1 = toCell(st.x + H - 1), j0 = toCell(st.y - H + 1), j1 = toCell(st.y + H - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (tileBlocks(L, i, j, st.x, st.y)) { die(st, 'crush', st.x, st.y); return; }
    pickups(L, st);
  } else {
    for (let k = 0; k < L.movers.length; k++) if (overlap(st.x, st.y, moverRect(L, L.movers[k], st.time))) { die(st, 'crush', st.x, st.y); return; }
  }
}
function die(st, type, x, y) { st.mode = 'dead'; st.hole = type === 'swallow' ? [x, y] : null; st.deathType = type; st.ride = null; st.events.push({ type, x, y }); }
function pickups(L, st) {
  L.shards.forEach(([si, sj], k) => {
    if (!st.got[k] && Math.hypot(center(si) - st.x, center(sj) - st.y) < SHARD_R) { st.got[k] = true; st.events.push({ type: 'shard', k, x: center(si), y: center(sj) }); }
  });
  if (L.exit && Math.hypot(center(L.exit[0]) - st.x, center(L.exit[1]) - st.y) < EXIT_R) { st.mode = 'exit'; st.ride = null; st.events.push({ type: 'exit' }); }
}
function flySub(L, st, h) {
  st.t += h;
  if (st.ghost >= 0) {   // launched off a platform: it can't re-catch the orb until the orb is clear of it along the flight
    const r = moverRect(L, L.movers[st.ghost], st.time);
    const clear = st.vx !== 0 ? (st.x - H >= r.x1 || st.x + H <= r.x0) : (st.y - H >= r.y1 || st.y + H <= r.y0);
    if (clear || st.t > 0.6) st.ghost = -1;
  }
  GHOST = st.ghost >= 0 ? st.ghost : -1;
  if (L.rocks.length || L.rings.length || L.hail.length) { const hz = hazardAt(L, st.x, st.y, st.time); if (hz) { GHOST = -1; return die(st, hz, st.x, st.y); } }
  const res = flySub2(L, st, h);
  GHOST = -1;
  return res;
}
function flySub2(L, st, h) {
  // a moving platform swept into the flying orb: it catches the orb (pushed out on the shallowest side)
  for (let k = 0; k < L.movers.length; k++) {
    if (k === GHOST) continue;
    const r = moverRect(L, L.movers[k], st.time);
    if (!overlap(st.x, st.y, r)) continue;
    const pen = { R: st.x + H - r.x0, L: r.x1 - (st.x - H), D: st.y + H - r.y0, U: r.y1 - (st.y - H) };
    const side = Object.keys(pen).sort((a, b) => pen[a] - pen[b])[0];
    if (side === 'R') st.x = r.x0 - T / 2; else if (side === 'L') st.x = r.x1 + T / 2; else if (side === 'D') st.y = r.y0 - T / 2; else st.y = r.y1 + T / 2;
    return stick(L, st, side, Object.assign(r, { mover: k, mirror: false }));
  }
  if (st.rail) return railSub(L, st, h);
  st.boost = Math.max(0, (st.boost || 0) - BOOST_DECAY * h);
  const wind = L.winds.length ? windAt(L, st.x, st.y) : null;
  if (wind) {   // wind: plain acceleration along its vector (tailwind = faster, headwind = slower / blown back, crosswind = bent)
    st.vx += wind[0] * h; st.vy += wind[1] * h;
    const s = Math.hypot(st.vx, st.vy);
    if (s < 1e-6) { st.vx = wind[0] * h; st.vy = wind[1] * h; }
    st.speed = Math.min(WIND_VMAX, Math.max(s, 1e-3)); st.inWind = true;
  } else {
    const cap = VMAX + (BOOST_V - VMAX) * st.boost;
    if (st.speed < cap) st.speed = Math.min(cap, st.speed + ACC * h); else st.speed = Math.max(cap, st.speed - OVER_DECAY * h);
    st.inWind = false;
  }
  for (const [hi, hj] of L.holes) {         // black-hole gravity
    const hx = center(hi), hy = center(hj), ddx = hx - st.x, ddy = hy - st.y, dist = Math.hypot(ddx, ddy);
    if (dist < KILL) return die(st, 'swallow', hx, hy);
    if (dist < G_RANGE) {
      const fall = 1 - dist / G_RANGE;      // fades smoothly to 0 at the edge of the well
      const a = G / Math.max(dist * dist, T * T * 0.5) * fall;
      st.vx += a * ddx / dist * h; st.vy += a * ddy / dist * h;
    }
  }
  for (const [si, sj] of L.stars) if (Math.hypot(center(si) - st.x, center(sj) - st.y) < STAR_R) return die(st, 'burn', st.x, st.y);
  const vl = Math.hypot(st.vx, st.vy) || 1; st.vx *= st.speed / vl; st.vy *= st.speed / vl;  // gravity bends, doesn't brake
  // ramps and diagonal mirrors: reflect when the orb's centre would cross the diagonal
  let nx = st.x + st.vx * h, ny = st.y + st.vy * h;
  const ci = toCell(nx), cj = toCell(ny), t = cell(L, ci, cj);
  if (RAMPS[t] && !tileBlocks(L, ci, cj, st.x, st.y)) {
    const u = (nx - ci * T) / T, v = (ny - cj * T) / T, R = RAMPS[t];
    let inSolid;
    if (R.line === '/') inSolid = R.solid === 'SE' ? u + v > 1 : u + v < 1;
    else inSolid = R.solid === 'SW' ? v > u : v < u;
    if (inSolid) { [nx, ny] = reflectDiag(st, R.line, ci, cj, u, v); st.events.push({ type: 'deflect', x: center(ci), y: center(cj), dir: st.dir }); }
  } else if (DIAG_MIRRORS[t]) {
    const line = DIAG_MIRRORS[t], u = (nx - ci * T) / T, v = (ny - cj * T) / T;
    const pu = (st.x - ci * T) / T, pv = (st.y - cj * T) / T;      // previous position in this tile's coordinates
    const s1 = line === '/' ? u + v - 1 : v - u, s0 = line === '/' ? pu + pv - 1 : pv - pu;
    if (s0 !== 0 && Math.sign(s1) !== Math.sign(s0)) { [nx, ny] = reflectDiag(st, line, ci, cj, u, v); st.events.push({ type: 'mirror', x: center(ci), y: center(cj), dir: st.dir }); }
  }
  // curved boost walls: entering a quarter-pipe block puts the orb on its arc
  if (L.curves.length) for (const c of L.curves) if (curveEnter(L, st, c, nx, ny)) return;
  // move X, then Y (axis-separated box collision). Head-on hit = stick (or bounce off a mirror); grazing hit = slide.
  let hit = boxHit(L, nx, st.y, st.x, st.y, st.time);
  if (hit) {
    const sx = Math.sign(nx - st.x) || Math.sign(st.vx); nx = sx > 0 ? hit.x0 - T / 2 : hit.x1 + T / 2;
    if (hit.mirror) { st.vx = -st.vx; st.events.push({ type: 'mirror', x: sx > 0 ? hit.x0 : hit.x1, y: st.y, dir: st.vx > 0 ? 'R' : 'L' }); }
    else if (Math.abs(st.vx) >= 0.5 * st.speed) { st.x = nx; return stick(L, st, sx > 0 ? 'R' : 'L', hit); }
    else { st.vx = 0; st.events.push({ type: 'graze' }); }
  }
  st.x = nx;
  hit = boxHit(L, st.x, ny, st.x, st.y, st.time);
  if (hit) {
    const sy = Math.sign(ny - st.y) || Math.sign(st.vy); ny = sy > 0 ? hit.y0 - T / 2 : hit.y1 + T / 2;
    if (hit.mirror) { st.vy = -st.vy; st.events.push({ type: 'mirror', x: st.x, y: sy > 0 ? hit.y0 : hit.y1, dir: st.vy > 0 ? 'D' : 'U' }); }
    else if (Math.abs(st.vy) >= 0.5 * st.speed) { st.y = ny; return stick(L, st, sy > 0 ? 'D' : 'U', hit); }
    else { st.vy = 0; st.events.push({ type: 'graze' }); }
  }
  st.y = ny;
  if (st.vx === 0 && st.vy === 0) { return stick(L, st, null, null); }
  st.dir = Math.abs(st.vx) > Math.abs(st.vy) ? (st.vx > 0 ? 'R' : 'L') : (st.vy > 0 ? 'D' : 'U');
  pickups(L, st);
  if (st.mode === 'fly' && st.t > maxFlight(L)) die(st, 'lost', st.x, st.y);
}
// ---------------------------------------------------------------- curved boost walls
const maxFlight = (L) => L.curves.length ? 8 : MAX_FLIGHT;     // long curve rides on big levels need more time
const inBox = (x, y, c) => x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1;
function curveEnter(L, st, c, nx, ny) {
  if (!inBox(nx, ny, c) || inBox(st.x, st.y, c)) return false;
  // which inner edge was crossed: the vertical one (x = cx) -> horizontal entry, the horizontal one (y = cy) -> vertical entry
  const crossV = c.sx > 0 ? (st.x <= c.cx && nx > c.cx) : (st.x >= c.cx && nx < c.cx);
  const crossH = c.sy > 0 ? (st.y <= c.cy && ny > c.cy) : (st.y >= c.cy && ny < c.cy);
  let horiz = crossV && !crossH ? true : crossH && !crossV ? false : Math.abs(st.vx) >= Math.abs(st.vy);
  if (!crossV && !crossH) return false;                       // entered through an outer side (levels never allow this)
  const lane = (d) => T / 2 + Math.max(0, Math.min(c.r - 1, Math.round((d - T / 2) / T))) * T;
  const R = horiz ? lane(Math.abs(ny - c.cy)) : lane(Math.abs(nx - c.cx));
  st.rail = { k: L.curves.indexOf(c), R, th: horiz ? Math.PI / 2 : 0, dir: horiz ? -1 : 1 };
  railPos(st, c);
  st.events.push({ type: 'curve', k: st.rail.k, x: st.x, y: st.y, R });
  return true;
}
function railPos(st, c) {
  const r = st.rail, co = Math.cos(r.th), si = Math.sin(r.th);
  st.x = c.cx + c.sx * r.R * co; st.y = c.cy + c.sy * r.R * si;
  st.vx = -c.sx * si * r.dir * st.speed; st.vy = c.sy * co * r.dir * st.speed;
  st.dir = Math.abs(st.vx) > Math.abs(st.vy) ? (st.vx > 0 ? 'R' : 'L') : (st.vy > 0 ? 'D' : 'U');
}
function railSub(L, st, h) {
  const r = st.rail, c = L.curves[r.k];
  st.speed = Math.min(BOOST_V, st.speed + ACC * h);      // the curve speeds you up while you ride it
  r.th += r.dir * st.speed * h / r.R;
  const done = r.dir > 0 ? r.th >= Math.PI / 2 : r.th <= 0;
  if (done) r.th = r.dir > 0 ? Math.PI / 2 : 0;
  railPos(st, c);
  if (done) {   // leave along the tangent, exactly on a lane, at boost speed
    if (r.dir > 0) { st.x = c.cx; st.y = c.cy + c.sy * r.R; st.vx = -c.sx * BOOST_V; st.vy = 0; }
    else { st.x = c.cx + c.sx * r.R; st.y = c.cy; st.vx = 0; st.vy = -c.sy * BOOST_V; }
    st.speed = BOOST_V; st.boost = 1; st.rail = null;
    st.dir = st.vx ? (st.vx > 0 ? 'R' : 'L') : (st.vy > 0 ? 'D' : 'U');
    st.events.push({ type: 'boost', k: L.curves.indexOf(c), x: st.x, y: st.y, dir: st.dir });
  }
  pickups(L, st);
  if (st.mode === 'fly' && st.t > maxFlight(L)) die(st, 'lost', st.x, st.y);   // endless curve loops are lost too
}
function reflectDiag(st, line, ci, cj, u, v) {
  let nx, ny;
  if (line === '/') { nx = ci * T + (1 - v) * T; ny = cj * T + (1 - u) * T; const vx = st.vx; st.vx = -st.vy; st.vy = -vx; }
  else { nx = ci * T + v * T; ny = cj * T + u * T; const vx = st.vx; st.vx = st.vy; st.vy = vx; }
  st.dir = Math.abs(st.vx) > Math.abs(st.vy) ? (st.vx > 0 ? 'R' : 'L') : (st.vy > 0 ? 'D' : 'U');
  return [nx, ny];
}
// Land: on a static wall snap to the nearest empty tile centre along it; on a moving platform attach to it (snapped to its tiles).
function stick(L, st, side, hit) {
  const impactSpeed = st.speed, fromX = st.x, fromY = st.y;
  if (hit && hit.mover >= 0) {
    const m = L.movers[hit.mover], r = hit;
    let rx = st.x - r.x0, ry = st.y - r.y0;
    if (side === 'L' || side === 'R') ry = Math.min(m.h - 1, Math.max(0, Math.round((ry - T / 2) / T))) * T + T / 2;
    else rx = Math.min(m.w - 1, Math.max(0, Math.round((rx - T / 2) / T))) * T + T / 2;
    st.rail = null; st.boost = 0; st.mode = 'stuck'; st.ride = { m: hit.mover, rx, ry, side }; st.normal = side; st.vx = st.vy = 0; st.speed = 0;
    st.x = r.x0 + rx; st.y = r.y0 + ry; st.i = toCell(st.x); st.j = toCell(st.y);
    st.events.push({ type: 'stick', side, mover: hit.mover, i: st.i, j: st.j, x: st.x, y: st.y, fromX, fromY, impact: impactSpeed });
    return;
  }
  let i = toCell(st.x), j = toCell(st.y);
  const cand = [];
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ci = i + di, cj = j + dj; if (cell(L, ci, cj) !== '.') continue;
    let ok = true;
    if (side) { const [dx, dy] = DIRS[side]; ok = faceFrom(L, ci + dx, cj + dy, OPP[side]); }
    else ok = contacts(L, ci, cj).length > 0;
    if (ok) cand.push([Math.hypot(center(ci) - st.x, center(cj) - st.y), ci, cj]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  if (cand.length) { i = cand[0][1]; j = cand[0][2]; }
  st.rail = null; st.boost = 0; st.mode = 'stuck'; st.ride = null; st.i = i; st.j = j; st.normal = side; st.vx = st.vy = 0; st.speed = 0; st.lastStuck = [i, j];
  st.events.push({ type: 'stick', side, i, j, x: center(i), y: center(j), fromX, fromY, impact: impactSpeed });
  st.x = center(i); st.y = center(j);
  pickups(L, st);
}
function respawn(L, st) {
  const [i, j] = st.lastStuck;
  Object.assign(st, { mode: 'stuck', i, j, x: center(i), y: center(j), vx: 0, vy: 0, speed: 0, ride: null, rail: null, boost: 0, events: [] });
}
function clone(st) { const s = JSON.parse(JSON.stringify(st)); s.events = []; return s; }
// Run a whole move instantly (used by the solver/tests). `wait` seconds pass first (moving platforms keep moving).
function simulate(L, st0, action, wait) {
  const st = clone(st0);
  if (wait) { step(L, st, wait); if (st.mode !== 'stuck') return { ok: true, st, events: st.events.splice(0) }; }
  const pre = st.events.splice(0);
  if (st.mode !== 'stuck') return { ok: false, why: 'busy', st };
  if (action === 'WAIT') return { ok: true, st, events: pre };
  if (action === 'TAP') {
    const d = padLaunchDir(L, st);
    if (!d) return { ok: false, why: 'nopad', st };
    startFlight(st, d, true, L);
  } else {
    const c = checkMove(L, st, action);
    if (!c.ok) return { ok: false, why: c.why, st };
    startFlight(st, action, false, L);
  }
  const evs = pre;
  while (st.mode === 'fly') { step(L, st, 1 / 60); evs.push(...st.events); st.events = []; }
  evs.push(...st.events); st.events = [];
  return { ok: true, st, events: evs };
}
return { isTimed, rockPos, ringAngle, gapOffset, hailPhase, hazardAt, hazardEver, RING_PAD, HAIL_PAD, BOOST_V, WIND_VMAX, TS_MIN, windAt, timeScale, T, H, V0, VMAX, ACC, G, G_RANGE, KILL, STAR_R, DIRS, OPP, RAMPS, DIAG_MIRRORS, parseLevel, cell, contacts, stuckContacts, checkMove,
         padLaunchDir, startFlight, newState, step, simulate, center, faceFrom, moverRect, moverOffset, respawn, clone };
