/**
 * captureTextStyles.js (v17.8 - Refactored Alignment, Fixed xPos Error)
 * ===================================================================
 * Captures computed styles and settings for rendering engines.
 * Uses styleExtractionUtils helpers and fontManager for hybrid SVG embedding.
 * RELIES ON RendererCore.js (or similar) TO USE CAPTURED textAnchor
 * TO DETERMINE x/y/dominant-baseline DURING SVG STRING GENERATION.
 */

// Imports (Ensure paths are correct)
import SettingsManager from './settingsManager.js'; // Correctly imported
import { getFontDataAsync } from './fontManager.js'; // Assuming getFontDataByName is not needed here
import { extractSVGAnimationDetails } from './utils/svgAnimationInfo.js'; // Assuming getAnimationKeyframes isn't directly needed here
import {
    extractGradientColors, extractGradientAngle, detectBorderStyle,
    getCSSVariable, getBorderRadiusCSSValue, getEffectDetails,
    getTransformedTextContent, getPrimaryFontFamily, // Using specific imports
    normalizeColor, // Assuming normalizeColor is also exported from utils now for consistency
    // Make sure normalizeCSSTransformForSVG and escapeSVGAttribute are available if used later
} from './utils/styleExtractionUtils.js';

// Helper delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Attempts to retrieve the Base64 dataUrl for embedding fonts.
 * Uses getFontDataAsync to ensure font data (including dataUrl) is loaded.
 * @param {string} fontFamily - The primary font family name.
 * @param {string|number} fontWeight - The desired font weight.
 * @param {string} fontStyle - The desired font style ('normal', 'italic').
 * @returns {Promise<string|null>} The Base64 dataUrl or null.
 */
async function getFontEmbedData(fontFamily, fontWeight, fontStyle) {
    console.log(`[Font Embed v1.2] Searching for: Family='${fontFamily}', Weight=${fontWeight}, Style=${fontStyle}`);
    if (!fontFamily) {
        console.warn("[Font Embed v1.2] No font family provided.");
        return null;
    }

    let embedDataUrl = null;
    try {
        // Use getFontDataAsync to ensure chunk is loaded (contains url+dataUrl)
        const fontData = await getFontDataAsync(fontFamily);

        if (fontData?.variants) {
            const targetWeight = String(fontWeight);
            const targetStyle = fontStyle || 'normal';
            const targetVariant = fontData.variants.find(v => v && String(v.weight) === targetWeight && v.style === targetStyle);

            if (targetVariant) {
                // Look specifically for dataUrl property
                if (targetVariant.dataUrl && typeof targetVariant.dataUrl === 'string' && targetVariant.dataUrl.startsWith('data:')) {
                    console.log(`[Font Embed v1.2] SUCCESS: Found dataUrl for variant ${targetVariant.name}.`);
                    embedDataUrl = targetVariant.dataUrl;
                } else {
                    console.warn(`[Font Embed v1.2] Variant ${targetVariant.name} found, but it has no valid 'dataUrl' property.`);
                    // Optionally: Trigger loading if only URL is present and embedding is critical? Requires fontManager changes.
                }
            } else {
                console.warn(`[Font Embed v1.2] Could not find matching variant for W=${targetWeight}, S=${targetStyle} in '${fontFamily}'. Available:`, fontData.variants.map(v => `W:${v.weight}/S:${v.style}`));
            }
        } else {
            console.warn(`[Font Embed v1.2] No font data or variants returned from getFontDataAsync for '${fontFamily}'.`);
        }
    } catch (error) {
        console.error(`[Font Embed v1.2] Error retrieving/processing font data for '${fontFamily}':`, error);
    }

    if (!embedDataUrl) {
        console.warn(`[Font Embed v1.2] No embeddable dataUrl found for '${fontFamily}' (W: ${fontWeight}, S: ${fontStyle}). SVG may rely on system fonts or @font-face loading.`);
    }
    return embedDataUrl;
}

/**
 * Determines text alignment properties based on computed styles and settings.
 * This function NO LONGER calculates xPos/yPos or builds SVG elements.
 * It provides the necessary 'text-anchor' for the SVG rendering engine.
 *
 * @param {CSSStyleDeclaration} textStyle - Computed style of the text element.
 * @param {CSSStyleDeclaration} containerStyle - Computed style of the container element.
 * @param {object} currentSettings - The current application settings object.
 * @returns {{textAlign: string, textAnchor: string}} Object with CSS textAlign and SVG textAnchor.
 */
