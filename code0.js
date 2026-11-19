gdjs.GameCode = {};
gdjs.GameCode.localVariables = [];
gdjs.GameCode.idToCallbackMap = new Map();
gdjs.GameCode.GDBgTileObjects1= [];
gdjs.GameCode.GDBgTileObjects2= [];
gdjs.GameCode.GDNebulaObjects1= [];
gdjs.GameCode.GDNebulaObjects2= [];
gdjs.GameCode.GDMoteObjects1= [];
gdjs.GameCode.GDMoteObjects2= [];
gdjs.GameCode.GDLevelArtObjects1= [];
gdjs.GameCode.GDLevelArtObjects2= [];
gdjs.GameCode.GDPadGlowObjects1= [];
gdjs.GameCode.GDPadGlowObjects2= [];
gdjs.GameCode.GDPadChevronObjects1= [];
gdjs.GameCode.GDPadChevronObjects2= [];
gdjs.GameCode.GDPortalCoreObjects1= [];
gdjs.GameCode.GDPortalCoreObjects2= [];
gdjs.GameCode.GDPortalRingObjects1= [];
gdjs.GameCode.GDPortalRingObjects2= [];
gdjs.GameCode.GDPortalRing2Objects1= [];
gdjs.GameCode.GDPortalRing2Objects2= [];
gdjs.GameCode.GDShardObjects1= [];
gdjs.GameCode.GDShardObjects2= [];
gdjs.GameCode.GDShardIconObjects1= [];
gdjs.GameCode.GDShardIconObjects2= [];
gdjs.GameCode.GDBhRangeObjects1= [];
gdjs.GameCode.GDBhRangeObjects2= [];
gdjs.GameCode.GDBhSwirlObjects1= [];
gdjs.GameCode.GDBhSwirlObjects2= [];
gdjs.GameCode.GDBhGlowObjects1= [];
gdjs.GameCode.GDBhGlowObjects2= [];
gdjs.GameCode.GDBhDiskObjects1= [];
gdjs.GameCode.GDBhDiskObjects2= [];
gdjs.GameCode.GDBhCoreObjects1= [];
gdjs.GameCode.GDBhCoreObjects2= [];
gdjs.GameCode.GDTrailObjects1= [];
gdjs.GameCode.GDTrailObjects2= [];
gdjs.GameCode.GDSparkObjects1= [];
gdjs.GameCode.GDSparkObjects2= [];
gdjs.GameCode.GDRingObjects1= [];
gdjs.GameCode.GDRingObjects2= [];
gdjs.GameCode.GDOrbHaloObjects1= [];
gdjs.GameCode.GDOrbHaloObjects2= [];
gdjs.GameCode.GDOrbObjects1= [];
gdjs.GameCode.GDOrbObjects2= [];
gdjs.GameCode.GDPreviewOrbObjects1= [];
gdjs.GameCode.GDPreviewOrbObjects2= [];
gdjs.GameCode.GDTitlePhantomObjects1= [];
gdjs.GameCode.GDTitlePhantomObjects2= [];
gdjs.GameCode.GDTitlePhotonObjects1= [];
gdjs.GameCode.GDTitlePhotonObjects2= [];
gdjs.GameCode.GDTxtClearObjects1= [];
gdjs.GameCode.GDTxtClearObjects2= [];
gdjs.GameCode.GDBtnRestartObjects1= [];
gdjs.GameCode.GDBtnRestartObjects2= [];
gdjs.GameCode.GDFlashObjects1= [];
gdjs.GameCode.GDFlashObjects2= [];
gdjs.GameCode.GDLevelTextObjects1= [];
gdjs.GameCode.GDLevelTextObjects2= [];
gdjs.GameCode.GDShardTextObjects1= [];
gdjs.GameCode.GDShardTextObjects2= [];
gdjs.GameCode.GDHintTextObjects1= [];
gdjs.GameCode.GDHintTextObjects2= [];
gdjs.GameCode.GDStartTextObjects1= [];
gdjs.GameCode.GDStartTextObjects2= [];
gdjs.GameCode.GDToastTextObjects1= [];
gdjs.GameCode.GDToastTextObjects2= [];


