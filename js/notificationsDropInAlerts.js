/**
 * notificationsDropInAlerts.js (v2 - Consolidated)
 * Modern Notification System: Modals and Toasts.
 * Replaces basic alert() and provides specific notification functions.
 */

// --- CSS Injection (Assuming styles from original prompt are correct) ---
(function addNotificationStyles() {
  // Avoid injecting multiple times
  if (document.getElementById('logomaker-notification-styles')) return;
  const styleElement = document.createElement('style');
  styleElement.id = 'logomaker-notification-styles';
  styleElement.textContent = `
  /* --- Toast Notifications --- */
  .logo-toast {
    position: fixed; bottom: 20px; left: 50%;
    transform: translateX(-50%) translateY(120px); /* Start hidden below */
    background-color: var(--panel-bg, rgba(35, 35, 45, 0.95));
    color: var(--text-color, #f0f0f5);
    padding: 12px 20px; border-radius: 8px; display: flex;
    align-items: center; gap: 12px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    z-index: 1050; opacity: 0;
    transition: transform 0.4s cubic-bezier(0.215, 0.610, 0.355, 1), opacity 0.4s ease;
    border: 1px solid rgba(255, 255, 255, 0.1); max-width: 90%; min-width: 280px;
    font-size: 0.95rem;
  }
  .logo-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
  .logo-toast-success { border-left: 4px solid var(--success-color, #4CAF50); }
  .logo-toast-error { border-left: 4px solid var(--error-color, #F44336); }
  .logo-toast-info { border-left: 4px solid var(--accent-color, #2196F3); }
  .logo-toast-warning { border-left: 4px solid var(--warning-color, #FFC107); }
  .toast-icon { flex-shrink: 0; width: 20px; height: 20px; }
  .toast-icon svg { display: block; width: 100%; height: 100%; }
  .toast-content { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .toast-title { font-weight: 600; margin-bottom: 3px; }
  .toast-message { opacity: 0.95; }
  .toast-filename { font-size: 0.8em; opacity: 0.7; margin-top: 4px; word-break: break-all; }
  .toast-close { background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; padding: 5px; margin: -5px -10px -5px 5px; transition: opacity 0.2s; flex-shrink: 0; font-size: 1.4em; line-height: 1; }
  .toast-close:hover { opacity: 1; }

  /* --- Modal Notifications --- */
  .notification-modal-overlay {
    position: fixed; inset: 0; background-color: rgba(10, 10, 15, 0.8); z-index: 1040;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0s 0.3s linear;
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  }
  .notification-modal-overlay.active { opacity: 1; visibility: visible; transition: opacity 0.3s ease, visibility 0s 0s linear; }
  .notification-modal {
    background-color: var(--panel-bg-darker, #1f1f2a); border-radius: 10px;
    width: 90%; max-width: 420px; overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.215, 0.610, 0.355, 1);
    border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-color, #f0f0f5);
  }
  .notification-modal-overlay.active .notification-modal { transform: scale(1); }
  .notification-header { padding: 15px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 1.1rem; }
  .notification-header.success { background: linear-gradient(45deg, #2e7d32, #43a047); color: white; }
  .notification-header.error { background: linear-gradient(45deg, #c62828, #e53935); color: white; }
  .notification-header.info { background: linear-gradient(45deg, #1565c0, #1e88e5); color: white; }
  .notification-header.warning { background: linear-gradient(45deg, #ef6c00, #fb8c00); color: white; }
  .notification-icon { width: 22px; height: 22px; flex-shrink: 0; }
  .notification-icon svg { display: block; width: 100%; height: 100%; }
  .notification-title { flex: 1; margin: 0; }
  .notification-body { padding: 20px; line-height: 1.5; }
  .notification-message { margin: 0 0 15px; }
  .notification-footer { padding: 10px 20px 15px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: flex-end; background-color: rgba(0,0,0,0.1); }
  .notification-btn { padding: 8px 20px; border-radius: 6px; font-weight: 500; cursor: pointer; transition: background-color 0.2s ease, transform 0.1s ease; border: none; background-color: rgba(255, 255, 255, 0.15); color: inherit; min-width: 90px; text-align: center; }
  .notification-btn:hover { background-color: rgba(255, 255, 255, 0.25); }
  .notification-btn:active { transform: scale(0.97); }

  /* Other styles (Reset Modal, Loading) assumed to be correct from original */
  /* Ensure .modal-overlay, .modal-content etc. for Reset Modal are defined */
  /* Ensure .loading-indicator styles are defined */
`;
  document.head.appendChild(styleElement);
})();

