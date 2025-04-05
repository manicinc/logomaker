/**
 * js/utils/html2Canvas.js (Enhanced v2.3 - With onclone fix)
 * ============================================================
 * Provides enhanced HTML2Canvas implementation for accurate logo capturing.
 * Includes prepare/cleanup and an onclone callback to improve style application.
 */

console.log("[HTML2Canvas Util] Module loading (v2.3)...");

/**
 * Capture logo container with HTML2Canvas with enhanced accuracy.
 * Uses prepare/cleanup helpers and an onclone callback for better style fidelity.
 * @param {HTMLElement} logoContainer - The element to capture (e.g., #previewContainer).
 * @param {object} options - Additional options for html2canvas (e.g., { width, height, transparentBackground }).
 * @returns {Promise<HTMLCanvasElement>} Canvas with captured content.
 */
export async function captureLogoWithHTML2Canvas(logoContainer, options = {}) {
    // Ensure html2canvas library is loaded (it should be available globally via script tag in index.html)
    if (typeof html2canvas !== 'function') {
        console.error("[Capture v2.3] FATAL: html2canvas library not loaded!");
        throw new Error("HTML2Canvas library not found. Cannot perform snapshot.");
    }
    // Ensure the target element exists
    if (!logoContainer || !(logoContainer instanceof HTMLElement)) {
        console.error("[Capture v2.3] FATAL: Invalid or missing element provided for capture.");
        throw new Error("Invalid element provided for HTML2Canvas capture.");
    }

    console.log("[Capture v2.3] Starting enhanced HTML2Canvas capture...");
    console.log("[Capture v2.3] Incoming options:", options);

    let preparedElement = null; // Keep track for cleanup

    try {
        // --- Step 1: Prepare the element ---
        // This modifies the element temporarily (e.g., sets explicit size)
        preparedElement = await prepareElementForCapture(logoContainer, options);
        console.log("[Capture v2.3] Element prepared.");

        // --- Step 2: Configure html2canvas options ---
        // Use the explicit width/height potentially set during preparation or from options
        const captureWidth = parseInt(preparedElement.style.width) || options.width || 800;
        const captureHeight = parseInt(preparedElement.style.height) || options.height || 400;

        // Define default options for html2canvas capture
        const defaultOptions = {
            scale: window.devicePixelRatio * 2, // Higher quality render scale (adjust if performance is an issue)
            allowTaint: true,                  // Allows cross-origin images if server headers permit
            useCORS: true,                     // Attempts to load cross-origin images via CORS
            backgroundColor: options.transparentBackground ? null : (getComputedStyle(preparedElement).backgroundColor || '#ffffff'), // Use computed bg or null for transparency
            logging: false,                    // Set to true for verbose html2canvas debugging
            width: captureWidth,               // Use determined width
            height: captureHeight,             // Use determined height
            scrollX: 0,                        // Ensure capture starts at the top-left
            scrollY: 0,
            windowWidth: captureWidth,         // Provide window dimensions hint
            windowHeight: captureHeight,

             // --- CRITICAL FIX/ENHANCEMENT: onclone callback ---
             // This function runs *after* html2canvas clones the target element
             // but *before* it renders it. We use it to manually apply styles
             // that html2canvas might miss, especially fonts and CSS variables.
            onclone: (clonedDoc, originalElement) => {
                console.log("[Capture v2.3 - onclone] Enhancing cloned document...");
                const clonedPreviewContainer = clonedDoc.querySelector('#previewContainer'); // Find elements within the clone
                const clonedLogoText = clonedPreviewContainer?.querySelector('.logo-text');
                const originalLogoText = originalElement.querySelector('.logo-text'); // Get original for computed styles

                if (clonedLogoText && originalLogoText) {
                     try {
                         const computed = window.getComputedStyle(originalLogoText);
                         const rootComputed = window.getComputedStyle(document.documentElement); // Get root styles from original doc

                         console.log(`[Capture v2.3 - onclone] Applying styles to cloned .logo-text: font=${computed.fontFamily}, weight=${computed.fontWeight}, size=${computed.fontSize}, spacing=${computed.letterSpacing}, color=${computed.color}, transform=${computed.transform}, textShadow=${computed.textShadow}`);

                         // Force apply critical styles directly to the clone
                         clonedLogoText.style.fontFamily = computed.fontFamily;
                         clonedLogoText.style.fontWeight = computed.fontWeight;
                         clonedLogoText.style.fontSize = computed.fontSize;
                         // Try to get letter-spacing var first for potential 'em' units
                         clonedLogoText.style.letterSpacing = rootComputed.getPropertyValue('--dynamic-letter-spacing').trim() || computed.letterSpacing;
                         clonedLogoText.style.color = computed.color; // Apply computed solid color
                         clonedLogoText.style.transform = computed.transform; // Apply computed transform
                         clonedLogoText.style.textShadow = computed.textShadow; // Apply text effects/shadows
                         clonedLogoText.style.lineHeight = computed.lineHeight; // Apply line height
                         clonedLogoText.style.opacity = computed.opacity; // Apply text opacity

                         // Handle gradient text fill
                         if (computed.backgroundClip === 'text' || computed.webkitBackgroundClip === 'text') {
                              clonedLogoText.style.backgroundImage = computed.backgroundImage; // Apply computed gradient
                              clonedLogoText.style.backgroundClip = 'text';
                              clonedLogoText.style.webkitBackgroundClip = 'text';
                              clonedLogoText.style.color = 'transparent'; // Crucial: Make text color transparent
                              clonedLogoText.style.webkitTextFillColor = 'transparent'; // For webkit
                              console.log("[Capture v2.3 - onclone] Applied gradient text styles.");
                          } else {
                               // Ensure non-gradient text doesn't have gradient styles accidentally applied
                               clonedLogoText.style.backgroundImage = 'none';
                               clonedLogoText.style.backgroundClip = 'initial';
                               clonedLogoText.style.webkitBackgroundClip = 'initial';
                               clonedLogoText.style.color = computed.color; // Re-apply solid color if needed
                               clonedLogoText.style.webkitTextFillColor = 'initial';
                          }

                         // Force data-text for glitch animation if applicable
                          if (originalLogoText.classList.contains('anim-glitch')) {
                               clonedLogoText.setAttribute('data-text', originalLogoText.textContent);
                               console.log("[Capture v2.3 - onclone] Applied data-text for glitch.");
                          }
                     } catch (cloneStyleError) {
                          console.error("[Capture v2.3 - onclone] Error applying styles to cloned text:", cloneStyleError);
                     }
                } else {
                     console.warn("[Capture v2.3 - onclone] Could not find .logo-text element in cloned document.");
                }

                 // Apply necessary CSS Custom Properties (Variables) to the cloned root
                 try {
                    const clonedRoot = clonedDoc.documentElement;
                    if (clonedRoot) {
                         // List all CSS variables your styles rely on
                         const propsToClone = [
                              '--dynamic-font-size', '--dynamic-letter-spacing', '--dynamic-rotation',
                              '--dynamic-border-color', '--dynamic-border-color-rgb', '--dynamic-border-width',
                              '--primary-color', '--secondary-color', '--accent-color',
                              '--primary-color-rgb', '--secondary-color-rgb', '--accent-color-rgb',
                              // Add any other variables used by effects.css, gradients, etc.
                         ];
                         let appliedCount = 0;
                         propsToClone.forEach(prop => {
                              const value = rootComputed.getPropertyValue(prop).trim();
                              if (value) { // Only apply if the variable has a value
                                   clonedRoot.style.setProperty(prop, value);
                                   appliedCount++;
                              }
                         });
                         console.log(`[Capture v2.3 - onclone] Applied ${appliedCount} CSS variables to cloned root.`);
                    } else {
                         console.warn("[Capture v2.3 - onclone] Could not find root element in cloned document.");
                    }
                 } catch (cloneVarError) {
                      console.error("[Capture v2.3 - onclone] Error applying CSS variables to cloned root:", cloneVarError);
                 }
            } // --- End of onclone ---
        };

        // Merge caller's options with defaults, ensuring our critical options take precedence
        const captureOptions = {
             ...defaultOptions, // Start with defaults
             ...options,         // Apply caller's overrides (e.g., transparentBackground)
             width: captureWidth, // FORCE width
             height: captureHeight, // FORCE height
             scale: defaultOptions.scale, // FORCE scale
             backgroundColor: options.transparentBackground ? null : defaultOptions.backgroundColor // FORCE background based on transparency
        };
        console.log("[Capture v2.3] Final html2canvas options:", captureOptions);

        // --- Step 3: Execute the capture ---
        console.log("[Capture v2.3] Beginning HTML2Canvas rendering...");
        const canvas = await html2canvas(preparedElement, captureOptions);
        console.log(`[Capture v2.3] HTML2Canvas capture successful! Canvas size: ${canvas.width}x${canvas.height}`);

        // NOTE: Resizing canvas if needed (e.g., if scale resulted in larger canvas than target width/height)
        let finalCanvas = canvas;
        if (canvas.width !== captureWidth * defaultOptions.scale || canvas.height !== captureHeight * defaultOptions.scale) {
             console.warn(`[Capture v2.3] Raw canvas size (${canvas.width}x${canvas.height}) differs from expected scaled size (${captureWidth * defaultOptions.scale}x${captureHeight * defaultOptions.scale}). This might indicate capture issues. Resizing to target dimensions.`);
             // It's often better *not* to resize here, but let the PNG export handle final dimensions
             // For consistency, let's resize down if needed, though quality might degrade slightly.
             /* // Optional resize block:
             finalCanvas = document.createElement('canvas');
             finalCanvas.width = captureWidth; // Target export size
             finalCanvas.height = captureHeight;
             const ctx = finalCanvas.getContext('2d');
             if (!ctx) throw new Error("Failed to get context for resizing canvas");
             // Draw potentially scaled canvas onto target size canvas
             ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, captureWidth, captureHeight);
             console.log(`[Capture v2.3] Resized canvas to ${captureWidth}x${captureHeight}`);
             */
             // For now, return the raw canvas from html2canvas
             console.log(`[Capture v2.3] Returning raw canvas from html2canvas without resizing.`);
        }


        return finalCanvas; // Return canvas BEFORE cleanup on success

    } catch (error) {
        console.error("[Capture v2.3] HTML2Canvas capture process failed:", error);
        // Provide more specific user feedback based on common errors
         const errorMsg = error instanceof Error ? error.message : String(error);
         let userFriendlyError = `Snapshot failed: ${errorMsg}`;
         if (errorMsg.includes('SecurityError') || errorMsg.includes('tainted')) {
             userFriendlyError = "Snapshot failed due to cross-origin security restrictions (external fonts/images?). Try running from a local server or ensure CORS is configured if using external resources.";
         } else if (errorMsg.includes('Timeout')) {
             userFriendlyError = "Snapshot timed out, the logo might be too complex for html2canvas.";
         }
         // Throw the more user-friendly error
        throw new Error(userFriendlyError);
    } finally {
        // --- Step 4: Cleanup ---
        // This ALWAYS runs, regardless of success/error
        if (preparedElement) {
            cleanupAfterCapture(preparedElement); // Restore original state
        }
    }
}


