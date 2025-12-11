// CONFIGURACIÓN
// -------------------------------------------------------------------------
// Pega aquí la URL de tu Google Apps Script cuando lo hayas desplegado
const API_URL = "https://script.google.com/macros/s/AKfycby2vJjVEZBwjct9ySt-Fi1lklbA212bgmXzFjuZ5fXRILyjpp4826b3yiSdl5PAI6rZzQ/exec";
// -------------------------------------------------------------------------

// STATE
let currentUser = null;
let selectedOptions = [];
let availableOptions = [];
let checkInterval = null;

// DOM ELEMENTS
const views = {
    login: document.getElementById('view-login'),
    voting: document.getElementById('view-voting'),
    results: document.getElementById('view-results'),
    admin: document.getElementById('view-admin'),
    closed: document.getElementById('view-closed')
};

const ui = {
    usernameInput: document.getElementById('username-input'),
    btnLogin: document.getElementById('btn-login'),
    displayUsername: document.getElementById('display-username'),
    selectedCount: document.getElementById('selected-count'),
    optionsList: document.getElementById('options-list'),
    btnSubmit: document.getElementById('btn-submit-vote'),
    ctx: document.getElementById('resultsChart').getContext('2d'),
    toast: document.getElementById('toast'),
    logout: document.getElementById('btn-logout-admin')
};

// CHART INSTANCE
let resultsChart = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if URL parameter is present for testing without UI flow
    // ...
});

// --- NAVIGATION ---
function showView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active');
}

// --- LOGIN LOGIC ---
ui.btnLogin.addEventListener('click', () => {
    const name = ui.usernameInput.value.trim();
    if (!name) return showToast("⚠️ Pon tu nombre porfa");

    currentUser = name;

    if (name.toLowerCase() === 'ivanadmindios') {
        showToast("👑 Modo Dios Activado");
        initAdmin();
    } else {
        // Normal User
        checkVotingStatusAndProceed();
    }
});

ui.logout.addEventListener('click', () => {
    location.reload();
});

// --- VOTING LOGIC ---
async function checkVotingStatusAndProceed() {
    try {
        const data = await fetchAPI(); // GET
        if (data.voting_open) {
            availableOptions = data.options;
            renderOptions();
            ui.displayUsername.innerText = currentUser;
            showView('voting');
        } else {
            showView('closed');
        }
    } catch (e) {
        showToast("Error de conexión ❌");
        console.error(e);
        // FALLBACK PARA DEMO SI NO HAY API
        console.warn("Usando datos Mock por fallo de API");
        const mock = mockGet();
        if (mock) {
            availableOptions = mock.options;
            renderOptions();
            ui.displayUsername.innerText = currentUser + " (OFFLINE)";
            showView('voting');
        }
    }
}

function renderOptions() {
    ui.optionsList.innerHTML = '';
    availableOptions.forEach(opt => {
        const el = document.createElement('div');
        el.className = 'option-card glass';
        el.innerHTML = `
            <span>${opt.name}</span>
            <div class="option-check"></div>
        `;
        el.onclick = () => toggleOption(opt.id, el);
        ui.optionsList.appendChild(el);
    });
}

function toggleOption(id, cardEl) {
    // Si ya está, lo quitamos
    if (selectedOptions.includes(id)) {
        selectedOptions = selectedOptions.filter(x => x !== id);
        cardEl.classList.remove('selected');
    } else {
        // Si no está, chequeamos límite
        if (selectedOptions.length >= 3) {
            return showToast("⚠️ Solo puedes elegir 3");
        }
        selectedOptions.push(id);
        cardEl.classList.add('selected');
    }
    updateCounter();
}

function updateCounter() {
    ui.selectedCount.innerText = selectedOptions.length;
    ui.btnSubmit.disabled = selectedOptions.length !== 3;
}

ui.btnSubmit.addEventListener('click', async () => {
    if (selectedOptions.length !== 3) return;

    // Obtener nombres de las opciones para enviar (más fácil para sheets)
    const names = availableOptions
        .filter(o => selectedOptions.includes(o.id))
        .map(o => o.name);

    ui.btnSubmit.innerText = "Enviando...";

    try {
        await sendAPI({ action: 'vote', user: currentUser, options: names });
        showView('results');
        initResultsLoop();
    } catch (e) {
        showToast("Error al enviar 😭");
        ui.btnSubmit.innerText = "Reintentar";
    }
});

