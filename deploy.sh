#!/usr/bin/env bash
#
# Production deploy. Run ON the server, from the app root:
#
#   ./deploy.sh
#
# Steps: git pull -> composer install (only when composer.lock moved)
#        -> rebuild config/route/view caches -> verify the game page.
#
# There is no database, no migrations and no seeders in this project, so
# the sequence is deliberately short. The web root is public_html/, which
# bootstrap/app.php registers via usePublicPath.

set -euo pipefail
cd "$(dirname "$0")"

echo "→ git pull"
LOCK_BEFORE=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)
git pull --ff-only
LOCK_AFTER=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)

if [ "$LOCK_BEFORE" != "$LOCK_AFTER" ] || [ ! -d vendor ]; then
    if command -v composer >/dev/null 2>&1; then
        echo "→ composer install"
        composer install --no-dev --optimize-autoloader --no-interaction
    else
        echo "⚠ composer.lock changed (or vendor/ missing) but composer is not on PATH."
        echo "  Install dependencies manually before trusting this deploy."
    fi
fi

if [ ! -f .env ]; then
    echo "⚠ No .env on the server. Copy .env.example to .env, set APP_URL and run:"
    echo "    php artisan key:generate"
    exit 1
fi

echo "→ storage permissions"
mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

echo "→ cache config/routes/views"
php artisan optimize

echo "→ verify"
php artisan route:list --path=/ --columns=method,uri,name
for f in index.php space-invaders.js icon.svg ads.txt; do
    [ -f "public_html/$f" ] && echo "  ✓ public_html/$f" || { echo "  ✗ public_html/$f missing"; exit 1; }
done

echo "✓ deployed $(git log --oneline -1)"
