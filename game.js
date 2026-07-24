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
let hits = 0;
let combo = 0;
let bestCombo = 0;
let totalAccumulatedScore = parseInt(localStorage.getItem('rh_total_score') || '0', 10);

// --- 2.1 AUDIO ---
// Intenta usar música real (assets/audio/milonga-rh.mp3). Si el archivo no carga
// o está vacío/corrupto, usa una melodía sintetizada de respaldo (sin archivos).
const AudioEngine = (() => {
    let ctx;
    let musicOn = true;
    let musicTimer = null;
    let musicStep = 0;

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

    const MELODY = [523, 587, 659, 587, 523, 440, 392, 440, 523, 659, 784, 659, 523, 440, 392, 330];

    function scheduleSynthMusic() {
        if (musicTimer) return;
        musicTimer = setInterval(() => {
            if (!musicOn) return;
            const note = MELODY[musicStep % MELODY.length];
            tone(note, 0.25, 'triangle', 0.05);
            musicStep++;
        }, 260);
    }

    return {
        launch: () => { tone(180, 0.12, 'sawtooth', 0.15); tone(280, 0.08, 'sine', 0.1, 0.02); },
        hit: () => { tone(520, 0.08, 'square', 0.18); tone(780, 0.1, 'sine', 0.15, 0.05); },
        miss: () => { tone(140, 0.25, 'sawtooth', 0.12); },
        stage: () => { tone(660, 0.09, 'sine', 0.18); tone(880, 0.12, 'sine', 0.16, 0.09); },
        win: () => { [660, 880, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'sine', 0.18, i * 0.11)); },
        click: () => { tone(400, 0.06, 'triangle', 0.12); },
        startSynthMusic: () => { getCtx(); scheduleSynthMusic(); },
        toggleMusic: () => { musicOn = !musicOn; return musicOn; },
        isMusicOn: () => musicOn
    };
})();

// --- 3. DATOS DE PROVINCIAS (por región) ---
const REGIONS_DATA = [
    {
        region: "Región Pampeana",
        provinces: [
            { id: "bsas", name: "Buenos Aires", status: "habilitada", bg: "obelisco-bs-as.png" },
            { id: "cordoba", name: "Córdoba", status: "habilitada", bg: "catedral-de-cordoba.png" },
            { id: "santafe", name: "Santa Fe", status: "votacion" },
            { id: "entrerios", name: "Entre Ríos", status: "bloqueada" },
            { id: "lapampa", name: "La Pampa", status: "bloqueada" }
        ]
    },
    {
        region: "Norte Grande (NOA y NEA)",
        provinces: [
            { id: "tucuman", name: "Tucumán", status: "habilitada", bg: "casitade-tucuman.png" },
            { id: "misiones", name: "Misiones", status: "votacion" },
            { id: "salta", name: "Salta", status: "bloqueada" },
            { id: "jujuy", name: "Jujuy", status: "bloqueada" },
            { id: "chaco", name: "Chaco", status: "bloqueada" },
            { id: "corrientes", name: "Corrientes", status: "bloqueada" },
            { id: "formosa", name: "Formosa", status: "bloqueada" },
            { id: "catamarca", name: "Catamarca", status: "bloqueada" },
            { id: "santiago", name: "Santiago del Estero", status: "bloqueada" }
        ]
    },
    {
        region: "Nuevo Cuyo",
        provinces: [
            { id: "mendoza", name: "Mendoza", status: "bloqueada" },
            { id: "sanjuan", name: "San Juan", status: "bloqueada" },
            { id: "sanluis", name: "San Luis", status: "bloqueada" },
            { id: "larioja", name: "La Rioja", status: "bloqueada" }
        ]
    },
    {
        region: "Patagonia",
        provinces: [
            { id: "chubut", name: "Chubut", status: "votacion" },
            { id: "neuquen", name: "Neuquén", status: "bloqueada" },
            { id: "rionegro", name: "Río Negro", status: "bloqueada" },
            { id: "santacruz", name: "Santa Cruz", status: "bloqueada" },
            { id: "tierradelfuego", name: "Tierra del Fuego", status: "bloqueada" }
        ]
    }
];

