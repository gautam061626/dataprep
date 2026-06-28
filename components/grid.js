/**
 * DataPrep Studio - Spreadsheet Grid Component
 * Renders the editable table and pagination.
 */

import { AppState, syncState } from '../frontend/js/state.js';
import * as API from '../frontend/js/api.js';

export async function renderDataGrid() {
    const headerRow = document.getElementById('grid-header-row');
    const bodyRows = document.getElementById('grid-body-rows');
    if (!headerRow || !bodyRows) return;

    if (!AppState.loaded) {
        headerRow.innerHTML = '<th>#</th>';
        bodyRows.innerHTML = `<tr><td colspan="100" class="text-center text-muted">No loaded dataset. Select sample from homepage or upload a CSV file to inspect columns.</td></tr>`;
        return;
    }

    try {
        // Fetch paginated grid details from FastAPI backend
        const gridData = await API.getGrid(
            AppState.gridPage,
            AppState.gridPageSize,
            AppState.gridSearch,
            AppState.gridSortCol,
            AppState.gridSortAsc
        );

        if (!gridData.loaded) return;

        // Render headers
        headerRow.innerHTML = '<th>#</th>';
        gridData.columns.forEach(col => {
            const type = gridData.column_types[col] || 'Categorical';
            const typeChar = type === 'Numeric' ? 'N' : type === 'Date' ? 'D' : 'C';
            headerRow.innerHTML += `<th title="Column Type: ${type}">${col} (${typeChar})</th>`;
        });

        // Update Pagination controls
        const total = gridData.total;
        const pages = gridData.pages;
        const start = gridData.start;
        const end = gridData.end;

        document.getElementById('grid-page-indicator').innerText = `Page ${pages > 0 ? gridData.current_page : 0} of ${pages}`;
        document.getElementById('grid-row-indicator').innerText = `Showing rows ${total > 0 ? start : 0}-${end} of ${total}`;

        document.getElementById('grid-btn-first').disabled = (gridData.current_page <= 1);
        document.getElementById('grid-btn-prev').disabled = (gridData.current_page <= 1);
        document.getElementById('grid-btn-next').disabled = (gridData.current_page >= pages);
        document.getElementById('grid-btn-last').disabled = (gridData.current_page >= pages);

        // Render row values
        bodyRows.innerHTML = '';
        if (gridData.rows.length === 0) {
            bodyRows.innerHTML = `<tr><td colspan="100" class="text-center text-muted">No rows match criteria.</td></tr>`;
            return;
        }

        gridData.rows.forEach((row, i) => {
            const tr = document.createElement('tr');
            const displayIndex = start + i;
            tr.innerHTML = `<td>${displayIndex}</td>`;

            gridData.columns.forEach(col => {
                const cellVal = row[col];
                let cellClass = '';
                if (cellVal === "" || cellVal === null || cellVal === undefined) {
                    cellClass = 'cell-null';
                }

                const displayVal = (cellVal === "" || cellVal === null || cellVal === undefined) ? "[NULL]" : cellVal;
                
                // Create cell element to bind double-click edit
                const td = document.createElement('td');
                if (cellClass) td.className = cellClass;
                td.innerText = displayVal;
                td.ondblclick = () => makeGridCellEditable(td, row._rowId, col);
                tr.appendChild(td);
            });
            bodyRows.appendChild(tr);
        });

    } catch (e) {
        console.error("Grid Render Error:", e);
    }
}

function makeGridCellEditable(td, rowId, colName) {
    if (td.querySelector('input')) return; // Prevent duplicate inputs

    const currentVal = td.innerText === "[NULL]" ? "" : td.innerText;
    td.innerHTML = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentVal;
    input.style.width = '100%';
    input.style.border = 'none';
    input.style.padding = '0';
    input.style.fontFamily = 'Tahoma';
    input.style.fontSize = '11px';
    td.appendChild(input);
    input.focus();

    const saveCell = async () => {
        const newVal = input.value.trim();
        if (newVal !== currentVal) {
            try {
                const res = await API.editCell(rowId, colName, newVal);
                syncState(res);
                showNotification("Success", "Cell updated successfully.");
                renderDataGrid();
            } catch (e) {
                alert("Error editing cell: " + e.message);
                td.innerText = currentVal === "" ? "[NULL]" : currentVal;
            }
        } else {
            td.innerText = currentVal === "" ? "[NULL]" : currentVal;
        }
    };

    input.onblur = saveCell;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            saveCell();
        } else if (e.key === 'Escape') {
            input.onblur = null; // Unbind save
            td.innerText = currentVal === "" ? "[NULL]" : currentVal;
        }
    };
}

// Global grid controls bindings
export function initGridControls() {
    // Search input
    const searchInput = document.getElementById('grid-search-input');
    if (searchInput) {
        let debounceTimer;
        searchInput.oninput = (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                AppState.gridSearch = e.target.value;
                AppState.gridPage = 1;
                renderDataGrid();
            }, 300);
        };
    }

    // Sort Dropdown
    const sortSelect = document.getElementById('grid-sort-column');
    if (sortSelect) {
        sortSelect.onchange = () => {
            AppState.gridSortCol = sortSelect.value;
            AppState.gridSortAsc = true;
            renderDataGrid();
        };
    }

    // Pagination buttons bindings
    document.getElementById('grid-btn-first').onclick = () => {
        AppState.gridPage = 1;
        renderDataGrid();
    };
    document.getElementById('grid-btn-prev').onclick = () => {
        if (AppState.gridPage > 1) {
            AppState.gridPage--;
            renderDataGrid();
        }
    };
    document.getElementById('grid-btn-next').onclick = () => {
        AppState.gridPage++;
        renderDataGrid();
    };
    document.getElementById('grid-btn-last').onclick = () => {
        AppState.gridPage = 999999; // API handles capping it
        renderDataGrid();
    };
}

export function populateSortDropdown() {
    const sortSelect = document.getElementById('grid-sort-column');
    if (!sortSelect) return;
    
    const currentVal = sortSelect.value;
    sortSelect.innerHTML = '<option value="">Sort column...</option>';
    
    AppState.columns.forEach(col => {
        sortSelect.innerHTML += `<option value="${col}">${col}</option>`;
    });

    if (AppState.columns.includes(currentVal)) {
        sortSelect.value = currentVal;
    }
}

// Helper to show classic XP notification popup
function showNotification(title, message) {
    // Check if global showNotification is defined in window
    if (window.showNotification) {
        window.showNotification(title, message);
    } else {
        console.log(`Notification: [${title}] ${message}`);
    }
}

window.gridGoToPage = (page) => {
    if (page === -1) {
        AppState.gridPage = 999999;
    } else {
        AppState.gridPage = page;
    }
    renderDataGrid();
};

window.gridPrevPage = () => {
    if (AppState.gridPage > 1) {
        AppState.gridPage--;
        renderDataGrid();
    }
};

window.gridNextPage = () => {
    AppState.gridPage++;
    renderDataGrid();
};

window.handleGridSortReset = () => {
    const sortSelect = document.getElementById('grid-sort-column');
    if (sortSelect) sortSelect.value = '';
    AppState.gridSortCol = '';
    AppState.gridSortAsc = true;
    renderDataGrid();
};

