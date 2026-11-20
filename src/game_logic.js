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
// The Abyss ambient: dim, never black - the whole level is always faintly readable; the orb is the strong light.
const DUST_COLS = ['255;214;120', '255;240;205', '140;235;255', '255;150;205', '255;190;120'];
const AMB = [46, 50, 76], FLARE_AMB = [250, 228, 200];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
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
  // Solar Winds: sunrise sky + sun bloom (Bg layer), slow-motion vignette and off-screen exit pointer (UI layer)
  G.sky = mk('Sky', 'Bg', 0, 0, -6); G.sunGlow = mk('SunGlow', 'Bg', 0, 0, -5, true);
  G.vig = mk('Vignette', 'UI', 0, 0, 30); G.vig.setOpacity(0);
  G.hudTopF = mk('HudFade', 'UI', 0, 0, 29); G.hudBotF = mk('HudFade', 'UI', 0, 0, 29); G.hudTopF.setOpacity(0); G.hudBotF.setOpacity(0);   // readable HUD over scrolling worlds
  G.exitArrow = mk('ExitArrow', 'UI', 0, 0, 42, true); G.exitArrow.setOpacity(0); G.exitArrow.setColor('140;255;170');
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
  // NOTE: hiding a GDevelop lighting layer does NOT stop it: in the 2D-only renderer its multiply-blended
  // "lighting sprite" is still drawn over the layers below (that made chapter 1 render black).
  // So outside the Abyss the ambient is pure white (multiply x1 = no change) AND the sprite is hidden.
  LL.show(G.dark); HL.show(true);
  G.amb = AMB.slice(); G.ambSet = '';
  if (G.dark && !LIB.lite) LL.setClearColor(AMB[0], AMB[1], AMB[2]); else LL.setClearColor(255, 255, 255);
  try { const ls = LL.getRenderer().getLightingSprite && LL.getRenderer().getLightingSprite(); if (ls) ls.visible = G.dark && !LIB.lite; } catch (e) {}
  if (LIB.lite) G.dark = false;     // lite mode: no darkness at all (Abyss levels are fully lit)
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
    corona2: add('StarCorona', cc(i), cc(j), 4, true), core: add('StarCore', cc(i), cc(j), 11, true), light: G.dark ? light(cc(i), cc(j), 165, '255;170;90') : null, flare: 0, tele: 0 }));
  G.flareT = rand(6, 10); G.flareStar = null; G.flareAge = 99; G.flareAmp = 0;
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
    // darkness inside the gas: a black mask on the lighting layer removes the ambient (and flare) light there;
    // only real lights (the orb's light inside, or light scattered in from the orb / mirror flashes nearby) show it
    let mask = null, scat = null;
    if (G.dark && !LIB.lite) {
      mask = add('CloudMask', cx, cy, 0, false, 'Light'); const ms = 96 * 2;
      mask.setScaleX((x1 - x0 + T * 0.5) / ms * (96 / 68)); mask.setScaleY((y1 - y0 + T * 0.5) / ms * (96 / 68));
      scat = light(cx, cy, 10, '0;0;0', 2);
    }
    return { x0, y0, x1, y1, cx, cy, vis, block, puffs, w: x1 - x0, h: y1 - y0, mask, scat, lit: 0 };
  });
  setupSolar(CHP, def);
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
// ------------------------------------------------------------------ Solar Winds (chapter 3): winds, curves, wells, stardust, sky
function setupSolar(CHP, def) {
  const add = (name, x, y, z, blend, layer) => { const o = tag(mk(name, layer || '', x, y, z, blend)); G.dyn.push(o); return o; };
  G.sun = CHP.theme === 'sun'; G.scroll = !!CHP.scroll; G.camSnap = true; G.ts = 1; G.slowT = 0; G.surge = 0;
  G.sky.hide(!G.sun); G.sunGlow.hide(!G.sun);
  G.bg.setOpacity(G.sun ? 0 : 255); G.neb.setColor(G.sun ? '255;175;205' : '255;255;255');
  for (const m of G.motes) m.o.setColor(G.sun ? '255;220;150' : '255;255;255');
  if (G.sun) {
    const padX = 3000, padY = 700;
    G.sky.setPosition(-padX, -padY); G.sky.setWidth(G.W + 2 * padX); G.sky.setHeight(G.H + 2 * padY);
    G.sunGlow.setPosition(G.W * 0.62, -T * 2); G.sunGlow.setScale(Math.max(G.W, G.H) / 256 * 1.1); G.sunGlow.setOpacity(150);
  }
  // wind zones: soft glowing panel, scrolling chevrons, fast streaks
  G.winds = L.winds.map((w, k) => {
    const horiz = w.ax !== 0, dir = [Math.sign(w.ax), Math.sign(w.ay)], ang = Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
    const col = horiz ? '120;235;255' : '255;214;120';
    const zone = add('WindZone', 0, 0, 2, true); zone.setColor(col);
    const zw = w.x1 - w.x0, zh = w.y1 - w.y0; zone.setScaleX((zw + T * 0.4) / 108); zone.setScaleY((zh + T * 0.4) / 108); zone.setPosition((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2); zone.setOpacity(46);
    const chevs = []; const sp = T * 1.6;
    const along = horiz ? zw : zh, across = horiz ? zh : zw, nA = Math.max(1, Math.round(along / sp)), nC = Math.max(1, Math.round(across / (T * 1.5)));
    for (let a = 0; a < nA; a++) for (let c = 0; c < nC; c++) { const o = add('WindChev', 0, 0, 3, true); o.setAngle(ang); o.setColor(col); o.setScale(0.36); chevs.push({ o, a: (a + (c % 2) * 0.5) / nA, c: (c + 0.5) / nC }); }
    const nS = Math.min(LIB.lite ? 4 : 16, Math.max(3, Math.round(zw * zh / (T * T) / 5)));
    const streaks = []; for (let q = 0; q < nS; q++) { const o = add('WindStreak', 0, 0, 4, true); o.setAngle(ang); o.setColor(q % 3 ? col : '255;255;255'); streaks.push({ o, u: Math.random(), v: rand(0.05, 0.95), sp: rand(0.5, 1.1), s: rand(0.35, 0.7) }); }
    return { w, k, horiz, dir, ang, zone, chevs, streaks, zw, zh, strength: Math.hypot(w.ax, w.ay) / 2600 };
  });
  // gravity wells: luminous aqua core, dashed temporal range, contracting time ripples
  G.wells = L.wells.map((w, k) => ({ w, k, range: (() => { const o = add('WellRange', w.x, w.y, 2, true); o.setScale(w.R / 360); return o; })(),
    core: (() => { const o = add('WellCore', w.x, w.y, 6, true); o.setScale(0.5 * (w.R / (2.5 * T))); return o; })(),
    core2: (() => { const o = add('WellCore', w.x, w.y, 6, true); o.setScale(0.3 * (w.R / (2.5 * T))); o.setColor('200;160;255'); return o; })(), rip: rand(0, 1) }));
  // curved boost walls: golden pips racing along the rim lane, flare when ridden
  G.curves = L.curves.map((c, k) => {
    const pips = []; for (let q = 0; q < (LIB.lite ? 3 : 7); q++) { const o = add('DustSoft', 0, 0, 3, true); o.setColor(q % 2 ? '255;120;210' : '255;214;120'); pips.push({ o, u: q / (LIB.lite ? 3 : 7), lane: q % c.r }); }
    return { c, k, pips, flare: 0 };
  });
  // stardust: three parallax depths (far ones on the Bg layer), sized/coloured variety; lite and phones get fewer
  G.dust = [];
  if (G.sun) {
    const n = LIB.lite ? 26 : (C.isTouch ? 70 : 105);
    for (let q = 0; q < n; q++) {
      const depth = q % 3, star = Math.random() < (depth === 2 ? 0.5 : 0.3);
      const p = depth === 0 ? rand(0.3, 0.45) : depth === 1 ? rand(0.6, 0.8) : rand(1.0, 1.12);
      const o = add(star ? 'DustStar' : 'DustSoft', 0, 0, depth === 2 ? 14 : 3, true, depth === 2 ? '' : 'Bg');
      o.setColor(DUST_COLS[Math.floor(Math.random() * DUST_COLS.length)]);
      G.dust.push({ o, p, u: Math.random(), v: Math.random(), vx: rand(-14, 14), vy: rand(-22, -4), wx: 0, wy: 0, ph: rand(0, 6.28), tw: rand(1.2, 3.4),
        s: (depth === 0 ? rand(0.18, 0.32) : depth === 1 ? rand(0.28, 0.48) : rand(0.4, 0.75)) * (star ? 1.1 : 1), a: depth === 0 ? 130 : depth === 1 ? 180 : 235, star });
    }
  }
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
  } else if (e.type === 'curve') {
    const cv = G.curves[e.k]; if (cv) cv.flare = 1;
    sparks(e.x, e.y, 0, 0, 10, '255;210;120', 260); ring(e.x, e.y, 0.5, [255, 200, 120]); G.shake = Math.max(G.shake, 2);
    G.log.push('curve ' + e.k);
  } else if (e.type === 'boost') {
    const [dx, dy] = DIRV[e.dir]; const cv = G.curves[e.k]; if (cv) cv.flare = 1;
    sparks(e.x, e.y, dx, dy, 22, '255;200;110', 760); sparks(e.x, e.y, dx, dy, 12, '255;100;210', 560);
    ring(e.x, e.y, 0.9, [255, 160, 200]); part('RingW', e.x, e.y, { life: 0.5, s0: 0.05, s1: 0.9, drag: 0, lin: true, color: '255;220;150', z: 19 });
    G.shake = Math.max(G.shake, 4); G.surge = 1; G.flash = Math.max(G.flash, 0.12); showToast('BOOST!', 0.8, '255;205;120');
    G.log.push('boost ' + e.k + ' ' + e.dir);
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

// ------------------------------------------------------------------ gravity wells: time scale for the world (sim already slows the orb + platforms)
const TSNOW = (G.state === 'play' && st.ts) ? st.ts : 1;
G.ts = lerp(G.ts || 1, TSNOW, 1 - Math.pow(0.0005, rdt));
const wdt = rdt * G.ts; G.wtime = (G.wtime || 0) + wdt;
if (TSNOW < 0.7 && !G.inSlow && G.state === 'play') { G.inSlow = true; if (st.mode === 'fly') showToast('SLOW-MO', 0.9, '140;235;255'); G.log.push('slowmo'); }
if (TSNOW > 0.85) G.inSlow = false;
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
G.surge = Math.max(0, (G.surge || 0) - rdt * 1.4);
halo.setPosition(G.vis.x + ox, G.vis.y + oy); halo.setScale(Math.max(0.001, 0.5 * G.orbScale * (1 + 0.1 * Math.sin(G.time * 2.1) + 0.25 * sp + 0.9 * G.surge)));
halo.setColor(G.surge > 0.02 ? '255;' + Math.round(255 - 70 * G.surge) + ';' + Math.round(255 - 90 * G.surge) : (G.ts < 0.95 ? Math.round(255 - 100 * (1 - G.ts)) + ';255;255' : '255;255;255'));
const orbCloud = inCloud(G.vis.x, G.vis.y);
G.cloudK = lerp(G.cloudK || 0, orbCloud ? 1 : 0, 1 - Math.pow(0.001, rdt));
halo.setOpacity((200 + 55 * sp) * (1 - 0.6 * G.cloudK));
if (G.orbLight) {   // the photon's own light: dims hard inside gas clouds
  const k = G.cloudK, rad = (170 + 30 * sp) * (1 - 0.45 * k) * Math.max(0.15, G.orbScale) * (1 + 0.03 * Math.sin(G.time * 5));
  G.orbLight.setPosition(G.vis.x, G.vis.y); G.orbLight.setRadius(Math.max(10, rad));
  const b = 1 - 0.6 * k; G.orbLight.setColor(Math.round(210 * b) + ';' + Math.round(235 * b) + ';' + Math.round(255 * b));
}
if (st.mode === 'fly' && G.state === 'play') {
  const [lx, ly] = G.lastTrail || [st.x, st.y]; const dist = Math.hypot(st.x - lx, st.y - ly), stepD = 3.5;
  for (let s = stepD; s <= dist; s += stepD) {
    const u = s / dist, x = lerp(lx, st.x, u), y = lerp(ly, st.y, u);
    const dim = inCloud(x, y) ? 0.3 : 1;
    const bst = (st.boost || 0) > 0.05 || st.rail, tcol = bst ? ((G.trailN & 1) ? '255;205;120' : '255;120;210') : '150;225;255';
    const tp = part('Trail', x, y, { life: G.dark ? 0.8 : (bst ? 0.6 : 0.42), s0: bst ? 0.8 : 0.62, s1: 0.04, drag: 0, a0: 200 * dim, z: 25, color: tcol }); if (tp) tp.lin = true;
    if (bst && G.trailN % 3 === 0) part('Spark', x + rand(-6, 6), y + rand(-6, 6), { vx: rand(-60, 60), vy: rand(-60, 60), life: rand(0.3, 0.6), s0: rand(0.3, 0.55), s1: 0, drag: 3, color: Math.random() < 0.5 ? '255;220;140' : '255;140;220' });
    if (G.sun && G.trailN % 5 === 0 && L.winds.length && SIM.windAt(L, x, y)) { const wa = SIM.windAt(L, x, y), a = Math.atan2(wa[1], wa[0]);
      const sp2 = part('Spark', x + rand(-14, 14), y + rand(-14, 14), { vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 0.4, s0: 0.35, s1: 0, drag: 1, color: '200;245;255' }); }
    G.trailN = (G.trailN || 0) + 1;
    if (G.trailN % 4 === 0) { const t2 = part('OrbHalo', x, y, { life: G.dark ? 0.9 : 0.5, s0: 0.16, s1: 0.02, drag: 0, a0: 90 * dim, z: 24 }); if (t2) t2.lin = true; }
    if (G.dark && G.trailN % 12 === 0) trailLight(x, y);
  }
  if (dist >= stepD) G.lastTrail = [st.x, st.y];
  if (G.dark) { const [mx, my] = G.lastMem || [st.x, st.y]; if (Math.hypot(st.x - mx, st.y - my) > 90) { remember(st.x, st.y); G.lastMem = [st.x, st.y]; } }
} else if (G.state === 'play' && Math.random() < rdt * 3) {
  part('Spark', G.vis.x + rand(-8, 8), G.vis.y + rand(-8, 8), { vx: rand(-15, 15), vy: rand(-35, -10), life: 0.9, s0: 0.25, s1: 0, drag: 0.5, a0: 160 });
}
updateParts(wdt);
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
  const SV = 0.8, tw = s.tele * s.tele;    // stars are 80% of the old size (hitbox 0.65 tile); tele = swelling before a solar flare
  s.corona.setAngle(G.time * (8 + 60 * tw) + s.k * 40); s.corona.setScale(SV * 0.5 * (1.0 + 0.12 * pu + 0.3 * s.flare + 0.45 * tw)); s.corona.setOpacity(Math.min(255, 220 + 35 * pu + 40 * tw));
  s.corona2.setAngle(-G.time * 5 + 17); s.corona2.setScale(SV * 0.5 * (0.8 + 0.1 * (1 - pu) + 0.3 * tw)); s.corona2.setOpacity(190);
  s.core.setScale(SV * 0.5 * 2.2 * (1 + 0.04 * Math.sin(G.time * 7 + s.k) + 0.15 * s.flare + 0.3 * tw + 0.05 * Math.sin(G.time * 40) * tw));
  s.glow.setScale(SV * 0.5 * (1.35 + 0.2 * pu + 0.5 * s.flare + 1.0 * tw)); s.glow.setOpacity(255);
  if (s.light) { s.light.setRadius(155 + 30 * pu + 80 * s.flare + 160 * tw); s.light.setColor(Math.round(Math.min(255, 225 + 30 * pu + 30 * tw)) + ';' + Math.round(140 + 40 * pu + 80 * tw) + ';' + Math.round(70 + 20 * pu + 90 * tw)); }
}
// ---- solar flares: every 8-15 s a star swells for ~1 s, then blasts light across the whole level for ~2.5 s
if (G.stars.length && G.state !== 'clear') {
  G.flareT -= rdt;
  if (G.flareT < 1.1 && !G.flareStar) { G.flareStar = G.stars[Math.floor(Math.random() * G.stars.length)]; G.log.push('flare-warn'); }
  if (G.flareStar) G.flareStar.tele = clamp01(1 - G.flareT / 1.1);
  if (G.flareT <= 0 && G.flareStar) {
    const s = G.flareStar; s.tele = 0; s.flare = 1; G.flareStar = null; G.flareAge = 0; G.flareT = rand(8, 15); G.flares = (G.flares || 0) + 1;
    G.log.push('flare'); G.shake = Math.max(G.shake, 7); G.flash = Math.max(G.flash, 0.45);
    // shockwave: thin bright rings racing out across the level (RingW is the crisp ring texture)
    part('RingW', s.x, s.y, { life: 0.8, s0: 0.05, s1: 2.4, drag: 0, lin: true, color: '255;225;160', z: 19 });
    part('RingW', s.x, s.y, { life: 1.25, s0: 0.05, s1: 3.6, drag: 0, lin: true, a0: 170, color: '255;160;90', z: 19 });
    ring(s.x, s.y, 1.6, [255, 230, 170]); flashLight(s.x, s.y, 420, '255;220;150', 1.2);
    sparks(s.x, s.y, 0, 0, 36, '255;210;130', 620);
  }
}
G.flareAge += rdt;
{ const t = G.flareAge;    // envelope: fast attack, ~1.3 s hold, ~1.4 s fade
  G.flareAmp = t < 0.12 ? t / 0.12 : t < 1.4 ? 1 : t < 2.8 ? 0.5 + 0.5 * Math.cos(Math.PI * (t - 1.4) / 1.4) : 0; }
if (G.dark && !LIB.lite) {
  const a = G.flareAmp, LL = runtimeScene.getLayer('Light');
  const c3 = [0, 1, 2].map((q) => Math.round(AMB[q] + (FLARE_AMB[q] - AMB[q]) * a)), key = c3.join(',');
  if (key !== G.ambSet) { LL.setClearColor(c3[0], c3[1], c3[2]); G.ambSet = key; G.amb = c3; }
  try { const bl = runtimeScene.getLayer(''); bl.setEffectDoubleParameter('Bloom', 'brightness', 1 + 0.6 * a); bl.setEffectDoubleParameter('Bloom', 'bloomScale', 1.15 + 0.9 * a); } catch (e) {}
  // gas clouds: light scattered into a cloud from the orb (or a nearby flash, e.g. off a mirror) lights it from the inside
  for (const c of G.clouds) {
    if (!c.scat) continue;
    let best = 0, bx = c.cx, by = c.cy, rgb = [0, 0, 0];
    const srcs = [];
    if (G.orbLight && G.state !== 'clear') srcs.push([G.vis.x, G.vis.y, 190 * Math.max(0.15, G.orbScale), [210, 235, 255]]);
    for (const f of G.flashes) { const u = f.t / f.life, k = 1 - u * u; srcs.push([f.o.getX(), f.o.getY(), f.radius * 0.8, f.rgb.map((v) => v * k)]); }
    for (const [sx, sy, sr, col] of srcs) {
      const px = Math.max(c.x0, Math.min(c.x1, sx)), py = Math.max(c.y0, Math.min(c.y1, sy)), d = Math.hypot(px - sx, py - sy);
      const k = clamp01(1 - d / (sr * 0.7)); if (k <= best) continue;
      best = k; rgb = col; const ix = Math.max(c.x0 + 14, Math.min(c.x1 - 14, sx)), iy = Math.max(c.y0 + 14, Math.min(c.y1 - 14, sy));
      bx = d < 1 ? sx : ix; by = d < 1 ? sy : iy;
    }
    c.lit = lerp(c.lit, best, 1 - Math.pow(0.002, rdt));
    c.scat.setPosition(bx, by); c.scat.setRadius(30 + 110 * c.lit);
    c.scat.setColor(rgb.map((v) => Math.round(v * 0.75 * c.lit)).join(';'));
  }
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
// ---- Solar Winds objects (all on world time: they slow down inside gravity wells too)
for (const wz of G.winds || []) {
  const w = wz.w, tt = G.wtime;
  wz.zone.setOpacity(40 + 12 * Math.sin(tt * 1.7 + wz.k));
  for (const ch of wz.chevs) {
    const u = (ch.a + tt * 0.45 * wz.strength) % 1, along = wz.horiz ? wz.zw : wz.zh;
    const a = wz.horiz ? (wz.dir[0] > 0 ? u : 1 - u) : (wz.dir[1] > 0 ? u : 1 - u);
    const x = wz.horiz ? w.x0 + a * wz.zw : w.x0 + ch.c * wz.zw, y = wz.horiz ? w.y0 + ch.c * wz.zh : w.y0 + a * wz.zh;
    ch.o.setPosition(x, y); ch.o.setOpacity(150 * Math.sin(u * Math.PI));
  }
  for (const sk of wz.streaks) {
    sk.u += wdt * sk.sp * (900 * Math.max(0.6, wz.strength)) / (wz.horiz ? wz.zw : wz.zh);
    if (sk.u > 1) { sk.u -= 1; sk.v = rand(0.05, 0.95); }
    const a = wz.horiz ? (wz.dir[0] > 0 ? sk.u : 1 - sk.u) : (wz.dir[1] > 0 ? sk.u : 1 - sk.u);
    const x = wz.horiz ? w.x0 + a * wz.zw : w.x0 + sk.v * wz.zw, y = wz.horiz ? w.y0 + sk.v * wz.zh : w.y0 + a * wz.zh;
    sk.o.setPosition(x, y); sk.o.setScaleX(sk.s * 0.5); sk.o.setScaleY(0.5); sk.o.setOpacity(200 * Math.sin(sk.u * Math.PI));
  }
}
for (const wl of G.wells || []) {
  const w = wl.w, tt = G.wtime;
  wl.core.setAngle(tt * 50); wl.core2.setAngle(-tt * 80); wl.range.setAngle(-tt * 8);
  const near = Math.hypot(G.vis.x - w.x, G.vis.y - w.y) < w.R;
  wl.core.setOpacity(220 + 35 * Math.sin(tt * 2.2)); wl.range.setOpacity(near ? 255 : 190 + 40 * Math.sin(tt * 1.4 + wl.k));
  wl.rip += wdt * 0.9;
  if (wl.rip >= 1) { wl.rip -= 1; const s0 = w.R / 124;     // temporal ripple: a ring contracting into the core
    part('RingW', w.x, w.y, { life: 1.6, s0, s1: s0 * 0.08, drag: 0, lin: true, a0: 75, color: wl.k % 2 ? '190;150;255' : '120;240;255', z: 5 }); }
}
for (const cv of G.curves || []) {
  const c = cv.c; cv.flare = Math.max(0, cv.flare - rdt * 1.5);
  for (const pp of cv.pips) {
    pp.u = (pp.u + wdt * 0.35 * (pp.lane % 2 ? -1 : 1) + 1) % 1;
    const R = T / 2 + pp.lane * T, th = pp.u * Math.PI / 2;
    pp.o.setPosition(c.cx + c.sx * R * Math.cos(th), c.cy + c.sy * R * Math.sin(th));
    pp.o.setScale(0.32 * (1 + 0.8 * cv.flare)); pp.o.setOpacity(Math.min(255, 120 + 80 * Math.sin(G.wtime * 4 + pp.u * 9) + 120 * cv.flare));
  }
}
if (G.slowT !== undefined && G.ts < 0.8 && G.state === 'play' && !LIB.lite) {    // bullet-time ripples around the orb
  G.slowT -= rdt; if (G.slowT <= 0) { G.slowT = 0.45; part('RingW', G.vis.x, G.vis.y, { life: 0.9, s0: 0.75, s1: 0.1, drag: 0, lin: true, a0: 110, color: '150;230;255', z: 24 }); }
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
let camX = G.W / 2 + shx, camY = G.H / 2 - (hudTop - hudBot) / 2 / zoom + shy, czoom = zoom;
if (G.scroll) {
  // big levels (chapter 3): zoom so ~11.5 tiles fill the short side of the play area, then follow the orb
  // with a smoothed camera + velocity look-ahead, clamped to the level bounds (+ padding); HUD stays in screen space
  const playW = rw - 24 * uiS, playH = rh - hudTop - hudBot - (G.wmLift || 0) * uiS;   // the lifted hint (watermark time) shrinks the play area
  czoom = Math.max(zoom, Math.min(playW, rh - hudTop - hudBot) / (11.5 * T));
  const halfW = playW / 2 / czoom, halfH = playH / 2 / czoom, pad = T * 0.6;
  let fx = G.vis.x, fy = G.vis.y;
  if (G.state === 'play' && st.mode === 'fly') { fx += clamp(st.vx * 0.22, -halfW * 0.45, halfW * 0.45); fy += clamp(st.vy * 0.22, -halfH * 0.45, halfH * 0.45); }
  if (G.state === 'clear' && L.exit) { fx = cc(L.exit[0]); fy = cc(L.exit[1]); }
  const clampAxis = (v, half, size) => (size + 2 * pad <= half * 2) ? size / 2 : clamp(v, -pad + half, size + pad - half);
  fx = clampAxis(fx, halfW, G.W); fy = clampAxis(fy, halfH, G.H);
  if (G.camSnap || !G.cam) { G.cam = { x: fx, y: fy }; G.camSnap = false; }
  else { const k = 1 - Math.exp(-(st.mode === 'fly' ? 7 : 4.5) * rdt); G.cam.x = lerp(G.cam.x, fx, k); G.cam.y = lerp(G.cam.y, fy, k); }
  // the play area's centre sits at screen y = hudTop + playH/2 (not the screen centre)
  camX = G.cam.x + shx; camY = G.cam.y - (hudTop + playH / 2 - rh / 2) / czoom + shy;
}
for (const ln of ['', 'Bg', 'Hint']) { const l = runtimeScene.getLayer(ln); l.setCameraZoom(czoom); l.setCameraX(camX); l.setCameraY(camY); }
G.zoom = czoom; G.camX = camX; G.camY = camY;
// stardust: wraps around the view at its parallax depth, twinkles, drifts upward and is blown by solar winds
if (G.dust && G.dust.length) {
  const vw = rw / czoom * 1.15 + 160, vh = rh / czoom * 1.15 + 160;
  for (const d of G.dust) {
    d.ph += wdt;
    const md = (a, b) => ((a % b) + b) % b;
    const x = camX + md(d.u * vw - camX * d.p, vw) - vw / 2, y = camY + md(d.v * vh - camY * d.p, vh) - vh / 2;
    const wa = L.winds.length ? SIM.windAt(L, x, y) : null;
    const k = 1 - Math.exp(-1.6 * wdt);
    d.wx = lerp(d.wx, wa ? wa[0] * 0.16 : 0, k); d.wy = lerp(d.wy, wa ? wa[1] * 0.16 : 0, k);
    d.u += (d.vx + d.wx) * wdt / vw; d.v += (d.vy + d.wy) * wdt / vh;
    const tw = 0.55 + 0.45 * Math.sin(d.ph * d.tw);
    d.o.setPosition(x, y); d.o.setScale(d.s * (d.star ? 0.7 + 0.5 * tw : 1)); d.o.setOpacity(d.a * (0.35 + 0.65 * tw));
    if (d.star) d.o.setAngle(d.ph * 20);
  }
}
G.neb.setPosition(G.W / 2, G.H / 2); G.neb.setScale(Math.max(G.W, G.H) / 512 * 1.5);
const bgL = runtimeScene.getLayer('Bg');
if (G.holes.length && !LIB.lite) {
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
// off-screen exit pointer (scrolling levels): sits on the play-area edge, pointing at the portal
{
  const ea = G.exitArrow; let show = false;
  if (G.scroll && L.exit && G.state !== 'clear') {
    const ex = ((cc(L.exit[0]) - camX) * czoom + rw / 2) / uiS, ey = ((cc(L.exit[1]) - camY) * czoom + rh / 2) / uiS;
    const x0 = 46, x1 = UW - 46, y0 = hudTop / uiS + 36, y1 = UH - hudBot / uiS - 30 - (G.wmLift || 0);
    if (ex < x0 || ex > x1 || ey < y0 || ey > y1) {
      show = true; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, dx = ex - cx, dy = ey - cy;
      const t = Math.min(dx ? ((dx > 0 ? x1 : x0) - cx) / dx : 1e9, dy ? ((dy > 0 ? y1 : y0) - cy) / dy : 1e9);
      const bob = 6 * Math.sin(G.time * 5), n = Math.hypot(dx, dy) || 1;
      ea.setPosition(cx + dx * t - dx / n * bob, cy + dy * t - dy / n * bob); ea.setAngle(Math.atan2(dy, dx) * 180 / Math.PI);
      ea.setScale(0.55 * (1 + 0.08 * Math.sin(G.time * 5)));
    }
  }
  G.arrowA = lerp(G.arrowA || 0, show ? 1 : 0, 1 - Math.pow(0.001, rdt)); ea.setOpacity(230 * G.arrowA); G.exitOff = show;
  // slow-motion vignette (gravity wells): aqua/violet edges fade in with the time dilation
  const sl = clamp01((1 - G.ts) / (1 - SIM.TS_MIN));
  G.vig.setPosition(-10, -10); G.vig.setWidth(UW + 20); G.vig.setHeight(UH + 20); G.vig.setColor(Math.round(70 + 40 * Math.sin(G.time * 2)) + ';150;220');
  G.vig.setOpacity(LIB.lite ? 0 : 120 * Math.sqrt(sl));
  const fadeOn = G.scroll ? 1 : 0, tb = hudTop / uiS * 1.05, bb = (hudBot / uiS + (G.wmLift || 0)) * 1.25;
  G.hudTopF.setColor('36;12;64'); G.hudTopF.setPosition(-10, -2); G.hudTopF.setWidth(UW + 20); G.hudTopF.setHeight(tb); G.hudTopF.setOpacity(215 * fadeOn);
  G.hudBotF.setColor('46;14;52'); G.hudBotF.flipY(true); G.hudBotF.setPosition(-10, UH - bb + 2); G.hudBotF.setWidth(UW + 20); G.hudBotF.setHeight(bb); G.hudBotF.setOpacity(190 * fadeOn);
}
G.hintA = (G.firstMove && G.moves >= 2) ? Math.max(0.35, G.hintA - rdt * 0.5) : 1;
G.ui.hint.setWrapping(true); G.ui.hint.setWrappingWidth(Math.min(UW - 40, 620));
const pageT = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
const wmWant = pageT < 23 ? UH * (C.portrait ? 0.125 : 0.085) : 0;
G.wmLift = wmWant > (G.wmLift || 0) ? wmWant : lerp(G.wmLift || 0, wmWant, 1 - Math.pow(0.02, rdt));     // keep clear of the "Made with GDevelop" watermark
G.ui.hint.setOpacity((G.state === 'clear' ? 0 : 230) * G.hintA); G.ui.hint.setPosition(UW / 2 - G.ui.hint.getWidth() / 2, UH - 30 - G.ui.hint.getHeight() - G.wmLift);
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
G.ui.toast.setOpacity(255 * Math.min(1, G.toastT * 3)); G.ui.toast.setPosition(UW / 2 - G.ui.toast.getWidth() / 2, UH - 92 - G.ui.hint.getHeight() - (G.wmLift || 0));
C.updateParts(rdt);
C.updateTrans(rdt);
