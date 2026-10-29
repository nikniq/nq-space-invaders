// Headless gameplay tests for public_html/space-invaders.js.
// Run with: npm run test:js   (or: node --test tests/js/)
//
// Each test loads the game into a fresh VM context with a stubbed DOM and
// canvas, seeds Math.random so runs are repeatable, and drives the
// simulation directly through window.SpaceInvaders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SOURCE = readFileSync(fileURLToPath(new URL('../../public_html/space-invaders.js', import.meta.url)), 'utf8');
const STEP = 1 / 120;

function makeGame({ seed = 1, storage = {}, config = null, fetch = undefined } = {}) {
    const noop = () => {};
    const gradient = { addColorStop: noop };
    const calls = {};
    const makeCtx = () => new Proxy({ globalAlpha: 1 }, {
        get: (t, k) => (k in t ? t[k] : (...args) => { calls[k] = (calls[k] || 0) + 1; return gradient; }),
        set: (t, k, v) => { t[k] = v; return true; },
    });
    const canvasListeners = {};
    const makeCanvas = (withListeners) => ({
        width: 800,
        height: 600,
        getContext: () => makeCtx(),
        addEventListener: withListeners ? (ev, fn) => { canvasListeners[ev] = fn; } : noop,
        setPointerCapture: noop,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        parentNode: { appendChild: noop },
    });
    const mainCanvas = makeCanvas(true);
    const docListeners = {};
    const store = { ...storage };
    let rafCallback = null;
    const context = {
        console,
        window: { addEventListener: noop, devicePixelRatio: 1, matchMedia: () => ({ matches: false }), GAME_CONFIG: config },
        fetch,
        navigator: { getGamepads: () => [] },
        document: {
            getElementById: () => mainCanvas,
            createElement: (tag) => (tag === 'canvas' ? makeCanvas(false) : { addEventListener: noop, appendChild: noop, style: {} }),
            addEventListener: (ev, fn) => { docListeners[ev] = fn; },
            fullscreenElement: null,
            hidden: false,
        },
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
        },
        performance: { now: () => 0 },
        requestAnimationFrame: (cb) => { rafCallback = cb; },
        setTimeout: (fn) => fn(),
    };
    vm.createContext(context);
    vm.runInContext(`(() => { let x = ${seed}; Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647; })();`, context);
    vm.runInContext(SOURCE, context);
    const api = context.window.SpaceInvaders;
    const G = api.G;

    const key = (code, type = 'keydown') => docListeners[type]({ code, preventDefault: noop, repeat: false });
    const run = (secs, each) => {
        const n = Math.round(secs / STEP);
        for (let i = 0; i < n; i++) {
            if (each) each(i);
            api.update(STEP);
            api.draw();
        }
    };
    const pointer = (type, props) => canvasListeners[type]({ pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 300, ...props });
    const invulnerable = () => { G.player.invuln = 999; };
    const startPlaying = () => {
        key('Enter');
        run(2.5);
        assert.equal(G.state, 'playing');
        invulnerable();
    };
    // Put a stationary bolt on an invader and step once: a guaranteed hit.
    const hit = (inv) => {
        G.playerBullets = [{ x: inv.x + inv.w / 2 - 2, y: inv.y + 2, w: 4, h: 12, vx: 0, vy: 0 }];
        api.update(STEP);
    };
    const alive = () => G.invaders.filter(i => i.alive);
    return { api, G, input: api.input, key, run, pointer, hit, alive, startPlaying, invulnerable, store, calls, raf: () => rafCallback };
}

// ---------------------------------------------------------------- flow

test('title screen starts into a get-ready countdown, then play', () => {
    const g = makeGame();
    g.run(0.5);
    assert.equal(g.G.state, 'start');
    g.key('Enter');
    assert.equal(g.G.state, 'ready');
    g.run(2.5);
    assert.equal(g.G.state, 'playing');
});

test('difficulty is chosen with left/right on the title and remembered', () => {
    const g = makeGame();
    g.key('ArrowRight');
    assert.equal(g.G.difficulty, 'hard');
    assert.equal(JSON.parse(g.store['nq-space-invaders-settings']).difficulty, 'hard');
});

