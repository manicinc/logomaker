/**
 * SVGRenderer.js
 * ========================================
 * Handles SVG export user interface and operations.
 * Delegates actual SVG generation to RendererCore.
 */

import { generateSVGBlob } from './RendererCore.js';
import { getLogoFilenameBase } from '../utils/utils.js';
import { captureAdvancedStyles } from '../captureTextStyles.js';
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js';

// Module variables
let isInitialized = false;
let currentSvgBlob = null;

// Modal IDs and elements
const MODAL_ID = 'svgExportModal';
const STYLE_ID = 'svgExportModalStyles';

// Element references
let modal, closeBtn, cancelBtn, exportBtn, previewImage;
let loadingIndicator, widthInput, heightInput, transparentCheckbox, metadataInfoDiv;

// HTML and CSS definitions
const MODAL_HTML = `
<div id="svgExportModal" class="export-modal">
    <div class="export-modal-content">
        <div class="export-modal-header">
            <h3>Export as SVG</h3>
            <button id="svgExportModalCloseBtn" class="close-btn">&times;</button>
        </div>
        <div class="export-modal-body">
            <div class="export-preview-container">
                <div id="svgExportModalPreviewImage" class="export-preview"></div>
                <div id="svgExportModalLoading" class="loading-indicator">
                    <div class="spinner"></div>
                    <div class="progress-text">Loading preview...</div>
                </div>
            </div>
            <div class="export-options">
                <div class="option-group">
                    <label for="svgExportModalWidth">Width (px):</label>
                    <input type="number" id="svgExportModalWidth" min="50" max="3000" value="800">
                </div>
                <div class="option-group">
                    <label for="svgExportModalHeight">Height (px):</label>
                    <input type="number" id="svgExportModalHeight" min="50" max="3000" value="400">
                </div>
                <div class="option-group">
                    <label for="svgExportModalTransparent">Transparent Background:</label>
                    <input type="checkbox" id="svgExportModalTransparent">
                </div>
                <div id="svgExportModalMetadataInfo" class="metadata-info">
                    <h4>SVG Export Details</h4>
                    <p>Loading export details...</p>
                </div>
            </div>
        </div>
        <div class="export-modal-footer">
            <button id="svgExportModalCancelBtn" class="cancel-btn">Cancel</button>
            <button id="svgExportModalExportBtn" class="action-btn">Export SVG</button>
        </div>
    </div>
</div>
`;

const MODAL_CSS = `
.export-modal {
    display: none;
    position: fixed;
    z-index: 9999;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.7);
    align-items: center;
    justify-content: center;
}
.export-modal.active {
    display: flex;
}
.export-modal-content {
    background-color: #f8f8f8;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    color: #333;
}
.export-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid #ddd;
}
.export-modal-header h3 {
    margin: 0;
    font-size: 18px;
}
.export-modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}
.export-preview-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #eee;
    border: 1px solid #ddd;
    border-radius: 4px;
    height: 250px;
    margin-bottom: 20px;
}
.export-preview {
    max-width: 100%;
    max-height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
}
.loading-indicator {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255,255,255,0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.spinner {
    border: 4px solid rgba(0,0,0,0.1);
    border-radius: 50%;
    border-top: 4px solid #3498db;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
    margin-bottom: 10px;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
.export-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 15px;
}
.option-group {
    display: flex;
    flex-direction: column;
}
.option-group label {
    margin-bottom: 5px;
    font-size: 14px;
}
.option-group input[type="number"] {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}
.metadata-info {
    grid-column: 1 / -1;
    background-color: #f1f1f1;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
    font-size: 13px;
}
.metadata-info h4 {
    margin: 0 0 5px 0;
    font-size: 14px;
}
.metadata-info ul {
    margin: 0;
    padding-left: 20px;
    list-style-type: none;
}
.metadata-info li {
    margin-bottom: 3px;
}
.export-modal-footer {
    padding: 15px 20px;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
.close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
}
.close-btn:hover {
    color: #000;
}
.cancel-btn {
    padding: 8px 15px;
    background-color: #f1f1f1;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
}
.action-btn {
    padding: 8px 15px;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.action-btn:hover {
    background-color: #2980b9;
}
.action-btn:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
}
/* Dark mode support */
body.dark-mode .export-modal-content {
    background-color: #222;
    color: #eee;
}
body.dark-mode .export-modal-header {
    border-bottom-color: #444;
}
body.dark-mode .export-preview-container {
    background-color: #333;
    border-color: #444;
}
body.dark-mode .loading-indicator {
    background-color: rgba(0,0,0,0.7);
}
body.dark-mode .export-modal-footer {
    border-top-color: #444;
}
body.dark-mode .option-group input[type="number"] {
    background-color: #333;
    border-color: #444;
    color: #eee;
}
body.dark-mode .metadata-info {
    background-color: #333;
}
body.dark-mode .cancel-btn {
    background-color: #333;
    border-color: #444;
    color: #eee;
}
`;

