/**
 * settingsManager.js (Version 17.3 - COMPLETE + Debounce Fix + Robustness + Comments)
 * ====================================================================================
 * Manages UI state, applies styles via CSS classes & CSS Variables, handles settings persistence (localStorage),
 * and interacts with fontManager.js. Includes support for various text/border effects, gradients, animations,
 * border radius, border padding, and consistent class application for exports.
 * Adds debouncing (400ms) to font family application to prevent issues with rapid changes.
 * Includes checks for element existence before manipulation to improve robustness.
 *
 * @module SettingsManager
 * @requires fontManager.js (expects `getFontDataAsync` function to be globally available via window.getFontDataAsync)
 * @requires cssUtils.js (optional, provides `CSSUtils.applyBorderRadius`, `CSSUtils.applyBorderPadding`, `CSSUtils.extractRGB`)
 * @listens input Event on various input/range elements
 * @listens change Event on various select/checkbox/color elements
 * @fires settings-update - Custom event or listener notification when settings change (via `_triggerSettingsUpdate`)
 */

// --- Constants for CSS Class Prefixes ---
// Used to manage CSS classes applied to elements, ensuring easy removal and preventing conflicts.
const FONT_FAMILY_CLASS_PREFIX = 'font-family-';
const FONT_WEIGHT_CLASS_PREFIX = 'font-weight-';
const TEXT_ALIGN_CLASS_PREFIX = 'text-align-';
const TEXT_CASE_CLASS_PREFIX = 'text-case-';
const TEXT_EFFECT_CLASS_PREFIX = 'text-effect-'; // Unified prefix for glows, shadows, etc.
const BORDER_STYLE_CLASS_PREFIX = 'border-style-'; // For static border styles (solid, dashed)
const BORDER_EFFECT_CLASS_PREFIX = 'border-effect-'; // For dynamic border effects (glow, pulse)
const BORDER_RADIUS_CLASS_PREFIX = 'border-radius-'; // For border radius shapes/sizes
const ANIMATION_CLASS_PREFIX = 'anim-'; // For text animations
const PREVIEW_SIZE_CLASS_PREFIX = 'preview-size-'; // For preview container size
const BACKGROUND_CLASS_PREFIX = 'bg-'; // For background types/patterns

// --- Default Settings ---
/**
 * Default configuration values for all settings managed by SettingsManager.
 * Used for initial state and resetting. Values should match HTML control defaults where applicable.
 * @const {object} DEFAULT_SETTINGS
 */
const DEFAULT_SETTINGS = {
    logoText: 'Manic',
    fontFamily: 'Orbitron', // Default Font
    fontSize: '100',
    letterSpacing: '0.03',
    textCase: 'none',
    fontWeight: '700',
    textColorMode: 'gradient',
    solidColorPicker: '#ffffff',
    gradientPreset: 'primary-gradient',
    color1: '#FF1493', color2: '#8A2BE2', useColor3: false, color3: '#FF4500',
    textShadow: 'text-effect-none',
    borderColorPicker: '#ffffff',
    borderStyle: 'border-none',
    borderWidth: '2',
    borderRadius: 'none',
    customBorderRadius: '',
    borderPadding: '10',
    textAlign: 'center',
    rotation: '0',
    textAnimation: 'anim-none',
    animationSpeed: '1',
    animationDirection: '45', // Text gradient angle
    backgroundType: 'bg-solid',
    backgroundColor: '#000000',
    bgOpacity: '1',
    backgroundGradientPreset: 'bg-primary-gradient',
    bgColor1: '#3a1c71', bgColor2: '#ffaf7b',
    bgGradientDirection: '90', // Background gradient angle
    previewSize: 'preview-size-medium',
    exportWidth: '800',
    exportHeight: '400',
    exportQuality: '95',
    exportTransparent: false,
    exportFrames: '15',
    exportFrameRate: '10',
    aspectRatioPreset: 'auto',
    aspectRatioLock: false,
};

// --- Mapping Tables ---
// Translate dropdown values into specific CSS classes for consistent styling.
const BORDER_STYLE_MAP = {
    'border-none': 'border-style-none', 'border-solid': 'border-style-solid', 'border-double': 'border-style-double',
    'border-dashed': 'border-style-dashed', 'border-dotted': 'border-style-dotted', 'border-groove': 'border-style-groove',
    'border-ridge': 'border-style-ridge', 'border-inset': 'border-style-inset', 'border-outset': 'border-style-outset',
    'border-pixel': 'border-style-pixel', 'border-thick': 'border-style-thick',
    'border-glow': 'border-effect-glow-soft', 'border-neon': 'border-effect-neon-animated',
    'border-pulse': 'border-effect-glow-pulse', 'border-gradient': 'border-effect-gradient-animated'
};
const TEXT_EFFECT_MAP = {
    'text-glow-none': 'text-effect-none', 'text-shadow-none': 'text-effect-none', 'text-effect-none': 'text-effect-none',
    'text-glow-soft': 'text-effect-glow-soft', 'text-glow-medium': 'text-effect-glow-medium', 'text-glow-strong': 'text-effect-glow-strong',
    'text-glow-sharp': 'text-effect-glow-sharp', 'text-glow-neon': 'text-effect-neon-primary', 'text-shadow-soft': 'text-effect-shadow-soft-md',
    'text-glow-hard': 'text-effect-shadow-hard-md', 'text-shadow-hard-sm': 'text-effect-shadow-hard-sm', 'text-shadow-hard-md': 'text-effect-shadow-hard-md',
    'text-shadow-hard-lg': 'text-effect-shadow-hard-lg', 'text-shadow-hard-xl': 'text-effect-shadow-hard-xl', 'text-glow-outline': 'text-effect-outline-thin',
    'text-glow-retro': 'text-effect-shadow-retro', 'text-glow-emboss': 'text-effect-emboss', 'text-glow-inset': 'text-effect-inset',
    'text-effect-blend-screen': 'text-effect-blend-screen', 'text-effect-blend-multiply': 'text-effect-blend-multiply',
    'text-effect-blend-overlay': 'text-effect-blend-overlay', 'text-effect-blend-difference': 'text-effect-blend-difference'
};
const BORDER_RADIUS_MAP = {
     'none': 'border-radius-none', 'square': 'border-radius-none', 'rounded-sm': 'border-radius-sm',
     'rounded-md': 'border-radius-md', 'rounded-lg': 'border-radius-lg', 'pill': 'border-radius-pill',
     'circle': 'border-radius-circle', 'oval': 'border-radius-oval'
};

