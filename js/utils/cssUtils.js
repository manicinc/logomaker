/**
 * cssUtils.js (v3.0 - Combined Utilities)
 * ==============================================
 * Unified utility for CSS variable handling, style application/calculation,
 * color normalization, and complex style extraction for renderers.
 */

console.log("[CSSUtils v3.0 - Combined] Loading...");

(function(window) {
    'use strict';

    // --- Basic Variable Handling ---

    function getCSSVariable(varName, defaultValue = '') {
        if (!varName || typeof varName !== 'string') return defaultValue;
        if (!varName.startsWith('--')) { varName = `--${varName}`; }
        try {
            const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            return val || defaultValue;
        } catch (e) {
            // console.warn(`[CSSUtils] Error getting CSS variable ${varName}:`, e.message);
            return defaultValue;
        }
    }

    function setCSSVariable(varName, value) {
        if (!varName || typeof varName !== 'string') return;
        if (!varName.startsWith('--')) { varName = `--${varName}`; }
        try {
             document.documentElement.style.setProperty(varName, value);
        } catch (e) {
             console.error(`[CSSUtils] Error setting CSS variable ${varName}:`, e.message);
        }
    }

  /**
   * Extracts the border style info from an element's computed style,
   * plus checks for any dynamic-border CSS variables if present.
   * @param {HTMLElement} element
   * @returns {object} { borderColor, borderStyle, borderWidth, borderRadius, padding }
   */
  function getBorderStyles(element) {
    if (!element) return {};
    const computed = window.getComputedStyle(element);

    // See if there's a dynamic var or fallback
    const borderColorVar = getCSSVariable('dynamic-border-color');
    const borderColor = borderColorVar || computed.borderColor || '#ffffff';

    const borderStyle = computed.borderStyle || 'none';

    const borderWidthVar = getCSSVariable('dynamic-border-width');
    const borderWidth = borderWidthVar || computed.borderWidth || '2px';

    const borderRadius = computed.borderRadius || '0px';

    const paddingVal = getCSSVariable('dynamic-border-padding') || computed.padding || '0px';

    return {
      borderColor,
      borderStyle,
      borderWidth,
      borderRadius,
      padding: paddingVal
    };
  }
  
   // --- Color Utilities ---

    /**
     * Normalizes various color formats to a standard (e.g., hex, rgba).
     * Tries to return hex for solid colors, rgba if alpha < 1.
     * Returns input if conversion fails or not recognized.
     */
    function normalizeColor(color, context = 'color') {
      if (!color || typeof color !== 'string' || color === 'transparent' || color === 'none') {
          // console.warn(`[normalizeColor] Received invalid/transparent color for ${context}:`, color);
          return 'transparent'; // Return transparent explicitly
      }
      const lower = color.toLowerCase().trim();
      if (lower.startsWith('#')) return lower; // Assume hex is fine
      if (lower.startsWith('rgb')) return lower; // Assume rgb/rgba is fine

      // Basic color name map
      const colorMap = { /* ... keep basic map ... */ };
      if (colorMap[lower]) return colorMap[lower];

      // Attempt conversion using a temporary element (might not always work)
      try {
          const temp = document.createElement('div');
          temp.style.color = lower;
          document.body.appendChild(temp); // Must be in DOM for getComputedStyle
          const computed = window.getComputedStyle(temp).color;
          document.body.removeChild(temp);
          if (computed && computed !== 'rgba(0, 0, 0, 0)') { // Check if it resolved to something valid
               // console.log(`[normalizeColor] Normalized "${color}" to "${computed}" via computed style.`);
               return computed; // Return computed style (likely rgb/rgba)
          }
      } catch (e) {
           console.warn(`[normalizeColor] Error normalizing color "${color}" for ${context} via computed style:`, e);
      }

      console.warn(`[normalizeColor] Could not normalize unrecognized color "${color}" for ${context}. Returning original.`);
      return color; // Return original if all else fails
  }


  /**
   * Decides if black or white is better for text over a given background color.
   * Uses a simple luminance formula to pick high contrast.
   * @param {string} backgroundColor
   * @returns {string} 'black' or 'white'
   */
  function getTextColorForBackground(backgroundColor) {
    // Minimal approach: parse as #RRGGBB or fallback
    let r = 255, g = 255, b = 255; // fallback white
    if (backgroundColor && backgroundColor.startsWith('#')) {
      let hex = backgroundColor.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length >= 6) {
        r = parseInt(hex.slice(0,2), 16);
        g = parseInt(hex.slice(2,4), 16);
        b = parseInt(hex.slice(4,6), 16);
      }
    }
    // Luminance check
    const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
    return lum > 0.5 ? 'black' : 'white';
  }

  /**
   * Extracts just the R,G,B from a color string for usage in "rgba(r,g,b,alpha)".
   * e.g. '#ff1493' => "255,20,147"
   * If parsing fails, returns "255, 255, 255" by default.
   * @param {string} color
   * @returns {string} e.g. "255, 255, 255"
   */
  function extractRGB(color) {
    
    if (!color) return "255, 255, 255";
    const normalized = normalizeColor(color, 'extractRGB'); // Normalize first
    if (!normalized || normalized === 'transparent') return "0, 0, 0"; // Default black for transparency
    const lower = normalized.toLowerCase();
    // hex
    if (lower.startsWith('#')) {
      let hex = lower.slice(1);
      if (hex.length === 3) {
        let r = parseInt(hex[0] + hex[0], 16),
            g = parseInt(hex[1] + hex[1], 16),
            b = parseInt(hex[2] + hex[2], 16);
        return `${r}, ${g}, ${b}`;
      } else if (hex.length >= 6) {
        let r = parseInt(hex.slice(0,2), 16),
            g = parseInt(hex.slice(2,4), 16),
            b = parseInt(hex.slice(4,6), 16);
        return `${r}, ${g}, ${b}`;
      }
      return "255, 255, 255";
    }

    // rgb( or rgba(
    if (lower.startsWith('rgb')) {
      const m = lower.match(/\(([^)]+)\)/);
      if (m && m[1]) {
        const parts = m[1].split(',')
          .map(x => parseInt(x.trim()))
          .slice(0,3);
        return parts.join(', ');
      }
    }
    // fallback
    return "255, 255, 255";
  }

     /** Extracts primary font family name */
     function getPrimaryFontFamily(fontFamilyCss) {
      if (!fontFamilyCss || typeof fontFamilyCss !== 'string') return 'sans-serif';
      return fontFamilyCss.split(',')[0].trim().replace(/['"]/g, '') || 'sans-serif';
  }

  /** Extracts gradient colors */
  function extractGradientColors(element, isTextGradient, computedStyle = null) {
      // Use provided computedStyle or get it if needed and element exists
      const style = computedStyle || (element ? window.getComputedStyle(element) : null);
      const image = style?.backgroundImage; // Use computed style if available
      const source = isTextGradient ? 'Text' : 'Background';
      let colors = [];

      // Prioritize SettingsManager state IF available
      if (typeof SettingsManager !== 'undefined' && SettingsManager?.getCurrentSettings) {
          const settings = SettingsManager.getCurrentSettings();
          if (isTextGradient && settings.textColorMode === 'gradient') {
               colors.push(normalizeColor(settings.color1 || '#FF1493', `${source} Setting c1`));
               colors.push(normalizeColor(settings.color2 || '#8A2BE2', `${source} Setting c2`));
               if (settings.useColor3) colors.push(normalizeColor(settings.color3 || '#FF4500', `${source} Setting c3`));
               console.log(`[CSSUtils extractGradientColors ${source}] Using colors from SettingsManager:`, colors);
               return colors;
          } else if (!isTextGradient && settings.backgroundType?.includes('gradient') && settings.backgroundGradientPreset === 'custom') {
               colors.push(normalizeColor(settings.bgColor1 || '#3a1c71', `${source} Setting c1`));
               colors.push(normalizeColor(settings.bgColor2 || '#ffaf7b', `${source} Setting c2`));
               console.log(`[CSSUtils extractGradientColors ${source}] Using colors from SettingsManager:`, colors);
               return colors;
          } else if (!isTextGradient && settings.backgroundType?.includes('gradient')) {
                const presetVarName = `--${settings.backgroundGradientPreset}`;
                const presetValue = getCSSVariable(presetVarName)?.trim();
                if (presetValue?.startsWith('linear-gradient')) {
                     const matches = presetValue.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g);
                     if (matches) { colors = matches.map((c, i) => normalizeColor(c, `${source} Preset ${presetVarName} c${i+1}`)); console.log(`[CSSUtils extractGradientColors ${source}] Using colors from Preset CSS Var ${presetVarName}:`, colors); return colors; }
                }
          }
      }

      // Fallback to Computed Style if element and style object available
      if (image && image.startsWith('linear-gradient')) {
          const matches = image.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g);
          if (matches) {
              colors = matches.map((c, i) => normalizeColor(c, `${source} Computed c${i+1}`));
              console.log(`[CSSUtils extractGradientColors ${source}] Using colors from Computed Style:`, colors);
              return colors;
          }
      }

      // Absolute fallback
      console.warn(`[CSSUtils extractGradientColors ${source}] Could not determine gradient colors. Using defaults.`);
      return isTextGradient ? ['#FF1493', '#8A2BE2'] : ['#3a1c71', '#ffaf7b'];
  }


  /** Extracts gradient angle */
  function extractGradientAngle(computedBgImage, isTextGradient) {
      const settings = (typeof SettingsManager !== 'undefined' && SettingsManager?.getCurrentSettings) ? SettingsManager.getCurrentSettings() : {};
      const source = isTextGradient ? 'Text' : 'Background';
      const defaultAngle = isTextGradient ? '45deg' : '90deg';

      // Prioritize settings
      if (isTextGradient && settings.textColorMode === 'gradient' && settings.animationDirection) { return `${settings.animationDirection}deg`; }
      if (!isTextGradient && settings.backgroundType?.includes('gradient') && settings.bgGradientDirection) { return `${settings.bgGradientDirection}deg`; }
      if (!isTextGradient && settings.backgroundType?.includes('gradient') && settings.backgroundGradientPreset !== 'custom') {
           const presetVarName = `--${settings.backgroundGradientPreset}`;
           const presetValue = getCSSVariable(presetVarName)?.trim();
           if (presetValue?.startsWith('linear-gradient')) { const m=presetValue.match(/linear-gradient\(\s*(-?[\d.]+deg)/); if(m && m[1]) return m[1]; }
      }

      // Fallback to computed style string
      if (computedBgImage && typeof computedBgImage === 'string' && computedBgImage.startsWith('linear-gradient')) {
          const m = computedBgImage.match(/linear-gradient\(\s*(-?[\d.]+deg)/); if (m && m[1]) return m[1];
      }
      return defaultAngle; // Absolute fallback
  }


  /** Detects border style */
  function detectBorderStyle(element, computedStyle = null, currentSettings = null) {
      if (!element) return null;
      const settings = currentSettings || (typeof SettingsManager !== 'undefined' && SettingsManager?.getCurrentSettings ? SettingsManager.getCurrentSettings() : {});
      const style = computedStyle || window.getComputedStyle(element);

      let borderStyleKey = 'none'; let className = null; let source = 'none';
      const styleSetting = settings.borderStyle || 'border-none';
      const advStyleSetting = settings.advancedBorderStyle || 'none';
      const BORDER_STYLE_EFFECT_MAP = { /* ... copy map here from settingsManager ... */ }; // Need the map definition

      if (advStyleSetting !== 'none' && BORDER_STYLE_EFFECT_MAP[advStyleSetting]) { borderStyleKey = advStyleSetting; className = BORDER_STYLE_EFFECT_MAP[advStyleSetting]; source = 'settings (advanced)'; }
      else if (styleSetting !== 'border-none' && BORDER_STYLE_EFFECT_MAP[styleSetting]) { borderStyleKey = styleSetting; className = BORDER_STYLE_EFFECT_MAP[styleSetting]; source = 'settings (basic)'; }
      else {
           for (const key in BORDER_STYLE_EFFECT_MAP) { const classVal = BORDER_STYLE_EFFECT_MAP[key]; if (classVal && classVal !== 'border-style-none' && element.classList.contains(classVal)) { borderStyleKey = key; className = classVal; source = 'class'; break; } }
      }
      if (borderStyleKey === 'none') { const computed = style.borderTopStyle; if (computed && computed !== 'none') { const foundKey = Object.keys(BORDER_STYLE_EFFECT_MAP).find(k => k.endsWith(computed) || /* add specific maps like groove/ridge */ false); if (foundKey) { borderStyleKey = foundKey; className = BORDER_STYLE_EFFECT_MAP[foundKey]; source = 'computed'; } else { borderStyleKey = 'none'; } } }

      if (!borderStyleKey || borderStyleKey === 'none' || borderStyleKey === 'border-none') return null;

      const isGlow = borderStyleKey.includes('glow') || borderStyleKey.includes('neon');
      let glowColor = isGlow ? normalizeColor(settings.borderColorPicker || style.borderTopColor || '#ffffff', 'border glow fallback') : null;

      // Width and Color should be captured separately using settings/computed fallbacks
      return { style: borderStyleKey, isGlow, glowColor, source, className };
  }


  /** Gets border-radius CSS value */
  function getBorderRadiusCSSValue(radiusSetting, customRadiusSetting) {
      const BORDER_RADIUS_MAP = { /* ... copy map here from settingsManager ... */ }; // Need the map
      const radiusClass = BORDER_RADIUS_MAP[radiusSetting]; // Get class if needed, e.g., rounded-md

      switch (radiusSetting) {
          case 'none': case 'square': return '0px';
          case 'rounded-sm': return getCSSVariable('border-radius-sm', '4px');
          case 'rounded-md': return getCSSVariable('border-radius-md', '8px');
          case 'rounded-lg': return getCSSVariable('border-radius-lg', '16px');
          case 'pill': return '999px';
          case 'circle': return '50%';
          case 'custom':
               const customVal = String(customRadiusSetting || '').trim();
               return (/^[\d.%pxemrem\s\/]+$/.test(customVal) && customVal) ? customVal : '0px'; // Basic validation
          default: return '0px';
      }
  }


  /** Parses effect details */
  function getEffectDetails(effectSetting, computedTextShadow, effectColorSetting = null) {
      let type = 'none'; let color = effectColorSetting || '#000'; let blur = 0; let dx = 0; let dy = 0; let opacity = 1; let source = 'none';
      const ADVANCED_3D_EFFECT_MAP = { /* ... copy map here from settingsManager ... */ }; // Need map

      if (effectSetting && effectSetting !== 'none' && effectSetting !== 'text-effect-none') {
           source = 'setting/class';
           // Basic type mapping (needs improvement based on actual effect keys/classes)
           if (effectSetting.includes('glow') || effectSetting.includes('neon')) type = 'glow';
           else if (effectSetting.includes('shadow')) type = 'shadow';
           else if (effectSetting.includes('3d') || effectSetting.includes('extrude') || effectSetting.includes('bevel') || effectSetting.includes('isometric')) type = 'shadow';
           else if (effectSetting.includes('reflection')) type = 'reflection';
           else if (effectSetting.includes('cutout')) type = 'cutout';
           else type = 'shadow'; // Default assumption

          // Extract params (simplified - needs knowledge of specific effect class values)
           if (effectSetting.includes('soft')) { blur = 5; opacity = 0.6; }
           if (effectSetting.includes('medium')) { blur = 10; opacity = 0.7; }
           if (effectSetting.includes('strong')) { blur = 15; opacity = 0.8; }
           if (effectSetting.includes('hard-sm')) { dx = 1; dy = 1; blur = 0.1; opacity = 1; color = effectColorSetting || getCSSVariable('dynamic-border-color', '#fff'); }
           if (effectSetting.includes('hard-md')) { dx = 2; dy = 2; blur = 0.1; opacity = 1; color = effectColorSetting || getCSSVariable('dynamic-border-color', '#fff'); }
           // ... add more specific parsing based on your actual effect classes ...

      } else if (computedTextShadow && computedTextShadow !== 'none') {
          source = 'computed'; type = 'shadow';
          // Basic computed parsing (limited)
          const parts = computedTextShadow.split(' '); try { color = normalizeColor(parts[0], 'effect computed'); dx = parseFloat(parts[1]) || 0; dy = parseFloat(parts[2]) || 0; blur = parseFloat(parts[3]) || 0; opacity = extractOpacityFromColor(parts[0]); } catch(e){}
      } else { return null; }

      return { type, color: normalizeColor(color, 'effect'), blur, dx, dy, opacity, source };
  }


  /** Applies text transform */
  function getTransformedTextContent(element, transform) {
      const originalText = element?.textContent || ''; if (!originalText) return '';
      switch (transform) {
          case 'uppercase': return originalText.toUpperCase();
          case 'lowercase': return originalText.toLowerCase();
          case 'capitalize': return originalText.replace(/\b\w/g, char => char.toUpperCase());
          default: return originalText;
      }
  }

  /**
   * Applies a border-radius to an element, possibly using named shortcuts
   * that match your "effects.css" or "variables.css" definitions:
   *  - "rounded-sm" => var(--border-radius-sm, 4px)
   *  - "rounded-md" => var(--border-radius-md, 8px)
   *  - "rounded-lg" => var(--border-radius-lg, 16px)
   *  - "pill"       => "999px"
   *  - "circle"     => "50%"
   *  - "none" or "square" => "0px"
   *
   * If the input is purely numeric, appends "px".
   */
  function applyBorderRadius(element, radiusVal) {
    if (!element) return;
    let normalized = radiusVal;

    switch (radiusVal) {
      case 'circle':
        normalized = '50%';
        break;
      case 'pill':
        normalized = '999px';
        break;
      case 'rounded-sm': {
        normalized = getCSSVariable('border-radius-sm', '4px');
      } break;
      case 'rounded-md': {
        normalized = getCSSVariable('border-radius-md', '8px');
      } break;
      case 'rounded-lg': {
        normalized = getCSSVariable('border-radius-lg', '16px');
      } break;
      case 'none':
      case 'square':
        normalized = '0px';
        break;
      default: {
        // If it's numeric only, add "px"
        if (!isNaN(parseFloat(radiusVal)) && isFinite(radiusVal)) {
          normalized = radiusVal + 'px';
        }
      }
    }

    element.style.borderRadius = normalized;
    setCSSVariable('dynamic-border-radius', normalized);

    console.log(`[CSSUtils] applyBorderRadius -> ${normalized}`);
  }

  /**
   * Applies uniform padding to an element.
   * If you pass a number, it appends "px".
   * Also sets `--dynamic-border-padding` for consistency.
   * @param {HTMLElement} element
   * @param {string|number} paddingVal
   */
  function applyBorderPadding(element, paddingVal) {
    if (!element) return;
    let finalVal = (typeof paddingVal === 'number')
      ? `${paddingVal}px`
      : paddingVal;

    element.style.padding = finalVal;
    setCSSVariable('dynamic-border-padding', finalVal);

    console.log(`[CSSUtils] applyBorderPadding -> ${finalVal}`);
  }

  /**
   * Returns a stroke-dasharray for dotted/dashed/etc. based on style + width.
   * e.g. for 'dashed' with width=3 => "9,6" or similar.
   * @param {string} style - e.g. "dotted","dashed","double","solid"
   * @param {string|number} width
   * @returns {string|null} e.g. "3,3" or "6,4", or null if style not dash-based
   */
  function getBorderDashArray(style, width) {
    if (!style || style==='none' || style==='solid') return null;
    const w = parseFloat(width) || 2;
    switch(style.toLowerCase()) {
      case 'dotted':
        return `${w}, ${w*1.5}`;
      case 'dashed':
        return `${w*3}, ${w*2}`;
      case 'double':
        // double is tricky, approximate:
        return `${w*4}, ${w*2}`;
      default:
        return null;
    }
  }

  // Create an object with all these utility methods
   // Create the main object to attach to window
   const CSSUtils = {
    // Basic Get/Set
    getCSSVariable,
    setCSSVariable,
    // Simple Info Extraction
    getTextColorForBackground,
    extractRGB,
    getBorderStyles, // Keep original simple version
    // Calculation/Formatting Helpers
    getBorderDashArray,
    getBorderRadiusCSSValue, // New calculation function
    getPrimaryFontFamily,
    getTransformedTextContent,
    // Complex Style Detection/Extraction
    extractGradientColors,
    extractGradientAngle,
    detectBorderStyle, // New complex version
    getEffectDetails,
    // Direct Style Application (Keep originals if still used elsewhere)
    applyBorderRadius,
    applyBorderPadding
};

// Attach to window globally
window.CSSUtils = CSSUtils;
// Also attach normalizeColor globally
window.normalizeColor = normalizeColor;

console.log("[CSSUtils v3.0 - Combined] Ready.");

})(window);