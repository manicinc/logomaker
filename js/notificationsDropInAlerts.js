// --- CSS Injection ---
(function addNotificationStyles() {
  if (document.getElementById('logomaker-notification-styles')) return;
  const styleElement = document.createElement('style');
  styleElement.id = 'logomaker-notification-styles';
  styleElement.textContent = `
  /* --- Toast Notifications --- */
  .logo-toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-120px); /* Start above */
    
    /* Inherit colors from CSS variables for theme compatibility */
    background-color: var(--panel-bg-opaque, #333); /* Added fallback */
    color: var(--text-color, #eee); /* Added fallback */
    
    padding: 12px 20px;
    border-radius: var(--border-radius-md, 6px); /* Added fallback */
    display: flex;
    align-items: center; /* Base alignment */
    gap: 12px; /* Base gap */
    box-shadow: var(--box-shadow-md, 0 4px 12px rgba(0,0,0,0.15)); /* Added fallback */
    z-index: 1050;
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.215, 0.610, 0.355, 1), opacity 0.4s ease;
    border: 1px solid var(--border-color, #555); /* Added fallback */
    
    /* Improved responsive width */
    width: clamp(280px, 90%, 500px);
    
    font-size: 0.95rem;
    pointer-events: none;
    box-sizing: border-box; /* Add globally */
    overflow: hidden; /* Add globally */
  }

  .logo-toast.show {
    transform: translateX(-50%) translateY(0); /* Animate into view */
    opacity: 1;
    pointer-events: auto;
  }

  /* Toast Status Styles with better contrast */
  .logo-toast.success { background: linear-gradient(45deg, #1c8a3c, #2eae50); border-left: 4px solid #186e30; color: white; }
  .logo-toast.error { background: linear-gradient(45deg, #c62828, #e53935); border-left: 4px solid #9b1c1c; color: white; }
  .logo-toast.warning { background: linear-gradient(45deg, #ef6c00, #fb8c00); border-left: 4px solid #c85800; color: #050505; }
  .logo-toast.info { background: linear-gradient(45deg, #0d47a1, #1565c0); border-left: 4px solid #073777; color: white; }

  /* Improved icon styling */
  .toast-icon {
    flex: 0 0 20px; /* Explicit flex basis, no shrink */
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 0; /* Remove default margin, use gap */
  }
  
  .toast-icon svg { display: block; width: 100%; height: 100%; fill: currentColor; }
  .logo-toast.warning .toast-icon svg { fill: #050505; } /* Warning icon color */

  /* Content Area */
  .toast-content {
    flex: 1 1 auto; /* Allow grow/shrink */
    display: flex; /* Use flex column for vertical layout */
    flex-direction: column;
    gap: 2px;
    overflow: hidden; /* Hide overflow */
    min-width: 0; /* Allow shrinking */
  }
  
  .toast-title { font-weight: var(--font-weight-semibold); margin-bottom: 3px; color: inherit; }
  .toast-message { opacity: 0.95; color: inherit; font-size: 0.9rem; line-height: 1.4; word-wrap: break-word; }
  .toast-filename { font-size: 0.8em; opacity: 0.85; margin-top: 4px; word-break: break-all; color: inherit; line-height: 1.2;}
  
  /* Close Button */
  .toast-close {
    flex: 0 0 auto; /* No grow/shrink */
    background: none; border: none; padding: 5px; /* Adjusted padding */
    margin: -5px -10px -5px 0px; /* Adjust negative margins, remove margin-left as gap handles it */
    cursor: pointer; opacity: 0.8; transition: opacity 0.2s ease;
    line-height: 1; align-self: flex-start; /* Align top */
    display: flex; /* Center icon */
    align-items: center;
    justify-content: center;
  }
  .toast-close:hover { opacity: 1; }
  .toast-close svg { width: 16px; height: 16px; display: block; fill: currentColor; } /* Slightly bigger base icon */

  /* --- Modal Notifications --- (Keep as is for now) */
  /* ... [Modal CSS unchanged] ... */
  .notification-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1040; opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0s linear 0.3s; padding: 20px; box-sizing: border-box; }
  .notification-modal-overlay.active { opacity: 1; visibility: visible; transition: opacity 0.3s ease, visibility 0s linear 0s; }
  .notification-modal { background-color: var(--panel-bg-opaque); border-radius: var(--border-radius-md); width: 90%; max-width: 420px; overflow: hidden; box-shadow: var(--box-shadow-lg); border: 1px solid var(--border-color); color: var(--text-color); display: flex; flex-direction: column; max-height: calc(100vh - 40px); transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.215, 0.610, 0.355, 1); }
  .notification-modal-overlay.active .notification-modal { transform: scale(1); }
  .notification-header { padding: 15px 20px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 10px; font-weight: var(--font-weight-semibold); font-size: 1.1rem; flex-shrink: 0; position: relative; background-color: var(--panel-bg); color: var(--text-color); }
  .notification-header.success { background: linear-gradient(45deg, #1c8a3c, #2eae50); color: white; border-bottom-color: rgba(0,0,0,0.2); }
  .notification-header.error { background: linear-gradient(45deg, #c62828, #e53935); color: white; border-bottom-color: rgba(0,0,0,0.2); }
  .notification-header.info { background: linear-gradient(45deg, #0d47a1, #1565c0); color: white; border-bottom-color: rgba(0,0,0,0.2); }
  .notification-header.warning { background: linear-gradient(45deg, #ef6c00, #fb8c00); color: #050505; border-bottom-color: rgba(0,0,0,0.1); }
  .notification-icon { width: 22px; height: 22px; flex-shrink: 0; }
  .notification-icon svg { display: block; width: 100%; height: 100%; fill: currentColor; }
  .notification-header.warning .notification-icon svg { fill: #050505; }
  .notification-title { flex: 1; margin: 0; }
  .notification-body { padding: 20px; line-height: 1.5; flex-grow: 1; overflow-y: auto; background-color: var(--panel-bg-opaque); color: var(--text-color); }
  .notification-message { margin: 0 0 15px; color: var(--text-color); }
  .notification-message:last-child { margin-bottom: 0; }
  .notification-message a { color: var(--accent-color); text-decoration: none; }
  .notification-message a:hover { text-decoration: underline; opacity: 0.9; }
  .notification-footer { padding: 10px 20px 15px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 10px; background-color: rgba(0, 0, 0, 0.1); flex-shrink: 0; }
  .notification-btn { padding: 8px 20px; border-radius: var(--border-radius-sm); font-weight: var(--font-weight-medium); cursor: pointer; transition: background-color 0.2s ease, transform 0.1s ease, opacity 0.2s ease; border: none; background-color: var(--border-color); color: var(--text-color); min-width: 90px; text-align: center; }
  .notification-btn:hover { background-color: var(--border-highlight); opacity: 0.9; }
  .notification-btn:active { transform: scale(0.97); opacity: 0.8; }
  .notification-btn.primary { background-color: var(--accent-color); color: var(--text-color-on-accent); }
  .notification-btn.primary:hover { background-color: color-mix(in srgb, var(--accent-color) 85%, white 15%); }
  .notification-header .close-modal-btn { background: none; border: none; padding: 5px; margin: -5px; cursor: pointer; opacity: 0.8; transition: opacity 0.2s ease; line-height: 1; color: inherit; position: absolute; top: 12px; right: 15px; }
  .notification-header .close-modal-btn:hover { opacity: 1; }
  .notification-header .close-modal-btn svg { width: 18px; height: 18px; display: block; fill: currentColor; }

/* --- Mobile Optimizations --- */
 @media (max-width: 767px) {
   .logo-toast {
     /* --- Container Styles --- */
     display: flex !important; 
     align-items: flex-start !important; /* Align items to the top */
     width: calc(100% - 20px) !important; 
     max-width: 100% !important;
     padding: 12px 16px !important; 
     top: 10px !important; 
     left: 10px !important; 
     transform: translateX(0) translateY(-100px) !important; 
     right: auto !important; 
     margin: 0 !important; 
     height: auto !important; 
     z-index: 1051 !important; 
     gap: 0 !important; /* Remove base gap, use explicit margins */
     /* Base colors (will be overridden by status) */
     background-color: var(--panel-bg-opaque, #333) !important; 
     color: var(--text-color, #eee) !important;
     border-radius: var(--border-radius-md, 6px) !important;
     border: 1px solid var(--border-color, #555) !important;
     box-shadow: var(--box-shadow-md, 0 4px 12px rgba(0,0,0,0.15)) !important;
     overflow: hidden !important; /* Keep */
   }
   
   .logo-toast.show {
     transform: translateX(0) translateY(0) !important; 
     opacity: 1 !important; 
     visibility: visible !important;
   }

    /* --- Status Overrides (ensure !important) --- */
    .logo-toast.success { background: linear-gradient(45deg, #1c8a3c, #2eae50) !important; border-left: 4px solid #186e30 !important; color: white !important; }
    .logo-toast.error { background: linear-gradient(45deg, #c62828, #e53935) !important; border-left: 4px solid #9b1c1c !important; color: white !important; }
    .logo-toast.warning { background: linear-gradient(45deg, #ef6c00, #fb8c00) !important; border-left: 4px solid #c85800 !important; color: #050505 !important; }
    .logo-toast.info { background: linear-gradient(45deg, #0d47a1, #1565c0) !important; border-left: 4px solid #073777 !important; color: white !important; }
   
   /* --- Icon Styles --- */
   .toast-icon {
       flex: 0 0 20px !important; 
       width: 20px !important; height: 20px !important;
       margin-right: 12px !important; /* Explicit space */
       margin-top: 2px !important; /* Align top */
       display: flex !important; align-items: center !important; justify-content: center !important;
   }
   .toast-icon svg { display: block !important; width: 100% !important; height: 100% !important; fill: currentColor !important; }
   .logo-toast.warning .toast-icon svg { fill: #050505 !important; }

   /* --- Content Area Styles --- */
   .toast-content {
       flex: 1 1 auto !important; 
       min-width: 0 !important; /* Allow shrinking */
       overflow: hidden !important; 
       display: block !important;   
       /* Removed debug background */
   }

   /* --- Text Element Styles --- */
   .toast-title {
       display: block !important; font-weight: var(--font-weight-semibold, 600) !important;
       margin-bottom: 4px !important; color: inherit !important; 
       font-size: 1rem !important; line-height: 1.3 !important;
       /* Removed debug background */
   }
   .toast-message {
       display: block !important; font-size: 0.9rem !important; line-height: 1.4 !important;
       color: inherit !important; /* Inherit text color correctly */
       opacity: 0.95 !important; margin: 0 !important; 
       height: auto !important; word-wrap: break-word !important;
       /* Removed debug background and forced color */
   }
   .toast-filename {
       display: block !important; font-size: 0.8em !important; opacity: 0.85 !important; 
       margin-top: 5px !important; word-break: break-all !important; color: inherit !important;
       line-height: 1.2 !important;
       /* Removed debug background */
   }
   
   /* --- Close Button Styles (Cleaned) --- */
   .toast-close {
       flex: 0 0 auto !important; 
       margin-left: 12px !important; /* Explicit space */
       padding: 5px !important; 
       width: 32px !important; max-width: 32px !important; 
       height: 32px !important; max-height: 32px !important;
       box-sizing: border-box !important; 
       align-self: flex-start !important; /* Align to top */
       background: none !important; /* No background */
       border: none !important; cursor: pointer !important;
       opacity: 0.8 !important;
       display: flex !important; align-items: center !important; justify-content: center !important;
       line-height: 1 !important; 
       overflow: hidden !important;
       border-radius: 4px; /* Keep slight rounding */
   }
    .toast-close:hover { 
        opacity: 1 !important; 
        /* background: rgba(0,0,0,0.1) !important; /* Optional: subtle hover background */
    }

   .toast-close svg {
       display: block !important; width: 16px !important; height: 16px !important;
       /* Explicit fill for contrast */
       fill: rgba(255, 255, 255, 0.9) !important; 
   }

   /* Force warning toast SVG color */
   .logo-toast.warning .toast-close svg { fill: rgba(0, 0, 0, 0.7) !important; }
   /* Fix for default toast on light themes if needed */
   body.light-mode .logo-toast:not(.success):not(.error):not(.info):not(.warning) .toast-close svg { fill: rgba(0, 0, 0, 0.7) !important; }
   /* Fix for default toast on dark themes */
   body:not(.light-mode) .logo-toast:not(.success):not(.error):not(.info):not(.warning) .toast-close svg { fill: rgba(255, 255, 255, 0.9) !important; }
   
   /* --- END MOBILE FIX --- */
   
   /* Other mobile styles */
    .notification-modal { width: 95% !important; /* ... etc ... */ }
  }
  `;
  document.head.appendChild(styleElement);
})();


