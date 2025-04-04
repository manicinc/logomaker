/**
 * captureTextStyles.js - v14 (Combined & Enhanced)
 * Captures computed styles and relevant settings from the preview container.
 * Includes detailed logging and improved handling for gradients, effects, borders, and animations.
 */

console.log("[CaptureStyles] Module loaded.");

/**
 * Main function to capture all computed styles from the logo elements.
 * Enhanced with detailed logging to track style capture flow.
 * @returns {object|null} Complete style object or null on critical failure.
 */
export function captureAdvancedStyles() {
    console.log("[Style Capture] ========== STARTING STYLE CAPTURE (v14) ==========");

    // Find the necessary DOM elements
    const logoContainer = document.querySelector('.logo-container');
    const logoText = document.querySelector('.logo-text');
    const previewContainer = document.getElementById('previewContainer'); // Needed for BG checks

    if (!logoContainer || !logoText) {
        console.error("[Style Capture] CRITICAL ERROR: Failed to find logo elements in DOM");
        console.error("  - logoContainer found:", !!logoContainer);
        console.error("  - logoText found:", !!logoText);
        return null;
    }
    if (!previewContainer) {
        console.warn("[Style Capture] WARNING: Preview container '#previewContainer' not found. Background capture might be incomplete.");
    }
    console.log("[Style Capture] Found elements: logoContainer, logoText", previewContainer ? '& previewContainer' : '(previewContainer NOT found)');

    // Get computed styles
    const containerStyle = window.getComputedStyle(logoContainer);
    const textStyle = window.getComputedStyle(logoText);
    const previewContainerStyle = previewContainer ? window.getComputedStyle(previewContainer) : {}; // Use empty object if not found

    // Debug: Log key computed styles for verification
    console.log("[Style Capture] Computed text styles sample:", {
        fontFamily: textStyle.fontFamily,
        fontSize: textStyle.fontSize,
        fontWeight: textStyle.fontWeight,
        fontStyle: textStyle.fontStyle,
        color: textStyle.color,
        textShadow: textStyle.textShadow,
        transform: textStyle.transform,
        backgroundImage: textStyle.backgroundImage,
        backgroundClip: textStyle.backgroundClip,
        webkitBackgroundClip: textStyle.webkitBackgroundClip,
        letterSpacing: textStyle.letterSpacing,
        textAlign: textStyle.textAlign,
        textTransform: textStyle.textTransform,
        animation: textStyle.animation,
        opacity: textStyle.opacity, // Added text opacity
        border: textStyle.border, // Check computed border too
        textStroke: textStyle.textStroke || textStyle.webkitTextStroke, // Check text stroke
    });

    console.log("[Style Capture] Computed logoContainer styles sample:", {
        borderStyle: containerStyle.borderStyle,
        borderWidth: containerStyle.borderWidth,
        borderColor: containerStyle.borderColor,
        borderRadius: containerStyle.borderRadius,
        boxShadow: containerStyle.boxShadow,
    });
    if (previewContainer) {
        console.log("[Style Capture] Computed previewContainer styles sample:", {
            backgroundColor: previewContainerStyle.backgroundColor,
            backgroundImage: previewContainerStyle.backgroundImage,
            backgroundSize: previewContainerStyle.backgroundSize,
            backgroundRepeat: previewContainerStyle.backgroundRepeat,
            backgroundPosition: previewContainerStyle.backgroundPosition,
            opacity: previewContainerStyle.opacity
        });
    }


    // Get current settings from Settings Manager if available
    const currentSettings = window.SettingsManager?.getCurrentSettings?.() || {};
    // Avoid logging potentially huge settings object fully
    console.log("[Style Capture] Current settings from SettingsManager (first few):",
        Object.entries(currentSettings).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(', ') + "..."
    );

    // Create result object
    const styles = {
        exportConfig: {
            width: parseInt(document.getElementById('exportWidth')?.value || currentSettings.exportWidth || '800'),
            height: parseInt(document.getElementById('exportHeight')?.value || currentSettings.exportHeight || '400'),
            transparent: document.getElementById('exportTransparent')?.checked || currentSettings.exportTransparent || false
        },
        textContent: {
            finalText: logoText.textContent || currentSettings.logoText || 'Logo'
        },
        font: {
            family: textStyle.fontFamily || 'sans-serif',
            size: textStyle.fontSize || '100px',
            weight: textStyle.fontWeight || '400',
            style: textStyle.fontStyle || 'normal',
            letterSpacing: textStyle.letterSpacing || 'normal'
        },
        color: {
            mode: 'solid' // Default, will check for gradient below
        },
        opacity: textStyle.opacity || '1' // Capture text opacity
    };

    console.log("[Style Capture] Base styles object initialized.");

    // Handle text alignment
    const textAlign = textStyle.textAlign.trim();
    if (textAlign) {
        // Map CSS text-align to SVG text-anchor
        if (textAlign === 'left') styles.textAnchor = 'start';
        else if (textAlign === 'right') styles.textAnchor = 'end';
        else styles.textAnchor = 'middle'; // Default/center

        styles.textAlign = textAlign;
        console.log(`[Style Capture] Text alignment: CSS=${textAlign}, SVG=${styles.textAnchor}`);
    } else {
        styles.textAnchor = 'middle'; // Default if not specified
         styles.textAlign = 'center';
         console.log(`[Style Capture] Text alignment not specified, defaulting to center/middle.`);
    }

    // Background styles - Use previewContainer for background capture
    // Use previewContainer if found, otherwise fallback gracefully or note absence
    const bgElement = previewContainer || logoContainer; // Prefer preview container for BG
    const bgStyle = previewContainer ? previewContainerStyle : containerStyle;
    const bgType = extractBackgroundType(bgElement);

    styles.background = {
        // Use the type detected from class or computed style
        type: bgType,
        // Get color from computed style of the chosen element
        color: bgStyle.backgroundColor || 'transparent',
        // Get opacity from computed style of the chosen element
        opacity: bgStyle.opacity || '1',
        // Store class list if relevant
        classList: []
    };
    if (bgElement.classList) {
         const bgClassList = Array.from(bgElement.classList)
             .filter(cls => cls.startsWith('bg-'));
         if (bgClassList.length > 0) {
             styles.background.classList = bgClassList;
         }
    }

    console.log(`[Style Capture] Background target element: ${previewContainer ? 'previewContainer' : 'logoContainer'}`);
    console.log(`[Style Capture] Background type detected: ${styles.background.type}`);
    console.log(`[Style Capture] Background color: ${styles.background.color}`);
    console.log(`[Style Capture] Background opacity: ${styles.background.opacity}`);
    if (styles.background.classList.length > 0) {
         console.log(`[Style Capture] Background classes: ${styles.background.classList.join(', ')}`);
    }


    // Check for gradient or image background on the chosen element
    if (bgStyle.backgroundImage && bgStyle.backgroundImage !== 'none') {
        console.log(`[Style Capture] Background image/gradient found: ${bgStyle.backgroundImage.substring(0,100)}...`);

        if (bgType === 'bg-gradient' || bgStyle.backgroundImage.includes('gradient')) { // Check type and computed style
            styles.background.gradient = {
                colors: extractGradientColors(bgElement), // Use helper
                direction: extractGradientAngle(bgStyle.backgroundImage) // Use helper
            };
            console.log(`[Style Capture] Gradient background detected: ${styles.background.gradient.colors.length} colors, ${styles.background.gradient.direction} direction`);
            console.log(`[Style Capture] Gradient colors: ${styles.background.gradient.colors.join(', ')}`);
        } else { // Assume image/pattern if not explicitly gradient
            styles.background.image = bgStyle.backgroundImage; // Could be url() or complex
            styles.background.size = bgStyle.backgroundSize || 'cover';
            styles.background.position = bgStyle.backgroundPosition || 'center';
            styles.background.repeat = bgStyle.backgroundRepeat || 'no-repeat';
            console.log(`[Style Capture] Background image/pattern detected: ${styles.background.image}, size: ${styles.background.size}`);
            styles.background.type = styles.background.type === 'bg-solid' ? 'bg-pattern' : styles.background.type; // Update type if needed
        }
    } else {
         console.log(`[Style Capture] No background image/gradient detected on computed style.`);
    }


    // Text Fill Style (Solid vs Gradient)
    if (textStyle.backgroundClip === 'text' || textStyle.webkitBackgroundClip === 'text') {
        styles.color.mode = 'gradient';
        styles.color.gradient = {
            colors: extractGradientColors(logoText), // Use helper
            direction: extractGradientAngle(textStyle.backgroundImage) // Use helper
        };
        // If colors array is empty, it means extraction failed, log warning
         if (!styles.color.gradient.colors || styles.color.gradient.colors.length === 0) {
            console.warn(`[Style Capture] Text gradient fill detected, but failed to extract colors! Review extractGradientColors logs.`);
         } else {
            console.log(`[Style Capture] Text gradient fill detected: ${styles.color.gradient.colors.length} colors, ${styles.color.gradient.direction} direction`);
            console.log(`[Style Capture] Text gradient colors: ${styles.color.gradient.colors.join(', ')}`);
         }
    } else {
        styles.color.value = textStyle.color; // Capture solid color
        console.log(`[Style Capture] Solid text color: ${styles.color.value}`);
    }

    // Text classes (for additional effects)
    if (logoText.classList) {
        const effectClassList = Array.from(logoText.classList);
        if (effectClassList.length > 0) {
            styles.textClassList = effectClassList;
            console.log(`[Style Capture] Text classes detected: ${effectClassList.join(', ')}`);
        }
    }

    // Border/Stroke styles (ENHANCED - Check Text Stroke first, then Container Border)
    // Prefer text-stroke if it exists
    const textStrokeWidth = textStyle.textStrokeWidth || textStyle.webkitTextStrokeWidth;
    const textStrokeColor = textStyle.textStrokeColor || textStyle.webkitTextStrokeColor;

    if (textStrokeWidth && parseFloat(textStrokeWidth) > 0 && textStrokeColor && textStrokeColor !== 'transparent') {
         styles.border = {
             style: 'solid', // text-stroke is always solid
             color: textStrokeColor,
             width: textStrokeWidth
         };
         console.log(`[Style Capture] Text stroke detected: width=${styles.border.width}, color=${styles.border.color}`);
         // Note: Text stroke might interact weirdly with effects, capture both if needed.
    } else {
        // If no text-stroke, check for border on container using enhanced detection
        // Use logoContainer specifically for border effects applied there
        const borderInfo = detectBorderStyle(logoContainer);

        if (borderInfo) {
            const rootStyle = getComputedStyle(document.documentElement);
            const dynamicBorderColor = rootStyle.getPropertyValue('--dynamic-border-color').trim();

            styles.border = {
                style: borderInfo.style,
                // Use dynamic color if available, else computed, else white fallback
                color: dynamicBorderColor || containerStyle.borderColor || '#ffffff',
                width: containerStyle.borderWidth || '1px' // Get width from container
            };

            // Add dasharray for dashed/dotted based on detected style and width
            const dashArray = getStrokeDasharray(borderInfo.style, styles.border.width);
            if (dashArray) styles.border.dasharray = dashArray;

            // Add glow flag if detected
            if (borderInfo.isGlow) {
                styles.border.isGlow = true;
                styles.border.glowColor = borderInfo.glowColor || styles.border.color; // Use detected glow color or border color
                 console.log(`[Style Capture] Glow effect detected via border class.`);
            }

            console.log(`[Style Capture] Border detected on logoContainer: style=${styles.border.style}, color=${styles.border.color}, width=${styles.border.width}${styles.border.dasharray ? ', dasharray=' + styles.border.dasharray : ''}${styles.border.isGlow ? ', with glow effect' : ''}`);

        } else if (containerStyle.borderStyle && containerStyle.borderStyle !== 'none' && parseFloat(containerStyle.borderWidth) > 0) {
             // Fallback to direct computed style if detectBorderStyle didn't find anything BUT a border exists
             styles.border = {
                 style: containerStyle.borderStyle,
                 color: containerStyle.borderColor || '#ffffff',
                 width: containerStyle.borderWidth
             };
             const dashArray = getStrokeDasharray(styles.border.style, styles.border.width);
            if (dashArray) styles.border.dasharray = dashArray;
             console.log(`[Style Capture] Border detected via computed style on logoContainer: ${styles.border.style}, color=${styles.border.color}, width=${styles.border.width}`);
        } else {
             console.log("[Style Capture] No text stroke or container border detected.");
        }
    }


    // Text effect detection (Text Shadow / Glow) - using helper
    const effectClass = Array.from(logoText.classList).find(c => c.startsWith('text-glow-') || c.startsWith('text-shadow-'));
    const rootStyle = getComputedStyle(document.documentElement);
    // Get effect color from variable OR fallback to border color if effect uses border color, else white
    const dynamicEffectColor = rootStyle.getPropertyValue('--dynamic-border-color').trim();
    const effectColorToUse = dynamicEffectColor || styles.border?.color || '#ffffff'; // Prioritize dynamic, then border, then fallback

    const effectDetails = getEffectDetails(effectClass, textStyle.textShadow, effectColorToUse);
    if (effectDetails) {
        styles.textEffect = effectDetails;
        console.log(`[Style Capture] Text effect detected: type=${effectDetails.type}, color=${effectDetails.color}, blur=${effectDetails.blur}, dx=${effectDetails.dx}, dy=${effectDetails.dy}, filterId=${effectDetails.filterId}`);
    } else {
        console.log("[Style Capture] No explicit text effect/shadow class or computable text-shadow found.");
    }


    // Transform (capture from text element)
    if (textStyle.transform && textStyle.transform !== 'none') {
        styles.transform = {
            cssValue: textStyle.transform
        };
        console.log(`[Style Capture] Transform detected: ${styles.transform.cssValue}`);
    } else {
        console.log(`[Style Capture] No transform detected.`);
    }

    // Animation - Capture from classList first, then check settings/computed
    const animClass = Array.from(logoText.classList).find(c => c.startsWith('anim-'));
    const activeAnimation = animClass || document.getElementById('textAnimation')?.value || 'anim-none'; // Prefer class

    if (activeAnimation && activeAnimation !== 'anim-none') {
        const animationName = activeAnimation.replace('anim-', '');
        // Ensure getRootCSSVariable helper exists and is used
        const animDuration = getRootCSSVariable('--animation-duration') || '2s';
        // Ensure parseAnimationDuration helper exists and is used
        const animationDurationMs = parseAnimationDuration(animDuration);

        styles.animation = {
            class: activeAnimation,
            type: animationName,
            duration: animDuration,
            durationMs: animationDurationMs,
            // Attempt to get more details from computed style if possible
            timingFunction: textStyle.animationTimingFunction || 'ease',
            iterationCount: textStyle.animationIterationCount || 'infinite',
            // Ensure extractKeyframesCSS helper exists and is used
            activeKeyframes: extractKeyframesCSS(animationName)
        };

        console.log(`[Style Capture] Animation detected: class=${activeAnimation}, type=${animationName}, duration=${animDuration} (${animationDurationMs}ms)`);
        console.log(`[Style Capture] Animation details: timing=${styles.animation.timingFunction}, count=${styles.animation.iterationCount}`);
        console.log(`[Style Capture] Animation keyframes: ${styles.animation.activeKeyframes ? 'Attempted to extract' : 'Failed to extract or no helper'}`);
        if (styles.animation.activeKeyframes) {
            console.log(`[Style Capture] Keyframes sample: ${styles.animation.activeKeyframes.substring(0, 200)}...`);
        }
    } else {
        console.log(`[Style Capture] No animation detected.`);
    }

    // Font embedding data - using helper
    const primaryFontName = getPrimaryFontFamily(styles.font.family); // Use helper
    // Ensure getFontEmbedData helper exists and is used
    styles.font.embedData = getFontEmbedData(
        primaryFontName,
        styles.font.weight,
        styles.font.style
    );
    console.log(`[Style Capture] Font embed data: ${styles.font.embedData ? 'Available' : 'Not available'} for font "${primaryFontName}" (weight: ${styles.font.weight}, style: ${styles.font.style})`);

    // Text transformation (uppercase, lowercase, capitalize)
    if (textStyle.textTransform && textStyle.textTransform !== 'none') {
        styles.textContent.transform = textStyle.textTransform;
        // Ensure getTransformedTextContent helper exists and is used
        styles.textContent.transformedText = getTransformedTextContent(
            logoText,
            textStyle.textTransform
        );
        console.log(`[Style Capture] Text transform: ${styles.textContent.transform}, transformed text preview: "${styles.textContent.transformedText.substring(0, 20)}${styles.textContent.transformedText.length > 20 ? '...' : ''}"`);
    } else {
         console.log(`[Style Capture] No text transform detected.`);
         styles.textContent.transformedText = styles.textContent.finalText; // Store non-transformed text
    }

    // Log the complete styles object for reference
    // Use try-catch for stringify in case of circular references (though unlikely here)
    try {
         console.log("[Style Capture] Complete styles object:", JSON.stringify(styles, null, 2));
    } catch(e) {
         console.error("[Style Capture] Error stringifying final styles object:", e);
         console.log("[Style Capture] Final styles object (raw):", styles);
    }
    console.log("[Style Capture] ========== STYLE CAPTURE COMPLETE (v14) ==========");

    return styles;
}


