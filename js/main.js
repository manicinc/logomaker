/**
 * main.js - v13.1 - Fixed Syntax Error in loadAllFonts Handler
 * ====================================================================
 * Core initialization and orchestration for Logomaker.
 * Uses top-level DOMContentLoaded listener with dynamic imports for robust init order.
 */

// --- Imports ---
import { throttle } from './utils/utils.js'; // Assuming throttle is needed for resize listener setup
import { showToast, showAlert } from './notificationsDropInAlerts.js'; // For error reporting

console.log('[Main] Logomaker main.js executing (v13.1 - Syntax Fix).');

// --- Global State ---
let appInitialized = false;

// --- Initialization Sequence ---
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    if (appInitialized) {
        console.warn('[Main] Attempted to initialize app more than once.');
        return;
    }
    appInitialized = true;

    console.log('[Main] DOMContentLoaded event fired. Starting application initialization...');
    const startTime = performance.now();

    try {
        // --- Dynamically Import and Initialize Core Modules ---

        // 1. Fonts (Must run early, needs the inline data)
        console.log('[Main DEBUG] About to dynamically import FontManager...');
        const FontManager = await import('./fontManager.js');
        console.log('[Main DEBUG] FontManager imported. About to call initializeFonts...');
        const fontSuccess = await FontManager.initializeFonts();
        console.log(`[Main DEBUG] initializeFonts call finished. Success: ${fontSuccess}`);
        if (!fontSuccess) {
            console.error("[Main] Font Manager initialization failed or reported issues. App functionality may be limited.");
            showAlert('Font system failed to load. Using fallback system fonts.', 'error', { duration: 10000 });
        } else {
            console.log('[Main] Font Manager initialized successfully.');
        }

        // 2. Settings Manager
        // 2. Settings Manager
        console.log('[Main DEBUG] About to dynamically import SettingsManager module namespace...');
        // Import the module namespace object
        const SettingsManagerModule = await import('./settingsManager.js');
        console.log('[Main DEBUG] Imported SettingsManager module namespace:', SettingsManagerModule);

        // --- CORRECTED ACCESS TO DEFAULT EXPORT ---
        // Get the actual SettingsManager object from the 'default' property
        const SettingsManager = SettingsManagerModule.default;

        // Optional: Log the actual object to be sure
        console.log('[Main DEBUG] Accessed default export. SettingsManager object:', SettingsManager);
        console.log('[Main DEBUG] About to call initialization method on default export...');

        // Check if the default export object exists AND has the 'init' method
        if (SettingsManager && typeof SettingsManager.init === 'function') {
            // Call init on the CORRECT object (the default export)
            await SettingsManager.init();
            console.log('[Main] SettingsManager initialized successfully.');
        } else {
             // Log error if the default export or the 'init' method is missing
            console.error('[Main] SettingsManager default export or its init() method is missing!');
            throw new Error('SettingsManager failed to load correctly.');
        }
        // --- END CORRECTION ---
        // 3. UI Components
        console.log('[Main] Initializing UI components...');
        try {
            console.log('[Main DEBUG] Importing UI modules...');
            const Misc = await import('./misc.js');
            const Tabs = await import('./utils/tabs.js');
            const Randomize = await import('./randomize.js');

            console.log('[Main DEBUG] Setting up tab navigation...');
            Tabs.setupTabNavigation();
            console.log('[Main] Tab navigation setup complete.');

            console.log('[Main DEBUG] Setting up tooltips...');
            Misc.setupTooltips();
            console.log('[Main] Tooltips initialized.');

            console.log('[Main DEBUG] Setting up theme toggle...');
            Misc.setupThemeToggle();
            console.log('[Main] Theme toggle setup complete.');

            console.log('[Main DEBUG] Setting up randomizer shortcut...');
            Randomize.initializeRandomizeShortcut();

        } catch (uiError) {
            console.error('[Main] Error initializing core UI components:', uiError);
            showAlert('Failed to initialize some UI elements.', 'warning');
        }

        // 4. Bind Button Handlers
        console.log('[Main] Binding button handlers...');
        await bindButtonHandlers();

        // 5. Initialize Global Listeners
        console.log('[Main] Initializing global listeners...');
        initializeGlobalListeners();

        // 6. Final UI Updates
        console.log('[Main] Performing final UI updates...');
        setTimeout(async () => {
            try {
                 const Misc = await import('./misc.js');
                 console.log('[Main] Triggering final size indicator update.');
                 Misc.updateSizeIndicator();
            } catch(e) { console.error("Error updating size indicator", e);}
        }, 150);

        const endTime = performance.now();
        console.log(`[Main] ✅ Application Initialized and Ready. Took ${(endTime - startTime).toFixed(0)}ms`);

    } catch (error) {
        console.error("[Main] CRITICAL ERROR during application initialization:", error);
        showAlert(`App Initialization Failed: ${error.message}. Please reload or check console.`, "error", { duration: null });
        document.querySelector('.container')?.classList?.add('init-error');
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

/** Setup primary button event listeners using dynamic imports */
async function bindButtonHandlers() {
    try {
        const ExportHandler = await import('./exportHandler.js');
        const ExportCopyHandlers = await import('./exportCopyHandlers.js');
        const Misc = await import('./misc.js');
        const Randomize = await import('./randomize.js');

        const buttonConfigs = [
            { id: 'exportPngBtn', handler: ExportHandler.handlePNGExport, label: 'PNG Export' },
            { id: 'exportSvgBtn', handler: ExportHandler.handleSVGExport, label: 'SVG Export' },
            { id: 'exportGifBtn', handler: ExportHandler.handleGIFExport, label: 'Animation Export (Frames ZIP)' },
            { id: 'copyHtmlBtn', handler: ExportCopyHandlers.handleHTMLCopy, label: 'Copy HTML' },
            { id: 'copyCssBtn', handler: ExportCopyHandlers.handleCSSCopy, label: 'Copy CSS' },
            { id: 'shareUrlBtn', handler: Misc.openShareModal, label: 'Share URL' },
            { id: 'randomizeStyleBtn', handler: Randomize.randomizeStyle, label: 'Randomize Style' },
            { id: 'loadAllFontsBtn', handler: async () => {
                const btn = document.getElementById('loadAllFontsBtn'); if (!btn) return;
                const originalContent = btn.innerHTML; btn.disabled = true;
                btn.innerHTML = `<span class="spinner small-inline" style="width:1em;height:1em;border-width:2px;margin-right:5px;"></span> Loading All...`;
                console.log('[LoadAll] Starting full font library load...');
                try {
                    if (typeof window.loadAllFonts === 'function') {
                        const startTime = performance.now();
                        const result = await window.loadAllFonts();
                        const duration = ((performance.now() - startTime) / 1000).toFixed(1);
                
                        if (result.failed > 0) {
                            showAlert(`Loaded ${result.loaded}/${result.total} font items (${result.failed} failed). Duration: ${duration}s`, "warning");
                        } else {
                            showToast({ message: `All ${result.total} font items loaded! (${duration}s)`, type: 'success' });
                        }
                
                        // --- Corrected Assignment Logic ---
                        const fontModeElement = document.getElementById('fontLoadingMode');
                        if (fontModeElement) {
                            fontModeElement.textContent = 'All Items Loaded';
                        } else {
                            // Optional: Log a warning if the element is unexpectedly missing
                            console.warn('[Main] Element #fontLoadingMode not found to update text.');
                        }
                        // --- End Correction ---
                
                    } else {
                        throw new Error('window.loadAllFonts function not found.');
                    }
                } catch (error) {
                    console.error("[Main] Error calling loadAllFonts:", error);
                    showAlert(`Failed to load all fonts: ${error.message}`, "error");
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            }, label: 'Load All Fonts' },
        ];

        buttonConfigs.forEach(config => {
            const btnElement = document.getElementById(config.id);
            if (btnElement) {
                if (btnElement.dataset.listenerBound === 'true') return;
                if (typeof config.handler === 'function') {
                    btnElement.addEventListener('click', async (event) => {
                        event.stopPropagation();
                        console.log(`[Main] Button clicked: ${config.label} (#${config.id})`);
                        try { await config.handler(event); }
                        catch (error) {
                            console.error(`[Main] Error during ${config.label} action:`, error);
                            showAlert(`Error performing ${config.label}: ${error.message}`, 'error');
                        }
                    });
                    btnElement.dataset.listenerBound = 'true';
                    console.log(`[Main] Bound handler for: ${config.label} button.`);
                } else {
                    console.error(`[Main] Handler missing for button #${config.id}. Disabling.`);
                    btnElement.disabled = true; btnElement.title = `Action unavailable.`;
                }
            } else {
                console.warn(`[Main] Button element not found for binding: #${config.id}`);
            }
        });
    } catch (error) {
        console.error('[Main] Error importing button handlers:', error);
        showAlert('Failed to set up some action buttons.', 'warning');
    }
}

/** Initialize global listeners like window resize */
function initializeGlobalListeners() {
     if (!window._resizeListenerBound) {
        const throttledResize = throttle(async () => {
             try {
                 const Misc = await import('./misc.js');
                 Misc.updateSizeIndicator();
             } catch(e) { console.error("Resize handler error:", e); }
        }, 150);
        window.addEventListener('resize', throttledResize);
        window._resizeListenerBound = true;
        console.log('[Main] Window resize listener added (throttled).');
    }
}

console.log('[Main] main.js script setup complete.'); // Log end of script execution