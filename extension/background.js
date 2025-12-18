// MV3 service worker: forwards lead status events to the local counter server.

const LOCAL_SERVER_BASE = 'http://localhost:3000';

let badgeTimer = null;

function flashCountBadge(newCount) {
  try {
    if (badgeTimer) clearTimeout(badgeTimer);
  } catch {
  }

  try {
    chrome.action.setBadgeBackgroundColor({ color: '#155e3b' });
    chrome.action.setBadgeText({ text: '+1' });
    chrome.action.setTitle({ title: `Leads Count: ${newCount} (+1)` });
  } catch {
    return;
  }

  badgeTimer = setTimeout(() => {
    try {
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setTitle({ title: 'Taxe Leads Tweaks' });
    } catch {
    }
  }, 1800);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'COPILOT_FETCH_TEXT') {
    const url = msg.url;
    if (!url || typeof url !== 'string') {
      try {
        sendResponse({ ok: false, error: 'Missing url' });
      } catch {
      }
      return false;
    }

    fetch(url)
      .then((r) => {
        if (!r || !r.ok) throw new Error(`Fetch failed: ${r ? r.status : 'no response'}`);
        return r.text();
      })
      .then((text) => {
        try {
          sendResponse({ ok: true, text });
        } catch {
        }
      })
      .catch((e) => {
        try {
          sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
        } catch {
        }
      });

    return true;
  }

  if (!msg || msg.type !== 'COPILOT_LEAD_STATUS_CHANGED') return;

  const payload = {
    leadId: msg.leadId,
    status: msg.status,
    url: msg.url,
    ts: msg.ts
  };

  // Best-effort; the local server might not be running.
  fetch(`${LOCAL_SERVER_BASE}/api/leads/status-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then((r) => (r && r.ok ? r.json() : null))
    .then((data) => {
      if (!data) return;
      if (data.counted === true) {
        const n = parseInt(data.count, 10);
        const nextCount = Number.isNaN(n) ? data.count : n;
        flashCountBadge(nextCount);
      }
    })
    .catch(() => {
      // ignore
    });

  // Best-effort acknowledgment
  try {
    sendResponse({ ok: true });
  } catch {
    // ignore
  }

  return true;
});
