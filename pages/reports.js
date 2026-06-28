/**
 * DataPrep Studio - Audit Report Page Controller
 */

import { AppState } from '../frontend/js/state.js';
import * as API from '../frontend/js/api.js';

export async function refreshReportsPage() {
    const reportCard = document.getElementById('printable-report-card');
    if (!reportCard) return;

    if (!AppState.loaded) {
        reportCard.innerHTML = '<div style="padding:40px; text-align:center; font-style:italic;">Please load a dataset to compile an audit report.</div>';
        return;
    }

    reportCard.innerHTML = '<div style="padding:40px; text-align:center; font-style:italic;">Compiling quality audit document...</div>';

    try {
        // Fetch HTML report preview from FastAPI
        const html = await API.getReportHtml();
        
        // We only extract the inner report-card content to embed in our page view
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const cardContent = doc.querySelector('.report-card');
        
        if (cardContent) {
            // Keep styling, remove outer document tags
            reportCard.innerHTML = cardContent.innerHTML;
        } else {
            reportCard.innerHTML = html; // Fallback
        }

    } catch (err) {
        reportCard.innerHTML = `<div style="color:#A80000; padding:20px;">Failed to compile report: ${err.message}</div>`;
    }
}

export function initReportsControls() {
    // Re-bind Action buttons
    const actionRow = document.querySelector('#page-reports .header-action-row');
    if (actionRow) {
        actionRow.innerHTML = `
            <button class="xp-btn xp-btn-primary" onclick="downloadPdfReport()">Print PDF Document</button>
            <button class="xp-btn xp-btn-success" onclick="exportReportHtml()">Save HTML Report</button>
        `;
    }

    // PDF Download trigger
    window.downloadPdfReport = () => {
        if (!AppState.loaded) return;
        window.open('/api/report/pdf', '_blank');
    };

    // HTML Saving trigger
    window.exportReportHtml = async () => {
        if (!AppState.loaded) return;
        try {
            const htmlText = await API.getReportHtml();
            const blob = new Blob([htmlText], { type: 'text/html' });
            const link = document.createElement('a');
            link.download = `dataprep_audit_${AppState.filename.replace('.csv', '')}.html`;
            link.href = URL.createObjectURL(blob);
            link.click();
        } catch (e) {
            alert("Export HTML error: " + e.message);
        }
    };
}
