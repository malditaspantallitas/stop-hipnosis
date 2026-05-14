const onboardingDiv = document.getElementById('onboarding');
const dashboardDiv = document.getElementById('dashboard');

// Boton opciones en dashboard
function addOptionsLink() {
  if (document.getElementById('btnOptions')) return;
  const btn = document.createElement('button');
  btn.id = 'btnOptions';
  btn.textContent = 'Configuracion avanzada';
  btn.className = 'toggle-btn';
  btn.style.cssText = 'margin-top:8px; background:#2a2d3a; color:#94a3b8; font-size:13px';
  btn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  dashboardDiv.appendChild(btn);
}

function showDashboard(data) {
  onboardingDiv.classList.add('hidden');
  dashboardDiv.classList.remove('hidden');

  const name = data.userName || '';
  document.getElementById('greetUser').textContent = name ? 'Hola, ' + name + '.' : '';

  const blockingEnabled = data.blockingEnabled;
  const badge = document.getElementById('statusBadge');
  const btn = document.getElementById('btnToggle');

  if (blockingEnabled) {
    badge.textContent = 'Bloqueo activo';
    badge.className = 'status-badge status-active';
    btn.textContent = 'Desactivar bloqueo';
    btn.className = 'toggle-btn toggle-on';
  } else {
    badge.textContent = 'Bloqueo desactivado';
    badge.className = 'status-badge status-inactive';
    btn.textContent = 'Activar bloqueo';
    btn.className = 'toggle-btn toggle-off';
  }

  const tempAccess = data.tempAccess || {};
  const now = Date.now();
  const sites = ['youtube', 'instagram', 'tiktok'];
  sites.forEach(site => {
    const el = document.getElementById('st-' + site);
    if (!el) return;
    if (!blockingEnabled) {
      el.textContent = 'Libre';
      el.className = 'site-status status-allowed';
    } else if (tempAccess[site] && tempAccess[site] > now) {
      const mins = Math.ceil((tempAccess[site] - now) / 60000);
      el.textContent = 'Libre ' + mins + 'min';
      el.className = 'site-status status-allowed';
    } else {
      el.textContent = 'Bloqueado';
      el.className = 'site-status site-blocked';
    }
  });

  addOptionsLink();
}

// INIT: comprobar si ya hizo onboarding
chrome.storage.local.get(['onboardingDone', 'userName', 'blockingEnabled', 'tempAccess'], (data) => {
  if (data.onboardingDone === true) {
    showDashboard(data);
  } else {
    onboardingDiv.classList.remove('hidden');
    dashboardDiv.classList.add('hidden');
  }
});

// Guardar onboarding
document.getElementById('btnSaveOnboarding').addEventListener('click', () => {
  const name = document.getElementById('inputName').value.trim();
  const age = document.getElementById('inputAge').value.trim();
  const job = document.getElementById('inputJob').value.trim();
  const goal = document.getElementById('inputGoal').value.trim();
  if (!name || !goal) {
    alert('Por favor rellena al menos tu nombre y tu meta.');
    return;
  }
  chrome.storage.local.set({
    onboardingDone: true,
    userName: name,
    userAge: age,
    userJob: job,
    userGoals: [goal],
    blockingEnabled: true,
    blockYoutube: true,
    blockInstagram: true,
    blockTiktok: true
  }, () => {
    chrome.runtime.sendMessage({ type: 'updateRules' });
    chrome.storage.local.get(['onboardingDone', 'userName', 'blockingEnabled', 'tempAccess'], showDashboard);
  });
});

// Toggle bloqueo
document.getElementById('btnToggle').addEventListener('click', () => {
  chrome.storage.local.get(['blockingEnabled'], (data) => {
    const next = !data.blockingEnabled;
    chrome.storage.local.set({ blockingEnabled: next }, () => {
      chrome.runtime.sendMessage({ type: 'updateRules' });
      chrome.storage.local.get(['onboardingDone', 'userName', 'blockingEnabled', 'tempAccess'], showDashboard);
    });
  });
});

// Reiniciar contadores
document.getElementById('btnReset').addEventListener('click', () => {
  chrome.storage.local.set({ accessCount: {}, tempAccess: {} }, () => {
    chrome.runtime.sendMessage({ type: 'updateRules' });
    chrome.storage.local.get(['onboardingDone', 'userName', 'blockingEnabled', 'tempAccess'], showDashboard);
    alert('Contadores reiniciados.');
  });
});
