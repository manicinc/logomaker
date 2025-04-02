/**
 * @file new_boy/js/renderers/GIFRenderer.js (AnimationExporterUI - Version 11)
 * @module AnimationExporterUI
 * @description Manage the UI modal for exporting logo animations as PNG frames in a ZIP.
 * Injects necessary HTML/CSS dynamically. Exports `exportAsGIF` function
 * to initialize (if needed) and open the modal.
 * *
 * @listens click - Event listeners on modal's internal buttons/overlay.
 * @listens keydown - Global listener for 'Escape' key.
 * @listens input, change - Listeners on modal controls.
 *
 * @fires showAlert - Use global `showAlert` for user feedback.
 * @fires exportAsPNG - Call imported function from PNGRenderer.js.
 * @fires createZip - Call global `createZip` (optional fallback).
 * @fires JSZip - Use global `JSZip` if available.
 *
 * @requires module:PNGRenderer~exportAsPNG
 * @requires global:showAlert
 * @requires global:JSZip - Optional.
 * @requires global:createZip - Optional.
 * @requires DOMElement#previewContainer - Main preview element.
 * @requires DOMElement#exportWidth, exportHeight, exportFrames, exportTransparent, exportFrameRate
 */

// --- IMPORT DEPENDENCIES ---
// *** ENSURE THIS PATH IS CORRECT RELATIVE TO THIS FILE ***
import { exportAsPNG } from './PNGRenderer.js';
import { _internal_generateSVGBlob } from './SVGRenderer.js';
import { generateAnimationFrames, generateConsistentPreview } from './RendererCore.js';

// --- Module Scope Variables ---
let exportCancelled = false;
let previewInterval = null;
let previewFramesDataUrls = [];
let currentPreviewFrameIndex = 0;
let isExporting = false;
let isInitialized = false; // Track if UI is injected and listeners attached
const MODAL_ID = 'gifExporterModal';
const STYLE_ID = 'gifExporterStyles';

// --- DOM Element References --- (Populated by queryModalElements)
let modal = null, closeBtn = null, cancelBtn = null, exportBtn = null;
let previewImage = null, loadingIndicator = null, progressText = null;
let cancelExportBtnModal = null, modalWidthInput = null, modalHeightInput = null;
let modalFramesInput = null, modalTransparentInput = null, modalFrameRateInput = null;
let modalFrameRateValue = null, previewLoadingSpinner = null; // Added spinner ref

