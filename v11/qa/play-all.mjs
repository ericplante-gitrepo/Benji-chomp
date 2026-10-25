// Headless play-all for v11. Run with NODE_PATH pointing at playwright.
//   NODE_PATH=.../node_modules node v11/qa/play-all.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');

const QA = path.dirname(new URL(import.meta.url).pathname);
const PAGE_URL = process.env.V11_URL || 'http://127.0.0.1:8765/v11/index.html';
const ONLY = process.env.V11_ONLY || '';

const WORLD = ['reef', 'kelp', 'ship', 'deep'];

function attach(page, bag) {
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') bag.console.push(t + ': ' + m.text());
  });
  page.on('pageerror', (e) => bag.console.push('pageerror: ' + e.message));
  page.on('request', (r) => {
    const u = r.url();
    if (u === PAGE_URL || u === PAGE_URL + '/') return;
    bag.network.push(u);
  });
}

async function boot(page) {
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__benji && window.__benji.ready, null, { timeout: 20000 });
}

async function clickDir(page, dir) {
  const p = await page.evaluate((dir) => {
    const ui = window.__benji.ui();
    const a = ui.arrows.find((x) => x.dir === dir);
    return window.__benji.toScreen(a.x, a.y);
  }, dir);
  await page.mouse.click(p.x, p.y);
}

async function clickPlay(page) {
  const p = await page.evaluate(() => {
    const ui = window.__benji.ui();
    return window.__benji.toScreen(ui.play.x, ui.play.y);
  });
  await page.mouse.click(p.x, p.y);
}

async function playLevel(page, wi, i, shot) {
  await page.evaluate(({ wi, i }) => window.__benji.jump(wi, i), { wi, i });
  await page.waitForTimeout(120);
  const meta = await page.evaluate(() => {
    const L = window.__benji.level;
    return { id: L.id, solution: L.solution, name: L.name };
  });
  if (shot) await page.screenshot({ path: path.join(QA, WORLD[wi] + '-' + meta.id + '-start.png') });
  await page.evaluate(() => window.__benji.turbo(16));
  for (const d of meta.solution) await clickDir(page, d);
  await clickPlay(page);
  try {
    await page.waitForFunction(() => window.__benji.mode === 'win', null, { timeout: 20000 });
  } catch (e) {
    const snap = await page.evaluate(() => ({
      mode: window.__benji.mode,
      q: window.__benji.queue(),
      err: window.__benji.lastError,
      state: window.__benji.state
    }));
    if (shot) await page.screenshot({ path: path.join(QA, WORLD[wi] + '-' + meta.id + '-FAIL.png') });
    return { id: meta.id, win: false, snap };
  }
  await page.waitForTimeout(180);
  const win = await page.evaluate(() => window.__benji.win);
  if (shot) await page.screenshot({ path: path.join(QA, WORLD[wi] + '-' + meta.id + '-win.png') });
  return { id: meta.id, win: true, stars: win && win.stars, shell: !!(win && win.shell) };
}

async function suite(browserType, opts) {
  const bag = { console: [], network: [] };
  const launch = { headless: true };
  if (opts.channel) launch.channel = opts.channel;
  const browser = await browserType.launch(launch);
  const context = await browser.newContext({
    viewport: { width: opts.w, height: opts.h },
    deviceScaleFactor: opts.dpr
  });
  const page = await context.newPage();
  attach(page, bag);
  await boot(page);
  const levels = await page.evaluate(() => {
    const out = [];
    window.__benji.LEVEL_PACK.forEach((w, wi) => w.levels.forEach((lv, i) => out.push({ wi, i, id: lv.id })));
    return out;
  });
  const results = [];
  for (const lv of levels) {
    if (opts.ids && !opts.ids.includes(lv.id)) continue;
    const r = await playLevel(page, lv.wi, lv.i, opts.shots);
    results.push(r);
    process.stdout.write((r.win ? 'ok ' : 'FAIL ') + r.id + (r.win ? ' *' + r.stars : ' ' + JSON.stringify(r.snap)) + '\n');
    if (!r.win && opts.stop) break;
  }
  await browser.close();
  return { label: opts.label, console: bag.console, network: bag.network, results, wins: results.filter((r) => r.win).length, n: results.length };
}

