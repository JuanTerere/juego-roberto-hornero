// --- 1. CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyB8bRUNCpopv-cdpGmGwFnxh0dAvt8NHQg",
    authDomain: "roberto-hornero.firebaseapp.com",
    databaseURL: "https://roberto-hornero-default-rtdb.firebaseio.com",
    projectId: "roberto-hornero",
    storageBucket: "roberto-hornero.firebasestorage.app",
    messagingSenderId: "784475548449",
    appId: "1:784475548449:web:873049cedc8445ff50ac60"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- 2. VARIABLES DEL JUEGO ---
let nestStage = 0;
let score = 0;
let energy = 100;
let shotsFired = 0;
let combo = 0;
let bestCombo = 0;

// --- 2.1 AUDIO (sintetizado con WebAudio, sin archivos externos) ---
const SFX = (() => {
    let ctx;
    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }
    function tone(freq, dur, type = 'sine', vol = 0.2, delay = 0) {
        try {
            const c = getCtx();
            const t0 = c.currentTime + delay;
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t0);
            gain.gain.setValueAtTime(vol, t0);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
            osc.connect(gain).connect(c.destination);
            osc.start(t0);
            osc.stop(t0 + dur);
        } catch (e) { /* audio no disponible */ }
    }
    return {
        launch: () => { tone(180, 0.12, 'sawtooth', 0.15); tone(280, 0.08, 'sine', 0.1, 0.02); },
        hit: () => { tone(520, 0.08, 'square', 0.18); tone(780, 0.1, 'sine', 0.15, 0.05); },
        miss: () => { tone(140, 0.25, 'sawtooth', 0.12); },
        stage: () => { tone(660, 0.09, 'sine', 0.18); tone(880, 0.12, 'sine', 0.16, 0.09); },
        win: () => { [660, 880, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'sine', 0.18, i * 0.11)); },
        click: () => { tone(400, 0.06, 'triangle', 0.12); }
    };
})();

// Las 3 provincias habilitadas
const PROVINCES_DATA = [
    { id: "tucuman", name: "Tucumán", status: "Disponible", bg: "casitade-tucuman.png" },
    { id: "bsas", name: "Buenos Aires", status: "Disponible", bg: "obelisco-bs-as.png" },
    { id: "cordoba", name: "Córdoba", status: "Disponible", bg: "catedral-de-cordoba.png" }
];

// --- 3. LÓGICA DE INTERFAZ Y EVENTOS DOM ---
document.addEventListener("DOMContentLoaded", () => {

    // Navegación principal
    document.getElementById("btn-play-main").addEventListener("click", () => { SFX.click(); showScreen("province-screen"); });
    document.getElementById("btn-back-menu").addEventListener("click", () => { SFX.click(); showScreen("start-screen"); });

    // Modal Campaña Matecito
    document.getElementById("btn-open-campaign").addEventListener("click", () => {
        document.getElementById("campaign-modal").classList.add("active");
    });
    document.getElementById("btn-close-campaign").addEventListener("click", () => {
        document.getElementById("campaign-modal").classList.remove("active");
    });

    // Cargar Grilla de Provincias
    const grid = document.getElementById("provinces-grid");
    PROVINCES_DATA.forEach(prov => {
        const card = document.createElement("div");
        card.className = `prov-card ${prov.status === 'Disponible' ? 'active' : 'locked'}`;
        card.innerHTML = `<h3>${prov.name}</h3><p>${prov.status}</p>`;
        if (prov.status === 'Disponible') card.addEventListener("click", () => startGamePhaser(prov));
        grid.appendChild(card);
    });

    // Votación y Confeti
    document.querySelectorAll(".btn-vote").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const provName = e.target.getAttribute("data-prov");
            database.ref(`votacion/${provName}`).transaction(current => (current || 0) + 1);
            lanzarConfetiCelesteYBlanco();
            SFX.win();
            showToast(`🎉 ¡Gracias por votar por ${provName}!`);
        });
    });

    // Podio
    document.getElementById("btn-view-votes").addEventListener("click", () => {
        loadPodiumData();
        showScreen("podium-screen");
    });
    document.getElementById("btn-back-from-podium").addEventListener("click", () => showScreen("start-screen"));

    // Guardar Ranking
    document.getElementById("score-form").addEventListener("submit", (e) => {
        e.preventDefault();
        database.ref("ranking").push({
            nombre: document.getElementById("player-name").value,
            provincia: document.getElementById("player-province").value,
            puntaje: score,
            fecha: new Date().toISOString()
        });
        showScreen("start-screen");
        loadRanking();
    });

    // Compartir puntaje (para viralizar)
    const shareBtn = document.getElementById("btn-share-score");
    if (shareBtn) shareBtn.addEventListener("click", shareScore);

    loadRanking();
});

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    if (screenId) document.getElementById(screenId).classList.add("active");
}

