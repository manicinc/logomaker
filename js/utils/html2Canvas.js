/**
 * js/utils/html2Canvas.js (Enhanced v2.7 - Copy All Computed Styles)
 * ===================================================================
 * Provides enhanced HTML2Canvas implementation attempting maximum style fidelity
 * by copying *all* computed styles in the onclone callback for the target element
 * and its primary children (.logo-container, .logo-text).
 * Targets #previewContainer specifically based on its ID.
 */

console.log("[HTML2Canvas Util] Module loading (v2.7 - Copy All Computed Styles)...");

/**
 * Copies all computed styles from a source element to a target element's inline style.
 * @param {HTMLElement} sourceElement - The original element to get styles from.
 * @param {HTMLElement} targetElement - The cloned element to apply styles to.
 */
function copyAllComputedStyles(sourceElement, targetElement) {
    if (!sourceElement || !targetElement) return;

    const computedStyles = window.getComputedStyle(sourceElement);
    // console.log(`[Copy Styles] Copying ${computedStyles.length} styles from`, sourceElement, 'to', targetElement); // DEBUG

    // Copy classes first, as they define much of the styling context
    targetElement.className = sourceElement.className;

    // Copy all computed style properties
    for (const prop of computedStyles) {
        let value = computedStyles.getPropertyValue(prop);
        let priority = computedStyles.getPropertyPriority(prop);
        // Basic check to skip properties that might cause issues if copied directly (can be expanded)
        if (prop === 'width' && value === 'auto') continue;
        if (prop === 'height' && value === 'auto') continue;
        
        try {
            targetElement.style.setProperty(prop, value, priority);
        } catch (e) {
            // Ignore properties that cannot be set this way (e.g., internal properties)
             // console.warn(`[Copy Styles] Could not set property "${prop}" with value "${value}" (priority: ${priority})`, e.message); // DEBUG
        }
    }
     // Ensure critical text rendering styles are applied, even if the loop missed them somehow
     // (These are often needed for gradient text effects)
     if (computedStyles.webkitBackgroundClip) targetElement.style.webkitBackgroundClip = computedStyles.webkitBackgroundClip;
     if (computedStyles.backgroundClip) targetElement.style.backgroundClip = computedStyles.backgroundClip;
     if (computedStyles.webkitTextFillColor) targetElement.style.webkitTextFillColor = computedStyles.webkitTextFillColor;
}


/**
 * Capture an element (specifically #previewContainer) with HTML2Canvas with enhanced accuracy.
 * Uses an onclone callback attempting to copy all computed styles for maximum fidelity.
 * @param {HTMLElement} elementToCapture - The element to capture (MUST be #previewContainer).
 * @param {object} options - Additional options for html2canvas (e.g., { width, height, transparentBackground }).
 * @returns {Promise<HTMLCanvasElement>} Canvas with captured content.
 */
