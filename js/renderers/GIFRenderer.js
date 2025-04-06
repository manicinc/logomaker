/**
 * GIFRenderer.js - v2.0 - Enhanced Animation Export UI
 * 
 * A comprehensive solution for exporting animations with multiple options:
 * - GIF export using gif.js if available
 * - ZIP package of PNG frames with HTML preview
 * - Individual PNG frame downloads
 * 
 * Features:
 * - Two rendering methods: SVG-based (fast) and HTML2Canvas (accurate)
 * - Live animation preview
 * - Flexible export format options
 * - Improved error handling and fallbacks
 * - Windows compatibility fixes
 * - Better progress reporting
 */

// Core Rendering & Utilities
import { generateAnimationFrames, blobToDataURL } from './RendererCore.js'; // SVG-based frame generation
import { captureLogoWithHTML2Canvas } from '../utils/html2Canvas.js'; // For Snapshot rendering
import { createZip, downloadZipBlob } from '../utils/zipUtils.js'; // ZIP utilities
import { generateGIF } from '../utils/gifUtils.js'; // GIF generation utility
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js'; // For animation metadata
import { getLogoFilenameBase } from '../utils/utils.js'; // For filename generation

// --- Module Constants ---
const MODAL_ID = 'gifExporterModal';
const STYLE_ID = 'gifExporterStylesV2';
const DIRECT_DOWNLOAD_THRESHOLD = 15; // Frames count for confirmation

// --- Module Scope Variables ---
let exportCancelled = false;
let previewInterval = null;
let previewFramesDataUrls = [];
let currentPreviewFrameIndex = 0;
let isExporting = false;
let isInitialized = false;
let html2canvasAvailable = false;
let handleSettingsUpdateListener = null;
let gifLibraryAvailable = false; // Track if gif.js is available

// --- DOM Element References ---
let modal, closeBtn, cancelBtn, exportBtn;
let previewImage, loadingIndicator, progressText;
let cancelExportBtnModal, modalWidthInput, modalHeightInput;
let modalFramesInput, modalTransparentInput, modalFrameRateInput;
let modalFrameRateValue, previewLoadingSpinner;
let svgRenderRadio, snapshotRenderRadio, snapshotWarning;
let exportFormatSelect, exportFormatInfo; // Format selection UI

