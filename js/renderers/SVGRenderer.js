/**
 * SVGRenderer.js (v2.1 - Fixed & Refined)
 * =========================================
 * Provides a UI modal for exporting the generated logo
 * as an SVG file, preserving vector qualities.
 *
 * Features:
 * - Modal-based UI with SVG preview (rendered via data URL).
 * - Displays relevant metadata (fonts, colors, animation).
 * - Option for transparent background.
 * - Syncs dimensions/transparency with main UI settings.
 *
 * Relies on:
 * - RendererCore.js (generateConsistentPreview, generateSVGBlob)
 * - captureTextStyles.js (captureAdvancedStyles)
 * - svgAnimationInfo.js (extractSVGAnimationDetails)
 * - Utility functions like showAlert, showToast, Utils.downloadBlob, Utils.getLogoFilenameBase (optional, provide fallbacks)
 *
 * Assumes:
 * - Main UI elements (#exportWidth, #exportHeight, #exportTransparent) exist for initial settings sync.
 */

import { generateConsistentPreview, generateSVGBlob } from './RendererCore.js';
import { captureAdvancedStyles } from '../captureTextStyles.js';
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js';

/* -----------------------------------------------------
   Module-Scope Variables & Constants
------------------------------------------------------ */
let isInitialized = false;          // Prevent multiple initializations
let handleSettingsUpdatedListener = null; // Reference for the global listener

const MODAL_ID = 'svgExportModal';  // ID for the main modal element
const STYLE_ID = 'svgExporterStyles'; // ID for the injected styles

/* -----------------------------------------------------
   DOM Element References (populated by queryModalElements)
------------------------------------------------------ */
let modalElement = null,
    closeBtn = null,
    cancelBtn = null,
    exportBtn = null,
    previewImage = null,         // The <img> tag for the preview
    loadingIndicator = null,
    loadingProgressText = null,  // Specific reference for progress text
    widthInput = null,
    heightInput = null,
    transparentCheckbox = null,  // Renamed from transpCheck for consistency
    metadataInfoDiv = null;      // Renamed from metaInfoDiv

let modalClickListener;         // To store the background click listener reference
let previewUpdateHandler;       // To store the transparency checkbox listener reference

