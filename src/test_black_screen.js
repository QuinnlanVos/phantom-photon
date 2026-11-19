// Usage (needs playwright): node test_black_screen.js webkit|chromium <url> out.png "iPhone 13"|"Surface Duo" [extra chrome flags]
// Regression test for the chapter-1 black play area: compare play-area brightness of out.png (old build ~1, fixed ~30-50).
// menu -> PLAY -> level select -> tap 1-1, real browser engine via Playwright; prints play-area brightness
const pw = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [eng, url, out, dev, extra] = process.argv.slice(2);
(async () => {
  const b = await pw[eng].launch(eng === 'chromium' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', ...(extra ? extra.split(' ') : [])] } : {});
  const ctx = await b.newContext({ ...pw.devices[dev], hasTouch: true, isMobile: eng !== 'firefox' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url); await sleep(4500);
  const tap = async (expr) => {
    const [cx, cy] = await pg.evaluate((e) => { const o = eval(e); const C = window.__ppC; return [o.x * C.uiS * innerWidth / C.rw, o.y * C.uiS * innerHeight / C.rh]; }, expr);
    await pg.touchscreen.tap(cx, cy);
  };
  const waitScene = async n => { for (let k = 0; k < 100 && await pg.evaluate(() => window.__ppScene && window.__ppScene.getName()) !== n; k++) await sleep(100); };
  await tap('window.__ppMenu.play'); await waitScene('LevelSelect'); await sleep(2500);
  await tap('window.__ppSel.cards[0].nodes[0]'); await waitScene('Game'); await sleep(3000);
  await pg.screenshot({ path: out });
  const info = await pg.evaluate(() => ({ scene: window.__ppScene.getName(), log: window.__pp && window.__pp.log.join('|'), gl: window.__ppScene.getGame().getRenderer().getPIXIRenderer().type }));
  console.log(eng, dev, JSON.stringify(info), errs);
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