gdjs.GameCode.userFunc0x906d00 = function GDJSInlineCode(runtimeScene) {
"use strict";
// Movement simulation (src/sim.js) - shared with the Node level solver.
const PPSim = gdjs.__PPSim || (gdjs.__PPSim = (function () {
// ============================================================================
// Phantom Photon - core movement simulation (pure JS, no GDevelop dependency).
// The same code runs inside the game (JavaScript event) and in Node for the
// level solver / tests (src/solve.js). The body of this file is wrapped in an
// IIFE by build_project.py, so it ends with a `return`.
// ============================================================================
const T = 48;                    // tile size (world px)
const H = T / 2 - 0.5;           // collision half-size of the orb (a box ~1 tile)
const V0 = 260, VMAX = 960, ACC = 7000;   // launch speed, top speed (px/s), ease-in accel (px/s^2)
const PAD_V0 = 620;              // launch-pad kick starts faster
const G = 3.0e7;                 // black-hole gravity strength (px^3/s^2)
const G_RANGE = 3.6 * T;         // influence radius of a black hole
const KILL = 0.42 * T;           // swallow radius
const EXIT_R = 0.42 * T, SHARD_R = 0.6 * T;
const MAX_FLIGHT = 5;            // seconds; a flight that never lands is treated as lost
const DIRS = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
const OPP = { L: 'R', R: 'L', U: 'D', D: 'U' };
// Ramps: letter = which corner of the tile is solid. Back (flat) sides, and mirror line.
const RAMPS = { a: { solid: 'SE', back: 'RD', line: '/' }, b: { solid: 'SW', back: 'LD', line: '\\' },
                c: { solid: 'NW', back: 'LU', line: '/' }, d: { solid: 'NE', back: 'RU', line: '\\' } };

function parseLevel(def) {
  const rows = def.map.slice();
  const L = { w: rows[0].length, h: rows.length, cells: [], start: null, exit: null, shards: [], holes: [], pads: [], ramps: [] };
  for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) {
    const ch = rows[j][i] || '#';
    let t = '.';
    if (ch === '#') t = '#';
    else if (ch === 'P') { t = 'P'; L.pads.push([i, j]); }
    else if (RAMPS[ch]) { t = ch; L.ramps.push([i, j, ch]); }
    else if (ch === 'S') L.start = [i, j];
    else if (ch === 'E') L.exit = [i, j];
    else if (ch === '*') L.shards.push([i, j]);
    else if (ch === 'O') L.holes.push([i, j]);
    L.cells.push(t);
  }
  return L;
}
function cell(L, i, j) { return (i < 0 || j < 0 || i >= L.w || j >= L.h) ? '#' : L.cells[j * L.w + i]; }
const isFlat = (t) => t === '#' || t === 'P';
const center = (i) => i * T + T / 2;
const toCell = (x) => Math.floor(x / T);

// Does tile (i,j) present a flat, stickable face on `side` (the side facing the orb)?
function faceFrom(L, i, j, side) {
  const t = cell(L, i, j);
  if (isFlat(t)) return true;
  if (RAMPS[t]) return RAMPS[t].back.includes(side);
  return false;
}
// Walls the orb (stuck in cell i,j) is touching: list of directions from orb to wall.
function contacts(L, i, j) {
  const out = [];
  for (const d in DIRS) { const [dx, dy] = DIRS[d]; if (faceFrom(L, i + dx, j + dy, OPP[d])) out.push(d); }
  return out;
}
// Movement rule: a swipe in `d` is legal only if it is parallel to a wall the orb touches
// and the next tile in that direction is not a flat face.
function checkMove(L, i, j, d) {
  const c = contacts(L, i, j);
  const horiz = d === 'L' || d === 'R';
  const parallel = c.some((k) => horiz ? (k === 'U' || k === 'D') : (k === 'L' || k === 'R'));
  if (c.includes(d)) return { ok: false, why: 'into' };
  if (!parallel) return { ok: false, why: 'away' };
  return { ok: true };
}
// Launch pad: returns the direction away from a pad the orb touches (prefer `prefer` = side of last impact).
function padLaunchDir(L, i, j, prefer) {
  const ds = Object.keys(DIRS).filter((d) => { const [dx, dy] = DIRS[d]; return cell(L, i + dx, j + dy) === 'P'; });
  if (!ds.length) return null;
  const d = ds.includes(prefer) ? prefer : ds[0];
  return OPP[d];
}

// Is the orb box at (x,y) blocked by tile (i,j)? Ramps are only solid from their flat back sides.
function tileBlocks(L, i, j, x, y) {
  const t = cell(L, i, j);
  if (isFlat(t)) return true;
  if (!RAMPS[t]) return false;
  const x0 = i * T, y0 = j * T, x1 = x0 + T, y1 = y0 + T, back = RAMPS[t].back;
  if (x >= x1 && back.includes('R')) return true;
  if (x <= x0 && back.includes('L')) return true;
  if (y >= y1 && back.includes('D')) return true;
  if (y <= y0 && back.includes('U')) return true;
  return false;
}
function boxHit(L, x, y, refX, refY) {
  const i0 = toCell(x - H), i1 = toCell(x + H), j0 = toCell(y - H), j1 = toCell(y + H);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (tileBlocks(L, i, j, refX, refY)) return [i, j];
  return null;
}

function startFlight(st, d, kick) {
  const [dx, dy] = DIRS[d];
  st.mode = 'fly'; st.dir = d; st.t = 0; st.acc = 0;
  st.speed = kick ? PAD_V0 : V0; st.vx = dx * st.speed; st.vy = dy * st.speed;
  st.events = [];
}
function newState(L) {
  const [i, j] = L.start;
  return { mode: 'stuck', i, j, x: center(i), y: center(j), vx: 0, vy: 0, speed: 0, normal: null, lastStuck: [i, j],
           got: L.shards.map(() => false), events: [], t: 0 };
}

// Advance a flight by dt seconds (internally sub-stepped). Pushes events: shard, deflect, graze, stick, exit, swallow, lost.
function step(L, st, dt) {
  if (st.mode !== 'fly') return;
  // fixed 600 Hz sub-steps (remainder carried over) so the game and the Node solver give identical paths
  const h = 1 / 600;
  st.acc = (st.acc || 0) + dt;
  while (st.acc >= h - 1e-9 && st.mode === 'fly') {
    st.acc -= h; st.t += h;
    st.speed = Math.min(VMAX, st.speed + ACC * h);
    // black-hole gravity
    for (const [hi, hj] of L.holes) {
      const hx = center(hi), hy = center(hj), ddx = hx - st.x, ddy = hy - st.y, dist = Math.hypot(ddx, ddy);
      if (dist < KILL) { st.mode = 'dead'; st.hole = [hx, hy]; st.events.push({ type: 'swallow', x: hx, y: hy }); return; }
      if (dist < G_RANGE) {
        const fall = 1 - dist / G_RANGE;   // fades smoothly to 0 at the edge of the well
        const a = G / Math.max(dist * dist, T * T * 0.5) * fall;
        st.vx += a * ddx / dist * h; st.vy += a * ddy / dist * h;
      }
    }
    const vl = Math.hypot(st.vx, st.vy) || 1; st.vx *= st.speed / vl; st.vy *= st.speed / vl;  // gravity bends, doesn't brake
    // ramps: mirror when the orb's centre would cross the diagonal (checked before walls so the corner turn is clean)
    let nx = st.x + st.vx * h, ny = st.y + st.vy * h;
    const ci = toCell(nx), cj = toCell(ny), t = cell(L, ci, cj);
    if (RAMPS[t] && !tileBlocks(L, ci, cj, st.x, st.y)) {
      const u = (nx - ci * T) / T, v = (ny - cj * T) / T, R = RAMPS[t];
      let inSolid;
      if (R.line === '/') inSolid = R.solid === 'SE' ? u + v > 1 : u + v < 1;
      else inSolid = R.solid === 'SW' ? v > u : v < u;
      if (inSolid) {
        if (R.line === '/') { nx = ci * T + (1 - v) * T; ny = cj * T + (1 - u) * T; const vx = st.vx; st.vx = -st.vy; st.vy = -vx; }
        else { nx = ci * T + v * T; ny = cj * T + u * T; const vx = st.vx; st.vx = st.vy; st.vy = vx; }
        st.dir = Math.abs(st.vx) > Math.abs(st.vy) ? (st.vx > 0 ? 'R' : 'L') : (st.vy > 0 ? 'D' : 'U');
        st.events.push({ type: 'deflect', x: center(ci), y: center(cj), dir: st.dir });
      }
    }
    // move X, then Y (axis-separated box collision). Head-on hit = stick; grazing hit = slide along the wall.
    let hit = boxHit(L, nx, st.y, st.x, st.y);
    if (hit) {
      const sx = Math.sign(nx - st.x); nx = sx > 0 ? hit[0] * T - T / 2 : (hit[0] + 1) * T + T / 2;
      if (Math.abs(st.vx) >= 0.5 * st.speed) { st.x = nx; return stick(L, st, sx > 0 ? 'R' : 'L'); }
      st.vx = 0; st.events.push({ type: 'graze' });
    }
    st.x = nx;
    hit = boxHit(L, st.x, ny, st.x, st.y);
    if (hit) {
      const sy = Math.sign(ny - st.y); ny = sy > 0 ? hit[1] * T - T / 2 : (hit[1] + 1) * T + T / 2;
      if (Math.abs(st.vy) >= 0.5 * st.speed) { st.y = ny; return stick(L, st, sy > 0 ? 'D' : 'U'); }
      st.vy = 0; st.events.push({ type: 'graze' });
    }
    st.y = ny;
    if (st.vx === 0 && st.vy === 0) { return stick(L, st, null); }
    // pickups / exit
    L.shards.forEach(([si, sj], k) => {
      if (!st.got[k] && Math.hypot(center(si) - st.x, center(sj) - st.y) < SHARD_R) { st.got[k] = true; st.events.push({ type: 'shard', k, x: center(si), y: center(sj) }); }
    });
    if (L.exit && Math.hypot(center(L.exit[0]) - st.x, center(L.exit[1]) - st.y) < EXIT_R) {
      st.mode = 'exit'; st.events.push({ type: 'exit' }); return;
    }
    if (st.t > MAX_FLIGHT) { st.mode = 'dead'; st.hole = null; st.events.push({ type: 'lost' }); return; }
  }
}
// Land: snap to the nearest empty tile centre along the wall that still has a flat face on the impact side.
function stick(L, st, side) {
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
  const impactSpeed = st.speed;
  st.mode = 'stuck'; st.i = i; st.j = j; st.normal = side; st.vx = st.vy = 0; st.speed = 0; st.lastStuck = [i, j];
  st.events.push({ type: 'stick', side, i, j, x: center(i), y: center(j), fromX: st.x, fromY: st.y, impact: impactSpeed });
  st.x = center(i); st.y = center(j);
}
// Run a whole move instantly (used by the solver/tests). Returns the final state + events.
function simulate(L, st0, action) {
  const st = JSON.parse(JSON.stringify(st0)); st.events = [];
  if (st.mode !== 'stuck') return { ok: false, why: 'busy', st };
  if (action === 'TAP') {
    const d = padLaunchDir(L, st.i, st.j, st.normal);
    if (!d) return { ok: false, why: 'nopad', st };
    startFlight(st, d, true);
  } else {
    const c = checkMove(L, st.i, st.j, action);
    if (!c.ok) return { ok: false, why: c.why, st };
    startFlight(st, action, false);
  }
  const evs = [];
  while (st.mode === 'fly') { step(L, st, 1 / 60); evs.push(...st.events); st.events = []; }
  return { ok: true, st, events: evs };
}
return { T, H, V0, VMAX, ACC, G, G_RANGE, KILL, DIRS, OPP, RAMPS, parseLevel, cell, contacts, checkMove, padLaunchDir,
         startFlight, newState, step, simulate, center, faceFrom };

})());
// ============================================================================
// Phantom Photon - game logic (runs every frame from one JavaScript event).
// The movement rules live in PPSim (src/sim.js, embedded above by build_project.py).
// This file: input (swipe / tap / keys), level loading, camera fit, and all the juice
// (trail, squash, sparks, shake, portal, black holes, pads, title, level clear).
// ============================================================================
const SIM = PPSim;
const game = runtimeScene.getGame();
const im = game.getInputManager();
const T = SIM.T;
const rdt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
const LEVELS = [{"name": "First Light", "hint": "Swipe along a wall to slide. Past the edge you keep flying until you hit the next wall.", "map": ["###########", "#.........#", "#....E...*#", "#.........#", "##........#", "#..*..##..#", "#.........#", "#.........#", "#.........#", "#S...*....#", "###########"]}, {"name": "Angles", "hint": "Violet ramps mirror your flight 90 degrees. You can't stick to their slanted side.", "map": ["###########", "#..S.....d#", "#.........#", "#....#....#", "#...#E#...#", "#.........#", "#.........#", "#.........#", "#.........#", "#b.*.a...*#", "###########"]}, {"name": "Kick", "hint": "Pink launch pads: TAP (or Space) to kick straight off them, away from the wall.", "map": ["###########", "#...*.#...#", "#.........#", "#....E....#", "#.........#", "#.........#", "#.........#", "#.........#", "#....S...*#", "#####P#####", "###########"]}, {"name": "Event Horizon", "hint": "Black holes bend your flight - get too close and you're swallowed. You're safe while stuck to a wall.", "map": ["###########", "#S....#...#", "#.......*.#", "##......E.#", "#....*....#", "#....O....#", "#.........#", "#........##", "#.........#", "#...#.....#", "###########"]}, {"name": "Phantom Run", "hint": "Everything at once: ramps, a pad and a black hole. Follow the shards - and use the hole's pull.", "map": ["###########", "##.......##", "#........##", "#.........#", "#.......a.#", "#.O..##...#", "#.........#", "#...*.....#", "#.#...E.*.P", "#.#.......#", "#.S.*.....#", "###########"]}];
const ART = {"levelArtSize": [[608, 608], [608, 608], [608, 608], [608, 608], [608, 656]], "margin": 40, "tile": 48, "ss": 2};
const ADD = 1;
const DIRV = SIM.DIRS;

