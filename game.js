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
let dronesDestroyed = 0;
let dronesSpawnedCount = 0;
let nestDefense = 0; // 0..3, cada 3 piedrazos de dron le quita una etapa al nido
let specialShotAvailable = true;
let specialModeArmed = false;
let totalAccumulatedScore = parseInt(localStorage.getItem('rh_total_score') || '0', 10);

// --- Estadísticas de la partida (para el panel admin / sponsors) ---
let gameStartTime = 0;
let mateBreaksCount = 0;

// --- 2.1 AUDIO ---
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
        thud: () => { tone(110, 0.2, 'sawtooth', 0.16); },
        miss: () => { tone(140, 0.25, 'sawtooth', 0.12); },
        stage: () => { tone(660, 0.09, 'sine', 0.18); tone(880, 0.12, 'sine', 0.16, 0.09); },
        special: () => { [880, 1046, 1318].forEach((f, i) => tone(f, 0.15, 'sine', 0.16, i * 0.06)); },
        win: () => { [660, 880, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'sine', 0.18, i * 0.11)); },
        click: () => { tone(400, 0.06, 'triangle', 0.12); },
        startSynthMusic: () => { getCtx(); scheduleSynthMusic(); },
        toggleMusic: () => { musicOn = !musicOn; return musicOn; },
        isMusicOn: () => musicOn
    };
})();

// --- 3. DATOS DE PROVINCIAS (por región) — pueden sobreescribirse desde el panel admin ---
const REGIONS_DATA = [
    {
        region: "Región Pampeana",
        provinces: [
            { id: "caba", name: "Ciudad Autónoma de Buenos Aires", status: "bloqueada" },
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

    loadRegionsAndRender();
    loadStartDashboards();

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
            database.ref(`votacion/${provName}`).transaction(current => (current || 0) + 1)
                .then(() => {
                    lanzarConfetiCelesteYBlanco();
                    AudioEngine.win();
                    showToast(`🎉 ¡Gracias por votar por ${provName}!`);
                })
                .catch(err => showToast(`No se pudo registrar el voto: ${err.message}`));
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
        const submitBtn = e.target.querySelector("button[type=submit]");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Guardando..."; }

        database.ref("ranking").push({
            nombre: name,
            provincia: prov,
            puntaje: totalAccumulatedScore,
            fecha: new Date().toISOString()
        }).then(() => {
            showToast("¡Puntaje guardado!");
            closeModal("save-data-modal");
            loadStartDashboards();
            showScreen("start-screen");
        }).catch(err => {
            showToast(`Error al guardar en Firebase: ${err.message}`);
            console.error("Error guardando ranking:", err);
        }).finally(() => {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Guardar y ver Ranking"; }
        });
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
    toast._t = setTimeout(() => toast.classList.remove("show"), 3200);
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

// --- 5. PROVINCIAS: mezcla overrides del panel admin (Firebase) con los datos base ---
function loadRegionsAndRender() {
    database.ref('provinceStatus').once('value').then(snap => {
        if (snap.exists()) {
            const overrides = snap.val();
            REGIONS_DATA.forEach(region => region.provinces.forEach(p => {
                if (overrides[p.id]) {
                    if (overrides[p.id].status) p.status = overrides[p.id].status;
                    if (overrides[p.id].bg) p.bg = overrides[p.id].bg;
                }
            }));
        }
    }).catch(err => console.log("No se pudieron cargar overrides de provincias:", err))
      .finally(() => {
        renderProvincesList();
        populateProvinceSelect();
    });
}

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
                    database.ref(`votacion/${prov.name}`).transaction(current => (current || 0) + 1)
                        .then(() => {
                            lanzarConfetiCelesteYBlanco();
                            showToast(`¡Votaste por ${prov.name}!`);
                        })
                        .catch(err => showToast(`No se pudo registrar el voto: ${err.message}`));
                });
            }
            list.appendChild(row);
        });
    });
}

