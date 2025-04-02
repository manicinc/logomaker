/**
 * mobile.js (Version 2 - Focused Mobile Enhancements)
 * Initializes mobile-specific features and optimizations.
 */

/** Apply mobile-specific classes and tweaks */
function initMobileFeatures() {
  // Detect if likely on mobile based on width (adjust threshold if needed)
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
      console.log("[Mobile] Applying mobile-specific enhancements.");
      // Add mobile class to body for CSS targeting
      document.body.classList.add('mobile-device');

      // Show mobile helper elements if they exist (e.g., touch indicators)
      // const mobileHelpers = document.querySelectorAll('.mobile-preview-helper');
      // mobileHelpers.forEach(helper => helper.classList.remove('hidden'));

      // Make reset button potentially more accessible (handled by CSS primarily)
      const resetBtn = document.getElementById('resetBtn');
      if (resetBtn) {
          resetBtn.classList.add('mobile-visible'); // Add class for potential CSS rules
      }
      // Add touch-friendly number input controls (if not handled by CSS/browser)
      // optimizeFormInputs(); // Consider if needed

      // Add mobile preview toggle button (using the element created in this file)
      setupPreviewToggle();

      // Add preset buttons for export dimensions
      fixExportSizeControls();

  } else {
       document.body.classList.remove('mobile-device');
  }

  // Specific iOS detection for potential workarounds
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
      document.body.classList.add('ios-device');
      // Apply specific iOS fixes if needed (e.g., for keyboard/scroll issues)
      // applyIOSFixes(); // Uncomment if iOS specific fixes are implemented/needed
  } else {
       document.body.classList.remove('ios-device');
  }
}


/** Handle orientation changes */
function handleOrientationChange() {
  console.log("[Mobile] Orientation changed.");
  // Update size indicator after a short delay to allow layout reflow
  setTimeout(() => {
      if (typeof window.updateSizeIndicator === 'function') {
          window.updateSizeIndicator();
      }
      // Refresh logo preview if needed (sometimes helps rendering glitches)
      const logoElement = document.querySelector('.logo-text');
      if (logoElement) {
          logoElement.style.display = 'none';
          void logoElement.offsetHeight; // Force reflow
          logoElement.style.display = '';
      }
       // Update viewport CSS variables on orientation change
       initCssVariables();
  }, 300); // Adjust delay if needed
}

/**
* Adds +/- buttons to number inputs for easier touch interaction.
* Consider if this is truly needed or if native controls are sufficient.
*/
/*
function optimizeFormInputs() {
  const numberInputs = document.querySelectorAll('input[type="number"]');
  numberInputs.forEach(input => {
      if (input.closest('.number-controls-wrapper')) return; // Already added

      const wrapper = document.createElement('div');
      wrapper.className = 'number-controls-wrapper';

      const decreaseBtn = document.createElement('button');
      decreaseBtn.textContent = '-';
      decreaseBtn.className = 'number-control-btn decrease';
      decreaseBtn.type = 'button';
      decreaseBtn.tabIndex = -1; // Prevent tabbing to buttons

      const increaseBtn = document.createElement('button');
      increaseBtn.textContent = '+';
      increaseBtn.className = 'number-control-btn increase';
      increaseBtn.type = 'button';
      increaseBtn.tabIndex = -1;

      decreaseBtn.addEventListener('click', () => {
          input.stepDown();
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      increaseBtn.addEventListener('click', () => {
          input.stepUp();
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      wrapper.appendChild(decreaseBtn);
      wrapper.appendChild(increaseBtn);
      input.parentNode.insertBefore(wrapper, input.nextSibling);
  });
}
*/

/** Initialize CSS variables related to viewport size */
function initCssVariables() {
  document.documentElement.style.setProperty('--viewport-width', `${window.innerWidth}px`);
  document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
}

/** Add preset buttons for Export dimensions on mobile */
function fixExportSizeControls() {
  const exportWidthInput = document.getElementById('exportWidth');
  const exportHeightInput = document.getElementById('exportHeight');
  const advancedTab = document.getElementById('advanced-tab'); // Target the tab content

  if (!exportWidthInput || !exportHeightInput || !advancedTab || advancedTab.querySelector('.export-size-presets')) {
      // Don't run if elements missing or presets already added
      return;
  }

  const presetWrapper = document.createElement('div');
  presetWrapper.className = 'control-group export-size-presets'; // Use control-group for consistent styling
  presetWrapper.innerHTML = '<label>Quick Sizes:</label>'; // Add a label

  const buttonContainer = document.createElement('div');
   buttonContainer.className = 'preset-buttons-container'; // For flex layout

  const presets = [
      { label: 'SM', w: 400, h: 200 }, { label: 'MD', w: 800, h: 400 },
      { label: 'LG', w: 1200, h: 600 }, { label: 'SQ', w: 600, h: 600 },
      { label: 'HD', w: 1920, h: 1080 }
  ];

  presets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'preset-size-btn';
      btn.textContent = p.label;
      btn.type = 'button';
      btn.title = `${p.w} x ${p.h}`;
      btn.addEventListener('click', () => {
          exportWidthInput.value = p.w;
          exportHeightInput.value = p.h;
          // Trigger change events if needed by other logic (e.g., PNG preview)
          exportWidthInput.dispatchEvent(new Event('change', { bubbles: true }));
          exportHeightInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      buttonContainer.appendChild(btn);
  });

  presetWrapper.appendChild(buttonContainer);

  // Insert after the exportHeight control group
  const heightGroup = exportHeightInput.closest('.control-group');
  if (heightGroup && heightGroup.parentNode) {
       heightGroup.parentNode.insertBefore(presetWrapper, heightGroup.nextSibling);
       console.log("[Mobile] Export size preset buttons added.");
  } else {
       console.warn("[Mobile] Could not find place to insert export size presets.");
  }
}

/** Mobile Preview Mode Toggle */
function setupPreviewToggle() {
  const previewContainer = document.getElementById('previewContainer');
  if (!previewContainer || previewContainer.querySelector('.preview-toggle-btn-mobile')) return; // Already added or no container

  console.log("[Mobile] Setting up fullscreen preview toggle.");
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'preview-toggle-btn preview-toggle-btn-mobile'; // Specific class
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('aria-label', 'Toggle fullscreen preview');
  toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`; // Expand icon

  toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent interfering with other clicks
      const isFullscreen = document.body.classList.toggle('preview-fullscreen');
      previewContainer.classList.toggle('fullscreen-preview', isFullscreen);

      if (isFullscreen) {
          toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>`; // Collapse icon
          toggleBtn.setAttribute('aria-label', 'Exit fullscreen preview');
          // Hide controls (using CSS primarily via the body class)
      } else {
          toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`; // Expand icon
          toggleBtn.setAttribute('aria-label', 'Toggle fullscreen preview');
          // Show controls (handled by removing body class)
      }
      // Update size indicator after transition/layout change
      setTimeout(() => {
           if (typeof window.updateSizeIndicator === 'function') {
               window.updateSizeIndicator();
           }
      }, 300);
  });

  // Prepend inside the preview container so it's layered on top
  previewContainer.insertBefore(toggleBtn, previewContainer.firstChild);
}


// --- Event Listeners ---
// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
   initCssVariables(); // Set initial viewport vars
   initMobileFeatures(); // Apply mobile class and features if needed
   window.addEventListener('resize', initCssVariables); // Update vars on resize
   window.addEventListener('orientationchange', handleOrientationChange); // Handle orientation change
});

// Make function globally available if needed by main.js (though it's usually self-contained)
window.initMobileFeatures = initMobileFeatures;

console.log("[Mobile] Module loaded.");