export async function captureLogoWithHTML2Canvas(elementToCapture, options = {}) {
    if (!elementToCapture || elementToCapture.id !== 'previewContainer') {
        throw new Error("This capture function is specifically designed for #previewContainer.");
    }
    console.log('[Capture v2.7] Capturing #previewContainer with HTML2Canvas...');

    // --- Prepare Element (Set explicit dimensions, wait for fonts) ---
    // This step is crucial for html2canvas to know the intended capture size
    // Pass width/height from options if provided, otherwise use element's current size
    const prepOptions = {
        width: options.width || elementToCapture.offsetWidth,
        height: options.height || elementToCapture.offsetHeight
    };
    await prepareElementForCapture(elementToCapture, prepOptions); // Ensure this runs before html2canvas

    const defaultOptions = {
        scale: window.devicePixelRatio || 1,
        allowTaint: true,
        useCORS: true,
        logging: false, // Set to true for more detailed html2canvas logs if needed
        backgroundColor: options.transparentBackground ? null : (window.getComputedStyle(elementToCapture).backgroundColor || '#000000'), // Use actual bg color unless transparent requested
        ignoreElements: (element) => {
            // Ignore size indicator and any other elements we don't want
            return element.classList && (
                element.classList.contains('size-indicator') ||
                element.classList.contains('loading-spinner')
            );
        },
        imageTimeout: 15000, // Increased timeout for images/fonts within canvas
        removeContainer: true, // Clean up the clone container afterwards
        onclone: (documentClone, elementBeingCloned) => { // elementBeingCloned is the clone of elementToCapture
             console.log('[Capture v2.7 - onclone] Cloning document for #previewContainer...');
             const targetElement = elementBeingCloned; // This IS the clone of #previewContainer

             if (targetElement) {
                 console.log('[Capture v2.7 - onclone] Applying all computed styles to #previewContainer clone...');
                 // 1. Copy all styles for the main #previewContainer
                 copyAllComputedStyles(elementToCapture, targetElement);

                 // 2. Copy styles for direct important children (.logo-container, .logo-text)
                 const sourceLogoContainer = elementToCapture.querySelector('.logo-container');
                 const targetLogoContainer = targetElement.querySelector('.logo-container');
                 if (sourceLogoContainer && targetLogoContainer) {
                     console.log('[Capture v2.7 - onclone] Applying all computed styles to .logo-container clone...');
                     copyAllComputedStyles(sourceLogoContainer, targetLogoContainer);
                      // Explicitly copy animation properties as backup (computed style might not capture dynamic state perfectly)
                      if (window.getComputedStyle(sourceLogoContainer).animation) {
                          targetLogoContainer.style.animation = window.getComputedStyle(sourceLogoContainer).animation;
                      }
                 } else {
                     console.warn('[Capture v2.7 - onclone] Could not find .logo-container in source or clone.');
                 }

                 const sourceLogoText = elementToCapture.querySelector('.logo-text');
                 const targetLogoText = targetElement.querySelector('.logo-text');
                 if (sourceLogoText && targetLogoText) {
                     console.log('[Capture v2.7 - onclone] Applying all computed styles to .logo-text clone...');
                     copyAllComputedStyles(sourceLogoText, targetLogoText);

                     // Ensure text content itself is copied
                     targetLogoText.textContent = sourceLogoText.textContent;

                     // Ensure data-text attribute is copied (for effects like glitch)
                    const dataText = sourceLogoText.getAttribute('data-text');
                    if (dataText !== null) {
                        targetLogoText.setAttribute('data-text', dataText);
                    } else {
                        targetLogoText.removeAttribute('data-text');
                    }

                     // Explicitly copy animation properties as backup
                     if (window.getComputedStyle(sourceLogoText).animation) {
                         targetLogoText.style.animation = window.getComputedStyle(sourceLogoText).animation;
                     }
                     // Explicitly copy transform as it's crucial
                     if (window.getComputedStyle(sourceLogoText).transform) {
                         targetLogoText.style.transform = window.getComputedStyle(sourceLogoText).transform;
                     }
                     // Copy text shadow explicitly
                     if (window.getComputedStyle(sourceLogoText).textShadow) {
                          targetLogoText.style.textShadow = window.getComputedStyle(sourceLogoText).textShadow;
                     }


                 } else {
                    console.warn('[Capture v2.7 - onclone] Could not find .logo-text in source or clone.');
                 }

                 // 3. Inject necessary global styles (keyframes, base alignment)
                 // This is still needed as inline styles don't define keyframes.
                 // Add any keyframes used by your animations here.
                 const styleElement = documentClone.createElement('style');
                 styleElement.textContent = `
                     /* Injected Keyframes & Base Styles */
                     @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.9; } }
                     @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                     @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); } 20%, 40%, 60%, 80% { transform: translateX(5px); } }
                     @keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-15px); } 60% { transform: translateY(-8px); } }
                     @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                     @keyframes fade { 0%, 100% { opacity: 1; } 50% { opacity: 0.1; } }
                     @keyframes flicker { 0%, 19.9%, 22%, 62.9%, 64%, 64.9%, 70%, 100% { opacity: 0.99; /* Slightly reduced for effect */ } 20%, 21.9%, 63%, 63.9%, 65%, 69.9% { opacity: 0.4; } }

                     /* TODO: Add keyframes for glitch, wave if needed */

                     /* Base Alignment Classes (can help if computed style isn't enough) */
                     .text-align-left { text-align: left !important; }
                     .text-align-center { text-align: center !important; }
                     .text-align-right { text-align: right !important; }

                     /* Ensure logo-text display is appropriate if needed */
                     .logo-text { display: inline-block; } /* Or block depending on original */

                     /* Attempt basic styling for glitch pseudo-elements (HIGHLY EXPERIMENTAL) */
                     /* This likely WON'T capture complex animations/clips */
                    .logo-text.anim-glitch::before,
                    .logo-text.anim-glitch::after {
                        content: attr(data-text); /* Requires data-text attribute copied */
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: inherit; /* Try to inherit background */
                        -webkit-background-clip: inherit;
                        background-clip: inherit;
                        color: inherit; /* Ensure text color is inherited */
                        overflow: hidden; /* Prevent pseudo-elements spilling out */
                         /* It's extremely hard to copy dynamic clips/animations here */
                     }
                 `;
                 documentClone.head.appendChild(styleElement);
                 console.log('[Capture v2.7 - onclone] Injected keyframes and base styles.');

             } else {
                 console.error('[Capture v2.7 - onclone] Could not find target #previewContainer in the cloned document!');
             }
        }
    };

    // Merge default options with provided options, potentially overriding width/height for capture context
    const mergedOptions = { ...defaultOptions, ...options };
    // Override width/height in html2canvas options based on prepared element dimensions
    mergedOptions.width = prepOptions.width;
    mergedOptions.height = prepOptions.height;

    // If background is meant to be transparent, force backgroundColor to null
     if (options.transparentBackground) {
         mergedOptions.backgroundColor = null;
     }


    console.log('[Capture v2.7] Final html2canvas options:', mergedOptions);
    console.log('[Capture v2.7] Beginning HTML2Canvas rendering...');

    let canvas;
    try {
        // Ensure html2canvas library is available
        if (typeof html2canvas !== 'function') {
            throw new Error("html2canvas library not found! Make sure it's included globally.");
        }

        // Call html2canvas
        canvas = await html2canvas(elementToCapture, mergedOptions);
        console.log('[Capture v2.7] HTML2Canvas rendering successful.');

    } catch (error) {
        console.error('[Capture v2.7] HTML2Canvas rendering failed:', error);
        // Attempt cleanup even if capture failed
         cleanupAfterCapture(elementToCapture);
        throw error; // Re-throw error
    } finally {
        // --- Cleanup ---
        // Restore original styles modified by prepareElementForCapture
        cleanupAfterCapture(elementToCapture);
    }

    return canvas;
}

