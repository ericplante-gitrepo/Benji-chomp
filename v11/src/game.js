"use strict";
// Chomp Benji Chomp, Good Shark — v11.0.0-test
// One offline page. Saves use v11prog*, v11stars* and v11music only.
// Tray after a fall or a miss. Change this one line to switch the rule.
//   'truncate' — drop the arrow that failed and everything after it (default)
//   'empty'    — clear the tray
//   'keep'     — leave every arrow
//   'byLength' — keep when the shortest win is longer than 6 arrows, otherwise empty
const TRAY_AFTER_FALL = 'truncate';
const BUILD = 'v11.0.0-test';

const W = 1280, H = 800;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const FONT = '"Arial Rounded MT Bold","Trebuchet MS","Comic Sans MS","Roboto",sans-serif';
let scale = 1, offX = 0, offY = 0, dpr = 1, viewW = 1280, viewH = 800;

function resize() {
  viewW = window.innerWidth; viewH = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(viewW * dpr); cv.height = Math.round(viewH * dpr);
  cv.style.width = viewW + 'px'; cv.style.height = viewH + 'px';
  scale = Math.min(viewW / W, viewH / H);
  offX = (viewW - W * scale) / 2; offY = (viewH - H * scale) / 2;
}
addEventListener('resize', resize);
addEventListener('orientationchange', function () { setTimeout(resize, 120); });
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
resize();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const bounceOut = t => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
// v10.3.0 swim clock (index.html MOVE_T / updateRun). Scale and centring stay v11's.
const MOVE_T = 0.42;
const BUMP_FAIL = { urchin: 1, bump: 1, bridge: 1, bed: 1 };
function assertNever(x) { throw new Error('Unexpected value: ' + String(x)); }
function portrait() { return viewH > viewW; }

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

// --- sprites -----------------------------------------------------------------
const SPRITES = {};
const IMAGES = {};
let artPending = 0, artReady = false;
const artErrors = [];
function trackImage(img, name, onOk) {
  artPending++;
  const fin = (ok) => {
    if (img._fin) return;
    img._fin = true;
    if (ok) { if (onOk) onOk(); } else artErrors.push(name);
    artPending--;
    if (artPending <= 0) artReady = true;
  };
  img.onload = () => fin(true);
  img.onerror = () => fin(false);
  return fin;
}
function registerSpriteSheet(name, src, json) {
  const img = new Image();
  const sheet = {
    img: img,
    frames: (json && json.frames) || {},
    pxScale: (json && json.pxScale) || 1,
    points: (json && json.points) || null,
    ready: false
  };
  SPRITES[name] = sheet;
  const fin = trackImage(img, name, () => { sheet.ready = true; });
  img.src = src;
  if (img.complete && img.naturalWidth) fin(true);
  return sheet;
}
function loadImage(name, src) {
  const img = new Image();
  IMAGES[name] = img;
  const fin = trackImage(img, name);
  img.src = src;
  if (img.complete && img.naturalWidth) fin(true);
  return img;
}
function tintedSheet(sheet, tint) {
  if (!sheet.tints) sheet.tints = {};
  if (sheet.tints[tint]) return sheet.tints[tint];
  if (!sheet.ready || !sheet.img.naturalWidth) return null;
  const c = document.createElement('canvas');
  c.width = sheet.img.naturalWidth;
  c.height = sheet.img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(sheet.img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = tint;
  g.globalAlpha = 0.72;
  g.fillRect(0, 0, c.width, c.height);
  sheet.tints[tint] = c;
  return c;
}
function drawSprite(name, state, x, y, o) {
  const s = SPRITES[name];
  if (!s || !s.ready) return false;
  const frames = s.frames[state];
  if (!frames || !frames.length) return false;
  o = o || {};
  const idx = o.frame != null ? ((o.frame % frames.length) + frames.length) % frames.length
    : Math.round(clamp(o.value || 0, 0, 1) * (frames.length - 1));
  const f = frames[idx];
  const sc = o.scale == null ? 1 : o.scale;
  const k = s.pxScale * sc;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale((o.flipX ? -1 : 1) * (o.sx || 1), o.sy || 1);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  if (o.add) ctx.globalCompositeOperation = 'lighter';
  let img = s.img;
  if (o.tint) {
    const tinted = tintedSheet(s, o.tint);
    if (tinted) img = tinted;
  }
  ctx.drawImage(img, f.x, f.y, f.w, f.h, -f.ax * k, -f.ay * k, f.w * k, f.h * k);
  ctx.restore();
  return true;
}

// %%ART%%

// --- audio (unlocked on the first tap; WebKit resume is caught) -------------
let AC = null, audioUnlocked = false, musicOn = true, muted = false;
let musicTimer = null, musicNext = 0, musicStep = 0;
const TUNE = [523, 659, 784, 880, 784, 659, 698, 784];
function audioCtx() {
  if (AC) return AC;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { AC = new Ctx(); } catch (e) { return null; }
  return AC;
}
function toneAt(a, f, t, dur, type, vol) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function sfx(f, dur, type, vol) {
  if (!audioUnlocked || muted) return;
  const a = audioCtx();
  if (!a || a.state !== 'running') return;
  try { toneAt(a, f, a.currentTime, dur || 0.12, type || 'sine', vol || 0.07); } catch (e) {}
}
function glide(f0, f1, dur, type, vol, delay) {
  if (!audioUnlocked || muted) return;
  const a = audioCtx();
  if (!a || a.state !== 'running') return;
  try {
    const t = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(40, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
function blub() {
  const f = 320 + Math.random() * 80;
  glide(f, f * 1.9, 0.1, 'sine', 0.1);
}
let noiseBuf = null;
function noise(dur, vol, freq, delay) {
  if (!audioUnlocked || muted) return;
  const a = audioCtx();
  if (!a || a.state !== 'running') return;
  try {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const t = a.currentTime + (delay || 0);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf;
    f.type = 'lowpass';
    f.frequency.value = freq || 900;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(a.destination);
    s.start(t); s.stop(t + dur + 0.05);
  } catch (e) {}
}
function chompSfx() {
  noise(0.07, 0.35, 1800);
  glide(320, 140, 0.08, 'square', 0.09);
  noise(0.12, 0.3, 900, 0.06);
}
function goalChime() {
  if (!audioUnlocked || muted) return;
  const a = audioCtx();
  if (!a || a.state !== 'running') return;
  try {
    [784, 988, 1175, 1568].forEach((f, k) => toneAt(a, f, a.currentTime + k * 0.09, 0.32, 'triangle', 0.14));
    toneAt(a, 2093, a.currentTime + 0.38, 0.6, 'sine', 0.06);
  } catch (e) {}
}
function whoosh() {
  noise(0.5, 0.14, 650);
  glide(500, 1100, 0.4, 'sine', 0.06, 0.05);
}
function starSfx() {
  glide(880, 1320, 0.1, 'sine', 0.15);
  if (!audioUnlocked || muted) return;
  const a = audioCtx();
  if (!a || a.state !== 'running') return;
  try { toneAt(a, 1320, a.currentTime + 0.08, 0.15, 'triangle', 0.1); } catch (e) {}
}
function unclick() {
  glide(900, 420, 0.06, 'sine', 0.14);
  noise(0.03, 0.06, 2400);
}
function after(sec, fn) { later.push({ t: sec, fn: fn }); }
function musicPump() {
  try {
    const a = audioCtx();
    if (!a || a.state !== 'running' || !musicOn || muted) return;
    const now = a.currentTime;
    if (musicNext < now + 0.02) musicNext = now + 0.05;
    while (musicNext < now + 0.55) {
      toneAt(a, TUNE[musicStep % TUNE.length], musicNext, 0.2, 'triangle', 0.045);
      musicStep++;
      musicNext += 0.24;
    }
  } catch (e) {}
}
function applyMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (!musicOn || !audioUnlocked || muted) return;
  musicTimer = setInterval(musicPump, 200);
  musicPump();
}
function unlockAudio() {
  const a = audioCtx();
  audioUnlocked = true;
  if (a && a.state === 'suspended') {
    try { const p = a.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  applyMusic();
}
function toggleMusic() {
  musicOn = !musicOn;
  store.set('v11music', musicOn);
  applyMusic();
  sfx(musicOn ? 880 : 440, 0.08, 'sine', 0.05);
}

// --- rules (same resolver as the campaign checker) ---------------------------
const DIR_DELTA = { L: [0, -1], R: [0, 1], U: [-1, 0], D: [1, 0] };
const CUR = { '>': [0, 1], '<': [0, -1], '^': [-1, 0], v: [1, 0] };
const GATE = { X: 'c', x: 'c', Y: 'g', y: 'g', Z: 'p', z: 'p', H: 'k', V: 's', Q: 's', M: 'm', '=': 'o' };
const SW = { '1': 'c', '4': 'c', '2': 'g', '5': 'g', '3': 'p', '6': 'p', h: 'k', K: 's', m: 'm', O: 'o' };
const PUSH_CAP = 6;
const FRIENDS = ['turtle', 'jelly', 'seahorse', 'puffer', 'clown'];
const WORLD_LOOK = [
  { name: 'Sunny Reef', btn: 'reef', tile: 'toytile', bg: 'reef', ink: '#0c3d6b' },
  { name: 'Kelp Forest', btn: 'kelp', tile: 'tile_kelp', bg: 'kelp', ink: '#143d28' },
  { name: 'Sunken Ship', btn: 'ship', tile: 'tile_ship', bg: 'ship', ink: '#3d2912' },
  { name: 'Deep Sea', btn: 'deep', tile: 'tile_deep', bg: 'deep', ink: '#041428' }
];

function cellChar(grid, r, c) {
  if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length) return '';
  return grid[r][c];
}
function prepLevel(raw, wi, index) {
  if (raw.prep) return raw.prep;
  const grid = raw.grid;
  const pos = {};
  for (let r = 0; r < grid.length; r++) {
    if (grid[r].length !== grid[0].length) throw new Error(raw.id + ' ragged');
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c];
      (pos[ch] || (pos[ch] = [])).push([r, c]);
    }
  }
  if (!pos.S || pos.S.length !== 1 || !pos.G || pos.G.length !== 1) throw new Error(raw.id + ' needs one S and one G');
  const tubes = {};
  const pairs = [];
  for (const A of ['A', 'B', 'C']) {
    const a = A.toLowerCase();
    if (!pos[A] && !pos[a]) continue;
    if (!pos[A] || !pos[a] || pos[A].length !== 1 || pos[a].length !== 1) throw new Error(raw.id + ' tube ' + A);
    const p = pos[A][0], q = pos[a][0];
    tubes[p[0] + ',' + p[1]] = q;
    tubes[q[0] + ',' + q[1]] = p;
    pairs.push({ letter: A, a: p, b: q });
  }
  const friendKeys = (pos.F || []).map(p => p[0] + ',' + p[1]);
  const pool = wi === 3 ? FRIENDS.filter(f => f !== 'jelly') : FRIENDS.slice();
  const cast = { goal: pool[index % pool.length], extras: {} };
  friendKeys.forEach((k, i) => { cast.extras[k] = pool[(index + 1 + i) % pool.length]; });
  const level = {
    id: raw.id, name: raw.name, role: raw.role, goal: raw.goal, slots: raw.slots,
    solution: raw.solution, source: raw.source, grid: grid, world: wi, index: index,
    start: pos.S[0], goalAt: pos.G[0], tubes: tubes, pairs: pairs, friendKeys: friendKeys,
    cast: cast, hasJ: !!pos.J, pos: pos
  };
  raw.prep = level;
  return level;
}
function cloneSt(st) { return { r: st.r, c: st.c, sw: new Set(st.sw), fr: new Set(st.fr) }; }
function resolve(level, st, dir, n, disable) {
  const grid = level.grid, H = grid.length, W = grid[0].length;
  const dlt = DIR_DELTA[dir];
  let r = st.r + dlt[0], c = st.c + dlt[1];
  let sw = new Set(st.sw), fr = new Set(st.fr);
  let pushes = 0, teleported = false;
  const moves = [];
  while (true) {
    moves.push({ type: 'swim', r: r, c: c });
    if (r < 0 || c < 0 || r >= H || c >= W) return failAt('off', moves);
    let t = grid[r][c];
    if (t === '.') return failAt('water', moves);
    if (t === 'U') return failAt('urchin', moves);
    if (GATE[t] && !sw.has(GATE[t])) return failAt(t === '=' ? 'bridge' : t === 'M' ? 'bed' : t === 'J' ? 'bump' : 'bump', moves);
    if (t === 'J' && n % 2 === 0) return failAt('jelly', moves);
    if (SW[t] && SW[t] !== disable) sw.add(SW[t]);
    if (t === 'F') fr.add(r + ',' + c);
    if (level.tubes[r + ',' + c] && !teleported) {
      const dest = level.tubes[r + ',' + c];
      moves.push({ type: 'tube', r: r, c: c, nr: dest[0], nc: dest[1] });
      r = dest[0]; c = dest[1]; teleported = true; t = grid[r][c];
      if (SW[t] && SW[t] !== disable) sw.add(SW[t]);
      if (t === 'F') fr.add(r + ',' + c);
    }
    if (CUR[t] && pushes < PUSH_CAP) {
      pushes++; teleported = false;
      const p = CUR[t]; r += p[0]; c += p[1];
      continue;
    }
    if (CUR[t] && pushes >= PUSH_CAP) return failAt('loop', moves);
    return { ok: true, why: null, moves: moves, st: { r: r, c: c, sw: sw, fr: fr } };
  }
}
function failAt(why, moves) {
  moves[moves.length - 1].fail = why;
  return { ok: false, why: why, moves: moves, st: null };
}
function isWin(level, st) {
  if (st.r !== level.goalAt[0] || st.c !== level.goalAt[1]) return false;
  for (let i = 0; i < level.friendKeys.length; i++) if (!st.fr.has(level.friendKeys[i])) return false;
  return true;
}
function runSim(level, cmds) {
  const list = typeof cmds === 'string' ? cmds.split('') : cmds.slice();
  let st = { r: level.start[0], c: level.start[1], sw: new Set(), fr: new Set() };
  const trace = [];
  for (let i = 0; i < list.length; i++) {
    const res = resolve(level, st, list[i], i + 1);
    if (!res.ok) return { result: 'fail', why: res.why, at: i, trace: trace };
    st = res.st;
    trace.push([st.r, st.c]);
  }
  if (isWin(level, st)) return { result: 'win', at: list.length - 1, trace: trace, end: [st.r, st.c] };
  const friendsMissing = level.friendKeys.some(k => !st.fr.has(k));
  return { result: 'miss', why: friendsMissing && st.r === level.goalAt[0] && st.c === level.goalAt[1] ? 'friends' : 'short', at: list.length, trace: trace, end: [st.r, st.c] };
}
function stateKey(st, n, jelly) {
  const sw = Array.from(st.sw).sort().join('');
  const fr = Array.from(st.fr).sort().join('');
  return st.r + ',' + st.c + '|' + sw + '|' + fr + '|' + (jelly ? (n % 2) : 0);
}
function solve(level, opt) {
  opt = opt || {};
  const max = opt.maxDepth != null ? opt.maxDepth : level.slots;
  const start = { r: level.start[0], c: level.start[1], sw: new Set(), fr: new Set() };
  const seen = new Set([stateKey(start, 0, level.hasJ)]);
  let frontier = [{ st: start, path: '' }];
  for (let depth = 0; depth < max; depth++) {
    const next = [];
    for (let i = 0; i < frontier.length; i++) {
      const node = frontier[i];
      for (const d of ['L', 'R', 'U', 'D']) {
        const res = resolve(level, node.st, d, depth + 1, opt.disable || null);
        if (!res.ok) continue;
        if (isWin(level, res.st)) return node.path + d;
        const k = stateKey(res.st, depth + 1, level.hasJ);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ st: res.st, path: node.path + d });
      }
    }
    frontier = next;
  }
  return null;
}

