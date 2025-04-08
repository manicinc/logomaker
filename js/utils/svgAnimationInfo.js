/**
 * svgAnimationInfo.js (v3.1)
 * =====================================================
 * Improved utility to extract computed animation details from .logo-text
 * for SVG export. Also includes fallback keyframes and optional glitch logic.
 *
 * Exports:
 * - extractSVGAnimationDetails()
 * - getAnimationKeyframes()
 * - getCompleteAnimationCSS()  // Currently not used by default, but available
 * - generateAnimationClassCSS()
 *
 * Usage:
 *   - Called by RendererCore or other modules to determine the active animation
 *     so we can embed matching <style> or filter defs in the final SVG.
 */

console.log("[SVGAnimInfo v3.1] Module loading...");

/**
 * Extracts CSS-based animation details from .logo-text to embed in SVG.
 * @returns {object|null} An object with { class, name, duration, timingFunction, iterationCount, ... }
 *                        or null if no animation is detected.
 */
export function extractSVGAnimationDetails() {
    console.log("[SVGAnimInfo] extractSVGAnimationDetails() invoked...");
    const logoText = document.querySelector('.logo-text');
    if (!logoText) {
        console.warn("[SVGAnimInfo] .logo-text not found; no animation data.");
        return null;
    }

    try {
        const computedStyle = window.getComputedStyle(logoText);
        const animationName = computedStyle.animationName;
        const animationDuration = computedStyle.animationDuration;
        const animationTimingFunction = computedStyle.animationTimingFunction;
        const animationIterationCount = computedStyle.animationIterationCount;
        const animationDelay = computedStyle.animationDelay;
        const animationDirection = computedStyle.animationDirection;
        const animationFillMode = computedStyle.animationFillMode;

        // See if there's an anim-* class
        const animClass = Array.from(logoText.classList).find(cls => cls.startsWith('anim-') && cls !== 'anim-none');

        // If no class AND no computed animation name
        if (!animClass && (!animationName || animationName === 'none')) {
            console.log("[SVGAnimInfo] No animation found on .logo-text.");
            return null;
        }

        // Determine the effective animation name
        let effectiveAnimName = 'none';
        if (animClass) {
            effectiveAnimName = animClass.replace('anim-', '');
        } else if (animationName && animationName !== 'none') {
            effectiveAnimName = animationName;
        }
        if (effectiveAnimName === 'none') {
            return null;
        }

        // Parse animation duration
        let durationStr = '2s';   // fallback
        let durationMs = 2000;    // fallback in ms
        if (animationDuration && animationDuration !== '0s' && animationDuration !== 'none') {
            durationStr = animationDuration;
            // Attempt to parse
            if (animationDuration.endsWith('ms')) {
                durationMs = parseFloat(animationDuration);
            } else if (animationDuration.endsWith('s')) {
                durationMs = parseFloat(animationDuration) * 1000;
            }
        } else {
            // Check if we have a global --animation-duration var
            const rootStyle = getComputedStyle(document.documentElement);
            const varDur = rootStyle.getPropertyValue('--animation-duration')?.trim();
            if (varDur) {
                durationStr = varDur;
                if (varDur.endsWith('ms')) durationMs = parseFloat(varDur);
                else if (varDur.endsWith('s')) durationMs = parseFloat(varDur) * 1000;
            }
        }

        // Iteration count
        let iterCount = animationIterationCount || 'infinite';
        if (iterCount === '0') iterCount = 'infinite';

        const details = {
            class: animClass || `anim-${effectiveAnimName}`,  // e.g., 'anim-bounce'
            name: effectiveAnimName,                          // e.g., 'bounce'
            duration: durationStr,                            // e.g., '2s'
            durationMs: durationMs,                           // e.g., 2000
            timingFunction: animationTimingFunction || 'ease',
            iterationCount: iterCount,
            delay: animationDelay || '0s',
            direction: animationDirection || 'normal',
            fillMode: animationFillMode || 'none',
            // progress: optional if we generate frames
        };

        console.log("[SVGAnimInfo] Extracted:", details);
        return details;

    } catch (e) {
        console.error("[SVGAnimInfo] Error extracting details:", e);
        return null;
    }
}

/**
 * Retrieves the @keyframes CSS text for a given animation by scanning styleSheets.
 * Falls back to a built-in dictionary if not found.
 *
 * @param {string} animationName - E.g. 'pulse', 'bounce'
 * @returns {string|null} The raw CSS text of the keyframes or null if not found.
 */
