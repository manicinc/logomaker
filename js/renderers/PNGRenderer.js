/**
 * PNGRenderer.js
 * ====================================================
 * Provides PNG export functionality. Prioritizes direct canvas snapshotting
 * (requires html2canvas.js) for WYSIWYG results, with SVG-based rendering
 * as a user-selectable alternative/fallback.

 */

// Import core functions from RendererCore
// Ensure RendererCore v2.8+ is used (with global normalizeColor)
import { generateConsistentPreview, generateSVGBlob, convertSVGtoPNG } from './RendererCore.js';
import { captureLogoWithHTML2Canvas } from '../utils/html2Canvas.js';


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
/* Styles for PNG exporter modal (v2.2) */
.png-exporter-modal .exporter-preview-image {
    background: repeating-conic-gradient(var(--border-subtle, #ccc) 0% 25%, var(--panel-bg-opaque, #fff) 0% 50%) 50% / 20px 20px;
    background-size: 20px 20px; /* Ensure size */
}
.png-exporter-modal .modal-content { max-width: 900px; } /* Consider adjusting based on content */
.png-exporter-modal .exporter-preview-loading {
    position: absolute; inset: 0;
    background: var(--modal-backdrop-bg, rgba(255, 255, 255, 0.8));
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    z-index: 5; color: var(--text-color, #333); border-radius: inherit; text-align: center;
}
.png-exporter-modal .exporter-preview-loading .spinner {
    border: 4px solid rgba(var(--accent-color-rgb, 255, 20, 147), 0.2);
    border-left-color: var(--accent-color, #ff1493);
    border-radius: 50%; width: 30px; height: 30px;
    animation: png-spin 1s linear infinite; margin-bottom: 10px;
}
@keyframes png-spin { to { transform: rotate(360deg); } }

/* Styles for Export Method Selection */
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
`;

// --- HTML Structure ---
const MODAL_HTML = `
<div id="${MODAL_ID}" class="modal-overlay png-exporter-modal" role="dialog" aria-modal="true" aria-labelledby="${MODAL_ID}Title" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
        <svg class="modal-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>
        <h3 class="modal-title" id="${MODAL_ID}Title">Export as PNG</h3>
        <button id="${MODAL_ID}CloseBtn" class="modal-close-btn" aria-label="Close modal">&times;</button>
    </div>
    <div class="modal-body">
        <div class="exporter-preview-area" style="position: relative;">
             <div id="${MODAL_ID}Loading" class="exporter-preview-loading" style="display: none;">
                 <div class="spinner"></div>
                 <div class="progress-text">Generating preview...</div>
             </div>
             <img id="${MODAL_ID}PreviewImage" class="exporter-preview-image" src="#" alt="PNG Preview" style="display: none; max-width: 100%; height: auto; border: 1px solid var(--border-color, #ccc); min-height: 100px;">
        </div>
        <div class="exporter-controls-area">
            <div class="control-group"><label for="${MODAL_ID}Width">Width (px)</label><div class="number-input-wrapper"><input type="number" id="${MODAL_ID}Width" value="800" min="50" max="8000" step="10"></div></div>
            <div class="control-group"><label for="${MODAL_ID}Height">Height (px)</label><div class="number-input-wrapper"><input type="number" id="${MODAL_ID}Height" value="400" min="50" max="8000" step="10"></div></div>
            <div class="control-group"><label for="${MODAL_ID}Quality">Quality (Higher = larger file, PNG lossless)</label><div class="range-container"><input type="range" id="${MODAL_ID}Quality" min="10" max="100" value="95" step="5"><span id="${MODAL_ID}QualityValue" class="range-value-display">95%</span></div></div>
            <label class="checkbox-label control-group" style="margin-top: 10px;"><input type="checkbox" id="${MODAL_ID}Transparent"><span>Transparent Background</span></label>

            <fieldset class="png-export-method-selector">
                <legend>Export Method:</legend>
                <div class="radio-option">
                    <input type="radio" id="pngExportMethodSnapshot" name="pngExportMethod" value="snapshot" checked>
                    <label for="pngExportMethodSnapshot">
                        Snapshot (Recommended)
                        <span>Captures exact appearance from live preview (WYSIWYG). Requires local <code>html2canvas.js</code> library.</span>
                    </label>
                </div>
                <div class="radio-option">
                    <input type="radio" id="pngExportMethodSvgRender" name="pngExportMethod" value="svgRender">
                    <label for="pngExportMethodSvgRender">
                        SVG Render (Vector Source)
                        <span>Generates from SVG data. Appearance may differ for complex CSS/effects, but fully offline.</span>
                    </label>
                </div>
            </fieldset>
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
    // New radio buttons
    snapshotRadio = document.getElementById('pngExportMethodSnapshot'); if (!snapshotRadio) return false;
    svgRenderRadio = document.getElementById('pngExportMethodSvgRender'); if (!svgRenderRadio) return false;

    console.log('[PNG UI] Modal elements queried successfully.');
    return true; // All essential elements found
}

function openModal() {
    if (!isInitialized || !modal) { const msg = "PNG exporter UI not ready or missing."; console.error(`[PNG UI] ${msg}`); if (typeof showAlert === 'function') showAlert(msg, "error"); throw new Error(msg); }
    console.log("[PNG UI] Opening Modal...");
    syncExportSettings(); // Sync settings from main UI *before* showing
    modal.style.display = 'flex';
     requestAnimationFrame(() => { modal.classList.add('active'); }); // Use class for activation/animation
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    updatePreview(); // Generate initial preview (always uses SVG render method)
}

function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    modal.addEventListener('transitionend', () => {
        if (!modal.classList.contains('active')) modal.style.display = 'none'; document.body.style.overflow = '';
    }, { once: true });
    setTimeout(() => { if (!modal.classList.contains('active')) { modal.style.display = 'none'; document.body.style.overflow = ''; }}, 500);
    console.log("[PNG UI] Modal closed.");
}

/** Debounce function */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func.apply(this, args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const updatePreview = debounce(async () => { // Make async
    if (!isInitialized) return;

    const selectedMethod = snapshotRadio?.checked ? 'snapshot' : 'svgRender';
    console.log(`[PNG UI] Updating preview using method: ${selectedMethod}...`);

    const options = {
        width: parseInt(widthInput?.value) || 400,
        height: parseInt(heightInput?.value) || 300,
        transparentBackground: transparentCheckbox?.checked || false,
        // Quality isn't really used for preview blob/dataURL generation typically
    };

    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (previewImage) { previewImage.style.display = 'none'; previewImage.removeAttribute('src'); }

    try {
        let previewBlob = null;
        if (selectedMethod === 'snapshot') {
            // --- Use Snapshot Method for Preview ---
            if (typeof captureLogoWithHTML2Canvas !== 'function') {
                throw new Error("Snapshot preview failed: html2canvas function not found.");
            }
            const elementToSnapshot = document.querySelector('#previewContainer'); // Or the appropriate element
            if (!elementToSnapshot) throw new Error("Snapshot preview failed: Preview container not found.");

             // Set loading text specifically for snapshot
             const progressTextEl = loadingIndicator?.querySelector('.progress-text') || loadingIndicator;
             if(progressTextEl) progressTextEl.textContent = 'Generating snapshot preview...';

            // Use smaller dimensions for snapshot preview to keep it fast
            const snapshotOptions = { ...options, scale: window.devicePixelRatio }; // Lower scale for preview speed?
            const canvas = await captureLogoWithHTML2Canvas(elementToSnapshot, snapshotOptions);
            previewBlob = await new Promise((resolve, reject) => {
                 canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed for preview')), 'image/png');
             });
             console.log("[PNG UI] Snapshot preview generated.");
             // --- End Snapshot ---
        } else {
             // --- Use SVG Render Method for Preview ---
             const result = await generateConsistentPreview(options, previewImage, loadingIndicator, 'png');
             previewBlob = result.blob; // Already handled UI updates
              console.log("[PNG UI] SVG Render preview generated.");
             // --- End SVG Render ---
        }

        // Update image source if snapshot method was used (consistent preview handles its own update)
         if (selectedMethod === 'snapshot' && previewImage && previewBlob) {
             const dataUrl = await RendererCore.blobToDataURL(previewBlob); // Assuming RendererCore is accessible or helper imported
             previewImage.onload = () => { console.log(`[PNG UI] Snapshot Preview loaded.`); if (loadingIndicator) loadingIndicator.style.display = 'none'; previewImage.style.display = 'block'; previewImage.alt = `PNG Preview (Snapshot)`; };
             previewImage.onerror = () => { console.error(`[PNG UI] Failed to load snapshot preview.`); if (loadingIndicator) loadingIndicator.style.display = 'none'; previewImage.style.display = 'block'; previewImage.alt = `PNG Preview Failed (Snapshot)`; };
             previewImage.src = dataUrl;
         } else if (selectedMethod === 'snapshot' && loadingIndicator) {
             // Hide loading if snapshot finished but image element was missing
             loadingIndicator.style.display = 'none';
         }

    } catch (error) {
        console.error(`[PNG UI] Preview generation failed (${selectedMethod} method):`, error);
         if (typeof showAlert === 'function') showAlert(`Preview failed: ${error.message}`, 'warning');
        if (loadingIndicator) { loadingIndicator.style.display = 'flex'; (loadingIndicator.querySelector('.progress-text') || loadingIndicator).textContent = "Preview Failed!"; }
        if (previewImage) { previewImage.style.display = 'none'; previewImage.alt = "Preview Failed"; }
    }

}, 300); // Debounce remains

/** Simple delay helper */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Core PNG export logic via direct canvas snapshot. (v2.3)
 * Uses enhanced HTML2Canvas implementation for better text and style handling.
 */
async function exportViaSnapshotCore(options = {}) {
    console.log('[PNG Core Snapshot v2.3] Attempting export with enhanced HTML2Canvas. Options:', options);
    const { width = 800, height = 400, quality = 0.95, transparentBackground = false } = options;

    if (typeof html2canvas !== 'function') {
        console.error("[PNG Core Snapshot] html2canvas library is not loaded or available.");
        throw new Error("Snapshotting requires the 'html2canvas.js' library, which was not found. Ensure it's included locally or use the SVG Render method.");
    }

    const elementToSnapshot = document.querySelector('#previewContainer');
    if (!elementToSnapshot) throw new Error("Could not find '#previewContainer' to snapshot.");
    
    console.log('[PNG Core Snapshot] Using enhanced HTML2Canvas implementation...');

    try {
        // Use our improved HTML2Canvas implementation
        const captureOptions = {
            width: width,
            height: height,
            scale: window.devicePixelRatio * 2, // Higher quality
            backgroundColor: transparentBackground ? null : undefined,
            useCORS: true,
            allowTaint: true
        };
        
        // This uses our enhanced implementation
        const canvas = await captureLogoWithHTML2Canvas(elementToSnapshot, captureOptions);
        console.log(`[PNG Core Snapshot] Enhanced capture successful. Canvas size: ${canvas.width}x${canvas.height}`);

        // Handle resizing if needed
        let finalCanvas = canvas;
        if (canvas.width !== width || canvas.height !== height) {
             console.warn(`[PNG Core Snapshot] Resizing snapshot canvas from ${canvas.width}x${canvas.height} to target ${width}x${height}.`);
             finalCanvas = document.createElement('canvas'); 
             finalCanvas.width = width; 
             finalCanvas.height = height;
             const ctx = finalCanvas.getContext('2d'); 
             if (!ctx) throw new Error("Failed to get canvas context");
             ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
        }

        // Convert to blob
        return new Promise((resolve, reject) => {
            finalCanvas.toBlob(blob => { 
                if (blob) resolve(blob); 
                else reject(new Error('Canvas toBlob failed')); 
            }, 'image/png', quality);
        });

    } catch (error) {
        console.error('[PNG Core Snapshot] Enhanced HTML2Canvas execution failed:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('SecurityError')) { 
            throw new Error("Snapshot failed: Cross-origin security restriction (fonts/images?)."); 
        }
        else if (errorMsg.includes('Timeout')) { 
            throw new Error("Snapshot timed out. Logo might be too complex."); 
        }
        else { 
            throw new Error(`Snapshot failed: ${errorMsg}`); 
        }
    }
}

/** Handle final export */
async function handleExport() {
    if (!isInitialized || !modal) return;
    console.log("[PNG UI] Export button clicked.");

    exportBtn.disabled = true; exportBtn.textContent = 'Exporting...'; loadingIndicator.style.display = 'flex';
    const progressTextEl = loadingIndicator.querySelector('.progress-text') || loadingIndicator;

    const options = {
        width: parseInt(widthInput?.value) || 800, height: parseInt(heightInput?.value) || 400,
        quality: (parseInt(qualityInput?.value) || 95) / 100, transparentBackground: transparentCheckbox?.checked || false
    };
    const selectedMethod = snapshotRadio?.checked ? 'snapshot' : 'svgRender';
    console.log(`[PNG UI] Final export options:`, options, `Method: ${selectedMethod}`);

    let blob = null; let exportError = null;

    try {
        if (selectedMethod === 'snapshot') {
            progressTextEl.textContent = 'Taking snapshot...';
            try {
                blob = await exportViaSnapshotCore(options);
                console.log(`[PNG UI] Snapshot successful.`);
            } catch (snapshotError) {
                exportError = snapshotError;
                console.error("[PNG UI] Snapshot export failed:", snapshotError);
                let errorDetail = snapshotError.message;
                showAlert(`Snapshot Failed: ${errorDetail}\n\nTry the 'SVG Render' method instead or check console.`, 'error');
                // STOP export if snapshot fails
            }
        } else { // svgRender method
            progressTextEl.textContent = 'Generating via SVG...';
            try {
                 blob = await exportAsPNGCore(options); // Uses SVG->Canvas
                 console.log(`[PNG UI] SVG Render successful.`);
            } catch (svgRenderError) {
                 exportError = svgRenderError;
                 console.error("[PNG UI] SVG Render export failed:", svgRenderError);
                 showAlert(`SVG Render method failed: ${svgRenderError.message}`, 'error');
            }
        }

        // --- Download if successful (blob exists AND no error occurred) ---
        if (blob && !exportError) {
            progressTextEl.textContent = 'Preparing download...';
            let filename = 'logo.png';
            if (typeof window.Utils?.getLogoFilenameBase === 'function') { filename = window.Utils.getLogoFilenameBase() + '.png'; }
            else { const lt = document.querySelector('.logo-text')?.textContent || 'logo'; filename = lt.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) + '.png'; }

            console.log(`[PNG UI] Triggering download for: ${filename}`);
            if (typeof window.Utils?.downloadBlob === 'function') { window.Utils.downloadBlob(blob, filename); }
            else { triggerDownloadFallback(blob, filename); }

            if (typeof window.notifyExportSuccess === 'function') { window.notifyExportSuccess('PNG', filename); }
            else if(typeof showToast === 'function'){ showToast({ message: `Exported ${filename}`, type: 'success' }); }

            closeModal();
        }
        // Error alerts are shown within the try blocks

    } catch (generalError) {
        console.error("[PNG UI] Unexpected error during export:", generalError);
        if (!exportError) { showAlert(`An unexpected error occurred: ${generalError.message}`, 'error'); }
    } finally {
        exportBtn.disabled = false; exportBtn.textContent = 'Export PNG'; loadingIndicator.style.display = 'none';
        console.log("[PNG UI] Export handle finished.");
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
    if (!modal || modal.dataset.listenersAttached === 'true') return;
    console.log('[PNG UI] Attaching event listeners...');

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    exportBtn?.addEventListener('click', handleExport);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Update preview on dimension/transparency change (debounced)
    widthInput?.addEventListener('input', updatePreview);
    heightInput?.addEventListener('input', updatePreview);
    transparentCheckbox?.addEventListener('change', updatePreview);

    // Quality slider only updates display, not preview
    qualityInput?.addEventListener('input', () => {
         if(qualityDisplay) qualityDisplay.textContent = `${qualityInput.value}%`;
         // No need to call updatePreview() here unless quality affects SVG render somehow
    });

    // Radio buttons don't need to update preview, only affect final export
    // snapshotRadio?.addEventListener('change', () => console.log('Export method: Snapshot'));
    // svgRenderRadio?.addEventListener('change', () => console.log('Export method: SVG Render'));

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
    qualityInput?.removeEventListener('input', updatePreview); // Might need specific handler
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
    if (!isInitialized || !modal) { console.warn('[PNG UI] Cannot sync settings, UI not ready.'); return; }
    console.log('[PNG UI] Syncing settings from main UI...');
    try {
        const mainWidth = document.getElementById('exportWidth')?.value || '800';
        const mainHeight = document.getElementById('exportHeight')?.value || '400';
        const mainQuality = document.getElementById('exportQuality')?.value || '95';
        const mainTransparent = document.getElementById('exportTransparent')?.checked || false;

        if (widthInput) widthInput.value = mainWidth;
        if (heightInput) heightInput.value = mainHeight;
        if (transparentCheckbox) transparentCheckbox.checked = mainTransparent;
        if (qualityInput) {
            qualityInput.value = mainQuality;
            if (qualityDisplay) qualityDisplay.textContent = `${mainQuality}%`;
        }
        // Default export method to snapshot
        if (snapshotRadio) snapshotRadio.checked = true;

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
             injectStyles();
             injectModalHTML();
             if (queryModalElements()) {
                 attachModalEventListeners();
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
 * Uses SVG-based rendering. Snapshot logic is separate.
 * @param {object} options - Export options { width, height, quality, transparentBackground }.
 * @returns {Promise<Blob>} - A promise resolving with the PNG blob.
 */
async function exportAsPNGCore(options = {}) {
    console.log('[PNG Core SVG Render] exportAsPNGCore called with options:', options);
    const defaults = { width: 800, height: 400, quality: 0.95, transparentBackground: false };
    const config = { ...defaults, ...options };

    try {
         console.log('[PNG Core SVG Render] Generating base SVG...');
         const svgBlob = await generateSVGBlob({
             width: config.width, height: config.height, transparentBackground: config.transparentBackground
         });
         console.log('[PNG Core SVG Render] Converting SVG to PNG...');
         const pngBlob = await convertSVGtoPNG(svgBlob, config); // Pass full config including quality
         console.log('[PNG Core SVG Render] PNG Blob generated successfully.');
         return pngBlob;
    } catch (error) {
         console.error('[PNG Core SVG Render] Failed to export as PNG:', error);
         throw error; // Re-throw
    }
}


/**
 * Initializes and displays the PNG export UI modal.
 * Main function to call from external modules.
 * @returns {Promise<void>} Resolves when modal shown, rejects on init error.
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
        return Promise.resolve(); // Resolve when modal opens
    } catch (error) {
        console.error("[PNG Exporter] Cannot proceed with export:", error);
        if(typeof showAlert === 'function') showAlert(`Cannot open PNG exporter: ${error.message}`, 'error');
        return Promise.reject(error); // Reject on failure
    }
}