// --- HELPER FUNCTIONS (Combined & Refined from v12/v13) ---

/**
 * Get CSS variable from root element
 * @param {string} varName - CSS variable name (e.g., '--my-variable')
 * @returns {string} Variable value or empty string if not found.
 */
function getRootCSSVariable(varName) {
    if (!varName || typeof document === 'undefined') return '';
    try {
        // Ensure document.documentElement exists
        const root = document.documentElement;
        if (!root) return '';
        const rootStyle = window.getComputedStyle(root);
        return rootStyle.getPropertyValue(varName).trim();
    } catch (e) {
        console.error(`[CaptureStyles] Error getting root CSS variable ${varName}:`, e);
        return '';
    }
}


/**
 * Parse animation duration into milliseconds
 * @param {string} duration - Duration string with units (e.g., "2s", "500ms")
 * @returns {number} Duration in milliseconds, or 0 if invalid.
 */
function parseAnimationDuration(duration) {
    if (!duration || typeof duration !== 'string') return 0;
    const trimmedDuration = duration.trim();
    const value = parseFloat(trimmedDuration);
    if (isNaN(value)) return 0;

    if (trimmedDuration.endsWith('ms')) {
        return value;
    } else if (trimmedDuration.endsWith('s')) {
        return value * 1000;
    }
    // Default to seconds if no unit specified (CSS default behavior)
    return value * 1000;
}

