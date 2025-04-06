/**
 * captureTextStyles.js - v17 (Major Upgrade)
 * Captures computed styles and relevant settings from the preview container.
 * Includes enhanced support for:
 * - Border radius and padding
 * - Consistent text positioning and alignment
 * - Better animation detection
 * - Improved CSS export for SVG
 */

console.log("[CaptureStyles] Enhanced Module v17 loaded.");

/**
 * Main function to capture all computed styles from the logo elements.
 * @returns {object|null} Complete style object or null on critical failure.
 */

export function captureAdvancedStyles() {
    console.log("[Style Capture v17] ========== STARTING ENHANCED STYLE CAPTURE ==========");
    
    // Check helper
    if (typeof window.normalizeColor !== 'function') {
        console.error("[Style Capture] CRITICAL: window.normalizeColor is not available!");
        return null;
    }
    
    // --- Element Finding ---
    const previewContainer = document.getElementById('previewContainer');
    const logoContainer = document.querySelector('.logo-container');
    const logoText = document.querySelector('.logo-text');

    if (!logoContainer || !logoText) {
        console.error("[Style Capture] CRITICAL ERROR: Failed to find logo elements in DOM");
        return null;
    }
    if (!previewContainer) {
        console.warn("[Style Capture] WARNING: Preview container '#previewContainer' not found.");
    }
    console.log("[Style Capture] Found elements: logoContainer, logoText", previewContainer ? '& previewContainer' : '(previewContainer NOT found)');

    // --- Get Container Size for Scaling ---
    const containerRect = previewContainer ? previewContainer.getBoundingClientRect() : logoContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // --- Get Computed Styles & Settings FIRST ---
    const containerStyle = window.getComputedStyle(logoContainer);
    const textStyle = window.getComputedStyle(logoText);
    const previewContainerStyle = previewContainer ? window.getComputedStyle(previewContainer) : {};
    const rootStyle = window.getComputedStyle(document.documentElement);
    const currentSettings = window.SettingsManager?.getCurrentSettings?.() || {};



    // --- Initialize Result Object ---
    // Declare the main 'styles' object FIRST
    const styles = {
        containerOpacity: containerStyle.opacity || '1',
        exportConfig: {
            width: parseInt(document.getElementById('exportWidth')?.value || currentSettings.exportWidth || '800'),
            height: parseInt(document.getElementById('exportHeight')?.value || currentSettings.exportHeight || '400'),
            transparent: document.getElementById('exportTransparent')?.checked ?? currentSettings.exportTransparent ?? false
        },
        textContent: {
            finalText: logoText.textContent || currentSettings.logoText || 'Logo',
            transform: 'none', // Will be updated
            transformedText: '' // Will be updated
        },
        font: {
            family: textStyle.fontFamily || 'sans-serif',
            size: textStyle.fontSize || '100px',
            weight: textStyle.fontWeight || '400',
            style: textStyle.fontStyle || 'normal',
            letterSpacing: textStyle.letterSpacing || 'normal', // Initial value from computed
            embedData: null
        },
        color: {
            mode: 'solid',
            value: textStyle.color || '#ffffff'
        },
        opacity: textStyle.opacity || '1',
        textAnchor: 'middle',
        textAlign: 'center',
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
        },
        // The following fields will be added if detected
        // stroke: null,       // Will be added if found
        // border: null,       // Will be added if found
        // borderRadius: null, // Will be added if found 
        // borderPadding: null,// Will be added if found
        // textEffect: null,   // Will be added if found
        // transform: null,    // Will be added if found
        // animation: null     // Will be added if found
    };

    console.log("[Style Capture] Base styles object initialized.");

    // --- NOW Populate details using computed styles and potentially override ---

    // Prioritize CSS Variable for Letter Spacing
    const letterSpacingVar = rootStyle.getPropertyValue('--dynamic-letter-spacing').trim();
    if (letterSpacingVar) {
         styles.font.letterSpacing = letterSpacingVar;
         console.log(`[Style Capture] Letter Spacing: Using CSS Var "${letterSpacingVar}"`);
    } else {
         styles.font.letterSpacing = textStyle.letterSpacing || 'normal'; // Use computed as fallback
         console.log(`[Style Capture] Letter Spacing: Using Computed "${styles.font.letterSpacing}"`);
    }

    console.log(`[Style Capture] Container Opacity: ${styles.containerOpacity}`);

    // --- Text Alignment ---
    const textAlign = textStyle.textAlign.trim().toLowerCase();
    styles.textAlign = textAlign; // Explicitly capture this
    if (textAlign === 'left') {
        styles.textAnchor = 'start';
        styles.textAlign = 'left';
    } else if (textAlign === 'right') {
        styles.textAnchor = 'end';
        styles.textAlign = 'right';
    } else {
        styles.textAnchor = 'middle';
        styles.textAlign = 'center';
    }
    console.log(`[Style Capture] Text alignment: CSS=${styles.textAlign}, SVG=${styles.textAnchor}`);

    // Also ensure we capture the relevant classes:
    if (logoText.classList) {
        styles.textClassList = Array.from(logoText.classList);
        
        // Explicitly check for text alignment classes
        const alignmentClasses = ['text-align-left', 'text-align-center', 'text-align-right'];
        const hasAlignmentClass = alignmentClasses.some(cls => logoText.classList.contains(cls));
        
        if (!hasAlignmentClass) {
            // Add appropriate class if missing
            if (styles.textAlign === 'left') {
                styles.textClassList.push('text-align-left');
            } else if (styles.textAlign === 'right') {
                styles.textClassList.push('text-align-right');
            } else {
                styles.textClassList.push('text-align-center');
            }
        }
    }
    console.log(`[Style Capture] Text alignment: CSS=${styles.textAlign}, SVG=${styles.textAnchor}`);

    // --- Text Transformation ---
    styles.textContent.transform = textStyle.textTransform || 'none';
    styles.textContent.transformedText = getTransformedTextContent(logoText, styles.textContent.transform);
    console.log(`[Style Capture] Text transform: ${styles.textContent.transform}`);

    // --- Background Styles ---
    const bgElement = previewContainer || logoContainer;
    const bgStyle = previewContainer ? previewContainerStyle : containerStyle;
    styles.background.type = extractBackgroundType(bgElement);
    styles.background.color = bgStyle.backgroundColor || 'transparent';
    styles.background.opacity = bgStyle.opacity || '1';
    styles.background.classList = Array.from(bgElement.classList).filter(cls => cls.startsWith('bg-'));
    if (styles.background.type.match(/^bg-(grid|dots|lines|checkerboard|carbon|noise|circuit|matrix|stars|nebula|geometric|synthwave)/)) {
        styles.background.patternClass = styles.background.type;
    }
    console.log(`[Style Capture] Background: Type=${styles.background.type}, Color=${styles.background.color}, Opacity=${styles.background.opacity}`);
    
    if (bgStyle.backgroundImage && bgStyle.backgroundImage !== 'none') {
       if (styles.background.type.includes('gradient')) {
           styles.background.gradient = { 
               colors: extractGradientColors(bgElement, false), 
               direction: extractGradientAngle(bgStyle.backgroundImage, false) 
           };
           console.log(`[Style Capture] BG Gradient: ${styles.background.gradient.colors.length} colors, Dir: ${styles.background.gradient.direction}`);
       } else { /* ... handle image ... */ }
    } else { 
        styles.background.gradient = null; 
    }

    // --- Text Fill Style ---
    if (textStyle.backgroundClip === 'text' || textStyle.webkitBackgroundClip === 'text') {
        styles.color.mode = 'gradient';
        styles.color.gradient = { 
            colors: extractGradientColors(logoText, true), 
            direction: extractGradientAngle(textStyle.backgroundImage, true) 
        };
        if (!styles.color.gradient.colors || styles.color.gradient.colors.length === 0) {
            console.warn(`[Style Capture] Text gradient fill detected, but failed to extract colors!`);
            styles.color.mode = 'solid'; 
            styles.color.value = textStyle.color || '#ffffff';
        } else { 
            console.log(`[Style Capture] Text Gradient: ${styles.color.gradient.colors.length} colors, Dir: ${styles.color.gradient.direction}`); 
        }
    } else { 
        styles.color.mode = 'solid'; 
        styles.color.value = textStyle.color || '#ffffff'; 
        console.log(`[Style Capture] Solid text color: ${styles.color.value}`); 
    }

    // --- Text Classes ---
    if (logoText.classList) { 
        styles.textClassList = Array.from(logoText.classList); 
    }

    // --- Border/Stroke ---
    const textStrokeWidth = textStyle.textStrokeWidth || textStyle.webkitTextStrokeWidth;
    const textStrokeColor = textStyle.textStrokeColor || textStyle.webkitTextStrokeColor;
    if (textStrokeWidth && parseFloat(textStrokeWidth) > 0 && textStrokeColor && textStrokeColor !== 'transparent') {
         styles.stroke = { 
             style: 'solid', 
             color: textStrokeColor, 
             width: textStrokeWidth, 
             isTextStroke: true 
         };
         console.log(`[Style Capture] Text stroke detected: width=${styles.stroke.width}, color=${styles.stroke.color}`);
    } else {
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
             
             // Add dasharray information for SVG if applicable
             if (window.CSSUtils && typeof window.CSSUtils.getBorderDashArray === 'function') {
                 const dashArray = window.CSSUtils.getBorderDashArray(borderInfo.style, styles.border.width);
                 if (dashArray) {
                     styles.border.dasharray = dashArray;
                 }
             } else {
                 // Fallback to basic dasharray logic
                 const dashArray = getStrokeDasharray(styles.border.style, styles.border.width);
                 if (dashArray) {
                     styles.border.dasharray = dashArray;
                 }
             }
             
             console.log(`[Style Capture] Container border detected: Style=${styles.border.style}, Color=${styles.border.color}, Width=${styles.border.width}`);
         }
    }

    // --- Border Radius --- (NEW)
    const borderRadiusValue = containerStyle.borderRadius;
    if (borderRadiusValue && borderRadiusValue !== '0px') {
        styles.borderRadius = borderRadiusValue;
        
        // Detect if circular
        if (borderRadiusValue.includes('50%')) {
            styles.borderShape = 'circle';
        } else if (parseFloat(borderRadiusValue) >= 50) {
            styles.borderShape = 'pill';
        } else {
            styles.borderShape = 'rounded';
        }
        
        console.log(`[Style Capture] Border radius detected: ${styles.borderRadius} (Shape: ${styles.borderShape})`);
    }
    
    // --- Border Padding --- (NEW)
    const paddingValue = containerStyle.padding;
    if (paddingValue && paddingValue !== '0px') {
        styles.borderPadding = paddingValue;
        console.log(`[Style Capture] Border padding detected: ${styles.borderPadding}`);
    }

    // --- Text Effect ---
    const effectClass = styles.textClassList?.find(c => c.startsWith('text-glow-') || c.startsWith('text-shadow-') || c.startsWith('text-effect-'));
    const dynamicEffectColor = rootStyle.getPropertyValue('--dynamic-border-color').trim();
    const usesDynamicColor = effectClass?.includes('hard') || effectClass?.includes('outline') || effectClass?.includes('long') || effectClass?.includes('neon');
    const effectColorBase = usesDynamicColor ? dynamicEffectColor : (styles.color.mode === 'solid' ? styles.color.value : '#ffffff');
    const effectColorToUse = effectColorBase || '#ffffff';
    const effectDetails = getEffectDetails(effectClass, textStyle.textShadow, effectColorToUse);
    if (effectDetails) { 
        styles.textEffect = effectDetails; 
        console.log(`[Style Capture] Text effect captured: Type=${effectDetails.type}`); 
    }

    // --- Transform ---
    if (textStyle.transform && textStyle.transform !== 'none') { 
        styles.transform = { cssValue: textStyle.transform }; 
        console.log(`[Style Capture] Transform detected: ${textStyle.transform}`);
    }

    // --- Animation ---
    const animClass = styles.textClassList?.find(c => c.startsWith('anim-'));
    const activeAnimation = animClass || currentSettings.textAnimation || 'anim-none';
    if (activeAnimation && activeAnimation !== 'anim-none') {
        const animationName = activeAnimation.replace('anim-', '');
        const animDurationSetting = currentSettings.animationSpeed !== undefined ? `${currentSettings.animationSpeed}s` : null;
        const animDurationVar = getRootCSSVariable('--animation-duration') || '2s';
        const animDurationFinal = animDurationSetting || animDurationVar;
        const animationDurationMs = parseAnimationDuration(animDurationFinal);
        
        styles.animation = { 
            class: activeAnimation, 
            type: animationName, 
            duration: animDurationFinal, 
            durationMs: animationDurationMs, 
            timingFunction: textStyle.animationTimingFunction || 'ease', 
            iterationCount: textStyle.animationIterationCount || 'infinite', 
            activeKeyframes: extractKeyframesCSS(animationName) 
        };
        
        console.log(`[Style Capture] Animation: Class=${activeAnimation}, Type=${animationName}, Duration=${animDurationFinal}`);
    }

    // --- Font Embedding Data ---
    const primaryFontName = getPrimaryFontFamily(styles.font.family);
    styles.font.embedData = getFontEmbedData(primaryFontName, styles.font.weight, styles.font.style);
    console.log(`[Style Capture] Font embed data ${styles.font.embedData ? 'available' : 'NOT available'} for "${primaryFontName}"`);

    // --- Final Log ---
    console.log("[Style Capture] ========== STYLE CAPTURE COMPLETE (v17) ==========");
    return styles;
}