/* -----------------------------------------------------
   CSS for the SVG Exporter Modal
   (Refined layout, consistent with PNGRenderer)
------------------------------------------------------ */
const MODAL_CSS = `
/* SVG Exporter Modal Styles (v2.1 - Refined) */
.svg-exporter-modal {
  position: fixed;
  inset: 0;
  display: none; /* Controlled by JS */
  justify-content: center;
  align-items: center;
  z-index: 1510; /* Slightly higher than PNG modal if both used */
  background: rgba(0, 0, 0, 0.6);
  overflow-y: auto; /* Allow scroll */
  padding: 1rem; /* Base padding */
}

.svg-exporter-modal.active {
    opacity: 1; visibility: visible; transition: opacity 0.3s ease, visibility 0s linear 0s; /* Add transform transitions here if desired */ 
  }

.svg-exporter-modal .modal-content {
  background: var(--panel-bg, #f5f5f5);
  color: var(--text-color, #333);
  max-width: 650px;
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 18px rgba(0,0,0,0.3);
  padding: 1.5rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 90vh;
  overflow: hidden;
  /* ---> ADD THESE LINES <--- */
  opacity: 1 !important; /* Override opacity: 0 */
  transform: none !important; /* Override scale(0.95) */
  /* Optional: Add transition */
  transition: opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s;
}

.svg-exporter-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

.svg-exporter-modal .modal-header h3 { /* Use h3 for consistency */
  font-size: 1.3rem;
  margin: 0;
}

.svg-exporter-modal .modal-header button {
  background: none; border: none;
  font-size: 1.8rem; color: var(--text-color-muted, #666);
  cursor: pointer; padding: 0.2rem; line-height: 1;
}
.svg-exporter-modal .modal-header button:hover {
    color: var(--text-color, #333);
}

.svg-exporter-modal .modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  overflow-y: auto; /* Allow body scroll */
  padding-right: 5px;
  margin-right: -5px;
}

/* Preview Area */
.svg-exporter-modal .exporter-preview-area {
  position: relative;
  width: 100%;
  /* Aspect ratio (optional, can let content define height) */
  /* padding-top: 56.25%; 16:9 */
  background-color: rgba(0,0,0,0.05);
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  overflow: hidden;
  min-height: 150px; /* Ensure minimum space */
}

/* Preview Image (<img> tag) */
.svg-exporter-modal .exporter-preview-image {
  display: none; /* Shown once loaded */
  width: 100%;
  max-height: 350px; /* Limit max height of preview */
  height: auto;
  object-fit: contain; /* Scale SVG preview */
  /* Checkerboard background */
  background: repeating-conic-gradient(var(--border-subtle, #ccc) 0% 25%, var(--panel-bg-opaque, #fff) 0% 50%) 50% / 20px 20px;
  background-size: 20px 20px;
  border: 0;
}
body.dark-mode .svg-exporter-modal .exporter-preview-image {
  background: repeating-conic-gradient(var(--border-color, #444) 0% 25%, var(--panel-bg, #282828) 0% 50%) 50% / 20px 20px;
  background-size: 20px 20px;
}

/* Loading Indicator */
.svg-exporter-modal .exporter-preview-loading {
  position: absolute; inset: 0;
  background: rgba(255, 255, 255, 0.8);
  display: none; /* Initially hidden */
  flex-direction: column; justify-content: center; align-items: center;
  z-index: 2; color: var(--text-color, #333);
  border-radius: inherit; text-align: center;
  transition: opacity 0.2s ease; font-size: 0.9rem;
}
.svg-exporter-modal .exporter-preview-loading.visible {
    display: flex; /* Show loading */
}
body.dark-mode .svg-exporter-modal .exporter-preview-loading {
  background: rgba(20, 20, 20, 0.8); color: #ccc;
}

.svg-exporter-modal .exporter-preview-loading .spinner {
  border: 4px solid rgba(var(--accent-color-rgb, 255, 20, 147), 0.2);
  border-left-color: var(--accent-color, #ff1493);
  border-radius: 50%; width: 32px; height: 32px;
  animation: svg-spin 1s linear infinite;
  margin-bottom: 0.8rem;
}
@keyframes svg-spin { to { transform: rotate(360deg); } }

/* Controls Area */
.svg-exporter-modal .exporter-controls-area {
  display: grid;
  grid-template-columns: auto 1fr; /* Label | Control */
  gap: 0.8rem 1rem; /* Row gap | Column gap */
  align-items: center;
}

.svg-exporter-modal .control-group label {
  grid-column: 1 / 2;
  font-weight: 500;
  font-size: 0.9rem;
  text-align: right;
  white-space: nowrap;
}
.svg-exporter-modal .control-group input[type="number"] {
  grid-column: 2 / 3;
  padding: 0.4rem 0.6rem;
  font-size: 0.9rem;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
  background-color: var(--input-bg, #fff);
  max-width: 120px; /* Limit width of number inputs */
}

.svg-exporter-modal input[readonly] {
  background-color: var(--bg-base, #eee);
  opacity: 0.7; cursor: not-allowed;
}
body.dark-mode .svg-exporter-modal input[readonly] {
    background-color: var(--input-bg-disabled, #333);
}

.svg-exporter-modal .checkbox-label {
  grid-column: 2 / 3; /* Align with inputs */
  display: flex; align-items: center; gap: 0.6rem;
  cursor: pointer; font-size: 0.9rem;
}
.svg-exporter-modal .checkbox-label input[type="checkbox"] {
  width: 17px; height: 17px; margin: 0; /* Reset margin */
  accent-color: var(--accent-color, #ff1493);
  cursor: pointer;
}

/* Info Text */
.svg-exporter-modal .svg-exporter-info-text {
  grid-column: 1 / 3; /* Span both columns */
  font-size: 0.85rem;
  color: var(--text-color-muted, #666);
  line-height: 1.4;
  background-color: var(--info-bg-subtle, rgba(0,0,0,0.03));
  padding: 0.6rem 0.8rem;
  border-radius: 4px;
  margin: 0.5rem 0 0 0; /* Add some top margin */
}
body.dark-mode .svg-exporter-modal .svg-exporter-info-text {
    background-color: rgba(255,255,255,0.05);
    color: var(--text-color-muted-dark, #aaa);
}
.svg-exporter-modal .svg-exporter-info-text strong {
    color: var(--text-color, #333);
}
body.dark-mode .svg-exporter-modal .svg-exporter-info-text strong {
    color: var(--text-color-emphasis, #eee);
}


/* Metadata Info Box */
.svg-exporter-modal .svg-metadata-info {
  margin-top: 1rem; /* Space between preview and metadata */
  background: var(--bg-subtle, #f9f9f9);
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
  font-size: 0.85rem;
  max-height: 150px; /* Increased max height */
  overflow-y: auto;
  padding: 0.8rem 1rem; /* Increased padding */
  color: var(--text-color-muted, #555);
}
body.dark-mode .svg-exporter-modal .svg-metadata-info {
  background: rgba(255,255,255,0.05);
  color: #bbb;
  border-color: var(--border-color-dark, #444);
}
.svg-exporter-modal .svg-metadata-info h4 {
  margin: 0 0 0.6rem 0; /* Adjusted margin */
  font-size: 1rem;
  color: var(--text-color, #333);
  border-bottom: 1px solid var(--border-subtle, #ddd);
  padding-bottom: 0.4rem;
  font-weight: 600;
}
body.dark-mode .svg-exporter-modal .svg-metadata-info h4 {
  color: #eee;
  border-bottom-color: #555;
}
.svg-exporter-modal .svg-metadata-info ul {
  margin: 0; padding: 0; list-style: none;
}
.svg-exporter-modal .svg-metadata-info li {
  margin-bottom: 0.4rem;
  word-break: break-word;
  line-height: 1.5;
}
.svg-exporter-modal .svg-metadata-info li:last-child {
    margin-bottom: 0;
}
.svg-exporter-modal .svg-metadata-info code {
  background: var(--code-bg, #e8e8e8);
  color: var(--code-text, #333);
  padding: 2px 5px; /* Slightly more padding */
  border-radius: 3px;
  font-size: 0.9em; /* Inherit size slightly smaller */
}
body.dark-mode .svg-exporter-modal .svg-metadata-info code {
  background: #2c2c2c; color: #ddd;
}

/* Modal Footer */
.svg-exporter-modal .modal-footer {
  display: flex; justify-content: flex-end; gap: 0.8rem;
  padding-top: 1rem; border-top: 1px solid var(--border-color, #ccc);
  flex-shrink: 0;
}

.svg-exporter-modal .modal-footer button {
  border: none; padding: 0.6rem 1.2rem; font-size: 0.95rem; font-weight: 500;
  cursor: pointer; border-radius: 5px; transition: background-color 0.2s ease, opacity 0.2s ease;
}

.svg-exporter-modal .modal-footer .cancel-btn { /* Use consistent class names */
  background-color: var(--button-secondary-bg, #ccc);
  color: var(--button-secondary-text, #333);
}
.svg-exporter-modal .modal-footer .cancel-btn:hover {
  background-color: var(--button-secondary-hover-bg, #bbb);
}

.svg-exporter-modal .modal-footer .export-btn { /* Use consistent class names */
  background-color: var(--accent-color, #ff1493);
  color: #fff;
}
.svg-exporter-modal .modal-footer .export-btn:hover {
  background-color: var(--accent-color-hover, #e01280);
}
.svg-exporter-modal .modal-footer .export-btn:disabled {
    opacity: 0.6; cursor: not-allowed;
}

/* Mobile adjustments */
@media (max-width: 600px) {
  .svg-exporter-modal .modal-content {
    padding: 1rem; max-height: 95vh;
  }
  .svg-exporter-modal .modal-body {
     gap: 1rem;
  }
   .svg-exporter-modal .exporter-controls-area {
       grid-template-columns: 1fr; /* Stack label and control */
       gap: 0.5rem 0;
   }
    .svg-exporter-modal .control-group label,
    .svg-exporter-modal .checkbox-label {
        grid-column: 1 / 2; /* Reset grid column */
        text-align: left;
        margin-bottom: 0.1rem;
    }
    .svg-exporter-modal .control-group input[type="number"] {
       grid-column: 1 / 2;
       max-width: 100%; /* Allow full width on mobile */
    }
    .svg-exporter-modal .svg-exporter-info-text {
         grid-column: 1 / 2;
    }
   .svg-exporter-modal .modal-footer {
       flex-direction: column-reverse; align-items: stretch;
   }
}
`;

