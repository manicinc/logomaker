/**
 * randomize.js
 * ============================================================
 * Enhanced Randomize Style Function (v2.1 - Fixes & Refinements)
 * - Dynamically fetches options for ALL stylable elements.
 * - Uses heavily weighted randomization for more coherent results.
 * - Includes coherence rules to prevent overly busy combinations.
 * - Generates theme-aware colors using HSL.
 * - Makes border width/padding proportional to font size.
 * - Preserves core text content, font selection/properties, export settings, etc.
 * - Fixes global export typo and adds more logging.
 * - Verifies SettingsManager dependencies.
 * - Ensures correct color application based on modes.
 */

// --- Imports ---
// Ideally, import SettingsManager instead of relying on global window.SettingsManager
import SettingsManager from './settingsManager.js';
// Assuming showAlert/showToast are globally available or imported elsewhere
// import { showAlert, showToast } from './notificationsDropInAlerts.js';

console.log('[Randomizer v2.1] Loading...');

/**
 * Main function to randomize styles, preserving key text/layout settings.
 */
export function randomizeStyle() {
    console.log('[Randomizer v2.1] Randomizing style...');
    try {
        // --- Ensure SettingsManager is Ready ---
        // Check window object for compatibility, but ideally use import
        const SM = SettingsManager; // Use alias for brevity
        if (
            !SM || // Check if SettingsManager exists on window
            // !SM._isInitialized || // Internal flag might not be reliable on window object
            typeof SM.getCurrentSettings !== 'function' ||
            typeof SM.getDefaults !== 'function' ||
            typeof SM.applySettings !== 'function' ||
            typeof SM.pickRandomColorMode !== 'function' // Check required method
        ) {
            console.error("[Randomizer] SettingsManager not available, not initialized, or missing required methods on window object!");
            // Use global notification functions if available, otherwise alert
            const notifyError = typeof showAlert === 'function' ? showAlert : alert;
            notifyError("Randomizer Error: SettingsManager not ready.", "error");
            return;
        }

   
        const defaults = SM.getDefaults();
        const current = SM.getCurrentSettings();
    
        // ---> Log Current Settings THOROUGHLY <---
        console.log("[Randomizer] Current settings RECEIVED:", JSON.stringify(current, null, 2));
    
        // ---> Explicitly check the required keys BEFORE preservation <---
        const checkKeys = ['logoText', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textCase'];
        let missingKey = false;
        checkKeys.forEach(key => {
             if (!current || !current.hasOwnProperty(key) || current[key] === undefined || current[key] === null || current[key] === '') {
                  console.error(`[Randomizer] PROBLEM: Current settings received from SettingsManager is missing or has invalid value for key: "${key}". Value:`, current ? current[key] : 'N/A');
                  missingKey = true;
             }
        });
        if (missingKey) {
             // Maybe try using defaults instead? Or throw specific error?
             throw new Error("SettingsManager.getCurrentSettings() returned incomplete data for required preserved keys.");
        }
        // ---> End check <---
    
        // --- Settings to Preserve ---
        // These settings will NOT be changed by the randomizer
        const preservedSettings = {
            // Core Text Identity
            logoText: current.logoText,
            fontFamily: current.fontFamily,
            fontSize: current.fontSize,
            fontWeight: current.fontWeight,
            letterSpacing: current.letterSpacing,
            textCase: current.textCase,

            // Layout & Export
            previewSize: current.previewSize,
            previewAreaPadding: current.previewAreaPadding, // Also preserve this
            exportWidth: current.exportWidth,
            exportHeight: current.exportHeight,
            exportQuality: current.exportQuality,
            exportTransparent: current.exportTransparent,
            exportFrames: current.exportFrames,
            exportFrameRate: current.exportFrameRate,
            aspectRatioPreset: current.aspectRatioPreset,
            aspectRatioLock: current.aspectRatioLock
        };

        // ---> Log Check for Preserved Text <---
        console.log("[Randomizer] Preserved Text:", preservedSettings.logoText);
        if (preservedSettings.logoText === undefined || preservedSettings.logoText === null || preservedSettings.logoText === '') {
            console.warn("[Randomizer] Preserved logoText is empty/undefined. Using default.");
            // Fallback to default if current text is somehow empty
            preservedSettings.logoText = defaults.logoText;
        }

        // -------------------------------------------------------------
        //  HELPER FUNCTIONS
        // -------------------------------------------------------------

        /** Gets option values from a select dropdown */
        const getOptions = (id) => {
            const select = document.getElementById(id);
            if (!select) {
                console.warn(`[Randomizer] Dropdown #${id} not found.`);
                return [];
            }
            // Filter out empty values, disabled options, and placeholder if present
            return Array.from(select.options)
                .filter(o => o.value && !o.disabled && o.value !== '')
                .map(o => o.value);
        };

        /** Selects a random item based on weights */
        const getWeightedRandom = (items, weights) => {
            if (!items || !Array.isArray(items) || items.length === 0) return null;

            const validItems = [];
            const validWeights = [];
            let totalWeight = 0;

            items.forEach((item, i) => {
                // Ensure item is not null/undefined before processing
                if (item !== null && item !== undefined) {
                    const w = (weights && weights[i] !== undefined && weights[i] > 0) ? weights[i] : 1; // Default weight 1 if not specified or <= 0
                    validItems.push(item);
                    validWeights.push(w);
                    totalWeight += w;
                } else {
                     console.warn("[Randomizer] Skipping null/undefined item in getWeightedRandom.");
                }
            });

            if (validItems.length === 0) {
                 console.warn("[Randomizer] No valid items left after filtering in getWeightedRandom.");
                 return null;
            }
            // If totalWeight is 0 (e.g., all weights were <= 0), perform uniform random pick
            if (totalWeight <= 0) {
                console.warn("[Randomizer] Zero total weight, performing uniform random pick.");
                return validItems[Math.floor(Math.random() * validItems.length)];
            }

            let r = Math.random() * totalWeight;
            for (let i = 0; i < validItems.length; i++) {
                r -= validWeights[i];
                if (r <= 0) {
                    return validItems[i];
                }
            }
            // Fallback in case of floating point issues
            return validItems[validItems.length - 1];
        };

        /** Generates a random hex color within HSL constraints */
        const randomHex = (options = {}) => {
            const {
                minSaturation = 0.4, maxSaturation = 1.0,
                minLightness = 0.4, maxLightness = 0.8,
                hueStart = 0, hueEnd = 360,
                avoidGrayish = true
            } = options;

            let h = Math.random() * (hueEnd - hueStart) + hueStart;
            let s = Math.random() * (maxSaturation - minSaturation) + minSaturation;
            let l = Math.random() * (maxLightness - minLightness) + minLightness;

            // Reduce saturation for mid-range lightness to avoid muted/grayish tones if desired
            if (avoidGrayish && Math.abs(l - 0.5) < 0.15 && s > 0.5) {
                s *= 0.6; // Reduce saturation significantly
            }

            // Clamp saturation and lightness
            s = Math.max(0, Math.min(1, s));
            l = Math.max(0, Math.min(1, l));

            // HSL to RGB conversion (standard algorithm)
            const hslToRgb = (hh, ss, ll) => {
                let r, g, b;
                if (ss === 0) {
                    r = g = b = ll; // achromatic
                } else {
                    const hue2rgb = (p, q, t) => {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1 / 6) return p + (q - p) * 6 * t;
                        if (t < 1 / 2) return q;
                        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                        return p;
                    };
                    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
                    const p = 2 * ll - q;
                    const hNorm = hh / 360;
                    r = hue2rgb(p, q, hNorm + 1 / 3);
                    g = hue2rgb(p, q, hNorm);
                    b = hue2rgb(p, q, hNorm - 1 / 3);
                }
                return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
            };

            const [rr, gg, bb] = hslToRgb(h, s, l);
            const toHex = val => Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0'); // Clamp before converting
            return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
        };

        /** Generates random number in range */
        const randomRange = (min, max) => Math.random() * (max - min) + min;

        /** Splits a combined selection into basic/advanced keys */
        function findKey(value, standardOpts, advancedOpts, standardKey, advancedKey, noneValStd, noneValAdv) {
            // Check if value exists in advanced options first
            if (advancedOpts && advancedOpts.includes(value)) {
                return { [standardKey]: noneValStd, [advancedKey]: value };
            }
            // Then check standard options
            if (standardOpts && standardOpts.includes(value)) {
                return { [standardKey]: value, [advancedKey]: noneValAdv };
            }
            // If not found in either, return both as none
            return { [standardKey]: noneValStd, [advancedKey]: noneValAdv };
        }

        // -------------------------------------------------------------
        //  DEFINE OPTIONS & WEIGHTS (Dynamically Fetched)
        // -------------------------------------------------------------

        // Fetch options dynamically from the HTML select elements
        const textAlignOptions = getOptions('textAlign');
        const textDecorationOptions = getOptions('textDecoration');
        const textStyleOptions = getOptions('textStyle');
        const textStrokeOptions = getOptions('textStroke');
        const standardEffectOptions = getOptions('textShadow'); // Assumes textShadow dropdown has basic effects
        const advanced3dEffectOptions = getOptions('advanced3dEffect');
        const borderStyleOptions = getOptions('borderStyle');
        const advancedBorderStyleOptions = getOptions('advancedBorderStyle');
        const borderRadiusOptions = getOptions('borderRadius');
        const animationOptions = getOptions('textAnimation');
        const advancedAnimationOptions = getOptions('advancedTextAnimation');
        const backgroundTypeOptions = getOptions('backgroundType');
        const advancedBackgroundOptions = getOptions('advancedBackground');
        const textGradientPresetOptions = getOptions('gradientPreset').filter(v => v !== 'custom');
        const bgGradientPresetOptions = getOptions('backgroundGradientPreset').filter(v => v !== 'custom');

        // Combine options for weighted random selection where basic/advanced overlap
        const combinedEffectOptions = ['none', ...standardEffectOptions.filter(v => v !== 'text-effect-none'), ...advanced3dEffectOptions.filter(v => v !== 'none')];
        const combinedBorderStyleOptions = ['none', ...borderStyleOptions.filter(v => v !== 'border-none'), ...advancedBorderStyleOptions.filter(v => v !== 'none')];
        const combinedAnimationOptions = ['none', ...animationOptions.filter(v => v !== 'anim-none'), ...advancedAnimationOptions.filter(v => v !== 'none')];
        const combinedBackgroundOptions = ['bg-transparent', ...backgroundTypeOptions.filter(v => v !== 'bg-transparent'), ...advancedBackgroundOptions.filter(v => v !== 'none')];

        // Define weights (adjust these numbers to influence probability)
        const textAlignWeights = textAlignOptions.map(o => (o === 'center' ? 10 : (o === 'left' || o === 'right' ? 3 : 1)));
        const textDecorationWeights = textDecorationOptions.map(o => (o === 'none' ? 90 : 3));
        const textStyleWeights = textStyleOptions.map(o => (o === 'normal' ? 90 : 5));
        const textStrokeWeights = textStrokeOptions.map(o => (o === 'none' ? 80 : (o === 'thin' ? 12 : (o === 'contrast' || o === 'medium' ? 3 : 1))));
        const combinedEffectWeights = combinedEffectOptions.map(effect => (effect === 'none' ? 60 : (effect.includes('soft') ? 12 : (effect.includes('thin') || effect.includes('emboss') ? 10 : (effect.includes('medium') || effect.includes('hard') || effect.includes('inset') ? 6 : (effect.includes('neon') || effect.includes('retro') || effect.includes('thick') ? 3 : 1))))));
        const combinedBorderStyleWeights = combinedBorderStyleOptions.map(style => (style === 'none' ? 45 : (style === 'border-solid' ? 25 : (style.includes('dashed') || style.includes('dotted') ? 12 : (style.includes('double') || style.includes('groove') || style.includes('ridge') || style.includes('pixel') ? 6 : (style.includes('glow') || style.includes('neon') || style.includes('gradient') ? 4 : 1))))));
        const borderRadiusWeights = borderRadiusOptions.map(r => (r === 'none' ? 40 : (r.includes('sm') ? 25 : (r.includes('md') ? 18 : (r.includes('lg') ? 10 : (r === 'pill' ? 4 : (r === 'circle' ? 3 : 1)))))));
        const combinedAnimationWeights = combinedAnimationOptions.map(anim => (anim === 'none' ? 60 : (['anim-pulse', 'anim-fade', 'anim-float', 'anim-wobble', 'anim-magnify'].includes(anim) ? 12 : (['anim-wave', 'anim-flicker', 'anim-bounce', 'anim-liquify', 'anim-perspective', 'anim-split'].includes(anim) ? 5 : 2))));
        const combinedBackgroundWeights = combinedBackgroundOptions.map(type => (type === 'bg-transparent' ? 12 : (type === 'bg-solid' ? 35 : (type.includes('gradient') ? 22 : (type.includes('grid') || type.includes('dots') || type === 'graph-paper' ? 6 : (type.includes('lines') || type === 'bg-checkerboard' ? 4 : 2))))));


        // -------------------------------------------------------------
        //  PICK BASE OPTIONS (Weighted)
        // -------------------------------------------------------------
        let selectedTextAlign = getWeightedRandom(textAlignOptions, textAlignWeights);
        let selectedTextDecoration = getWeightedRandom(textDecorationOptions, textDecorationWeights);
        let selectedTextStyle = getWeightedRandom(textStyleOptions, textStyleWeights);
        let selectedTextStroke = getWeightedRandom(textStrokeOptions, textStrokeWeights);
        let selectedCombinedEffect = getWeightedRandom(combinedEffectOptions, combinedEffectWeights);
        let selectedCombinedBorderStyle = getWeightedRandom(combinedBorderStyleOptions, combinedBorderStyleWeights);
        let selectedBorderRadius = (selectedCombinedBorderStyle !== 'none')
                                   ? getWeightedRandom(borderRadiusOptions, borderRadiusWeights)
                                   : 'none';
        let selectedCombinedAnimation = getWeightedRandom(combinedAnimationOptions, combinedAnimationWeights);
        let selectedCombinedBackground = getWeightedRandom(combinedBackgroundOptions, combinedBackgroundWeights);

        // -------------------------------------------------------------
        //  COHERENCE RULES
        // -------------------------------------------------------------
        const busyAnimThreshold = 0.6; // % chance to disable if busy
        const busyBgThreshold = 0.5;
        const complexEffectThreshold = 0.5;
        const complexBorderThreshold = 0.4;
        const strokeVsEffectThreshold = 0.85; // % chance to keep stroke over effect

        let isBusyAnimation = ['anim-glitch', 'anim-shake', 'anim-rotate', 'anim-split', 'anim-perspective', 'anim-flip-3d', 'anim-swing-3d', 'anim-glow-multicolor'].includes(selectedCombinedAnimation);
        let isBusyBackground = ['bg-synthwave', 'bg-matrix', 'bg-stars', 'bg-gradient-animated', 'bg-floating-particles', 'bg-gradient-pulse', 'bg-circuit'].includes(selectedCombinedBackground);
        let isComplexEffect = (selectedCombinedEffect !== 'none' && !selectedCombinedEffect.includes('soft') && !selectedCombinedEffect.includes('outline-thin'));
        let isComplexBorder = (selectedCombinedBorderStyle !== 'none' && !['border-solid', 'border-dashed', 'border-dotted'].includes(selectedCombinedBorderStyle));

        let complexityScore = (isBusyAnimation ? 1.5 : 0) + (isBusyBackground ? 1.2 : 0) + (isComplexEffect ? 1 : 0) + (isComplexBorder ? 0.8 : 0);
        console.log(`[Randomizer Coherence] Initial Score: ${complexityScore.toFixed(1)}, Anim: ${selectedCombinedAnimation}, BG: ${selectedCombinedBackground}, Effect: ${selectedCombinedEffect}, Border: ${selectedCombinedBorderStyle}`);

        // Simplify if too complex
        if (complexityScore >= 2.5) {
            console.log("[Randomizer Coherence] High complexity -> Simplifying aggressively.");
            if (Math.random() < busyAnimThreshold * 1.5) selectedCombinedAnimation = 'none'; // Higher chance to remove anim
            if (Math.random() < complexEffectThreshold * 1.4) selectedCombinedEffect = 'none'; // Higher chance to remove effect
            if (Math.random() < complexBorderThreshold * 1.5) selectedCombinedBorderStyle = (Math.random() < 0.5 ? 'none' : 'border-solid');
            if (Math.random() < 0.9) selectedTextStroke = 'none';
            if (Math.random() < 0.9) selectedTextDecoration = 'none';
        } else if (complexityScore >= 1.5) {
            console.log("[Randomizer Coherence] Moderate complexity -> Simplifying moderately.");
            if (isBusyAnimation && Math.random() < busyAnimThreshold) selectedCombinedEffect = 'none';
            if (isBusyBackground && Math.random() < busyBgThreshold) selectedCombinedAnimation = 'none';
            if (isComplexEffect && Math.random() < complexEffectThreshold) selectedCombinedAnimation = 'none';
            if (isComplexBorder && Math.random() < complexBorderThreshold) selectedCombinedEffect = 'none';
            if (Math.random() < 0.5) selectedTextStroke = 'none';
            if (Math.random() < 0.6) selectedTextDecoration = 'none';
        }

        // Resolve conflict between text stroke and non-outline text effects
        if (selectedTextStroke !== 'none' && selectedCombinedEffect !== 'none' && !selectedCombinedEffect.includes('outline')) {
            if (Math.random() < strokeVsEffectThreshold) {
                console.log("[Randomizer Coherence] Stroke chosen, removing potentially conflicting text effect.");
                selectedCombinedEffect = 'none';
            } else {
                 console.log("[Randomizer Coherence] Text effect chosen, removing potentially conflicting stroke.");
                 selectedTextStroke = 'none';
            }
        }
        // Re-check radius if border became none
        if (selectedCombinedBorderStyle === 'none') {
            selectedBorderRadius = 'none';
        }
        console.log(`[Randomizer Coherence] Final Picks -> Anim: ${selectedCombinedAnimation}, BG: ${selectedCombinedBackground}, Effect: ${selectedCombinedEffect}, Border: ${selectedCombinedBorderStyle}, Stroke: ${selectedTextStroke}, Deco: ${selectedTextDecoration}, Radius: ${selectedBorderRadius}`);


        // -------------------------------------------------------------
        //  SPLIT COMBINED PICKS into separate standard vs advanced fields
        // -------------------------------------------------------------
        // (findKey helper function defined above)
        const effectKeys = findKey(selectedCombinedEffect, standardEffectOptions, advanced3dEffectOptions, 'textShadow', 'advanced3dEffect', 'text-effect-none', 'none');
        const borderKeys = findKey(selectedCombinedBorderStyle, borderStyleOptions, advancedBorderStyleOptions, 'borderStyle', 'advancedBorderStyle', 'border-none', 'none');
        const animationKeys = findKey(selectedCombinedAnimation, animationOptions, advancedAnimationOptions, 'textAnimation', 'advancedTextAnimation', 'anim-none', 'none');
        const backgroundKeys = findKey(selectedCombinedBackground, backgroundTypeOptions, advancedBackgroundOptions, 'backgroundType', 'advancedBackground', (selectedCombinedBackground === 'bg-transparent' ? 'bg-transparent' : 'bg-solid'), 'none');


        // -------------------------------------------------------------
        //  PICK COLOR MODE
        // -------------------------------------------------------------
        const selectedColorMode = SM.pickRandomColorMode(); // Use the method from SettingsManager
        const useColor3 = (selectedColorMode === 'gradient') && (Math.random() > 0.55);


        // -------------------------------------------------------------
        //  GENERATE THEME COLORS
        // -------------------------------------------------------------
         const baseHue = Math.random() * 360;
         const analogousOffset = 30; // Degrees for analogous colors
         const complementaryOffset = 180; // Degrees for complementary

         const isLikelyDarkBG = !['bg-transparent'].includes(backgroundKeys.backgroundType) && !['transparent'].includes(backgroundKeys.advancedBackground) && (
              backgroundKeys.backgroundType === 'bg-solid' && parseInt(randomHex({ minLightness: 0.05, maxLightness: 0.4 }).substring(1, 3), 16) < 128
              || backgroundKeys.backgroundType.includes('gradient')
              || ['bg-darkgrid', 'bg-carbon', 'bg-stars', 'bg-synthwave', 'bg-matrix', 'bg-circuit'].includes(backgroundKeys.backgroundType)
              || ['hexagons', 'diamonds', 'wave-pattern'].includes(backgroundKeys.advancedBackground)
         );
         console.log(`[Randomizer Colors] Base Hue: ${baseHue.toFixed(0)}, Is background likely dark? ${isLikelyDarkBG}`);

         const textThemeOptions = isLikelyDarkBG ? { minLightness: 0.6, maxLightness: 0.95, minSaturation: 0.6, hueStart: (baseHue - analogousOffset + 360) % 360, hueEnd: (baseHue + analogousOffset) % 360 } : { minLightness: 0.1, maxLightness: 0.5, minSaturation: 0.7, hueStart: (baseHue - analogousOffset + 360) % 360, hueEnd: (baseHue + analogousOffset) % 360 };
         const borderThemeOptions = isLikelyDarkBG ? { minLightness: 0.5, maxLightness: 0.85, minSaturation: 0.5, hueStart: (baseHue - analogousOffset * 1.5 + 360) % 360, hueEnd: (baseHue + analogousOffset * 1.5) % 360 } : { minLightness: 0.15, maxLightness: 0.6, minSaturation: 0.6, hueStart: (baseHue - analogousOffset * 1.5 + 360) % 360, hueEnd: (baseHue + analogousOffset * 1.5) % 360 };
         const bgThemeOptions = isLikelyDarkBG ? { minLightness: 0.05, maxLightness: 0.35, maxSaturation: 0.6, hueStart: (baseHue + complementaryOffset - analogousOffset*2 + 360) % 360, hueEnd: (baseHue + complementaryOffset + analogousOffset*2) % 360 } : { minLightness: 0.88, maxLightness: 0.99, maxSaturation: 0.5, hueStart: (baseHue + complementaryOffset - analogousOffset*2 + 360) % 360, hueEnd: (baseHue + complementaryOffset + analogousOffset*2) % 360 };

         const color1 = randomHex(textThemeOptions);
         const color2 = randomHex(textThemeOptions);
         const color3 = randomHex(textThemeOptions);

         const selectedBorderColor = (borderKeys.borderStyle === 'border-none' && borderKeys.advancedBorderStyle === 'none') ? defaults.borderColorPicker : randomHex(borderThemeOptions);
         const selectedBackgroundColor = (backgroundKeys.backgroundType === 'bg-transparent') ? 'transparent' : randomHex(bgThemeOptions);
         const selectedBgColor1 = (backgroundKeys.backgroundType === 'bg-transparent') ? 'transparent' : randomHex(bgThemeOptions);
         const selectedBgColor2 = (backgroundKeys.backgroundType === 'bg-transparent') ? 'transparent' : randomHex(bgThemeOptions);

         // Decide on presets vs custom
         const selectedGradientPreset = (selectedColorMode === 'gradient' && Math.random() < 0.4 && textGradientPresetOptions.length > 0)
             ? getWeightedRandom(textGradientPresetOptions, null) : 'custom';
         const selectedBgGradientPreset = (backgroundKeys.backgroundType.includes('gradient') && Math.random() < 0.4 && bgGradientPresetOptions.length > 0)
             ? getWeightedRandom(bgGradientPresetOptions, null) : 'custom';


        // -------------------------------------------------------------
        //  BORDER WIDTH/PADDING, ROTATION, etc.
        // -------------------------------------------------------------
        const currentFontSizeNum = parseInt(preservedSettings.fontSize) || 100;
        let selectedBorderWidth = 0;
        let selectedBorderPadding = parseInt(preservedSettings.borderPadding || defaults.borderPadding); // Use preserved/default
        let selectedCustomBorderRadius = '';

        if (borderKeys.borderStyle !== 'border-none' || borderKeys.advancedBorderStyle !== 'none') {
            const maxBorderWidth = Math.max(1, Math.min(25, Math.round(currentFontSizeNum * 0.08)));
            selectedBorderWidth = Math.floor(randomRange(1, maxBorderWidth));
            const minPadding = Math.max(Math.round(selectedBorderWidth * 1.5), Math.round(currentFontSizeNum * 0.10));
            const maxPadding = Math.max(minPadding + 5, Math.round(currentFontSizeNum * 0.40));
            selectedBorderPadding = Math.floor(randomRange(minPadding, maxPadding));

            if (selectedBorderRadius === 'custom') {
                 if (Math.random() < 0.3) {
                      const r1 = Math.floor(randomRange(1, Math.min(currentFontSizeNum * 0.4, 60)));
                      const r2 = Math.floor(randomRange(1, Math.min(currentFontSizeNum * 0.4, 60)));
                      const r3 = Math.floor(randomRange(1, Math.min(currentFontSizeNum * 0.4, 60)));
                      const r4 = Math.floor(randomRange(1, Math.min(currentFontSizeNum * 0.4, 60)));
                      selectedCustomBorderRadius = `${r1}px ${r2}px ${r3}px ${r4}px`;
                 } else {
                     selectedCustomBorderRadius = String(Math.floor(randomRange(1, Math.min(currentFontSizeNum * 0.4, 60))));
                 }
                 console.log(`[Randomizer] Generated custom radius: '${selectedCustomBorderRadius}'`);
            } else {
                 selectedCustomBorderRadius = '';
            }
        } else {
            selectedBorderRadius = 'none';
            selectedBorderWidth = 0;
            // Reset padding to default ONLY if border is explicitly set to none
            selectedBorderPadding = parseInt(defaults.borderPadding);
        }

        const maxRotation = (isBusyAnimation || isComplexEffect) ? 3 : 9;
        let selectedRotation = 0;
        if (Math.random() > 0.45) {
            selectedRotation = Math.round(randomRange(-maxRotation, maxRotation));
        }

        let selectedAnimationSpeed = 1.0;
        const speedRoll = Math.random();
        if (speedRoll < 0.2) selectedAnimationSpeed = randomRange(0.4, 0.8);
        else if (speedRoll < 0.85) selectedAnimationSpeed = randomRange(0.8, 1.8);
        else selectedAnimationSpeed = randomRange(1.8, 3.5);
        selectedAnimationSpeed = selectedAnimationSpeed.toFixed(1);

        const selectedAnimationDirection = Math.floor(randomRange(0, 360));
        const selectedBgGradientDirection = Math.floor(randomRange(0, 360));
        const selectedBgOpacity = (backgroundKeys.backgroundType === 'bg-transparent' || backgroundKeys.advancedBackground === 'transparent')
            ? '1.0'
            : randomRange(0.65, 1.0).toFixed(2);

        // --- BUILD FINAL RANDOMIZED SETTINGS ---
        // Intentionally do NOT include the preserved keys here
        const randomizedSettings = {
            // Text Color
            textColorMode: selectedColorMode,
            solidColorPicker: (selectedColorMode === 'solid') ? color1 : defaults.solidColorPicker,
            gradientPreset: selectedGradientPreset,
            color1: (selectedGradientPreset === 'custom' || selectedColorMode === 'solid') ? color1 : defaults.color1,
            color2: (selectedGradientPreset === 'custom') ? color2 : defaults.color2,
            useColor3,
            color3: (selectedGradientPreset === 'custom' && useColor3) ? color3 : defaults.color3,
            animationDirection: String(selectedAnimationDirection),

            // Text Visuals (excluding preserved: size, weight, spacing, case, family)
            textAlign: selectedTextAlign,
            textDecoration: selectedTextDecoration,
            textStyle: selectedTextStyle,
            textStroke: selectedTextStroke,
            rotation: String(selectedRotation),

            // Effects
            textShadow: effectKeys.textShadow,
            advanced3dEffect: effectKeys.advanced3dEffect,

            // Border
            borderColorPicker: selectedBorderColor,
            borderStyle: borderKeys.borderStyle,
            advancedBorderStyle: borderKeys.advancedBorderStyle,
            borderWidth: String(selectedBorderWidth),
            borderRadius: selectedBorderRadius,
            customBorderRadius: selectedCustomBorderRadius,
            borderPadding: String(selectedBorderPadding), // Use calculated padding

            // Animation
            textAnimation: animationKeys.textAnimation,
            advancedTextAnimation: animationKeys.advancedTextAnimation,
            animationSpeed: selectedAnimationSpeed,

            // Background
            backgroundType: backgroundKeys.backgroundType,
            advancedBackground: backgroundKeys.advancedBackground,
            backgroundColor: selectedBackgroundColor,
            bgOpacity: selectedBgOpacity,
            backgroundGradientPreset: selectedBgGradientPreset,
            bgColor1: (selectedBgGradientPreset === 'custom') ? selectedBgColor1 : defaults.bgColor1,
            bgColor2: (selectedBgGradientPreset === 'custom') ? selectedBgColor2 : defaults.bgColor2,
            bgGradientDirection: String(selectedBgGradientDirection)
        };

        // Merge defaults, random, and preserved settings
        // Merge defaults first, then random, THEN overwrite with preserved
        const finalSettings = {
            ...defaults, // Base
            ...randomizedSettings, // Apply random values over defaults
            ...preservedSettings // Apply preserved values LAST, overwriting random/default
        };

         // ---> Log Check for Final Settings (Focus on preserved) <---
         console.log("[Randomizer] Final Settings to Apply (Check Preserved):",
             `Text: ${finalSettings.logoText}`,
             `Font: ${finalSettings.fontFamily}`,
             `Size: ${finalSettings.fontSize}`,
             `Weight: ${finalSettings.fontWeight}`,
             `Spacing: ${finalSettings.letterSpacing}`,
             `Case: ${finalSettings.textCase}`
         );

        if (finalSettings.logoText === undefined || finalSettings.logoText === null) {
              console.error("[Randomizer] CRITICAL ERROR: finalSettings.logoText is undefined/null before apply!");
              throw new Error("Randomizer failed to preserve logo text.");
        }
         if (!finalSettings.fontFamily || !finalSettings.fontSize || !finalSettings.fontWeight || !finalSettings.letterSpacing || !finalSettings.textCase) {
              console.error("[Randomizer] CRITICAL ERROR: One or more preserved font settings are missing before apply!", finalSettings);
              throw new Error("Randomizer failed to preserve font settings.");
         }

        console.log('[Randomizer v2.1] Calling SettingsManager.applySettings...');
        // Call applySettings from the correct context
        SM.applySettings(finalSettings, true); // Apply and update UI inputs

        const notifySuccess = (typeof showToast === 'function') ? showToast : (cfg) => alert(cfg.message);
        notifySuccess({ message: 'Style Randomized! ✨', type: 'success', duration: 2500 });

    } catch (err) {
        console.error("[Randomizer v2.1] FATAL ERROR:", err);
        const notifyError = (typeof showAlert === 'function') ? showAlert : alert;
        notifyError(`Failed to randomize style: ${err.message}`, "error");
    }
} // End randomizeStyle function


