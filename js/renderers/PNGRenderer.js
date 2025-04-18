/**
 * PNGRenderer.js (v2.6.1 - Corrected Event Listeners & Removed Placeholder)
 * =======================================================================
 * Provides PNG export functionality via a modal interface.
 * Offers two rendering modes:
 * 1) **Snapshot (html2canvas)**: Captures the visual appearance of the #previewContainer for WYSIWYG results.
 * -> Includes UI warning for text gradient issues with html2canvas, checked via SettingsManager.
 * 2) **SVG-based**: Uses an SVG export pipeline for consistent vector rendering, then converts to PNG.
 *
 * Features:
 * - Modal-based export workflow with image preview and UI warnings.
 * - Optional background transparency.
 * - Responsive preview area with aspect ratio control.
 * - Handles different export methods and quality settings.
 * - Correctly attaches and detaches event listeners.
 *
 * Dependencies:
 * - RendererCore.js (for generateConsistentPreview, generateSVGBlob, convertSVGtoPNG, blobToDataURL)
 * - html2canvas / captureLogoWithHTML2Canvas (if snapshot mode is used)
 * - SettingsManager.js (for checking textColorMode) - MUST BE INITIALIZED FIRST
 * - Utility functions like showAlert, showToast, Utils.downloadBlob, Utils.getLogoFilenameBase (optional, provide fallbacks)
 *
 * Assumes:
 * - SettingsManager is imported correctly and provides getCurrentSettings().
 * - A #previewContainer element exists in the DOM for snapshot mode.
 * - Main UI elements (#exportWidth, #exportHeight, etc.) exist for initial settings sync.
 */

import {
  generateConsistentPreview,
  generateSVGBlob,
  convertSVGtoPNG,
  blobToDataURL
} from './RendererCore.js';

import { captureAdvancedStyles } from '../captureTextStyles.js';

// ---> ADJUST PATH AS NEEDED <---
import SettingsManager from '../settingsManager.js';

// Optional: Dynamically import if needed, or ensure it's globally available/bundled
// Ensure this path is correct for your project structure
import { captureLogoWithHTML2Canvas } from '../utils/html2Canvas.js';

/* -----------------------------------------------------
Module-Scope Variables & Constants
------------------------------------------------------ */
let isInitialized = false;          // Prevent multiple initializations
let handleSettingsUpdateListener;   // Reference for the global listener
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
  loadingProgressText = null,
  widthInput = null,
  heightInput = null,
  qualityInput = null,
  qualityDisplay = null,
  transparentCheckbox = null,
  snapshotRadio = null,
  svgRenderRadio = null,
  snapshotWarningEl = null,
  gradientWarningEl = null; // Reference for gradient warning UI element

