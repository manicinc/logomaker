/**
 * js/utils/html2Canvas.js (v3.0 - Adapted for html2canvas-pro)
 * ===================================================================
 * Provides HTML2Canvas capture functionality, expecting html2canvas-pro
 * to be loaded globally via a <script> tag from a local file.
 * Uses a minimal onclone callback to avoid interfering with html2canvas-pro's
 * potentially improved rendering logic. It relies on the new library handling
 * CSS interpretation better, especially for complex styles like gradients.
 * Targets #previewContainer specifically based on its ID.
 */

// NOTE: We are NOT using "import html2canvas from 'html2canvas-pro';"
// We expect the 'html2canvas' function (from the pro version script tag)
// to be available in the global scope (window.html2canvas).

console.log("[HTML2Canvas Util] Loading (v3.0 - For html2canvas-pro)...");

/**
 * Capture an element (specifically #previewContainer) using the globally available html2canvas (PRO version).
 * Uses a minimal onclone callback, assuming html2canvas-pro handles styles better.
 * @param {HTMLElement} elementToCapture - The element to capture (MUST be #previewContainer).
 * @param {object} options - Additional options for html2canvas (e.g., { width, height, transparentBackground, scale }).
 * @returns {Promise<HTMLCanvasElement>} Canvas with captured content.
 */
