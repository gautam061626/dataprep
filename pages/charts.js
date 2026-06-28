/**
 * DataPrep Studio - Charts Visualization Page Controller
 */

import { AppState } from '../frontend/js/state.js';
import * as API from '../frontend/js/api.js';

let activeStaticImg = ""; // Caches static matplotlib image

export function refreshVisualizationsPage() {
    populateChartsDropdowns();
    handleChartTypeChange();

    // Force Plotly to resize to container after layout settle
    if (window.Plotly && document.getElementById('vis-plotly-container')) {
        setTimeout(() => {
            try {
                window.Plotly.Plots.resize('vis-plotly-container');
            } catch (e) {}
        }, 150);
    }
}

function populateChartsDropdowns() {
    const xSelect = document.getElementById('vis-x-select');
    const ySelect = document.getElementById('vis-y-select');
    const filterSelect = document.getElementById('vis-filter-col');

    if (!xSelect || !ySelect || !filterSelect) return;

    const lastX = xSelect.value;
    const lastY = ySelect.value;
    const lastF = filterSelect.value;

    xSelect.innerHTML = '';
    ySelect.innerHTML = '';
    filterSelect.innerHTML = '<option value="">[No Filter]</option>';

    AppState.columns.forEach(col => {
        xSelect.innerHTML += `<option value="${col}">${col}</option>`;
        ySelect.innerHTML += `<option value="${col}">${col}</option>`;
        filterSelect.innerHTML += `<option value="${col}">${col}</option>`;
    });

    if (lastX && AppState.columns.includes(lastX)) xSelect.value = lastX;
    if (lastY && AppState.columns.includes(lastY)) ySelect.value = lastY;
    if (lastF && AppState.columns.includes(lastF)) filterSelect.value = lastF;
}

export function handleChartTypeChange() {
    const chartType = document.getElementById('vis-chart-type').value;
    const xContainer = document.getElementById('vis-x-select-container');
    const yContainer = document.getElementById('vis-y-select-container');

    // Boxplots, Histograms and Heatmaps might not require both variables
    if (chartType === 'heatmap') {
        xContainer.classList.add('hidden');
        xContainer.style.display = 'none';
        yContainer.classList.add('hidden');
        yContainer.style.display = 'none';
    } else if (chartType === 'histogram' || chartType === 'pie') {
        xContainer.classList.remove('hidden');
        xContainer.style.display = 'block';
        yContainer.classList.add('hidden');
        yContainer.style.display = 'none';
    } else if (chartType === 'boxplot') {
        // Box plot can take optional X grouping, always Y variable
        xContainer.classList.remove('hidden');
        xContainer.style.display = 'block';
        yContainer.classList.remove('hidden');
        yContainer.style.display = 'block';
        document.getElementById('vis-x-label').innerText = 'Grouping Column (Optional):';
    } else {
        xContainer.classList.remove('hidden');
        xContainer.style.display = 'block';
        yContainer.classList.remove('hidden');
        yContainer.style.display = 'block';
        document.getElementById('vis-x-label').innerText = 'Independent Variable (X):';
    }

    renderActiveChart();
}

export async function renderActiveChart() {
    if (!AppState.loaded) return;

    const chartType = document.getElementById('vis-chart-type').value;
    const xCol = document.getElementById('vis-x-select').value;
    const yCol = document.getElementById('vis-y-select').value;
    const filterCol = document.getElementById('vis-filter-col').value;
    const filterValSelect = document.getElementById('vis-filter-val');
    const filterVal = filterValSelect ? filterValSelect.value : "";

    // Clear and construct Plotly container
    let container = document.getElementById('vis-plotly-container');
    const canvas = document.getElementById('vis-chart-canvas');
    const legend = document.getElementById('vis-chart-legend');

    if (canvas) canvas.style.display = 'none';
    if (legend) legend.style.display = 'none';

    if (!container) {
        const well = document.querySelector('#page-visualizations .canvas-well');
        if (well) {
            container = document.createElement('div');
            container.id = 'vis-plotly-container';
            container.style.width = '100%';
            container.style.height = '340px';
            well.appendChild(container);
        }
    }

    if (!container) return;
    container.innerHTML = '<div style="padding:40px; text-align:center; font-style:italic;">Generating Plotly figures...</div>';

    try {
        const res = await API.getCharts(chartType, xCol, yCol, filterCol, filterVal);
        container.innerHTML = '';
        
        if (res.error) {
            container.innerHTML = `<div style="color:#A80000; padding:20px; text-align:center; font-weight:bold;">${res.error}</div>`;
            return;
        }

        activeStaticImg = res.static_img;

        // Render Plotly interactive chart
        if (window.Plotly) {
            window.Plotly.newPlot(
                'vis-plotly-container',
                res.plotly_json.data,
                res.plotly_json.layout,
                { responsive: true, displayModeBar: false }
            );
        } else {
            // If Plotly.js fails to load, render static Matplotlib image
            container.innerHTML = `<img src="${res.static_img}" style="max-width:100%; max-height:100%; display:block; margin:0 auto;" />`;
        }

    } catch (err) {
        container.innerHTML = `<div style="color:#A80000; padding:20px;">Failed to load chart: ${err.message}</div>`;
    }
}

export function handleVisFilterColChange() {
    const col = document.getElementById('vis-filter-col').value;
    const container = document.getElementById('vis-filter-val-container');
    const valSelect = document.getElementById('vis-filter-val');

    if (!container || !valSelect) return;

    if (!col) {
        container.classList.add('hidden');
        container.style.display = 'none';
        renderActiveChart();
        return;
    }

    container.classList.remove('hidden');
    container.style.display = 'block';
    
    // Fetch unique values to populate values select
    valSelect.innerHTML = '<option value="">Select filter val...</option>';
    
    // Populate distinct categorical values
    // We scan active rows to get distinct filter criteria
    // Since AppState holds columnTypes and data, we can query distinct values on the client or fetch them.
    // For simplicity, we can do it on the client side since we only need simple categorical matching:
    // To fetch distinct values dynamically, let's query the cached profile unique values or just do it from the local data preview
    // In our design, we can query the backend unique value lists using categorical counts endpoint
    API.getCategoricalProfile(col).then(data => {
        valSelect.innerHTML = '';
        data.counts.forEach(item => {
            valSelect.innerHTML += `<option value="${item.label}">${item.label}</option>`;
        });
        valSelect.onchange = () => renderActiveChart();
        renderActiveChart();
    }).catch(err => {
        console.error("Filter column values loading failed:", err);
    });
}

// Binds chart option selections
export function initChartsControls() {
    const chartType = document.getElementById('vis-chart-type');
    if (chartType) {
        chartType.onchange = () => handleChartTypeChange();
    }
    const xSelect = document.getElementById('vis-x-select');
    if (xSelect) {
        xSelect.onchange = () => renderActiveChart();
    }
    const ySelect = document.getElementById('vis-y-select');
    if (ySelect) {
        ySelect.onchange = () => renderActiveChart();
    }
    const filterCol = document.getElementById('vis-filter-col');
    if (filterCol) {
        filterCol.onchange = () => handleVisFilterColChange();
    }

    // Save PNG action button
    window.downloadChartCanvas = () => {
        if (!activeStaticImg) return;
        
        const link = document.createElement('a');
        link.download = `dataprep_chart_${Date.now()}.png`;
        link.href = activeStaticImg;
        link.click();
    };
}