function resolvedTrayMode(setting, need) {
  switch (setting) {
    case 'empty':
    case 'keep':
    case 'truncate':
      return setting;
    case 'byLength':
    case 'by-length':
      return need > 6 ? 'keep' : 'empty';
    default:
      return assertNever(setting);
  }
}
function applyTray(setting, queue, failAtIndex, need) {
  const mode = resolvedTrayMode(setting, need);
  switch (mode) {
    case 'keep': return queue.slice();
    case 'empty': return [];
    case 'truncate': return failAtIndex > 0 ? queue.slice(0, failAtIndex) : [];
    default: return assertNever(mode);
  }
}
let traySettingTest = null;
function traySetting() { return traySettingTest || TRAY_AFTER_FALL; }

// --- campaign boot -----------------------------------------------------------
const prog = [0, 1, 2, 3].map(i => store.get('v11prog' + i, 0));
const stars = [0, 1, 2, 3].map(i => store.get('v11stars' + i, []));
musicOn = store.get('v11music', true);
const TREAT_BAN = {
  M: 1, m: 1, J: 1, '5': 1, '6': 1, y: 1, z: 1, U: 1,
  F: 1, G: 1, A: 1, a: 1, B: 1, b: 1, C: 1, c: 1
};
const PIPE_MOUTH = { A: 1, a: 1, B: 1, b: 1, C: 1, c: 1 };
const PROP_CELL = { U: 1, M: 1, y: 1, z: 1, h: 1, '2': 1, '3': 1, H: 1, Y: 1, Z: 1, m: 1, '5': 1, '6': 1 };
function pipeOrProp(ch) { return !!(PIPE_MOUTH[ch] || PROP_CELL[ch]); }
const TITLE_BAND_BOTTOM = 54 + 48 / 2 + 8 / 2;
const STINGER_RISE = 98.5;
const bootReport = [];
// Winning-program counts at 313e9f0. These nine puzzles keep that many.
const ORIGINAL_WINS = { R3: 1, S2: 1, S3: 1, S4: 1, S7: 1, S10: 1, D4: 1, D5: 1, D8: 1 };
function bootLevels() {
  LEVEL_PACK.forEach((world, wi) => {
    world.levels.forEach((raw, i) => {
      const level = prepLevel(raw, wi, i);
      const shortest = solve(level);
      level.need = shortest ? shortest.length : -1;
      level.shortest = shortest || '';
      const intended = runSim(level, level.solution);
      const layout = layoutIssues(level);
      bootReport.push({
        id: level.id, world: WORLD_LOOK[wi].name, slots: level.slots, goal: level.goal,
        intended: level.solution, intendedOk: intended.result === 'win',
        shortest: level.shortest, need: level.need,
        sameLength: !!shortest && shortest.length === level.solution.length,
        layout: layout, layoutOk: layout.length === 0,
        earn: level.earn || '',
        treat: level.treatCell || '',
        onPath: !!level.treatOnPath,
        overGoal: !!level.treatOverGoal,
        wins: level.winCount || 0
      });
    });
  });
}
bootLevels();

// --- layout ------------------------------------------------------------------
function geomOf(level) {
  const rows = level.grid.length, cols = level.grid[0].length;
  const kx = 124 / 140, ky = 70 / 140, kh = 19 / 140;
  const x0 = 118, x1 = 1104, y0 = 84, y1 = 612;
  const TW = Math.min(228, (x1 - x0) / (cols * kx), (y1 - y0 - 20) / (rows * ky + kh));
  const PW = TW * kx, TD = TW * ky, TH = TW * kh;
  const bw = cols * PW, bh = rows * TD + TH;
  let by = y0 + (y1 - y0 - bh) / 2;
  if (level.grid[0].indexOf('J') >= 0) {
    const top = by + TD / 2 - STINGER_RISE * (TW / 140);
    const gap = 4;
    if (top < TITLE_BAND_BOTTOM + gap) by += TITLE_BAND_BOTTOM + gap - top;
  }
  return { rows: rows, cols: cols, TW: TW, PW: PW, TD: TD, TH: TH, bx: (x0 + x1) / 2 - bw / 2, by: by };
}
function cellXY(g, r, c) { return { x: g.bx + c * g.PW + g.PW / 2, y: g.by + r * g.TD + g.TD / 2 }; }
function spotOf(g, r, c) {
  const rr = clamp(r, 0, g.rows - 1), cc = clamp(c, 0, g.cols - 1);
  const p = cellXY(g, rr, cc);
  return { x: p.x + (c - cc) * g.PW, y: p.y + (r - rr) * g.TD - g.TD * 0.08 };
}
function goalSpot(g, r, c) {
  const p = cellXY(g, r, c);
  return { x: p.x, y: p.y - Math.min(g.TD * 0.3, 34) };
}
function arrowButtons() {
  return ['U', 'R', 'L', 'D'].map((dir, i) => ({ id: 'arrow' + dir, dir: dir, x: 1144, y: 92 + i * 122, w: 108, h: 108 }));
}
function playButton() { return { id: 'play', x: 996, y: 656, w: 128, h: 120 }; }
function slotGeom(n) {
  const gap = Math.min(84, 860 / Math.max(1, n));
  const r = Math.min(34, gap * 0.42);
  return { n: n, gap: gap, r: r, y: 728, x: i => 72 + i * gap };
}
function backButton() { return { id: 'back', x: 16, y: 14, w: 78, h: 78 }; }
function musicButton() { return state === 'play' ? { id: 'music', x: 900, y: 668, w: 72, h: 72 } : { id: 'music', x: 1088, y: 16, w: 80, h: 80 }; }
function muteButton() { return state === 'play' ? { id: 'mute', x: 816, y: 676, w: 64, h: 64 } : { id: 'mute', x: 1180, y: 16, w: 80, h: 80 }; }
function worldButtons() {
  const w = 248, h = 172, gap = 16;
  const x0 = (W - (4 * w + 3 * gap)) / 2;
  return [0, 1, 2, 3].map(i => ({ id: 'world' + i, i: i, x: x0 + i * (w + gap), y: 278, w: w, h: h }));
}
function levelButtons() {
  const levels = LEVEL_PACK[world].levels;
  const cols = 4, cw = 200, ch = 128, gx = 16, gy = 14;
  const x0 = (W - (cols * cw + (cols - 1) * gx)) / 2;
  return levels.map((raw, i) => ({
    id: 'pick' + i, i: i,
    x: x0 + (i % cols) * (cw + gx),
    y: 196 + Math.floor(i / cols) * (ch + gy),
    w: cw, h: ch, locked: i > prog[world]
  }));
}
function nextButton() { return { id: 'next', x: 780, y: 600, w: 300, h: 110 }; }
function rewardNext() { return { id: 'rewardNext', x: 860, y: 640, w: 280, h: 110 }; }

function hit(b, x, y) { return x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h; }
function toGame(cx, cy) { return { x: (cx - offX) / scale, y: (cy - offY) / scale }; }
function toScreen(x, y) { return { x: offX + x * scale, y: offY + y * scale }; }

// --- tubes -------------------------------------------------------------------
function routePair(level, a, b, used) {
  const rows = level.grid.length, cols = level.grid[0].length;
  const key = (r, c) => r + ',' + c;
  const open = (r, c) => {
    if (r < -1 || c < -1 || r > rows || c > cols) return false;
    if (r < 0 || c < 0 || r >= rows || c >= cols) return true;
    return level.grid[r][c] === '.';
  };
  const neigh = (r, c) => {
    const out = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => {
      const nr = r + d[0], nc = c + d[1];
      if (open(nr, nc) && !used.has(key(nr, nc))) out.push([nr, nc]);
    });
    return out;
  };
  if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1) return [a, b];
  const starts = neigh(a[0], a[1]);
  const goals = new Set(neigh(b[0], b[1]).map(p => key(p[0], p[1])));
  const prev = new Map();
  const q = [];
  starts.forEach(s => { const k = key(s[0], s[1]); if (!prev.has(k)) { prev.set(k, null); q.push(s); } });
  let hit = null;
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi];
    if (goals.has(key(cur[0], cur[1]))) { hit = cur; break; }
    neigh(cur[0], cur[1]).forEach(n => {
      const k = key(n[0], n[1]);
      if (prev.has(k)) return;
      prev.set(k, cur);
      q.push(n);
    });
  }
  if (!hit) return null;
  const mid = [];
  let cur = hit;
  const guard = new Set();
  while (cur && !guard.has(key(cur[0], cur[1]))) {
    guard.add(key(cur[0], cur[1]));
    mid.push(cur);
    cur = prev.get(key(cur[0], cur[1]));
  }
  mid.reverse();
  return [a].concat(mid, [b]);
}
function buildTubes(level) {
  const routes = [];
  const used = new Set();
  level.pairs.forEach(pair => {
    let cells = routePair(level, pair.a, pair.b, used);
    let overlap = false;
    if (!cells) { cells = routePair(level, pair.a, pair.b, new Set()); overlap = true; }
    const route = { letter: pair.letter, cells: cells || [pair.a, pair.b], missing: !cells, overlap: overlap };
    if (cells) cells.forEach((p, i) => { if (i > 0 && i < cells.length - 1) used.add(p[0] + ',' + p[1]); });
    routes.push(route);
  });
  return routes;
}
function nodeXY(g, r, c) {
  const rr = clamp(r, 0, g.rows - 1), cc = clamp(c, 0, g.cols - 1);
  const p = cellXY(g, rr, cc);
  return { x: p.x + (c - cc) * g.PW, y: p.y + (r - rr) * g.TD };
}
function pipePoints(route) {
  return route.cells.map(p => nodeXY(G, p[0], p[1]));
}

// --- game state --------------------------------------------------------------
let state = 'title', world = 0, levelIdx = 0, L = null, G = null;
let mode = 'edit', queue = [], run = null, runs = 0, win = null, reward = null, later = [];
let pressed = null, T = 0, animMul = 1, slotShake = 0;
let tubes = [], fx = {}, trails = [], treat = null, parts = [], bubbles = [];
const benji = {
  r: 0, c: 0, x: 400, y: 400, flip: false,
  turnT: 1, q: 0, qv: 0, squat: 0, rot: 0, ox: 0, extraY: 0,
  shrink: 1, alpha: 1, spin: 0, moving: false, hidden: false,
  home: null, popIn: 1, forceState: null, forceValue: 0
};
let jellyUp = true, jellyAnim = null;
let lastError = null;