const MODAL_CSS = `
:root {
    --exporter-accent: #ff1493; /* Deep Pink */
    --exporter-bg-dark: #0f0f1a; /* Darker background */
    --exporter-bg-medium: #1a1a2e; /* Medium dark */
    --exporter-text-light: #e8e8ff; /* Light text */
    --exporter-text-medium: #b0b0e0; /* Muted text */
    --exporter-border-color: #3a3a4a; /* Softer border */
    --exporter-warning-color: #ffcc00; /* Yellow for warnings */
    --exporter-success-color: #00cc88; /* Green for success */
}
.gif-exporter-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(10, 10, 20, 0.9);
    display: none; /* Modified by JS */
    justify-content: center; align-items: center;
    z-index: 1001; padding: 2vh 2vw; box-sizing: border-box;
    backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
    overflow: hidden;
}
.gif-exporter-modal-content {
    background: linear-gradient(145deg, var(--exporter-bg-medium), var(--exporter-bg-dark));
    color: var(--exporter-text-light);
    padding: 25px 35px;
    border-radius: 10px;
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 20, 147, 0.2);
    width: 100%; height: 100%; max-width: 1100px; max-height: 92vh;
    position: relative; border: 1px solid var(--exporter-border-color);
    display: flex; flex-direction: column; overflow: hidden;
}
.gif-exporter-modal-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 15px;
    border-bottom: 1px solid var(--exporter-accent);
    padding-bottom: 12px; flex-shrink: 0;
}
.gif-exporter-modal-header h2 {
    margin: 0; font-size: 1.6em;
    font-weight: 600;
    color: var(--exporter-accent);
    text-shadow: 0 0 4px rgba(255, 20, 147, 0.4);
}
.gif-exporter-modal-close-btn {
    background: none; border: none; color: #aaa; font-size: 2.2em;
    line-height: 1; cursor: pointer; padding: 0 5px; transition: color 0.3s ease, transform 0.3s ease;
}
.gif-exporter-modal-close-btn:hover { color: var(--exporter-accent); transform: rotate(90deg); }
.gif-exporter-modal-body {
    flex-grow: 1; display: flex; gap: 25px;
    overflow: hidden; padding-bottom: 15px;
}
.gif-exporter-preview-area {
    flex: 1.8; display: flex;
    flex-direction: column; justify-content: center; align-items: center;
    background-color: rgba(0, 0, 0, 0.2); border-radius: 6px;
    padding: 15px; overflow: hidden; border: 1px solid var(--exporter-border-color);
    min-height: 280px; position: relative;
}
.gif-exporter-preview-image-container {
    width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;
    position: relative;
    /* Checkerboard background for transparency */
    background-image: linear-gradient(45deg, #2a2a40 25%, transparent 25%), linear-gradient(-45deg, #2a2a40 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a40 75%), linear-gradient(-45deg, transparent 75%, #2a2a40 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    border-radius: 4px;
}
.gif-exporter-preview-spinner {
    border: 4px solid rgba(255, 255, 255, 0.15);
    border-left-color: var(--exporter-accent);
    border-radius: 50%; width: 35px; height: 35px;
    animation: gif-exporter-spin 0.8s linear infinite;
    position: absolute; top: calc(50% - 17.5px); left: calc(50% - 17.5px); z-index: 1;
}
.gif-exporter-preview-image {
    max-width: 100%; max-height: 280px;
    object-fit: contain; background-color: transparent;
    min-height: 50px; display: block; opacity: 1; position: relative; z-index: 2;
    transition: opacity 0.3s ease;
}
.gif-exporter-preview-image[src=""] { opacity: 0; }

.gif-exporter-controls-area {
    flex: 1; display: flex; flex-direction: column; gap: 15px;
    overflow-y: auto; padding-right: 10px; padding-left: 15px;
}
.gif-exporter-controls-area .control-group { display: flex; flex-direction: column; gap: 6px; }
.gif-exporter-controls-area label { font-weight: 500; color: var(--exporter-text-medium); font-size: 0.9em; display: block; margin-bottom: 3px; }
.gif-exporter-controls-area input[type="number"], 
.gif-exporter-controls-area input[type="range"],
.gif-exporter-controls-area select {
    width: 100%; padding: 8px 10px; background-color: #252535; 
    border: 1px solid #4a4a5a; color: var(--exporter-text-light); 
    border-radius: 4px; font-size: 0.95em; box-sizing: border-box; 
    transition: border-color 0.2s;
}
.gif-exporter-controls-area input[readonly] {
    background-color: #1e1e2b; color: #888; cursor: not-allowed; border-style: dashed; opacity: 0.7;
}
.gif-exporter-controls-area input:focus:not([readonly]),
.gif-exporter-controls-area select:focus {
    border-color: var(--exporter-accent); outline: none;
}
.gif-exporter-controls-area input[type="range"] { padding: 0; cursor: pointer; height: 18px; accent-color: var(--exporter-accent); }
.gif-exporter-controls-area .range-container { display: flex; align-items: center; gap: 8px; }
.gif-exporter-controls-area .range-container input[type="range"] { flex-grow: 1; }
.gif-exporter-controls-area .range-container span { font-size: 0.8em; color: var(--exporter-text-medium); min-width: 45px; text-align: right; }
.gif-exporter-controls-area .checkbox-label { display: flex; align-items: center; cursor: pointer; color: var(--exporter-text-medium); padding: 5px 0; }
.gif-exporter-controls-area .checkbox-label:hover { color: var(--exporter-text-light); }
.gif-exporter-controls-area input[type="checkbox"] { width: 15px; height: 15px; margin-right: 8px; accent-color: var(--exporter-accent); vertical-align: middle; cursor: pointer; flex-shrink: 0; }
.gif-exporter-controls-area .checkbox-label label { margin-bottom: 0; }

/* Export Format Selection */
.export-format-selector {
    margin-top: 10px;
    background-color: rgba(0,0,0,0.1);
    border-radius: 6px;
    border: 1px solid var(--exporter-border-color);
    padding: 15px;
}
.export-format-selector legend {
    font-weight: 600; padding: 0 5px;
    font-size: 0.95em; color: var(--exporter-text-light);
}
.export-format-option {
    margin-bottom: 15px;
}
.export-format-selector label {
    display: block;
    margin-bottom: 6px;
    color: var(--exporter-text-light);
    font-weight: 500;
}
.export-format-selector select {
    width: 100%;
    padding: 8px;
    background-color: #252535;
    color: var(--exporter-text-light);
    border: 1px solid #4a4a5a;
    border-radius: 4px;
}
.export-format-info {
    font-size: 0.85em;
    color: var(--exporter-text-medium);
    margin-top: 5px;
    font-style: italic;
}
.format-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75em;
    margin-left: 5px;
    vertical-align: middle;
}
.badge-recommended {
    background-color: var(--exporter-success-color);
    color: #000;
}
.badge-fallback {
    background-color: var(--exporter-warning-color);
    color: #000;
}
.badge-unavailable {
    background-color: #666;
    color: #ddd;
}

/* Render Method Selection */
.render-method-selector {
    margin-top: 10px; padding: 15px;
    background-color: rgba(0,0,0,0.1);
    border-radius: 6px;
    border: 1px solid var(--exporter-border-color);
}
.render-method-selector legend {
    font-weight: 600; padding: 0 5px; margin-bottom: 10px;
    font-size: 0.95em; color: var(--exporter-text-light);
}
.render-method-selector .radio-option { display: flex; align-items: flex-start; margin-bottom: 10px; cursor: pointer; }
.render-method-selector input[type="radio"] { margin-right: 10px; margin-top: 3px; accent-color: var(--exporter-accent); cursor: pointer; flex-shrink: 0; }
.render-method-selector label { font-size: 0.9em; color: var(--exporter-text-medium); cursor: pointer; line-height: 1.3; }
.render-method-selector label strong { color: var(--exporter-text-light); font-weight: 500; }
.render-method-selector label span { font-size: 0.85em; color: var(--exporter-text-medium); display: block; }
.render-method-selector input[type="radio"]:disabled + label { cursor: not-allowed; opacity: 0.6; }
.render-method-selector .snapshot-warning {
    font-size: 0.85em; color: var(--exporter-warning-color); margin-top: 5px; padding: 8px;
    background: rgba(255, 204, 0, 0.1); border-left: 3px solid var(--exporter-warning-color); border-radius: 3px;
    display: none; /* Shown by JS if snapshot is selected */
}

.gif-exporter-controls-area .info-text-block {
    font-size: 0.85em; color: var(--exporter-text-medium); margin-top: 10px; line-height: 1.4;
    padding: 10px; background: rgba(0,0,0,0.1); border-radius: 4px; border-left: 3px solid var(--exporter-accent);
}

.gif-exporter-modal-footer { margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--exporter-border-color); display: flex; justify-content: flex-end; align-items: center; gap: 12px; flex-shrink: 0; }
.gif-exporter-modal-btn { padding: 9px 20px; font-size: 0.9em; font-weight: 600; border: none; border-radius: 5px; cursor: pointer; transition: all 0.2s ease; text-transform: uppercase; letter-spacing: 0.5px; }
.gif-exporter-modal-btn-primary { background-color: var(--exporter-accent); color: #fff; box-shadow: 0 2px 6px rgba(255, 20, 147, 0.2); }
.gif-exporter-modal-btn-primary:hover:not(:disabled) { background-color: #ff47a3; box-shadow: 0 3px 10px rgba(255, 20, 147, 0.35); transform: translateY(-1px); }
.gif-exporter-modal-btn-primary:disabled { background-color: #7a0a47; cursor: not-allowed; opacity: 0.6; }
.gif-exporter-modal-btn-secondary { background-color: #4a4a5a; color: #ccc; }
.gif-exporter-modal-btn-secondary:hover { background-color: #5a5a6a; color: #fff; }

/* Loading overlay during export */
.gif-exporter-loading-indicator {
    position: absolute; inset: 0; background: rgba(10, 10, 20, 0.9); 
    display: none; justify-content: center; align-items: center; 
    z-index: 1002; flex-direction: column; gap: 15px; 
    color: var(--exporter-text-light); text-align: center; 
    border-radius: 12px; font-size: 1.1em;
}
.gif-exporter-loading-indicator .progress-text { font-weight: 500; margin-top: 5px; }
.gif-exporter-loading-indicator .cancel-export-btn-modal { 
    margin-top: 15px; padding: 8px 18px; background-color: #b71c1c; 
    color: white; border: none; border-radius: 4px; cursor: pointer; 
    font-size: 0.9em; transition: background-color 0.2s ease; display: none;
}
.gif-exporter-loading-indicator .cancel-export-btn-modal:hover { background-color: #d32f2f; }
.gif-exporter-loading-indicator .gif-exporter-spinner { 
    border: 4px solid rgba(255, 255, 255, 0.15); 
    border-left-color: var(--exporter-accent); 
    border-radius: 50%; width: 35px; height: 35px; 
    animation: gif-exporter-spin 0.8s linear infinite; 
}
@keyframes gif-exporter-spin { to { transform: rotate(360deg); } }

/* Scrollbar */
.gif-exporter-controls-area::-webkit-scrollbar { width: 8px; }
.gif-exporter-controls-area::-webkit-scrollbar-track { background: var(--exporter-bg-dark); border-radius: 4px; }
.gif-exporter-controls-area::-webkit-scrollbar-thumb { background-color: var(--exporter-accent); border-radius: 4px; border: 2px solid var(--exporter-bg-dark); }
`;

