// ============================================================================
// Phantom Photon - GAME scene logic (runs every frame from one JavaScript event).
// Movement rules: PPSim (src/sim.js, shared with the solver). Shared UI/progress: LIB (src/lib.js).
// This file: input (swipe / tap / keys), level loading, camera fit, juice (trail, squash, sparks,
// shake, portal, black holes, pads, mirrors, stars, moving platforms), the Abyss darkness
// (lighting layer, lingering trail light, discovered-wall memory, gas clouds that occlude light),
// HUD (back / restart) and the level-clear panel (NEXT / LEVELS) + progress saving.
// ============================================================================
const SIM = PPSim;
const C = LIB.ctx(runtimeScene); C.frame();
const game = runtimeScene.getGame();
const im = game.getInputManager();
const T = SIM.T;
const rdt = C.rdt;
const ART = LIB.ART;
const ADD = 1;
const DIRV = SIM.DIRS;
const MAXPARTS = 380;
const { rand, lerp, ease, clamp } = LIB;
const cc = (i) => i * T + T / 2;
const mk = (name, layer, x, y, z, blend) => C.mk(name, layer, x, y, z, blend);
const del = (o) => C.del(o);

let G = runtimeScene.__pp;
let st = null, L = null;
if (!G) {
  G = runtimeScene.__pp = {
    level: 0, chapter: 0, state: 'play', touches: {}, parts: [], motes: [], dyn: [], lights: [], flashes: [], trailL: [], memL: [],
    shake: 0, flash: 0, buffered: null, bufferT: 0, clearT: 0, dieT: 0, bump: null, squash: 0, squashV: 0, squashAxis: 'x',
    vis: { x: 0, y: 0 }, trailAcc: 0, lastTrail: null, time: 0, moves: 0, deaths: 0, log: [], stats: { shards: 0 }, firstMove: false, hintA: 1,
  };
  G.ui = {
    level: mk('LevelText', 'UI', 0, 0, 40), shards: mk('ShardText', 'UI', 0, 0, 40), hint: mk('HintText', 'UI', 0, 0, 40),
    clear: mk('TxtClear', 'UI', 0, 0, 160, true), dim: mk('Flash', 'UI', 0, 0, 140), flash: mk('Flash', 'UI', 0, 0, 190),
    toast: mk('ToastText', 'UI', 0, 0, 45), shardIcon: mk('ShardIcon', 'UI', 0, 0, 41, true),
    panel: mk('Card', 'UI', 0, 0, 150), pShards: mk('ShardText', 'UI', 0, 0, 160), pIcon: mk('ShardIcon', 'UI', 0, 0, 160, true), pSub: mk('SubText', 'UI', 0, 0, 160),
  };
  G.ui.flash.setOpacity(0); G.ui.dim.setColor('2;3;10'); G.ui.dim.setOpacity(0); G.ui.clear.setOpacity(0); G.ui.toast.setOpacity(0);
  G.ui.panel.setOpacity(0); G.ui.panel.setColor('120;255;170');
  // HUD buttons (juicy, same system as the menu)
  G.btnBack = C.button({ kind: 'round', icon: 'IcBack', color: '120;240;255', delay: 0.15, name: 'back', pool: false, noFocus: true, onPress: () => toSelect() });
  G.btnRestart = C.button({ kind: 'round', icon: 'IcRestart', color: '120;240;255', delay: 0.2, name: 'restart', pool: false, noFocus: true, onPress: () => { if (G.state === 'play' || G.state === 'dying') restart(); } });
  G.btnBack.scale = G.btnRestart.scale = 0.72;
  G.btnNext = C.button({ kind: 'big', label: 'NEXT', color: '120;255;170', name: 'nextLevel', pool: false, reflect: false, z: 170, onPress: () => goNext() });
  G.btnLevels = C.button({ kind: 'small', label: 'LEVELS', color: '120;240;255', name: 'levels', pool: false, z: 170, onPress: () => toSelect() });
  G.btnNext.visible = G.btnLevels.visible = false;
  C.buttonNav = false; C.modalKeys = true;
  // background
  C.bg(46); G.bg = C.bgT; G.neb = C.neb; G.motes = C.motes;
  // orb
  G.halo = mk('OrbHalo', '', 0, 0, 30, true); G.orb = mk('Orb', '', 0, 0, 32, true);
  for (const n of ['LevelArt', 'PortalCore', 'PortalRing', 'PortalRing2', 'Shard', 'PadGlow', 'BhDisk', 'BhCore', 'BhGlow', 'BhSwirl', 'BhRange', 'PreviewOrb'])
    for (const o of runtimeScene.getObjects(n).slice()) if (!o.__pp) del(o);
  G.loadLevel = (c, n) => loadLevel(c, n);
  loadLevel(LIB.nav.chapter || 0, LIB.nav.level || 0);
  window.__pp = G; window.__PPSim = SIM; window.__ppScene = runtimeScene; window.__ppC = C; window.__PPLib = LIB;
}