/**
 * Helper: Get the primary font family name, removing quotes and handling fallbacks.
 * @param {string} fontFamilyString - The CSS font-family string.
 * @returns {string} The primary font family name or 'sans-serif'.
 */
function getPrimaryFontFamily(fontFamilyString) {
    if (!fontFamilyString || typeof fontFamilyString !== 'string') return 'sans-serif';
    // Split by comma, take the first part, trim whitespace, remove surrounding quotes
    const primary = fontFamilyString.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    // Return the primary font or 'sans-serif' if empty/invalid
    return primary || 'sans-serif';
}

/**
 * Helper: Apply text transformation based on CSS style.
 * @param {HTMLElement} element - The text element.
 * @param {string} transformStyle - The text-transform CSS value ('uppercase', 'lowercase', 'capitalize').
 * @returns {string} The transformed text content.
 */
function getTransformedTextContent(element, transformStyle) {
    const txt = element?.textContent || '';
    if (!txt) return '';
    switch (transformStyle?.toLowerCase()) {
        case 'uppercase': return txt.toUpperCase();
        case 'lowercase': return txt.toLowerCase();
        case 'capitalize':
            // Basic capitalization, might not handle all locales perfectly
            return txt.replace(/\b\w/g, char => char.toUpperCase());
        default: return txt; // 'none' or unrecognized
    }
}

