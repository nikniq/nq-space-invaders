// Space Invaders
// Pixel-art sprites rendered to offscreen canvases, fixed 800x600 logical
// resolution scaled by CSS, time-based movement, WebAudio sound effects.
(() => {
'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
// Draw in 800x600 logical units but back the canvas with device pixels so
// text, glows and pixel edges stay sharp on high-DPI screens.
const DPR = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
canvas.width = W * DPR;
canvas.height = H * DPR;
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
ctx.imageSmoothingEnabled = false;

// ---------------------------------------------------------------------------
// Sprites — '#' is a lit pixel. Two frames for each invader type.
// ---------------------------------------------------------------------------
const PIX = {
    player: [
        '.......#.......',
        '......###......',
        '......#o#......',
        '.....##o##.....',
        '..#..#####..#..',
        '..#.#######.#..',
        '.#############.',
        '###-#######-###',
        '###--#####--###',
        '##....###....##',
    ],
    squid: [[
        '...##...',
        '..####..',
        '.######.',
        '##o##o##',
        '########',
        '..#..#..',
        '.#.##.#.',
        '#.#..#.#',
    ], [
        '...##...',
        '..####..',
        '.######.',
        '##o##o##',
        '########',
        '.#.##.#.',
        '#......#',
        '.#....#.',
    ]],
    crab: [[
        '..#.....#..',
        '...#...#...',
        '..#######..',
        '.##o###o##.',
        '###########',
        '#.#######.#',
        '#.#.....#.#',
        '...##.##...',
    ], [
        '..#.....#..',
        '#..#...#..#',
        '#.#######.#',
        '###o###o###',
        '###########',
        '.#########.',
        '..#.....#..',
        '.#.......#.',
    ]],
    octopus: [[
        '....####....',
        '.##########.',
        '############',
        '###oo##oo###',
        '############',
        '...##..##...',
        '..##.##.##..',
        '##........##',
    ], [
        '....####....',
        '.##########.',
        '############',
        '###oo##oo###',
        '############',
        '..###..###..',
        '.##..##..##.',
        '..##....##..',
    ]],
    tank: [[
        '...#####...',
        '.#########.',
        '##o#####o##',
        '###########',
        '#.#######.#',
        '#.#.....#.#',
        '..##...##..',
        '.##.....##.',
    ], [
        '...#####...',
        '.#########.',
        '##o#####o##',
        '###########',
        '.#########.',
        '..#.....#..',
        '.#.#...#.#.',
        '#.........#',
    ]],
    sniper: [[
        '....#....',
        '...###...',
        '..#####..',
        '.##ooo##.',
        '#########',
        '..#.#.#..',
        '.#.....#.',
        '#.......#',
    ], [
        '....#....',
        '...###...',
        '..#####..',
        '.##ooo##.',
        '#########',
        '.#..#..#.',
        '#.......#',
        '.#.....#.',
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
        '.###oo####oooo####oo###.',
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

function hexRgb(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n)) return [255, 255, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex, amt) {
    const [r, g, b] = hexRgb(hex);
    const t = amt < 0 ? 0 : 255, a = Math.abs(amt);
    const m = v => Math.round(v + (t - v) * a);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function rgba(hex, a) {
    const [r, g, b] = hexRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}
function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
}

// Pixel sprite with a bevel (lit top edges, shadowed bottom edges), a soft
// vertical sheen, and a pre-blurred glow copy so the frame loop never pays
// for shadowBlur.
const GLOW_PAD = 12;
// `pal` is a colour string or a map from pixel character to colour, e.g.
// { '#': body, 'o': eyes, '-': panel }. '#' is the main colour and the glow.
function renderSprite(rows, pal, scale, glow = true) {
    if (typeof pal === 'string') pal = { '#': pal };
    const color = pal['#'];
    const c = makeCanvas(rows[0].length * scale, rows.length * scale);
    const g = c.getContext('2d');
    const on = (x, y) => y >= 0 && y < rows.length && !!pal[rows[y][x]];
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const col = pal[row[x]];
            if (!col) continue;
            g.fillStyle = col;
            g.fillRect(x * scale, y * scale, scale, scale);
            if (!on(x, y - 1)) { g.fillStyle = shade(col, 0.6); g.fillRect(x * scale, y * scale, scale, 1); }
            if (!on(x, y + 1)) { g.fillStyle = shade(col, -0.4); g.fillRect(x * scale, y * scale + scale - 1, scale, 1); }
        }
    });
    g.globalCompositeOperation = 'source-atop';
    const sheen = g.createLinearGradient(0, 0, 0, c.height);
    sheen.addColorStop(0, 'rgba(255,255,255,0.25)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    if (glow) c.glow = makeGlow(c, color);
    return c;
}
function makeGlow(src, color, blur = 10) {
    const c = makeCanvas(src.width + GLOW_PAD * 2, src.height + GLOW_PAD * 2);
    const g = c.getContext('2d');
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.drawImage(src, GLOW_PAD, GLOW_PAD);
    g.drawImage(src, GLOW_PAD, GLOW_PAD);
    return c;
}
function drawSprite(spr, x, y, glowAlpha = 0.55) {
    x = Math.round(x); y = Math.round(y);
    if (spr.glow && glowAlpha > 0 && G.fx !== 'low') {
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * glowAlpha;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(spr.glow, x - GLOW_PAD, y - GLOW_PAD);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = a0;
    }
    ctx.drawImage(spr, x, y);
}

// Soft radial light, one cached texture per colour. Drawn with 'lighter'.
const LIGHTS = {};
function lightSprite(color) {
    if (LIGHTS[color]) return LIGHTS[color];
    const c = makeCanvas(64, 64);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.3, rgba(color, 0.4));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return (LIGHTS[color] = c);
}
function drawLight(x, y, size, color, alpha = 1) {
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lightSprite(color), x - size / 2, y - size / 2, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = a0;
}

const SCALE = 3;
const COLORS = { squid: '#ffffff', crab: '#5ad7ff', octopus: '#ff6ad5', ufo: '#ff3b3b', player: '#3cff5a', boss: '#ff8c3b' };
const PAL = {
    player: { '#': COLORS.player, 'o': '#7affff', '-': '#1c8a33' },
    squid: { '#': COLORS.squid, 'o': '#ff4060' },
    crab: { '#': COLORS.crab, 'o': '#ffe04a' },
    octopus: { '#': COLORS.octopus, 'o': '#7affff' },
    tank: { '#': '#7f9cc4', 'o': '#ff4060' },
    tankHurt: { '#': '#56677e', 'o': '#ff8c3b' },
    sniper: { '#': '#ff3b6b', 'o': '#ffe04a' },
    boss: { '#': COLORS.boss, 'o': '#ffe08a' },
};
const SPR = {
    player: renderSprite(PIX.player, PAL.player, SCALE),
    squid: PIX.squid.map(f => renderSprite(f, PAL.squid, SCALE)),
    crab: PIX.crab.map(f => renderSprite(f, PAL.crab, SCALE)),
    octopus: PIX.octopus.map(f => renderSprite(f, PAL.octopus, SCALE)),
    tank: PIX.tank.map(f => renderSprite(f, PAL.tank, SCALE)),
    tankHurt: PIX.tank.map(f => renderSprite(f, PAL.tankHurt, SCALE)),
    sniper: PIX.sniper.map(f => renderSprite(f, PAL.sniper, SCALE)),
    ufo: renderSprite(PIX.ufo, COLORS.ufo, SCALE),
    boss: renderSprite(PIX.boss, PAL.boss, SCALE + 1),
    bossFlash: renderSprite(PIX.boss, { '#': '#ffffff', 'o': '#ffffff' }, SCALE + 1),
    burst: {},
};
for (const k of ['squid', 'crab', 'octopus', 'ufo', 'boss']) SPR.burst[k] = renderSprite(PIX.burst, COLORS[k], SCALE);

// Deep-space gradient with nebula clouds. Tiles vertically so it can scroll.
const BG = (() => {
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#07071a');
    base.addColorStop(0.6, '#0b0820');
    base.addColorStop(1, '#050510');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    const blobs = [
        [0.2, 0.25, 260, '#3a1f6e', 0.35], [0.75, 0.15, 220, '#123a6e', 0.3],
        [0.6, 0.6, 300, '#4a1450', 0.22], [0.1, 0.8, 200, '#0f4a5a', 0.22],
        [0.9, 0.85, 240, '#2a1a5e', 0.25],
    ];
    for (const [bx, by, r, col, a] of blobs) {
        for (const dy of [-H, 0, H]) {
            const cx = bx * W, cy = by * H + dy;
            const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
            grad.addColorStop(0, rgba(col, a));
            grad.addColorStop(1, rgba(col, 0));
            g.fillStyle = grad;
            g.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
    }
    return c;
})();

// A planet's limb along the bottom of the screen, behind the battlefield.
const PLANET = (() => {
    const c = makeCanvas(W, 160);
    const g = c.getContext('2d');
    const cx = W * 0.35, cy = 160 + 520, r = 600;
    const atmo = g.createRadialGradient(cx, cy, r - 10, cx, cy, r + 40);
    atmo.addColorStop(0, 'rgba(90,215,255,0.35)');
    atmo.addColorStop(1, 'rgba(90,215,255,0)');
    g.fillStyle = atmo;
    g.fillRect(0, 0, W, 160);
    const body = g.createRadialGradient(cx - 120, cy - r + 40, 20, cx, cy, r);
    body.addColorStop(0, '#24306a');
    body.addColorStop(0.5, '#141a40');
    body.addColorStop(1, '#0a0c22');
    g.fillStyle = body;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    return c;
})();

const GROUND = (() => {
    const c = makeCanvas(W, 28);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 28);
    grad.addColorStop(0, 'rgba(60,255,90,0.22)');
    grad.addColorStop(1, 'rgba(60,255,90,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, 28);
    return c;
})();

// Scanlines + vignette at device resolution, so lines stay one pixel sharp.
const CRT = (() => {
    const c = makeCanvas(W * DPR, H * DPR);
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.13)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y * DPR, W * DPR, DPR);
    const v = g.createRadialGradient(W * DPR / 2, H * DPR / 2, H * DPR * 0.35, W * DPR / 2, H * DPR / 2, H * DPR * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = v;
    g.fillRect(0, 0, W * DPR, H * DPR);
    return c;
})();

// Bloom: the frame is shrunk twice, squared (multiply with itself) so only
// bright pixels survive, then added back blurred by bilinear upscaling.
const BLOOM_A = makeCanvas(W / 2, H / 2);
const BLOOM_B = makeCanvas(W / 4, H / 4);
const BLOOM_C = makeCanvas(W / 8, H / 8);
const bloomA = BLOOM_A.getContext('2d');
const bloomB = BLOOM_B.getContext('2d');
const bloomC = BLOOM_C.getContext('2d');

function vignette(color) {
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    v.addColorStop(0, rgba(color, 0));
    v.addColorStop(1, rgba(color, 0.65));
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    return c;
}
const HURT = { red: vignette('#ff2030'), green: vignette('#3cff9a') };

const TITLE = makeCanvas(W * DPR, 160 * DPR);
const titleCtx = TITLE.getContext('2d');

// Bolt trails, pre-rendered as vertical fades.
function trailSprite(color, len) {
    const c = makeCanvas(4, len);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, len);
    grad.addColorStop(0, rgba(color, 0.7));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, len);
    return c;
}
const TRAIL = { player: trailSprite('#8dffa0', 30), enemy: trailSprite('#ffd25a', 18) };

