    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const W = 480, H = 700;
    const KILLS_PER_POWERUP = 15;

    let state = 'menu';
    let score = 0, lives = 3, level = 1;
    let player, bullets, enemies, particles, stars, powerUps;
    let frameCount = 0, enemyTimer = 0;
    let shootCooldown = 0;
    let eBullets = [];
    let killCount = 0;
    let powerShotTimer = 0;

    // Mouse/Touch state
    const mouse = { x: W / 2, y: H - 80, down: false };

    // Position (Maus oder Touch) relativ zur tatsächlichen Canvas-Zeichenfläche
    // umrechnen, da der Canvas per CSS skaliert dargestellt wird (Mobile).
    const wrapper = document.getElementById('gameWrapper');

    function updatePointerPosition(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    mouse.x = Math.max(0, Math.min(W, (clientX - rect.left) * scaleX));
    mouse.y = Math.max(0, Math.min(H, (clientY - rect.top) * scaleY));
    }

    // Maus-Events (Desktop)
    wrapper.addEventListener('mousemove', e => updatePointerPosition(e.clientX, e.clientY));
    wrapper.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
    wrapper.addEventListener('mouseup',   e => { if (e.button === 0) mouse.down = false; });
    wrapper.addEventListener('mouseleave', () => { mouse.down = false; });

    // Touch-Events (Mobile)
    wrapper.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    updatePointerPosition(t.clientX, t.clientY);
    mouse.down = true;
    }, { passive: false });

    wrapper.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    updatePointerPosition(t.clientX, t.clientY);
    }, { passive: false });

    wrapper.addEventListener('touchend', e => {
    e.preventDefault();
    mouse.down = false;
    }, { passive: false });

    // Prevent context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    document.getElementById('startBtn').addEventListener('click', startGame);

    // ─── Stars ───────────────────────────────────────
    function initStars() {
    stars = Array.from({length: 130}, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.8 + 0.2
    }));
    }

    // ─── Game start ──────────────────────────────────
    function startGame() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('finalScore').style.display = 'none';
    score = 0; lives = 3; level = 1; frameCount = 0; enemyTimer = 0;
    killCount = 0; powerShotTimer = 0;
    player = { x: W/2, y: H - 80, w: 36, h: 46, invincible: 0, shieldCharges: 0 };
    bullets = []; enemies = []; particles = []; eBullets = []; powerUps = [];
    initStars();
    updateUI();
    state = 'playing';
    loop();
    }

    function gameOver() {
    state = 'gameover';
    const ov = document.getElementById('overlay');
    ov.classList.remove('hidden');
    ov.querySelector('h1').textContent = score > 500 ? 'GUT GEMACHT!' : 'GAME OVER';
    const fs = document.getElementById('finalScore');
    fs.style.display = 'block';
    fs.textContent = 'SCORE: ' + score;
    document.getElementById('startBtn').textContent = 'NOCHMAL';
    }

    function updateUI() {
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('levelDisplay').textContent = level;
    const ld = document.getElementById('lives-display');
    ld.innerHTML = '';
    for (let i = 0; i < lives; i++) ld.innerHTML += '<span class="heart">♦</span>';

    const sd = document.getElementById('statusDisplay');
    sd.innerHTML = '';
    if (player && player.shieldCharges > 0) {
        sd.innerHTML += `<span class="status-icon" style="color:#0f8">🛡️×${player.shieldCharges}</span>`;
    }
    if (powerShotTimer > 0) {
        sd.innerHTML += `<span class="status-icon" style="color:#ff0">⚡</span>`;
    }
    }

    // ─── Particles ───────────────────────────────────
    function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const speed = Math.random() * 4 + 1;
        particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: Math.random() * 0.03 + 0.02,
        r: Math.random() * 3 + 1,
        color
        });
    }
    }

    // ─── Enemies ─────────────────────────────────────
    function spawnEnemy() {
    const type = Math.random();
    const x = Math.random() * (W - 60) + 30;
    if (type < 0.6) {
        enemies.push({ x, y: -30, w: 30, h: 24, hp: 1, maxHp: 1, type: 'basic',
        vy: 1.5 + level * 0.3, vx: (Math.random() - 0.5) * 1.5,
        color: '#f05', glowColor: '#f05' });
    } else if (type < 0.85) {
        enemies.push({ x, y: -30, w: 28, h: 22, hp: 2, maxHp: 2, type: 'zigzag',
        vy: 1.2 + level * 0.2, vx: 2, phase: 0,
        color: '#f80', glowColor: '#fa0' });
    } else {
        enemies.push({ x, y: -30, w: 40, h: 32, hp: 4, maxHp: 4, type: 'tank',
        vy: 0.8 + level * 0.15, vx: (Math.random() - 0.5) * 0.8,
        color: '#80f', glowColor: '#a0f' });
    }
    }

    function enemyShoot(e) {
    if (Math.random() < 0.004 * level) {
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        eBullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, r: 4 });
    }
    }

    // ─── Power-Ups ───────────────────────────────────
    function spawnPowerUp() {
    const x = Math.random() * (W - 60) + 30;
    const isShield = Math.random() < 0.5;
    powerUps.push({
        x, y: -20, vy: 1.6,
        type: isShield ? 'shield' : 'blaster',
        icon: isShield ? '🛡️' : '⚡',
        color: isShield ? '#0f8' : '#ff0'
    });
    }

    function applyPowerUp(type) {
    if (type === 'shield') {
        player.shieldCharges = 2;
        spawnParticles(player.x, player.y, '#0f8', 20);
    } else {
        powerShotTimer = 480; // ca. 8 Sekunden bei 60fps
        spawnParticles(player.x, player.y, '#ff0', 20);
    }
    updateUI();
    }

    // ─── UPDATE ──────────────────────────────────────
    function update() {
    frameCount++;

    // Stars scroll
    stars.forEach(s => {
        s.y += s.speed;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });

    // Level
    level = 1 + Math.floor(score / 200);

    // Spawn
    const interval = Math.max(40, 90 - level * 8);
    if (++enemyTimer >= interval) { spawnEnemy(); enemyTimer = 0; }

    // ── Player follows mouse/touch smoothly ──
    const lerp = 0.18;
    player.x += (mouse.x - player.x) * lerp;
    player.y += (mouse.y - player.y) * lerp;
    player.x = Math.max(player.w/2, Math.min(W - player.w/2, player.x));
    player.y = Math.max(player.h/2 + 40, Math.min(H - player.h/2 - 10, player.y));

    // ── Shoot on click / hold ──
    if (shootCooldown > 0) shootCooldown--;
    if (mouse.down && shootCooldown === 0) {
        const dmg = powerShotTimer > 0 ? 2 : 1;
        const bColor = powerShotTimer > 0 ? '#ff0' : '#0ff';
        bullets.push({ x: player.x - 8, y: player.y - 20, vy: -14, r: 4, color: bColor, dmg });
        bullets.push({ x: player.x + 8, y: player.y - 20, vy: -14, r: 4, color: bColor, dmg });
        if (powerShotTimer > 0) {
        bullets.push({ x: player.x, y: player.y - 26, vy: -16, r: 5, color: bColor, dmg });
        }
        spawnParticles(player.x, player.y - 20, '#0ff3', 2);
        shootCooldown = 8;
    }

    if (powerShotTimer > 0) {
        powerShotTimer--;
        if (powerShotTimer === 0) updateUI();
    }

    // Bullets move
    bullets = bullets.filter(b => b.y > -10);
    bullets.forEach(b => { b.y += b.vy; });

    // Enemy bullets
    eBullets = eBullets.filter(b => b.y < H+10 && b.y > -10 && b.x > -10 && b.x < W+10);
    eBullets.forEach(b => { b.x += b.vx; b.y += b.vy; });

    // Power-Ups fallen lassen
    powerUps.forEach(p => { p.y += p.vy; });
    powerUps = powerUps.filter(p => !p.dead && p.y < H + 30);

    // Enemy movement
    enemies.forEach(e => {
        if (e.type === 'zigzag') {
        e.phase += 0.05;
        e.x += Math.sin(e.phase) * 2.5;
        } else {
        e.x += e.vx;
        if (e.x < e.w/2 || e.x > W - e.w/2) e.vx *= -1;
        }
        e.y += e.vy;
        enemyShoot(e);
    });

    // Bullet–enemy collision
    bullets.forEach(b => {
        if (b.dead) return;
        enemies.forEach(e => {
        if (b.dead || e.dead) return;
        if (Math.abs(b.x - e.x) < e.w/2 && Math.abs(b.y - e.y) < e.h/2) {
            e.hp -= b.dmg || 1;
            b.dead = true;
            spawnParticles(b.x, b.y, e.glowColor, 6);
            if (e.hp <= 0) {
            e.dead = true;
            score += e.type === 'basic' ? 10 : e.type === 'zigzag' ? 20 : 40;
            killCount++;
            if (killCount % KILLS_PER_POWERUP === 0) spawnPowerUp();
            spawnParticles(e.x, e.y, e.glowColor, 20);
            updateUI();
            }
        }
        });
    });

    bullets  = bullets.filter(b => !b.dead);
    enemies  = enemies.filter(e => !e.dead && e.y < H + 50);

    // Power-Up–player collision
    powerUps.forEach(p => {
        if (!p.dead && Math.hypot(player.x - p.x, player.y - p.y) < 28) {
        p.dead = true;
        applyPowerUp(p.type);
        }
    });
    powerUps = powerUps.filter(p => !p.dead);

    // Enemy–player collision
    if (player.invincible <= 0) {
        enemies.forEach(e => {
        if (Math.abs(player.x - e.x) < (player.w + e.w)/2 - 6 &&
            Math.abs(player.y - e.y) < (player.h + e.h)/2 - 6) {
            e.dead = true;
            hitPlayer();
        }
        });
        eBullets.forEach(b => {
        if (Math.hypot(player.x - b.x, player.y - b.y) < 18) {
            b.dead = true;
            hitPlayer();
        }
        });
        eBullets = eBullets.filter(b => !b.dead);
    }

    if (player.invincible > 0) player.invincible--;

    // Particles
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= p.decay; p.vx *= 0.95; p.vy *= 0.95; });
    particles = particles.filter(p => p.life > 0);
    }

    function hitPlayer() {
    if (player.shieldCharges > 0) {
        player.shieldCharges--;
        spawnParticles(player.x, player.y, '#0f8', 20);
        player.invincible = 40;
        updateUI();
        return;
    }
    lives--;
    updateUI();
    spawnParticles(player.x, player.y, '#0ff', 30);
    player.invincible = 120;
    if (lives <= 0) gameOver();
    }

    // ─── DRAW ────────────────────────────────────────
    function drawStars() {
    stars.forEach(s => {
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    }

    function drawPlayer() {
    const { x, y, w, h, invincible, shieldCharges } = player;
    if (invincible > 0 && Math.floor(invincible / 5) % 2 === 0) return;

    ctx.save();
    ctx.translate(x, y);

    // Schild-Ring, solange aktiv
    if (shieldCharges > 0) {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#0f8';
        ctx.strokeStyle = '#0f8';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Engine flame (bigger when shooting)
    const flameSize = mouse.down ? 20 + Math.random() * 8 : 12;
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#0ff';
    ctx.fillStyle = '#0ff3';
    ctx.beginPath();
    ctx.ellipse(0, h/2 + 8, 8, flameSize, 0, 0, Math.PI*2);
    ctx.fill();

    // Thruster particles when shooting
    if (mouse.down && Math.random() < 0.4) {
        ctx.fillStyle = '#fff6';
        ctx.beginPath();
        ctx.ellipse(0, h/2 + 14 + Math.random()*6, 4, 6, 0, 0, Math.PI*2);
        ctx.fill();
    }

    // Body
    ctx.shadowBlur = 15;
    ctx.shadowColor = powerShotTimer > 0 ? '#ff0' : '#0ff';
    ctx.fillStyle = powerShotTimer > 0 ? '#ff0' : '#0ff';
    ctx.beginPath();
    ctx.moveTo(0, -h/2);
    ctx.lineTo(w/2, h/2);
    ctx.lineTo(w/3, h/3);
    ctx.lineTo(0, h/2 - 8);
    ctx.lineTo(-w/3, h/3);
    ctx.lineTo(-w/2, h/2);
    ctx.closePath();
    ctx.fill();

    // Center stripe
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, -h/2 + 4);
    ctx.lineTo(6, h/2 - 10);
    ctx.lineTo(-6, h/2 - 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    }

    function drawCursor() {
    // Custom crosshair at real mouse/touch position
    const mx = mouse.x, my = mouse.y;
    ctx.save();
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0ff';
    ctx.globalAlpha = 0.85;

    const s = 10;
    ctx.beginPath();
    ctx.moveTo(mx - s, my); ctx.lineTo(mx + s, my);
    ctx.moveTo(mx, my - s); ctx.lineTo(mx, my + s);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(mx, my, 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    }

    function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowBlur = 18;
    ctx.shadowColor = e.glowColor;
    const hpRatio = e.hp / e.maxHp;
    ctx.globalAlpha = 0.5 + hpRatio * 0.5;

    if (e.type === 'basic') {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(0, e.h/2);
        ctx.lineTo(-e.w/2, -e.h/2);
        ctx.lineTo(0, -e.h/4);
        ctx.lineTo(e.w/2, -e.h/2);
        ctx.closePath();
        ctx.fill();
    } else if (e.type === 'zigzag') {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(0, 0, e.w/2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff4';
        ctx.beginPath();
        ctx.arc(0, 0, e.w/4, 0, Math.PI*2);
        ctx.fill();
    } else {
        ctx.fillStyle = e.color;
        ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
        ctx.fillStyle = '#fff3';
        ctx.fillRect(-e.w/4, -e.h/4, e.w/2, e.h/2);
    }

    if (e.maxHp > 1) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#333';
        ctx.fillRect(-e.w/2, -e.h/2 - 8, e.w, 4);
        ctx.fillStyle = hpRatio > 0.5 ? '#0f0' : '#f80';
        ctx.shadowBlur = 0;
        ctx.fillRect(-e.w/2, -e.h/2 - 8, e.w * hpRatio, 4);
    }

    ctx.restore();
    }

    function drawPowerUp(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowBlur = 20;
    ctx.shadowColor = p.color;
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.icon, 0, 0);
    ctx.restore();
    }

    function drawBullets() {
    bullets.forEach(b => {
        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = b.color;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x - b.r/2, b.y - b.r * 2, b.r, b.r * 4, b.r);
        ctx.fill();
        ctx.restore();
    });

    eBullets.forEach(b => {
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#f50';
        ctx.fillStyle = '#f80';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    });
    }

    function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    });
    }

    function drawScanlines() {
    ctx.save();
    ctx.globalAlpha = 0.04;
    for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y, W, 2);
    }
    ctx.restore();
    }

    function draw() {
    ctx.fillStyle = '#000814';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.save();
    ctx.strokeStyle = '#0ff1';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();

    drawStars();
    drawParticles();
    enemies.forEach(drawEnemy);
    powerUps.forEach(drawPowerUp);
    drawBullets();
    drawPlayer();
    drawCursor();
    drawScanlines();
    }

    // ─── LOOP ────────────────────────────────────────
    function loop() {
    if (state !== 'playing') return;
    update();
    draw();
    requestAnimationFrame(loop);
    }

    // Menu animation
    function menuLoop() {
    if (state !== 'menu') return;
    ctx.fillStyle = '#000814';
    ctx.fillRect(0, 0, W, H);
    drawStars();
    stars.forEach(s => { s.y += s.speed; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
    drawScanlines();
    requestAnimationFrame(menuLoop);
    }

    initStars();
    menuLoop();