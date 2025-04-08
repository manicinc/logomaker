/**
 * GIFRenderer.js - v2.0 - Enhanced Animation Export UI
 *
 * A comprehensive solution for exporting animations with multiple options:
 * - GIF export using gif.js if available
 * - ZIP package of PNG frames with HTML preview
 * - Individual PNG frame downloads
 *
 * Features:
 * - Two rendering methods: SVG-based (fast) and HTML2Canvas-based (accurate)
 * - Live animation preview
 * - Flexible export format options
 * - Improved error handling and fallbacks
 * - Windows compatibility fixes
 * - Better progress reporting
 */

// Core Rendering & Utilities
import { generateAnimationFrames, blobToDataURL } from './RendererCore.js'; // SVG-based frame generation
import { captureLogoWithHTML2Canvas } from '../utils/html2Canvas.js'; // Snapshot-based rendering
import { createZip, downloadZipBlob } from '../utils/zipUtils.js'; // ZIP utilities
import { generateGIF } from '../utils/gifUtils.js'; // GIF creation
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js'; // For animation metadata
import { getLogoFilenameBase } from '../utils/utils.js'; // For filename generation

// --- Module Constants ---
const MODAL_ID = 'gifExporterModal';
const STYLE_ID = 'gifExporterStylesV2';
const DIRECT_DOWNLOAD_THRESHOLD = 15; // Threshold for confirming large exports

// --- Internal Module State ---
let exportCancelled = false;
let previewInterval = null;
let previewFramesDataUrls = [];
let currentPreviewFrameIndex = 0;
let isExporting = false;
let isInitialized = false;
let html2canvasAvailable = false;
let gifLibraryAvailable = false; // If gif.js or a similar library is detected
let handleSettingsUpdateListener = null;

// --- DOM References ---
let modal, closeBtn, cancelBtn, exportBtn;
let previewImage, loadingIndicator, progressText;
let cancelExportBtnModal, modalWidthInput, modalHeightInput;
let modalFramesInput, modalTransparentInput, modalFrameRateInput;
let modalFrameRateValue, previewLoadingSpinner;
let svgRenderRadio, snapshotRenderRadio, snapshotWarning;
let exportFormatSelect, exportFormatInfo;

