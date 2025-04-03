/**
 * RendererCore.js (Version 2.2 - Restored Helpers & Refined SVG Gen)
 * ====================================================
 * Centralized rendering pipeline for SVG, PNG and GIF exports.
 * - Uses captureAdvancedStyles for consistent style input.
 * - Refined SVG generation for background, gradients, text, filters, and CSS.
 * - Restored helper functions.
 */

// Import the standardized style capture function
import { captureAdvancedStyles } from '../captureTextStyles.js';
// Import helpers for animation details - ONLY import what's needed
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js';

console.log("[RendererCore] Module loading (v2.2)...");

// --- Helper Functions (Restored/Defined at Module Scope) ---

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

/** Normalizes CSS color values for SVG attributes. */
function normalizeColor(color) {
    if (!color || typeof color !== 'string') return 'rgba(0,0,0,0)'; // Default transparent if invalid
    color = color.trim().toLowerCase();
    if (color === 'transparent' || color === 'none') return 'rgba(0,0,0,0)';
    // Basic check for hex/rgb/rgba - might need improvement for HSL etc. if used
    if (color.startsWith('#') || color.startsWith('rgb')) {
         return color;
    }
    // Add simple named color check? Very basic.
    const simpleColors = { 'white': '#ffffff', 'black': '#000000' /* ... add more if needed */ };
    if (simpleColors[color]) return simpleColors[color];

    // Fallback if not recognized (might be invalid)
    console.warn(`[Core Util] normalizeColor: Unrecognized color format "${color}", returning as is.`);
    return color;
}

