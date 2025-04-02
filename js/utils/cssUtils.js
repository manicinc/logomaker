/**
 * Utility functions for handling CSS variables and computed styles
 * Helps with border colors and other CSS-related issues
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
      
      return {
        borderColor: borderColor,
        borderStyle: computed.borderStyle,
        borderWidth: computed.borderWidth,
        borderRadius: computed.borderRadius
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
    
    // Public API
    return {
      getCSSVariable,
      setCSSVariable,
      getBorderStyles,
      getTextColorForBackground
    };
  })();