let G = runtimeScene.__pp;
let st = null, L = null;
// ------------------------------------------------------------------ helpers
const mk = (name, layer, x, y, z, blend) => {
  const o = runtimeScene.createObject(name); if (!o) return null;
  o.setLayer(layer || ''); o.setPosition(x || 0, y || 0); if (z !== undefined) o.setZOrder(z);
  if (blend && o.setBlendMode) o.setBlendMode(ADD);
  return o;
};
const del = (o) => { if (o) o.deleteFromScene(runtimeScene); };
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const cc = (i) => i * T + T / 2;

if (!G) {
  G = runtimeScene.__pp = {
    level: 0, state: 'title', touches: {}, parts: [], motes: [], dyn: [], shake: 0, sx: 0, sy: 0, flash: 0,
    buffered: null, bufferT: 0, titleT: 0, clearT: 0, dieT: 0, bump: null, squash: 0, squashV: 0, squashAxis: 'x',
    vis: { x: 0, y: 0 }, trailAcc: 0, lastTrail: null, time: 0, moves: 0, deaths: 0, log: [], lastRes: [0, 0],
    stats: { shards: 0 }, firstMove: false, padHintShown: false,
  };
  // static UI objects
  G.ui = {
    titleA: mk('TitlePhantom', 'UI', 0, 0, 50), titleB: mk('TitlePhoton', 'UI', 0, 0, 50),
    start: mk('StartText', 'UI', 0, 0, 51), level: mk('LevelText', 'UI', 0, 0, 40), shards: mk('ShardText', 'UI', 0, 0, 40),
    hint: mk('HintText', 'UI', 0, 0, 40), restart: mk('BtnRestart', 'UI', 0, 0, 40, true), clear: mk('TxtClear', 'UI', 0, 0, 60, true),
    flash: mk('Flash', 'UI', 0, 0, 90), dim: mk('Flash', 'UI', 0, 0, 30), toast: mk('ToastText', 'UI', 0, 0, 45), shardIcon: mk('ShardIcon', 'UI', 0, 0, 41, true),
  };
  G.ui.flash.setOpacity(0); G.ui.dim.setColor('2;3;10'); G.ui.clear.setOpacity(0); G.ui.toast.setOpacity(0);
  for (const k of ['titleA', 'titleB']) G.ui[k].setBlendMode(ADD);
  // background
  G.bg = mk('BgTile', 'Bg', -2112, -2112, 0); G.bg.setWidth(4992); G.bg.setHeight(4992);
  G.neb = mk('Nebula', 'Bg', 0, 0, 1, true);
  for (let k = 0; k < 46; k++) {
    const o = mk('Mote', 'Bg', 0, 0, 2, true);
    G.motes.push({ o, x: rand(-100, 700), y: rand(-100, 700), vx: rand(-6, 6), vy: rand(-10, -2), ph: rand(0, 6.28), s: rand(0.25, 0.8) });
  }
  // orb
  G.halo = mk('OrbHalo', '', 0, 0, 30, true); G.orb = mk('Orb', '', 0, 0, 32, true);
  // remove editor-preview instances placed in the scene for level 1 (the game rebuilds levels itself)
  for (const n of ['LevelArt', 'PortalCore', 'PortalRing', 'PortalRing2', 'Shard', 'PadGlow', 'BhDisk', 'BhCore', 'BhGlow', 'BhSwirl', 'BhRange', 'PreviewOrb'])
    for (const o of runtimeScene.getObjects(n).slice()) if (!o.__pp) del(o);
  G.loadLevel = (n) => loadLevel(n);
  const qs = (typeof location !== 'undefined') ? new URLSearchParams(location.search) : null;
  G.startLevel = qs && qs.get('level') ? Math.max(0, Math.min(LEVELS.length - 1, (+qs.get('level')) - 1)) : 0;
  G.skipTitle = !!(qs && qs.has('notitle'));
  loadLevel(G.startLevel);
  if (G.skipTitle) G.state = 'play';
  window.__pp = G; window.__PPSim = SIM; window.__ppScene = runtimeScene;
}

