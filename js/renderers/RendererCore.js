/**
 * RendererCore.js (v2.6 - Corrected Transform/Filter Calls)
 * =========================================================
 * Centralized rendering pipeline for SVG, PNG and GIF exports.
 * Includes core helpers for SVG generation, PNG conversion, and frame generation.
 */

// Import necessary functions from other modules
import { captureAdvancedStyles } from '../captureTextStyles.js'; // Adjust path if needed
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js'; // Adjust path if needed

console.log("[RendererCore] Module loading (v2.6)...");

// ==========================================================================
// === Core Helper Functions ================================================
// ==========================================================================

/**
 * Converts a Blob to a Data URL string.
 * @param {Blob} blob - The input Blob.
 * @returns {Promise<string>} A promise resolving with the Data URL.
 */
export function blobToDataURL(blob) {
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
 * Normalizes CSS color values for SVG attributes.
 * Handles transparency, hex, rgb, rgba, and basic named colors.
 * Returns a valid SVG color string or null if fully transparent/invalid.
 * @param {string|null} color - CSS color string.
 * @param {string} [context="color"] - Optional context for logging.
 * @returns {string|null} Normalized color string or null.
 */
function normalizeColor(color, context = "color") {
    if (!color || typeof color !== 'string') {
        // console.warn(`[Core Util] normalizeColor (${context}): Invalid color input "${color}", defaulting to null (transparent).`);
        return null; // Treat invalid input as transparent
    }
    const trimmedColor = color.trim().toLowerCase();
    if (trimmedColor === 'transparent' || trimmedColor === 'none' || trimmedColor === 'rgba(0,0,0,0)' || trimmedColor === 'rgba(0, 0, 0, 0)') {
        return null; // Represent full transparency as null
    }
    // Standard hex, rgb, rgba should pass through
    if (trimmedColor.startsWith('#') || trimmedColor.startsWith('rgb')) {
        return trimmedColor; // Return directly
    }
    // Basic named colors map
    const simpleColors = { 'white': '#ffffff', 'black': '#000000', 'red': '#ff0000', 'blue': '#0000ff', 'green': '#008000', 'yellow': '#ffff00', 'purple': '#800080', 'orange': '#ffa500', 'gray': '#808080', 'silver': '#c0c0c0' };
    if (simpleColors[trimmedColor]) {
         return simpleColors[trimmedColor];
    }
    // If unrecognized, warn and return original (might be valid SVG color name)
    console.warn(`[Core Util] normalizeColor (${context}): Unrecognized color format "${trimmedColor}", returning as is.`);
    return trimmedColor;
}

// Force global availability IF NEEDED by other non-module scripts (generally avoid this)
if (typeof window !== 'undefined' && !window.normalizeColor) {
    window.normalizeColor = normalizeColor;
    console.log('[RendererCore] normalizeColor ATTACHED to window scope (if not already present).');
}

/**
 * Extracts the alpha value (0 to 1) from an rgba or hsla string.
 * Returns 1 if no alpha or format is different.
 * @param {string|null} colorString - CSS color string.
 * @returns {number} Opacity value between 0 and 1.
 */
export function extractOpacityFromColor(colorString) {
    if (!colorString || typeof colorString !== 'string') return 1;
    const lowerColor = colorString.toLowerCase();
    if (lowerColor.startsWith('rgba') || lowerColor.startsWith('hsla')) {
        try {
            // Find the last comma and parse the value after it
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

/**
 * Escapes characters problematic in SVG attributes delimited by double quotes.
 * @param {string|null} str - Input string.
 * @returns {string} Escaped string.
 */
function escapeSVGAttribute(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;') // Escape double quotes for use within attribute="value"
              .replace(/'/g, '&apos;'); // Also escape single quotes just in case
}

/**
 * Escapes characters problematic in XML/SVG text content.
 * @param {string|null} str - Input string.
 * @returns {string} Escaped string.
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
 * Helper to normalize CSS transforms for SVG (Basic Implementation).
 * NOTE: This is basic. A robust solution converts all functions to SVG matrix.
 * @param {string} cssTransform - CSS transform value (e.g., "rotate(-4deg)").
 * @returns {string} Normalized transform for SVG (e.g., "rotate(-4)") or empty string.
 */
function normalizeCSSTransformForSVG(cssTransform) {
    if (!cssTransform || typeof cssTransform !== 'string' || cssTransform === 'none') {
        return ''; // Return empty string if no transform
    }

    // Pass matrix() transforms directly as they are compatible
    if (cssTransform.includes('matrix')) {
        console.log('[Normalize Transform] Passing matrix through:', cssTransform);
        return cssTransform;
    }

    // Basic attempt to convert rotate(Ndeg) to rotate(N)
    // WARNING: This does NOT handle the center of rotation correctly for SVG automatically.
    const rotateMatch = cssTransform.match(/rotate\(\s*(-?[\d.]+)(deg)?\s*\)/);
    if (rotateMatch && rotateMatch[1]) {
        const angle = parseFloat(rotateMatch[1]);
        const svgRotate = `rotate(${angle})`; // Basic SVG rotate
        console.warn(`[Normalize Transform] Basic conversion: CSS "${cssTransform}" -> SVG "${svgRotate}". Center point might differ.`);
        // Return ONLY the rotate part for simplicity, assuming it's the only transform
        // A combined transform needs full parsing or matrix conversion.
        return svgRotate;
    }

    // Handle potential comma separators in other functions (like translate, scale)
    const commaRemoved = cssTransform.replace(/,\s+/g, ' ');
    if (commaRemoved !== cssTransform) {
        console.log(`[Normalize Transform] Removed commas: "${cssTransform}" -> "${commaRemoved}"`);
        // Return only if this was the only change, otherwise more parsing needed
        if(!rotateMatch && !cssTransform.includes('matrix')) return commaRemoved;
    }


    // If no specific conversion is done, return the original value
    console.warn(`[Normalize Transform] No specific SVG normalization applied for CSS: "${cssTransform}". Passing through.`);
    return cssTransform;
}


// ==========================================================================
// === SVG Definition Creators ==============================================
// ==========================================================================

/** Creates SVG linear gradient definition for text fill */
function createGradientDef(styles, gradientId) {
    if (styles.color?.mode !== 'gradient' || !gradientId || !styles.color.gradient) return '';
    // console.log(`[Core Defs] Creating text gradient #${gradientId}.`); // Reduce noise
    const gradientInfo = styles.color.gradient;
    const colors = gradientInfo.colors || [];
    if (colors.length < 2) { console.warn(`[Core Defs] Text gradient needs >= 2 colors, found ${colors.length}. Skipping def.`); return ''; }

    const c1 = normalizeColor(colors[0], 'text gradient c1');
    const c2 = normalizeColor(colors[1], 'text gradient c2');
    const c3 = colors.length > 2 ? normalizeColor(colors[2], 'text gradient c3') : null;
    const useC3 = !!c3;

    // Default direction if missing
    const dir = parseFloat(gradientInfo.direction || '180'); // Default vertical top-to-bottom if missing
    if (isNaN(dir)) { console.warn(`[Core Defs] Invalid gradient direction "${gradientInfo.direction}". Defaulting to 180.`); dir = 180;}

    const angleRad = (dir - 90) * Math.PI / 180; // Convert CSS deg to SVG vector angle
    const x1 = (0.5 - Math.cos(angleRad) * 0.5).toFixed(4);
    const y1 = (0.5 - Math.sin(angleRad) * 0.5).toFixed(4);
    const x2 = (0.5 + Math.cos(angleRad) * 0.5).toFixed(4);
    const y2 = (0.5 + Math.sin(angleRad) * 0.5).toFixed(4);

    let stops = '';
    if (useC3 && c3) {
        stops = `<stop offset="0%" stop-color="${c1 || '#000'}" stop-opacity="${extractOpacityFromColor(colors[0])}"/>`
              + `<stop offset="50%" stop-color="${c2 || '#000'}" stop-opacity="${extractOpacityFromColor(colors[1])}"/>`
              + `<stop offset="100%" stop-color="${c3}" stop-opacity="${extractOpacityFromColor(colors[2])}"/>`; // Use c3 directly
    } else if (c1 && c2) { // Ensure c1 and c2 are valid
        stops = `<stop offset="0%" stop-color="${c1}" stop-opacity="${extractOpacityFromColor(colors[0])}"/>`
              + `<stop offset="100%" stop-color="${c2}" stop-opacity="${extractOpacityFromColor(colors[1])}"/>`;
    } else {
        console.warn(`[Core Defs] Failed to create stops for text gradient, invalid colors.`); return '';
    }

    return `<linearGradient id="${gradientId}" gradientUnits="objectBoundingBox" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
}

/** Creates SVG filter definition for text effects (shadow/glow) */
function createFilterDef(styles, filterId) {
    if (!filterId || !styles?.textEffect?.type || styles.textEffect.type === 'none') return '';
    // console.log(`[Core Defs] Creating filter #${filterId}. Effect:`, styles.textEffect); // Reduce noise
    const { type, color, blur = 0, dx = 0, dy = 0, opacity = 0.75 } = styles.textEffect;
    const normalizedColor = normalizeColor(color, 'filter color');
    if (!normalizedColor) { console.warn(`[Core Defs] Invalid color for filter "${filterId}". Skipping def.`); return ''; }

    const effectOpacity = Math.max(0, Math.min(1, opacity));
    const safeBlur = Math.max(0, blur); // Ensure blur is not negative

    let filterContent = '';
    // Use feDropShadow for simple, non-blurred shadows (potentially better performance)
    if (type === 'shadow' && safeBlur < 0.5) { // Use threshold for blur
        filterContent = `<feDropShadow dx="${dx}" dy="${dy}" stdDeviation="0.1" flood-color="${normalizedColor}" flood-opacity="${effectOpacity}" result="shadow"/>`; // stdDev=0 can be ignored
         // Add merge if needed to combine shadow with original graphic correctly
         filterContent += `<feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>`;
    }
    // Use feGaussianBlur for glows or blurred shadows
    else if (type === 'glow' || (type === 'shadow' && safeBlur >= 0.5)) {
        filterContent = `<feGaussianBlur in="SourceAlpha" stdDeviation="${safeBlur.toFixed(2)}" result="blur"/>` // Use SourceAlpha for transparency
                      + `<feOffset dx="${dx}" dy="${dy}" in="blur" result="offsetBlur"/>` // Offset the blurred alpha
                      + `<feFlood flood-color="${normalizedColor}" flood-opacity="${effectOpacity}" result="flood"/>` // Create the color flood
                      + `<feComposite in="flood" in2="offsetBlur" operator="in" result="coloredBlur"/>` // Combine flood color with offset blurred shape
                      + `<feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>`; // Merge effect behind original
    }
    else {
        console.warn(`[Core Defs] Unrecognized filter type "${type}" for filter "${filterId}". Skipping def.`);
        return '';
    }

    // Define filter region to prevent clipping
    return `<filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB">${filterContent}</filter>`;
}

/** Creates SVG linear gradient definition for background */
function createBackgroundGradientDef(styles, id) {
    if (!id || !styles?.background?.gradient) return '';
    // console.log(`[Core Defs] Creating background gradient #${id}.`); // Reduce noise
    const gradientInfo = styles.background.gradient;
    const colors = gradientInfo.colors || [];
    if (colors.length < 2) { console.warn(`[Core Defs] BG gradient needs >= 2 colors. Skipping def.`); return ''; }

    const c1 = normalizeColor(colors[0], 'bg gradient c1');
    const c2 = normalizeColor(colors[1], 'bg gradient c2');
     // If either color is invalid/transparent, we might not want a gradient
     if (!c1 && !c2) { console.warn(`[Core Defs] Both BG gradient colors are invalid/transparent. Skipping def.`); return ''; }

    // Default direction if missing
    let dir = parseFloat(gradientInfo.direction || '180'); // Default vertical top-to-bottom if missing
    if (isNaN(dir)) { console.warn(`[Core Defs] Invalid BG gradient direction "${gradientInfo.direction}". Defaulting to 180.`); dir = 180;}

    const angleRad = (dir - 90) * Math.PI / 180;
    const x1 = (0.5 - Math.cos(angleRad) * 0.5).toFixed(4);
    const y1 = (0.5 - Math.sin(angleRad) * 0.5).toFixed(4);
    const x2 = (0.5 + Math.cos(angleRad) * 0.5).toFixed(4);
    const y2 = (0.5 + Math.sin(angleRad) * 0.5).toFixed(4);

    // Use fallback 'black' or 'white' with 0 opacity if one color is missing
    const stop1Color = c1 || 'rgba(0,0,0,0)';
    const stop2Color = c2 || 'rgba(0,0,0,0)';

    const stops = `<stop offset="0%" stop-color="${stop1Color}" stop-opacity="${extractOpacityFromColor(colors[0])}"/>`
                 + `<stop offset="100%" stop-color="${stop2Color}" stop-opacity="${extractOpacityFromColor(colors[1])}"/>`;

    // Use 'userSpaceOnUse' if applying to a background rect for more predictable results?
    // Using objectBoundingBox here assumes it applies directly to the rect's fill scaling with it.
    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">${stops}</linearGradient>`;
}

// ==========================================================================
// === Embedded CSS Generator ===============================================
// ==========================================================================

/** Generate embedded CSS including font face and animations */
function generateEmbeddedCSS(styleData, animationMetadata) {
    console.log('[Core CSS] Generating embedded CSS. Animation Metadata:', animationMetadata);
    let css = "/* Embedded CSS - Logomaker Core v2.6 */\n";
    let hasContent = false;

    // --- Font Embedding ---
    const fontEmbedData = styleData?.font?.embedData;
    console.log('[Core CSS - Embed Check] Font Family:', styleData?.font?.family);
    console.log('[Core CSS - Embed Check] Embed Data:', fontEmbedData ? `Exists (Format: ${fontEmbedData.format}, Weight: ${fontEmbedData.weight}, Style: ${fontEmbedData.style})` : 'MISSING');

    if (fontEmbedData?.file && fontEmbedData.file.startsWith('data:font') && styleData?.font?.family) {
        const primaryFont = styleData.font.family.split(',')[0].trim().replace(/['"]/g, '');
        if (primaryFont) {
            css += `/* Embedded Font: ${primaryFont} */\n`;
            css += `@font-face {\n`;
            css += `  font-family: "${primaryFont}";\n`;
            // Optional: Add format hint if available
            const formatHint = fontEmbedData.format ? ` format('${fontEmbedData.format}')` : '';
            css += `  src: url(${fontEmbedData.file})${formatHint};\n`; // Data URL
            css += `  font-weight: ${fontEmbedData.weight || '400'};\n`;
            css += `  font-style: ${fontEmbedData.style || 'normal'};\n`;
            // Consider adding font-display: swap;? Might not be relevant for export.
            // css += `  font-display: swap;\n`;
            css += `}\n\n`;
            console.log(`[Core CSS] SUCCESS: Embedded font ${primaryFont} (Weight: ${fontEmbedData.weight}, Style: ${fontEmbedData.style}, Format: ${fontEmbedData.format})`);
            hasContent = true;
        } else {
            console.warn('[Core CSS] Cannot embed font: Primary font name extraction failed.');
        }
    } else {
        console.warn('[Core CSS] No embeddable font data found or data is invalid.');
        if (styleData?.font?.family) {
            css += `/* WARNING: Font "${styleData.font.family.split(',')[0].trim()}" could not be embedded. Rendering depends on system availability. */\n`;
        }
    }

    // --- Animation Embedding ---
    if (animationMetadata?.name && animationMetadata.name !== 'none' && animationMetadata.name !== 'anim-none') {
        const keyframesCSS = styleData?.animation?.activeKeyframes; // Get captured keyframes
        if (keyframesCSS) {
            let keyframeRuleName = animationMetadata.name; // Use the base name like 'shake'
            // Verify the name extracted from CSS matches, correct if needed
            const keyframeNameMatch = keyframesCSS.match(/@keyframes\s+([a-zA-Z0-9-_]+)/);
            if (keyframeNameMatch && keyframeNameMatch[1]) {
                keyframeRuleName = keyframeNameMatch[1]; // Use name found in @keyframes rule
            } else {
                 console.warn(`[Core CSS] Could not extract keyframe name from CSS for ${animationMetadata.name}. Using base name.`);
            }

            // Add the @keyframes rule
            css += `/* Animation Keyframes: ${keyframeRuleName} */\n${keyframesCSS}\n\n`;

            // Add the class rule to apply the animation
            const animClass = styleData?.animation?.class || `anim-${animationMetadata.name}`; // e.g., .anim-shake
            const duration = styleData?.animation?.duration || '2s';
            const timingFunc = styleData?.animation?.timingFunction || 'ease';
            const iterCount = styleData?.animation?.iterationCount || 'infinite';
            css += `/* Animation Class */\n`;
            css += `.${animClass} {\n`;
            css += `  animation-name: ${keyframeRuleName};\n`; // Use the extracted/verified name
            css += `  animation-duration: ${duration};\n`;
            css += `  animation-timing-function: ${timingFunc};\n`;
            css += `  animation-iteration-count: ${iterCount};\n`;
            // Add other properties like fill-mode, direction if captured/needed

             // Add styles needed specifically for certain animations
             if (animClass === 'anim-glitch') {
                 // Glitch often relies on pseudo-elements which don't exist in SVG text.
                 // The core SVG structure needs modification for a pure SVG glitch.
                 // This CSS won't fully replicate it on a single <text> element.
                  console.warn("[Core CSS] Glitch animation CSS embedded, but may not render correctly on SVG <text> without specific structure (e.g., multiple text copies).");
             } else if (animClass === 'anim-typing') {
                  css += `  /* Styles potentially needed for typing animation */\n`;
                  css += `  white-space: pre;\n`; // Prevent wrapping
                  // Caret simulation via border might not work well in SVG text
             }
             if (styleData?.color?.mode === 'gradient') {
                 css += `  /* Ensure gradient fill works with animation if needed */\n`;
                 css += `  -webkit-background-clip: text; background-clip: text;\n`;
                 css += `  color: transparent; -webkit-text-fill-color: transparent;\n`;
            }

            css += `}\n\n`;
            console.log(`[Core CSS] Embedded animation "${keyframeRuleName}" applied via class ".${animClass}".`);
            hasContent = true;
        } else {
             console.warn(`[Core CSS] No keyframes CSS found for animation: ${animationMetadata.name}. Animation will likely not work.`);
             css += `/* WARNING: Keyframes for animation "${animationMetadata.name}" could not be found or embedded. */\n`;
        }
    } else {
        console.log(`[Core CSS] No active animation detected for embedding.`);
    }

    return hasContent ? css.trim() : null; // Return null if no CSS generated
}

// ==========================================================================
// === SVG Element Generators ===============================================
// ==========================================================================
/** 
 * Generates the SVG background rectangle with proper border radius handling
 */
function createBackgroundRect(styles, bgGradientId, config) {
    if (!config.includeBackground || config.transparentBackground) {
        console.log("[Core SVG Bg] Skipping background rect (transparent or excluded).");
        return '';
    }
    if (!styles?.background) {
        console.warn("[Core SVG Bg] No background styles found, defaulting to opaque black background rect.");
        return `<rect id="background-rect" width="100%" height="100%" fill="#000000" opacity="1"/>\n`;
    }

    const bgType = styles.background.type || 'bg-solid';
    const bgColor = normalizeColor(styles.background.color || '#000000', 'bg color'); // Default black if needed
    const bgOpacity = parseFloat(styles.background.opacity || '1');
    const patternClass = styles.background.patternClass;
    const patternId = patternClass ? `pattern-${patternClass.replace(/^bg-/, '')}` : null;

    let bgFill = 'none';

    if (bgType.includes('gradient') && bgGradientId && typeof bgGradientId === 'string') {
        bgFill = `url(#${bgGradientId})`;
        console.log(`[Core SVG Bg] Using Gradient fill="${bgFill}"`);
    } else if (patternId) {
        // TODO: Implement SVG pattern definitions in <defs> based on patternClass
        console.warn(`[Core SVG Bg] Pattern "${patternClass}" detected. SVG pattern DEF generation not implemented. Applying fill ID "${patternId}" with fallback color.`);
        // Use pattern fill + solid color fallback (browser dependent)
        bgFill = `url(#${patternId})`;
        // As a fallback, just use the color if pattern likely won't render
        // bgFill = bgColor || '#000000';
    } else if (bgColor) { // Includes bg-solid or other types with a color
        bgFill = bgColor;
        console.log(`[Core SVG Bg] Using Solid fill="${bgFill}"`);
    } else {
        console.log(`[Core SVG Bg] Background type is ${bgType} but color is transparent/invalid. Skipping fill.`);
        bgFill = 'none';
    }

    // Ensure opacity is valid
    const finalOpacity = isNaN(bgOpacity) ? 1 : Math.max(0, Math.min(1, bgOpacity));

    // Get border radius if available - NEW CODE FOR BORDER RADIUS
    let borderRadiusAttr = '';
    if (styles.borderRadius) {
        // The borderRadius could be a complex value like "50%" or "10px / 20px"
        // For SVG we'll handle this consistently
        borderRadiusAttr = ` rx="${escapeSVGAttribute(styles.borderRadius)}"`;
        console.log(`[Core SVG Bg] Adding border radius to background: ${styles.borderRadius}`);
    }

    if (bgFill !== 'none') {
        // If using a pattern AND a fallback color is desired, might need two rects or just rely on the fill color.
        // Simple approach: Just use the determined fill.
        let rectTag = `<rect id="background-rect" width="100%" height="100%"${borderRadiusAttr} `;
        rectTag += `fill="${escapeSVGAttribute(bgFill)}" `;
        // Opacity applies to the whole rect including its fill
        if (finalOpacity < 1) {
             rectTag += `opacity="${finalOpacity.toFixed(3)}"`;
        }
        rectTag += `/>\n`;

        // If pattern requires a base color underneath AND the pattern might have transparency
        if (patternId && bgColor && bgFill !== bgColor) {
             console.log(`[Core SVG Bg] Adding underlying rect for pattern base color: ${bgColor}`);
             return `<rect width="100%" height="100%"${borderRadiusAttr} fill="${bgColor}" opacity="${finalOpacity.toFixed(3)}"/>\n` + rectTag;
        }

        return rectTag;
    } else {
        console.log(`[Core SVG Bg] Background rect has no effective fill, omitting.`);
        return '';
    }
}

// === REPLACE THE CONTAINER BORDER RECTANGLE CODE IN generateSVGBlob ===

// Replace the border code in the generateSVGBlob function around step 8
// with this improved version that properly handles radius and padding

/**
 * Container Border Rectangle code for generateSVGBlob
 * This replaces the code in step 8 of the generateSVGBlob function
 * 
 * @param {object} styles - The captured styles object
 * @param {object} config - Export configuration
 * @returns {string} SVG border rectangle element
 */
function createBorderRect(styles, config) {
    if (!styles.border || styles.stroke?.isTextStroke) {
        return '';
    }
    
    const border = styles.border;
    const strokeColor = normalizeColor(border.color, 'container border');
    let strokeWidth = 0;
    
    if (typeof border.width === 'string' || typeof border.width === 'number') {
        strokeWidth = parseFloat(border.width) || 0;
    }

    if (!strokeColor || strokeWidth <= 0) {
        return '';
    }
        
    // Get border radius - IMPORTANT FOR CONSISTENCY
    let rx = 0, ry = 0;
    
    // Handle border radius properly
    if (styles.borderRadius) {
        // Check if we have a simple percentage or pixel value
        const match = String(styles.borderRadius).match(/^(\d+)(px|%)?$/);
        if (match) {
            rx = match[1];
            // For percentage, SVG uses 0-1 range (e.g., 50% = 0.5)
            if (match[2] === '%') {
                rx = parseFloat(rx) / 100;
            }
            ry = rx; // Same value for both dimensions
        } else if (styles.borderRadius === '50%') {
            // Special case for circular/oval shapes
            rx = config.width / 2;
            ry = config.height / 2;
            console.log('[Core SVG Border] Using elliptical border for circular shape');
        } else {
            // Handle complex border radius like "10px / 20px"
            const complexMatch = String(styles.borderRadius).match(/(\d+)(?:px)?\s*\/\s*(\d+)(?:px)?/);
            if (complexMatch) {
                rx = complexMatch[1];
                ry = complexMatch[2];
            }
            // Any other formats will keep rx=0, ry=0
        }
    }
    
    // Calculate border position with padding
    let borderPadding = 0;
    if (styles.borderPadding) {
        const paddingMatch = String(styles.borderPadding).match(/(\d+)(?:px|em|rem|%)?/);
        if (paddingMatch) {
            borderPadding = parseInt(paddingMatch[1]) || 0;
        }
    }
    
    // Adjust inset to account for border width and padding
    const insetX = strokeWidth / 2;
    const insetY = strokeWidth / 2;
    const width = config.width - strokeWidth;
    const height = config.height - strokeWidth;
    
    // Create the SVG rectangle
    let borderRect = `  <rect id="container-border-rect" x="${insetX}" y="${insetY}" `;
    borderRect += `width="${width}" height="${height}" `;
    
    // Add radius if specified
    if (rx && ry) {
        borderRect += `rx="${rx}" ry="${ry}" `;
    }
    
    borderRect += `fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" `;

    const strokeOpacity = extractOpacityFromColor(border.color);
    if (strokeOpacity < 1) {
        borderRect += `stroke-opacity="${strokeOpacity.toFixed(3)}" `;
    }
    
    // Add dash array for dotted/dashed borders
    if (border.dasharray) {
        borderRect += `stroke-dasharray="${border.dasharray}" `;
    }

    // Apply filter if it's a glow border
    if (border.isGlow && styles.textEffect?.type === 'glow') {
        // Use the same filter as text if available
        borderRect += `filter="url(#svgTextEffect)" `;
    }

    borderRect += `/>\n`;
    console.log(`[Core SVG Border] Added container border rect: ${border.style}, ${border.color}, ${border.width}`);
    
    return borderRect;
}

/**
 * Creates the SVG text element (v2.6 - Corrected Transform Call & Filter Logic)
 * @param {string} textContent - The final text to display.
 * @param {object} styles - The captured styles object from captureAdvancedStyles.
 * @param {string|null} textGradientId - The ID of the text gradient definition.
 * @param {string|null} textFilterId - The ID of the text effect filter.
 * @param {object|null} animationMetadata - Animation details (may include progress).
 * @returns {string} The generated SVG <text> element string.
 */
function generateSVGTextElement(textContent, styles, textGradientId, textFilterId, animationMetadata) {
    // --- Validation and Setup ---
    console.log("[Core SVG Text v2.6] Generating SVG text element. Text:", textContent);
    if (!styles?.font) {
        console.error("[Core SVG Text v2.6] Cannot generate text element: Missing font styles");
        return '';
    }
    // Ensure helpers are available (could be moved outside if always present)
    if (typeof normalizeColor !== 'function' || typeof extractOpacityFromColor !== 'function' || typeof escapeSVGAttribute !== 'function' || typeof escapeXML !== 'function' || typeof normalizeCSSTransformForSVG !== 'function') {
        console.error("[Core SVG Text v2.6] CRITICAL: One or more helper functions (normalizeColor, etc.) are missing!");
        return ``;
    }

    const font = styles.font;
    const color = styles.color || { mode: 'solid', value: '#ffffff' };
    const textStroke = styles.stroke?.isTextStroke ? styles.stroke : null;
    const anim = styles.animation || {};
    const transform = styles.transform || {};
    const textOpacity = parseFloat(styles.opacity || '1');

    // --- Text Positioning & Alignment ---
    let xPosition = '50%';
    let textAnchor = styles.textAnchor || 'middle';
     if (styles.textAlign === 'left') { textAnchor = 'start'; xPosition = '5%'; }
     else if (styles.textAlign === 'right') { textAnchor = 'end'; xPosition = '95%'; }
     else { textAnchor = 'middle'; xPosition = '50%'; }
    console.log(`[Core SVG Text v2.6] Alignment: CSS='${styles.textAlign || 'center'}', SVG Anchor='${textAnchor}', X='${xPosition}'`);

    // --- Build <text> Element ---
    let textElement = `<text x="${xPosition}" y="50%" dominant-baseline="middle" text-anchor="${textAnchor}" `;

    // --- Font Attributes ---
    const fontFamilyAttr = font.family ? escapeSVGAttribute(font.family) : 'sans-serif';
    textElement += `font-family="${fontFamilyAttr}" `;
    textElement += `font-size="${font.size || '60px'}" `;
    if (font.weight && font.weight !== '400' && font.weight !== 'normal') textElement += `font-weight="${font.weight}" `;
    if (font.style && font.style !== 'normal') textElement += `font-style="${font.style}" `;
    if (font.letterSpacing && font.letterSpacing !== 'normal') {
        const spacingValue = font.letterSpacing;
        console.log(`[Core SVG Text v2.6] Applying letter-spacing: "${spacingValue}"`);
        textElement += `letter-spacing="${spacingValue}" `;
    }

    // --- Fill / Color ---
    let fillOpacity = 1.0;
    if (color.mode === 'gradient' && textGradientId && typeof textGradientId === 'string') {
        textElement += `fill="url(#${textGradientId})" `;
        console.log(`[Core SVG Text v2.6] Applied gradient fill: url(#${textGradientId})`);
    } else {
        const fillColor = normalizeColor(color.value || '#ffffff', 'text fill');
        if (fillColor) {
            textElement += `fill="${fillColor}" `;
            fillOpacity = extractOpacityFromColor(color.value);
            console.log(`[Core SVG Text v2.6] Applied solid fill: ${fillColor} (Opacity from color: ${fillOpacity.toFixed(3)})`);
        } else {
            textElement += `fill="none" `;
            console.log(`[Core SVG Text v2.6] Text fill color is transparent or invalid.`);
        }
    }

    // --- Opacity ---
    const finalOpacity = Math.max(0, Math.min(1, isNaN(textOpacity) ? 1 : textOpacity)) * fillOpacity;
    if (finalOpacity < 1) {
        textElement += `opacity="${finalOpacity.toFixed(3)}" `;
        console.log(`[Core SVG Text v2.6] Applied combined opacity: ${finalOpacity.toFixed(3)}`);
    }

    // --- Text Stroke ---
    if (textStroke) {
        const strokeColor = normalizeColor(textStroke.color, 'text stroke');
        let strokeWidth = 0;
        if (typeof textStroke.width === 'string' || typeof textStroke.width === 'number') { strokeWidth = parseFloat(textStroke.width) || 0; }
        if (strokeColor && strokeWidth > 0) {
            textElement += `stroke="${strokeColor}" stroke-width="${strokeWidth}" `;
            const strokeOpacity = extractOpacityFromColor(textStroke.color);
            if (strokeOpacity < 1) { textElement += `stroke-opacity="${strokeOpacity.toFixed(3)}" `; }
            console.log(`[Core SVG Text v2.6] Applied TEXT stroke: Color=${strokeColor}, Width=${strokeWidth}, Opacity=${strokeOpacity.toFixed(3)}`);
        } else { console.log(`[Core SVG Text v2.6] Text stroke color/width invalid or zero.`); }
    } else { console.log(`[Core SVG Text v2.6] No direct text stroke detected in styles.`); }

    // --- Filter (Text Effect) ---
    if (textFilterId && typeof textFilterId === 'string') {
        textElement += `filter="url(#${textFilterId})" `;
        console.log(`[Core SVG Text v2.6] Applied text effect filter: url(#${textFilterId})`);
    } else {
        console.log(`[Core SVG Text v2.6] No valid textFilterId provided.`);
        if (styles.textEffect?.type && styles.textEffect.type !== 'none') {
            console.warn(`[Core SVG Text v2.6] Text effect (${styles.textEffect.type}) was captured, but textFilterId was missing or invalid!`);
        }
    }

    // --- Transform ---
    if (transform.cssValue && transform.cssValue !== 'none') {
        const normalizedTransform = normalizeCSSTransformForSVG(transform.cssValue); // Call the helper
        if (normalizedTransform) {
            textElement += `transform="${escapeSVGAttribute(normalizedTransform)}" `;
            console.log(`[Core SVG Text v2.6] Applied normalized transform: "${normalizedTransform}" (Original CSS: "${transform.cssValue}")`);
        } else {
            console.warn(`[Core SVG Text v2.6] Transform normalization failed for CSS: "${transform.cssValue}". Omitting transform.`);
        }
    } else { console.log(`[Core SVG Text v2.6] No transform detected in styles.`); }

    // --- Animation ---
    const animClass = anim.class;
    if (animClass && animClass !== 'anim-none') {
        textElement += `class="${escapeSVGAttribute(animClass)}" `;
        console.log(`[Core SVG Text v2.6] Applied animation class: ${animClass}`);
    }

    // --- Animation Frame Override (Inline Style) ---
    let animationStyleOverride = '';
    if (animationMetadata?.progress !== undefined && anim.durationMs > 0) {
        const delayMs = -(animationMetadata.progress * anim.durationMs);
        animationStyleOverride = `animation-name: ${anim.type || 'none'}; animation-duration: ${anim.duration || '0s'}; animation-delay: ${delayMs.toFixed(0)}ms; animation-play-state: paused;`;
        console.log(`[Core SVG Text v2.6] Applied animation override for progress ${animationMetadata.progress.toFixed(2)}`);
        textElement += `style="${escapeSVGAttribute(animationStyleOverride)}" `;
    }

    // --- Final Text Content ---
    const finalText = styles.textContent?.transformedText || textContent || 'Logo';
    const escapedText = escapeXML(finalText);

    // --- Close Tag and Add Content ---
    textElement += `>`;
    textElement += escapedText;
    textElement += `</text>`;

    console.log("[Core SVG Text v2.6] Finished generating text element.");
    return textElement;
}


// ==========================================================================
// === Main Export Functions ================================================
// ==========================================================================

/**
 * Main function to generate the SVG Blob (v2.6).
 * @param {object} options - Export options like width, height, text, etc.
 * @returns {Promise<Blob>} A promise resolving with the SVG Blob.
 */
export async function generateSVGBlob(options = {}) {
    console.log("[Core SVG Gen v2.6] generateSVGBlob called. Options:", JSON.stringify(options));

    try {
        // --- 1. Capture Styles ---
        const styles = captureAdvancedStyles();
        if (!styles) throw new Error('Failed to capture styles for SVG generation');
        console.log("[Core SVG Gen v2.6] Styles Captured.");

        // --- 2. Determine Configuration ---
        const currentSettings = window.SettingsManager?.getCurrentSettings?.() || {};
        const defaults = {
            width: parseInt(styles.exportConfig?.width || '800'),
            height: parseInt(styles.exportConfig?.height || '400'),
            text: styles.textContent?.finalText || 'Logo',
            includeBackground: true,
            transparentBackground: styles.exportConfig?.transparent ?? options.transparentBackground ?? false,
            animationMetadata: options.animationMetadata || extractSVGAnimationDetails()
        };
        const config = { ...defaults, ...options };

        if (!config.width || config.width <= 0) config.width = 800;
        if (!config.height || config.height <= 0) config.height = 400;
        console.log("[Core SVG Gen v2.6] Final Config:", config);

        // --- 3. Build SVG String ---
        let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">\n`;

        // --- 4. Definitions (`<defs>`) ---
        svg += `<defs>\n`;
        let textGradientId = null;
        let backgroundGradientId = null;
        let textFilterId = null;

        // Text Gradient Def
        if (styles.color?.mode === 'gradient') {
            textGradientId = 'svgTextGradient';
            const gradientDef = createGradientDef(styles, textGradientId);
            if (gradientDef) { svg += `  ${gradientDef}\n`; console.log("[Core SVG Gen v2.6] Added Text Gradient Definition."); }
            else { textGradientId = null; } // Nullify if creation failed
        }

        // Text Effect Filter Def
        if (styles.textEffect?.type && styles.textEffect.type !== 'none') {
            textFilterId = 'svgTextEffect'; // Consistent ID
            const filterDef = createFilterDef(styles, textFilterId);
            if (filterDef) { svg += `  ${filterDef}\n`; console.log(`[Core SVG Gen v2.6] Added Text Effect Filter (ID: ${textFilterId}).`); }
            else { textFilterId = null; } // Nullify if creation failed
        }

        // Background Gradient Def (only if background is gradient and not transparent)
        if (config.includeBackground && !config.transparentBackground && (styles.background?.type?.includes('gradient') || styles.background?.gradient)) {
            backgroundGradientId = 'svgBgGradient';
            const bgGradientDef = createBackgroundGradientDef(styles, backgroundGradientId);
            if (bgGradientDef) { svg += `  ${bgGradientDef}\n`; console.log("[Core SVG Gen v2.6] Added Background Gradient Definition."); }
            else { backgroundGradientId = null; }
        }

        // TODO: Add SVG Pattern Definitions here if styles.background.patternClass exists

        svg += `</defs>\n`;

        // --- 5. Embedded CSS (`<style>`) ---
        const embeddedCSS = generateEmbeddedCSS(styles, config.animationMetadata);
        if (embeddedCSS) {
            svg += `<style type="text/css"><![CDATA[\n${embeddedCSS}\n]]></style>\n`;
            console.log("[Core SVG Gen v2.6] Embedded CSS added.");
        }

        // --- 6. Background Rectangle (`<rect>`) ---
        const bgRect = createBackgroundRect(styles, backgroundGradientId, config);
        if (bgRect) { svg += bgRect; }

        // --- 7. Main Content Group (for Container Opacity) ---
        const containerOpacity = parseFloat(styles.containerOpacity || '1');
        const finalContainerOpacity = Math.max(0, Math.min(1, isNaN(containerOpacity) ? 1 : containerOpacity));
        svg += `<g id="logo-content-group" opacity="${finalContainerOpacity.toFixed(3)}">\n`;
        console.log(`[Core SVG Gen v2.6] Added content group with opacity: ${finalContainerOpacity.toFixed(3)}`);

        // --- 8. Container Border Rectangle ---
        // Add if styles.border exists AND it's NOT a text stroke
        if (styles.border && !styles.stroke?.isTextStroke) {
            const border = styles.border;
            const strokeColor = normalizeColor(border.color, 'container border');
            let strokeWidth = 0;
             if (typeof border.width === 'string' || typeof border.width === 'number') {
                 strokeWidth = parseFloat(border.width) || 0;
             }

            if (strokeColor && strokeWidth > 0) {
                let borderRect = `  <rect id="container-border-rect" x="${strokeWidth / 2}" y="${strokeWidth / 2}" `;
                borderRect += `width="${config.width - strokeWidth}" height="${config.height - strokeWidth}" `;
                borderRect += `fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" `;

                const strokeOpacity = extractOpacityFromColor(border.color);
                if (strokeOpacity < 1) { borderRect += `stroke-opacity="${strokeOpacity.toFixed(3)}" `; }
                if (border.dasharray) { borderRect += `stroke-dasharray="${border.dasharray}" `; }

                 // WARNING: Border glow filter application is complex in pure SVG, often omitted.
                 if (border.isGlow) {
                      console.warn(`[Core SVG Gen v2.6] Container border glow detected but not rendered in SVG.`);
                      // Potentially apply a filter ID here if a suitable border filter was defined
                      // borderRect += `filter="url(#svgBorderGlowFilter)" `; // Example
                 }

                borderRect += `/>\n`;
                svg += borderRect;
                console.log(`[Core SVG Gen v2.6] Added container border rect: ${border.style}, ${border.color}, ${border.width}`);
            }
        }

        // --- 9. Text Element (`<text>`) ---
        const textElement = generateSVGTextElement(
            config.text, styles, textGradientId, textFilterId, config.animationMetadata // Pass correct IDs
        );
        if (textElement) {
            svg += `  ${textElement}\n`; // Indent for readability
            console.log("[Core SVG Gen v2.6] Text element generated.");
        }
        else { console.error("[Core SVG Gen v2.6] Failed to generate text element!"); }

        // --- 10. Close Content Group ---
        svg += `</g>\n`;

        // --- 11. Close SVG ---
        svg += `</svg>`;

        // --- 12. Create Blob ---
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        console.log(`[Core SVG Gen v2.6] SVG Blob generated successfully. Size: ${(blob.size / 1024).toFixed(1)} KB`);
        return blob;

    } catch (error) {
        console.error('[Core SVG Gen v2.6] SVG Blob Generation Failed:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`SVG Generation Failed: ${errMsg}`); // Re-throw for upstream handling
    }
}


/**
 * Converts an SVG Blob to a PNG Blob using Canvas.
 * @param {Blob} svgBlob - The input SVG Blob.
 * @param {object} options - Options like width, height.
 * @returns {Promise<Blob>} A promise resolving with the PNG Blob.
 */
export async function convertSVGtoPNG(svgBlob, options = {}) {
     return new Promise(async (resolve, reject) => {
         const { width = 800, height = 400, transparentBackground = false } = options; // Note: Quality ignored for PNG
         console.log(`[Core PNG Conv] Converting SVG to PNG. Target: ${width}x${height}, Transparent: ${transparentBackground}`);

         if (!(svgBlob instanceof Blob)) { return reject(new Error("Invalid SVG Blob provided.")); }

         let url = null;
         try {
             url = URL.createObjectURL(svgBlob);
             const img = new Image();

             img.onload = () => {
                 console.log("[Core PNG Conv] SVG Image loaded into memory.");
                 try {
                     const canvas = document.createElement('canvas');
                     canvas.width = width;
                     canvas.height = height;
                     const ctx = canvas.getContext('2d');
                     if (!ctx) { throw new Error("Failed to get 2D context from canvas"); }

                     // Clear canvas (important if background is transparent)
                      ctx.clearRect(0, 0, width, height);
                      // Background color handled by SVG itself if not transparent

                     ctx.drawImage(img, 0, 0, width, height);
                     console.log("[Core PNG Conv] SVG drawn to canvas.");

                     canvas.toBlob(
                         blob => {
                             URL.revokeObjectURL(url); // Clean up object URL *after* blob creation
                             if (blob) {
                                 console.log(`[Core PNG Conv] PNG Blob created. Size: ${(blob.size / 1024).toFixed(1)} KB`);
                                 resolve(blob);
                             } else {
                                 console.error('[Core PNG Conv] canvas.toBlob failed (returned null).');
                                 reject(new Error('Failed to convert canvas to PNG blob.'));
                             }
                         },
                         'image/png' // Specify PNG format
                         // Quality argument is ignored for image/png
                     );
                 } catch (err) {
                     if(url) URL.revokeObjectURL(url);
                     console.error('[Core PNG Conv] Canvas drawing or toBlob conversion failed:', err);
                     reject(new Error(`Canvas conversion failed: ${err.message || err}`));
                 }
             };

             img.onerror = (errEvent) => {
                 if(url) URL.revokeObjectURL(url);
                 console.error('[Core PNG Conv] Failed to load SVG blob into Image element:', errEvent);
                 reject(new Error('Failed to load SVG image for PNG conversion. Check SVG content/validity.'));
             };

             img.src = url; // Start loading the SVG into the Image element
         } catch (setupError) {
             if (url) URL.revokeObjectURL(url);
             console.error('[Core PNG Conv] Error setting up SVG image loading:', setupError);
             reject(new Error(`Setup for PNG conversion failed: ${setupError.message || setupError}`));
         }
     });
 }


/**
 * Generates a sequence of PNG frame Blobs for animation.
 * @param {object} options - Options like width, height, frameCount, transparent, onProgress callback.
 * @returns {Promise<Blob[]>} A promise resolving with an array of PNG Blobs.
 */
export async function generateAnimationFrames(options = {}) {
    const { width = 800, height = 400, frameCount = 15, transparent = false, onProgress = null } = options;
    const safeFrameCount = Math.max(1, Math.min(frameCount, 120)); // Sanitize frame count
    console.log(`[Core Frames] Generating ${safeFrameCount} frames (${width}x${height}). Transparent: ${transparent}`);
    const frames = [];
    const baseAnimationMetadata = extractSVGAnimationDetails(); // Get details once

    // Handle case with no animation - generate one static frame
    if (!baseAnimationMetadata || baseAnimationMetadata.name === 'none' || baseAnimationMetadata.name === 'anim-none') {
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

    // Generate sequence
    for (let i = 0; i < safeFrameCount; i++) {
        // Calculate progress (0 to nearly 1 for looping, or 0 to 1 if frameCount is 1)
         // Correct progress calculation: 0/N, 1/N, ... (N-1)/N
         const progress = safeFrameCount <= 1 ? 0 : i / safeFrameCount;

        if (onProgress) {
            const percent = Math.round((i / safeFrameCount) * 100); // Progress based on frames generated
            onProgress(percent / 100, `Generating frame ${i + 1}/${safeFrameCount} (${percent}%)...`);
        }
        // Check for cancellation flag if implemented
        // if (window.exportCancelled) throw new Error("Export Cancelled");

        try {
            // Create metadata for this specific frame's progress
            const frameAnimationMetadata = { ...baseAnimationMetadata, progress: progress };
            // Generate SVG for this specific animation state
            const svgBlob = await generateSVGBlob({ width, height, transparentBackground: transparent, animationMetadata: frameAnimationMetadata });
            // Convert that specific SVG state to a PNG
            const pngBlob = await convertSVGtoPNG(svgBlob, { width, height, transparentBackground: transparent }); // Quality ignored for PNG
            frames.push(pngBlob);
        } catch (error) {
            console.error(`[Core Frames] Error generating frame ${i + 1}:`, error);
            // Decide whether to stop or continue on frame error
            throw new Error(`Failed to generate frame ${i + 1}: ${error.message || error}`); // Stop on error
        }
    }
    console.log(`[Core Frames] Successfully generated ${frames.length} frame blobs.`);
    if (onProgress) onProgress(1, `Generated ${frames.length} frames.`);
    return frames;
}

/**
 * Generates a preview (SVG or PNG Data URL) for display in UI modals.
 * @param {object} options - Preview options (width, height, transparentBackground, frameCount for GIF).
 * @param {HTMLImageElement} previewImg - The <img> element to display the preview.
 * @param {HTMLElement} loadingElement - The loading indicator element.
 * @param {string} [exportType='svg'] - The type of preview ('svg', 'png', 'gif').
 * @returns {Promise<object>} Resolves with { blob, dataUrl, frames? }.
 */
export function generateConsistentPreview(options, previewImg, loadingElement, exportType = 'svg') {
    console.log(`[Core Preview] Generating ${exportType} preview. Options:`, options);
    // Ensure UI elements are handled correctly even if null
    if (loadingElement) loadingElement.style.display = 'flex';
    if (previewImg) { previewImg.style.display = 'none'; previewImg.removeAttribute('src'); previewImg.alt = `Generating ${exportType} preview...`; }

    return new Promise(async (resolve, reject) => {
        try {
            let result = { blob: null, dataUrl: null };
            const previewWidth = options.width || 400; // Use smaller defaults for preview
            const previewHeight = options.height || 300;
            const transparent = options.transparentBackground || false;

            if (exportType === 'gif') {
                const previewFrameCount = Math.min(options.frameCount || 15, 10); // Fewer frames for preview
                console.log(`[Core Preview GIF] Generating ${previewFrameCount} frames.`);
                const frames = await generateAnimationFrames({
                    width: previewWidth, height: previewHeight, frameCount: previewFrameCount, transparent,
                    onProgress: (prog, msg) => {
                        if (loadingElement) {
                             const txt = loadingElement.querySelector('.progress-text') || loadingElement;
                             if(txt) txt.textContent = msg || `Generating preview... (${Math.round(prog*100)}%)`;
                        }
                    }
                });
                if (!frames || frames.length === 0) throw new Error("Failed to generate preview frames");
                result.blob = frames[0]; // Use first frame blob
                result.frames = frames; // Include frames for potential preview animation
                result.dataUrl = await blobToDataURL(frames[0]); // Data URL for first frame static display
            } else {
                // SVG or PNG preview uses the same core path
                 console.log(`[Core Preview ${exportType.toUpperCase()}] Generating base SVG...`);
                const svgBlob = await generateSVGBlob({ width: previewWidth, height: previewHeight, transparentBackground: transparent });
                if (exportType === 'png') {
                     console.log(`[Core Preview PNG] Converting SVG to PNG...`);
                    result.blob = await convertSVGtoPNG(svgBlob, { width: previewWidth, height: previewHeight, transparentBackground: transparent });
                } else { // SVG preview
                    result.blob = svgBlob;
                }
                result.dataUrl = await blobToDataURL(result.blob);
            }

            // Update UI Image Element
            if (previewImg && result.dataUrl) {
                 previewImg.onload = () => {
                      console.log(`[Core Preview] ${exportType.toUpperCase()} preview loaded into img tag.`);
                      if (loadingElement) loadingElement.style.display = 'none';
                      previewImg.style.display = 'block'; // Show image only after load
                      previewImg.alt = `${exportType.toUpperCase()} Export Preview`;
                 };
                 previewImg.onerror = () => {
                      console.error(`[Core Preview] Failed to load ${exportType.toUpperCase()} preview Data URL into img tag.`);
                      if (loadingElement) loadingElement.style.display = 'none';
                      previewImg.style.display = 'block'; // Show alt text
                      previewImg.alt = `${exportType.toUpperCase()} Preview Failed to Load`;
                 };
                 previewImg.src = result.dataUrl;
            } else {
                 // If no image tag, just hide loading
                 if (loadingElement) loadingElement.style.display = 'none';
            }

            resolve(result);

        } catch (error) {
            console.error(`[Core Preview] Error generating ${exportType} preview:`, error);
            if (loadingElement) { loadingElement.style.display = 'flex'; (loadingElement.querySelector('.progress-text') || loadingElement).textContent = "Preview Failed!"; }
            if (previewImg) { previewImg.style.display = 'none'; previewImg.alt = "Preview Failed"; }
            reject(error); // Propagate error
        }
    });
}


console.log("[RendererCore v2.6] Module loaded successfully.");