/**
 * DataPrep Studio - Data Cleaning Page Controller
 */

import { AppState, syncState } from '../frontend/js/state.js';
import * as API from '../frontend/js/api.js';
import { renderDataGrid, populateSortDropdown } from '../components/grid.js';

export function refreshCleaningPage() {
    populateCleaningDropdowns();
    renderDataGrid();
    populateSortDropdown();

    // Bind undo / redo button states
    const undoBtn = document.getElementById('cleanup-btn-undo');
    const redoBtn = document.getElementById('cleanup-btn-redo');
    if (undoBtn) undoBtn.disabled = (AppState.operationsLog.length === 0); // basic indicator
    if (redoBtn) redoBtn.disabled = true; // resets on action

    // Render operations list inside History panel
    const list = document.getElementById('cleaning-operations-list');
    if (list) {
        list.innerHTML = '';
        if (AppState.operationsLog.length === 0) {
            list.innerHTML = '<li class="timeline-empty">Raw dataset loaded. No transformations executed.</li>';
        } else {
            AppState.operationsLog.forEach(log => {
                const li = document.createElement('li');
                li.style.borderBottom = '1px dotted #A0A0A0';
                li.style.padding = '3px 0';
                li.innerHTML = `<strong>${log.title}</strong><br/><span style="font-size:9.2px;color:#555;">${log.desc}</span>`;
                list.appendChild(li);
            });
        }
    }
}

export function populateCleaningDropdowns() {
    const selectors = [
        'clean-missing-col', 'clean-drop-col', 'clean-rename-target',
        'clean-replace-col', 'clean-string-col', 'clean-outlier-col'
    ];

    selectors.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const lastVal = el.value;
        el.innerHTML = '';

        AppState.columns.forEach(col => {
            // Filter Numeric only for outliers removal
            if (id === 'clean-outlier-col') {
                if (AppState.columnTypes[col] === 'Numeric') {
                    el.innerHTML += `<option value="${col}">${col}</option>`;
                }
            } else {
                el.innerHTML += `<option value="${col}">${col}</option>`;
            }
        });

        if (lastVal && AppState.columns.includes(lastVal)) {
            el.value = lastVal;
        }
    });
}

