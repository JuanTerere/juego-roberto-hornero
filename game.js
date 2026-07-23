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

const PROVINCES_DATA = [
    { id: "tucuman", name: "Tucumán", status: "Disponible", bg: "casitade-tucuman.png" },
    { id: "bsas", name: "Buenos Aires", status: "Disponible", bg: "obelisco-bs-as.png" },
    { id: "cordoba", name: "Córdoba", status: "Disponible", bg: "catedral-de-cordoba.png" }
];

// --- 3. LÓGICA DE INTERFAZ Y EVENTOS DOM ---
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-play-main").addEventListener("click", () => showScreen("province-screen"));
    document.getElementById("btn-back-menu").addEventListener("click", () => showScreen("start-screen"));
    
    document.getElementById("btn-open-campaign").addEventListener("click", () => {
        document.getElementById("campaign-modal").classList.add("active");
    });
    document.getElementById("btn-close-campaign").addEventListener("click", () => {
        document.getElementById("campaign-modal").classList.remove("active");
    });

    const grid = document.getElementById("provinces-grid");
    PROVINCES_DATA.forEach(prov => {
        const card = document.createElement("div");
        card.className = `prov-card ${prov.status === 'Disponible' ? 'active' : 'locked'}`;
        card.innerHTML = `<h3>${prov.name}</h3><p>${prov.status}</p>`;
        if (prov.status === 'Disponible') card.addEventListener("click", () => startGamePhaser(prov));
        grid.appendChild(card);
    });

    document.querySelectorAll(".btn-vote").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const provName = e.target.getAttribute("data-prov");
            database.ref(`votacion/${provName}`).transaction(current => (current || 0) + 1);
            lanzarConfetiCelesteYBlanco();
            alert(`🎉 ¡Gracias por votar por ${provName}! 🇦🇷`);
        });
    });

    document.getElementById("btn-view-votes").addEventListener("click", () => {
        loadPodiumData();
        showScreen("podium-screen");
    });
    document.getElementById("btn-back-from-podium").addEventListener("click", () => showScreen("start-screen"));

    document.getElementById("score-form").addEventListener("submit", (e) => {
        e.preventDefault();
        database.ref("ranking").push({
            nombre: document.getElementById("player-name").value,
            provincia: document.getElementById("player-province").value,
            puntaje: score,
            fecha: new Date().toISOString()
        });
        showScreen("start-screen");
    });
    
    loadRanking();
});

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    if (screenId) document.getElementById(screenId).classList.add("active");
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

// --- 4. MOTOR PHASER 3 (EL JUEGO) ---
let game;
let gameScene;
let currentProv;

function startGamePhaser(prov) {
    currentProv = prov;
    nestStage = 0;
    score = 0;
    shotsFired = 0;
    energy = 100;
    showScreen(null);

    if (game) game.destroy(true);

    const config = {
        type: Phaser.AUTO,
        parent: "game-container",
        width: 1280,
        height: 720,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
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

    this.load.image('proyectil_barro', 'assets/img/game/proyectil-barro.png');
    this.load.image('estrella', 'assets/img/game/estrella.png');
    this.load.image('estrella78', 'assets/img/game/estrella78.png');
    this.load.image('estrella86', 'assets/img/game/estrella86.png');
    this.load.image('estrella22', 'assets/img/game/estrella22.png');
    
    // ⚠️ Imagen del Dron (¡Asegurate de crear este archivo en la carpeta!)
    this.load.image('dron', 'assets/img/game/drone.png');
}

function create() {
    gameScene = this;

    // Fondo
    let bg = this.add.image(640, 360, 'bg').setDisplaySize(1280, 720);

    // --- ESCALAS Y POSICIONES CORREGIDAS ---
    // Roberto Hornero (Abajo a la izquierda). Bajamos mucho la escala (ej. 0.25)
    this.roberto = this.add.image(250, 550, 'rh_conpala').setScale(0.25);

    // Poste (Abajo a la derecha)
    this.poste = this.add.image(1050, 600, 'base_poste').setScale(0.3);
    
    // Nido (Sobre el poste)
    this.nestSprite = this.add.image(1050, 480, 'nest_1').setScale(0.3);
    this.nestSprite.setVisible(false);

    // HUD (Textos arriba)
    this.hudText = this.add.text(20, 20, '🏗️ Etapa: 0/6 | ❤️ Energía: 100 | 🏆 Puntos: 0', { 
        fontSize: '24px', fill: '#ffffff', backgroundColor: '#00000088', padding: { x: 10, y: 5 } 
    });

    // Grupo para gestionar los drones
    this.dronesGroup = this.add.group();

    // Evento para generar un dron cada 3 segundos
    this.time.addEvent({
        delay: 3000,
        callback: spawnDron,
        callbackScope: this,
        loop: true
    });

    this.input.on('pointerdown', (pointer) => {
        if (document.querySelector(".screen.active:not(#ui-container)")) return;
        fireMud();
    });
}

function update() {}

function spawnDron() {
    // Generar dron en el lado izquierdo o derecho aleatoriamente
    let startX = -50;
    let endX = 1330;
    let startY = Phaser.Math.Between(50, 350); // Altura aleatoria en el cielo

    // 50% de probabilidad de que salga de derecha a izquierda
    if (Math.random() > 0.5) {
        startX = 1330;
        endX = -50;
    }

    let dron = gameScene.add.image(startX, startY, 'dron').setScale(0.15); // Escala pequeña para el dron
    gameScene.dronesGroup.add(dron);

    // Animación de movimiento del dron
    gameScene.tweens.add({
        targets: dron,
        x: endX,
        duration: Phaser.Math.Between(3000, 5000), // Velocidad aleatoria
        onComplete: () => { dron.destroy(); } // Se elimina cuando sale de la pantalla
    });
}

function fireMud() {
    shotsFired++;
    energy -= 8;
    score += 50;

    if (nestStage < 6) {
        nestStage++;
        gameScene.nestSprite.setVisible(true);
        gameScene.nestSprite.setTexture(`nest_${nestStage}`);
    }

    updateHUD();

    if (nestStage >= 6) {
        setTimeout(winGame, 1000);
        return;
    }

    if (shotsFired >= 12 || energy <= 0) {
        triggerMateBreak();
    }
}

function updateHUD() {
    gameScene.hudText.setText(`🏗️ Etapa: ${nestStage}/6 | ❤️ Energía: ${Math.max(energy, 0)} | 🏆 Puntos: ${score}`);
}

function triggerMateBreak() {
    showScreen("mate-break-screen");
    const progress = document.getElementById("loader-progress");
    progress.style.width = "0%";
    setTimeout(() => progress.style.width = "100%", 10);

    setTimeout(() => {
        shotsFired = 0;
        energy = 100;
        updateHUD();
        showScreen(null);
    }, 5000);
}

function winGame() {
    document.getElementById("final-score").innerText = score;
    document.getElementById("stars-result").innerText = score > 300 ? "⭐⭐⭐" : "⭐⭐";
    showScreen("game-over-modal");
    lanzarConfetiCelesteYBlanco();
}
