// --- CONFIGURACIÓN ---
// ⚠️ Esto es solo una traba básica del lado del cliente, NO es seguridad real.
// Cualquiera que vea el código fuente puede encontrar esta contraseña.
// Para seguridad real hay que usar Firebase Authentication y reglas de la base de datos
// que exijan estar autenticado para escribir. Cambiá esta clave igual.
const ADMIN_PASSWORD = "hornero2026";

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

// Misma lista de provincias que usa el juego (los "id" tienen que coincidir con game.js)
const ALL_PROVINCES = [
    { id: "caba", name: "Ciudad Autónoma de Buenos Aires" },
    { id: "bsas", name: "Buenos Aires" },
    { id: "cordoba", name: "Córdoba" },
    { id: "santafe", name: "Santa Fe" },
    { id: "entrerios", name: "Entre Ríos" },
    { id: "lapampa", name: "La Pampa" },
    { id: "tucuman", name: "Tucumán" },
    { id: "misiones", name: "Misiones" },
    { id: "salta", name: "Salta" },
    { id: "jujuy", name: "Jujuy" },
    { id: "chaco", name: "Chaco" },
    { id: "corrientes", name: "Corrientes" },
    { id: "formosa", name: "Formosa" },
    { id: "catamarca", name: "Catamarca" },
    { id: "santiago", name: "Santiago del Estero" },
    { id: "mendoza", name: "Mendoza" },
    { id: "sanjuan", name: "San Juan" },
    { id: "sanluis", name: "San Luis" },
    { id: "larioja", name: "La Rioja" },
    { id: "chubut", name: "Chubut" },
    { id: "neuquen", name: "Neuquén" },
    { id: "rionegro", name: "Río Negro" },
    { id: "santacruz", name: "Santa Cruz" },
    { id: "tierradelfuego", name: "Tierra del Fuego" }
];

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-login").addEventListener("click", tryLogin);
    document.getElementById("admin-password").addEventListener("keydown", (e) => {
        if (e.key === "Enter") tryLogin();
    });
    document.getElementById("btn-logout").addEventListener("click", () => {
        sessionStorage.removeItem("rh_admin_ok");
        location.reload();
    });
    document.getElementById("btn-refresh").addEventListener("click", loadEverything);

    if (sessionStorage.getItem("rh_admin_ok") === "1") {
        showAdminPanel();
    }
});

function tryLogin() {
    const pass = document.getElementById("admin-password").value;
    if (pass === ADMIN_PASSWORD) {
        sessionStorage.setItem("rh_admin_ok", "1");
        showAdminPanel();
    } else {
        document.getElementById("login-error").textContent = "Contraseña incorrecta.";
    }
}

function showAdminPanel() {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-panel").style.display = "block";
    loadEverything();
}

function loadEverything() {
    loadStats();
    loadProvinceAdmin();
    loadVotesAdmin();
    loadRankingAdmin();
}

// --- DASHBOARD DE MÉTRICAS ---
function loadStats() {
    Promise.all([
        database.ref('stats').once('value'),
        database.ref('sessions').once('value'),
        database.ref('votacion').once('value'),
        database.ref('ranking').once('value')
    ]).then(([statsSnap, sessionsSnap, votesSnap, rankingSnap]) => {
        const stats = statsSnap.exists() ? statsSnap.val() : {};
        const sessions = [];
        if (sessionsSnap.exists()) sessionsSnap.forEach(c => sessions.push(c.val()));
        const votes = votesSnap.exists() ? votesSnap.val() : {};
        const rankingArr = [];
        if (rankingSnap.exists()) rankingSnap.forEach(c => rankingArr.push(c.val()));

        const gamesStarted = stats.gamesStarted || sessions.length || 0;
        const gamesCompleted = stats.gamesCompleted || sessions.length || 0;
        document.getElementById('stat-games-started').textContent = gamesStarted;
        document.getElementById('stat-games-completed').textContent = gamesCompleted;
        document.getElementById('stat-completion-rate').textContent =
            gamesStarted > 0 ? Math.round((gamesCompleted / gamesStarted) * 100) + '%' : '—';

        const provPlaysRaw = stats.provinciaPlays || {};
        let provEntries = Object.keys(provPlaysRaw).map(id => ({ id, count: provPlaysRaw[id] }));
        if (provEntries.length === 0 && sessions.length > 0) {
            const counts = {};
            sessions.forEach(s => {
                const key = s.provinciaId || s.provincia || 'desconocida';
                counts[key] = (counts[key] || 0) + 1;
            });
            provEntries = Object.keys(counts).map(id => ({ id, count: counts[id] }));
        }
        provEntries.sort((a, b) => b.count - a.count);
        document.getElementById('stat-top-province').textContent =
            provEntries.length ? provinceLabel(provEntries[0].id, sessions) : '—';

        const totalSeconds = sessions.reduce((sum, s) => sum + (s.duracionSegundos || 0), 0);
        document.getElementById('stat-total-time').textContent = formatDuration(totalSeconds);
        const avgSeconds = sessions.length ? Math.round(totalSeconds / sessions.length) : 0;
        document.getElementById('stat-avg-time').textContent = sessions.length ? formatDuration(avgSeconds) : '—';

        const totalMateSeconds = sessions.reduce((sum, s) => sum + (s.mateSegundos || 0), 0);
        document.getElementById('stat-mate-minutes').textContent = Math.round(totalMateSeconds / 60) + ' min';

        const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
        document.getElementById('stat-total-votes').textContent = totalVotes;

        const topScore = rankingArr.length ? Math.max(...rankingArr.map(r => r.puntaje || 0)) : 0;
        document.getElementById('stat-top-score').textContent = topScore;

        renderProvinceBreakdown(provEntries, sessions);
    }).catch(err => {
        console.log('Error cargando estadísticas:', err);
        document.getElementById('province-breakdown-list').innerHTML = `Error de conexión: ${err.message}`;
    });
}

