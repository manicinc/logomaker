/**
 * captureTextStyles.js
 * Captures computed styles and relevant settings from the preview container.
 * Focuses on captureAdvancedStyles with added logging to diagnose discrepancies.
 */

console.log("[CaptureStyles v11] Module loaded. Extensive logging enabled.");

/**
 * Helper: Get the primary font family name, removing quotes.
 * @param {string} fontFamilyString - The CSS font-family string.
 * @returns {string} The primary font family name or a fallback.
 */
function getPrimaryFontFamily(fontFamilyString) {
    if (!fontFamilyString || typeof fontFamilyString !== 'string') return 'sans-serif';
    return fontFamilyString.split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'sans-serif';
}

/**
 * Helper: Apply text transformation based on CSS style.
 * @param {HTMLElement} element - The text element.
 * @param {string} transformStyle - The text-transform CSS value.
 * @returns {string} The transformed text content.
 */
function getTransformedTextContent(element, transformStyle) {
    const txt = element?.textContent || '';
    if (!txt) return '';
    switch (transformStyle?.toLowerCase()) {
        case 'uppercase': return txt.toUpperCase();
        case 'lowercase': return txt.toLowerCase();
        case 'capitalize': return txt.replace(/\b\w/g, c => c.toUpperCase());
        default: return txt;
    }
}

/**
 * Helper: Get SVG dasharray string based on border style and width.
 * @param {string} borderStyle - The CSS border-style value (e.g., 'dashed', 'dotted').
 * @param {string} borderWidth - The CSS border-width value (e.g., '2px').
 * @returns {string | null} The dasharray string or null.
 */
function getStrokeDasharray(borderStyle, borderWidth) {
    const w = parseFloat(borderWidth) || 1;
    switch (borderStyle?.toLowerCase()) {
        case 'dashed': return `${w * 3}, ${w * 2}`;
        case 'dotted': return `${w}, ${w * 2}`;
        // Other complex styles (double, groove, ridge, inset, outset)
        // are not directly representable as simple SVG strokes/dasharrays.
        // They would require multiple SVG elements or filters for accurate representation.
        default: return null; // Solid or none
    }
}

/**
 * Helper: Extract color stops from a CSS linear-gradient string.
 * @param {string} gradientString - The CSS gradient string.
 * @returns {Array<string>} An array of extracted color strings (hex, rgba).
 */
function extractGradientColors(gradientString) {
    if (!gradientString || typeof gradientString !== 'string') return [];
    // Regex to find hex codes (#rgb, #rrggbb, #rrggbbaa) or rgb/rgba values
    const colorRegex = /#[0-9a-f]{3,8}|rgba?\([\d.\s%,\/]+\)/gi;
    return gradientString.match(colorRegex) || [];
}

/**
 * Helper: Attempts to retrieve the base64 encoded font data for the selected font/weight/style.
 * @param {string} familyName - The target font family name.
 * @param {string|number} targetWeight - The target font weight.
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
            console.warn(`[CaptureStyles] No variants found for font: ${familyName}`);
            return null;
        }

        // Normalize target weight/style
        targetWeight = String(targetWeight);
        targetStyle = targetStyle.toLowerCase();

        // Find best match (prioritize exact match, then weight, then base normal, then any)
        let bestMatch =
            fontData.variants.find(v => v?.file?.startsWith('data:') && String(v.weight || 400) === targetWeight && (v.style || 'normal').toLowerCase() === targetStyle) ||
            fontData.variants.find(v => v?.file?.startsWith('data:') && String(v.weight || 400) === targetWeight) ||
            fontData.variants.find(v => v?.file?.startsWith('data:') && String(v.weight || 400) === '400' && (v.style || 'normal').toLowerCase() === 'normal') ||
            fontData.variants.find(v => v?.file?.startsWith('data:'));

        if (bestMatch?.file) {
            console.log(`[CaptureStyles] Found embeddable variant for ${familyName}: weight=${bestMatch.weight}, style=${bestMatch.style}`);
            return {
                file: bestMatch.file,
                format: bestMatch.format || 'woff2', // Assume woff2 if format missing
                weight: bestMatch.weight || 400,
                style: bestMatch.style || 'normal'
            };
        } else {
            console.warn(`[CaptureStyles] No embeddable (base64) variant found for ${familyName} matching weight ${targetWeight}, style ${targetStyle}.`);
            return null;
        }
    } catch (e) {
        console.error(`[CaptureStyles] Error getting font embed data for ${familyName}:`, e);
        return null;
    }
}

/**
 * Helper: Analyze text effect class or text-shadow to provide structured effect data.
 * @param {string|null} effectClass - The applied text-glow-* class name.
 * @param {string|null} textShadowCss - The computed text-shadow CSS value.
 * @param {string} effectColor - The color from the --dynamic-border-color variable.
 * @returns {object|null} Object with { type: 'glow'|'shadow', color, blur, dx, dy, opacity, filterId } or null.
 */
