// Space Invaders
// Pixel-art sprites rendered to offscreen canvases, fixed 800x600 logical
// resolution scaled by CSS, time-based movement, WebAudio sound effects.
(() => {
'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
ctx.imageSmoothingEnabled = false;

// ---------------------------------------------------------------------------
// Sprites — '#' is a lit pixel. Two frames for each invader type.
// ---------------------------------------------------------------------------
const PIX = {
    player: [
        '......#......',
        '.....###.....',
        '.....###.....',
        '.###########.',
        '#############',
        '#############',
        '#############',
        '#############',
    ],
    squid: [[
        '...##...',
        '..####..',
        '.######.',
        '##.##.##',
        '########',
        '..#..#..',
        '.#.##.#.',
        '#.#..#.#',
    ], [
        '...##...',
        '..####..',
        '.######.',
        '##.##.##',
        '########',
        '.#.##.#.',
        '#......#',
        '.#....#.',
    ]],
    crab: [[
        '..#.....#..',
        '...#...#...',
        '..#######..',
        '.##.###.##.',
        '###########',
        '#.#######.#',
        '#.#.....#.#',
        '...##.##...',
    ], [
        '..#.....#..',
        '#..#...#..#',
        '#.#######.#',
        '###.###.###',
        '###########',
        '.#########.',
        '..#.....#..',
        '.#.......#.',
    ]],
    octopus: [[
        '....####....',
        '.##########.',
        '############',
        '###..##..###',
        '############',
        '...##..##...',
        '..##.##.##..',
        '##........##',
    ], [
        '....####....',
        '.##########.',
        '############',
        '###..##..###',
        '############',
        '..###..###..',
        '.##..##..##.',
        '..##....##..',
    ]],
    ufo: [
        '.....######.....',
        '...##########...',
        '..############..',
        '.##.##.##.##.##.',
        '################',
        '...###....###...',
        '....#......#....',
    ],
    boss: [
        '........########........',
        '.....##############.....',
        '...##################...',
        '..####################..',
        '.###..####....####..###.',
        '########################',
        '########################',
        '..##.####..##..####.##..',
        '....##....####....##....',
        '...#..............#.....',
    ],
    burst: [
        '#..#..#..#',
        '.#..##..#.',
        '..#....#..',
        '#........#',
        '..#....#..',
        '.#..##..#.',
        '#..#..#..#',
    ],
};

function renderSprite(rows, color, scale) {
    const c = document.createElement('canvas');
    c.width = rows[0].length * scale;
    c.height = rows.length * scale;
    const g = c.getContext('2d');
    g.fillStyle = color;
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            if (row[x] === '#') g.fillRect(x * scale, y * scale, scale, scale);
        }
    });
    return c;
}

const SCALE = 3;
const COLORS = { squid: '#ffffff', crab: '#5ad7ff', octopus: '#ff6ad5', ufo: '#ff3b3b', player: '#3cff5a', boss: '#ff8c3b' };
const SPR = {
    player: renderSprite(PIX.player, COLORS.player, SCALE),
    squid: PIX.squid.map(f => renderSprite(f, COLORS.squid, SCALE)),
    crab: PIX.crab.map(f => renderSprite(f, COLORS.crab, SCALE)),
    octopus: PIX.octopus.map(f => renderSprite(f, COLORS.octopus, SCALE)),
    ufo: renderSprite(PIX.ufo, COLORS.ufo, SCALE),
    boss: renderSprite(PIX.boss, COLORS.boss, SCALE + 1),
    bossFlash: renderSprite(PIX.boss, '#ffffff', SCALE + 1),
    burst: {},
};
for (const k of ['squid', 'crab', 'octopus', 'ufo', 'boss']) SPR.burst[k] = renderSprite(PIX.burst, COLORS[k], SCALE);

const INVADER_TYPES = {
    squid: { frames: SPR.squid, points: 30, color: COLORS.squid },
    crab: { frames: SPR.crab, points: 20, color: COLORS.crab },
    octopus: { frames: SPR.octopus, points: 10, color: COLORS.octopus },
};
const ROW_TYPES = ['squid', 'crab', 'crab', 'octopus', 'octopus'];
const COLS = 11;
const COL_SPACING = 48;
const ROW_SPACING = 40;
const FLEET_STEP_X = 12;
const FLEET_STEP_Y = 20;
const BOSS_EVERY = 5;
const MAX_LIVES = 5;
const EXTRA_LIFE_EVERY = 1500;

// Power-ups dropped by dying invaders.
const POWERUPS = {
    rapid: { letter: 'R', color: '#5ad7ff', label: 'RAPID FIRE', weight: 4, duration: 9 },
    spread: { letter: 'S', color: '#ff6ad5', label: 'SPREAD SHOT', weight: 3, duration: 9 },
    shield: { letter: 'H', color: '#3cff5a', label: 'SHIELD', weight: 3, duration: 20 },
    life: { letter: 'L', color: '#ffd25a', label: '+1 LIFE', weight: 1, duration: 0 },
};
const POWERUP_DROP_CHANCE = 0.09;

// Difficulty presets, chosen on the title screen and remembered.
const DIFFS = {
    easy:   { label: 'EASY',   lives: 4, bulletSpeed: 0.75, fireRate: 1.6, fleet: 1.3, drop: 1.6, extraBullets: -1 },
    normal: { label: 'NORMAL', lives: 3, bulletSpeed: 1,    fireRate: 1,   fleet: 1,   drop: 1,   extraBullets: 0 },
    hard:   { label: 'HARD',   lives: 3, bulletSpeed: 1.3,  fireRate: 0.7, fleet: 0.8, drop: 0.7, extraBullets: 1 },
};
const DIFF_ORDER = ['easy', 'normal', 'hard'];
function diff() { return DIFFS[G.difficulty] || DIFFS.normal; }

// ---------------------------------------------------------------------------
// Sound — tiny WebAudio synth, created on first user gesture.
// ---------------------------------------------------------------------------
const Sound = {
    ctx: null,
    muted: false,
    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { this.ctx = null; }
    },
    tone(freq, dur, { type = 'square', vol = 0.08, slide = null, delay = 0 } = {}) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    },
    shoot() { this.tone(900, 0.12, { slide: 200, vol: 0.06 }); },
    invaderHit() { this.tone(160, 0.18, { type: 'sawtooth', slide: 40, vol: 0.1 }); },
    playerHit() {
        this.tone(220, 0.6, { type: 'sawtooth', slide: 30, vol: 0.14 });
        this.tone(110, 0.8, { type: 'square', slide: 20, vol: 0.1 });
    },
    shieldHit() { this.tone(300, 0.25, { type: 'triangle', slide: 900, vol: 0.1 }); },
    stepNote(i) { this.tone([110, 98, 87, 82][i % 4], 0.09, { type: 'triangle', vol: 0.12 }); },
    ufo() { this.tone(520, 0.14, { type: 'sine', slide: 720, vol: 0.05 }); },
    ufoHit() { this.tone(800, 0.3, { slide: 1600, vol: 0.09 }); },
    bossHit() { this.tone(240, 0.08, { type: 'square', slide: 120, vol: 0.07 }); },
    bossDie() { [100, 80, 60, 40].forEach((f, i) => this.tone(f, 0.5, { type: 'sawtooth', slide: 20, vol: 0.14, delay: i * 0.12 })); },
    powerup() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.1, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); },
    extraLife() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, { vol: 0.09, delay: i * 0.1 })); },
    wave() { [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.15, { vol: 0.08, delay: i * 0.11 })); },
    blip() { this.tone(1200, 0.05, { type: 'square', vol: 0.04 }); },
};

