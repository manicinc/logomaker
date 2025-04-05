/* settingsManager.js (Version 17.0 - With Enhanced Border Handling)
 * =========================================================================
 * Manages UI state, applies styles via CSS CLASSES & CSS Variables,
 * handles settings persistence, and properly interacts with fontManager.js.
 * Enhanced with improved border radius, border padding support, and
 * consistent class application for SVG export.
 */

// --- Constants for CSS Class Prefixes ---
const FONT_FAMILY_CLASS_PREFIX = 'font-family-';
const FONT_WEIGHT_CLASS_PREFIX = 'font-weight-';
const TEXT_ALIGN_CLASS_PREFIX = 'text-align-';
const TEXT_CASE_CLASS_PREFIX = 'text-case-';
const TEXT_EFFECT_CLASS_PREFIX = 'text-effect-'; // Prefix for ALL text effects (glows, shadows etc)
const BORDER_STYLE_CLASS_PREFIX = 'border-style-'; // Prefix for static border styles
const BORDER_EFFECT_CLASS_PREFIX = 'border-effect-'; // Prefix for dynamic border effects (glows etc)
const BORDER_RADIUS_CLASS_PREFIX = 'border-radius-'; // For radius styles
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
    textShadow: 'text-effect-none', // Updated to new class format 
    borderColorPicker: '#ffffff', // Applied via CSS var --dynamic-border-color
    borderStyle: 'border-none', // Dropdown VALUE, maps to border-style-* or border-effect-* class
    borderWidth: '2', // Applied via CSS var --dynamic-border-width
    borderRadius: 'none', // Border radius setting (none, circle, custom value)
    borderPadding: '10', // Border padding in pixels
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

// --- Mapping for Border Style Classes ---
// This helps convert dropdown values to specific CSS classes
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
    
    // Effect styles
    'border-glow': 'border-effect-glow-soft',
    'border-neon': 'border-effect-neon-animated',
    'border-pulse': 'border-effect-glow-pulse',
    'border-gradient': 'border-effect-gradient-animated'
};

