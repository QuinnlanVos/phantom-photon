// End-to-end test in headless Chrome. Plays all 5 levels with keyboard (desktop) or touch swipes/taps (phone)
// and checks every rule against the expected resting tiles from the solver.
// node test_e2e.js <url> <desktop|phone|landscape> <outdir>
const p = require('/workspace/tools/gdexp/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, mode, outdir] = process.argv.slice(2);
const VIEW = { desktop: [1280, 800, 1, false], phone: [390, 844, 3, true], landscape: [844, 390, 3, true] }[mode];
let fails = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
(async () => {
  const b = await p.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage();
  await pg.emulate({ viewport: { width: VIEW[0], height: VIEW[1], deviceScaleFactor: VIEW[2], isMobile: VIEW[3], hasTouch: VIEW[3] },
    userAgent: VIEW[3] ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36' });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto(url + (url.includes('?') ? '&' : '?') + 'level=1'); await sleep(4500);
  const S = () => pg.evaluate(() => { const G = window.__pp; return { state: G.state, level: G.level, chapter: G.chapter, mode: G.st.mode, i: G.st.i, j: G.st.j, log: G.log.slice(), shards: G.shards.filter(s => s.got).length, deaths: G.deaths, panel: G.btnNext.visible && G.btnNext.s > 0.9, nextLabel: G.btnNext.lbl.getString() }; });
  const shot = (n) => pg.screenshot({ path: `${outdir}/${mode}_${n}.png` });
  const settle = async () => { for (let k = 0; k < 80; k++) { const s = await S(); if ((s.state === 'play' && s.mode === 'stuck') || s.state === 'end') { await sleep(120); return S(); } await sleep(60); } return S(); };
  const W = VIEW[0], H = VIEW[1];
  const KEYS = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown', TAP: 'Space' };
  const act = async (a) => {
    if (!VIEW[3]) { await pg.keyboard.press(KEYS[a]); return; }
    const cx = W * 0.5, cy = H * 0.55;
    if (a === 'TAP') { await pg.touchscreen.touchStart(cx, cy); await sleep(60); await pg.touchscreen.touchEnd(); return; }
    const [dx, dy] = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }[a];
    await pg.touchscreen.touchStart(cx - dx * 30, cy - dy * 30);
    for (let k = 1; k <= 4; k++) { await pg.touchscreen.touchMove(cx - dx * 30 + dx * 18 * k + (k % 2) * 3, cy - dy * 30 + dy * 18 * k + (k % 2) * 3); await sleep(16); }
    await pg.touchscreen.touchEnd();
  };
  const move = async (a, expect, label) => {
    const before = (await S()).log.length; await act(a); await sleep(80); const s = await settle();
    const newLog = s.log.slice(before);
    if (expect === 'exit') ok(newLog.includes('exit'), `${label}: ${a} reaches the exit  [${newLog.join(' | ')}]`);
    else if (expect.startsWith('reject') || expect.startsWith('tap-')) ok(newLog.some(l => l.startsWith(expect)) && s.mode === 'stuck', `${label}: ${a} rejected (${expect})  [${newLog.join(' | ')}]`);
    else ok(s.mode === 'stuck' && `${s.i},${s.j}` === expect, `${label}: ${a} -> stuck at ${s.i},${s.j} (expected ${expect})  [${newLog.join(' | ')}]`);
    return { s, newLog };
  };
  const pressNext = async () => {
    if (!VIEW[3]) { await pg.keyboard.press('Enter'); return; }
    const [cx, cy] = await pg.evaluate(() => { const C = window.__ppC, b = window.__pp.btnNext; return [b.x * C.uiS * innerWidth / C.rw, b.y * C.uiS * innerHeight / C.rh]; });
    await pg.touchscreen.touchStart(cx, cy); await sleep(80); await pg.touchscreen.touchEnd();
  };
  const waitLevel = async (n) => {
    for (let k = 0; k < 80; k++) { const s = await S(); if (s.panel) break; await sleep(100); }
    const logAll = (await S()).log;   // keep the finished level's log for checks
    if (n === 'end') { await sleep(300); const s = await S(); s.log = logAll; return s; }
    await pressNext();
    for (let k = 0; k < 60; k++) { const s = await S(); if (s.level === n && s.state === 'play') { await sleep(500); s.log = logAll; return s; } await sleep(100); } return S(); };
  const slowShot = async (a, ms, name, scale) => {   // capture mid-flight (game time slowed so the frame lands mid-move)
    await pg.evaluate((sc) => window.__ppScene.getTimeManager().setTimeScale(sc), scale || 0.15);
    await act(a); await sleep(ms); await shot(name);
    await pg.evaluate(() => window.__ppScene.getTimeManager().setTimeScale(1));
  };

  await pg.evaluate(() => localStorage.clear());
  ok((await S()).state === 'play' && (await S()).chapter === 0, 'level 1-1 loaded'); await shot('01_level1');
  // ---------------- Level 1: basics
  await move('D', 'reject D into', 'L1 into-wall');
  await move('L', 'reject L into', 'L1 into-wall');
  if (!VIEW[3]) await move('TAP', 'tap-nopad', 'L1 tap with no pad');
  await move('U', '1,5', 'L1 slide up the wall');
  if (mode !== 'landscape') { await slowShot('R', 520, '02_flyoff_trail', 0.12); const s = await settle(); ok(`${s.i},${s.j}` === '5,5', `L1 R flies off the wall stub and sticks to the block at ${s.i},${s.j}`); }
  else await move('R', '5,5', 'L1 fly off the end of the wall');
  await move('L', 'reject L away', 'L1 move away from the wall');
  await move('U', 'exit', 'L1');
  let s = await waitLevel(1); ok(s.level === 1, 'advanced to level 2');
  if (mode === 'phone') await shot('03_level2_portrait');
  // ---------------- Level 2: ramps
  await move('L', '1,1', 'L2');
  if (mode === 'desktop') { await slowShot('D', 700, '04_ramp_deflect', 0.12); await settle(); }
  else await move('D', 'exit', 'L2 double ramp');
  s = await waitLevel(2); ok(s.level === 2 && s.log.filter(l => l.startsWith('deflect')).length >= 2, 'L2 ramps deflected the orb twice and advanced to level 3');
  // ---------------- Level 3: launch pad
  await move('U', 'reject U away', 'L3 normal swipe away from the pad is not allowed');
  if (mode === 'desktop') { await slowShot('TAP', 450, '05_pad_kick', 0.15); await settle(); }
  else await move('TAP', 'exit', 'L3 TAP launches off the pad');
  s = await waitLevel(3); ok(s.level === 3 && s.log.some(l => l.startsWith('kick U')), 'L3 kicked off the pad and advanced to level 4');
  // ---------------- Level 4: black hole
  await move('R', '5,1', 'L4');
  const before = (await S()).deaths; await act('D'); await sleep(1800); s = await settle();
  ok(s.deaths === before + 1 && s.log.includes('swallow') && `${s.i},${s.j}` === '5,1', `L4 straight into the black hole: swallowed and respawned at last wall ${s.i},${s.j}`);
  await move('L', '1,1', 'L4'); await move('D', '1,2', 'L4'); await move('R', '9,2', 'L4'); await move('D', '9,6', 'L4');
  if (mode !== 'landscape') { await slowShot('L', 900, '06_blackhole_bend', 0.12); await settle(); } else await move('L', 'exit', 'L4 gravity-bent flight');
  s = await waitLevel(4); ok(s.level === 4, 'L4 bent flight around the hole reached the exit; level 5');
  if (mode === 'landscape') await shot('03_level5_landscape');
  // ---------------- Level 5: combo
  for (const [a, e] of [['R', '9,10'], ['U', '9,3'], ['L', '1,3'], ['U', '1,2'], ['R', '8,2'], ['D', '9,8']]) await move(a, e, 'L5');
  if (mode === 'phone') await shot('07_level5_on_pad_portrait');
  await move('TAP', 'exit', 'L5 pad kick into the exit');
  s = await waitLevel('end'); ok(s.state === 'clear' && s.panel && s.nextLabel === 'NEXT CHAPTER', `Awakening complete: panel offers ${s.nextLabel} (shards ${s.shards})`); await shot('08_end');
  const prog = await pg.evaluate(() => JSON.parse(localStorage.getItem('phantomPhoton.progress.v1')));
  ok([1, 2, 3, 4, 5].every(l => prog.done['1-' + l]), 'all 5 Awakening levels saved as completed');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  const scroll = await pg.evaluate(() => [window.scrollX, window.scrollY, getComputedStyle(document.body).touchAction]);
  ok(scroll[0] === 0 && scroll[1] === 0 && scroll[2] === 'none', 'page did not scroll; touch-action none ' + JSON.stringify(scroll));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