function captureTextAlignmentProperties(textStyle, containerStyle, currentSettings) {
    // Prefer text-align from settings if available, otherwise check computed text style
    const textAlignSetting = currentSettings?.textAlign; // e.g., 'left', 'center', 'right' from settings
    const computedTextStyleAlign = textStyle?.textAlign; // e.g., 'start', 'center', 'end' computed

    // Fallback: Check container's flex alignment if text-align isn't explicit
    const justifyContent = containerStyle?.justifyContent; // e.g., 'flex-start', 'center', 'flex-end'

    let finalCssTextAlign = 'center'; // Default

    if (textAlignSetting && ['left', 'center', 'right'].includes(textAlignSetting)) {
        finalCssTextAlign = textAlignSetting;
        console.log(`[Alignment Capture] Using textAlign from Setting: '${finalCssTextAlign}'`);
    } else if (computedTextStyleAlign && ['left', 'center', 'right', 'start', 'end'].includes(computedTextStyleAlign)) {
        // Map CSS computed values ('start'/'end') to standard names
        finalCssTextAlign = computedTextStyleAlign === 'start' ? 'left' : computedTextStyleAlign === 'end' ? 'right' : computedTextStyleAlign;
        console.log(`[Alignment Capture] Using computed textStyle.textAlign: '${finalCssTextAlign}' (Original: ${computedTextStyleAlign})`);
    } else if (justifyContent) {
        // Infer from container alignment as a last resort
        if (justifyContent === 'flex-start' || justifyContent === 'start') {
            finalCssTextAlign = 'left';
        } else if (justifyContent === 'flex-end' || justifyContent === 'end') {
            finalCssTextAlign = 'right';
        } else {
            finalCssTextAlign = 'center'; // Default for 'center', 'space-around', etc.
        }
        console.log(`[Alignment Capture] Inferring textAlign from container justifyContent ('${justifyContent}'): '${finalCssTextAlign}'`);
    } else {
        console.log(`[Alignment Capture] Using default textAlign: '${finalCssTextAlign}'`);
    }


    // Map the determined CSS text-align value to the corresponding SVG text-anchor
    let textAnchor;
    switch (finalCssTextAlign) {
        case 'left':
            textAnchor = 'start';
            break;
        case 'right':
            textAnchor = 'end';
            break;
        case 'center':
        default:
            textAnchor = 'middle';
            break;
    }

    console.log(`[Alignment Capture] Determined CSS textAlign: '${finalCssTextAlign}', SVG textAnchor: '${textAnchor}'`);

    // Return the relevant properties for the styles object
    return {
        textAlign: finalCssTextAlign, // Store the CSS equivalent ('left', 'center', 'right')
        textAnchor: textAnchor      // Store the SVG equivalent ('start', 'middle', 'end')
    };
}


/**
 * Main function to capture styles.
 * FIXED: Refactored alignment capture. Uses imported SettingsManager.
 * @param {HTMLElement} [targetElement=null] - Optional specific element (currently unused).
 * @param {object} [options={}] - Optional configuration options (currently unused).
 * @returns {Promise<object|null>} A promise resolving to the captured styles object or null on critical error.
 */