// --- DOM Elements Initialization ---
let notificationModalOverlay = null;
let notificationModalInstance = null;
let notificationHeader = null;
let notificationTitle = null;
let notificationMessage = null;
let notificationIconContainer = null;
let notificationOkBtn = null;

function initNotificationSystemDOM() {
  // Prevent re-initialization
  if (document.getElementById('notification-modal-overlay')) return;

  const modalHTML = `
   <div id="notification-modal-overlay" class="notification-modal-overlay">
     <div class="notification-modal">
       <div class="notification-header">
         <div class="notification-icon"></div>
         <h3 class="notification-title">Notification</h3>
       </div>
       <div class="notification-body">
         <p class="notification-message"></p>
       </div>
       <div class="notification-footer">
         <button class="notification-btn" id="notification-ok-btn">OK</button>
       </div>
     </div>
   </div>
 `;

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer.firstElementChild);

  // Assign elements to module variables
  notificationModalOverlay = document.getElementById('notification-modal-overlay');
  notificationModalInstance = notificationModalOverlay.querySelector('.notification-modal');
  notificationHeader = notificationModalOverlay.querySelector('.notification-header');
  notificationTitle = notificationModalOverlay.querySelector('.notification-title');
  notificationMessage = notificationModalOverlay.querySelector('.notification-message');
  notificationIconContainer = notificationModalOverlay.querySelector('.notification-icon');
  notificationOkBtn = document.getElementById('notification-ok-btn');

  // Add core event listeners
  notificationOkBtn.addEventListener('click', () => {
      notificationModalOverlay.classList.remove('active');
  });

  notificationModalOverlay.addEventListener('click', (e) => {
      if (e.target === notificationModalOverlay) {
          notificationModalOverlay.classList.remove('active');
      }
  });

  document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && notificationModalOverlay?.classList.contains('active')) {
          notificationModalOverlay.classList.remove('active');
      }
  });
   console.log("[Notifications] DOM Initialized.");
}

// Initialize DOM elements when the document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotificationSystemDOM);
} else {
  initNotificationSystemDOM(); // Initialize if DOM is already ready
}

// --- Icon SVGs ---
const ICONS = {
  success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
  error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
};

/** Get a default title based on notification type */
function getDefaultTitle(type) {
  switch (type) {
      case 'success': return 'Success!';
      case 'error': return 'Error';
      case 'warning': return 'Warning';
      case 'info': default: return 'Information';
  }
}

// --- Public Notification Functions ---