function provinceLabel(id, sessions) {
    const found = sessions.find(s => s.provinciaId === id);
    if (found) return found.provincia;
    const p = ALL_PROVINCES.find(pv => pv.id === id);
    return p ? p.name : id;
}

function formatDuration(totalSeconds) {
    if (!totalSeconds) return '0 min';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.round((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
}

function renderProvinceBreakdown(provEntries, sessions) {
    const container = document.getElementById('province-breakdown-list');
    if (!provEntries.length) {
        container.innerHTML = 'Todavía no hay datos de partidas.';
        return;
    }
    const max = Math.max(...provEntries.map(e => e.count));
    container.innerHTML = '';
    provEntries.slice(0, 10).forEach(e => {
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        const label = provinceLabel(e.id, sessions);
        row.innerHTML = `
            <span class="breakdown-name">${label}</span>
            <div class="breakdown-bar-bg"><div class="breakdown-bar-fill" style="width:${(e.count / max * 100)}%"></div></div>
            <span class="breakdown-count">${e.count}</span>
        `;
        container.appendChild(row);
    });
}

// --- PROVINCIAS (habilitar / bloquear / votación) ---
function loadProvinceAdmin() {
    database.ref("provinceStatus").once("value").then(snap => {
        const overrides = snap.exists() ? snap.val() : {};
        const list = document.getElementById("admin-provinces-list");
        list.innerHTML = "";

        ALL_PROVINCES.forEach(prov => {
            const current = overrides[prov.id] || {};
            const status = current.status || "bloqueada";
            const bg = current.bg || "";

            const row = document.createElement("div");
            row.className = "admin-province-row";
            row.innerHTML = `
                <span class="prov-name">${prov.name}</span>
                <select data-id="${prov.id}" class="status-select">
                    <option value="bloqueada" ${status === "bloqueada" ? "selected" : ""}>🔒 Bloqueada</option>
                    <option value="votacion" ${status === "votacion" ? "selected" : ""}>🟡 En votación</option>
                    <option value="habilitada" ${status === "habilitada" ? "selected" : ""}>🟢 Habilitada</option>
                </select>
                <input type="text" class="bg-input" placeholder="nombre-imagen-fondo.png" value="${bg}">
                <button class="save-prov-btn" data-id="${prov.id}">Guardar</button>
            `;
            list.appendChild(row);

            row.querySelector(".save-prov-btn").addEventListener("click", (e) => {
                const btn = e.target;
                const id = btn.getAttribute("data-id");
                const statusVal = row.querySelector(".status-select").value;
                const bgVal = row.querySelector(".bg-input").value.trim();

                btn.disabled = true;
                btn.textContent = "...";

                const payload = { status: statusVal };
                if (bgVal) payload.bg = bgVal;

                database.ref(`provinceStatus/${id}`).set(payload)
                    .then(() => {
                        btn.textContent = "✅ Listo";
                        setTimeout(() => { btn.textContent = "Guardar"; btn.disabled = false; }, 1200);
                    })
                    .catch(err => {
                        btn.textContent = "Error";
                        alert("No se pudo guardar: " + err.message);
                        btn.disabled = false;
                    });
            });
        });
    }).catch(err => {
        document.getElementById("admin-provinces-list").innerHTML = `Error de conexión: ${err.message}`;
    });
}

// --- VOTOS ---
function loadVotesAdmin() {
    database.ref("votacion").once("value").then(snap => {
        const votes = snap.exists() ? snap.val() : {};
        const list = document.getElementById("admin-votes-list");
        list.innerHTML = "";

        const entries = Object.keys(votes).map(k => ({ name: k, count: votes[k] })).sort((a, b) => b.count - a.count);
        if (entries.length === 0) {
            list.innerHTML = "Todavía no hay votos.";
            return;
        }
        entries.forEach(e => {
            const row = document.createElement("div");
            row.className = "admin-vote-row";
            row.innerHTML = `<span>${e.name}: <strong>${e.count} votos</strong></span><button>Resetear</button>`;
            row.querySelector("button").addEventListener("click", () => {
                if (!confirm(`¿Resetear los votos de ${e.name}?`)) return;
                database.ref(`votacion/${e.name}`).set(0).then(() => loadVotesAdmin());
            });
            list.appendChild(row);
        });
    }).catch(err => {
        document.getElementById("admin-votes-list").innerHTML = `Error de conexión: ${err.message}`;
    });
}

// --- RANKING ---
function loadRankingAdmin() {
    database.ref("ranking").orderByChild("puntaje").limitToLast(15).once("value").then(snap => {
        const list = document.getElementById("admin-ranking-list");
        list.innerHTML = "";
        let arr = [];
        snap.forEach(c => arr.push(c.val()));
        if (arr.length === 0) {
            list.innerHTML = "Todavía no hay puntajes guardados. Si jugás y guardás un puntaje y no aparece acá, revisá las reglas de Firebase Realtime Database (deben permitir escritura).";
            return;
        }
        arr.reverse().forEach(item => {
            const row = document.createElement("div");
            row.className = "admin-rank-row";
            row.innerHTML = `<span><strong>${item.nombre}</strong> (${item.provincia || "-"})</span><span>${item.puntaje} pts</span>`;
            list.appendChild(row);
        });
    }).catch(err => {
        document.getElementById("admin-ranking-list").innerHTML = `Error de conexión: ${err.message}`;
    });
}
