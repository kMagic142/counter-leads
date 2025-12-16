const API_URL = 'http://localhost:3000/api';

let count = 0;

const counterDisplay = document.getElementById('counterDisplay');
const plusButton = document.getElementById('plusButton');
const minusButton = document.getElementById('minusButton');
const sendButton = document.getElementById('sendButton');
const noDealButton = document.getElementById('noDealButton');
const withDealButton = document.getElementById('withDealButton');
const companyButton = document.getElementById('companyButton');
const statusEl = document.getElementById('status');

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

async function fetchLiveCount() {
  const r = await fetch(`${API_URL}/live`);
  const data = await r.json();
  const n = parseInt(data && data.count, 10);
  return Number.isNaN(n) ? 0 : n;
}

async function setLiveCount(n) {
  const r = await fetch(`${API_URL}/live/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: n })
  });
  const data = await r.json();
  const v = parseInt(data && data.count, 10);
  return Number.isNaN(v) ? 0 : v;
}

async function incrementLiveCount() {
  const r = await fetch(`${API_URL}/live/increment`, { method: 'POST' });
  const data = await r.json();
  const v = parseInt(data && data.count, 10);
  return Number.isNaN(v) ? (count + 1) : v;
}

async function resetLiveCount() {
  const r = await fetch(`${API_URL}/live/reset`, { method: 'POST' });
  const data = await r.json();
  const v = parseInt(data && data.count, 10);
  return Number.isNaN(v) ? 0 : v;
}

async function addToHistory(countValue) {
  await fetch(`${API_URL}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      count: countValue,
      timestamp: new Date().toISOString()
    })
  });
}

async function addCategoryRow(categoryName, text) {
  await fetch(`${API_URL}/category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categoryName,
      text: text || '',
      timestamp: new Date().toISOString()
    })
  });
}

function render() {
  if (counterDisplay) counterDisplay.textContent = String(count);
}

function startLiveCountEvents() {
  try {
    const es = new EventSource(`${API_URL}/live/events`);
    es.addEventListener('liveCount', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const n = parseInt(data && data.count, 10);
        count = Number.isNaN(n) ? 0 : n;
        render();
        setStatus('');
      } catch {
      }
    });
    es.onerror = () => {
      setStatus('Server offline');
    };
  } catch {
    setStatus('Server offline');
  }
}

async function init() {
  setStatus('');
  try {
    count = await fetchLiveCount();
    render();
    startLiveCountEvents();
  } catch {
    setStatus('Server offline');
  }

  if (plusButton) {
    plusButton.addEventListener('click', async () => {
      try {
        count = await incrementLiveCount();
        render();
      } catch {
        setStatus('Server offline');
      }
    });
  }

  if (minusButton) {
    minusButton.addEventListener('click', async () => {
      try {
        count = await setLiveCount(Math.max(0, (parseInt(count, 10) || 0) - 1));
        render();
      } catch {
        setStatus('Server offline');
      }
    });
  }

  if (sendButton) {
    sendButton.addEventListener('click', async () => {
      try {
        if ((parseInt(count, 10) || 0) > 0) {
          await addToHistory(count);
        }
        count = await resetLiveCount();
        render();
      } catch {
        setStatus('Server offline');
      }
    });
  }

  async function handleCategoryAdd(categoryName) {
    const text = prompt('Enter text for the new entry:');
    if (text == null) return;
    try {
      await addCategoryRow(categoryName, text);
      setStatus('Added');
      setTimeout(() => setStatus(''), 900);
    } catch {
      setStatus('Server offline');
    }
  }

  if (noDealButton) {
    noDealButton.addEventListener('click', () => handleCategoryAdd('Fara Deal Existent'));
  }
  if (withDealButton) {
    // Matches the "Lost Deal" tab in the main UI.
    withDealButton.addEventListener('click', () => handleCategoryAdd('Cu deal existent dar lost'));
  }
  if (companyButton) {
    companyButton.addEventListener('click', () => handleCategoryAdd('Alta companie la care au aplicat'));
  }
}

init();
