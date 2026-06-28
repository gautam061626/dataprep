/**
 * DataPrep Studio - Export Page Controller
 */

import { AppState } from '../frontend/js/state.js';
import * as API from '../frontend/js/api.js';

export function refreshExportPage() {
    if (!AppState.loaded) {
        const preview = document.getElementById('export-raw-preview');
        if (preview) preview.innerText = "Please load a dataset to view export preview.";
        return;
    }

    const format = document.getElementById('export-format').value;
    handleExportFormatChange(format);
}

export function handleExportFormatChange(format) {
    const csvOptions = document.getElementById('export-csv-options');
    const sqlOptions = document.getElementById('export-sql-options');

    if (csvOptions) csvOptions.style.display = (format === 'csv') ? 'block' : 'none';
    if (sqlOptions) sqlOptions.style.display = (format === 'sql') ? 'block' : 'none';

    renderExportPreview();
}

async function renderExportPreview() {
    const previewWell = document.getElementById('export-raw-preview');
    if (!previewWell || !AppState.loaded) return;

    previewWell.innerText = "Generating preview...";

    try {
        const format = document.getElementById('export-format').value;
        
        // Fetch first 10 rows for a quick preview from grid API
        const gridData = await API.getGrid(1, 10, "", "", true);
        const rows = gridData.rows;
        
        // Remove system _rowId from preview
        const cleanRows = rows.map(r => {
            const copy = { ...r };
            delete copy._rowId;
            return copy;
        });

        let previewText = "";

        if (format === 'csv') {
            const delimEl = document.getElementById('export-delimiter');
            const delimiter = delimEl ? delimEl.value : ",";
            const includeHeaders = document.getElementById('export-include-headers').checked;

            if (includeHeaders) {
                previewText += AppState.columns.join(delimiter) + "\n";
            }
            cleanRows.forEach(row => {
                const vals = AppState.columns.map(col => row[col] !== undefined ? row[col] : "");
                previewText += vals.join(delimiter) + "\n";
            });
        } else if (format === 'json') {
            previewText = JSON.stringify(cleanRows, null, 2);
        } else if (format === 'excel') {
            previewText = "[Binary Excel xlsx Spreadsheet File Layout Preview Unavailable]\n";
            previewText += `Columns: ${AppState.columns.join(', ')}\n`;
            previewText += `Rows count: ${AppState.rows} records total ready for download.`;
        } else if (format === 'sql') {
            const tableEl = document.getElementById('export-sql-tablename');
            const tableName = tableEl ? tableEl.value.trim() : "prepared_dataset";
            const cols = AppState.columns.map(c => `\`${c}\``).join(", ");
            
            cleanRows.forEach(row => {
                const vals = AppState.columns.map(c => {
                    const v = row[c];
                    if (v === "" || v === null) return "NULL";
                    if (!isNaN(v) && v !== "") return v;
                    return `'${v.toString().replace(/'/g, "''")}'`;
                });
                previewText += `INSERT INTO ${tableName} (${cols}) VALUES (${vals.join(", ")});\n`;
            });
        }

        previewWell.innerText = previewText;

    } catch (err) {
        previewWell.innerText = `Preview failed: ${err.message}`;
    }
}

export function initExportControls() {
    const formatSelect = document.getElementById('export-format');
    if (formatSelect) {
        formatSelect.onchange = () => handleExportFormatChange(formatSelect.value);
    }

    const delimSelect = document.getElementById('export-delimiter');
    if (delimSelect) {
        delimSelect.onchange = () => renderExportPreview();
    }

    const headersCheckbox = document.getElementById('export-include-headers');
    if (headersCheckbox) {
        headersCheckbox.onchange = () => renderExportPreview();
    }

    const sqlTableName = document.getElementById('export-sql-tablename');
    if (sqlTableName) {
        sqlTableName.oninput = () => renderExportPreview();
    }

    // Action download dataset
    window.executeExportDownload = () => {
        if (!AppState.loaded) return;

        const format = document.getElementById('export-format').value;
        const filename = document.getElementById('export-filename-input').value.trim() || "clean_export";
        const delimiter = document.getElementById('export-delimiter').value;
        const includeHeaders = document.getElementById('export-include-headers').checked ? "true" : "false";
        const sqlTableNameVal = document.getElementById('export-sql-tablename').value.trim() || "prepared_dataset";

        // Create standard HTML Form to submit download request
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/export';
        form.target = '_blank';

        const addField = (name, val) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = val;
            form.appendChild(input);
        };

        addField('format', format);
        addField('filename', filename);
        addField('delimiter', delimiter);
        addField('include_headers', includeHeaders);
        addField('sql_tablename', sqlTableNameVal);

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        
        showNotification("Success", "Export file download initiated.");
    };

    // Save Cleaning history text file download
    window.downloadCleaningHistoryLog = () => {
        if (!AppState.loaded) return;

        let logText = "====================================================\n";
        logText += "DATAPREP STUDIO OPERATIONS LOG LEDGER\n";
        logText += `Generated: ${new Date().toLocaleString()}\n`;
        logText += "====================================================\n\n";

        if (AppState.operationsLog.length === 0) {
            logText += "No actions performed. Dataset remains in raw state.\n";
        } else {
            AppState.operationsLog.forEach(log => {
                logText += `Step #${log.id} - [${log.timestamp}]\n`;
                logText += `Operation: ${log.title}\n`;
                logText += `Details: ${log.desc}\n`;
                logText += "----------------------------------------------------\n";
            });
        }

        const blob = new Blob([logText], { type: "text/plain" });
        const link = document.createElement('a');
        link.download = `dataprep_operations_history_${AppState.filename.replace('.csv', '')}.txt`;
        link.href = URL.createObjectURL(blob);
        link.click();
    };
}

function showNotification(title, message) {
    if (window.showNotification) {
        window.showNotification(title, message);
    }
}
