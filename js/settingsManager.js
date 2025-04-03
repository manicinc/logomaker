/**
 * settingsManager.js (Version 13 - Merged & Refined)
 * ====================================================
 * Manages UI state, applies styles, handles settings persistence,
 * and dynamically injects @font-face rules for selected fonts.
 * Incorporates features and logging from v13 into v11 base.
 */
import { initializeFonts } from './fontManager.js'; // Dependency for font list

// Define default settings used for initialization and reset
const DEFAULT_SETTINGS = {
    logoText: 'Manic',
    fontFamily: 'Orbitron', // Default font - Should match an available font name
    fontSize: '100',
    letterSpacing: '0.03',
    textCase: 'none', // Default to 'none' matching the HTML option
    fontWeight: '700',
    textColorMode: 'gradient',
    solidColorPicker: '#ffffff',
    gradientPreset: 'primary-gradient', // Matches CSS variable --primary-gradient
    color1: '#FF1493',
    color2: '#8A2BE2',
    useColor3: false,
    color3: '#FF4500',
    textShadow: 'text-glow-none', // Matches CSS class prefix text-glow-
    borderColorPicker: '#ffffff', // Controls --dynamic-border-color
    borderStyle: 'border-none', // Matches CSS class prefix border-
    textAlign: 'center',
    rotation: '0',
    textAnimation: 'anim-none', // Matches CSS class prefix anim-
    animationSpeed: '1', // Multiplier for animation duration
    animationDirection: '45', // Controls text gradient direction (CSS --gradient-direction)
    backgroundType: 'bg-solid', // Controls container background (solid, gradient, pattern class)
    backgroundColor: '#000000',
    bgOpacity: '1',
    backgroundGradientPreset: 'bg-primary-gradient', // Matches CSS var --bg-primary-gradient
    bgColor1: '#3a1c71',
    bgColor2: '#ffaf7b',
    bgGradientDirection: '90', // Controls background gradient direction (CSS --bg-gradient-direction)
    previewSize: 'preview-size-medium', // Matches CSS class prefix preview-size-
    exportWidth: '800',
    exportHeight: '400',
    exportQuality: '95',
    exportTransparent: false,
    exportFrames: '15',
    exportFrameRate: '10'
};

