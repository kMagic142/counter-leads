const express = require('express');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;
// No local data file; operate directly on Google Sheets

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Google Sheets
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Counter Leads';

function getSheetsClient() {
    if (!SPREADSHEET_ID) {
        console.log('Google Sheets not configured');
        return null;
    }
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, 'credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return google.sheets({ version: 'v4', auth });
}

async function resolveSheetTitle(sheets) {
    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const allSheets = spreadsheet.data.sheets || [];
        if (!allSheets.length) return null;
        const byTitle = allSheets.find(s => s.properties && s.properties.title === SHEET_NAME);
        return (byTitle || allSheets[0]).properties.title;
    } catch (e) {
        console.error('Error resolving sheet title:', e);
        return null;
    }
}

async function fetchFromGoogleSheets() {
    const sheets = getSheetsClient();
    if (!sheets) return [];
    try {
        const title = await resolveSheetTitle(sheets);
        const range = title ? `${title}!A1:Z10000` : `A1:Z10000`;
        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range
        });
        const values = resp.data.values || [];
        if (values.length <= 1) return []; // header only or empty
        const [header, ...rows] = values;
        const norm = v => (typeof v === 'string' ? v.trim().toLowerCase() : '');
        const findCol = (needle) => {
            if (!header) return -1;
            const n = needle.toLowerCase();
            const idx = header.findIndex(h => typeof h === 'string' && norm(h).includes(n));
            return idx;
        };
        const totalColIndex = (() => {
            const idx = findCol('numar total leads');
            return idx >= 0 ? idx : -1;
        })();
        const colAltaCompanie = findCol('alta companie la care au aplicat');
        const colFaraDeal = findCol('fara deal existent');
        const colCuDealLost = findCol('cu deal existent dar lost');
        const colTimestamp = findCol('timestamp');
        return rows
            .filter(r => r && (r[0] !== undefined || r[1] !== undefined))
            .map((r, idx) => {
                const count = parseInt(r[0]);
                const tsStr = colTimestamp >= 0 ? r[colTimestamp] : r[1];
                const endOfDayTotalRaw = totalColIndex >= 0 ? r[totalColIndex] : undefined;
                const endOfDayTotal = endOfDayTotalRaw !== undefined && endOfDayTotalRaw !== '' ? parseInt(endOfDayTotalRaw) : undefined;
                const faraDealCell = colFaraDeal >= 0 ? r[colFaraDeal] : undefined;
                const cuDealLostCell = colCuDealLost >= 0 ? r[colCuDealLost] : undefined;
                const altaCompanieCell = colAltaCompanie >= 0 ? r[colAltaCompanie] : undefined;
                const hasFaraDeal = typeof faraDealCell !== 'undefined' && String(faraDealCell).trim() !== '';
                const hasCuDealLost = typeof cuDealLostCell !== 'undefined' && String(cuDealLostCell).trim() !== '';
                const hasAltaCompanie = typeof altaCompanieCell !== 'undefined' && String(altaCompanieCell).trim() !== '';
                let iso = null;
                if (tsStr) {
                    const d = new Date(tsStr);
                    if (!Number.isNaN(d.getTime())) {
                        iso = d.toISOString();
                    }
                }
                const idBase = iso ? Date.parse(iso) : Date.now();
                console.log("Fetched data from Google Sheets.")
                return {
                    id: idBase + idx,
                    count: Number.isNaN(count) ? 0 : count,
                    // Preserve the sheet's timestamp string; fall back to ISO or now if missing
                    timestamp: tsStr || iso || new Date().toISOString(),
                    endOfDayTotal: Number.isNaN(endOfDayTotal) ? undefined : endOfDayTotal,
                    categories: {
                        faraDealExistent: !!hasFaraDeal,
                        cuDealExistentDarLost: !!hasCuDealLost,
                        altaCompanieLaCareAuAplicat: !!hasAltaCompanie,
                        texts: {
                            faraDealExistent: hasFaraDeal ? String(faraDealCell).trim() : undefined,
                            cuDealExistentDarLost: hasCuDealLost ? String(cuDealLostCell).trim() : undefined,
                            altaCompanieLaCareAuAplicat: hasAltaCompanie ? String(altaCompanieCell).trim() : undefined
                        }
                    }
                };
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error('Error fetching from Google Sheets:', error);
        return [];
    }
}

