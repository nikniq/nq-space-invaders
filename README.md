# Space Invaders Game

A classic Space Invaders game implemented in HTML5 canvas and JavaScript with SVG-based sprites, served by a Laravel application.

## Features
- Pixel-art sprites: three invader types (30/20/10 points) with two-frame animation, a mystery UFO worth 50–300, and a classic green cannon
- Fleet marches in steps and speeds up as it thins; each wave starts faster and lower
- Invaders fire back, with destructible bunkers to hide behind
- **Formations** rotate each wave: block, gapped columns, wedge and checkerboard
- **Armoured invaders** (from wave 3) crack on the first hit and break on the second; **snipers** (from wave 4) glow for half a second, then fire a fast bolt aimed at you
- **Upgrades** after every second wave and every boss: pick one of three (Twin Cannon, Hair Trigger, Chain Link, Overcharge, Tractor Beam, Deflector, Thrusters, Lucky Star, Bounty Hunter, Spare Ship). They stack for the rest of the run and show as badges at the bottom of the screen
- **Medals**: ten one-time achievements (UFO Hunter, Demolition, Flawless, Sharpshooter, Unstoppable, Giant Slayer, Upgraded, 10K Club, Veteran, Hardcore), announced when earned, listed on the game-over screen and counted on the title screen; kept in your browser
- **Boss every fifth wave**, alternating between the Saucer (aimed three-way volleys) and the purple Carrier (slower, launches diving minions). At half health either boss enrages: it glows red, moves faster and adds a radial bullet burst every few seconds
- **Power-ups** dropped by dying invaders: Rapid fire (R), Spread shot (S), Piercing bolts (P), Shield (H), Bomb (B, wipes out the lowest invader in every column), extra life (L). A drop is guaranteed if you go 14 kills without one
- **Chains**: every hit within 1.8 seconds of the last extends your chain, raising the score multiplier up to x8 with NICE / GREAT / AWESOME / UNSTOPPABLE call-outs and a rising chime. Misses only cost accuracy
- **Wave tally**: clearing a wave pays out bonuses one by one for the clear, your accuracy, taking no damage and your best chain
- Score counts up in the HUD, point popups grow with the multiplier, a banner marks beating your previous best, and big moments (UFO, boss kill, bomb, death) land with a brief hit-stop
- Three lives, bonus life every 1,500 points (max 5), respawn invincibility, wave bonus
- Score popups, particle explosions, screen shake, CRT scanlines
- WebAudio sound effects (shoot, hits, the four-note march, UFO warble, boss, power-ups) with a mute toggle
- Start, pause, and game-over screens with instant restart; auto-pauses when the tab loses focus
- **Top-5 leaderboard** with three-letter initials, saved in the browser
- **Divers**: from wave 3, invaders shake and flash white for half a second, then swoop at you Galaga-style before rejoining the fleet. They aim at where you were when they left, so a sidestep works
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
- **Space** fires. Hold it to autofire at about eight shots a second; up to three bolts can be in flight, and a press made just before the next shot is ready is remembered rather than dropped
- **Enter** starts or restarts, **P** or **Esc** opens the pause menu (Resume / Restart / Sound / Quit), **M** mutes, **F** toggles fullscreen
- Gamepad: left stick or d-pad moves, A fires, Start pauses, d-pad navigates menus
- Touch: **hold and drag anywhere on the game** to move and autofire, or use the on-screen buttons; tap to start. A mouse held on the game also autofires
- Every wave and respawn starts with a short **Get Ready** countdown so you are never shot before you can react
- Clear the fleet to advance; lose a life when hit, and the game ends if the invaders reach you
- Catch falling capsules for power-ups; shoot the saucer for mystery points
- Make the top five and you will be asked for your initials
- On the upgrade screen use ← → or 1-3 and Enter, tap a card, or use the d-pad and A
- Press **C** (or tap the Share box) on the game-over screen to share your score
- On a phone, use your browser's **Add to Home Screen** to install the game; it then works offline
- The game pauses itself when the tab is hidden or loses focus, and honours the system reduced-motion setting (no screen shake)

## Accounts
Playing never requires an account. Signed-in players' finished games are saved to a **world leaderboard**, shown on the title and game-over screens alternately with your own browser's top five, along with your world rank after each game. Guests see a prompt to sign in.

- **Email link (default).** Enter an email on `/register` or `/login` and a signed, single-use link is emailed. The account is created only when the link is confirmed, so every account has a verified address. New accounts have **no password**; after confirming you are offered the chance to set one, or you can keep using email links.
- **Google.** Shown when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`. Create an OAuth client in the Google Cloud console with the authorised redirect URI `{APP_URL}/auth/google/callback`. A Google account is linked to an existing email account only when Google reports the address as verified.
- **Password.** Optional, set or changed at `/account/password`. Password sign-in is available once one is set.
- Links expire after 60 minutes and work once. Link requests are limited to 3 per address per minute and 30 per IP per hour; password attempts to 5 per minute.
- The app needs a database for accounts. The default is SQLite: `touch database/database.sqlite && php artisan migrate`. Mail defaults to the `log` driver locally, so the link appears in `storage/logs/laravel.log`; set `MAIL_*` for real delivery.

## Tests
```bash
php artisan test     # PHPUnit: accounts (email links, Google, passwords, sessions), the game page and its assets
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
touch database/database.sqlite && php artisan migrate
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
