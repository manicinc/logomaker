/**
 * @file GIFRenderer.js (AnimationExporterUI - v3 - Snapshot/SVG Options)
 * @description Manages the UI and process for exporting animations as a sequence of PNG frames in a ZIP package.
 * Offers two rendering methods: SVG-based (fast, vector) and HTML2Canvas Snapshot (accurate WYSIWYG, requires library, slower).
 */

// Core Rendering & Utilities
import { generateAnimationFrames as generateSvgAnimationFrames, generateConsistentPreview, blobToDataURL } from './RendererCore.js'; // Use core functions for SVG-based frames
import { captureLogoWithHTML2Canvas } from '../utils/html2Canvas.js'; // For Snapshot rendering
import { createSimpleUncompressedZip, downloadZipBlob } from '../utils/zipUtils.js'; // Custom ZIP functions
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js'; // For metadata
import { captureAdvancedStyles } from '../captureTextStyles.js'; // For metadata

// --- Module Scope Variables ---
let exportCancelled = false;
let previewInterval = null;
let previewFramesDataUrls = []; // Store data URLs for preview loop
let currentPreviewFrameIndex = 0;
let isExporting = false;
let isInitialized = false; // Track if UI is injected and listeners attached
let html2canvasAvailable = false; // Track if snapshot rendering is possible
const MODAL_ID = 'gifExporterModal'; // Consistent ID for elements
const STYLE_ID = 'gifExporterStylesV3'; // Updated Style ID

// --- DOM Element References ---
let modal = null, closeBtn = null, cancelBtn = null, exportBtn = null;
let previewImage = null, loadingIndicator = null, progressText = null;
let cancelExportBtnModal = null, modalWidthInput = null, modalHeightInput = null;
let modalFramesInput = null, modalTransparentInput = null, modalFrameRateInput = null;
let modalFrameRateValue = null, previewLoadingSpinner = null;
let svgRenderRadio = null, snapshotRenderRadio = null; // <-- New: Render method radios
let snapshotWarning = null; // <-- New: Warning text for snapshot mode

// --- CSS (Updated with radio buttons and snapshot warning) ---
const MODAL_CSS = `
/* Styles for GIF Exporter Modal (v3 - Snapshot/SVG Options) */
:root {
    --gif-exporter-accent: #ff1493; /* Deep Pink */
    --gif-exporter-bg-dark: #0f0f1a; /* Darker background */
    --gif-exporter-bg-medium: #1a1a2e; /* Medium dark */
    --gif-exporter-text-light: #e8e8ff; /* Light text */
    --gif-exporter-text-medium: #b0b0e0; /* Muted text */
    --gif-exporter-border-color: #3a3a4a; /* Softer border */
    --gif-exporter-warning-color: #ffcc00; /* Yellow for warnings */
}
.gif-exporter-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(10, 10, 20, 0.9); /* Slightly less dark */
    display: none; /* Modified by JS */
    justify-content: center; align-items: center;
    z-index: 1001; padding: 2vh 2vw; box-sizing: border-box;
    backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
    overflow: hidden;
}
.gif-exporter-modal-content {
    background: linear-gradient(145deg, var(--gif-exporter-bg-medium), var(--gif-exporter-bg-dark));
    color: var(--gif-exporter-text-light);
    padding: 25px 35px; /* Adjusted padding */
    border-radius: 10px; /* Slightly less rounded */
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(var(--gif-exporter-accent), 0.2);
    width: 100%; height: 100%; max-width: 1100px; max-height: 92vh; /* Adjusted max */
    position: relative; border: 1px solid var(--gif-exporter-border-color);
    display: flex; flex-direction: column; overflow: hidden;
}
.gif-exporter-modal-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 15px; /* Reduced margin */
    border-bottom: 1px solid var(--gif-exporter-accent);
    padding-bottom: 12px; flex-shrink: 0;
}
.gif-exporter-modal-header h2 {
    margin: 0; font-size: 1.6em; /* Adjusted size */
    font-weight: 600; /* Slightly less bold */
    color: var(--gif-exporter-accent);
    text-shadow: 0 0 4px rgba(255, 20, 147, 0.4);
    font-family: 'Orbitron', sans-serif; /* Example */
}
.gif-exporter-modal-close-btn {
    background: none; border: none; color: #aaa; font-size: 2.2em; /* Adjusted size */
    line-height: 1; cursor: pointer; padding: 0 5px; transition: color 0.3s ease, transform 0.3s ease;
}
.gif-exporter-modal-close-btn:hover { color: var(--gif-exporter-accent); transform: rotate(90deg); }
.gif-exporter-modal-body {
    flex-grow: 1; display: flex; gap: 25px; /* Adjusted gap */
    overflow: hidden; padding-bottom: 15px; /* Reduced padding */
}
.gif-exporter-preview-area {
    flex: 1.8; display: flex; /* Adjusted flex ratio */
    flex-direction: column; justify-content: center; align-items: center;
    background-color: rgba(0, 0, 0, 0.2); border-radius: 6px; /* Smaller radius */
    padding: 15px; overflow: hidden; border: 1px solid var(--gif-exporter-border-color);
    min-height: 280px; position: relative; /* Adjusted height */
}
.gif-exporter-preview-image-container {
    width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;
    position: relative;
    /* Checkerboard background */
    background-image: linear-gradient(45deg, #2a2a40 25%, transparent 25%), linear-gradient(-45deg, #2a2a40 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a40 75%), linear-gradient(-45deg, transparent 75%, #2a2a40 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    border-radius: 4px;
}
.gif-exporter-preview-spinner {
    border: 4px solid rgba(255, 255, 255, 0.15); /* Lighter border */
    border-left-color: var(--gif-exporter-accent);
    border-radius: 50%; width: 35px; height: 35px; /* Slightly smaller */
    animation: gif-exporter-spin 0.8s linear infinite; /* Faster spin */
    position: absolute; top: calc(50% - 17.5px); left: calc(50% - 17.5px); z-index: 1;
}
.gif-exporter-preview-image {
    max-width: 100%; max-height: 280px; /* Match container min-height */
    object-fit: contain; background-color: transparent;
    min-height: 50px; display: block; opacity: 1; position: relative; z-index: 2;
    transition: opacity 0.3s ease; /* Smooth transition */
}
.gif-exporter-preview-image[src=""] { opacity: 0; } /* Hide if src is empty */

.gif-exporter-controls-area {
    flex: 1; display: flex; flex-direction: column; gap: 15px; /* Adjusted gap */
    overflow-y: auto; padding-right: 10px; padding-left: 15px; /* Adjusted padding */
}
.gif-exporter-controls-area .control-group { display: flex; flex-direction: column; gap: 6px; } /* Adjusted gap */
.gif-exporter-controls-area label { font-weight: 500; color: var(--gif-exporter-text-medium); font-size: 0.9em; display: block; margin-bottom: 3px; }
.gif-exporter-controls-area input[type="number"], .gif-exporter-controls-area input[type="range"] { width: 100%; padding: 8px 10px; background-color: #252535; border: 1px solid #4a4a5a; color: var(--gif-exporter-text-light); border-radius: 4px; font-size: 0.95em; box-sizing: border-box; transition: border-color 0.2s; }
.gif-exporter-controls-area input[readonly] {
    background-color: #1e1e2b; color: #888; cursor: not-allowed; border-style: dashed; opacity: 0.7;
}
.gif-exporter-controls-area input:focus:not([readonly]) { border-color: var(--gif-exporter-accent); outline: none; }
.gif-exporter-controls-area input[type="range"] { padding: 0; cursor: pointer; height: 18px; accent-color: var(--gif-exporter-accent); }
.gif-exporter-controls-area .range-container { display: flex; align-items: center; gap: 8px; }
.gif-exporter-controls-area .range-container input[type="range"] { flex-grow: 1; }
.gif-exporter-controls-area .range-container span { font-size: 0.8em; color: var(--gif-exporter-text-medium); min-width: 45px; text-align: right; } /* Slightly narrower */
.gif-exporter-controls-area .checkbox-label { display: flex; align-items: center; cursor: pointer; color: var(--gif-exporter-text-medium); padding: 5px 0; }
.gif-exporter-controls-area .checkbox-label:hover { color: var(--gif-exporter-text-light); }
.gif-exporter-controls-area input[type="checkbox"] { width: 15px; height: 15px; margin-right: 8px; accent-color: var(--gif-exporter-accent); vertical-align: middle; cursor: pointer; flex-shrink: 0; }
.gif-exporter-controls-area .checkbox-label label { margin-bottom: 0; } /* Override potential default label margin */

/* Styles for Export Method Selection */
.gif-export-method-selector {
    margin-top: 10px; padding: 15px;
    background-color: rgba(0,0,0,0.1);
    border-radius: 6px;
    border: 1px solid var(--gif-exporter-border-color);
}
.gif-export-method-selector legend {
    font-weight: 600; padding: 0 5px; margin-bottom: 10px;
    font-size: 0.95em; color: var(--gif-exporter-text-light);
}
.gif-export-method-selector .radio-option { display: flex; align-items: flex-start; margin-bottom: 10px; cursor: pointer; }
.gif-export-method-selector input[type="radio"] { margin-right: 10px; margin-top: 3px; /* Align better with text */ accent-color: var(--gif-exporter-accent); cursor: pointer; flex-shrink: 0; }
.gif-export-method-selector label { font-size: 0.9em; color: var(--gif-exporter-text-medium); cursor: pointer; line-height: 1.3; }
.gif-export-method-selector label strong { color: var(--gif-exporter-text-light); font-weight: 500; }
.gif-export-method-selector label span { font-size: 0.85em; color: var(--gif-exporter-text-medium); display: block; /* Indent description */ }
.gif-export-method-selector input[type="radio"]:disabled + label { cursor: not-allowed; opacity: 0.6; }
.gif-export-method-selector .snapshot-warning {
    font-size: 0.85em; color: var(--gif-exporter-warning-color); margin-top: 5px; padding: 8px;
    background: rgba(255, 204, 0, 0.1); border-left: 3px solid var(--gif-exporter-warning-color); border-radius: 3px;
    display: none; /* Shown by JS if snapshot is selected */
}

.gif-exporter-controls-area .info-text-block { /* Specific style for info text */
    font-size: 0.85em; color: var(--gif-exporter-text-medium); margin-top: 10px; line-height: 1.4;
    padding: 10px; background: rgba(0,0,0,0.1); border-radius: 4px; border-left: 3px solid var(--gif-exporter-accent);
}

.gif-exporter-modal-footer { margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--gif-exporter-border-color); display: flex; justify-content: flex-end; align-items: center; gap: 12px; flex-shrink: 0; }
.gif-exporter-modal-btn { padding: 9px 20px; font-size: 0.9em; font-weight: 600; border: none; border-radius: 5px; cursor: pointer; transition: all 0.2s ease; text-transform: uppercase; letter-spacing: 0.5px; }
.gif-exporter-modal-btn-primary { background-color: var(--gif-exporter-accent); color: #fff; box-shadow: 0 2px 6px rgba(255, 20, 147, 0.2); }
.gif-exporter-modal-btn-primary:hover:not(:disabled) { background-color: #ff47a3; box-shadow: 0 3px 10px rgba(255, 20, 147, 0.35); transform: translateY(-1px); }
.gif-exporter-modal-btn-primary:disabled { background-color: #7a0a47; cursor: not-allowed; opacity: 0.6; }
.gif-exporter-modal-btn-secondary { background-color: #4a4a5a; color: #ccc; }
.gif-exporter-modal-btn-secondary:hover { background-color: #5a5a6a; color: #fff; }
/* Main loading overlay during export */
.gif-exporter-loading-indicator {
    position: absolute; inset: 0; background: rgba(10, 10, 20, 0.9); display: none; /* Toggled by JS */ justify-content: center; align-items: center; z-index: 1002; flex-direction: column; gap: 15px; color: var(--gif-exporter-text-light); text-align: center; border-radius: 12px; font-size: 1.1em;
}
.gif-exporter-loading-indicator .progress-text { font-weight: 500; margin-top: 5px; }
.gif-exporter-loading-indicator .cancel-export-btn-modal { margin-top: 15px; padding: 8px 18px; background-color: #b71c1c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; transition: background-color 0.2s ease; display: none; /* Shown by JS */ }
.gif-exporter-loading-indicator .cancel-export-btn-modal:hover { background-color: #d32f2f; }
.gif-exporter-loading-indicator .gif-exporter-spinner { border: 4px solid rgba(255, 255, 255, 0.15); border-left-color: var(--gif-exporter-accent); border-radius: 50%; width: 35px; height: 35px; animation: gif-exporter-spin 0.8s linear infinite; }
@keyframes gif-exporter-spin { to { transform: rotate(360deg); } }
/* Scrollbar */
.gif-exporter-controls-area::-webkit-scrollbar { width: 8px; }
.gif-exporter-controls-area::-webkit-scrollbar-track { background: var(--gif-exporter-bg-dark); border-radius: 4px; }
.gif-exporter-controls-area::-webkit-scrollbar-thumb { background-color: var(--gif-exporter-accent); border-radius: 4px; border: 2px solid var(--gif-exporter-bg-dark); }
`;