function worldLevels() { return LEVEL_PACK[world].levels; }
function resetFx() { fx = {}; trails = []; jellyAnim = null; }
function placeBenji(r, c) {
  benji.r = r; benji.c = c;
  if (G) { const p = spotOf(G, r, c); benji.x = p.x; benji.y = p.y; }
}
function resetPose() {
  benji.turnT = 1; benji.q = 0; benji.qv = 0; benji.squat = 0;
  benji.rot = 0; benji.ox = 0; benji.extraY = 0;
  benji.shrink = 1; benji.alpha = 1; benji.spin = 0;
  benji.moving = false; benji.hidden = false; benji.home = null;
  benji.popIn = 1; benji.forceState = null; benji.forceValue = 0;
}
function travelDir(dr, dc) {
  if (Math.abs(dc) > Math.abs(dr)) return dc < 0 ? 'L' : 'R';
  if (dr < 0) return 'U';
  if (dr > 0) return 'D';
  return null;
}
function faceToward(dir) {
  const was = benji.flip;
  if (dir === 'L') benji.flip = true;
  else if (dir === 'R') benji.flip = false;
  if (was !== benji.flip) benji.turnT = 0;
}
function reachableCells(level) {
  if (level.reach) return level.reach;
  const start = { r: level.start[0], c: level.start[1], sw: new Set(), fr: new Set() };
  const seen = new Set([stateKey(start, 0, level.hasJ)]);
  const cells = new Set();
  const frontier = [{ st: start, n: 0 }];
  while (frontier.length) {
    const node = frontier.shift();
    if (node.n >= level.slots) continue;
    for (const d of ['L', 'R', 'U', 'D']) {
      const res = resolve(level, node.st, d, node.n + 1);
      res.moves.forEach(m => {
        if (m.type === 'swim' && !m.fail) cells.add(m.r + ',' + m.c);
        else if (m.type === 'tube') cells.add(m.nr + ',' + m.nc);
      });
      if (!res.ok) continue;
      const k = stateKey(res.st, node.n + 1, level.hasJ);
      if (seen.has(k)) continue;
      seen.add(k);
      frontier.push({ st: res.st, n: node.n + 1 });
    }
  }
  level.reach = cells;
  return cells;
}
function sandCells(level) {
  const cells = [];
  for (let r = 0; r < level.grid.length; r++) {
    for (let c = 0; c < level.grid[0].length; c++) {
      if (level.grid[r][c] === '#') cells.push([r, c]);
    }
  }
  return cells;
}
function visitCells(level, cmds) {
  const list = typeof cmds === 'string' ? cmds.split('') : cmds.slice();
  let st = { r: level.start[0], c: level.start[1], sw: new Set(), fr: new Set() };
  const cells = [];
  for (let i = 0; i < list.length; i++) {
    const res = resolve(level, st, list[i], i + 1);
    res.moves.forEach(m => {
      if (m.type === 'swim' && !m.fail) cells.push([m.r, m.c]);
      else if (m.type === 'tube') cells.push([m.nr, m.nc]);
    });
    if (!res.ok) break;
    st = res.st;
  }
  return cells;
}
function pathSandCells(level) {
  const sim = runSim(level, level.solution);
  if (sim.result !== 'win') return [];
  const seen = new Set();
  const out = [];
  visitCells(level, level.solution).forEach(p => {
    const k = p[0] + ',' + p[1];
    if (seen.has(k)) return;
    seen.add(k);
    if (cellChar(level.grid, p[0], p[1]) === '#') out.push(p);
  });
  return out;
}
function legacyTreatCell(level) {
  const sand = sandCells(level);
  if (!sand.length) return null;
  return sand[Math.floor(sand.length / 2)];
}
function pickTreat(level) {
  const onPath = pathSandCells(level);
  const pool = onPath.length ? onPath : sandCells(level);
  if (!pool.length) return null;
  const p = pool[Math.floor(pool.length / 2)];
  const kinds = ['cracker', 'sushi', 'shrimp', 'cupcake'];
  return { r: p[0], c: p[1], kind: kinds[level.index % kinds.length], got: false };
}
function winningProgramCount(level) {
  const start = { r: level.start[0], c: level.start[1], sw: new Set(), fr: new Set() };
  let frontier = [{ st: start, ways: 1 }];
  let total = 0;
  for (let depth = 0; depth < level.slots; depth++) {
    const next = new Map();
    for (let i = 0; i < frontier.length; i++) {
      const node = frontier[i];
      for (const d of ['L', 'R', 'U', 'D']) {
        const res = resolve(level, node.st, d, depth + 1);
        if (!res.ok) continue;
        if (isWin(level, res.st)) total += node.ways;
        const k = stateKey(res.st, depth + 1, level.hasJ);
        const prev = next.get(k);
        if (prev) prev.ways += node.ways;
        else next.set(k, { st: res.st, ways: node.ways });
      }
    }
    frontier = Array.from(next.values());
  }
  return total;
}
function treatOverGoal(level, treat) {
  return !!(treat && cellChar(level.grid, treat.r + 1, treat.c) === 'G');
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
function circleHitsRect(cx, cy, rad, b) {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  const dx = nx - cx, dy = ny - cy;
  return dx * dx + dy * dy <= rad * rad;
}
function treatBox(g, treat) {
  const p = cellXY(g, treat.r, treat.c);
  const k = 0.5 * (g.TW / 140) * 0.72;
  return { x: p.x - 80 * k, y: p.y - 6 - 128 * k, w: 160 * k, h: 160 * k };
}
function bubbleCoversTreat(level, treat) {
  const g = geomOf(level);
  const box = treatBox(g, treat);
  const items = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const ch = level.grid[r][c];
      if (ch === 'G' || ch === 'F') items.push({ row: r, layer: 1, kind: ch, r: r, c: c });
      if (treat.r === r && treat.c === c && !treatOverGoal(level, treat)) {
        items.push({ row: r, layer: 0, kind: 'treat', r: r, c: c });
      }
      if (ch === 'G' && treatOverGoal(level, treat) && treat.r === r - 1 && treat.c === c) {
        items.push({ row: r, layer: 2, kind: 'treat', r: treat.r, c: treat.c });
      }
    }
  }
  items.sort((a, b) => a.row - b.row || a.layer - b.layer);
  let treatAt = -1;
  for (let i = 0; i < items.length; i++) if (items[i].kind === 'treat') treatAt = i;
  if (treatAt < 0) return 'treat not drawn';
  const sc = g.TW / 140;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind !== 'G' && it.kind !== 'F') continue;
    const p = cellXY(g, it.r, it.c);
    const goal = it.kind === 'G';
    const bobs = goal ? [-4, 0, 4] : [-3, 0, 3];
    const lift = goal ? g.TD * 0.55 : g.TD * 0.42;
    const rad = (goal ? 40 : 34) * sc;
    const fk = 0.5 * (goal ? 0.40 : 0.34) * sc;
    const spriteDy = (goal ? 6 : 4) * sc;
    for (let b = 0; b < bobs.length; b++) {
      const cy = p.y - lift + bobs[b];
      const sprite = { x: p.x - 130 * fk, y: cy + spriteDy - 124 * fk, w: 260 * fk, h: 240 * fk };
      const hit = circleHitsRect(p.x, cy, rad, box) || rectsOverlap(sprite, box);
      if (hit && i > treatAt) return (goal ? 'goal' : 'friend') + ' bubble at ' + it.r + ',' + it.c;
    }
  }
  return '';
}
function layoutIssues(level) {
  const issues = [];
  const grid = level.grid;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] !== 'J') continue;
      if (r > 0) {
        const above = grid[r - 1][c];
        if (above === 'G' || above === 'F') issues.push('stinger directly below ' + above + ' at ' + r + ',' + c);
        if (pipeOrProp(above)) issues.push('stinger rises into ' + above + ' at ' + r + ',' + c);
      }
      if (r + 1 < grid.length && pipeOrProp(grid[r + 1][c])) {
        issues.push('stinger directly above ' + grid[r + 1][c] + ' at ' + r + ',' + c);
      }
    }
  }
  const g = geomOf(level);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] !== 'J') continue;
      const top = g.by + (r + 0.5) * g.TD - STINGER_RISE * (g.TW / 140);
      if (top < TITLE_BAND_BOTTOM) issues.push('stinger cuts the title at ' + r + ',' + c);
    }
  }
  const treat = pickTreat(level);
  if (!treat) issues.push('missing treat');
  else {
    const ch = cellChar(level.grid, treat.r, treat.c);
    if (ch !== '#' || TREAT_BAN[ch]) issues.push('treat on ' + ch + ' at ' + treat.r + ',' + treat.c);
    const sim = runSim(level, level.solution);
    if (level.solution.length > level.slots) issues.push('solution longer than slots');
    if (sim.result !== 'win') issues.push('solution does not win');
    const visits = sim.result === 'win' ? visitCells(level, level.solution) : [];
    const seen = new Set();
    const pathSand = [];
    visits.forEach(p => {
      const k = p[0] + ',' + p[1];
      if (seen.has(k)) return;
      seen.add(k);
      if (cellChar(level.grid, p[0], p[1]) === '#') pathSand.push(p);
    });
    const onPath = seen.has(treat.r + ',' + treat.c);
    level.treatOnPath = onPath;
    level.treatCell = treat.r + ',' + treat.c;
    level.treatOverGoal = treatOverGoal(level, treat);
    level.earn = onPath ? level.solution : '';
    if (pathSand.length) {
      if (!onPath) issues.push('treat off winning path at ' + treat.r + ',' + treat.c);
    } else {
      // The winning program never steps on plain sand, so the treat stays on the 313e9f0 cell.
      const legacy = legacyTreatCell(level);
      if (!legacy || legacy[0] !== treat.r || legacy[1] !== treat.c) {
        issues.push('no path sand and treat is not the 313e9f0 cell');
      }
    }
    if (Object.prototype.hasOwnProperty.call(ORIGINAL_WINS, level.id)) {
      const wins = winningProgramCount(level);
      level.winCount = wins;
      if (wins !== ORIGINAL_WINS[level.id]) {
        issues.push('winning programs ' + wins + ' expected ' + ORIGINAL_WINS[level.id]);
      }
    }
    const cover = bubbleCoversTreat(level, treat);
    if (cover) issues.push('treat covered by ' + cover);
  }
  return issues;
}
function loadLevel(i) {
  levelIdx = i;
  L = worldLevels()[i].prep;
  G = geomOf(L);
  queue = []; runs = 0; mode = 'edit'; run = null; win = null; reward = null; later = [];
  resetFx();
  tubes = buildTubes(L);
  treat = pickTreat(L);
  jellyUp = true;
  placeBenji(L.start[0], L.start[1]);
  resetPose();
  benji.flip = L.goalAt[1] < L.start[1];
  state = 'play';
}
function openSelect(w) { world = w; state = 'select'; L = null; run = null; win = null; reward = null; later = []; }
function showReward() {
  state = 'reward';
  reward = { t: 0 };
  L = null; run = null; win = null; later = [];
}
function continueReward() {
  const n = worldLevels().length;
  if (levelIdx + 1 < n) loadLevel(levelIdx + 1);
  else openSelect(world);
}
function nextFromWin() {
  const n = worldLevels().length;
  const done = levelIdx + 1;
  win = null;
  if (done % 5 === 0 || done === n) showReward();
  else if (done < n) loadLevel(levelIdx + 1);
  else openSelect(world);
}

