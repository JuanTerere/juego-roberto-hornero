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

let totalAccumulatedScore = 0; let sessionScore = 0; let nestStage = 0; let energy = 100;
let shotsFired = 0; let dronesDestroyed = 0; let nestDamage = 0;
let game; let gameScene; let currentProv;
let isAiming = false; let dragStartX, dragStartY; let aimGraphics;
let mateInterval; let mateEnergyLoad = 0;
let bgMusic; let isMusicPlaying = true;

document.addEventListener("DOMContentLoaded", () => {
    loadStartDashboards(); // Ahora tiene protección contra bases vacías
    renderProvincesList();
    populateSelectProvinces();

    document.getElementById("btn-play-main").addEventListener("click", () => showScreen("province-screen"));
    document.getElementById("btn-back-menu").addEventListener("click", () => {
        if(game) game.destroy(true);
        loadStartDashboards();
        showScreen("start-screen");
    });
    
    document.getElementById("btn-view-podium").addEventListener("click", showVotingPodium);
    document.getElementById("btn-close-podium").addEventListener("click", () => document.getElementById("podium-modal").classList.remove("active"));
    
    document.querySelectorAll(".btn-vote").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const provName = e.target.getAttribute("data-prov");
            database.ref(`votacion/${provName}`).transaction(current => (current || 0) + 1);
            lanzarConfetiCelesteYBlanco();
        });
    });

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
    
    document.getElementById("btn-share-wa").addEventListener("click", () => {
        const playerName = document.getElementById("player-name").value || "Un amigo";
        const msg = `¡Ayuda a Roberto Hornero! Soy ${playerName} y acabo de sumar ${totalAccumulatedScore} puntos construyendo nidos por toda la Argentina. ¡Entrá a jugar y superá mi puntaje! https://juanterere.github.io/juego-roberto-hornero/`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    });

    document.getElementById("btn-toggle-music").addEventListener("click", () => {
        if (!bgMusic) return;
        isMusicPlaying = !isMusicPlaying;
        if (isMusicPlaying) { 
            bgMusic.resume(); 
            document.getElementById("btn-toggle-music").innerText = "🔊 Música ON"; 
        } else { 
            bgMusic.pause(); 
            document.getElementById("btn-toggle-music").innerText = "🔇 Música OFF"; 
        }
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

// PROTECCIÓN: Si la base está vacía, no se rompe
function loadStartDashboards() {
    database.ref("ranking").once("value", snap => {
        let allScores = [];
        if (snap.exists()) {
            snap.forEach(c => allScores.push(c.val()));
        }
        
        if (allScores.length > 0) {
            allScores.sort((a, b) => b.puntaje - a.puntaje);
            let natHtml = "";
            allScores.slice(0, 3).forEach((item, i) => natHtml += `<p>#${i+1} <strong>${item.nombre}</strong>: ${item.puntaje}</p>`);
            document.getElementById("start-national-ranking").innerHTML = natHtml;

            let provCount = {};
            allScores.forEach(item => provCount[item.provincia] = (provCount[item.provincia] || 0) + 1);
            let provSorted = Object.keys(provCount).map(p => ({prov: p, count: provCount[p]})).sort((a,b) => b.count - a.count);
            let provHtml = "";
            provSorted.slice(0, 3).forEach((item, i) => provHtml += `<p>#${i+1} <strong>${item.prov}</strong>: ${item.count} jug.</p>`);
            document.getElementById("start-prov-ranking").innerHTML = provHtml;
        } else {
            document.getElementById("start-national-ranking").innerHTML = "Aún no hay jugadas";
            document.getElementById("start-prov-ranking").innerHTML = "Aún no hay jugadas";
        }
    }).catch(err => console.log("Error de conexión:", err));
}

function showVotingPodium() {
    database.ref("votacion").once("value", snap => {
        if (snap.exists()) {
            const votes = snap.val();
            let sorted = Object.keys(votes).map(k => ({ prov: k, v: votes[k] })).sort((a, b) => b.v - a.v);
            let html = "";
            sorted.forEach((item, i) => {
                let badge = i === 0 ? "🏆" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : ""));
                html += `<div style="padding: 10px; border-bottom: 1px solid #ddd;">
                            ${badge} <strong>${item.prov}</strong>: ${item.v} votos
                         </div>`;
            });
            document.getElementById("voting-results-list").innerHTML = html;
        } else {
            document.getElementById("voting-results-list").innerHTML = "Aún no hay votos.";
        }
        document.getElementById("podium-modal").classList.add("active");
    });
}