/* -----------------------------------------------------
CSS for the PNG Exporter Modal (v2.6 - Based on v2.5)
------------------------------------------------------ */
const MODAL_CSS = `
/* PNG Exporter Modal (v2.6.1) */
.png-exporter-modal {
  position: fixed; inset: 0; display: none; /* Controlled by JS */
  justify-content: center; align-items: center; z-index: 1500;
  background: rgba(0, 0, 0, 0.65); /* Slightly darker overlay */
  overflow-y: auto; padding: 1rem;
}

/* Active state uses opacity/visibility for potential transitions */
.png-exporter-modal.active {
  display: flex; /* Use flex to show */
  opacity: 1; visibility: visible;
  transition: opacity 0.3s ease, visibility 0s linear 0s;
}

.png-exporter-modal .modal-content {
  background: var(--panel-bg, #f5f5f5); color: var(--text-color, #333);
  max-width: 700px; width: 100%; border-radius: 8px;
  box-shadow: 0 4px 18px rgba(0,0,0,0.3); padding: 1.5rem;
  position: relative; display: flex; flex-direction: column; gap: 1rem;
  max-height: 90vh; overflow: hidden; /* Content itself doesn't scroll */
  opacity: 1 !important; /* Ensure content is visible even if parent fades */
  transform: none !important;
  transition: opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s;
}

.png-exporter-modal .modal-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.5rem; flex-shrink: 0;
}
.png-exporter-modal .modal-header h3 { font-size: 1.3rem; margin: 0; }
.png-exporter-modal .modal-header button {
  background: none; border: none; font-size: 1.8rem; color: var(--text-color-muted, #666);
  cursor: pointer; padding: 0.2rem; line-height: 1;
}
.png-exporter-modal .modal-header button:hover { color: var(--text-color, #333); }

.png-exporter-modal .modal-body {
  display: flex; flex-direction: column; gap: 1.2rem;
  overflow-y: auto; /* Make body scrollable */
  padding-right: 5px; margin-right: -5px; /* Scrollbar padding */
}

/* Preview area */
.png-exporter-modal .exporter-preview-area {
  position: relative; width: 100%; padding-top: 56.25%; /* 16:9 */
  background-color: rgba(0,0,0,0.05); border: 1px solid var(--border-color, #ccc);
  border-radius: 6px; overflow: hidden;
}
.png-exporter-modal .exporter-preview-image {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  object-fit: contain; display: none; /* Hidden until loaded */
  background: repeating-conic-gradient(var(--border-subtle, #ccc) 0% 25%, var(--panel-bg-opaque, #fff) 0% 50%) 50% / 20px 20px;
  background-size: 20px 20px; border: 0;
}
body.dark-mode .png-exporter-modal .exporter-preview-image {
  background: repeating-conic-gradient(var(--border-color, #444) 0% 25%, var(--panel-bg, #282828) 0% 50%) 50% / 20px 20px;
  background-size: 20px 20px;
}

/* Loading overlay */
.png-exporter-modal .exporter-preview-loading {
  position: absolute; inset: 0; background: rgba(255, 255, 255, 0.85); /* Slightly more opaque */
  display: none; flex-direction: column; justify-content: center; align-items: center;
  z-index: 2; color: var(--text-color, #333); border-radius: inherit;
  text-align: center; transition: opacity 0.2s ease; font-size: 0.9rem;
}
.png-exporter-modal .exporter-preview-loading.visible { display: flex; }
body.dark-mode .png-exporter-modal .exporter-preview-loading { background: rgba(20, 20, 20, 0.85); color: #ccc; }
.png-exporter-modal .exporter-preview-loading .spinner {
  border: 4px solid rgba(var(--accent-color-rgb, 255, 20, 147), 0.2);
  border-left-color: var(--accent-color, #ff1493); border-radius: 50%;
  width: 32px; height: 32px; animation: png-spin 1s linear infinite; margin-bottom: 0.8rem;
}
@keyframes png-spin { to { transform: rotate(360deg); } }

/* Controls */
.png-exporter-modal .exporter-controls-area { display: flex; flex-direction: column; gap: 1rem; }
.png-exporter-modal .control-group {
  display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 0.8rem; align-items: center;
}
.png-exporter-modal .control-group label:not(.checkbox-label):not(.radio-label) {
  font-weight: 500; font-size: 0.9rem; text-align: right; white-space: nowrap;
}
.png-exporter-modal input[type="number"],
.png-exporter-modal input[type="range"] {
  width: 100%; padding: 0.4rem 0.6rem; font-size: 0.9rem;
  border: 1px solid var(--border-color, #ccc); border-radius: 4px;
  background-color: var(--input-bg, #fff);
  color: var(--text-color, #333); /* Ensure text color inherits */
}
.png-exporter-modal input[readonly] { background-color: var(--bg-base, #eee); opacity: 0.7; cursor: not-allowed; }
body.dark-mode .png-exporter-modal input[readonly] { background-color: var(--input-bg-disabled, #333); }
body.dark-mode .png-exporter-modal input[type="number"],
body.dark-mode .png-exporter-modal input[type="range"] {
  background-color: var(--input-bg-dark, #2c2c2c);
  border-color: var(--border-color-dark, #555);
  color: var(--text-color-dark, #eee);
}

.png-exporter-modal .range-container { display: flex; align-items: center; gap: 0.8rem; }
.png-exporter-modal .range-container span { font-size: 0.9rem; color: var(--text-color-muted, #666); min-width: 45px; text-align: right; }
body.dark-mode .png-exporter-modal .range-container span { color: var(--text-color-muted-dark, #999); }

.png-exporter-modal .checkbox-label, .png-exporter-modal .radio-label {
  display: flex; align-items: center; cursor: pointer; grid-column: 2 / 3; font-size: 0.9rem;
}
.png-exporter-modal .checkbox-label input[type="checkbox"],
.png-exporter-modal .radio-label input[type="radio"] {
  width: 17px; height: 17px; margin-right: 0.6rem; accent-color: var(--accent-color, #ff1493); cursor: pointer;
}

.png-exporter-modal fieldset {
  border: 1px solid var(--border-color, #ccc); border-radius: 6px;
  padding: 0.8rem 1rem; margin-top: 0.5rem; grid-column: 1 / 3;
}
body.dark-mode .png-exporter-modal fieldset { border-color: var(--border-color-dark, #555); }

.png-exporter-modal fieldset legend {
  font-weight: 600; font-size: 0.95rem; color: var(--text-color, #333);
  padding: 0 0.5rem; margin-left: -0.5rem;
}
body.dark-mode .png-exporter-modal fieldset legend { color: var(--text-color-emphasis, #eee); }
.png-exporter-modal fieldset .radio-label { margin-bottom: 0.5rem; }
.png-exporter-modal fieldset .radio-label:last-child { margin-bottom: 0; }

/* Warnings */
.png-exporter-modal .snapshot-warning,
.png-exporter-modal .gradient-warning { /* Base warning style */
  font-size: 0.85rem; padding: 0.6rem 0.8rem; border-radius: 4px;
  margin-top: 0.6rem; display: none; /* Controlled by JS */
  grid-column: 1 / 3; line-height: 1.4; border-left: 3px solid;
}

/* General Snapshot Warning (Info Style) */
.png-exporter-modal .snapshot-warning {
  color: var(--info-text, #346985);
  background-color: var(--info-bg-subtle, rgba(108, 173, 206, 0.1));
  border-left-color: var(--info-border, #6cacd8);
}
body.dark-mode .png-exporter-modal .snapshot-warning {
  color: var(--info-text-dark, #a6d9f5);
  background-color: var(--info-bg-subtle-dark, rgba(166, 217, 245, 0.15));
  border-left-color: var(--info-border-dark, #8ecbf0);
}

/* Gradient Specific Warning (Warning Style) */
.png-exporter-modal .gradient-warning {
  color: var(--warning-text, #b45);
  background-color: var(--warning-bg-subtle, rgba(204, 119, 85, 0.1));
  border-left-color: var(--warning-border, #cc7755);
  font-weight: 500;
}
body.dark-mode .png-exporter-modal .gradient-warning {
  color: var(--warning-text-dark, #f7906f);
  background-color: var(--warning-bg-subtle-dark, rgba(247, 144, 111, 0.15));
  border-left-color: var(--warning-border-dark, #f7906f);
}

/* Footer */
.png-exporter-modal .modal-footer {
  display: flex; justify-content: flex-end; gap: 0.8rem;
  padding-top: 1rem; border-top: 1px solid var(--border-color, #ccc); flex-shrink: 0;
}
body.dark-mode .png-exporter-modal .modal-footer { border-top-color: var(--border-color-dark, #555); }

.png-exporter-modal .modal-footer button {
  border: none; padding: 0.6rem 1.2rem; font-size: 0.95rem; font-weight: 500;
  cursor: pointer; border-radius: 5px; transition: background-color 0.2s ease, opacity 0.2s ease;
}
.png-exporter-modal .modal-footer .cancel-btn {
  background-color: var(--button-secondary-bg, #ccc); color: var(--button-secondary-text, #333);
}
.png-exporter-modal .modal-footer .cancel-btn:hover { background-color: var(--button-secondary-hover-bg, #bbb); }
body.dark-mode .png-exporter-modal .modal-footer .cancel-btn {
  background-color: var(--button-secondary-bg-dark, #555); color: var(--button-secondary-text-dark, #eee);
}
body.dark-mode .png-exporter-modal .modal-footer .cancel-btn:hover { background-color: var(--button-secondary-hover-bg-dark, #666); }

.png-exporter-modal .modal-footer .export-btn { background-color: var(--accent-color, #ff1493); color: #fff; }
.png-exporter-modal .modal-footer .export-btn:hover { background-color: var(--accent-color-hover, #e01280); }
.png-exporter-modal .modal-footer .export-btn:disabled { opacity: 0.6; cursor: not-allowed; background-color: var(--accent-color, #ff1493) !important; } /* Ensure disabled color */

/* Mobile */
@media (max-width: 600px) {
  .png-exporter-modal .modal-content { padding: 1rem; max-height: 95vh; }
  .png-exporter-modal .modal-body { gap: 1rem; }
  .png-exporter-modal .exporter-preview-area { padding-top: 66.66%; } /* 3:2 */
  .png-exporter-modal .control-group { grid-template-columns: 1fr; gap: 0.2rem 0; }
  .png-exporter-modal .control-group label:not(.checkbox-label):not(.radio-label) { text-align: left; margin-bottom: 0.1rem; }
  .png-exporter-modal .checkbox-label, .png-exporter-modal .radio-label { grid-column: 1 / 2; margin-top: 0.3rem; }
  .png-exporter-modal fieldset,
  .png-exporter-modal .snapshot-warning,
  .png-exporter-modal .gradient-warning { grid-column: 1 / 2; padding: 0.6rem 0.8rem; }
  .png-exporter-modal .modal-footer { flex-direction: column-reverse; align-items: stretch; }
}
`;

