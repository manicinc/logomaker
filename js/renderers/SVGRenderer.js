/**
 * SVGRenderer.js (Version 2 - Enhanced Info)
 * ====================================================
 * Provides SVG export functionality using the centralized rendering pipeline
 * and manages the SVG export modal UI. Includes notice about SVG limitations.
 */

// Import core functions from RendererCore
import { generateSVGBlob, generateConsistentPreview } from './RendererCore.js';
// Import utilities
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js';
// Import the required style capture function ---
import { captureAdvancedStyles } from '../captureTextStyles.js'; // Adjust path if needed

// so it can be accessed by both attachModalEventListeners (to set it up) and detachModalEventListeners (to remove it later).
let handleSettingsUpdateListener = null; 

// --- Module Scope Variables ---
let svgExportUI = null; // Reference to the modal DOM element
let isInitialized = false;
const MODAL_ID = 'svgExportModal';
const STYLE_ID = 'svgExporterStyles'; // Optional: If specific styles are needed

// --- DOM Element References (Populated by queryModalElements) ---
let modal = null, closeBtn = null, cancelBtn = null, exportBtn = null;
let previewImage = null, loadingIndicator = null;
let widthInput = null, heightInput = null, transparentCheckbox = null;
let metadataInfoDiv = null; // Element to display metadata

// --- CSS (Optional) ---
const MODAL_CSS = `
/* Add specific styles for SVG exporter modal if needed */
.svg-exporter-modal .exporter-preview-image {
    /* Use checkerboard for transparency indication */
    background: repeating-conic-gradient(var(--border-subtle, #ccc) 0% 25%, var(--panel-bg-opaque, #fff) 0% 50%) 50% / 20px 20px;
    background-size: 20px 20px; /* Ensure size is set */
}
.svg-exporter-modal .svg-metadata-info {
    margin-top: 15px;
    padding: 10px;
    background-color: var(--input-bg, rgba(0,0,0,0.1)); /* Use theme variable */
    border-radius: var(--border-radius-sm, 4px); /* Use theme variable */
    font-size: 0.8em;
    max-height: 120px; /* Increased height */
    overflow-y: auto; /* Add scroll if needed */
    border: 1px solid var(--border-color, #ddd); /* Use theme variable */
    color: var(--text-color-muted, #666); /* Use theme variable */
}
body.dark-mode .svg-exporter-modal .svg-metadata-info {
     background-color: rgba(255,255,255,0.05);
     border-color: #444;
     color: #ccc;
}
.svg-exporter-modal .svg-metadata-info h4 {
    margin: 0 0 8px 0; /* Increased margin */
    font-size: 1.0em; /* Slightly smaller */
    color: var(--text-color-strong, #333); /* Use theme variable */
    border-bottom: 1px solid var(--border-subtle); /* Add separator */
    padding-bottom: 5px;
}
body.dark-mode .svg-exporter-modal .svg-metadata-info h4 {
     color: #eee;
     border-bottom-color: #555;
}
.svg-exporter-modal .svg-metadata-info ul {
    list-style: none;
    padding: 0;
    margin: 0;
}
.svg-exporter-modal .svg-metadata-info li {
    margin-bottom: 4px; /* Consistent spacing */
    word-break: break-word; /* Prevent overflow */
}
.svg-exporter-modal .svg-metadata-info code { /* Style code elements */
    background-color: var(--code-bg, #eee);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.95em;
    color: var(--text-color, #333);
}
body.dark-mode .svg-exporter-modal .svg-metadata-info code {
    background-color: #11131c;
    color: #ddd;
}

.svg-exporter-modal .exporter-preview-image {
    /* Use checkerboard for transparency indication */
    background: repeating-conic-gradient(var(--border-subtle, #ccc) 0% 25%, var(--panel-bg-opaque, #fff) 0% 50%) 50% / 20px 20px;
    background-size: 20px 20px; /* Ensure size is set */
    /* Keep other styles like max-width, border etc. */
    display: block; /* Ensure it behaves like a block */
    max-width: 100%;
    height: auto;
    border: 1px solid var(--border-color, #ccc);
    min-height: 100px; /* Or match other preview min-heights */
    object-fit: contain; /* Ensure SVG scales within bounds */
}

/* Ensure dark mode checkerboard is appropriate */
body.dark-mode .svg-exporter-modal .exporter-preview-image {
    background: repeating-conic-gradient(var(--border-color, #333) 0% 25%, var(--panel-bg, #222) 0% 50%) 50% / 20px 20px;
    background-size: 20px 20px;
}

/* Ensure loading indicator styles are present */
.svg-exporter-modal .exporter-preview-loading {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: var(--modal-backdrop-bg, rgba(255, 255, 255, 0.8)); /* Use theme variable */
    display: flex; flex-direction: column;
    justify-content: center; align-items: center; z-index: 5; color: var(--text-color, #333); /* Use theme variable */
    border-radius: inherit;
    text-align: center;
}
/* Dark mode handled by base styles */
.svg-exporter-modal .exporter-preview-loading .spinner {
    border: 4px solid rgba(var(--accent-color-rgb, 255, 20, 147), 0.2); /* Use theme variable */
    border-left-color: var(--accent-color, #ff1493); /* Use theme variable */
    border-radius: 50%; width: 30px; height: 30px;
    animation: svg-spin 1s linear infinite; margin-bottom: 10px;
}
@keyframes svg-spin { to { transform: rotate(360deg); } }
.svg-exporter-modal .svg-exporter-info-text {
    font-size: 0.85em;
    margin-top: 15px;
    color: var(--text-color-muted, #666);
    line-height: 1.4;
    padding: 10px;
    background: var(--input-bg, rgba(0,0,0,0.05)); /* Use theme variable */
    border-radius: var(--border-radius-sm, 4px);
    border: 1px dashed var(--border-color, #ccc); /* Use theme variable */
}
`;