// --- CSS ---
const MODAL_CSS = `
:root {
  --exporter-accent: #ff1493; /* Deep Pink */
  --exporter-bg-dark: #0f0f1a; /* Dark background */
  --exporter-bg-medium: #1a1a2e; /* Medium-dark background */
  --exporter-text-light: #e8e8ff; /* Light text */
  --exporter-text-medium: #b0b0e0; /* Muted text */
  --exporter-border-color: #3a3a4a; /* Subtle border */
  --exporter-warning-color: #ffcc00; /* Yellow for warnings */
  --exporter-success-color: #00cc88; /* Green for success */
}

.gif-exporter-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(10, 10, 20, 0.9);
  display: none; /* toggled by JS */
  justify-content: center; align-items: center;
  z-index: 1001;
  padding: 2vh 2vw;
  box-sizing: border-box;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  overflow: hidden;
}
.gif-exporter-modal-content {
  background: linear-gradient(145deg, var(--exporter-bg-medium), var(--exporter-bg-dark));
  color: var(--exporter-text-light);
  padding: 25px 35px;
  border-radius: 10px;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 20, 147, 0.2);
  width: 100%;
  height: 100%;
  max-width: 1100px;
  max-height: 92vh;
  position: relative;
  border: 1px solid var(--exporter-border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  background: none;
  border: none;
  color: #aaa;
  font-size: 2.2em;
  line-height: 1;
  cursor: pointer;
  padding: 0 5px;
  transition: color 0.3s ease, transform 0.3s ease;
}
.gif-exporter-modal-close-btn:hover {
  color: var(--exporter-accent);
  transform: rotate(90deg);
}
.gif-exporter-modal-body {
  flex-grow: 1; display: flex; gap: 25px;
  overflow: hidden;
  padding-bottom: 15px;
}
.gif-exporter-preview-area {
  flex: 1.8;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 15px;
  overflow: hidden;
  border: 1px solid var(--exporter-border-color);
  min-height: 280px;
  position: relative;
}
.gif-exporter-preview-image-container {
  width: 100%; height: 100%;
  display: flex; justify-content: center; align-items: center;
  position: relative;
  /* Checkerboard for transparency */
  background-image:
    linear-gradient(45deg, #2a2a40 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a40 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a40 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a40 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  border-radius: 4px;
}
.gif-exporter-preview-spinner {
  border: 4px solid rgba(255, 255, 255, 0.15);
  border-left-color: var(--exporter-accent);
  border-radius: 50%;
  width: 35px; height: 35px;
  animation: gif-exporter-spin 0.8s linear infinite;
  position: absolute;
  top: calc(50% - 17.5px); left: calc(50% - 17.5px);
  z-index: 1;
}
.gif-exporter-preview-image {
  max-width: 100%; max-height: 280px;
  object-fit: contain; background-color: transparent;
  min-height: 50px; display: block; opacity: 1;
  position: relative; z-index: 2;
  transition: opacity 0.3s ease;
}
.gif-exporter-preview-image[src=""] {
  opacity: 0;
}

.gif-exporter-controls-area {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  padding-right: 10px; padding-left: 15px;
}

/* control-group styling */
.gif-exporter-controls-area .control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gif-exporter-controls-area label {
  font-weight: 500;
  color: var(--exporter-text-medium);
  font-size: 0.9em;
  display: block; margin-bottom: 3px;
}

/* Inputs and select elements */
.gif-exporter-controls-area input[type="number"],
.gif-exporter-controls-area input[type="range"],
.gif-exporter-controls-area select {
  width: 100%;
  padding: 8px 10px;
  background-color: #252535;
  border: 1px solid #4a4a5a;
  color: var(--exporter-text-light);
  border-radius: 4px;
  font-size: 0.95em;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.gif-exporter-controls-area input[readonly] {
  background-color: #1e1e2b;
  color: #888;
  cursor: not-allowed;
  border-style: dashed;
  opacity: 0.7;
}
.gif-exporter-controls-area input:focus:not([readonly]),
.gif-exporter-controls-area select:focus {
  border-color: var(--exporter-accent);
  outline: none;
}
.gif-exporter-controls-area input[type="range"] {
  padding: 0;
  cursor: pointer;
  height: 18px;
  accent-color: var(--exporter-accent);
}

/* Range container for FPS slider */
.gif-exporter-controls-area .range-container {
  display: flex; align-items: center; gap: 8px;
}
.gif-exporter-controls-area .range-container input[type="range"] {
  flex-grow: 1;
}
.gif-exporter-controls-area .range-container span {
  font-size: 0.8em; color: var(--exporter-text-medium);
  min-width: 45px; text-align: right;
}

/* Checkboxes */
.gif-exporter-controls-area .checkbox-label {
  display: flex; align-items: center; cursor: pointer;
  color: var(--exporter-text-medium);
  padding: 5px 0;
}
.gif-exporter-controls-area .checkbox-label:hover {
  color: var(--exporter-text-light);
}
.gif-exporter-controls-area input[type="checkbox"] {
  width: 15px; height: 15px;
  margin-right: 8px;
  accent-color: var(--exporter-accent);
  vertical-align: middle;
  cursor: pointer;
  flex-shrink: 0;
}
.gif-exporter-controls-area .checkbox-label label {
  margin-bottom: 0;
}

/* Format Selector */
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
  width: 100%; padding: 8px;
  background-color: #252535;
  color: var(--exporter-text-light);
  border: 1px solid #4a4a5a;
  border-radius: 4px;
}
.export-format-info {
  font-size: 0.85em; color: var(--exporter-text-medium);
  margin-top: 5px;
  font-style: italic;
}

/* Render Method Selector */
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
.render-method-selector .radio-option {
  display: flex; align-items: flex-start;
  margin-bottom: 10px; cursor: pointer;
}
.render-method-selector input[type="radio"] {
  margin-right: 10px; margin-top: 3px;
  accent-color: var(--exporter-accent);
  cursor: pointer;
  flex-shrink: 0;
}
.render-method-selector label {
  font-size: 0.9em;
  color: var(--exporter-text-medium);
  cursor: pointer;
  line-height: 1.3;
}
.render-method-selector label strong {
  color: var(--exporter-text-light); font-weight: 500;
}
.render-method-selector label span {
  font-size: 0.85em; color: var(--exporter-text-medium);
  display: block;
}
.render-method-selector input[type="radio"]:disabled + label {
  cursor: not-allowed; opacity: 0.6;
}
.render-method-selector .snapshot-warning {
  font-size: 0.85em; color: var(--exporter-warning-color);
  margin-top: 5px; padding: 8px;
  background: rgba(255, 204, 0, 0.1);
  border-left: 3px solid var(--exporter-warning-color);
  border-radius: 3px;
  display: none;
}

/* Info text block */
.gif-exporter-controls-area .info-text-block {
  font-size: 0.85em; color: var(--exporter-text-medium);
  margin-top: 10px; line-height: 1.4;
  padding: 10px;
  background: rgba(0,0,0,0.1);
  border-radius: 4px;
  border-left: 3px solid var(--exporter-accent);
}

/* Footer */
.gif-exporter-modal-footer {
  margin-top: 15px; padding-top: 15px;
  border-top: 1px solid var(--exporter-border-color);
  display: flex; justify-content: flex-end;
  align-items: center; gap: 12px; flex-shrink: 0;
}
.gif-exporter-modal-btn {
  padding: 9px 20px; font-size: 0.9em; font-weight: 600;
  border: none; border-radius: 5px;
  cursor: pointer; transition: all 0.2s ease;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.gif-exporter-modal-btn-primary {
  background-color: var(--exporter-accent);
  color: #fff;
  box-shadow: 0 2px 6px rgba(255, 20, 147, 0.2);
}
.gif-exporter-modal-btn-primary:hover:not(:disabled) {
  background-color: #ff47a3;
  box-shadow: 0 3px 10px rgba(255, 20, 147, 0.35);
  transform: translateY(-1px);
}
.gif-exporter-modal-btn-primary:disabled {
  background-color: #7a0a47;
  cursor: not-allowed;
  opacity: 0.6;
}
.gif-exporter-modal-btn-secondary {
  background-color: #4a4a5a;
  color: #ccc;
}
.gif-exporter-modal-btn-secondary:hover {
  background-color: #5a5a6a;
  color: #fff;
}

/* Loading overlay during export */
.gif-exporter-loading-indicator {
  position: absolute; inset: 0; background: rgba(10, 10, 20, 0.9);
  display: none; justify-content: center; align-items: center;
  z-index: 1002; flex-direction: column; gap: 15px;
  color: var(--exporter-text-light); text-align: center;
  border-radius: 12px; font-size: 1.1em;
}
.gif-exporter-loading-indicator .progress-text {
  font-weight: 500; margin-top: 5px;
}
.gif-exporter-loading-indicator .cancel-export-btn-modal {
  margin-top: 15px; padding: 8px 18px;
  background-color: #b71c1c; color: white;
  border: none; border-radius: 4px; cursor: pointer;
  font-size: 0.9em; transition: background-color 0.2s ease;
  display: none;
}
.gif-exporter-loading-indicator .cancel-export-btn-modal:hover {
  background-color: #d32f2f;
}
.gif-exporter-loading-indicator .gif-exporter-spinner {
  border: 4px solid rgba(255, 255, 255, 0.15);
  border-left-color: var(--exporter-accent);
  border-radius: 50%;
  width: 35px; height: 35px;
  animation: gif-exporter-spin 0.8s linear infinite;
}

@keyframes gif-exporter-spin {
  to { transform: rotate(360deg); }
}

/* Scrollbar for the controls panel */
.gif-exporter-controls-area::-webkit-scrollbar {
  width: 8px;
}
.gif-exporter-controls-area::-webkit-scrollbar-track {
  background: var(--exporter-bg-dark);
  border-radius: 4px;
}
.gif-exporter-controls-area::-webkit-scrollbar-thumb {
  background-color: var(--exporter-accent);
  border-radius: 4px;
  border: 2px solid var(--exporter-bg-dark);
}
`;

