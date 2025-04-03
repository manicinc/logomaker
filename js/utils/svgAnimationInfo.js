/**
 * svgAnimationInfo.js (Version 2 - Simplified Extraction)
 * =====================================================
 * Utility to extract computed animation details from the logo element.
 * Focuses on details needed for CSS embedding in SVG, not generating SMIL.
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

        // Find the specific 'anim-*' class responsible (more reliable than just computedName)
        const animClass = Array.from(logoText.classList).find(cls => cls.startsWith('anim-') && cls !== 'anim-none');

        // Use the class name if found, otherwise fallback to computed name if it's not 'none'
        const effectiveAnimName = animClass ? animClass.replace('anim-', '') : (animationName !== 'none' ? animationName : null);

        if (!effectiveAnimName || effectiveAnimName === 'none') {
            console.log("[SVGAnimInfo] No active animation found (name='none' or no 'anim-*' class).");
            return null; // No relevant animation is active
        }

        // Convert duration string (e.g., "2s") to milliseconds
        let durationMs = 2000; // Default
        if (animationDuration) {
            try {
                if (animationDuration.endsWith('ms')) {
                    durationMs = parseFloat(animationDuration);
                } else if (animationDuration.endsWith('s')) {
                    durationMs = parseFloat(animationDuration) * 1000;
                }
            } catch (e) { console.warn(`[SVGAnimInfo] Could not parse animation duration: ${animationDuration}`); }
        }

        const details = {
            class: animClass || null, // The specific class like 'anim-pulse'
            name: effectiveAnimName, // The keyframe name like 'pulse'
            duration: animationDuration || '2s', // CSS duration string
            timingFunction: animationTimingFunction || 'linear',
            iterationCount: animationIterationCount || 'infinite',
            durationMs: durationMs // Duration in milliseconds
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