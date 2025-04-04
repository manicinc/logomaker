/**
 * settingsManager.js (Version 15.2 - Restored applySettings & Fixed CSS Gen)
 * =========================================================================
 * Manages UI state, applies styles VIA CSS CLASSES & CSS Variables,
 * handles settings persistence, and correctly interacts with fontManager.js.
 * Fixes font application during initial load/reset to use class methods.
 * Fixes CSS code generation to reflect classes/vars better.
 */

// --- Assumes fontManager.js provides getFontDataAsync globally or via import ---
// import { getFontDataAsync } from './fontManager.js';

// --- Constants for CSS Class Prefixes ---
const FONT_FAMILY_CLASS_PREFIX = 'font-family-';
const FONT_WEIGHT_CLASS_PREFIX = 'font-weight-';
const TEXT_ALIGN_CLASS_PREFIX = 'text-align-';
const TEXT_CASE_CLASS_PREFIX = 'text-case-';
const TEXT_EFFECT_CLASS_PREFIX = 'text-effect-'; // Prefix for ALL text effects (glows, shadows etc)
const BORDER_STYLE_CLASS_PREFIX = 'border-style-'; // Prefix for static border styles
const BORDER_EFFECT_CLASS_PREFIX = 'border-effect-'; // Prefix for dynamic border effects (glows etc)
const ANIMATION_CLASS_PREFIX = 'anim-';
const PREVIEW_SIZE_CLASS_PREFIX = 'preview-size-';
const BACKGROUND_CLASS_PREFIX = 'bg-';

// --- Default Settings ---
const DEFAULT_SETTINGS = {
    logoText: 'Manic',
    fontFamily: 'Orbitron', // Default Font
    fontSize: '100', // Applied via CSS var --dynamic-font-size
    letterSpacing: '0.03', // Applied via CSS var --dynamic-letter-spacing
    textCase: 'none', // Maps to text-case-none class
    fontWeight: '700', // Maps to font-weight-700 class
    textColorMode: 'gradient',
    solidColorPicker: '#ffffff',
    gradientPreset: 'primary-gradient',
    color1: '#FF1493', color2: '#8A2BE2', useColor3: false, color3: '#FF4500',
    // *** Values below MUST match <option value="..."> in index.html ***
    textShadow: 'text-glow-none', // Dropdown VALUE, maps to text-effect-* class
    borderColorPicker: '#ffffff', // Applied via CSS var --dynamic-border-color
    borderStyle: 'border-none', // Dropdown VALUE, maps to border-style-* or border-effect-* class
    textAlign: 'center', // Maps to text-align-center class
    rotation: '0', // Applied via CSS var --dynamic-rotation
    textAnimation: 'anim-none', // Maps to anim-none class
    animationSpeed: '1', // Sets CSS var --animation-duration
    animationDirection: '45', // Text gradient angle CSS var --gradient-direction
    backgroundType: 'bg-solid',
    backgroundColor: '#000000',
    bgOpacity: '1', // Applied directly to preview container
    backgroundGradientPreset: 'bg-primary-gradient',
    bgColor1: '#3a1c71', bgColor2: '#ffaf7b',
    bgGradientDirection: '90', // Background gradient angle CSS var --bg-gradient-direction
    previewSize: 'preview-size-medium', // Maps to preview-size-medium class
    // Export settings
    exportWidth: '800', exportHeight: '400', exportQuality: '95',
    exportTransparent: false, exportFrames: '15', exportFrameRate: '10'
};