/* -----------------------------------------------------
   Modal HTML Template
------------------------------------------------------ */
const MODAL_HTML = `
<div id="${MODAL_ID}" class="svg-exporter-modal" role="dialog" aria-modal="true" aria-labelledby="${MODAL_ID}Title" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="${MODAL_ID}Title">Export as SVG</h3>
      <button id="${MODAL_ID}CloseBtn" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="exporter-preview-area">
        <div id="${MODAL_ID}Loading" class="exporter-preview-loading">
          <div class="spinner"></div>
          <div class="progress-text">Generating preview...</div>
        </div>
        <img id="${MODAL_ID}PreviewImage" class="exporter-preview-image" src="#" alt="SVG Preview" />
      </div>

      <div id="${MODAL_ID}MetadataInfo" class="svg-metadata-info">
         <h4>SVG Export Details</h4>
         <ul><li>Loading details...</li></ul>
       </div>

       <div class="exporter-controls-area">
         <div class="control-group">
           <label for="${MODAL_ID}Width">Width (px)</label>
           <input type="number" id="${MODAL_ID}Width" value="800" min="10" max="8000" readonly />
         </div>
         <div class="control-group">
           <label for="${MODAL_ID}Height">Height (px)</label>
           <input type="number" id="${MODAL_ID}Height" value="400" min="10" max="8000" readonly />
         </div>
          <label></label> <label class="checkbox-label">
            <input type="checkbox" id="${MODAL_ID}Transparent" />
            <span>Transparent Background</span>
          </label>

         <p class="svg-exporter-info-text">
           <strong>Note:</strong> SVG preserves vector quality and text. Complex CSS filters or non-SVG animations might not be fully represented.
         </p>
      </div>
    </div>
    <div class="modal-footer">
      <button id="${MODAL_ID}CancelBtn" class="cancel-btn">Cancel</button>
      <button id="${MODAL_ID}ExportBtn" class="export-btn">Export SVG</button>
    </div>
  </div>
</div>
`;

