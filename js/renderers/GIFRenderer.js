/**
 * @file GIFRenderer.js (AnimationExporterUI)
 * @description Manages the UI and process for exporting animations as a sequence of PNG frames in a ZIP package.
 */

// Core Rendering & Utilities
import { generateAnimationFrames, generateConsistentPreview } from './RendererCore.js'; // Use core functions
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

// --- DOM Element References (Populated by queryModalElements) ---
let modal = null, closeBtn = null, cancelBtn = null, exportBtn = null;
let previewImage = null, loadingIndicator = null, progressText = null;
let cancelExportBtnModal = null, modalWidthInput = null, modalHeightInput = null;
let modalFramesInput = null, modalTransparentInput = null, modalFrameRateInput = null;
let modalFrameRateValue = null, previewLoadingSpinner = null; // Reference for preview spinner

// --- CSS (Using styles defined in previous responses) ---
const MODAL_CSS = `
/* Paste the MODAL_CSS string provided in the previous GIFRenderer response here */
/* Includes styles for .gif-exporter-modal-overlay, .modal-content, controls, etc. */
:root {
    --gif-exporter-accent: #ff1493; /* Deep Pink */
    --gif-exporter-bg-dark: #10101b;
    --gif-exporter-bg-medium: #1f1f30;
    --gif-exporter-text-light: #e8e8ff;
    --gif-exporter-text-medium: #bbb;
    --gif-exporter-border-color: #444;
}
.gif-exporter-modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 10, 20, 0.95); display: none; /* Modified by JS */ justify-content: center; align-items: center; z-index: 1001; padding: 2vh 2vw; box-sizing: border-box; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); overflow: hidden;
}
.gif-exporter-modal-content {
  background: linear-gradient(145deg, var(--gif-exporter-bg-medium), var(--gif-exporter-bg-dark)); color: var(--gif-exporter-text-light); padding: 30px 40px; border-radius: 12px; box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 20, 147, 0.3); width: 100%; height: 100%; max-width: 1200px; max-height: 95vh; position: relative; border: 1px solid var(--gif-exporter-border-color); display: flex; flex-direction: column; overflow: hidden;
}
.gif-exporter-modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--gif-exporter-accent); padding-bottom: 15px; flex-shrink: 0;
}
.gif-exporter-modal-header h2 {
  margin: 0; font-size: 1.8em; font-weight: 700; color: var(--gif-exporter-accent); text-shadow: 0 0 5px rgba(255, 20, 147, 0.5); font-family: 'Orbitron', sans-serif; /* Example */
}
.gif-exporter-modal-close-btn {
  background: none; border: none; color: #aaa; font-size: 2.5em; line-height: 1; cursor: pointer; padding: 0 5px; transition: color 0.3s ease, transform 0.3s ease;
}
.gif-exporter-modal-close-btn:hover { color: var(--gif-exporter-accent); transform: rotate(90deg); }
.gif-exporter-modal-body {
  flex-grow: 1; display: flex; gap: 30px; overflow: hidden; padding-bottom: 20px;
}
.gif-exporter-preview-area {
  flex: 2; display: flex; flex-direction: column; justify-content: center; align-items: center;
  background-color: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 20px;
  overflow: hidden; border: 1px solid var(--gif-exporter-border-color);
  min-height: 300px; position: relative; /* Match the height with other exporters */
}
/* MODIFIED: Container for spinner and image */
.gif-exporter-preview-image-container {
  width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;
  position: relative; background: repeating-conic-gradient(#222 0% 25%, #333 0% 50%) 50% / 20px 20px;
  border-radius: 4px; /* Optional: round corners */
}
/* Added spinner style inside container */
.gif-exporter-preview-spinner {
   border: 4px solid rgba(255, 255, 255, 0.2);
   border-left-color: var(--gif-exporter-accent);
   border-radius: 50%; width: 40px; height: 40px;
   animation: gif-exporter-spin 1s linear infinite;
   position: absolute; /* Center it */
   top: calc(50% - 20px);
   left: calc(50% - 20px);
   z-index: 1; /* Above background, below image */
}
.gif-exporter-preview-image {
  max-width: 100%; max-height: 300px; /* Match this with other exporters */
  object-fit: contain; background-color: transparent; /* Let container background show */
  /* border: 1px dashed #555; Remove border, container has one */
  min-height: 50px; display: block; /* Changed from none initially */
  opacity: 1; /* Start visible unless loading */
  position: relative; /* Ensure it's above spinner when loaded */
  z-index: 2;
}
.gif-exporter-controls-area {
  flex: 1; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; padding-right: 15px; padding-left: 20px;
}
.gif-exporter-controls-area .control-group { display: flex; flex-direction: column; gap: 8px; }
.gif-exporter-controls-area label { font-weight: 500; color: var(--gif-exporter-text-medium); font-size: 0.95em; display: block; margin-bottom: 4px; }
.gif-exporter-controls-area input[type="number"], .gif-exporter-controls-area input[type="range"], .gif-exporter-controls-area select { width: 100%; padding: 8px 12px; background-color: #2a2a3a; border: 1px solid #555; color: var(--gif-exporter-text-light); border-radius: 4px; font-size: 1em; box-sizing: border-box; transition: border-color 0.2s; }
/* Make read-only inputs look different */
.gif-exporter-controls-area input[readonly] {
    background-color: #20202b; /* Darker */
    color: #888; /* Dimmer text */
    cursor: not-allowed;
    border-style: dashed;
}
.gif-exporter-controls-area input:focus { border-color: var(--gif-exporter-accent); outline: none; }
.gif-exporter-controls-area input[type="range"] { padding: 0; cursor: pointer; height: 18px; accent-color: var(--gif-exporter-accent); }
.gif-exporter-controls-area .range-container { display: flex; align-items: center; gap: 8px; }
.gif-exporter-controls-area .range-container input[type="range"] { flex-grow: 1; }
.gif-exporter-controls-area .range-container span { font-size: 0.85em; color: var(--gif-exporter-text-medium); min-width: 50px; text-align: right; } /* Slightly wider */
.gif-exporter-controls-area .checkbox-label { display: flex; align-items: center; cursor: pointer; color: var(--gif-exporter-text-medium); padding: 5px 0; }
.gif-exporter-controls-area .checkbox-label:hover { color: var(--gif-exporter-text-light); }
.gif-exporter-controls-area input[type="checkbox"] { width: 15px; height: 15px; margin-right: 8px; accent-color: var(--gif-exporter-accent); vertical-align: middle; cursor: pointer; flex-shrink: 0; }
.gif-exporter-controls-area .checkbox-label label { margin-bottom: 0; }
.gif-exporter-modal-footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--gif-exporter-border-color); display: flex; justify-content: flex-end; align-items: center; gap: 15px; flex-shrink: 0; }
.gif-exporter-modal-btn { padding: 10px 22px; font-size: 0.95em; font-weight: 600; border: none; border-radius: 5px; cursor: pointer; transition: all 0.2s ease; text-transform: uppercase; letter-spacing: 0.5px; }
.gif-exporter-modal-btn-primary { background-color: var(--gif-exporter-accent); color: #fff; box-shadow: 0 3px 8px rgba(255, 20, 147, 0.25); }
.gif-exporter-modal-btn-primary:hover:not(:disabled) { background-color: #ff47a3; box-shadow: 0 4px 12px rgba(255, 20, 147, 0.4); transform: translateY(-1px); }
.gif-exporter-modal-btn-primary:disabled { background-color: #7a0a47; cursor: not-allowed; opacity: 0.6; }
.gif-exporter-modal-btn-secondary { background-color: #444; color: #ccc; }
.gif-exporter-modal-btn-secondary:hover { background-color: #555; color: #fff; }
/* Main loading overlay during export */
.gif-exporter-loading-indicator {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 10, 20, 0.9); display: none; /* Toggled by JS */ justify-content: center; align-items: center; z-index: 1002; flex-direction: column; gap: 15px; color: var(--gif-exporter-text-light); text-align: center; border-radius: 12px; font-size: 1.1em;
}
.gif-exporter-loading-indicator .progress-text { font-weight: 500; margin-top: 5px; }
.gif-exporter-loading-indicator .cancel-export-btn-modal { margin-top: 15px; padding: 8px 18px; background-color: #cc3333; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; transition: background-color 0.2s ease; display: none; /* Shown by JS */ }
.gif-exporter-loading-indicator .cancel-export-btn-modal:hover { background-color: #ff1a1a; }
.gif-exporter-loading-indicator .gif-exporter-spinner { border: 4px solid rgba(255, 255, 255, 0.2); border-left-color: var(--gif-exporter-accent); border-radius: 50%; width: 35px; height: 35px; animation: gif-exporter-spin 1s linear infinite; }
@keyframes gif-exporter-spin { to { transform: rotate(360deg); } }
/* Scrollbar */
.gif-exporter-controls-area::-webkit-scrollbar { width: 8px; }
.gif-exporter-controls-area::-webkit-scrollbar-track { background: var(--gif-exporter-bg-dark); border-radius: 4px; }
.gif-exporter-controls-area::-webkit-scrollbar-thumb { background-color: var(--gif-exporter-accent); border-radius: 4px; border: 2px solid var(--gif-exporter-bg-dark); }

`;

