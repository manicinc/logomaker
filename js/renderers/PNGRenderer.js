/**
 * PNGRenderer.js
 * ====================================================
 * Provides PNG export functionality using the centralized rendering pipeline
 * and manages the PNG export modal UI.
 */

// Import core functions from RendererCore
import { generateConsistentPreview, generateSVGBlob, convertSVGtoPNG } from './RendererCore.js'; // Import all required functions

// --- Module Scope Variables ---
let pngExportUI = null; // Reference to the modal DOM element
let isInitialized = false;
const MODAL_ID = 'pngExportModal';
const STYLE_ID = 'pngExporterStyles'; // Optional: If specific styles are needed

// --- DOM Element References (Populated by queryModalElements) ---
let modal = null, closeBtn = null, cancelBtn = null, exportBtn = null;
let previewImage = null, loadingIndicator = null;
let widthInput = null, heightInput = null, qualityInput = null, qualityDisplay = null, transparentCheckbox = null;

// --- CSS (Optional - Add if specific styling is needed beyond general modal styles) ---
const MODAL_CSS = `
/* Add specific styles for PNG exporter modal if needed */
.png-exporter-modal .exporter-preview-image {
    /* Example: specific background for PNG preview if needed */
    background: repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 20px 20px;
}
.png-exporter-modal .modal-content { /* Example: Slightly different size */
    max-width: 900px;
}
/* Ensure loading indicator styles are present */
.png-exporter-modal .exporter-preview-loading {
    position: absolute; /* Position over the image area */
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(255, 255, 255, 0.8); /* Light overlay */
    display: flex; /* Use flex */
    flex-direction: column; /* Stack spinner and text */
    justify-content: center;
    align-items: center;
    z-index: 5; /* Above image, below modal controls */
    color: #333;
    border-radius: inherit; /* Inherit border radius */
}
body.dark-mode .png-exporter-modal .exporter-preview-loading { /* Dark mode adjustments */
    background: rgba(0, 0, 0, 0.8);
    color: #eee;
}
.png-exporter-modal .exporter-preview-loading .spinner { /* Basic spinner */
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: #ff1493; /* Use accent color */
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: png-spin 1s linear infinite;
    margin-bottom: 10px;
}
body.dark-mode .png-exporter-modal .exporter-preview-loading .spinner {
     border: 4px solid rgba(255, 255, 255, 0.2);
     border-left-color: #ff1493;
}
@keyframes png-spin { to { transform: rotate(360deg); } }
`;

