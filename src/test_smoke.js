// node test_smoke.js <url> <outPrefix> <w> <h> [mobile]
const p = require('/workspace/tools/gdexp/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const [url, out, w, h, mob] = process.argv.slice(2);
  const b = await p.launch({executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const pg = await b.newPage();
  await pg.emulate({viewport: {width: +w, height: +h, deviceScaleFactor: mob ? 3 : 1, isMobile: !!mob, hasTouch: !!mob}, userAgent: mob ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36'});
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto(url); await sleep(5000);
  await pg.screenshot({path: out + '.png'});
  const s = await pg.evaluate(() => window.__pp ? {state: window.__pp.state, level: window.__pp.level, log: window.__pp.log, zoom: window.__pp.zoom} : 'no __pp');
  console.log(JSON.stringify(s), errs);
  await b.close();
})();
