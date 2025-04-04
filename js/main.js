/**
 * main.js
 * ========================================
 * Core initialization and orchestration for Logomaker.
 * Uses ES6 Imports, ensures correct init order, fixes tab navigation.
 */

// --- Imports ---
// Core Managers
import SettingsManager from './settingsManager.js';
import { initializeFonts } from './fontManager.js'; // Assuming fontManager exports this

// UI Initializers / Handlers (Ensure these files export the functions)
import { setupTabNavigation } from './tabs.js'; // ** FIX: Import function **
import { setupTooltips, updateSizeIndicator, throttle, randomizeStyle, openShareModal } from './misc.js'; // Assuming misc.js exports these
import { showToast, showAlert } from './notificationsDropInAlerts.js'; // Assuming notificationsDropInAlerts.js exports these

// Action Handlers
import {
    handlePNGExport, handleSVGExport, handleGIFExport, handleHTMLCopy, handleCSSCopy
} from './exportHandler.js';

console.log('[Main] Logomaker main.js executing (v12 - Refactored).');

// --- Initialization Sequence ---
// Use DOMContentLoaded to ensure the initial HTML structure is ready
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    console.log('[Main] Initializing Application...');
    const startTime = performance.now();

    try {
        // --- Initialize Core Modules ---

        // 1. Fonts (Optional but recommended to await if SM depends on it immediately)
        try {
            console.log('[Main] Starting Font Manager initialization...');
            await initializeFonts(); // initializeFonts should handle its own errors/fallbacks internally
            console.log('[Main] Font Manager initialization process completed.');
        } catch (fontError) {
            console.error("[Main] Error during font initialization:", fontError);
            showAlert(`Font loading failed: ${fontError.message}. Using fallbacks.`, "error");
        }

        // 2. Settings Manager (Crucial - Must complete before dependent UI)
        console.log('[Main] Starting SettingsManager initialization...');
        if (typeof SettingsManager?.init !== 'function') {
            throw new Error("SettingsManager or its init method is missing!");
        }
        await SettingsManager.init(); // Initializes, loads settings, applies initial styles/classes
        console.log('[Main] SettingsManager initialization finished successfully.');

        // --- Initialize UI Components & Bind Events (AFTER SettingsManager) ---
        console.log('[Main] Initializing UI components & Binding Buttons...');

        // Setup Tabs
        try {
            console.log('[Main] Setting up tab navigation...');
            setupTabNavigation(); // <-- Use the imported function
            console.log('[Main] Tab navigation setup complete.');
        } catch (tabError) {
            console.error('[Main] Error setting up tab navigation:', tabError);
            showAlert('Error initializing UI tabs.', 'warning');
        }

        // Setup Other UI Features
        try {
            setupTooltips();
            console.log('[Main] Tooltips initialized.');
        } catch (tooltipError) {
            console.error('[Main] Error setting up tooltips:', tooltipError);
        }
        // Add other UI initializers here (e.g., modals if not self-initializing)


        // Bind Button Handlers
        bindButtonHandlers(); // Binds export, copy, randomize, share etc.

        // Initialize Global Listeners (like resize)
        initializeGlobalListeners();

        // Final UI Updates
        // SettingsManager.init() already calls applySettings which should update range displays.
        // Trigger a size update after a short delay for rendering stabilization.
        setTimeout(() => {
             console.log('[Main] Triggering final size indicator update.');
             updateSizeIndicator(); // Use imported function
        }, 150); // Slightly longer delay

        const endTime = performance.now();
        console.log(`[Main] ✅ Application Initialized and Ready. Took ${(endTime - startTime).toFixed(0)}ms`);

    } catch (error) { // Catch critical errors (e.g., SettingsManager init failure)
        console.error("[Main] CRITICAL ERROR during initialization:", error);
        showAlert(`App Initialization Failed: ${error.message}. Please reload.`, "error", { duration: null }); // Persist critical error
        // Optionally hide the main interface or show a dedicated error screen
        document.querySelector('.container')?.classList?.add('init-error');
    }
}

