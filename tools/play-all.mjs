// Headless play-through for Chomp Benji Chomp.
// Uses the in-page solver (window.__benji.solve / runSim / stepSim).
// Run: PLAYWRIGHT_PATH=/path/to/node_modules/playwright/index.js node tools/play-all.mjs --browser chromium --width 1280 --height 800 --shots docs/levels-v10.3
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const pwPath = process.env.PLAYWRIGHT_PATH || 'playwright';
const { chromium, webkit } = pwPath.startsWith('/')
  ? createRequire(pwPath)('playwright')
  : createRequire(import.meta.url)('playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1']);
  return a;
}, []));
const browserName = args.browser || 'chromium';
const width = +args.width || 1280;
const height = +args.height || 800;
const shots = args.shots && args.shots !== '0' ? args.shots : '';
const click = args.click !== '0';
const file = args.file || '/workspace/index.html';

function auditInPage() {
  const DNAME = ['L', 'D', 'U', 'R'];
  const FAILS = ['water', 'urchin', 'blocked'];
  const B = window.__benji;
  const out = { worlds: [], errors: [] };
  function alive(L, maxDepth) {
    const key = (p, m) => p[0] + ',' + p[1] + '|' + m;
    let startPos = null;
    for (let r = 0; r < L.grid.length; r++) { const c = L.grid[r].indexOf('S'); if (c >= 0) startPos = [r, c]; }
    const seen = new Set([key(startPos, 0)]);
    let frontier = [{ pos: startPos, mask: 0 }];
    for (let depth = 0; depth < maxDepth; depth++) {
      const next = [];
      for (const n of frontier) for (let d = 0; d < 4; d++) {
        const r = B.stepSim(L, n.pos, d, n.mask);
        if (FAILS.includes(r.type)) continue;
        const p = r.type === 'warp' ? r.dest : r.to;
        const k = key(p, r.mask);
        if (seen.has(k)) continue;
        seen.add(k); next.push({ pos: p, mask: r.mask });
      }
      frontier = next;
    }
    return [...seen].map(k => { const [rc, m] = k.split('|'); const [r, c] = rc.split(',').map(Number); return { pos: [r, c], mask: +m }; });
  }
  function canWin(L, pos, mask, cap) {
    const key = (p, m) => p[0] + ',' + p[1] + '|' + m;
    const seen = new Set([key(pos, mask)]);
    let frontier = [{ pos, mask }];
    for (let depth = 0; depth < cap; depth++) {
      const next = [];
      for (const n of frontier) for (let d = 0; d < 4; d++) {
        const r = B.stepSim(L, n.pos, d, n.mask);
        if (r.type === 'goal') return true;
        if (FAILS.includes(r.type)) continue;
        const p = r.type === 'warp' ? r.dest : r.to;
        const k = key(p, r.mask);
        if (seen.has(k)) continue;
        seen.add(k); next.push({ pos: p, mask: r.mask });
      }
      frontier = next;
    }
    return false;
  }
  B.LEVELS.forEach((world, diff) => {
    const levels = [];
    world.levels.forEach((L, i) => {
      const sol = B.solve(L);
      const sim = sol && B.runSim(L, sol);
      const rec = {
        i, name: L.name || '', slots: L.slots, len: sol ? sol.length : null,
        dirs: sol ? sol.map(d => DNAME[d]).join('') : '',
        result: sim ? sim.result : 'none',
        tiles: L.grid.join('').replace(/\./g, '').length,
        rows: L.grid.length, cols: L.grid[0].length,
      };
      if (!sol) rec.bad = 'unsolvable';
      else if (sim.result !== 'goal') rec.bad = 'runSim ' + sim.result;
      else if (sol.length > L.slots) rec.bad = 'longer than slots';
      if (diff === 3) {
        if (i === 0) {
          if (rec.dirs !== 'RRRRRL' || L.slots !== 7) rec.bad = (rec.bad ? rec.bad + '; ' : '') + 'five rights shape';
          const extra = B.runSim(L, sol.concat(sol[sol.length - 1]));
          if (!extra || extra.result !== 'water') rec.bad = (rec.bad ? rec.bad + '; ' : '') + 'extra left is ' + (extra && extra.result);
        } else if (sol && sol.length !== L.slots) rec.bad = (rec.bad ? rec.bad + '; ' : '') + 'slots ' + L.slots + ' != ' + sol.length;
        if (i === 1 && sol && !sol.every(d => d === 3)) rec.bad = (rec.bad ? rec.bad + '; ' : '') + 'not all rights';
        if (i === 2 && sol && sol[0] !== 1) rec.bad = (rec.bad ? rec.bad + '; ' : '') + 'first move not down';
        if (i === 3 && sol) {
          let pos = null, mask = 0, warps = [];
          for (let r = 0; r < L.grid.length; r++) { const c = L.grid[r].indexOf('S'); if (c >= 0) pos = [r, c]; }
          sol.forEach((d, n) => {
            const step = B.stepSim(L, pos, d, mask);
            if (step.type === 'warp') warps.push(L.grid[step.to[0]][step.to[1]]);
            mask = step.mask; pos = step.type === 'warp' ? step.dest : step.to;
          });
          rec.warps = warps.join('');
          if (warps.join('') !== 'AaC') rec.bad = (rec.bad ? rec.bad + '; ' : '') + 'warps ' + warps.join('');
        }
        const states = alive(L, Math.min(L.slots, 15));
        let trapped = 0;
        for (const s of states) if (!canWin(L, s.pos, s.mask, 18)) trapped++;
        rec.states = states.length; rec.trapped = trapped;
        if (trapped) rec.bad = (rec.bad ? rec.bad + '; ' : '') + trapped + ' trapped';
      } else if (diff > 0 && sol && sol.length !== L.slots) {
        rec.bad = (rec.bad ? rec.bad + '; ' : '') + 'big/mega slots drift ' + sol.length;
      }
      if (rec.bad) out.errors.push(world.name + ' ' + (i + 1) + ' ' + rec.bad);
      levels.push(rec);
    });
    out.worlds.push({ name: world.name, color: world.color, levels });
  });
  out.prog = B.prog.slice();
  out.starKeys = [0, 1, 2, 3].map(i => 'v6stars' + i);
  return out;
}

