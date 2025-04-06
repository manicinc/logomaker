/**
 * exportHandler.js (v7.0)
 * Provides functions called by main UI button event listeners.
 * Delegates export actions to renderer UI functions. Handles copy actions.
 */

// Import the UI-triggering functions from renderers
import { exportPNGWithUI } from './renderers/PNGRenderer.js';
import { exportSVGWithUI } from './renderers/SVGRenderer.js';
import { exportGIFWithUI } from './renderers/GIFRenderer.js';

// --- Direct Module Imports ---
import SettingsManager from './settingsManager.js';
import { getLogoFilenameBase } from './utils/utils.js';

// Notification helpers (using globals with fallbacks)
const showNotification = (message, type = 'success') => {
    if (message && typeof message === 'string') {
        if (typeof showToast === 'function' && type === 'success') {
            showToast({ message, type });
        } else if (typeof showAlert === 'function') {
            showAlert(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    } else if (typeof message === 'object' && message !== null) {
        if (typeof showToast === 'function' && type === 'success') {
            showToast(message);
        } else if (typeof showAlert === 'function') {
            showAlert(message.message || 'Notification', message.type || type);
        } else {
            console.log(`[${type.toUpperCase()}] ${JSON.stringify(message)}`);
        }
    }
};

console.log('[ExportHandler v7.0] Script loaded. Using modern module imports.');

// --- Helper Functions ---

/**
 * Save current settings using SettingsManager before export
 */
function saveCurrentSettings() {
    if (SettingsManager && typeof SettingsManager.saveCurrentSettings === 'function') {
        try {
            console.log('[ExportHandler] Saving current settings...');
            SettingsManager.saveCurrentSettings();
        } catch (error) {
            console.error('[ExportHandler] Error saving settings:', error);
        }
    } else {
        console.error('[ExportHandler] SettingsManager or saveCurrentSettings method not found!');
    }
}

/**
 * Generate CSS code using SettingsManager
 * @returns {string} Generated CSS code
 */
function generateCSSCode() {
    console.log("[ExportHandler] Getting CSS Code via SettingsManager...");
    
    if (SettingsManager && typeof SettingsManager._generateCSSCode === 'function') {
        try {
            // Update CSS before generating
            if (typeof SettingsManager._updateCSSCode === 'function') {
                SettingsManager._updateCSSCode();
            }
            
            const css = SettingsManager._generateCSSCode();
            console.log("[ExportHandler] CSS code retrieved successfully");
            return css;
        } catch (error) {
            console.error("[ExportHandler] Error generating CSS:", error);
            return `/* Error generating CSS: ${error.message} */`;
        }
    } else {
        console.error("[ExportHandler] Cannot generate CSS: SettingsManager or _generateCSSCode method not found!");
        return '/* Error: SettingsManager CSS generation function missing. */';
    }
}

/**
 * Escape special characters for XML/HTML
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeXML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
}

/**
 * Copy text to clipboard using modern API with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<void>}
 */
async function copyToClipboard(text) {
    if (!navigator.clipboard) {
        console.warn('[Copy] Clipboard API not available, using fallback (execCommand).');
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
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
        } catch (error) {
            document.body.removeChild(textarea);
            console.error('[Copy] Fallback copy failed:', error);
            return Promise.reject(new Error('Could not copy text using fallback.'));
        }
    }
    
    // Use modern Clipboard API
    try {
        await navigator.clipboard.writeText(text);
        console.log('[Copy] Copied using Clipboard API.');
    } catch (error) {
        console.error('[Copy] Clipboard API copy failed:', error);
        throw new Error('Could not copy text via Clipboard API.');
    }
}

// --- Export Handler Functions ---

/**
 * Handles PNG Export button click - Delegates to PNGRenderer UI
 */
export async function handlePNGExport() {
    console.log('[ExportHandler] handlePNGExport: Delegating to exportPNGWithUI...');
    saveCurrentSettings(); // Save before opening modal
    
    try {
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
    saveCurrentSettings();
    
    try {
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
    saveCurrentSettings();
    
    try {
        await exportGIFWithUI();
    } catch (error) {
        console.error("[ExportHandler] Error initiating Animation export UI:", error);
        showNotification("Could not open Animation export dialog: " + error.message, "error");
    }
}

/**
 * Handles Copy HTML button click
 */
export function handleHTMLCopy() {
    console.log('[ExportHandler] handleHTMLCopy triggered');
    saveCurrentSettings(); // Ensure settings are saved for CSS generation
    
    try {
        // Get logo text
        const logoText = SettingsManager?.getCurrentSettings?.().logoText || getLogoFilenameBase();
        
        // Generate CSS
        const cssCode = generateCSSCode();
        if (cssCode.startsWith('/* Error')) {
            throw new Error("Could not generate CSS for HTML copy.");
        }

        // Create HTML structure
        const htmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXML(logoText)} Logo</title>
  <style>
/* --- Styles for Logo (Generated by Logomaker) --- */
${cssCode}
/* --- Base Styles for Container --- */
body { 
  margin: 0; 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  min-height: 100vh; 
  background-color: #f5f5f5;
}
.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
}
  </style>
</head>
<body>
  <div class="logo-container">
    <div class="logo-text">${escapeXML(logoText)}</div>
  </div>
</body>
</html>`;

        // Copy to clipboard
        copyToClipboard(htmlCode)
            .then(() => showNotification('HTML code copied to clipboard! ✅', 'success'))
            .catch(error => showNotification(`HTML Copy Failed: ${error.message}`, 'error'));
    } catch (error) {
        console.error('[ExportHandler] Error during HTML copy:', error);
        showNotification(`HTML Copy Failed: ${error.message}`, 'error');
    }
}

/**
 * Handles Copy CSS button click
 */
export function handleCSSCopy() {
    console.log('[ExportHandler] handleCSSCopy triggered');
    saveCurrentSettings();
    
    try {
        const cssCode = generateCSSCode();
        
        if (cssCode.startsWith('/* Error')) {
            throw new Error("Could not generate CSS for copying.");
        }

        copyToClipboard(cssCode)
            .then(() => showNotification('CSS code copied to clipboard! ✅', 'success'))
            .catch(error => showNotification(`CSS Copy Failed: ${error.message}`, 'error'));
    } catch (error) {
        console.error('[ExportHandler] Error during CSS copy:', error);
        showNotification(`CSS Copy Failed: ${error.message}`, 'error');
    }
}