app.get('/api/summary', async (req, res) => {
    const sheets = getSheetsClient();
    if (!sheets) return res.json({});
    try {
        const title = await resolveSheetTitle(sheets);
        const range = title ? `${title}!A1:Z10000` : `A1:Z10000`;
        const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
        const values = resp.data.values || [];
        const [header, ...rows] = values;
        const totalColIndex = (() => {
            if (!header) return 2;
            const idx = header.findIndex(h => typeof h === 'string' && h.trim().toLowerCase().includes('numar total leads'));
            return idx >= 0 ? idx : 2;
        })();
        let totalLeadsEOD = undefined;
        for (let i = rows.length - 1; i >= 0; i--) {
            const v = rows[i][totalColIndex];
            if (v !== undefined && v !== '') {
                const n = parseInt(v);
                if (!Number.isNaN(n)) { totalLeadsEOD = n; break; }
            }
        }
        const faraDealExistent = rows.filter(r => r.some(c => typeof c === 'string' && c.trim() === 'Fara Deal Existent')).length;
        const cuDealExistentDarLost = rows.filter(r => r.some(c => typeof c === 'string' && c.trim() === 'Cu deal existent dar lost')).length;
        const altaCompanieLaCareAuAplicat = rows.filter(r => r.some(c => typeof c === 'string' && c.trim() === 'Alta companie la care au aplicat')).length;
        res.json({ faraDealExistent, cuDealExistentDarLost, altaCompanieLaCareAuAplicat, totalLeadsEOD });
    } catch (e) {
        console.error('Error building summary:', e);
        res.status(500).json({ error: 'Failed to build summary' });
    }
});

app.get('/api/historyByCategory', async (req, res) => {
    const { name } = req.query;
    const data = await fetchFromGoogleSheets();
    if (!name) return res.json(data);
    const filtered = data.filter(item => {
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
    res.json(filtered);
});

function formatSheetTimestamp(dInput) {
    const d = dInput instanceof Date ? dInput : new Date(dInput);
    const month = d.getMonth() + 1; // 1-12, no leading zero
    const day = d.getDate(); // 1-31, no leading zero
    const year = d.getFullYear();
    const pad2 = (n) => String(n).padStart(2, '0');
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${month}/${day}/${year} ${hh}:${mm}:${ss}`;
}

async function appendRowToGoogleSheets(count, timestamp) {
    const sheets = getSheetsClient();
    if (!sheets) return false;
    try {
        const title = await resolveSheetTitle(sheets);
        const headerRange = title ? `${title}!A1:Z1` : `A1:Z1`;
        const headerResp = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: headerRange
        });
        const header = (headerResp.data.values && headerResp.data.values[0]) || [];
        const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
        const findCol = (needle) => header.findIndex(h => typeof h === 'string' && norm(h).includes(needle.toLowerCase()));
        const tsCol = findCol('timestamp');
        const totalCol = findCol('numar total leads');
        const width = Math.max(5, header.length, Math.max(tsCol + 1, totalCol + 1));
        const row = Array.from({ length: width }, () => '');
        const tsString = formatSheetTimestamp(timestamp || new Date());
        if (tsCol >= 0) row[tsCol] = tsString;
        if (totalCol >= 0) row[totalCol] = Number.isFinite(count) ? count : 0;
        const appendRange = title ? `${title}!A1:E1` : `A1:E1`;
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: appendRange,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [row] }
        });
        return true;
    } catch (error) {
        console.error('Error appending row to Google Sheets:', error);
        return false;
    }
}

async function appendCategoryRowToGoogleSheets(categoryName, text, timestamp) {
    const sheets = getSheetsClient();
    if (!sheets) return false;
    try {
        const title = await resolveSheetTitle(sheets);
        const headerRange = title ? `${title}!A1:Z1` : `A1:Z1`;
        const headerResp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: headerRange });
        const header = (headerResp.data.values && headerResp.data.values[0]) || [];
        const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
        const findCol = (needle) => header.findIndex(h => typeof h === 'string' && norm(h).includes(needle.toLowerCase()));
        const tsCol = findCol('timestamp');
        const colMap = {
            'Fara Deal Existent': findCol('fara deal existent'),
            'Cu deal existent dar lost': findCol('cu deal existent dar lost'),
            'Alta companie la care au aplicat': findCol('alta companie la care au aplicat')
        };
        const targetCol = colMap[categoryName];
        if (typeof targetCol !== 'number' || targetCol < 0) return false;
        const width = Math.max(5, header.length, Math.max(tsCol + 1, targetCol + 1));
        const row = Array.from({ length: width }, () => '');
        const tsString = formatSheetTimestamp(timestamp || new Date());
        if (tsCol >= 0) row[tsCol] = tsString;
        row[targetCol] = text || '';
        const appendRange = title ? `${title}!A1:E1` : `A1:E1`;
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: appendRange,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [row] }
        });
        return true;
    } catch (error) {
        console.error('Error appending category row to Google Sheets:', error);
        return false;
    }
}

async function updateRowInGoogleSheets(timestamp, newCount) {
    const sheets = getSheetsClient();
    if (!sheets) return false;
    try {
        // Load all values to find the matching timestamp
        const title = await resolveSheetTitle(sheets);
        const rangeRead = title ? `${title}!A1:B10000` : `A1:B10000`;
        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: rangeRead
        });
        const values = resp.data.values || [];
        if (values.length <= 1) return false;
        let targetRowIndex = -1; // 0-based in array, but 1-based in sheet
        const targetIso = (() => {
            const d = new Date(timestamp);
            return Number.isNaN(d.getTime()) ? null : d.toISOString();
        })();
        for (let i = 1; i < values.length; i++) {
            const tsStr = values[i][1];
            if (!tsStr) continue;
            const d = new Date(tsStr);
            const iso = Number.isNaN(d.getTime()) ? null : d.toISOString();
            if ((iso && targetIso && iso === targetIso) || (!iso && !targetIso && tsStr === timestamp)) {
                targetRowIndex = i;
                break;
            }
        }
        if (targetRowIndex === -1) return false;
        const sheetRowNumber = targetRowIndex + 1; // convert to 1-based
        const range = title ? `${title}!A${sheetRowNumber}:B${sheetRowNumber}` : `A${sheetRowNumber}:B${sheetRowNumber}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[newCount, values[targetRowIndex][1]]] }
        });
        return true;
    } catch (error) {
        console.error('Error updating row in Google Sheets:', error);
        return false;
    }
}

