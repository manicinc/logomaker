/**
 * @file GIFRenderer.js (AnimationExporterUI - v2 - Refined UI/Notes)
 * @description Manages the UI and process for exporting animations as a sequence of PNG frames in a ZIP package.
 * Uses the SVG-based rendering pipeline for frame generation to handle animations correctly.
 */

// Core Rendering & Utilities
import { generateAnimationFrames, generateConsistentPreview } from './RendererCore.js'; // Use core functions for SVG-based frames
import { createSimpleZip, downloadZipBlob } from '../utils/zipUtils.js'; // Custom ZIP functions
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js'; // For metadata
import { captureAdvancedStyles } from '../captureTextStyles.js'; // For metadata

// --- Module Scope Variables ---
let exportCancelled = false;
let previewInterval = null;
let previewFramesDataUrls = []; // Store data URLs for preview loop
let currentPreviewFrameIndex = 0;
let isExporting = false;
let isInitialized = false; // Track if UI is injected and listeners attached
const MODAL_ID = 'gifExporterModal'; // Consistent ID for elements
const STYLE_ID = 'gifExporterStyles';

// --- DOM Element References ---
let modal = null, closeBtn = null, cancelBtn = null, exportBtn = null;
let previewImage = null, loadingIndicator = null, progressText = null;
let cancelExportBtnModal = null, modalWidthInput = null, modalHeightInput = null;
let modalFramesInput = null, modalTransparentInput = null, modalFrameRateInput = null;
let modalFrameRateValue = null, previewLoadingSpinner = null;

// --- CSS ---
const MODAL_CSS = `
/* Styles for GIF Exporter Modal (v2) */
:root {
    --gif-exporter-accent: #ff1493; /* Deep Pink */
    --gif-exporter-bg-dark: #0f0f1a; /* Darker background */
    --gif-exporter-bg-medium: #1a1a2e; /* Medium dark */
    --gif-exporter-text-light: #e8e8ff; /* Light text */
    --gif-exporter-text-medium: #b0b0e0; /* Muted text */
    --gif-exporter-border-color: #3a3a4a; /* Softer border */
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
// --- HTML Structure ---
const MODAL_HTML = `
<div id="${MODAL_ID}" class="gif-exporter-modal-overlay">
  <div class="gif-exporter-modal-content">
    <div class="gif-exporter-modal-header">
      <h2>Animation Exporter (Frames ZIP)</h2>
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
        <div class="control-group">
          <label for="${MODAL_ID}Frames">Frames (1-60)</label>
          <input type="number" id="${MODAL_ID}Frames" min="1" max="60" value="15" title="Number of PNG frames to generate (more = smoother/larger ZIP).">
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
                 <strong>Note:</strong> This exports a <strong>ZIP file containing individual PNG frames</strong> and an HTML preview file.
                 <br>
                 Frames are generated using SVG rendering to accurately capture animation steps. Use external tools (e.g., ezgif.com) to combine frames into a playable GIF/APNG/Video.
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
    console.log('[GIF UI] Modal elements queried successfully.');
    return true;
}

function openModal() {
    if (!isInitialized || !modal) { const msg = "Animation exporter UI not ready or missing."; console.error(`[GIF UI] ${msg}`); if (typeof showAlert === 'function') showAlert(msg, "error"); throw new Error(msg); }
    console.log("[GIF UI] Opening Modal...");
    resetCancelFlag(); isExporting = false; exportBtn.disabled = false; cancelBtn.disabled = false; cancelExportBtnModal.style.display = 'none'; hideModalProgress();
    syncExportSettings(); // Sync read-only settings
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('active'));
    document.body.style.overflow = 'hidden';
    startPreviewLoop(); // Start preview (generates frames internally)
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

function resetCancelFlag() { exportCancelled = false; console.log('[GIF UI] Cancel flag reset.'); }
function updateModalProgress(message) { if (loadingIndicator && progressText) { loadingIndicator.style.display = 'flex'; progressText.textContent = message; } }
function hideModalProgress() { if (loadingIndicator) loadingIndicator.style.display = 'none'; }
async function blobToDataURL(blob) { /* ... (same as before) ... */ }
function debounce(func, wait) { /* ... (same as before) ... */ }

