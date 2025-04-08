/**
 * PNGRenderer.js
 * ====================================================
 * Provides PNG export functionality, allowing two main modes:
 * 1) **Snapshot (html2canvas)** – Captures the visual appearance of the preview container for a WYSIWYG result
 * 2) **SVG-based** – Uses an SVG export pipeline for consistent vector rendering, then converts to PNG
 *
 * - Export runs in a modal to show a preview image.
 * - Also features optional background transparency.
 * - Includes improved mobile handling: the preview area is responsive, and
 *   we clamp the dimensions if the device is very small.
 *
 * Dependencies:
 *   - RendererCore.js (for `generateConsistentPreview`, `generateSVGBlob`, `convertSVGtoPNG`, etc.)
 *   - html2canvas / captureLogoWithHTML2Canvas if snapshot mode is enabled
 *
 * For best results, ensure:
 *   - #previewContainer is in the DOM with .logo-container & .logo-text children.
 *   - The user’s width/height/quality, etc. are synced with the main UI (exportWidth, exportHeight, etc.).
 */

import {
  generateConsistentPreview,
  generateSVGBlob,
  convertSVGtoPNG,
  blobToDataURL
} from './RendererCore.js';

import { captureLogoWithHTML2Canvas } from '../utils/html2Canvas.js';

/* -----------------------------------------------------
   Module-Scope / Globals
------------------------------------------------------ */
let isInitialized = false;          // Have we injected HTML, styles, etc.?
let handleSettingsUpdateListener;   // For removing the global event listener later
const MODAL_ID = 'pngExportModal';  // Modal DOM wrapper ID
const STYLE_ID = 'pngExporterStyles';

/* -----------------------------------------------------
   DOM References (populated by queryModalElements)
------------------------------------------------------ */
let modal = null,
    closeBtn = null,
    cancelBtn = null,
    exportBtn = null,
    previewImage = null,
    loadingIndicator = null,
    widthInput = null,
    heightInput = null,
    qualityInput = null,
    qualityDisplay = null,
    transparentCheckbox = null,
    snapshotRadio = null,
    svgRenderRadio = null;