export function getAnimationKeyframes(animationName) {
    if (!animationName || animationName === 'none') return null;
    console.log(`[SVGAnimInfo] Searching keyframes for animation: ${animationName}`);

    // 1. Attempt to locate in styleSheets
    try {
        for (const sheet of document.styleSheets) {
            if (sheet.disabled) continue;
            let rules;
            try { rules = sheet.cssRules || sheet.rules; } catch(e) { continue; } // cross-origin or restricted
            if (!rules) continue;

            for (const rule of rules) {
                // Keyframes rule => type===CSSRule.KEYFRAMES_RULE (7) in modern browsers
                if ((CSSRule.KEYFRAMES_RULE && rule.type === CSSRule.KEYFRAMES_RULE) || rule.type === 7) {
                    if (rule.name === animationName) {
                        console.log(`[SVGAnimInfo] Found @keyframes for '${animationName}' in a stylesheet.`);
                        return rule.cssText;
                    }
                }
            }
        }
    } catch(e) {
        // Possibly cross-origin or parse error
        console.warn(`[SVGAnimInfo] Error scanning styleSheets for '${animationName}':`, e);
    }

    // 2. Fallback dictionary
    const fallbackKeyframes = {
        pulse: `@keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.9;} }`,
        bounce: `@keyframes bounce { 0%,100% { transform:translateY(0); } 50% { transform: translateY(-15px); } }`,
        shake: `@keyframes shake { 0%,100% {transform:translateX(0);} 10%,30%,50%,70%,90%{transform:translateX(-4px) rotate(-0.5deg);} 20%,40%,60%,80%{transform:translateX(4px) rotate(0.5deg);} }`,
        float: `@keyframes float { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-15px) rotate(1deg)} }`,
        rotate: `@keyframes rotate { 0%{transform:rotate(0deg);}100%{transform:rotate(360deg);} }`,
        wave: `@keyframes wave { 0%,100%{transform:skewX(0) skewY(0);}25%{transform:skewX(5deg) skewY(1deg);}75%{transform:skewX(-5deg) skewY(-1deg);} }`,
        glitch: `@keyframes glitch { 0%,100%{clip-path:inset(50% 0 30% 0);transform:translate(-4px,1px) scaleY(1.02);} 20%{clip-path:inset(10% 0 80% 0);transform:translate(3px,-2px) scaleY(0.98);} 40%{clip-path:inset(70% 0 5% 0);transform:translate(-3px,2px) scaleY(1.01);} 60%{clip-path:inset(45% 0 45% 0);transform:translate(4px,-1px) scaleY(0.99);}80%{clip-path:inset(85% 0 10% 0);transform:translate(-2px,1px) scaleY(1.03);} }`,
        fade: `@keyframes fadeInOut { 0%,100%{opacity:0.3;}50%{opacity:1;} }`,
        flicker: `@keyframes flicker {0%,18%,22%,25%,53%,57%,100%{opacity:1;text-shadow:inherit;}20%,24%,55%{opacity:0.6;text-shadow:none;} }`
    };

    if (fallbackKeyframes[animationName]) {
        console.log(`[SVGAnimInfo] Using fallback for '${animationName}'.`);
        return fallbackKeyframes[animationName];
    }

    console.warn(`[SVGAnimInfo] Keyframes for '${animationName}' not found even in fallback.`);
    return null;
}

/**
 * Generates the CSS for a single animation class from a metadata object.
 * E.g., .anim-pulse { animation-name: pulse; ... }
 *
 * @param {object} animMeta - The object from extractSVGAnimationDetails().
 * @returns {string|null} Full CSS for the class or null if missing data.
 */
export function generateAnimationClassCSS(animMeta) {
    if (!animMeta || !animMeta.class || !animMeta.name) return null;
    console.log(`[SVGAnimInfo] generateAnimationClassCSS() for: ${animMeta.class}`);

    let css = `.${animMeta.class} {\n`;
    css += `  animation-name: ${animMeta.name};\n`;
    css += `  animation-duration: ${animMeta.duration};\n`;
    css += `  animation-timing-function: ${animMeta.timingFunction};\n`;
    css += `  animation-iteration-count: ${animMeta.iterationCount};\n`;
    if (animMeta.delay && animMeta.delay !== '0s') {
        css += `  animation-delay: ${animMeta.delay};\n`;
    }
    if (animMeta.direction && animMeta.direction !== 'normal') {
        css += `  animation-direction: ${animMeta.direction};\n`;
    }
    if (animMeta.fillMode && animMeta.fillMode !== 'none') {
        css += `  animation-fill-mode: ${animMeta.fillMode};\n`;
    }
    css += `}\n`;
    return css;
}

/**
 * Creates a combined animation CSS (keyframes + class).
 * Typically used if we embed the animation in an inline <style> for the SVG.
 *
 * @param {object} animMeta - The object from extractSVGAnimationDetails().
 * @returns {string|null} The combined CSS or null if missing data
 */
export function getCompleteAnimationCSS(animMeta) {
    if (!animMeta || !animMeta.name || animMeta.name === 'none') return null;
    const keyframes = getAnimationKeyframes(animMeta.name);
    if (!keyframes) {
        console.warn(`[SVGAnimInfo] No keyframes for '${animMeta.name}'.`);
        return null;
    }
    const classCSS = generateAnimationClassCSS(animMeta);
    if (!classCSS) return null;

    return `/* Embedded animation for ${animMeta.name} */\n${keyframes}\n\n/* Animation class */\n${classCSS}`;
}

console.log("[SVGAnimInfo v3.1] All functions exported.");