/** Setup primary button event listeners */
function bindButtonHandlers() {
    console.log('[Main] Binding button handlers...');
    const buttonConfigs = [
        // Main Export Buttons
        { id: 'exportPngBtn', handler: handlePNGExport, label: 'PNG Export' },
        { id: 'exportSvgBtn', handler: handleSVGExport, label: 'SVG Export' },
        { id: 'exportGifBtn', handler: handleGIFExport, label: 'Animation Export (Frames ZIP)' },
        // Copy Buttons
        { id: 'copyHtmlBtn', handler: handleHTMLCopy, label: 'Copy HTML' },
        { id: 'copyCssBtn', handler: handleCSSCopy, label: 'Copy CSS' },
         // Extra Action Buttons
        { id: 'shareUrlBtn', handler: openShareModal, label: 'Share URL' }, // Use imported handler
        { id: 'randomizeStyleBtn', handler: randomizeStyle, label: 'Randomize Style' }, // Use imported handler
        // Theme toggle might be handled in misc.js or similar
        // Reset button is handled internally by SettingsManager / resetConfirmation.js
        {
            id: 'loadAllFontsBtn',
            handler: async () => { // Make handler async
              const btn = document.getElementById('loadAllFontsBtn');
              if (!btn) return;
  
              const originalContent = btn.innerHTML; // Store original content
              btn.disabled = true;
              // Add a simple inline spinner or text
              btn.innerHTML = `<span class="spinner small-inline" style="width:1em;height:1em;border-width:2px;margin-right:5px;"></span> Loading All...`;
  
              // Use a generic progress update via console or a dedicated UI element if needed
               console.log('[LoadAll] Starting full font library load...');
               // Optionally dispatch a custom event for a progress bar if you have one
               // window.dispatchEvent(new CustomEvent('logomaker:load-all-progress', { detail: { percent: 0, message: 'Starting...' } }));
  
              try {
                // Check if function exists on window before calling
                if (typeof window.loadAllFonts === 'function') {
                  const startTime = performance.now();
                  // We need a way to get progress updates from loadAllFonts
                  // For now, we just await completion.
                  const result = await window.loadAllFonts(); // Call the function from fontManager
                  const duration = ((performance.now() - startTime) / 1000).toFixed(1);
  
                  if (result.failed > 0) {
                    showAlert(`Loaded ${result.loaded}/${result.total} font chunks (${result.failed} failed). Duration: ${duration}s`, "warning");
                  } else {
                    showToast({ message: `All ${result.total} font chunks loaded! (${duration}s)`, type: 'success' });
                  }
                   // Update loading mode display
                   const modeDisplay = document.getElementById('fontLoadingMode');
                   if (modeDisplay) {
                      // You might want a more sophisticated check in fontManager to know the actual mode
                      modeDisplay.textContent = 'All Chunks Loaded';
                   }
  
                } else {
                  throw new Error('window.loadAllFonts function not found.');
                }
              } catch (error) {
                console.error("[Main] Error calling loadAllFonts:", error);
                showAlert(`Failed to load all fonts: ${error.message}`, "error");
                // Optionally reset progress UI
                // window.dispatchEvent(new CustomEvent('logomaker:load-all-progress', { detail: { percent: 0, message: 'Load failed.' } }));
              } finally {
                btn.disabled = false;
                btn.innerHTML = originalContent; // Restore original button content
              }
            },
            label: 'Load All Fonts'
          },
    ];

    buttonConfigs.forEach(config => {
        const btnElement = document.getElementById(config.id);
        if (btnElement) {
            // Prevent adding listener multiple times
            if (btnElement.dataset.listenerBound === 'true') return;

            if (typeof config.handler === 'function') {
                btnElement.addEventListener('click', async (event) => {
                    console.log(`[Main] Button clicked: ${config.label} (#${config.id})`);
                    // Optional: Add temporary disabled state
                    // btnElement.disabled = true; btnElement.classList.add('loading');
                    try {
                        await config.handler(event); // Await async handlers
                    } catch (error) {
                        console.error(`[Main] Error during ${config.label} action:`, error);
                        showAlert(`Error performing ${config.label}: ${error.message}`, 'error');
                    } finally {
                        // Optional: Remove temporary disabled state
                        // btnElement.disabled = false; btnElement.classList.remove('loading');
                    }
                });
                btnElement.dataset.listenerBound = 'true'; // Mark as bound
                console.log(`[Main] Bound handler for: ${config.label} button.`);
            } else {
                console.error(`[Main] Handler missing or invalid for button #${config.id} (${config.label}). Disabling.`);
                btnElement.disabled = true;
                btnElement.title = `Action for ${config.label} is unavailable.`;
            }
        } else {
             console.warn(`[Main] Button element not found for binding: #${config.id}`);
        }
    });
}

/** Initialize global listeners like window resize */
function initializeGlobalListeners() {
    console.log('[Main] Initializing global listeners...');

    // Throttled Resize Listener
    // Ensure listener isn't added multiple times if init runs again
    if (!window._resizeListenerBound) {
         const throttledResize = throttle(() => {
            // console.log('[Main] Window resized (throttled).'); // Can be noisy
            updateSizeIndicator(); // Use imported function
            // --- Add tab indicator update here if you implement it ---
            // const activeTab = document.querySelector('.tabs .tab.active');
            // if(activeTab && typeof updateActiveTabIndicator === 'function') {
            //     updateActiveTabIndicator(activeTab);
            // }
        }, 150); // Throttle resize events to every 150ms

        window.addEventListener('resize', throttledResize);
        window._resizeListenerBound = true; // Set flag
        console.log('[Main] Window resize listener added (throttled).');
    }
}

// --- Optional: Make critical modules accessible globally for debugging if needed ---
// window.DevTools = { SettingsManager, initializeFonts /*, other modules */ };

console.log('[Main] main.js setup complete.'); // Log end of script execution