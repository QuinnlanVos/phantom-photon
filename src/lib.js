// ============================================================================
// Phantom Photon - shared runtime library (created once, stored on gdjs.__PPLib).
// Used by all three scenes: Menu, LevelSelect, Game.
// progress (localStorage), navigation, per-scene context: resolution, UI layer, input,
// particles (capped), juicy neon buttons, scene transitions.
// ============================================================================
const LIB = {};
LIB.CHAPTERS = %CHAPTERS%;
LIB.ART = %ART%;
LIB.PALETTE = ['120;240;255', '255;90;210', '180;120;255', '120;255;170', '255;210;90', '255;140;80'];
const KEY = 'phantomPhoton.progress.v1';
const qs = (typeof location !== 'undefined') ? new URLSearchParams(location.search) : new URLSearchParams('');
LIB.qs = qs;
LIB.debugUnlock = qs.has('unlock');
// Lite mode (?lite, or no WebGL): turn off bloom / lens / lighting so a weak or odd GPU never shows a black screen.
LIB.lite = qs.has('lite');
LIB.prog = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || { done: {} }; } catch (e) { return { done: {} }; } })();
if (!LIB.prog.done) LIB.prog.done = {};
LIB.save = () => { try { localStorage.setItem(KEY, JSON.stringify(LIB.prog)); } catch (e) {} };
LIB.id = (c, l) => (c + 1) + '-' + (l + 1);
LIB.isDone = (c, l) => !!LIB.prog.done[LIB.id(c, l)];
LIB.chapterDone = (c) => LIB.CHAPTERS[c].levels.every((_, l) => LIB.isDone(c, l));
// a chapter stays open once the player has cleared any level in it (new levels added to an earlier chapter never re-lock it)
LIB.chapterUnlocked = (c) => LIB.debugUnlock || c === 0 || LIB.chapterDone(c - 1) || LIB.CHAPTERS[c].levels.some((_, l) => LIB.isDone(c, l));
LIB.levelUnlocked = (c, l) => LIB.chapterUnlocked(c) && (LIB.debugUnlock || l === 0 || LIB.isDone(c, l - 1) || LIB.isDone(c, l));
LIB.complete = (c, l, shards, of, moves) => {
  const id = LIB.id(c, l), prev = LIB.prog.done[id];
  LIB.prog.done[id] = { shards: Math.max(shards, prev ? prev.shards : 0), of, moves: prev ? Math.min(prev.moves || 999, moves) : moves };
  LIB.save();
};
LIB.shardsIn = (c) => { let got = 0, of = 0; LIB.CHAPTERS[c].levels.forEach((lv, l) => { const n = lv.map.join('').split('*').length - 1; of += n; const d = LIB.prog.done[LIB.id(c, l)]; if (d) got += d.shards; }); return [got, of]; };
LIB.nav = gdjs.__ppNav || (gdjs.__ppNav = { chapter: 0, level: 0, from: null });
LIB.globalIndex = (c, l) => { let k = 0; for (let i = 0; i < c; i++) k += LIB.CHAPTERS[i].levels.length; return k + l; };

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = (t) => { t = clamp(t, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
Object.assign(LIB, { rand, lerp, clamp, ease, easeBack });

// ---------------------------------------------------------------- per-scene context
LIB.ctx = function (scene) {
  if (scene.__ppC) return scene.__ppC;
  const game = scene.getGame(), im = game.getInputManager();
  const C = scene.__ppC = { scene, game, im, time: 0, rdt: 0, parts: [], buttons: [], shake: 0, focus: -1, keyNav: false,
                             ptr: { x: -999, y: -999, down: false, pressed: false, released: false, x0: 0, y0: 0, t0: 0, moved: 0 }, trans: null, log: [] };
  C.mk = (name, layer, x, y, z, add) => {
    const o = scene.createObject(name); if (!o) return null;
    o.setLayer(layer || ''); o.setPosition(x || 0, y || 0); if (z !== undefined) o.setZOrder(z);
    if (add && o.setBlendMode) o.setBlendMode(1);
    return o;
  };
  C.del = (o) => { if (o) o.deleteFromScene(scene); };
  // --- resolution: fill the window at up to ~2.2 MP, UI layer in "720 units" on the short side
  C.fit = () => {
    if (typeof window !== 'undefined') {
      const cw = window.innerWidth || 800, ch = window.innerHeight || 600, dpr = Math.min(window.devicePixelRatio || 1, 2);
      let h = Math.round(Math.min(ch * dpr, Math.sqrt(2.2e6 * ch / cw))); h = Math.max(480, h);
      const key = cw + 'x' + ch + ':' + h;
      if (key !== C.resKey) { C.resKey = key; game.setGameResolutionSize(Math.round(h * cw / ch), h); }
    }
    C.rw = game.getGameResolutionWidth(); C.rh = game.getGameResolutionHeight();
    C.uiS = Math.min(C.rw, C.rh) / 720; C.UW = C.rw / C.uiS; C.UH = C.rh / C.uiS; C.portrait = C.UH >= C.UW;
    const ui = scene.getLayer('UI'); ui.setCameraZoom(C.uiS); ui.setCameraX(C.UW / 2); ui.setCameraY(C.UH / 2);
  };
  // --- pointer (mouse, and touch which GDevelop mirrors onto the mouse) in UI units
  C.toUI = (cx, cy) => scene.getLayer('UI').convertCoords(cx, cy, 0);
  C.input = () => {
    const p = C.ptr, ui = scene.getLayer('UI');
    let down = im.isMouseButtonPressed(0), cx = im.getCursorX(), cy = im.getCursorY();
    const tids = im.getAllTouchIdentifiers();
    if (tids.length) { down = true; cx = im.getTouchX(tids[0]); cy = im.getTouchY(tids[0]); }
    const q = ui.convertCoords(cx, cy, 0);
    const moved = Math.hypot(q[0] - p.x, q[1] - p.y) > 0.5;
    if (moved && !down) C.keyNav = false;
    // a touch that starts this frame is always a fresh press, even if a previous touch was never seen to end
    // (WebKit can leave the old one 'down', which swallowed the first tap on RETRY after a swipe)
    const sids = im.getStartedTouchIdentifiers(), sid = sids.length ? sids[sids.length - 1] : null;
    const fresh = down && p.down && sid !== null && sid !== p.sid;
    if (sid !== null) p.sid = sid;
    p.x = q[0]; p.y = q[1]; p.pressed = (down && !p.down) || fresh; p.released = !down && p.down; p.down = down;
    if (p.pressed) { p.x0 = p.x; p.y0 = p.y; p.t0 = C.time; p.moved = 0; C.keyNav = false; }
    if (down) p.moved = Math.max(p.moved, Math.hypot(p.x - p.x0, p.y - p.y0));
    // quick tap that began and ended between two frames (slow WebKit frames on iPhone): GDevelop still flags the
    // touchend/mouseup as a release for this frame, so treat it as a full press + release at the tap point
    if (!down && !p.released && !p.pressed && im.isMouseButtonReleased(0)) { p.pressed = p.released = true; p.x0 = p.x; p.y0 = p.y; p.t0 = C.time; p.moved = 0; C.keyNav = false; }
  };
  C.key = (codes) => codes.some((c) => im.wasKeyJustPressed(c));
  C.K = { L: [37, 65], R: [39, 68], U: [38, 87], D: [40, 83], OK: [13, 32], BACK: [27, 8] };
  // --- particles (one capped pool per scene)
  C.MAXP = 420;
  C.part = (name, layer, x, y, o) => {
    if (C.parts.length >= C.MAXP) { const old = C.parts.shift(); C.del(old.o); }
    const ob = C.mk(name, layer, x, y, o.z || 20, true); if (!ob) return null;
    if (o.color) ob.setColor(o.color);
    const p = Object.assign({ o: ob, x, y, vx: 0, vy: 0, life: 0.5, t: 0, s0: 0.5, s1: 0, a0: 255, drag: 3, sink: null, lin: false, grav: 0 }, o);
    ob.setScale(p.s0); C.parts.push(p); return p;
  };
  C.burst = (layer, x, y, n, color, spd, size, nx, ny) => {
    for (let k = 0; k < n; k++) {
      const dir = (nx || ny) ? Math.atan2(ny, nx) + rand(-1.2, 1.2) : rand(0, 6.28), v = rand(0.3, 1) * (spd || 400);
      C.part('SparkW', layer, x, y, { vx: Math.cos(dir) * v, vy: Math.sin(dir) * v, life: rand(0.3, 0.6), s0: rand(0.4, 0.8) * (size || 1), s1: 0, drag: 4.5, color, z: 60 });
    }
  };
  C.ripple = (layer, x, y, size, color, life) => C.part('RingW', layer, x, y, { life: life || 0.45, s0: 0.05, s1: size, drag: 0, color, z: 59, a0: 230 });
  C.updateParts = (dt) => {
    for (let k = C.parts.length - 1; k >= 0; k--) {
      const p = C.parts[k]; p.t += dt; const u = p.t / p.life;
      if (u >= 1) { C.del(p.o); C.parts.splice(k, 1); continue; }
      if (p.sink) { const dx = p.sink[0] - p.x, dy = p.sink[1] - p.y; p.vx += dx * 30 * dt - dy * 12 * dt; p.vy += dy * 30 * dt + dx * 12 * dt; }
      p.vy += p.grav * dt;
      p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt); p.x += p.vx * dt; p.y += p.vy * dt;
      p.o.setPosition(p.x, p.y); p.o.setScale(Math.max(0.001, lerp(p.s0, p.s1, p.lin ? u : ease(u)))); p.o.setOpacity(p.a0 * (1 - u * u));
    }
  };
  // --- juicy neon buttons (UI layer). opts: {w:'big'|'small'|'round', label, icon, color, x, y, delay, onPress}
  C.button = (opts) => {
    const kind = opts.kind || 'big', big = kind === 'big';
    const b = Object.assign({ kind, x: 0, y: 0, s: 0, sv: 0, sx: 1, sy: 1, sxv: 0, syv: 0, hover: 0, press: false, flare: 0, born: C.time, delay: 0,
                              enabled: true, visible: true, color: '120;240;255', scale: 1, wob: 0, id: C.buttons.length }, opts);
    const z = opts.z || 70;
    b.glow = C.mk(kind === 'round' ? 'BtnRoundGlow' : (big ? 'BtnGlow' : 'BtnGlowS'), 'UI', 0, 0, z, true);
    b.bg = C.mk(kind === 'round' ? 'BtnRound' : (big ? 'BtnPill' : 'BtnPillS'), 'UI', 0, 0, z + 1, true);
    b.lbl = opts.label ? C.mk(big ? 'BtnText' : 'BtnTextS', 'UI', 0, 0, z + 3) : null;
    if (b.lbl) b.lbl.setString(opts.label);
    b.ic = opts.icon ? C.mk(opts.icon, 'UI', 0, 0, z + 4, true) : null;
    b.pool = opts.pool !== false ? C.mk('Soft', opts.poolLayer || 'Bg', 0, 0, 50, true) : null;      // the button's light spilling onto the scene
    b.refl = (big && opts.reflect !== false) ? C.mk(kind === 'round' ? 'BtnRoundGlow' : 'BtnGlow', 'UI', 0, 0, z - 1, true) : null;   // mirror reflection under it
    b.hw = kind === 'round' ? 52 : (big ? 260 : 150); b.hh = kind === 'round' ? 52 : (big ? 65 : 50);
    C.buttons.push(b); return b;
  };
  C.hit = (b, x, y) => {
    const s = b.scale;
    if (b.kind === 'round') return Math.hypot(x - b.x, y - b.y) < (b.hw + 8) * s;
    return Math.abs(x - b.x) < (b.hw + 10) * s && Math.abs(y - b.y) < (b.hh + 10) * s;
  };
  C.activate = (b, src) => {
    b.sv += 9; b.sxv -= 6; b.syv += 6; b.flare = 1; C.shake = Math.max(C.shake, b.kind === 'big' ? 7 : 4);
    const S = b.scale;
    C.burst('UI', b.x, b.y, b.kind === 'big' ? 26 : 14, b.color, b.kind === 'big' ? 620 : 420, 1.1);
    C.ripple('UI', b.x, b.y, (b.kind === 'big' ? 2.5 : 1.6) * S, b.color, 0.55);
    C.ripple('UI', b.x, b.y, (b.kind === 'big' ? 2.2 : 1.3) * S, '255;255;255', 0.35);
    C.log.push('press ' + (b.name || b.label || b.icon) + ' ' + (src || ''));
    if (b.onPress) b.onPress(b, src);
  };
  C.updateButtons = (dt) => {
    const p = C.ptr;
    // keyboard focus
    const vis = C.buttons.filter((b) => b.visible && b.enabled && !b.noFocus);
    let navd = null;
    if (!C.trans && !C.modalKeys) for (const d of ['L', 'R', 'U', 'D']) if (C.key(C.K[d])) navd = d;
    if (navd && vis.length && C.buttonNav !== false) {
      C.keyNav = true;
      const cur = C.buttons[C.focus];
      if (!cur || !cur.visible || !cur.enabled || cur.noFocus) C.focus = (C.defaultFocus && C.defaultFocus.visible) ? C.defaultFocus.id : vis[0].id;
      else {
        const [dx, dy] = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }[navd];
        let best = null, bd = 1e9;
        for (const b of vis) { if (b === cur) continue; const vx = b.x - cur.x, vy = b.y - cur.y, along = vx * dx + vy * dy; if (along <= 4) continue;
          const d = along + Math.abs(vx * dy + vy * dx) * 2.5; if (d < bd) { bd = d; best = b; } }
        if (best) C.focus = best.id;
      }
      const f = C.buttons[C.focus]; if (f) { f.sv += 3; f.flare = Math.max(f.flare, 0.4); }
    }
    if (!C.trans && C.key(C.K.OK) && !C.modalKeys) {
      const f = C.buttons[C.focus] || (C.defaultFocus && C.defaultFocus.visible ? C.defaultFocus : null);
      if (f && f.visible && f.enabled) { f.press = true; f.pressKeyT = 0.09; C.focus = f.id; }
    }
    for (const b of C.buttons) {
      const age = C.time - b.born - b.delay;
      const S = b.scale;
      // staggered bouncy entrance
      const tgtS = !b.visible ? 0 : (age < 0 ? 0 : 1);
      const over = b.visible && (C.hit(b, p.x, p.y) && !C.trans && (p.down || !C.isTouch)) || (C.keyNav && C.focus === b.id);
      b.hover = lerp(b.hover, over ? 1 : 0, 1 - Math.pow(0.0005, dt));
      if (!C.trans && b.visible && b.enabled) {
        if (p.pressed && C.hit(b, p.x, p.y)) { b.press = true; b.pressPtr = true; b.sxv += 4; b.syv -= 4; }
        if (b.pressPtr && p.released) { b.press = false; b.pressPtr = false; if (C.hit(b, p.x, p.y) && p.moved < 40) C.activate(b, 'pointer'); }
        if (b.pressPtr && !C.hit(b, p.x, p.y) && p.moved > 40) { b.press = false; b.pressPtr = false; }
        if (b.pressKeyT !== undefined) { b.pressKeyT -= dt; if (b.pressKeyT <= 0) { b.pressKeyT = undefined; b.press = false; C.activate(b, 'key'); } }
      } else { b.press = false; b.pressPtr = false; }
      const pr = b.press ? 1 : 0;
      const tScale = tgtS * (1 + 0.07 * b.hover - 0.06 * pr);
      const tsx = 1 + 0.10 * pr, tsy = 1 - 0.12 * pr;               // press: squash wide/flat; release springs back with overshoot
      b.sv += ((tScale - b.s) * 260 - b.sv * 14) * dt; b.s += b.sv * dt;
      b.sxv += ((tsx - b.sx) * 420 - b.sxv * 16) * dt; b.sx += b.sxv * dt;
      b.syv += ((tsy - b.sy) * 420 - b.syv * 16) * dt; b.sy += b.syv * dt;
      b.flare = Math.max(0, b.flare - dt * 2.2);
      const breathe = 0.5 + 0.5 * Math.sin(C.time * 2.4 + b.id * 0.9);
      const sc = Math.max(0.001, b.s) * S, x = b.x, y = b.y + (b.rise || 0) * (1 - clamp(age / 0.5, 0, 1)) * 0;
      const half = b.kind === 'big' ? 0.5 : 0.5;
      b.bg.setScaleX(half * sc * b.sx); b.bg.setScaleY(half * sc * b.sy); b.bg.setPosition(x, y); b.bg.setColor(b.color);
      b.bg.setOpacity(b.visible ? (b.enabled ? 255 : 110) * (b.dim || 1) : 0);
      const ga = (b.enabled ? 1 : 0.35) * (0.45 + 0.25 * breathe + 0.35 * b.hover + 0.6 * b.flare + 0.3 * pr);
      b.glow.setPosition(x, y); b.glow.setScaleX(half * sc * b.sx * (1 + 0.08 * breathe + 0.25 * b.flare)); b.glow.setScaleY(half * sc * b.sy * (1 + 0.08 * breathe + 0.35 * b.flare));
      b.glow.setColor(b.color); b.glow.setOpacity(255 * clamp(ga * (b.dim || 1), 0, 1) * (b.visible ? 1 : 0));
      if (b.lbl) {
        b.lbl.setScaleX(sc * b.sx); b.lbl.setScaleY(sc * b.sy);
        b.lbl.setPosition(x - b.lbl.getWidth() / 2, y - b.lbl.getHeight() / 2 + 2 * sc);
        b.lbl.setOpacity(b.visible ? (b.enabled ? 255 : 120) : 0);
      }
      if (b.ic) { b.ic.setPosition(x + (b.icDx || 0) * sc, y); b.ic.setScaleX(0.5 * sc * b.sx * (b.icS || 1)); b.ic.setScaleY(0.5 * sc * b.sy * (b.icS || 1)); b.ic.setColor(b.icColor || '255;255;255'); b.ic.setOpacity(b.visible ? (b.enabled ? 255 : 110) : 0); }
      if (b.pool) {   // light pool cast on the scene behind (world layer shares UI units in menu/select)
        const wp = C.uiToWorld ? C.uiToWorld(x, y) : [x, y];
        b.pool.setPosition(wp[0], wp[1] + (b.poolDy || 0)); b.pool.setColor(b.color);
        b.pool.setScaleX(sc * (b.kind === 'big' ? 2.8 : 1.6) * (1 + 0.6 * b.flare)); b.pool.setScaleY(sc * (b.kind === 'big' ? 1.1 : 0.9) * (1 + 0.6 * b.flare));
        b.pool.setOpacity((b.visible ? 1 : 0) * 255 * clamp(0.07 + 0.05 * breathe + 0.12 * b.hover + 0.5 * b.flare, 0, 1));
      }
      if (b.refl) {   // faint mirrored reflection below the button, like neon on a glossy floor
        b.refl.setPosition(x, y + b.hh * 2.1 * sc); b.refl.setColor(b.color);
        b.refl.setScaleX(half * sc * b.sx * 1.05); b.refl.setScaleY(-half * sc * b.sy * 0.55);
        b.refl.setOpacity((b.visible ? 1 : 0) * 255 * clamp(0.10 + 0.08 * breathe + 0.12 * b.hover + 0.35 * b.flare, 0, 1));
      }
    }
  };
  // --- transitions: out (cover) -> change scene; the next scene starts covered and reveals
  C.cover = C.mk('Flash', 'UI', 0, 0, 200); C.cover.setColor('2;3;10');
  C.white = C.mk('Flash', 'UI', 0, 0, 201); C.white.setOpacity(0);
  const inn = gdjs.__ppTrans; gdjs.__ppTrans = null;
  C.reveal = { t: 0, dur: inn ? inn.revealDur || 0.5 : 0.45, white: inn ? inn.white || 0 : 0, kind: inn ? inn.kind : 'fade' };
  C.go = (target, kind, opts) => {
    if (C.trans) return;
    C.trans = Object.assign({ target, kind: kind || 'fade', t: 0, dur: 0.55 }, opts || {});
    C.log.push('go ' + target);
    try { window.__ppNavLog = (window.__ppNavLog || []).concat([target]); } catch (e) {}
  };
  C.updateTrans = (dt) => {
    const W = C.UW + 40, H = C.UH + 40;
    for (const o of [C.cover, C.white]) { o.setPosition(-20, -20); o.setWidth(W); o.setHeight(H); }
    let a = 0, wa = 0;
    if (C.reveal) {
      C.reveal.t += dt; const u = C.reveal.t / C.reveal.dur;
      a = 1 - ease(u); wa = C.reveal.white * Math.max(0, 1 - u * 1.6);
      if (u >= 1) C.reveal = null;
    }
    if (C.trans) {
      const T = C.trans; T.t += dt; const u = clamp(T.t / T.dur, 0, 1);
      if (T.kind === 'zoom') { a = Math.max(a, clamp((u - 0.55) / 0.45, 0, 1)); wa = Math.max(wa, clamp((u - 0.7) / 0.3, 0, 1) * 0.9); }
      else if (T.kind === 'flash') { wa = Math.max(wa, u); a = Math.max(a, u * 0.6); }
      else a = Math.max(a, ease(u));
      if (T.t >= T.dur + 0.04 && !T.fired) {
        T.fired = true;
        gdjs.__ppTrans = { kind: T.kind, white: T.kind === 'zoom' || T.kind === 'flash' ? 0.9 : 0, revealDur: T.kind === 'zoom' ? 0.7 : 0.45 };
        C.scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, T.target);
      }
    }
    C.cover.setOpacity(255 * clamp(a, 0, 1)); C.white.setOpacity(255 * clamp(wa, 0, 1));
  };
  C.isTouch = (typeof navigator !== 'undefined') && (navigator.maxTouchPoints > 0) && /Mobi|iPhone|Android|iPad/.test(navigator.userAgent || '');
  // --- shared animated background (Bg layer): grid, nebula, drifting motes
  C.bg = (count) => {
    C.bgT = C.mk('BgTile', 'Bg', -2112, -2112, 0); C.bgT.setWidth(4992); C.bgT.setHeight(4992);
    C.neb = C.mk('Nebula', 'Bg', 0, 0, 1, true);
    C.motes = [];
    for (let k = 0; k < (count || 40); k++) {
      const o = C.mk('Mote', 'Bg', 0, 0, 2, true);
      C.motes.push({ o, x: rand(0, 1400), y: rand(0, 1400), vx: rand(-6, 6), vy: rand(-12, -3), ph: rand(0, 6.28), s: rand(0.25, 0.8) });
    }
  };
  C.updateMotes = (dt, W, H, sinks) => {
    for (const m of C.motes) {
      m.ph += dt; m.x += m.vx * dt; m.y += m.vy * dt;
      for (const h of sinks || []) { const dx = h[0] - m.x, dy = h[1] - m.y, d = Math.hypot(dx, dy) || 1, R = h[2] || 220;
        if (d < R) { m.x += (dx / d * 50 - dy / d * 80) * dt * (1 - d / R); m.y += (dy / d * 50 + dx / d * 80) * dt * (1 - d / R); }
        if (d < 16) { m.x = rand(0, W); m.y = H + 40; } }
      if (m.y < -60) { m.y = H + 50; m.x = rand(-40, W + 40); }
      if (m.x < -80) m.x = W + 60; if (m.x > W + 80) m.x = -60;
      m.o.setPosition(m.x, m.y); m.o.setScale(m.s * 0.5); m.o.setOpacity(70 + 70 * Math.sin(m.ph * 1.3));
    }
  };
  // heavy-effects fallback: disable layer effects + darkness in lite mode or when the renderer isn't WebGL
  C.safeEffects = () => {
    try {
      const pr = game.getRenderer().getPIXIRenderer();
      if (!pr || pr.type !== 1) LIB.lite = true;
    } catch (e) { LIB.lite = true; }
    if (!LIB.lite) return;
    for (const ln of ['Bg', '', 'UI']) { try { const l = scene.getLayer(ln); for (const ef of ['Lens', 'Bloom', 'UiBloom']) if (l.hasEffect && l.hasEffect(ef)) l.enableEffect(ef, false); } catch (e) {} }
  };
  C.safeEffects();
  C.frame = () => {
    C.rdt = Math.min(0.05, scene.getElapsedTime() / 1000); C.time += C.rdt;
    C.fit(); C.input();
  };
  C.shakeOffset = () => {
    C.shake *= Math.exp(-10 * C.rdt); if (C.shake < 0.05) C.shake = 0;
    return [(Math.random() * 2 - 1) * C.shake, (Math.random() * 2 - 1) * C.shake];
  };
  try { window.__PPLib = LIB; } catch (e) {}
  return C;
};
return LIB;