// ---------------------------------------------------------------------------
// Bunkers — destructible grid of 4px cells.
// ---------------------------------------------------------------------------
const BUNKER_SHAPE = [
    '....##############....',
    '...################...',
    '..##################..',
    '.####################.',
    '######################',
    '######################',
    '######################',
    '######################',
    '######################',
    '######################',
    '######################',
    '######################',
    '########......########',
    '#######........#######',
    '######..........######',
    '######..........######',
];
const CELL = 4;

class Bunker {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.cols = BUNKER_SHAPE[0].length;
        this.rows = BUNKER_SHAPE.length;
        this.w = this.cols * CELL;
        this.h = this.rows * CELL;
        this.cells = new Uint8Array(this.cols * this.rows);
        BUNKER_SHAPE.forEach((row, r) => {
            for (let c = 0; c < this.cols; c++) this.cells[r * this.cols + c] = row[c] === '#' ? 1 : 0;
        });
    }
    // Returns true if the rect hit solid cells; erodes a blob around the hit.
    hit(rect, radius = 2.5) {
        if (!overlaps(rect, this)) return false;
        let hitX = -1, hitY = -1;
        const c0 = clamp(Math.floor((rect.x - this.x) / CELL), 0, this.cols - 1);
        const c1 = clamp(Math.floor((rect.x + rect.w - 1 - this.x) / CELL), 0, this.cols - 1);
        const r0 = clamp(Math.floor((rect.y - this.y) / CELL), 0, this.rows - 1);
        const r1 = clamp(Math.floor((rect.y + rect.h - 1 - this.y) / CELL), 0, this.rows - 1);
        outer:
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                if (this.cells[r * this.cols + c]) { hitX = c; hitY = r; break outer; }
            }
        }
        if (hitX < 0) return false;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const d = Math.hypot(c - hitX, r - hitY);
                if (d <= radius || (d <= radius + 1.5 && Math.random() < 0.4)) this.cells[r * this.cols + c] = 0;
            }
        }
        return true;
    }
    // Invaders simply carve away whatever they overlap.
    crush(rect) {
        if (!overlaps(rect, this)) return;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cx = this.x + c * CELL, cy = this.y + r * CELL;
                if (cx < rect.x + rect.w && cx + CELL > rect.x && cy < rect.y + rect.h && cy + CELL > rect.y) {
                    this.cells[r * this.cols + c] = 0;
                }
            }
        }
    }
    draw() {
        ctx.fillStyle = COLORS.player;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.cells[r * this.cols + c]) ctx.fillRect(this.x + c * CELL, this.y + r * CELL, CELL, CELL);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers + persistence
// ---------------------------------------------------------------------------
function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function pad(n) { return String(n).padStart(6, '0'); }

const SCORES_KEY = 'nq-space-invaders-scores';
const LEGACY_HI_KEY = 'nq-space-invaders-hiscore';
const BOARD_SIZE = 5;
function loadScores() {
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
        if (!Array.isArray(list)) list = [];
        // Carry over a high score saved by the previous version.
        const legacy = parseInt(localStorage.getItem(LEGACY_HI_KEY), 10) || 0;
        if (legacy > 0 && !list.length) list.push({ name: '---', score: legacy, wave: 0 });
    } catch (e) { list = []; }
    return list.filter(e => e && typeof e.score === 'number').sort((a, b) => b.score - a.score).slice(0, BOARD_SIZE);
}
function saveScores(list) {
    try { localStorage.setItem(SCORES_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}
function qualifies(score) {
    return score > 0 && (G.scores.length < BOARD_SIZE || score > G.scores[G.scores.length - 1].score);
}

const SETTINGS_KEY = 'nq-space-invaders-settings';
function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ difficulty: G.difficulty, muted: Sound.muted })); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const G = {
    state: 'start', // start | playing | paused | dying | wavecleared | entername | gameover
    score: 0,
    scores: loadScores(),
    hiScore: 0,
    newHiScore: false,
    lives: 3,
    nextLifeAt: EXTRA_LIFE_EVERY,
    wave: 1,
    player: null,
    playerBullets: [],
    enemyBullets: [],
    invaders: [],
    fleetDir: 1,
    fleetTimer: 0,
    fleetFrame: 0,
    stepNote: 0,
    enemyFireTimer: 0,
    ufo: null,
    ufoTimer: 0,
    boss: null,
    bunkers: [],
    powerups: [],
    power: { type: null, timer: 0 },
    shield: 0, // seconds of shield remaining
    combo: 0,
    comboBest: 0,
    corpses: [],
    particles: [],
    popups: [],
    stars: [],
    stateTimer: 0,
    shake: 0,
    flash: 0,
    time: 0,
    name: ['A', 'A', 'A'],
    nameIdx: 0,
    lastEntry: null,
    difficulty: 'normal',
    inputMode: 'keys', // keys | touch | pad — picks the wording of on-screen hints
    targetX: null,     // touch drag target for the ship
    menuIdx: 0,
    reduceMotion: false,
};
G.hiScore = G.scores.length ? G.scores[0].score : 0;
{
    const st = loadSettings();
    if (DIFFS[st.difficulty]) G.difficulty = st.difficulty;
    Sound.muted = !!st.muted;
    const mm = q => !!(window.matchMedia && window.matchMedia(q).matches);
    if (mm('(pointer: coarse)')) G.inputMode = 'touch';
    G.reduceMotion = mm('(prefers-reduced-motion: reduce)');
}

const input = { left: false, right: false, fire: false, firePressed: false };

for (let i = 0; i < 90; i++) {
    G.stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, p: Math.random() * Math.PI * 2 });
}

function multiplier() { return 1 + Math.min(3, Math.floor(G.combo / 5)); }
function isBossWave(w = G.wave) { return w % BOSS_EVERY === 0; }

function makePlayer() {
    return { x: W / 2 - SPR.player.width / 2, y: H - 70, w: SPR.player.width, h: SPR.player.height, speed: 260, invuln: 2.0 };
}