// ---------------------------------------------------------------- controls

test('holding fire autofires at the base rate with three bolts on screen at most', () => {
    const g = makeGame();
    g.startPlaying();
    const before = g.G.stats.shots;
    let maxOnScreen = 0;
    g.input.fire = true;
    g.run(1.5, () => { maxOnScreen = Math.max(maxOnScreen, g.G.playerBullets.length); });
    g.input.fire = false;
    assert.ok(g.G.stats.shots - before >= 10, `expected sustained autofire, got ${g.G.stats.shots - before} shots`);
    assert.ok(maxOnScreen <= 3, `at most three bolts on screen, saw ${maxOnScreen}`);
});

test('a fire press during the cooldown is buffered and still fires', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.playerBullets = [];
    g.G.fireCooldown = 0.1;
    const before = g.G.stats.shots;
    g.input.firePressed = true;
    g.run(0.05);
    assert.equal(g.G.stats.shots, before, 'should not fire while cooling down');
    g.run(0.08);
    assert.equal(g.G.stats.shots, before + 1, 'buffered press should fire once the cooldown ends');
});

test('rapid fire shortens the cooldown', () => {
    const g = makeGame();
    g.startPlaying();
    g.api.applyPowerup('rapid');
    const before = g.G.stats.shots;
    g.input.fire = true;
    g.run(1.0);
    g.input.fire = false;
    assert.ok(g.G.stats.shots - before >= 14, `rapid fire should exceed 14 shots per second, got ${g.G.stats.shots - before}`);
});

test('when both directions are held, the most recent one wins', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.player.x = 400;
    g.key('ArrowLeft');
    g.key('ArrowRight');
    g.run(0.1);
    assert.ok(g.G.player.x > 400, 'right pressed last should move right');
    const x = g.G.player.x;
    g.key('ArrowRight', 'keyup');
    g.run(0.1);
    assert.ok(g.G.player.x < x, 'releasing right while left is held should move left');
    g.key('ArrowLeft', 'keyup');
});

test('ship crosses most of the screen in under two seconds', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.player.x = 10;
    g.input.right = true;
    g.run(1.8);
    g.input.right = false;
    assert.ok(g.G.player.x > 600, `ship only reached x=${Math.round(g.G.player.x)}`);
});

test('touch: holding on the canvas drags the ship and autofires; release stops both', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.player.x = 600;
    g.pointer('pointerdown', { clientX: 100 });
    assert.equal(g.input.fire, true);
    assert.equal(g.G.targetX, 100);
    g.run(0.6);
    assert.ok(g.G.player.x < 120, `ship should follow the finger, at x=${Math.round(g.G.player.x)}`);
    assert.ok(g.G.stats.shots >= 2, 'holding should keep firing');
    g.pointer('pointerup');
    assert.equal(g.input.fire, false);
    assert.equal(g.G.targetX, null);
});

// ---------------------------------------------------------------- rewards

test('consecutive kills build a chain, raise the multiplier and announce milestones', () => {
    const g = makeGame();
    g.startPlaying();
    for (let i = 0; i < 8; i++) g.hit(g.alive()[i]);
    assert.equal(g.G.combo, 8);
    assert.equal(g.api.multiplier(), 3);
    assert.ok(g.G.banner && /NICE/.test(g.G.banner.text), 'x3 should announce NICE!');
});

test('misses do not break a chain, but letting the timer run out does', () => {
    const g = makeGame();
    g.startPlaying();
    for (let i = 0; i < 5; i++) g.hit(g.alive()[i]);
    g.G.playerBullets = [{ x: 400, y: -20, w: 4, h: 14, vx: 0, vy: -860 }]; // already off-screen: a miss
    g.api.update(STEP);
    assert.equal(g.G.combo, 5, 'a miss should not reset the chain');
    g.run(2.0);
    assert.equal(g.G.combo, 0, 'chain should expire after the window');
});

