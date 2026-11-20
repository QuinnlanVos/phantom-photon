// Capture the Song of Rainbows preview screenshots (Playwright chromium; phone portrait / landscape / desktop).
// node previews_rainbow.js <url> <outdir>
const pw = require('/workspace/tools/pw/node_modules/playwright');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const VIEWS = { desktop: [1280, 800, 1, false], phone: [390, 844, 3, true], landscape: [844, 390, 3, true] };
(async () => {
  const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (view) => { const V = VIEWS[view]; const ctx = await b.newContext({ viewport: { width: V[0], height: V[1] }, deviceScaleFactor: V[2], isMobile: V[3], hasTouch: V[3] });
    const pg = await ctx.newPage(); pg.on('pageerror', e => { if (!/gdevelop-app\.com|analytics/i.test(e.message)) errs.push(e.message); }); return pg; };
  const S = (pg) => pg.evaluate(() => { const G = window.__pp; return G ? { state: G.state, mode: G.st.mode, bow: !!G.st.bow, log: G.log.slice() } : null; });
  const ts = (pg, v) => pg.evaluate((v) => window.__ppScene.getTimeManager().setTimeScale(v), v);
  const load = async (pg, q) => { await pg.goto(url + q); for (let k = 0; k < 80; k++) { const s = await S(pg).catch(() => null); if (s && s.state === 'play') break; await sleep(150); } await sleep(1500); };
  const key = async (pg, a) => { const k = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' }[a]; await pg.keyboard.down(k); await sleep(50); await pg.keyboard.up(k); };
  const settle = async (pg) => { for (let k = 0; k < 200; k++) { const s = await S(pg); if (s.mode !== 'fly') break; await sleep(40); } await sleep(300); };
  const play = async (pg, moves) => { for (const a of moves) { await key(pg, a); await settle(pg); } };
  // press a move, wait until the log shows `ev` (or the photon is riding a rainbow), let it run `after` ms, then freeze
  const freezeOn = async (pg, a, ev, after) => { const n0 = (await S(pg)).log.length; await key(pg, a);
    for (let k = 0; k < 300; k++) { const s = await S(pg); if (s.log.slice(n0).some(l => l.startsWith(ev)) || (ev === 'ride' && s.bow)) break; await sleep(10); }
    await sleep(after); await ts(pg, 0.0001); await sleep(350); };
  const thaw = async (pg) => { await ts(pg, 1); await settle(pg); };
  const shot = async (pg, name) => { await pg.screenshot({ path: `${out}/${name}.png` }); console.log('saved', name); };

  let pg = await open('phone'); await pg.goto(url + '?unlock&select&ch=5'); await sleep(5500); await shot(pg, '01_select_ch5_phone');
  await load(pg, '?unlock&ch=5&level=1'); await play(pg, ['R']); await freezeOn(pg, 'U', 'ride', 260); await shot(pg, '02_riding_rainbow_5-1_phone'); await thaw(pg);
  await load(pg, '?unlock&ch=5&level=2'); await play(pg, ['R', 'U']); await freezeOn(pg, 'L', 'prism', 180); await shot(pg, '03_prism_red_light_5-2_phone'); await thaw(pg);
  await play(pg, ['D', 'R']); await freezeOn(pg, 'U', 'stick', 400); await shot(pg, '04_red_gate_opens_5-2_phone'); await thaw(pg);
  await load(pg, '?unlock&ch=5&level=3'); await play(pg, ['R']); await freezeOn(pg, 'U', 'rain', 450); await shot(pg, '05_cloud_bursts_rain_5-3_phone'); await thaw(pg);
  await pg.context().close();
  pg = await open('landscape'); await load(pg, '?unlock&ch=5&level=4'); await freezeOn(pg, 'U', 'prism', 200); await shot(pg, '06_rainbow_through_prism_5-4_landscape'); await thaw(pg); await pg.context().close();
  pg = await open('desktop'); await load(pg, '?unlock&ch=5&level=5'); await play(pg, ['U', 'R', 'U', 'R', 'D']); await freezeOn(pg, 'L', 'ride', 300); await shot(pg, '07_finale_rain_revealed_rainbow_5-5_desktop'); await thaw(pg);
  await play(pg, ['L', 'D']); await freezeOn(pg, 'U', 'ride', 350); await shot(pg, '08_finale_last_rainbow_to_exit_5-5_desktop'); await thaw(pg);
  await pg.context().close();
  console.log('previews done', errs); await b.close();
})();
