/**
 * Generates the animation CSS class definition for use in SVG
 * 
 * @param {object} animMeta - Animation metadata object from extractSVGAnimationDetails()
 * @returns {string|null} The complete CSS class definition or null if invalid input
 */
export function generateAnimationClassCSS(animMeta) {
    if (!animMeta || !animMeta.class || !animMeta.name) return null;
    
    console.log(`[SVGAnimInfo] Generating CSS class for animation: ${animMeta.class}`);
    
    // Create animation class
    let css = `.${animMeta.class} {\n`;
    css += `  animation-name: ${animMeta.name};\n`;
    css += `  animation-duration: ${animMeta.duration};\n`;
    css += `  animation-timing-function: ${animMeta.timingFunction};\n`;
    css += `  animation-iteration-count: ${animMeta.iterationCount};\n`;
    
    // Add optional properties if they differ from defaults
    if (animMeta.delay && animMeta.delay !== '0s') {
        css += `  animation-delay: ${animMeta.delay};\n`;
    }
    
    if (animMeta.direction && animMeta.direction !== 'normal') {
        css += `  animation-direction: ${animMeta.direction};\n`;
    }
    
    if (animMeta.fillMode && animMeta.fillMode !== 'none') {
        css += `  animation-fill-mode: ${animMeta.fillMode};\n`;
    }
    
    // For glitch animation, add gradient handling
    if (animMeta.name === 'glitch') {
        css += `  /* Ensure gradient fill works with animation */\n`;
        css += `  -webkit-background-clip: text; background-clip: text;\n`;
        css += `  color: transparent; -webkit-text-fill-color: transparent;\n`;
    }
    
    css += `}\n`;
    
    // For glitch, also add pseudo-element classes
    if (animMeta.name === 'glitch') {
        // Special handling for glitch animation
        css += `\n/* Glitch animation needs pseudo-elements */\n`;
        css += `.${animMeta.class}::before,\n`;
        css += `.${animMeta.class}::after {\n`;
        css += `  content: attr(data-text);\n`;
        css += `  position: absolute;\n`;
        css += `  top: 0;\n`;
        css += `  left: 0;\n`;
        css += `  width: 100%;\n`;
        css += `  height: 100%;\n`;
        css += `  background: inherit;\n`;
        css += `  -webkit-background-clip: text;\n`;
        css += `  background-clip: text;\n`;
        css += `  color: transparent;\n`;
        css += `  -webkit-text-fill-color: transparent;\n`;
        css += `}\n\n`;
        
        css += `.${animMeta.class}::before {\n`;
        css += `  animation: glitch-1 ${animMeta.duration} infinite linear alternate-reverse;\n`;
        css += `}\n\n`;
        
        css += `.${animMeta.class}::after {\n`;
        css += `  animation: glitch-2 ${animMeta.duration} infinite linear alternate-reverse;\n`;
        css += `}\n`;
    }
    
    return css;
}

/**
 * Gets complete animation CSS for embedding in SVG
 * Combines keyframes and class definitions
 * 
 * @param {object} animMeta - Animation metadata from extractSVGAnimationDetails()
 * @returns {string|null} Complete CSS for the animation or null if no animation
 */
export function getCompleteAnimationCSS(animMeta) {
    if (!animMeta || !animMeta.name || animMeta.name === 'none') return null;
    
    // Get the keyframes definition
    const keyframes = getAnimationKeyframes(animMeta.name);
    if (!keyframes) {
        console.warn(`[SVGAnimInfo] Could not get keyframes for animation: ${animMeta.name}`);
        return null;
    }
    
    // Get the animation class CSS
    const classCSS = generateAnimationClassCSS(animMeta);
    if (!classCSS) {
        console.warn(`[SVGAnimInfo] Could not generate class CSS for animation: ${animMeta.class}`);
        return null;
    }
    
    // Combine them
    const css = `/* Animation for ${animMeta.name} */\n${keyframes}\n\n/* Animation class */\n${classCSS}`;
    return css;
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.extractSVGAnimationDetails = extractSVGAnimationDetails;
    window.getAnimationKeyframes = getAnimationKeyframes;
    window.getCompleteAnimationCSS = getCompleteAnimationCSS;
}

console.log("[SVGAnimInfo v3.0] Functions exported and made globally available.");
/**
 * svgAnimationInfo.js (v3.0)
 * =====================================================
 * Improved utility to extract computed animation details from the logo element
 * Ensures animations are properly captured for SVG export
 */

console.log("[SVGAnimInfo v3.0] Module loaded.");

