/**
 * DataPrep Studio - Main Coordinator Script (ES6 Entry Point)
 */

import { AppState, syncState } from './js/state.js';
import * as API from './js/api.js';
import { initWelcomePage } from '../pages/welcome.js';
import { refreshDashboardPage } from '../pages/dashboard.js';
import { refreshProfilingPage, initProfilingFilters } from '../pages/profile.js';
import { refreshCleaningPage, initCleaningOperations } from '../pages/cleaning.js';
import { refreshVisualizationsPage, initChartsControls } from '../pages/charts.js';
import { refreshReportsPage, initReportsControls } from '../pages/reports.js';
import { refreshExportPage, initExportControls } from '../pages/export.js';
import { refreshMlPage, initMlControls } from '../pages/ml.js';
import { initGridControls } from '../components/grid.js';

// Map sidebar nodes to page views
const PAGE_MAPPINGS = {
    'landing': 'page-landing',
    'dashboard': 'page-dashboard',
    'profiling': 'page-profiling',
    'cleaning': 'page-cleaning',
    'visualizations': 'page-visualizations',
    'reports': 'page-reports',
    'export': 'page-export',
    'ml': 'page-ml'
};

document.addEventListener('DOMContentLoaded', () => {
    // Expose close modals to window since HTML binds them inline
    window.closeConfirmModal = () => {
        const modal = document.getElementById('modal-confirm');
        if (modal) modal.close();
    };

    window.closeAboutModal = () => {
        const modal = document.getElementById('modal-about');
        if (modal) modal.close();
    };

    window.showAboutModal = () => {
        const modal = document.getElementById('modal-about');
        if (modal) modal.showModal();
    };

    // Close menu bar dropdowns on click out
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-item')) {
            document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');
        }
    });

    // Initialize all modular controllers
    initWelcomePage(triggerNav);
    initGridControls();
    initProfilingFilters();
    initCleaningOperations();
    initChartsControls();
    initReportsControls();
    initExportControls();
    initMlControls();

    // Bind custom theme change function
    window.changeThemeSkin = (theme) => {
        document.body.className = '';
        document.body.classList.add(`theme-${theme}`);
        AppState.settings.theme = theme;
    };

    // Keyboard bindings for undo / redo
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            if (window.undoAction) window.undoAction();
        }
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            if (window.redoAction) window.redoAction();
        }
    });

    // Bind retro windows close button
    const closeBtn = document.querySelector('.btn-close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            if (confirm("Are you sure you want to close DataPrep Studio? All active in-memory clean states will be lost.")) {
                window.close();
            }
        };
    }

    // Trigger initial welcome landing nav
    triggerNav('landing', false);
});

export function triggerNav(pageId, recordHistory = true) {
    const panelId = PAGE_MAPPINGS[pageId];
    if (!panelId) return;

    // Toggle active view panel
    document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) targetPanel.classList.add('active');

    // Toggle active sidebar highlight
    document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.remove('active'));
    const sidebarTab = document.getElementById(`node-${pageId}`);
    if (sidebarTab) sidebarTab.classList.add('active');

    // Update active properties help description
    updatePropertiesHelpContext(pageId);

    // Track navigation stacks for prev/next button checks
    if (recordHistory) {
        if (AppState.navigationIndex < AppState.navigationHistory.length - 1) {
            AppState.navigationHistory = AppState.navigationHistory.slice(0, AppState.navigationIndex + 1);
        }
        AppState.navigationHistory.push(pageId);
        AppState.navigationIndex = AppState.navigationHistory.length - 1;
    }

    // Toggle disabled status for browser-like prev/next arrows
    const prevBtn = document.getElementById('nav-btn-prev');
    const nextBtn = document.getElementById('nav-btn-next');
    if (prevBtn) prevBtn.disabled = (AppState.navigationIndex <= 0);
    if (nextBtn) nextBtn.disabled = (AppState.navigationIndex >= AppState.navigationHistory.length - 1);

    // Load page-specific content refreshes
    if (pageId === 'dashboard') refreshDashboardPage();
    if (pageId === 'profiling') refreshProfilingPage();
    if (pageId === 'cleaning') refreshCleaningPage();
    if (pageId === 'visualizations') refreshVisualizationsPage();
    if (pageId === 'reports') refreshReportsPage();
    if (pageId === 'export') refreshExportPage();
    if (pageId === 'ml') refreshMlPage();
}

// Bind Navigation prev/next buttons
window.navPrev = () => {
    if (AppState.navigationIndex > 0) {
        AppState.navigationIndex--;
        triggerNav(AppState.navigationHistory[AppState.navigationIndex], false);
    }
};

window.navNext = () => {
    if (AppState.navigationIndex < AppState.navigationHistory.length - 1) {
        AppState.navigationIndex++;
        triggerNav(AppState.navigationHistory[AppState.navigationIndex], false);
    }
};

function updatePropertiesHelpContext(pageId) {
    const box = document.getElementById('active-context-help-box');
    if (!box) return;

    const helpTexts = {
        'landing': 'Welcome Screen. Drag and drop CSV files to parse. Click "Load Sample Customer Dataset" for quick testing.',
        'dashboard': 'Project Dashboard. Provides dataset dimensions, missing cells totals, duplicate tallies, quality score ratings, and recent logs.',
        'profiling': 'Dataset Diagnostics. Displays types (Categorical/Numeric/Date), completeness proportions, uniques, averages, standard deviations, and variance measures.',
        'cleaning': 'Cleaning Console. Apply row removals, impute missing cells (mean, median, mode, custom), delete columns, rename, substitute values, trim, and purge outliers.',
        'visualizations': 'Visualization Canvas. Render dynamic Plotly figures. Supports Bar, Pie, Scatter, Histograms, Line trends, Box plots, and Correlation Heatmaps.',
        'reports': 'Audit Report. Review dataset summaries, column schemas, and a full chronological cleaning operations history log ledger.',
        'export': 'Download Prepared Dataset. Export cleaned table data back to CSV, JSON, Excel (xlsx), or raw SQL insert statements script format.',
        'ml': 'Machine Learning workspace. Split datasets, train regression & classification models, evaluate scoring indices, and review SHAP explanation charts.'
    };

    box.innerText = helpTexts[pageId] || 'Select an active page panel tab node to inspect property details.';
}

// Global notification balloon dialog
window.showNotification = (title, message) => {
    // Creates a classic compact popup at bottom right corner
    let toast = document.getElementById('xp-balloon-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'xp-balloon-toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '20px';
        toast.style.width = '240px';
        toast.style.zIndex = '9999';
        toast.style.backgroundColor = '#FFFFE1'; // XP yellow tooltip balloon
        toast.style.border = '1px solid #000000';
        toast.style.padding = '8px';
        toast.style.fontFamily = 'Tahoma';
        toast.style.fontSize = '11px';
        toast.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.3)';
        document.body.appendChild(toast);
    }

    toast.innerHTML = `
        <div style="font-weight:bold; color:#003399; display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>${title}</span>
            <span onclick="this.parentNode.parentNode.style.display='none'" style="cursor:pointer;color:#000;">✕</span>
        </div>
        <div>${message}</div>
    `;
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 4500);
};

window.triggerNav = triggerNav;

