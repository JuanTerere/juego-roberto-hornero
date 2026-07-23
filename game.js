// --- CONFIGURACIÓN FIREBASE (REEMPLAZA CON TUS DATOS) ---
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    databaseURL: "https://tu-proyecto.firebaseio.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.firebasestorage.app",
    messagingSenderId: "TU_SENDER",
    appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- DATOS Y VARIABLES GLOBALES ---
let totalAccumulatedScore = 0; 
let sessionScore = 0;
let nestStage = 0; 
let energy = 100;
let shotsFired = 0;
let dronesDestroyed = 0;
let nestDamage = 0;

let game;
let gameScene;
let currentProv;
let isAiming = false;
let dragStartX, dragStartY;
let aimGraphics;
let mateInterval;
let mateEnergyLoad = 0;

// Estado: habilitada, votacion, bloqueada
const PROVINCES_DATA = [
    { id: "bsas", name: "Buenos Aires", status: "habilitada", bg: "obelisco-bs-as.png", icon: "🔓" },
    { id: "tucuman", name: "Tucumán", status: "habilitada", bg: "casitade-tucuman.png", icon: "🔓" },
    { id: "cordoba", name: "Córdoba", status: "votacion", bg: "catedral-de-cordoba.png", icon: "🟡" },
    { id: "mendoza", name: "Mendoza", status: "bloqueada", bg: "", icon: "🔒" }
];

// --- EVENTOS DOM ---
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-play-main").addEventListener("click", () => showScreen("province-screen"));
    document.getElementById("btn-back-menu").addEventListener("click", () => showScreen("start-screen"));
    
    renderProvincesList();

    // Modales y Botones
    document.getElementById("btn-close-vote").addEventListener("click", () => {
        document.getElementById("vote-modal").classList.remove("active");
    });
    
    document.getElementById("btn-confirm-vote").addEventListener("click", () => {
        document.getElementById("vote-modal").classList.remove("active");
        lanzarConfetiCelesteYBlanco();
        alert("¡Gracias por tu voto!");
    });

    // MATE BOTÓN
    document.getElementById("btn-return-game").addEventListener("click", returnFromMate);

    // FIN DE JUEGO BOTONES
    document.getElementById("btn-play-more").addEventListener("click", () => {
        document.getElementById("game-over-modal").classList.remove("active");
        if (game) game.destroy(true);
        showScreen("province-screen");
    });

    document.getElementById("btn-save-score").addEventListener("click", () => {
        document.getElementById("game-over-modal").classList.remove("active");
        document.getElementById("save-data-modal").classList.add("active");
    });

    document.getElementById("btn-download-cert").addEventListener("click", downloadCertificate);

    // GUARDAR Y RANKING
    document.getElementById("btn-confirm-save").addEventListener("click", saveAndShowRanking);
    document.getElementById("btn-back-from-podium").addEventListener("click", () => showScreen("start-screen"));
    document.getElementById("btn-view-votes").addEventListener("click", () => { loadRanking(); showScreen("podium-screen"); });
});

function showScreen(screenId) {
    document.querySelectorAll(".screen:not(.modal-overlay)").forEach(s => s.classList.remove("active"));
    if (screenId) document.getElementById(screenId).classList.add("active");
}

function renderProvincesList() {
    const list = document.getElementById("provinces-grid");
    list.innerHTML = "";
    PROVINCES_DATA.forEach(prov => {
        const row = document.createElement("div");
        row.className = `prov-row prov-${prov.status}`;
        row.innerHTML = `<span>${prov.name}</span> <span>${prov.icon}</span>`;
        
        row.addEventListener("click", () => {
            if (prov.status === "habilitada") startGamePhaser(prov);
            if (prov.status === "votacion") showVoteModal(prov.name);
        });
        list.appendChild(row);
    });
}