/* -----------------------------------------------------
HTML template for the PNG Exporter Modal (v2.6 - Includes UI Warning Div)
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
                   Note: Snapshot captures exact appearance (including CSS effects) but can be slower and may vary slightly across browsers/devices.
              </div>

              <div id="gradientMethodWarning" class="gradient-warning">
                  <strong>Gradient Warning:</strong> Text gradients may not export correctly with the Snapshot method due to library limitations. Consider using SVG Render if gradients are essential.
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


// --- Utility / Helper Functions ---

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
      return false;
  }

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
  snapshotWarningEl = document.getElementById('snapshotMethodWarning');
  gradientWarningEl = document.getElementById('gradientMethodWarning'); // Query the UI warning element

  const allFound = !!(
      modalElement && closeBtn && cancelBtn && exportBtn &&
      previewImage && loadingIndicator && loadingProgressText &&
      widthInput && heightInput && qualityInput && qualityDisplay &&
      transparentCheckbox && snapshotRadio && svgRenderRadio &&
      snapshotWarningEl && gradientWarningEl // Check UI warning element
  );

  if (!allFound) {
      console.error("[PNGRenderer] Failed to query one or more essential modal elements! Check IDs and HTML structure.");
      const missing = [
          !modalElement && 'modalElement', !closeBtn && 'closeBtn', !cancelBtn && 'cancelBtn', !exportBtn && 'exportBtn',
          !previewImage && 'previewImage', !loadingIndicator && 'loadingIndicator', !loadingProgressText && 'loadingProgressText',
          !widthInput && 'widthInput', !heightInput && 'heightInput', !qualityInput && 'qualityInput',
          !qualityDisplay && 'qualityDisplay', !transparentCheckbox && 'transparentCheckbox',
          !snapshotRadio && 'snapshotRadio', !svgRenderRadio && 'svgRenderRadio', !snapshotWarningEl && 'snapshotWarningEl',
          !gradientWarningEl && 'gradientWarningEl' // Log if missing
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

/** Shows/hides the UI warning messages based on the selected method and SettingsManager state */
function checkAndShowWarnings() {
  // Ensure UI elements for warnings exist
  if (!snapshotRadio || !snapshotWarningEl || !gradientWarningEl) {
       console.warn("[PNGRenderer checkAndShowWarnings] Missing UI elements required for warnings.");
       // Ensure warnings are hidden if elements are missing
       if(snapshotWarningEl) snapshotWarningEl.style.display = 'none';
       if(gradientWarningEl) gradientWarningEl.style.display = 'none';
       return;
  }

  try {
      const isSnapshotMethod = snapshotRadio.checked;
      // Show/hide the general snapshot warning UI element
      snapshotWarningEl.style.display = isSnapshotMethod ? 'block' : 'none';

      // --- Check SettingsManager for gradient state ---
      let gradientActive = false;
      // Ensure SettingsManager and its method exist before calling
      if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.getCurrentSettings === 'function') {
           const currentSettings = SettingsManager.getCurrentSettings();
           // Check if the critical property exists before accessing
           if (currentSettings && currentSettings.hasOwnProperty('textColorMode')) {
              gradientActive = currentSettings.textColorMode === 'gradient';
              // console.log(`[PNGRenderer checkAndShowWarnings] Checked SettingsManager: textColorMode='${currentSettings.textColorMode}', gradientActive=${gradientActive}`);
           } else {
               console.warn("[PNGRenderer checkAndShowWarnings] SettingsManager state missing 'textColorMode'. Assuming no gradient.");
               gradientActive = false;
           }
      } else {
          console.error("[PNGRenderer checkAndShowWarnings] SettingsManager or SettingsManager.getCurrentSettings is not available. Cannot check gradient state.");
          gradientActive = false; // Default to false if SettingsManager is unavailable
      }
      // --- End Check ---

      // Show/hide the specific gradient warning UI element
      const showGradientWarning = isSnapshotMethod && gradientActive;
      gradientWarningEl.style.display = showGradientWarning ? 'block' : 'none';

  } catch (err) {
      console.error("[PNGRenderer checkAndShowWarnings] Error during warning check:", err);
      // Hide warnings on error to prevent incorrect display
      snapshotWarningEl.style.display = 'none';
      gradientWarningEl.style.display = 'none';
  }
}