const consoleErrors = [];
const pageErrors = [];
const browserType = browserName === 'webkit' ? webkit : chromium;
const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => pageErrors.push(String(err)));
await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
await page.waitForFunction(() => window.__benji && window.__benji.LEVELS && window.__benji.LEVELS.length === 4);
await page.waitForTimeout(600);
const portrait = height > width * 1.05;
const info = await page.evaluate(auditInPage);
info.viewport = { width, height, portrait };
info.consoleErrors = consoleErrors.slice();
info.pageErrors = pageErrors.slice();

if (shots) {
  await mkdir(shots, { recursive: true });
  await page.evaluate(() => { window.__benji.skipDemo(); });
  // title
  await page.evaluate(() => { const b = window.__benji; b.jump(0, 0); });
  // jump leaves us in play. Go home via the exported state... there is no home(). Click the back button.
  // Reload to land on the title, which is the initial state. We already left it. Click home.
  const home = await page.evaluate(() => {
    const b = window.__benji;
    // home button during play is id home at 14,12,84,84. Use toScreen of its center.
    return b.toScreen(14 + 42, 12 + 42);
  });
  // Actually jump already happened. Click back twice? jump sets play. One back opens select, not title.
  // Reload for a clean title shot.
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__benji && window.__benji.LEVELS.length === 4);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(shots, 'title.png') });
  // open Super Fin from the title button
  const tier = await page.evaluate(() => {
    const b = window.__benji;
    const n = b.LEVELS.length, bw = 270, gap = 16, x0 = (1280 - (n * bw + (n - 1) * gap)) / 2;
    const x = x0 + 3 * (bw + gap) + bw / 2, y = 290 + 70;
    return b.toScreen(x, y);
  });
  if (!portrait) {
    await page.mouse.click(tier.x, tier.y);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(shots, 'select.png') });
  }
  for (let i = 0; i < 12; i++) {
    await page.evaluate(i => { const b = window.__benji; b.jump(3, i); b.skipDemo(); }, i);
    await page.waitForTimeout(400);
    const meta = await page.evaluate(() => {
      const b = window.__benji;
      const L = b.level;
      return { name: L.name, tw: Math.round(b.geom(L).TW), treats: (b.treats || []).length, state: b.state, tutorial: !!b.tutorial };
    });
    info.worlds[3].levels[i].tw = meta.tw;
    info.worlds[3].levels[i].treats = meta.treats;
    info.worlds[3].levels[i].tutorial = meta.tutorial;
    const slug = String(i + 1).padStart(2, '0') + '-' + meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await page.screenshot({ path: join(shots, slug + '.png') });
    if (!meta.treats) info.errors.push('no treat on ' + meta.name);
  }
}