// --- HTML Structure (Updated with export format options) ---
const MODAL_HTML = `
<div id="${MODAL_ID}" class="gif-exporter-modal-overlay">
  <div class="gif-exporter-modal-content">
    <div class="gif-exporter-modal-header">
      <h2>Animation Exporter</h2>
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
          <input type="number" id="${MODAL_ID}Width" value="800"
                 readonly title="Output width is set in the Advanced tab.">
        </div>
        <div class="control-group">
          <label for="${MODAL_ID}Height">Height (px)</label>
          <input type="number" id="${MODAL_ID}Height" value="400"
                 readonly title="Output height is set in the Advanced tab.">
        </div>
        
        <!-- Export Format Selector -->
        <fieldset class="export-format-selector">
          <legend>Export Options</legend>
          <div class="export-format-option">
            <label for="${MODAL_ID}ExportFormat">Export Format:</label>
            <select id="${MODAL_ID}ExportFormat">
              <option value="auto">Auto (Best Available)</option>
              <option value="gif">Animated GIF</option>
              <option value="zip">ZIP Package of PNG Frames</option>
              <option value="individual">Individual PNG Files</option>
            </select>
            <div id="${MODAL_ID}FormatInfo" class="export-format-info">
              Select the best available format automatically.
            </div>
          </div>
        </fieldset>
        
        <!-- Render Method Selector -->
        <fieldset class="render-method-selector">
          <legend>Render Method:</legend>
          <div class="radio-option">
            <input type="radio" id="${MODAL_ID}MethodSnapshot" name="gifExportMethod" value="snapshot" checked>
            <label for="${MODAL_ID}MethodSnapshot">
              <strong>Snapshot</strong> (Accurate, WYSIWYG)
              <span>Takes a snapshot of the live preview using html2canvas. Captures appearance exactly, but is <strong>much slower</strong> and requires the library to be loaded.</span>
              <div id="${MODAL_ID}SnapshotWarning" class="snapshot-warning">
                <strong>Warning:</strong> Snapshot rendering can be very slow, especially with many frames. Limit frames for reasonable export times.
              </div>
            </label>
          </div>
          <div class="radio-option">
            <input type="radio" id="${MODAL_ID}MethodSvg" name="gifExportMethod" value="svgRender">
            <label for="${MODAL_ID}MethodSvg">
              <strong>SVG Render</strong> (Fast, Vector Based)
              <span>Generates frames from SVG data. Faster, fully offline, but may not capture all complex CSS effects perfectly.</span>
            </label>
          </div>
        </fieldset>

        <div class="control-group">
          <label for="${MODAL_ID}Frames">Frames (SVG: 1-60, Snapshot: 1-30)</label>
          <input type="number" id="${MODAL_ID}Frames" min="1" max="60" value="15" title="Number of animation frames to generate">
        </div>
        <div class="control-group">
          <label for="${MODAL_ID}FrameRate">Preview Speed (FPS)</label>
          <div class="range-container">
            <input type="range" id="${MODAL_ID}FrameRate" min="1" max="30" value="10" step="1" title="Adjust the speed of this preview animation.">
            <span id="${MODAL_ID}FrameRateValue" class="range-value-display">10 FPS</span>
          </div>
        </div>
        <label class="checkbox-label control-group">
          <input type="checkbox" id="${MODAL_ID}Transparent">
          <label for="${MODAL_ID}Transparent" title="Export frames with transparent background instead of current style.">Transparent Background</label>
        </label>
        <div class="control-group info-text-block">
          <p>
            <strong>Export options:</strong>
            <ul>
              <li><strong>GIF:</strong> Creates an animated GIF file if the library is available</li>
              <li><strong>ZIP Package:</strong> Contains all PNG frames + HTML preview</li>
              <li><strong>Individual PNGs:</strong> Downloads each frame separately</li>
            </ul>
            <strong>Note:</strong> Choose <strong>SVG Render</strong> for speed and basic animations, or <strong>Snapshot</strong> for capturing complex CSS effects accurately (slower).
          </p>
        </div>
      </div>
    </div>
    <div class="gif-exporter-modal-footer">
      <button id="${MODAL_ID}CancelBtn" class="gif-exporter-modal-btn gif-exporter-modal-btn-secondary">Close</button>
      <button id="${MODAL_ID}ExportBtn" class="gif-exporter-modal-btn gif-exporter-modal-btn-primary">Export Animation</button>
    </div>
    <div id="${MODAL_ID}LoadingIndicator" class="gif-exporter-loading-indicator">
      <div class="gif-exporter-spinner"></div>
      <div class="progress-text" id="${MODAL_ID}ProgressText">Preparing...</div>
      <button id="${MODAL_ID}CancelExportBtn" class="cancel-export-btn-modal">Cancel Export</button>
    </div>
  </div>
</div>`;

