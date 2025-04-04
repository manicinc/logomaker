/**
 * RendererCore.js 
 * ====================================================
 * Centralized rendering pipeline for SVG, PNG and GIF exports.
 */

// Import the standardized style capture function
import { captureAdvancedStyles } from '../captureTextStyles.js'; // Adjust path if needed
// Import helpers for animation details
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js'; // Adjust path if needed

console.log("[RendererCore] Module loading (v2.3)...");

// --- Helper Functions (v2.3 Updates) ---

/** Converts a Blob to a Data URL string. */
function blobToDataURL(blob) {
    if (!(blob instanceof Blob)) {
        console.error("[Core Util] blobToDataURL: Invalid input, expected Blob.", blob);
        return Promise.reject(new Error("Invalid input: Expected a Blob."));
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = (errEvent) => {
            console.error("[Core Util] FileReader error:", errEvent);
            reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown'}`));
        };
        reader.readAsDataURL(blob);
    });
}

/**
 * Normalizes CSS color values for SVG attributes, handling transparency and basic formats.
 * Returns color string or null if fully transparent.
 */
function normalizeColor(color, context = "color") {
    // No longer need the debug check here if definition order is correct
    if (!color || typeof color !== 'string') {
        // console.warn(`[Core Util] normalizeColor (${context}): Invalid color input "${color}", defaulting to null (transparent).`); // Reduce log noise
        return null; // Represent full transparency as null
    }
    const trimmedColor = color.trim().toLowerCase();
    if (trimmedColor === 'transparent' || trimmedColor === 'none' || trimmedColor === 'rgba(0,0,0,0)') {
        return null; // Represent full transparency as null
    }
    if (trimmedColor.startsWith('#') || trimmedColor.startsWith('rgb')) {
        return trimmedColor;
    }
    const simpleColors = { 'white': '#ffffff', 'black': '#000000', 'red': '#ff0000', 'blue': '#0000ff', 'green': '#008000', 'yellow': '#ffff00', 'purple': '#800080', 'orange': '#ffa500' };
    if (simpleColors[trimmedColor]) return simpleColors[trimmedColor];
    console.warn(`[Core Util] normalizeColor (${context}): Unrecognized color format "${trimmedColor}", returning as is.`);
    return trimmedColor;
}

// **** FORCE GLOBAL AVAILABILITY ****
if (typeof window !== 'undefined') {
    window.normalizeColor = normalizeColor;
    console.log('[RendererCore] normalizeColor ATTACHED to window scope.');
} else {
   console.warn('[RendererCore] window scope not available, normalizeColor cannot be attached globally.');
}

/** Extracts the alpha value from an rgba or hsla string, returns 1 otherwise. */
export function extractOpacityFromColor(colorString) {
    if (!colorString || typeof colorString !== 'string') return 1;
    const lowerColor = colorString.toLowerCase();
    if (lowerColor.startsWith('rgba') || lowerColor.startsWith('hsla')) {
        try {
            // Robustly find the last comma and parse the value after it
            const parts = lowerColor.substring(lowerColor.indexOf('(') + 1, lowerColor.indexOf(')')).split(',');
            if (parts.length > 3) { // Check if alpha value exists
                 const alphaStr = parts[parts.length - 1].trim();
                 const alpha = parseFloat(alphaStr);
                 if (!isNaN(alpha)) {
                    return Math.max(0, Math.min(1, alpha)); // Clamp between 0 and 1
                 }
            }
        } catch (e) { console.error(`[Core Util] Error parsing opacity from ${colorString}:`, e); }
    }
    return 1; // Default to fully opaque
}


/** Escapes characters problematic in XML attributes (use single quotes for attributes). */
function escapeSVGAttribute(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, "'"); // Use single quotes within attributes
}

/** Escapes characters problematic in XML text content. */
function escapeXML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
}