if (click && !portrait) {
  await page.evaluate(() => { const b = window.__benji; b.jump(3, 0); b.skipDemo(); });
  await page.waitForTimeout(200);
  const sol = await page.evaluate(() => window.__benji.solve(window.__benji.level));
  for (const d of sol) {
    const p = await page.evaluate(d => {
      const b = window.__benji;
      const a = b.ARROWS.find(x => x.dir === d);
      return b.toScreen(a.x + a.w / 2, a.y + a.h / 2);
    }, d);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(40);
  }
  const before = await page.evaluate(() => ({ q: window.__benji.queue.join(','), mode: window.__benji.mode }));
  const play = await page.evaluate(() => { const b = window.__benji; return b.toScreen(b.PLAY.x + b.PLAY.w / 2, b.PLAY.y + b.PLAY.h / 2); });
  await page.mouse.click(play.x, play.y);
  try {
    await page.waitForFunction(() => window.__benji.mode === 'win' || window.__benji.state === 'reward', null, { timeout: 12000 });
    info.clickWin = { ok: true, queue: before.q, mode: await page.evaluate(() => window.__benji.mode), state: await page.evaluate(() => window.__benji.state) };
    if (shots) await page.screenshot({ path: join(shots, 'win-five-rights.png') });
  } catch (e) {
    info.clickWin = { ok: false, queue: before.q, mode: await page.evaluate(() => window.__benji.mode), state: await page.evaluate(() => window.__benji.state), err: String(e).split('\n')[0] };
    info.errors.push('click win failed');
  }
} else info.clickWin = { ok: true, skipped: portrait ? 'portrait overlay' : 'click disabled' };

info.consoleErrors = consoleErrors.slice();
info.pageErrors = pageErrors.slice();
if (info.consoleErrors.length) info.errors.push('console errors ' + info.consoleErrors.length);
if (info.pageErrors.length) info.errors.push('page errors ' + info.pageErrors.length);
if (portrait) {
  const pix = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const ctx = c.getContext('2d');
    const x = Math.floor(c.width / 2), y = Math.floor(c.height * 0.5);
    const p = ctx.getImageData(x, y, 1, 1).data;
    return { r: p[0], g: p[1], b: p[2], w: innerWidth, h: innerHeight };
  });
  info.portraitPixel = pix;
  // The overlay is a dark blue wash. A bright title pixel would mean the overlay missed.
  if (pix.r > 80 || pix.g > 120) info.errors.push('portrait overlay not dark at center ' + JSON.stringify(pix));
}

const logName = `play-${browserName}-${width}x${height}.json`;
const logDir = 'docs/levels-v10.3/logs';
await mkdir(logDir, { recursive: true });
await writeFile(join(logDir, logName), JSON.stringify(info, null, 2));
console.log(browserName, width + 'x' + height, 'errors', info.errors.length, info.errors.join(' | ') || 'OK', 'click', JSON.stringify(info.clickWin));
await browser.close();
process.exit(info.errors.length ? 1 : 0);