function makeFleet() {
    const invaders = [];
    const rows = isBossWave() ? ['crab', 'octopus'] : ROW_TYPES;
    const fleetW = (COLS - 1) * COL_SPACING;
    const startX = (W - fleetW) / 2;
    const startY = (isBossWave() ? 180 : 80) + Math.min(G.wave - 1, 4) * 12;
    rows.forEach((type, r) => {
        const spr = INVADER_TYPES[type].frames[0];
        for (let c = 0; c < COLS; c++) {
            invaders.push({
                type,
                col: c,
                row: r,
                x: startX + c * COL_SPACING - spr.width / 2,
                y: startY + r * ROW_SPACING,
                w: spr.width,
                h: spr.height,
                alive: true,
            });
        }
    });
    return invaders;
}

function makeBoss() {
    const hp = 12 + G.wave * 2;
    return {
        x: W / 2 - SPR.boss.width / 2, y: 70, w: SPR.boss.width, h: SPR.boss.height,
        hp, maxHp: hp, t: 0, fireTimer: 2.5, flash: 0, points: 1000 + (G.wave / BOSS_EVERY - 1) * 500,
    };
}

function makeBunkers() {
    const bunkers = [];
    const bw = BUNKER_SHAPE[0].length * CELL;
    const gap = (W - 4 * bw) / 5;
    for (let i = 0; i < 4; i++) bunkers.push(new Bunker(gap + i * (bw + gap), H - 160));
    return bunkers;
}

function startGame() {
    G.score = 0;
    G.newHiScore = false;
    G.lives = diff().lives;
    G.nextLifeAt = EXTRA_LIFE_EVERY;
    G.wave = 1;
    G.combo = 0;
    G.comboBest = 0;
    G.player = makePlayer();
    G.bunkers = makeBunkers();
    G.particles = [];
    G.popups = [];
    G.corpses = [];
    G.powerups = [];
    G.power = { type: null, timer: 0 };
    G.shield = 0;
    G.lastEntry = null;
    startWave();
    getReady(2.2);
}

function startWave() {
    G.invaders = makeFleet();
    G.boss = isBossWave() ? makeBoss() : null;
    G.fleetDir = 1;
    G.fleetTimer = 0;
    G.fleetFrame = 0;
    G.playerBullets = [];
    G.enemyBullets = [];
    G.powerups = [];
    G.enemyFireTimer = 1.5;
    G.ufo = null;
    G.ufoTimer = rand(12, 20);
    if (G.wave > 1) G.bunkers = makeBunkers();
}

function addScore(n) {
    G.score += n;
    if (G.score > G.hiScore) {
        G.hiScore = G.score;
        G.newHiScore = true;
    }
    while (G.score >= G.nextLifeAt) {
        G.nextLifeAt += EXTRA_LIFE_EVERY;
        if (G.lives < MAX_LIVES) {
            G.lives += 1;
            popup(W / 2, H - 60, 'EXTRA LIFE', POWERUPS.life.color, 1.6);
            Sound.extraLife();
        }
    }
}

function burst(x, y, color, n = 14, speed = 160) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(speed * 0.3, speed);
        G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, color, size: rand(2, 4) });
    }
}

function popup(x, y, text, color = '#fff', life = 1.0) {
    G.popups.push({ x, y, text, color, life, max: life });
}

function dropPowerup(x, y) {
    if (Math.random() > POWERUP_DROP_CHANCE * diff().drop) return;
    const total = Object.values(POWERUPS).reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    let type = 'rapid';
    for (const [k, p] of Object.entries(POWERUPS)) { r -= p.weight; if (r <= 0) { type = k; break; } }
    if (type === 'life' && G.lives >= MAX_LIVES) type = 'shield';
    G.powerups.push({ type, x: x - 11, y, w: 22, h: 22, vy: 95 });
}

function applyPowerup(type) {
    const def = POWERUPS[type];
    Sound.powerup();
    popup(G.player.x + G.player.w / 2, G.player.y - 20, def.label, def.color, 1.4);
    if (type === 'life') {
        G.lives = Math.min(MAX_LIVES, G.lives + 1);
    } else if (type === 'shield') {
        G.shield = def.duration;
    } else {
        G.power = { type, timer: def.duration };
    }
}

function fire() {
    const p = G.player;
    const maxShots = G.power.type === 'rapid' ? 3 : 1;
    if (G.playerBullets.length >= maxShots) return;
    const mk = (dx, vx) => ({ x: p.x + p.w / 2 - 2 + dx, y: p.y - 12, w: 4, h: 12, vx, vy: -560 });
    if (G.power.type === 'spread') {
        if (G.playerBullets.length) return;
        G.playerBullets.push(mk(0, 0), mk(-6, -170), mk(6, 170));
    } else {
        G.playerBullets.push(mk(0, 0));
    }
    Sound.shoot();
}

function killInvader(inv) {
    inv.alive = false;
    G.combo += 1;
    G.comboBest = Math.max(G.comboBest, G.combo);
    const pts = INVADER_TYPES[inv.type].points * multiplier();
    addScore(pts);
    const cx = inv.x + inv.w / 2, cy = inv.y + inv.h / 2;
    G.corpses.push({ x: cx - SPR.burst[inv.type].width / 2, y: cy - SPR.burst[inv.type].height / 2, spr: SPR.burst[inv.type], life: 0.22 });
    burst(cx, cy, INVADER_TYPES[inv.type].color, 10);
    popup(cx, inv.y, multiplier() > 1 ? pts + ' x' + multiplier() : String(pts), INVADER_TYPES[inv.type].color);
    dropPowerup(cx, cy);
    Sound.invaderHit();
}

function missShot() {
    if (G.combo >= 5) popup(G.player.x + G.player.w / 2, G.player.y - 30, 'COMBO LOST', '#888', 0.8);
    G.combo = 0;
}

// ---------------------------------------------------------------------------
// Flow helpers: ready countdown, movement, settings, pause menu
// ---------------------------------------------------------------------------
function getReady(secs) {
    G.state = 'ready';
    G.stateTimer = secs;
    G.targetX = null;
}

function shakeScreen(n) { if (!G.reduceMotion) G.shake = n; }

function movePlayer(dt) {
    const p = G.player;
    if (G.targetX !== null) {
        const want = clamp(G.targetX - p.w / 2, 8, W - p.w - 8);
        const d = want - p.x;
        const step = p.speed * 1.7 * dt;
        p.x += Math.abs(d) <= step ? d : Math.sign(d) * step;
    } else {
        if (input.left) p.x -= p.speed * dt;
        if (input.right) p.x += p.speed * dt;
    }
    p.x = clamp(p.x, 8, W - p.w - 8);
}

function cycleDifficulty(dir) {
    const i = DIFF_ORDER.indexOf(G.difficulty);
    G.difficulty = DIFF_ORDER[(i + dir + DIFF_ORDER.length) % DIFF_ORDER.length];
    saveSettings();
    Sound.blip();
}

function toggleMute() {
    Sound.muted = !Sound.muted;
    saveSettings();
}

