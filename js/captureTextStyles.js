/**
 * captureTextStyles.js - v17+ (Major Upgrade + Enhanced Support)
 * ==============================================================
 * Captures computed styles and relevant settings from the preview container,
 * integrating detection for advanced effects:
 *   - Text decoration classes (underline/overline/line-through, etc.)
 *   - Text style classes (italic/oblique)
 *   - Text stroke classes (thin, medium, thick, contrast)
 *   - 3D text effects, reflection, cutout, etc.
 *   - Border & background detection (both static & animated)
 *   - Animations & keyframe extraction
 *
 * The final returned object is used for generating consistent CSS, SVG, or
 * other exports. 
 */

console.log("[CaptureStyles] Enhanced Module v17+ loaded.");

/**
 * Main function to capture all computed styles from the logo elements.
 * @returns {object|null} Complete style object or null on critical failure.
 */
/**
 * Main function to capture all computed styles from the logo elements.
 * Identifies and extracts all styling information needed for accurate rendering.
 * @returns {object|null} Complete style object or null on critical failure.
 */
export function captureAdvancedStyles() {
    console.log("[Style Capture v17+] STARTING ENHANCED STYLE CAPTURE...");

    // 1. Basic environment checks
    if (typeof window.normalizeColor !== 'function') {
        console.error("[Style Capture] CRITICAL: window.normalizeColor is not available!");
        return null;
    }

    // 2. Get DOM elements
    const previewContainer = document.getElementById('previewContainer');
    const logoContainer = document.querySelector('.logo-container');
    const logoText = document.querySelector('.logo-text');

    if (!logoContainer || !logoText) {
        console.error("[Style Capture] CRITICAL ERROR: Missing .logo-container or .logo-text!");
        return null;
    }
    if (!previewContainer) {
        console.warn("[Style Capture] WARNING: #previewContainer not found. Some background detection may be limited.");
    }

    // 3. Compute bounding box info for the container
    const containerRect = logoContainer.getBoundingClientRect();
    const originalWidth = containerRect.width;
    const originalHeight = containerRect.height;
    let originalAspectRatio = 1;
    if (originalHeight > 0 && originalWidth > 0) {
        originalAspectRatio = originalWidth / originalHeight;
    }
    console.log(`[Style Capture] Container dims: ${originalWidth.toFixed(2)}x${originalHeight.toFixed(2)} (AR=${originalAspectRatio.toFixed(4)})`);

    // 4. Grab computed styles
    const containerStyle = window.getComputedStyle(logoContainer);
    const textStyle = window.getComputedStyle(logoText);
    const previewContainerStyle = previewContainer ? window.getComputedStyle(previewContainer) : {};
    const rootStyle = window.getComputedStyle(document.documentElement);

    // 5. Optionally read from SettingsManager if available
    const currentSettings = window.SettingsManager?.getCurrentSettings?.() || {};

    // 6. Initialize final result object
    const styles = {
        // Basic container dimension info
        originalDimensions: {
            width: originalWidth,
            height: originalHeight,
            aspectRatio: originalAspectRatio
        },
        containerOpacity: containerStyle.opacity || '1',
        
        // Export config (width, height, transparency, etc.)
        exportConfig: {
            width: parseInt(document.getElementById('exportWidth')?.value || currentSettings.exportWidth || '800'),
            height: parseInt(document.getElementById('exportHeight')?.value || currentSettings.exportHeight || '400'),
            transparent: document.getElementById('exportTransparent')?.checked ?? currentSettings.exportTransparent ?? false
        },

        // Main text content info
        textContent: {
            finalText: logoText.textContent || currentSettings.logoText || 'Logo',
            transform: textStyle.textTransform || 'none',
            transformedText: '' // will fill below
        },

        // Font info
        font: {
            family: textStyle.fontFamily || 'sans-serif',
            size: textStyle.fontSize || '100px',
            weight: textStyle.fontWeight || '400',
            style: textStyle.fontStyle || 'normal',
            letterSpacing: textStyle.letterSpacing || 'normal',
            embedData: null // fill if we have base64 embed
        },

        // Basic color fill (solid or gradient)
        color: {
            mode: 'solid',
            value: textStyle.color || '#ffffff'
        },
        opacity: textStyle.opacity || '1',

        // Text alignment / anchor
        textAnchor: 'middle', // default
        textAlign: 'center',  // default

        // Background info
        background: {
            type: 'bg-solid',
            color: 'transparent',
            opacity: '1',
            classList: [],
            patternClass: null,
            gradient: null,
            image: null,
            size: 'cover',
            position: 'center',
            repeat: 'no-repeat'
        }
        // Additional fields (like stroke, border, textEffect, animation, etc.)
        // will be added as we detect them.
    };

    // 7. Overwrite letterSpacing if we have a --dynamic-letter-spacing var
    const letterSpacingVar = rootStyle.getPropertyValue('--dynamic-letter-spacing').trim();
    if (letterSpacingVar) {
        styles.font.letterSpacing = letterSpacingVar;
    }

    // 8. Determine text alignment
    const textAlignComputed = textStyle.textAlign.trim().toLowerCase();
    if (textAlignComputed === 'left') {
        styles.textAlign = 'left';
        styles.textAnchor = 'start';
    } else if (textAlignComputed === 'right') {
        styles.textAlign = 'right';
        styles.textAnchor = 'end';
    } else {
        styles.textAlign = 'center';
        styles.textAnchor = 'middle';
    }

    // 9. Handle text transform + actual text
    styles.textContent.transformedText = getTransformedTextContent(logoText, styles.textContent.transform);

    // 10. Gather text classes
    const textClassList = Array.from(logoText.classList) || [];
    styles.textClassList = textClassList.slice(); // store them

    // 11. Detect enhanced text features (moved from line 147 where it caused errors)
    // 11a. Text decoration (underline, overline, etc.)
    const textDecorationClass = textClassList.find(cls => 
        cls.startsWith('text-decoration-') && cls !== 'text-decoration-none'
    );
    if (textDecorationClass) {
        styles.textDecoration = textDecorationClass;
    }
    
    // 11b. Text style (italic, oblique)
    const textStyleClass = textClassList.find(cls => cls.startsWith('text-style-'));
    if (textStyleClass) {
        styles.textStyle = textStyleClass;
    }
    
    // 11c. Comprehensive detection of decorations for backwards compatibility
    styles.textDecorations = textClassList.filter(cls =>
        cls.startsWith('text-decoration-') ||
        cls.startsWith('text-style-')
    );

    // 12. Detect text stroke classes (thin, medium, thick, contrast)
    styles.textStrokeClass = textClassList.find(cls => cls.startsWith('text-stroke-')) || null;

    // 13. Detect 3D effects / reflection, etc.
    styles.text3DEffects = textClassList.filter(cls => 
        cls.startsWith('text-effect-3d-') || 
        cls.includes('reflection') || 
        cls.includes('cutout')
    );
    
    // 13a. Detect enhanced 3D effects more explicitly for SVG export
    const enhanced3D = textClassList.find(cls => 
        cls.startsWith('text-effect-3d-') || 
        cls === 'text-effect-reflection' || 
        cls === 'text-effect-cutout'
    );
    if (enhanced3D) {
        styles.enhanced3D = enhanced3D;
    }

    // 14. Detect background type
    const bgElement = previewContainer || logoContainer;
    styles.background.type = extractBackgroundType(bgElement);
    const bgStyle = previewContainer ? previewContainerStyle : containerStyle;
    styles.background.color = bgStyle.backgroundColor || 'transparent';
    styles.background.opacity = bgStyle.opacity || '1';
    styles.background.classList = Array.from(bgElement.classList).filter(c => c.startsWith('bg-'));
    
    // Check for special background patterns
    if (styles.background.type.match(/^bg-(grid|dots|lines|checkerboard|carbon|noise|circuit|matrix|stars|nebula|geometric|synthwave|hexagons|diamonds|wave-pattern|graph-paper|gradient-pulse|floating-particles)/)) {
        styles.background.patternClass = styles.background.type;
    }

    // If there's a gradient, parse it from computed style or from settings
    if (bgStyle.backgroundImage && bgStyle.backgroundImage.includes('gradient')) {
        styles.background.gradient = {
            colors: extractGradientColors(bgElement, false),
            direction: extractGradientAngle(bgStyle.backgroundImage, false)
        };
    }

    // 15. Detect preview padding if set
    if (previewContainer) {
        const previewPadding = previewContainerStyle.padding;
        if (previewPadding && previewPadding !== '0px') {
            styles.previewPadding = previewPadding;
        }
    }

    // 16. Detect text fill as gradient vs solid
    if ((textStyle.backgroundClip === 'text' || textStyle.webkitBackgroundClip === 'text') && 
        textStyle.backgroundImage && textStyle.backgroundImage.includes('gradient')) {
        styles.color.mode = 'gradient';
        styles.color.gradient = {
            colors: extractGradientColors(logoText, true),
            direction: extractGradientAngle(textStyle.backgroundImage, true)
        };
    } else {
        styles.color.mode = 'solid';
        styles.color.value = textStyle.color || '#ffffff';
    }

    // 17. Check for raw text stroke from computed style
    const textStrokeWidth = textStyle.textStrokeWidth || textStyle.webkitTextStrokeWidth;
    const textStrokeColor = textStyle.textStrokeColor || textStyle.webkitTextStrokeColor;
    if (textStrokeWidth && parseFloat(textStrokeWidth) > 0 && textStrokeColor && textStrokeColor !== 'transparent') {
        styles.stroke = {
            style: 'solid',
            color: textStrokeColor,
            width: textStrokeWidth,
            isTextStroke: true
        };
        console.log(`[Style Capture] Computed text stroke: width=${styles.stroke.width}, color=${styles.stroke.color}`);
    } else {
        // 18. Detect container border styles
        const borderInfo = detectBorderStyle(logoContainer);
        if (borderInfo) {
            const dynamicBorderColorVar = rootStyle.getPropertyValue('--dynamic-border-color').trim();
            const computedBorderColor = containerStyle.borderColor;
            const borderColorToUse = dynamicBorderColorVar || computedBorderColor || '#ffffff';
            
            styles.border = {
                style: borderInfo.style,
                color: borderColorToUse,
                width: containerStyle.borderWidth || '1px',
                isGlow: borderInfo.isGlow || false,
                glowColor: borderInfo.glowColor || borderColorToUse
            };

            // If CSSUtils is available, attempt dash array
            if (window.CSSUtils && typeof window.CSSUtils.getBorderDashArray === 'function') {
                const dashArray = window.CSSUtils.getBorderDashArray(styles.border.style, styles.border.width);
                if (dashArray) {
                    styles.border.dasharray = dashArray;
                }
            }
        }
    }

    // 19. Border radius & padding
    const br = containerStyle.borderRadius;
    if (br && br !== '0px') {
        styles.borderRadius = br;
        // Quick shape check
        if (br.includes('50%')) styles.borderShape = 'circle';
        else if (parseFloat(br) >= 50) styles.borderShape = 'pill';
        else styles.borderShape = 'rounded';
    }
    const pad = containerStyle.padding;
    if (pad && pad !== '0px') {
        styles.borderPadding = pad;
    }

    // 20. textEffect from classes & computed text-shadow
    const effectClass = textClassList.find(c => 
        c.startsWith('text-effect-') || 
        c.startsWith('text-glow-') || 
        c.startsWith('text-shadow-')
    );
    const dynamicEffectColor = rootStyle.getPropertyValue('--dynamic-border-color').trim() || styles.color.value;
    const effectDetails = getEffectDetails(effectClass, textStyle.textShadow, dynamicEffectColor);
    if (effectDetails) {
        styles.textEffect = effectDetails;
    }

    // 21. Advanced animation detection
    const advancedAnimationClass = textClassList.find(c => 
        c.startsWith('anim-liquify') || 
        c.startsWith('anim-wobble') || 
        c.startsWith('anim-perspective') ||
        c.startsWith('anim-split') ||
        c.startsWith('anim-magnify') ||
        c.startsWith('anim-glow-multicolor') ||
        c.startsWith('anim-flip-3d') ||
        c.startsWith('anim-swing-3d') 
    );
    if (advancedAnimationClass) {
        styles.advancedAnimation = advancedAnimationClass;
    }

    // 22. Transform
    if (textStyle.transform && textStyle.transform !== 'none') {
        styles.transform = { cssValue: textStyle.transform };
    }

    // 23. Animations (class-based or from settings)
    const animClass = textClassList.find(c => c.startsWith('anim-'));
    const activeAnimation = animClass || currentSettings.textAnimation || 'anim-none';
    if (activeAnimation && activeAnimation !== 'anim-none') {
        const animationName = activeAnimation.replace('anim-', '');
        const animDurationSetting = currentSettings.animationSpeed !== undefined 
            ? `${currentSettings.animationSpeed}s`
            : null;
        const animDurationVar = getRootCSSVariable('--animation-duration') || '2s';
        const finalDuration = animDurationSetting || animDurationVar;
        const animationDurationMs = parseAnimationDuration(finalDuration);

        styles.animation = {
            class: activeAnimation,
            type: animationName,
            duration: finalDuration,
            durationMs: animationDurationMs,
            timingFunction: textStyle.animationTimingFunction || 'ease',
            iterationCount: textStyle.animationIterationCount || 'infinite',
            activeKeyframes: extractKeyframesCSS(animationName)
        };
    }

    // 24. Font embedding
    const primaryFontName = getPrimaryFontFamily(styles.font.family);
    styles.font.embedData = getFontEmbedData(primaryFontName, styles.font.weight, styles.font.style);

    console.log("[Style Capture] Enhanced style capture COMPLETE. Returning final object.");
    return styles;
}
/* ------------------------------------------------------------------------
   HELPER FUNCTIONS
   ------------------------------------------------------------------------ */

