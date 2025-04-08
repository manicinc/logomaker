/**
 * @file settingsManager.js (UNIFIED - v20.x COMPLETE - Refactored)
 * @version 20.x.R1
 * @description
 * A unified SettingsManager responsible for managing, applying, and persisting
 * all style-related settings for the Logomaker application. It handles basic
 * text properties, advanced effects (shadows, 3D, strokes), borders, backgrounds,
 * animations, and preview/export configurations. It binds UI controls, updates
 * the preview in real-time, and saves settings to localStorage.
 *
 * Key Responsibilities:
 * - Manages a single source of truth for all settings (_currentSettings).
 * - Loads settings from localStorage on initialization, falling back to defaults.
 * - Saves settings to localStorage whenever they change.
 * - Binds event listeners to all relevant UI input elements.
 * - Applies CSS classes and CSS variables to the logo text, container, and preview area
 * based on the current settings and the rules defined in effects.css.
 * - Handles complex interactions, like switching between basic and advanced effects.
 * - Provides methods to get current settings, reset settings, and listen for changes.
 * - Generates example CSS based on the current state.
 */

console.log('[SettingsManager v20.x Refactored] Loading...');

// --- Constants ---

/**
 * Prefixes used for dynamically adding/removing CSS classes to elements.
 * Ensures that only one class of a specific type (e.g., font weight) is active at a time.
 * @enum {string}
 */
const PREFIX = {
  FONT_FAMILY: 'font-family-', // Note: Applied via direct style, but prefix kept for consistency
  FONT_WEIGHT: 'font-weight-',
  TEXT_ALIGN: 'text-align-', // Note: Applied via container justify-content style
  TEXT_CASE: 'text-case-',
  TEXT_DECORATION: 'text-decoration-',
  TEXT_STYLE: 'text-style-',
  TEXT_STROKE: 'text-stroke-',
  TEXT_EFFECT: 'text-effect-', // Covers both standard shadows/glows and 3D effects
  BORDER_STYLE: 'border-style-',
  BORDER_EFFECT: 'border-effect-',
  BORDER_RADIUS: 'border-radius-',
  ANIMATION: 'anim-', // Covers both standard and advanced text animations
  PREVIEW_SIZE: 'preview-size-',
  BACKGROUND: 'bg-', // Covers background types and patterns
};

/**
 * Default values for all settings managed by the SettingsManager.
 * Used for initial state and for resetting settings.
 * @const {object}
 */
const DEFAULT_SETTINGS = {
  // Basic Text
  logoText: 'Manic',
  fontFamily: 'Orbitron', // Ensure this is a valid font available initially
  fontSize: '100', // px
  fontWeight: '700',
  letterSpacing: '0.03', // em
  textCase: 'none',
  textAlign: 'center', // Applies to container justify-content
  rotation: '0', // deg

  // Text Color Mode (Solid vs Gradient)
  textColorMode: 'gradient', // 'solid' or 'gradient'
  solidColorPicker: '#ffffff',
  gradientPreset: 'primary-gradient', // 'custom' or a preset key (maps to CSS var or fallback)
  color1: '#FF1493', // Custom gradient color 1
  color2: '#8A2BE2', // Custom gradient color 2
  useColor3: false, // Use third custom gradient color?
  color3: '#FF4500', // Custom gradient color 3
  animationDirection: '45', // deg (Used for text gradient direction)

  // Text Effects (Basic Shadow/Glow + Advanced 3D)
  textShadow: 'text-effect-none', // Basic text effect class (e.g., 'text-effect-glow-soft'). Value should match class name directly.
  advanced3dEffect: 'none', // Advanced 3D effect key (maps to class via ADVANCED_3D_EFFECT_MAP). 'none' means use textShadow.

  // Advanced Text Styling
  textDecoration: 'none', // Maps to class via TEXT_DECORATION_MAP (e.g., 'underline')
  textStyle: 'normal', // Maps to class via TEXT_STYLE_MAP (e.g., 'italic')
  textStroke: 'none', // Maps to class via TEXT_STROKE_MAP (e.g., 'thin')

  // Container / Border
  borderStyle: 'border-style-none', // Basic border style class. Value should match class name.
  advancedBorderStyle: 'none', // Advanced border style/effect key (maps via BORDER_STYLE_EFFECT_MAP). 'none' means use borderStyle.
  borderColorPicker: '#ffffff', // Used for border color, stroke color, etc. via CSS var
  borderWidth: '2', // px
  borderRadius: 'none', // Maps to class via BORDER_RADIUS_MAP (e.g., 'rounded-md', 'custom')
  customBorderRadius: '', // Value for custom border radius (e.g., '10px 20px', '15px')
  borderPadding: '16', // px

  // Animations (Basic + Advanced)
  textAnimation: 'anim-none', // Basic text animation class. Value should match class name.
  advancedTextAnimation: 'none', // Advanced text animation key (maps via ANIMATION_MAP). 'none' means use textAnimation.
  animationSpeed: '1', // Multiplier for animation duration (1 = default speed)

  // Background (Type/Color/Gradient/Pattern)
  backgroundType: 'bg-solid', // Background type class. Value should match class name (e.g., 'bg-gradient', 'bg-grid').
  advancedBackground: 'none', // Advanced background pattern key (maps via BACKGROUND_MAP). 'none' means use backgroundType.
  backgroundColor: '#000000', // Solid background color
  bgOpacity: '1', // Background opacity (applied to pseudo-element)
  backgroundGradientPreset: 'bg-primary-gradient', // 'custom' or preset key
  bgColor1: '#3a1c71', // Custom background gradient color 1
  bgColor2: '#ffaf7b', // Custom background gradient color 2
  bgGradientDirection: '90', // deg

  // Pattern color overrides (if patterns use these CSS vars)
  patternColor1: '#444444', // Example: Used for grid lines, dots etc. via CSS var --pattern-color1
  patternColor2: '#1e1e1e', // Example: Used for checkerboard bg etc. via CSS var --pattern-color2

  // Preview Sizing
  previewSize: 'preview-size-medium', // Class applied to preview container
  previewAreaPadding: '32', // px, applied to preview container style

  // Export / Output Settings
  exportWidth: '800', // px
  exportHeight: '400', // px
  aspectRatioPreset: 'auto', // 'auto' or a specific ratio key (e.g., '16:9')
  aspectRatioLock: false, // Lock width/height to aspect ratio?
  exportQuality: '95', // % (for JPEG/WebP)
  exportTransparent: false, // Export with transparent background?
  exportFrames: '15', // Number of frames for GIF/APNG
  exportFrameRate: '10', // FPS for GIF/APNG
};

// --- Mapping Tables (Value -> CSS Class or Identifier) ---
// Maps setting values (typically from <select> dropdowns) to specific CSS classes
// or identifiers used in the logic.

const TEXT_DECORATION_MAP = {
  'none': 'text-decoration-none',
  'underline': 'text-decoration-underline',
  'overline': 'text-decoration-overline',
  'line-through': 'text-decoration-line-through',
  'dashed-underline': 'text-decoration-dashed-underline',
  'wavy-underline': 'text-decoration-wavy-underline',
};

const TEXT_STYLE_MAP = {
  'normal': 'text-style-normal',
  'italic': 'text-style-italic',
  'oblique': 'text-style-oblique', // Ensure CSS supports 'oblique 15deg' or similar
};

const TEXT_STROKE_MAP = {
  'none': 'text-stroke-none',
  'thin': 'text-stroke-thin',
  'medium': 'text-stroke-medium',
  'thick': 'text-stroke-thick',
  'contrast': 'text-stroke-contrast',
};

// Note: Basic text effects (textShadow setting) are assumed to have values
// directly matching the CSS class names (e.g., 'text-effect-glow-soft').
// A map is only needed if the values differ significantly or need abstraction.
// const TEXT_EFFECT_MAP = { 'none': 'text-effect-none', ... };

const ADVANCED_3D_EFFECT_MAP = {
  'none': 'text-effect-none', // Indicates no advanced effect is active
  '3d-simple': 'text-effect-3d-simple',
  '3d-extrude': 'text-effect-3d-extrude',
  '3d-bevel': 'text-effect-3d-bevel',
  'isometric': 'text-effect-isometric',
  'reflection': 'text-effect-reflection',
  'cutout': 'text-effect-cutout',
  // Add any other 3D effect classes from CSS here
};

// Maps border setting values (basic and advanced) to their CSS classes.
// Keys should match the <select> option values.
const BORDER_STYLE_EFFECT_MAP = {
  // Basic Styles (match class name directly)
  'border-style-none': 'border-style-none',
  'border-style-solid': 'border-style-solid',
  'border-style-double': 'border-style-double',
  'border-style-dashed': 'border-style-dashed',
  'border-style-dotted': 'border-style-dotted',
  'border-style-groove': 'border-style-groove',
  'border-style-ridge': 'border-style-ridge',
  'border-style-inset': 'border-style-inset',
  'border-style-outset': 'border-style-outset',
  'border-style-thick': 'border-style-thick', // Added based on CSS
  'border-style-pixel': 'border-style-pixel',

  // Advanced / Enhanced Styles (from advancedBorderStyle dropdown)
  'multi-layer': 'border-style-multi-layer',
  'image-dots': 'border-style-image-dots',
  'image-zigzag': 'border-style-image-zigzag',
  'corners-cut': 'border-style-corners-cut',
  'corners-rounded-different': 'border-style-corners-rounded-different',

  // Border Effects (also from advancedBorderStyle dropdown)
  'marching-ants': 'border-effect-marching-ants',
  'rotating-dash': 'border-effect-rotating-dash',
  'double-glow': 'border-effect-double-glow',
  'glow-soft': 'border-effect-glow-soft', // Renamed for consistency
  'glow-strong': 'border-effect-glow-strong', // Added based on CSS
  'glow-pulse': 'border-effect-glow-pulse', // Added based on CSS
  'neon-animated': 'border-effect-neon-animated',
  'gradient-animated': 'border-effect-gradient-animated',

  // Fallback / Explicit None
  'none': 'border-style-none', // Explicitly map 'none' value if used
};