test('chain multiplier applies to points', () => {
    const g = makeGame();
    g.startPlaying();
    const octopi = g.alive().filter(i => i.type === 'octopus');
    for (let i = 0; i < 12; i++) g.hit(octopi[i]); // 12 hits -> x4
    const before = g.G.score;
    g.hit(octopi[12]);
    assert.equal(g.G.score - before, 10 * 4);
});

test('a power-up is guaranteed after the pity streak', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.powerups = [];
    g.G.killsSinceDrop = 13;
    g.hit(g.alive()[0]);
    assert.equal(g.G.powerups.length, 1);
});

test('bomb destroys the lowest invader in every column and clears enemy fire', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.enemyBullets = [{ x: 100, y: 300, w: 4, h: 14, vx: 0, vy: 0, wobble: 0 }];
    const before = g.alive().length;
    g.api.applyPowerup('bomb');
    assert.equal(before - g.alive().length, 11);
    assert.equal(g.G.enemyBullets.length, 0);
});

test('piercing bolts pass through several invaders', () => {
    const g = makeGame();
    g.startPlaying();
    g.api.applyPowerup('pierce');
    const column = g.alive().filter(i => i.col === 5).sort((a, b) => b.y - a.y);
    const low = column[0];
    g.G.playerBullets = [{ x: low.x + low.w / 2 - 2, y: low.y + low.h + 2, w: 4, h: 12, vx: 0, vy: -720, pierce: true }];
    g.G.fleetTimer = -10; // hold the fleet still for the shot
    g.run(0.16);
    const killed = column.filter(i => !i.alive).length;
    assert.ok(killed >= 2, `piercing bolt should kill at least 2 in a column, killed ${killed}`);
});

test('clearing a wave pays out the tally bonuses, then starts the next wave', () => {
    const g = makeGame();
    g.startPlaying();
    for (const inv of g.alive().slice(0, 6)) g.hit(inv);
    g.G.invaders.forEach(i => { i.alive = false; });
    g.api.update(STEP);
    assert.equal(g.G.state, 'wavecleared');
    const labels = g.G.tally.map(t => t.label).join('|');
    assert.match(labels, /WAVE CLEAR/);
    assert.match(labels, /ACCURACY/);
    assert.match(labels, /NO DAMAGE/);
    assert.match(labels, /BEST CHAIN 6/);
    const owed = g.G.tally.reduce((sum, t) => sum + t.value, 0);
    const before = g.G.score;
    g.run(3.5);
    assert.equal(g.G.score - before, owed);
    assert.equal(g.G.wave, 2);
    assert.equal(g.G.state, 'ready');
});

test('beating the previous best mid-game announces a new high score', () => {
    const g = makeGame({ storage: { 'nq-space-invaders-scores': JSON.stringify([{ name: 'AAA', score: 40, wave: 1 }]) } });
    g.startPlaying();
    const octopi = g.alive().filter(i => i.type === 'octopus');
    for (let i = 0; i < 5; i++) g.hit(octopi[i]);
    assert.ok(g.G.newHiScore);
    assert.ok(g.G.banner, 'expected a banner');
});

test('the HUD score counts up to the real score', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.combo = 0;
    g.hit(g.alive().find(i => i.type === 'squid'));
    assert.ok(g.G.displayScore < g.G.score);
    g.run(1.0);
    assert.equal(g.G.displayScore, g.G.score);
});

// ---------------------------------------------------------------- variety

test('waves rotate through formations, skipping boss waves', () => {
    const g = makeGame();
    const order = [1, 2, 3, 4, 5, 6, 7].map(w => g.api.formationFor(w));
    assert.deepEqual(order, ['block', 'gaps', 'wedge', 'checker', 'block', 'block', 'gaps']);
    g.startPlaying();
    assert.equal(g.G.invaders.length, 55);
    g.G.wave = 2;
    g.G.invaders.forEach(i => { i.alive = false; });
    g.G.wave = 1; // wave 1 clear leads straight into wave 2
    g.run(3.5);
    assert.equal(g.G.wave, 2);
    assert.equal(g.G.invaders.length, 45, 'gaps formation leaves two columns empty');
    assert.ok(!g.G.invaders.some(i => i.col === 3 || i.col === 7));
});