// --- HTML Structure ---
const MODAL_HTML = `
<div id="${MODAL_ID}" class="modal-overlay svg-exporter-modal" role="dialog" aria-modal="true" aria-labelledby="${MODAL_ID}Title" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
        <svg class="modal-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
        <h3 class="modal-title" id="${MODAL_ID}Title">Export as SVG</h3>
        <button id="${MODAL_ID}CloseBtn" class="modal-close-btn" aria-label="Close modal">&times;</button>
    </div>
    <div class="modal-body">
        <div class="exporter-preview-area" style="position: relative;">
            <div id="${MODAL_ID}Loading" class="exporter-preview-loading" style="display: none;">
                <div class="spinner"></div>
                <div class="progress-text">Generating preview...</div>
            </div>
            <img id="${MODAL_ID}PreviewImage" class="exporter-preview-image" src="#" alt="SVG Preview" style="display: none; max-width: 100%; height: auto; border: 1px solid var(--border-color, #ccc); min-height: 100px;">
             <div id="${MODAL_ID}MetadataInfo" class="svg-metadata-info">
                 <h4>SVG Export Details</h4>
                 <ul><li>Loading details...</li></ul>
             </div>
        </div>
        <div class="exporter-controls-area">
            <div class="control-group">
                <label for="${MODAL_ID}Width">Width (px)</label>
                <div class="number-input-wrapper">
                    <input type="number" id="${MODAL_ID}Width" value="800" min="10" max="8000" step="10"
                        readonly title="Output width is set in the Advanced tab.">
                </div>
            </div>
            <div class="control-group">
                <label for="${MODAL_ID}Height">Height (px)</label>
                <div class="number-input-wrapper">
                    <input type="number" id="${MODAL_ID}Height" value="400" min="10" max="8000" step="10"
                        readonly title="Output height is set in the Advanced tab.">
                </div>
            </div>
            <label class="checkbox-label control-group" style="margin-top: 10px;">
                <input type="checkbox" id="${MODAL_ID}Transparent">
                <span>Transparent Background</span>
            </label>
            <div class="svg-exporter-info-text">
                <b>Note:</b> SVG is a vector format. It scales perfectly and includes text, styles, gradients, and basic filters. Ideal for web use and editing.<br>
                <strong style="color: var(--warning-color, orange);">Limitation: Complex CSS effects (animated backgrounds, intricate borders like 'groove', some multi-layer shadows) may render differently or be omitted compared to the live web preview.</strong>
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <button id="${MODAL_ID}CancelBtn" class="modal-btn modal-btn-cancel">Cancel</button>
        <button id="${MODAL_ID}ExportBtn" class="modal-btn modal-btn-primary">Export SVG</button>
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

/** Opens the modal and attaches listeners */
function openModal() {
    if (!isInitialized || !modal) { const msg = "SVG exporter UI not ready or missing."; console.error(`[SVG UI] ${msg}`); if (typeof showAlert === 'function') showAlert(msg, "error"); throw new Error(msg); }
    console.log("[SVG UI] Opening Modal...");
    syncExportSettings(); // Sync settings FIRST
    attachModalEventListeners(); // <-- Attach listeners AFTER sync

    modal.style.display = 'flex';
    requestAnimationFrame(() => { modal.classList.add('active'); });
    document.body.style.overflow = 'hidden';
    updatePreview(); // Generate initial preview and metadata AFTER listeners are attached
}

/** Closes the modal and detaches listeners */
function closeModal() {
    if (!modal) return;
    detachModalEventListeners(); // <-- Detach listeners BEFORE hiding
    modal.classList.remove('active');
    modal.addEventListener('transitionend', () => {
        if (!modal.classList.contains('active')) { modal.style.display = 'none'; document.body.style.overflow = ''; }
    }, { once: true });
    setTimeout(() => { if (!modal.classList.contains('active')) { modal.style.display = 'none'; document.body.style.overflow = ''; }}, 500);
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

/** Update the preview image and metadata */
const updatePreview = debounce(() => {
    if (!isInitialized) return;
    console.log("[SVG UI] Updating preview and metadata...");

    const options = {
        width: parseInt(widthInput?.value) || 400, // Use smaller preview dimensions
        height: parseInt(heightInput?.value) || 300,
        transparentBackground: transparentCheckbox?.checked || false
    };

    // --- Update Preview Image ---
    generateConsistentPreview(options, previewImage, loadingIndicator, 'svg')
        .then(result => {
            console.log("[SVG UI] Preview generation successful.");
            // UI update (loading hide, image display) is handled within generateConsistentPreview
        })
        .catch(error => {
            console.error('[SVG UI] Preview generation failed:', error);
            // Error state is handled within generateConsistentPreview
            if (typeof showAlert === 'function') showAlert(`Preview failed: ${error.message}`, 'warning');
            if(metadataInfoDiv) metadataInfoDiv.innerHTML = 'Preview Generation Failed.'; // Show error in metadata area too
        })
        .finally(() => {
             // --- Always Update Metadata Display (even on failure) ---
             updateMetadataInfo(); // Call the metadata update function
        });

}, 300);


/** Update the metadata display area */

function updateMetadataInfo() {
    if (!metadataInfoDiv) return;
    console.log("[SVG UI] Updating metadata info display...");

    metadataInfoDiv.innerHTML = '<h4>SVG Export Details</h4><ul><li>Loading details...</li></ul>'; // Reset

    try {
        // Use the *same* style capture function used for rendering
        const styles = captureAdvancedStyles();
        const animationMetadata = extractSVGAnimationDetails(); // Use the same animation info

        if (!styles) { throw new Error("Failed to capture styles."); }
        if (!styles.font) { throw new Error("Font styles missing."); }

        let infoHTML = '<h4>SVG Export Details</h4><ul>';

        // Font info with better system font detection
        const fontName = styles.font.family?.split(',')[0].trim().replace(/['"]/g, '') || 'N/A';
        const isSystemFont = ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma', 'Impact'].includes(fontName);
        infoHTML += `<li>Font: <code>${fontName}</code> (${styles.font.weight || 'N/A'})${isSystemFont ? ' (System Font)' : ''}</li>`;

        // Color mode
        if (styles.color?.mode === 'gradient' && styles.color.gradient?.colors?.length) {
             const c1 = styles.color.gradient.colors[0] || 'Start';
             const c2 = styles.color.gradient.colors[1] || 'End';
             const c3 = styles.color.gradient.colors[2];
             infoHTML += `<li>Color: Gradient (<code>${c1}</code> → <code>${c2}${c3 ? ' → '+c3 : ''}</code>)</li>`;
        } else {
             infoHTML += `<li>Color: Solid (<code>${styles.color?.value || '#FFFFFF'}</code>)</li>`;
        }

        // Animation
        const animType = animationMetadata?.type || styles?.animation?.type || 'None';
        infoHTML += `<li>Animation: <code>${animType}</code>`;
        if (animType !== 'None' && (animationMetadata?.duration || styles?.animation?.duration)) {
             infoHTML += ` (${animationMetadata?.duration || styles?.animation?.duration})`;
        }
        infoHTML += `</li>`;

        // Effects (Glow/Shadow)
        // Check styles.textEffect (updated name from captureStyles)
        if (styles.textEffect?.type && styles.textEffect.type !== 'none') {
             let effectType = styles.textEffect.type === 'glow' ? 'Glow' : 'Shadow';
             if (styles.textEffect.color) effectType += ` (<code>${styles.textEffect.color}</code>)`;
             infoHTML += `<li>Text Effect: ${effectType}</li>`;
        } else {
            infoHTML += `<li>Text Effect: None</li>`;
        }

        // Border
        if (styles.border?.style && styles.border.style !== 'none' && styles.border.style !== 'hidden') {
             infoHTML += `<li>Border/Stroke: ${styles.border.style} (${styles.border.width || 'N/A'}, <code>${styles.border.color || 'N/A'}</code>)`;
             if(styles.border.isGlow) infoHTML += ` + Glow`; // Indicate if glow filter is applied via border
             infoHTML += `</li>`;
        } else {
             infoHTML += `<li>Border/Stroke: None</li>`;
        }

        // Background
         const bgType = styles.background?.type || 'N/A';
         const isTransparent = transparentCheckbox?.checked || false;
         if (isTransparent) {
            infoHTML += `<li>Background: Transparent</li>`;
         } else if (bgType.includes('gradient')) {
            infoHTML += `<li>Background: Gradient (ID: <code>svgBgGradient</code>)</li>`;
         } else if (bgType !== 'bg-transparent' && bgType !== 'bg-solid' && bgType !== 'N/A') {
             // If it's a pattern or other complex type
             infoHTML += `<li>Background: ${bgType} (May differ in SVG)</li>`;
         }
         else {
            infoHTML += `<li>Background: Solid (<code>${styles.background?.color || '#000000'}</code>)</li>`;
         }

        infoHTML += '</ul>';
        metadataInfoDiv.innerHTML = infoHTML;
        console.log("[SVG UI] Metadata info updated.");
    } catch(e) {
        console.error("[SVG UI] Error updating metadata info:", e);
        metadataInfoDiv.innerHTML = '<h4>SVG Export Details</h4><ul><li>Error loading details.</li></ul>';
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
      transparentBackground: transparentCheckbox?.checked || false,
      // Styles will be captured inside exportAsSVGCore -> generateSVGBlob
  };
  console.log("[SVG UI] Final export options:", options);

  try {
      // Use the CORE export function
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

    // Update preview only on transparency change in this modal
    transparentCheckbox?.addEventListener('change', updatePreview);

    // --- ADDED: Listener for global settings updates ---
    handleSettingsUpdateListener = (event) => {
        console.log('[SVG UI] Received logomaker-settings-updated event.');
         if (modal && modal.style.display === 'flex') { // Only update if modal is visible
            syncExportSettings(); // Re-sync the displayed readonly values
            updatePreview();    // Update the preview based on the new dimensions
         }
    };
    document.addEventListener('logomaker-settings-updated', handleSettingsUpdateListener);
    // --- END ADDED ---

    document.addEventListener('keydown', handleEscapeKey); // Assuming handleEscapeKey exists

    modal.dataset.listenersAttached = 'true';
    console.log('[SVG UI] Event listeners attached.');
}

/** Remove event listeners */
function detachModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached !== 'true') return;
     console.log('[SVG UI] Removing event listeners...');

    closeBtn?.removeEventListener('click', closeModal);
    cancelBtn?.removeEventListener('click', closeModal);
    exportBtn?.removeEventListener('click', handleExport);
    modal?.removeEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    transparentCheckbox?.removeEventListener('change', updatePreview);

    // --- ADDED: Remove the global settings update listener ---
    if (handleSettingsUpdateListener) {
        document.removeEventListener('logomaker-settings-updated', handleSettingsUpdateListener);
        handleSettingsUpdateListener = null; // Clear the reference
        console.log('[SVG UI] Removed settings update listener.');
    }
    // --- END ADDED ---

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
async function exportAsSVGCore(options = {}) {
    console.log('[SVG Core] exportAsSVGCore called with options:', options);
    try {
        // Call the core generation function
        const blob = await generateSVGBlob(options); // generateSVGBlob handles style capture internally now
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