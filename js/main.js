/**
 * main.js
 * ========================================
 * Core initialization and orchestration for Logomaker.
 */

// --- Imports ---
import {
    handlePNGExport, handleSVGExport, handleGIFExport, handleHTMLCopy, handleCSSCopy
} from './exportHandler.js';
import { initializeFonts } from './fontManager.js';
import SettingsManager from './settingsManager.js'; // Import directly
import { openShareModal } from './misc.js'; // Import the function to open the share modal


// Other UI/Util scripts load and potentially expose globals (window.setupTabNavigation, etc.)
// misc.js now exposes window.openShareModal

console.log('[Main] Logomaker main.js executing (v11).');

// --- Initialization Sequence ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Main] DOMContentLoaded event fired.');
    await initializeApp();
});

async function initializeApp() {
    console.log('[Main] Initializing Application...');
    const startTime = performance.now();

    // --- Initialize Core Modules in Strict Order ---

    // 1. Initialize Fonts FIRST
    try {
        console.log('[Main] Starting Font Manager initialization...');
        const fontsInitialized = await initializeFonts(); // Keep local check result if needed for logging/warning
        if (fontsInitialized) {
            console.log('[Main] Font Manager initialized successfully.');
        } else {
            console.error('[Main] Font Manager initialization reported issues. Using fallbacks.');
            if(typeof showAlert === 'function') showAlert("Font loading issues occurred. Using fallback fonts.", "warning", { duration: 5000 });
        }
    } catch (e) {
        console.error("[Main] CRITICAL Error during font initialization:", e);
        if(typeof showAlert === 'function') showAlert(`Font loading failed: ${e.message}. Some features may be limited.`, "error");
        // Proceed even if fonts fail, as fallbacks might exist
    }

    // 2. Initialize Settings Manager AFTER fonts are ready
    try {
        console.log('[Main] Starting SettingsManager initialization...');
        if (typeof SettingsManager?.init !== 'function') {
             throw new Error("SettingsManager or its init method is missing!");
        }
        await SettingsManager.init(); // Wait for it to complete
        console.log('[Main] SettingsManager initialization finished successfully.');
        // --- SettingsManager Init Succeeded ---
        // Continue with dependent steps INSIDE this try block or after it

        // 3. Initialize Other UI Components & Bind Buttons
        console.log('[Main] Initializing other UI components & Binding Buttons...');
        try { // Nested try for non-critical UI setup
            if (typeof window.setupTabNavigation === 'function') { window.setupTabNavigation(); console.log('[Main] Tab Navigation Setup.'); }
            else { console.warn('[Main] setupTabNavigation not found on window.'); }
            if (typeof window.initMobileFeatures === 'function') { window.initMobileFeatures(); console.log('[Main] Mobile Features Setup.'); }
            else { console.warn('[Main] initMobileFeatures not found on window.'); }

            // Bind core export/copy buttons
            initializeButtonHandlers();

            // Bind buttons that depend on SettingsManager being ready
            initializeExtraButtonHandlers(); // Handles Randomize, Share

            // Bind global listeners
            initializeGlobalListeners();
            if (typeof window.updateSizeIndicator === 'function') { setTimeout(window.updateSizeIndicator, 100); console.log('[Main] Initial Size Indicator update scheduled.'); }
            else { console.warn("[Main] updateSizeIndicator function not found."); }

            const endTime = performance.now();
            console.log(`[Main] ✅ Application Initialized and Ready. Took ${(endTime - startTime).toFixed(0)}ms`);

        } catch (e) { // Catch critical errors from SettingsManager.init()
            console.error("[Main] CRITICAL Error initializing SettingsManager:", e);
            if(typeof showAlert === 'function') showAlert(`Critical Error: Settings Manager failed: ${e.message}. Application cannot function correctly.`, "error");
            else alert("Critical Error: Settings Manager failed. App cannot start.");
            // DO NOT proceed
            return;
       }

    } catch (e) { // Catch errors from SettingsManager.init() or its check
        // --- SettingsManager Init FAILED ---
        console.error("[Main] CRITICAL Error initializing SettingsManager:", e);
        if(typeof showAlert === 'function') showAlert(`Critical Error: Settings Manager failed: ${e.message}. Application cannot function correctly.`, "error");
        else alert("Critical Error: Settings Manager failed to load. Application cannot function correctly.");
        // DO NOT proceed with dependent steps if SettingsManager failed
        return; // Halt initialization here
    }
    // 3. Initialize other UI components (Tabs, Modals, Mobile specific)
    // These are loaded via script tags and assumed to be ready or self-initializing on DOMContentLoaded
    console.log('[Main] Initializing other UI components (Tabs, ResetModal, Mobile)...');
    try {
        // Call initializers if they expose functions and exist globally
        if (typeof window.setupTabNavigation === 'function') { window.setupTabNavigation(); console.log('[Main] Tab Navigation Setup.'); }
        else { console.warn('[Main] setupTabNavigation not found on window.'); }

        // Reset modal init seems to be handled within resetConfirmation.js via its own listener now, verify its script tag
         // if (typeof window.initResetModal === 'function') { window.initResetModal(); console.log('[Main] Reset Modal Setup.'); }
         // else { console.warn('[Main] initResetModal not found on window.'); }

        if (typeof window.initMobileFeatures === 'function') { window.initMobileFeatures(); console.log('[Main] Mobile Features Setup.'); }
        else { console.warn('[Main] initMobileFeatures not found on window.'); }

        // Notification system initializes itself via its own script/DOMContentLoaded listener

        // 4. Bind Core UI Event Listeners (Export buttons, Global)
        // Ensure this runs after elements are ready and SettingsManager is done.
        initializeButtonHandlers();
        initializeGlobalListeners(); // Includes resize listener
        // Bind buttons that depend on SettingsManager being ready
        initializeExtraButtonHandlers(); // Handles Randomize, Share

        // 5. Final Steps - Trigger initial updates that depend on everything being set up
        // Example: Initial size indicator update after potential layout shifts
        if (typeof window.updateSizeIndicator === 'function') {
            // Call it after a slight delay to ensure layout is more stable
            setTimeout(window.updateSizeIndicator, 100);
            console.log('[Main] Initial Size Indicator update scheduled.');
        } else { console.warn("[Main] updateSizeIndicator function not found on window."); }

        const endTime = performance.now();
        console.log(`[Main] ✅ Application Initialized and Ready. Took ${(endTime - startTime).toFixed(0)}ms`);

    } catch (uiError) {
         console.error("[Main] Error during UI component initialization or binding:", uiError);
         if(typeof showAlert === 'function') showAlert(`UI Setup Error: ${uiError.message}. Some features might not work.`, "warning");
    }
}


