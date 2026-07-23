// --- 1. CONFIGURACIÓN FIREBASE EXACTA ---
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

// --- 2. ESTRUCTURA GEOGRÁFICA DE ARGENTINA ---
const REGIONS_DATA = [
    {
        region: "Ciudad Autónoma",
        provinces: [ { id: "caba", name: "Ciudad Autónoma de Buenos Aires (CABA)", status: "bloqueada", icon: "🔒" } ]
    },
    {
        region: "Región Pampeana",
        provinces: [
            { id: "bsas", name: "Buenos Aires (Provincia)", status: "habilitada", bg: "obelisco-bs-as.png", icon: "🔓" },
            { id: "cordoba", name: "Córdoba", status: "habilitada", bg: "catedral-de-cordoba.png", icon: "🔓" },
            { id: "entrerios", name: "Entre Ríos", status: "bloqueada", icon: "🔒" },
            { id: "lapampa", name: "La Pampa", status: "bloqueada", icon: "🔒" },
            { id: "santafe", name: "Santa Fe", status: "votacion", icon: "🟡" }
        ]
    },
    {
        region: "Región del Norte Grande (NOA y NEA)",
        provinces: [
            { id: "chaco", name: "Chaco", status: "bloqueada", icon: "🔒" },
            { id: "catamarca", name: "Catamarca", status: "bloqueada", icon: "🔒" },
            { id: "corrientes", name: "Corrientes", status: "bloqueada", icon: "🔒" },
            { id: "formosa", name: "Formosa", status: "bloqueada", icon: "🔒" },
            { id: "jujuy", name: "Jujuy", status: "bloqueada", icon: "🔒" },
            { id: "misiones", name: "Misiones", status: "votacion", icon: "🟡" },
            { id: "salta", name: "Salta", status: "bloqueada", icon: "🔒" },
            { id: "santiago", name: "Santiago del Estero", status: "bloqueada", icon: "🔒" },
            { id: "tucuman", name: "Tucumán", status: "habilitada", bg: "casitade-tucuman.png", icon: "🔓" }
        ]
    },
    {
        region: "Región del Nuevo Cuyo",
        provinces: [
            { id: "larioja", name: "La Rioja", status: "bloqueada", icon: "🔒" },
            { id: "mendoza", name: "Mendoza", status: "bloqueada", icon: "🔒" },
            { id: "sanjuan", name: "San Juan", status: "bloqueada", icon: "🔒" },
            { id: "sanluis", name: "San Luis", status: "bloqueada", icon: "🔒" }
        ]
    },
    {
        region: "Región Patagónica",
        provinces: [
            { id: "chubut", name: "Chubut", status: "votacion", icon: "🟡" },
            { id: "neuquen", name: "Neuquén", status: "bloqueada", icon: "🔒" },
            { id: "rionegro", name: "Río Negro", status: "bloqueada", icon: "🔒" },
            { id: "santacruz", name: "Santa Cruz", status: "bloqueada", icon: "🔒" },
            { id: "tierradelfuego", name: "Tierra del Fuego", status: "bloqueada", icon: "🔒" }
        ]
    }
];

// Variables Globales
let totalAccumulatedScore = 0; 
let sessionScore = 0; let nestStage = 0; let energy = 100;
let shotsFired = 0; let dronesDestroyed = 0; let nestDamage = 0;
let game; let gameScene; let currentProv;
let isAiming = false; let dragStartX, dragStartY; let aimGraphics;
let mateInterval; let mateEnergyLoad = 0;
let bgMusic; let isMusicPlaying = true;

