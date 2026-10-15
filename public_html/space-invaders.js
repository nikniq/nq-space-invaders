// Space Invaders Game - High Quality Graphics
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Assets (placeholder, should be replaced with real images for best quality)
const playerImg = new Image();
playerImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="10" y="30" width="20" height="10" fill="lime"/><rect x="0" y="20" width="40" height="10" fill="lime"/><rect x="15" y="10" width="10" height="10" fill="lime"/></svg>';

const invaderImg = new Image();
invaderImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><ellipse cx="15" cy="10" rx="13" ry="8" fill="red"/><rect x="5" y="15" width="20" height="5" fill="red"/></svg>';

const bulletColor = '#0ff';

// Game objects
let player = { x: WIDTH/2-20, y: HEIGHT-60, w: 40, h: 40, speed: 7 };
let bullets = [];
let invaders = [];
let invaderRows = 5;
let invaderCols = 10;
let invaderDir = 1;
let invaderSpeed = 1.5;
let score = 0;
let gameOver = false;

function createInvaders() {
    invaders = [];
    for (let r = 0; r < invaderRows; r++) {
        for (let c = 0; c < invaderCols; c++) {
            invaders.push({
                x: 60 + c * 60,
                y: 40 + r * 40,
                w: 30,
                h: 20,
                alive: true
            });
        }
    }
}
createInvaders();

// Controls
let keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

function shoot() {
    bullets.push({ x: player.x + player.w/2 - 3, y: player.y, w: 6, h: 16, speed: 8 });
}

// Main game loop
function update() {
    if (gameOver) return;
    // Player movement
    if (keys['ArrowLeft'] && player.x > 0) player.x -= player.speed;
    if (keys['ArrowRight'] && player.x < WIDTH - player.w) player.x += player.speed;
    if (keys['Space']) {
        if (!player.shooting) {
            shoot();
            player.shooting = true;
        }
    } else {
        player.shooting = false;
    }

    // Bullets
    for (let b of bullets) b.y -= b.speed;
    bullets = bullets.filter(b => b.y + b.h > 0);

    // Invaders movement
    let edge = false;
    for (let inv of invaders) {
        if (!inv.alive) continue;
        inv.x += invaderDir * invaderSpeed;
        if (inv.x < 0 || inv.x + inv.w > WIDTH) edge = true;
    }
    if (edge) {
        invaderDir *= -1;
        for (let inv of invaders) {
            inv.y += 20;
        }
    }

    // Collision detection
    for (let b of bullets) {
        for (let inv of invaders) {
            if (inv.alive && b.x < inv.x + inv.w && b.x + b.w > inv.x && b.y < inv.y + inv.h && b.y + b.h > inv.y) {
                inv.alive = false;
                b.y = -100;
                score += 10;
            }
        }
    }

    // Game over check
    for (let inv of invaders) {
        if (inv.alive && inv.y + inv.h >= player.y) {
            gameOver = true;
        }
    }
    if (invaders.every(inv => !inv.alive)) {
        createInvaders();
        invaderSpeed += 0.5;
    }
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Draw player
    ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
    // Draw bullets
    for (let b of bullets) {
        ctx.fillStyle = bulletColor;
        ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    // Draw invaders
    for (let inv of invaders) {
        if (inv.alive) ctx.drawImage(invaderImg, inv.x, inv.y, inv.w, inv.h);
    }
    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText('Score: ' + score, 20, 30);
    // Game over
    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, HEIGHT/2-60, WIDTH, 120);
        ctx.fillStyle = '#fff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', WIDTH/2, HEIGHT/2);
        ctx.font = '24px Arial';
        ctx.fillText('Refresh to play again', WIDTH/2, HEIGHT/2+40);
        ctx.textAlign = 'left';
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
loop();