// --- Event Listener Management (Restored from v2.5/Old for Robustness) ---
let modalClickListener = null;
let qualityInputListener = null;
let previewUpdateHandler = null; // Combined handler for preview updates

/** Attaches event listeners just before modal opens */
function attachModalEventListeners() {
  if (!modalElement || !closeBtn || !cancelBtn || !exportBtn || !qualityInput || !snapshotRadio || !svgRenderRadio || !transparentCheckbox) {
      console.error("[PNGRenderer] Cannot attach listeners, essential elements missing."); return;
  }
  // Prevent double-attaching if somehow called again before detaching
  if (modalElement.dataset.listenersAttached === 'true') {
      console.warn("[PNGRenderer] Listeners seem already attached. Aborting attach."); return;
  }

  console.log("[PNGRenderer] Attaching modal event listeners...");

  // Close/Cancel Buttons
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Export Button
  exportBtn.addEventListener('click', handleExport);

  // Modal background click to close
  modalClickListener = (evt) => { if (evt.target === modalElement) { closeModal(); } };
  modalElement.addEventListener('click', modalClickListener);

  // Quality slider real-time value display
  qualityInputListener = () => { if (qualityDisplay) qualityDisplay.textContent = `${qualityInput.value}%`; };
  qualityInput.addEventListener('input', qualityInputListener);

  // Handler for options that trigger preview update AND warning checks
  previewUpdateHandler = () => {
      console.log("[PNGRenderer] Option changed, updating preview and warnings.");
      checkAndShowWarnings(); // Check warnings whenever relevant options change
      updatePreview(); // Update the preview image
  };

  // Attach preview update handler to relevant controls
  snapshotRadio.addEventListener('change', previewUpdateHandler);
  svgRenderRadio.addEventListener('change', previewUpdateHandler);
  transparentCheckbox.addEventListener('change', previewUpdateHandler);
  qualityInput.addEventListener('change', previewUpdateHandler); // Update preview on 'change' (after release), not just 'input'

  // Attach listener for external settings updates (e.g., from main UI)
  if (!handleSettingsUpdateListener) {
      handleSettingsUpdateListener = () => {
          if (modalElement?.classList.contains('active')) {
              console.log("[PNGRenderer] Settings updated externally, syncing modal.");
              syncExportSettings();
              checkAndShowWarnings(); // Re-check warnings on external update
              updatePreview();
          }
      };
      document.addEventListener('logomaker-settings-updated', handleSettingsUpdateListener);
  }

  modalElement.dataset.listenersAttached = 'true'; // Mark as attached
  console.log("[PNGRenderer] Modal event listeners attached.");
}