// --- Core Functions ---

/** Injects CSS styles into the document head if not already present. */
function injectStyles() {
    if (!document.getElementById(STYLE_ID)) {
        const styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent = MODAL_CSS;
        document.head.appendChild(styleEl);
    }
}

/** Injects the modal HTML into the document body if not already present. */
function injectModalHTML() {
    if (document.getElementById(MODAL_ID)) return; // Already exists
    const container = document.createElement('div');
    container.innerHTML = MODAL_HTML.trim();
    if (container.firstChild) {
        document.body.appendChild(container.firstChild);
    } else {
        console.error("[SVGRenderer] Failed to create modal element from HTML string.");
    }
}

/**
 * Queries essential modal elements and stores references.
 * @returns {boolean} True if all essential elements were found, false otherwise.
 */
function queryModalElements() {
    modalElement = document.getElementById(MODAL_ID);
    if (!modalElement) {
        console.error(`[SVGRenderer] Modal container #${MODAL_ID} not found.`);
        return false;
    }

    // Query only elements present in the SVG modal's HTML
    closeBtn = document.getElementById(`${MODAL_ID}CloseBtn`);
    cancelBtn = document.getElementById(`${MODAL_ID}CancelBtn`);
    exportBtn = document.getElementById(`${MODAL_ID}ExportBtn`);
    previewImage = document.getElementById(`${MODAL_ID}PreviewImage`); // Use consistent name
    loadingIndicator = document.getElementById(`${MODAL_ID}Loading`);
    loadingProgressText = loadingIndicator ? loadingIndicator.querySelector('.progress-text') : null;
    widthInput = document.getElementById(`${MODAL_ID}Width`);
    heightInput = document.getElementById(`${MODAL_ID}Height`);
    transparentCheckbox = document.getElementById(`${MODAL_ID}Transparent`); // Use consistent name
    metadataInfoDiv = document.getElementById(`${MODAL_ID}MetadataInfo`); // Use consistent name

    // Check if all *essential SVG modal* elements were found
    const allFound = !!(
        modalElement && closeBtn && cancelBtn && exportBtn &&
        previewImage && loadingIndicator && loadingProgressText &&
        widthInput && heightInput && transparentCheckbox && metadataInfoDiv
    );

    if (!allFound) {
        console.error("[SVGRenderer] Failed to query one or more essential modal elements! Check IDs and HTML structure.");
        // Log potentially missing elements
        const missing = [
            !modalElement && 'modalElement', !closeBtn && 'closeBtn', !cancelBtn && 'cancelBtn', !exportBtn && 'exportBtn',
            !previewImage && 'previewImage', !loadingIndicator && 'loadingIndicator', !loadingProgressText && 'loadingProgressText',
            !widthInput && 'widthInput', !heightInput && 'heightInput', !transparentCheckbox && 'transparentCheckbox',
            !metadataInfoDiv && 'metadataInfoDiv'
        ].filter(Boolean).join(', ');
        if (missing) console.error(`[SVGRenderer] Missing elements: ${missing}`);
    }

    return allFound;
}

/** Handles Escape key press for closing modal */
function handleEscKey(e) {
   if (e.key === 'Escape' && modalElement && modalElement.classList.contains('active')) {
       closeModal();
   }
}

/** Shows or hides the loading indicator */
function showLoading(show, message = "Loading...") {
    if (!loadingIndicator || !loadingProgressText) return;
    if (show) {
        loadingProgressText.textContent = message;
        loadingIndicator.classList.add('visible');
    } else {
        loadingIndicator.classList.remove('visible');
    }
}