// --- 4. INICIALIZACIÓN DE INTERFAZ ---
document.addEventListener("DOMContentLoaded", () => {

    loadStartDashboards();
    renderProvincesList();
    populateProvinceSelect();

    document.getElementById("btn-play-main").addEventListener("click", () => { AudioEngine.click(); showScreen("province-screen"); });
    document.getElementById("btn-back-menu").addEventListener("click", () => { AudioEngine.click(); showScreen("start-screen"); });

    document.getElementById("btn-open-campaign").addEventListener("click", () => openModal("campaign-modal"));
    document.getElementById("btn-close-campaign").addEventListener("click", () => closeModal("campaign-modal"));

    document.getElementById("btn-view-podium").addEventListener("click", () => {
        loadPodiumData();
        openModal("podium-modal");
    });
    document.getElementById("btn-close-podium").addEventListener("click", () => closeModal("podium-modal"));

    document.querySelectorAll(".btn-vote").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const provName = e.target.getAttribute("data-prov");
            database.ref(`votacion/${provName}`).transaction(current => (current || 0) + 1);
            lanzarConfetiCelesteYBlanco();
            AudioEngine.win();
            showToast(`🎉 ¡Gracias por votar por ${provName}!`);
        });
    });

    document.getElementById("btn-play-more").addEventListener("click", () => {
        closeModal("game-over-modal");
        showScreen("province-screen");
    });

    document.getElementById("btn-save-score").addEventListener("click", () => {
        closeModal("game-over-modal");
        openModal("save-data-modal");
    });

    document.getElementById("score-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("player-name").value || "Anónimo";
        const prov = document.getElementById("player-province").value;
        database.ref("ranking").push({
            nombre: name,
            provincia: prov,
            puntaje: totalAccumulatedScore,
            fecha: new Date().toISOString()
        });
        showToast("¡Puntaje guardado!");
        closeModal("save-data-modal");
        loadStartDashboards();
        showScreen("start-screen");
    });

    document.getElementById("btn-share-score").addEventListener("click", shareScore);
    document.getElementById("btn-download-cert").addEventListener("click", downloadCertificate);

    document.getElementById("btn-toggle-music").addEventListener("click", () => {
        const on = AudioEngine.toggleMusic();
        document.getElementById("btn-toggle-music").textContent = on ? "🔊" : "🔇";
        if (gameScene && gameScene.bgMusic && !gameScene.musicUsingSynth) {
            if (on) gameScene.bgMusic.play(); else gameScene.bgMusic.pause();
        } else if (on) {
            AudioEngine.startSynthMusic();
        }
    });
});

function showScreen(screenId) {
    document.querySelectorAll(".screen:not(.modal-overlay)").forEach(s => s.classList.remove("active"));
    if (screenId) document.getElementById(screenId).classList.add("active");
}
function openModal(id) { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }

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
    const text = `🏗️ ¡Construí el nido de Roberto Hornero en ${currentProv ? currentProv.name : 'Argentina'} y llevo ${totalAccumulatedScore} puntos! 🇦🇷🐦 ¿Podés superarme?`;
    const url = window.location.href;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + " " + url)}`;
    window.open(waUrl, "_blank");
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

// --- 5. LISTA DE PROVINCIAS POR REGIÓN ---
function renderProvincesList() {
    const list = document.getElementById("provinces-grid");
    list.innerHTML = "";
    REGIONS_DATA.forEach(regionObj => {
        const title = document.createElement("div");
        title.className = "region-title";
        title.textContent = regionObj.region;
        list.appendChild(title);

        regionObj.provinces.forEach(prov => {
            const row = document.createElement("div");
            const icon = prov.status === "habilitada" ? "🟢" : (prov.status === "votacion" ? "🟡" : "🔒");
            row.className = `prov-row prov-${prov.status}`;
            row.innerHTML = `<span>${prov.name}</span><span>${icon}</span>`;

            if (prov.status === "habilitada") {
                row.addEventListener("click", () => startGamePhaser(prov));
            } else if (prov.status === "votacion") {
                row.addEventListener("click", () => {
                    database.ref(`votacion/${prov.name}`).transaction(current => (current || 0) + 1);
                    lanzarConfetiCelesteYBlanco();
                    showToast(`¡Votaste por ${prov.name}!`);
                });
            }
            list.appendChild(row);
        });
    });
}

function populateProvinceSelect() {
    const select = document.getElementById("player-province");
    REGIONS_DATA.forEach(r => r.provinces.forEach(p => {
        if (p.status === "habilitada") {
            const opt = document.createElement("option");
            opt.value = p.name;
            opt.textContent = p.name;
            select.appendChild(opt);
        }
    }));
}

// --- 6. DASHBOARDS Y RANKING ---
function loadStartDashboards() {
    database.ref("ranking").once("value", snap => {
        let allScores = [];
        if (snap.exists()) snap.forEach(c => allScores.push(c.val()));

        const natBox = document.getElementById("start-national-ranking");
        const provBox = document.getElementById("start-prov-ranking");

        if (allScores.length > 0) {
            allScores.sort((a, b) => b.puntaje - a.puntaje);
            let natHtml = "";
            allScores.slice(0, 3).forEach((item, i) => natHtml += `<p>#${i + 1} <strong>${item.nombre}</strong>: ${item.puntaje}</p>`);
            natBox.innerHTML = natHtml;

            let provCount = {};
            allScores.forEach(item => provCount[item.provincia] = (provCount[item.provincia] || 0) + 1);
            let provSorted = Object.keys(provCount).map(p => ({ prov: p, count: provCount[p] })).sort((a, b) => b.count - a.count);
            let provHtml = "";
            provSorted.slice(0, 3).forEach((item, i) => provHtml += `<p>#${i + 1} <strong>${item.prov}</strong>: ${item.count} jug.</p>`);
            provBox.innerHTML = provHtml;
        } else {
            natBox.innerHTML = "Aún no hay jugadas";
            provBox.innerHTML = "Aún no hay jugadas";
        }
    }).catch(err => console.log("Error de conexión con Firebase:", err));
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

