/**
 * exportHandler.js (Version 4 - Refined Dependencies)
 * ========================================================
 * Provides functions that perform the actual export and copy actions.
 * These functions are intended to be imported and used as event handlers
 * by the main application initializer (main.js).
 *
 * Dependencies:
 * - PNGRenderer.js::exportPNGWithUI
 * - SVGRenderer.js::exportSVGWithUI
 * - GIFRenderer.js::exportGIFWithUI
 * - SettingsManager (global or imported) for saving and CSS generation.
 * - Utils.downloadBlob, Utils.getLogoFilenameBase (global or imported from utils.js)
 * - Global notification functions (showAlert, showToast, notifyExportSuccess, etc.)
 */

import { exportPNGWithUI } from './renderers/PNGRenderer.js';
import { exportSVGWithUI } from './renderers/SVGRenderer.js';
import { exportGIFWithUI } from './renderers/GIFRenderer.js';
// Assuming SettingsManager is available globally via window.SettingsManager
// Assuming Utils are available globally via window.Utils
// Assuming notification functions (showAlert, showToast, notify*) are global

console.log('[ExportHandler] 🎬 Script loaded, using export*WithUI functions.');

// --- Helper Functions ---

/** Show/hide the main page loading indicator. */
function showLoadingIndicator(show = true) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    } else {
        console.warn("[ExportHandler] Main loading indicator '#loadingIndicator' not found.");
    }
}

/** Show a notification using global functions or console fallback. */
function showExportNotification(message, type = 'success', options = {}) {
    // Prefer showToast for success/info, showModal for errors/warnings
    let notifyFunc = console.log; // Fallback
    if (type === 'success' || type === 'info') {
        notifyFunc = typeof showToast === 'function' ? showToast : (msg, t) => console.info(msg);
    } else { // error or warning
        notifyFunc = typeof showModal === 'function' ? showModal : (msg, t) => console.error(msg);
    }

    if (typeof notifyFunc === 'function') {
        if (typeof message === 'object') { // If options object is passed directly
             notifyFunc(message);
        } else { // If message string is passed
             notifyFunc({ message: message, type: type, ...options });
        }
    } else {
         console.error(`[ExportHandler] Notification function not found for type: ${type}`);
         console.log(`[Notification Fallback] ${type}: ${message}`);
    }
}

/** Save current settings using SettingsManager. */
function saveCurrentSettings() {
    if (window.SettingsManager && typeof window.SettingsManager.saveCurrentSettings === 'function') {
        try {
            window.SettingsManager.saveCurrentSettings();
            // console.log('[ExportHandler] Settings saved via SettingsManager.'); // Optional: Reduce noise
        } catch (e) {
            console.error('[ExportHandler] Error saving settings via SettingsManager:', e);
        }
    } else {
        console.warn('[ExportHandler] SettingsManager or saveCurrentSettings function not found.');
    }
}

/** Get sanitized filename base using Utils. */
function getLogoFilenameBase() {
    if (window.Utils && typeof window.Utils.getLogoFilenameBase === 'function') {
        try {
            return window.Utils.getLogoFilenameBase();
        } catch (e) {
            console.error('[ExportHandler] Error calling Utils.getLogoFilenameBase:', e);
            return 'logo'; // Fallback
        }
    } else {
        console.warn('[ExportHandler] Utils.getLogoFilenameBase not found, using default.');
        // Basic fallback implementation
        const logoEl = document.querySelector('.logo-text');
        const logoText = logoEl ? logoEl.textContent.trim() : 'logo';
        return logoText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 30) || 'logo';
    }
}