// --- CSS (String) ---
// Define the CSS styles required for the modal UI
const MODAL_CSS = `
:root {
    --gif-exporter-accent: #ff1493; /* Deep Pink */
    --gif-exporter-bg-dark: #10101b;
    --gif-exporter-bg-medium: #1f1f30;
    --gif-exporter-text-light: #e8e8ff;
    --gif-exporter-text-medium: #bbb;
    --gif-exporter-border-color: #444;
}
.gif-exporter-modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 10, 20, 0.95); display: none; /* Modified by JS */ justify-content: center; align-items: center; z-index: 1001; padding: 2vh 2vw; box-sizing: border-box; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); overflow: hidden;
}
.gif-exporter-modal-content {
  background: linear-gradient(145deg, var(--gif-exporter-bg-medium), var(--gif-exporter-bg-dark)); color: var(--gif-exporter-text-light); padding: 30px 40px; border-radius: 12px; box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 20, 147, 0.3); width: 100%; height: 100%; max-width: 1200px; max-height: 95vh; position: relative; border: 1px solid var(--gif-exporter-border-color); display: flex; flex-direction: column; overflow: hidden;
}
.gif-exporter-modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--gif-exporter-accent); padding-bottom: 15px; flex-shrink: 0;
}
.gif-exporter-modal-header h2 {
  margin: 0; font-size: 1.8em; font-weight: 700; color: var(--gif-exporter-accent); text-shadow: 0 0 5px rgba(255, 20, 147, 0.5); font-family: 'Orbitron', sans-serif; /* Example */
}
.gif-exporter-modal-close-btn {
  background: none; border: none; color: #aaa; font-size: 2.5em; line-height: 1; cursor: pointer; padding: 0 5px; transition: color 0.3s ease, transform 0.3s ease;
}
.gif-exporter-modal-close-btn:hover { color: var(--gif-exporter-accent); transform: rotate(90deg); }
.gif-exporter-modal-body {
  flex-grow: 1; display: flex; gap: 30px; overflow: hidden; padding-bottom: 20px;
}
.gif-exporter-preview-area {
  flex: 2; display: flex; flex-direction: column; justify-content: center; align-items: center; 
  background-color: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 20px; 
  overflow: hidden; border: 1px solid var(--gif-exporter-border-color); 
  min-height: 300px; position: relative; /* Match the height with other exporters */
}
.gif-exporter-preview-image-container {
  width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; 
  position: relative; background: repeating-conic-gradient(#222 0% 25%, #333 0% 50%) 50% / 20px 20px;
}
.gif-exporter-preview-image {
  max-width: 100%; max-height: 300px; /* Match this with other exporters */
  object-fit: contain; background-color: transparent; 
  border: 1px dashed #555; min-height: 50px; display: block;
}
.gif-exporter-controls-area {
  flex: 1; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; padding-right: 15px; /* border-left: 1px solid var(--gif-exporter-border-color); */ padding-left: 20px;
}
.gif-exporter-controls-area .control-group { display: flex; flex-direction: column; gap: 8px; }
.gif-exporter-controls-area label { font-weight: 500; color: var(--gif-exporter-text-medium); font-size: 0.95em; display: block; margin-bottom: 4px; }
.gif-exporter-controls-area input[type="number"], .gif-exporter-controls-area input[type="range"], .gif-exporter-controls-area select { width: 100%; padding: 8px 12px; background-color: #2a2a3a; border: 1px solid #555; color: var(--gif-exporter-text-light); border-radius: 4px; font-size: 1em; box-sizing: border-box; transition: border-color 0.2s; }
.gif-exporter-controls-area input:focus { border-color: var(--gif-exporter-accent); outline: none; }
.gif-exporter-controls-area input[type="range"] { padding: 0; cursor: pointer; height: 18px; accent-color: var(--gif-exporter-accent); }
.gif-exporter-controls-area .range-container { display: flex; align-items: center; gap: 8px; }
.gif-exporter-controls-area .range-container input[type="range"] { flex-grow: 1; }
.gif-exporter-controls-area .range-container span { font-size: 0.8em; color: var(--gif-exporter-text-medium); min-width: 45px; text-align: right; } /* Increased width */
.gif-exporter-controls-area .checkbox-label { display: flex; align-items: center; cursor: pointer; color: var(--gif-exporter-text-medium); padding: 5px 0; } /* Added padding */
.gif-exporter-controls-area .checkbox-label:hover { color: var(--gif-exporter-text-light); }
.gif-exporter-controls-area input[type="checkbox"] { width: 15px; height: 15px; margin-right: 8px; accent-color: var(--gif-exporter-accent); vertical-align: middle; cursor: pointer; flex-shrink: 0; }
.gif-exporter-controls-area .checkbox-label label { margin-bottom: 0; } /* Reset label margin */
.gif-exporter-modal-footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--gif-exporter-border-color); display: flex; justify-content: flex-end; align-items: center; gap: 15px; flex-shrink: 0; }
.gif-exporter-modal-btn { padding: 10px 22px; font-size: 0.95em; font-weight: 600; border: none; border-radius: 5px; cursor: pointer; transition: all 0.2s ease; text-transform: uppercase; letter-spacing: 0.5px; }
.gif-exporter-modal-btn-primary { background-color: var(--gif-exporter-accent); color: #fff; box-shadow: 0 3px 8px rgba(255, 20, 147, 0.25); }
.gif-exporter-modal-btn-primary:hover:not(:disabled) { background-color: #ff47a3; box-shadow: 0 4px 12px rgba(255, 20, 147, 0.4); transform: translateY(-1px); }
.gif-exporter-modal-btn-primary:disabled { background-color: #7a0a47; cursor: not-allowed; opacity: 0.6; }
.gif-exporter-modal-btn-secondary { background-color: #444; color: #ccc; }
.gif-exporter-modal-btn-secondary:hover { background-color: #555; color: #fff; }
.gif-exporter-loading-indicator { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 10, 20, 0.9); display: none; justify-content: center; align-items: center; z-index: 1002; flex-direction: column; gap: 15px; color: var(--gif-exporter-text-light); text-align: center; border-radius: 12px; font-size: 1.1em; }
.gif-exporter-loading-indicator .progress-text { font-weight: 500; margin-top: 5px; }
.gif-exporter-loading-indicator .cancel-export-btn-modal { margin-top: 15px; padding: 8px 18px; background-color: #cc3333; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; transition: background-color 0.2s ease; display: none; /* Shown by JS */ }
.gif-exporter-loading-indicator .cancel-export-btn-modal:hover { background-color: #ff1a1a; }
.gif-exporter-spinner { border: 4px solid rgba(255, 255, 255, 0.2); border-left-color: var(--gif-exporter-accent); border-radius: 50%; width: 35px; height: 35px; animation: gif-exporter-spin 1s linear infinite; }
@keyframes gif-exporter-spin { to { transform: rotate(360deg); } }
.gif-exporter-controls-area::-webkit-scrollbar { width: 8px; }
.gif-exporter-controls-area::-webkit-scrollbar-track { background: var(--gif-exporter-bg-dark); border-radius: 4px; }
.gif-exporter-controls-area::-webkit-scrollbar-thumb { background-color: var(--gif-exporter-accent); border-radius: 4px; border: 2px solid var(--gif-exporter-bg-dark); }
`;

// --- HTML Structure (String) ---
// Define the complete HTML structure for the modal UI
const MODAL_HTML = `
<div id="${MODAL_ID}" class="gif-exporter-modal-overlay">
  <div class="gif-exporter-modal-content">
    <div class="gif-exporter-modal-header">
      <h2>Animation Exporter</h2>
      <button id="${MODAL_ID}CloseBtn" class="gif-exporter-modal-close-btn" title="Close Export Modal">&times;</button>
    </div>
    <div class="gif-exporter-modal-body">
      <div class="gif-exporter-preview-area">
        <div class="gif-exporter-preview-image-container">
            <div id="${MODAL_ID}PreviewSpinner" class="gif-exporter-preview-spinner" style="display: none;"></div>
            <img id="${MODAL_ID}PreviewImage" src="" alt="Animation Preview Area" class="gif-exporter-preview-image">
        </div>
      </div>
      <div class="gif-exporter-controls-area">
        <div class="control-group">
          <label for="${MODAL_ID}Width">Width (px)</label>
          <input type="number" id="${MODAL_ID}Width" value="800" readonly title="Output width. Adjust in Advanced tab on main page.">
        </div>
        <div class="control-group">
          <label for="${MODAL_ID}Height">Height (px)</label>
          <input type="number" id="${MODAL_ID}Height" value="400" readonly title="Output height. Adjust in Advanced tab on main page.">
        </div>
        <div class="control-group">
          <label for="${MODAL_ID}Frames">Frames (1-60)</label>
          <input type="number" id="${MODAL_ID}Frames" min="1" max="60" value="15" title="Number of PNG frames to generate (more = smoother/larger).">
        </div>
         <div class="control-group">
           <label for="${MODAL_ID}FrameRate">Preview Speed (FPS)</label>
           <div class="range-container">
             <input type="range" id="${MODAL_ID}FrameRate" min="1" max="30" value="10" step="1" title="Adjust ONLY the speed of THIS preview animation.">
             <span id="${MODAL_ID}FrameRateValue" class="range-value-display">10 FPS</span>
           </div>
        </div>
        <div class="control-group checkbox-label">
           <input type="checkbox" id="${MODAL_ID}Transparent">
           <label for="${MODAL_ID}Transparent" title="Export frames with transparent background instead of current style.">Transparent Background</label>
        </div>
        <div class="control-group">
            <p style="font-size: 0.85em; color: var(--gif-exporter-text-medium); margin-top: 10px; line-height: 1.4;">
                <strong>Note:</strong> This exports a ZIP of PNG frames. Use other tools (e.g., ezgif.com) to create a playable GIF/Video from these frames.
            </p>
        </div>
      </div>
    </div>
    <div class="gif-exporter-modal-footer">
      <button id="${MODAL_ID}CancelBtn" class="gif-exporter-modal-btn gif-exporter-modal-btn-secondary">Close</button>
      <button id="${MODAL_ID}ExportBtn" class="gif-exporter-modal-btn gif-exporter-modal-btn-primary">Export Frames as ZIP</button>
    </div>
    <div id="${MODAL_ID}LoadingIndicator" class="gif-exporter-loading-indicator">
        <div class="gif-exporter-spinner"></div>
        <div class="progress-text" id="${MODAL_ID}ProgressText">Preparing...</div>
        <button id="${MODAL_ID}CancelExportBtn" class="cancel-export-btn-modal">Cancel Export</button>
    </div>
  </div>
</div>
`;


