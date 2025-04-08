/**
 * SVGRenderer.js (Revamped v2.x)
 * =========================================
 * Provides a UI modal for exporting the #previewContainer
 * as an SVG, capturing the same bounding box, fonts, colors, etc.
 *
 * Relies on:
 *  - generateConsistentPreview(...) & generateSVGBlob(...) from RendererCore.js
 *  - captureAdvancedStyles() from captureTextStyles.js
 *  - extractSVGAnimationDetails() from svgAnimationInfo.js
 *
 * Also listens for "logomaker-settings-updated" to keep
 * width/height/transparent in sync while the modal is open.
 */

import { generateConsistentPreview, generateSVGBlob } from './RendererCore.js';
import { captureAdvancedStyles } from '../captureTextStyles.js';
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js';

/* -----------------------------------------------------
   Module-Scope / Globals
------------------------------------------------------ */
let isInitialized = false;
let handleSettingsUpdated = null; // We'll store the event listener reference

// IDs & references
const MODAL_ID = 'svgExportModal';
const STYLE_ID = 'svgExporterStyles'; // We'll inject a <style> with this ID

let modalElem = null,
    closeBtn = null,
    cancelBtn = null,
    exportBtn = null,
    previewImg = null,
    loadingDiv = null,
    widthInput = null,
    heightInput = null,
    transpCheck = null,
    metaInfoDiv = null;

// Minimal or advanced CSS as needed:
const MODAL_CSS = `
/* ============================
   SVG Exporter Modal Styles
   ============================ */
.svg-exporter-modal {
  position: fixed;
  inset: 0;
  display: none; /* shown by JS */
  justify-content: center;
  align-items: center;
  z-index: 1500;
  background: rgba(0,0,0,0.4);
  overflow: auto;
  padding: 2rem 1rem;
}
.svg-exporter-modal .modal-content {
  background: var(--panel-bg, #fff);
  color: var(--text-color, #333);
  max-width: 800px;
  width: 100%;
  border-radius: 6px;
  box-shadow: 0 4px 18px rgba(0,0,0,0.3);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}
.svg-exporter-modal .modal-header {
  display: flex; justify-content: space-between; align-items: center;
}
.svg-exporter-modal .modal-header .modal-title {
  margin: 0; font-size: 1.3rem;
}
.svg-exporter-modal .modal-header button {
  background: none; border: none;
  font-size: 1.5rem; cursor: pointer;
}
.svg-exporter-modal .modal-body {
  display: flex; flex-direction: column; gap: 1rem;
}
.svg-exporter-modal .exporter-preview-area {
  position: relative;
  width: 100%; /* fill container width */
  background-color: rgba(0,0,0,0.05);
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
  overflow: hidden;
  min-height: 160px;
}
.svg-exporter-modal .exporter-preview-image {
  display: none; /* shown once loaded */
  width: 100%; height: auto;
  object-fit: contain;
  background: repeating-conic-gradient(var(--border-subtle, #ccc) 0% 25%, var(--panel-bg, #fff) 0% 50%) 50% / 20px 20px;
  border: 0;
}
body.dark-mode .svg-exporter-modal .exporter-preview-image {
  background: repeating-conic-gradient(var(--border-color, #333) 0% 25%, var(--panel-bg, #222) 0% 50%) 50% / 20px 20px;
}
.svg-exporter-modal .exporter-preview-loading {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.8);
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  z-index: 5;
  text-align: center;
  border-radius: inherit;
}
body.dark-mode .svg-exporter-modal .exporter-preview-loading {
  background: rgba(20,20,20,0.7);
  color: #ccc;
}
.svg-exporter-modal .exporter-preview-loading .spinner {
  border: 4px solid rgba(var(--accent-color-rgb, 255,20,147),0.2);
  border-left-color: var(--accent-color, #ff1493);
  border-radius: 50%;
  width: 32px; height: 32px;
  animation: spin 1s linear infinite;
  margin-bottom: 0.5rem;
}
@keyframes spin { to { transform: rotate(360deg); } }
.svg-exporter-modal .svg-metadata-info {
  margin-top: 1rem;
  background: var(--input-bg, #f0f0f0);
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
  font-size: 0.85rem;
  max-height: 120px;
  overflow-y: auto;
  padding: 10px;
  color: var(--text-color-muted, #666);
}
body.dark-mode .svg-exporter-modal .svg-metadata-info {
  background: rgba(255,255,255,0.05); color: #ccc; border-color: #444;
}
.svg-exporter-modal .svg-metadata-info h4 {
  margin: 0 0 8px; font-size: 1rem; color: var(--text-color-strong, #333); border-bottom: 1px solid #ccc; padding-bottom: 4px;
}
body.dark-mode .svg-exporter-modal .svg-metadata-info h4 {
  color: #eee; border-bottom-color: #555;
}
.svg-exporter-modal .svg-metadata-info ul {
  margin: 0; padding: 0; list-style: none;
}
.svg-exporter-modal .svg-metadata-info li {
  margin-bottom: 4px; word-break: break-word;
}
.svg-exporter-modal .svg-metadata-info code {
  background: var(--code-bg, #eee);
  padding: 1px 4px; border-radius: 3px;
}
body.dark-mode .svg-exporter-modal .svg-metadata-info code {
  background: #11131c; color: #ddd;
}
.svg-exporter-modal .exporter-controls-area {
  display: flex; flex-direction: column; gap: 0.8rem;
}
.svg-exporter-modal .control-group { display: flex; flex-direction: column; }
.svg-exporter-modal .control-group label { font-weight: 500; }
.svg-exporter-modal .control-group input[type="number"] {
  width: 100px; padding: 0.3rem;
}
.svg-exporter-modal .checkbox-label {
  display: flex; align-items: center; gap: 0.4rem; cursor: pointer;
}
.svg-exporter-modal .modal-footer {
  display: flex; justify-content: flex-end; gap: 1rem;
}
.svg-exporter-modal .modal-footer button {
  padding: 0.5rem 1rem; cursor: pointer; border: none; border-radius: 4px;
}
.svg-exporter-modal .modal-footer .modal-btn-cancel {
  background: #ccc;
}
.svg-exporter-modal .modal-footer .modal-btn-primary {
  background: var(--accent-color, #ff1493); color: #fff;
}
.svg-exporter-modal.active { /* If you want a fade-in transition, define it here */ }
`;