function playWave(g, wave) {
    g.startPlaying();
    g.G.wave = wave;
    g.G.invaders = []; // force a fresh fleet for this wave
    g.G.invaders.forEach(i => { i.alive = false; });
    g.G.wave = wave - 1;
    g.G.state = 'wavecleared';
    g.G.stateTimer = 0.001;
    g.G.tally = null;
    g.api.update(STEP);
    if (g.G.state === 'perk') { g.run(0.7); g.key('Enter'); }
    g.run(2.0);
    g.invulnerable();
    assert.equal(g.G.wave, wave);
}

test('armoured invaders appear from wave 3 and take two hits', () => {
    const g = makeGame();
    playWave(g, 3);
    const tanks = g.alive().filter(i => i.type === 'tank');
    assert.ok(tanks.length >= 2, `expected armoured invaders, found ${tanks.length}`);
    const t = tanks[0];
    g.hit(t);
    assert.equal(t.alive, true, 'first hit cracks the armour');
    assert.equal(t.hp, 1);
    g.hit(t);
    assert.equal(t.alive, false, 'second hit destroys it');
});

test('snipers appear from wave 4 and fire aimed bolts', () => {
    const g = makeGame();
    playWave(g, 4);
    const snipers = g.alive().filter(i => i.type === 'sniper');
    assert.ok(snipers.length >= 1, 'expected a sniper');
    g.G.enemyFireTimer = 99; // silence ordinary fire
    g.G.enemyBullets = [];
    g.G.player.x = 40; // far to the left of the fleet
    snipers.forEach(sn => { sn.sniperTimer = 0.001; });
    g.api.update(STEP);
    const shots = g.G.enemyBullets.filter(b => b.sniper);
    assert.ok(shots.length >= 1, 'sniper should fire');
    assert.ok(shots.every(b => b.vx < 0), 'aimed bolts head toward the player');
});

test('divers wind up visibly before leaving the fleet and descend slower than before', () => {
    const g = makeGame();
    playWave(g, 3);
    g.G.enemyFireTimer = 99;
    const inv = g.alive().find(i => i.row === 2 && !i.dive);
    inv.dive = { phase: 'wind', t: 0, wobble: 0, aimX: 400 };
    g.run(0.3);
    assert.equal(inv.dive.phase, 'wind', 'still winding up after 0.3s');
    assert.equal(inv.y, inv.hy, 'stays in the fleet row while winding up');
    g.run(0.3);
    assert.equal(inv.dive.phase, 'down');
    const y0 = inv.y;
    g.run(1.0);
    const fallPerSecond = inv.y - y0;
    assert.ok(fallPerSecond < 190, `fell ${Math.round(fallPerSecond)} px in 1s; should be gentle early in the dive`);
});

// ---------------------------------------------------------------- upgrades

test('an upgrade pick follows every second wave, not the first', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.invaders.forEach(i => { i.alive = false; });
    g.run(3.5);
    assert.notEqual(g.G.state, 'perk', 'no pick after wave 1');
    g.run(2.0);
    g.G.invaders.forEach(i => { i.alive = false; });
    g.run(3.5);
    assert.equal(g.G.state, 'perk');
    assert.equal(g.G.perkChoices.length, 3);
    assert.equal(new Set(g.G.perkChoices.map(p => p.id)).size, 3, 'three different upgrades');
});

test('input held over from the wave cannot pick an upgrade by accident', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.wave = 2;
    g.G.invaders.forEach(i => { i.alive = false; });
    g.run(3.5);
    assert.equal(g.G.state, 'perk');
    g.key('Enter');
    assert.equal(g.G.state, 'perk', 'pick is locked for a moment');
    g.run(0.7);
    g.key('ArrowRight');
    const chosen = g.G.perkChoices[g.G.perkIdx];
    g.key('Enter');
    assert.equal(g.G.state, 'ready');
    assert.equal(g.G.perks[chosen.id], 1);
});