// --- Internal Functions ---

/** Inject CSS styles into the document head */
function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const styleElement = document.createElement('style');
    styleElement.id = STYLE_ID;
    styleElement.textContent = MODAL_CSS;
    document.head.appendChild(styleElement);
    console.log('[GIF Exporter UI] Styles Injected.');
}

/** Inject modal HTML structure into the document body */
function injectModalHTML() {
    if (document.getElementById(MODAL_ID)) return;
    const container = document.createElement('div');
    container.innerHTML = MODAL_HTML.trim();
    const modalElement = container.firstChild;
    if (modalElement instanceof Node) {
        if (document.body) {
            document.body.appendChild(modalElement);
            console.log('[GIF Exporter UI] Modal HTML Injected.');
        } else { // Fallback if body isn't ready
            document.addEventListener('DOMContentLoaded', () => {
                if (!document.getElementById(MODAL_ID)) { document.body.appendChild(modalElement); }
            }, { once: true });
        }
    } else { throw new Error("Failed to create modal element from HTML string."); }
}

/** Find and store references to all modal DOM elements after injection */
function queryModalElements() {
    modal = document.getElementById(MODAL_ID); if (!modal) return false;
    closeBtn = document.getElementById(`${MODAL_ID}CloseBtn`); if (!closeBtn) return false;
    cancelBtn = document.getElementById(`${MODAL_ID}CancelBtn`); if (!cancelBtn) return false;
    exportBtn = document.getElementById(`${MODAL_ID}ExportBtn`); if (!exportBtn) return false;
    previewImage = document.getElementById(`${MODAL_ID}PreviewImage`); if (!previewImage) return false;
    loadingIndicator = document.getElementById(`${MODAL_ID}LoadingIndicator`); if (!loadingIndicator) return false;
    progressText = document.getElementById(`${MODAL_ID}ProgressText`); if (!progressText) return false;
    cancelExportBtnModal = document.getElementById(`${MODAL_ID}CancelExportBtn`); if (!cancelExportBtnModal) return false;
    modalWidthInput = document.getElementById(`${MODAL_ID}Width`); if (!modalWidthInput) return false;
    modalHeightInput = document.getElementById(`${MODAL_ID}Height`); if (!modalHeightInput) return false;
    modalFramesInput = document.getElementById(`${MODAL_ID}Frames`); if (!modalFramesInput) return false;
    modalTransparentInput = document.getElementById(`${MODAL_ID}Transparent`); if (!modalTransparentInput) return false;
    modalFrameRateInput = document.getElementById(`${MODAL_ID}FrameRate`); if (!modalFrameRateInput) return false;
    modalFrameRateValue = document.getElementById(`${MODAL_ID}FrameRateValue`); if (!modalFrameRateValue) return false;
    previewLoadingSpinner = document.getElementById(`${MODAL_ID}PreviewSpinner`); // Assign spinner ref
    return true; // All essential elements found
}

/** Reset the cancellation flag */
function resetCancelFlag() { exportCancelled = false; }
/** Show the modal's loading overlay with a message */
function updateModalProgress(message) { if (loadingIndicator && progressText) { loadingIndicator.style.display = 'flex'; progressText.textContent = message; } }
/** Hide the modal's loading overlay */
function hideModalProgress() { if (loadingIndicator) loadingIndicator.style.display = 'none'; }
/** Convert a Blob to a Data URL string */
function blobToDataURL(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.onerror = (err) => reject(new Error(`FileReader error: ${err}`)); reader.readAsDataURL(blob); }); }