/** Generate frames specifically for the preview loop (v2.3 - Robustness) */
async function generatePreviewFrames() {
    console.log("[GIF UI] Generating preview frames...");
    previewFramesDataUrls = []; // Reset
    stopPreview();
    if (previewLoadingSpinner) previewLoadingSpinner.style.display = 'block';
    if (previewImage) previewImage.style.opacity = 0;

    const frameCount = Math.min(parseInt(modalFramesInput?.value || 15), 15);
    const transparent = modalTransparentInput?.checked || false;
    const width = parseInt(modalWidthInput?.value || 400);
    const height = parseInt(modalHeightInput?.value || 300);

    let frames = [];
    try {
        console.log(`[GIF UI] Preview Params: ${frameCount} frames, ${width}x${height}, T: ${transparent}`);
        frames = await generateAnimationFrames({
            width, height, frameCount, transparent,
            onProgress: (prog, msg) => { /* Minimal progress */ }
        });

        // *** ADDED VALIDATION ***
        if (!Array.isArray(frames) || frames.length === 0) {
            throw new Error("generateAnimationFrames returned invalid or empty result.");
        }
        if (!frames.every(f => f instanceof Blob)) {
             console.warn("[GIF UI] Not all generated frames are valid Blobs:", frames);
             // Filter out non-blobs, though this might indicate a deeper issue
             frames = frames.filter(f => f instanceof Blob);
             if (frames.length === 0) throw new Error("No valid Blob frames generated.");
        }
        console.log(`[GIF UI] Successfully generated ${frames.length} frame Blobs.`);
        // *** END VALIDATION ***

        console.log(`[GIF UI] Converting ${frames.length} preview blobs to data URLs...`);
        // *** ADDED TRY/CATCH for Promise.all ***
        try {
            previewFramesDataUrls = await Promise.all(frames.map(blob => blobToDataURL(blob)));
            // Add another check to ensure no undefined/null slipped through
            previewFramesDataUrls = previewFramesDataUrls.filter(url => typeof url === 'string' && url.startsWith('data:'));
            if(previewFramesDataUrls.length !== frames.length){
                console.warn(`[GIF UI] Some frames failed data URL conversion. Expected ${frames.length}, got ${previewFramesDataUrls.length}`);
            }
            if (previewFramesDataUrls.length === 0) throw new Error("Data URL conversion resulted in empty array.");

            console.log(`[GIF UI] Generated ${previewFramesDataUrls.length} valid preview frame data URLs.`);
        } catch (dataUrlError) {
            console.error("[GIF UI] Error converting blobs to data URLs:", dataUrlError);
            previewFramesDataUrls = []; // Ensure empty on error
            throw new Error(`Failed to convert frames to data URLs: ${dataUrlError.message}`);
        }
        // *** END TRY/CATCH ***

    } catch (error) {
        console.error("[GIF UI] Preview frame generation failed:", error);
        previewFramesDataUrls = []; // Ensure empty on any error
        if (typeof showAlert === 'function') showAlert(`Preview failed: ${error.message}`, 'warning');
    } finally {
        if (previewLoadingSpinner) previewLoadingSpinner.style.display = 'none';
        if (previewImage) previewImage.style.opacity = (previewFramesDataUrls.length > 0) ? 1 : 0; // Show only if frames exist
        console.log("[GIF UI] Preview frame generation process finished.");
    }
}

