/**
 * DataPrep Studio - Dashboard Page Controller
 */

import { AppState } from '../frontend/js/state.js';

export function refreshDashboardPage() {
    if (!AppState.loaded) {
        document.getElementById('dash-stat-filename').innerText = "No Active Dataset";
        document.getElementById('dash-stat-rows').innerText = "0";
        document.getElementById('dash-stat-cols').innerText = "0";
        document.getElementById('dash-stat-missing').innerText = "0";
        document.getElementById('dash-stat-duplicates').innerText = "0";
        document.getElementById('dash-stat-quality').innerText = "--";
        
        const activityLog = document.getElementById('dashboard-activity-log');
        if (activityLog) {
            activityLog.innerHTML = '<li class="timeline-empty">No cleaning operations performed yet.</li>';
        }
        return;
    }

    // Bind metrics values
    document.getElementById('dash-stat-filename').innerText = AppState.filename;
    document.getElementById('dash-stat-rows').innerText = AppState.rows;
    document.getElementById('dash-stat-cols').innerText = AppState.columns.length;
    document.getElementById('dash-stat-missing').innerText = AppState.missingCells;
    document.getElementById('dash-stat-duplicates').innerText = AppState.duplicates;
    
    const qualityEl = document.getElementById('dash-stat-quality');
    qualityEl.innerText = `${AppState.qualityScore}%`;
    if (AppState.qualityScore >= 85) {
        qualityEl.style.color = '#107C41';
    } else if (AppState.qualityScore >= 60) {
        qualityEl.style.color = '#E86C00';
    } else {
        qualityEl.style.color = '#A80000';
    }

    // Refresh Timeline logs
    const activityLog = document.getElementById('dashboard-activity-log');
    if (activityLog) {
        activityLog.innerHTML = '';
        if (AppState.operationsLog.length === 0) {
            activityLog.innerHTML = '<li class="timeline-empty">Raw dataset loaded. No transformations executed.</li>';
        } else {
            AppState.operationsLog.slice(-5).reverse().forEach(log => {
                const li = document.createElement('li');
                li.style.borderBottom = '1px dotted #A0A0A0';
                li.style.paddingBottom = '3px';
                li.style.marginBottom = '3px';
                li.innerHTML = `<strong>${log.title}</strong><br><span style="font-size:9px;color:#606060;">[${log.timestamp}] ${log.desc}</span>`;
                activityLog.appendChild(li);
            });
        }
    }
}
