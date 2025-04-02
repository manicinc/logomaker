/**
 * SVGRenderer.js (Version 3.0 - Unified with RendererCore)
 * ====================================================
 * Provides SVG export functionality using the centralized rendering pipeline.
 */

import { generateSVGBlob, generateConsistentPreview } from './RendererCore.js';
import { getCurrentStyleConfig } from '../styleSync.js';

/**
 * Exports the logo as SVG with specified options.
 * @param {Object} options - Export options (width, height, transparentBackground)
 * @returns {Promise<Blob>} - Promise resolving with the SVG blob
 */
export function exportAsSVG(options = {}) {
    console.log('[SVG Exporter] exportAsSVG called with options:', options);
    
    return generateSVGBlob(options)
        .then(blob => {
            console.log('[SVG Exporter] SVG Blob generated successfully:', (blob.size / 1024).toFixed(1) + ' KB');
            return blob;
        })
        .catch(error => {
            console.error('[SVG Exporter] Failed:', error);
            throw error; // Re-throw for handling by caller
        });
}

// Expose the core function for other renderers to use
export { generateSVGBlob as _internal_generateSVGBlob };

/**
 * Creates a UI for SVG export with preview
 * @type {HTMLElement}
 */
let svgExportUI = null;

/**
 * Initializes the SVG export UI
 * @returns {Promise<HTMLElement>} - The UI container
 */