/**
 * Extracts computed animation details from the primary logo text element.
 * Improved to properly handle all animation types and ensure consistent export.
 *
 * @returns {object | null} An object containing animation details or null if no animation class is found.
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
        const animationDelay = computedStyle.animationDelay;
        const animationDirection = computedStyle.animationDirection;
        const animationFillMode = computedStyle.animationFillMode;

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
            // Get from CSS variable if available
            const cssVarDuration = getComputedStyle(document.documentElement)
                .getPropertyValue('--animation-duration').trim();
                
            if (cssVarDuration) {
                durationStr = cssVarDuration;
                try {
                    if (cssVarDuration.endsWith('ms')) {
                        durationMs = parseFloat(cssVarDuration);
                    } else if (cssVarDuration.endsWith('s')) {
                        durationMs = parseFloat(cssVarDuration) * 1000;
                    }
                } catch (e) { 
                    console.warn(`[SVGAnimInfo] Could not parse CSS var duration: ${cssVarDuration}`); 
                }
            } else {
                // Default for missing or zero duration
                durationStr = '2s';
                durationMs = 2000;
            }
            console.log(`[SVGAnimInfo] Using fallback duration: ${durationStr} (${durationMs}ms)`);
        }

        // Ensure non-zero iteration count
        let iterCount = animationIterationCount || 'infinite';
        if (iterCount === '0') {
            iterCount = 'infinite';
        }
        
        // Check if we need special handling for complex animations
        const needsSpecialHandling = ['glitch', 'typing'].includes(effectiveAnimName);

        const details = {
            class: animClass || `anim-${effectiveAnimName}`,
            name: effectiveAnimName,
            duration: durationStr,
            timingFunction: animationTimingFunction || 'ease',
            iterationCount: iterCount,
            durationMs: durationMs,
            delay: animationDelay || '0s',
            direction: animationDirection || 'normal',
            fillMode: animationFillMode || 'none',
            needsSpecialHandling: needsSpecialHandling
        };

        console.log("[SVGAnimInfo] Animation details extracted:", details);
        return details;

    } catch (error) {
        console.error("[SVGAnimInfo] Error extracting animation details:", error);
        return null;
    }
}

/**
 * Gets the keyframes definition for a specific animation
 * Important for embedding in SVG exports
 * 
 * @param {string} animationName - The animation name (e.g., 'pulse', 'bounce')
 * @returns {string|null} The keyframes CSS text or null if not found
 */
export function getAnimationKeyframes(animationName) {
    if (!animationName || animationName === 'none') return null;
    
    console.log(`[SVGAnimInfo] Looking for keyframes for animation: ${animationName}`);
    
    try {
        // Try to find the keyframes in the document's stylesheets
        for (const sheet of document.styleSheets) {
            try {
                // Skip disabled or inaccessible stylesheets
                if (sheet.disabled) continue;
                
                // Some cross-origin sheets can't be accessed
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) continue;
                
                // Look through all rules
                for (const rule of rules) {
                    // Check if it's a keyframes rule (CSSKeyframesRule)
                    if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === animationName) {
                        console.log(`[SVGAnimInfo] Found keyframes rule for '${animationName}'`);
                        return rule.cssText;
                    }
                }
            } catch (e) {
                // Security error can happen when accessing cross-origin stylesheets
                continue;
            }
        }
        
        // Fallback to hardcoded keyframes for common animations
        const fallbackKeyframes = {
            'pulse': '@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.9; } }',
            'bounce': '@keyframes bounce { 0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.5, 0, 0.5, 1); } 50% { transform: translateY(-15px); animation-timing-function: cubic-bezier(0.5, 0, 0.5, 1); } }',
            'shake': '@keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-4px) rotate(-0.5deg); } 20%, 40%, 60%, 80% { transform: translateX(4px) rotate(0.5deg); } }',
            'float': '@keyframes float { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-15px) rotate(1deg); } }',
            'rotate': '@keyframes rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }',
            'wave': '@keyframes wave { 0%, 100% { transform: skewX(0) skewY(0); } 25% { transform: skewX(5deg) skewY(1deg); } 75% { transform: skewX(-5deg) skewY(-1deg); } }',
            'glitch': '@keyframes glitch { 0%, 100% { clip-path: inset(50% 0 30% 0); transform: translate(-4px, 1px) scaleY(1.02); } 20% { clip-path: inset(10% 0 80% 0); transform: translate(3px, -2px) scaleY(0.98); } 40% { clip-path: inset(70% 0 5% 0); transform: translate(-3px, 2px) scaleY(1.01); } 60% { clip-path: inset(45% 0 45% 0); transform: translate(4px, -1px) scaleY(0.99); } 80% { clip-path: inset(85% 0 10% 0); transform: translate(-2px, 1px) scaleY(1.03); } }',
            'fade': '@keyframes fadeInOut { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }',
            'flicker': '@keyframes flicker { 0%, 18%, 22%, 25%, 53%, 57%, 100% { opacity: 1; text-shadow: inherit; } 20%, 24%, 55% { opacity: 0.6; text-shadow: none; } }'
        };
        
        if (fallbackKeyframes[animationName]) {
            console.log(`[SVGAnimInfo] Using fallback keyframes for '${animationName}'`);
            return fallbackKeyframes[animationName];
        }
        
        console.warn(`[SVGAnimInfo] Could not find keyframes for animation: ${animationName}`);
        return null;
    } catch (error) {
        console.error(`[SVGAnimInfo] Error getting keyframes for animation ${animationName}:`, error);
        return null;
    }
}