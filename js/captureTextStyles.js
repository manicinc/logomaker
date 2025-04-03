/**
 * captureTextStyles.js
 * Captures computed styles and relevant settings from the preview container.
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


function captureAdvancedStyles() {
  console.log("[Style Capture] Starting advanced style capture...");
  
  // Find the necessary DOM elements
  const logoContainer = document.querySelector('.logo-container');
  const logoText = document.querySelector('.logo-text');
  
  if (!logoContainer || !logoText) {
      console.error("[Style Capture] Failed to find logo elements in DOM");
      return null;
  }
  
  // Get computed styles
  const containerStyle = window.getComputedStyle(logoContainer);
  const textStyle = window.getComputedStyle(logoText);
  
  // Get current settings
  const currentSettings = window.SettingsManager?.getCurrentSettings?.() || {};
  
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
      }
  };
  
  // Handle text alignment
  const textAlign = textStyle.textAlign.trim();
  if (textAlign) {
      // Map CSS text-align to SVG text-anchor
      if (textAlign === 'left') styles.textAnchor = 'start';
      else if (textAlign === 'right') styles.textAnchor = 'end';
      else styles.textAnchor = 'middle'; // Default/center
      
      styles.textAlign = textAlign;
  }
  
  // Background styles
  styles.background = {
      type: extractBackgroundType(logoContainer),
      color: containerStyle.backgroundColor || 'transparent',
      opacity: containerStyle.opacity || '1'
  };
  
  // Check for gradient background
  if (containerStyle.backgroundImage && containerStyle.backgroundImage.includes('gradient')) {
      styles.background.gradient = {
          colors: extractGradientColors(logoContainer),
          direction: extractGradientAngle(containerStyle.backgroundImage)
      };
  }
  
  // Text Fill Style (Solid vs Gradient)
  if (textStyle.backgroundClip === 'text' || textStyle.webkitBackgroundClip === 'text') {
      styles.color.mode = 'gradient';
      styles.color.gradient = {
          colors: extractGradientColors(logoText),
          direction: extractGradientAngle(textStyle.backgroundImage)
      };
  } else {
      styles.color.value = textStyle.color;
  }
  
  // Border/Stroke styles
  if (textStyle.textStroke || textStyle.webkitTextStroke || textStyle.textStrokeWidth) {
      styles.border = {
          style: 'solid', // Default if any stroke exists
          color: textStyle.textStrokeColor || textStyle.webkitTextStrokeColor || textStyle.color,
          width: textStyle.textStrokeWidth || textStyle.webkitTextStrokeWidth || '1px'
      };
  } else if (containerStyle.borderStyle && containerStyle.borderStyle !== 'none') {
      styles.border = {
          style: containerStyle.borderStyle,
          color: containerStyle.borderColor || '#000',
          width: containerStyle.borderWidth || '1px'
      };
      
      // Check for dashed/dotted border to set dash array
      if (containerStyle.borderStyle === 'dashed') {
          styles.border.dasharray = '6, 4'; // Default dash pattern
      } else if (containerStyle.borderStyle === 'dotted') {
          styles.border.dasharray = '2, 2'; // Default dot pattern
      }
  }
  
  // Transform (matrix, rotate, etc.)
  if (textStyle.transform && textStyle.transform !== 'none') {
      styles.transform = {
          cssValue: textStyle.transform 
      };
  }
  
  // Animation
  const activeAnimation = document.getElementById('textAnimation')?.value || 'anim-none';
  if (activeAnimation && activeAnimation !== 'anim-none') {
      const animationName = activeAnimation.replace('anim-', '');
      const animDuration = getRootCSSVariable('--animation-duration') || '2s';
      
      styles.animation = {
          class: activeAnimation,
          type: animationName,
          duration: animDuration,
          timingFunction: 'ease', // Default, could be extracted from CSS
          iterationCount: 'infinite',
          activeKeyframes: extractKeyframesCSS(animationName)
      };
      
      // Convert duration to milliseconds for calculations
      styles.animation.durationMs = parseAnimationDuration(animDuration);
  }
  
  console.log("[Style Capture] Style capture complete:", styles);
  return styles;
}

/**
* Helper Functions
*/

// Extract background type (solid, gradient, pattern)
function extractBackgroundType(element) {
  // Get the type from the class list if using class-based styling
  const classList = Array.from(element.classList);
  for (const cls of classList) {
      if (cls.startsWith('bg-')) return cls;
  }
  
  // Check background image
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.backgroundImage && computedStyle.backgroundImage !== 'none') {
      if (computedStyle.backgroundImage.includes('gradient')) {
          return 'bg-gradient';
      }
      return 'bg-pattern'; // Generic pattern type
  }
  
  return 'bg-solid'; // Default
}