// --- HELPER FUNCTIONS (v17 Updates) ---

/** Get CSS variable from root element */
function getRootCSSVariable(varName) {
    if (!varName || typeof document === 'undefined') return '';
    try {
        const root = document.documentElement;
        if (!root) return '';
        return window.getComputedStyle(root).getPropertyValue(varName).trim();
    } catch (e) {
        console.error(`[CaptureStyles] Error getting root CSS var ${varName}:`, e);
        return '';
    }
}

/** Parse animation duration string (e.g., "2s", "500ms") to milliseconds */
function parseAnimationDuration(duration) {
    if (!duration || typeof duration !== 'string') return 0;
    const trimmedDuration = duration.trim();
    const value = parseFloat(trimmedDuration);
    if (isNaN(value)) return 0;
    if (trimmedDuration.endsWith('ms')) return value;
    if (trimmedDuration.endsWith('s')) return value * 1000;
    return value * 1000; // Default to seconds if no unit
}

/** Get the primary font family name, removing quotes and handling fallbacks */
function getPrimaryFontFamily(fontFamilyString) {
    if (!fontFamilyString || typeof fontFamilyString !== 'string') return 'sans-serif';
    const primary = fontFamilyString.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    return primary || 'sans-serif';
}

/** Apply text transformation based on CSS style */
function getTransformedTextContent(element, transformStyle) {
    const txt = element?.textContent || '';
    if (!txt) return '';
    switch (transformStyle?.toLowerCase()) {
        case 'uppercase': return txt.toUpperCase();
        case 'lowercase': return txt.toLowerCase();
        case 'capitalize': return txt.replace(/\b\w/g, char => char.toUpperCase());
        default: return txt;
    }
}


