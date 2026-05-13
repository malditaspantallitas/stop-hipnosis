// Horarios permitidos: 13:00-16:00 y 20:00-21:00
const ALLOWED_WINDOWS = [
  { start: 13 * 60, end: 16 * 60 },
  { start: 20 * 60, end: 21 * 60 }
];

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isAllowedTime() {
  const current = getCurrentMinutes();
  return ALLOWED_WINDOWS.some(w => current >= w.start && current < w.end);
}

function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 23 || hour < 6;
}

async function updateBlockingRules() {
  const data = await chrome.storage.local.get(['onboardingDone', 'blockingEnabled', 'tempAccess']);
  if (!data.onboardingDone || !data.blockingEnabled) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] });
    return;
  }
  if (isAllowedTime()) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] });
  } else {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['ruleset_1'] });
  }
}

// Revisar cada minuto
chrome.alarms.create('checkTime', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkTime') updateBlockingRules();
  if (alarm.name.startsWith('revokeAccess_')) {
    const site = alarm.name.replace('revokeAccess_', '');
    chrome.storage.local.get(['tempAccess'], (data) => {
      const tempAccess = data.tempAccess || {};
      delete tempAccess[site];
      chrome.storage.local.set({ tempAccess }, updateBlockingRules);
    });
  }
});

// Escuchar mensajes
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'grantAccess') {
    const { site, minutes } = msg;
    const expiry = Date.now() + minutes * 60 * 1000;
    chrome.storage.local.get(['tempAccess', 'accessCount'], (data) => {
      const tempAccess = data.tempAccess || {};
      const accessCount = data.accessCount || {};
      tempAccess[site] = expiry;
      accessCount[site] = (accessCount[site] || 0) + 1;
      chrome.storage.local.set({ tempAccess, accessCount }, () => {
        chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] });
        chrome.alarms.create('revokeAccess_' + site, { delayInMinutes: minutes });
        sendResponse({ ok: true });
      });
    });
    return true;
  }
  if (msg.type === 'getStatus') {
    chrome.storage.local.get(['tempAccess', 'accessCount'], (data) => {
      sendResponse({
        isAllowed: isAllowedTime(),
        isNight: isNightTime(),
        tempAccess: data.tempAccess || {},
        accessCount: data.accessCount || {}
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
  chrome.storage.local.set({
    blockingEnabled: false,
    onboardingDone: false,
    tempAccess: {},
    accessCount: {}
  });
});