const INVADER_TYPES = {
    squid: { frames: SPR.squid, points: 30, color: COLORS.squid },
    crab: { frames: SPR.crab, points: 20, color: COLORS.crab },
    octopus: { frames: SPR.octopus, points: 10, color: COLORS.octopus },
    tank: { frames: SPR.tank, points: 40, color: '#7f9cc4', hp: 2 },
    sniper: { frames: SPR.sniper, points: 50, color: '#ff3b6b' },
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
    pierce: { letter: 'P', color: '#ffb05a', label: 'PIERCING', weight: 3, duration: 9 },
    bomb: { letter: 'B', color: '#ff5a5a', label: 'BOMB', weight: 2, duration: 0 },
    life: { letter: 'L', color: '#ffd25a', label: '+1 LIFE', weight: 1, duration: 0 },
};
const POWERUP_DROP_CHANCE = 0.11;
const POWERUP_PITY = 14; // a drop is guaranteed after this many kills without one
const CHAIN_WINDOW = 1.8; // seconds between kills to keep a chain alive
const DIVE_WINDUP = 0.55;  // seconds a diver shakes before leaving the fleet
const DIVE_SPEED_MAX = 250; // px/s, before difficulty scaling

// Upgrades offered after every second wave and every boss. They stack for
// the rest of the run.
const PERKS = [
    { id: 'twin', code: 'TW', name: 'TWIN CANNON', desc: 'ONE MORE BOLT IN FLIGHT', color: '#8dffa0', max: 2 },
    { id: 'trigger', code: 'HT', name: 'HAIR TRIGGER', desc: 'FIRE 20% FASTER, BOLTS 15% FASTER', color: '#5ad7ff', max: 3 },
    { id: 'chain', code: 'CL', name: 'CHAIN LINK', desc: 'CHAINS LAST HALF A SECOND LONGER', color: '#ffd25a', max: 3 },
    { id: 'overcharge', code: 'OC', name: 'OVERCHARGE', desc: 'POWER-UPS LAST 40% LONGER', color: '#ff6ad5', max: 2 },
    { id: 'magnet', code: 'TB', name: 'TRACTOR BEAM', desc: 'POWER-UPS DRIFT TOWARD YOU', color: '#7affff', max: 1 },
    { id: 'deflector', code: 'DF', name: 'DEFLECTOR', desc: 'START EVERY WAVE SHIELDED', color: '#3cff5a', max: 1 },
    { id: 'thrusters', code: 'TH', name: 'THRUSTERS', desc: 'MOVE 15% FASTER', color: '#ff8c3b', max: 2 },
    { id: 'lucky', code: 'LS', name: 'LUCKY STAR', desc: 'MORE POWER-UP DROPS', color: '#ffe04a', max: 2 },
    { id: 'bounty', code: 'BH', name: 'BOUNTY HUNTER', desc: 'MORE UFOS, WORTH DOUBLE', color: '#ff3b3b', max: 1 },
    { id: 'life', code: '+1', name: 'SPARE SHIP', desc: 'ONE EXTRA LIFE', color: '#ffd25a', max: 99 },
];
function perk(id) { return (G.perks && G.perks[id]) || 0; }
function chainWindow() { return CHAIN_WINDOW + 0.5 * perk('chain'); }
function powerupScale() { return 1 + 0.4 * perk('overcharge'); }
const CHAIN_NAMES = ['', '', '', 'NICE!', 'GREAT!', 'EXCELLENT!', 'AWESOME!', 'INCREDIBLE!', 'UNSTOPPABLE!'];

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
    invaderHit(chain = 0) {
        const c = Math.min(chain, 24);
        this.tone(160 + c * 6, 0.18, { type: 'sawtooth', slide: 40, vol: 0.1 });
        if (c >= 2) this.tone(520 * Math.pow(2, Math.min(c, 16) / 12), 0.07, { type: 'square', vol: 0.03 });
    },
    chain(m) { [0, 4, 7, 12].forEach((st, i) => this.tone(440 * Math.pow(2, (st + m * 2) / 12), 0.12, { type: 'square', vol: 0.06, delay: i * 0.05 })); },
    tally(i) { this.tone(660 + i * 110, 0.09, { type: 'square', vol: 0.06 }); this.tone(1320 + i * 220, 0.05, { type: 'triangle', vol: 0.04, delay: 0.04 }); },
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
    clank() { this.tone(1800, 0.06, { type: 'square', vol: 0.05 }); this.tone(900, 0.1, { type: 'triangle', vol: 0.06 }); },
    snipe() { this.tone(1600, 0.18, { type: 'sawtooth', slide: 400, vol: 0.05 }); },
    dive() { this.tone(1000, 0.5, { type: 'sawtooth', slide: 180, vol: 0.05 }); },
    windup() { this.tone(300, 0.45, { type: 'square', slide: 900, vol: 0.035 }); },
    noise(dur, vol, delay = 0) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime + delay;
        if (!this._noise) {
            const len = Math.ceil(this.ctx.sampleRate * 0.1);
            this._noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const d = this._noise.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = this._noise;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(hp).connect(gain).connect(this.ctx.destination);
        src.start(t);
        src.stop(t + dur + 0.02);
    },
};

// Procedural chiptune: a two-bar bass line with kick, hat and a quiet
// arpeggio. The tempo tracks how few invaders remain, like the original's
// quickening march. Scheduled a little ahead of the audio clock each frame.
const Music = {
    enabled: true,
    next: 0,
    step: 0,
    bass: [110, 110, 130.81, 110, 146.83, 110, 130.81, 123.47, 110, 110, 130.81, 110, 164.81, 146.83, 130.81, 123.47],
    arp: [220, 261.63, 329.63, 261.63, 220, 261.63, 329.63, 440],
    tempo() {
        if (G.state === 'start' || G.state === 'gameover' || G.state === 'entername') return 96;
        const total = G.invaders.length || 1;
        const ratio = aliveInvaders().length / total;
        return clamp(112 + (1 - ratio) * 70 + G.wave * 3 + (G.boss ? 20 : 0), 100, 220);
    },
    tick() {
        if (!Sound.ctx || Sound.muted || !this.enabled || G.state === 'paused') { this.next = 0; return; }
        const now = Sound.ctx.currentTime;
        if (this.next < now - 0.5) this.next = now + 0.05;
        const spb = 30 / this.tempo(); // seconds per eighth note
        while (this.next < now + 0.12) {
            const i = this.step % 16;
            const t = Math.max(0, this.next - now);
            Sound.tone(this.bass[i], spb * 0.9, { type: 'triangle', vol: 0.07, delay: t });
            if (i % 2 === 0) Sound.tone(this.arp[(this.step >> 1) % 8], spb * 0.5, { type: 'square', vol: 0.016, delay: t });
            if (i % 4 === 0) Sound.tone(70, 0.09, { type: 'sine', slide: 30, vol: 0.14, delay: t });
            if (i % 4 === 2) Sound.noise(0.04, 0.03, t);
            this.next += spb;
            this.step++;
        }
    },
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
        // Rendered to its own canvas and redrawn only after damage.
        this.cache = makeCanvas(this.w, this.h);
        this.dirty = true;
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
        this.dirty = true;
        burst(this.x + hitX * CELL + CELL / 2, this.y + hitY * CELL + CELL / 2, '#2fd94e', 5, 90);
        return true;
    }
    // Invaders simply carve away whatever they overlap.
    crush(rect) {
        if (!overlaps(rect, this)) return;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cx = this.x + c * CELL, cy = this.y + r * CELL;
                if (cx < rect.x + rect.w && cx + CELL > rect.x && cy < rect.y + rect.h && cy + CELL > rect.y) {
                    if (this.cells[r * this.cols + c]) this.dirty = true;
                    this.cells[r * this.cols + c] = 0;
                }
            }
        }
    }
    render() {
        const g = this.cache.getContext('2d');
        g.clearRect(0, 0, this.w, this.h);
        const on = (r, c) => r >= 0 && c >= 0 && r < this.rows && c < this.cols && this.cells[r * this.cols + c];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!this.cells[r * this.cols + c]) continue;
                const x = c * CELL, y = r * CELL;
                g.fillStyle = r < 4 ? '#2fd94e' : r < 10 ? '#22b33c' : '#198a2e';
                g.fillRect(x, y, CELL, CELL);
                if (!on(r - 1, c)) { g.fillStyle = '#b4ffc0'; g.fillRect(x, y, CELL, 1); }
                if (!on(r, c - 1) || !on(r, c + 1)) { g.fillStyle = 'rgba(180,255,192,0.35)'; g.fillRect(!on(r, c - 1) ? x : x + CELL - 1, y, 1, CELL); }
            }
        }
        this.dirty = false;
    }
    draw() {
        if (this.dirty) this.render();
        ctx.drawImage(this.cache, this.x, this.y);
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
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ difficulty: G.difficulty, muted: Sound.muted, music: Music.enabled, fx: G.fxLocked ? G.fx : undefined })); } catch (e) { /* ignore */ }
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
    stats: { shots: 0, hits: 0 },
    waveLostLife: false,
    diveTimer: 0,
    fireworkTimer: 0,
    toast: null,
    rings: [],
    lights: [],
    warp: 1,
    bgScroll: 0,
    readyTotal: 1,
    waveIntro: false,
    hurt: 0,
    hurtTex: null,
    meteors: [],
    meteorTimer: 5,
    fx: 'high',      // high | low; low drops bloom and sprite glow
    fxLocked: false, // true once the player picks a level by hand
    comboTimer: 0,
    fireCooldown: 0,
    hitstop: 0,
    banner: null,
    displayScore: 0,
    scorePulse: 0,
    prevBest: 0,
    killsSinceDrop: 0,
    waveStats: { shots: 0, hits: 0, bestChain: 0 },
    tally: null,
    tallyShown: 0,
    tallyTotal: 3.4,
    perks: {},
    perkChoices: [],
    perkIdx: 1,
    perkLock: 0,
    shieldMax: 0,
};
G.hiScore = G.scores.length ? G.scores[0].score : 0;
{
    const st = loadSettings();
    if (DIFFS[st.difficulty]) G.difficulty = st.difficulty;
    Sound.muted = !!st.muted;
    if (st.music === false) Music.enabled = false;
    if (st.fx === 'high' || st.fx === 'low') { G.fx = st.fx; G.fxLocked = true; }
    const mm = q => !!(window.matchMedia && window.matchMedia(q).matches);
    if (mm('(pointer: coarse)')) G.inputMode = 'touch';
    G.reduceMotion = mm('(prefers-reduced-motion: reduce)');
}

