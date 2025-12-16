let count = 0;
const API_URL = 'http://localhost:3000/api';

process.env.TZ = 'Europe/Bucharest';

const counterDisplay = document.getElementById('counterDisplay');
const counterButton = document.getElementById('counterButton');
const resetButton = document.getElementById('resetButton');
const historyList = document.getElementById('historyList');
const syncButton = document.getElementById('syncButton');
const addButton = document.getElementById('addButton');
const navButtons = document.querySelectorAll('.history-section .nav-btn');
let cachedData = [];

async function loadHistory() {
    try {
        if (cachedData.length) return cachedData;
        const response = await fetch(`${API_URL}/history`);
        cachedData = await response.json();
        return cachedData;
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
                <div class="history-timestamp">${(function(){
                    const d = new Date(item.timestamp);
                    return Number.isNaN(d.getTime()) ? (item.timestamp || '') : d.toLocaleString();
                })()}</div>
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

async function renderCategory(name) {
    try {
        const all = await loadHistory();
        const items = all.filter(item => {
            const cats = item.categories || {};
            switch (name) {
                case 'All':
                    return typeof item.endOfDayTotal !== 'undefined';
                case 'Fara Deal Existent':
                    return !!cats.faraDealExistent;
                case 'Cu deal existent dar lost':
                    return !!cats.cuDealExistentDarLost;
                case 'Alta companie la care au aplicat':
                    return !!cats.altaCompanieLaCareAuAplicat;
                default:
                    return true;
            }
        });
        historyList.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item';
            const isAll = name === 'All';
            const mainCount = isAll && typeof item.endOfDayTotal !== 'undefined' ? item.endOfDayTotal : item.count;
            const showCount = isAll; // hide count for other tabs
            const catTexts = (item.categories && item.categories.texts) || {};
            const categoryText = name === 'Fara Deal Existent' ? catTexts.faraDealExistent
                                  : name === 'Cu deal existent dar lost' ? catTexts.cuDealExistentDarLost
                                  : name === 'Alta companie la care au aplicat' ? catTexts.altaCompanieLaCareAuAplicat
                                  : undefined;
            li.innerHTML = `
                <div class="history-left">
                    ${showCount ? `<div class="history-count" data-id="${item.id}">${mainCount}</div>` : ''}
                    ${!showCount && categoryText ? `<div class="history-count" data-id="${item.id}">${categoryText}</div>` : ''}
                    <div class="history-timestamp">${(function(){
                        const d = new Date(item.timestamp);
                        return Number.isNaN(d.getTime()) ? (item.timestamp || '') : d.toLocaleString();
                    })()}</div>
                </div>
                <div class="history-actions">
                    <button class="history-btn history-btn-edit btn-small">Edit</button>
                    <button class="history-btn history-btn-delete btn-small">Delete</button>
                </div>
            `;
            const editBtn = li.querySelector('.history-btn-edit');
            const delBtn = li.querySelector('.history-btn-delete');
            if (isAll) {
                editBtn.addEventListener('click', () => startEdit(li, item.id, item.endOfDayTotal ?? item.count));
            } else {
                editBtn.addEventListener('click', () => startEditCategory(li, item, name));
            }
            delBtn.addEventListener('click', () => deleteHistoryItem(item.id));
            historyList.appendChild(li);
        });
    } catch (e) {
        console.error('Error rendering category:', e);
    }
}

async function manualSync() {
    try {
        const res = await fetch(`${API_URL}/sync`);
        cachedData = await res.json();
        const active = document.querySelector('.history-section .nav-btn.active');
        const section = active ? active.dataset.section : 'All';
        await renderCategory(section);
    } catch (error) {
        console.error('Error syncing:', error);
    }
}

function startEdit(li, id, currentCount) {
    const left = li.querySelector('.history-left');
    const actions = li.querySelector('.history-actions');
    left.innerHTML = `
        <input type="number" class="history-input" value="${Number.isFinite(currentCount) ? currentCount : 0}" min="0" />
        <div class="history-timestamp">${new Date().toLocaleString()}</div>
    `;
    actions.innerHTML = `
        <button class="history-btn history-btn-save btn-small">Save</button>
        <button class="history-btn history-btn-cancel btn-small">Cancel</button>
    `;
    const saveBtn = actions.querySelector('.history-btn-save');
    const cancelBtn = actions.querySelector('.history-btn-cancel');
    saveBtn.addEventListener('click', () => saveEdit(li, id));
    cancelBtn.addEventListener('click', async () => {
        const active = document.querySelector('.history-section .nav-btn.active');
        const section = active ? active.dataset.section : 'All';
        await renderCategory(section);
    });
    left.querySelector('.history-input').focus();
}

