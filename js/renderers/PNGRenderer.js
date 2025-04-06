/**
 * PNGRenderer.js
 * ====================================================
 * Provides PNG export functionality. Prioritizes direct canvas snapshotting
 * (requires html2canvas.js) for WYSIWYG results, with SVG-based rendering
 * as a user-selectable alternative/fallback.

 */

// Import core functions from RendererCore
// Ensure RendererCore v2.8+ is used (with global normalizeColor)
import { generateConsistentPreview, generateSVGBlob, convertSVGtoPNG, blobToDataURL } from './RendererCore.js';
import { captureLogoWithHTML2Canvas } from '../utils/html2Canvas.js';


// so it can be accessed by both attachModalEventListeners (to set it up) and detachModalEventListeners (to remove it later).
let handleSettingsUpdateListener = null; 

// --- Module Scope Variables ---
let isInitialized = false;
const MODAL_ID = 'pngExportModal';
const STYLE_ID = 'pngExporterStyles';

// --- DOM Element References ---
let modal = null, closeBtn = null, cancelBtn = null, exportBtn = null;
let previewImage = null, loadingIndicator = null;
let widthInput = null, heightInput = null, qualityInput = null, qualityDisplay = null, transparentCheckbox = null;
let snapshotRadio = null, svgRenderRadio = null; // Export method radio buttons

// --- CSS ---
const MODAL_CSS = `
/* Styles for PNG exporter modal (v2.3 - Preview Size Fix) */

/* --- Base Modal Styles --- */
.png-exporter-modal .modal-content {
    max-width: 900px; /* Consider adjusting based on content */
}

/* --- Preview Area & Image (FIXED SIZING) --- */
.png-exporter-modal .exporter-preview-area {
    position: relative; /* Needed for absolute positioning of image and loading */
    width: 100%; /* Take full available width */
    max-width: 100%; /* Ensure it doesn't overflow */
    margin-bottom: var(--space-md); /* Space below preview */

    /* --- Aspect Ratio Control (Padding-Top Trick for 16:9) --- */
    height: 0;
    /* Calculate padding-top: (desired height / desired width) * 100% */
    padding-top: 56.25%; /* (9 / 16) * 100% = 16:9 aspect ratio */
    /* Adjust this percentage for other default ratios (e.g., 75% for 4:3, 100% for 1:1) */

    background-color: rgba(0,0,0,0.1); /* Subtle background */
    border-radius: var(--border-radius-sm);
    overflow: hidden; /* Important to contain the absolutely positioned image */
    border: 1px solid var(--border-color);
}

.png-exporter-modal .exporter-preview-image {
    /* --- Image Scaling & Positioning --- */
    display: block; /* Correct display type */
    position: absolute; /* Position relative to the preview-area */
    top: 0;
    left: 0;
    width: 100%; /* Fill the container width */
    height: 100%; /* Fill the container height */
    object-fit: contain; /* Scale image down, preserve aspect ratio, fit within element */
    border: none; /* Remove border from image itself */

    /* --- Checkerboard Background --- */
    background: repeating-conic-gradient(var(--border-subtle, #ccc) 0% 25%, var(--panel-bg-opaque, #fff) 0% 50%) 50% / 20px 20px;
    background-size: 20px 20px; /* Ensure size */
}

/* Adjust dark mode checkerboard */
body.dark-mode .png-exporter-modal .exporter-preview-image {
     background: repeating-conic-gradient(var(--border-color, #333) 0% 25%, var(--panel-bg, #222) 0% 50%) 50% / 20px 20px;
     background-size: 20px 20px;
}

/* --- Loading Indicator --- */
.png-exporter-modal .exporter-preview-loading {
    position: absolute; inset: 0; /* Cover the preview area */
    background: var(--modal-backdrop-bg, rgba(255, 255, 255, 0.8));
    display: flex; /* Use flex to center content */
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 5; /* Above the image */
    color: var(--text-color, #333);
    border-radius: inherit; /* Match container radius */
    text-align: center;
    /* Transitions can be added for smoother showing/hiding */
    opacity: 1;
    visibility: visible;
    transition: opacity 0.2s ease, visibility 0.2s ease;
}
/* Style for when loading is hidden */
.png-exporter-modal .exporter-preview-loading:not([style*="display: flex"]) {
    opacity: 0;
    visibility: hidden;
}


.png-exporter-modal .exporter-preview-loading .spinner {
    border: 4px solid rgba(var(--accent-color-rgb, 255, 20, 147), 0.2);
    border-left-color: var(--accent-color, #ff1493);
    border-radius: 50%; width: 30px; height: 30px;
    animation: png-spin 1s linear infinite; margin-bottom: 10px;
}
@keyframes png-spin { to { transform: rotate(360deg); } }

/* --- Export Method Selection --- */
.png-export-method-selector {
    margin-top: 15px; padding: 15px;
    background-color: var(--input-bg, rgba(0,0,0,0.05));
    border-radius: var(--border-radius-sm, 4px);
    border: 1px solid var(--border-color, #ccc);
}
.png-export-method-selector legend {
    font-weight: var(--font-weight-medium); padding: 0 5px; margin-bottom: 10px;
    font-size: 0.9em; color: var(--text-color-muted);
}
.png-export-method-selector .radio-option { display: flex; align-items: flex-start; margin-bottom: 8px; cursor: pointer; }
.png-export-method-selector input[type="radio"] { margin-right: 10px; margin-top: 3px; /* Align better with text */ accent-color: var(--accent-color); cursor: pointer; flex-shrink: 0; }
.png-export-method-selector label { font-size: 0.95em; color: var(--text-color); cursor: pointer; }
.png-export-method-selector label span { font-size: 0.85em; color: var(--text-color-muted); display: block; /* Indent description */ line-height: 1.3; }
.png-export-method-selector label code { background-color: var(--code-bg, #eee); padding: 1px 4px; border-radius: 3px; font-size: 0.9em; color: var(--text-color, #333); }
body.dark-mode .png-export-method-selector label code { background-color: #11131c; color: #ddd; }
`