/* -----------------------------------------------------
   Modal HTML Template
------------------------------------------------------ */
const MODAL_HTML = `
<div id="${MODAL_ID}" class="svg-exporter-modal" role="dialog" aria-modal="true">
  <div class="modal-content">
    <div class="modal-header">
      <h3 class="modal-title">Export as SVG</h3>
      <button id="${MODAL_ID}CloseBtn" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="exporter-preview-area">
        <div id="${MODAL_ID}Loading" class="exporter-preview-loading" style="display:none;">
          <div class="spinner"></div>
          <div class="progress-text">Generating preview...</div>
        </div>
        <img id="${MODAL_ID}PreviewImage" class="exporter-preview-image" src="#" alt="SVG Preview" />
        <div id="${MODAL_ID}MetadataInfo" class="svg-metadata-info">
          <h4>SVG Export Details</h4>
          <ul><li>Loading...</li></ul>
        </div>
      </div>
      <div class="exporter-controls-area">
        <div class="control-group">
          <label for="${MODAL_ID}Width">Width (px)</label>
          <input type="number" id="${MODAL_ID}Width" value="800" readonly />
        </div>
        <div class="control-group">
          <label for="${MODAL_ID}Height">Height (px)</label>
          <input type="number" id="${MODAL_ID}Height" value="400" readonly />
        </div>
        <label class="checkbox-label">
          <input type="checkbox" id="${MODAL_ID}Transparent" />
          <span>Transparent Background</span>
        </label>
        <p class="svg-exporter-info-text" style="font-size:0.85rem; color:var(--text-color-muted,#666); line-height:1.4;">
          <strong>Note:</strong> SVG can perfectly scale and embed text/styles. 
          However, complex CSS filters or animations may not translate directly into raw SVG elements.
        </p>
      </div>
    </div>
    <div class="modal-footer">
      <button id="${MODAL_ID}CancelBtn" class="modal-btn modal-btn-cancel">Cancel</button>
      <button id="${MODAL_ID}ExportBtn" class="modal-btn modal-btn-primary">Export SVG</button>
    </div>
  </div>
</div>
`;