/** Attaches event listeners to the modal. Runs only once. */
// Replace the existing attachModalEventListeners function with this:
/** Attaches event listeners just before modal opens */
function attachModalEventListeners() {
  if (!modalElement || !closeBtn || !cancelBtn || !exportBtn || !transparentCheckbox) {
       console.error("[SVGRenderer] Cannot attach listeners, elements missing.");
       return;
  }
  console.log("[SVGRenderer] Attaching modal event listeners...");

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Define and store the background click listener
  modalClickListener = (evt) => {
    const timeSinceOpen = Date.now() - (modalElement._modalOpenedTime || 0);
    // ---> THIS LOG IS CRUCIAL <---
    console.log(`[${MODAL_ID}] Overlay clicked. Target:`, evt.target, ` IsTrusted:`, evt.isTrusted, ` Time since open: ${timeSinceOpen}ms`);

    if (evt.target === modalElement && evt.isTrusted && timeSinceOpen > 150) {
        console.log(`[${MODAL_ID}] Closing via trusted overlay click (sufficient time elapsed).`);
        closeModal();
    } else if (evt.target !== modalElement) {
         console.log(`[${MODAL_ID}] Click inside modal content, ignored.`);
    } else if (!evt.isTrusted) {
         console.log(`[${MODAL_ID}] Untrusted click ignored.`);
    } else {
         console.log(`[${MODAL_ID}] Overlay click ignored (too soon after open: ${timeSinceOpen}ms).`);
    }
  };
  modalElement.addEventListener('click', modalClickListener);

  exportBtn.addEventListener('click', doExport); // Correct function for SVG

  // Define and store handler for transparency checkbox
  previewUpdateHandler = () => updatePreview(); // Use stored reference
  transparentCheckbox.addEventListener('change', previewUpdateHandler);

  // Global settings listener (attach persistently)
  if (!handleSettingsUpdatedListener) { // Attach only ONCE ever
       handleSettingsUpdatedListener = () => {
           if (modalElement && modalElement.classList.contains('active')) {
               console.log("[SVGRenderer] Settings updated externally, syncing modal.");
               syncExportSettings();
               updatePreview();
           }
       };
       document.addEventListener('logomaker-settings-updated', handleSettingsUpdatedListener);
  }

  console.log("[SVGRenderer] Modal event listeners attached.");
}

// ---> ADD THIS NEW FUNCTION <---
/** Detaches event listeners when modal closes */
function detachModalEventListeners() {
  if (!modalElement || !closeBtn || !cancelBtn || !exportBtn || !transparentCheckbox) {
       console.warn("[SVGRenderer] Cannot detach listeners, elements missing or already gone.");
       return;
  }
  console.log("[SVGRenderer] Detaching modal event listeners...");

  closeBtn.removeEventListener('click', closeModal);
  cancelBtn.removeEventListener('click', closeModal);
  if (modalClickListener) { // Remove stored listener
      modalElement.removeEventListener('click', modalClickListener);
      modalClickListener = null;
  }
  exportBtn.removeEventListener('click', doExport); // Correct function

  // Remove stored handler for checkbox
  if (previewUpdateHandler) {
       transparentCheckbox.removeEventListener('change', previewUpdateHandler);
       previewUpdateHandler = null;
  }

  // We keep the global listener (`handleSettingsUpdatedListener`) attached
  // We keep the global ESC listener attached/detached in open/close

  console.log("[SVGRenderer] Modal event listeners detached.");
}

/** Opens the SVG export modal */// Replace the existing openModal function with this:
function openModal() {
  if (!isInitialized || !modalElement) {
      console.error('[SVGRenderer] Cannot open modal: Not initialized or missing modal element.');
      if (typeof showAlert === 'function') showAlert('SVG Exporter is not ready.', 'error');
      return;
  }
  console.log("[SVGRenderer] Opening modal...");
  syncExportSettings(); // Sync settings first

  // Reset state before showing (add checks if necessary)
  if(showLoading) showLoading(false);
  if(previewImage) { previewImage.style.display = 'none'; previewImage.removeAttribute('src'); }
  if(metadataInfoDiv) metadataInfoDiv.innerHTML = '<h4>SVG Export Details</h4><ul><li>Loading...</li></ul>';
  if(exportBtn) { exportBtn.disabled = false; exportBtn.textContent = 'Export SVG'; }

  // ---> Attach Listeners Just-In-Time <---
  attachModalEventListeners(); // <--- ADD THIS LINE

  modalElement._modalOpenedTime = Date.now(); // Record opening time for click check

  // ---> Set display AND add class <---
  modalElement.style.display = 'flex';
  modalElement.classList.add('active');

  // ---> Add body overflow lock and ESC listener <---
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', handleEscKey);

  // Generate preview after modal is rendered
  console.log("[SVGRenderer] Queuing updatePreview...");
  requestAnimationFrame(() => {
      setTimeout(() => {
          if (modalElement && modalElement.classList.contains('active')) {
               console.log("[SVGRenderer] Calling updatePreview()...");
               updatePreview();
          } else {
               console.warn("[SVGRenderer] Modal closed before preview could start.");
          }
      }, 50);
  });
  console.log("[SVGRenderer] openModal function finished executing.");
}

// Replace the existing closeModal function with this:
function closeModal() {
  if (!modalElement || !modalElement.classList.contains('active')) {
      return; // Already closed or not found
  }
  console.log("[SVGRenderer] Closing modal.");

  // ---> Detach listeners <---
  detachModalEventListeners(); // <--- ADD THIS LINE

  // ---> Remove class and set display none <---
  modalElement.classList.remove('active');
  modalElement.style.display = 'none';

  // ---> Restore body scroll and remove ESC listener <---
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleEscKey);
}