function pressPlay() {
  if (state !== 'play' || !L) return;
  if (mode === 'run' || mode === 'fail') { manualReset(); return; }
  if (!queue.length) { slotShake = 0.35; sfx(240, 0.1, 'square', 0.04); return; }
  runs++;
  sfx(392, 0.1, 'triangle', 0.08);
  mode = 'run';
  run = {
    cmds: queue.slice(), i: 0,
    sw: new Set(), fr: new Set(),
    segs: [{ kind: 'wait', dur: 0.25, lead: true }], si: 0, res: null, react: null
  };
  resetFx();
  if (treat) treat.got = false;
  placeBenji(L.start[0], L.start[1]);
  resetPose();
  benji.flip = L.goalAt[1] < L.start[1];
  beginSeg();
}
function beginReturn(keepQueue) {
  const why = run && run.react ? run.react.why : '';
  if (!keepQueue && run) queue = applyTray(traySetting(), queue, run.failSlot, L.need);
  const sunk = why === 'water' || why === 'off' || benji.hidden || benji.alpha < 0.5;
  const sx = benji.x, sy = benji.y;
  mode = 'edit';
  run = null;
  later = [];
  resetFx();
  if (treat) treat.got = false;
  benji.forceState = null;
  benji.rot = 0; benji.ox = 0; benji.spin = 0; benji.moving = false; benji.squat = 0;
  benji.shrink = 1; benji.alpha = 1; benji.hidden = false;
  const sr = L.start[0], sc0 = L.start[1];
  const p = spotOf(G, sr, sc0);
  benji.r = sr; benji.c = sc0;
  if (sunk) {
    benji.home = null;
    benji.x = p.x; benji.y = p.y;
    benji.popIn = 0;
    benji.flip = L.goalAt[1] < sc0;
    bubbleBurst(p.x, p.y + 10, 8, 26);
    sfx(500, 0.09, 'sine', 0.12);
  } else {
    benji.popIn = 1;
    benji.home = { x: p.x, y: p.y, t: 0, sx: sx, sy: sy, dur: 0.5 };
    if (p.x < sx - 4) benji.flip = true;
    else if (p.x > sx + 4) benji.flip = false;
    blub();
  }
}
function manualReset() {
  if (!L) return;
  beginReturn(true);
}
function finishFail() {
  if (!run) { mode = 'edit'; return; }
  beginReturn(false);
}
function launchArrow() {
  const dir = run.cmds[run.i];
  const n = run.i + 1;
  const res = resolve(L, { r: benji.r, c: benji.c, sw: run.sw, fr: run.fr }, dir, n);
  run.res = res;
  run.segs = [];
  if (L.hasJ) run.segs.push({ kind: 'beat', safe: n % 2 === 1, dur: 0.18 });
  let fromR = benji.r, fromC = benji.c;
  res.moves.forEach((m, idx) => {
    const next = res.moves[idx + 1];
    if (m.type === 'swim') {
      const travel = travelDir(m.r - fromR, m.c - fromC) || dir;
      const fail = m.fail || null;
      const bump = !!(fail && BUMP_FAIL[fail]);
      run.segs.push({
        kind: 'swim', r: m.r, c: m.c, fail: fail, dir: travel,
        dur: bump ? 0.24 : MOVE_T, short: bump, fromR: fromR, fromC: fromC
      });
      if (bump) run.segs.push({ kind: 'bounce', dur: 0.32, fail: fail, r: fromR, c: fromC });
      else if (fail === 'water' || fail === 'off') run.segs.push({ kind: 'fall', dur: 1.25, fail: fail });
      else if (!fail && next && next.type !== 'tube') run.segs.push({ kind: 'wait', dur: 0.07 });
      fromR = m.r; fromC = m.c;
    } else if (m.type === 'tube') {
      run.segs.push({ kind: 'tube', r: m.r, c: m.c, nr: m.nr, nc: m.nc });
      fromR = m.nr; fromC = m.nc;
      if (next) run.segs.push({ kind: 'wait', dur: 0.1 });
    } else assertNever(m.type);
  });
  if (res.ok) {
    const last = res.moves[res.moves.length - 1];
    const another = run.i + 1 < run.cmds.length;
    // v10 wins on the last stroke. The 0.07s beat stays only while another arrow follows.
    const gap = last && last.type === 'tube' ? 0.1 : (another ? 0.07 : 0);
    if (gap > 0) run.segs.push({ kind: 'wait', dur: gap });
  }
  run.si = 0;
  beginSeg();
}
function beginSeg() {
  const seg = run.segs[run.si];
  if (!seg) return;
  seg.t = 0;
  if (seg.kind === 'swim') {
    seg.x0 = benji.x; seg.y0 = benji.y;
    const full = spotOf(G, seg.r, seg.c);
    if (seg.short) {
      seg.x1 = lerp(seg.x0, full.x, 0.42);
      seg.y1 = lerp(seg.y0, full.y, 0.42);
    } else {
      seg.x1 = full.x; seg.y1 = full.y;
    }
    faceToward(seg.dir);
    benji.squat = 0;
    blub();
  } else if (seg.kind === 'bounce') {
    seg.x0 = benji.x; seg.y0 = benji.y;
    const home = spotOf(G, seg.r, seg.c);
    seg.x1 = home.x; seg.y1 = home.y;
    benji.moving = true;
    if (seg.fail === 'urchin') sfx(190, 0.42, 'sine', 0.1);
    else sfx(200, 0.16, 'sine', 0.1);
  } else if (seg.kind === 'fall') {
    seg.y0 = benji.y;
    seg.dropped = false;
    benji.moving = false;
    glide(420, 160, 0.5, 'sine', 0.08);
    bubbleBurst(benji.x, benji.y + 20, 6, 30);
  } else if (seg.kind === 'tube') {
    seg.phase = 'in';
    seg.pts = tubePolyline(seg);
    seg.len = polyLen(seg.pts);
    seg.ride = clamp(0.7 + seg.len / 2200, 1, 1.4);
    seg.ts = tubeShrink();
    seg.mouth = spotOf(G, seg.r, seg.c);
    seg.dest = spotOf(G, seg.nr, seg.nc);
    seg.ang = null;
    const q0 = seg.pts[0];
    const q1 = seg.pts[Math.min(1, seg.pts.length - 1)];
    if (q1.x < q0.x - 2) faceToward('L');
    else if (q1.x > q0.x + 2) faceToward('R');
    benji.spin = 0;
    glide(320, 1100, 0.45, 'sine', 0.08);
  }
}
function arrive(r, c) {
  const ch = cellChar(L.grid, r, c);
  if (SW[ch]) run.sw.add(SW[ch]);
  if (ch === 'F') run.fr.add(r + ',' + c);
  if (treat && !treat.got && treat.r === r && treat.c === c) {
    treat.got = true;
    sfx(740, 0.1, 'triangle', 0.06);
    burst(benji.x, benji.y, '#ffe14d');
  }
  benji.r = r; benji.c = c;
}
function overshootIndex(cmds) {
  let st = { r: L.start[0], c: L.start[1], sw: new Set(), fr: new Set() };
  for (let i = 0; i < cmds.length; i++) {
    const res = resolve(L, st, cmds[i], i + 1);
    if (!res.ok) return null;
    if (isWin(L, res.st) && i < cmds.length - 1) return i + 1;
    st = res.st;
  }
  return null;
}
function startReact(why, slot, dur) {
  run.failSlot = slot;
  run.react = { why: why, t: 0, dur: dur == null ? 1 : dur };
  mode = 'fail';
  sfx(why === 'jelly' ? 180 : 220, 0.2, 'sine', 0.08);
}
function winningGoal(seg) {
  if (!run || !L || !seg || seg.fail) return false;
  if (run.i !== run.cmds.length - 1) return false;
  if (cellChar(L.grid, seg.r, seg.c) !== 'G') return false;
  return isWin(L, { r: seg.r, c: seg.c, sw: run.sw, fr: run.fr });
}
function segDone() {
  const seg = run.segs[run.si];
  if (seg.kind === 'wait') {
    if (seg.lead) { launchArrow(); return; }
    run.si++;
    if (run.si < run.segs.length) { beginSeg(); return; }
    finishArrow();
    return;
  }
  if (seg.kind === 'beat') {
    run.si++;
    if (run.si < run.segs.length) { beginSeg(); return; }
    finishArrow();
    return;
  }
  if (seg.kind === 'swim') {
    benji.rot = 0;
    benji.moving = false;
    if (!seg.fail) {
      benji.x = seg.x1; benji.y = seg.y1;
      arrive(seg.r, seg.c);
      if (!winningGoal(seg)) bubbleBurst(benji.x, benji.y + 30, 2, 20);
    } else if (seg.fail === 'jelly' || seg.fail === 'loop') {
      benji.x = seg.x1; benji.y = seg.y1;
      arrive(seg.r, seg.c);
      startReact(seg.fail, run.i, 1);
      return;
    } else if (!(BUMP_FAIL[seg.fail] || seg.fail === 'water' || seg.fail === 'off')) {
      startReact(seg.fail, run.i, 1);
      return;
    }
  } else if (seg.kind === 'bounce') {
    benji.moving = false;
    benji.x = seg.x1; benji.y = seg.y1;
    benji.r = seg.r; benji.c = seg.c;
    startReact(seg.fail, run.i, seg.fail === 'urchin' ? 0.9 : 1.1);
    return;
  } else if (seg.kind === 'fall') {
    benji.hidden = true;
    benji.alpha = 0;
    benji.rot = 0;
    benji.ox = 0;
    benji.forceState = null;
    benji.moving = false;
    // v10 AUTO_RESET.water is 0.35s after the sink. 0.42 pops five frames late.
    startReact(seg.fail, run.i, 0.35);
    return;
  } else if (seg.kind === 'tube') {
    benji.shrink = 1;
    benji.spin = 0;
    benji.moving = false;
    benji.x = seg.dest.x;
    benji.y = seg.dest.y;
    arrive(seg.nr, seg.nc);
  } else assertNever(seg.kind);
  run.si++;
  if (run.si < run.segs.length) { beginSeg(); return; }
  finishArrow();
}
function finishArrow() {
  if (run.res && run.res.ok) {
    benji.r = run.res.st.r; benji.c = run.res.st.c;
    run.sw = new Set(run.res.st.sw);
    run.fr = new Set(run.res.st.fr);
    const p = spotOf(G, benji.r, benji.c);
    benji.x = p.x; benji.y = p.y;
    benji.moving = false;
  }
  run.i++;
  if (run.i >= run.cmds.length) {
    const st = { r: benji.r, c: benji.c, sw: run.sw, fr: run.fr };
    if (isWin(L, st)) startWin();
    else {
      const over = overshootIndex(run.cmds);
      const why = over != null ? 'toofar' : (runSim(L, run.cmds).why === 'friends' ? 'friends' : 'miss');
      startReact(why, over != null ? over : run.cmds.length - 1, 1.1);
    }
  } else launchArrow();
}
function startWin() {
  if (win) return;
  const len = queue.length;
  let n = runs <= 1 ? 3 : runs === 2 ? 2 : 1;
  if (L.goal === 'fewest' && len > L.need) n = Math.min(n, 2);
  const shell = L.goal === 'fewest' && len === L.need;
  win = { stars: n, shell: shell, t: 0, age: 0, friend: L.cast.goal, cardOn: false, cardT: 0 };
  mode = 'win';
  benji.moving = false;
  benji.rot = 0;
  benji.forceState = 'chomp';
  benji.forceValue = 0;
  benji.q = 0;
  benji.qv += 10;
  const prev = stars[world][levelIdx] || 0;
  if (n > prev) { stars[world][levelIdx] = n; store.set('v11stars' + world, stars[world]); }
  const unlocked = levelIdx + 1;
  if (unlocked > prog[world]) { prog[world] = unlocked; store.set('v11prog' + world, prog[world]); }
  chompSfx();
  after(0.08, goalChime);
  after(1.75, beginCard);
  const g = goalSpot(G, benji.r, benji.c);
  bubbleBurst(g.x, g.y, 12, 50);
  sparkle(g.x, g.y - 20, 16);
}
function beginCard() {
  if (!win || win.cardOn) return;
  win.cardOn = true;
  win.cardT = 0;
  whoosh();
}

function addCmd(dir) {
  if (state !== 'play') return;
  if (mode === 'fail') finishFail();
  if (mode !== 'edit') return;
  if (queue.length >= L.slots) { slotShake = 0.35; sfx(200, 0.08, 'square', 0.04); return; }
  queue.push(dir);
  sfx(620 + queue.length * 30, 0.06, 'sine', 0.06);
}
function removeSlot(i) {
  if (state !== 'play') return;
  if (mode === 'fail') { finishFail(); return; }
  if (mode !== 'edit' || i >= queue.length) return;
  queue.splice(i, 1);
  sfx(480, 0.05, 'sine', 0.04);
}

function onPointer(x, y) {
  if (!artReady || portrait()) return;
  unlockAudio();
  if (state === 'title') {
    worldButtons().forEach(b => { if (hit(b, x, y)) openSelect(b.i); });
    if (hit(musicButton(), x, y)) toggleMusic();
    if (hit(muteButton(), x, y)) { muted = !muted; applyMusic(); sfx(500, 0.06, 'sine', 0.05); }
    return;
  }
  if (hit(backButton(), x, y)) {
    if (state === 'play' || state === 'reward') openSelect(world);
    else state = 'title';
    sfx(400, 0.05, 'sine', 0.04);
    return;
  }
  if (hit(musicButton(), x, y)) { toggleMusic(); return; }
  if (hit(muteButton(), x, y)) { muted = !muted; applyMusic(); return; }
  if (state === 'select') {
    levelButtons().forEach(b => { if (!b.locked && hit(b, x, y)) loadLevel(b.i); });
    return;
  }
  if (state === 'reward') { if (hit(rewardNext(), x, y) || hit(playButton(), x, y)) continueReward(); return; }
  if (state === 'play' && mode === 'win') {
    if (win && win.cardOn && win.cardT >= 0.5 && (hit(nextButton(), x, y) || hit(playButton(), x, y))) nextFromWin();
    return;
  }
  if (state !== 'play' || !L) return;
  arrowButtons().forEach(a => { if (hit(a, x, y)) addCmd(a.dir); });
  if (hit(playButton(), x, y)) pressPlay();
  const sg = slotGeom(L.slots);
  for (let i = 0; i < queue.length; i++) {
    const sx = sg.x(i), sy = sg.y;
    if ((x - sx) * (x - sx) + (y - sy) * (y - sy) <= (sg.r + 8) * (sg.r + 8)) removeSlot(i);
  }
}

addEventListener('pointerdown', function (e) {
  if (e.cancelable) e.preventDefault();
  pressed = 'down';
  const p = toGame(e.clientX, e.clientY);
  onPointer(p.x, p.y);
}, { passive: false });
addEventListener('pointerup', function () { pressed = null; });
addEventListener('pointercancel', function () { pressed = null; });
addEventListener('contextmenu', function (e) { e.preventDefault(); });