export async function captureLogoWithHTML2Canvas(elementToCapture, options = {}) {
    // 1. Validate Input Element
    if (!elementToCapture || elementToCapture.id !== 'previewContainer') {
        throw new Error("Capture function requires the #previewContainer element.");
    }
    console.log('[Capture Pro] Capturing #previewContainer with html2canvas-pro...');

    // 2. Prepare Element (Force dimensions for capture context)
    const prepOptions = {
        width: options.width || elementToCapture.offsetWidth || 800, // Fallback width
        height: options.height || elementToCapture.offsetHeight || 400 // Fallback height
    };
    await prepareElementForCapture(elementToCapture, prepOptions); // Temporarily styles the element

    // 3. Define html2canvas Options
    const defaultOptions = {
        // Use scale from options if provided, otherwise default to devicePixelRatio or 1
        scale: options.scale ?? (window.devicePixelRatio || 1),
        allowTaint: true, // Allows cross-origin images if server headers permit
        useCORS: true,    // Attempts to load cross-origin images using CORS
        logging: false,   // Set true for verbose debugging from html2canvas-pro
        backgroundColor: options.transparentBackground ? null : (window.getComputedStyle(elementToCapture).backgroundColor || '#000000'), // Use computed background unless transparent
        ignoreElements: (element) => element.classList?.contains('size-indicator'), // Example: ignore size display
        imageTimeout: 15000, // Wait 15s for images to load
        removeContainer: true, // Clean up the temporary DOM clone container

        /**
         * Minimal onclone callback for html2canvas-pro.
         * We primarily ensure essential attributes are copied and inject keyframes.
         * We AVOID copying computed styles inline, hoping the pro version renders CSS better.
         */
        onclone: (documentClone, elementBeingCloned) => {
            console.log('[Capture Pro - onclone] Cloning document (Minimal Clone Logic)...');
            const targetPreviewContainer = elementBeingCloned; // This is the clone of #previewContainer

            if (targetPreviewContainer) {
                // Ensure the container clone gets the same classes as the original
                targetPreviewContainer.className = elementToCapture.className;

                // Find the text element within the clone
                const sourceLogoText = elementToCapture.querySelector('.logo-text');
                const targetLogoText = targetPreviewContainer.querySelector('.logo-text');

                if (sourceLogoText && targetLogoText) {
                    // Ensure critical attributes are present on the text clone
                    targetLogoText.className = sourceLogoText.className; // Apply classes
                    targetLogoText.textContent = sourceLogoText.textContent; // Copy text content
                    const dataText = sourceLogoText.getAttribute('data-text'); // Copy data-text for effects
                    if (dataText !== null) {
                        targetLogoText.setAttribute('data-text', dataText);
                    } else {
                        targetLogoText.removeAttribute('data-text');
                    }
                    console.log('[Capture Pro - onclone] Applied minimal attributes to .logo-text clone.');
                } else {
                    console.warn('[Capture Pro - onclone] Could not find .logo-text in source or clone.');
                }

                // --- Inject necessary global styles (keyframes, base alignment) ---
                // Still useful for animations and ensuring base styles are available
                const styleElement = documentClone.createElement('style');
                // --- IMPORTANT: Ensure these keyframes match your actual CSS definitions ---
                styleElement.textContent = `
                    /* Injected Keyframes & Base Styles for html2canvas-pro */

                    /* --- ADD ALL YOUR @keyframes rules from effects.css here --- */
                    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.9; } }
                    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                    @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); } 20%, 40%, 60%, 80% { transform: translateX(5px); } }
                    @keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-15px); } 60% { transform: translateY(-8px); } }
                    @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @keyframes fade { 0%, 100% { opacity: 1; } 50% { opacity: 0.1; } } /* Assuming fadeInOut */
                    @keyframes flicker { 0%, 19.9%, 22%, 62.9%, 64%, 64.9%, 70%, 100% { opacity: 0.99; } 20%, 21.9%, 63%, 63.9%, 65%, 69.9% { opacity: 0.4; } }
                    /* @keyframes glitch { ... your full glitch keyframes ... } */
                    /* @keyframes wave { ... your full wave keyframes ... } */
                    /* ... add ALL others used in your effects.css ... */

                    /* Base Alignment & Display (Define fallbacks or ensure classes work) */
                    .text-align-center { text-align: center !important; }
                    .text-align-left { text-align: left !important; }
                    .text-align-right { text-align: right !important; }
                    /* Ensure .logo-text display allows background-clip to work if library supports it */
                    .logo-text { display: inline-block; vertical-align: middle; /* Match your actual CSS */ }

                    /* Glitch Pseudo-element Styling (Requires data-text attribute) */
                   .logo-text.anim-glitch::before,
                   .logo-text.anim-glitch::after {
                       content: attr(data-text); position: absolute; top: 0; left: 0;
                       width: 100%; height: 100%; background: inherit;
                       /* The hope is html2canvas-pro handles these better */
                       background-clip: inherit; -webkit-background-clip: inherit;
                       color: inherit; overflow: hidden;
                       /* ... rest of your specific glitch animation/clip styles ... */
                    }
                `;
                documentClone.head.appendChild(styleElement);
                console.log('[Capture Pro - onclone] Injected keyframes and base styles.');

            } else {
                // If the clone itself is missing, log error. Patch might still have issues.
                console.error('[Capture Pro - onclone] Critical: elementBeingCloned (the clone of #previewContainer) was not provided to onclone!');
            }
        } // End of onclone
    };

    // 4. Merge default options with user-provided options
    const mergedOptions = { ...defaultOptions, ...options };
    mergedOptions.width = prepOptions.width; // Ensure capture uses prepared dimensions
    mergedOptions.height = prepOptions.height;
    // Force background to null if transparency was requested
    if (options.transparentBackground) {
        mergedOptions.backgroundColor = null;
    }

    console.log('[Capture Pro] Final html2canvas-pro options:', mergedOptions);
    console.log('[Capture Pro] Beginning html2canvas-pro rendering...');

    let canvas;
    try {
        // 5. Check if html2canvas function exists globally (loaded via script tag)
        if (typeof html2canvas !== 'function') {
            throw new Error("html2canvas-pro not loaded globally! Check the <script> tag in index.html.");
        }

        // 6. Execute html2canvas-pro
        canvas = await html2canvas(elementToCapture, mergedOptions);
        console.log('[Capture Pro] html2canvas-pro rendering successful.');

    } catch (error) {
        console.error('[Capture Pro] html2canvas-pro rendering failed:', error);
        cleanupAfterCapture(elementToCapture); // Attempt cleanup on error
        throw error; // Re-throw error to be caught by caller
    } finally {
        // 7. Cleanup: Restore original element styles
        cleanupAfterCapture(elementToCapture); // Ensure cleanup runs even on success
    }

    // 8. Return the resulting canvas
    return canvas;
}

// ==========================================================================
// == Prepare & Cleanup Helper Functions (Essential - Keep As Is) =========
// ==========================================================================