/** Get SVG stroke-dasharray string based on border style and width */
function getStrokeDasharray(borderStyle, borderWidth) {
    if (!borderStyle || borderStyle === 'none' || borderStyle === 'hidden') return null;
    const style = borderStyle.toLowerCase();
    
    // Robust width parsing
    const w = parseFloat(borderWidth);
    if (isNaN(w) || w <= 0) {
        console.warn(`[CaptureStyles] Invalid border width for dasharray: ${borderWidth}`);
        return null;
    }

    switch (style) {
        case 'dashed':
            return `${Math.max(1, Math.round(w * 3))}, ${Math.max(1, Math.round(w * 2))}`;
        case 'dotted':
             return `${Math.max(1, Math.round(w))}, ${Math.max(1, Math.round(w * 2))}`;
        case 'double':
            // Approximation of double for SVG (not perfect)
            return `${Math.max(1, Math.round(w * 4))}, ${Math.max(1, Math.round(w))}`;
            case 'groove':
            case 'ridge':
            case 'inset':
            case 'outset':
                // Complex border styles can't be directly represented as SVG stroke-dasharray
                console.warn(`[CaptureStyles] Border style '${style}' cannot be directly represented as SVG dasharray. Using solid.`);
                return null; // Use solid stroke as fallback
            default: // Includes 'solid' or unrecognized
                return null;
        }
}      


