/**
 * settingsManager.js (Version 17.0 - With Enhanced Border Handling)
 * =========================================================================
 * Manages UI state, applies styles via CSS classes & CSS Variables,
 * handles settings persistence (localStorage), and interacts with fontManager.js.
 * Includes support for various text/border effects, gradients, animations,
 * border radius, border padding, and consistent class application for exports.
 *
 * @module SettingsManager
 * @requires fontManager.js (expects `getFontDataAsync` function to be globally available)
 * @requires cssUtils.js (optional, provides `CSSUtils.applyBorderRadius`, `CSSUtils.applyBorderPadding`, `CSSUtils.extractRGB`)
 * @listens input Event on various input/range elements
 * @listens change Event on various select/checkbox/color elements
 * @fires settings-update - Custom event or listener notification when settings change (via `_triggerSettingsUpdate`)
 */

// --- Constants for CSS Class Prefixes ---
// These prefixes ensure CSS classes applied by the manager don't conflict and can be easily removed/managed.
const FONT_FAMILY_CLASS_PREFIX = 'font-family-';
const FONT_WEIGHT_CLASS_PREFIX = 'font-weight-';
const TEXT_ALIGN_CLASS_PREFIX = 'text-align-';
const TEXT_CASE_CLASS_PREFIX = 'text-case-';
const TEXT_EFFECT_CLASS_PREFIX = 'text-effect-'; // Unified prefix for all text effects (glows, shadows, etc.)
const BORDER_STYLE_CLASS_PREFIX = 'border-style-'; // Prefix for static border styles (solid, dashed, etc.)
const BORDER_EFFECT_CLASS_PREFIX = 'border-effect-'; // Prefix for dynamic/animated border effects (glow, pulse, etc.)
const BORDER_RADIUS_CLASS_PREFIX = 'border-radius-'; // Prefix for border radius classes (sm, md, circle, etc.)
const ANIMATION_CLASS_PREFIX = 'anim-'; // Prefix for text animation classes
const PREVIEW_SIZE_CLASS_PREFIX = 'preview-size-'; // Prefix for preview container size classes
const BACKGROUND_CLASS_PREFIX = 'bg-'; // Prefix for background type/pattern classes

// --- Default Settings ---
/**
 * Default configuration values for all settings managed by SettingsManager.
 * Used for initial state and resetting.
 * @const {object} DEFAULT_SETTINGS
 */
const DEFAULT_SETTINGS = {
    logoText: 'Manic',
    fontFamily: 'Orbitron', // Default Font
    fontSize: '100', // Applied via CSS var --dynamic-font-size
    letterSpacing: '0.03', // Applied via CSS var --dynamic-letter-spacing
    textCase: 'none', // Maps to text-case-none class
    fontWeight: '700', // Maps to font-weight-700 class
    textColorMode: 'gradient', // 'solid' or 'gradient'
    solidColorPicker: '#ffffff', // Color for solid mode
    gradientPreset: 'primary-gradient', // Name of gradient preset or 'custom'
    color1: '#FF1493', color2: '#8A2BE2', useColor3: false, color3: '#FF4500', // Custom gradient colors
    // *** Values below for dropdowns MUST match <option value="..."> in index.html ***
    textShadow: 'text-effect-none', // Dropdown VALUE, maps to a TEXT_EFFECT_CLASS_PREFIX class via TEXT_EFFECT_MAP
    borderColorPicker: '#ffffff', // Applied via CSS var --dynamic-border-color
    borderStyle: 'border-none', // Dropdown VALUE, maps to BORDER_STYLE_ or BORDER_EFFECT_ class via BORDER_STYLE_MAP
    borderWidth: '2', // Applied via CSS var --dynamic-border-width
    borderRadius: 'none', // Dropdown VALUE (none, rounded-sm, pill, etc.), maps via BORDER_RADIUS_MAP
    borderPadding: '10', // Border padding in pixels, applied via CSS var --dynamic-border-padding
    textAlign: 'center', // Maps to text-align-center class
    rotation: '0', // Applied via CSS var --dynamic-rotation
    textAnimation: 'anim-none', // Dropdown VALUE, maps directly to anim-* class
    animationSpeed: '1', // Multiplier, sets CSS var --animation-duration
    animationDirection: '45', // Text gradient angle, sets CSS var --gradient-direction
    backgroundType: 'bg-solid', // 'bg-solid', 'bg-transparent', 'bg-gradient-*', 'bg-pattern-*'
    backgroundColor: '#000000', // Solid background color
    bgOpacity: '1', // Applied directly to preview container's opacity style
    backgroundGradientPreset: 'bg-primary-gradient', // Name of background gradient preset or 'custom'
    bgColor1: '#3a1c71', bgColor2: '#ffaf7b', // Custom background gradient colors
    bgGradientDirection: '90', // Background gradient angle, sets CSS var --bg-gradient-direction
    previewSize: 'preview-size-medium', // Maps to preview-size-* class
    // Export settings (not directly applied to preview, used by export module)
    exportWidth: '800', exportHeight: '400', exportQuality: '95',
    exportTransparent: false, exportFrames: '15', exportFrameRate: '10'
};

// --- Mapping for Border Style Classes ---
/**
 * Maps the `value` attribute from the border style dropdown to specific CSS classes.
 * This allows using user-friendly values in the HTML while applying consistent, prefixed classes.
 * Includes both static border styles and dynamic border effects.
 * @const {object.<string, string>} BORDER_STYLE_MAP
 */
const BORDER_STYLE_MAP = {
    // Static styles
    'border-none': 'border-style-none',
    'border-solid': 'border-style-solid',
    'border-double': 'border-style-double',
    'border-dashed': 'border-style-dashed',
    'border-dotted': 'border-style-dotted',
    'border-groove': 'border-style-groove',
    'border-ridge': 'border-style-ridge',
    'border-inset': 'border-style-inset',
    'border-outset': 'border-style-outset',
    'border-pixel': 'border-style-pixel',
    'border-thick': 'border-style-thick',

    // Effect styles (start with BORDER_EFFECT_CLASS_PREFIX)
    'border-glow': 'border-effect-glow-soft',
    'border-neon': 'border-effect-neon-animated',
    'border-pulse': 'border-effect-glow-pulse',
    'border-gradient': 'border-effect-gradient-animated'
};

// --- Mapping for Text Effect Classes ---
/**
 * Maps the `value` attribute from the text effect/shadow dropdown to specific CSS classes.
 * Consolidates different effect types (glows, shadows, outlines, blends) under a single prefix.
 * @const {object.<string, string>} TEXT_EFFECT_MAP
 */
const TEXT_EFFECT_MAP = {
    // None values from potential legacy dropdowns map to the unified 'none' class
    'text-glow-none': 'text-effect-none',
    'text-shadow-none': 'text-effect-none',
    'text-effect-none': 'text-effect-none',

    // Glows
    'text-glow-soft': 'text-effect-glow-soft',
    'text-glow-medium': 'text-effect-glow-medium',
    'text-glow-strong': 'text-effect-glow-strong',
    'text-glow-sharp': 'text-effect-glow-sharp',
    'text-glow-neon': 'text-effect-neon-primary',

    // Shadows
    'text-shadow-soft': 'text-effect-shadow-soft-md',
    'text-glow-hard': 'text-effect-shadow-hard-md', // Legacy mapping? Ensure class exists
    'text-shadow-hard-sm': 'text-effect-shadow-hard-sm',
    'text-shadow-hard-md': 'text-effect-shadow-hard-md',
    'text-shadow-hard-lg': 'text-effect-shadow-hard-lg',
    'text-shadow-hard-xl': 'text-effect-shadow-hard-xl',

    // Outlines & Special
    'text-glow-outline': 'text-effect-outline-thin',
    'text-glow-retro': 'text-effect-shadow-retro',
    'text-glow-emboss': 'text-effect-emboss',
    'text-glow-inset': 'text-effect-inset',

    // Blend modes
    'text-effect-blend-screen': 'text-effect-blend-screen',
    'text-effect-blend-multiply': 'text-effect-blend-multiply',
    'text-effect-blend-overlay': 'text-effect-blend-overlay',
    'text-effect-blend-difference': 'text-effect-blend-difference'
};

// --- Mapping for Border Radius Classes ---
/**
 * Maps the `value` attribute from the border radius dropdown to specific CSS classes.
 * @const {object.<string, string>} BORDER_RADIUS_MAP
 */
const BORDER_RADIUS_MAP = {
    'none': 'border-radius-none',
    'square': 'border-radius-none', // Alias for none
    'rounded-sm': 'border-radius-sm',
    'rounded-md': 'border-radius-md',
    'rounded-lg': 'border-radius-lg',
    'pill': 'border-radius-pill',
    'circle': 'border-radius-circle',
    'oval': 'border-radius-oval'
    // 'custom' is handled implicitly by _applyBorderRadius when a map entry isn't found
};

// --- SettingsManager Object ---
/**
 * Main object managing application settings and their visual application.
 * Follows a Singleton-like pattern, assuming one instance is created and used.
 * @namespace SettingsManager
 */
