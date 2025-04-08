/**
 * randomize.js
 * ============================================================
 * Enhanced Randomize Style Function (v2.0 - Supercharged)
 * - Dynamically fetches options for ALL stylable elements.
 * - Uses heavily weighted randomization for more coherent and less chaotic results.
 * - Introduces coherence rules (e.g., less effect with busy animations/backgrounds).
 * - Generates colors using HSL for better control and thematic consistency.
 * - Makes border width/padding proportional to font size.
 * - Preserves core text content, font selection, size, weight, spacing, case,
 *   export settings, preview size, and aspect ratio settings.
 */

export function randomizeStyle() {
    console.log('[Randomizer v2.0] SUPERCHARGED style randomization commencing...');
    try {
        // Ensure SettingsManager is available and initialized
        if (
            typeof SettingsManager === 'undefined' ||
            !SettingsManager._isInitialized ||
            !SettingsManager.getCurrentSettings ||
            !SettingsManager.getDefaults ||
            !SettingsManager.applySettings
        ) {
            console.error("[Randomizer] SettingsManager not available or not initialized!");
            const notifyError = typeof showAlert === 'function' ? showAlert : alert;
            notifyError("Randomizer Error: SettingsManager not ready.", "error");
            return;
        }

        const defaults = SettingsManager.getDefaults();
        const current = SettingsManager.getCurrentSettings();

        // --- Settings to Preserve ---
        const preservedSettings = {
            // Core Text Identity
            logoText: current.logoText,
            fontFamily: current.fontFamily,
            fontSize: current.fontSize,
            fontWeight: current.fontWeight,
            letterSpacing: current.letterSpacing, // Keep letter spacing
            textCase: current.textCase,           // Keep text case

            // Layout & Export
            previewSize: current.previewSize,
            exportWidth: current.exportWidth,
            exportHeight: current.exportHeight,
            exportQuality: current.exportQuality,
            exportTransparent: current.exportTransparent,
            exportFrames: current.exportFrames,
            exportFrameRate: current.exportFrameRate,
            aspectRatioPreset: current.aspectRatioPreset,
            aspectRatioLock: current.aspectRatioLock
        };

        // -------------------------------------------------------------
        //  HELPER FUNCTIONS
        // -------------------------------------------------------------

        const getOptions = (id) => {
            const select = document.getElementById(id);
            if (!select) {
                console.warn(`[Randomizer] Dropdown #${id} not found.`);
                return [];
            }
            return Array.from(select.options)
                        .filter(o => o.value && !o.disabled && o.value !== '')
                        .map(o => o.value);
        };

        const getWeightedRandom = (items, weights) => {
            if (!items || !items.length) return null;
            const validItems = [];
            const validWeights = [];
            let totalWeight = 0;

            items.forEach((item, i) => {
                const w = (weights && weights[i] !== undefined) ? weights[i] : 1;
                if (w > 0) {
                    validItems.push(item);
                    validWeights.push(w);
                    totalWeight += w;
                }
            });

            if (validItems.length === 0) return null;
            if (totalWeight <= 0) {
                // fallback: uniform pick
                return validItems[Math.floor(Math.random() * validItems.length)];
            }

            let r = Math.random() * totalWeight;
            for (let i = 0; i < validItems.length; i++) {
                r -= validWeights[i];
                if (r <= 0) {
                    return validItems[i];
                }
            }
            return validItems[validItems.length - 1];
        };

        const randomHex = (options = {}) => {
            const {
                minSaturation = 0.4, maxSaturation = 1.0,
                minLightness = 0.4, maxLightness = 0.8,
                hueStart = 0, hueEnd = 360,
                avoidGrayish = true
            } = options;

            let h = hueStart + Math.random() * (hueEnd - hueStart);
            let s = minSaturation + Math.random() * (maxSaturation - minSaturation);
            let l = minLightness + Math.random() * (maxLightness - minLightness);

            if (avoidGrayish && Math.abs(l - 0.5) < 0.15 && s > 0.4) {
                s *= 0.5;
            }

            const hslToRgb = (hh, ss, ll) => {
                let r, g, b;
                if (ss === 0) {
                    r = g = b = ll; // achromatic
                } else {
                    const hue2rgb = (p, q, t) => {
                        if (t < 0) t += 1; if (t > 1) t -= 1;
                        if (t < 1/6) return p + (q - p) * 6 * t;
                        if (t < 1/2) return q;
                        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                        return p;
                    };
                    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
                    const p = 2 * ll - q;
                    hh /= 360;
                    r = hue2rgb(p, q, hh + 1/3);
                    g = hue2rgb(p, q, hh);
                    b = hue2rgb(p, q, hh - 1/3);
                }
                return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
            };

            const [rr, gg, bb] = hslToRgb(h, s, l);
            const toHex = val => val.toString(16).padStart(2, '0');
            return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
        };

        const randomRange = (min, max) => Math.random() * (max - min) + min;

        // -------------------------------------------------------------
        //  DEFINE OPTIONS & WEIGHTS (Dynamically Fetched)
        // -------------------------------------------------------------

        // (identical code as before for textAlign, textDecoration, etc...)
        const textAlignOptions = ['center', 'left', 'right'];
        const textAlignWeights = [10, 3, 3];

        const textDecorationOptions = ['none', ...getOptions('textDecoration').filter(v => v !== 'none')];
        const textDecorationWeights = textDecorationOptions.map(o => (o === 'none' ? 90 : 3));

        const textStyleOptions = ['normal', ...getOptions('textStyle').filter(v => v !== 'normal')];
        const textStyleWeights = textStyleOptions.map(o => (o === 'normal' ? 90 : 5));

        const textStrokeOptions = ['none', ...getOptions('textStroke').filter(v => v !== 'none')];
        const textStrokeWeights = textStrokeOptions.map(o => {
            if (o === 'none') return 80;
            if (o === 'thin') return 12;
            if (o === 'contrast' || o === 'medium') return 3;
            return 1; // thick is rare
        });

        const standardEffectOptions = getOptions('textShadow').filter(v => v !== 'text-effect-none');
        const advanced3dEffectOptions = getOptions('advanced3dEffect').filter(v => v !== 'none');
        const combinedEffectOptions = ['none', ...standardEffectOptions, ...advanced3dEffectOptions];
        const combinedEffectWeights = combinedEffectOptions.map(effect => {
            if (effect === 'none') return 60;
            if (effect.includes('soft')) return 12;
            if (effect.includes('thin') || effect.includes('emboss')) return 10;
            if (effect.includes('medium') || effect.includes('hard') || effect.includes('inset')) return 6;
            if (effect.includes('neon') || effect.includes('retro') || effect.includes('thick')) return 3;
            if (effect === '3d-simple' || effect === 'reflection') return 5;
            if (effect === '3d-bevel' || effect === 'cutout') return 3;
            if (effect === '3d-extrude' || effect === 'isometric') return 1;
            return 1;
        });

        const borderStyleOptions = getOptions('borderStyle').filter(v => v !== 'border-none');
        const advancedBorderStyleOptions = getOptions('advancedBorderStyle').filter(v => v !== 'none');
        const combinedBorderStyleOptions = ['none', ...borderStyleOptions, ...advancedBorderStyleOptions];
        const combinedBorderStyleWeights = combinedBorderStyleOptions.map(style => {
            if (style === 'none') return 45;
            if (style === 'border-solid') return 25;
            if (style.includes('dashed') || style.includes('dotted')) return 12;
            if (style.includes('double') || style.includes('groove') || style.includes('ridge') || style.includes('pixel')) return 6;
            if (style.includes('glow') || style.includes('neon') || style.includes('gradient')) return 4;
            if (style === 'multi-layer' || style === 'corners-cut' || style.includes('image-')) return 3;
            if (style.includes('marching-ants') || style.includes('rotating-dash') || style.includes('double-glow')) return 1;
            return 1;
        });

        const borderRadiusOptions = getOptions('borderRadius');
        const borderRadiusWeights = borderRadiusOptions.map(r => {
            if (r === 'none') return 40;
            if (r === 'rounded-sm') return 25;
            if (r === 'rounded-md') return 18;
            if (r === 'rounded-lg') return 10;
            if (r === 'pill') return 4;
            if (r === 'circle') return 3;
            return 1;
        });

        const animationOptions = getOptions('textAnimation').filter(v => v !== 'anim-none');
        const advancedAnimationOptions = getOptions('advancedTextAnimation').filter(v => v !== 'none');
        const combinedAnimationOptions = ['none', ...animationOptions, ...advancedAnimationOptions];
        const combinedAnimationWeights = combinedAnimationOptions.map(anim => {
            if (anim === 'none') return 60;
            if (['anim-pulse','anim-fade','anim-float','anim-wobble','anim-magnify'].includes(anim)) return 12;
            if (['anim-wave','anim-flicker','anim-bounce','anim-liquify','anim-perspective','anim-split'].includes(anim)) return 5;
            if (['anim-shake','anim-rotate','anim-flip-3d','anim-swing-3d'].includes(anim)) return 2;
            if (['anim-glitch','anim-glow-multicolor'].includes(anim)) return 1;
            return 1;
        });

        const backgroundTypeOptions = getOptions('backgroundType').filter(v => v !== 'bg-transparent');
        const advancedBackgroundOptions = getOptions('advancedBackground').filter(v => v !== 'none');
        const combinedBackgroundOptions = ['transparent', ...backgroundTypeOptions, ...advancedBackgroundOptions];
        const combinedBackgroundWeights = combinedBackgroundOptions.map(type => {
            if (type === 'transparent') return 12;
            if (type === 'bg-solid') return 35;
            if (type.includes('gradient')) return 22;
            if (['bg-grid','bg-dots-sm','bg-darkgrid','graph-paper','bg-lines-vert'].includes(type)) return 6;
            if (['bg-lines-diag','bg-checkerboard','bg-hexagons','bg-diamonds'].includes(type)) return 4;
            if (['bg-carbon','bg-wave-pattern','bg-noise','bg-scanlines','bg-circuit','bg-stars','floating-particles'].includes(type)) return 2;
            if (['bg-synthwave','bg-matrix','bg-nebula'].includes(type)) return 1;
            return 1;
        });

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

        // Check complexity
        let isBusyAnimation = ['anim-glitch','anim-shake','anim-rotate','anim-split','anim-perspective','anim-flip-3d','anim-swing-3d','anim-glow-multicolor'].includes(selectedCombinedAnimation);
        let isBusyBackground = ['bg-synthwave','bg-matrix','bg-stars','bg-nebula','bg-gradient-animated','bg-floating-particles','bg-gradient-pulse','bg-circuit','bg-carbon'].includes(selectedCombinedBackground);
        let isComplexEffect = (selectedCombinedEffect !== 'none' && !selectedCombinedEffect.includes('soft') && !selectedCombinedEffect.includes('outline-thin'));
        let isComplexBorder = (selectedCombinedBorderStyle !== 'none' && !['border-solid','border-dashed','border-dotted'].includes(selectedCombinedBorderStyle));

        let complexityScore = (isBusyAnimation ? 1.5 : 0)
                            + (isBusyBackground ? 1.2 : 0)
                            + (isComplexEffect ? 1 : 0)
                            + (isComplexBorder ? 0.8 : 0);

        console.log(`[Randomizer Coherence] Initial Complexity Score: ${complexityScore.toFixed(1)}`);

        // Coherence rules
        if (complexityScore >= 2.5) {
            console.log("[Randomizer Coherence] High complexity detected. Simplifying aggressively.");
            if (Math.random() < 0.8) selectedCombinedAnimation = 'none';
            if (Math.random() < 0.7) selectedCombinedEffect = 'none';
            if (Math.random() < 0.6) selectedCombinedBorderStyle = (Math.random() < 0.5 ? 'none' : 'border-solid');
            if (Math.random() < 0.9) selectedTextStroke = 'none';
            if (Math.random() < 0.9) selectedTextDecoration = 'none';
        } else if (complexityScore >= 1.5) {
            console.log("[Randomizer Coherence] Moderate complexity detected. Simplifying moderately.");
            if (isBusyAnimation && Math.random() < 0.6) selectedCombinedEffect = 'none';
            if (isBusyBackground && Math.random() < 0.5) selectedCombinedAnimation = 'none';
            if (isComplexEffect && Math.random() < 0.5) selectedCombinedAnimation = 'none';
            if (isComplexBorder && Math.random() < 0.4) selectedCombinedEffect = 'none';
            if (Math.random() < 0.5) selectedTextStroke = 'none';
            if (Math.random() < 0.6) selectedTextDecoration = 'none';
        }

        // Stroke vs text effect conflict
        if (selectedTextStroke !== 'none' && selectedCombinedEffect !== 'none' && !selectedCombinedEffect.includes('outline')) {
            if (Math.random() < 0.85) {
                console.log("[Randomizer Coherence] Stroke chosen, removing potentially conflicting text effect.");
                selectedCombinedEffect = 'none';
            }
        }

        // -------------------------------------------------------------
        //  SPLIT Combined picks into separate standard vs advanced fields
        // -------------------------------------------------------------
        function findKey(value, standardOpts, advancedOpts, standardKey, advancedKey, noneValStd, noneValAdv) {
            if (standardOpts.includes(value)) {
                return { [standardKey]: value, [advancedKey]: noneValAdv };
            }
            if (advancedOpts.includes(value)) {
                return { [standardKey]: noneValStd, [advancedKey]: value };
            }
            return { [standardKey]: noneValStd, [advancedKey]: noneValAdv };
        }

        const effectKeys = findKey(
            selectedCombinedEffect,
            standardEffectOptions,
            advanced3dEffectOptions,
            'textShadow',
            'advanced3dEffect',
            'text-effect-none',
            'none'
        );

        const borderKeys = findKey(
            selectedCombinedBorderStyle,
            borderStyleOptions,
            advancedBorderStyleOptions,
            'borderStyle',
            'advancedBorderStyle',
            'border-none',
            'none'
        );

        const animationKeys = findKey(
            selectedCombinedAnimation,
            animationOptions,
            advancedAnimationOptions,
            'textAnimation',
            'advancedTextAnimation',
            'anim-none',
            'none'
        );

        const backgroundKeys = findKey(
            selectedCombinedBackground,
            backgroundTypeOptions,
            advancedBackgroundOptions,
            'backgroundType',
            'advancedBackground',
            (selectedCombinedBackground === 'transparent' ? 'bg-transparent' : 'bg-solid'),
            'none'
        );

        // -------------------------------------------------------------
        //  PICK COLOR MODE FROM SettingsManager
        // -------------------------------------------------------------
        // The new line that calls a method in SettingsManager:
        // (Remember to define pickRandomColorMode() inside settingsManager.js)
        const selectedColorMode = SettingsManager.pickRandomColorMode();
        // For example:
        //  pickRandomColorMode() {
        //    const opts = ['solid','gradient'];
        //    const wts = [4,6];
        //    // Weighted random code...
        //    return ...
        //  }

        const useColor3 = (selectedColorMode === 'gradient') && (Math.random() > 0.55);
        const selectedColorModeFinal = selectedColorMode; // rename if you prefer


        // -------------------------------------------------------------
        //  GENERATE THEME COLORS
        // -------------------------------------------------------------
        const isDarkBg = !['bg-transparent','bg-graph-paper'].includes(selectedCombinedBackground)
                         && (backgroundKeys.backgroundType === 'bg-solid'
                             ? parseInt(randomHex({ minLightness: 0.05, maxLightness: 0.4 }).substring(1, 3), 16) < 128
                             : true);

        const textThemeOptions = isDarkBg
            ? { minLightness: 0.6, maxLightness: 0.95, minSaturation: 0.55 }
            : { minLightness: 0.1, maxLightness: 0.5, minSaturation: 0.6 };

        const borderThemeOptions = isDarkBg
            ? { minLightness: 0.5, maxLightness: 0.85, minSaturation: 0.45 }
            : { minLightness: 0.15, maxLightness: 0.6, minSaturation: 0.5 };

        const bgThemeOptions = isDarkBg
            ? { minLightness: 0.05, maxLightness: 0.35, maxSaturation: 0.75 }
            : { minLightness: 0.88, maxLightness: 0.99, maxSaturation: 0.6 };

        const color1 = randomHex(textThemeOptions);
        const color2 = randomHex(textThemeOptions);
        const color3 = randomHex(textThemeOptions);

        const selectedBorderColor = randomHex(borderThemeOptions);
        const selectedBackgroundColor = randomHex(bgThemeOptions);
        const selectedBgColor1 = randomHex(bgThemeOptions);
        const selectedBgColor2 = randomHex(bgThemeOptions);

        // Decide if we'll pick a preset or go custom for text gradient
        const textGradientPresetOptions = getOptions('gradientPreset').filter(v => v !== 'custom');
        const selectedGradientPreset = (
            selectedColorModeFinal === 'gradient'
            && Math.random() < 0.4
            && textGradientPresetOptions.length > 0
        )
            ? getWeightedRandom(textGradientPresetOptions, null)
            : 'custom';

        // same for background gradient
        const bgGradientPresetOptions = getOptions('backgroundGradientPreset').filter(v => v !== 'custom');
        const selectedBgGradientPreset = (
            backgroundKeys.backgroundType.includes('gradient')
            && Math.random() < 0.4
            && bgGradientPresetOptions.length > 0
        )
            ? getWeightedRandom(bgGradientPresetOptions, null)
            : 'custom';

        // -------------------------------------------------------------
        //  BORDER WIDTH/PADDING, ROTATION, etc.
        // -------------------------------------------------------------
        const currentFontSizeNum = parseInt(preservedSettings.fontSize) || 100;
        let selectedBorderWidth = 0;
        let selectedBorderPadding = 0;
        let selectedCustomBorderRadius = '';

        if (borderKeys.borderStyle !== 'border-none' || borderKeys.advancedBorderStyle !== 'none') {
            const maxBorderWidth = Math.max(1, Math.round(currentFontSizeNum * 0.07));
            selectedBorderWidth = Math.floor(randomRange(1, maxBorderWidth));

            const minPadding = Math.max(selectedBorderWidth + 2, Math.round(currentFontSizeNum * 0.05));
            const maxPadding = Math.max(minPadding + 5, Math.round(currentFontSizeNum * 0.30));
            selectedBorderPadding = Math.floor(randomRange(minPadding, maxPadding));

            if (selectedBorderRadius === 'custom') {
                selectedCustomBorderRadius = String(
                    Math.floor(randomRange(1, Math.min(currentFontSizeNum * 0.4, 60)))
                );
                console.log(`[Randomizer] Generated custom radius: ${selectedCustomBorderRadius}px`);
            }
        } else {
            selectedBorderRadius = 'none';
            selectedCustomBorderRadius = '';
        }

        const maxRotation = (isBusyAnimation || isComplexEffect) ? 3 : 7;
        let selectedRotation = 0;
        if (Math.random() > 0.45) { // 55% chance of some rotation
            selectedRotation = Math.round(randomRange(-maxRotation, maxRotation));
        }

        let selectedAnimationSpeed = 1.0;
        const speedRoll = Math.random();
        if (speedRoll < 0.2) selectedAnimationSpeed = randomRange(0.4, 0.8);
        else if (speedRoll < 0.8) selectedAnimationSpeed = randomRange(0.8, 1.8);
        else selectedAnimationSpeed = randomRange(1.8, 3.5);
        selectedAnimationSpeed = selectedAnimationSpeed.toFixed(1);

        const selectedAnimationDirection = Math.floor(randomRange(0, 360));
        const selectedBgGradientDirection = Math.floor(randomRange(0, 360));
        const selectedBgOpacity = (backgroundKeys.backgroundType === 'bg-transparent')
            ? '1.0'
            : randomRange(0.65, 1.0).toFixed(2);

        // -------------------------------------------------------------
        //  BUILD FINAL RANDOMIZED SETTINGS
        // -------------------------------------------------------------
        const randomizedSettings = {
            // Text Color
            textColorMode: selectedColorModeFinal,
            solidColorPicker: (selectedColorModeFinal === 'solid') ? color1 : defaults.solidColorPicker,
            gradientPreset: selectedGradientPreset,
            color1,
            color2,
            useColor3,
            color3,
            animationDirection: selectedAnimationDirection, // text gradient angle

            // Text Visuals
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
            borderPadding: String(selectedBorderPadding),

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
            bgColor1: selectedBgColor1,
            bgColor2: selectedBgColor2,
            bgGradientDirection: String(selectedBgGradientDirection)
        };

        // Merge with defaults, then re-apply preserved
        const finalSettings = {
            ...defaults,
            ...randomizedSettings,
            ...preservedSettings
        };

        console.log('[Randomizer v2.0] Applying randomized settings:', randomizedSettings);
        SettingsManager.applySettings(finalSettings, true);

        const notifySuccess = (typeof showToast === 'function') ? showToast : (cfg) => alert(cfg.message);
        notifySuccess({ message: 'Style Super-Randomized! ✨ (Press R)', type: 'success', duration: 2500 });

    } catch (err) {
        console.error("[Randomizer v2.0] FATAL ERROR:", err);
        const notifyError = (typeof showAlert === 'function') ? showAlert : alert;
        notifyError(`Failed to randomize style: ${err.message}`, "error");
    }
}