/** Enhanced border style detection */
function detectBorderStyle(element) {
    if (!element) return null;
    
    // First check for CSS classes
    const borderClasses = Array.from(element.classList).filter(cls => 
        cls.startsWith('border-') && cls !== 'border-none' ||
        cls.startsWith('border-style-') && cls !== 'border-style-none' ||
        cls.startsWith('border-effect-') && cls !== 'border-effect-none'
    );

    // Mapping from class names to style names
    const knownStyles = {
        // Base style values
        'solid': 'solid', 'dashed': 'dashed', 'dotted': 'dotted',
        'double': 'double', 'groove': 'groove', 'ridge': 'ridge',
        'inset': 'inset', 'outset': 'outset',
        
        // Effect-based styles
        'glow': 'glow', 'neon': 'neon', 'pulse': 'pulse', 'gradient': 'gradient',
        
        // New class format prefixed styles
        'border-style-solid': 'solid', 'border-style-dashed': 'dashed', 
        'border-style-dotted': 'dotted', 'border-style-double': 'double',
        'border-style-groove': 'groove', 'border-style-ridge': 'ridge',
        'border-style-inset': 'inset', 'border-style-outset': 'outset',
        'border-style-pixel': 'pixel', 'border-style-thick': 'thick',
        
        // Effect classes
        'border-effect-glow-soft': 'glow', 'border-effect-glow-strong': 'glow-strong',
        'border-effect-glow-pulse': 'pulse', 'border-effect-neon-animated': 'neon',
        'border-effect-gradient-animated': 'gradient',
        
        // Legacy classes
        'border-solid': 'solid', 'border-dashed': 'dashed', 'border-dotted': 'dotted',
        'border-double': 'double', 'border-groove': 'groove', 'border-ridge': 'ridge',
        'border-inset': 'inset', 'border-outset': 'outset', 'border-pixel': 'pixel',
        'border-glow': 'glow', 'border-neon': 'neon', 
        'border-pulse': 'pulse', 'border-gradient': 'gradient',
        'border-thick': 'thick', 'border-thick-solid': 'thick'
    };

    let detectedStyle = null;
    let isGlow = false;
    let glowColor = null;

    // First try to find by class
    for (const cls of borderClasses) {
        // Handle direct style classes
        if (knownStyles[cls]) {
            detectedStyle = knownStyles[cls];
            console.log(`[CaptureStyles] Detected border style via direct class match: ${cls} → ${detectedStyle}`);
            break;
        }
        
        // Handle prefixed classes
        const baseName = cls.replace(/^border-/, '').replace(/^border-style-/, '').replace(/^border-effect-/, '');
        if (knownStyles[baseName]) {
            detectedStyle = knownStyles[baseName];
            console.log(`[CaptureStyles] Detected border style via class prefix: ${cls} → ${detectedStyle}`);
            break;
        }
    }

    // Handle special styling for detected effects
    if (detectedStyle) {
        if (detectedStyle === 'glow' || detectedStyle === 'glow-strong' || 
            detectedStyle === 'neon' || detectedStyle === 'pulse') {
            isGlow = true;
            const rootStyle = getComputedStyle(document.documentElement);
            glowColor = rootStyle.getPropertyValue('--dynamic-border-color').trim();
            console.log(`[CaptureStyles] Detected border effect: ${detectedStyle} with glow color: ${glowColor}`);
        }
        
        // Map back to a basic SVG-compatible style
        if (['glow', 'glow-strong', 'neon', 'pulse', 'gradient'].includes(detectedStyle)) {
            console.log(`[CaptureStyles] Effect style ${detectedStyle} will be represented as solid in SVG with filter if applicable`);
            detectedStyle = 'solid'; // Basic style for SVG
        }
    }

    // Fallback: Check computed style if no specific class was found
    if (!detectedStyle) {
        const computed = window.getComputedStyle(element);
        const computedStyleName = computed.borderStyle;
        const computedWidth = parseFloat(computed.borderWidth);

        if (computedStyleName && computedStyleName !== 'none' && computedWidth > 0) {
            detectedStyle = computedStyleName.toLowerCase();
            console.log(`[CaptureStyles] Detected border style via computed style: ${detectedStyle}, width: ${computedWidth}px`);
        }
    }

    if (detectedStyle) {
         return { style: detectedStyle, isGlow, glowColor };
    }

    // No border detected
    return null;
}


