/**
 * captureTextStyles.js (v9 - Refined Class/Style Capture)
 * ================================================
 * Captures computed styles from within a specific container element, focusing on details needed for export.
 */

// Helper: Get the primary font family name, removing quotes
function getPrimaryFontFamily(fontFamilyString) {
  if (!fontFamilyString) return 'sans-serif'; // Basic fallback
  // Split by comma, take the first part, trim whitespace, remove surrounding quotes
  return fontFamilyString.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

// Helper: Get SVG dasharray string based on border style and width
function getStrokeDasharray(borderStyle, borderWidth) {
  const w = parseFloat(borderWidth) || 1; // Use 1px as base if width is 0 or invalid
  switch (borderStyle) {
      case 'dashed': return `${w * 3}, ${w * 2}`; // Standard dash pattern based on width
      case 'dotted': return `${w}, ${w * 2}`; // Standard dot pattern based on width
      case 'double': return null; // SVG doesn't have a simple equivalent for double line border via stroke
      case 'groove': case 'ridge': case 'inset': case 'outset': return null; // These are complex 3D styles, not easily replicated in SVG stroke
      default: return null; // Solid or none
  }
}

// Helper: Apply text transformation
function getTransformedTextContent(element, transformStyle) {
  const txt = element?.textContent || '';
  switch (transformStyle?.toLowerCase()) {
      case 'uppercase': return txt.toUpperCase();
      case 'lowercase': return txt.toLowerCase();
      case 'capitalize': return txt.replace(/\b\w/g, c => c.toUpperCase()); // Capitalize each word
      default: return txt;
  }
}

/**
* Capture styles needed for SVG/PNG/GIF rendering from the live preview.
* @param {HTMLElement} container - The container element holding the logo preview (usually #previewContainer).
* @returns {object|null} An object containing captured styles, or null if essential elements are missing.
*/
function captureStylesForExport(container) {
  if (!container || !(container instanceof HTMLElement)) {
      console.error('[Capture] Invalid container provided.');
      return null;
  }
  console.log('[Capture] Capturing styles for export...');

  const logoText = container.querySelector('.logo-text');
  // Crucial: Use the element *with* the border class for border styles. Fallback to logoText if not found.
  const borderElement = container.querySelector('.dynamic-border') || logoText;
  const previewContainerElement = document.getElementById('previewContainer'); // Base background on original

  if (!logoText) {
      console.error('[Capture] Critical error: .logo-text element missing in container.');
      return null;
  }
  if (!borderElement) {
      console.warn('[Capture] .dynamic-border element missing, using .logo-text for border styles. This might be inaccurate.');
  }
  if (!previewContainerElement) {
      console.warn('[Capture] Original #previewContainer not found. Background info might be inaccurate.');
  }

  const computedLogo = window.getComputedStyle(logoText);
  const computedBorder = window.getComputedStyle(borderElement); // Styles from the element responsible for the border
  // Use computed style of the original preview container if available, otherwise the current container/logo as fallback
  const computedContainer = previewContainerElement ? window.getComputedStyle(previewContainerElement) : computedLogo;
  const rootComputedStyle = getComputedStyle(document.documentElement);
  const settings = window.SettingsManager?.getCurrentSettings?.() || {}; // Get current settings for gradient details

  const styles = {};

  // --- Text & Font ---
  styles.textContent = getTransformedTextContent(logoText, computedLogo.textTransform);
  styles.fontFamily = getPrimaryFontFamily(computedLogo.fontFamily);
  styles.fontSize = computedLogo.fontSize;
  styles.fontWeight = computedLogo.fontWeight;
  styles.fontStyle = computedLogo.fontStyle;
  styles.letterSpacing = computedLogo.letterSpacing === 'normal' ? null : computedLogo.letterSpacing;
  styles.textAnchor = computedLogo.textAlign === 'left' ? 'start' : computedLogo.textAlign === 'right' ? 'end' : 'middle';
  styles.dominantBaseline = 'middle'; // Most common for vertical centering in SVG
  styles.textDecoration = computedLogo.textDecorationLine === 'none' ? null : computedLogo.textDecoration; // Capture full decoration line/style

  // --- Color & Fill ---
  const hasGradient = logoText.style.backgroundImage && logoText.style.backgroundImage.startsWith('linear-gradient'); // Check inline style for gradient
  const isColorTransparent = computedLogo.color === 'transparent' || computedLogo.color === 'rgba(0, 0, 0, 0)';
  styles.colorMode = (hasGradient && isColorTransparent) ? 'gradient' : 'solid';

  if (styles.colorMode === 'gradient') {
      styles.fill = 'url(#svgTextGradient)'; // Reference SVG gradient definition
      // Capture necessary details for recreating the gradient in SVG
      styles.gradientDefinition = logoText.style.backgroundImage; // Get the actual applied gradient
      styles.gradientDirection = rootComputedStyle.getPropertyValue('--gradient-direction').trim() || '45deg'; // Get dynamic direction
      styles.gradientPreset = settings.gradientPreset; // Store preset name if needed
      styles.gradientColors = { // Store colors from settings for accuracy
          c1: settings.color1,
          c2: settings.color2,
          c3: settings.color3,
          useC3: settings.useColor3
      };
  } else {
      styles.fill = computedLogo.color || '#FFFFFF'; // Use computed color for solid fill
  }

  // --- Effects ---
  // Capture the specific class applied for effects, as computed filter/text-shadow can be complex
  styles.textGlowClass = Array.from(logoText.classList).find(c => c.startsWith('text-glow-') && c !== 'text-glow-none') || null;
  // Fallback capture for basic text-shadow if no specific class found
  styles.textShadow = (!styles.textGlowClass && computedLogo.textShadow !== 'none') ? computedLogo.textShadow : null;
  // Capture complex filters if directly applied (less common in this app?)
  styles.filter = computedLogo.filter !== 'none' ? computedLogo.filter : null;

  // --- Border ---
  styles.borderClass = Array.from(borderElement.classList).find(c => c.startsWith('border-') && c !== 'border-none') || null; // Capture the applied border class
  styles.borderStyle = computedBorder.borderTopStyle; // Use computed style for actual rendering (solid, dashed, etc.)
  // Use the CSS variable for border color if available, otherwise computed color
  styles.stroke = rootComputedStyle.getPropertyValue('--dynamic-border-color').trim() || computedBorder.borderTopColor || '#ffffff';
  // Only set strokeWidth if the border class is not 'border-none' and width isn't 0
  styles.strokeWidth = (styles.borderClass && computedBorder.borderTopWidth !== '0px') ? computedBorder.borderTopWidth : null;
  styles.strokeDasharray = getStrokeDasharray(styles.borderStyle, styles.strokeWidth); // Calculate dasharray based on style/width
  styles.borderColor = styles.stroke; // Alias needed for some filters/effects

  // --- Transform & Animation ---
  styles.transform = computedLogo.transform !== 'none' ? computedLogo.transform : null;
  styles.animationClass = Array.from(logoText.classList).find(c => c.startsWith('anim-') && c !== 'anim-none') || null; // Capture animation class
  styles.animationDuration = rootComputedStyle.getPropertyValue('--animation-duration').trim() || '2s'; // Get animation duration from CSS var

  // --- Background Info (From Original Container) ---
  const bgContainer = previewContainerElement || container; // Prefer original container
  styles.backgroundTypeClass = Array.from(bgContainer.classList).find(cls => cls.startsWith('bg-')) || 'bg-solid';
  styles.backgroundColor = computedContainer.backgroundColor;
  // Use inline style for background image if set (e.g., for gradients), otherwise computed
  styles.backgroundImage = (bgContainer.style.backgroundImage && bgContainer.style.backgroundImage !== 'none') ? bgContainer.style.backgroundImage : computedContainer.backgroundImage;
  styles.backgroundOpacity = computedContainer.opacity || '1';

  console.log('[CaptureStyles] Captured:', styles);
  return styles;
}

/**
* Main exported function to get styles from the preview container.
* @param {HTMLElement} [container=document.getElementById('previewContainer')] - Optional container override.
* @returns {object|null} Captured styles object or null on error.
*/
export function getFinalTextStyles(container) {
  const targetContainer = (container instanceof HTMLElement) ? container : document.getElementById('previewContainer');
  if (!targetContainer) {
      console.error("getFinalTextStyles: Cannot find valid container.");
      return null;
  }
  return captureStylesForExport(targetContainer);
}
console.log("[CaptureStyles] v9 Module loaded.");