// El selector del formulario de puntaje muestra las 23 provincias + CABA, sin importar su estado en el juego
function populateProvinceSelect() {
    const select = document.getElementById("player-province");
    select.innerHTML = '<option value="" disabled selected>Seleccioná tu provincia</option>';
    REGIONS_DATA.forEach(r => r.provinces.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.name;
        opt.textContent = p.name;
        select.appendChild(opt);
    }));
}

// --- 6. DASHBOARDS Y RANKING ---
function loadStartDashboards() {
    database.ref("ranking").once("value").then(snap => {
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
    }).catch(err => {
        console.log("Error de conexión con Firebase:", err);
        document.getElementById("start-national-ranking").innerHTML = "Sin conexión";
        document.getElementById("start-prov-ranking").innerHTML = "Sin conexión";
    });
}

function loadPodiumData() {
    database.ref("votacion").once("value").then(snapshot => {
        const votes = snapshot.val() || {};
        let sorted = Object.keys(votes).map(k => ({ prov: k, v: votes[k] })).sort((a, b) => b.v - a.v);
        while (sorted.length < 3) sorted.push({ prov: "-", v: 0 });

        document.getElementById("podium-1st-name").innerText = sorted[0].prov;
        document.getElementById("podium-1st-votes").innerText = `${sorted[0].v} votos`;
        document.getElementById("podium-2nd-name").innerText = sorted[1].prov;
        document.getElementById("podium-2nd-votes").innerText = `${sorted[1].v} votos`;
        document.getElementById("podium-3rd-name").innerText = sorted[2].prov;
        document.getElementById("podium-3rd-votes").innerText = `${sorted[2].v} votos`;
    }).catch(err => showToast(`No se pudo cargar la votación: ${err.message}`));
}

// --- 7. MOTOR PHASER 3 (EL JUEGO) ---
let game;
let gameScene;
let currentProv;

const GROUND_Y = 712;
const ROBERTO_SCALE = 0.055;
const ROBERTO_X = 200;
const NEST_SCALE = 0.18;
const MUD_SCALE = 0.016;
const STAR_SCALE = 0.012;       // chispas de partículas en los impactos
const STAR_PROJECTILE_SCALE = 0.018; // tamaño de cada estrella del disparo especial
const DRONE_SCALE = 0.13;
const SPECIAL_BTN = { x: 210, y: 108, radius: 26 };

const LAUNCH_POINT = { x: ROBERTO_X, y: GROUND_Y - 150 };
const NEST_TARGET = { x: 980, y: GROUND_Y - 240, radius: 75 };
const MAX_DRAG = 140;              // cabe entero dentro del canvas (antes 160 se salía de pantalla)
const SHOT_POWER = 1050;           // impulso máximo del disparo (antes 900)
const GRAVITY_Y = 900;

function startGamePhaser(prov) {
    currentProv = prov;
    nestStage = 0;
    score = 0;
    shotsFired = 0;
    hits = 0;
    combo = 0;
    bestCombo = 0;
    dronesDestroyed = 0;
    dronesSpawnedCount = 0;
    nestDefense = 0;
    specialShotAvailable = true;
    specialModeArmed = false;
    gameStartTime = Date.now();
    mateBreaksCount = 0;
    showScreen(null);

    database.ref('stats/gamesStarted').transaction(c => (c || 0) + 1);
    database.ref('stats/provinciaPlays/' + prov.id).transaction(c => (c || 0) + 1);

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

    this.load.image('proyectil_barro', 'assets/img/game/barro1.png');
    this.load.image('estrella', 'assets/img/game/estrella.png');
    this.load.image('estrella78', 'assets/img/game/estrella78.png');
    this.load.image('estrella86', 'assets/img/game/estrella86.png');
    this.load.image('estrella22', 'assets/img/game/estrella22.png');

    this.load.image('drone_de', 'assets/img/game/drone.de.png');
    this.load.image('drone_iz', 'assets/img/game/drone.iz.png');

    this.musicLoadFailed = false;
    this.load.on('loaderror', (file) => {
        if (file.key === 'milonga') this.musicLoadFailed = true;
    });
    this.load.audio('milonga', 'assets/audio/milonga-rh.mp3');
}