/** Helper: Get font embed data, improved fallback logic */
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

        const weightStr = String(targetWeight || '400');
        const styleStr = String(targetStyle || 'normal').toLowerCase();
        console.log(`[CaptureStyles] Searching embed data for: ${familyName}, Weight: ${weightStr}, Style: ${styleStr}`);

        const embeddableVariants = fontData.variants.filter(v => v?.file?.startsWith('data:'));
        if (embeddableVariants.length === 0) {
             console.warn(`[CaptureStyles] No embeddable (base64) variants found for ${familyName}.`);
             return null;
        }

        // --- Matching Logic (More Flexible) ---
        let bestMatch =
            // 1. Exact match
            embeddableVariants.find(v => String(v.weight || '400') === weightStr && 
                                       String(v.style || 'normal').toLowerCase() === styleStr) ||
            // 2. Weight match, prefer 'normal' style
            embeddableVariants.find(v => String(v.weight || '400') === weightStr && 
                                       String(v.style || 'normal').toLowerCase() === 'normal') ||
            // 3. Weight match (any style)
            embeddableVariants.find(v => String(v.weight || '400') === weightStr) ||
            // 4. Style match, prefer '400' weight
            embeddableVariants.find(v => String(v.style || 'normal').toLowerCase() === styleStr && 
                                       String(v.weight || '400') === '400') ||
             // 5. Style match (any weight)
            embeddableVariants.find(v => String(v.style || 'normal').toLowerCase() === styleStr) ||
            // 6. Base 'normal'/'400' variant
            embeddableVariants.find(v => String(v.weight || '400') === '400' && 
                                       String(v.style || 'normal').toLowerCase() === 'normal') ||
            // 7. *First* embeddable variant as last resort
            embeddableVariants[0];

        if (bestMatch) {
             const formatMatch = bestMatch.file.match(/^data:font\/([\w+-]+);/);
             const format = formatMatch ? formatMatch[1] : (bestMatch.format || 'woff2');
             console.log(`[CaptureStyles] Selected embeddable variant for ${familyName}: Weight=${bestMatch.weight || '400'}, Style=${bestMatch.style || 'normal'}, Format=${format}`);
             return {
                 file: bestMatch.file,
                 format: format,
                 weight: bestMatch.weight || 400,
                 style: bestMatch.style || 'normal'
             };
        } else {
             // Should not happen if embeddableVariants.length > 0, but as a failsafe:
             console.warn(`[CaptureStyles] Final fallback failed to find any embeddable variant for ${familyName}.`);
             return null;
        }
    } catch (e) {
        console.error(`[CaptureStyles] Error getting font embed data for ${familyName}:`, e);
        return null;
    }
}


