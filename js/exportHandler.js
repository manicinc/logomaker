/**
 * exportHandler.js
 * Provides functions called by main UI button event listeners.
 * Delegates export actions to renderer UI functions. Handles copy actions.
 */

// Import the UI-triggering functions from renderers
import { exportPNGWithUI } from './renderers/PNGRenderer.js';
import { exportSVGWithUI } from './renderers/SVGRenderer.js';
import { exportGIFWithUI } from './renderers/GIFRenderer.js';

// --- Direct Module Imports ---
import SettingsManager from './settingsManager.js'; // Import directly
// Assuming getLogoFilenameBase is exported from utils.js
// If Utils itself is exported as default: import Utils from './utils/utils.js'; and use Utils.getLogoFilenameBase
import { getLogoFilenameBase } from './utils/utils.js'; // Adjust path if needed

// Assume showAlert, showToast are global or managed elsewhere

console.log('[ExportHandler v6] Script loaded. Using module imports.');

// --- Helper Functions (Now using imported modules) ---

/** Show a notification using global functions or console fallback. */
function showCopyNotification(message, type = 'success') {
    const notifyFunc = (type === 'success' && typeof showToast === 'function') ? showToast : (typeof showAlert === 'function' ? showAlert : console.log);
    try {
        if(typeof message === 'object' && message !== null) { notifyFunc(message); }
        else { notifyFunc({ message: String(message), type: type }); }
    } catch (e) { console.error("Notification failed:", e); console.log(`[${type}] ${message}`); }
}

/** Save current settings using imported SettingsManager. */
function saveCurrentSettings() {
    // Use imported SettingsManager directly
    if (SettingsManager && typeof SettingsManager.saveCurrentSettings === 'function') {
        try {
            console.log('[ExportHandler] Saving current settings...');
            SettingsManager.saveCurrentSettings(); // Call method on imported object
        } catch (e) {
            console.error('[ExportHandler] Error saving settings via SettingsManager:', e);
        }
    } else {
        console.error('[ExportHandler] Imported SettingsManager or saveCurrentSettings method not found!'); // Changed to error
    }
}

// getLogoFilenameBase is now imported directly, no need for a wrapper here

/** Generate CSS code via imported SettingsManager. */
function generateCSSCode() {
    console.log("[ExportHandler] Getting CSS Code via SettingsManager...");
    // Use imported SettingsManager directly
    if (SettingsManager && typeof SettingsManager._generateCSSCode === 'function') {
         try {
             // Call internal update/generate methods on the imported object
             if (typeof SettingsManager._updateCSSCode === 'function') { SettingsManager._updateCSSCode(); }
             const css = SettingsManager._generateCSSCode();
             console.log("[ExportHandler] CSS code retrieved.");
             return css;
         } catch(e) {
             console.error("Error calling SettingsManager CSS generation:", e);
             return `/* Error generating CSS via SettingsManager: ${e.message} */`;
         }
    } else {
         console.error("[ExportHandler] Cannot generate CSS: SettingsManager or _generateCSSCode method not found!");
         return '/* Error: SettingsManager CSS generation function missing. */';
    }
}

// --- Export Handler Functions (Delegation & Copy - No changes needed here) ---

/** Handles PNG Export button click - Delegates to PNGRenderer UI */
export async function handlePNGExport() {
    console.log('[ExportHandler] handlePNGExport: Delegating to exportPNGWithUI...');
    saveCurrentSettings(); // Save before opening modal
    try { await exportPNGWithUI(); }
    catch (err) { console.error("[ExportHandler] Error initiating PNG export UI:", err); /* ... alert ... */ }
}

/** Handles SVG Export button click - Delegates to SVGRenderer UI */
export async function handleSVGExport() {
    console.log('[ExportHandler] handleSVGExport: Delegating to exportSVGWithUI...');
    saveCurrentSettings();
    try { await exportSVGWithUI(); }
    catch (err) { console.error("[ExportHandler] Error initiating SVG export UI:", err); /* ... alert ... */ }
}

