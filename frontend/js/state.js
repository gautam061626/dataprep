/**
 * DataPrep Studio - Client State Manager
 * Synchronizes backend state response with UI panes.
 */

export const AppState = {
    loaded: false,
    filename: "",
    rows: 0,
    columns: [],
    columnTypes: {},
    missingCells: 0,
    missingPct: 0,
    duplicates: 0,
    qualityScore: 100,
    memoryUsageKb: 0.0,
    operationsLog: [],
    
    // Grid Page controls
    gridPage: 1,
    gridPageSize: 10,
    gridSearch: "",
    gridSortCol: "",
    gridSortAsc: true,

    // Navigation Stack
    navigationHistory: ['landing'],
    navigationIndex: 0,

    settings: {
        theme: 'xp',
        warnDelete: true,
        warnReset: true,
        autosave: '25'
    }
};

// Register listener hooks for state changes
const changeListeners = [];
export function addStateChangeListener(callback) {
    changeListeners.push(callback);
}

export function notifyStateChanged() {
    changeListeners.forEach(listener => listener(AppState));
}

export function syncState(backendResponse) {
    if (!backendResponse || !backendResponse.summary) {
        AppState.loaded = false;
        AppState.filename = "";
        AppState.rows = 0;
        AppState.columns = [];
        AppState.columnTypes = {};
        AppState.missingCells = 0;
        AppState.duplicates = 0;
        AppState.qualityScore = 100;
        AppState.memoryUsageKb = 0;
        AppState.operationsLog = [];
        updateStatusBar();
        notifyStateChanged();
        return;
    }

    const summary = backendResponse.summary;
    AppState.loaded = true;
    AppState.filename = summary.filename;
    AppState.rows = summary.rows;
    AppState.columns = dataColumns(backendResponse); // Fallback to summary columns if profile missing
    AppState.missingCells = summary.missing_cells;
    AppState.missingPct = summary.missing_pct;
    AppState.duplicates = summary.duplicates;
    AppState.qualityScore = summary.quality_score;
    AppState.memoryUsageKb = summary.memory_usage_kb;
    AppState.operationsLog = summary.activity_log || [];

    if (backendResponse.profile) {
        AppState.columnTypes = {};
        backendResponse.profile.forEach(col => {
            AppState.columnTypes[col.name] = col.type;
        });
    }

    updateStatusBar();
    notifyStateChanged();
}

function dataColumns(backendResponse) {
    if (backendResponse.profile) {
        return backendResponse.profile.map(c => c.name);
    }
    return backendResponse.summary.columns_list || [];
}

export function updateStatusBar() {
    const activeFileEl = document.getElementById('titlebar-active-file');
    const statusDatasetEl = document.getElementById('status-dataset-name');
    const statusDimEl = document.getElementById('status-dim');
    const statusMemoryEl = document.getElementById('status-memory');
    const datasetPill = document.getElementById('dataset-pill-info');

    if (AppState.loaded) {
        if (activeFileEl) activeFileEl.innerText = `- [${AppState.filename}]`;
        if (statusDatasetEl) statusDatasetEl.innerText = `Dataset: ${AppState.filename}`;
        if (statusDimEl) statusDimEl.innerText = `Grid Size: ${AppState.rows} Rows × ${AppState.columns.length} Cols`;
        if (statusMemoryEl) statusMemoryEl.innerText = `RAM Usage: ${AppState.memoryUsageKb} KB`;
        if (datasetPill) {
            datasetPill.innerText = `Active: ${AppState.columns.length} Cols`;
            datasetPill.style.backgroundColor = '#107C41';
        }
    } else {
        if (activeFileEl) activeFileEl.innerText = '';
        if (statusDatasetEl) statusDatasetEl.innerText = 'Dataset: [None Loaded]';
        if (statusDimEl) statusDimEl.innerText = 'Size: 0 Rows × 0 Cols';
        if (statusMemoryEl) statusMemoryEl.innerText = 'Usage: 0 KB';
        if (datasetPill) {
            datasetPill.innerText = 'No Active Dataset';
            datasetPill.style.backgroundColor = '#A80000';
        }
    }
}