/** Helper: Analyze text effect class or text-shadow for SVG filters (v17) */
function getEffectDetails(effectClass, textShadowCss, effectColor) {
    const details = {
        type: null, 
        color: normalizeColor(effectColor || '#ffffff'),
        blur: 0, dx: 0, dy: 0, opacity: 0.75, 
        filterId: 'svgTextEffect'
    };
    let effectFound = false;

    // --- Check Effect Class First ---
    // Support both old text-glow-* and new text-effect-* formats
    if (effectClass && effectClass !== 'text-glow-none' && 
                        effectClass !== 'text-shadow-none' && 
                        effectClass !== 'text-effect-none') {
        
        console.log(`[CaptureStyles Effect] Processing class: ${effectClass}`);
        
        // Handle both legacy class format and new format
        const isLegacyFormat = effectClass.startsWith('text-glow-') || effectClass.startsWith('text-shadow-');
        const effectType = isLegacyFormat ? 
                          (effectClass.startsWith('text-glow-') ? 'glow' : 'shadow') :
                          effectClass.replace('text-effect-', '').split('-')[0]; // Extract first part for new format
        
        const effectSubtype = isLegacyFormat ?
                             effectClass.replace(/^text-(glow|shadow)-/, '') :
                             effectClass.replace(/^text-effect-[^-]+-/, '');
        
        if (effectType === 'glow') {
            effectFound = true; 
            details.type = 'glow'; 
            details.opacity = 0.85;
            
            if (effectSubtype === 'soft' || effectClass.includes('soft')) { details.blur = 5; }
            else if (effectSubtype === 'medium' || effectClass.includes('medium')) { details.blur = 8; }
            else if (effectSubtype === 'strong' || effectClass.includes('strong')) { details.blur = 12; }
            else if (effectSubtype === 'sharp' || effectClass.includes('sharp')) { details.blur = 1; details.opacity = 1; }
            else if (effectSubtype === 'neon' || effectClass.includes('neon')) { details.blur = 10; details.opacity = 0.9; }
            else if (effectSubtype === 'fire' || effectClass.includes('fire')) { details.blur = 6; details.color = '#f90'; }
            else if (effectSubtype === 'ice' || effectClass.includes('ice')) { details.blur = 6; details.color = '#7cf'; }
            else { details.blur = 3; }
        } 
        else if (effectType === 'shadow') {
            effectFound = true; 
            details.type = 'shadow'; 
            details.opacity = 0.6;
            
            if (effectSubtype === 'soft' || effectClass.includes('soft')) { 
                details.blur = 5; details.dx = 2; details.dy = 2; 
            }
            else if (effectSubtype === 'medium' || effectClass.includes('medium')) { 
                details.blur = 8; details.dx = 3; details.dy = 3; 
            }
            else if (effectSubtype === 'hard' || effectClass.includes('hard')) { 
                details.blur = 0; details.dx = 2; details.dy = 2; details.opacity = 0.8; 
            }
            else if (effectSubtype === 'long' || effectClass.includes('long')) { 
                details.blur = 0; details.dx = 6; details.dy = 6; details.opacity = 0.5;
            }
            else if (effectClass.includes('outline')) {
                console.log(`[CaptureStyles Effect] Outline class (${effectClass}) detected. Recommend using SVG stroke instead.`);
                return null; // Don't generate filter for outline
            }
            else if (effectClass.includes('emboss') || effectClass.includes('inset')) {
                console.warn(`[CaptureStyles Effect] Emboss/Inset (${effectClass}) detected, SVG filter is a basic approximation.`);
                details.blur = 1; 
                details.dx = effectClass.includes('inset') ? -1 : 1; 
                details.dy = effectClass.includes('inset') ? -1 : 1;
                details.color = 'rgba(0,0,0,0.6)'; // Use dark for main shadow part
            }
            else if (effectClass.includes('multi-layer') || effectClass.includes('retro')) {
                console.warn(`[CaptureStyles Effect] Multi-layer/Retro shadow (${effectClass}) detected, SVG filter uses basic approximation (first layer).`);
                // Approx first layer
                details.blur = 0; details.dx = 2; details.dy = 2; details.opacity = 0.7;
            }
            else { details.blur = 3; details.dx = 1; details.dy = 1; } // Default shadow
        } 
        else {
            console.log(`[CaptureStyles Effect] Unrecognized effect class: ${effectClass}.`);
        }
        
        if (effectFound) {
            console.log(`[CaptureStyles Effect] Details from class '${effectClass}':`, {
                type: details.type, 
                color: details.color, 
                blur: details.blur, 
                dx: details.dx, 
                dy: details.dy, 
                opacity: details.opacity
            });
            return details;
        }
    }

    // --- Fallback to Computed text-shadow ---
    if (textShadowCss && textShadowCss !== 'none') {
         console.log(`[CaptureStyles Effect] Parsing computed text-shadow: ${textShadowCss}`);
         // Improved regex to parse the *first* complete shadow definition
         // Format: [ <color>? && <offset-x> <offset-y> <blur-radius>? ]#
         const shadowRegex = /^\s*(?:(#[0-9a-f]{3,8}|rgba?\([\d.\s%,\/]+\))\s+)?(-?\d+(?:\.\d+)?(?:px|em|rem)?)\s+(-?\d+(?:\.\d+)?(?:px|em|rem)?)(?:\s+(-?\d+(?:\.\d+)?(?:px|em|rem)?))?/;
         const match = textShadowCss.match(shadowRegex);

         if (match) {
             const parsedColor = match[1] ? normalizeColor(match[1]) : '#000000'; // Default black if color omitted
             const dxStr = match[2];
             const dyStr = match[3];
             const blurStr = match[4];

             // Basic unit conversion (assume px if unitless, ignore em/rem for simplicity in SVG filters)
             details.dx = parseFloat(dxStr) || 0;
             details.dy = parseFloat(dyStr) || 0;
             details.blur = parseFloat(blurStr) || 0; // Default 0 blur if not specified

             details.type = details.blur > 0 ? 'glow' : 'shadow'; // Simple heuristic: if blur > 0, treat as glow/soft shadow for feGaussianBlur
             details.color = parsedColor;
             details.opacity = 1.0; // Assume full opacity unless color has alpha

             if (details.color.startsWith('rgba')) {
                 try {
                     const alpha = parseFloat(details.color.split(',')[3]);
                     if (!isNaN(alpha)) details.opacity = alpha;
                 } catch (e) { /* Ignore parsing errors */ }
             }

             // Clamp blur/opacity
             details.blur = Math.max(0, details.blur);
             details.opacity = Math.max(0, Math.min(1, details.opacity));

             console.log(`[CaptureStyles Effect] Details from computed shadow:`, {
                 type: details.type, 
                 color: details.color, 
                 blur: details.blur, 
                 dx: details.dx, 
                 dy: details.dy, 
                 opacity: details.opacity
             });
             return details;
         } else {
             console.log(`[CaptureStyles Effect] Could not parse computed text-shadow format.`);
         }
    }

    // No effect detected
    console.log('[CaptureStyles Effect] No applicable text effect/shadow found.');
    return null;
}


/** Extract background type */
function extractBackgroundType(element) {
    if (!element) return 'bg-solid';
    const classList = Array.from(element.classList);
    const bgClass = classList.find(cls => cls.startsWith('bg-'));
    if (bgClass) {
         console.log(`[Style Capture BG] Detected type via class: ${bgClass}`);
         return bgClass;
    }
    const computedStyle = window.getComputedStyle(element);
    const bgImage = computedStyle.backgroundImage;
    if (bgImage && bgImage !== 'none') {
        if (bgImage.includes('gradient')) { 
            console.log(`[Style Capture BG] Detected type via computed: gradient`); 
            return 'bg-gradient'; 
        }
        if (bgImage.includes('url(')) { 
            console.log(`[Style Capture BG] Detected type via computed: image/pattern`); 
            return 'bg-image'; 
        }
    }
    console.log(`[Style Capture BG] Defaulting to type: bg-solid`);
    return 'bg-solid';
}

/** Extract gradient colors (for text or background) */
function extractGradientColors(element, isTextGradient) {
    if (!element) return [];
    const elementType = isTextGradient ? 'Text' : 'Background';
    console.log(`[Style Capture Grad] Extracting ${elementType} gradient colors...`);

    // --- Try SettingsManager First ---
    const currentSettings = window.SettingsManager?.getCurrentSettings?.();
    if (currentSettings) {
         if (isTextGradient && currentSettings.textColorMode === 'gradient') {
             if (currentSettings.gradientPreset === 'custom' && currentSettings.color1 && currentSettings.color2) {
                 const colors = [currentSettings.color1, currentSettings.color2];
                 if (currentSettings.useColor3 && currentSettings.color3) { colors.push(currentSettings.color3); }
                 console.log(`[Style Capture Grad] Using custom ${elementType} colors from Settings:`, colors);
                 return colors.map(c => normalizeColor(c));
             } else if (currentSettings.gradientPreset !== 'custom') {
                 const presetValue = getRootCSSVariable(`--${currentSettings.gradientPreset}`);
                 if (presetValue) {
                     const presetColors = presetValue.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)/gi);
                     if (presetColors?.length) {
                         console.log(`[Style Capture Grad] Using preset ${elementType} (${currentSettings.gradientPreset}) colors via CSS var:`, presetColors);
                         return presetColors.map(c => normalizeColor(c.trim()));
                     }
                 }
                 console.warn(`[Style Capture Grad] Could not resolve ${elementType} preset '${currentSettings.gradientPreset}' via CSS var.`);
             }
         } else if (!isTextGradient && currentSettings.backgroundType?.includes('gradient')) {
             if (currentSettings.backgroundGradientPreset === 'custom' && currentSettings.bgColor1 && currentSettings.bgColor2) {
                 const colors = [currentSettings.bgColor1, currentSettings.bgColor2];
                 console.log(`[Style Capture Grad] Using custom ${elementType} colors from Settings:`, colors);
                 return colors.map(c => normalizeColor(c));
             } else if (currentSettings.backgroundGradientPreset !== 'custom') {
                 const presetValue = getRootCSSVariable(`--${currentSettings.backgroundGradientPreset}`);
                 if (presetValue) {
                     const presetColors = presetValue.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)/gi);
                     if (presetColors?.length) {
                         console.log(`[Style Capture Grad] Using preset ${elementType} (${currentSettings.backgroundGradientPreset}) colors via CSS var:`, presetColors);
                         return presetColors.map(c => normalizeColor(c.trim()));
                     }
                 }
                  console.warn(`[Style Capture Grad] Could not resolve ${elementType} preset '${currentSettings.backgroundGradientPreset}' via CSS var.`);
             }
         }
    } else {
         console.log(`[Style Capture Grad] SettingsManager not available.`);
    }

    // --- Fallback: Parse Computed Style ---
    const computedStyle = window.getComputedStyle(element);
    let backgroundImage = computedStyle.backgroundImage;
    if (!backgroundImage || !backgroundImage.includes('gradient')) {
        console.log(`[Style Capture Grad] No gradient found in computed backgroundImage for ${elementType}.`);
        return [];
    }
    const colorRegex = /#[0-9a-f]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;
    const colors = backgroundImage.match(colorRegex) || [];
    if (colors.length > 0) {
        console.log(`[Style Capture Grad] Extracted ${elementType} colors from computed CSS:`, colors);
        return colors.map(c => normalizeColor(c.trim()));
    }

    // --- Last Resort Fallback ---
    console.warn(`[Style Capture Grad] Could not extract ${elementType} colors. Using defaults.`);
    return isTextGradient ? ['#FF1493', '#8A2BE2'].map(normalizeColor) : ['#3a1c71', '#ffaf7b'].map(normalizeColor);
}

