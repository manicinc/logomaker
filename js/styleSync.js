/**
 * Syncs live styles from UI to preview container.
 * This ensures real-time updates across export formats (PNG, SVG, GIF).
 */

export function getCurrentStyleConfig() {
    const logoEl = document.querySelector('.logo-text');
    const previewContainer = document.getElementById('previewContainer');
    
    if (!logoEl || !previewContainer) {
      console.error('Critical elements missing for style configuration');
      return {};
    }
    
    const computed = getComputedStyle(logoEl);
    const containerComputed = getComputedStyle(previewContainer);
  
    return {
      text: logoEl.textContent,
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      letterSpacing: computed.letterSpacing,
      textTransform: computed.textTransform,
      textAlign: computed.textAlign,
      color: computed.color,
      background: containerComputed.background,
      backgroundColor: containerComputed.backgroundColor,
      backgroundImage: containerComputed.backgroundImage,
      border: computed.border,
      borderColor: getComputedStyle(document.documentElement).getPropertyValue('--dynamic-border-color').trim() || '#ffffff',
      textShadow: computed.textShadow,
      transform: computed.transform,
      animation: computed.animation,
      gradient: logoEl.style.backgroundImage || '',
      backgroundType: Array.from(previewContainer.classList).find(cls => cls.startsWith('bg-')) || '',
      cssVariables: captureRootCSSVariables(),
      exportWidth: parseInt(document.getElementById('exportWidth')?.value || '800'),
      exportHeight: parseInt(document.getElementById('exportHeight')?.value || '400'),
      transparent: document.getElementById('exportTransparent')?.checked || false,
    };
  }
    
  export function extractPreviewStyles() {
    const previewContainer = document.getElementById('previewContainer');
    const logoEl = previewContainer?.querySelector('.logo-text');
    if (!logoEl || !previewContainer) return {};
  
    const computed = getComputedStyle(logoEl);
    const wrapperStyle = getComputedStyle(previewContainer);
  
    return {
      width: previewContainer.offsetWidth,
      height: previewContainer.offsetHeight,
      background: wrapperStyle.background,
      backgroundColor: wrapperStyle.backgroundColor,
      backgroundImage: wrapperStyle.backgroundImage,
      backgroundType: Array.from(previewContainer.classList).find(cls => cls.startsWith('bg-')) || '',
      bgOpacity: wrapperStyle.opacity,
      logo: {
        text: logoEl.textContent,
        color: computed.color,
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        fontWeight: computed.fontWeight,
        letterSpacing: computed.letterSpacing,
        textTransform: computed.textTransform,
        textAlign: computed.textAlign,
        textShadow: computed.textShadow,
        backgroundImage: computed.backgroundImage,
        background: computed.background,
        border: computed.border,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--dynamic-border-color').trim() || '#ffffff',
        transform: computed.transform,
        animation: computed.animation,
      },
    };
  }
  
  /**
   * Captures CSS variables from the root element for consistent styling
   * @returns {string} CSS variables as a string
   */
  export function captureRootCSSVariables() {
    const rootStyle = getComputedStyle(document.documentElement);
    const cssVarNames = [
      '--primary-gradient',
      '--cyberpunk-gradient',
      '--sunset-gradient',
      '--ocean-gradient',
      '--animation-duration',
      '--gradient-direction',
      '--dynamic-border-color'
    ];
    
    let cssVars = {};
    
    cssVarNames.forEach(varName => {
      const value = rootStyle.getPropertyValue(varName).trim();
      if (value) {
        cssVars[varName] = value;
      }
    });
    
    // Also include preset gradients if available
    const presetNames = [
      'primary-gradient',
      'cyberpunk-gradient',
      'sunset-gradient',
      'ocean-gradient'
    ];
    
    presetNames.forEach(preset => {
      const varName = `--${preset}`;
      const value = rootStyle.getPropertyValue(varName).trim();
      if (value) {
        cssVars[varName] = value;
      }
    });
    
    return cssVars;
  }