// --- Internal Functions ---

function injectStyles() {
    if (!document.getElementById(STYLE_ID) && MODAL_CSS) {
         const styleElement = document.createElement('style');
         styleElement.id = STYLE_ID;
         styleElement.textContent = MODAL_CSS;
         document.head.appendChild(styleElement);
         console.log('[SVG UI] Styles Injected.');
    }
}

function injectModalHTML() {
    if (document.getElementById(MODAL_ID)) return;
    const container = document.createElement('div');
    container.innerHTML = MODAL_HTML.trim();
    const modalElement = container.firstChild;
    if (modalElement instanceof Node) {
        document.body.appendChild(modalElement);
        console.log('[SVG UI] Modal HTML Injected.');
    } else { throw new Error("Failed to create modal element from HTML string."); }
}

function queryModalElements() {
    modal = document.getElementById(MODAL_ID); if (!modal) return false;
    closeBtn = document.getElementById(`${MODAL_ID}CloseBtn`); if (!closeBtn) return false;
    cancelBtn = document.getElementById(`${MODAL_ID}CancelBtn`); if (!cancelBtn) return false;
    exportBtn = document.getElementById(`${MODAL_ID}ExportBtn`); if (!exportBtn) return false;
    previewImage = document.getElementById(`${MODAL_ID}PreviewImage`); if (!previewImage) return false;
    loadingIndicator = document.getElementById(`${MODAL_ID}Loading`); if (!loadingIndicator) return false;
    widthInput = document.getElementById(`${MODAL_ID}Width`); if (!widthInput) return false;
    heightInput = document.getElementById(`${MODAL_ID}Height`); if (!heightInput) return false;
    transparentCheckbox = document.getElementById(`${MODAL_ID}Transparent`); if (!transparentCheckbox) return false;
    metadataInfoDiv = document.getElementById(`${MODAL_ID}MetadataInfo`); if (!metadataInfoDiv) return false;
    console.log('[SVG UI] Modal elements queried successfully.');
    return true; // All essential elements found
}

function openModal() {
    if (!isInitialized || !modal) { 
        const msg = "SVG exporter UI not ready or missing."; 
        console.error(`[SVG UI] ${msg}`); 
        if (typeof showAlert === 'function') showAlert(msg, "error"); 
        throw new Error(msg); 
    }
    console.log("[SVG UI] Opening Modal...");
    syncExportSettings(); // Sync settings from main UI *before* showing
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    updatePreview(); // Generate initial preview and metadata
}

function closeModal() {
    if (!modal) return;
    modal.style.display = 'none';
    modal.classList.remove('active');
    document.body.style.overflow = '';
    console.log("[SVG UI] Modal closed.");
}