/** Create SVG linear gradient definition for text fill */
function createGradientDef(styles, gradientId) {
    if (styles.color?.mode !== 'gradient' || !gradientId || !styles.color.gradient) return '';
    console.log(`[Core Defs] Creating text gradient #${gradientId}.`);

    if (styles.color?.mode !== 'gradient' || !gradientId || !styles.color.gradient) return '';
    // console.log(`[Core Defs] Creating text gradient #${gradientId}.`); // Reduce noise
    const gradientInfo = styles.color.gradient;
    const colors = gradientInfo.colors || [];
    if (colors.length < 2) { console.warn(`[Core Defs] Text gradient needs at least 2 colors, found ${colors.length}. Skipping def.`); return ''; }
    const c1 = normalizeColor(colors[0], 'text gradient c1');
    const c2 = normalizeColor(colors[1], 'text gradient c2');
    const c3 = colors.length > 2 ? normalizeColor(colors[2], 'text gradient c3') : null;
    const useC3 = !!c3;
    const dir = parseFloat(gradientInfo.direction || '180');
    const angleRad = (dir - 90) * Math.PI / 180;
    const x1 = (0.5 - Math.cos(angleRad) * 0.5).toFixed(4);
    const y1 = (0.5 - Math.sin(angleRad) * 0.5).toFixed(4);
    const x2 = (0.5 + Math.cos(angleRad) * 0.5).toFixed(4);
    const y2 = (0.5 + Math.sin(angleRad) * 0.5).toFixed(4);
    let stops = '';
    if (useC3) {
         stops = `<stop offset="0%" stop-color="${c1 || '#000'}" stop-opacity="${extractOpacityFromColor(colors[0])}"/><stop offset="50%" stop-color="${c2 || '#000'}" stop-opacity="${extractOpacityFromColor(colors[1])}"/><stop offset="100%" stop-color="${c3 || '#000'}" stop-opacity="${extractOpacityFromColor(colors[2])}"/>`;
    } else {
         stops = `<stop offset="0%" stop-color="${c1 || '#000'}" stop-opacity="${extractOpacityFromColor(colors[0])}"/><stop offset="100%" stop-color="${c2 || '#000'}" stop-opacity="${extractOpacityFromColor(colors[1])}"/>`;
    }
    return `<linearGradient id="${gradientId}" gradientUnits="objectBoundingBox" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
}


/** Create SVG filter definition for text effects (shadow/glow) */
function createFilterDef(styles, filterId) {
    // Use styles.textEffect (updated name)

    if (!filterId || !styles?.textEffect?.type || styles.textEffect.type === 'none') return '';
    // console.log(`[Core Defs] Creating filter #${filterId}. Effect:`, styles.textEffect); // Reduce noise
    const { type, color, blur = 0, dx = 0, dy = 0, opacity = 0.75 } = styles.textEffect;
    const normalizedColor = normalizeColor(color, 'filter color');
    const effectOpacity = Math.max(0, Math.min(1, opacity));
    const safeBlur = Math.max(0, blur);
    if (!normalizedColor) return '';
    let filterContent = '';
    if (type === 'shadow' && safeBlur < 1) {
         filterContent = `<feDropShadow dx="${dx}" dy="${dy}" stdDeviation="0" flood-color="${normalizedColor}" flood-opacity="${effectOpacity}"/>`;
    } else if (type === 'glow' || (type === 'shadow' && safeBlur >= 1)) {
        filterContent = `<feGaussianBlur in="SourceAlpha" stdDeviation="${safeBlur}" result="blur"/><feOffset dx="${dx}" dy="${dy}" result="offsetBlur"/><feFlood flood-color="${normalizedColor}" flood-opacity="${effectOpacity}" result="flood"/><feComposite in="flood" in2="offsetBlur" operator="in" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>`;
    } else { return ''; }
    return `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">${filterContent}</filter>`;
}


/** Create SVG linear gradient definition for background */
function createBackgroundGradientDef(styles, id) {
    if (!id || !styles?.background?.gradient) return '';
    // console.log(`[Core Defs] Creating background gradient #${id}.`); // Reduce noise
    const gradientInfo = styles.background.gradient;
    const colors = gradientInfo.colors || [];
    if (colors.length < 2) return '';
    const c1 = normalizeColor(colors[0], 'bg gradient c1');
    const c2 = normalizeColor(colors[1], 'bg gradient c2');
    if (!c1 && !c2) return '';
    const dir = parseFloat(gradientInfo.direction || '180');
    const angleRad = (dir - 90) * Math.PI / 180;
    const x1 = (0.5 - Math.cos(angleRad) * 0.5).toFixed(4);
    const y1 = (0.5 - Math.sin(angleRad) * 0.5).toFixed(4);
    const x2 = (0.5 + Math.cos(angleRad) * 0.5).toFixed(4);
    const y2 = (0.5 + Math.sin(angleRad) * 0.5).toFixed(4);
    const stops = `<stop offset="0%" stop-color="${c1 || 'rgba(0,0,0,0)'}" stop-opacity="${extractOpacityFromColor(colors[0])}"/><stop offset="100%" stop-color="${c2 || 'rgba(0,0,0,0)'}" stop-opacity="${extractOpacityFromColor(colors[1])}"/>`;
    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">${stops}</linearGradient>`;
}