/**
 * Helper: Get SVG stroke-dasharray string based on border style and width.
 * Converts CSS dashed/dotted to SVG representation.
 * @param {string} borderStyle - The CSS border-style value (e.g., 'dashed', 'dotted').
 * @param {string|number} borderWidth - The CSS border-width value (e.g., '2px').
 * @returns {string | null} The dasharray string (e.g., "6, 4") or null for solid/unsupported styles.
 */
function getStrokeDasharray(borderStyle, borderWidth) {
    if (!borderStyle || borderStyle === 'none' || borderStyle === 'hidden') return null;

    const w = parseFloat(borderWidth) || 1; // Default to 1px if parsing fails

    switch (borderStyle.toLowerCase()) {
        case 'dashed':
            // Common representation: dash length slightly longer than gap
            return `${Math.max(1, Math.round(w * 2))}, ${Math.max(1, Math.round(w * 1.5))}`; // Adjusted for better visual
        case 'dotted':
            // Dot is small (like width), gap is larger
             return `${Math.max(1, Math.round(w))}, ${Math.max(1, Math.round(w * 1.5))}`; // Adjusted for better visual
        // These complex styles can't be directly represented as SVG stroke-dasharray
        case 'double':
        case 'groove':
        case 'ridge':
        case 'inset':
        case 'outset':
            console.log(`[CaptureStyles] Complex border style '${borderStyle}' detected. SVG will use solid stroke (no dasharray).`);
            return null; // Use solid stroke as fallback
        default: // Includes 'solid' or unrecognized
            return null;
    }
}


/**
 * Enhanced border style detection - looks at classList first, then computed style.
 * Handles specific classes like 'border-glow'.
 * @param {HTMLElement} element - The container element to check (usually logoContainer).
 * @returns {object|null} Object with { style, isGlow?, glowColor? } or null if no border.
 */
function detectBorderStyle(element) {
    if (!element) return null;

    // Check for special border classes first
    const borderClasses = Array.from(element.classList)
        .filter(cls => cls.startsWith('border-') && cls !== 'border-none');

    // Prioritize specific style classes
    const knownStyles = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'glow', 'pixel'];
    const borderStyleClass = borderClasses.find(cls => knownStyles.includes(cls.replace('border-', '')));

    if (borderStyleClass) {
        const styleName = borderStyleClass.replace('border-', '');
        console.log(`[CaptureStyles] Detected border style via class: ${borderStyleClass} -> ${styleName}`);

        if (styleName === 'glow') {
             const rootStyle = getComputedStyle(document.documentElement);
             const dynamicBorderColor = rootStyle.getPropertyValue('--dynamic-border-color').trim();
            return {
                style: 'solid', // Glow often uses a solid base for the filter
                isGlow: true,
                glowColor: dynamicBorderColor // Capture the intended glow color from variable
            };
        }
         if (styleName === 'pixel') {
             // Pixel border might be handled differently (maybe pattern or skip?)
             console.warn(`[CaptureStyles] 'border-pixel' detected. Treating as solid for now.`);
             return { style: 'solid' };
         }

        // Return the detected style (dashed, dotted, etc.)
        return { style: styleName };
    }

    // Fallback: Check computed style if no specific class was found
    const computed = window.getComputedStyle(element);
    const computedStyle = computed.borderStyle;
    const computedWidth = parseFloat(computed.borderWidth);

    // Only return computed style if it's not 'none' and has a width > 0
    if (computedStyle && computedStyle !== 'none' && computedWidth > 0) {
        console.log(`[CaptureStyles] Detected border style via computed: ${computedStyle}, width: ${computedWidth}px`);
        return { style: computedStyle };
    }

    // No border detected
    return null;
}