/** Debounce function */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/** Generate a consistent preview for exported image formats */
async function generateConsistentPreview(options, previewElement, loadingElement, format = 'svg') {
    if (!previewElement) return Promise.reject(new Error('Preview element not found'));
    
    // Show loading state
    if (loadingElement) loadingElement.style.display = 'flex';
    previewElement.innerHTML = '';
    
    try {
        // Generate the blob based on format
        let blob;
        if (format === 'svg') {
            blob = await generateSVGBlob(options);
            currentSvgBlob = blob; // Store for export
        } else {
            throw new Error(`Unsupported preview format: ${format}`);
        }
        
        // Create object URL for preview
        const blobUrl = URL.createObjectURL(blob);
        
        // Create image element
        const img = document.createElement('img');
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        
        // For transparent PNGs/SVGs, add a checkerboard background
        if (options.transparentBackground) {
            previewElement.style.backgroundImage = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQYlWNgYGD4z4AEGBkQAFGShiARAFL0AEUgF5cVAAAAAElFTkSuQmCC")';
            previewElement.style.backgroundRepeat = 'repeat';
        } else {
            previewElement.style.backgroundImage = 'none';
        }
        
        // Return a promise that resolves when the image is loaded
        return new Promise((resolve, reject) => {
            img.onload = () => {
                // Hide loading and add image to preview
                if (loadingElement) loadingElement.style.display = 'none';
                
                // Clear preview content and add the image
                previewElement.innerHTML = '';
                previewElement.appendChild(img);
                
                // Cleanup URL object
                URL.revokeObjectURL(blobUrl);
                
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    element: img,
                    blob: blob
                });
            };
            
            img.onerror = (err) => {
                if (loadingElement) loadingElement.style.display = 'none';
                URL.revokeObjectURL(blobUrl);
                reject(new Error(`Failed to load preview image: ${err.message || 'Unknown error'}`));
            };
            
            img.src = blobUrl;
        });
    } catch (error) {
        if (loadingElement) loadingElement.style.display = 'none';
        previewElement.innerHTML = '<div style="color:red;">Preview generation failed</div>';
        return Promise.reject(error);
    }
}

/** Update the preview image and metadata */
const updatePreview = debounce(() => {
    if (!isInitialized) return;
    console.log("[SVG UI] Updating preview and metadata...");

    const options = {
        width: parseInt(widthInput?.value) || 400, // Use smaller preview dimensions
        height: parseInt(heightInput?.value) || 300,
        transparentBackground: transparentCheckbox?.checked || false
    };

    // Update Preview Image
    generateConsistentPreview(options, previewImage, loadingIndicator, 'svg')
        .then(result => {
             console.log("[SVG UI] Preview generation successful.");
        })
        .catch(error => {
             console.error('[SVG UI] Preview generation failed:', error);
             if (typeof showAlert === 'function') showAlert(`Preview failed: ${error.message}`, 'warning');
        });

    // Update Metadata Display
    updateMetadataInfo(); // Call the metadata update function

}, 300);

/** Update the metadata display area */
function updateMetadataInfo() {
    if (!metadataInfoDiv) return;
    console.log("[SVG UI] Updating metadata info display...");

    try {
         // Use the *same* style capture function used for rendering
         const styles = captureAdvancedStyles(); // Or getFinalTextStyles
         const animationMetadata = extractSVGAnimationDetails();
         if (!styles || !styles.font) { metadataInfoDiv.innerHTML = 'Error loading details.'; return; }

         let infoHTML = '<h4>SVG Export Details</h4><ul>';

         // Font info
         infoHTML += `<li>Font: ${styles.font.family || 'N/A'} (${styles.font.weight || 'N/A'})</li>`;

         // Color mode
         if (styles.color?.mode === 'gradient') {
              const c1 = styles.color.gradient?.colors?.[0] || 'Start';
              const c2 = styles.color.gradient?.colors?.[1] || 'End';
              infoHTML += `<li>Color: Gradient (${c1} → ${c2})</li>`;
         } else {
              infoHTML += `<li>Color: Solid (${styles.color?.value || '#FFFFFF'})</li>`;
         }

         // Animation
         infoHTML += `<li>Animation: ${animationMetadata?.name || 'None'}`;
         if (animationMetadata?.duration) infoHTML += ` (${animationMetadata.duration})`;
         infoHTML += `</li>`;

         // Effects (Glow/Shadow)
         if (styles.effects?.filterId) {
              let effectType = 'Effect';
              if (styles.effects.glowInfo) effectType = `Glow (${styles.effects.glowInfo.color})`;
              else if (styles.effects.shadowInfo) effectType = `Shadow (${styles.effects.shadowInfo.color})`;
              infoHTML += `<li>Effect: ${effectType}</li>`;
         }

         // Border
         if (styles.border?.style && styles.border.style !== 'none') {
              infoHTML += `<li>Border: ${styles.border.style} (${styles.border.width || 'N/A'}, ${styles.border.color || 'N/A'})</li>`;
         }

         infoHTML += '</ul>';
         metadataInfoDiv.innerHTML = infoHTML;
         console.log("[SVG UI] Metadata info updated.");
    } catch(e) {
        console.error("[SVG UI] Error updating metadata info:", e);
        metadataInfoDiv.innerHTML = 'Error loading details.';
    }
}


