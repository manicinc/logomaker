/**
 * PNGRenderer.js
 * ====================================================
 * Provides PNG export functionality via a modal interface.
 * Offers two rendering modes:
 * 1) **Snapshot (html2canvas)**: Captures the visual appearance of the #previewContainer for WYSIWYG results.
 * 2) **SVG-based**: Uses an SVG export pipeline for consistent vector rendering, then converts to PNG.
 *
 * Features:
 * - Modal-based export workflow with image preview.
 * - Optional background transparency.
 * - Responsive preview area with aspect ratio control.
 * - Handles different export methods and quality settings.
 *
 * Dependencies:
 * - RendererCore.js (for generateConsistentPreview, generateSVGBlob, convertSVGtoPNG, blobToDataURL)
 * - html2canvas / captureLogoWithHTML2Canvas (if snapshot mode is used)
 * - Utility functions like showAlert, showToast, Utils.downloadBlob, Utils.getLogoFilenameBase (optional, provide fallbacks)
 *
 * Assumes:
 * - A #previewContainer element exists in the DOM for snapshot mode.
 * - Main UI elements (#exportWidth, #exportHeight, etc.) exist for initial settings sync.
 */

import {
  generateConsistentPreview,
  generateSVGBlob,
  convertSVGtoPNG,
  blobToDataURL
} from './RendererCore.js';

// Optional: Dynamically import if needed, or ensure it's globally available/bundled
import { captureLogoWithHTML2Canvas } from '../utils/html2Canvas.js';

/* -----------------------------------------------------
 Module-Scope Variables & Constants
------------------------------------------------------ */
let isInitialized = false;          // Prevent multiple initializations
let handleSettingsUpdateListener; // Reference for the global listener
const MODAL_ID = 'pngExportModal';  // ID for the main modal element
const STYLE_ID = 'pngExporterStyles'; // ID for the injected styles


/* -----------------------------------------------------
 DOM Element References (populated by queryModalElements)
------------------------------------------------------ */
let modalElement = null,
  closeBtn = null,
  cancelBtn = null,
  exportBtn = null,
  previewImage = null,
  loadingIndicator = null,
  loadingProgressText = null, // Specific reference for progress text
  widthInput = null,
  heightInput = null,
  qualityInput = null,
  qualityDisplay = null,
  transparentCheckbox = null,
  snapshotRadio = null,
  svgRenderRadio = null,
  snapshotWarningEl = null; // Reference for the snapshot warning text

