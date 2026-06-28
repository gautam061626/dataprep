/**
 * DataPrep Studio - Machine Learning Controller
 */

import { AppState } from '../frontend/js/state.js';
import * as API from '../frontend/js/api.js';

let mlPlots = {}; // Caches trained model plots (base64)
let activePlotTab = "eval"; // 'eval' | 'importance' | 'shap'

export function refreshMlPage() {
    populateMlDropdowns();
    handleMlModelTypeChange();
    renderMlResults();
}

function populateMlDropdowns() {
    const ySelect = document.getElementById('ml-y-select');
    const xSelect = document.getElementById('ml-x-select');

    if (!ySelect || !xSelect) return;

    // Convert X select to listbox (multiple select)
    xSelect.multiple = true;
    xSelect.size = 5;
    xSelect.style.height = "70px";

    const lastY = ySelect.value;
    // Get array of selected X features
    const lastX = Array.from(xSelect.selectedOptions).map(opt => opt.value);

    ySelect.innerHTML = '';
    xSelect.innerHTML = '';

    AppState.columns.forEach(col => {
        ySelect.innerHTML += `<option value="${col}">${col}</option>`;
        xSelect.innerHTML += `<option value="${col}">${col}</option>`;
    });

    if (lastY && AppState.columns.includes(lastY)) ySelect.value = lastY;
    
    // Restore selected X columns
    Array.from(xSelect.options).forEach(opt => {
        if (lastX.includes(opt.value)) {
            opt.selected = true;
        }
    });
}

export function handleMlModelTypeChange() {
    const modelKey = document.getElementById('ml-model-type').value;
    const paramContainer = document.getElementById('ml-param-container');
    if (!paramContainer) return;

    // Dynamically inject parameters based on model type
    let html = "";
    if (modelKey === "knn_class" || modelKey === "knn_reg") {
        html = `
            <label for="ml-param-k">Number of Neighbors (K):</label>
            <input type="number" id="ml-param-k" value="5" min="1" max="25" class="xp-input-block" style="margin-top:2px;">
        `;
    } else if (modelKey === "tree_class" || modelKey === "tree_reg") {
        html = `
            <label for="ml-param-depth">Max Depth of Tree:</label>
            <input type="number" id="ml-param-depth" value="5" min="1" max="20" class="xp-input-block" style="margin-top:2px;">
        `;
    } else if (modelKey === "forest_class" || modelKey === "forest_reg") {
        html = `
            <label for="ml-param-estimators">Estimators (Trees count):</label>
            <input type="number" id="ml-param-estimators" value="100" min="10" max="500" class="xp-input-block" style="margin-top:2px;">
        `;
    } else if (modelKey === "ridge") {
        html = `
            <label for="ml-param-alpha">L2 Penalty Weight (Alpha):</label>
            <input type="number" id="ml-param-alpha" value="1.0" min="0.01" max="50.0" step="0.1" class="xp-input-block" style="margin-top:2px;">
        `;
    } else if (modelKey === "svm_class" || modelKey === "svm_reg") {
        html = `
            <label for="ml-param-c">Complexity Penalty (C):</label>
            <input type="number" id="ml-param-c" value="1.0" min="0.01" max="100.0" step="0.5" class="xp-input-block" style="margin-top:2px;">
        `;
    }

    paramContainer.innerHTML = html;
}

export async function trainAndVisualizeMlModel() {
    if (!AppState.loaded) return;

    const modelType = document.getElementById('ml-model-type').value;
    const targetCol = document.getElementById('ml-y-select').value;
    
    // Extract multi-selected features
    const xSelect = document.getElementById('ml-x-select');
    const featureCols = Array.from(xSelect.selectedOptions).map(opt => opt.value);

    if (featureCols.length === 0) {
        alert("Please select at least 1 feature variable (X).");
        return;
    }

    if (featureCols.includes(targetCol)) {
        alert("Feature variables (X) cannot include the target variable (Y).");
        return;
    }

    const trainSplit = Number(document.getElementById('ml-split-ratio').value);
    const summaryBox = document.getElementById('ml-summary-box');
    const canvasWell = document.querySelector('#page-ml .canvas-well');

    if (summaryBox) {
        summaryBox.innerHTML = '<span style="font-size:11px;font-style:italic;color:#606060;">Training model and computing SHAP values...</span>';
    }
    
    if (canvasWell) {
        canvasWell.innerHTML = '<div style="color:#FFF; font-style:italic; font-size:11px;">Training Scikit-Learn Pipeline...</div>';
    }

    try {
        const res = await API.trainMl(modelType, targetCol, featureCols, trainSplit);

        // Renders Metrics summary card
        let metricsHtml = `
            <div style="line-height:1.4;">
                <strong>MODEL: ${res.model_name}</strong><br/>
                Target: <code style="color:#003399;font-weight:bold;">${targetCol}</code> | Type: <strong>${res.is_classification ? "Classification" : "Regression"}</strong><br/>
                Train dataset: ${res.train_samples} rows | Test dataset: ${res.test_samples} rows<br/>
                <strong>Performance Diagnostics:</strong><br/>
        `;
        
        for (const metricName in res.metrics) {
            metricsHtml += `- ${metricName}: <code style="color:green;font-weight:bold;">${res.metrics[metricName]}</code><br/>`;
        }
        metricsHtml += '</div>';
        summaryBox.innerHTML = metricsHtml;

        // Cache base64 plot graphics
        mlPlots = res.plots;
        activePlotTab = "eval"; // default

        renderMlResults();
        showNotification("Success", "Model trained successfully!");

    } catch (err) {
        summaryBox.innerHTML = `<div style="color:#A80000; font-weight:bold;">Training failed: ${err.message}</div>`;
        if (canvasWell) canvasWell.innerHTML = '<div style="color:#FFF;">Error training.</div>';
    }
}