// --- update ------------------------------------------------------------------
function updateJelly(dt) {
  if (!L || !L.hasJ) return;
  let want = true;
  if (mode === 'run' && run && run.segs[run.si] && run.segs[run.si].kind === 'beat') want = run.segs[run.si].safe;
  else if (mode === 'run' && run) want = ((run.i + 1) % 2) === 1;
  else want = ((queue.length + 1) % 2) === 1;
  if (want !== jellyUp && !jellyAnim) jellyAnim = { toUp: want, t: 0 };
  if (jellyAnim) {
    jellyAnim.t += dt;
    if (jellyAnim.t >= 0.33) { jellyUp = jellyAnim.toUp; jellyAnim = null; }
  }
}
function updateFx(dt) {
  if (!run) return;
  ['k', 'm', 'c', 'g', 'p', 's', 'o'].forEach(col => {
    if (run.sw.has(col)) {
      if (fx[col] == null) { fx[col] = 0; if (col === 'm' || col === 'g' || col === 'p') spawnBedTrail(col); }
      fx[col] += dt;
    }
  });
  trails.forEach(t => { t.t += dt; });
  trails = trails.filter(t => t.t < t.dur + 0.4);
}
function spawnBedTrail(channel) {
  if (!L) return;
  const pairs = { m: ['m', 'M'], g: ['5', 'y'], p: ['6', 'z'] };
  const pair = pairs[channel];
  if (!pair) return;
  const pads = L.pos[pair[0]] || [], beds = L.pos[pair[1]] || [];
  pads.forEach(p => beds.forEach(b => {
    const a = cellXY(G, p[0], p[1]), c = cellXY(G, b[0], b[1]);
    trails.push({ x0: a.x, y0: a.y, x1: c.x, y1: c.y, t: 0, dur: 0.55 });
  }));
}
function pingCardStars(was, now) {
  if (!win) return;
  for (let i = 0; i < 3; i++) {
    const at = 0.62 + i * 0.25;
    if (was < at && now >= at) {
      if (i < win.stars) starSfx();
      else unclick();
    }
  }
}
function update(dt) {
  T += dt;
  for (let i = later.length - 1; i >= 0; i--) {
    later[i].t -= dt;
    if (later[i].t <= 0) { const fn = later[i].fn; later.splice(i, 1); fn(); }
  }
  if (win && win.cardOn) {
    const was = win.cardT;
    win.cardT += dt;
    pingCardStars(was, win.cardT);
  }
  const adt = dt * animMul;
  slotShake = Math.max(0, slotShake - dt);
  benji.turnT = Math.min(1, benji.turnT + adt / 0.14);
  if (benji.popIn < 1) benji.popIn = Math.min(1, benji.popIn + dt / 0.35);
  const stroking = mode === 'run' && run && run.segs[run.si] && run.segs[run.si].kind === 'swim';
  if (!stroking) benji.squat *= Math.pow(0.8, adt * 60);
  if (benji.home) {
    const h = benji.home;
    h.t += dt;
    const k = clamp(h.t / h.dur, 0, 1);
    benji.x = lerp(h.sx, h.x, ease(k));
    benji.y = lerp(h.sy, h.y, ease(k));
    benji.moving = k < 1;
    if (k >= 1) { benji.home = null; benji.moving = false; }
  }
  bubbles.forEach(b => { b.y -= b.s * dt; if (b.y < -20) b.y = H + 10; b.x += Math.sin(T + b.w) * 8 * dt; });
  updateJelly(adt);
  if (state === 'reward' && reward) reward.t += dt;
  if (state === 'play' && win) win.t += dt;
  const seg = run && run.segs[run.si];
  if (seg && mode === 'run' && stepSeg(seg, dt, adt)) segDone();
  if (mode === 'fail' && run && run.react) {
    run.react.t += dt;
    const falling = run.react.why === 'water' || run.react.why === 'off';
    if (!falling) benji.ox = Math.sin(run.react.t * 34) * 8 * (1 - clamp(run.react.t, 0, 1));
    const fallLive = seg && seg.kind === 'fall' && seg.t < seg.dur;
    if (!fallLive && run.react.t >= run.react.dur) beginReturn(false);
  }
  benji.qv += (-benji.q * 260 - benji.qv * 14) * dt;
  benji.q += benji.qv * dt;
  if (mode === 'win' && win) win.age += dt;
  parts.forEach(p => {
    p.t += dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    if (p.kind === 'spark') p.vy += 500 * dt;
    else if (p.kind !== 'bubble') p.vy += 40 * dt;
  });
  parts = parts.filter(p => p.t < p.life);
  updateFx(adt);
  if (G && mode === 'edit' && L && !benji.home && benji.popIn >= 1) {
    const p = spotOf(G, benji.r, benji.c);
    benji.x = p.x; benji.y = p.y;
  }
}
function stepSeg(seg, dt, adt) {
  if (seg.kind === 'wait' || seg.kind === 'beat') {
    seg.t += adt;
    benji.moving = false;
    return seg.t >= seg.dur;
  }
  if (seg.kind === 'swim') return stepSwim(seg, adt);
  if (seg.kind === 'bounce') return stepBounce(seg, adt);
  if (seg.kind === 'fall') return stepFall(seg, dt);
  if (seg.kind === 'tube') return stepTube(seg, adt);
  return assertNever(seg.kind);
}
function stepSwim(seg, adt) {
  seg.t += adt;
  const k = clamp(seg.t / seg.dur, 0, 1);
  const hop = Math.sin(k * Math.PI) * (seg.short ? 6 : 14);
  benji.x = lerp(seg.x0, seg.x1, ease(k));
  benji.y = lerp(seg.y0, seg.y1, ease(k)) - hop;
  benji.moving = k < 1;
  benji.squat = 0;
  const nose = seg.dir === 'L' ? -1 : seg.dir === 'R' ? 1 : 0;
  benji.rot = nose * (benji.flip ? -1 : 1) * 0.12 * Math.sin(k * Math.PI);
  if (winningGoal(seg)) {
    benji.forceState = 'chomp';
    benji.forceValue = clamp(seg.t / seg.dur * 1.3, 0, 1);
  }
  return k >= 1;
}
function stepBounce(seg, adt) {
  seg.t += adt;
  const k = clamp(seg.t / seg.dur, 0, 1);
  benji.x = lerp(seg.x0, seg.x1, ease(k));
  benji.y = lerp(seg.y0, seg.y1, ease(k)) - Math.sin(k * Math.PI) * 26;
  benji.moving = k < 1;
  return k >= 1;
}
function stepFall(seg, dt) {
  if (seg.t >= seg.dur) return true;
  seg.t += dt;
  if (seg.t < 0.45) {
    benji.forceState = 'oops';
    benji.forceValue = (seg.t * 3) % 1;
    benji.ox = Math.sin(seg.t * 40) * 7;
    benji.rot = Math.sin(seg.t * 24) * 0.22;
    benji.y = seg.y0 - Math.sin((seg.t / 0.45) * Math.PI) * 10;
    benji.shrink = 1;
    benji.alpha = 1;
    benji.moving = false;
    return false;
  }
  if (!seg.dropped) {
    seg.dropped = true;
    glide(1500, 260, 0.95, 'sine', 0.07);
    bubbleBurst(benji.x, benji.y, 10, 40);
  }
  const k = clamp((seg.t - 0.45) / 0.8, 0, 1);
  benji.forceState = null;
  benji.y = seg.y0 + k * k * 150;
  benji.shrink = 1 - 0.5 * k;
  benji.alpha = 1 - k * k;
  benji.rot += dt * 5;
  benji.ox = Math.sin(seg.t * 30) * 4 * (1 - k);
  if (Math.random() < 0.5) bubbleBurst(benji.x, benji.y, 1, 20);
  benji.moving = false;
  return k >= 1;
}
function stepTube(seg, adt) {
  seg.t += adt;
  if (seg.phase === 'in') {
    const k = clamp(seg.t / 0.2, 0, 1);
    benji.shrink = lerp(1, seg.ts, ease(k));
    benji.x = seg.mouth.x;
    benji.y = seg.mouth.y + k * 8;
    benji.moving = true;
    if (k >= 1) { seg.phase = 'ride'; seg.t = 0; seg.ang = null; benji.spin = 0; }
    return false;
  }
  if (seg.phase === 'ride') {
    const k = clamp(seg.t / seg.ride, 0, 1);
    const q = samplePoly(seg.pts, ease(k));
    benji.x = q.x; benji.y = q.y;
    benji.shrink = seg.ts;
    benji.rot = 0;
    benji.moving = true;
    let ang = benji.flip ? Math.atan2(-q.dy, -q.dx) : Math.atan2(q.dy, q.dx);
    if (seg.ang != null) {
      while (ang - seg.ang > Math.PI) ang -= Math.PI * 2;
      while (ang - seg.ang < -Math.PI) ang += Math.PI * 2;
    }
    seg.ang = ang;
    benji.spin = ang;
    if (k > 0.04 && k < 0.96 && Math.random() < 0.7) {
      const mag = Math.hypot(q.dx, q.dy) || 1;
      const tx = q.dx / mag, ty = q.dy / mag;
      parts.push({
        kind: 'bubble',
        x: benji.x - tx * 30 + (Math.random() * 12 - 6),
        y: benji.y - ty * 30 + (Math.random() * 12 - 6),
        vx: -tx * 30, vy: -20,
        r: 3 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.25,
        t: 0
      });
    }
    if (k >= 1) {
      seg.phase = 'out';
      seg.t = 0;
      benji.spin = 0;
      benji.x = seg.dest.x;
      glide(260, 820, 0.14, 'sine', 0.1);
      bubbleBurst(seg.dest.x, seg.dest.y, 8, 30);
    }
    return false;
  }
  if (seg.phase === 'out') {
    const k = clamp(seg.t / 0.4, 0, 1);
    benji.shrink = lerp(seg.ts, 1, bounceOut(k));
    benji.spin = 0;
    benji.x = seg.dest.x;
    benji.y = seg.dest.y - Math.sin(k * Math.PI) * 34 + (1 - k) * 10;
    benji.moving = k < 1;
    return k >= 1;
  }
  return assertNever(seg.phase);
}
function tubePolyline(seg) {
  const route = tubes.filter(t => {
    const cells = t.cells;
    const s = cells[0], e = cells[cells.length - 1];
    const fwd = s[0] === seg.r && s[1] === seg.c && e[0] === seg.nr && e[1] === seg.nc;
    const rev = e[0] === seg.r && e[1] === seg.c && s[0] === seg.nr && s[1] === seg.nc;
    return fwd || rev;
  })[0];
  if (!route) return [spotOf(G, seg.r, seg.c), spotOf(G, seg.nr, seg.nc)];
  let pts = pipePoints(route);
  const s = route.cells[0];
  if (!(s[0] === seg.r && s[1] === seg.c)) pts = pts.slice().reverse();
  return pts;
}
function samplePoly(pts, u) {
  let len = 0;
  const seg = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    const d = Math.hypot(dx, dy) || 0.001;
    seg.push(d); len += d;
  }
  let left = u * len;
  for (let i = 1; i < pts.length; i++) {
    if (left <= seg[i - 1]) {
      const t = left / seg[i - 1];
      return {
        x: lerp(pts[i - 1].x, pts[i].x, t), y: lerp(pts[i - 1].y, pts[i].y, t),
        dx: pts[i].x - pts[i - 1].x, dy: pts[i].y - pts[i - 1].y
      };
    }
    left -= seg[i - 1];
  }
  const last = pts[pts.length - 1], prev = pts[pts.length - 2] || last;
  return { x: last.x, y: last.y, dx: last.x - prev.x, dy: last.y - prev.y };
}
function polyLen(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return n;
}
function tubeShrink() {
  const S = SPRITES.benji;
  const f = S && S.ready && (S.frames.idle || [])[0];
  const sc = (G.TW / 140) * 0.40;
  const h = f ? f.h * S.pxScale * sc * 0.62 : 80 * sc;
  const thick = Math.min(G.PW, G.TD) * 0.46;
  return clamp(thick * 0.6 / Math.max(1, h), 0.5, 0.8);
}
function bubbleBurst(x, y, n, spread) {
  for (let i = 0; i < n; i++) {
    parts.push({
      kind: 'bubble',
      x: x + (Math.random() * 2 - 1) * spread,
      y: y + (Math.random() * 2 - 1) * spread * 0.6,
      vx: (Math.random() * 2 - 1) * 40,
      vy: -60 - Math.random() * 100,
      r: 3 + Math.random() * 7,
      life: 0.7 + Math.random() * 0.6,
      t: 0
    });
  }
}
function sparkle(x, y, n) {
  const colors = ['#ffe14d', '#ff9ec7', '#7ee8ff', '#a6ff7e'];
  const count = n || 14;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 100 + Math.random() * 220;
    parts.push({
      kind: 'spark', x: x, y: y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      s: 0.25 + Math.random() * 0.25,
      color: colors[Math.floor(Math.random() * 4)],
      life: 0.6 + Math.random() * 0.4,
      t: 0, rot: Math.random() * 6
    });
  }
}
function burst(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 160;
    parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: 0.7, color: color, s: 4 + Math.random() * 5 });
  }
}
for (let i = 0; i < 18; i++) bubbles.push({ x: Math.random() * W, y: Math.random() * H, r: 3 + Math.random() * 8, s: 18 + Math.random() * 36, w: Math.random() * 6 });