/** Open and display the modal */
function openModal() {
    if (!isInitialized || !modal) { const msg = "Animation exporter UI not ready or missing."; console.error(`[GIF Exporter UI] ${msg}`); if (typeof showAlert === 'function') showAlert(msg, "error"); throw new Error(msg); }
    console.log("[GIF Exporter UI] Opening Modal...");
    resetCancelFlag(); isExporting = false; exportBtn.disabled = false; cancelBtn.disabled = false; cancelExportBtnModal.style.display = 'none'; hideModalProgress();
    try { // Sync settings from main page to modal fields
        modalWidthInput.value = document.getElementById('exportWidth')?.value || '800';
        modalHeightInput.value = document.getElementById('exportHeight')?.value || '400';
        modalFramesInput.value = document.getElementById('exportFrames')?.value || '15';
        modalTransparentInput.checked = document.getElementById('exportTransparent')?.checked || false;
        const frameRateValueMain = document.getElementById('exportFrameRate')?.value || '10';
        modalFrameRateInput.value = frameRateValueMain;
        if(modalFrameRateValue) modalFrameRateValue.textContent = `${frameRateValueMain} FPS`;
    } catch (e) { console.error("Error reading settings for GIF modal:", e); if (typeof showAlert === 'function') showAlert("Could not read export settings.", "warning"); }
    modal.style.display = 'flex'; document.body.style.overflow = 'hidden';
    startPreviewLoop(); // Start preview generation
}

/** Close and hide the modal */
function closeModal() {
    if (!modal) return;
    stopPreview(); hideModalProgress();
    modal.style.display = 'none'; document.body.style.overflow = '';
    if (isExporting) cancelExport(); // Attempt to cancel if closing during export
}

async function generatePreviewFrames() {
    try {
        const result = await generateConsistentPreview(
            {
                width: 400,
                height: 200,
                frameCount: Math.min(parseInt(modalFramesInput?.value || 15), 10),
                transparentBackground: modalTransparentInput?.checked || false
            },
            previewImage,
            previewLoadingSpinner,
            'gif'
        );
        
        // Store the data URLs for animation playback
        previewFramesDataUrls = result.dataUrls || [];
        
        // Start the animation if we have frames
        if (previewFramesDataUrls.length > 0) {
            currentPreviewFrameIndex = 0;
            startPreviewLoopLoop();
        }
    } catch (error) {
        console.error('[GIF UI] Preview generation failed:', error);
        previewFramesDataUrls = [];
        if (previewImage) {
            previewImage.alt = "Preview failed.";
        }
    }
}

export function startPreviewLoop() {
    stopPreview(); // Clear any existing interval
    
    if (!previewFramesDataUrls || previewFramesDataUrls.length <= 1) return;
    
    const fps = parseInt(modalFrameRateInput?.value || 10);
    const intervalTime = 1000 / Math.max(1, fps);
    
    previewInterval = setInterval(() => {
        currentPreviewFrameIndex = (currentPreviewFrameIndex + 1) % previewFramesDataUrls.length;
        if (previewImage) previewImage.src = previewFramesDataUrls[currentPreviewFrameIndex];
    }, intervalTime);
}

window.startPreviewLoop = startPreviewLoop;

/** Stop the preview animation loop */
function stopPreview() { if (previewInterval) { clearInterval(previewInterval); previewInterval = null; } }

/**
 * Generate the actual export frames by rendering the logo at different animation states
 * FIXED: Uses the unified SVG-based rendering pipeline for all frames
 * @param {HTMLElement} container - The preview container
 * @param {Object} options - Frame generation options
 * @returns {Promise<Array<Blob>>} - Array of PNG blobs representing animation frames
 */
async function internalExportFrames(container, options = {}) {
    if (!container) throw new Error("Frame Gen Error: Container element missing.");
    
    const { width=800, height=400, frameCount=15, transparent=false, isPreview=false } = options;
    console.log(`[GIF Frames] Creating ${frameCount} animation frames (${width}x${height}). Transparent: ${transparent}`);
    
    try {
        // Use the unified animation frame generator from RendererCore
        const frames = await generateAnimationFrames({
            width,
            height,
            frameCount,
            transparent,
            onProgress: isPreview ? null : (progress, message) => {
                if (typeof updateModalProgress === 'function') {
                    updateModalProgress(message);
                }
            }
        });
        
        if (frames.length === 0) {
            throw new Error("Animation frame generation yielded no results");
        }
        
        console.log(`[GIF Frames] Generated ${frames.length} frame blobs.`);
        return frames;
    } catch (error) {
        console.error('[GIF Frames] Error generating frames:', error);
        throw error;
    }
}

// Export the updated function so it can replace the existing one
export { internalExportFrames };


/**
 * Helper function to get animation duration from CSS
 * @returns {number} Duration in milliseconds
 */
function getAnimationDuration() {
    try {
        const rootStyle = window.getComputedStyle(document.documentElement);
        const durationStr = rootStyle.getPropertyValue('--animation-duration').trim().replace('s', '');
        const parsedDuration = parseFloat(durationStr);
        return !isNaN(parsedDuration) && parsedDuration > 0 ? parsedDuration * 1000 : 2000; // Default 2s
    } catch (e) {
        return 2000; // 2 seconds default
    }
}

/**
 * Helper to apply animation progress to an element
 * @param {HTMLElement} element - The element to animate
 * @param {number} progress - Progress from 0 to 1
 * @param {number} duration - Animation duration in ms
 */