/* -----------------------------------------------------
   CSS for the PNG Exporter Modal
   - Includes better mobile responsiveness
   - Aspect ratio trick for preview container
   - Checkerboard background for transparency
------------------------------------------------------ */
const MODAL_CSS = `
/* PNG Exporter Modal (responsive) */

.png-exporter-modal {
  position: fixed;
  inset: 0;
  display: none; /* Shown by JS */
  justify-content: center;
  align-items: center;
  z-index: 1500;
  background: rgba(0, 0, 0, 0.6);
  overflow: auto; /* Allow scroll on smaller screens */
  padding: 2rem 1rem; /* Some padding for smaller devices */
}

.png-exporter-modal .modal-content {
  background: var(--panel-bg, #f5f5f5);
  color: var(--text-color, #333);
  max-width: 900px; /* Constrain modal size */
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 18px rgba(0,0,0,0.3);
  padding: 1.5rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.png-exporter-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.png-exporter-modal .modal-header h3 {
  font-size: 1.3rem;
  margin: 0;
}

.png-exporter-modal .modal-header button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-color, #333);
  cursor: pointer;
  margin-left: 0.5rem;
  line-height: 1;
}

.png-exporter-modal .modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Preview area container with aspect ratio trick */
.png-exporter-modal .exporter-preview-area {
  position: relative;
  width: 100%;
  /* 16:9 aspect ratio by default; can adjust below if needed */
  padding-top: 56.25%;
  background-color: rgba(0,0,0,0.1);
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  overflow: hidden;
}

/* Absolutely positioned image to fill .exporter-preview-area */
.png-exporter-modal .exporter-preview-image {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: contain;
  display: none;
  background: repeating-conic-gradient(var(--border-subtle, #ccc) 0% 25%, var(--panel-bg-opaque, #fff) 0% 50%) 50% / 20px 20px;
  background-size: 20px 20px; /* Checkerboard for transparency */
  border: 0;
}

body.dark-mode .png-exporter-modal .exporter-preview-image {
  background: repeating-conic-gradient(var(--border-color, #333) 0% 25%, var(--panel-bg, #222) 0% 50%) 50% / 20px 20px;
}

/* Loading overlay within the preview area */
.png-exporter-modal .exporter-preview-loading {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 2;
  color: var(--text-color, #333);
  border-radius: inherit;
  text-align: center;
  transition: opacity 0.2s ease;
}

body.dark-mode .png-exporter-modal .exporter-preview-loading {
  background: rgba(20, 20, 20, 0.7);
  color: #ccc;
}

.png-exporter-modal .exporter-preview-loading .spinner {
  border: 4px solid rgba(var(--accent-color-rgb, 255, 20, 147), 0.2);
  border-left-color: var(--accent-color, #ff1493);
  border-radius: 50%;
  width: 32px; height: 32px;
  animation: png-spin 1s linear infinite;
  margin-bottom: 0.5rem;
}

@keyframes png-spin {
  to { transform: rotate(360deg); }
}

/* Controls area */
.png-exporter-modal .exporter-controls-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.png-exporter-modal .exporter-controls-area .control-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.png-exporter-modal .exporter-controls-area label {
  font-weight: 500;
  font-size: 0.9rem;
}

.png-exporter-modal .exporter-controls-area input[type="number"],
.png-exporter-modal .exporter-controls-area input[type="range"] {
  width: 100%;
  padding: 0.3rem 0.5rem;
  font-size: 0.9rem;
}

.png-exporter-modal .exporter-controls-area input[readonly] {
  background-color: var(--bg-base, #eee);
  opacity: 0.6;
  cursor: not-allowed;
}

.png-exporter-modal .exporter-controls-area .range-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.png-exporter-modal .exporter-controls-area .range-container span {
  font-size: 0.85rem;
  color: var(--text-color-muted, #666);
  min-width: 40px;
  text-align: right;
}

.png-exporter-modal .checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.png-exporter-modal .checkbox-label input[type="checkbox"] {
  width: 18px; height: 18px;
  margin-right: 0.4rem;
}

.png-exporter-modal fieldset {
  border: 1px solid var(--border-color, #ccc);
  border-radius: 5px;
  padding: 0.8rem;
}

.png-exporter-modal fieldset legend {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-color-muted, #555);
}

.png-exporter-modal fieldset label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
  cursor: pointer;
}

/* Snapshot vs. SVG radio layout */
.png-exporter-modal fieldset label input[type="radio"] {
  margin-right: 0.5rem;
}

.png-exporter-modal .snapshot-warning {
  font-size: 0.8rem;
  color: #c75;
  margin-top: 0.3rem;
  display: none;
}

/* Footer actions */
.png-exporter-modal .modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
}

.png-exporter-modal .modal-footer button {
  border: none;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.png-exporter-modal .modal-footer .cancel-btn {
  background-color: #bbb;
}

.png-exporter-modal .modal-footer .cancel-btn:hover {
  background-color: #aaa;
}

.png-exporter-modal .modal-footer .export-btn {
  background-color: var(--accent-color, #ff1493);
  color: #fff;
}

.png-exporter-modal .modal-footer .export-btn:hover {
  background-color: #ff46a7;
}

/* Mobile adjustments */
@media (max-width: 480px) {
  .png-exporter-modal .modal-content {
    padding: 1rem;
    border-radius: 5px;
  }

  .png-exporter-modal .exporter-preview-area {
    /* For extremely narrow devices, reduce ratio or let it adapt */
    padding-top: 60%; /* Slightly taller ratio on narrow screens */
  }

  .png-exporter-modal .modal-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
`;

