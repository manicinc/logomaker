/**
 * @file settingsManager.js
 * @version 22.2 (Apply inline styles for better live preview consistency)
 * @description
 * Manages application settings, applies them to the UI and DOM elements,
 * handles loading/saving, and provides hooks for other modules.
 * Ensures live preview reflects style changes more reliably.
 */

// Assuming getFontDataAsync is globally available or imported elsewhere
// Example: import { getFontDataAsync } from './fontLoader.js';

// Assuming getAnimationKeyframes is available
import { getAnimationKeyframes } from './utils/svgAnimationInfo.js'; // Adjust path if necessary!

console.log('[SettingsManager v22.2] Loading...');

// --- Constants ---
const PREFIX = {
    FONT_FAMILY: 'font-family-', FONT_WEIGHT: 'font-weight-', TEXT_ALIGN: 'text-align-',
    TEXT_CASE: 'text-case-', TEXT_DECORATION: 'text-decoration-', TEXT_STYLE: 'text-style-',
    TEXT_STROKE: 'text-stroke-', TEXT_EFFECT: 'text-effect-', BORDER_STYLE: 'border-style-',
    BORDER_EFFECT: 'border-effect-', BORDER_RADIUS: 'border-radius-', ANIMATION: 'anim-',
    PREVIEW_SIZE: 'preview-size-', BACKGROUND: 'bg-',
};

// --- Default Settings ---
const DEFAULT_SETTINGS = {
    logoText: 'Manic', fontFamily: 'Orbitron', fontSize: '100', fontWeight: '700',
    letterSpacing: '0.03', textCase: 'none', textAlign: 'center', rotation: '0',
    textColorMode: 'solid', solidColorPicker: '#ffffff', gradientPreset: 'primary-gradient',
    color1: '#FF1493', color2: '#8A2BE2', useColor3: false, color3: '#FF4500',
    animationDirection: '45', textShadow: 'text-effect-none', advanced3dEffect: 'none',
    textDecoration: 'none', textStyle: 'normal', textStroke: 'none', textOpacity: '1', // Added textOpacity
    borderStyle: 'border-none', advancedBorderStyle: 'none', borderColorPicker: '#ffffff',
    borderWidth: '2', borderRadius: 'none', customBorderRadius: '', borderPadding: '16',
    textAnimation: 'anim-none', advancedTextAnimation: 'none', animationSpeed: '1',
    backgroundType: 'bg-solid', advancedBackground: 'none', backgroundColor: '#000000',
    bgOpacity: '1', backgroundGradientPreset: 'bg-primary-gradient', bgColor1: '#3a1c71',
    bgColor2: '#ffaf7b', bgGradientDirection: '90', patternColor1: '#444444',
    patternColor2: '#1e1e1e', previewSize: 'preview-size-medium', previewAreaPadding: '32',
    exportWidth: '800', exportHeight: '400', aspectRatioPreset: 'auto',
    aspectRatioLock: false, exportQuality: '95', exportTransparent: false,
    exportFrames: '15', exportFrameRate: '10',
};

// --- Mapping Tables ---
const TEXT_DECORATION_MAP = {
    'none': 'text-decoration-none', 'underline': 'text-decoration-underline',
    'overline': 'text-decoration-overline', 'line-through': 'text-decoration-line-through',
    'dashed-underline': 'text-decoration-dashed-underline', 'wavy-underline': 'text-decoration-wavy-underline',
};
const TEXT_STYLE_MAP = { 'normal': 'text-style-normal', 'italic': 'text-style-italic', 'oblique': 'text-style-oblique' };
const TEXT_STROKE_MAP = { 'none': 'text-stroke-none', 'thin': 'text-stroke-thin', 'medium': 'text-stroke-medium', 'thick': 'text-stroke-thick', 'contrast': 'text-stroke-contrast' };
const ADVANCED_3D_EFFECT_MAP = { 'none': 'text-effect-none', '3d-simple': 'text-effect-3d-simple', '3d-extrude': 'text-effect-3d-extrude', '3d-bevel': 'text-effect-3d-bevel', 'isometric': 'text-effect-isometric', 'reflection': 'text-effect-reflection', 'cutout': 'text-effect-cutout', };
const BORDER_STYLE_EFFECT_MAP = { 'border-none': 'border-style-none', 'border-solid': 'border-style-solid', 'border-double': 'border-style-double', 'border-dashed': 'border-style-dashed', 'border-dotted': 'border-style-dotted', 'border-groove': 'border-style-groove', 'border-ridge': 'border-style-ridge', 'border-inset': 'border-style-inset', 'border-outset': 'border-style-outset', 'border-pixel': 'border-style-pixel', 'border-glow': 'border-effect-glow-soft', 'border-neon': 'border-effect-neon-animated', 'border-gradient': 'border-effect-gradient-animated', 'none': 'border-style-none', 'multi-layer': 'border-style-multi-layer', 'image-dots': 'border-style-image-dots', 'image-zigzag': 'border-style-image-zigzag', 'corners-cut': 'border-style-corners-cut', 'corners-rounded-different': 'border-style-corners-rounded-different', 'marching-ants': 'border-effect-marching-ants', 'rotating-dash': 'border-effect-rotating-dash', 'double-glow': 'border-effect-double-glow', 'glow-soft': 'border-effect-glow-soft', 'glow-strong': 'border-effect-glow-strong', 'glow-pulse': 'border-effect-glow-pulse', 'neon-animated': 'border-effect-neon-animated', 'gradient-animated': 'border-effect-gradient-animated', 'border-style-thick': 'border-style-thick', };
const BORDER_RADIUS_MAP = { 'none': 'border-radius-none', 'rounded-sm': 'border-radius-sm', 'rounded-md': 'border-radius-md', 'rounded-lg': 'border-radius-lg', 'pill': 'border-radius-pill', 'circle': 'border-radius-circle', 'custom': 'border-radius-custom', };
const ANIMATION_MAP = { 'anim-none': 'anim-none', 'anim-pulse': 'anim-pulse', 'anim-bounce': 'anim-bounce', 'anim-shake': 'anim-shake', 'anim-float': 'anim-float', 'anim-rotate': 'anim-rotate', 'anim-glitch': 'anim-glitch', 'anim-wave': 'anim-wave', 'anim-flicker': 'anim-flicker', 'anim-fade': 'anim-fade', 'none': 'anim-none', 'liquify': 'anim-liquify', 'wobble': 'anim-wobble', 'perspective': 'anim-perspective', 'split': 'anim-split', 'magnify': 'anim-magnify', 'glow-multicolor': 'anim-glow-multicolor', 'flip-3d': 'anim-flip-3d', 'swing-3d': 'anim-swing-3d', };
const BACKGROUND_MAP = { 'bg-transparent': 'bg-transparent', 'bg-solid': 'bg-solid', 'bg-gradient': 'bg-gradient', 'bg-gradient-animated': 'bg-gradient-animated', 'bg-grid': 'bg-grid', 'bg-darkgrid': 'bg-darkgrid', 'bg-dots-sm': 'bg-dots-sm', 'bg-dots-lg': 'bg-dots-lg', 'bg-checkerboard': 'bg-checkerboard', 'bg-lines-diag': 'bg-lines-diag', 'bg-lines-vert': 'bg-lines-vert', 'bg-carbon': 'bg-carbon', 'bg-noise': 'bg-noise', 'bg-stars': 'bg-stars', 'bg-synthwave': 'bg-synthwave', 'bg-matrix': 'bg-matrix', 'bg-scanlines': 'bg-scanlines', 'bg-circuit': 'bg-circuit', 'none': 'bg-solid', 'hexagons': 'bg-hexagons', 'diamonds': 'bg-diamonds', 'wave-pattern': 'bg-wave-pattern', 'graph-paper': 'bg-graph-paper', 'gradient-pulse': 'bg-gradient-pulse', 'floating-particles': 'bg-floating-particles', };

