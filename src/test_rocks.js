// Chapter 4 "Rocks from Space" test (Playwright: chromium or webkit). Plays every ch4 level from the solver's route with keys
// (desktop) or real touch events (phone), synced to the sim's hazard clock, and checks: deep-space theme (dark void + bright
// high-contrast walls/hazards), no darkness layer, follow camera + pinned HUD, each new hazard kills (rock / dust / hail) and
// respawns, every level clears with its shards, chapter select shows 4 chapters, plus quick chapter 1-3 regression smoke checks.
// node test_rocks.js <chromium|webkit> <url> <desktop|phone|landscape> <outdir>      (ONLY=1,3 limits the levels)
const pw = require('/workspace/tools/pw/node_modules/playwright');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [eng, url, mode, outdir] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const VIEW = { desktop: [1280, 800, 1, false], phone: [390, 844, 3, true], landscape: [844, 390, 3, true] }[mode];
const SIM = new Function(fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8'))();
const { analyze } = require('./solve.js');
const CH = JSON.parse(fs.readFileSync(path.join(__dirname, 'chapters.json'), 'utf8'));
const C4 = CH.findIndex((c) => c.id === 'rocks');
let fails = 0, warns = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
const soft = (c, msg) => { console.log((c ? 'PASS ' : 'WARN ') + msg); if (!c) warns++; };
const tag = `${eng}_${mode}`;
// play-area stats: mean luma, share of near-black pixels (the void), share of bright pixels (walls / hazards / photon)
const stats = (f) => JSON.parse(execFileSync('python3', ['-c', `from PIL import Image\nimport json\nim=Image.open('${f}').convert('L');W,H=im.size\nc=im.crop((int(W*.05),int(H*.16),int(W*.95),int(H*.8)));h=c.histogram();n=sum(h)\nprint(json.dumps({'mean':round(sum(i*v for i,v in enumerate(h))/n,1),'dark':round(sum(h[:30])/n,3),'bright':round(sum(h[200:])/n,4)}))`]).toString());
// drop back-and-forth "time killing" moves from the solver route (waits are re-derived per step below)
function collapse(win) {
  const out = [];
  for (const tok of win) {
    if (tok === 'w') continue;
    out.push(tok);
    while (out.length >= 2) { const a = out[out.length - 2].split('>')[1], b = out[out.length - 1].split('>')[1], prev = out.length >= 3 ? out[out.length - 3].split('>')[1] : 'start';
      if (b === prev && a !== 'exit' && b !== 'dead' && a !== 'dead') { out.splice(out.length - 2, 2); } else break; }
  }
  return out;
}
function plan(c, n, toks) {
  const def = CH[c].levels[n], L = SIM.parseLevel(def);
  const r = toks ? { win: toks } : analyze(def);
  let win = collapse(r.win).filter((t) => !t.endsWith('>dead'));
  const startKey = L.start.join(',');
  win = win.filter((t, k) => !(k === 0 && t.split('>')[1] === startKey));
  let st = SIM.newState(L); const steps = []; const got = new Set();
  const rkey = (x) => x.st.mode === 'exit' ? 'exit' : x.st.mode === 'stuck' ? (x.st.ride ? 'ride' + x.st.ride.m : x.st.i + ',' + x.st.j) : x.st.mode;
  for (const tok of win) {
    const [a, res] = tok.split('>');
    if (SIM.isTimed(L)) {
      const N = 96, good = [], span = L.period / SIM.timeScale(L, st.x, st.y);
      for (let k = 0; k < N; k++) { const x = SIM.simulate(L, st, a, k * span / N + 1e-6); good.push(x.ok && rkey(x) === res); }
      let best = [-1, 0];
      for (let k = 0; k < N; k++) { if (!good[k] || good[(k + N - 1) % N]) continue; let len = 0; while (len < N && good[(k + len) % N]) len++; if (len > best[1]) best = [k, len]; }
      if (best[0] < 0 && good.every(Boolean)) best = [0, N];
      if (best[0] < 0) throw new Error(`no timing window for ${tok}`);
      const wk = (best[0] + Math.floor(best[1] / 2)) % N; if (wk) st = SIM.simulate(L, st, 'WAIT', wk * span / N + 1e-6).st;
      steps.push({ a, res, t: st.time || 0, win: best[1] / N });
    } else steps.push({ a, res, t: st.time || 0, win: 1 });
    const x = SIM.simulate(L, st, a); x.events.forEach((e) => { if (e.type === 'shard') got.add(e.k); }); st = x.st;
    if (rkey(x) !== res) throw new Error(`plan step ${tok} gives ${rkey(x)}`);
  }
  return { steps, timed: SIM.isTimed(L), period: L.period, shards: got.size, total: L.shards.length, L };
}
// a move from the level start that is lethal for the given hazard at some phase (to check the game kills + respawns)
function deathPlan(c, n, type) {
  const L = SIM.parseLevel(CH[c].levels[n]); const P = plan(c, n); let st = SIM.newState(L);
  for (const stp of P.steps) {
    for (const a of ['L', 'R', 'U', 'D']) {
      const N = 96, bad = []; for (let k = 0; k < N; k++) { const x = SIM.simulate(L, st, a, k * L.period / N + 1e-6); bad.push(x.ok && x.st.mode === 'dead' && x.st.deathType === type); }
      let best = [-1, 0]; for (let k = 0; k < N; k++) { if (!bad[k] || bad[(k + N - 1) % N]) continue; let len = 0; while (len < N && bad[(k + len) % N]) len++; if (len > best[1]) best = [k, len]; }
      if (best[0] >= 0 && best[1] >= 6) {
        const wk = (best[0] + Math.floor(best[1] / 2)) % N, s2 = SIM.simulate(L, st, 'WAIT', wk * L.period / N + 1e-6).st;
        return { pre: P.steps.slice(0, P.steps.indexOf(stp)), a, t: s2.time, at: st.i + ',' + st.j };
      }
    }
    st = SIM.simulate(L, SIM.simulate(L, st, 'WAIT', ((stp.t - st.time) % L.period + L.period) % L.period + 1e-6).st, stp.a).st;
  }
  return null;
}
(async () => {
  const b = await pw[eng].launch(eng === 'chromium' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await b.newContext({ viewport: { width: VIEW[0], height: VIEW[1] }, deviceScaleFactor: VIEW[2], isMobile: VIEW[3], hasTouch: VIEW[3],
    userAgent: VIEW[3] ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => { if (!/gdevelop-app\.com|analytics/i.test(e.message)) errs.push('PAGEERR ' + e.message); });
  const W = VIEW[0], H = VIEW[1];
  const S = () => pg.evaluate(() => { const G = window.__pp; if (!G) return null; const C = window.__ppC;
    return { state: G.state, level: G.level, chapter: G.chapter, mode: G.st.mode, i: G.st.i, j: G.st.j, ride: G.st.ride ? G.st.ride.m : -1, time: G.st.time || 0, wts: G.st.ts || 1, log: G.log.slice(),
      shards: G.shards.filter(s => s.got).length, camX: G.camX, camY: G.camY, zoom: G.zoom, sun: G.sun, void: G.void, scroll: G.scroll, dark: G.dark,
      nRocks: (G.rocks || []).length, nRings: (G.rings || []).length, nHail: (G.hails || []).length, nPins: (G.pins || []).length,
      hud: [G.ui.level.getX(), G.ui.level.getY(), G.btnBack.x, G.btnBack.y, G.btnRestart.x, G.btnRestart.y, G.ui.shards.getY()].map(v => Math.round(v * 10) / 10),
      lightVisible: window.__ppScene.getLayer('Light').isVisible(), exitOff: !!G.exitOff, UW: C.UW, UH: C.UH }; });
  const touch = (type, id, x, y) => pg.evaluate(([type, id, x, y]) => {
    const cv = document.querySelector('canvas'); const t = { identifier: id, pageX: x, pageY: y, clientX: x, clientY: y, target: cv };
    const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'changedTouches', { value: [t] }); Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [t] });
    cv.dispatchEvent(e); }, [type, id, x, y]);
  let tid = 10;
  const act = async (a) => {
    if (!VIEW[3]) { const k = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown', TAP: 'Space' }[a]; await pg.keyboard.down(k); await sleep(60); await pg.keyboard.up(k); return; }
    const cx = W * 0.5, cy = H * 0.55, id = ++tid;
    if (a === 'TAP') { await touch('touchstart', id, cx, cy); await sleep(70); await touch('touchend', id, cx, cy); return; }
    const [dx, dy] = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }[a];
    await touch('touchstart', id, cx - dx * 30, cy - dy * 30);
    await sleep(30);
    for (let k = 1; k <= 4; k++) { await touch('touchmove', id, cx - dx * 30 + dx * 18 * k, cy - dy * 30 + dy * 18 * k); await sleep(20); }
    await touch('touchend', id, cx + dx * 42, cy + dy * 42);
  };
  const settle = async () => { for (let k = 0; k < 240; k++) { const s = await S(); if (s.state !== 'play' || s.mode === 'stuck') { await sleep(120); return S(); } await sleep(50); } return S(); };
  const ts = (v) => pg.evaluate((v) => window.__ppScene.getTimeManager().setTimeScale(v), v);
  // freeze-and-step phase sync: slow the game down near the target phase, then act while it runs at 5% speed
  const syncPhase = async (t, P) => {
    const target = ((t % P) + P) % P, t0 = Date.now(); let cur = -1;
    while (Date.now() - t0 < 60000) {
      const s = await S(); const ph = ((s.time % P) + P) % P; const d = ((target - ph) % P + P) % P;
      if (d < 0.025 || d > P - 0.01) break;
      const want = d > 0.6 ? 1 : d > 0.15 ? 0.2 : 0.04; if (want !== cur) { await ts(want); cur = want; }
      await sleep(d > 0.6 ? 50 : 10);
    }
    await ts(0.03);
  };
  const load = async (q) => { await pg.goto(url + q); for (let k = 0; k < 80; k++) { const s = await S().catch(() => null); if (s && s.state === 'play') break; await sleep(150); } await sleep(1500); };
  const runSteps = async (n, steps, P, cams, hudRef) => {
    let s, hudSame = true;
    for (const stp of steps) {
      if (P.timed && stp.win < 0.97) await syncPhase(stp.t, P.period);   // moves that work at any phase need no sync
      const before = (await S()).log.length;
      await act(stp.a); await sleep(40); await ts(1);
      s = await settle(); const nl = s.log.slice(before);
      const narrow = stp.win < 0.25;
      if (stp.res === 'exit') ok(nl.includes('exit') || s.state === 'clear', `4-${n + 1}: ${stp.a} reaches the exit (window ${(stp.win * 100).toFixed(0)}%) [${nl.join(' | ')}]`);
      else (narrow ? soft : ok)(s.mode === 'stuck' && `${s.i},${s.j}` === stp.res, `4-${n + 1}: ${stp.a} -> ${s.i},${s.j} (solver ${stp.res}, window ${(stp.win * 100).toFixed(0)}%) [${nl.join(' | ')}]`);
      if (s.state === 'play' && cams) { await sleep(350); const s2 = await S(); cams.push([s2.camX, s2.camY]); if (JSON.stringify(s2.hud) !== JSON.stringify(hudRef)) hudSame = false; }
      if (s.state !== 'play') break;
    }
    return { s, hudSame };
  };

  // ---------------------------------------------------------------- chapter select on chapter 4
  await pg.goto(url + '?unlock&select&ch=4'); await sleep(5000);
  const sel = await pg.evaluate((C4) => { const S = window.__ppSel; const cd = S && S.cards[C4]; return S ? { cur: S.cur, n: S.cards.length, dots: S.dots.length, name: cd.name.getString(), open: cd.nodes.filter(b => b.open).length,
    vis: cd.nodes.filter(b => b.visible).length, fx: cd.frame.getX(), fw: cd.frame.getWidth(), UW: window.__ppC.UW, voidA: S.voidSky.getOpacity() } : null; }, C4);
  ok(sel && sel.n === 4 && sel.dots === 4 && sel.cur === C4 && /ROCKS FROM SPACE/.test(sel.name) && sel.open === 5 && sel.vis === 5 && sel.fx >= 0 && sel.fx + sel.fw <= sel.UW + 1 && sel.voidA > 200,
    `select ?unlock&select&ch=4: 4 cards + 4 dots, "Rocks from Space" centred on-screen, 5 levels open, deep-space backdrop ${JSON.stringify(sel)}`);
  await pg.screenshot({ path: `${outdir}/${tag}_select.png` });
  // swipe / arrow back to chapter 3 and forward again
  if (VIEW[3]) {
    const id = 99; await touch('touchstart', id, W * 0.3, H * 0.5); for (let k = 1; k <= 5; k++) { await touch('touchmove', id, W * 0.3 + k * 30, H * 0.5); await sleep(16); } await touch('touchend', id, W * 0.3 + 150, H * 0.5);
  } else { await pg.keyboard.press('PageUp'); }
  await sleep(900); let cur = await pg.evaluate(() => window.__ppSel.cur);
  ok(cur === C4 - 1, `select: ${VIEW[3] ? 'swipe right' : 'PageUp'} goes back to chapter 3 (cur=${cur})`);
  if (VIEW[3]) { const id = 98; await touch('touchstart', id, W * 0.7, H * 0.5); for (let k = 1; k <= 5; k++) { await touch('touchmove', id, W * 0.7 - k * 30, H * 0.5); await sleep(16); } await touch('touchend', id, W * 0.7 - 150, H * 0.5); }
  else await pg.keyboard.press('PageDown');
  await sleep(900); cur = await pg.evaluate(() => window.__ppSel.cur);
  ok(cur === C4, `select: ${VIEW[3] ? 'swipe left' : 'PageDown'} returns to chapter 4 (cur=${cur})`);

  // ---------------------------------------------------------------- play every chapter-4 level
  for (let n = 0; n < CH[C4].levels.length; n++) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(String(n + 1))) continue;
    await load(`?unlock&ch=4&level=${n + 1}`);
    let s = await S();
    const def = CH[C4].levels[n];
    ok(s.chapter === C4 && s.level === n && s.void && s.scroll && !s.dark && !s.sun && !s.lightVisible && s.nPins > 20 &&
       s.nRocks === (def.rocks || []).length && s.nRings === (def.rings || []).length && s.nHail === (def.hail || []).length,
       `4-${n + 1} "${def.name}" loaded via ?ch=4&level=${n + 1}: deep-space theme, follow camera, no darkness layer, ${s.nPins} pinpoint stars, hazards ${s.nRocks}/${s.nRings}/${s.nHail}`);
    const f = `${outdir}/${tag}_4-${n + 1}_start.png`; let st0;
    for (let k = 0; k < 4; k++) { await pg.screenshot({ path: f }); st0 = stats(f); if (st0.bright > 0.004) break; await sleep(1200); }   // a slow engine may still be fading in
    ok(st0.dark > 0.45 && st0.bright > 0.004 && st0.mean < 60, `4-${n + 1} high contrast: dark void ${(st0.dark * 100).toFixed(0)}% of play area, bright ${(st0.bright * 100).toFixed(2)}%, mean luma ${st0.mean}`);
    const P = plan(C4, n); const hud0 = s.hud; const cams = [[s.camX, s.camY]];
    const r = await runSteps(n, P.steps, P, cams, hud0); s = await S();
    ok(s.state === 'clear' && s.shards >= P.shards, `4-${n + 1} cleared; ${s.shards}/${P.total} shards (solver route collects ${P.shards}); deaths on the way: ${s.log.filter(l => /^(rock|dust|hail)$/.test(l)).length}`);
    const xs = cams.map(c => c[0]), ys = cams.map(c => c[1]);
    const pan = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / SIM.T;
    ok(pan > (VIEW[3] ? 2 : 1.2), `4-${n + 1} camera followed the orb (panned ${pan.toFixed(1)} tiles)`);
    ok(r.hudSame, `4-${n + 1} HUD stayed pinned while the camera moved ${JSON.stringify(hud0)}`);
  }
  // ---------------------------------------------------------------- each new hazard kills the photon (and it respawns)
  for (const [n, type] of [[0, 'rock'], [1, 'dust'], [2, 'hail']]) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(String(n + 1))) continue;
    const D = deathPlan(C4, n, type); if (!D) { ok(false, `4-${n + 1}: no ${type} death found`); continue; }
    await load(`?unlock&ch=4&level=${n + 1}`);
    const P = plan(C4, n);
    if (D.pre.length) await runSteps(n, D.pre, P, null, null);
    await syncPhase(D.t, P.period); const before = (await S()).log.length; await act(D.a); await sleep(40); await ts(1);
    await sleep(500);
    if (process.env.SHOTS !== '0') await pg.screenshot({ path: `${outdir}/${tag}_death_${type}.png` });
    let s = await S(); for (let k = 0; k < 40 && s.state !== 'play'; k++) { await sleep(100); s = await S(); }
    await sleep(300); s = await S(); const nl = s.log.slice(before);
    ok(nl.includes(type) && nl.some(l => l.startsWith('respawn')) && s.state === 'play' && s.mode === 'stuck', `4-${n + 1}: ${D.a} from ${D.at} into the ${type} -> ${type} death + respawn at ${s.i},${s.j} [${nl.join(' | ')}]`);
  }
  // ---------------------------------------------------------------- chapters 1-3 still render as before (regression smoke)
  for (const [c, q, test] of [[0, '?ch=1&level=1', (s, st) => !s.scroll && !s.void && st.mean > 8], [1, '?unlock&ch=2&level=1', (s, st) => s.dark && !s.void && st.mean > 6],
                              [2, '?unlock&ch=3&level=1', (s, st) => s.sun && s.scroll && !s.void && st.mean > 70]]) {
    await load(q); const s = await S(); const f = `${outdir}/${tag}_ch${c + 1}.png`; await pg.screenshot({ path: f }); const st = stats(f);
    ok(s.chapter === c && test(s, st), `chapter ${c + 1} still renders with its own theme (mean luma ${st.mean}, scroll ${s.scroll}, void ${s.void})`);
  }
  // lite mode on a chapter-4 level
  await load('?lite&unlock&ch=4&level=2'); { const s = await S(); const f = `${outdir}/${tag}_lite_4-2.png`; await pg.screenshot({ path: f }); const st = stats(f);
    ok(s.void && s.chapter === C4 && st.bright > 0.002, `?lite on 4-2 renders (void ${s.void}, ${s.nPins} stars, bright ${(st.bright * 100).toFixed(2)}%)`); }
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 5)));
  console.log((fails ? `${fails} FAILED` : 'ALL PASSED') + (warns ? ` (${warns} timing warnings)` : ''), tag);
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e.stack); process.exit(2); });