// --- Core Utility Functions ---

/**
 * Simple debounce function for UI updates
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Debounce delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(fn, ms) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Check if the necessary dependencies are available
 * Updates module scope variables accordingly
 */
function checkDependencies() {
    // Check for html2canvas (for snapshot mode)
    html2canvasAvailable = typeof captureLogoWithHTML2Canvas === 'function';
    if (!html2canvasAvailable) {
        console.warn('[Animation Exporter] html2canvas not found - snapshot method will be disabled');
    }
    
    // Check for gif.js library
    gifLibraryAvailable = typeof GIFEncoder !== 'undefined';
    console.log(`[Animation Exporter] GIF library available: ${gifLibraryAvailable}`);
}

/**
 * Inject the CSS styles into the document head
 */
function injectStyles() {
    if (!document.getElementById(STYLE_ID)) {
        const styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent = MODAL_CSS;
        document.head.appendChild(styleEl);
    }
}

/**
 * Inject the modal HTML into the document body
 */
function injectModalHTML() {
    if (document.getElementById(MODAL_ID)) return;
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = MODAL_HTML.trim();
    const modalElement = wrapper.firstChild;
    document.body.appendChild(modalElement);
}

/**
 * Query and store references to all modal DOM elements
 * @returns {boolean} True if all elements were found
 */
function queryModalElements() {
    modal = document.getElementById(MODAL_ID);
    if (!modal) return false;
    
    // Query all DOM elements needed for interaction
    closeBtn = document.getElementById(`${MODAL_ID}CloseBtn`);
    cancelBtn = document.getElementById(`${MODAL_ID}CancelBtn`);
    exportBtn = document.getElementById(`${MODAL_ID}ExportBtn`);
    previewImage = document.getElementById(`${MODAL_ID}PreviewImage`);
    loadingIndicator = document.getElementById(`${MODAL_ID}LoadingIndicator`);
    progressText = document.getElementById(`${MODAL_ID}ProgressText`);
    cancelExportBtnModal = document.getElementById(`${MODAL_ID}CancelExportBtn`);
    modalWidthInput = document.getElementById(`${MODAL_ID}Width`);
    modalHeightInput = document.getElementById(`${MODAL_ID}Height`);
    modalFramesInput = document.getElementById(`${MODAL_ID}Frames`);
    modalTransparentInput = document.getElementById(`${MODAL_ID}Transparent`);
    modalFrameRateInput = document.getElementById(`${MODAL_ID}FrameRate`);
    modalFrameRateValue = document.getElementById(`${MODAL_ID}FrameRateValue`);
    previewLoadingSpinner = document.getElementById(`${MODAL_ID}PreviewSpinner`);
    svgRenderRadio = document.getElementById(`${MODAL_ID}MethodSvg`);
    snapshotRenderRadio = document.getElementById(`${MODAL_ID}MethodSnapshot`);
    snapshotWarning = document.getElementById(`${MODAL_ID}SnapshotWarning`);
    exportFormatSelect = document.getElementById(`${MODAL_ID}ExportFormat`);
    exportFormatInfo = document.getElementById(`${MODAL_ID}FormatInfo`);
    
    // Ensure all critical elements were found
    return !!(
        closeBtn && cancelBtn && exportBtn && previewImage &&
        loadingIndicator && progressText && cancelExportBtnModal &&
        modalWidthInput && modalHeightInput && modalFramesInput &&
        modalTransparentInput && modalFrameRateInput && modalFrameRateValue &&
        previewLoadingSpinner && svgRenderRadio && snapshotRenderRadio &&
        snapshotWarning && exportFormatSelect && exportFormatInfo
    );
}

// --- Initialize the UI ---

/**
 * Initialize the Animation Exporter UI
 * @returns {Promise<boolean>} True if initialization succeeded
 */
function initializeUI() {
    if (isInitialized) return Promise.resolve(true);
    
    try {
        // Check dependencies first
        checkDependencies();
        
        // Inject CSS and modal HTML
        injectStyles();
        injectModalHTML();
        
        // Query modal elements
        const elementsFound = queryModalElements();
        if (!elementsFound) {
            return Promise.reject(new Error("Failed to find Animation Exporter modal elements"));
        }
        
        // Update export format options
        updateFormatOptions();
        
        // Set initialization flag
        isInitialized = true;
        return Promise.resolve(true);
    } catch (error) {
        console.error("[Animation Exporter] Initialization error:", error);
        return Promise.reject(error);
    }
}

/**
 * Updates the export format options based on available libraries
 */
function updateFormatOptions() {
    if (!exportFormatSelect) return;
    
    // Clear existing options
    exportFormatSelect.innerHTML = "";
    
    // Always add the auto option
    const autoOption = document.createElement("option");
    autoOption.value = "auto";
    autoOption.textContent = "Auto (Best Available)";
    exportFormatSelect.appendChild(autoOption);
    
    // Add GIF option (with status indicator)
    const gifOption = document.createElement("option");
    gifOption.value = "gif";
    gifOption.textContent = "Animated GIF";
    if (!gifLibraryAvailable) {
        gifOption.textContent += " (Library Not Found)";
        gifOption.disabled = true;
    }
    exportFormatSelect.appendChild(gifOption);
    
    // Add ZIP option
    const zipOption = document.createElement("option");
    zipOption.value = "zip";
    zipOption.textContent = "ZIP Package of PNG Frames";
    exportFormatSelect.appendChild(zipOption);
    
    // Add individual files option
    const individualOption = document.createElement("option");
    individualOption.value = "individual";
    individualOption.textContent = "Individual PNG Files";
    exportFormatSelect.appendChild(individualOption);
    
    // Set initial selection based on availability
    exportFormatSelect.value = "auto";
    
    // Set initial format info text
    updateFormatInfoText();
}