/** Handles Animation Export button click - Delegates to GIFRenderer UI */
export async function handleGIFExport() {
    console.log('[ExportHandler] handleGIFExport: Delegating to exportGIFWithUI...');
    saveCurrentSettings();
    try { await exportGIFWithUI(); }
    catch (err) { console.error("[ExportHandler] Error initiating Animation export UI:", err); /* ... alert ... */ }
}

/** Copy text to clipboard using modern API with fallback. */
async function copyToClipboard(text) {
    if (!navigator.clipboard) {
        console.warn('[Copy] Clipboard API not available, using fallback (execCommand).');
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed'; textarea.style.opacity = '0'; // Make invisible
        document.body.appendChild(textarea);
        textarea.select();
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (successful) {
                console.log('[Copy] Copied using execCommand.');
                return Promise.resolve();
            } else {
                 console.error('[Copy] execCommand failed.');
                 return Promise.reject(new Error('Could not copy text using fallback.'));
            }
        } catch (err) {
            document.body.removeChild(textarea);
            console.error('[Copy] Fallback copy failed:', err);
            return Promise.reject(new Error('Could not copy text using fallback.'));
        }
    }
    // Use modern Clipboard API
    try {
        await navigator.clipboard.writeText(text);
        console.log('[Copy] Copied using Clipboard API.');
    } catch (err) {
        console.error('[Copy] Clipboard API copy failed:', err);
        throw new Error('Could not copy text via Clipboard API.'); // Re-throw
    }
}


// --- Export Handler Functions (Delegation & Copy) ---

/** Handles Copy HTML button click */
export function handleHTMLCopy() {
    console.log('[ExportHandler] handleHTMLCopy triggered');
    saveCurrentSettings(); // Ensure settings are saved for CSS generation
    try {
        // Use more reliable source for logo text if possible
        const logoText = window.SettingsManager?.getCurrentSettings?.().logoText || getLogoFilenameBase();
        const cssCode = generateCSSCode(); // Get CSS via SettingsManager

        if (cssCode.startsWith('/* Error')) {
             throw new Error("Could not generate CSS for HTML copy.");
        }

        // Simple HTML structure embedding the generated CSS
        const htmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXML(logoText)} Logo</title>
  <style>
/* --- Styles for Logo (Generated by Logomaker) --- */
${cssCode}
/* --- Ensure @font-face and @keyframes are included if needed --- */
/* Add necessary keyframes manually if not included in generated CSS */
body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; } /* Basic centering */
  </style>
</head>
<body>
  <div class="logo-container">
    <div class="logo-text">${escapeXML(logoText)}</div>
  </div>
</body>
</html>`;

        copyToClipboard(htmlCode)
            .then(() => showCopyNotification('Basic HTML structure copied! ✅', 'success'))
            .catch(err => showCopyNotification(`HTML Copy Failed: ${err.message}`, 'error'));
    } catch (err) {
        console.error('[ExportHandler] Error during HTML copy:', err);
        showCopyNotification(`HTML Copy Failed: ${err.message}`, 'error');
    }
}

/** Handles Copy CSS button click */
export function handleCSSCopy() {
    console.log('[ExportHandler] handleCSSCopy triggered');
    saveCurrentSettings(); // Ensure settings are saved
    try {
        const cssCode = generateCSSCode(); // Get potentially updated code via SettingsManager

        if (cssCode.startsWith('/* Error')) {
             throw new Error("Could not generate CSS for copying.");
        }

        copyToClipboard(cssCode)
            .then(() => showCopyNotification('CSS code copied! ✅', 'success'))
            .catch(err => showCopyNotification(`CSS Copy Failed: ${err.message}`, 'error'));
    } catch (err) {
        console.error('[ExportHandler] Error during CSS copy:', err);
        showCopyNotification(`CSS Copy Failed: ${err.message}`, 'error');
    }
}

/** Escapes minimal characters for HTML text content */
function escapeXML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Export ONLY the handler functions needed by main.js
// export { // No need to re-export if imported directly in main.js
//     handlePNGExport,
//     handleSVGExport,
//     handleGIFExport,
//     handleHTMLCopy,
//     handleCSSCopy
// };