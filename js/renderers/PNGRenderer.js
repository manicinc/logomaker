/**
 * PNGRenderer.js (Version 3.0 - Unified with RendererCore)
 * ====================================================
 * Provides PNG export functionality using the centralized rendering pipeline.
 */

import { generateSVGBlob, convertSVGtoPNG, generateConsistentPreview } from './RendererCore.js';
import { getCurrentStyleConfig } from '../styleSync.js';

/**
 * Exports the logo as PNG with the specified options
 * @param {Object|HTMLElement} options - Export options or container element
 * @returns {Promise<Blob>} - PNG blob
 */
export function exportAsPNG(options = {}) {
    console.log('[exportAsPNG] Generating PNG:', options);
    
    // Check if options is an HTMLElement (for backward compatibility)
    let exportOptions = {};
    
    if (options instanceof HTMLElement) {
        console.log('[exportAsPNG] Options is an HTMLElement, getting defaults from DOM');
        exportOptions = {
            width: parseInt(document.getElementById('exportWidth')?.value || '800'),
            height: parseInt(document.getElementById('exportHeight')?.value || '400'),
            quality: parseFloat(document.getElementById('exportQuality')?.value || '0.95') / 100,
            transparentBackground: document.getElementById('exportTransparent')?.checked || false
        };
    } else {
        // Options is a regular object
        const defaults = {
            width: parseInt(document.getElementById('exportWidth')?.value || '800'),
            height: parseInt(document.getElementById('exportHeight')?.value || '400'),
            quality: parseFloat(document.getElementById('exportQuality')?.value || '0.95') / 100,
            transparentBackground: document.getElementById('exportTransparent')?.checked || false
        };
        exportOptions = { ...defaults, ...options };
    }
    
    console.log('[exportAsPNG] Final options:', exportOptions);
    
    // Use the centralized pipeline
    return generateSVGBlob({
        width: exportOptions.width,
        height: exportOptions.height,
        transparentBackground: exportOptions.transparentBackground
    })
    .then(svgBlob => {
        // Convert SVG to PNG
        return convertSVGtoPNG(svgBlob, exportOptions);
    })
    .then(pngBlob => {
        console.log(`[exportAsPNG] PNG blob generated (${(pngBlob.size / 1024).toFixed(1)} KB).`);
        return pngBlob;
    });
}

/**
 * Creates a UI for PNG export with preview
 * @type {HTMLElement}
 */
let pngExportUI = null;

/**
 * Initializes the PNG export UI
 * @returns {Promise<HTMLElement>} - The UI container
 */
