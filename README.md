# Space Invaders Game

A classic Space Invaders game implemented in HTML5 canvas and JavaScript with SVG-based sprites, served by a Laravel application.

## Features
- Pixel-art sprites: three invader types (30/20/10 points) with two-frame animation, a mystery UFO worth 50–300, and a classic green cannon
- Fleet marches in steps and speeds up as it thins; each wave starts faster and lower
- Invaders fire back, with destructible bunkers to hide behind
- **Boss every fifth wave**: a large saucer with a health bar that sweeps the top of the screen firing three-way volleys
- **Power-ups** dropped by dying invaders: Rapid fire (R), Spread shot (S), Piercing bolts (P), Shield (H), Bomb (B, wipes out the lowest invader in every column), extra life (L). A drop is guaranteed if you go 14 kills without one
- **Chains**: every hit within 1.8 seconds of the last extends your chain, raising the score multiplier up to x8 with NICE / GREAT / AWESOME / UNSTOPPABLE call-outs and a rising chime. Misses only cost accuracy
- **Wave tally**: clearing a wave pays out bonuses one by one for the clear, your accuracy, taking no damage and your best chain
- Score counts up in the HUD, point popups grow with the multiplier, a banner marks beating your previous best, and big moments (UFO, boss kill, bomb, death) land with a brief hit-stop
- Three lives, bonus life every 1,500 points (max 5), respawn invincibility, wave bonus
- Score popups, particle explosions, screen shake, CRT scanlines
- WebAudio sound effects (shoot, hits, the four-note march, UFO warble, boss, power-ups) with a mute toggle
- Start, pause, and game-over screens with instant restart; auto-pauses when the tab loses focus
- **Top-5 leaderboard** with three-letter initials, saved in the browser
- **Divers**: from wave 3, invaders peel off and swoop at you Galaga-style before rejoining the fleet
- **Procedural chiptune soundtrack** that speeds up as the fleet thins (toggle in the pause menu)
- Accuracy and best chain shown at game over
- **Share your score** from the game-over screen (system share sheet or clipboard)
- Muzzle flash, thruster flames and wave-clear fireworks
- **Graphics**: bevelled, glowing pixel sprites; scrolling parallax starfield over a nebula with a planet on the horizon; warp-speed star streaks between waves; additive-light explosions with sparks and shockwave rings; glowing bolts with trails; shaded bunkers; boss engine lights and damage smoke; waves slide in from the sides; CRT scanlines and vignette; sharp on high-DPI screens
- **Bloom** post-processing, invaders with glowing eyes, a detailed player ship with cockpit, lit boss windows, pixel-shatter deaths, bunker debris, shooting stars, coloured hit vignettes, and a light sweep across the title
- **Effects: High / Low** in the pause menu. Low drops bloom and sprite glow; the game switches to Low on its own if it runs below about 40 fps, unless you have picked a level yourself
- **Installable** as an app and playable offline (web manifest + service worker)
- Keyboard, gamepad and on-screen touch controls; scales to any screen; fullscreen toggle

## How to Play
- Pick **Easy / Normal / Hard** on the title screen with ← → (Easy gives four lives, slower and sparser enemy fire). Your choice and the mute setting are remembered.
- **Left/Right** arrows (or **A/D**) move; if you hold both, the last one pressed wins
- **Space** fires. Hold it to autofire; up to two bolts can be in flight, and a press made just before the next shot is ready is remembered rather than dropped
- **Enter** starts or restarts, **P** or **Esc** opens the pause menu (Resume / Restart / Sound / Quit), **M** mutes, **F** toggles fullscreen
- Gamepad: left stick or d-pad moves, A fires, Start pauses, d-pad navigates menus
- Touch: **hold and drag anywhere on the game** to move and autofire, or use the on-screen buttons; tap to start. A mouse held on the game also autofires
- Every wave and respawn starts with a short **Get Ready** countdown so you are never shot before you can react
- Clear the fleet to advance; lose a life when hit, and the game ends if the invaders reach you
- Catch falling capsules for power-ups; shoot the saucer for mystery points
- Make the top five and you will be asked for your initials
- Press **C** (or tap the Share box) on the game-over screen to share your score
- On a phone, use your browser's **Add to Home Screen** to install the game; it then works offline
- The game pauses itself when the tab is hidden or loses focus, and honours the system reduced-motion setting (no screen shake)

## Tests
```bash
php artisan test     # PHPUnit: the game page and its web-root assets
npm run test:js      # Node's built-in runner: headless gameplay tests for public_html/space-invaders.js
```

## Project Layout
This is a standard Laravel project with one difference: the web root is `public_html` instead of `public`
(registered in `bootstrap/app.php` via `usePublicPath` and in `vite.config.js` via `publicDirectory`).

- `public_html/` — web root. Point your web server's document root here. Contains `index.php`, `space-invaders.js`, `icon.svg`, `ads.txt`.
- `resources/views/game.blade.php` — the game page, served at `/`.
- `routes/web.php` — routes.

Sessions, cache and queue use the `file`/`sync` drivers by default, so no database is required to run the game.

## Running Locally
```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan serve
```
Then open http://127.0.0.1:8000.

## Customization
- Replace SVG data URLs in `public_html/space-invaders.js` with your own images for even higher quality
- Adjust game parameters for difficulty and style

---

*Graphics are currently SVG placeholders. For best results, replace with custom artwork.*
# nq-space-invaders
# nq-space-invaders

## Deployment
- `deploy.sh` runs **on the server** from the app root: `git pull`, `composer install` when the lockfile moved, cache rebuild, and a check that the game page and assets are in place.
- `cx.sh` runs **locally** and drives the server over SSH: deploy, compare what's live, caches, health check, logs, artisan, maintenance mode, commit-and-push. Copy `vars.sh.example` to `vars.sh` (gitignored) and fill in the host details, then run `./cx.sh` for the menu.