/** Detaches event listeners when modal closes */
function detachModalEventListeners() {
  // Only detach if listeners were actually attached
  if (!modalElement || modalElement.dataset.listenersAttached !== 'true') {
      // console.log("[PNGRenderer] Skipping detach, listeners not marked as attached.");
      return;
  }
  console.log("[PNGRenderer] Detaching modal event listeners...");

  // Use optional chaining ?. in case elements somehow disappeared
  closeBtn?.removeEventListener('click', closeModal);
  cancelBtn?.removeEventListener('click', closeModal);
  exportBtn?.removeEventListener('click', handleExport);

  if (modalClickListener && modalElement) {
      modalElement.removeEventListener('click', modalClickListener);
      modalClickListener = null; // Clear reference
  }

  if (qualityInputListener && qualityInput) {
      qualityInput.removeEventListener('input', qualityInputListener);
      qualityInputListener = null; // Clear reference
  }

  if (previewUpdateHandler) {
      snapshotRadio?.removeEventListener('change', previewUpdateHandler);
      svgRenderRadio?.removeEventListener('change', previewUpdateHandler);
      transparentCheckbox?.removeEventListener('change', previewUpdateHandler);
      qualityInput?.removeEventListener('change', previewUpdateHandler);
      previewUpdateHandler = null; // Clear reference
  }

  // Do NOT remove the global 'logomaker-settings-updated' listener here,
  // as it should persist for the lifetime of the module/page.

  modalElement.removeAttribute('data-listenersAttached'); // Mark as detached
  console.log("[PNGRenderer] Modal event listeners detached.");
}


// --- Modal Lifecycle ---

/** Opens the PNG export modal */
function openModal() {
  if (!isInitialized) { console.error('[PNGRenderer] Not initialized.'); if (typeof showAlert === 'function') showAlert('PNG Exporter is not ready.', 'error'); return; }
  if (modalElement.classList.contains('active')) { console.warn('[PNGRenderer] Modal already open.'); return; }
  console.log("[PNGRenderer] Opening modal...");
  if (!modalElement || !previewImage || !exportBtn) { console.error('[PNGRenderer] Cannot open: Critical elements missing.'); if (typeof showAlert === 'function') showAlert('PNG Exporter UI incomplete.', 'error'); return; }

  syncExportSettings();
  checkAndShowWarnings(); // Ensure UI warnings are checked and displayed/hidden correctly on open

  showLoading(false);
  previewImage.style.display = 'none';
  previewImage.src = '';
  previewImage.alt = 'PNG Preview';
  exportBtn.disabled = false;
  exportBtn.textContent = 'Export PNG';

  attachModalEventListeners(); // Attach listeners just before showing

  modalElement.style.display = 'flex';
  requestAnimationFrame(() => { modalElement.classList.add('active'); }); // Trigger transition

  document.body.style.overflow = 'hidden'; // Prevent background scrolling
  document.addEventListener('keydown', handleEscKey); // Add ESC key listener

  // Update preview shortly after modal animation starts
  requestAnimationFrame(() => {
      setTimeout(() => {
          if (modalElement?.classList.contains('active')) {
              updatePreview(); // Generate initial preview
          } else {
              console.warn("[PNGRenderer] Modal closed before initial preview could be generated.");
          }
      }, 50); // Small delay to ensure modal is visible
  });
}

/** Closes the PNG export modal */
function closeModal() {
  if (!modalElement || !modalElement.classList.contains('active')) return;
  console.log("[PNGRenderer] Closing modal.");

  // Crucially, detach listeners *before* hiding
  detachModalEventListeners();

  modalElement.classList.remove('active'); // Trigger fade-out animation

  // Wait for animation before setting display: none
  setTimeout(() => {
      // Check again in case it was reopened quickly
      if (modalElement && !modalElement.classList.contains('active')) {
          modalElement.style.display = 'none';
      }
  }, 300); // Match CSS transition duration

  document.body.style.overflow = ''; // Restore background scrolling
  document.removeEventListener('keydown', handleEscKey); // Remove ESC listener
}


