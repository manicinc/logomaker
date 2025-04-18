/**
 * exportHandler.js (v7.1 - Fixed SettingsManager Access)
 * Provides functions called by main UI button event listeners.
 * Delegates export actions to renderer UI functions. Handles copy actions.
 */

// --- Direct Module Imports ---
import SettingsManager from './settingsManager.js'; // <-- IMPORT DIRECTLY
import { getLogoFilenameBase } from './utils/utils.js';
import { exportPNGWithUI } from './renderers/PNGRenderer.js';
import { exportSVGWithUI } from './renderers/SVGRenderer.js';
import { exportGIFWithUI } from './renderers/GIFRenderer.js';
import { handleHTMLCopy, handleCSSCopy } from './exportCopyHandlers.js';

// Notification helpers (using globals with fallbacks)
// ... (showNotification function remains the same) ...

console.log('[ExportHandler v7.1] Script loaded. Using direct SettingsManager import.');

// --- Helper Functions ---

/**
 * Save current settings using SettingsManager before export
 * NOTE: SettingsManager v22 saves automatically via debounce.
 * This function is now mainly for ensuring it's available.
 */
function ensureSettingsManagerAvailable() {
    if (!SettingsManager || !SettingsManager._isInitialized) {
        console.error('[ExportHandler] SettingsManager is not available or not initialized!');
        // Optionally throw an error or show an alert
        throw new Error("SettingsManager is not ready for export.");
    }
    console.log('[ExportHandler] SettingsManager is available.');
    // No explicit save needed due to SettingsManager's internal debounced save
}

/**
 * Generate CSS code using SettingsManager
 * @returns {string} Generated CSS code
 */
function generateCSSCode() {
    console.log("[ExportHandler] Getting CSS Code via SettingsManager...");

    if (!SettingsManager || !SettingsManager._isInitialized) {
        console.error("[ExportHandler] Cannot generate CSS: SettingsManager not available/initialized!");
        return '/* Error: SettingsManager not ready. */';
    }
    if (typeof SettingsManager._generateCSSCode !== 'function') {
        console.error("[ExportHandler] Cannot generate CSS: SettingsManager._generateCSSCode method missing!");
        return '/* Error: SettingsManager CSS generation function missing. */';
    }

    try {
        // Ensure CSS is up-to-date in the manager's internal state if needed
        if (typeof SettingsManager._updateCSSCode === 'function') {
             // Call synchronously if it just reads state and updates an internal variable
             // If it's async, this might need adjustment. Assuming it's synchronous based on name.
            SettingsManager._updateCSSCode();
        }

        const css = SettingsManager._generateCSSCode();
        console.log("[ExportHandler] CSS code retrieved successfully");
        return css;
    } catch (error) {
        console.error("[ExportHandler] Error generating CSS:", error);
        return `/* Error generating CSS: ${error.message} */`;
    }
}

// ... (escapeXML, copyToClipboard functions remain the same) ...

// --- Export Handler Functions ---

/**
 * Handles PNG Export button click - Delegates to PNGRenderer UI
 */
export async function handlePNGExport() {
    console.log('[ExportHandler] handlePNGExport: Delegating to exportPNGWithUI...');
    try {
        ensureSettingsManagerAvailable(); // Check if SM is ready
        await exportPNGWithUI();
    } catch (error) {
        console.error("[ExportHandler] Error initiating PNG export UI:", error);
        showNotification("Could not open PNG export dialog: " + error.message, "error");
    }
}

/**
 * Handles SVG Export button click - Delegates to SVGRenderer UI
 */
export async function handleSVGExport() {
    console.log('[ExportHandler] handleSVGExport: Delegating to exportSVGWithUI...');
     try {
        ensureSettingsManagerAvailable(); // Check if SM is ready
        await exportSVGWithUI();
    } catch (error) {
        console.error("[ExportHandler] Error initiating SVG export UI:", error);
        showNotification("Could not open SVG export dialog: " + error.message, "error");
    }
}

/**
 * Handles Animation Export button click - Delegates to GIFRenderer UI
 */
export async function handleGIFExport() {
    console.log('[ExportHandler] handleGIFExport: Delegating to exportGIFWithUI...');
    try {
        ensureSettingsManagerAvailable(); // Check if SM is ready
        await exportGIFWithUI();
    } catch (error) {
        console.error("[ExportHandler] Error initiating Animation export UI:", error);
        showNotification("Could not open Animation export dialog: " + error.message, "error");
    }
}