/**
 * Helper: Attempts to retrieve the base64 encoded font data for the selected font/weight/style.
 * Relies on `window.getFontDataByName` being available and returning font data with variants.
 * @param {string} familyName - The target font family name.
 * @param {string|number} targetWeight - The target font weight (e.g., '400', 700).
 * @param {string} targetStyle - The target font style ('normal', 'italic').
 * @returns {object | null} Object with { file, format, weight, style } or null if not found/embeddable.
 */
function getFontEmbedData(familyName, targetWeight = '400', targetStyle = 'normal') {
    if (!familyName || typeof window.getFontDataByName !== 'function') {
        console.warn('[CaptureStyles] Cannot get font embed data: Missing familyName or getFontDataByName function.');
        return null;
    }
    try {
        const fontData = window.getFontDataByName(familyName);
        if (!fontData?.variants?.length) {
            console.warn(`[CaptureStyles] No font data or variants found for font: ${familyName}`);
            return null;
        }

        // Normalize target weight/style for comparison
        const weightStr = String(targetWeight);
        const styleStr = String(targetStyle || 'normal').toLowerCase();

        console.log(`[CaptureStyles] Searching embed data for: ${familyName}, Weight: ${weightStr}, Style: ${styleStr}`);

        // --- Matching Logic ---
        let bestMatch = null;

        // 1. Exact match (weight and style)
        bestMatch = fontData.variants.find(v =>
            v?.file?.startsWith('data:') &&
            String(v.weight || '400') === weightStr &&
            String(v.style || 'normal').toLowerCase() === styleStr
        );

        // 2. Weight match (any style) if exact failed
        if (!bestMatch) {
            bestMatch = fontData.variants.find(v =>
                v?.file?.startsWith('data:') &&
                String(v.weight || '400') === weightStr
            );
            if (bestMatch) console.log(`[CaptureStyles] Found match by weight only.`);
        }

        // 3. Style match (any weight) if weight match failed
         if (!bestMatch) {
            bestMatch = fontData.variants.find(v =>
                 v?.file?.startsWith('data:') &&
                 String(v.style || 'normal').toLowerCase() === styleStr
            );
             if (bestMatch) console.log(`[CaptureStyles] Found match by style only.`);
         }

        // 4. Base 'normal'/'400' variant if still no match
        if (!bestMatch) {
            bestMatch = fontData.variants.find(v =>
                v?.file?.startsWith('data:') &&
                String(v.weight || '400') === '400' &&
                String(v.style || 'normal').toLowerCase() === 'normal'
            );
            if (bestMatch) console.log(`[CaptureStyles] Found match using default normal/400 variant.`);
        }

        // 5. *Any* embeddable variant as a last resort
        if (!bestMatch) {
            bestMatch = fontData.variants.find(v => v?.file?.startsWith('data:'));
            if (bestMatch) console.log(`[CaptureStyles] Found *any* embeddable variant as last resort.`);
        }
        // --- End Matching Logic ---


        if (bestMatch?.file) {
             // Extract format from base64 string (e.g., 'woff2', 'ttf')
             const formatMatch = bestMatch.file.match(/^data:font\/([\w+-]+);/);
             const format = formatMatch ? formatMatch[1] : (bestMatch.format || 'woff2'); // Use detected or stored, default woff2

            console.log(`[CaptureStyles] Selected embeddable variant for ${familyName}: Weight=${bestMatch.weight || '400'}, Style=${bestMatch.style || 'normal'}, Format=${format}`);
            return {
                file: bestMatch.file,
                format: format,
                // Return the actual weight/style of the matched variant
                weight: bestMatch.weight || 400,
                style: bestMatch.style || 'normal'
            };
        } else {
            console.warn(`[CaptureStyles] No embeddable (base64) variant found for ${familyName} matching criteria.`);
            return null;
        }
    } catch (e) {
        console.error(`[CaptureStyles] Error getting font embed data for ${familyName}:`, e);
        return null;
    }
}


/**
 * Helper: Analyze text effect class or text-shadow to provide structured effect data for SVG filters.
 * @param {string|null} effectClass - The applied text effect class name (e.g., 'text-glow-soft', 'text-shadow-hard').
 * @param {string|null} textShadowCss - The computed text-shadow CSS value.
 * @param {string} effectColor - The color intended for the effect (e.g., from --dynamic-border-color).
 * @returns {object|null} Object with { type: 'glow'|'shadow', color, blur, dx, dy, opacity, filterId } or null if no suitable effect.
 */
