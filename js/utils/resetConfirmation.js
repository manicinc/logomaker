/**
 * resetConfirmation.js
 * Handles the reset confirmation modal and reset functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize the reset functionality
  initResetModal();
});

/**
 * Initialize the reset confirmation modal and its interactions
 */
function initResetModal() {
  // Get DOM elements
  const resetBtn = document.getElementById('resetBtn');
  const resetConfirmModal = document.getElementById('resetConfirmModal');
  const resetModalCancel = document.getElementById('resetModalCancel');
  const resetModalConfirm = document.getElementById('resetModalConfirm');
  
  // Exit if elements don't exist
  if (!resetBtn || !resetConfirmModal || !resetModalCancel || !resetModalConfirm) {
    console.warn('Reset modal elements not found');
    return;
  }
  
  // Show modal when reset button is clicked
  resetBtn.addEventListener('click', function() {
    resetConfirmModal.classList.add('active');
    
    // Add some nice entrance animation
    const modalContent = resetConfirmModal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.style.animation = 'modal-appear 0.3s ease forwards';
    }
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
  });
  
  // Hide modal when cancel is clicked
  resetModalCancel.addEventListener('click', function() {
    closeResetModal();
  });
  
  // Handle click outside the modal to close it
  resetConfirmModal.addEventListener('click', function(e) {
    if (e.target === resetConfirmModal) {
      closeResetModal();
    }
  });
  
  // Handle escape key to close modal
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && resetConfirmModal.classList.contains('active')) {
      closeResetModal();
    }
  });
  
  // Handle reset confirmation
  resetModalConfirm.addEventListener('click', function() {
    // Get selected reset type
    const resetType = document.querySelector('input[name="reset-type"]:checked').value;
    
    // Perform the reset based on the selected type
    performReset(resetType);
    
    // Close the modal
    closeResetModal();
    
    // Show success message
    showResetSuccessMessage(resetType);
  });
  
  // Function to close the modal
  function closeResetModal() {
    resetConfirmModal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Perform the reset based on the selected type
 * @param {string} resetType - Type of reset: 'all', 'text', or 'style'
 */
function performReset(resetType) {
  // Use SettingsManager if available
  if (window.SettingsManager && typeof window.SettingsManager.resetSettings === 'function') {
    window.SettingsManager.resetSettings(resetType);
    return;
  }
  
  // Fallback implementation if SettingsManager is not available
  switch(resetType) {
    case 'all':
      resetAllSettings();
      break;
    case 'text':
      resetTextSettings();
      break;
    case 'style':
      resetStyleSettings();
      break;
    default:
      resetAllSettings();
  }
  
  // Update the preview
  updateLogoPreview();
  
  // Update size indicator
  if (typeof updateSizeIndicator === 'function') {
    updateSizeIndicator();
  }
}

/**
 * Reset all logo settings to defaults
 */
function resetAllSettings() {
  // Reset text settings
  resetTextSettings();
  
  // Reset style settings
  resetStyleSettings();
  
  // Reset animation settings
  const textAnimation = document.getElementById('textAnimation');
  if (textAnimation) textAnimation.value = 'anim-none';
  
  const animationSpeed = document.getElementById('animationSpeed');
  if (animationSpeed) animationSpeed.value = 1;
  
  const animationDirection = document.getElementById('animationDirection');
  if (animationDirection) animationDirection.value = 45;
  
  // Reset background settings
  const backgroundType = document.getElementById('backgroundType');
  if (backgroundType) backgroundType.value = 'bg-solid';
  
  const backgroundColor = document.getElementById('backgroundColor');
  if (backgroundColor) backgroundColor.value = '#000000';
  
  const bgOpacity = document.getElementById('bgOpacity');
  if (bgOpacity) bgOpacity.value = 1;
  
  // Reset preview container
  const previewContainer = document.getElementById('previewContainer');
  if (previewContainer) {
    // Remove all background classes
    previewContainer.classList.forEach(cls => {
      if (cls.startsWith('bg-')) {
        previewContainer.classList.remove(cls);
      }
    });
    
    // Add default background
    previewContainer.classList.add('bg-solid');
    previewContainer.style.backgroundColor = '#000000';
    previewContainer.style.opacity = '1';
  }
  
  // Reset animation duration CSS variable
  document.documentElement.style.setProperty('--animation-duration', '2s');
  
  // Reset any other global settings
  const previewSize = document.getElementById('previewSize');
  if (previewSize) previewSize.value = 'medium';
  
  // Reset export settings
  const exportWidth = document.getElementById('exportWidth');
  if (exportWidth) exportWidth.value = 800;
  
  const exportHeight = document.getElementById('exportHeight');
  if (exportHeight) exportHeight.value = 400;
  
  const exportQuality = document.getElementById('exportQuality');
  if (exportQuality) exportQuality.value = 100;
  
  const exportTransparent = document.getElementById('exportTransparent');
  if (exportTransparent) exportTransparent.checked = false;
  
  const exportFrames = document.getElementById('exportFrames');
  if (exportFrames) exportFrames.value = 10;
  
  // Clear localStorage
  localStorage.removeItem('logomakerSettings');
}

/**
 * Reset only text-related settings
 */
function resetTextSettings() {
  // Reset logo text
  const logoTextInput = document.getElementById('logoText');
  if (logoTextInput) logoTextInput.value = 'Manic';
  
  // Reset font family
  const fontFamilySelect = document.getElementById('fontFamily');
  if (fontFamilySelect) {
    // Try to find preferred fonts
    const preferredFonts = ['Orbitron', 'Audiowide', 'Russo One'];
    let found = false;
    
    for (const fontName of preferredFonts) {
      const option = Array.from(fontFamilySelect.options).find(opt => 
        opt.textContent.includes(fontName)
      );
      
      if (option) {
        fontFamilySelect.value = option.value;
        found = true;
        break;
      }
    }
    
    // If preferred fonts not found, use the first option
    if (!found && fontFamilySelect.options.length > 0) {
      fontFamilySelect.selectedIndex = 0;
    }
    
    // Trigger font change event
    fontFamilySelect.dispatchEvent(new Event('change'));
  }
  
  // Reset font size
  const fontSize = document.getElementById('fontSize');
  if (fontSize) {
    fontSize.value = 100;
    fontSize.dispatchEvent(new Event('input'));
  }
  
  // Reset letter spacing
  const letterSpacing = document.getElementById('letterSpacing');
  if (letterSpacing) {
    letterSpacing.value = 0.03;
    letterSpacing.dispatchEvent(new Event('input'));
  }
  
  // Reset text transform
  const textCase = document.getElementById('textCase');
  if (textCase) {
    textCase.value = 'uppercase';
    textCase.dispatchEvent(new Event('change'));
  }
  
  // Reset font weight
  const fontWeight = document.getElementById('fontWeight');
  if (fontWeight) {
    fontWeight.value = 700;
    fontWeight.dispatchEvent(new Event('change'));
  }
  
  // Apply to logo element
  const logoElement = document.querySelector('.logo-text');
  if (logoElement) {
    logoElement.textContent = 'Manic';
    logoElement.style.fontSize = '100px';
    logoElement.style.letterSpacing = '0.03em';
    logoElement.style.textTransform = 'uppercase';
    logoElement.style.fontWeight = '700';
    
    // Set data-text attribute for glitch animation if needed
    logoElement.setAttribute('data-text', 'Manic');
  }
}

/**
 * Reset only style-related settings
 */
function resetStyleSettings() {
  // Reset color mode
  const textColorMode = document.getElementById('textColorMode');
  if (textColorMode) {
    textColorMode.value = 'gradient';
    textColorMode.dispatchEvent(new Event('change'));
  }
  
  // Reset gradient
  const gradientPreset = document.getElementById('gradientPreset');
  if (gradientPreset) {
    gradientPreset.value = 'primary-gradient';
    gradientPreset.dispatchEvent(new Event('change'));
  }
  
  // Hide custom gradient controls if visible
  const customGradientControls = document.getElementById('customGradientControls');
  if (customGradientControls) customGradientControls.classList.add('hidden');
  
  // Reset colors
  const color1 = document.getElementById('color1');
  if (color1) {
    color1.value = '#FF1493';
    color1.dispatchEvent(new Event('input'));
  }
  
  const color2 = document.getElementById('color2');
  if (color2) {
    color2.value = '#8A2BE2';
    color2.dispatchEvent(new Event('input'));
  }
  
  const useColor3 = document.getElementById('useColor3');
  if (useColor3) {
    useColor3.checked = false;
    useColor3.dispatchEvent(new Event('change'));
  }
  
  const color3Control = document.getElementById('color3Control');
  if (color3Control) color3Control.classList.add('hidden');
  
  // Reset text shadow
  const textShadow = document.getElementById('textShadow');
  if (textShadow) {
    textShadow.value = 'text-glow-none';
    textShadow.dispatchEvent(new Event('change'));
  }
  
  // Reset border style
  const borderStyle = document.getElementById('borderStyle');
  if (borderStyle) {
    borderStyle.value = 'border-none';
    borderStyle.dispatchEvent(new Event('change'));
  }
  
  // Reset border color
  const borderColorPicker = document.getElementById('borderColorPicker');
  if (borderColorPicker) {
    borderColorPicker.value = '#ffffff';
    borderColorPicker.dispatchEvent(new Event('input'));
  }
  
  // Reset text alignment
  const textAlign = document.getElementById('textAlign');
  if (textAlign) {
    textAlign.value = 'center';
    textAlign.dispatchEvent(new Event('change'));
  }
  
  // Reset rotation
  const rotation = document.getElementById('rotation');
  if (rotation) {
    rotation.value = 0;
    rotation.dispatchEvent(new Event('input'));
  }
  
  // Apply to logo element
  const logoElement = document.querySelector('.logo-text');
  if (logoElement) {
    logoElement.style.backgroundImage = 'var(--primary-gradient)';
    logoElement.style.color = 'transparent';
    logoElement.style.webkitBackgroundClip = 'text';
    logoElement.style.backgroundClip = 'text';
    logoElement.style.webkitTextFillColor = 'transparent';
    logoElement.style.textAlign = 'center';
    logoElement.style.transform = 'rotate(0deg)';
    
    // Reset classes
    logoElement.classList.forEach(cls => {
      if (cls.startsWith('text-glow-') || cls.startsWith('border-')) {
        logoElement.classList.remove(cls);
      }
    });
    
    // Add default classes
    logoElement.classList.add('text-glow-none');
    logoElement.classList.add('border-none');
  }
}

/**
 * Update the logo preview with current settings
 */
function updateLogoPreview() {
  // Get logo element
  const logoElement = document.querySelector('.logo-text');
  if (!logoElement) return;
  
  // Simulate changes to all relevant controls
  document.getElementById('logoText')?.dispatchEvent(new Event('input'));
  document.getElementById('fontSize')?.dispatchEvent(new Event('input'));
  document.getElementById('letterSpacing')?.dispatchEvent(new Event('input'));
  document.getElementById('textCase')?.dispatchEvent(new Event('change'));
  document.getElementById('fontWeight')?.dispatchEvent(new Event('change'));
  
  document.getElementById('gradientPreset')?.dispatchEvent(new Event('change'));
  document.getElementById('textShadow')?.dispatchEvent(new Event('change'));
  document.getElementById('borderStyle')?.dispatchEvent(new Event('change'));
  document.getElementById('textAlign')?.dispatchEvent(new Event('change'));
  document.getElementById('rotation')?.dispatchEvent(new Event('input'));
  
  document.getElementById('textAnimation')?.dispatchEvent(new Event('change'));
  document.getElementById('animationSpeed')?.dispatchEvent(new Event('input'));
  document.getElementById('animationDirection')?.dispatchEvent(new Event('input'));
  
  document.getElementById('backgroundType')?.dispatchEvent(new Event('change'));
  document.getElementById('backgroundColor')?.dispatchEvent(new Event('input'));
  document.getElementById('bgOpacity')?.dispatchEvent(new Event('input'));
}

/**
 * Show a success message after reset
 */
function showResetSuccessMessage(resetType) {
  let message = '';
  
  switch(resetType) {
    case 'all':
      message = 'All settings have been reset to defaults';
      break;
    case 'text':
      message = 'Text settings have been reset to defaults';
      break;
    case 'style':
      message = 'Style settings have been reset to defaults';
      break;
    default:
      message = 'Settings have been reset to defaults';
  }
  
  // Use notification system if available
  if (typeof showToast === 'function') {
    showToast({
      message,
      type: 'success',
      title: 'Reset Complete'
    });
  } else if (typeof showAlert === 'function') {
    showAlert(message, 'success');
  } else {
    // Fall back to standard alert
    alert(message);
  }
}

// Make reset functionality available globally
window.ResetManager = {
  resetAll: () => performReset('all'),
  resetText: () => performReset('text'),
  resetStyle: () => performReset('style')
};