// --- RESULTS LOGIC ---
function initResultsLoop() {
    updateChart(); // First run
    checkInterval = setInterval(updateChart, 4000); // Loop every 4s
}

async function updateChart() {
    try {
        const data = await fetchAPI();
        const labels = Object.keys(data.results);
        const values = Object.values(data.results);

        document.getElementById('total-votes-display').innerText = `${data.total_votes} Votos Totales`;

        if (!resultsChart) {
            // First time render
            resultsChart = new Chart(ui.ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '# Votos',
                        data: values,
                        backgroundColor: 'rgba(255, 0, 128, 0.6)',
                        borderColor: 'rgba(255, 0, 128, 1)',
                        borderWidth: 1,
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                        x: { ticks: { color: 'white' }, grid: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        } else {
            // Update data
            resultsChart.data.labels = labels;
            resultsChart.data.datasets[0].data = values;
            resultsChart.update();
        }

    } catch (e) { console.log("Polling error", e); }
}

// --- ADMIN LOGIC ---
function initAdmin() {
    showView('admin');

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout')) return;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));

            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab).classList.remove('hidden');
        });
    });

    // Listeners
    document.getElementById('btn-go-to-voting').onclick = () => {
        currentUser = "Admin";
        checkVotingStatusAndProceed();
    };

    document.getElementById('btn-reset-votes').onclick = async () => {
        if (confirm("¿Seguro que quieres borrar TODOS los votos?")) {
            await sendAPI({ action: 'reset' });
            showToast("Votos a cero 🗑️");
        }
    };

    document.getElementById('btn-close-voting').onclick = async () => {
        await sendAPI({ action: 'close' });
        showToast("Votaciones CERRADAS 🔒");
    };

    document.getElementById('btn-export-counts').onclick = () => {
        // En un caso real, esto se haría obteniendo los datos y creando un Blob
        window.open(API_URL + "?export=counts", '_blank');
        showToast("Generando CSV...");
    };

    // --- NUEVO: Logica para añadir opciones ---
    const inputAdd = document.getElementById('new-option-input');
    const btnAdd = document.getElementById('btn-add-option');

    const handleAddOption = async () => {
        const name = inputAdd.value.trim();
        if (!name) return;

        inputAdd.value = ''; // Limpiar
        await sendAPI({ action: 'add_option', name: name });
        showToast("Opción añadida ✅");
        // Refrescar lista (opcional, o esperar al reload)
    };

    btnAdd.onclick = handleAddOption;
    inputAdd.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddOption();
    });
}


// --- API HELPERS ---
async function fetchAPI() {
    if (API_URL.includes("URL_DE_TU")) return mockGet(); // Use Mock if not configured
    const res = await fetch(API_URL);
    return await res.json();
}

async function sendAPI(payload) {
    if (API_URL.includes("URL_DE_TU")) return mockPost(payload); // Use Mock

    // Google Apps Script requires a specific POST setup often (no CORS sometimes requires no-cors mode, 
    // but that breaks reading response. For simple string/beacon use 'no-cors' if issues arise)
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain evita Preflight CORS
        body: JSON.stringify(payload)
    });
    return await res.json();
}

function showToast(msg) {
    ui.toast.innerText = msg;
    ui.toast.classList.remove('hidden');
    setTimeout(() => ui.toast.classList.add('hidden'), 3000);
}


// --- MOCK DATA (PARA QUE FUNCIONE SIN SERVIDOR MIENTRAS PRUEBAS) ---
function mockGet() {
    return {
        voting_open: true,
        options: [
            { id: 1, name: 'Opción 1 (Demo)' },
            { id: 2, name: 'Opción 2 (Demo)' },
            { id: 3, name: 'Opción 3 (Demo)' },
            { id: 4, name: 'Opción 4 (Demo)' },
            { id: 5, name: 'Opción 5 (Demo)' }
        ],
        results: { 'Opción 1 (Demo)': 5, 'Opción 2 (Demo)': 12, 'Opción 3 (Demo)': 2 },
        total_votes: 19
    };
}
function mockPost(data) {
    console.log("MOCK POST:", data);
    return { status: 'success' };
}
