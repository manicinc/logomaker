/**
 * notificationsDropInAlerts.js
 * Modern Notification System: Modals and Toasts.
 */

// --- CSS Injection (Assuming styles from original prompt are correct) ---
// --- CSS Injection ---
(function addNotificationStyles() {
  if (document.getElementById('logomaker-notification-styles')) return;
  const styleElement = document.createElement('style');
  styleElement.id = 'logomaker-notification-styles';
  styleElement.textContent = `
  /* --- Toast Notifications --- */
/* --- Base Variables (Ensure these are defined globally or adjust defaults) --- */
:root {
  --panel-bg: rgba(35, 35, 45, 0.95);
  --panel-bg-darker: #1f1f2a;
  --text-color: #f0f0f5; /* Default light text color */
  --text-color-dark: #333333; /* For light backgrounds like warning */
  --border-color: rgba(255, 255, 255, 0.1);
  --success-bg: linear-gradient(45deg, #2e7d32, #43a047); /* From your snippet */
  --error-bg: linear-gradient(45deg, #c62828, #e53935); /* From your snippet */
  --info-bg: linear-gradient(45deg, #1565c0, #1e88e5); /* From your snippet */
  --warning-bg: linear-gradient(45deg, #ef6c00, #fb8c00); /* From your snippet */
  /* Add borders if desired for toasts */
  --success-border: #2e7d32;
  --error-border: #c62828;
  --info-border: #1565c0;
  --warning-border: #ef6c00;
}

/* --- Toast Notifications --- */
.logo-toast {
  position: fixed;
  /* Option 1: Bottom Positioning (Original) */
  /* bottom: 20px; */
  /* transform: translateX(-50%) translateY(120px); */ /* Start below */

  /* Option 2: Top Positioning (Uncomment below, comment out Option 1) */
  top: 20px;
  transform: translateX(-50%) translateY(-120px); /* Start above */

  left: 50%;
  background-color: var(--panel-bg, rgba(35, 35, 45, 0.95));
  color: var(--text-color, #f0f0f5); /* ** FIX: Base text color is light ** */
  padding: 12px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  z-index: 1050;
  opacity: 0;
  /* Adjust transform based on top/bottom choice */
  transition: transform 0.4s cubic-bezier(0.215, 0.610, 0.355, 1), opacity 0.4s ease;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  max-width: 90%;
  min-width: 280px;
  font-size: 0.95rem;
  pointer-events: none;
}

.logo-toast.show {
  /* Adjust transform based on top/bottom choice */
  transform: translateX(-50%) translateY(0); /* Animate into view */
  opacity: 1;
  pointer-events: auto;
}

/* Toast Status Styles (Filled In) */
.logo-toast.success {
  background: var(--success-bg, #28a745); /* Use gradient or solid color */
  border-left: 4px solid var(--success-border, #1e7e34);
  color: white; /* ** FIX: Ensure text is white ** */
}
.logo-toast.error {
  background: var(--error-bg, #dc3545);
  border-left: 4px solid var(--error-border, #bd2130);
  color: white; /* ** FIX: Ensure text is white ** */
}
.logo-toast.warning {
  background: var(--warning-bg, #ffc107);
  border-left: 4px solid var(--warning-border, #d39e00);
  color: var(--text-color-dark, #333); /* ** FIX: Use dark text for light bg ** */
}
.logo-toast.info {
  background: var(--info-bg, #17a2b8);
  border-left: 4px solid var(--info-border, #117a8b);
  color: white; /* ** FIX: Ensure text is white ** */
}

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}
.toast-icon svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor; /* Inherits color from parent (.logo-toast) */
}
/* Ensure warning icon has correct color if needed */
.logo-toast.warning .toast-icon svg {
  fill: var(--text-color-dark, #333);
}


.toast-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.toast-title {
  font-weight: 600;
  margin-bottom: 3px;
  color: inherit; /* Inherits color from parent (.logo-toast) */
}
.toast-message {
  opacity: 0.95;
  /* ** FIX: Explicitly inherit color from parent (.logo-toast) ** */
  /* This ensures status colors are applied correctly */
  color: inherit;
}
.toast-filename {
  font-size: 0.8em;
  opacity: 0.7;
  margin-top: 4px;
  word-break: break-all;
  color: inherit; /* Inherits color from parent (.logo-toast) */
}
.toast-close {
  /* Basic close button styles */
  background: none;
  border: none;
  padding: 0 5px;
  margin: -5px -10px -5px 5px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  line-height: 1;
  align-self: flex-start;
  flex-shrink: 0;
  color: inherit; /* Inherits color from parent (.logo-toast) */
}
.toast-close:hover {
  opacity: 1;
}
.toast-close svg {
  width: 14px;
  height: 14px;
  display: block;
  fill: currentColor;
}

/* --- Modal Notifications --- */

/* ** FIX: Added Overlay Styles ** */
.notification-modal-overlay {
  position: fixed; /* ** CRITICAL: Keeps it fixed on screen ** */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.65); /* Dimming effect */
  display: flex; /* ** CRITICAL: Enables centering ** */
  align-items: center; /* ** CRITICAL: Vertical centering ** */
  justify-content: center; /* ** CRITICAL: Horizontal centering ** */
  z-index: 1040; /* Below modal, above page */
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0s linear 0.3s;
  padding: 20px; /* Add padding for smaller screens */
  box-sizing: border-box;
}
.notification-modal-overlay.active {
  opacity: 1;
  visibility: visible;
  transition: opacity 0.3s ease, visibility 0s linear 0s;
}

/* Modal Dialog */
.notification-modal {
  background-color: var(--panel-bg-darker, #1f1f2a);
  border-radius: 10px;
  width: 90%;
  max-width: 420px;
  overflow: hidden; /* Clips header background */
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  /* ** FIX: Base text color is light ** */
  color: var(--text-color, #f0f0f5);
  display: flex; /* Use flex for column layout */
  flex-direction: column;
  max-height: calc(100vh - 40px); /* Prevent modal being taller than viewport minus padding */

  /* Animation properties from your snippet */
  transform: scale(0.95);
  transition: transform 0.3s cubic-bezier(0.215, 0.610, 0.355, 1);
}

/* Modal entrance animation when overlay is active */
.notification-modal-overlay.active .notification-modal {
  transform: scale(1);
}

.notification-header {
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 1.1rem;
  flex-shrink: 0; /* Prevent header from shrinking */
  position: relative; /* For potential close button */
  /* Default - might be overridden by status */
  background-color: var(--panel-bg, #23232d);
  color: var(--text-color, #f0f0f5);
}

/* Header Status Styles (from your snippet) */
.notification-header.success { background: var(--success-bg, linear-gradient(45deg, #2e7d32, #43a047)); color: white; border-bottom-color: rgba(0,0,0,0.2); }
.notification-header.error   { background: var(--error-bg, linear-gradient(45deg, #c62828, #e53935)); color: white; border-bottom-color: rgba(0,0,0,0.2); }
.notification-header.info    { background: var(--info-bg, linear-gradient(45deg, #1565c0, #1e88e5)); color: white; border-bottom-color: rgba(0,0,0,0.2); }
.notification-header.warning { background: var(--warning-bg, linear-gradient(45deg, #ef6c00, #fb8c00)); color: white; border-bottom-color: rgba(0,0,0,0.1); }
/* Ensure warning text is white if background is dark enough, adjust if needed */

.notification-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.notification-icon svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor; /* Inherits color from header */
}

.notification-title {
  flex: 1; /* Take remaining space */
  margin: 0;
  /* Color inherited from header */
}

.notification-body {
  padding: 20px;
  line-height: 1.5;
  flex-grow: 1; /* Allow body to expand */
  overflow-y: auto; /* Add scrollbar if content overflows */
}

.notification-message {
  margin: 0 0 15px;
  /* ** FIX: Explicitly set default text color for message area ** */
  color: var(--text-color, #f0f0f5);
}
.notification-message:last-child {
  margin-bottom: 0; /* Remove margin if it's the last element */
}
.notification-message a { /* Style links */
  color: #8ab4f8; /* Example link color */
  text-decoration: none;
}
.notification-message a:hover {
  text-decoration: underline;
}


.notification-footer {
  padding: 10px 20px 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end; /* Align buttons right */
  gap: 10px; /* Space between buttons */
  background-color: rgba(0, 0, 0, 0.1);
  flex-shrink: 0; /* Prevent footer from shrinking */
}

.notification-btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease, opacity 0.2s ease;
  border: none;
  background-color: rgba(255, 255, 255, 0.15);
  /* ** FIX: Explicitly set button text color (or ensure inherit works) ** */
  color: var(--text-color, #f0f0f5);
  min-width: 90px;
  text-align: center;
}
.notification-btn:hover {
  background-color: rgba(255, 255, 255, 0.25);
  opacity: 0.9;
}
.notification-btn:active {
  transform: scale(0.97);
  opacity: 0.8;
}
/* Optional: Style specific buttons differently */
.notification-btn.primary {
   background-color: #1a73e8; /* Example primary blue */
   color: white;
}
.notification-btn.primary:hover {
   background-color: #2980e8;
}


/* Optional: Close button in header */
.notification-header .close-modal-btn {
  background: none;
  border: none;
  padding: 5px;
  margin: -5px; /* Make clickable area larger */
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  line-height: 1;
  color: inherit; /* Inherits from header */
  position: absolute;
  top: 12px; /* Adjust positioning */
  right: 15px;
}
.notification-header .close-modal-btn:hover {
  opacity: 1;
}
.notification-header .close-modal-btn svg {
  width: 18px;
  height: 18px;
  display: block;
  fill: currentColor;
}

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
  console.log("[Notifications] Initializing Notification System DOM..."); // Log init start

  const modalHTML = `
   <div id="notification-modal-overlay" class="notification-modal-overlay" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="notification-title-id">
     <div class="notification-modal">
       <div class="notification-header">
         <div class="notification-icon" aria-hidden="true"></div>
         <h3 class="notification-title" id="notification-title-id">Notification</h3>
       </div>
       <div class="notification-body">
         <!-- Added ID for aria-describedby -->
         <p class="notification-message" id="notification-message-id"></p>
       </div>
       <div class="notification-footer">
         <button class="notification-btn" id="notification-ok-btn">OK</button>
       </div>
     </div>
   </div>
 `;

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  // Append safely - check if firstChild exists
  if (modalContainer.firstElementChild) {
      document.body.appendChild(modalContainer.firstElementChild);
  } else {
       console.error("[Notifications] Failed to create modal element from HTML string.");
       return; // Stop if modal wasn't created
  }


  // Assign elements to module variables
  notificationModalOverlay = document.getElementById('notification-modal-overlay');
  // Add checks after each query
  if (!notificationModalOverlay) { console.error("[Notifications] Failed to find #notification-modal-overlay after insertion."); return; }

  notificationModalInstance = notificationModalOverlay.querySelector('.notification-modal');
  notificationHeader = notificationModalOverlay.querySelector('.notification-header');
  notificationTitleEl = document.getElementById('notification-title-id'); // Use ID selector
  notificationMessageEl = document.getElementById('notification-message-id'); // Use ID selector
  notificationIconContainer = notificationModalOverlay.querySelector('.notification-icon');
  notificationOkBtn = document.getElementById('notification-ok-btn');

  // Check if all elements were found
  if (!notificationModalInstance || !notificationHeader || !notificationTitleEl || !notificationMessageEl || !notificationIconContainer || !notificationOkBtn) {
      console.error("[Notifications] Failed to find one or more internal modal elements.");
      // Optionally remove the partially created overlay?
      // notificationModalOverlay?.remove();
      return;
  }

  const closeModal = () => {
      if (!notificationModalOverlay) return;
      notificationModalOverlay.classList.remove('active');
      notificationModalOverlay.setAttribute('aria-hidden', 'true');
      console.log("[Notifications] Modal closed via OK/Overlay/Escape.");
      // Add focus management here if implementing: return focus to trigger element
  };

  // Add core event listeners
  notificationOkBtn.addEventListener('click', closeModal);
  notificationModalOverlay.addEventListener('click', (e) => {
      if (e.target === notificationModalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && notificationModalOverlay?.classList.contains('active')) closeModal();
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
  // Ensure DOM is ready & elements are queried
  if (!notificationModalOverlay || !notificationTitleEl || !notificationMessageEl || !notificationHeader || !notificationIconContainer || !notificationOkBtn ) {
       console.error("[showModal] Notification DOM elements not ready. Cannot show modal.");
       // Fallback to console or native alert if critical
       const messageContent = typeof options === 'string' ? options : options?.message;
       console.error(`Modal Fallback [${type}]: ${messageContent}`);
       // window._originalAlert?.(`[${type}] ${messageContent}`); // Use original alert if available
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

  // Update modal content (using the renamed element variables)
  notificationHeader.className = `notification-header ${config.type}`;
  notificationTitleEl.textContent = config.title;
  notificationMessageEl.textContent = config.message;
  notificationIconContainer.innerHTML = ICONS[config.type] || ICONS.info;

  // --- Accessibility Update ---
  // Set aria-describedby if message is not empty
    if (config.message) {
      notificationModalOverlay.setAttribute('aria-describedby', 'notification-message-id');
  } else {
      notificationModalOverlay.removeAttribute('aria-describedby');
  }
  // --- End Accessibility Update ---

  // Manage close handler and auto-close timer
    // Manage close handler and auto-close timer
    let autoCloseTimeout;
    const closeHandler = () => {
         clearTimeout(autoCloseTimeout);
         notificationModalOverlay.classList.remove('active');
         notificationModalOverlay.setAttribute('aria-hidden', 'true'); // Update ARIA state
         console.log("[Notifications] Modal closeHandler executed.");
         if (typeof config.onClose === 'function') {
             try { config.onClose(); } catch (e) { console.error("Error in modal onClose callback:", e); }
         }
    };


  // Re-clone the OK button to remove previous listeners and add the new one
  const newOkBtn = notificationOkBtn.cloneNode(true);
  notificationOkBtn.parentNode.replaceChild(newOkBtn, notificationOkBtn);
  notificationOkBtn = newOkBtn; // Update module reference
  notificationOkBtn.addEventListener('click', closeHandler);

  // Show the modal
  // Re-clone the OK button to ensure only the current closeHandler is attached
  notificationOkBtn.parentNode.replaceChild(newOkBtn, notificationOkBtn);
  notificationOkBtn = newOkBtn; // Update module reference
  notificationOkBtn.addEventListener('click', closeHandler);

  // Show the modal
  notificationModalOverlay.setAttribute('aria-hidden', 'false'); // Update ARIA state
  notificationModalOverlay.classList.add('active');
  console.log(`[Notifications] Modal shown: Type=${config.type}, Title=${config.title}`);

  // Auto close if specified
  if (config.autoClose && config.autoClose > 0) {
        autoCloseTimeout = setTimeout(closeHandler, config.autoClose);
  }

  // Add basic focus management: focus the OK button when modal opens
  requestAnimationFrame(() => {
      notificationOkBtn.focus();
  });
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
function notifyExportSuccess(format, filename = null, duration = 3500) {
  // Use the default toast close duration if none is specified
  if (duration === undefined) {
    duration = 3500;
  }

  showToast({
    message: `${format} export complete!`,
    type: 'success',
    title: 'Export Successful',
    filename: filename,
    duration: duration
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