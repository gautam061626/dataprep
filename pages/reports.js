/**
 * DataPrep Studio - Audit Report Page Controller (Interactive & Visualized)
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
        
        // We extract the inner report-card content to embed in our page view
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const cardContent = doc.querySelector('.report-card');
        
        if (cardContent) {
            reportCard.innerHTML = cardContent.innerHTML;
        } else {
            reportCard.innerHTML = html; // Fallback
        }

        // Add interactive features and visualizations to the loaded report card
        enhanceReportInteractivity(reportCard);

    } catch (err) {
        reportCard.innerHTML = `<div style="color:#A80000; padding:20px;">Failed to compile report: ${err.message}</div>`;
    }
}

/**
 * Parses report tables, inserts interactive Plotly charts, and adds column header sorting.
 */
function enhanceReportInteractivity(reportCard) {
    // 1. Find all sections
    const sections = reportCard.querySelectorAll('.section');
    if (sections.length < 2) return; // Need at least summary and schema table

    const schemaTable = sections[1].querySelector('table');
    if (!schemaTable) return;

    // 2. Parse Column Schema statistics directly from the HTML table rows
    const rows = Array.from(schemaTable.querySelectorAll('tbody tr'));
    const colNames = [];
    const colTypes = {};
    const colCompleteness = [];

    rows.forEach(row => {
        if (row.cells.length < 6) return;
        const name = row.cells[1].innerText.trim();
        const type = row.cells[2].innerText.trim();
        const completeness = parseFloat(row.cells[3].innerText.replace('%', '').trim()) || 0;

        colNames.push(name);
        colTypes[type] = (colTypes[type] || 0) + 1;
        colCompleteness.push(completeness);
    });

    // 3. Inject Visualizations panel
    const vizSection = document.createElement('div');
    vizSection.className = 'section print-hidden'; // Hidden during PDF generation
    vizSection.innerHTML = `
        <h3 style="color:#003399; font-size:12px; margin: 15px 0 8px 0; border-bottom:1px solid #A0A0A0; padding-bottom:2px; font-weight:bold;">
            Interactive Quality Visualizations
        </h3>
        <div class="report-charts-row" style="display: flex; gap: 15px; margin-bottom: 15px;">
            <div class="classic-groupbox" style="flex: 1; padding: 8px; background: #FFFFFF; min-width: 220px; box-sizing: border-box;">
                <legend class="groupbox-legend">Column Type Distribution</legend>
                <div id="rpt-plotly-types" style="height: 180px; width: 100%;"></div>
            </div>
            <div class="classic-groupbox" style="flex: 1; padding: 8px; background: #FFFFFF; min-width: 220px; box-sizing: border-box;">
                <legend class="groupbox-legend">Data Completeness (%)</legend>
                <div id="rpt-plotly-completeness" style="height: 180px; width: 100%;"></div>
            </div>
        </div>
    `;

    // Insert visualizations panel right after Structural Summary section
    sections[0].parentNode.insertBefore(vizSection, sections[0].nextSibling);

    // 4. Render Plotly charts
    if (window.Plotly) {
        // Types Distribution Pie Chart
        const typeLabels = Object.keys(colTypes);
        const typeValues = Object.values(colTypes);
        window.Plotly.newPlot('rpt-plotly-types', [{
            values: typeValues,
            labels: typeLabels,
            type: 'pie',
            hole: 0.3,
            marker: { colors: ['#3A93FF', '#107C41', '#E86C00', '#A80000', '#A0A0A0'] }
        }], {
            margin: { l: 15, r: 15, t: 15, b: 15 },
            height: 170,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { family: 'Tahoma, sans-serif', size: 10 }
        }, { responsive: true, displayModeBar: false });

        // Completeness Rates Horizontal Bar Chart
        window.Plotly.newPlot('rpt-plotly-completeness', [{
            x: colCompleteness,
            y: colNames,
            type: 'bar',
            orientation: 'h',
            marker: { color: '#0055EA' }
        }], {
            margin: { l: 75, r: 15, t: 10, b: 30 },
            height: 170,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { family: 'Tahoma, sans-serif', size: 9 },
            xaxis: { range: [0, 105], gridcolor: '#EAEAEA' }
        }, { responsive: true, displayModeBar: false });
    }

    // 5. Add clickable column sorting to table headers
    const headers = schemaTable.querySelectorAll('th');
    headers.forEach((th, index) => {
        if (index === 0) return; // Skip numeric index column
        
        th.style.cursor = 'pointer';
        th.title = 'Click to sort columns';
        th.style.userSelect = 'none';
        th.innerHTML += ' <span style="font-size:8px;color:#003399;">⇅</span>';
        
        let asc = true;
        th.onclick = () => {
            const tbody = schemaTable.querySelector('tbody');
            const rowsArray = Array.from(tbody.querySelectorAll('tr'));
            
            rowsArray.sort((rowA, rowB) => {
                let cellA = rowA.cells[index].innerText;
                let cellB = rowB.cells[index].innerText;

                if (index === 3) { // Complete %
                    cellA = parseFloat(cellA.replace('%', ''));
                    cellB = parseFloat(cellB.replace('%', ''));
                } else if (index === 4) { // Uniques
                    cellA = parseInt(cellA);
                    cellB = parseInt(cellB);
                } else if (index === 5) { // Mean Value
                    cellA = isNaN(parseFloat(cellA)) ? cellA : parseFloat(cellA);
                    cellB = isNaN(parseFloat(cellB)) ? cellB : parseFloat(cellB);
                }

                if (cellA < cellB) return asc ? -1 : 1;
                if (cellA > cellB) return asc ? 1 : -1;
                return 0;
            });

            asc = !asc;
            tbody.innerHTML = '';
            rowsArray.forEach(row => tbody.appendChild(row));
        };
    });
}

export function initReportsControls() {
    // Re-bind Action buttons in the upper bar
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