// --- HTML Structure ---
const MODAL_HTML = `
<div id="${MODAL_ID}" class="modal-overlay png-exporter-modal" role="dialog" aria-modal="true" aria-labelledby="${MODAL_ID}Title" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
        <svg class="modal-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <path d="M21 15l-5-5L5 21"></path>
        </svg>
        <h3 class="modal-title" id="${MODAL_ID}Title">Export as PNG</h3>
        <button id="${MODAL_ID}CloseBtn" class="modal-close-btn" aria-label="Close modal">&times;</button>
    </div>
    <div class="modal-body">
        <div class="exporter-preview-area" style="position: relative;">
             <div id="${MODAL_ID}Loading" class="exporter-preview-loading" style="display: none;">
                <div class="spinner"></div>
                <div class="progress-text">Generating preview...</div>
             </div>
             <img id="${MODAL_ID}PreviewImage" class="exporter-preview-image" src="#" alt="PNG Preview" style="display: none; max-width: 100%; height: auto; border: 1px solid #ccc; min-height: 100px;">
        </div>
        <div class="exporter-controls-area">
            <div class="control-group">
                <label for="${MODAL_ID}Width">Width (px)</label>
                <div class="number-input-wrapper">
                     <input type="number" id="${MODAL_ID}Width" value="800" min="50" max="8000" step="10">
                </div>
            </div>
            <div class="control-group">
                <label for="${MODAL_ID}Height">Height (px)</label>
                 <div class="number-input-wrapper">
                    <input type="number" id="${MODAL_ID}Height" value="400" min="50" max="8000" step="10">
                 </div>
            </div>
            <div class="control-group">
                <label for="${MODAL_ID}Quality">Quality (Compression: higher = larger file)</label>
                <div class="range-container">
                    <input type="range" id="${MODAL_ID}Quality" min="10" max="100" value="95" step="5">
                    <span id="${MODAL_ID}QualityValue" class="range-value-display">95%</span>
                </div>
            </div>
            <label class="checkbox-label control-group" style="margin-top: 10px;">
                <input type="checkbox" id="${MODAL_ID}Transparent">
                <span>Transparent Background</span>
            </label>
            <p style="font-size: 0.85em; color: #666; margin-top: 15px;">Adjust dimensions and quality. The preview updates automatically.</p>
        </div>
    </div>
    <div class="modal-footer">
        <button id="${MODAL_ID}CancelBtn" class="modal-btn modal-btn-cancel">Cancel</button>
        <button id="${MODAL_ID}ExportBtn" class="modal-btn modal-btn-primary">Export PNG</button>
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
         console.log('[PNG UI] Styles Injected.');
    }
}

function injectModalHTML() {
    if (document.getElementById(MODAL_ID)) return; // Already injected
    const container = document.createElement('div');
    container.innerHTML = MODAL_HTML.trim();
    const modalElement = container.firstChild;
    if (modalElement instanceof Node) {
        document.body.appendChild(modalElement);
        console.log('[PNG UI] Modal HTML Injected.');
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
    qualityInput = document.getElementById(`${MODAL_ID}Quality`); if (!qualityInput) return false;
    qualityDisplay = document.getElementById(`${MODAL_ID}QualityValue`); if (!qualityDisplay) return false;
    transparentCheckbox = document.getElementById(`${MODAL_ID}Transparent`); if (!transparentCheckbox) return false;
    console.log('[PNG UI] Modal elements queried successfully.');
    return true; // All essential elements found
}

function openModal() {
    if (!isInitialized || !modal) { const msg = "PNG exporter UI not ready or missing."; console.error(`[PNG UI] ${msg}`); if (typeof showAlert === 'function') showAlert(msg, "error"); throw new Error(msg); }
    console.log("[PNG UI] Opening Modal...");
    syncExportSettings(); // Sync settings from main UI *before* showing
    modal.style.display = 'flex';
    modal.classList.add('active'); // Use class for activation
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    updatePreview(); // Generate initial preview
}

function closeModal() {
    if (!modal) return;
    modal.style.display = 'none';
    modal.classList.remove('active');
    document.body.style.overflow = '';
    // Clean up preview blob URL if needed? generateConsistentPreview handles its own cleanup
    console.log("[PNG UI] Modal closed.");
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

/** Update the preview image */
const updatePreview = debounce(() => {
    if (!isInitialized) return; // Don't run if not ready
    console.log("[PNG UI] Updating preview...");

    const options = {
        width: parseInt(widthInput?.value) || 400, // Use smaller preview dimensions if desired
        height: parseInt(heightInput?.value) || 300,
        quality: (parseInt(qualityInput?.value) || 95) / 100,
        transparentBackground: transparentCheckbox?.checked || false
    };

    generateConsistentPreview(options, previewImage, loadingIndicator, 'png')
        .then(result => {
             console.log("[PNG UI] Preview generation successful.");
             // UI update (loading hide, image display) is handled within generateConsistentPreview
        })
        .catch(error => {
             console.error('[PNG UI] Preview generation failed:', error);
             // Error state is handled within generateConsistentPreview
             if (typeof showAlert === 'function') showAlert(`Preview failed: ${error.message}`, 'warning');
        });
}, 300); // Debounce preview updates slightly


/** Handle final export */
async function handleExport() {
    if (!isInitialized || !modal) return;
    console.log("[PNG UI] Export button clicked.");

    // Disable button, show progress (maybe reuse loading indicator?)
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    loadingIndicator.style.display = 'flex'; // Show loading
    const progressTextEl = loadingIndicator.querySelector('.progress-text') || loadingIndicator;
    progressTextEl.textContent = 'Generating final PNG...';


    // Get final values FROM MODAL INPUTS
    const options = {
        width: parseInt(widthInput?.value) || 800,
        height: parseInt(heightInput?.value) || 400,
        quality: (parseInt(qualityInput?.value) || 95) / 100,
        transparentBackground: transparentCheckbox?.checked || false
    };
    console.log("[PNG UI] Final export options:", options);


    try {
        // Use the CORE export function, not the UI one
        const blob = await exportAsPNGCore(options); // Assuming core function is named this or similar
        console.log(`[PNG UI] Final PNG generated. Size: ${(blob.size / 1024).toFixed(1)} KB`);


        // Trigger download using global Util function if available
        let filename = 'logo.png';
        if (typeof window.Utils?.getLogoFilenameBase === 'function') {
             filename = window.Utils.getLogoFilenameBase() + '.png';
        } else { // Basic fallback
             const logoText = document.querySelector('.logo-text')?.textContent || 'logo';
             filename = logoText.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) + '.png';
        }
         console.log(`[PNG UI] Triggering download for: ${filename}`);

         if (typeof window.Utils?.downloadBlob === 'function') {
            window.Utils.downloadBlob(blob, filename);
        } else {
            triggerDownloadFallback(blob, filename); // Use fallback if global missing
        }

        // Notify success (use global function)
        if (typeof window.notifyExportSuccess === 'function') {
             window.notifyExportSuccess('PNG', filename);
        } else if(typeof showToast === 'function'){
             showToast({ message: `Exported ${filename}`, type: 'success' });
        } else { console.log(`Exported ${filename}`); }

        closeModal();

    } catch (error) {
        console.error("[PNG UI] Export process failed:", error);
        if (typeof showAlert === 'function') showAlert(`PNG Export failed: ${error.message}`, 'error');
    } finally {
        // Re-enable button, hide progress
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export PNG';
        loadingIndicator.style.display = 'none';
    }
}

/** Basic fallback for downloading a blob */
function triggerDownloadFallback(blob, filename) {
    console.warn("[PNG UI] Using fallback download method.");
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none"; a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 250);
    } catch (err) { console.error(`[PNG UI Fallback Download] Error:`, err); showAlert(`Download failed: ${err.message}`, "error"); }
}


/** Attach event listeners */
function attachModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached === 'true') return; // Prevent double-binding
    console.log('[PNG UI] Attaching event listeners...');

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    exportBtn?.addEventListener('click', handleExport);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); }); // Close on overlay click

    // Update preview on input change (debounced)
    widthInput?.addEventListener('input', updatePreview);
    heightInput?.addEventListener('input', updatePreview);
    qualityInput?.addEventListener('input', () => {
         if(qualityDisplay) qualityDisplay.textContent = `${qualityInput.value}%`;
         updatePreview(); // Trigger preview update on quality change
    });
    transparentCheckbox?.addEventListener('change', updatePreview);

    // Add Escape key listener
     document.addEventListener('keydown', handleEscapeKey);


    modal.dataset.listenersAttached = 'true';
    console.log('[PNG UI] Event listeners attached.');
}

/** Remove event listeners */
function removeModalEventListeners() {
    if (!modal || modal.dataset.listenersAttached !== 'true') return;
     console.log('[PNG UI] Removing event listeners...');
    closeBtn?.removeEventListener('click', closeModal);
    cancelBtn?.removeEventListener('click', closeModal);
    exportBtn?.removeEventListener('click', handleExport);
    modal?.removeEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    widthInput?.removeEventListener('input', updatePreview);
    heightInput?.removeEventListener('input', updatePreview);
    qualityInput?.removeEventListener('input', updatePreview); // May need specific handler if only display updates
    transparentCheckbox?.removeEventListener('change', updatePreview);
     document.removeEventListener('keydown', handleEscapeKey);


    modal.removeAttribute('data-listeners-attached');
     console.log('[PNG UI] Event listeners removed.');
}

/** Handle escape key press */
function handleEscapeKey(event) {
     if (event.key === 'Escape' && modal?.classList.contains('active')) {
        console.log("[PNG UI] Escape key pressed, closing modal.");
        closeModal();
     }
}

/** Sync settings from main UI to modal */
function syncExportSettings() {
    if (!isInitialized || !modal) {
        console.warn('[PNG UI] Cannot sync settings, UI not ready.');
        return;
    }
    console.log('[PNG UI] Syncing settings from main UI...');
    try {
        // Read from main settings elements in Advanced Tab
        const mainWidth = document.getElementById('exportWidth')?.value || '800';
        const mainHeight = document.getElementById('exportHeight')?.value || '400';
        const mainQuality = document.getElementById('exportQuality')?.value || '95';
        const mainTransparent = document.getElementById('exportTransparent')?.checked || false;

        // Apply to modal inputs
        if (widthInput) widthInput.value = mainWidth;
        if (heightInput) heightInput.value = mainHeight;
        if (transparentCheckbox) transparentCheckbox.checked = mainTransparent;
        if (qualityInput) {
            qualityInput.value = mainQuality;
            if (qualityDisplay) qualityDisplay.textContent = `${mainQuality}%`;
        }
        console.log(`[PNG UI] Settings synced: W=${mainWidth}, H=${mainHeight}, Q=${mainQuality}, T=${mainTransparent}`);
    } catch (e) {
        console.error(`[PNG UI] Error syncing settings:`, e);
    }
}

/** Initialize the UI (inject, query, attach listeners) */
function initializeUI() {
    if (isInitialized) return Promise.resolve(true);
    console.log('[PNG UI] Initializing...');
    return new Promise((resolve, reject) => {
         try {
             injectStyles(); // Inject CSS if needed
             injectModalHTML(); // Inject HTML if needed
             if (queryModalElements()) { // Find elements
                 attachModalEventListeners(); // Attach listeners
                 isInitialized = true;
                 console.log('[PNG UI] Initialization complete.');
                 resolve(true);
             } else {
                 throw new Error("Failed to find all necessary modal elements after injection.");
             }
         } catch (error) {
             console.error("[PNG UI] Initialization failed:", error);
             isInitialized = false;
             reject(error);
         }
    });
}

// --- PUBLIC EXPORTED FUNCTIONS ---

/**
 * Core PNG export logic (no UI interaction).
 * Relies on the centralized rendering pipeline.
 * @param {object} options - Export options { width, height, quality, transparentBackground }.
 * @returns {Promise<Blob>} - A promise resolving with the PNG blob.
 */
async function exportAsPNGCore(options = {}) {
    console.log('[PNG Core] exportAsPNGCore called with options:', options);
    const defaults = {
        width: 800,
        height: 400,
        quality: 0.95, // Note: quality doesn't really apply to PNG in canvas.toBlob
        transparentBackground: false
    };
    const config = { ...defaults, ...options };

    try {
         console.log('[PNG Core] Generating base SVG...');
         const svgBlob = await generateSVGBlob({
             width: config.width,
             height: config.height,
             transparentBackground: config.transparentBackground
         });
         console.log('[PNG Core] Converting SVG to PNG...');
         const pngBlob = await convertSVGtoPNG(svgBlob, config);
         console.log('[PNG Core] PNG Blob generated successfully.');
         return pngBlob;
    } catch (error) {
         console.error('[PNG Core] Failed to export as PNG:', error);
         throw error; // Re-throw
    }
}


/**
 * Initializes and displays the PNG export UI modal.
 * This is the main function to call from external modules (like exportHandler).
 * @returns {Promise<void>} Resolves when the modal is shown, rejects on init error.
 */
export async function exportPNGWithUI() {
    console.log('[PNG Exporter] exportPNGWithUI() called...');
    try {
        await initializeUI(); // Ensure UI is ready
        if (isInitialized) {
             openModal(); // Open the modal
        } else {
             throw new Error("PNG UI could not be initialized.");
        }
        // The promise now resolves when the modal is open.
        // The actual export result is handled internally by the modal's export button.
        return Promise.resolve();
    } catch (error) {
        console.error("[PNG Exporter] Cannot proceed with export:", error);
        if(typeof showAlert === 'function') showAlert(`Cannot open PNG exporter: ${error.message}`, 'error');
        // Reject the promise to signal failure to the caller
        return Promise.reject(error);
    }
}