/** Syncs modal inputs with main UI export settings (if they exist) */
function syncExportSettings() {
  console.log("[PNGRenderer] Syncing settings from main UI...");
  try {
      // Use optional chaining and nullish coalescing for safety
      const mainW = document.getElementById('exportWidth')?.value ?? '800';
      const mainH = document.getElementById('exportHeight')?.value ?? '400';
      const mainQ = document.getElementById('exportQuality')?.value ?? '95';
      const mainT = document.getElementById('exportTransparent')?.checked ?? false;

      if (widthInput) widthInput.value = mainW;
      if (heightInput) heightInput.value = mainH;
      if (qualityInput) qualityInput.value = mainQ;
      if (qualityDisplay) qualityDisplay.textContent = `${mainQ}%`;
      if (transparentCheckbox) transparentCheckbox.checked = mainT;
  } catch (err) {
      console.warn('[PNGRenderer] Could not sync settings from main UI.', err);
  }
}


  // --- Core Rendering & Export Logic ---

  /** Updates the PNG preview image in the modal (Uses new script's logic) */
  async function updatePreview() {
    if (!isInitialized || !modalElement?.classList.contains('active') || !previewImage || !loadingIndicator || !widthInput || !heightInput || !transparentCheckbox || !snapshotRadio) {
        console.warn("[PNGRenderer updatePreview] Aborting: Prerequisites not met.");
        return;
    }

    const w = parseInt(widthInput.value, 10) || 800;
    const h = parseInt(heightInput.value, 10) || 400;
    const transparent = transparentCheckbox.checked;
    const method = snapshotRadio.checked ? 'snapshot' : 'svgRender';

    console.log(`[PNGRenderer] Updating preview (Method: ${method}, Size: ${w}x${h}, T: ${transparent})`);
    showLoading(true, `Generating ${method === 'snapshot' ? 'snapshot' : 'SVG render'} preview...`);
    previewImage.style.display = 'none';
    previewImage.src = '';
    previewImage.alt = 'Generating...';

    try {
        // Capture styles first for logging and passing
        const styles = await captureAdvancedStyles();
        if (!styles) throw new Error("Failed to capture styles for preview.");

        // Add logging for debugging
        // console.log(`[PNGRenderer] Color data - Mode: ${styles.color?.mode}, Value: ${styles.color?.value}`);
        // console.log(`[PNGRenderer] Background data - Type: ${styles.background?.type}, Color: ${styles.background?.color}`);
        // console.log(`[PNGRenderer] Font data - Family: ${styles.font?.family}, Size: ${styles.font?.size}`);

        // Force the DOM to update completely before capture (can help with complex CSS)
        await new Promise(resolve => setTimeout(resolve, 50));

        let result = { blob: null, dataUrl: null };
        const container = document.getElementById('previewContainer');
        if (!container) throw new Error("#previewContainer not found.");

        const options = {
            width: w,
            height: h,
            transparentBackground: transparent,
            preCapturedStyles: styles // Pass the captured styles
        };

        if (method === 'snapshot') {
            if (typeof captureLogoWithHTML2Canvas !== 'function') throw new Error('captureLogoWithHTML2Canvas missing.');

            // For snapshot method, ensure styles are applied directly if possible by the helper
            const canvas = await captureLogoWithHTML2Canvas(container, {
                ...options,
                scale: 2 // Higher scale for better preview quality (might differ from final export scale)
            });

            if (!canvas || !(canvas instanceof HTMLCanvasElement)) throw new Error("Snapshot preview canvas generation failed.");
            const dataUrl = canvas.toDataURL('image/png');
            if (!dataUrl || dataUrl === 'data:,') throw new Error("Snapshot preview toDataURL failed.");
            result = { dataUrl: dataUrl, blob: null };
        } else { // svgRender
            // Assuming generateConsistentPreview handles SVG->PNG conversion internally for the preview
             result = await generateConsistentPreview(options, null, loadingIndicator, 'svg'); // Pass 'svg' type hint
             if (!result || !result.dataUrl) throw new Error("SVG generation failed to return a data URL for preview.");
         }

        if (previewImage && result.dataUrl) {
            let loaded = false; // Prevent multiple load/error triggers

            previewImage.onload = () => {
                if (!loaded) {
                    loaded = true;
                    showLoading(false);
                    previewImage.style.display = 'block'; // Show only after loaded
                    console.log('[PNGRenderer] Preview loaded.');
                }
            };

            previewImage.onerror = (err) => {
                if (!loaded) {
                    loaded = true;
                    showLoading(true, "Preview Load Error.");
                    previewImage.style.display = 'none';
                    console.error('[PNGRenderer] Preview image load error:', err);
                }
            };

            previewImage.src = result.dataUrl;
            previewImage.alt = `${method} Preview (${w}x${h})`;
            // Keep hidden until onload fires
            previewImage.style.display = 'none';
        } else {
            throw new Error("Preview succeeded, but no dataUrl to display.");
        }
    } catch (err) {
        console.error("[PNGRenderer] updatePreview error:", err);
        showLoading(true, `Preview Failed: ${err.message}`);
        if (previewImage) {
            previewImage.style.display = 'none';
            previewImage.alt = 'Preview Failed';
        }
    }
  }