function tag(o) { if (o) o.__pp = true; return o; }
function loadLevel(n) {
  for (const o of G.dyn) del(o); G.dyn = [];
  for (const p of G.parts) del(p.o); G.parts = [];
  G.level = n; const def = LEVELS[n]; L = SIM.parseLevel(def); G.L = L; G.def = def;
  G.st = SIM.newState(L); st = G.st;
  G.W = L.w * T; G.H = L.h * T;
  const add = (name, x, y, z, blend) => { const o = tag(mk(name, '', x, y, z, blend)); G.dyn.push(o); return o; };
  const art = add('LevelArt', G.W / 2, G.H / 2, 1); art.setAnimationName('L' + (n + 1)); art.setScale(0.5);
  G.portal = L.exit ? { core: add('PortalCore', cc(L.exit[0]), cc(L.exit[1]), 5, true), r1: add('PortalRing', cc(L.exit[0]), cc(L.exit[1]), 6, true),
                        r2: add('PortalRing2', cc(L.exit[0]), cc(L.exit[1]), 6, true) } : null;
  G.shards = L.shards.map(([i, j], k) => ({ o: add('Shard', cc(i), cc(j), 8, true), i, j, k, got: false }));
  G.pads = L.pads.map(([i, j]) => {
    // the pad's face points toward its open neighbour
    let face = 'U'; for (const d of ['U', 'D', 'L', 'R']) { const [dx, dy] = DIRV[d]; if (SIM.cell(L, i + dx, j + dy) === '.' ) { face = d; break; } }
    const [dx, dy] = DIRV[face], ang = { U: 0, R: 90, D: 180, L: 270 }[face];
    const g = add('PadGlow', cc(i) + dx * T / 2, cc(j) + dy * T / 2, 3, true); g.setAngle(ang); g.setScale(0.5);
    const ch = add('PadChevron', cc(i) + dx * T, cc(j) + dy * T, 3, true); ch.setAngle(ang); ch.setScale(0.5);
    return { i, j, face, g, ch, dx, dy, ang, boost: 0 };
  });
  G.holes = L.holes.map(([i, j]) => ({ x: cc(i), y: cc(j), range: add('BhRange', cc(i), cc(j), 2, true), swirl: add('BhSwirl', cc(i), cc(j), 3, true),
                                        glow: add('BhGlow', cc(i), cc(j), 4, true), disk: add('BhDisk', cc(i), cc(j), 9), core: add('BhCore', cc(i), cc(j), 10), pulse: 0 }));
  for (const h of G.holes) { for (const k of ['range', 'swirl', 'glow', 'disk', 'core']) h[k].setScale(0.5); h.disk.setBlendMode(ADD); }
  G.vis.x = G.st.x; G.vis.y = G.st.y; G.orbScale = 0; G.spawnT = 0; G.squash = 0; G.squashV = 0;
  G.buffered = null; G.bump = null; G.clearT = 0; G.dieT = 0; G.moves = 0;
  G.ui.level.setString((n + 1) + ' / ' + LEVELS.length + '   ' + def.name.toUpperCase());
  G.ui.hint.setString(def.hint || ''); G.hintA = 1;
  G.log.push('load ' + (n + 1));
  for (const m of G.motes) { m.x = rand(-80, G.W + 80); m.y = rand(-80, G.H + 80); }
  ring(G.st.x, G.st.y, 0.5, [140, 240, 255]);
}

// ------------------------------------------------------------------ particles
function part(name, x, y, o) {
  const ob = mk(name, '', x, y, o.z || 20, true); if (!ob) return;
  if (o.color) ob.setColor(o.color);
  const p = Object.assign({ o: ob, x, y, vx: 0, vy: 0, life: 0.5, t: 0, s0: 0.5, s1: 0, a0: 255, drag: 3, sink: null }, o);
  ob.setScale(p.s0); G.parts.push(p); return p;
}
function sparks(x, y, nx, ny, n, color, spd) {
  for (let k = 0; k < n; k++) {
    const base = (nx || ny) ? Math.atan2(ny, nx) : rand(0, 6.28), a = base + rand(-1.35, 1.35) * ((nx || ny) ? 1 : 3), v = rand(0.3, 1) * (spd || 420);
    part('Spark', x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.25, 0.55), s0: rand(0.35, 0.7), s1: 0, drag: 5, color });
  }
}
function ring(x, y, size, rgb) { part('Ring', x, y, { life: 0.38, s0: 0.03, s1: size * 0.42, drag: 0, color: rgb ? rgb.join(';') : null, z: 19 }); }
function updateParts(dt) {
  for (let k = G.parts.length - 1; k >= 0; k--) {
    const p = G.parts[k]; p.t += dt; const u = p.t / p.life;
    if (u >= 1) { del(p.o); G.parts.splice(k, 1); continue; }
    if (p.sink) { // pulled toward a point (black-hole implode)
      const dx = p.sink[0] - p.x, dy = p.sink[1] - p.y; p.vx += dx * 30 * dt - dy * 12 * dt; p.vy += dy * 30 * dt + dx * 12 * dt;
    }
    p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt); p.x += p.vx * dt; p.y += p.vy * dt;
    p.o.setPosition(p.x, p.y); p.o.setScale(Math.max(0.001, lerp(p.s0, p.s1, p.lin ? u : ease(u)))); p.o.setOpacity(p.a0 * (1 - u * u));
  }
}