/* -----------------------------------------------------
 CSS for the PNG Exporter Modal
 (Includes responsiveness, aspect ratio, checkerboard)
------------------------------------------------------ */
const MODAL_CSS = `
/* PNG Exporter Modal (v2.3 - Refined) */
  .png-exporter-modal {
  position: fixed;
  inset: 0;
  display: none; /* Controlled by JS */
  justify-content: center;
  align-items: center;
  z-index: 1500;
  background: rgba(0, 0, 0, 0.6);
  overflow-y: auto; /* Allow scroll on smaller/shorter screens */
  padding: 1rem; /* Base padding */
}

.png-exporter-modal.active {
  opacity: 1; visibility: visible; transition: opacity 0.3s ease, visibility 0s linear 0s; /* Add transform transitions here if desired */ 
}

.png-exporter-modal .modal-content {
  background: var(--panel-bg, #f5f5f5);
  color: var(--text-color, #333);
  max-width: 700px;
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
  opacity: 1 !important; /* Override opacity: 0 (use !important for safety) */
  transform: none !important; /* Override scale(0.95) (use !important for safety) */
  /* Optional: Add transition if you want content to fade/scale */
  transition: opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s;
}

.png-exporter-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  flex-shrink: 0; /* Prevent header from shrinking */
}

.png-exporter-modal .modal-header h3 {
  font-size: 1.3rem;
  margin: 0;
}

.png-exporter-modal .modal-header button {
  background: none;
  border: none;
  font-size: 1.8rem; /* Slightly larger close button */
  color: var(--text-color-muted, #666);
  cursor: pointer;
  padding: 0.2rem; /* Add padding for easier clicking */
  line-height: 1;
}
.png-exporter-modal .modal-header button:hover {
  color: var(--text-color, #333);
}


.png-exporter-modal .modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.2rem; /* Increased gap */
  overflow-y: auto; /* Allow body to scroll if content overflows */
  padding-right: 5px; /* Prevent scrollbar overlap */
  margin-right: -5px;
}

/* Preview area container */
.png-exporter-modal .exporter-preview-area {
  position: relative;
  width: 100%;
  /* Aspect ratio via padding-top: (height / width) * 100% */
  padding-top: 56.25%; /* 16:9 aspect ratio */
  background-color: rgba(0,0,0,0.05);
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  overflow: hidden; /* Contain absolute elements */
}

/* Preview image */
.png-exporter-modal .exporter-preview-image {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: contain; /* Scale image while preserving aspect ratio */
  display: none; /* Hidden until loaded */
  /* Checkerboard background for transparency */
  background: repeating-conic-gradient(var(--border-subtle, #ccc) 0% 25%, var(--panel-bg-opaque, #fff) 0% 50%) 50% / 20px 20px;
  background-size: 20px 20px;
  border: 0; /* No border on image */
}

body.dark-mode .png-exporter-modal .exporter-preview-image {
  background: repeating-conic-gradient(var(--border-color, #444) 0% 25%, var(--panel-bg, #282828) 0% 50%) 50% / 20px 20px;
  background-size: 20px 20px;
}

/* Loading overlay */
.png-exporter-modal .exporter-preview-loading {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.8);
  display: none; /* Initially hidden */
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 2;
  color: var(--text-color, #333);
  border-radius: inherit;
  text-align: center;
  transition: opacity 0.2s ease;
  font-size: 0.9rem;
}
.png-exporter-modal .exporter-preview-loading.visible {
  display: flex; /* Show loading */
}


body.dark-mode .png-exporter-modal .exporter-preview-loading {
  background: rgba(20, 20, 20, 0.8);
  color: #ccc;
}

.png-exporter-modal .exporter-preview-loading .spinner {
  border: 4px solid rgba(var(--accent-color-rgb, 255, 20, 147), 0.2);
  border-left-color: var(--accent-color, #ff1493);
  border-radius: 50%;
  width: 32px; height: 32px;
  animation: png-spin 1s linear infinite;
  margin-bottom: 0.8rem; /* Increased spacing */
}

@keyframes png-spin {
  to { transform: rotate(360deg); }
}

/* Controls area styling */
.png-exporter-modal .exporter-controls-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.png-exporter-modal .control-group {
display: grid; /* Use grid for alignment */
  grid-template-columns: auto 1fr; /* Label | Input/Control */
  gap: 0.5rem 0.8rem; /* Row gap | Column gap */
  align-items: center;
}

.png-exporter-modal .control-group label:not(.checkbox-label):not(.radio-label) {
font-weight: 500;
font-size: 0.9rem;
text-align: right;
white-space: nowrap;
}

.png-exporter-modal input[type="number"],
.png-exporter-modal input[type="range"] {
width: 100%;
padding: 0.4rem 0.6rem;
font-size: 0.9rem;
border: 1px solid var(--border-color, #ccc);
border-radius: 4px;
background-color: var(--input-bg, #fff);
}

.png-exporter-modal input[readonly] {
background-color: var(--bg-base, #eee);
opacity: 0.7;
cursor: not-allowed;
}

body.dark-mode .png-exporter-modal input[readonly] {
  background-color: var(--input-bg-disabled, #333);
}

.png-exporter-modal .range-container {
display: flex;
align-items: center;
gap: 0.8rem; /* Increased gap */
}

.png-exporter-modal .range-container span {
font-size: 0.9rem; /* Match input font size */
color: var(--text-color-muted, #666);
min-width: 45px; /* Ensure space for '100%' */
text-align: right;
}

.png-exporter-modal .checkbox-label,
.png-exporter-modal .radio-label {
display: flex;
align-items: center;
cursor: pointer;
grid-column: 2 / 3; /* Align checkbox/radio with input column */
font-size: 0.9rem;
}
.png-exporter-modal .checkbox-label input[type="checkbox"],
.png-exporter-modal .radio-label input[type="radio"] {
width: 17px; height: 17px; /* Slightly smaller */
margin-right: 0.6rem; /* Increased spacing */
accent-color: var(--accent-color, #ff1493);
cursor: pointer;
}

.png-exporter-modal fieldset {
border: 1px solid var(--border-color, #ccc);
border-radius: 6px; /* Match preview border-radius */
padding: 0.8rem 1rem;
margin-top: 0.5rem;
grid-column: 1 / 3; /* Span both columns */
}

.png-exporter-modal fieldset legend {
font-weight: 600;
font-size: 0.95rem; /* Slightly larger legend */
color: var(--text-color, #333);
padding: 0 0.5rem;
margin-left: -0.5rem; /* Align with padding */
}
body.dark-mode .png-exporter-modal fieldset legend {
  color: var(--text-color-emphasis, #eee);
}

.png-exporter-modal fieldset .radio-label {
margin-bottom: 0.5rem; /* Space between radio options */
}
.png-exporter-modal fieldset .radio-label:last-child {
  margin-bottom: 0;
}

/* Snapshot method warning */
.png-exporter-modal .snapshot-warning {
font-size: 0.85rem; /* Slightly larger */
color: var(--warning-text, #b45);
background-color: var(--warning-bg-subtle, rgba(204, 119, 85, 0.1));
padding: 0.5rem 0.8rem;
border-radius: 4px;
margin-top: 0.6rem;
display: none; /* Controlled by JS */
grid-column: 1 / 3; /* Span both columns */
line-height: 1.4;
}
body.dark-mode .png-exporter-modal .snapshot-warning {
  color: var(--warning-text-dark, #f7906f);
  background-color: var(--warning-bg-subtle-dark, rgba(247, 144, 111, 0.15));
}


/* Modal Footer */
.png-exporter-modal .modal-footer {
display: flex;
justify-content: flex-end;
gap: 0.8rem;
padding-top: 1rem; /* Space above footer */
border-top: 1px solid var(--border-color, #ccc);
flex-shrink: 0; /* Prevent footer from shrinking */
}

.png-exporter-modal .modal-footer button {
border: none;
padding: 0.6rem 1.2rem; /* Slightly larger buttons */
font-size: 0.95rem;
font-weight: 500;
cursor: pointer;
border-radius: 5px;
transition: background-color 0.2s ease, opacity 0.2s ease;
}

.png-exporter-modal .modal-footer .cancel-btn {
background-color: var(--button-secondary-bg, #ccc);
color: var(--button-secondary-text, #333);
}
.png-exporter-modal .modal-footer .cancel-btn:hover {
background-color: var(--button-secondary-hover-bg, #bbb);
}

.png-exporter-modal .modal-footer .export-btn {
background-color: var(--accent-color, #ff1493);
color: #fff;
}
.png-exporter-modal .modal-footer .export-btn:hover {
background-color: var(--accent-color-hover, #e01280);
}
.png-exporter-modal .modal-footer .export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}


/* Mobile adjustments */
@media (max-width: 600px) {
.png-exporter-modal .modal-content {
  padding: 1rem;
  max-height: 95vh; /* Allow slightly taller on mobile */
}
.png-exporter-modal .modal-body {
   gap: 1rem; /* Reduce gap slightly */
}
.png-exporter-modal .exporter-preview-area {
  padding-top: 66.66%; /* Adjust aspect ratio for smaller screens (e.g., 3:2) */
}
.png-exporter-modal .control-group {
    grid-template-columns: 1fr; /* Stack label and control */
    gap: 0.2rem 0;
}
 .png-exporter-modal .control-group label:not(.checkbox-label):not(.radio-label) {
     text-align: left; /* Align labels left */
     margin-bottom: 0.1rem;
 }
 .png-exporter-modal .checkbox-label,
 .png-exporter-modal .radio-label {
     grid-column: 1 / 2; /* Reset grid column */
     margin-top: 0.3rem;
 }
  .png-exporter-modal fieldset {
     grid-column: 1 / 2; /* Reset grid column */
     padding: 0.6rem 0.8rem;
 }
 .png-exporter-modal .snapshot-warning {
     grid-column: 1 / 2; /* Reset grid column */
 }
.png-exporter-modal .modal-footer {
  flex-direction: column-reverse; /* Stack buttons, Export on top */
  align-items: stretch;
}
}
`;

