// Menu -> Level select -> Game flow test in headless Chrome (desktop mouse+keys, or phone touch).
// node test_flow.js <url> <desktop|phone|landscape> <outdir>
const p = require('/workspace/tools/gdexp/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url0, mode, outdir] = process.argv.slice(2);
const url = (q) => url0 + (url0.includes('?') ? '&' : '?') + q;
const VIEW = { desktop: [1280, 800, 1, false], phone: [390, 844, 3, true], landscape: [844, 390, 3, true] }[mode];
const touch = VIEW[3];
let fails = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
(async () => {
  const b = await p.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage();
  await pg.emulate({ viewport: { width: VIEW[0], height: VIEW[1], deviceScaleFactor: VIEW[2], isMobile: VIEW[3], hasTouch: VIEW[3] },
    userAgent: touch ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36' });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const shot = (n) => pg.screenshot({ path: `${outdir}/${mode}_${n}.png` });
  const scene = () => pg.evaluate(() => window.__ppScene && window.__ppScene.getName());
  const waitScene = async (name, ms) => { for (let k = 0; k < (ms || 8000) / 100; k++) { if (await scene() === name) { await sleep(300); return true; } await sleep(100); } return false; };
  // UI-unit point -> CSS px
  const css = (x, y) => pg.evaluate((x, y) => { const C = window.__ppC; return [x * C.uiS * innerWidth / C.rw, y * C.uiS * innerHeight / C.rh]; }, x, y);
  const btnPos = (expr) => pg.evaluate((e) => { const b = eval(e); return [b.x, b.y]; }, expr);
  const tapUI = async (x, y, holdShot) => {
    const [cx, cy] = await css(x, y);
    if (touch) { await pg.touchscreen.touchStart(cx, cy); await sleep(90); if (holdShot) await holdShot(); await pg.touchscreen.touchEnd(); }
    else { await pg.mouse.move(cx, cy, { steps: 4 }); await sleep(120); await pg.mouse.down(); await sleep(90); if (holdShot) await holdShot(); await pg.mouse.up(); }
  };
  const tapBtn = async (expr, holdShot) => { const [x, y] = await btnPos(expr); await tapUI(x, y, holdShot); };
  const swipeUI = async (x, y, dx, dy) => {
    const [cx, cy] = await css(x, y);
    if (touch) { await pg.touchscreen.touchStart(cx, cy); for (let k = 1; k <= 6; k++) { await pg.touchscreen.touchMove(cx + dx * k / 6, cy + dy * k / 6); await sleep(16); } await pg.touchscreen.touchEnd(); }
    else { await pg.mouse.move(cx, cy); await pg.mouse.down(); for (let k = 1; k <= 6; k++) { await pg.mouse.move(cx + dx * k / 6, cy + dy * k / 6); await sleep(16); } await pg.mouse.up(); }
  };
  const clog = () => pg.evaluate(() => window.__ppC ? window.__ppC.log.slice() : []);

  // ================================================================ MENU
  await pg.goto(url0); await pg.evaluate(() => localStorage.clear()); await pg.goto(url0); await sleep(3500);
  ok(await scene() === 'Menu', 'boots into the main menu');
  const m1 = await pg.evaluate(() => { const M = window.__ppMenu; return { n: M.photons.length, x: M.photons[0] && M.photons[0].x, sw: M.swallowed, sl: M.slung, parts: window.__ppC.parts.length }; });
  await sleep(4000);
  const m2 = await pg.evaluate(() => { const M = window.__ppMenu; const live = M.photons.filter(p => { let d = Math.abs(Math.atan2(p.vy, p.vx) - p.a0); if (d > Math.PI) d = 2 * Math.PI - d; return d > 0.35; }).length; return { live, n: M.photons.length, sw: M.swallowed, sl: M.slung, bent: M.bent || 0, parts: window.__ppC.parts.length, t: window.__ppC.time }; });
  ok(m1.n > 3 && m2.n > 3, `photons flying (${m1.n} -> ${m2.n})`);
  ok(m2.sw + m2.bent + m2.live > 0, `black hole bends paths: swallowed ${m2.sw}, bent >20deg ${m2.bent + m2.live}, slingshot ${m2.sl}`);
  ok(m2.parts <= 420, `particles capped (${m2.parts} live)`);
  await shot('01_menu');
  if (!touch) {   // hover glow
    const [x, y] = await btnPos('window.__ppMenu.play'); const [cx, cy] = await css(x, y); await pg.mouse.move(cx, cy, { steps: 5 }); await sleep(500);
    const hv = await pg.evaluate(() => window.__ppMenu.play.hover); ok(hv > 0.5, `PLAY hover state (${hv.toFixed(2)})`);
  }
  // press PLAY: squash while held, then pop + burst + ripple + shake, then zoom into the black hole
  await pg.evaluate(() => window.__ppScene.getTimeManager().setTimeScale(0.35));
  let squash = null;
  await tapBtn('window.__ppMenu.play', async () => { await sleep(160); squash = await pg.evaluate(() => { const b = window.__ppMenu.play; return [b.sx, b.sy, b.press]; }); await shot('02_menu_press_squash'); });
  await sleep(140); await shot('03_menu_press_juice');
  const juice = await pg.evaluate(() => { const b = window.__ppMenu.play, C = window.__ppC; return { flare: b.flare, shake: C.shake, parts: C.parts.length, trans: !!C.trans }; });
  await pg.evaluate(() => window.__ppScene.getTimeManager().setTimeScale(1));
  ok(squash && squash[2] && squash[0] > 1.02 && squash[1] < 0.98, `PLAY squashes while pressed (sx ${squash && squash[0].toFixed(2)}, sy ${squash && squash[1].toFixed(2)})`);
  ok(juice.flare > 0.2 && juice.trans, `PLAY release: glow flare ${juice.flare.toFixed(2)}, shake ${juice.shake.toFixed(1)}, transition started`);
  ok((await clog()).some(l => l.startsWith('press play')), 'PLAY pressed');
  // ================================================================ LEVEL SELECT
  ok(await waitScene('LevelSelect'), 'PLAY -> level select');
  await sleep(2500); await shot('04_select_ch1');
  let sel = await pg.evaluate(() => { const S = window.__ppSel; return { cur: S.cur, nodes: S.cards[0].nodes.map(b => [b.open, b.done]), ch2: S.cards[1].unlocked }; });
  ok(sel.cur === 0 && sel.nodes[0][0] && !sel.nodes[1][0] && !sel.ch2, 'fresh progress: 1-1 open, 1-2..1-5 locked, Abyss locked ' + JSON.stringify(sel.nodes));
  await tapBtn('window.__ppSel.cards[0].nodes[1]'); await sleep(400);
  ok((await clog()).includes('locked 1-2') && await scene() === 'LevelSelect', 'tapping a locked level wiggles + toast, stays on level select');
  // switch chapter
  if (touch) { const W = await pg.evaluate(() => window.__ppC.UW); await swipeUI(W * 0.75, 600 * 0 + (await pg.evaluate(() => window.__ppC.UH)) * 0.55, -W * 0.45, 0); }
  else await tapBtn('window.__ppSel.right');
  await sleep(2000);
  sel = await pg.evaluate(() => ({ cur: window.__ppSel.cur }));
  ok(sel.cur === 1, `switched to chapter 2 by ${touch ? 'swipe' : 'arrow button'}`);
  await shot('05_select_ch2_locked');
  await tapBtn('window.__ppSel.cards[1].nodes[0]'); await sleep(400);
  ok((await clog()).includes('locked 2-1'), 'Abyss levels locked until Awakening is finished');
  // back to chapter 1 (keyboard PageUp on desktop, swipe right on phone)
  if (touch) { const W = await pg.evaluate(() => window.__ppC.UW); await swipeUI(W * 0.25, (await pg.evaluate(() => window.__ppC.UH)) * 0.55, W * 0.45, 0); }
  else { await pg.keyboard.press('PageUp'); }
  await sleep(900); ok(await pg.evaluate(() => window.__ppSel.cur) === 0, 'back to chapter 1');
  // ================================================================ GAME 1-1 via node
  for (let k = 0; k < 60; k++) { if (await pg.evaluate(() => Math.abs(window.__ppSel.pos - window.__ppSel.cur) < 0.003)) break; await sleep(100); }
  await sleep(300);
  await tapBtn('window.__ppSel.cards[0].nodes[0]');
  { const okk = await waitScene('Game'); ok(okk, 'level node -> game'); if (!okk) { console.log(JSON.stringify(await clog()), JSON.stringify(await pg.evaluate(() => { const S = window.__ppSel, b = S.cards[0].nodes[0]; return [S.cur, S.pos, b.x, b.y, b.visible, b.enabled, window.__ppC.ptr]; }))); await b.close(); process.exit(1); } }
  const S = () => pg.evaluate(() => { const G = window.__pp; return { state: G.state, c: G.chapter, l: G.level, mode: G.st.mode, ride: !!G.st.ride, i: G.st.i, j: G.st.j, log: G.log.slice(), shards: G.shards.filter(s => s.got).length, panel: G.btnNext.visible }; });
  const settle = async () => { for (let k = 0; k < 120; k++) { const s = await S(); if ((s.state === 'play' && s.mode === 'stuck') || s.state === 'clear') { await sleep(100); return S(); } await sleep(50); } return S(); };
  const KEYS = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown', TAP: 'Space' };
  const act = async (a) => {
    if (!touch) { await pg.keyboard.press(KEYS[a]); return; }
    const cx = VIEW[0] * 0.5, cy = VIEW[1] * 0.55;
    if (a === 'TAP') { await pg.touchscreen.touchStart(cx, cy); await sleep(60); await pg.touchscreen.touchEnd(); return; }
    const [dx, dy] = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }[a];
    await pg.touchscreen.touchStart(cx - dx * 30, cy - dy * 30);
    for (let k = 1; k <= 4; k++) { await pg.touchscreen.touchMove(cx - dx * 30 + dx * 18 * k, cy - dy * 30 + dy * 18 * k); await sleep(16); }
    await pg.touchscreen.touchEnd();
  };
  const play = async (moves, label) => { for (const a of moves) { await act(a); await sleep(60); await settle(); } const s = await S(); return s; };
  let s = await S(); ok(s.c === 0 && s.l === 0, 'loaded 1-1');
  s = await play(['U', 'R', 'U'], '1-1');
  for (let k = 0; k < 40 && !(await S()).panel; k++) await sleep(100);
  await sleep(600); s = await S();
  ok(s.state === 'clear' && s.panel, 'level clear panel with NEXT / LEVELS');
  await shot('06_clear_panel');
  let prog = await pg.evaluate(() => JSON.parse(localStorage.getItem('phantomPhoton.progress.v1') || '{}'));
  ok(prog.done && prog.done['1-1'], 'progress saved to localStorage ' + JSON.stringify(prog));
  if (touch) await tapBtn('window.__pp.btnNext'); else await pg.keyboard.press('Enter');
  await sleep(700); s = await S(); ok(s.c === 0 && s.l === 1 && s.state === 'play', 'NEXT -> 1-2');
  await tapBtn('window.__pp.btnBack');
  ok(await waitScene('LevelSelect'), 'back button -> level select');
  await sleep(800);
  sel = await pg.evaluate(() => window.__ppSel.cards[0].nodes.map(b => [b.open, b.done]));
  ok(sel[0][1] && sel[1][0] && !sel[2][0], 'level select shows 1-1 completed, 1-2 unlocked ' + JSON.stringify(sel));
  await tapBtn('window.__ppSel.back'); ok(await waitScene('Menu'), 'level select back button -> menu');
  // ================================================================ chapter 2 unlocks after finishing chapter 1
  await pg.evaluate(() => { const d = {}; for (let l = 1; l <= 5; l++) d['1-' + l] = { shards: 1, of: 3, moves: 5 }; localStorage.setItem('phantomPhoton.progress.v1', JSON.stringify({ done: d })); });
  await pg.goto(url('select&ch=2')); await waitScene('LevelSelect'); await sleep(2500);
  sel = await pg.evaluate(() => ({ cur: window.__ppSel.cur, un: window.__ppSel.cards[1].unlocked, n: window.__ppSel.cards[1].nodes.map(b => b.open) }));
  ok(sel.cur === 1 && sel.un && sel.n[0] && !sel.n[1], 'after Awakening: The Abyss unlocked, 2-1 open ' + JSON.stringify(sel));
  await shot('07_select_ch2');
  await tapBtn('window.__ppSel.cards[1].nodes[0]'); ok(await waitScene('Game'), 'Abyss node -> game');
  await sleep(500);
  s = await S(); ok(s.c === 1 && s.l === 0, 'loaded 2-1 Reflections (dark)');
  const dark = await pg.evaluate(() => [window.__pp.dark, window.__ppScene.getLayer('Light').isVisible(), window.__pp.lights.length]);
  ok(dark[0] && dark[1] && dark[2] > 2, 'Abyss darkness: lighting layer on, lights ' + dark[2]);
  // play Reflections; capture a mid-flight frame
  const R1 = ['L', 'U', 'L', 'D', 'L', 'D', 'R'];
  for (let k = 0; k < R1.length; k++) {
    if (k === 3) { await pg.evaluate(() => window.__ppScene.getTimeManager().setTimeScale(0.15)); await act(R1[k]); await sleep(900); await shot('08_abyss_inflight'); await pg.evaluate(() => window.__ppScene.getTimeManager().setTimeScale(1)); await settle(); continue; }
    await act(R1[k]); await sleep(60); await settle();
  }
  for (let k = 0; k < 40 && !(await S()).panel; k++) await sleep(100);
  s = await S();
  const mem = await pg.evaluate(() => [window.__pp.memL.length, window.__pp.log.filter(l => l.startsWith('mirror')).length]);
  ok(s.state === 'clear' && s.log.includes('exit'), `2-1 Reflections cleared (mirror bounces: ${mem[1]}, remembered wall lights: ${mem[0]})`);
  await sleep(500); await shot('09_abyss_clear');
  prog = await pg.evaluate(() => JSON.parse(localStorage.getItem('phantomPhoton.progress.v1')));
  ok(prog.done['2-1'], 'Abyss progress saved: 2-1 ' + JSON.stringify(prog.done['2-1']));
  // 2-2 Drift: ride the moving platform and launch at the right moment (predicted with the same sim the game runs)
  if (touch) await tapBtn('window.__pp.btnNext'); else await pg.keyboard.press('Enter');
  await sleep(800); s = await S(); ok(s.c === 1 && s.l === 1, 'NEXT -> 2-2 Drift');
  await play(['U', 'R', 'D']); s = await S();
  ok(s.ride, 'orb stuck to the moving platform and rides it');
  let fired = false; const lead = touch ? [0.10, 0.30] : [0.04, 0.2];
  const logStart = (await S()).log.length;
  for (let k = 0; k < 300 && !fired; k++) {
    const good = await pg.evaluate((lead) => { const SIM = window.__PPSim, G = window.__pp;
      return lead.every((dt) => { const st = SIM.clone(G.st); SIM.step(G.L, st, dt); st.events = []; const r = SIM.simulate(G.L, st, 'R'); return r.events.some(e => e.type === 'exit'); }); }, lead);
    if (good) { await act('R'); fired = true; } else await sleep(15);
  }
  for (let k = 0; k < 40 && !(await S()).panel; k++) await sleep(100);
  await sleep(700); s = await S(); const nl = s.log.slice(logStart);
  ok(fired && nl.includes('exit') && nl.some(l => l.includes('(from platform)')), '2-2 Drift: timed launch from the platform reaches the exit ' + JSON.stringify(nl));
  // 2-3 Solar Flare: touching a star burns the orb and respawns it at the last wall
  if (touch) await tapBtn('window.__pp.btnNext'); else await pg.keyboard.press('Enter');
  await sleep(800); s = await S(); ok(s.c === 1 && s.l === 2, 'NEXT -> 2-3 Solar Flare'); if (s.l !== 2) console.log(JSON.stringify(s.log.slice(-8)), JSON.stringify(await clog()), JSON.stringify(await pg.evaluate(() => { const b = window.__pp.btnNext; return [b.x, b.y, b.s, b.visible, b.enabled, b.scale, window.__ppC.ptr, window.__pp.state]; })));
  await sleep(300); const before = await S();
  await act('D'); await sleep(2200); s = await settle();
  ok(s.log.includes('burn') && s.i === before.i && s.j === before.j, `flying into a star burns up -> respawn at ${s.i},${s.j}`);
  if (touch) await shot('10_star_burn_respawn');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 5)));
  const scroll = await pg.evaluate(() => [window.scrollX, window.scrollY, document.documentElement.scrollHeight <= innerHeight + 1, getComputedStyle(document.body).touchAction]);
  ok(scroll[0] === 0 && scroll[1] === 0 && scroll[2] && scroll[3] === 'none', 'no scroll, fits the viewport ' + JSON.stringify(scroll));
  // ================================================================ ?unlock debug
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(url('select&unlock&ch=2')); await waitScene('LevelSelect'); await sleep(800);
  sel = await pg.evaluate(() => window.__ppSel.cards.map(c => [c.unlocked, c.nodes.every(b => b.open)]));
  ok(sel.every(c => c[0] && c[1]), '?unlock opens every chapter and level ' + JSON.stringify(sel));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