/** 
 * Return a root-level CSS variable, if available. 
 * e.g. getRootCSSVariable('--animation-duration') -> '2s'
 */
function getRootCSSVariable(varName) {
    if (!varName || typeof document === 'undefined') return '';
    try {
        const root = document.documentElement;
        return window.getComputedStyle(root).getPropertyValue(varName).trim();
    } catch (e) {
        console.error(`[CaptureStyles] Error retrieving root CSS var '${varName}':`, e);
        return '';
    }
}

/** 
 * Convert "2s" or "500ms" to an integer in milliseconds 
 */
function parseAnimationDuration(duration) {
    if (!duration || typeof duration !== 'string') return 0;
    const trimmed = duration.trim();
    const val = parseFloat(trimmed);
    if (isNaN(val)) return 0;
    if (trimmed.endsWith('ms')) return val;
    if (trimmed.endsWith('s')) return val * 1000;
    return val * 1000; // default to seconds
}

/**
 * Extract the "primary" font from a font-family string (handles quotes & fallbacks).
 * e.g. "Orbitron, Arial, sans-serif" => "Orbitron"
 */
function getPrimaryFontFamily(fontFamilyString) {
    if (!fontFamilyString) return 'sans-serif';
    const primary = fontFamilyString.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    return primary || 'sans-serif';
}

