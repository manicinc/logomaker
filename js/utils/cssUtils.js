/**
 * cssUtils.js - v2.0
 * Enhanced utility functions for handling CSS variables and computed styles
 * With improved border styling support, radius options, and consistent style handling
 */

const CSSUtils = (function() {
  /**
   * Gets the actual value of a CSS variable from the document root
   * @param {string} varName - CSS variable name (with or without --) 
   * @param {string} defaultValue - Fallback value if variable isn't found
   * @returns {string} The resolved value
   */
  function getCSSVariable(varName, defaultValue = '') {
    // Ensure variable name has proper format
    if (!varName.startsWith('--')) {
      varName = `--${varName}`;
    }
    
    // Get the computed value from document root
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
      
    return value || defaultValue;
  }
  
  /**
   * Sets a CSS variable on the document root
   * @param {string} varName - CSS variable name (with or without --)
   * @param {string} value - Value to set
   */
  function setCSSVariable(varName, value) {
    // Ensure variable name has proper format
    if (!varName.startsWith('--')) {
      varName = `--${varName}`;
    }
    
    document.documentElement.style.setProperty(varName, value);
  }
  
  /**
   * Retrieves all border-related styles for an element
   * @param {HTMLElement} element - Element to get border styles from
   * @returns {Object} Object with border properties
   */
  function getBorderStyles(element) {
    const computed = window.getComputedStyle(element);
    
    // Get border color from CSS variable or computed style
    const borderColor = getCSSVariable('dynamic-border-color') || 
                        computed.borderColor || 
                        '#ffffff';
    
    // Get border radius (both single value and complete)
    const borderRadius = computed.borderRadius || '0px';
    
    // Check if we have individual radius values
    const topLeft = computed.borderTopLeftRadius || borderRadius;
    const topRight = computed.borderTopRightRadius || borderRadius;
    const bottomLeft = computed.borderBottomLeftRadius || borderRadius;
    const bottomRight = computed.borderBottomRightRadius || borderRadius;
    
    // Get border width (analyze each side for consistency)
    const borderWidth = computed.borderWidth || getCSSVariable('dynamic-border-width') || '2px';
    const borderTopWidth = computed.borderTopWidth || borderWidth;
    const borderRightWidth = computed.borderRightWidth || borderWidth;
    const borderBottomWidth = computed.borderBottomWidth || borderWidth;
    const borderLeftWidth = computed.borderLeftWidth || borderWidth;
    
    // Check for consistent widths (useful for SVG export)
    const hasConsistentWidth = (
      borderTopWidth === borderRightWidth && 
      borderRightWidth === borderBottomWidth && 
      borderBottomWidth === borderLeftWidth
    );
    
    // Get padding (important for border appearance)
    const padding = computed.padding || getCSSVariable('dynamic-border-padding') || '0px';
    const paddingTop = computed.paddingTop || padding;
    const paddingRight = computed.paddingRight || padding;
    const paddingBottom = computed.paddingBottom || padding;
    const paddingLeft = computed.paddingLeft || padding;
    
    // Check if the element has a consistent border radius (useful for circular/oval detection)
    const isCircular = borderRadius.includes('50%') || 
                      (topLeft === topRight && topRight === bottomRight && 
                       bottomRight === bottomLeft && topLeft.includes('%'));
                      
    return {
      borderColor: borderColor,
      borderStyle: computed.borderStyle,
      borderWidth: hasConsistentWidth ? borderWidth : {
        top: borderTopWidth,
        right: borderRightWidth,
        bottom: borderBottomWidth,
        left: borderLeftWidth
      },
      borderRadius: {
        value: borderRadius,
        topLeft: topLeft,
        topRight: topRight,
        bottomLeft: bottomLeft,
        bottomRight: bottomRight,
        isCircular: isCircular
      },
      padding: {
        value: padding,
        top: paddingTop,
        right: paddingRight,
        bottom: paddingBottom,
        left: paddingLeft
      },
      // If border is circular and width is consistent, we can leverage this for better SVG export
      isCircularWithConsistentWidth: isCircular && hasConsistentWidth
    };
  }
  
  /**
   * Calculates text color based on background for contrast
   * @param {string} backgroundColor - CSS color value
   * @returns {string} Either 'white' or 'black' for best contrast
   */
  function getTextColorForBackground(backgroundColor) {
    // Convert color to RGB components
    let r, g, b;
    
    if (backgroundColor.startsWith('#')) {
      // Hex color
      const hex = backgroundColor.slice(1);
      if (hex.length === 3) {
        // #RGB format
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else {
        // #RRGGBB format
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    } else if (backgroundColor.startsWith('rgb')) {
      // RGB or RGBA color
      const match = backgroundColor.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      } else {
        return 'white'; // Default for unknown format
      }
    } else {
      return 'white'; // Default for unknown format
    }
    
    // Calculate relative luminance (WCAG recommendation)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black for light backgrounds, white for dark backgrounds
    return luminance > 0.5 ? 'black' : 'white';
  }
  
  /**
   * Extracts RGB values from a color string for use in rgba()
   * @param {string} color - Any valid CSS color
   * @returns {string} Comma-separated RGB values or fallback
   */
  function extractRGB(color) {
    if (!color) return "255, 255, 255"; // Default white
    
    // For hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      let r, g, b;
      
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else {
        return "255, 255, 255"; // Fallback
      }
      
      return `${r}, ${g}, ${b}`;
    }
    
    // For rgb/rgba colors
    if (color.startsWith('rgb')) {
      const match = color.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i) || 
                    color.match(/rgba\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (match) {
        return `${match[1]}, ${match[2]}, ${match[3]}`;
      }
    }
    
    // For named colors, we'd need a full mapping table (omitted for brevity)
    // We can add if needed
    
    return "255, 255, 255"; // Default fallback
  }
  
  /**
   * Apply border radius to an element with proper CSS variables
   * @param {HTMLElement} element - The element to style
   * @param {string} radius - Border radius value (px, %, etc) or shape keyword
   */
  function applyBorderRadius(element, radius) {
    if (!element) return;
    
    // Handle shape keywords
    if (radius === 'circle' || radius === 'round') {
      element.style.borderRadius = '50%';
      setCSSVariable('dynamic-border-radius', '50%');
      console.log("[CSSUtils] Applied circular border radius (50%)");
      return;
    }
    
    if (radius === 'oval') {
      element.style.borderRadius = '30% / 50%';  // Different horizontal/vertical for oval
      setCSSVariable('dynamic-border-radius', '30% / 50%');
      console.log("[CSSUtils] Applied oval border radius (30% / 50%)");
      return;
    }
    
    if (radius === 'pill') {
      element.style.borderRadius = '999px';
      setCSSVariable('dynamic-border-radius', '999px');
      console.log("[CSSUtils] Applied pill border radius (999px)");
      return;
    }
    
    if (radius === 'none' || radius === 'square') {
      element.style.borderRadius = '0';
      setCSSVariable('dynamic-border-radius', '0');
      console.log("[CSSUtils] Applied square border radius (0)");
      return;
    }
    
    // Handle standard size keywords
    if (radius === 'rounded-sm') {
      const size = getCSSVariable('border-radius-sm', '3px');
      element.style.borderRadius = size;
      setCSSVariable('dynamic-border-radius', size);
      console.log(`[CSSUtils] Applied small rounded corners (${size})`);
      return;
    }
    
    if (radius === 'rounded-md') {
      const size = getCSSVariable('border-radius-md', '6px');
      element.style.borderRadius = size;
      setCSSVariable('dynamic-border-radius', size);
      console.log(`[CSSUtils] Applied medium rounded corners (${size})`);
      return;
    }
    
    if (radius === 'rounded-lg') {
      const size = getCSSVariable('border-radius-lg', '10px');
      element.style.borderRadius = size;
      setCSSVariable('dynamic-border-radius', size);
      console.log(`[CSSUtils] Applied large rounded corners (${size})`);
      return;
    }
    
    // Handle custom values
    if (radius) {
      // Normalize the value to ensure it has proper units
      let normalizedRadius = radius;
      if (!isNaN(radius)) {
        normalizedRadius = `${radius}px`;
      }
      
      element.style.borderRadius = normalizedRadius;
      setCSSVariable('dynamic-border-radius', normalizedRadius);
      console.log(`[CSSUtils] Applied custom border radius (${normalizedRadius})`);
    }
  }
  
  /**
   * Apply border padding to an element consistently
   * @param {HTMLElement} element - The element to style
   * @param {string|number} padding - Padding value
   */
  function applyBorderPadding(element, padding) {
    if (!element) return;
    
    // Normalize the value
    let normalizedPadding = padding;
    if (!isNaN(padding)) {
      normalizedPadding = `${padding}px`;
    }
    
    element.style.padding = normalizedPadding;
    setCSSVariable('dynamic-border-padding', normalizedPadding);
    console.log(`[CSSUtils] Applied border padding (${normalizedPadding})`);
  }
  
  /**
   * Gets border dasharray pattern for SVG stroke based on style
   * @param {string} style - Border style (dotted, dashed, etc)
   * @param {string|number} width - Border width
   * @returns {string|null} - SVG stroke-dasharray value or null if solid/none
   */
  function getBorderDashArray(style, width) {
    if (!style || style === 'none' || style === 'solid') return null;
    
    // Get clean width as number
    const w = parseFloat(width) || 1;
    
    // Create appropriate dasharray patterns for different styles
    switch(style.toLowerCase()) {
      case 'dotted':
        return `${w}, ${w * 2}`;
      case 'dashed':
        return `${w * 3}, ${w * 2}`;
      case 'double':
        // Double can't really be done with dasharray, but we attempt an approximation
        return `${w * 4}, ${w}`;
      default:
        return null;
    }
  }
  
  // Public API
  return {
    getCSSVariable,
    setCSSVariable,
    getBorderStyles,
    getTextColorForBackground,
    extractRGB,
    applyBorderRadius,
    applyBorderPadding,
    getBorderDashArray
  };
})();

// Make globally available
window.CSSUtils = CSSUtils;

console.log("[CSSUtils] Enhanced v2.0 loaded with improved border handling");