/**
 * Updates the format info text based on the selected format
 */
function updateFormatInfoText() {
    if (!exportFormatInfo || !exportFormatSelect) return;
    
    const selectedFormat = exportFormatSelect.value;
    let infoText = "";
    
    switch (selectedFormat) {
        case "auto":
            if (gifLibraryAvailable) {
                infoText = "Will create an animated GIF using the best available method.";
            } else {
                infoText = "Will create a ZIP package of PNG frames (GIF library not available).";
            }
            break;
        case "gif":
            if (gifLibraryAvailable) {
                infoText = "Creates a single animated GIF file.";
            } else {
                infoText = "GIF creation requires the gif.js library which is not available.";
            }
            break;
        case "zip":
            infoText = "Creates a ZIP package containing all PNG frames and an HTML preview file.";
            break;
        case "individual":
            infoText = "Downloads each frame as a separate PNG file plus an HTML preview.";
            break;
    }
    
    exportFormatInfo.textContent = infoText;
}

// --- Modal Control Functions ---

/**
 * Opens the animation exporter modal dialog
 */
function openModal() {
    if (!isInitialized || !modal) {
        console.error("[Animation Exporter] UI not initialized or modal element not found");
        if (typeof showAlert === 'function') {
            showAlert("Cannot open Animation Exporter: UI not ready.", "error");
        }
        return;
    }
    
    resetCancelFlag();
    isExporting = false;
    exportBtn.disabled = false;
    cancelBtn.disabled = false;
    cancelExportBtnModal.style.display = 'none';
    hideModalProgress();

    // Configure render method options based on availability
    if (!html2canvasAvailable && snapshotRenderRadio) {
        console.log("[Animation Exporter] html2canvas unavailable, disabling snapshot radio");
        snapshotRenderRadio.disabled = true;
        snapshotRenderRadio.checked = false;
        if (svgRenderRadio) svgRenderRadio.checked = true;
    } else if (snapshotRenderRadio) {
        snapshotRenderRadio.disabled = false;
    }

    // Update UI elements
    updateSnapshotWarningVisibility();
    updateFramesInputLimit();
    updateFormatOptions();
    syncExportSettings();
    attachModalEventListeners();

    // Make modal visible
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        document.body.style.overflow = 'hidden';
        // Start preview generation after modal is displayed
        requestAnimationFrame(() => {
            startPreviewLoop();
        });
    });
}

/**
 * Closes the animation exporter modal dialog
 */
function closeModal() {
    if (!modal) return;
    
    stopPreview();
    hideModalProgress();
    detachModalEventListeners();
    modal.style.display = 'none';
    document.body.style.overflow = '';

    if (isExporting) {
        cancelExport();
    }
}

/**
 * Shows or updates the progress overlay during export
 * @param {string} message - Status message to display
 */
function updateModalProgress(message) {
    if (loadingIndicator && progressText) {
        loadingIndicator.style.display = 'flex';
        progressText.textContent = message;
    }
}

/**
 * Hides the progress overlay
 */
function hideModalProgress() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    if (progressText) {
        progressText.textContent = '';
    }
}

/**
 * Cancels the current export operation
 */
function cancelExport() {
    if (isExporting && !exportCancelled) {
        console.log("[Animation Exporter] User initiated export cancellation");
        exportCancelled = true;
        
        if (progressText) {
            progressText.textContent = "Cancelling export, please wait...";
        }
        if (cancelExportBtnModal) {
            cancelExportBtnModal.disabled = true;
        }
    }
}

/**
 * Resets the cancellation flag
 */
function resetCancelFlag() {
    exportCancelled = false;
    window.exportCancelled = false; // Also set global flag for utilities
}

// --- Preview Functions ---

/**
 * Starts or restarts the animation preview loop
 */
async function startPreviewLoop() {
    stopPreview(); // Stop any existing preview
    
    if (!previewImage || !previewLoadingSpinner) {
        console.error("[Animation Exporter] Preview image or spinner element missing");
        return;
    }

    // Show spinner and hide previous image
    previewLoadingSpinner.style.display = 'block';
    previewImage.style.opacity = '0';
    previewImage.removeAttribute('src');

    try {
        // Generate preview frames
        await generatePreviewFrames();
        
        // Check if frames were successfully generated
        if (previewFramesDataUrls.length === 0) {
            console.warn("[Animation Exporter] No preview frames were generated");
            previewImage.src = '';
            previewImage.alt = "Preview unavailable";
            previewImage.style.opacity = '1';
            previewLoadingSpinner.style.display = 'none';
            return;
        }

        // Start animation with first frame
        currentPreviewFrameIndex = 0;
        previewImage.src = previewFramesDataUrls[0];
        previewImage.alt = "Animation Preview";
        
        // Handle image load events
        previewImage.onload = () => {
            previewImage.style.opacity = '1';
            previewLoadingSpinner.style.display = 'none';
            previewImage.onload = null;
        };
        
        previewImage.onerror = () => {
            console.error("[Animation Exporter] Failed to load preview frame");
            previewImage.alt = "Preview failed to load";
            previewImage.style.opacity = '1';
            previewLoadingSpinner.style.display = 'none';
            previewImage.onerror = null;
        };

        // Start animation interval if more than one frame
        if (previewFramesDataUrls.length > 1) {
            const fps = Math.max(1, parseInt(modalFrameRateInput?.value || '10'));
            const intervalMs = 1000 / fps;
            
            previewInterval = setInterval(() => {
                if (!previewImage || previewFramesDataUrls.length === 0) {
                    stopPreview();
                    return;
                }
                currentPreviewFrameIndex = (currentPreviewFrameIndex + 1) % previewFramesDataUrls.length;
                previewImage.src = previewFramesDataUrls[currentPreviewFrameIndex];
            }, intervalMs);
        }
    } catch (error) {
        console.error("[Animation Exporter] Error during preview generation:", error);
        previewLoadingSpinner.style.display = 'none';
        
        if (previewImage) {
            previewImage.src = '';
            previewImage.alt = "Preview failed to load";
            previewImage.style.opacity = '1';
        }
        
        if (typeof showAlert === 'function') {
            showAlert(`Preview generation failed: ${error.message}`, 'warning');
        }
    }
}