const BORDER_RADIUS_MAP = {
  'none': 'border-radius-none',
  'rounded-sm': 'border-radius-sm',
  'rounded-md': 'border-radius-md',
  'rounded-lg': 'border-radius-lg',
  'pill': 'border-radius-pill',
  'circle': 'border-radius-circle',
  'custom': 'border-radius-custom', // Indicates custom value is used
};

// Maps animation setting values (basic and advanced) to CSS classes.
// Keys should match <select> option values.
const ANIMATION_MAP = {
  // Standard Animations (match class name directly)
  'anim-none': 'anim-none',
  'anim-pulse': 'anim-pulse',
  'anim-bounce': 'anim-bounce',
  'anim-shake': 'anim-shake',
  'anim-float': 'anim-float',
  'anim-rotate': 'anim-rotate',
  'anim-glitch': 'anim-glitch',
  'anim-wave': 'anim-wave',
  'anim-flicker': 'anim-flicker',
  'anim-fade': 'anim-fade',

  // Advanced Animations (from advancedTextAnimation dropdown)
  'liquify': 'anim-liquify',
  'wobble': 'anim-wobble',
  'perspective': 'anim-perspective', // Maps to 'anim-perspective-tilt' in CSS? Check CSS. Assuming 'anim-perspective'
  'split': 'anim-split',
  'magnify': 'anim-magnify',
  'glow-multicolor': 'anim-glow-multicolor',
  'flip-3d': 'anim-flip-3d',
  'swing-3d': 'anim-swing-3d',

  // Fallback / Explicit None
  'none': 'anim-none', // Explicitly map 'none' value if used
};

// Maps background setting values (types and patterns) to CSS classes.
// Keys should match <select> option values.
const BACKGROUND_MAP = {
  // Basic Types (match class name directly)
  'bg-transparent': 'bg-transparent',
  'bg-solid': 'bg-solid',
  'bg-gradient': 'bg-gradient',
  'bg-gradient-animated': 'bg-gradient-animated',

  // Basic Patterns (match class name directly)
  'bg-grid': 'bg-grid',
  'bg-darkgrid': 'bg-darkgrid',
  'bg-dots-sm': 'bg-dots-sm',
  'bg-dots-lg': 'bg-dots-lg',
  'bg-checkerboard': 'bg-checkerboard',
  'bg-lines-diag': 'bg-lines-diag',
  'bg-lines-vert': 'bg-lines-vert',
  'bg-carbon': 'bg-carbon',

  // Overlay / Effect Patterns (match class name directly)
  'bg-noise': 'bg-noise',
  'bg-stars': 'bg-stars',
  'bg-synthwave': 'bg-synthwave',
  'bg-matrix': 'bg-matrix', // Note: Requires JS helper for columns
  'bg-scanlines': 'bg-scanlines',
  'bg-circuit': 'bg-circuit',

  // Advanced Backgrounds (from advancedBackground dropdown)
  'hexagons': 'bg-hexagons',
  'diamonds': 'bg-diamonds',
  'wave-pattern': 'bg-wave-pattern',
  'graph-paper': 'bg-graph-paper',
  'gradient-pulse': 'bg-gradient-pulse',
  'floating-particles': 'bg-floating-particles',

  // Fallback / Explicit None
  'none': 'bg-solid', // Fallback to solid black if 'none' is somehow selected
};

// --- SettingsManager Module ---

