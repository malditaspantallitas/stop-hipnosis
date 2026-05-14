const onboardingDiv = document.getElementById('onboarding');
const dashboardDiv = document.getElementById('dashboard');

function loadDashboard() {
  chrome.storage.local.get(['onboardingDone', 'userName', 'blockingEnabled', 'tempAccess'], (data) => {
    if (data.onboardingDone === true) {
      showDashboard(data);
    } else {
      onboardingDiv.classList.remove('hidden');
      dashboardDiv.classList.add('hidden');
    }
  });
}

function showDashboard(data) {
  onboardingDiv.classList.add('hidden');
  dashboardDiv.classList.remove('hidden');

  const name = data.userName || '';
  document.getElementById('greetUser').textContent = name ? 'Hola, ' + name + '.' : '';

  const blockingEnabled = data.blockingEnabled;
  const badge = document.getElementById('statusBadge');
  const btnUnlock = document.getElementById('btnUnlock');

  if (blockingEnabled) {
    badge.textContent = 'Bloqueo activo';
    badge.className = 'status-badge status-active';
    btnUnlock.textContent = 'Desactivar bloqueo (requiere PIN)';
    btnUnlock.className = 'toggle-btn toggle-off';
    btnUnlock.style.marginTop = '16px';
  } else {
    badge.textContent = 'Bloqueo desactivado';
    badge.className = 'status-badge status-inactive';
    btnUnlock.textContent = 'Activar bloqueo';
    btnUnlock.className = 'toggle-btn toggle-on';
    btnUnlock.style.marginTop = '16px';
  }

  const tempAccess = data.tempAccess || {};
  const now = Date.now();
  ['youtube', 'instagram', 'tiktok'].forEach(site => {
    const el = document.getElementById('st-' + site);
    if (!el) return;
    if (!blockingEnabled) {
      el.textContent = 'Libre'; el.className = 'site-status status-allowed';
    } else if (tempAccess[site] && tempAccess[site] > now) {
      const mins = Math.ceil((tempAccess[site] - now) / 60000);
      el.textContent = 'Libre ' + mins + 'min'; el.className = 'site-status status-allowed';
    } else {
      el.textContent = 'Bloqueado'; el.className = 'site-status site-blocked';
    }
  });
}

// INIT
loadDashboard();

// --- ONBOARDING ---
document.getElementById('btnSaveOnboarding').addEventListener('click', () => {
  const name = document.getElementById('inputName').value.trim();
  const age = document.getElementById('inputAge').value.trim();
  const job = document.getElementById('inputJob').value.trim();
  const goal = document.getElementById('inputGoal').value.trim();
  const pin = document.getElementById('inputPin').value.trim();
  if (!name || !goal) { alert('Rellena al menos tu nombre y tu meta.'); return; }
  if (!pin || pin.length < 4) { alert('Introduce un PIN de 4 digitos.'); return; }
  chrome.storage.local.set({
    onboardingDone: true, userName: name, userAge: age,
    userJob: job, userGoals: [goal], userPin: pin,
    blockingEnabled: true, blockYoutube: true, blockInstagram: true, blockTiktok: true
  }, () => {
    chrome.runtime.sendMessage({ type: 'updateRules' });
    loadDashboard();
  });
});

// --- BOTON DESACTIVAR / ACTIVAR ---
document.getElementById('btnUnlock').addEventListener('click', () => {
  chrome.storage.local.get(['blockingEnabled'], (data) => {
    if (!data.blockingEnabled) {
      // Si ya esta desactivado, activar directamente
      chrome.storage.local.set({ blockingEnabled: true }, () => {
        chrome.runtime.sendMessage({ type: 'updateRules' });
        loadDashboard();
      });
    } else {
      // Mostrar panel PIN
      document.getElementById('pinPanel').classList.remove('hidden');
      document.getElementById('pinInput').value = '';
      document.getElementById('pinError').style.display = 'none';
      document.getElementById('pinInput').focus();
    }
  });
});

// Confirmar PIN
document.getElementById('btnConfirmPin').addEventListener('click', () => {
  const pin = document.getElementById('pinInput').value.trim();
  chrome.runtime.sendMessage({ type: 'verifyPin', pin }, (res) => {
    if (res && res.ok) {
      document.getElementById('pinPanel').classList.add('hidden');
      chrome.storage.local.set({ blockingEnabled: false }, () => {
        chrome.runtime.sendMessage({ type: 'updateRules' });
        loadDashboard();
      });
    } else {
      document.getElementById('pinError').style.display = 'block';
      document.getElementById('pinInput').value = '';
      document.getElementById('pinInput').focus();
    }
  });
});

// Enter en input PIN
document.getElementById('pinInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btnConfirmPin').click();
});

// Cancelar PIN
document.getElementById('btnCancelPin').addEventListener('click', () => {
  document.getElementById('pinPanel').classList.add('hidden');
});

// Reiniciar contadores
document.getElementById('btnReset').addEventListener('click', () => {
  chrome.storage.local.set({ accessCount: {}, tempAccess: {} }, () => {
    chrome.runtime.sendMessage({ type: 'updateRules' });
    loadDashboard();
  });
});

// Opciones
document.getElementById('btnOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