/**
 * Stops the preview animation loop
 */
function stopPreview() {
    if (previewInterval) {
        clearInterval(previewInterval);
        previewInterval = null;
    }
}

/**
 * Generates preview frames based on selected render method
 */
async function generatePreviewFrames() {
    // Clear previous frames
    previewFramesDataUrls = [];

    // Determine rendering method
    const useSnapshotMethod = snapshotRenderRadio?.checked && html2canvasAvailable;
    const renderMethod = useSnapshotMethod ? 'Snapshot' : 'SVG Render';
    
    console.log(`[Animation Exporter] Generating preview using ${renderMethod} method`);

    // Get parameters from UI
    const width = parseInt(modalWidthInput?.value) || 400;
    const height = parseInt(modalHeightInput?.value) || 300;
    const transparent = modalTransparentInput?.checked || false;
    const frameCount = Math.min(
        parseInt(modalFramesInput?.value) || 15,
        useSnapshotMethod ? 10 : 20 // Fewer frames for preview
    );

    if (frameCount <= 0) {
        console.warn("[Animation Exporter] Preview frame count is zero or less, skipping generation");
        return;
    }

    let frameBlobs = [];

    try {
        if (useSnapshotMethod) {
            // Generate frames using Snapshot method
            frameBlobs = await generateSnapshotFrames({
                width, height, frameCount, transparent
            });
        } else {
            // Generate frames using SVG method
            frameBlobs = await generateAnimationFrames({
                width, height, frameCount, transparent,
                onProgress: () => {} // Empty progress handler for preview
            });
        }

        // Convert blobs to data URLs for preview
        if (frameBlobs.length > 0) {
            previewFramesDataUrls = await Promise.all(
                frameBlobs.map(blob => blobToDataURL(blob))
            );
            console.log(`[Animation Exporter] Generated ${previewFramesDataUrls.length} preview frames`);
        } else {
            console.warn("[Animation Exporter] Frame generation resulted in zero frame blobs");
        }
    } catch (error) {
        console.error(`[Animation Exporter] Preview frame generation failed:`, error);
        previewFramesDataUrls = [];
        throw error;
    }
}

/**
 * Generates animation frames using the Snapshot method
 * @param {Object} options - Generation options
 * @returns {Promise<Array<Blob>>} Array of frame blobs
 */
async function generateSnapshotFrames(options) {
    const { width, height, frameCount, transparent, onProgress } = options;
    
    if (!html2canvasAvailable) {
        throw new Error("Snapshot method unavailable (html2canvas dependency missing)");
    }
    
    // Find preview container and logo text element
    const previewEl = document.querySelector('#previewContainer');
    const logoTextEl = previewEl?.querySelector('.logo-text');
    
    if (!previewEl || !logoTextEl) {
        throw new Error("Cannot find #previewContainer or .logo-text required for snapshot");
    }
    
    // Get animation details
    const animData = extractSVGAnimationDetails();
    const durationMs = animData?.durationMs || 1000;
    
    // Handle static case (no animation)
    if (!durationMs || durationMs <= 0) {
        console.warn("[Animation Exporter] No animation detected or duration is zero, capturing static frame");
        
        if (onProgress) onProgress(0, "Capturing static frame...");
        
        const canvas = await captureLogoWithHTML2Canvas(previewEl, {
            width, height, 
            transparentBackground: transparent, 
            scale: window.devicePixelRatio * 1.5
        });
        
        const blob = await new Promise((resolve, reject) => 
            canvas.toBlob(b => b ? resolve(b) : reject(new Error("Static snapshot canvas toBlob failed")), 'image/png')
        );
        
        if (onProgress) onProgress(1, "Captured single static frame");
        return [blob];
    }
    
    // Animated case - save original animation state
    const originalAnimPlayState = logoTextEl.style.animationPlayState;
    const originalAnimDelay = logoTextEl.style.animationDelay;
    const snapshotScale = Math.max(1, Math.min(2, window.devicePixelRatio * 1.5));
    const frames = [];
    
    try {
        // Pause animation for frame control
        logoTextEl.style.animationPlayState = 'paused';
        
        for (let i = 0; i < frameCount; i++) {
            // Check for cancellation
            if (exportCancelled) {
                throw new Error("Export cancelled");
            }
            
            // Calculate animation progress (0 to 1)
            const progress = frameCount === 1 ? 0 : i / (frameCount - 1);
            
            // Update progress
            if (onProgress) {
                const percent = Math.round((i / frameCount) * 100);
                onProgress(i / frameCount, `Capturing snapshot frame ${i + 1}/${frameCount} (${percent}%)...`);
            }
            
            // Set animation to specific point in time
            const negativeDelayMs = -(progress * durationMs);
            logoTextEl.style.animationDelay = `${negativeDelayMs}ms`;
            
            // Force reflow/repaint to apply style change
            await new Promise(resolve => 
                requestAnimationFrame(() => setTimeout(resolve, 5))
            );
            
            // Capture the frame
            const canvas = await captureLogoWithHTML2Canvas(previewEl, {
                width, height,
                transparentBackground: transparent,
                scale: snapshotScale,
                logging: false
            });
            
            const blob = await new Promise((resolve, reject) =>
                canvas.toBlob(b => b ? resolve(b) : reject(new Error(`Snapshot Frame ${i} canvas toBlob failed`)), 'image/png')
            );
            
            frames.push(blob);
        }
    } finally {
        // Restore original animation state
        logoTextEl.style.animationPlayState = originalAnimPlayState;
        logoTextEl.style.animationDelay = originalAnimDelay;
    }
    
    if (onProgress) {
        onProgress(1, `Finished capturing ${frames.length} snapshot frames`);
    }
    
    return frames;
}

// --- Export Functionality ---