// --- HTML Structure (Using styles defined above) ---
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
             <img id="${MODAL_ID}PreviewImage" src="" alt="Animation Preview Area" class="gif-exporter-preview-image" style="opacity: 0;"> </div>
      </div>
      <div class="gif-exporter-controls-area">
        <div class="control-group">
          <label for="${MODAL_ID}Width">Width (px)</label>
          <input type="number" id="${MODAL_ID}Width" value="800" readonly title="Output width. Adjust in Advanced tab on main page.">
        </div>
        <div class="control-group">
          <label for="${MODAL_ID}Height">Height (px)</label>
          <input type="number" id="${MODAL_ID}Height" value="400" readonly title="Output height. Adjust in Advanced tab on main page.">
        </div>
        <div class="control-group">
          <label for="${MODAL_ID}Frames">Frames (1-60)</label>
          <input type="number" id="${MODAL_ID}Frames" min="1" max="60" value="15" title="Number of PNG frames to generate (more = smoother/larger).">
        </div>
         <div class="control-group">
           <label for="${MODAL_ID}FrameRate">Preview Speed (FPS)</label>
           <div class="range-container">
             <input type="range" id="${MODAL_ID}FrameRate" min="1" max="30" value="10" step="1" title="Adjust ONLY the speed of THIS preview animation.">
             <span id="${MODAL_ID}FrameRateValue" class="range-value-display">10 FPS</span>
           </div>
         </div>
        <label class="checkbox-label control-group">
             <input type="checkbox" id="${MODAL_ID}Transparent">
             <label for="${MODAL_ID}Transparent" title="Export frames with transparent background instead of current style.">Transparent Background</label>
        </label>
        <div class="control-group">
             <p style="font-size: 0.85em; color: var(--gif-exporter-text-medium); margin-top: 10px; line-height: 1.4;">
                 <strong>Note:</strong> This exports a ZIP of PNG frames, plus an HTML preview. Use other tools (e.g., ezgif.com) to create playable GIFs/Videos from the frames.
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
</div>
`;

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
    previewLoadingSpinner = document.getElementById(`${MODAL_ID}PreviewSpinner`); // Get spinner ref
    console.log('[GIF UI] Modal elements queried successfully.');
    return true;
}

function openModal() {
    if (!isInitialized || !modal) { const msg = "Animation exporter UI not ready or missing."; console.error(`[GIF UI] ${msg}`); if (typeof showAlert === 'function') showAlert(msg, "error"); throw new Error(msg); }
    console.log("[GIF UI] Opening Modal...");
    resetCancelFlag(); isExporting = false; exportBtn.disabled = false; cancelBtn.disabled = false; cancelExportBtnModal.style.display = 'none'; hideModalProgress();
    syncExportSettings(); // Sync settings from main UI *before* generating preview
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    startPreviewLoop(); // Start preview generation and animation
}

function closeModal() {
    if (!modal) return;
    stopPreview(); // Stop animation loop
    hideModalProgress(); // Hide main loading overlay
    modal.style.display = 'none';
    modal.classList.remove('active');
    document.body.style.overflow = '';
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
async function blobToDataURL(blob) {
    if (!(blob instanceof Blob)) return Promise.reject(new Error("Invalid input: Expected a Blob."));
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = (err) => reject(new Error(`FileReader error: ${err}`));
        reader.readAsDataURL(blob);
    });
}

/** Debounce function */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func.apply(this, args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/** Generate frames specifically for the preview loop */
async function generatePreviewFrames() {
    console.log("[GIF UI] Generating preview frames...");
    // Clear existing frames and show loading state
    previewFramesDataUrls = [];
    stopPreview(); // Stop existing loop first
    if (previewLoadingSpinner) previewLoadingSpinner.style.display = 'block';
    if (previewImage) previewImage.style.opacity = 0; // Hide image smoothly

    // Use modal settings for preview generation
    const frameCount = Math.min(parseInt(modalFramesInput?.value || 15), 15); // Limit preview frames
    const transparent = modalTransparentInput?.checked || false;
    // Use read-only synced dimensions from main settings for preview consistency
    const width = parseInt(modalWidthInput?.value || 400); // Use smaller default for preview if sync fails
    const height = parseInt(modalHeightInput?.value || 300);

    try {
        console.log(`[GIF UI] Preview Params: ${frameCount} frames, ${width}x${height}, Transparent: ${transparent}`);
        // Use generateAnimationFrames from RendererCore
        const frames = await generateAnimationFrames({
            width, height, frameCount, transparent,
            onProgress: (prog, msg) => { // Simple progress update for preview gen
                if (previewLoadingSpinner) { /* Could update text near spinner */ }
            }
        });

        if (!frames || frames.length === 0) throw new Error("No preview frames generated");

        console.log(`[GIF UI] Converting ${frames.length} preview blobs to data URLs...`);
        previewFramesDataUrls = await Promise.all(frames.map(blob => blobToDataURL(blob)));
        console.log(`[GIF UI] Generated ${previewFramesDataUrls.length} preview frame data URLs.`);

    } catch (error) {
        console.error("[GIF UI] Preview frame generation error:", error);
        previewFramesDataUrls = []; // Clear frames on error
        if (typeof showAlert === 'function') showAlert(`Preview failed: ${error.message}`, 'warning');
    } finally {
        // Hide spinner, show image (even if empty)
        if (previewLoadingSpinner) previewLoadingSpinner.style.display = 'none';
        if (previewImage) previewImage.style.opacity = 1;
        console.log("[GIF UI] Preview frame generation finished.");
    }
}


/** Start the preview animation loop */
async function startPreviewLoop() {
    console.log('[GIF UI] Attempting to start preview loop...');
    stopPreview(); // Ensure any previous loop is stopped

    // Generate/Re-generate frames before starting the loop
    await generatePreviewFrames();

    if (previewFramesDataUrls.length === 0) {
        console.error("[GIF UI] No preview frames available. Cannot start loop.");
        if (previewImage) {
            previewImage.src = ''; // Clear image
            previewImage.alt = "Preview generation failed";
        }
        return;
    }

    // Set first frame immediately
    currentPreviewFrameIndex = 0;
    if (previewImage) {
        previewImage.src = previewFramesDataUrls[0];
        previewImage.alt = "Animation Preview";
    }

    // Start the interval timer based on modal's FPS slider
    const fr = parseInt(modalFrameRateInput?.value || 10);
    const intervalTime = 1000 / Math.max(1, fr);
    console.log(`[GIF UI] Starting preview loop interval (${fr} FPS -> ${intervalTime.toFixed(1)}ms)`);

    previewInterval = setInterval(() => {
        if (previewFramesDataUrls.length === 0) { stopPreview(); return; } // Stop if frames cleared unexpectedly
        currentPreviewFrameIndex = (currentPreviewFrameIndex + 1) % previewFramesDataUrls.length;
        if (previewImage) {
            previewImage.src = previewFramesDataUrls[currentPreviewFrameIndex];
        }
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

/** Core logic for generating export frames */
async function internalExportFrames(options = {}) {
    const { width=800, height=400, frameCount=15, transparent=false, onProgress } = options;
    console.log(`[GIF Core] Generating ${frameCount} export frames (${width}x${height}). Transparent: ${transparent}`);
    if (exportCancelled) throw new Error("Export cancelled"); // Check before starting
    try {
        // Directly use the core function
        const frames = await generateAnimationFrames({ width, height, frameCount, transparent, onProgress });
        if (exportCancelled) throw new Error("Export cancelled"); // Check after generation
        if (frames.length === 0) throw new Error("Frame generation yielded no results");
        console.log(`[GIF Core] Generated ${frames.length} export frame blobs.`);
        return frames;
    } catch (error) {
        console.error('[GIF Core] Error generating export frames:', error);
        throw error; // Re-throw
    }
}

/** Creates the content for the info.txt file included in the ZIP. */
function createInfoText(logoText, width, height, frameCount) {
    // ... (Function content remains the same as provided before) ...
     const date = new Date();
     const safeLogoText = logoText.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30) || 'logo';
     // Get current date using Intl for better formatting
     const dateString = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(date);

     return `LOGO ANIMATION EXPORT INFO