// --- Mapping for Text Effect Classes --- 
// This helps convert dropdown values to specific CSS classes
const TEXT_EFFECT_MAP = {
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
    'text-glow-hard': 'text-effect-shadow-hard-md',
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
const BORDER_RADIUS_MAP = {
    'none': 'border-radius-none',
    'square': 'border-radius-none',
    'rounded-sm': 'border-radius-sm',
    'rounded-md': 'border-radius-md',
    'rounded-lg': 'border-radius-lg',
    'pill': 'border-radius-pill',
    'circle': 'border-radius-circle',
    'oval': 'border-radius-oval'
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
        console.log('[SM] Initialize (v17.0 - Enhanced with improved border handling)...'); 

        // Cache elements
        this._logoElement = document.querySelector('.logo-text');
        this._logoContainer = document.querySelector('.logo-container');
        this._previewContainer = document.getElementById('previewContainer');
        if (!this._logoElement || !this._logoContainer || !this._previewContainer) { 
            console.error("[SM CRITICAL] Core preview elements missing! Aborting init."); 
            return; 
        }

        // Check dependencies (fontManager's function)
        if (typeof getFontDataAsync !== 'function') { 
            console.error("[SM CRITICAL] `getFontDataAsync` not found! Ensure fontManager.js is loaded first."); 
            return; 
        }

        // Check CSSUtils dependency
        if (!window.CSSUtils) {
            console.warn("[SM] CSSUtils not found! Some border features may not work correctly.");
        }

        try {
            console.log('[SM] Assuming Font Manager is initialized.');
            this.loadSavedSettings();
            this._setupEventListeners();
            console.log('[SM] Applying initial settings...');
            await this.applySettings(this._currentSettings, true, true);
            this._initializeUIComponentsState();
            this._isInitialized = true;
            console.log('[SM] Initialization complete.');
        } catch (error) {
            console.error("[SM] Initialization failed:", error);
            if(typeof showAlert === 'function') {
                showAlert(`Initialization Error: ${error.message}`, 'error');
            }
        }
    },

    /** Bind event listeners to UI controls. */
    _setupEventListeners() {
        console.log('[SM] Setting up event listeners...');
        if (!document.getElementById('logoText')) { 
            console.error("[SM] Cannot find #logoText."); 
            return; 
        }

        // --- Bind controls ---
        this._bindInputListener('logoText');
        this._bindSelectListener('fontFamily');
        this._bindSelectListener('textCase');
        this._bindSelectListener('fontWeight');
        this._bindSelectListener('textColorMode');
        this._bindSelectListener('gradientPreset');
        this._bindSelectListener('textShadow');
        this._bindSelectListener('borderStyle');
        this._bindSelectListener('borderRadius'); // Bind border radius
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
        this._bindNumberInputListener('exportWidth'); 
        this._bindNumberInputListener('exportHeight');
        this._bindRangeInputListener('exportQuality');
        this._bindNumberInputListener('exportFrames'); 
        this._bindRangeInputListener('exportFrameRate');

        console.log('[SM] Event listeners setup done.');
    },

    /** Updates the text content of all range value display spans */
    _updateRangeValueDisplays() {
        const rangeConfigs = [
            { id: 'letterSpacing', unit: 'em' },
            { id: 'rotation', unit: 'deg' },
            { id: 'animationSpeed', unit: 'x' }, 
            { id: 'animationDirection', unit: 'deg' }, 
            { id: 'bgOpacity', unit: '' }, 
            { id: 'exportQuality', unit: '%' },
            { id: 'exportFrameRate', unit: 'FPS' }, 
            { id: 'bgGradientDirection', unit: 'deg' }
        ];
        rangeConfigs.forEach(config => {
            const input = document.getElementById(config.id);
            if (input) {
                const display = input.parentElement?.querySelector('.range-value-display');
                if (display) {
                    let unitDisplay = '';
                    if (config.unit === 'x') unitDisplay = config.unit;
                    else if (config.unit === 'FPS') unitDisplay = '\u00A0' + config.unit;
                    else if (config.unit) unitDisplay = config.unit;

                    const value = input.value ?? '';
                    display.textContent = value + unitDisplay;
                }
            }
        });
    }, 

    // --- Listener Binder Functions ---
    _bindInputListener(inputId) {
        const input = document.getElementById(inputId); 
        if (!input) return;
        
        input.addEventListener('input', (e) => {
            const value = e.target.value; 
            this._currentSettings[inputId] = value;
            
            if (inputId === 'logoText' && this._logoElement) {
                this._logoElement.textContent = value;
                this._logoElement.setAttribute('data-text', value); // Keep data-text sync'd for effects
                this._updateSizeIndicator();
            }
            this._triggerSettingsUpdate();
        });
    },
    
    _bindSelectListener(selectId) {
        const select = document.getElementById(selectId); 
        if (!select) return;
        
        select.addEventListener('change', async (e) => {
            const value = e.target.value;
            console.log(`[SM Select] #${selectId} = '${value}'`);
            this._currentSettings[selectId] = value;
            
            // Call specific handlers based on ID
            switch (selectId) {
                case 'fontFamily':
                    await this._applyFontFamily(value);
                    this._updateFontPreview(value);
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
                case 'textShadow':
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
                     console.warn(`[SM] Unhandled select ID in listener: ${selectId}`);
            }
            this._triggerSettingsUpdate();
        });
    },
    
    _bindNumberInputListener(inputId, cssVar = null, unit = '') {
        const input = document.getElementById(inputId); 
        if (!input) return;
        
        input.addEventListener('input', (e) => {
            const value = e.target.value; 
            this._currentSettings[inputId] = value;
            
            if (cssVar) {
                document.documentElement.style.setProperty(cssVar, `${value}${unit}`);
                
                if (cssVar === '--dynamic-font-size') {
                    this._updateSizeIndicator();
                } 
                else if (cssVar === '--dynamic-border-width') {
                    // When border width changes, ensure border style is reapplied
                    if (this._currentSettings.borderStyle && this._currentSettings.borderStyle !== 'border-none') {
                        this._applyBorderStyle(this._currentSettings.borderStyle);
                    }
                }
                else if (cssVar === '--dynamic-border-padding') {
                    // Apply padding to the logo container
                    this._applyBorderPadding(value, unit);
                }
            }
            
            this._triggerSettingsUpdate();
        });
    },
    
    _bindRangeInputListener(inputId, cssVar = null, unit = '') {
         const input = document.getElementById(inputId); 
         if (!input) return;
         
         const display = input.parentElement?.querySelector('.range-value-display');
         const updateDisplay = (val) => { 
             if(display) {
                 display.textContent = val + (unit === 'x' ? unit : (unit ? ('\u00A0' + unit) : ''));
             }
         };

         input.addEventListener('input', (e) => {
             const value = e.target.value; 
             this._currentSettings[inputId] = value; 
             updateDisplay(value);

             if (cssVar) {
                 document.documentElement.style.setProperty(cssVar, `${value}${unit}`);
                 
                 if (cssVar === '--dynamic-letter-spacing') {
                     this._updateSizeIndicator();
                 }
             } else if (inputId === 'animationSpeed') {
                 this._applyAnimationSpeed(value);
             } else if (inputId === 'animationDirection') {
                 document.documentElement.style.setProperty('--gradient-direction', `${value}deg`);
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
             
             this._triggerSettingsUpdate();
         });
    },
    
    _bindCheckboxListener(checkboxId) {
         const checkbox = document.getElementById(checkboxId); 
         if (!checkbox) return;
         
         checkbox.addEventListener('change', (e) => {
             const isChecked = e.target.checked; 
             this._currentSettings[checkboxId] = isChecked;
             
             if (checkboxId === 'useColor3') {
                 document.getElementById('color3Control')?.classList.toggle('hidden', !isChecked);
                 if (this._currentSettings.textColorMode === 'gradient') {
                     this._applyGradientToLogo();
                 }
                 console.log(`[SM] Toggled useColor3: ${isChecked}`);
             } else if (checkboxId === 'exportTransparent') {
                  console.log(`[SM] Toggled exportTransparent: ${isChecked}`);
             }
             
             this._triggerSettingsUpdate();
         });
    },
    
    _bindColorInputListener(inputId, cssVar = null) {
         const input = document.getElementById(inputId); 
         if (!input) return;
         
         input.addEventListener('input', (e) => {
             const value = e.target.value; 
             this._currentSettings[inputId] = value;

             if (cssVar) {
                 document.documentElement.style.setProperty(cssVar, value);
                 
                 // For border color, we also want to set the RGB variable
                 if (cssVar === '--dynamic-border-color') {
                     // Use CSSUtils if available, otherwise simple fallback 
                     if (window.CSSUtils && typeof window.CSSUtils.extractRGB === 'function') {
                         const rgbValue = window.CSSUtils.extractRGB(value);
                         document.documentElement.style.setProperty('--dynamic-border-color-rgb', rgbValue);
                     } else {
                         // Simple RGB extraction fallback
                         const rgbValue = this._extractColorRGB(value);
                         document.documentElement.style.setProperty('--dynamic-border-color-rgb', rgbValue);
                     }
                     
                     // If we have a border, make sure it gets the updated color
                     if (this._currentSettings.borderStyle && this._currentSettings.borderStyle !== 'border-none') {
                         this._applyBorderStyle(this._currentSettings.borderStyle);
                     }
                 }
             } else {
                 switch (inputId) {
                     case 'solidColorPicker':
                         if (this._currentSettings.textColorMode === 'solid') {
                             this._applySolidTextColor(value);
                         }
                         break;
                     case 'color1': 
                     case 'color2': 
                     case 'color3':
                         if (this._currentSettings.textColorMode === 'gradient' && 
                             this._currentSettings.gradientPreset === 'custom') {
                             this._applyGradientToLogo();
                         }
                         break;
                     case 'backgroundColor':
                         if (this._currentSettings.backgroundType === 'bg-solid') {
                             this._applySolidBgColor(value);
                         }
                         break;
                     case 'bgColor1': 
                     case 'bgColor2':
                         if (this._currentSettings.backgroundType?.includes('gradient') && 
                             this._currentSettings.backgroundGradientPreset === 'custom') {
                             this._applyBackgroundGradient();
                         }
                         break;
                 }
             }
             
             this._triggerSettingsUpdate();
         });
    },
    
    /** Simple RGB extraction fallback if CSSUtils is not available */
    _extractColorRGB(color) {
        if (!color) return "255, 255, 255"; // Default white
        
        // For hex colors
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            let r, g, b;
            
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            } else {
                return "255, 255, 255"; // Fallback
            }
            
            return `${r}, ${g}, ${b}`;
        }
        
        // Basic RGB parsing
        if (color.startsWith('rgb')) {
            const match = color.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
            if (match) {
                return `${match[1]}, ${match[2]}, ${match[3]}`;
            }
        }
        
        return "255, 255, 255"; // Default fallback
    },

    // --- Core Style Application Logic ---

    /**
     * Apply font family using CSS classes with visual loading indicator
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
        this._applyClass(this._logoElement, FONT_WEIGHT_CLASS_PREFIX + weight, FONT_WEIGHT_CLASS_PREFIX);
    },

    /** Applies text alignment using CSS classes */
    _applyTextAlign(align) {
        if (!this._logoElement || !align) return;
        this._applyClass(this._logoElement, TEXT_ALIGN_CLASS_PREFIX + align, TEXT_ALIGN_CLASS_PREFIX);
    },

    /** Applies text case using CSS classes */
    _applyTextCase(textCase) {
        if (!this._logoElement || !textCase) return;
        this._applyClass(this._logoElement, TEXT_CASE_CLASS_PREFIX + textCase, TEXT_CASE_CLASS_PREFIX);
        this._updateSizeIndicator();
    },

    /** 
     * Applies text effect using CSS classes with mapping*/
    _applyTextEffect(effectValueFromDropdown) {
        if (!this._logoElement || !effectValueFromDropdown) return;
        
        // Use the mapping to ensure consistent class names
        const effectClass = TEXT_EFFECT_MAP[effectValueFromDropdown] || 'text-effect-none';
        console.log(`[SM] Applying text effect: '${effectValueFromDropdown}' → '${effectClass}'`);
        
        this._applyClass(this._logoElement, effectClass, TEXT_EFFECT_CLASS_PREFIX);
    },

    /** 
     * Applies border style/effect using CSS classes to the container 
     * Using the mapped class format for consistency
     */
    _applyBorderStyle(borderValueFromDropdown) {
        if (!this._logoContainer || !borderValueFromDropdown) return;
        
        // Use the mapping to ensure consistent class names
        const borderClass = BORDER_STYLE_MAP[borderValueFromDropdown] || 'border-style-none';
        console.log(`[SM] Applying border style: '${borderValueFromDropdown}' → '${borderClass}'`);
        
        const isStaticStyle = borderClass.startsWith(BORDER_STYLE_CLASS_PREFIX);
        const isEffect = borderClass.startsWith(BORDER_EFFECT_CLASS_PREFIX);
        const hasBorder = borderClass !== 'border-style-none';

        // Add/remove base container class
        this._logoContainer.classList.toggle('dynamic-border', hasBorder);

        // Apply specific class, ensuring only one type (style or effect) is active
        if (isStaticStyle) {
            this._applyClass(this._logoContainer, borderClass, BORDER_STYLE_CLASS_PREFIX);
            this._applyClass(this._logoContainer, 'border-effect-none', BORDER_EFFECT_CLASS_PREFIX);
        } else if (isEffect) {
            this._applyClass(this._logoContainer, 'border-style-none', BORDER_STYLE_CLASS_PREFIX);
            this._applyClass(this._logoContainer, borderClass, BORDER_EFFECT_CLASS_PREFIX);
        } else { // Handle 'none' case explicitly
            this._applyClass(this._logoContainer, 'border-style-none', BORDER_STYLE_CLASS_PREFIX);
            this._applyClass(this._logoContainer, 'border-effect-none', BORDER_EFFECT_CLASS_PREFIX);
        }
        
        // Apply border width from settings
        const borderWidth = `${this._currentSettings.borderWidth || '2'}px`;
        document.documentElement.style.setProperty('--dynamic-border-width', borderWidth);
        
        // Ensure correct padding is applied
        this._applyBorderPadding(this._currentSettings.borderPadding || '10');
        
        // Ensure correct radius is applied (maintain current radius)
        this._applyBorderRadius(this._currentSettings.borderRadius || 'none');
    },
    
    /** 
     * Applies border radius to the container
     * Handles special keywords (circle, pill, etc.) or numeric values
     */
    _applyBorderRadius(radiusValue) {
        if (!this._logoContainer || !radiusValue) return;
        
        // Use the mapping table to ensure consistent class names
        const radiusClass = BORDER_RADIUS_MAP[radiusValue] || 'border-radius-custom';
        console.log(`[SM] Applying border radius: '${radiusValue}' → '${radiusClass}'`);
        
        // Add the appropriate class (ensures proper CSS exports)
        this._applyClass(this._logoContainer, radiusClass, BORDER_RADIUS_CLASS_PREFIX);
        
        // Use CSSUtils if available for actual style application
        if (window.CSSUtils && typeof window.CSSUtils.applyBorderRadius === 'function') {
            window.CSSUtils.applyBorderRadius(this._logoContainer, radiusValue);
        }
        else {
            // Simple direct style fallback if CSSUtils not available
            switch (radiusValue) {
                case 'none':
                case 'square':
                    this._logoContainer.style.borderRadius = '0';
                    document.documentElement.style.setProperty('--dynamic-border-radius', '0');
                    break;
                case 'circle':
                    this._logoContainer.style.borderRadius = '50%';
                    document.documentElement.style.setProperty('--dynamic-border-radius', '50%');
                    break;
                case 'oval':
                    this._logoContainer.style.borderRadius = '30% / 50%';
                    document.documentElement.style.setProperty('--dynamic-border-radius', '30% / 50%');
                    break;
                case 'pill':
                    this._logoContainer.style.borderRadius = '999px';
                    document.documentElement.style.setProperty('--dynamic-border-radius', '999px');
                    break;
                case 'rounded-sm':
                    this._logoContainer.style.borderRadius = '3px';
                    document.documentElement.style.setProperty('--dynamic-border-radius', '3px');
                    break;
                case 'rounded-md':
                    this._logoContainer.style.borderRadius = '6px';
                    document.documentElement.style.setProperty('--dynamic-border-radius', '6px');
                    break;
                case 'rounded-lg':
                    this._logoContainer.style.borderRadius = '10px';
                    document.documentElement.style.setProperty('--dynamic-border-radius', '10px');
                    break;
                default:
                    // If a numeric value or string with units, apply directly
                    if (!isNaN(radiusValue)) {
                        this._logoContainer.style.borderRadius = `${radiusValue}px`;
                        document.documentElement.style.setProperty('--dynamic-border-radius', `${radiusValue}px`);
                    } else {
                        this._logoContainer.style.borderRadius = radiusValue;
                        document.documentElement.style.setProperty('--dynamic-border-radius', radiusValue);
                    }
            }
        }
    },
    
    /**
     * Apply border padding to the container
     */
    _applyBorderPadding(padding, unit = 'px') {
        if (!this._logoContainer) return;
        
        // Normalize padding to ensure it has unit
        let normalizedPadding = padding;
        if (!isNaN(padding)) {
            normalizedPadding = `${padding}${unit}`;
        }
        
        // Use CSSUtils if available for advanced style application
        if (window.CSSUtils && typeof window.CSSUtils.applyBorderPadding === 'function') {
            window.CSSUtils.applyBorderPadding(this._logoContainer, normalizedPadding);
        }
        else {
            // Fallback direct style application
            this._logoContainer.style.padding = normalizedPadding;
            document.documentElement.style.setProperty('--dynamic-border-padding', normalizedPadding);
        }
        
        console.log(`[SM] Applied border padding: ${normalizedPadding}`);
    },

    /** Applies text animation using CSS classes */
    _applyTextAnimation(animValue) {
        if (!this._logoElement || !animValue) return;
        this._applyClass(this._logoElement, animValue, ANIMATION_CLASS_PREFIX);
        this._applyAnimationSpeed(this._currentSettings.animationSpeed); // Ensure speed/duration var is current
        
        // Add data-text attribute for glitch animation if needed
        if (animValue === 'anim-glitch' && this._logoElement.textContent) {
            this._logoElement.setAttribute('data-text', this._logoElement.textContent);
            console.log(`[SM] Applied data-text for glitch animation: "${this._logoElement.textContent}"`);
        }
    },

    /** Applies preview size using CSS classes */
    _applyPreviewSize(sizeValue) {
        if (!this._previewContainer || !sizeValue) return;
        this._applyClass(this._previewContainer, sizeValue, PREVIEW_SIZE_CLASS_PREFIX);
        this._updateSizeIndicator(); // Size change might affect layout
    },

    // --- Complex State Handlers (Manage UI Visibility + Call Style Applicators) ---
    _handleColorModeChange(mode) {
        const isSolid = mode === 'solid';
        document.getElementById('solidColorPickerGroup')?.classList.toggle('hidden', !isSolid);
        document.getElementById('gradientPresetGroup')?.classList.toggle('hidden', isSolid);
        document.getElementById('customGradientControls')?.classList.toggle('hidden', isSolid || this._currentSettings.gradientPreset !== 'custom');
        if (isSolid) { 
            this._applySolidTextColor(this._currentSettings.solidColorPicker); 
        } else { 
            this._applyGradientToLogo(); 
        }
    },
    
    _handleGradientPresetChange(preset) {
        document.getElementById('customGradientControls')?.classList.toggle('hidden', preset !== 'custom');
        if (this._currentSettings.textColorMode === 'gradient') {
            this._applyGradientToLogo(); // Re-apply
        }
    },
    
    _handleBackgroundTypeChange(type) {
        if (!this._previewContainer) return;
        const isSolid = type === 'bg-solid'; 
        const isGradient = type.includes('gradient');
        
        document.getElementById('backgroundColorControl')?.classList.toggle('hidden', !isSolid);
        document.getElementById('backgroundGradientControls')?.classList.toggle('hidden', !isGradient);
        document.getElementById('customBackgroundGradient')?.classList.toggle('hidden', !isGradient || this._currentSettings.backgroundGradientPreset !== 'custom');

        this._previewContainer.style.backgroundImage = ''; 
        this._previewContainer.style.backgroundColor = '';
        this._previewContainer.style.opacity = '1'; // Reset opacity on type change
        
        document.getElementById('bgOpacity').value = '1'; 
        this._currentSettings.bgOpacity = '1';

        const classesToRemove = Array.from(this._previewContainer.classList).filter(cls => cls.startsWith(BACKGROUND_CLASS_PREFIX));
        this._previewContainer.classList.remove(...classesToRemove);
        this._previewContainer.classList.remove('bg-gradient-animated-css');

        this._previewContainer.classList.add(type);
        
        if (isSolid) { 
            this._applySolidBgColor(this._currentSettings.backgroundColor); 
        } else if (isGradient) { 
            this._applyBackgroundGradient(); 
            if (type === 'bg-gradient-animated') {
                this._previewContainer.classList.add('bg-gradient-animated-css'); 
            }
        } else if (type === 'bg-transparent') { 
            this._previewContainer.style.backgroundColor = 'transparent'; 
        }

        this._previewContainer.style.opacity = this._currentSettings.bgOpacity; // Re-apply opacity
    },
    
    _handleBackgroundGradientChange(presetValue) {
        document.getElementById('customBackgroundGradient')?.classList.toggle('hidden', presetValue !== 'custom');
        if (this._currentSettings.backgroundType?.includes('gradient')) {
            this._applyBackgroundGradient(); // Re-apply
        }
    },

    // --- Direct Style Setters ---
    _applySolidTextColor(color) {
        if (!this._logoElement) return;
        this._logoElement.style.backgroundImage = 'none';
        this._logoElement.style.backgroundClip = 'initial'; 
        this._logoElement.style.webkitBackgroundClip = 'initial';
        this._logoElement.style.color = color;
        this._logoElement.style.webkitTextFillColor = 'initial';
        console.log(`[SM] Applied solid text color: ${color}`);
    },
    
    _applySolidBgColor(color) {
         if (!this._previewContainer) return;
         this._previewContainer.style.backgroundColor = color;
         console.log(`[SM] Applied solid background color: ${color}`);
    },
    
    /**
     * Enhanced Gradient Application - Applies gradient to text
     * Improved error handling and fallback mechanisms
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
    
    /**
     * Enhanced Background Gradient Application
     * Improved error handling and fallback mechanisms
     */
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
         console.log(`[SM] Applied animation speed multiplier: ${speed}x (Duration: ${duration.toFixed(2)}s)`);
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

    /**
     * Applies settings to UI and visual elements
     * This is the primary method for updating the entire UI state
     */
    async applySettings(settings, forceUIUpdate = false, isInitialLoad = false) {
        console.log(`[SM] Applying settings (forceUI: ${forceUIUpdate}, initial: ${isInitialLoad})`);
        // Ensure settings object is valid, merge with defaults to guarantee all keys
        const settingsToApply = (typeof settings === 'object' && settings !== null) ? 
            { ...DEFAULT_SETTINGS, ...settings } : this._currentSettings;
        this._currentSettings = settingsToApply; // Update internal state *first*

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
                    if (element.type === 'checkbox') {
                        element.checked = newValueFormatted;
                    } else {
                        element.value = newValueFormatted;
                    }
                    // If forced update (like reset/random), dispatch an event AFTER setting value
                    // to trigger associated listeners (_bind* functions) for immediate style updates.
                    // Avoid dispatching on initial load to prevent redundant updates.
                    if (forceUIUpdate && !isInitialLoad) {
                        const eventType = (element.nodeName === 'SELECT' || element.type === 'checkbox' || element.type === 'color') ? 
                            'change' : 'input';
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

            // --- APPLY STYLES VIA CLASS HELPERS / VARS ---

            // Font Family & Weight (Uses Class Application) - MUST be async
            await this._applyFontFamily(this._currentSettings.fontFamily); // This also applies _applyFontWeight

            // Text Case & Align (Uses Class Application)
            this._applyTextCase(this._currentSettings.textCase);
            this._applyTextAlign(this._currentSettings.textAlign);

            // Styles controlled by CSS Variables
            document.documentElement.style.setProperty('--dynamic-font-size', `${this._currentSettings.fontSize}px`);
            document.documentElement.style.setProperty('--dynamic-letter-spacing', `${this._currentSettings.letterSpacing}em`);
            document.documentElement.style.setProperty('--dynamic-rotation', `${this._currentSettings.rotation}deg`);
            document.documentElement.style.setProperty('--dynamic-border-color', this._currentSettings.borderColorPicker);
            
            // Set border width and RGB value for effects
            document.documentElement.style.setProperty('--dynamic-border-width', `${this._currentSettings.borderWidth}px`);
            
            if (window.CSSUtils && typeof window.CSSUtils.extractRGB === 'function') {
                const rgbValue = window.CSSUtils.extractRGB(this._currentSettings.borderColorPicker);
                document.documentElement.style.setProperty('--dynamic-border-color-rgb', rgbValue);
            } else {
                // Fallback RGB extraction
                const rgbValue = this._extractColorRGB(this._currentSettings.borderColorPicker);
                document.documentElement.style.setProperty('--dynamic-border-color-rgb', rgbValue);
            }

            // Apply border padding (new feature)
            this._applyBorderPadding(this._currentSettings.borderPadding || '10');

            // Text/BG Gradient Directions (CSS Variables)
            document.documentElement.style.setProperty('--gradient-direction', `${this._currentSettings.animationDirection}deg`);
            document.documentElement.style.setProperty('--bg-gradient-direction', `${this._currentSettings.bgGradientDirection}deg`);

            // Animation Speed/Duration (CSS Variable via helper)
            this._applyAnimationSpeed(this._currentSettings.animationSpeed);

            // Effects & Borders (Uses Class Application with Mapping)
            this._applyTextEffect(this._currentSettings.textShadow); // Use mapped classes
            this._applyBorderStyle(this._currentSettings.borderStyle); // Use mapped classes
            
            // Apply border radius (new feature)
            this._applyBorderRadius(this._currentSettings.borderRadius || 'none');

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
    },

    _triggerSettingsUpdate() {
         this.saveCurrentSettings();
         this._listeners.forEach(l => {
             try {
                 l(this.getCurrentSettings());
             } catch(e) {
                 console.error('[SM] Error in settings listener:', e);
             }
         });
         
         // Use rAF for updates that read layout
         requestAnimationFrame(() => {
             this._updateSizeIndicator();
             this._updateCSSCode();
        });
    },
    
    _updateSizeIndicator() {
         const w = document.getElementById('logoWidth'); 
         const h = document.getElementById('logoHeight');
         
         if(!this._logoElement || !w || !h) return;
         
         try {
             const r = this._logoElement.getBoundingClientRect(); 
             if(r.width > 0) w.textContent = Math.round(r.width); 
             if(r.height > 0) h.textContent = Math.round(r.height);
         } catch(e) {
             console.error('[SM] Error updating size indicator:', e);
         }
    },
    
    _updateCSSCode() {
         const el = document.getElementById('cssCode'); 
         if(el) el.value = this._generateCSSCode();
    },
    
    /**
     * Generates CSS code that reflects the current styles
     * Enhanced to include border radius, padding, and improved class representation
     */
    _generateCSSCode() {
        console.log("[SM] Generating CSS Code (Updated with advanced styling v17)...");
        if (!this._logoElement || !this._previewContainer || !this._logoContainer) {
            return "/* Error: Missing core elements */";
        }
        
        try {
            let css = `:root {\n`;
            // Include essential CSS variables that are dynamically set
            const cssVars = [
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
                '--dynamic-border-padding'
            ];
            
            cssVars.forEach(v => {
                // Check inline style first, then computed style as fallback
                const val = document.documentElement.style.getPropertyValue(v) || 
                           getComputedStyle(document.documentElement).getPropertyValue(v);
                if (val && val.trim()) css += `  ${v}: ${val.trim()};\n`;
            });
            css += `}\n\n`;

            // --- Get applied classes accurately ---
            const getPrefixedClass = (element, prefix) => 
                Array.from(element.classList).find(c => c.startsWith(prefix));

            // Get all relevant container classes
            const containerClasses = Array.from(this._logoContainer.classList)
                .filter(c => c === 'dynamic-border' || 
                    c.startsWith(BORDER_STYLE_CLASS_PREFIX) || 
                    c.startsWith(BORDER_EFFECT_CLASS_PREFIX) ||
                    c.startsWith(BORDER_RADIUS_CLASS_PREFIX))
        .map(c => `.${c}`) // Add dot for CSS selector
        .join(''); // e.g., .dynamic-border.border-style-solid

    // Get all relevant text classes
    const textClasses = Array.from(this._logoElement.classList)
        .filter(c => c.startsWith(FONT_FAMILY_CLASS_PREFIX) || 
                   c.startsWith(FONT_WEIGHT_CLASS_PREFIX) ||
                   c.startsWith(TEXT_ALIGN_CLASS_PREFIX) || 
                   c.startsWith(TEXT_CASE_CLASS_PREFIX) ||
                   c.startsWith(TEXT_EFFECT_CLASS_PREFIX) || 
                   c.startsWith(ANIMATION_CLASS_PREFIX))
        .map(c => `.${c}`) // Add dot
        .join('');

    // Container CSS
    css += `.logo-container${containerClasses} { /* Container styles reflecting applied classes */\n`;
    css += `  /* Base positioning styles */\n`;
    css += `  position: relative;\n`;
    css += `  display: flex;\n`;
    css += `  align-items: center;\n`;
    css += `  justify-content: center;\n`;
    
    // Add padding if set
    const padding = document.documentElement.style.getPropertyValue('--dynamic-border-padding') || 
                   getComputedStyle(document.documentElement).getPropertyValue('--dynamic-border-padding');
    if (padding) {
        css += `  padding: ${padding};\n`;
    }
    
    // Add border radius if set
    const borderRadius = document.documentElement.style.getPropertyValue('--dynamic-border-radius') || 
                       getComputedStyle(document.documentElement).getPropertyValue('--dynamic-border-radius');
    if (borderRadius && borderRadius !== '0px' && borderRadius !== '0') {
        css += `  border-radius: ${borderRadius};\n`;
    }
    
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

    css += `  /* Essential text styles */\n`;
    css += `  line-height: 1.2;\n`;
    css += `  white-space: nowrap;\n`; // Add for consistent width calculations
    css += `}\n\n`;

    // Include relevant @keyframes if animation is active
    const animClass = getPrefixedClass(this._logoElement, ANIMATION_CLASS_PREFIX);
    if (animClass && animClass !== 'anim-none' && typeof getActiveAnimationKeyframes === 'function') {
        const keyframesCss = getActiveAnimationKeyframes(animClass.replace(ANIMATION_CLASS_PREFIX, ''));
        if (keyframesCss) css += keyframesCss + '\n\n';
    }

    // Include background class CSS definition (optional)
    const bgClass = Array.from(this._previewContainer.classList)
        .find(c => c.startsWith(BACKGROUND_CLASS_PREFIX));
        
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
const resetBtn = document.getElementById('resetBtn'); 
if (!resetBtn || resetBtn.dataset.listenerAttached) return;

const resetModal = document.getElementById('resetConfirmModal');
const cancelBtn = document.getElementById('resetModalCancel');
const confirmBtn = document.getElementById('resetModalConfirm');

if (!resetModal || !cancelBtn || !confirmBtn) { 
    console.warn('[SM] Reset modal elements missing.'); 
    return; 
}

const closeModal = () => {
    resetModal.style.display = 'none';
    resetModal.classList.remove('active');
};

resetBtn.onclick = () => {
    resetModal.style.display = 'flex';
    resetModal.classList.add('active');
};

cancelBtn.onclick = closeModal;

// Use arrow function to preserve 'this' context when calling resetSettings
confirmBtn.onclick = () => {
     const resetType = document.querySelector('input[name="reset-type"]:checked')?.value || 'all';
     this.resetSettings(resetType); // Call method on SettingsManager instance
     closeModal();
};

resetModal.onclick = (e) => {
    if (e.target === resetModal) closeModal();
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && resetModal.classList.contains('active')) closeModal();
});

resetBtn.dataset.listenerAttached = 'true'; // Mark as listener attached
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
        text: [
            'logoText', 'fontFamily', 'fontSize', 'letterSpacing', 
            'textCase', 'fontWeight'
        ],
        style: [
            'textColorMode', 'solidColorPicker', 'gradientPreset', 
            'color1', 'color2', 'useColor3', 'color3', 'textShadow', 
            'borderColorPicker', 'borderStyle', 'borderWidth', 'borderRadius', 
            'borderPadding', 'textAlign', 'rotation', 'animationDirection', 
            'textAnimation', 'animationSpeed'
        ], 
        background: [
            'backgroundType', 'backgroundColor', 'bgOpacity', 
            'backgroundGradientPreset', 'bgColor1', 'bgColor2', 'bgGradientDirection'
        ],
    };
    
    const keysToReset = keyMap[resetType] || Object.keys(defaults);
    keysToReset.forEach(key => {
        if (defaults.hasOwnProperty(key)) settingsToApply[key] = defaults[key];
    });
}