// --- HTML Structure (Updated with render method selection) ---
const MODAL_HTML = `
<div id="${MODAL_ID}" class="gif-exporter-modal-overlay">
  <div class="gif-exporter-modal-content">
    <div class="gif-exporter-modal-header">
      <h2>Animation Exporter (PNG Frames ZIP)</h2>
      <button id="${MODAL_ID}CloseBtn" class="gif-exporter-modal-close-btn" title="Close Export Modal">&times;</button>
    </div>
    <div class="gif-exporter-modal-body">
      <div class="gif-exporter-preview-area">
        <div class="gif-exporter-preview-image-container">
             <div id="${MODAL_ID}PreviewSpinner" class="gif-exporter-preview-spinner" style="display: none;"></div>
             <img id="${MODAL_ID}PreviewImage" src="" alt="Animation Preview Area" class="gif-exporter-preview-image" style="opacity: 0;">
        </div>
      </div>
      <div class="gif-exporter-controls-area">
        <div class="control-group">
          <label for="${MODAL_ID}Width">Width (px)</label>
          <input type="number" id="${MODAL_ID}Width" value="800" readonly title="Output width is synced from Export settings.">
        </div>
        <div class="control-group">
          <label for="${MODAL_ID}Height">Height (px)</label>
          <input type="number" id="${MODAL_ID}Height" value="400" readonly title="Output height is synced from Export settings.">
        </div>

        <fieldset class="gif-export-method-selector">
            <legend>Render Method:</legend>
            <div class="radio-option">
                <input type="radio" id="${MODAL_ID}MethodSvg" name="gifExportMethod" value="svgRender" checked>
                <label for="${MODAL_ID}MethodSvg">
                    <strong>SVG Render</strong> (Fast, Vector Based)
                    <span>Generates frames from SVG data. Faster, fully offline, but may not capture all complex CSS effects perfectly.</span>
                </label>
            </div>
            <div class="radio-option">
                <input type="radio" id="${MODAL_ID}MethodSnapshot" name="gifExportMethod" value="snapshot">
                <label for="${MODAL_ID}MethodSnapshot">
                    <strong>Snapshot</strong> (Accurate, WYSIWYG)
                    <span>Takes a snapshot of the live preview using html2canvas. Captures appearance exactly, but is <strong>much slower</strong> and requires the library to be loaded.</span>
                    <div id="${MODAL_ID}SnapshotWarning" class="snapshot-warning">
                        <strong>Warning:</strong> Snapshot rendering can be very slow, especially with many frames. Limit frames for reasonable export times.
                    </div>
                </label>
            </div>
        </fieldset>

        <div class="control-group">
          <label for="${MODAL_ID}Frames">Frames (SVG: 1-60, Snapshot: 1-30)</label>
          <input type="number" id="${MODAL_ID}Frames" min="1" max="60" value="15" title="Number of PNG frames. Max 60 for SVG, Max 30 for Snapshot recommended.">
        </div>
         <div class="control-group">
            <label for="${MODAL_ID}FrameRate">Preview Speed (FPS)</label>
            <div class="range-container">
              <input type="range" id="${MODAL_ID}FrameRate" min="1" max="30" value="10" step="1" title="Adjust ONLY the speed of THIS preview animation. Does not affect exported frames.">
              <span id="${MODAL_ID}FrameRateValue" class="range-value-display">10 FPS</span>
            </div>
          </div>
        <label class="checkbox-label control-group">
             <input type="checkbox" id="${MODAL_ID}Transparent">
             <label for="${MODAL_ID}Transparent" title="Export frames with transparent background instead of current style.">Transparent Background</label>
        </label>
        <div class="control-group info-text-block">
             <p>
                <strong>Note:</strong> This exports a <strong>ZIP file containing individual PNG frames</strong> and an HTML preview file.<br>
                Choose <strong>SVG Render</strong> for speed and basic animations, or <strong>Snapshot</strong> for capturing complex CSS effects accurately (slower, requires html2canvas).<br>
                Use external tools (e.g., ezgif.com) to combine frames into a GIF/APNG/Video.
             </p>
        </div>
      </div>
    </div>
    <div class="gif-exporter-modal-footer">
      <button id="${MODAL_ID}CancelBtn" class="gif-exporter-modal-btn gif-exporter-modal-btn-secondary">Close</button>
      <button id="${MODAL_ID}ExportBtn" class="gif-exporter-modal-btn gif-exporter-modal-btn-primary">Export Frames as ZIP</button>
    </div>
    <div id="${MODAL_ID}LoadingIndicator" class="gif-exporter-loading-indicator">
      <div class="gif-exporter-spinner"></div>
      <div class="progress-text" id="${MODAL_ID}ProgressText">Preparing...</div>
      <button id="${MODAL_ID}CancelExportBtn" class="cancel-export-btn-modal">Cancel Export</button>
    </div>
  </div>
</div>`;