const SettingsManager = {
    _currentSettings: { ...DEFAULT_SETTINGS },
    _listeners: [],
    _isInitialized: false,

    // --- Getter for Defaults (Deep Copy) ---
    getDefaults() {
        console.log("[SM] getDefaults() called.");
        try {
            // Use structuredClone if available (modern browsers)
            if (typeof structuredClone === 'function') {
                return structuredClone(DEFAULT_SETTINGS);
            }
            // Fallback to JSON parse/stringify (slightly less performant)
            return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        } catch (e) {
            console.error("[SM] Error deep copying default settings:", e);
            // Fallback to shallow copy if deep copy fails (less safe)
            return { ...DEFAULT_SETTINGS };
        }
    },

    // --- Getter for Current Settings (Deep Copy) ---
    getCurrentSettings() {
        // console.log("[SM] getCurrentSettings() called."); // Can be noisy
        // Return a deep copy to prevent accidental mutation from outside
        try {
            if (typeof structuredClone === 'function') {
                return structuredClone(this._currentSettings);
            }
            return JSON.parse(JSON.stringify(this._currentSettings));
        } catch (e) {
            console.error("[SM] Error deep copying current settings:", e);
            // Fallback to shallow copy if deep copy fails (less safe)
            return { ...this._currentSettings };
        }
    },

    async init() {
        if (this._isInitialized) { console.warn("[SM] Already initialized."); return; }
        console.log('[SM] Initialize (v13)...');

        // --- Setup Global Fallbacks/Checks ---
        // Ensure required global functions (likely provided by other scripts like misc.js or notifications.js) exist
        if (typeof showAlert === 'undefined') {
            console.warn('[SM] global showAlert function missing, using console fallback.');
            window.showAlert = (msg, type = 'log') => console[type](`[Fallback Alert] ${msg}`);
        }
        if (typeof notifyResetSuccess === 'undefined') {
             console.warn('[SM] global notifyResetSuccess function missing, using showAlert fallback.');
            window.notifyResetSuccess = (type) => window.showAlert(`Settings Reset (${type})!`, 'success');
        }
         // Check for updateSizeIndicator (likely from misc.js) needed by _triggerSettingsUpdate
        if (typeof window.updateSizeIndicator === 'undefined') {
            console.error('[SM] CRITICAL: global updateSizeIndicator function missing!');
            window.updateSizeIndicator = () => console.warn("[SM] updateSizeIndicator fallback: No action taken.");
        }
        // Check for getActiveAnimationKeyframes (from misc.js) needed by _generateCSSCode
        if (typeof window.getActiveAnimationKeyframes === 'undefined') {
            console.warn('[SM] global getActiveAnimationKeyframes missing. CSS export may omit @keyframes.');
            window.getActiveAnimationKeyframes = (name) => { console.warn(`[SM] getActiveAnimationKeyframes fallback for '${name}'`); return null; };
        }

        try {
            console.log('[SM] Waiting for Font Manager...');
            // 1. Initialize Fonts FIRST (Crucial Dependency)
            const fontsReady = await initializeFonts(); // Await font loading and dropdown population
            if (!fontsReady) {
                console.error('[SM] Font Manager initialization failed or reported issues. Proceeding cautiously with fallbacks.');
                // No need to showAlert here, fontManager likely did already.
            } else {
                console.log('[SM] Font Manager initialization successful.');
            }

            // 2. Load Saved Settings (or use defaults)
            this.loadSavedSettings(); // Populates _currentSettings

            // 3. Setup Event Listeners for UI controls
            this._setupEventListeners();

            // 4. Apply Initial/Loaded Settings to UI and Styles
            console.log('[SM] Applying initial/loaded settings to UI and styles...');
            // Pass true for forceUIUpdate and isInitialLoad
            await this.applySettings(this._currentSettings, true, true);

            // 5. Initialize UI Component States (based on applied settings)
            // This runs AFTER applySettings ensures controls have correct values
            this._initializeUIComponentsState();

            this._isInitialized = true; // Mark as initialized
            console.log('[SM] Initialization complete. Initial Settings:', JSON.stringify(this._currentSettings));

        } catch (error) {
            console.error("[SM] Initialization failed:", error);
            showAlert(`Settings Manager init failed: ${error.message || 'Unknown error'}`, 'error');
            // Depending on severity, might want to halt app loading here
        }
    },

    /**
     * Bind event listeners to UI controls.
     */
    _setupEventListeners() {
        console.log('[SM] Setting up event listeners...');
        // Check for a core element to ensure DOM is somewhat ready
        if (!document.getElementById('logoText')) {
            console.error("[SM] Cannot find core control #logoText. Aborting listener setup.");
            return;
        }
        // Bind all listeners using helper methods
        this._bindInputListener('logoText', 'textContent');
        this._bindSelectListener('fontFamily'); // Will call _injectFontStyle
        this._bindNumberInputListener('fontSize', 'fontSize', 'px');
        this._bindRangeInputListener('letterSpacing', 'letterSpacing', 'em');
        this._bindSelectListener('textCase');
        this._bindSelectListener('fontWeight');
        this._bindSelectListener('textColorMode');
        this._bindColorInputListener('solidColorPicker');
        this._bindSelectListener('gradientPreset');
        this._bindColorInputListener('color1');
        this._bindColorInputListener('color2');
        this._bindColorInputListener('color3');
        this._bindCheckboxListener('useColor3');
        this._bindRangeInputListener('animationDirection'); // Text gradient direction
        this._bindSelectListener('textShadow');
        this._bindColorInputListener('borderColorPicker'); // Sets --dynamic-border-color
        this._bindSelectListener('borderStyle'); // Applies class to logo-container
        this._bindSelectListener('textAlign');
        this._bindRangeInputListener('rotation', 'transform', 'deg');
        this._bindSelectListener('textAnimation'); // Applies class to logo-text
        this._bindRangeInputListener('animationSpeed'); // Sets --animation-duration
        this._bindSelectListener('backgroundType'); // Applies class/style to previewContainer
        this._bindColorInputListener('backgroundColor');
        this._bindRangeInputListener('bgOpacity'); // Styles previewContainer
        this._bindSelectListener('backgroundGradientPreset');
        this._bindColorInputListener('bgColor1');
        this._bindColorInputListener('bgColor2');
        this._bindRangeInputListener('bgGradientDirection'); // Sets --bg-gradient-direction
        this._bindSelectListener('previewSize'); // Applies class to previewContainer
        this._bindNumberInputListener('exportWidth');
        this._bindNumberInputListener('exportHeight');
        this._bindRangeInputListener('exportQuality');
        this._bindCheckboxListener('exportTransparent');
        this._bindNumberInputListener('exportFrames');
        this._bindRangeInputListener('exportFrameRate');
        console.log('[SM] Event listeners setup done.');
    },

    // --- Binder Functions (with v13 Logging) ---

    _bindInputListener(inputId, settingKeyOrTargetProp) {
        const input = document.getElementById(inputId); if (!input) { console.warn(`[SM] Input element #${inputId} not found.`); return; }
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            console.log(`[SM] Input Change: #${inputId} = '${value}'`);
            this._currentSettings[inputId] = value;

            if (settingKeyOrTargetProp === 'textContent') {
                const logoEl = document.querySelector('.logo-text');
                if (logoEl) {
                    logoEl.textContent = value;
                    logoEl.setAttribute('data-text', value); // Keep data-text attribute updated for potential effects
                    console.log(`[SM] Updated .logo-text content and data-text.`);
                }
                this._updateSizeIndicator(); // Text change affects size
            }
            // No other direct style updates for simple inputs in this setup

            this._triggerSettingsUpdate(); // Save, notify, update CSS/Size
        });
    },

    _bindSelectListener(selectId) {
        const select = document.getElementById(selectId); if (!select) { console.warn(`[SM] Select element #${selectId} not found.`); return; }
        select.addEventListener('change', (e) => {
            const value = e.target.value;
            console.log(`[SM] Select Change: #${selectId} = '${value}'`);
            this._currentSettings[selectId] = value;

            // Get necessary elements for updates
            const logoElement = document.querySelector('.logo-text');
            const logoContainer = document.querySelector('.logo-container'); // Needed for borderStyle
            const previewContainer = document.getElementById('previewContainer'); // Needed for previewSize, backgroundType

            if (!logoElement) { console.error("[SM SelectListener] '.logo-text' element not found!"); return; }
            if (!logoContainer) { console.warn("[SM SelectListener] '.logo-container' element not found (needed for border)."); /* Continue if possible */ }
            if (!previewContainer) { console.warn("[SM SelectListener] '#previewContainer' element not found (needed for size/bg)."); /* Continue if possible */ }


            // Apply specific style changes or class updates based on the select element ID
            switch (selectId) {
                case 'fontFamily':
                    logoElement.style.fontFamily = `"${value}", sans-serif`; // Apply style directly
                    this._injectFontStyle(value); // Inject/update @font-face rule
                    this._updateFontPreview(value); // Update small preview span
                    console.log(`[SM] Applied font-family: ${value} and triggered font injection.`);
                    break;
                case 'textCase':
                    logoElement.style.textTransform = value;
                    console.log(`[SM] Applied text-transform: ${value}`);
                    break;
                case 'fontWeight':
                    logoElement.style.fontWeight = value;
                    this._injectFontStyle(this._currentSettings.fontFamily); // Re-inject potentially different weight variant
                    console.log(`[SM] Applied font-weight: ${value} and triggered font injection.`);
                    break;
                case 'textAlign':
                    logoElement.style.textAlign = value;
                    console.log(`[SM] Applied text-align: ${value}`);
                    break;
                case 'textColorMode':
                    this._handleColorModeChange(value); // Handles visibility and applies solid/gradient
                    break;
                case 'gradientPreset':
                    this._handleGradientPresetChange(value); // Handles visibility and applies gradient
                    break;
                case 'textShadow':
                    console.log(`[SM] Applying text effect class: ${value} to .logo-text`);
                    this._applyClassFromSelect(logoElement, value, 'text-glow-'); // Use element ref
                    console.log('[SM] .logo-text classes after shadow apply:', logoElement.classList);
                    break;
                case 'borderStyle':
                     if (logoContainer) {
                        console.log(`[SM] Applying border style class: ${value} to .logo-container`);
                        // Add/remove the base class that enables the border variables/styling
                        logoContainer.classList.toggle('dynamic-border', value !== 'border-none');
                        // Apply the specific style class (e.g., border-dashed)
                        this._applyClassFromSelect(logoContainer, value, 'border-'); // Use element ref
                        console.log('[SM] logo-container classes after border apply:', logoContainer.classList);
                     } else {
                         console.warn(`[SM] Cannot apply borderStyle '${value}', .logo-container missing.`);
                     }
                    break;
                case 'textAnimation':
                    console.log(`[SM] Applying animation class: ${value} to .logo-text`);
                    this._applyClassFromSelect(logoElement, value, 'anim-'); // Use element ref
                    console.log('[SM] .logo-text classes after anim apply:', logoElement.classList);
                    this._applyAnimationSpeed(this._currentSettings.animationSpeed); // Re-apply speed in case animation was 'none' before
                    break;
                case 'backgroundType':
                    this._handleBackgroundTypeChange(value); // Handles visibility and applies bg style/class
                    break;
                case 'previewSize':
                    if (previewContainer) {
                        console.log(`[SM] Applying preview size class: ${value} to #previewContainer`);
                        this._applyClassFromSelect(previewContainer, value, 'preview-size-'); // Use element ref
                        console.log('[SM] #previewContainer classes after size apply:', previewContainer.classList);
                        this._updateSizeIndicator(); // Size change might affect layout
                    } else {
                         console.warn(`[SM] Cannot apply previewSize '${value}', #previewContainer missing.`);
                    }
                    break;
                case 'backgroundGradientPreset':
                    this._handleBackgroundGradientChange(value); // Handles visibility and applies bg gradient
                    break;
                default:
                    console.warn(`[SM] Unhandled select change: #${selectId}`);
            }
            this._triggerSettingsUpdate(); // Save, notify, update CSS/Size
        });
    },

    _bindNumberInputListener(inputId, styleProperty = null, unit = '') {
        const input = document.getElementById(inputId); if (!input) { console.warn(`[SM] Number input #${inputId} not found.`); return; }
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            console.log(`[SM] Number Input Change: #${inputId} = ${value}`);
            this._currentSettings[inputId] = value;

            if (styleProperty === 'fontSize') {
                const logoEl = document.querySelector('.logo-text');
                if (logoEl) logoEl.style.fontSize = `${value}${unit}`;
                 console.log(`[SM] Applied font-size: ${value}${unit}`);
                this._updateSizeIndicator(); // Font size affects dimensions
            } else if (inputId.startsWith('export')) {
                 console.log(`[SM] Export setting updated: ${inputId} = ${value}`);
            }
            // Other number inputs (like export dimensions) don't directly affect live preview style here

            this._triggerSettingsUpdate(); // Save, notify, update CSS/Size
        });
    },

    _bindRangeInputListener(inputId, styleProperty = null, unit = '') {
        const input = document.getElementById(inputId); if (!input) { console.warn(`[SM] Range input #${inputId} not found.`); return; }
        const display = input.parentElement?.querySelector('.range-value-display'); // Assumes display is sibling/child

        // Helper to update the associated display span
        const updateDisplay = (val) => {
             if(display) { display.textContent = val + (unit === 'x' ? unit : (unit ? ('\u00A0' + unit) : '')); } // Add non-breaking space before unit if exists
        };

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this._currentSettings[inputId] = value;
            updateDisplay(value); // Update the number display next to the slider

            const logoElement = document.querySelector('.logo-text');
            const previewContainer = document.getElementById('previewContainer');

            switch (inputId) {
                case 'letterSpacing':
                     if (logoElement) logoElement.style.letterSpacing = `${value}em`;
                     console.log(`[SM] Applied letter-spacing: ${value}em`);
                     this._updateSizeIndicator(); // Letter spacing affects size
                     break;
                case 'rotation':
                    if (logoElement) logoElement.style.transform = `rotate(${value}deg)`;
                    console.log(`[SM] Applied rotation: ${value}deg`);
                    break;
                case 'animationSpeed':
                    this._applyAnimationSpeed(value); // Use helper to set CSS var
                    break;
                case 'animationDirection': // Controls text gradient direction
                    document.documentElement.style.setProperty('--gradient-direction', `${value}deg`);
                    // Re-apply text gradient if currently active
                    if (this._currentSettings.textColorMode === 'gradient') {
                        this._applyGradientToLogo();
                    }
                     console.log(`[SM] Applied text gradient direction (--gradient-direction): ${value}deg`);
                    break;
                case 'bgOpacity':
                    if (previewContainer) previewContainer.style.opacity = value;
                    console.log(`[SM] Applied background opacity: ${value}`);
                    break;
                case 'bgGradientDirection': // Controls background gradient direction
                    document.documentElement.style.setProperty('--bg-gradient-direction', `${value}deg`);
                    // Re-apply background gradient if currently active
                    if (this._currentSettings.backgroundType?.includes('gradient')) {
                        this._applyBackgroundGradient();
                    }
                     console.log(`[SM] Applied background gradient direction (--bg-gradient-direction): ${value}deg`);
                    break;
                case 'exportFrameRate':
                     console.log(`[SM] Export Frame Rate (Preview) set to: ${value} FPS`);
                     /* Display only - GIF Exporter UI might read this value */
                     break;
                case 'exportQuality':
                    console.log(`[SM] Export Quality set to: ${value}%`);
                    /* No live visual update needed */
                     break;
                default:
                    console.warn(`[SM] Unhandled range input: #${inputId}`);
            }
            this._triggerSettingsUpdate(); // Save, notify, update CSS/Size
        });
         // Initialize display on load (will be handled by applySettings -> _updateRangeValueDisplays)
        // updateDisplay(input.value);
    },

    _bindCheckboxListener(checkboxId) {
        const checkbox = document.getElementById(checkboxId); if (!checkbox) { console.warn(`[SM] Checkbox #${checkboxId} not found.`); return; }
        checkbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            console.log(`[SM] Checkbox Change: #${checkboxId} = ${isChecked}`);
            this._currentSettings[checkboxId] = isChecked;

            if (checkboxId === 'useColor3') {
                const color3Control = document.getElementById('color3Control');
                if (color3Control) color3Control.classList.toggle('hidden', !isChecked);
                // Re-apply text gradient if it's active, as the number of colors changed
                if (this._currentSettings.textColorMode === 'gradient') {
                    this._applyGradientToLogo();
                }
                console.log(`[SM] Toggled Use Color 3: ${isChecked}. Gradient updated if active.`);
            } else if (checkboxId === 'exportTransparent') {
                 console.log(`[SM] Export Transparent toggled: ${isChecked}`);
                 // This setting is primarily used during the export process itself.
                 // It might affect the preview if the background type is 'bg-transparent'
                 // and the underlying page color shows through, but typically no direct live style change needed.
                 if (this._currentSettings.backgroundType === 'bg-transparent') {
                     // Optionally force redraw or update background slightly? Usually not necessary.
                 }
            }
            this._triggerSettingsUpdate(); // Save, notify, update CSS/Size
        });
    },

    _bindColorInputListener(inputId) {
        const input = document.getElementById(inputId); if (!input) { console.warn(`[SM] Color input #${inputId} not found.`); return; }
        // Use 'input' event for live updates as the user drags the color picker
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            // Note: No console log here as 'input' fires very rapidly during drag. Log on 'change' if needed.
            this._currentSettings[inputId] = value;

            switch (inputId) {
                case 'solidColorPicker':
                     // Apply only if text color mode is currently 'solid'
                    if (this._currentSettings.textColorMode === 'solid') {
                         const el = document.querySelector('.logo-text');
                         if (el) el.style.color = value;
                         // console.log(`[SM] Applied solid text color: ${value}`); // Log on change?
                    }
                     break;
                case 'color1':
                case 'color2':
                case 'color3':
                     // Apply only if text color mode is 'gradient' and preset is 'custom'
                    if (this._currentSettings.textColorMode === 'gradient' && this._currentSettings.gradientPreset === 'custom') {
                         this._applyGradientToLogo();
                         // console.log(`[SM] Custom text gradient color changed (${inputId})`); // Log on change?
                    }
                     break;
                case 'borderColorPicker':
                    // Directly update the CSS variable used by the border styles
                    document.documentElement.style.setProperty('--dynamic-border-color', value);
                    // console.log(`[SM] Set --dynamic-border-color CSS variable to: ${value}`); // Log on change?
                    break;
                case 'backgroundColor':
                     // Apply only if background type is currently 'solid'
                    const pc = document.getElementById('previewContainer');
                     if (pc && this._currentSettings.backgroundType === 'bg-solid') {
                         pc.style.backgroundColor = value;
                         // console.log(`[SM] Applied solid background color: ${value}`); // Log on change?
                    }
                     break;
                case 'bgColor1':
                case 'bgColor2':
                     // Apply only if background type is 'gradient' and preset is 'custom'
                    if (this._currentSettings.backgroundType?.includes('gradient') && this._currentSettings.backgroundGradientPreset === 'custom') {
                         this._applyBackgroundGradient();
                         // console.log(`[SM] Custom background gradient color changed (${inputId})`); // Log on change?
                    }
                     break;
            }
            this._triggerSettingsUpdate(); // Save, notify, update CSS/Size
        });
         // Add a 'change' listener if you want a log event *after* the user finishes picking
         input.addEventListener('change', (e) => {
             console.log(`[SM] Color Change (final): #${inputId} = ${e.target.value}`);
         });
    },

    // --- Specific Handlers (with v13 Robustness Checks & Logging) ---

    _handleColorModeChange(mode) {
        console.log(`[SM] Handling Color Mode Change to: ${mode}`);
        const solidGroup = document.getElementById('solidColorPickerGroup');
        const presetSelect = document.getElementById('gradientPreset');
        const customGroup = document.getElementById('customGradientControls');
        const logoEl = document.querySelector('.logo-text');
        const presetGroup = presetSelect ? presetSelect.closest('.control-group') : null; // Find parent group

        if (!solidGroup || !presetSelect || !presetGroup || !customGroup || !logoEl) {
             console.error("[SM Error] Missing critical elements for color mode change UI update:", { solidGroup: !!solidGroup, presetSelect: !!presetSelect, presetGroup: !!presetGroup, customGroup: !!customGroup, logoEl: !!logoEl });
             // Attempt to apply styles anyway if logoEl exists
             if (!logoEl) return; // Cannot proceed without logo element
        } else {
            console.log("[SM] Color mode change UI elements found.");
        }

        const isSolid = mode === 'solid';

        // Toggle visibility of control groups
        if (solidGroup) solidGroup.classList.toggle('hidden', !isSolid);
        if (presetGroup) presetGroup.classList.toggle('hidden', isSolid);
        if (customGroup && presetSelect) customGroup.classList.toggle('hidden', isSolid || presetSelect.value !== 'custom');

        // Apply styles to the logo text
        if (isSolid) {
            const solidColorPicker = document.getElementById('solidColorPicker');
            const solidColor = solidColorPicker ? solidColorPicker.value : (this._currentSettings.solidColorPicker || '#ffffff');
            console.log(`[SM] Applying solid text color: ${solidColor}`);
            logoEl.style.backgroundImage = 'none'; // Remove any existing gradient
            logoEl.style.backgroundClip = 'initial'; // Reset clipping
            logoEl.style.webkitBackgroundClip = 'initial';
            logoEl.style.color = solidColor; // Apply the solid color
            logoEl.style.webkitTextFillColor = 'initial'; // Reset webkit override
        } else { // Mode is 'gradient'
            console.log('[SM] Applying gradient text color...');
            this._applyGradientToLogo(); // Apply/re-apply gradient styles
        }
    },

    _handleGradientPresetChange(preset) {
        console.log(`[SM] Handling Text Gradient Preset Change: ${preset}`);
        const customControls = document.getElementById('customGradientControls');
        if (customControls) customControls.classList.toggle('hidden', preset !== 'custom');
        this._applyGradientToLogo(); // Re-apply gradient based on new preset or custom colors
    },

    _applyGradientToLogo() {
        const logoEl = document.querySelector('.logo-text');
        const presetSelect = document.getElementById('gradientPreset');
        const directionInput = document.getElementById('animationDirection'); // Input controlling text gradient direction

        if (!logoEl || !presetSelect || !directionInput) {
            console.warn("[SM ApplyGradient] Missing required elements (logoEl, presetSelect, directionInput).");
            return;
        }

        // Only apply if the current mode is actually 'gradient'
        if (this._currentSettings.textColorMode !== 'gradient') {
             console.log("[SM ApplyGradient] Skipped: Mode is not gradient.");
            // Ensure solid styles are applied if mode changed *away* from gradient previously
             if(logoEl.style.backgroundImage !== 'none') {
                 this._handleColorModeChange('solid'); // Re-apply solid mode if needed
             }
            return;
        }

        let gradient = '';
        const direction = directionInput.value || this._currentSettings.animationDirection || '45'; // Use current value or setting
        const preset = presetSelect.value; // Use current dropdown value

        console.log(`[SM ApplyGradient] Applying text gradient. Preset: ${preset}, Direction: ${direction}deg`);

        if (preset === 'custom') {
            const c1 = document.getElementById('color1')?.value || this._currentSettings.color1;
            const c2 = document.getElementById('color2')?.value || this._currentSettings.color2;
            const useC3 = document.getElementById('useColor3')?.checked ?? this._currentSettings.useColor3;
            const c3 = document.getElementById('color3')?.value || this._currentSettings.color3;
            gradient = useC3 ? `linear-gradient(${direction}deg, ${c1}, ${c2}, ${c3})` : `linear-gradient(${direction}deg, ${c1}, ${c2})`;
             console.log(`[SM ApplyGradient] Custom colors: ${c1}, ${c2}` + (useC3 ? `, ${c3}` : ''));
        } else {
            // Get the gradient definition from the corresponding CSS variable (e.g., --primary-gradient)
            const presetVarName = `--${preset}`; // Assumes preset value matches CSS var name suffix
            const presetVarValue = getComputedStyle(document.documentElement).getPropertyValue(presetVarName).trim();
             console.log(`[SM ApplyGradient] Preset var read: ${presetVarName} = '${presetVarValue}'`);

            if (presetVarValue && presetVarValue.startsWith('linear-gradient')) {
                // Reconstruct the gradient using the current direction from the input/settings
                 gradient = presetVarValue.replace(/linear-gradient\([^,]+,/, `linear-gradient(${direction}deg,`);
            } else {
                console.warn(`[SM ApplyGradient] Preset var '${presetVarName}' invalid or not found. Using fallback gradient.`);
                // Fallback using default colors
                gradient = `linear-gradient(${direction}deg, ${DEFAULT_SETTINGS.color1}, ${DEFAULT_SETTINGS.color2})`;
            }
        }

        // Apply styles necessary for gradient text rendering
        logoEl.style.backgroundImage = gradient;
        logoEl.style.webkitBackgroundClip = 'text';
        logoEl.style.backgroundClip = 'text';
        logoEl.style.color = 'transparent'; // Make the base text color transparent
        logoEl.style.webkitTextFillColor = 'transparent'; // Override for webkit-based browsers

        console.log('[SM ApplyGradient] Text gradient styles applied.');
    },

    _handleBackgroundTypeChange(type) {
        console.log(`[SM] Handling Background Type Change: ${type}`);
        const previewContainer = document.getElementById('previewContainer');
        const bgColorControl = document.getElementById('backgroundColorControl');
        const bgGradientControls = document.getElementById('backgroundGradientControls'); // Contains preset + custom
        const customBgGradientControls = document.getElementById('customBackgroundGradient'); // Specific custom color inputs
        const bgPresetSelect = document.getElementById('backgroundGradientPreset');

        // Validate elements
        if (!previewContainer || !bgColorControl || !bgGradientControls || !customBgGradientControls || !bgPresetSelect) {
            console.error("[SM] Missing critical elements for background type change UI update.");
            return;
        }

        const isSolid = type === 'bg-solid';
        const isGradient = type === 'bg-gradient' || type === 'bg-gradient-animated';
        const isPattern = !isSolid && !isGradient && type !== 'bg-transparent';

        // --- Toggle Control Visibility ---
        bgColorControl.classList.toggle('hidden', !isSolid);
        bgGradientControls.classList.toggle('hidden', !isGradient);
        // Show custom BG gradient controls ONLY if gradient type is selected AND 'custom' preset is chosen
        customBgGradientControls.classList.toggle('hidden', !isGradient || bgPresetSelect.value !== 'custom');

        // --- Apply Styles and Classes to Preview Container ---
        const classList = previewContainer.classList;

        // 1. Clear previous background-related inline styles and classes
        previewContainer.style.backgroundColor = '';
        previewContainer.style.backgroundImage = '';
        // Keep opacity controlled separately by its own input:
        // previewContainer.style.opacity = this._currentSettings.bgOpacity || '1';

        const bgClassesToRemove = Array.from(classList).filter(cls => cls.startsWith('bg-'));
        if (bgClassesToRemove.length > 0) {
             console.log(`[SM] Removing old background classes: ${bgClassesToRemove.join(', ')}`);
            classList.remove(...bgClassesToRemove);
        }
        // Specifically remove animation class if switching away from animated gradient
        classList.remove('bg-gradient-animated-css');

        // 2. Apply new styles/classes based on selected type
        if (isSolid) {
            classList.add('bg-solid'); // Add identifying class
            const bgColorPicker = document.getElementById('backgroundColor');
            previewContainer.style.backgroundColor = bgColorPicker ? bgColorPicker.value : (this._currentSettings.backgroundColor || '#000000');
            console.log(`[SM] Applied bg-solid, color: ${previewContainer.style.backgroundColor}`);
        } else if (isGradient) {
            // Add base class (e.g., 'bg-gradient' or 'bg-gradient-animated')
            classList.add(type);
            // Apply the gradient via inline style (handles presets and custom)
            this._applyBackgroundGradient(); // This will set style.backgroundImage

            if (type === 'bg-gradient-animated') {
                previewContainer.classList.add('bg-gradient-animated-css'); // Add class for CSS animation
                console.log('[SM] Applied animated gradient styles/classes.');
            } else {
                console.log('[SM] Applied static gradient styles/classes.');
            }
        } else if (isPattern) { // For patterns like bg-grid, bg-stars etc.
             console.log(`[SM] Applying background pattern class: ${type}`);
            classList.add(type); // Add the specific pattern class (e.g., 'bg-grid')
             // Patterns usually rely solely on CSS classes for styling
        } else { // bg-transparent
            classList.add('bg-transparent');
            previewContainer.style.backgroundColor = 'transparent'; // Ensure fully transparent
            previewContainer.style.backgroundImage = 'none';
            console.log('[SM] Applied transparent background.');
        }
        console.log(`[SM] Final preview container classes: ${Array.from(previewContainer.classList).join(' ')}`);
    },

    _handleBackgroundGradientChange(presetValue) {
        console.log(`[SM] Handling Background Gradient Preset Change: ${presetValue}`);
        const customBgGroup = document.getElementById('customBackgroundGradient');
        if (customBgGroup) customBgGroup.classList.toggle('hidden', presetValue !== 'custom');
        // Re-apply gradient only if a gradient background type is currently selected
        if (this._currentSettings.backgroundType?.includes('gradient')) {
             this._applyBackgroundGradient();
        }
    },

    _applyBackgroundGradient() {
        const previewContainer = document.getElementById('previewContainer');
        const presetSelect = document.getElementById('backgroundGradientPreset');
        const directionInput = document.getElementById('bgGradientDirection');

        if (!previewContainer || !presetSelect || !directionInput) {
             console.warn("[SM ApplyBgGradient] Missing required elements (previewContainer, presetSelect, directionInput).");
             return;
        }

        // Only proceed if a gradient background type is actually selected
        const currentBgType = this._currentSettings.backgroundType;
        if (currentBgType !== 'bg-gradient' && currentBgType !== 'bg-gradient-animated') {
             console.log("[SM ApplyBgGradient] Skipped: Background type is not gradient.");
             return;
        }

        let gradient = '';
        const direction = directionInput.value || this._currentSettings.bgGradientDirection || '90';
        const preset = presetSelect.value;

        console.log(`[SM ApplyBgGradient] Applying background gradient. Preset: ${preset}, Direction: ${direction}deg`);

        if (preset === 'custom') {
            const c1 = document.getElementById('bgColor1')?.value || this._currentSettings.bgColor1;
            const c2 = document.getElementById('bgColor2')?.value || this._currentSettings.bgColor2;
            gradient = `linear-gradient(${direction}deg, ${c1}, ${c2})`;
        } else {
            const rootStyle = getComputedStyle(document.documentElement);
            // Assumes preset value matches CSS var name (e.g., 'bg-primary-gradient' matches '--bg-primary-gradient')
            const presetVarName = `--${preset}`;
            const presetVarValue = rootStyle.getPropertyValue(presetVarName).trim();

            if (presetVarValue?.startsWith('linear-gradient')) {
                // Reconstruct using the current direction
                gradient = presetVarValue.replace(/linear-gradient\(([^,]+),/, `linear-gradient(${direction}deg,`);
            } else {
                console.warn(`[SM ApplyBgGradient] Invalid/missing CSS var '${presetVarName}'. Using fallback gradient.`);
                gradient = `linear-gradient(${direction}deg, ${DEFAULT_SETTINGS.bgColor1}, ${DEFAULT_SETTINGS.bgColor2})`; // Fallback
            }
        }
        previewContainer.style.backgroundImage = gradient; // Apply directly to the container
        console.log(`[SM ApplyBgGradient] Set background image to: ${gradient}`);
    },

    // --- Animation Speed Helper ---
     _applyAnimationSpeed(speedValue) {
          // speedValue is expected to be a multiplier (e.g., 0.5, 1, 2)
         const speed = parseFloat(speedValue || 1);
         const baseDuration = 2; // Base duration in seconds for speed '1' (adjust if CSS is different)
         // Calculate actual duration: higher speed = shorter duration
         // Ensure duration doesn't go below a minimum threshold (e.g., 0.1s)
         const duration = Math.max(0.1, baseDuration / Math.max(0.1, speed));

         // Set the CSS variable that controls animation durations
         document.documentElement.style.setProperty('--animation-duration', `${duration.toFixed(2)}s`);
         console.log(`[SM] Applied animation speed multiplier: ${speed}x (CSS --animation-duration: ${duration.toFixed(2)}s)`);
     },


    // --- Utility Helpers ---

    /** Applies a class based on select value, removing old prefixed classes */
    _applyClassFromSelect(targetSelectorOrElement, className, classPrefix = null) {
        // Allow passing either a selector string or a direct element reference
        const targetElement = (typeof targetSelectorOrElement === 'string')
            ? document.querySelector(targetSelectorOrElement)
            : targetSelectorOrElement;

        if (!targetElement) {
             console.warn(`[SM ApplyClass] Target not found:`, targetSelectorOrElement);
             return;
        }

        // Remove existing classes with the same prefix
        if (classPrefix) {
            const classesToRemove = Array.from(targetElement.classList).filter(cls => cls.startsWith(classPrefix));
            if (classesToRemove.length > 0) {
                targetElement.classList.remove(...classesToRemove);
                // console.log(`[SM ApplyClass] Removed prefix '${classPrefix}' classes (${classesToRemove.join(', ')}) from`, targetElement);
            }
        }

        // Add the new class if it's meaningful (not empty and not a "none" class)
        if (className && (!classPrefix || !className.endsWith('-none'))) {
            targetElement.classList.add(className);
            // console.log(`[SM ApplyClass] Added class '${className}' to`, targetElement);
        } else if (className && classPrefix && className.endsWith('-none')) {
            // console.log(`[SM ApplyClass] Class '${className}' is a 'none' class, not adding.`);
        }
    },

    /** Injects @font-face rule for the selected font */
    async _injectFontStyle(fontFamilyName, isInitial = false) {
        // console.log(`[SM] Injecting font style for: ${fontFamilyName} (Initial: ${isInitial})`); // Verbose log

        // 1. Find the dedicated style element for dynamic fonts
        let dynamicStyleElement = document.getElementById('dynamic-font-style');
        let attempt = 0; const maxAttempts = 5, retryDelay = 50; // Retry quickly if needed during init

        // Retry finding the element if it's initial load and not immediately found
        while (!dynamicStyleElement && isInitial && attempt < maxAttempts) {
            attempt++;
            console.warn(`[SM] #dynamic-font-style not found, attempt ${attempt}...`);
            await new Promise(r => setTimeout(r, retryDelay)); // Wait briefly
            dynamicStyleElement = document.getElementById('dynamic-font-style');
        }

        if (!dynamicStyleElement) {
            console.error("[SM] CRITICAL: #dynamic-font-style element missing after retries! Cannot inject font.");
            // Show alert only once to avoid spamming
            if (!window._dynFontAlertShown && typeof showAlert === 'function') {
                showAlert('Font system style element missing. Fonts may not load correctly.', 'error');
                window._dynFontAlertShown = true; // Prevent repeated alerts
            }
            return;
        }

        // 2. Get font data (should be loaded by fontManager and available globally)
        const fontDataGlobal = window._INLINE_FONTS_DATA;
        if (!Array.isArray(fontDataGlobal) || fontDataGlobal.length === 0 || !fontFamilyName) {
            console.warn(`[SM] Font data invalid or missing for injection ('${fontFamilyName}'). Clearing style tag.`);
            dynamicStyleElement.textContent = '/* Font data unavailable */';
            return;
        }

        // 3. Find the specific font family data
        const targetL = fontFamilyName.toLowerCase();
        const family = fontDataGlobal.find(f =>
            f && (f.familyName?.toLowerCase() === targetL || f.displayName?.toLowerCase() === targetL)
        );

        if (!family?.variants?.length) {
            console.warn(`[SM] Font family '${fontFamilyName}' not found or has no variants in data. Clearing style tag.`);
            dynamicStyleElement.textContent = `/* Font '${fontFamilyName}' not found in data */`;
            return;
        }

        // 4. Find the best matching variant with embedded Base64 data
        // Priority: Exact weight/style -> Exact weight -> 400/normal -> Any variant
        const targetWeight = String(this._currentSettings?.fontWeight || '400');
        const targetStyle = 'normal'; // Currently only supporting 'normal' style injection

        let bestMatch =
             family.variants.find(v => v?.file?.startsWith('data:') && String(v.weight || 400) === targetWeight && (v.style || 'normal').toLowerCase() === targetStyle) ||
             family.variants.find(v => v?.file?.startsWith('data:') && String(v.weight || 400) === targetWeight) || // Match weight only
             family.variants.find(v => v?.file?.startsWith('data:') && String(v.weight || 400) === '400' && (v.style || 'normal').toLowerCase() === 'normal') || // Fallback to 400 normal
             family.variants.find(v => v?.file?.startsWith('data:')); // Fallback to any available base64 variant

        // 5. Construct and inject the @font-face rule
        if (bestMatch?.file) {
            const format = bestMatch.format || 'woff2'; // Assume woff2 if format missing
            const weight = bestMatch.weight || 400;
            const style = bestMatch.style || 'normal';
            // Add font-display: swap for better perceived performance
            const rule = `/* Font: ${family.displayName} (${weight} ${style}) */\n@font-face {\n  font-family: "${family.familyName}";\n  src: url(${bestMatch.file}) format("${format}");\n  font-weight: ${weight};\n  font-style: ${style};\n  font-display: swap;\n}`;

            dynamicStyleElement.textContent = rule;
            // Force browser reflow/repaint to ensure the font is applied quickly (optional but can help)
            void document.body.offsetHeight;
            console.log(`[SM] Injected @font-face for ${family.familyName} (weight ${weight}, style ${style})`);
        } else {
            console.warn(`[SM] No embeddable Base64 variant found for ${fontFamilyName} (Target weight: ${targetWeight}). Clearing style tag.`);
            dynamicStyleElement.textContent = `/* No embeddable variant found for '${fontFamilyName}' */`;
        }
    },

    // --- Core Methods ---

    /** Triggered on any setting change to save, notify, and update derived states */
    _triggerSettingsUpdate() {
        this.saveCurrentSettings(); // Persist to localStorage
        // Notify external listeners (e.g., potentially for real-time previews elsewhere)
        this._listeners.forEach(listener => {
             try { listener(this.getCurrentSettings()); } catch(e) { console.error("[SM] Error in settings change listener:", e)}
        });
        this._updateSizeIndicator(); // Update width/height display
        this._updateCSSCode(); // Update the CSS code output area
    },

    /** Update the displayed width/height indicators */
    _updateSizeIndicator() {
        // Use requestAnimationFrame to read dimensions after potential layout changes
        requestAnimationFrame(() => {
            const logoEl = document.querySelector('.logo-text');
            const widthIndicator = document.getElementById('logoWidth');
            const heightIndicator = document.getElementById('logoHeight');
            if (!logoEl || !widthIndicator || !heightIndicator) {
                 // console.warn("[SM] Size indicator elements missing."); // Can be noisy
                 return;
            }
            try {
                const rect = logoEl.getBoundingClientRect();
                // Only update if dimensions are valid (prevents display of 0x0 during transitions)
                if (rect.width > 0 && rect.height > 0) {
                     widthIndicator.textContent = Math.round(rect.width);
                     heightIndicator.textContent = Math.round(rect.height);
                }
            } catch (e) {
                 console.error("[SM] Error updating size indicator:", e);
            }
        });
    },

    /** Update the content of the CSS code output textarea */
    _updateCSSCode() {
        const cssCodeArea = document.getElementById('cssCode');
        if (cssCodeArea) {
            cssCodeArea.value = this._generateCSSCode();
        } else {
             // console.warn("[SM] CSS code textarea (#cssCode) not found."); // Only warn if needed
        }
    },

    /** Generates CSS code based on current styles */
    _generateCSSCode() {
         console.log("[SM] Generating CSS Code...");
         // Get references to the core elements
         const logoElement = document.querySelector('.logo-text');
         const previewContainer = document.getElementById('previewContainer');
         // Border is applied to logo-container which might also have the dynamic-border class
         const logoContainer = document.querySelector('.logo-container');

         // --- Basic Element Checks ---
         let errorMsg = '';
         if (!logoElement) errorMsg += '.logo-text missing. ';
         if (!previewContainer) errorMsg += '#previewContainer missing. ';
         if (!logoContainer) errorMsg += '.logo-container missing. '; // Border target

         if (errorMsg) {
             console.error(`[SM CSS Gen Error] ${errorMsg}`);
             return `/* Error: Cannot generate CSS. Required elements missing: ${errorMsg}*/`;
         }
         console.log("[SM CSS Gen] Required elements found.");

         try {
             // --- Get Computed Styles ---
             const logoStyle = window.getComputedStyle(logoElement);
             const containerStyle = window.getComputedStyle(previewContainer);
             // Get computed style of the element where the border is applied
             const borderTargetStyle = window.getComputedStyle(logoContainer);
             const rootStyle = window.getComputedStyle(document.documentElement);

             // --- CSS Variables ---
             // Include key CSS variables that control dynamic aspects
             const cssVarsToInclude = [
                 '--animation-duration',
                 '--gradient-direction', // For text gradient
                 '--dynamic-border-color',
                 '--bg-gradient-direction', // For background gradient
                 // Include gradient preset variables if needed, or rely on direct gradient values below
                 // '--primary-gradient', '--cyberpunk-gradient', etc. (optional)
             ];
             let css = `:root {\n`;
             cssVarsToInclude.forEach(varName => {
                 const value = rootStyle.getPropertyValue(varName).trim();
                 if (value) css += `  ${varName}: ${value};\n`;
             });
             css += `}\n\n`;

             // --- Container Styles ---
             // Use a generic class name for the container in the generated CSS
             css += `.logo-container { /* Basic styles - adjust as needed */\n`;
             css += `  display: flex;\n`;
             css += `  justify-content: center;\n`;
             css += `  align-items: center;\n`;
             // Use export dimensions or a fallback for container size in CSS? Optional.
             css += `  width: ${this._currentSettings.exportWidth || 800}px; /* Example width */\n`;
             css += `  height: ${this._currentSettings.exportHeight || 400}px; /* Example height */\n`;
             css += `  overflow: hidden; /* Prevent content overflow */\n`;
             css += `  position: relative; /* For potential absolute positioning inside */\n`;

             // Background Handling (based on current setting)
             const bgTypeSetting = this._currentSettings.backgroundType || 'bg-solid';
             console.log(`[SM CSS Gen] Background Type: ${bgTypeSetting}`);
             if (bgTypeSetting === 'bg-solid') {
                 css += `  background-color: ${this._currentSettings.backgroundColor || '#000000'};\n`;
             } else if (bgTypeSetting.includes('gradient')) {
                 // Use the computed backgroundImage from the preview element
                 const grad = previewContainer.style.backgroundImage || containerStyle.backgroundImage; // Prefer inline style if set
                 if (grad && grad !== 'none') {
                      css += `  background-image: ${grad};\n`;
                      // Add background size for animated gradients if needed
                      if(bgTypeSetting === 'bg-gradient-animated') {
                          css += `  background-size: 400% 400%; /* Example for animation */\n`;
                          css += `  animation: bgAnimateGradient 10s ease infinite; /* Example animation */\n`;
                      }
                 } else {
                     css += `  /* Warning: Gradient background expected but not found */\n`;
                 }
             } else if (bgTypeSetting !== 'bg-transparent') {
                 // Assume background is applied via a CSS class (e.g., bg-grid)
                 css += `  /* Background is applied via CSS class: ${bgTypeSetting} */\n`;
                 // Include base color as fallback or reference
                 css += `  background-color: ${containerStyle.backgroundColor || 'transparent'}; /* Base color */\n`;
                 css += `  /* Add the definition for .${bgTypeSetting} separately */\n`;
             } else { // bg-transparent
                 css += `  background-color: transparent;\n`;
             }
             // Opacity
             if (containerStyle.opacity !== '1') {
                  css += `  opacity: ${containerStyle.opacity};\n`;
             }

             // Border Handling (Applied to container)
             const borderStyleValue = borderTargetStyle.borderTopStyle; // Check one side is enough
              if (borderStyleValue && borderStyleValue !== 'none' && logoContainer.classList.contains('dynamic-border')) {
                  console.log(`[SM CSS Gen] Adding border styles: ${borderStyleValue}`);
                  css += `  border-style: ${borderStyleValue};\n`;
                  css += `  border-width: ${borderTargetStyle.borderTopWidth};\n`;
                  // Use the CSS variable for color
                  css += `  border-color: var(--dynamic-border-color, ${this._currentSettings.borderColorPicker || '#ffffff'});\n`;
                  // Include border-radius if it's not default
                  if (borderTargetStyle.borderRadius !== '0px') {
                       css += `  border-radius: ${borderTargetStyle.borderRadius};\n`;
                  }
              }

             css += `}\n\n`;

             // --- Logo Text Styles ---
             css += `.logo-text {\n`;
             // Font properties
             const primaryFont = getPrimaryFontFamily(logoStyle.fontFamily); // Use helper
             css += `  font-family: "${primaryFont}", sans-serif;\n`;
             css += `  font-size: ${logoStyle.fontSize};\n`;
             css += `  font-weight: ${logoStyle.fontWeight};\n`;
             css += `  font-style: ${logoStyle.fontStyle};\n`;
             if (logoStyle.letterSpacing !== 'normal') css += `  letter-spacing: ${logoStyle.letterSpacing};\n`;
             if (logoStyle.textTransform !== 'none') css += `  text-transform: ${logoStyle.textTransform};\n`;
             css += `  text-align: ${logoStyle.textAlign};\n`; // Alignment
             css += `  line-height: 1.2; /* Example base line-height */\n`;
             css += `  padding: 10px; /* Add some padding */\n`;
             css += `  margin: 0; /* Reset margin */\n`;
             css += `  white-space: pre-wrap; /* Respect whitespace and wrap */\n`;
             css += `  width: fit-content; /* Size based on content */\n`;
             css += `  max-width: 100%; /* Don't overflow container */\n`;


             // Color / Gradient Fill
             if (this._currentSettings.textColorMode === 'gradient') {
                  const grad = logoElement.style.backgroundImage || logoStyle.backgroundImage; // Prefer inline style
                  if (grad && grad !== 'none') {
                      css += `  background-image: ${grad};\n`;
                      css += `  -webkit-background-clip: text;\n`;
                      css += `  background-clip: text;\n`;
                      css += `  color: transparent;\n`;
                      css += `  -webkit-text-fill-color: transparent;\n`;
                  } else {
                      css += `  /* Warning: Gradient text expected but not found */\n`;
                      css += `  color: #FFFFFF; /* Fallback color */\n`;
                  }
             } else { // Solid color
                 css += `  color: ${logoStyle.color};\n`;
             }

             // Text Shadow / Effect (using computed style)
             // Note: This captures the browser's rendering, might be complex for non-standard shadows
             if (logoStyle.textShadow && logoStyle.textShadow !== 'none') {
                 css += `  text-shadow: ${logoStyle.textShadow};\n`;
             }

             // SVG text stroke is preferred over border for text itself.
             // If text-stroke is used in CSS (less common), capture it here?
             // if (logoStyle.webkitTextStroke || logoStyle.textStroke) css += `  -webkit-text-stroke: ${logoStyle.webkitTextStroke || logoStyle.textStroke};\n`;

             // Transform (Rotation)
             if (logoStyle.transform && logoStyle.transform !== 'none') {
                 css += `  transform: ${logoStyle.transform};\n`;
                 // Include transform-origin if needed, default is center
                 // css += `  transform-origin: center center;\n`;
             }

             // Animation
             // Use animation shorthand if possible, referring to the CSS variable for duration
             if (logoStyle.animationName && logoStyle.animationName !== 'none' && this._currentSettings.textAnimation !== 'anim-none') {
                 css += `  animation-name: ${logoStyle.animationName};\n`;
                 css += `  animation-duration: var(--animation-duration, ${logoStyle.animationDuration});\n`; // Use var
                 css += `  animation-timing-function: ${logoStyle.animationTimingFunction};\n`;
                 css += `  animation-iteration-count: ${logoStyle.animationIterationCount};\n`;
                 // Include other properties if needed (delay, fill-mode, direction)
             }

             css += `}\n\n`;

             // --- Include @keyframes ---
             // Attempt to get keyframes from the active animation class
             const activeAnimClass = Array.from(logoElement.classList).find(c => c.startsWith('anim-') && c !== 'anim-none');
             if (activeAnimClass) {
                 const keyframeName = activeAnimClass.replace('anim-', '');
                 const keyframesCss = window.getActiveAnimationKeyframes(keyframeName); // Use global func
                 if (keyframesCss) {
                      console.log(`[SM CSS Gen] Including @keyframes for '${keyframeName}'`);
                      css += `/* Keyframes for animation: ${keyframeName} */\n`;
                      css += `${keyframesCss}\n\n`;
                 } else {
                      console.warn(`[SM CSS Gen] Could not find @keyframes for '${keyframeName}'.`);
                      css += `/* @keyframes ${keyframeName} definition missing */\n\n`;
                 }
             }
              // Include keyframes for animated background if active
             if(previewContainer.classList.contains('bg-gradient-animated-css')) {
                 // Add a sample - ensure this matches your actual CSS definition
                 css += `/* Sample @keyframes for animated background */\n`;
                 css += `@keyframes bgAnimateGradient {\n  0% { background-position: 0% 50%; }\n  50% { background-position: 100% 50%; }\n  100% { background-position: 0% 50%; }\n}\n\n`;
             }


             console.log("[SM] CSS Generation successful.");
             return css;

         } catch (e) {
             console.error("Error generating CSS:", e);
             return `/* Error generating CSS: ${e.message}\n${e.stack} */`;
         }
    },

    /** Initializes the state of UI components based on current settings */
    _initializeUIComponentsState() {
        console.log('[SM] Initializing UI component states...');
        // These functions ensure the visibility of controls matches the loaded settings
        this._handleColorModeChange(this._currentSettings.textColorMode);
        this._handleGradientPresetChange(this._currentSettings.gradientPreset);
        this._handleBackgroundTypeChange(this._currentSettings.backgroundType);
        this._handleBackgroundGradientChange(this._currentSettings.backgroundGradientPreset);

        // Update displays linked to settings
        this._updateFontPreview(this._currentSettings.fontFamily);
        this._updateRangeValueDisplays(); // Set initial text for range sliders

        // Ensure the reset button listeners are attached
        this._setupResetButton();
        console.log('[SM] UI component states initialized.');
    },

    /** Update the small font preview span */
    _updateFontPreview(fontFamilyName) {
        const previewSpan = document.getElementById("fontPreview");
        if (previewSpan && fontFamilyName) {
            // Apply the actual font family name to the preview span
            previewSpan.style.fontFamily = `"${fontFamilyName}", sans-serif`;
        } else if (!previewSpan) {
            // console.warn("[SM] Font preview span (#fontPreview) not found."); // Less critical
        }
    },

    /** Setup listeners for the reset confirmation modal */
     _setupResetButton() {
          const resetBtn = document.getElementById('resetBtn');
          // Check if already initialized to prevent duplicate listeners
          if (!resetBtn || resetBtn.dataset.listenerAttached === 'true') return;

          const resetConfirmModal = document.getElementById('resetConfirmModal');
          const resetModalCancel = document.getElementById('resetModalCancel');
          const resetModalConfirm = document.getElementById('resetModalConfirm');

          if (!resetConfirmModal || !resetModalCancel || !resetModalConfirm) {
              console.warn('[SM] Reset modal elements missing. Cannot attach listeners.');
              return;
          }

          // Show modal on button click
          resetBtn.addEventListener('click', () => {
               console.log('[SM] Reset button clicked -> showing modal.');
               resetConfirmModal.style.display = 'flex'; // Use flex for centering
               resetConfirmModal.classList.add('active');
          });

          // Hide modal on Cancel click
          resetModalCancel.addEventListener('click', () => {
               console.log('[SM] Reset modal cancelled.');
               resetConfirmModal.style.display = 'none';
               resetConfirmModal.classList.remove('active');
          });

          // Perform reset on Confirm click
          resetModalConfirm.addEventListener('click', () => {
               const resetType = document.querySelector('input[name="reset-type"]:checked')?.value || 'all';
               console.log(`[SM] Reset modal confirmed. Type: ${resetType}`);
               this.resetSettings(resetType); // Call the reset function
               resetConfirmModal.style.display = 'none';
               resetConfirmModal.classList.remove('active');
          });

          // Hide modal on overlay click
          resetConfirmModal.addEventListener('click', e => {
               if (e.target === resetConfirmModal) {
                    console.log('[SM] Reset modal closed via overlay click.');
                    resetConfirmModal.style.display = 'none';
                    resetConfirmModal.classList.remove('active');
               }
          });

          // Hide modal on Escape key press
          document.addEventListener('keydown', (e) => {
               if (e.key === 'Escape' && resetConfirmModal.classList.contains('active')) {
                    console.log('[SM] Reset modal closed via Escape key.');
                    resetConfirmModal.style.display = 'none';
                    resetConfirmModal.classList.remove('active');
               }
          });

          resetBtn.dataset.listenerAttached = 'true'; // Mark as initialized
          console.log('[SM] Reset button and modal listeners attached.');
     },


    /** Resets settings to default values */
    resetSettings(resetType = 'all') {
        console.log(`[SM] Resetting settings (type: ${resetType}). Applying defaults...`);
        const defaults = this.getDefaults(); // Get deep copy of defaults
        let settingsToApply;

        // Define keys for specific reset types
        const textKeys = ['logoText', 'fontFamily', 'fontSize', 'letterSpacing', 'textCase', 'fontWeight'];
        // Style includes appearance settings + relevant layout/positioning
        const styleKeys = [
            'textColorMode', 'solidColorPicker', 'gradientPreset', 'color1', 'color2', 'useColor3', 'color3',
            'textShadow', 'borderColorPicker', 'borderStyle', 'textAlign', 'rotation', 'animationDirection' // Text gradient direction is style
        ];
         // Background settings
        const backgroundKeys = [
            'backgroundType', 'backgroundColor', 'bgOpacity', 'backgroundGradientPreset', 'bgColor1', 'bgColor2', 'bgGradientDirection'
        ];
        // Animation settings (excluding direction which is in styleKeys)
        const animationKeys = ['textAnimation', 'animationSpeed'];
        // Export/Advanced settings
        const advancedKeys = ['previewSize', 'exportWidth', 'exportHeight', 'exportQuality', 'exportTransparent', 'exportFrames', 'exportFrameRate'];


        if (resetType === 'all') {
            settingsToApply = { ...defaults };
            console.log('[SM Reset] Resetting ALL settings to default.');
        } else {
            // Start with current settings and overwrite specific groups
            settingsToApply = { ...this.getCurrentSettings() }; // Start with deep copy of current
            console.log(`[SM Reset] Resetting only '${resetType}' group...`);

            let keysToReset = [];
            switch(resetType) {
                case 'text': keysToReset = textKeys; break;
                case 'style': keysToReset = [...styleKeys, ...backgroundKeys, ...animationKeys]; break; // Style reset includes bg and anim
                case 'background': keysToReset = backgroundKeys; break;
                case 'animation': keysToReset = animationKeys; settingsToApply['animationDirection'] = defaults['animationDirection']; break; // Reset direction too
                case 'advanced': keysToReset = advancedKeys; break;
                default:
                    console.warn(`[SM Reset] Unknown reset type: '${resetType}'. Resetting all.`);
                    settingsToApply = { ...defaults };
            }

            if (keysToReset.length > 0) {
                 keysToReset.forEach(key => {
                      if (defaults.hasOwnProperty(key)) {
                           settingsToApply[key] = defaults[key];
                      } else {
                           console.warn(`[SM Reset] Default value missing for key: ${key}`);
                      }
                 });
            }
        }

        // Apply the determined settings and force UI update
        this.applySettings(settingsToApply, true) // forceUIUpdate = true
             .then(() => {
                  console.log('[SM] Settings reset applied successfully.');
                  // Use the globally defined notification function (checked in init)
                  if (typeof notifyResetSuccess === 'function') notifyResetSuccess(resetType);
             })
             .catch(err => {
                  console.error("[SM] Error applying reset settings:", err);
                  if (typeof showAlert === 'function') showAlert("Failed to apply reset settings.", "error");
             });
    },

    /** Apply settings object to UI controls and visual styles */
    async applySettings(settings, forceUIUpdate = false, isInitialLoad = false) {
        console.log(`[SM] Applying settings (forceUI: ${forceUIUpdate}, initial: ${isInitialLoad})`);
        // Ensure we have a valid settings object to apply
        const settingsToApply = (typeof settings === 'object' && settings !== null) ? settings : this._currentSettings;
        // Update internal state, merging with defaults to ensure all keys exist
        this._currentSettings = { ...DEFAULT_SETTINGS, ...settingsToApply };

        console.log('[SM] Applying Settings Object:', JSON.stringify(this._currentSettings));

        // --- Update UI Control Values ---
        // This loop sets the value/checked state of the HTML input/select elements
        Object.entries(this._currentSettings).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (!element) {
                 // console.warn(`[SM Apply UI] Element not found for setting key: ${key}`); // Can be noisy
                return;
            }
            try {
                const currentElementValue = (element.type === 'checkbox') ? element.checked : element.value;
                // Coerce new value to string/boolean for comparison and setting
                const newValueFormatted = (element.type === 'checkbox') ? !!value : String(value ?? '');
                const currentValueFormatted = (element.type === 'checkbox') ? currentElementValue : String(currentElementValue);

                // Update element value only if forced, initial load, or value differs
                 if (forceUIUpdate || isInitialLoad || currentValueFormatted !== newValueFormatted) {
                     // console.log(`[SM Apply UI] Updating control '${key}': '${currentValueFormatted}' -> '${newValueFormatted}'`); // Debug log
                     if (element.type === 'checkbox') {
                         element.checked = newValueFormatted;
                     } else {
                         element.value = newValueFormatted;
                     }

                     // If forced update (like reset or random), dispatch an event
                     // to trigger associated listeners (_bind* functions) for immediate style updates.
                     // Avoid dispatching on initial load to prevent redundant updates, as styles are applied below.
                     if (forceUIUpdate && !isInitialLoad) {
                          // Use 'change' for selects/checkboxes/color, 'input' for others
                          const eventType = (element.nodeName === 'SELECT' || element.type === 'checkbox' || element.type === 'color') ? 'change' : 'input';
                           console.log(`[SM Apply UI] Dispatching '${eventType}' event for '${key}' due to force update.`);
                          element.dispatchEvent(new Event(eventType, { bubbles: true }));
                     }
                 }
            } catch (e) {
                 console.warn(`[SM Apply UI] Error applying UI value for ${key}:`, e);
            }
        });

        // --- Apply Visual Styles Directly ---
        // Apply styles directly from settings if it's the initial load or a forced update (like reset/random)
        // This ensures the visual preview matches the settings state immediately.
        if (isInitialLoad || forceUIUpdate) {
            console.log('[SM Apply Styles] Applying visual styles directly from settings...');
            const logoEl = document.querySelector('.logo-text');
            const logoContainer = document.querySelector('.logo-container');
            const previewContainer = document.getElementById('previewContainer');

            if (!logoEl || !previewContainer || !logoContainer) {
                console.error("[SM Apply Styles] Critical elements missing for style application!");
                // Possibly halt or return early if elements are crucial
                 return; // Or throw error?
            }

            // --- Apply styles based on _currentSettings ---
            // Text Content
            logoEl.textContent = this._currentSettings.logoText;
            logoEl.setAttribute('data-text', this._currentSettings.logoText);

            // Font styles
             // Set font family first, then inject
            logoEl.style.fontFamily = `"${this._currentSettings.fontFamily}", sans-serif`;
            await this._injectFontStyle(this._currentSettings.fontFamily, isInitialLoad); // Inject font (await needed)
            logoEl.style.fontSize = `${this._currentSettings.fontSize}px`;
            logoEl.style.letterSpacing = `${this._currentSettings.letterSpacing}em`;
            logoEl.style.textTransform = this._currentSettings.textCase;
            logoEl.style.fontWeight = this._currentSettings.fontWeight; // Apply weight, injectFontStyle should handle variant
            logoEl.style.textAlign = this._currentSettings.textAlign;

            // Color Mode (this handles applying solid color or gradient)
            this._handleColorModeChange(this._currentSettings.textColorMode); // Applies correct fill

            // Effects & Border
            this._applyClassFromSelect(logoEl, this._currentSettings.textShadow, 'text-glow-');
            // Apply border to container
            logoContainer.classList.toggle('dynamic-border', this._currentSettings.borderStyle !== 'border-none');
            this._applyClassFromSelect(logoContainer, this._currentSettings.borderStyle, 'border-');
            document.documentElement.style.setProperty('--dynamic-border-color', this._currentSettings.borderColorPicker);

            // Transform
            logoEl.style.transform = `rotate(${this._currentSettings.rotation}deg)`;

            // Animation
            this._applyClassFromSelect(logoEl, this._currentSettings.textAnimation, 'anim-');
            this._applyAnimationSpeed(this._currentSettings.animationSpeed); // Set duration via CSS var

             // Background (this handles solid, gradient, pattern classes/styles)
             this._handleBackgroundTypeChange(this._currentSettings.backgroundType);
             previewContainer.style.opacity = this._currentSettings.bgOpacity; // Apply opacity

             // Preview Size
             this._applyClassFromSelect(previewContainer, this._currentSettings.previewSize, 'preview-size-');

             // Update range displays to match newly set values
             this._updateRangeValueDisplays();

            console.log('[SM Apply Styles] Visual styles applied directly.');
        }

        // --- Final Trigger ---
        // Always trigger save, listeners, CSS code update after applying settings
        this._triggerSettingsUpdate();
        console.log('[SM] applySettings complete.');
    },

    /** Updates the text content of all range value display spans */
    _updateRangeValueDisplays() {
        // console.log('[SM] Updating range value displays...'); // Can be noisy
        const rangeConfigs = [
            { id: 'letterSpacing', unit: 'em' },
            { id: 'rotation', unit: 'deg' },
            { id: 'animationSpeed', unit: 'x' }, // Special unit 'x' for multiplier
            { id: 'animationDirection', unit: 'deg' },
            { id: 'bgOpacity', unit: '' }, // No unit for opacity
            { id: 'exportQuality', unit: '%' },
            { id: 'exportFrameRate', unit: 'FPS' }, // Custom unit display
            { id: 'bgGradientDirection', unit: 'deg' }
        ];
        rangeConfigs.forEach(config => {
            const input = document.getElementById(config.id);
            if (input) {
                const display = input.parentElement?.querySelector('.range-value-display');
                if (display) {
                     let unitDisplay = '';
                     if (config.unit === 'x') unitDisplay = config.unit;
                     else if (config.unit) unitDisplay = '\u00A0' + config.unit; // Add space before unit

                    display.textContent = input.value + unitDisplay;
                } // else { console.warn(`[SM] Display span not found for range input: ${config.id}`); }
            } // else { console.warn(`[SM] Range input not found: ${config.id}`); }
        });
    },

    // --- Persistence ---

    loadSavedSettings() {
        try {
            const saved = localStorage.getItem('logomakerSettings');
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                // Merge loaded settings with defaults to ensure all keys are present
                // and potentially remove outdated keys from loaded data.
                this._currentSettings = { ...DEFAULT_SETTINGS, ...loadedSettings };
                 // Sanity check: Ensure loaded font exists, otherwise revert to default font
                const fontDropdown = document.getElementById('fontFamily');
                if (fontDropdown && !fontDropdown.querySelector(`option[value="${this._currentSettings.fontFamily}"]`)) {
                    console.warn(`[SM] Loaded font '${this._currentSettings.fontFamily}' not found in dropdown. Reverting to default '${DEFAULT_SETTINGS.fontFamily}'.`);
                    this._currentSettings.fontFamily = DEFAULT_SETTINGS.fontFamily;
                }

                console.log('[SM] Loaded settings from localStorage.');
            } else {
                this._currentSettings = { ...this.getDefaults() }; // Use deep copy of defaults
                console.log('[SM] No saved settings found, using defaults.');
            }
        } catch (err) {
            console.error('[SM] Error loading settings from localStorage:', err);
            this._currentSettings = { ...this.getDefaults() }; // Fallback to deep copy of defaults on error
            if(typeof showAlert === 'function') showAlert('Failed to load saved settings. Using defaults.', 'warning');
        }
    },

    saveCurrentSettings() {
        try {
            localStorage.setItem('logomakerSettings', JSON.stringify(this._currentSettings));
            // console.log('[SM] Settings saved.'); // Reduce console noise
        } catch (err) {
            console.error('[SM] Error saving settings to localStorage:', err);
            // Consider showing an alert only if storage is likely full or critical
             if (err.name === 'QuotaExceededError') {
                 if(typeof showAlert === 'function') showAlert('Could not save settings: Storage quota exceeded.', 'error');
             } else {
                 if(typeof showAlert === 'function') showAlert('Failed to save settings.', 'error');
             }
        }
    },

    // --- Listener Management ---
    addSettingsChangeListener(listener) {
        if (typeof listener === 'function' && !this._listeners.includes(listener)) {
            this._listeners.push(listener);
            console.log('[SM] Settings change listener added.');
        }
    },
    removeSettingsChangeListener(listener) {
        const index = this._listeners.indexOf(listener);
        if (index !== -1) {
            this._listeners.splice(index, 1);
             console.log('[SM] Settings change listener removed.');
        }
    },
};

// --- Global Exposure & Export ---
window.SettingsManager = SettingsManager; // Expose globally for easier access (e.g., console, misc.js, captureTextStyles)
export default SettingsManager; // Export for module usage (e.g., main.js)

console.log("[SettingsManager] Module loaded (v13 Merged). Ready for initialization via init().");

// --- Helper function used internally by _generateCSSCode ---
function getPrimaryFontFamily(fontFamilyString) {
    if (!fontFamilyString || typeof fontFamilyString !== 'string') return 'sans-serif';
    // Split by comma, take the first part, trim whitespace, remove surrounding quotes
    return fontFamilyString.split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'sans-serif';
}