function applyAnimationProgress(element, progress, duration) {
    const originalAnimClass = Array.from(element.classList).find(cls => cls.startsWith('anim-'));
    
    if (!originalAnimClass || originalAnimClass === 'anim-none') {
        // Handle gradient rotation if no animation class
        if (element.style.backgroundImage?.includes('linear-gradient')) {
            const originalGradient = element.style.backgroundImage;
            const gradientMatch = originalGradient.match(/linear-gradient\(([^,]+),/);
            let baseAngle = 45;
            
            if (gradientMatch?.[1].includes('deg')) {
                baseAngle = parseFloat(gradientMatch[1]);
            }
            
            const colorStops = originalGradient.match(/#[0-9a-fA-F]{6,8}|rgba?\([^)]+\)/g) || [];
            const currentAngle = (baseAngle + (progress * 360)) % 360;
            const newGradient = `linear-gradient(${currentAngle}deg, ${colorStops.join(', ')})`;
            
            element.style.backgroundImage = newGradient;
            element.style.backgroundClip = 'text';
            element.style.webkitBackgroundClip = 'text';
            element.style.color = 'transparent';
            element.style.webkitTextFillColor = 'transparent';
        }
    } else {
        // For CSS animations, use animation-delay to control progress
        element.style.animation = 'none';
        void element.offsetWidth; // Force reflow
        
        // Re-apply animation with delay
        element.classList.add(originalAnimClass);
        element.style.animationDuration = `${duration}ms`;
        element.style.animationPlayState = 'paused';
        element.style.animationIterationCount = 'infinite';
        element.style.animationDelay = `-${progress * duration}ms`;
        
        void element.offsetWidth; // Force styles to apply
    }
}


/** Creates the content for the preview.html file included in the ZIP. */
function createHTMLPreview(logoName, frameCount, width, height) {
    const safeLogoName = logoName.replace(/"/g, "&quot;"); // Escape quotes for HTML attribute/content
    // Generate list items for each frame image
    const frameItems = Array.from({length: frameCount}, (_, n) => {
        const frameNum = String(n).padStart(3, '0');
        return `
              <div class="frame" onclick="selectFrame(${n})" title="Go to Frame ${n+1}">
                <img src="${safeLogoName}-frame-${frameNum}.png" alt="Frame ${n+1}" loading="lazy">
                <div class="frame-number">Frame ${n+1}</div>
              </div>`;
    }).join("");

    // Return the full HTML structure
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeLogoName} Animation Preview</title>
    <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: ${width + 60}px; margin: 20px auto; padding: 15px; background: #f0f2f5; color: #333; }
        h1, h2 { text-align: center; color: #1a1a2e; margin-bottom: 1em; }
        .preview-container { text-align: center; margin: 30px 0; padding: 25px; background: #fff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,.1); }
        .animation { margin-bottom: 25px; display: inline-block; max-width: 100%; background: repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50%/20px 20px; }
        .controls { margin-top: 20px; text-align: center; display: flex; justify-content: center; align-items: center; gap: 15px; flex-wrap: wrap; }
        button { padding: 10px 20px; font-size: .95em; background: #ff1493; color: #fff; border: none; border-radius: 5px; cursor: pointer; transition: background .2s; }
        button:hover:not(:disabled) { background: #ff47a3; }
        button:disabled { background: #aaa; cursor: not-allowed; }
        input[type=range] { vertical-align: middle; width: 200px; cursor: pointer; accent-color: #ff1493; }
        .frames { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin: 40px 0; padding: 15px; background: #e8e8ff; border-radius: 8px; }
        .frame { border: 1px solid #ccc; padding: 6px; box-shadow: 0 2px 5px rgba(0,0,0,.1); background: #fff; cursor: pointer; transition: transform .2s, box-shadow .2s; }
        .frame:hover { transform: scale(1.05); box-shadow: 0 4px 10px rgba(0,0,0,.15); }
        .frame img { display: block; max-width: 120px; height: auto; background: repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 50%/10px 10px; }
        .frame-number { text-align: center; font-size: 11px; margin-top: 5px; color: #555; }
        .current-frame { display: block; max-width: 100%; height: auto; width: ${width}px; height: ${height}px; border: 1px solid #ccc; box-shadow: 0 3px 8px rgba(0,0,0,.15); background-color: #fff; background-image: repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%); background-size: 20px 20px; }
        #frameCounter { font-size: .95em; color: #444; min-width: 90px; text-align: left; }
    </style>
</head>
<body>
    <h1>${safeLogoName} Animation Preview</h1>
    <div class="preview-container">
        <div class="animation">
            <img id="currentFrame" class="current-frame" src="${safeLogoName}-frame-000.png" alt="Animation frame for ${safeLogoName}" width="${width}" height="${height}">
        </div>
        <div class="controls">
            <button id="playBtn">Play</button>
            <button id="stopBtn">Stop</button>
            <input type="range" id="frameSlider" min="0" max="${frameCount - 1}" value="0" title="Scrub Frames">
            <span id="frameCounter">Frame: 1/${frameCount}</span>
        </div>
    </div>
    <h2>All Frames (${frameCount})</h2>
    <div class="frames">${frameItems}</div>
    <script>
        const frameCount = ${frameCount};
        const logoName = "${safeLogoName}";
        const currentFrameImg = document.getElementById('currentFrame');
        const frameSlider = document.getElementById('frameSlider');
        const frameCounter = document.getElementById('frameCounter');
        const playBtn = document.getElementById('playBtn');
        const stopBtn = document.getElementById('stopBtn');
        let animationInterval = null;
        let currentFrameIndex = 0;
        const frameRate = 10; // Default playback rate for preview
        const intervalTime = 1000 / frameRate;

        function updateFrame(index) {
             if (index < 0 || index >= frameCount) index = 0; // Wrap around or reset
             currentFrameIndex = index;
             const frameNum = String(index).padStart(3, '0');
             currentFrameImg.src = logoName + '-frame-' + frameNum + '.png';
             frameSlider.value = index;
             frameCounter.textContent = \`Frame: \${index + 1}/\${frameCount}\`;
        }
        function playAnimation() {
             stopAnimation(); // Ensure only one interval runs
             playBtn.disabled = true;
             stopBtn.disabled = false;
             animationInterval = setInterval(() => {
                 currentFrameIndex = (currentFrameIndex + 1) % frameCount;
                 updateFrame(currentFrameIndex);
             }, intervalTime);
        }
        function stopAnimation() {
             if (animationInterval) clearInterval(animationInterval);
             animationInterval = null;
             playBtn.disabled = false;
             stopBtn.disabled = true;
        }
        function selectFrame(index) { stopAnimation(); updateFrame(index); }

        playBtn.addEventListener('click', playAnimation);
        stopBtn.addEventListener('click', stopAnimation);
        frameSlider.addEventListener('input', () => { stopAnimation(); updateFrame(parseInt(frameSlider.value)); });
        stopBtn.disabled = true; // Initially stopped
    <\/script>
</body>
</html>`;
}

/** Creates the content for the info.txt file included in the ZIP. */
function createInfoText(logoText, width, height, frameCount) {
    const date = new Date();
    const safeLogoText = logoText.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30) || 'logo';
    return `LOGO ANIMATION EXPORT INFO
=========================

Logo Text: ${logoText}
Export Date: ${date.toLocaleString()}
Resolution: ${width}x${height}
Frame Count: ${frameCount}
Approx Frame Rate: ~10 FPS (in preview HTML)

Created with Logomaker by Manic.agency
https://manicinc.github.io/logomaker

PACKAGE CONTENTS:
- Individual frames as PNG files (e.g., ${safeLogoText}-frame-###.png)
- An HTML preview file (${safeLogoText}-preview.html) to view the animation locally.
- This info text file.

USAGE INSTRUCTIONS:
- Unzip the downloaded file.
- Open the HTML file in your browser to preview the frame sequence.
- Import the sequence of PNG frames into video editing software (Premiere, DaVinci Resolve, After Effects, Final Cut Pro, etc.). Set frame duration appropriately (e.g., 0.1s per frame for 10 FPS).
- Use an online tool (like ezgif.com's "PNG Sequence to GIF" or "APNG Maker") or desktop software (GIMP, Photoshop, FFmpeg) to combine the PNG frames into an animated GIF or APNG. Adjust frame delay as needed (e.g., 100ms for 10 FPS).

Made with ♥ by Manic.agency
`;
}

/** Creates and downloads a ZIP file using JSZip library or falls back to direct downloads. */
async function createAndDownloadZip(files, zipFilename, updateProgressCallback) {
    const showProgress = (percent, message) => {
        if (typeof updateProgressCallback === 'function') {
            updateModalProgress(message || `Creating ZIP package (${Math.round(percent)}%)...`);
        }
    };

    // Check for JSZip
    if (typeof JSZip === 'function') {
        try {
            console.log("[GIF Exporter] Using JSZip to create package...");
            const zip = new JSZip();
            files.forEach(file => {
                if (exportCancelled) throw new Error("Export cancelled");
                zip.file(file.name, file.blob); // Add each file
            });

            showProgress(0); // Initial progress
            if (exportCancelled) throw new Error("Export cancelled");

            // Generate the ZIP blob
            const zipBlob = await zip.generateAsync(
                { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
                (metadata) => { // Progress callback
                    if (exportCancelled) throw new Error("Export cancelled"); // Check during generation
                    showProgress(metadata.percent);
                }
            );

            if (exportCancelled) throw new Error("Export cancelled"); // Final check before download

            // Use global download helper
             if (typeof downloadBlob === 'function') {
                  triggerDownload(zipBlob, zipFilename); // Use triggerDownload here
             } else {
                 console.error("triggerDownload function is missing!");
                  throw new Error("Download utility function missing.");
             }
            return true; // Indicate success

        } catch (error) {
            if (error.message === "Export cancelled") {
                console.log("[GIF Exporter] ZIP creation cancelled.");
                throw error; // Re-throw cancellation error
            }
            console.error("JSZip error:", error);
            if (typeof showAlert === 'function') showAlert("JSZip failed. Trying fallback (if available)...", "warning");
            // Fall through to potential fallback (or error out if no fallback)
        }
    } else {
        console.warn("JSZip library not found.");
    }

     // --- Fallback --- (Keep the direct download fallback) ---
     if (typeof createZip === 'function' && createZip !== createAndDownloadZip ) { // Ensure it's the fallback from zipUtils.js, not self-reference
          console.log("Trying fallback createZip function...");
          try {
               showProgress(50, "Using fallback zip utility...");
               await createZip(files, zipFilename); // Call the globally defined fallback
               showProgress(100);
               return true;
          } catch (error) {
               console.error("Fallback createZip failed:", error);
               if (typeof showAlert === 'function') showAlert(`Fallback ZIP failed: ${error.message || 'Unknown error'}. Trying direct downloads.`, "warning");
                // Fall through to direct downloads
          }
     } else {
          console.warn("Fallback createZip function (from zipUtils.js) not found.");
          // Fall through to direct downloads if no JSZip and no createZip fallback
     }

     // Final Fallback: Direct Download (if ZIP creation failed)
     if (confirm(`Could not create ZIP automatically. Download all ${files.length} files individually instead? (Check browser pop-up settings)`)) {
          await downloadFilesDirectly(files, showProgress);
          return true; // Indicate that *something* was downloaded
     } else {
          throw new Error("ZIP creation failed and direct download cancelled by user.");
     }
}


/** Helper to trigger a browser download for a blob. */
function triggerDownload(blob, filename) {
    // Use the globally available function if it exists
    if (typeof downloadBlob === 'function') {
         downloadBlob(blob, filename);
         return;
    }
    // Fallback implementation if global function is missing
     console.warn("Using fallback triggerDownload.");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 150); // Cleanup
}

/** Fallback: download files individually, asking user first. */
async function downloadFilesDirectly(files, updateProgressCallback) {
     if (typeof showAlert === 'function') {
          showAlert(`Preparing ${files.length} individual file downloads. Please allow multiple downloads if prompted.`, "warning");
     } else { alert(`Preparing ${files.length} individual file downloads.`); }

     const infoFiles = files.filter(f => !f.name.endsWith('.png'));
     const pngFiles = files.filter(f => f.name.endsWith('.png')).sort((a, b) => a.name.localeCompare(b.name)); // Sort frames

     const allFilesSorted = [...infoFiles, ...pngFiles];

     for (let i = 0; i < allFilesSorted.length; i++) {
          if (exportCancelled) throw new Error("Export cancelled");
          const file = allFilesSorted[i];
          const progressPercent = Math.round((i + 1) / allFilesSorted.length * 100);
          if (updateProgressCallback) {
               updateProgressCallback(progressPercent, `Downloading ${i + 1}/${allFilesSorted.length}: ${file.name}`);
          }
          await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between downloads
          if (exportCancelled) throw new Error("Export cancelled");
          triggerDownload(file.blob, file.name); // Use the local or global trigger
     }
 }


/** Checks frame count and asks for confirmation if high. */
function confirmExportSize(frameCount) {
    if (frameCount > 30) { // Threshold for warning
        return confirm(`Generate ${frameCount} frames? This might take significant time and memory, especially on lower-powered devices. Continue?`);
    }
    return true; // Proceed without confirmation for lower counts
}
/** Handle the export process initiated by the modal button. */
async function handleExport() {
    if (isExporting) { showAlert("Export already in progress.", "warning"); return; }
    const previewContainer = document.getElementById('previewContainer'); if (!previewContainer) { showAlert("Error: Main preview container missing.", "error"); return; }
    const width = parseInt(modalWidthInput.value); const height = parseInt(modalHeightInput.value); const frameCount = parseInt(modalFramesInput.value); const transparent = modalTransparentInput.checked;
    if (isNaN(width) || isNaN(height) || isNaN(frameCount) || width <= 0 || height <= 0 || frameCount <= 0 || frameCount > 60) { showAlert("Invalid export settings (Frames: 1-60).", "error"); return; }
    if (!confirmExportSize(frameCount)) { console.log('[GIF Exporter UI] Export cancelled by user.'); return; }

    isExporting = true; resetCancelFlag(); updateModalProgress("Starting export...");
    exportBtn.disabled = true; cancelBtn.disabled = true; cancelExportBtnModal.disabled = false; cancelExportBtnModal.style.display = 'inline-block';

    try {
        const getFilenameFunc = typeof getLogoFilenameBase === 'function' ? getLogoFilenameBase : () => 'logo';
        const safeLogoText = getFilenameFunc(); // Use helper for consistent naming
        const logoText = document.querySelector('.logo-text')?.textContent || 'logo'; // Get for info text

        updateModalProgress("Generating frames (0%)...");
        const frames = await internalExportFrames(previewContainer, { width, height, frameCount, transparent, isPreview: false });
        if (exportCancelled || frames.length === 0) throw new Error(exportCancelled ? 'Export cancelled' : 'Frame generation failed');

        updateModalProgress("Packaging files...");
        const filesToZip = [];
        frames.forEach((blob, index) => { const pIdx = String(index).padStart(3, '0'); filesToZip.push({ blob, name: `${safeLogoText}-frame-${pIdx}.png` }); });
        filesToZip.push({ blob: new Blob([createHTMLPreview(safeLogoText, frameCount, width, height)], { type: 'text/html' }), name: `${safeLogoText}-preview.html` });
        filesToZip.push({ blob: new Blob([createInfoText(logoText, width, height, frameCount)], { type: 'text/plain' }), name: `${safeLogoText}-info.txt` });

        if (exportCancelled) throw new Error('Export cancelled');
        updateModalProgress("Creating ZIP package (0%)...");
        await createAndDownloadZip(filesToZip, `${safeLogoText}-animation-frames.zip`, updateModalProgress);
        if (exportCancelled) throw new Error('Export cancelled');

        const notifyFunc = typeof notifyExportSuccess === 'function' ? notifyExportSuccess : (f, fn) => showAlert(`${f} Export Complete! File: ${fn}`, 'success');
        notifyFunc('Animation Frames ZIP', `${safeLogoText}-animation-frames.zip`);
        closeModal();

    } catch (error) {
        hideModalProgress();
        if (error.message === 'Export cancelled') { showAlert('Export cancelled by user.', 'info'); }
        else { console.error("[GIF Exporter UI] Export process failed:", error); showAlert(`Animation Export failed: ${error.message}`, 'error'); }
    } finally {
        isExporting = false; hideModalProgress();
        if(exportBtn) exportBtn.disabled = false; if(cancelBtn) cancelBtn.disabled = false;
        if(cancelExportBtnModal) cancelExportBtnModal.style.display = 'none';
        resetCancelFlag();
    }
}

/** Cancel the ongoing export */
function cancelExport() {
    if (isExporting) { console.log('[GIF Exporter UI] Cancel requested.'); exportCancelled = true; updateModalProgress("Cancelling..."); if(cancelExportBtnModal) cancelExportBtnModal.disabled = true; }
    else { console.log('[GIF Exporter UI] No export in progress to cancel.'); }
}

/** Attach event listeners to the modal elements. */
function attachModalEventListeners() {
    if (!modal || modal.getAttribute('data-listeners-attached') === 'true') return;
    closeBtn?.addEventListener('click', closeModal); cancelBtn?.addEventListener('click', closeModal); exportBtn?.addEventListener('click', handleExport); cancelExportBtnModal?.addEventListener('click', cancelExport);
    let previewRestartTimer;
    modalFrameRateInput?.addEventListener('input', () => { if (modalFrameRateValue) modalFrameRateValue.textContent = `${modalFrameRateInput.value} FPS`; clearTimeout(previewRestartTimer); previewRestartTimer = setTimeout(startPreviewLoop, 300); });
    modalFramesInput?.addEventListener('change', () => { clearTimeout(previewRestartTimer); previewRestartTimer = setTimeout(startPreviewLoop, 500); });
    modalTransparentInput?.addEventListener('change', () => { clearTimeout(previewRestartTimer); previewRestartTimer = setTimeout(startPreviewLoop, 300); });
    modal?.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    modal.setAttribute('data-listeners-attached', 'true');
    console.log('[GIF Exporter UI] Event listeners attached.');
}

// --- Check Global Dependencies & Define Fallbacks ---
/** Check for required global functions and define fallbacks if missing. */
function checkGlobalDependencies() {
    if (typeof showAlert === 'undefined') { console.warn("showAlert global missing, using console."); window.showAlert = (m, t='error')=>console[t](`[Alert]${m}`); }
    if (typeof downloadBlob === 'undefined') { console.warn("downloadBlob global missing, using internal fallback."); window.downloadBlob = triggerDownload; } // Use internal triggerDownload if global missing
    if (typeof getLogoFilenameBase === 'undefined') { console.warn("getLogoFilenameBase global missing, using default."); window.getLogoFilenameBase = () => 'logo-anim'; }
    if (typeof notifyExportSuccess === 'undefined') { window.notifyExportSuccess = (f, fn) => showAlert(`${f} Complete: ${fn}`, 'success'); }
    if (typeof JSZip === 'undefined' && typeof createZip === 'undefined') { console.warn("Neither JSZip nor createZip found. ZIP fallback is direct download."); }
}

// --- Initialization Function ---
/**
 * Initialize the Exporter UI (inject styles/HTML, query elements, attach listeners).
 * @returns {Promise<boolean>} Resolves true if initialized, rejects on error.
 */
function initializeUI() {
    if (isInitialized) return Promise.resolve(true);
    console.log('[GIF Exporter UI] Performing first-time initialization...');
    checkGlobalDependencies(); // Ensure fallbacks exist if needed

    return new Promise((resolve, reject) => {
        try { injectStyles(); injectModalHTML(); }
        catch(err) { console.error("[GIF Exporter UI] Failed to inject UI:", err); return reject(new Error("Failed to inject Animation Exporter UI.")); }

        // Query Elements with retry
        const MAX_TRIES = 5; let tries = 0;
        const tryQueryElements = () => {
            if (queryModalElements()) {
                console.log('[GIF Exporter UI] Elements found.');
                attachModalEventListeners();
                isInitialized = true;
                console.log('[GIF Exporter UI] Initialization Complete.');
                resolve(true);
            } else {
                tries++;
                if (tries < MAX_TRIES) { setTimeout(tryQueryElements, 200); }
                else { const eMsg = "Initialization aborted: Failed to find injected modal elements."; console.error(eMsg); showAlert("Exporter UI failed to load correctly.", "error"); isInitialized = false; reject(new Error(eMsg)); }
            }
        };
        setTimeout(tryQueryElements, 50); // Start first attempt
    });
}

// --- EXPORTED FUNCTION (Entry Point) ---
/**
 * Initialize the UI if needed and open the GIF/Animation export modal.
 * @async
 * @function exportAsGIF
 * @description This is the main function exported by this module. Call this
 * from your main application logic (e.g., an event handler for an
 * "Export Animation" button) to launch the UI. It handles lazy
 * initialization of the modal.
 * @example
 * // In another module (e.g., main.js or exportHandler.js)
 * import { exportAsGIF } from './renderers/GIFRenderer.js';
 *
 * const exportButton = document.getElementById('exportGifBtn');
 * exportButton.addEventListener('click', async () => {
 * showLoadingIndicator(true); // Show main loading briefly
 * try {
 * await exportAsGIF();
 * // Modal handles its own success/failure notifications now
 * } catch (error) {
 * console.error("Failed to open or run GIF exporter:", error);
 * showAlert(`Animation Export Failed: ${error.message}`, 'error');
 * } finally {
 * showLoadingIndicator(false);
 * }
 * });
 * @returns {Promise<void>} Resolves when the modal is successfully opened, or rejects if initialization fails.
 * @throws {Error} If initialization fails.
 */
async function exportAsGIF() {
    console.log('[GIF Exporter] exportAsGIF() called...');
    try {
        if (!isInitialized) {
            console.log('[GIF Exporter] Attempting UI initialization on demand...');
            await initializeUI(); // Wait for initialization promise
        }
        // Check initialization status again after attempting init
        if (isInitialized) {
            openModal(); // Open the modal
        } else {
            // This should only happen if initializeUI() rejected
             throw new Error("GIF UI Initialization failed, cannot open modal.");
        }
    } catch (error) {
        console.error("[GIF Exporter] Cannot proceed:", error.message);
        // Error is thrown up, allowing the *calling* function (e.g., in exportHandler)
        // to catch it and show an appropriate notification to the user.
        throw error; // Re-throw the error
    }
    // Return resolved promise implicitly if openModal was called successfully
}

// Add Escape key listener globally once for convenience
if (!window.gifExporterEscapeListenerAttached) {
     document.addEventListener('keydown', (event) => {
         if (event.key === 'Escape' && modal?.style.display === 'flex') { closeModal(); }
     });
     window.gifExporterEscapeListenerAttached = true;
}


// --- PUBLIC EXPORTED FUNCTION ---
/** Initializes UI and opens the Animation export modal. */
export async function exportGIFWithUI() { // Consistent Naming
    console.log('[GIF Exporter] exportGIFWithUI() called...'); // Updated log
    try {
        if (!isInitialized) await initializeUI();
        if (isInitialized) openModal();
        else throw new Error("GIF UI Initialization failed.");
        return Promise.resolve();
    } catch (error) {
        console.error("[GIF Exporter] Cannot proceed with export:", error.message);
        if(typeof showAlert==='function') showAlert(`Cannot open Animation exporter: ${error.message}`, 'error');
        throw error;
    }
}


// Add Escape key listener globally once
if (!window.gifExporterEscapeListenerAttached) {
     document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal?.style.display === 'flex') closeModal(); });
     window.gifExporterEscapeListenerAttached = true;
}

console.log('[GIF Renderer Module] Loaded.');
