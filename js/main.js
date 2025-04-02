/**
 * main.js (Version 9 - Strict Init Order & Cleanup)
 * ========================================
 * Core initialization and orchestration for Logomaker.
 * Ensures modules initialize in the correct order (Fonts -> Settings -> UI).
 * Binds primary UI event handlers.
 */

// --- Imports ---
// Import handlers for button binding
import {
    handlePNGExport, handleSVGExport, handleGIFExport, handleHTMLCopy, handleCSSCopy
} from './exportHandler.js';

// Import initializers for core modules
import { initializeFonts } from './fontManager.js'; // CRITICAL: Must run first
import SettingsManager from './settingsManager.js'; // Default export

// Other UI initializers (assume they expose functions globally or are self-initializing)
// import { setupTabNavigation } from './tabs.js'; // Loaded via script tag, assumes global function window.setupTabNavigation
// import { initResetModal } from './resetConfirmation.js'; // Loaded via script tag, assumes global function window.initResetModal
// import { initMobileFeatures } from './mobile.js'; // Loaded via script tag, assumes global function window.initMobileFeatures
// Notifications system initializes itself via script tag / DOMContentLoaded

console.log('[Logomaker] main.js executing.');

// --- Initialization Sequence ---

// Use DOMContentLoaded to ensure the basic HTML structure is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Logomaker] DOMContentLoaded event fired.');
    // Start the asynchronous initialization process
    await initializeApp();
});

/**
 * Main asynchronous initialization function for the application.
 * Orchestrates the setup sequence: Fonts -> Settings -> Other UI -> Listeners.
 */
async function initializeApp() {
    console.log('[Logomaker] Initializing Application...');
    const startTime = performance.now();

    // --- Initialize Core Modules in Strict Order ---

    // 1. Initialize Fonts FIRST (Critical Dependency)
    let fontsInitialized = false;
    try {
        console.log('[Logomaker] Starting Font Manager initialization...');
        fontsInitialized = await initializeFonts(); // Wait for fonts & dropdown population
        if (fontsInitialized) {
            console.log('[Logomaker] Font Manager initialized successfully.');
        } else {
            // Font manager handles its own fallbacks and warnings
            console.error('[Logomaker] Font Manager initialization reported issues. Proceeding with fallbacks.');
        }
    } catch (e) {
        console.error("[Logomaker] CRITICAL Error during font initialization:", e);
        // Optionally display a user-facing error here, but proceed as FontManager might have setup fallbacks
        // alert("Error loading fonts. Some features may be limited.");
    }

    // 2. Initialize Settings Manager AFTER fonts are populated/ready
    // SettingsManager reads dropdown state and applies saved settings.
    let settingsInitialized = false;
    if (typeof SettingsManager?.init === 'function') {
        try {
            console.log('[Logomaker] Starting SettingsManager initialization...');
            // SettingsManager.init() itself might have internal async steps or timeouts
            await SettingsManager.init(); // Assuming init might be async or we wait for its effects
            settingsInitialized = true;
            console.log('[Logomaker] SettingsManager initialization finished.');
        } catch (e) {
            console.error("[Logomaker] CRITICAL Error initializing SettingsManager:", e);
            alert("Critical Error: Settings Manager failed to load. Application cannot function correctly.");
            return; // Halt initialization if SettingsManager fails
        }
    } else {
        console.error('[Logomaker] CRITICAL Error: SettingsManager is missing or invalid! Cannot proceed.');
        alert("Critical Error: Settings Manager is missing. Application cannot start.");
        return; // Halt initialization
    }

    // 3. Initialize other UI components (Tabs, Modals, Mobile specific)
    // These often depend on SettingsManager being ready.
    // Use a minimal delay OR preferably ensure SettingsManager.init signals readiness if it has internal delays.
    // Assuming SettingsManager.init is effectively synchronous or we don't need to wait further here.
    console.log('[Logomaker] Initializing other UI components...');
    try {
        // Call initializers if they expose functions and exist globally
        if (typeof window.setupTabNavigation === 'function') { window.setupTabNavigation(); } else { console.warn('setupTabNavigation not found on window.'); }
        if (typeof window.initResetModal === 'function') { window.initResetModal(); } else { console.warn('initResetModal not found on window.'); } // Handles Reset Modal display
        if (typeof window.initMobileFeatures === 'function') { window.initMobileFeatures(); } else { console.warn('initMobileFeatures not found on window.'); }
        // Notification system initializes itself via its own script/DOMContentLoaded listener

        // 4. Bind Core UI Event Listeners (Export buttons, Preview Toggle, Global)
        // Ensure this runs after elements are definitely ready and other setup is done.
        initializeButtonHandlers();
        initializeGlobalListeners(); // Includes resize listener

        // 5. Final Steps - Trigger initial updates that depend on everything being set up
        // Example: Initial size indicator update after potential layout shifts
        if (typeof window.updateSizeIndicator === 'function') {
            window.updateSizeIndicator();
        } else { console.warn("updateSizeIndicator function not found on window."); }

        const endTime = performance.now();
        console.log(`[Logomaker] Application Initialized and Ready. Took ${(endTime - startTime).toFixed(0)}ms`);

    } catch (uiError) {
         console.error("[Logomaker] Error during UI component initialization or binding:", uiError);
         // Decide if the app is still usable or should show an error
         alert("An error occurred during UI setup. Some features might not work correctly.");
    }
}