/** Syncs modal inputs (Width, Height, Transparency) with main UI settings */
function syncExportSettings() {
    console.log("[SVGRenderer] Syncing settings from main UI...");
    try {
        const mainW = document.getElementById('exportWidth')?.value ?? '800';
        const mainH = document.getElementById('exportHeight')?.value ?? '400';
        const mainT = document.getElementById('exportTransparent')?.checked ?? false;

        if (widthInput) widthInput.value = mainW;
        if (heightInput) heightInput.value = mainH;
        if (transparentCheckbox) transparentCheckbox.checked = mainT;

    } catch (err) {
        console.warn('[SVGRenderer] Could not sync settings from main UI elements.', err);
    }
}
// Inside js/renderers/SVGRenderer.js

/** Updates the SVG preview image and metadata in the modal */
async function updatePreview() {
  // Abort if not ready or modal not visible
  if (!isInitialized || !modalElement || !modalElement.classList.contains('active')) {
      console.log("[SVGRenderer updatePreview] Aborting: Not initialized or modal not visible.");
      return;
  }
   // Check required elements for preview
   if (!previewImage || !loadingIndicator || !metadataInfoDiv || !widthInput || !heightInput || !transparentCheckbox) {
      console.error("[SVGRenderer updatePreview] Aborting: Required elements for preview missing.");
      showLoading(true, "Preview Error: UI elements missing.");
      return;
   }

  const w = parseInt(widthInput.value, 10) || 800;
  const h = parseInt(heightInput.value, 10) || 400;
  const transparent = transparentCheckbox.checked;

  console.log(`[SVGRenderer] Updating preview (Size: ${w}x${h}, Transparent: ${transparent})`);
  // Show loading immediately
  showLoading(true, "Capturing styles...");
  previewImage.style.display = 'none';
  previewImage.removeAttribute('src');
  metadataInfoDiv.innerHTML = '<h4>SVG Export Details</h4><ul><li>Capturing styles...</li></ul>';

  let capturedStyles = null; // Variable to hold the styles

  try {
      // --- REMOVED: Wait for event logic ---

      // --- CAPTURE STYLES DIRECTLY ---
      // Assumes this function is called *after* SettingsManager's apply cycle completes
      // (triggered by the event listener or initial openModal timeout)
      console.log("[SVGRenderer updatePreview] Calling captureAdvancedStyles...");
      capturedStyles = await captureAdvancedStyles();

      if (!capturedStyles) {
          throw new Error("Failed to capture styles.");
      }
      console.log("[SVGRenderer updatePreview] Styles captured. Font:", capturedStyles.font?.family);

      showLoading(true, "Generating SVG preview..."); // Update message again

      // Pass styles to preview generation
      const result = await generateConsistentPreview(
          {
              width: w,
              height: h,
              transparentBackground: transparent,
              preCapturedStyles: capturedStyles // Pass the captured styles
          },
          previewImage,
          loadingIndicator,
          'svg'
      );

      if (!result || !result.dataUrl) {
          throw new Error("Preview generation failed to return a data URL.");
      }

      console.log("[SVGRenderer] Preview generation complete (blob/dataUrl created). Image loading initiated by generateConsistentPreview.");
      // NOTE: The image loading (onload/onerror) is now handled within generateConsistentPreview

      // Update metadata using the successfully captured styles
      console.log("[SVGRenderer updatePreview] Calling showMetadata...");
      await showMetadata(capturedStyles); // Pass the captured styles
      console.log("[SVGRenderer updatePreview] showMetadata finished.");

  } catch (err) {
      console.error("[SVGRenderer] updatePreview error:", err);
      showLoading(true, `Preview Failed: ${err.message}`);
      metadataInfoDiv.innerHTML = `<h4>SVG Export Details</h4><ul><li>Preview failed: ${err.message}</li></ul>`;
      previewImage.style.display = 'none';
      previewImage.alt = 'Preview Failed';
      // Attempt to show metadata even if preview failed
      if (capturedStyles) {
          try {
               await showMetadata(capturedStyles);
          } catch (metaErr) {
               console.error("[SVGRenderer] Error showing metadata after preview failure:", metaErr);
          }
      }
  }
  // Note: Loading indicator is hidden by generateConsistentPreview's img.onload typically
}