const PAUSE_MENU = ['RESUME', 'RESTART', 'SOUND', 'QUIT TO TITLE'];
const MENU_Y0 = H / 2 - 20;
const MENU_DY = 34;
function menuMove(dir) {
    G.menuIdx = (G.menuIdx + dir + PAUSE_MENU.length) % PAUSE_MENU.length;
    Sound.blip();
}
function menuSelect() {
    switch (G.menuIdx) {
        case 0: G.state = 'playing'; break;
        case 1: startGame(); break;
        case 2: toggleMute(); break;
        case 3: quitToTitle(); break;
    }
}
function quitToTitle() {
    if (qualifies(G.score)) { endGame(); return; }
    G.state = 'start';
    G.invaders = []; G.boss = null; G.ufo = null;
    G.enemyBullets = []; G.playerBullets = []; G.powerups = [];
    G.particles = []; G.popups = []; G.corpses = [];
    G.shield = 0; G.power = { type: null, timer: 0 };
}

function hintText(kind) {
    const m = G.inputMode;
    switch (kind) {
        case 'start': return m === 'touch' ? 'TAP TO START' : m === 'pad' ? 'PRESS START OR A TO BEGIN' : 'PRESS ENTER OR SPACE TO START';
        case 'again': return m === 'touch' ? 'TAP TO PLAY AGAIN' : m === 'pad' ? 'PRESS START TO PLAY AGAIN' : 'PRESS ENTER TO PLAY AGAIN';
        case 'controls': return m === 'touch' ? 'DRAG TO MOVE · TAP TO FIRE' : m === 'pad' ? 'STICK OR D-PAD MOVE · A FIRE · START PAUSE' : '← → MOVE · SPACE FIRE · P PAUSE · M MUTE · F FULLSCREEN';
        case 'difficulty': return m === 'touch' ? 'USE ◀ ▶ BELOW TO CHANGE DIFFICULTY' : m === 'pad' ? 'STICK LEFT / RIGHT TO CHANGE DIFFICULTY' : '← → TO CHANGE DIFFICULTY';
        case 'menu': return m === 'touch' ? 'TAP AN OPTION' : m === 'pad' ? 'D-PAD SELECT · A CONFIRM · START RESUME' : '↑ ↓ SELECT · ENTER CONFIRM · P RESUME';
    }
    return '';
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function aliveInvaders() { return G.invaders.filter(i => i.alive); }

function fleetInterval(aliveCount) {
    const total = G.invaders.length;
    const base = Math.max(0.14, 0.55 - (G.wave - 1) * 0.04);
    return Math.max(0.035, base * Math.pow(aliveCount / total, 0.8) + 0.03) * diff().fleet;
}

function spawnEnemyBullet(x, y, vx, vy) {
    G.enemyBullets.push({ x: x - 2, y, w: 4, h: 14, vx, vy, wobble: Math.random() * 10 });
}

function update(dt) {
    G.time += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 4);

    // Cosmetics run in every state so explosions finish.
    for (const p of G.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
        p.life -= dt;
    }
    G.particles = G.particles.filter(p => p.life > 0);
    for (const t of G.popups) { t.life -= dt; t.y -= 24 * dt; }
    G.popups = G.popups.filter(t => t.life > 0);
    for (const c of G.corpses) c.life -= dt;
    G.corpses = G.corpses.filter(c => c.life > 0);

    if (G.state === 'dying') {
        G.stateTimer -= dt;
        if (G.stateTimer <= 0) {
            if (G.lives <= 0) {
                endGame();
            } else {
                G.player = makePlayer();
                G.enemyBullets = [];
                getReady(1.2);
            }
        }
        return;
    }
    if (G.state === 'wavecleared') {
        G.stateTimer -= dt;
        if (G.stateTimer <= 0) {
            G.wave += 1;
            startWave();
            getReady(1.8);
        }
        return;
    }
    if (G.state === 'ready') {
        G.stateTimer -= dt;
        movePlayer(dt);
        if (G.stateTimer <= 0) G.state = 'playing';
        return;
    }
    if (G.state === 'gameover') { G.stateTimer -= dt; return; }
    if (G.state !== 'playing') return;

    const player = G.player;
    if (player.invuln > 0) player.invuln -= dt;

    // Power-up timer
    if (G.power.type && G.power.timer > 0) {
        G.power.timer -= dt;
        if (G.power.timer <= 0) G.power = { type: null, timer: 0 };
    }
    if (G.shield > 0) G.shield = Math.max(0, G.shield - dt);

    movePlayer(dt);

    // Player fire — edge-triggered; rapid fire also autofires while held.
    if (input.firePressed || (G.power.type === 'rapid' && input.fire)) fire();
    input.firePressed = false;

    // Player bullets
    for (const b of G.playerBullets) {
        b.y += b.vy * dt;
        b.x += b.vx * dt;
        if (b.y + b.h < 0 || b.x < -10 || b.x > W + 10) { b.dead = true; missShot(); continue; }
        for (const inv of G.invaders) {
            if (inv.alive && overlaps(b, inv)) { killInvader(inv); b.dead = true; break; }
        }
        if (b.dead) continue;
        if (G.boss && overlaps(b, G.boss)) {
            b.dead = true;
            G.boss.hp -= 1;
            G.boss.flash = 0.08;
            G.combo += 1;
            burst(b.x, b.y, COLORS.boss, 5, 100);
            Sound.bossHit();
            if (G.boss.hp <= 0) killBoss();
            continue;
        }
        if (G.ufo && overlaps(b, G.ufo)) {
            const pts = G.ufo.points * multiplier();
            G.combo += 1;
            addScore(pts);
            G.corpses.push({ x: G.ufo.x + G.ufo.w / 2 - SPR.burst.ufo.width / 2, y: G.ufo.y, spr: SPR.burst.ufo, life: 0.3 });
            burst(G.ufo.x + G.ufo.w / 2, G.ufo.y + G.ufo.h / 2, COLORS.ufo, 30, 240);
            popup(G.ufo.x + G.ufo.w / 2, G.ufo.y, String(pts), COLORS.ufo, 1.4);
            Sound.ufoHit();
            G.ufo = null;
            b.dead = true;
            continue;
        }
        for (const bk of G.bunkers) {
            if (bk.hit(b, 2)) { b.dead = true; missShot(); break; }
        }
        if (b.dead) continue;
        for (const eb of G.enemyBullets) {
            if (!eb.dead && overlaps(b, eb)) {
                eb.dead = true;
                b.dead = true;
                burst(b.x, b.y, '#ffd25a', 6, 80);
                break;
            }
        }
    }
    G.playerBullets = G.playerBullets.filter(b => !b.dead);

    // Fleet movement — stepwise like the arcade original.
    const alive = aliveInvaders();
    if (alive.length) {
        G.fleetTimer += dt;
        const interval = fleetInterval(alive.length);
        if (G.fleetTimer >= interval) {
            G.fleetTimer -= interval;
            G.fleetFrame ^= 1;
            Sound.stepNote(G.stepNote++);
            let minX = Infinity, maxX = -Infinity;
            for (const inv of alive) {
                minX = Math.min(minX, inv.x);
                maxX = Math.max(maxX, inv.x + inv.w);
            }
            const nextMin = minX + G.fleetDir * FLEET_STEP_X;
            const nextMax = maxX + G.fleetDir * FLEET_STEP_X;
            if (nextMin < 10 || nextMax > W - 10) {
                G.fleetDir *= -1;
                for (const inv of G.invaders) inv.y += FLEET_STEP_Y;
            } else {
                for (const inv of G.invaders) inv.x += G.fleetDir * FLEET_STEP_X;
            }
            for (const inv of alive) {
                for (const bk of G.bunkers) bk.crush(inv);
                if (inv.y + inv.h >= player.y) { killPlayer(true); return; }
            }
        }

        // Enemy fire — bottom-most invader of a random column.
        G.enemyFireTimer -= dt;
        const maxEnemyBullets = clamp(3 + Math.floor(G.wave / 2) + diff().extraBullets, 1, 7);
        if (G.enemyFireTimer <= 0 && G.enemyBullets.length < maxEnemyBullets) {
            const cols = {};
            for (const inv of alive) {
                if (!cols[inv.col] || inv.y > cols[inv.col].y) cols[inv.col] = inv;
            }
            const shooters = Object.values(cols);
            let shooter;
            if (Math.random() < 0.35) {
                shooter = shooters.reduce((best, s) => (
                    Math.abs(s.x - player.x) < Math.abs(best.x - player.x) ? s : best
                ), shooters[0]);
            } else {
                shooter = shooters[Math.floor(Math.random() * shooters.length)];
            }
            spawnEnemyBullet(shooter.x + shooter.w / 2, shooter.y + shooter.h, 0, (170 + G.wave * 15) * diff().bulletSpeed);
            G.enemyFireTimer = Math.max(0.35, rand(0.9, 1.5) - G.wave * 0.07) * diff().fireRate;
        }
    }

    // Boss
    if (G.boss) {
        const bs = G.boss;
        bs.t += dt;
        bs.x = W / 2 - bs.w / 2 + Math.sin(bs.t * 0.9) * (W / 2 - bs.w / 2 - 30);
        bs.y = 70 + Math.sin(bs.t * 2.3) * 14;
        if (bs.flash > 0) bs.flash -= dt;
        bs.fireTimer -= dt;
        if (bs.fireTimer <= 0) {
            const cx = bs.x + bs.w / 2, cy = bs.y + bs.h;
            const toPlayer = clamp((player.x + player.w / 2 - cx) * 0.7, -220, 220);
            const sp = diff().bulletSpeed;
            spawnEnemyBullet(cx, cy, toPlayer * sp, 200 * sp);
            spawnEnemyBullet(cx - 20, cy, (toPlayer - 110) * sp, 190 * sp);
            spawnEnemyBullet(cx + 20, cy, (toPlayer + 110) * sp, 190 * sp);
            bs.fireTimer = Math.max(0.9, 2.2 - G.wave * 0.05) * (bs.hp < bs.maxHp / 3 ? 0.6 : 1);
        }
    }

    // Enemy bullets
    for (const eb of G.enemyBullets) {
        eb.y += eb.vy * dt;
        eb.x += (eb.vx || 0) * dt;
        if (eb.y > H || eb.x < -20 || eb.x > W + 20) eb.dead = true;
        if (!eb.dead) {
            for (const bk of G.bunkers) {
                if (bk.hit(eb, 2)) { eb.dead = true; break; }
            }
        }
        if (!eb.dead && overlaps(eb, player)) {
            eb.dead = true;
            if (player.invuln > 0) continue;
            if (G.shield > 0) {
                G.shield = 0;
                burst(player.x + player.w / 2, player.y, POWERUPS.shield.color, 20, 200);
                popup(player.x + player.w / 2, player.y - 20, 'SHIELD DOWN', POWERUPS.shield.color);
                Sound.shieldHit();
                player.invuln = 0.6;
                continue;
            }
            killPlayer(false);
            return;
        }
    }
    G.enemyBullets = G.enemyBullets.filter(b => !b.dead);

    // Power-up capsules
    for (const pu of G.powerups) {
        pu.y += pu.vy * dt;
        if (pu.y > H) pu.dead = true;
        else if (overlaps(pu, player)) { pu.dead = true; applyPowerup(pu.type); }
    }
    G.powerups = G.powerups.filter(p => !p.dead);

    // UFO
    if (G.ufo) {
        G.ufo.x += G.ufo.vx * dt;
        G.ufo.soundTimer -= dt;
        if (G.ufo.soundTimer <= 0) { Sound.ufo(); G.ufo.soundTimer = 0.18; }
        if (G.ufo.x < -G.ufo.w - 10 || G.ufo.x > W + 10) G.ufo = null;
    } else if (!G.boss) {
        G.ufoTimer -= dt;
        if (G.ufoTimer <= 0 && alive.length >= 8) {
            const fromLeft = Math.random() < 0.5;
            G.ufo = {
                x: fromLeft ? -SPR.ufo.width : W,
                y: 44,
                w: SPR.ufo.width,
                h: SPR.ufo.height,
                vx: (fromLeft ? 1 : -1) * 130,
                points: [50, 100, 150, 300][Math.floor(Math.random() * 4)],
                soundTimer: 0,
            };
            G.ufoTimer = rand(15, 25);
        }
    }

    // Wave cleared
    if (alive.length === 0 && !G.boss) {
        G.state = 'wavecleared';
        G.stateTimer = 2.0;
        G.playerBullets = [];
        G.enemyBullets = [];
        G.ufo = null;
        addScore(100 * G.wave);
        popup(W / 2, H / 2 + 40, 'WAVE BONUS ' + (100 * G.wave), '#ffd25a', 1.8);
        Sound.wave();
    }
}

