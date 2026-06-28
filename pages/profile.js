/**
 * DataPrep Studio - Data Profile Diagnostics Page Controller
 */

import { AppState } from '../frontend/js/state.js';
import * as API from '../frontend/js/api.js';

let profileData = []; // Cached profile stats from backend

export async function refreshProfilingPage() {
    const tableBody = document.getElementById('profiling-meta-table-body');
    if (!tableBody) return;

    if (!AppState.loaded) {
        tableBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No loaded dataset. Upload a CSV to view statistics.</td></tr>`;
        return;
    }

    try {
        // Fetch detailed column profile stats from FastAPI
        const res = await API.getProfile();
        if (res.loaded) {
            profileData = res.profile;
        }

        // Render meta overview details
        const totalCols = AppState.columns.length;
        const totalRows = AppState.rows;
        
        let missingCount = 0;
        profileData.forEach(c => missingCount += c.missing_count);
        const totalCells = totalRows * totalCols;
        const completeness = totalCells > 0 ? ((1 - (missingCount / totalCells)) * 100).toFixed(1) : "100.0";

        document.getElementById('profile-total-cols').innerText = totalCols;
        document.getElementById('profile-total-rows').innerText = totalRows;
        document.getElementById('profile-completeness-pct').innerText = `${completeness}%`;
        document.getElementById('profile-memory').innerText = `${AppState.memoryUsageKb} KB`;

        const healthEl = document.getElementById('profile-health-score');
        healthEl.innerText = `${AppState.qualityScore}%`;
        if (AppState.qualityScore >= 85) {
            healthEl.style.color = '#107C41';
        } else if (AppState.qualityScore >= 60) {
            healthEl.style.color = '#E86C00';
        } else {
            healthEl.style.color = '#A80000';
        }

        // Render profiling table
        renderProfilingTable();

        // Populate detail subtabs select list options
        populateProfileDropdowns();

    } catch (err) {
        console.error("Profiling refresh failed:", err);
    }
}

function renderProfilingTable() {
    const tableBody = document.getElementById('profiling-meta-table-body');
    const searchVal = document.getElementById('profiling-col-search').value.toLowerCase().trim();
    const typeFilter = document.getElementById('profiling-datatype-filter').value;

    tableBody.innerHTML = '';
    let index = 1;

    profileData.forEach(col => {
        // Apply search query
        if (searchVal && !col.name.toLowerCase().includes(searchVal)) return;

        // Apply type filter
        if (typeFilter !== 'ALL' && col.type !== typeFilter) return;

        const row = document.createElement('tr');
        
        const formatVal = (v) => (typeof v === 'number') ? v.toFixed(2) : v;

        row.innerHTML = `
            <td>${index++}</td>
            <td><strong>${col.name}</strong></td>
            <td><span style="background:#DFE8F6; border:1px solid #A0A0A0; padding:1px 4px; font-size:9px;">${col.type}</span></td>
            <td>${col.missing_count}</td>
            <td>${col.missing_pct}%</td>
            <td>${col.unique}</td>
            <td>${formatVal(col.min)}</td>
            <td>${formatVal(col.max)}</td>
            <td>${formatVal(col.mean)}</td>
            <td>${formatVal(col.std)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function populateProfileDropdowns() {
    const numSelect = document.getElementById('profile-numeric-col-select');
    const catSelect = document.getElementById('profile-categorical-col-select');

    if (!numSelect || !catSelect) return;

    const lastNumVal = numSelect.value;
    const lastCatVal = catSelect.value;

    numSelect.innerHTML = '';
    catSelect.innerHTML = '';

    profileData.forEach(col => {
        if (col.type === 'Numeric') {
            numSelect.innerHTML += `<option value="${col.name}">${col.name}</option>`;
        } else {
            catSelect.innerHTML += `<option value="${col.name}">${col.name}</option>`;
        }
    });

    // Re-bind change listeners
    numSelect.onchange = () => renderNumericProfileDetails();
    catSelect.onchange = () => renderCategoricalProfileDetails();

    if (lastNumVal && [...numSelect.options].some(opt => opt.value === lastNumVal)) {
        numSelect.value = lastNumVal;
    }
    if (lastCatVal && [...catSelect.options].some(opt => opt.value === lastCatVal)) {
        catSelect.value = lastCatVal;
    }

    renderNumericProfileDetails();
    renderCategoricalProfileDetails();
}

export function renderNumericProfileDetails() {
    const select = document.getElementById('profile-numeric-col-select');
    if (!select || select.value === "") {
        document.getElementById('stat-median').innerText = '--';
        document.getElementById('stat-q1').innerText = '--';
        document.getElementById('stat-q3').innerText = '--';
        document.getElementById('stat-variance').innerText = '--';
        document.getElementById('stat-sum').innerText = '--';
        document.getElementById('stat-skew').innerText = '--';
        return;
    }

    const colName = select.value;
    const colStats = profileData.find(c => c.name === colName);

    if (colStats) {
        const formatVal = (v) => (typeof v === 'number') ? v.toFixed(3) : '--';
        document.getElementById('stat-median').innerText = formatVal(colStats.median);
        document.getElementById('stat-q1').innerText = formatVal(colStats.q1);
        document.getElementById('stat-q3').innerText = formatVal(colStats.q3);
        document.getElementById('stat-variance').innerText = formatVal(colStats.variance);
        
        // Sum calculation proxy
        const sumVal = (typeof colStats.mean === 'number') ? colStats.mean * AppState.rows : null;
        document.getElementById('stat-sum').innerText = formatVal(sumVal);
        
        // Skewness description
        const skew = colStats.skewness;
        if (typeof skew === 'number') {
            let desc = `${skew.toFixed(3)} (`;
            if (Math.abs(skew) < 0.2) desc += 'Symmetric)';
            else if (skew > 0) desc += 'Right-skewed)';
            else desc += 'Left-skewed)';
            document.getElementById('stat-skew').innerText = desc;
        } else {
            document.getElementById('stat-skew').innerText = '--';
        }
    }
}

export async function renderCategoricalProfileDetails() {
    const select = document.getElementById('profile-categorical-col-select');
    const resultsBox = document.getElementById('categorical-counts-results');
    if (!select || select.value === "" || !resultsBox) return;

    const colName = select.value;
    resultsBox.innerHTML = '<span style="font-size:10px;font-style:italic;color:#606060;">Calculating frequencies...</span>';

    try {
        const data = await API.getCategoricalProfile(colName);
        resultsBox.innerHTML = '';

        if (data.counts.length === 0) {
            resultsBox.innerHTML = '<div style="padding:10px;text-align:center;">No data values available.</div>';
            return;
        }

        data.counts.forEach(item => {
            // Render frequency bar list using Tahoma spacing
            const barWidth = Math.max(5, Math.round(item.percentage * 3.5)); // Map percentage to width px
            const itemDiv = document.createElement('div');
            itemDiv.className = 'val-count-item';
            itemDiv.innerHTML = `
                <div class="val-count-bar-holder" style="display:flex; align-items:center; margin-bottom:3px;">
                    <span class="val-count-label" style="width:100px; display:inline-block; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.label}">${item.label}</span>
                    <div class="val-count-bar" style="width:${barWidth}px; height:12px; background-color:#3A93FF; border:1px solid #002266; margin-right:8px;" title="${item.percentage}%"></div>
                    <span class="val-count-num" style="font-size:9.5px; color:#505050;">${item.count} (${item.percentage}%)</span>
                </div>
            `;
            resultsBox.appendChild(itemDiv);
        });
    } catch (err) {
        resultsBox.innerHTML = `<span style="color:#A80000;">Error: ${err.message}</span>`;
    }
}

// Binds search triggers on profiling page
export function initProfilingFilters() {
    const search = document.getElementById('profiling-col-search');
    if (search) {
        search.oninput = () => renderProfilingTable();
    }
    const filter = document.getElementById('profiling-datatype-filter');
    if (filter) {
        filter.onchange = () => renderProfilingTable();
    }
}
