// Capture the Rocks from Space preview screenshots (Playwright chromium; phone portrait / landscape / desktop).
// node previews_rocks.js <url> <outdir>
const pw = require('/workspace/tools/pw/node_modules/playwright');
const fs = require('fs'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const SIM = new Function(fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8'))();
const CH = JSON.parse(fs.readFileSync(path.join(__dirname, 'chapters.json'), 'utf8')); const C4 = CH.findIndex((c) => c.id === 'rocks');
const VIEWS = { desktop: [1280, 800, 1, false], phone: [390, 844, 3, true], landscape: [844, 390, 3, true] };
// time each scripted move into the middle of its safe window (same sim as the game)
function timed(n, moves) {
  const L = SIM.parseLevel(CH[C4].levels[n]); let st = SIM.newState(L); const steps = [];
  for (const [a, res] of moves) {
    const N = 96, good = []; for (let k = 0; k < N; k++) { const x = SIM.simulate(L, st, a, k * L.period / N + 1e-6); good.push(x.ok && (x.st.mode === 'exit' ? 'exit' : x.st.i + ',' + x.st.j) === res && x.st.mode !== 'dead'); }
    let best = [-1, 0]; for (let k = 0; k < N; k++) { if (!good[k] || good[(k + N - 1) % N]) continue; let len = 0; while (len < N && good[(k + len) % N]) len++; if (len > best[1]) best = [k, len]; }
    if (best[0] < 0) best = [0, N];
    const wk = (best[0] + Math.floor(best[1] / 2)) % N; if (wk) st = SIM.simulate(L, st, 'WAIT', wk * L.period / N + 1e-6).st;
    steps.push({ a, t: st.time, full: best[1] === N }); st = SIM.simulate(L, st, a).st;
  }
  return { steps, P: L.period, L };
}
(async () => {
  const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (view) => { const V = VIEWS[view]; const ctx = await b.newContext({ viewport: { width: V[0], height: V[1] }, deviceScaleFactor: V[2], isMobile: V[3], hasTouch: V[3] });
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); return pg; };
  const S = (pg) => pg.evaluate(() => { const G = window.__pp; return G ? { state: G.state, mode: G.st.mode, i: G.st.i, j: G.st.j, time: G.st.time || 0 } : null; });
  const ts = (pg, v) => pg.evaluate((v) => window.__ppScene.getTimeManager().setTimeScale(v), v);
  const load = async (pg, q) => { await pg.goto(url + q); for (let k = 0; k < 80; k++) { const s = await S(pg).catch(() => null); if (s && s.state === 'play') break; await sleep(150); } await sleep(1500); };
  const key = async (pg, a) => { const k = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown', TAP: 'Space' }[a]; await pg.keyboard.down(k); await sleep(50); await pg.keyboard.up(k); };
  const sync = async (pg, t, P) => { const target = ((t % P) + P) % P, t0 = Date.now(); let cur = -1;
    while (Date.now() - t0 < 40000) { const s = await S(pg); const d = ((target - s.time % P) % P + P) % P; if (d < 0.025 || d > P - 0.01) break;
      const want = d > 0.6 ? 1 : d > 0.15 ? 0.2 : 0.04; if (want !== cur) { await ts(pg, want); cur = want; } await sleep(d > 0.6 ? 50 : 10); } await ts(pg, 0.03); };
  const settle = async (pg) => { for (let k = 0; k < 200; k++) { const s = await S(pg); if (s.mode !== 'fly') break; await sleep(40); } };
  const play = async (pg, n, moves) => { const T = timed(n, moves); for (const s of T.steps) { if (!s.full) await sync(pg, s.t, T.P); await key(pg, s.a); await sleep(40); await ts(pg, 1); await settle(pg); await sleep(250); } return T; };
  const freezeAt = async (pg, t, P) => { await sync(pg, t, P); await sleep(150); await ts(pg, 0.0001); await sleep(250); };
  const shot = async (pg, name) => { await pg.screenshot({ path: `${out}/${name}.png` }); console.log('saved', name); };

  // 1 chapter select on chapter 4 (phone portrait)
  let pg = await open('phone'); await pg.goto(url + '?unlock&select&ch=4'); await sleep(5500); await shot(pg, '01_select_ch4_phone');
  // 2 asteroid field (phone): first hop done, rocks drifting on their tracks
  await load(pg, '?unlock&ch=4&level=1'); await play(pg, 0, [['R', '11,20'], ['U', '11,16']]); await sleep(1200); await shot(pg, '02_asteroids_4-1_phone');
  // 3 dust rings (phone): resting in the calm eye of the first ring
  await load(pg, '?unlock&ch=4&level=2'); await play(pg, 1, [['U', '1,13'], ['R', '3,13']]); await sleep(900); await shot(pg, '03_dust_rings_4-2_phone');
  // 4 cosmic hail (phone): lane 0 telegraphing while lane 1 is mid-barrage
  await load(pg, '?unlock&ch=4&level=3'); { const L = SIM.parseLevel(CH[C4].levels[2]);
    let best = 0; for (let q = 0; q < 400; q++) { const t = q * L.period / 400; const a = SIM.hailPhase(L, L.hail[0], t), c = SIM.hailPhase(L, L.hail[1], t); if (a.ph === 'tele' && a.u > 0.55 && c.ph === 'hail' && c.u > 0.3) { best = t; break; } }
    await freezeAt(pg, best, L.period); await shot(pg, '04_cosmic_hail_telegraph_barrage_4-3_phone'); await ts(pg, 1); }
  await pg.context().close();
  // 5 landscape phone: meteor crossing
  pg = await open('landscape'); await load(pg, '?unlock&ch=4&level=4'); await play(pg, 3, [['R', '8,14'], ['U', '8,10']]); await sleep(1000); await shot(pg, '05_meteor_crossing_4-4_landscape'); await pg.context().close();
  // 6 desktop finale: the long boosted loop through the rock belt and hail, then into the rings
  pg = await open('desktop'); await load(pg, '?unlock&ch=4&level=5');
  { const T = timed(4, [['R', '13,1']]); await sync(pg, T.steps[0].t, T.P); await key(pg, 'R'); await sleep(40); await ts(pg, 1);
    for (let k = 0; k < 120; k++) { const s = await pg.evaluate(() => ({ x: window.__pp.st.x, y: window.__pp.st.y, m: window.__pp.st.mode })); if (s.m !== 'fly' || (s.x > 26 * 48 && s.y < 17 * 48)) break; await sleep(8); }
    await ts(pg, 0.0001); await sleep(300); await shot(pg, '06_finale_boost_through_hail_4-5_desktop'); await ts(pg, 1); await settle(pg); await sleep(300); }
  { const T = timed(4, [['R', '13,1'], ['D', '13,10']]); await sync(pg, T.steps[1].t, T.P); await key(pg, 'D'); await sleep(40); await ts(pg, 1); await settle(pg); await sleep(900); await shot(pg, '07_finale_rings_4-5_desktop'); }
  await pg.context().close();
  console.log('previews done', errs); await b.close();
})();