async function checks(browserType) {
  const bag = { console: [], network: [] };
  const browser = await browserType.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
  await context.addInitScript(() => {
    localStorage.setItem('v6prog0', '9');
    localStorage.setItem('benji_music', '1');
    localStorage.setItem('benji_v6prog0', JSON.stringify('keep-me'));
    localStorage.setItem('v6stars0', '[1]');
  });
  const page = await context.newPage();
  attach(page, bag);
  await boot(page);
  const audit = await page.evaluate(() => {
    const b = window.__benji;
    const badBoot = b.bootReport.filter((r) => !r.intendedOk || r.need < 1 || r.need > r.slots || !r.sameLength || !r.layoutOk);
    const changed = ['K6', 'K8', 'K11', 'S6', 'S7', 'S9', 'D5', 'D11'];
    const switches = [];
    b.LEVEL_PACK.forEach((w) => w.levels.forEach((raw) => {
      if (changed.indexOf(raw.id) < 0) return;
      switches.push({ id: raw.id, solution: raw.solution, ignored: b.ignoreSwitch(raw.prep) });
    }));
    const ties = b.bootReport.filter((r) => r.intended !== r.shortest).map((r) => ({ id: r.id, intended: r.intended, shortest: r.shortest }));
    const pipes = [];
    const wrong = [];
    const overshoot = [];
    b.LEVEL_PACK.forEach((w) => w.levels.forEach((raw) => {
      const level = raw.prep;
      const p = b.pipeReport(level);
      if (p.length) pipes.push({ id: level.id, p });
      const fails = b.wrongPrograms(level);
      if (fails.length < 3) wrong.push({ id: level.id, n: fails.length });
      const extra = level.solution + level.solution[level.solution.length - 1];
      const sim = b.runSim(level, extra);
      if (sim.result === 'win') overshoot.push(level.id);
    }));
    const ui = b.ui();
    const overflow = [];
    ui.arrows.forEach((a) => {
      if (a.x - a.w / 2 < 0 || a.y - a.h / 2 < 0 || a.x + a.w / 2 > 1280 || a.y + a.h / 2 > 800) overflow.push(a.id);
    });
    const play = ui.play;
    if (play.x - play.w / 2 < 0 || play.y - play.h / 2 < 0 || play.x + play.w / 2 > 1280 || play.y + play.h / 2 > 800) overflow.push('play');
    const de = document.documentElement;
    return {
      tray: b.TRAY_AFTER_FALL,
      badBoot, ties, pipes, wrong, overshoot, overflow, switches,
      scroll: { w: de.scrollWidth, h: de.scrollHeight, iw: innerWidth, ih: innerHeight },
      artErrors: b.artErrors,
      lastError: b.lastError
    };
  });
  await page.screenshot({ path: path.join(QA, 'title.png') });

  // Tray policies on R1 with a real fall (RRU). Third arrow leaves the board.
  const tray = {};
  for (const mode of ['truncate', 'empty', 'keep', 'byLength']) {
    await page.evaluate((mode) => { window.__benji.setTrayForTest(mode); window.__benji.turbo(20); window.__benji.jump(0, 0); }, mode);
    await page.waitForTimeout(40);
    for (const d of ['R', 'R', 'U']) await clickDir(page, d);
    await clickPlay(page);
    await page.waitForFunction(() => window.__benji.mode === 'fail' || window.__benji.mode === 'edit', null, { timeout: 8000 });
    if (mode === 'truncate') {
      await page.waitForFunction(() => window.__benji.mode === 'fail', null, { timeout: 4000 });
      await page.screenshot({ path: path.join(QA, 'truncate-cue.png') });
    }
    await page.waitForFunction(() => window.__benji.mode === 'edit', null, { timeout: 8000 });
    tray[mode] = await page.evaluate(() => window.__benji.queue().join(''));
  }
  await page.evaluate(() => window.__benji.clearTrayTest());

  // byLength keeps a long level's arrows. K10 need is 8; one Up falls.
  await page.evaluate(() => { window.__benji.setTrayForTest('byLength'); window.__benji.turbo(20); window.__benji.jump(1, 9); });
  await page.waitForTimeout(40);
  await clickDir(page, 'U');
  await clickPlay(page);
  await page.waitForFunction(() => window.__benji.mode === 'edit', null, { timeout: 8000 });
  tray.byLengthLong = await page.evaluate(() => window.__benji.queue().join(''));
  await page.evaluate(() => window.__benji.clearTrayTest());

  // Win R1 for the save check, then reload.
  await page.evaluate(() => window.__benji.turbo(20));
  const r1 = await playLevel(page, 0, 0, false);
  const beforeReload = await page.evaluate(() => ({
    v11prog0: localStorage.getItem('v11prog0'),
    v6prog0: localStorage.getItem('v6prog0'),
    benji_music: localStorage.getItem('benji_music'),
    benji_v6prog0: localStorage.getItem('benji_v6prog0'),
    v6stars0: localStorage.getItem('v6stars0')
  }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__benji && window.__benji.ready, null, { timeout: 20000 });
  const afterReload = await page.evaluate(() => ({
    prog0: window.__benji.prog[0],
    v11prog0: localStorage.getItem('v11prog0'),
    v6prog0: localStorage.getItem('v6prog0'),
    benji_music: localStorage.getItem('benji_music'),
    benji_v6prog0: localStorage.getItem('benji_v6prog0'),
    v6stars0: localStorage.getItem('v6stars0'),
    keys: Object.keys(localStorage)
  }));

  // Portrait overlay blocks play.
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(200);
  const portrait = await page.evaluate(() => window.__benji.portrait);
  await page.screenshot({ path: path.join(QA, 'portrait.png') });
  const before = await page.evaluate(() => window.__benji.state);
  await page.mouse.click(410, 500);
  await page.waitForTimeout(150);
  const afterClick = await page.evaluate(() => window.__benji.state);

  await browser.close();
  return { audit, tray, r1, beforeReload, afterReload, portrait, before, afterClick, console: bag.console, network: bag.network };
}

async function main() {
  const out = { checks: null, suites: [] };
  if (!ONLY || ONLY === 'checks') {
    process.stdout.write('checks\n');
    out.checks = await checks(chromium);
    process.stdout.write(JSON.stringify({ tray: out.checks.tray, audit: out.checks.audit, saves: out.checks.afterReload, portrait: out.checks.portrait, click: [out.checks.before, out.checks.afterClick], console: out.checks.console, network: out.checks.network }, null, 2) + '\n');
  }
  const plans = [
    { label: 'chromium-1280x800-dpr1.5', w: 1280, h: 800, dpr: 1.5, shots: true, channel: 'chrome', type: chromium },
    { label: 'chromium-1024x768', w: 1024, h: 768, dpr: 1, shots: false, channel: 'chrome', type: chromium },
    { label: 'chromium-844x390', w: 844, h: 390, dpr: 1, shots: false, channel: 'chrome', type: chromium }
  ];
  for (const plan of plans) {
    if (ONLY && ONLY !== plan.label && ONLY !== 'all') continue;
    process.stdout.write('\n' + plan.label + '\n');
    const s = await suite(plan.type, plan);
    out.suites.push({ label: s.label, wins: s.wins, n: s.n, console: s.console, network: s.network, fails: s.results.filter((r) => !r.win) });
    process.stdout.write(plan.label + ' ' + s.wins + '/' + s.n + ' console ' + s.console.length + '\n');
  }
  if (!ONLY || ONLY === 'webkit' || ONLY === 'all') {
    process.stdout.write('\nwebkit\n');
    const s = await suite(webkit, { label: 'webkit-1280x800', w: 1280, h: 800, dpr: 1, shots: false });
    out.webkit = { label: s.label, wins: s.wins, n: s.n, console: s.console, network: s.network, fails: s.results.filter((r) => !r.win) };
    process.stdout.write('webkit ' + s.wins + '/' + s.n + '\n');
  }
  fs.writeFileSync(path.join(QA, 'play-all-results.json'), JSON.stringify(out, null, 2));
  process.stdout.write('wrote results\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