export async function captureAdvancedStyles(targetElement = null, options = {}) {
    console.log(`[Style Capture v17.8 - Refactored Alignment] STARTING CAPTURE at ${new Date().toISOString()}...`);

    // 1. Critical Dependency Checks
    if (typeof SettingsManager?.getCurrentSettings !== 'function') { console.error("[Style Capture] CRITICAL: SettingsManager.getCurrentSettings is not available!"); return null; }
    if (typeof normalizeColor !== 'function') { console.error("[Style Capture] CRITICAL: normalizeColor function (from styleExtractionUtils) not found!"); return null; }
    if (typeof getFontDataAsync !== 'function') { console.warn("[Style Capture] Non-critical: getFontDataAsync not found. Font embedding may fail."); }
    if (typeof extractSVGAnimationDetails !== 'function') { console.warn("[Style Capture] Non-critical: extractSVGAnimationDetails not found. SVG Animations may not be captured."); }
    // Check other imported utils implicitly by trying to use them later

    // 2. Wait for Fonts (Best effort)
    try {
        await document.fonts.ready;
        await delay(50); // Extra small delay after fonts ready
        console.log("[Style Capture] Document fonts reported ready.");
    } catch (fontError) {
        console.warn("[Style Capture] Error waiting for document.fonts.ready, proceeding anyway:", fontError);
    }

    // 3. Get DOM Elements & Validate
    const previewContainer = document.getElementById('previewContainer'); // Used for background/padding
    const logoContainer = document.querySelector('.logo-container');     // Used for border, dimensions, maybe background fallback
    const logoText = document.querySelector('.logo-text');             // Primary target for text styles

    if (!logoText) { console.error("[Style Capture] CRITICAL ERROR: '.logo-text' element not found!"); return null; }
    if (!logoContainer) { console.warn("[Style Capture] WARNING: '.logo-container' not found. Dimensions, border, and some fallbacks may be inaccurate."); }
    if (!previewContainer) { console.warn("[Style Capture] WARNING: '#previewContainer' not found. Background styles might default to logoContainer."); }
    console.log("[Style Capture] Required DOM elements located (logoText found).");

    // 4. Get SettingsManager State
    let currentSettings = {};
    try {
        currentSettings = SettingsManager.getCurrentSettings();
        if (!currentSettings) {
            console.warn("[Style Capture] SettingsManager.getCurrentSettings() returned null/undefined. Using empty settings.");
            currentSettings = {};
        } else {
            console.log("[Style Capture] Successfully retrieved current settings.");
        }
    } catch (e) {
        console.error("[Style Capture] CRITICAL: Error calling SettingsManager.getCurrentSettings():", e);
        return null;
    }

    // --- Initialize styles object ONCE ---
    // Default values should represent a basic, non-styled state.
    const styles = {
        captureVersion: '17.8 Refactored Alignment', timestamp: new Date().toISOString(),
        originalDimensions: { width: 0, height: 0, aspectRatio: 1 }, // Captured from logoContainer
        containerOpacity: '1', // Default, may be overridden by background capture
        exportConfig: {}, // Populated from settings
        textContent: { finalText: 'Logo', transform: 'none', transformedText: 'Logo' },
        font: { family: 'sans-serif', size: '100px', weight: '400', style: 'normal', letterSpacing: 'normal', embedDataUrl: null },
        color: { mode: 'solid', value: '#000000', gradient: null }, // Default to black
        opacity: '1', // Text opacity
        textAlign: 'center', // CSS Alignment
        textAnchor: 'middle', // SVG Alignment Anchor (determined by captureTextAlignmentProperties)
        background: { type: 'bg-transparent', color: 'transparent', opacity: '1', classList: [], patternClass: null, gradient: null, image: null, size: 'cover', position: 'center', repeat: 'no-repeat' }, // Default transparent bg
        previewPadding: '0px', // Padding of the main preview area
        border: null, // Border of logoContainer
        borderRadius: '0px', // Border radius of logoContainer
        borderPadding: '0px', // Padding of logoContainer (used for inner spacing with border)
        textStroke: null,
        textDecorations: [], // e.g., ['text-decoration-underline']
        textStyleClass: null, // e.g., 'text-style-outline'
        textEffect: null, // Shadow/glow details
        transform: null, // CSS transform on logoText
        animation: null // Animation details for logoText
    };

    // 5. Force Reflow (Minimal attempt)
    try { const _unused = logoText.offsetHeight; } catch (e) { /* ignore error if element not found/visible */ }

    // 6. Get Computed Styles (Safely)
    let textStyle = {}, containerStyle = {}, previewContainerStyle = {}, rootStyle = {};
    try {
        textStyle = window.getComputedStyle(logoText);
        if (logoContainer) { containerStyle = window.getComputedStyle(logoContainer); }
        if (previewContainer) { previewContainerStyle = window.getComputedStyle(previewContainer); }
        rootStyle = window.getComputedStyle(document.documentElement); // For CSS variables
        console.log('[Style Capture] Computed styles obtained.');
    } catch (e) {
        console.error("[Style Capture] CRITICAL: Error getting computed styles:", e);
        // If we can't get computed styles, we can't proceed reliably
        return null;
    }

    // 7. Get Container Dimensions & Update Styles Object
    if (logoContainer) {
        try {
            const rect = logoContainer.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
                styles.originalDimensions.width = rect.width;
                styles.originalDimensions.height = rect.height;
                styles.originalDimensions.aspectRatio = rect.width / rect.height;
                 console.log(`[Style Capture] logoContainer dimensions: ${styles.originalDimensions.width.toFixed(2)}x${styles.originalDimensions.height.toFixed(2)}`);
            } else {
                console.warn(`[Style Capture] logoContainer has zero or invalid dimensions (${rect?.width}x${rect?.height}).`);
                // Fallback or indicate error? For now, defaults remain 0.
            }
        } catch (e) {
            console.error("[Style Capture] Error getting logoContainer dimensions:", e);
        }
    } else {
        console.warn("[Style Capture] Cannot capture dimensions, logoContainer not found.");
    }


    // --- 9. Populate `styles` Object ---

    // 9a. Export Config (from settings)
    try {
        styles.exportConfig = {
            width: parseInt(currentSettings.exportWidth || '800', 10),
            height: parseInt(currentSettings.exportHeight || '400', 10),
            transparent: !!currentSettings.exportTransparent
        };
    } catch (e) { console.error("Error parsing export config settings:", e); }

    // 9b. Text Content (from settings or element, transformed)
    try {
        styles.textContent.finalText = currentSettings.logoText ?? logoText.textContent ?? 'Logo';
        styles.textContent.transform = textStyle?.textTransform || 'none';
        styles.textContent.transformedText = getTransformedTextContent(logoText, styles.textContent.transform); // Use imported helper
    } catch (e) { console.error("Error capturing text content:", e); }


    // 9c. Font Details (from settings or computed, CSS vars checked)
    try {
        styles.font.family = currentSettings.fontFamily || getPrimaryFontFamily(textStyle?.fontFamily) || 'sans-serif'; // Use imported helper
        styles.font.size = currentSettings.fontSize ? `${currentSettings.fontSize}px` : (textStyle?.fontSize || '100px');
        styles.font.weight = String(currentSettings.fontWeight || textStyle?.fontWeight || '400');
        styles.font.style = currentSettings.textStyle?.includes('italic') ? 'italic' : 'normal'; // Check setting first
        let lsVal = currentSettings.letterSpacing;
        if (typeof lsVal === 'number') lsVal = `${lsVal}em`; // Assume number is 'em'
        // Prefer setting, then CSS var, then computed style
        styles.font.letterSpacing = lsVal ?? getCSSVariable('--dynamic-letter-spacing', logoText) ?? textStyle?.letterSpacing ?? 'normal'; // Use imported helper

        console.log(`[Style Capture] Font: Family='${styles.font.family}', Size=${styles.font.size}, Weight=${styles.font.weight}, Style=${styles.font.style}, Spacing=${styles.font.letterSpacing}`);

        // Attempt font embedding (async)
        styles.font.embedDataUrl = await getFontEmbedData(styles.font.family, styles.font.weight, styles.font.style);
        console.log(`[Style Capture] Font Embed dataUrl Retrieved: ${!!styles.font.embedDataUrl}`);

    } catch (e) { console.error("Error capturing font details:", e); }


    // 9d. Text Color & Opacity (handles solid/gradient)
    try {
        styles.opacity = String(currentSettings.textOpacity ?? textStyle?.opacity ?? '1');
        styles.color.mode = currentSettings.textColorMode === 'gradient' ? 'gradient' : 'solid';

        if (styles.color.mode === 'gradient') {
            const gradCols = extractGradientColors(logoText, true, textStyle); // true = text gradient
            const gradAngle = extractGradientAngle(textStyle?.backgroundImage, true); // true = text gradient
            styles.color.value = null; // No single value for gradient
            styles.color.gradient = {
                preset: currentSettings.gradientPreset || null, // Store preset name if available
                colors: gradCols,
                angle: gradAngle
            };
             console.log(`[Style Capture] Text Color Mode: Gradient (Angle: ${gradAngle}, Colors: ${JSON.stringify(gradCols)})`);
        } else {
            // Use setting color picker first, fallback to computed text color
            const rawColor = currentSettings.solidColorPicker || textStyle?.color || '#000000';
            styles.color.value = normalizeColor(rawColor, 'text-solid'); // Normalize the chosen color
            styles.color.gradient = null;
            console.log(`[Style Capture] Text Color Mode: Solid (Raw: ${rawColor}, Normalized: ${styles.color.value})`);
        }
    } catch (e) { console.error("Error capturing text color/opacity:", e); }

    // 9e. Text Alignment (Uses refactored helper)
    try {
        const alignmentInfo = captureTextAlignmentProperties(textStyle, containerStyle, currentSettings);
        styles.textAlign = alignmentInfo.textAlign;
        styles.textAnchor = alignmentInfo.textAnchor;
        // xPos/yPos/dominantBaseline are NOT stored here, they are determined by the renderer using textAnchor.
        console.log(`[Style Capture] Captured Alignment: textAlign='${styles.textAlign}', textAnchor='${styles.textAnchor}'`);
    } catch(e) {
        console.error("Error capturing text alignment:", e);
        // Keep defaults if error occurs
        styles.textAlign = 'center';
        styles.textAnchor = 'middle';
    }


    // 9f. Background (uses previewContainer primarily, falls back to logoContainer)
    try {
        const bgElement = previewContainer || logoContainer; // Prefer previewContainer for background styles
        const bgStyle = previewContainer ? previewContainerStyle : containerStyle;
        styles.previewPadding = previewContainerStyle?.padding || containerStyle?.padding || '0px'; // Use padding from the element providing the background

        // Determine background type from settings or element classes/styles
        styles.background.type = currentSettings.backgroundType || 'bg-solid'; // Default or from setting
         // TODO: Maybe add detection logic based on bgStyle if setting is absent?
         // Example: if (bgStyle?.backgroundImage && bgStyle.backgroundImage !== 'none') type = 'bg-image' or 'bg-gradient'?

        styles.background.opacity = String(currentSettings.bgOpacity ?? bgStyle?.opacity ?? '1');
        styles.background.classList = bgElement ? Array.from(bgElement.classList) : [];
        styles.background.patternClass = styles.background.classList.find(cls => cls.startsWith('bg-pattern-')) || null;
        styles.background.size = bgStyle?.backgroundSize || 'cover';
        styles.background.position = bgStyle?.backgroundPosition || 'center';
        styles.background.repeat = bgStyle?.backgroundRepeat || 'no-repeat';

        if (styles.background.type === 'bg-transparent') {
            styles.background.color = 'transparent';
            styles.background.gradient = null; styles.background.image = null;
        } else if (styles.background.type.includes('gradient')) {
            const bgGradCols = extractGradientColors(bgElement, false, bgStyle); // false = background gradient
            const bgGradAngle = extractGradientAngle(bgStyle?.backgroundImage, false); // false = background gradient
            styles.background.color = null; // Gradients don't have a single solid color
            styles.background.gradient = { preset: currentSettings.backgroundGradientPreset || null, colors: bgGradCols, angle: bgGradAngle };
            styles.background.image = null;
             console.log(`[Style Capture] Background: Gradient (Angle: ${bgGradAngle}, Colors: ${JSON.stringify(bgGradCols)})`);
        } else if (styles.background.type === 'bg-image') {
            // Capture background color underneath image, if any
            styles.background.color = normalizeColor(bgStyle?.backgroundColor || 'transparent', 'bg-image-fallback');
            styles.background.gradient = null;
            styles.background.image = bgStyle?.backgroundImage || null; // Capture the URL/gradient string
             console.log(`[Style Capture] Background: Image (${styles.background.image}), Fallback Color: ${styles.background.color}`);
        } else { // Default to solid
            styles.background.type = 'bg-solid';
            // Use setting first, then computed background color
            const rawBgColor = currentSettings.backgroundColor || bgStyle?.backgroundColor || 'transparent';
            styles.background.color = normalizeColor(rawBgColor, 'bg-solid');
            styles.background.gradient = null; styles.background.image = null;
            console.log(`[Style Capture] Background: Solid (Raw: ${rawBgColor}, Normalized: ${styles.background.color})`);
        }
         // Capture overall container opacity if needed (might affect background rendering)
        styles.containerOpacity = String(bgStyle?.opacity ?? '1');

    } catch (e) { console.error("Error capturing background styles:", e); }


    // 9g. Border (of logoContainer, uses helper)
    try {
        if (logoContainer) {
            styles.border = detectBorderStyle(logoContainer, containerStyle, currentSettings);
            // Override color/width from settings if provided
            if (styles.border) {
                if (currentSettings.borderColorPicker) {
                    styles.border.color = normalizeColor(currentSettings.borderColorPicker, 'border');
                }
                if (currentSettings.borderWidth) {
                    styles.border.width = `${currentSettings.borderWidth}px`;
                }
                 console.log(`[Style Capture] Border: Style=${styles.border.style}, Width=${styles.border.width}, Color=${styles.border.color}`);
            } else { console.log("[Style Capture] Border: None detected.");}
        }
    } catch (e) { console.error("Error capturing border styles:", e); }

    // 9h. Border Radius & Padding (of logoContainer)
    try {
        styles.borderRadius = getBorderRadiusCSSValue(currentSettings.borderRadius, currentSettings.customBorderRadius);
        // Use padding from settings if available, otherwise computed container padding
        styles.borderPadding = currentSettings.borderPadding ? `${currentSettings.borderPadding}px` : (containerStyle?.padding || '0px');
        console.log(`[Style Capture] BorderRadius: ${styles.borderRadius}, BorderPadding: ${styles.borderPadding}`);
    } catch (e) { console.error("Error capturing border radius/padding:", e); }


    // 9i. Text Stroke (from settings)
    try {
        const strokeSetting = currentSettings.textStroke || 'none';
        if (strokeSetting !== 'none') {
            const strokeWidthMap = {'thin': '1px', 'medium': '2px', 'thick': '3px'};
            const strokeColorSetting = currentSettings.strokeColor; // Assumes a color picker setting exists
            let strokeW = strokeWidthMap[strokeSetting] || '1px'; // Default to thin if setting value is unexpected
            // Determine stroke color based on setting type (contrast or specific color)
             // TODO: Refine contrast color logic if needed (e.g., check background brightness)
            let rawStrokeColor = strokeSetting === 'contrast' ? '#000000' : (strokeColorSetting || '#cccccc'); // Fallback for contrast/specific color
            let strokeC = normalizeColor(rawStrokeColor, 'text-stroke');

            styles.textStroke = { style: strokeSetting, width: strokeW, color: strokeC };
            console.log(`[Style Capture] Text Stroke: Style=${strokeSetting}, Width=${strokeW}, Color=${strokeC}`);
        } else {
            styles.textStroke = null;
        }
    } catch (e) { console.error("Error capturing text stroke:", e); }


    // 9j. Text Decorations & Style Class (from element classes)
    try {
        styles.textDecorations = Array.from(logoText.classList).filter(cls => cls.startsWith('text-decoration-') && cls !== 'text-decoration-none');
        styles.textStyleClass = Array.from(logoText.classList).find(cls => cls.startsWith('text-style-')) || null; // e.g., text-style-outline
    } catch (e) { console.error("Error capturing text decorations/style class:", e); }


    // 9k. Text Effect (Shadow/Glow, from settings or computed)
    try {
        // Use setting value first, fallback to computed text-shadow
        const effectSetting = currentSettings.textShadow || currentSettings.advanced3dEffect || 'none';
        const effectColorSetting = currentSettings.effectColor; // Assumes color picker setting
        styles.textEffect = getEffectDetails(effectSetting, textStyle?.textShadow, effectColorSetting);
        if(styles.textEffect) {console.log(`[Style Capture] Text Effect: Type=${styles.textEffect.type}, Color=${styles.textEffect.color}, CSS=${styles.textEffect.cssValue}`);}

    } catch (e) { console.error("Error capturing text effect:", e); }


    // 9l. CSS Transform (on logoText, prefers settings rotation)
    try {
        const transformComputed = textStyle?.transform;
        const rotationSetting = currentSettings.rotation ? parseFloat(currentSettings.rotation) : 0;

        if (rotationSetting !== 0) {
            // If rotation setting exists, use it primarily
            styles.transform = {
                cssValue: `rotate(${rotationSetting}deg)`, // Construct basic rotate
                rotation: `${rotationSetting}deg`
                // Note: This overrides other computed transforms like scale/skew if only rotation is set.
            };
             console.log(`[Style Capture] Transform: Using Rotation Setting (${styles.transform.rotation})`);
        } else if (transformComputed && transformComputed !== 'none') {
            // If no rotation setting, use the computed transform
            styles.transform = {
                cssValue: transformComputed,
                rotation: null // Rotation wasn't set via setting
            };
            console.log(`[Style Capture] Transform: Using Computed Value (${styles.transform.cssValue})`);
        } else {
            styles.transform = null; // No transform
        }
    } catch (e) { console.error("Error capturing transform:", e); }


    // 9m. Animation (from logoText, uses helper)
    try {
        styles.animation = extractSVGAnimationDetails(logoText); // Use imported helper
        if(styles.animation) { console.log(`[Style Capture] Animation: Class=${styles.animation.class}, Duration=${styles.animation.duration}, Delay=${styles.animation.delay}`); }
    } catch (e) { console.error("Error capturing animation:", e); }


    // --- FINAL LOGS ---
    console.log("-------------------------------------------");
    console.log("[Style Capture] FINAL CAPTURED STYLES OBJECT:");
    console.log(JSON.stringify(styles, null, 2)); // Log the full object for debugging
    console.log("-------------------------------------------");
    console.log(`[Style Capture v17.8 - Refactored Alignment] CAPTURE COMPLETE at ${new Date().toISOString()}.`);

    return styles;
}