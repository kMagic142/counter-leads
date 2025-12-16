// MV3 service worker: forwards lead status events to the local counter server.

const LOCAL_SERVER_BASE = 'http://localhost:3000';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'COPILOT_LEAD_STATUS_CHANGED') return;

  const payload = {
    leadId: msg.leadId,
    status: msg.status,
    url: msg.url,
    ts: msg.ts
  };

  // Fire-and-forget; the local server might not be running.
  fetch(`${LOCAL_SERVER_BASE}/api/leads/status-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {
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
