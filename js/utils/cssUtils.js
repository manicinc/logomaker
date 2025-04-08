/**
 * cssUtils.js (Revamped v2.x)
 * ==============================================
 * A unified utility for CSS variable handling,
 * border/padding logic, color normalization, etc.
 *
 * Integrates references to "effects.css" style classes
 * for named border-radius shortcuts (e.g., 'rounded-sm',
 * 'rounded-md', 'rounded-lg', 'pill', 'circle').
 */

console.log("[CSSUtils v2.x] Loading...");

(function() {

  /**
   * Retrieves a CSS variable from :root or returns a fallback.
   * @param {string} varName - The variable name (with or without '--')
   * @param {string} [defaultValue=''] - fallback if not found
   * @returns {string} The resolved CSS var value (trimmed)
   */
  function getCSSVariable(varName, defaultValue = '') {
    if (!varName.startsWith('--')) {
      varName = `--${varName}`;
    }
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return val || defaultValue;
  }

  /**
   * Sets a CSS variable on :root
   * @param {string} varName - e.g. 'primary-color'
   * @param {string} value
   */
  function setCSSVariable(varName, value) {
    if (!varName.startsWith('--')) {
      varName = `--${varName}`;
    }
    document.documentElement.style.setProperty(varName, value);
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
    const lower = color.toLowerCase().trim();

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
  const CSSUtils = {
    getCSSVariable,
    setCSSVariable,
    getBorderStyles,
    getTextColorForBackground,
    extractRGB,
    applyBorderRadius,
    applyBorderPadding,
    getBorderDashArray
  };

  // Attach to window globally
  window.CSSUtils = CSSUtils;

  console.log("[CSSUtils] Ready. v2.x");

})();

/**
 * A separate function for normalizing color names to hex (or just returns # or rgb).
 * Attached to `window` for usage in other modules, so e.g. "red" => "#ff0000".
 */
window.normalizeColor = function normalizeColor(color, context = 'color') {
  if (!color || color === 'transparent' || color === 'none') {
    return null;
  }

  // Already # or rgb(...) => pass through
  const lower = color.toLowerCase().trim();
  if (lower.startsWith('#') || lower.startsWith('rgb')) {
    return color;
  }

  // A partial HTML color name -> hex map
  const colorMap = {
    'black': '#000000', 'white': '#ffffff',
    'red': '#ff0000', 'green': '#008000', 'blue': '#0000ff',
    'yellow': '#ffff00', 'purple': '#800080', 'orange': '#ffa500',
    // Expand as needed...
  };

  if (colorMap[lower]) {
    return colorMap[lower];
  }

  // If not recognized, warn and pass the string
  console.warn(`[normalizeColor] Unrecognized color "${color}" for ${context}; passing through.`);
  return color;
};