async function showMetadata(styles) {
  if (!metadataInfoDiv || !transparentCheckbox) {
    console.warn('[SVGRenderer showMetadata] Required elements missing.');
    return;
  }
  
  metadataInfoDiv.innerHTML = '<h4>SVG Export Details</h4><ul><li>Loading details...</li></ul>';

  try {
    // Extract animation details
    const anim = typeof extractSVGAnimationDetails === 'function' ? extractSVGAnimationDetails() : {};
    
    // Build HTML info content
    let html = '<h4>SVG Export Details</h4><ul>';
    
    // Font info
    if (styles?.font) {
      html += `<li><strong>Font:</strong> ${styles.font.family || 'Unknown'}, ${styles.font.weight || '400'}, ${styles.font.style || 'normal'}, ${styles.font.size || '100px'}</li>`;
      html += `<li><strong>Letter Spacing:</strong> ${styles.font.letterSpacing || 'normal'}</li>`;
    }
    
    // Text content info
    if (styles?.textContent) {
      html += `<li><strong>Text:</strong> "${styles.textContent.transformedText || styles.textContent.finalText || 'Logo'}"</li>`;
      html += `<li><strong>Transform:</strong> ${styles.textContent.transform || 'none'}</li>`;
    }
    
    // Text alignment - IMPORTANT: This needs to show the actual alignment being used
    html += `<li><strong>Text Alignment:</strong> ${styles.textAlign || 'center'} (maps to SVG <code>text-anchor="${styles.textAlign === 'left' ? 'start' : (styles.textAlign === 'right' ? 'end' : 'middle')}"</code>)</li>`;
    
    // Color mode
    if (styles?.color) {
      if (styles.color.mode === 'gradient') {
        html += `<li><strong>Text Color:</strong> Gradient (${styles.color.gradient?.colors?.length || 0} colors)</li>`;
      } else {
        html += `<li><strong>Text Color:</strong> Solid (${styles.color.value || '#ffffff'})</li>`;
      }
      html += `<li><strong>Text Opacity:</strong> ${styles.opacity || '1'}</li>`;
    }
    
    // Effects and decoration
    if (styles?.textEffect) {
      html += `<li><strong>Text Effect:</strong> ${styles.textEffect.type || 'none'}</li>`;
    }
    if (styles?.textStroke) {
      html += `<li><strong>Text Stroke:</strong> ${styles.textStroke.width || '0'}px ${styles.textStroke.color || 'none'}</li>`;
    }
    
    // Background
    if (styles?.background) {
      const bgType = styles.background.type || 'bg-solid';
      if (bgType === 'bg-solid') {
        html += `<li><strong>Background:</strong> Solid (${styles.background.color || 'transparent'})</li>`;
      } else if (bgType.includes('gradient')) {
        html += `<li><strong>Background:</strong> Gradient (${bgType})</li>`;
      } else if (bgType === 'bg-transparent') {
        html += `<li><strong>Background:</strong> Transparent</li>`;
      } else {
        html += `<li><strong>Background:</strong> ${bgType}</li>`;
      }
      html += `<li><strong>Bg Opacity:</strong> ${styles.background.opacity || '1'}</li>`;
    }
    
    // Animation
    if (anim && anim.name && anim.name !== 'none') {
      html += `<li><strong>Animation:</strong> ${anim.name}, ${anim.duration}, ${anim.iterationCount}</li>`;
    } else {
      html += `<li><strong>Animation:</strong> None</li>`;
    }
    
    // Border
    if (styles?.border) {
      html += `<li><strong>Border:</strong> ${styles.border.width || '0'}px ${styles.border.style || 'none'}</li>`;
      html += `<li><strong>Border Radius:</strong> ${styles.borderRadius || '0px'}</li>`;
    }
    
    // Export settings
    html += `<li><strong>Size:</strong> ${widthInput.value || '800'}x${heightInput.value || '400'} px</li>`;
    html += `<li><strong>Background:</strong> ${transparentCheckbox.checked ? 'Transparent' : 'Opaque'}</li>`;
    
    html += '</ul>';
    metadataInfoDiv.innerHTML = html;
    
    console.log("[SVGRenderer showMetadata] Metadata updated successfully");
  } catch (err) {
    console.error("[SVGRenderer] showMetadata error:", err);
    metadataInfoDiv.innerHTML = `<h4>SVG Export Details</h4><ul><li style="color: var(--error-text, red);">Metadata Error: ${err.message}</li></ul>`;
  }
}


