/**
 * RendererCore.js (v2.9 - Integrated with FontManager)
 * ============================================================
 * Central rendering pipeline for PNG, SVG, and frames exports.
 * Ensures the entire #previewContainer area (with background,
 * border radius, etc.) is captured consistently in both PNG & SVG.
 * Includes fixes for keyframe embedding, gradient handling, and CSS transforms.
 * Incorporates robust style validation and improved rendering logic.
 *
 * *** IMPORTANT V2.9 CHANGE ***
 * This version REMOVES internal @font-face generation. It RELIES
 * on an external font manager (like fontManager.js) to load fonts
 * and inject @font-face rules into the main document's stylesheet
 * *before* these rendering functions are called. The SVG <text>
 * element will reference the font-family, and the browser will
 * resolve it using the globally available @font-face rules.
 * Ensure your font manager is initialized and fonts are loaded/injected
 * before calling generateSVGBlob, convertSVGtoPNG, etc.
 *
 * Exports:
 * - generateSVGBlob(options)
 * - convertSVGtoPNG(svgBlob, options)
 * - generateAnimationFrames(options)
 * - generateConsistentPreview(options, previewImg, loadingElement, exportType)
 *
 * Usage:
 * This module is used by other code (PNGRenderer, SVGRenderer, GIFRenderer)
 * or UI logic to generate final exports. Assumes fontManager.js (or similar)
 * has handled font loading and CSS injection.
 */

// import style capture & animation info
import { captureAdvancedStyles } from '../captureTextStyles.js';
// Ensure svgAnimationInfo.js has the updated getAnimationKeyframes with all fallback definitions!
import {
    extractSVGAnimationDetails,
    getAnimationKeyframes,
    generateAnimationClassCSS // <-- Added this function
} from '../utils/svgAnimationInfo.js';
// NOTE: We no longer directly USE fontManager here, but the CALLING code MUST ensure
// fontManager has loaded and injected the required fonts BEFORE calling generateSVGBlob.
// import { getFontDataAsync } from './fontManager.js'; // <= No longer needed here

// If needed, attach a global fallback (like normalizeColor if not imported elsewhere)
if (typeof window.normalizeColor !== 'function' && typeof normalizeColor !== 'function') {
    console.warn("[RendererCore] normalizeColor not found globally, adding basic fallback.");
    window.normalizeColor = (color) => (typeof color === 'string' ? color.trim() : '#000000');
}
const normalizeColor = window.normalizeColor; // Use the globally available one

console.log("[RendererCore v2.9 - Integrated with FontManager] Loading...");

// -----------------------------------------------------------------------
// 1. Generic Helpers
// -----------------------------------------------------------------------

export function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        if (!(blob instanceof Blob)) {
            return reject(new Error("Invalid input, expected a Blob."));
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(blob);
    });
}

function escapeSVGAttribute(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
}

function escapeXML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
}

function parseAnimationDuration(durationStr) {
    if (!durationStr || typeof durationStr !== 'string') return 0;
    const trimmed = durationStr.trim();
    const val = parseFloat(trimmed);
    if (isNaN(val)) return 0;
    if (trimmed.endsWith('ms')) return val;
    if (trimmed.endsWith('s')) return val * 1000;
    return val * 1000; // default assumes seconds if no unit
}

/**
 * Extracts the alpha value (0-1) from a CSS color string (rgba, hsla, #rrggbbaa).
 * @param {string} colorStr The CSS color string.
 * @returns {number} Alpha value between 0 and 1 (defaults to 1).
 */
function extractOpacityFromColor(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return 1; // Ensure input is string

    colorStr = colorStr.trim().toLowerCase();

    // Handle rgba() / hsla() - look for the last comma-separated value
    if (colorStr.startsWith('rgba') || colorStr.startsWith('hsla')) {
         const match = colorStr.match(/,\s*([\d.]+)\s*\)$/);
         if (match && match[1]) {
             const alpha = parseFloat(match[1]);
             return isNaN(alpha) ? 1 : Math.max(0, Math.min(1, alpha));
         }
    }

    // Handle #rrggbbaa hex format
    if (colorStr.startsWith('#') && colorStr.length === 9) {
         const alphaHex = colorStr.substring(7, 9);
         const alphaDec = parseInt(alphaHex, 16);
         if (!isNaN(alphaDec)) {
             return Math.max(0, Math.min(1, alphaDec / 255));
         }
    }
    // Handle #rgba hex format
     if (colorStr.startsWith('#') && colorStr.length === 5) {
         const alphaHex = colorStr.substring(4, 5);
         const alphaDec = parseInt(alphaHex + alphaHex, 16); // Expand single hex digit
         if (!isNaN(alphaDec)) {
             return Math.max(0, Math.min(1, alphaDec / 255));
         }
     }

    // Default to fully opaque if format doesn't include alpha or parsing fails
    return 1;
}


/**
 * Normalizes CSS transform values for use in SVG's transform attribute.
 * Handles basic 2D functions and ignores unsupported 3D/complex ones.
 * @param {string} cssTransform The CSS transform string.
 * @returns {string} A valid SVG transform string or empty string.
 */