/** Generate CSS code, preferring SettingsManager. */
function generateCSSCode() {
    console.log("[ExportHandler] Generating CSS Code...");
    if (window.SettingsManager && typeof window.SettingsManager._generateCSSCode === 'function') {
         try {
             const css = window.SettingsManager._generateCSSCode();
             // console.log("[ExportHandler] Generated CSS via SettingsManager:\n", css); // Debug
             return css;
         } catch(e) {
             console.error("Error calling SettingsManager._generateCSSCode:", e);
             // Fall through to basic fallback
         }
    }

    // Basic Fallback (Less accurate)
    console.warn("[ExportHandler] Falling back to basic CSS generation.");
    try {
        const logoEl = document.querySelector('.logo-text');
        const container = document.getElementById('previewContainer');
        if (!logoEl || !container) throw new Error("Missing elements for fallback CSS gen.");
        const logoStyle = getComputedStyle(logoEl);
        const containerStyle = getComputedStyle(container);

        let css = `:root {\n`;
        // Attempt to grab a few common vars
        const rootStyle = getComputedStyle(document.documentElement);
        const vars = ['--animation-duration', '--gradient-direction', '--dynamic-border-color'];
        vars.forEach(v => css += `  ${v}: ${rootStyle.getPropertyValue(v).trim()};\n`);
        css += `}\n\n`;

        css += `.logo-container { display:flex; justify-content:center; align-items:center; background-color:${containerStyle.backgroundColor||'#000'}; background-image:${containerStyle.backgroundImage||'none'}; opacity: ${containerStyle.opacity || '1'}; }\n\n`;
        css += `.logo-text {\n`;
        css += `  font-family: ${logoStyle.fontFamily.split(',')[0].trim()};\n`;
        css += `  font-size: ${logoStyle.fontSize};\n`;
        css += `  font-weight: ${logoStyle.fontWeight};\n`;
        if (logoStyle.letterSpacing !== 'normal') css += `  letter-spacing: ${logoStyle.letterSpacing};\n`;
        if (logoStyle.textTransform !== 'none') css += `  text-transform: ${logoStyle.textTransform};\n`;
        if (logoStyle.textAlign !== 'start') css += `  text-align: ${logoStyle.textAlign};\n`; // Usually default is start
        if (logoStyle.color && logoStyle.color !== 'rgba(0, 0, 0, 0)' && logoStyle.color !== 'transparent') css += `  color: ${logoStyle.color};\n`;
        if (logoStyle.backgroundImage && logoStyle.backgroundImage !== 'none') { css += `  background-image: ${logoStyle.backgroundImage};\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;\n  -webkit-text-fill-color: transparent;\n`; }
        if (logoStyle.textShadow && logoStyle.textShadow !== 'none') css += `  text-shadow: ${logoStyle.textShadow};\n`;
        // Simple border attempt
        const borderElement = document.querySelector('.dynamic-border') || logoEl;
        const borderStyle = getComputedStyle(borderElement);
        if (borderStyle.borderTopWidth !== '0px') css += `  border: ${borderStyle.borderTopWidth} ${borderStyle.borderTopStyle} ${borderStyle.borderTopColor};\n`;
        if (logoStyle.transform && logoStyle.transform !== 'none') css += `  transform: ${logoStyle.transform};\n`;
        if (logoStyle.animationName && logoStyle.animationName !== 'none') css += `  animation: ${logoStyle.animationName} ${logoStyle.animationDuration} ${logoStyle.animationTimingFunction} ${logoStyle.animationIterationCount};\n`;
        css += `}\n`;
        console.log("[ExportHandler] Generated CSS (fallback):\n", css);
        return css;
    } catch (err) {
        console.error("Error generating CSS code (fallback):", err);
        return `/* Error generating CSS: ${err.message} */`;
    }
}

/** Copy text to clipboard. */
function copyToClipboard(text) {
    if (!navigator.clipboard) {
        console.warn('[Copy] Clipboard API not available, using fallback.');
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed'; textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            console.log('[Copy] Copied using execCommand.');
            return Promise.resolve();
        } catch (err) {
            document.body.removeChild(textarea);
            console.error('[Copy] Fallback copy failed:', err);
            return Promise.reject(new Error('Could not copy text using fallback.'));
        }
    }
    // Use modern Clipboard API
    return navigator.clipboard.writeText(text).then(() => {
        console.log('[Copy] Copied using Clipboard API.');
    }).catch(err => {
        console.error('[Copy] Clipboard API copy failed:', err);
        throw new Error('Could not copy text via Clipboard API.'); // Re-throw
    });
}