function tag(o) { if (o) o.__pp = true; return o; }
function inCloud(x, y, pad) {
  pad = pad || 0;
  for (const c of G.clouds || []) if (x > c.x0 - pad && x < c.x1 + pad && y > c.y0 - pad && y < c.y1 + pad) return c;
  return null;
}
function light(x, y, radius, color, z) {
  const o = mk('Light', 'Light', x, y, z || 1); if (!o) return null;
  o.setRadius(radius); o.setColor(color); G.lights.push(o); return o;
}
function delLight(o) { const k = G.lights.indexOf(o); if (k >= 0) G.lights.splice(k, 1); del(o); }
function loadLevel(c, n) {
  for (const o of G.dyn) del(o); G.dyn = [];
  for (const p of G.parts) del(p.o); G.parts = [];
  for (const o of G.lights) del(o); G.lights = []; G.flashes = []; G.trailL = []; G.memL = [];
  G.chapter = c; G.level = n; LIB.nav.chapter = c; LIB.nav.level = n;
  const CHP = LIB.CHAPTERS[c], def = CHP.levels[n]; L = SIM.parseLevel(def); G.L = L; G.def = def;
  G.dark = !!CHP.dark;
  G.st = SIM.newState(L); st = G.st;
  G.W = L.w * T; G.H = L.h * T;
  const gi = LIB.globalIndex(c, n);
  const add = (name, x, y, z, blend, layer) => { const o = tag(mk(name, layer || '', x, y, z, blend)); G.dyn.push(o); return o; };
  const art = add('LevelArt', G.W / 2, G.H / 2, 1); art.setAnimationName('L' + (gi + 1)); art.setScale(0.5);
  // lighting (The Abyss): dark ambient, everything lit by lights on the "Light" layer
  const LL = runtimeScene.getLayer('Light'), HL = runtimeScene.getLayer('Hint');
  LL.show(G.dark); HL.show(true);
  if (G.dark) LL.setClearColor(2, 2, 6);
  G.portal = L.exit ? { core: add('PortalCore', cc(L.exit[0]), cc(L.exit[1]), 5, true), r1: add('PortalRing', cc(L.exit[0]), cc(L.exit[1]), 6, true),
                        r2: add('PortalRing2', cc(L.exit[0]), cc(L.exit[1]), 6, true) } : null;
  if (G.portal && G.dark) {
    G.portal.light = light(cc(L.exit[0]), cc(L.exit[1]), 150, '60;200;110');
    G.portal.hint = add('PortalRing', cc(L.exit[0]), cc(L.exit[1]), 5, true, 'Hint'); G.portal.hint.setOpacity(55);   // faint marker above the dark
  }
  G.shards = L.shards.map(([i, j], k) => ({ o: add('Shard', cc(i), cc(j), 8, true), i, j, k, got: false, light: G.dark ? light(cc(i), cc(j), 46, '110;90;30') : null }));
  G.pads = L.pads.map(([i, j]) => {
    let face = 'U'; for (const d of ['U', 'D', 'L', 'R']) { const [dx, dy] = DIRV[d]; if (SIM.cell(L, i + dx, j + dy) === '.') { face = d; break; } }
    const [dx, dy] = DIRV[face], ang = { U: 0, R: 90, D: 180, L: 270 }[face];
    const g = add('PadGlow', cc(i) + dx * T / 2, cc(j) + dy * T / 2, 3, true); g.setAngle(ang); g.setScale(0.5);
    const ch = add('PadChevron', cc(i) + dx * T, cc(j) + dy * T, 3, true); ch.setAngle(ang); ch.setScale(0.5);
    if (G.dark) light(cc(i) + dx * T / 2, cc(j) + dy * T / 2, 70, '110;30;90');
    return { i, j, face, g, ch, dx, dy, ang, boost: 0 };
  });
  G.holes = L.holes.map(([i, j]) => ({ x: cc(i), y: cc(j), range: add('BhRange', cc(i), cc(j), 2, true), swirl: add('BhSwirl', cc(i), cc(j), 3, true),
                                        glow: add('BhGlow', cc(i), cc(j), 4, true), disk: add('BhDisk', cc(i), cc(j), 9), core: add('BhCore', cc(i), cc(j), 10), pulse: 0,
                                        light: G.dark ? light(cc(i), cc(j), 120, '120;40;70') : null }));
  for (const h of G.holes) { for (const k of ['range', 'swirl', 'glow', 'disk', 'core']) h[k].setScale(0.5); h.disk.setBlendMode(ADD); }
  G.stars = (L.stars || []).map(([i, j], k) => ({ x: cc(i), y: cc(j), k, glow: add('StarGlow', cc(i), cc(j), 3, true), corona: add('StarCorona', cc(i), cc(j), 4, true),
    corona2: add('StarCorona', cc(i), cc(j), 4, true), core: add('StarCore', cc(i), cc(j), 11, true), light: G.dark ? light(cc(i), cc(j), 230, '255;150;70') : null, flare: 0 }));
  G.movers = L.movers.map((m, k) => {
    const o = add('Mover', 0, 0, 7, true); o.setAnimationName('M' + m.w + 'x' + m.h); o.setScale(0.5);
    const r0 = SIM.moverRect(L, m, 0);
    const dots = []; const len = m.range * T, n0 = Math.max(2, Math.round(len / 14));
    for (let q = 0; q <= n0; q++) {
      const u = q / n0, x = (r0.x0 + r0.x1) / 2 + (m.axis === 'x' ? u * len : 0), y = (r0.y0 + r0.y1) / 2 + (m.axis === 'y' ? u * len : 0);
      const d = add('TrackDot', x, y, 2, true, G.dark ? 'Hint' : ''); d.setScale(0.5); d.setOpacity(G.dark ? 70 : 110); dots.push(d);
    }
    return { m, k, o, light: G.dark ? light(0, 0, 80, '25;80;65') : null, dots, flare: 0 };
  });
  G.clouds = (def.clouds || []).map((cl, k) => {
    const x0 = cl.i * T, y0 = cl.j * T, x1 = x0 + cl.w * T, y1 = y0 + cl.h * T, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const key = G.cloudKey = (G.cloudKey || 0);
    const idx = ART.cloudIndex[gi + ':' + k];
    const vis = add('Cloud', cx, cy, 20, false, 'Hint'); vis.setAnimationName('C' + idx); vis.setOpacity(200);
    const sz = ART.clouds[idx]; vis.setScaleX(1); vis.setScaleY(1);
    const block = add('CloudBlock', x0, y0, 0, false); block.setScaleX(cl.w * T / 8); block.setScaleY(cl.h * T / 8); block.setOpacity(0);
    const puffs = []; for (let q = 0; q < Math.min(6, cl.w * cl.h); q++) { const p = add('CloudPuff', cx, cy, 21, false, 'Hint'); puffs.push({ o: p, ph: rand(0, 6.28), r: rand(0.2, 0.42), sp: rand(0.15, 0.35) * (Math.random() < 0.5 ? -1 : 1) }); }
    return { x0, y0, x1, y1, cx, cy, vis, block, puffs, w: x1 - x0, h: y1 - y0 };
  });
  if (G.dark) {
    G.orbLight = light(st.x, st.y, 170, '210;235;255', 5);
    G.memory = [];
  } else { G.orbLight = null; }
  G.vis.x = G.st.x; G.vis.y = G.st.y; G.orbScale = 0; G.spawnT = 0; G.squash = 0; G.squashV = 0;
  G.buffered = null; G.bump = null; G.clearT = 0; G.dieT = 0; G.moves = 0; G.state = 'play'; G.deaths = 0; G.saved = false;
  G.ui.level.setString((c + 1) + '-' + (n + 1) + '   ' + def.name.toUpperCase());
  G.ui.hint.setString(def.hint || ''); G.hintA = 1;
  G.btnNext.visible = G.btnLevels.visible = false;
  G.log.push('load ' + (c + 1) + '-' + (n + 1));
  for (const m of G.motes) { m.x = rand(-80, G.W + 80); m.y = rand(-80, G.H + 80); }
  ring(G.st.x, G.st.y, 0.5, [140, 240, 255]);
  remember(st.x, st.y, true);
}
function restart() { G.log.push('restart'); loadLevel(G.chapter, G.level); G.flash = 0.25; }
function toSelect() { if (C.trans) return; LIB.nav.from = 'game'; G.log.push('to-select'); C.go('LevelSelect', 'fade', { dur: 0.45 }); }
function nextOf(c, n) {
  const CH = LIB.CHAPTERS;
  if (n + 1 < CH[c].levels.length) return [c, n + 1];
  if (c + 1 < CH.length && LIB.chapterUnlocked(c + 1)) return [c + 1, 0];
  return null;
}
function goNext() {
  const nx = nextOf(G.chapter, G.level); if (!nx) { toSelect(); return; }
  G.log.push('next ' + (nx[0] + 1) + '-' + (nx[1] + 1));
  loadLevel(nx[0], nx[1]); G.flash = 0.9; C.shake = 4;
}