const input = { left: false, right: false, fire: false, firePressed: false, fireBuffer: 0, lastDir: 0 };

for (let i = 0; i < 100; i++) {
    G.stars.push({ x: Math.random() * W, y: Math.random() * H, z: i < 60 ? 0 : i < 80 ? 1 : 2, p: Math.random() * Math.PI * 2 });
}

function multiplier() { return Math.min(8, 1 + Math.floor(G.combo / 4)); }

// Every hit extends the chain. Reaching a new multiplier from x3 up
// announces itself with a banner and a rising chime.
function chainUp() {
    const before = multiplier();
    G.combo += 1;
    G.comboTimer = chainWindow();
    G.comboBest = Math.max(G.comboBest, G.combo);
    G.waveStats.bestChain = Math.max(G.waveStats.bestChain, G.combo);
    G.stats.hits += 1;
    G.waveStats.hits += 1;
    const m = multiplier();
    if (m > before && m >= 3) {
        const colors = ['', '', '', '#5ad7ff', COLORS.player, '#ffd25a', '#ff8c3b', '#ff6ad5', '#ff3b3b'];
        banner(CHAIN_NAMES[m] + '  x' + m, colors[m], 26 + m * 2);
        Sound.chain(m);
        if (m === 8) award('chain8');
    }
}

function banner(text, color, size = 28) {
    G.banner = { text, color, size, life: 1.2, total: 1.2 };
}
function isBossWave(w = G.wave) { return w % BOSS_EVERY === 0; }

function makePlayer() {
    return { x: W / 2 - SPR.player.width / 2, y: H - 70, w: SPR.player.width, h: SPR.player.height, speed: 340, invuln: 2.0 };
}

// Fleet layouts, rotated through on regular waves. Boss escorts are blocks.
const FORMATIONS = {
    block: () => true,
    gaps: (r, c) => c !== 3 && c !== 7,
    wedge: (r, c) => Math.abs(c - 5) <= r + 1,
    checker: (r, c) => (r + c) % 2 === 0 || r === 4,
};
const FORMATION_ORDER = ['block', 'gaps', 'wedge', 'checker'];
function formationFor(wave) {
    if (isBossWave(wave)) return 'block';
    const regular = wave - Math.floor(wave / BOSS_EVERY); // skip boss waves in the rotation
    return FORMATION_ORDER[(regular - 1) % FORMATION_ORDER.length];
}

function makeFleet() {
    const invaders = [];
    const rows = isBossWave() ? ['crab', 'octopus'] : ROW_TYPES;
    const shape = FORMATIONS[formationFor(G.wave)];
    const fleetW = (COLS - 1) * COL_SPACING;
    const startX = (W - fleetW) / 2;
    const startY = (isBossWave() ? 180 : 80) + Math.min(G.wave - 1, 4) * 12;
    const slots = [];
    rows.forEach((type, r) => {
        for (let c = 0; c < COLS; c++) if (shape(r, c)) slots.push({ type, r, c });
    });
    // Armoured invaders from wave 3, snipers from wave 4, in the upper rows.
    if (!isBossWave()) {
        const upper = slots.filter(sl => sl.r <= 2);
        const take = (n, type) => {
            for (let i = 0; i < n && upper.length; i++) {
                const k = Math.floor(Math.random() * upper.length);
                upper.splice(k, 1)[0].type = type;
            }
        };
        if (G.wave >= 4) take(Math.min(4, Math.floor((G.wave - 2) / 2)), 'sniper');
        if (G.wave >= 3) take(Math.min(8, G.wave - 1), 'tank');
    }
    for (const sl of slots) {
        const def = INVADER_TYPES[sl.type];
        const spr = def.frames[0];
        invaders.push({
            type: sl.type,
            col: sl.c,
            row: sl.r,
            x: startX + sl.c * COL_SPACING - spr.width / 2,
            y: startY + sl.r * ROW_SPACING,
            w: spr.width,
            h: spr.height,
            alive: true,
            dive: null,
            hp: def.hp || 1,
            sniperTimer: sl.type === 'sniper' ? rand(2, 4) : 0,
        });
    }
    invaders.forEach(i => { i.hx = i.x; i.hy = i.y; });
    return invaders;
}

function makeBoss() {
    const hp = 12 + G.wave * 2;
    return {
        x: W / 2 - SPR.boss.width / 2, y: 100, w: SPR.boss.width, h: SPR.boss.height,
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
    G.rings = [];
    G.lights = [];
    G.powerups = [];
    G.power = { type: null, timer: 0 };
    G.shield = 0;
    G.perks = {};
    G.lastEntry = null;
    G.stats = { shots: 0, hits: 0 };
    G.medalsThisGame = [];
    G.displayScore = 0;
    G.prevBest = G.hiScore;
    G.killsSinceDrop = 0;
    G.banner = null;
    G.comboTimer = 0;
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
    G.waveLostLife = false;
    G.waveStats = { shots: 0, hits: 0, bestChain: 0 };
    G.fireCooldown = 0;
    G.waveIntro = true;
    G.diveTimer = rand(4, 7);
    G.ufo = null;
    G.ufoTimer = rand(12, 20) * (perk('bounty') ? 0.55 : 1);
    if (G.wave >= 10) award('wave10');
    if (G.wave >= 5 && G.difficulty === 'hard') award('hard5');
    if (perk('deflector')) G.shield = G.shieldMax = 8;
    if (G.wave > 1) G.bunkers = makeBunkers();
}

function addScore(n) {
    G.score += n;
    G.scorePulse = 1;
    if (G.score >= 10000) award('score10k');
    if (G.score > G.hiScore) {
        G.hiScore = G.score;
        if (!G.newHiScore && G.prevBest > 0) {
            banner('NEW HIGH SCORE!', '#ffd25a', 30);
            Sound.extraLife();
        }
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
    if (G.particles.length > 900) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(speed * 0.3, speed);
        G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, color, size: rand(2, 4), spark: Math.random() < 0.5 });
    }
    if (n >= 10) {
        G.rings.push({ x, y, r: 4, max: speed * 0.35, life: 0.35, total: 0.35, color });
        G.lights.push({ x, y, size: speed * 0.9, color, life: 0.25, total: 0.25 });
    }
}

// Break a sprite into its own pixels, flung outward from its centre.
function shatter(rows, x, y, scale, pal, force = 1) {
    if (G.particles.length > 900) return;
    const cw = rows[0].length, ch = rows.length;
    for (let r = 0; r < ch; r++) {
        for (let c = 0; c < cw; c++) {
            const col = pal[rows[r][c]];
            if (!col) continue;
            if (G.fx === 'low' && (r + c) % 2) continue;
            const dx = c - cw / 2 + 0.5, dy = r - ch / 2 + 0.5;
            G.particles.push({
                x: x + c * scale, y: y + r * scale,
                vx: dx * 28 * force + rand(-30, 30), vy: dy * 28 * force - rand(30, 90) * force,
                life: rand(0.45, 0.85), max: 0.85, color: col, size: scale, spark: false,
            });
        }
    }
}

function popup(x, y, text, color = '#fff', life = 1.0, size = 14) {
    G.popups.push({ x, y, text, color, life, max: life, size });
}

function dropPowerup(x, y) {
    G.killsSinceDrop += 1;
    if (Math.random() > POWERUP_DROP_CHANCE * diff().drop * (1 + 0.35 * perk('lucky')) && G.killsSinceDrop < POWERUP_PITY - 3 * perk('lucky')) return;
    G.killsSinceDrop = 0;
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
        G.shield = G.shieldMax = def.duration * powerupScale();
    } else if (type === 'bomb') {
        detonateBomb();
    } else {
        G.power = { type, timer: def.duration * powerupScale(), max: def.duration * powerupScale() };
    }
}

// Shots allowed on screen and the minimum gap between them.
const FIRE_COOLDOWN = 0.12;
const RAPID_COOLDOWN = 0.055;
const FIRE_BUFFER = 0.15; // a press this close to the next allowed shot still counts

// Bomb: destroys the lowest invader in every column, clears enemy fire,
// and takes a chunk out of a boss.
function detonateBomb() {
    const p = G.player;
    const cols = {};
    for (const inv of G.invaders) {
        if (inv.alive && (!cols[inv.col] || inv.y > cols[inv.col].y)) cols[inv.col] = inv;
    }
    for (const inv of Object.values(cols)) killInvader(inv);
    for (const eb of G.enemyBullets) burst(eb.x, eb.y, '#ffd25a', 3, 60);
    G.enemyBullets = [];
    if (G.boss) {
        G.boss.hp -= 4;
        G.boss.flash = 0.2;
        if (G.boss.hp <= 0) killBoss();
    }
    G.rings.push({ x: p.x + p.w / 2, y: p.y, r: 10, max: 700, life: 0.6, total: 0.6, color: POWERUPS.bomb.color });
    G.lights.push({ x: p.x + p.w / 2, y: p.y, size: 600, color: POWERUPS.bomb.color, life: 0.35, total: 0.35 });
    shakeScreen(10);
    G.flash = G.reduceMotion ? 0.3 : 0.8;
    G.hitstop = Math.max(G.hitstop, 0.08);
    award('bomb');
    Sound.bossDie();
}

function fire() {
    const p = G.player;
    const maxShots = (G.power.type === 'rapid' ? 10 : G.power.type === 'spread' ? 9 : 3) + perk('twin') * (G.power.type === 'spread' ? 3 : 1);
    if (G.playerBullets.length >= maxShots) return false;
    const mk = (dx, vx) => ({ x: p.x + p.w / 2 - 2 + dx, y: p.y - 12, w: 4, h: 14, vx, vy: -860 * (1 + 0.15 * perk('trigger')), pierce: G.power.type === 'pierce' });
    if (G.power.type === 'spread') {
        G.playerBullets.push(mk(0, 0), mk(-6, -170), mk(6, 170));
        countShots(3);
    } else {
        G.playerBullets.push(mk(0, 0));
        countShots(1);
    }
    burst(p.x + p.w / 2, p.y - 4, '#e8ffe8', 4, 90);
    Sound.shoot();
    return true;
}