function killBoss() {
    const bs = G.boss;
    const pts = bs.points;
    addScore(pts);
    burst(bs.x + bs.w / 2, bs.y + bs.h / 2, COLORS.boss, 80, 320);
    burst(bs.x + bs.w / 2, bs.y + bs.h / 2, '#fff', 30, 200);
    G.corpses.push({ x: bs.x + bs.w / 2 - SPR.burst.boss.width / 2, y: bs.y + bs.h / 2 - SPR.burst.boss.height / 2, spr: SPR.burst.boss, life: 0.5 });
    popup(bs.x + bs.w / 2, bs.y, String(pts), COLORS.boss, 2);
    shakeScreen(14);
    G.flash = G.reduceMotion ? 0.3 : 1;
    G.boss = null;
    Sound.bossDie();
}

function killPlayer(invaded) {
    const p = G.player;
    burst(p.x + p.w / 2, p.y + p.h / 2, COLORS.player, 40, 260);
    Sound.playerHit();
    shakeScreen(8);
    G.lives -= invaded ? G.lives : 1;
    G.playerBullets = [];
    G.combo = 0;
    G.shield = 0;
    G.power = { type: null, timer: 0 };
    G.state = 'dying';
    G.stateTimer = 1.6;
}

function endGame() {
    if (qualifies(G.score)) {
        G.name = G.lastEntry ? [...G.lastEntry] : ['A', 'A', 'A'];
        G.nameIdx = 0;
        G.state = 'entername';
    } else {
        G.state = 'gameover';
        G.stateTimer = 1.0;
    }
}