/** Handle final export */
async function handleExport() {
  if (!isInitialized || !modal) return;
  console.log("[SVG UI] Export button clicked.");

  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  loadingIndicator.style.display = 'flex'; // Show loading
  const progressTextEl = loadingIndicator.querySelector('.progress-text') || loadingIndicator;
  progressTextEl.textContent = 'Generating final SVG...';

  // Get final values FROM MODAL INPUTS
  const options = {
      width: parseInt(widthInput?.value) || 800,
      height: parseInt(heightInput?.value) || 400,
      transparentBackground: transparentCheckbox?.checked || false
  };
  console.log("[SVG UI] Final export options:", options);

  try {
      // Use the CORE export function with our enhanced styles
      const blob = await exportAsSVGCore(options);
      console.log(`[SVG UI] Final SVG generated. Size: ${(blob.size / 1024).toFixed(1)} KB`);

      // Trigger download
      let filename = 'logo.svg';
      if (typeof window.Utils?.getLogoFilenameBase === 'function') {
           filename = window.Utils.getLogoFilenameBase() + '.svg';
      } else { // Basic fallback
           const logoText = document.querySelector('.logo-text')?.textContent || 'logo';
           filename = logoText.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) + '.svg';
      }
       console.log(`[SVG UI] Triggering download for: ${filename}`);

      if (typeof window.Utils?.downloadBlob === 'function') {
          window.Utils.downloadBlob(blob, filename);
      } else {
          triggerDownloadFallback(blob, filename);
      }

      // Notify success
      if (typeof window.notifyExportSuccess === 'function') {
           window.notifyExportSuccess('SVG', filename);
      } else if(typeof showToast === 'function'){
           showToast({ message: `Exported ${filename}`, type: 'success' });
      } else { console.log(`Exported ${filename}`); }

      closeModal();

  } catch (error) {
      console.error("[SVG UI] Export process failed:", error);
      if (typeof showAlert === 'function') showAlert(`SVG Export failed: ${error.message}`, 'error');
  } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export SVG';
      loadingIndicator.style.display = 'none';
  }
}

/** Basic fallback for downloading a blob */
function triggerDownloadFallback(blob, filename) {
    console.warn("[SVG UI] Using fallback download method.");
     try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none"; a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 250);
    } catch (err) { console.error(`[SVG UI Fallback Download] Error:`, err); showAlert(`Download failed: ${err.message}`, "error"); }
}

/** Attach event listeners */
function attachModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached === 'true') return;
    console.log('[SVG UI] Attaching event listeners...');

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    exportBtn?.addEventListener('click', handleExport);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Update preview on input change (debounced)
    widthInput?.addEventListener('input', updatePreview);
    heightInput?.addEventListener('input', updatePreview);
    transparentCheckbox?.addEventListener('change', updatePreview);

    // Add Escape key listener
    document.addEventListener('keydown', handleEscapeKey);

    modal.dataset.listenersAttached = 'true';
    console.log('[SVG UI] Event listeners attached.');
}