=========================

Logo Text: ${logoText}
Export Date: ${dateString}
Resolution: ${width}x${height}
Frame Count: ${frameCount}
Preview HTML Rate: ~10 FPS (Set in preview.html controls)

Created with Logomaker by Manic.agency
https://manicinc.github.io/logomaker

PACKAGE CONTENTS:
- Individual frames as PNG files (e.g., ${safeLogoText}-frame-###.png)
- An interactive HTML preview file (${safeLogoText}-preview.html).
- This info text file.

USAGE INSTRUCTIONS:
- Unzip the downloaded file.
- Open the HTML file in your browser to preview the frame sequence and scrub through frames.
- Import the sequence of PNG frames into video editing software (Premiere, DaVinci Resolve, After Effects, Final Cut Pro, etc.). Set frame duration appropriately (e.g., 0.1s per frame for 10 FPS).
- Use an online tool (like ezgif.com's "PNG Sequence to GIF" or "APNG Maker") or desktop software (GIMP, Photoshop, FFmpeg) to combine the PNG frames into an animated GIF or APNG. Adjust frame delay as needed (e.g., 100ms for 10 FPS).

Made with ♥ by Manic.agency
`;
}

/** Creates the content for the detailed preview.html file */
function createDetailedHTMLPreview(options) {
    const {
        logoName = 'logo',
        frameCount = 15,
        width = 800,
        height = 400,
        frameRate = 10 // Base frame rate for the preview controls
    } = options;
     console.log(`[GIF UI] Creating detailed HTML preview. Name: ${logoName}, Frames: ${frameCount}`);

    // --- Gather Metadata ---
    let exportInfo = { exportDate: new Date().toLocaleString() };
    try {
         const styles = captureAdvancedStyles(); // Capture current styles
         const animationMetadata = extractSVGAnimationDetails();
         const settings = window.SettingsManager?.getCurrentSettings?.() || {};

         exportInfo = {
             ...exportInfo,
             sourceApp: "Logomaker by Manic.agency",
             logoText: styles?.textContent?.finalText || 'N/A',
             fontFamily: styles?.font?.family || 'N/A',
             fontSize: styles?.font?.size || 'N/A',
             fontWeight: styles?.font?.weight || 'N/A',
             letterSpacing: styles?.font?.letterSpacing || 'N/A',
             colorMode: styles?.color?.mode || 'N/A',
             gradientColors: styles?.color?.gradient?.colors || [],
             solidColor: styles?.color?.value || 'N/A',
             animationType: animationMetadata?.type || styles?.animation?.class || 'None',
             animationDuration: styles?.animation?.duration || 'N/A',
             borderStyle: styles?.border?.style || 'N/A',
             borderColor: styles?.border?.color || 'N/A',
             textEffect: styles?.effects?.filterId ? (styles.effects.glowInfo ? 'Glow' : 'Shadow') : 'None',
             backgroundType: styles?.background?.type || 'N/A',
             backgroundColor: styles?.background?.color || 'N/A',
             exportWidth: width,
             exportHeight: height,
             frameCount: frameCount,
         };
    } catch (e) { console.error("Error gathering metadata for HTML preview:", e); }
     const exportInfoJson = JSON.stringify(exportInfo, null, 2)
                            .replace(/</g, '&lt;').replace(/>/g, '&gt;'); // Basic escaping for <pre>

    // Sanitize logo name
    const safeLogoName = logoName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 30) || 'logo';

    // Generate frame list HTML
    const frameItems = Array.from({length: frameCount}, (_, n) => {
        const frameNum = String(n).padStart(3, '0');
        return `
              <div class="frame" data-frame="${n}" onclick="selectFrame(${n})" title="Frame ${n+1}">
                  <img src="${safeLogoName}-frame-${frameNum}.png"
                       alt="Frame ${n+1}"
                       loading="lazy"
                       width="120"
                       height="${Math.round(height * 120 / width)}">
                  <div class="frame-details">
                       <span class="frame-number">Frame ${n+1}</span>
                  </div>
              </div>`;
    }).join("");

    // Full HTML content
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeLogoName} Animation Preview</title>
    <style>
        :root { /* Consistent styling */
            --accent-color: #ff1493; --background-color: #0f0f1a;
            --text-color: #e0e0ff; --frame-bg: #1a1a2e; --card-bg: #1f1f30;
            --border-color: #444;
        }
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: var(--background-color); color: var(--text-color); line-height: 1.6; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .preview-container { max-width: 1200px; width: 100%; background-color: var(--card-bg); border-radius: 12px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid var(--border-color); }
        h1 { text-align: center; color: var(--accent-color); margin-bottom: 1em; font-family: 'Orbitron', sans-serif; text-shadow: 0 0 8px rgba(255, 20, 147, 0.4); }
        .main-preview { display: flex; flex-direction: column; align-items: center; margin-bottom: 25px; background: repeating-conic-gradient(var(--frame-bg) 0% 25%, #222 0% 50%) 50% / 20px 20px; padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); }
        #currentFrame { max-width: 100%; border: 2px solid var(--accent-color); border-radius: 4px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); background-color: #fff; /* Fallback if transparent */}
        .controls { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 20px 0; flex-wrap: wrap; }
        .controls button { background-color: var(--accent-color); border: none; color: white; padding: 8px 18px; font-size: 0.9em; border-radius: 5px; cursor: pointer; transition: background-color 0.3s, transform 0.1s; }
        .controls button:hover:not(:disabled) { background-color: #ff45b5; transform: scale(1.03); }
        .controls button:disabled { background-color: #555; color: #999; cursor: not-allowed; }
        .controls input[type=range] { width: clamp(150px, 30%, 300px); accent-color: var(--accent-color); cursor: pointer; }
        .controls span { font-size: 0.9em; color: #ccc; min-width: 80px; text-align: center; }
        h2 { text-align: center; margin-top: 40px; margin-bottom: 15px; color: #ddd; font-weight: 500; }
        .frames-gallery { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; background-color: var(--frame-bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color); }
        .frame { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; background-color: #2a2a40; border-radius: 6px; padding: 8px; border: 1px solid transparent; }
        .frame:hover { transform: scale(1.05); box-shadow: 0 0 12px rgba(255,20,147,0.4); border-color: var(--accent-color); }
        .frame.current { box-shadow: 0 0 15px var(--accent-color); border-color: var(--accent-color); transform: scale(1.05); }
        .frame img { max-width: 120px; border-radius: 4px; aspect-ratio: ${width}/${height}; background-color: #fff; /* Show image bounds */ }
        .frame-details { margin-top: 5px; text-align: center; }
        .frame-number { font-size: 0.8em; color: var(--accent-color); }
        .metadata-section { background-color: var(--frame-bg); border-radius: 8px; padding: 20px; margin-top: 30px; border: 1px solid var(--border-color); }
        .metadata-section h3 { margin: 0 0 15px 0; color: #ddd; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;}
        pre { white-space: pre-wrap; word-wrap: break-word; font-size: 0.85em; color: #b0b0e0; background-color: #111; padding: 15px; border-radius: 5px; max-height: 300px; overflow-y: auto;}
    </style>
</head>
<body>
    <div class="preview-container">
        <h1>${safeLogoName} Animation Preview</h1>
        <div class="main-preview">
            <img id="currentFrame"
                 src="${safeLogoName}-frame-000.png"
                 alt="Current Animation Frame"
                 width="${width}"
                 height="${height}">
        </div>
        <div class="controls">
            <button id="playBtn">▶ Play</button>
            <button id="pauseBtn" disabled>❚❚ Pause</button>
            <input type="range"
                   id="frameSlider"
                   min="0"
                   max="${frameCount - 1}"
                   value="0"
                   step="1" title="Scrub through frames">
            <span id="frameCounter">Frame 1/${frameCount}</span>
        </div>
        <h2>Frames (${frameCount})</h2>
        <div class="frames-gallery">${frameItems}</div>
        <div class="metadata-section">
            <h3>Export Details</h3>
            <pre>${exportInfoJson}</pre>
        </div>
    </div>

    <script>
        const frameCount = ${frameCount};
        const logoName = "${safeLogoName}";
        const frameRate = ${frameRate}; // Base rate for playback speed calculation
        const currentFrameImg = document.getElementById('currentFrame');
        const frameSlider = document.getElementById('frameSlider');
        const frameCounter = document.getElementById('frameCounter');
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const frameElements = document.querySelectorAll('.frame');
        let animationInterval = null;
        let currentFrameIndex = 0;
        const intervalTime = 1000 / frameRate; // Initial interval time

        function updateFrame(index) {
            currentFrameIndex = Math.max(0, Math.min(index, frameCount - 1));
            const frameNum = String(currentFrameIndex).padStart(3, '0');
            currentFrameImg.src = \`\${logoName}-frame-\${frameNum}.png\`;
            frameSlider.value = currentFrameIndex;
            frameCounter.textContent = \`Frame \${currentFrameIndex + 1}/\${frameCount}\`;
            frameElements.forEach((frame, idx) => {
                frame.classList.toggle('current', idx === currentFrameIndex);
            });
        }
        function playAnimation() {
            if (animationInterval) return; // Already playing
            playBtn.disabled = true; pauseBtn.disabled = false;
            animationInterval = setInterval(() => {
                currentFrameIndex = (currentFrameIndex + 1) % frameCount;
                updateFrame(currentFrameIndex);
            }, intervalTime);
        }
        function pauseAnimation() {
            if (animationInterval) clearInterval(animationInterval);
            animationInterval = null;
            playBtn.disabled = false; pauseBtn.disabled = true;
        }
        function selectFrame(index) { pauseAnimation(); updateFrame(index); }

        playBtn.addEventListener('click', playAnimation);
        pauseBtn.addEventListener('click', pauseAnimation);
        frameSlider.addEventListener('input', () => { pauseAnimation(); updateFrame(parseInt(frameSlider.value)); });

        // Initialize
        updateFrame(0);
    <\/script>
</body>
</html>`;
}


/** Helper to confirm export size */
function confirmExportSize(frameCount) {
    if (frameCount > 45) { // Adjust threshold if needed
         return confirm(`Generate ${frameCount} frames? This might take significant time and memory, especially on lower-powered devices or complex logos. Continue?`);
    }
    return true;
}

/** Handle the main export process */
async function handleExport() {
    if (isExporting) { if(typeof showAlert ==='function') showAlert("Export already in progress.", "warning"); return; }

    // Get values FROM MODAL INPUTS
    const width = parseInt(modalWidthInput?.value);
    const height = parseInt(modalHeightInput?.value);
    const frameCount = parseInt(modalFramesInput?.value);
    const transparent = modalTransparentInput?.checked;

    console.log("[GIF UI] Starting Export Process. Settings:", { width, height, frameCount, transparent });

    // Validate settings
    if (isNaN(width) || isNaN(height) || isNaN(frameCount) || width <= 0 || height <= 0 || frameCount <= 0 || frameCount > 60) {
        if(typeof showAlert === 'function') showAlert("Invalid export settings (Width/Height > 0, Frames: 1-60).", "error");
        return;
    }
    if (!confirmExportSize(frameCount)) { console.log('[GIF UI] Export cancelled by user size confirmation.'); return; }

    // --- Start Export ---
    isExporting = true; resetCancelFlag(); updateModalProgress("Starting export...");
    if (exportBtn) exportBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (cancelExportBtnModal) { cancelExportBtnModal.disabled = false; cancelExportBtnModal.style.display = 'inline-block'; }
    stopPreview(); // Stop preview loop during export

    try {
        const getFilenameFunc = typeof window.Utils?.getLogoFilenameBase === 'function' ? window.Utils.getLogoFilenameBase : () => 'logo';
        const safeLogoText = getFilenameFunc();
        const logoText = document.querySelector('.logo-text')?.textContent || safeLogoText;

        // 1. Generate Export Frames
        updateModalProgress(`Generating ${frameCount} frames (0%)...`);
        const frames = await internalExportFrames({ // Assumes internalExportFrames wraps generateAnimationFrames
             width, height, frameCount, transparent,
             onProgress: (progress, message) => {
                 if (exportCancelled) throw new Error("Export cancelled");
                 updateModalProgress(message || `Generating frames (${Math.round(progress*100)}%)...`);
             }
         });
        if (exportCancelled || frames.length === 0) throw new Error(exportCancelled ? 'Export cancelled' : 'Frame generation failed');

        // 2. Prepare files for ZIP
        updateModalProgress("Packaging files...");
        const filesToZip = [];
        frames.forEach((blob, index) => { const pIdx = String(index).padStart(3, '0'); filesToZip.push({ blob, name: `${safeLogoText}-frame-${pIdx}.png` }); });
        if (exportCancelled) throw new Error('Export cancelled');

        // 3. Create HTML Preview and Info Text
        const previewHTML = createDetailedHTMLPreview({ logoName: safeLogoText, frameCount, width, height });
        const infoTXT = createInfoText(logoText, width, height, frameCount);
        filesToZip.push({ blob: new Blob([previewHTML], { type: 'text/html' }), name: `${safeLogoText}-preview.html` });
        filesToZip.push({ blob: new Blob([infoTXT], { type: 'text/plain' }), name: `${safeLogoText}-info.txt` });

        // 4. Create ZIP Blob using imported function
        if (exportCancelled) throw new Error('Export cancelled');
        const zipFilename = `${safeLogoText}-animation-frames.zip`;
        updateModalProgress("Creating ZIP package..."); // Update message

        // --- FIX START ---
        // Call createSimpleZip, then downloadZipBlob
        const zipBlob = await createSimpleZip(filesToZip); // Generate the blob
        if (exportCancelled) throw new Error('Export cancelled'); // Check again
        console.log(`[GIF UI] ZIP Blob created. Size: ${(zipBlob.size / 1024).toFixed(1)} KB`);
        updateModalProgress("Downloading ZIP...");
        downloadZipBlob(zipBlob, zipFilename); // Trigger download using imported function
        // --- FIX END ---

        if (exportCancelled) throw new Error('Export cancelled'); // Check after download trigger

        // 5. Success Notification & Cleanup
        const notifyFunc = typeof window.notifyExportSuccess === 'function' ? window.notifyExportSuccess : (f, fn) => showAlert(`${f} Export Complete! File: ${fn}`, 'success');
        notifyFunc('Animation Frames ZIP', zipFilename);
        closeModal();

    } catch (error) {
        hideModalProgress(); // Hide loading indicator on error
        if (error.message === 'Export cancelled') {
             if(typeof showAlert === 'function') showAlert('Export cancelled by user.', 'info');
             console.log('[GIF UI] Export process cancelled.');
        } else {
             console.error("[GIF UI] Export process failed:", error);
             if(typeof showAlert === 'function') showAlert(`Animation Export failed: ${error.message}`, 'error');
        }
    } finally {
        // Final cleanup regardless of success/failure
        isExporting = false;
        if(exportBtn) exportBtn.disabled = false;
        if(cancelBtn) cancelBtn.disabled = false;
        if(cancelExportBtnModal) cancelExportBtnModal.style.display = 'none';
        resetCancelFlag(); // Ensure flag is reset
        hideModalProgress(); // Ensure loading indicator is hidden
        console.log("[GIF UI] Export handle finished.");
    }
}

/** Cancel the ongoing export */
function cancelExport() {
    if (isExporting && !exportCancelled) {
         console.log('[GIF UI] Cancel export requested.');
         exportCancelled = true; // Set the flag
         updateModalProgress("Cancelling export...");
         if(cancelExportBtnModal) cancelExportBtnModal.disabled = true; // Disable cancel button after clicking
    } else if (exportCancelled) {
        console.log('[GIF UI] Cancellation already in progress.');
    } else {
        console.log('[GIF UI] No export in progress to cancel.');
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

    // Debounced preview restart on relevant input changes
    const debouncedPreviewRestart = debounce(startPreviewLoop, 400);
    modalFrameRateInput?.addEventListener('input', () => { // Update display immediately, restart loop debounced
         if(modalFrameRateValue) modalFrameRateValue.textContent = `${modalFrameRateInput.value} FPS`;
         debouncedPreviewRestart();
    });
    modalFramesInput?.addEventListener('input', debouncedPreviewRestart);
    modalTransparentInput?.addEventListener('change', debouncedPreviewRestart);
    // Width/Height are read-only, no listener needed

    // Add Escape key listener
    document.addEventListener('keydown', handleEscapeKey);

    modal.dataset.listenersAttached = 'true';
    console.log('[GIF UI] Event listeners attached.');
}

/** Remove event listeners */
function removeModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached !== 'true') return;
     console.log('[GIF UI] Removing event listeners...');
    // ... (remove all listeners added in attachModalEventListeners) ...
    closeBtn?.removeEventListener('click', closeModal);
    cancelBtn?.removeEventListener('click', closeModal);
    exportBtn?.removeEventListener('click', handleExport);
    cancelExportBtnModal?.removeEventListener('click', cancelExport);
    modal?.removeEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    // Remove listeners from inputs if they were added with named functions or store them
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


/** Sync settings from main UI to modal */
function syncExportSettings() {
    if (!isInitialized || !modal) { console.warn('[GIF UI] Cannot sync settings, UI not ready.'); return; }
    console.log('[GIF UI] Syncing settings from main UI...');
    try {
        // Read from main settings elements in Advanced Tab
        const mainWidth = document.getElementById('exportWidth')?.value || '800';
        const mainHeight = document.getElementById('exportHeight')?.value || '400';
        const mainFrames = document.getElementById('exportFrames')?.value || '15';
        const mainTransparent = document.getElementById('exportTransparent')?.checked || false;
        const mainFrameRate = document.getElementById('exportFrameRate')?.value || '10';

        // Apply to modal inputs
        if (modalWidthInput) modalWidthInput.value = mainWidth;
        if (modalHeightInput) modalHeightInput.value = mainHeight;
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
     // Define fallbacks if necessary (should ideally be done in main.js or similar entry point)
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
             } else {
                 throw new Error("Failed to find all necessary modal elements after injection.");
             }
         } catch (error) {
             console.error("[GIF UI] Initialization failed:", error);
             isInitialized = false;
             reject(error);
         }
    });
}

// --- PUBLIC EXPORTED FUNCTION ---

/**
 * Initializes and displays the GIF/Animation export UI modal.
 * Main function to call from external modules.
 * @returns {Promise<void>} Resolves when the modal is shown, rejects on init error.
 */
export async function exportGIFWithUI() {
    console.log('[GIF Exporter] exportGIFWithUI() called...');
    try {
        await initializeUI(); // Ensure UI is ready
        if (isInitialized) {
             openModal(); // Open the modal
        } else {
             throw new Error("GIF UI could not be initialized.");
        }
        return Promise.resolve();
    } catch (error) {
        console.error("[GIF Exporter] Cannot proceed with export:", error);
        if(typeof showAlert === 'function') showAlert(`Cannot open Animation exporter: ${error.message}`, 'error');
        return Promise.reject(error);
    }
}