// Extract colors from gradient - FIXED FUNCTION
function extractGradientColors(element) {
    const computedStyle = window.getComputedStyle(element);
    let backgroundImage = computedStyle.backgroundImage;
    
    if (!backgroundImage || !backgroundImage.includes('gradient')) {
        return [];
    }
    
    // More robust color extraction regex for all color formats
    const colorRegex = /#[0-9a-f]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;
    const colors = backgroundImage.match(colorRegex) || [];
    
    // If we couldn't extract with regex or have weird results, try CSS variables
    if (colors.length === 0 || colors.some(c => c.includes('var('))) {
        // Check root CSS variables for gradient colors
        const rootStyle = getComputedStyle(document.documentElement);
        const gradientColors = [];
        
        // Try to get colors from settings manager first
        const currentSettings = window.SettingsManager?.getCurrentSettings?.() || {};
        if (currentSettings.textColorMode === 'gradient') {
            if (currentSettings.gradientPreset === 'custom') {
                // Use custom colors from settings
                gradientColors.push(currentSettings.color1 || '#FF1493');
                gradientColors.push(currentSettings.color2 || '#8A2BE2');
                if (currentSettings.useColor3) {
                    gradientColors.push(currentSettings.color3 || '#FF4500');
                }
            } else {
                // Try to get colors from CSS variable
                const presetVar = `--${currentSettings.gradientPreset}`;
                const presetValue = rootStyle.getPropertyValue(presetVar).trim();
                
                // Extract colors from the preset variable
                const presetColors = presetValue.match(colorRegex) || [];
                if (presetColors.length > 0) {
                    return presetColors.map(c => c.trim());
                }
            }
        }
        
        // Fallback to generic gradient colors if needed
        if (gradientColors.length === 0) {
            for (let i = 1; i <= 3; i++) {
                const colorVar = rootStyle.getPropertyValue(`--gradient-color-${i}`).trim();
                if (colorVar) gradientColors.push(colorVar);
            }
        }
        
        if (gradientColors.length > 0) {
            return gradientColors;
        }
        
        // Final fallback
        return ['#FF1493', '#8A2BE2'];
    }
    
    return colors.map(color => color.trim());
  }

// Extract gradient angle
function extractGradientAngle(backgroundImage) {
  if (!backgroundImage || !backgroundImage.includes('gradient')) {
      return '90deg'; // Default horizontal
  }
  
  // Extract angle from linear-gradient string
  const angleRegex = /linear-gradient\(\s*([^,]+)/;
  const match = backgroundImage.match(angleRegex);
  
  if (match && match[1]) {
      const angle = match[1].trim();
      // If it's a named direction (to top, to bottom, etc.) convert to degrees
      if (angle.startsWith('to ')) {
          switch (angle) {
              case 'to right': return '90deg';
              case 'to bottom': return '180deg';
              case 'to left': return '270deg';
              case 'to top': return '0deg';
              case 'to top right': return '45deg';
              case 'to bottom right': return '135deg';
              case 'to bottom left': return '225deg';
              case 'to top left': return '315deg';
              default: return '90deg';
          }
      }
      
      // If it's already in degrees, just return it
      if (angle.includes('deg')) {
          return angle;
      }
  }
  
  return '90deg'; // Default
}

// Get CSS variable from root element
function getRootCSSVariable(varName) {
  const rootStyle = getComputedStyle(document.documentElement);
  return rootStyle.getPropertyValue(varName).trim();
}

// Extract keyframes CSS for an animation
function extractKeyframesCSS(animationName) {
  // Check for animation name or variant (some animations use -1, -2 suffixes)
  for (let i = 0; i < document.styleSheets.length; i++) {
      try {
          const sheet = document.styleSheets[i];
          const rules = sheet.cssRules || sheet.rules;
          
          for (let j = 0; j < rules.length; j++) {
              const rule = rules[j];
              if (rule.type === CSSRule.KEYFRAMES_RULE) {
                  // Check for exact name or name-1 naming pattern
                  if (rule.name === animationName || 
                      rule.name === `${animationName}-1`) {
                      return rule.cssText;
                  }
              }
          }
      } catch (e) {
          // Security errors happen when accessing cross-origin stylesheets
          console.warn(`[Style Capture] Error accessing stylesheet ${i}:`, e);
      }
  }
  
  return null;
}

// Parse animation duration into milliseconds
function parseAnimationDuration(duration) {
  if (!duration) return 0;
  
  // Convert to milliseconds
  if (duration.endsWith('ms')) {
      return parseFloat(duration);
  } else if (duration.endsWith('s')) {
      return parseFloat(duration) * 1000;
  }
  
  // Default if no unit
  return parseFloat(duration) || 0;
}

// Deprecate or remove older capture functions if captureAdvancedStyles is sufficient
export function getFinalTextStyles(container) {
    console.warn("[CaptureStyles] getFinalTextStyles is deprecated. Use captureAdvancedStyles.");
    return captureAdvancedStyles(container);
}

// Main export
export { captureAdvancedStyles };