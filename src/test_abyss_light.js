// Usage (needs playwright): node test_abyss_light.js webkit|chromium <url> /tmp/prefix ["iPhone 13"]  -> screenshots; check play-area brightness:
// expected (phone): Abyss normal ~18-40 (dim but readable), mid-flare >100, chapter 1 ~46, ?lite ~49.
// Abyss lighting shots + play-area brightness: normal, cloud, mid-flare. node abyss.js <engine> <base> <outprefix> [device]
const pw = require('playwright'); const sleep = ms => new Promise(r => setTimeout(r, ms));
const [eng, base, pre, dev] = process.argv.slice(2);
(async () => {
  const b = await pw[eng].launch(eng === 'chromium' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] } : {});
  const ctx = await b.newContext({ ...pw.devices[dev || 'iPhone 13'], hasTouch: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const go = async (q, wait) => { await pg.goto(base + (base.includes('?') ? '&' : '?') + q); await sleep(wait || 5000); };
  const info = () => pg.evaluate(() => ({ log: window.__pp.log.slice(-4).join('|'), amb: window.__pp.amb, flares: window.__pp.flares || 0, amp: +window.__pp.flareAmp.toFixed(2) }));
  const out = [];
  const waitAge = async (a) => { for (let k = 0; k < 200; k++) { if (await pg.evaluate((a) => window.__pp.flareAge >= a && window.__pp.flareAge < 50, a)) return; await sleep(50); } };
  const waitTele = async () => { for (let k = 0; k < 200; k++) { if (await pg.evaluate(() => window.__pp.flareStar && window.__pp.flareStar.tele > 0.6)) return; await sleep(50); } };
  await go('ch=2&level=1&unlock'); await pg.evaluate(() => { window.__pp.flareT = 99; }); await sleep(300); await pg.screenshot({ path: pre + '_2-1.png' }); out.push(['2-1', await info()]);
  await go('ch=2&level=4&unlock'); await pg.evaluate(() => { window.__pp.flareT = 99; }); await sleep(300); await pg.screenshot({ path: pre + '_2-4cloud.png' }); out.push(['2-4', await info()]);
  await go('ch=2&level=3&unlock'); await pg.evaluate(() => { window.__pp.flareT = 99; }); await sleep(300); await pg.screenshot({ path: pre + '_2-3.png' }); out.push(['2-3', await info()]);
  await pg.evaluate(() => { window.__pp.flareT = 1.2; }); await waitTele(); await pg.screenshot({ path: pre + '_2-3tele.png' }); out.push(['tele', await info()]);
  await waitAge(0.35); await pg.screenshot({ path: pre + '_2-3flare.png' }); out.push(['flare', await info()]);
  await waitAge(3.2); out.push(['after', await info()]);
  await go('ch=2&level=5&unlock'); await pg.evaluate(() => { window.__pp.flareT = 1.05; }); await waitAge(0.6); await pg.screenshot({ path: pre + '_2-5flarecloud.png' }); out.push(['2-5flare', await info()]);
  await go('ch=2&level=4&unlock&lite'); await pg.screenshot({ path: pre + '_2-4lite.png' }); out.push(['lite', await info()]);
  await go('ch=1&level=1'); await pg.screenshot({ path: pre + '_1-1.png' }); out.push(['1-1', await info()]);
  console.log(JSON.stringify(out), errs);
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