/** Initialize handlers for main action/export buttons */
function initializeButtonHandlers() {
    console.log('[Main] Binding main action button handlers...');
    const buttonConfigs = [
        // Main Export Buttons - Handlers now delegate to export*WithUI
        { id: 'exportPngBtn', handler: handlePNGExport, name: 'PNG Export' },
        { id: 'exportSvgBtn', handler: handleSVGExport, name: 'SVG Export' },
        { id: 'exportGifBtn', handler: handleGIFExport, name: 'Animation Export (Frames ZIP)' },
        // Copy Buttons
        { id: 'copyHtmlBtn', handler: handleHTMLCopy, name: 'Copy HTML' },
        { id: 'copyCssBtn', handler: handleCSSCopy, name: 'Copy CSS' },
        // Other Buttons (Reset is handled internally by SettingsManager/ResetConfirmation)
        // Share button (handled by misc.js or urlParamsHandler.js)
        // { id: 'shareUrlBtn', handler: window.handleShareUrlClick, name: 'Share URL' }, // Assuming handler exists globally
        // Theme toggle (handled by misc.js)
        // Preview toggle (handled by misc.js)
    ];

    buttonConfigs.forEach(config => {
        const btn = document.getElementById(config.id);
        if (btn) {
            if (typeof config.handler === 'function') {
                if (btn.getAttribute('data-listener-bound') !== 'true') {
                    btn.addEventListener('click', (event) => { /* ... handler call + logging ... */
                         console.log(`[Main] Button clicked: ${config.name} (#${config.id})`);
                         try {
                              const result = config.handler(event);
                              if (result instanceof Promise) { result.catch(err => { console.error(`[Main] Async handler error (${config.name}):`, err);}); }
                         } catch (syncError) { /* ... error handling ... */ }
                     });
                    btn.setAttribute('data-listener-bound', 'true');
                    console.log(`[Main] Bound handler for: ${config.name} button.`);
                }
            } else {
                console.error(`[Main] Handler missing or invalid for button #${config.id} (${config.name}). Disabling.`);
                btn.disabled = true;
                btn.title = `Action for ${config.name} is unavailable. Handler invalid.`;
            }
        } else {
            // Don't warn for potentially optional buttons like share/theme if handled elsewhere
            if (!['shareUrlBtn', 'themeToggleBtn', 'previewToggleBtn'].includes(config.id)) {
                console.warn(`[Main] Button element not found: #${config.id}`);
            }
        }
    });
       // --- Share URL Button Setup ---
     const shareBtn = document.getElementById('shareUrlBtn');
     if (shareBtn) {
        if (shareBtn.getAttribute('data-listener-bound') !== 'true') {
             // Bind directly to the imported function
             shareBtn.addEventListener('click', () => {
                  console.log('[Main Share] Share button clicked! Calling imported openShareModal...');
                  try {
                     openShareModal(); // Call the imported function
                  } catch(e) {
                      console.error("[Main Share] Error calling openShareModal:", e);
                      if(typeof showAlert === 'function') showAlert("Cannot open share dialog.", "error");
                  }
             });
             shareBtn.setAttribute('data-listener-bound', 'true');
             console.log('[Main] Bound handler for: Share URL button.');
        }
     } else { console.warn('[Main] Share button #shareUrlBtn not found.'); }
}