// --- 7. MOTOR PHASER 3 (EL JUEGO) — Mecánica tipo "Angry Birds" ---
let game;
let gameScene;
let currentProv;

// Las ilustraciones originales son muy grandes (varios miles de px), por eso
// las escalas son chicas: así el personaje y el nido quedan proporcionados
// dentro del canvas de 1280x720.
const GROUND_Y = 650;
const ROBERTO_SCALE = 0.055;
const ROBERTO_X = 200;
const NEST_SCALE = 0.18;
const MUD_SCALE = 0.014;
const STAR_SCALE = 0.012;
const DRONE_SCALE = 0.12;

const LAUNCH_POINT = { x: ROBERTO_X, y: GROUND_Y - 110 };
const NEST_TARGET = { x: 980, y: 410, radius: 75 };
const MAX_DRAG = 160;
const GRAVITY_Y = 900;

function startGamePhaser(prov) {
    currentProv = prov;
    nestStage = 0;
    score = 0;
    shotsFired = 0;
    hits = 0;
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
    this.load.image('bg', `assets/escenarios/${currentProv.bg}`);

    this.load.image('base_poste', 'assets/img/game/HorneroA.png');
    this.load.image('nest_1', 'assets/img/game/Hornero2.png');
    this.load.image('nest_2', 'assets/img/game/Hornero3.png');
    this.load.image('nest_3', 'assets/img/game/Hornero4.png');
    this.load.image('nest_4', 'assets/img/game/Hornero5.png');
    this.load.image('nest_5', 'assets/img/game/Hornero6.png');
    this.load.image('nest_6', 'assets/img/game/Hornero7.png');

    this.load.image('rh_conpala', 'assets/img/roberto/rh-conpala.png');
    this.load.image('rh_lanza1', 'assets/img/roberto/rh-lanza1.png');
    this.load.image('rh_lanza2', 'assets/img/roberto/rh-lanza2.png');
    this.load.image('rh_lanza3', 'assets/img/roberto/rh-lanza3.png');

    this.load.image('proyectil_barro', 'assets/proyectil-barro.png');
    this.load.image('estrella', 'assets/estrella.png');
    this.load.image('estrella78', 'assets/estrella78.png');
    this.load.image('estrella86', 'assets/estrella86.png');
    this.load.image('estrella22', 'assets/estrella22.png');

    this.load.image('drone_de', 'assets/img/game/drone.de.png');
    this.load.image('drone_iz', 'assets/img/game/drone.iz.png');

    // Música: si el archivo falta o está corrupto, marcamos la bandera y usamos el respaldo sintetizado
    this.musicLoadFailed = false;
    this.load.on('loaderror', (file) => {
        if (file.key === 'milonga') this.musicLoadFailed = true;
    });
    this.load.audio('milonga', 'assets/audio/milonga-rh.mp3');
}

