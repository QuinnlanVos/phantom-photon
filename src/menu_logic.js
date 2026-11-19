// ============================================================================
// Phantom Photon - MAIN MENU: photons stream across the screen, a black hole bends
// (slingshots / swallows) them, flickering neon logo, juicy PLAY button -> Level Select.
// ============================================================================
const C = LIB.ctx(runtimeScene); C.frame();
const { rand, lerp, clamp, ease } = LIB;
let M = runtimeScene.__menu;
if (!M) {
  // deep links for testing / sharing: ?select -> level select, ?level=N[&ch=C] -> straight into a level
  const qs = LIB.qs;
  if (!gdjs.__ppDeepDone && (qs.has('level') || qs.has('select'))) {
    gdjs.__ppDeepDone = true;
    if (qs.has('level')) {
      const c = clamp((+qs.get('ch') || 1) - 1, 0, LIB.CHAPTERS.length - 1);
      LIB.nav.chapter = c; LIB.nav.level = clamp((+qs.get('level') || 1) - 1, 0, LIB.CHAPTERS[c].levels.length - 1);
      runtimeScene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, 'Game'); return;
    }
    if (qs.has('ch')) LIB.nav.chapter = clamp((+qs.get('ch') || 1) - 1, 0, LIB.CHAPTERS.length - 1);
    runtimeScene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, 'LevelSelect'); return;
  }
  M = runtimeScene.__menu = { photons: [], spawnT: 0, flick: 1, stutter: 0, nextStutter: 2, pulse: 0, swallowed: 0, slung: 0, zoom: 1, logoIn: 0 };
  C.bg(50);
  M.bh = { range: C.mk('BhRange', '', 0, 0, 2, true), swirl: C.mk('BhSwirl', '', 0, 0, 3, true), glow: C.mk('BhGlow', '', 0, 0, 4, true),
           disk: C.mk('BhDisk', '', 0, 0, 9, true), core: C.mk('BhCore', '', 0, 0, 10), halo: C.mk('Soft', '', 0, 0, 1, true) };
  M.bh.halo.setColor('255;70;140');
  M.logoGlow = C.mk('Soft', 'UI', 0, 0, 48, true);
  M.logoGlow2 = C.mk('Soft', 'UI', 0, 0, 48, true);
  M.tA = C.mk('TitlePhantom', 'UI', 0, 0, 50, true); M.tB = C.mk('TitlePhoton', 'UI', 0, 0, 50, true);
  M.tag = C.mk('SubText', 'UI', 0, 0, 52); M.tag.setString('A PUZZLE OF LIGHT');
  M.foot = C.mk('SubText', 'UI', 0, 0, 52);
  const [g1, o1] = LIB.shardsIn(0); const done = Object.keys(LIB.prog.done).length;
  M.foot.setString(done ? ('PROGRESS  ' + done + ' LEVELS CLEARED') : 'SWIPE  ·  ARROWS  ·  TAP');
  M.play = C.button({ kind: 'big', label: 'PLAY', color: '120;240;255', delay: 0.55, name: 'play', poolLayer: '',
    onPress: () => { M.leaving = 0; C.go('LevelSelect', 'zoom', { dur: 0.95 }); } });
  C.defaultFocus = M.play; C.focus = M.play.id;
  window.__ppMenu = M; window.__ppC = C; window.__ppScene = runtimeScene; window.__PPLib = LIB;
  // pre-warm with a few photons already in flight
  M.prewarm = true;
}
const dt = C.rdt, UW = C.UW, UH = C.UH;
// ---------------------------------------------------------------- layout
const bx = UW / 2, by = C.portrait ? UH * 0.53 : UH * 0.55;
M.bx = bx; M.by = by;
const bhS = C.portrait ? 0.62 : 0.55;
const GM = 1.05e7, SWALLOW = 24, SOFT = 900;
// ---------------------------------------------------------------- photons
function spawnPhoton(warm) {
  if (M.photons.length >= 16) return;
  const edge = Math.floor(rand(0, 4)), m = 40;
  let x, y; if (edge === 0) { x = -m; y = rand(0, UH); } else if (edge === 1) { x = UW + m; y = rand(0, UH); } else if (edge === 2) { x = rand(0, UW); y = -m; } else { x = rand(0, UW); y = UH + m; }
  const toB = Math.atan2(by - y, bx - x), b = rand(-1, 1) * Math.min(UW, UH) * 0.42, d = Math.hypot(bx - x, by - y);
  const ang = toB + Math.atan2(b, d), v = rand(260, 420);
  const color = LIB.PALETTE[Math.floor(rand(0, LIB.PALETTE.length))];
  const head = C.mk('SparkW', '', x, y, 30, true), halo = C.mk('Soft', '', x, y, 29, true);
  head.setColor(color); halo.setColor(color);
  const p = { a0: ang, x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, color, head, halo, lx: x, ly: y, s: rand(0.8, 1.3), minR: 1e9, age: 0, ph: rand(0, 6) };
  M.photons.push(p);
  if (warm) { for (let k = 0; k < 40; k++) stepPhoton(p, 1 / 60); p.lx = p.x; p.ly = p.y; }
}
function stepPhoton(p, h) {
  const dx = bx - p.x, dy = by - p.y, r2 = dx * dx + dy * dy + SOFT, r = Math.sqrt(r2);
  const a = GM * M.zoomPull / r2;
  p.vx += dx / r * a * h; p.vy += dy / r * a * h;
  const sp = Math.hypot(p.vx, p.vy), cap = 1400; if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
  p.x += p.vx * h; p.y += p.vy * h; p.age += h; p.minR = Math.min(p.minR, r);
}
M.zoomPull = C.trans ? 1 + 6 * clamp(C.trans.t / C.trans.dur, 0, 1) : 1;
if (M.prewarm) { M.prewarm = false; for (let k = 0; k < 7; k++) spawnPhoton(true); }
M.spawnT -= dt; if (M.spawnT <= 0) { spawnPhoton(false); M.spawnT = rand(0.18, 0.42); }
for (let k = M.photons.length - 1; k >= 0; k--) {
  const p = M.photons[k];
  const sub = 4; for (let s = 0; s < sub; s++) stepPhoton(p, dt / sub);
  const r = Math.hypot(bx - p.x, by - p.y);
  // trail: dense additive dots along the path
  const dist = Math.hypot(p.x - p.lx, p.y - p.ly), stepD = 9;
  for (let s = stepD; s <= dist; s += stepD) {
    const u = s / dist;
    C.part('TrailW', '', lerp(p.lx, p.x, u), lerp(p.ly, p.y, u), { life: 0.5, s0: 0.42 * p.s, s1: 0.03, drag: 0, a0: 190, z: 25, color: p.color, lin: true });
  }
  if (dist >= stepD) { p.lx = p.x; p.ly = p.y; }
  p.head.setPosition(p.x, p.y); p.head.setScale(0.9 * p.s * (1 + 0.15 * Math.sin(C.time * 9 + p.ph)));
  p.halo.setPosition(p.x, p.y); p.halo.setScale(0.32 * p.s); p.halo.setOpacity(150);
  if (r < SWALLOW) {   // swallowed: tiny implode flash
    M.swallowed++; M.pulse = Math.min(1.4, M.pulse + 0.7);
    C.part('RingW', '', bx, by, { life: 0.35, s0: 0.5, s1: 0.02, drag: 0, color: p.color, z: 12, a0: 255 });
    C.part('Soft', '', bx, by, { life: 0.25, s0: 0.5, s1: 0.1, drag: 0, color: '255;255;255', z: 12, a0: 220 });
    for (let q = 0; q < 8; q++) { const a = rand(0, 6.28), rr = rand(20, 50); C.part('SparkW', '', bx + Math.cos(a) * rr, by + Math.sin(a) * rr, { life: 0.4, s0: 0.5, s1: 0, drag: 2, sink: [bx, by], color: p.color, z: 12 }); }
    C.del(p.head); C.del(p.halo); M.photons.splice(k, 1); continue;
  }
  if (p.x < -160 || p.x > UW + 160 || p.y < -160 || p.y > UH + 160) {
    if (p.minR < 150) M.slung++;
    let da = Math.abs(Math.atan2(p.vy, p.vx) - p.a0); if (da > Math.PI) da = 2 * Math.PI - da; if (da > 0.35) M.bent = (M.bent || 0) + 1;
    C.del(p.head); C.del(p.halo); M.photons.splice(k, 1);
  }
}
C.updateParts(dt);
// ---------------------------------------------------------------- black hole
M.pulse = Math.max(0, M.pulse - dt * 1.8);
const B = M.bh;
B.disk.setAngle(C.time * 140); B.swirl.setAngle(C.time * 40); B.range.setAngle(-C.time * 6);
for (const k of ['range', 'swirl', 'glow', 'disk', 'core']) B[k].setPosition(bx, by);
B.disk.setScale(bhS * (1 + 0.05 * Math.sin(C.time * 6) + 0.25 * M.pulse)); B.core.setScale(bhS * (1 + 0.25 * M.pulse));
B.swirl.setScale(bhS * 1.0); B.swirl.setOpacity(190); B.range.setScale(bhS * 1.15); B.range.setOpacity(90);
B.glow.setScale(bhS * 1.1 * (1 + 0.15 * Math.sin(C.time * 1.7) + 0.5 * M.pulse)); B.glow.setOpacity(200);
B.halo.setPosition(bx, by); B.halo.setScale(bhS * 2.4); B.halo.setOpacity(35 + 60 * M.pulse);
C.updateMotes(dt, UW, UH, [[bx, by, 260]]);
// ---------------------------------------------------------------- cameras (world == UI units), zoom into the hole when leaving
const [shx, shy] = C.shakeOffset();
const tz = C.trans ? clamp(C.trans.t / C.trans.dur, 0, 1) : 0;
const z = 1 + 5 * Math.pow(tz, 2.4);
const camX = lerp(UW / 2, bx, ease(tz * 1.4)) + shx, camY = lerp(UH / 2, by, ease(tz * 1.4)) + shy;
for (const ln of ['', 'Bg']) { const l = runtimeScene.getLayer(ln); l.setCameraZoom(C.uiS * z); l.setCameraX(camX); l.setCameraY(camY); }
C.bgT.setPosition(-2112, -2112);
C.neb.setPosition(bx, by); C.neb.setScale(Math.max(UW, UH) / 512 * 1.6); C.neb.setAngle(C.time * 2); C.neb.setOpacity(160);
const bgL = runtimeScene.getLayer('Bg');
const sx = (bx - camX) * C.uiS * z + C.rw / 2, sy = (by - camY) * C.uiS * z + C.rh / 2;
bgL.setEffectDoubleParameter('Lens', 'centerX', sx / C.rw); bgL.setEffectDoubleParameter('Lens', 'centerY', sy / C.rh);
bgL.setEffectDoubleParameter('Lens', 'radius', 210 * C.uiS * z); bgL.setEffectDoubleParameter('Lens', 'strength', -0.6 - 0.25 * M.pulse - 0.3 * tz);
// ---------------------------------------------------------------- logo: big, flickering neon with a slow pulse
M.logoIn = Math.min(1, M.logoIn + dt / 0.8);
M.nextStutter -= dt; if (M.nextStutter <= 0) { M.stutter = rand(0.18, 0.4); M.nextStutter = rand(2.2, 5); M.stutterWho = Math.random() < 0.5 ? 0 : 1; }
M.stutter = Math.max(0, M.stutter - dt);
const flickA = M.stutter > 0 && M.stutterWho === 0 ? (Math.random() < 0.55 ? 0.25 : 1) : 1;
const flickB = M.stutter > 0 && M.stutterWho === 1 ? (Math.random() < 0.55 ? 0.25 : 1) : 1;
const pulse = 1 + 0.025 * Math.sin(C.time * 2.2);
const tS = Math.min(C.portrait ? 0.66 : 0.5, (UW - 50) / 990, UH / 1500) * pulse * (0.7 + 0.3 * LIB.easeBack(M.logoIn));
const tA = M.tA, tB = M.tB; tA.setScale(tS); tB.setScale(tS);
const ty = C.portrait ? UH * 0.17 : UH * 0.15;
tA.setPosition(UW / 2 - tA.getWidth() / 2, ty - tA.getHeight() * 0.80);
tB.setPosition(UW / 2 - tB.getWidth() / 2, ty - tB.getHeight() * 0.18);
const base = 0.88 + 0.12 * Math.sin(C.time * 23) * Math.sin(C.time * 7.3);
tA.setOpacity(255 * M.logoIn * base * flickA); tB.setOpacity(255 * M.logoIn * (0.92 + 0.08 * Math.sin(C.time * 17)) * flickB);
M.logoGlow.setColor('40;200;255'); M.logoGlow.setPosition(UW / 2, tA.getY() + tA.getHeight() / 2); M.logoGlow.setScaleX(tS * 6); M.logoGlow.setScaleY(tS * 1.8); M.logoGlow.setOpacity(38 * flickA * M.logoIn * (0.8 + 0.2 * Math.sin(C.time * 2.2)));
M.logoGlow2.setColor('255;50;200'); M.logoGlow2.setPosition(UW / 2, tB.getY() + tB.getHeight() / 2); M.logoGlow2.setScaleX(tS * 6); M.logoGlow2.setScaleY(tS * 1.8); M.logoGlow2.setOpacity(38 * flickB * M.logoIn * (0.8 + 0.2 * Math.sin(C.time * 2.2 + 1)));
M.tag.setPosition(UW / 2 - M.tag.getWidth() / 2, tB.getY() + tB.getHeight() * 0.86); M.tag.setOpacity(200 * M.logoIn);
// ---------------------------------------------------------------- PLAY button + footer
M.play.x = UW / 2; M.play.y = C.portrait ? UH * 0.82 : UH * 0.84; M.play.scale = C.portrait ? 1 : 0.85;
C.updateButtons(dt);
M.foot.setPosition(UW / 2 - M.foot.getWidth() / 2, M.play.y + 95 * M.play.scale); M.foot.setOpacity(150 * clamp((C.time - 1) * 2, 0, 1));
C.updateTrans(dt);