/** Remove event listeners */
function removeModalEventListeners() {
     if (!modal || modal.dataset.listenersAttached !== 'true') return;
     console.log('[SVG UI] Removing event listeners...');
    closeBtn?.removeEventListener('click', closeModal);
    cancelBtn?.removeEventListener('click', closeModal);
    exportBtn?.removeEventListener('click', handleExport);
    modal?.removeEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    widthInput?.removeEventListener('input', updatePreview);
    heightInput?.removeEventListener('input', updatePreview);
    transparentCheckbox?.removeEventListener('change', updatePreview);
     document.removeEventListener('keydown', handleEscapeKey);

    modal.removeAttribute('data-listeners-attached');
     console.log('[SVG UI] Event listeners removed.');
}

/** Handle escape key press */
function handleEscapeKey(event) {
     if (event.key === 'Escape' && modal?.classList.contains('active')) {
        console.log("[SVG UI] Escape key pressed, closing modal.");
        closeModal();
     }
}

/** Sync settings from main UI to modal */
function syncExportSettings() {
    if (!isInitialized || !modal) { console.warn('[SVG UI] Cannot sync settings, UI not ready.'); return; }
    console.log('[SVG UI] Syncing settings from main UI...');
    try {
        // Read from main settings elements in Advanced Tab
        const mainWidth = document.getElementById('exportWidth')?.value || '800';
        const mainHeight = document.getElementById('exportHeight')?.value || '400';
        const mainTransparent = document.getElementById('exportTransparent')?.checked || false;

        // Apply to modal inputs
        if (widthInput) widthInput.value = mainWidth;
        if (heightInput) heightInput.value = mainHeight;
        if (transparentCheckbox) transparentCheckbox.checked = mainTransparent;

        console.log(`[SVG UI] Settings synced: W=${mainWidth}, H=${mainHeight}, T=${mainTransparent}`);
    } catch (e) {
        console.error(`[SVG UI] Error syncing settings:`, e);
    }
}

/** Initialize the UI (inject, query, attach listeners) */
function initializeUI() {
    if (isInitialized) return Promise.resolve(true);
    console.log('[SVG UI] Initializing...');
    return new Promise((resolve, reject) => {
         try {
             injectStyles();
             injectModalHTML();
             if (queryModalElements()) {
                 attachModalEventListeners();
                 isInitialized = true;
                 console.log('[SVG UI] Initialization complete.');
                 resolve(true);
             } else {
                 throw new Error("Failed to find all necessary modal elements after injection.");
             }
         } catch (error) {
             console.error("[SVG UI] Initialization failed:", error);
             isInitialized = false;
             reject(error);
         }
    });
}

// --- PUBLIC EXPORTED FUNCTIONS ---

/**
 * Core SVG export logic (no UI interaction).
 * Relies on the centralized rendering pipeline.
 * @param {object} options - Export options { width, height, transparentBackground, animationMetadata }.
 * @returns {Promise<Blob>} - A promise resolving with the SVG blob.
 */
export async function exportAsSVGCore(options = {}) {
    console.log('[SVG Core] exportAsSVGCore called with options:', options);
    try {
         // Call the core generation function 
         const blob = await generateSVGBlob(options);
         console.log('[SVG Core] SVG Blob generated successfully.');
         return blob;
    } catch (error) {
         console.error('[SVG Core] Failed to export as SVG:', error);
         throw error; // Re-throw
    }
}


/**
 * Initializes and displays the SVG export UI modal.
 * Main function to call from external modules.
 * @returns {Promise<void>} Resolves when the modal is shown, rejects on init error.
 */
export async function exportSVGWithUI() {
    console.log('[SVG Exporter] exportSVGWithUI() called...');
    try {
        await initializeUI(); // Ensure UI is ready
        if (isInitialized) {
             openModal(); // Open the modal
        } else {
             throw new Error("SVG UI could not be initialized.");
        }
        return Promise.resolve(); // Resolve when modal opens
    } catch (error) {
        console.error("[SVG Exporter] Cannot proceed with export:", error);
        if(typeof showAlert === 'function') showAlert(`Cannot open SVG exporter: ${error.message}`, 'error');
        return Promise.reject(error); // Reject on failure
    }
}