function commitName() {
    const name = G.name.join('');
    G.lastEntry = [...G.name];
    G.scores.push({ name, score: G.score, wave: G.wave });
    G.scores.sort((a, b) => b.score - a.score);
    G.scores = G.scores.slice(0, BOARD_SIZE);
    saveScores(G.scores);
    G.hiScore = G.scores[0].score;
    G.state = 'gameover';
    G.stateTimer = 0.6;
    Sound.wave();
}

// Name entry: letters type directly; left/right cycle; fire/enter advance.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
function nameCycle(dir) {
    const i = ALPHABET.indexOf(G.name[G.nameIdx]);
    G.name[G.nameIdx] = ALPHABET[(i + dir + ALPHABET.length) % ALPHABET.length];
    Sound.blip();
}
function nameAdvance() {
    Sound.blip();
    if (G.nameIdx >= 2) commitName();
    else G.nameIdx += 1;
}
function nameType(ch) {
    G.name[G.nameIdx] = ch;
    nameAdvance();
}
function nameBack() {
    if (G.nameIdx > 0) G.nameIdx -= 1;
    Sound.blip();
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------
const FONT = '"Press Start 2P", "Courier New", monospace';

function text(str, x, y, size, color = '#fff', align = 'center') {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
}

function drawStars() {
    for (const s of G.stars) {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(G.time * 1.6 + s.p));
        ctx.fillStyle = `rgba(200,220,255,${a.toFixed(2)})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
    }
}

function drawHud() {
    text('SCORE', 24, 20, 12, '#9ad', 'left');
    text(pad(G.score), 24, 40, 18, '#fff', 'left');
    text('HI-SCORE', W / 2, 20, 12, '#9ad');
    text(pad(G.hiScore), W / 2, 40, 18, G.newHiScore ? '#ffd25a' : '#fff');
    text('WAVE', W - 24, 20, 12, '#9ad', 'right');
    text(String(G.wave), W - 24, 40, 18, '#fff', 'right');

    if (multiplier() > 1) {
        text('COMBO x' + multiplier(), 24, 62, 12, '#ffd25a', 'left');
    }

    // Active power-up bars (timed weapon, then shield)
    let barY = 62;
    const bar = (def, frac) => {
        text(def.label, W - 24, barY, 10, def.color, 'right');
        ctx.fillStyle = '#222';
        ctx.fillRect(W - 24 - 120, barY + 8, 120, 5);
        ctx.fillStyle = def.color;
        ctx.fillRect(W - 24 - 120, barY + 8, 120 * clamp(frac, 0, 1), 5);
        barY += 20;
    };
    if (G.power.type && G.power.timer > 0) bar(POWERUPS[G.power.type], G.power.timer / POWERUPS[G.power.type].duration);
    if (G.shield > 0) bar(POWERUPS.shield, G.shield / POWERUPS.shield.duration);

    // Boss health
    if (G.boss) {
        const bw = 240;
        ctx.fillStyle = '#222';
        ctx.fillRect(W / 2 - bw / 2, 58, bw, 8);
        ctx.fillStyle = COLORS.boss;
        ctx.fillRect(W / 2 - bw / 2, 58, bw * clamp(G.boss.hp / G.boss.maxHp, 0, 1), 8);
    }

    // Lives + ground line
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(0, H - 28, W, 2);
    const lowLife = G.lives === 1 && (G.state === 'playing' || G.state === 'ready') && Math.sin(G.time * 6) > 0;
    text(String(G.lives), 24, H - 14, 14, lowLife ? COLORS.ufo : COLORS.player, 'left');
    if (G.lives === 1 && G.state === 'playing') text('LAST LIFE', 24 + 40, H - 14, 10, lowLife ? COLORS.ufo : '#888', 'left');
    for (let i = 0; i < Math.max(0, G.lives - 1); i++) {
        ctx.drawImage(SPR.player, 48 + i * 34, H - 24, SPR.player.width * 0.6, SPR.player.height * 0.6);
    }
    if (Sound.muted) text('MUTED', W - 24, H - 14, 12, '#888', 'right');
}

function drawPlayer() {
    const p = G.player;
    if (G.state === 'dying') return;
    if (p.invuln > 0 && Math.floor(G.time * 12) % 2 === 0) return;
    ctx.drawImage(SPR.player, Math.round(p.x), p.y);
    if (G.shield > 0) {
        ctx.strokeStyle = POWERUPS.shield.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(G.time * 8);
        ctx.beginPath();
        ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2 + 2, p.w / 2 + 10, p.h / 2 + 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

function drawPlayfield() {
    for (const bk of G.bunkers) bk.draw();
    for (const inv of G.invaders) {
        if (inv.alive) ctx.drawImage(INVADER_TYPES[inv.type].frames[G.fleetFrame], Math.round(inv.x), Math.round(inv.y));
    }
    for (const c of G.corpses) ctx.drawImage(c.spr, Math.round(c.x), Math.round(c.y));
    if (G.ufo) ctx.drawImage(SPR.ufo, Math.round(G.ufo.x), G.ufo.y);
    if (G.boss) ctx.drawImage(G.boss.flash > 0 ? SPR.bossFlash : SPR.boss, Math.round(G.boss.x), Math.round(G.boss.y));
    drawPlayer();

    ctx.fillStyle = '#e8ffe8';
    for (const b of G.playerBullets) ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);

    ctx.fillStyle = '#ffd25a';
    for (const eb of G.enemyBullets) {
        const zig = Math.sin(G.time * 30 + eb.wobble) > 0 ? 2 : -2;
        ctx.fillRect(Math.round(eb.x + zig), Math.round(eb.y), eb.w, eb.h / 2);
        ctx.fillRect(Math.round(eb.x - zig), Math.round(eb.y + eb.h / 2), eb.w, eb.h / 2);
    }

    for (const pu of G.powerups) {
        const def = POWERUPS[pu.type];
        const bob = Math.sin(G.time * 6) * 2;
        ctx.fillStyle = '#000';
        ctx.fillRect(Math.round(pu.x), Math.round(pu.y + bob), pu.w, pu.h);
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(pu.x) + 1, Math.round(pu.y + bob) + 1, pu.w - 2, pu.h - 2);
        text(def.letter, pu.x + pu.w / 2, pu.y + bob + pu.h / 2 + 1, 12, def.color);
    }

    for (const p of G.particles) {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const t of G.popups) {
        ctx.globalAlpha = clamp(t.life / Math.min(t.max, 1), 0, 1);
        text(t.text, t.x, t.y, 14, t.color);
    }
    ctx.globalAlpha = 1;
}

function dim(alpha = 0.7) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, W, H);
}

function drawScoreboard(y, highlight) {
    text('TOP SCORES', W / 2, y, 14, '#9ad');
    if (!G.scores.length) { text('NO SCORES YET', W / 2, y + 30, 12, '#666'); return; }
    G.scores.forEach((e, i) => {
        const rowY = y + 28 + i * 22;
        const hl = highlight && e === highlight;
        const color = hl ? '#ffd25a' : '#fff';
        text(String(i + 1) + '.', W / 2 - 150, rowY, 12, color, 'left');
        text(e.name, W / 2 - 110, rowY, 12, color, 'left');
        text(pad(e.score), W / 2 + 60, rowY, 12, color, 'right');
        text(e.wave ? 'W' + e.wave : '', W / 2 + 150, rowY, 12, '#9ad', 'right');
    });
}

function drawStartScreen() {
    dim(0.55);
    text('SPACE', W / 2, 90, 56, COLORS.player);
    text('INVADERS', W / 2, 155, 56, COLORS.player);

    const rows = [
        [SPR.ufo, '= ? MYSTERY', COLORS.ufo],
        [SPR.squid[0], '= 30 POINTS', COLORS.squid],
        [SPR.crab[0], '= 20 POINTS', COLORS.crab],
        [SPR.octopus[0], '= 10 POINTS', COLORS.octopus],
    ];
    rows.forEach(([spr, label, color], i) => {
        const y = 215 + i * 34;
        ctx.drawImage(spr, W / 2 - 230 - spr.width / 2, y - spr.height / 2);
        text(label, W / 2 - 190, y, 14, color, 'left');
    });
    Object.values(POWERUPS).forEach((def, i) => {
        const y = 215 + i * 34;
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 + 40, y - 10, 20, 20);
        text(def.letter, W / 2 + 50, y + 1, 11, def.color);
        text(def.label, W / 2 + 72, y, 12, def.color, 'left');
    });

    drawScoreboard(348);

    // Difficulty selector
    const dy = 506;
    text('DIFFICULTY', W / 2 - 150, dy, 12, '#9ad', 'right');
    DIFF_ORDER.forEach((k, i) => {
        const x = W / 2 - 80 + i * 110;
        const sel = k === G.difficulty;
        text(DIFFS[k].label, x, dy, 14, sel ? '#ffd25a' : '#666');
        if (sel) { ctx.fillStyle = '#ffd25a'; ctx.fillRect(x - 36, dy + 12, 72, 2); }
    });
    text(hintText('difficulty'), W / 2, 530, 9, '#567');

    const blink = Math.sin(G.time * 5) > -0.2;
    if (blink) text(hintText('start'), W / 2, 556, 16, '#ffd25a');
    text(hintText('controls'), W / 2, 580, 9, '#9ad');
}

function drawNameEntry() {
    dim(0.75);
    text('GAME OVER', W / 2, 110, 40, COLORS.ufo);
    text('SCORE ' + pad(G.score) + '   WAVE ' + G.wave, W / 2, 165, 16, '#fff');
    text(G.newHiScore ? 'NEW HIGH SCORE!' : 'YOU MADE THE TOP ' + BOARD_SIZE + '!', W / 2, 200, 16, '#ffd25a');
    text('ENTER YOUR INITIALS', W / 2, 260, 14, '#9ad');
    const blink = Math.sin(G.time * 8) > 0;
    G.name.forEach((ch, i) => {
        const x = W / 2 - 60 + i * 60;
        const active = i === G.nameIdx;
        text(ch, x, 320, 44, active ? '#ffd25a' : '#fff');
        ctx.fillStyle = active && blink ? '#ffd25a' : '#555';
        ctx.fillRect(x - 22, 350, 44, 4);
    });
    text('TYPE LETTERS, OR ← → TO CHANGE', W / 2, 410, 11, '#9ad');
    text('SPACE / ENTER TO CONFIRM   BACKSPACE TO GO BACK', W / 2, 432, 11, '#9ad');
}

function drawOverlay() {
    if (G.state === 'paused') {
        dim(0.7);
        text('PAUSED', W / 2, H / 2 - 90, 40, '#fff');
        PAUSE_MENU.forEach((item, i) => {
            const label = item === 'SOUND' ? 'SOUND: ' + (Sound.muted ? 'OFF' : 'ON') : item;
            const sel = i === G.menuIdx;
            text((sel ? '▶ ' : '') + label, W / 2, MENU_Y0 + i * MENU_DY, 16, sel ? '#ffd25a' : '#fff');
        });
        text(hintText('menu'), W / 2, H / 2 + 130, 10, '#9ad');
    } else if (G.state === 'ready') {
        const title = G.boss ? 'BOSS WAVE ' + G.wave : 'WAVE ' + G.wave;
        text(title, W / 2, H / 2 - 40, 32, G.boss ? COLORS.boss : COLORS.player);
        text('GET READY', W / 2, H / 2 + 6, 18, '#ffd25a');
        if (G.wave === 1 || G.inputMode === 'touch') text(hintText('controls'), W / 2, H / 2 + 46, 10, '#9ad');
    } else if (G.state === 'wavecleared') {
        text('WAVE ' + G.wave + ' CLEARED', W / 2, H / 2 - 20, 32, COLORS.player);
        if (isBossWave(G.wave + 1)) text('BOSS INCOMING', W / 2, H / 2 + 80, 16, COLORS.boss);
    } else if (G.state === 'entername') {
        drawNameEntry();
    } else if (G.state === 'gameover') {
        dim(0.75);
        text('GAME OVER', W / 2, 90, 44, COLORS.ufo);
        text('SCORE ' + pad(G.score) + '   WAVE ' + G.wave, W / 2, 145, 16, '#fff');
        if (G.comboBest >= 5) text('BEST COMBO ' + G.comboBest, W / 2, 172, 12, '#9ad');
        const mine = G.scores.find(e => e.score === G.score && G.lastEntry && e.name === G.lastEntry.join(''));
        drawScoreboard(230, mine);
        const blink = Math.sin(G.time * 5) > -0.2;
        if (G.stateTimer <= 0 && blink) text(hintText('again'), W / 2, 420, 16, '#9ad');
    }
}

function drawScanlines() {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    if (G.flash > 0) {
        ctx.fillStyle = `rgba(255,220,180,${(G.flash * 0.35).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
    }
}

function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);
    drawStars();
    if (G.state === 'start') {
        drawStartScreen();
    } else {
        drawPlayfield();
        drawHud();
        drawOverlay();
    }
    ctx.restore();
    drawScanlines();
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function primaryAction() {
    Sound.init();
    if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
    if (G.state === 'start') startGame();
    else if (G.state === 'gameover') { if (G.stateTimer <= 0) startGame(); }
    else if (G.state === 'paused') menuSelect();
    else if (G.state === 'entername') nameAdvance();
}

function togglePause() {
    if (G.state === 'playing' || G.state === 'ready') { G.pausedFrom = G.state; G.state = 'paused'; G.menuIdx = 0; }
    else if (G.state === 'paused') G.state = 'playing';
}

function toggleFullscreen() {
    const el = canvas.parentNode || canvas;
    if (document.fullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
    } else if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
    }
}

