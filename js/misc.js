/**
 * misc.js (Version 3 - Animation Keyframes Support)
 * =========================================
 * Contains miscellaneous utility functions, like updating the size indicator
 * and extracting animation keyframes for SVG export.
 */

/**
 * Updates the width/height display based on the logo text element's dimensions.
 */
function updateSizeIndicator() {
    const logoText = document.querySelector('.logo-text');
    const widthIndicator = document.getElementById('logoWidth');
    const heightIndicator = document.getElementById('logoHeight');
  
    if (!logoText || !widthIndicator || !heightIndicator) {
        // Don't spam console if elements aren't ready during init
        // console.warn('Size indicator elements or logo text missing.');
        return;
    }
  
    // Use getBoundingClientRect for accurate rendered dimensions
    const rect = logoText.getBoundingClientRect();
    widthIndicator.textContent = Math.round(rect.width);
    heightIndicator.textContent = Math.round(rect.height);
  }
  
  // --- Make function globally available ---
  // This allows it to be called from SettingsManager and main.js initialization easily.
  if (typeof window.updateSizeIndicator !== 'function') {
     window.updateSizeIndicator = updateSizeIndicator;
  }
  
  // --- Initialize on Load ---
  // Call once after the DOM is ready to set the initial size.
  // This might be called again by main.js after settings are applied.
  document.addEventListener('DOMContentLoaded', () => {
     // Initial call might be slightly delayed to wait for font loading/rendering
     setTimeout(updateSizeIndicator, 150);
  });
  
  console.log("[Misc] Module loaded. updateSizeIndicator is global.");
  
  // Removed setupPreviewToggle, applyIOSFixes, enhanceExportButtons, enableSettingsPersistence
  // as they are handled elsewhere (main.js, mobile.js, SettingsManager) or potentially outdated.
  
  // --- Theme Toggle Functionality ---
  function setupThemeToggle() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleText = themeToggleBtn?.querySelector('.theme-toggle-text'); // Optional text span
    if (!themeToggleBtn) return;
  
    const themeStorageKey = 'logomakerThemePreference';
    let currentTheme = localStorage.getItem(themeStorageKey);
  
    // Check system preference if no saved theme
    if (!currentTheme) {
        currentTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
  
    const applyTheme = (theme) => {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            if (themeToggleText) themeToggleText.textContent = 'Dark'; // Text for next state
            themeToggleBtn?.setAttribute('title', 'Switch to Dark Mode');
        } else {
            document.body.classList.remove('light-mode');
             if (themeToggleText) themeToggleText.textContent = 'Light'; // Text for next state
            themeToggleBtn?.setAttribute('title', 'Switch to Light Mode');
        }
        // Ensure currentTheme variable is updated
        currentTheme = theme;
        localStorage.setItem(themeStorageKey, theme); // Save preference
        console.log(`[Theme] Applied: ${theme}`);
    };
  
    themeToggleBtn.addEventListener('click', () => {
        const newTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
        applyTheme(newTheme);
    });
  
    // Apply initial theme
    applyTheme(currentTheme);
  
    // Optional: Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
        // Only change if no user preference is explicitly saved
        if (!localStorage.getItem(themeStorageKey)) {
            applyTheme(e.matches ? 'light' : 'dark');
        }
    });
  
     console.log('[Theme] Toggle Initialized.');
  }
  
  // --- Make globally available if needed ---
  // window.setupThemeToggle = setupThemeToggle;
  
  // --- Initialize on Load ---
  // Make sure this runs after the DOM is ready
  if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupThemeToggle);
  } else {
  setupThemeToggle(); // Initialize if DOM is already ready
  }
  
  console.log("[Misc] Module loaded. setupThemeToggle added.");
  
  /**
   * Searches document stylesheets for a specific @keyframes rule and returns its CSS text.
   * FIXED: Enhanced reliability and logging for SVG export.
   * @param {string} animationName - The name of the keyframes rule (e.g., 'pulse', 'bounce').
   * @returns {string | null} The full CSS text of the matching @keyframes rule, or null if not found.
   */
  function getActiveAnimationKeyframes(animationName) {
      console.log(`[Utils] Searching for @keyframes: ${animationName}`);
      if (!animationName) return null;
      
      try {
          // First attempt: Check all accessible stylesheets
          for (const sheet of document.styleSheets) {
              try {
                  // Skip cross-origin sheets that can't be accessed
                  if (!sheet.cssRules && sheet.href) {
                      console.log(`[Utils] Skipping inaccessible sheet: ${sheet.href}`);
                      continue;
                  }
                  
                  const rules = sheet.cssRules || sheet.rules;
                  if (!rules) continue;
                  
                  // First pass: Check direct keyframes
                  for (const rule of rules) {
                      if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === animationName) {
                          console.log(`[Utils] Found @keyframes ${animationName} in top-level rules`);
                          return rule.cssText;
                      }
                  }
                  
                  // Second pass: Check nested rules (e.g., inside @media)
                  for (const rule of rules) {
                      if (rule.type === CSSRule.MEDIA_RULE && rule.cssRules) {
                          for (const nestedRule of rule.cssRules) {
                              if (nestedRule.type === CSSRule.KEYFRAMES_RULE && nestedRule.name === animationName) {
                                  console.log(`[Utils] Found @keyframes ${animationName} inside @media rule`);
                                  return nestedRule.cssText;
                              }
                          }
                      } else if (rule.type === CSSRule.IMPORT_RULE && rule.styleSheet && rule.styleSheet.cssRules) {
                          // Check imported stylesheets
                          for (const importedRule of rule.styleSheet.cssRules) {
                              if (importedRule.type === CSSRule.KEYFRAMES_RULE && importedRule.name === animationName) {
                                  console.log(`[Utils] Found @keyframes ${animationName} in imported stylesheet`);
                                  return importedRule.cssText;
                              }
                          }
                      }
                  }
              } catch (e) {
                  // Catch SecurityError or other exceptions when accessing cross-origin sheets
                  if (e.name !== 'SecurityError' && e.name !== 'InvalidAccessError') {
                      console.warn(`[Utils] Error accessing rules for: ${sheet.href || 'inline stylesheet'}`, e.message);
                  }
                  continue;
              }
          }
          
          // Second attempt: Try to build a basic keyframe for common animations if not found
          console.warn(`[Utils] Keyframes '${animationName}' not found in stylesheets. Using fallback.`);
          
          // Map of common animation names to their keyframe definitions
          const fallbackKeyframes = {
              'pulse': '@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }',
              'bounce': '@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }',
              'fadeIn': '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
              'fadeOut': '@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }',
              'rotate': '@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
              'shake': '@keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); } 20%, 40%, 60%, 80% { transform: translateX(5px); } }',
              'slideIn': '@keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }',
              'glow': '@keyframes glow { 0%, 100% { text-shadow: 0 0 5px rgba(255,255,255,0.5); } 50% { text-shadow: 0 0 20px rgba(255,255,255,0.8); } }'
          };
          
          if (fallbackKeyframes[animationName]) {
              console.log(`[Utils] Using fallback definition for ${animationName}`);
              return fallbackKeyframes[animationName];
          }
          
          // Last resort - generate a minimal keyframe
          return `@keyframes ${animationName} { from { } to { } }`;
      } catch (e) {
          console.error("[Utils] Error searching for keyframes:", e);
          return null;
      }
  }
  
  // Expose globally for SVG export
  window.getActiveAnimationKeyframes = getActiveAnimationKeyframes;
  
  console.log("[Misc] Enhanced module loaded with animation keyframes extraction.");