function countShots(n) { G.stats.shots += n; G.waveStats.shots += n; }

function damageInvader(inv) {
    if (inv.hp > 1) {
        inv.hp -= 1;
        chainUp();
        burst(inv.x + inv.w / 2, inv.y + inv.h / 2, '#dfe9f5', 8, 140);
        popup(inv.x + inv.w / 2, inv.y, 'CRACK', '#a9bdd2', 0.5, 10);
        Sound.clank();
        return;
    }
    killInvader(inv);
}

function isPerkWave(w) { return w % 2 === 0 || isBossWave(w); }

function nextWave() {
    G.wave += 1;
    startWave();
    getReady(1.8);
}

function offerPerks() {
    const eligible = PERKS.filter(pk => perk(pk.id) < pk.max && (pk.id !== 'life' || G.lives < MAX_LIVES));
    for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    G.perkChoices = eligible.slice(0, 3);
    if (!G.perkChoices.length) { nextWave(); return; }
    G.perkIdx = Math.min(1, G.perkChoices.length - 1);
    G.perkLock = 0.6; // ignore input held over from the wave
    G.state = 'perk';
    Sound.wave();
}

function choosePerk(i) {
    if (G.state !== 'perk' || G.perkLock > 0 || !G.perkChoices[i]) return;
    const pk = G.perkChoices[i];
    G.perks[pk.id] = perk(pk.id) + 1;
    if (PERKS.filter(x => x.id !== 'life' && perk(x.id) > 0).length >= 3) award('perks3');
    if (pk.id === 'life') G.lives = Math.min(MAX_LIVES, G.lives + 1);
    Sound.powerup();
    nextWave();
    banner(pk.name, pk.color, 26);
}

function movePerk(dir) {
    if (!G.perkChoices.length) return;
    G.perkIdx = (G.perkIdx + dir + G.perkChoices.length) % G.perkChoices.length;
    Sound.blip();
}

function killInvader(inv) {
    inv.alive = false;
    chainUp();
    const pts = INVADER_TYPES[inv.type].points * multiplier();
    addScore(pts);
    const cx = inv.x + inv.w / 2, cy = inv.y + inv.h / 2;
    shatter(PIX[inv.type][G.fleetFrame], inv.x, inv.y, SCALE, PAL[inv.type]);
    burst(cx, cy, INVADER_TYPES[inv.type].color, 10, 120);
    popup(cx, inv.y, String(pts), multiplier() >= 4 ? '#ffd25a' : INVADER_TYPES[inv.type].color, 1.0, 12 + Math.min(10, pts / 15));
    dropPowerup(cx, cy);
    Sound.invaderHit(G.combo);
}

// Misses cost accuracy only; chains end when the chain timer runs out.
function missShot() {}

// ---------------------------------------------------------------------------
// Flow helpers: ready countdown, movement, settings, pause menu
// ---------------------------------------------------------------------------
function getReady(secs) {
    G.state = 'ready';
    G.stateTimer = secs;
    G.readyTotal = secs;
    G.targetX = null;
}

function shakeScreen(n) { if (!G.reduceMotion) G.shake = n; }

function movePlayer(dt) {
    const p = G.player;
    if (G.targetX !== null) {
        const want = clamp(G.targetX - p.w / 2, 8, W - p.w - 8);
        const d = want - p.x;
        const step = 1200 * dt;
        p.x += Math.abs(d) <= step ? d : Math.sign(d) * step;
    } else {
        const dir = input.left && input.right ? input.lastDir : input.left ? -1 : input.right ? 1 : 0;
        p.x += dir * p.speed * (1 + 0.15 * perk('thrusters')) * dt;
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

const PAUSE_MENU = ['RESUME', 'RESTART', 'SOUND', 'MUSIC', 'EFFECTS', 'QUIT TO TITLE'];
const MENU_Y0 = H / 2 - 50;
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
        case 3: Music.enabled = !Music.enabled; saveSettings(); Sound.blip(); break;
        case 4: G.fx = G.fx === 'high' ? 'low' : 'high'; G.fxLocked = true; saveSettings(); Sound.blip(); break;
        case 5: quitToTitle(); break;
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
        case 'perk': return m === 'touch' ? 'TAP AN UPGRADE' : m === 'pad' ? 'D-PAD CHOOSE · A TAKE' : '← → OR 1-3 CHOOSE · ENTER TAKE';
        case 'menu': return m === 'touch' ? 'TAP AN OPTION' : m === 'pad' ? 'D-PAD SELECT · A CONFIRM · START RESUME' : '↑ ↓ SELECT · ENTER CONFIRM · P RESUME';
    }
    return '';
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
const STAR_SPEED = [6, 16, 38];
const STAR_SIZE = [1, 1.6, 2.2];
const STAR_BRIGHT = [0.35, 0.6, 0.95];

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
    if (G.hurt > 0) G.hurt = Math.max(0, G.hurt - dt * 1.4);
    if (G.displayScore < G.score) G.displayScore = Math.min(G.score, G.displayScore + Math.max(60 * dt, (G.score - G.displayScore) * dt * 7));
    else G.displayScore = G.score;
    if (G.scorePulse > 0) G.scorePulse = Math.max(0, G.scorePulse - dt * 4);
    if (G.banner) { G.banner.life -= dt; if (G.banner.life <= 0) G.banner = null; }
    if (G.state !== 'paused') {
        G.meteorTimer -= dt;
        if (G.meteorTimer <= 0) {
            G.meteors.push({ x: rand(W * 0.3, W + 60), y: rand(-30, H * 0.35), vx: -rand(380, 560), vy: rand(140, 240), life: 1.6 });
            G.meteorTimer = rand(6, 14);
        }
        for (const m of G.meteors) { m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt; }
        G.meteors = G.meteors.filter(m => m.life > 0 && m.x > -120 && m.y < H);
    }
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
    if (G.toast) { G.toast.life -= dt; if (G.toast.life <= 0) G.toast = null; }
    for (const r of G.rings) { r.life -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 9); }
    G.rings = G.rings.filter(r => r.life > 0);
    for (const l of G.lights) l.life -= dt;
    G.lights = G.lights.filter(l => l.life > 0);
    const warpTarget = G.state === 'wavecleared' ? (G.reduceMotion ? 3 : 28) : 1;
    G.warp += (warpTarget - G.warp) * Math.min(1, dt * 2.2);
    G.bgScroll = (G.bgScroll + 4 * G.warp * dt) % H;
    for (const st of G.stars) {
        st.y += STAR_SPEED[st.z] * G.warp * dt;
        if (st.y > H) { st.y -= H; st.x = Math.random() * W; }
    }

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
        G.fireworkTimer -= dt;
        if (G.fireworkTimer <= 0) {
            const colors = [COLORS.squid, COLORS.crab, COLORS.octopus, '#ffd25a', COLORS.player];
            burst(rand(80, W - 80), rand(70, 320), colors[Math.floor(Math.random() * colors.length)], 26, 230);
            G.fireworkTimer = 0.2;
        }
        const elapsed = G.tallyTotal - G.stateTimer;
        while (G.tally && G.tallyShown < G.tally.length && (elapsed >= 0.45 + G.tallyShown * 0.4 || G.stateTimer <= 0)) {
            addScore(G.tally[G.tallyShown].value);
            G.tallyShown += 1;
            Sound.tally(G.tallyShown);
        }
        if (G.stateTimer <= 0) {
            G.tally = null;
            if (isPerkWave(G.wave)) offerPerks();
            else nextWave();
        }
        return;
    }
    if (G.state === 'ready') {
        G.stateTimer -= dt;
        movePlayer(dt);
        if (G.stateTimer <= 0) { G.state = 'playing'; G.waveIntro = false; }
        return;
    }
    if (G.state === 'gameover') { G.stateTimer -= dt; return; }
    if (G.state === 'perk') { G.perkLock = Math.max(0, G.perkLock - dt); return; }
    if (G.state !== 'playing') return;

    const player = G.player;
    if (player.invuln > 0) player.invuln -= dt;

    // Power-up timer
    if (G.power.type && G.power.timer > 0) {
        G.power.timer -= dt;
        if (G.power.timer <= 0) G.power = { type: null, timer: 0 };
    }
    if (G.shield > 0) G.shield = Math.max(0, G.shield - dt);
    if (G.combo > 0) {
        G.comboTimer -= dt;
        if (G.comboTimer <= 0) {
            if (G.combo >= 8) popup(player.x + player.w / 2, player.y - 30, 'CHAIN ' + G.combo, '#9ad', 1.0);
            G.combo = 0;
        }
    }

    movePlayer(dt);

    // Player fire — edge-triggered; rapid fire also autofires while held.
    if (input.firePressed) { input.fireBuffer = FIRE_BUFFER; input.firePressed = false; }
    G.fireCooldown -= dt;
    if ((input.fireBuffer > 0 || input.fire) && G.fireCooldown <= 0 && fire()) {
        input.fireBuffer = 0;
        G.fireCooldown = (G.power.type === 'rapid' ? RAPID_COOLDOWN : FIRE_COOLDOWN) * Math.pow(0.8, perk('trigger'));
    }
    input.fireBuffer = Math.max(0, input.fireBuffer - dt);

    // Player bullets
    for (const b of G.playerBullets) {
        b.y += b.vy * dt;
        b.x += b.vx * dt;
        if (b.y + b.h < 0 || b.x < -10 || b.x > W + 10) { b.dead = true; missShot(); continue; }
        for (const inv of G.invaders) {
            if (inv.alive && overlaps(b, inv)) { damageInvader(inv); if (!b.pierce) { b.dead = true; break; } }
        }
        if (b.dead) continue;
        if (G.boss && overlaps(b, G.boss)) {
            b.dead = true;
            G.boss.hp -= 1;
            G.boss.flash = 0.08;
            chainUp();
            burst(b.x, b.y, COLORS.boss, 5, 100);
            Sound.bossHit();
            if (G.boss.hp <= 0) killBoss();
            continue;
        }
        if (G.ufo && overlaps(b, G.ufo)) {
            const pts = G.ufo.points * multiplier();
            chainUp();
            addScore(pts);
            G.corpses.push({ x: G.ufo.x + G.ufo.w / 2 - SPR.burst.ufo.width / 2, y: G.ufo.y, spr: SPR.burst.ufo, life: 0.3 });
            burst(G.ufo.x + G.ufo.w / 2, G.ufo.y + G.ufo.h / 2, COLORS.ufo, 30, 240);
            popup(G.ufo.x + G.ufo.w / 2, G.ufo.y, String(pts), COLORS.ufo, 1.4);
            Sound.ufoHit();
            G.hitstop = 0.06;
            award('ufo');
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
                minX = Math.min(minX, inv.hx);
                maxX = Math.max(maxX, inv.hx + inv.w);
            }
            const nextMin = minX + G.fleetDir * FLEET_STEP_X;
            const nextMax = maxX + G.fleetDir * FLEET_STEP_X;
            if (nextMin < 10 || nextMax > W - 10) {
                G.fleetDir *= -1;
                for (const inv of G.invaders) inv.hy += FLEET_STEP_Y;
            } else {
                for (const inv of G.invaders) inv.hx += G.fleetDir * FLEET_STEP_X;
            }
            for (const inv of alive) {
                if (inv.dive) continue;
                inv.x = inv.hx;
                inv.y = inv.hy;
                for (const bk of G.bunkers) bk.crush(inv);
                if (inv.y + inv.h >= player.y) { killPlayer(true); return; }
            }
        }

        // Divers — from wave 3 an invader occasionally peels off and swoops
        // at the player, Galaga-style, then rejoins the fleet from the top.
        if (G.wave >= 3) {
            G.diveTimer -= dt;
            const diving = alive.filter(i => i.dive);
            const maxDivers = G.wave >= 6 ? 2 : 1;
            if (G.diveTimer <= 0 && diving.length < maxDivers && alive.length > 3) {
                const candidates = alive.filter(i => !i.dive);
                const inv = candidates[Math.floor(Math.random() * candidates.length)];
                inv.dive = { phase: 'wind', t: 0, wobble: rand(0, Math.PI * 2), aimX: player.x + player.w / 2 };
                G.diveTimer = Math.max(3.5, rand(7, 11) - G.wave * 0.3) * diff().fireRate;
                Sound.windup();
            }
            for (const inv of diving) updateDiver(inv, dt);
            if (G.state !== 'playing') return;
        }

        // Snipers glow for half a second, then fire an aimed bolt.
        for (const inv of alive) {
            if (inv.type !== 'sniper' || inv.dive) continue;
            inv.sniperTimer -= dt;
            if (inv.sniperTimer <= 0) {
                const cx = inv.x + inv.w / 2, cy = inv.y + inv.h;
                const dx = player.x + player.w / 2 - cx, dy = player.y - cy;
                const len = Math.hypot(dx, dy) || 1;
                const sp = 330 * diff().bulletSpeed;
                spawnEnemyBullet(cx, cy, dx / len * sp, Math.max(120, dy / len * sp));
                G.enemyBullets[G.enemyBullets.length - 1].sniper = true;
                Sound.snipe();
                inv.sniperTimer = rand(3, 5) * diff().fireRate;
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
        bs.y = 100 + Math.sin(bs.t * 2.3) * 14;
        if (bs.flash > 0) bs.flash -= dt;
        if (bs.hp < bs.maxHp / 2 && Math.random() < dt * (bs.hp < bs.maxHp / 4 ? 30 : 14)) {
            G.particles.push({ x: bs.x + rand(10, bs.w - 10), y: bs.y + rand(4, bs.h - 4), vx: rand(-20, 20), vy: rand(-60, -30), life: rand(0.5, 0.9), max: 0.9, color: Math.random() < 0.3 ? '#ff8c3b' : '#444', size: rand(3, 6), smoke: true });
        }
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
            if (!hitPlayer()) return;
        }
    }
    G.enemyBullets = G.enemyBullets.filter(b => !b.dead);

    // Power-up capsules
    for (const pu of G.powerups) {
        pu.y += pu.vy * dt;
        if (perk('magnet')) pu.x += clamp(player.x + player.w / 2 - (pu.x + pu.w / 2), -1, 1) * 200 * dt;
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
                points: [50, 100, 150, 300][Math.floor(Math.random() * 4)] * (perk('bounty') ? 2 : 1),
                soundTimer: 0,
            };
            G.ufoTimer = rand(15, 25) * (perk('bounty') ? 0.55 : 1);
        }
    }

    // Wave cleared
    if (alive.length === 0 && !G.boss) {
        G.state = 'wavecleared';
        G.stateTimer = G.tallyTotal;
        G.playerBullets = [];
        G.enemyBullets = [];
        G.ufo = null;
        const ws = G.waveStats;
        const acc = ws.shots ? Math.min(1, ws.hits / ws.shots) : 0;
        G.tally = [{ label: 'WAVE CLEAR', value: 100 * G.wave }];
        G.tally.push({ label: 'ACCURACY ' + Math.round(acc * 100) + '%', value: Math.round(acc * 100) * 2 * G.wave });
        if (!G.waveLostLife) award('perfect');
        if (acc >= 0.9 && ws.shots >= 10) award('sharp');
        if (!G.waveLostLife) G.tally.push({ label: 'NO DAMAGE', value: 100 * G.wave });
        if (ws.bestChain >= 5) G.tally.push({ label: 'BEST CHAIN ' + ws.bestChain, value: ws.bestChain * 5 * G.wave });
        G.tallyShown = 0;
        G.fireworkTimer = 0;
        Sound.wave();
    }
}