/* -----------------------------------------------------
   UI Setup Functions
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
  const container = document.createElement('div');
  container.innerHTML = MODAL_HTML.trim();
  document.body.appendChild(container.firstChild);
}

function queryModalElements() {
  modalElem   = document.getElementById(MODAL_ID);
  closeBtn    = document.getElementById(`${MODAL_ID}CloseBtn`);
  cancelBtn   = document.getElementById(`${MODAL_ID}CancelBtn`);
  exportBtn   = document.getElementById(`${MODAL_ID}ExportBtn`);
  previewImg  = document.getElementById(`${MODAL_ID}PreviewImage`);
  loadingDiv  = document.getElementById(`${MODAL_ID}Loading`);
  widthInput  = document.getElementById(`${MODAL_ID}Width`);
  heightInput = document.getElementById(`${MODAL_ID}Height`);
  transpCheck = document.getElementById(`${MODAL_ID}Transparent`);
  metaInfoDiv = document.getElementById(`${MODAL_ID}MetadataInfo`);

  const allFound = !!(
    modalElem && closeBtn && cancelBtn && exportBtn &&
    previewImg && loadingDiv &&
    widthInput && heightInput && transpCheck && metaInfoDiv
  );
  return allFound;
}

function attachModalEventListeners() {
  if (!modalElem || modalElem.dataset.listeners === 'true') return;

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modalElem.addEventListener('click', (evt) => { if (evt.target === modalElem) closeModal(); });
  exportBtn.addEventListener('click', doExport);
  transpCheck.addEventListener('change', updatePreview);

  // If main settings change while modal is open, re-sync & re-preview
  handleSettingsUpdated = () => {
    if (modalElem.style.display === 'flex') {
      syncExportSettings();
      updatePreview();
    }
  };
  document.addEventListener('logomaker-settings-updated', handleSettingsUpdated);

  // ESC key to close
  document.addEventListener('keydown', handleEscKey);

  modalElem.dataset.listeners = 'true';
  console.log("[SVGRenderer] Modal event listeners attached.");
}

function detachModalEventListeners() {
  if (!modalElem || modalElem.dataset.listeners !== 'true') return;

  closeBtn.removeEventListener('click', closeModal);
  cancelBtn.removeEventListener('click', closeModal);
  modalElem.removeEventListener('click', (evt) => { if (evt.target === modalElem) closeModal(); });
  exportBtn.removeEventListener('click', doExport);
  transpCheck.removeEventListener('change', updatePreview);

  if (handleSettingsUpdated) {
    document.removeEventListener('logomaker-settings-updated', handleSettingsUpdated);
    handleSettingsUpdated = null;
  }
  document.removeEventListener('keydown', handleEscKey);

  modalElem.removeAttribute('data-listeners');
  console.log("[SVGRenderer] Modal event listeners detached.");
}

/* -----------------------------------------------------
   Initialization / Public Entry
------------------------------------------------------ */
async function initializeUI() {
  if (isInitialized) return true;
  console.log("[SVGRenderer] Initializing UI...");
  try {
    injectStyles();
    injectModalHTML();
    if (!queryModalElements()) {
      throw new Error("Failed to find all modal elements after injection.");
    }
    // We'll attach event listeners only once we open the modal? Or now:
    // We'll attach them now so we can handle them if user opens multiple times
    attachModalEventListeners();
    isInitialized = true;
    console.log("[SVGRenderer] UI Initialized.");
    return true;
  } catch (err) {
    console.error("[SVGRenderer] initUI failed:", err);
    isInitialized = false;
    return false;
  }
}

export async function exportSVGWithUI() {
  console.log("[SVGRenderer] exportSVGWithUI called...");
  try {
    const ok = await initializeUI();
    if (!ok) throw new Error("Failed to initialize the SVG exporter UI.");
    openModal();
  } catch (err) {
    console.error("[SVGRenderer] Cannot open SVG Exporter:", err);
    if (typeof showAlert === 'function') {
      showAlert(`Cannot open SVG Exporter: ${err.message}`, 'error');
    }
  }
}

/* -----------------------------------------------------
   Modal Show/Hide
------------------------------------------------------ */
function openModal() {
  if (!isInitialized || !modalElem) {
    console.error("[SVGRenderer] Not initialized or missing modal element.");
    if (typeof showAlert === 'function') showAlert("SVG Exporter not ready.", 'error');
    return;
  }
  syncExportSettings();
  modalElem.style.display = 'flex';
  requestAnimationFrame(() => {
    modalElem.classList.add('active');
    document.body.style.overflow = 'hidden';
    updatePreview();
  });
}

