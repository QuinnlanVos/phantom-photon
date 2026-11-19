// Records a slowed-down move as PNG frames + game timestamps -> make_gif.py builds the GIF.
// node make_gif.js <url> <framesDir> <level 1-5> "<setup moves>" <move>
const p = require('/workspace/tools/gdexp/node_modules/puppeteer-core');
const fs = require('fs'); const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, dir, level, setup, mv] = process.argv.slice(2);
const KEYS = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown', TAP: 'Space' };
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const b = await p.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage(); await pg.setViewport({ width: 720, height: 720 });
  await pg.goto(`${url}?notitle&level=${level}`); await sleep(4500);
  const settle = async () => { for (let k = 0; k < 80; k++) { if (await pg.evaluate(() => window.__pp.st.mode === 'stuck')) return; await sleep(60); } };
  for (const m of setup.split(' ').filter(Boolean)) { await pg.keyboard.press(KEYS[m]); await sleep(100); await settle(); }
  await sleep(900);
  const gt = () => pg.evaluate(() => window.__ppScene.getTimeManager().getTimeFromStart());
  await pg.evaluate(() => window.__ppScene.getTimeManager().setTimeScale(0.08));
  const times = []; let k = 0;
  const grab = async () => { times.push(await gt()); await pg.screenshot({ path: `${dir}/f${String(k++).padStart(3, '0')}.png` }); };
  for (let n = 0; n < 4; n++) { await grab(); await sleep(150); }
  await pg.keyboard.press(KEYS[mv]);
  let after = 0;
  for (let n = 0; n < 160; n++) { await grab(); const s = await pg.evaluate(() => [window.__pp.st.mode, window.__pp.state]); if (s[0] !== 'fly' || s[1] !== 'play') after++; if (after > 14) break; }
  fs.writeFileSync(`${dir}/times.json`, JSON.stringify(times));
  await b.close();
})();