// --- Internal Functions ---

/** Check if html2canvas dependency is met */
function checkDependencies() {
    if (typeof captureLogoWithHTML2Canvas === 'function') {
        html2canvasAvailable = true;
        console.log('[GIF UI] Dependency Check: html2canvas (via captureLogoWithHTML2Canvas) FOUND.');
    } else {
        html2canvasAvailable = false;
        console.warn('[GIF UI] Dependency Check: html2canvas (via captureLogoWithHTML2Canvas) NOT FOUND. Snapshot method will be disabled.');
    }
}

function injectStyles() {
    if (!document.getElementById(STYLE_ID) && MODAL_CSS) {
        const styleElement = document.createElement('style');
        styleElement.id = STYLE_ID;
        styleElement.textContent = MODAL_CSS;
        document.head.appendChild(styleElement);
        console.log('[GIF UI] Styles Injected.');
    }
}

function injectModalHTML() {
    if (document.getElementById(MODAL_ID)) return;
    const container = document.createElement('div');
    container.innerHTML = MODAL_HTML.trim();
    const modalElement = container.firstChild;
    if (modalElement instanceof Node) {
        document.body.appendChild(modalElement);
        console.log('[GIF UI] Modal HTML Injected.');
    } else { throw new Error("Failed to create modal element from HTML string."); }
}

function queryModalElements() {
    modal = document.getElementById(MODAL_ID); if (!modal) return false;
    closeBtn = document.getElementById(`${MODAL_ID}CloseBtn`); if (!closeBtn) return false;
    cancelBtn = document.getElementById(`${MODAL_ID}CancelBtn`); if (!cancelBtn) return false;
    exportBtn = document.getElementById(`${MODAL_ID}ExportBtn`); if (!exportBtn) return false;
    previewImage = document.getElementById(`${MODAL_ID}PreviewImage`); if (!previewImage) return false;
    loadingIndicator = document.getElementById(`${MODAL_ID}LoadingIndicator`); if (!loadingIndicator) return false;
    progressText = document.getElementById(`${MODAL_ID}ProgressText`); if (!progressText) return false;
    cancelExportBtnModal = document.getElementById(`${MODAL_ID}CancelExportBtn`); if (!cancelExportBtnModal) return false;
    modalWidthInput = document.getElementById(`${MODAL_ID}Width`); if (!modalWidthInput) return false;
    modalHeightInput = document.getElementById(`${MODAL_ID}Height`); if (!modalHeightInput) return false;
    modalFramesInput = document.getElementById(`${MODAL_ID}Frames`); if (!modalFramesInput) return false;
    modalTransparentInput = document.getElementById(`${MODAL_ID}Transparent`); if (!modalTransparentInput) return false;
    modalFrameRateInput = document.getElementById(`${MODAL_ID}FrameRate`); if (!modalFrameRateInput) return false;
    modalFrameRateValue = document.getElementById(`${MODAL_ID}FrameRateValue`); if (!modalFrameRateValue) return false;
    previewLoadingSpinner = document.getElementById(`${MODAL_ID}PreviewSpinner`); if (!previewLoadingSpinner) return false;
    // New elements
    svgRenderRadio = document.getElementById(`${MODAL_ID}MethodSvg`); if (!svgRenderRadio) return false;
    snapshotRenderRadio = document.getElementById(`${MODAL_ID}MethodSnapshot`); if (!snapshotRenderRadio) return false;
    snapshotWarning = document.getElementById(`${MODAL_ID}SnapshotWarning`); if (!snapshotWarning) return false;

    console.log('[GIF UI] Modal elements queried successfully.');
    return true;
}

function openModal() {
    if (!isInitialized || !modal) { const msg = "Animation exporter UI not ready or missing."; console.error(`[GIF UI] ${msg}`); if (typeof showAlert === 'function') showAlert(msg, "error"); throw new Error(msg); }
    console.log("[GIF UI] Opening Modal...");
    resetCancelFlag(); isExporting = false; exportBtn.disabled = false; cancelBtn.disabled = false; cancelExportBtnModal.style.display = 'none'; hideModalProgress();

    // Update UI based on html2canvas availability
    if (snapshotRenderRadio) {
        snapshotRenderRadio.disabled = !html2canvasAvailable;
        const label = snapshotRenderRadio.nextElementSibling; // Assuming label follows input
        if (label && !html2canvasAvailable) {
           label.title = "Snapshot rendering requires the html2canvas library, which was not found.";
           // Ensure SVG is selected if snapshot is disabled
           if(svgRenderRadio) svgRenderRadio.checked = true;
        } else if (label) {
            label.title = ""; // Clear title if available
        }
        updateSnapshotWarningVisibility(); // Initial check
        updateFramesInputLimit(); // Update frame limit based on default method
    }

    syncExportSettings(); // Sync read-only settings & defaults
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('active'));
    document.body.style.overflow = 'hidden';
    startPreviewLoop(); // Start preview (generates frames internally based on selected method)
}

function closeModal() {
    if (!modal) return;
    stopPreview(); // Stop animation loop
    hideModalProgress();
    modal.classList.remove('active');
    modal.addEventListener('transitionend', () => {
        if (!modal.classList.contains('active')) modal.style.display = 'none'; document.body.style.overflow = '';
    }, { once: true });
    setTimeout(() => { if (!modal.classList.contains('active')) { modal.style.display = 'none'; document.body.style.overflow = ''; }}, 500);
    if (isExporting) cancelExport(); // Attempt to cancel if closing during export
    console.log("[GIF UI] Modal closed.");
}

/** Reset the cancellation flag */
function resetCancelFlag() { exportCancelled = false; console.log('[GIF UI] Cancel flag reset.'); }
/** Show the modal's loading overlay with a message */
function updateModalProgress(message) { if (loadingIndicator && progressText) { loadingIndicator.style.display = 'flex'; progressText.textContent = message; } }
/** Hide the modal's loading overlay */
function hideModalProgress() { if (loadingIndicator) loadingIndicator.style.display = 'none'; }
/** Convert a Blob to a Data URL string */
// async function blobToDataURL(blob) { ... } // Already imported from RendererCore