function initializeSVGExportUI() {
    return new Promise((resolve, reject) => {
        try {
            if (svgExportUI) {
                resolve(svgExportUI);
                return;
            }
            
            // Create modal container
            const modal = document.createElement('div');
            modal.className = 'modal-overlay svg-exporter-modal';
            modal.id = 'svgExportModal';
            
            // Modal content structure
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <svg class="modal-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                        </svg>
                        <h3 class="modal-title">Export as SVG</h3>
                        <button class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="exporter-preview-area">
                            <img class="exporter-preview-image" src="#" alt="SVG Preview">
                            <div class="exporter-preview-loading hidden">
                                <div class="spinner"></div>
                                <div>Generating preview...</div>
                            </div>
                        </div>
                        <div class="exporter-controls-area">
                            <div class="control-group">
                                <label for="svgExportWidth">Width (px)</label>
                                <div class="number-input-wrapper">
                                    <input type="number" id="svgExportWidth" min="50" max="5000" step="10">
                                </div>
                            </div>
                            <div class="control-group">
                                <label for="svgExportHeight">Height (px)</label>
                                <div class="number-input-wrapper">
                                    <input type="number" id="svgExportHeight" min="50" max="5000" step="10">
                                </div>
                            </div>
                            <label class="checkbox-label">
                                <input type="checkbox" id="svgExportTransparent">
                                <span>Transparent Background</span>
                            </label>
                            <div class="svg-exporter-info-text">
                                <b>Note:</b> SVG exports support all text styles, animations, and effects. 
                                Some complex animations may render differently depending on the viewer.
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-cancel">Cancel</button>
                        <button class="modal-btn modal-btn-primary">Export SVG</button>
                    </div>
                </div>
            `;
            
            // Inject modal into document
            document.body.appendChild(modal);
            
            // Capture references to elements
            const closeBtn = modal.querySelector('.modal-close-btn');
            const cancelBtn = modal.querySelector('.modal-btn-cancel');
            const exportBtn = modal.querySelector('.modal-btn-primary');
            const previewImg = modal.querySelector('.exporter-preview-image');
            const previewLoading = modal.querySelector('.exporter-preview-loading');
            
            // Form fields
            const widthInput = modal.querySelector('#svgExportWidth');
            const heightInput = modal.querySelector('#svgExportHeight');
            const transparentCheckbox = modal.querySelector('#svgExportTransparent');
            
            // Initialize form values from global settings
            const currentConfig = getCurrentStyleConfig();
            widthInput.value = currentConfig.exportWidth || 800;
            heightInput.value = currentConfig.exportHeight || 400;
            transparentCheckbox.checked = currentConfig.transparent || false;
            
            // Setup event listeners
            closeBtn.addEventListener('click', () => modal.classList.remove('active'));
            cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
            
            // Generate preview on form changes
            const updatePreview = () => {
              previewLoading.classList.remove('hidden');
              
              generateConsistentPreview(
                  {
                      width: parseInt(widthInput.value),
                      height: parseInt(heightInput.value),
                      transparentBackground: transparentCheckbox.checked
                  },
                  previewImg,
                  previewLoading,
                  'svg'
              ).catch(error => {
                  console.error('[SVG UI] Preview error:', error);
              });
          };
            
            // Bind events for preview updates
            widthInput.addEventListener('change', updatePreview);
            heightInput.addEventListener('change', updatePreview);
            transparentCheckbox.addEventListener('change', updatePreview);
            
            // Export button handler
            exportBtn.addEventListener('click', () => {
                // Get final export values
                const width = parseInt(widthInput.value);
                const height = parseInt(heightInput.value);
                const transparent = transparentCheckbox.checked;
                
                // Generate final SVG
                exportAsSVG({
                    width,
                    height,
                    transparentBackground: transparent
                })
                .then(blob => {
                    // Download SVG
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const logoText = document.querySelector('.logo-text')?.textContent || 'logo';
                    const filename = logoText.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) + '.svg';
                    
                    a.href = url;
                    a.download = filename;
                    a.click();
                    
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    modal.classList.remove('active');
                    
                    // Show success notification
                    if (typeof window.showToast === 'function') {
                        window.showToast({
                            message: 'SVG exported successfully!',
                            type: 'success'
                        });
                    }
                })
                .catch(error => {
                    console.error('[SVG UI] Export failed:', error.message);
                    if (typeof window.showAlert === 'function') {
                        window.showAlert({
                            message: 'SVG export failed: ' + error.message,
                            type: 'error'
                        });
                    }
                });
            });
            
            // Generate initial preview
            updatePreview();
            
            // Save reference and resolve
            svgExportUI = modal;
            console.log('[SVG UI] Initialized successfully');
            resolve(svgExportUI);
            
        } catch (error) {
            console.error('[SVG UI] Initialization failed:', error);
            reject(error);
        }
    });
}

/**
 * Exports SVG with a user interface
 * @returns {Promise<Blob>} - The exported SVG
 */
export async function exportSVGWithUI() {
    console.log('[SVG Exporter] exportSVGWithUI() called...');
    
    try {
        const modal = await initializeSVGExportUI();
        modal.classList.add('active');
        
        return new Promise((resolve, reject) => {
            const confirmBtn = modal.querySelector('.modal-btn-primary');
            const cancelBtn = modal.querySelector('.modal-btn-cancel');
            const closeBtn = modal.querySelector('.modal-close-btn');
            
            const onConfirm = async () => {
                // Get values from form
                const width = parseInt(modal.querySelector('#svgExportWidth').value);
                const height = parseInt(modal.querySelector('#svgExportHeight').value);
                const transparent = modal.querySelector('#svgExportTransparent').checked;
                
                console.log('[SVG UI] Modal confirmed:', { width, height, transparent });
                
                // Clean up listeners
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onModalClick);
                
                // Generate SVG
                try {
                    const blob = await exportAsSVG({ 
                        width, 
                        height, 
                        transparentBackground: transparent 
                    });
                    resolve(blob);
                } catch (error) {
                    reject(error);
                }
            };
            
            const onCancel = () => {
                // Clean up listeners
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onModalClick);
                modal.classList.remove('active');
                
                reject(new Error('Export cancelled by user'));
            };
            
            const onModalClick = (e) => {
                if (e.target === modal) onCancel();
            };
            
            // Set up listeners
            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            closeBtn.addEventListener('click', onCancel);
            modal.addEventListener('click', onModalClick);
        });
        
    } catch (error) {
        console.error('[SVG UI] Opening Modal failed:', error);
        throw new Error('UI initialization failed: ' + error.message);
    }
}