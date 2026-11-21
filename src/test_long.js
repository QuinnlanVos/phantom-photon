// Longer levels + grand finales test (Playwright: chromium or webkit). For chapters 2-6: level select shows every level
// (more nodes, a crown + FINALE label on the last one, everything inside the card and on screen), every new long level and
// finale is cleared from the solver's route, the finale shows 3 pinned lives, a death costs a life and respawns, losing all
// three shows the OUT OF LIGHT panel, RETRY restarts with 3 lives, LEVELS goes back to level select; normal levels have no lives.
// node test_long.js <chromium|webkit> <url> <desktop|phone|landscape> <outdir>      (ONLY=2,5 limits the chapters)
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
const BASE = { abyss: 6, winds: 5, rocks: 5, rainbow: 5, ice: 5 };
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
  let win = r.win.filter((t) => t !== 'w');   // no collapsing: a back-and-forth can pick up a colour or burst a cloud
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
    if (st.mode === 'dead') { st = SIM.clone(st); SIM.respawn(L, st); }
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
    return { state: G.state, level: G.level, chapter: G.chapter, mode: G.st.mode, i: G.st.i, j: G.st.j, ride: G.st.ride ? G.st.ride.m : -1, time: G.st.time || 0, log: G.log.slice(), deaths: G.deaths,
      shards: G.shards.filter(s => s.got).length, camX: G.camX, camY: G.camY, scroll: G.scroll, finale: !!G.finale, lives: G.lives, title: G.ui.level.getString(),
      lifeA: G.ui.lives.map((o) => Math.round(o.getOpacity())), lifeXY: G.ui.lives.map((o) => [Math.round(o.getX()), Math.round(o.getY())]),
      lifeOn: G.ui.lives.map((o) => o.getX() > 0 && o.getX() < C.UW && o.getY() > 0 && o.getY() < C.UH * 0.2),
      panel: G.btnNext.visible, btnLbl: G.btnNext.lbl ? G.btnNext.lbl.getString() : '', lvlBtn: G.btnLevels.visible, overA: Math.round(G.ui.overTitle.getOpacity()), overTx: G.ui.overTitle.getString(),
      scene: window.__ppScene.getName(), UW: C.UW, UH: C.UH }; });
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
    await touch('touchstart', id, cx - dx * 30, cy - dy * 30); await sleep(30);
    for (let k = 1; k <= 4; k++) { await touch('touchmove', id, cx - dx * 30 + dx * 18 * k, cy - dy * 30 + dy * 18 * k); await sleep(20); }
    await touch('touchend', id, cx + dx * 42, cy + dy * 42);
  };
  // tap / click a GDevelop button by its UI position (real touch on phones)
  const tapBtn = async (expr) => {
    const [cx, cy] = await pg.evaluate((e) => { const C = window.__ppC, b = eval(e); return [b.x * C.uiS * innerWidth / C.rw, b.y * C.uiS * innerHeight / C.rh]; }, expr);
    if (VIEW[3]) { await pg.touchscreen.tap(cx, cy); } else { await pg.mouse.move(cx, cy, { steps: 4 }); await sleep(120); await pg.mouse.down(); await sleep(90); await pg.mouse.up(); }
  };
  const settle = async () => { for (let k = 0; k < 260; k++) { const s = await S(); if ((s.state !== 'play' && s.state !== 'dying') || (s.state === 'play' && s.mode === 'stuck')) { await sleep(120); return S(); } await sleep(50); } return S(); };
  const ts = (v) => pg.evaluate((v) => window.__ppScene.getTimeManager().setTimeScale(v), v);
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
  const runSteps = async (id, steps, P, onStep) => {
    let s;
    for (const stp of steps) {
      if (P.timed && stp.win < 0.97) await syncPhase(stp.t, P.period);
      const before = (await S()).log.length;
      await act(stp.a); await sleep(40); await ts(1);
      s = await settle(); const nl = s.log.slice(before);
      const narrow = stp.win < 0.25;
      if (stp.res === 'exit') ok(nl.includes('exit') || s.state === 'clear', `${id}: ${stp.a} reaches the exit (window ${(stp.win * 100).toFixed(0)}%) [${nl.join(' | ')}]`);
      else (narrow ? soft : ok)(s.mode === 'stuck' && (s.ride >= 0 ? 'ride' + s.ride : `${s.i},${s.j}`) === stp.res, `${id}: ${stp.a} -> ${s.i},${s.j} (solver ${stp.res}, window ${(stp.win * 100).toFixed(0)}%) [${nl.slice(-6).join(' | ')}]`);
      if (onStep) await onStep(s);
      if (s.state !== 'play') break;
    }
    return s;
  };
  const chapters = CH.map((c, k) => k).filter((k) => BASE[CH[k].id] && (!process.env.ONLY || process.env.ONLY.split(',').includes(String(k + 1))));

  // ---------------------------------------------------------------- level select: more nodes, finale crown, fits on screen
  for (const c of (process.env.SKIP_PLAY ? [] : chapters)) {
    await pg.goto(url + `?unlock&select&ch=${c + 1}`); await sleep(4500);
    const sel = await pg.evaluate((c) => { const S = window.__ppSel, C = window.__ppC, cd = S.cards[c];
      const box = (o) => [o.getX(), o.getY(), o.getX() + o.getWidth(), o.getY() + o.getHeight()];
      return { cur: S.cur, n: cd.nodes.length, vis: cd.nodes.filter(b => b.visible).length, open: cd.nodes.filter(b => b.open).length,
        nodes: cd.nodes.map(b => [Math.round(b.x), Math.round(b.y), +(b.scale).toFixed(2)]), names: cd.nodes.map(b => box(b.nameTx).map(Math.round)),
        crowns: cd.nodes.map(b => b.crown ? Math.round(b.crown.getOpacity()) : -1), fin: cd.nodes.map(b => b.finTx ? b.finTx.getString() : ''),
        frame: box(cd.frame).map(Math.round), UW: C.UW, UH: C.UH, portrait: C.portrait }; }, c);
    const L = CH[c].levels.length, fr = sel.frame;
    ok(sel.cur === c && sel.n === L && sel.vis === L && sel.open === L, `${c + 1} select: ${L} level nodes shown (${sel.n} nodes, ${sel.vis} visible)`);
    const inside = sel.nodes.every(([x, y]) => x > fr[0] && x < fr[2] && y > fr[1] && y < fr[3]) && sel.names.every(([x0, y0, x1, y1]) => x0 >= fr[0] - 2 && x1 <= fr[2] + 2 && y1 <= fr[3] + 2);
    ok(inside && fr[0] >= -1 && fr[2] <= sel.UW + 1 && fr[3] <= sel.UH + 1, `${c + 1} select: every node + name inside the card, card on screen (${sel.portrait ? 'portrait' : 'landscape'} ${sel.UW}x${sel.UH}, card ${fr})`);
    let minD = 1e9; for (let p = 0; p < L; p++) for (let q = p + 1; q < L; q++) minD = Math.min(minD, Math.hypot(sel.nodes[p][0] - sel.nodes[q][0], sel.nodes[p][1] - sel.nodes[q][1]));
    let ovl = 0; for (let p = 0; p < L; p++) for (let q = p + 1; q < L; q++) { const A = sel.names[p], B = sel.names[q]; if (A[0] < B[2] - 1 && B[0] < A[2] - 1 && A[1] < B[3] - 1 && B[1] < A[3] - 1) ovl++; }
    ok(minD > 70 * sel.nodes[0][2] && ovl === 0, `${c + 1} select: nodes spaced (closest ${minD.toFixed(0)} UI px) and no level names overlap (${ovl})`);
    ok(sel.crowns.slice(0, -1).every(v => v === -1) && sel.crowns[L - 1] > 200 && sel.fin[L - 1] === 'FINALE', `${c + 1} select: only the last level wears the crown + FINALE badge (${sel.crowns.join(',')})`);
    await pg.screenshot({ path: `${outdir}/${tag}_select_ch${c + 1}.png` });
  }

  // ---------------------------------------------------------------- play the new long levels + finales from the solver route
  for (const c of (process.env.SKIP_PLAY ? [] : chapters)) {
    for (let n = BASE[CH[c].id]; n < CH[c].levels.length; n++) {
      const def = CH[c].levels[n], id = `${c + 1}-${n + 1}`, fin = !!def.finale;
      await load(`?unlock&ch=${c + 1}&level=${n + 1}`);
      let s = await S();
      ok(s.chapter === c && s.level === n && s.scroll && s.finale === fin && s.lives === (fin ? 3 : 0) && /FINALE/.test(s.title) === fin,
        `${id} "${def.name}" loaded: follow camera, ${fin ? 'FINALE with 3 lives' : 'normal level, no lives'} (${s.title})`);
      if (fin) ok(s.lifeA.every(a => a === 255) && s.lifeOn.every(Boolean), `${id}: three life icons pinned in the HUD ${JSON.stringify(s.lifeXY)}`);
      else ok(s.lifeA.every(a => a === 0), `${id}: no life icons on a normal level`);
      const P = plan(c, n); const xy0 = JSON.stringify(s.lifeXY); let pinned = true; const cams = [[s.camX, s.camY]];
      if (fin) await pg.screenshot({ path: `${outdir}/${tag}_${id}_finale_start.png` });
      s = await runSteps(id, P.steps, P, async (s2) => { if (s2.state === 'play') { cams.push([s2.camX, s2.camY]); if (fin && JSON.stringify(s2.lifeXY) !== xy0) pinned = false; } });
      s = await S();
      ok(s.state === 'clear' && s.shards >= P.shards, `${id} cleared in ${P.steps.length} moves; ${s.shards}/${P.total} shards (solver route collects ${P.shards})`);
      const xs = cams.map(q => q[0]), ys = cams.map(q => q[1]); const pan = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / SIM.T;
      ok(pan > (VIEW[3] ? 3 : 1.5), `${id} camera followed the orb across the long level (panned ${pan.toFixed(1)} tiles)`);
      if (fin) ok(pinned, `${id}: lives stayed pinned while the camera moved`);
      if (n === CH[c].levels.length - 2) await pg.screenshot({ path: `${outdir}/${tag}_${id}_clear.png` });
    }
  }

  // ---------------------------------------------------------------- finale lives: lose a life, respawn, game over, RETRY, LEVELS
  for (const c of chapters) {
    const n = CH[c].levels.length - 1, def = CH[c].levels[n], id = `${c + 1}-${n + 1}`;
    const r = analyze(def);
    const dp = r.deaths.map((d) => d.replace(/ \([a-z]+\)$/, '').split(' ').filter((t) => t && t !== 'w')).filter((p) => p.filter((t) => t.endsWith('>dead')).length === 1 && p[p.length - 1].endsWith('>dead')).sort((a, b) => a.length - b.length)[0];
    const dtype = (r.deaths.find((d) => d.replace(/ \([a-z]+\)$/, '').split(' ').filter((t) => t && t !== 'w').join(' ') === (dp || []).join(' ')) || '').match(/\(([a-z]+)\)$/);
    if (!dp) { soft(false, `${id}: no single-move death found for the lives check (its hazard only kills while you wait)`); continue; }
    const P = plan(c, n, dp); const pre = P.steps.slice(0, -1), kill = P.steps[P.steps.length - 1];
    await load(`?unlock&ch=${c + 1}&level=${n + 1}`);
    if (pre.length) await runSteps(id, pre, P);
    for (let life = 2; life >= 0; life--) {
      if (P.timed && kill.win < 0.97) await syncPhase(kill.t, P.period);
      await act(kill.a); await sleep(40); await ts(1);
      let s; for (let k = 0; k < 120; k++) { s = await S(); if (s.state === 'dying' || s.state === 'over') break; await sleep(40); }
      ok(s.state === 'dying' && s.lives === life && s.log.includes('life-lost ' + life), `${id}: ${kill.a} into ${dtype ? dtype[1] : 'a hazard'} costs a life -> ${s.lives} left [${s.log.slice(-3).join(' | ')}]`);
      await sleep(450); s = await S();
      ok(s.lifeA[life] < 255 && s.lifeA.slice(0, life).every(a => a === 255), `${id}: life icon ${life + 1} dims (${s.lifeA.join(',')})`);
      if (life === 1) await pg.screenshot({ path: `${outdir}/${tag}_${id}_lost_life.png` });
      s = await settle();
      if (life > 0) ok(s.state === 'play' && s.mode === 'stuck' && s.log.some(l => l.startsWith('respawn')), `${id}: respawned with ${s.lives} lives at ${s.i},${s.j}`);
      else {
        for (let k = 0; k < 60; k++) { s = await S(); if (s.panel && s.overA > 200) break; await sleep(60); }
        ok(s.state === 'over' && s.log.includes('game-over') && s.panel && s.btnLbl === 'RETRY' && s.lvlBtn && s.overA > 200 && /OUT OF LIGHT/.test(s.overTx), `${id}: 0 lives -> OUT OF LIGHT panel with RETRY + LEVELS ${JSON.stringify([s.state, s.panel, s.btnLbl, s.lvlBtn, s.overA, s.overTx, s.log.slice(-4)])}`);
        await sleep(400); await pg.screenshot({ path: `${outdir}/${tag}_${id}_game_over.png` });
        const n0 = s.log.length; await act('U'); await sleep(300); s = await S();
        ok(s.state === 'over' && !s.log.slice(n0).some(l => l.startsWith('move')), `${id}: swipes do nothing behind the game-over panel`);
      }
    }
    await tapBtn('window.__pp.btnNext'); await sleep(1200); let s = await S();
    for (let k = 0; k < 20 && !s.lifeA.every(a => a === 255); k++) { await sleep(200); s = await S(); }
    ok(s.state === 'play' && s.lives === 3 && s.level === n && s.chapter === c && s.log.includes('retry') && s.lifeA.every(a => a === 255) && `${s.i},${s.j}` === r.L.start.join(','),
      `${id}: RETRY restarts the finale at the start with 3 lives ${JSON.stringify([s.state, s.lives, s.i, s.j, s.lifeA, s.chapter, s.level, s.log.slice(-3)])}`);
    if (c === chapters[chapters.length - 1]) {    // LEVELS from the game-over panel goes to level select
      if (pre.length) await runSteps(id, pre, P);
      for (let k = 0; k < 3; k++) { if (P.timed && kill.win < 0.97) await syncPhase(kill.t, P.period); await act(kill.a); await sleep(40); await ts(1); await sleep(300); await settle(); }
      for (let k = 0; k < 60; k++) { s = await S(); if (s.panel) break; await sleep(60); } await sleep(500);
      await tapBtn('window.__pp.btnLevels'); await sleep(1800);
      let sc = await pg.evaluate(() => window.__ppScene.getName());
      for (let k = 0; k < 30 && sc !== 'LevelSelect'; k++) { await sleep(200); sc = await pg.evaluate(() => window.__ppScene.getName()); }   // slow software-GL frames
      ok(sc === 'LevelSelect', `${id}: LEVELS on the game-over panel goes to level select (${sc})`);
    }
  }
  // normal levels: unlimited retries (die 4 times on a long level that has hazards, never a game over)
  for (const c of chapters) {
    const n = CH[c].levels.length - 2, def = CH[c].levels[n], r = analyze(def); if (!r.deaths.length) continue;
    const dp = r.deaths.map((d) => d.replace(/ \([a-z]+\)$/, '').split(' ').filter((t) => t && t !== 'w')).filter((p) => p.filter((t) => t.endsWith('>dead')).length === 1 && p[p.length - 1].endsWith('>dead')).sort((a, b) => a.length - b.length)[0];
    if (!dp) continue;
    const P = plan(c, n, dp); const pre = P.steps.slice(0, -1), kill = P.steps[P.steps.length - 1];
    await load(`?unlock&ch=${c + 1}&level=${n + 1}`); if (pre.length) await runSteps(`${c + 1}-${n + 1}`, pre, P);
    for (let k = 0; k < 4; k++) { if (P.timed && kill.win < 0.97) await syncPhase(kill.t, P.period); await act(kill.a); await sleep(40); await ts(1); await sleep(300); await settle(); }
    const s = await S();
    ok(s.state === 'play' && s.deaths >= 4 && s.lives === 0 && !s.log.includes('game-over'), `${c + 1}-${n + 1}: a normal level keeps unlimited retries (${s.deaths} deaths, still playing)`);
    break;
  }
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 5)));
  console.log((fails ? `${fails} FAILED` : 'ALL PASSED') + (warns ? ` (${warns} warnings)` : ''), tag);
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e.stack); process.exit(2); });