// --- HTML ---
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
          <img id="${MODAL_ID}PreviewImage"
               src=""
               alt="Animation Preview Area"
               class="gif-exporter-preview-image"
               style="opacity: 0;">
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
              <span>Captures the live preview appearance using html2canvas. This is <strong>much slower</strong> and requires the library. Accurately captures complex CSS effects.</span>
              <div id="${MODAL_ID}SnapshotWarning" class="snapshot-warning">
                <strong>Warning:</strong> Snapshot rendering can be very slow for many frames. Keep frames low for performance.
              </div>
            </label>
          </div>
          <div class="radio-option">
            <input type="radio" id="${MODAL_ID}MethodSvg" name="gifExportMethod" value="svgRender">
            <label for="${MODAL_ID}MethodSvg">
              <strong>SVG Render</strong> (Faster)
              <span>Generates frames from SVG data. Quick, fully offline, but some advanced CSS effects may not match exactly.</span>
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
            <input type="range" id="${MODAL_ID}FrameRate" min="1" max="30" value="10" step="1" title="Adjust preview animation speed">
            <span id="${MODAL_ID}FrameRateValue" class="range-value-display">10 FPS</span>
          </div>
        </div>

        <label class="checkbox-label control-group">
          <input type="checkbox" id="${MODAL_ID}Transparent">
          <label for="${MODAL_ID}Transparent" title="Use transparent background for frames">Transparent Background</label>
        </label>

        <div class="control-group info-text-block">
          <p>
            <strong>Export Format:</strong>
            <ul>
              <li><strong>GIF</strong>: Single animated GIF (requires gif.js)</li>
              <li><strong>ZIP Package</strong>: PNG frames + an HTML preview</li>
              <li><strong>Individual PNGs</strong>: Each frame downloaded separately + an HTML preview</li>
            </ul>
            <strong>Render Method:</strong> <br>
            Use <strong>Snapshot</strong> for accurate capture of CSS effects (slower), or <strong>SVG Render</strong> for faster output.
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
</div>
`;

// --- Debounce helper ---
function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Check for dependencies (html2canvas, gif.js, etc.)
 */
function checkDependencies() {
  // Check if html2canvas-based capture is available
  html2canvasAvailable = typeof captureLogoWithHTML2Canvas === 'function';
  if (!html2canvasAvailable) {
    console.warn('[Animation Exporter] html2canvas not found - snapshot mode disabled.');
  }

  // Check if GIF library (e.g., gif.js or GIFEncoder) is available
  gifLibraryAvailable = typeof GIFEncoder !== 'undefined';
  console.log(`[Animation Exporter] GIF library available: ${gifLibraryAvailable}`);
}

/**
 * Inject the CSS <style> block if not already present
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
 * Inject the HTML for the modal if not already present
 */
function injectModalHTML() {
  if (document.getElementById(MODAL_ID)) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = MODAL_HTML.trim();
  document.body.appendChild(wrapper.firstChild);
}

/**
 * Query DOM elements needed for operation
 * @returns {boolean} True if all elements found
 */
function queryModalElements() {
  modal = document.getElementById(MODAL_ID);
  if (!modal) return false;

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

  return !!(
    closeBtn && cancelBtn && exportBtn && previewImage &&
    loadingIndicator && progressText && cancelExportBtnModal &&
    modalWidthInput && modalHeightInput && modalFramesInput &&
    modalTransparentInput && modalFrameRateInput && modalFrameRateValue &&
    previewLoadingSpinner && svgRenderRadio && snapshotRenderRadio &&
    snapshotWarning && exportFormatSelect && exportFormatInfo
  );
}

/**
 * Updates the format info text based on the user selection
 */
function updateFormatInfoText() {
  if (!exportFormatSelect || !exportFormatInfo) return;
  const sel = exportFormatSelect.value;
  let info = '';

  switch (sel) {
    case 'auto':
      if (gifLibraryAvailable) {
        info = 'Will create an animated GIF if possible, otherwise a ZIP of PNG frames.';
      } else {
        info = 'GIF library not found, exporting as ZIP of PNG frames or individual files.';
      }
      break;
    case 'gif':
      if (gifLibraryAvailable) {
        info = 'Creates a single animated GIF file (gif.js library).';
      } else {
        info = 'GIF library not available—cannot create a GIF.';
      }
      break;
    case 'zip':
      info = 'Creates a ZIP archive with all PNG frames + an HTML preview.';
      break;
    case 'individual':
      info = 'Downloads each PNG frame separately (plus an HTML preview).';
      break;
  }

  exportFormatInfo.textContent = info;
}

/**
 * Update the export format options (e.g., disable GIF if library not found)
 */
function updateFormatOptions() {
  if (!exportFormatSelect) return;

  exportFormatSelect.innerHTML = '';
  // auto
  let optAuto = document.createElement('option');
  optAuto.value = 'auto';
  optAuto.textContent = 'Auto (Best Available)';
  exportFormatSelect.appendChild(optAuto);

  // gif
  let optGif = document.createElement('option');
  optGif.value = 'gif';
  optGif.textContent = gifLibraryAvailable ? 'Animated GIF' : 'Animated GIF (Not Available)';
  if (!gifLibraryAvailable) {
    optGif.disabled = true;
  }
  exportFormatSelect.appendChild(optGif);

  // zip
  let optZip = document.createElement('option');
  optZip.value = 'zip';
  optZip.textContent = 'ZIP Package of PNG Frames';
  exportFormatSelect.appendChild(optZip);

  // individual
  let optIndividual = document.createElement('option');
  optIndividual.value = 'individual';
  optIndividual.textContent = 'Individual PNG Files';
  exportFormatSelect.appendChild(optIndividual);

  exportFormatSelect.value = 'auto';
  updateFormatInfoText();
}

/**
 * Initializes the UI: injects styles, HTML, checks dependencies, etc.
 * @returns {Promise<boolean>} Resolves true if successful
 */
function initializeUI() {
  if (isInitialized) return Promise.resolve(true);

  try {
    checkDependencies();
    injectStyles();
    injectModalHTML();
    const success = queryModalElements();
    if (!success) {
      throw new Error('Failed to find required UI elements for GIF exporter');
    }

    updateFormatOptions();
    isInitialized = true;
    return Promise.resolve(true);
  } catch (err) {
    console.error('[Animation Exporter] Initialization error:', err);
    return Promise.reject(err);
  }
}

/**
 * Attach event listeners (once) to the modal and its elements
 */
function attachModalEventListeners() {
  if (!modal || modal.dataset.listenersAttached === 'true') return;

  // Render method changes
  function handleMethodChange() {
    updateSnapshotWarningVisibility();
    updateFramesInputLimit();
    startPreviewLoop();
  }

  function handleFormatChange() {
    updateFormatInfoText();
  }

  // Basic actions
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  exportBtn?.addEventListener('click', handleExport);
  cancelExportBtnModal?.addEventListener('click', cancelExport);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Input handlers
  const debouncedPreviewRestart = debounce(startPreviewLoop, 400);
  modalFramesInput?.addEventListener('input', debouncedPreviewRestart);
  modalTransparentInput?.addEventListener('change', debouncedPreviewRestart);
  svgRenderRadio?.addEventListener('change', handleMethodChange);
  snapshotRenderRadio?.addEventListener('change', handleMethodChange);
  exportFormatSelect?.addEventListener('change', handleFormatChange);

  // Frame rate slider
  modalFrameRateInput?.addEventListener('input', () => {
    if (modalFrameRateValue) {
      modalFrameRateValue.textContent = `${modalFrameRateInput.value} FPS`;
    }
    if (previewInterval) {
      startPreviewLoop();
    }
  });

  // Listen for global settings changes from the main UI
  handleSettingsUpdateListener = () => {
    if (modal.style.display === 'flex') {
      syncExportSettings();
      startPreviewLoop();
    }
  };
  document.addEventListener('logomaker-settings-updated', handleSettingsUpdateListener);

  // ESC key handler
  document.addEventListener('keydown', handleEscapeKey);

  modal.dataset.listenersAttached = 'true';
}

/**
 * Remove event listeners on close (optional)
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

  modal.removeAttribute('data-listenersAttached');
}

/**
 * Handles ESC key press
 */
function handleEscapeKey(e) {
  if (e.key === 'Escape' && modal?.style.display === 'flex') {
    closeModal();
  }
}

/**
 * Sync certain settings (width/height) from main UI
 */
function syncExportSettings() {
  try {
    const mainW = document.getElementById('exportWidth')?.value || '800';
    const mainH = document.getElementById('exportHeight')?.value || '400';

    if (modalWidthInput) modalWidthInput.value = mainW;
    if (modalHeightInput) modalHeightInput.value = mainH;

    updateFramesInputLimit();
    updateSnapshotWarningVisibility();
    updateFormatInfoText();
  } catch (err) {
    console.warn('[Animation Exporter] syncExportSettings error:', err);
  }
}

/**
 * Show/hide the Snapshot warning if snapshot is selected
 */
function updateSnapshotWarningVisibility() {
  if (!snapshotWarning || !snapshotRenderRadio) return;
  snapshotWarning.style.display = (snapshotRenderRadio.checked && html2canvasAvailable) ? 'block' : 'none';
}

/**
 * Update the valid frames range based on the selected method
 */
function updateFramesInputLimit() {
  if (!modalFramesInput) return;

  const isSnapshot = snapshotRenderRadio?.checked;
  const maxFrames = isSnapshot ? 30 : 60;
  const minFrames = 1;

  modalFramesInput.min = minFrames;
  modalFramesInput.max = maxFrames;

  const label = modalFramesInput.closest('.control-group')?.querySelector('label');
  if (label) {
    label.textContent = `Frames (${minFrames}-${maxFrames})`;
  }

  let val = parseInt(modalFramesInput.value);
  if (isNaN(val) || val < minFrames) val = minFrames;
  if (val > maxFrames) val = maxFrames;
  modalFramesInput.value = val;
}

/** 
 * Opens the modal
 */
function openModal() {
  if (!isInitialized || !modal) {
    console.error("[Animation Exporter] UI not ready or modal not found");
    if (typeof showAlert === 'function') {
      showAlert('Cannot open Animation Exporter: UI not ready.', 'error');
    }
    return;
  }

  resetCancelFlag();
  isExporting = false;
  exportBtn.disabled = false;
  cancelBtn.disabled = false;
  cancelExportBtnModal.style.display = 'none';
  hideModalProgress();

  if (!html2canvasAvailable && snapshotRenderRadio) {
    snapshotRenderRadio.disabled = true;
    snapshotRenderRadio.checked = false;
    if (svgRenderRadio) svgRenderRadio.checked = true;
  } else if (snapshotRenderRadio) {
    snapshotRenderRadio.disabled = false;
  }

  syncExportSettings();
  attachModalEventListeners();

  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      startPreviewLoop();
    });
  });
}

/** 
 * Closes the modal
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
 * Cancels an ongoing export
 */
function cancelExport() {
  if (isExporting && !exportCancelled) {
    console.log('[Animation Exporter] User cancelled export');
    exportCancelled = true;
    if (progressText) progressText.textContent = 'Cancelling export...';
    if (cancelExportBtnModal) cancelExportBtnModal.disabled = true;
  }
}

/** 
 * Resets the exportCancelled flag
 */
function resetCancelFlag() {
  exportCancelled = false;
  window.exportCancelled = false; // For code that checks this global
}

/**
 * Show and update the loading overlay
 * @param {string} message
 */
function updateModalProgress(message) {
  if (loadingIndicator && progressText) {
    loadingIndicator.style.display = 'flex';
    progressText.textContent = message;
  }
}

/** 
 * Hide the loading overlay
 */
function hideModalProgress() {
  if (loadingIndicator) loadingIndicator.style.display = 'none';
  if (progressText) progressText.textContent = '';
}

/**
 * Start or restart the preview loop
 */
async function startPreviewLoop() {
  stopPreview();

  if (!previewImage || !previewLoadingSpinner) return;

  previewLoadingSpinner.style.display = 'block';
  previewImage.style.opacity = '0';
  previewImage.src = '';

  try {
    await generatePreviewFrames();

    if (previewFramesDataUrls.length === 0) {
      previewImage.src = '';
      previewImage.alt = 'No preview frames';
      previewImage.style.opacity = '1';
      previewLoadingSpinner.style.display = 'none';
      return;
    }
    currentPreviewFrameIndex = 0;
    previewImage.src = previewFramesDataUrls[0];
    previewImage.alt = 'Animation Preview';

    previewImage.onload = () => {
      previewImage.style.opacity = '1';
      previewLoadingSpinner.style.display = 'none';
      previewImage.onload = null;
    };
    previewImage.onerror = () => {
      console.error('[Animation Exporter] Preview frame load error');
      previewImage.alt = 'Preview load failed';
      previewImage.style.opacity = '1';
      previewLoadingSpinner.style.display = 'none';
      previewImage.onerror = null;
    };

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
  } catch (err) {
    console.error('[Animation Exporter] Preview generation error:', err);
    previewLoadingSpinner.style.display = 'none';
    if (previewImage) {
      previewImage.src = '';
      previewImage.alt = 'Preview failed';
      previewImage.style.opacity = '1';
    }
    if (typeof showAlert === 'function') {
      showAlert(`Preview generation failed: ${err.message}`, 'warning');
    }
  }
}

/** 
 * Stop the preview loop
 */
function stopPreview() {
  if (previewInterval) {
    clearInterval(previewInterval);
    previewInterval = null;
  }
}

/**
 * Generates frames for the preview
 */
async function generatePreviewFrames() {
  previewFramesDataUrls = [];

  const useSnapshot = snapshotRenderRadio?.checked && html2canvasAvailable;
  const width = parseInt(modalWidthInput?.value || '400');
  const height = parseInt(modalHeightInput?.value || '300');
  const transparent = modalTransparentInput?.checked || false;
  const frameCount = Math.min(
    parseInt(modalFramesInput?.value) || 15,
    useSnapshot ? 10 : 20 // fewer frames for preview
  );

  if (frameCount <= 0) {
    console.warn('[Animation Exporter] Zero frames for preview');
    return;
  }

  let frameBlobs = [];
  if (useSnapshot) {
    frameBlobs = await generateSnapshotFrames({
      width,
      height,
      frameCount,
      transparent
    });
  } else {
    frameBlobs = await generateAnimationFrames({
      width,
      height,
      frameCount,
      transparent,
      onProgress: () => {}
    });
  }

  if (frameBlobs.length > 0) {
    previewFramesDataUrls = await Promise.all(
      frameBlobs.map((blob) => blobToDataURL(blob))
    );
  }
}

/**
 * Generates frames using snapshot (html2canvas) method
 * @param {object} options
 * @returns {Promise<Blob[]>}
 */
async function generateSnapshotFrames(options) {
  const { width, height, frameCount, transparent, onProgress } = options;
  if (!html2canvasAvailable) {
    throw new Error('Snapshot method unavailable (html2canvas missing)');
  }

  const previewEl = document.getElementById('previewContainer');
  const logoTextEl = previewEl?.querySelector('.logo-text');
  if (!previewEl || !logoTextEl) {
    throw new Error('No #previewContainer or .logo-text found');
  }

  const animData = extractSVGAnimationDetails();
  const durationMs = animData?.durationMs || 1000;
  if (!durationMs || durationMs <= 0) {
    if (onProgress) onProgress(0, 'Static snapshot frame...');
    const canvas = await captureLogoWithHTML2Canvas(previewEl, {
      width,
      height,
      transparentBackground: transparent,
      scale: window.devicePixelRatio * 1.5
    });
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Snapshot toBlob failed'))), 'image/png');
    });
    if (onProgress) onProgress(1, 'Captured static frame');
    return [blob];
  }

  const originalPlayState = logoTextEl.style.animationPlayState;
  const originalDelay = logoTextEl.style.animationDelay;
  const frames = [];
  logoTextEl.style.animationPlayState = 'paused';

  try {
    for (let i = 0; i < frameCount; i++) {
      if (exportCancelled) throw new Error('Export cancelled');

      const progress = frameCount === 1 ? 0 : i / (frameCount - 1);
      if (onProgress) {
        const percent = Math.round((i / frameCount) * 100);
        onProgress(i / frameCount, `Snapshot frame ${i + 1}/${frameCount} (${percent}%)`);
      }
      const negativeDelayMs = -(progress * durationMs);
      logoTextEl.style.animationDelay = `${negativeDelayMs}ms`;

      await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 5)));

      const canvas = await captureLogoWithHTML2Canvas(previewEl, {
        width,
        height,
        transparentBackground: transparent,
        scale: Math.max(1, Math.min(2, window.devicePixelRatio * 1.5))
      });
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Snapshot frame toBlob failed'))), 'image/png');
      });
      frames.push(blob);
    }
  } finally {
    logoTextEl.style.animationPlayState = originalPlayState;
    logoTextEl.style.animationDelay = originalDelay;
  }
  if (onProgress) onProgress(1, `Captured ${frames.length} snapshot frames`);
  return frames;
}

/**
 * Confirm large export with the user if needed
 * @param {number} frameCount
 * @param {string} renderMethod
 * @returns {Promise<boolean>}
 */
async function confirmExportSize(frameCount, renderMethod) {
  const threshold = renderMethod === 'snapshot' ? 15 : 40;
  if (frameCount <= threshold) return true;

  const msg = `
    You are about to export <strong>${frameCount} frames</strong> using
    <strong>${renderMethod.toUpperCase()} method</strong>.<br><br>
    Large exports, especially Snapshot, can be <strong>very slow</strong> and produce large files.<br><br>
    Continue?
  `;
  if (typeof window.showModal === 'function') {
    return window.showModal({
      title: 'Large Export Warning',
      message: msg,
      type: window.showModal.ModalType.WARNING,
      confirmText: 'Continue Export',
      cancelText: 'Cancel'
    });
  } else {
    const plain = msg.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '');
    return confirm(plain);
  }
}

/**
 * Main export handler
 */
async function handleExport() {
  if (isExporting) return;
  if (!modalWidthInput || !modalHeightInput || !modalFramesInput) return;

  const renderMethod = snapshotRenderRadio.checked ? 'snapshot' : 'svg';
  const width = parseInt(modalWidthInput.value) || 800;
  const height = parseInt(modalHeightInput.value) || 400;
  const frameCount = parseInt(modalFramesInput.value) || 15;
  const transparent = modalTransparentInput.checked || false;
  const fps = parseInt(modalFrameRateInput.value || '10');
  const delay = fps > 0 ? Math.round(1000 / fps) : 100;
  const exportFormat = exportFormatSelect.value || 'auto';

  const maxFrames = renderMethod === 'snapshot' ? 30 : 60;
  if (frameCount < 1 || frameCount > maxFrames) {
    if (typeof showAlert === 'function') {
      showAlert(`Frame count must be between 1 and ${maxFrames}`, 'warning');
    }
    return;
  }

  const proceed = await confirmExportSize(frameCount, renderMethod);
  if (!proceed) return;

  isExporting = true;
  resetCancelFlag();
  updateModalProgress(`Starting ${renderMethod.toUpperCase()} export (0%)...`);
  exportBtn.disabled = true;
  cancelBtn.disabled = true;
  cancelExportBtnModal.style.display = 'inline-block';
  cancelExportBtnModal.disabled = false;
  stopPreview();

  let success = false;
  let resultMsg = '';

  try {
    updateModalProgress('Generating animation frames...');
    let frameBlobs = [];
    if (renderMethod === 'snapshot') {
      frameBlobs = await generateSnapshotFrames({
        width,
        height,
        frameCount,
        transparent,
        onProgress: (p, msg) => {
          if (exportCancelled) throw new Error('Export cancelled');
          const percent = Math.round(p * 50);
          updateModalProgress(msg || `Snapshot frames: ${percent}%`);
        }
      });
    } else {
      frameBlobs = await generateAnimationFrames({
        width,
        height,
        frameCount,
        transparent,
        onProgress: (p, msg) => {
          if (exportCancelled) throw new Error('Export cancelled');
          const percent = Math.round(p * 50);
          updateModalProgress(msg || `Generating frames: ${percent}%`);
        }
      });
    }
    if (exportCancelled) throw new Error('Export cancelled');
    if (!frameBlobs || frameBlobs.length === 0) {
      throw new Error('Frame generation returned no frames');
    }

    // Create a base filename
    const textContent = document.querySelector('.logo-text')?.textContent || 'animation';
    const baseName = typeof getLogoFilenameBase === 'function'
      ? getLogoFilenameBase()
      : textContent.toLowerCase().replace(/[^a-z0-9-_]/gi, '-').substring(0, 30);

    updateModalProgress('Processing final output...');
    const exportResult = await generateGIF(frameBlobs, {
      width,
      height,
      delay,
      quality: 10,
      filenameBase: baseName,
      transparent,
      exportFormat,
      onProgress: (msg) => {
        if (exportCancelled) throw new Error('Export cancelled');
        updateModalProgress(msg);
      }
    });

    if (exportResult.success) {
      success = true;
      switch (exportResult.type) {
        case 'gif':
          resultMsg = `Exported GIF: ${exportResult.filename}`;
          break;
        case 'zip':
          resultMsg = `Exported ZIP: ${exportResult.filename}`;
          break;
        case 'individual':
          resultMsg = `Exported ${exportResult.downloadedCount} PNG frames individually`;
          break;
        default:
          resultMsg = 'Export completed successfully.';
      }
    } else {
      throw new Error(exportResult.error || 'Export failed.');
    }
  } catch (err) {
    console.error('[Animation Exporter] Export error:', err);
    if (err.message.includes('cancelled')) {
      updateModalProgress('Export cancelled.');
      if (typeof showAlert === 'function') {
        showAlert('Export cancelled.', 'info');
      }
    } else {
      updateModalProgress(`Export failed: ${err.message}`);
      if (typeof showAlert === 'function') {
        showAlert(`Animation export failed: ${err.message}`, 'error');
      }
    }
  } finally {
    isExporting = false;
    exportBtn.disabled = false;
    cancelBtn.disabled = false;
    cancelExportBtnModal.style.display = 'none';

    if (success) {
      if (typeof showAlert === 'function') {
        showAlert(resultMsg, 'success');
      }
      closeModal();
    }
  }
}

/**
 * Main entry function to open the GIF export UI
 */
export async function exportGIFWithUI() {
  try {
    await initializeUI();
    openModal();
  } catch (err) {
    console.error('[Animation Exporter] Cannot open UI:', err);
    if (typeof showAlert === 'function') {
      showAlert(`Cannot open Animation Exporter: ${err.message}`, 'error');
    }
  }
}

// For backward-compat naming
export const handleGIFExport = exportGIFWithUI;

// Export internal helpers if you need them externally
export {
  generateSnapshotFrames,
  generatePreviewFrames,
  initializeUI
};
