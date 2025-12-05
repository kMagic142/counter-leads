const express = require('express');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Google Sheets
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = 'Counter Leads';

// Load data from JSON file
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
    return [];
}

// Save data to JSON file
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        return false;
    }
}

// Get all history
app.get('/api/history', (req, res) => {
    const data = loadData();
    res.json(data);
});

// Add new entry
app.post('/api/history', (req, res) => {
    const { count, timestamp } = req.body;
    const data = loadData();
    const newEntry = {
        id: Date.now(),
        count,
        timestamp: timestamp || new Date().toISOString()
    };
    data.unshift(newEntry);
    
    if (saveData(data)) {
        // Try to sync with Google Sheets
        syncToGoogleSheets(data);
        res.json(newEntry);
    } else {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// Update entry
app.put('/api/history/:id', (req, res) => {
    const { id } = req.params;
    const { count } = req.body;
    const data = loadData();
    const index = data.findIndex(item => item.id === parseInt(id));
    
    if (index !== -1) {
        data[index].count = count;
        if (saveData(data)) {
            syncToGoogleSheets(data);
            res.json(data[index]);
        } else {
            res.status(500).json({ error: 'Failed to update data' });
        }
    } else {
        res.status(404).json({ error: 'Entry not found' });
    }
});

// Delete entry
app.delete('/api/history/:id', (req, res) => {
    const { id } = req.params;
    const data = loadData().filter(item => item.id !== parseInt(id));
    
    if (saveData(data)) {
        syncToGoogleSheets(data);
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

// Sync to Google Sheets
async function syncToGoogleSheets(data) {
    if (!SPREADSHEET_ID) {
        console.log('Google Sheets not configured');
        return;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, 'credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Clear existing data
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1:Z1000`
        });

        // Prepare data for sheets
        const values = [
            ['Count', 'Timestamp'],
            ...data.map(item => [item.count, new Date(item.timestamp).toLocaleString()])
        ];

        // Append new data
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1`,
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