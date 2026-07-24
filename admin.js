// --- CONFIGURACIÓN ---
// ⚠️ Esto es solo una traba básica del lado del cliente, NO es seguridad real.
// Cualquiera que vea el código fuente puede encontrar esta contraseña.
// Para seguridad real hay que usar Firebase Authentication y reglas de la base de datos
// que exijan estar autenticado para escribir en "provinceStatus". Cambiá esta clave igual.
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
    loadProvinceAdmin();
    loadVotesAdmin();
    loadRankingAdmin();
}

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