// ------------------------------------------------------------------ input
const K = { L: [37, 65, 3037], R: [39, 68, 3039], U: [38, 87, 3038], D: [40, 83, 3040], TAP: [32, 13, 3013], RESTART: [82] };
const pressed = (arr) => arr.some((c) => im.wasKeyJustPressed(c));
const actions = [];
for (const a of ['L', 'R', 'U', 'D', 'TAP']) if (pressed(K[a])) actions.push({ a, src: 'key' });
if (pressed(K.RESTART)) actions.push({ a: 'RESTART', src: 'key' });
// swipes: measured in CSS pixels so they feel the same on every screen
const cssW = (typeof window !== 'undefined' ? window.innerWidth : 800) || 800;
const gpx = game.getGameResolutionWidth() / cssW;            // game px per CSS px
const SWIPE_MIN = 22 * gpx, TAP_MAX = 14 * gpx;
for (const id of im.getStartedTouchIdentifiers()) G.touches[id] = { x0: im.getTouchX(id), y0: im.getTouchY(id), t0: G.time, used: false };
for (const id of im.getAllTouchIdentifiers()) {
  const t = G.touches[id]; if (!t) continue;
  const dx = im.getTouchX(id) - t.x0, dy = im.getTouchY(id) - t.y0, ad = Math.max(Math.abs(dx), Math.abs(dy));
  if (!t.used && ad >= SWIPE_MIN) {             // fire as soon as the finger has travelled far enough (dominant axis)
    t.used = true; actions.push({ a: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'), src: 'swipe' });
  }
  if (im.hasTouchEnded(id)) {
    if (!t.used && ad < TAP_MAX && G.time - t.t0 < 0.4) {
      // tap: restart button or launch-pad kick
      const ui = runtimeScene.getLayer('UI'); const p = ui.convertCoords(t.x0, t.y0, 0);
      const b = G.ui.restart; const bx = b.getCenterXInScene(), by = b.getCenterYInScene();
      actions.push({ a: Math.hypot(p[0] - bx, p[1] - by) < 44 ? 'RESTART' : 'TAP', src: 'tap' });
    }
    delete G.touches[id];
  }
}
for (const id in G.touches) if (!im.getAllTouchIdentifiers().includes(+id)) delete G.touches[id];

G.time += rdt;
st = G.st; L = G.L;
// ------------------------------------------------------------------ actions
function tryAction(a, src) {
  if (a === 'RESTART') { G.log.push('restart'); G.deaths = 0; loadLevel(G.level); G.state = 'play'; return; }
  if (G.state === 'title') { G.state = 'play'; G.titleT = 0; if (src === 'tap') return; }
  if (G.state === 'end') { if (a === 'TAP') { G.state = 'play'; loadLevel(0); } return; }
  if (G.state !== 'play') return;
  if (st.mode === 'fly') { G.buffered = a; G.bufferT = 0.22; return; }    // input buffering while flying
  if (st.mode !== 'stuck') return;
  if (a === 'TAP') {
    const d = SIM.padLaunchDir(L, st.i, st.j, st.normal);
    if (!d) { G.bump = { d: null, t: 0, why: 'nopad' }; G.log.push('tap-nopad'); return; }
    SIM.startFlight(st, d, true); G.moves++; G.log.push('kick ' + d);
    const [dx, dy] = DIRV[d]; sparks(st.x - dx * T / 2, st.y - dy * T / 2, dx, dy, 16, '255;80;210', 520); ring(st.x - dx * T / 2, st.y - dy * T / 2, 0.7, [255, 80, 210]);
    G.shake = Math.max(G.shake, 5); for (const p of G.pads) if (Math.abs(p.i - st.i) + Math.abs(p.j - st.j) <= 1) p.boost = 1;
    onLaunch(); return;
  }
  const c = SIM.checkMove(L, st.i, st.j, a);
  if (!c.ok) { G.bump = { d: a, t: 0, why: c.why }; G.log.push('reject ' + a + ' ' + c.why); if (c.why === 'into') G.shake = Math.max(G.shake, 1.5); return; }
  SIM.startFlight(st, a, false); G.moves++; G.log.push('move ' + a); onLaunch();
}
function onLaunch() { G.firstMove = true; G.lastTrail = [st.x, st.y]; G.squash = -0.35; G.squashV = 0; }
for (const ac of actions) tryAction(ac.a, ac.src);
if (G.bufferT > 0) G.bufferT -= rdt;

// ------------------------------------------------------------------ simulation + events
if (st.mode === 'fly' && (G.state === 'play')) {
  SIM.step(L, st, rdt);
  for (const e of st.events) handleEvent(e);
  st.events = [];
  if (st.mode === 'stuck' && G.buffered && G.bufferT > 0) { const b = G.buffered; G.buffered = null; tryAction(b, 'buffer'); }
}
function handleEvent(e) {
  if (e.type === 'stick') {
    const [dx, dy] = e.side ? DIRV[e.side] : [0, 0];
    const k = Math.min(1, e.impact / SIM.VMAX);
    const wx = e.fromX + dx * T / 2, wy = e.fromY + dy * T / 2;
    sparks(wx, wy, -dx, -dy, Math.round(8 + 10 * k), null, 200 + 300 * k); ring(wx, wy, 0.35 + 0.35 * k, [120, 230, 255]);
    G.shake = Math.max(G.shake, 2 + 4.5 * k); G.squash = 1 * k + 0.2; G.squashV = 0; G.squashAxis = (dx !== 0) ? 'x' : 'y';
    G.impactDir = [dx, dy]; G.log.push('stick ' + e.i + ',' + e.j);
    if (e.side) { const [px, py] = [e.i + dx, e.j + dy]; if (SIM.cell(L, px, py) === 'P') { for (const p of G.pads) if (p.i === px && p.j === py) p.boost = 1; showToast('TAP TO LAUNCH', 1.6, '255;120;220'); } }
  } else if (e.type === 'deflect') {
    sparks(e.x, e.y, 0, 0, 10, '190;120;255', 260); ring(e.x, e.y, 0.45, [190, 120, 255]); G.shake = Math.max(G.shake, 2);
    G.squash = 0.5; G.squashAxis = (e.dir === 'L' || e.dir === 'R') ? 'y' : 'x'; G.log.push('deflect ' + e.dir);
  } else if (e.type === 'graze') {
    if (!G.lastGraze || G.time - G.lastGraze > 0.15) { sparks(st.x, st.y, 0, 0, 4, null, 120); G.lastGraze = G.time; }
  } else if (e.type === 'shard') {
    const s = G.shards[e.k]; s.got = true; G.stats.shards++;
    sparks(e.x, e.y, 0, 0, 16, '255;215;90', 300); ring(e.x, e.y, 0.6, [255, 215, 90]); G.log.push('shard ' + e.k);
  } else if (e.type === 'exit') {
    G.state = 'clear'; G.clearT = 0; G.log.push('exit'); G.exitFrom = [st.x, st.y];
  } else if (e.type === 'swallow' || e.type === 'lost') {
    G.state = 'dying'; G.dieT = 0; G.deaths++; G.dieFrom = [st.x, st.y]; G.dieHole = e.type === 'swallow' ? [e.x, e.y] : null;
    G.log.push(e.type); G.shake = Math.max(G.shake, 6);
    if (G.dieHole) for (let k = 0; k < 26; k++) { const a = rand(0, 6.28), r = rand(30, 90);
      part('Spark', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, { life: 0.6, s0: rand(0.3, 0.6), s1: 0, drag: 2, sink: [e.x, e.y], color: '255;150;120' }); }
  }
}
function showToast(text, dur, color) { G.ui.toast.setString(text); if (color) G.ui.toast.setColor(color); G.toastT = dur; }

// ------------------------------------------------------------------ state animations
if (G.state === 'clear') {
  G.clearT += rdt; const t = G.clearT, P = L.exit;
  const px = cc(P[0]), py = cc(P[1]);
  G.vis.x = lerp(G.vis.x, px, 1 - Math.pow(0.0001, rdt)); G.vis.y = lerp(G.vis.y, py, 1 - Math.pow(0.0001, rdt));
  G.orbScale = Math.max(0, 1 - t / 0.35);
  if (t - rdt < 0.3 && t >= 0.3) { G.flash = 1; sparks(px, py, 0, 0, 30, '120;255;170', 520); ring(px, py, 1.4, [120, 255, 170]); G.shake = 6; G.clearShown = true; }
  if (t > 1.6) {
    if (G.level + 1 < LEVELS.length) { loadLevel(G.level + 1); G.state = 'play'; G.flash = 0.8; }
    else { G.state = 'end'; G.flash = 0.8; }
  }
} else if (G.state === 'dying') {
  G.dieT += rdt; const t = G.dieT;
  if (G.dieHole) {   // spiral into the hole
    const [hx, hy] = G.dieHole, a0 = Math.atan2(G.dieFrom[1] - hy, G.dieFrom[0] - hx), r0 = Math.hypot(G.dieFrom[0] - hx, G.dieFrom[1] - hy);
    const u = Math.min(1, t / 0.55), r = r0 * (1 - ease(u)), a = a0 + u * 7;
    G.vis.x = hx + Math.cos(a) * r; G.vis.y = hy + Math.sin(a) * r; G.orbScale = Math.max(0, 1 - u);
    for (const h of G.holes) if (h.x === hx && h.y === hy) h.pulse = Math.max(h.pulse, u < 1 ? 0.3 : 0);
    if (t - rdt < 0.55 && t >= 0.55) { G.flash = 0.45; for (const h of G.holes) if (h.x === hx && h.y === hy) h.pulse = 1; ring(hx, hy, 1.2, [255, 110, 150]); G.shake = 7; showToast('SWALLOWED', 1.2, '255;120;160'); }
  } else { G.orbScale = Math.max(0, 1 - t / 0.3); }
  if (t > 1.05) {    // respawn at the last spot the orb was stuck to
    const [i, j] = st.lastStuck; Object.assign(st, { mode: 'stuck', i, j, x: cc(i), y: cc(j), vx: 0, vy: 0, speed: 0, events: [] });
    G.vis.x = st.x; G.vis.y = st.y; G.orbScale = 0; G.spawnT = 0; G.state = 'play'; ring(st.x, st.y, 0.6, [140, 240, 255]); G.log.push('respawn ' + i + ',' + j);
  }
}

// ------------------------------------------------------------------ orb visuals
if (G.state === 'play' || G.state === 'title' || G.state === 'end') {
  if (G.orbScale < 1) { G.spawnT += rdt; G.orbScale = Math.min(1, ease(G.spawnT / 0.35) * 1.0); }
  if (st.mode === 'fly') { G.vis.x = st.x; G.vis.y = st.y; }
  else {
    // hug the wall(s) it is stuck to, ease from the impact point to the snapped tile centre
    let hx = 0, hy = 0; for (const d of SIM.contacts(L, st.i, st.j)) { hx += DIRV[d][0]; hy += DIRV[d][1]; }
    const hug = 7, tx = st.x + Math.sign(hx) * hug, ty = st.y + Math.sign(hy) * hug, k = 1 - Math.pow(0.000002, rdt);
    G.vis.x = lerp(G.vis.x, tx, k); G.vis.y = lerp(G.vis.y, ty, k);
  }
}
// squash spring
G.squashV += (-G.squash * 520 - G.squashV * 22) * rdt; G.squash += G.squashV * rdt;
let ox = 0, oy = 0;
if (G.bump) {     // illegal move: little wiggle (toward the swipe for "into", sideways shiver for "away")
  G.bump.t += rdt; const u = G.bump.t / 0.32, amp = 5 * (1 - u) * Math.sin(u * Math.PI * 5);
  if (G.bump.d) { const [dx, dy] = DIRV[G.bump.d]; if (G.bump.why === 'into') { ox = dx * Math.abs(amp); oy = dy * Math.abs(amp); } else { ox = dx * amp * 0.8; oy = dy * amp * 0.8; } }
  else { G.squash = Math.max(G.squash, 0.15 * (1 - u)); }
  if (u >= 1) G.bump = null;
}
const orb = G.orb, halo = G.halo, sp = st.mode === 'fly' ? st.speed / SIM.VMAX : 0;
const pulse = 1 + 0.06 * Math.sin(G.time * 3.2);
let sxs = 0.5 * G.orbScale * pulse, sys = sxs, ang = 0;
if (st.mode === 'fly' && G.state === 'play') { ang = Math.atan2(st.vy, st.vx) * 180 / Math.PI; sxs *= 1 + 0.45 * sp; sys *= 1 - 0.22 * sp; }
else { const q = G.squash; if (G.squashAxis === 'x') { sxs *= 1 - 0.42 * q; sys *= 1 + 0.3 * q; } else { sxs *= 1 + 0.3 * q; sys *= 1 - 0.42 * q; } }
orb.setPosition(G.vis.x + ox, G.vis.y + oy); orb.setAngle(ang); orb.setScaleX(Math.max(0.001, sxs)); orb.setScaleY(Math.max(0.001, sys));
orb.setColor(G.bump ? '255;170;190' : '255;255;255');
halo.setPosition(G.vis.x + ox, G.vis.y + oy); halo.setScale(Math.max(0.001, 0.5 * G.orbScale * (1 + 0.1 * Math.sin(G.time * 2.1) + 0.25 * sp)));
halo.setOpacity(200 + 55 * sp);
// light trail
if (st.mode === 'fly' && G.state === 'play') {
  const [lx, ly] = G.lastTrail || [st.x, st.y]; const dist = Math.hypot(st.x - lx, st.y - ly), stepD = 3.5;
  for (let s = stepD; s <= dist; s += stepD) {
    const u = s / dist, x = lerp(lx, st.x, u), y = lerp(ly, st.y, u);
    const tp = part('Trail', x, y, { life: 0.42, s0: 0.62, s1: 0.04, drag: 0, a0: 200, z: 25, color: '150;225;255' }); if (tp) tp.lin = true;
    G.trailN = (G.trailN || 0) + 1;
    if (G.trailN % 4 === 0) { const t2 = part('OrbHalo', x, y, { life: 0.5, s0: 0.16, s1: 0.02, drag: 0, a0: 90, z: 24 }); if (t2) t2.lin = true; }
  }
  if (dist >= stepD) G.lastTrail = [st.x, st.y];
} else if (G.state === 'play' && Math.random() < rdt * 3) {
  part('Spark', G.vis.x + rand(-8, 8), G.vis.y + rand(-8, 8), { vx: rand(-15, 15), vy: rand(-35, -10), life: 0.9, s0: 0.25, s1: 0, drag: 0.5, a0: 160 });
}
updateParts(rdt);

// ------------------------------------------------------------------ world objects animation
if (G.portal) {
  const p = G.portal, s = 0.5 * (1 + 0.08 * Math.sin(G.time * 4)) * (G.state === 'clear' ? 1 + 0.6 * ease(G.clearT / 0.3) : 1);
  p.core.setScale(s); p.r1.setScale(0.5 * (1 + 0.04 * Math.sin(G.time * 2))); p.r2.setScale(0.5);
  p.r1.setAngle(G.time * 60); p.r2.setAngle(-G.time * 110);
}
for (const s of G.shards) {
  if (s.got) { if (s.o.getOpacity() > 0) { s.o.setOpacity(Math.max(0, s.o.getOpacity() - rdt * 900)); s.o.setScale(s.o.getScaleX() + rdt * 2); } continue; }
  s.o.setPosition(cc(s.i), cc(s.j) + Math.sin(G.time * 2.5 + s.k) * 3); s.o.setScale(0.5 * (1 + 0.1 * Math.sin(G.time * 5 + s.k)));
}
for (const p of G.pads) {
  p.boost = Math.max(0, p.boost - rdt * 1.5);
  const onIt = st.mode === 'stuck' && st.i === p.i + p.dx && st.j === p.j + p.dy;
  p.g.setOpacity(Math.min(255, 150 + 90 * Math.sin(G.time * 5) + (onIt ? 60 : 0) + 120 * p.boost)); p.g.setScaleX(0.5 * (1 + 0.6 * p.boost));
  const u = (G.time * 0.9) % 1; p.ch.setPosition(cc(p.i) + p.dx * (T * 0.55 + u * 26), cc(p.j) + p.dy * (T * 0.55 + u * 26));
  p.ch.setOpacity((onIt ? 255 : 150) * Math.sin(u * Math.PI));
}
for (const h of G.holes) {
  h.pulse = Math.max(0, h.pulse - rdt * 1.6);
  h.disk.setAngle(G.time * 140); h.swirl.setAngle(G.time * 40); h.range.setAngle(-G.time * 6);
  h.disk.setScale(0.5 * (1 + 0.05 * Math.sin(G.time * 6) + 0.4 * h.pulse)); h.core.setScale(0.5 * (1 + 0.3 * h.pulse));
  h.glow.setScale(0.5 * (1 + 0.15 * Math.sin(G.time * 1.7) + 0.6 * h.pulse));
  h.range.setOpacity(st.mode === 'fly' ? 255 : 130 + 40 * Math.sin(G.time * 2));
}
// ambient motes (pulled into black holes)
for (const m of G.motes) {
  m.ph += rdt; m.x += m.vx * rdt; m.y += m.vy * rdt;
  for (const h of G.holes) { const dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1;
    if (d < 180) { m.x += (dx / d * 40 - dy / d * 60) * rdt * (1 - d / 180); m.y += (dy / d * 40 + dx / d * 60) * rdt * (1 - d / 180); }
    if (d < 14) { m.x = rand(-80, G.W + 80); m.y = G.H + 60; } }
  if (m.y < -100) { m.y = G.H + 80; m.x = rand(-80, G.W + 80); }
  if (m.x < -120) m.x = G.W + 100; if (m.x > G.W + 120) m.x = -100;
  m.o.setPosition(m.x, m.y); m.o.setScale(m.s * 0.5); m.o.setOpacity(70 + 70 * Math.sin(m.ph * 1.3));
}

// ------------------------------------------------------------------ resolution + camera fit (portrait & landscape)
if (typeof window !== 'undefined') {
  const cw = window.innerWidth || 800, ch = window.innerHeight || 600, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let h = Math.round(Math.min(ch * dpr, Math.sqrt(2.2e6 * ch / cw))); h = Math.max(480, h);
  const key = cw + 'x' + ch + ':' + h;
  if (key !== G.resKey) { G.resKey = key; game.setGameResolutionSize(Math.round(h * cw / ch), h); }
}
const rw = game.getGameResolutionWidth(), rh = game.getGameResolutionHeight();
const uiS = Math.min(rw, rh) / 720;
const hudTop = 120 * uiS, hudBot = 90 * uiS;          // keep the level clear of the HUD
const zoom = Math.min((rw - 24 * uiS) / (G.W + 16), (rh - hudTop - hudBot) / (G.H + 16));
G.shake *= Math.exp(-9 * rdt); if (G.shake < 0.05) G.shake = 0;
const shx = (Math.random() * 2 - 1) * G.shake, shy = (Math.random() * 2 - 1) * G.shake;
const camX = G.W / 2 + shx, camY = G.H / 2 - (hudTop - hudBot) / 2 / zoom + shy;
for (const ln of ['', 'Bg']) { const l = runtimeScene.getLayer(ln); l.setCameraZoom(zoom); l.setCameraX(camX); l.setCameraY(camY); }
G.zoom = zoom;
G.neb.setPosition(G.W / 2, G.H / 2); G.neb.setScale(Math.max(G.W, G.H) / 512 * 1.5);
// black-hole lensing on the background grid (BulgePinch effect on the Bg layer)
const bgL = runtimeScene.getLayer('Bg');
if (G.holes.length) {
  const h = G.holes[0], sx = (h.x - camX) * zoom + rw / 2, sy = (h.y - camY) * zoom + rh / 2;
  bgL.enableEffect('Lens', true);
  bgL.setEffectDoubleParameter('Lens', 'centerX', sx / rw); bgL.setEffectDoubleParameter('Lens', 'centerY', sy / rh);
  bgL.setEffectDoubleParameter('Lens', 'radius', 150 * zoom); bgL.setEffectDoubleParameter('Lens', 'strength', -0.55 - 0.3 * h.pulse);
} else bgL.enableEffect('Lens', false);

// ------------------------------------------------------------------ UI layout
const ui = runtimeScene.getLayer('UI'); ui.setCameraZoom(uiS); ui.setCameraX(rw / 2 / uiS); ui.setCameraY(rh / 2 / uiS);
const UW = rw / uiS, UH = rh / uiS;
G.ui.flash.setPosition(-10, -10); G.ui.flash.setWidth(UW + 20); G.ui.flash.setHeight(UH + 20);
G.ui.dim.setPosition(-10, -10); G.ui.dim.setWidth(UW + 20); G.ui.dim.setHeight(UH + 20); G.ui.dim.setOpacity(((G.state === 'title' || G.state === 'end') ? 170 : 0) * (1 - (G.state === 'end' ? 0 : G.titleT || 0)));
G.flash = Math.max(0, G.flash - rdt * 2.2); G.ui.flash.setOpacity(255 * G.flash * G.flash);
// title: big card at start, then shrinks to a tiny neon logo at the top
const titleTarget = (G.state === 'title') ? 0 : 1; G.titleT = lerp(G.titleT || 0, titleTarget, 1 - Math.pow(0.002, rdt));
const tt = G.titleT, bigS = Math.min(0.62, (UW - 40) / 980), smallS = 0.17;
const tS = lerp(bigS, smallS, tt), tY = lerp(UH * 0.36, 26, tt);
const tA = G.ui.titleA, tB = G.ui.titleB;
tA.setScale(tS); tB.setScale(tS);
const gap = 6 * tS / 0.62;
tA.setPosition(UW / 2 - tA.getWidth() / 2 - (tt > 0.5 ? tB.getWidth() / 2 * 0 : 0), tY - tA.getHeight() + gap * 8);
tB.setPosition(UW / 2 - tB.getWidth() / 2, tY + gap * 2);
if (tt > 0.02) { // side by side when small
  const w = tA.getWidth() + tB.getWidth() - 40 * tS;
  const ax = lerp(UW / 2 - tA.getWidth() / 2, UW / 2 - w / 2, tt), bx = lerp(UW / 2 - tB.getWidth() / 2, UW / 2 - w / 2 + tA.getWidth() - 40 * tS, tt);
  const ay = lerp(tY - tA.getHeight() + gap * 8, tY - tA.getHeight() / 2, tt), by = lerp(tY + gap * 2, tY - tB.getHeight() / 2, tt);
  tA.setPosition(ax, ay); tB.setPosition(bx, by);
}
const flick = 0.9 + 0.1 * Math.sin(G.time * 23) * Math.sin(G.time * 7.3);
tA.setOpacity(255 * flick); tB.setOpacity(255 * (0.92 + 0.08 * Math.sin(G.time * 17)));
G.ui.start.setString(G.state === 'end' ? 'ALL LEVELS CLEAR  -  ' + G.stats.shards + ' SHARDS\nTAP / SPACE TO PLAY AGAIN' : 'SWIPE TO PLAY\nARROWS / WASD  -  SPACE TO LAUNCH');
const showStart = G.state === 'title' || G.state === 'end';
G.ui.start.setOpacity(showStart ? 160 + 95 * Math.sin(G.time * 4) : 0);
G.ui.start.setPosition(UW / 2 - G.ui.start.getWidth() / 2, G.state === 'end' ? UH * 0.42 : tB.getY() + tB.getHeight() + 10);
if (G.state === 'end') { tA.setOpacity(0); tB.setOpacity(0); }
const hudA = G.state === 'title' ? 0 : 255;
G.ui.level.setOpacity(hudA); G.ui.level.setPosition(UW / 2 - G.ui.level.getWidth() / 2, 52);
const got = G.shards.filter((s) => s.got).length;
G.ui.shards.setString(G.shards.length ? (got + ' / ' + G.shards.length) : ''); G.ui.shards.setOpacity(hudA);
G.ui.shards.setPosition(UW / 2 - G.ui.shards.getWidth() / 2 + 12, 82);
G.ui.shardIcon.setScale(0.3); G.ui.shardIcon.setPosition(UW / 2 - G.ui.shards.getWidth() / 2 - 8, 82 + G.ui.shards.getHeight() / 2); G.ui.shardIcon.setOpacity(G.shards.length ? hudA : 0);
G.ui.restart.setScale(0.34); G.ui.restart.setPosition(UW - 44, 44); G.ui.restart.setOpacity(G.state === 'title' ? 0 : 200);
G.hintA = (G.firstMove && G.moves >= 2) ? Math.max(0.35, G.hintA - rdt * 0.5) : 1;
G.ui.hint.setWrapping(true); G.ui.hint.setWrappingWidth(Math.min(UW - 40, 620));
G.ui.hint.setOpacity((G.state === 'title' ? 0 : 230) * G.hintA); G.ui.hint.setPosition(UW / 2 - G.ui.hint.getWidth() / 2, UH - 30 - G.ui.hint.getHeight());
const cl = G.ui.clear; const ct = G.state === 'clear' ? G.clearT - 0.3 : -1;
cl.setScale(0.5 * (ct > 0 ? 1 + 0.25 * (1 - ease(ct / 0.4)) : 1) * Math.min(1, (UW - 40) / 620)); cl.setOpacity(ct > 0 ? 255 * Math.min(1, ct * 5) * (ct > 1.0 ? Math.max(0, 1 - (ct - 1.0) * 4) : 1) : 0);
cl.setPosition(UW / 2 - cl.getWidth() / 2, UH * 0.42 - cl.getHeight() / 2);
G.toastT = Math.max(0, (G.toastT || 0) - rdt);
G.ui.toast.setOpacity(255 * Math.min(1, G.toastT * 3)); G.ui.toast.setPosition(UW / 2 - G.ui.toast.getWidth() / 2, UH - 92 - G.ui.hint.getHeight());

};
gdjs.GameCode.eventsList0 = function(runtimeScene) {

{


gdjs.GameCode.userFunc0x906d00(runtimeScene);

}


};gdjs.GameCode.eventsList1 = function(runtimeScene) {

{


gdjs.GameCode.eventsList0(runtimeScene);
}


};

gdjs.GameCode.func = function(runtimeScene) {
runtimeScene.getOnceTriggers().startNewFrame();

gdjs.GameCode.GDBgTileObjects1.length = 0;
gdjs.GameCode.GDBgTileObjects2.length = 0;
gdjs.GameCode.GDNebulaObjects1.length = 0;
gdjs.GameCode.GDNebulaObjects2.length = 0;
gdjs.GameCode.GDMoteObjects1.length = 0;
gdjs.GameCode.GDMoteObjects2.length = 0;
gdjs.GameCode.GDLevelArtObjects1.length = 0;
gdjs.GameCode.GDLevelArtObjects2.length = 0;
gdjs.GameCode.GDPadGlowObjects1.length = 0;
gdjs.GameCode.GDPadGlowObjects2.length = 0;
gdjs.GameCode.GDPadChevronObjects1.length = 0;
gdjs.GameCode.GDPadChevronObjects2.length = 0;
gdjs.GameCode.GDPortalCoreObjects1.length = 0;
gdjs.GameCode.GDPortalCoreObjects2.length = 0;
gdjs.GameCode.GDPortalRingObjects1.length = 0;
gdjs.GameCode.GDPortalRingObjects2.length = 0;
gdjs.GameCode.GDPortalRing2Objects1.length = 0;
gdjs.GameCode.GDPortalRing2Objects2.length = 0;
gdjs.GameCode.GDShardObjects1.length = 0;
gdjs.GameCode.GDShardObjects2.length = 0;
gdjs.GameCode.GDShardIconObjects1.length = 0;
gdjs.GameCode.GDShardIconObjects2.length = 0;
gdjs.GameCode.GDBhRangeObjects1.length = 0;
gdjs.GameCode.GDBhRangeObjects2.length = 0;
gdjs.GameCode.GDBhSwirlObjects1.length = 0;
gdjs.GameCode.GDBhSwirlObjects2.length = 0;
gdjs.GameCode.GDBhGlowObjects1.length = 0;
gdjs.GameCode.GDBhGlowObjects2.length = 0;
gdjs.GameCode.GDBhDiskObjects1.length = 0;
gdjs.GameCode.GDBhDiskObjects2.length = 0;
gdjs.GameCode.GDBhCoreObjects1.length = 0;
gdjs.GameCode.GDBhCoreObjects2.length = 0;
gdjs.GameCode.GDTrailObjects1.length = 0;
gdjs.GameCode.GDTrailObjects2.length = 0;
gdjs.GameCode.GDSparkObjects1.length = 0;
gdjs.GameCode.GDSparkObjects2.length = 0;
gdjs.GameCode.GDRingObjects1.length = 0;
gdjs.GameCode.GDRingObjects2.length = 0;
gdjs.GameCode.GDOrbHaloObjects1.length = 0;
gdjs.GameCode.GDOrbHaloObjects2.length = 0;
gdjs.GameCode.GDOrbObjects1.length = 0;
gdjs.GameCode.GDOrbObjects2.length = 0;
gdjs.GameCode.GDPreviewOrbObjects1.length = 0;
gdjs.GameCode.GDPreviewOrbObjects2.length = 0;
gdjs.GameCode.GDTitlePhantomObjects1.length = 0;
gdjs.GameCode.GDTitlePhantomObjects2.length = 0;
gdjs.GameCode.GDTitlePhotonObjects1.length = 0;
gdjs.GameCode.GDTitlePhotonObjects2.length = 0;
gdjs.GameCode.GDTxtClearObjects1.length = 0;
gdjs.GameCode.GDTxtClearObjects2.length = 0;
gdjs.GameCode.GDBtnRestartObjects1.length = 0;
gdjs.GameCode.GDBtnRestartObjects2.length = 0;
gdjs.GameCode.GDFlashObjects1.length = 0;
gdjs.GameCode.GDFlashObjects2.length = 0;
gdjs.GameCode.GDLevelTextObjects1.length = 0;
gdjs.GameCode.GDLevelTextObjects2.length = 0;
gdjs.GameCode.GDShardTextObjects1.length = 0;
gdjs.GameCode.GDShardTextObjects2.length = 0;
gdjs.GameCode.GDHintTextObjects1.length = 0;
gdjs.GameCode.GDHintTextObjects2.length = 0;
gdjs.GameCode.GDStartTextObjects1.length = 0;
gdjs.GameCode.GDStartTextObjects2.length = 0;
gdjs.GameCode.GDToastTextObjects1.length = 0;
gdjs.GameCode.GDToastTextObjects2.length = 0;

gdjs.GameCode.eventsList1(runtimeScene);
gdjs.GameCode.GDBgTileObjects1.length = 0;
gdjs.GameCode.GDBgTileObjects2.length = 0;
gdjs.GameCode.GDNebulaObjects1.length = 0;
gdjs.GameCode.GDNebulaObjects2.length = 0;
gdjs.GameCode.GDMoteObjects1.length = 0;
gdjs.GameCode.GDMoteObjects2.length = 0;
gdjs.GameCode.GDLevelArtObjects1.length = 0;
gdjs.GameCode.GDLevelArtObjects2.length = 0;
gdjs.GameCode.GDPadGlowObjects1.length = 0;
gdjs.GameCode.GDPadGlowObjects2.length = 0;
gdjs.GameCode.GDPadChevronObjects1.length = 0;
gdjs.GameCode.GDPadChevronObjects2.length = 0;
gdjs.GameCode.GDPortalCoreObjects1.length = 0;
gdjs.GameCode.GDPortalCoreObjects2.length = 0;
gdjs.GameCode.GDPortalRingObjects1.length = 0;
gdjs.GameCode.GDPortalRingObjects2.length = 0;
gdjs.GameCode.GDPortalRing2Objects1.length = 0;
gdjs.GameCode.GDPortalRing2Objects2.length = 0;
gdjs.GameCode.GDShardObjects1.length = 0;
gdjs.GameCode.GDShardObjects2.length = 0;
gdjs.GameCode.GDShardIconObjects1.length = 0;
gdjs.GameCode.GDShardIconObjects2.length = 0;
gdjs.GameCode.GDBhRangeObjects1.length = 0;
gdjs.GameCode.GDBhRangeObjects2.length = 0;
gdjs.GameCode.GDBhSwirlObjects1.length = 0;
gdjs.GameCode.GDBhSwirlObjects2.length = 0;
gdjs.GameCode.GDBhGlowObjects1.length = 0;
gdjs.GameCode.GDBhGlowObjects2.length = 0;
gdjs.GameCode.GDBhDiskObjects1.length = 0;
gdjs.GameCode.GDBhDiskObjects2.length = 0;
gdjs.GameCode.GDBhCoreObjects1.length = 0;
gdjs.GameCode.GDBhCoreObjects2.length = 0;
gdjs.GameCode.GDTrailObjects1.length = 0;
gdjs.GameCode.GDTrailObjects2.length = 0;
gdjs.GameCode.GDSparkObjects1.length = 0;
gdjs.GameCode.GDSparkObjects2.length = 0;
gdjs.GameCode.GDRingObjects1.length = 0;
gdjs.GameCode.GDRingObjects2.length = 0;
gdjs.GameCode.GDOrbHaloObjects1.length = 0;
gdjs.GameCode.GDOrbHaloObjects2.length = 0;
gdjs.GameCode.GDOrbObjects1.length = 0;
gdjs.GameCode.GDOrbObjects2.length = 0;
gdjs.GameCode.GDPreviewOrbObjects1.length = 0;
gdjs.GameCode.GDPreviewOrbObjects2.length = 0;
gdjs.GameCode.GDTitlePhantomObjects1.length = 0;
gdjs.GameCode.GDTitlePhantomObjects2.length = 0;
gdjs.GameCode.GDTitlePhotonObjects1.length = 0;
gdjs.GameCode.GDTitlePhotonObjects2.length = 0;
gdjs.GameCode.GDTxtClearObjects1.length = 0;
gdjs.GameCode.GDTxtClearObjects2.length = 0;
gdjs.GameCode.GDBtnRestartObjects1.length = 0;
gdjs.GameCode.GDBtnRestartObjects2.length = 0;
gdjs.GameCode.GDFlashObjects1.length = 0;
gdjs.GameCode.GDFlashObjects2.length = 0;
gdjs.GameCode.GDLevelTextObjects1.length = 0;
gdjs.GameCode.GDLevelTextObjects2.length = 0;
gdjs.GameCode.GDShardTextObjects1.length = 0;
gdjs.GameCode.GDShardTextObjects2.length = 0;
gdjs.GameCode.GDHintTextObjects1.length = 0;
gdjs.GameCode.GDHintTextObjects2.length = 0;
gdjs.GameCode.GDStartTextObjects1.length = 0;
gdjs.GameCode.GDStartTextObjects2.length = 0;
gdjs.GameCode.GDToastTextObjects1.length = 0;
gdjs.GameCode.GDToastTextObjects2.length = 0;


return;

}

gdjs['GameCode'] = gdjs.GameCode;
