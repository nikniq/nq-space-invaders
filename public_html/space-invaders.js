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
const SPR = {
    player: renderSprite(PIX.player, '#3cff5a', SCALE),
    squid: PIX.squid.map(f => renderSprite(f, '#ffffff', SCALE)),
    crab: PIX.crab.map(f => renderSprite(f, '#5ad7ff', SCALE)),
    octopus: PIX.octopus.map(f => renderSprite(f, '#ff6ad5', SCALE)),
    ufo: renderSprite(PIX.ufo, '#ff3b3b', SCALE),
    burst: renderSprite(PIX.burst, '#ffffff', SCALE),
};

const INVADER_TYPES = {
    squid: { frames: SPR.squid, points: 30, color: '#ffffff' },
    crab: { frames: SPR.crab, points: 20, color: '#5ad7ff' },
    octopus: { frames: SPR.octopus, points: 10, color: '#ff6ad5' },
};
const ROW_TYPES = ['squid', 'crab', 'crab', 'octopus', 'octopus'];
const COLS = 11;
const COL_SPACING = 48;
const ROW_SPACING = 40;
const FLEET_STEP_X = 12;
const FLEET_STEP_Y = 20;

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
    tone(freq, dur, { type = 'square', vol = 0.08, slide = null } = {}) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
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
    stepNote(i) { this.tone([110, 98, 87, 82][i % 4], 0.09, { type: 'triangle', vol: 0.12 }); },
    ufo() { this.tone(520, 0.14, { type: 'sine', slide: 720, vol: 0.05 }); },
    ufoHit() { this.tone(800, 0.3, { slide: 1600, vol: 0.09 }); },
    wave() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, { vol: 0.08 }), i * 110)); },
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
        ctx.fillStyle = '#3cff5a';
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.cells[r * this.cols + c]) ctx.fillRect(this.x + c * CELL, this.y + r * CELL, CELL, CELL);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

const HISCORE_KEY = 'nq-space-invaders-hiscore';
function loadHiScore() {
    try { return parseInt(localStorage.getItem(HISCORE_KEY), 10) || 0; } catch (e) { return 0; }
}
function saveHiScore(v) {
    try { localStorage.setItem(HISCORE_KEY, String(v)); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const G = {
    state: 'start', // start | playing | paused | dying | wavecleared | gameover
    score: 0,
    hiScore: loadHiScore(),
    newHiScore: false,
    lives: 3,
    wave: 1,
    player: null,
    playerBullet: null,
    enemyBullets: [],
    invaders: [],
    fleetDir: 1,
    fleetTimer: 0,
    fleetFrame: 0,
    stepNote: 0,
    enemyFireTimer: 0,
    ufo: null,
    ufoTimer: 0,
    bunkers: [],
    particles: [],
    popups: [],
    stars: [],
    stateTimer: 0,
    shake: 0,
    time: 0,
};

const input = { left: false, right: false, fire: false, firePressed: false };

for (let i = 0; i < 90; i++) {
    G.stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, p: Math.random() * Math.PI * 2 });
}

function makePlayer() {
    return { x: W / 2 - SPR.player.width / 2, y: H - 70, w: SPR.player.width, h: SPR.player.height, speed: 260 };
}

function makeFleet() {
    const invaders = [];
    const fleetW = (COLS - 1) * COL_SPACING;
    const startX = (W - fleetW) / 2;
    const startY = 80 + Math.min(G.wave - 1, 4) * 12;
    ROW_TYPES.forEach((type, r) => {
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
    G.lives = 3;
    G.wave = 1;
    G.player = makePlayer();
    G.bunkers = makeBunkers();
    G.particles = [];
    G.popups = [];
    startWave();
    G.state = 'playing';
}

function startWave() {
    G.invaders = makeFleet();
    G.fleetDir = 1;
    G.fleetTimer = 0;
    G.fleetFrame = 0;
    G.playerBullet = null;
    G.enemyBullets = [];
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
        saveHiScore(G.hiScore);
    }
}

function burst(x, y, color, n = 14, speed = 160) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(speed * 0.3, speed);
        G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, color, size: rand(2, 4) });
    }
}