// --- 3. INICIALIZACIÓN DOM ---
document.addEventListener("DOMContentLoaded", () => {
    loadStartDashboards();
    renderProvincesList();
    populateSelectProvinces();

    // Botones de Navegación
    document.getElementById("btn-play-main").addEventListener("click", () => showScreen("province-screen"));
    document.getElementById("btn-back-menu").addEventListener("click", () => {
        if(game) game.destroy(true);
        loadStartDashboards();
        showScreen("start-screen");
    });
    document.getElementById("btn-view-podium").addEventListener("click", showVotingPodium);
    document.getElementById("btn-close-podium").addEventListener("click", () => document.getElementById("podium-modal").classList.remove("active"));
    
    // Votación en Inicio
    document.querySelectorAll(".btn-vote").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const provName = e.target.getAttribute("data-prov");
            database.ref(`votacion/${provName}`).transaction(current => (current || 0) + 1);
            lanzarConfetiCelesteYBlanco();
        });
    });

    // Controles de Partida
    document.getElementById("btn-return-game").addEventListener("click", returnFromMate);
    document.getElementById("btn-play-more").addEventListener("click", () => {
        document.getElementById("game-over-modal").classList.remove("active");
        if(bgMusic) bgMusic.stop();
        if(game) game.destroy(true);
        showScreen("province-screen");
    });
    
    document.getElementById("btn-save-score").addEventListener("click", () => {
        document.getElementById("game-over-modal").classList.remove("active");
        document.getElementById("save-data-modal").classList.add("active");
    });
    
    document.getElementById("btn-confirm-save").addEventListener("click", saveScore);
    document.getElementById("btn-download-cert").addEventListener("click", downloadCertificate);
    
    // Botón WhatsApp
    document.getElementById("btn-share-wa").addEventListener("click", () => {
        const playerName = document.getElementById("player-name").value || "Un amigo";
        const msg = `¡Ayuda a Roberto Hornero! Soy ${playerName} y acabo de sumar ${totalAccumulatedScore} puntos construyendo nidos por toda la Argentina. ¡Entrá a jugar y superá mi puntaje! https://juanterere.github.io/juego-roberto-hornero/`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    });

    // Botón Música UI
    document.getElementById("btn-toggle-music").addEventListener("click", () => {
        if (!bgMusic) return;
        isMusicPlaying = !isMusicPlaying;
        if (isMusicPlaying) { bgMusic.resume(); document.getElementById("btn-toggle-music").innerText = "🔊 Música ON"; } 
        else { bgMusic.pause(); document.getElementById("btn-toggle-music").innerText = "🔇 Música OFF"; }
    });
});