async function deleteRowInGoogleSheets(timestamp) {
    const sheets = getSheetsClient();
    if (!sheets) return false;
    try {
        // Need sheetId for batchUpdate deleteDimension
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const allSheets = spreadsheet.data.sheets || [];
        const sheet = allSheets.find(s => s.properties.title === SHEET_NAME) || allSheets[0];
        if (!sheet) return false;
        const sheetId = sheet.properties.sheetId;

        const title = sheet.properties.title;
        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${title}!A1:B10000`
        });
        const values = resp.data.values || [];
        if (values.length <= 1) return false;
        let targetRowIndex = -1;
        const targetIso = (() => {
            const d = new Date(timestamp);
            return Number.isNaN(d.getTime()) ? null : d.toISOString();
        })();
        for (let i = 1; i < values.length; i++) {
            const tsStr = values[i][1];
            if (!tsStr) continue;
            const d = new Date(tsStr);
            const iso = Number.isNaN(d.getTime()) ? null : d.toISOString();
            if ((iso && targetIso && iso === targetIso) || (!iso && !targetIso && tsStr === timestamp)) {
                targetRowIndex = i;
                break;
            }
        }
        if (targetRowIndex === -1) return false;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId,
                                dimension: 'ROWS',
                                startIndex: targetRowIndex, // zero-based, header at 0
                                endIndex: targetRowIndex + 1
                            }
                        }
                    }
                ]
            }
        });
        return true;
    } catch (error) {
        console.error('Error deleting row in Google Sheets:', error);
        return false;
    }
}

async function updateCategoryTextInGoogleSheets(timestamp, categoryName, newText) {
    const sheets = getSheetsClient();
    if (!sheets) return false;
    try {
        const title = await resolveSheetTitle(sheets);
        const rangeRead = title ? `${title}!A1:Z10000` : `A1:Z10000`;
        const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: rangeRead });
        const values = resp.data.values || [];
        if (values.length <= 1) return false;
        const header = values[0] || [];
        const norm = v => (typeof v === 'string' ? v.trim().toLowerCase() : '');
        const findCol = (needle) => header.findIndex(h => typeof h === 'string' && norm(h).includes(needle.toLowerCase()));
        const tsCol = findCol('timestamp');
        const colMap = {
            'Fara Deal Existent': findCol('fara deal existent'),
            'Cu deal existent dar lost': findCol('cu deal existent dar lost'),
            'Alta companie la care au aplicat': findCol('alta companie la care au aplicat')
        };
        const targetCol = colMap[categoryName];
        if (typeof targetCol !== 'number' || targetCol < 0) return false;
        let targetRowIndex = -1;
        const targetIso = (() => { const d = new Date(timestamp); return Number.isNaN(d.getTime()) ? null : d.toISOString(); })();
        for (let i = 1; i < values.length; i++) {
            const tsStr = tsCol >= 0 ? values[i][tsCol] : values[i][1];
            if (!tsStr) continue;
            const d = new Date(tsStr);
            const iso = Number.isNaN(d.getTime()) ? null : d.toISOString();
            if ((iso && targetIso && iso === targetIso) || (!iso && !targetIso && tsStr === timestamp)) {
                targetRowIndex = i;
                break;
            }
        }
        if (targetRowIndex === -1) return false;
        const sheetRowNumber = targetRowIndex + 1;
        const range = title ? `${title}!A${sheetRowNumber}:Z${sheetRowNumber}` : `A${sheetRowNumber}:Z${sheetRowNumber}`;
        // Prepare updated row: reuse existing row values and replace targetCol
        const row = values[targetRowIndex] || [];
        while (row.length < header.length) row.push('');
        row[targetCol] = newText || '';
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [row] }
        });
        return true;
    } catch (error) {
        console.error('Error updating category text in Google Sheets:', error);
        return false;
    }
}

// Local persistence removed; data is fetched from Google Sheets.

// Get all history
app.get('/api/history', async (req, res) => {
    const rows = await fetchFromGoogleSheets();
    res.json(rows);
});

// Sync from Google Sheets to local data.json
app.get('/api/sync', async (req, res) => {
    const rows = await fetchFromGoogleSheets();
    res.json(rows);
});

// Add new entry
app.post('/api/history', async (req, res) => {
    const { count, timestamp } = req.body;
    const ts = timestamp || new Date();
    try {
        await appendRowToGoogleSheets(count, ts);
        res.json({ id: Date.now(), count, timestamp: formatSheetTimestamp(ts) });
    } catch (e) {
        res.status(500).json({ error: 'Failed to append to Google Sheets' });
    }
});

// Update entry
app.put('/api/history/:id', async (req, res) => {
    const { count, timestamp, categoryName, text } = req.body;
    if (typeof timestamp === 'undefined') {
        return res.status(400).json({ error: 'timestamp required to update Google Sheets row' });
    }
    let ok = false;
    if (typeof categoryName === 'string') {
        ok = await updateCategoryTextInGoogleSheets(timestamp, categoryName, text || '');
        if (ok) {
            return res.json({ categoryName, text, timestamp });
        }
    } else {
        ok = await updateRowInGoogleSheets(timestamp, count);
        if (ok) {
            return res.json({ count, timestamp });
        }
    }
    res.status(404).json({ error: 'Sheet row not found or update failed' });
});

// Delete entry
app.delete('/api/history/:id', async (req, res) => {
    const { timestamp } = req.body || {};
    if (typeof timestamp === 'undefined') {
        return res.status(400).json({ error: 'timestamp required to delete Google Sheets row' });
    }
    const ok = await deleteRowInGoogleSheets(timestamp);
    if (ok) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Sheet row not found or delete failed' });
    }
});

// Sync to Google Sheets
async function syncToGoogleSheets(data) {
    if (!SPREADSHEET_ID) {
        console.log('Google Sheets not configured');
        return;
    }

    try {
        const sheets = getSheetsClient();
        if (!sheets) return;
        const title = await resolveSheetTitle(sheets);

        // Clear existing data
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${title}!A1:Z1000`
        });

        // Prepare data for sheets
        const values = [
            ['Count', 'Timestamp'],
            ...data.map(item => [item.count, new Date(item.timestamp).toLocaleString()])
        ];

        // Append new data
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${title}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values }
        });

        console.log('Data synced to Google Sheets');
    } catch (error) {
        console.error('Error syncing to Google Sheets:', error);
    }
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Add a new category text row
app.post('/api/category', async (req, res) => {
    const { categoryName, text, timestamp } = req.body;
    if (!categoryName) return res.status(400).json({ error: 'categoryName required' });
    const ts = timestamp || new Date();
    try {
        const ok = await appendCategoryRowToGoogleSheets(categoryName, text || '', ts);
        if (!ok) return res.status(500).json({ error: 'Failed to append category row' });
        res.json({ id: Date.now(), categoryName, text, timestamp: formatSheetTimestamp(ts) });
    } catch (e) {
        res.status(500).json({ error: 'Failed to append category row' });
    }
});