/** 
 * Transform text according to text-transform style (uppercase, etc.) 
 */
function getTransformedTextContent(element, transformStyle) {
    const txt = element?.textContent || '';
    switch ((transformStyle || '').toLowerCase()) {
        case 'uppercase': return txt.toUpperCase();
        case 'lowercase': return txt.toLowerCase();
        case 'capitalize': return txt.replace(/\b\w/g, c => c.toUpperCase());
        default: return txt;
    }
}

/**
 * Detect the background "type" by checking classes or computed style 
 */
function extractBackgroundType(element) {
    if (!element) return 'bg-solid';
    const classList = Array.from(element.classList);
    const bgClass = classList.find(cls => cls.startsWith('bg-'));
    if (bgClass) return bgClass;

    const computedStyle = window.getComputedStyle(element);
    const bgImage = computedStyle.backgroundImage;
    if (bgImage && bgImage.includes('gradient')) {
        return 'bg-gradient';
    } else if (bgImage && bgImage.includes('url(')) {
        return 'bg-image';
    }
    return 'bg-solid';
}

/**
 * Extract gradient colors from either text or background computed style (with fallback to Settings).
 * @param {HTMLElement} element 
 * @param {boolean} isTextGradient 
 */
function extractGradientColors(element, isTextGradient) {
    const elementType = isTextGradient ? 'Text' : 'Background';
    const currentSettings = window.SettingsManager?.getCurrentSettings?.();

    // 1. Use Settings if available
    if (currentSettings) {
        if (isTextGradient && currentSettings.textColorMode === 'gradient') {
            // check for custom
            if (currentSettings.gradientPreset === 'custom' && currentSettings.color1 && currentSettings.color2) {
                const colors = [currentSettings.color1, currentSettings.color2];
                if (currentSettings.useColor3 && currentSettings.color3) colors.push(currentSettings.color3);
                return colors.map(c => normalizeColor(c));
            } 
            else if (currentSettings.gradientPreset !== 'custom') {
                // attempt to read from a CSS var
                const presetVar = getRootCSSVariable(`--${currentSettings.gradientPreset}`);
                if (presetVar) {
                    const colorMatches = presetVar.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)/gi);
                    if (colorMatches?.length) {
                        return colorMatches.map(c => normalizeColor(c.trim()));
                    }
                }
            }
        } 
        else if (!isTextGradient && currentSettings.backgroundType?.includes('gradient')) {
            if (currentSettings.backgroundGradientPreset === 'custom' && currentSettings.bgColor1 && currentSettings.bgColor2) {
                return [currentSettings.bgColor1, currentSettings.bgColor2].map(c => normalizeColor(c));
            } 
            else if (currentSettings.backgroundGradientPreset !== 'custom') {
                const presetVar = getRootCSSVariable(`--${currentSettings.backgroundGradientPreset}`);
                if (presetVar) {
                    const colorMatches = presetVar.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)/gi);
                    if (colorMatches?.length) {
                        return colorMatches.map(c => normalizeColor(c.trim()));
                    }
                }
            }
        }
    }

    // 2. Fallback: parse computed style
    const computedStyle = window.getComputedStyle(element);
    const bgImage = computedStyle.backgroundImage;
    if (!bgImage || !bgImage.includes('gradient')) return [];

    const colorRegex = /#[0-9a-f]{3,8}|rgba?\(\s*\d[\d.,\s%]+\)/gi;
    const matches = bgImage.match(colorRegex) || [];
    return matches.map(c => normalizeColor(c.trim()));
}