const SettingsManager = {
  _currentSettings: {}, // Holds the current state of all settings
  _listeners: [], // Array of functions to call on settings update
  _isInitialized: false, // Initialization flag
  _logoElement: null, // Reference to the main text element (.logo-text)
  _logoContainer: null, // Reference to the container wrapping the text (.logo-container)
  _previewContainer: null, // Reference to the overall preview area (#previewContainer)
  _isUpdatingAspectRatio: false, // Flag to prevent aspect ratio update loops
  _fontApplyDebounceTimer: null, // Timer for debouncing font application
  _FONT_APPLY_DEBOUNCE_DELAY: 300, // Delay (ms) for font application debounce

  /**
   * Gets a deep copy of the default settings.
   * @returns {object} A clone of DEFAULT_SETTINGS.
   */
  getDefaults() {
    try {
      // structuredClone is the modern, reliable way to deep clone
      return structuredClone(DEFAULT_SETTINGS);
    } catch (e) {
      // Fallback for older environments that might not support structuredClone
      console.warn('[SM] structuredClone not supported, falling back to JSON clone:', e);
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
  },

  /**
   * Gets a deep copy of the *current* settings.
   * Use this to safely read the current state without modifying the internal state.
   * @returns {object} A clone of the current settings.
   */
  getCurrentSettings() {
    const settingsToClone = (typeof this._currentSettings === 'object' && this._currentSettings !== null)
      ? this._currentSettings
      : this.getDefaults(); // Use defaults if current settings are invalid/missing

    try {
      return structuredClone(settingsToClone);
    } catch (e) {
      console.warn('[SM] structuredClone failed during getCurrentSettings, falling back to JSON clone:', e);
      return JSON.parse(JSON.stringify(settingsToClone));
    }
  },

  /**
   * Initializes the SettingsManager.
   * Finds essential DOM elements, loads saved settings, sets up event listeners,
   * and applies the initial styles.
   * @returns {Promise<void>} A promise that resolves when initialization is complete,
   * or rejects if a critical error occurs.
   */
  async init() {
    if (this._isInitialized) {
      console.warn('[SM] SettingsManager already initialized.');
      return Promise.resolve();
    }
    console.log('[SM Refactored] Initializing...');

    // Cache essential DOM element references
    this._logoElement = document.querySelector('.logo-text');
    this._logoContainer = document.querySelector('.logo-container');
    this._previewContainer = document.getElementById('previewContainer');

    // Check if critical elements were found
    if (!this._logoElement || !this._logoContainer || !this._previewContainer) {
      return Promise.reject(this._initializationError("Missing core preview elements ('.logo-text', '.logo-container', '#previewContainer'). Check HTML structure."));
    }

    try {
      this.loadSavedSettings(); // Load from localStorage or use defaults
      this._setupEventListeners(); // Bind UI controls
      console.log('[SM] Applying initial settings...');
      // Apply loaded/default settings and update UI fields
      await this.applySettings(this._currentSettings, true /* force UI update */, true /* is initial load */);

      this._isInitialized = true;
      console.log('[SM] Initialization complete.');
      return Promise.resolve();
    } catch (error) {
      this._isInitialized = false; // Ensure flag is false if init fails
      // Log the error and potentially notify the user
      return Promise.reject(this._initializationError(error.message || String(error)));
    }
  },

  /**
   * Handles critical initialization errors. Logs the error, optionally shows an alert,
   * and adds an error class to the main container for visual feedback.
   * @private
   * @param {string} message - The error message.
   * @returns {Error} An Error object with the provided message.
   */
  _initializationError(message) {
    console.error(`[SM CRITICAL] Initialization failed: ${message}`);
    // Use a global alert function if available, otherwise standard alert
    const notifyError = typeof window.showAlert === 'function' ? window.showAlert : alert;
    notifyError(`Application Initialization Failed: ${message}. Please check console and reload.`, "error", { duration: null });
    // Add a visual indicator to the UI if possible
    document.querySelector('.container')?.classList?.add('initialization-error');
    return new Error(message);
  },

  /**
   * Sets up event listeners for all UI controls (inputs, selects, checkboxes, etc.).
   * Uses helper functions for clarity and consistency.
   * @private
   */
  _setupEventListeners() {
    console.log('[SM] Setting up UI event listeners...');

    // --- Listener Helper Functions ---

    /** Binds a standard text input element. */
    const bindInput = (id) => {
      const el = document.getElementById(id);
      if (!el) { console.warn(`[SM] Element not found for binding: #${id}`); return; }
      el.addEventListener('input', (e) => {
        const value = e.target.value;
        this._updateSetting(id, value); // Update internal state

        // Special immediate updates
        if (id === 'logoText' && this._logoElement) {
          this._logoElement.textContent = value;
          // Update data-text attribute used by some effects (reflection, glitch)
          this._logoElement.setAttribute('data-text', value);
          this._updateSizeIndicator(); // Update width/height display
        }
        this._triggerSettingsUpdate(); // Notify listeners and save
      });
    };

    /** Binds a <select> dropdown element. */
    const bindSelect = (id) => {
      const el = document.getElementById(id);
      if (!el) { console.warn(`[SM] Element not found for binding: #${id}`); return; }
      el.addEventListener('change', (e) => {
        const value = e.target.value;
        this._updateSetting(id, value); // Update internal state
        let skipTrigger = false; // Flag to skip default trigger if handled specially

        // --- Handle specific select changes ---
        switch (id) {
          case 'fontFamily':
            // Debounce font application to avoid excessive loading/reflows
            clearTimeout(this._fontApplyDebounceTimer);
            this._updateFontPreview(value); // Update preview span immediately
            this._fontApplyDebounceTimer = setTimeout(async () => {
              await this._applyFontFamily(value); // Load and apply the font
              this._triggerSettingsUpdate(); // Trigger *after* font is applied
            }, this._FONT_APPLY_DEBOUNCE_DELAY);
            skipTrigger = true; // Prevent double trigger
            break;
          case 'fontWeight': this._applyFontWeight(value); break;
          case 'textAlign': this._applyTextAlign(value); break;
          case 'textCase':
            this._applyClass(this._logoElement, `${PREFIX.TEXT_CASE}${value}`, PREFIX.TEXT_CASE);
            break;
          case 'textDecoration': this._applyTextDecoration(value); break;
          case 'textStyle': this._applyTextStyle(value); break;
          case 'textStroke': this._applyTextStroke(value); break;
          case 'rotation': this._applyRotation(value); break;

          case 'textColorMode': this._handleColorModeChange(value); break;
          case 'gradientPreset': this._handleGradientPresetChange(value); break;

          case 'textShadow': // Basic text effect
          case 'advanced3dEffect': // Advanced text effect
            this._handleTextEffectChange(); // Combined handler reads both settings
            break;

          case 'borderStyle': // Basic border style
          case 'advancedBorderStyle': // Advanced border style/effect
            this._handleBorderStyleChange(); // Combined handler
            break;
          case 'borderRadius': this._applyBorderRadius(value); break;

          case 'textAnimation': // Basic animation
          case 'advancedTextAnimation': // Advanced animation
            this._handleAnimationChange(); // Combined handler
            break;

          case 'backgroundType': // Basic background type/pattern
          case 'advancedBackground': // Advanced background pattern
            this._handleBackgroundChange(); // Combined handler
            break;
          case 'backgroundGradientPreset': this._handleBackgroundGradientChange(value); break;

          case 'previewSize': this._applyPreviewSize(value); break;
          case 'aspectRatioPreset': this._handleAspectPresetChange(e.target); break;

          // Add other select IDs if they have specific direct actions needed on change
          // Otherwise, their effect will be applied during the next full applySettings cycle
          // triggered by _triggerSettingsUpdate()
        }

        if (!skipTrigger) {
          this._triggerSettingsUpdate(); // Notify listeners and save
        }
      });
    };

    /** Binds a number input (type="number"). */
    const bindNumberInput = (id, cssVar = null, unit = '') => {
      const el = document.getElementById(id);
      if (!el || (el.type !== 'number' && el.type !== 'text')) { // Allow text for fallback
          console.warn(`[SM] Number input not found or invalid type: #${id}`); return;
      }
      el.addEventListener('input', (e) => {
        const value = e.target.value;
        this._updateSetting(id, String(value)); // Store as string consistently

        // Apply direct effects
        if (cssVar) {
          document.documentElement.style.setProperty(cssVar, `<span class="math-inline">\{value\}</span>{unit}`);
          if (cssVar === '--dynamic-font-size') this._updateSizeIndicator();
        } else if (id === 'exportWidth' || id === 'exportHeight') {
          this._handleDimensionChange(id); // Handle aspect ratio locking
        } else if (id === 'borderPadding') {
          document.documentElement.style.setProperty('--dynamic-border-padding', `${value}px`);
        } else if (id === 'borderWidth') {
          document.documentElement.style.setProperty('--dynamic-border-width', `${value}px`);
        }
        // Add other specific number input actions if needed

        this._triggerSettingsUpdate();
      });
    };

    /** Binds a range input (type="range") and updates its associated display. */
    const bindRangeInput = (id, cssVar = null, unit = '', displaySuffix = null) => {
      const el = document.getElementById(id);
      if (!el || el.type !== 'range') { console.warn(`[SM] Range input not found or invalid type: #${id}`); return; }

      const displayEl = el.closest('.range-container')?.querySelector('.range-value-display');
      const suffix = displaySuffix !== null ? displaySuffix : (unit ? ` ${unit}` : ''); // Use custom suffix or unit

      // Function to update the visual display span
      const updateDisplay = (val) => {
        if (displayEl) displayEl.textContent = val + suffix;
      };
      updateDisplay(el.value); // Initial display update

      el.addEventListener('input', (e) => {
        const value = e.target.value;
        updateDisplay(value); // Update display on input
        this._updateSetting(id, String(value)); // Update internal state

        // Apply direct effects
        if (cssVar) {
          document.documentElement.style.setProperty(cssVar, `<span class="math-inline">\{value\}</span>{unit}`);
        } else if (id === 'animationSpeed') {
          this._applyAnimationSpeed(value);
        } else if (id === 'bgOpacity') {
          document.documentElement.style.setProperty('--bg-opacity', value);
        } else if (id === 'previewAreaPadding') {
            this._applyPreviewAreaPadding(value);
        }
        // Add other specific range input actions if needed

        this._triggerSettingsUpdate();
      });
    };

    /** Binds a checkbox input (type="checkbox"). */
    const bindCheckbox = (id) => {
      const el = document.getElementById(id);
      if (!el || el.type !== 'checkbox') { console.warn(`[SM] Checkbox not found or invalid type: #${id}`); return; }
      el.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        this._updateSetting(id, isChecked); // Update internal state

        // Special actions based on checkbox state
        if (id === 'useColor3') {
          // Toggle visibility of the third color picker
          document.getElementById('color3Control')?.classList.toggle('hidden', !isChecked);
          // Re-apply gradient if it's active and custom
          if (this._currentSettings.textColorMode === 'gradient' && this._currentSettings.gradientPreset === 'custom') {
            this._applyGradientToLogo();
          }
        } else if (id === 'aspectRatioLock') {
            this._handleAspectRatioLockChange(isChecked); // Trigger potential dimension update
        } else if (id === 'exportTransparent') {
            // May need to update preview visually if checkerboard is used for transparency
            // this._applyBackground(); // Or similar if preview needs refresh
        }
        // Add other checkbox-specific actions

        this._triggerSettingsUpdate();
      });
    };

    /** Binds a color input (type="color"). */
    const bindColorInput = (id, cssVar = null) => {
      const el = document.getElementById(id);
      if (!el || el.type !== 'color') { console.warn(`[SM] Color input not found or invalid type: #${id}`); return; }
      el.addEventListener('input', (e) => {
        const value = e.target.value;
        this._updateSetting(id, value); // Update internal state

        // Apply direct effects or update related elements
        if (cssVar) {
          document.documentElement.style.setProperty(cssVar, value);
          // If this is the border color, update the RGB version too
          if (cssVar === '--dynamic-border-color') {
            this._updateBorderColorRGB(value);
          }
        } else {
          // Handle color logic based on the specific input ID
          switch (id) {
            case 'solidColorPicker':
              if (this._currentSettings.textColorMode === 'solid') this._applySolidTextColor(value);
              break;
            case 'color1':
            case 'color2':
            case 'color3':
              if (this._currentSettings.textColorMode === 'gradient' && this._currentSettings.gradientPreset === 'custom') {
                this._applyGradientToLogo(); // Re-apply custom gradient
              }
              break;
            case 'backgroundColor':
              if (this._currentSettings.backgroundType === 'bg-solid' || this._currentSettings.advancedBackground === 'none') {
                 // Set the CSS var used by the ::before pseudo-element
                 document.documentElement.style.setProperty('--dynamic-bg-color', value);
              }
              break;
            case 'bgColor1':
            case 'bgColor2':
              if ((this._currentSettings.backgroundType?.includes('gradient') || this._currentSettings.advancedBackground === 'none') &&
                  this._currentSettings.backgroundGradientPreset === 'custom') {
                this._applyBackgroundGradient(); // Re-apply custom background gradient
              }
              break;
            case 'patternColor1':
            case 'patternColor2':
              this._applyPatternColors(); // Update pattern colors via CSS vars
              break;
          }
        }
        this._triggerSettingsUpdate();
      });
    };

    /** Binds the custom border radius text input. */
    const bindCustomRadius = (id) => {
      const el = document.getElementById(id);
      if (!el) { console.warn(`[SM] Element not found for binding: #${id}`); return; }
      el.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        this._updateSetting(id, value); // Update internal state

        // If user types in the custom field, ensure the dropdown is set to 'custom'
        const borderRadiusSelect = document.getElementById('borderRadius');
        if (borderRadiusSelect && value !== '' && borderRadiusSelect.value !== 'custom') {
          // Check if 'custom' option exists before setting it
          if (Array.from(borderRadiusSelect.options).some(opt => opt.value === 'custom')) {
            borderRadiusSelect.value = 'custom';
            this._updateSetting('borderRadius', 'custom'); // Sync internal state
            // Apply the radius class change immediately
             this._applyClass(this._logoContainer, BORDER_RADIUS_MAP['custom'], PREFIX.BORDER_RADIUS);
          }
        }

        // Apply the custom value (or fallback if invalid)
        this._applyCustomBorderRadiusValue(value);
        this._triggerSettingsUpdate();
      });
    };

    // --- Perform the actual bindings ---
    console.log('[SM] Binding UI controls...');

    // Basic Text & Style
    bindInput('logoText');
    bindSelect('fontFamily');
    bindNumberInput('fontSize', '--dynamic-font-size', 'px');
    bindRangeInput('letterSpacing', '--dynamic-letter-spacing', 'em');
    bindSelect('textCase');
    bindSelect('fontWeight');
    bindSelect('textAlign'); // Handled by _applyTextAlign
    bindRangeInput('rotation', '--dynamic-rotation', 'deg');

    // Advanced Text Style
    bindSelect('textDecoration');
    bindSelect('textStyle');
    bindSelect('textStroke');

    // Text Color
    bindSelect('textColorMode');
    bindColorInput('solidColorPicker'); // Used when textColorMode === 'solid'
    bindSelect('gradientPreset');
    bindColorInput('color1'); // Used for custom gradient
    bindColorInput('color2'); // Used for custom gradient
    bindCheckbox('useColor3');
    bindColorInput('color3'); // Used for custom gradient if useColor3 is true
    bindRangeInput('animationDirection', '--gradient-direction', 'deg'); // Text gradient direction

    // Text Effects
    bindSelect('textShadow'); // Basic effects (shadow/glow)
    bindSelect('advanced3dEffect'); // Advanced 3D effects

    // Border
    bindSelect('borderStyle'); // Basic border styles
    bindSelect('advancedBorderStyle'); // Advanced border styles & effects
    bindColorInput('borderColorPicker', '--dynamic-border-color'); // Used for border, stroke, etc.
    bindNumberInput('borderWidth', '--dynamic-border-width', 'px');
    bindSelect('borderRadius');
    bindCustomRadius('customBorderRadius'); // Input for custom radius values
    bindNumberInput('borderPadding', '--dynamic-border-padding', 'px');

    // Animations
    bindSelect('textAnimation'); // Basic animations
    bindSelect('advancedTextAnimation'); // Advanced animations
    bindRangeInput('animationSpeed', null, 'x', 'x'); // Controls --animation-duration

    // Background
    bindSelect('backgroundType'); // Basic background types/patterns
    bindSelect('advancedBackground'); // Advanced background patterns
    bindColorInput('backgroundColor', '--dynamic-bg-color'); // Solid color
    bindRangeInput('bgOpacity', '--bg-opacity', ''); // Background opacity
    bindSelect('backgroundGradientPreset');
    bindColorInput('bgColor1'); // Custom BG gradient
    bindColorInput('bgColor2'); // Custom BG gradient
    bindRangeInput('bgGradientDirection', '--bg-gradient-direction', 'deg'); // BG gradient direction

    // Pattern Colors (Optional - if patterns use these vars)
    bindColorInput('patternColor1', '--pattern-color1');
    bindColorInput('patternColor2', '--pattern-color2');

    // Preview Area
    bindSelect('previewSize'); // Applies class like 'preview-size-medium'
    bindRangeInput('previewAreaPadding', null, 'px'); // Applies padding style

    // Export Settings
    bindNumberInput('exportWidth');
    bindNumberInput('exportHeight');
    bindSelect('aspectRatioPreset');
    bindCheckbox('aspectRatioLock');
    bindRangeInput('exportQuality', null, '%', '%');
    bindCheckbox('exportTransparent');
    bindNumberInput('exportFrames');
    bindRangeInput('exportFrameRate', null, 'FPS', 'FPS');

    console.log('[SM] Event listeners configured.');
  },

  /**
   * Updates a specific setting in the internal state object.
   * @private
   * @param {string} key - The key of the setting to update (must match a key in DEFAULT_SETTINGS).
   * @param {*} value - The new value for the setting.
   */
  _updateSetting(key, value) {
    if (this._currentSettings.hasOwnProperty(key)) {
      this._currentSettings[key] = value;
    } else {
      console.warn(`[SM] Attempted to update unknown setting key: ${key}`);
    }
  },

  /**
   * Applies a complete settings object to the UI and preview elements.
   * Updates CSS variables, classes, styles, and optionally syncs UI input fields.
   * @param {object} settings - The settings object to apply. Should contain keys matching DEFAULT_SETTINGS.
   * @param {boolean} [forceUIUpdate=false] - If true, forcefully update the value/checked state of corresponding UI elements.
   * @param {boolean} [isInitialLoad=false] - If true, indicates this is the initial application on page load.
   * @returns {Promise<void>} A promise that resolves when settings have been applied.
   */
  async applySettings(settings, forceUIUpdate = false, isInitialLoad = false) {
    console.log(`[SM] Applying settings... (Force UI: ${forceUIUpdate}, Initial: ${isInitialLoad})`);

    // Ensure we have a valid settings object, merging with defaults if necessary
    const settingsToApply = { ...this.getDefaults(), ...settings };
    this._currentSettings = settingsToApply; // Update internal state

    // --- 1. Update UI Input Fields (if requested) ---
    if (forceUIUpdate || isInitialLoad) {
      console.log('[SM] Updating UI control values...');
      Object.entries(settingsToApply).forEach(([key, value]) => {
        try {
          const el = document.getElementById(key);
          if (!el) return; // Skip if element doesn't exist

          // Don't manually set font family during initial load if it might be validated later
          if (isInitialLoad && key === 'fontFamily' && typeof this._validateLoadedFont === 'function') {
              // Let _validateLoadedFont handle setting the dropdown after checking validity
          } else {
            const currentElementValue = (el.type === 'checkbox') ? el.checked : el.value;
            const newSettingValue = (el.type === 'checkbox') ? !!value : String(value ?? ''); // Coerce types

            // Update only if different or forced
            if (forceUIUpdate || String(currentElementValue) !== newSettingValue) {
              if (el.type === 'checkbox') {
                el.checked = newSettingValue;
              } else {
                el.value = newSettingValue;
              }
              // Trigger change/input event for range inputs to update display spans
              if ((forceUIUpdate || isInitialLoad) && el.type === 'range') {
                  el.dispatchEvent(new Event('input', { bubbles: true }));
              }
              // Trigger change event for select elements to update visual state if needed by frameworks/libraries
              if ((forceUIUpdate || isInitialLoad) && el.nodeName === 'SELECT') {
                  el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }
        } catch (e) {
          console.warn(`[SM] Error setting UI control value for #${key}:`, e);
        }
      });
      // Ensure range value displays are correct after potential updates
      this._updateRangeValueDisplays();
      // Ensure visibility of conditional controls (color pickers, etc.) is correct
      this._updateConditionalControlsVisibility();
    }

    // --- 2. Apply Styles and Classes ---
    console.log('[SM] Applying styles and classes...');
    if (!this._logoElement || !this._previewContainer || !this._logoContainer) {
      return Promise.reject(this._initializationError("Cannot apply styles: Missing core elements."));
    }

    // Apply text content and data-text attribute
    this._logoElement.textContent = settingsToApply.logoText;
    this._logoElement.setAttribute('data-text', settingsToApply.logoText);

    // Apply styles via CSS Variables
    document.documentElement.style.setProperty('--dynamic-font-size', `${settingsToApply.fontSize}px`);
    document.documentElement.style.setProperty('--dynamic-letter-spacing', `${settingsToApply.letterSpacing}em`);
    document.documentElement.style.setProperty('--dynamic-rotation', `${settingsToApply.rotation}deg`);
    document.documentElement.style.setProperty('--dynamic-border-color', settingsToApply.borderColorPicker);
    this._updateBorderColorRGB(settingsToApply.borderColorPicker); // Update --dynamic-border-color-rgb
    document.documentElement.style.setProperty('--dynamic-border-width', `${settingsToApply.borderWidth}px`);
    document.documentElement.style.setProperty('--dynamic-border-padding', `${settingsToApply.borderPadding}px`);
    document.documentElement.style.setProperty('--gradient-direction', `${settingsToApply.animationDirection}deg`); // Text gradient
    document.documentElement.style.setProperty('--bg-gradient-direction', `${settingsToApply.bgGradientDirection}deg`); // Background gradient
    document.documentElement.style.setProperty('--bg-opacity', settingsToApply.bgOpacity); // Background opacity
    this._applyAnimationSpeed(settingsToApply.animationSpeed); // Sets --animation-duration

    // Apply pattern colors (if used)
    this._applyPatternColors();

    // --- Apply settings via dedicated handlers ---

    // Basic Text Styling (Font, Weight, Case, Align)
    // Font family needs async loading, handled carefully
    await this._applyFontFamily(settingsToApply.fontFamily); // Apply font family (async)
    this._applyFontWeight(settingsToApply.fontWeight);     // Apply font weight class
    this._applyClass(this._logoElement, `<span class="math-inline">\{PREFIX\.TEXT\_CASE\}</span>{settingsToApply.textCase}`, PREFIX.TEXT_CASE); // Apply text case class
    this._applyTextAlign(settingsToApply.textAlign);       // Apply text alignment via container

    // Advanced Text Styling (Decoration, Style, Stroke)
    this._applyTextDecoration(settingsToApply.textDecoration);
    this._applyTextStyle(settingsToApply.textStyle);
    this._applyTextStroke(settingsToApply.textStroke);

    // Text Color (Solid vs Gradient)
    this._handleColorModeChange(settingsToApply.textColorMode); // Applies solid or gradient

    // Text Effects (Basic Shadow/Glow vs Advanced 3D)
    this._handleTextEffectChange(); // Reads settings and applies appropriate effect

    // Border (Basic Style vs Advanced Style/Effect)
    this._handleBorderStyleChange(); // Reads settings and applies appropriate border

    // Border Radius
    this._applyBorderRadius(settingsToApply.borderRadius); // Applies class and potentially custom value

    // Animations (Basic vs Advanced)
    this._handleAnimationChange(); // Reads settings and applies appropriate animation

    // Background (Type/Pattern/Color/Gradient)
    this._handleBackgroundChange(); // Reads settings and applies appropriate background

    // Preview Area Styling
    this._applyPreviewSize(settingsToApply.previewSize);
    this._applyPreviewAreaPadding(settingsToApply.previewAreaPadding);

    // --- 3. Final Updates & Notification ---
    console.log('[SM] Finalizing settings application...');
    // Ensure size indicators and CSS code output are updated after styles are applied
    // Use requestAnimationFrame to allow browser reflow first
    requestAnimationFrame(() => {
      this._updateSizeIndicator();
      this._updateCSSCode();
    });

    // Don't trigger if it's the initial load triggered *from init* (init handles the first trigger)
    if (!isInitialLoad) {
      this._triggerSettingsUpdate(); // Notify listeners and save changes
    }

    console.log('[SM] applySettings completed.');
    return Promise.resolve();
  },

  /**
   * Updates the visibility of UI controls that depend on other settings
   * (e.g., custom gradient pickers, custom border radius input).
   * Called during applySettings when forceUIUpdate is true.
   * @private
   */
  _updateConditionalControlsVisibility() {
    const s = this._currentSettings;

    // Text color controls
    const isSolid = s.textColorMode === 'solid';
    document.getElementById('solidColorPickerGroup')?.classList.toggle('hidden', !isSolid);
    document.getElementById('gradientPresetGroup')?.classList.toggle('hidden', isSolid);
    const isCustomGradient = !isSolid && s.gradientPreset === 'custom';
    document.getElementById('customGradientControls')?.classList.toggle('hidden', !isCustomGradient);
    document.getElementById('color3Control')?.classList.toggle('hidden', !(isCustomGradient && s.useColor3));

    // Background controls
    const bgType = s.advancedBackground !== 'none' ? s.advancedBackground : s.backgroundType;
    const isBgSolid = bgType === 'bg-solid';
    const isBgGradient = bgType?.includes('gradient'); // Catches 'bg-gradient' and 'bg-gradient-animated'
    document.getElementById('backgroundColorControl')?.classList.toggle('hidden', !isBgSolid);
    document.getElementById('backgroundGradientControls')?.classList.toggle('hidden', !isBgGradient);
    const isCustomBgGradient = isBgGradient && s.backgroundGradientPreset === 'custom';
    document.getElementById('customBackgroundGradient')?.classList.toggle('hidden', !isCustomBgGradient);

    // Border radius control
    const isCustomRadius = s.borderRadius === 'custom';
    document.getElementById('customBorderRadiusControl')?.classList.toggle('hidden', !isCustomRadius);

    // Pattern color controls (show if any pattern background is selected)
    const isPatternBg = !isBgSolid && !isBgGradient && bgType !== 'bg-transparent';
    document.getElementById('customPatternControls')?.classList.toggle('hidden', !isPatternBg);

     // Add more conditional visibility logic here if needed
     // Example: Show/hide GIF export options only if export format is GIF
     // const isGifExport = document.getElementById('exportFormat')?.value === 'gif';
     // document.getElementById('gifOptions')?.classList.toggle('hidden', !isGifExport);
  },


  /**
   * Saves the current settings to localStorage and notifies listeners.
   * Also triggers updates for elements dependent on the final state (size indicator, CSS code).
   * @private
   */
  _triggerSettingsUpdate() {
    this.saveCurrentSettings(); // Persist to localStorage

    // Create a deep copy to send to listeners, preventing accidental modification
    const settingsCopy = this.getCurrentSettings();

    // Notify internal listeners
    this._listeners.forEach((listener) => {
      try {
        listener(settingsCopy);
      } catch (e) {
        console.error('[SM] Error executing settings change listener:', e);
      }
    });

    // Dispatch a custom event for other parts of the application
    try {
      document.dispatchEvent(new CustomEvent('logomaker-settings-updated', {
        detail: { settings: settingsCopy },
      }));
    } catch (err) {
      console.error('[SM] Error dispatching logomaker-settings-updated event:', err);
    }

    // Update dependent UI elements after a frame to allow reflows
    requestAnimationFrame(() => {
      this._updateSizeIndicator();
      this._updateCSSCode();
    });
  },

  // Range display updates
  _updateRangeValueDisplays() {
    const controls = [
      { id: 'letterSpacing', unit: 'em' },
      { id: 'rotation', unit: 'deg' },
      { id: 'animationSpeed', unit: 'x' },
      { id: 'animationDirection', unit: 'deg' },
      { id: 'bgOpacity', unit: '' },
      { id: 'exportQuality', unit: '%' },
      { id: 'exportFrameRate', unit: 'FPS' },
      { id: 'bgGradientDirection', unit: 'deg' },
      { id: 'fontSize', unit: 'px' },
      { id: 'borderWidth', unit: 'px' },
      { id: 'borderPadding', unit: 'px' },
      { id: 'exportWidth', unit: 'px' },
      { id: 'exportHeight', unit: 'px' },
      { id: 'exportFrames', unit: '' },
    ];
    controls.forEach(({ id, unit }) => {
      const input = document.getElementById(id);
      if (!input) return;
      const disp = input.parentElement?.querySelector('.range-value-display');
      if (disp) {
        let suffix = unit;
        if (['x', 'FPS', '%'].includes(unit)) suffix = ` ${unit}`;
        disp.textContent = input.value + suffix;
      }
    });
  },

  _updateSizeIndicator() {
    const wEl = document.getElementById('logoWidth');
    const hEl = document.getElementById('logoHeight');
    if (!this._logoElement || !wEl || !hEl) return;
    try {
      const rect = this._logoElement.getBoundingClientRect();
      wEl.textContent = rect.width > 0 ? Math.round(rect.width) : '--';
      hEl.textContent = rect.height > 0 ? Math.round(rect.height) : '--';
    } catch {
      wEl.textContent = 'N/A';
      hEl.textContent = 'N/A';
    }
  },

  _updateCSSCode() {
    const codeEl = document.getElementById('cssCode');
    if (!codeEl) return;
    try {
      codeEl.value = this._generateCSSCode();
    } catch (err) {
      console.error('[SM] generateCSSCode error:', err);
      codeEl.value = '/* Error generating CSS */';
    }
  },

  _generateCSSCode() {
    if (!this._logoElement || !this._previewContainer || !this._logoContainer) {
      return '/* Error: Missing elements for CSS generation. */';
    }
    let css = `/* Generated CSS */\n\n:root {\n`;
    const vars = [
      '--animation-duration',
      '--gradient-direction',
      '--dynamic-border-color',
      '--dynamic-border-color-rgb',
      '--bg-gradient-direction',
      '--dynamic-font-size',
      '--dynamic-letter-spacing',
      '--dynamic-rotation',
      '--dynamic-border-width',
      '--dynamic-border-radius',
      '--dynamic-border-padding',
    ];
    vars.forEach((v) => {
      const val = document.documentElement.style.getPropertyValue(v)
        || getComputedStyle(document.documentElement).getPropertyValue(v);
      if (val?.trim()) {
        css += `  ${v}: ${val.trim()};\n`;
      }
    });
    css += `}\n\n`;

    // Classes from container, text
    const containerClasses = Array.from(this._logoContainer.classList)
      .filter((c) => c.startsWith('dynamic-border')
                 || c.startsWith(PREFIX.BORDER_STYLE)
                 || c.startsWith(PREFIX.BORDER_EFFECT)
                 || c.startsWith(PREFIX.BORDER_RADIUS))
      .map((c) => `.${c}`)
      .join('');
    const textClasses = Array.from(this._logoElement.classList)
      .filter((c) => c.startsWith(PREFIX.FONT_FAMILY)
                 || c.startsWith(PREFIX.FONT_WEIGHT)
                 || c.startsWith(PREFIX.TEXT_ALIGN)
                 || c.startsWith(PREFIX.TEXT_CASE)
                 || c.startsWith(PREFIX.TEXT_EFFECT)
                 || c.startsWith(PREFIX.ANIMATION)
                 || c.startsWith(PREFIX.TEXT_DECORATION)
                 || c.startsWith(PREFIX.TEXT_STYLE)
                 || c.startsWith(PREFIX.TEXT_STROKE))
      .map((c) => `.${c}`)
      .join('');

    css += `/* Container */\n.logo-container${containerClasses} {\n`;
    css += `  position: relative;\n  display: inline-flex;\n  align-items: center;\n`;
    css += `  justify-content: ${this._logoContainer.style.justifyContent || 'center'};\n`;
    css += `  padding: var(--dynamic-border-padding, 10px);\n`;
    css += `  border-radius: var(--dynamic-border-radius, 0);\n`;
    css += `}\n\n`;

    css += `/* Text */\n.logo-text${textClasses} {\n`;
    css += `  font-size: var(--dynamic-font-size);\n`;
    css += `  letter-spacing: var(--dynamic-letter-spacing);\n`;
    css += `  transform: rotate(var(--dynamic-rotation));\n`;
    css += `  line-height: 1.2;\n  white-space: nowrap;\n`;

    if (this._currentSettings.textColorMode === 'gradient') {
      css += `  background-image: ${this._logoElement.style.backgroundImage || 'none'};\n`;
      css += `  -webkit-background-clip: text;\n  background-clip: text;\n`;
      css += `  color: transparent;\n  -webkit-text-fill-color: transparent;\n`;
    } else {
      css += `  color: ${this._logoElement.style.color || '#ffffff'};\n`;
      css += `  background-image: none;\n  background-clip: initial;\n`;
      css += `  -webkit-background-clip: initial;\n  -webkit-text-fill-color: initial;\n`;
    }
    css += `}\n\n`;

    // Possibly show keyframes if there's a known animation
    const activeAnim = Array.from(this._logoElement.classList)
      .find((c) => c.startsWith(PREFIX.ANIMATION) && c !== 'anim-none');
    if (activeAnim && typeof window.getActiveAnimationKeyframes === 'function') {
      const animName = activeAnim.replace(PREFIX.ANIMATION, '');
      const keyframesCss = window.getActiveAnimationKeyframes(animName);
      if (keyframesCss) {
        css += `/* Keyframes for ${animName} */\n${keyframesCss}\n\n`;
      }
    }
    // If there's a background class
    const bgClass = Array.from(this._previewContainer.classList)
      .find((c) => c.startsWith(PREFIX.BACKGROUND) && c !== 'bg-solid' && c !== 'bg-transparent');
    if (bgClass) {
      css += `/* Background pattern: .${bgClass} */\n\n`;
    }

    return css.trim();
  },

  // Simple class management
  _applyClass(target, className, prefix = null) {
    if (!target || !className) return;
    try {
      if (prefix) {
        const toRemove = Array.from(target.classList).filter((c) => c.startsWith(prefix));
        if (toRemove.length > 0) {
          target.classList.remove(...toRemove);
        }
      }
      if (!className.endsWith('-none')) {
        target.classList.add(className);
      }
    } catch (e) {
      console.error(`[SM] Error applying class "${className}":`, e);
    }
  },

  _applyFontFamily(fontName) {
    return new Promise((resolve) => {
      if (!fontName) return resolve();
      // Attempt to load or apply
      getFontDataAsync(fontName)
        .then(() => {
          this._logoElement.style.fontFamily = `"${fontName}", sans-serif`;
          resolve();
        })
        .catch((err) => {
          console.warn('[SM] Could not load font:', fontName, err);
          this._logoElement.style.fontFamily = 'sans-serif';
          resolve();
        });
    });
  },

  _updateFontPreview(fontName) {
    const previewEl = document.getElementById('fontPreview');
    if (previewEl) {
      previewEl.style.fontFamily = fontName
        ? `"${fontName}", sans-serif`
        : 'sans-serif';
    }
  },

  _applyFontWeight(weightVal) {
    this._logoElement.style.fontWeight = weightVal || '400';
  },

  _applyTextAlign(alignVal) {
    if (!this._logoContainer) return;
    switch ((alignVal || 'center').toLowerCase()) {
      case 'left':
        this._logoContainer.style.justifyContent = 'flex-start';
        break;
      case 'right':
        this._logoContainer.style.justifyContent = 'flex-end';
        break;
      default:
        this._logoContainer.style.justifyContent = 'center';
        break;
    }
  },

    // A new helper to remove old text-decoration class and add the new one immediately
    _applyTextDecoration(val) {
      if (!this._logoElement) return;
      // Remove old
      const old = Array.from(this._logoElement.classList)
        .filter((c) => c.startsWith(PREFIX.TEXT_DECORATION));
      if (old.length) this._logoElement.classList.remove(...old);
  
      // Map from "underline" => "text-decoration-underline"
      const mapped = PREFIX.TEXT_DECORATION_MAP[val] || 'text-decoration-none';
      if (mapped !== 'text-decoration-none') {
        this._logoElement.classList.add(mapped);
      } else {
        // If none, we ensure no text-decoration class remains
        this._logoElement.classList.add('text-decoration-none');
      }
    },
  
    // Another helper for immediate textStyle
    _applyTextStyle(val) {
      if (!this._logoElement) return;
      const old = Array.from(this._logoElement.classList)
        .filter((c) => c.startsWith(PREFIX.TEXT_STYLE));
      if (old.length) this._logoElement.classList.remove(...old);
  
      const mapped = PREFIX.TEXT_STYLE_MAP[val] || 'text-style-normal';
      if (mapped !== 'text-style-normal') {
        this._logoElement.classList.add(mapped);
      } else {
        this._logoElement.classList.add('text-style-normal');
      }
    },
  
    // Another for textStroke
    _applyTextStroke(val) {
      if (!this._logoElement) return;
      const old = Array.from(this._logoElement.classList)
        .filter((c) => c.startsWith(PREFIX.TEXT_STROKE));
      if (old.length) this._logoElement.classList.remove(...old);
  
      const mapped = PREFIX.TEXT_STROKE_MAP[val] || 'text-stroke-none';
      if (mapped !== 'text-stroke-none') {
        this._logoElement.classList.add(mapped);
      } else {
        this._logoElement.classList.add('text-stroke-none');
      }
    },
  
    // (We keep your old `_applyTextCase`, `_applyFontWeight`, `_applyTextAlign` if you had them)
    _applyTextCase(val) {
      if (!this._logoElement) return;
      // Remove old text-case-*
      const old = Array.from(this._logoElement.classList)
        .filter((c) => c.startsWith(PREFIX.TEXT_CASE));
      if (old.length) this._logoElement.classList.remove(...old);
  
      if (val && val !== 'none') {
        const newClass = PREFIX.TEXT_CASE + val;
        this._logoElement.classList.add(newClass);
      } else {
        // fallback to 'text-case-none' if you want
        this._logoElement.classList.add('text-case-none');
      }
    },
  
    _applyFontWeight(val) {
      if (!this._logoElement) return;
      // Remove old
      const old = Array.from(this._logoElement.classList)
        .filter((c) => c.startsWith(PREFIX.FONT_WEIGHT));
      if (old.length) this._logoElement.classList.remove(...old);
  
      const newClass = PREFIX.FONT_WEIGHT + val;
      this._logoElement.classList.add(newClass);
    },
  
    // textShadow remains your old `_applyTextEffect` or `_handleTextEffectChange`.
    // We'll do a short version:
    _applyTextShadowEffect(effectVal) {
      if (!this._logoElement) return;
      // remove old
      const old = Array.from(this._logoElement.classList)
        .filter((c) => c.startsWith(PREFIX.TEXT_EFFECT));
      if (old.length) this._logoElement.classList.remove(...old);
  
      const mapped = PREFIX.TEXT_EFFECTS_MAP[effectVal] || 'text-effect-none';
      if (mapped !== 'text-effect-none') {
        this._logoElement.classList.add(mapped);
      } else {
        this._logoElement.classList.add('text-effect-none');
      }
    },

  // Color Mode Handling
  _handleColorModeChange(mode) {
    const isSolid = (mode === 'solid');
    document.getElementById('solidColorPickerGroup')?.classList.toggle('hidden', !isSolid);
    document.getElementById('gradientPresetGroup')?.classList.toggle('hidden', isSolid);
    const isCustomGrad = (!isSolid && this._currentSettings.gradientPreset === 'custom');
    document.getElementById('customGradientControls')?.classList.toggle('hidden', !isCustomGrad);

    if (isSolid) {
      this._applySolidTextColor(this._currentSettings.solidColorPicker);
    } else {
      this._applyGradientToLogo();
    }
  },
  _handleGradientPresetChange(preset) {
    const isCustom = (preset === 'custom');
    const showCustom = (
      this._currentSettings.textColorMode === 'gradient' && isCustom
    );
    document.getElementById('customGradientControls')?.classList.toggle('hidden', !showCustom);
    if (this._currentSettings.textColorMode === 'gradient') {
      this._applyGradientToLogo();
    }
  },
  _applySolidTextColor(color) {
    if (!this._logoElement) return;
    this._logoElement.style.backgroundImage = 'none';
    this._logoElement.style.backgroundClip = 'initial';
    this._logoElement.style.webkitBackgroundClip = 'initial';
    this._logoElement.style.webkitTextFillColor = 'initial';
    this._logoElement.style.color = color || '#ffffff';
  },
  _applyGradientToLogo() {
    if (!this._logoElement) return;
    const direction = this._currentSettings.animationDirection || '45';
    const preset = this._currentSettings.gradientPreset;
    let gradientCss = '';

    try {
      if (preset === 'custom') {
        const c1 = this._currentSettings.color1 || '#FF1493';
        const c2 = this._currentSettings.color2 || '#8A2BE2';
        const useC3 = this._currentSettings.useColor3;
        const c3 = this._currentSettings.color3 || '#FF4500';
        gradientCss = useC3
          ? `linear-gradient(${direction}deg, ${c1}, ${c2}, ${c3})`
          : `linear-gradient(${direction}deg, ${c1}, ${c2})`;
      } else {
        // Try reading from a CSS var
        let varVal = '';
        try {
          varVal = getComputedStyle(document.documentElement)
            .getPropertyValue(`--${preset}`)
            .trim();
        } catch {}
        if (varVal && varVal.startsWith('linear-gradient')) {
          gradientCss = varVal.replace(
            /linear-gradient\([^,]+,/,
            `linear-gradient(${direction}deg,`
          );
        } else {
          // fallback list
          const fallbackMap = {
            'primary-gradient': `linear-gradient(${direction}deg,#FF1493,#8A2BE2)`,
            // etc. add more if needed
          };
          gradientCss = fallbackMap[preset]
            || `linear-gradient(${direction}deg,#FF1493,#8A2BE2)`;
        }
      }
      this._logoElement.style.backgroundImage = gradientCss;
      this._logoElement.style.webkitBackgroundClip = 'text';
      this._logoElement.style.backgroundClip = 'text';
      this._logoElement.style.color = 'transparent';
      this._logoElement.style.webkitTextFillColor = 'transparent';
    } catch (e) {
      console.error('[SM] Error applying gradient:', e);
      this._applySolidTextColor('#ffffff');
    }
  },

  // Text Effects
  _handleTextEffectChange(which, val) {
    if (!this._logoElement) return;
    // We'll unify "advanced3dEffect" vs. normal "textShadow"
    if (which === 'advanced3dEffect') {
      // Remove any textShadow-based classes first
      const shadowClasses = Array.from(this._logoElement.classList)
        .filter((c) => c.startsWith(PREFIX.TEXT_EFFECT) && !c.includes('3d-'));
      if (shadowClasses.length > 0) {
        this._logoElement.classList.remove(...shadowClasses);
      }
      // Then apply the 3D effect
      Object.values(ADVANCED_3D_EFFECT_MAP).forEach((cls) => {
        if (cls && this._logoElement.classList.contains(cls)) {
          this._logoElement.classList.remove(cls);
        }
      });
      const effectCls = ADVANCED_3D_EFFECT_MAP[val] || 'text-effect-none';
      if (effectCls !== 'text-effect-none') {
        this._logoElement.classList.add(effectCls);
        if (effectCls === 'text-effect-reflection') {
          this._logoElement.setAttribute('data-text', this._logoElement.textContent);
        }
      }
    } else {
      // 'textShadow'
      // First remove any 3d classes
      Object.values(ADVANCED_3D_EFFECT_MAP).forEach((cls) => {
        if (cls && this._logoElement.classList.contains(cls)) {
          this._logoElement.classList.remove(cls);
        }
      });
      // Then apply standard text effect
      const existing = Array.from(this._logoElement.classList)
        .filter((c) => c.startsWith('text-effect-'));
      if (existing.length > 0) {
        this._logoElement.classList.remove(...existing);
      }
      if (val && val !== 'text-effect-none') {
        this._logoElement.classList.add(val);
      }
    }
  },

  // Border Style
  _handleBorderStyleChange(which, val) {
    if (!this._logoContainer) return;
    // Remove existing
    const toRemove = Array.from(this._logoContainer.classList).filter((c) =>
      c.startsWith('border-style-') ||
      c.startsWith('border-effect-') ||
      c.startsWith('border-') && c !== 'border-radius-custom' && c !== 'dynamic-border'
    );
    if (toRemove.length > 0) {
      this._logoContainer.classList.remove(...toRemove);
    }
    // Always ensure .dynamic-border if we have any style
    if (!this._logoContainer.classList.contains('dynamic-border')) {
      this._logoContainer.classList.add('dynamic-border');
    }
    const mapped = BORDER_STYLE_EFFECT_MAP[val] || 'border-style-none';
    if (mapped !== 'border-style-none') {
      this._logoContainer.classList.add(mapped);
    }
  },
  // Border radius
  _applyBorderRadius(rVal) {
    if (!this._logoContainer || !rVal) return;

    // 🛑 GUARD: Prevent loop by checking if the value is already applied
    if (
      this._logoContainer.dataset._lastAppliedRadius === rVal
    ) {
      return; // Skip redundant re-application
    }
    this._logoContainer.dataset._lastAppliedRadius = rVal;

    const cls = BORDER_RADIUS_MAP[rVal] || 'border-radius-none';
    this._applyClass(this._logoContainer, cls, PREFIX.BORDER_RADIUS);

    if (window.CSSUtils?.applyBorderRadius) {
      window.CSSUtils.applyBorderRadius(this._logoContainer, rVal);
    } else {
      let cssR = '0px';
      switch (rVal) {
        case 'none':
        case 'square':
          cssR = '0px';
          break;
        case 'circle':
          cssR = '50%';
          break;
        case 'pill':
          cssR = '999px';
          break;
        case 'rounded-sm':
          cssR = '4px';
          break;
        case 'rounded-md':
          cssR = '8px';
          break;
        case 'rounded-lg':
          cssR = '12px';
          break;
        case 'custom':
          cssR = document.documentElement.style.getPropertyValue('--dynamic-border-radius') || '0px';
          break;
        default:
          break;
      }
      this._logoContainer.style.borderRadius = cssR;
      document.documentElement.style.setProperty('--dynamic-border-radius', cssR);
    }
  },
  _applyCustomBorderRadius(v) {
    if (!this._logoContainer) return;
    let val = v.trim();
    let finalVal = '';
    if (val !== '' && !isNaN(val) && Number(val) >= 0) {
      finalVal = `${Number(val)}px`;
    } else if (this._currentSettings.borderRadius !== 'custom') {
      this._applyBorderRadius(this._currentSettings.borderRadius);
      return;
    } else {
      finalVal = '0px';
    }
    this._logoContainer.style.borderRadius = finalVal;
    document.documentElement.style.setProperty('--dynamic-border-radius', finalVal);
  },
  _applyFontStyle(style) {
    if (!this._logoElement) return;
  
    const validStyles = ['normal', 'italic', 'oblique'];
    const styleToApply = validStyles.includes(style) ? style : 'normal';
  
    this._logoElement.style.fontStyle = styleToApply;
  },  
  // Animations
  _handleAnimationChange(which, val) {
    if (!this._logoElement) return;
    // Wipe old
    const oldAnim = Array.from(this._logoElement.classList)
      .filter((c) => c.startsWith(PREFIX.ANIMATION));
    if (oldAnim.length > 0) {
      this._logoElement.classList.remove(...oldAnim);
    }
    const animCls = ANIMATION_MAP[val] || 'anim-none';
    if (animCls !== 'anim-none') {
      this._logoElement.classList.add(animCls);
    }
  },
  _applyAnimationSpeed(spd) {
    const baseDuration = 2.0;
    const speedVal = parseFloat(spd || '1');
    const final = Math.max(0.1, baseDuration / Math.max(0.1, speedVal));
    document.documentElement.style.setProperty('--animation-duration', `${final.toFixed(2)}s`);
  },

  // Background
  _handleBackgroundChange(which, val) {
    if (!this._previewContainer) return;
    // Clear advanced classes
    Object.values(BACKGROUND_MAP).forEach((cls) => {
      if (cls && this._previewContainer.classList.contains(cls)) {
        this._previewContainer.classList.remove(cls);
      }
    });
    // If advanced != none, override
    if (which === 'advancedBackground' && val !== 'none') {
      // Temporarily remove standard background class
      const existingStd = this._currentSettings.backgroundType;
      if (existingStd !== 'bg-solid' && existingStd !== 'bg-transparent') {
        // store or remove
        this._previewContainer.classList.remove(existingStd);
      }
      const advCls = BACKGROUND_MAP[val];
      if (advCls) this._previewContainer.classList.add(advCls);
      return;
    }
    // Otherwise normal background
    const mapped = BACKGROUND_MAP[val];
    if (mapped) {
      this._previewContainer.classList.add(mapped);
    }

    // Show/hide relevant controls
    const isSolid = (val === 'bg-solid');
    const isGrad = (val?.includes('gradient'));
    document.getElementById('backgroundColorControl')?.classList.toggle('hidden', !isSolid);
    document.getElementById('backgroundGradientControls')?.classList.toggle('hidden', !isGrad);
    const isCustomGrad = (isGrad && this._currentSettings.backgroundGradientPreset === 'custom');
    document.getElementById('customBackgroundGradient')?.classList.toggle('hidden', !isCustomGrad);

    if (isSolid) {
      this._applySolidBgColor(this._currentSettings.backgroundColor);
    } else if (isGrad) {
      this._applyBackgroundGradient();
    } else if (val === 'bg-transparent') {
      this._previewContainer.style.backgroundColor = 'transparent';
      this._previewContainer.style.backgroundImage = 'none';
    }
    this._previewContainer.style.opacity = this._currentSettings.bgOpacity || '1';
  },
  _applySolidBgColor(color) {
    if (!this._previewContainer) return;
    this._previewContainer.style.backgroundColor = color || '#000000';
    this._previewContainer.style.backgroundImage = 'none';
  },
  _handleBackgroundGradientChange(preset) {
    const isCustom = (preset === 'custom');
    const isGrad = this._currentSettings.backgroundType?.includes('gradient');
    document.getElementById('customBackgroundGradient')
      ?.classList.toggle('hidden', !(isCustom && isGrad));
    if (isGrad) this._applyBackgroundGradient();
  },
  _applyBackgroundGradient() {
    if (!this._previewContainer) return;
    const dir = this._currentSettings.bgGradientDirection || '90';
    const preset = this._currentSettings.backgroundGradientPreset;
    let gradStr = '';
    try {
      if (preset === 'custom') {
        const c1 = this._currentSettings.bgColor1 || '#3a1c71';
        const c2 = this._currentSettings.bgColor2 || '#ffaf7b';
        gradStr = `linear-gradient(${dir}deg, ${c1}, ${c2})`;
      } else {
        let varVal = '';
        try {
          varVal = getComputedStyle(document.documentElement)
            .getPropertyValue(`--${preset}`)
            .trim();
        } catch {}
        if (varVal && varVal.startsWith('linear-gradient')) {
          gradStr = varVal.replace(
            /linear-gradient\([^,]+,/,
            `linear-gradient(${dir}deg,`
          );
        } else {
          gradStr = `linear-gradient(${dir}deg,#1a1a2e,#0f3460)`;
        }
      }
      this._previewContainer.style.backgroundImage = gradStr;
      this._previewContainer.style.backgroundColor = '';
    } catch (e) {
      console.error('[SM] BG gradient error:', e);
      this._applySolidBgColor('#000000');
    }
  },

  // Pattern colors
  _applyPatternColors() {
    // If your BG patterns rely on CSS variables, set them here:
    // e.g. document.documentElement.style.setProperty('--pattern-color1', this._currentSettings.patternColor1);
    // etc. Implementation is up to you.
  },

  // Preview sizing
  _applyPreviewSize(sz) {
    if (!this._previewContainer) return;
    // Remove old
    const oldSz = Array.from(this._previewContainer.classList)
      .filter((c) => c.startsWith(PREFIX.PREVIEW_SIZE));
    if (oldSz.length > 0) {
      this._previewContainer.classList.remove(...oldSz);
    }
    if (sz !== 'preview-size-auto') {
      this._previewContainer.classList.add(sz);
    }
  },
  _applyPreviewAreaPadding(val) {
    if (!this._previewContainer) return;
    const pxVal = /^\d+(\.\d+)?$/.test(val) ? `${val}px` : val;
    this._previewContainer.style.padding = pxVal;
  },

  // Aspect Ratio logic
  _getCurrentAspectRatio() {
    const presetSel = document.getElementById('aspectRatioPreset');
    const presetVal = this._currentSettings.aspectRatioPreset || 'auto';
    if (presetVal !== 'auto' && presetSel) {
      const opt = presetSel.options[presetSel.selectedIndex];
      const ratio = parseFloat(opt?.dataset?.ratio);
      if (!isNaN(ratio) && ratio > 0) return ratio;
    }
    // fallback: measure container
    if (!this._logoContainer) return 1;
    const w = this._logoContainer.offsetWidth;
    const h = this._logoContainer.offsetHeight;
    if (w <= 0 || h <= 0) return 1;
    return w / h;
  },
  _handleAspectPresetChange(selectEl) {
    if (!selectEl) return;
    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt) return;
    const val = opt.value;
    const ratio = parseFloat(opt?.dataset?.ratio);
    this._currentSettings.aspectRatioPreset = val;
    if (!isNaN(ratio) && ratio > 0) {
      const wInput = document.getElementById('exportWidth');
      const hInput = document.getElementById('exportHeight');
      const lockCb = document.getElementById('aspectRatioLock');
      if (!wInput || !hInput || !lockCb) return;
      const baseW = parseInt(this._currentSettings.exportWidth || '800');
      const newW = baseW;
      const newH = Math.max(10, Math.round(newW / ratio));
      this._isUpdatingAspectRatio = true;
      hInput.value = newH;
      this._currentSettings.exportHeight = String(newH);
      lockCb.checked = true;
      this._currentSettings.aspectRatioLock = true;
      this._isUpdatingAspectRatio = false;
    }
    this._triggerSettingsUpdate();
  },
  _handleDimensionChange(changedId) {
    if (this._isUpdatingAspectRatio || !this._currentSettings.aspectRatioLock) return;
    this._isUpdatingAspectRatio = true;
    try {
      const ratio = this._getCurrentAspectRatio();
      if (!ratio || isNaN(ratio) || ratio <= 0) return;
      const wInput = document.getElementById('exportWidth');
      const hInput = document.getElementById('exportHeight');
      if (!wInput || !hInput) return;
      const changedVal = parseFloat(this._currentSettings[changedId]);
      if (isNaN(changedVal) || changedVal <= 0) return;
      let tgtEl, tgtKey, newVal;
      if (changedId === 'exportWidth') {
        tgtEl = hInput;
        tgtKey = 'exportHeight';
        newVal = Math.round(changedVal / ratio);
      } else {
        tgtEl = wInput;
        tgtKey = 'exportWidth';
        newVal = Math.round(changedVal * ratio);
      }
      newVal = Math.max(10, newVal);
      if (String(newVal) !== this._currentSettings[tgtKey]) {
        tgtEl.value = newVal;
        this._currentSettings[tgtKey] = String(newVal);
      }
    } catch (err) {
      console.error('[SM] Aspect ratio dimension update error:', err);
    } finally {
      this._isUpdatingAspectRatio = false;
    }
  },

  // LocalStorage Persistence
  loadSavedSettings() {
    try {
      const json = localStorage.getItem('logomakerSettings');
      if (json) {
        const loaded = JSON.parse(json);
        this._currentSettings = { ...this.getDefaults(), ...loaded };
        console.log('[SM] Loaded settings from localStorage.');
        setTimeout(() => {
          this._validateLoadedFont();
        }, 500);
      } else {
        this._currentSettings = this.getDefaults();
        console.log('[SM] No saved settings found.');
      }
    } catch (err) {
      console.error('[SM] loadSavedSettings error:', err);
      this._currentSettings = this.getDefaults();
      if (typeof showAlert === 'function') {
        showAlert('Failed to load settings.', 'warning');
      }
    }
  },
  _validateLoadedFont() {
    try {
      const dd = document.getElementById('fontFamily');
      const saved = this._currentSettings.fontFamily;
      if (dd && dd.options.length > 1 && saved) {
        const opt = dd.querySelector(`option[value="${CSS.escape(saved)}"]`);
        if (!opt) {
          console.warn(`[SM] Saved font '${saved}' not found. Reverting to default.`);
          this._currentSettings.fontFamily = DEFAULT_SETTINGS.fontFamily;
          if (dd.value !== this._currentSettings.fontFamily) {
            dd.value = this._currentSettings.fontFamily;
          }
        }
      }
    } catch (e) {
      console.error('[SM] validateLoadedFont error:', e);
    }
  },
  saveCurrentSettings() {
    try {
      localStorage.setItem('logomakerSettings', JSON.stringify(this._currentSettings));
    } catch (err) {
      console.error('[SM] saveCurrentSettings error:', err);
      if (typeof showAlert === 'function') {
        showAlert('Could not save settings.', 'error');
      }
    }
  },

  // Reset
  resetSettings(resetType = 'all') {
    console.log(`[SM] Resetting settings - Type: ${resetType}`);
    const defs = this.getDefaults();
    let toApply;
    if (resetType === 'all') {
      toApply = { ...defs };
    } else {
      toApply = { ...this.getCurrentSettings() };
      const catMap = {
        text: [
          'logoText', 'fontFamily', 'fontSize', 'letterSpacing',
          'textCase', 'fontWeight', 'textAlign',
        ],
        style: [
          'textColorMode', 'solidColorPicker', 'gradientPreset',
          'color1', 'color2', 'useColor3', 'color3', 'animationDirection',
          'textShadow', 'textAnimation', 'animationSpeed', 'rotation',
        ],
        border: [
          'borderColorPicker', 'borderStyle', 'borderWidth',
          'borderRadius', 'borderPadding', 'customBorderRadius',
        ],
        background: [
          'backgroundType', 'backgroundColor', 'bgOpacity',
          'backgroundGradientPreset', 'bgColor1', 'bgColor2', 'bgGradientDirection',
        ],
      };
      const keys = catMap[resetType] || Object.keys(defs);
      keys.forEach((k) => {
        if (defs.hasOwnProperty(k)) {
          toApply[k] = defs[k];
        }
      });
    }
    this.applySettings(toApply, true)
      .then(() => {
        console.log(`[SM] Reset (${resetType}) applied.`);
        if (typeof showToast === 'function') {
          showToast({ message: `Settings Reset (${resetType})!`, type: 'success' });
        }
      })
      .catch((err) => {
        console.error('[SM] Error applying reset:', err);
        if (typeof showAlert === 'function') {
          showAlert('Failed to reset settings.', 'error');
        }
      });
  },

  addSettingsChangeListener(fn) {
    if (typeof fn === 'function' && !this._listeners.includes(fn)) {
      this._listeners.push(fn);
    }
  },
  removeSettingsChangeListener(fn) {
    this._listeners = this._listeners.filter((x) => x !== fn);
  },

  pickRandomColorMode() {
    // Suppose you only allow "solid" vs "gradient".
    // Weighted approach: 40% chance "solid", 60% chance "gradient"
    const colorModeOptions = ['solid', 'gradient'];
    const colorModeWeights = [4, 6]; // total = 10

    // Weighted random logic
    let total = colorModeWeights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < colorModeOptions.length; i++) {
      r -= colorModeWeights[i];
      if (r <= 0) return colorModeOptions[i];
    }
    // fallback
    return 'solid';
  },

  _applyTextDecoration(decoration) {
    document.documentElement.style.setProperty('--dynamic-text-decoration', decoration);
  },
  

  _updateBorderColorRGB(hexColor) {
    const rgb = this._extractColorRGB(hexColor);
    document.documentElement.style.setProperty('--dynamic-border-color-rgb', rgb);
  },
  

  // Helper to parse color -> rgb
  _extractColorRGB(hex) {
    // minimal fallback
    if (!hex || typeof hex !== 'string') return '255,255,255';
    const c = hex.replace('#', '').trim();
    if (c.length === 3) {
      const r = parseInt(c[0] + c[0], 16);
      const g = parseInt(c[1] + c[1], 16);
      const b = parseInt(c[2] + c[2], 16);
      return `${r},${g},${b}`;
    } else if (c.length >= 6) {
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      return `${r},${g},${b}`;
    }
    return '255,255,255';
  },
};

export default SettingsManager;
window.SettingsManager = SettingsManager; // manually attach