function closeModal() {
  if (!modalElem) return;
  // Optionally detach if you want fresh each time
  // detachModalEventListeners();
  modalElem.classList.remove('active');
  setTimeout(() => {
    modalElem.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

/* -----------------------------------------------------
   Misc / Utility
------------------------------------------------------ */
function handleEscKey(e) {
  if (e.key === 'Escape' && modalElem && modalElem.style.display === 'flex') {
    closeModal();
  }
}

function syncExportSettings() {
  try {
    const wMain = document.getElementById('exportWidth')?.value || '800';
    const hMain = document.getElementById('exportHeight')?.value || '400';
    const tMain = document.getElementById('exportTransparent')?.checked || false;
    widthInput.value = wMain;
    heightInput.value = hMain;
    transpCheck.checked = tMain;
  } catch (err) {
    console.warn('[SVGRenderer] Could not sync from main UI:', err);
  }
}

/* -----------------------------------------------------
   Preview & Metadata
------------------------------------------------------ */
async function updatePreview() {
  if (!isInitialized || !modalElem || modalElem.style.display !== 'flex') return;

  loadingDiv.style.display = 'flex';
  previewImg.style.display = 'none';
  previewImg.src = '';
  metaInfoDiv.innerHTML = '<h4>SVG Export Details</h4><ul><li>Generating preview...</li></ul>';

  const w = parseInt(widthInput.value, 10) || 800;
  const h = parseInt(heightInput.value, 10) || 400;
  const transparent = transpCheck.checked;

  try {
    const result = await generateConsistentPreview(
      { width: w, height: h, transparentBackground: transparent },
      previewImg,
      loadingDiv,
      'svg' // Tells the pipeline we want an SVG preview
    );
    // If result.dataUrl is present, the preview is set.

    // Now update the metadata panel
    showMetadata();
  } catch (err) {
    console.error("[SVGRenderer] updatePreview error:", err);
    loadingDiv.querySelector('.progress-text').textContent = "Preview Failed!";
    metaInfoDiv.innerHTML = `<h4>SVG Export Details</h4><ul><li>Preview failed: ${err.message}</li></ul>`;
  }
}

/** Gather advanced style info & animation, show in metaInfoDiv. */
function showMetadata() {
  if (!metaInfoDiv) return;
  metaInfoDiv.innerHTML = '<h4>SVG Export Details</h4><ul><li>Loading details...</li></ul>';
  try {
    const styles = captureAdvancedStyles();
    if (!styles) throw new Error("No style object captured.");

    const anim = extractSVGAnimationDetails() || {}; // e.g. { name:'anim-glow', duration:'2s' }
    let html = '<h4>SVG Export Details</h4><ul>';

    // Font family
    const fontFam = (styles.font?.family || 'Sans').split(',')[0].replace(/['"]/g,'');
    const fontWt  = styles.font?.weight || '400';
    const fontSty = styles.font?.style || 'normal';
    html += `<li>Font: <code>${fontFam}</code> (W: ${fontWt}, S: ${fontSty})</li>`;

    // color mode
    const colorMode = styles.color?.mode || 'N/A';
    if (colorMode === 'gradient' && styles.color?.gradient?.colors) {
      const colArr = styles.color.gradient.colors;
      html += `<li>Text Color: Gradient → <code>${colArr.join(', ')}</code></li>`;
    } else {
      html += `<li>Text Color: <code>${styles.color?.value || '#FFFFFF'}</code></li>`;
    }

    // border style
    if (styles.border && styles.border.style && styles.border.style !== 'none') {
      html += `<li>Border: ${styles.border.style} (<code>${styles.border.width || '1px'}</code>)</li>`;
    } else {
      html += `<li>Border: None</li>`;
    }

    // background
    const isTransparent = transpCheck.checked;
    html += `<li>Background: ${isTransparent ? 'Transparent' : (styles.background?.type || 'bg-solid')}</li>`;

    // animation
    const animName = anim.name || styles.animation?.type || 'None';
    html += `<li>Animation: <code>${animName}</code>`;
    if (anim.duration) html += ` (${anim.duration})`;
    html += `</li>`;

    html += '</ul>';
    metaInfoDiv.innerHTML = html;
  } catch (err) {
    console.error("[SVGRenderer] showMetadata error:", err);
    metaInfoDiv.innerHTML = `<h4>SVG Export Details</h4><ul><li>Metadata error: ${err.message}</li></ul>`;
  }
}

/* -----------------------------------------------------
   Final Export
------------------------------------------------------ */
async function doExport() {
  if (!modalElem || !exportBtn || !loadingDiv) return;
  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  loadingDiv.style.display = 'flex';
  const progressTextEl = loadingDiv.querySelector('.progress-text');
  if (progressTextEl) progressTextEl.textContent = 'Generating final SVG...';

  const w = parseInt(widthInput.value, 10) || 800;
  const h = parseInt(heightInput.value, 10) || 400;
  const transparent = transpCheck.checked;

  try {
    const blob = await generateSVGBlob({
      width: w,
      height: h,
      transparentBackground: transparent
    });
    // Build filename
    const baseName = window.Utils?.getLogoFilenameBase?.() || 'logo';
    const filename = `${baseName}_${w}x${h}.svg`;

    if (typeof window.Utils?.downloadBlob === 'function') {
      window.Utils.downloadBlob(blob, filename);
    } else {
      // fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url), 500);
    }

    if (typeof showToast === 'function') {
      showToast({ message: `SVG exported: ${filename}`, type: 'success' });
    }
    closeModal();

  } catch (err) {
    console.error("[SVGRenderer] doExport error:", err);
    if (typeof showAlert === 'function') {
      showAlert(`SVG export failed: ${err.message}`, 'error');
    }
    if (progressTextEl) progressTextEl.textContent = 'Export Failed!';
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export SVG';
  }
}
