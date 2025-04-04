/**
 * Enhanced HTML2Canvas implementation for accurate logo capturing
 * This should be used in your export/screenshot functionality
 */

/**
 * Capture logo container with HTML2Canvas with enhanced accuracy (Updated v2.1)
 * Uses the simplified prepare/cleanup functions.
 * @param {HTMLElement} logoContainer - The logo container element (usually #previewContainer)
 * @param {object} options - Additional options for html2canvas
 * @returns {Promise<HTMLCanvasElement>} Canvas with captured content
 */
export async function captureLogoWithHTML2Canvas(logoContainer, options = {}) {
    // Ensure html2canvas is loaded
    if (typeof html2canvas !== 'function') {
        console.error("[Capture] HTML2Canvas not loaded!");
        throw new Error("HTML2Canvas library not found");
    }

    console.log("[Capture] Starting enhanced HTML2Canvas capture (v2.1)...");

    let preparedElement = null; // Keep track for cleanup

    try {
        // Step 1: Prepare the element (modifies it in place)
        // Use the actual logo container passed in (e.g., #previewContainer)
        preparedElement = await prepareElementForCapture(logoContainer);

        // Step 2: Configure html2canvas options
        // Use the explicit width/height set during preparation
        const captureWidth = parseInt(preparedElement.style.width) || options.width || 800;
        const captureHeight = parseInt(preparedElement.style.height) || options.height || 400;

        const defaultOptions = {
            scale: window.devicePixelRatio * 2, // Higher quality render scale
            allowTaint: true,
            useCORS: true,
            backgroundColor: options.transparentBackground ? null : (getComputedStyle(preparedElement).backgroundColor || '#ffffff'), // Use computed bg or null
            logging: false,
            width: captureWidth,
            height: captureHeight,
            // onclone: enhanceClonedElement // You might still need this if html2canvas misses styles/vars
        };

        // Merge caller options with defaults, ensuring width/height/scale are prioritized
        const captureOptions = { ...defaultOptions, ...options, width: captureWidth, height: captureHeight, scale: defaultOptions.scale };
        console.log("[Capture] Using html2canvas options:", captureOptions);

        // Step 3: Execute the capture
        console.log("[Capture] Beginning HTML2Canvas rendering...");
        const canvas = await html2canvas(preparedElement, captureOptions);
        console.log("[Capture] HTML2Canvas capture successful!");

        // NOTE: The canvas returned by html2canvas might have dimensions based on scale.
        // Resizing it back to the target width/height might be needed depending on usage.
        // This resizing step is omitted here for simplicity, assuming the caller handles it if necessary.

        return canvas; // Return canvas BEFORE cleanup on success

    } catch (error) {
        console.error("[Capture] HTML2Canvas capture failed:", error);
        throw error; // Re-throw error after logging
    } finally {
        // Step 4: Cleanup (ALWAYS runs, regardless of success/error)
        if (preparedElement) {
            cleanupAfterCapture(preparedElement); // Use the simplified cleanup
        }
    }
}


/**
 * Prepare element for more accurate capture (Simplified v2)
 * Avoids applying inline styles that conflict with class-based styling.
 * @param {HTMLElement} element - Original element to capture (will be modified)
 * @returns {Promise<HTMLElement>} Prepared element ready for capture
 */
async function prepareElementForCapture(element) {
    console.log("[Capture] Preparing element for capture (Simplified v2)...");

    // Store original inline styles that we might temporarily override for capture sizing
    const originalInlineWidth = element.style.width;
    const originalInlineHeight = element.style.height;
    let originalDataText = null; // Initialize

    // Ensure width and height are explicit *for capture dimensions*
    // This helps html2canvas determine the capture area correctly.
    const rect = element.getBoundingClientRect();
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;

    // Ensure fonts associated with the current classes are ready
    await document.fonts.ready;
    console.log("[Capture] document.fonts.ready resolved.");

    // Force data attribute for glitch animation if needed and store original
    const logoText = element.querySelector('.logo-text');
    if (logoText) {
        originalDataText = logoText.getAttribute('data-text'); // Store original
        if (logoText.classList.contains('anim-glitch')) {
            logoText.setAttribute('data-text', logoText.textContent);
             console.log("[Capture] Applied data-text for glitch animation.");
        }
        // --- DO NOT APPLY INLINE STYLES HERE ---
        // REMOVED: logoText.style.fontFamily = textStyle.fontFamily;
        // REMOVED: logoText.style.fontWeight = textStyle.fontWeight;
        // REMOVED: logoText.style.fontSize = textStyle.fontSize; etc.
    }

    // Store minimal preparation data for cleanup
    element._capturePreparationData = {
        originalInlineWidth,
        originalInlineHeight,
        originalDataText
    };

    // Add a tiny delay for rendering engines (optional, might not be needed with fonts.ready)
    await new Promise(resolve => setTimeout(resolve, 50));

    return element; // Return the modified original element
}