// --- Keyboard Shortcut Setup ---

/**
 * Handles keydown events for global shortcuts like Randomize (R).
 * Prevents randomization if Ctrl or Cmd key is pressed (allows browser refresh).
 * @param {KeyboardEvent} event The keyboard event.
 */
function handleGlobalKeyPress(event) {
    // Check if 'R' key is pressed (case-insensitive)
    if (event.key === 'r' || event.key === 'R') {

        // --- FIX: Check for Ctrl or Cmd Key ---
        // If Ctrl (for Windows/Linux) or Meta (Cmd for Mac) is pressed,
        // let the browser handle it (e.g., for Refresh). Do nothing here.
        if (event.ctrlKey || event.metaKey) {
            console.log("[Shortcut] Ctrl/Cmd + R detected. Allowing default browser action.");
            return; // Exit the function, don't prevent default or randomize
        }
        // --- END FIX ---

        // Check if the event originates from an input field, textarea, select, or contenteditable element
        // (This check now only runs if Ctrl/Cmd are NOT pressed)
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
            // (e.g., prevent typing 'r' if focus isn't on an input)
            event.preventDefault();
            randomizeStyle();
        } else {
            console.log("[Shortcut] 'R' key pressed IN input field. Ignoring randomization trigger.");
            // No preventDefault() here, allow 'r' to be typed into the input
        }
    }
    // You could add checks for other shortcuts here using else if
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

// --- Example Usage (in your main app initialization) ---
// import { initializeRandomizeShortcut } from './randomizer'; // Adjust path
//
document.addEventListener('DOMContentLoaded', () => {
  // ... other initializations ...
  initializeRandomizeShortcut();
  // ...
});

window.fucntion = randomizeStyle; // Export function for external use