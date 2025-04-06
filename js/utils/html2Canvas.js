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
    if (!elementToCapture) {
        throw new Error("No element provided for capture");
    }

    // Merge default options with provided options
    const defaultOptions = {
        scale: window.devicePixelRatio || 1,
        allowTaint: true,
        useCORS: true,
        logging: false,
        backgroundColor: null, // For transparent backgrounds
        ignoreElements: (element) => {
            // Ignore size indicator and any other elements we don't want
            return element.classList && (
                element.classList.contains('size-indicator') ||
                element.classList.contains('loading-spinner')
            );
        },
        // Capture inlined styles instead of loading external CSS
        imageTimeout: 0, // Prevent timeouts on image loading
        // Disable the iFrame approach that's causing connection errors
        onclone: (documentClone) => {
            // Copy all styles directly to cloned element
            const sourceStyles = window.getComputedStyle(elementToCapture);
            const targetElement = documentClone.querySelector('#' + elementToCapture.id) || 
                                 documentClone.querySelector('.' + Array.from(elementToCapture.classList).join('.'));
            
            if (targetElement) {
                // Apply relevant computed styles directly
                const styles = [
                    'background', 'backgroundColor', 'backgroundImage', 'backgroundSize', 
                    'backgroundPosition', 'backgroundRepeat', 'color', 'fontFamily',
                    'fontSize', 'fontWeight', 'letterSpacing', 'textAlign', 'textTransform',
                    'borderRadius', 'border', 'boxShadow', 'opacity', 'padding'
                ];
                
                styles.forEach(prop => {
                    targetElement.style[prop] = sourceStyles[prop];
                });
                
                // Copy styles of child elements (logo-container and logo-text)
                const sourceLogoContainer = elementToCapture.querySelector('.logo-container');
                const targetLogoContainer = targetElement.querySelector('.logo-container');
                
                if (sourceLogoContainer && targetLogoContainer) {
                    const logoContainerStyles = window.getComputedStyle(sourceLogoContainer);
                    styles.forEach(prop => {
                        targetLogoContainer.style[prop] = logoContainerStyles[prop];
                    });
                    
                    // Also copy animation
                    if (logoContainerStyles.animation) {
                        targetLogoContainer.style.animation = logoContainerStyles.animation;
                    }
                }
                
                const sourceLogoText = elementToCapture.querySelector('.logo-text');
                const targetLogoText = targetElement.querySelector('.logo-text');
                
                if (sourceLogoText && targetLogoText) {
                    const logoTextStyles = window.getComputedStyle(sourceLogoText);
                    styles.concat([
                        'transform', 'animation', 'textShadow', 'WebkitBackgroundClip',
                        'backgroundClip', 'WebkitTextFillColor'
                    ]).forEach(prop => {
                        targetLogoText.style[prop] = logoTextStyles[prop];
                    });
                    
                    // Ensure text content is copied
                    targetLogoText.textContent = sourceLogoText.textContent;
                    
                    // Copy CSS animation classes
                    if (sourceLogoText.className) {
                        targetLogoText.className = sourceLogoText.className;
                    }
                    
                    // For text effects that use ::before/::after, we may need to inject CSS
                    const styleElement = documentClone.createElement('style');
                    styleElement.textContent = `
                        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.9; } }
                        .anim-pulse { animation: pulse 1.33s ease-in-out infinite; }
                        .text-align-left { text-align: left; }
                        .text-align-center { text-align: center; }
                        .text-align-right { text-align: right; }
                    `;
                    documentClone.head.appendChild(styleElement);
                }
            }
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    console.log('[Capture v2.6] Final html2canvas options:', mergedOptions);
    console.log('[Capture v2.6] Beginning HTML2Canvas rendering...');
    
    try {
        // Try to render with html2canvas
        // html2canvas should be globally available
        if (typeof html2canvas !== 'function') {
            throw new Error("html2canvas library not found! Make sure it's included in your project.");
        }
        
        // Make a copy of styles and apply them directly to avoid external CSS problems
        const canvas = await html2canvas(elementToCapture, mergedOptions);
        console.log('[Capture v2.6] HTML2Canvas rendering successful.');
        return canvas;
    } catch (error) {
        console.error('[Capture v2.6] HTML2Canvas rendering failed:', error);
        throw error;
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