// --- SettingsManager Object ---
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
    /** @private @type {boolean} Flag to prevent aspect ratio updates from looping */
    _isUpdatingAspectRatio: false,

    // --- Debounce Timer for Font Changes ---
    /** @private @type {?number} Timeout ID for debouncing font family changes */
    _fontApplyDebounceTimer: null,
    /** @private @const {number} Delay in milliseconds for font application debounce */
    _FONT_APPLY_DEBOUNCE_DELAY: 950, // Increased delay (milliseconds)

    // --- Getters ---
    /**
     * Returns a deep copy of the default settings.
     * @returns {object} A deep copy of DEFAULT_SETTINGS.
     */
    getDefaults() {
        try {
            return structuredClone(DEFAULT_SETTINGS);
        } catch (e) {
            console.warn("[SM] structuredClone unavailable, using JSON fallback for getDefaults().");
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
            console.warn("[SM] structuredClone unavailable, using JSON fallback for getCurrentSettings().");
            return JSON.parse(JSON.stringify(this._currentSettings));
        }
    },

    // --- Initialization ---
    /**
     * Initializes the SettingsManager. Should only be called once.
     * Caches DOM elements, checks dependencies, loads saved settings, sets up event listeners,
     * applies initial styles, and initializes dependent UI states.
     * @async
     * @returns {Promise<void>} Resolves when initialization is complete or rejects on critical failure.
     */
    async init() {
        if (this._isInitialized) {
            console.warn('[SM] Already initialized.');
            return;
        }
        console.log('[SM] Initialize (v17.3 - COMPLETE + Font Debounce 400ms + Robustness)...'); // Updated version

        // Cache essential DOM elements
        this._logoElement = document.querySelector('.logo-text');
        this._logoContainer = document.querySelector('.logo-container');
        this._previewContainer = document.getElementById('previewContainer');

        // CRITICAL CHECK: Ensure core elements exist before proceeding.
        if (!this._logoElement || !this._logoContainer || !this._previewContainer) {
            console.error("[SM CRITICAL] Core preview elements (.logo-text, .logo-container, #previewContainer) missing! Cannot initialize. Check HTML structure.");
            // Optionally show a user-facing error message here using showAlert if available
            if (typeof showAlert === 'function') showAlert("Critical Error: UI elements missing.", "error");
            return Promise.reject(new Error("Missing core preview elements."));
        }

        // Check critical dependencies (fontManager should expose this globally)
        // Note: Adjust this check if getFontDataAsync is imported differently
        if (typeof window.getFontDataAsync !== 'function') {
            console.error("[SM CRITICAL] `window.getFontDataAsync` function not found! Ensure fontManager.js loads and exposes it globally BEFORE settingsManager.js runs.");
             if (typeof showAlert === 'function') showAlert("Critical Error: Font system unavailable.", "error");
            return Promise.reject(new Error("Missing dependency: window.getFontDataAsync"));
        }

        // Check optional dependencies
        if (!window.CSSUtils) {
            console.warn("[SM] CSSUtils not found! Advanced border/padding features may use fallback styles.");
        }

        try {
            console.log('[SM] Assuming Font Manager initialized.');
            this.loadSavedSettings(); // Load settings from localStorage or use defaults
            this._setupEventListeners(); // Bind listeners to UI controls AFTER loading settings
            console.log('[SM] Applying initial settings to UI and preview...');
            // Apply loaded settings visually, forcing UI update and style application on initial load
            await this.applySettings(this._currentSettings, true, true); // forceUIUpdate=true, isInitialLoad=true
            // Set initial visibility/state of dependent controls (like gradient pickers)
            this._initializeUIComponentsState();
            this._isInitialized = true;
            console.log('[SM] Initialization complete.');
        } catch (error) {
            console.error("[SM] Initialization failed during setup:", error);
            if (typeof showAlert === 'function') { // Use global notification if available
                showAlert(`Initialization Error: ${error.message}`, 'error');
            }
            return Promise.reject(error); // Propagate the error
        }
    },

    // --- Event Listener Setup ---
    /**
     * Sets up event listeners for all relevant UI controls.
     * Checks for element existence before binding.
     * @private
     */
    _setupEventListeners() {
        console.log('[SM] Setting up event listeners...');
        // Robustness check - ensure at least one critical input exists before proceeding
        if (!document.getElementById('logoText')) {
            console.error("[SM] Cannot find #logoText input during listener setup. Check HTML structure.");
            return;
        }

        // Bind listeners using helper functions for different input types
        // Each helper includes checks for element existence.
        this._bindInputListener('logoText');
        this._bindSelectListener('fontFamily'); // <= Uses debounce logic internally
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
        this._bindRangeInputListener('animationSpeed'); // Special handling
        this._bindRangeInputListener('animationDirection', '--gradient-direction', 'deg'); // Text gradient angle
        this._bindRangeInputListener('bgGradientDirection', '--bg-gradient-direction', 'deg'); // Background gradient angle
        this._bindRangeInputListener('bgOpacity'); // Direct style
        this._bindColorInputListener('solidColorPicker'); // For solid text color
        this._bindColorInputListener('color1'); // For custom text gradient
        this._bindColorInputListener('color2'); // For custom text gradient
        this._bindColorInputListener('color3'); // For custom text gradient
        this._bindColorInputListener('borderColorPicker', '--dynamic-border-color'); // Sets CSS var + RGB var
        this._bindColorInputListener('backgroundColor'); // For solid background
        this._bindColorInputListener('bgColor1'); // For custom background gradient
        this._bindColorInputListener('bgColor2'); // For custom background gradient
        this._bindCheckboxListener('useColor3'); // Toggles color3 picker
        this._bindCheckboxListener('exportTransparent'); // Export setting
        this._bindNumberInputListener('exportWidth'); // Export setting / Aspect Ratio
        this._bindNumberInputListener('exportHeight'); // Export setting / Aspect Ratio
        this._bindRangeInputListener('exportQuality'); // Export setting
        this._bindNumberInputListener('exportFrames'); // Export setting
        this._bindRangeInputListener('exportFrameRate'); // Export setting
        this._bindCustomBorderRadiusListener('customBorderRadius'); // Input for specific px radius
        this._bindSelectListener('aspectRatioPreset'); // Aspect Ratio control
        this._bindCheckboxListener('aspectRatioLock'); // Aspect Ratio control

        console.log('[SM] Event listeners setup done.');
    },

    // --- Range Value Display ---
    /**
     * Updates the text content of all associated range value display spans
     * (e.g., the '10px' text next to a slider). Includes number inputs if they have display spans.
     * @private
     */
    _updateRangeValueDisplays() {
        const controlsWithDisplay = [
            { id: 'letterSpacing', unit: 'em' }, { id: 'rotation', unit: 'deg' },
            { id: 'animationSpeed', unit: 'x' }, { id: 'animationDirection', unit: 'deg' },
            { id: 'bgOpacity', unit: '' }, { id: 'exportQuality', unit: '%' },
            { id: 'exportFrameRate', unit: 'FPS' }, { id: 'bgGradientDirection', unit: 'deg' },
            // Add number inputs that have associated displays
            { id: 'fontSize', unit: 'px' },
            { id: 'borderWidth', unit: 'px' },
            { id: 'borderPadding', unit: 'px' },
            { id: 'exportWidth', unit: 'px' }, // Assuming these have displays
            { id: 'exportHeight', unit: 'px' },
            { id: 'exportFrames', unit: '' }
        ];
        controlsWithDisplay.forEach(config => {
            const input = document.getElementById(config.id);
            if (input) {
                // Find the display span, typically a sibling or child of parent with class .range-value-display
                const display = input.parentElement?.querySelector('.range-value-display');
                if (display) {
                    try {
                        let unitDisplay = '';
                        // Handle special units differently for spacing/clarity
                        if (config.unit === 'x') unitDisplay = config.unit; // e.g., '1x'
                        else if (config.unit === 'FPS') unitDisplay = '\u00A0' + config.unit; // Non-breaking space + FPS
                        else if (config.unit) unitDisplay = config.unit; // e.g., 'em', 'deg', '%'

                        const value = input.value ?? ''; // Handle potential null/undefined value
                        display.textContent = value + unitDisplay;
                    } catch (e) {
                        console.warn(`[SM] Error updating display for #${config.id}:`, e);
                        if(display) display.textContent = 'ERR'; // Indicate error on display
                    }
                }
                // No warning if display span is missing, it's just a visual aid.
            }
            // No warning if input itself is missing, binding functions handle that.
        });
    },

    // --- Listener Binder Functions (Include null checks) ---

    /** @private Binds listener to a standard text input */
    _bindInputListener(inputId) {
        const input = document.getElementById(inputId);
        // Robustness: Check if element exists
        if (!input) { console.warn(`[SM Bind] Input element #${inputId} not found.`); return; }

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this._currentSettings[inputId] = value;

            // Special handling for the main logo text input
            if (inputId === 'logoText' && this._logoElement) {
                this._logoElement.textContent = value;
                this._logoElement.setAttribute('data-text', value); // Keep data-text attribute synced
                this._updateSizeIndicator(); // Text change affects size
            }
            this._triggerSettingsUpdate(); // Notify listeners and save
        });
    },

    /** @private Binds listener to a select dropdown, handles fontFamily debounce */
    _bindSelectListener(selectId) {
        const select = document.getElementById(selectId);
        // Robustness: Check if element exists
        if (!select) { console.warn(`[SM Bind] Select element #${selectId} not found.`); return; }

        select.addEventListener('change', (e) => {
            const value = e.target.value;
            console.log(`[SM Select] #${selectId} changed to: '${value}'`);
            this._currentSettings[selectId] = value; // Update setting immediately

            // --- Debounce Logic specifically for Font Family ---
            if (selectId === 'fontFamily') {
                clearTimeout(this._fontApplyDebounceTimer); // Clear previous pending application
                this._updateFontPreview(value); // Update small preview immediately

                // Schedule the actual font application after a pause
                this._fontApplyDebounceTimer = setTimeout(async () => {
                    console.log(`[SM Debounce] Applying debounced font: ${this._currentSettings.fontFamily}`);
                    try {
                        // Ensure fontManager function is available globally
                        if (typeof window.getFontDataAsync !== 'function') {
                            throw new Error("window.getFontDataAsync is not available.");
                        }
                        await this._applyFontFamily(this._currentSettings.fontFamily); // Apply the LATEST font stored
                        this._triggerSettingsUpdate(); // Save/Notify AFTER successful application
                    } catch (fontApplyError) {
                        console.error("[SM Debounce] Error applying debounced font:", fontApplyError);
                        // Still trigger update to save the selected font name, even if application failed
                        this._triggerSettingsUpdate();
                    }
                }, this._FONT_APPLY_DEBOUNCE_DELAY);

                // NOTE: Do NOT call _triggerSettingsUpdate here for fontFamily, it's handled in setTimeout.
            }
            // --- End Debounce Logic ---
            else {
                // --- Handle other select changes immediately ---
                let styleUpdateNeeded = true; // Flag to track if styles were directly affected
                switch (selectId) {
                    case 'fontWeight': this._applyFontWeight(value); break;
                    case 'textAlign': this._applyTextAlign(value); break;
                    case 'textCase': this._applyTextCase(value); break;
                    case 'textShadow': this._applyTextEffect(value); break;
                    case 'borderStyle': this._applyBorderStyle(value); break;
                    case 'borderRadius': this._applyBorderRadius(value); break;
                    case 'textAnimation': this._applyTextAnimation(value); break;
                    case 'previewSize': this._applyPreviewSize(value); break;
                    case 'textColorMode': this._handleColorModeChange(value); break;
                    case 'gradientPreset': this._handleGradientPresetChange(value); break;
                    case 'backgroundType': this._handleBackgroundTypeChange(value); break;
                    case 'backgroundGradientPreset': this._handleBackgroundGradientChange(value); break;
                    case 'aspectRatioPreset': this._handleAspectPresetChange(e.target); break; // Aspect ratio might not visually change preview instantly
                    default:
                        console.log(`[SM] Select change for #${selectId} noted, likely an export setting.`);
                        styleUpdateNeeded = false; // Don't trigger full update just for export settings etc.
                }
                // Trigger update immediately for non-font-family selects
                // Also trigger if it was a control that affects UI visibility even if no direct style apply above
                if (styleUpdateNeeded || ['textColorMode', 'gradientPreset', 'backgroundType', 'backgroundGradientPreset'].includes(selectId)) {
                    this._triggerSettingsUpdate();
                } else {
                     this.saveCurrentSettings(); // Just save non-visual settings
                }
            }
        });
    },

    /** @private Binds listener to a number input */
    _bindNumberInputListener(inputId, cssVar = null, unit = '') {
        const input = document.getElementById(inputId);
        // Robustness: Check if element exists
        if (!input) { console.warn(`[SM Bind] Number input element #${inputId} not found.`); return; }

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this._currentSettings[inputId] = String(value); // Store as string

            // Handle Aspect ratio linking
            if (inputId === 'exportWidth' || inputId === 'exportHeight') {
                this._handleDimensionChange(inputId);
                // Update is triggered within _handleDimensionChange or by the input event itself
            }
            // Apply CSS Variable if specified
            else if (cssVar) {
                document.documentElement.style.setProperty(cssVar, `${value}${unit}`);
                // Trigger size update or re-apply styles if necessary
                if (cssVar === '--dynamic-font-size') this._updateSizeIndicator();
                else if (cssVar === '--dynamic-border-width') {
                    // Re-apply border style which inherently applies width variable
                    if (this._currentSettings.borderStyle && this._currentSettings.borderStyle !== 'border-none') {
                        this._applyBorderStyle(this._currentSettings.borderStyle);
                    }
                } else if (cssVar === '--dynamic-border-padding') {
                    this._applyBorderPadding(value, unit); // Use helper which might use CSSUtils
                }
                 this._triggerSettingsUpdate(); // Trigger for CSS var changes
            } else if (inputId === 'customBorderRadius') {
                this._applyCustomBorderRadius(value);
                 this._triggerSettingsUpdate(); // Trigger for custom radius change
            } else {
                 // Likely just an export setting, only save, don't trigger full update
                 this.saveCurrentSettings();
            }
        });
    },

     /** @private Binds listener to a range input */
     _bindRangeInputListener(inputId, cssVar = null, unit = '') {
        const input = document.getElementById(inputId);
        // Robustness: Check if element exists
        if (!input) { console.warn(`[SM Bind] Range input element #${inputId} not found.`); return; }

        const display = input.parentElement?.querySelector('.range-value-display');
        // Helper to update the visual display text (e.g., "10px")
        const updateDisplay = (val) => {
            if(display) { /* ... (keep updateDisplay logic) ... */
                 let unitDisplay='';if(unit==='x')unitDisplay=unit;else if(unit==='FPS')unitDisplay=' '+unit;else if(unit)unitDisplay=unit;display.textContent=(val??'')+unitDisplay;
            }
        };

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this._currentSettings[inputId] = String(value);
            updateDisplay(value); // Update visual display immediately

            let updateNeeded = true; // Assume update needed unless it's just an export setting

            // Apply CSS variable if specified
            if (cssVar) {
                document.documentElement.style.setProperty(cssVar, `${value}${unit}`);
                if (cssVar === '--dynamic-letter-spacing') {
                    this._updateSizeIndicator(); // Letter spacing affects layout
                }
            }
            // Handle settings that need specific functions
            else if (inputId === 'animationSpeed') {
                this._applyAnimationSpeed(value);
            } else if (inputId === 'animationDirection') {
                document.documentElement.style.setProperty('--gradient-direction', `${value}deg`);
                // Re-apply text gradient if active to show new angle
                if (this._currentSettings.textColorMode === 'gradient') { this._applyGradientToLogo(); }
            } else if (inputId === 'bgGradientDirection') {
                document.documentElement.style.setProperty('--bg-gradient-direction', `${value}deg`);
                 // Re-apply background gradient if active to show new angle
                if (this._currentSettings.backgroundType?.includes('gradient')) { this._applyBackgroundGradient(); }
            } else if (inputId === 'bgOpacity') {
                if (this._previewContainer) { this._previewContainer.style.opacity = value; }
            } else if (inputId === 'exportQuality' || inputId === 'exportFrameRate') {
                 updateNeeded = false; // Export settings don't need immediate full trigger
                 this.saveCurrentSettings(); // Just save
            }

            if (updateNeeded) {
                 this._triggerSettingsUpdate();
            }
        });
    },

    /** @private Binds listener to a checkbox */
    _bindCheckboxListener(checkboxId) {
        const checkbox = document.getElementById(checkboxId);
        // Robustness: Check if element exists
        if (!checkbox) { console.warn(`[SM Bind] Checkbox element #${checkboxId} not found.`); return; }

        checkbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            this._currentSettings[checkboxId] = isChecked; // Store boolean

            // Specific actions based on checkbox ID
            if (checkboxId === 'useColor3') {
                document.getElementById('color3Control')?.classList.toggle('hidden', !isChecked);
                // Re-apply gradient if active and custom
                if (this._currentSettings.textColorMode === 'gradient' && this._currentSettings.gradientPreset === 'custom') {
                    this._applyGradientToLogo();
                }
                console.log(`[SM] Toggled useColor3: ${isChecked}`);
                 this._triggerSettingsUpdate(); // Affects appearance
            } else if (checkboxId === 'exportTransparent') {
                console.log(`[SM] Toggled exportTransparent: ${isChecked}`);
                this.saveCurrentSettings(); // Just save export setting
            } else if (checkboxId === 'aspectRatioLock') {
                console.log(`[SM] Aspect Ratio Lock toggled: ${isChecked}`);
                // Optionally sync dimensions immediately upon locking
                // if (isChecked) { this._syncDimensionsOnLock(); } // (Need _syncDimensionsOnLock func)
                this._triggerSettingsUpdate(); // Save lock state and potentially updated dimensions
            } else {
                 this._triggerSettingsUpdate(); // Trigger for other checkboxes if needed
            }
        });
    },

    /** @private Binds listener to a color input */
    _bindColorInputListener(inputId, cssVar = null) {
        const input = document.getElementById(inputId);
        // Robustness: Check if element exists
        if (!input) { console.warn(`[SM Bind] Color input element #${inputId} not found.`); return; }

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this._currentSettings[inputId] = value;

            if (cssVar) {
                document.documentElement.style.setProperty(cssVar, value);
                if (cssVar === '--dynamic-border-color') {
                    // Update RGB version as well
                    let rgbValue = "255, 255, 255";
                    try { rgbValue = (window.CSSUtils?.extractRGB || this._extractColorRGB)(value); }
                    catch (err) { console.error(`[SM] Error extracting RGB from ${value}:`, err); }
                    document.documentElement.style.setProperty('--dynamic-border-color-rgb', rgbValue);
                    // Re-apply border style if needed for effects
                    if (this._currentSettings.borderStyle && this._currentSettings.borderStyle !== 'border-none') {
                        this._applyBorderStyle(this._currentSettings.borderStyle);
                    }
                }
            } else { // Handle colors without a direct CSS var binding
                switch (inputId) {
                    case 'solidColorPicker': if (this._currentSettings.textColorMode === 'solid') { this._applySolidTextColor(value); } break;
                    case 'color1': case 'color2': case 'color3': if (this._currentSettings.textColorMode === 'gradient' && this._currentSettings.gradientPreset === 'custom') { this._applyGradientToLogo(); } break;
                    case 'backgroundColor': if (this._currentSettings.backgroundType === 'bg-solid') { this._applySolidBgColor(value); } break;
                    case 'bgColor1': case 'bgColor2': if (this._currentSettings.backgroundType?.includes('gradient') && this._currentSettings.backgroundGradientPreset === 'custom') { this._applyBackgroundGradient(); } break;
                }
            }
            this._triggerSettingsUpdate();
        });
    },

    /** @private Binds listener for custom border radius input */
    _bindCustomBorderRadiusListener(inputId) {
        const input = document.getElementById(inputId);
        // Robustness: Check if element exists
        if (!input) { console.warn(`[SM Bind] Custom border radius input #${inputId} not found.`); return; }

        input.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            this._currentSettings[inputId] = value;
            this._applyCustomBorderRadius(value); // Apply/remove style based on input
            this._triggerSettingsUpdate();
        });
    },

    // --- Helper: Extract RGB Fallback ---
    /** @private Fallback to extract "R, G, B" from hex/rgb color string */
    _extractColorRGB(color) {
        const defaultRgb = "255, 255, 255";
        if (!color || typeof color !== 'string') return defaultRgb;
        // Simple Hex handling (#RGB or #RRGGBB)
        if (color.startsWith('#')) {
            const hex = color.slice(1); let r, g, b;
            try {
                if (hex.length === 3) { r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16); }
                else if (hex.length === 6) { r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16); }
                else { return defaultRgb; }
                if (isNaN(r) || isNaN(g) || isNaN(b)) { return defaultRgb; }
                return `${r}, ${g}, ${b}`;
            } catch { return defaultRgb; }
        }
        // Simple RGB handling (rgb(R, G, B))
        if (color.toLowerCase().startsWith('rgb(')) {
            const match = color.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
            if (match) { return `${match[1]}, ${match[2]}, ${match[3]}`; }
        }
        console.warn(`[SM Fallback] Could not parse color '${color}' for RGB.`);
        return defaultRgb;
    },

    // --- Style Application Methods ---

    /**
     * Applies the specified font family to the logo element.
     * Handles async loading, shows toasts, applies CSS class. Now uses global getFontDataAsync.
     * @private
     * @async
     * @param {string} fontFamily - The font family name.
     * @returns {Promise<void>}
     */
    async _applyFontFamily(fontFamily) {
        if (!this._logoElement) { console.error("[SM ApplyFont] Logo element missing."); return Promise.reject(new Error("Logo element missing.")); }
        if (!fontFamily) { console.warn("[SM ApplyFont] No font family specified. Applying fallback."); this._applyClass(this._logoElement, 'font-family-fallback', FONT_FAMILY_CLASS_PREFIX); this._displayLicenseInfo(null); this._applyFontWeight(DEFAULT_SETTINGS.fontWeight); return; }

        // Check dependency
        if (typeof window.getFontDataAsync !== 'function') { console.error("[SM ApplyFont] window.getFontDataAsync missing!"); this._applyClass(this._logoElement, 'font-family-fallback', FONT_FAMILY_CLASS_PREFIX); return Promise.reject(new Error("getFontDataAsync unavailable.")); }

        // Optimization: Skip if already applied
        const expectedClassName = FONT_FAMILY_CLASS_PREFIX + this._sanitizeForClassName(fontFamily);
        if (this._logoElement.classList.contains(expectedClassName)) { console.log(`[SM ApplyFont] Font "${fontFamily}" already applied. Syncing weight.`); this._applyFontWeight(this._currentSettings.fontWeight); this._updateSizeIndicator(); return; }

        console.log(`[SM] Applying Font Family: ${fontFamily}`);
        this._applyClass(this._logoElement, 'font-loading', FONT_FAMILY_CLASS_PREFIX);

        // Use global toast function or console log
        const showAppToast = window.showToast || ((config) => console.log(`[Toast (${config.type || 'info'})] ${config.message}`));
        const loadingToast = { message: `Loading font "${fontFamily}"...`, type: 'info', duration: 1500 }; // Use options object
        showAppToast(loadingToast);

        try {
            const fontData = await window.getFontDataAsync(fontFamily); // Use global function
            if (fontData) {
                const className = FONT_FAMILY_CLASS_PREFIX + this._sanitizeForClassName(fontFamily);
                this._applyClass(this._logoElement, className, FONT_FAMILY_CLASS_PREFIX);
                this._logoElement.classList.remove('font-loading'); // Ensure loading class removed on success
                this._displayLicenseInfo(fontData.licenseText);
                this._applyFontWeight(this._currentSettings.fontWeight); // Re-apply selected weight
                showAppToast({ message: `Font "${fontFamily}" loaded.`, type: 'success' });
            } else {
                throw new Error(`Font data not found for ${fontFamily}`); // Handle null return from fontManager
            }
        } catch (err) {
            console.error(`[SM] Error setting font family ${fontFamily}. Applying fallback.`, err);
            this._applyClass(this._logoElement, 'font-family-fallback', FONT_FAMILY_CLASS_PREFIX);
            this._displayLicenseInfo(null);
            this._applyFontWeight(DEFAULT_SETTINGS.fontWeight);
            showAppToast({ message: `Error loading "${fontFamily}". Using fallback.`, type: 'error' });
            // Rethrow if needed by caller (debounce logic doesn't strictly need it currently)
            // throw err;
        } finally {
            if (this._logoElement) this._logoElement.classList.remove('font-loading');
            this._updateSizeIndicator();
             // Assume toast system handles its own dismissal
        }
    },

    /** @private Applies font weight class */
    _applyFontWeight(weight) {
        if (!this._logoElement) return;
        const weightToApply = (weight === null || weight === undefined) ? DEFAULT_SETTINGS.fontWeight : weight;
        this._applyClass(this._logoElement, FONT_WEIGHT_CLASS_PREFIX + weightToApply, FONT_WEIGHT_CLASS_PREFIX);
    },

    /** @private Applies text alignment via container's justify-content */
    _applyTextAlign(align) {
        if (!this._logoContainer) { console.error("[SM ApplyTextAlign] Logo container missing."); return; }
        const validAlignments = ['left', 'center', 'right'];
        const alignToUse = (!align || !validAlignments.includes(align)) ? 'center' : align;
        const justification = alignToUse === 'left' ? 'flex-start' : alignToUse === 'right' ? 'flex-end' : 'center';
        console.log(`[SM] Applying alignment justify-content: ${justification}`);
        this._logoContainer.style.justifyContent = justification;
        validAlignments.forEach(a => this._logoContainer.classList.remove(`${TEXT_ALIGN_CLASS_PREFIX}${a}`)); // Remove old classes if any
        this._updateSizeIndicator();
    },

    /** @private Applies text case class */
    _applyTextCase(textCase) {
        if (!this._logoElement || !textCase) return;
        this._applyClass(this._logoElement, TEXT_CASE_CLASS_PREFIX + textCase, TEXT_CASE_CLASS_PREFIX);
        this._updateSizeIndicator();
    },

    /** @private Applies text effect class using mapping */
    _applyTextEffect(effectValue) {
        if (!this._logoElement || !effectValue) return;
        const effectClass = TEXT_EFFECT_MAP[effectValue] || 'text-effect-none';
        console.log(`[SM] Applying text effect: '${effectValue}' -> '${effectClass}'`);
        this._applyClass(this._logoElement, effectClass, TEXT_EFFECT_CLASS_PREFIX);
    },

    /** @private Applies border style/effect class using mapping */
    _applyBorderStyle(borderValue) {
        if (!this._logoContainer || !borderValue) return;
        const borderClass = BORDER_STYLE_MAP[borderValue] || 'border-style-none';
        console.log(`[SM] Applying border style: '${borderValue}' -> '${borderClass}'`);
        const isStatic = borderClass.startsWith(BORDER_STYLE_CLASS_PREFIX);
        const isEffect = borderClass.startsWith(BORDER_EFFECT_CLASS_PREFIX);
        const hasBorder = borderClass !== 'border-style-none';
        this._logoContainer.classList.toggle('dynamic-border', hasBorder);
        if (isStatic) { this._applyClass(this._logoContainer, borderClass, BORDER_STYLE_CLASS_PREFIX); this._applyClass(this._logoContainer, 'border-effect-none', BORDER_EFFECT_CLASS_PREFIX); }
        else if (isEffect) { this._applyClass(this._logoContainer, 'border-style-none', BORDER_STYLE_CLASS_PREFIX); this._applyClass(this._logoContainer, borderClass, BORDER_EFFECT_CLASS_PREFIX); }
        else { this._applyClass(this._logoContainer, 'border-style-none', BORDER_STYLE_CLASS_PREFIX); this._applyClass(this._logoContainer, 'border-effect-none', BORDER_EFFECT_CLASS_PREFIX); }
        // Re-apply related properties
        const bw = `${this._currentSettings.borderWidth || DEFAULT_SETTINGS.borderWidth}px`; document.documentElement.style.setProperty('--dynamic-border-width', bw);
        this._applyBorderPadding(this._currentSettings.borderPadding || DEFAULT_SETTINGS.borderPadding);
        this._applyBorderRadius(this._currentSettings.borderRadius || DEFAULT_SETTINGS.borderRadius);
        if (this._currentSettings.customBorderRadius) { this._applyCustomBorderRadius(this._currentSettings.customBorderRadius); }
    },

    /** @private Applies border radius class and style */
    _applyBorderRadius(radiusValue) {
        if (!this._logoContainer || !radiusValue) return;
        const radiusClass = BORDER_RADIUS_MAP[radiusValue] || 'border-radius-custom';
        console.log(`[SM] Applying border radius: '${radiusValue}' -> '${radiusClass}'`);
        this._applyClass(this._logoContainer, radiusClass, BORDER_RADIUS_CLASS_PREFIX);
        // Apply style via CSSUtils or fallback
        if (window.CSSUtils?.applyBorderRadius) { window.CSSUtils.applyBorderRadius(this._logoContainer, radiusValue); }
        else { /* ... (Keep fallback logic from previous full version) ... */
            let cssRadiusValue='0';switch(radiusValue){case'none':case'square':cssRadiusValue='0';break;case'circle':cssRadiusValue='50%';break;case'oval':cssRadiusValue='50%/30%';break;case'pill':cssRadiusValue='999px';break;case'rounded-sm':cssRadiusValue='4px';break;case'rounded-md':cssRadiusValue='8px';break;case'rounded-lg':cssRadiusValue='12px';break;default:if(/^\d+(\.\d+)?(px|em|rem|%)$/.test(radiusValue)){cssRadiusValue=radiusValue}else if(!isNaN(parseFloat(radiusValue))){cssRadiusValue=`${radiusValue}px`}else{console.warn(`[SM Fallback] Invalid border-radius '${radiusValue}'.`);cssRadiusValue='0'}}this._logoContainer.style.borderRadius=cssRadiusValue;document.documentElement.style.setProperty('--dynamic-border-radius',cssRadiusValue);console.log(`[SM Fallback] Applied border-radius:${cssRadiusValue}`)
        }
        // Ensure custom value overrides if set, or clear inline style if switching away from custom
        if (radiusValue !== 'custom' && this._currentSettings.customBorderRadius) { this._applyCustomBorderRadius(this._currentSettings.customBorderRadius); }
        else if (radiusValue !== 'custom') { this._logoContainer.style.borderRadius = ''; } // Clear inline style if switching to preset
    },

    /** @private Applies custom border radius style */
    _applyCustomBorderRadius(radiusValue) {
        if (!this._logoContainer) return;
        const radiusPx = radiusValue.trim();
        if (radiusPx !== '' && !isNaN(radiusPx) && Number(radiusPx) >= 0) {
            const valueToApply = `${Number(radiusPx)}px`;
            this._logoContainer.style.borderRadius = valueToApply; // Apply directly
            document.documentElement.style.setProperty('--dynamic-border-radius', valueToApply); // Update var
            console.log(`[SM] Applied custom border radius: ${valueToApply}`);
            // Optionally update dropdown to 'custom'
            const dropdown = document.getElementById('borderRadius'); if (dropdown && dropdown.value !== 'custom' && Array.from(dropdown.options).some(o=>o.value==='custom')) { dropdown.value = 'custom'; this._currentSettings.borderRadius = 'custom'; }
        } else if (radiusPx === '') { // If input cleared
            this._logoContainer.style.borderRadius = ''; // Remove inline style
            console.log('[SM] Cleared custom border radius.');
            this._applyBorderRadius(this._currentSettings.borderRadius || DEFAULT_SETTINGS.borderRadius); // Re-apply selected preset
        }
    },

     /** @private Applies border padding style */
    _applyBorderPadding(padding, unit = 'px') {
        if (!this._logoContainer) return;
        let normalizedPadding = String(padding || DEFAULT_SETTINGS.borderPadding); // Use default if null/undefined
        if (/^\d+(\.\d+)?$/.test(normalizedPadding)) { normalizedPadding = `${normalizedPadding}${unit}`; }
        if (window.CSSUtils?.applyBorderPadding) { window.CSSUtils.applyBorderPadding(this._logoContainer, normalizedPadding); }
        else { this._logoContainer.style.padding = normalizedPadding; document.documentElement.style.setProperty('--dynamic-border-padding', normalizedPadding); console.log(`[SM Fallback] Applied padding: ${normalizedPadding}`); }
    },

    /** @private Applies text animation class and data-text attribute */
    _applyTextAnimation(animValue) {
        if (!this._logoElement || !animValue) return;
        this._applyClass(this._logoElement, animValue, ANIMATION_CLASS_PREFIX);
        this._applyAnimationSpeed(this._currentSettings.animationSpeed);
        const needsDataText = ['anim-glitch', 'anim-reveal'];
        if (needsDataText.includes(animValue)) { const currentText = this._logoElement.textContent || ''; this._logoElement.setAttribute('data-text', currentText); console.log(`[SM] Applied data-text for ${animValue}: "${currentText}"`); }
        else { this._logoElement.removeAttribute('data-text'); }
    },

    /** @private Applies preview container size class */
    _applyPreviewSize(sizeValue) {
        if (!this._previewContainer || !sizeValue) return;
        this._applyClass(this._previewContainer, sizeValue, PREVIEW_SIZE_CLASS_PREFIX);
        this._updateSizeIndicator();
    },

    // --- Complex State Handlers ---
    /** @private Handles text color mode change */
    _handleColorModeChange(mode) { /* ... Keep logic from previous full version ... */
        const isSolid=mode==='solid';document.getElementById('solidColorPickerGroup')?.classList.toggle('hidden',!isSolid);document.getElementById('gradientPresetGroup')?.classList.toggle('hidden',isSolid);const isCustomGradient=!isSolid&&this._currentSettings.gradientPreset==='custom';document.getElementById('customGradientControls')?.classList.toggle('hidden',!isCustomGradient);if(isSolid){this._applySolidTextColor(this._currentSettings.solidColorPicker)}else{this._applyGradientToLogo()}console.log(`[SM] Handled color mode: ${mode}`);
    },
    /** @private Handles text gradient preset change */
    _handleGradientPresetChange(preset) { /* ... Keep logic from previous full version ... */
        const isCustom=preset==='custom';const showCustomControls=this._currentSettings.textColorMode==='gradient'&&isCustom;document.getElementById('customGradientControls')?.classList.toggle('hidden',!showCustomControls);if(this._currentSettings.textColorMode==='gradient'){this._applyGradientToLogo()}console.log(`[SM] Handled gradient preset: ${preset}`);
    },
    /** @private Handles background type change */
    _handleBackgroundTypeChange(type) { /* ... Keep logic from previous full version ... */
        if(!this._previewContainer)return;const isSolid=type==='bg-solid';const isGradient=type?.includes('gradient');document.getElementById('backgroundColorControl')?.classList.toggle('hidden',!isSolid);document.getElementById('backgroundGradientControls')?.classList.toggle('hidden',!isGradient);const isCustomGradient=isGradient&&this._currentSettings.backgroundGradientPreset==='custom';document.getElementById('customBackgroundGradient')?.classList.toggle('hidden',!isCustomGradient);this._previewContainer.style.backgroundImage='';this._previewContainer.style.backgroundColor='';this._previewContainer.style.opacity='1';if(document.getElementById('bgOpacity'))document.getElementById('bgOpacity').value='1';this._currentSettings.bgOpacity='1';const classesToRemove=Array.from(this._previewContainer.classList).filter(cls=>cls.startsWith(BACKGROUND_CLASS_PREFIX)||cls==='bg-gradient-animated-css');if(classesToRemove.length>0){this._previewContainer.classList.remove(...classesToRemove)}if(type){this._previewContainer.classList.add(type)}if(isSolid){this._applySolidBgColor(this._currentSettings.backgroundColor)}else if(isGradient){this._applyBackgroundGradient();if(type==='bg-gradient-animated'){this._previewContainer.classList.add('bg-gradient-animated-css')}}else if(type==='bg-transparent'){this._previewContainer.style.backgroundColor='transparent'}this._previewContainer.style.opacity=this._currentSettings.bgOpacity;console.log(`[SM] Handled background type: ${type}`);
    },
    /** @private Handles background gradient preset change */
    _handleBackgroundGradientChange(presetValue) { /* ... Keep logic from previous full version ... */
        const isCustom=presetValue==='custom';const showCustomControls=this._currentSettings.backgroundType?.includes('gradient')&&isCustom;document.getElementById('customBackgroundGradient')?.classList.toggle('hidden',!showCustomControls);if(this._currentSettings.backgroundType?.includes('gradient')){this._applyBackgroundGradient()}console.log(`[SM] Handled background gradient preset: ${presetValue}`);
    },

    // --- Direct Style Setters (Implementations) ---
    _applySolidTextColor(color) { /* ... Keep logic from previous full version ... */
        if(!this._logoElement)return;this._logoElement.style.backgroundImage='none';this._logoElement.style.backgroundClip='initial';this._logoElement.style.webkitBackgroundClip='initial';this._logoElement.style.webkitTextFillColor='initial';this._logoElement.style.color=color||DEFAULT_SETTINGS.solidColorPicker;console.log(`[SM] Applied solid text color: ${this._logoElement.style.color}`);
    },
    _applySolidBgColor(color) { /* ... Keep logic from previous full version ... */
        if(!this._previewContainer)return;this._previewContainer.style.backgroundColor=color||DEFAULT_SETTINGS.backgroundColor;this._previewContainer.style.backgroundImage='none';console.log(`[SM] Applied solid background color: ${this._previewContainer.style.backgroundColor}`);
    },
    _applyGradientToLogo() { /* ... Keep logic from previous full version ... */
        if(!this._logoElement)return;const direction=this._currentSettings.animationDirection||DEFAULT_SETTINGS.animationDirection;const preset=this._currentSettings.gradientPreset;let gradientCssString='';try{if(preset==='custom'){const c1=this._currentSettings.color1||DEFAULT_SETTINGS.color1;const c2=this._currentSettings.color2||DEFAULT_SETTINGS.color2;const useC3=this._currentSettings.useColor3;const c3=this._currentSettings.color3||DEFAULT_SETTINGS.color3;gradientCssString=useC3?`linear-gradient(${direction}deg, ${c1}, ${c2}, ${c3})`:`linear-gradient(${direction}deg, ${c1}, ${c2})`}else{let presetVarValue='';try{presetVarValue=getComputedStyle(document.documentElement).getPropertyValue(`--${preset}`).trim()}catch(e){console.warn(`[SM Gradient] CSS var read failed for '${preset}'.`,e)}if(presetVarValue&&presetVarValue.startsWith('linear-gradient')){console.log(`[SM Gradient] Using CSS var for preset: ${preset}`);gradientCssString=presetVarValue.replace(/linear-gradient\([^,]+,/,`linear-gradient(${direction}deg,`)}else{console.warn(`[SM Gradient] CSS var '${preset}' invalid/missing. Using fallback.`);const fallbacks={'primary-gradient':`linear-gradient(${direction}deg,#FF1493,#8A2BE2)`,'cyberpunk-gradient':`linear-gradient(${direction}deg,#f953c6,#b91d73)`,'sunset-gradient':`linear-gradient(${direction}deg,#ff7e5f,#feb47b)`,'ocean-gradient':`linear-gradient(${direction}deg,#00c6ff,#0072ff)`,'forest-gradient':`linear-gradient(${direction}deg,#5ec422,#01796f)`,'rainbow-gradient':`linear-gradient(${direction}deg,red,orange,yellow,green,blue,indigo,violet)`,'neon-blue-gradient':`linear-gradient(${direction}deg,#00c9ff,#92fe9d)`,'royal-gradient':`linear-gradient(${direction}deg,#141e30,#243b55)`,'fire-gradient':`linear-gradient(${direction}deg,#f5576c,#f39c12)`,'purple-love-gradient':`linear-gradient(${direction}deg,#cc2b5e,#753a88)`,'dark-knight-gradient':`linear-gradient(${direction}deg,#ba8b02,#181818)`,'emerald-gradient':`linear-gradient(${direction}deg,#43cea2,#185a9d)`};gradientCssString=fallbacks[preset];if(!gradientCssString){console.warn(`[SM Gradient] Unknown preset '${preset}'. Reverting.`);gradientCssString=`linear-gradient(${direction}deg,${DEFAULT_SETTINGS.color1},${DEFAULT_SETTINGS.color2})`}}}this._logoElement.style.backgroundImage=gradientCssString;this._logoElement.style.webkitBackgroundClip='text';this._logoElement.style.backgroundClip='text';this._logoElement.style.color='transparent';this._logoElement.style.webkitTextFillColor='transparent';console.log(`[SM] Applied text gradient (Preset:${preset},Dir:${direction}deg)`)}catch(e){console.error(`[SM] Error applying text gradient:`,e);this._applySolidTextColor(DEFAULT_SETTINGS.solidColorPicker)}
    },
    _applyBackgroundGradient() { /* ... Keep logic from previous full version ... */
        if(!this._previewContainer)return;const direction=this._currentSettings.bgGradientDirection||DEFAULT_SETTINGS.bgGradientDirection;const preset=this._currentSettings.backgroundGradientPreset;let gradientCssString='';try{if(preset==='custom'){const c1=this._currentSettings.bgColor1||DEFAULT_SETTINGS.bgColor1;const c2=this._currentSettings.bgColor2||DEFAULT_SETTINGS.bgColor2;gradientCssString=`linear-gradient(${direction}deg, ${c1}, ${c2})`}else{let presetVarValue='';try{presetVarValue=getComputedStyle(document.documentElement).getPropertyValue(`--${preset}`).trim()}catch(e){console.warn(`[SM BG Gradient] CSS var read failed for '${preset}'.`,e)}if(presetVarValue&&presetVarValue.startsWith('linear-gradient')){console.log(`[SM BG Gradient] Using CSS var for preset: ${preset}`);gradientCssString=presetVarValue.replace(/linear-gradient\([^,]+,/,`linear-gradient(${direction}deg,`)}else{console.warn(`[SM BG Gradient] CSS var '${preset}' invalid/missing. Using fallback.`);const fallbacks={'bg-primary-gradient':`linear-gradient(${direction}deg,#1a1a2e,#16213e,#0f3460)`,'bg-cyberpunk-gradient':`linear-gradient(${direction}deg,#0f0c29,#302b63,#24243e)`,'bg-sunset-gradient':`linear-gradient(${direction}deg,#ff7e5f,#feb47b)`,'bg-ocean-gradient':`linear-gradient(${direction}deg,#00c6ff,#0072ff)`};gradientCssString=fallbacks[preset];if(!gradientCssString){console.warn(`[SM BG Gradient] Unknown preset '${preset}'. Reverting.`);gradientCssString=`linear-gradient(${direction}deg,${DEFAULT_SETTINGS.bgColor1},${DEFAULT_SETTINGS.bgColor2})`}}}this._previewContainer.style.backgroundImage=gradientCssString;this._previewContainer.style.backgroundColor='';console.log(`[SM] Applied background gradient (Preset:${preset},Dir:${direction}deg)`)}catch(e){console.error(`[SM] Error applying background gradient:`,e);this._applySolidBgColor(DEFAULT_SETTINGS.backgroundColor)}
    },
    _applyAnimationSpeed(speedValue) { /* ... Keep logic from previous full version ... */
        const baseDuration=2;const speed=parseFloat(speedValue||'1');const duration=Math.max(0.1,baseDuration/Math.max(0.1,speed));document.documentElement.style.setProperty('--animation-duration',`${duration.toFixed(2)}s`);console.log(`[SM] Applied animation speed: ${speed}x -> Duration: ${duration.toFixed(2)}s`);
    },
    _updateFontPreview(fontFamilyName) { /* ... Keep logic from previous full version ... */
        const previewElement=document.getElementById("fontPreview");if(previewElement){previewElement.style.fontFamily=fontFamilyName?`"${fontFamilyName}", sans-serif`:'sans-serif'}else{console.warn("[SM] Font preview element missing.")}
    },
    _displayLicenseInfo(licenseText) { /* ... Keep logic from previous full version ... */
        const licenseTextArea=document.getElementById('fontLicenseText');const licenseContainer=document.getElementById('fontLicenseContainer');if(licenseTextArea&&licenseContainer){const hasText=!!licenseText&&licenseText.trim()!=='';licenseTextArea.textContent=hasText?licenseText:"No license info available.";licenseContainer.classList.toggle('hidden',!hasText)}
    },

    // --- Utility Helpers ---
    _applyClass(targetElement, className, classPrefix = null) { /* ... Keep logic from previous full version ... */
         if(!targetElement||!(targetElement instanceof HTMLElement)||!className)return;try{if(classPrefix){const classesToRemove=Array.from(targetElement.classList).filter(cls=>cls.startsWith(classPrefix));if(classesToRemove.length>0){targetElement.classList.remove(...classesToRemove)}}if(!className.endsWith('-none')&&!className.endsWith('_none')){targetElement.classList.add(className)}}catch(e){console.error(`[SM ApplyClass] Error applying class "${className}":`,e)}
    },
    _sanitizeForClassName(name) { /* ... Keep logic from previous full version ... */
         if(!name||typeof name!=='string')return'';return name.toLowerCase().replace(/[\s_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/^[\d-]+/,'')||'invalid-name';
    },

    // --- Core Methods ---
    async applySettings(settings, forceUIUpdate = false, isInitialLoad = false) { /* ... Keep logic from previous full version ... */
         console.log(`[SM] Applying settings (forceUI:${forceUIUpdate}, initial:${isInitialLoad})`);const settingsToApply=(typeof settings==='object'&&settings!==null)?{...this.getDefaults(),...settings}:this.getCurrentSettings();this._currentSettings=settingsToApply;Object.entries(this._currentSettings).forEach(([key,value])=>{const element=document.getElementById(key);if(!element){return}try{const currentElementValue=(element.type==='checkbox')?element.checked:element.value;const newValueFormatted=(element.type==='checkbox')?!!value:String(value??'');const currentValueFormatted=(element.type==='checkbox')?currentElementValue:String(currentElementValue);if(forceUIUpdate||isInitialLoad||currentValueFormatted!==newValueFormatted){if(element.type==='checkbox'){element.checked=newValueFormatted}else{element.value=newValueFormatted}if(forceUIUpdate&&!isInitialLoad){const eventType=(element.nodeName==='SELECT'||element.type==='checkbox'||element.type==='color')?'change':'input';element.dispatchEvent(new Event(eventType,{bubbles:true}))}}}catch(e){console.warn(`[SM Apply UI] Error setting UI #${key}:`,e)}});if(isInitialLoad||forceUIUpdate){console.log('[SM Apply Styles] Applying visual styles directly...');if(!this._logoElement||!this._previewContainer||!this._logoContainer){console.error("[SM Apply Styles] Critical elements missing!");return Promise.reject(new Error("Missing elements"))}const logoEl=this._logoElement;const logoContainer=this._logoContainer;const previewContainer=this._previewContainer;logoEl.textContent=this._currentSettings.logoText;logoEl.setAttribute('data-text',this._currentSettings.logoText);await this._applyFontFamily(this._currentSettings.fontFamily);this._applyTextCase(this._currentSettings.textCase);this._applyTextAlign(this._currentSettings.textAlign);document.documentElement.style.setProperty('--dynamic-font-size',`${this._currentSettings.fontSize}px`);document.documentElement.style.setProperty('--dynamic-letter-spacing',`${this._currentSettings.letterSpacing}em`);document.documentElement.style.setProperty('--dynamic-rotation',`${this._currentSettings.rotation}deg`);document.documentElement.style.setProperty('--dynamic-border-color',this._currentSettings.borderColorPicker);document.documentElement.style.setProperty('--dynamic-border-width',`${this._currentSettings.borderWidth}px`);document.documentElement.style.setProperty('--gradient-direction',`${this._currentSettings.animationDirection}deg`);document.documentElement.style.setProperty('--bg-gradient-direction',`${this._currentSettings.bgGradientDirection}deg`);let borderRgb="255,255,255";try{borderRgb=(window.CSSUtils?.extractRGB||this._extractColorRGB)(this._currentSettings.borderColorPicker)}catch(e){console.error("Error getting border RGB",e)}document.documentElement.style.setProperty('--dynamic-border-color-rgb',borderRgb);this._applyBorderStyle(this._currentSettings.borderStyle);if(this._currentSettings.customBorderRadius){this._applyCustomBorderRadius(this._currentSettings.customBorderRadius)}this._applyAnimationSpeed(this._currentSettings.animationSpeed);this._applyTextEffect(this._currentSettings.textShadow);this._applyTextAnimation(this._currentSettings.textAnimation);this._applyPreviewSize(this._currentSettings.previewSize);this._handleColorModeChange(this._currentSettings.textColorMode);this._handleBackgroundTypeChange(this._currentSettings.backgroundType);previewContainer.style.opacity=this._currentSettings.bgOpacity;this._handleGradientPresetChange(this._currentSettings.gradientPreset);this._handleBackgroundGradientChange(this._currentSettings.backgroundGradientPreset);this._updateRangeValueDisplays();const presetSelect=document.getElementById('aspectRatioPreset');if(presetSelect){presetSelect.value=this._currentSettings.aspectRatioPreset||'auto'}const lockCheckbox=document.getElementById('aspectRatioLock');if(lockCheckbox){lockCheckbox.checked=!!this._currentSettings.aspectRatioLock}console.log('[SM Apply Styles] Visual styles complete.')}this._triggerSettingsUpdate();console.log('[SM] applySettings complete.')
    },
    _triggerSettingsUpdate() { /* ... Keep logic from previous full version ... */
        this.saveCurrentSettings();const currentSettingsCopy=this.getCurrentSettings();this._listeners.forEach(listener=>{try{listener(currentSettingsCopy)}catch(e){console.error('[SM] Error in listener:',e)}});try{document.dispatchEvent(new CustomEvent('logomaker-settings-updated',{detail:{settings:currentSettingsCopy}}))}catch(eventError){console.error('[SM] Error dispatching event:',eventError)}requestAnimationFrame(()=>{this._updateSizeIndicator();this._updateCSSCode()});
    },
    _updateSizeIndicator() { /* ... Keep logic from previous full version ... */
        const widthDisplay=document.getElementById('logoWidth');const heightDisplay=document.getElementById('logoHeight');if(!this._logoElement||!widthDisplay||!heightDisplay)return;try{const rect=this._logoElement.getBoundingClientRect();if(rect.width>0)widthDisplay.textContent=Math.round(rect.width);else widthDisplay.textContent='--';if(rect.height>0)heightDisplay.textContent=Math.round(rect.height);else heightDisplay.textContent='--'}catch(e){console.error('[SM] Error updating size:',e);widthDisplay.textContent='N/A';heightDisplay.textContent='N/A'}
    },
    _updateCSSCode() { /* ... Keep logic from previous full version ... */
        const cssCodeElement=document.getElementById('cssCode');if(cssCodeElement){try{cssCodeElement.value=this._generateCSSCode()}catch(e){console.error("[SM] Failed CSS code gen:",e);cssCodeElement.value="/* Error */"}}
    },
    _generateCSSCode() { /* ... Keep logic from previous full version ... */
        if(!this._logoElement||!this._previewContainer||!this._logoContainer){return"/* Error: Core elements missing. */"}try{let css=`/* Generated CSS */\n\n:root {\n`;const cssVarsToInclude=['--animation-duration','--gradient-direction','--dynamic-border-color','--dynamic-border-color-rgb','--bg-gradient-direction','--dynamic-font-size','--dynamic-letter-spacing','--dynamic-rotation','--dynamic-border-width','--dynamic-border-radius','--dynamic-border-padding'];cssVarsToInclude.forEach(varName=>{const value=document.documentElement.style.getPropertyValue(varName)||getComputedStyle(document.documentElement).getPropertyValue(varName);if(value?.trim()){css+=`  ${varName}: ${value.trim()};\n`}});css+=`}\n\n`;const getPrefixedClass=(element,prefix)=>Array.from(element.classList).find(c=>c.startsWith(prefix));const isRelevantClass=c=>c==='dynamic-border'||[BORDER_STYLE_CLASS_PREFIX,BORDER_EFFECT_CLASS_PREFIX,BORDER_RADIUS_CLASS_PREFIX,FONT_FAMILY_CLASS_PREFIX,FONT_WEIGHT_CLASS_PREFIX,TEXT_ALIGN_CLASS_PREFIX,TEXT_CASE_CLASS_PREFIX,TEXT_EFFECT_CLASS_PREFIX,ANIMATION_CLASS_PREFIX].some(p=>c.startsWith(p));const containerClasses=Array.from(this._logoContainer.classList).filter(isRelevantClass).map(c=>`.${c}`).join('');const textClasses=Array.from(this._logoElement.classList).filter(isRelevantClass).map(c=>`.${c}`).join('');css+=`/* Container */\n.logo-container${containerClasses} {\n  position: relative; display: inline-flex; align-items: center; justify-content: ${this._logoContainer.style.justifyContent||'center'};\n  padding: var(--dynamic-border-padding, 10px);\n  border-radius: var(--dynamic-border-radius, 0);\n}\n\n`;css+=`/* Text */\n.logo-text${textClasses} {\n  font-size: var(--dynamic-font-size);\n  letter-spacing: var(--dynamic-letter-spacing);\n  transform: rotate(var(--dynamic-rotation));\n  line-height: 1.2; white-space: nowrap;\n`;if(this._currentSettings.textColorMode==='gradient'){css+=`  background-image: ${this._logoElement.style.backgroundImage||'none'};\n  -webkit-background-clip: text; background-clip: text;\n  color: transparent; -webkit-text-fill-color: transparent;\n`}else{css+=`  color: ${this._logoElement.style.color||'#ffffff'};\n  background-image: none;\n  background-clip: initial; -webkit-background-clip: initial;\n  -webkit-text-fill-color: initial;\n`}css+=`}\n\n`;const activeAnimationClass=getPrefixedClass(this._logoElement,ANIMATION_CLASS_PREFIX);if(activeAnimationClass&&activeAnimationClass!=='anim-none'&&typeof window.getActiveAnimationKeyframes==='function'){try{const animationName=activeAnimationClass.replace(ANIMATION_CLASS_PREFIX,'');const keyframesCss=window.getActiveAnimationKeyframes(animationName);if(keyframesCss){css+=`/* Keyframes for ${animationName} */\n${keyframesCss}\n\n`}}catch(e){console.error("Error getting keyframes CSS:",e)}}const backgroundClass=Array.from(this._previewContainer.classList).find(c=>c.startsWith(BACKGROUND_CLASS_PREFIX)&&!c.includes('gradient')&&c!=='bg-solid'&&c!=='bg-transparent');if(backgroundClass){css+=`/* Background pattern: .${backgroundClass} */\n\n`}return css.trim()}catch(e){console.error("Error generating CSS:",e);return`/* CSS Gen Error: ${e.message} */`}
    },
    _initializeUIComponentsState() { /* ... Keep logic from previous full version ... */
        console.log('[SM] Initializing dependent UI component states...');try{this._handleColorModeChange(this._currentSettings.textColorMode);this._handleGradientPresetChange(this._currentSettings.gradientPreset);this._handleBackgroundTypeChange(this._currentSettings.backgroundType);this._handleBackgroundGradientChange(this._currentSettings.backgroundGradientPreset);const customRadiusInput=document.getElementById('customBorderRadius');if(customRadiusInput)customRadiusInput.parentElement?.classList.toggle('hidden',this._currentSettings.borderRadius!=='custom');this._updateFontPreview(this._currentSettings.fontFamily);this._updateRangeValueDisplays();this._setupResetButton();console.log('[SM] Dependent UI states initialized.')}catch(e){console.error("[SM] Error initializing UI states:",e)}
    },
    _setupResetButton() { /* ... Keep logic from previous full version ... */
         const resetButton=document.getElementById('resetBtn');if(!resetButton){console.warn("[SM] Reset button missing.");return}if(resetButton.dataset.listenerAttached==='true'){return}const resetModal=document.getElementById('resetConfirmModal');const cancelBtn=document.getElementById('resetModalCancel');const confirmBtn=document.getElementById('resetModalConfirm');if(!resetModal||!cancelBtn||!confirmBtn){console.warn('[SM] Reset modal elements missing.');return}const closeModal=()=>{resetModal.style.display='none';resetModal.classList.remove('active')};resetButton.onclick=()=>{resetModal.style.display='flex';requestAnimationFrame(()=>resetModal.classList.add('active'))};cancelBtn.onclick=closeModal;confirmBtn.onclick=()=>{const resetType=document.querySelector('input[name="reset-type"]:checked')?.value||'all';this.resetSettings(resetType);closeModal()};resetModal.onclick=e=>{if(e.target===resetModal){closeModal()}};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&resetModal.classList.contains('active')){closeModal()}});resetButton.dataset.listenerAttached='true';console.log('[SM] Reset modal listeners attached.');
    },
    resetSettings(resetType = 'all') { /* ... Keep logic from previous full version ... */
        console.log(`[SM Resetting] Type: ${resetType}`);const defaults=this.getDefaults();let settingsToApply;if(resetType==='all'){settingsToApply={...defaults}}else{settingsToApply={...this.getCurrentSettings()};const categoryKeyMap={text:['logoText','fontFamily','fontSize','letterSpacing','textCase','fontWeight','textAlign'],style:['textColorMode','solidColorPicker','gradientPreset','color1','color2','useColor3','color3','animationDirection','textShadow','textAnimation','animationSpeed','rotation'],border:['borderColorPicker','borderStyle','borderWidth','borderRadius','borderPadding','customBorderRadius'],background:['backgroundType','backgroundColor','bgOpacity','backgroundGradientPreset','bgColor1','bgColor2','bgGradientDirection']};const keysToReset=categoryKeyMap[resetType]||Object.keys(defaults);keysToReset.forEach(key=>{if(defaults.hasOwnProperty(key)){settingsToApply[key]=defaults[key]}})}this.applySettings(settingsToApply,true).then(()=>{console.log(`[SM] Settings Reset (${resetType}) applied.`);if(typeof showToast==='function'){showToast({message:`Settings Reset (${resetType})!`,type:'success'})}}).catch(err=>{console.error("[SM] Error applying reset:",err);if(typeof showAlert==='function'){showAlert("Failed to reset settings.","error")}})
    },
    loadSavedSettings() { /* ... Keep logic from previous full version ... */
        try{const savedSettingsJson=localStorage.getItem('logomakerSettings');if(savedSettingsJson){const loadedSettings=JSON.parse(savedSettingsJson);const defaults=this.getDefaults();this._currentSettings={...defaults,...loadedSettings};console.log('[SM] Loaded settings from localStorage.');setTimeout(()=>{this._validateLoadedFont()},500)}else{this._currentSettings=this.getDefaults();console.log('[SM] No saved settings found.')}}catch(err){console.error('[SM] Error loading settings:',err);this._currentSettings=this.getDefaults();if(typeof showAlert==='function'){showAlert('Failed to load settings.','warning')}}
    },
    _validateLoadedFont() { /* ... Keep logic from previous full version ... */
         try{const fontDropdown=document.getElementById('fontFamily');const savedFontFamily=this._currentSettings.fontFamily;if(fontDropdown&&fontDropdown.options.length>1&&savedFontFamily){const fontOptionExists=fontDropdown.querySelector(`option[value="${CSS.escape(savedFontFamily)}"]`);if(!fontOptionExists){console.warn(`[SM] Saved font '${savedFontFamily}' not found. Reverting.`);this._currentSettings.fontFamily=DEFAULT_SETTINGS.fontFamily;if(fontDropdown.value!==this._currentSettings.fontFamily){fontDropdown.value=this._currentSettings.fontFamily}}}else if(fontDropdown&&savedFontFamily){console.warn("[SM] Font dropdown empty during validation.")}}catch(e){console.error("[SM] Error validating font:",e)}
     },
    saveCurrentSettings() { /* ... Keep logic from previous full version ... */
        try{localStorage.setItem('logomakerSettings',JSON.stringify(this._currentSettings))}catch(err){console.error('[SM] Error saving settings:',err);if(typeof showAlert==='function'){showAlert('Could not save settings.','error')}}
    },
    addSettingsChangeListener(listener) { /* ... Keep logic from previous full version ... */
         if(typeof listener==='function'&&!this._listeners.includes(listener)){this._listeners.push(listener)}
    },
    removeSettingsChangeListener(listener) { /* ... Keep logic from previous full version ... */
        this._listeners=this._listeners.filter(l=>l!==listener);
    },

    // --- Aspect Ratio Logic ---
    _getCurrentAspectRatio() { /* ... Keep logic from previous full version ... */
        const presetSelect=document.getElementById('aspectRatioPreset');const presetValue=this._currentSettings.aspectRatioPreset||'auto';if(presetValue!=='auto'&&presetSelect){const selectedOption=presetSelect.options[presetSelect.selectedIndex];const presetRatio=parseFloat(selectedOption?.dataset.ratio);if(!isNaN(presetRatio)&&presetRatio>0){return presetRatio}else{console.warn(`[SM AspectRatio] Invalid preset ratio '${presetValue}'.`)}}if(!this._logoContainer){console.warn("[SM AspectRatio] Logo container missing.");return 1}const width=this._logoContainer.offsetWidth;const height=this._logoContainer.offsetHeight;if(width<=0||height<=0){console.warn("[SM AspectRatio] Invalid dimensions.");return 1}return width/height;
    },
    _handleAspectPresetChange(selectElement) { /* ... Keep logic from previous full version ... */
        if(!selectElement){console.error("[SM PresetChange] selectElement missing!");return}const selectedOption=selectElement.options[selectElement.selectedIndex];if(!selectedOption){console.error("[SM PresetChange] No selected option!");return}const presetValue=selectedOption.value;const numericRatio=parseFloat(selectedOption?.dataset.ratio);this._currentSettings.aspectRatioPreset=presetValue;if(!isNaN(numericRatio)&&numericRatio>0){const widthInput=document.getElementById('exportWidth');const heightInput=document.getElementById('exportHeight');const lockCheckbox=document.getElementById('aspectRatioLock');if(!widthInput||!heightInput||!lockCheckbox){console.error("[SM PresetChange] Dimension/Lock inputs missing!");return}const baseWidth=parseInt(this._currentSettings.exportWidth||DEFAULT_SETTINGS.exportWidth);const newWidth=baseWidth;const newHeight=Math.max(10,Math.round(newWidth/numericRatio));this._isUpdatingAspectRatio=true;heightInput.value=newHeight;this._currentSettings.exportHeight=String(newHeight);lockCheckbox.checked=true;this._currentSettings.aspectRatioLock=true;this._isUpdatingAspectRatio=false}this._triggerSettingsUpdate();
    },
    _handleDimensionChange(changedInputId) { /* ... Keep logic from previous full version ... */
        if(this._isUpdatingAspectRatio||!this._currentSettings.aspectRatioLock){return}this._isUpdatingAspectRatio=true;try{const aspectRatio=this._getCurrentAspectRatio();if(aspectRatio<=0||isNaN(aspectRatio)){console.error("[SM AspectRatio] Invalid ratio.");return}const widthInput=document.getElementById('exportWidth');const heightInput=document.getElementById('exportHeight');if(!widthInput||!heightInput){console.error("[SM AspectRatio] Dimension inputs missing.");return}const changedValue=parseFloat(this._currentSettings[changedInputId]);if(isNaN(changedValue)||changedValue<=0){console.warn(`[SM AspectRatio] Invalid input ${changedInputId}.`);return}let targetInput,targetSettingKey,newValue;if(changedInputId==='exportWidth'){targetInput=heightInput;targetSettingKey='exportHeight';newValue=Math.round(changedValue/aspectRatio)}else{targetInput=widthInput;targetSettingKey='exportWidth';newValue=Math.round(changedValue*aspectRatio)}newValue=Math.max(10,newValue);if(String(newValue)!==this._currentSettings[targetSettingKey]){console.log(`[SM AspectRatio] Updating ${targetSettingKey} to ${newValue}`);targetInput.value=newValue;this._currentSettings[targetSettingKey]=String(newValue)}}catch(error){console.error("[SM AspectRatio] Error updating dimension:",error)}finally{this._isUpdatingAspectRatio=false;}
    },

}; // End of SettingsManager object literal

export default SettingsManager;