/** Handles the final PNG export process */
async function handleExport() {
  if (!isInitialized || !modalElement || !exportBtn || !loadingIndicator || !snapshotRadio || !widthInput || !heightInput || !qualityInput || !transparentCheckbox) {
      console.error("[PNGRenderer handleExport] Aborted: Missing elements/init state.");
      if (typeof showAlert === 'function') showAlert('Export failed: UI components missing.', 'error');
      if(exportBtn) { exportBtn.disabled = false; exportBtn.textContent = 'Export PNG'; }
      showLoading(false); return;
  }

  console.log("[PNGRenderer handleExport] Export started.");
  exportBtn.disabled = true; exportBtn.textContent = 'Exporting...'; showLoading(true, 'Generating final PNG...');
  const method=snapshotRadio.checked?'snapshot':'svgRender', w=parseInt(widthInput.value,10)||800, h=parseInt(heightInput.value,10)||400, qualityVal=(parseInt(qualityInput.value,10)||95)/100, transparent=transparentCheckbox.checked;
  console.log(`[PNGRenderer] Export details -> Method: ${method}, Size: ${w}x${h}, Q: ${qualityVal}, T: ${transparent}`);
  console.time(`PNGExport_${method}`);

  let finalBlob = null, exportSuccess = false, exportError = null;

  try {
      if (method === 'snapshot') {
          if (typeof captureLogoWithHTML2Canvas !== 'function') throw new Error('captureLogoWithHTML2Canvas helper missing.');
          const container = document.getElementById('previewContainer'); if (!container) throw new Error('#previewContainer not found.');

          // Check gradient state via SettingsManager for console warning (still useful)
          let gradientActive = false;
          if (typeof SettingsManager !== 'undefined' && SettingsManager.getCurrentSettings) {
              const currentSettings = SettingsManager.getCurrentSettings(); gradientActive = currentSettings.textColorMode === 'gradient';
          }
          if (gradientActive) console.warn("[PNGRenderer handleExport] SNAPSHOT EXPORT: Text gradient active, potential export issues.");

          // Use scale: 2 for potentially higher quality export, adjust if needed
          const canvas = await captureLogoWithHTML2Canvas(container, { width: w, height: h, transparentBackground: transparent, scale: 2 });
          if (!canvas || !(canvas instanceof HTMLCanvasElement)) throw new Error("Snapshot canvas generation failed.");

          console.time("SnapshotExportBlobConversion");
          finalBlob = await new Promise((resolve, reject) => {
              // Add timeout for safety
              const timeoutId = setTimeout(() => reject(new Error('Snapshot export: canvas.toBlob timed out (30s).')), 30000);
              canvas.toBlob((blob) => {
                  clearTimeout(timeoutId);
                  blob ? resolve(blob) : reject(new Error('Snapshot export: canvas.toBlob returned null.'));
              }, 'image/png', qualityVal); // Pass quality here
          });
          console.timeEnd("SnapshotExportBlobConversion");
      } else { // svgRender
          console.time("SvgRenderExport_GenerateSVG");
          const svgBlob = await generateSVGBlob({ width: w, height: h, transparentBackground: transparent });
          console.timeEnd("SvgRenderExport_GenerateSVG");
          if (!svgBlob) throw new Error("SVG Blob generation failed.");

          console.time("SvgRenderExport_ConvertToPNG");
          // Ensure quality is passed to the conversion step
          finalBlob = await convertSVGtoPNG(svgBlob, { width: w, height: h, transparentBackground: transparent, quality: qualityVal });
          console.timeEnd("SvgRenderExport_ConvertToPNG");
          if (!finalBlob) throw new Error("SVG to PNG conversion failed.");
      }

      console.timeEnd(`PNGExport_${method}`);
      if (finalBlob) {
          let baseName = 'logo';
          try { // Safely get filename base
              if (typeof window.Utils?.getLogoFilenameBase === 'function') {
                  baseName = window.Utils.getLogoFilenameBase() || baseName;
              }
          } catch (e) { console.warn("Could not get custom filename base:", e); }

          const filename = `${baseName}_${w}x${h}.png`;
          console.log(`[PNGRenderer] Download triggered for: ${filename} (Size: ${finalBlob.size})`);

          try { // Download trigger logic with fallback
              if (typeof window.Utils?.downloadBlob === 'function') {
                  window.Utils.downloadBlob(finalBlob, filename);
              } else {
                  console.warn("[PNGRenderer] window.Utils.downloadBlob not found, using fallback download method.");
                  const url = URL.createObjectURL(finalBlob);
                  const a = document.createElement('a');
                  a.href=url;
                  a.download=filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  setTimeout(()=>URL.revokeObjectURL(url), 500); // Cleanup URL
              }
          } catch(e) { throw new Error(`Download failed: ${e.message}`); }

          try { // Optional success toast
              if (typeof showToast === 'function') showToast({ message: `PNG exported: ${filename}`, type: 'success' });
          } catch(e) { console.warn("showToast function not available:", e); }

          exportSuccess = true;
          closeModal(); // Close modal on successful export
      } else {
          throw new Error("Final PNG blob was empty.");
      }
  } catch (err) {
      console.error('[PNGRenderer] EXPORT FAILED:', err);
      console.timeEnd(`PNGExport_${method}`); // Ensure timer ends on error too
      exportError = err; // Store error if needed elsewhere
      showLoading(true, `Export Failed: ${err.message?.substring(0, 100) ?? 'Unknown error'}`); // Show error in loading area
      if (typeof showAlert === 'function') showAlert(`PNG export failed (${method}): ${err.message}`, 'error'); // Show global alert
  } finally {
      // Only re-enable button if export failed AND the button still exists
      if (!exportSuccess && exportBtn) {
          exportBtn.disabled = false;
          exportBtn.textContent = 'Export PNG';
      } else if (exportSuccess) {
          // Modal already closed, no need to touch button
      } else {
          // Export failed, but button wasn't found (edge case)
          console.warn("[PNGRenderer] Finally block: Export failed, but export button not found.");
      }
      // Don't hide loading indicator here if export failed, as it shows the error message.
      // It will be hidden next time the modal opens or if closed manually.
  }
}