// --- draw --------------------------------------------------------------------
function text(s, x, y, size, fill, stroke, lw, align) {
  ctx.font = 'bold ' + size + 'px ' + FONT;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  if (lw) { ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function fitText(s, x, y, size, maxW, fill, stroke, lw) {
  let z = size;
  ctx.font = 'bold ' + z + 'px ' + FONT;
  while (z > 12 && ctx.measureText(s).width > maxW) { z -= 1; ctx.font = 'bold ' + z + 'px ' + FONT; }
  text(s, x, y, z, fill, stroke, lw);
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function starPath(r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.46 : r;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
}
function drawStars(x, y, n, r) {
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.translate(x + (i - 1) * (r * 2.2), y);
    starPath(r);
    ctx.fillStyle = i < n ? '#ffd43b' : 'rgba(255,255,255,.35)';
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = i < n ? '#b78112' : 'rgba(0,0,0,.25)'; ctx.stroke();
    ctx.restore();
  }
}
function arrowGlyph(dir, s) {
  ctx.save();
  ctx.rotate({ L: Math.PI, D: Math.PI / 2, U: -Math.PI / 2, R: 0 }[dir]);
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.18); ctx.lineTo(s * 0.05, -s * 0.18); ctx.lineTo(s * 0.05, -s * 0.5);
  ctx.lineTo(s * 0.62, 0); ctx.lineTo(s * 0.05, s * 0.5); ctx.lineTo(s * 0.05, s * 0.18); ctx.lineTo(-s * 0.55, s * 0.18);
  ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = s * 0.12; ctx.strokeStyle = 'rgba(20,30,60,.45)'; ctx.stroke();
  ctx.restore();
}
function dirDisc(dir, x, y, r) {
  const C = { L: ['#d68bea', '#a24fcf'], D: ['#f7c62a', '#c98a00'], U: ['#93d3f7', '#3d8fd6'], R: ['#9fe6b8', '#38ad6a'] }[dir];
  ctx.beginPath(); ctx.arc(x, y + 4, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(60,40,0,.2)'; ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff'); g.addColorStop(0.45, C[0]); g.addColorStop(1, C[0]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = C[1]; ctx.stroke();
  ctx.save(); ctx.translate(x, y); arrowGlyph(dir, r * 1.05); ctx.restore();
}
function drawCover(img) {
  if (!img || !img.complete || !img.naturalWidth) return false;
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  return true;
}
function backdrop() {
  let key = 'title';
  if (state === 'play' || state === 'select' || state === 'reward') key = WORLD_LOOK[world].bg;
  if (state === 'title') key = 'title';
  const img = IMAGES[key] || IMAGES.title;
  if (!drawCover(img)) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7fd4c8'); g.addColorStop(1, '#1b6ea8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (state !== 'title' && (world === 1 || world === 2)) {
    ctx.fillStyle = 'rgba(32,43,80,0.40)';
    ctx.fillRect(0, 0, W, H);
  }
  bubbles.forEach(b => {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.stroke();
  });
}
function drawBar() {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) ctx.lineTo(x, 648 + Math.sin(x * 0.02 + T) * 5);
  ctx.lineTo(W, H); ctx.closePath();
  ctx.fillStyle = '#ffe56a'; ctx.fill();
  ctx.beginPath();
  for (let x = 0; x <= W; x += 16) ctx.lineTo(x, 648 + Math.sin(x * 0.02 + T) * 5);
  ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
}
function drawPipes() {
  const col = { A: ['#e9f8ff', '#49c4f6', '#1668a8'], B: ['#e7fff3', '#46d48e', '#0f7a49'], C: ['#f4ecff', '#b894ff', '#5b36b0'] };
  tubes.forEach(route => {
    const pts = pipePoints(route);
    if (pts.length < 2) return;
    const C = col[route.letter];
    const lw = Math.min(G.PW, G.TD) * 0.46;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = '#1c2a4a'; ctx.lineWidth = lw + 8; ctx.stroke();
    ctx.strokeStyle = C[2]; ctx.lineWidth = lw + 3; ctx.stroke();
    ctx.strokeStyle = C[1]; ctx.lineWidth = lw; ctx.globalAlpha = 0.92; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.stroke();
    ctx.restore();
  });
}
function pushChain(r, c) {
  const pts = [[r, c]];
  const seen = new Set();
  for (let n = 0; n < PUSH_CAP; n++) {
    const last = pts[pts.length - 1];
    const ch = cellChar(L.grid, last[0], last[1]);
    if (!CUR[ch]) break;
    const d = CUR[ch];
    const nr = last[0] + d[0], nc = last[1] + d[1];
    const k = nr + ',' + nc;
    if (seen.has(k)) break;
    seen.add(k);
    pts.push([nr, nc]);
    const landed = cellChar(L.grid, nr, nc);
    if (!landed) break;
    if (L.tubes[k]) pts.push(L.tubes[k].slice());
  }
  return pts;
}
function drawPushHints() {
  ctx.save();
  ctx.lineCap = 'round';
  for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
    if (!CUR[L.grid[r][c]]) continue;
    const pts = pushChain(r, c).map(p => nodeXY(G, p[0], p[1]));
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.stroke();
  }
  ctx.restore();
}
function floorState(ch) { return ch === 'S' ? 'start' : 'sand'; }
function drawFloor(r, c, which) {
  const p = cellXY(G, r, c);
  const sc = G.TW / 140;
  ctx.save();
  ctx.fillStyle = 'rgba(10,30,50,.18)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + G.TD * 0.42, G.PW * 0.42, G.TD * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawSprite(WORLD_LOOK[world].tile, which, p.x, p.y, { scale: sc });
  if (world === 3) drawSprite('tileGlow', 'pulse', p.x, p.y, { scale: sc, frame: Math.floor(T * 4) % 4, add: true, alpha: 0.9 });
}
function gateOpen(color) { return !!(run && run.sw && run.sw.has(color) && (mode === 'run' || mode === 'fail' || mode === 'win')); }
function frameHold(name, stateName, fps, t) {
  const frames = SPRITES[name] && SPRITES[name].frames[stateName];
  if (!frames) return 0;
  return Math.min(frames.length - 1, Math.floor(t * fps));
}
function drawBubble(x, y, rad, locked) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.35, 2, x, y, rad);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(0.55, locked ? 'rgba(198,208,216,.84)' : 'rgba(186,255,232,.8)');
  g.addColorStop(1, 'rgba(255,255,255,.42)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = locked ? 'rgba(220,230,240,.7)' : 'rgba(235,255,245,.95)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x - rad * 0.25, y - rad * 0.3, rad * 0.22, Math.PI * 1.1, Math.PI * 1.7);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}