/* -----------------------------------------------------
 HTML template for the PNG Exporter Modal
------------------------------------------------------ */
const MODAL_HTML = `
<div id="${MODAL_ID}" class="png-exporter-modal" role="dialog" aria-modal="true" aria-labelledby="${MODAL_ID}Title" style="display: none;">
<div class="modal-content">
  <div class="modal-header">
    <h3 id="${MODAL_ID}Title">Export as PNG</h3>
    <button id="${MODAL_ID}CloseBtn" aria-label="Close">&times;</button>
  </div>
  <div class="modal-body">
    <div class="exporter-preview-area">
      <div id="${MODAL_ID}Loading" class="exporter-preview-loading">
        <div class="spinner"></div>
        <div class="progress-text">Generating preview...</div>
      </div>
      <img id="${MODAL_ID}PreviewImage" class="exporter-preview-image" src="" alt="PNG Preview" />
    </div>

    <div class="exporter-controls-area">
      <div class="control-group">
        <label for="${MODAL_ID}Width">Width (px)</label>
        <input type="number" id="${MODAL_ID}Width" value="800" min="10" max="8000" readonly>
      </div>
      <div class="control-group">
        <label for="${MODAL_ID}Height">Height (px)</label>
        <input type="number" id="${MODAL_ID}Height" value="400" min="10" max="8000" readonly>
      </div>
      <div class="control-group">
        <label for="${MODAL_ID}Quality">Quality (%)</label>
        <div class="range-container">
          <input type="range" id="${MODAL_ID}Quality" min="10" max="100" step="5" value="95">
          <span id="${MODAL_ID}QualityValue">95%</span>
        </div>
      </div>
      <div class="control-group">
         <label></label> <label class="checkbox-label">
           <input type="checkbox" id="${MODAL_ID}Transparent">
           <span>Transparent Background</span>
         </label>
       </div>

      <fieldset>
        <legend>Export Method</legend>
        <label class="radio-label">
          <input type="radio" name="pngExportMethod" id="pngExportMethodSnapshot" value="snapshot" checked>
          Snapshot (WYSIWYG)
        </label>
        <label class="radio-label">
          <input type="radio" name="pngExportMethod" id="pngExportMethodSvgRender" value="svgRender">
          SVG Render (Consistent)
        </label>
        <div id="snapshotMethodWarning" class="snapshot-warning">
          Note: Snapshot captures exact on-screen appearance (including CSS effects) but can be slower and may vary slightly across browsers.
        </div>
      </fieldset>
    </div>
  </div>
  <div class="modal-footer">
    <button id="${MODAL_ID}CancelBtn" class="cancel-btn">Cancel</button>
    <button id="${MODAL_ID}ExportBtn" class="export-btn">Export PNG</button>
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
  // Append the first child of the container (which is the modal div)
  if (container.firstChild) {
      document.body.appendChild(container.firstChild);
  } else {
      console.error("[PNGRenderer] Failed to create modal element from HTML string.");
  }
}

/**
* Queries essential modal elements and stores references.
* @returns {boolean} True if all essential elements were found, false otherwise.
*/
function queryModalElements() {
  modalElement = document.getElementById(MODAL_ID);
  if (!modalElement) {
      console.error(`[PNGRenderer] Modal container #${MODAL_ID} not found.`);
      return false; // Bail early if modal itself is missing
  }

  // Query all other elements relative to the modal or document
  closeBtn = document.getElementById(`${MODAL_ID}CloseBtn`);
  cancelBtn = document.getElementById(`${MODAL_ID}CancelBtn`);
  exportBtn = document.getElementById(`${MODAL_ID}ExportBtn`);
  previewImage = document.getElementById(`${MODAL_ID}PreviewImage`);
  loadingIndicator = document.getElementById(`${MODAL_ID}Loading`);
  loadingProgressText = loadingIndicator ? loadingIndicator.querySelector('.progress-text') : null;
  widthInput = document.getElementById(`${MODAL_ID}Width`);
  heightInput = document.getElementById(`${MODAL_ID}Height`);
  qualityInput = document.getElementById(`${MODAL_ID}Quality`);
  qualityDisplay = document.getElementById(`${MODAL_ID}QualityValue`);
  transparentCheckbox = document.getElementById(`${MODAL_ID}Transparent`);
  snapshotRadio = document.getElementById('pngExportMethodSnapshot');
  svgRenderRadio = document.getElementById('pngExportMethodSvgRender');
  snapshotWarningEl = document.getElementById('snapshotMethodWarning'); // Correctly query

  // Check if all *essential* elements were found
  const allFound = !!(
      modalElement && closeBtn && cancelBtn && exportBtn &&
      previewImage && loadingIndicator && loadingProgressText &&
      widthInput && heightInput && qualityInput && qualityDisplay &&
      transparentCheckbox && snapshotRadio && svgRenderRadio && snapshotWarningEl
  );

  if (!allFound) {
      console.error("[PNGRenderer] Failed to query one or more essential modal elements! Check IDs and HTML structure.");
      // Log which elements might be missing for easier debugging
      const missing = [
          !modalElement && 'modalElement', !closeBtn && 'closeBtn', !cancelBtn && 'cancelBtn', !exportBtn && 'exportBtn',
          !previewImage && 'previewImage', !loadingIndicator && 'loadingIndicator', !loadingProgressText && 'loadingProgressText',
          !widthInput && 'widthInput', !heightInput && 'heightInput', !qualityInput && 'qualityInput',
          !qualityDisplay && 'qualityDisplay', !transparentCheckbox && 'transparentCheckbox',
          !snapshotRadio && 'snapshotRadio', !svgRenderRadio && 'svgRenderRadio', !snapshotWarningEl && 'snapshotWarningEl'
      ].filter(Boolean).join(', ');
      if (missing) console.error(`[PNGRenderer] Missing elements: ${missing}`);
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
// ---> Define variable in module scope (outside the function) <---
let modalClickListener;
let qualityInputListener;
let previewUpdateHandler; // Store reference for radio/checkbox changes

/** Attaches event listeners just before modal opens */
function attachModalEventListeners() {
    // Ensure elements are present
    if (!modalElement || !closeBtn || !cancelBtn || !exportBtn /* etc... add checks if needed */) {
         console.error("[PNGRenderer] Cannot attach listeners, elements missing.");
         return;
    }
    // Optional: Check if already attached if you suspect multiple calls
    // if (modalElement.dataset.listenersAttached === 'true') return;

    console.log("[PNGRenderer] Attaching modal event listeners...");

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Define and store the background click listener
    modalClickListener = (evt) => {
        const timeSinceOpen = Date.now() - (modalElement._modalOpenedTime || 0);
        console.log(`[${MODAL_ID}] Overlay clicked. Target:`, evt.target, ` Time since open: ${timeSinceOpen}ms`);
        if (evt.target === modalElement && evt.isTrusted && timeSinceOpen > 150) {
            console.log(`[${MODAL_ID}] Closing via trusted overlay click.`);
            closeModal();
        } else { /* ... other logs ... */ }
    };
    modalElement.addEventListener('click', modalClickListener);

    exportBtn.addEventListener('click', handleExport);

    // Define and store handlers for controls
    previewUpdateHandler = () => updatePreview(); // Use stored reference
    snapshotRadio.addEventListener('change', previewUpdateHandler);
    svgRenderRadio.addEventListener('change', previewUpdateHandler);
    transparentCheckbox.addEventListener('change', previewUpdateHandler);
    qualityInput.addEventListener('change', previewUpdateHandler); // Final change

    qualityInputListener = () => { // Store reference for input listener
         if (qualityDisplay) qualityDisplay.textContent = `${qualityInput.value}%`;
    };
    qualityInput.addEventListener('input', qualityInputListener);

    // Global settings listener (attach persistently - no need to add/remove each time)
    if (!handleSettingsUpdateListener) { // Attach only ONCE during app life
         handleSettingsUpdateListener = () => {
             if (modalElement && modalElement.classList.contains('active')) {
                 console.log("[PNGRenderer] Settings updated externally, syncing modal.");
                 syncExportSettings();
                 updatePreview();
             }
         };
         document.addEventListener('logomaker-settings-updated', handleSettingsUpdateListener);
    }

    // Add dataset marker if needed for safety checks elsewhere
    // modalElement.dataset.listenersAttached = 'true';
    console.log("[PNGRenderer] Modal event listeners attached.");
}

/** Detaches event listeners when modal closes */
/** Detaches event listeners when modal closes */
function detachModalEventListeners() {
  // Ensure elements are present
  if (!modalElement || !closeBtn || !cancelBtn || !exportBtn /* etc... */) {
       console.warn("[PNGRenderer] Cannot detach listeners, elements missing or already gone.");
       return;
  }
  // Optional: Check if listeners were actually marked as attached
  // if (modalElement.dataset.listenersAttached !== 'true') return;

  console.log("[PNGRenderer] Detaching modal event listeners...");

  closeBtn.removeEventListener('click', closeModal);
  cancelBtn.removeEventListener('click', closeModal);
  if (modalClickListener) { // Remove stored listener
      modalElement.removeEventListener('click', modalClickListener);
      modalClickListener = null;
  }
  exportBtn.removeEventListener('click', handleExport);

  // Remove stored handlers for controls
  if (previewUpdateHandler) {
       snapshotRadio.removeEventListener('change', previewUpdateHandler);
       svgRenderRadio.removeEventListener('change', previewUpdateHandler);
       transparentCheckbox.removeEventListener('change', previewUpdateHandler);
       qualityInput.removeEventListener('change', previewUpdateHandler);
       previewUpdateHandler = null; // Clear reference
  }
  if (qualityInputListener) {
      qualityInput.removeEventListener('input', qualityInputListener);
      qualityInputListener = null; // Clear reference
  }

  // We typically keep the global listener (`handleSettingsUpdateListener`) attached
  // We also keep the global ESC listener attached/detached in open/close

  // Remove dataset marker if you used it
  // modalElement.removeAttribute('data-listenersAttached');
  console.log("[PNGRenderer] Modal event listeners detached.");
}

/** Opens the PNG export modal */
function openModal() {
  if (!isInitialized) {
      console.error('[PNGRenderer] Cannot open modal: Not initialized.');
      if (typeof showAlert === 'function') showAlert('PNG Exporter is not ready.', 'error');
      return;
  }
  attachModalEventListeners();
  console.log("[PNGRenderer] Opening modal...");
  syncExportSettings(); // Sync settings from main UI first

  // Reset state before showing
  showLoading(false); // Ensure loader is hidden
  previewImage.style.display = 'none'; // Ensure image is hidden
  previewImage.removeAttribute('src'); // Clear previous image source
  exportBtn.disabled = false; // Ensure export button is enabled
  exportBtn.textContent = 'Export PNG';

  modalElement.classList.add('active'); // Show the modal (using class for potential transitions)
  // ---> Direct style change to ensure display override <---
  modalElement.style.display = 'flex';
  // Optionally add active class IF your CSS uses it for transitions (e.g., opacity)
  // If you added opacity/visibility transitions to CSS, add this line back:
  // requestAnimationFrame(() => modalElement.classList.add('active')); // Add class slightly after display changeransitions)
  document.body.style.overflow = 'hidden'; // Prevent background scroll
  document.addEventListener('keydown', handleEscKey); // Add ESC listener
  // CRITICAL: Generate preview *after* the modal is rendered and layout is stable
  requestAnimationFrame(() => {
      // Small delay can sometimes help ensure dimensions are calculated correctly
      setTimeout(() => {
           if (modalElement.classList.contains('active')) { // Check if still open
              updatePreview();
           }
      }, 50); // 50ms delay, adjust if needed
  });
}

/** Closes the PNG export modal */
function closeModal() {
  if (!modalElement || !modalElement.classList.contains('active')) {
      return; // Already closed or not found
  }
  detachModalEventListeners(); // Clean up listeners if needed
  console.log("[PNGRenderer] Closing modal.");
  modalElement.classList.remove('active');
  modalElement.style.display = 'none'; // Directly hide the modal
  document.body.style.overflow = ''; // Restore background scroll
  document.removeEventListener('keydown', handleEscKey); // Remove ESC listener
  // Optional: Clear preview src after closing if desired
  // setTimeout(() => { previewImage.removeAttribute('src'); }, 300); // Delay if fade out transition
}


/** Syncs modal inputs with main UI export settings (if available) */
function syncExportSettings() {
  console.log("[PNGRenderer] Syncing settings from main UI...");
  try {
      // Use optional chaining and provide defaults
      const mainW = document.getElementById('exportWidth')?.value ?? '800';
      const mainH = document.getElementById('exportHeight')?.value ?? '400';
      const mainQ = document.getElementById('exportQuality')?.value ?? '95';
      const mainT = document.getElementById('exportTransparent')?.checked ?? false;

      // Update modal inputs only if they exist
      if (widthInput) widthInput.value = mainW;
      if (heightInput) heightInput.value = mainH;
      if (qualityInput) qualityInput.value = mainQ;
      if (qualityDisplay) qualityDisplay.textContent = `${mainQ}%`;
      if (transparentCheckbox) transparentCheckbox.checked = mainT;

  } catch (err) {
      console.warn('[PNGRenderer] Could not sync settings from main UI elements. Using current/default values.', err);
  }
}

/** Updates the preview image in the modal based on current settings */
async function updatePreview() {
  // Abort if not ready or modal not visible
  if (!isInitialized || !modalElement || !modalElement.classList.contains('active')) {
      console.log("[PNGRenderer updatePreview] Aborting: Not initialized or modal not visible.");
      return;
  }
  // Check required elements needed for this specific function
  if (!previewImage || !loadingIndicator || !snapshotRadio || !svgRenderRadio || !transparentCheckbox || !widthInput || !heightInput || !snapshotWarningEl) {
      console.error("[PNGRenderer updatePreview] Aborting: Required modal elements for preview are missing.");
      showLoading(true, "Preview Error: UI elements missing.");
      return;
  }

  const method = snapshotRadio.checked ? 'snapshot' : 'svgRender';
  const w = parseInt(widthInput.value, 10) || 800;
  const h = parseInt(heightInput.value, 10) || 400;
  const transparent = transparentCheckbox.checked;

  console.log(`[PNGRenderer] Updating preview (Method: ${method}, Size: ${w}x${h}, Transparent: ${transparent})`);
  showLoading(true, `Generating ${method} preview...`);
  previewImage.style.display = 'none'; // Hide previous image
  previewImage.removeAttribute('src'); // Clear src

  // Show/hide snapshot warning message
  snapshotWarningEl.style.display = snapshotRadio.checked ? 'block' : 'none';

  try {
      let dataUrl = null;

      if (method === 'snapshot') {
          if (typeof captureLogoWithHTML2Canvas !== 'function') {
              throw new Error('Snapshot mode unavailable: html2canvas helper function (captureLogoWithHTML2Canvas) missing.');
          }
          const container = document.getElementById('previewContainer');
          if (!container) {
              throw new Error('Source element #previewContainer not found for snapshot.');
          }

          console.time("SnapshotPreviewGeneration");
          // Use a moderate scale for preview speed vs quality balance
          const canvas = await captureLogoWithHTML2Canvas(container, {
              width: w,
              height: h,
              transparentBackground: transparent,
              scale: Math.min(window.devicePixelRatio, 1.5) // Cap scale for preview
          });
          console.timeEnd("SnapshotPreviewGeneration");

          console.time("SnapshotPreviewBlob");
          const blob = await new Promise((resolve, reject) => {
               // Use default quality for preview blob
              canvas.toBlob(b => b ? resolve(b) : reject(new Error('Snapshot preview: canvas.toBlob failed')), 'image/png');
          });
           console.timeEnd("SnapshotPreviewBlob");

          console.time("SnapshotPreviewDataURL");
          dataUrl = await blobToDataURL(blob);
           console.timeEnd("SnapshotPreviewDataURL");

      } else { // svgRender path
          console.time("SvgRenderPreviewGeneration");
          // generateConsistentPreview should handle SVG -> PNG conversion internally
          const result = await generateConsistentPreview({
              width: w,
              height: h,
              transparentBackground: transparent
          }, previewImage, loadingIndicator, 'png'); // Pass type hint
           console.timeEnd("SvgRenderPreviewGeneration");

          if (!result || !result.dataUrl) {
              throw new Error("SVG Render preview failed to generate Data URL.");
          }
          dataUrl = result.dataUrl; // This function might update the image src directly
      }

      // Set the image source and handle load/error
      if (dataUrl) {
          // If generateConsistentPreview didn't already set the src, set it now.
           if (!previewImage.src || previewImage.src !== dataUrl) {
              previewImage.src = dataUrl;
           }

           // Ensure load/error handlers are attached *before* potentially setting src again
           // or in case generateConsistentPreview set it but didn't handle load state perfectly.
          previewImage.onload = () => {
              console.log("[PNGRenderer] Preview image loaded.");
              showLoading(false);
              previewImage.style.display = 'block';
              previewImage.alt = `PNG Preview (${method}, ${w}x${h})`;
          };
          previewImage.onerror = (err) => {
              console.error('[PNGRenderer] Preview image failed to load:', err);
              showLoading(true, 'Preview Failed (Image Load Error)');
              previewImage.style.display = 'none'; // Hide broken image
              previewImage.alt = 'Preview Failed';
          };

           // If the image is already cached and loaded instantly, onload might not fire
           // Check if it's already complete and trigger manually if needed.
           if (previewImage.complete && previewImage.naturalWidth > 0) {
               previewImage.onload();
           }

      } else {
           // This case should ideally be caught by errors above, but as a fallback:
           throw new Error("Preview generation resulted in empty data.");
      }

  } catch (err) {
      console.error('[PNGRenderer] Error during updatePreview:', err);
      showLoading(true, `Preview Failed: ${err.message}`); // Show error in loader
      previewImage.style.display = 'none';
      previewImage.alt = 'Preview Failed';
  }
}


/** Handles the final PNG export process */
async function handleExport() {
  if (!isInitialized || !modalElement) return; // Basic checks

  // Ensure export button and loader exist
  if (!exportBtn || !loadingIndicator) {
       console.error("[PNGRenderer handleExport] Export button or loading indicator missing.");
       if (typeof showAlert === 'function') showAlert('Export failed: UI elements missing.', 'error');
       return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  showLoading(true, 'Generating final PNG...');

  // Gather current settings
  const method = snapshotRadio.checked ? 'snapshot' : 'svgRender';
  const w = parseInt(widthInput.value, 10) || 800;
  const h = parseInt(heightInput.value, 10) || 400;
  // Quality is 0..1 for canvas.toBlob, but 10-100 from input
  const qualityVal = (parseInt(qualityInput.value, 10) || 95) / 100;
  const transparent = transparentCheckbox.checked;

  console.log(`[PNGRenderer] Starting export (Method: ${method}, Size: ${w}x${h}, Quality: ${qualityVal}, Transparent: ${transparent})`);

  let finalBlob = null;
  let exportSuccess = false; // Flag to track success

  try {
      if (method === 'snapshot') {
          if (typeof captureLogoWithHTML2Canvas !== 'function') {
               throw new Error('Snapshot export unavailable: html2canvas helper function missing.');
          }
          const container = document.getElementById('previewContainer');
          if (!container) {
              throw new Error('Source element #previewContainer not found for snapshot export.');
          }
          console.time("SnapshotExportGeneration");
          // Use a higher scale for better export quality
          const canvas = await captureLogoWithHTML2Canvas(container, {
               width: w,
               height: h,
               transparentBackground: transparent,
               scale: 2 // Or higher if needed, e.g., 3 or 4, balance quality vs performance/memory
           });
           console.timeEnd("SnapshotExportGeneration");

           console.time("SnapshotExportBlob");
           finalBlob = await new Promise((resolve, reject) => {
               canvas.toBlob(
                   (b) => b ? resolve(b) : reject(new Error('Snapshot export: canvas.toBlob failed')),
                   'image/png',
                   qualityVal // Pass quality hint (effectiveness varies by browser for PNG)
               );
           });
           console.timeEnd("SnapshotExportBlob");

      } else { // svgRender method
           console.time("SvgRenderExportGeneration");
           const svgBlob = await generateSVGBlob({ width: w, height: h, transparentBackground: transparent });
           finalBlob = await convertSVGtoPNG(svgBlob, {
               width: w,
               height: h,
               transparentBackground: transparent,
               quality: qualityVal // Pass quality hint
           });
           console.timeEnd("SvgRenderExportGeneration");
      }

      if (finalBlob) {
           // Determine filename
           let baseName = 'logo';
           if (typeof window.Utils?.getLogoFilenameBase === 'function') {
               baseName = window.Utils.getLogoFilenameBase() || baseName;
           }
           const filename = `${baseName}_${w}x${h}.png`;

           // Trigger download
           if (typeof window.Utils?.downloadBlob === 'function') {
               window.Utils.downloadBlob(finalBlob, filename);
               console.log(`[PNGRenderer] Initiated download for ${filename} using Utils.downloadBlob`);
           } else { // Fallback download method
               const url = URL.createObjectURL(finalBlob);
               const link = document.createElement('a');
               link.href = url;
               link.download = filename;
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
               // Revoke URL after a short delay
               setTimeout(() => URL.revokeObjectURL(url), 100);
                console.log(`[PNGRenderer] Initiated download for ${filename} using fallback method.`);
           }

          // Notify success (optional)
          if (typeof showToast === 'function') {
              showToast({ message: `PNG exported successfully: ${filename}`, type: 'success' });
          }
          exportSuccess = true;
          closeModal(); // Close modal only on successful export

      } else {
           throw new Error("Generated PNG blob was null or empty.");
      }
  } catch (err) {
      console.error('[PNGRenderer] Export failed:', err);
      showLoading(true, `Export Failed: ${err.message}`); // Show error in loader
      if (typeof showAlert === 'function') {
           showAlert(`PNG export failed (${method}): ${err.message}`, 'error');
      }
      // Keep modal open on error for feedback
  } finally {
      // Re-enable button regardless of success/failure, unless it succeeded (modal closed)
      if (!exportSuccess) {
           exportBtn.disabled = false;
           exportBtn.textContent = 'Export PNG';
           // Keep the loading indicator showing the error message if export failed
           // If we want to hide loader after showing error alert, uncomment next line:
           // showLoading(false);
      }
  }
}

/**
* Initializes the PNG Renderer UI.
* Injects HTML/CSS, queries elements, and attaches event listeners.
* @returns {Promise<boolean>} True if initialization was successful, false otherwise.
*/async function initializeUI() {
  if (isInitialized) {
    console.log("[PNGRenderer] Already initialized.");
    return true;
}
console.log("[PNGRenderer] Initializing UI...");
try {
    injectStyles();
    injectModalHTML();
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (!queryModalElements()) {
        throw new Error('Failed to find required modal elements after injection. Check HTML IDs.');
    }
    // attachModalEventListeners(); // <-- Line Removed
    isInitialized = true;
    console.log("[PNGRenderer] UI Initialized successfully.");
    return true;
} catch (err) {
      console.error('[PNGRenderer] UI Initialization failed:', err);
      isInitialized = false; // Ensure flag is false on failure
      if (typeof showAlert === 'function') {
          showAlert('Failed to initialize PNG Exporter UI.', 'error');
      }
      return false;
  }
}

/**
* Public function to trigger the PNG export modal.
* Ensures UI is initialized before opening.
* @public
*/
export async function exportPNGWithUI() {
  console.log("[PNGRenderer] exportPNGWithUI called...");
  try {
      // Initialize UI if needed, wait for it to complete
      const success = await initializeUI();

      if (!success) {
          // Initialization already showed an error, maybe log additional context
           console.error("[PNGRenderer] Cannot open modal because UI initialization failed.");
           // Optional: Show another alert, though initializeUI might have already done so.
           // if (typeof showAlert === 'function') showAlert('Cannot open PNG Exporter: Initialization failed.', 'error');
          return; // Stop if initialization failed
      }

      // If initialization succeeded (or was already done), open the modal
      openModal();

  } catch (err) {
      // Catch unexpected errors during the process
      console.error('[PNGRenderer] Error trying to open PNG exporter:', err);
      if (typeof showAlert === 'function') {
          showAlert(`Error opening PNG Exporter: ${err.message}`, 'error');
      }
  }
}

// Initial log message to confirm script load
console.log("[PNGRenderer v2.3 - Refined] Loaded.");