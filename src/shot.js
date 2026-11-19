// node shot.js <url> <out.png> <w> <h> [mobile] [waitms] [js-after]
const p = require('/workspace/tools/gdexp/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const [url, out, w, h, mob, wait, js] = process.argv.slice(2);
  const b = await p.launch({executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const pg = await b.newPage();
  const m = mob === '1';
  await pg.emulate({viewport: {width: +w, height: +h, deviceScaleFactor: m ? 3 : 1, isMobile: m, hasTouch: m}, userAgent: m ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36'});
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m2 => { if (m2.type() === 'error' || /Error|error/.test(m2.text())) errs.push('CONSOLE ' + m2.text()); });
  await pg.goto(url); await sleep(+(wait || 5000));
  if (js) { console.log('js:', JSON.stringify(await pg.evaluate(js))); await sleep(1500); }
  await pg.screenshot({path: out});
  const s = await pg.evaluate(() => ({ scene: window.__ppScene && window.__ppScene.getName(), log: window.__ppC && window.__ppC.log, glog: window.__pp && window.__pp.log, fps: window.__ppScene && Math.round(1000 / window.__ppScene.getTimeManager().getElapsedTime()) }));
  console.log(JSON.stringify(s), errs.slice(0, 10));
  await b.close();
})();