function create() {
    gameScene = this;
    this.isAnimating = false;
    this.aiming = false;
    this.drones = [];

    this.add.image(640, 360, 'bg').setDisplaySize(1280, 720);

    // Poste/nido: UN solo sprite que cambia de textura según la etapa
    // (las imágenes del nido ya incluyen el poste, por eso no se dibujan superpuestos)
    this.nestPost = this.add.image(NEST_TARGET.x, GROUND_Y, 'base_poste')
        .setOrigin(0.5, 1)
        .setScale(NEST_SCALE)
        .setDepth(3);

    this.targetRing = this.add.circle(NEST_TARGET.x, NEST_TARGET.y, NEST_TARGET.radius, 0xffffff, 0.06).setStrokeStyle(2, 0xffffff, 0.25).setDepth(1);
    this.tweens.add({ targets: this.targetRing, scale: { from: 1, to: 1.06 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.player = this.add.image(ROBERTO_X, GROUND_Y, 'rh_conpala')
        .setOrigin(0.5, 1)
        .setScale(ROBERTO_SCALE)
        .setDepth(4);
    this.tweens.add({ targets: this.player, y: GROUND_Y - 6, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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

    // --- Música de fondo ---
    this.musicUsingSynth = true;
    if (!this.musicLoadFailed && this.cache.audio.exists('milonga')) {
        try {
            this.bgMusic = this.sound.add('milonga', { loop: true, volume: 0.5 });
            if (this.bgMusic && this.bgMusic.duration > 0.5) {
                this.musicUsingSynth = false;
                if (AudioEngine.isMusicOn()) this.bgMusic.play();
            }
        } catch (e) { this.musicUsingSynth = true; }
    }
    if (this.musicUsingSynth && AudioEngine.isMusicOn()) {
        AudioEngine.startSynthMusic();
    }

    // --- Drones: objetivos voladores de bonus ---
    this.time.addEvent({ delay: 4500, callback: () => spawnDrone(this), callbackScope: this, loop: true });

    // --- Input: arrastrar para apuntar, soltar para lanzar ---
    this.input.on('pointerdown', (pointer) => {
        if (document.querySelector(".screen.active.modal-overlay")) return;
        if (this.isAnimating || this.projectile) return;
        this.aiming = true;
        this.dragStart = { x: pointer.x, y: pointer.y };
        this.player.setTexture('rh_lanza1');
    });

    this.input.on('pointermove', (pointer) => {
        if (!this.aiming) return;
        drawAimLine(this, pointer);
    });

    this.input.on('pointerup', (pointer) => {
        if (!this.aiming) return;
        this.aiming = false;
        this.aimGraphics.clear();

        const dx = pointer.x - LAUNCH_POINT.x;
        const dy = pointer.y - LAUNCH_POINT.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20) {
            this.player.setTexture('rh_conpala');
            return;
        }
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

    const power = dist / MAX_DRAG;
    const vx = -Math.cos(angle) * power * 900;
    const vy = -Math.sin(angle) * power * 900;

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

    dist = Math.min(dist, MAX_DRAG);
    const angle = Math.atan2(dy, dx);
    const power = dist / MAX_DRAG;

    shotsFired++;
    energy = Math.max(0, energy - 8);
    updateHUD();
    AudioEngine.launch();

    // Secuencia de lanzamiento: lanza1 ya estaba puesta al apuntar -> lanza2 -> lanza3 -> conpala
    scene.player.setTexture('rh_lanza2');
    scene.time.delayedCall(90, () => scene.player.setTexture('rh_lanza3'));
    scene.time.delayedCall(280, () => scene.player.setTexture('rh_conpala'));

    const vx = -Math.cos(angle) * power * 900;
    const vy = -Math.sin(angle) * power * 900;

    const mud = scene.physics.add.image(LAUNCH_POINT.x, LAUNCH_POINT.y, 'proyectil_barro').setScale(MUD_SCALE).setDepth(6);
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

            const dNest = Phaser.Math.Distance.Between(mud.x, mud.y, NEST_TARGET.x, NEST_TARGET.y);
            if (dNest < NEST_TARGET.radius) {
                checkLoop.remove();
                onHit(scene, mud);
                return;
            }

            for (const drone of scene.drones) {
                if (!drone.active) continue;
                const dDrone = Phaser.Math.Distance.Between(mud.x, mud.y, drone.x, drone.y);
                if (dDrone < 65) {
                    checkLoop.remove();
                    onDroneHit(scene, mud, drone);
                    return;
                }
            }

            if (mud.y > 760 || mud.x < -50 || mud.x > 1330) {
                checkLoop.remove();
                onMiss(scene, mud);
            }
        }
    });
}

function starBurst(scene, x, y, quantity = 14, lifespan = 550) {
    const starKeys = ['estrella', 'estrella78', 'estrella86', 'estrella22'];
    const emitter = scene.add.particles(x, y, Phaser.Utils.Array.GetRandom(starKeys), {
        speed: { min: 120, max: 300 },
        angle: { min: 0, max: 360 },
        scale: { start: STAR_SCALE, end: 0 },
        lifespan: lifespan,
        quantity: quantity,
        depth: 7
    });
    scene.time.delayedCall(lifespan + 50, () => emitter.destroy());
}

function onHit(scene, mud) {
    mud.destroy();
    scene.projectile = null;
    scene.isAnimating = false;
    hits++;

    combo++;
    bestCombo = Math.max(bestCombo, combo);
    const comboBonus = (combo - 1) * 15;
    const points = 50 + comboBonus;
    score += points;

    AudioEngine.hit();
    scene.cameras.main.shake(160, 0.008);
    starBurst(scene, NEST_TARGET.x, NEST_TARGET.y);

    floatingText(scene, NEST_TARGET.x, NEST_TARGET.y - 40, `+${points}`, '#f1c40f');
    if (combo > 1) {
        scene.comboText.setText(`🔥 COMBO x${combo}`);
        scene.tweens.add({ targets: scene.comboText, scale: { from: 1.3, to: 1 }, duration: 250, ease: 'Back.Out' });
    }

    if (nestStage < 6) {
        nestStage++;
        scene.nestPost.setTexture(`nest_${nestStage}`);
        scene.tweens.add({
            targets: scene.nestPost,
            scaleX: NEST_SCALE * 1.18, scaleY: NEST_SCALE * 1.18,
            duration: 150, yoyo: true, ease: 'Sine.easeOut'
        });
        AudioEngine.stage();
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

function onDroneHit(scene, mud, drone) {
    mud.destroy();
    scene.projectile = null;
    scene.isAnimating = false;

    const dx = drone.x, dy = drone.y;
    drone.destroy();
    scene.drones = scene.drones.filter(d => d !== drone);

    const bonus = 30;
    score += bonus;
    AudioEngine.hit();
    starBurst(scene, dx, dy, 10, 450);
    floatingText(scene, dx, dy, `+${bonus} 🛸`, '#3498db');

    updateHUD();

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
    AudioEngine.miss();
    scene.cameras.main.flash(120, 120, 20, 20, false);

    if (shotsFired >= 12 || energy <= 0) {
        scene.time.delayedCall(300, () => triggerMateBreak());
    }
}

function spawnDrone(scene) {
    if (!scene || !scene.sys || document.querySelector(".screen.active.modal-overlay")) return;

    const fromLeft = Math.random() < 0.5;
    const y = Phaser.Math.Between(140, 300);
    const speed = Phaser.Math.Between(110, 190);

    let x, vx, texKey;
    if (fromLeft) {
        x = -100; vx = speed; texKey = 'drone_de'; // vuela hacia la derecha
    } else {
        x = 1380; vx = -speed; texKey = 'drone_iz'; // vuela hacia la izquierda
    }

    const drone = scene.physics.add.image(x, y, texKey).setScale(DRONE_SCALE).setDepth(4);
    drone.body.setAllowGravity(false);
    drone.body.setVelocity(vx, 0);
    scene.drones.push(drone);
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

function update() {
    if (!gameScene || !gameScene.drones) return;
    gameScene.drones = gameScene.drones.filter(d => {
        if (!d.active) return false;
        if (d.x < -150 || d.x > 1430) { d.destroy(); return false; }
        return true;
    });
}

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

let mateAnimInterval = null;
let mateLoadTimer = null;

// Dura 10 segundos: +10% de energía por segundo
function triggerMateBreak() {
    openModal("mate-break-screen");
    const progress = document.getElementById("loader-progress");
    const energyText = document.getElementById("energy-text");
    progress.style.width = "0%";

    let loadPct = 0;
    startMateAnimation();

    clearInterval(mateLoadTimer);
    mateLoadTimer = setInterval(() => {
        loadPct += 10;
        progress.style.width = Math.min(loadPct, 100) + "%";
        energyText.textContent = `Cebando mate... ${Math.min(loadPct, 100)}%`;

        if (loadPct >= 100) {
            clearInterval(mateLoadTimer);
            energyText.textContent = "¡Energía al 100%!";
            stopMateAnimation();
            shotsFired = 0;
            energy = 100;
            updateHUD();
            setTimeout(() => closeModal("mate-break-screen"), 700);
        }
    }, 1000);
}

function startMateAnimation() {
    const img = document.getElementById("mate-anim-img");
    if (!img) return;
    const frames = ['assets/img/roberto/rh-mate1.png', 'assets/img/roberto/rh-mate2.png', 'assets/img/roberto/rh-mate3.png'];
    let i = 0;
    img.src = frames[0];
    clearInterval(mateAnimInterval);
    mateAnimInterval = setInterval(() => {
        i = (i + 1) % frames.length;
        img.src = frames[i];
    }, 500);
}
function stopMateAnimation() {
    if (mateAnimInterval) clearInterval(mateAnimInterval);
    mateAnimInterval = null;
}

function winGame() {
    totalAccumulatedScore += score;
    localStorage.setItem('rh_total_score', String(totalAccumulatedScore));

    const accuracy = shotsFired > 0 ? Math.round((hits / shotsFired) * 100) : 0;
    const stars = accuracy >= 80 ? "⭐⭐⭐" : (accuracy >= 50 ? "⭐⭐" : "⭐");

    document.getElementById("stars-result").innerText = stars;
    document.getElementById("accuracy-line").textContent = `🎯 Precisión: ${accuracy}% (${hits}/${shotsFired} tiros)`;
    document.getElementById("final-score").innerText = score;
    document.getElementById("total-score").innerText = totalAccumulatedScore;
    const comboLine = document.getElementById("best-combo-line");
    if (comboLine) comboLine.innerText = bestCombo > 1 ? `🔥 Mejor combo: x${bestCombo}` : '';

    openModal("game-over-modal");
    lanzarConfetiCelesteYBlanco();
    AudioEngine.win();
}

// --- 8. CERTIFICADO DESCARGABLE (usa la plantilla real con el recuadro celeste) ---
function fitText(ctx, text, maxWidth, baseSize) {
    let size = baseSize;
    ctx.font = `bold ${size}px Arial`;
    while (ctx.measureText(text).width > maxWidth && size > 22) {
        size -= 2;
        ctx.font = `bold ${size}px Arial`;
    }
    return size;
}

function downloadCertificate() {
    const cvs = document.getElementById("cert-canvas");
    const ctx = cvs.getContext("2d");
    const img = new Image();

    img.onload = () => {
        cvs.width = img.width;
        cvs.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Recuadro celeste de la plantilla (medido sobre la imagen original 1080x1920)
        const boxCenterX = 343;
        const boxLeft = 102, boxRight = 584;
        const boxWidth = boxRight - boxLeft - 40;

        ctx.textAlign = "center";

        const pName = (document.getElementById("player-name") && document.getElementById("player-name").value) || "Constructor/a";
        ctx.fillStyle = "#0b2545";
        fitText(ctx, pName, boxWidth, 46);
        ctx.fillText(pName, boxCenterX, 1190);

        ctx.fillStyle = "#0b2545";
        ctx.font = "bold 30px Arial";
        ctx.fillText(currentProv ? currentProv.name : "Argentina", boxCenterX, 1250);

        ctx.fillStyle = "#c0392b";
        ctx.font = "bold 42px Arial";
        ctx.fillText(`${score} puntos`, boxCenterX, 1340);

        const link = document.createElement('a');
        link.download = `Certificado-Roberto-Hornero.png`;
        link.href = cvs.toDataURL();
        link.click();
    };

    img.onerror = () => {
        showToast("No se pudo generar el certificado (falta la imagen base).");
    };

    img.src = "assets/img/ui/certificadodepuntos-rh.png";
}
