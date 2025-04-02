/**
 * settingsManager.js (Version 11 - Inject Font Style)
 * ====================================================
 * Manages UI state, applies styles, handles settings persistence,
 * and dynamically injects @font-face rules for selected fonts.
 */
import { initializeFonts } from './fontManager.js';
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
    gradientPreset: 'primary-gradient',
    color1: '#FF1493',
    color2: '#8A2BE2',
    useColor3: false,
    color3: '#FF4500',
    textShadow: 'text-glow-none',
    borderColorPicker: '#ffffff',
    borderStyle: 'border-none',
    textAlign: 'center',
    rotation: '0',
    textAnimation: 'anim-none',
    animationSpeed: '1',
    animationDirection: '45', // Controls text gradient direction
    backgroundType: 'bg-solid',
    backgroundColor: '#000000',
    bgOpacity: '1',
    backgroundGradientPreset: 'primary-gradient',
    bgColor1: '#3a1c71',
    bgColor2: '#ffaf7b',
    bgGradientDirection: '90',
    previewSize: 'preview-size-medium', // Ensure value matches class prefix logic
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

    async init() {
        if (this._isInitialized) { console.warn("[SM] Already initialized."); return; }
        console.log('[SM] Initialize...');
        if (typeof showAlert === 'undefined') { window.showAlert = (msg, type='log')=>console[type](msg); }
        if (typeof notifyResetSuccess === 'undefined') { window.notifyResetSuccess = (type) => showAlert('Settings Reset!', 'success'); }

        try {
            console.log('[SM] Waiting for Font Manager...');
            const fontsReady = await initializeFonts(); // Wait for fonts
            if (!fontsReady) { console.error('[SM] Font Manager failed. Proceeding cautiously.'); }
            else { console.log('[SM] Font Manager ready.'); }

            this.loadSavedSettings();
            this._setupEventListeners();

            console.log('[SM] Applying initial/loaded settings...');
            await this.applySettings(this._currentSettings, true, true); // Await initial apply settings
            this._initializeUIComponents();

            this._isInitialized = true;
            console.log('[SM] Initialization complete.');

        } catch (error) {
            console.error("[SM] Initialization failed:", error);
            if(typeof showAlert === 'function') showAlert(`Settings Manager init failed: ${error.message || 'Unknown error'}`, 'error');
        }
    },
    /**
     * Bind event listeners to UI controls.
     */
    _setupEventListeners() {
        console.log('[SettingsManager] Setup event listeners...');
        if (!document.getElementById('logoText')) {
            console.error("[SettingsManager] Cannot find core controls. Aborting listener setup.");
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
        this._bindColorInputListener('borderColorPicker');
        this._bindSelectListener('borderStyle');
        this._bindSelectListener('textAlign');
        this._bindRangeInputListener('rotation', 'transform', 'deg');
        this._bindSelectListener('textAnimation');
        this._bindRangeInputListener('animationSpeed');
        this._bindSelectListener('backgroundType');
        this._bindColorInputListener('backgroundColor');
        this._bindRangeInputListener('bgOpacity');
        this._bindSelectListener('backgroundGradientPreset');
        this._bindColorInputListener('bgColor1');
        this._bindColorInputListener('bgColor2');
        this._bindRangeInputListener('bgGradientDirection');
        this._bindSelectListener('previewSize');
        this._bindNumberInputListener('exportWidth');
        this._bindNumberInputListener('exportHeight');
        this._bindRangeInputListener('exportQuality');
        this._bindCheckboxListener('exportTransparent');
        this._bindNumberInputListener('exportFrames');
        this._bindRangeInputListener('exportFrameRate');
        console.log('[SettingsManager] Event listeners setup done.');
    },

    // --- Binder Functions ---

    _bindInputListener(inputId, settingKeyOrTargetProp) {
        const input = document.getElementById(inputId); if (!input) return;
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this._currentSettings[inputId] = value;
            if (settingKeyOrTargetProp === 'textContent') {
                const logoEl = document.querySelector('.logo-text');
                if (logoEl) {
                    logoEl.textContent = value;
                    logoEl.setAttribute('data-text', value);
                }
                this._updateSizeIndicator();
            }
            this._triggerSettingsUpdate();
        });
    },

    _bindSelectListener(selectId) {
        const select = document.getElementById(selectId); if (!select) { console.warn(`Select element #${selectId} not found.`); return;}
        select.addEventListener('change', (e) => {
            const value = e.target.value;
            // console.log(`[SettingsManager] Select Change: #${selectId} = ${value}`); // Keep for debugging if needed
            this._currentSettings[selectId] = value;
            const logoElement = document.querySelector('.logo-text');
            const previewContainer = document.getElementById('previewContainer'); // Needed for previewSize
            const dynamicBorderElement = document.querySelector('.dynamic-border'); // Needed for borderStyle

            if (!logoElement) return;

            // Apply specific style changes or class updates
            switch(selectId) {
                case 'fontFamily':
                    logoElement.style.fontFamily = `"${value}", sans-serif`; // Apply style first
                    console.log(`[SettingsManager] Applied Style: logoElement.style.fontFamily = "${value}"`);
                    this._injectFontStyle(value); // Inject the @font-face rule
                    this._updateFontPreview(value); // Update small preview span
                    // Optional: Log computed style after a tick to verify application
                    // setTimeout(() => console.log(`[SettingsManager] Computed Style After Apply: ${getComputedStyle(logoElement).fontFamily}`), 0);
                    break;
                case 'textCase': logoElement.style.textTransform = value; break;
                case 'fontWeight': logoElement.style.fontWeight = value; break;
                case 'textAlign': logoElement.style.textAlign = value; break; // Applied to logo-text
                case 'textColorMode': this._handleColorModeChange(value); break;
                case 'gradientPreset': this._handleGradientPresetChange(value); break;
                case 'textShadow': this._applyClassFromSelect('.logo-text', value, 'text-glow-'); break;
                case 'borderStyle': this._applyClassFromSelect('.dynamic-border', value, 'border-'); break;
                case 'textAnimation': this._applyClassFromSelect('.logo-text', value, 'anim-'); break;
                case 'backgroundType': this._handleBackgroundTypeChange(value); break;
                case 'previewSize': this._applyClassFromSelect('#previewContainer', value, 'preview-size-'); break;
                case 'backgroundGradientPreset': this._handleBackgroundGradientChange(value); break;
                default: console.warn(`Unhandled select change: #${selectId}`);
            }
            this._triggerSettingsUpdate(); // Save and notify listeners
        });
    },

     _bindNumberInputListener(inputId, styleProperty = null, unit = '') {
         const input = document.getElementById(inputId); if (!input) return;
         input.addEventListener('input', (e) => {
             const value = e.target.value;
             this._currentSettings[inputId] = value;
             if (styleProperty === 'fontSize') {
                 const logoEl = document.querySelector('.logo-text');
                 if (logoEl) logoEl.style.fontSize = `${value}${unit}`;
                 this._updateSizeIndicator(); // Font size affects dimensions
             }
             // Other number inputs (like export dimensions) don't directly affect live preview style
             this._triggerSettingsUpdate();
         });
     },

    _bindRangeInputListener(inputId, styleProperty = null, unit = '') {
        const input = document.getElementById(inputId); if (!input) return;
        const display = input.parentElement?.querySelector('.range-value-display');

        const updateDisplay = (value) => {
            if(display) { display.textContent = value + unit; }
        };

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this._currentSettings[inputId] = value;
            updateDisplay(value);
            const logoElement = document.querySelector('.logo-text');
            const previewContainer = document.getElementById('previewContainer');

            switch (inputId) {
                case 'letterSpacing': if (logoElement) logoElement.style.letterSpacing = `${value}em`; break;
                case 'rotation': if (logoElement) logoElement.style.transform = `rotate(${value}deg)`; break;
                case 'animationSpeed': const duration = 2 / parseFloat(value || 1); document.documentElement.style.setProperty('--animation-duration', `${Math.max(0.1, duration)}s`); break;
                case 'animationDirection': document.documentElement.style.setProperty('--gradient-direction', `${value}deg`); if (this._currentSettings.textColorMode === 'gradient') { this._applyGradientToLogo(); } break;
                case 'bgOpacity': if (previewContainer) previewContainer.style.opacity = value; break;
                case 'bgGradientDirection': document.documentElement.style.setProperty('--bg-gradient-direction', `${value}deg`); if (this._currentSettings.backgroundType?.includes('gradient')) { this._applyBackgroundGradient(); } break;
                case 'exportFrameRate': /* Display only - handled by GIF Exporter UI */ break;
                case 'exportQuality': /* No live update needed */ break;
                default: console.warn(`Unhandled range: #${inputId}`);
            }
            this._triggerSettingsUpdate();
        });
         // Initialize display on load (should be handled by applySettings)
         // updateDisplay(input.value);
    },

     _bindCheckboxListener(checkboxId) {
         const checkbox = document.getElementById(checkboxId); if (!checkbox) return;
         checkbox.addEventListener('change', (e) => {
             const isChecked = e.target.checked;
             this._currentSettings[checkboxId] = isChecked;
             if (checkboxId === 'useColor3') {
                 const color3Control = document.getElementById('color3Control');
                 if (color3Control) color3Control.classList.toggle('hidden', !isChecked);
                 this._applyGradientToLogo(); // Re-apply gradient if color count changes
             }
             // exportTransparent has no direct live effect
             this._triggerSettingsUpdate();
         });
     },

    _bindColorInputListener(inputId) {
        const input = document.getElementById(inputId); if (!input) return;
        // Use 'input' for live updates as the user drags the color picker
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this._currentSettings[inputId] = value;
            switch (inputId) {
                case 'solidColorPicker': if (this._currentSettings.textColorMode === 'solid') { const el = document.querySelector('.logo-text'); if (el) el.style.color = value; } break;
                case 'color1': case 'color2': case 'color3': if (this._currentSettings.textColorMode === 'gradient') { this._applyGradientToLogo(); } break;
                case 'borderColorPicker': document.documentElement.style.setProperty('--dynamic-border-color', value); break;
                case 'backgroundColor': const pc = document.getElementById('previewContainer'); if (pc && this._currentSettings.backgroundType === 'bg-solid') { pc.style.backgroundColor = value; } break;
                case 'bgColor1': case 'bgColor2': if (this._currentSettings.backgroundType?.includes('gradient')) { this._applyBackgroundGradient(); } break;
            }
            this._triggerSettingsUpdate();
        });
    },

    // --- Specific Handlers ---

    _handleColorModeChange(mode) {
        const solidGroup = document.getElementById('solidColorPickerGroup');
        const presetSelect = document.getElementById('gradientPreset');
        const customGroup = document.getElementById('customGradientControls');
        const logoEl = document.querySelector('.logo-text');
        const presetGroup = presetSelect?.parentElement; // The control-group containing the preset select

        if (!solidGroup || !presetGroup || !customGroup || !logoEl) { console.warn("Missing elements for color mode change."); return; }
        const isSolid = mode === 'solid';

        solidGroup.classList.toggle('hidden', !isSolid);
        presetGroup.classList.toggle('hidden', isSolid);
        customGroup.classList.toggle('hidden', isSolid || presetSelect.value !== 'custom');

        if (isSolid) {
            const solidColor = document.getElementById('solidColorPicker')?.value || '#ffffff';
            logoEl.style.backgroundImage = 'none'; // Remove gradient
            logoEl.style.backgroundClip = 'initial'; // Reset clipping
            logoEl.style.webkitBackgroundClip = 'initial';
            logoEl.style.color = solidColor; // Apply solid color
            logoEl.style.webkitTextFillColor = 'initial'; // Reset fill color override
        } else { // Mode is 'gradient'
            this._applyGradientToLogo(); // Apply gradient styles
        }
    },

    _handleGradientPresetChange(preset) {
        const customControls = document.getElementById('customGradientControls');
        if (customControls) customControls.classList.toggle('hidden', preset !== 'custom');
        this._applyGradientToLogo(); // Re-apply gradient based on new preset
    },

    _applyGradientToLogo() {
        const logoEl = document.querySelector('.logo-text');
        const presetSelect = document.getElementById('gradientPreset');
        const directionInput = document.getElementById('animationDirection'); // Text gradient direction
        if (!logoEl || !presetSelect || !directionInput || this._currentSettings.textColorMode !== 'gradient') return;

        let gradient = '';
        const direction = directionInput.value || '45';
        const preset = presetSelect.value;

        if (preset === 'custom') {
            const c1 = document.getElementById('color1')?.value || '#FF1493';
            const c2 = document.getElementById('color2')?.value || '#8A2BE2';
            const useC3 = document.getElementById('useColor3')?.checked;
            const c3 = document.getElementById('color3')?.value || '#FF4500';
            gradient = useC3 ? `linear-gradient(${direction}deg, ${c1}, ${c2}, ${c3})` : `linear-gradient(${direction}deg, ${c1}, ${c2})`;
        } else {
            // Get the gradient definition from CSS variable
            const presetVar = getComputedStyle(document.documentElement).getPropertyValue(`--${preset}`).trim();
            // Reconstruct with current direction
            if (presetVar?.startsWith('linear-gradient')) {
                gradient = presetVar.replace(/linear-gradient\(([^,]+),/, `linear-gradient(${direction}deg,`);
            } else {
                gradient = `linear-gradient(${direction}deg, #FF1493, #8A2BE2)`; // Fallback if var is invalid
            }
        }
        // Apply styles for gradient text
        logoEl.style.backgroundImage = gradient;
        logoEl.style.webkitBackgroundClip = 'text';
        logoEl.style.backgroundClip = 'text';
        logoEl.style.color = 'transparent'; // Hide base color
        logoEl.style.webkitTextFillColor = 'transparent'; // Override for webkit
    },

    _handleBackgroundTypeChange(type) {
        const previewContainer = document.getElementById('previewContainer');
        const bgColorControl = document.getElementById('backgroundColorControl');
        const bgGradientControls = document.getElementById('backgroundGradientControls');
        const customBgGradientControls = document.getElementById('customBackgroundGradient');
        const bgPresetSelect = document.getElementById('backgroundGradientPreset');
        if (!previewContainer || !bgColorControl || !bgGradientControls || !customBgGradientControls || !bgPresetSelect) { console.warn("Missing elements for background type change."); return; }

        const isSolid = type === 'bg-solid';
        const isGradient = type === 'bg-gradient' || type === 'bg-gradient-animated';

        // Toggle control visibility
        bgColorControl.classList.toggle('hidden', !isSolid);
        bgGradientControls.classList.toggle('hidden', !isGradient);
        // Show custom BG gradient controls only if gradient type is selected AND 'custom' preset is chosen
        customBgGradientControls.classList.toggle('hidden', !isGradient || bgPresetSelect.value !== 'custom');

        // Apply styles and classes
        const classList = previewContainer.classList;
        // Remove previous background classes
        for (let i = classList.length - 1; i >= 0; i--) { if (classList[i].startsWith('bg-')) classList.remove(classList[i]); }

        // Clear inline styles first
        previewContainer.style.backgroundColor = '';
        previewContainer.style.backgroundImage = '';
        previewContainer.classList.remove('bg-gradient-animated-css'); // Remove animation class specifically

        if (isSolid) {
            classList.add('bg-solid');
            previewContainer.style.backgroundColor = document.getElementById('backgroundColor')?.value || '#000000';
        } else if (isGradient) {
            // Add the appropriate base class (needed if patterns rely on it?)
            // classList.add('bg-gradient'); // Or maybe no base class is needed, just the style
            this._applyBackgroundGradient(); // Apply the gradient via style.backgroundImage
            if (type === 'bg-gradient-animated') {
                previewContainer.classList.add('bg-gradient-animated-css'); // Add class for CSS animation
            }
        } else if (type && type !== 'bg-transparent') { // For patterns like bg-grid, bg-stars etc.
            classList.add(type); // Add the specific class (e.g., 'bg-grid')
        } else { // bg-transparent
            // No class needed, ensure background is transparent
            previewContainer.style.backgroundColor = 'transparent';
        }
        // console.log(`[SettingsManager] Background type set to: ${type}`);
    },

    _handleBackgroundGradientChange(presetValue) {
        const customBgGroup = document.getElementById('customBackgroundGradient');
        if (customBgGroup) customBgGroup.classList.toggle('hidden', presetValue !== 'custom');
        this._applyBackgroundGradient(); // Re-apply gradient when preset changes
    },

    _applyBackgroundGradient() {
        const previewContainer = document.getElementById('previewContainer');
        const presetSelect = document.getElementById('backgroundGradientPreset');
        const directionInput = document.getElementById('bgGradientDirection');
        if (!previewContainer || !presetSelect || !directionInput) return;
        const currentBgType = this._currentSettings.backgroundType;
        // Only apply if a gradient type is selected
        if (currentBgType !== 'bg-gradient' && currentBgType !== 'bg-gradient-animated') return;

        let gradient = '';
        const direction = directionInput.value || '90';
        const preset = presetSelect.value;

        if (preset === 'custom') {
            const c1 = document.getElementById('bgColor1')?.value || '#3a1c71';
            const c2 = document.getElementById('bgColor2')?.value || '#ffaf7b';
            gradient = `linear-gradient(${direction}deg, ${c1}, ${c2})`;
        } else {
            const rootStyle = getComputedStyle(document.documentElement);
            const presetVar = rootStyle.getPropertyValue(`--${preset}`).trim();
             if (presetVar?.startsWith('linear-gradient')) {
                 // Reconstruct with current direction
                 gradient = presetVar.replace(/linear-gradient\(([^,]+),/, `linear-gradient(${direction}deg,`);
             } else { gradient = `linear-gradient(${direction}deg, #3a1c71, #ffaf7b)`; } // Fallback
        }
        previewContainer.style.backgroundImage = gradient; // Apply directly
    },

    _applyClassFromSelect(targetSelector, className, classPrefix = null) {
        const targetElement = document.querySelector(targetSelector); if (!targetElement) return;
        if (classPrefix) {
             // Remove existing classes with the same prefix more robustly
             const classesToRemove = Array.from(targetElement.classList).filter(cls => cls.startsWith(classPrefix));
             if(classesToRemove.length > 0) targetElement.classList.remove(...classesToRemove);
         }
        // Add the new class if it's not a "none" class or empty
        if (className && (!classPrefix || !className.endsWith('-none'))) {
            targetElement.classList.add(className);
        }
    },

    /** Injects @font-face */
    async _injectFontStyle(fontFamilyName, isInitial = false) {
        // console.log(`[SM] Injecting font: ${fontFamilyName} (Initial: ${isInitial})`); // Verbose log
        let dynamicStyleElement = document.getElementById('dynamic-font-style'); let attempt = 0; const maxAttempts = 5, retryDelay = 50; // Faster retry
        while (!dynamicStyleElement && isInitial && attempt < maxAttempts) { attempt++; console.warn(`[SM] #dynamic-font-style attempt ${attempt}...`); await new Promise(r => setTimeout(r, retryDelay)); dynamicStyleElement = document.getElementById('dynamic-font-style'); }
        if (!dynamicStyleElement) { console.error("[SM] #dynamic-font-style missing!"); if(!window._dynFontAlertShown && typeof showAlert==='function'){showAlert('Font system init error.','error'); window._dynFontAlertShown=true;} return; }
        const fontDataGlobal = window._INLINE_FONTS_DATA; if (!Array.isArray(fontDataGlobal) || !fontFamilyName) { dynamicStyleElement.textContent='/* Font data invalid */'; return; }
        const targetL = fontFamilyName.toLowerCase(); const family = fontDataGlobal.find(f=>f.familyName?.toLowerCase()===targetL||f.displayName?.toLowerCase()===targetL); if (!family?.variants?.length) { dynamicStyleElement.textContent=`/* Font ${fontFamilyName} not found */`; return; }
        let bestMatch=family.variants.find(v=>v.file?.startsWith('data:')&&String(v.weight||400)===String(this._currentSettings.fontWeight||400)&&(v.style||'normal')==='normal'); if (!bestMatch) bestMatch = family.variants.find(v => v.file?.startsWith('data:') && String(v.weight||400)==='400' && (v.style||'normal')==='normal'); if (!bestMatch) bestMatch = family.variants.find(v => v.file?.startsWith('data:'));
        if (bestMatch) { let rule=`/* Font: ${family.displayName} */\n@font-face{font-family:"${family.familyName}";src:url(${bestMatch.file}) format("${bestMatch.format||'woff2'}");font-weight:${bestMatch.weight||400};font-style:${bestMatch.style||'normal'};}`; dynamicStyleElement.textContent=rule; void document.body.offsetHeight; /* Force reflow */ console.log(`[SM] Injected ${family.familyName}`); }
        else { dynamicStyleElement.textContent=`/* No Base64 for ${fontFamilyName} */`; console.warn(`[SM] No Base64 for ${fontFamilyName}.`); }
    },

    // --- Core Methods ---
    _triggerSettingsUpdate() {
        this.saveCurrentSettings(); // Save on every change
        this._listeners.forEach(listener => listener(this._currentSettings));
        this._updateSizeIndicator();
        this._updateCSSCode();
    },

    _updateSizeIndicator() {
        const logoEl = document.querySelector('.logo-text');
        const widthIndicator = document.getElementById('logoWidth');
        const heightIndicator = document.getElementById('logoHeight');
        if (!logoEl || !widthIndicator || !heightIndicator) return;
        // Delay slightly to allow browser layout engine to catch up after style changes
        setTimeout(() => {
            const rect = logoEl.getBoundingClientRect();
            widthIndicator.textContent = Math.round(rect.width);
            heightIndicator.textContent = Math.round(rect.height);
        }, 60); // ~1 frame delay might be enough
    },

    _updateCSSCode() {
        const cssCodeArea = document.getElementById('cssCode');
        if(cssCodeArea) {
            cssCodeArea.value = this._generateCSSCode();
        }
    },

    _generateCSSCode() {
        // console.log("[SettingsManager] Generating CSS Code..."); // Keep for debugging
        const logoElement = document.querySelector('.logo-text');
        const previewContainer = document.getElementById('previewContainer');
        const borderElement = document.querySelector('.dynamic-border');
        if (!logoElement || !previewContainer || !borderElement) return '// Error: Missing required elements for CSS generation';

        try {
            const logoStyle = window.getComputedStyle(logoElement);
            const containerStyle = window.getComputedStyle(previewContainer);
            const borderComputedStyle = window.getComputedStyle(borderElement);
            const rootStyle = window.getComputedStyle(document.documentElement);
            const cssVars = ['--primary-gradient','--cyberpunk-gradient','--sunset-gradient','--ocean-gradient','--animation-duration','--gradient-direction','--dynamic-border-color', '--bg-gradient-direction'];

            let css = `:root {\n`;
            cssVars.forEach(varName => { const value = rootStyle.getPropertyValue(varName).trim(); if (value) css += `  ${varName}: ${value};\n`; });
            css += `}\n\n`;

            // Container Styles
            css += `.logo-container { /* Basic container styles */\n  display:flex; justify-content:center; align-items:center; width:100%; min-height:300px;\n`;
            const bgTypeSetting = this._currentSettings.backgroundType || 'bg-solid';
            if (bgTypeSetting === 'bg-solid') {
                css += `  background-color: ${this._currentSettings.backgroundColor || '#000000'};\n`;
            } else if (bgTypeSetting.includes('gradient')) {
                 const appliedBgImage = previewContainer.style.backgroundImage; // Use inline style if set
                 if (appliedBgImage && appliedBgImage !== 'none') { css += `  background-image: ${appliedBgImage};\n`; }
                 else if (containerStyle.backgroundImage !== 'none') { css += `  background-image: ${containerStyle.backgroundImage};\n`; } // Fallback to computed
            } else if (bgTypeSetting !== 'bg-transparent') {
                 css += `  /* Background applied via CSS class: ${bgTypeSetting} */\n`;
                 css += `  background-color: ${containerStyle.backgroundColor}; /* May need adjustment based on class */\n`;
            } else { css += `  background-color: transparent;\n`; }
            if (containerStyle.opacity !== '1') css += `  opacity: ${containerStyle.opacity};\n`;
            css += `}\n\n`;

            // Logo Text Styles - use computed styles primarily for visual accuracy
            css += `.logo-text {\n`;
            const primaryFontFamily = logoStyle.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
            css += `  font-family: "${primaryFontFamily}", sans-serif;\n`;
            css += `  font-size: ${logoStyle.fontSize};\n`;
            css += `  font-weight: ${logoStyle.fontWeight};\n`;
            if(logoStyle.letterSpacing !== 'normal') css += `  letter-spacing: ${logoStyle.letterSpacing};\n`;
            if(logoStyle.textTransform !== 'none') css += `  text-transform: ${logoStyle.textTransform};\n`; // Use computed for final state
            css += `  text-align: ${logoStyle.textAlign};\n`;
             // Color/Gradient Handling - Check current setting mode
            if (this._currentSettings.textColorMode === 'gradient') {
                const currentGradient = logoElement.style.backgroundImage || logoStyle.backgroundImage; // Prioritize inline style
                if (currentGradient && currentGradient !== 'none') { css += `  background-image: ${currentGradient};\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;\n  -webkit-text-fill-color: transparent;\n`; }
                else { css += `  color: #FFFFFF; /* Fallback if gradient fails */\n`; }
            } else { css += `  color: ${logoStyle.color};\n`; } // Use computed color for solid

            if (logoStyle.textShadow && logoStyle.textShadow !== 'none') css += `  text-shadow: ${logoStyle.textShadow};\n`;

            // Border - Check computed style of the border element
             const borderStyleValue = borderComputedStyle.borderTopStyle; // Check one side
             if (borderStyleValue && borderStyleValue !== 'none') {
                 css += `  border-style: ${borderStyleValue};\n`;
                 css += `  border-width: ${borderComputedStyle.borderTopWidth};\n`;
                 // Use var() function for dynamic color referencing the CSS variable
                 css += `  border-color: var(--dynamic-border-color, ${this._currentSettings.borderColorPicker || '#fff'});\n`;
             }

            if (logoStyle.transform && logoStyle.transform !== 'none') css += `  transform: ${logoStyle.transform};\n`;
            // Animation - check computed style
            if (logoStyle.animationName && logoStyle.animationName !== 'none') {
                css += `  animation-name: ${logoStyle.animationName};\n`;
                css += `  animation-duration: ${logoStyle.animationDuration};\n`;
                css += `  animation-timing-function: ${logoStyle.animationTimingFunction};\n`;
                css += `  animation-iteration-count: ${logoStyle.animationIterationCount};\n`;
            }
            css += `}\n\n`;
            // TODO: Include actual @keyframes definitions based on computed animationName if needed

            return css;
       } catch (e) { console.error("Error generating CSS:", e); return `/* Error generating CSS: ${e.message} */`; }
   },

    _initializeUIComponents() {
        this._setupResetButton();
        this._updateFontPreview(this._currentSettings.fontFamily);
        this._updateRangeValueDisplays(); // Update displays for all ranges
    },

    _updateFontPreview(font) {
        const previewSpan = document.getElementById("fontPreview");
        if(previewSpan && font) {
            // Use the actual font family name for the preview span style
             previewSpan.style.fontFamily = `"${font}", sans-serif`;
        }
    },

    _setupResetButton() {
        const resetBtn = document.getElementById('resetBtn'); if (!resetBtn) return;
        const resetConfirmModal = document.getElementById('resetConfirmModal');
        const resetModalCancel = document.getElementById('resetModalCancel');
        const resetModalConfirm = document.getElementById('resetModalConfirm');
        if (!resetConfirmModal || !resetModalCancel || !resetModalConfirm) return;

        resetBtn.addEventListener('click', () => { resetConfirmModal.classList.add('active'); });
        resetModalCancel.addEventListener('click', () => { resetConfirmModal.classList.remove('active'); });
        resetModalConfirm.addEventListener('click', () => {
            const resetType = document.querySelector('input[name="reset-type"]:checked')?.value || 'all';
            this.resetSettings(resetType); // Call internal reset method
            resetConfirmModal.classList.remove('active');
        });
        resetConfirmModal.addEventListener('click', e => { if (e.target === resetConfirmModal) resetConfirmModal.classList.remove('active'); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && resetConfirmModal.classList.contains('active')) resetConfirmModal.classList.remove('active'); });
    },

    resetSettings(resetType = 'all') {
        console.log(`[SettingsManager] Resetting: ${resetType}`);
        const defaults = { ...DEFAULT_SETTINGS };
        let settingsToApply;

        // Define keys for easier management
        const textKeys = ['logoText', 'fontFamily', 'fontSize', 'letterSpacing', 'textCase', 'fontWeight'];
        const styleKeys = ['textColorMode', 'solidColorPicker', 'gradientPreset', 'color1', 'color2', 'useColor3', 'color3', 'textShadow', 'borderColorPicker', 'borderStyle', 'textAlign', 'rotation']; // Style only
        const animationKeys = ['textAnimation', 'animationSpeed', 'animationDirection']; // Animation only (Note: animationDirection controls text gradient)
        const backgroundKeys = ['backgroundType', 'backgroundColor', 'bgOpacity', 'backgroundGradientPreset', 'bgColor1', 'bgColor2', 'bgGradientDirection']; // Background only
        const advancedKeys = ['previewSize', 'exportWidth', 'exportHeight', 'exportQuality', 'exportTransparent', 'exportFrames', 'exportFrameRate']; // Advanced only

        if (resetType === 'all') {
            settingsToApply = { ...defaults };
        } else {
            // Start with current settings and overwrite specific groups
            settingsToApply = { ...this._currentSettings };
            if (resetType === 'text') {
                textKeys.forEach(key => settingsToApply[key] = defaults[key]);
            } else if (resetType === 'style') {
                styleKeys.forEach(key => settingsToApply[key] = defaults[key]);
                 // Also reset relevant parts of animation/background that affect visual style directly
                 animationKeys.forEach(key => settingsToApply[key] = defaults[key]);
                 backgroundKeys.forEach(key => settingsToApply[key] = defaults[key]);
            }
             // Add cases for resetting animation, background, advanced if needed
        }

        this.applySettings(settingsToApply, true); // Apply and force UI update
        // Use the globally defined notification function
        notifyResetSuccess(resetType); // Assumes notifyResetSuccess is globally available
    },

    /** Apply settings object to UI */
    async applySettings(settings, forceUIUpdate = false, isInitialLoad = false) { // Make async for await
        console.log(`[SM] Applying settings (forceUI: ${forceUIUpdate}, initial: ${isInitialLoad})`);
        const settingsToApply = typeof settings === 'object' && settings !== null ? settings : this._currentSettings;
        this._currentSettings = { ...DEFAULT_SETTINGS, ...settingsToApply };

        // Update control values
        Object.entries(this._currentSettings).forEach(([key, value]) => {
            const element = document.getElementById(key); if (!element) return;
            try { const cV=(element.type==='checkbox')?element.checked:element.value; const nV=(element.type==='checkbox')?!!value:String(value??''); if(forceUIUpdate||isInitialLoad){ if(String(cV)!==nV||isInitialLoad){ if(element.type==='checkbox'){element.checked=nV;}else{element.value=nV;} if(forceUIUpdate&&!isInitialLoad){ const eT=(element.nodeName==='SELECT'||element.type==='checkbox'||element.type==='color')?'change':'input'; element.dispatchEvent(new Event(eT,{bubbles:true}));}}}}
            catch (e) { console.warn(`[SM] Error applying UI for ${key}:`, e); }
        });

        // Explicitly set initial visual state IF initial load
        if (isInitialLoad) {
            console.log('[SM] Setting initial visual states...');
            const logoEl = document.querySelector('.logo-text');
            const fontSelect = document.getElementById('fontFamily');
            if(logoEl && this._currentSettings.logoText !== undefined) { logoEl.textContent = this._currentSettings.logoText; logoEl.setAttribute('data-text', this._currentSettings.logoText); console.log(`[SM] Initial text set.`);}
            if(fontSelect && this._currentSettings.fontFamily) {
                // *** Add small delay/rAF before setting dropdown value ***
                await new Promise(resolve => requestAnimationFrame(resolve)); // Wait one frame
                // await new Promise(resolve => setTimeout(resolve, 10)); // Alternative: tiny timeout

                if (fontSelect.querySelector(`option[value="${this._currentSettings.fontFamily}"]`)) { fontSelect.value = this._currentSettings.fontFamily; console.log(`[SM] Initial font DDL set: ${fontSelect.value}`); this._updateFontPreview(fontSelect.value); }
                else { if(fontSelect.options.length>0){ fontSelect.selectedIndex=0; this._currentSettings.fontFamily = fontSelect.value; console.warn(`[SM] Initial font fallback: ${fontSelect.value}`); this._updateFontPreview(fontSelect.value); } else {console.error("[SM] Font DDL empty!");}}
            }
            // Trigger handlers manually
            this._handleColorModeChange(this._currentSettings.textColorMode); this._handleGradientPresetChange(this._currentSettings.gradientPreset); this._handleBackgroundTypeChange(this._currentSettings.backgroundType); this._handleBackgroundGradientChange(this._currentSettings.backgroundGradientPreset); this._applyClassFromSelect('.logo-text', this._currentSettings.textShadow, 'text-glow-'); this._applyClassFromSelect('.dynamic-border', this._currentSettings.borderStyle, 'border-'); this._applyClassFromSelect('.logo-text', this._currentSettings.textAnimation, 'anim-'); this._applyClassFromSelect('#previewContainer', this._currentSettings.previewSize, 'preview-size-');
            // Apply initial styles
            if(logoEl) { logoEl.style.fontSize=`${this._currentSettings.fontSize}px`; logoEl.style.letterSpacing=`${this._currentSettings.letterSpacing}em`; logoEl.style.textTransform=this._currentSettings.textCase; logoEl.style.fontWeight=this._currentSettings.fontWeight; logoEl.style.textAlign=this._currentSettings.textAlign; logoEl.style.transform=`rotate(${this._currentSettings.rotation}deg)`; }
            document.documentElement.style.setProperty('--dynamic-border-color', this._currentSettings.borderColorPicker); const speed=parseFloat(this._currentSettings.animationSpeed||1); document.documentElement.style.setProperty('--animation-duration',`${Math.max(.1,2/speed)}s`); document.documentElement.style.setProperty('--gradient-direction',`${this._currentSettings.animationDirection}deg`); const pC=document.getElementById('previewContainer'); if(pC) pC.style.opacity=this._currentSettings.bgOpacity;
            // Inject initial font style
            await this._injectFontStyle(this._currentSettings.fontFamily, true); // isInitial=true
            // Update range displays
            this._updateRangeValueDisplays();
        }
        this._triggerSettingsUpdate();
    },


    _updateRangeValueDisplays() {
        const rangeConfigs = [
            { id: 'letterSpacing', unit: 'em'},
            { id: 'rotation', unit: 'deg'},
            { id: 'animationSpeed', unit: 'x'},
            { id: 'animationDirection', unit: 'deg'},
            { id: 'bgOpacity', unit: ''},
            { id: 'exportQuality', unit: '%'},
            { id: 'exportFrameRate', unit: ' FPS'},
            { id: 'bgGradientDirection', unit: 'deg'}
        ];
        rangeConfigs.forEach(config => {
            const input = document.getElementById(config.id);
            const display = input?.parentElement?.querySelector('.range-value-display');
            if(input && display) {
                 display.textContent = input.value + config.unit;
            }
        });
    },

    loadSavedSettings() {
        try {
            const saved = localStorage.getItem('logomakerSettings');
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                // Validate loaded settings against defaults? Optional.
                this._currentSettings = { ...DEFAULT_SETTINGS, ...loadedSettings }; // Ensure all keys exist
                console.log('[SettingsManager] Loaded settings from localStorage.');
            } else {
                this._currentSettings = { ...DEFAULT_SETTINGS };
                console.log('[SettingsManager] No saved settings found, using defaults.');
            }
        } catch (err) {
            console.error('[SettingsManager] Error loading settings:', err);
            this._currentSettings = { ...DEFAULT_SETTINGS }; // Fallback to defaults on error
        }
    },
    saveCurrentSettings() {
        try {
            localStorage.setItem('logomakerSettings', JSON.stringify(this._currentSettings));
            // console.log('[SettingsManager] Settings saved.'); // Reduce console noise
        } catch (err) {
            console.error('[SettingsManager] Error saving settings:', err);
             showAlert('Failed to save settings to local storage.', 'error');
        }
    },

    // --- Listener Management & Public Access ---
    addSettingsChangeListener(listener) { if (typeof listener === 'function' && !this._listeners.includes(listener)) this._listeners.push(listener); },
    removeSettingsChangeListener(listener) { const i = this._listeners.indexOf(listener); if (i !== -1) this._listeners.splice(i, 1); },
    getCurrentSettings() { return { ...this._currentSettings }; } // Return a copy
};

// --- Initialization ---
// Initialization is now triggered externally by main.js: SettingsManager.init()

// --- Global Exposure & Export ---
window.SettingsManager = SettingsManager; // Expose globally for easier access from other scripts/console
export default SettingsManager;

console.log("[SettingsManager] Module loaded, ready for initialization.");