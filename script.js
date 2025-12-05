let count = 0;
const API_URL = 'http://localhost:3000/api';

const counterDisplay = document.getElementById('counterDisplay');
const counterButton = document.getElementById('counterButton');
const resetButton = document.getElementById('resetButton');
const historyList = document.getElementById('historyList');

async function loadHistory() {
    try {
        const response = await fetch(`${API_URL}/history`);
        return await response.json();
    } catch (error) {
        console.error('Error loading history:', error);
        return [];
    }
}

async function renderHistory() {
    const history = await loadHistory();
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
        <div class="history-timestamp">${new Date().toLocaleString()}</div>
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

async function saveEdit(li, id) {
    const input = li.querySelector('.history-input');
    if (!input) return;
    const newVal = parseInt(input.value);
    if (Number.isNaN(newVal) || newVal < 0) return;
    
    try {
        await fetch(`${API_URL}/history/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: newVal })
        });
        renderHistory();
    } catch (error) {
        console.error('Error updating entry:', error);
    }
}

async function deleteHistoryItem(id) {
    try {
        await fetch(`${API_URL}/history/${id}`, { method: 'DELETE' });
        renderHistory();
    } catch (error) {
        console.error('Error deleting entry:', error);
    }
}

async function addToHistory(countValue) {
    try {
        await fetch(`${API_URL}/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                count: countValue,
                timestamp: new Date().toISOString()
            })
        });
        renderHistory();
    } catch (error) {
        console.error('Error adding entry:', error);
    }
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

// Initialize
counterDisplay.textContent = count;
renderHistory();