/**
 * Prepare element for more accurate capture (v2.1)
 * Sets explicit dimensions, ensures fonts are ready, adds data-text if needed.
 * @param {HTMLElement} element - Original element to capture (will be modified)
 * @param {object} options - Capture options, including potential width/height.
 * @returns {Promise<HTMLElement>} Prepared element ready for capture
 */
async function prepareElementForCapture(element, options = {}) {
    console.log("[Capture Prep v2.1] Preparing element...");

    // Store original inline styles that we might temporarily override
    const originalInlineStyle = element.getAttribute('style') || ''; // Store the entire style attribute
    let originalDataText = null;

    // --- Set Explicit Dimensions for Capture ---
    // Use dimensions from options if provided, otherwise measure the element
    const explicitWidth = options.width || element.offsetWidth || 800;
    const explicitHeight = options.height || element.offsetHeight || 400;
    console.log(`[Capture Prep v2.1] Setting explicit capture dimensions: ${explicitWidth}x${explicitHeight}`);
    element.style.width = `${explicitWidth}px`;
    element.style.height = `${explicitHeight}px`;
    // Ensure container allows content to be visible if needed (though usually okay)
    // element.style.overflow = 'visible';


    // --- Ensure Fonts Are Ready ---
    console.log("[Capture Prep v2.1] Waiting for document.fonts.ready...");
    try {
        await document.fonts.ready;
        console.log("[Capture Prep v2.1] document.fonts.ready resolved.");
    } catch (fontError) {
         console.warn("[Capture Prep v2.1] Error waiting for document.fonts.ready:", fontError);
         // Continue anyway, but capture might be inaccurate
    }

    // --- Handle Glitch Animation Data Attribute ---
    const logoText = element.querySelector('.logo-text');
    if (logoText) {
        originalDataText = logoText.getAttribute('data-text'); // Store original
        if (logoText.classList.contains('anim-glitch')) {
            // Ensure data-text matches current text content for glitch effect
            if (logoText.getAttribute('data-text') !== logoText.textContent) {
                 logoText.setAttribute('data-text', logoText.textContent);
                 console.log("[Capture Prep v2.1] Applied data-text for glitch animation.");
            }
        }
    }

    // Store data needed for cleanup
    element._capturePreparationData = {
        originalInlineStyle, // Store the whole original style attribute
        originalDataText,
        logoTextElement: logoText // Store reference if needed for data-text cleanup
    };

    // Add a tiny delay for rendering engines to apply styles (especially after fonts ready)
    await new Promise(resolve => setTimeout(resolve, 100)); // Increased delay slightly

    console.log("[Capture Prep v2.1] Element preparation finished.");
    return element; // Return the modified original element
}