/**
 * Extract gradient angle/direction from backgroundImage or from Settings
 */
function extractGradientAngle(backgroundImage, isTextGradient) {
    const defaultAngle = '180deg';
    const currentSettings = window.SettingsManager?.getCurrentSettings?.();

    if (isTextGradient && currentSettings?.animationDirection !== undefined) {
        return `${currentSettings.animationDirection}deg`;
    } 
    else if (!isTextGradient && currentSettings?.bgGradientDirection !== undefined) {
        return `${currentSettings.bgGradientDirection}deg`;
    }

    // parse from the backgroundImage string
    if (backgroundImage && backgroundImage.includes('gradient')) {
        const match = backgroundImage.match(/linear-gradient\(\s*([^,]+),/i);
        if (match && match[1]) {
            const directionPart = match[1].trim();
            if (directionPart.startsWith('to ') || directionPart.endsWith('deg') || directionPart.endsWith('turn')) {
                return directionPart.endsWith('deg') ? directionPart : `${parseFloat(directionPart)}deg`;
            }
        }
    }

    // fallback to a relevant CSS var
    const varName = isTextGradient ? '--gradient-direction' : '--bg-gradient-direction';
    const varValue = getRootCSSVariable(varName);
    if (varValue) return varValue;

    return defaultAngle; 
}

/**
 * Attempt to detect the border style/effect from classes or computed style
 */
function detectBorderStyle(element) {
    if (!element) return null;
    const borderClasses = Array.from(element.classList).filter(cls =>
        (cls.startsWith('border-') && cls !== 'border-none') ||
        (cls.startsWith('border-style-') && cls !== 'border-style-none') ||
        (cls.startsWith('border-effect-') && cls !== 'border-effect-none')
    );

    const knownMap = {
        // Basic
        'border-solid': 'solid', 'border-dashed': 'dashed', 'border-dotted': 'dotted',
        'border-double': 'double', 'border-groove': 'groove', 'border-ridge': 'ridge',
        'border-inset': 'inset', 'border-outset': 'outset', 'border-pixel': 'pixel',
        'border-thick': 'thick',

        // "border-style-xxx" or "border-effect-xxx"
        'border-style-none': null, 'border-style-solid': 'solid', 'border-style-dashed': 'dashed',
        'border-style-dotted': 'dotted', 'border-style-double': 'double',
        'border-style-groove': 'groove','border-style-ridge': 'ridge',
        'border-style-inset': 'inset','border-style-outset': 'outset',
        'border-style-pixel': 'pixel','border-style-thick': 'thick',

        // Effects
        'border-glow': 'glow','border-neon': 'neon','border-pulse': 'pulse','border-gradient': 'gradient',
        'border-effect-glow-soft': 'glow','border-effect-glow-strong': 'glow-strong',
        'border-effect-glow-pulse': 'pulse','border-effect-neon-animated': 'neon',
        'border-effect-gradient-animated': 'gradient',

        // multi-layer, corners, etc. => We map them to "solid" for basic.
        'border-style-multi-layer': 'solid',
        'border-style-image-dots': 'solid',
        'border-style-image-zigzag': 'solid',
        'border-style-corners-cut': 'solid',
        'border-style-corners-rounded-different': 'solid',
        'border-effect-marching-ants': 'dashed',
        'border-effect-rotating-dash': 'dashed',
        'border-effect-double-glow': 'solid'
    };

    let detectedStyle = null;
    let isGlow = false;
    let glowColor = null;

    // Check class
    for (const cls of borderClasses) {
        if (knownMap[cls] !== undefined) {
            detectedStyle = knownMap[cls];
            // Possibly check if it's glow
            if (cls.includes('glow') || cls.includes('neon') || cls.includes('pulse') || cls.includes('gradient')) {
                isGlow = true;
            }
            break;
        }
        // check prefix
        const prefixStr = cls.replace(/^border-(style|effect)-/, '').replace(/^border-/, '');
        if (knownMap[prefixStr] !== undefined) {
            detectedStyle = knownMap[prefixStr];
            if (prefixStr.includes('glow') || prefixStr.includes('neon') || prefixStr.includes('pulse') || prefixStr.includes('gradient')) {
                isGlow = true;
            }
            break;
        }
    }

    // If no class-based style found, fallback to computed style
    if (!detectedStyle) {
        const cs = window.getComputedStyle(element);
        const cStyle = cs.borderStyle;
        const cWidth = parseFloat(cs.borderWidth);
        if (cStyle && cStyle !== 'none' && cWidth > 0) {
            detectedStyle = cStyle.toLowerCase();
        }
    }

    if (detectedStyle) {
        // If it is a glow-type
        if (isGlow) {
            const rootStyle = getComputedStyle(document.documentElement);
            glowColor = rootStyle.getPropertyValue('--dynamic-border-color').trim() || '#ffffff';
        }
        return { style: detectedStyle, isGlow, glowColor };
    }
    return null;
}

/**
 * Attempt to find & return base64 font embed data for the requested family, weight, style
 */
function getFontEmbedData(familyName, targetWeight='400', targetStyle='normal') {
    if (!familyName || typeof window.getFontDataByName !== 'function') {
        return null;
    }
    try {
        const fontData = window.getFontDataByName(familyName);
        if (!fontData?.variants?.length) return null;

        const wStr = String(targetWeight);
        const stStr = targetStyle.toLowerCase();

        // filter to data: URIs only
        const candidates = fontData.variants.filter(v => v.file?.startsWith('data:'));
        if (candidates.length === 0) return null;

        // attempt best match
        let best = candidates.find(v => String(v.weight)===wStr && String(v.style||'normal').toLowerCase()===stStr)
                || candidates.find(v => String(v.weight)===wStr && String(v.style||'normal').toLowerCase()==='normal')
                || candidates.find(v => String(v.weight)==='400' && String(v.style||'normal').toLowerCase()==='normal')
                || candidates[0];
        if (best) {
            const formatMatch = best.file.match(/^data:font\/([\w+-]+);/);
            const format = formatMatch ? formatMatch[1] : (best.format || 'woff2');
            return {
                file: best.file,
                format,
                weight: best.weight || 400,
                style: best.style || 'normal'
            };
        }
        return null;
    } catch (e) {
        console.error(`[CaptureStyles] Error retrieving font embed for '${familyName}':`, e);
        return null;
    }
}

/**
 * Based on an effect class or textShadow, build a standardized textEffect object for possible SVG filter usage.
 */
function getEffectDetails(effectClass, textShadowCss, effectColor) {
    const details = {
        type: null,
        color: normalizeColor(effectColor || '#ffffff'),
        blur: 0,
        dx: 0,
        dy: 0,
        opacity: 0.75,
        filterId: 'svgTextEffect'
    };

    let effectFound = false;

    // 1. If we have an effect class
    if (effectClass && effectClass !== 'text-glow-none' && effectClass !== 'text-shadow-none' && effectClass !== 'text-effect-none') {
        const isLegacy = effectClass.startsWith('text-glow-') || effectClass.startsWith('text-shadow-');
        const effectType = isLegacy
            ? (effectClass.startsWith('text-glow-') ? 'glow' : 'shadow')
            : effectClass.replace(/^text-effect-/, '').split('-')[0];

        const effectSubtype = isLegacy
            ? effectClass.replace(/^text-(glow|shadow)-/, '')
            : effectClass.replace(/^text-effect-[^-]+-/, '');

        if (effectType === 'glow') {
            effectFound = true;
            details.type = 'glow';
            details.opacity = 0.85;

            if (effectSubtype.includes('soft')) details.blur = 5;
            else if (effectSubtype.includes('medium')) details.blur = 8;
            else if (effectSubtype.includes('strong')) details.blur = 12;
            else if (effectSubtype.includes('sharp')) { details.blur = 1; details.opacity = 1; }
            else if (effectSubtype.includes('neon')) { details.blur = 10; details.opacity = 0.9; }
            else { details.blur = 3; } // default
        } 
        else if (effectType === 'shadow') {
            effectFound = true;
            details.type = 'shadow';
            details.opacity = 0.6;

            if (effectSubtype.includes('soft')) { details.blur = 5; details.dx=2; details.dy=2; }
            else if (effectSubtype.includes('medium')) { details.blur=8; details.dx=3; details.dy=3; }
            else if (effectSubtype.includes('hard')) { details.blur=0; details.dx=2; details.dy=2; details.opacity=0.8; }
            else if (effectSubtype.includes('outline')) {
                return null; // Outline is better handled as stroke
            }
            else if (effectSubtype.includes('emboss') || effectSubtype.includes('inset')) {
                details.blur=1; 
                details.dx = effectSubtype.includes('inset') ? -1 : 1;
                details.dy = effectSubtype.includes('inset') ? -1 : 1;
                details.color='rgba(0,0,0,0.6)';
            }
            else { details.blur=3; details.dx=1; details.dy=1; }
        }

        if (effectFound) return details;
    }

    // 2. If there's a textShadow in CSS
    if (textShadowCss && textShadowCss !== 'none') {
        // parse only the first shadow
        const shadowRegex = /^\s*(?:(#[0-9a-f]{3,8}|rgba?\([\d.\s%,\/]+\))\s+)?(-?\d+(?:\.\d+)?(?:px|em|rem)?)\s+(-?\d+(?:\.\d+)?(?:px|em|rem)?)(?:\s+(-?\d+(?:\.\d+)?(?:px|em|rem)?))?/;
        const match = textShadowCss.match(shadowRegex);
        if (match) {
            const parsedColor = match[1] ? normalizeColor(match[1]) : '#000';
            const dx = parseFloat(match[2]) || 0;
            const dy = parseFloat(match[3]) || 0;
            const blur = parseFloat(match[4]) || 0;

            details.dx = dx; 
            details.dy = dy;
            details.blur = Math.max(0, blur);
            details.type = blur>0 ? 'glow':'shadow';
            details.color = parsedColor;
            details.opacity = 1.0; // assume

            if (details.color.startsWith('rgba')) {
                try {
                    const alpha = parseFloat(details.color.split(',')[3]);
                    if (!isNaN(alpha)) details.opacity=alpha;
                } catch {}
            }
            details.opacity = Math.max(0, Math.min(1, details.opacity));
            return details;
        }
    }
    return null;
}

/**
 * Extract or generate the CSS @keyframes rule for a named animation.
 */
function extractKeyframesCSS(animationName) {
    if (!animationName || typeof animationName !== 'string') return null;

    // 1. Try a global function
    if (typeof window.getActiveAnimationKeyframes === 'function') {
        try {
            const fromWin = window.getActiveAnimationKeyframes(animationName);
            if (fromWin) return fromWin;
        } catch {}
    }

    // 2. Attempt to parse stylesheets
    try {
        for (const sheet of document.styleSheets) {
            if (sheet.disabled) continue;
            let rules;
            try { rules = sheet.cssRules || sheet.rules; }
            catch { continue; }
            if (!rules) continue;

            for (const rule of rules) {
                // KEYFRAMES_RULE typically is .type===7 in many browsers
                const isKfRule = (CSSRule.KEYFRAMES_RULE && rule.type===CSSRule.KEYFRAMES_RULE) || rule.type===7;
                if (isKfRule && rule.name === animationName) {
                    return rule.cssText;
                }
            }
        }
    } catch {}

    // 3. Hardcoded fallback keyframes if known
    const FALLBACK_KEYFRAMES = {
        pulse: `@keyframes pulse { 0%,100% { transform: scale(1); opacity:1;} 50% { transform: scale(1.08);opacity:0.9;} }`,
        bounce: `@keyframes bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-15px); } }`,
        shake: `@keyframes shake { 0%,100%{transform:translateX(0)} 10%,30%,50%,70%,90%{transform:translateX(-4px) rotate(-0.5deg)} 20%,40%,60%,80%{transform:translateX(4px) rotate(0.5deg)} }`,
        float: `@keyframes float { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-15px) rotate(1deg)} }`,
        rotate: `@keyframes rotate { 0%{transform:rotate(0deg)}100%{transform:rotate(360deg)} }`,
        wave: `@keyframes wave { 0%,100%{transform:skewX(0) skewY(0)} 25%{transform:skewX(5deg) skewY(1deg)} 75%{transform:skewX(-5deg) skewY(-1deg)} }`,
        glitch: `@keyframes glitch { 0%,100%{clip-path:inset(50% 0 30% 0);transform:translate(-4px,1px) scaleY(1.02)}... }`, // truncated example
        fade: `@keyframes fadeInOut { 0%,100%{opacity:0.3}50%{opacity:1} }`
        // etc. Add more as needed
    };

    if (FALLBACK_KEYFRAMES[animationName]) {
        // rename the keyframes block to match exactly
        return FALLBACK_KEYFRAMES[animationName].replace(/@keyframes\s+\w+/, `@keyframes ${animationName}`);
    }

    return null;
}

/* 
   If using ES modules, the "export" above is enough. 
   If you want it on window as well, do: 
       window.captureAdvancedStyles = captureAdvancedStyles;
*/

/**
 * Utility to ensure color is in a consistent string format, e.g. #rrggbb or rgba().
 * If your environment has a better function, use that instead.
 */
const normalizeColor = (color, context = 'color') => {
    if (typeof window.normalizeColor === 'function') {
        return window.normalizeColor(color, context);
    } else {
        console.warn(`[normalizeColor] window.normalizeColor function not found! Using fallback for color: ${color}`);
        // Extremely basic fallback, ideally cssUtils.js should always load first
        return typeof color === 'string' ? color.trim() : '#000000';
    }
};