function getEffectDetails(effectClass, textShadowCss, effectColor) {
    const details = {
        type: null,
        color: effectColor || '#ffffff', // Default to white if no color provided
        blur: 0,
        dx: 0,
        dy: 0,
        opacity: 0.75, // Default opacity for filters
        filterId: 'svgTextEffect' // Consistent ID for the SVG filter
    };

    // --- Check Class First ---
    if (effectClass && effectClass !== 'text-glow-none' && effectClass !== 'text-shadow-none') {
         console.log(`[CaptureStyles] Processing effect class: ${effectClass}`);
        if (effectClass.startsWith('text-glow-')) {
            details.type = 'glow';
            details.opacity = 0.85; // Glows often slightly more opaque
            if (effectClass.includes('soft')) { details.blur = 5; }
            else if (effectClass.includes('medium')) { details.blur = 8; }
            else if (effectClass.includes('sharp')) { details.blur = 1; details.opacity = 1; }
            else if (effectClass.includes('neon')) { details.blur = 10; details.opacity = 0.9; }
            else { details.blur = 3; } // Default glow blur

        } else if (effectClass.startsWith('text-shadow-')) {
            details.type = 'shadow';
            details.opacity = 0.6; // Shadows often less opaque
             if (effectClass.includes('soft')) { details.blur = 5; details.dx = 2; details.dy = 2; }
             else if (effectClass.includes('medium')) { details.blur = 8; details.dx = 3; details.dy = 3; }
             else if (effectClass.includes('hard')) { details.blur = 0; details.dx = 2; details.dy = 2; details.opacity = 0.8; }
             else if (effectClass.includes('long')) { details.blur = 0; details.dx = 6; details.dy = 6; details.opacity = 0.5;}
             else if (effectClass.includes('outline')) {
                 // Outline is better handled via stroke, not filter
                 console.log(`[CaptureStyles] Outline effect detected via class (${effectClass}), should use SVG stroke instead of filter.`);
                 return null;
             }
             else if (effectClass.includes('emboss') || effectClass.includes('inset')) {
                 // Basic approximation, warn user
                 console.warn(`[CaptureStyles] Emboss/Inset (${effectClass}) detected, SVG filter approximation might be inaccurate.`);
                 details.blur = 1; details.dx = effectClass.includes('inset') ? -1 : 1; details.dy = effectClass.includes('inset') ? -1 : 1;
                 // Maybe add a secondary highlight? For now, just basic shadow.
             }
              else if (effectClass.includes('retro')) {
                 // Basic approximation, warn user
                 console.warn(`[CaptureStyles] Retro effect (${effectClass}) detected, complex filter required, using basic approximation.`);
                 details.blur = 0; details.dx = 3; details.dy = 3; details.opacity = 0.7;
                 // Could try getting secondary color: getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim() || details.color;
             }
             else { details.blur = 3; details.dx = 1; details.dy = 1; } // Default shadow
        } else {
             // Unrecognized class prefix starting with text-
             console.log(`[CaptureStyles] Unrecognized text effect class: ${effectClass}. Ignoring for filter.`);
             return null;
        }

        console.log(`[CaptureStyles] Effect details from class '${effectClass}':`, details);
        return details;

    // --- Fallback to Computed text-shadow ---
    } else if (textShadowCss && textShadowCss !== 'none') {
        console.log(`[CaptureStyles] No effect class found, parsing computed text-shadow: ${textShadowCss}`);
        // Simplistic parsing for the *first* shadow defined (CSS allows multiple)
        // Format: optional<color> <offset-x> <offset-y> optional<blur-radius>
        // Regex to find color first, then pixel values
        const colorMatch = textShadowCss.match(/#[0-9a-f]{3,8}|rgba?\([\d.\s%,\/]+\)/i);
        const numbers = textShadowCss.match(/-?\d+(\.\d+)?px/g) || []; // Find pixel values [dx, dy, blur?]

        if (numbers.length >= 2) { // Need at least dx and dy
             details.type = 'shadow';
             details.color = colorMatch ? colorMatch[0] : '#000000'; // Default shadow color if not specified
             details.dx = parseFloat(numbers[0]);
             details.dy = parseFloat(numbers[1]);
             details.blur = numbers.length > 2 ? parseFloat(numbers[2]) : 0; // Blur is optional (3rd number)
             details.opacity = 1; // Assume full opacity unless color is rgba

             if (details.color.startsWith('rgba')) {
                 try {
                     // Extract alpha value
                     const alpha = parseFloat(details.color.split(',')[3]);
                     if (!isNaN(alpha)) {
                         details.opacity = alpha;
                     }
                 } catch (e) { /* Ignore parsing errors */ }
             }
            console.log(`[CaptureStyles] Effect details parsed from computed shadow:`, details);
            return details;
        } else {
            console.log(`[CaptureStyles] Could not parse dx/dy from computed text-shadow.`);
        }
    }

    // No effect detected by class or computed style
    console.log('[CaptureStyles] No applicable text effect/shadow found.');
    return null;
}

/**
 * Extract background type based on classList or computed style.
 * @param {HTMLElement} element - The element to check (usually previewContainer).
 * @returns {string} Background type identifier (e.g., 'bg-solid', 'bg-gradient-preset', 'bg-pattern-url').
 */
function extractBackgroundType(element) {
    if (!element) return 'bg-solid';

    // Check class list first for explicit types
    const classList = Array.from(element.classList);
    const bgClass = classList.find(cls => cls.startsWith('bg-'));

    if (bgClass) {
        console.log(`[Style Capture] Detected background type via class: ${bgClass}`);
        // You might want more specific types based on your classes, e.g., 'bg-gradient-custom', 'bg-pattern-dots'
        return bgClass; // Return the full class name as the type identifier
    }

    // If no class, check computed style
    const computedStyle = window.getComputedStyle(element);
    const bgImage = computedStyle.backgroundImage;

    if (bgImage && bgImage !== 'none') {
        if (bgImage.includes('gradient')) {
            console.log(`[Style Capture] Detected background type via computed style: gradient`);
            return 'bg-gradient'; // Generic gradient type
        } else if (bgImage.includes('url(')) {
             console.log(`[Style Capture] Detected background type via computed style: pattern/image (url)`);
             return 'bg-pattern'; // Generic pattern/image type
        }
         // Could potentially check for SVG patterns here too if needed
    }

    // Default to solid if no class and no significant background-image
    console.log(`[Style Capture] Defaulting to background type: bg-solid`);
    return 'bg-solid';
}

/**
 * Improved function to extract colors from gradients.
 * Handles CSS variables, preset gradients via SettingsManager, and direct color values.
 * @param {HTMLElement} element - The element with the gradient (logoText or previewContainer).
 * @returns {string[]} Array of color values (strings), potentially empty.
 */
function extractGradientColors(element) {
    if (!element) return [];

    const computedStyle = window.getComputedStyle(element);
    let backgroundImage = computedStyle.backgroundImage;
    let isTextGradient = element.classList.contains('logo-text') && (computedStyle.backgroundClip === 'text' || computedStyle.webkitBackgroundClip === 'text');
    const elementType = element.classList.contains('logo-text') ? 'Text' : 'Background';

    console.log(`[Style Capture] Extracting ${elementType} gradient colors. Computed BG Image: ${backgroundImage.substring(0, 100)}...`);

    // --- Try SettingsManager First (Most Reliable for Custom/Presets) ---
    const currentSettings = window.SettingsManager?.getCurrentSettings?.();
    if (currentSettings) {
        console.log(`[Style Capture] Checking SettingsManager for ${elementType} gradient...`);
        if (isTextGradient && currentSettings.textColorMode === 'gradient') {
            if (currentSettings.gradientPreset === 'custom' && currentSettings.color1 && currentSettings.color2) {
                const colors = [currentSettings.color1, currentSettings.color2];
                if (currentSettings.useColor3 && currentSettings.color3) { colors.push(currentSettings.color3); }
                console.log(`[Style Capture] Using custom text gradient colors from SettingsManager:`, colors);
                return colors;
            } else if (currentSettings.gradientPreset !== 'custom') {
                 // Try to resolve preset variable
                 const presetValue = getRootCSSVariable(`--${currentSettings.gradientPreset}`);
                 if (presetValue) {
                     const presetColors = presetValue.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)/gi);
                     if (presetColors?.length) {
                         console.log(`[Style Capture] Using preset text gradient (${currentSettings.gradientPreset}) colors via CSS var:`, presetColors);
                         return presetColors.map(c => c.trim());
                     }
                 }
                 console.warn(`[Style Capture] Could not resolve text gradient preset '${currentSettings.gradientPreset}' from CSS variables.`);
            }
        } else if (!isTextGradient && currentSettings.backgroundType?.includes('gradient')) { // Background gradient
             if (currentSettings.backgroundGradientPreset === 'custom' && currentSettings.bgColor1 && currentSettings.bgColor2) {
                 const colors = [currentSettings.bgColor1, currentSettings.bgColor2];
                 console.log(`[Style Capture] Using custom background gradient colors from SettingsManager:`, colors);
                 return colors;
             } else if (currentSettings.backgroundGradientPreset !== 'custom') {
                 // Try to resolve preset variable
                 const presetValue = getRootCSSVariable(`--${currentSettings.backgroundGradientPreset}`);
                  if (presetValue) {
                     const presetColors = presetValue.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)/gi);
                     if (presetColors?.length) {
                         console.log(`[Style Capture] Using preset background gradient (${currentSettings.backgroundGradientPreset}) colors via CSS var:`, presetColors);
                         return presetColors.map(c => c.trim());
                     }
                 }
                 console.warn(`[Style Capture] Could not resolve background gradient preset '${currentSettings.backgroundGradientPreset}' from CSS variables.`);
             }
        }
    } else {
         console.log(`[Style Capture] SettingsManager not available or settings missing.`);
    }

    // --- Fallback: Parse Computed Style ---
    if (!backgroundImage || !backgroundImage.includes('gradient')) {
        console.log(`[Style Capture] No gradient found in computed backgroundImage for ${elementType}.`);
        return [];
    }

    // Regex to find colors (hex, rgb, rgba) within the gradient definition
    const colorRegex = /#[0-9a-f]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;
    const colors = backgroundImage.match(colorRegex) || [];

    if (colors.length > 0) {
        console.log(`[Style Capture] Extracted gradient colors directly from computed CSS for ${elementType}:`, colors);
        return colors.map(c => c.trim());
    }

    // --- Last Resort Fallback ---
    console.warn(`[Style Capture] Could not extract gradient colors for ${elementType} via SettingsManager or computed style. Using defaults.`);
    return isTextGradient ? ['#8A2BE2', '#FF1493'] : ['#3a1c71', '#ffaf7b'];
}