function showScreen(screenId) {
    document.querySelectorAll(".screen:not(.modal-overlay)").forEach(s => s.classList.remove("active"));
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

// --- 4. RENDERIZADO DE LISTAS ---
function renderProvincesList() {
    const list = document.getElementById("provinces-grid");
    list.innerHTML = "";
    REGIONS_DATA.forEach(regionObj => {
        const title = document.createElement("div");
        title.className = "region-title";
        title.innerText = regionObj.region;
        list.appendChild(title);

        regionObj.provinces.forEach(prov => {
            const row = document.createElement("div");
            row.className = `prov-row prov-${prov.status}`;
            row.innerHTML = `<span>${prov.name}</span> <span>${prov.icon}</span>`;
            
            if (prov.status === "habilitada") row.addEventListener("click", () => startGamePhaser(prov));
            if (prov.status === "votacion") row.addEventListener("click", () => {
                database.ref(`votacion/${prov.name}`).transaction(current => (current || 0) + 1);
                lanzarConfetiCelesteYBlanco();
                alert(`¡Votaste por ${prov.name}!`);
            });
            list.appendChild(row);
        });
    });
}

function populateSelectProvinces() {
    const select = document.getElementById("player-province");
    REGIONS_DATA.forEach(r => r.provinces.forEach(p => {
        select.innerHTML += `<option value="${p.name}">${p.name}</option>`;
    }));
}

function loadStartDashboards() {
    database.ref("ranking").once("value", snap => {
        let allScores = [];
        snap.forEach(c => allScores.push(c.val()));
        
        allScores.sort((a, b) => b.puntaje - a.puntaje);
        let natHtml = "";
        allScores.slice(0, 3).forEach((item, i) => natHtml += `<p>#${i+1} <strong>${item.nombre}</strong>: ${item.puntaje}</p>`);
        document.getElementById("start-national-ranking").innerHTML = natHtml || "Aún no hay jugadas";

        let provCount = {};
        allScores.forEach(item => provCount[item.provincia] = (provCount[item.provincia] || 0) + 1);
        let provSorted = Object.keys(provCount).map(p => ({prov: p, count: provCount[p]})).sort((a,b) => b.count - a.count);
        let provHtml = "";
        provSorted.slice(0, 3).forEach((item, i) => provHtml += `<p>#${i+1} <strong>${item.prov}</strong>: ${item.count} jug.</p>`);
        document.getElementById("start-prov-ranking").innerHTML = provHtml || "Aún no hay jugadas";
    });
}

function showVotingPodium() {
    database.ref("votacion").once("value", snap => {
        const votes = snap.val() || {};
        let sorted = Object.keys(votes).map(k => ({ prov: k, v: votes[k] })).sort((a, b) => b.v - a.v);
        let html = "";
        sorted.forEach((item, i) => html += `<p>#${i+1} <strong>${item.prov}</strong> - ${item.v} votos</p>`);
        document.getElementById("voting-results-list").innerHTML = html || "No hay votos aún.";
        document.getElementById("podium-modal").classList.add("active");
    });
}

// --- 5. PHASER 3 MOTOR ---
function startGamePhaser(prov) {
    currentProv = prov; nestStage = 0; sessionScore = 0; shotsFired = 0; energy = 100; dronesDestroyed = 0; nestDamage = 0;
    showScreen("game-container");
    if (game) game.destroy(true);

    const config = {
        type: Phaser.AUTO, parent: "game-container", width: 1280, height: 720,
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: { preload: preload, create: create, update: update }
    };
    game = new Phaser.Game(config);
}

function preload() {
    this.load.image('bg', `assets/escenarios/${currentProv.bg}`);
    this.load.image('base_poste', 'assets/img/game/HorneroA.png');
    for(let i=1; i<=6; i++) this.load.image(`nest_${i}`, `assets/img/game/Hornero${i+1}.png`);

    this.load.image('rh_conpala', 'assets/img/roberto/rh-conpala.png');
    this.load.image('rh_lanza1', 'assets/img/roberto/rh-lanza1.png');
    this.load.image('rh_lanza2', 'assets/img/roberto/rh-lanza2.png');
    this.load.image('rh_lanza3', 'assets/img/roberto/rh-lanza3.png');

    this.load.image('proyectil_barro', 'assets/img/game/proyectil-barro.png');
    this.load.image('drone-iz', 'assets/img/game/drone-iz.png');
    this.load.image('drone-de', 'assets/img/game/drone-de.png');
    
    this.load.image('estrella78', 'assets/img/game/estrella78.png');
    this.load.image('estrella86', 'assets/img/game/estrella86.png');
    this.load.image('estrella22', 'assets/img/game/estrella22.png');

    // Música
    this.load.audio('milonga', 'assets/audio/milonga-rh.mp3');
}

function create() {
    gameScene = this;
    this.add.image(640, 360, 'bg').setDisplaySize(1280, 720);

    // Reproducir música
    if(!bgMusic) { bgMusic = this.sound.add('milonga', { loop: true, volume: 0.5 }); }
    if(isMusicPlaying && !bgMusic.isPlaying) bgMusic.play();

    // Roberto muy chiquito (0.08) y Proyectil chiquito (0.04)
    this.roberto = this.physics.add.sprite(150, 620, 'rh_conpala').setScale(0.08);
    this.poste = this.add.image(1150, 600, 'base_poste').setScale(0.2);
    this.nestSprite = this.add.image(1150, 480, 'nest_1').setScale(0.2).setVisible(false);
    
    this.hudText = this.add.text(20, 20, '', { fontSize: '28px', fill: '#fff', backgroundColor: '#000', padding: 10 });
    this.nestDamageBar = this.add.graphics();
    updateHUD();
    
    aimGraphics = this.add.graphics();
    this.proyectiles = this.physics.add.group();
    this.dronesGroup = this.physics.add.group();

    // COLISIONES: Dron y Proyectil
    this.physics.add.overlap(this.proyectiles, this.dronesGroup, (proyectil, dron) => {
        crearExplosion(proyectil.x, proyectil.y, 0xffaa00); // Explosión de fuego/amarilla
        proyectil.destroy(); dron.destroy();
        dronesDestroyed++; sessionScore += 50; updateHUD();
    });

    // Control Apuntado (Solucionado con delayedCall de Phaser)
    this.input.on('pointerdown', (pointer) => {
        if (energy <= 0 || shotsFired >= 10 || document.querySelector('.modal-overlay.active')) return;
        isAiming = true; dragStartX = pointer.x; dragStartY = pointer.y;
        this.roberto.setTexture('rh_lanza1');
    });

    this.input.on('pointermove', (pointer) => {
        if (!isAiming) return;
        aimGraphics.clear(); aimGraphics.lineStyle(6, 0xffffff, 0.8);
        aimGraphics.lineBetween(this.roberto.x, this.roberto.y, this.roberto.x - (pointer.x - dragStartX), this.roberto.y - (pointer.y - dragStartY));
    });

    this.input.on('pointerup', (pointer) => {
        if (!isAiming) return;
        isAiming = false; aimGraphics.clear();

        // Secuencia limpia de animaciones nativas de Phaser
        this.roberto.setTexture('rh_lanza2');
        this.time.delayedCall(100, () => {
            if(this.roberto) this.roberto.setTexture('rh_lanza3');
            fireMud(pointer.x, pointer.y);
        });
        this.time.delayedCall(400, () => { if(this.roberto) this.roberto.setTexture('rh_conpala'); });
    });

    // Drones
    this.time.addEvent({ delay: 3500, callback: spawnDron, callbackScope: this, loop: true });
}

function update() {
    // Barra del Nido gruesa (20px)
    gameScene.nestDamageBar.clear();
    gameScene.nestDamageBar.fillStyle(0x000000, 0.8);
    gameScene.nestDamageBar.fillRect(1100, 680, 100, 20);
    gameScene.nestDamageBar.fillStyle(0xff0000, 1);
    gameScene.nestDamageBar.fillRect(1100, 680, (nestDamage / 3) * 100, 20);
}

function fireMud(releaseX, releaseY) {
    shotsFired++; energy -= 10;
    
    // Proyectil visible y más chico que Roberto
    let barro = gameScene.proyectiles.create(gameScene.roberto.x, gameScene.roberto.y - 10, 'proyectil_barro');
    barro.setScale(0.04); 
    
    let forceX = (dragStartX - releaseX) * 3;
    let forceY = (dragStartY - releaseY) * 3;
    barro.setVelocity(forceX, forceY);
    barro.setGravityY(500); // Caída pronunciada

    // Verifica si cae en la zona del nido
    gameScene.time.delayedCall(1200, () => {
        if (barro.active && barro.x > 1050 && barro.y > 400 && barro.y < 650) {
            crearExplosion(barro.x, barro.y, 0x5c4033); // Explosión de barro
            construirNido();
            barro.destroy();
        } else if (barro.active) {
            barro.destroy(); // Se pierde
        }
    });

    updateHUD();
    if (shotsFired >= 10 || energy <= 0) triggerMateBreak();
}

function crearExplosion(x, y, tintColor) {
    let particles = gameScene.add.particles('proyectil_barro');
    let emitter = particles.createEmitter({
        speed: 150, scale: { start: 0.05, end: 0 }, tint: tintColor, lifespan: 400, blendMode: 'NORMAL'
    });
    emitter.explode(15, x, y);
    gameScene.time.delayedCall(500, () => particles.destroy());
}

function construirNido() {
    if (nestStage < 6) {
        nestStage++; sessionScore += 60; 
        gameScene.nestSprite.setVisible(true);
        gameScene.nestSprite.setTexture(`nest_${nestStage}`);
        updateHUD();
        if (nestStage >= 6) gameScene.time.delayedCall(1000, winGame);
    }
}

function spawnDron() {
    if (gameScene.dronesGroup.countActive() >= 3) return;

    let izq = Math.random() > 0.5;
    let startX = izq ? -50 : 1330; let endX = izq ? 1330 : -50;
    let startY = Phaser.Math.Between(50, 250);
    
    let sprite = izq ? 'drone-de' : 'drone-iz';
    let dron = gameScene.dronesGroup.create(startX, startY, sprite).setScale(0.12);
    
    gameScene.tweens.add({
        targets: dron, x: endX, y: startY + 120, ease: 'Sine.easeInOut', yoyo: true, repeat: 3, duration: 4000,
        onComplete: () => {
            if(dron.active) {
                nestDamage++;
                if (nestDamage >= 3) {
                    nestDamage = 0;
                    if (nestStage > 0) nestStage--;
                    gameScene.nestSprite.setTexture(nestStage > 0 ? `nest_${nestStage}` : 'nest_1');
                    if(nestStage === 0) gameScene.nestSprite.setVisible(false);
                }
            }
            dron.destroy();
        }
    });
}

function updateHUD() { gameScene.hudText.setText(`🏗️ Nido: ${nestStage}/6 | ❤️ Energía: ${Math.max(energy, 0)} | 🏆 Puntos: ${sessionScore}`); }

// --- 6. PAUSA DEL MATE Y CIERRE ---
function triggerMateBreak() {
    gameScene.scene.pause();
    document.getElementById("mate-break-screen").classList.add("active");
    mateEnergyLoad = 0; updateMateUI();

    let imgIndex = 1;
    mateInterval = setInterval(() => {
        mateEnergyLoad += 10; updateMateUI();
        imgIndex = imgIndex >= 3 ? 1 : imgIndex + 1;
        document.getElementById("mate-anim").src = `assets/img/roberto/rh-mate${imgIndex}.png`;

        if (mateEnergyLoad >= 100) {
            clearInterval(mateInterval);
            setTimeout(returnFromMate, 1000); 
        }
    }, 1000); 
}

function updateMateUI() {
    document.getElementById("energy-progress").style.width = mateEnergyLoad + "%";
    document.getElementById("energy-text").innerText = mateEnergyLoad + "%";
}

function returnFromMate() {
    clearInterval(mateInterval);
    document.getElementById("mate-break-screen").classList.remove("active");
    energy = mateEnergyLoad; shotsFired = 0; updateHUD();
    gameScene.scene.resume();
}

function winGame() {
    totalAccumulatedScore += sessionScore;
    gameScene.scene.pause();

    // Las 3 estrellas forzadas en array
    let estrellasHTML = "";
    if (nestStage >= 6) estrellasHTML += `<img src="assets/img/game/estrella78.png">`;
    if (dronesDestroyed > 0) estrellasHTML += `<img src="assets/img/game/estrella86.png">`;
    if (sessionScore >= 350) estrellasHTML += `<img src="assets/img/game/estrella22.png">`;

    document.getElementById("stars-result").innerHTML = estrellasHTML;
    document.getElementById("current-score").innerText = sessionScore;
    document.getElementById("total-score").innerText = totalAccumulatedScore;
    
    document.getElementById("game-over-modal").classList.add("active");
    lanzarConfetiCelesteYBlanco();
}

function saveScore() {
    const nombre = document.getElementById("player-name").value || "Anónimo";
    const provincia = document.getElementById("player-province").value;

    database.ref("ranking").push({ nombre: nombre, provincia: provincia, puntaje: totalAccumulatedScore, fecha: new Date().toISOString() })
    .then(() => {
        document.getElementById("save-data-modal").classList.remove("active");
        if(game) game.destroy(true);
        loadStartDashboards();
        showScreen("start-screen");
        alert("¡Puntaje Guardado! Mira el ranking en la pantalla principal.");
    });
}

function downloadCertificate() {
    const canvas = document.getElementById('cert-canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = 'assets/img/ui/certificadodepuntos-rh.jpg'; 
    
    img.onload = () => {
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        ctx.font = 'bold 50px Arial'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
        
        let nombre = document.getElementById("player-name").value || "Jugador Honorario";
        ctx.fillText(nombre, 300, 650);
        ctx.font = 'bold 40px Arial';
        ctx.fillText(`${totalAccumulatedScore} PUNTOS`, 300, 710);

        const link = document.createElement('a');
        link.download = 'Certificado_Roberto_Hornero.jpg';
        link.href = canvas.toDataURL('image/jpeg');
        link.click();
    };
}