function popup(x, y, text, color = '#fff') {
    G.popups.push({ x, y, text, color, life: 1.0 });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function aliveInvaders() { return G.invaders.filter(i => i.alive); }

function fleetInterval(aliveCount) {
    const total = G.invaders.length;
    const base = Math.max(0.14, 0.55 - (G.wave - 1) * 0.04);
    return Math.max(0.035, base * Math.pow(aliveCount / total, 0.8) + 0.03);
}

function update(dt) {
    G.time += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);

    // Particles and popups run in every state so explosions finish.
    for (const p of G.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
        p.life -= dt;
    }
    G.particles = G.particles.filter(p => p.life > 0);
    for (const t of G.popups) { t.life -= dt; t.y -= 24 * dt; }
    G.popups = G.popups.filter(t => t.life > 0);

    if (G.state === 'dying') {
        G.stateTimer -= dt;
        if (G.stateTimer <= 0) {
            if (G.lives <= 0) {
                G.state = 'gameover';
            } else {
                G.player = makePlayer();
                G.enemyBullets = [];
                G.state = 'playing';
            }
        }
        return;
    }
    if (G.state === 'wavecleared') {
        G.stateTimer -= dt;
        if (G.stateTimer <= 0) {
            G.wave += 1;
            startWave();
            G.state = 'playing';
        }
        return;
    }
    if (G.state !== 'playing') return;

    const player = G.player;

    // Player movement
    if (input.left) player.x -= player.speed * dt;
    if (input.right) player.x += player.speed * dt;
    player.x = clamp(player.x, 8, W - player.w - 8);

    // Player fire — one bullet on screen at a time, edge-triggered.
    if (input.firePressed && !G.playerBullet) {
        G.playerBullet = { x: player.x + player.w / 2 - 2, y: player.y - 12, w: 4, h: 12, vy: -560 };
        Sound.shoot();
    }
    input.firePressed = false;

    // Player bullet
    if (G.playerBullet) {
        const b = G.playerBullet;
        b.y += b.vy * dt;
        let gone = b.y + b.h < 0;
        if (!gone) {
            for (const inv of G.invaders) {
                if (inv.alive && overlaps(b, inv)) {
                    inv.alive = false;
                    const pts = INVADER_TYPES[inv.type].points;
                    addScore(pts);
                    burst(inv.x + inv.w / 2, inv.y + inv.h / 2, INVADER_TYPES[inv.type].color);
                    popup(inv.x + inv.w / 2, inv.y, String(pts), INVADER_TYPES[inv.type].color);
                    Sound.invaderHit();
                    gone = true;
                    break;
                }
            }
        }
        if (!gone && G.ufo && overlaps(b, G.ufo)) {
            addScore(G.ufo.points);
            burst(G.ufo.x + G.ufo.w / 2, G.ufo.y + G.ufo.h / 2, '#ff3b3b', 30, 240);
            popup(G.ufo.x + G.ufo.w / 2, G.ufo.y, String(G.ufo.points), '#ff3b3b');
            Sound.ufoHit();
            G.ufo = null;
            gone = true;
        }
        if (!gone) {
            for (const bk of G.bunkers) {
                if (bk.hit(b, 2)) { gone = true; break; }
            }
        }
        if (!gone) {
            for (const eb of G.enemyBullets) {
                if (overlaps(b, eb)) {
                    eb.dead = true;
                    gone = true;
                    burst(b.x, b.y, '#ffd25a', 6, 80);
                    break;
                }
            }
        }
        if (gone) G.playerBullet = null;
    }

    // Fleet movement — stepwise like the arcade original.
    const alive = aliveInvaders();
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
    const maxEnemyBullets = Math.min(3 + Math.floor(G.wave / 2), 6);
    if (G.enemyFireTimer <= 0 && G.enemyBullets.length < maxEnemyBullets && alive.length) {
        const cols = {};
        for (const inv of alive) {
            if (!cols[inv.col] || inv.y > cols[inv.col].y) cols[inv.col] = inv;
        }
        const shooters = Object.values(cols);
        // Prefer a shooter near the player some of the time, so dodging matters.
        let shooter;
        if (Math.random() < 0.35) {
            shooter = shooters.reduce((best, s) => (
                Math.abs(s.x - player.x) < Math.abs(best.x - player.x) ? s : best
            ), shooters[0]);
        } else {
            shooter = shooters[Math.floor(Math.random() * shooters.length)];
        }
        G.enemyBullets.push({ x: shooter.x + shooter.w / 2 - 2, y: shooter.y + shooter.h, w: 4, h: 14, vy: 170 + G.wave * 15, wobble: Math.random() * 10 });
        G.enemyFireTimer = Math.max(0.35, rand(0.9, 1.5) - G.wave * 0.07);
    }

    // Enemy bullets
    for (const eb of G.enemyBullets) {
        eb.y += eb.vy * dt;
        if (eb.y > H) eb.dead = true;
        if (!eb.dead) {
            for (const bk of G.bunkers) {
                if (bk.hit(eb, 2)) { eb.dead = true; break; }
            }
        }
        if (!eb.dead && overlaps(eb, player)) {
            eb.dead = true;
            killPlayer(false);
            return;
        }
    }
    G.enemyBullets = G.enemyBullets.filter(b => !b.dead);

    // UFO
    if (G.ufo) {
        G.ufo.x += G.ufo.vx * dt;
        G.ufo.soundTimer -= dt;
        if (G.ufo.soundTimer <= 0) { Sound.ufo(); G.ufo.soundTimer = 0.18; }
        if (G.ufo.x < -G.ufo.w - 10 || G.ufo.x > W + 10) G.ufo = null;
    } else {
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
    if (alive.length === 0) {
        G.state = 'wavecleared';
        G.stateTimer = 2.0;
        G.playerBullet = null;
        G.enemyBullets = [];
        G.ufo = null;
        addScore(100 * G.wave);
        popup(W / 2, H / 2 + 40, 'WAVE BONUS ' + (100 * G.wave), '#ffd25a');
        Sound.wave();
    }
}

function killPlayer(invaded) {
    const p = G.player;
    burst(p.x + p.w / 2, p.y + p.h / 2, '#3cff5a', 40, 260);
    Sound.playerHit();
    G.shake = 8;
    G.lives -= invaded ? G.lives : 1;
    G.playerBullet = null;
    G.state = 'dying';
    G.stateTimer = 1.6;
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
    text(String(G.score).padStart(6, '0'), 24, 40, 18, '#fff', 'left');
    text('HI-SCORE', W / 2, 20, 12, '#9ad');
    text(String(G.hiScore).padStart(6, '0'), W / 2, 40, 18, G.newHiScore ? '#ffd25a' : '#fff');
    text('WAVE', W - 24, 20, 12, '#9ad', 'right');
    text(String(G.wave), W - 24, 40, 18, '#fff', 'right');

    // Lives + ground line
    ctx.fillStyle = '#3cff5a';
    ctx.fillRect(0, H - 28, W, 2);
    text(String(G.lives), 24, H - 14, 14, '#3cff5a', 'left');
    for (let i = 0; i < Math.max(0, G.lives - 1); i++) {
        ctx.drawImage(SPR.player, 48 + i * 34, H - 24, SPR.player.width * 0.6, SPR.player.height * 0.6);
    }
    if (Sound.muted) text('MUTED', W - 24, H - 14, 12, '#888', 'right');
}

function drawPlayfield() {
    for (const bk of G.bunkers) bk.draw();
    for (const inv of G.invaders) {
        if (inv.alive) ctx.drawImage(INVADER_TYPES[inv.type].frames[G.fleetFrame], Math.round(inv.x), Math.round(inv.y));
    }
    if (G.ufo) ctx.drawImage(SPR.ufo, Math.round(G.ufo.x), G.ufo.y);
    if (G.state !== 'dying') ctx.drawImage(SPR.player, Math.round(G.player.x), G.player.y);
    if (G.playerBullet) {
        ctx.fillStyle = '#e8ffe8';
        ctx.fillRect(Math.round(G.playerBullet.x), Math.round(G.playerBullet.y), G.playerBullet.w, G.playerBullet.h);
    }
    ctx.fillStyle = '#ffd25a';
    for (const eb of G.enemyBullets) {
        // Zig-zag bolt
        const zig = Math.sin(G.time * 30 + eb.wobble) > 0 ? 2 : -2;
        ctx.fillRect(Math.round(eb.x + zig), Math.round(eb.y), eb.w, eb.h / 2);
        ctx.fillRect(Math.round(eb.x - zig), Math.round(eb.y + eb.h / 2), eb.w, eb.h / 2);
    }
    for (const p of G.particles) {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const t of G.popups) {
        ctx.globalAlpha = clamp(t.life, 0, 1);
        text(t.text, t.x, t.y, 14, t.color);
    }
    ctx.globalAlpha = 1;
}

function dim(alpha = 0.7) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, W, H);
}