function startGamePhaser(provinceObj) {
    currentProv = provinceObj;
    sessionScore = 0; nestStage = 1; energy = 100;
    shotsFired = 0; dronesDestroyed = 0; nestDamage = 0;
    showScreen(); 
    document.getElementById("game-container").style.display = "block";

    const config = {
        type: Phaser.AUTO,
        width: 1000,
        height: 700,
        parent: 'game-container',
        physics: { default: 'arcade', arcade: { gravity: { y: 300 }, debug: false } },
        scene: { preload: preload, create: create, update: update }
    };
    
    if (game) game.destroy(true);
    game = new Phaser.Game(config);
}

function preload() {
    this.load.image('bg', `assets/escenarios/${currentProv.bg || 'obelisco-bs-as.png'}`);
    this.load.image('rh_conpala', 'assets/img/roberto/rh-conpala.png');
    this.load.image('rh_lanza1', 'assets/img/roberto/rh-lanza1.png');
    this.load.image('rh_lanza2', 'assets/img/roberto/rh-lanza2.png');
    this.load.image('rh_lanza3', 'assets/img/roberto/rh-lanza3.png');
    
    // Nido
    for(let i=1; i<=6; i++) {
        this.load.image(`nest_${i}`, `assets/img/game/Hornero${i+1}.png`);
    }
    
    this.load.image('drone', 'assets/img/game/dron-mosca.png');
    this.load.image('proyectil_barro', 'assets/img/game/barro1.png');
    this.load.image('huevo', 'assets/img/game/huevo.png');

    this.load.audio('milonga', 'assets/audio/milonga-rh.mp3');
}

function create() {
    gameScene = this;
    let bg = this.add.image(500, 350, 'bg').setDisplaySize(1000, 700);

    try {
        if(!bgMusic) {
            bgMusic = this.sound.add('milonga', { loop: true, volume: 0.5 });
        }
        if(isMusicPlaying && !bgMusic.isPlaying) bgMusic.play();
    } catch(e) {
        console.log("Audio bloqueado por navegador", e);
    }

    this.nest = this.physics.add.staticImage(850, 450, 'nest_1').setScale(0.8);
    this.roberto = this.physics.add.sprite(150, 620, 'rh_conpala').setScale(0.08);
    this.roberto.setCollideWorldBounds(true);
    
    this.drones = this.physics.add.group();
    this.proyectiles = this.physics.add.group({ defaultKey: 'proyectil_barro' });
    this.huevos = this.physics.add.group();

    this.scoreText = this.add.text(20, 20, 'Puntos: 0', { fontSize: '24px', fill: '#fff', backgroundColor: '#000' });
    this.energyText = this.add.text(20, 60, 'Energía: 100%', { fontSize: '24px', fill: '#fff', backgroundColor: '#000' });
    this.nestText = this.add.text(20, 100, 'Nido: Nivel 1', { fontSize: '24px', fill: '#fff', backgroundColor: '#000' });

    aimGraphics = this.add.graphics();

    this.input.on('pointerdown', (pointer) => {
        if(energy <= 0) { triggerMateBreak(); return; }
        if(pointer.x < 300) { 
            isAiming = true; dragStartX = pointer.x; dragStartY = pointer.y;
            this.roberto.setTexture('rh_lanza1');
        }
    });

    this.input.on('pointermove', (pointer) => {
        if (!isAiming) return;
        aimGraphics.clear(); aimGraphics.lineStyle(2, 0xff0000, 1);
        aimGraphics.beginPath(); aimGraphics.moveTo(this.roberto.x, this.roberto.y);
        aimGraphics.lineTo(pointer.x, pointer.y); aimGraphics.strokePath();
    });

    this.input.on('pointerup', (pointer) => {
        if (!isAiming) return;
        isAiming = false; aimGraphics.clear();

        // ANIMACIÓN CORREGIDA A PRUEBA DE FALLOS
        if (gameScene && gameScene.roberto) gameScene.roberto.setTexture('rh_lanza2');
        setTimeout(() => {
            if (gameScene && gameScene.roberto) {
                gameScene.roberto.setTexture('rh_lanza3');
                fireMud(pointer.x, pointer.y);
            }
        }, 100);
        setTimeout(() => {
            if (gameScene && gameScene.roberto) gameScene.roberto.setTexture('rh_conpala');
        }, 400);
    });

    this.time.addEvent({ delay: 3000, callback: spawnDrone, callbackScope: this, loop: true });

    this.physics.add.overlap(this.proyectiles, this.drones, destroyDrone, null, this);
    this.physics.add.overlap(this.huevos, this.nest, damageNest, null, this);
    this.physics.add.overlap(this.huevos, this.roberto, damageRoberto, null, this);
}