async function saveEdit(li, id) {
    const input = li.querySelector('.history-input');
    if (!input) return;
    const newVal = parseInt(input.value);
    if (Number.isNaN(newVal) || newVal < 0) return;
    const tsEl = li.querySelector('.history-timestamp');
    const timestamp = tsEl ? tsEl.textContent : undefined;
    
    try {
        await fetch(`${API_URL}/history/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: newVal, timestamp })
        });
        const active = document.querySelector('.history-section .nav-btn.active');
        const section = active ? active.dataset.section : 'All';
        await renderCategory(section);
    } catch (error) {
        console.error('Error updating entry:', error);
    }
}

function startEditCategory(li, item, name) {
    const left = li.querySelector('.history-left');
    const actions = li.querySelector('.history-actions');
    const catTexts = (item.categories && item.categories.texts) || {};
    const existing = name === 'Fara Deal Existent' ? (catTexts.faraDealExistent || '')
                   : name === 'Cu deal existent dar lost' ? (catTexts.cuDealExistentDarLost || '')
                   : name === 'Alta companie la care au aplicat' ? (catTexts.altaCompanieLaCareAuAplicat || '')
                   : '';
    left.innerHTML = `
        <input type="text" class="history-input" value="${existing}" />
        <div class="history-timestamp">${(function(){
            const d = new Date(item.timestamp);
            return Number.isNaN(d.getTime()) ? (item.timestamp || '') : d.toLocaleString();
        })()}</div>
    `;
    actions.innerHTML = `
        <button class="history-btn history-btn-save btn-small">Save</button>
        <button class="history-btn history-btn-cancel btn-small">Cancel</button>
    `;
    const saveBtn = actions.querySelector('.history-btn-save');
    const cancelBtn = actions.querySelector('.history-btn-cancel');
    saveBtn.addEventListener('click', () => saveEditCategory(li, item, name));
    cancelBtn.addEventListener('click', async () => {
        const active = document.querySelector('.history-section .nav-btn.active');
        const section = active ? active.dataset.section : 'All';
        await renderCategory(section);
    });
    left.querySelector('.history-input').focus();
}

async function saveEditCategory(li, item, name) {
    const input = li.querySelector('.history-input');
    if (!input) return;
    const newText = input.value || '';
    const ts = item.timestamp;
    try {
        await fetch(`${API_URL}/history/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryName: name, text: newText, timestamp: ts })
        });
        // Update cache
        cachedData = (cachedData || []).map(x => {
            if (x.id !== item.id) return x;
            const texts = { ...(x.categories?.texts || {}) };
            if (name === 'Fara Deal Existent') texts.faraDealExistent = newText;
            if (name === 'Cu deal existent dar lost') texts.cuDealExistentDarLost = newText;
            if (name === 'Alta companie la care au aplicat') texts.altaCompanieLaCareAuAplicat = newText;
            return {
                ...x,
                categories: {
                    ...(x.categories || {}),
                    texts
                }
            };
        });
        const active = document.querySelector('.history-section .nav-btn.active');
        const section = active ? active.dataset.section : 'All';
        await renderCategory(section);
    } catch (error) {
        console.error('Error updating category text:', error);
    }
}

async function deleteHistoryItem(id) {
    try {
        const item = (cachedData || []).find(x => String(x.id) === String(id));
        const timestamp = item ? item.timestamp : undefined;
        await fetch(`${API_URL}/history/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timestamp })
        });
        // remove from cache
        cachedData = (cachedData || []).filter(x => String(x.id) !== String(id));
        const active = document.querySelector('.history-section .nav-btn.active');
        const section = active ? active.dataset.section : 'All';
        await renderCategory(section);
    } catch (error) {
        console.error('Error deleting entry:', error);
    }
}

async function addToHistory(countValue) {
    try {
        const resp = await fetch(`${API_URL}/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                count: countValue,
                timestamp: new Date().toISOString()
            })
        });
        const data = await resp.json();
        // Manually update the client cache without refetching
        const newItem = {
            id: data.id || Date.now(),
            count: countValue,
            endOfDayTotal: countValue,
            timestamp: data.timestamp || new Date().toLocaleString(),
            categories: {
                faraDealExistent: false,
                cuDealExistentDarLost: false,
                altaCompanieLaCareAuAplicat: false,
                texts: {}
            }
        };
        // Add to front so newest appears first
        cachedData = [newItem, ...(cachedData || [])];
        // Re-render current active tab using cached data
        const active = document.querySelector('.history-section .nav-btn.active');
        const section = active ? active.dataset.section : 'All';
        await renderCategory(section);
    } catch (error) {
        console.error('Error adding entry:', error);
    }
}