function pressLeft(down) {
    if (down && G.state === 'start') { cycleDifficulty(-1); return; }
    if (down && G.state === 'entername') { nameCycle(-1); return; }
    input.left = down;
}
function pressRight(down) {
    if (down && G.state === 'start') { cycleDifficulty(1); return; }
    if (down && G.state === 'entername') { nameCycle(1); return; }
    input.right = down;
}
function pressFire(down) {
    if (!down) { input.fire = false; return; }
    Sound.init();
    if (G.state === 'playing') { input.fire = true; input.firePressed = true; }
    else if (G.state === 'ready') { input.fire = true; }
    else primaryAction();
}

document.addEventListener('keydown', e => {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    G.inputMode = 'keys';
    if (G.state === 'entername') {
        if (/^Key[A-Z]$/.test(e.code)) { nameType(e.code[3]); return; }
        if (/^Digit[0-9]$/.test(e.code)) { nameType(e.code[5]); return; }
        if (e.code === 'Backspace') { nameBack(); return; }
    }
    if (G.state === 'paused') {
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': menuMove(-1); break;
            case 'ArrowDown': case 'KeyS': menuMove(1); break;
            case 'Enter': case 'Space': menuSelect(); break;
            case 'KeyP': case 'Escape': G.state = 'playing'; break;
            case 'KeyM': toggleMute(); break;
            case 'KeyF': toggleFullscreen(); break;
        }
        return;
    }
    switch (e.code) {
        case 'ArrowLeft': case 'KeyA': pressLeft(true); break;
        case 'ArrowRight': case 'KeyD': pressRight(true); break;
        case 'Space': case 'ArrowUp': case 'KeyW': pressFire(true); break;
        case 'Enter': primaryAction(); break;
        case 'KeyP': case 'Escape': togglePause(); break;
        case 'KeyM': toggleMute(); break;
        case 'KeyF': toggleFullscreen(); break;
    }
});
document.addEventListener('keyup', e => {
    switch (e.code) {
        case 'ArrowLeft': case 'KeyA': pressLeft(false); break;
        case 'ArrowRight': case 'KeyD': pressRight(false); break;
        case 'Space': case 'ArrowUp': case 'KeyW': pressFire(false); break;
    }
});
// Pause whenever the player can't see the game.
window.addEventListener('blur', () => { if (G.state === 'playing') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') togglePause(); });

// Pointer on the canvas: touch/pen drag moves the ship and taps fire; any
// pointer starts, restarts, confirms or picks a pause-menu item.
function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
let canvasPointer = null;
canvas.addEventListener('pointerdown', e => {
    const touchLike = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (touchLike) G.inputMode = 'touch';
    Sound.init();
    if (G.state === 'playing' || G.state === 'ready') {
        if (touchLike) {
            canvasPointer = e.pointerId;
            G.targetX = canvasPoint(e).x;
            if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
        }
        if (G.state === 'playing') input.firePressed = true;
    } else if (G.state === 'paused') {
        const idx = Math.round((canvasPoint(e).y - MENU_Y0) / MENU_DY);
        if (idx >= 0 && idx < PAUSE_MENU.length) { G.menuIdx = idx; menuSelect(); }
    } else {
        primaryAction();
    }
});
canvas.addEventListener('pointermove', e => {
    if (canvasPointer === e.pointerId && G.targetX !== null) G.targetX = canvasPoint(e).x;
});
const releaseCanvas = e => { if (canvasPointer === e.pointerId) { canvasPointer = null; G.targetX = null; } };
canvas.addEventListener('pointerup', releaseCanvas);
canvas.addEventListener('pointercancel', releaseCanvas);

// Gamepad: left stick / d-pad move, A fires, Start pauses or begins.
const pad_ = { left: false, right: false, fire: false, start: false, up: false, down: false };
function pollGamepad() {
    if (!navigator.getGamepads) return;
    const gp = Array.from(navigator.getGamepads()).find(g => g && g.connected);
    if (!gp) return;
    const ax = gp.axes[0] || 0;
    const left = ax < -0.4 || (gp.buttons[14] && gp.buttons[14].pressed);
    const right = ax > 0.4 || (gp.buttons[15] && gp.buttons[15].pressed);
    const fireBtn = (gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[7] && gp.buttons[7].pressed);
    const start = gp.buttons[9] && gp.buttons[9].pressed;
    const up = (gp.buttons[12] && gp.buttons[12].pressed) || (gp.axes[1] || 0) < -0.5;
    const down = (gp.buttons[13] && gp.buttons[13].pressed) || (gp.axes[1] || 0) > 0.5;
    if (left || right || fireBtn || start || up || down) G.inputMode = 'pad';
    if (G.state === 'paused') {
        if (up && !pad_.up) menuMove(-1);
        if (down && !pad_.down) menuMove(1);
    }
    pad_.up = up; pad_.down = down;
    if (left !== pad_.left) pressLeft(left);
    if (right !== pad_.right) pressRight(right);
    if (fireBtn !== pad_.fire) pressFire(fireBtn);
    if (start && !pad_.start) { if (G.state === 'playing' || G.state === 'paused') togglePause(); else primaryAction(); }
    pad_.left = left; pad_.right = right; pad_.fire = fireBtn; pad_.start = start;
}

// Touch controls (shown by CSS only on coarse pointers).
function buildTouchControls() {
    const wrap = document.createElement('div');
    wrap.id = 'touchControls';
    const mk = (label, cls) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = cls;
        b.textContent = label;
        wrap.appendChild(b);
        return b;
    };
    const left = mk('◀', 'tc-left');
    const fireB = mk('FIRE', 'tc-fire');
    const right = mk('▶', 'tc-right');
    const hold = (el, fn) => {
        const start = e => { e.preventDefault(); Sound.init(); G.inputMode = 'touch'; fn(true); };
        const end = e => { e.preventDefault(); fn(false); };
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
        el.addEventListener('pointerleave', end);
    };
    hold(left, pressLeft);
    hold(right, pressRight);
    hold(fireB, pressFire);
    canvas.parentNode.appendChild(wrap);
}
buildTouchControls();

// ---------------------------------------------------------------------------
// Main loop — fixed-step simulation, capped so a background tab can't warp.
// ---------------------------------------------------------------------------
let last = performance.now();
let acc = 0;
const STEP = 1 / 120;
function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    pollGamepad();
    while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
    }
    draw();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.SpaceInvaders = { G, input, startGame, update, draw, applyPowerup, killBoss, menuSelect, menuMove, DIFFS };
})();