function renderMlResults() {
    const canvasWell = document.querySelector('#page-ml .canvas-well');
    if (!canvasWell) return;

    if (Object.keys(mlPlots).length === 0) {
        canvasWell.innerHTML = '<div style="color:#808080; font-style:italic; font-size:11px;">No trained model results available. Configure inputs and click train.</div>';
        return;
    }

    // Determine target evaluations image
    let evalImg = mlPlots.confusion_matrix || mlPlots.actual_vs_pred || "";
    let importanceImg = mlPlots.feature_importance || "";
    let shapImg = mlPlots.shap_explanation || "";

    // Clear canvas-well and draw clean, vintage looking tabs + image element
    canvasWell.innerHTML = '';
    canvasWell.style.display = 'flex';
    canvasWell.style.flexDirection = 'column';
    canvasWell.style.justifyContent = 'flex-start';
    canvasWell.style.alignItems = 'stretch';
    canvasWell.style.backgroundColor = '#ECE9D8'; // XP Gray background
    canvasWell.style.padding = '0';

    // Tab strip
    const tabStrip = document.createElement('div');
    tabStrip.className = 'tab-header-strip';
    tabStrip.style.display = 'flex';
    tabStrip.style.backgroundColor = '#ECE9D8';
    tabStrip.style.borderBottom = '1px solid #808080';
    tabStrip.style.padding = '3px 3px 0 3px';
    tabStrip.style.gap = '2px';

    const addTab = (id, label, active) => {
        const btn = document.createElement('button');
        btn.className = `xp-tab-btn ${active ? 'active' : ''}`;
        btn.innerText = label;
        btn.style.height = '20px';
        btn.style.fontSize = '9px';
        btn.style.padding = '0 6px';
        btn.onclick = () => {
            activePlotTab = id;
            renderMlResults();
        };
        tabStrip.appendChild(btn);
    };

    const hasConfusion = !!mlPlots.confusion_matrix;
    addTab("eval", hasConfusion ? "Confusion Matrix" : "Actual vs. Predicted", activePlotTab === "eval");
    if (mlPlots.roc_curve && hasConfusion) {
        addTab("roc", "ROC curve", activePlotTab === "roc");
    }
    addTab("importance", "Feature Importance", activePlotTab === "importance");
    addTab("shap", "SHAP Impact", activePlotTab === "shap");

    canvasWell.appendChild(tabStrip);

    // Plot image render well
    const imgWell = document.createElement('div');
    imgWell.style.flex = '1';
    imgWell.style.display = 'flex';
    imgWell.style.justifyContent = 'center';
    imgWell.style.alignItems = 'center';
    imgWell.style.backgroundColor = '#FFFFFF';
    imgWell.style.padding = '5px';
    imgWell.style.overflow = 'hidden';

    let imgSrc = "";
    if (activePlotTab === "eval") imgSrc = evalImg;
    else if (activePlotTab === "roc") imgSrc = mlPlots.roc_curve;
    else if (activePlotTab === "importance") imgSrc = importanceImg;
    else if (activePlotTab === "shap") imgSrc = shapImg;

    if (imgSrc) {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '210px';
        img.style.display = 'block';
        img.style.objectFit = 'contain';
        imgWell.appendChild(img);
    } else {
        imgWell.innerHTML = '<div style="color:#606060; font-size:10px; font-style:italic;">No plot image.</div>';
    }

    canvasWell.appendChild(imgWell);
}

// Binds actions
export function initMlControls() {
    const modelType = document.getElementById('ml-model-type');
    if (modelType) {
        modelType.onchange = () => handleMlModelTypeChange();
    }
    
    const trainBtn = document.querySelector('#page-ml .xp-btn-success');
    if (trainBtn) {
        trainBtn.onclick = () => trainAndVisualizeMlModel();
    }
}

function showNotification(title, message) {
    if (window.showNotification) {
        window.showNotification(title, message);
    }
}