function fireMud(targetX, targetY) {
    if(energy <= 0) return;
    shotsFired++; energy -= 10; updateHUD();
    
    let barro = gameScene.proyectiles.create(gameScene.roberto.x, gameScene.roberto.y - 10, 'proyectil_barro');
    barro.setScale(0.05);
    gameScene.physics.moveTo(barro, targetX, targetY, 500);
    barro.setGravityY(-300); // Cancela gravedad global

    setTimeout(() => { if(barro && barro.active) barro.destroy(); }, 3000);
}

function spawnDrone() {
    if(!gameScene) return;
    let x = Phaser.Math.Between(400, 950);
    let drone = gameScene.drones.create(x, 50, 'drone').setScale(0.1);
    drone.setVelocityX(Phaser.Math.Between(-100, 100));
    drone.setVelocityY(Phaser.Math.Between(20, 50));
    drone.setGravityY(-300);

    gameScene.time.addEvent({
        delay: Phaser.Math.Between(2000, 4000),
        callback: () => {
            if (drone && drone.active) {
                let huevo = gameScene.huevos.create(drone.x, drone.y + 20, 'huevo').setScale(0.05);
                huevo.setVelocityY(150);
            }
        },
        callbackScope: gameScene
    });
}

function destroyDrone(barro, drone) {
    barro.destroy(); drone.destroy();
    dronesDestroyed++;
    sessionScore += 20; updateHUD();
    checkNestUpgrade();
}

function damageNest(huevo, nest) {
    huevo.destroy();
    nestDamage++;
    if(sessionScore > 0) sessionScore -= 5;
    updateHUD();
}

function damageRoberto(huevo, roberto) {
    huevo.destroy();
    energy = Math.max(0, energy - 15);
    updateHUD();
    if(energy <= 0) triggerMateBreak();
}

function updateHUD() {
    if(gameScene && gameScene.scoreText) {
        gameScene.scoreText.setText('Puntos: ' + sessionScore);
        gameScene.energyText.setText('Energía: ' + energy + '%');
        gameScene.nestText.setText('Nido: Nivel ' + nestStage);
    }
}

function checkNestUpgrade() {
    if (sessionScore >= nestStage * 100 && nestStage < 6) {
        nestStage++;
        gameScene.nest.setTexture(`nest_${nestStage}`);
        if(nestStage === 6) {
            setTimeout(endGameSuccess, 1000);
        }
    }
}