function normalizeCSSTransformForSVG(cssTransform) {
    if (!cssTransform || cssTransform === 'none') return '';

    const functions = [];

    // Regex patterns for common 2D functions
    const translateRegex = /translate\(\s*(-?[\d.]+px?)(?:\s*[,]?\s*(-?[\d.]+px?))?\s*\)/gi;
    const scaleRegex = /scale\(\s*(-?[\d.]+)(?:\s*[,]?\s*(-?[\d.]+))?\s*\)/gi;
    const rotateRegex = /rotate\(\s*(-?[\d.]+)(deg|rad|turn)?\s*\)/gi;
    const skewXRegex = /skewX\(\s*(-?[\d.]+)(deg|rad|turn)?\s*\)/gi;
    const skewYRegex = /skewY\(\s*(-?[\d.]+)(deg|rad|turn)?\s*\)/gi;
    const matrixRegex = /matrix\(\s*(-?[\d.]+)\s*[,]?\s*(-?[\d.]+)\s*[,]?\s*(-?[\d.]+)\s*[,]?\s*(-?[\d.]+)\s*[,]?\s*(-?[\d.]+)\s*[,]?\s*(-?[\d.]+)\s*\)/gi;

    // Process known functions first
    let remainingTransform = cssTransform;

    // --- Matrix ---
    remainingTransform = remainingTransform.replace(matrixRegex, (match, a, b, c, d, e, f) => {
        const values = [a, b, c, d, e, f].map(v => parseFloat(v));
        if (values.every(v => !isNaN(v))) {
            const isIdentity = values.every((v, i) => Math.abs(v - [1, 0, 0, 1, 0, 0][i]) < 1e-6);
            if (!isIdentity) {
                functions.push(`matrix(${values.join(' ')})`);
            }
        }
        return ''; // Remove matched part
    });

    // --- Translate ---
     remainingTransform = remainingTransform.replace(translateRegex, (match, txStr, tyStr) => {
         const tx = parseFloat(txStr || '0') || 0;
         const ty = parseFloat(tyStr || '0') || 0; // If ty is omitted, CSS uses 0
         if (tx !== 0 || ty !== 0) {
             functions.push(`translate(${tx} ${ty})`);
         }
         return '';
     });


    // --- Scale ---
    remainingTransform = remainingTransform.replace(scaleRegex, (match, sxStr, syStr) => {
        const sx = parseFloat(sxStr || '1') || 1;
        const sy = parseFloat(syStr !== undefined ? syStr : sxStr || '1') || sx; // If sy omitted, use sx
        if (sx !== 1 || sy !== 1) {
             functions.push(`scale(${sx} ${sy})`);
         }
        return '';
    });

    // --- Rotate ---
    remainingTransform = remainingTransform.replace(rotateRegex, (match, angleStr, unit) => {
        let angle = parseFloat(angleStr) || 0;
        unit = (unit || 'deg').toLowerCase();
        if (unit === 'rad') angle = angle * (180 / Math.PI);
        else if (unit === 'turn') angle = angle * 360;
        // SVG rotate is just degrees
        if (angle !== 0) {
             functions.push(`rotate(${angle})`);
        }
        return '';
    });

    // --- SkewX ---
     remainingTransform = remainingTransform.replace(skewXRegex, (match, angleStr, unit) => {
         let angle = parseFloat(angleStr) || 0;
         unit = (unit || 'deg').toLowerCase();
         if (unit === 'rad') angle = angle * (180 / Math.PI);
         else if (unit === 'turn') angle = angle * 360;
         if (angle !== 0) {
             functions.push(`skewX(${angle})`);
         }
         return '';
     });

    // --- SkewY ---
     remainingTransform = remainingTransform.replace(skewYRegex, (match, angleStr, unit) => {
         let angle = parseFloat(angleStr) || 0;
         unit = (unit || 'deg').toLowerCase();
         if (unit === 'rad') angle = angle * (180 / Math.PI);
         else if (unit === 'turn') angle = angle * 360;
         if (angle !== 0) {
             functions.push(`skewY(${angle})`);
         }
         return '';
     });


    // Check for unsupported 3D/complex functions in the remaining string
    const unsupportedPatterns = /matrix3d|perspective|rotate3d|scale3d|translate3d|rotate[XYZ]|skew\(/i;
    const remainingTrimmed = remainingTransform.trim();

    if (unsupportedPatterns.test(remainingTrimmed)) {
        console.warn(`[RendererCore] Ignoring unsupported 3D/complex parts in CSS transform: '${remainingTrimmed}' (Original: '${cssTransform}')`);
    } else if (remainingTrimmed) {
        // This might be a simple function we missed or multiple simple ones without spaces
        console.warn(`[RendererCore] Encountered potentially unhandled transform parts: '${remainingTrimmed}' (Original: '${cssTransform}') - Attempting pass-through might fail.`);
        // Attempt simple cleanup (risky) - could potentially split valid functions if spaces are missing
        const cleanedRemaining = remainingTrimmed.replace(/,\s*/g, ' '); // Replace commas with spaces
        functions.push(cleanedRemaining); // Add potentially risky part
    }

    // Combine the collected valid functions
    const result = functions.join(' ');
    if (result) {
         console.log(`[RendererCore] Normalized CSS transform '${cssTransform}' to SVG: '${result}'`);
    } else if (cssTransform && cssTransform !== 'none') {
         console.log(`[RendererCore] CSS transform '${cssTransform}' resulted in empty SVG transform (identity or unsupported).`);
    }
    return result;
}


// -----------------------------------------------------------------------
// 3. Key SVG Sub-Builders
// -----------------------------------------------------------------------

function createTextGradientDef(styles, gradientId) {
    console.log('[RendererCore DEBUG - GradDef] Trying to create text gradient def. Style color mode:', styles.color?.mode); // Log mode
    // Add more checks for gradient data validity
    if (!styles.color || styles.color.mode !== 'gradient' || !styles.color.gradient || !styles.color.gradient.colors || !Array.isArray(styles.color.gradient.colors) || styles.color.gradient.colors.length < 2) {
         console.warn('[RendererCore DEBUG - GradDef] Invalid or missing gradient data in styles object for text.');
         return ''; // Return empty if gradient data is invalid
    }

    try {
         const { colors, direction } = styles.color.gradient;
         console.log(`[RendererCore DEBUG - GradDef] Text Data: Colors=${JSON.stringify(colors)}, Direction=${direction}`);

         // Ensure colors are normalized (normalizeColor might return null/undefined)
         const normalizedColors = colors.map((c, i) => normalizeColor(c, `text gradient c${i+1}`) || '#000000'); // Fallback to black

         // Determine angle for gradient vector
         const angleDeg = parseFloat(styles.color.gradient?.angle || direction || '45') || 45;
         const angleRad = (angleDeg) * Math.PI / 180;
         // Correct calculation of gradient vector based on angle
         const x1 = (0.5 - 0.5 * Math.cos(angleRad)).toFixed(4);
         const y1 = (0.5 - 0.5 * Math.sin(angleRad)).toFixed(4);
         const x2 = (0.5 + 0.5 * Math.cos(angleRad)).toFixed(4);
         const y2 = (0.5 + 0.5 * Math.sin(angleRad)).toFixed(4);
         // Create stops, distributing them evenly if more than 2 colors
         let stops = '';
         const numStops = normalizedColors.length;
         for (let i = 0; i < numStops; i++) {
             const offset = (numStops <= 1) ? 0 : (i / (numStops - 1) * 100);
             const color = normalizedColors[i];
             // Use original color for opacity extraction if possible, fallback to black's opacity (which is 1)
             const originalColor = colors[i] || '#000000';
             const stopOpacity = extractOpacityFromColor(originalColor).toFixed(3);
             stops += `<stop offset="${offset.toFixed(1)}%" stop-color="${color}" stop-opacity="${stopOpacity}"/>`;
         }

         const gradientString = `<linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">${stops}</linearGradient>`;
         console.log('[RendererCore DEBUG - GradDef] Generated text gradient def string successfully.');
         return gradientString;

    } catch (error) {
         console.error('[RendererCore DEBUG - GradDef] Error during text gradient creation:', error);
         return ''; // Return empty on error
    }
}


function createFilterDef(styles, filterId) {
    if (!styles.textEffect || !styles.textEffect.type || styles.textEffect.type === 'none') return '';
    const { type, color, blur, dx, dy, opacity } = styles.textEffect;
    const normalizedColor = normalizeColor(color, 'filter') || '#000000'; // Ensure fallback color
    const safeBlur = Math.max(0, blur || 0);
    const safeDx = dx || 0;
    const safeDy = dy || 0;
    const safeOpacity = Math.max(0, Math.min(1, opacity === undefined ? 1 : opacity)); // Default opacity to 1 if undefined

    console.log(`[RendererCore DEBUG - FilterDef] Creating filter '${type}' with color:${normalizedColor}, blur:${safeBlur}, dx:${safeDx}, dy:${safeDy}, opacity:${safeOpacity}`);

    // Simple drop shadow (minimal or no blur)
    if (type === 'shadow' && safeBlur < 0.5 && (safeDx !== 0 || safeDy !== 0)) {
         return `<filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
<feDropShadow dx="${safeDx}" dy="${safeDy}" stdDeviation="${Math.max(0.1, safeBlur).toFixed(2)}" flood-color="${normalizedColor}" flood-opacity="${safeOpacity.toFixed(3)}"/>
</filter>`;
    }
    // Glow (no offset, uses blur) or Blurred Shadow (has offset and blur)
    else if ((type === 'glow' && safeBlur > 0) || (type === 'shadow' && safeBlur >= 0.5)) {
         return `<filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
<feGaussianBlur in="SourceAlpha" stdDeviation="${safeBlur.toFixed(2)}" result="blur"/>
<feOffset dx="${safeDx}" dy="${safeDy}" in="blur" result="offsetBlur"/>
<feFlood flood-color="${normalizedColor}" flood-opacity="${safeOpacity.toFixed(3)}" result="flood"/>
<feComposite in="flood" in2="offsetBlur" operator="in" result="coloredBlur"/>
<feMerge>
 <feMergeNode in="coloredBlur"/>
 <feMergeNode in="SourceGraphic"/>
</feMerge>
</filter>`;
     }
     // Fallback or other types - might need more specific filters
     else {
          console.warn(`[RendererCore DEBUG - FilterDef] Filter type '${type}' with parameters might not be optimally represented. Using generic blur/offset filter.`);
          // Default to a structure that handles blur/offset/color, might not be perfect 'glow' if dx/dy are non-zero
         return `<filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
<feGaussianBlur in="SourceAlpha" stdDeviation="${safeBlur.toFixed(2)}" result="blur"/>
<feOffset dx="${safeDx}" dy="${safeDy}" in="blur" result="offsetBlur"/>
<feFlood flood-color="${normalizedColor}" flood-opacity="${safeOpacity.toFixed(3)}" result="flood"/>
<feComposite in="flood" in2="offsetBlur" operator="in" result="coloredBlur"/>
<feMerge>
 <feMergeNode in="coloredBlur"/>
 <feMergeNode in="SourceGraphic"/>
</feMerge>
</filter>`;
     }
}


/**
 * Creates the <linearGradient> definition for the background.
 * Includes extra logging and error handling.
 * @param {object} styles Captured styles.
 * @param {string} id The ID for the gradient.
 * @returns {string} The SVG gradient definition string or empty string on failure.
 */
function createBackgroundGradientDef(styles, id) {
    console.log('[RendererCore DEBUG - GradDef BG] Creating BG gradient def. ID:', id);
    if (!styles.background?.gradient) {
         console.warn('[RendererCore DEBUG - GradDef BG] No background.gradient data found in styles.');
         return ''; // Return empty
    }
    const { colors, direction } = styles.background.gradient;
    console.log(`[RendererCore DEBUG - GradDef BG] Data: Colors=${JSON.stringify(colors)}, Direction=${direction}`);

    // --- Robust check ---
    if (!colors || !Array.isArray(colors) || colors.length < 2) {
         console.warn('[RendererCore DEBUG - GradDef BG] Invalid or insufficient colors for background gradient.');
         return ''; // Return empty
    }

    try {
         // Normalize colors with fallback
         const normalizedColors = colors.map((c, i) => normalizeColor(c, `bg gradient${i+1}`) || '#000000');

         // Determine angle for gradient vector
         const angleDeg = parseFloat(direction || '180') || 180;
         const angleRad = (angleDeg - 90) * Math.PI / 180;
         const x1 = (0.5 - 0.5 * Math.cos(angleRad)).toFixed(4);
         const y1 = (0.5 - 0.5 * Math.sin(angleRad)).toFixed(4);
         const x2 = (0.5 + 0.5 * Math.cos(angleRad)).toFixed(4);
         const y2 = (0.5 + 0.5 * Math.sin(angleRad)).toFixed(4);

         // Create stops, distributing them evenly if more than 2 colors
         let stops = '';
         const numStops = normalizedColors.length;
         for (let i = 0; i < numStops; i++) {
             const offset = (numStops <= 1) ? 0 : (i / (numStops - 1) * 100);
             const color = normalizedColors[i];
             // Use original color for opacity extraction
             const originalColor = colors[i] || '#000000';
             const stopOpacity = extractOpacityFromColor(originalColor).toFixed(3);
             stops += `<stop offset="${offset.toFixed(1)}%" stop-color="${color}" stop-opacity="${stopOpacity}"/>`;
         }

         const gradientString = `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">${stops}</linearGradient>`;
         console.log('[RendererCore DEBUG - GradDef BG] Generated background gradient def string successfully.');
         return gradientString;
    } catch (error) {
         console.error('[RendererCore DEBUG - GradDef BG] Error during background gradient creation:', error);
         return ''; // Return empty on error
    }
}


// -----------------------------------------------------------------------
// 4. Core Export: generateSVGBlob
// -----------------------------------------------------------------------
/**
 * generateSVGBlob(options)
 * Main function to generate the SVG Blob. Uses pre-captured styles if provided.
 * Includes validation and improved transform handling. Captures the entire preview area.
 * RELIES ON EXTERNAL FONT MANAGER for @font-face rules.
 *
 * @param {object} options - e.g. { width, height, transparentBackground, preCapturedStyles?, preserveAspectRatio? }
 * @returns {Promise<Blob>}
 */
export async function generateSVGBlob(options = {}) {
    console.log("[RendererCore] generateSVGBlob() starting with options:", options);
    let styles = options.preCapturedStyles || null; // Use passed styles if available

    // 1) Capture styles ONLY if not passed in
    if (!styles) {
         console.log("[RendererCore generateSVGBlob] No pre-captured styles provided, capturing now...");
         try {
             styles = await captureAdvancedStyles();
             if (!styles) {
                 throw new Error("captureAdvancedStyles returned null or invalid data.");
             }
             console.log("[RendererCore generateSVGBlob] Styles captured successfully.");
         } catch (captureError) {
             console.error("[RendererCore] Failed during style capture:", captureError);
             throw new Error(`Failed to capture styles: ${captureError.message}`);
         }
    } else {
         console.log("[RendererCore generateSVGBlob] Using pre-captured styles object.");
         // Optional: Re-log critical parts from the passed styles for debugging
         console.log(`[RendererCore generateSVGBlob] PreCaptured Font Family: ${styles.font?.family}`); // Log family name used
         console.log(`[RendererCore generateSVGBlob] PreCaptured Color Mode: ${styles.color?.mode}`);
         console.log(`[RendererCore generateSVGBlob] PreCaptured Background Type: ${styles.background?.type}`);
    }

    // --- ROBUST VALIDATION ---
    // Regardless of whether styles were passed or captured, validate essential parts
    if (!styles || typeof styles !== 'object' || // Basic object check
         !styles.font || typeof styles.font !== 'object' || // Font data
         !styles.font.family || typeof styles.font.family !== 'string' || // *** Need at least font family ***
         !styles.color || typeof styles.color !== 'object' || // Color data
         !styles.textContent || typeof styles.textContent !== 'object' || // Text content
         !styles.background || typeof styles.background !== 'object' || // Background data
         !styles.originalDimensions || typeof styles.originalDimensions !== 'object' || // Original container dimensions
         !styles.exportConfig || typeof styles.exportConfig !== 'object' // Export dimensions
        )
    {
         console.error("[RendererCore generateSVGBlob] CRITICAL: Styles object is missing essential properties or has incorrect types!", styles);
         // Log which specific part is missing or invalid if possible
         const missing = [
             !styles && 'styles object',
             !styles?.font && 'font',
             !styles?.font?.family && 'font.family',
             !styles?.color && 'color',
             !styles?.textContent && 'textContent',
             !styles?.background && 'background',
             !styles?.originalDimensions && 'originalDimensions',
             !styles?.exportConfig && 'exportConfig'
         ].filter(Boolean).join(', ');
         const typeErrors = [
             styles && typeof styles !== 'object' && 'styles is not object',
             styles?.font && typeof styles.font !== 'object' && 'font is not object',
             styles?.font?.family && typeof styles.font.family !== 'string' && 'font.family is not string',
             styles?.color && typeof styles.color !== 'object' && 'color is not object',
             styles?.textContent && typeof styles.textContent !== 'object' && 'textContent is not object',
             styles?.background && typeof styles.background !== 'object' && 'background is not object',
             styles?.originalDimensions && typeof styles.originalDimensions !== 'object' && 'originalDimensions is not object',
             styles?.exportConfig && typeof styles.exportConfig !== 'object' && 'exportConfig is not object'
         ].filter(Boolean).join(', ');

         throw new Error(`Cannot generate SVG: Essential style data missing (${missing}) or invalid (${typeErrors}).`);
    }
    // --- END VALIDATION ---


    // 2) Determine final export size (width & height) using validated styles
    let targetW = parseInt(options.width || styles.exportConfig.width || '800');
    let targetH = parseInt(options.height || styles.exportConfig.height || '400');
    targetW = Math.max(1, targetW);
    targetH = Math.max(1, targetH);

    // 3) Adjust aspect ratio based on captured container dimensions if needed (using validated styles)
    const originalAR = styles.originalDimensions.aspectRatio;
    let finalW = targetW, finalH = targetH;
    if (originalAR && originalAR > 0 && options.preserveAspectRatio !== false) { // Default to preserving AR
         // Adjust height based on target width and original AR
         finalH = Math.round(finalW / originalAR);
         // Optional: Check if new height exceeds targetHeight and adjust width instead
         if (finalH > targetH && targetH > 0) { // Prevent division by zero if targetH is somehow 0
           finalH = targetH;
           finalW = Math.round(finalH * originalAR);
         }
         console.log(`[RendererCore] Adjusted size based on AR ${originalAR.toFixed(3)}: ${finalW}x${finalH}`);
    }
    finalW = Math.max(1, finalW); // Ensure dimensions > 0
    finalH = Math.max(1, finalH);


    // 4) Create config, get fresh animation details (using validated styles)
    const config = {
         width: finalW,
         height: finalH,
         transparentBackground: !!options.transparentBackground,
         includeBackground: true, // Can be overridden if needed
         animationMetadata: extractSVGAnimationDetails(), // Get fresh details now
         text: styles.textContent.finalText || styles.textContent.originalText || 'Logo' // Use validated textContent
    };
    console.log("[RendererCore] Final SVG Config:", config);

    // 5) Build the <svg> string
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n`; // Added namespaces


    // 5a) <defs>
    svg += `<defs>\n`;

    // - text gradient (using validated styles.color)
    let textGradientId = null;
    if (styles.color.mode === 'gradient') {
         textGradientId = 'svgTextGradient';
         const def = createTextGradientDef(styles, textGradientId);
         if (def) {
             svg += `  ${def}\n`;
         } else {
             console.warn("[RendererCore] Failed to create text gradient definition, reverting ID.");
             textGradientId = null;
         }
    }

    // - text filter
    let textFilterId = null;
    if (styles.textEffect?.type && styles.textEffect.type !== 'none') {
         textFilterId = 'svgTextEffect';
         const fdef = createFilterDef(styles, textFilterId);
         if (fdef) {
             svg += `  ${fdef}\n`;
         } else {
             console.warn("[RendererCore] Failed to create text filter definition, reverting ID.");
             textFilterId = null;
         }
    }

    // - background gradient (using validated styles.background)
    let bgGradientId = null;
    if (!config.transparentBackground && styles.background.type?.includes('gradient')) {
         bgGradientId = 'svgBgGradient';
         const bgdef = createBackgroundGradientDef(styles, bgGradientId);
         if (bgdef) {
             svg += `  ${bgdef}\n`;
         } else {
             // Log details if creation failed
             console.warn(`[RendererCore] Failed to create background gradient definition (Type: ${styles.background.type}). Reverting ID. Gradient Data:`, styles.background.gradient);
             bgGradientId = null; // Ensure ID is nullified if def failed
         }
    }

    // close <defs>
    svg += `</defs>\n`;

    // 5b) <style> inline CSS (Includes ONLY animation keyframes/class) using validated styles
    //      *** @font-face rules are NOT generated here - assumed handled externally by FontManager ***
    const embeddedCSS = generateEmbeddedCSS(styles, config.animationMetadata);
    if (embeddedCSS) {
         svg += `<style type="text/css"><![CDATA[\n${embeddedCSS}\n]]></style>\n`;
         console.log("[RendererCore] Embedded animation CSS.");
    } else {
         console.log("[RendererCore] No animation CSS to embed."); // Changed message
    }

    // 6) Draw the background rect (using validated styles.background)
    if (!config.transparentBackground && config.includeBackground) {
         const bgColor = normalizeColor(styles.background.color || '#000000', 'bg');
         const bgOp = parseFloat(styles.background.opacity === undefined ? 1 : styles.background.opacity); // Default opacity 1
         let fillSpec = 'none'; // Default

         // --- Revised Fill Logic ---
         // Check ID first (most specific, requires successful gradient creation)
         if (bgGradientId) { // Check the potentially nullified ID
             fillSpec = `url(#${bgGradientId})`;
             console.log("[RendererCore] Background fill: Using BG Gradient ID", bgGradientId);
         }
         // If no gradient ID, check the background type explicitly
         else if (styles.background.type === 'bg-solid') {
              if (bgColor && bgColor !== 'transparent' && !bgColor.startsWith('rgba(0,0,0,0') && !bgColor.startsWith('rgba(0, 0, 0, 0')) { // More robust check for transparency
                  fillSpec = bgColor;
                  console.log("[RendererCore] Background fill: Using Solid Color", bgColor);
              } else {
                   console.log("[RendererCore] Background fill: Solid type but color is transparent/missing. Fill is 'none'.");
              }
         }
         // Handle patterns or other types if ID is null and type isn't solid/gradient
         else if (!styles.background.type?.includes('gradient')) {
             // Use the base color for patterns etc., if it's not transparent
              if (bgColor && bgColor !== 'transparent' && !bgColor.startsWith('rgba(0,0,0,0') && !bgColor.startsWith('rgba(0, 0, 0, 0')) {
                  fillSpec = bgColor;
                  console.log("[RendererCore] Background fill: Using Base Color for Pattern/Other", bgColor);
              } else {
                  console.log("[RendererCore] Background fill: No explicit fill for pattern/other (transparent/default).");
              }
         }
         // If type *was* gradient but bgGradientId is null (creation failed), fillSpec remains 'none'

         const finalBgOp = Math.max(0, Math.min(1, bgOp));
         if (fillSpec !== 'none') {
              svg += `<rect width="100%" height="100%" fill="${fillSpec}"`;
              // Apply opacity ONLY if the fill itself isn't handling it (i.e., not a gradient URL, and not an rgba color)
              // Gradients handle opacity via stops. RGBA colors handle it intrinsically.
              // Apply rect opacity if fill is solid hex/named color AND background opacity < 1
              const fillOpacity = extractOpacityFromColor(fillSpec); // Check if fillSpec itself has opacity
              if (fillOpacity >= 1 && finalBgOp < 1 && !fillSpec.startsWith('url(#')) {
                   svg += ` opacity="${finalBgOp.toFixed(3)}"`;
                   console.log(`[RendererCore] Applying background rect opacity: ${finalBgOp.toFixed(3)}`);
              } else if (fillOpacity < 1) {
                   console.log(`[RendererCore] Background fill '${fillSpec}' includes opacity; rect opacity attribute skipped.`);
              } else if (finalBgOp < 1 && fillSpec.startsWith('url(#')) {
                   console.log(`[RendererCore] Background gradient handles opacity via stops; rect opacity attribute skipped.`);
              }
              svg += `/>\n`;
         } else {
              console.log("[RendererCore] Skipping background rect drawing (fillSpec ended up as 'none').");
         }
    } else {
         console.log("[RendererCore] Skipping background rect drawing (transparent requested or includeBackground=false).");
    }

    // 7) Container Opacity (Generally avoid applying at root level)
    // const containerOpacity = parseFloat(styles.containerOpacity || '1');

    // 8) Draw container border (if any) - Using a separate rect
     const borderInfo = styles.border; // Use potentially null border info from validated styles
     let strokeW = 0;
     let strokeColor = null;
     if (borderInfo && borderInfo.style && borderInfo.style !== 'none' && borderInfo.style !== 'hidden') { // Check if border object and style exist and are visible
         strokeColor = normalizeColor(borderInfo.color, 'container border');
         strokeW = parseFloat(borderInfo.width || '0');
     }
     // border radius (using validated styles)
     let rx = 0, ry = 0;
     if (styles.borderRadius) {
         // --- Stricter radius parsing ---
         const radiusValue = String(styles.borderRadius).trim();
         if (radiusValue === '50%') {
             rx = config.width / 2;
             ry = config.height / 2;
         } else if (radiusValue.endsWith('px') || /^\d+(\.\d+)?$/.test(radiusValue)) {
              const parsedRadius = parseFloat(radiusValue) || 0;
              rx = ry = Math.max(0, parsedRadius); // Ensure non-negative
         } else if (radiusValue.includes('%')) {
              // Handle potentially different % values for x/y - simplistic approach here
              const parts = radiusValue.split(/\s+/);
              const percX = parseFloat(parts[0]) || 0;
              const percY = parseFloat(parts[1] || parts[0]) || 0; // Use first if second missing
              rx = Math.max(0, (config.width * percX) / 100);
              ry = Math.max(0, (config.height * percY) / 100);
              console.warn(`[RendererCore] Using percentage border-radius (${radiusValue}) for SVG rx/ry: rx=${rx.toFixed(1)}, ry=${ry.toFixed(1)}.`);
         } else {
              // Handle multi-value radii (e.g., "10px 20px 30px 40px") - complex for SVG rx/ry
              // SVG rx/ry only takes one value each. We'll simplify and use the first value.
              const radiusMatch = radiusValue.match(/(\d+(?:\.\d+)?)/);
              if (radiusMatch) {
                   rx = ry = parseFloat(radiusMatch[0]) || 0;
                   console.warn(`[RendererCore] Complex border-radius value "${radiusValue}" simplified to rx=ry=${rx} for SVG.`);
              } else {
                   console.warn(`[RendererCore] Cannot parse border-radius value "${radiusValue}", using 0.`);
                   rx = ry = 0;
              }
         }
         console.log(`[RendererCore] Calculated border radius rx=${rx.toFixed(1)}, ry=${ry.toFixed(1)}`);
     }

     // Draw border rect if valid stroke
     if (strokeColor && strokeW > 0) {
         const strokeOp = extractOpacityFromColor(strokeColor); // Check opacity from border color itself
         // Adjust rect position/size for stroke width to keep it inside the bounds
         const inset = strokeW / 2;
         const rectW = Math.max(0, config.width - strokeW); // Ensure non-negative width/height
         const rectH = Math.max(0, config.height - strokeW);
         // Adjust radius for stroke width (don't let it go negative)
         const effectiveRx = Math.max(0, rx - inset);
         const effectiveRy = Math.max(0, ry - inset);
         const borderColor = normalizeColor(styles.border?.color || styles.borderColorPicker || '#ffffff', 'border');
         console.log(`[RendererCore] Border color: Using ${borderColor} from styles`);
         
         svg += `  <rect x="${inset.toFixed(2)}" y="${inset.toFixed(2)}" width="${rectW.toFixed(2)}" height="${rectH.toFixed(2)}" rx="${effectiveRx.toFixed(2)}" ry="${effectiveRy.toFixed(2)}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}"`;

         if (borderInfo?.dasharray) svg += ` stroke-dasharray="${escapeSVGAttribute(borderInfo.dasharray)}"`; // Use optional chaining and escape
         svg += `/>\n`;
         console.log(`[RendererCore] Added border rect: stroke=${strokeColor}, width=${strokeW}`);
     }


    // 9) Add the <text> element (using validated styles)
    // Pass potentially nullified gradient/filter IDs
    svg += generateTextElement(styles, textGradientId, textFilterId, config);

    // Close svg
    svg += `</svg>`;

    // ---> Optional: Log Final SVG for Debugging <---
    // const debugSVG = false; // Set to true to log
    // if (debugSVG) {
    //     console.log("--- FINAL GENERATED SVG ---");
    //     console.log(svg);
    //     console.log("---------------------------");
    // }
    // ---> End Optional Log <---

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    console.log(`[RendererCore] generateSVGBlob finished => Blob size: ${(blob.size / 1024).toFixed(1)} KB`);
    return blob;
}
// ---> Updated generateTextElement <---
/**
 * Creates the <text> element with styles, gradients, filters, and animations.
 * Uses validated styles object. Includes improved transform handling and CORRECT font quoting.
 * Assumes required font-family is loaded via external FontManager.
 * @param {object} styles - Captured styles object (already validated in generateSVGBlob).
 * @param {string|null} textGradId - ID for the text gradient definition, or null.
 * @param {string|null} filterId - ID for the text filter definition, or null.
 * @param {object} config - Runtime config { width, height, animationMetadata, text }.
 * @returns {string} The SVG <text> element string.
 */