function showToast(msg) {
    let toast = document.getElementById("toast-msg");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast-msg";
        toast.className = "toast-msg";
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

function shareScore() {
    const text = `🏗️ ¡Construí el nido de Roberto Hornero en ${currentProv ? currentProv.name : 'Argentina'} y saqué ${score} puntos! 🇦🇷🐦 ¿Podés superarme?`;
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({ title: "Roberto Hornero - Construyendo Patria", text, url }).catch(() => {});
    } else {
        const waUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
        window.open(waUrl, "_blank");
    }
}

function lanzarConfetiCelesteYBlanco() {
    for (let i = 0; i < 60; i++) {
        let conf = document.createElement('div');
        conf.classList.add('confetti');
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.backgroundColor = Math.random() > 0.5 ? '#74acdf' : '#ffffff';
        conf.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 3500);
    }
}

function loadPodiumData() {
    database.ref("votacion").once("value", snapshot => {
        const votes = snapshot.val() || {};
        let sorted = Object.keys(votes).map(k => ({ prov: k, v: votes[k] })).sort((a, b) => b.v - a.v);
        while (sorted.length < 3) sorted.push({ prov: "-", v: 0 });

        document.getElementById("podium-1st-name").innerText = sorted[0].prov;
        document.getElementById("podium-1st-votes").innerText = `${sorted[0].v} votos`;
        document.getElementById("podium-2nd-name").innerText = sorted[1].prov;
        document.getElementById("podium-2nd-votes").innerText = `${sorted[1].v} votos`;
        document.getElementById("podium-3rd-name").innerText = sorted[2].prov;
        document.getElementById("podium-3rd-votes").innerText = `${sorted[2].v} votos`;
    });
}

function loadRanking() {
    database.ref("ranking").orderByChild("puntaje").limitToLast(5).once("value", snap => {
        const list = document.getElementById("ranking-list");
        list.innerHTML = "";
        let arr = [];
        snap.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((item, i) => {
            list.innerHTML += `<p>#${i + 1} <strong>${item.nombre}</strong>: ${item.puntaje} pts</p>`;
        });
    });
}

// --- 4. MOTOR PHASER 3 (EL JUEGO) — Mecánica tipo "Angry Birds" ---
let game;
let gameScene;
let currentProv;

const NEST_TARGET = { x: 980, y: 400, radius: 95 };
const LAUNCH_POINT = { x: 220, y: 560 };
const MAX_DRAG = 160;
const GRAVITY_Y = 900;

function startGamePhaser(prov) {
    currentProv = prov;
    nestStage = 0;
    score = 0;
    shotsFired = 0;
    combo = 0;
    bestCombo = 0;
    showScreen(null);

    if (game) game.destroy(true);

    const config = {
        type: Phaser.AUTO,
        parent: "game-container",
        width: 1280,
        height: 720,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY_Y }, debug: false } },
        scene: { preload: preload, create: create, update: update }
    };

    game = new Phaser.Game(config);
}

function preload() {
    // 1. Escenario dinámico
    this.load.image('bg', `assets/escenarios/${currentProv.bg}`);

    // 2. Fases de construcción
    this.load.image('base_poste', 'assets/img/game/HorneroA.png');
    this.load.image('nest_1', 'assets/img/game/Hornero2.png');
    this.load.image('nest_2', 'assets/img/game/Hornero3.png');
    this.load.image('nest_3', 'assets/img/game/Hornero4.png');
    this.load.image('nest_4', 'assets/img/game/Hornero5.png');
    this.load.image('nest_5', 'assets/img/game/Hornero6.png');
    this.load.image('nest_6', 'assets/img/game/Hornero7.png');

    // 3. Personaje y animaciones
    this.load.image('rh_conpala', 'assets/img/roberto/rh-conpala.png');
    this.load.image('rh_lanza1', 'assets/img/roberto/rh-lanza1.png');
    this.load.image('rh_lanza2', 'assets/img/roberto/rh-lanza2.png');
    this.load.image('rh_lanza3', 'assets/img/roberto/rh-lanza3.png');

    // 4. Proyectiles y partículas
    this.load.image('proyectil_barro', 'assets/img/game/proyectil-barro.png');
    this.load.image('estrella', 'assets/img/game/estrella.png');
    this.load.image('estrella78', 'assets/img/game/estrella78.png');
    this.load.image('estrella86', 'assets/img/game/estrella86.png');
    this.load.image('estrella22', 'assets/img/game/estrella22.png');
}