function initializePNGExportUI() {
    return new Promise((resolve, reject) => {
        try {
            if (pngExportUI) {
                resolve(pngExportUI);
                return;
            }
            
            // Create modal container
            const modal = document.createElement('div');
            modal.className = 'modal-overlay png-exporter-modal';
            modal.id = 'pngExportModal';
            
            // Modal content structure
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <svg class="modal-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <path d="M21 15l-5-5L5 21"></path>
                        </svg>
                        <h3 class="modal-title">Export as PNG</h3>
                        <button class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="exporter-preview-area">
                            <img class="exporter-preview-image" src="#" alt="PNG Preview">
                            <div class="exporter-preview-loading hidden">
                                <div class="spinner"></div>
                                <div>Generating preview...</div>
                            </div>
                        </div>
                        <div class="exporter-controls-area">
                            <div class="control-group">
                                <label for="pngExportWidth">Width (px)</label>
                                <div class="number-input-wrapper">
                                    <input type="number" id="pngExportWidth" min="50" max="5000" step="10">
                                </div>
                            </div>
                            <div class="control-group">
                                <label for="pngExportHeight">Height (px)</label>
                                <div class="number-input-wrapper">
                                    <input type="number" id="pngExportHeight" min="50" max="5000" step="10">
                                </div>
                            </div>
                            <div class="control-group">
                                <label for="pngExportQuality">Quality</label>
                                <div class="range-container">
                                    <input type="range" id="pngExportQuality" min="50" max="100" step="5">
                                    <div class="range-value-display">95%</div>
                                </div>
                            </div>
                            <label class="checkbox-label">
                                <input type="checkbox" id="pngExportTransparent">
                                <span>Transparent Background</span>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-cancel">Cancel</button>
                        <button class="modal-btn modal-btn-primary">Export PNG</button>
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
            const widthInput = modal.querySelector('#pngExportWidth');
            const heightInput = modal.querySelector('#pngExportHeight');
            const qualityInput = modal.querySelector('#pngExportQuality');
            const qualityDisplay = modal.querySelector('.range-value-display');
            const transparentCheckbox = modal.querySelector('#pngExportTransparent');
            
            // Initialize form values from global settings
            const currentConfig = getCurrentStyleConfig();
            widthInput.value = currentConfig.exportWidth || 800;
            heightInput.value = currentConfig.exportHeight || 400;
            qualityInput.value = currentConfig.exportQuality || 95;
            qualityDisplay.textContent = qualityInput.value + '%';
            transparentCheckbox.checked = currentConfig.transparent || false;
            
            // Setup event listeners
            closeBtn.addEventListener('click', () => modal.classList.remove('active'));
            cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
            
            // Update quality display
            qualityInput.addEventListener('input', () => {
                qualityDisplay.textContent = qualityInput.value + '%';
            });
            
            // Generate preview on form changes
            const updatePreview = () => {
              previewLoading.classList.remove('hidden');
              
              generateConsistentPreview(
                  {
                      width: parseInt(widthInput.value),
                      height: parseInt(heightInput.value),
                      quality: parseInt(qualityInput.value) / 100,
                      transparentBackground: transparentCheckbox.checked
                  },
                  previewImg,
                  previewLoading,
                  'png'
              ).catch(error => {
                  console.error('[PNG UI] Preview error:', error);
              });
          };

            // Bind events for preview updates
            widthInput.addEventListener('change', updatePreview);
            heightInput.addEventListener('change', updatePreview);
            qualityInput.addEventListener('change', updatePreview);
            transparentCheckbox.addEventListener('change', updatePreview);
            
            // Export button handler
            exportBtn.addEventListener('click', () => {
                // Get final export values
                const width = parseInt(widthInput.value);
                const height = parseInt(heightInput.value);
                const quality = parseInt(qualityInput.value) / 100;
                const transparent = transparentCheckbox.checked;
                
                // Generate final PNG
                exportAsPNG({
                    width,
                    height,
                    quality,
                    transparentBackground: transparent
                })
                .then(blob => {
                    // Download PNG using utility function if available
                    if (typeof window.Utils?.downloadBlob === 'function') {
                        const logoText = document.querySelector('.logo-text')?.textContent || 'logo';
                        const filename = logoText.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) + '.png';
                        window.Utils.downloadBlob(blob, filename);
                    } else {
                        // Fallback download
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const logoText = document.querySelector('.logo-text')?.textContent || 'logo';
                        const filename = logoText.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) + '.png';
                        
                        a.href = url;
                        a.download = filename;
                        a.click();
                        
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                    
                    modal.classList.remove('active');
                    
                    // Show success notification
                    if (typeof window.showToast === 'function') {
                        window.showToast({
                            message: 'PNG exported successfully!',
                            type: 'success'
                        });
                    }
                })
                .catch(error => {
                    console.error('[PNG UI] Export failed:', error.message);
                    if (typeof window.showAlert === 'function') {
                        window.showAlert({
                            message: 'PNG export failed: ' + error.message,
                            type: 'error'
                        });
                    }
                });
            });
            
            // Generate initial preview
            updatePreview();
            
            // Save reference and resolve
            pngExportUI = modal;
            console.log('[PNG UI] Initialized successfully');
            resolve(pngExportUI);
            
        } catch (error) {
            console.error('[PNG UI] Initialization failed:', error);
            reject(error);
        }
    });
}

/**
 * Exports PNG with a user interface
 * @returns {Promise<Blob>} - The exported PNG
 */
export async function exportPNGWithUI() {
    console.log('[PNG Exporter] exportPNGWithUI() called...');
    
    try {
        const modal = await initializePNGExportUI();
        modal.classList.add('active');
        
        return new Promise((resolve, reject) => {
            const confirmBtn = modal.querySelector('.modal-btn-primary');
            const cancelBtn = modal.querySelector('.modal-btn-cancel');
            const closeBtn = modal.querySelector('.modal-close-btn');
            
            const onConfirm = async () => {
                // Get values from form
                const width = parseInt(modal.querySelector('#pngExportWidth').value);
                const height = parseInt(modal.querySelector('#pngExportHeight').value);
                const quality = parseInt(modal.querySelector('#pngExportQuality').value) / 100;
                const transparent = modal.querySelector('#pngExportTransparent').checked;
                
                // Clean up listeners
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onModalClick);
                
                // Generate PNG
                try {
                    const blob = await exportAsPNG({ 
                        width, 
                        height, 
                        quality,
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
        console.error('[PNG UI] Opening Modal failed:', error);
        throw new Error('UI initialization failed: ' + error.message);
    }
}