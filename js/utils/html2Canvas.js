/**
 * js/utils/html2Canvas.js (Enhanced v2.6 - Simplified onclone Border & Scope Fix)
 * ===========================================================================
 * Provides enhanced HTML2Canvas implementation for accurate logo capturing.
 * Simplifies onclone border logic to rely more on cloned classes + variables.
 * Fixes variable scope issue within onclone.
 */

console.log("[HTML2Canvas Util] Module loading (v2.6 - Simplified onclone Border)...");

/**
 * Capture an element (typically #previewContainer) with HTML2Canvas with enhanced accuracy.
 * Uses prepare/cleanup helpers and an onclone callback for better style fidelity.
 * @param {HTMLElement} elementToCapture - The element to capture (usually #previewContainer).
 * @param {object} options - Additional options for html2canvas (e.g., { width, height, transparentBackground }).
 * @returns {Promise<HTMLCanvasElement>} Canvas with captured content.
 */
export async function captureLogoWithHTML2Canvas(elementToCapture, options = {}) {
    // Ensure html2canvas library is loaded (should be global via script tag)
    if (typeof html2canvas !== 'function') {
        console.error("[Capture v2.6] FATAL: html2canvas library not loaded!");
        throw new Error("HTML2Canvas library not found. Cannot perform snapshot.");
    }
    // Ensure the target element exists
    if (!elementToCapture || !(elementToCapture instanceof HTMLElement)) {
        console.error("[Capture v2.6] FATAL: Invalid or missing element provided for capture.");
        throw new Error("Invalid element provided for HTML2Canvas capture.");
    }

    console.log(`[Capture v2.6] Starting enhanced HTML2Canvas capture on element: #${elementToCapture.id || elementToCapture.tagName}`);
    console.log("[Capture v2.6] Incoming options:", options);

    let preparedElement = null; // Keep track for cleanup
    // Declare error variable accessible in finally block
    let errorOccurred = null;


    try {
        // --- Step 1: Prepare the element ---
        preparedElement = await prepareElementForCapture(elementToCapture, options);
        console.log("[Capture v2.6] Element prepared.");

        // --- Step 2: Configure html2canvas options ---
        const captureWidth = parseInt(preparedElement.style.width) || options.width || 800;
        const captureHeight = parseInt(preparedElement.style.height) || options.height || 400;

        const defaultOptions = {
            scale: window.devicePixelRatio * 2, // Higher quality render scale
            allowTaint: true,                   // Allows cross-origin images if server headers permit
            useCORS: true,                      // Attempts to load cross-origin images via CORS
            // Determine background: Use explicit option first, then element's computed style, fallback white
            backgroundColor: options.transparentBackground ? null : (getComputedStyle(preparedElement).backgroundColor || '#ffffff'),
            logging: false,                     // Set to true for verbose html2canvas debugging
            width: captureWidth,                // Use determined width
            height: captureHeight,              // Use determined height
            scrollX: -window.scrollX,           // Account for page scroll
            scrollY: -window.scrollY,
            windowWidth: document.documentElement.scrollWidth, // Try using actual scroll width/height
            windowHeight: document.documentElement.scrollHeight,

            onclone: (clonedDoc, originalElement) => {
                console.log("[Capture v2.6 - onclone] Enhancing cloned document...");

                // --- Define rootComputed HERE, accessible throughout onclone ---
                let rootComputed;
                try {
                    // Use the *original* document's root for computed variables
                    rootComputed = window.getComputedStyle(document.documentElement);
                    if (!rootComputed) throw new Error("Could not get computed styles from documentElement");
                     console.log("[Capture v2.6 - onclone] Successfully obtained rootComputed styles.");
                } catch (e) {
                    console.error("[Capture v2.6 - onclone] CRITICAL: Failed to get root computed styles from original document!", e);
                    // Cannot proceed reliably without root styles, html2canvas might fail severely
                    return; // Stop further onclone processing
                }
                // --- End defining rootComputed ---

                // Find the cloned version of the element we captured (usually #previewContainer)
                // It might not have the same ID in the clone, find based on structure if needed, but ID is best
                const clonedPreviewContainer = clonedDoc.getElementById(originalElement.id);
                if (!clonedPreviewContainer) {
                    console.error(`[Capture v2.6 - onclone] CRITICAL: Could not find cloned element with ID: ${originalElement.id}`);
                    return; // Stop further onclone processing
                } else {
                    console.log(`[Capture v2.6 - onclone] Found cloned container: #${clonedPreviewContainer.id}`);
                }

                // Find children within the cloned container
                const clonedLogoContainer = clonedPreviewContainer.querySelector('.logo-container');
                const clonedLogoText = clonedPreviewContainer.querySelector('.logo-text');

                // Get originals for comparison
                const originalLogoContainer = originalElement.querySelector('.logo-container');
                const originalLogoText = originalElement.querySelector('.logo-text');

                // --- Style .logo-container (Simplified Approach) ---
                if (clonedLogoContainer && originalLogoContainer) {
                    try {
                        const computedContainer = window.getComputedStyle(originalLogoContainer);
                        console.log(`[Capture v2.6 - onclone] Applying styles to cloned .logo-container (variables + essential inline)...`);

                        // 1. Ensure essential classes are cloned (html2canvas *should* do this)
                        // Manually copy classes just in case html2canvas misses some? (Optional, can add complexity)
                        // clonedLogoContainer.className = originalLogoContainer.className;

                        // 2. Apply CSS Variables related to border/padding
                        const borderVars = ['--dynamic-border-width', '--dynamic-border-color', '--dynamic-border-radius', '--dynamic-border-padding'];
                        let varsApplied = 0;
                        borderVars.forEach(varName => {
                            const value = rootComputed?.getPropertyValue(varName).trim(); // Use optional chaining just in case
                            if (value) {
                                clonedLogoContainer.style.setProperty(varName, value);
                                varsApplied++;
                            }
                        });
                         console.log(`[Capture v2.6 - onclone] Applied ${varsApplied} border CSS variables to .logo-container.`);

                        // 3. Apply only ESSENTIAL computed inline styles that might be missed or conflict
                        clonedLogoContainer.style.boxSizing = computedContainer.boxSizing;
                        clonedLogoContainer.style.padding = computedContainer.padding;
                        clonedLogoContainer.style.borderRadius = computedContainer.borderRadius; // Still apply this inline for safety

                        // 4. Apply box-shadow for glow effects
                        clonedLogoContainer.style.boxShadow = computedContainer.boxShadow;
                         if(computedContainer.boxShadow && computedContainer.boxShadow !== 'none') {
                             console.log(`[Capture v2.6 - onclone] Applied effect to .logo-container: boxShadow=${computedContainer.boxShadow}`);
                         }

                         // --- REMOVED applying computedContainer.border, borderStyle, borderWidth, borderColor inline ---
                         // Relying more on cloned classes + CSS vars now.

                    } catch (containerStyleError) {
                        console.error("[Capture v2.6 - onclone] Error applying styles to cloned container:", containerStyleError);
                    }
                } else {
                    console.warn("[Capture v2.6 - onclone] Could not find .logo-container in original or cloned document.");
                }

                // --- Style .logo-text (Keep robust application) ---
                 if (clonedLogoText && originalLogoText) {
                      try {
                          const computed = window.getComputedStyle(originalLogoText);
                          // rootComputed defined earlier

                          console.log(`[Capture v2.6 - onclone] Applying computed styles to cloned .logo-text...`);

                          clonedLogoText.style.fontFamily = computed.fontFamily;
                          clonedLogoText.style.fontWeight = computed.fontWeight;
                          clonedLogoText.style.fontStyle = computed.fontStyle;
                          clonedLogoText.style.fontSize = computed.fontSize;
                          clonedLogoText.style.letterSpacing = rootComputed?.getPropertyValue('--dynamic-letter-spacing').trim() || computed.letterSpacing;
                          clonedLogoText.style.color = computed.color;
                          clonedLogoText.style.transform = computed.transform;
                          clonedLogoText.style.textShadow = computed.textShadow;
                          clonedLogoText.style.lineHeight = computed.lineHeight;
                          clonedLogoText.style.opacity = computed.opacity;
                          clonedLogoText.style.textAlign = computed.textAlign;
                          clonedLogoText.style.whiteSpace = computed.whiteSpace;
                          clonedLogoText.style.textTransform = computed.textTransform;

                          // Handle gradient text fill
                          if (computed.backgroundClip === 'text' || computed.webkitBackgroundClip === 'text') {
                              clonedLogoText.style.backgroundImage = computed.backgroundImage;
                              clonedLogoText.style.backgroundClip = 'text';
                              clonedLogoText.style.webkitBackgroundClip = 'text';
                              clonedLogoText.style.color = 'transparent';
                              clonedLogoText.style.webkitTextFillColor = 'transparent';
                              // console.log("[Capture v2.6 - onclone] Applied gradient text styles.");
                          } else {
                              // Ensure non-gradient text doesn't have residual gradient styles
                              clonedLogoText.style.backgroundImage = 'none';
                              clonedLogoText.style.backgroundClip = 'initial';
                              clonedLogoText.style.webkitBackgroundClip = 'initial';
                              // Re-apply color just in case
                              clonedLogoText.style.color = computed.color;
                              clonedLogoText.style.webkitTextFillColor = 'initial';
                          }

                          // Handle glitch data-text attribute
                          if (originalLogoText.classList.contains('anim-glitch')) {
                              const textContent = originalLogoText.textContent || '';
                              clonedLogoText.setAttribute('data-text', textContent);
                              console.log("[Capture v2.6 - onclone] Applied data-text for glitch animation.");
                          }
                      } catch (cloneStyleError) {
                          console.error("[Capture v2.6 - onclone] Error applying styles to cloned text:", cloneStyleError);
                      }
                 } else {
                     console.warn("[Capture v2.6 - onclone] Could not find .logo-text element in original or cloned document.");
                 }

                 // --- Apply CSS Variables to Root ---
                 try {
                     const clonedRoot = clonedDoc.documentElement;
                     if (clonedRoot && rootComputed) { // Check if rootComputed was defined
                         const propsToClone = [
                             // Include all relevant variables used by components/effects
                             '--dynamic-font-size', '--dynamic-letter-spacing', '--dynamic-rotation',
                             '--dynamic-border-color', '--dynamic-border-color-rgb', '--dynamic-border-width',
                             '--dynamic-border-radius', '--dynamic-border-padding',
                             '--primary-color', '--secondary-color', '--accent-color',
                             '--primary-color-rgb', '--secondary-color-rgb', '--accent-color-rgb',
                             '--animation-duration', '--gradient-direction', '--bg-gradient-direction',
                             '--border-radius-sm', '--border-radius-md', '--border-radius-lg',
                             '--surface-sunken-opaque', '--border-subtle', '--bg-base', '--border-default',
                             '--bg-deep', '--accent-color-rgb',
                             // Add any theme variables if needed
                             '--text-color', '--text-color-muted', '--text-color-strong',
                             '--panel-bg', '--panel-bg-opaque', '--input-bg', '--button-bg',
                             '--border-color'
                         ];
                         let appliedCount = 0;
                         propsToClone.forEach(prop => {
                             const value = rootComputed.getPropertyValue(prop).trim();
                             if (value) {
                                 clonedRoot.style.setProperty(prop, value);
                                 appliedCount++;
                             }
                         });
                         console.log(`[Capture v2.6 - onclone] Applied ${appliedCount} CSS variables to cloned root.`);
                     } else if (!clonedRoot){
                         console.warn("[Capture v2.6 - onclone] Could not find root element in cloned document.");
                     } else {
                         // This case should not happen anymore with the fix, but keep warning just in case
                         console.warn("[Capture v2.6 - onclone] Could not apply CSS variables because rootComputed failed earlier.");
                     }
                 } catch (cloneVarError) {
                      console.error("[Capture v2.6 - onclone] Error applying CSS variables to cloned root:", cloneVarError);
                 }

                 console.log("[Capture v2.6 - onclone] Finished enhancing clone.");
            } // --- End of onclone ---
        };

        // Merge caller's options with defaults
        const captureOptions = {
            ...defaultOptions,
            ...options,
            // Re-assert critical options to prevent override if necessary
            width: captureWidth,
            height: captureHeight,
            scale: defaultOptions.scale,
            backgroundColor: options.transparentBackground ? null : defaultOptions.backgroundColor
        };
        console.log("[Capture v2.6] Final html2canvas options:", captureOptions);

        // --- Step 3: Execute the capture ---
        console.log("[Capture v2.6] Beginning HTML2Canvas rendering...");
        const canvas = await html2canvas(preparedElement, captureOptions);
        console.log(`[Capture v2.6] HTML2Canvas capture successful! Canvas size: ${canvas.width}x${canvas.height}`);

        // --- Step 4: Post-processing (Optional Resize - Often handled by exporter) ---
        let finalCanvas = canvas;
        // Example resize logic (usually not needed here):
        /*
        if (canvas.width !== captureWidth * defaultOptions.scale || canvas.height !== captureHeight * defaultOptions.scale) {
            console.warn(`[Capture v2.6] Raw canvas size differs from expected scaled size. Resizing...`);
            finalCanvas = document.createElement('canvas');
            finalCanvas.width = captureWidth * defaultOptions.scale;
            finalCanvas.height = captureHeight * defaultOptions.scale;
            const ctx = finalCanvas.getContext('2d');
            if (!ctx) throw new Error("Failed to get context for resizing canvas");
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, finalCanvas.width, finalCanvas.height);
            console.log(`[Capture v2.6] Resized canvas to ${finalCanvas.width}x${finalCanvas.height}`);
        }
        */

        return finalCanvas; // Return canvas BEFORE cleanup on success

    } catch (error) {
        // --- Error Handling ---
        errorOccurred = error; // Store error to check in finally block
        console.error("[Capture v2.6] HTML2Canvas capture process failed:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        let userFriendlyError = `Snapshot failed: ${errorMsg}`;
        if (errorMsg.includes('SecurityError') || errorMsg.includes('tainted')) {
             userFriendlyError = "Snapshot failed due to cross-origin security restrictions (external fonts/images?). Ensure CORS is configured if using external resources, or try the SVG Render method.";
        } else if (errorMsg.includes('Timeout')) {
             userFriendlyError = "Snapshot timed out, the logo might be too complex for html2canvas.";
        }
        // Ensure cleanup runs even on error before throwing
        if (preparedElement) {
             try { cleanupAfterCapture(preparedElement); } catch (cleanupErr) { console.error("Error during cleanup after failed capture:", cleanupErr); }
        }
        throw new Error(userFriendlyError); // Throw error *after* cleanup attempt
    } finally {
        // --- Step 5: Cleanup (if successful) ---
        // Cleanup only happens here if the try block completed *without* throwing an error
        if (preparedElement && !errorOccurred) {
            cleanupAfterCapture(preparedElement);
        }
    }
}


/**
 * Prepare element for more accurate capture (v2.5)
 * Sets explicit dimensions, ensures fonts are ready, handles glitch text.
 * @param {HTMLElement} element - Original element to capture (will be modified)
 * @param {object} options - Capture options, including potential width/height.
 * @returns {Promise<HTMLElement>} Prepared element ready for capture
 */
async function prepareElementForCapture(element, options = {}) {
    console.log("[Capture Prep v2.5] Preparing element...");

    const originalInlineStyle = element.getAttribute('style') || '';
    let originalDataText = null;
    const logoText = element.querySelector('.logo-text');

    // --- Set Explicit Dimensions ---
    const explicitWidth = options.width || element.offsetWidth || 800;
    const explicitHeight = options.height || element.offsetHeight || 400;
    console.log(`[Capture Prep v2.5] Setting explicit capture dimensions: ${explicitWidth}x${explicitHeight}`);
    element.style.width = `${explicitWidth}px`;
    element.style.height = `${explicitHeight}px`;
    element.style.overflow = 'hidden'; // Prevent content bleed affecting capture size

    // --- Ensure Fonts Are Ready ---
    console.log("[Capture Prep v2.5] Waiting for document.fonts.ready...");
    try {
        // Add a timeout for fonts.ready as it can hang indefinitely
        await Promise.race([
             document.fonts.ready,
             new Promise((_, reject) => setTimeout(() => reject(new Error('fonts.ready timeout')), 3000)) // 3 second timeout
        ]);
        console.log("[Capture Prep v2.5] document.fonts.ready resolved or timed out gracefully.");
    } catch (fontError) {
        console.warn("[Capture Prep v2.5] Error or timeout waiting for document.fonts.ready:", fontError.message);
        // Continue anyway, capture might use fallback fonts
    }

    // --- Handle Glitch Animation Data Attribute ---
    if (logoText) {
        originalDataText = logoText.getAttribute('data-text'); // Store original
        if (logoText.classList.contains('anim-glitch')) {
            // Ensure data-text matches current text content for glitch effect
             const currentText = logoText.textContent || '';
             if (logoText.getAttribute('data-text') !== currentText) {
                 logoText.setAttribute('data-text', currentText);
                 console.log("[Capture Prep v2.5] Applied data-text for glitch animation.");
             }
        }
    }

    // --- Store data needed for cleanup ---
    element._capturePreparationData = {
        originalInlineStyle,
        originalDataText,
        logoTextElement: logoText // Store reference if needed for data-text cleanup
    };

    // --- Delay slightly for rendering engines to apply styles ---
    // Use requestAnimationFrame for potentially better timing than setTimeout
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); // Wait two frames
    // await new Promise(resolve => setTimeout(resolve, 50)); // Shorter delay

    console.log("[Capture Prep v2.5] Element preparation finished.");
    return element; // Return the modified original element
}