// Apply the determined settings and force UI update
this.applySettings(settingsToApply, true)
    .then(() => {
        console.log('[SM] Settings reset applied successfully.');
        if (typeof notifyResetSuccess === 'function') {
            notifyResetSuccess(resetType);
        } else if (typeof showToast === 'function') {
            showToast({message: `Settings Reset (${resetType})!`, type:'success'});
        }
    })
    .catch(err => {
        console.error("[SM] Error applying reset settings:", err);
        if (typeof showAlert === 'function') {
            showAlert("Failed to apply reset settings.", "error");
        }
    });
},

loadSavedSettings() {
try {
    const saved = localStorage.getItem('logomakerSettings');
    if (saved) {
        const loadedSettings = JSON.parse(saved);
        
        // Check for new properties added since the last version
        // This ensures old saved settings work with new features
        const defaults = this.getDefaults();
        const mergedSettings = { 
            ...defaults, 
            ...loadedSettings,
            // Force these new border properties if missing in old saved settings
            borderRadius: loadedSettings.borderRadius || defaults.borderRadius,
            borderPadding: loadedSettings.borderPadding || defaults.borderPadding,
            borderWidth: loadedSettings.borderWidth || defaults.borderWidth
        };
        
        this._currentSettings = mergedSettings;
        
        // Font check needs to happen AFTER font dropdown is populated by fontManager
        setTimeout(() => {
            const fontDropdown = document.getElementById('fontFamily');
            const savedFont = this._currentSettings.fontFamily;
            if (fontDropdown && !fontDropdown.querySelector(`option[value="${savedFont}"]`)) {
                 console.warn(`[SM] Saved font '${savedFont}' not in dropdown. Reverting to default '${DEFAULT_SETTINGS.fontFamily}'.`);
                 this._currentSettings.fontFamily = DEFAULT_SETTINGS.fontFamily;
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
    if(typeof showAlert === 'function') {
        showAlert('Failed to load saved settings. Using defaults.', 'warning');
    }
}
},

saveCurrentSettings() {
 try { 
     localStorage.setItem('logomakerSettings', JSON.stringify(this._currentSettings)); 
 } catch (err) { 
     console.error('[SM] Error saving settings:', err); 
 }
},

addSettingsChangeListener(listener) { 
if (typeof listener === 'function') this._listeners.push(listener); 
},

removeSettingsChangeListener(listener) { 
this._listeners = this._listeners.filter(l => l !== listener); 
},

}; // End of SettingsManager object literal

export default SettingsManager; // Export the SettingsManager object for use in other modules