// Chapter 3 "Solar Winds" test (Playwright: chromium or webkit). Plays every ch3 level from the solver's
// solution with keys (desktop) or real touch events (phone / landscape), syncing to the solver's platform
// phase, and checks: resting tiles, exit, all shards, brightness (no black screen, no dimming), camera
// follows (pans) while the HUD stays pinned, swipes + taps work while scrolled, select screen shows ch3.
// node test_solar.js <chromium|webkit> <url> <desktop|phone|landscape> <outdir>
const pw = require('/workspace/tools/pw/node_modules/playwright');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [eng, url, mode, outdir] = process.argv.slice(2);
const VIEW = { desktop: [1280, 800, 1, false], phone: [390, 844, 3, true], landscape: [844, 390, 3, true] }[mode];
const SIM = new Function(fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8'))();
const { analyze } = require('./solve.js');
const CH = JSON.parse(fs.readFileSync(path.join(__dirname, 'chapters.json'), 'utf8'));
let fails = 0, warns = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
const soft = (c, msg) => { console.log((c ? 'PASS ' : 'WARN ') + msg); if (!c) warns++; };   // timing-dependent steps (platform phase under a loaded headless browser)
const tag = `${eng}_${mode}`;
const lum = (f) => +execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open('${f}').convert('L');W,H=im.size\nprint(im.crop((int(W*.1),int(H*.2),int(W*.9),int(H*.8))).resize((1,1),Image.BOX).getpixel((0,0)))`]).toString();
// the solver's plan for a level: actions with the sim time at which each was taken (for platform phase sync)
function plan(c, n, toks) {
  const def = CH[c].levels[n], r = toks ? { win: toks } : analyze(def), L = SIM.parseLevel(def);
  let st = SIM.newState(L); const steps = []; const got = new Set();
  const rkey = (x) => x.st.mode === 'exit' ? 'exit' : x.st.mode === 'stuck' ? (x.st.ride ? 'ride' + x.st.ride.m : x.st.i + ',' + x.st.j) : x.st.mode;
  for (const tok of r.win) {
    if (tok === 'w') continue;          // waits are re-derived below: aim for the middle of each timing window, not its edge
    const [a, res] = tok.split('>');
    if (L.movers.length) {
      const N = 96, good = [], span = L.period / SIM.timeScale(L, st.x, st.y);   // inside a gravity well a full cycle takes longer
      for (let k = 0; k < N; k++) { const x = SIM.simulate(L, st, a, k * span / N + 1e-6); good.push(x.ok && rkey(x) === res); }
      let best = [-1, 0];      // longest circular run of waits that give the solver's result
      for (let k = 0; k < N; k++) { if (!good[k] || good[(k + N - 1) % N]) continue; let len = 0; while (len < N && good[(k + len) % N]) len++; if (len > best[1]) best = [k, len]; }
      if (best[0] < 0 && good.every(Boolean)) best = [0, N];
      if (process.env.PLAN_DEBUG) console.log("win", a, res, good.map(g => g ? "#" : ".").join(""), best);
      if (best[0] >= 0) { const wk = (best[0] + Math.floor(best[1] / 2)) % N; if (wk) st = SIM.simulate(L, st, 'WAIT', wk * span / N + 1e-6).st; }
    }
    steps.push({ a, res, t: st.time || 0 }); if (process.env.PLAN_DEBUG) console.log("plan", a, res, st.i + "," + st.j, (st.time || 0).toFixed(3));
    const x = SIM.simulate(L, st, a); if (!x.ok) throw new Error("plan step " + a + ">" + res + " invalid: " + x.why + " at " + st.i + "," + st.j + " mode " + st.mode); x.events.forEach((e) => { if (e.type === 'shard') got.add(e.k); }); st = x.st;
  }
  return { steps, timed: L.movers.length > 0, period: L.period, shards: got.size, total: L.shards.length };
}
(async () => {
  const b = await pw[eng].launch(eng === 'chromium' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await b.newContext({ viewport: { width: VIEW[0], height: VIEW[1] }, deviceScaleFactor: VIEW[2], isMobile: eng === 'chromium' ? VIEW[3] : VIEW[3], hasTouch: VIEW[3],
    userAgent: VIEW[3] ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  const W = VIEW[0], H = VIEW[1];
  const S = () => pg.evaluate(() => { const G = window.__pp; if (!G) return null; const C = window.__ppC;
    return { state: G.state, level: G.level, chapter: G.chapter, mode: G.st.mode, i: G.st.i, j: G.st.j, ride: G.st.ride ? G.st.ride.m : -1, time: G.st.time || 0, wts: G.st.ts || 1, log: G.log.slice(),
      shards: G.shards.filter(s => s.got).length, camX: G.camX, camY: G.camY, zoom: G.zoom, sun: G.sun, scroll: G.scroll, dark: G.dark,
      hud: [G.ui.level.getX(), G.ui.level.getY(), G.btnBack.x, G.btnBack.y, G.btnRestart.x, G.btnRestart.y, G.ui.shards.getY()].map(v => Math.round(v * 10) / 10),
      lightVisible: window.__ppScene.getLayer('Light').isVisible(), exitOff: !!G.exitOff, UW: C.UW, UH: C.UH }; });
  // real touch events on the canvas (same path the browser's touch input takes in GDevelop)
  const touch = (type, id, x, y) => pg.evaluate(([type, id, x, y]) => {
    const cv = document.querySelector('canvas'); const t = { identifier: id, pageX: x, pageY: y, clientX: x, clientY: y, target: cv };
    const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'changedTouches', { value: [t] }); Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [t] });
    cv.dispatchEvent(e); }, [type, id, x, y]);
  let tid = 10;
  const act = async (a) => {
    if (!VIEW[3]) { const k = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown', TAP: 'Space' }[a]; await pg.keyboard.down(k); await sleep(90); await pg.keyboard.up(k); return; }
    const cx = W * 0.5, cy = H * 0.55, id = ++tid;
    if (a === 'TAP') { await touch('touchstart', id, cx, cy); await sleep(70); await touch('touchend', id, cx, cy); return; }
    const [dx, dy] = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }[a];
    await touch('touchstart', id, cx - dx * 30, cy - dy * 30);
    for (let k = 1; k <= 4; k++) { await touch('touchmove', id, cx - dx * 30 + dx * 18 * k, cy - dy * 30 + dy * 18 * k); await sleep(20); }
    await touch('touchend', id, cx + dx * 42, cy + dy * 42);
  };
  const settle = async () => { for (let k = 0; k < 200; k++) { const s = await S(); if (s.state !== 'play' || s.mode === 'stuck') { await sleep(150); return S(); } await sleep(60); } return S(); };
  const ts = (v) => pg.evaluate((v) => window.__ppScene.getTimeManager().setTimeScale(v), v);
  const syncPhase = async (t, P) => {   // wait until the platform cycle is at the solver's phase (slowed down near it for precision)
    const target = ((t % P) + P) % P, t0 = Date.now(); let cur = -1;
    while (Date.now() - t0 < 90000) {
      const s = await S(); const ph = ((s.time % P) + P) % P; const d = ((target - ph) % P + P) % P;
      if (d < 0.03 || d > P - 0.01) break;
      const r = s.wts, want = d > 0.5 * r ? 1 : d > 0.12 * r ? 0.25 : 0.06;     // r: world time rate (slower inside a gravity well) if (want !== cur) { await ts(want); cur = want; }
      await sleep(d > 0.5 * r ? 60 : 12);
    }
    await ts(0.05);
  };
  const load = async (q) => { await pg.goto(url + q); for (let k = 0; k < 80; k++) { const s = await S().catch(() => null); if (s && s.state === 'play') break; await sleep(150); } await sleep(1800); };

  // ---------------------------------------------------------------- chapter select shows chapter 3
  await pg.goto(url + '?unlock&select&ch=3'); await sleep(5000);
  const sel = await pg.evaluate(() => { const S = window.__ppSel; return S ? { cur: S.cur, n: S.cards.length, name: S.cards[2] && S.cards[2].name.getString(), open: S.cards[2].nodes.filter(b => b.open).length,
    vis: S.cards[2].nodes.filter(b => b.visible).length, fx: S.cards[2].frame.getX(), fw: S.cards[2].frame.getWidth(), UW: window.__ppC.UW } : null; });
  ok(sel && sel.n === 3 && sel.cur === 2 && /SOLAR WINDS/.test(sel.name) && sel.open === 5 && sel.vis === 5 && sel.fx >= 0 && sel.fx + sel.fw <= sel.UW + 1, `select ?select&ch=3: 3 chapter cards, ch3 "Solar Winds" centred and on-screen, 5 levels open ${JSON.stringify(sel)}`);
  await pg.screenshot({ path: `${outdir}/${tag}_select.png` });
  // ---------------------------------------------------------------- play every chapter-3 level
  for (let n = 0; n < CH[2].levels.length; n++) {
    if (process.env.ONLY && !process.env.ONLY.split(",").includes(String(n + 1))) continue;
    await load(`?unlock&ch=3&level=${n + 1}`);
    let s = await S();
    ok(s.chapter === 2 && s.level === n && s.sun && s.scroll && !s.dark && !s.lightVisible, `3-${n + 1} loaded via ?ch=3&level=${n + 1}: bright theme, follow camera, no darkness layer`);
    const f = `${outdir}/${tag}_3-${n + 1}_start.png`; await pg.screenshot({ path: f }); const L0 = lum(f);
    ok(L0 > 70, `3-${n + 1} play area is bright (mean luma ${L0})`);
    const P = plan(2, n); const hud0 = s.hud; const cams = [[s.camX, s.camY]]; let hudSame = true;
    for (const stp of P.steps) {
      if (P.timed) { await syncPhase(stp.t, P.period); if (process.env.PHASE_DEBUG) { const q = await S(); console.log("phase", stp.a, stp.res, "target", (stp.t % P.period).toFixed(3), "now", (q.time % P.period).toFixed(3), q.i + "," + q.j); } }
      const before = (await S()).log.length;
      await act(stp.a); await sleep(60); await ts(1);
      s = await settle(); const nl = s.log.slice(before);
      if (stp.res === 'exit') ok(nl.includes('exit') || s.state === 'clear', `3-${n + 1}: ${stp.a} reaches the exit [${nl.join(' | ')}]`);
      else if (stp.res.startsWith('ride')) (P.timed ? soft : ok)(s.mode === 'stuck' && s.ride === +stp.res.slice(4), `3-${n + 1}: ${stp.a} -> riding platform ${stp.res.slice(4)} [${nl.join(' | ')}]`);
      else (P.timed ? soft : ok)(s.mode === 'stuck' && `${s.i},${s.j}` === stp.res, `3-${n + 1}: ${stp.a} -> ${s.i},${s.j} (solver ${stp.res}) [${nl.join(' | ')}]`);
      if (s.state === 'play') { await sleep(500); const s2 = await S(); cams.push([s2.camX, s2.camY]); if (JSON.stringify(s2.hud) !== JSON.stringify(hud0)) hudSame = false; }
      if (s.state !== 'play') break;
    }
    s = await S();
    ok(s.state === 'clear' && s.shards >= P.shards, `3-${n + 1} cleared; ${s.shards}/${P.total} shards (solver route collects ${P.shards})`);
    const xs = cams.map(c => c[0]), ys = cams.map(c => c[1]);
    const pan = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / SIM.T;
    ok(pan > 3, `3-${n + 1} camera followed the orb (panned ${pan.toFixed(1)} tiles)`);
    ok(hudSame, `3-${n + 1} HUD stayed pinned while the camera moved ${JSON.stringify(hud0)}`);
  }
  // ---------------------------------------------------------------- tap while scrolled: kick off the launch pad in 3-5
  await load('?unlock&ch=3&level=5');
  const def5 = CH[2].levels[4], L5 = SIM.parseLevel(def5);
  const route = plan(2, 4, ['R>1,16', 'R>26,16', 'U>22,7', 'L>19,7', 'D>10,22']).steps;
  for (const r of route) { await syncPhase(r.t, L5.period); await act(r.a); await sleep(60); await ts(1); await settle(); }
  let s = await S(); const camBefore = [s.camX, s.camY];
  ok(s.mode === 'stuck' && s.i === 10 && s.j === 22, `3-5 route to the launch pad (scrolled camera, cam ${camBefore.map(Math.round)}) -> ${s.i},${s.j}`);
  let before = s.log.length; await act('TAP'); await sleep(60); s = await settle();
  ok(s.log.slice(before).some(l => l.startsWith('kick U')) && s.i === 10 && s.j === 15, `3-5 TAP while scrolled kicks off the pad -> ${s.i},${s.j} [${s.log.slice(before).join(' | ')}]`);
  before = s.log.length; await act('TAP'); await sleep(200); s = await S();
  ok(s.log.slice(before).some(l => l.startsWith('tap-nopad')), `3-5 TAP away from a pad is registered (tap-nopad) while scrolled`);
  before = s.log.length; await act('U'); await sleep(200); s = await S();
  ok(s.log.slice(before).some(l => l.startsWith('reject U')), `3-5 swipe into the ceiling is rejected while scrolled [${s.log.slice(before).join(' | ')}]`);
  // ---------------------------------------------------------------- chapters 1-2 still render (no black screen) and keep the fit camera
  for (const [c, q] of [[0, '?ch=1&level=1'], [1, '?unlock&ch=2&level=1']]) {
    await load(q); s = await S(); const f = `${outdir}/${tag}_ch${c + 1}.png`; await pg.screenshot({ path: f }); const lu = lum(f);
    ok(s.chapter === c && !s.scroll && !s.sun && lu > (c === 0 ? 8 : 6), `chapter ${c + 1} renders with the fit camera (luma ${lu})`);
  }
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 5)));
  console.log((fails ? `${fails} FAILED` : 'ALL PASSED') + (warns ? ` (${warns} timing warnings)` : ''), tag);
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e.stack); process.exit(2); });