counterButton.addEventListener('click', () => {
    count++;
    counterDisplay.textContent = count;
});

// Make current count editable (contenteditable with numeric guard)
counterDisplay.setAttribute('contenteditable', 'true');
counterDisplay.setAttribute('inputmode', 'numeric');
counterDisplay.addEventListener('keydown', (e) => {
    // Allow control keys and digits only to avoid caret reset from sanitizing
    const allowedKeys = [
        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'Tab'
    ];
    if (e.key === 'Enter') {
        e.preventDefault();
        counterDisplay.blur();
        return;
    }
    const isDigit = e.key.length === 1 && /[0-9]/.test(e.key);
    if (!isDigit && !allowedKeys.includes(e.key)) {
        e.preventDefault();
    }
});
counterDisplay.addEventListener('input', () => {
    // Do not rewrite text on each input to preserve caret
    const val = counterDisplay.textContent;
    const digitsOnly = (val || '').match(/[0-9]+/g)?.join('') || '';
    const newVal = parseInt(digitsOnly, 10);
    if (!Number.isNaN(newVal)) {
        count = newVal;
    } else {
        count = 0;
    }
});
counterDisplay.addEventListener('paste', (e) => {
    // Sanitize paste to digits and place caret at end
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const digits = (text || '').replace(/[^0-9]/g, '');
    const current = counterDisplay.textContent || '';
    const selection = window.getSelection();
    const range = selection && selection.getRangeAt && selection.rangeCount ? selection.getRangeAt(0) : null;
    let insertAtEnd = true;
    if (range && counterDisplay.contains(range.startContainer)) {
        insertAtEnd = false;
        range.deleteContents();
        range.insertNode(document.createTextNode(digits));
        // Move caret to end of inserted digits
        selection.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(counterDisplay);
        r.collapse(false);
        selection.addRange(r);
    }
    if (insertAtEnd) {
        counterDisplay.textContent = (current + digits).replace(/[^0-9]/g, '');
        const sel = window.getSelection();
        sel.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(counterDisplay);
        r.collapse(false);
        sel.addRange(r);
    }
    const num = parseInt(counterDisplay.textContent || '0', 10);
    count = Number.isNaN(num) ? 0 : num;
});
counterDisplay.addEventListener('blur', () => {
    if (counterDisplay.textContent === '') {
        count = 0;
        counterDisplay.textContent = '0';
    } else {
        const newVal = parseInt(counterDisplay.textContent, 10);
        count = Number.isNaN(newVal) ? 0 : newVal;
        counterDisplay.textContent = String(count);
    }
});

resetButton.addEventListener('click', () => {
    if (count > 0) addToHistory(count);
    count = 0;
    counterDisplay.textContent = count;
});

if (syncButton) {
    syncButton.addEventListener('click', manualSync);
}

if (addButton) {
    addButton.addEventListener('click', async () => {
        const active = document.querySelector('.history-section .nav-btn.active');
        const section = active ? active.dataset.section : 'All';
        // Only support adding for category tabs
        const supported = ['Fara Deal Existent', 'Cu deal existent dar lost', 'Alta companie la care au aplicat'];
        if (!supported.includes(section)) return;
        const text = prompt('Enter text for the new entry:');
        if (text == null) return; // canceled
        try {
            const resp = await fetch(`${API_URL}/category`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryName: section, text, timestamp: new Date().toISOString() })
            });
            const data = await resp.json();
            // Update cache
            const ts = data.timestamp || new Date().toLocaleString();
            const newItem = {
                id: data.id || Date.now(),
                count: 0,
                timestamp: ts,
                categories: {
                    faraDealExistent: section === 'Fara Deal Existent',
                    cuDealExistentDarLost: section === 'Cu deal existent dar lost',
                    altaCompanieLaCareAuAplicat: section === 'Alta companie la care au aplicat',
                    texts: {
                        faraDealExistent: section === 'Fara Deal Existent' ? text : undefined,
                        cuDealExistentDarLost: section === 'Cu deal existent dar lost' ? text : undefined,
                        altaCompanieLaCareAuAplicat: section === 'Alta companie la care au aplicat' ? text : undefined
                    }
                }
            };
            cachedData = [newItem, ...(cachedData || [])];
            await renderCategory(section);
        } catch (err) {
            console.error('Error adding category row:', err);
        }
    });
}

navButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const section = btn.dataset.section;
        await renderCategory(section);
    });
});

// Initialize
counterDisplay.textContent = count;
renderCategory('All');