/**
 * SettingsManager Module
 */
const SettingsManager = {
    // --- Private State ---
    _currentSettings: {},
    _listeners: [],
    _isInitialized: false, // Crucial: Tracks if init() completed successfully
    _flags: {
        isUpdatingUI: false,        // Prevents input handlers firing while UI is updated from state
        isUpdatingState: false,     // Prevents loops during input handling (less critical now?)
        isApplyingSettings: false,  // Prevents _applyAllSettings re-entrancy
        updateQueued: false,        // Flags if an update was requested during _applyAllSettings
        fontLoading: false,         // Tracks if a font is currently being loaded/applied
        fontValidated: false        // Tracks if initial font check has run
    },
    _timers: {
        fontApply: null,            // Debounce timer specifically for font family changes
        updateDebounce: null,       // Debounce timer for general visual updates from inputs
        saveDebounce: null          // Debounce timer for saving to localStorage
    },
    _constants: {
        FONT_DEBOUNCE_DELAY: 300,   // Delay for applying font changes (allows quick Browse)
        UPDATE_DEBOUNCE_DELAY: 50,  // Short delay for visual updates from sliders/inputs
        SAVE_DEBOUNCE_DELAY: 500    // Delay for saving settings after changes stop
    },

    // --- Public Methods ---

    /** Gets a fresh copy of default settings */
    getDefaults() {
        try {
            if (typeof structuredClone === 'function') { return structuredClone(DEFAULT_SETTINGS); }
            return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        } catch (e) { console.error("[SM getDefaults] CRITICAL: Failed to clone defaults!", e); return {}; }
    },

    /** Gets a clone of the current internal settings state */
    getCurrentSettings() {
        if (!this._currentSettings || typeof this._currentSettings !== 'object' || Object.keys(this._currentSettings).length === 0) {
            console.warn("[SM getCurrentSettings] Internal state invalid/empty. Returning defaults.");
            return this.getDefaults();
        }
        try {
            if (typeof structuredClone === 'function') { return structuredClone(this._currentSettings); }
            return JSON.parse(JSON.stringify(this._currentSettings));
        } catch (e) { console.error("[SM getCurrentSettings] Error cloning state:", e); return this.getDefaults(); }
    },

    /** Initializes the SettingsManager */
    async init() {
        console.log('[SM v22.2] Initializing...');
        this._isInitialized = false; this._flags.fontValidated = false;
        try {
            this._loadSavedSettings();
            // console.log('[SM Init] State AFTER load:', JSON.stringify(this._currentSettings)); // Verbose log
            this._setupEventListeners();
            await this._applyAllSettings(this._currentSettings, true); // Update inputs on initial load
            // console.log('[SM Init] State AFTER apply:', JSON.stringify(this._currentSettings)); // Verbose log
            this._isInitialized = true;
            console.log('[SM Init] Initialization complete. _isInitialized = true');
            setTimeout(() => this._validateLoadedFont(), 100); // Validate font after UI settles
            return Promise.resolve();
        } catch (error) {
            this._isInitialized = false; this._flags.isApplyingSettings = false;
            console.error('[SM v22.2] Initialization failed:', error);
            if (typeof showAlert === 'function') showAlert(`App Init Failed: ${error.message}. Reload needed.`, 'error');
            else alert(`App Init Failed: ${error.message}. Reload needed.`);
            return Promise.reject(error);
        }
    },

    /** Applies a new set of settings */
    applySettings(newSettings, updateInputs = false) {
        if (!this._isInitialized) return Promise.reject(new Error("Not initialized"));
        if (!newSettings || typeof newSettings !== 'object') return Promise.reject(new Error("Invalid settings"));
        // console.log("[SM applySettings] Received. Update Inputs:", updateInputs); // Verbose log
        this._currentSettings = { ...this.getDefaults(), ...this._currentSettings, ...newSettings }; // Merge
        // console.log("[SM applySettings] Internal state updated."); // Verbose log
        this._queueSettingsUpdate(true, updateInputs); // Force immediate visual update
        return Promise.resolve();
    },

    /** Adds a settings change listener */
    addSettingsChangeListener(listener) {
        if (typeof listener === 'function' && !this._listeners.includes(listener)) { this._listeners.push(listener); }
    },

    /** Removes a settings change listener */
    removeSettingsChangeListener(listener) {
        this._listeners = this._listeners.filter(fn => fn !== listener);
    },

    /** Resets settings to defaults (all or by category) */
    resetSettings(resetType = 'all') {
        console.log(`[SM v22.2] Resetting settings - Type: ${resetType}`);
        const defaults = this.getDefaults();
        let settingsToApply;
        if (resetType === 'all') { settingsToApply = { ...defaults }; }
        else {
            settingsToApply = { ...this.getCurrentSettings() };
            const categoryMap = {
                 text: ['logoText','fontFamily','fontSize','fontWeight','letterSpacing','textCase','textAlign','rotation'],
                 style: ['textColorMode','solidColorPicker','gradientPreset','color1','color2','useColor3','color3','animationDirection','textShadow','advanced3dEffect','textDecoration','textStyle','textStroke','textOpacity'],
                 border: ['borderColorPicker','borderStyle','advancedBorderStyle','borderWidth','borderRadius','customBorderRadius','borderPadding'],
                 background: ['backgroundType','advancedBackground','backgroundColor','bgOpacity','backgroundGradientPreset','bgColor1','bgColor2','bgGradientDirection','patternColor1','patternColor2'],
                 animation: ['textAnimation', 'advancedTextAnimation', 'animationSpeed'],
            };
            const keysToReset = categoryMap[resetType] || Object.keys(defaults);
            keysToReset.forEach(key => { if (defaults.hasOwnProperty(key)) { settingsToApply[key] = defaults[key]; } });
        }
        // console.log('[SM Reset] Applying reset settings:', settingsToApply); // Verbose log
        this.applySettings(settingsToApply, true) // Use public method, update inputs
            .then(() => { console.log(`[SM v22.2] Reset (${resetType}) applied.`); if (typeof showToast === 'function') showToast({ message: `Settings Reset (${resetType})!`, type: 'success' }); })
            .catch((error) => { console.error('[SM v22.2] Error applying reset:', error); if (typeof showAlert === 'function') showAlert('Failed to reset settings.', 'error'); });
    },

    /** Picks a random color mode (helper for randomizer) */
    pickRandomColorMode() { const opts=['solid','gradient'], weights=[4,6]; let t=10, r=Math.random()*t; for(let i=0;i<opts.length;i++){r-=weights[i];if(r<=0)return opts[i];} return 'solid'; },

    // --- Private Helper Methods ---

    /** Sets up event listeners for UI controls */
    _setupEventListeners() {
        // console.log('[SM v22.2] Setting up listeners...'); // Verbose log
        const handleInput = (element, settingKey, callback) => {
            if (!element) return;
            const handleEvent = (e) => {
                if (this._flags.isUpdatingUI) return; // Prevent loop if UI update triggered event
                this._flags.isUpdatingState = true;
                let value = (element.type === 'checkbox') ? element.checked : element.value;
                this._updateSetting(settingKey, value);
                if (callback) callback(value, e);
                this._queueSettingsUpdate(); // Debounced visual update
                this._flags.isUpdatingState = false;
            };
            const eventType = (element.type === 'checkbox' || element.tagName === 'SELECT') ? 'change' : 'input';
            element.removeEventListener(eventType, handleEvent); // Ensure no duplicates
            element.addEventListener(eventType, handleEvent);
        };
        this._bindAllInputs(handleInput);
        // console.log('[SM v22.2] Listeners configured.'); // Verbose log
    },

    /** Binds all defined input elements */
    _bindAllInputs(handleInput) {
        // Definitions array (ensure IDs match HTML)
        const inputs = [
            { id: 'logoText', setting: 'logoText', callback: (value) => { const el = document.querySelector('.logo-text'); if (el) { el.textContent = value; el.setAttribute('data-text', value); } this._updateSizeIndicator(); } },
            { id: 'fontSize', setting: 'fontSize', cssVar: '--dynamic-font-size', unit: 'px', callback: () => this._updateSizeIndicator() },
            { id: 'fontWeight', setting: 'fontWeight' },
            { id: 'letterSpacing', setting: 'letterSpacing', cssVar: '--dynamic-letter-spacing', unit: 'em', display: true },
            { id: 'textCase', setting: 'textCase' }, { id: 'textAlign', setting: 'textAlign' },
            { id: 'rotation', setting: 'rotation', cssVar: '--dynamic-rotation', unit: 'deg', display: true },
            { id: 'textOpacity', setting: 'textOpacity', cssVar: '--dynamic-text-opacity', display: true },
            { id: 'fontFamily', setting: 'fontFamily', callback: (value) => { this._updateFontPreview(value); clearTimeout(this._timers.fontApply); this._timers.fontApply = setTimeout(async () => { this._flags.fontLoading = true; try { await this._applyFontFamily(value); } catch(e){ console.error(`Font apply err:`,e); } finally { this._flags.fontLoading = false; this._queueSettingsUpdate(false); } }, this._constants.FONT_DEBOUNCE_DELAY); } },
            { id: 'textDecoration', setting: 'textDecoration' }, { id: 'textStyle', setting: 'textStyle' }, { id: 'textStroke', setting: 'textStroke' },
            { id: 'textColorMode', setting: 'textColorMode', callback: () => this._updateConditionalUI() },
            { id: 'solidColorPicker', setting: 'solidColorPicker' }, { id: 'gradientPreset', setting: 'gradientPreset', callback: () => this._updateConditionalUI() },
            { id: 'color1', setting: 'color1' }, { id: 'color2', setting: 'color2' }, { id: 'color3', setting: 'color3' },
            { id: 'useColor3', setting: 'useColor3', callback: () => this._updateConditionalUI() },
            { id: 'animationDirection', setting: 'animationDirection', cssVar: '--gradient-direction', unit: 'deg', display: true },
            { id: 'textShadow', setting: 'textShadow' }, { id: 'advanced3dEffect', setting: 'advanced3dEffect' },
            { id: 'borderStyle', setting: 'borderStyle' }, { id: 'advancedBorderStyle', setting: 'advancedBorderStyle' },
            { id: 'borderColorPicker', setting: 'borderColorPicker', cssVar: '--dynamic-border-color', callback: (v) => this._updateBorderColorRGB(v) },
            { id: 'borderWidth', setting: 'borderWidth', cssVar: '--dynamic-border-width', unit: 'px' },
            { id: 'borderPadding', setting: 'borderPadding', cssVar: '--dynamic-border-padding', unit: 'px' },
            { id: 'borderRadius', setting: 'borderRadius', callback: () => this._updateConditionalUI() }, { id: 'customBorderRadius', setting: 'customBorderRadius' },
            { id: 'textAnimation', setting: 'textAnimation' }, { id: 'advancedTextAnimation', setting: 'advancedTextAnimation' },
            { id: 'animationSpeed', setting: 'animationSpeed', callback: (v) => this._applyAnimationSpeed(v), display: true, displaySuffix: 'x' },
            { id: 'backgroundType', setting: 'backgroundType', callback: () => this._updateConditionalUI() },
            { id: 'advancedBackground', setting: 'advancedBackground', callback: () => this._updateConditionalUI() },
            { id: 'backgroundColor', setting: 'backgroundColor', cssVar: '--dynamic-bg-color' },
            { id: 'bgOpacity', setting: 'bgOpacity', cssVar: '--bg-opacity', display: true },
            { id: 'backgroundGradientPreset', setting: 'backgroundGradientPreset', callback: () => this._updateConditionalUI() },
            { id: 'bgColor1', setting: 'bgColor1' }, { id: 'bgColor2', setting: 'bgColor2' },
            { id: 'bgGradientDirection', setting: 'bgGradientDirection', cssVar: '--bg-gradient-direction', unit: 'deg', display: true },
            { id: 'patternColor1', setting: 'patternColor1', cssVar: '--pattern-color1' }, { id: 'patternColor2', setting: 'patternColor2', cssVar: '--pattern-color2' },
            { id: 'previewSize', setting: 'previewSize' },
            { id: 'previewAreaPadding', setting: 'previewAreaPadding', callback: (v) => this._applyPreviewAreaPadding(document.getElementById('previewContainer'), v), unit: 'px', display: true },
            { id: 'exportWidth', setting: 'exportWidth', callback: () => this._handleDimensionChange('exportWidth') },
            { id: 'exportHeight', setting: 'exportHeight', callback: () => this._handleDimensionChange('exportHeight') },
            { id: 'aspectRatioPreset', setting: 'aspectRatioPreset', callback: (v, e) => this._handleAspectPresetChange(e.target) },
            { id: 'aspectRatioLock', setting: 'aspectRatioLock' },
            { id: 'exportQuality', setting: 'exportQuality', display: true, displaySuffix: '%' }, { id: 'exportTransparent', setting: 'exportTransparent' },
            { id: 'exportFrames', setting: 'exportFrames' }, { id: 'exportFrameRate', setting: 'exportFrameRate', display: true, displaySuffix: ' FPS' },
        ];

        inputs.forEach(input => {
            const element = document.getElementById(input.id);
            if (!element) { console.warn(`[SM BindInputs] Element not found: #${input.id}`); return; } // Skip if missing
            let effectiveCallback = input.callback;
            if (input.cssVar) { // Prepend CSS var setting if needed
                const originalCallback = input.callback;
                effectiveCallback = (value, event) => {
                    const unitValue = input.unit ? `${value}${input.unit}` : value;
                    document.documentElement.style.setProperty(input.cssVar, unitValue);
                    if (originalCallback) originalCallback(value, event);
                };
            }
            handleInput(element, input.setting, effectiveCallback); // Bind the main handler

            if (input.display && element.type === 'range') { // Setup range display updates
                const displayEl = element.closest('.range-container')?.querySelector('.range-value-display');
                if (displayEl) {
                    const suffix = input.displaySuffix || (input.unit ? ` ${input.unit}` : '');
                    displayEl.textContent = element.value + suffix; // Initial value
                    element.addEventListener('input', (e) => { if (!this._flags.isUpdatingUI) displayEl.textContent = e.target.value + suffix; });
                }
            }
        });
    },

    /** Updates a single setting in the internal state */
    _updateSetting(key, value) {
        if (this._currentSettings.hasOwnProperty(key)) { this._currentSettings[key] = value; }
        else { console.warn(`[SM UpdateSetting] Unknown key: ${key}`); }
    },

    /** Queues settings update application (debounced or immediate) */
    _queueSettingsUpdate(force = false, updateInputs = false) {
        if (this._flags.isApplyingSettings) return; // Prevent overlap
        this._debouncedSaveSettings(); // Always schedule save
        clearTimeout(this._timers.updateDebounce);

        const applyFn = () => {
            // console.log(`[SM Queue] Applying ${force ? 'forced' : 'debounced'} update.`); // Verbose log
            this._applyAllSettings(this._currentSettings, force ? updateInputs : false)
                .catch(err => console.error("[SM Queue] Apply error:", err));
        };

        if (force) { Promise.resolve().then(applyFn).catch(err => console.error("[SM Queue] Force apply promise error:", err)); }
        else { this._timers.updateDebounce = setTimeout(applyFn, this._constants.UPDATE_DEBOUNCE_DELAY); }
    },

    /** Core function to apply all settings visually and notify listeners */
    async _applyAllSettings(settings, updateInputs = false) {
        if (this._flags.isApplyingSettings) { this._flags.updateQueued = true; return; } // Guard
        this._flags.isApplyingSettings = true;
        // console.log('[SM ApplyAll] START. Update Inputs:', updateInputs); // Verbose log
        try {
            const settingsToApply = { ...this.getDefaults(), ...settings }; // Ensure full object
            if (updateInputs) this._updateUIFromSettings(settingsToApply);
            this._applySettingsToDOM(settingsToApply);
            this._updateUIIndicators();
            this._updateConditionalUI();
            this._notifyListeners(); // Sync notification
            await new Promise(resolve => requestAnimationFrame(resolve)); // Wait for paint
            document.dispatchEvent(new CustomEvent('logomaker-settings-applied', { detail: { settings: this.getCurrentSettings() } }));
        } catch (error) { console.error('[SM ApplyAll] Error:', error); throw error; }
        finally {
            // console.log('[SM ApplyAll] END.'); // Verbose log
            this._flags.isApplyingSettings = false; // Release lock
            if (this._flags.updateQueued) { // Process queued update
                this._flags.updateQueued = false;
                setTimeout(() => { this._applyAllSettings(this._currentSettings, false).catch(err => console.error("[SM] Queued update error:", err)); }, 0);
            }
        }
    },

    /** Updates UI input elements from settings state */
    _updateUIFromSettings(settings) {
        this._flags.isUpdatingUI = true;
        try {
            Object.entries(settings).forEach(([key, value]) => {
                const element = document.getElementById(key);
                if (!element) return;
                try {
                    if (element.type === 'checkbox') element.checked = !!value;
                    else if (element.type === 'color') element.value = String(value).startsWith('#') ? value : `#${value}`;
                    else element.value = value;
                } catch (uiError) { console.warn(`[SM UpdateUI] Error for ${key}:`, uiError); }
            });
            this._updateRangeDisplays();
        } catch (error) { console.error('[SM UpdateUI] Error:', error); }
        finally { this._flags.isUpdatingUI = false; }
    },

    /** Applies settings visually to DOM elements */
    _applySettingsToDOM(settings) {
        const logo = document.querySelector('.logo-text');
        const container = document.querySelector('.logo-container');
        const preview = document.getElementById('previewContainer');
        if (!logo || !container || !preview) { console.error('[SM ApplyDOM] Missing critical elements.'); return; }

        // Apply text & main CSS vars
        logo.textContent = settings.logoText;
        logo.setAttribute('data-text', settings.logoText);
        const cssVars = [ { name: '--dynamic-font-size', value: `${settings.fontSize}px` }, { name: '--dynamic-letter-spacing', value: `${settings.letterSpacing}em` }, { name: '--dynamic-rotation', value: `${settings.rotation}deg` }, { name: '--dynamic-border-color', value: settings.borderColorPicker }, { name: '--dynamic-border-width', value: `${settings.borderWidth}px` }, { name: '--dynamic-border-padding', value: `${settings.borderPadding}px` }, { name: '--gradient-direction', value: `${settings.animationDirection}deg` }, { name: '--bg-gradient-direction', value: `${settings.bgGradientDirection}deg` }, { name: '--bg-opacity', value: settings.bgOpacity }, { name: '--dynamic-text-opacity', value: settings.textOpacity }, { name: '--pattern-color1', value: settings.patternColor1 }, { name: '--pattern-color2', value: settings.patternColor2 }, ];
        cssVars.forEach(({ name, value }) => document.documentElement.style.setProperty(name, value));

        // Apply styles via helpers (which handle inline styles + classes)
        // Font family applied separately by its debounced handler
        this._applyFontWeight(logo, settings.fontWeight);
        this._applyTextCase(logo, settings.textCase);
        this._applyTextAlign(container, settings.textAlign);
        this._applyTextDecoration(logo, settings.textDecoration);
        this._applyTextStyle(logo, settings.textStyle);
        this._applyTextStroke(logo, settings.textStroke); // Class-based
        this._applyColorMode(logo, settings); // Inline styles + opacity
        this._applyTextEffect(logo, settings); // Classes + data-text
        this._applyBorderStyle(container, settings); // Classes
        this._updateBorderColorRGB(settings.borderColorPicker); // CSS Var
        this._applyBorderRadius(container, settings); // Class + inline style + CSS Var
        this._applyAnimation(logo, settings); // Classes + data-text
        this._applyAnimationSpeed(settings.animationSpeed); // CSS Var
        this._applyBackground(preview, settings); // Classes + inline styles
        this._applyPreviewSize(preview, settings.previewSize); // Class
        this._applyPreviewAreaPadding(preview, settings.previewAreaPadding); // Inline style
        this._updateTextGradientWarning(); // Check UI warning
    },

    /** Updates UI indicators (size, CSS code) */
    _updateUIIndicators() {
        requestAnimationFrame(() => { this._updateSizeIndicator(); this._updateCSSCode(); });
    },

    /** Updates logo size display */
    _updateSizeIndicator() {
        const wEl = document.getElementById('logoWidth'), hEl = document.getElementById('logoHeight'), logoEl = document.querySelector('.logo-text');
        if (!logoEl || !wEl || !hEl) return;
        try { const rect = logoEl.getBoundingClientRect(); wEl.textContent = rect.width > 1 ? Math.round(rect.width) : '--'; hEl.textContent = rect.height > 1 ? Math.round(rect.height) : '--'; }
        catch (e) { console.warn("[SM Size] Error:", e); wEl.textContent = 'N/A'; hEl.textContent = 'N/A'; }
    },

    /** Updates CSS code display */
    _updateCSSCode() {
        const codeEl = document.getElementById('cssCode');
        if (!codeEl) return;
        try { codeEl.value = this._generateCSSCode(); } // Call the generation function
        catch (error) { console.error('[SM v22.2] Error generating CSS code:', error); codeEl.value = '/* Error generating CSS */'; }
    },

    /** Updates range input value displays */
    _updateRangeDisplays() {
        const ranges = document.querySelectorAll('input[type="range"]');
        ranges.forEach(input => {
            const display = input.closest('.range-container')?.querySelector('.range-value-display');
            if (display) {
                let suffix = '';
                switch (input.id) {
                    case 'letterSpacing': suffix = 'em'; break; case 'rotation': case 'animationDirection': case 'bgGradientDirection': suffix = 'deg'; break;
                    case 'animationSpeed': suffix = 'x'; break; case 'previewAreaPadding': suffix = 'px'; break;
                    case 'exportQuality': suffix = '%'; break; case 'exportFrameRate': suffix = ' FPS'; break; case 'bgOpacity': case 'textOpacity': suffix = ''; break;
                }
                const displaySuffix = suffix ? (suffix === 'x' || suffix === '%' ? suffix : ` ${suffix}`) : '';
                display.textContent = input.value + displaySuffix;
            }
        });
    },

    /** Updates visibility of conditional UI sections */
    _updateConditionalUI() {
        const s = this._currentSettings;
        try {
            const isSolidText = s.textColorMode === 'solid';
            this._toggleVisibility('solidColorPickerGroup', isSolidText); this._toggleVisibility('gradientPresetGroup', !isSolidText);
            const isCustomTextGradient = !isSolidText && s.gradientPreset === 'custom';
            this._toggleVisibility('customGradientControls', isCustomTextGradient);
            this._toggleVisibility('color3Control', isCustomTextGradient && s.useColor3);

            let effBgClass = BACKGROUND_MAP[s.backgroundType] || 'bg-solid'; if (s.advancedBackground && s.advancedBackground !== 'none' && BACKGROUND_MAP[s.advancedBackground]) effBgClass = BACKGROUND_MAP[s.advancedBackground];
            const isBgSolid = effBgClass === 'bg-solid', isBgAnyGrad = effBgClass.includes('gradient'), isBgTrans = effBgClass === 'bg-transparent', isBgPattern = !isBgSolid && !isBgAnyGrad && !isBgTrans;
            this._toggleVisibility('backgroundColorControl', isBgSolid); this._toggleVisibility('backgroundGradientControls', isBgAnyGrad);
            this._toggleVisibility('customBackgroundGradient', isBgAnyGrad && s.backgroundGradientPreset === 'custom');
            this._toggleVisibility('customPatternControls', isBgPattern);

            this._toggleVisibility('customBorderRadiusControlGroup', s.borderRadius === 'custom');
        } catch (e) { console.error('[SM CondUI] Error:', e); }
    },

    /** Toggles element visibility using 'hidden' class */
    _toggleVisibility(id, show) {
        const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !show);
    },

    /** Applies font family inline style after ensuring @font-face exists */
    async _applyFontFamily(fontName) {
        const logoEl = document.querySelector('.logo-text'); if (!fontName || !logoEl) return;
        try { await getFontDataAsync(fontName); logoEl.style.fontFamily = `"${fontName}", sans-serif`; }
        catch (e) { console.error(`[SM ApplyFont] Error "${fontName}":`, e); try { logoEl.style.fontFamily = 'sans-serif'; } catch(fe){} }
    },

    /** Updates font preview swatch */
    _updateFontPreview(fontName) { const el = document.getElementById('fontPreview'); if (el) el.style.fontFamily = fontName ? `"${fontName}", sans-serif` : 'sans-serif'; },

    /** Applies font weight class and inline style */
    _applyFontWeight(el, weight) { if (!el || !weight) return; this._applyClass(el, PREFIX.FONT_WEIGHT + weight, PREFIX.FONT_WEIGHT); el.style.fontWeight = weight; },

    /** Applies text case class and inline style */
    _applyTextCase(el, value) { if (!el) return; const caseVal = value && value !== 'none' ? value : 'none'; this._applyClass(el, PREFIX.TEXT_CASE + caseVal, PREFIX.TEXT_CASE); el.style.textTransform = caseVal; },

    /** Applies text align via container style */
    _applyTextAlign(el, value) { if (!el) return; const map = { 'left': 'flex-start', 'right': 'flex-end', 'center': 'center' }; el.style.justifyContent = map[(value || 'center').toLowerCase()]; },

    /** Applies text decoration class and inline styles */
    _applyTextDecoration(el, value) {
        if (!el) return; const cls = TEXT_DECORATION_MAP[value] || TEXT_DECORATION_MAP['none']; this._applyClass(el, cls, PREFIX.TEXT_DECORATION);
        let line='none', style='solid';
        switch (value) { case 'underline': line='underline'; break; case 'overline': line='overline'; break; case 'line-through': line='line-through'; break; case 'dashed-underline': line='underline'; style='dashed'; break; case 'wavy-underline': line='underline'; style='wavy'; break; default: line='none'; style='solid'; break; }
        el.style.textDecorationLine = line; el.style.textDecorationStyle = style;
    },

    /** Applies text style (italic/oblique) class and inline style */
    _applyTextStyle(el, value) { if (!el) return; const styleVal = (value === 'italic' || value === 'oblique') ? value : 'normal'; this._applyClass(el, TEXT_STYLE_MAP[styleVal] || TEXT_STYLE_MAP['normal'], PREFIX.TEXT_STYLE); el.style.fontStyle = styleVal; },

    /** Applies text stroke class (relies on CSS) */
    _applyTextStroke(el, value) { if (!el) return; const cls = TEXT_STROKE_MAP[value] || TEXT_STROKE_MAP['none']; this._applyClass(el, cls, PREFIX.TEXT_STROKE); },

    /** Applies text color (solid/gradient) and opacity */
    _applyColorMode(el, settings) { if (!el) return; if (settings.textColorMode === 'solid') this._applySolidTextColor(el, settings.solidColorPicker); else this._applyGradientToLogo(el, settings); el.style.opacity = settings.textOpacity ?? '1'; document.documentElement.style.setProperty('--dynamic-text-opacity', settings.textOpacity ?? '1'); },

    /** Applies solid text color inline */
    _applySolidTextColor(el, color) { if (!el) return; el.style.backgroundImage = 'none'; el.style.backgroundClip = 'initial'; el.style.webkitBackgroundClip = 'initial'; el.style.webkitTextFillColor = 'initial'; el.style.color = color || '#ffffff'; },

    /** Applies text gradient background inline */
    _applyGradientToLogo(el, settings) {
        if (!el) return; const dir = settings.animationDirection || '45'; const preset = settings.gradientPreset; let gradCss = '';
        try { if (preset==='custom') { const c1=settings.color1||'#FF1493', c2=settings.color2||'#8A2BE2', useC3=settings.useColor3, c3=settings.color3||'#FF4500'; gradCss = useC3 ? `linear-gradient(${dir}deg, ${c1}, ${c2}, ${c3})` : `linear-gradient(${dir}deg, ${c1}, ${c2})`; } else { let varVal=''; try { varVal=getComputedStyle(document.documentElement).getPropertyValue(`--${preset}`)?.trim(); } catch(e){} if (varVal?.startsWith('linear-gradient')) { gradCss = varVal.replace(/linear-gradient\([^,]+,/,`linear-gradient(${dir}deg,`); } else { const fb={'primary-gradient':`linear-gradient(${dir}deg,#FF1493,#8A2BE2)`}; gradCss=fb[preset]||fb['primary-gradient']; } } el.style.backgroundImage = gradCss; el.style.webkitBackgroundClip='text'; el.style.backgroundClip='text'; el.style.color='transparent'; el.style.webkitTextFillColor='transparent'; }
        catch (e) { console.error('[SM Grad] Error:', e); this._applySolidTextColor(el, '#ffffff'); }
    },

    /** Applies text effect classes and data-text */
    _applyTextEffect(el, settings) { if (!el) return; const basic=settings.textShadow||'text-effect-none', adv=settings.advanced3dEffect||'none'; let finalCls='text-effect-none'; if (adv!=='none') finalCls=ADVANCED_3D_EFFECT_MAP[adv]||'text-effect-none'; else if (basic!=='text-effect-none') finalCls=basic; this._applyClass(el, finalCls, PREFIX.TEXT_EFFECT); const needsData=finalCls==='text-effect-reflection'||el.classList.contains('anim-glitch'), hasData=el.hasAttribute('data-text'); if(needsData && (!hasData || el.getAttribute('data-text') !== el.textContent)) el.setAttribute('data-text', el.textContent||''); else if (!needsData && hasData && !el.classList.contains('anim-glitch')) el.removeAttribute('data-text'); },

    /** Applies border style classes */
    _applyBorderStyle(el, settings) { if (!el) return; const basic=settings.borderStyle||'border-none', adv=settings.advancedBorderStyle||'none'; let key='none'; if(adv!=='none')key=adv; else if(basic!=='border-none')key=basic; const finalCls=BORDER_STYLE_EFFECT_MAP[key]||'border-style-none'; this._applyClass(el, finalCls, PREFIX.BORDER_STYLE); this._applyClass(el, finalCls, PREFIX.BORDER_EFFECT); el.classList.toggle('dynamic-border', finalCls!=='border-style-none'); },

    /** Applies border radius class and inline style */
    _applyBorderRadius(el, settings) {
        if (!el || !settings.borderRadius) return; const rVal=settings.borderRadius; const cls=BORDER_RADIUS_MAP[rVal]||'border-radius-none'; this._applyClass(el,cls,PREFIX.BORDER_RADIUS);
        let cssR='0px'; switch(rVal){ case 'circle':cssR='50%';break; case 'pill':cssR='999px';break; case 'rounded-sm':cssR='4px';break; case 'rounded-md':cssR='8px';break; case 'rounded-lg':cssR='12px';break; case 'custom': this._applyCustomBorderRadius(el, settings.customBorderRadius); return; default: cssR='0px'; break; }
        el.style.borderRadius=cssR; document.documentElement.style.setProperty('--dynamic-border-radius', cssR);
    },

    /** Applies custom border radius inline style and var */
    _applyCustomBorderRadius(el, value) {
        if(!el) return; let val=String(value||'').trim(); const parts=val.split(/\s+/).map(p=>{ if(/^\d+(\.\d+)?$/.test(p)) return `${p}px`; if(/^\d+(\.\d+)?(px|%|em|rem|vw|vh)$/.test(p)) return p; return null; }).filter(p=>p!==null);
        let finalVal = '0px'; if (parts.length > 0 && parts.length <= 4) finalVal=parts.join(' '); else if (val && parts.length === 0) console.warn(`[SM CustomRadius] Invalid: '${value}'`);
        el.style.borderRadius=finalVal; document.documentElement.style.setProperty('--dynamic-border-radius', finalVal);
    },

    /** Applies animation classes and data-text */
    _applyAnimation(el, settings) { if(!el) return; const basic=settings.textAnimation||'anim-none', adv=settings.advancedTextAnimation||'none'; let finalCls='anim-none'; if(adv!=='none') finalCls=ANIMATION_MAP[adv]||'anim-none'; else if(basic!=='anim-none') finalCls=basic; this._applyClass(el, finalCls, PREFIX.ANIMATION); const needsData=finalCls==='anim-glitch'||el.classList.contains('text-effect-reflection'), hasData=el.hasAttribute('data-text'); if(needsData && !hasData) el.setAttribute('data-text', el.textContent||''); else if (!needsData && hasData && !el.classList.contains('text-effect-reflection')) el.removeAttribute('data-text'); },

    /** Applies animation speed CSS var */
    _applyAnimationSpeed(speed) { const base=2.0, spd=parseFloat(speed||'1'); const final=Math.max(0.1, base/Math.max(0.1,spd)); document.documentElement.style.setProperty('--animation-duration', `${final.toFixed(2)}s`); },

    /** Applies background class and styles */
    _applyBackground(el, settings) {
        if(!el) return;
        
        console.log("[SettingsManager] Applying background:", settings.backgroundType, settings.backgroundColor);
        
        const basic = settings.backgroundType || 'bg-solid';
        const adv = settings.advancedBackground || 'none';
        let finalCls = BACKGROUND_MAP[basic] || 'bg-solid';
        
        if(adv !== 'none' && BACKGROUND_MAP[adv]) {
            finalCls = BACKGROUND_MAP[adv];
        }
        
        // Apply the CSS class
        this._applyClass(el, finalCls, PREFIX.BACKGROUND);
        
        // Direct style application based on type
        if(finalCls === 'bg-solid') {
            // For solid backgrounds, apply color directly to ensure it's visible
            const finalColor = settings.backgroundColor || '#000000';
            el.style.backgroundColor = finalColor;
            document.documentElement.style.setProperty('--dynamic-bg-color', finalColor);
            
            // Remove any gradient styling
            el.style.backgroundImage = 'none';
            console.log("[SettingsManager] Applied solid background color:", finalColor);
        } 
        else if(finalCls.includes('gradient')) {
            // Apply background gradient
            try {
                const dir = settings.bgGradientDirection || '90';
                let gradStr = '';
                
                if(settings.backgroundGradientPreset === 'custom') {
                    const c1 = settings.bgColor1 || '#3a1c71';
                    const c2 = settings.bgColor2 || '#ffaf7b';
                    gradStr = `linear-gradient(${dir}deg, ${c1}, ${c2})`;
                } else {
                    // Try to get preset gradient
                    const preset = settings.backgroundGradientPreset || 'bg-primary-gradient';
                    const varVal = getComputedStyle(document.documentElement).getPropertyValue(`--${preset}`)?.trim();
                    
                    if(varVal?.startsWith('linear-gradient')) {
                        gradStr = varVal.replace(/linear-gradient\([^,]+,/,`linear-gradient(${dir}deg,`);
                    } else {
                        // Fallback gradient
                        gradStr = `linear-gradient(${dir}deg,#3a1c71,#ffaf7b)`;
                    }
                }
                
                el.style.backgroundImage = gradStr;
                el.style.backgroundColor = 'transparent';
                console.log("[SettingsManager] Applied gradient background:", gradStr);
            } catch(e) {
                console.error("[SettingsManager] Gradient error:", e);
                this._applySolidBgColor(el, '#000000');
            }
        }
        
        // Apply opacity after background is set
        el.style.opacity = settings.bgOpacity || '1';
    },
    
    /** Applies solid background color style and var */
    _applySolidBgColor(el, color) { if(!el) return; const finalColor=color||'#000000'; document.documentElement.style.setProperty('--dynamic-bg-color', finalColor); el.style.backgroundImage='none'; el.style.backgroundColor=`var(--dynamic-bg-color)`; },

    /** Applies background gradient style */
    _applyBackgroundGradient(el, settings) {
        if(!el) return; const dir=settings.bgGradientDirection||'90', preset=settings.backgroundGradientPreset; let gradStr='';
        try { if(preset==='custom'){ const c1=settings.bgColor1||'#3a1c71', c2=settings.bgColor2||'#ffaf7b'; gradStr=`linear-gradient(${dir}deg, ${c1}, ${c2})`; } else { let varVal=''; try {varVal=getComputedStyle(document.documentElement).getPropertyValue(`--${preset}`)?.trim();} catch(e){} if(varVal?.startsWith('linear-gradient')) { gradStr = varVal.replace(/linear-gradient\([^,]+,/,`linear-gradient(${dir}deg,`); } else { const fb={'bg-primary-gradient':`linear-gradient(${dir}deg,#3a1c71,#ffaf7b)`}; gradStr=fb[preset]||`linear-gradient(${dir}deg,#1a1a2e,#0f3460)`; }} el.style.backgroundImage=gradStr; el.style.backgroundColor=''; }
        catch(e){ console.error('[SM BgGrad] Error:', e); this._applySolidBgColor(el, '#000000'); }
    },

    /** Applies preview size class */
    _applyPreviewSize(el, size) { if(!el) return; this._applyClass(el, size||'preview-size-medium', PREFIX.PREVIEW_SIZE); },

    /** Applies preview area padding inline style */
    _applyPreviewAreaPadding(el, padding) { if(!el) return; const pxVal=/^\d+(\.\d+)?$/.test(padding)?`${padding}px`:(padding||'0px'); el.style.padding=pxVal; },

    /** Updates border color RGB CSS variable */
    _updateBorderColorRGB(hex) { const rgb=this._extractColorRGB(hex); document.documentElement.style.setProperty('--dynamic-border-color-rgb', rgb); },

    /** Converts hex color to 'R,G,B' string */
    _extractColorRGB(hex) { if(!hex||typeof hex!=='string')return'255,255,255'; const c=hex.replace('#','').trim(); if(c.length===3){ const r=parseInt(c[0]+c[0],16),g=parseInt(c[1]+c[1],16),b=parseInt(c[2]+c[2],16); return `${r},${g},${b}`; } else if(c.length>=6){ const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16); return `${r},${g},${b}`; } return '255,255,255'; },

    /** Updates visibility of the main UI text gradient warning */
    _updateTextGradientWarning() { const el=document.getElementById('textGradientWarning'); if(el)el.style.display = this._currentSettings?.textColorMode==='gradient'?'block':'none'; },

    /** Loads settings from localStorage */
    _loadSavedSettings() { let loaded=null; try { const json=localStorage.getItem('logomakerSettings'); if(json) loaded=JSON.parse(json); } catch (e){ console.error('[SM Load] Error:', e); } this._currentSettings={...this.getDefaults(), ...(loaded&&typeof loaded==='object'?loaded:{}) }; },

    /** Validates loaded font post-initialization */
    async _validateLoadedFont() { if (!this._isInitialized || this._flags.fontValidated) return; this._flags.fontValidated=true; try { const sel=document.getElementById('fontFamily'),font=this._currentSettings.fontFamily; if(sel?.options.length>1&&font&&font!==this.getDefaults().fontFamily){ const exists=Array.from(sel.options).some(o=>o.value===font); if(!exists){ console.warn(`[SM ValidateFont] Saved font '${font}' invalid. Reverting.`); this.applySettings({fontFamily:this.getDefaults().fontFamily},true); }}} catch(e){ console.error('[SM ValidateFont] Error:',e); } },

    /** Debounces saving settings */
    _debouncedSaveSettings() { clearTimeout(this._timers.saveDebounce); this._timers.saveDebounce = setTimeout(()=>this._saveSettingsToStorage(), this._constants.SAVE_DEBOUNCE_DELAY); },

    /** Saves settings to localStorage */
    _saveSettingsToStorage() { try { localStorage.setItem('logomakerSettings', JSON.stringify(this._currentSettings)); } catch (e) { console.error('[SM Save] Error:', e); if(typeof showAlert==='function')showAlert('Could not save settings.','error'); } },

    /** Notifies listeners and dispatches global event */
    _notifyListeners() { const settings=this.getCurrentSettings(); this._listeners.forEach(l=>{try{l(settings);}catch(e){console.error('[SM Notify] Listener error:',e);}}); try{document.dispatchEvent(new CustomEvent('logomaker-settings-updated',{detail:{settings}}));}catch(e){console.error('[SM Notify] Event dispatch error:',e);} },

    /** Helper to apply classes, removing others with same prefix/map */
    _applyClass(target, newClass, prefix = null) { if(!target?.classList||typeof newClass!=='string')return; const initial=Array.from(target.classList),toRemove=new Set(); if(prefix){initial.forEach(c=>{if(c.startsWith(prefix)&&c!==newClass)toRemove.add(c);});} let map=null; /* Find map */ if(prefix===PREFIX.TEXT_EFFECT||newClass.startsWith(PREFIX.TEXT_EFFECT))map=ADVANCED_3D_EFFECT_MAP; else if(prefix===PREFIX.BORDER_STYLE||prefix===PREFIX.BORDER_EFFECT||newClass.startsWith(PREFIX.BORDER_STYLE)||newClass.startsWith(PREFIX.BORDER_EFFECT))map=BORDER_STYLE_EFFECT_MAP; else if(prefix===PREFIX.ANIMATION||newClass.startsWith(PREFIX.ANIMATION))map=ANIMATION_MAP; else if(prefix===PREFIX.BACKGROUND||newClass.startsWith(PREFIX.BACKGROUND))map=BACKGROUND_MAP; else if(prefix===PREFIX.BORDER_RADIUS||newClass.startsWith(PREFIX.BORDER_RADIUS))map=BORDER_RADIUS_MAP; else if(prefix===PREFIX.TEXT_DECORATION||newClass.startsWith(PREFIX.TEXT_DECORATION))map=TEXT_DECORATION_MAP; else if(prefix===PREFIX.TEXT_STYLE||newClass.startsWith(PREFIX.TEXT_STYLE))map=TEXT_STYLE_MAP; else if(prefix===PREFIX.TEXT_STROKE||newClass.startsWith(PREFIX.TEXT_STROKE))map=TEXT_STROKE_MAP; if(map){Object.values(map).forEach(cInMap=>{if(cInMap&&typeof cInMap==='string'&&cInMap!==newClass&&initial.includes(cInMap))toRemove.add(cInMap);});} const arrToRemove=Array.from(toRemove); if(arrToRemove.length>0)target.classList.remove(...arrToRemove); const isNone=!newClass.endsWith('-none')&&!newClass.endsWith('-normal'); if(isNone&&!target.classList.contains(newClass))target.classList.add(newClass); },

    /** Handles aspect ratio preset change */
    _handleAspectPresetChange(selectElement) { if(!selectElement)return;const option=selectElement.options[selectElement.selectedIndex];if(!option)return;const ratio=parseFloat(option?.dataset?.ratio);if(!isNaN(ratio)&&ratio>0){const w=document.getElementById('exportWidth'),h=document.getElementById('exportHeight'),lock=document.getElementById('aspectRatioLock');if(!w||!h||!lock)return;const baseW=parseInt(this._currentSettings.exportWidth||'800');const newH=Math.max(10,Math.round(baseW/ratio));this._flags.isUpdatingUI=true;h.value=newH;this._updateSetting('exportHeight',String(newH));lock.checked=true;this._updateSetting('aspectRatioLock',true);this._flags.isUpdatingUI=false;this._queueSettingsUpdate();}},

    /** Handles dimension change when aspect ratio lock is on */
    _handleDimensionChange(changedDim) { if(this._flags.isUpdatingUI||!this._currentSettings.aspectRatioLock)return; try{const ratio=this._getCurrentAspectRatio();if(!ratio||isNaN(ratio)||ratio<=0)return;const w=document.getElementById('exportWidth'),h=document.getElementById('exportHeight');if(!w||!h)return;const changedVal=parseFloat(this._currentSettings[changedDim]);if(isNaN(changedVal)||changedVal<=0)return;let targetInput,targetKey,newVal;if(changedDim==='exportWidth'){targetInput=h;targetKey='exportHeight';newVal=Math.round(changedVal/ratio);}else{targetInput=w;targetKey='exportWidth';newVal=Math.round(changedVal*ratio);}newVal=Math.max(10,newVal);if(String(newVal)!==this._currentSettings[targetKey]){this._flags.isUpdatingUI=true;targetInput.value=newVal;this._updateSetting(targetKey,String(newVal));this._flags.isUpdatingUI=false;this._queueSettingsUpdate();}}catch(e){console.error('[SM DimChange] Error:',e);} },

    /** Gets current aspect ratio (preset or measured) */
    _getCurrentAspectRatio() { const sel=document.getElementById('aspectRatioPreset'),val=this._currentSettings.aspectRatioPreset||'auto';if(val!=='auto'&&sel){const opt=sel.options[sel.selectedIndex];const r=parseFloat(opt?.dataset?.ratio);if(!isNaN(r)&&r>0)return r;}const cont=document.querySelector('.logo-container');if(!cont)return 1;const w=cont.offsetWidth,h=cont.offsetHeight;if(w<=0||h<=0)return 1;return w/h;},

    /** Generates CSS code string for export/display */
    _generateCSSCode() {
        const logo = document.querySelector('.logo-text');
        const container = document.querySelector('.logo-container');
        const preview = document.getElementById('previewContainer');
        if (!logo || !container || !preview) { return '/* Error: Missing elements. */'; }

        let css = `:root {\n`;
        // Include relevant CSS variables set on :root
        const vars = ['--animation-duration', '--gradient-direction', '--dynamic-border-color', '--dynamic-border-color-rgb', '--bg-gradient-direction', '--dynamic-font-size', '--dynamic-letter-spacing', '--dynamic-rotation', '--dynamic-border-width', '--dynamic-border-radius', '--dynamic-border-padding', '--bg-opacity', '--dynamic-text-opacity', '--pattern-color1', '--pattern-color2'];
        vars.forEach(v => { let val = document.documentElement.style.getPropertyValue(v)?.trim(); if (val) { css += `  ${v}: ${val};\n`; } });
        css += `}\n\n`;

        // Container Styles
        const containerClasses = Array.from(container.classList).filter(c => c.startsWith(PREFIX.BORDER_STYLE) || c.startsWith(PREFIX.BORDER_EFFECT)).map(c => `.${c}`).join('');
        css += `.logo-container${containerClasses} {\n  position: relative; display: inline-flex; align-items: center;\n`;
        css += `  justify-content: ${container.style.justifyContent || 'center'};\n`;
        css += `  padding: var(--dynamic-border-padding);\n`;
        css += `  border-radius: var(--dynamic-border-radius);\n`;
        css += `  border-width: var(--dynamic-border-width);\n`;
        css += `  border-color: var(--dynamic-border-color);\n`;
        const borderStyle = getComputedStyle(container).borderStyle;
        if (borderStyle !== 'none') css += `  border-style: ${borderStyle};\n`;
        css += `}\n\n`;

        // Text Styles (prioritize inline styles set by JS)
        const textClasses = Array.from(logo.classList).filter(c => c.startsWith(PREFIX.TEXT_EFFECT) || c.startsWith(PREFIX.ANIMATION) || c.startsWith(PREFIX.TEXT_STROKE)).map(c => `.${c}`).join('');
        css += `.logo-text${textClasses} {\n`;
        css += `  font-family: ${logo.style.fontFamily || '"Orbitron", sans-serif'};\n`; // Use applied or default
        css += `  font-size: var(--dynamic-font-size);\n`;
        css += `  font-weight: ${logo.style.fontWeight || '700'};\n`;
        css += `  font-style: ${logo.style.fontStyle || 'normal'};\n`;
        css += `  letter-spacing: var(--dynamic-letter-spacing);\n`;
        css += `  text-transform: ${logo.style.textTransform || 'none'};\n`;
        css += `  text-decoration-line: ${logo.style.textDecorationLine || 'none'};\n`;
        css += `  text-decoration-style: ${logo.style.textDecorationStyle || 'solid'};\n`;
        css += `  transform: rotate(var(--dynamic-rotation));\n`;
        css += `  opacity: var(--dynamic-text-opacity);\n`;
        css += `  line-height: 1.2; white-space: nowrap;\n`;
        // Color/Gradient
        if (logo.style.backgroundImage && logo.style.backgroundImage !== 'none') {
            css += `  background-image: ${logo.style.backgroundImage};\n`;
            css += `  -webkit-background-clip: text;\n  background-clip: text;\n`;
            css += `  color: transparent;\n  -webkit-text-fill-color: transparent;\n`;
        } else {
             css += `  color: ${logo.style.color || '#ADD8E6'};\n`;
             css += `  background-image: none;\n`;
        }
        css += `}\n\n`;

        // Animation Keyframes
        const activeAnimClass = Array.from(logo.classList).find(c => c.startsWith(PREFIX.ANIMATION) && c !== 'anim-none');
        if (activeAnimClass) { const animName = activeAnimClass.replace(PREFIX.ANIMATION,''); const kf = getAnimationKeyframes(animName); if(kf) css += `/* Keyframes ${animName} */\n${kf}\n\n`; }

        // Background
        const bgClass = Array.from(preview.classList).find(c => c.startsWith(PREFIX.BACKGROUND));
        if (bgClass) { css += `#previewContainer.${bgClass} {\n  opacity: var(--bg-opacity);\n  /* Styles applied via class/vars */\n}\n`; }

        return css.trim();
    },


}; // End of SettingsManager Object Definition

export default SettingsManager;

// Optional: Expose to window for debugging console access
// window.SettingsManager = SettingsManager;