/**
 * Clean up after capture to restore original element state (v2.5)
 * Restores original inline style attribute and data-text.
 * @param {HTMLElement} modifiedElement - Element that was prepared
 */
function cleanupAfterCapture(modifiedElement) {
    console.log("[Capture Cleanup v2.5] Cleaning up element...");

    const prepData = modifiedElement._capturePreparationData;
    if (prepData) {
        // Restore the original inline style attribute completely
        modifiedElement.setAttribute('style', prepData.originalInlineStyle);
        // console.log("[Capture Cleanup v2.5] Restored original inline styles."); // Less verbose

        // Restore data-text attribute if it was changed
        const logoText = prepData.logoTextElement;
        if (logoText) {
            const currentDataText = logoText.getAttribute('data-text');
            if (prepData.originalDataText === null && currentDataText !== null) {
                // If original was null/missing, remove it
                logoText.removeAttribute('data-text');
                // console.log("[Capture Cleanup v2.5] Removed temporary data-text attribute.");
            } else if (prepData.originalDataText !== null && currentDataText !== prepData.originalDataText) {
                // If original had a value, restore it
                logoText.setAttribute('data-text', prepData.originalDataText);
                // console.log("[Capture Cleanup v2.5] Restored original data-text attribute.");
            }
        }

        // Remove preparation data marker
        delete modifiedElement._capturePreparationData;
        console.log("[Capture Cleanup v2.5] Cleanup complete.");
    } else {
        console.warn("[Capture Cleanup v2.5] No preparation data found. Cannot restore state precisely.");
        // As a basic fallback, remove potentially added width/height/overflow styles
        modifiedElement.style.width = '';
        modifiedElement.style.height = '';
        modifiedElement.style.overflow = '';
    }
}