// --- DOM Elements Initialization ---
let notificationModalOverlay = null;
let notificationModalInstance = null;
let notificationHeader = null;
let notificationTitleEl = null;
let notificationMessageEl = null;
let notificationIconContainer = null;
let notificationOkBtn = null;

/**
 * Initialize the notification system DOM
 * Creates modal structure if it doesn't exist
 */
function initNotificationSystemDOM() {
  // Prevent re-initialization
  if (document.getElementById('notification-modal-overlay')) return;
  console.log("[Notifications] Initializing Notification System DOM...");

  const modalHTML = `
    <div id="notification-modal-overlay" class="notification-modal-overlay" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="notification-title-id">
      <div class="notification-modal">
        <div class="notification-header">
          <div class="notification-icon" aria-hidden="true"></div>
          <h3 class="notification-title" id="notification-title-id">Notification</h3>
        </div>
        <div class="notification-body">
          <p class="notification-message" id="notification-message-id"></p>
        </div>
        <div class="notification-footer">
          <button class="notification-btn primary" id="notification-ok-btn">OK</button>
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
  if (!notificationModalOverlay) { 
    console.error("[Notifications] Failed to find #notification-modal-overlay after insertion."); 
    return; 
  }

  notificationModalInstance = notificationModalOverlay.querySelector('.notification-modal');
  notificationHeader = notificationModalOverlay.querySelector('.notification-header');
  notificationTitleEl = document.getElementById('notification-title-id');
  notificationMessageEl = document.getElementById('notification-message-id');
  notificationIconContainer = notificationModalOverlay.querySelector('.notification-icon');
  notificationOkBtn = document.getElementById('notification-ok-btn');

  // Check if all elements were found
  if (!notificationModalInstance || !notificationHeader || !notificationTitleEl || 
      !notificationMessageEl || !notificationIconContainer || !notificationOkBtn) {
    console.error("[Notifications] Failed to find one or more internal modal elements.");
    return;
  }

  const closeModal = () => {
    if (!notificationModalOverlay) return;
    notificationModalOverlay.classList.remove('active');
    notificationModalOverlay.setAttribute('aria-hidden', 'true');
    console.log("[Notifications] Modal closed via OK/Overlay/Escape.");
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

  // Check for existing toast with same content to prevent duplicates
  const existingToasts = document.querySelectorAll('.logo-toast');
  for (const existing of existingToasts) {
    if (existing.querySelector('.toast-message')?.textContent === config.message) {
      console.log("[showToast] Duplicate toast prevented");
      return;
    }
  }

  const toast = document.createElement('div');
  toast.className = `logo-toast ${config.type}`;
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
    setTimeout(() => { 
      if (toast.parentNode) toast.parentNode.removeChild(toast); 
    }, 500);
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
  if (!notificationModalOverlay || !notificationTitleEl || !notificationMessageEl || 
      !notificationHeader || !notificationIconContainer || !notificationOkBtn ) {
    console.error("[showModal] Notification DOM elements not ready. Cannot show modal.");
    // Fallback to console or native alert if critical
    const messageContent = typeof options === 'string' ? options : options?.message;
    console.error(`Modal Fallback [${type}]: ${messageContent}`);
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
  notificationHeader.className = `notification-header ${config.type}`;
  notificationTitleEl.textContent = config.title;
  notificationMessageEl.textContent = config.message;
  notificationIconContainer.innerHTML = ICONS[config.type] || ICONS.info;

  // Set aria-describedby if message is not empty
  if (config.message) {
    notificationModalInstance.setAttribute('aria-describedby', 'notification-message-id');
  } else {
    notificationModalInstance.removeAttribute('aria-describedby');
  }

  // Manage close handler and auto-close timer
  let autoCloseTimeout;
  const closeHandler = () => {
    clearTimeout(autoCloseTimeout);
    notificationModalOverlay.classList.remove('active');
    notificationModalOverlay.setAttribute('aria-hidden', 'true');
    console.log("[Notifications] Modal closeHandler executed.");
    if (typeof config.onClose === 'function') {
      try { 
        config.onClose(); 
      } catch (e) { 
        console.error("Error in modal onClose callback:", e); 
      }
    }
  };

  // Re-clone the OK button to remove previous listeners and add the new one
  const newOkBtn = notificationOkBtn.cloneNode(true);
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

// Replace alert when the script loads
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
  showToast({ 
    message: `${itemType} copied to clipboard!`, 
    type: 'success', 
    title: 'Copied!', 
    duration: 2000 
  });
}

/** Notify export error */
function notifyExportError(format, errorMsg) {
  showModal({ 
    message: `Error exporting ${format}: ${errorMsg}`, 
    type: 'error', 
    title: 'Export Failed' 
  });
}

/** Notify export success */
function notifyExportSuccess(format, filename = null, duration = 3500) {
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

  showToast({ 
    message, 
    type: 'success', 
    title: 'Reset Complete', 
    duration: 2500 
  });
}

/**
 * Helper function to determine if we're on a mobile device
 * @returns {boolean} True if on mobile device
 */
function isMobileDevice() {
  return window.innerWidth < 768 || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Helper function to determine if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
  // First check body class (our own implementation)
  if (document.body.classList.contains('light-mode')) {
    return false;
  }
  
  // Then try to detect OS/browser preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return true;
  }
  
  // Default to dark if unsure (since our default theme seems to be dark)
  return true;
}

/**
 * Notify the user about a new feature or important information
 * Shows only once per session using localStorage
 * @param {string} id - Unique ID for this notification
 * @param {string} message - Message to display
 * @param {string} title - Title for the notification
 */
function notifyFeature(id, message, title = 'New Feature!') {
  // Check if notification has been shown before
  const notificationsShown = JSON.parse(localStorage.getItem('notificationsShown') || '{}');
  
  if (!notificationsShown[id]) {
    showToast({
      message: message,
      type: 'info',
      title: title,
      duration: 6000 // Show longer for feature notifications
    });
    
    // Mark notification as shown
    notificationsShown[id] = Date.now();
    localStorage.setItem('notificationsShown', JSON.stringify(notificationsShown));
  }
}

// --- Global Exports ---
window.showAlert = showAlert;
window.showToast = showToast;
window.showModal = showModal;
window.notifyCopied = notifyCopied;
window.notifyExportError = notifyExportError;
window.notifyExportSuccess = notifyExportSuccess;
window.notifyResetSuccess = notifyResetSuccess;
window.notifyFeature = notifyFeature;

console.log("[Notifications] Module loaded, functions exposed globally.");