function getEffectDetails(effectClass, textShadowCss, effectColor) {
    const details = { type: null, color: effectColor || '#ffffff', blur: 0, dx: 0, dy: 0, opacity: 0.7, filterId: 'svgTextEffect' }; // Consistent ID

    if (effectClass && effectClass !== 'text-glow-none') {
        details.type = 'glow'; // Assume glow if class is present
        details.opacity = 0.8; // Default glow opacity
        if (effectClass.includes('soft')) { details.blur = 5; }
        else if (effectClass.includes('medium')) { details.blur = 8; }
        else if (effectClass.includes('sharp')) { details.blur = 1; details.opacity = 1; }
        else if (effectClass.includes('hard')) { // Hard shadow using class
             details.type = 'shadow'; details.blur = 0; details.dx = 2; details.dy = 2; details.opacity = 1;
             console.log(`[CaptureStyles] Detected Hard Shadow via class: ${effectClass}`);
        }
        else if (effectClass.includes('neon')) { details.blur = 10; }
        else if (effectClass.includes('outline')) {
            // Outline via text-shadow doesn't directly translate to a single SVG filter easily.
            // It's better handled by SVG stroke. Indicate no filter needed for this class.
            console.log(`[CaptureStyles] Outline effect detected via class (${effectClass}), will use SVG stroke instead of filter.`);
            return null; // Let stroke handle it
        }
        else if (effectClass.includes('emboss') || effectClass.includes('inset')) {
            // Emboss/Inset are complex, basic shadow filter is a poor approximation.
            // Might need a more complex SVG filter or skip filter application.
             console.warn(`[CaptureStyles] Emboss/Inset (${effectClass}) detected, filter approximation might be inaccurate.`);
             details.type = 'shadow'; // Basic approximation
             details.blur = 1; details.dx = effectClass.includes('inset') ? -1 : 1; details.dy = effectClass.includes('inset') ? -1 : 1;
             // Could add a second feDropShadow for the highlight effect if desired.
        }
        else if (effectClass.includes('retro')) {
            // Retro shadow: Multiple shadows, complex filter needed or maybe skip?
            console.warn(`[CaptureStyles] Retro effect (${effectClass}) detected, complex filter required or skip.`);
            // For simplicity, let's just apply the first shadow layer as a basic approximation
            details.type = 'shadow'; details.blur = 0; details.dx = 3; details.dy = 3; details.opacity = 1;
            details.color = getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim() || details.color; // Use secondary color if possible
        }
         else { details.blur = 3; } // Default blur for unknown glows

        console.log(`[CaptureStyles] Effect details from class '${effectClass}':`, details);
        return details;

    } else if (textShadowCss && textShadowCss !== 'none') {
        // Attempt to parse computed text-shadow (less reliable for complex shadows)
        // Example: "rgb(255, 255, 255) 2px 2px 0px" or "2px 2px 5px rgba(0, 0, 0, 0.5)"
        console.log(`[CaptureStyles] Parsing computed text-shadow: ${textShadowCss}`);
        // Simplistic parsing: find first color, offsets, blur
        const shadowParts = textShadowCss.split(/(?<!rgba?\(.*)\s+(?!.*\))/); // Split by spaces not inside rgba()
        const colorMatch = textShadowCss.match(/#[0-9a-f]{3,8}|rgba?\([\d.\s%,\/]+\)/i);
        const numbers = textShadowCss.match(/-?\d+(\.\d+)?px/g) || []; // Find pixel values

        details.type = 'shadow';
        details.color = colorMatch ? colorMatch[0] : details.color; // Use found color
        details.dx = parseFloat(numbers[0]) || 0;
        details.dy = parseFloat(numbers[1]) || 0;
        details.blur = parseFloat(numbers[2]) || 0; // Blur is often the third number
        details.opacity = 1; // Assume full opacity for parsed shadows unless rgba specifies otherwise

        if(details.color.startsWith('rgba')){
            try{ details.opacity = parseFloat(details.color.split(',')[3]); } catch(e){}
        }

        // If blur is 0 and offsets exist, it's likely a hard shadow
        if (details.blur === 0 && (details.dx !== 0 || details.dy !== 0)) {
            console.log(`[CaptureStyles] Interpreted computed text-shadow as Hard Shadow.`);
        }

        console.log(`[CaptureStyles] Effect details from computed shadow:`, details);
        return details;
    }

    console.log('[CaptureStyles] No applicable text effect/shadow found.');
    return null; // No effect detected
}



/**
 * Captures comprehensive style information with detailed logging.
 * @param {HTMLElement} [container=document.getElementById('previewContainer')] - The container element.
 * @returns {object|null} An object containing captured styles, or null if critical elements are missing.
 */
export function captureAdvancedStyles(container = null) {
  console.log('[CaptureStyles Debug] ------------- Starting Style Capture -------------');
  container = container || document.getElementById('previewContainer');
  if (!container) { console.error('🚨 [CaptureStyles Debug] CONTAINER NOT FOUND!'); return null; }

  const logoText = container.querySelector('.logo-text');
  const borderElement = container.querySelector('.logo-container.dynamic-border') || container.querySelector('.logo-container') || logoText;
  const previewContainerElement = document.getElementById('previewContainer');

  if (!logoText) { console.error('🚨 [CaptureStyles Debug] LOGO TEXT ELEMENT (.logo-text) NOT FOUND!'); return null; }
  if (!borderElement) { console.warn('[CaptureStyles Debug] Border target element (.logo-container or .logo-text) not found.'); }
  if (!previewContainerElement) { console.error('🚨 [CaptureStyles Debug] PREVIEW CONTAINER (#previewContainer) NOT FOUND!'); return null; }
  console.log('[CaptureStyles Debug] Found elements:', { logoText, borderElement, previewContainerElement });


  // --- Get Computed Styles & Settings ---
  let computedLogo, computedBorder, computedContainer, rootComputedStyle, settings;
  try {
      computedLogo = window.getComputedStyle(logoText);
      computedBorder = borderElement ? window.getComputedStyle(borderElement) : null;
      computedContainer = window.getComputedStyle(previewContainerElement);
      rootComputedStyle = window.getComputedStyle(document.documentElement);
      settings = window.SettingsManager?.getCurrentSettings?.() || {};
      console.log('[CaptureStyles Debug] Successfully retrieved computed styles and settings.');
      // Log a few key computed styles immediately
      console.log(`[CaptureStyles Debug] Raw Computed Logo: font-family='${computedLogo.fontFamily}', color='${computedLogo.color}', animation-name='${computedLogo.animationName}', text-shadow='${computedLogo.textShadow}'`);
      console.log(`[CaptureStyles Debug] Raw Computed Container BG Color: '${computedContainer.backgroundColor}', BG Image: '${computedContainer.backgroundImage}'`);
      console.log('[CaptureStyles Debug] SettingsManager state:', JSON.stringify(settings));
  } catch (e) {
      console.error("🚨 [CaptureStyles Debug] Error getting computed styles or settings:", e);
      return null;
  }

  // --- Prepare Styles Object ---
  const styles = {
      source: 'captureAdvancedStyles_v11_Debug',
      timestamp: Date.now()
  };

  // --- Text Content & Transformation ---
  try {
      styles.textContent = {
          raw: logoText.textContent,
          transformCSS: computedLogo.textTransform,
          finalText: getTransformedTextContent(logoText, computedLogo.textTransform)
      };
      console.log('[CaptureStyles Debug] Text Content:', styles.textContent);
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing textContent:', e); }

  // --- Font ---
  try {
      const rawFontFamily = computedLogo.fontFamily;
      const primaryFontFamily = getPrimaryFontFamily(rawFontFamily);
      const fontWeight = computedLogo.fontWeight;
      const fontStyle = computedLogo.fontStyle;
      styles.font = {
          family: primaryFontFamily,
          size: computedLogo.fontSize,
          weight: fontWeight,
          style: fontStyle,
          letterSpacing: computedLogo.letterSpacing === 'normal' ? '0px' : computedLogo.letterSpacing,
          embedData: null // Default to null
      };
      console.log(`[CaptureStyles Debug] Font Info: Computed Family='${rawFontFamily}', Primary='${primaryFontFamily}', Weight='${fontWeight}', Size='${styles.font.size}'`);
      styles.font.embedData = getFontEmbedData(primaryFontFamily, fontWeight, fontStyle);
      console.log('[CaptureStyles Debug] Font Embed Data:', styles.font.embedData ? 'Found' : 'Not Found/Embeddable');
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing font:', e); }

  // --- Text Alignment & Decoration ---
  try {
      styles.textAnchor = computedLogo.textAlign === 'left' ? 'start' : (computedLogo.textAlign === 'right' ? 'end' : 'middle');
      styles.dominantBaseline = 'middle';
      styles.textDecoration = computedLogo.textDecorationLine === 'none' ? null : computedLogo.textDecoration;
      console.log(`[CaptureStyles Debug] Text Align: Anchor='${styles.textAnchor}', Baseline='${styles.dominantBaseline}', Deco='${styles.textDecoration}'`);
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing text alignment/decoration:', e); }

  // --- Color / Fill ---
  try {
      const isGradientModeSetting = settings.textColorMode === 'gradient';
      // Check computed styles for gradient clues (less reliable than setting)
      const computedColor = computedLogo.color;
      const computedBGImage = computedLogo.backgroundImage;
      const isColorTransparent = computedColor === 'transparent' || computedColor === 'rgba(0, 0, 0, 0)';
      const hasComputedGradient = computedBGImage && computedBGImage.startsWith('linear-gradient');

      // Prioritize setting, but log computed values
      console.log(`[CaptureStyles Debug] Color Info: SettingMode='${settings.textColorMode}', ComputedColor='${computedColor}', ComputedBGImage='${computedBGImage}', IsComputedColorTransparent=${isColorTransparent}`);

      styles.color = {
          mode: isGradientModeSetting ? 'gradient' : 'solid',
          value: computedColor, // Store computed color regardless of mode
          gradient: {
              preset: settings.gradientPreset,
              isCustom: settings.gradientPreset === 'custom',
              colors: [
                  settings.color1 || '#FF1493',
                  settings.color2 || '#8A2BE2',
                  ...(settings.useColor3 ? [settings.color3 || '#FF4500'] : [])
              ],
              direction: settings.animationDirection || '45',
              computedBackgroundImage: hasComputedGradient ? computedBGImage : null
          }
      };
      console.log('[CaptureStyles Debug] Final Color Object:', styles.color);
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing color:', e); }


  // --- Effects (Shadow/Glow) ---
  try {
      const effectClass = Array.from(logoText.classList).find(c => c.startsWith('text-glow-') && c !== 'text-glow-none');
      const textShadowCss = computedLogo.textShadow;
      const effectColor = rootComputedStyle.getPropertyValue('--dynamic-border-color').trim() || settings.borderColorPicker || '#ffffff';
      console.log(`[CaptureStyles Debug] Effects Info: Class='${effectClass}', ComputedShadow='${textShadowCss}', EffectColor='${effectColor}'`);
      styles.effects = getEffectDetails(effectClass, textShadowCss, effectColor) || { type: 'none' };
      styles.effects.rawTextShadow = textShadowCss; // Keep raw value
      console.log('[CaptureStyles Debug] Final Effects Object:', styles.effects);
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing effects:', e); }


  // --- Border ---
  try {
      const borderClass = computedBorder ? Array.from(borderElement.classList).find(c => c.startsWith('border-') && c !== 'border-none') : null;
      const borderStyle = computedBorder?.borderTopStyle;
      const borderWidth = computedBorder?.borderTopWidth;
      const borderColor = rootComputedStyle.getPropertyValue('--dynamic-border-color').trim() || settings.borderColorPicker || '#ffffff'; // Use same color as effects

      console.log(`[CaptureStyles Debug] Border Info: Target='${borderElement?.tagName}', Class='${borderClass}', ComputedStyle='${borderStyle}', ComputedWidth='${borderWidth}', Color='${borderColor}'`);

      styles.border = {
          appliedTo: borderElement?.tagName || 'N/A',
          class: borderClass || 'border-none',
          style: (borderStyle && borderStyle !== 'none') ? borderStyle : 'none',
          width: (borderStyle && borderStyle !== 'none') ? borderWidth : '0px',
          color: borderColor,
          dasharray: null
      };
      if (styles.border.style !== 'none') {
          styles.border.dasharray = getStrokeDasharray(styles.border.style, styles.border.width);
      }
      console.log('[CaptureStyles Debug] Final Border Object:', styles.border);
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing border:', e); }


  // --- Transform ---
  try {
      const transformCss = computedLogo.transform;
      styles.transform = {
          cssValue: transformCss !== 'none' ? transformCss : null,
          rotationSetting: settings.rotation || '0'
      };
      console.log(`[CaptureStyles Debug] Transform Info: Computed='${transformCss}', RotationSetting='${settings.rotation}'`);
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing transform:', e); }


  // --- Animation ---
  try {
      const animClass = Array.from(logoText.classList).find(c => c.startsWith('anim-') && c !== 'anim-none');
      const computedName = computedLogo.animationName;
      const computedDuration = computedLogo.animationDuration;
      const computedTiming = computedLogo.animationTimingFunction;
      const computedIteration = computedLogo.animationIterationCount;
      const effectiveAnimName = animClass ? animClass.replace('anim-', '') : (computedName !== 'none' ? computedName : null);
      let durationMs = 2000; // Default
       try {
           if (computedDuration.endsWith('ms')) { durationMs = parseFloat(computedDuration); }
           else if (computedDuration.endsWith('s')) { durationMs = parseFloat(computedDuration) * 1000; }
       } catch(e){}

      console.log(`[CaptureStyles Debug] Animation Info: Class='${animClass}', ComputedName='${computedName}', Duration='${computedDuration}', Timing='${computedTiming}', Iteration='${computedIteration}'`);

      styles.animation = {
          class: animClass || null,
          name: effectiveAnimName,
          duration: computedDuration || '2s',
          timingFunction: computedTiming || 'linear',
          iterationCount: computedIteration || 'infinite',
          durationMs: durationMs,
          activeKeyframes: null // Default null, try to get below
      };
      if (effectiveAnimName && typeof window.getActiveAnimationKeyframes === 'function') {
          styles.animation.activeKeyframes = window.getActiveAnimationKeyframes(effectiveAnimName);
          console.log(`[CaptureStyles Debug] Animation Keyframes for '${effectiveAnimName}': ${styles.animation.activeKeyframes ? 'Found' : 'NOT Found/Fallback Used'}`);
      } else if (effectiveAnimName) {
           console.warn('[CaptureStyles Debug] getActiveAnimationKeyframes function not found on window.');
      }
      console.log('[CaptureStyles Debug] Final Animation Object:', styles.animation);
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing animation:', e); }


  // --- Background ---
  try {
      const bgClass = Array.from(previewContainerElement.classList).find(cls => cls.startsWith('bg-')) || 'bg-solid';
      const bgColor = computedContainer.backgroundColor;
      const bgImage = computedContainer.backgroundImage;
      const bgOpacity = computedContainer.opacity;
      console.log(`[CaptureStyles Debug] Background Info: Class='${bgClass}', ComputedColor='${bgColor}', ComputedImage='${bgImage}', Opacity='${bgOpacity}'`);
      styles.background = {
          type: bgClass,
          color: bgColor,
          image: bgImage !== 'none' ? bgImage : null,
          opacity: bgOpacity || '1',
          // Include gradient settings for reconstruction if needed
          gradient: {
               preset: settings.backgroundGradientPreset,
               isCustom: settings.backgroundGradientPreset === 'custom',
               colors: [settings.bgColor1 || '#3a1c71', settings.bgColor2 || '#ffaf7b'],
               direction: settings.bgGradientDirection || '90'
          }
      };
       console.log('[CaptureStyles Debug] Final Background Object:', styles.background);
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing background:', e); }


  // --- Export Configuration ---
  try {
      styles.exportConfig = {
          width: parseInt(settings.exportWidth) || 800,
          height: parseInt(settings.exportHeight) || 400,
          quality: parseInt(settings.exportQuality) || 95,
          transparent: !!settings.exportTransparent,
          frames: parseInt(settings.exportFrames) || 15,
          frameRate: parseInt(settings.exportFrameRate) || 10,
      };
      console.log('[CaptureStyles Debug] Final Export Config:', styles.exportConfig);
  } catch (e) { console.error('[CaptureStyles Debug] Error capturing export config:', e); }


  console.log('[CaptureStyles Debug] ------------- Finished Style Capture ------------- FINAL OBJECT:', styles);
  return styles;
}

// Deprecate or remove older capture functions if captureAdvancedStyles is sufficient
export function getFinalTextStyles(container) {
    console.warn("[CaptureStyles] getFinalTextStyles is deprecated. Use captureAdvancedStyles.");
    return captureAdvancedStyles(container);
}

// Main export
// export { captureAdvancedStyles };