const SettingsManager = {
    /** @private @type {object} Holds the current state of all settings */
    _currentSettings: {},
    /** @private @type {Array<Function>} Array of listener functions to call on settings change */
    _listeners: [],
    /** @private @type {boolean} Flag indicating if initialization is complete */
    _isInitialized: false,
    /** @private @type {?HTMLElement} Cached reference to the main logo text element */
    _logoElement: null,
    /** @private @type {?HTMLElement} Cached reference to the logo container element (for border/padding) */
    _logoContainer: null,
    /** @private @type {?HTMLElement} Cached reference to the main preview area container */
    _previewContainer: null,

    // --- Getters ---
    /**
     * Returns a deep copy of the default settings.
     * @returns {object} A deep copy of DEFAULT_SETTINGS.
     */
    getDefaults() {
        try {
            // structuredClone is the modern, preferred way for deep copies
            return structuredClone(DEFAULT_SETTINGS);
        } catch (e) {
            // Fallback for environments where structuredClone might not be available
            console.warn("[SM] structuredClone not available, using JSON fallback for getDefaults().");
            return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
    },

    /**
     * Returns a deep copy of the current settings state.
     * @returns {object} A deep copy of the internal _currentSettings.
     */
    getCurrentSettings() {
        try {
            return structuredClone(this._currentSettings);
        } catch (e) {
            console.warn("[SM] structuredClone not available, using JSON fallback for getCurrentSettings().");
            return JSON.parse(JSON.stringify(this._currentSettings));
        }
    },

    // --- Initialization ---
    /**
     * Initializes the SettingsManager.
     * Caches DOM elements, checks dependencies, loads saved settings,
     * sets up event listeners, applies initial styles, and initializes UI state.
     * Should only be called once.
     * @async
     * @returns {Promise<void>} Resolves when initialization is complete or rejects on critical failure.
     */
    async init() {
        if (this._isInitialized) {
            console.warn('[SM] Already initialized.');
            return;
        }
        console.log('[SM] Initialize (v17.0 - Enhanced with improved border handling)...');

        // Cache essential DOM elements
        this._logoElement = document.querySelector('.logo-text');
        this._logoContainer = document.querySelector('.logo-container');
        this._previewContainer = document.getElementById('previewContainer');
        if (!this._logoElement || !this._logoContainer || !this._previewContainer) {
            console.error("[SM CRITICAL] Core preview elements (.logo-text, .logo-container, #previewContainer) missing! Aborting init.");
            return Promise.reject(new Error("Missing core preview elements.")); // Indicate failure
        }

        // Check critical dependencies (fontManager)
        if (typeof getFontDataAsync !== 'function') {
            console.error("[SM CRITICAL] `getFontDataAsync` function not found! Ensure fontManager.js is loaded before settingsManager.js.");
            return Promise.reject(new Error("Missing dependency: getFontDataAsync")); // Indicate failure
        }

        // Check optional dependencies (CSSUtils)
        if (!window.CSSUtils) {
            console.warn("[SM] CSSUtils not found! Advanced border radius/padding features may use fallback styles.");
        }

        try {
            console.log('[SM] Assuming Font Manager is already initialized.');
            this.loadSavedSettings(); // Load settings from localStorage or use defaults
            this._setupEventListeners(); // Bind listeners to UI controls
            console.log('[SM] Applying initial settings...');
            // Apply loaded settings visually, forcing UI update on initial load
            await this.applySettings(this._currentSettings, true, true);
            this._initializeUIComponentsState(); // Set initial visibility/state of related controls
            this._isInitialized = true;
            console.log('[SM] Initialization complete.');
        } catch (error) {
            console.error("[SM] Initialization failed during setup:", error);
            if (typeof showAlert === 'function') { // Optional global alert function
                showAlert(`Initialization Error: ${error.message}`, 'error');
            }
            return Promise.reject(error); // Propagate the error
        }
    },

    /**
     * Sets up event listeners for all relevant UI controls (inputs, selects, checkboxes, etc.).
     * Uses helper methods (`_bind*Listener`) for different input types.
     * @private
     */
    _setupEventListeners() {
        console.log('[SM] Setting up event listeners...');
        // Basic check for a core element to prevent errors if called too early
        if (!document.getElementById('logoText')) {
            console.error("[SM] Cannot find #logoText input during listener setup. Ensure DOM is ready.");
            return;
        }

        // Bind listeners to corresponding element IDs
        this._bindInputListener('logoText');
        this._bindSelectListener('fontFamily');
        this._bindSelectListener('textCase');
        this._bindSelectListener('fontWeight');
        this._bindSelectListener('textColorMode');
        this._bindSelectListener('gradientPreset');
        this._bindSelectListener('textShadow');
        this._bindSelectListener('borderStyle');
        this._bindSelectListener('borderRadius');
        this._bindSelectListener('textAlign');
        this._bindSelectListener('textAnimation');
        this._bindSelectListener('backgroundType');
        this._bindSelectListener('backgroundGradientPreset');
        this._bindSelectListener('previewSize');
        this._bindNumberInputListener('fontSize', '--dynamic-font-size', 'px');
        this._bindNumberInputListener('borderWidth', '--dynamic-border-width', 'px');
        this._bindNumberInputListener('borderPadding', '--dynamic-border-padding', 'px');
        this._bindRangeInputListener('letterSpacing', '--dynamic-letter-spacing', 'em');
        this._bindRangeInputListener('rotation', '--dynamic-rotation', 'deg');
        this._bindRangeInputListener('animationSpeed'); // Special handling via _applyAnimationSpeed
        this._bindRangeInputListener('animationDirection', '--gradient-direction', 'deg'); // Controls text gradient angle
        this._bindRangeInputListener('bgGradientDirection', '--bg-gradient-direction', 'deg'); // Controls background gradient angle
        this._bindRangeInputListener('bgOpacity'); // Directly sets style
        this._bindColorInputListener('solidColorPicker'); // Handled by _applySolidTextColor
        this._bindColorInputListener('color1'); // Handled by _applyGradientToLogo
        this._bindColorInputListener('color2'); // Handled by _applyGradientToLogo
        this._bindColorInputListener('color3'); // Handled by _applyGradientToLogo
        this._bindColorInputListener('borderColorPicker', '--dynamic-border-color'); // Sets CSS var
        this._bindColorInputListener('backgroundColor'); // Handled by _applySolidBgColor
        this._bindColorInputListener('bgColor1'); // Handled by _applyBackgroundGradient
        this._bindColorInputListener('bgColor2'); // Handled by _applyBackgroundGradient
        this._bindCheckboxListener('useColor3'); // Toggles visibility and updates gradient
        this._bindCheckboxListener('exportTransparent'); // Export setting only
        this._bindNumberInputListener('exportWidth'); // Export setting only
        this._bindNumberInputListener('exportHeight'); // Export setting only
        this._bindRangeInputListener('exportQuality'); // Export setting only
        this._bindNumberInputListener('exportFrames'); // Export setting only
        this._bindRangeInputListener('exportFrameRate'); // Export setting only

        console.log('[SM] Event listeners setup done.');
    },

    /**
     * Updates the text content of all associated range value display spans
     * (the small text showing '10px', '5deg', etc., next to sliders).
     * @private
     */
    _updateRangeValueDisplays() {
        const rangeConfigs = [
            { id: 'letterSpacing', unit: 'em' },
            { id: 'rotation', unit: 'deg' },
            { id: 'animationSpeed', unit: 'x' }, // Special unit handling
            { id: 'animationDirection', unit: 'deg' },
            { id: 'bgOpacity', unit: '' }, // No unit
            { id: 'exportQuality', unit: '%' },
            { id: 'exportFrameRate', unit: 'FPS' }, // Special unit handling
            { id: 'bgGradientDirection', unit: 'deg' }
        ];
        rangeConfigs.forEach(config => {
            const input = document.getElementById(config.id);
            if (input) {
                // Find the display span, typically a sibling or child of parent
                const display = input.parentElement?.querySelector('.range-value-display');
                if (display) {
                    let unitDisplay = '';
                    // Handle special units differently for spacing/clarity
                    if (config.unit === 'x') unitDisplay = config.unit; // '1x'
                    else if (config.unit === 'FPS') unitDisplay = '\u00A0' + config.unit; // Non-breaking space + FPS
                    else if (config.unit) unitDisplay = config.unit; // 'em', 'deg', '%'

                    const value = input.value ?? ''; // Handle potential null/undefined value
                    display.textContent = value + unitDisplay;
                }
            }
        });
    },

    // --- Listener Binder Functions ---
    // These functions encapsulate the logic for binding listeners to specific types of controls.

    /**
     * Binds an 'input' event listener to a standard text input element.
     * Updates the corresponding setting in `_currentSettings`.
     * Handles specific logic for `logoText` updates.
     * @private
     * @param {string} inputId - The ID of the input element.
     */
    _bindInputListener(inputId) {
        const input = document.getElementById(inputId);
        if (!input) {
             console.warn(`[SM Bind] Input element #${inputId} not found.`);
             return;
        }

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this._currentSettings[inputId] = value;

            // Special handling for the main logo text input
            if (inputId === 'logoText' && this._logoElement) {
                this._logoElement.textContent = value;
                // Keep data-text attribute synced for CSS effects that use it (e.g., ::before/::after content)
                this._logoElement.setAttribute('data-text', value);
                this._updateSizeIndicator(); // Text change affects size
            }
            this._triggerSettingsUpdate(); // Notify listeners and save
        });
    },

    /**
     * Binds a 'change' event listener to a select (dropdown) element.
     * Updates the corresponding setting and calls specific style application methods based on the select ID.
     * @private
     * @param {string} selectId - The ID of the select element.
     */
    _bindSelectListener(selectId) {
        const select = document.getElementById(selectId);
        if (!select) {
             console.warn(`[SM Bind] Select element #${selectId} not found.`);
             return;
        }

        select.addEventListener('change', async (e) => {
            const value = e.target.value;
            console.log(`[SM Select] #${selectId} changed to: '${value}'`);
            this._currentSettings[selectId] = value;

            // Dispatch to specific style application functions based on the control's ID
            switch (selectId) {
                case 'fontFamily':
                    await this._applyFontFamily(value); // Async font loading
                    this._updateFontPreview(value); // Update simple preview in dropdown
                    break;
                case 'fontWeight':
                    this._applyFontWeight(value);
                    break;
                case 'textAlign':
                    this._applyTextAlign(value);
                    break;
                case 'textCase':
                    this._applyTextCase(value);
                    break;
                case 'textShadow': // Consolidated text effect handler
                    this._applyTextEffect(value);
                    break;
                case 'borderStyle':
                    this._applyBorderStyle(value);
                    break;
                case 'borderRadius':
                    this._applyBorderRadius(value);
                    break;
                case 'textAnimation':
                    this._applyTextAnimation(value);
                    break;
                case 'previewSize':
                    this._applyPreviewSize(value);
                    break;
                // Handlers that manage UI visibility AND apply styles
                case 'textColorMode':
                    this._handleColorModeChange(value);
                    break;
                case 'gradientPreset':
                    this._handleGradientPresetChange(value);
                    break;
                case 'backgroundType':
                    this._handleBackgroundTypeChange(value);
                    break;
                case 'backgroundGradientPreset':
                    this._handleBackgroundGradientChange(value);
                    break;
                default:
                    // This case handles settings that don't have direct visual application
                    // or are handled elsewhere (like export settings).
                    console.log(`[SM] Select change for #${selectId} noted, no direct style action.`);
            }
            this._triggerSettingsUpdate(); // Notify listeners and save
        });
    },

    /**
     * Binds an 'input' event listener to a number input element.
     * Updates the setting and optionally sets a CSS variable.
     * Handles specific logic for font size, border width, and border padding updates.
     * @private
     * @param {string} inputId - The ID of the number input element.
     * @param {?string} [cssVar=null] - The CSS variable name to update (e.g., '--dynamic-font-size').
     * @param {string} [unit=''] - The unit to append to the value when setting the CSS variable (e.g., 'px', 'em').
     */
    _bindNumberInputListener(inputId, cssVar = null, unit = '') {
        const input = document.getElementById(inputId);
        if (!input) {
             console.warn(`[SM Bind] Number input element #${inputId} not found.`);
             return;
        }

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            // Ensure value stored is always a string, consistent with defaults
            this._currentSettings[inputId] = String(value);

            if (cssVar) {
                // Apply the value to the CSS variable on the root element
                document.documentElement.style.setProperty(cssVar, `${value}${unit}`);

                // Specific updates triggered by certain variables
                if (cssVar === '--dynamic-font-size') {
                    this._updateSizeIndicator(); // Font size change affects layout
                }
                 else if (cssVar === '--dynamic-border-width') {
                    // Re-apply border style to ensure effects using border-width are updated correctly
                    if (this._currentSettings.borderStyle && this._currentSettings.borderStyle !== 'border-none') {
                        this._applyBorderStyle(this._currentSettings.borderStyle);
                    }
                } else if (cssVar === '--dynamic-border-padding') {
                    // This variable is set here, but the padding is applied via the _applyBorderPadding helper
                    // Called by _applyBorderStyle or directly if needed.
                    // This ensures consistent application via CSSUtils or fallback.
                     this._applyBorderPadding(value, unit);
                }
            }
            // If no cssVar, it's likely an export setting - no direct visual update needed here.

            this._triggerSettingsUpdate(); // Notify listeners and save
        });
    },

    /**
     * Binds an 'input' event listener to a range input (slider) element.
     * Updates the setting, updates the associated display span, and optionally sets a CSS variable or calls a specific handler.
     * @private
     * @param {string} inputId - The ID of the range input element.
     * @param {?string} [cssVar=null] - The CSS variable name to update.
     * @param {string} [unit=''] - The unit for the CSS variable and display span.
     */
    _bindRangeInputListener(inputId, cssVar = null, unit = '') {
         const input = document.getElementById(inputId);
         if (!input) {
             console.warn(`[SM Bind] Range input element #${inputId} not found.`);
             return;
         }

         const display = input.parentElement?.querySelector('.range-value-display');
         // Helper function to update the visual display next to the slider
         const updateDisplay = (val) => {
             if(display) {
                 let unitDisplay = '';
                 if (unit === 'x') unitDisplay = unit; // '1x'
                 else if (unit === 'FPS') unitDisplay = '\u00A0' + unit; // Space + FPS
                 else if (unit) unitDisplay = unit; // 'em', 'deg', '%'
                 display.textContent = val + unitDisplay;
             }
         };

         input.addEventListener('input', (e) => {
             const value = e.target.value;
             this._currentSettings[inputId] = String(value); // Store as string
             updateDisplay(value); // Update visual display immediately

             if (cssVar) {
                 document.documentElement.style.setProperty(cssVar, `${value}${unit}`);
                 if (cssVar === '--dynamic-letter-spacing') {
                     this._updateSizeIndicator(); // Letter spacing affects layout
                 }
                 // Gradient direction vars handled below
             }
             // Handle settings that don't map directly to a single CSS var
             else if (inputId === 'animationSpeed') {
                 this._applyAnimationSpeed(value);
             } else if (inputId === 'animationDirection') {
                 // This directly sets the gradient direction variable
                 document.documentElement.style.setProperty('--gradient-direction', `${value}deg`);
                 // If currently in gradient mode, re-apply the gradient to reflect the new angle
                 if (this._currentSettings.textColorMode === 'gradient') {
                     this._applyGradientToLogo();
                 }
             } else if (inputId === 'bgGradientDirection') {
                 document.documentElement.style.setProperty('--bg-gradient-direction', `${value}deg`);
                 if (this._currentSettings.backgroundType?.includes('gradient')) {
                     this._applyBackgroundGradient();
                 }
             } else if (inputId === 'bgOpacity') {
                 if (this._previewContainer) {
                     this._previewContainer.style.opacity = value;
                 }
             }
             // If no cssVar and not handled above, likely an export setting.

             this._triggerSettingsUpdate(); // Notify listeners and save
         });
    },

    /**
     * Binds a 'change' event listener to a checkbox input element.
     * Updates the setting and handles specific logic (like toggling UI visibility).
     * @private
     * @param {string} checkboxId - The ID of the checkbox element.
     */
    _bindCheckboxListener(checkboxId) {
         const checkbox = document.getElementById(checkboxId);
         if (!checkbox) {
             console.warn(`[SM Bind] Checkbox element #${checkboxId} not found.`);
             return;
         }

         checkbox.addEventListener('change', (e) => {
             const isChecked = e.target.checked;
             this._currentSettings[checkboxId] = isChecked; // Store boolean value

             // Specific actions based on checkbox ID
             if (checkboxId === 'useColor3') {
                 // Show/hide the third color picker control
                 document.getElementById('color3Control')?.classList.toggle('hidden', !isChecked);
                 // Re-apply gradient if active and custom
                 if (this._currentSettings.textColorMode === 'gradient' && this._currentSettings.gradientPreset === 'custom') {
                     this._applyGradientToLogo();
                 }
                 console.log(`[SM] Toggled useColor3: ${isChecked}`);
             } else if (checkboxId === 'exportTransparent') {
                  console.log(`[SM] Toggled exportTransparent: ${isChecked}`);
                  // No visual change needed, only affects export process
             }

             this._triggerSettingsUpdate(); // Notify listeners and save
         });
    },

    /**
     * Binds an 'input' event listener to a color input element.
     * Updates the setting and either sets a CSS variable or calls a specific color application function.
     * Handles setting `--dynamic-border-color-rgb` for effects.
     * @private
     * @param {string} inputId - The ID of the color input element.
     * @param {?string} [cssVar=null] - The CSS variable name to update (e.g., '--dynamic-border-color').
     */
    _bindColorInputListener(inputId, cssVar = null) {
         const input = document.getElementById(inputId);
         if (!input) {
             console.warn(`[SM Bind] Color input element #${inputId} not found.`);
             return;
         }

         input.addEventListener('input', (e) => {
             const value = e.target.value; // Color value (e.g., #RRGGBB)
             this._currentSettings[inputId] = value;

             if (cssVar) {
                 // Directly set the main color variable
                 document.documentElement.style.setProperty(cssVar, value);

                 // Special handling for border color: also set RGB components var used by effects
                 if (cssVar === '--dynamic-border-color') {
                     let rgbValue = "255, 255, 255"; // Default white
                     try {
                         // Use CSSUtils helper if available for robust conversion
                         if (window.CSSUtils && typeof window.CSSUtils.extractRGB === 'function') {
                             rgbValue = window.CSSUtils.extractRGB(value);
                         } else {
                             // Use internal fallback if CSSUtils is missing
                             rgbValue = this._extractColorRGB(value);
                         }
                     } catch (err) {
                         console.error(`[SM] Error extracting RGB from ${value}:`, err);
                     }
                     document.documentElement.style.setProperty('--dynamic-border-color-rgb', rgbValue);

                     // Re-apply border style to ensure effects using the color are updated
                     if (this._currentSettings.borderStyle && this._currentSettings.borderStyle !== 'border-none') {
                         this._applyBorderStyle(this._currentSettings.borderStyle);
                     }
                 }
             } else {
                 // If no CSS var, handle based on the color input's role
                 switch (inputId) {
                     case 'solidColorPicker':
                         if (this._currentSettings.textColorMode === 'solid') {
                             this._applySolidTextColor(value);
                         }
                         break;
                     case 'color1': case 'color2': case 'color3':
                         // Apply only if text color mode is gradient and preset is custom
                         if (this._currentSettings.textColorMode === 'gradient' && this._currentSettings.gradientPreset === 'custom') {
                             this._applyGradientToLogo();
                         }
                         break;
                     case 'backgroundColor':
                         if (this._currentSettings.backgroundType === 'bg-solid') {
                             this._applySolidBgColor(value);
                         }
                         break;
                     case 'bgColor1': case 'bgColor2':
                         // Apply only if background type is gradient and preset is custom
                         if (this._currentSettings.backgroundType?.includes('gradient') && this._currentSettings.backgroundGradientPreset === 'custom') {
                             this._applyBackgroundGradient();
                         }
                         break;
                 }
             }

             this._triggerSettingsUpdate(); // Notify listeners and save
         });
    },

    /**
     * Simple fallback function to extract R, G, B values from a hex color string.
     * Used if CSSUtils.extractRGB is not available.
     * @private
     * @param {string} color - The color string (e.g., '#ff0000', '#f00').
     * @returns {string} The color components as a string "R, G, B" (e.g., "255, 0, 0"). Returns "255, 255, 255" on failure.
     */
    _extractColorRGB(color) {
        const defaultRgb = "255, 255, 255"; // White fallback
        if (!color || typeof color !== 'string') return defaultRgb;

        // Handle hex colors (#RGB, #RRGGBB)
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            let r, g, b;

            if (hex.length === 3) { // Expand #RGB to #RRGGBB
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            } else {
                return defaultRgb; // Invalid hex length
            }

            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                 return defaultRgb; // Parsing failed
            }
            return `${r}, ${g}, ${b}`;
        }

        // Handle basic rgb(R, G, B) strings
        if (color.toLowerCase().startsWith('rgb(')) {
            const match = color.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
            if (match && match.length === 4) {
                return `${match[1]}, ${match[2]}, ${match[3]}`;
            }
        }

        // Add rgba support if needed in the future

        console.warn(`[SM Fallback] Could not parse color '${color}' for RGB. Returning default.`);
        return defaultRgb; // Fallback for unhandled formats
    },

    // --- Core Style Application Logic ---
    // These methods directly manipulate CSS classes or styles on the preview elements.

    /**
     * Applies the specified font family to the logo element.
     * Handles asynchronous loading via `getFontDataAsync`, displays loading/success/error toasts,
     * applies the correct CSS class, and manages fallback states.
     * @private
     * @async
     * @param {string} fontFamily - The name of the font family to apply (should match `familyName` from font data).
     * @returns {Promise<void>} Resolves when the font application attempt is complete.
     * @throws {Error} Throws an error internally if font data is null/undefined (caught by the function's catch block).
     */
    async _applyFontFamily(fontFamily) {
        if (!this._logoElement) {
            console.error("[SM ApplyFont] Logo element not found.");
            return;
        }
        if (!fontFamily) {
            console.warn("[SM ApplyFont] No font family specified.");
            // Optionally apply default or clear font class here
             this._applyClass(this._logoElement, 'font-family-fallback', FONT_FAMILY_CLASS_PREFIX);
            return;
        }

        console.log(`[SM] Applying Font Family: ${fontFamily}`);

        // Show loading indicator class on the text element itself
        this._applyClass(this._logoElement, 'font-loading', FONT_FAMILY_CLASS_PREFIX);

        // Add font loading notification toast
        const fontLoadingToast = document.createElement('div');
        fontLoadingToast.className = 'logo-toast font-loading-toast info'; // Start as info
        // Basic toast structure (adapt icons/styles as needed in your CSS)
        fontLoadingToast.innerHTML = `
            <div class="toast-icon"></div>
            <div class="toast-content">
                <div class="toast-message">Loading font "${fontFamily}"...</div>
                <div class="loading-progress"><div class="loading-bar"></div></div>
            </div>
        `;
        document.body.appendChild(fontLoadingToast);

        // Animate in toast (simple fade-in/slide-in via CSS class)
        requestAnimationFrame(() => { // Double rAF ensures transition triggers
            requestAnimationFrame(() => {
                fontLoadingToast.classList.add('show');
            });
        });

        try {
            // Attempt to get font data from the font manager
            const fontData = await getFontDataAsync(fontFamily);

            if (fontData) {
                // --- Success Path ---
                // Sanitize the font name for use in a CSS class
                const className = this._sanitizeForClassName(fontFamily);
                // Apply the specific font family class, removing others with the same prefix
                this._applyClass(this._logoElement, FONT_FAMILY_CLASS_PREFIX + className, FONT_FAMILY_CLASS_PREFIX);
                // Display license info if provided in the font data
                this._displayLicenseInfo(fontData.licenseText);
                // Re-apply the currently selected font weight to ensure it matches the new font
                this._applyFontWeight(this._currentSettings.fontWeight);

                // Update toast to success state
                fontLoadingToast.querySelector('.toast-message').textContent = `Font "${fontFamily}" loaded.`;
                // Replace progress bar with success icon (adjust SVG as needed)
                fontLoadingToast.querySelector('.loading-progress').innerHTML =
                    '<svg class="success-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                fontLoadingToast.classList.remove('info');
                fontLoadingToast.classList.add('success');
            } else {
                // --- Failure Path (Font Data Not Found) ---
                // This happens if getFontDataAsync resolves but returns null/undefined
                // Throw an error here to be caught by the catch block below
                throw new Error(`Font data null or undefined returned for ${fontFamily}`);
            }
        } catch (err) {
            // --- Error Handling Path ---
            // Catches errors from getFontDataAsync or the 'throw' above
            console.error(`[SM] Error setting font family ${fontFamily}. Applying fallback.`, err);
            // Apply a generic fallback font class
            this._applyClass(this._logoElement, 'font-family-fallback', FONT_FAMILY_CLASS_PREFIX);
            // Clear any previous license info
            this._displayLicenseInfo(null);
            // Apply the default font weight, as the current might not be valid for fallback
            this._applyFontWeight(DEFAULT_SETTINGS.fontWeight);

            // Update toast to error state
            const errMsg = err.message.includes('null or undefined') ? `Could not load font "${fontFamily}".` : `Error loading "${fontFamily}".`;
            fontLoadingToast.querySelector('.toast-message').textContent = `${errMsg} Using fallback.`;
            fontLoadingToast.classList.remove('info');
            fontLoadingToast.classList.add('error');
        } finally {
            // --- Cleanup Path (Always Runs) ---
            // Remove the loading class from the logo element
            if (this._logoElement) this._logoElement.classList.remove('font-loading');
            // Update the size indicator as the font change likely affects dimensions
            this._updateSizeIndicator();

            // Remove the toast after a delay
            setTimeout(() => {
                fontLoadingToast.classList.remove('show'); // Animate out
                // Remove element from DOM after transition ends
                fontLoadingToast.addEventListener('transitionend', () => {
                    if (fontLoadingToast.parentNode) {
                        fontLoadingToast.parentNode.removeChild(fontLoadingToast);
                    }
                }, { once: true });
            }, 2500); // Adjust delay as needed
        }
    },

    /**
     * Applies the specified font weight using CSS classes.
     * Assumes CSS classes like `.font-weight-400`, `.font-weight-700` exist.
     * @private
     * @param {(string|number)} weight - The font weight value (e.g., '400', 700).
     */
    _applyFontWeight(weight) {
        if (!this._logoElement || weight === null || weight === undefined) return;
        // Apply the class, removing any others with the same prefix
        this._applyClass(this._logoElement, FONT_WEIGHT_CLASS_PREFIX + weight, FONT_WEIGHT_CLASS_PREFIX);
        // No console log here as it's often called immediately after _applyFontFamily
    },

    /**
     * Applies text alignment (left, center, right) using CSS classes.
     * Assumes classes like `.text-align-center` exist.
     * @private
     * @param {string} align - The alignment value ('left', 'center', 'right').
     */
    _applyTextAlign(align) {
        if (!this._logoElement || !align) return;
        this._applyClass(this._logoElement, TEXT_ALIGN_CLASS_PREFIX + align, TEXT_ALIGN_CLASS_PREFIX);
    },

    /**
     * Applies text case transformation (uppercase, lowercase, none) using CSS classes.
     * Assumes classes like `.text-case-uppercase` exist.
     * Also updates size indicator as case changes affect layout.
     * @private
     * @param {string} textCase - The text case value ('none', 'uppercase', 'lowercase', 'capitalize').
     */
    _applyTextCase(textCase) {
        if (!this._logoElement || !textCase) return;
        this._applyClass(this._logoElement, TEXT_CASE_CLASS_PREFIX + textCase, TEXT_CASE_CLASS_PREFIX);
        this._updateSizeIndicator(); // Case changes affect dimensions
    },

    /**
     * Applies a text effect (shadow, glow, etc.) using CSS classes.
     * Uses the `TEXT_EFFECT_MAP` to convert the dropdown value to the correct CSS class.
     * @private
     * @param {string} effectValueFromDropdown - The `value` selected in the text effect dropdown.
     */
    _applyTextEffect(effectValueFromDropdown) {
        if (!this._logoElement || !effectValueFromDropdown) return;

        // Look up the corresponding CSS class in the map, default to 'none' if not found
        const effectClass = TEXT_EFFECT_MAP[effectValueFromDropdown] || 'text-effect-none';
        console.log(`[SM] Applying text effect: '${effectValueFromDropdown}' mapped to '${effectClass}'`);

        // Apply the mapped class, removing others with the same prefix
        this._applyClass(this._logoElement, effectClass, TEXT_EFFECT_CLASS_PREFIX);
    },

    /**
     * Applies a border style or effect to the logo container element using CSS classes.
     * Uses the `BORDER_STYLE_MAP` to get the correct class.
     * Manages adding/removing base `.dynamic-border` class and ensures only one style/effect class is active.
     * Also reapplies border width, padding, and radius to ensure consistency.
     * @private
     * @param {string} borderValueFromDropdown - The `value` selected in the border style dropdown.
     */
    _applyBorderStyle(borderValueFromDropdown) {
        if (!this._logoContainer || !borderValueFromDropdown) return;

        // Look up the CSS class, default to 'none'
        const borderClass = BORDER_STYLE_MAP[borderValueFromDropdown] || 'border-style-none';
        console.log(`[SM] Applying border style: '${borderValueFromDropdown}' mapped to '${borderClass}'`);

        const isStaticStyle = borderClass.startsWith(BORDER_STYLE_CLASS_PREFIX); // e.g., border-style-solid
        const isEffect = borderClass.startsWith(BORDER_EFFECT_CLASS_PREFIX); // e.g., border-effect-glow-soft
        const hasVisibleBorder = borderClass !== 'border-style-none';

        // Add/remove the base class that enables border styling context
        this._logoContainer.classList.toggle('dynamic-border', hasVisibleBorder);

        // Apply the specific class, ensuring only *one* style or effect class is present.
        // Remove the other type's prefix class when applying one.
        if (isStaticStyle) {
            this._applyClass(this._logoContainer, borderClass, BORDER_STYLE_CLASS_PREFIX); // Add the static style
            this._applyClass(this._logoContainer, 'border-effect-none', BORDER_EFFECT_CLASS_PREFIX); // Remove any effect style
        } else if (isEffect) {
            this._applyClass(this._logoContainer, 'border-style-none', BORDER_STYLE_CLASS_PREFIX); // Remove any static style
            this._applyClass(this._logoContainer, borderClass, BORDER_EFFECT_CLASS_PREFIX); // Add the effect style
        } else { // Handle 'none' case explicitly to clear both types
            this._applyClass(this._logoContainer, 'border-style-none', BORDER_STYLE_CLASS_PREFIX);
            this._applyClass(this._logoContainer, 'border-effect-none', BORDER_EFFECT_CLASS_PREFIX);
        }

        // Re-apply related border properties from current settings to ensure consistency
        const borderWidth = `${this._currentSettings.borderWidth || DEFAULT_SETTINGS.borderWidth}px`;
        document.documentElement.style.setProperty('--dynamic-border-width', borderWidth);

        // Apply border padding using the helper function
        this._applyBorderPadding(this._currentSettings.borderPadding || DEFAULT_SETTINGS.borderPadding);

        // Apply border radius using the helper function
        this._applyBorderRadius(this._currentSettings.borderRadius || DEFAULT_SETTINGS.borderRadius);
    },

    /**
     * Applies border radius to the logo container element.
     * Uses `BORDER_RADIUS_MAP` to apply a corresponding CSS class for styling consistency and export.
     * Attempts to use `CSSUtils.applyBorderRadius` for actual style application if available,
     * otherwise falls back to direct style manipulation and setting a CSS variable.
     * @private
     * @param {string} radiusValue - The border radius value from the dropdown (e.g., 'none', 'rounded-sm', 'pill', 'circle').
     */
    _applyBorderRadius(radiusValue) {
        if (!this._logoContainer || !radiusValue) return;

        // Map the dropdown value to a CSS class using the map, default to 'custom' if not found
        const radiusClass = BORDER_RADIUS_MAP[radiusValue] || 'border-radius-custom';
        console.log(`[SM] Applying border radius: '${radiusValue}' mapped to '${radiusClass}'`);

        // Apply the corresponding class for CSS consistency/export
        this._applyClass(this._logoContainer, radiusClass, BORDER_RADIUS_CLASS_PREFIX);

        // Use CSSUtils helper for applying the actual style if available (preferred)
        if (window.CSSUtils && typeof window.CSSUtils.applyBorderRadius === 'function') {
            window.CSSUtils.applyBorderRadius(this._logoContainer, radiusValue);
            // CSSUtils should also handle setting the --dynamic-border-radius variable internally
        }
        else {
            // --- Fallback direct style application if CSSUtils is not available ---
            let cssRadiusValue = '0'; // Default fallback
            switch (radiusValue) {
                case 'none': case 'square': cssRadiusValue = '0'; break;
                case 'circle': cssRadiusValue = '50%'; break;
                case 'oval': cssRadiusValue = '30% / 50%'; break; // Example oval ratio
                case 'pill': cssRadiusValue = '999px'; break; // Common technique for pill shape
                case 'rounded-sm': cssRadiusValue = '3px'; break; // Example value
                case 'rounded-md': cssRadiusValue = '6px'; break; // Example value
                case 'rounded-lg': cssRadiusValue = '10px'; break; // Example value
                default:
                    // Attempt to use the value directly if it looks like a valid CSS value (e.g., '15px', '2em')
                    // Simple check: contains 'px', 'em', 'rem', '%' or is just a number (assume px)
                    if (/^\d+(\.\d+)?(px|em|rem|%)$/.test(radiusValue)) {
                        cssRadiusValue = radiusValue;
                    } else if (!isNaN(parseFloat(radiusValue))) {
                        cssRadiusValue = `${radiusValue}px`; // Assume px if just a number
                    } else {
                         console.warn(`[SM Fallback] Invalid border-radius value '${radiusValue}', using 0.`);
                         cssRadiusValue = '0';
                    }
            }
            this._logoContainer.style.borderRadius = cssRadiusValue;
            document.documentElement.style.setProperty('--dynamic-border-radius', cssRadiusValue);
            console.log(`[SM Fallback] Applied border-radius style: ${cssRadiusValue}`);
        }
    },

    /**
     * Applies border padding to the logo container element.
     * Attempts to use `CSSUtils.applyBorderPadding` if available, otherwise falls back to direct style manipulation.
     * @private
     * @param {string|number} padding - The padding value (e.g., '10', '15px').
     * @param {string} [unit='px'] - The default unit if padding is just a number.
     */
    _applyBorderPadding(padding, unit = 'px') {
        if (!this._logoContainer) return;

        // Normalize padding value to ensure it has a unit (e.g., '10' becomes '10px')
        let normalizedPadding = String(padding); // Ensure it's a string
        if (/^\d+(\.\d+)?$/.test(normalizedPadding)) { // Check if it's just a number
            normalizedPadding = `${normalizedPadding}${unit}`;
        }

        // Use CSSUtils helper if available (preferred)
        if (window.CSSUtils && typeof window.CSSUtils.applyBorderPadding === 'function') {
            window.CSSUtils.applyBorderPadding(this._logoContainer, normalizedPadding);
            // CSSUtils should also handle setting the --dynamic-border-padding variable
        } else {
            // --- Fallback direct style application ---
            this._logoContainer.style.padding = normalizedPadding;
            document.documentElement.style.setProperty('--dynamic-border-padding', normalizedPadding);
            console.log(`[SM Fallback] Applied border padding style: ${normalizedPadding}`);
        }

        // console.log(`[SM] Applied border padding: ${normalizedPadding}`); // Logged by CSSUtils or fallback
    },

    /**
     * Applies a text animation class to the logo element.
     * Ensures the correct animation speed/duration variable is set.
     * Adds `data-text` attribute if required by the animation (e.g., glitch effect).
     * @private
     * @param {string} animValue - The animation class value from the dropdown (e.g., 'anim-none', 'anim-glitch').
     */
    _applyTextAnimation(animValue) {
        if (!this._logoElement || !animValue) return;
        // Apply the class, removing others with the same prefix
        this._applyClass(this._logoElement, animValue, ANIMATION_CLASS_PREFIX);
        // Re-apply animation speed to ensure the --animation-duration variable is correct
        this._applyAnimationSpeed(this._currentSettings.animationSpeed);

        // Special handling for animations that need the text content in data-text attribute
        if (animValue === 'anim-glitch' || animValue === 'anim-reveal') { // Add other anims if needed
            if (this._logoElement.textContent) {
                 this._logoElement.setAttribute('data-text', this._logoElement.textContent);
                 console.log(`[SM] Applied data-text for animation '${animValue}': "${this._logoElement.textContent}"`);
            }
        } else {
             // Remove data-text if not needed by the current animation
             this._logoElement.removeAttribute('data-text');
        }
    },

    /**
     * Applies a preview size class to the main preview container element.
     * Assumes classes like `.preview-size-small`, `.preview-size-medium` exist.
     * Updates size indicator as container size change can affect text wrapping/layout.
     * @private
     * @param {string} sizeValue - The preview size class value (e.g., 'preview-size-medium').
     */
    _applyPreviewSize(sizeValue) {
        if (!this._previewContainer || !sizeValue) return;
        this._applyClass(this._previewContainer, sizeValue, PREVIEW_SIZE_CLASS_PREFIX);
        this._updateSizeIndicator(); // Container size change affects layout
    },

    // --- Complex State Handlers (Manage UI Visibility + Call Style Applicators) ---
    // These handle controls that affect the visibility of other controls AND apply styles.

    /**
     * Handles changes to the text color mode (solid vs. gradient).
     * Toggles visibility of relevant color pickers/preset controls.
     * Calls the appropriate style application function (`_applySolidTextColor` or `_applyGradientToLogo`).
     * @private
     * @param {string} mode - The selected color mode ('solid' or 'gradient').
     */
    _handleColorModeChange(mode) {
        const isSolid = mode === 'solid';
        // Toggle visibility of control groups
        document.getElementById('solidColorPickerGroup')?.classList.toggle('hidden', !isSolid);
        document.getElementById('gradientPresetGroup')?.classList.toggle('hidden', isSolid);
        // Custom gradient controls are visible only if mode is gradient AND preset is custom
        document.getElementById('customGradientControls')?.classList.toggle('hidden', isSolid || this._currentSettings.gradientPreset !== 'custom');

        // Apply the corresponding text style
        if (isSolid) {
            this._applySolidTextColor(this._currentSettings.solidColorPicker);
        } else {
            this._applyGradientToLogo();
        }
        console.log(`[SM] Handled color mode change: ${mode}`);
    },

    /**
     * Handles changes to the text gradient preset selection.
     * Toggles visibility of the custom gradient color pickers if 'custom' is selected.
     * Re-applies the text gradient.
     * @private
     * @param {string} preset - The selected gradient preset value (e.g., 'primary-gradient', 'custom').
     */
    _handleGradientPresetChange(preset) {
        // Show/hide custom color pickers based on whether 'custom' is selected
        document.getElementById('customGradientControls')?.classList.toggle('hidden', preset !== 'custom');
        // Re-apply the gradient only if the current mode is actually gradient
        if (this._currentSettings.textColorMode === 'gradient') {
            this._applyGradientToLogo(); // Re-apply to reflect preset change
        }
        console.log(`[SM] Handled gradient preset change: ${preset}`);
    },

    /**
     * Handles changes to the background type selection.
     * Toggles visibility of relevant background controls (solid color, gradient controls).
     * Applies the selected background type (solid color, gradient, pattern class, transparency).
     * Resets background properties before applying the new type.
     * @private
     * @param {string} type - The selected background type value (e.g., 'bg-solid', 'bg-gradient-preset', 'bg-transparent').
     */
    _handleBackgroundTypeChange(type) {
        if (!this._previewContainer) return;
        const isSolid = type === 'bg-solid';
        const isGradient = type?.includes('gradient'); // Covers 'bg-gradient-preset', 'bg-gradient-custom', 'bg-gradient-animated'

        // Toggle visibility of control groups
        document.getElementById('backgroundColorControl')?.classList.toggle('hidden', !isSolid);
        document.getElementById('backgroundGradientControls')?.classList.toggle('hidden', !isGradient);
        // Custom gradient controls only visible if type is gradient AND preset is custom
        document.getElementById('customBackgroundGradient')?.classList.toggle('hidden', !isGradient || this._currentSettings.backgroundGradientPreset !== 'custom');

        // --- Reset background styles before applying new type ---
        this._previewContainer.style.backgroundImage = ''; // Clear gradients/images
        this._previewContainer.style.backgroundColor = ''; // Clear solid color
        this._previewContainer.style.opacity = '1'; // Reset opacity

        // Reset opacity control and setting
        const opacityInput = document.getElementById('bgOpacity');
        if (opacityInput) opacityInput.value = '1';
        this._currentSettings.bgOpacity = '1';

        // Remove all existing background-related classes (bg-*, animated class)
        const classesToRemove = Array.from(this._previewContainer.classList).filter(cls =>
            cls.startsWith(BACKGROUND_CLASS_PREFIX) || cls === 'bg-gradient-animated-css'
        );
        if (classesToRemove.length > 0) {
            this._previewContainer.classList.remove(...classesToRemove);
        }
        // --- End Reset ---

        // Apply the new background type class (important for patterns/animated gradient base)
        if (type) {
            this._previewContainer.classList.add(type);
        }

        // Apply specific styles based on the new type
        if (isSolid) {
            this._applySolidBgColor(this._currentSettings.backgroundColor);
        } else if (isGradient) {
            this._applyBackgroundGradient(); // Apply the gradient (preset or custom)
            // Add specific animation class if needed
            if (type === 'bg-gradient-animated') {
                this._previewContainer.classList.add('bg-gradient-animated-css');
            }
        } else if (type === 'bg-transparent') {
            this._previewContainer.style.backgroundColor = 'transparent';
        }
        // Pattern backgrounds (e.g., 'bg-pattern-dots') are handled by the class added above

        // Re-apply the (now reset) opacity setting
        this._previewContainer.style.opacity = this._currentSettings.bgOpacity;

        console.log(`[SM] Handled background type change: ${type}`);
    },

    /**
     * Handles changes to the background gradient preset selection.
     * Toggles visibility of custom background gradient controls if 'custom' is selected.
     * Re-applies the background gradient.
     * @private
     * @param {string} presetValue - The selected background gradient preset value.
     */
    _handleBackgroundGradientChange(presetValue) {
        // Show/hide custom color pickers
        document.getElementById('customBackgroundGradient')?.classList.toggle('hidden', presetValue !== 'custom');
        // Re-apply gradient only if the current background type is gradient
        if (this._currentSettings.backgroundType?.includes('gradient')) {
            this._applyBackgroundGradient(); // Re-apply to reflect preset change
        }
        console.log(`[SM] Handled background gradient preset change: ${presetValue}`);
    },

    // --- Direct Style Setters ---
    // These methods apply specific inline styles, often used as part of the complex handlers above.

    /**
     * Applies a solid text color to the logo element.
     * Resets any background gradient styles on the text.
     * @private
     * @param {string} color - The CSS color value (e.g., '#ffffff').
     */
    _applySolidTextColor(color) {
        if (!this._logoElement) return;
        // Clear gradient-related styles
        this._logoElement.style.backgroundImage = 'none';
        this._logoElement.style.backgroundClip = 'initial';
        this._logoElement.style.webkitBackgroundClip = 'initial';
        this._logoElement.style.webkitTextFillColor = 'initial'; // Reset webkit fill
        // Apply solid color
        this._logoElement.style.color = color;
        console.log(`[SM] Applied solid text color: ${color}`);
    },

    /**
     * Applies a solid background color to the preview container.
     * @private
     * @param {string} color - The CSS color value (e.g., '#000000').
     */
    _applySolidBgColor(color) {
         if (!this._previewContainer) return;
         this._previewContainer.style.backgroundColor = color;
         this._previewContainer.style.backgroundImage = 'none'; // Ensure no gradient image
         console.log(`[SM] Applied solid background color: ${color}`);
    },

    /**
     * Applies the current text gradient (preset or custom) to the logo element.
     * Handles retrieving preset values from CSS variables or uses hardcoded fallbacks.
     * Sets necessary CSS properties for text gradients (`background-image`, `background-clip`, `color`).
     * Includes error handling and falls back to solid white on failure.
     * @private
     */
    _applyGradientToLogo() {
        if (!this._logoElement) return;

        // Get required values from current settings
        const direction = this._currentSettings.animationDirection || DEFAULT_SETTINGS.animationDirection;
        const preset = this._currentSettings.gradientPreset;
        let gradientCssString = ''; // The final CSS linear-gradient() string

        try {
            if (preset === 'custom') {
                // --- Custom Gradient ---
                const c1 = this._currentSettings.color1;
                const c2 = this._currentSettings.color2;
                const useC3 = this._currentSettings.useColor3;
                const c3 = this._currentSettings.color3;

                // Construct gradient string based on whether color 3 is used
                gradientCssString = useC3
                    ? `linear-gradient(${direction}deg, ${c1}, ${c2}, ${c3})`
                    : `linear-gradient(${direction}deg, ${c1}, ${c2})`;
            } else {
                // --- Preset Gradient ---
                // 1. Try reading the preset gradient definition from CSS variables
                let presetVarValue = '';
                try {
                    // Ensure the variable name is valid (e.g., '--primary-gradient')
                    const cssVarName = `--${preset}`;
                    presetVarValue = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
                } catch (e) {
                    console.warn(`[SM Gradient] Could not read CSS variable for preset '${preset}'.`, e);
                }

                if (presetVarValue && presetVarValue.startsWith('linear-gradient')) {
                    // If successful, replace the angle defined in the variable with the current direction
                     console.log(`[SM Gradient] Using CSS variable for preset: ${preset}`);
                    gradientCssString = presetVarValue.replace(
                        /linear-gradient\([^,]+,/, // Matches "linear-gradient( ANY_ANGLE ,"
                        `linear-gradient(${direction}deg,` // Replaces with current direction
                    );
                } else {
                    // 2. If CSS variable not found or invalid, use hardcoded fallbacks
                    console.warn(`[SM Gradient] CSS variable for '${preset}' not found or invalid. Using hardcoded fallback.`);
                    // Define hardcoded presets (ensure these match your CSS)
                    const presetMapFallbacks = {
                         'primary-gradient': `linear-gradient(${direction}deg, #FF1493, #8A2BE2)`,
                         'cyberpunk-gradient': `linear-gradient(${direction}deg, #f953c6, #b91d73)`,
                         'sunset-gradient': `linear-gradient(${direction}deg, #ff7e5f, #feb47b)`,
                         'ocean-gradient': `linear-gradient(${direction}deg, #00c6ff, #0072ff)`,
                         'forest-gradient': `linear-gradient(${direction}deg, #5ec422, #01796f)`,
                         'rainbow-gradient': `linear-gradient(${direction}deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)`,
                         'neon-blue-gradient': `linear-gradient(${direction}deg, #00c9ff, #92fe9d)`,
                         'royal-gradient': `linear-gradient(${direction}deg, #141e30, #243b55)`,
                         'fire-gradient': `linear-gradient(${direction}deg, #f5576c, #f39c12)`,
                         'purple-love-gradient': `linear-gradient(${direction}deg, #cc2b5e, #753a88)`,
                         'dark-knight-gradient': `linear-gradient(${direction}deg, #ba8b02, #181818)`,
                         'emerald-gradient': `linear-gradient(${direction}deg, #43cea2, #185a9d)`
                    };
                    gradientCssString = presetMapFallbacks[preset]; // Get fallback string

                    if (!gradientCssString) {
                         // 3. If preset is completely unknown, use the default custom colors
                         console.warn(`[SM Gradient] Unknown preset '${preset}'. Falling back to default colors.`);
                         gradientCssString = `linear-gradient(${direction}deg, ${DEFAULT_SETTINGS.color1}, ${DEFAULT_SETTINGS.color2})`;
                    }
                }
            }

            // Apply the generated gradient CSS string to the text element
            this._logoElement.style.backgroundImage = gradientCssString;
            this._logoElement.style.webkitBackgroundClip = 'text';
            this._logoElement.style.backgroundClip = 'text';
            this._logoElement.style.color = 'transparent'; // Hide the actual text color
            this._logoElement.style.webkitTextFillColor = 'transparent'; // Crucial for webkit browsers

            console.log(`[SM] Applied text gradient (Preset: ${preset}, Dir: ${direction}deg)`);
        } catch (e) {
            console.error(`[SM] Error applying text gradient:`, e);
            // Fallback to solid white on any error during gradient application
            this._applySolidTextColor('#ffffff');
        }
    },

    /**
     * Applies the current background gradient (preset or custom) to the preview container.
     * Similar logic to `_applyGradientToLogo`, but targets the background.
     * Includes error handling and falls back to solid black.
     * @private
     */
    _applyBackgroundGradient() {
        if (!this._previewContainer) return;

        const direction = this._currentSettings.bgGradientDirection || DEFAULT_SETTINGS.bgGradientDirection;
        const preset = this._currentSettings.backgroundGradientPreset;
        let gradientCssString = '';

        try {
            if (preset === 'custom') {
                // --- Custom Background Gradient ---
                const c1 = this._currentSettings.bgColor1;
                const c2 = this._currentSettings.bgColor2;
                gradientCssString = `linear-gradient(${direction}deg, ${c1}, ${c2})`;
            } else {
                // --- Preset Background Gradient ---
                 // 1. Try reading from CSS variable
                let presetVarValue = '';
                 try {
                     const cssVarName = `--${preset}`; // e.g., --bg-primary-gradient
                     presetVarValue = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
                 } catch (e) {
                    console.warn(`[SM BG Gradient] Could not read CSS variable for preset '${preset}'.`, e);
                 }

                 if (presetVarValue && presetVarValue.startsWith('linear-gradient')) {
                     console.log(`[SM BG Gradient] Using CSS variable for preset: ${preset}`);
                     gradientCssString = presetVarValue.replace(
                         /linear-gradient\([^,]+,/,
                         `linear-gradient(${direction}deg,`
                     );
                 } else {
                    // 2. Use hardcoded fallbacks if CSS var fails
                    console.warn(`[SM BG Gradient] CSS variable for '${preset}' not found or invalid. Using hardcoded fallback.`);
                    const presetMapFallbacks = {
                         'bg-primary-gradient': `linear-gradient(${direction}deg, #1a1a2e, #16213e, #0f3460)`,
                         'bg-cyberpunk-gradient': `linear-gradient(${direction}deg, #0f0c29, #302b63, #24243e)`,
                         'bg-sunset-gradient': `linear-gradient(${direction}deg, #ff7e5f, #feb47b)`,
                         'bg-ocean-gradient': `linear-gradient(${direction}deg, #00c6ff, #0072ff)`
                         // Add other BG presets as needed
                    };
                    gradientCssString = presetMapFallbacks[preset];

                    if (!gradientCssString) {
                        // 3. Fallback to default custom colors if preset unknown
                        console.warn(`[SM BG Gradient] Unknown preset '${preset}'. Falling back to default colors.`);
                        gradientCssString = `linear-gradient(${direction}deg, ${DEFAULT_SETTINGS.bgColor1}, ${DEFAULT_SETTINGS.bgColor2})`;
                    }
                 }
            }

            // Apply the gradient to the background
            this._previewContainer.style.backgroundImage = gradientCssString;
            this._previewContainer.style.backgroundColor = ''; // Ensure solid color is cleared

            console.log(`[SM] Applied background gradient (Preset: ${preset}, Dir: ${direction}deg)`);
        } catch (e) {
            console.error(`[SM] Error applying background gradient:`, e);
            // Fallback to solid black on error
            this._applySolidBgColor('#000000');
        }
    },

    /**
     * Sets the `--animation-duration` CSS variable based on the speed multiplier.
     * Higher speed values result in shorter durations.
     * @private
     * @param {string|number} speedValue - The animation speed multiplier (e.g., '1', '0.5', '2').
     */
    _applyAnimationSpeed(speedValue) {
         // Define a base duration for speed '1x' (e.g., 2 seconds)
         const baseDuration = 2;
         // Parse the speed value, defaulting to 1
         const speed = parseFloat(speedValue || '1');
         // Calculate the actual duration: duration = base / speed
         // Ensure speed isn't zero or too small to avoid infinite/huge duration
         const duration = Math.max(0.1, baseDuration / Math.max(0.1, speed)); // Clamp minimum duration/speed

         document.documentElement.style.setProperty('--animation-duration', `${duration.toFixed(2)}s`);
         console.log(`[SM] Applied animation speed multiplier: ${speed}x (Duration: ${duration.toFixed(2)}s)`);
    },

    /**
     * Updates the font family style of the small font preview element within the dropdown.
     * @private
     * @param {string} fontFamilyName - The font family name to apply.
     */
    _updateFontPreview(fontFamilyName) {
         const previewElement = document.getElementById("fontPreview");
         if (previewElement?.style) {
             // Apply with quotes for safety and a generic fallback
             previewElement.style.fontFamily = `"${fontFamilyName}", sans-serif`;
         }
    },

    /**
     * Displays the provided license text in the designated license info area.
     * Hides the area if no license text is provided.
     * @private
     * @param {?string} licenseText - The license text to display, or null/undefined to hide.
     */
    _displayLicenseInfo(licenseText) {
          const licenseTextArea = document.getElementById('fontLicenseText');
          const licenseContainer = document.getElementById('fontLicenseContainer');
          if(licenseTextArea && licenseContainer) {
               const hasText = !!licenseText && licenseText.trim() !== '';
               licenseTextArea.textContent = hasText ? licenseText : "No license information available for this font.";
               // Show/hide the container based on whether actual license text exists
               licenseContainer.classList.toggle('hidden', !hasText);
          }
    },

    // --- Utility Helpers ---

    /**
     * Utility function to apply a CSS class to an element, ensuring only one class
     * with a specific prefix exists at a time.
     * Optionally removes all classes starting with `classPrefix` before adding the new `className`.
     * Avoids adding classes that end with '-none' or '_none'.
     * @private
     * @param {HTMLElement} targetElement - The DOM element to modify.
     * @param {string} className - The CSS class name to add.
     * @param {?string} [classPrefix=null] - If provided, remove all classes starting with this prefix before adding the new one.
     */
    _applyClass(targetElement, className, classPrefix = null) {
        if (!targetElement || !className) return;

        // If a prefix is provided, remove existing classes with that prefix
        if (classPrefix) {
            const classesToRemove = Array.from(targetElement.classList).filter(cls => cls.startsWith(classPrefix));
            if (classesToRemove.length > 0) {
                targetElement.classList.remove(...classesToRemove);
            }
        }

        // Only add the class if it's not a designated "none" class
        // (assuming '-none' or '_none' suffix indicates no style should be applied)
        if (!className.endsWith('-none') && !className.endsWith('_none')) {
            targetElement.classList.add(className);
        }
    },

    /**
     * Sanitizes a string (like a font family name) to be suitable for use as a CSS class name.
     * Converts to lowercase, replaces spaces with hyphens, and removes invalid characters.
     * @private
     * @param {string} name - The input string to sanitize.
     * @returns {string} The sanitized string suitable for a CSS class. Returns empty string if input is invalid.
     */
    _sanitizeForClassName(name) {
        if (!name || typeof name !== 'string') return '';
        return name
            .toLowerCase() // Convert to lowercase
            .replace(/\s+/g, '-') // Replace one or more spaces with a single hyphen
            .replace(/[^a-z0-9-]/g, ''); // Remove any character that is not a lowercase letter, number, or hyphen
    },

    // --- Core Methods (Trigger, Size, CSS Gen, UI Init, Reset, Persistence) ---

    /**
     * Applies a given settings object to the UI controls and the visual preview.
     * This is the main method used for loading initial settings, applying random styles, or resetting.
     * @param {object} settings - The settings object to apply. Should have keys matching DEFAULT_SETTINGS.
     * @param {boolean} [forceUIUpdate=false] - If true, forces UI control values to update even if they match the new settings (useful for reset/randomize). Also triggers immediate style application.
     * @param {boolean} [isInitialLoad=false] - If true, indicates this is the initial settings application on page load. Triggers immediate style application.
     * @async
     * @returns {Promise<void>} Resolves when settings application is complete.
     */
    async applySettings(settings, forceUIUpdate = false, isInitialLoad = false) {
        console.log(`[SM] Applying settings (forceUI: ${forceUIUpdate}, initial: ${isInitialLoad})`);
        // Ensure settings object is valid; merge with defaults to guarantee all keys exist
        const settingsToApply = (typeof settings === 'object' && settings !== null)
            ? { ...this.getDefaults(), ...settings } // Merge provided settings over defaults
            : this.getCurrentSettings(); // Use current if input is invalid
        this._currentSettings = settingsToApply; // Update internal state *first*

        // --- 1. Update UI Control Values ---
        // Iterate through the settings and update the corresponding HTML form elements.
        Object.entries(this._currentSettings).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (!element) return; // Skip if control element doesn't exist in the DOM

            try {
                const currentElementValue = (element.type === 'checkbox') ? element.checked : element.value;
                // Format new value and current value for consistent comparison
                const newValueFormatted = (element.type === 'checkbox') ? !!value : String(value ?? '');
                const currentValueFormatted = (element.type === 'checkbox') ? currentElementValue : String(currentElementValue);

                // Update the element's value only if forced, initial load, or the value actually differs
                if (forceUIUpdate || isInitialLoad || currentValueFormatted !== newValueFormatted) {
                    if (element.type === 'checkbox') {
                        element.checked = newValueFormatted;
                    } else {
                        element.value = newValueFormatted;
                    }

                    // CRITICAL: If forcing UI update (e.g., after reset/randomize), we need to manually
                    // trigger the 'input' or 'change' event AFTER setting the value. This ensures the
                    // bound event listeners (_bind* functions) run and apply the visual styles immediately.
                    // Skip this dispatch on initial load to avoid redundant style applications.
                    if (forceUIUpdate && !isInitialLoad) {
                        // Determine correct event type based on element type
                        const eventType = (element.nodeName === 'SELECT' || element.type === 'checkbox' || element.type === 'color')
                            ? 'change' : 'input';
                        // Dispatch the event
                        element.dispatchEvent(new Event(eventType, { bubbles: true }));
                         console.log(`[SM Apply UI] Dispatched ${eventType} for ${key}`);
                    }
                }
            } catch (e) {
                console.warn(`[SM Apply UI] Error setting UI value for element #${key}:`, e);
            }
        });

        // --- 2. Apply Visual Styles Directly ---
        // This block runs only on initial load or when forced (reset/randomize).
        // For normal user interactions, styles are applied via the event listeners (_bind* functions).
        // This ensures the visual preview directly reflects the settings state immediately after load/reset.
        if (isInitialLoad || forceUIUpdate) {
            console.log('[SM Apply Styles] Applying visual styles directly using helper methods...');
            const logoEl = this._logoElement;
            const logoContainer = this._logoContainer;
            const previewContainer = this._previewContainer;

            if (!logoEl || !previewContainer || !logoContainer) {
                console.error("[SM Apply Styles] Critical elements missing for style application!");
                return Promise.reject(new Error("Missing elements for style application"));
            }

            // --- Apply Styles Systematically ---
            // Apply styles in a logical order, considering dependencies.

            // Text Content
            logoEl.textContent = this._currentSettings.logoText;
            logoEl.setAttribute('data-text', this._currentSettings.logoText); // For effects

            // Font Family & Weight (Must be awaited as font loading is async)
            // _applyFontFamily internally calls _applyFontWeight after font loads/fails
            await this._applyFontFamily(this._currentSettings.fontFamily);

            // Other Text Styles (Classes)
            this._applyTextCase(this._currentSettings.textCase);
            this._applyTextAlign(this._currentSettings.textAlign);

            // Styles Controlled Primarily by CSS Variables
            document.documentElement.style.setProperty('--dynamic-font-size', `${this._currentSettings.fontSize}px`);
            document.documentElement.style.setProperty('--dynamic-letter-spacing', `${this._currentSettings.letterSpacing}em`);
            document.documentElement.style.setProperty('--dynamic-rotation', `${this._currentSettings.rotation}deg`);
            document.documentElement.style.setProperty('--dynamic-border-color', this._currentSettings.borderColorPicker);
            document.documentElement.style.setProperty('--dynamic-border-width', `${this._currentSettings.borderWidth}px`);
            document.documentElement.style.setProperty('--gradient-direction', `${this._currentSettings.animationDirection}deg`);
            document.documentElement.style.setProperty('--bg-gradient-direction', `${this._currentSettings.bgGradientDirection}deg`);

            // Set border color RGB variable (using helper or fallback)
            let borderRgb = "255, 255, 255";
            try {
                if (window.CSSUtils && typeof window.CSSUtils.extractRGB === 'function') {
                    borderRgb = window.CSSUtils.extractRGB(this._currentSettings.borderColorPicker);
                } else {
                    borderRgb = this._extractColorRGB(this._currentSettings.borderColorPicker);
                }
            } catch(e){ console.error("Error getting border RGB", e); }
            document.documentElement.style.setProperty('--dynamic-border-color-rgb', borderRgb);

            // Border Padding & Radius (Helpers use CSSUtils or fallback)
            this._applyBorderPadding(this._currentSettings.borderPadding);
            this._applyBorderRadius(this._currentSettings.borderRadius);

            // Animation Speed (Helper sets --animation-duration)
            this._applyAnimationSpeed(this._currentSettings.animationSpeed);

            // Effects & Borders (Use helpers with mapping tables)
            this._applyTextEffect(this._currentSettings.textShadow);
            this._applyBorderStyle(this._currentSettings.borderStyle); // This also reapplies padding/radius

            // Animation (Class application)
            this._applyTextAnimation(this._currentSettings.textAnimation);

            // Preview Size (Class application)
            this._applyPreviewSize(this._currentSettings.previewSize);

            // Complex Handlers (Manage UI visibility & apply corresponding styles)
            // These need to run after basic styles/variables are set.
            this._handleColorModeChange(this._currentSettings.textColorMode); // Applies solid/gradient text
            this._handleBackgroundTypeChange(this._currentSettings.backgroundType); // Applies bg style/class/gradient
            previewContainer.style.opacity = this._currentSettings.bgOpacity; // Apply BG opacity directly

            // Call secondary handlers to ensure UI state consistency (e.g., custom controls visibility)
            // This might trigger some redundant style applications but ensures UI matches state.
            this._handleGradientPresetChange(this._currentSettings.gradientPreset);
            this._handleBackgroundGradientChange(this._currentSettings.backgroundGradientPreset);

            // Update range slider display values AFTER all UI element values have been set
            this._updateRangeValueDisplays();

            console.log('[SM Apply Styles] Visual styles application complete.');
        } // End of (isInitialLoad || forceUIUpdate) block

        // --- Final Trigger (Always Run) ---
        // Regardless of whether styles were applied directly or via listeners,
        // always trigger the save, notify listeners, and update generated code.
        this._triggerSettingsUpdate();
        console.log('[SM] applySettings processing complete.');
    },

    /**
     * Triggers actions needed after any setting change: saves settings, notifies listeners,
     * updates size indicator, and regenerates CSS code preview.
     * Uses requestAnimationFrame for updates reading layout (size indicator, CSS gen).
     * @private
     */
    _triggerSettingsUpdate() {
         this.saveCurrentSettings(); // Persist changes to localStorage

         // Notify registered listeners about the settings change
         const currentSettingsCopy = this.getCurrentSettings(); // Get a safe copy
         this._listeners.forEach(listener => {
             try {
                 listener(currentSettingsCopy);
             } catch(e) {
                 console.error('[SM] Error executing settings change listener:', e);
             }
         });

         // Defer layout-reading updates to the next frame to avoid layout thrashing
         requestAnimationFrame(() => {
             this._updateSizeIndicator(); // Update displayed width/height
             this._updateCSSCode(); // Regenerate and display CSS code snippet
         });
    },

    /**
     * Updates the displayed width and height indicators based on the logo element's current dimensions.
     * Uses getBoundingClientRect, so should ideally be called within requestAnimationFrame.
     * @private
     */
    _updateSizeIndicator() {
         const widthDisplay = document.getElementById('logoWidth');
         const heightDisplay = document.getElementById('logoHeight');

         if(!this._logoElement || !widthDisplay || !heightDisplay) return;

         try {
             // getBoundingClientRect gives precise dimensions, including fractions
             const rect = this._logoElement.getBoundingClientRect();
             // Display rounded values for user readability
             if(rect.width > 0) widthDisplay.textContent = Math.round(rect.width);
             if(rect.height > 0) heightDisplay.textContent = Math.round(rect.height);
         } catch(e) {
             console.error('[SM] Error updating size indicator:', e);
             widthDisplay.textContent = 'N/A';
             heightDisplay.textContent = 'N/A';
         }
    },

    /**
     * Regenerates the CSS code preview and updates the corresponding textarea.
     * Should ideally be called within requestAnimationFrame as _generateCSSCode might read styles.
     * @private
     */
    _updateCSSCode() {
         const cssCodeElement = document.getElementById('cssCode');
         if(cssCodeElement) {
             cssCodeElement.value = this._generateCSSCode();
         }
    },

    /**
     * Generates a CSS code snippet representing the current visual styles.
     * Includes relevant CSS variables and class definitions based on applied styles.
     * Designed to provide users with CSS they can copy/paste.
     * @private
     * @returns {string} A string containing the generated CSS code.
     */
    _generateCSSCode() {
        console.log("[SM] Generating CSS Code (Updated with advanced styling v17)...");
        if (!this._logoElement || !this._previewContainer || !this._logoContainer) {
            return "/* Error: Cannot generate CSS - Core preview elements are missing. */";
        }

        try {
            let css = `/* Generated CSS - Reflects current settings */\n\n:root {\n`;
            // List of CSS variables dynamically controlled by the SettingsManager
            const cssVarsToInclude = [
                '--animation-duration',
                '--gradient-direction',
                '--dynamic-border-color',
                '--dynamic-border-color-rgb',
                '--bg-gradient-direction',
                '--dynamic-font-size',
                '--dynamic-letter-spacing',
                '--dynamic-rotation',
                '--dynamic-border-width',
                '--dynamic-border-radius', // Include radius variable
                '--dynamic-border-padding'  // Include padding variable
            ];

            // Add each variable and its current value to the :root block
            cssVarsToInclude.forEach(varName => {
                // Read value directly from inline style first, then computed style as fallback
                const value = document.documentElement.style.getPropertyValue(varName) ||
                              getComputedStyle(document.documentElement).getPropertyValue(varName);
                if (value && value.trim()) {
                     css += `  ${varName}: ${value.trim()};\n`;
                }
            });
            css += `}\n\n`;

            // --- Gather Applied Classes ---
            const getPrefixedClass = (element, prefix) =>
                Array.from(element.classList).find(c => c.startsWith(prefix));

            // Filter function to select relevant classes for export
            const isRelevantClass = (c) => c === 'dynamic-border' ||
                c.startsWith(BORDER_STYLE_CLASS_PREFIX) || c.startsWith(BORDER_EFFECT_CLASS_PREFIX) ||
                c.startsWith(BORDER_RADIUS_CLASS_PREFIX) || c.startsWith(FONT_FAMILY_CLASS_PREFIX) ||
                c.startsWith(FONT_WEIGHT_CLASS_PREFIX) || c.startsWith(TEXT_ALIGN_CLASS_PREFIX) ||
                c.startsWith(TEXT_CASE_CLASS_PREFIX) || c.startsWith(TEXT_EFFECT_CLASS_PREFIX) ||
                c.startsWith(ANIMATION_CLASS_PREFIX);

            // Get classes applied to the logo container (border, radius)
            const containerClasses = Array.from(this._logoContainer.classList)
                .filter(isRelevantClass)
                .map(c => `.${c}`) // Prepend dot for selector
                .join(''); // Join into single selector string (e.g., .dynamic-border.border-style-solid.border-radius-md)

            // Get classes applied to the logo text element
            const textClasses = Array.from(this._logoElement.classList)
                .filter(isRelevantClass)
                .map(c => `.${c}`)
                .join('');

            // --- Generate CSS Rules ---

            // Container Rule (includes border, padding, radius classes)
            css += `/* Styles for the logo container */\n`;
            css += `.logo-container${containerClasses} {\n`;
            css += `  /* Base layout for centering */\n`;
            css += `  position: relative;\n`;
            css += `  display: inline-flex; /* Use inline-flex for tighter fit */\n`;
            css += `  align-items: center;\n`;
            css += `  justify-content: center;\n`;
            // Include padding and radius directly using the CSS variables
            css += `  padding: var(--dynamic-border-padding, 10px);\n`; // Add fallback
            css += `  border-radius: var(--dynamic-border-radius, 0);\n`; // Add fallback
            // Note: Actual border style/effect is assumed to be defined by the applied classes
            css += `}\n\n`;

            // Text Rule (includes font, text, effect, animation classes)
            css += `/* Styles for the logo text itself */\n`;
            css += `.logo-text${textClasses} {\n`;
            // Font family, weight, alignment, case, effects, animation are handled by the classes applied

            // Styles controlled directly by CSS Variables
            css += `  font-size: var(--dynamic-font-size);\n`;
            css += `  letter-spacing: var(--dynamic-letter-spacing);\n`;
            css += `  transform: rotate(var(--dynamic-rotation));\n`;
            css += `  line-height: 1.2; /* Example base style */\n`;
            css += `  white-space: nowrap; /* Prevent wrapping */\n`;
            css += `  /* Add other base text styles as needed */\n`;

            // Apply current color or gradient based on mode
            if (this._currentSettings.textColorMode === 'gradient') {
                // Use the currently applied inline background-image style
                const currentGradient = this._logoElement.style.backgroundImage || 'none';
                css += `  background-image: ${currentGradient};\n`;
                css += `  -webkit-background-clip: text;\n  background-clip: text;\n`;
                css += `  color: transparent;\n  -webkit-text-fill-color: transparent;\n`;
            } else {
                // Use the currently applied inline color style
                const currentColor = this._logoElement.style.color || '#ffffff'; // Fallback
                css += `  color: ${currentColor};\n`;
                // Ensure gradient properties are reset
                css += `  background-image: none;\n`;
                css += `  background-clip: initial;\n  -webkit-background-clip: initial;\n`;
                css += `  -webkit-text-fill-color: initial;\n`;
            }
            css += `}\n\n`;

            // Include @keyframes if an animation is active and the helper function exists
            const activeAnimationClass = getPrefixedClass(this._logoElement, ANIMATION_CLASS_PREFIX);
            if (activeAnimationClass && activeAnimationClass !== 'anim-none' && typeof getActiveAnimationKeyframes === 'function') {
                try {
                     const animationName = activeAnimationClass.replace(ANIMATION_CLASS_PREFIX, '');
                     const keyframesCss = getActiveAnimationKeyframes(animationName);
                     if (keyframesCss) {
                          css += `/* Keyframes for active animation: ${animationName} */\n`;
                          css += keyframesCss + '\n\n';
                     }
                } catch (e) {
                     console.error("Error getting keyframes CSS:", e);
                }
            }

            // Optional: Include background pattern CSS if needed for standalone use
            const backgroundClass = Array.from(this._previewContainer.classList).find(c =>
                c.startsWith(BACKGROUND_CLASS_PREFIX) && !c.includes('gradient') && c !== 'bg-solid' && c !== 'bg-transparent'
            );
            if (backgroundClass) {
                 css += `/* Background pattern class applied: .${backgroundClass} */\n`;
                 css += `/* Note: You may need to include the full CSS definition for .${backgroundClass} */\n`;
                 css += `/* from your project's CSS file for this snippet to work standalone. */\n\n`;
            }


            return css.trim(); // Return the generated CSS string
        } catch (e) {
            console.error("Error generating CSS:", e);
            return `/* CSS Generation Error: ${e.message} \n Check console for details. */`;
        }
    },

    /**
     * Initializes the state of UI components that depend on others
     * (e.g., showing/hiding gradient controls based on color mode).
     * Called after initial settings are loaded and applied.
     * Also updates dynamic displays like range values and font previews.
     * @private
     */
    _initializeUIComponentsState() {
        console.log('[SM] Initializing dependent UI component states...');
        try {
            // Run handlers to set initial visibility of controls
            this._handleColorModeChange(this._currentSettings.textColorMode);
            this._handleGradientPresetChange(this._currentSettings.gradientPreset);
            this._handleBackgroundTypeChange(this._currentSettings.backgroundType);
            this._handleBackgroundGradientChange(this._currentSettings.backgroundGradientPreset);

            // Update visual previews/displays
            this._updateFontPreview(this._currentSettings.fontFamily);
            this._updateRangeValueDisplays(); // Ensure slider values are shown

            // Setup listeners for the reset confirmation modal
            this._setupResetButton();

            console.log('[SM] Dependent UI component states initialized.');
        } catch (e) {
             console.error("[SM] Error during UI component state initialization:", e);
        }
    },

    /**
     * Sets up the event listeners for the reset confirmation modal dialog.
     * Ensures listeners are attached only once.
     * @private
     */
    _setupResetButton() {
        const resetButton = document.getElementById('resetBtn');
        if (!resetButton || resetButton.dataset.listenerAttached === 'true') {
            // Already set up or button missing
            return;
        }

        const resetModal = document.getElementById('resetConfirmModal');
        const cancelBtn = document.getElementById('resetModalCancel');
        const confirmBtn = document.getElementById('resetModalConfirm');

        if (!resetModal || !cancelBtn || !confirmBtn) {
            console.warn('[SM] Reset confirmation modal elements (#resetConfirmModal, #resetModalCancel, #resetModalConfirm) not found.');
            return;
        }

        // Function to close the modal
        const closeModal = () => {
            resetModal.style.display = 'none';
            resetModal.classList.remove('active');
        };

        // Show modal when reset button is clicked
        resetButton.onclick = () => {
            resetModal.style.display = 'flex'; // Use flex to enable centering
            requestAnimationFrame(() => resetModal.classList.add('active')); // Trigger animation
        };

        // Close modal on cancel button click
        cancelBtn.onclick = closeModal;

        // Confirm reset: read reset type and call resetSettings
        confirmBtn.onclick = () => {
             // Use arrow function to maintain 'this' context for SettingsManager
            const resetType = document.querySelector('input[name="reset-type"]:checked')?.value || 'all';
            this.resetSettings(resetType); // Call the main reset method
            closeModal();
        };

        // Close modal if clicking outside the modal content
        resetModal.onclick = (e) => {
            if (e.target === resetModal) {
                closeModal();
            }
        };

        // Close modal on Escape key press
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && resetModal.classList.contains('active')) {
                closeModal();
            }
        });

        // Mark the reset button so we don't attach listeners multiple times
        resetButton.dataset.listenerAttached = 'true';
        console.log('[SM] Reset modal listeners attached.');
    },

    /**
     * Resets settings to their default values.
     * Can reset all settings or specific categories (text, style, background).
     * Applies the reset settings visually by calling `applySettings` with `forceUIUpdate=true`.
     * @param {string} [resetType='all'] - The category of settings to reset ('all', 'text', 'style', 'background').
     */
    resetSettings(resetType = 'all') {
        console.log(`[SM Resetting] Type: ${resetType}`);
        const defaults = this.getDefaults(); // Get a fresh copy of defaults
        let settingsToApply;

        if (resetType === 'all') {
            settingsToApply = { ...defaults }; // Reset everything to default
        } else {
            // Start with current settings and selectively reset parts
            settingsToApply = { ...this.getCurrentSettings() };

            // Define which settings belong to each category
            const categoryKeyMap = {
                text: [
                    'logoText', 'fontFamily', 'fontSize', 'letterSpacing',
                    'textCase', 'fontWeight', 'textAlign' // Added textAlign
                ],
                style: [
                    'textColorMode', 'solidColorPicker', 'gradientPreset',
                    'color1', 'color2', 'useColor3', 'color3', 'animationDirection', // Text gradient angle
                    'textShadow', 'textAnimation', 'animationSpeed', 'rotation' // Added rotation
                ],
                 border: [ // Added separate border category
                    'borderColorPicker', 'borderStyle', 'borderWidth', 'borderRadius',
                    'borderPadding'
                ],
                background: [
                    'backgroundType', 'backgroundColor', 'bgOpacity',
                    'backgroundGradientPreset', 'bgColor1', 'bgColor2', 'bgGradientDirection'
                ],
                // Export settings are typically not reset by category
            };

            // Get the keys for the selected category, default to all keys if category unknown
            const keysToReset = categoryKeyMap[resetType] || Object.keys(defaults);

            // Apply default values only for the keys in the selected category
            keysToReset.forEach(key => {
                if (defaults.hasOwnProperty(key)) { // Ensure key exists in defaults
                    settingsToApply[key] = defaults[key];
                }
            });
        }

        // Apply the reset settings, forcing UI and style updates
        this.applySettings(settingsToApply, true) // forceUIUpdate = true
            .then(() => {
                console.log(`[SM] Settings Reset (${resetType}) applied successfully.`);
                // Optionally notify the user via a global function or toast
                 if (typeof showToast === 'function') {
                     showToast({ message: `Settings Reset (${resetType})!`, type: 'success' });
                 }
            })
            .catch(err => {
                console.error("[SM] Error applying reset settings:", err);
                 if (typeof showAlert === 'function') {
                     showAlert("Failed to apply reset settings. Check console for details.", "error");
                 }
            });
    },

    /**
     * Loads settings from localStorage.
     * If settings are found, merges them with defaults to ensure new properties are included.
     * Includes a check for the saved font's existence in the dropdown (requires fontManager to run first).
     * If no settings are found or loading fails, uses default settings.
     */
    loadSavedSettings() {
        try {
            const savedSettingsJson = localStorage.getItem('logomakerSettings');
            if (savedSettingsJson) {
                const loadedSettings = JSON.parse(savedSettingsJson);

                // Merge loaded settings with defaults to handle new settings added
                // since the last save. Defaults provide the base structure.
                const defaults = this.getDefaults();
                const mergedSettings = {
                    ...defaults,
                    ...loadedSettings,
                    // Explicitly ensure potentially new properties introduced in v17
                    // exist, using loaded value if present, otherwise default.
                    // Adjust this list if more properties are added later.
                    borderRadius: loadedSettings.borderRadius ?? defaults.borderRadius,
                    borderPadding: loadedSettings.borderPadding ?? defaults.borderPadding,
                    borderWidth: loadedSettings.borderWidth ?? defaults.borderWidth
                };

                this._currentSettings = mergedSettings;

                // --- Font Check ---
                // The font list dropdown might not be populated immediately.
                // Delay this check slightly to give fontManager time to populate the dropdown.
                setTimeout(() => {
                    const fontDropdown = document.getElementById('fontFamily');
                    const savedFontFamily = this._currentSettings.fontFamily;
                    if (fontDropdown && savedFontFamily) {
                        // Check if an option with the saved font's value exists
                        const fontOptionExists = fontDropdown.querySelector(`option[value="${CSS.escape(savedFontFamily)}"]`);
                        if (!fontOptionExists) {
                            console.warn(`[SM] Saved font '${savedFontFamily}' not found in the dropdown. It might have been removed or renamed. Reverting to default font '${DEFAULT_SETTINGS.fontFamily}'.`);
                            this._currentSettings.fontFamily = DEFAULT_SETTINGS.fontFamily;
                            // Optionally, update the UI dropdown value here if applySettings hasn't run yet
                            // fontDropdown.value = DEFAULT_SETTINGS.fontFamily;
                            // Optionally, trigger applySettings again if needed, but usually init flow handles this.
                        }
                    }
                }, 500); // Adjust delay if needed

                console.log('[SM] Loaded and merged settings from localStorage.');
            } else {
                // No saved settings found, use a deep copy of the defaults
                this._currentSettings = this.getDefaults();
                console.log('[SM] No saved settings found in localStorage, using defaults.');
            }
        } catch (err) {
            console.error('[SM] Error loading or parsing settings from localStorage:', err);
            // Fallback to defaults in case of any error
            this._currentSettings = this.getDefaults();
            if(typeof showAlert === 'function') {
                showAlert('Failed to load saved settings. Using default values.', 'warning');
            }
        }
    },

    /**
     * Saves the current settings state to localStorage.
     */
    saveCurrentSettings() {
        try {
            localStorage.setItem('logomakerSettings', JSON.stringify(this._currentSettings));
        } catch (err) {
            console.error('[SM] Error saving settings to localStorage:', err);
             if(typeof showAlert === 'function') {
                 showAlert('Could not save settings. Storage might be full or disabled.', 'error');
             }
        }
    },

    /**
     * Registers a listener function to be called whenever settings change.
     * @param {Function} listener - The callback function. It will receive the current settings object as an argument.
     */
    addSettingsChangeListener(listener) {
        if (typeof listener === 'function' && !this._listeners.includes(listener)) {
            this._listeners.push(listener);
        }
    },

    /**
     * Unregisters a previously registered settings change listener.
     * @param {Function} listener - The listener function to remove.
     */
    removeSettingsChangeListener(listener) {
        this._listeners = this._listeners.filter(l => l !== listener);
    },

}; // End of SettingsManager object literal

// Export the SettingsManager object for use in other modules (e.g., main.js)
export default SettingsManager;