function killBoss() {
    const bs = G.boss;
    const pts = bs.points;
    addScore(pts);
    shatter(PIX.boss, bs.x, bs.y, SCALE + 1, PAL.boss, 1.4);
    burst(bs.x + bs.w / 2, bs.y + bs.h / 2, COLORS.boss, 50, 320);
    burst(bs.x + bs.w / 2, bs.y + bs.h / 2, '#fff', 30, 200);
    G.corpses.push({ x: bs.x + bs.w / 2 - SPR.burst.boss.width / 2, y: bs.y + bs.h / 2 - SPR.burst.boss.height / 2, spr: SPR.burst.boss, life: 0.5 });
    popup(bs.x + bs.w / 2, bs.y, String(pts), COLORS.boss, 2);
    shakeScreen(14);
    G.flash = G.reduceMotion ? 0.3 : 1;
    G.boss = null;
    Sound.bossDie();
    G.hitstop = 0.3;
    award('boss');
}

// A hit on the player. Returns true if it was absorbed (invincible or
// shielded) and play continues, false if the player died.
function hitPlayer() {
    const player = G.player;
    if (player.invuln > 0) return true;
    if (G.shield > 0) {
        G.shield = 0;
        burst(player.x + player.w / 2, player.y, POWERUPS.shield.color, 20, 200);
        popup(player.x + player.w / 2, player.y - 20, 'SHIELD DOWN', POWERUPS.shield.color);
        Sound.shieldHit();
        G.hurt = 0.6;
        G.hurtTex = HURT.green;
        player.invuln = 0.6;
        return true;
    }
    killPlayer(false);
    return false;
}

function updateDiver(inv, dt) {
    const d = inv.dive;
    const p = G.player;
    d.t += dt;
    // Wind-up: shake in place for a moment so the dive is telegraphed.
    if (d.phase === 'wind') {
        inv.x = inv.hx + Math.sin(d.t * 40) * 3;
        inv.y = inv.hy;
        if (d.t >= DIVE_WINDUP) { d.phase = 'down'; d.t = 0; Sound.dive(); }
        return;
    }
    if (d.phase === 'down') {
        // Aim at where the player was when the dive began, with mild
        // tracking, so a dodge actually works. Speed ramps up over the dive.
        const targetX = d.aimX - inv.w / 2;
        inv.x += (targetX - inv.x) * 1.1 * dt + Math.sin(d.t * 7 + d.wobble) * 70 * dt;
        const ramp = Math.min(1, 0.45 + d.t * 0.5);
        inv.y += Math.min(DIVE_SPEED_MAX, 140 + G.wave * 6) * ramp * diff().bulletSpeed * dt;
        if (d.t > 0.35 && Math.abs((p.x + p.w / 2) - d.aimX) < 120) d.aimX += ((p.x + p.w / 2) - d.aimX) * 0.6 * dt;
        for (const bk of G.bunkers) bk.crush(inv);
        if (overlaps(inv, p)) {
            const absorbed = hitPlayer();
            killInvader(inv);
            if (!absorbed) return;
        }
        if (inv.y > H + 20) { d.phase = 'return'; inv.y = -inv.h - 10; }
    } else {
        inv.x = inv.hx;
        inv.y += 320 * dt;
        if (inv.y >= inv.hy) { inv.y = inv.hy; inv.dive = null; }
    }
}

function killPlayer(invaded) {
    if (G.state !== 'playing') return;
    G.waveLostLife = true;
    const p = G.player;
    shatter(PIX.player, p.x, p.y, SCALE, PAL.player, 1.6);
    burst(p.x + p.w / 2, p.y + p.h / 2, COLORS.player, 24, 260);
    G.hurt = 1;
    G.hurtTex = HURT.red;
    Sound.playerHit();
    G.hitstop = 0.12;
    shakeScreen(8);
    G.lives -= invaded ? G.lives : 1;
    G.playerBullets = [];
    G.combo = 0;
    G.shield = 0;
    G.power = { type: null, timer: 0 };
    G.state = 'dying';
    G.stateTimer = 1.6;
}