/** Centralized error handler */
function handleExportError(exportType, err) {
    console.error(`[ExportHandler] ❌ ${exportType} export/UI failed:`, err);
    // Avoid showing notification for simple cancellations or known modal closure issues
    const knownNonErrors = ['Export cancelled', 'Modal closed', 'UI initialization failed', 'cancelled by user'];
    if (err && err.message && !knownNonErrors.some(msg => err.message.toLowerCase().includes(msg.toLowerCase()))) {
        // Use more prominent notification (Modal) for actual errors
        showExportNotification({ message: `${exportType} Failed: ${err.message || 'Unknown error'}`, type: 'error'});
    } else if (err && err.message && (err.message.toLowerCase().includes('export cancelled') || err.message.toLowerCase().includes('cancelled by user'))) {
        // Use less intrusive notification (Toast) for cancellations
        showExportNotification({ message: `${exportType} Export Cancelled.`, type: 'info' });
    }
    showLoadingIndicator(false); // Ensure main loading indicator is hidden
}


// --- Export Handler Functions ---

async function handlePNGExport() {
    console.log('[ExportHandler] 🖼️ PNG export triggered');
    saveCurrentSettings(); // Save settings before opening modal
    try {
        await exportPNGWithUI(); // Call the UI function from PNGRenderer
    } catch (err) {
        handleExportError('PNG Export', err); // Use centralized error handler
    }
}

async function handleSVGExport() {
    console.log('[ExportHandler] 🧩 SVG export triggered');
    saveCurrentSettings();
    try {
        await exportSVGWithUI(); // Call the UI function from SVGRenderer
    } catch (err) {
        handleExportError('SVG Export', err);
    }
}

async function handleGIFExport() {
    console.log('[ExportHandler] 🎞️ Animation export triggered');
    saveCurrentSettings();
    try {
        await exportGIFWithUI(); // Call the UI function from GIFRenderer
    } catch (err) {
        handleExportError('Animation Export', err);
    }
}

function handleHTMLCopy() {
    console.log('[ExportHandler] 📋 HTML copy triggered');
    saveCurrentSettings(); // Ensure settings are saved for CSS generation
    try {
        const logoText = document.querySelector('.logo-text')?.textContent || getLogoFilenameBase();
        // Explicitly update CSS code display before copying (if function exists)
        if (typeof window.SettingsManager?._updateCSSCode === 'function') {
             window.SettingsManager._updateCSSCode();
        }
        const cssCode = document.getElementById('cssCode')?.value || generateCSSCode(); // Get potentially updated code

        const htmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${logoText} Logo</title>
  <style>
/* --- Styles for Logo --- */
${cssCode}
/* --- Make sure @keyframes are included if needed --- */
/* --- End Styles --- */
  </style>
</head>
<body>
  <div class="logo-container">
    <div class="logo-text">${logoText}</div>
  </div>
</body>
</html>`;

        copyToClipboard(htmlCode)
            .then(() => showExportNotification('HTML code copied to clipboard! ✅', 'success'))
            .catch(err => showExportNotification(`HTML Copy Failed: ${err.message}`, 'error'));
    } catch (err) {
        handleExportError('HTML Copy', err);
    }
}

function handleCSSCopy() {
    console.log('[ExportHandler] 🎨 CSS copy triggered');
    saveCurrentSettings();
    try {
        // Explicitly update CSS code display before copying
         if (typeof window.SettingsManager?._updateCSSCode === 'function') {
             window.SettingsManager._updateCSSCode();
        }
        const cssCode = document.getElementById('cssCode')?.value || generateCSSCode(); // Get potentially updated code

        copyToClipboard(cssCode)
            .then(() => showExportNotification('CSS code copied to clipboard! ✅', 'success'))
            .catch(err => showExportNotification(`CSS Copy Failed: ${err.message}`, 'error'));
    } catch (err) {
        handleExportError('CSS Copy', err);
    }
}

// Export ONLY the handler functions
export {
    handlePNGExport,
    handleSVGExport,
    handleGIFExport,
    handleHTMLCopy,
    handleCSSCopy
};