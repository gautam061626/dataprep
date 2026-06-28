/**
 * DataPrep Studio - Welcome Page Controller
 */

import { AppState, syncState } from '../frontend/js/state.js';
import * as API from '../frontend/js/api.js';

export function initWelcomePage(navigateCallback) {
    const fileUploader = document.getElementById('file-uploader-landing');
    const dropzone = document.getElementById('dropzone-landing');

    window.handleFileSelect = async (e) => {
        const target = (e && e.target) ? e.target : e;
        const file = (target && target.files) ? target.files[0] : null;
        if (file) {
            await processUpload(file, navigateCallback);
        }
    };

    window.loadDefaultMockupDataset = async () => {
        try {
            showStatusBarLoader(true);
            const res = await API.loadSample();
            syncState(res);
            showNotification("Success", "Loaded Customer Churn dataset successfully.");
            navigateCallback('dashboard');
        } catch (err) {
            alert("Error loading sample dataset: " + err.message);
        } finally {
            showStatusBarLoader(false);
        }
    };

    if (fileUploader) {
        fileUploader.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await processUpload(file, navigateCallback);
            }
        };
    }

    if (dropzone) {
        dropzone.ondragover = (e) => {
            e.preventDefault();
            dropzone.style.backgroundColor = '#EEF3FF';
        };

        dropzone.ondragleave = () => {
            dropzone.style.backgroundColor = '';
        };

        dropzone.ondrop = async (e) => {
            e.preventDefault();
            dropzone.style.backgroundColor = '';
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                await processUpload(file, navigateCallback);
            }
        };
    }

    // Default mock dataset load button
    const loadSampleBtn = document.querySelector('.xp-btn-success');
    if (loadSampleBtn) {
        loadSampleBtn.onclick = async () => {
            try {
                showStatusBarLoader(true);
                const res = await API.loadSample();
                syncState(res);
                showNotification("Success", "Loaded Customer Churn dataset successfully.");
                navigateCallback('dashboard');
            } catch (err) {
                alert("Error loading sample dataset: " + err.message);
            } finally {
                showStatusBarLoader(false);
            }
        };
    }
}

async function processUpload(file, navigateCallback) {
    const delimEl = document.getElementById('upload-delimiter-config');
    const headersEl = document.getElementById('upload-has-headers');

    const delimiter = delimEl ? delimEl.value : ",";
    const hasHeaders = headersEl ? headersEl.checked : true;

    try {
        showStatusBarLoader(true);
        const res = await API.uploadFile(file, delimiter, hasHeaders);
        syncState(res);
        showNotification("Upload Complete", `Successfully uploaded "${file.name}"`);
        navigateCallback('dashboard');
    } catch (err) {
        alert("Upload Error: " + err.message);
    } finally {
        showStatusBarLoader(false);
    }
}

function showStatusBarLoader(show) {
    const runningIndicator = document.getElementById('status-running-state');
    if (runningIndicator) {
        if (show) {
            runningIndicator.innerHTML = '<span class="state-indicator warn">●</span> Working...';
        } else {
            runningIndicator.innerHTML = '<span class="state-indicator success">●</span> Ready';
        }
    }
}

function showNotification(title, message) {
    if (window.showNotification) {
        window.showNotification(title, message);
    }
}