function friendFrame() { return Math.floor(T * 6) % 4; }
function cheerHop(phase) {
  if (mode !== 'win' || !win) return 0;
  return Math.sin(Math.min(win.age, 1.75) * Math.PI * 3 + phase) * 16;
}
function drawGoalBubble(r, c) {
  const p = cellXY(G, r, c);
  const sc = G.TW / 140;
  const hop = cheerHop(0);
  const y = p.y - G.TD * 0.55 + Math.sin(T * 2.4) * 4 - hop;
  const rescued = L.friendKeys.filter(k => run && run.fr && run.fr.has(k)).length;
  const need = L.friendKeys.length;
  const locked = L.goal === 'rescue-all' && rescued < need;
  const pop = (mode === 'win' && win) ? clamp(win.age / 0.6, 0, 1) : 0;
  if (pop < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - pop;
    drawBubble(p.x, y + hop * 0.35, 40 * sc * (1 + pop * 0.45), locked);
    ctx.restore();
  }
  const bob = friendFrame();
  drawSprite(L.cast.goal, mode === 'win' ? 'happy' : 'idle', p.x, y + 6 * sc, { scale: 0.40 * sc, frame: bob });
  if (L.goal === 'rescue-all' && pop < 1) {
    text(rescued + '/' + need, p.x, y + 34 * sc, Math.max(16, 18 * sc), '#fff', '#14324a', 4);
  }
}
function drawFriendBubble(r, c) {
  const p = cellXY(G, r, c);
  const sc = G.TW / 140;
  const key = r + ',' + c;
  const got = run && run.fr && run.fr.has(key);
  const y = p.y - G.TD * 0.42 + Math.sin(T * 2 + c) * 3 - (got ? cheerHop(c) : 0);
  drawBubble(p.x, y, 34 * sc, !got && L.goal === 'rescue-all');
  drawSprite(L.cast.extras[key] || 'turtle', got ? 'happy' : 'idle', p.x, y + 4 * sc, { scale: 0.34 * sc, frame: friendFrame() });
}
function drawUrchinAt(p, sc, bump) {
  drawSprite('urchin_warn', 'pulse', p.x, p.y, { scale: sc, frame: Math.floor(T * 8) % 6, alpha: 0.95 });
  drawSprite('urchin', bump ? 'bump' : 'idle', p.x, p.y, { scale: sc, frame: bump ? Math.floor(T * 12) % 4 : 0 });
}
const PAINT = { gold: '#2ec4b6', pink: '#ff6fb5' };
function drawMark(x, y, kind, sc) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#14324a';
  ctx.lineWidth = Math.max(3, 4 * sc);
  ctx.lineJoin = 'round';
  if (kind === 'moon') {
    ctx.beginPath();
    ctx.arc(0, 0, 16 * sc, 0.45, Math.PI * 1.75);
    ctx.arc(7 * sc, -2 * sc, 13 * sc, Math.PI * 1.15, 0.35, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, 8 * sc);
    ctx.bezierCurveTo(-18 * sc, -6 * sc, -8 * sc, -16 * sc, 0, -6 * sc);
    ctx.bezierCurveTo(8 * sc, -16 * sc, 18 * sc, -6 * sc, 0, 8 * sc);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
function drawBed(p, sc, channel, tint, mark) {
  const on = gateOpen(channel);
  const t = fx[channel] || 0;
  const opt = { scale: sc, tint: tint || null };
  if (!on) {
    drawSprite('urchinBed', 'plate', p.x, p.y, opt);
    drawUrchinAt(p, sc, false);
  } else if (t < 4 / 12) {
    drawSprite('urchinBed', 'tuck', p.x, p.y, Object.assign({ frame: Math.min(3, Math.floor(t * 12)) }, opt));
  } else drawSprite('urchinBed', 'flat', p.x, p.y, opt);
  if (mark) drawMark(p.x, p.y + G.TD * 0.32, mark, Math.max(0.55, sc * 0.62));
}
function drawClam(p, sc, look, channel) {
  const on = gateOpen(channel);
  const state = look + (on ? '_open' : '_closed');
  const frame = on ? frameHold('clam', state, 12, fx[channel] || 0) : Math.floor(T * 6) % 4;
  drawSprite('clam', state, p.x, p.y, { scale: sc, frame: frame });
}
function drawKelpGate(p, sc, look, channel) {
  const on = gateOpen(channel);
  const state = look + (on ? '_open' : '_closed');
  const frame = on ? frameHold('kelpgate', state, 12, fx[channel] || 0) : Math.floor(T * 6) % 4;
  drawSprite('kelpgate', state, p.x, p.y, { scale: sc, frame: frame });
}
function drawPad(p, sc, channel, tint, mark) {
  const on = gateOpen(channel);
  const state = on ? 'down' : 'up';
  const frame = on ? frameHold('urchinPad', 'down', 12, fx[channel] || 0) : Math.floor(T * 6) % 4;
  drawSprite('urchinPad', state, p.x, p.y, { scale: sc, frame: frame, tint: tint || null });
  if (mark) drawMark(p.x, p.y - 10 * sc, mark, Math.max(0.75, sc));
}
function stingerState() {
  if (mode === 'fail' && run && run.react && run.react.why === 'jelly') return { state: 'sting', frame: Math.min(3, Math.floor(run.react.t * 12)) };
  if (jellyAnim) return { state: jellyAnim.toUp ? 'rise' : 'sink', frame: Math.min(3, Math.floor(jellyAnim.t * 12)) };
  return { state: jellyUp ? 'up' : 'down', frame: Math.floor(T * 6) % 4 };
}
function drawStinger(p, sc) {
  const s = stingerState();
  if (!jellyUp && !jellyAnim) drawSprite('stingerWarn', 'pulse', p.x, p.y, { scale: sc, frame: Math.floor(T * 12) % 6 });
  drawSprite('stinger', s.state, p.x, p.y, { scale: sc, frame: s.frame });
}
function drawTreatSprite(r, c) {
  const p = cellXY(G, r, c);
  const sc = G.TW / 140;
  drawSprite('treat', treat.kind, p.x, p.y - 6, { scale: sc * 0.72, frame: Math.floor(T * 6) % 4 });
}
function drawActors() {
  const items = [];
  const add = (row, layer, draw) => items.push({ row: row, layer: layer, draw: draw });
  const openingFrame = Math.floor(T * 8) % 4;
  for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
    const ch = L.grid[r][c];
    const p = cellXY(G, r, c);
    const sc = G.TW / 140;
    if (PIPE_MOUTH[ch]) {
      add(r, 0, () => drawSprite('tube_opening', ch.toLowerCase(), p.x, p.y, { scale: sc * 0.86, frame: openingFrame }));
    }
    if (ch === 'U') add(r, 0, () => drawUrchinAt(p, sc, false));
    if (ch === 'M') add(r, 0, () => drawBed(p, sc, 'm', null, null));
    if (ch === 'y') add(r, 0, () => drawBed(p, sc, 'g', PAINT.gold, 'moon'));
    if (ch === 'z') add(r, 0, () => drawBed(p, sc, 'p', PAINT.pink, 'heart'));
    if (ch === 'h') add(r, 0, () => drawClam(p, sc, 'coral', 'k'));
    if (ch === '2') add(r, 0, () => drawClam(p, sc, 'gold', 'g'));
    if (ch === '3') add(r, 0, () => drawClam(p, sc, 'pink', 'p'));
    if (ch === 'H') add(r, 0, () => drawKelpGate(p, sc, 'coral', 'k'));
    if (ch === 'Y') add(r, 0, () => drawKelpGate(p, sc, 'gold', 'g'));
    if (ch === 'Z') add(r, 0, () => drawKelpGate(p, sc, 'pink', 'p'));
    if (ch === 'm') add(r, 0, () => drawPad(p, sc, 'm', null, null));
    if (ch === '5') add(r, 0, () => drawPad(p, sc, 'g', PAINT.gold, 'moon'));
    if (ch === '6') add(r, 0, () => drawPad(p, sc, 'p', PAINT.pink, 'heart'));
    if (ch === 'J') add(r, 0, () => drawStinger(p, sc));
    if (ch === 'G') add(r, 1, () => drawGoalBubble(r, c));
    if (ch === 'F') add(r, 1, () => drawFriendBubble(r, c));
    if (treat && !treat.got && treat.r === r && treat.c === c && !treatOverGoal(L, treat)) {
      add(r, 0, () => drawTreatSprite(r, c));
    }
    if (ch === 'G' && treat && !treat.got && treatOverGoal(L, treat) && treat.r === r - 1 && treat.c === c) {
      add(r, 2, () => drawTreatSprite(treat.r, treat.c));
    }
  }
  const inTube = mode === 'run' && run && run.segs[run.si] && run.segs[run.si].kind === 'tube';
  if (!inTube) add((benji.y - G.by) / G.TD - 0.5, 2, drawBenji);
  items.sort((a, b) => a.row - b.row || a.layer - b.layer).forEach(it => it.draw());
  if (inTube) drawBenji();
}
function benjiPose() {
  if (benji.forceState) return { state: benji.forceState, value: benji.forceValue || 0 };
  if (benji.moving) return { state: 'swim', value: (T * 2.5) % 1 };
  if (mode === 'win') return { state: 'happy', value: (T * 3) % 1 };
  if (mode === 'fail') return { state: 'oops', value: clamp((run && run.react && run.react.t) || 0, 0, 1) };
  const bp = T % 3.5;
  const value = bp < 0.07 ? 2 / 3 : bp < 0.15 ? 1 : bp < 0.22 ? 2 / 3 : ((T * 0.9) % 1) * 0.45;
  return { state: 'idle', value: value };
}
function drawBenji() {
  if (benji.hidden || benji.alpha <= 0.02) return;
  const pin = benji.popIn < 1 ? bounceOut(benji.popIn) : 1;
  const turn = benji.turnT < 1 ? Math.max(0.2, Math.abs(1 - 2 * benji.turnT)) : 1;
  const sc = (G ? G.TW : 160) / 140 * 0.40 * benji.shrink * pin;
  const pose = benjiPose();
  const sx = (1 + benji.q + benji.squat) * turn;
  const sy = 1 - benji.q - benji.squat;
  const sheet = SPRITES.benji;
  const base = sheet && ((sheet.frames.idle || [])[0]);
  const pt = sheet && sheet.points && sheet.points.center;
  let x = benji.x + benji.ox;
  let y = benji.y + benji.extraY;
  if (base && pt) {
    const cx = (pt[0] - base.ax) * sheet.pxScale;
    const cy = (pt[1] - base.ay) * sheet.pxScale;
    x -= (benji.flip ? -cx : cx) * sc * sx;
    y -= cy * sc * sy;
  }
  ctx.save();
  if (benji.spin) {
    ctx.translate(benji.x, benji.y);
    ctx.rotate(benji.spin);
    ctx.translate(-benji.x, -benji.y);
  }
  drawSprite('benji', pose.state, x, y, {
    scale: sc, value: pose.value, flipX: benji.flip, sx: sx, sy: sy, rot: benji.rot, alpha: benji.alpha
  });
  ctx.restore();
}
function drawBoard() {
  drawPipes();
  for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
    const ch = L.grid[r][c];
    if (ch === '.') continue;
    if (CUR[ch]) {
      drawFloor(r, c, 'sand');
      const p = cellXY(G, r, c);
      const sc = G.TW / 140;
      const face = { '>': 'r', '<': 'l', '^': 'u', v: 'd' }[ch];
      drawSprite('current', face, p.x, p.y, { scale: sc, frame: Math.floor(T * 8) % 4 });
    } else drawFloor(r, c, floorState(ch));
  }
  drawPushHints();
  drawActors();
  drawTrails();
  if (L.hasJ) drawBeat();
}
function drawTrails() {
  trails.forEach(t => {
    const u = clamp(t.t / t.dur, 0, 1);
    const fade = t.t > t.dur ? 1 - (t.t - t.dur) / 0.4 : 1;
    for (let i = 0; i < 8; i++) {
      const k = i / 8;
      if (k > u) break;
      const x = lerp(t.x0, t.x1, k), y = lerp(t.y0, t.y1, k) - Math.sin(k * Math.PI) * 36;
      ctx.globalAlpha = fade * 0.8;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#e7fff6'; ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
}
function drawBeat() {
  const n = L.slots;
  const y = Math.max(40, G.by - 26);
  const gap = 22;
  const x0 = clamp(G.bx + (G.cols * G.PW) / 2 - ((n - 1) * gap) / 2, 120, 980);
  const cur = mode === 'run' && run ? run.i : queue.length;
  for (let i = 0; i < n; i++) {
    const safe = (i + 1) % 2 === 1;
    ctx.beginPath(); ctx.arc(x0 + i * gap, y, i === cur ? 9 : 7, 0, Math.PI * 2);
    ctx.fillStyle = safe ? '#b8fff4' : '#ff8aa0';
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#14324a'; ctx.stroke();
  }
}
function drawSlot(i, sg) {
  const shake = slotShake > 0 ? Math.sin(slotShake * 50) * 6 : 0;
  const x = sg.x(i) + (i === 0 ? shake : 0), y = sg.y;
  const filled = i < queue.length;
  const active = mode === 'run' && run && run.i === i;
  const bad = mode === 'fail' && run && run.failSlot === i;
  const r = sg.r * (active ? 1.08 : 1);
  if (L.hasJ) {
    ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = (i + 1) % 2 === 1 ? 'rgba(95,245,255,.45)' : 'rgba(232,54,79,.28)';
    ctx.fill();
  }
  if (bad) {
    const wobble = Math.sin((run.react.t || 0) * 16) * 8;
    ctx.save();
    ctx.translate(wobble, 0);
    ctx.beginPath(); ctx.arc(x, y, r + 18, 0, Math.PI * 2);
    ctx.fillStyle = '#e11d2e'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r + 23, 0, Math.PI * 2);
    ctx.lineWidth = 4; ctx.strokeStyle = '#202b50'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r + 18, 0, Math.PI * 2);
    ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
    if (filled) dirDisc(queue[i], x, y, r);
    ctx.lineCap = 'round';
    const xh = r * 0.95;
    ctx.strokeStyle = '#202b50'; ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(x - xh, y - xh); ctx.lineTo(x + xh, y + xh);
    ctx.moveTo(x + xh, y - xh); ctx.lineTo(x - xh, y + xh);
    ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x - xh, y - xh); ctx.lineTo(x + xh, y + xh);
    ctx.moveTo(x + xh, y - xh); ctx.lineTo(x - xh, y + xh);
    ctx.stroke();
    ctx.restore();
  } else if (filled) dirDisc(queue[i], x, y, r);
  else {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = L.goal === 'fewest' ? '#f3d48a' : '#c7bde6'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#7d6eaf'; ctx.stroke();
  }
  if (L.hasJ) text(String(i + 1), x, y + r + 14, 14, '#14324a', '#fff', 3);
  if (active) {
    ctx.fillStyle = '#ff7a1a';
    roundRect(x - 8, y - r - 22, 16, 12, 3); ctx.fill();
  }
  if (L.goal === 'fewest') {
    ctx.save(); ctx.translate(x, y + r + (L.hasJ ? 28 : 16)); ctx.scale(0.45, 0.45);
    ctx.beginPath(); ctx.arc(0, 0, 16, Math.PI, 0); ctx.fillStyle = '#ffe9a8'; ctx.fill();
    ctx.restore();
  }
}
function drawPlay(bt) {
  const isPlay = mode === 'edit' || mode === 'win';
  ctx.save(); ctx.translate(bt.x + bt.w / 2, bt.y + bt.h / 2);
  ctx.fillStyle = 'rgba(50,20,90,.28)';
  roundRect(-bt.w / 2, -bt.h / 2 + 6, bt.w, bt.h, 26); ctx.fill();
  ctx.fillStyle = isPlay && queue.length === 0 && mode === 'edit' ? '#b7a6e4' : '#7b4fe0';
  if (L && L.goal === 'fewest' && mode === 'edit' && queue.length > 0) ctx.fillStyle = '#6a3fd4';
  roundRect(-bt.w / 2, -bt.h / 2, bt.w, bt.h, 26); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#3c237e'; ctx.stroke();
  ctx.fillStyle = '#fff';
  if (mode === 'win') text('Next', 0, 0, 32, '#fff', '#3c237e', 5);
  else if (isPlay) {
    ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(26, 0); ctx.lineTo(-16, 22); ctx.closePath(); ctx.fill();
  } else {
    roundRect(-16, -16, 14, 32, 3); ctx.fill(); roundRect(6, -16, 14, 32, 3); ctx.fill();
  }
  ctx.restore();
}
function drawIconButton(bt, kind) {
  ctx.save();
  roundRect(bt.x, bt.y, bt.w, bt.h, 18);
  ctx.fillStyle = kind === 'music' && musicOn ? 'rgba(255,120,190,.9)' : 'rgba(16,50,90,.55)';
  if (kind === 'back') ctx.fillStyle = '#7b5ce0';
  ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.translate(bt.x + bt.w / 2, bt.y + bt.h / 2);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#14324a'; ctx.lineWidth = 4;
  if (kind === 'back') {
    ctx.beginPath(); ctx.moveTo(10, -16); ctx.lineTo(-14, 0); ctx.lineTo(10, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (kind === 'music') {
    text(musicOn ? '♪' : '♪', 0, 2, 36, '#fff', '#14324a', 4);
    if (!musicOn) { ctx.beginPath(); ctx.moveTo(-16, 16); ctx.lineTo(16, -16); ctx.stroke(); }
  } else {
    ctx.beginPath();
    ctx.moveTo(-16, -8); ctx.lineTo(-8, -8); ctx.lineTo(2, -16); ctx.lineTo(2, 16); ctx.lineTo(-8, 8); ctx.lineTo(-16, 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (muted) {
      ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(20, 12); ctx.moveTo(20, -12); ctx.lineTo(8, 12); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(4, 0, 10, -0.7, 0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(4, 0, 16, -0.6, 0.6); ctx.stroke();
    }
  }
  ctx.restore();
}
function drawControls() {
  drawBar();
  arrowButtons().forEach(a => dirDisc(a.dir, a.x + a.w / 2, a.y + a.h / 2, a.w * 0.46));
  const sg = slotGeom(L.slots);
  for (let i = 0; i < L.slots; i++) drawSlot(i, sg);
  if (mode !== 'win') drawPlay(playButton());
  if (world === 0 && levelIdx === 0 && mode === 'edit' && queue.length === 0) {
    const a = arrowButtons().filter(b => b.dir === 'R')[0];
    drawSprite('finger', 'tap', a.x + a.w * 0.72, a.y + a.h * 0.82, { scale: 0.55, frame: Math.floor(T * 6) % 6, alpha: 0.95 });
  }
}
function goalLabel(goal) {
  switch (goal) {
    case 'reach': return 'Reach';
    case 'fewest': return 'Fewest arrows';
    case 'rescue-all': return 'Rescue all';
    default: return assertNever(goal);
  }
}
function drawParts() {
  parts.forEach(p => {
    ctx.save();
    ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
    if (p.kind === 'bubble') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r || 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (p.kind === 'spark') {
      ctx.globalAlpha = Math.min(1, (1 - p.t / p.life) * 1.6);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      starPath(36 * (p.s || 0.35));
      ctx.fillStyle = p.color || '#ffe14d';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.s, p.s * 0.6);
    }
    ctx.restore();
  });
}
function drawFailPop() {
  if (mode !== 'fail' || !run || !run.react) return;
  const why = run.react.why;
  const msg = why === 'toofar' ? 'Too far!' : why === 'friends' ? 'Someone is waiting!' : why === 'jelly' ? 'Zap!' : 'Oops!';
  text(msg, benji.x, benji.y - 78, 36, '#fff', '#14324a', 6);
}
function viewRect() {
  return { x0: -offX / scale, y0: -offY / scale, x1: (viewW - offX) / scale, y1: (viewH - offY) / scale };
}
function drawWinStars(k) {
  for (let i = 0; i < 3; i++) {
    const q = clamp((k - 0.62 - i * 0.25) / 0.25, 0, 1);
    if (q <= 0) continue;
    ctx.save();
    ctx.translate(640 + (i - 1) * 96, 470 - (i === 1 ? 10 : 0));
    const ss = bounceOut(q) * (i === 1 ? 1.15 : 1);
    ctx.scale(ss, ss);
    ctx.rotate((1 - q) * 2);
    starPath(28);
    ctx.fillStyle = i < win.stars ? '#ffd43b' : 'rgba(255,255,255,.35)';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = i < win.stars ? '#b7791f' : 'rgba(0,0,0,.2)';
    ctx.stroke();
    ctx.restore();
  }
}
function drawWin() {
  if (!win || !win.cardOn) return;
  const k = win.cardT;
  const v = viewRect();
  const R = Math.hypot(v.x1 - v.x0, v.y1 - v.y0) * 0.62 * ease(clamp(k / 0.3, 0, 1));
  ctx.save();
  ctx.beginPath();
  ctx.arc(640, 400, Math.max(0, R), 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#2cc46e';
  ctx.fillRect(v.x0 - 30, v.y0 - 30, (v.x1 - v.x0) + 60, (v.y1 - v.y0) + 60);
  ctx.fillStyle = 'rgba(255,255,255,.09)';
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.arc(v.x0 + (i * 211) % (v.x1 - v.x0), v.y0 + (i * 271) % (v.y1 - v.y0), 26 + (i % 4) * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  const pk = k < 0.3 ? 0 : k < 0.5 ? bounceOut((k - 0.3) / 0.2) : 1;
  const sc = 0.4 + 0.6 * pk;
  ctx.translate(640, 400);
  ctx.scale(sc, sc);
  ctx.translate(-640, -400);
  roundRect(240, 150, 800, 500, 36);
  ctx.fillStyle = '#fff7d6'; ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = '#f0b429'; ctx.stroke();
  text('Rescue Party!', 640, 230, 64, '#ff7a1a', '#14324a', 8);
  drawSprite(win.friend, 'happy', 640, 360, { scale: 1.05, frame: Math.floor(T * 8) % 4 });
  drawWinStars(k);
  if (win.shell) {
    text('Shortest swim!', 600, 530, 28, '#0c6b4a', '#fff', 4);
    ctx.save();
    ctx.translate(760, 528);
    ctx.beginPath();
    ctx.arc(0, 0, 16, Math.PI, 0);
    ctx.quadraticCurveTo(4, 6, 0, 3);
    ctx.quadraticCurveTo(-4, 6, -16, 0);
    ctx.fillStyle = '#ffe9a8'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#c98a00'; ctx.stroke();
    ctx.restore();
  }
  if (k >= 0.5) {
    const nb = nextButton();
    roundRect(nb.x, nb.y, nb.w, nb.h, 28);
    ctx.fillStyle = '#3cc46b'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#146b38'; ctx.stroke();
    text('Next', nb.x + nb.w / 2, nb.y + nb.h / 2, 40, '#fff', '#146b38', 6);
  }
  ctx.restore();
}
function drawTitle() {
  text('Chomp Benji Chomp!', 640, 78, 72, '#ffe14d', '#0c3d6b', 12);
  text('Good Shark', 640, 148, 48, '#7ee8ff', '#0c3d6b', 8);
  text('Plan the arrows, then press Play.', 640, 206, 26, '#fff', '#0c3d6b', 5);
  worldButtons().forEach(b => {
    const look = WORLD_LOOK[b.i];
    drawSprite('worldBtn', look.btn, b.x + b.w / 2, b.y + b.h / 2 - 8, { scale: b.w / 260 });
    fitText(look.name, b.x + b.w / 2, b.y + b.h - 28, 26, b.w - 28, '#fff', '#14324a', 5);
    const total = LEVEL_PACK[b.i].levels.length * 3;
    const got = (stars[b.i] || []).reduce((a, n) => a + (n || 0), 0);
    text('★ ' + got + ' / ' + total, b.x + b.w / 2, b.y + b.h + 22, 20, '#fff', '#0c3d6b', 4);
  });
  drawSprite('benji', 'swim', 210, 640, { scale: 0.85, frame: Math.floor(T * 8) % 4 });
  FRIENDS.forEach((f, i) => drawSprite(f, 'idle', 520 + i * 130, 690 + Math.sin(T * 2 + i) * 6, { scale: 0.62, frame: Math.floor(T * 6 + i) % 4 }));
  ctx.globalAlpha = 0.75;
  text(BUILD, 1190, 774, 16, '#fff', '#0c3d6b', 3, 'right');
  ctx.globalAlpha = 1;
}
function drawSelect() {
  const look = WORLD_LOOK[world];
  text(look.name, 640, 78, 60, '#fff', look.ink, 10);
  const total = worldLevels().length * 3;
  const got = (stars[world] || []).reduce((a, n) => a + (n || 0), 0);
  text('Pick a swim   ★ ' + got + ' / ' + total, 640, 138, 28, '#fff', '#0c3d6b', 5);
  levelButtons().forEach(b => {
    const raw = worldLevels()[b.i];
    const level = raw.prep;
    roundRect(b.x, b.y, b.w, b.h, 18);
    ctx.fillStyle = b.locked ? '#c5ced6' : '#fff8e4'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = b.locked ? '#8ea0ae' : '#f0b429'; ctx.stroke();
    text(String(b.i + 1), b.x + 28, b.y + 28, 22, '#14324a');
    fitText(level.name, b.x + b.w / 2, b.y + 36, 20, b.w - 56, '#14324a', null, 0);
    const chip = goalLabel(level.goal);
    text(chip, b.x + b.w / 2, b.y + 68, 16, level.goal === 'fewest' ? '#8a5a00' : level.goal === 'rescue-all' ? '#a01258' : '#0c6b8a');
    drawStars(b.x + b.w / 2, b.y + 102, stars[world][b.i] || 0, 12);
    if (b.locked) text('locked', b.x + b.w / 2, b.y + b.h / 2, 22, '#fff', '#14324a', 4);
  });
}
function drawReward() {
  text('Rescue Party!', 640, 120, 64, '#ffe14d', '#0c3d6b', 10);
  drawSprite('benji', 'happy', 640, 300, { scale: 1.1, frame: Math.floor(T * 8) % 4 });
  const pool = world === 3 ? FRIENDS.filter(f => f !== 'jelly') : FRIENDS;
  pool.forEach((f, i) => {
    const x = 280 + i * (world === 3 ? 180 : 150);
    drawSprite(f, 'happy', x, 500 + Math.sin(T * 3 + i) * 8, { scale: 0.8, frame: Math.floor(T * 8) % 4 });
  });
  const nb = rewardNext();
  roundRect(nb.x, nb.y, nb.w, nb.h, 28);
  ctx.fillStyle = '#3cc46b'; ctx.fill(); ctx.strokeStyle = '#146b38'; ctx.lineWidth = 5; ctx.stroke();
  text(levelIdx + 1 < worldLevels().length ? 'Next' : 'Worlds', nb.x + nb.w / 2, nb.y + nb.h / 2, 36, '#fff', '#146b38', 5);
}
function drawPortrait() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = 'rgba(5,40,80,.94)';
  ctx.fillRect(0, 0, viewW, viewH);
  const a = Math.sin(T * 2) > 0 ? -Math.PI / 2 * Math.min(1, Math.sin(T * 2) * 2) : 0;
  ctx.save(); ctx.translate(viewW / 2, viewH * 0.4); ctx.rotate(a);
  ctx.lineWidth = 6; ctx.strokeStyle = '#fff';
  roundRect(-35, -60, 70, 120, 14); ctx.stroke();
  ctx.restore();
  text('Turn your phone sideways', viewW / 2, viewH * 0.62, Math.min(viewW * 0.07, 36), '#fff', '#0c3d6b', 6);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b5c8f';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
  if (!artReady) {
    text('Getting the reef ready…', 640, 400, 36, '#fff', '#0c3d6b', 6);
    if (portrait()) drawPortrait();
    return;
  }
  backdrop();
  if (state === 'title') drawTitle();
  else if (state === 'select') drawSelect();
  else if (state === 'reward') drawReward();
  else if (state === 'play' && L && G) {
    drawBoard();
    drawControls();
    fitText(L.name, 640, 54, 48, 860, '#fff', '#0c3d6b', 8);
    drawFailPop();
  }
  if (state !== 'title') drawIconButton(backButton(), 'back');
  drawIconButton(musicButton(), 'music');
  drawIconButton(muteButton(), 'mute');
  drawParts();
  if (win && win.cardOn) drawWin();
  if (portrait()) drawPortrait();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  try { update(dt); render(); }
  catch (e) { lastError = String(e && e.stack || e); console.error(e); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function uiSnapshot() {
  const arrows = arrowButtons().map(a => ({ id: a.id, dir: a.dir, x: a.x + a.w / 2, y: a.y + a.h / 2, w: a.w, h: a.h }));
  const play = playButton();
  const sg = L ? slotGeom(L.slots) : null;
  return {
    arrows: arrows,
    play: { x: play.x + play.w / 2, y: play.y + play.h / 2, w: play.w, h: play.h },
    slots: sg ? Array.from({ length: sg.n }, (_, i) => ({ i: i, x: sg.x(i), y: sg.y, r: sg.r })) : [],
    back: backButton(),
    next: nextButton(),
    worlds: worldButtons(),
    levels: state === 'select' ? levelButtons() : []
  };
}
function wrongPrograms(level) {
  const sol = level.solution;
  const last = sol[sol.length - 1];
  const opp = { L: 'R', R: 'L', U: 'D', D: 'U' }[last];
  const cands = [
    sol + last,
    sol.slice(0, -1),
    last.repeat(Math.min(sol.length, level.slots)),
    sol.slice(0, -1) + opp,
    opp + sol.slice(1),
    'U'.repeat(Math.min(3, level.slots)),
    'L'.repeat(Math.min(3, level.slots))
  ];
  const seen = new Set();
  const fails = [];
  cands.forEach(p => {
    if (!p || p === sol || seen.has(p)) return;
    seen.add(p);
    const r = runSim(level, p);
    if (r.result !== 'win') fails.push({ program: p, result: r.result, why: r.why, at: r.at });
  });
  return fails;
}
function ignoreSwitch(level) {
  const colors = new Set();
  level.grid.forEach(row => {
    for (const ch of row) {
      if (SW[ch]) colors.add(SW[ch]);
      if (GATE[ch]) colors.add(GATE[ch]);
    }
  });
  return Array.from(colors).map(color => ({
    color: color,
    plan: solve(level, { disable: color, maxDepth: level.slots })
  }));
}
function pipeReport(level) {
  const routes = buildTubes(level);
  const bad = [];
  routes.forEach(route => {
    route.cells.forEach((p, i) => {
      if (i === 0 || i === route.cells.length - 1) return;
      const r = p[0], c = p[1];
      if (r < 0 || c < 0 || r >= level.grid.length || c >= level.grid[0].length) return;
      if (level.grid[r][c] !== '.') bad.push({ pair: route.letter, r: r, c: c, ch: level.grid[r][c] });
    });
    if (route.missing) bad.push({ pair: route.letter, missing: true });
    if (route.overlap) bad.push({ pair: route.letter, overlap: true });
  });
  return bad;
}

window.__benji = {
  BUILD: BUILD,
  TRAY_AFTER_FALL: TRAY_AFTER_FALL,
  get ready() { return artReady; },
  get artErrors() { return artErrors.slice(); },
  get state() { return state; },
  get mode() { return mode; },
  get world() { return world; },
  get levelIdx() { return levelIdx; },
  get level() { return L; },
  get win() { return win; },
  get runs() { return runs; },
  get lastError() { return lastError; },
  get portrait() { return portrait(); },
  queue() { return queue.slice(); },
  LEVEL_PACK: LEVEL_PACK,
  bootReport: bootReport,
  solve: solve,
  runSim: runSim,
  resolve: resolve,
  applyTray: applyTray,
  resolvedTrayMode: resolvedTrayMode,
  setTrayForTest(v) { traySettingTest = v; },
  clearTrayTest() { traySettingTest = null; },
  jump(w, i) { reward = null; win = null; openSelect(w); loadLevel(i); },
  ui: uiSnapshot,
  toScreen: toScreen,
  turbo(n) { animMul = n || 1; },
  pose() {
    const pose = benjiPose();
    return {
      x: Math.round(benji.x * 10) / 10, y: Math.round(benji.y * 10) / 10,
      flip: benji.flip, moving: benji.moving, rot: Math.round(benji.rot * 1000) / 1000,
      shrink: Math.round(benji.shrink * 1000) / 1000, alpha: Math.round(benji.alpha * 1000) / 1000,
      spin: Math.round(benji.spin * 1000) / 1000, hidden: benji.hidden,
      popIn: Math.round(benji.popIn * 1000) / 1000, home: !!benji.home, mode: mode,
      state: pose.state, value: Math.round(pose.value * 1000) / 1000,
      q: Math.round(benji.q * 1000) / 1000
    };
  },
  parts() {
    return parts.map(p => ({
      kind: p.kind || '', x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0, t: p.t, life: p.life
    }));
  },
  winClock() {
    if (!win) return null;
    return {
      age: win.age, card: !!win.cardOn, cardT: win.cardT,
      pose: benji.forceState || '', q: benji.q
    };
  },
  treats() {
    const out = [];
    LEVEL_PACK.forEach(w => w.levels.forEach(raw => {
      const level = raw.prep;
      const t = pickTreat(level);
      out.push({
        id: level.id, r: t ? t.r : -1, c: t ? t.c : -1, kind: t ? t.kind : '',
        reach: !!(t && reachableCells(level).has(t.r + ',' + t.c))
      });
    }));
    return out;
  },
  wrongPrograms: wrongPrograms,
  ignoreSwitch: ignoreSwitch,
  pipeReport: pipeReport,
  stars: stars,
  prog: prog
};