/**
 * Clean up after capture to restore original element state (v2.1)
 * Restores original inline style attribute and data-text.
 * @param {HTMLElement} modifiedElement - Element that was prepared
 */
function cleanupAfterCapture(modifiedElement) {
    console.log("[Capture Cleanup v2.1] Cleaning up element...");

    const prepData = modifiedElement._capturePreparationData;
    if (prepData) {
        // Restore the original inline style attribute completely
        modifiedElement.setAttribute('style', prepData.originalInlineStyle);
        console.log("[Capture Cleanup v2.1] Restored original inline styles.");

        // Restore data-text attribute if it was changed
        const logoText = prepData.logoTextElement;
        if (logoText) {
            const currentDataText = logoText.getAttribute('data-text');
            if (prepData.originalDataText === null && currentDataText !== null) {
                // If original was null/missing, remove it
                logoText.removeAttribute('data-text');
                 console.log("[Capture Cleanup v2.1] Removed temporary data-text attribute.");
            } else if (prepData.originalDataText !== null && currentDataText !== prepData.originalDataText) {
                 // If original had a value, restore it
                logoText.setAttribute('data-text', prepData.originalDataText);
                 console.log("[Capture Cleanup v2.1] Restored original data-text attribute.");
            }
        }

        // Remove preparation data marker
        delete modifiedElement._capturePreparationData;
        console.log("[Capture Cleanup v2.1] Cleanup complete.");
    } else {
        console.warn("[Capture Cleanup v2.1] No preparation data found on element. Cannot restore state precisely.");
         // As a basic fallback, remove potentially added width/height styles if no prep data
         modifiedElement.style.width = '';
         modifiedElement.style.height = '';
    }
}

// Example Usage (within PNGRenderer.js handleExport or updatePreview):
/*
async function useSnapshot() {
    const previewContainer = document.getElementById('previewContainer');
    const pngOptions = {
        width: 800, // Desired final width
        height: 400, // Desired final height
        transparentBackground: false
    };
    try {
        const canvas = await captureLogoWithHTML2Canvas(previewContainer, pngOptions);
        // Convert canvas to Blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        // Trigger download or display
        console.log('Snapshot Blob:', blob);
    } catch (error) {
        console.error("Snapshot failed:", error);
        // Show alert to user
    }
}
*/