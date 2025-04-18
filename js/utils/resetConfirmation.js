/**
 * resetConfirmation.js
 * Handles the reset confirmation modal and reset functionality
 */

// Import SettingsManager
import SettingsManager from '../settingsManager.js';

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
    console.warn('[ResetConfirmation] Reset modal elements not found');
    return;
  }
  
  console.log('[ResetConfirmation] Reset modal initialized');
  
  // Show modal when reset button is clicked
  resetBtn.addEventListener('click', function() {
    resetConfirmModal.classList.add('active');
    resetConfirmModal.style.display = 'flex';
    
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
    const resetTypeInput = document.querySelector('input[name="reset-type"]:checked');
    
    if (!resetTypeInput) {
      console.error('[ResetConfirmation] No reset type selected');
      if (typeof showAlert === 'function') {
        showAlert('Please select a reset option', 'warning');
      }
      return;
    }
    
    const resetType = resetTypeInput.value;
    
    // Perform the reset based on the selected type
    performReset(resetType);
    
    // Close the modal
    closeResetModal();
  });
  
  // Function to close the modal
  function closeResetModal() {
    resetConfirmModal.classList.remove('active');
    setTimeout(() => {
      resetConfirmModal.style.display = 'none';
    }, 300);
    document.body.style.overflow = '';
  }
}

/**
 * Perform the reset based on the selected type
 * @param {string} resetType - Type of reset: 'all', 'text', 'style', etc.
 */
function performReset(resetType) {
  console.log(`[ResetConfirmation] Attempting to reset settings: ${resetType}`);
  
  try {
    if (SettingsManager && typeof SettingsManager.resetSettings === 'function') {
      SettingsManager.resetSettings(resetType);
      showResetSuccessMessage(resetType);
    } else {
      console.error('[ResetConfirmation] SettingsManager not available or resetSettings method missing');
      if (typeof showAlert === 'function') {
        showAlert('Reset functionality is not available', 'error');
      }
    }
  } catch (error) {
    console.error('[ResetConfirmation] Error during reset:', error);
    if (typeof showAlert === 'function') {
      showAlert('Error resetting settings', 'error');
    }
  }
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
    case 'border':
      message = 'Border settings have been reset to defaults';
      break;
    case 'background':
      message = 'Background settings have been reset to defaults';
      break;
    case 'animation':
      message = 'Animation settings have been reset to defaults';
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
  resetStyle: () => performReset('style'),
  resetBorder: () => performReset('border'),
  resetBackground: () => performReset('background'),
  resetAnimation: () => performReset('animation')
};

// Export the module
export default window.ResetManager;