/**
 * Prepare element for more accurate capture (v3.0 - Unchanged logic)
 * Sets explicit dimensions, ensures fonts are ready, handles glitch text.
 * @param {HTMLElement} element
 * @param {object} options - { width, height }
 * @returns {Promise<HTMLElement>}
 */
async function prepareElementForCapture(element, options = {}) {
    console.log("[Capture Prep v3.0] Preparing element...");
    const originalInlineStyle = element.getAttribute('style') || '';
    // Store data needed for cleanup directly on the element
    element._capturePreparationData = { originalInlineStyle };

    // --- Set Explicit Dimensions ---
    const explicitWidth = options.width;
    const explicitHeight = options.height;
    console.log(`[Capture Prep v3.0] Setting explicit capture dimensions: ${explicitWidth}x${explicitHeight}`);
    element.style.width = `${explicitWidth}px`;
    element.style.height = `${explicitHeight}px`;
    element.style.overflow = 'hidden'; // Prevent content spill

    // --- Ensure Fonts Are Ready ---
    console.log("[Capture Prep v3.0] Waiting for document.fonts.ready...");
    try {
        // Wait for fonts to be loaded and ready, with a timeout
        await Promise.race([
            document.fonts.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('fonts.ready timeout')), 7000)) // 7 second timeout
        ]);
        console.log("[Capture Prep v3.0] document.fonts.ready resolved or timed out.");
    } catch (fontError) {
        // Log warning but continue, maybe system fonts will work
        console.warn("[Capture Prep v3.0] Error/timeout waiting for fonts:", fontError.message);
    }

    // --- Handle Glitch Animation Data Attribute ---
    const logoText = element.querySelector('.logo-text');
    if (logoText) {
        // Store original data-text for cleanup
        element._capturePreparationData.logoTextElement = logoText;
        element._capturePreparationData.originalDataText = logoText.getAttribute('data-text');
        // Ensure data-text matches current text content for glitch effect
        if (logoText.classList.contains('anim-glitch')) {
            const currentText = logoText.textContent || '';
            if (logoText.getAttribute('data-text') !== currentText) {
                logoText.setAttribute('data-text', currentText);
                // console.log("[Capture Prep v3.0] Applied data-text for glitch animation.");
            }
        }
    }

    // --- Delay slightly for rendering engines to potentially catch up ---
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 60))); // Wait a frame + small delay

    console.log("[Capture Prep v3.0] Element preparation finished.");
    return element;
}

/**
 * Clean up after capture to restore original element state (v3.0 - Unchanged logic)
 * Restores original inline style attribute, data-text, and removes explicit overrides.
 * @param {HTMLElement} modifiedElement - Element that was prepared
 */
function cleanupAfterCapture(modifiedElement) {
    console.log("[Capture Cleanup v3.0] Cleaning up element...");
    const prepData = modifiedElement._capturePreparationData;
    if (prepData) {
        // Restore the original inline style attribute FIRST
        modifiedElement.setAttribute('style', prepData.originalInlineStyle);

        // Explicitly remove styles added during prep to ensure CSS classes take precedence again.
        modifiedElement.style.removeProperty('width');
        modifiedElement.style.removeProperty('height');
        modifiedElement.style.removeProperty('overflow');

        // Restore data-text attribute if it was changed
        const logoText = prepData.logoTextElement;
        if (logoText) {
            const currentDataText = logoText.getAttribute('data-text');
            if (prepData.originalDataText === null && currentDataText !== null) {
                // If original was null but it has one now, remove it
                logoText.removeAttribute('data-text');
            } else if (prepData.originalDataText !== null && currentDataText !== prepData.originalDataText) {
                // If original was something else, restore it
                logoText.setAttribute('data-text', prepData.originalDataText);
            }
            // If original and current are the same (or both null), do nothing
        }

        // Remove the temporary data marker
        delete modifiedElement._capturePreparationData;
        console.log("[Capture Cleanup v3.0] Cleanup complete.");
    } else {
        // Fallback if preparation data was somehow lost
        console.warn("[Capture Cleanup v3.0] No preparation data found. Removing potentially added styles as fallback.");
        modifiedElement.style.removeProperty('width');
        modifiedElement.style.removeProperty('height');
        modifiedElement.style.removeProperty('overflow');
    }
}