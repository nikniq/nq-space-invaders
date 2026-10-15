# Space Invaders Game

A classic Space Invaders game implemented in HTML5 canvas and JavaScript with SVG-based sprites, served by a Laravel application.

## Features
- Pixel-art sprites: three invader types (30/20/10 points) with two-frame animation, a mystery UFO worth 50–300, and a classic green cannon
- Fleet marches in steps and speeds up as it thins; each wave starts faster and lower
- Invaders fire back, with destructible bunkers to hide behind
- **Boss every fifth wave**: a large saucer with a health bar that sweeps the top of the screen firing three-way volleys
- **Power-ups** dropped by dying invaders: Rapid fire (R), Spread shot (S), Shield (H), extra life (L)
- **Combo multiplier** up to x4 for consecutive hits; missing a shot resets it
- Three lives, bonus life every 1,500 points (max 5), respawn invincibility, wave bonus
- Score popups, particle explosions, screen shake, CRT scanlines
- WebAudio sound effects (shoot, hits, the four-note march, UFO warble, boss, power-ups) with a mute toggle
- Start, pause, and game-over screens with instant restart; auto-pauses when the tab loses focus
- **Top-5 leaderboard** with three-letter initials, saved in the browser
- **Divers**: from wave 3, invaders peel off and swoop at you Galaga-style before rejoining the fleet
- **Procedural chiptune soundtrack** that speeds up as the fleet thins (toggle in the pause menu)
- **Perfect wave** bonus for clearing a wave without losing a life; accuracy and best combo shown at game over
- **Share your score** from the game-over screen (system share sheet or clipboard)
- Muzzle flash, thruster flames and wave-clear fireworks
- **Installable** as an app and playable offline (web manifest + service worker)
- Keyboard, gamepad and on-screen touch controls; scales to any screen; fullscreen toggle

## How to Play
- Pick **Easy / Normal / Hard** on the title screen with ← → (Easy gives four lives, slower and sparser enemy fire). Your choice and the mute setting are remembered.
- **Left/Right** arrows (or **A/D**) move, **Space** fires (hold for autofire with Rapid)
- **Enter** starts or restarts, **P** or **Esc** opens the pause menu (Resume / Restart / Sound / Quit), **M** mutes, **F** toggles fullscreen
- Gamepad: left stick or d-pad moves, A fires, Start pauses, d-pad navigates menus
- Touch: **drag anywhere on the game to move** and tap to fire, or use the on-screen buttons; tap to start
- Every wave and respawn starts with a short **Get Ready** countdown so you are never shot before you can react
- Clear the fleet to advance; lose a life when hit, and the game ends if the invaders reach you
- Catch falling capsules for power-ups; shoot the saucer for mystery points
- Make the top five and you will be asked for your initials
- Press **C** (or tap the Share box) on the game-over screen to share your score
- On a phone, use your browser's **Add to Home Screen** to install the game; it then works offline
- The game pauses itself when the tab is hidden or loses focus, and honours the system reduced-motion setting (no screen shake)

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