/** Generate embedded CSS including font face and animations (v2.3 - Keyframe Name Fix Verified) */
function generateEmbeddedCSS(styleData, animationMetadata) {
    console.log('[Core CSS] Generating embedded CSS. Animation Metadata:', animationMetadata);
    let css = "/* Embedded CSS - Logomaker Core v2.3 */\n";

    // Font embedding
    const fontEmbedData = styleData?.font?.embedData;
    if (fontEmbedData?.file && styleData?.font?.family) {
         const primaryFont = styleData.font.family.split(',')[0].trim().replace(/['"]/g, '');
         css += `/* Embedded Font: ${primaryFont} */\n`;
         css += `@font-face {\n`;
         css += `  font-family: "${primaryFont}";\n`;
         css += `  src: url(${fontEmbedData.file});\n`; // File is already base64 data URL
         css += `  font-weight: ${fontEmbedData.weight || '400'};\n`;
         css += `  font-style: ${fontEmbedData.style || 'normal'};\n`;
         css += `}\n\n`;
         console.log(`[Core CSS] Embedded font ${primaryFont} (Weight: ${fontEmbedData.weight}, Style: ${fontEmbedData.style})`);
    } else {
        console.warn('[Core CSS] No embeddable font data found.');
    }

    // Animation embedding
    if (animationMetadata?.name && animationMetadata.name !== 'none') {
        const keyframesCSS = styleData?.animation?.activeKeyframes;
        if (keyframesCSS) {
            let originalKeyframeName = animationMetadata.name;
            const keyframeNameMatch = keyframesCSS.match(/@keyframes\s+([a-zA-Z0-9-_]+)/);
            if (keyframeNameMatch && keyframeNameMatch[1]) originalKeyframeName = keyframeNameMatch[1];
            css += `/* Animation: ${animationMetadata.name} */\n${keyframesCSS}\n\n`;
            const animClass = styleData?.animation?.class || `anim-${animationMetadata.name}`;
            const duration = styleData?.animation?.duration || '2s';
            const timingFunc = styleData?.animation?.timingFunction || 'ease';
            const iterCount = styleData?.animation?.iterationCount || 'infinite';
            css += `.${animClass} {\n  animation: ${originalKeyframeName} ${duration} ${timingFunc} ${iterCount};\n`;
            if (styleData?.color?.mode === 'gradient') {
                css += `  -webkit-background-clip: text; background-clip: text;\n  color: transparent; -webkit-text-fill-color: transparent;\n`;
             }
             css += `}\n\n`;
        } else { console.warn(`[Core CSS] No keyframes CSS found for animation: ${animationMetadata.name}.`); }
    }
    return css.trim() ? css : null;
}

/** Generates the SVG background rectangle (v2.3 - Pattern Placeholders) */
function createBackgroundRect(styles, bgGradientId, config) {
    if (!config.includeBackground || config.transparentBackground) {
         console.log("[Core SVG] Skipping background rect (transparent or excluded).");
         return '';
    }
    if (!styles?.background) {
        console.warn("[Core SVG] No background styles found, defaulting to black background rect.");
        return `<rect width="100%" height="100%" fill="#000000" opacity="1"/>\n`;
    }

    const bgType = styles.background.type || 'bg-solid';
    const bgColor = normalizeColor(styles.background.color || '#000000', 'bg color'); // Default black if needed
    const bgOpacity = parseFloat(styles.background.opacity || '1');
    const patternClass = styles.background.patternClass;

    let bgFill = 'none'; // Default if no match

    if (bgType.includes('gradient') && bgGradientId) {
        bgFill = `url(#${bgGradientId})`;
        console.log(`[Core SVG] Background Rect: Using Gradient fill="${bgFill}"`);
    } else if (patternClass) {
        // Placeholder for pattern generation
        const patternId = `pattern-${patternClass.replace(/^bg-/, '')}`;
        console.warn(`[Core SVG] Background Rect: Pattern "${patternClass}" detected. SVG pattern generation not fully implemented. Using fallback color.`);
        // Apply pattern fill ID (even if pattern def is missing) + fallback solid color
        bgFill = `url(#${patternId})`;
        // In a full implementation, you'd add a fallback fill using the background color
        // For now, let's just use the fill ID and the base rect will have the background color underneath.
        // Alternatively, we could just use the background color directly:
        // bgFill = bgColor || '#000000'; // Use normalized color, fallback black
    } else if (bgColor) { // Includes bg-solid or bg-image/other types with a color
        bgFill = bgColor;
         console.log(`[Core SVG] Background Rect: Using Solid fill="${bgFill}"`);
    } else {
        // If type is solid/image but color is transparent/null
         console.log(`[Core SVG] Background Rect: Type is ${bgType} but color is transparent. Skipping fill.`);
         bgFill = 'none'; // Explicitly none
    }

    // Ensure opacity is valid
    const finalOpacity = isNaN(bgOpacity) ? 1 : Math.max(0, Math.min(1, bgOpacity));

    // Only return rect if it has a fill
    if (bgFill !== 'none') {
        return `<rect id="background-rect" width="100%" height="100%" fill="${escapeSVGAttribute(bgFill)}" opacity="${escapeSVGAttribute(finalOpacity)}"/>\n`;
    } else {
        console.log(`[Core SVG] Background rect has no fill, omitting.`);
        return '';
    }
}
/** 
 * Creates the SVG text element (v2.4 - Improved Positioning & Alignment)
 * @param {string} textContent - The final text to display.
 * @param {object} styles - The captured styles object from captureAdvancedStyles.
 * @param {string|null} textGradientId - The ID of the text gradient definition.
 * @param {string|null} textFilterId - The ID of the text effect filter.
 * @param {string|null} borderFilterId - The ID of the border glow filter.
 * @param {object|null} animationMetadata - Animation details (may include progress).
 * @returns {string} The generated SVG <text> element string.
 */
function generateSVGTextElement(textContent, styles, textGradientId, textFilterId, borderFilterId, animationMetadata) {
    console.log("[Core SVG] Generating SVG text element. Text:", textContent);
    if (!styles?.font) {
        console.error("[Core SVG] Cannot generate text element: Missing font styles");
        return '';
    }

    const font = styles.font;
    const color = styles.color || { mode: 'solid', value: '#ffffff' };
    // Distinguish between text stroke and container border
    const textStroke = styles.stroke?.isTextStroke ? styles.stroke : 
                     (styles.textStroke || null);
    // Container border is handled separately by a <rect> now
    const textEffect = styles.textEffect || {};
    const anim = styles.animation || {};
    const transform = styles.transform || {};
    const textOpacity = parseFloat(styles.opacity || '1');

    // Dynamic positioning based on text alignment
    let xPosition = '50%'; // Default (center)
    let textAnchor = styles.textAnchor || 'middle';
    
    // Override based on textAlign if present
    if (styles.textAlign) {
        if (styles.textAlign === 'left') {
            textAnchor = 'start';
            xPosition = '5%'; // Left aligned with some padding
        } else if (styles.textAlign === 'right') {
            textAnchor = 'end';
            xPosition = '95%'; // Right aligned with some padding
        } else if (styles.textAlign === 'center') {
            textAnchor = 'middle';
            xPosition = '50%';
        }
    }
    
    console.log(`[Core SVG] Text alignment: ${styles.textAlign || 'none'}, anchor: ${textAnchor}, xPos: ${xPosition}`);

    let textElement = `<text x="${xPosition}" y="50%" `;
    textElement += `text-anchor="${textAnchor}" `;
    textElement += `dominant-baseline="middle" `; // Keep middle as default baseline

    // Font attributes
    textElement += `font-family="${font.family ? escapeSVGAttribute(font.family) : 'sans-serif'}" `;
    textElement += `font-size="${font.size || '60px'}" `;
    if (font.weight && font.weight !== '400') textElement += `font-weight="${font.weight}" `;
    if (font.style && font.style !== 'normal') textElement += `font-style="${font.style}" `;
    if (font.letterSpacing && font.letterSpacing !== 'normal') textElement += `letter-spacing="${font.letterSpacing}" `;

    // Fill/Color
    let fillOpacity = 1.0;
    if (color.mode === 'gradient' && textGradientId) {
        textElement += `fill="url(#${textGradientId})" `;
        console.log(`[Core SVG Text] Applied gradient fill: url(#${textGradientId})`);
        // Opacity from gradient stops is handled in createGradientDef
    } else {
        const fillColor = normalizeColor(color.value || '#ffffff', 'text fill');
        if (fillColor) {
             textElement += `fill="${fillColor}" `;
             fillOpacity = extractOpacityFromColor(color.value); // Get opacity from color string
             console.log(`[Core SVG Text] Applied solid fill: ${fillColor} (Opacity from color: ${fillOpacity})`);
        } else {
             textElement += `fill="none" `; // Explicitly no fill if color is transparent
             console.log(`[Core SVG Text] Text fill color is transparent.`);
        }
    }

    // Text Opacity (Combine with fill opacity)
    const finalOpacity = Math.max(0, Math.min(1, isNaN(textOpacity) ? 1 : textOpacity)) * fillOpacity;
    if (finalOpacity < 1) {
        textElement += `opacity="${finalOpacity.toFixed(3)}" `;
        console.log(`[Core SVG Text] Applied combined opacity: ${finalOpacity.toFixed(3)}`);
    }

    // Text Stroke (Only if specifically set via text-stroke)
    if (textStroke) {
        const strokeColor = normalizeColor(textStroke.color, 'text stroke');
        const strokeWidth = parseFloat(textStroke.width) || 1;
        if (strokeColor && strokeWidth > 0) {
            textElement += `stroke="${strokeColor}" `;
            textElement += `stroke-width="${strokeWidth}" `;
            const strokeOpacity = extractOpacityFromColor(textStroke.color);
            if (strokeOpacity < 1) {
                textElement += `stroke-opacity="${strokeOpacity.toFixed(3)}" `;
            }
            console.log(`[Core SVG Text] Applied TEXT stroke: Color=${strokeColor}, Width=${strokeWidth}, Opacity=${strokeOpacity.toFixed(3)}`);
        }
    } else {
         console.log(`[Core SVG Text] No direct text stroke detected.`);
    }

    // Apply filters - prioritize border filter if present
    if (borderFilterId) {
        textElement += `filter="url(#${borderFilterId})" `;
        console.log(`[Core SVG Text] Applied border filter: url(#${borderFilterId})`);
    } else if (textFilterId) {
        textElement += `filter="url(#${textFilterId})" `;
        console.log(`[Core SVG Text] Applied text effect filter: url(#${textFilterId})`);
    }

    // Transform (Rotation, etc.) - Normalize CSS transforms for SVG
    if (transform.cssValue && transform.cssValue !== 'none') {
        const normalizedTransform = normalizeCSSTransformForSVG(transform.cssValue);
        textElement += `transform="${escapeSVGAttribute(normalizedTransform)}" `;
        console.log(`[Core SVG Text] Applied transform: ${normalizedTransform}`);
    }

    // Animation Class
    const animClass = anim.class;
    if (animClass && animClass !== 'anim-none') {
         textElement += `class="${animClass}" `; // Apply class for embedded CSS animation
         console.log(`[Core SVG Text] Applied animation class: ${animClass}`);
    }

    // Animation Frame Override (Inline Style) - Only for frame generation, not final export usually
    let animationStyleOverride = '';
    if (animationMetadata?.progress !== undefined && anim.durationMs) {
         const delayMs = -(animationMetadata.progress * anim.durationMs);
         animationStyleOverride = `animation-delay: ${delayMs.toFixed(0)}ms; animation-play-state: paused;`;
         console.log(`[Core SVG Text] Applied animation override for progress ${animationMetadata.progress.toFixed(2)}`);
         textElement += `style="${escapeSVGAttribute(animationStyleOverride)}" `;
    }

    // Close opening tag and add escaped text content
    const finalText = styles.textContent?.transformedText || textContent || 'Logo';
    const escapedText = escapeXML(finalText);
    textElement += `>`;
    textElement += escapedText;
    textElement += `</text>`;

    return textElement;
}

/**
 * Helper to normalize CSS transforms for SVG
 * @param {string} cssTransform - CSS transform value
 * @returns {string} Normalized transform for SVG
 */
function normalizeCSSTransformForSVG(cssTransform) {
    if (!cssTransform) return '';
    
    // Handle matrix transforms - they work the same in SVG
    if (cssTransform.includes('matrix')) {
        return cssTransform;
    }
    
    // Handle potential comma separators in transform functions
    return cssTransform.replace(/,\s+/g, ' ');
}

/**


/**
 * Main function to generate the SVG Blob (v2.3).
 */
export async function generateSVGBlob(options = {}) {
    console.log("[Core SVG Gen v2.3] generateSVGBlob called. Options received:", JSON.stringify(options));

    try {
        // --- 1. Capture Styles ---
        const styles = captureAdvancedStyles();
        if (!styles) throw new Error('Failed to capture styles for SVG generation');
        console.log("[Core SVG Gen v2.3] Styles Captured."); // Keep details out of final log unless debugging

        // --- 2. Determine Configuration ---
        const currentSettings = window.SettingsManager?.getCurrentSettings?.() || {}; // Fetch settings once
        const defaults = {
            width: parseInt(styles.exportConfig?.width || '800'),
            height: parseInt(styles.exportConfig?.height || '400'),
            text: styles.textContent?.finalText || 'Logo',
            includeBackground: true,
            transparentBackground: styles.exportConfig?.transparent ?? options.transparentBackground ?? false,
            animationMetadata: options.animationMetadata || extractSVGAnimationDetails() // Get animation info if not passed in
        };
        const config = { ...defaults, ...options }; // Merge options over defaults

        if (!config.width || config.width <= 0 || !config.height || config.height <= 0) {
            console.warn(`[Core SVG Gen v2.3] Invalid dimensions: ${config.width}x${config.height}. Falling back.`);
            config.width = 800; config.height = 400;
        }
        console.log("[Core SVG Gen v2.3] Final Config:", config);

        // --- 3. Build SVG String ---
        let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">\n`;

        // --- 4. Definitions (`<defs>`) ---
        svg += `<defs>\n`;
        svg += `  \n`;
        let textGradientId = null;
        let backgroundGradientId = null;
        let textFilterId = null;
        // Placeholder for SVG patterns if implemented
        if (styles.background?.patternClass) {
             svg += `  \n`;
        }

        // Text Gradient
        if (styles.color?.mode === 'gradient') {
            textGradientId = 'svgTextGradient';
            const gradientDef = createGradientDef(styles, textGradientId);
            if (gradientDef) { svg += `  ${gradientDef}\n`; console.log("[Core SVG Gen v2.3] Added Text Gradient Definition."); }
            else { textGradientId = null; }
        }

        // Text Effect Filter
        // Use styles.textEffect (updated name)
        if (styles.textEffect?.type && styles.textEffect.type !== 'none') {
            textFilterId = 'svgTextEffect';
            const filterDef = createFilterDef(styles, textFilterId);
            if (filterDef) { svg += `  ${filterDef}\n`; console.log(`[Core SVG Gen v2.3] Added Text Effect Filter (ID: ${textFilterId}).`); }
            else { textFilterId = null; }
        }

        // Background Gradient (only if needed and not transparent)
         if (config.includeBackground && !config.transparentBackground &&
             (styles.background?.type?.includes('gradient') || styles.background?.gradient)) {
             backgroundGradientId = 'svgBgGradient';
             const bgGradientDef = createBackgroundGradientDef(styles, backgroundGradientId); // Pass only styles now
             if (bgGradientDef) { svg += `  ${bgGradientDef}\n`; console.log("[Core SVG Gen v2.3] Added Background Gradient Definition."); }
             else { backgroundGradientId = null; }
         }

        svg += `</defs>\n`;

        // --- 5. Embedded CSS (`<style>`) ---
        const embeddedCSS = generateEmbeddedCSS(styles, config.animationMetadata);
        if (embeddedCSS) {
             svg += `<style type="text/css"><![CDATA[\n${embeddedCSS}\n]]></style>\n`;
             console.log("[Core SVG Gen v2.3] Embedded CSS added.");
        }

        // --- 6. Background Rectangle (`<rect>`) ---
        const bgRect = createBackgroundRect(styles, backgroundGradientId, config);
        if (bgRect) { svg += bgRect; } // Already includes newline

        // --- 7. Main Content Group (for Opacity) ---
        const containerOpacity = parseFloat(styles.containerOpacity || '1');
        const finalContainerOpacity = Math.max(0, Math.min(1, isNaN(containerOpacity) ? 1 : containerOpacity));
        svg += `<g id="logo-content-group" opacity="${finalContainerOpacity.toFixed(3)}">\n`;
        console.log(`[Core SVG Gen v2.3] Added content group with opacity: ${finalContainerOpacity.toFixed(3)}`);

        // --- 8. Container Border Rectangle (NEW) ---
        // Only add if styles.border exists AND it's NOT a text stroke
        if (styles.border && !styles.stroke?.isTextStroke) {
            const border = styles.border;
            const strokeColor = normalizeColor(border.color, 'container border');
            const strokeWidth = parseFloat(border.width);

            if (strokeColor && strokeWidth > 0) {
                 let borderRect = `  <rect id="container-border-rect" x="${strokeWidth / 2}" y="${strokeWidth / 2}" `;
                 borderRect += `width="${config.width - strokeWidth}" height="${config.height - strokeWidth}" `;
                 borderRect += `fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" `;

                 const strokeOpacity = extractOpacityFromColor(border.color);
                 if (strokeOpacity < 1) {
                     borderRect += `stroke-opacity="${strokeOpacity.toFixed(3)}" `;
                 }
                 if (border.dasharray) {
                     borderRect += `stroke-dasharray="${border.dasharray}" `;
                 }
                 // Note: Applying border.isGlow filter here is complex. Would need to duplicate the rect inside the filter def or use advanced techniques.
                 // Adding a comment instead for now.
                 if (border.isGlow) {
                    borderRect += `/> \n`;
                    console.warn(`[Core SVG Gen v2.3] Container border glow detected but not fully rendered in SVG.`);
                 } else {
                    borderRect += `/>\n`;
                 }
                 svg += borderRect;
                 console.log(`[Core SVG Gen v2.3] Added container border rect: ${border.style}, ${border.color}, ${border.width}`);
            }
        }

        // --- 9. Text Element (`<text>`) ---
        const textElement = generateSVGTextElement(
            config.text, styles, textGradientId, textFilterId, config.animationMetadata
        );
        if (textElement) {
             svg += `  ${textElement}\n`;
             console.log("[Core SVG Gen v2.3] Text element generated.");
        }
        else { console.error("[Core SVG Gen v2.3] Failed to generate text element!"); }

        // --- 10. Close Content Group ---
        svg += `</g>\n`;

        // --- 11. Close SVG ---
        svg += `</svg>`;

        // --- 12. Create Blob ---
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        console.log(`[Core SVG Gen v2.3] SVG Blob generated successfully. Size: ${(blob.size / 1024).toFixed(1)} KB`);
        return blob;

    } catch (error) {
        console.error('[Core SVG Gen v2.3] SVG Blob Generation Failed:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`SVG Generation Failed: ${errMsg}`);
    }
}


// --- PNG Conversion (Relies on generateSVGBlob - Unchanged conceptually) ---
export async function convertSVGtoPNG(svgBlob, options = {}) {
     return new Promise(async (resolve, reject) => { // Make outer function async
        const { width = 800, height = 400, /* quality ignored for PNG */ transparentBackground = false } = options;
        console.log(`[Core PNG] Converting SVG to PNG. Options:`, {width, height, transparentBackground});

        if (!(svgBlob instanceof Blob)) {
             return reject(new Error("Invalid SVG Blob provided for PNG conversion."));
        }

         let url = null; // Declare URL outside try block
         try {
             url = URL.createObjectURL(svgBlob);
             const img = new Image();

             img.onload = () => {
                 console.log("[Core PNG] SVG Image loaded for canvas drawing.");
                 try {
                     const canvas = document.createElement('canvas');
                     canvas.width = width;
                     canvas.height = height;
                     const ctx = canvas.getContext('2d');
                     ctx.clearRect(0, 0, width, height);
                     ctx.drawImage(img, 0, 0, width, height);
                     console.log("[Core PNG] SVG drawn to canvas.");

                     canvas.toBlob(
                         blob => {
                             URL.revokeObjectURL(url); // Clean up here
                             if (blob) {
                                 console.log(`[Core PNG] PNG Blob created. Size: ${(blob.size / 1024).toFixed(1)} KB`);
                                 resolve(blob);
                             } else {
                                 console.error('[Core PNG] canvas.toBlob failed, returned null.');
                                 reject(new Error('Failed to convert canvas to PNG blob.'));
                             }
                         },
                         'image/png'
                     );
                 } catch (err) {
                     if(url) URL.revokeObjectURL(url); // Cleanup on inner error too
                     console.error('[Core PNG] Canvas drawing or toBlob conversion failed:', err);
                     reject(new Error(`Canvas conversion failed: ${err.message}`));
                 }
             };

             img.onerror = (errEvent) => {
                 if(url) URL.revokeObjectURL(url); // Cleanup on image load error
                 console.error('[Core PNG] Failed to load SVG blob into Image:', errEvent);
                 reject(new Error('Failed to load SVG image for PNG conversion. Check SVG content.'));
             };

             img.src = url; // Start loading
         } catch (setupError) {
             // Catch errors related to createObjectURL or Image creation
             if (url) URL.revokeObjectURL(url); // Cleanup if URL was created
             console.error('[Core PNG] Error setting up SVG image loading:', setupError);
             reject(new Error(`Setup for PNG conversion failed: ${setupError.message}`));
         }
    });
}

// --- Animation Frame Generation (Relies on generateSVGBlob - Unchanged) ---
export async function generateAnimationFrames(options = {}) {
    const { width = 800, height = 400, frameCount = 15, transparent = false, onProgress = null } = options;
    console.log(`[Core Frames] Generating ${frameCount} frames (${width}x${height}). Transparent: ${transparent}`);
    const frames = [];
    const baseAnimationMetadata = extractSVGAnimationDetails();

    if (!baseAnimationMetadata || baseAnimationMetadata.name === 'none') {
        console.warn('[Core Frames] No active animation detected. Generating 1 static frame.');
        try {
            const svgBlob = await generateSVGBlob({ width, height, transparentBackground: transparent });
            const pngBlob = await convertSVGtoPNG(svgBlob, { width, height, transparentBackground: transparent });
            if (onProgress) onProgress(1, `Generated 1 static frame`);
            return [pngBlob];
        } catch (error) {
             console.error('[Core Frames] Error generating static frame:', error); throw error;
        }
    }
    console.log("[Core Frames] Base Animation Metadata:", baseAnimationMetadata);

    for (let i = 0; i < frameCount; i++) {
        const progress = frameCount <= 1 ? 0 : i / (frameCount - 1);
        if (onProgress) {
            const percent = Math.round((i / frameCount) * 100);
            onProgress(percent / 100, `Generating frame ${i + 1}/${frameCount} (${percent}%)...`);
        }
        // Add check for cancellation flag if implemented in onProgress context
        // if (window.exportCancelled) throw new Error("Export Cancelled");

        try {
            const frameAnimationMetadata = { ...baseAnimationMetadata, progress: progress };
            const svgBlob = await generateSVGBlob({ width, height, transparentBackground: transparent, animationMetadata: frameAnimationMetadata });
            const pngBlob = await convertSVGtoPNG(svgBlob, { width, height, transparentBackground: transparent, quality: 1 });
            frames.push(pngBlob);
            // console.log(`[Core Frames] Generated frame ${i + 1}/${frameCount}`); // Reduce log noise
        } catch (error) {
            console.error(`[Core Frames] Error generating frame ${i + 1}:`, error);
            throw new Error(`Failed to generate frame ${i + 1}: ${error.message}`);
        }
    }
    console.log(`[Core Frames] Successfully generated ${frames.length} frame blobs.`);
    if (onProgress) onProgress(1, `Generated ${frames.length} frames.`);
    return frames;
}


// --- Preview Generation (Relies on generateSVGBlob/convertSVGtoPNG - Unchanged) ---
export function generateConsistentPreview(options, previewImg, loadingElement, exportType = 'svg') {
    console.log(`[Core Preview] Generating preview for type: ${exportType}. Options:`, options);
    if (loadingElement) loadingElement.style.display = 'flex';
    if (previewImg) { previewImg.style.display = 'none'; previewImg.removeAttribute('src'); previewImg.alt = "Generating preview..."; }

    return new Promise(async (resolve, reject) => {
        try {
            let result = { blob: null };
            const previewWidth = options.width || 400; // Use smaller defaults for preview
            const previewHeight = options.height || 300;
            const transparent = options.transparentBackground || false;

            if (exportType === 'gif') {
                 // Generate fewer frames for GIF preview loop
                const previewFrameCount = Math.min(options.frameCount || 15, 10);
                console.log(`[Core Preview GIF] Generating ${previewFrameCount} frames.`);
                const frames = await generateAnimationFrames({ width: previewWidth, height: previewHeight, frameCount: previewFrameCount, transparent, onProgress: (prog, msg) => { if (loadingElement) { const txt = loadingElement.querySelector('.progress-text') || loadingElement; txt.textContent = msg || `Generating preview... (${Math.round(prog*100)}%)`; } } });
                if (!frames || frames.length === 0) throw new Error("Failed to generate preview frames");
                result.blob = frames[0];
                result.frames = frames; // Include preview frames
                result.dataUrl = await blobToDataURL(frames[0]); // Data URL for first frame
            } else {
                // SVG or PNG preview
                const svgBlob = await generateSVGBlob({ width: previewWidth, height: previewHeight, transparentBackground: transparent });
                if (exportType === 'png') {
                    result.blob = await convertSVGtoPNG(svgBlob, { width: previewWidth, height: previewHeight, transparentBackground: transparent });
                } else {
                    result.blob = svgBlob;
                }
                result.dataUrl = await blobToDataURL(result.blob);
            }

            // Update UI
            if (previewImg && result.dataUrl) {
                 previewImg.onload = () => { console.log(`[Core Preview] ${exportType.toUpperCase()} preview loaded.`); if (loadingElement) loadingElement.style.display = 'none'; previewImg.style.display = 'block'; previewImg.alt = `${exportType.toUpperCase()} Export Preview`; };
                 previewImg.onerror = () => { console.error(`[Core Preview] Failed to load ${exportType.toUpperCase()} preview.`); if (loadingElement) loadingElement.style.display = 'none'; previewImg.style.display = 'block'; previewImg.alt = `${exportType.toUpperCase()} Preview Failed`; };
                 previewImg.src = result.dataUrl;
            } else { if (loadingElement) loadingElement.style.display = 'none'; }

            resolve(result);

        } catch (error) {
            console.error(`[Core Preview] Error generating ${exportType} preview:`, error);
            if (loadingElement) { loadingElement.style.display = 'flex'; (loadingElement.querySelector('.progress-text') || loadingElement).textContent = "Preview Failed!"; }
            if (previewImg) { previewImg.style.display = 'none'; previewImg.alt = "Preview Failed"; }
            reject(error);
        }
    });
}


console.log("[RendererCore] Module loaded.");