// ==========================================================================
// == Prepare & Cleanup Helpers (Copied from original, ensure they exist) ==
// ==========================================================================

/**
 * Prepare element for more accurate capture (v2.5 adjusted)
 * Sets explicit dimensions, ensures fonts are ready, handles glitch text.
 * @param {HTMLElement} element - Original element to capture (will be modified)
 * @param {object} options - Capture options, including explicit width/height.
 * @returns {Promise<HTMLElement>} Prepared element ready for capture
 */
async function prepareElementForCapture(element, options = {}) {
    console.log("[Capture Prep v2.7] Preparing element...");

    const originalInlineStyle = element.getAttribute('style') || '';
    let originalDataText = null;
    const logoText = element.querySelector('.logo-text');

    // --- Set Explicit Dimensions ---
    // Use dimensions passed in options (which should match desired canvas size)
    const explicitWidth = options.width || element.offsetWidth || 800;
    const explicitHeight = options.height || element.offsetHeight || 400;
    console.log(`[Capture Prep v2.7] Setting explicit capture dimensions: ${explicitWidth}x${explicitHeight}`);
    element.style.width = `${explicitWidth}px`;
    element.style.height = `${explicitHeight}px`;
    element.style.overflow = 'hidden'; // Prevent content bleed affecting capture size

    // --- Ensure Fonts Are Ready ---
    console.log("[Capture Prep v2.7] Waiting for document.fonts.ready...");
    try {
        await Promise.race([
            document.fonts.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('fonts.ready timeout')), 5000)) // 5 second timeout
        ]);
        console.log("[Capture Prep v2.7] document.fonts.ready resolved or timed out.");
    } catch (fontError) {
        console.warn("[Capture Prep v2.7] Error or timeout waiting for document.fonts.ready:", fontError.message);
    }

    // --- Handle Glitch Animation Data Attribute ---
    if (logoText) {
        originalDataText = logoText.getAttribute('data-text'); // Store original
        if (logoText.classList.contains('anim-glitch')) {
             const currentText = logoText.textContent || '';
             if (logoText.getAttribute('data-text') !== currentText) {
                 logoText.setAttribute('data-text', currentText);
                 console.log("[Capture Prep v2.7] Applied data-text for glitch animation.");
             }
        }
    }

    // --- Store data needed for cleanup ---
    element._capturePreparationData = {
        originalInlineStyle,
        originalDataText,
        logoTextElement: logoText
    };

    // --- Delay slightly for rendering engines ---
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50))); // Wait a frame + small delay

    console.log("[Capture Prep v2.7] Element preparation finished.");
    return element;
}

