# Space Invaders Game

A classic Space Invaders game implemented in HTML5 canvas and JavaScript with SVG-based sprites, served by a Laravel application.

## Features
- Pixel-art sprites: three invader types (30/20/10 points) with two-frame animation, a mystery UFO worth 50–300, and a classic green cannon
- Fleet marches in steps and speeds up as it thins; each wave starts faster and lower
- Invaders fire back, with destructible bunkers to hide behind
- Three lives, wave bonus, score popups, particle explosions and screen shake
- WebAudio sound effects (shoot, hits, the four-note march, UFO warble) with a mute toggle
- Start, pause, and game-over screens with instant restart; auto-pauses when the tab loses focus
- High score saved in the browser
- Scales to any screen; on-screen touch controls on phones and tablets

## How to Play
- **Left/Right** arrows (or **A/D**) move, **Space** fires
- **Enter** starts or restarts, **P** or **Esc** pauses, **M** mutes
- On touch devices use the on-screen buttons; tap the game to start
- Clear the fleet to advance; lose a life when hit, and the game ends if the invaders reach you

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