// ------------------------------------------------------------------ particles (capped)
function part(name, x, y, o) {
  if (G.parts.length >= MAXPARTS) { const old = G.parts.shift(); del(old.o); }
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
    if (p.sink) { const dx = p.sink[0] - p.x, dy = p.sink[1] - p.y; p.vx += dx * 30 * dt - dy * 12 * dt; p.vy += dy * 30 * dt + dx * 12 * dt; }
    p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt); p.x += p.vx * dt; p.y += p.vy * dt;
    p.o.setPosition(p.x, p.y); p.o.setScale(Math.max(0.001, lerp(p.s0, p.s1, p.lin ? u : ease(u)))); p.o.setOpacity(p.a0 * (1 - u * u) * (p.cloudDim || 1));
  }
}
// ------------------------------------------------------------------ the dark: lights that linger and walls you remember
function flashLight(x, y, radius, color, life) {
  if (!G.dark) return;
  if (G.flashes.length >= 6) { const f = G.flashes.shift(); delLight(f.o); }
  const o = light(x, y, radius, color); if (o) G.flashes.push({ o, t: 0, life, radius, rgb: color.split(';').map(Number) });
}
function trailLight(x, y) {
  if (!G.dark || inCloud(x, y)) return;
  if (G.trailL.length >= 22) { const f = G.trailL.shift(); delLight(f.o); }
  const o = light(x, y, 78, '70;120;170'); if (o) G.trailL.push({ o, t: 0, life: 2.4 });
}
function remember(x, y, force) {
  if (!G.dark || inCloud(x, y)) return;
  for (const m of G.memL) if (Math.hypot(m.x - x, m.y - y) < (force ? 30 : 70)) return;
  if (G.memL.length >= 60) { const f = G.memL.shift(); delLight(f.o); }
  const o = light(x, y, 92, '0;0;0'); if (o) G.memL.push({ o, x, y, t: 0 });
}
function updateLights(dt) {
  if (!G.dark) return;
  for (let k = G.flashes.length - 1; k >= 0; k--) {
    const f = G.flashes[k]; f.t += dt; const u = f.t / f.life;
    if (u >= 1) { delLight(f.o); G.flashes.splice(k, 1); continue; }
    const a = 1 - u * u; f.o.setColor(f.rgb.map((v) => Math.round(v * a)).join(';')); f.o.setRadius(f.radius * (0.7 + 0.3 * ease(u * 3)));
  }
  for (let k = G.trailL.length - 1; k >= 0; k--) {
    const f = G.trailL[k]; f.t += dt; const u = f.t / f.life;
    if (u >= 1) { delLight(f.o); G.trailL.splice(k, 1); continue; }
    const a = Math.pow(1 - u, 1.6); f.o.setColor(Math.round(70 * a) + ';' + Math.round(120 * a) + ';' + Math.round(170 * a)); f.o.setRadius(60 + 30 * a);
  }
  for (const m of G.memL) { m.t = Math.min(1, m.t + dt * 0.6); const a = m.t; m.o.setColor(Math.round(24 * a) + ';' + Math.round(32 * a) + ';' + Math.round(52 * a)); }
}