/**
 * Clean up after capture to restore original element state (v2.5 adjusted)
 * Restores original inline style attribute and data-text.
 * @param {HTMLElement} modifiedElement - Element that was prepared
 */
// In html2canvas.js

/**
 * Clean up after capture to restore original element state (v2.8 - Improved Restore)
 * Restores original inline style attribute, data-text, and removes explicit overrides.
 * @param {HTMLElement} modifiedElement - Element that was prepared
 */
function cleanupAfterCapture(modifiedElement) {
    console.log("[Capture Cleanup v2.8] Cleaning up element...");

    const prepData = modifiedElement._capturePreparationData;
    if (prepData) {
        // Restore the original inline style attribute FIRST
        modifiedElement.setAttribute('style', prepData.originalInlineStyle);

        // --- NEW: Explicitly remove styles added during prep ---
        // This ensures that even if the original style attribute was empty or
        // didn't define these, we remove the explicit overrides, letting
        // CSS classes take precedence again.
        modifiedElement.style.removeProperty('width');
        modifiedElement.style.removeProperty('height');
        modifiedElement.style.removeProperty('overflow');
        // --- END NEW ---

        // Restore data-text attribute if it was changed
        const logoText = prepData.logoTextElement;
        if (logoText) {
            const currentDataText = logoText.getAttribute('data-text');
            if (prepData.originalDataText === null && currentDataText !== null) {
                logoText.removeAttribute('data-text');
            } else if (prepData.originalDataText !== null && currentDataText !== prepData.originalDataText) {
                logoText.setAttribute('data-text', prepData.originalDataText);
            }
        }

        // Remove preparation data marker
        delete modifiedElement._capturePreparationData;
        console.log("[Capture Cleanup v2.8] Cleanup complete.");
    } else {
        console.warn("[Capture Cleanup v2.8] No preparation data found. Cannot restore state precisely. Removing potentially added styles as fallback.");
        // Fallback remains the same: attempt to remove specific styles
        modifiedElement.style.removeProperty('width');
        modifiedElement.style.removeProperty('height');
        modifiedElement.style.removeProperty('overflow');
    }
}