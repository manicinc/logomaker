/**
 * svgAnimationInfo.js
 * =====================================================
 * Utility to extract computed animation details from the logo element.
 */

console.log("[SVGAnimInfo v2] Module loaded.");

/**
 * Extracts computed animation details from the primary logo text element.
 *
 * @returns {object | null} An object containing animation details { class, name, duration, timingFunction, iterationCount, durationMs } or null if no animation class is found.
 */
export function extractSVGAnimationDetails() {
    console.log("[SVGAnimInfo] Extracting animation details...");
    const logoText = document.querySelector('.logo-text');
    if (!logoText) {
        console.warn("[SVGAnimInfo] Cannot find .logo-text element.");
        return null;
    }

    try {
        const computedStyle = window.getComputedStyle(logoText);
        const animationName = computedStyle.animationName;
        const animationDuration = computedStyle.animationDuration;
        const animationTimingFunction = computedStyle.animationTimingFunction;
        const animationIterationCount = computedStyle.animationIterationCount;

        // Find animation class
        const animClass = Array.from(logoText.classList).find(cls => cls.startsWith('anim-') && cls !== 'anim-none');
        if (!animClass && animationName === 'none') {
            console.log("[SVGAnimInfo] No active animation found.");
            return null;
        }

        // Determine animation name
        let effectiveAnimName;
        if (animClass) {
            effectiveAnimName = animClass.replace('anim-', '');
        } else if (animationName && animationName !== 'none') {
            effectiveAnimName = animationName;
        } else {
            return null;
        }

        // FIXED: Ensure non-zero duration
        let durationMs = 0;
        let durationStr = '2s'; // Default

        if (animationDuration && animationDuration !== 'none' && animationDuration !== '0s') {
            durationStr = animationDuration;
            try {
                if (animationDuration.endsWith('ms')) {
                    durationMs = parseFloat(animationDuration);
                } else if (animationDuration.endsWith('s')) {
                    durationMs = parseFloat(animationDuration) * 1000;
                }
            } catch (e) { 
                console.warn(`[SVGAnimInfo] Could not parse animation duration: ${animationDuration}`); 
            }
        } else {
            // Default for missing or zero duration
            durationStr = '2s';
            durationMs = 2000;
            console.log("[SVGAnimInfo] Using default 2s duration due to missing or zero duration");
        }

        // Ensure non-zero iteration count
        let iterCount = animationIterationCount || 'infinite';
        if (iterCount === '0') {
            iterCount = 'infinite';
        }

        const details = {
            class: animClass || `anim-${effectiveAnimName}`,
            name: effectiveAnimName,
            duration: durationStr,
            timingFunction: animationTimingFunction || 'ease',
            iterationCount: iterCount,
            durationMs: durationMs
        };

        console.log("[SVGAnimInfo] Animation details extracted:", details);
        return details;

    } catch (error) {
        console.error("[SVGAnimInfo] Error extracting animation details:", error);
        return null;
    }
}

/**
 * DEPRECATED/REMOVED: generateSVGAnimationElement
 * Reason: The primary method for animation export is embedding CSS (@keyframes + class)
 * within the SVG's <style> tag, which is handled by RendererCore.js::generateEmbeddedCSS
 * based on the details extracted above. Generating specific <animate> tags from
 * complex CSS keyframes is generally not feasible or accurate.
 */
// export function generateSVGAnimationElement(animationMetadata) {
//    console.warn("[SVGAnimInfo] generateSVGAnimationElement is deprecated and likely unused.");
//    return ''; // Return empty string or null
// }