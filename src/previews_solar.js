// Capture the Solar Winds preview screenshots (headless Chrome). node previews_solar.js <url> <outdir>
const p = require('/workspace/tools/gdexp/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, out] = process.argv.slice(2);
const VIEWS = { desktop: [1280, 800, 1, false], phone: [390, 844, 3, true], landscape: [844, 390, 3, true] };
(async () => {
  const b = await p.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (view, q, wait) => {
    const pg = await b.newPage(); const V = VIEWS[view];
    await pg.emulate({ viewport: { width: V[0], height: V[1], deviceScaleFactor: V[2], isMobile: V[3], hasTouch: V[3] }, userAgent: V[3] ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36' });
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(url + q); await sleep(wait || 6000); return pg;
  };
  const S = (pg) => pg.evaluate(() => ({ mode: window.__pp.st.mode, i: window.__pp.st.i, j: window.__pp.st.j, t: window.__pp.st.t || 0, rail: !!window.__pp.st.rail, ts: window.__pp.st.ts || 1 }));
  const key = async (pg, k) => { await pg.keyboard.down(k); await sleep(90); await pg.keyboard.up(k); };
  const settle = async (pg) => { for (let k = 0; k < 200; k++) { if ((await S(pg)).mode !== 'fly') break; await sleep(50); } await sleep(400); };
  const ts = (pg, v) => pg.evaluate((v) => window.__ppScene.getTimeManager().setTimeScale(v), v);
  const keys = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' };
  const moves = async (pg, seq) => { for (const a of seq) { await key(pg, keys[a]); await sleep(100); await settle(pg); } };
  // fire a move in slow motion and shoot once the condition holds (mid-flight frames)
  const midShot = async (pg, a, cond, file, scale) => {
    await ts(pg, scale || 0.12); await key(pg, keys[a]);
    for (let k = 0; k < 400; k++) { const s = await S(pg); if (cond(s)) break; await sleep(30); }
    await sleep(250); await pg.screenshot({ path: `${out}/${file}` }); await ts(pg, 1); await settle(pg);
  };
  let pg;
  pg = await open('desktop', '?unlock&select&ch=3', 7000); await pg.screenshot({ path: `${out}/01_select_ch3_desktop.png` }); await pg.close();
  pg = await open('phone', '?unlock&select&ch=3', 8000); await pg.screenshot({ path: `${out}/02_select_ch3_phone.png` }); await pg.close();
  pg = await open('phone', '?unlock&ch=3&level=1', 6000);
  await moves(pg, ['R']); await midShot(pg, 'U', (s) => s.mode === 'fly' && s.t > 0.35, '03_winds_stardust_phone.png', 0.15); await pg.close();
  pg = await open('desktop', '?unlock&ch=3&level=2', 6000);
  await midShot(pg, 'L', (s) => s.rail, '04_curve_boost_desktop.png', 0.1); await pg.close();
  pg = await open('desktop', '?unlock&ch=3&level=3', 6000);
  await moves(pg, ['R', 'U', 'L']); await midShot(pg, 'U', (s) => s.mode === 'fly' && s.ts < 0.6, '05_gravity_well_slowmo_desktop.png', 0.3); await pg.close();
  pg = await open('desktop', '?unlock&ch=3&level=4', 6000);
  await midShot(pg, 'R', (s) => s.rail && s.j < 10, '06_combo_pipes_desktop.png', 0.1); await pg.close();
  pg = await open('landscape', '?unlock&ch=3&level=5', 6000);
  await moves(pg, ['L']); await midShot(pg, 'R', (s) => s.mode === 'fly' && s.j < 6, '07_finale_scrolled_landscape.png', 0.12); await pg.close();
  pg = await open('phone', '?unlock&ch=3&level=5', 6000);
  await moves(pg, ['L', 'R']); await sleep(1500); await pg.screenshot({ path: `${out}/08_finale_scrolled_phone.png` }); await pg.close();
  console.log('previews done', errs);
  await b.close();
})();
