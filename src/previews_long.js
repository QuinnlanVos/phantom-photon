// Capture the longer-levels / grand-finale previews (Playwright chromium, phone portrait).
// node previews_long.js <url> <outdir>
const pw = require('/workspace/tools/pw/node_modules/playwright');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const S = () => pg.evaluate(() => { const G = window.__pp; return G ? { state: G.state, mode: G.st.mode, log: G.log.slice(), hz: (G.hails || []).map(h => [h.ph, h.cx, h.cy]), x: G.st.x, y: G.st.y } : null; });
  const ts = (v) => pg.evaluate((v) => window.__ppScene.getTimeManager().setTimeScale(v), v);
  const load = async (q) => { await pg.goto(url + q); for (let k = 0; k < 80; k++) { const s = await S().catch(() => null); if (s && s.state === 'play') break; await sleep(150); } await sleep(1800); };
  const shot = async (name) => { await pg.screenshot({ path: `${out}/${name}.png` }); console.log('saved', name); };
  const key = async (a) => { const k = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown', TAP: 'Space' }[a]; await pg.keyboard.down(k); await sleep(50); await pg.keyboard.up(k); };
  const settle = async () => { for (let k = 0; k < 200; k++) { const s = await S(); if (s.state === 'play' && s.mode === 'stuck') break; await sleep(40); } await sleep(250); };
  // wait for a lane on screen (near the photon) to strike, then freeze
  const strike = async () => { for (let k = 0; k < 400; k++) { const s = await S(); if (s.hz.some(([ph, x, y]) => ph === 'hail' && Math.abs(x - s.x) < 300 && Math.abs(y - s.y) < 500)) break; await sleep(15); }
    await sleep(90); await ts(0.0001); await sleep(300); };
  const route = (c, n) => { const CH = require('./chapters.json'); const { analyze } = require('./solve.js'); return analyze(CH[c].levels[n]).win.filter(t => t !== 'w').map(t => t.split('>')[0]); };

  await pg.goto(url + '?unlock&select&ch=5'); await sleep(5500); await shot('01_level_select_8_levels_finale_crown_ch5');
  await pg.goto(url + '?unlock&select&ch=2'); await sleep(5500); await shot('02_level_select_9_levels_ch2');
  // finale with the lives HUD: Rainbow's End, a few moves in, near a lightning lane
  await load('?unlock&ch=5&level=8'); await shot('03_finale_lives_hud_5-8_start');
  // (lost-life + game-over shots come from test_long.js, which syncs to the hazard timing)
  // new long levels
  await load('?unlock&ch=4&level=6'); { const rt = route(3, 5); for (const a of rt.slice(0, 3)) { await key(a); await settle(); } } await shot('06_long_level_4-6_meteor_shaft');
  await load('?unlock&ch=5&level=7'); await strike(); await shot('07_long_level_5-7_thunder_meadow_lightning'); await ts(1);
  await load('?unlock&ch=2&level=7'); await shot('08_long_level_2-7_deep_descent');
  await load('?unlock&ch=3&level=8'); await shot('09_finale_3-8_solar_summit');
  console.log('errors', JSON.stringify(errs.slice(0, 3))); await b.close();
})();