function generateTextElement(styles, textGradId, filterId, config) {
    // Debug the text content and font information
    console.log("[RendererCore DEBUG - TextEl] Text content:", styles.textContent);
    console.log("[RendererCore DEBUG - TextEl] Font details:", styles.font);
    console.log("[RendererCore DEBUG - TextEl] Color mode:", styles.color?.mode);

    // text content (use validated styles.textContent)
    const text = styles.textContent.transformedText ||
                 styles.textContent.finalText ||
                 styles.textContent.originalText ||
                 config.text || 'Logo';
    const escapedTxt = escapeXML(text);

    // Alignment (xPos determined based on textAnchor)
    let xPos = '50%'; // Default center
    let textAnchor = styles.textAnchor || 'middle';
    const padding = parseFloat(styles.borderPadding || styles.padding || '0') || 0;
    if (textAnchor === 'start') {
        xPos = `${padding + 5}px`; // Adjust as needed
    } else if (textAnchor === 'end') {
        xPos = `${config.width - padding - 5}px`; // Adjust as needed
    }
    const yPos = '50%';
    const dominantBaseline = "middle";
    console.log(`[RendererCore DEBUG - TextEl] Text alignment: anchor=${textAnchor}, x=${xPos}, y=${yPos}`);

    // Font properties (use validated styles.font)
    const fontSizeRaw = parseFloat(styles.font.size || '80') || 80;
    const letterSpacing = styles.font.letterSpacing || 'normal';
    const fontWeight = styles.font.weight || '400';
    const fontStyle = styles.font.style || 'normal';

    // --- CORRECTED FONT FAMILY HANDLING for SVG attribute ---
    let fontFamilyAttrValue = 'sans-serif'; // Default fallback
    if (styles.font && styles.font.family) {
        let familyName = styles.font.family.trim().replace(/^['"]|['"]$/g, ''); // Get name, remove existing quotes
        // Quote if it contains spaces
        if (familyName.includes(' ')) {
            // Use single quotes inside the attribute value - simpler and valid SVG/CSS
            familyName = `'${familyName}'`;
        }
        // Add fallback
        fontFamilyAttrValue = `${familyName}, sans-serif`;
        console.log(`[RendererCore DEBUG - TextEl] Using font-family attribute value: ${fontFamilyAttrValue}`);
    }

    // Color or Gradient Fill (logic unchanged)
    let fillAttr = 'none';
    if (styles.color.mode === 'gradient' && textGradId) {
        fillAttr = `url(#${textGradId})`;
        console.log('[RendererCore DEBUG - TextEl] Applying TEXT GRADIENT fill:', fillAttr);
    } else {
        const solidColorValue = styles.color.value || '#ffffff'; // Fallback white
        const c = normalizeColor(solidColorValue, 'text');
        fillAttr = c || '#ffffff'; // Use normalized or fallback
        console.log('[RendererCore DEBUG - TextEl] Applying SOLID fill:', fillAttr);
    }

    // Overall Text Opacity (logic unchanged)
    const textOpacity = parseFloat(styles.opacity === undefined ? 1 : styles.opacity);
    const finalTextOp = Math.max(0, Math.min(1, textOpacity));
    let opacityAttr = '';
    if (finalTextOp < 1) {
        opacityAttr = ` opacity="${finalTextOp.toFixed(3)}"`;
    }

    // Stroke handling (logic unchanged)
    let strokeSnippet = '';
    if (styles.textStroke?.width && styles.textStroke?.color) {
        const sc = normalizeColor(styles.textStroke.color, 'text stroke');
        let sw = parseFloat(styles.textStroke.width || '0');
        if (sc && sw > 0) {
            strokeSnippet = ` stroke="${sc}" stroke-width="${sw}"`;
        }
    }

    // Transform handling (logic unchanged)
    let transformAttr = '';
    if (styles.transform?.cssValue) {
        const svgTransformValue = normalizeCSSTransformForSVG(styles.transform.cssValue);
        if (svgTransformValue) {
            transformAttr = ` transform="${escapeSVGAttribute(svgTransformValue)}"`;
        }
    }

    // Animation Class (logic unchanged)
    const animClass = config.animationMetadata?.class || '';
    let classAttr = '';
    if (animClass && animClass !== 'anim-none') {
        classAttr = ` class="${escapeSVGAttribute(animClass)}"`;
    }

    // Construct the <text> element with all properties
    let textEl = `<text x="${xPos}" y="${yPos}" dominant-baseline="${dominantBaseline}" text-anchor="${textAnchor}"`;
    // ---> Use the correctly prepared fontFamilyAttrValue <---
    textEl += ` font-family="${escapeSVGAttribute(fontFamilyAttrValue)}"`; // Escape the final value
    textEl += ` font-size="${fontSizeRaw.toFixed(1)}px"`;

    if (fontWeight && fontWeight !== '400' && fontWeight !== 400)
        textEl += ` font-weight="${fontWeight}"`;

    if (fontStyle && fontStyle !== 'normal')
        textEl += ` font-style="${fontStyle}"`;

    if (letterSpacing && letterSpacing !== 'normal' && letterSpacing !== '0px' && letterSpacing !== '0') {
        const spacing = String(letterSpacing); // Ensure it's a string
        const spacingUnit = spacing.endsWith('em') || spacing.endsWith('px') ? spacing : spacing + 'em'; // Add em if unitless
        textEl += ` letter-spacing="${spacingUnit}"`;
    }

    textEl += ` fill="${fillAttr}"`; // Apply calculated fill
    textEl += opacityAttr; // Apply overall opacity if needed

    if (filterId) {
        textEl += ` filter="url(#${filterId})"`;
    }

    textEl += strokeSnippet; // Add stroke attributes
    textEl += transformAttr; // Add transform attribute
    textEl += classAttr; // Add animation class attribute

    // Add text content
    textEl += `>${escapedTxt}</text>\n`;

    console.log('[RendererCore DEBUG - TextEl] Text element generated successfully:', textEl); // Log the final element
    return textEl;
}

// ---> Updated generateEmbeddedCSS <---
/**
 * Generates inlined <style> text containing @font-face (if embeddable) and animation rules.
 * Uses CORRECT CSS quoting for font family names.
 * @param {object} styles - Captured styles object (validated).
 * @param {object|null} animationMetadata - Object from extractSVGAnimationDetails, or null.
 * @returns {string|null} CSS string or null if no content.
 */
function generateEmbeddedCSS(styles, animationMetadata) {
    let css = "/* Embedded CSS from RendererCore */\n";
    let hasContent = false;

    // --- Font Embedding ---
    if (styles.font?.family) {
        let familyNameRaw = styles.font.family.trim();
        // Prepare name for CSS: Quote if it contains spaces and isn't already quoted
        let familyNameForCSS = familyNameRaw.replace(/^['"]|['"]$/g, ''); // Remove existing quotes first
        if (familyNameForCSS.includes(' ')) {
             // Use double quotes for CSS font-family, escape internal double quotes
            familyNameForCSS = `"${familyNameForCSS.replace(/"/g, '\\"')}"`;
        }
        console.log(`[Embed CSS] Preparing CSS for font family: ${familyNameForCSS}`);

        css += `@font-face {\n`;
        css += `  font-family: ${familyNameForCSS};\n`; // Use potentially quoted name

        if (styles.font.embedDataUrl) {
            css += `  src: url("${styles.font.embedDataUrl}") format("woff2");\n`; // Data URL doesn't need quotes escaped
            console.log(`[Embed CSS] Using embedded font data URL for ${familyNameForCSS}`);
        } else {
            console.log(`[Embed CSS] No font data URL for ${familyNameForCSS}, SVG will rely on system/external fonts.`);
            // Optional: Add local() source for system lookup?
            // css += `  src: local(${familyNameForCSS});\n`;
        }

        css += `  font-weight: ${styles.font.weight || 'normal'};\n`;
        css += `  font-style: ${styles.font.style || 'normal'};\n`;
        // Optional: Add font-display for better loading behavior if not embedding all
        css += `  font-display: block;\n`; // Or swap, fallback etc.
        css += `}\n\n`;
        hasContent = true;
    }

    // --- Animation Keyframes & Class ---
     let hasAnimationContent = false; // Track animation rules separately
     if (animationMetadata && animationMetadata.name && animationMetadata.name !== 'none') {
         const keyframes = getAnimationKeyframes(animationMetadata.name); // Ensure this function is available and imported
         if (keyframes) {
             css += `/* Keyframes for ${animationMetadata.name} */\n${keyframes}\n\n`;
             hasAnimationContent = true; // Added keyframes
             const classCSS = generateAnimationClassCSS(animationMetadata); // Ensure this function is available and imported
             if (classCSS) {
                 css += `/* Animation Class Definition */\n${classCSS}\n`;
                 console.log(`[Embed CSS DEBUG] Added animation class definition for .${animationMetadata.class}`);
                 // No need to set hasAnimationContent again
             } else {
                 console.warn(`[Embed CSS DEBUG] Animation '${animationMetadata.name}' has keyframes but generateAnimationClassCSS returned null.`);
             }
         } else {
             console.warn(`[Embed CSS DEBUG] Keyframes *NOT* found for animation '${animationMetadata.name}'.`);
         }
     } else {
         console.log(`[Embed CSS DEBUG] No active animation metadata found.`);
     }
     // Update main flag if animation was added
     if (hasAnimationContent) {
         hasContent = true;
     }

    if (!hasContent) {
        console.log("[Embed CSS DEBUG] No font or animation content generated for <style> tag.");
        return null;
    }
    return css.trim();
}

// -----------------------------------------------------------------------
// 5. convertSVGtoPNG
// -----------------------------------------------------------------------
/**
 * convertSVGtoPNG
 * Renders the given SVG blob to a PNG using HTMLImageElement + canvas.
 * Attempts to maintain aspect ratio based on SVG dimensions.
 * RELIES ON BROWSER correctly applying externally loaded fonts referenced in the SVG.
 *
 * @param {Blob} svgBlob - The SVG blob to convert.
 * @param {object} options - { width, height, transparentBackground, quality }
 * @returns {Promise<Blob>} A PNG Blob.
 */
export async function convertSVGtoPNG(svgBlob, options={}) {
    const targetWidth = parseInt(options.width || '800');
    const targetHeight = parseInt(options.height || '400');
    const quality = parseFloat(options.quality || '0.95'); // PNG quality isn't really a thing like JPEG, but some browsers might use it for compression hints?
    const transparent = !!options.transparentBackground; // Background handled by SVG itself, canvas should be clear

    return new Promise((resolve, reject) => {
         if (!(svgBlob instanceof Blob)) {
             return reject(new Error("convertSVGtoPNG: invalid svgBlob provided."));
         }
         if (targetWidth <= 0 || targetHeight <= 0) {
             return reject(new Error(`convertSVGtoPNG: invalid target dimensions ${targetWidth}x${targetHeight}.`));
         }

         // Create an object URL for the SVG blob
         const url = URL.createObjectURL(svgBlob);
         const img = new Image();

         img.onload = () => {
             console.log(`[convertSVGtoPNG] Image loaded from SVG Blob URL. Natural dims: ${img.naturalWidth}x${img.naturalHeight}`);
             // *** CRITICAL: If naturalWidth/Height are 0 or small, it might indicate the font wasn't ready/applied ***
             if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                 console.warn(`[convertSVGtoPNG] WARNING: SVG loaded with 0 dimensions. This might indicate issues rendering content, potentially including unloaded fonts.`);
                 // Attempt to read SVG dimensions as fallback, but warn user font might be wrong.
             }
             try {
                 // Use natural dimensions from loaded SVG for aspect ratio calculation
                 let natW = img.naturalWidth;
                 let natH = img.naturalHeight;

                 if (natW <= 0 || natH <= 0) {
                     // Try to parse width/height from SVG root element as fallback
                     const reader = new FileReader();
                     reader.onload = (e) => {
                         const svgText = e.target.result;
                         const widthMatch = svgText.match(/<svg[^>]+width="(\d+(?:\.\d+)?)"/);
                         const heightMatch = svgText.match(/<svg[^>]+height="(\d+(?:\.\d+)?)"/);
                         const fallbackW = widthMatch ? parseFloat(widthMatch[1]) : targetWidth;
                         const fallbackH = heightMatch ? parseFloat(heightMatch[1]) : targetHeight;
                         console.warn(`[convertSVGtoPNG] SVG loaded with invalid natural dimensions (${natW}x${natH}). Using dimensions from SVG tag or target: ${fallbackW}x${fallbackH}. FONT RENDERING MAY BE INCORRECT.`);
                         proceedWithRender(fallbackW, fallbackH);
                     };
                     reader.onerror = (err) => {
                         console.error("[convertSVGtoPNG] Error reading SVG blob text as fallback.", err);
                         URL.revokeObjectURL(url);
                         reject(new Error("SVG loaded but has invalid natural dimensions (0x0) and reading SVG failed. Font rendering likely failed."));
                     };
                     reader.readAsText(svgBlob);
                     return; // Wait for reader to finish
                 } else {
                     // Proceed with valid natural dimensions
                     proceedWithRender(natW, natH);
                 }

             } catch(e) {
                 console.error("[convertSVGtoPNG] Error during initial load processing:", e);
                 URL.revokeObjectURL(url); // Clean up blob URL
                 reject(e);
             }
         };

         const proceedWithRender = (sourceW, sourceH) => {
              try {
                  // Scale to target dimensions while preserving aspect ratio
                  let finalW = targetWidth;
                  let finalH = Math.round(finalW * (sourceH / sourceW));

                  // If calculated height exceeds target, scale based on height instead
                  if (finalH > targetHeight) {
                      finalH = targetHeight;
                      finalW = Math.round(finalH * (sourceW / sourceH));
                  }
                  // Ensure final dimensions are at least 1x1
                  finalW = Math.max(1, finalW);
                  finalH = Math.max(1, finalH);
                  console.log(`[convertSVGtoPNG] Canvas render target size: ${finalW}x${finalH} (preserving aspect ratio from ${sourceW}x${sourceH})`);

                  const canvas = document.createElement('canvas');
                  canvas.width = finalW;
                  canvas.height = finalH;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) {
                      URL.revokeObjectURL(url);
                      throw new Error("Could not get 2D context from canvas.");
                  }

                  // Clear canvas (important for transparency)
                   ctx.clearRect(0, 0, finalW, finalH);

                   // Draw the loaded SVG image onto the canvas
                   // The browser should use the externally loaded @font-face rules here.
                   // If the font wasn't loaded/applied, text might be missing or fallback.
                   ctx.drawImage(img, 0, 0, finalW, finalH);

                   // Convert canvas to PNG Blob
                   canvas.toBlob(blob => {
                       URL.revokeObjectURL(url); // Clean up blob URL now
                       if (!blob) {
                           // This can happen if the canvas is tainted (e.g., cross-origin SVG issues, though unlikely here)
                           // or sometimes if dimensions are excessively large.
                           return reject(new Error("Canvas toBlob returned null. PNG conversion failed. Canvas might be tainted or dimensions too large. Check for SVG rendering errors (like missing fonts)."));
                       }
                       console.log(`[convertSVGtoPNG] PNG Blob created successfully. Size: ${(blob.size/1024).toFixed(1)} KB`);
                       resolve(blob);
                   }, 'image/png', quality); // Specify format (quality is less relevant for PNG)

              } catch(e) {
                   console.error("[convertSVGtoPNG] Error during canvas rendering:", e);
                   URL.revokeObjectURL(url); // Clean up blob URL
                   reject(e);
              }
         }

         img.onerror = e => {
             URL.revokeObjectURL(url); // Clean up blob URL
             console.error("[convertSVGtoPNG] Image load error. The generated SVG might be invalid, contain unsupported features, OR THE REQUIRED FONT WAS NOT LOADED/APPLIED by the browser.", e);
             // Try reading the SVG content to provide more debug info
             const reader = new FileReader();
             reader.onload = (readEvent) => {
                 const svgContent = readEvent.target.result;
                 console.error("[convertSVGtoPNG] SVG Content (first 500 chars):", svgContent.substring(0, 500));
                 reject(new Error("convertSVGtoPNG: Failed to load the generated SVG into an image. Check console for SVG content snippet and potential errors (including font issues)."));
             };
             reader.onerror = (readErr) => {
                 console.error("[convertSVGtoPNG] Failed to read SVG content after load error.", readErr);
                 reject(new Error("convertSVGtoPNG: Failed to load the generated SVG into an image, and failed to read SVG content for debugging. Font loading is a likely cause."));
             };
             reader.readAsText(svgBlob);
         };

         console.log("[convertSVGtoPNG] Setting Image src to SVG Blob URL (browser will apply external fonts if available)...");
         img.src = url; // Start loading the SVG blob into the image
    });
}


// -----------------------------------------------------------------------
// 6. generateAnimationFrames
// -----------------------------------------------------------------------
/**
 * Generates a sequence of PNG frames based on an animated SVG.
 * NOTE: This current implementation renders the SVG *statically* for each frame.
 * It does NOT capture the CSS animation state at different points in time.
 * It generates identical PNGs based on the initial render of the animated SVG.
 * True frame capture requires more advanced techniques (e.g., manipulating animation-delay/play-state per frame).
 * RELIES ON EXTERNAL FONT MANAGER.
 *
 * @param {object} options
 * - width, height (target frame dimensions)
 * - frameCount (how many identical frames to generate)
 * - transparent (background transparency)
 * - preCapturedStyles (optional, styles object to use for SVG generation)
 * - onProgress callback (receives progress fraction and message)
 * @returns {Promise<Blob[]>} array of PNG blobs (currently identical).
 */
export async function generateAnimationFrames(options={}) {
    const width = parseInt(options.width || 800);
    const height = parseInt(options.height || 400);
    const frameCount = Math.max(1, Math.min(options.frameCount || 15, 120)); // Sensible limits
    const transparent = !!options.transparent;
    const onProgress = options.onProgress;
    const preCapturedStyles = options.preCapturedStyles || null; // Use passed styles

    console.log(`[RendererCore] Generating ${frameCount} frames at ${width}x${height}, transparent=${transparent}`);
    if (preCapturedStyles) {
         console.log("[RendererCore generateAnimationFrames] Using pre-captured styles.");
    }

    // Get base animation details *once*
    // We need styles to determine animation, so capture if not provided
    let stylesToUse = preCapturedStyles;
    if (!stylesToUse) {
         try {
             console.log("[RendererCore generateAnimationFrames] Capturing styles for animation check...");
             stylesToUse = await captureAdvancedStyles();
             if (!stylesToUse) throw new Error("Style capture failed for animation check.");
         } catch (e) {
             console.error("[RendererCore generateAnimationFrames] Failed to get styles for animation check:", e);
             throw new Error(`Failed to get styles for frame generation: ${e.message}`);
         }
    }
    // *** Ensure font family exists in styles ***
    if (!stylesToUse?.font?.family) {
        console.error("[RendererCore generateAnimationFrames] CRITICAL: Cannot generate frames, font family missing in styles object.", stylesToUse);
        throw new Error("Cannot generate frames: Font family missing in provided/captured styles.");
    }
    console.log(`[RendererCore generateAnimationFrames] Using font family: '${stylesToUse.font.family}' (Ensure it's loaded via FontManager).`);

    // Now extract animation details (can be done even if styles were passed)
    const baseAnim = extractSVGAnimationDetails(stylesToUse.targetElement); // Pass element if needed by extractSVGAnimationDetails

    if (!baseAnim || baseAnim.name === 'none') {
         console.warn("[RendererCore generateAnimationFrames] No active animation detected => generating 1 static frame only.");
         if (onProgress) onProgress(0, "No animation detected, generating static frame...");
         try {
             // Generate SVG using the determined styles (captured or passed)
             const svgBlob = await generateSVGBlob({
                 width, height, transparentBackground: transparent,
                 preCapturedStyles: stylesToUse // Pass the styles object
             });
             const pngBlob = await convertSVGtoPNG(svgBlob, { width, height, transparentBackground: transparent });
             if (onProgress) onProgress(1, "1 static frame generated.");
             return [pngBlob];
         } catch (e) {
              console.error("[RendererCore] Error generating single static frame:", e);
              throw new Error(`Failed to generate static frame: ${e.message}`);
         }
    }
     console.log("[RendererCore] Base animation details for frame generation:", baseAnim);
     console.warn("[RendererCore generateAnimationFrames] NOTE: Generating static renders of the animated SVG. CSS animation state over time is NOT captured.");


    const frames = [];
    let baseSvgBlob = null; // Generate the SVG once

    try {
         if (onProgress) onProgress(0, `Generating base animated SVG...`);
         // Generate the base animated SVG using the determined styles
         baseSvgBlob = await generateSVGBlob({
             width, height, transparentBackground: transparent,
             // animationMetadata: baseAnim, // Included via preCapturedStyles -> generateEmbeddedCSS now
             preCapturedStyles: stylesToUse // Pass the styles object (contains font/anim info needed)
         });
         if (!baseSvgBlob) throw new Error("Failed to generate base SVG for frames.");

    } catch (e) {
         console.error("[RendererCore] Failed to generate base SVG for frames:", e);
         throw new Error(`Failed generating base SVG: ${e.message}`);
    }


    for (let i = 0; i < frameCount; i++) {
         const progress = (frameCount <= 1) ? 1 : (i + 1) / frameCount; // Progress 0 to 1
         const currentFrameNum = i + 1;
         try {
             if (onProgress) {
                 const pc = Math.round(progress * 100);
                 onProgress(progress, `Converting frame ${currentFrameNum}/${frameCount}... (${pc}%)`);
             }

             // --- Static Conversion ---
             // Convert the *same* base animated SVG to PNG for each frame.
             // convertSVGtoPNG renders the SVG statically at its initial state (or how the browser renders it immediately).
             // It relies on the browser applying fonts loaded via FontManager.
             const png = await convertSVGtoPNG(baseSvgBlob, { width, height, transparentBackground: transparent });
             frames.push(png);
             // --- End Static Conversion ---

              // Optional small delay to potentially help browser responsiveness
              // await new Promise(res => setTimeout(res, 5));

         } catch (e) {
             console.error(`[RendererCore] Frame ${currentFrameNum} conversion failed:`, e);
             // Option: Allow continuing? For now, fail fast.
             throw new Error(`Failed converting frame ${currentFrameNum}: ${e.message}`);
         }
    }

    if (onProgress) onProgress(1, `${frames.length} frames generated (Static render of animated SVG)`);
    return frames;
}

// -----------------------------------------------------------------------
// 7. generateConsistentPreview
// -----------------------------------------------------------------------
/**
 * Generates a (SVG or PNG) preview for UI usage. Updates an <img> with dataURL.
 * Accepts preCapturedStyles option and passes it down. Handles loading states.
 * RELIES ON EXTERNAL FONT MANAGER.
 * @param {object} options - { width?, height?, transparentBackground?, preCapturedStyles?, frameCount? }
 * @param {HTMLImageElement | null} previewImg - The <img> element to update (optional)
 * @param {HTMLElement | null} loadingEl - Loading indicator element (optional)
 * @param {string} [exportType='svg'] - 'svg','png','gif' (determines preview type)
 * @returns {Promise<{ blob:Blob, dataUrl: string, frames?: Blob[] }>} Contains the primary blob (SVG/PNG/First GIF frame), its dataUrl, and potentially all GIF frames.
 */
export async function generateConsistentPreview(options, previewImg, loadingEl, exportType = 'svg') {
    // --- Show Loading State ---
    if (loadingEl) {
         loadingEl.style.display = 'flex'; // Or 'block', 'inline-block' etc.
         const pText = loadingEl.querySelector('.progress-text') || loadingEl;
         pText.textContent = 'Generating preview...';
         // Optional: Reset progress bar if present
         const pBar = loadingEl.querySelector('.progress-bar-inner');
         if (pBar) pBar.style.width = '0%';
    }
    if (previewImg) {
         previewImg.style.display = 'none'; // Hide image while loading
         previewImg.removeAttribute('src'); // Remove old source
         previewImg.alt = "Generating preview...";
    }

    // --- Use a Promise to handle async flow and resolve/reject ---
    return new Promise(async (resolve, reject) => {
         try {
             let result = { blob: null, dataUrl: null, frames: undefined }; // Initialize result structure
             const w = options.width || 400; // Default preview width
             const h = options.height || 300; // Default preview height
             const transparent = options.transparentBackground || false;
             const preCapturedStyles = options.preCapturedStyles || null; // Get passed styles

             console.log(`[RendererCore Preview] Generating preview. Type: ${exportType}, Target Size: ${w}x${h}, Transparent: ${transparent}`);
             if (preCapturedStyles) {
                 console.log("[RendererCore Preview] Using pre-captured styles.");
                 // *** Add Check: Ensure font family exists in styles for preview ***
                 if (!preCapturedStyles?.font?.family) {
                    throw new Error("Cannot generate preview: Font family missing in pre-captured styles.");
                 }
                 console.log(`[RendererCore Preview] Using font family: '${preCapturedStyles.font.family}' (Ensure it's loaded via FontManager).`);
             } else {
                 // If not using pre-captured, generateSVGBlob/generateAnimationFrames will capture them
                 // and perform their own checks.
                 console.log("[RendererCore Preview] Styles will be captured internally if needed.");
             }


             // --- Generate Based on Type ---
             if (exportType === 'gif') {
                 // Generate a small number of frames for GIF preview
                 // Show the first frame statically in the preview <img>
                 const framesCount = Math.min(options.frameCount || 15, 10); // Reduced frames for faster preview generation
                 console.log(`[RendererCore Preview] Generating ${framesCount} frames for GIF preview (will display first frame)...`);

                 // ---> Pass styles down to frame generation <---
                 const frames = await generateAnimationFrames({
                     width: w, height: h, frameCount: framesCount, transparent,
                     preCapturedStyles: preCapturedStyles, // Pass styles down
                     onProgress: (prog, msg) => {
                         if (loadingEl) {
                             const pEl = loadingEl.querySelector('.progress-text') || loadingEl;
                             pEl.textContent = msg || `Generating GIF preview... ${Math.round(prog * 100)}%`;
                             const pBarInner = loadingEl.querySelector('.progress-bar-inner');
                             if (pBarInner) pBarInner.style.width = `${Math.round(prog * 100)}%`;
                         }
                     }
                 });

                 if (!frames || frames.length === 0) throw new Error("No frames generated for GIF preview.");

                 result.blob = frames[0]; // Use first frame blob for the main result
                 result.frames = frames; // Store all generated frames in the result object
                 result.dataUrl = await blobToDataURL(frames[0]); // Data URL of the first frame for the <img>
                 console.log("[RendererCore Preview] GIF preview frames generated. First frame ready.");

             } else { // SVG or PNG preview
                 console.log("[RendererCore Preview] Generating base SVG blob...");
                 // ---> PASS STYLES TO SVG BLOB GENERATION <---
                 const svgBlob = await generateSVGBlob({
                     width: w, height: h,
                     transparentBackground: transparent,
                     preCapturedStyles: preCapturedStyles // Pass styles object down (or null)
                 });
                 if (!svgBlob) throw new Error("Base SVG blob generation failed for preview.");

                 if (exportType === 'png') {
                     // Convert SVG to PNG for the preview
                     console.log("[RendererCore Preview] Converting SVG to PNG for preview...");
                      if (loadingEl) (loadingEl.querySelector('.progress-text') || loadingEl).textContent = 'Converting to PNG...';
                     result.blob = await convertSVGtoPNG(svgBlob, { width: w, height: h, transparentBackground: transparent });
                     if (!result.blob) throw new Error("SVG to PNG conversion for preview failed.");
                     console.log("[RendererCore Preview] PNG preview blob generated.");
                 } else {
                     // Use the SVG blob directly for the preview
                     result.blob = svgBlob;
                     console.log("[RendererCore Preview] SVG preview blob generated.");
                 }
                 // Create data URL from the final blob (either SVG or PNG)
                 result.dataUrl = await blobToDataURL(result.blob);
                 if (!result.dataUrl) throw new Error("Failed to create Data URL for preview.");
             }

             // --- Update UI ---
             if (previewImg && result.dataUrl) {
                 let previewLoaded = false; // Flag to prevent multiple fires

                 previewImg.onload = () => {
                     if (previewLoaded) return;
                     previewLoaded = true;
                     if (loadingEl) loadingEl.style.display = 'none'; // Hide loader on success
                     previewImg.style.display = 'block'; // Or 'inline-block' etc.
                     previewImg.alt = `${exportType.toUpperCase()} Preview`;
                     console.log("[RendererCore Preview] Preview image successfully loaded into <img> tag.");
                     resolve(result); // Resolve the promise *after* image loads successfully
                 };

                 previewImg.onerror = (errorEvent) => { // Capture error event
                     if (previewLoaded) return;
                     previewLoaded = true;
                     if (loadingEl) {
                         loadingEl.style.display = 'flex'; // Keep loader visible on error
                         (loadingEl.querySelector('.progress-text') || loadingEl).textContent = "Preview Load Failed";
                         const pBarInner = loadingEl.querySelector('.progress-bar-inner');
                         if (pBarInner) pBarInner.style.width = '100%'; // Show error state in bar? Or hide bar?
                     }
                     previewImg.style.display = 'none'; // Keep image hidden
                     previewImg.alt = `${exportType.toUpperCase()} preview failed to load.`;
                     // ---> Log the specific error <---
                     console.error("[RendererCore Preview] Error loading preview data URL into <img> tag. Potential SVG invalidity, browser issue, OR FONT NOT APPLIED.", errorEvent);
                     // ---> Optionally log the Data URL itself (can be huge, use with caution) <---
                     // console.error("Data URL (first 200 chars):", result.dataUrl.substring(0, 200) + "...");
                     // Resolve with the generated data even if the <img> fails, the blob/url might still be useful.
                     // Or reject, depending on desired behavior. Let's resolve but log the error.
                     resolve(result); // Resolve anyway, but warn about load failure
                 };

                 // Add slight delay before setting src? Sometimes helps render race conditions, might not be needed.
                  await new Promise(res => setTimeout(res, 5)); // Tiny delay
                 previewImg.src = result.dataUrl; // Set the source to trigger load/error

             } else {
                 // No preview image tag provided, just resolve with the data
                 if (loadingEl) loadingEl.style.display = 'none'; // Hide loader
                 console.log("[RendererCore Preview] No preview image element provided. Resolving with blob/dataUrl.");
                 resolve(result);
             }

         } catch (e) {
             // --- Handle Errors During Generation ---
             console.error("[RendererCore Preview] Error during preview generation:", e);
             if (loadingEl) {
                 loadingEl.style.display = 'flex'; // Ensure loader shows error state
                 (loadingEl.querySelector('.progress-text') || loadingEl).textContent = "Preview Generation Failed";
                 const pBarInner = loadingEl.querySelector('.progress-bar-inner');
                 if (pBarInner) pBarInner.style.width = '100%'; // Visually indicate error
             }
             if (previewImg) {
                 previewImg.style.display = 'none'; // Ensure image stays hidden
                 previewImg.alt = "Preview Failed";
             }
             reject(e); // Reject the promise on error
         }
    });
}


console.log("[RendererCore v2.9 - Integrated with FontManager] Module loaded successfully.");