/**
 * Handles the export button click
 * Main entry point for export functionality
 */
async function handleExport() {
    // Check if export is already in progress
    if (isExporting) {
        console.warn("[Animation Exporter] Export already in progress");
        return;
    }
    
    // Validate required elements
    if (!modalWidthInput || !modalHeightInput || !modalFramesInput) {
        console.error("[Animation Exporter] Required UI elements not found");
        return;
    }
    
    // Get export parameters from UI
    const renderMethod = snapshotRenderRadio.checked ? 'snapshot' : 'svg';
    const width = parseInt(modalWidthInput.value) || 800;
    const height = parseInt(modalHeightInput.value) || 400;
    const frameCount = parseInt(modalFramesInput.value) || 15;
    const transparent = modalTransparentInput?.checked || false;
    const fps = parseInt(modalFrameRateInput?.value || '10');
    const delay = fps > 0 ? Math.round(1000 / fps) : 100;
    const exportFormat = exportFormatSelect?.value || 'auto';
    
    // Validate frame count
    const maxFrames = (renderMethod === 'snapshot') ? 30 : 60;
    if (frameCount <= 0 || frameCount > maxFrames) {
        if (typeof showAlert === 'function') {
            showAlert(`Invalid frame count. Please use 1-${maxFrames} frames.`, 'warning');
        }
        return;
    }
    
    // Confirm large export
    const proceed = await confirmExportSize(frameCount, renderMethod);
    if (!proceed) return;
    
    // Initialize export state
    isExporting = true;
    resetCancelFlag();
    updateModalProgress(`Starting ${renderMethod.toUpperCase()} export... (0%)`);
    exportBtn.disabled = true;
    cancelBtn.disabled = true;
    cancelExportBtnModal.style.display = 'inline-block';
    cancelExportBtnModal.disabled = false;
    stopPreview();
    
    let exportSuccess = false;
    let resultMessage = '';
    
    try {
        // 1. Generate PNG frame blobs
        updateModalProgress('Generating animation frames...');
        let frameBlobs;
        
        if (renderMethod === 'snapshot') {
            frameBlobs = await generateSnapshotFrames({
                width, height, frameCount, transparent,
                onProgress: (progress, msg) => {
                    if (exportCancelled) throw new Error("Export cancelled by user");
                    const percent = Math.round(progress * 50); // First 50% of progress
                    updateModalProgress(msg || `Generating frames: ${percent}%`);
                }
            });
        } else {
            frameBlobs = await generateAnimationFrames({
                width, height, frameCount, transparent,
                onProgress: (progress, msg) => {
                    if (exportCancelled) throw new Error("Export cancelled by user");
                    const percent = Math.round(progress * 50); // First 50% of progress
                    updateModalProgress(msg || `Generating frames: ${percent}%`);
                }
            });
        }
        
        if (exportCancelled) throw new Error("Export cancelled by user");
        if (!frameBlobs || frameBlobs.length === 0) {
            throw new Error("Frame generation failed or returned no frames");
        }
        
        // 2. Determine filename base
        const logoTextContent = document.querySelector('.logo-text')?.textContent || 'animation';
        const filenameBase = typeof getLogoFilenameBase === 'function' ? 
            getLogoFilenameBase() : 
            logoTextContent.toLowerCase().replace(/[^a-z0-9-_]/gi, '-').substring(0, 30);
        
        // 3. Create and export animation using appropriate method
        updateModalProgress('Processing animation output...');
        
        const exportResult = await generateGIF(frameBlobs, {
            width,
            height,
            delay,
            quality: 10,
            filenameBase,
            transparent,
            exportFormat,
            onProgress: (msg) => {
                if (exportCancelled) throw new Error("Export cancelled by user");
                updateModalProgress(msg);
            }
        });
        
        // 4. Process result
        if (exportResult.success) {
            console.log(`[Animation Exporter] Export successful, type: ${exportResult.type}`);
            exportSuccess = true;
            
            // Customize success message based on export type
            switch (exportResult.type) {
                case 'gif':
                    resultMessage = `Exported animated GIF: ${exportResult.filename}`;
                    break;
                case 'zip':
                    resultMessage = `Exported ZIP package: ${exportResult.filename}`;
                    break;
                case 'individual':
                    resultMessage = `Exported ${exportResult.downloadedCount} individual PNG frames`;
                    break;
                default:
                    resultMessage = 'Export completed successfully';
            }
        } else {
            throw new Error(exportResult.error || "Export failed with unknown error");
        }
        
    } catch (error) {
        console.error("[Animation Exporter] Export error:", error);
        
        if (error.message.includes('cancelled')) {
            updateModalProgress('Export cancelled.');
            if (typeof showAlert === 'function') {
                showAlert('Export cancelled by user.', 'info');
            }
        } else {
            updateModalProgress(`Export failed: ${error.message}`);
            if (typeof showAlert === 'function') {
                showAlert(`Animation export failed: ${error.message}`, 'error');
            }
        }
    } finally {
        // Reset UI state
        isExporting = false;
        exportBtn.disabled = false;
        cancelBtn.disabled = false;
        cancelExportBtnModal.style.display = 'none';
        
        // Show final result or close modal on success
        if (exportSuccess) {
            if (typeof showAlert === 'function') {
                showAlert(resultMessage, 'success');
            }
            closeModal();
        }
    }
}

/**
 * Confirm potentially slow/large export with the user
 * @param {number} frameCount - Number of frames to be exported
 * @param {string} renderMethod - Rendering method ('snapshot' or 'svg')
 * @returns {Promise<boolean>} True if user confirms, false otherwise
 */