function triggerMateBreak() {
    if(gameScene && gameScene.scene) gameScene.scene.pause();
    document.getElementById("mate-break-screen").classList.add("active");
    
    mateEnergyLoad = 0;
    let imgIndex = 1;
    let mateImg = document.getElementById("mate-anim");
    let textInfo = document.getElementById("energy-text");
    let progressFill = document.getElementById("energy-progress");
    document.getElementById("btn-return-game").style.display = "none";

    mateInterval = setInterval(() => {
        mateEnergyLoad += 5;
        progressFill.style.width = mateEnergyLoad + "%";
        textInfo.innerText = `Cebando mate... ${mateEnergyLoad}%`;

        imgIndex++; if(imgIndex > 3) imgIndex = 1;
        mateImg.src = `assets/img/roberto/rh-mate${imgIndex}.png`;

        if(mateEnergyLoad >= 100) {
            clearInterval(mateInterval);
            textInfo.innerText = "¡Energía al 100%!";
            document.getElementById("btn-return-game").style.display = "inline-block";
        }
    }, 200);
}

function returnFromMate() {
    document.getElementById("mate-break-screen").classList.remove("active");
    energy = 100; updateHUD();
    if(gameScene && gameScene.scene) gameScene.scene.resume();
}

function update() {
    if (!gameScene) return;
    this.drones.children.iterate((d) => {
        if(d && (d.y > 700 || d.x < 0 || d.x > 1000)) d.destroy();
    });
    this.huevos.children.iterate((h) => {
        if(h && h.y > 700) h.destroy();
    });
}

function endGameSuccess() {
    if(gameScene && gameScene.scene) gameScene.scene.pause();
    document.getElementById("game-container").style.display = "none";
    totalAccumulatedScore += sessionScore;
    
    let accuracy = shotsFired > 0 ? (dronesDestroyed / shotsFired) * 100 : 0;
    let accuracyText = accuracy >= 80 ? "🎯 Precisión de Francotirador" : (accuracy >= 50 ? "✅ Buena Puntería" : "🤷 Mejorable");
    let damageText = nestDamage === 0 ? "🛡️ Nido Intacto" : `⚠️ Recibió ${nestDamage} impactos`;
    let resHtml = `<h3>${accuracyText}</h3><p>${damageText}</p><p>Eficiencia de Barro: ${Math.round(accuracy)}%</p>`;
    
    document.getElementById("stars-result").innerHTML = resHtml;
    document.getElementById("current-score").innerText = sessionScore;
    document.getElementById("total-score").innerText = totalAccumulatedScore;
    document.getElementById("game-over-modal").classList.add("active");
}

function saveScore() {
    const name = document.getElementById("player-name").value || "Anónimo";
    const prov = document.getElementById("player-province").value;
    
    const newRecordRef = database.ref('ranking').push();
    newRecordRef.set({
        nombre: name,
        provincia: prov,
        puntaje: totalAccumulatedScore,
        fecha: new Date().toISOString()
    });
    
    alert("¡Puntaje Guardado!");
    document.getElementById("save-data-modal").classList.remove("active");
    if(bgMusic) bgMusic.stop();
    if(game) game.destroy(true);
    loadStartDashboards();
    showScreen("start-screen");
}

function downloadCertificate() {
    const cvs = document.getElementById("cert-canvas");
    cvs.width = 800; cvs.height = 600;
    const ctx = cvs.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,800,600);
    ctx.fillStyle = "#74acdf";
    ctx.fillRect(10,10,780,580);
    ctx.fillStyle = "#fff";
    ctx.fillRect(20,20,760,560);

    ctx.fillStyle = "#333";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("CERTIFICADO PATRIÓTICO", 400, 100);
    
    ctx.font = "30px Arial";
    const pName = document.getElementById("player-name").value || "Constructor/a";
    ctx.fillText(`Otorgado a: ${pName}`, 400, 200);

    ctx.font = "24px Arial";
    ctx.fillText(`Por ayudar a Roberto Hornero a construir un nido`, 400, 280);
    ctx.fillText(`en la provincia de ${currentProv.name}`, 400, 320);
    
    ctx.font = "bold 30px Arial";
    ctx.fillStyle = "#d35400";
    ctx.fillText(`Puntaje Aportado: ${sessionScore}`, 400, 420);

    const link = document.createElement('a');
    link.download = `Certificado-Roberto-Hornero.png`;
    link.href = cvs.toDataURL();
    link.click();
}