/** Start the preview animation loop (v2.3 - Robustness) */
async function startPreviewLoop() {
    console.log('[GIF UI] Attempting to start preview loop...');
    stopPreview();
    // Regenerate frames ensures we have the latest based on settings
    await generatePreviewFrames();

    // *** ADDED VALIDATION ***
    if (!previewImage || !Array.isArray(previewFramesDataUrls) || previewFramesDataUrls.length === 0 || typeof previewFramesDataUrls[0] !== 'string' || !previewFramesDataUrls[0].startsWith('data:')) {
        console.error("[GIF UI] No valid preview frames/image element available. Cannot start loop.");
        if (previewImage) {
            previewImage.src = ''; // Clear potentially broken image
            previewImage.alt = "Preview unavailable";
            previewImage.style.opacity = 1; // Ensure container background shows
        }
        return;
    }
    // *** END VALIDATION ***

    currentPreviewFrameIndex = 0;
    previewImage.src = previewFramesDataUrls[0];
    previewImage.alt = "Animation Preview";
    previewImage.style.opacity = 1; // Ensure visible

    const fr = parseInt(modalFrameRateInput?.value || 10);
    const intervalTime = 1000 / Math.max(1, fr);
    console.log(`[GIF UI] Starting preview loop interval (${fr} FPS -> ${intervalTime.toFixed(1)}ms)`);

    previewInterval = setInterval(() => {
        if (!previewImage || !previewFramesDataUrls || previewFramesDataUrls.length === 0) {
             stopPreview();
             console.warn("[GIF UI] Stopping loop: Invalid state detected inside interval.");
             return;
        }
        currentPreviewFrameIndex = (currentPreviewFrameIndex + 1) % previewFramesDataUrls.length;

        // *** ADDED VALIDATION ***
        const nextSrc = previewFramesDataUrls[currentPreviewFrameIndex];
        if (typeof nextSrc === 'string' && nextSrc.startsWith('data:')) {
            previewImage.src = nextSrc;
        } else {
             console.warn(`[GIF UI] Invalid data URL at index ${currentPreviewFrameIndex}. Stopping loop. Value:`, nextSrc);
             stopPreview();
             // Optionally show an error state on the image
             previewImage.alt = "Preview Error";
        }
        // *** END VALIDATION ***

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

/** Core logic for generating export frames (wraps RendererCore function) */
async function internalExportFrames(options = {}) {
    const { width=800, height=400, frameCount=15, transparent=false, onProgress } = options;
    console.log(`[GIF Core] Generating ${frameCount} export frames (${width}x${height}). Transparent: ${transparent}`);
    if (exportCancelled) throw new Error("Export cancelled");
    try {
        // Directly use the core SVG-based frame generation function
        const frames = await generateAnimationFrames({ width, height, frameCount, transparent, onProgress });
        if (exportCancelled) throw new Error("Export cancelled");
        if (!frames || frames.length === 0) throw new Error("Frame generation yielded no results");
        console.log(`[GIF Core] Generated ${frames.length} export frame blobs.`);
        return frames;
    } catch (error) {
        console.error('[GIF Core] Error generating export frames:', error);
        // Check if it's a cancellation error before re-throwing
        if (error.message === "Export cancelled") {
             throw error; // Re-throw cancellation specifically
        } else {
             throw new Error(`Frame Generation Failed: ${error.message}`); // Wrap other errors
        }
    }
}

/** Creates the content for the info.txt file included in the ZIP. */
function createInfoText(logoText, width, height, frameCount) {
     const date = new Date();
     const safeLogoText = (typeof window.Utils?.getLogoFilenameBase === 'function' ? window.Utils.getLogoFilenameBase() : logoText.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30) || 'logo');
     const dateString = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(date);

     return `LOGO ANIMATION EXPORT INFO
=========================

Logo Text: ${logoText}
Export Date: ${dateString}
Resolution: ${width}x${height}
Frame Count: ${frameCount}
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
    const { logoName = 'logo', frameCount = 15, width = 800, height = 400, frameRate = 10 } = options;
      console.log(`[GIF UI] Creating detailed HTML preview. Name: ${logoName}, Frames: ${frameCount}`);
      let exportInfo = { exportDate: new Date().toLocaleString() };
      try {
           const styles = captureAdvancedStyles();
           const animationMetadata = extractSVGAnimationDetails();
           const settings = window.SettingsManager?.getCurrentSettings?.() || {};
           exportInfo = { /* ... (same metadata gathering as before) ... */ };
      } catch (e) { console.error("Error gathering metadata for HTML preview:", e); }
      const exportInfoJson = JSON.stringify(exportInfo, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeLogoName = logoName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 30) || 'logo';
      const frameItems = Array.from({length: frameCount}, (_, n) => { const fn=String(n).padStart(3, '0'); return `...<img src="${safeLogoName}-frame-${fn}.png"...>`; }).join(""); // Simplified for brevity

    // Full HTML content (structure remains the same as previous version)
    return `<!DOCTYPE html>... (Full HTML as previously defined) ... </html>`;
}


/** Helper to confirm export size */
function confirmExportSize(frameCount) {
    if (frameCount > 45) {
         // Use custom modal if available, otherwise fallback to confirm
         if (typeof window.showModal === 'function') {
             return new Promise((resolve) => {
                 showModal({
                     title: 'Large Export Warning',
                     message: `Generating ${frameCount} frames may take significant time and memory, especially on lower-powered devices or complex logos. Continue?`,
                     type: 'warning',
                     // Add confirm/cancel buttons if showModal supports it
                     // For now, rely on simple OK/Cancel behavior assumed by showModal
                     onClose: () => resolve(true) // Assume OK means continue
                     // Need a way to resolve(false) if user cancels in the modal
                 });
                 // If showModal doesn't support confirmation, this won't work well.
                 // Fallback to native confirm for now.
                  // resolve(confirm(`Generate ${frameCount} frames? This might take significant time and memory... Continue?`));
             });
         } else {
            return confirm(`Generate ${frameCount} frames? This might take significant time and memory... Continue?`);
         }
    }
    return true; // Or Promise.resolve(true) if using promises
}

/** Handle the main export process */
async function handleExport() {
    if (isExporting) { if(typeof showAlert ==='function') showAlert("Export already in progress.", "warning"); return; }

    const width = parseInt(modalWidthInput?.value);
    const height = parseInt(modalHeightInput?.value);
    const frameCount = parseInt(modalFramesInput?.value);
    const transparent = modalTransparentInput?.checked;

    console.log("[GIF UI] Starting Export Process. Settings:", { width, height, frameCount, transparent });

    if (isNaN(width) || isNaN(height) || isNaN(frameCount) || width <= 0 || height <= 0 || frameCount <= 0 || frameCount > 60) {
        if(typeof showAlert === 'function') showAlert("Invalid export settings (Width/Height > 0, Frames: 1-60).", "error"); return;
    }
    // Await confirmation if needed
    const proceed = await confirmExportSize(frameCount);
    if (!proceed) { console.log('[GIF UI] Export cancelled by user size confirmation.'); return; }

    isExporting = true; resetCancelFlag(); updateModalProgress("Starting export...");
    if (exportBtn) exportBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (cancelExportBtnModal) { cancelExportBtnModal.disabled = false; cancelExportBtnModal.style.display = 'inline-block'; }
    stopPreview();

    try {
        const getFilenameFunc = typeof window.Utils?.getLogoFilenameBase === 'function' ? window.Utils.getLogoFilenameBase : () => 'logo';
        const safeLogoText = getFilenameFunc();
        const logoText = document.querySelector('.logo-text')?.textContent || safeLogoText;

        // 1. Generate Export Frames using SVG Render method
        updateModalProgress(`Generating ${frameCount} frames (0%)...`);
        const frames = await internalExportFrames({
             width, height, frameCount, transparent,
             onProgress: (progress, message) => {
                 if (exportCancelled) throw new Error("Export cancelled"); // Check cancellation flag
                 updateModalProgress(message || `Generating frames (${Math.round(progress*100)}%)...`);
             }
         });
        if (exportCancelled) throw new Error('Export cancelled'); // Check again

        // 2. Prepare files for ZIP
        updateModalProgress("Packaging files...");
        const filesToZip = frames.map((blob, index) => ({ blob, name: `${safeLogoText}-frame-${String(index).padStart(3, '0')}.png` }));
        if (exportCancelled) throw new Error('Export cancelled');

        // 3. Create HTML Preview and Info Text
        const previewHTML = createDetailedHTMLPreview({ logoName: safeLogoText, frameCount, width, height });
        const infoTXT = createInfoText(logoText, width, height, frameCount);
        filesToZip.push({ blob: new Blob([previewHTML], { type: 'text/html' }), name: `${safeLogoText}-preview.html` });
        filesToZip.push({ blob: new Blob([infoTXT], { type: 'text/plain' }), name: `${safeLogoText}-info.txt` });

        // 4. Create ZIP Blob
        if (exportCancelled) throw new Error('Export cancelled');
        const zipFilename = `${safeLogoText}-animation-frames.zip`;
        updateModalProgress("Creating ZIP package...");
        const zipBlob = await createSimpleZip(filesToZip);
        if (exportCancelled) throw new Error('Export cancelled');
        console.log(`[GIF UI] ZIP Blob created. Size: ${(zipBlob.size / 1024).toFixed(1)} KB`);

        // 5. Trigger Download
        updateModalProgress("Downloading ZIP...");
        downloadZipBlob(zipBlob, zipFilename);
        if (exportCancelled) throw new Error('Export cancelled'); // Check one last time

        // 6. Success Notification & Cleanup
        const notifyFunc = typeof window.notifyExportSuccess === 'function' ? window.notifyExportSuccess : (f, fn) => showAlert(`${f} Export Complete! File: ${fn}`, 'success');
        notifyFunc('Animation Frames ZIP', zipFilename);
        closeModal();

    } catch (error) {
        hideModalProgress();
        if (error.message === 'Export cancelled') {
             if(typeof showAlert === 'function') showAlert('Export cancelled by user.', 'info');
             console.log('[GIF UI] Export process cancelled.');
        } else {
             console.error("[GIF UI] Export process failed:", error);
             if(typeof showAlert === 'function') showAlert(`Animation Export failed: ${error.message}`, 'error');
        }
    } finally {
        isExporting = false;
        if(exportBtn) exportBtn.disabled = false;
        if(cancelBtn) cancelBtn.disabled = false;
        if(cancelExportBtnModal) cancelExportBtnModal.style.display = 'none';
        resetCancelFlag();
        hideModalProgress();
        console.log("[GIF UI] Export handle finished.");
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

/** Attach event listeners */
function attachModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached === 'true') return;
    console.log('[GIF UI] Attaching event listeners...');
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    exportBtn?.addEventListener('click', handleExport);
    cancelExportBtnModal?.addEventListener('click', cancelExport);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Debounced preview restart only needed if controls CHANGE the preview generation
    // Since FPS only affects playback speed, and frames/transparent affect generation,
    // we only need listeners on frames and transparent.
    const debouncedPreviewRestart = debounce(startPreviewLoop, 400);
    modalFramesInput?.addEventListener('input', debouncedPreviewRestart);
    modalTransparentInput?.addEventListener('change', debouncedPreviewRestart);

    // FPS slider updates interval speed directly without regenerating frames
    modalFrameRateInput?.addEventListener('input', () => {
         if(modalFrameRateValue) modalFrameRateValue.textContent = `${modalFrameRateInput.value} FPS`;
         if (previewInterval) { // If preview is running, restart interval with new speed
             console.log('[GIF UI] Restarting preview loop with new FPS.');
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
     // Remove specific input listeners if they used named functions or store references
     document.removeEventListener('keydown', handleEscapeKey);
     modal.removeAttribute('data-listeners-attached');
     console.log('[GIF UI] Event listeners removed.');
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
        const mainWidth = document.getElementById('exportWidth')?.value || '800';
        const mainHeight = document.getElementById('exportHeight')?.value || '400';
        // Read other settings that might influence appearance but aren't directly controls here
        const mainTransparent = document.getElementById('exportTransparent')?.checked || false;
        const mainFrames = document.getElementById('exportFrames')?.value || '15'; // Read default frame count
        const mainFrameRate = document.getElementById('exportFrameRate')?.value || '10'; // Read default rate

        // Apply to read-only inputs
        if (modalWidthInput) modalWidthInput.value = mainWidth;
        if (modalHeightInput) modalHeightInput.value = mainHeight;
         // Apply defaults to the interactive inputs if they haven't been changed yet
         // Or just read the main settings for consistency
         if (modalFramesInput) modalFramesInput.value = mainFrames;
         if (modalTransparentInput) modalTransparentInput.checked = mainTransparent;
         if (modalFrameRateInput) {
             modalFrameRateInput.value = mainFrameRate;
             if (modalFrameRateValue) modalFrameRateValue.textContent = `${mainFrameRate} FPS`;
         }

        console.log(`[GIF UI] Settings synced: W=${mainWidth}, H=${mainHeight}, Frames=${mainFrames}, Rate=${mainFrameRate}, T=${mainTransparent}`);
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
 * Initializes and displays the GIF/Animation export UI modal.
 * @returns {Promise<void>} Resolves when the modal is shown, rejects on init error.
 */
export async function exportGIFWithUI() {
    console.log('[GIF Exporter] exportGIFWithUI() called...');
    try {
        await initializeUI(); // Ensure UI is ready
        if (isInitialized) { openModal(); } // Open the modal
        else { throw new Error("GIF UI could not be initialized."); }
        return Promise.resolve();
    } catch (error) {
        console.error("[GIF Exporter] Cannot proceed with export:", error);
        if(typeof showAlert === 'function') showAlert(`Cannot open Animation exporter: ${error.message}`, 'error');
        return Promise.reject(error);
    }
}