// --- SettingsManager Object ---
const SettingsManager = {
    _currentSettings: {}, _listeners: [], _isInitialized: false,
    _logoElement: null, _logoContainer: null, _previewContainer: null,

    // --- Getters ---
    getDefaults() { try { return structuredClone(DEFAULT_SETTINGS); } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); } },
    getCurrentSettings() { try { return structuredClone(this._currentSettings); } catch (e) { return JSON.parse(JSON.stringify(this._currentSettings)); } },

    // --- Initialization ---
    async init() {
        if (this._isInitialized) return;
        console.log('[SM] Initialize (v15.2 - applySettings restored)...'); // Updated version comment

        // Cache elements
        this._logoElement = document.querySelector('.logo-text');
        this._logoContainer = document.querySelector('.logo-container');
        this._previewContainer = document.getElementById('previewContainer');
        if (!this._logoElement || !this._logoContainer || !this._previewContainer) { console.error("[SM CRITICAL] Core preview elements missing! Aborting init."); return; }

        // Check dependencies (fontManager's function)
        // Assume FontManager is loaded and provides getFontDataAsync globally or via import
        if (typeof getFontDataAsync !== 'function') { console.error("[SM CRITICAL] `getFontDataAsync` not found! Ensure fontManager.js is loaded first."); return; }


        try {
            console.log('[SM] Assuming Font Manager is initialized.');
            this.loadSavedSettings();
            this._setupEventListeners();
            console.log('[SM] Applying initial settings...');
            // Error occurred here because this.applySettings was missing
            await this.applySettings(this._currentSettings, true, true);
            this._initializeUIComponentsState(); // Ensures UI visibility matches loaded settings
            this._isInitialized = true;
            console.log('[SM] Initialization complete.');
        } catch (error) {
             // Log the specific error that caused init failure
            console.error("[SM] Initialization failed:", error);
            // Optionally show user alert
            // if(typeof showAlert === 'function') showAlert(`Initialization Error: ${error.message}`, 'error');
         }
    },

    /** Bind event listeners to UI controls. */
    _setupEventListeners() {
        console.log('[SM] Setting up event listeners...');
        if (!document.getElementById('logoText')) { console.error("[SM] Cannot find #logoText."); return; }

        // --- Bind controls (Same binding logic as before) ---
        this._bindInputListener('logoText');
        this._bindSelectListener('fontFamily');
        this._bindSelectListener('textCase');
        this._bindSelectListener('fontWeight');
        this._bindSelectListener('textColorMode');
        this._bindSelectListener('gradientPreset');
        this._bindSelectListener('textShadow');
        this._bindSelectListener('borderStyle');
        this._bindSelectListener('textAlign');
        this._bindSelectListener('textAnimation');
        this._bindSelectListener('backgroundType');
        this._bindSelectListener('backgroundGradientPreset');
        this._bindSelectListener('previewSize');
        this._bindNumberInputListener('fontSize', '--dynamic-font-size', 'px');
        this._bindRangeInputListener('letterSpacing', '--dynamic-letter-spacing', 'em');
        this._bindRangeInputListener('rotation', '--dynamic-rotation', 'deg');
        this._bindRangeInputListener('animationSpeed');
        this._bindRangeInputListener('animationDirection', '--gradient-direction', 'deg');
        this._bindRangeInputListener('bgGradientDirection', '--bg-gradient-direction', 'deg');
        this._bindRangeInputListener('bgOpacity');
        this._bindColorInputListener('solidColorPicker');
        this._bindColorInputListener('color1');
        this._bindColorInputListener('color2');
        this._bindColorInputListener('color3');
        this._bindColorInputListener('borderColorPicker', '--dynamic-border-color');
        this._bindColorInputListener('backgroundColor');
        this._bindColorInputListener('bgColor1');
        this._bindColorInputListener('bgColor2');
        this._bindCheckboxListener('useColor3');
        this._bindCheckboxListener('exportTransparent');
        this._bindNumberInputListener('exportWidth'); this._bindNumberInputListener('exportHeight');
        this._bindRangeInputListener('exportQuality');
        this._bindNumberInputListener('exportFrames'); this._bindRangeInputListener('exportFrameRate');

        console.log('[SM] Event listeners setup done.');
    },

    /** Updates the text content of all range value display spans */
    _updateRangeValueDisplays() {
        // console.log('[SM] Updating range value displays...'); // Optional: Uncomment for debugging
        const rangeConfigs = [
            { id: 'letterSpacing', unit: 'em' },
            { id: 'rotation', unit: 'deg' },
            { id: 'animationSpeed', unit: 'x' }, // Special unit 'x' for multiplier
            { id: 'animationDirection', unit: 'deg' }, // Text gradient angle
            { id: 'bgOpacity', unit: '' }, // No unit for opacity
            { id: 'exportQuality', unit: '%' },
            { id: 'exportFrameRate', unit: 'FPS' }, // Custom unit display
            { id: 'bgGradientDirection', unit: 'deg' }
                // Add other range inputs here if they exist
        ];
        rangeConfigs.forEach(config => {
            const input = document.getElementById(config.id);
            if (input) {
                // Find the display span, usually within the same parent container
                const display = input.parentElement?.querySelector('.range-value-display');
                if (display) {
                    let unitDisplay = '';
                    // Handle specific unit displays
                    if (config.unit === 'x') unitDisplay = config.unit;
                    else if (config.unit === 'FPS') unitDisplay = '\u00A0' + config.unit; // Add space for FPS
                    else if (config.unit) unitDisplay = config.unit; // Add unit directly if specified (like 'deg', '%', 'em')

                    // Ensure value exists before displaying
                    const value = input.value ?? '';
                    display.textContent = value + unitDisplay;
                } // else { console.warn(`[SM] Display span not found for range input: ${config.id}`); }
            } // else { console.warn(`[SM] Range input not found: ${config.id}`); }
        });
    }, 

    // --- Listener Binder Functions (Largely unchanged from v15 code) ---
    _bindInputListener(inputId) {
        const input = document.getElementById(inputId); if (!input) return;
        input.addEventListener('input', (e) => {
            const value = e.target.value; this._currentSettings[inputId] = value;
            if (inputId === 'logoText' && this._logoElement) {
                this._logoElement.textContent = value;
                this._logoElement.setAttribute('data-text', value); // Keep data-text sync'd for effects
                this._updateSizeIndicator();
            }
            this._triggerSettingsUpdate();
        });
    },
    _bindSelectListener(selectId) {
        const select = document.getElementById(selectId); if (!select) return;
        select.addEventListener('change', async (e) => { // Async needed for _applyFontFamily
            const value = e.target.value;
            console.log(`[SM Select] #${selectId} = '${value}'`);
            this._currentSettings[selectId] = value;
            // Call specific handlers based on ID
            switch (selectId) {
                case 'fontFamily':
                    await this._applyFontFamily(value); // Await font application
                    this._updateFontPreview(value); // Update small preview
                    break;
                case 'fontWeight':
                     this._applyFontWeight(value); // Apply weight class
                     break;
                case 'textAlign':
                     this._applyTextAlign(value); // Apply align class
                     break;
                case 'textCase':
                     this._applyTextCase(value); // Apply case class
                     break;
                case 'textShadow': // Maps dropdown value to text-effect-* class
                    this._applyTextEffect(value);
                    break;
                case 'borderStyle': // Maps dropdown value to border-style-* or border-effect-* class
                    this._applyBorderStyle(value);
                    break;
                case 'textAnimation': // Applies anim-* class
                    this._applyTextAnimation(value);
                    break;
                case 'previewSize': // Applies preview-size-* class
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
                     console.warn(`[SM] Unhandled select ID in listener: ${selectId}`);
            }
            this._triggerSettingsUpdate(); // Save, notify, update indicators
        });
    },
    _bindNumberInputListener(inputId, cssVar = null, unit = '') {
        const input = document.getElementById(inputId); if (!input) return;
        input.addEventListener('input', (e) => {
            const value = e.target.value; this._currentSettings[inputId] = value;
            if (cssVar) { // Apply CSS Variable if specified
                document.documentElement.style.setProperty(cssVar, `${value}${unit}`);
                // console.log(`[SM] Set CSS Var ${cssVar} = ${value}${unit}`);
                if (cssVar === '--dynamic-font-size') this._updateSizeIndicator();
            } else {
                 // console.log(`[SM] Number input ${inputId} changed, no direct style/var action.`);
            }
            this._triggerSettingsUpdate();
        });
    },
    _bindRangeInputListener(inputId, cssVar = null, unit = '') {
         const input = document.getElementById(inputId); if (!input) return;
         const display = input.parentElement?.querySelector('.range-value-display');
         const updateDisplay = (val) => { if(display) display.textContent = val + (unit === 'x' ? unit : (unit ? ('\u00A0' + unit) : '')); };

         input.addEventListener('input', (e) => {
             const value = e.target.value; this._currentSettings[inputId] = value; updateDisplay(value);

             if (cssVar) { // Apply CSS Variable if specified
                 document.documentElement.style.setProperty(cssVar, `${value}${unit}`);
                 // console.log(`[SM] Set CSS Var ${cssVar} = ${value}${unit}`);
                 if (cssVar === '--dynamic-letter-spacing') this._updateSizeIndicator();
             } else if (inputId === 'animationSpeed') { // Special handler for speed
                 this._applyAnimationSpeed(value);
             } else if (inputId === 'animationDirection') { // Text gradient angle
                 document.documentElement.style.setProperty('--gradient-direction', `${value}deg`);
                 if (this._currentSettings.textColorMode === 'gradient') this._applyGradientToLogo();
                 // console.log(`[SM] Set CSS Var --gradient-direction = ${value}deg`);
             } else if (inputId === 'bgGradientDirection') { // BG gradient angle
                 document.documentElement.style.setProperty('--bg-gradient-direction', `${value}deg`);
                 if (this._currentSettings.backgroundType?.includes('gradient')) this._applyBackgroundGradient();
                 // console.log(`[SM] Set CSS Var --bg-gradient-direction = ${value}deg`);
             } else if (inputId === 'bgOpacity') { // Direct style for BG opacity
                 if (this._previewContainer) this._previewContainer.style.opacity = value;
                 // console.log(`[SM] Set previewContainer opacity = ${value}`);
             } else {
                // console.log(`[SM] Range input ${inputId} changed, no direct style/var action.`);
             }
             this._triggerSettingsUpdate();
         });
    },
    _bindCheckboxListener(checkboxId) {
         const checkbox = document.getElementById(checkboxId); if (!checkbox) return;
         checkbox.addEventListener('change', (e) => {
             const isChecked = e.target.checked; this._currentSettings[checkboxId] = isChecked;
             if (checkboxId === 'useColor3') {
                 document.getElementById('color3Control')?.classList.toggle('hidden', !isChecked);
                 if (this._currentSettings.textColorMode === 'gradient') this._applyGradientToLogo(); // Re-apply gradient
                 console.log(`[SM] Toggled useColor3: ${isChecked}`);
             } else if (checkboxId === 'exportTransparent') {
                  console.log(`[SM] Toggled exportTransparent: ${isChecked}`);
                  // No visual change needed here, only affects export
             }
             this._triggerSettingsUpdate();
         });
    },
    _bindColorInputListener(inputId, cssVar = null) {
         const input = document.getElementById(inputId); if (!input) return;
         input.addEventListener('input', (e) => { // Use 'input' for live preview
             const value = e.target.value; this._currentSettings[inputId] = value;

             if (cssVar) { // Apply CSS Variable if specified (e.g., border color)
                 document.documentElement.style.setProperty(cssVar, value);
                 // console.log(`[SM] Set CSS Var ${cssVar} = ${value}`);
             } else { // Handle direct application for specific color inputs
                 switch (inputId) {
                     case 'solidColorPicker':
                         if (this._currentSettings.textColorMode === 'solid') this._applySolidTextColor(value);
                         break;
                     case 'color1': case 'color2': case 'color3':
                         if (this._currentSettings.textColorMode === 'gradient' && this._currentSettings.gradientPreset === 'custom') this._applyGradientToLogo();
                         break;
                     case 'backgroundColor':
                         if (this._currentSettings.backgroundType === 'bg-solid') this._applySolidBgColor(value);
                         break;
                     case 'bgColor1': case 'bgColor2':
                         if (this._currentSettings.backgroundType?.includes('gradient') && this._currentSettings.backgroundGradientPreset === 'custom') this._applyBackgroundGradient();
                         break;
                 }
             }
             this._triggerSettingsUpdate();
         });
         // Optional: Log final value on 'change'
         input.addEventListener('change', (e) => { /* console.log(`[SM Color] #${inputId} final value = ${e.target.value}`); */ });
    },

    // --- Core Style Application Logic (Using Classes / Variables / Direct Styles) ---

    /** Applies font family using CSS classes and triggers font loading via FontManager */

    /**
     * Enhanced _applyFontFamily function for settingsManager.js
     * This version adds a visual loading indicator when changing fonts
     */
    async _applyFontFamily(fontFamily) {
        if (!this._logoElement || !fontFamily) return;
        
        console.log(`[SM] Applying Font Family: ${fontFamily}`);
        
        // Show loading indicator
        this._applyClass(this._logoElement, 'font-loading', FONT_FAMILY_CLASS_PREFIX);
        
        // Add font loading notification
        const fontLoadingToast = document.createElement('div');
        fontLoadingToast.className = 'logo-toast font-loading-toast info';
        fontLoadingToast.innerHTML = `
            <div class="toast-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    <path d="M12 8v4l3 3"></path>
                </svg>
            </div>
            <div class="toast-content">
                <div class="toast-message">Loading font "${fontFamily}"...</div>
                <div class="loading-progress"><div class="loading-bar"></div></div>
            </div>
        `;
        document.body.appendChild(fontLoadingToast);
        
        // Animate in toast
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fontLoadingToast.classList.add('show');
            });
        });
        
        try {
            const fontData = await getFontDataAsync(fontFamily);

            if (fontData) {
                // Font data loaded successfully
                const className = this._sanitizeForClassName(fontFamily);
                this._applyClass(this._logoElement, FONT_FAMILY_CLASS_PREFIX + className, FONT_FAMILY_CLASS_PREFIX);
                this._displayLicenseInfo(fontData.licenseText);
                this._applyFontWeight(this._currentSettings.fontWeight);
                
                // Show success message
                fontLoadingToast.querySelector('.toast-message').textContent = `Font "${fontFamily}" loaded successfully`;
                fontLoadingToast.querySelector('.loading-progress').innerHTML = 
                    '<svg class="success-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                fontLoadingToast.classList.remove('info');
                fontLoadingToast.classList.add('success');
            } else {
                throw new Error(`Font data null or undefined returned for ${fontFamily}`);
            }
        } catch (err) {
            console.error(`[SM] Error setting font family ${fontFamily}. Applying fallback.`, err);
            this._applyClass(this._logoElement, 'font-family-fallback', FONT_FAMILY_CLASS_PREFIX);
            this._displayLicenseInfo(null);
            this._applyFontWeight(DEFAULT_SETTINGS.fontWeight);
            
            // Show error message
            fontLoadingToast.querySelector('.toast-message').textContent = `Error loading font "${fontFamily}". Using fallback.`;
            fontLoadingToast.classList.remove('info');
            fontLoadingToast.classList.add('error');
        } finally {
            // Remove loading class
            if (this._logoElement) this._logoElement.classList.remove('font-loading');
            this._updateSizeIndicator();
            
            // Remove toast after delay
            setTimeout(() => {
                fontLoadingToast.classList.remove('show');
                fontLoadingToast.addEventListener('transitionend', () => {
                    if (fontLoadingToast.parentNode) {
                        fontLoadingToast.parentNode.removeChild(fontLoadingToast);
                    }
                }, { once: true });
            }, 2000);
        }
    },

    /** Applies font weight using CSS classes */
    _applyFontWeight(weight) {
        if (!this._logoElement || !weight) return;
        // console.log(`[SM] Applying Font Weight Class: ${weight}`);
        this._applyClass(this._logoElement, FONT_WEIGHT_CLASS_PREFIX + weight, FONT_WEIGHT_CLASS_PREFIX);
        // this._updateSizeIndicator(); // Called by _applyFontFamily already
    },

     /** Applies text alignment using CSS classes */
    _applyTextAlign(align) {
        if (!this._logoElement || !align) return;
        // console.log(`[SM] Applying Text Align Class: ${align}`);
        this._applyClass(this._logoElement, TEXT_ALIGN_CLASS_PREFIX + align, TEXT_ALIGN_CLASS_PREFIX);
    },

    /** Applies text case using CSS classes */
    _applyTextCase(textCase) {
        if (!this._logoElement || !textCase) return;
        // console.log(`[SM] Applying Text Case Class: ${textCase}`);
        this._applyClass(this._logoElement, TEXT_CASE_CLASS_PREFIX + textCase, TEXT_CASE_CLASS_PREFIX);
        this._updateSizeIndicator();
    },

    /** Applies text effect using CSS classes based on mapping */
    _applyTextEffect(effectValueFromDropdown) {
        if (!this._logoElement || !effectValueFromDropdown) return;
        // Mapping from dropdown value="...": Maps OLD values to NEW classes
        const effectMap = {
            'text-glow-none': 'text-effect-none',
            'text-glow-soft': 'text-effect-glow-soft',
            'text-glow-medium': 'text-effect-glow-medium',
            'text-glow-strong': 'text-effect-glow-strong',
            'text-glow-sharp': 'text-effect-glow-sharp',
            'text-glow-neon': 'text-effect-neon-primary',
            'text-glow-hard': 'text-effect-shadow-hard-md',
            'text-glow-outline': 'text-effect-outline-thin',
            'text-glow-retro': 'text-effect-shadow-retro',
            'text-glow-emboss': 'text-effect-emboss',
            'text-glow-inset': 'text-effect-inset',
            // Add ALL other values from #textShadow dropdown here
        };
        const className = effectMap[effectValueFromDropdown] || 'text-effect-none'; // Fallback
        // console.log(`[SM] Applying Text Effect: '${effectValueFromDropdown}' -> Class: '${className}'`);
        this._applyClass(this._logoElement, className, TEXT_EFFECT_CLASS_PREFIX); // Applies the mapped class
    },

    /** Applies border style/effect using CSS classes to the container */
    _applyBorderStyle(borderValueFromDropdown) {
        if (!this._logoContainer || !borderValueFromDropdown) return;
         // Mapping from dropdown value="...": Maps IDs to specific border-style-* or border-effect-* classes
        const borderClassMap = {
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
            'border-glow': 'border-effect-glow-soft', // Map dropdown 'glow' to specific soft glow effect
             // Add other effect mappings if needed: 'border-neon', 'border-pulse' etc.
             // 'border-neon': 'border-effect-neon-animated',
             // 'border-pulse': 'border-effect-glow-pulse',
        };
        const className = borderClassMap[borderValueFromDropdown] || 'border-style-none'; // Fallback
        const isStaticStyle = className.startsWith(BORDER_STYLE_CLASS_PREFIX);
        const isEffect = className.startsWith(BORDER_EFFECT_CLASS_PREFIX);
        const hasBorder = className !== 'border-style-none';

        // console.log(`[SM] Applying Border: '${borderValueFromDropdown}' -> Class: '${className}' (Static: ${isStaticStyle}, Effect: ${isEffect})`);

        this._logoContainer.classList.toggle('dynamic-border', hasBorder); // Base class needed

        // Apply specific class, ensuring only one type (style or effect) is active
        if (isStaticStyle) {
            this._applyClass(this._logoContainer, className, BORDER_STYLE_CLASS_PREFIX);
            this._applyClass(this._logoContainer, 'border-effect-none', BORDER_EFFECT_CLASS_PREFIX);
        } else if (isEffect) {
            this._applyClass(this._logoContainer, 'border-style-none', BORDER_STYLE_CLASS_PREFIX);
            this._applyClass(this._logoContainer, className, BORDER_EFFECT_CLASS_PREFIX);
        } else { // Handle 'none' case explicitly
            this._applyClass(this._logoContainer, 'border-style-none', BORDER_STYLE_CLASS_PREFIX);
            this._applyClass(this._logoContainer, 'border-effect-none', BORDER_EFFECT_CLASS_PREFIX);
        }
    },

    /** Applies text animation using CSS classes */
    _applyTextAnimation(animValue) {
        if (!this._logoElement || !animValue) return;
        // console.log(`[SM] Applying Animation Class: ${animValue}`);
        this._applyClass(this._logoElement, animValue, ANIMATION_CLASS_PREFIX);
        this._applyAnimationSpeed(this._currentSettings.animationSpeed); // Ensure speed/duration var is current
    },

     /** Applies preview size using CSS classes */
    _applyPreviewSize(sizeValue) {
        if (!this._previewContainer || !sizeValue) return;
        // console.log(`[SM] Applying Preview Size Class: ${sizeValue}`);
        this._applyClass(this._previewContainer, sizeValue, PREVIEW_SIZE_CLASS_PREFIX);
        this._updateSizeIndicator(); // Size change might affect layout
    },

    // --- Complex State Handlers (Manage UI Visibility + Call Style Applicators) ---
    _handleColorModeChange(mode) {
        // console.log(`[SM] Handling Color Mode Change to: ${mode}`);
        const isSolid = mode === 'solid';
        document.getElementById('solidColorPickerGroup')?.classList.toggle('hidden', !isSolid);
        document.getElementById('gradientPresetGroup')?.classList.toggle('hidden', isSolid);
        document.getElementById('customGradientControls')?.classList.toggle('hidden', isSolid || this._currentSettings.gradientPreset !== 'custom');
        if (isSolid) { this._applySolidTextColor(this._currentSettings.solidColorPicker); }
        else { this._applyGradientToLogo(); }
    },
    _handleGradientPresetChange(preset) {
        // console.log(`[SM] Handling Text Gradient Preset Change: ${preset}`);
        document.getElementById('customGradientControls')?.classList.toggle('hidden', preset !== 'custom');
        if (this._currentSettings.textColorMode === 'gradient') this._applyGradientToLogo(); // Re-apply
    },
    _handleBackgroundTypeChange(type) {
        // console.log(`[SM] Handling Background Type Change: ${type}`);
        if (!this._previewContainer) return;
        const isSolid = type === 'bg-solid'; const isGradient = type.includes('gradient');
        document.getElementById('backgroundColorControl')?.classList.toggle('hidden', !isSolid);
        document.getElementById('backgroundGradientControls')?.classList.toggle('hidden', !isGradient);
        document.getElementById('customBackgroundGradient')?.classList.toggle('hidden', !isGradient || this._currentSettings.backgroundGradientPreset !== 'custom');

        this._previewContainer.style.backgroundImage = ''; this._previewContainer.style.backgroundColor = '';
        this._previewContainer.style.opacity = '1'; // Reset opacity on type change
        document.getElementById('bgOpacity').value = '1'; this._currentSettings.bgOpacity = '1';

        const classesToRemove = Array.from(this._previewContainer.classList).filter(cls => cls.startsWith(BACKGROUND_CLASS_PREFIX));
        this._previewContainer.classList.remove(...classesToRemove);
        this._previewContainer.classList.remove('bg-gradient-animated-css');

        this._previewContainer.classList.add(type);
        if (isSolid) { this._applySolidBgColor(this._currentSettings.backgroundColor); }
        else if (isGradient) { this._applyBackgroundGradient(); if (type === 'bg-gradient-animated') this._previewContainer.classList.add('bg-gradient-animated-css'); }
        else if (type === 'bg-transparent') { this._previewContainer.style.backgroundColor = 'transparent'; }

        this._previewContainer.style.opacity = this._currentSettings.bgOpacity; // Re-apply opacity
        // console.log(`[SM] Final preview container classes: ${Array.from(this._previewContainer.classList).join(' ')}`);
    },
    _handleBackgroundGradientChange(presetValue) {
        // console.log(`[SM] Handling Background Gradient Preset Change: ${presetValue}`);
        document.getElementById('customBackgroundGradient')?.classList.toggle('hidden', presetValue !== 'custom');
        if (this._currentSettings.backgroundType?.includes('gradient')) this._applyBackgroundGradient(); // Re-apply
    },

    // --- Direct Style Setters (Called by handlers) ---
    _applySolidTextColor(color){
        if (!this._logoElement) return;
        this._logoElement.style.backgroundImage = 'none';
        this._logoElement.style.backgroundClip = 'initial'; this._logoElement.style.webkitBackgroundClip = 'initial';
        this._logoElement.style.color = color;
        this._logoElement.style.webkitTextFillColor = 'initial';
        // console.log(`[SM] Applied solid text color: ${color}`);
    },
    _applySolidBgColor(color){
         if (!this._previewContainer) return;
         this._previewContainer.style.backgroundColor = color;
         // console.log(`[SM] Applied solid background color: ${color}`);
    },
    /**
     * Enhanced Gradient Preset Handler
     */

    _applyGradientToLogo() {
        if (!this._logoElement) return;
        
        const direction = this._currentSettings.animationDirection || '45';
        const preset = this._currentSettings.gradientPreset;
        let gradient = '';
        
        try {
            if (preset === 'custom') {
                // For custom gradients, use the color values directly from settings
                const c1 = this._currentSettings.color1;
                const c2 = this._currentSettings.color2;
                const useC3 = this._currentSettings.useColor3;
                const c3 = this._currentSettings.color3;
                
                gradient = useC3 
                    ? `linear-gradient(${direction}deg, ${c1}, ${c2}, ${c3})` 
                    : `linear-gradient(${direction}deg, ${c1}, ${c2})`;
            } else {
                // Fallback values for all presets in case CSS variables aren't available
                const presetMap = {
                    'primary-gradient': `linear-gradient(${direction}deg, #FF1493, #8A2BE2)`,
                    'cyberpunk-gradient': `linear-gradient(${direction}deg, #f953c6, #b91d73)`,
                    'sunset-gradient': `linear-gradient(${direction}deg, #ff7e5f, #feb47b)`,
                    'ocean-gradient': `linear-gradient(${direction}deg, #00c6ff, #0072ff)`,
                    'forest-gradient': `linear-gradient(${direction}deg, #5ec422, #01796f)`,
                    'rainbow-gradient': `linear-gradient(${direction}deg, #ff2400, #e81d1d, #e8b71d, #38f10e, #41c6da, #1f65db, #7a26d3, #bd2da3)`,
                    'neon-blue-gradient': `linear-gradient(${direction}deg, #00c9ff, #92fe9d)`,
                    'royal-gradient': `linear-gradient(${direction}deg, #141e30, #243b55)`,
                    'fire-gradient': `linear-gradient(${direction}deg, #f5576c, #f39c12)`,
                    'purple-love-gradient': `linear-gradient(${direction}deg, #cc2b5e, #753a88)`,
                    'dark-knight-gradient': `linear-gradient(${direction}deg, #ba8b02, #181818)`,
                    'emerald-gradient': `linear-gradient(${direction}deg, #43cea2, #185a9d)`
                };
                
                // Try to get from CSS var first
                const presetVarValue = getComputedStyle(document.documentElement)
                    .getPropertyValue(`--${preset}`).trim();
                    
                if (presetVarValue && presetVarValue.startsWith('linear-gradient')) {
                    // Replace the angle in the CSS variable
                    gradient = presetVarValue.replace(
                        /linear-gradient\([^,]+,/, 
                        `linear-gradient(${direction}deg,`
                    );
                    console.log(`[SM] Using CSS variable for gradient: ${preset}`);
                } 
                // If CSS var not available, use hardcoded fallback
                else if (presetMap[preset]) {
                    gradient = presetMap[preset];
                    console.log(`[SM] Using hardcoded preset for gradient: ${preset}`);
                } else {
                    console.warn(`[SM] Unknown gradient preset: ${preset}. Using fallback.`);
                    gradient = `linear-gradient(${direction}deg, ${DEFAULT_SETTINGS.color1}, ${DEFAULT_SETTINGS.color2})`;
                }
            }
            
            // Apply the gradient to the text
            this._logoElement.style.backgroundImage = gradient;
            this._logoElement.style.webkitBackgroundClip = 'text';
            this._logoElement.style.backgroundClip = 'text';
            this._logoElement.style.color = 'transparent';
            this._logoElement.style.webkitTextFillColor = 'transparent';
            
            console.log(`[SM] Applied text gradient (Preset: ${preset}, Dir: ${direction}deg)`);
        } catch (e) {
            console.error(`[SM] Error applying text gradient:`, e);
            // Fallback to solid white on error
            this._applySolidTextColor('#ffffff');
        }
    },

    // Similarly, replace _applyBackgroundGradient with an enhanced version
    _applyBackgroundGradient() {
        if (!this._previewContainer) return;
        
        const direction = this._currentSettings.bgGradientDirection || '90';
        const preset = this._currentSettings.backgroundGradientPreset;
        let gradient = '';
        
        try {
            if (preset === 'custom') {
                // For custom gradients, use the color values directly from settings
                const c1 = this._currentSettings.bgColor1;
                const c2 = this._currentSettings.bgColor2;
                
                gradient = `linear-gradient(${direction}deg, ${c1}, ${c2})`;
            } else {
                // Fallback values for all presets in case CSS variables aren't available
                const presetMap = {
                    'bg-primary-gradient': `linear-gradient(${direction}deg, #1a1a2e, #16213e, #0f3460)`,
                    'bg-cyberpunk-gradient': `linear-gradient(${direction}deg, #0f0c29, #302b63, #24243e)`,
                    'bg-sunset-gradient': `linear-gradient(${direction}deg, #ff7e5f, #feb47b)`,
                    'bg-ocean-gradient': `linear-gradient(${direction}deg, #00c6ff, #0072ff)`
                    // Add any other background gradient presets here
                };
                
                // Try to get from CSS var first
                const presetVarValue = getComputedStyle(document.documentElement)
                    .getPropertyValue(`--${preset}`).trim();
                    
                if (presetVarValue && presetVarValue.startsWith('linear-gradient')) {
                    // Replace the angle in the CSS variable
                    gradient = presetVarValue.replace(
                        /linear-gradient\([^,]+,/, 
                        `linear-gradient(${direction}deg,`
                    );
                    console.log(`[SM] Using CSS variable for background gradient: ${preset}`);
                } 
                // If CSS var not available, use hardcoded fallback
                else if (presetMap[preset]) {
                    gradient = presetMap[preset];
                    console.log(`[SM] Using hardcoded preset for background gradient: ${preset}`);
                } else {
                    console.warn(`[SM] Unknown background gradient preset: ${preset}. Using fallback.`);
                    gradient = `linear-gradient(${direction}deg, ${DEFAULT_SETTINGS.bgColor1}, ${DEFAULT_SETTINGS.bgColor2})`;
                }
            }
            
            // Apply the gradient to the background
            this._previewContainer.style.backgroundImage = gradient;
            
            console.log(`[SM] Applied background gradient (Preset: ${preset}, Dir: ${direction}deg)`);
        } catch (e) {
            console.error(`[SM] Error applying background gradient:`, e);
            // Fallback to solid black on error
            this._applySolidBgColor('#000000');
        }
    },
    _applyAnimationSpeed(speedValue) {
         const speed = parseFloat(speedValue || 1);
         const baseDuration = 2;
         const duration = Math.max(0.1, baseDuration / Math.max(0.1, speed));
         document.documentElement.style.setProperty('--animation-duration', `${duration.toFixed(2)}s`);
         // console.log(`[SM] Set CSS Var --animation-duration = ${duration.toFixed(2)}s (Speed: ${speed}x)`);
    },
     _updateFontPreview(fontFamilyName) {
         document.getElementById("fontPreview")?.style?.setProperty('font-family', `"${fontFamilyName}", sans-serif`);
     },
     _displayLicenseInfo(licenseText) {
          const el = document.getElementById('fontLicenseText');
          if(el) {
              el.textContent = licenseText || "No license info available.";
              document.getElementById('fontLicenseContainer')?.classList.toggle('hidden', !licenseText);
          }
     },

    // --- Utility Helpers ---
    _applyClass(targetElement, className, classPrefix = null) {
        if (!targetElement || !className) return;
        if (classPrefix) {
            const classesToRemove = Array.from(targetElement.classList).filter(cls => cls.startsWith(classPrefix));
            if (classesToRemove.length > 0) targetElement.classList.remove(...classesToRemove);
        }
        if (!className.endsWith('-none') && !className.endsWith('_none')) {
            targetElement.classList.add(className);
        }
    },
    _sanitizeForClassName(name) {
        if (!name || typeof name !== 'string') return '';
        return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    },

    // --- Core Methods (Trigger, Size, CSS Gen, UI Init, Reset, Persistence) ---

    // --- ADDED applySettings FUNCTION ---
    async applySettings(settings, forceUIUpdate = false, isInitialLoad = false) {
        console.log(`[SM] Applying settings (forceUI: ${forceUIUpdate}, initial: ${isInitialLoad})`);
        // Ensure settings object is valid, merge with defaults to guarantee all keys
        const settingsToApply = (typeof settings === 'object' && settings !== null) ? { ...DEFAULT_SETTINGS, ...settings } : this._currentSettings;
        this._currentSettings = settingsToApply; // Update internal state *first*

        // console.log('[SM] Applying Settings Object:', JSON.stringify(this._currentSettings)); // Verbose

        // --- Update UI Control Values ---
        Object.entries(this._currentSettings).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (!element) return; // Skip if control not found
            try {
                const currentElementValue = (element.type === 'checkbox') ? element.checked : element.value;
                // Ensure consistent type for comparison (boolean for checkbox, string otherwise)
                const newValueFormatted = (element.type === 'checkbox') ? !!value : String(value ?? '');
                const currentValueFormatted = (element.type === 'checkbox') ? currentElementValue : String(currentElementValue);

                // Update element value only if forced, initial load, or value differs
                if (forceUIUpdate || isInitialLoad || currentValueFormatted !== newValueFormatted) {
                    // console.log(`[SM Apply UI] Updating control '${key}': '${currentValueFormatted}' -> '${newValueFormatted}'`);
                    if (element.type === 'checkbox') {
                        element.checked = newValueFormatted;
                    } else {
                        element.value = newValueFormatted;
                    }
                    // If forced update (like reset/random), dispatch an event AFTER setting value
                    // to trigger associated listeners (_bind* functions) for immediate style updates.
                    // Avoid dispatching on initial load to prevent redundant updates.
                    if (forceUIUpdate && !isInitialLoad) {
                        const eventType = (element.nodeName === 'SELECT' || element.type === 'checkbox' || element.type === 'color') ? 'change' : 'input';
                        // console.log(`[SM Apply UI] Dispatching '${eventType}' event for '${key}' due to force update.`);
                        element.dispatchEvent(new Event(eventType, { bubbles: true }));
                    }
                }
            } catch (e) {
                console.warn(`[SM Apply UI] Error applying UI value for ${key}:`, e);
            }
        });

        // --- Apply Visual Styles Consistently (Using Class Helpers or Variables) ---
        // Apply styles directly from settings IF it's the initial load OR a forced update (reset/random)
        // This ensures the visual preview matches the settings state immediately.
        if (isInitialLoad || forceUIUpdate) {
            console.log('[SM Apply Styles] Applying visual styles directly from settings using helper methods...');
            const logoEl = this._logoElement;
            const logoContainer = this._logoContainer;
            const previewContainer = this._previewContainer;

            if (!logoEl || !previewContainer || !logoContainer) {
                console.error("[SM Apply Styles] Critical elements missing for style application!");
                return; // Cannot proceed
            }

            // Text Content
            logoEl.textContent = this._currentSettings.logoText;
            logoEl.setAttribute('data-text', this._currentSettings.logoText);

            // --- APPLY STYLES VIA CLASS HELPERS / VARS (CORRECTED) ---

            // Font Family & Weight (Uses Class Application) - MUST be async
            await this._applyFontFamily(this._currentSettings.fontFamily); // This now applies class & calls _applyFontWeight

            // Text Case & Align (Uses Class Application)
            this._applyTextCase(this._currentSettings.textCase);
            this._applyTextAlign(this._currentSettings.textAlign);

            // Styles controlled by CSS Variables
            document.documentElement.style.setProperty('--dynamic-font-size', `${this._currentSettings.fontSize}px`);
            document.documentElement.style.setProperty('--dynamic-letter-spacing', `${this._currentSettings.letterSpacing}em`);
            document.documentElement.style.setProperty('--dynamic-rotation', `${this._currentSettings.rotation}deg`);
            document.documentElement.style.setProperty('--dynamic-border-color', this._currentSettings.borderColorPicker);
            // Ensure border width var is set (assuming a default or variable exists in CSS)
            // You might need to set a default value here if not set elsewhere:
            // document.documentElement.style.setProperty('--dynamic-border-width', '2px');

            // Text/BG Gradient Directions (CSS Variables)
            document.documentElement.style.setProperty('--gradient-direction', `${this._currentSettings.animationDirection}deg`);
            document.documentElement.style.setProperty('--bg-gradient-direction', `${this._currentSettings.bgGradientDirection}deg`);

            // Animation Speed/Duration (CSS Variable via helper)
            this._applyAnimationSpeed(this._currentSettings.animationSpeed);

            // Effects & Borders (Uses Class Application with Mapping)
            this._applyTextEffect(this._currentSettings.textShadow); // Key 'textShadow' holds dropdown value
            this._applyBorderStyle(this._currentSettings.borderStyle); // Key 'borderStyle' holds dropdown value

            // Animation (Uses Class Application)
            this._applyTextAnimation(this._currentSettings.textAnimation);

             // Preview Size (Uses Class Application)
            this._applyPreviewSize(this._currentSettings.previewSize);

            // Complex Handlers (Handle UI visibility and apply styles)
            // Must run AFTER basic variables/classes are set
            this._handleColorModeChange(this._currentSettings.textColorMode); // Applies solid/gradient text fill
            this._handleBackgroundTypeChange(this._currentSettings.backgroundType); // Applies bg style/class/gradient
            previewContainer.style.opacity = this._currentSettings.bgOpacity; // Apply BG opacity directly

            // Ensure UI state matches applied settings (especially for custom controls)
            // These might trigger redundant style applications but ensure UI consistency
            this._handleGradientPresetChange(this._currentSettings.gradientPreset);
            this._handleBackgroundGradientChange(this._currentSettings.backgroundGradientPreset);

            // Update range displays AFTER setting values in the loop above
            this._updateRangeValueDisplays();

            console.log('[SM Apply Styles] Visual styles application complete.');
        }

        // --- Final Trigger ---
        // Always trigger save, listeners, CSS code update after applying settings
        // This ensures even non-forced updates persist and notify
        this._triggerSettingsUpdate();
        console.log('[SM] applySettings complete.');
    }, // <<< END OF applySettings FUNCTION

    _triggerSettingsUpdate() {
         this.saveCurrentSettings();
         this._listeners.forEach(l=>{try{l(this.getCurrentSettings());}catch(e){console.error('[SM] Error in settings listener:', e)}});
         // Use rAF for updates that read layout
         requestAnimationFrame(()=>{
             this._updateSizeIndicator();
             this._updateCSSCode();
        });
    },
    _updateSizeIndicator() {
         const w=document.getElementById('logoWidth'); const h=document.getElementById('logoHeight');
         if(!this._logoElement||!w||!h)return;
         try{const r=this._logoElement.getBoundingClientRect(); if(r.width>0)w.textContent=Math.round(r.width); if(r.height>0)h.textContent=Math.round(r.height);}catch(e){}
    },
    _updateCSSCode() {
         const el=document.getElementById('cssCode'); if(el) el.value = this._generateCSSCode();
    },
    // --- ADDED Corrected _generateCSSCode ---
    _generateCSSCode() {
        console.log("[SM] Generating CSS Code (Reflecting Classes/Vars)...");
        if (!this._logoElement || !this._previewContainer || !this._logoContainer) return "/* Error: Missing core elements */";
        try {
            let css = `:root {\n`;
            // Include essential CSS variables that are dynamically set
            const cssVars = [
                '--animation-duration', '--gradient-direction', '--dynamic-border-color',
                '--bg-gradient-direction', '--dynamic-font-size', '--dynamic-letter-spacing',
                '--dynamic-rotation', '--dynamic-border-width' // Added border width
            ];
            cssVars.forEach(v => {
                // Check inline style first, then computed style as fallback
                const val = document.documentElement.style.getPropertyValue(v) || getComputedStyle(document.documentElement).getPropertyValue(v);
                if (val && val.trim()) css += `  ${v}: ${val.trim()};\n`;
            });
            // Optionally include theme color vars if they exist and are relevant
            // const themeVars = ['--primary-color', '--secondary-color', '--accent-color'];
            // themeVars.forEach(v => { const val = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); if (val) css += `  ${v}: ${val};\n`; });
            css += `}\n\n`;

            // --- Get applied classes accurately ---
            const getPrefixedClass = (element, prefix) => Array.from(element.classList).find(c => c.startsWith(prefix));

            const containerClasses = Array.from(this._logoContainer.classList)
                                     .filter(c => c === 'dynamic-border' || c.startsWith(BORDER_STYLE_CLASS_PREFIX) || c.startsWith(BORDER_EFFECT_CLASS_PREFIX))
                                     .map(c => `.${c}`) // Add dot for CSS selector
                                     .join(''); // e.g., .dynamic-border.border-style-solid

            const textClasses = Array.from(this._logoElement.classList)
                                  .filter(c => c.startsWith(FONT_FAMILY_CLASS_PREFIX) || c.startsWith(FONT_WEIGHT_CLASS_PREFIX) ||
                                               c.startsWith(TEXT_ALIGN_CLASS_PREFIX) || c.startsWith(TEXT_CASE_CLASS_PREFIX) ||
                                               c.startsWith(TEXT_EFFECT_CLASS_PREFIX) || c.startsWith(ANIMATION_CLASS_PREFIX))
                                  .map(c => `.${c}`) // Add dot
                                  .join('');

            // Container CSS
            // Use a more specific selector if possible, or assume a base class/ID
            css += `.logo-container${containerClasses} { /* Container styles reflecting applied classes */\n`;
            css += `  /* Add relevant base styles from layout.css if needed (e.g., display, align-items) */\n`;
            css += `  position: relative; /* Usually needed */\n`;
             // Border properties are handled by the classes + :root vars referenced in effects.css
             // No need to redeclare border-width/color/style here if using classes correctly
            css += `}\n\n`;

            // Text CSS
            css += `.logo-text${textClasses} { /* Text styles reflecting applied classes */\n`;
            // Font family, weight, text-align, text-case, effect, animation handled by classes included above

            // Styles controlled by CSS Variables
            css += `  font-size: var(--dynamic-font-size);\n`;
            css += `  letter-spacing: var(--dynamic-letter-spacing);\n`;
            css += `  transform: rotate(var(--dynamic-rotation));\n`;

            // Color/Gradient (get current inline style applied by JS handlers)
            if (this._currentSettings.textColorMode === 'gradient') {
                css += `  background-image: ${this._logoElement.style.backgroundImage || 'none'}; /* Current gradient */\n`;
                css += `  -webkit-background-clip: text;\n  background-clip: text;\n`;
                css += `  color: transparent;\n  -webkit-text-fill-color: transparent;\n`;
            } else {
                css += `  color: ${this._logoElement.style.color || '#ffffff'}; /* Current solid color */\n`;
                 // Ensure gradient properties are reset if solid
                 css += `  background-image: none;\n`;
                 css += `  background-clip: initial;\n  -webkit-background-clip: initial;\n`;
                 css += `  -webkit-text-fill-color: initial;\n`;
            }

            css += `  /* Add other essential base styles from layout.css if needed (e.g., line-height) */\n`;
            css += `  line-height: 1.2;\n`;
            css += `}\n\n`;

            // Include relevant @keyframes if animation is active
            const animClass = getPrefixedClass(this._logoElement, ANIMATION_CLASS_PREFIX);
            if (animClass && animClass !== 'anim-none' && typeof getActiveAnimationKeyframes === 'function') { // Use global helper check
                const keyframesCss = getActiveAnimationKeyframes(animClass.replace(ANIMATION_CLASS_PREFIX, '')); // Use global helper
                if (keyframesCss) css += keyframesCss + '\n\n';
            }

            // Include background class CSS definition (optional, complex to get perfectly)
            const bgClass = Array.from(this._previewContainer.classList).find(c => c.startsWith(BACKGROUND_CLASS_PREFIX));
            if (bgClass && bgClass !== 'bg-solid' && bgClass !== 'bg-transparent' && !bgClass.includes('gradient')) {
                 css += `/* Background Pattern Class: .${bgClass} */\n`;
                 css += `/* Add the full definition for .${bgClass} from effects.css here if needed for standalone use */\n\n`;
            }

            return css;
        } catch (e) {
            console.error("Error generating CSS:", e);
            return `/* CSS Gen Error: ${e.message} */`;
        }
    },
    _initializeUIComponentsState() {
        console.log('[SM] Initializing UI component states...');
        this._handleColorModeChange(this._currentSettings.textColorMode);
        this._handleGradientPresetChange(this._currentSettings.gradientPreset);
        this._handleBackgroundTypeChange(this._currentSettings.backgroundType);
        this._handleBackgroundGradientChange(this._currentSettings.backgroundGradientPreset);
        this._updateFontPreview(this._currentSettings.fontFamily);
        this._updateRangeValueDisplays();
        this._setupResetButton(); // Ensure reset modal listeners are attached
         console.log('[SM] UI component states initialized.');
    },
    _setupResetButton() {
        const rB=document.getElementById('resetBtn'); if(!rB||rB.dataset.lA)return;
        const md=document.getElementById('resetConfirmModal');
        const cN=document.getElementById('resetModalCancel');
        const cF=document.getElementById('resetModalConfirm');
        if(!md||!cN||!cF){ console.warn('[SM] Reset modal elements missing.'); return; }
        const close = ()=>{md.style.display='none';md.classList.remove('active');};
        rB.onclick=()=>{md.style.display='flex';md.classList.add('active');};
        cN.onclick=close;
        // Use arrow function to preserve 'this' context when calling resetSettings
        cF.onclick=()=>{
             const t=document.querySelector('input[name="reset-type"]:checked')?.value||'all';
             this.resetSettings(t); // Call method on SettingsManager instance
             close();
        };
        md.onclick=(e)=>{if(e.target===md)close();};
        document.onkeydown=(e)=>{if(e.key==='Escape'&&md.classList.contains('active'))close();};
        rB.dataset.lA='true'; // Mark as listener attached
    },
    resetSettings(resetType = 'all') {
        console.log(`[SM Resetting] Type: ${resetType}`);
        const defaults = this.getDefaults();
        let settingsToApply;
        if (resetType === 'all') {
            settingsToApply = { ...defaults };
        } else {
            settingsToApply = { ...this.getCurrentSettings() }; // Start with current
            const keyMap = {
                text: ['logoText','fontFamily','fontSize','letterSpacing','textCase','fontWeight'],
                style: ['textColorMode','solidColorPicker','gradientPreset','color1','color2','useColor3','color3','textShadow','borderColorPicker','borderStyle','textAlign','rotation','animationDirection','textAnimation','animationSpeed'], // Includes anim
                background: ['backgroundType','backgroundColor','bgOpacity','backgroundGradientPreset','bgColor1','bgColor2','bgGradientDirection'],
                // Combine categories if needed, e.g., reset 'appearance' could be style+background+animation
                // advanced: ['previewSize', 'export...'] // Add if needed
            };
            const keysToReset = keyMap[resetType] || Object.keys(defaults); // Fallback to all if type unknown
            keysToReset.forEach(key => {
                if (defaults.hasOwnProperty(key)) settingsToApply[key] = defaults[key];
            });
        }
        // Apply the determined settings and force UI update
        this.applySettings(settingsToApply, true) // << This call needs applySettings to exist on 'this'
             .then(() => {
                 console.log('[SM] Settings reset applied successfully.');
                 if(typeof notifyResetSuccess === 'function') notifyResetSuccess(resetType); // Use global notification
                 else if(typeof showToast === 'function') showToast({message: `Settings Reset (${resetType})!`, type:'success'});
             })
             .catch(err => {
                 console.error("[SM] Error applying reset settings:", err);
                 if(typeof showAlert === 'function') showAlert("Failed to apply reset settings.", "error");
             });
    },
    loadSavedSettings() {
        try {
            const saved = localStorage.getItem('logomakerSettings');
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                this._currentSettings = { ...DEFAULT_SETTINGS, ...loadedSettings }; // Merge with defaults
                // Font check needs to happen AFTER font dropdown is populated by fontManager
                setTimeout(() => {
                    const fontDropdown = document.getElementById('fontFamily');
                    const savedFont = this._currentSettings.fontFamily;
                    if (fontDropdown && !fontDropdown.querySelector(`option[value="${savedFont}"]`)) {
                         console.warn(`[SM] Saved font '${savedFont}' not in dropdown. Reverting to default '${DEFAULT_SETTINGS.fontFamily}'.`);
                         this._currentSettings.fontFamily = DEFAULT_SETTINGS.fontFamily;
                         // Optionally update the dropdown UI itself if applySettings hasn't run yet
                         // fontDropdown.value = DEFAULT_SETTINGS.fontFamily;
                    }
                }, 200); // Delay font check slightly
                console.log('[SM] Loaded settings from localStorage.');
            } else {
                this._currentSettings = this.getDefaults(); // Use deep copy
                console.log('[SM] No saved settings found, using defaults.');
            }
        } catch (err) {
            console.error('[SM] Error loading settings:', err);
            this._currentSettings = this.getDefaults(); // Fallback to deep copy
             if(typeof showAlert === 'function') showAlert('Failed to load saved settings. Using defaults.', 'warning');
        }
    },
    saveCurrentSettings() {
         try { localStorage.setItem('logomakerSettings', JSON.stringify(this._currentSettings)); }
         catch (err) { console.error('[SM] Error saving settings:', err); }
    },
    addSettingsChangeListener(listener) { if (typeof listener === 'function') this._listeners.push(listener); },
    removeSettingsChangeListener(listener) { this._listeners = this._listeners.filter(l => l !== listener); },

}; // End of SettingsManager object literal

// --- Global Exposure & Export ---
window.SettingsManager = SettingsManager; // Expose globally if needed by non-module scripts or console debugging
export default SettingsManager; // Standard ES6 export

console.log("[SettingsManager] Module loaded (v15.2 - applySettings restored). Ready for init().");