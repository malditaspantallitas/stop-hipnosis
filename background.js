const DEFAULT_WINDOWS = [
  { start: '13:00', end: '16:00' },
  { start: '20:00', end: '21:00' }
];

// IDs dinamicos para webs personalizadas (empiezan en 100)
const DYNAMIC_RULE_BASE_ID = 100;

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isAllowedTime(windows) {
  const current = getCurrentMinutes();
  return windows.some(w => {
    const start = timeToMinutes(w.start);
    const end = timeToMinutes(w.end);
    return current >= start && current < end;
  });
}

function isNightTime(nightStart) {
  const [nh, nm] = (nightStart || '23:30').split(':').map(Number);
  const nightMins = nh * 60 + nm;
  const current = getCurrentMinutes();
  return current >= nightMins || current < 360;
}

// Construir reglas dinamicas para webs personalizadas
function buildDynamicRules(customSites) {
  return customSites.map((domain, i) => ({
    id: DYNAMIC_RULE_BASE_ID + i,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: '/blocked.html?site=custom&domain=' + encodeURIComponent(domain) }
    },
    condition: {
      urlFilter: '||' + domain,
      resourceTypes: ['main_frame']
    }
  }));
}

async function updateBlockingRules() {
  const data = await chrome.storage.local.get([
    'onboardingDone', 'blockingEnabled', 'tempAccess',
    'allowedWindows', 'nightStart', 'customSites',
    'blockYoutube', 'blockInstagram', 'blockTiktok'
  ]);

  // Limpiar siempre las reglas dinamicas anteriores
  const existingDynamic = await chrome.declarativeNetRequest.getDynamicRules();
  const idsToRemove = existingDynamic.map(r => r.id);

  if (!data.onboardingDone || !data.blockingEnabled) {
    // Desactivar ruleset estatico y limpiar dinamicas
    try { await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] }); } catch(e) {}
    if (idsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: idsToRemove, addRules: [] });
    }
    return;
  }

  const windows = data.allowedWindows || DEFAULT_WINDOWS;
  const allowed = isAllowedTime(windows);
  const customSites = data.customSites || [];

  if (allowed) {
    // Horario permitido: desbloquear todo
    try { await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] }); } catch(e) {}
    if (idsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: idsToRemove, addRules: [] });
    }
  } else {
    // Fuera de horario: activar ruleset estatico + reglas dinamicas
    // Solo activar los sitios que estan marcados
    const youtube = data.blockYoutube !== false;
    const instagram = data.blockInstagram !== false;
    const tiktok = data.blockTiktok !== false;

    // Ruleset estatico cubre youtube/instagram/tiktok
    if (youtube || instagram || tiktok) {
      try { await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['ruleset_1'] }); } catch(e) {}
    } else {
      try { await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] }); } catch(e) {}
    }

    // Reglas dinamicas para webs personalizadas
    const newRules = buildDynamicRules(customSites);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: idsToRemove,
      addRules: newRules
    });
  }
}

// Revisar cada minuto
chrome.alarms.create('checkTime', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkTime') updateBlockingRules();
  if (alarm.name.startsWith('revokeAccess_')) {
    const site = alarm.name.replace('revokeAccess_', '');
    chrome.storage.local.get(['tempAccess'], (d) => {
      const tempAccess = d.tempAccess || {};
      delete tempAccess[site];
      chrome.storage.local.set({ tempAccess }, updateBlockingRules);
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'grantAccess') {
    const { site, minutes } = msg;
    const expiry = Date.now() + minutes * 60 * 1000;
    chrome.storage.local.get(['tempAccess', 'accessCount'], (d) => {
      const tempAccess = d.tempAccess || {};
      const accessCount = d.accessCount || {};
      tempAccess[site] = expiry;
      accessCount[site] = (accessCount[site] || 0) + 1;
      chrome.storage.local.set({ tempAccess, accessCount }, () => {
        updateBlockingRules();
        chrome.alarms.create('revokeAccess_' + site, { delayInMinutes: minutes });
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (msg.type === 'getStatus') {
    chrome.storage.local.get(['tempAccess', 'accessCount', 'allowedWindows', 'nightStart'], (d) => {
      const windows = d.allowedWindows || DEFAULT_WINDOWS;
      sendResponse({
        isAllowed: isAllowedTime(windows),
        isNight: isNightTime(d.nightStart),
        tempAccess: d.tempAccess || {},
        accessCount: d.accessCount || {}
      });
    });
    return true;
  }

  if (msg.type === 'updateRules') {
    updateBlockingRules();
    sendResponse({ ok: true });
    return true;
  }

  // Verificar PIN para desactivar
  if (msg.type === 'verifyPin') {
    chrome.storage.local.get(['userPin'], (d) => {
      const correct = d.userPin && d.userPin === msg.pin;
      sendResponse({ ok: correct });
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['onboardingDone'], (d) => {
    if (!d.onboardingDone) {
      chrome.storage.local.set({
        blockingEnabled: false,
        onboardingDone: false,
        tempAccess: {},
        accessCount: {}
      });
    }
  });
  updateBlockingRules();
});