async function confirmExportSize(frameCount, renderMethod) {
    const warningThreshold = (renderMethod === 'snapshot') ? 15 : 40;
    
    if (frameCount <= warningThreshold) {
        return true; // No confirmation needed for smaller exports
    }
    
    const message = `
        You are about to export <strong>${frameCount} frames</strong> using the
        <strong>${renderMethod.toUpperCase()} method</strong>.<br><br>
        Exports with many frames, especially using the Snapshot method, can be <strong>very slow</strong> and generate large files.<br><br>
        Are you sure you want to continue?`;
    
    // Use modal system if available
    if (typeof window.showModal === 'function' && typeof window.showModal.ModalType === 'object') {
        return window.showModal({
            title: 'Large Export Warning',
            message: message,
            type: window.showModal.ModalType.WARNING,
            confirmText: 'Continue Export',
            cancelText: 'Cancel'
        });
    } else {
        // Fallback to basic confirm
        const plainMsg = message.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
        return confirm(plainMsg);
    }
}

// --- UI Helper Functions ---

/**
 * Shows or hides the warning text for Snapshot mode
 */
function updateSnapshotWarningVisibility() {
    if (!snapshotWarning || !snapshotRenderRadio) return;
    
    snapshotWarning.style.display = (snapshotRenderRadio.checked && html2canvasAvailable) ? 'block' : 'none';
}

/**
 * Adjusts maximum frames and label based on selected render method
 */
function updateFramesInputLimit() {
    if (!modalFramesInput || !snapshotRenderRadio || !svgRenderRadio) return;
    
    const isSnapshot = snapshotRenderRadio.checked;
    const maxFrames = isSnapshot ? 30 : 60;
    const minFrames = 1;
    
    modalFramesInput.max = maxFrames;
    modalFramesInput.min = minFrames;
    
    // Update label text
    const label = modalFramesInput.closest('.control-group')?.querySelector('label');
    if (label) {
        label.textContent = `Frames (${minFrames} - ${maxFrames})`;
    }
    
    // Clamp current value if needed
    let currentValue = parseInt(modalFramesInput.value);
    if (isNaN(currentValue) || currentValue < minFrames) {
        modalFramesInput.value = minFrames;
    } else if (currentValue > maxFrames) {
        modalFramesInput.value = maxFrames;
    }
}

/**
 * Syncs read-only fields (Width/Height) with global settings
 */
function syncExportSettings() {
    try {
        // Sync dimensions from main UI
        const mainWidth = document.getElementById('exportWidth')?.value || '800';
        const mainHeight = document.getElementById('exportHeight')?.value || '400';
        
        if (modalWidthInput) modalWidthInput.value = mainWidth;
        if (modalHeightInput) modalHeightInput.value = mainHeight;
        
        // Update UI after sync
        updateFramesInputLimit();
        updateSnapshotWarningVisibility();
        updateFormatInfoText();
    } catch (error) {
        console.error("[Animation Exporter] Error syncing settings:", error);
    }
}

// --- Event Listeners ---

/**
 * Attach event listeners to modal elements
 */
function attachModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached === 'true') return;
    
    const handleMethodChange = () => {
        updateSnapshotWarningVisibility();
        updateFramesInputLimit();
        startPreviewLoop();
    };
    
    const handleFormatChange = () => {
        updateFormatInfoText();
    };
    
    // Attach core UI event listeners
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    exportBtn?.addEventListener('click', handleExport);
    cancelExportBtnModal?.addEventListener('click', cancelExport);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    // Input control listeners
    const debouncedPreviewRestart = debounce(startPreviewLoop, 400);
    modalFramesInput?.addEventListener('input', debouncedPreviewRestart);
    modalTransparentInput?.addEventListener('change', debouncedPreviewRestart);
    svgRenderRadio?.addEventListener('change', handleMethodChange);
    snapshotRenderRadio?.addEventListener('change', handleMethodChange);
    exportFormatSelect?.addEventListener('change', handleFormatChange);
    
    // Frame rate control
    modalFrameRateInput?.addEventListener('input', () => {
        if (modalFrameRateValue) {
            modalFrameRateValue.textContent = `${modalFrameRateInput.value} FPS`;
        }
        if (previewInterval) {
            startPreviewLoop();
        }
    });
    
    // Global settings listener
    handleSettingsUpdateListener = () => {
        if (modal.style.display === 'flex') {
            syncExportSettings();
            startPreviewLoop();
        }
    };
    document.addEventListener('logomaker-settings-updated', handleSettingsUpdateListener);
    
    // Escape key handler
    document.addEventListener('keydown', handleEscapeKey);
    
    modal.dataset.listenersAttached = 'true';
}

/**
 * Detach event listeners from modal elements
 */
function detachModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached !== 'true') return;
    
    closeBtn?.removeEventListener('click', closeModal);
    cancelBtn?.removeEventListener('click', closeModal);
    exportBtn?.removeEventListener('click', handleExport);
    cancelExportBtnModal?.removeEventListener('click', cancelExport);
    modal?.removeEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    modalFramesInput?.removeEventListener('input', startPreviewLoop);
    modalTransparentInput?.removeEventListener('change', startPreviewLoop);
    svgRenderRadio?.removeEventListener('change', startPreviewLoop);
    snapshotRenderRadio?.removeEventListener('change', startPreviewLoop);
    exportFormatSelect?.removeEventListener('change', updateFormatInfoText);
    
    if (handleSettingsUpdateListener) {
        document.removeEventListener('logomaker-settings-updated', handleSettingsUpdateListener);
        handleSettingsUpdateListener = null;
    }
    
    document.removeEventListener('keydown', handleEscapeKey);
    
    modal.removeAttribute('data-listeners-attached');
}

/**
 * Handles Escape key press to close modal
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleEscapeKey(e) {
    if (e.key === 'Escape' && modal?.style.display === 'flex') {
        closeModal();
    }
}

// --- Main Export Function ---

/**
 * Main entry point: Opens the Animation Exporter UI
 * @returns {Promise<void>}
 */
export async function exportGIFWithUI() {
    try {
        await initializeUI();
        openModal();
    } catch (error) {
        console.error("[Animation Exporter] Cannot open UI:", error);
        if (typeof showAlert === 'function') {
            showAlert(`Cannot open Animation Exporter: ${error.message}`, 'error');
        }
    }
}

// For backwards compatibility
export const handleGIFExport = exportGIFWithUI;

// Export utility functions for testing/external access
export {
    generateSnapshotFrames,
    generatePreviewFrames,
    initializeUI
};