/** Extract gradient angle/direction (for text or background) */
function extractGradientAngle(backgroundImage, isTextGradient) {
    const elementType = isTextGradient ? 'Text' : 'Background';
    const defaultAngle = '180deg'; // Default top to bottom

    // --- Try SettingsManager First ---
    const currentSettings = window.SettingsManager?.getCurrentSettings?.();
    if (currentSettings) {
        const directionSetting = isTextGradient ? currentSettings.animationDirection : currentSettings.bgGradientDirection;
        if (directionSetting !== undefined && directionSetting !== null) {
            const angle = `${directionSetting}deg`;
             console.log(`[Style Capture Grad] Using ${elementType} direction from SettingsManager: ${angle}`);
            return angle;
        }
    } else {
        console.log(`[Style Capture Grad] SettingsManager not available for direction.`);
    }

    // --- Try Parsing Computed Style ---
    if (backgroundImage && typeof backgroundImage === 'string' && backgroundImage.includes('gradient')) {
        const directionRegex = /linear-gradient\(\s*([^,]+),/i;
        const match = backgroundImage.match(directionRegex);
        if (match && match[1]) {
            const directionPart = match[1].trim();
            if (directionPart.startsWith('to ') || directionPart.endsWith('deg') || directionPart.endsWith('turn')) {
                console.log(`[Style Capture Grad] Extracted ${elementType} direction from CSS: ${directionPart}`);
                return directionPart.endsWith('deg') ? directionPart : `${parseFloat(directionPart)}deg`;
            }
        }
    }

     // --- Fallback to CSS Variable ---
    const cssVarName = isTextGradient ? '--gradient-direction' : '--bg-gradient-direction';
    const directionFromVar = getRootCSSVariable(cssVarName);
    if (directionFromVar) {
         console.log(`[Style Capture Grad] Using ${elementType} direction from CSS var ${cssVarName}: ${directionFromVar}`);
         return directionFromVar;
    }

    console.log(`[Style Capture Grad] Could not extract ${elementType} direction, defaulting to ${defaultAngle}.`);
    return defaultAngle;
}

/** Extract keyframes CSS text */
function extractKeyframesCSS(animationName) {
    if (!animationName || typeof animationName !== 'string') return null;
    console.log(`[Style Capture Keyframes] Extracting for: ${animationName}`);

    // --- 1. Try window.getActiveAnimationKeyframes ---
    if (typeof window.getActiveAnimationKeyframes === 'function') {
        try {
            const keyframesFromWindow = window.getActiveAnimationKeyframes(animationName);
            if (keyframesFromWindow) {
                 console.log(`[Style Capture Keyframes] Found via window.getActiveAnimationKeyframes.`);
                return keyframesFromWindow;
            }
        } catch (e) { console.warn(`[Style Capture Keyframes] Error calling window.getActiveAnimationKeyframes:`, e); }
    }

    // --- 2. Try Parsing Stylesheets ---
    try {
        for (const sheet of document.styleSheets) {
             if (sheet.disabled) continue;
             let rules;
             try { rules = sheet.cssRules || sheet.rules; if (!rules) continue; }
             catch (e) { continue; /* Skip inaccessible sheets */ }

             for (const rule of rules) {
                 const isKeyframesRule = (CSSRule.KEYFRAMES_RULE && rule.type === CSSRule.KEYFRAMES_RULE) || rule.type === 7;
                 if (isKeyframesRule && rule.name === animationName) {
                      console.log(`[Style Capture Keyframes] Found in stylesheet ${sheet.href || 'inline'}.`);
                     return rule.cssText;
                 }
             }
        }
    } catch (e) { console.warn(`[Style Capture Keyframes] Error parsing stylesheets:`, e); }
     console.log(`[Style Capture Keyframes] Did not find '${animationName}' via parsing.`);

    // --- 3. Hardcoded Fallbacks (should match effects.css) ---
    const FALLBACK_KEYFRAMES = {
       'pulse': `@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.9; } }`,
       'bounce': `@keyframes bounce { 0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.5, 0, 0.5, 1); } 50% { transform: translateY(-15px); animation-timing-function: cubic-bezier(0.5, 0, 0.5, 1); } }`,
       'shake': `@keyframes shake { 0%,100%{transform:translateX(0)} 10%,30%,50%,70%,90%{transform:translateX(-4px) rotate(-0.5deg)} 20%,40%,60%,80%{transform:translateX(4px) rotate(0.5deg)} }`,
       'float': `@keyframes float { 0%,100%{transform:translateY(0) rotate(-1deg)} 50% {transform:translateY(-15px) rotate(1deg)} }`,
       'rotate': `@keyframes rotate { 0% {transform:rotate(0deg)} 100% {transform:rotate(360deg)} }`,
       'wave': `@keyframes wave { 0%,100%{transform:skewX(0) skewY(0)} 25%{transform:skewX(5deg) skewY(1deg)} 75%{transform:skewX(-5deg) skewY(-1deg)} }`,
       'glitch': `@keyframes glitch { 0%,100%{clip-path:inset(50% 0 30% 0);transform:translate(-4px,1px) scaleY(1.02)} 20%{clip-path:inset(10% 0 80% 0);transform:translate(3px,-2px) scaleY(0.98)} 40%{clip-path:inset(70% 0 5% 0);transform:translate(-3px,2px) scaleY(1.01)} 60%{clip-path:inset(45% 0 45% 0);transform:translate(4px,-1px) scaleY(0.99)} 80%{clip-path:inset(85% 0 10% 0);transform:translate(-2px,1px) scaleY(1.03)} }`,
       'glitch-2': `@keyframes glitch-2 { 0%,100%{clip-path:inset(40% 0 50% 0);transform:translate(3px,-1px) scaleY(0.98)} 20%{clip-path:inset(90% 0 5% 0);transform:translate(-4px,2px) scaleY(1.02)} 40%{clip-path:inset(15% 0 70% 0);transform:translate(2px,-2px) scaleY(0.99)} 60%{clip-path:inset(60% 0 30% 0);transform:translate(-3px,1px) scaleY(1.01)} 80%{clip-path:inset(5% 0 80% 0);transform:translate(3px,-1px) scaleY(1.03)} }`,
       'fadeInOut': `@keyframes fadeInOut { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`,
       'subtleRotate3D': `@keyframes subtleRotate3D { 0%, 100% { transform: perspective(500px) rotateX(0deg) rotateY(0deg);,
       } 50% { transform: perspective(500px) rotateX(8deg) rotateY(12deg) translateZ(10px); } }`,
       'flicker': `@keyframes flicker { 0%, 18%, 22%, 25%, 53%, 57%, 100% { opacity: 1; text-shadow: inherit; } 20%, 24%, 55% { opacity: 0.6; text-shadow: none; } }`,
       'typing': `@keyframes typing { from { width: 0; } to { width: 100%; } }`,
       'caretBlink': `@keyframes caretBlink { 50% { border-color: transparent; } }`,
       'textRevealClip': `@keyframes textRevealClip { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }`,
       'blurInOut': `@keyframes blurInOut { 0%, 100% { filter: blur(5px); opacity: 0; } 50% { filter: blur(0); opacity: 1; } }`,
       'zoomInOut': `@keyframes zoomInOut { 0%, 100% { transform: scale(0.8); opacity: 0; } 50% { transform: scale(1); opacity: 1; } }`
    };
    
    if (FALLBACK_KEYFRAMES[animationName]) {
         console.log(`[Style Capture Keyframes] Using hardcoded fallback for ${animationName}.`);
         // Ensure the name in the fallback matches the requested name
         return FALLBACK_KEYFRAMES[animationName].replace(/@keyframes\s+\w+/, `@keyframes ${animationName}`);
    }

    console.warn(`[Style Capture Keyframes] No keyframes found or generated for animation: ${animationName}.`);
    return null;
}

// Make the main function globally accessible if not using ES modules
if (typeof window !== 'undefined') {
    window.captureAdvancedStyles = captureAdvancedStyles;
}