// Mensajes por defecto
const DEFAULT_DAY_MSGS = [
  "Tu yo del pasado te limita para que tu yo del futuro logre sus metas.",
  "Has estado a punto de regalar tu atencion al mejor postor.",
  "Anyadiste esta web para que se bloqueara. Y asi ha sido.",
  "En serio necesitas abrir esto o solo te ha abierto a ti?",
  "Ibas a entrar en una web disenada para quedarse con tu tiempo.",
  "Esta accion iba a hipnotizarte para que vieras anuncios. Curioso."
];

const DEFAULT_NIGHT_MSGS = [
  "Hace una gran noche para apagar el ordenador y dormir tranquilamente.",
  "Ya has estado activo todo el dia. Permitete descansar.",
  "Quieres una noche reparadora, pero esta web tenia otros planes.",
  "Es hora de apagar el ordenador. Tomarte un vaso de leche. En serio.",
  "Hace una gran noche para coger un libro antes de dormir."
];

const DEFAULT_SCHEDULES = [
  { start: '13:00', end: '16:00' },
  { start: '20:00', end: '21:00' }
];

let schedules = [];
let dayMsgs = [];
let nightMsgs = [];
let customSites = [];

// --- RENDER FUNCTIONS ---

function renderSchedules() {
  const list = document.getElementById('scheduleList');
  list.innerHTML = '';
  schedules.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.innerHTML = `
      <label>Desde</label>
      <input type="time" class="time-input" value="${s.start}" data-idx="${i}" data-field="start">
      <label>Hasta</label>
      <input type="time" class="time-input" value="${s.end}" data-idx="${i}" data-field="end">
      <button class="remove-btn" data-remove-schedule="${i}" title="Eliminar">&times;</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.time-input').forEach(inp => {
    inp.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.idx);
      const field = e.target.dataset.field;
      schedules[idx][field] = e.target.value;
    });
  });

  list.querySelectorAll('[data-remove-schedule]').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.target.dataset.removeSchedule);
      schedules.splice(idx, 1);
      renderSchedules();
    });
  });
}

function renderMsgList(listId, msgs) {
  const ul = document.getElementById(listId);
  ul.innerHTML = '';
  msgs.forEach((msg, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span style="flex:1">${msg}</span><button class="remove-btn" data-idx="${i}">&times;</button>`;
    li.querySelector('.remove-btn').addEventListener('click', () => {
      msgs.splice(i, 1);
      renderMsgList(listId, msgs);
    });
    ul.appendChild(li);
  });
}

function renderCustomSites() {
  const ul = document.getElementById('customSiteList');
  ul.innerHTML = '';
  customSites.forEach((site, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span style="flex:1">${site}</span><button class="remove-btn" data-idx="${i}">&times;</button>`;
    li.querySelector('.remove-btn').addEventListener('click', () => {
      customSites.splice(i, 1);
      renderCustomSites();
    });
    ul.appendChild(li);
  });
}

// --- LOAD ---

chrome.storage.local.get([
  'allowedWindows', 'nightStart',
  'dayMessages', 'nightMessages',
  'customSites', 'userGoals',
  'blockYoutube', 'blockInstagram', 'blockTiktok'
], (data) => {
  schedules = data.allowedWindows || DEFAULT_SCHEDULES;
  dayMsgs = data.dayMessages || [...DEFAULT_DAY_MSGS];
  nightMsgs = data.nightMessages || [...DEFAULT_NIGHT_MSGS];
  customSites = data.customSites || [];

  document.getElementById('nightStart').value = data.nightStart || '23:30';
  document.getElementById('goalInput').value = (data.userGoals || [])[0] || '';

  document.getElementById('chk-youtube').checked = data.blockYoutube !== false;
  document.getElementById('chk-instagram').checked = data.blockInstagram !== false;
  document.getElementById('chk-tiktok').checked = data.blockTiktok !== false;

  renderSchedules();
  renderMsgList('dayMsgList', dayMsgs);
  renderMsgList('nightMsgList', nightMsgs);
  renderCustomSites();
});

// --- EVENTS ---

document.getElementById('btnAddSchedule').addEventListener('click', () => {
  schedules.push({ start: '09:00', end: '10:00' });
  renderSchedules();
});

document.getElementById('btnAddDayMsg').addEventListener('click', () => {
  const input = document.getElementById('dayMsgInput');
  const val = input.value.trim();
  if (!val) return;
  dayMsgs.push(val);
  input.value = '';
  renderMsgList('dayMsgList', dayMsgs);
});

document.getElementById('btnAddNightMsg').addEventListener('click', () => {
  const input = document.getElementById('nightMsgInput');
  const val = input.value.trim();
  if (!val) return;
  nightMsgs.push(val);
  input.value = '';
  renderMsgList('nightMsgList', nightMsgs);
});

document.getElementById('btnAddSite').addEventListener('click', () => {
  const input = document.getElementById('customSiteInput');
  let val = input.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!val) return;
  if (!customSites.includes(val)) {
    customSites.push(val);
    renderCustomSites();
  }
  input.value = '';
});

// Enter en inputs de mensajes
document.getElementById('dayMsgInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnAddDayMsg').click();
});
document.getElementById('nightMsgInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnAddNightMsg').click();
});
document.getElementById('customSiteInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnAddSite').click();
});

// --- SAVE ---

document.getElementById('btnSave').addEventListener('click', () => {
  const goal = document.getElementById('goalInput').value.trim();
  const nightStart = document.getElementById('nightStart').value || '23:30';
  const blockYoutube = document.getElementById('chk-youtube').checked;
  const blockInstagram = document.getElementById('chk-instagram').checked;
  const blockTiktok = document.getElementById('chk-tiktok').checked;

  chrome.storage.local.set({
    allowedWindows: schedules,
    nightStart,
    dayMessages: dayMsgs,
    nightMessages: nightMsgs,
    customSites,
    userGoals: goal ? [goal] : [],
    blockYoutube,
    blockInstagram,
    blockTiktok
  }, () => {
    chrome.runtime.sendMessage({ type: 'updateRules' });
    const toast = document.getElementById('toast');
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2500);
  });
});