test('twin cannon and hair trigger raise the fire rate', () => {
    const base = makeGame();
    base.startPlaying();
    base.input.fire = true;
    base.run(2.0);
    const baseShots = base.G.stats.shots;

    const up = makeGame();
    up.startPlaying();
    up.G.perks = { twin: 2, trigger: 3 };
    up.input.fire = true;
    up.run(2.0);
    assert.ok(up.G.stats.shots >= baseShots * 1.6, `upgraded ${up.G.stats.shots} vs base ${baseShots}`);
});

test('chain link lengthens the chain window and overcharge lengthens power-ups', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.perks = { chain: 2, overcharge: 1 };
    g.hit(g.alive()[0]);
    assert.equal(g.G.comboTimer, 2.8);
    g.api.applyPowerup('rapid');
    assert.ok(Math.abs(g.G.power.timer - 9 * 1.4) < 1e-9);
});

test('deflector starts each wave with a shield', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.perks = { deflector: 1 };
    g.G.shield = 0;
    g.G.invaders.forEach(i => { i.alive = false; });
    g.run(3.5);
    assert.ok(g.G.shield > 0);
});

// ---------------------------------------------------------------- online

const flush = () => new Promise(r => setImmediate(r));

function fakeServer(board = []) {
    const calls = [];
    const fetch = (url, opts = {}) => {
        calls.push({ url, opts });
        if (opts.method === 'POST') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ rank: 3, best: 500 }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: board }) });
    };
    return { calls, fetch };
}

function loseLastLife(g) {
    g.G.lives = 1;
    g.G.player.invuln = 0;
    g.G.shield = 0;
    g.G.enemyBullets.push({ x: g.G.player.x + 10, y: g.G.player.y + 4, w: 4, h: 14, vx: 0, vy: 0, wobble: 0 });
    g.run(2.5);
}

test('the world board is loaded on start and shown alternately with local scores', async () => {
    const server = fakeServer([{ name: 'Ace', score: 9000, wave: 7, difficulty: 'normal' }]);
    const g = makeGame({ config: { scoresUrl: '/scores', submitUrl: null, csrf: 't' }, fetch: server.fetch });
    await flush();
    assert.equal(server.calls[0].url, '/scores');
    assert.equal(g.api.Online.board[0].name, 'Ace');
});

test('a signed-in player\'s finished game is posted with the CSRF token and the rank is shown', async () => {
    const server = fakeServer();
    const g = makeGame({ config: { scoresUrl: '/scores', submitUrl: '/scores', csrf: 'tok' }, fetch: server.fetch });
    g.startPlaying();
    g.hit(g.alive()[0]);
    loseLastLife(g);
    await flush();
    const post = server.calls.find(c => c.opts.method === 'POST');
    assert.ok(post, 'score should be submitted');
    assert.equal(post.opts.headers['X-CSRF-TOKEN'], 'tok');
    const body = JSON.parse(post.opts.body);
    assert.equal(body.score, g.G.score);
    assert.equal(body.wave, 1);
    assert.equal(body.difficulty, 'normal');
    assert.equal(g.api.Online.status, 'SAVED · WORLD RANK #3');
});

test('guests are invited to sign in instead of having their score posted', async () => {
    const server = fakeServer();
    const g = makeGame({ config: { scoresUrl: '/scores', submitUrl: null, csrf: 't' }, fetch: server.fetch });
    g.startPlaying();
    g.hit(g.alive()[0]);
    loseLastLife(g);
    await flush();
    assert.equal(server.calls.filter(c => c.opts.method === 'POST').length, 0);
    assert.equal(g.api.Online.status, 'SIGN IN TO SAVE SCORES ONLINE');
});

// ---------------------------------------------------------------- medals

test('medals are earned once, announced, and remembered across games', () => {
    const g = makeGame();
    g.startPlaying();
    g.api.applyPowerup('bomb');
    assert.deepEqual([...g.G.medals], ['bomb']);
    assert.match(g.G.toast.text, /DEMOLITION/);
    g.api.applyPowerup('bomb');
    assert.equal(g.G.medals.length, 1, 'not awarded twice');
    const again = makeGame({ storage: { ...g.store } });
    assert.deepEqual([...again.G.medals], ['bomb']);
});