function showVoteModal(provName) {
    document.getElementById("vote-prov-name").innerText = provName;
    document.getElementById("vote-modal").classList.add("active");
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

// --- MOTOR PHASER 3 ---
function startGamePhaser(prov) {
    currentProv = prov;
    nestStage = 0;
    sessionScore = 0;
    shotsFired = 0;
    energy = 100;
    dronesDestroyed = 0;
    nestDamage = 0;
    showScreen("game-container");

    if (game) game.destroy(true);

    const config = {
        type: Phaser.AUTO,
        parent: "game-container",
        width: 1280,
        height: 720,
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
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
    this.load.image('drone-iz', 'assets/img/game/drone-iz.png');
    this.load.image('drone-de', 'assets/img/game/drone-de.png');
    
    this.load.image('estrella78', 'assets/img/game/estrella78.png');
    this.load.image('estrella86', 'assets/img/game/estrella86.png');
    this.load.image('estrella22', 'assets/img/game/estrella22.png');
}

function create() {
    gameScene = this;
    this.add.image(640, 360, 'bg').setDisplaySize(1280, 720);

    // Escalas ajustadas
    this.roberto = this.physics.add.sprite(200, 580, 'rh_conpala').setScale(0.15);
    this.poste = this.add.image(1100, 600, 'base_poste').setScale(0.25);
    this.nestSprite = this.add.image(1100, 480, 'nest_1').setScale(0.25).setVisible(false);
    
    // HUD y Barra de Destrucción Nido
    this.hudText = this.add.text(20, 20, '', { fontSize: '24px', fill: '#fff', backgroundColor: '#000', padding: 5 });
    this.nestDamageBar = this.add.graphics();
    updateHUD();
    
    aimGraphics = this.add.graphics();
    this.proyectiles = this.physics.add.group();
    this.dronesGroup = this.physics.add.group();

    this.physics.add.overlap(this.proyectiles, this.dronesGroup, (proyectil, dron) => {
        proyectil.destroy();
        dron.destroy();
        dronesDestroyed++;
        sessionScore += 50;
        updateHUD();
    });

    // Control Apuntado
    this.input.on('pointerdown', (pointer) => {
        if (energy <= 0 || shotsFired >= 10) return;
        isAiming = true;
        dragStartX = pointer.x;
        dragStartY = pointer.y;
        this.roberto.setTexture('rh_lanza1');
    });

    this.input.on('pointermove', (pointer) => {
        if (!isAiming) return;
        aimGraphics.clear();
        aimGraphics.lineStyle(4, 0xffffff, 0.8);
        aimGraphics.lineBetween(this.roberto.x, this.roberto.y, this.roberto.x - (pointer.x - dragStartX), this.roberto.y - (pointer.y - dragStartY));
    });

    this.input.on('pointerup', (pointer) => {
        if (!isAiming) return;
        isAiming = false;
        aimGraphics.clear();

        this.roberto.setTexture('rh_lanza2');
        setTimeout(() => this.roberto.setTexture('rh_lanza3'), 100);
        setTimeout(() => this.roberto.setTexture('rh_conpala'), 300);

        fireMud(pointer.x, pointer.y);
    });

    this.time.addEvent({ delay: 3500, callback: spawnDron, callbackScope: this, loop: true });
}

function update() {
    // Dibujar barra de daño del nido
    gameScene.nestDamageBar.clear();
    gameScene.nestDamageBar.fillStyle(0x000000, 0.8);
    gameScene.nestDamageBar.fillRect(1050, 680, 100, 10);
    gameScene.nestDamageBar.fillStyle(0xff0000, 1);
    gameScene.nestDamageBar.fillRect(1050, 680, (nestDamage / 3) * 100, 10);
}

function fireMud(releaseX, releaseY) {
    shotsFired++;
    energy -= 10;
    
    let barro = gameScene.proyectiles.create(gameScene.roberto.x, gameScene.roberto.y - 20, 'proyectil_barro');
    barro.setScale(0.5);
    
    let forceX = (dragStartX - releaseX) * 3;
    let forceY = (dragStartY - releaseY) * 3;
    barro.setVelocity(forceX, forceY);
    barro.setGravityY(400);

    setTimeout(() => {
        if (barro.active && barro.x > 950 && barro.y > 400) {
            construirNido();
            barro.destroy();
        }
    }, 1200);

    updateHUD();
    if (shotsFired >= 10 || energy <= 0) triggerMateBreak();
}

function construirNido() {
    if (nestStage < 6) {
        nestStage++;
        sessionScore += 50; // Base sum is around 300 for full nest
        gameScene.nestSprite.setVisible(true);
        gameScene.nestSprite.setTexture(`nest_${nestStage}`);
        updateHUD();
        if (nestStage >= 6) setTimeout(winGame, 1000);
    }
}

function spawnDron() {
    if (gameScene.dronesGroup.countActive() >= 3) return;

    let vieneDeIzquierda = Math.random() > 0.5;
    let startX = vieneDeIzquierda ? -50 : 1330;
    let endX = vieneDeIzquierda ? 1330 : -50;
    let startY = Phaser.Math.Between(50, 250);
    
    let sprite = vieneDeIzquierda ? 'drone-de' : 'drone-iz';
    let dron = gameScene.dronesGroup.create(startX, startY, sprite).setScale(0.15);
    
    gameScene.tweens.add({
        targets: dron,
        x: endX,
        y: startY + 100,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: 3, 
        duration: 4000,
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

function updateHUD() {
    gameScene.hudText.setText(`🏗️ Etapa: ${nestStage}/6 | ❤️ Energía: ${Math.max(energy, 0)} | 🏆 Puntos: ${sessionScore}`);
}

// --- DESCANSO DEL MATE ---
function triggerMateBreak() {
    gameScene.scene.pause();
    document.getElementById("mate-break-screen").classList.add("active");
    mateEnergyLoad = 0;
    updateMateUI();

    let imgIndex = 1;
    mateInterval = setInterval(() => {
        mateEnergyLoad += 10;
        updateMateUI();
        
        imgIndex = imgIndex >= 3 ? 1 : imgIndex + 1;
        document.getElementById("mate-anim").src = `assets/img/roberto/rh-mate${imgIndex}.png`;

        if (mateEnergyLoad >= 100) {
            clearInterval(mateInterval);
            setTimeout(returnFromMate, 1000); // Regresa auto al 100%
        }
    }, 1000); // 10% por segundo = 10 segundos
}

function updateMateUI() {
    document.getElementById("energy-progress").style.width = mateEnergyLoad + "%";
    document.getElementById("energy-text").innerText = mateEnergyLoad + "%";
}

function returnFromMate() {
    clearInterval(mateInterval);
    document.getElementById("mate-break-screen").classList.remove("active");
    energy = mateEnergyLoad; // Toma lo que cargó
    shotsFired = 0;
    updateHUD();
    gameScene.scene.resume();
    
    // Titilar si cargó al 100%
    if(energy >= 100) {
        let flash = setInterval(() => gameScene.hudText.setAlpha(gameScene.hudText.alpha === 1 ? 0.5 : 1), 200);
        setTimeout(() => { clearInterval(flash); gameScene.hudText.setAlpha(1); }, 2000);
    }
}

// --- FIN DE JUEGO Y ESTRELLAS ---
function winGame() {
    totalAccumulatedScore += sessionScore;

    let estrellas = [];
    if (nestStage >= 6) estrellas.push('estrella78');
    if (dronesDestroyed > 0) estrellas.push('estrella86');
    if (sessionScore >= 350) estrellas.push('estrella22');

    const starsDiv = document.getElementById("stars-result");
    starsDiv.innerHTML = '';
    estrellas.forEach(star => {
        starsDiv.innerHTML += `<img src="assets/img/game/${star}.png" width="50">`;
    });

    document.getElementById("current-score").innerText = sessionScore;
    document.getElementById("total-score").innerText = totalAccumulatedScore;
    
    document.getElementById("game-over-modal").classList.add("active");
    lanzarConfetiCelesteYBlanco();
}

// --- GENERADOR DE CERTIFICADO EN CANVAS ---
function downloadCertificate() {
    const canvas = document.getElementById('cert-canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.crossOrigin = "Anonymous";
    img.src = 'assets/img/ui/certificadodepuntos-rh.jpg'; 
    
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 1. Dibuja la plantilla
        ctx.drawImage(img, 0, 0);
        
        // 2. Configura el texto (Sobre la zona celeste)
        ctx.font = 'bold 50px Arial';
        ctx.fillStyle = '#ffffff'; 
        ctx.textAlign = 'center';
        
        // Coordenadas estimadas del recuadro celeste
        const centerX = 300; 
        const startY = 650;
        
        let nombre = document.getElementById("player-name").value || "Jugador Honorario";
        
        ctx.fillText(nombre, centerX, startY);
        ctx.font = 'bold 40px Arial';
        ctx.fillText(`${totalAccumulatedScore} PUNTOS`, centerX, startY + 60);

        // 3. Descargar
        const link = document.createElement('a');
        link.download = 'Certificado_Roberto_Hornero.jpg';
        link.href = canvas.toDataURL('image/jpeg');
        link.click();
    };
}

// --- GUARDAR Y MOSTRAR RANKING ---
function saveAndShowRanking() {
    const nombre = document.getElementById("player-name").value || "Anónimo";
    const provincia = document.getElementById("player-province").value;

    database.ref("ranking").push({
        nombre: nombre,
        provincia: provincia,
        puntaje: totalAccumulatedScore,
        fecha: new Date().toISOString()
    }).then(() => {
        document.getElementById("save-data-modal").classList.remove("active");
        loadRanking(nombre, totalAccumulatedScore);
        showScreen("podium-screen");
    });
}

function loadRanking(playerName = "", playerScore = 0) {
    database.ref("ranking").once("value", snap => {
        let allScores = [];
        snap.forEach(c => allScores.push(c.val()));
        
        // 1. Top 3 Nacional
        allScores.sort((a, b) => b.puntaje - a.puntaje);
        let listHtml = "";
        allScores.slice(0, 3).forEach((item, i) => {
            listHtml += `<p>#${i+1} <strong>${item.nombre}</strong> - ${item.puntaje} pts</p>`;
        });
        document.getElementById("national-ranking-list").innerHTML = listHtml;

        // 2. Ranking por Provincias (Cantidad de Jugadores)
        let provCount = {};
        allScores.forEach(item => {
            provCount[item.provincia] = (provCount[item.provincia] || 0) + 1;
        });
        let provSorted = Object.keys(provCount).map(p => ({prov: p, count: provCount[p]})).sort((a,b) => b.count - a.count);
        
        let provHtml = "";
        provSorted.forEach((item, i) => {
            provHtml += `<p>#${i+1} <strong>${item.prov}</strong> - ${item.count} jugadores</p>`;
        });
        document.getElementById("province-ranking-list").innerHTML = provHtml;

        // 3. Puesto del Usuario Actual
        if (playerName !== "") {
            let myRank = allScores.findIndex(s => s.nombre === playerName && s.puntaje === playerScore) + 1;
            document.getElementById("my-rank-text").innerText = `Quedaste en el puesto #${myRank} a nivel nacional con ${playerScore} puntos.`;
        }
    });
}
