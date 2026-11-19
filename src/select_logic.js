// ============================================================================
// Phantom Photon - LEVEL SELECT: chapter cards (swipe / arrows / keys), level nodes
// (locked / unlocked / completed + shards), back to menu, play a level.
// ============================================================================
const C = LIB.ctx(runtimeScene); C.frame();
const { rand, lerp, clamp, ease } = LIB;
const CH = LIB.CHAPTERS;
let S = runtimeScene.__sel;
const THEME = [
  { color: '120;240;255', node: '120;240;255', done: '120;255;170', frame: '90;220;255' },
  { color: '160;130;255', node: '170;140;255', done: '120;255;200', frame: '130;100;255' },
];
if (!S) {
  S = runtimeScene.__sel = { cur: clamp(LIB.nav.chapter || 0, 0, CH.length - 1), pos: 0, drag: 0, dragging: false, cards: [], toastT: 0, wig: 0 };
  S.pos = S.cur;
  C.bg(36);
  C.buttonNav = false; C.modalKeys = true;      // this scene drives keyboard focus itself
  S.head = C.mk('HeadText', 'UI', 0, 0, 80); S.head.setString('SELECT LEVEL');
  S.back = C.button({ kind: 'round', icon: 'IcBack', color: '120;240;255', delay: 0.1, name: 'back', pool: false, onPress: () => C.go('Menu', 'fade', { dur: 0.45 }) });
  S.left = C.button({ kind: 'round', icon: 'IcLeft', color: '150;200;255', delay: 0.2, name: 'prev', pool: false, onPress: () => switchTo(S.cur - 1, 'arrow') });
  S.right = C.button({ kind: 'round', icon: 'IcRight', color: '150;200;255', delay: 0.25, name: 'next', pool: false, onPress: () => switchTo(S.cur + 1, 'arrow') });
  S.left.scale = S.right.scale = 0.8; S.back.scale = 0.8;
  S.toast = C.mk('ToastText', 'UI', 0, 0, 120); S.toast.setOpacity(0);
  CH.forEach((ch, c) => {
    const th = THEME[c % THEME.length], unlocked = LIB.chapterUnlocked(c);
    const card = { c, th, unlocked, frame: C.mk('Card', 'UI', 0, 0, 60), glow: C.mk('Soft', 'UI', 0, 0, 59, true),
      small: C.mk('SubText', 'UI', 0, 0, 62), name: C.mk('ChapterText', 'UI', 0, 0, 62), sub: C.mk('SubText', 'UI', 0, 0, 62),
      shardIc: C.mk('ShardIcon', 'UI', 0, 0, 62, true), shardTx: C.mk('ShardText', 'UI', 0, 0, 62),
      lock: C.mk('IcLock', 'UI', 0, 0, 90, true), lockTx: C.mk('SubText', 'UI', 0, 0, 90), nodes: [], links: [] };
    card.frame.setColor(th.frame); card.glow.setColor(th.color);
    card.small.setString('CHAPTER ' + (c + 1)); card.name.setString(ch.name.toUpperCase()); card.sub.setString(ch.sub || '');
    card.lockTx.setString('Finish ' + CH[Math.max(0, c - 1)].name + ' to unlock');
    const [g, o] = LIB.shardsIn(c); card.shardTx.setString(g + ' / ' + o);
    ch.levels.forEach((lv, l) => {
      const done = LIB.isDone(c, l), open = LIB.levelUnlocked(c, l), rec = LIB.prog.done[LIB.id(c, l)];
      const nShards = lv.map.join('').split('*').length - 1;
      const b = C.button({ kind: 'round', label: open ? String(l + 1) : null, icon: open ? (done ? 'IcCheck' : null) : 'IcLock',
        color: !open ? '95;105;140' : (done ? th.done : th.node), delay: 0.3 + l * 0.07 + Math.abs(c - S.cur) * 0.0, name: 'node ' + (c + 1) + '-' + (l + 1), pool: false,
        onPress: (bb) => pick(c, l, bb) });
      b.c = c; b.l = l; b.open = open; b.dim = open ? 1 : 0.45; b.done = done; b.icS = done ? 0.42 : 0.62; b.icDx = 0;
      b.pips = []; for (let k = 0; k < nShards; k++) { const pp = C.mk('ShardIcon', 'UI', 0, 0, 75, true); b.pips.push(pp); }
      b.got = rec ? rec.shards : 0; b.lvName = lv.name;
      b.nameTx = C.mk('NodeText', 'UI', 0, 0, 75); b.nameTx.setString(lv.name.toUpperCase());
      card.nodes.push(b);
    });
    for (let l = 0; l + 1 < ch.levels.length; l++) { const dots = []; for (let k = 0; k < 6; k++) dots.push(C.mk('SparkW', 'UI', 0, 0, 64, true)); card.links.push(dots); }
    S.cards.push(card);
  });
  S.dots = CH.map(() => C.mk('NodeFill', 'UI', 0, 0, 80, true));
  // initial keyboard focus: the first unlocked-but-not-done level of the current chapter
  const nodes = S.cards[S.cur].nodes; S.focusNode = (nodes.find((b) => b.open && !b.done) || nodes.find((b) => b.open) || nodes[0]);
  if (LIB.nav.from === 'game' && S.cards[S.cur].nodes[LIB.nav.level]) S.focusNode = S.cards[S.cur].nodes[LIB.nav.level];
  window.__ppSel = S; window.__ppC = C; window.__ppScene = runtimeScene; window.__PPLib = LIB;
}
function showToast(t, color) { S.toast.setString(t); S.toast.setColor(color || '255;140;220'); S.toastT = 1.6; }
function switchTo(c, src) {
  if (c < 0 || c >= CH.length) { S.wig = 1; C.shake = Math.max(C.shake, 3); return; }
  if (c !== S.cur) { S.cur = c; C.log.push('chapter ' + (c + 1) + ' ' + (src || '')); for (const b of S.cards[c].nodes) { b.sv += 6; b.flare = 0.6; } C.shake = Math.max(C.shake, 2.5);
    const nodes = S.cards[c].nodes; S.focusNode = nodes.find((b) => b.open && !b.done) || nodes[0];
    if (!LIB.chapterUnlocked(c)) showToast('LOCKED', '200;180;255'); }
}
function pick(c, l, b) {
  if (c !== S.cur) { switchTo(c, 'node'); return; }
  if (!LIB.levelUnlocked(c, l)) {
    b.wobT = 0.45; C.shake = Math.max(C.shake, 5); C.log.push('locked ' + (c + 1) + '-' + (l + 1));
    showToast(LIB.chapterUnlocked(c) ? 'CLEAR LEVEL ' + l + ' FIRST' : 'FINISH ' + CH[c - 1].name.toUpperCase() + ' TO UNLOCK', '200;180;255');
    return;
  }
  LIB.nav.chapter = c; LIB.nav.level = l; LIB.nav.from = 'select';
  C.go('Game', 'flash', { dur: 0.45 });
}
const dt = C.rdt, UW = C.UW, UH = C.UH, P = C.ptr;
// ---------------------------------------------------------------- keyboard
if (!C.trans) {
  const fn = S.focusNode;
  if (C.key(C.K.L) || C.key(C.K.R) || C.key(C.K.U) || C.key(C.K.D)) {
    C.keyNav = true;
    const dir = (C.key(C.K.L) || C.key(C.K.U)) ? -1 : 1;
    const all = []; S.cards.forEach((cd) => all.push(...cd.nodes));
    let k = all.indexOf(fn) + dir;
    if (k >= 0 && k < all.length) { S.focusNode = all[k]; if (all[k].c !== S.cur) switchTo(all[k].c, 'key'); S.focusNode = all[k]; all[k].sv += 4; all[k].flare = 0.5; }
    else { S.wig = 1; }
  }
  if (C.key([33]) || C.key([81])) switchTo(S.cur - 1, 'key');   // PageUp / Q
  if (C.key([34]) || C.key([69])) switchTo(S.cur + 1, 'key');   // PageDown / E
  if (C.key(C.K.OK) && S.focusNode) { const b = S.focusNode; b.press = true; b.pressKeyT = 0.09; }
  if (C.key(C.K.BACK)) { S.back.press = true; S.back.pressKeyT = 0.09; }
}
for (const cd of S.cards) for (const b of cd.nodes) if (b.pressKeyT !== undefined && b.c !== S.cur) { b.pressKeyT = undefined; b.press = false; }
C.focus = S.focusNode ? S.focusNode.id : -1;
// ---------------------------------------------------------------- swipe / drag between chapters
const onBtn = C.buttons.some((b) => b.visible && C.hit(b, P.x0, P.y0));
if (P.pressed) S.dragging = !C.trans;
if (S.dragging && P.down) {
  const dx = P.x - P.x0, dy = P.y - P.y0;
  if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) S.drag = dx; else if (Math.abs(dx) <= 12) S.drag = 0;
  const atEnd = (S.cur === 0 && S.drag > 0) || (S.cur === CH.length - 1 && S.drag < 0);
  if (atEnd) S.drag *= 0.35;
}
if (S.dragging && P.released) {
  const dx = P.x - P.x0, vt = Math.max(0.05, C.time - P.t0);
  if (Math.abs(dx) > 90 || (Math.abs(dx) > 40 && Math.abs(dx) / vt > 700)) { C.log.push('swipe ' + (dx < 0 ? 'L' : 'R')); switchTo(S.cur + (dx < 0 ? 1 : -1), 'swipe'); }
  S.dragging = false; S.drag = 0;
}
if (!P.down) S.drag = lerp(S.drag, 0, 1 - Math.pow(0.0001, dt));
S.pos = lerp(S.pos, S.cur, 1 - Math.pow(0.0004, dt));
S.wig = Math.max(0, S.wig - dt * 3);
// ---------------------------------------------------------------- layout
const cardW = C.portrait ? Math.min(UW - 60, 640) : Math.min(UW - 300, 1000);
const cardH = C.portrait ? Math.min(UH - 330, 900) : Math.min(UH - 190, 560);
const spacing = cardW + 90, cy = C.portrait ? UH * 0.5 + 10 : UH * 0.5 + 30;
S.head.setPosition(UW / 2 - S.head.getWidth() / 2, C.portrait ? 64 : 26);
S.back.x = 58; S.back.y = C.portrait ? 92 : 50;
if (C.portrait) { S.left.x = UW / 2 - 150; S.right.x = UW / 2 + 150; S.left.y = S.right.y = Math.min(UH - 70, cy + cardH / 2 + 80); }
else { S.left.x = UW / 2 - cardW / 2 - 75; S.right.x = UW / 2 + cardW / 2 + 75; S.left.y = S.right.y = cy; }
S.left.enabled = S.cur > 0; S.right.enabled = S.cur < CH.length - 1;
const wigX = Math.sin(C.time * 60) * 10 * S.wig;
S.cards.forEach((cd, c) => {
  const x = UW / 2 + (c - S.pos) * spacing + S.drag + wigX, dist = Math.abs(c - S.pos);
  const vis = dist < 1.2;
  const a = clamp(1 - dist * 0.65, 0, 1), sc = 1 - Math.min(0.12, dist * 0.12);
  cd.frame.setWidth(cardW * sc); cd.frame.setHeight(cardH * sc); cd.frame.setPosition(x - cardW * sc / 2, cy - cardH * sc / 2);
  cd.frame.setOpacity(255 * a * (cd.unlocked ? 1 : 0.75));
  cd.glow.setPosition(x, cy); cd.glow.setScaleX(cardW / 256 * 1.3 * sc); cd.glow.setScaleY(cardH / 256 * 1.2 * sc);
  cd.glow.setOpacity(a * (cd.c === 1 ? 22 : 28) * (0.8 + 0.2 * Math.sin(C.time * 1.6 + c)));
  const top = cy - cardH * sc / 2;
  cd.small.setPosition(x - cd.small.getWidth() / 2, top + 26 * sc); cd.small.setOpacity(200 * a);
  cd.name.setScale(sc); cd.name.setPosition(x - cd.name.getWidth() / 2, top + 50 * sc); cd.name.setOpacity(255 * a);
  cd.sub.setPosition(x - cd.sub.getWidth() / 2, top + 50 * sc + cd.name.getHeight() + 2); cd.sub.setOpacity(180 * a);
  cd.shardTx.setPosition(x - cd.shardTx.getWidth() / 2 + 12, top + cardH * sc - 46 * sc); cd.shardTx.setOpacity(220 * a * (cd.unlocked ? 1 : 0.4));
  cd.shardIc.setScale(0.3); cd.shardIc.setPosition(x - cd.shardTx.getWidth() / 2 - 8, top + cardH * sc - 46 * sc + cd.shardTx.getHeight() / 2); cd.shardIc.setOpacity(255 * a * (cd.unlocked ? 1 : 0.4));
  // nodes along a snake path
  const n = cd.nodes.length, cols = C.portrait ? 2 : 3, rows = Math.ceil(n / cols);
  const areaT = top + 150 * sc, areaB = top + cardH * sc - 80 * sc, areaW = cardW * sc * (C.portrait ? 0.62 : 0.72);
  const rowH = (areaB - areaT) / rows;
  const pos = [];
  cd.nodes.forEach((b, l) => {
    const r = Math.floor(l / cols); let k = l % cols; if (r % 2 === 1) k = cols - 1 - k;
    const offset = (r % 2 ? -1 : 1) * (C.portrait ? 0 : 0);
    const nx = x - areaW / 2 + (cols === 1 ? areaW / 2 : k * areaW / (cols - 1)) + offset, ny = areaT + rowH * (r + 0.42);
    pos.push([nx, ny]);
    b.wobT = Math.max(0, (b.wobT || 0) - dt);
    b.x = nx + Math.sin(b.wobT * 50) * 9 * (b.wobT / 0.45); b.y = ny; b.scale = sc * Math.min(1, rowH / 190) * (C.portrait ? 1.05 : 0.95);
    b.visible = vis; b.enabled = vis;
    const pip = 18 * b.scale, nP = b.pips.length;
    b.pips.forEach((pp, k2) => { pp.setScale(0.24 * b.scale); pp.setPosition(nx + (k2 - (nP - 1) / 2) * pip * 1.3, ny + 66 * b.scale);
      pp.setOpacity(a * 255 * (k2 < b.got ? 1 : 0.22)); pp.setColor(k2 < b.got ? '255;255;255' : '120;120;160'); });
    b.nameTx.setScale(b.scale); b.nameTx.setPosition(nx - b.nameTx.getWidth() / 2, ny + 82 * b.scale); b.nameTx.setOpacity(a * (b.open ? 200 : 90));
  });
  cd.links.forEach((dots, l) => {
    const [x0, y0] = pos[l], [x1, y1] = pos[l + 1], lit = cd.nodes[l].done, flow = (C.time * 0.6) % 1;
    dots.forEach((o, k) => { const u = (k + 1) / (dots.length + 1);
      const uu = 0.18 + u * 0.64; o.setPosition(lerp(x0, x1, uu), lerp(y0, y1, uu));
      const hot = lit ? Math.max(0, 1 - Math.abs(((uu - flow) + 1) % 1 - 0.5) * 4) : 0;
      o.setScale(0.45 * sc * (1 + 0.5 * hot)); o.setColor(lit ? cd.th.done : '90;100;140'); o.setOpacity(a * (lit ? 140 + 110 * hot : 70)); });
  });
  cd.lock.setPosition(x, cy + 10); cd.lock.setScale(1.3 * sc * (1 + 0.04 * Math.sin(C.time * 3))); cd.lock.setColor('200;180;255');
  cd.lock.setOpacity(cd.unlocked ? 0 : 255 * a);
  cd.lockTx.setPosition(x - cd.lockTx.getWidth() / 2, cy + 70); cd.lockTx.setOpacity(cd.unlocked ? 0 : 230 * a);
});
S.dots.forEach((o, c) => { o.setPosition(UW / 2 + (c - (CH.length - 1) / 2) * 30, C.portrait ? S.left.y : cy + cardH / 2 + 40); o.setScale(c === S.cur ? 0.22 : 0.14);
  o.setColor(c === S.cur ? THEME[c].color : '90;100;140'); o.setOpacity(255); });
C.updateButtons(dt);
C.updateParts(dt);
// ---------------------------------------------------------------- background
const [shx, shy] = C.shakeOffset();
for (const ln of ['', 'Bg']) { const l = runtimeScene.getLayer(ln); l.setCameraZoom(C.uiS); l.setCameraX(UW / 2 + shx + S.pos * 40); l.setCameraY(UH / 2 + shy); }
C.neb.setPosition(UW / 2 + S.pos * 40, UH / 2); C.neb.setScale(Math.max(UW, UH) / 512 * 1.6);
const dark = lerp(0, 1, clamp(S.pos, 0, 1));
C.neb.setOpacity(150 * (1 - 0.6 * dark)); C.bgT.setOpacity(255 * (1 - 0.55 * dark));
C.updateMotes(dt, UW + 100, UH, []);
runtimeScene.getLayer('Bg').enableEffect('Lens', false);
S.toastT = Math.max(0, S.toastT - dt); S.toast.setOpacity(255 * Math.min(1, S.toastT * 3)); S.toast.setPosition(UW / 2 - S.toast.getWidth() / 2, C.portrait ? 140 : UH - 70);
C.updateTrans(dt);