/** Debounce function */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func.apply(this, args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/** Update visibility of the snapshot performance warning */
function updateSnapshotWarningVisibility() {
    if (!snapshotWarning || !snapshotRenderRadio) return;
    snapshotWarning.style.display = snapshotRenderRadio.checked ? 'block' : 'none';
}

/** Update max attribute of frames input based on selected method */
function updateFramesInputLimit() {
    if (!modalFramesInput || !snapshotRenderRadio) return;
    const isSnapshot = snapshotRenderRadio.checked;
    const maxFrames = isSnapshot ? 30 : 60;
    const currentVal = parseInt(modalFramesInput.value);

    modalFramesInput.max = maxFrames;
    modalFramesInput.title = `Number of PNG frames. Max ${maxFrames} for ${isSnapshot ? 'Snapshot' : 'SVG'} method.`;

    // Adjust current value if it exceeds the new max
    if (currentVal > maxFrames) {
        modalFramesInput.value = maxFrames;
        console.log(`[GIF UI] Frame count adjusted to new max: ${maxFrames}`);
    }

    const label = modalFramesInput.previousElementSibling; // Assuming label is previous sibling
    if (label) {
        label.textContent = `Frames (1-${maxFrames})`;
    }
}


/** Generate frames specifically for the preview loop, considering render method */
async function generatePreviewFrames() {
    const selectedMethod = snapshotRenderRadio?.checked ? 'snapshot' : 'svg';
    console.log(`[GIF UI] Generating preview frames using: ${selectedMethod}...`);

    previewFramesDataUrls = [];
    stopPreview(); // Stop existing loop
    if (previewLoadingSpinner) previewLoadingSpinner.style.display = 'block';
    if (previewImage) previewImage.style.opacity = 0;

    // Limit preview frames MORE for snapshot due to performance
    const maxPreviewFrames = selectedMethod === 'snapshot' ? 8 : 15;
    const frameCount = Math.min(parseInt(modalFramesInput?.value || 15), maxPreviewFrames);
    const transparent = modalTransparentInput?.checked || false;
    const width = parseInt(modalWidthInput?.value || 400); // Use synced dimensions for consistency
    const height = parseInt(modalHeightInput?.value || 300);

    try {
        console.log(`[GIF UI] Preview Params: Method=${selectedMethod}, ${frameCount} frames, ${width}x${height}, Transparent: ${transparent}`);

        let frameBlobs = [];

        if (selectedMethod === 'snapshot') {
            if (!html2canvasAvailable) {
                throw new Error("Snapshot preview failed: html2canvas function not found.");
            }
            // --- Snapshot Preview Generation (Simplified - No Animation State Change) ---
            // This is a *massive* simplification for preview performance. It captures the *current* state N times.
            // A true preview would need to apply animation delay/state before each capture, which is too slow here.
            // We'll just capture the first frame N times to give *a* preview image.
             console.warn("[GIF UI] Snapshot Preview: Capturing static frame multiple times for preview due to performance constraints.");
             const elementToSnapshot = document.querySelector('#previewContainer'); // Or the appropriate element
             if (!elementToSnapshot) throw new Error("Snapshot preview failed: Preview container not found.");

             // Use smaller dimensions/scale for snapshot preview to keep it fast
             const snapshotOptions = {
                width, height, transparentBackground: transparent,
                scale: window.devicePixelRatio // Lower scale for preview?
             };
             updateModalProgress(`Generating snapshot preview (1 frame)...`); // Update progress text
             const canvas = await captureLogoWithHTML2Canvas(elementToSnapshot, snapshotOptions);
             const singleBlob = await new Promise((resolve, reject) => {
                 canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed for preview')), 'image/png');
              });
             // Fill the array with the same blob
             frameBlobs = Array(frameCount).fill(singleBlob);
             console.log("[GIF UI] Snapshot preview generated (static frame replicated).");
            // --- End Snapshot Preview ---

        } else {
            // --- SVG Preview Generation (Uses existing Core function) ---
             updateModalProgress(`Generating SVG preview frames (0%)...`); // Update progress text
             frameBlobs = await generateSvgAnimationFrames({ // Use imported SVG version
                 width, height, frameCount, transparent,
                 onProgress: (prog, msg) => {
                     updateModalProgress(msg || `Generating preview frames (${Math.round(prog*100)}%)...`);
                 }
             });
            // --- End SVG Preview ---
        }

        if (!frameBlobs || frameBlobs.length === 0) throw new Error("No preview frames generated");

        console.log(`[GIF UI] Converting ${frameBlobs.length} preview blobs to data URLs...`);
        previewFramesDataUrls = await Promise.all(frameBlobs.map(blob => blobToDataURL(blob)));
        console.log(`[GIF UI] Generated ${previewFramesDataUrls.length} preview frame data URLs.`);

    } catch (error) {
        console.error("[GIF UI] Preview frame generation error:", error);
        previewFramesDataUrls = [];
        if (typeof showAlert === 'function') showAlert(`Preview failed (${selectedMethod}): ${error.message}`, 'warning');
        updateModalProgress(`Preview Failed!`); // Show error in progress text
    } finally {
        if (previewLoadingSpinner) previewLoadingSpinner.style.display = 'none';
        if (previewImage) previewImage.style.opacity = 1; // Show image area again
        // Don't hide modal progress here, let the caller handle final state
        console.log("[GIF UI] Preview frame generation finished.");
    }
}

/** Start the preview animation loop */
async function startPreviewLoop() {
    console.log('[GIF UI] Attempting to start preview loop...');
    stopPreview();
    hideModalProgress(); // Hide any previous progress messages before generating new preview
    await generatePreviewFrames(); // Generate/Re-generate frames based on current settings

    if (!previewImage || previewFramesDataUrls.length === 0) {
        console.error("[GIF UI] No preview frames or image element available. Cannot start loop.");
        if (previewImage) { previewImage.src = ''; previewImage.alt = "Preview unavailable"; }
        return;
    }

    currentPreviewFrameIndex = 0;
    previewImage.src = previewFramesDataUrls[0];
    previewImage.alt = "Animation Preview";
    previewImage.style.opacity = 1; // Ensure visible

    const fr = parseInt(modalFrameRateInput?.value || 10);
    const intervalTime = 1000 / Math.max(1, fr);
    console.log(`[GIF UI] Starting preview loop interval (${fr} FPS -> ${intervalTime.toFixed(1)}ms)`);

    previewInterval = setInterval(() => {
        if (!previewImage || previewFramesDataUrls.length === 0) { stopPreview(); return; }
        currentPreviewFrameIndex = (currentPreviewFrameIndex + 1) % previewFramesDataUrls.length;
        previewImage.src = previewFramesDataUrls[currentPreviewFrameIndex];
    }, intervalTime);
}


/** Stop the preview animation loop */
function stopPreview() {
    if (previewInterval) {
        clearInterval(previewInterval);
        previewInterval = null;
        console.log('[GIF UI] Preview loop stopped.');
    }
}

/** Core logic for generating export frames via SVG Render method */
async function internalExportFramesSVG(options = {}) {
    const { width=800, height=400, frameCount=15, transparent=false, onProgress } = options;
    console.log(`[GIF Core SVG] Generating ${frameCount} export frames (${width}x${height}). Transparent: ${transparent}`);
    if (exportCancelled) throw new Error("Export cancelled");
    try {
        // Directly use the core SVG-based frame generation function
        const frames = await generateSvgAnimationFrames({ width, height, frameCount, transparent, onProgress }); // Use imported SVG version
        if (exportCancelled) throw new Error("Export cancelled");
        if (!frames || frames.length === 0) throw new Error("Frame generation yielded no results");
        console.log(`[GIF Core SVG] Generated ${frames.length} export frame blobs.`);
        return frames;
    } catch (error) {
        console.error('[GIF Core SVG] Error generating export frames:', error);
        if (error.message === "Export cancelled") throw error;
        throw new Error(`SVG Frame Generation Failed: ${error.message}`);
    }
}

/** Core logic for generating export frames via Snapshot method */
async function internalExportFramesSnapshot(options = {}) {
    const { width=800, height=400, frameCount=15, transparent=false, onProgress } = options;
    console.log(`[GIF Core Snapshot] Generating ${frameCount} export frames (${width}x${height}). Transparent: ${transparent}`);
    if (exportCancelled) throw new Error("Export cancelled");
    if (!html2canvasAvailable) throw new Error("Snapshot export failed: html2canvas library not found.");

    const frames = [];
    const baseAnimationMetadata = extractSVGAnimationDetails(); // Get details once
    const elementToSnapshot = document.querySelector('#previewContainer'); // Target element
    const logoTextElement = elementToSnapshot?.querySelector('.logo-text'); // Target for animation delay

    if (!elementToSnapshot || !logoTextElement) {
         throw new Error("Snapshot export failed: Could not find necessary elements (#previewContainer or .logo-text).");
    }
    if (!baseAnimationMetadata || !baseAnimationMetadata.durationMs || baseAnimationMetadata.durationMs <= 0) {
        console.warn('[GIF Core Snapshot] No animation duration found. Capturing static frame only.');
        // Capture single frame
        const snapshotOptions = { width, height, transparentBackground: transparent, scale: window.devicePixelRatio * 2 };
        const canvas = await captureLogoWithHTML2Canvas(elementToSnapshot, snapshotOptions);
        const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas toBlob failed')), 'image/png'));
        if (onProgress) onProgress(1, `Generated 1 static frame (Snapshot)`);
        return [blob];
    }

    // Store original animation style to restore later
    const originalAnimation = logoTextElement.style.animation || '';
    const originalAnimPlayState = logoTextElement.style.animationPlayState || '';
    const originalAnimDelay = logoTextElement.style.animationDelay || '';


    for (let i = 0; i < frameCount; i++) {
        if (exportCancelled) throw new Error("Export cancelled");

        const progress = frameCount <= 1 ? 0 : i / frameCount;
        const percent = Math.round((i / frameCount) * 100);
        if (onProgress) {
            onProgress(percent / 100, `Snapshot Frame ${i + 1}/${frameCount} (${percent}%)...`);
        }

        // --- Apply Specific Animation State via inline style for this frame ---
        // We pause the animation and set a negative delay to seek to the desired frame.
        const delayMs = -(progress * baseAnimationMetadata.durationMs);
        // logoTextElement.style.animation = 'none'; // Temporarily disable class-based animation
        logoTextElement.style.animationPlayState = 'paused';
        logoTextElement.style.animationDelay = `${delayMs.toFixed(0)}ms`;
        // Force reflow/repaint might be needed? Usually a small timeout or rAF is enough
        await new Promise(resolve => requestAnimationFrame(resolve)); // Wait for next frame paint
        // await new Promise(resolve => setTimeout(resolve, 10)); // Alternative small delay

        // --- Capture Frame ---
        try {
            // Pass animation metadata to ensure onclone potentially uses it if needed (though delay is set directly here)
             const frameAnimationMetadata = { ...baseAnimationMetadata, progress: progress };
            const snapshotOptions = {
                width, height, transparentBackground: transparent,
                scale: window.devicePixelRatio * 2, // Use higher scale for export quality
                // Pass animationDelay for onclone just in case? Not strictly needed as we set it above.
                // animationDelayMs: delayMs
                // Ensure the onclone function in captureLogoWithHTML2Canvas handles applying styles correctly
            };

            const canvas = await captureLogoWithHTML2Canvas(elementToSnapshot, snapshotOptions);
            const pngBlob = await new Promise((resolve, reject) => {
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/png');
            });
            frames.push(pngBlob);
        } catch (error) {
            console.error(`[GIF Core Snapshot] Error generating frame ${i + 1}:`, error);
            // Restore original animation before throwing
            logoTextElement.style.animationPlayState = originalAnimPlayState;
            logoTextElement.style.animationDelay = originalAnimDelay;
            // logoTextElement.style.animation = originalAnimation; // Restore fully? Might interfere with cleanup
             throw new Error(`Snapshot Frame Generation Failed (Frame ${i + 1}): ${error.message}`); // Stop on error
        }
    }

     // Restore original animation state after loop
     logoTextElement.style.animationPlayState = originalAnimPlayState;
     logoTextElement.style.animationDelay = originalAnimDelay;
     // logoTextElement.style.animation = originalAnimation;

    console.log(`[GIF Core Snapshot] Generated ${frames.length} export frame blobs.`);
    if (onProgress) onProgress(1, `Generated ${frames.length} frames (Snapshot).`);
    return frames;
}


/** Creates the content for the info.txt file included in the ZIP. (Updated) */
function createInfoText(logoText, width, height, frameCount, renderMethod) {
     const date = new Date();
     const safeLogoText = (typeof window.Utils?.getLogoFilenameBase === 'function' ? window.Utils.getLogoFilenameBase() : logoText.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30) || 'logo');
     const dateString = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(date);

     return `LOGO ANIMATION EXPORT INFO
=========================

Logo Text: ${logoText}
Export Date: ${dateString}
Resolution: ${width}x${height}
Frame Count: ${frameCount}
Render Method: ${renderMethod.toUpperCase()} ${renderMethod === 'snapshot' ? '(WYSIWYG via html2canvas)' : '(Vector via SVG Render)'}
Source Frame Rate (approx): The animation speed set in Logomaker.
Preview HTML Rate: ~10 FPS (Adjustable in preview.html controls)

Created with Logomaker by Manic.agency
https://manicinc.github.io/logomaker

PACKAGE CONTENTS:
- Individual frames as PNG files (e.g., ${safeLogoText}-frame-###.png)
- An interactive HTML preview file (${safeLogoText}-preview.html).
- This info text file.

USAGE INSTRUCTIONS:
- Unzip the downloaded file.
- Open the HTML file in your browser to preview the frame sequence and scrub through frames.
- Import the sequence of PNG frames into video editing software (Premiere, DaVinci Resolve, After Effects, Final Cut Pro, etc.). Set frame duration appropriately based on the original animation speed (e.g., 0.1s per frame for 10 FPS).
- Use an online tool (like ezgif.com's "PNG Sequence to GIF" or "APNG Maker") or desktop software (GIMP, Photoshop, FFmpeg) to combine the PNG frames into an animated GIF or APNG. Adjust frame delay as needed (e.g., 100ms for 10 FPS corresponds to 0.1s duration per frame).

Made with ♥ by Manic.agency
`;
 }