// ------------------------------------------------------------------ input
const K = { L: [37, 65], R: [39, 68], U: [38, 87], D: [40, 83], TAP: [32, 13], RESTART: [82], BACK: [27, 8] };
const pressed = (arr) => arr.some((c) => im.wasKeyJustPressed(c));
const actions = [];
for (const a of ['L', 'R', 'U', 'D', 'TAP']) if (pressed(K[a])) actions.push({ a, src: 'key' });
if (pressed(K.RESTART)) actions.push({ a: 'RESTART', src: 'key' });
if (pressed(K.BACK)) actions.push({ a: 'BACK', src: 'key' });
const cssW = (typeof window !== 'undefined' ? window.innerWidth : 800) || 800;
const gpx = game.getGameResolutionWidth() / cssW;
const SWIPE_MIN = 22 * gpx, TAP_MAX = 14 * gpx;
const onButton = (cx, cy) => { const p = C.toUI(cx, cy); return C.buttons.some((b) => b.visible && C.hit(b, p[0], p[1])); };
for (const id of im.getStartedTouchIdentifiers()) G.touches[id] = { x0: im.getTouchX(id), y0: im.getTouchY(id), t0: G.time, used: false, btn: onButton(im.getTouchX(id), im.getTouchY(id)) };
for (const id of im.getAllTouchIdentifiers()) {
  const t = G.touches[id]; if (!t) continue;
  const dx = im.getTouchX(id) - t.x0, dy = im.getTouchY(id) - t.y0, ad = Math.max(Math.abs(dx), Math.abs(dy));
  if (!t.used && ad >= SWIPE_MIN) { t.used = true; actions.push({ a: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'), src: 'swipe' }); }
  if (im.hasTouchEnded(id)) {
    if (!t.used && !t.btn && ad < TAP_MAX && G.time - t.t0 < 0.4) actions.push({ a: 'TAP', src: 'tap' });
    delete G.touches[id];
  }
}
for (const id in G.touches) if (!im.getAllTouchIdentifiers().includes(+id)) delete G.touches[id];
// mouse drag = swipe on desktop (touch is handled above)
if (!im.getAllTouchIdentifiers().length) {
  const P = C.ptr;
  if (P.pressed) G.mdrag = { x0: P.x, y0: P.y, used: false, btn: C.buttons.some((b) => b.visible && C.hit(b, P.x, P.y)) };
  if (G.mdrag && P.down && !G.mdrag.used && !G.mdrag.btn) {
    const dx = P.x - G.mdrag.x0, dy = P.y - G.mdrag.y0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 26) { G.mdrag.used = true; actions.push({ a: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'), src: 'mouse' }); }
  }
  if (P.released && G.mdrag) { if (!G.mdrag.used && !G.mdrag.btn && P.moved < 8 && !C.isTouch) actions.push({ a: 'TAP', src: 'click' }); G.mdrag = null; }
}

G.time += rdt;
st = G.st; L = G.L;
// ------------------------------------------------------------------ actions
function tryAction(a, src) {
  if (a === 'BACK') { if (G.state === 'clear') toSelect(); else toSelect(); return; }
  if (G.state === 'clear') return;    // the clear panel's buttons take over
  if (a === 'RESTART') { restart(); return; }
  if (G.state !== 'play') return;
  if (st.mode === 'fly') { G.buffered = a; G.bufferT = 0.22; return; }
  if (st.mode !== 'stuck') return;
  if (a === 'TAP') {
    const d = SIM.padLaunchDir(L, st);
    if (!d) { G.bump = { d: null, t: 0, why: 'nopad' }; G.log.push('tap-nopad'); return; }
    SIM.startFlight(st, d, true, L); G.moves++; G.log.push('kick ' + d);
    const [dx, dy] = DIRV[d]; sparks(st.x - dx * T / 2, st.y - dy * T / 2, dx, dy, 16, '255;80;210', 520); ring(st.x - dx * T / 2, st.y - dy * T / 2, 0.7, [255, 80, 210]);
    G.shake = Math.max(G.shake, 5); for (const p of G.pads) if (Math.abs(p.i - st.i) + Math.abs(p.j - st.j) <= 1) p.boost = 1;
    flashLight(st.x, st.y, 140, '200;60;170', 0.6);
    onLaunch(); return;
  }
  const c = SIM.checkMove(L, st, a);
  if (!c.ok) { G.bump = { d: a, t: 0, why: c.why }; G.log.push('reject ' + a + ' ' + c.why); if (c.why === 'into') G.shake = Math.max(G.shake, 1.5); return; }
  const wasRiding = !!st.ride;
  SIM.startFlight(st, a, false, L); G.moves++; G.log.push('move ' + a + (wasRiding ? ' (from platform)' : '')); onLaunch();
  if (wasRiding) { for (const mv of G.movers) mv.flare = 1; }
}
function onLaunch() { G.firstMove = true; G.lastTrail = [st.x, st.y]; G.squash = -0.35; G.squashV = 0; G.lastMem = [st.x, st.y]; }
for (const ac of actions) tryAction(ac.a, ac.src);
if (G.bufferT > 0) G.bufferT -= rdt;

// ------------------------------------------------------------------ simulation (every frame: platforms keep moving while you're stuck)
if (G.state === 'play') {
  SIM.step(L, st, rdt);
  for (const e of st.events) handleEvent(e);
  st.events = [];
  if (st.mode === 'stuck' && G.buffered && G.bufferT > 0) { const b = G.buffered; G.buffered = null; tryAction(b, 'buffer'); }
} else { st.time = (st.time || 0) + rdt; }
function handleEvent(e) {
  if (e.type === 'stick') {
    const [dx, dy] = e.side ? DIRV[e.side] : [0, 0];
    const k = Math.min(1, e.impact / SIM.VMAX);
    const wx = e.fromX + dx * T / 2, wy = e.fromY + dy * T / 2;
    const col = e.mover >= 0 ? '120;255;210' : null;
    sparks(wx, wy, -dx, -dy, Math.round(8 + 10 * k), col, 200 + 300 * k); ring(wx, wy, 0.35 + 0.35 * k, e.mover >= 0 ? [120, 255, 210] : [120, 230, 255]);
    G.shake = Math.max(G.shake, 2 + 4.5 * k); G.squash = 1 * k + 0.2; G.squashV = 0; G.squashAxis = (dx !== 0) ? 'x' : 'y';
    G.impactDir = [dx, dy]; G.log.push('stick ' + e.i + ',' + e.j + (e.mover >= 0 ? ' ride' + e.mover : ''));
    if (e.mover >= 0) { G.movers[e.mover].flare = 1; showToast('RIDING', 0.9, '120;255;210'); }
    flashLight(wx, wy, 120 + 60 * k, '90;150;200', 0.5);
    remember(e.x, e.y, true);
    if (e.side && !(e.mover >= 0)) { const [px, py] = [e.i + dx, e.j + dy]; if (SIM.cell(L, px, py) === 'P') { for (const p of G.pads) if (p.i === px && p.j === py) p.boost = 1; showToast('TAP TO LAUNCH', 1.6, '255;120;220'); } }
  } else if (e.type === 'deflect') {
    sparks(e.x, e.y, 0, 0, 10, '190;120;255', 260); ring(e.x, e.y, 0.45, [190, 120, 255]); G.shake = Math.max(G.shake, 2);
    G.squash = 0.5; G.squashAxis = (e.dir === 'L' || e.dir === 'R') ? 'y' : 'x'; G.log.push('deflect ' + e.dir);
    flashLight(e.x, e.y, 130, '120;70;200', 0.6);
  } else if (e.type === 'mirror') {
    const x = e.x !== undefined ? e.x : st.x, y = e.y !== undefined ? e.y : st.y;
    sparks(x, y, 0, 0, 14, '230;250;255', 340); ring(x, y, 0.7, [230, 250, 255]); G.shake = Math.max(G.shake, 2.5);
    G.squash = 0.7; G.squashAxis = (e.dir === 'L' || e.dir === 'R') ? 'x' : 'y'; G.log.push('mirror ' + (e.dir || ''));
    flashLight(x, y, 250, '200;235;255', 0.75);    // mirrors briefly light up the area
    remember(x, y, true);
  } else if (e.type === 'graze') {
    if (!G.lastGraze || G.time - G.lastGraze > 0.15) { sparks(st.x, st.y, 0, 0, 4, null, 120); G.lastGraze = G.time; }
  } else if (e.type === 'shard') {
    const s = G.shards[e.k]; s.got = true; G.stats.shards++;
    sparks(e.x, e.y, 0, 0, 16, '255;215;90', 300); ring(e.x, e.y, 0.6, [255, 215, 90]); G.log.push('shard ' + e.k);
    if (s.light) { delLight(s.light); s.light = null; } flashLight(e.x, e.y, 120, '255;200;90', 0.6);
  } else if (e.type === 'exit') {
    G.state = 'clear'; G.clearT = 0; G.log.push('exit'); G.exitFrom = [st.x, st.y];
    const got = G.shards.filter((s) => s.got).length;
    LIB.complete(G.chapter, G.level, got, G.shards.length, G.moves); G.saved = true;
    G.log.push('saved ' + LIB.id(G.chapter, G.level) + ' ' + got + '/' + G.shards.length);
  } else if (e.type === 'swallow' || e.type === 'lost' || e.type === 'burn' || e.type === 'crush') {
    G.state = 'dying'; G.dieT = 0; G.deaths++; G.dieFrom = [st.x, st.y]; G.dieHole = e.type === 'swallow' ? [e.x, e.y] : null; G.dieType = e.type;
    G.log.push(e.type); G.shake = Math.max(G.shake, 6);
    if (G.dieHole) for (let k = 0; k < 26; k++) { const a = rand(0, 6.28), r = rand(30, 90);
      part('Spark', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, { life: 0.6, s0: rand(0.3, 0.6), s1: 0, drag: 2, sink: [e.x, e.y], color: '255;150;120' }); }
    if (e.type === 'burn') {
      for (let k = 0; k < 34; k++) { const a = rand(0, 6.28), v = rand(80, 420);
        part('Spark', st.x, st.y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(0.4, 0.9), s0: rand(0.4, 0.9), s1: 0, drag: 2.5, color: Math.random() < 0.5 ? '255;170;60' : '255;90;40' }); }
      ring(st.x, st.y, 1.1, [255, 150, 60]); G.flash = 0.35; flashLight(st.x, st.y, 260, '255;140;60', 0.9);
      for (const s of G.stars) if (Math.hypot(s.x - st.x, s.y - st.y) < T * 2) s.flare = 1;
      showToast('BURNED UP', 1.2, '255;160;80');
    }
    if (e.type === 'crush') { sparks(st.x, st.y, 0, 0, 24, '120;255;210', 380); ring(st.x, st.y, 0.9, [120, 255, 210]); showToast('CRUSHED', 1.2, '120;255;210'); }
    if (e.type === 'lost') showToast('LOST IN THE VOID', 1.2, '150;180;255');
  }
}
function showToast(text, dur, color) { G.ui.toast.setString(text); if (color) G.ui.toast.setColor(color); G.toastT = dur; }

// ------------------------------------------------------------------ state animations
if (G.state === 'clear') {
  G.clearT += rdt; const t = G.clearT, P = L.exit;
  const px = cc(P[0]), py = cc(P[1]);
  G.vis.x = lerp(G.vis.x, px, 1 - Math.pow(0.0001, rdt)); G.vis.y = lerp(G.vis.y, py, 1 - Math.pow(0.0001, rdt));
  G.orbScale = Math.max(0, 1 - t / 0.35);
  if (t - rdt < 0.3 && t >= 0.3) { G.flash = 1; sparks(px, py, 0, 0, 30, '120;255;170', 520); ring(px, py, 1.4, [120, 255, 170]); G.shake = 6; flashLight(px, py, 400, '120;255;170', 1.4); }
  if (t - rdt < 0.85 && t >= 0.85) {    // clear panel: NEXT / LEVELS
    const nx = nextOf(G.chapter, G.level);
    G.btnNext.visible = true; G.btnLevels.visible = true;
    G.btnNext.born = C.time; G.btnLevels.born = C.time; G.btnNext.delay = 0.12; G.btnLevels.delay = 0.24; G.btnNext.s = G.btnLevels.s = 0;
    G.btnNext.enabled = true;
    if (G.btnNext.lbl) G.btnNext.lbl.setString(nx ? (nx[0] !== G.chapter ? 'NEXT CHAPTER' : 'NEXT') : 'LEVELS');
    G.btnNext.onPress = nx ? () => goNext() : () => toSelect();
    G.btnLevels.visible = !!nx;
    C.buttonNav = true; C.modalKeys = false; C.defaultFocus = G.btnNext; C.focus = G.btnNext.id; C.keyNav = true;
    const got = G.shards.filter((s) => s.got).length;
    G.ui.pShards.setString(G.shards.length ? got + ' / ' + G.shards.length : 'NO SHARDS');
    const chDone = !nextOf(G.chapter, G.level) || nx[0] !== G.chapter;
    G.ui.pSub.setString((G.moves + ' MOVES' + (G.deaths ? '   ·   ' + G.deaths + (G.deaths > 1 ? ' DEATHS' : ' DEATH') : '')) +
      (chDone && G.level === LIB.CHAPTERS[G.chapter].levels.length - 1 ? '\n' + LIB.CHAPTERS[G.chapter].name.toUpperCase() + ' COMPLETE' + (nx ? '  -  ' + LIB.CHAPTERS[nx[0]].name.toUpperCase() + ' UNLOCKED' : '') : ''));
    G.panelT = 0;
  }
} else if (G.state === 'dying') {
  G.dieT += rdt; const t = G.dieT;
  if (G.dieHole) {
    const [hx, hy] = G.dieHole, a0 = Math.atan2(G.dieFrom[1] - hy, G.dieFrom[0] - hx), r0 = Math.hypot(G.dieFrom[0] - hx, G.dieFrom[1] - hy);
    const u = Math.min(1, t / 0.55), r = r0 * (1 - ease(u)), a = a0 + u * 7;
    G.vis.x = hx + Math.cos(a) * r; G.vis.y = hy + Math.sin(a) * r; G.orbScale = Math.max(0, 1 - u);
    for (const h of G.holes) if (h.x === hx && h.y === hy) h.pulse = Math.max(h.pulse, u < 1 ? 0.3 : 0);
    if (t - rdt < 0.55 && t >= 0.55) { G.flash = 0.45; for (const h of G.holes) if (h.x === hx && h.y === hy) h.pulse = 1; ring(hx, hy, 1.2, [255, 110, 150]); G.shake = 7; showToast('SWALLOWED', 1.2, '255;120;160'); }
  } else if (G.dieType === 'burn') { G.orbScale = Math.max(0, 1 - t / 0.18); }
  else { G.orbScale = Math.max(0, 1 - t / 0.3); }
  if (t > 1.05) {
    SIM.respawn(L, st);
    G.vis.x = st.x; G.vis.y = st.y; G.orbScale = 0; G.spawnT = 0; G.state = 'play'; ring(st.x, st.y, 0.6, [140, 240, 255]); G.log.push('respawn ' + st.i + ',' + st.j);
  }
}

// ------------------------------------------------------------------ orb visuals
if (G.state === 'play') {
  if (G.orbScale < 1) { G.spawnT += rdt; G.orbScale = Math.min(1, ease(G.spawnT / 0.35) * 1.0); }
  if (st.mode === 'fly' || st.ride) {
    let hx = 0, hy = 0; if (st.ride) { const [dx, dy] = DIRV[st.ride.side]; hx = dx; hy = dy; }
    const tx = st.x + hx * 7, ty = st.y + hy * 7;
    if (st.mode === 'fly') { G.vis.x = st.x; G.vis.y = st.y; } else { const k = 1 - Math.pow(0.0000001, rdt); G.vis.x = lerp(G.vis.x, tx, k); G.vis.y = lerp(G.vis.y, ty, k); }
  } else {
    let hx = 0, hy = 0; for (const d of SIM.stuckContacts(L, st)) { hx += DIRV[d][0]; hy += DIRV[d][1]; }
    const hug = 7, tx = st.x + Math.sign(hx) * hug, ty = st.y + Math.sign(hy) * hug, k = 1 - Math.pow(0.000002, rdt);
    G.vis.x = lerp(G.vis.x, tx, k); G.vis.y = lerp(G.vis.y, ty, k);
  }
}
G.squashV += (-G.squash * 520 - G.squashV * 22) * rdt; G.squash += G.squashV * rdt;
let ox = 0, oy = 0;
if (G.bump) {
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
orb.setColor(G.bump ? '255;170;190' : (G.state === 'dying' && G.dieType === 'burn' ? '255;160;80' : '255;255;255'));
halo.setPosition(G.vis.x + ox, G.vis.y + oy); halo.setScale(Math.max(0.001, 0.5 * G.orbScale * (1 + 0.1 * Math.sin(G.time * 2.1) + 0.25 * sp)));
const orbCloud = inCloud(G.vis.x, G.vis.y);
G.cloudK = lerp(G.cloudK || 0, orbCloud ? 1 : 0, 1 - Math.pow(0.001, rdt));
halo.setOpacity((200 + 55 * sp) * (1 - 0.6 * G.cloudK));
if (G.orbLight) {   // the photon's own light: dims hard inside gas clouds
  const k = G.cloudK, rad = (170 + 30 * sp) * (1 - 0.68 * k) * Math.max(0.15, G.orbScale) * (1 + 0.03 * Math.sin(G.time * 5));
  G.orbLight.setPosition(G.vis.x, G.vis.y); G.orbLight.setRadius(Math.max(10, rad));
  const b = 1 - 0.6 * k; G.orbLight.setColor(Math.round(210 * b) + ';' + Math.round(235 * b) + ';' + Math.round(255 * b));
}
if (st.mode === 'fly' && G.state === 'play') {
  const [lx, ly] = G.lastTrail || [st.x, st.y]; const dist = Math.hypot(st.x - lx, st.y - ly), stepD = 3.5;
  for (let s = stepD; s <= dist; s += stepD) {
    const u = s / dist, x = lerp(lx, st.x, u), y = lerp(ly, st.y, u);
    const dim = inCloud(x, y) ? 0.3 : 1;
    const tp = part('Trail', x, y, { life: G.dark ? 0.8 : 0.42, s0: 0.62, s1: 0.04, drag: 0, a0: 200 * dim, z: 25, color: '150;225;255' }); if (tp) tp.lin = true;
    G.trailN = (G.trailN || 0) + 1;
    if (G.trailN % 4 === 0) { const t2 = part('OrbHalo', x, y, { life: G.dark ? 0.9 : 0.5, s0: 0.16, s1: 0.02, drag: 0, a0: 90 * dim, z: 24 }); if (t2) t2.lin = true; }
    if (G.dark && G.trailN % 12 === 0) trailLight(x, y);
  }
  if (dist >= stepD) G.lastTrail = [st.x, st.y];
  if (G.dark) { const [mx, my] = G.lastMem || [st.x, st.y]; if (Math.hypot(st.x - mx, st.y - my) > 90) { remember(st.x, st.y); G.lastMem = [st.x, st.y]; } }
} else if (G.state === 'play' && Math.random() < rdt * 3) {
  part('Spark', G.vis.x + rand(-8, 8), G.vis.y + rand(-8, 8), { vx: rand(-15, 15), vy: rand(-35, -10), life: 0.9, s0: 0.25, s1: 0, drag: 0.5, a0: 160 });
}
updateParts(rdt);
updateLights(rdt);

// ------------------------------------------------------------------ world objects animation
if (G.portal) {
  const p = G.portal, s = 0.5 * (1 + 0.08 * Math.sin(G.time * 4)) * (G.state === 'clear' ? 1 + 0.6 * ease(G.clearT / 0.3) : 1);
  p.core.setScale(s); p.r1.setScale(0.5 * (1 + 0.04 * Math.sin(G.time * 2))); p.r2.setScale(0.5);
  p.r1.setAngle(G.time * 60); p.r2.setAngle(-G.time * 110);
  if (p.light) { p.light.setRadius(150 * (1 + 0.1 * Math.sin(G.time * 3))); }
  if (p.hint) { p.hint.setAngle(G.time * 60); p.hint.setScale(0.5); p.hint.setOpacity(40 + 25 * Math.sin(G.time * 2)); }
}
for (const s of G.shards) {
  if (s.got) { if (s.o.getOpacity() > 0) { s.o.setOpacity(Math.max(0, s.o.getOpacity() - rdt * 900)); s.o.setScale(s.o.getScaleX() + rdt * 2); } continue; }
  s.o.setPosition(cc(s.i), cc(s.j) + Math.sin(G.time * 2.5 + s.k) * 3); s.o.setScale(0.5 * (1 + 0.1 * Math.sin(G.time * 5 + s.k)));
}
for (const p of G.pads) {
  p.boost = Math.max(0, p.boost - rdt * 1.5);
  const onIt = st.mode === 'stuck' && !st.ride && st.i === p.i + p.dx && st.j === p.j + p.dy;
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
for (const s of G.stars) {    // burning stars: slow pulsing corona, strong light
  s.flare = Math.max(0, s.flare - rdt * 1.2);
  const pu = 0.5 + 0.5 * Math.sin(G.time * 1.3 + s.k * 2);
  s.corona.setAngle(G.time * 8 + s.k * 40); s.corona.setScale(0.5 * (1.0 + 0.12 * pu + 0.3 * s.flare)); s.corona.setOpacity(200 + 55 * pu);
  s.corona2.setAngle(-G.time * 5 + 17); s.corona2.setScale(0.5 * (0.8 + 0.1 * (1 - pu))); s.corona2.setOpacity(150);
  s.core.setScale(0.5 * 2.2 * (1 + 0.04 * Math.sin(G.time * 7 + s.k) + 0.15 * s.flare));
  s.glow.setScale(0.5 * (1.6 + 0.25 * pu + 0.5 * s.flare)); s.glow.setOpacity(200);
  if (s.light) { s.light.setRadius(210 + 40 * pu + 80 * s.flare); s.light.setColor(Math.round(200 + 55 * pu) + ';' + Math.round(110 + 40 * pu) + ';' + Math.round(50 + 20 * pu)); }
}
for (const mv of G.movers) {
  const r = SIM.moverRect(L, mv.m, st.time || 0), x = (r.x0 + r.x1) / 2, y = (r.y0 + r.y1) / 2;
  mv.flare = Math.max(0, mv.flare - rdt * 2);
  mv.o.setPosition(x, y); mv.o.setOpacity(Math.min(255, 200 + 40 * Math.sin(G.time * 4 + mv.k) + 60 * mv.flare));
  mv.o.setScaleX(0.5 * (1 + 0.06 * mv.flare)); mv.o.setScaleY(0.5 * (1 + 0.06 * mv.flare));
  if (mv.light) { mv.light.setPosition(x, y); mv.light.setRadius(80 + 50 * mv.flare); }
  const ride = st.ride && st.ride.m === mv.k;
  for (const d of mv.dots) { const near = Math.hypot(d.getX() - x, d.getY() - y) < Math.max(r.x1 - r.x0, r.y1 - r.y0) * 0.6;
    d.setOpacity((G.dark ? 60 : 100) + (near ? 120 : 0) + (ride ? 40 : 0)); }
}
for (const c of G.clouds) {    // gas clouds: slow swirl
  c.vis.setPosition(c.cx + Math.sin(G.time * 0.3) * 3, c.cy + Math.cos(G.time * 0.23) * 3);
  c.vis.setOpacity(185 + 25 * Math.sin(G.time * 0.7 + c.cx));
  for (const p of c.puffs) {
    p.ph += rdt * p.sp; const rx = c.w * p.r, ry = c.h * p.r;
    p.o.setPosition(c.cx + Math.cos(p.ph) * rx, c.cy + Math.sin(p.ph * 1.3) * ry); p.o.setAngle(p.ph * 57 * 2);
    p.o.setScale(Math.min(c.w, c.h) / 128 * 1.1); p.o.setOpacity(120 + 40 * Math.sin(p.ph * 2));
  }
}
C.updateMotes(rdt, G.W, G.H, G.holes.map((h) => [h.x, h.y, 180]));
for (const m of G.motes) if (m.x < -120 || m.x > G.W + 120) m.x = rand(-80, G.W + 80);

// ------------------------------------------------------------------ camera fit (portrait & landscape)
const rw = C.rw, rh = C.rh, uiS = C.uiS;
const hudTop = 120 * uiS, hudBot = 90 * uiS;
const zoom = Math.min((rw - 24 * uiS) / (G.W + 16), (rh - hudTop - hudBot) / (G.H + 16));
G.shake *= Math.exp(-9 * rdt); if (G.shake < 0.05) G.shake = 0;
const shk = G.shake + C.shake * 0.6; C.shake *= Math.exp(-10 * rdt);
const shx = (Math.random() * 2 - 1) * shk, shy = (Math.random() * 2 - 1) * shk;
const camX = G.W / 2 + shx, camY = G.H / 2 - (hudTop - hudBot) / 2 / zoom + shy;
for (const ln of ['', 'Bg', 'Hint']) { const l = runtimeScene.getLayer(ln); l.setCameraZoom(zoom); l.setCameraX(camX); l.setCameraY(camY); }
G.zoom = zoom;
G.neb.setPosition(G.W / 2, G.H / 2); G.neb.setScale(Math.max(G.W, G.H) / 512 * 1.5);
const bgL = runtimeScene.getLayer('Bg');
if (G.holes.length) {
  const h = G.holes[0], sx = (h.x - camX) * zoom + rw / 2, sy = (h.y - camY) * zoom + rh / 2;
  bgL.enableEffect('Lens', true);
  bgL.setEffectDoubleParameter('Lens', 'centerX', sx / rw); bgL.setEffectDoubleParameter('Lens', 'centerY', sy / rh);
  bgL.setEffectDoubleParameter('Lens', 'radius', 150 * zoom); bgL.setEffectDoubleParameter('Lens', 'strength', -0.55 - 0.3 * h.pulse);
} else bgL.enableEffect('Lens', false);

// ------------------------------------------------------------------ HUD + clear panel
const UW = C.UW, UH = C.UH;
G.flash = Math.max(0, G.flash - rdt * 2.2); G.ui.flash.setPosition(-10, -10); G.ui.flash.setWidth(UW + 20); G.ui.flash.setHeight(UH + 20); G.ui.flash.setOpacity(255 * G.flash * G.flash);
G.btnBack.x = 48; G.btnBack.y = 48; G.btnRestart.x = UW - 48; G.btnRestart.y = 48;
G.btnRestart.enabled = G.state !== 'clear';
G.ui.level.setPosition(UW / 2 - G.ui.level.getWidth() / 2, 30);
const got = G.shards.filter((s) => s.got).length;
G.ui.shards.setString(G.shards.length ? (got + ' / ' + G.shards.length) : '');
G.ui.shards.setPosition(UW / 2 - G.ui.shards.getWidth() / 2 + 12, 62);
G.ui.shardIcon.setScale(0.3); G.ui.shardIcon.setPosition(UW / 2 - G.ui.shards.getWidth() / 2 - 8, 62 + G.ui.shards.getHeight() / 2); G.ui.shardIcon.setOpacity(G.shards.length ? 255 : 0);
G.hintA = (G.firstMove && G.moves >= 2) ? Math.max(0.35, G.hintA - rdt * 0.5) : 1;
G.ui.hint.setWrapping(true); G.ui.hint.setWrappingWidth(Math.min(UW - 40, 620));
G.ui.hint.setOpacity((G.state === 'clear' ? 0 : 230) * G.hintA); G.ui.hint.setPosition(UW / 2 - G.ui.hint.getWidth() / 2, UH - 30 - G.ui.hint.getHeight());
// level-clear: big text, then a panel with NEXT / LEVELS
const cl = G.ui.clear; const ct = G.state === 'clear' ? G.clearT - 0.3 : -1;
const pOn = G.state === 'clear' && G.clearT > 0.85; G.panelT = pOn ? (G.panelT || 0) + rdt : 0;
const pu = LIB.easeBack(clamp(G.panelT / 0.45, 0, 1));
const pw = Math.min(UW - 60, 560), ph = 400, px = UW / 2 - pw / 2, py = UH * 0.5 - ph / 2 + (1 - pu) * 40;
G.ui.dim.setPosition(-10, -10); G.ui.dim.setWidth(UW + 20); G.ui.dim.setHeight(UH + 20); G.ui.dim.setOpacity(pOn ? 150 * clamp(G.panelT * 3, 0, 1) : 0);
G.ui.panel.setPosition(px, py); G.ui.panel.setWidth(pw); G.ui.panel.setHeight(ph); G.ui.panel.setOpacity(pOn ? 240 * clamp(G.panelT * 4, 0, 1) : 0);
cl.setScale(0.5 * (ct > 0 ? 1 + 0.25 * (1 - ease(ct / 0.4)) : 1) * Math.min(1, (pw - 40) / 620));
cl.setOpacity(ct > 0 ? 255 * Math.min(1, ct * 5) : 0);
cl.setPosition(UW / 2 - cl.getWidth() / 2, pOn ? py + 20 : UH * 0.42 - cl.getHeight() / 2);
G.ui.pShards.setPosition(UW / 2 - G.ui.pShards.getWidth() / 2 + 14, py + 128); G.ui.pShards.setOpacity(pOn ? 255 * clamp(G.panelT * 3 - 0.5, 0, 1) : 0);
G.ui.pIcon.setScale(0.36); G.ui.pIcon.setPosition(UW / 2 - G.ui.pShards.getWidth() / 2 - 10, py + 128 + G.ui.pShards.getHeight() / 2); G.ui.pIcon.setOpacity(G.ui.pShards.getOpacity());
G.ui.pSub.setPosition(UW / 2 - G.ui.pSub.getWidth() / 2, py + 170); G.ui.pSub.setOpacity(pOn ? 210 * clamp(G.panelT * 3 - 0.7, 0, 1) : 0);
G.btnNext.x = UW / 2; G.btnNext.y = py + ph - 140; G.btnNext.scale = Math.min(0.8, (pw - 40) / 560);
G.btnLevels.x = UW / 2; G.btnLevels.y = py + ph - 48; G.btnLevels.scale = 0.75;
if (G.state !== 'clear') { G.btnNext.visible = G.btnLevels.visible = false; C.buttonNav = false; C.modalKeys = true; }
C.updateButtons(rdt);
G.toastT = Math.max(0, (G.toastT || 0) - rdt);
G.ui.toast.setOpacity(255 * Math.min(1, G.toastT * 3)); G.ui.toast.setPosition(UW / 2 - G.ui.toast.getWidth() / 2, UH - 92 - G.ui.hint.getHeight());
C.updateParts(rdt);
C.updateTrans(rdt);
