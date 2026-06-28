/**
 * DataPrep Studio - API Client Layer
 * Handles communication with the FastAPI backend.
 */

const BASE_URL = ""; // Relative path to target same origin

export async function uploadFile(file, delimiter, hasHeaders) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("delimiter", delimiter);
    formData.append("has_headers", hasHeaders ? "true" : "false");

    const response = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: formData
    });
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Upload failed.");
    }
    return response.json();
}

export async function loadSample() {
    const response = await fetch(`${BASE_URL}/api/load_sample`, {
        method: "POST"
    });
    if (!response.ok) {
        throw new Error("Failed to load sample dataset.");
    }
    return response.json();
}

export async function getDashboard() {
    const response = await fetch(`${BASE_URL}/api/dashboard`);
    if (!response.ok) {
        throw new Error("Failed to fetch dashboard summary.");
    }
    return response.json();
}

export async function getProfile() {
    const response = await fetch(`${BASE_URL}/api/profile`);
    if (!response.ok) {
        throw new Error("Failed to fetch data profile.");
    }
    return response.json();
}

export async function getCategoricalProfile(column) {
    const response = await fetch(`${BASE_URL}/api/profile/categorical?column=${encodeURIComponent(column)}`);
    if (!response.ok) {
        throw new Error("Failed to fetch categorical profile.");
    }
    return response.json();
}

export async function getGrid(page = 1, pageSize = 10, search = "", sortCol = "", sortAsc = true) {
    const url = `${BASE_URL}/api/grid?page=${page}&page_size=${pageSize}&search=${encodeURIComponent(search)}&sort_col=${encodeURIComponent(sortCol)}&sort_asc=${sortAsc ? "true" : "false"}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch grid records.");
    }
    return response.json();
}

export async function editCell(rowId, column, value) {
    const formData = new FormData();
    formData.append("row_id", rowId);
    formData.append("column", column);
    formData.append("value", value);

    const response = await fetch(`${BASE_URL}/api/edit`, {
        method: "POST",
        body: formData
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Edit cell failed.");
    }
    return response.json();
}

export async function applyClean(action, params = {}) {
    const formData = new FormData();
    formData.append("action", action);
    for (const key in params) {
        formData.append(key, params[key]);
    }

    const response = await fetch(`${BASE_URL}/api/clean`, {
        method: "POST",
        body: formData
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Cleaning operation failed.");
    }
    return response.json();
}

export async function undoClean() {
    const response = await fetch(`${BASE_URL}/api/clean/undo`, { method: "POST" });
    if (!response.ok) {
        throw new Error("Undo failed.");
    }
    return response.json();
}

export async function redoClean() {
    const response = await fetch(`${BASE_URL}/api/clean/redo`, { method: "POST" });
    if (!response.ok) {
        throw new Error("Redo failed.");
    }
    return response.json();
}

export async function resetClean() {
    const response = await fetch(`${BASE_URL}/api/clean/reset`, { method: "POST" });
    if (!response.ok) {
        throw new Error("Reset failed.");
    }
    return response.json();
}

export async function getCharts(chartType, xCol, yCol, filterCol, filterVal) {
    const formData = new FormData();
    formData.append("chart_type", chartType);
    formData.append("x_col", xCol);
    formData.append("y_col", yCol);
    formData.append("filter_col", filterCol);
    formData.append("filter_val", filterVal);

    const response = await fetch(`${BASE_URL}/api/charts`, {
        method: "POST",
        body: formData
    });
    if (!response.ok) {
        throw new Error("Failed to generate chart graphics.");
    }
    return response.json();
}

export async function trainMl(modelType, targetCol, featureCols, trainSplit) {
    const formData = new FormData();
    formData.append("model_type", modelType);
    formData.append("target_col", targetCol);
    formData.append("feature_cols", JSON.stringify(featureCols));
    formData.append("train_split", trainSplit);

    const response = await fetch(`${BASE_URL}/api/ml`, {
        method: "POST",
        body: formData
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "ML Model training failed.");
    }
    return response.json();
}

export async function getReportHtml() {
    const response = await fetch(`${BASE_URL}/api/report/html`);
    if (!response.ok) {
        throw new Error("Failed to generate HTML report.");
    }
    return response.text();
}