/**
* Shows a toast notification.
* @param {object|string} options - Notification options object or message string.
* @param {string} options.message - The message to display.
* @param {string} [options.type='info'] - 'success', 'error', 'info', 'warning'.
* @param {string} [options.title] - Optional title.
* @param {number} [options.duration=3000] - Duration in ms before auto-close.
* @param {string} [options.filename] - Optional filename to display.
* @param {string} [type='info'] - Fallback type if options is a string.
*/
function showToast(options, type = 'info') {
  let config = {
      message: '',
      type: 'info',
      title: '',
      duration: 3000,
      filename: null
  };

  if (typeof options === 'string') {
      config.message = options;
      config.type = type;
  } else if (typeof options === 'object' && options !== null) {
      config = { ...config, ...options };
  } else {
      console.error("[showToast] Invalid options provided:", options);
      return;
  }

  // Basic validation
  if (!config.message) {
       console.error("[showToast] Message is required.");
       return;
  }
  config.type = ['success', 'error', 'info', 'warning'].includes(config.type) ? config.type : 'info';

  const toast = document.createElement('div');
  toast.className = `logo-toast logo-toast-${config.type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  const iconSvg = ICONS[config.type] || ICONS.info;
  const closeIconSvg = ICONS.close;

  toast.innerHTML = `
    <div class="toast-icon" aria-hidden="true">${iconSvg}</div>
    <div class="toast-content">
      ${config.title ? `<div class="toast-title">${config.title}</div>` : ''}
      <div class="toast-message">${config.message}</div>
      ${config.filename ? `<div class="toast-filename">${config.filename}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Close notification">${closeIconSvg}</button>
  `;

  document.body.appendChild(toast);

  // Close button functionality
  const closeBtn = toast.querySelector('.toast-close');
  let autoCloseTimeout;

  const closeToast = () => {
      clearTimeout(autoCloseTimeout);
      toast.classList.remove('show');
      // Remove the element after the transition completes
      toast.addEventListener('transitionend', () => {
          if (toast.parentNode) {
              toast.parentNode.removeChild(toast);
          }
      }, { once: true });
       // Failsafe removal
       setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 500);
  };

  closeBtn.addEventListener('click', closeToast);

  // Animate in
  requestAnimationFrame(() => {
       requestAnimationFrame(() => { // Double rAF for better transition start
           toast.classList.add('show');
       });
  });


  // Auto-close after duration
  if (config.duration > 0) {
       autoCloseTimeout = setTimeout(closeToast, config.duration);
  }
}

/**
* Shows a modal notification.
* @param {object|string} options - Notification options object or message string.
* @param {string} options.message - The message to display.
* @param {string} [options.type='info'] - 'success', 'error', 'info', 'warning'.
* @param {string} [options.title] - Title for the modal.
* @param {Function} [options.onClose] - Callback function when the modal is closed.
* @param {number} [options.autoClose] - Auto close after ms (optional, 0 or null for no auto-close).
* @param {string} [type='info'] - Fallback type if options is a string.
*/
function showModal(options, type = 'info') {
  // Ensure DOM is ready
  if (!notificationModalOverlay) {
      console.error("[showModal] Notification DOM not ready. Retrying...");
      setTimeout(() => showModal(options, type), 100); // Retry after delay
      return;
  }

   let config = {
      message: '',
      type: 'info',
      title: '',
      onClose: null,
      autoClose: null
  };

  if (typeof options === 'string') {
      config.message = options;
      config.type = type;
      config.title = getDefaultTitle(type);
  } else if (typeof options === 'object' && options !== null) {
      config = { ...config, ...options };
      config.title = config.title || getDefaultTitle(config.type); // Ensure title fallback
  } else {
      console.error("[showModal] Invalid options provided:", options);
      return;
  }

  // Basic validation
   if (!config.message) {
       console.error("[showModal] Message is required.");
       return;
  }
  config.type = ['success', 'error', 'info', 'warning'].includes(config.type) ? config.type : 'info';


  // Update modal content
  notificationHeader.className = `notification-header ${config.type}`; // Set header style
  notificationTitle.textContent = config.title;
  notificationMessage.textContent = config.message;
  notificationIconContainer.innerHTML = ICONS[config.type] || ICONS.info;

  // Manage close handler and auto-close timer
  let autoCloseTimeout;
  const closeHandler = () => {
      clearTimeout(autoCloseTimeout);
      notificationModalOverlay.classList.remove('active');
      if (typeof config.onClose === 'function') {
          try { config.onClose(); } catch (e) { console.error("Error in modal onClose callback:", e); }
      }
      // Remove the specific listener after close to prevent memory leaks if needed
      // Although cloning the button effectively does this too.
  };

  // Re-clone the OK button to remove previous listeners and add the new one
  const newOkBtn = notificationOkBtn.cloneNode(true);
  notificationOkBtn.parentNode.replaceChild(newOkBtn, notificationOkBtn);
  notificationOkBtn = newOkBtn; // Update module reference
  notificationOkBtn.addEventListener('click', closeHandler);

  // Show the modal
  notificationModalOverlay.classList.add('active');

  // Auto close if specified
  if (config.autoClose && config.autoClose > 0) {
      autoCloseTimeout = setTimeout(closeHandler, config.autoClose);
  }
}