/** Initialize handlers for main action buttons */
function initializeButtonHandlers() {
    console.log('[Logomaker] Binding main action button handlers...');
    const buttonConfigs = [
        { id: 'exportPngBtn', handler: handlePNGExport, name: 'PNG Export' },
        { id: 'exportSvgBtn', handler: handleSVGExport, name: 'SVG Export' },
        { id: 'exportGifBtn', handler: handleGIFExport, name: 'Animation Export' },
        { id: 'copyHtmlBtn', handler: handleHTMLCopy, name: 'Copy HTML' },
        { id: 'copyCssBtn', handler: handleCSSCopy, name: 'Copy CSS' }
        // Reset button is handled by SettingsManager/ResetConfirmation now
    ];

    buttonConfigs.forEach(config => {
        const btn = document.getElementById(config.id);
        if (btn) {
            if (typeof config.handler === 'function') {
                // Prevent double binding
                if (btn.getAttribute('data-listener-bound') !== 'true') {
                    btn.addEventListener('click', config.handler);
                    btn.setAttribute('data-listener-bound', 'true');
                    // console.log(`[Logomaker] ${config.name} button bound.`); // Optional log
                }
            } else {
                console.error(`[Logomaker] Handler missing or invalid for button #${config.id}. Disabling.`);
                btn.disabled = true;
                btn.title = `Action for ${config.name} is unavailable. Handler invalid.`;
            }
        } else {
            console.warn(`[Logomaker] Button element not found: #${config.id}`);
        }
    });

    // Preview Toggle Button (Consolidated Here)
    const previewToggleBtn = document.getElementById('previewToggleBtn');
    const previewContainer = document.getElementById('previewContainer');
    if (previewToggleBtn && previewContainer) {
        // Ensure only one listener binds
        if (previewToggleBtn.getAttribute('data-listener-bound') !== 'true') {
            const toggleHandler = () => {
                previewContainer.classList.toggle('hidden');
                const isHidden = previewContainer.classList.contains('hidden');
                previewToggleBtn.textContent = isHidden ? 'Show Preview' : 'Hide Preview';
                previewToggleBtn.title = isHidden ? 'Show the logo preview area' : 'Hide the logo preview area';
                // Optional: Trigger resize/update indicator after toggle if layout changes
                 if (!isHidden && typeof window.updateSizeIndicator === 'function') {
                     setTimeout(window.updateSizeIndicator, 50); // Update size after showing
                 }
            };
            previewToggleBtn.addEventListener('click', toggleHandler);
            previewToggleBtn.setAttribute('data-listener-bound', 'true');
            console.log('[Logomaker] Preview toggle button bound by main.js.');
            // Set initial state based on class
             const isInitiallyHidden = previewContainer.classList.contains('hidden');
             previewToggleBtn.textContent = isInitiallyHidden ? 'Show Preview' : 'Hide Preview';
             previewToggleBtn.title = isInitiallyHidden ? 'Show the logo preview area' : 'Hide the logo preview area';
        }
    } else {
        console.warn('[Logomaker] Preview toggle button or container not found.');
    }
}

/** Initialize global listeners like window resize */
function initializeGlobalListeners() {
    // Ensure updateSizeIndicator is available globally
    if (typeof window.updateSizeIndicator === 'function') {
        // Use throttling to limit frequency of resize updates
        const throttledResize = throttle(window.updateSizeIndicator, 150); // Throttle to 150ms

        // Prevent double binding for resize listener
        if (!window._resizeListenerBound) {
            window.addEventListener('resize', throttledResize);
            window._resizeListenerBound = true;
            console.log('[Logomaker] Window resize listener added (throttled).');
        }
    } else {
        console.warn("[Logomaker] updateSizeIndicator not found on window for resize listener.");
    }
}

/** Throttling function utility */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Ensure essential functions are available globally if needed by non-module scripts
// (updateSizeIndicator is added to window in misc.js)