/* -----------------------------------------------------
   HTML template for the PNG Exporter Modal
------------------------------------------------------ */
const MODAL_HTML = `
<div id="${MODAL_ID}" class="png-exporter-modal" role="dialog" aria-modal="true">
  <div class="modal-content">
    <div class="modal-header">
      <h3>Export as PNG</h3>
      <button id="${MODAL_ID}CloseBtn" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <!-- Preview Area (16:9 aspect ratio box) -->
      <div class="exporter-preview-area">
        <div id="${MODAL_ID}Loading" class="exporter-preview-loading" style="display: none;">
          <div class="spinner"></div>
          <div class="progress-text">Generating preview...</div>
        </div>
        <img id="${MODAL_ID}PreviewImage" class="exporter-preview-image" src="" alt="PNG Preview" />
      </div>

      <!-- Controls -->
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
          <label class="checkbox-label">
            <input type="checkbox" id="${MODAL_ID}Transparent">
            <span>Transparent?</span>
          </label>
        </div>

        <fieldset>
          <legend>Export Method</legend>
          <label>
            <input type="radio" name="pngExportMethod" id="pngExportMethodSnapshot" value="snapshot" checked>
            Snapshot (html2canvas)
          </label>
          <label>
            <input type="radio" name="pngExportMethod" id="pngExportMethodSvgRender" value="svgRender">
            SVG Render
          </label>
          <!-- Warning block shown if snapshot is selected and user must be aware of performance -->
          <div id="snapshotMethodWarning" class="snapshot-warning">
            Note: Snapshot can be slower but captures the exact on-screen appearance (CSS effects, filters, etc.).
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

function injectStyles() {
  if (!document.getElementById(STYLE_ID)) {
      const styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = MODAL_CSS;
      document.head.appendChild(styleEl);
  }
}

function injectModalHTML() {
  if (document.getElementById(MODAL_ID)) return;
  const container = document.createElement('div');
  container.innerHTML = MODAL_HTML.trim();
  document.body.appendChild(container.firstChild);
}

/**
* Queries essential modal elements and returns true if ALL are found.
* @returns {boolean} True if all elements were found, false otherwise.
*/
function queryModalElements() {
  modal = document.getElementById(MODAL_ID);
  closeBtn = document.getElementById(`${MODAL_ID}CloseBtn`);
  cancelBtn = document.getElementById(`${MODAL_ID}CancelBtn`);
  exportBtn = document.getElementById(`${MODAL_ID}ExportBtn`);
  previewImage = document.getElementById(`${MODAL_ID}PreviewImage`);
  loadingIndicator = document.getElementById(`${MODAL_ID}Loading`);
  widthInput = document.getElementById(`${MODAL_ID}Width`);
  heightInput = document.getElementById(`${MODAL_ID}Height`);
  qualityInput = document.getElementById(`${MODAL_ID}Quality`);
  qualityDisplay = document.getElementById(`${MODAL_ID}QualityValue`);
  transparentCheckbox = document.getElementById(`${MODAL_ID}Transparent`);
  snapshotRadio = document.getElementById('pngExportMethodSnapshot');
  svgRenderRadio = document.getElementById('pngExportMethodSvgRender');
  snapshotWarningEl = document.getElementById('snapshotMethodWarning'); // Query warning div

  // Check if all crucial elements were found
  const allFound = !!(modal && closeBtn && cancelBtn && exportBtn &&
      previewImage && loadingIndicator &&
      widthInput && heightInput &&
      qualityInput && qualityDisplay &&
      transparentCheckbox && snapshotRadio && svgRenderRadio && snapshotWarningEl); // Added warningEl check

  if (!allFound) {
      console.error("[PNGRenderer] Failed to query one or more essential modal elements!");
  }
  return allFound;
}

/**
* Attaches event listeners to the modal. Uses dataset flag to prevent double binding.
*/
function attachModalEventListeners() {
  if (!modal || modal.dataset.listeners === 'true') return; // Ensure modal exists and not already bound

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (evt) => { if (evt.target === modal) closeModal(); });
  exportBtn.addEventListener('click', handleExport);
  snapshotRadio.addEventListener('change', updatePreview);
  svgRenderRadio.addEventListener('change', updatePreview);
  transparentCheckbox.addEventListener('change', updatePreview);

  qualityInput.addEventListener('input', () => {
      qualityDisplay.textContent = `${qualityInput.value}%`;
      // Debounce preview update on slider input if desired
      // clearTimeout(previewUpdateDebounce);
      // previewUpdateDebounce = setTimeout(updatePreview, 300);
  });
  qualityInput.addEventListener('change', updatePreview); // Update on final change

  // Global settings listener
  handleSettingsUpdateListener = () => {
      // Only update if modal is currently visible
      if (modal && modal.style.display === 'flex') {
          syncExportSettings();
          updatePreview(); // Refresh preview on settings change
      }
  };
  document.addEventListener('logomaker-settings-updated', handleSettingsUpdateListener);

  document.addEventListener('keydown', handleEscKey);

  modal.dataset.listeners = 'true';
  console.log("[PNGRenderer] Modal event listeners attached.");
}

/** Handles Escape key press for closing modal */
function handleEscKey(e) {
   if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
      closeModal();
  }
}

/** Detaches event listeners - useful for cleanup if needed */
function detachModalEventListeners() {
  if (!modal || modal.dataset.listeners !== 'true') return;

  closeBtn.removeEventListener('click', closeModal);
  cancelBtn.removeEventListener('click', closeModal);
  // Need to store the exact listener function for removal
  // modal.removeEventListener('click', specificModalClickListener);
  exportBtn.removeEventListener('click', handleExport);
  snapshotRadio.removeEventListener('change', updatePreview);
  svgRenderRadio.removeEventListener('change', updatePreview);
  transparentCheckbox.removeEventListener('change', updatePreview);
  qualityInput.removeEventListener('input', () => {}); // Placeholder - needs stored listener
  qualityInput.removeEventListener('change', updatePreview);

  if (handleSettingsUpdateListener) {
      document.removeEventListener('logomaker-settings-updated', handleSettingsUpdateListener);
      handleSettingsUpdateListener = null;
  }
  document.removeEventListener('keydown', handleEscKey);

  modal.removeAttribute('data-listeners');
   console.log("[PNGRenderer] Modal event listeners detached.");
}

/** Syncs modal inputs with main UI export settings */
function syncExportSettings() {
  // ... (Keep existing syncExportSettings logic - seems okay) ...
   try {
      const mainW = document.getElementById('exportWidth')?.value || '800';
      const mainH = document.getElementById('exportHeight')?.value || '400';
      const mainQ = document.getElementById('exportQuality')?.value || '95';
      const mainT = document.getElementById('exportTransparent')?.checked || false;

      if (widthInput) widthInput.value = mainW;
      if (heightInput) heightInput.value = mainH;
      if (qualityInput) qualityInput.value = mainQ;
      if (qualityDisplay) qualityDisplay.textContent = `${mainQ}%`;
      if (transparentCheckbox) transparentCheckbox.checked = mainT;
  } catch (err) {
      console.warn('[PNGRenderer] Could not sync from main UI', err);
  }
}

/** Updates the preview image in the modal */
async function updatePreview() {
  // Add checks at the start
  if (!isInitialized || !modal || modal.style.display !== 'flex') {
       console.log("[PNGRenderer updatePreview] Aborting: Not initialized or modal not visible.");
       return;
  }
  if (!loadingIndicator || !previewImage || !snapshotRadio || !svgRenderRadio || !transparentCheckbox || !widthInput || !heightInput) {
      console.error("[PNGRenderer updatePreview] Aborting: Required modal elements are missing.");
      return;
  }

  const method = snapshotRadio.checked ? 'snapshot' : 'svgRender';
  const w = parseInt(widthInput.value, 10) || 800;
  const h = parseInt(heightInput.value, 10) || 400;
  const transparent = transparentCheckbox.checked;

  loadingIndicator.style.display = 'flex';
  previewImage.style.display = 'none';
  previewImage.src = ''; // Clear previous src

  const progressTextEl = loadingIndicator.querySelector('.progress-text');
  if (progressTextEl) progressTextEl.textContent = `Generating preview (${method})...`;

  if (snapshotWarningEl) {
      snapshotWarningEl.style.display = snapshotRadio.checked ? 'block' : 'none';
  }

  try {
      let dataUrl = null;
      if (method === 'snapshot') {
          if (typeof captureLogoWithHTML2Canvas !== 'function') {
              throw new Error('Snapshot mode unavailable: html2canvas helper function missing.');
          }
          const container = document.getElementById('previewContainer');
          if (!container) throw new Error('Source #previewContainer not found for snapshot.');

          const canvas = await captureLogoWithHTML2Canvas(container, { width: w, height: h, transparentBackground: transparent, scale: 1 }); // Use scale 1 for preview speed
          const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Snapshot preview: canvas.toBlob failed')), 'image/png'));
          dataUrl = await blobToDataURL(blob);
      } else { // svgRender path
          const result = await generateConsistentPreview({ width: w, height: h, transparentBackground: transparent }, previewImage, loadingIndicator, 'png');
          dataUrl = result.dataUrl; // This function handles setting the src and loading state
           if (!dataUrl) throw new Error("SVG Render preview failed to generate Data URL.");
      }

      // Only set src directly if snapshot method OR if generateConsistentPreview failed to set it
       if ((method === 'snapshot' || !previewImage.src) && dataUrl) {
           previewImage.onload = () => {
               loadingIndicator.style.display = 'none';
               previewImage.style.display = 'block';
               previewImage.alt = `PNG Preview (${method})`;
           };
           previewImage.onerror = () => {
               loadingIndicator.style.display = 'none';
               previewImage.style.display = 'none'; // Hide broken image
               if (progressTextEl) progressTextEl.textContent = 'Preview Failed (Image Load Error)';
               previewImage.alt = 'Preview Failed';
           };
           previewImage.src = dataUrl;
       } else if (method !== 'snapshot') {
           // generateConsistentPreview handled it, ensure loading is hidden IF image displayed
           if (previewImage.style.display === 'block') {
               loadingIndicator.style.display = 'none';
           }
       }

  } catch (err) {
      console.error('[PNGRenderer] Error in updatePreview:', err);
      loadingIndicator.style.display = 'flex'; // Keep loading shown on error
       if (progressTextEl) progressTextEl.textContent = `Preview Failed: ${err.message}`;
      previewImage.style.display = 'none';
      previewImage.alt = 'Preview Failed';
  }
}

/** Handles the actual export process */
async function handleExport() {
  if (!modal || !exportBtn || !loadingIndicator) return; // Ensure elements exist

  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  loadingIndicator.style.display = 'flex';
  const progressEl = loadingIndicator.querySelector('.progress-text');
  if (progressEl) progressEl.textContent = 'Generating final PNG...';

  // Gather options
  const method = snapshotRadio.checked ? 'snapshot' : 'svgRender';
  const w = parseInt(widthInput.value, 10) || 800;
  const h = parseInt(heightInput.value, 10) || 400;
  const qualityVal = parseInt(qualityInput.value, 10) / 100 || 0.95;
  const transparent = transparentCheckbox.checked;

  let finalBlob = null;
  try {
      if (method === 'snapshot') {
          if (typeof captureLogoWithHTML2Canvas !== 'function') throw new Error('Snapshot mode unavailable: html2canvas missing.');
          const container = document.getElementById('previewContainer');
          if (!container) throw new Error('Source #previewContainer not found for snapshot export.');
          const canvas = await captureLogoWithHTML2Canvas(container, { width: w, height: h, transparentBackground: transparent, scale: 2 }); // Higher scale for export
          finalBlob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('Snapshot export: canvas.toBlob failed')), 'image/png', qualityVal));
      } else { // svgRender
          const svgBlob = await generateSVGBlob({ width: w, height: h, transparentBackground: transparent });
          finalBlob = await convertSVGtoPNG(svgBlob, { width: w, height: h, transparentBackground: transparent, quality: qualityVal });
      }

      if (finalBlob) {
          const baseName = window.Utils?.getLogoFilenameBase?.() || 'logo';
          const filename = `${baseName}_${w}x${h}.png`;

          if (typeof window.Utils?.downloadBlob === 'function') {
              window.Utils.downloadBlob(finalBlob, filename);
          } else { // Fallback download
              const url = URL.createObjectURL(finalBlob);
              const link = document.createElement('a'); link.href = url; link.download = filename;
              document.body.appendChild(link); link.click(); document.body.removeChild(link);
              setTimeout(()=>URL.revokeObjectURL(url),100);
          }

          if (typeof showToast === 'function') showToast({ message: `PNG exported: ${filename}`, type: 'success' });
          closeModal(); // Close modal on success
      } else {
           throw new Error("Generated PNG blob was null.");
      }
  } catch (err) {
      console.error('[PNGRenderer] handleExport error:', err);
      if (typeof showAlert === 'function') showAlert(`PNG export failed (${method}): ${err.message}`, 'error');
      if (progressEl) progressEl.textContent = 'Export Failed!'; // Update loading text
      // Keep modal open on error for user feedback
  } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export PNG';
       // Hide loading indicator only if export didn't fail immediately
       if(finalBlob) loadingIndicator.style.display = 'none';
  }
}

/**
* Initialize the PNG Renderer UI (injects HTML/CSS, queries elements, attaches listeners)
* @returns {Promise<boolean>} True if successful, false otherwise.
*/
async function initializeUI() {
  if (isInitialized) return true;
  console.log("[PNGRenderer] Initializing UI...");

  try {
      injectStyles();
      injectModalHTML();
      if (!queryModalElements()) { // ** Check if query succeeded **
          throw new Error('Failed to find required modal elements after injection.');
      }
      attachModalEventListeners(); // Attach events only if elements found
      isInitialized = true;
      console.log("[PNGRenderer] UI Initialized successfully.");
      return true;
  } catch (err) {
      console.error('[PNGRenderer] initUI failed:', err);
      isInitialized = false; // Ensure flag is false on failure
      return false;
  }
}

/** Public function to trigger the PNG export modal */
export async function exportPNGWithUI() {
  console.log("[PNGRenderer] exportPNGWithUI called...");
  try {
      const success = await initializeUI(); // Ensure UI is ready
      if (!success) {
           throw new Error("PNG Exporter UI could not be initialized.");
      }
      openModal(); // Now open the modal
  } catch (err) {
      console.error('[PNGRenderer] Cannot open PNG exporter:', err);
      if (typeof showAlert === 'function') showAlert(`Cannot open PNG Exporter: ${err.message}`, 'error');
  }
}

console.log("[PNGRenderer v2.2] Loaded successfully.");