/** Escapes characters problematic in XML attributes. */
function escapeSVGAttribute(str) {
    if (typeof str !== 'string') return '';
    // Prioritize replacing quotes, then essential XML chars
    return str.replace(/"/g, "'") // Replace double quotes with single (safer for attributes)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
              // Do NOT replace ' here as we use single quotes in attributes now
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

/** Helper function to extract colors from gradient string */
function extractColorsFromGradient(gradientStr) {
    if (!gradientStr || typeof gradientString !== 'string') return [];
    // Regex updated to be less greedy and handle spaces better
    const colorRegex = /#[0-9a-f]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;
    return gradientString.match(colorRegex) || [];
}

/** Create SVG text gradient definition */
function createGradientDef(styles, gradientId) {
    if (styles.color?.mode !== 'gradient' || !gradientId) return '';
    console.log(`[Core] Creating text gradient definition #${gradientId}. Style data:`, styles.color.gradient);
    const gradientInfo = styles.color.gradient || {};
    // Use captured gradient colors directly if available
    const colors = gradientInfo.colors || [];
    let c1 = colors[0] || styles.gradientColors?.c1 || '#FF1493'; // Fallback chain
    let c2 = colors[1] || styles.gradientColors?.c2 || '#8A2BE2';
    let c3 = colors[2] || styles.gradientColors?.c3 || '#FF4500';
    const useC3 = styles.gradientColors?.useC3 || (colors.length > 2); // Infer useC3 if 3+ colors captured

    const dir = parseFloat(gradientInfo.direction || styles.gradientDirection || '45');
    // Convert CSS angle (0=up, 90=right) to SVG angle (0=right)
    const angleRad = (dir - 90) * Math.PI / 180;
    const x1 = (0.5 - Math.cos(angleRad) * 0.5).toFixed(4); // Calculate vector start/end points (0-1 range)
    const y1 = (0.5 - Math.sin(angleRad) * 0.5).toFixed(4);
    const x2 = (0.5 + Math.cos(angleRad) * 0.5).toFixed(4);
    const y2 = (0.5 + Math.sin(angleRad) * 0.5).toFixed(4);

    let stops = '';
    if (useC3) {
         stops = `
<stop offset="0%" stop-color="${normalizeColor(c1)}"/>
<stop offset="50%" stop-color="${normalizeColor(c2)}"/>
<stop offset="100%" stop-color="${normalizeColor(c3)}"/>`;
         console.log(`[Core] Text Gradient Stops (3 colors): ${c1}, ${c2}, ${c3}`);
    } else {
         stops = `
<stop offset="0%" stop-color="${normalizeColor(c1)}"/>
<stop offset="100%" stop-color="${normalizeColor(c2)}"/>`;
         console.log(`[Core] Text Gradient Stops (2 colors): ${c1}, ${c2}`);
    }
    // Use objectBoundingBox for easier scaling if gradient applied to text element directly
    return `<linearGradient id="${gradientId}" gradientUnits="objectBoundingBox" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}
    </linearGradient>`;
}


/** Create SVG background gradient definition */
function createBackgroundGradientDef(styles, settings, id) {
    if (!id || !styles?.background?.gradient) return '';
    console.log('[Core] Creating background gradient definition.');
    const bgGradientInfo = styles.background.gradient || {};
    const rootStyles = window.getComputedStyle(document.documentElement);
    // Use captured colors/direction first, fallback to settings/CSS vars
    let colors = bgGradientInfo.colors || [];
    let c1 = colors[0] || settings.bgColor1 || '#3a1c71';
    let c2 = colors[1] || settings.bgColor2 || '#ffaf7b';
    let direction = parseFloat(bgGradientInfo.direction || settings.bgGradientDirection || rootStyles.getPropertyValue('--bg-gradient-direction')?.trim() || '90');
    console.log(`[Core] Background Gradient: c1=${c1}, c2=${c2}, direction=${direction}deg`);
    // Calculate vector based on angle (same logic as text gradient)
    const angleRad = (direction - 90) * Math.PI / 180;
    const x1 = (0.5 - Math.cos(angleRad) * 0.5).toFixed(4);
    const y1 = (0.5 - Math.sin(angleRad) * 0.5).toFixed(4);
    const x2 = (0.5 + Math.cos(angleRad) * 0.5).toFixed(4);
    const y2 = (0.5 + Math.sin(angleRad) * 0.5).toFixed(4);
    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">\n<stop offset="0%" stop-color="${normalizeColor(c1)}"/>\n<stop offset="100%" stop-color="${normalizeColor(c2)}"/>\n</linearGradient>`;
}


/** Create SVG background rectangle */
function createBackgroundRect(styles, bgGradientId) {
    if (!styles?.background) return ''; // Need background info
    console.log(`[Core] Creating background rect. Type: ${styles.background.type}, Color: ${styles.background.color}, Opacity: ${styles.background.opacity}, GradientID: ${bgGradientId}`);

    let bgFill = 'none';
    const bgType = styles.background.type || 'bg-solid';
    const bgColor = normalizeColor(styles.background.color || '#000000');
    const bgOpacity = styles.background.opacity || '1';

    if (bgType === 'bg-solid' && bgColor !== 'rgba(0,0,0,0)') {
        bgFill = bgColor;
    } else if (bgType.includes('gradient') && bgGradientId) {
        bgFill = `url(#${bgGradientId})`;
    } else if (bgType !== 'bg-transparent' && bgColor !== 'rgba(0,0,0,0)') {
        // For patterns, render the base background color
        bgFill = bgColor;
        console.log(`[Core] Background is pattern type (${bgType}), using computed base color: ${bgColor}`);
    } else {
        console.log(`[Core] Background is transparent, skipping rect generation.`);
        return ''; // Explicitly return empty for transparent
    }

    console.log(`[Core] Generating background rect: fill="${bgFill}" opacity="${bgOpacity}"`);
    return `<rect width="100%" height="100%" fill="${escapeSVGAttribute(bgFill)}" opacity="${escapeSVGAttribute(bgOpacity)}"/>`;
}


/** Generate embedded CSS including font face and animations. */
async function generateEmbeddedCSS(styles, animationMetadata) {
    let css = `/* Embedded CSS - Logomaker Core v2.2 */\n`;
    let cssAdded = false;
    console.log('[Core CSS] Generating embedded CSS. Animation Metadata:', animationMetadata);

    // --- Font Embedding ---
    if (styles.font?.family && styles.font?.embedData) {
        const embed = styles.font.embedData;
        css += `@font-face {\n  font-family: "${styles.font.family}";\n  src: url("${embed.file}") format("${embed.format || 'woff2'}");\n  font-weight: ${embed.weight || 400};\n  font-style: ${embed.style || 'normal'};\n}\n\n`;
        cssAdded = true; console.log(`[Core CSS] Embedded @font-face for ${styles.font.family}`);
    } else if (styles.font?.family) { console.warn(`[Core CSS] Font ${styles.font.family} specified, but no embed data found.`); }

    // --- Animation Keyframes & Class ---
    const anim = styles.animation;
    if (anim?.class && anim.class !== 'anim-none') {
        const animName = anim.class.replace('anim-', '');
        let keyframesCss = anim.activeKeyframes; // Use captured keyframes first
        if (!keyframesCss && typeof window.getActiveAnimationKeyframes === 'function') {
            console.log(`[Core CSS] Trying getActiveAnimationKeyframes for '${animName}'`);
            keyframesCss = window.getActiveAnimationKeyframes(animName);
        }

        if (keyframesCss) {
            css += `/* Animation: ${animName} */\n${keyframesCss}\n\n`; cssAdded = true; console.log(`[Core CSS] Embedded @keyframes for ${animName}`);
            css += `.${anim.class} {\n`;
            const duration = anim.duration || '2s';
            // Base animation properties
            css += `  animation: ${animName} ${duration} ${anim.timingFunction || 'linear'} ${anim.iterationCount || 'infinite'};\n`;
             // Apply animation play state and delay based on metadata (for frame rendering)
             if (animationMetadata?.progress !== undefined && anim?.durationMs) {
                 const delayMs = - (animationMetadata.progress * anim.durationMs);
                 // IMPORTANT: Need to apply this as INLINE style on the element,
                 // or ensure this CSS overrides default play state if possible.
                 // Adding it here might not work as intended for pausing/seeking via CSS alone.
                 // Let's rely on the inline style added in generateSVGTextElement.
                 console.log(`[Core CSS] Note: Animation progress (${animationMetadata.progress}) handled via inline style on text element.`);
             }

            if (styles.color?.mode === 'gradient') { css += `  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;\n  -webkit-text-fill-color: transparent;\n`; }
            css += `}\n\n`; cssAdded = true; console.log(`[Core CSS] Added animation class rule for ${anim.class}`);
        } else { console.warn(`[Core CSS] Failed to find or generate keyframes for animation: ${animName}`); }
    } else { console.log('[Core CSS] No active animation detected for CSS embedding.'); }

    return cssAdded ? css.trim() : null;
}

/** Generate SVG Text element */
function generateSVGTextElement(textContent, styles, gradientId, filterId, animationMetadata) {
     console.log("[Core Text] Generating SVG text element. Text:", textContent);
     if (!styles || !styles.font) { console.error("[Core Text] Missing critical style info."); return ''; }
     const font = styles.font; const color = styles.color; const border = styles.border; const effects = styles.effects; const anim = styles.animation; const transform = styles.transform;
     let textElement = `<text x="50%" y="50%" text-anchor="${styles.textAnchor || 'middle'}" dominant-baseline="${styles.dominantBaseline || 'middle'}" `;
     textElement += `font-family="${font.family ? escapeSVGAttribute(font.family) : 'sans-serif'}" font-size="${font.size || '60px'}" `;
     if (font.weight) textElement += `font-weight="${font.weight}" `;
     if (font.style && font.style !== 'normal') textElement += `font-style="${font.style}" `;
     if (font.letterSpacing && font.letterSpacing !== 'normal' && font.letterSpacing !== '0px') textElement += `letter-spacing="${font.letterSpacing}" `;
     if (color?.mode === 'gradient' && gradientId) { textElement += `fill="url(#${gradientId})" `; console.log(`[Core Text] Applied gradient fill: url(#${gradientId})`);}
     else { const fillColor = normalizeColor(color?.value || '#ffffff'); textElement += `fill="${fillColor}" `; console.log(`[Core Text] Applied solid fill: ${fillColor}`);}
     if (border?.style && border.style !== 'none' && border.style !== 'hidden') { const strokeColor = normalizeColor(border.color || '#ffffff'); const strokeWidth = parseFloat(border.width) || 1; textElement += `stroke="${strokeColor}" stroke-width="${strokeWidth}" `; if (border.dasharray) textElement += `stroke-dasharray="${border.dasharray}" `; console.log(`[Core Text] Applied stroke: Color=${strokeColor}, Width=${strokeWidth}, Dash=${border.dasharray || 'none'}`);}
     else { console.log(`[Core Text] No border/stroke applied.`); }
     if (filterId) { textElement += `filter="url(#${filterId})" `; console.log(`[Core Text] Applied filter: url(#${filterId})`);}
     if (transform?.cssValue && transform.cssValue !== 'none') { textElement += `transform="${escapeSVGAttribute(transform.cssValue)}" `; console.log(`[Core Text] Applied transform: ${transform.cssValue}`);}
     let animationStyleOverride = ''; const animClass = anim?.class;
     if (animClass && animClass !== 'anim-none') { textElement += `class="${animClass}" `; console.log(`[Core Text] Applied animation class: ${animClass}`); if (animationMetadata?.progress !== undefined && anim?.durationMs) { const delayMs = - (animationMetadata.progress * anim.durationMs); animationStyleOverride = `animation-delay: ${delayMs.toFixed(0)}ms !important; animation-play-state: paused !important;`; console.log(`[Core Text] Applied animation override for progress ${animationMetadata.progress.toFixed(2)} (delay: ${delayMs}ms)`);}}
     if (animationStyleOverride) { textElement += `style="${escapeSVGAttribute(animationStyleOverride)}" `; }
     const escapedText = escapeXML(textContent || 'Logo'); textElement += `>${escapedText}</text>`;
     return textElement;
}


// --- Public Exported Functions ---

/**
 * Centralized function to generate an SVG blob with all styles accurately captured.
 * @param {object} options - Export options { width, height, text, includeBackground, transparentBackground, animationMetadata }
 * @returns {Promise<Blob>} - SVG blob with embedded styles.
 * @throws {Error} If style capture or SVG generation fails.
 */
export async function generateSVGBlob(options = {}) { // Renamed to prevent conflict if used externally
    console.log("[Core] generateSVGBlob called. Options received:", JSON.stringify(options)); // Log entry

    try {
        // --- 1. Capture Styles ---
        const styles = captureAdvancedStyles();
        if (!styles) {
            console.error('[Core] CRITICAL: Style capture failed!');
            throw new Error('Failed to capture styles for SVG generation');
        }
        console.log("[Core] Styles Captured:", JSON.stringify(styles, null, 2));

        // --- 2. Determine Configuration ---
        const currentSettings = window.SettingsManager?.getCurrentSettings?.() || {};
        const defaults = {
            width: parseInt(styles.exportConfig?.width || currentSettings.exportWidth || '800'),
            height: parseInt(styles.exportConfig?.height || currentSettings.exportHeight || '400'),
            text: styles.textContent?.finalText || currentSettings.logoText || 'Logo',
            includeBackground: true,
            transparentBackground: styles.exportConfig?.transparent ?? options.transparentBackground ?? currentSettings.exportTransparent ?? false,
            animationMetadata: options.animationMetadata || extractSVGAnimationDetails()
        };
        const config = { ...defaults, ...options };

        if (!config.width || config.width <= 0 || !config.height || config.height <= 0) {
             console.error(`[Core] Invalid SVG dimensions: ${config.width}x${config.height}. Falling back to 800x400.`);
             config.width = 800; config.height = 400;
        }
        console.log("[Core] Final SVG Config:", JSON.stringify(config));

        // --- 3. Build SVG String ---
        let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">\n`;

        // --- 4. Definitions (`<defs>`) ---
        svg += `<defs>\n`;
        let textGradientId = null;
        let backgroundGradientId = null;
        let filterId = null;

        // Text Gradient
        if (styles.color?.mode === 'gradient') {
            textGradientId = 'svgTextGradient';
            const gradientDef = createGradientDef(styles, textGradientId);
            if (gradientDef) { svg += `  ${gradientDef}\n`; console.log("[Core] Added Text Gradient Definition."); }
            else { textGradientId = null; }
        }

        // Filter
        // Use a consistent ID if an effect is present
        if (styles.effects?.type && styles.effects.type !== 'none') {
             filterId = 'svgTextEffect'; // Use the ID captured/determined by getEffectDetails
             const filterDef = createFilterDef(styles, filterId);
             if (filterDef) { svg += `  ${filterDef}\n`; console.log(`[Core] Added Filter Definition (ID: ${filterId}).`); }
             else { filterId = null; } // Reset if def failed
        }


        // Background Gradient
        const effectiveBgType = styles.background?.type || 'bg-solid';
        if (config.includeBackground && !config.transparentBackground && effectiveBgType.includes('gradient')) {
            backgroundGradientId = 'svgBgGradient';
            const bgGradientDef = createBackgroundGradientDef(styles, currentSettings, backgroundGradientId);
            if (bgGradientDef) { svg += `  ${bgGradientDef}\n`; console.log("[Core] Added Background Gradient Definition."); }
            else { backgroundGradientId = null; }
        }
        svg += `</defs>\n`;

        // --- 5. Embedded CSS (`<style>`) ---
        const embeddedCSS = await generateEmbeddedCSS(styles, config.animationMetadata);
        if (embeddedCSS) {
            svg += `<style type="text/css"><![CDATA[\n${embeddedCSS}\n]]></style>\n`;
            console.log("[Core] Embedded CSS added.");
        } else { console.log("[Core] No embedded CSS generated."); }

        // --- 6. Background Rectangle (`<rect>`) ---
        if (config.includeBackground && !config.transparentBackground) {
            const bgRect = createBackgroundRect(styles, backgroundGradientId);
            if (bgRect) { svg += bgRect + '\n'; }
        } else { console.log("[Core] Skipping background rectangle (transparent or excluded)."); }

        // --- 7. Text Element (`<text>`) ---
        const textElement = generateSVGTextElement(config.text, styles, textGradientId, filterId, config.animationMetadata);
        if (textElement) { svg += textElement + "\n"; console.log("[Core] Text element generated."); }
        else { console.error("[Core] Failed to generate text element!"); }

        // --- 8. Close SVG ---
        svg += `</svg>`;

        // --- 9. Create Blob ---
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        console.log(`[Core] SVG Blob generated successfully. Size: ${(blob.size / 1024).toFixed(1)} KB`);
        return blob;

    } catch (error) {
        console.error('[Core] SVG Blob Generation Failed:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        // Throw a new error to ensure the stack trace originates here if caught upstream
        throw new Error(`SVG Generation Failed: ${errMsg}`);
    }
}


// /**
//  * Creates the SVG text element with styling and animation.
//  * @param {string} textContent - The final text to display.
//  * @param {object} styles - The captured styles object from captureAdvancedStyles.
//  * @param {string|null} gradientId - The ID of the text gradient definition, if any.
//  * @param {string|null} filterId - The ID of the filter definition, if any.
//  * @param {object|null} animationMetadata - Animation details (may include progress).
//  * @returns {string} The generated SVG <text> element string.
//  */
// function generateSVGTextElement(textContent, styles, gradientId, filterId, animationMetadata) {
//     console.log("[Core] Generating SVG text element. Text:", textContent);
//     if (!styles || !styles.font) {
//         console.error("[Core] Cannot generate text element: Missing critical style information (styles.font).");
//         return '';
//     }

//     // Use captured styles directly
//     const font = styles.font;
//     const color = styles.color;
//     const border = styles.border;
//     const effects = styles.effects;
//     const anim = styles.animation;
//     const transform = styles.transform; // Use captured transform

//     let textElement = `<text x="50%" y="50%" `;
//     textElement += `text-anchor="${styles.textAnchor || 'middle'}" `;
//     textElement += `dominant-baseline="${styles.dominantBaseline || 'middle'}" `;

//     // Font attributes
//     textElement += `font-family="${font.family ? escapeSVGAttribute(font.family) : 'sans-serif'}" `;
//     textElement += `font-size="${font.size || '60px'}" `;
//     if (font.weight) textElement += `font-weight="${font.weight}" `;
//     if (font.style && font.style !== 'normal') textElement += `font-style="${font.style}" `;
//     if (font.letterSpacing && font.letterSpacing !== 'normal') textElement += `letter-spacing="${font.letterSpacing}" `;
//     // text-transform is applied to textContent directly, not needed as SVG attribute

//     // Fill/Color
//     if (color?.mode === 'gradient' && gradientId) {
//         textElement += `fill="url(#${gradientId})" `;
//         console.log(`[Core Text] Applied gradient fill: url(#${gradientId})`);
//     } else {
//         const fillColor = normalizeColor(color?.value || '#ffffff');
//         textElement += `fill="${fillColor}" `;
//         console.log(`[Core Text] Applied solid fill: ${fillColor}`);
//     }

//     // Border/Stroke attributes from captured styles
//     if (border?.style && border.style !== 'none' && border.style !== 'hidden') {
//         const strokeColor = normalizeColor(border.color || '#ffffff');
//         const strokeWidth = parseFloat(border.width) || 1; // Default to 1px if parsing fails
//         textElement += `stroke="${strokeColor}" `;
//         textElement += `stroke-width="${strokeWidth}" `;
//         if (border.dasharray) textElement += `stroke-dasharray="${border.dasharray}" `;
//         console.log(`[Core Text] Applied stroke: Color=${strokeColor}, Width=${strokeWidth}, Dash=${border.dasharray || 'none'}`);
//     } else {
//          console.log(`[Core Text] No border/stroke applied.`);
//     }


//     // Filter (Glow/Shadow)
//     if (filterId) {
//         textElement += `filter="url(#${filterId})" `;
//         console.log(`[Core Text] Applied filter: url(#${filterId})`);
//     }

//     // Transform (Rotation, etc.) - Use captured transform directly
//     if (transform?.cssValue && transform.cssValue !== 'none') {
//         // Convert CSS transform matrix/rotate/etc. to SVG transform attribute if needed,
//         // or assume it's directly applicable (like rotate(Ndeg)). For simplicity, apply directly.
//         textElement += `transform="${escapeSVGAttribute(transform.cssValue)}" `;
//          console.log(`[Core Text] Applied transform: ${transform.cssValue}`);
//     }

//     // --- Animation ---
//     let animationStyleOverride = '';
//     const animClass = anim?.class;
//     if (animClass && animClass !== 'anim-none') {
//         textElement += `class="${animClass}" `; // Apply class for embedded CSS animation
//          console.log(`[Core Text] Applied animation class: ${animClass}`);

//         // Handle animation progress for frame generation
//         if (animationMetadata?.progress !== undefined && anim?.durationMs) {
//              const delayMs = - (animationMetadata.progress * anim.durationMs);
//              // Apply animation delay as an inline style override
//              animationStyleOverride = `animation-delay: ${delayMs.toFixed(0)}ms; animation-play-state: paused;`;
//              console.log(`[Core Text] Applied animation override for progress ${animationMetadata.progress.toFixed(2)} (delay: ${delayMs}ms)`);
//              // NOTE: This assumes the embedded CSS animation is infinite.
//              // More complex animations might need different handling.
//         }
//     }

//     // Apply inline style if needed (e.g., for animation override)
//     if (animationStyleOverride) {
//         textElement += `style="${escapeSVGAttribute(animationStyleOverride)}" `;
//     }


//     // Close opening tag and add escaped text content
//     const escapedText = escapeXML(textContent || 'Logo');
//     textElement += `>`;
//     textElement += escapedText;
//     textElement += `</text>`;

//     return textElement;
// }

/**
 * Create SVG filter definition based on captured styles.
 * @param {object} styles - Captured styles object.
 * @param {string} filterId - The ID to use for the filter.
 * @returns {string} The SVG <filter> definition string or empty string.
 */
function createFilterDef(styles, filterId) {
    if (!filterId || !styles?.effects) return '';
    console.log(`[Core] Creating filter definition (ID: ${filterId}). Effects:`, styles.effects);

    const { shadowInfo, glowInfo } = styles.effects;
    let filterContent = '';

    // Prioritize Glow if present
    if (glowInfo) {
         console.log(`[Core] Creating Glow filter. Color: ${glowInfo.color}, Blur: ${glowInfo.blur}`);
         // Simple Gaussian Blur based glow
         filterContent = `
        <feGaussianBlur in="SourceAlpha" stdDeviation="${glowInfo.blur || 3}" result="blur"/>
        <feFlood flood-color="${normalizeColor(glowInfo.color)}" flood-opacity="${glowInfo.opacity || 0.8}" result="color"/>
        <feComposite in="color" in2="blur" operator="in" result="glow"/>
        <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>`;
    }
    // Fallback to Shadow if no glow
    else if (shadowInfo) {
         console.log(`[Core] Creating Shadow filter. dx:${shadowInfo.dx}, dy:${shadowInfo.dy}, Blur:${shadowInfo.blur}, Color:${shadowInfo.color}`);
         filterContent = `
        <feDropShadow dx="${shadowInfo.dx || 2}" dy="${shadowInfo.dy || 2}" stdDeviation="${shadowInfo.blur || 2}" flood-color="${normalizeColor(shadowInfo.color)}" flood-opacity="${shadowInfo.opacity || 0.7}"/>`;
    } else {
         console.log('[Core] No glow or shadow info found for filter.');
         return ''; // No effect detected
    }

    return `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">${filterContent}</filter>`;
}

// /**
//  * Create SVG background gradient definition.
//  * @param {object} styles - Captured styles object.
//  * @param {object} settings - Current settings (for fallbacks).
//  * @param {string} id - The ID for the gradient definition.
//  * @returns {string} The SVG <linearGradient> definition string or empty string.
//  */
// function createBackgroundGradientDef(styles, settings, id) {
//     if (!id || !styles?.background) return '';
//     console.log('[Core] Creating background gradient definition.');

//     const bgStyles = styles.background;
//     const rootStyles = window.getComputedStyle(document.documentElement);

//     // Prioritize captured gradient colors/direction, fallback to settings/CSS vars
//     let colors = bgStyles.gradient?.colors || [];
//     let c1 = colors[0] || settings.bgColor1 || '#3a1c71';
//     let c2 = colors[1] || settings.bgColor2 || '#ffaf7b';
//     let direction = parseFloat(bgStyles.gradient?.direction || settings.bgGradientDirection || rootStyles.getPropertyValue('--bg-gradient-direction')?.trim() || '90');

//     console.log(`[Core] Background Gradient: c1=${c1}, c2=${c2}, direction=${direction}deg`);

//     // Convert CSS angle (0deg=up, 90deg=right) to SVG gradient vector
//     // SVG vectors: (x1,y1) -> (x2,y2) from 0,0 to 1,1 (or %)
//     // 0deg (up) -> (0.5, 1) -> (0.5, 0) -> x1=50% y1=100% x2=50% y2=0%
//     // 90deg (right) -> (0, 0.5) -> (1, 0.5) -> x1=0% y1=50% x2=100% y2=50%
//     // etc. Let's use objectBoundingBox for simplicity.
//     const angleRad = (direction - 90) * Math.PI / 180; // Adjust angle for vector calculation (0=right)
//     const x1 = Math.max(0, 0.5 - Math.cos(angleRad) * 0.5).toFixed(2);
//     const y1 = Math.max(0, 0.5 - Math.sin(angleRad) * 0.5).toFixed(2);
//     const x2 = Math.min(1, 0.5 + Math.cos(angleRad) * 0.5).toFixed(2);
//     const y2 = Math.min(1, 0.5 + Math.sin(angleRad) * 0.5).toFixed(2);


//     return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">
//       <stop offset="0%" stop-color="${normalizeColor(c1)}"/>
//       <stop offset="100%" stop-color="${normalizeColor(c2)}"/>
//     </linearGradient>`;
// }

// --- PNG Conversion (Relies on generateSVGBlob) ---
/**
 * Converts an SVG blob to a PNG blob using the Canvas API.
 * @param {Blob} svgBlob - The SVG blob to convert.
 * @param {object} options - Conversion options { width, height, quality, transparentBackground }.
 * @returns {Promise<Blob>} - A promise resolving with the PNG blob.
 * @throws {Error} If conversion fails.
 */
export function convertSVGtoPNG(svgBlob, options = {}) {
    return new Promise((resolve, reject) => {
        const {
            width = 800,
            height = 400,
            quality = 0.95, // PNG quality is actually lossless, this affects potential future JPG export maybe? Keep for consistency.
            transparentBackground = false // This is mainly handled by the SVG generation now
        } = options;
        console.log(`[Core] Converting SVG to PNG. Options:`, {width, height, quality, transparentBackground});

        if (!(svgBlob instanceof Blob)) {
             return reject(new Error("Invalid SVG Blob provided for PNG conversion."));
        }

        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
             console.log("[Core] SVG Image loaded for canvas drawing.");
             try {
                 const canvas = document.createElement('canvas');
                 canvas.width = width;
                 canvas.height = height;
                 const ctx = canvas.getContext('2d');

                 // The SVG's background rect (or lack thereof) determines transparency now.
                 // We just draw the SVG onto the canvas.
                 ctx.clearRect(0, 0, width, height); // Clear canvas initially (good practice)
                 ctx.drawImage(img, 0, 0, width, height);
                 console.log("[Core] SVG drawn to canvas.");

                 // Convert canvas to PNG blob
                 canvas.toBlob(
                     blob => {
                         URL.revokeObjectURL(url); // Clean up object URL
                         if (blob) {
                             console.log(`[Core] PNG Blob created. Size: ${(blob.size / 1024).toFixed(1)} KB`);
                             resolve(blob);
                         } else {
                             console.error('[Core] canvas.toBlob failed, returned null.');
                             reject(new Error('Failed to convert canvas to PNG blob.'));
                         }
                     },
                     'image/png'
                     // Quality parameter is ignored for PNG
                 );
             } catch (err) {
                 URL.revokeObjectURL(url);
                 console.error('[Core] Canvas drawing or toBlob conversion failed:', err);
                 reject(new Error(`Canvas conversion failed: ${err.message}`));
             }
        };

        img.onerror = (errEvent) => {
             URL.revokeObjectURL(url);
             console.error('[Core] Failed to load SVG blob into Image:', errEvent);
             reject(new Error('Failed to load SVG image for PNG conversion. Check SVG content.'));
        };

        img.src = url; // Start loading the SVG
    });
}

// --- Animation Frame Generation (Relies on generateSVGBlob) ---
/**
 * Generate animation frames by rendering SVG at different progress points.
 * @param {object} options - Frame generation options { width, height, frameCount, transparent, onProgress }.
 * @returns {Promise<Array<Blob>>} - Array of PNG frame blobs.
 * @throws {Error} If frame generation fails.
 */
export async function generateAnimationFrames(options = {}) {
    const {
        width = 800,
        height = 400,
        frameCount = 15,
        transparent = false,
        onProgress = null // Callback: (progress: number, message: string) => void
    } = options;

    console.log(`[Core] Generating ${frameCount} animation frames at ${width}x${height}. Transparent: ${transparent}`);
    const frames = [];

    // Get base animation metadata (type, duration) - needed by generateSVGBlob/generateEmbeddedCSS
    const baseAnimationMetadata = extractSVGAnimationDetails();

    if (!baseAnimationMetadata) {
        console.warn('[Core Frames] No active animation detected. Generating a single static frame.');
        // Generate a single static frame if no animation is active
         try {
            const svgBlob = await generateSVGBlob({ width, height, transparentBackground: transparent });
            const pngBlob = await convertSVGtoPNG(svgBlob, { width, height, transparentBackground: transparent });
             if(onProgress) onProgress(1, `Generated 1 static frame`);
            return [pngBlob]; // Return array with one frame
         } catch (error) {
             console.error('[Core Frames] Error generating static frame:', error);
             throw error;
         }
    }

    console.log("[Core Frames] Base Animation Metadata:", baseAnimationMetadata);


    for (let i = 0; i < frameCount; i++) {
        const progress = frameCount <= 1 ? 0 : i / (frameCount - 1); // Progress from 0 to 1
        if (typeof onProgress === 'function') {
            const percent = Math.round((i / frameCount) * 100);
            onProgress(percent / 100, `Generating frame ${i + 1}/${frameCount} (${percent}%)...`);
        }

        // Check for cancellation (if onProgress can signal it via an exception or flag)
        // if (exportCancelled) throw new Error("Export Cancelled");

        try {
             // Create metadata override for this specific frame's progress
            const frameAnimationMetadata = {
                 ...baseAnimationMetadata,
                 progress: progress // Add progress for SVG generation logic
             };

             // Generate the SVG for this specific frame/progress
             // Pass the frame-specific animation metadata
             const svgBlob = await generateSVGBlob({
                 width,
                 height,
                 transparentBackground: transparent,
                 animationMetadata: frameAnimationMetadata // Pass progress info
             });

             // Convert this frame's SVG to PNG
             const pngBlob = await convertSVGtoPNG(svgBlob, {
                 width,
                 height,
                 transparentBackground: transparent,
                 quality: 1 // Use max quality for frames
             });

             frames.push(pngBlob);
             console.log(`[Core Frames] Generated frame ${i + 1}/${frameCount} (Progress: ${progress.toFixed(2)})`);

        } catch (error) {
             console.error(`[Core Frames] Error generating frame ${i + 1}:`, error);
             // Decide whether to skip frame or abort entirely
             // For now, let's abort if a frame fails
             throw new Error(`Failed to generate frame ${i + 1}: ${error.message}`);
        }
    }

    console.log(`[Core Frames] Successfully generated ${frames.length} frame blobs.`);
    if (typeof onProgress === 'function') {
        onProgress(1, `Generated ${frames.length} frames.`);
    }
    return frames;
}


// --- Preview Generation (Relies on generateSVGBlob/convertSVGtoPNG/generateAnimationFrames) ---
/**
 * Generates a preview image (SVG or PNG) for exporter modals.
 * @param {object} options - Preview options (width, height, quality, transparentBackground, frameCount for GIF).
 * @param {HTMLImageElement} previewImg - The <img> element to update.
 * @param {HTMLElement} loadingElement - The loading indicator element.
 * @param {'svg' | 'png' | 'gif'} exportType - The type of export the preview is for.
 * @returns {Promise<{blob: Blob, dataUrl?: string, frames?: Blob[]}>} - Resolves with blob(s) and optional dataUrl.
 * @throws {Error} If preview generation fails.
 */
export function generateConsistentPreview(options, previewImg, loadingElement, exportType = 'svg') {
    console.log(`[Core Preview] Generating preview for type: ${exportType}. Options:`, options);

    // --- Show Loading State ---
    if (loadingElement) loadingElement.style.display = 'flex'; // Use flex if spinner is inside
    if (previewImg) {
        previewImg.style.display = 'none'; // Hide image while loading
        previewImg.removeAttribute('src'); // Clear previous src
        previewImg.alt = "Generating preview...";
    }

    return new Promise(async (resolve, reject) => {
        try {
            let result = { blob: null }; // Initialize result object

            if (exportType === 'gif') {
                // Generate a small number of frames for GIF preview
                const previewFrameCount = Math.min(options.frameCount || 15, 10); // Limit preview frames
                const frameOptions = {
                    width: options.width || 400,
                    height: options.height || 300,
                    frameCount: previewFrameCount,
                    transparent: options.transparentBackground || false,
                    onProgress: (prog, msg) => {
                        if (loadingElement) {
                             const progressTextEl = loadingElement.querySelector('.progress-text') || loadingElement;
                             progressTextEl.textContent = msg || `Generating preview frames (${Math.round(prog*100)}%)...`;
                        }
                    }
                };
                console.log(`[Core Preview GIF] Generating ${previewFrameCount} preview frames.`);
                const frames = await generateAnimationFrames(frameOptions);

                if (!frames || frames.length === 0) {
                    throw new Error("Failed to generate animation frames for preview");
                }
                result.blob = frames[0]; // Use first frame blob as the primary blob result
                result.frames = frames; // Include all generated preview frames
                console.log(`[Core Preview GIF] Generated ${frames.length} frames.`);

                 // Convert first frame to Data URL for display
                 result.dataUrl = await blobToDataURL(frames[0]);


            } else {
                // For SVG or PNG, generate the base SVG first
                const svgOptions = {
                    width: options.width || 400,
                    height: options.height || 300,
                    transparentBackground: options.transparentBackground || false
                };
                 console.log("[Core Preview Static] Generating base SVG...");
                const svgBlob = await generateSVGBlob(svgOptions);

                if (exportType === 'png') {
                    console.log("[Core Preview PNG] Converting SVG to PNG...");
                     // Convert SVG to PNG
                    result.blob = await convertSVGtoPNG(svgBlob, {
                        width: svgOptions.width,
                        height: svgOptions.height,
                        quality: options.quality || 0.95, // Use specified quality for PNG preview
                        transparentBackground: svgOptions.transparentBackground
                    });
                     console.log("[Core Preview PNG] Conversion complete.");
                } else {
                    // For SVG preview, the blob is just the SVG itself
                    result.blob = svgBlob;
                     console.log("[Core Preview SVG] Using generated SVG blob.");
                }
                 // Generate Data URL for display
                 result.dataUrl = await blobToDataURL(result.blob);
            }

            // --- Update UI ---
            if (previewImg && result.dataUrl) {
                 previewImg.onload = () => { // Set onload before src
                     console.log(`[Core Preview] ${exportType.toUpperCase()} preview image loaded successfully.`);
                     if (loadingElement) loadingElement.style.display = 'none'; // Hide loading AFTER image loads
                     previewImg.style.display = 'block';
                     previewImg.alt = `${exportType.toUpperCase()} Export Preview`;
                 };
                 previewImg.onerror = () => {
                     console.error(`[Core Preview] Failed to load ${exportType.toUpperCase()} preview image from data URL.`);
                     if (loadingElement) loadingElement.style.display = 'none';
                     previewImg.style.display = 'block';
                     previewImg.alt = `${exportType.toUpperCase()} Preview Failed`;
                     // Optionally set a fallback error image src here
                 };
                 previewImg.src = result.dataUrl;
            } else {
                 if (loadingElement) loadingElement.style.display = 'none'; // Hide loading if no image element
                 if (!result.dataUrl) console.warn("[Core Preview] No data URL generated for preview.");
            }

            resolve(result); // Resolve with blob(s) and dataUrl

        } catch (error) {
            console.error(`[Core Preview] Error generating ${exportType} preview:`, error);
            if (loadingElement) {
                 loadingElement.style.display = 'flex'; // Keep loading shown but update text
                 const progressTextEl = loadingElement.querySelector('.progress-text') || loadingElement;
                 progressTextEl.textContent = "Preview Failed!";
            }
            if (previewImg) {
                 previewImg.style.display = 'none'; // Hide potentially broken image
                 previewImg.alt = "Preview Failed";
            }
            reject(error); // Reject the promise
        }
    });
}

console.log("[RendererCore] Module loaded (v2).");