/** Handles the final SVG export process */
/** Handles the final SVG export process */
async function doExport() {
  if (!isInitialized || !modalElement) return;
  if (!exportBtn || !loadingIndicator || !widthInput || !heightInput || !transparentCheckbox) {
      console.error("[SVGRenderer doExport] Required elements missing for export.");
      if (typeof showAlert === 'function') showAlert('Export failed: UI elements missing.', 'error');
      return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  // Show loading immediately
  showLoading(true, 'Capturing styles for export...');

  const w = parseInt(widthInput.value, 10) || 800;
  const h = parseInt(heightInput.value, 10) || 400;
  const transparent = transparentCheckbox.checked;
  let exportSuccess = false;
  let stylesForExport = null;

  console.log(`[SVGRenderer] Starting export action (Size: ${w}x${h}, Transparent: ${transparent})`);

  try {
      // --- REMOVED: Wait for event logic ---

      // --- CAPTURE STYLES DIRECTLY ---
      // Assumes the current state is the desired state when user clicks Export
      console.log("[SVGRenderer doExport] Calling captureAdvancedStyles...");
      stylesForExport = await captureAdvancedStyles();

      if (!stylesForExport || !stylesForExport.font) {
           console.error("[SVGRenderer doExport] CRITICAL: Failed to capture valid styles before final export!", stylesForExport);
           throw new Error("Failed to capture styles for export.");
      }
      console.log("[SVGRenderer doExport] Styles captured successfully for export. Font:", stylesForExport.font?.family);

      showLoading(true, 'Generating final SVG...'); // Update message

      console.log("[SVGRenderer doExport] Calling generateSVGBlob with preCapturedStyles...");
      const blob = await generateSVGBlob({
          width: w,
          height: h,
          transparentBackground: transparent,
          preCapturedStyles: stylesForExport // Pass the captured styles
      });
      console.log("[SVGRenderer doExport] generateSVGBlob call completed.");

      if (!blob) {
          throw new Error("SVG Blob generation failed (returned null/undefined).");
      }
      console.log("[SVGRenderer doExport] SVG Blob received successfully.");

      // ... (rest of filename generation, download logic) ...
      let baseName = 'logo';
      if (typeof window.Utils?.getLogoFilenameBase === 'function') {
         baseName = window.Utils.getLogoFilenameBase() || baseName;
      }
      const filename = `${baseName}_${w}x${h}.svg`;

      if (typeof window.Utils?.downloadBlob === 'function') {
         window.Utils.downloadBlob(blob, filename);
         console.log(`[SVGRenderer] Initiated download for ${filename} via Utils.downloadBlob`);
      } else { /* ... fallback download ... */ }

      exportSuccess = true;
      if (typeof showToast === 'function') {
           showToast({ message: `SVG exported: ${filename}`, type: 'success' });
      }
      closeModal(); // Close modal on success

  } catch (err) {
      console.error("[SVGRenderer] Export process failed:", err);
      showLoading(true, `Export Failed: ${err.message}`);
      if (typeof showAlert === 'function') {
          showAlert(`SVG export failed: ${err.message}`, 'error');
      }
  } finally {
      // Re-enable button only if export failed
      if (!exportSuccess && exportBtn) {
          exportBtn.disabled = false;
          exportBtn.textContent = 'Export SVG';
      }
      // Ensure loading indicator is hidden if export fails and modal stays open
      if (!exportSuccess && loadingIndicator && !loadingIndicator.textContent.includes("Failed")) {
           showLoading(false);
      }
  }
}


/**
 * Initializes the SVG Renderer UI.
 * Injects HTML/CSS, queries elements, and attaches event listeners.
 * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
 */
// Replace the existing initializeUI function with this:
async function initializeUI() {
  if (isInitialized) {
      console.log("[SVGRenderer] Already initialized.");
      return true;
  }
  console.log("[SVGRenderer] Initializing UI...");
  try {
      injectStyles();
      injectModalHTML();
      await new Promise(resolve => requestAnimationFrame(resolve)); // Wait for DOM
      if (!queryModalElements()) { // Use corrected query function
          throw new Error('Failed to find required modal elements after injection. Check HTML IDs.');
      }
      // attachModalEventListeners(); // <-- Line Removed
      isInitialized = true;
      console.log("[SVGRenderer] UI Initialized successfully.");
      return true;
  } catch (err) {
      console.error('[SVGRenderer] UI Initialization failed:', err);
      isInitialized = false;
      if (typeof showAlert === 'function') {
          showAlert('Failed to initialize SVG Exporter UI.', 'error');
      }
      return false;
  }
}

/**
 * Public function to trigger the SVG export modal.
 * Ensures UI is initialized before opening.
 * @public
 */
export async function exportSVGWithUI() {
    console.log("[SVGRenderer] exportSVGWithUI called...");
    try {
        const success = await initializeUI(); // Ensure initialized
        if (!success) {
             console.error("[SVGRenderer] Cannot open modal because UI initialization failed.");
            // Alert likely already shown by initializeUI
            return;
        }
        openModal(); // Open if initialized successfully
    } catch (err) {
        console.error('[SVGRenderer] Error trying to open SVG exporter:', err);
        if (typeof showAlert === 'function') {
            showAlert(`Error opening SVG Exporter: ${err.message}`, 'error');
        }
    }
}

// Initial log message
console.log("[SVGRenderer v2.1 - Fixed & Refined] Loaded.");