// ----- Modal HTML -----
const MODAL_HTML = `
<div id="${MODAL_ID}" class="modal-overlay png-exporter-modal" style="display:none;">
  <div class="modal-content">
    <div class="modal-header">
      <h3>Export as PNG</h3>
      <button id="${MODAL_ID}CloseBtn" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="exporter-preview-area" style="position: relative;">
        <div id="${MODAL_ID}Loading" class="exporter-preview-loading">
          <div class="spinner"></div>
          <div class="progress-text">Generating preview...</div>
        </div>
        <img id="${MODAL_ID}PreviewImage" class="exporter-preview-image" src="" alt="PNG Preview">
      </div>

      <div class="exporter-controls-area">
        <!-- same controls: width, height, quality, transparency, snapshot vs svg radio, etc. -->
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
          <input type="range" id="${MODAL_ID}Quality" min="10" max="100" step="5" value="95">
          <span id="${MODAL_ID}QualityValue">95%</span>
        </div>
        <div class="control-group">
          <label><input type="checkbox" id="${MODAL_ID}Transparent"> Transparent?</label>
        </div>
        <fieldset>
          <legend>Export Method</legend>
          <label><input type="radio" name="pngExportMethod" id="pngExportMethodSnapshot" value="snapshot" checked> Snapshot (html2canvas)</label>
          <label><input type="radio" name="pngExportMethod" id="pngExportMethodSvgRender" value="svgRender"> SVG Render</label>
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

/* ------------------------------------------------------
   1) Injection and Element Query
------------------------------------------------------ */
function injectStyles() {
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = MODAL_CSS;
    document.head.appendChild(styleEl);
  }
}

function injectModalHTML() {
  if (document.getElementById(MODAL_ID)) return; // already in DOM
  const div = document.createElement('div');
  div.innerHTML = MODAL_HTML.trim();
  document.body.appendChild(div.firstChild);
}

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

  // Return true if all are found
  return !!(
    modal && closeBtn && cancelBtn && exportBtn &&
    previewImage && loadingIndicator &&
    widthInput && heightInput && qualityInput && qualityDisplay &&
    transparentCheckbox && snapshotRadio && svgRenderRadio
  );
}

/* ------------------------------------------------------
   2) Event Listeners
------------------------------------------------------ */
function attachModalEventListeners() {
  // We do this once. We do NOT remove them on close.
  if (!modal) return;
  if (modal.dataset.listeners === 'true') return; // already attached

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (evt) => {
    // click background to close
    if (evt.target === modal) closeModal();
  });

  exportBtn.addEventListener('click', handleExport);

  // Update preview if method or transparency changes
  snapshotRadio.addEventListener('change', updatePreview);
  svgRenderRadio.addEventListener('change', updatePreview);
  transparentCheckbox.addEventListener('change', updatePreview);

  // Quality slider -> label update
  qualityInput.addEventListener('input', () => {
    if (qualityDisplay) {
      qualityDisplay.textContent = `${qualityInput.value}%`;
    }
  });

  // Listen for global settings changes from your app
  handleSettingsUpdateListener = function() {
    syncExportSettings();
    updatePreview();
  };
  document.addEventListener('logomaker-settings-updated', handleSettingsUpdateListener);

  // Allow ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  modal.dataset.listeners = 'true';
}

// We no longer detach them in closeModal, so they remain valid across multiple opens.

function syncExportSettings() {
  // Pull from #exportWidth, #exportHeight, #exportQuality, #exportTransparent if present
  try {
    const mainW = document.getElementById('exportWidth')?.value || '800';
    const mainH = document.getElementById('exportHeight')?.value || '400';
    const mainQ = document.getElementById('exportQuality')?.value || '95';
    const mainT = document.getElementById('exportTransparent')?.checked || false;

    widthInput.value = mainW;
    heightInput.value = mainH;
    qualityInput.value = mainQ;
    qualityDisplay.textContent = mainQ + '%';
    transparentCheckbox.checked = mainT;
  } catch (err) {
    console.warn('[PNGRenderer] Could not sync from main UI. Using defaults.', err);
  }
}

/* ------------------------------------------------------
   3) Opening and Closing the Modal
------------------------------------------------------ */
function openModal() {
    if (!modal) {
         console.error('PNG modal not present in DOM'); // Log error instead of throwing if possible
         if(typeof showAlert === 'function') showAlert('Cannot open exporter: Modal not found.', 'error');
         return;
    }
    if (!isInitialized) {
         console.error('PNG modal opened before initialization.');
         if(typeof showAlert === 'function') showAlert('Cannot open exporter: Not initialized.', 'error');
         return;
    }

    syncExportSettings(); // Sync settings first

    // Clear previous state / ensure clean slate before showing
    loadingIndicator.style.display = 'none'; // Ensure loader is hidden initially
    previewImage.style.display = 'none'; // Ensure image is hidden initially
    previewImage.removeAttribute('src'); // Remove any old src

    modal.style.display = 'flex'; // Make modal visible

    // Use requestAnimationFrame to wait for the browser to render the modal
    requestAnimationFrame(() => {
         modal.classList.add('active'); // Add active class for transitions (if any)
         document.body.style.overflow = 'hidden'; // disable scroll behind modal

         // ---- CRITICAL CHANGE ----
         // Now that the modal is displayed, queue the preview update
         // Using another rAF or a tiny timeout ensures layout is stable
         requestAnimationFrame(() => {
             updatePreview(); // Generate the preview *after* modal is rendered
         });
         // Alternatively, a small timeout:
         // setTimeout(updatePreview, 10); // 10ms delay often sufficient

    });
    // **** REMOVED updatePreview() call from here ****
}

function closeModal() {
  if (!modal) return;

  // remove .active so it can fade out if you have CSS transitions
  modal.classList.remove('active');

  // after short delay, hide the modal
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }, 300); // match your CSS transition time, or 0 if none
}

/* ------------------------------------------------------
   4) Updating the Preview
------------------------------------------------------ */
async function updatePreview() {
  if (!isInitialized) return;
  if (!modal || modal.style.display === 'none') return; // no need if not visible

  const method = snapshotRadio.checked ? 'snapshot' : 'svgRender';
  const w = parseInt(widthInput.value || '800', 10);
  const h = parseInt(heightInput.value || '400', 10);
  const transparent = transparentCheckbox.checked;

  loadingIndicator.style.display = 'flex';
  previewImage.style.display = 'none';
  previewImage.removeAttribute('src');

  const progressEl = loadingIndicator.querySelector('.progress-text');
  if (progressEl) progressEl.textContent = `Generating preview (${method})...`;

  try {
    if (method === 'snapshot') {
      // EXACT WYSIWYG snapshot from #previewContainer
      if (typeof captureLogoWithHTML2Canvas !== 'function') {
        throw new Error('html2canvas/captureLogoWithHTML2Canvas not found');
      }
      const container = document.getElementById('previewContainer');
      if (!container) {
        throw new Error('No #previewContainer found in DOM');
      }
      const canvas = await captureLogoWithHTML2Canvas(container, {
        width: w,
        height: h,
        transparentBackground: transparent,
        scale: window.devicePixelRatio
      });
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('canvas.toBlob returned null')),
          'image/png'
        );
      });
      const dataUrl = await blobToDataURL(blob);
      previewImage.onload = () => {
        loadingIndicator.style.display = 'none';
        previewImage.style.display = 'block';
      };
      previewImage.onerror = () => {
        loadingIndicator.style.display = 'none';
        previewImage.style.display = 'block';
        previewImage.alt = 'Snapshot preview load failed';
      };
      previewImage.src = dataUrl;

    } else {
      // Use the built-in generateConsistentPreview to do SVG->PNG for preview
      await generateConsistentPreview(
        { width: w, height: h, transparentBackground: transparent },
        previewImage,
        loadingIndicator,
        'png'
      );
      // That function sets previewImage.src for us, hides spinner, etc.
    }
  } catch (err) {
    console.error('[PNGRenderer] updatePreview error:', err);
    if (loadingIndicator) {
      (loadingIndicator.querySelector('.progress-text') || loadingIndicator).textContent =
        `Preview Failed: ${err.message}`;
    }
  }
}

/* ------------------------------------------------------
   5) Final Export
------------------------------------------------------ */
async function handleExport() {
  if (!modal) return;
  exportBtn.disabled = true;
  loadingIndicator.style.display = 'flex';
  const progressEl = loadingIndicator.querySelector('.progress-text');
  if (progressEl) progressEl.textContent = 'Exporting...';

  const method = snapshotRadio.checked ? 'snapshot' : 'svgRender';
  const w = parseInt(widthInput.value || '800', 10);
  const h = parseInt(heightInput.value || '400', 10);
  const qualityVal = parseInt(qualityInput.value || '95', 10) / 100; // PNG compression hint
  const transparent = transparentCheckbox.checked;

  let finalBlob = null;
  try {
    if (method === 'snapshot') {
      const container = document.getElementById('previewContainer');
      if (!container) throw new Error('No #previewContainer for snapshot export.');

      // higher scale for better resolution
      const canvas = await captureLogoWithHTML2Canvas(container, {
        width: w,
        height: h,
        transparentBackground: transparent,
        scale: 2
      });
      finalBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Snapshot export toBlob failed')),
          'image/png',
          qualityVal
        );
      });

    } else {
      // 1) Build SVG
      const svgBlob = await generateSVGBlob({ width: w, height: h, transparentBackground: transparent });
      // 2) Convert to PNG
      finalBlob = await convertSVGtoPNG(svgBlob, {
        width: w,
        height: h,
        transparentBackground: transparent,
        quality: qualityVal
      });
    }

    if (finalBlob) {
      // Trigger a file download
      const baseName = window.Utils?.getLogoFilenameBase?.() || 'logo';
      const filename = `${baseName}.png`;

      if (typeof window.Utils?.downloadBlob === 'function') {
        window.Utils.downloadBlob(finalBlob, filename);
      } else {
        // basic fallback
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // optional: notify success
      if (typeof window.notifyExportSuccess === 'function') {
        window.notifyExportSuccess('PNG Export', filename);
      }
      closeModal();
    }
  } catch (err) {
    console.error('[PNGRenderer] handleExport error:', err);
    if (typeof showAlert === 'function') {
      showAlert(`PNG export failed (${method}): ${err.message}`, 'error');
    }
  } finally {
    exportBtn.disabled = false;
    loadingIndicator.style.display = 'none';
  }
}

/* ------------------------------------------------------
   6) Main Entry Point
------------------------------------------------------ */
function initializeUI() {
  if (isInitialized) return Promise.resolve(true);
  return new Promise((resolve, reject) => {
    try {
      injectStyles();
      injectModalHTML();
      if (!queryModalElements()) {
        throw new Error('PNG modal elements not found after injection');
      }
      attachModalEventListeners();
      isInitialized = true;
      resolve(true);
    } catch (err) {
      console.error('[PNGRenderer] initUI failed:', err);
      isInitialized = false;
      reject(err);
    }
  });
}

export async function exportPNGWithUI() {
  try {
    await initializeUI();
    openModal();
  } catch (err) {
    console.error('[PNGRenderer] Cannot open PNG exporter:', err);
    if (typeof showAlert === 'function') {
      showAlert(`Cannot open PNG Exporter: ${err.message}`, 'error');
    }
  }
}