function drawStartScreen() {
    dim(0.55);
    text('SPACE', W / 2, 120, 56, '#3cff5a');
    text('INVADERS', W / 2, 185, 56, '#3cff5a');

    const rows = [
        [SPR.ufo, '= ? MYSTERY', '#ff3b3b'],
        [SPR.squid[0], '= 30 POINTS', '#fff'],
        [SPR.crab[0], '= 20 POINTS', '#5ad7ff'],
        [SPR.octopus[0], '= 10 POINTS', '#ff6ad5'],
    ];
    rows.forEach(([spr, label, color], i) => {
        const y = 260 + i * 40;
        ctx.drawImage(spr, W / 2 - 90 - spr.width / 2, y - spr.height / 2);
        text(label, W / 2 - 40, y, 16, color, 'left');
    });

    const blink = Math.sin(G.time * 5) > -0.2;
    if (blink) text('PRESS ENTER OR TAP TO START', W / 2, 450, 18, '#ffd25a');
    text('← → MOVE    SPACE FIRE    P PAUSE    M MUTE', W / 2, 500, 12, '#9ad');
    text('HI-SCORE ' + String(G.hiScore).padStart(6, '0'), W / 2, 540, 14, '#fff');
}

function drawOverlay() {
    if (G.state === 'paused') {
        dim(0.6);
        text('PAUSED', W / 2, H / 2 - 10, 40, '#fff');
        text('PRESS P TO RESUME', W / 2, H / 2 + 40, 14, '#9ad');
    } else if (G.state === 'wavecleared') {
        text('WAVE ' + G.wave + ' CLEARED', W / 2, H / 2 - 20, 32, '#3cff5a');
    } else if (G.state === 'gameover') {
        dim(0.7);
        text('GAME OVER', W / 2, H / 2 - 60, 48, '#ff3b3b');
        text('SCORE ' + String(G.score).padStart(6, '0'), W / 2, H / 2, 20, '#fff');
        if (G.newHiScore) text('NEW HIGH SCORE!', W / 2, H / 2 + 34, 16, '#ffd25a');
        const blink = Math.sin(G.time * 5) > -0.2;
        if (blink) text('PRESS ENTER OR TAP TO PLAY AGAIN', W / 2, H / 2 + 90, 16, '#9ad');
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
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function primaryAction() {
    Sound.init();
    if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
    if (G.state === 'start' || G.state === 'gameover') startGame();
    else if (G.state === 'paused') G.state = 'playing';
}

function togglePause() {
    if (G.state === 'playing') G.state = 'paused';
    else if (G.state === 'paused') G.state = 'playing';
}

document.addEventListener('keydown', e => {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    switch (e.code) {
        case 'ArrowLeft': case 'KeyA': input.left = true; break;
        case 'ArrowRight': case 'KeyD': input.right = true; break;
        case 'Space': case 'ArrowUp': case 'KeyW':
            Sound.init();
            if (G.state === 'playing') { input.fire = true; input.firePressed = true; }
            else primaryAction();
            break;
        case 'Enter': primaryAction(); break;
        case 'KeyP': case 'Escape': togglePause(); break;
        case 'KeyM': Sound.muted = !Sound.muted; break;
    }
});
document.addEventListener('keyup', e => {
    switch (e.code) {
        case 'ArrowLeft': case 'KeyA': input.left = false; break;
        case 'ArrowRight': case 'KeyD': input.right = false; break;
        case 'Space': case 'ArrowUp': case 'KeyW': input.fire = false; break;
    }
});
window.addEventListener('blur', () => { if (G.state === 'playing') G.state = 'paused'; });

// Tap/click on the canvas starts or resumes.
canvas.addEventListener('pointerdown', () => {
    if (G.state !== 'playing') primaryAction();
});

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
    const fire = mk('FIRE', 'tc-fire');
    const right = mk('▶', 'tc-right');
    const hold = (el, on, off) => {
        const start = e => { e.preventDefault(); Sound.init(); on(); };
        const end = e => { e.preventDefault(); off(); };
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
        el.addEventListener('pointerleave', end);
    };
    hold(left, () => { input.left = true; }, () => { input.left = false; });
    hold(right, () => { input.right = true; }, () => { input.right = false; });
    hold(fire, () => {
        if (G.state === 'playing') { input.fire = true; input.firePressed = true; } else primaryAction();
    }, () => { input.fire = false; });
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
    while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
    }
    draw();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.SpaceInvaders = { G, input, startGame, update, draw };
})();