// --- Keyboard Shortcut Setup ---

/**
 * Handles keydown events for global shortcuts like Randomize (R).
 * Prevents randomization if Ctrl or Cmd key is pressed (allows browser refresh).
 * @param {KeyboardEvent} event The keyboard event.
 */
function handleGlobalKeyPress(event) {
    // Check if 'R' key is pressed (case-insensitive)
    if (event.key === 'r' || event.key === 'R') {

        // --- Check for Ctrl or Cmd Key ---
        if (event.ctrlKey || event.metaKey) {
            console.log("[Shortcut] Ctrl/Cmd + R detected. Allowing default browser action.");
            return; // Exit the function, don't prevent default or randomize
        }

        // Check if the event originates from an input field, textarea, select, or contenteditable element
        const target = event.target;
        const isInputFocused = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable // Handles contenteditable divs/spans etc.
        );

        // If R is pressed WITHOUT Ctrl/Cmd and not focused on an input, trigger randomization
        if (!isInputFocused) {
            console.log("[Shortcut] 'R' key pressed outside input field (without Ctrl/Cmd). Triggering Randomize.");
            // Prevent default action ONLY when we are handling the key ourselves
            event.preventDefault();
            randomizeStyle();
        } else {
            console.log("[Shortcut] 'R' key pressed IN input field. Ignoring randomization trigger.");
            // No preventDefault() here, allow 'r' to be typed into the input
        }
    }
    // Add other shortcuts here if needed
}

/**
 * Initializes the global key press listener.
 * Should be called once when the application sets up.
 */
export function initializeRandomizeShortcut() {
    console.log("[Shortcut] Initializing 'R' key listener for randomization.");
    // Remove existing listener first to prevent duplicates if called multiple times
    document.removeEventListener('keydown', handleGlobalKeyPress);
    // Add the listener
    document.addEventListener('keydown', handleGlobalKeyPress);
}

// --- Example Usage (in your main app initialization - MAKE SURE THIS IS CALLED) ---
// import { initializeRandomizeShortcut } from './randomize.js'; // Adjust path
// document.addEventListener('DOMContentLoaded', () => {
//     initializeRandomizeShortcut();
// });

// --- Global Export (Corrected) ---
// Make available globally if needed (e.g., for inline HTML onclick, though import is preferred)
window.randomizeStyle = randomizeStyle;
window.initializeRandomizeShortcut = initializeRandomizeShortcut;

console.log('[Randomizer v2.1] Ready.');