function create() {
    gameScene = this;
    this.isAnimating = false;
    this.aiming = false;

    // Fondo
    this.add.image(640, 360, 'bg').setDisplaySize(1280, 720);

    // Poste + nido
    this.poste = this.add.image(NEST_TARGET.x, 620, 'base_poste').setScale(0.8).setDepth(2);
    this.nestSprite = this.add.image(NEST_TARGET.x, NEST_TARGET.y, 'nest_1').setScale(0.75).setDepth(3);
    this.nestSprite.setVisible(false);
    this.nestSprite.setAlpha(0);

    // Zona de impacto visual (círculo guía sutil)
    this.targetRing = this.add.circle(NEST_TARGET.x, NEST_TARGET.y, NEST_TARGET.radius, 0xffffff, 0.06).setStrokeStyle(2, 0xffffff, 0.25).setDepth(1);
    this.tweens.add({ targets: this.targetRing, scale: { from: 1, to: 1.06 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Personaje
    this.player = this.add.image(LAUNCH_POINT.x, LAUNCH_POINT.y, 'rh_conpala').setScale(0.55).setDepth(4);
    this.tweens.add({ targets: this.player, y: LAUNCH_POINT.y - 8, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Gráficos para la trayectoria de puntería
    this.aimGraphics = this.add.graphics().setDepth(5);

    // HUD
    this.uiTop = this.add.rectangle(640, 46, 1280, 92, 0x0b1a2b, 0.55).setDepth(10);

    this.barBg = this.add.rectangle(210, 40, 320, 22, 0x0b1a2b, 0.6).setStrokeStyle(2, 0xffffff, 0.5).setDepth(11);
    this.barFill = this.add.rectangle(210 - 158, 40, 4, 18, 0x27ae60, 1).setOrigin(0, 0.5).setDepth(12);
    this.stageLabel = this.add.text(210, 14, '🏗️ NIDO', { fontSize: '16px', fontStyle: 'bold', fill: '#f1c40f' }).setOrigin(0.5).setDepth(12);

    this.energyBg = this.add.rectangle(210, 72, 320, 14, 0x0b1a2b, 0.6).setStrokeStyle(2, 0xffffff, 0.4).setDepth(11);
    this.energyFill = this.add.rectangle(210 - 158, 72, 316, 10, 0xe74c3c, 1).setOrigin(0, 0.5).setDepth(12);

    this.scoreText = this.add.text(1260, 24, '🏆 0', { fontSize: '30px', fontStyle: 'bold', fill: '#ffffff' }).setOrigin(1, 0).setDepth(12);
    this.comboText = this.add.text(1260, 60, '', { fontSize: '18px', fontStyle: 'bold', fill: '#f1c40f' }).setOrigin(1, 0).setDepth(12);

    this.provText = this.add.text(20, 22, `📍 ${currentProv.name}`, { fontSize: '18px', fill: '#ecf0f1' }).setDepth(12);

    updateHUD();

    // Partículas de barro para el trayecto (rastro)
    this.mudTrail = this.add.particles(0, 0, 'estrella', { visible: false });

    // --- Input: arrastrar para apuntar, soltar para lanzar (estilo Angry Birds) ---
    this.input.on('pointerdown', (pointer) => {
        if (document.querySelector(".screen.active:not(#ui-container)")) return;
        if (this.isAnimating || this.projectile) return;
        this.aiming = true;
        this.dragStart = { x: pointer.x, y: pointer.y };
    });

    this.input.on('pointermove', (pointer) => {
        if (!this.aiming) return;
        drawAimLine(this, pointer);
    });

    this.input.on('pointerup', (pointer) => {
        if (!this.aiming) return;
        this.aiming = false;
        this.aimGraphics.clear();
        launchMud(this, pointer);
    });
}

function drawAimLine(scene, pointer) {
    const dx = pointer.x - LAUNCH_POINT.x;
    const dy = pointer.y - LAUNCH_POINT.y;
    let dist = Math.min(Math.sqrt(dx * dx + dy * dy), MAX_DRAG);
    const angle = Math.atan2(dy, dx);
    const pullX = LAUNCH_POINT.x + Math.cos(angle) * dist;
    const pullY = LAUNCH_POINT.y + Math.sin(angle) * dist;

    scene.aimGraphics.clear();
    scene.aimGraphics.lineStyle(6, 0x8b5a2b, 0.6);
    scene.aimGraphics.lineBetween(LAUNCH_POINT.x, LAUNCH_POINT.y, pullX, pullY);

    // Vector de lanzamiento = dirección opuesta al arrastre
    const power = dist / MAX_DRAG;
    const vx = -Math.cos(angle) * power * 900;
    const vy = -Math.sin(angle) * power * 900;

    // Puntos de trayectoria previstos (parábola simple)
    scene.aimGraphics.fillStyle(0xffffff, 0.7);
    let px = LAUNCH_POINT.x, py = LAUNCH_POINT.y;
    let svx = vx, svy = vy;
    for (let i = 0; i < 16; i++) {
        const t = 0.055;
        px += svx * t;
        py += svy * t;
        svy += GRAVITY_Y * t;
        if (i % 2 === 0) scene.aimGraphics.fillCircle(px, py, 4);
        if (py > 720) break;
    }
}

function launchMud(scene, pointer) {
    const dx = pointer.x - LAUNCH_POINT.x;
    const dy = pointer.y - LAUNCH_POINT.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) return; // arrastre muy corto, no dispara

    dist = Math.min(dist, MAX_DRAG);
    const angle = Math.atan2(dy, dx);
    const power = dist / MAX_DRAG;

    shotsFired++;
    energy = Math.max(0, energy - 8);
    updateHUD();
    SFX.launch();

    // Animación de lanzamiento del personaje
    scene.player.setTexture('rh_lanza1');
    scene.time.delayedCall(80, () => scene.player.setTexture('rh_lanza2'));
    scene.time.delayedCall(160, () => scene.player.setTexture('rh_lanza3'));
    scene.time.delayedCall(420, () => scene.player.setTexture('rh_conpala'));

    const vx = -Math.cos(angle) * power * 900;
    const vy = -Math.sin(angle) * power * 900;

    const mud = scene.physics.add.image(LAUNCH_POINT.x, LAUNCH_POINT.y, 'proyectil_barro').setScale(0.35).setDepth(6);
    mud.body.setAllowGravity(true);
    mud.body.setVelocity(vx, vy);
    mud.body.setCircle(mud.width * 0.3);
    scene.projectile = mud;

    scene.isAnimating = true;

    const checkLoop = scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
            if (!mud.active) { checkLoop.remove(); return; }

            mud.rotation += 0.25;

            const d = Phaser.Math.Distance.Between(mud.x, mud.y, NEST_TARGET.x, NEST_TARGET.y);
            if (d < NEST_TARGET.radius) {
                checkLoop.remove();
                onHit(scene, mud);
                return;
            }

            if (mud.y > 760 || mud.x < -50 || mud.x > 1330) {
                checkLoop.remove();
                onMiss(scene, mud);
            }
        }
    });
}

function onHit(scene, mud) {
    mud.destroy();
    scene.projectile = null;
    scene.isAnimating = false;

    combo++;
    bestCombo = Math.max(bestCombo, combo);
    const comboBonus = (combo - 1) * 15;
    const points = 50 + comboBonus;
    score += points;

    SFX.hit();
    scene.cameras.main.shake(160, 0.008);

    // Explosión de estrellas
    const starKeys = ['estrella', 'estrella78', 'estrella86', 'estrella22'];
    const emitter = scene.add.particles(NEST_TARGET.x, NEST_TARGET.y, Phaser.Utils.Array.GetRandom(starKeys), {
        speed: { min: 150, max: 320 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.4, end: 0 },
        lifespan: 550,
        quantity: 14,
        depth: 7
    });
    scene.time.delayedCall(600, () => emitter.destroy());

    // Texto flotante de puntaje
    floatingText(scene, NEST_TARGET.x, NEST_TARGET.y - 40, `+${points}`, '#f1c40f');
    if (combo > 1) {
        scene.comboText.setText(`🔥 COMBO x${combo}`);
        scene.tweens.add({ targets: scene.comboText, scale: { from: 1.3, to: 1 }, duration: 250, ease: 'Back.Out' });
    }

    // Avanza etapa del nido
    if (nestStage < 6) {
        nestStage++;
        scene.nestSprite.setVisible(true);
        scene.nestSprite.setTexture(`nest_${nestStage}`);
        scene.nestSprite.setScale(0.5);
        scene.nestSprite.setAlpha(1);
        scene.tweens.add({ targets: scene.nestSprite, scale: 0.85, duration: 180, ease: 'Back.Out', yoyo: false });
        scene.tweens.add({ targets: scene.nestSprite, scale: { from: 0.9, to: 0.75 }, duration: 220, delay: 180, ease: 'Sine.easeOut' });
        SFX.stage();
    }

    updateHUD();

    if (nestStage >= 6) {
        scene.time.delayedCall(900, winGame);
        return;
    }

    if (shotsFired >= 12 || energy <= 0) {
        scene.time.delayedCall(500, () => triggerMateBreak());
    }
}

function onMiss(scene, mud) {
    mud.destroy();
    scene.projectile = null;
    scene.isAnimating = false;
    combo = 0;
    scene.comboText.setText('');
    SFX.miss();
    scene.cameras.main.flash(120, 120, 20, 20, false);

    if (shotsFired >= 12 || energy <= 0) {
        scene.time.delayedCall(300, () => triggerMateBreak());
    }
}

function floatingText(scene, x, y, msg, color) {
    const txt = scene.add.text(x, y, msg, {
        fontSize: '34px', fontStyle: 'bold', fill: color, stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(20);
    scene.tweens.add({
        targets: txt,
        y: y - 70,
        alpha: 0,
        duration: 850,
        ease: 'Cubic.easeOut',
        onComplete: () => txt.destroy()
    });
}

function update() { }

function updateHUD() {
    if (!gameScene) return;
    gameScene.scoreText.setText(`🏆 ${score}`);

    const stageRatio = Phaser.Math.Clamp(nestStage / 6, 0, 1);
    gameScene.tweens.add({ targets: gameScene.barFill, width: 316 * stageRatio, duration: 250, ease: 'Sine.easeOut' });
    gameScene.stageLabel.setText(`🏗️ NIDO ${nestStage}/6`);

    const energyRatio = Phaser.Math.Clamp(energy / 100, 0, 1);
    const energyColor = energyRatio > 0.5 ? 0x27ae60 : (energyRatio > 0.22 ? 0xf1c40f : 0xe74c3c);
    gameScene.energyFill.fillColor = energyColor;
    gameScene.tweens.add({ targets: gameScene.energyFill, width: 316 * energyRatio, duration: 250, ease: 'Sine.easeOut' });
}

function triggerMateBreak() {
    showScreen("mate-break-screen");
    const progress = document.getElementById("loader-progress");
    progress.style.width = "0%";
    setTimeout(() => progress.style.width = "100%", 10);

    startMateAnimation();

    setTimeout(() => {
        stopMateAnimation();
        shotsFired = 0;
        energy = 100;
        updateHUD();
        showScreen(null);
    }, 5000);
}

let mateAnimInterval = null;
function startMateAnimation() {
    const img = document.getElementById("mate-anim-img");
    if (!img) return;
    const frames = ['assets/img/roberto/rh-mate1.png', 'assets/img/roberto/rh-mate2.png', 'assets/img/roberto/rh-mate3.png'];
    let i = 0;
    img.src = frames[0];
    mateAnimInterval = setInterval(() => {
        i = (i + 1) % frames.length;
        img.src = frames[i];
    }, 450);
}
function stopMateAnimation() {
    if (mateAnimInterval) clearInterval(mateAnimInterval);
    mateAnimInterval = null;
}

function winGame() {
    document.getElementById("final-score").innerText = score;
    const stars = score > 450 ? "⭐⭐⭐" : (score > 280 ? "⭐⭐" : "⭐");
    document.getElementById("stars-result").innerText = stars;
    const comboLine = document.getElementById("best-combo-line");
    if (comboLine) comboLine.innerText = bestCombo > 1 ? `🔥 Mejor combo: x${bestCombo}` : '';
    showScreen("game-over-modal");
    lanzarConfetiCelesteYBlanco();
    SFX.win();
}