/**
 * Capture original styles for restoration
 * @param {HTMLElement} element - Element to capture styles from
 * @returns {object} Original style data
 */
function captureOriginalStyles(element) {
    const originalStyles = {
        element: {
            width: element.style.width,
            height: element.style.height,
            transform: element.style.transform,
            transformOrigin: element.style.transformOrigin
        },
        logoText: {}
    };
    
    const logoText = element.querySelector('.logo-text');
    if (logoText) {
        originalStyles.logoText = {
            textAlign: logoText.style.textAlign,
            fontFamily: logoText.style.fontFamily,
            fontSize: logoText.style.fontSize,
            fontWeight: logoText.style.fontWeight,
            letterSpacing: logoText.style.letterSpacing,
            dataText: logoText.getAttribute('data-text')
        };
    }
    
    return originalStyles;
}

/**
 * Enhance the cloned element in html2canvas
 * @param {Document} clonedDoc - The cloned document from html2canvas
 */
function enhanceClonedElement(clonedDoc) {
    console.log("[Capture] Enhancing cloned element...");
    
    // Fix any CSS custom properties
    applyComputedCustomProperties(clonedDoc);
    
    // Fix animation properties that might be needed
    fixAnimationClasses(clonedDoc);
    
    // Ensure borders are properly styled
    fixBorderStyles(clonedDoc);
}

/**
 * Apply computed CSS custom properties to all elements
 * @param {Document} doc - Document to process
 */
function applyComputedCustomProperties(doc) {
    // Get all CSS variables from root
    const rootStyles = getComputedStyle(document.documentElement);
    const customProps = {};
    
    for (let i = 0; i < rootStyles.length; i++) {
        const prop = rootStyles[i];
        if (prop.startsWith('--')) {
            customProps[prop] = rootStyles.getPropertyValue(prop);
        }
    }
    
    // Apply to cloned document root
    const clonedRoot = doc.documentElement;
    for (const [prop, value] of Object.entries(customProps)) {
        clonedRoot.style.setProperty(prop, value);
    }
}

/**
 * Fix animation classes in cloned document
 * @param {Document} doc - Document to process
 */
function fixAnimationClasses(doc) {
    // Fix glitch animation specifically
    const glitchElements = doc.querySelectorAll('.anim-glitch');
    glitchElements.forEach(el => {
        // Ensure data-text attribute is present
        if (!el.hasAttribute('data-text')) {
            el.setAttribute('data-text', el.textContent);
        }
    });
}

/**
 * Fix border styles in cloned document
 * @param {Document} doc - Document to process
 */
function fixBorderStyles(doc) {
    // Fix any border elements that need special handling
    const borderElements = doc.querySelectorAll('.dynamic-border');
    borderElements.forEach(el => {
        const computed = getComputedStyle(el);
        
        // Apply computed border styles directly
        el.style.borderStyle = computed.borderStyle;
        el.style.borderWidth = computed.borderWidth;
        el.style.borderColor = computed.borderColor;
        
        // Fix any box-shadows
        el.style.boxShadow = computed.boxShadow;
    });
}
/**
 * Clean up after capture to restore original element state (Simplified v2)
 * Restores only styles explicitly changed during preparation.
 * @param {HTMLElement} modifiedElement - Element that was prepared
 */
function cleanupAfterCapture(modifiedElement) {
    console.log("[Capture] Cleaning up after capture (Simplified v2)...");

    const prepData = modifiedElement._capturePreparationData;
    if (prepData) {
        // Restore only the styles we explicitly changed
        modifiedElement.style.width = prepData.originalInlineWidth;
        modifiedElement.style.height = prepData.originalInlineHeight;

        // Restore data-text attribute
        const logoText = modifiedElement.querySelector('.logo-text');
        if (logoText) {
            if (prepData.originalDataText !== null && prepData.originalDataText !== undefined) {
                logoText.setAttribute('data-text', prepData.originalDataText);
                 console.log("[Capture Cleanup] Restored data-text attribute.");
            } else {
                logoText.removeAttribute('data-text');
                 console.log("[Capture Cleanup] Removed data-text attribute (was not set originally).");
            }
        }

        // Remove preparation data marker
        delete modifiedElement._capturePreparationData;
        console.log("[Capture] Cleanup complete.");
    } else {
        console.warn("[Capture] Cleanup: No preparation data found on element.");
    }
}

/**
 * Example usage:
 * 
 * async function exportLogo() {
 *   const logoContainer = document.querySelector('.logo-container');
 *   try {
 *     const canvas = await captureLogoWithHTML2Canvas(logoContainer);
 *     
 *     // Use the canvas - e.g., convert to PNG
 *     const pngUrl = canvas.toDataURL('image/png');
 *     
 *     // Download or display the image
 *     const downloadLink = document.createElement('a');
 *     downloadLink.href = pngUrl;
 *     downloadLink.download = 'logo.png';
 *     downloadLink.click();
 *   } catch (error) {
 *     console.error("Export failed:", error);
 *   }
 * }
 */