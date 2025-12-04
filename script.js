let count = 0;
const STORAGE_KEY = 'counterLeadsHistory_v1';

const counterDisplay = document.getElementById('counterDisplay');
const counterButton = document.getElementById('counterButton');
const resetButton = document.getElementById('resetButton');
const historyList = document.getElementById('historyList');

function loadHistory() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function renderHistory() {
    const history = loadHistory();
    historyList.innerHTML = '';
    history.forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item';

        li.innerHTML = `
            <div class="history-left">
                <div class="history-count" data-id="${item.id}">${item.count}</div>
                <div class="history-timestamp">${new Date(item.timestamp).toLocaleString()}</div>
            </div>
            <div class="history-actions">
                <button class="history-btn history-btn-edit btn-small">Edit</button>
                <button class="history-btn history-btn-delete btn-small">Delete</button>
            </div>
        `;

        const editBtn = li.querySelector('.history-btn-edit');
        const delBtn = li.querySelector('.history-btn-delete');

        editBtn.addEventListener('click', () => startEdit(li, item.id, item.count));
        delBtn.addEventListener('click', () => deleteHistoryItem(item.id));

        historyList.appendChild(li);
    });
}

function startEdit(li, id, currentCount) {
    const left = li.querySelector('.history-left');
    const actions = li.querySelector('.history-actions');
    left.innerHTML = `
        <input type="number" class="history-input" value="${currentCount}" min="0" />
        <div class="history-timestamp">${new Date(loadHistory().find(i => i.id === id).timestamp).toLocaleString()}</div>
    `;
    actions.innerHTML = `
        <button class="history-btn history-btn-save btn-small">Save</button>
        <button class="history-btn history-btn-cancel btn-small">Cancel</button>
    `;
    const saveBtn = actions.querySelector('.history-btn-save');
    const cancelBtn = actions.querySelector('.history-btn-cancel');
    saveBtn.addEventListener('click', () => saveEdit(li, id));
    cancelBtn.addEventListener('click', () => renderHistory());
    left.querySelector('.history-input').focus();
}

function saveEdit(li, id) {
    const input = li.querySelector('.history-input');
    if (!input) return;
    const newVal = parseInt(input.value);
    if (Number.isNaN(newVal) || newVal < 0) return;
    const history = loadHistory();
    const idx = history.findIndex(i => i.id === id);
    if (idx === -1) return;
    history[idx].count = newVal;
    saveHistory(history);
    renderHistory();
}

function deleteHistoryItem(id) {
    const history = loadHistory().filter(i => i.id !== id);
    saveHistory(history);
    renderHistory();
}

function addToHistory(countValue) {
    const history = loadHistory();
    history.unshift({
        id: Date.now(),
        count: countValue,
        timestamp: new Date().toISOString()
    });
    saveHistory(history);
    renderHistory();
}

counterButton.addEventListener('click', () => {
    count++;
    counterDisplay.textContent = count;
});

resetButton.addEventListener('click', () => {
    if (count > 0) addToHistory(count);
    count = 0;
    counterDisplay.textContent = count;
});

// initialize
counterDisplay.textContent = count;
renderHistory();