/**
 * Improved function to extract gradient angle or direction keyword.
 * @param {string} backgroundImage - The CSS background-image value containing the gradient.
 * @returns {string} Angle (e.g., "90deg") or direction keyword (e.g., "to right") or default '180deg' (top to bottom).
 */
function extractGradientAngle(backgroundImage) {
    if (!backgroundImage || typeof backgroundImage !== 'string' || !backgroundImage.includes('gradient')) {
         // Try to get from settings if available (assuming defaults there if needed)
         const currentSettings = window.SettingsManager?.getCurrentSettings?.();
         if (currentSettings) {
             const isText = backgroundImage?.includes('text') || false; // Crude check if it's likely text
             const direction = isText
                 ? currentSettings.animationDirection // Assuming text gradient direction stored here
                 : currentSettings.bgGradientDirection; // Assuming background gradient direction stored here
             if (direction !== undefined && direction !== null) {
                 console.log(`[Style Capture] Using gradient direction from SettingsManager: ${direction}deg`);
                 return `${direction}deg`;
             }
         }
        console.log(`[Style Capture] No gradient in string or settings, defaulting angle to 180deg.`);
        return '180deg'; // Default: top to bottom
    }

    // Regex to find the direction part (angle or 'to direction')
    // It should be the first part after 'linear-gradient(' before the first color stop
    const directionRegex = /linear-gradient\(\s*([^,]+),/i;
    const match = backgroundImage.match(directionRegex);

    if (match && match[1]) {
        const directionPart = match[1].trim();
        // Check if it's a standard direction keyword or an angle
        if (directionPart.startsWith('to ') || directionPart.endsWith('deg') || directionPart.endsWith('turn')) {
             console.log(`[Style Capture] Extracted gradient direction/angle from CSS: ${directionPart}`);
            return directionPart;
        }
        // If it's something else (like just a color), assume default direction
    }

    // Fallback to CSS variable if direct extraction fails
    const rootStyle = getComputedStyle(document.documentElement);
    // Check which variable makes sense based on context (crude check)
    const isText = backgroundImage.includes('text'); // Re-check needed?
    const cssVarName = isText ? '--gradient-direction' : '--bg-gradient-direction';
    const directionFromVar = rootStyle.getPropertyValue(cssVarName).trim();

    if (directionFromVar) {
         console.log(`[Style Capture] Using gradient direction from CSS variable ${cssVarName}: ${directionFromVar}`);
         return directionFromVar;
    }


    console.log(`[Style Capture] Could not extract gradient direction/angle, defaulting to 180deg.`);
    return '180deg'; // Default: top to bottom
}


/**
 * Extract keyframes CSS text for a given animation name.
 * Uses window.getActiveAnimationKeyframes, stylesheet parsing, and hardcoded fallbacks.
 * @param {string} animationName - The name of the animation (e.g., 'pulse', 'glitch-1').
 * @returns {string|null} The full `@keyframes` rule text or null if not found.
 */
function extractKeyframesCSS(animationName) {
    if (!animationName || typeof animationName !== 'string') return null;
    console.log(`[Style Capture] Extracting keyframes CSS for: ${animationName}`);

    // --- 1. Try window.getActiveAnimationKeyframes (if defined) ---
    if (typeof window.getActiveAnimationKeyframes === 'function') {
        try {
            const keyframesFromWindow = window.getActiveAnimationKeyframes(animationName);
            if (keyframesFromWindow && typeof keyframesFromWindow === 'string') {
                console.log(`[Style Capture] Found keyframes via window.getActiveAnimationKeyframes for ${animationName}.`);
                return keyframesFromWindow;
            }
        } catch (e) {
            console.warn(`[Style Capture] Error calling window.getActiveAnimationKeyframes:`, e);
        }
    } else {
         console.log(`[Style Capture] window.getActiveAnimationKeyframes not available.`);
    }

    // --- 2. Try Parsing Stylesheets ---
    try {
        for (let i = 0; i < document.styleSheets.length; i++) {
            const sheet = document.styleSheets[i];
            // Skip disabled stylesheets or those without rules
            if (sheet.disabled) continue;
            let rules;
            try {
                 // Accessing cssRules can throw SecurityError for cross-origin stylesheets
                rules = sheet.cssRules || sheet.rules;
                 if (!rules) continue;
            } catch (e) {
                if (e.name === 'SecurityError') {
                    console.log(`[Style Capture] Security restriction accessing stylesheet ${i} (${sheet.href || 'inline/embedded'}) - cannot extract keyframes.`);
                } else {
                    console.warn(`[Style Capture] Error accessing rules for stylesheet ${i}:`, e);
                }
                continue; // Skip this sheet
            }

            for (let j = 0; j < rules.length; j++) {
                const rule = rules[j];
                // Check if it's a keyframes rule and the name matches
                // Use rule.KEYFRAMES_RULE if available, otherwise check type number (usually 7)
                const isKeyframesRule = (CSSRule.KEYFRAMES_RULE && rule.type === CSSRule.KEYFRAMES_RULE) || rule.type === 7;
                if (isKeyframesRule && rule.name === animationName) {
                    console.log(`[Style Capture] Found keyframes in stylesheet ${i} for ${rule.name}.`);
                    return rule.cssText; // Return the full @keyframes rule text
                }
            }
        }
    } catch (e) {
        // Catch potential errors iterating stylesheets themselves
        console.warn(`[Style Capture] Error during stylesheet iteration:`, e);
    }
     console.log(`[Style Capture] Did not find keyframes for '${animationName}' by parsing stylesheets.`);

    // --- 3. Use Hardcoded Fallbacks ---
    const FALLBACK_KEYFRAMES = {
        'pulse': `@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.9}}`,
        'bounce': `@keyframes bounce{0%,20%,50%,80%,100%{transform:translateY(0)}40%{transform:translateY(-15px)}60%{transform:translateY(-8px)}}`,
        'shake': `@keyframes shake{0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-4px)}20%,40%,60%,80%{transform:translateX(4px)}}`,
        'float': `@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`,
        'rotate': `@keyframes rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`,
        'wave': `@keyframes wave{0%,100%{transform:skew(0deg,0deg)}50%{transform:skew(4deg,2deg)}}`,
        // Glitch often needs pseudo-elements, this is a basic approximation
        'glitch': `@keyframes glitch{0%,100%{clip-path:inset(45% 0 45% 0);transform:translate(-2px,1px) scale(1.01)}25%{clip-path:inset(10% 0 70% 0);transform:translate(2px,-1px) scale(.99)}50%{clip-path:inset(75% 0 15% 0);transform:translate(-2px,-1px) scale(1.02)}75%{clip-path:inset(30% 0 60% 0);transform:translate(2px,1px) scale(.98)}}`,
        'flicker': `@keyframes flicker{0%,19.9%,22%,62.9%,64%,84.9%,86%,100%{opacity:1}20%,21.9%,63%,63.9%,85%,85.9%{opacity:0.4}}`,
        'fade': `@keyframes fade{0%,100%{opacity:.2}50%{opacity:1}}`
        // Add more fallbacks as needed
    };

    if (FALLBACK_KEYFRAMES[animationName]) {
        console.log(`[Style Capture] Using hardcoded fallback keyframes for ${animationName}.`);
        return FALLBACK_KEYFRAMES[animationName];
    }

    // Check for base name fallback (e.g., "glitch-1" -> "glitch")
    const baseName = animationName.split('-')[0];
    if (baseName !== animationName && FALLBACK_KEYFRAMES[baseName]) {
        console.log(`[Style Capture] Using hardcoded base fallback keyframes for ${baseName} (from ${animationName}).`);
        // We should probably rename the keyframes rule to match animationName if we use a base fallback
        // For now, just return the base rule text. SVG generation might need adjustment.
        return FALLBACK_KEYFRAMES[baseName].replace(`@keyframes ${baseName}`, `@keyframes ${animationName}`);
    }

    console.warn(`[Style Capture] No keyframes found or generated for animation: ${animationName}.`);
    return null;
}


// Make the main function globally accessible if not using ES modules
if (typeof window !== 'undefined') {
    window.captureAdvancedStyles = captureAdvancedStyles;
}