// --- Initialization and Public API ---

/** Initializes the PNG Renderer UI. */
async function initializeUI() {
  if (isInitialized) return true; // Already done

  // Dependency checks
  const html2CanvasAvailable = typeof captureLogoWithHTML2Canvas !== 'undefined';
  const svgPipelineAvailable = typeof generateSVGBlob !== 'undefined' && typeof convertSVGtoPNG !== 'undefined';

  if (!html2CanvasAvailable && !svgPipelineAvailable) {
       console.error("[PNGRenderer Init] Critical dependency missing: Need functions for Snapshot OR SVG export pipeline.");
       if(typeof showAlert === 'function') showAlert('PNG Exporter cannot initialize: Core rendering functions missing.', 'error');
       return false;
  }
   if (typeof SettingsManager === 'undefined') {
       console.error("[PNGRenderer Init] Critical dependency missing: SettingsManager not found/imported.");
        if(typeof showAlert === 'function') showAlert('PNG Exporter cannot initialize: SettingsManager missing.', 'error');
       return false;
   }


  console.log("[PNGRenderer] Initializing UI...");
  try {
      injectStyles();
      injectModalHTML();
      // Wait for the next frame to ensure DOM is ready for querying
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (!queryModalElements()) {
          throw new Error('Failed to find required modal elements after injection.');
      }
      isInitialized = true;
      console.log("[PNGRenderer] UI Initialized successfully.");
      return true;
  } catch (err) {
      console.error('[PNGRenderer] UI Initialization failed:', err);
      isInitialized = false; // Ensure state reflects failure
      if (typeof showAlert === 'function') showAlert(`Failed to initialize PNG Exporter UI: ${err.message}`, 'error');
      // Attempt cleanup if init failed
      const existingModal = document.getElementById(MODAL_ID);
      if (existingModal) {
          console.warn("[PNGRenderer] Removing partially initialized modal due to error.");
          existingModal.remove();
      }
      return false;
  }
}

/** Public function to trigger the PNG export modal. */
export async function exportPNGWithUI() {
  console.log("[PNGRenderer] exportPNGWithUI called...");
  try {
      // Ensure UI is initialized (or initialize it)
      const success = await initializeUI();
      if (!success) {
          console.error("[PNGRenderer] Cannot open modal: UI initialization failed or is not complete.");
          // showAlert might have already been called by initializeUI
          return;
      }

      // Double-check SettingsManager init status *before* opening modal relies on it
      // Assuming SettingsManager has a property like _isInitialized or similar
      // Adjust this check based on how SettingsManager indicates its readiness
      if (typeof SettingsManager._isInitialized !== 'undefined' && !SettingsManager._isInitialized) {
           console.error("[PNGRenderer] Cannot open modal: SettingsManager reports it is not initialized.");
           if(typeof showAlert === 'function') showAlert('Cannot export PNG: Settings Manager not ready. Please wait or reload.', 'error');
           return;
       }
       // Added check: Also verify essential modal elements are still present before opening
        if (!modalElement || !exportBtn || !previewImage || !loadingIndicator) {
             console.error("[PNGRenderer] Cannot open modal: Essential UI elements are missing (unexpected state).");
            if (typeof showAlert === 'function') showAlert('Cannot export PNG: UI Error. Please reload.', 'error');
             return;
         }


      openModal(); // Open if UI and SettingsManager seem ready
  } catch (err) {
      console.error('[PNGRenderer] Error trying to open PNG exporter:', err);
      if (typeof showAlert === 'function') showAlert(`Error opening PNG Exporter: ${err.message}`, 'error');
      // Reset UI state in case of unexpected error during open attempt
      if (exportBtn) { exportBtn.disabled = false; exportBtn.textContent = 'Export PNG'; }
      showLoading(false);
  }
}

// REMOVED Unused isTextGradientActive placeholder function

// Initial log message
console.log("[PNGRenderer v2.6.1 - Corrected Event Listeners] Loaded.");