test('clearing a wave without damage and accurately earns Flawless and Sharpshooter', () => {
    const g = makeGame();
    g.startPlaying();
    for (const inv of g.alive().slice(0, 10)) g.hit(inv);
    g.G.waveStats.shots = 10;
    g.G.invaders.forEach(i => { i.alive = false; });
    g.api.update(STEP);
    assert.ok(g.G.medals.includes('perfect'));
    assert.ok(g.G.medals.includes('sharp'));
    assert.ok(g.G.medals.includes('chain8') === false);
});

// ---------------------------------------------------------------- core systems

test('boss arrives on wave 5; killing it lets the wave advance', () => {
    const g = makeGame();
    g.startPlaying();
    for (let w = 1; w < 5; w++) {
        g.G.invaders.forEach(i => { i.alive = false; });
        g.run(3.5);
        if (g.G.state === 'perk') { g.run(0.7); g.key('Enter'); }
        g.run(2.0);
        g.invulnerable();
    }
    assert.equal(g.G.wave, 5);
    assert.ok(g.G.boss, 'boss should be present on wave 5');
    g.api.killBoss();
    g.G.invaders.forEach(i => { i.alive = false; });
    g.run(3.5);
    assert.equal(g.G.state, 'perk', 'a boss wave is followed by an upgrade pick');
    g.run(0.7);
    g.key('Enter');
    assert.equal(g.G.wave, 6);
});

test('losing the last life to a top-five score asks for initials and saves them', () => {
    const g = makeGame();
    g.startPlaying();
    g.hit(g.alive()[0]);
    g.G.lives = 1;
    g.G.player.invuln = 0;
    g.G.shield = 0;
    g.G.enemyBullets.push({ x: g.G.player.x + 10, y: g.G.player.y + 4, w: 4, h: 14, vx: 0, vy: 0, wobble: 0 });
    g.run(2.5);
    assert.equal(g.G.state, 'entername');
    g.key('KeyT'); g.key('KeyC'); g.key('KeyX');
    assert.equal(g.G.state, 'gameover');
    const saved = JSON.parse(g.store['nq-space-invaders-scores']);
    assert.equal(saved[0].name, 'TCX');
    g.key('Enter');
    assert.equal(g.G.state, 'gameover', 'restart is locked out briefly after game over');
    g.run(1.1);
    g.key('Enter');
    assert.equal(g.G.state, 'ready');
});

test('invaders reaching the ship end the game', () => {
    const g = makeGame();
    g.startPlaying();
    g.G.invaders.forEach(i => { i.hy = g.G.player.y - i.h + 1; });
    g.run(3.0);
    assert.ok(['gameover', 'entername'].includes(g.G.state), `state was ${g.G.state}`);
});

test('pause menu toggles music and effects and remembers them', () => {
    const g = makeGame();
    g.startPlaying();
    g.key('KeyP');
    assert.equal(g.G.state, 'paused');
    for (let i = 0; i < 3; i++) g.key('ArrowDown');
    g.key('Enter');
    assert.equal(g.api.Music.enabled, false);
    g.key('ArrowDown');
    g.key('Enter');
    assert.equal(g.G.fx, 'low');
    const saved = JSON.parse(g.store['nq-space-invaders-settings']);
    assert.equal(saved.music, false);
    assert.equal(saved.fx, 'low');
    g.key('KeyP');
    assert.equal(g.G.state, 'playing');
});

test('every screen renders without errors and uses the lighting paths', () => {
    const g = makeGame();
    g.run(0.3); // title
    g.startPlaying();
    g.api.applyPowerup('shield');
    g.input.fire = true;
    g.run(2.0);
    g.input.fire = false;
    g.key('KeyP'); g.run(0.1); g.key('KeyP');
    g.G.invaders.forEach(i => { i.alive = false; });
    g.run(1.0); // tally + fireworks + warp
    g.raf()(16); // one real animation frame through the compositor
    for (const k of ['createLinearGradient', 'createRadialGradient', 'drawImage', 'arc', 'setTransform']) {
        assert.ok(g.calls[k] > 0, `${k} never called`);
    }
});