function create() {
    gameScene = this;
    this.aiming = false;
    this.drones = [];
    this.activeProjectiles = [];
    this.gameWon = false;

    this.add.image(640, 360, 'bg').setDisplaySize(1280, 720);

    // Poste/nido: UN solo sprite que cambia de textura según la etapa (parado en el piso, sin flotar)
    this.nestPost = this.add.image(NEST_TARGET.x, GROUND_Y, 'base_poste')
        .setOrigin(0.5, 1)
        .setScale(NEST_SCALE)
        .setDepth(3);

    this.targetRing = this.add.circle(NEST_TARGET.x, NEST_TARGET.y, NEST_TARGET.radius, 0xffffff, 0.06).setStrokeStyle(2, 0xffffff, 0.25).setDepth(1);
    this.tweens.add({ targets: this.targetRing, scale: { from: 1, to: 1.06 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Barra de defensa del nido (los drones la vacían con piedrazos; al llenarse, resta una etapa)
    this.nestDefenseLabel = this.add.text(NEST_TARGET.x, NEST_TARGET.y + 90, '🛡️ Nido', { fontSize: '13px', fill: '#ecf0f1' }).setOrigin(0.5).setDepth(12);
    this.nestDefenseBg = this.add.rectangle(NEST_TARGET.x, NEST_TARGET.y + 110, 130, 12, 0x0b1a2b, 0.7).setStrokeStyle(2, 0xffffff, 0.5).setDepth(11);
    this.nestDefenseFill = this.add.rectangle(NEST_TARGET.x - 63, NEST_TARGET.y + 110, 0, 8, 0xe67e22, 1).setOrigin(0, 0.5).setDepth(12);

    // Roberto: quieto, parado, sin flotar (sin tween de rebote)
    this.player = this.add.image(ROBERTO_X, GROUND_Y, 'rh_conpala')
        .setOrigin(0.5, 1)
        .setScale(ROBERTO_SCALE)
        .setDepth(4);

    this.aimGraphics = this.add.graphics().setDepth(5);

    // HUD
    this.uiTop = this.add.rectangle(640, 65, 1280, 130, 0x0b1a2b, 0.55).setDepth(10);

    this.barBg = this.add.rectangle(210, 40, 320, 22, 0x0b1a2b, 0.6).setStrokeStyle(2, 0xffffff, 0.5).setDepth(11);
    this.barFill = this.add.rectangle(210 - 158, 40, 4, 18, 0x27ae60, 1).setOrigin(0, 0.5).setDepth(12);
    this.stageLabel = this.add.text(210, 14, '🏗️ NIDO', { fontSize: '16px', fontStyle: 'bold', fill: '#f1c40f' }).setOrigin(0.5).setDepth(12);

    this.energyBg = this.add.rectangle(210, 72, 320, 14, 0x0b1a2b, 0.6).setStrokeStyle(2, 0xffffff, 0.4).setDepth(11);
    this.energyFill = this.add.rectangle(210 - 158, 72, 316, 10, 0xe74c3c, 1).setOrigin(0, 0.5).setDepth(12);

    // Botón de disparo especial (estrella titilando debajo de las barras)
    this.specialBtnIcon = this.add.image(SPECIAL_BTN.x, SPECIAL_BTN.y, 'estrella').setDepth(12);
    updateSpecialButtonVisual(this);

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

    // --- Drones: objetivos voladores. Cada 3er dron lanza una piedra al nido ---
    this.time.addEvent({
        delay: 4500,
        callback: () => { if (!this.gameWon) spawnDrone(this); },
        callbackScope: this,
        loop: true
    });

    // --- Input: apuntar y soltar para lanzar (o tocar la estrella especial) ---
    this.input.on('pointerdown', (pointer) => {
        if (document.querySelector(".screen.active.modal-overlay")) return;
        if (this.activeProjectiles.length > 0) return;

        const distToBtn = Phaser.Math.Distance.Between(pointer.x, pointer.y, SPECIAL_BTN.x, SPECIAL_BTN.y);
        if (distToBtn < SPECIAL_BTN.radius + 12) {
            armSpecialShot(this);
            return;
        }

        this.aiming = true;
        this.dragStart = { x: pointer.x, y: pointer.y };
        this.player.setTexture('rh_lanza1'); // apuntando
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
        launchShot(this, pointer);
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
    const vx = -Math.cos(angle) * power * SHOT_POWER;
    const vy = -Math.sin(angle) * power * SHOT_POWER;

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

// Secuencia de lanzamiento tal como la pidió el usuario:
// pointerdown (apuntar) -> lanza1 | pointerup (dispara) -> lanza2 -> (100ms) lanza3 + SALE EL PROYECTIL -> (400ms) conpala
function launchShot(scene, pointer) {
    const dx = pointer.x - LAUNCH_POINT.x;
    const dy = pointer.y - LAUNCH_POINT.y;
    let dist = Math.min(Math.sqrt(dx * dx + dy * dy), MAX_DRAG);
    const angle = Math.atan2(dy, dx);
    const power = dist / MAX_DRAG;

    shotsFired++;
    energy = Math.max(0, energy - 8);
    updateHUD();
    AudioEngine.launch();

    const usingSpecial = specialModeArmed;
    specialModeArmed = false;
    updateSpecialButtonVisual(scene);

    scene.player.setTexture('rh_lanza2'); // dispara / inicia el impulso

    scene.time.delayedCall(100, () => {
        scene.player.setTexture('rh_lanza3'); // suelta la pala
        if (usingSpecial) {
            AudioEngine.special();
            fireSpecialStars(scene, angle, power);
        } else {
            const vx = -Math.cos(angle) * power * SHOT_POWER;
            const vy = -Math.sin(angle) * power * SHOT_POWER;
            spawnProjectile(scene, 'proyectil_barro', vx, vy, MUD_SCALE);
        }
    });

    scene.time.delayedCall(400, () => {
        scene.player.setTexture('rh_conpala'); // vuelve a la pose de descanso
    });
}

// Disparo especial "The Blues": se separa en 3 estrellas (78, 86 y 22)
function fireSpecialStars(scene, baseAngle, power) {
    const spreadDeg = 9;
    const configs = [
        { offset: -spreadDeg, tex: 'estrella78' },
        { offset: 0, tex: 'estrella86' },
        { offset: spreadDeg, tex: 'estrella22' }
    ];
    configs.forEach(cfg => {
        const a = baseAngle + Phaser.Math.DegToRad(cfg.offset);
        const vx = -Math.cos(a) * power * SHOT_POWER;
        const vy = -Math.sin(a) * power * SHOT_POWER;
        spawnProjectile(scene, cfg.tex, vx, vy, STAR_PROJECTILE_SCALE);
    });
}

function spawnProjectile(scene, texKey, vx, vy, scaleToUse) {
    const proj = scene.physics.add.image(LAUNCH_POINT.x, LAUNCH_POINT.y, texKey).setScale(scaleToUse).setDepth(6);
    proj.body.setAllowGravity(true);
    proj.body.setVelocity(vx, vy);
    proj.body.setCircle(proj.width * 0.3);
    scene.activeProjectiles.push(proj);

    const checkLoop = scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
            if (!proj.active) { checkLoop.remove(); return; }
            proj.rotation += 0.2;

            const dNest = Phaser.Math.Distance.Between(proj.x, proj.y, NEST_TARGET.x, NEST_TARGET.y);
            if (dNest < NEST_TARGET.radius) {
                checkLoop.remove();
                resolveProjectile(scene, proj);
                onHit(scene);
                return;
            }

            for (const drone of scene.drones) {
                if (!drone.active) continue;
                const dDrone = Phaser.Math.Distance.Between(proj.x, proj.y, drone.x, drone.y);
                if (dDrone < 65) {
                    checkLoop.remove();
                    resolveProjectile(scene, proj);
                    onDroneHit(scene, drone);
                    return;
                }
            }

            if (proj.y > 760 || proj.x < -50 || proj.x > 1330) {
                checkLoop.remove();
                resolveProjectile(scene, proj);
                onMiss(scene);
            }
        }
    });
}

function resolveProjectile(scene, proj) {
    proj.destroy();
    scene.activeProjectiles = scene.activeProjectiles.filter(p => p !== proj);
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

function onHit(scene) {
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
        scene.gameWon = true;
        scene.time.delayedCall(900, winGame);
        return;
    }

    if (shotsFired >= 10 || energy <= 0) {
        scene.time.delayedCall(500, () => triggerMateBreak());
    }
}

function onDroneHit(scene, drone) {
    const dx = drone.x, dy = drone.y;
    drone.destroy();
    scene.drones = scene.drones.filter(d => d !== drone);
    dronesDestroyed++;

    const bonus = 30;
    score += bonus;
    AudioEngine.hit();
    starBurst(scene, dx, dy, 10, 450);
    floatingText(scene, dx, dy, `+${bonus} 🛸`, '#3498db');

    updateHUD();

    if (shotsFired >= 10 || energy <= 0) {
        scene.time.delayedCall(500, () => triggerMateBreak());
    }
}

function onMiss(scene) {
    combo = 0;
    scene.comboText.setText('');
    AudioEngine.miss();
    scene.cameras.main.flash(120, 120, 20, 20, false);

    if (shotsFired >= 12 || energy <= 0) {
        scene.time.delayedCall(300, () => triggerMateBreak());
    }
}

// --- Drones: vuelan cruzando la pantalla. Cada 3er dron generado le tira una piedra al nido ---
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

    dronesSpawnedCount++;
    const isThrower = (dronesSpawnedCount % 3 === 0);

    const drone = scene.physics.add.image(x, y, texKey).setScale(DRONE_SCALE).setDepth(4);
    drone.body.setAllowGravity(false);
    drone.body.setVelocity(vx, 0);
    drone.isThrower = isThrower;
    drone.hasThrown = false;
    if (isThrower) drone.setTint(0xffb3b3);

    scene.drones.push(drone);
}

function throwRockAtNest(scene, fromX, fromY) {
    const rock = scene.add.image(fromX, fromY, 'proyectil_barro').setScale(MUD_SCALE * 1.15).setTint(0x777777).setDepth(6);
    scene.tweens.add({
        targets: rock,
        x: NEST_TARGET.x,
        y: NEST_TARGET.y,
        duration: 550,
        ease: 'Quad.easeIn',
        onComplete: () => {
            rock.destroy();
            if (scene.gameWon) return;

            nestDefense++;
            AudioEngine.thud();
            scene.cameras.main.shake(140, 0.01);
            updateNestDefenseBar(scene);

            if (nestDefense >= 3) {
                nestDefense = 0;
                updateNestDefenseBar(scene);
                if (nestStage > 0) {
                    nestStage--;
                    scene.nestPost.setTexture(nestStage === 0 ? 'base_poste' : `nest_${nestStage}`);
                    floatingText(scene, NEST_TARGET.x, NEST_TARGET.y - 30, '💥 -1 construcción', '#e74c3c');
                    updateHUD();
                }
            }
        }
    });
}

function updateNestDefenseBar(scene) {
    const ratio = nestDefense / 3;
    scene.tweens.add({ targets: scene.nestDefenseFill, width: 126 * ratio, duration: 200 });
}

// --- Disparo especial ---
function armSpecialShot(scene) {
    if (!specialShotAvailable || scene.aiming || scene.activeProjectiles.length > 0) return;
    specialShotAvailable = false;
    specialModeArmed = true;
    AudioEngine.special();
    floatingText(scene, SPECIAL_BTN.x, SPECIAL_BTN.y - 20, '⭐ ¡Listo, apuntá!', '#3498db');
    updateSpecialButtonVisual(scene);
}

function updateSpecialButtonVisual(scene) {
    if (scene.specialBtnBlink) { scene.specialBtnBlink.stop(); scene.specialBtnBlink = null; }
    const baseScale = STAR_SCALE * 1.7;

    if (specialModeArmed) {
        scene.specialBtnIcon.setTint(0x3498db);
        scene.specialBtnIcon.setAlpha(1);
        scene.specialBtnIcon.setScale(baseScale * 1.2);
    } else if (specialShotAvailable) {
        scene.specialBtnIcon.setTint(0xffffff);
        scene.specialBtnIcon.setAlpha(1);
        scene.specialBtnIcon.setScale(baseScale);
        scene.specialBtnBlink = scene.tweens.add({
            targets: scene.specialBtnIcon,
            alpha: { from: 1, to: 0.35 },
            scale: { from: baseScale, to: baseScale * 1.15 },
            duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    } else {
        scene.specialBtnIcon.setTint(0x555555);
        scene.specialBtnIcon.setAlpha(0.6);
        scene.specialBtnIcon.setScale(baseScale);
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

function update() {
    if (!gameScene || !gameScene.drones) return;

    gameScene.drones.forEach(d => {
        if (d.active && d.isThrower && !d.hasThrown && !gameScene.gameWon) {
            if (Math.abs(d.x - NEST_TARGET.x) < 60) {
                d.hasThrown = true;
                throwRockAtNest(gameScene, d.x, d.y);
            }
        }
    });

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
    mateBreaksCount++;
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
            specialShotAvailable = true;
            specialModeArmed = false;
            if (gameScene) updateSpecialButtonVisual(gameScene);
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

// --- 8. ESTRELLAS FINALES (estilo Mundial) ---
// estrella78 se gana siempre al terminar el nido.
// estrella86 se suma si cumple UNO de los dos desafíos (3+ drones derribados o 500+ puntos).
// estrella22 se suma si cumple AMBOS desafíos.
function computeStars() {
    const challengeDrones = dronesDestroyed >= 3;
    const challengeScore = score >= 500;
    let count = 1;
    if (challengeDrones || challengeScore) count = 2;
    if (challengeDrones && challengeScore) count = 3;
    return count;
}

function renderStars(starCount) {
    const container = document.getElementById('stars-result');
    container.innerHTML = '';
    container.classList.remove('special-3star');
    const starFiles = [
        'assets/img/game/estrella78.png',
        'assets/img/game/estrella86.png',
        'assets/img/game/estrella22.png'
    ];
    for (let i = 0; i < starCount; i++) {
        const img = document.createElement('img');
        img.src = starFiles[i];
        img.alt = 'Estrella';
        img.width = 60;
        img.height = 60;
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.maxWidth = '60px';
        img.style.maxHeight = '60px';
        img.style.flexShrink = '0';
        container.appendChild(img);
        setTimeout(() => img.classList.add('pop-in'), i * 450);
    }
    if (starCount === 3) {
        setTimeout(() => {
            container.classList.add('special-3star');
            lanzarConfetiCelesteYBlanco();
        }, starCount * 450 + 150);
    }
}

function winGame() {
    totalAccumulatedScore += score;
    localStorage.setItem('rh_total_score', String(totalAccumulatedScore));

    const durationSeconds = Math.round((Date.now() - gameStartTime) / 1000);
    database.ref('sessions').push({
        provincia: currentProv ? currentProv.name : 'Desconocida',
        provinciaId: currentProv ? currentProv.id : 'desconocida',
        duracionSegundos: durationSeconds,
        mateBreaks: mateBreaksCount,
        mateSegundos: mateBreaksCount * 10,
        puntaje: score,
        dronesDerribados: dronesDestroyed,
        completado: true,
        fecha: new Date().toISOString()
    }).catch(err => console.log("No se pudo registrar la sesión:", err));
    database.ref('stats/gamesCompleted').transaction(c => (c || 0) + 1);

    const starCount = computeStars();
    renderStars(starCount);

    document.getElementById("accuracy-line").textContent = `🎯 ${hits} aciertos al nido · 🛸 ${dronesDestroyed} drones derribados`;
    document.getElementById("final-score").innerText = score;
    document.getElementById("total-score").innerText = totalAccumulatedScore;
    const comboLine = document.getElementById("best-combo-line");
    if (comboLine) comboLine.innerText = bestCombo > 1 ? `🔥 Mejor combo: x${bestCombo}` : '';

    openModal("game-over-modal");
    lanzarConfetiCelesteYBlanco();
    AudioEngine.win();
}

// --- 9. CERTIFICADO DESCARGABLE ---
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