const SHARE_BOX = { x: W / 2 - 140, y: 452, w: 280, h: 34 };
function inShareBox(pt) { return pt.x >= SHARE_BOX.x && pt.x <= SHARE_BOX.x + SHARE_BOX.w && pt.y >= SHARE_BOX.y && pt.y <= SHARE_BOX.y + SHARE_BOX.h; }
function toast(text) { G.toast = { text, life: 1.8 }; }
function shareScore() {
    try {
        const url = typeof location !== 'undefined' ? location.href : '';
        const msg = 'I scored ' + G.score + ' points and reached wave ' + G.wave + ' in Space Invaders! Can you beat it? ' + url;
        if (navigator.share) {
            navigator.share({ title: 'Space Invaders', text: msg }).then(() => toast('SHARED!'), () => {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(msg).then(() => toast('COPIED TO CLIPBOARD'), () => toast('COULD NOT COPY'));
        } else {
            toast('SHARING NOT SUPPORTED HERE');
        }
        Sound.blip();
    } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Online: world leaderboard and score submission (signed-in players only).
// window.GAME_CONFIG is written by the page; without it the game is offline.
// ---------------------------------------------------------------------------
const CFG = (typeof window !== 'undefined' && window.GAME_CONFIG) || null;
const Online = {
    board: [],
    status: '',
    canFetch() { return !!CFG && typeof fetch === 'function'; },
    loadBoard() {
        if (!this.canFetch()) return Promise.resolve();
        return fetch(CFG.scoresUrl, { headers: { Accept: 'application/json' } })
            .then(r => (r.ok ? r.json() : null))
            .then(json => { if (json && Array.isArray(json.data)) this.board = json.data; })
            .catch(() => {});
    },
    submit(score, wave) {
        if (!CFG || score <= 0) { this.status = ''; return Promise.resolve(); }
        if (!CFG.submitUrl) { this.status = 'SIGN IN TO SAVE SCORES ONLINE'; return Promise.resolve(); }
        if (!this.canFetch()) return Promise.resolve();
        this.status = 'SAVING SCORE…';
        return fetch(CFG.submitUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': CFG.csrf },
            credentials: 'same-origin',
            body: JSON.stringify({ score, wave, difficulty: G.difficulty }),
        })
            .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
            .then(json => { this.status = 'SAVED · WORLD RANK #' + json.rank; return this.loadBoard(); })
            .catch(() => { this.status = 'COULD NOT SAVE SCORE'; });
    },
};
Online.loadBoard();

// ---------------------------------------------------------------------------
// Medals: one-time achievements kept in this browser.
// ---------------------------------------------------------------------------
const MEDALS = [
    { id: 'ufo', name: 'UFO HUNTER', desc: 'Shoot down a UFO' },
    { id: 'bomb', name: 'DEMOLITION', desc: 'Detonate a bomb' },
    { id: 'perfect', name: 'FLAWLESS', desc: 'Clear a wave without losing a life' },
    { id: 'sharp', name: 'SHARPSHOOTER', desc: 'Clear a wave with 90% accuracy' },
    { id: 'chain8', name: 'UNSTOPPABLE', desc: 'Reach a x8 chain' },
    { id: 'boss', name: 'GIANT SLAYER', desc: 'Defeat a boss' },
    { id: 'perks3', name: 'UPGRADED', desc: 'Hold three upgrades at once' },
    { id: 'score10k', name: '10K CLUB', desc: 'Score 10,000 points in one game' },
    { id: 'wave10', name: 'VETERAN', desc: 'Reach wave 10' },
    { id: 'hard5', name: 'HARDCORE', desc: 'Reach wave 5 on Hard' },
];
const MEDALS_KEY = 'nq-space-invaders-medals';
function loadMedals() {
    try { const m = JSON.parse(localStorage.getItem(MEDALS_KEY) || '[]'); return Array.isArray(m) ? m : []; } catch (e) { return []; }
}
G.medals = loadMedals();
G.medalsThisGame = [];
function award(id) {
    if (G.medals.includes(id)) return;
    const medal = MEDALS.find(m => m.id === id);
    if (!medal) return;
    G.medals.push(id);
    G.medalsThisGame.push(id);
    try { localStorage.setItem(MEDALS_KEY, JSON.stringify(G.medals)); } catch (e) { /* ignore */ }
    toast('MEDAL: ' + medal.name);
    Sound.extraLife();
}

function endGame() {
    Online.submit(G.score, G.wave);
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
    if (size >= 28) { ctx.shadowColor = color; ctx.shadowBlur = 18; }
    ctx.fillText(str, x, y);
    if (size >= 28) ctx.shadowBlur = 0;
}

function drawBackground() {
    ctx.imageSmoothingEnabled = true;
    const off = G.bgScroll;
    ctx.drawImage(BG, 0, off - H);
    ctx.drawImage(BG, 0, off);
    ctx.imageSmoothingEnabled = false;
    const streak = G.warp > 2;
    for (const st of G.stars) {
        const tw = 0.6 + 0.4 * Math.sin(G.time * 1.6 + st.p);
        const a = STAR_BRIGHT[st.z] * tw;
        const sz = STAR_SIZE[st.z];
        ctx.fillStyle = st.z === 2 ? `rgba(255,255,255,${a.toFixed(2)})` : `rgba(190,210,255,${a.toFixed(2)})`;
        if (streak) {
            const len = Math.min(48, STAR_SPEED[st.z] * G.warp * 0.045);
            ctx.globalAlpha = 0.55;
            ctx.fillRect(st.x, st.y - len, Math.max(1, sz - 0.6), len + sz);
            ctx.globalAlpha = 1;
        } else {
            ctx.fillRect(st.x, st.y, sz, sz);
        }
    }
    if (G.meteors.length) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 2;
        for (const m of G.meteors) {
            const a = clamp(m.life / 0.6, 0, 1);
            const tx = m.x - m.vx * 0.2, ty = m.y - m.vy * 0.2;
            const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
            grad.addColorStop(0, `rgba(220,240,255,${(0.9 * a).toFixed(2)})`);
            grad.addColorStop(1, 'rgba(220,240,255,0)');
            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            drawLight(m.x, m.y, 18, '#cfe8ff', a);
        }
        ctx.globalCompositeOperation = 'source-over';
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(PLANET, 0, H - 160);
    ctx.imageSmoothingEnabled = false;
}

function drawHud() {
    text('SCORE', 24, 20, 12, '#9ad', 'left');
    text(pad(Math.floor(G.displayScore)), 24, 40, Math.round(18 + G.scorePulse * 5), G.scorePulse > 0.2 ? '#ffd25a' : '#fff', 'left');
    text('HI-SCORE', W / 2, 20, 12, '#9ad');
    text(pad(G.hiScore), W / 2, 40, 18, G.newHiScore ? '#ffd25a' : '#fff');
    text('WAVE', W - 24, 20, 12, '#9ad', 'right');
    text(String(G.wave), W - 24, 40, 18, '#fff', 'right');

    // Chain meter: count, multiplier and time left to keep it going.
    if (G.combo >= 2) {
        const m = multiplier();
        const col = m >= 6 ? '#ff6ad5' : m >= 4 ? '#ffd25a' : m >= 2 ? COLORS.player : '#9ad';
        text('CHAIN ' + G.combo + (m > 1 ? '  x' + m : ''), 24, 62, 12, col, 'left');
        ctx.fillStyle = '#222';
        ctx.fillRect(24, 72, 130, 4);
        ctx.fillStyle = col;
        ctx.fillRect(24, 72, 130 * clamp(G.comboTimer / chainWindow(), 0, 1), 4);
    }

    // Milestone banner
    if (G.banner) {
        const b = G.banner;
        const age = b.total - b.life;
        const pop = age < 0.12 ? 1.6 - age / 0.12 * 0.6 : 1;
        ctx.globalAlpha = clamp(b.life / 0.3, 0, 1);
        text(b.text, W / 2, H * 0.42, Math.round(b.size * pop), b.color);
        ctx.globalAlpha = 1;
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
    if (G.power.type && G.power.timer > 0) bar(POWERUPS[G.power.type], G.power.timer / (G.power.max || POWERUPS[G.power.type].duration));
    if (G.shield > 0) bar(POWERUPS.shield, G.shield / (G.shieldMax || POWERUPS.shield.duration));

    // Boss health
    if (G.boss) {
        const bw = 240;
        ctx.fillStyle = '#222';
        ctx.fillRect(W / 2 - bw / 2, 58, bw, 8);
        ctx.fillStyle = COLORS.boss;
        ctx.fillRect(W / 2 - bw / 2, 58, bw * clamp(G.boss.hp / G.boss.maxHp, 0, 1), 8);
    }

    // Lives + ground line
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(GROUND, 0, H - 28);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(0, H - 28, W, 2);
    const lowLife = G.lives === 1 && (G.state === 'playing' || G.state === 'ready') && Math.sin(G.time * 6) > 0;
    text(String(G.lives), 24, H - 14, 14, lowLife ? COLORS.ufo : COLORS.player, 'left');
    if (G.lives === 1 && G.state === 'playing') text('LAST LIFE', 24 + 40, H - 14, 10, lowLife ? COLORS.ufo : '#888', 'left');
    for (let i = 0; i < Math.max(0, G.lives - 1); i++) {
        ctx.drawImage(SPR.player, 48 + i * 34, H - 24, SPR.player.width * 0.6, SPR.player.height * 0.6);
    }
    drawPerkBadges();
    if (Sound.muted) text('MUTED', W - 24, H - 14, 12, '#888', 'right');
}

function drawPlayer() {
    const p = G.player;
    if (G.state === 'dying') return;
    if (p.invuln > 0 && Math.floor(G.time * 12) % 2 === 0) return;
    drawSprite(SPR.player, p.x, p.y, 0.7);
    const moving = G.state === 'playing' && (input.left || input.right || (G.targetX !== null && Math.abs(G.targetX - (p.x + p.w / 2)) > 4));
    ctx.globalCompositeOperation = 'lighter';
    if (moving) {
        const flick = Math.random();
        const dir = input.right || (G.targetX !== null && G.targetX > p.x + p.w / 2) ? -1 : 1;
        const fx = dir < 0 ? p.x - 6 : p.x + p.w;
        drawLight(fx + 3, p.y + p.h - 7, 26 + flick * 10, '#ff8c3b', 0.8);
        ctx.fillStyle = flick < 0.5 ? '#ffd25a' : '#ff8c3b';
        ctx.fillRect(fx, p.y + p.h - 10, 6, 4 + flick * 4);
    }
    if (G.shield > 0) {
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2 + 2;
        const rx = p.w / 2 + 12, ry = p.h / 2 + 12;
        const pulse = 0.5 + 0.3 * Math.sin(G.time * 8);
        ctx.fillStyle = rgba(POWERUPS.shield.color, 0.08 + 0.05 * pulse);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(POWERUPS.shield.color, pulse);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', 0.5 * pulse);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx - 4, ry - 4, 0, Math.PI * 1.15, Math.PI * 1.55);
        ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
}

function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function drawPlayfield() {
    for (const bk of G.bunkers) bk.draw();

    // Invaders slide in row by row from alternating sides at wave start.
    const intro = G.state === 'ready' && G.waveIntro;
    const prog = intro ? 1 - G.stateTimer / G.readyTotal : 1;
    for (const inv of G.invaders) {
        if (!inv.alive) continue;
        const spr = (inv.type === 'tank' && inv.hp === 1 ? SPR.tankHurt : INVADER_TYPES[inv.type].frames)[G.fleetFrame];
        if (intro) {
            const t = clamp(prog * 1.9 - inv.row * 0.16, 0, 1);
            const e = easeOutBack(t);
            const side = inv.row % 2 ? 1 : -1;
            ctx.globalAlpha = clamp(t * 2.5, 0, 1);
            drawSprite(spr, inv.x + side * (1 - e) * W, inv.y, 0.5);
            ctx.globalAlpha = 1;
        } else {
            if (inv.dive) {
                ctx.globalCompositeOperation = 'lighter';
                const winding = inv.dive.phase === 'wind';
                const pulse = winding ? 0.4 + 0.5 * Math.abs(Math.sin(inv.dive.t * 25)) : 0.35;
                drawLight(inv.x + inv.w / 2, inv.y + inv.h / 2, winding ? 80 : 60, winding ? '#ffffff' : INVADER_TYPES[inv.type].color, pulse);
                ctx.globalCompositeOperation = 'source-over';
            }
            drawSprite(spr, inv.x, inv.y, 0.5);
            if (inv.type === 'sniper' && inv.sniperTimer < 0.5 && G.state === 'playing') {
                const t = 1 - inv.sniperTimer / 0.5;
                ctx.globalCompositeOperation = 'lighter';
                drawLight(inv.x + inv.w / 2, inv.y + 3.5 * SCALE, 20 + t * 40, '#ff3b6b', 0.5 + t * 0.5);
                ctx.globalCompositeOperation = 'source-over';
            }
        }
    }
    for (const c of G.corpses) drawSprite(c.spr, c.x, c.y, 0.9);

    if (G.ufo) {
        const u = G.ufo;
        drawSprite(SPR.ufo, u.x, u.y, 0.7);
        const lit = Math.floor(G.time * 10) % 4;
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i === lit ? '#ffd25a' : '#5a1010';
            ctx.fillRect(Math.round(u.x) + (3 + i * 3) * SCALE, u.y + 3 * SCALE, SCALE, SCALE);
        }
    }
    if (G.boss) {
        const bs = G.boss;
        ctx.globalCompositeOperation = 'lighter';
        drawLight(bs.x + bs.w / 2, bs.y + bs.h + 6, 180, COLORS.boss, 0.25 + 0.1 * Math.sin(G.time * 5));
        ctx.globalCompositeOperation = 'source-over';
        drawSprite(bs.flash > 0 ? SPR.bossFlash : SPR.boss, bs.x, bs.y, 0.8);
        // Engine lights along the underside, blinking in sequence.
        for (let i = 0; i < 5; i++) {
            const on = (Math.floor(G.time * 6) + i) % 5 === 0;
            ctx.fillStyle = on ? '#fff3c0' : '#7a3a10';
            ctx.fillRect(Math.round(bs.x + bs.w * (0.2 + i * 0.15)) - 2, Math.round(bs.y + bs.h * 0.62), 4, 4);
        }
    }
    drawPlayer();

    // Everything below glows: draw additively.
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    for (const b of G.playerBullets) {
        ctx.drawImage(TRAIL.player, Math.round(b.x), Math.round(b.y + b.h), b.w, 30);
        drawLight(b.x + b.w / 2, b.y + 4, b.pierce ? 36 : 26, b.pierce ? '#ffb05a' : '#8dffa0', 0.6);
    }
    for (const eb of G.enemyBullets) {
        ctx.drawImage(TRAIL.enemy, Math.round(eb.x), Math.round(eb.y - 18), eb.w, 18);
        drawLight(eb.x + eb.w / 2, eb.y + eb.h / 2, eb.sniper ? 34 : 28, eb.sniper ? '#ff3b6b' : '#ffd25a', 0.55);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#f4fff4';
    for (const b of G.playerBullets) ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);
    for (const eb of G.enemyBullets) {
        if (eb.sniper) {
            ctx.fillStyle = '#ff9ab0';
            ctx.fillRect(Math.round(eb.x), Math.round(eb.y), eb.w, eb.h);
            continue;
        }
        const zig = Math.sin(G.time * 30 + eb.wobble) > 0 ? 2 : -2;
        ctx.fillStyle = '#ffd25a';
        ctx.fillRect(Math.round(eb.x + zig), Math.round(eb.y), eb.w, eb.h / 2);
        ctx.fillRect(Math.round(eb.x - zig), Math.round(eb.y + eb.h / 2), eb.w, eb.h / 2);
        ctx.fillStyle = '#fff6d0';
        ctx.fillRect(Math.round(eb.x + zig) + 1, Math.round(eb.y) + 1, eb.w - 2, eb.h / 2 - 2);
    }

    for (const l of G.lights) drawLight(l.x, l.y, l.size * (1 + (1 - l.life / l.total) * 0.6), l.color, l.life / l.total);
    for (const r of G.rings) {
        const a = clamp(r.life / r.total, 0, 1);
        ctx.strokeStyle = rgba(r.color, a * 0.8);
        ctx.lineWidth = 1 + a * 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Power-up capsules
    for (const pu of G.powerups) {
        const def = POWERUPS[pu.type];
        const bob = Math.sin(G.time * 6) * 2;
        const x = Math.round(pu.x), y = Math.round(pu.y + bob);
        ctx.globalCompositeOperation = 'lighter';
        drawLight(x + pu.w / 2, y + pu.h / 2, 56, def.color, 0.45 + 0.2 * Math.sin(G.time * 8));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, pu.w, pu.h, 6); else ctx.rect(x, y, pu.w, pu.h);
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = rgba('#ffffff', 0.25);
        ctx.fillRect(x + 4, y + 3, pu.w - 8, 2);
        text(def.letter, x + pu.w / 2, y + pu.h / 2 + 1, 12, def.color);
    }

    // Particles: smoke normally, sparks and embers additively.
    for (const p of G.particles) {
        if (!p.smoke) continue;
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * 0.6;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.5;
    for (const p of G.particles) {
        if (p.smoke) continue;
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
        if (p.spark) {
            ctx.strokeStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
            ctx.stroke();
        } else {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    for (const t of G.popups) {
        ctx.globalAlpha = clamp(t.life / Math.min(t.max, 1), 0, 1);
        const grow = 1 + 0.35 * clamp((t.max - t.life) / 0.08, 0, 1) * clamp(t.life / t.max * 4, 0, 1);
        text(t.text, t.x, t.y, Math.round((t.size || 14) * grow), t.color);
    }
    ctx.globalAlpha = 1;
}

function dim(alpha = 0.7) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, W, H);
}

// Alternates between this browser's scores and the world board when the
// world board has entries.
function drawScoreboard(y, highlight) {
    const world = Online.board.length > 0 && Math.floor(G.time / 5) % 2 === 1;
    const list = world ? Online.board.slice(0, BOARD_SIZE) : G.scores;
    text(world ? 'WORLD TOP ' + BOARD_SIZE : 'YOUR TOP SCORES', W / 2, y, 14, world ? '#ffd25a' : '#9ad');
    if (!list.length) { text('NO SCORES YET', W / 2, y + 30, 12, '#666'); return; }
    list.forEach((e, i) => {
        const rowY = y + 28 + i * 22;
        const hl = highlight && e === highlight;
        const color = hl ? '#ffd25a' : '#fff';
        text(String(i + 1) + '.', W / 2 - 150, rowY, 12, color, 'left');
        text(String(e.name).slice(0, 10).toUpperCase(), W / 2 - 110, rowY, 12, color, 'left');
        text(pad(e.score), W / 2 + 60, rowY, 12, color, 'right');
        text(e.wave ? 'W' + e.wave : '', W / 2 + 150, rowY, 12, '#9ad', 'right');
    });
}

// A band of light sweeping across the logo: the title is drawn as a mask,
// the band is kept only where the letters are, then added on top.
function drawTitleShine() {
    const g = titleCtx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, 160);
    g.font = `bold 56px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText('SPACE', W / 2, 50);
    g.fillText('INVADERS', W / 2, 115);
    g.globalCompositeOperation = 'source-in';
    const bx = ((G.time * 260) % (W + 500)) - 250;
    const band = g.createLinearGradient(bx - 90, 0, bx + 90, 0);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = band;
    g.fillRect(0, 0, W, 160);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(TITLE, 0, 40, W, 160);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
}

function drawStartScreen() {
    dim(0.55);
    text('SPACE', W / 2, 90, 56, COLORS.player);
    text('INVADERS', W / 2, 155, 56, COLORS.player);
    drawTitleShine();
    text('MEDALS ' + G.medals.length + '/' + MEDALS.length, W - 24, 24, 10, '#ffd25a', 'right');

    const rows = [
        [SPR.ufo, '= ? MYSTERY', COLORS.ufo],
        [SPR.squid[0], '= 30 POINTS', COLORS.squid],
        [SPR.crab[0], '= 20 POINTS', COLORS.crab],
        [SPR.octopus[0], '= 10 POINTS', COLORS.octopus],
    ];
    rows.forEach(([spr, label, color], i) => {
        const y = 215 + i * 34;
        drawSprite(spr, W / 2 - 230 - spr.width / 2, y - spr.height / 2, 0.6);
        text(label, W / 2 - 190, y, 14, color, 'left');
    });
    Object.values(POWERUPS).forEach((def, i) => {
        const y = 207 + i * 26;
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 + 40, y - 10, 20, 20);
        text(def.letter, W / 2 + 50, y + 1, 11, def.color);
        text(def.label, W / 2 + 72, y, 12, def.color, 'left');
    });

    drawScoreboard(362);

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

const CARD_W = 220, CARD_H = 210, CARD_Y = 190;
function cardX(i, n) { return W / 2 - (n * CARD_W + (n - 1) * 24) / 2 + i * (CARD_W + 24); }
function perkCardAt(pt) {
    const n = G.perkChoices.length;
    for (let i = 0; i < n; i++) {
        const x = cardX(i, n);
        if (pt.x >= x && pt.x <= x + CARD_W && pt.y >= CARD_Y && pt.y <= CARD_Y + CARD_H) return i;
    }
    return -1;
}
function wrapWords(str, maxChars) {
    const lines = [];
    let line = '';
    for (const w of str.split(' ')) {
        if ((line + ' ' + w).trim().length > maxChars) { lines.push(line); line = w; } else line = (line + ' ' + w).trim();
    }
    if (line) lines.push(line);
    return lines;
}
function drawPerkScreen() {
    dim(0.75);
    text('CHOOSE AN UPGRADE', W / 2, 130, 26, '#fff');
    const n = G.perkChoices.length;
    G.perkChoices.forEach((pk, i) => {
        const sel = i === G.perkIdx;
        const x = cardX(i, n), y = CARD_Y - (sel ? 8 : 0);
        ctx.fillStyle = sel ? 'rgba(30,30,50,0.95)' : 'rgba(14,14,26,0.9)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, CARD_W, CARD_H, 10); else ctx.rect(x, y, CARD_W, CARD_H);
        ctx.fill();
        ctx.strokeStyle = sel ? pk.color : rgba(pk.color, 0.35);
        ctx.lineWidth = sel ? 3 : 2;
        ctx.stroke();
        if (sel) {
            ctx.globalCompositeOperation = 'lighter';
            drawLight(x + CARD_W / 2, y + 60, 160, pk.color, 0.25 + 0.1 * Math.sin(G.time * 6));
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.strokeStyle = pk.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + CARD_W / 2 - 26, y + 26, 52, 52);
        text(pk.code, x + CARD_W / 2, y + 53, 18, pk.color);
        text(pk.name, x + CARD_W / 2, y + 104, 12, '#fff');
        wrapWords(pk.desc, 18).forEach((ln, k) => text(ln, x + CARD_W / 2, y + 134 + k * 18, 10, '#9ad'));
        const lvl = perk(pk.id);
        if (pk.max > 1 && pk.max < 99) text('LEVEL ' + (lvl + 1) + ' / ' + pk.max, x + CARD_W / 2, y + CARD_H - 20, 9, rgba(pk.color, 0.8));
        if (G.inputMode === 'keys') text(String(i + 1), x + 16, y + 16, 10, '#567');
    });
    text(hintText('perk'), W / 2, CARD_Y + CARD_H + 40, 11, '#9ad');
}

function drawPerkBadges() {
    const owned = PERKS.filter(pk => perk(pk.id) > 0 && pk.id !== 'life');
    if (!owned.length) return;
    const bw = 30, gap = 4;
    let x = W / 2 - (owned.length * (bw + gap) - gap) / 2;
    for (const pk of owned) {
        ctx.strokeStyle = rgba(pk.color, 0.7);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, H - 22.5, bw, 16);
        text(pk.code + (perk(pk.id) > 1 ? perk(pk.id) : ''), x + bw / 2, H - 14, 8, pk.color);
        x += bw + gap;
    }
}

function drawOverlay() {
    if (G.state === 'paused') {
        dim(0.7);
        text('PAUSED', W / 2, H / 2 - 115, 40, '#fff');
        PAUSE_MENU.forEach((item, i) => {
            const label = item === 'SOUND' ? 'SOUND: ' + (Sound.muted ? 'OFF' : 'ON') : item === 'MUSIC' ? 'MUSIC: ' + (Music.enabled ? 'ON' : 'OFF') : item === 'EFFECTS' ? 'EFFECTS: ' + G.fx.toUpperCase() : item;
            const sel = i === G.menuIdx;
            text((sel ? '▶ ' : '') + label, W / 2, MENU_Y0 + i * MENU_DY, 16, sel ? '#ffd25a' : '#fff');
        });
        text(hintText('menu'), W / 2, H / 2 + 150, 10, '#9ad');
    } else if (G.state === 'ready') {
        const title = G.boss ? 'BOSS WAVE ' + G.wave : 'WAVE ' + G.wave;
        text(title, W / 2, H / 2 - 40, 32, G.boss ? COLORS.boss : COLORS.player);
        text('GET READY', W / 2, H / 2 + 6, 18, '#ffd25a');
        if (G.wave === 1 || G.inputMode === 'touch') text(hintText('controls'), W / 2, H / 2 + 46, 10, '#9ad');
    } else if (G.state === 'wavecleared') {
        text('WAVE ' + G.wave + ' CLEARED', W / 2, H / 2 - 110, 32, COLORS.player);
        if (G.tally) {
            let total = 0;
            G.tally.forEach((t, i) => {
                if (i >= G.tallyShown) return;
                const y = H / 2 - 50 + i * 30;
                text(t.label, W / 2 - 170, y, 14, '#fff', 'left');
                text('+' + t.value, W / 2 + 170, y, 14, '#ffd25a', 'right');
                total += t.value;
            });
            if (G.tallyShown === G.tally.length) {
                const y = H / 2 - 50 + G.tally.length * 30 + 10;
                ctx.fillStyle = '#ffd25a';
                ctx.fillRect(W / 2 - 170, y - 18, 340, 2);
                text('TOTAL', W / 2 - 170, y + 4, 16, '#ffd25a', 'left');
                text('+' + total, W / 2 + 170, y + 4, 18, '#ffd25a', 'right');
            }
        }
        if (isBossWave(G.wave + 1)) text('BOSS INCOMING', W / 2, H / 2 + 125, 16, COLORS.boss);
    } else if (G.state === 'perk') {
        drawPerkScreen();
    } else if (G.state === 'entername') {
        drawNameEntry();
    } else if (G.state === 'gameover') {
        dim(0.75);
        text('GAME OVER', W / 2, 90, 44, COLORS.ufo);
        text('SCORE ' + pad(G.score) + '   WAVE ' + G.wave, W / 2, 145, 16, '#fff');
        const acc = G.stats.shots ? Math.round(100 * G.stats.hits / G.stats.shots) : 0;
        text('ACCURACY ' + acc + '%   SHOTS ' + G.stats.shots + (G.comboBest >= 5 ? '   BEST COMBO ' + G.comboBest : ''), W / 2, 172, 11, '#9ad');
        const mine = G.scores.find(e => e.score === G.score && G.lastEntry && e.name === G.lastEntry.join(''));
        if (G.medalsThisGame.length) text('NEW MEDALS: ' + G.medalsThisGame.map(id => MEDALS.find(m => m.id === id).name).join(' · '), W / 2, 214, 9, '#ffd25a');
        if (Online.status) text(Online.status, W / 2, 198, 11, /SAVED/.test(Online.status) ? COLORS.player : '#9ad');
        drawScoreboard(230, mine);
        const blink = Math.sin(G.time * 5) > -0.2;
        if (G.stateTimer <= 0 && blink) text(hintText('again'), W / 2, 420, 16, '#9ad');
        ctx.strokeStyle = '#ffd25a';
        ctx.lineWidth = 2;
        ctx.strokeRect(SHARE_BOX.x, SHARE_BOX.y, SHARE_BOX.w, SHARE_BOX.h);
        text(G.inputMode === 'keys' ? 'SHARE SCORE  (C)' : 'SHARE SCORE', W / 2, SHARE_BOX.y + SHARE_BOX.h / 2 + 1, 12, '#ffd25a');
    }
}

function applyBloom() {
    if (G.fx !== 'high') return;
    bloomA.globalCompositeOperation = 'copy';
    bloomA.imageSmoothingEnabled = true;
    bloomA.drawImage(canvas, 0, 0, W / 2, H / 2);
    // B and C each hold the frame squared: bright stays bright, mid-tones fade.
    for (const [g, w, h] of [[bloomB, W / 4, H / 4], [bloomC, W / 8, H / 8]]) {
        g.imageSmoothingEnabled = true;
        g.globalCompositeOperation = 'copy';
        g.drawImage(BLOOM_A, 0, 0, w, h);
        g.globalCompositeOperation = 'multiply';
        g.drawImage(BLOOM_A, 0, 0, w, h);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.35;
    ctx.drawImage(BLOOM_B, 0, 0, W, H);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(BLOOM_C, 0, 0, W, H);
    ctx.restore();
}

function drawScanlines() {
    ctx.drawImage(CRT, 0, 0, W, H);
    if (G.flash > 0) {
        ctx.fillStyle = `rgba(255,220,180,${(G.flash * 0.35).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
    }
}

function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);
    drawBackground();
    if (G.state === 'start') {
        drawStartScreen();
    } else {
        drawPlayfield();
        drawHud();
        drawOverlay();
    }
    ctx.restore();
    applyBloom();
    if (G.hurt > 0 && G.hurtTex) {
        ctx.globalAlpha = G.hurt;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(G.hurtTex, 0, 0, W, H);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
    }
    drawScanlines();
    if (G.toast) {
        ctx.globalAlpha = clamp(G.toast.life, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(W / 2 - 170, H - 70, 340, 30);
        text(G.toast.text, W / 2, H - 55, 12, '#ffd25a');
        ctx.globalAlpha = 1;
    }
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
    else if (G.state === 'perk') choosePerk(G.perkIdx);
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
    if (down && G.state === 'perk') { movePerk(-1); return; }
    if (down && G.state === 'entername') { nameCycle(-1); return; }
    input.left = down;
    if (down) input.lastDir = -1;
}
function pressRight(down) {
    if (down && G.state === 'start') { cycleDifficulty(1); return; }
    if (down && G.state === 'perk') { movePerk(1); return; }
    if (down && G.state === 'entername') { nameCycle(1); return; }
    input.right = down;
    if (down) input.lastDir = 1;
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
    if (G.state === 'perk' && /^Digit[1-3]$/.test(e.code)) { choosePerk(Number(e.code[5]) - 1); return; }
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
        case 'KeyC': if (G.state === 'gameover') shareScore(); break;
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
        canvasPointer = e.pointerId;
        if (touchLike) G.targetX = canvasPoint(e).x;
        if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
        input.fire = true;
        if (G.state === 'playing') input.firePressed = true;
    } else if (G.state === 'paused') {
        const idx = Math.round((canvasPoint(e).y - MENU_Y0) / MENU_DY);
        if (idx >= 0 && idx < PAUSE_MENU.length) { G.menuIdx = idx; menuSelect(); }
    } else if (G.state === 'perk') {
        const pt = canvasPoint(e);
        const i = perkCardAt(pt);
        if (i >= 0) { G.perkIdx = i; choosePerk(i); }
    } else if (G.state === 'gameover' && inShareBox(canvasPoint(e))) {
        shareScore();
    } else {
        primaryAction();
    }
});
canvas.addEventListener('pointermove', e => {
    if (canvasPointer === e.pointerId && G.targetX !== null) G.targetX = canvasPoint(e).x;
});
const releaseCanvas = e => { if (canvasPointer === e.pointerId) { canvasPointer = null; G.targetX = null; input.fire = false; } };
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
// If play runs under ~40 fps for three seconds and the player hasn't chosen
// an effects level, drop to low effects once.
const perf = { t: 0, frames: 0 };
function watchPerformance(rawDt) {
    if (G.fx !== 'high' || G.fxLocked || G.state !== 'playing' || rawDt <= 0 || rawDt > 0.25) return;
    perf.t += rawDt;
    perf.frames += 1;
    if (perf.t < 3) return;
    if (perf.t / perf.frames > 1 / 40) {
        G.fx = 'low';
        toast('EFFECTS LOWERED FOR SMOOTHNESS');
    }
    perf.t = 0;
    perf.frames = 0;
}

function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    watchPerformance(dt);
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    pollGamepad();
    if (G.hitstop > 0) {
        G.hitstop -= dt;
        acc = 0;
    }
    while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
    }
    Music.tick();
    draw();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.SpaceInvaders = { G, input, startGame, update, draw, applyPowerup, killBoss, menuSelect, menuMove, DIFFS, Music, shareScore, watchPerformance, multiplier, choosePerk, formationFor, PERKS, Online, MEDALS };
})();