/** Initialize global listeners like window resize */
function initializeGlobalListeners() {
    console.log('[Main] Initializing global listeners...');
    // Ensure updateSizeIndicator is available globally (assigned in misc.js)
    if (typeof window.updateSizeIndicator === 'function') {
        // Use throttling utility (assuming it's defined globally or imported)
        const throttleFunc = typeof throttle === 'function' ? throttle : (f, t) => f; // Basic fallback
        const throttledResize = throttleFunc(window.updateSizeIndicator, 150); // Throttle to 150ms

        // Prevent double binding for resize listener
        if (!window._resizeListenerBound) {
            window.addEventListener('resize', throttledResize);
            window._resizeListenerBound = true;
            console.log('[Main] Window resize listener added (throttled).');
        }
    } else {
        console.warn("[Main] updateSizeIndicator not found on window for resize listener.");
    }
}

/** Throttling function utility (Keep internal or move to utils.js) */
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

/** Initialize handlers for buttons requiring SettingsManager (Randomize, Share) */
function initializeExtraButtonHandlers() {
    console.log('[Main] Binding Extra button handlers (Randomize, Share)...');

    // --- Randomizer Button Setup ---
    const randomizeBtn = document.getElementById('randomizeStyleBtn');
    if (randomizeBtn) {
        if (randomizeBtn.getAttribute('data-listener-bound') !== 'true') {
           randomizeBtn.addEventListener('click', () => {
               console.log('[Main Randomizer] Button clicked!');
               try {
                   const defaults = SettingsManager.getDefaults(); // Use imported SM
                   const current = SettingsManager.getCurrentSettings();
                   // ... (Keep rest of the randomizer logic from misc.js previous version) ...
                    const textSettings = { logoText: current.logoText, fontFamily: current.fontFamily, fontSize: current.fontSize, letterSpacing: current.letterSpacing, textCase: current.textCase, fontWeight: current.fontWeight };
                    const getOptions = (id) => Array.from(document.querySelectorAll(`#${id} option`)).map(o => o.value);
                    const getRandom = (arr) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
                    const gradientPresets = getOptions('gradientPreset').filter(v => v !== 'custom'); const textEffects = getOptions('textShadow'); const borderStyles = getOptions('borderStyle'); const animations = getOptions('textAnimation'); const backgroundTypes = getOptions('backgroundType').filter(v => v !== 'bg-transparent'); const bgGradientPresets = getOptions('backgroundGradientPreset').filter(v => v !== 'custom'); const textAligns = getOptions('textAlign');
                    const randomHex = () => `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
                    const randomSettings = { ...defaults, ...textSettings, textColorMode: Math.random() > 0.3 ? 'gradient' : 'solid', solidColorPicker: randomHex(), gradientPreset: getRandom(gradientPresets) || defaults.gradientPreset, color1: randomHex(), color2: randomHex(), useColor3: Math.random() > 0.7, color3: randomHex(), animationDirection: Math.floor(Math.random() * 361), textShadow: getRandom(textEffects) || defaults.textShadow, borderColorPicker: randomHex(), borderStyle: getRandom(borderStyles) || defaults.borderStyle, textAlign: getRandom(textAligns) || defaults.textAlign, rotation: Math.floor(Math.random() * 61) - 30, textAnimation: getRandom(animations) || defaults.textAnimation, animationSpeed: (Math.random() * 2.8 + 0.2).toFixed(1), backgroundType: getRandom(backgroundTypes) || defaults.backgroundType, backgroundColor: randomHex(), bgOpacity: (Math.random() * 0.6 + 0.4).toFixed(2), backgroundGradientPreset: getRandom(bgGradientPresets) || defaults.backgroundGradientPreset, bgColor1: randomHex(), bgColor2: randomHex(), bgGradientDirection: Math.floor(Math.random() * 361), previewSize: current.previewSize, exportWidth: current.exportWidth, exportHeight: current.exportHeight, exportQuality: current.exportQuality, exportTransparent: current.exportTransparent, exportFrames: current.exportFrames, exportFrameRate: current.exportFrameRate, };
                    console.log('[Main Randomizer] Applying random settings:', randomSettings);
                    SettingsManager.applySettings(randomSettings, true); // Apply and force UI update
                    if(typeof showToast === 'function') showToast({message: 'Style Randomized! 🎲', type: 'info', duration: 2000});
               } catch (err) {
                   console.error("[Main Randomizer] Error:", err);
                   if(typeof showAlert === 'function') showAlert(`Failed to randomize style: ${err.message}`, "error");
               }
           });
           randomizeBtn.setAttribute('data-listener-bound', 'true');
           console.log('[Main] Bound handler for: Randomize Style button.');
        }
    } else { console.warn('[Main] Randomize button #randomizeStyleBtn not found.'); }

    // --- Share URL Button Setup ---
    const shareBtn = document.getElementById('shareUrlBtn');
    if (shareBtn) {
       if (shareBtn.getAttribute('data-listener-bound') !== 'true') {
            shareBtn.addEventListener('click', () => {
                console.log('[Main Share] Share button clicked!');
                // Call the globally exposed function from misc.js
                if (typeof window.openShareModal === 'function') {
                    window.openShareModal();
                } else {
                    console.error("[Main Share] Cannot open modal - window.openShareModal function not found!");
                    if(typeof showAlert === 'function') showAlert("Cannot open share dialog.", "error");
                }
            });
            shareBtn.setAttribute('data-listener-bound', 'true');
            console.log('[Main] Bound handler for: Share URL button.');
       }
    } else { console.warn('[Main] Share button #shareUrlBtn not found.'); }
}

// Make throttle globally available if needed by other non-module scripts?
// window.throttle = throttle;

console.log('[Main] main.js setup complete.');