const params = new URLSearchParams(window.location.search);
const site = params.get('site') || 'youtube';

const SITE_URLS = {
  youtube: 'https://www.youtube.com',
  instagram: 'https://www.instagram.com',
  tiktok: 'https://www.tiktok.com'
};

const DAY_MESSAGES = [
  "Tu yo del pasado te limita para que tu yo del futuro logre sus metas.",
  "Has estado a punto de regalar tu atencion al mejor postor.",
  "Anyadiste esta web para que se bloqueara. Y asi ha sido.",
  "En serio necesitas abrir esto o solo te ha abierto a ti?",
  "Ibas a entrar en una web disenada para quedarse con tu tiempo.",
  "Esta accion iba a hipnotizarte para que vieras anuncios. Curioso."
];

const NIGHT_MESSAGES = [
  "Hace una gran noche para apagar el ordenador y dormir tranquilamente.",
  "Ya has estado activo todo el dia. Permitete descansar.",
  "Quieres una noche reparadora, pero esta web tenia otros planes.",
  "Es hora de apagar el ordenador. Tomarte un vaso de leche. En serio.",
  "Hace una gran noche para coger un libro antes de dormir."
];

// Curva de espera: 10s, 30s, 40s, 60s, 90s, 120s
const WAIT_CURVE = [10, 30, 40, 60, 90, 120];

function getWaitSeconds(count) {
  if (count >= WAIT_CURVE.length) return 120;
  return WAIT_CURVE[count];
}

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isNight() {
  const h = new Date().getHours();
  return h >= 23 || h < 6;
}

chrome.runtime.sendMessage({ type: 'getStatus' }, (status) => {
  const accessCount = ((status && status.accessCount) || {})[site] || 0;
  const night = isNight();
  const msg = night ? getRandom(NIGHT_MESSAGES) : getRandom(DAY_MESSAGES);
  document.getElementById('mainMessage').textContent = msg;

  chrome.storage.local.get(['userGoals', 'userName'], (data) => {
    const goals = data.userGoals || [];
    const name = data.userName || '';
    if (goals.length > 0) {
      const goalEl = document.getElementById('goalReminder');
      goalEl.textContent = (name ? name + ', recuerda: ' : 'Recuerda: ') + goals[0];
    }
  });

  document.getElementById('btnWantIt').addEventListener('click', () => {
    const waitSecs = getWaitSeconds(accessCount);
    startWait(waitSecs);
  });
});

function startWait(seconds) {
  document.getElementById('actionSection').classList.add('hidden');
  document.getElementById('waitSection').classList.remove('hidden');
  let remaining = seconds;
  document.getElementById('countdown').textContent = remaining;
  const bar = document.getElementById('waitBar');
  bar.style.width = '100%';
  const interval = setInterval(() => {
    remaining--;
    document.getElementById('countdown').textContent = remaining;
    bar.style.width = ((remaining / seconds) * 100) + '%';
    if (remaining <= 0) {
      clearInterval(interval);
      showMinutePicker();
    }
  }, 1000);
}

function showMinutePicker() {
  document.getElementById('waitSection').classList.add('hidden');
  document.getElementById('minutePicker').classList.remove('hidden');
  document.querySelectorAll('.btn-minutes').forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.min);
      chrome.storage.local.get(['accessCount'], (data) => {
        const count = ((data.accessCount) || {})[site] || 0;
        const finalMinutes = count >= 10 ? Math.min(minutes, 5) : minutes;
        chrome.runtime.sendMessage({ type: 'grantAccess', site, minutes: finalMinutes }, () => {
          window.location.href = SITE_URLS[site];
        });
      });
    });
  });
}
