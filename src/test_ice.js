// Chapter 6 "Frozen Light" test (Playwright: chromium or webkit). Plays every ch6 level from the solver's route with keys
// (desktop) or real touch events (phone) and checks: icy night theme, follow camera + pinned HUD, lanterns light and melt their ice,
// sunlight makes the photon big and big light smashes glaciers, waterfalls make it small and small light passes cracks, a normal
// photon is stopped by a crack and a glacier, every level clears with its shards, chapter select shows 6 chapters, ch1-5 smoke checks.
// node test_ice.js <chromium|webkit> <url> <desktop|phone|landscape> <outdir>      (ONLY=1,3 limits the levels)
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
const C6 = CH.findIndex((c) => c.id === 'ice');
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
  let win = r.win.filter((t) => t !== 'w' && !t.endsWith('>dead'));   // no collapsing: a back-and-forth can pick up a colour or burst a cloud
  const startKey = L.start.join(',');
  win = win.filter((t, k) => !(k === 0 && t.split('>')[1] === startKey));
  let st = SIM.newState(L); const steps = []; const got = new Set();
  const rkey = (x) => x.st.mode === 'exit' ? 'exit' : x.st.mode === 'stuck' ? (x.st.ride ? 'ride' + x.st.ride.m : x.st.i + ',' + x.st.j) : x.st.mode;
  for (const tok of win) {
    const [a, res0] = tok.split('>'); const res = res0.replace(/\(.*\)$/, '');   // drop the colour tag, e.g. 1,10(r)
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
      rb: !!G.rb, ice: !!G.ice, size: G.st.size, sizeV: G.sizeV, nLan: (G.lanV || []).length, nIce: (G.iceV || []).length, nGlac: (G.glacV || []).length, nFall: (G.fallV || []).length, nSun: (G.sunV || []).length, iceSky: !!(G.iceSky && G.iceSky.isVisible ? G.iceSky.isVisible() : G.iceSky && !G.iceSky.isHidden()), nBows: (G.bows || []).length, nPrisms: (G.prismsV || []).length, nGates: (G.gatesV || []).length, nClouds: (G.rclouds || []).length, color: G.st.color, rain: G.st.rain, bowsShown: (G.bows || []).filter(b => b.shown).length, skyVis: G.rbSky.isVisible ? G.rbSky.isVisible() : !G.rbSky.isHidden(),
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
      if (stp.res === 'exit') ok(nl.includes('exit') || s.state === 'clear', `6-${n + 1}: ${stp.a} reaches the exit (window ${(stp.win * 100).toFixed(0)}%) [${nl.join(' | ')}]`);
      else (narrow ? soft : ok)(s.mode === 'stuck' && `${s.i},${s.j}` === stp.res, `6-${n + 1}: ${stp.a} -> ${s.i},${s.j} (solver ${stp.res}, window ${(stp.win * 100).toFixed(0)}%) [${nl.join(' | ')}]`);
      if (s.state === 'play' && cams) { await sleep(350); const s2 = await S(); cams.push([s2.camX, s2.camY]); if (JSON.stringify(s2.hud) !== JSON.stringify(hudRef)) hudSame = false; }
      if (s.state !== 'play') break;
    }
    return { s, hudSame };
  };

  // ---------------------------------------------------------------- chapter select on chapter 6
  await pg.goto(url + '?unlock&select&ch=6'); await sleep(5000);
  const sel = await pg.evaluate((C6) => { const S = window.__ppSel; const cd = S && S.cards[C6]; return S ? { cur: S.cur, n: S.cards.length, dots: S.dots.length, name: cd.name.getString(), open: cd.nodes.filter(b => b.open).length,
    vis: cd.nodes.filter(b => b.visible).length, fx: cd.frame.getX(), fw: cd.frame.getWidth(), UW: window.__ppC.UW, skyA: S.iceSky.getOpacity(), rbA: S.rbSky.getOpacity() } : null; }, C6);
  ok(sel && sel.n === CH.length && CH.length >= 6 && sel.dots === CH.length && sel.cur === C6 && /FROZEN LIGHT/.test(sel.name) && sel.open === CH[C6].levels.length && sel.vis === CH[C6].levels.length && sel.fx >= 0 && sel.fx + sel.fw <= sel.UW + 1 && sel.skyA > 200 && sel.rbA < 10,
    `select ?unlock&select&ch=6: 6 cards + 6 dots, "Frozen Light" centred on-screen, all levels open, icy backdrop ${JSON.stringify(sel)}`);
  await pg.screenshot({ path: `${outdir}/${tag}_select.png` });
  if (VIEW[3]) { const id = 99; await touch('touchstart', id, W * 0.3, H * 0.5); for (let k = 1; k <= 5; k++) { await touch('touchmove', id, W * 0.3 + k * 30, H * 0.5); await sleep(16); } await touch('touchend', id, W * 0.3 + 150, H * 0.5); }
  else await pg.keyboard.press('PageUp');
  await sleep(900); let cur = await pg.evaluate(() => window.__ppSel.cur);
  ok(cur === C6 - 1, `select: ${VIEW[3] ? 'swipe right' : 'PageUp'} goes back to chapter 5 (cur=${cur})`);
  if (VIEW[3]) { const id = 98; await touch('touchstart', id, W * 0.7, H * 0.5); for (let k = 1; k <= 5; k++) { await touch('touchmove', id, W * 0.7 - k * 30, H * 0.5); await sleep(16); } await touch('touchend', id, W * 0.7 - 150, H * 0.5); }
  else await pg.keyboard.press('PageDown');
  await sleep(900); cur = await pg.evaluate(() => window.__ppSel.cur);
  ok(cur === C6, `select: ${VIEW[3] ? 'swipe left' : 'PageDown'} returns to chapter 6 (cur=${cur})`);

  // ---------------------------------------------------------------- play every chapter-6 level
  for (let n = 0; n < Math.min(5, CH[C6].levels.length); n++) {   // original levels (longer levels: test_long.js)
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(String(n + 1))) continue;
    await load(`?unlock&ch=6&level=${n + 1}`);
    let s = await S();
    const def = CH[C6].levels[n], L0 = SIM.parseLevel(def);
    const nIce = (def.ice || []).reduce((a, z) => a + (z.w || 1) * (z.h || 1), 0), nGl = L0.glaciers.reduce((a, g) => a + g.w * g.h, 0);
    ok(s.chapter === C6 && s.level === n && s.ice && !s.rb && s.scroll && !s.dark && !s.void && !s.lightVisible && s.iceSky && s.size === 1 &&
       s.nLan === L0.lanterns.length && s.nIce === nIce && s.nGlac === nGl && s.nFall === L0.falls.length && s.nSun === L0.suns.length,
       `6-${n + 1} "${def.name}" loaded via ?ch=6&level=${n + 1}: icy theme, follow camera, ${s.nLan} lanterns, ${s.nIce} ice tiles, ${s.nGlac} glacier tiles, ${s.nFall} waterfalls, ${s.nSun} sun shafts`);
    const f = `${outdir}/${tag}_6-${n + 1}_start.png`; let st0;
    for (let k = 0; k < 5; k++) { await pg.screenshot({ path: f }); st0 = stats(f); if (st0.bright > 0.004) break; await sleep(1000); }   // a slow engine may still be fading in
    ok(st0.mean > 25 && st0.mean < 150 && st0.bright > 0.004, `6-${n + 1} icy night contrast: mean luma ${st0.mean}, bright ${(st0.bright * 100).toFixed(2)}%`);
    const P = plan(C6, n); const hud0 = s.hud; const cams = [[s.camX, s.camY]];
    const r = await runSteps(n, P.steps, P, cams, hud0); s = await S();
    const has = (p) => s.log.some(l => l.startsWith(p));
    if (L0.lanterns.length) { const m = await pg.evaluate(() => window.__pp.iceV.filter((v) => v.o.getOpacity() < 1).length);
      ok(m === nIce, `6-${n + 1} lantern ice melted away on screen (${m}/${nIce} tiles gone)`); }
    if (L0.glaciers.length) { const m = await pg.evaluate(() => window.__pp.glacV.filter((v) => v.o.getOpacity() < 1).length);
      ok(m === nGl, `6-${n + 1} glacier shattered on screen (${m}/${nGl} tiles gone)`); }
    ok(s.state === 'clear' && s.shards >= P.shards, `6-${n + 1} cleared; ${s.shards}/${P.total} shards (solver route collects ${P.shards})`);
    const need = { 'lantern ': L0.lanterns.length > 0, 'grow': L0.suns.length > 0, 'smash ': L0.glaciers.length > 0, 'shrink': L0.falls.length > 0 };
    ok(Object.keys(need).every(k => !need[k] || has(k)), `6-${n + 1} mechanics seen in the log: ${[...new Set(s.log.map(l => l.split(' ')[0]).filter(w => /^(lantern|grow|smash|shrink)$/.test(w)))].join(', ')}`);
    const xs = cams.map(c => c[0]), ys = cams.map(c => c[1]);
    const pan = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / SIM.T;
    ok(pan > (VIEW[3] ? 2 : 1.2), `6-${n + 1} camera followed the orb (panned ${pan.toFixed(1)} tiles)`);
    ok(r.hudSame, `6-${n + 1} HUD stayed pinned while the camera moved ${JSON.stringify(hud0)}`);
  }
  // ---------------------------------------------------------------- gating: a normal photon is stopped by ice it can't pass
  const probe = (n, t) => {      // shortest move sequence that leaves a normal-size photon resting against tile type t
    const L = SIM.parseLevel(CH[C6].levels[n]); const q = [[SIM.newState(L), []]], seen = new Set();
    while (q.length) { const [st, p] = q.shift(); const k = `${st.i},${st.j}:${st.size}^${st.lit}%${st.ice}`; if (seen.has(k) || p.length > 7) continue; seen.add(k);
      if (p.length && st.size === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => SIM.cell(L, st.i + dx, st.j + dy) === t)) return { path: p, at: `${st.i},${st.j}` };
      for (const a of ['R', 'U', 'L', 'D']) { const x = SIM.simulate(L, st, a); if (x.ok && x.st.mode === 'stuck') q.push([x.st, p.concat(a)]); } }
    return null; };
  for (const [n, label, t] of [[2, 'crack', 'K'], [1, 'glacier', 'Y']]) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(String(n + 1))) continue;
    const pr = probe(n, t); if (!pr) { ok(false, `6-${n + 1}: no ${label} probe found`); continue; }
    await load(`?unlock&ch=6&level=${n + 1}`); let s; for (const a of pr.path) { await act(a); s = await settle(); }
    const into = pr.at.split(',').map(Number); const L = SIM.parseLevel(CH[C6].levels[n]);
    const d = ['R', 'L', 'D', 'U'].find((k, q) => SIM.cell(L, into[0] + [1, -1, 0, 0][q], into[1] + [0, 0, 1, -1][q]) === t);
    const n0 = s.log.length; await act(d); await sleep(500); const s2 = await S();
    ok(s.mode === 'stuck' && `${s.i},${s.j}` === pr.at && s.size === 1 && `${s2.i},${s2.j}` === pr.at && !s2.log.slice(n0).some(l => l.startsWith('smash')),
      `6-${n + 1}: a normal-size photon rests against the ${label} at ${s.i},${s.j} (${pr.path.join(',')}) and can't pass it (${d}: ${s2.log.slice(n0).join(' | ') || 'rejected'})`);
  }
  // ---------------------------------------------------------------- chapters 1-5 still render as before (regression smoke)
  for (const [c, q, test] of [[0, '?ch=1&level=1', (s, st) => !s.scroll && !s.ice && st.mean > 8], [1, '?unlock&ch=2&level=1', (s, st) => s.dark && !s.ice && st.mean > 6],
                              [2, '?unlock&ch=3&level=1', (s, st) => s.sun && s.scroll && !s.ice && st.mean > 70], [3, '?unlock&ch=4&level=1', (s, st) => s.void && !s.ice && !s.iceSky && st.dark > 0.45],
                              [4, '?unlock&ch=5&level=1', (s, st) => s.rb && !s.ice && !s.iceSky && st.mean > 110]]) {
    await load(q); const s = await S(); const f = `${outdir}/${tag}_ch${c + 1}.png`; await pg.screenshot({ path: f }); const st = stats(f);
    ok(s.chapter === c && test(s, st), `chapter ${c + 1} still renders with its own theme (mean luma ${st.mean}, dark ${st.dark}, ice ${s.ice})`);
  }
  await load('?lite&unlock&ch=6&level=5'); { const s = await S(); const f = `${outdir}/${tag}_lite_6-5.png`; await pg.screenshot({ path: f }); const st = stats(f);
    ok(s.ice && s.chapter === C6 && st.bright > 0.002, `?lite on 6-5 renders (mean luma ${st.mean})`); }
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 5)));
  console.log((fails ? `${fails} FAILED` : 'ALL PASSED') + (warns ? ` (${warns} warnings)` : ''), tag);
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e.stack); process.exit(2); });