// --- Alert Overrides and Specific Notifications ---

/** Replaces the default window.alert */
function replaceAlerts() {
  if (window._originalAlert) return; // Prevent overriding multiple times
  window._originalAlert = window.alert; // Store original

  window.alert = function(message) {
      console.warn('Intercepted alert:', message); // Log interception

      // Basic context detection (improve as needed)
      let type = 'info';
      let useModal = false;
      let title = '';

      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('error') || lowerMsg.includes('failed') || lowerMsg.includes('invalid')) {
          type = 'error'; useModal = true; title = 'Error';
      } else if (lowerMsg.includes('success') || lowerMsg.includes('copied') || lowerMsg.includes('complete') || lowerMsg.includes('saved') || lowerMsg.includes('reset')) {
          type = 'success'; title = 'Success!';
      } else if (lowerMsg.includes('warning') || lowerMsg.includes('confirm')) {
          type = 'warning'; useModal = true; title = 'Warning';
      }

      // Use modal for errors/warnings, toast otherwise
      if (useModal) {
          showModal({ message: message, type: type, title: title });
      } else {
          showToast({ message: message, type: type, title: title, duration: 3500 });
      }
  };
  console.log("[Notifications] window.alert overridden.");
}

// Replace alert when the script loads (assuming DOM might be ready)
replaceAlerts();

/** Simple alert replacement */
function showAlert(message, type = 'info') {
  // Use modal for errors/warnings, toast for info/success
  if (type === 'error' || type === 'warning') {
       showModal({ message, type });
  } else {
       showToast({ message, type, duration: 3000 });
  }
}

/** Notify when text copied */
function notifyCopied(itemType = 'Text') {
  showToast({ message: `${itemType} copied to clipboard!`, type: 'success', title: 'Copied!', duration: 2000 });
}

/** Notify export error */
function notifyExportError(format, errorMsg) {
  showModal({ message: `Error exporting ${format}: ${errorMsg}`, type: 'error', title: 'Export Failed' });
}

/** Notify export success */
function notifyExportSuccess(format, filename = null) {
  showToast({
      message: `${format} export complete!`,
      type: 'success',
      title: 'Export Successful',
      filename: filename, // Show filename in toast
      duration: 3500
  });
}

/** Notify reset success */
function notifyResetSuccess(resetType = 'all') {
  let message = 'Settings reset to defaults.';
  if (resetType === 'text') message = 'Text settings reset to defaults.';
  else if (resetType === 'style') message = 'Style & background settings reset to defaults.';
  else if (resetType === 'all') message = 'All settings reset to defaults.';

  showToast({ message, type: 'success', title: 'Reset Complete', duration: 2500 });
}


// Remove redundant reset modal init from here - handled by resetConfirmation.js
// Remove replaceSpecificAlerts - the main alert override should handle most cases. Export handlers use specific notify functions.

// --- Global Exports ---
window.showAlert = showAlert;
window.showToast = showToast;
window.showModal = showModal;
window.notifyCopied = notifyCopied;
window.notifyExportError = notifyExportError;
window.notifyExportSuccess = notifyExportSuccess;
window.notifyResetSuccess = notifyResetSuccess;

console.log("[Notifications] Module loaded, functions exposed globally.");