/** Creates the content for the detailed preview.html file */
function createDetailedHTMLPreview(options) {
    // ... (Keep existing implementation, maybe add render method to metadata?) ...
    const { logoName = 'logo', frameCount = 15, width = 800, height = 400, frameRate = 10, renderMethod = 'svg' } = options;
      console.log(`[GIF UI] Creating detailed HTML preview. Name: ${logoName}, Frames: ${frameCount}, Method: ${renderMethod}`);
      let exportInfo = { exportDate: new Date().toLocaleString(), renderMethod: renderMethod };
      try {
          // ... (Gather other metadata as before) ...
           const styles = captureAdvancedStyles();
           const animationMetadata = extractSVGAnimationDetails();
           const settings = window.SettingsManager?.getCurrentSettings?.() || {};
           exportInfo = {
              exportDate: new Date().toLocaleString(),
              renderMethod: renderMethod,
              sourceSettings: { /* Add relevant settings */ },
              animationDetails: animationMetadata,
              styleDetails: { /* Add relevant styles */ }
          };
      } catch (e) { console.error("Error gathering metadata for HTML preview:", e); }
      const exportInfoJson = JSON.stringify(exportInfo, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeLogoName = logoName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 30) || 'logo';
      // Simplified frame list generation
      let frameItemsHTML = '';
       for (let i = 0; i < frameCount; i++) {
            const frameNumber = String(i).padStart(3, '0');
            frameItemsHTML += `<img src="${safeLogoName}-frame-${frameNumber}.png" alt="Frame ${i + 1}" loading="lazy" style="display:none; max-width:100%; height:auto;">`;
        }


    // Full HTML content (condensed for brevity, use your existing full HTML here)
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Animation Preview: ${safeLogoName}</title>
    <style>
        body { font-family: sans-serif; background-color: #f0f0f0; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .preview-container { border: 1px solid #ccc; margin-bottom: 20px; background-color: #fff; position: relative; max-width: ${width}px; aspect-ratio: ${width} / ${height}; }
        .preview-image { display: block; max-width: 100%; height: auto; position: absolute; top: 0; left: 0; opacity: 0; transition: opacity 0.05s linear; }
        .preview-image.active { opacity: 1; z-index: 1; }
        .controls { background-color: #eee; padding: 15px; border-radius: 5px; text-align: center; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .controls label { margin: 0 10px; font-size: 0.9em; }
        .controls input[type="range"], .controls input[type="number"] { margin-left: 5px; vertical-align: middle; }
        .controls button { padding: 5px 10px; margin: 0 5px; cursor: pointer; }
        .frame-info { font-size: 0.9em; color: #555; margin-top: 5px; min-height: 1.2em;}
        .metadata { margin-top: 20px; background: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 5px; width: 90%; max-width: 800px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metadata h3 { margin-top: 0; color: #333; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .metadata pre { background-color: #f8f8f8; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 0.85em; }
        /* Add simple loading indicator */
        #loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; z-index: 10; background: rgba(255,255,255,0.8); padding: 10px; border-radius: 5px; display: none; /* Initially hidden */ }
        /* Ensure container has correct aspect ratio */
        .preview-container::before { content: ""; display: block; padding-top: ${(height / width * 100)}%; } /* Aspect ratio */
        .preview-container img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; } /* Make images fill container */
    </style>
</head>
<body>

    <h2>Animation Preview: ${safeLogoName}</h2>

    <div class="preview-container" id="previewContainer" style="width:${Math.min(width, 800)}px;">
        <div id="loading">Loading frames...</div>
        ${frameItemsHTML}
    </div>

    <div class="controls">
        <button id="playBtn">&#9658; Play</button>
        <button id="pauseBtn">❚❚ Pause</button>
        <label>Speed (FPS): <input type="range" id="fpsSlider" min="1" max="30" value="${frameRate}" step="1"><span id="fpsValue">${frameRate}</span></label>
        <label>Frame: <input type="range" id="frameSlider" min="0" max="${frameCount - 1}" value="0" step="1"><span id="frameValue">1</span> / ${frameCount}</label>
        <div class="frame-info" id="frameInfo">Frame 1 / ${frameCount}</div>
    </div>

    <div class="metadata">
        <h3>Export Details</h3>
        <pre id="exportInfoJson">${exportInfoJson}</pre>
    </div>

    <script>
        const images = document.querySelectorAll('#previewContainer img');
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const fpsSlider = document.getElementById('fpsSlider');
        const fpsValue = document.getElementById('fpsValue');
        const frameSlider = document.getElementById('frameSlider');
        const frameValue = document.getElementById('frameValue');
        const frameInfo = document.getElementById('frameInfo');
        const loadingIndicator = document.getElementById('loading');
        const totalFrames = images.length;
        let currentFrame = 0;
        let intervalId = null;
        let frameRate = ${frameRate};
        let loadedCount = 0;

        function showFrame(index) {
            if (index < 0 || index >= totalFrames) return;
            images.forEach((img, i) => {
                img.classList.toggle('active', i === index);
            });
            currentFrame = index;
            frameSlider.value = index;
            frameValue.textContent = index + 1;
            frameInfo.textContent = \`Frame \${index + 1} / \${totalFrames}\`;
        }

        function play() {
            if (intervalId) clearInterval(intervalId);
            const delay = 1000 / frameRate;
            intervalId = setInterval(() => {
                const nextFrame = (currentFrame + 1) % totalFrames;
                showFrame(nextFrame);
            }, delay);
            playBtn.textContent = 'Playing...';
            pauseBtn.textContent = '❚❚ Pause';
        }

        function pause() {
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
            playBtn.textContent = '▶ Play';
            pauseBtn.textContent = 'Paused';
        }

        fpsSlider.addEventListener('input', () => {
            frameRate = parseInt(fpsSlider.value);
            fpsValue.textContent = frameRate;
            if (intervalId) { // If playing, restart with new speed
                play();
            }
        });

        frameSlider.addEventListener('input', () => {
            pause(); // Pause when scrubbing
            showFrame(parseInt(frameSlider.value));
        });

        playBtn.addEventListener('click', play);
        pauseBtn.addEventListener('click', pause);

        // Preload images and show the first frame
        function checkAllLoaded() {
             loadedCount++;
             if (loadedCount === totalFrames) {
                 loadingIndicator.style.display = 'none';
                 showFrame(0); // Show first frame
                 console.log('All frames loaded');
             } else {
                 loadingIndicator.textContent = \`Loading frame \${loadedCount} / \${totalFrames}...\`;
             }
         }

         if (images.length > 0) {
             loadingIndicator.style.display = 'block'; // Show loading
             images.forEach(img => {
                 if (img.complete) {
                    checkAllLoaded();
                 } else {
                    img.onload = checkAllLoaded;
                    img.onerror = () => { console.error('Failed to load frame:', img.src); checkAllLoaded(); }; // Count errors too
                 }
             });
         } else {
             loadingIndicator.textContent = 'No frames found.';
         }

    </script>
</body>
</html>`;
}


/** Helper to confirm export size, considering render method */
function confirmExportSize(frameCount, renderMethod) {
    const isSnapshot = renderMethod === 'snapshot';
    let warningThreshold = isSnapshot ? 15 : 45; // Lower threshold for snapshot
    let message = '';

    if (frameCount > warningThreshold) {
        message = `Generating ${frameCount} frames using the ${renderMethod.toUpperCase()} method`;
        if (isSnapshot) {
            message += ` may take a <strong>very long time</strong> and consume significant memory/CPU due to repeated screen captures.`;
        } else {
            message += ` may take some time and memory, especially for complex logos or slower devices.`;
        }
        message += ` Continue?`;

        // Use custom modal if available, otherwise fallback to confirm
        if (typeof window.showModal === 'function') {
             // Assuming showModal returns a promise that resolves true/false
            return window.showModal({
                 title: 'Large Export Warning',
                 message: message, // Allow HTML in message
                 type: 'warning',
                 confirmText: 'Continue Export',
                 cancelText: 'Cancel',
             }); // Needs showModal to support confirm/cancel promises
        } else {
            // Basic confirm (won't render HTML)
             return Promise.resolve(confirm(message.replace(/<strong>|<\/strong>/g, ''))); // Strip HTML for basic confirm
        }
    }
    return Promise.resolve(true); // Proceed if below threshold
}
/** Handle the main export process (ADDED DEBUG LOGGING at start) */
async function handleExport() {
    // --- DEBUG: Log entry ---
    console.log('[GIF UI DEBUG] handleExport function entered.');

    // --- DEBUG: Check isExporting flag ---
    console.log(`[GIF UI DEBUG] Checking isExporting flag. Value: ${isExporting}`);
    if (isExporting) {
        console.warn('[GIF UI DEBUG] Exiting handleExport because isExporting is true.');
        if (typeof showAlert === 'function') showAlert("Export already in progress.", "warning");
        return;
    }

    // --- DEBUG: Check required elements right away ---
    if (!snapshotRenderRadio || !svgRenderRadio || !modalWidthInput || !modalHeightInput || !modalFramesInput || !modalTransparentInput || !exportBtn || !cancelBtn || !cancelExportBtnModal || !loadingIndicator || !progressText) {
        console.error('[GIF UI DEBUG] CRITICAL ERROR: One or more required modal elements are missing in handleExport!');
        console.error({ snapshotRenderRadio, svgRenderRadio, modalWidthInput, modalHeightInput, modalFramesInput, modalTransparentInput, exportBtn, cancelBtn, cancelExportBtnModal, loadingIndicator, progressText });
        if (typeof showAlert === 'function') showAlert("Critical error: UI elements missing for export. Cannot proceed.", "error");
        isExporting = false; // Ensure flag is reset if we exit here
        return;
    }
     console.log('[GIF UI DEBUG] All checked elements seem to exist.');

    // --- Original logic starts here ---
    const renderMethod = snapshotRenderRadio.checked ? 'snapshot' : 'svg';
    const width = parseInt(modalWidthInput.value);
    const height = parseInt(modalHeightInput.value);
    const frameCount = parseInt(modalFramesInput.value);
    const transparent = modalTransparentInput.checked;
    const maxFrames = renderMethod === 'snapshot' ? 30 : 60; // Enforce limits

    console.log("[GIF UI] Starting Export Process. Settings:", { renderMethod, width, height, frameCount, transparent, maxFrames });

    if (isNaN(width) || isNaN(height) || isNaN(frameCount) || width <= 0 || height <= 0 || frameCount <= 0 || frameCount > maxFrames) {
        console.error('[GIF UI DEBUG] Invalid export settings detected.');
        if (typeof showAlert === 'function') showAlert(`Invalid export settings (Width/Height > 0, Frames: 1-${maxFrames} for ${renderMethod}).`, "error");
        isExporting = false; // Ensure flag is reset
        return;
    }

    // Await confirmation if needed
    console.log('[GIF UI DEBUG] Awaiting export size confirmation...');
    const proceed = await confirmExportSize(frameCount, renderMethod);
    if (!proceed) {
        console.log('[GIF UI DEBUG] Export cancelled by user size confirmation.');
        // No need to set isExporting = true if cancelled here
        return;
    }
    console.log('[GIF UI DEBUG] User confirmed export.');

    // --- Set Exporting State ---
    isExporting = true; // Set flag *after* confirmation and checks
    console.log(`[GIF UI DEBUG] isExporting flag set to true.`);
    resetCancelFlag();
    updateModalProgress(`Starting ${renderMethod} export...`);
    if (exportBtn) exportBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (cancelExportBtnModal) { cancelExportBtnModal.disabled = false; cancelExportBtnModal.style.display = 'inline-block'; }
    stopPreview(); // Stop preview loop during export

    let filesToZip = []; // Declare here to access in error handling

    try {
        // Get filename base (ensure Utils is available)
        const getFilenameFunc = typeof window.Utils?.getLogoFilenameBase === 'function' ? window.Utils.getLogoFilenameBase : () => 'logo';
        const safeLogoText = getFilenameFunc();
        const logoText = document.querySelector('.logo-text')?.textContent || safeLogoText;
        console.log(`[GIF UI DEBUG] Filename base: ${safeLogoText}`);

        // --- 1. Generate Export Frames ---
        updateModalProgress(`Generating ${frameCount} frames (${renderMethod}, 0%)...`);
        let frames = [];
        const exportOptions = {
            width, height, frameCount, transparent,
            onProgress: (progress, message) => {
                if (exportCancelled) throw new Error("Export cancelled"); // Propagate cancellation
                // Update progress text using the correct ID
                const progressTextElement = document.getElementById(`${MODAL_ID}ProgressText`);
                if (progressTextElement) {
                     progressTextElement.textContent = message || `Generating frames (${renderMethod}, ${Math.round(progress * 100)}%)...`;
                }
            }
        };
        console.log('[GIF UI DEBUG] Calling frame generation function...');
        if (renderMethod === 'snapshot') {
            frames = await internalExportFramesSnapshot(exportOptions);
        } else {
            frames = await internalExportFramesSVG(exportOptions);
        }
        console.log(`[GIF UI DEBUG] Frame generation function returned ${frames.length} frames.`);
        if (exportCancelled) throw new Error('Export cancelled'); // Check again
        console.log(`[GIF UI] Successfully generated ${frames.length} frames.`);
        await new Promise(resolve => setTimeout(resolve, 50)); // UI update pause

        // --- 2. Prepare files for ZIP ---
        updateModalProgress("Preparing files for ZIP package...");
        console.log('[GIF UI DEBUG] Preparing filesToZip array...');
        // filesToZip = []; // Already declared outside try
        frames.forEach((frameBlob, index) => {
            if (frameBlob instanceof Blob) {
                filesToZip.push({
                    blob: frameBlob,
                    name: `${safeLogoText}-frame-${String(index).padStart(3, '0')}.png`
                });
            } else {
                 console.warn(`[GIF UI DEBUG] Frame ${index} is not a valid Blob, skipping.`);
            }
        });

        // --- 3. Create HTML Preview and Info Text ---
        console.log('[GIF UI DEBUG] Creating HTML/TXT info files...');
        const previewHTML = createDetailedHTMLPreview({ logoName: safeLogoText, frameCount: filesToZip.length, width, height, renderMethod });
        const infoTXT = createInfoText(logoText, width, height, filesToZip.length, renderMethod);
        filesToZip.push({ blob: new Blob([previewHTML], { type: 'text/html' }), name: `${safeLogoText}-preview.html` });
        filesToZip.push({ blob: new Blob([infoTXT], { type: 'text/plain' }), name: `${safeLogoText}-info.txt` });
        console.log(`[GIF UI DEBUG] Prepared ${filesToZip.length} total files for zipping.`);
        await new Promise(resolve => setTimeout(resolve, 30));
        if (exportCancelled) throw new Error('Export cancelled');

        // --- 4. Create ZIP and Trigger Download ---
        const zipFilename = `${safeLogoText}-animation-frames-${renderMethod}.zip`;
        updateModalProgress("Creating ZIP package... (JSZip if available, else fallback)");
        console.log(`[GIF UI DEBUG] >>>>>>>> Calling createZip... Filename: ${zipFilename}`);
        await new Promise(resolve => setTimeout(resolve, 50)); // UI update pause

        const zipSuccess = await createZip(filesToZip, zipFilename, (percent) => {
            // Update UI progress via callback from zipUtils
            const progressTextElement = document.getElementById(`${MODAL_ID}ProgressText`);
            if (progressTextElement) {
                progressTextElement.textContent = `Creating ZIP package... ${percent}%`;
                console.log(`[GIF UI DEBUG] ZIP Progress Callback: ${percent}%`);
            }
        });

        console.log(`[GIF UI DEBUG] <<<<<<<< createZip call finished. Success: ${zipSuccess}`);
        if (exportCancelled) throw new Error('Export cancelled after zip attempt');

        if (!zipSuccess) {
            console.error("[GIF UI DEBUG] createZip returned false, indicating failure.");
            throw new Error("ZIP/Fallback export process failed. Check console and browser download settings.");
        }

        // --- 5. Success Notification & Cleanup ---
        console.log("[GIF UI DEBUG] Export process successful. Notifying and closing modal.");
        const notifyFunc = typeof window.notifyExportSuccess === 'function' ? window.notifyExportSuccess : (f, fn) => showAlert(`${f} Export Complete! File: ${fn}`, 'success');
        notifyFunc(`Animation Frames Export (${renderMethod})`, zipFilename); // Notify with intended ZIP name
        closeModal(); // Close the modal on success

    } catch (error) {
        // --- Error Handling ---
        console.error("[GIF UI DEBUG] Caught error in handleExport:", error); // Log the full error
        hideModalProgress(); // Hide spinner on error
        if (error.message && error.message.toLowerCase().includes('export cancelled')) {
            if (typeof showAlert === 'function') showAlert('Export cancelled by user.', 'info');
            console.log('[GIF UI DEBUG] Export process was cancelled.');
        } else {
            // Log specific error details if available
            console.error(`[GIF UI] Export process failed (${renderMethod}):`, error.message, error.cause ? `\nCause: ${error.cause}` : '');
            if (typeof showAlert === 'function') showAlert(`Animation Export failed (${renderMethod}): ${error.message || 'Unknown error'}`, 'error');
            // Check if fallback might have been triggered before the error
            if (!isJSZipAvailable() && filesToZip && filesToZip.length > 0) {
                 if (typeof showAlert === 'function') showAlert(`ZIP creation may have failed. Direct frame downloads might have been attempted. Check your downloads folder.`, 'warning');
                 console.warn('[GIF UI DEBUG] Error occurred, but direct download fallback might have been initiated.');
            }
        }
    } finally {
        // --- Cleanup ---
        console.log("[GIF UI DEBUG] Entering finally block.");
        isExporting = false; // Reset the flag ALWAYS
        console.log(`[GIF UI DEBUG] isExporting flag reset to false.`);
        // Re-enable buttons
        if (exportBtn) exportBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        if (cancelExportBtnModal) cancelExportBtnModal.style.display = 'none';
        resetCancelFlag(); // Reset cancellation flag
        // Ensure progress indicator is hidden unless an error message is needed
        // hideModalProgress(); // Already called in catch, potentially hide again just in case?
        console.log("[GIF UI DEBUG] Export handle finished.");
    }
}

/** Cancel the ongoing export */
function cancelExport() {
    if (isExporting && !exportCancelled) {
         console.log('[GIF UI] Cancel export requested.');
         exportCancelled = true; // Set the flag
         updateModalProgress("Attempting to cancel export...");
         if(cancelExportBtnModal) cancelExportBtnModal.disabled = true;
    } else {
         console.log('[GIF UI] No export in progress or already cancelling.');
    }
}

/** Attach event listeners (Updated) */
function attachModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached === 'true') return;
    console.log('[GIF UI] Attaching event listeners...');
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    exportBtn?.addEventListener('click', handleExport);
    cancelExportBtnModal?.addEventListener('click', cancelExport);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Debounced preview restart triggered by frame count, transparency, OR render method change
    const debouncedPreviewRestart = debounce(startPreviewLoop, 450); // Slightly longer delay?
    modalFramesInput?.addEventListener('input', debouncedPreviewRestart);
    modalTransparentInput?.addEventListener('change', debouncedPreviewRestart);

    // Render Method Change Listener
    const handleMethodChange = () => {
        console.log('[GIF UI] Render method changed.');
        updateSnapshotWarningVisibility();
        updateFramesInputLimit();
        debouncedPreviewRestart(); // Regenerate preview for the new method
    };
    svgRenderRadio?.addEventListener('change', handleMethodChange);
    snapshotRenderRadio?.addEventListener('change', handleMethodChange);


    // FPS slider updates interval speed directly without regenerating frames
    modalFrameRateInput?.addEventListener('input', () => {
         if(modalFrameRateValue) modalFrameRateValue.textContent = `${modalFrameRateInput.value} FPS`;
         if (previewInterval) { // If preview is running, restart interval with new speed
             console.log('[GIF UI] Restarting preview loop with new FPS.');
             // Restarting the loop is necessary to apply the new interval time correctly
             startPreviewLoop(); // This stops the old one and starts new with current FPS
         }
    });

    document.addEventListener('keydown', handleEscapeKey);
    modal.dataset.listenersAttached = 'true';
    console.log('[GIF UI] Event listeners attached.');
}

/** Remove event listeners */
function removeModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached !== 'true') return;
    console.log('[GIF UI] Removing event listeners...');
    closeBtn?.removeEventListener('click', closeModal);
    cancelBtn?.removeEventListener('click', closeModal);
    exportBtn?.removeEventListener('click', handleExport);
    cancelExportBtnModal?.removeEventListener('click', cancelExport);
    modal?.removeEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Need to store references to handlers to remove them if they are complex
    // For simple debounce, re-attaching on open might be easier than tracking/removing
    modalFramesInput?.removeEventListener('input', startPreviewLoop); // Need debounced version ref
    modalTransparentInput?.removeEventListener('change', startPreviewLoop); // Need debounced version ref
    svgRenderRadio?.removeEventListener('change', startPreviewLoop); // Need handler ref
    snapshotRenderRadio?.removeEventListener('change', startPreviewLoop); // Need handler ref
    modalFrameRateInput?.removeEventListener('input', startPreviewLoop); // Need handler ref

    document.removeEventListener('keydown', handleEscapeKey);
    modal.removeAttribute('data-listeners-attached');
    console.log('[GIF UI] Event listeners removed (Note: May need references for full removal).');
}

/** Handle escape key press */
function handleEscapeKey(event) {
     if (event.key === 'Escape' && modal?.classList.contains('active')) {
         console.log("[GIF UI] Escape key pressed, closing modal.");
         closeModal();
     }
}

/** Sync settings from main UI to modal (only read-only ones) */
function syncExportSettings() {
    if (!isInitialized || !modal) { console.warn('[GIF UI] Cannot sync settings, UI not ready.'); return; }
    console.log('[GIF UI] Syncing settings from main UI...');
    try {
        // Read relevant settings from main export controls (if they exist)
        const mainWidth = document.getElementById('exportWidth')?.value || '800';
        const mainHeight = document.getElementById('exportHeight')?.value || '400';
        // Read potential defaults from other UI elements if available
        const mainTransparent = document.getElementById('exportTransparent')?.checked ?? modalTransparentInput?.checked ?? false;
        const mainFrames = document.getElementById('exportFrames')?.value || modalFramesInput?.value || '15';
        const mainFrameRate = document.getElementById('exportFrameRate')?.value || modalFrameRateInput?.value ||'10';

        // Apply to read-only inputs
        if (modalWidthInput) modalWidthInput.value = mainWidth;
        if (modalHeightInput) modalHeightInput.value = mainHeight;

        // Apply defaults to the interactive inputs
        if (modalFramesInput) {
            // Respect current max limit when setting value
            const currentMax = parseInt(modalFramesInput.max);
            modalFramesInput.value = Math.min(parseInt(mainFrames), currentMax);
        }
        if (modalTransparentInput) modalTransparentInput.checked = mainTransparent;
        if (modalFrameRateInput) {
             modalFrameRateInput.value = mainFrameRate;
             if (modalFrameRateValue) modalFrameRateValue.textContent = `${mainFrameRate} FPS`;
        }
        // Default to SVG render unless previously set otherwise
        // if (svgRenderRadio && !snapshotRenderRadio?.checked) {
        //    svgRenderRadio.checked = true;
        // }
        updateSnapshotWarningVisibility(); // Update warning based on synced state
        updateFramesInputLimit(); // Update frame limit based on synced state

        console.log(`[GIF UI] Settings synced: W=${mainWidth}, H=${mainHeight}, Frames=${modalFramesInput?.value}, Rate=${mainFrameRate}, T=${mainTransparent}, Method=${snapshotRenderRadio?.checked ? 'snapshot' : 'svg'}`);
    } catch (e) {
        console.error(`[GIF UI] Error syncing settings:`, e);
    }
}

/** Initialize the UI (inject, query, attach listeners) */
function initializeUI() {
    if (isInitialized) return Promise.resolve(true);
    console.log('[GIF UI] Initializing...');
    // Define fallbacks if necessary
    if (typeof showAlert === 'undefined') { window.showAlert = (m, t='error')=>console[t](`[Alert]${m}`); }
    if (typeof notifyExportSuccess === 'undefined') { window.notifyExportSuccess = (f, fn) => showAlert(`${f} Complete: ${fn}`, 'success'); }

    return new Promise((resolve, reject) => {
         try {
             checkDependencies(); // Check for html2canvas first
             injectStyles();
             injectModalHTML();
             if (queryModalElements()) {
                 attachModalEventListeners();
                 isInitialized = true;
                 console.log('[GIF UI] Initialization complete.');
                 resolve(true);
             } else { throw new Error("Failed to find all necessary modal elements after injection."); }
         } catch (error) {
             console.error("[GIF UI] Initialization failed:", error); isInitialized = false; reject(error);
         }
    });
}

// --- PUBLIC EXPORTED FUNCTION ---

/**
 * Initializes and displays the Animation export UI modal.
 * @returns {Promise<void>} Resolves when the modal is shown, rejects on init error.
 */
export async function exportGIFWithUI() {
    console.log('[GIF Exporter V3] exportGIFWithUI() called...');
    try {
        await initializeUI(); // Ensure UI is ready
        if (isInitialized) { openModal(); } // Open the modal
        else { throw new Error("GIF UI could not be initialized."); }
        return Promise.resolve();
    } catch (error) {
        console.error("[GIF Exporter V3] Cannot proceed with export:", error);
        if(typeof showAlert === 'function') showAlert(`Cannot open Animation exporter: ${error.message}`, 'error');
        return Promise.reject(error);
    }
}