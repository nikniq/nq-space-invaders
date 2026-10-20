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

function makeGame({ seed = 1, storage = {} } = {}) {
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
        window: { addEventListener: noop, devicePixelRatio: 1, matchMedia: () => ({ matches: false }) },
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

test('holding fire autofires at the base rate with two bolts on screen at most', () => {
    const g = makeGame();
    g.startPlaying();
    const before = g.G.stats.shots;
    let maxOnScreen = 0;
    g.input.fire = true;
    g.run(1.5, () => { maxOnScreen = Math.max(maxOnScreen, g.G.playerBullets.length); });
    g.input.fire = false;
    assert.ok(g.G.stats.shots - before >= 5, `expected sustained autofire, got ${g.G.stats.shots - before} shots`);
    assert.ok(maxOnScreen <= 2, `at most two bolts on screen, saw ${maxOnScreen}`);
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
    assert.ok(g.G.stats.shots - before >= 9, `rapid fire should exceed 9 shots per second, got ${g.G.stats.shots - before}`);
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
    g.G.playerBullets = [{ x: 400, y: -20, w: 4, h: 12, vx: 0, vy: -720 }]; // already off-screen: a miss
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

// ---------------------------------------------------------------- core systems

test('boss arrives on wave 5; killing it lets the wave advance', () => {
    const g = makeGame();
    g.startPlaying();
    for (let w = 1; w < 5; w++) {
        g.G.invaders.forEach(i => { i.alive = false; });
        g.run(3.5);
        g.run(2.0);
        g.invulnerable();
    }
    assert.equal(g.G.wave, 5);
    assert.ok(g.G.boss, 'boss should be present on wave 5');
    g.api.killBoss();
    g.G.invaders.forEach(i => { i.alive = false; });
    g.run(3.5);
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