export function initCleaningOperations() {
    // Strategy change logic to toggle custom value input visibility
    const strategySelect = document.getElementById('clean-missing-strategy');
    if (strategySelect) {
        strategySelect.onchange = () => {
            const input = document.getElementById('clean-missing-custom-val');
            if (input) {
                if (strategySelect.value === 'custom') {
                    input.classList.remove('hidden');
                    input.style.display = 'block';
                } else {
                    input.classList.add('hidden');
                    input.style.display = 'none';
                }
            }
        };
    }

    // Bind action buttons
    
    // 1. Purge Duplicates
    window.runRemoveDuplicates = async () => {
        try {
            const res = await API.applyClean("remove_duplicates");
            syncState(res);
            refreshCleaningPage();
            showNotification("Clean Action Success", "Duplicates purged from dataset.");
        } catch (e) {
            alert(e.message);
        }
    };

    // 2. Handle Missing values
    window.runHandleMissingValues = async () => {
        const col = document.getElementById('clean-missing-col').value;
        const strategy = document.getElementById('clean-missing-strategy').value;
        const customVal = document.getElementById('clean-missing-custom-val').value;

        if (!col) return;

        try {
            const res = await API.applyClean("fill_missing", {
                column: col,
                strategy: strategy,
                custom_val: customVal
            });
            syncState(res);
            refreshCleaningPage();
            showNotification("Clean Action Success", "Missing values imputed successfully.");
        } catch (e) {
            alert(e.message);
        }
    };

    // 3. Drop Column
    window.runDropColumn = () => {
        const col = document.getElementById('clean-drop-col').value;
        if (!col) return;

        showConfirmModal(`Warning: Are you sure you want to permanently delete column "${col}"?`, async () => {
            try {
                const res = await API.applyClean("drop_column", { column: col });
                syncState(res);
                refreshCleaningPage();
                showNotification("Clean Action Success", `Column "${col}" dropped.`);
            } catch (e) {
                alert(e.message);
            }
        });
    };

    // 4. Rename Column
    window.runRenameColumn = async () => {
        const col = document.getElementById('clean-rename-target').value;
        const newName = document.getElementById('clean-rename-new').value.trim();

        if (!col || !newName) return;

        try {
            const res = await API.applyClean("rename_column", {
                column: col,
                rename_to: newName
            });
            syncState(res);
            document.getElementById('clean-rename-new').value = '';
            refreshCleaningPage();
            showNotification("Clean Action Success", `Column renamed to "${newName}"`);
        } catch (e) {
            alert(e.message);
        }
    };

    // 5. Replace text value
    window.runReplaceValue = async () => {
        const col = document.getElementById('clean-replace-col').value;
        const findVal = document.getElementById('clean-replace-find').value;
        const subVal = document.getElementById('clean-replace-sub').value;

        if (!col) return;

        try {
            const res = await API.applyClean("replace_values", {
                column: col,
                find_val: findVal,
                sub_val: subVal
            });
            syncState(res);
            document.getElementById('clean-replace-find').value = '';
            document.getElementById('clean-replace-sub').value = '';
            refreshCleaningPage();
            showNotification("Clean Action Success", `Substituted occurrences of "${findVal}"`);
        } catch (e) {
            alert(e.message);
        }
    };

    // 6. Casing standardizer
    window.runStringStandardize = async () => {
        const col = document.getElementById('clean-string-col').value;
        const op = document.getElementById('clean-string-op').value; // trim, upper, lower

        if (!col) return;

        try {
            const res = await API.applyClean("standardize_strings", {
                column: col,
                casing_op: op
            });
            syncState(res);
            refreshCleaningPage();
            showNotification("Clean Action Success", `Casing standardizations applied.`);
        } catch (e) {
            alert(e.message);
        }
    };

    // 7. Outliers Purge
    window.runRemoveOutliers = async () => {
        const col = document.getElementById('clean-outlier-col').value;
        if (!col) return;

        try {
            const res = await API.applyClean("remove_outliers", {
                column: col,
                outlier_thresh: 1.5 // Multiplier threshold
            });
            syncState(res);
            refreshCleaningPage();
            showNotification("Clean Action Success", `Outliers removed from column "${col}".`);
        } catch (e) {
            alert(e.message);
        }
    };

    // History controls undo / redo / reset
    window.undoAction = async () => {
        try {
            const res = await API.undoClean();
            if (res.status === "error") {
                showNotification("Stack Info", res.message);
                return;
            }
            syncState(res);
            refreshCleaningPage();
            showNotification("Undo Action", "Last transformation reverted.");
        } catch (e) {
            alert(e.message);
        }
    };

    window.redoAction = async () => {
        try {
            const res = await API.redoClean();
            if (res.status === "error") {
                showNotification("Stack Info", res.message);
                return;
            }
            syncState(res);
            refreshCleaningPage();
            showNotification("Redo Action", "Restored previously reverted action.");
        } catch (e) {
            alert(e.message);
        }
    };

    window.confirmReset = () => {
        showConfirmModal("Are you sure you want to discard all operations and restore the raw dataset?", async () => {
            try {
                const res = await API.resetClean();
                syncState(res);
                refreshCleaningPage();
                showNotification("Reset Complete", "Dataset restored back to raw state.");
            } catch (e) {
                alert(e.message);
            }
        });
    };
}

// Modal dialog confirm utility helper
function showConfirmModal(message, onYes) {
    const modal = document.getElementById('modal-confirm');
    const msgText = document.getElementById('confirm-modal-message');
    const yesBtn = document.getElementById('confirm-modal-yes-btn');

    if (!modal) return;

    msgText.innerText = message;
    yesBtn.onclick = () => {
        modal.close();
        onYes();
    };

    modal.showModal();
}

window.closeConfirmModal = () => {
    const modal = document.getElementById('modal-confirm');
    if (modal) modal.close();
};

function showNotification(title, message) {
    if (window.showNotification) {
        window.showNotification(title, message);
    }
}
