const DEFAULT_WINDOWS = [
  { start: '13:00', end: '16:00' },
  { start: '20:00', end: '21:00' }
];

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

async function updateBlockingRules() {
  const data = await chrome.storage.local.get([
    'onboardingDone', 'blockingEnabled', 'tempAccess',
    'allowedWindows', 'nightStart'
  ]);

  if (!data.onboardingDone || !data.blockingEnabled) {
    try { await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] }); } catch(e) {}
    return;
  }

  const windows = data.allowedWindows || DEFAULT_WINDOWS;
  const allowed = isAllowedTime(windows);

  if (allowed) {
    try { await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] }); } catch(e) {}
  } else {
    try { await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['ruleset_1'] }); } catch(e) {}
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

// Mensajes
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
        try { chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] }); } catch(e) {}
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
