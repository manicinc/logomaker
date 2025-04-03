/**
 * settingsManager.js (Version 13 - Add getDefaults, Reset Logging)
 * ====================================================
 * Manages UI state, applies styles, handles settings persistence,
 * and dynamically injects @font-face rules for selected fonts.
 */
import { initializeFonts } from './fontManager.js'; // Keep this import

// Define default settings used for initialization and reset
const DEFAULT_SETTINGS = {
    logoText: 'Manic',
    fontFamily: 'Orbitron',
    fontSize: '100',
    letterSpacing: '0.03',
    textCase: 'none',
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
    animationDirection: '45', // Text gradient direction
    backgroundType: 'bg-solid',
    backgroundColor: '#000000',
    bgOpacity: '1',
    backgroundGradientPreset: 'bg-primary-gradient',
    bgColor1: '#3a1c71',
    bgColor2: '#ffaf7b',
    bgGradientDirection: '90',
    previewSize: 'preview-size-medium',
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

    // --- NEW: Getter for Defaults ---
    getDefaults() {
         console.log("[SM] getDefaults() called.");
         try {
             if (typeof structuredClone === 'function') {
                 return structuredClone(DEFAULT_SETTINGS);
             }
             return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
         } catch (e) {
             console.error("[SM] Error deep copying default settings:", e);
             return { ...DEFAULT_SETTINGS }; // Fallback to shallow copy
         }
    },

    // --- NEW: Getter for Current Settings ---
    getCurrentSettings() {
        console.log("[SM] getCurrentSettings() called.");
        // Return a deep copy to prevent accidental mutation from outside
        try {
            // Use structuredClone if available (modern browsers)
            if (typeof structuredClone === 'function') {
                return structuredClone(this._currentSettings);
            }
            // Fallback to JSON parse/stringify (slightly less performant)
            return JSON.parse(JSON.stringify(this._currentSettings));
        } catch (e) {
            console.error("[SM] Error deep copying current settings:", e);
            // Fallback to shallow copy if deep copy fails (less safe)
            return { ...this._currentSettings };
        }
    },


    async init() {
        if (this._isInitialized) { console.warn("[SM] Already initialized."); return; }
        console.log('[SM] Initialize...');
        if (typeof showAlert === 'undefined') { window.showAlert = (msg, type='log')=>console[type](`[Alert] ${msg}`); }
        if (typeof notifyResetSuccess === 'undefined') { window.notifyResetSuccess = (type) => showAlert(`Settings Reset (${type})!`, 'success'); }
        if (typeof window.updateSizeIndicator === 'undefined') { window.updateSizeIndicator = () => console.warn("updateSizeIndicator missing"); }


        try {
            console.log('[SM] Waiting for Font Manager...');
            const fontsReady = await initializeFonts();
            if (!fontsReady) { console.error('[SM] Font Manager failed. Proceeding cautiously.'); }
            else { console.log('[SM] Font Manager ready.'); }

            this.loadSavedSettings();
            this._setupEventListeners();

            console.log('[SM] Applying initial/loaded settings...');
            await this.applySettings(this._currentSettings, true, true); // Apply and force UI sync

            // Removed redundant second call to applySettings
            this._initializeUIComponentsState();

            // --- ADD THIS LOG ---
            console.log('[SM] Reached END of init function successfully.');
            this._isInitialized = true; // Ensure this is set
            console.log('[SM] Initialization complete. Initial Settings:', JSON.stringify(this._currentSettings));

        } catch (error) {
             console.error("[SM] Initialization failed:", error);
             showAlert(`Settings Manager init failed: ${error.message || 'Unknown error'}`, 'error');
        }
    },

    _setupEventListeners() {
        console.log('[SM] Setting up event listeners...');
        if (!document.getElementById('logoText')) { console.error("[SM] Cannot find #logoText. Aborting listener setup."); return; }
        // Bind all listeners
        this._bindInputListener('logoText', 'textContent');
        this._bindSelectListener('fontFamily');
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
        this._bindRangeInputListener('animationDirection');
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
        console.log('[SM] Event listeners setup done.');
    },

    // --- Binder Functions (with logging from previous updates) ---
    _bindInputListener(inputId, settingKeyOrTargetProp) {
        const input = document.getElementById(inputId); if (!input) { console.warn(`[SM] Input element #${inputId} not found.`); return; }
        input.addEventListener('input', (e) => {
             const value = e.target.value;
             console.log(`[SM] Input Change: #${inputId} = '${value}'`);
             this._currentSettings[inputId] = value;
             if (settingKeyOrTargetProp === 'textContent') {
                 const logoEl = document.querySelector('.logo-text');
                 if (logoEl) { logoEl.textContent = value; logoEl.setAttribute('data-text', value); console.log(`[SM] Updated .logo-text content`); }
                 this._updateSizeIndicator();
             }
             this._triggerSettingsUpdate();
        });
    },
    _bindSelectListener(selectId) {
        const select = document.getElementById(selectId); if (!select) { console.warn(`[SM] Select element #${selectId} not found.`); return; }
        select.addEventListener('change', (e) => {
             const value = e.target.value;
             console.log(`[SM] Select Change: #${selectId} = '${value}'`);
             this._currentSettings[selectId] = value;
             const logoElement = document.querySelector('.logo-text');
             const logoContainer = document.querySelector('.logo-container');
             const previewContainer = document.getElementById('previewContainer');
             if (!logoElement || !previewContainer || !logoContainer) { console.error("[SM] Critical preview elements missing!"); return; }
             switch(selectId) {
                 case 'fontFamily':
                      logoElement.style.fontFamily = `"${value}", sans-serif`;
                      this._injectFontStyle(value); this._updateFontPreview(value); console.log(`[SM] Applied font-family: ${value}`); break;
                 case 'textCase': logoElement.style.textTransform = value; console.log(`[SM] Applied text-transform: ${value}`); break;
                 case 'fontWeight': logoElement.style.fontWeight = value; console.log(`[SM] Applied font-weight: ${value}`); break;
                 case 'textAlign': logoElement.style.textAlign = value; console.log(`[SM] Applied text-align: ${value}`); break;
                 case 'textColorMode': this._handleColorModeChange(value); break;
                 case 'gradientPreset': this._handleGradientPresetChange(value); break;
                 case 'textShadow':
                      console.log(`[SM] Applying text effect class: ${value} to .logo-text`);
                      this._applyClassFromSelect('.logo-text', value, 'text-glow-');
                      console.log('[SM] .logo-text classes after shadow apply:', logoElement.classList); break;
                 case 'borderStyle':
                      console.log(`[SM] Applying border style class: ${value} to .logo-container`);
                      logoContainer.classList.toggle('dynamic-border', value !== 'border-none');
                      this._applyClassFromSelect(logoContainer, value, 'border-');
                      console.log('[SM] logo-container classes after border apply:', logoContainer.classList); break;
                 case 'textAnimation':
                      console.log(`[SM] Applying animation class: ${value} to .logo-text`);
                      this._applyClassFromSelect('.logo-text', value, 'anim-');
                      console.log('[SM] .logo-text classes after anim apply:', logoElement.classList);
                      this._applyAnimationSpeed(this._currentSettings.animationSpeed); break;
                 case 'backgroundType': this._handleBackgroundTypeChange(value); break;
                 case 'previewSize':
                      console.log(`[SM] Applying preview size class: ${value} to #previewContainer`);
                      this._applyClassFromSelect('#previewContainer', value, 'preview-size-');
                      console.log('[SM] #previewContainer classes after size apply:', previewContainer.classList);
                      this._updateSizeIndicator(); break;
                 case 'backgroundGradientPreset': this._handleBackgroundGradientChange(value); break;
                 default: console.warn(`[SM] Unhandled select change: #${selectId}`);
             }
             this._triggerSettingsUpdate();
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
                  this._updateSizeIndicator();
              } else if (inputId.startsWith('export')) { console.log(`[SM] Export setting updated: ${inputId} = ${value}`); }
              this._triggerSettingsUpdate();
         });
    },
    _bindRangeInputListener(inputId, styleProperty = null, unit = '') {
        const input = document.getElementById(inputId); if (!input) { console.warn(`[SM] Range input #${inputId} not found.`); return; }
        const display = input.parentElement?.querySelector('.range-value-display');
        const updateDisplay = (val) => { if(display) { display.textContent = val + (unit === 'x' ? unit : (unit ? unit : '')); } };
        input.addEventListener('input', (e) => {
             const value = e.target.value; this._currentSettings[inputId] = value; updateDisplay(value);
             const logoElement = document.querySelector('.logo-text'); const previewContainer = document.getElementById('previewContainer');
             switch (inputId) {
                 case 'letterSpacing': if (logoElement) logoElement.style.letterSpacing = `${value}em`; console.log(`[SM] Applied letter-spacing: ${value}em`); break;
                 case 'rotation': if (logoElement) logoElement.style.transform = `rotate(${value}deg)`; console.log(`[SM] Applied rotation: ${value}deg`); break;
                 case 'animationSpeed': this._applyAnimationSpeed(value); break;
                 case 'animationDirection': document.documentElement.style.setProperty('--gradient-direction', `${value}deg`); if (this._currentSettings.textColorMode === 'gradient') { this._applyGradientToLogo(); } console.log(`[SM] Applied text gradient direction: ${value}deg`); break;
                 case 'bgOpacity': if (previewContainer) previewContainer.style.opacity = value; console.log(`[SM] Applied background opacity: ${value}`); break;
                 case 'bgGradientDirection': document.documentElement.style.setProperty('--bg-gradient-direction', `${value}deg`); if (this._currentSettings.backgroundType?.includes('gradient')) { this._applyBackgroundGradient(); } console.log(`[SM] Applied background gradient direction: ${value}deg`); break;
                 case 'exportFrameRate': console.log(`[SM] Export Frame Rate (Preview) set to: ${value} FPS`); break;
                 case 'exportQuality': console.log(`[SM] Export Quality set to: ${value}%`); break;
                 default: console.warn(`[SM] Unhandled range input: #${inputId}`);
             }
             this._triggerSettingsUpdate();
        });
    },
    _bindCheckboxListener(checkboxId) {
         const checkbox = document.getElementById(checkboxId); if (!checkbox) { console.warn(`[SM] Checkbox #${checkboxId} not found.`); return; }
         checkbox.addEventListener('change', (e) => {
              const isChecked = e.target.checked; console.log(`[SM] Checkbox Change: #${checkboxId} = ${isChecked}`); this._currentSettings[checkboxId] = isChecked;
              if (checkboxId === 'useColor3') {
                  const color3Control = document.getElementById('color3Control'); if (color3Control) color3Control.classList.toggle('hidden', !isChecked);
                  this._applyGradientToLogo(); console.log(`[SM] Toggled Use Color 3: ${isChecked}`);
              } else if (checkboxId === 'exportTransparent') { console.log(`[SM] Export Transparent toggled: ${isChecked}`); }
              this._triggerSettingsUpdate();
         });
    },
    _bindColorInputListener(inputId) {
        const input = document.getElementById(inputId); if (!input) { console.warn(`[SM] Color input #${inputId} not found.`); return; }
        input.addEventListener('input', (e) => {
             const value = e.target.value; this._currentSettings[inputId] = value;
             switch (inputId) {
                 case 'solidColorPicker': if (this._currentSettings.textColorMode === 'solid') { const el = document.querySelector('.logo-text'); if (el) el.style.color = value; console.log(`[SM] Applied solid text color: ${value}`); } break;
                 case 'color1': case 'color2': case 'color3': if (this._currentSettings.textColorMode === 'gradient') { this._applyGradientToLogo(); console.log(`[SM] Custom text gradient color changed (${inputId})`); } break;
                 case 'borderColorPicker': document.documentElement.style.setProperty('--dynamic-border-color', value); console.log(`[SM] Set --dynamic-border-color CSS variable to: ${value}`); break;
                 case 'backgroundColor': const pc = document.getElementById('previewContainer'); if (pc && this._currentSettings.backgroundType === 'bg-solid') { pc.style.backgroundColor = value; console.log(`[SM] Applied solid background color: ${value}`); } break;
                 case 'bgColor1': case 'bgColor2': if (this._currentSettings.backgroundType?.includes('gradient')) { this._applyBackgroundGradient(); console.log(`[SM] Custom background gradient color changed (${inputId})`); } break;
             }
             this._triggerSettingsUpdate();
        });
    },

    // --- Specific Handlers (with robustness checks from previous updates) ---
    _handleColorModeChange(mode) {
        console.log(`[SM] Handling Color Mode Change to: ${mode}`);
        const solidGroup = document.getElementById('solidColorPickerGroup'); const presetSelect = document.getElementById('gradientPreset');
        const customGroup = document.getElementById('customGradientControls'); const logoEl = document.querySelector('.logo-text');
        const presetGroup = presetSelect ? presetSelect.closest('.control-group') : null;
        if (!solidGroup || !presetSelect || !presetGroup || !customGroup || !logoEl) {
             console.error("[SM Error] Missing critical elements for color mode change UI update:"); /* Log specifics */ return; }
        console.log("[SM] Color mode change required elements found.");
        const isSolid = mode === 'solid';
        solidGroup.classList.toggle('hidden', !isSolid); presetGroup.classList.toggle('hidden', isSolid);
        customGroup.classList.toggle('hidden', isSolid || presetSelect.value !== 'custom');
        if (isSolid) {
             const solidColor = document.getElementById('solidColorPicker')?.value || '#ffffff'; console.log(`[SM] Applying solid text color: ${solidColor}`);
             logoEl.style.backgroundImage = 'none'; logoEl.style.backgroundClip = 'initial'; logoEl.style.webkitBackgroundClip = 'initial';
             logoEl.style.color = solidColor; logoEl.style.webkitTextFillColor = 'initial';
        } else { console.log('[SM] Applying gradient text color...'); this._applyGradientToLogo(); }
    },
    _handleGradientPresetChange(preset) {
        console.log(`[SM] Handling Gradient Preset Change: ${preset}`);
        const customControls = document.getElementById('customGradientControls'); if (customControls) customControls.classList.toggle('hidden', preset !== 'custom');
        this._applyGradientToLogo();
    },
    _applyGradientToLogo() {
        const logoEl = document.querySelector('.logo-text'); const presetSelect = document.getElementById('gradientPreset');
        const directionInput = document.getElementById('animationDirection');
        if (!logoEl || !presetSelect || !directionInput) { console.warn("[SM ApplyGradient] Missing required elements."); return; }
        if (this._currentSettings.textColorMode !== 'gradient') { console.warn("[SM ApplyGradient] Mode is not gradient."); /* Reset styles if needed */ return; }
        let gradient = ''; const direction = directionInput.value || '45'; const preset = presetSelect.value;
        console.log(`[SM ApplyGradient] Applying text gradient. Preset: ${preset}, Direction: ${direction}deg`);
        if (preset === 'custom') {
             const c1 = document.getElementById('color1')?.value || '#FF1493'; const c2 = document.getElementById('color2')?.value || '#8A2BE2';
             const useC3 = document.getElementById('useColor3')?.checked; const c3 = document.getElementById('color3')?.value || '#FF4500';
             gradient = useC3 ? `linear-gradient(${direction}deg, ${c1}, ${c2}, ${c3})` : `linear-gradient(${direction}deg, ${c1}, ${c2})`;
             console.log(`[SM ApplyGradient] Custom colors: ${c1}, ${c2}` + (useC3 ? `, ${c3}` : ''));
        } else {
             const presetVarName = `--${preset}`; const presetVarValue = getComputedStyle(document.documentElement).getPropertyValue(presetVarName).trim();
             console.log(`[SM ApplyGradient] Preset var read: ${presetVarName} = '${presetVarValue}'`);
             if (presetVarValue && presetVarValue.startsWith('linear-gradient')) { gradient = presetVarValue.replace(/linear-gradient\(([^,]+),/, `linear-gradient(${direction}deg,`); }
             else { console.warn(`[SM ApplyGradient] Preset var '${presetVarName}' invalid. Fallback.`); gradient = `linear-gradient(${direction}deg, #FF1493, #8A2BE2)`; }
        }
        logoEl.style.backgroundImage = gradient; logoEl.style.webkitBackgroundClip = 'text'; logoEl.style.backgroundClip = 'text';
        logoEl.style.color = 'transparent'; logoEl.style.webkitTextFillColor = 'transparent';
        console.log('[SM ApplyGradient] Text gradient styles applied.');
    },
    _handleBackgroundTypeChange(type) {
        console.log(`[SM] Handling Background Type Change: ${type}`);
        const previewContainer = document.getElementById('previewContainer'); const bgColorControl = document.getElementById('backgroundColorControl');
        const bgGradientControls = document.getElementById('backgroundGradientControls'); const customBgGradientControls = document.getElementById('customBackgroundGradient');
        const bgPresetSelect = document.getElementById('backgroundGradientPreset');
        if (!previewContainer || !bgColorControl || !bgGradientControls || !customBgGradientControls || !bgPresetSelect) { console.warn("[SM] Missing elements for background type change."); return; }
        const isSolid = type === 'bg-solid'; const isGradient = type === 'bg-gradient' || type === 'bg-gradient-animated';
        bgColorControl.classList.toggle('hidden', !isSolid); bgGradientControls.classList.toggle('hidden', !isGradient);
        customBgGradientControls.classList.toggle('hidden', !isGradient || bgPresetSelect.value !== 'custom');
        const classList = previewContainer.classList;
        const bgClasses = Array.from(classList).filter(cls => cls.startsWith('bg-'));
        if (bgClasses.length > 0) { console.log(`[SM] Removing old background classes: ${bgClasses.join(', ')}`); classList.remove(...bgClasses); }
        previewContainer.style.backgroundColor = ''; previewContainer.style.backgroundImage = ''; previewContainer.style.opacity = this._currentSettings.bgOpacity || '1';
        previewContainer.classList.remove('bg-gradient-animated-css');
        if (isSolid) {
             classList.add('bg-solid'); previewContainer.style.backgroundColor = document.getElementById('backgroundColor')?.value || '#000000';
             console.log(`[SM] Applied bg-solid, color: ${previewContainer.style.backgroundColor}`);
        } else if (isGradient) {
             classList.add(type); this._applyBackgroundGradient();
             if (type === 'bg-gradient-animated') { previewContainer.classList.add('bg-gradient-animated-css'); console.log('[SM] Applied animated gradient styles.'); }
             else { console.log('[SM] Applied static gradient styles.'); }
        } else if (type && type !== 'bg-transparent') {
             console.log(`[SM] Applying background pattern class: ${type}`); classList.add(type);
        } else { classList.add('bg-transparent'); previewContainer.style.backgroundColor = 'transparent'; previewContainer.style.backgroundImage = 'none'; console.log('[SM] Applied transparent background.'); }
        console.log(`[SM] Final preview container classes: ${previewContainer.classList}`);
    },
    _handleBackgroundGradientChange(presetValue) {
        console.log(`[SM] Handling Background Gradient Preset Change: ${presetValue}`);
        const customBgGroup = document.getElementById('customBackgroundGradient'); if (customBgGroup) customBgGroup.classList.toggle('hidden', presetValue !== 'custom');
        this._applyBackgroundGradient();
    },
    _applyBackgroundGradient() {
        const previewContainer = document.getElementById('previewContainer'); const presetSelect = document.getElementById('backgroundGradientPreset');
        const directionInput = document.getElementById('bgGradientDirection');
        if (!previewContainer || !presetSelect || !directionInput) { console.warn("[SM ApplyBgGradient] Missing elements."); return; }
        const currentBgType = this._currentSettings.backgroundType; if (currentBgType !== 'bg-gradient' && currentBgType !== 'bg-gradient-animated') return;
        let gradient = ''; const direction = directionInput.value || '90'; const preset = presetSelect.value;
        console.log(`[SM ApplyBgGradient] Applying background gradient. Preset: ${preset}, Direction: ${direction}deg`);
        if (preset === 'custom') {
             const c1 = document.getElementById('bgColor1')?.value || '#3a1c71'; const c2 = document.getElementById('bgColor2')?.value || '#ffaf7b';
             gradient = `linear-gradient(${direction}deg, ${c1}, ${c2})`;
        } else {
             const rootStyle = getComputedStyle(document.documentElement); const presetVarName = `--${preset}`; // Assuming var name matches value
             const presetVarValue = rootStyle.getPropertyValue(presetVarName).trim();
             if (presetVarValue?.startsWith('linear-gradient')) { gradient = presetVarValue.replace(/linear-gradient\(([^,]+),/, `linear-gradient(${direction}deg,`); }
             else { gradient = `linear-gradient(${direction}deg, #3a1c71, #ffaf7b)`; console.warn(`[SM ApplyBgGradient] Invalid/missing var ${presetVarName}, using fallback.`);}
        }
        previewContainer.style.backgroundImage = gradient; console.log(`[SM ApplyBgGradient] Set background image to: ${gradient}`);
    },
    _applyAnimationSpeed(speedValue) {
         const speed = parseFloat(speedValue || 1); const baseDuration = 2;
         const duration = baseDuration / Math.max(0.1, speed);
         document.documentElement.style.setProperty('--animation-duration', `${duration.toFixed(2)}s`);
         console.log(`[SM] Applied animation speed multiplier: ${speed}x (duration: ${duration.toFixed(2)}s)`);
    },
    _applyClassFromSelect(targetSelectorOrElement, className, classPrefix = null) {
         const targetElement = (typeof targetSelectorOrElement === 'string') ? document.querySelector(targetSelectorOrElement) : targetSelectorOrElement;
         if (!targetElement) { console.warn(`[SM ApplyClass] Target not found:`, targetSelectorOrElement); return; }
         if (classPrefix) {
              const classesToRemove = Array.from(targetElement.classList).filter(cls => cls.startsWith(classPrefix));
              if(classesToRemove.length > 0) { targetElement.classList.remove(...classesToRemove); /* console.log(`[SM ApplyClass] Removed prefix '${classPrefix}' from`, targetElement); */ }
         }
         if (className && (!classPrefix || !className.endsWith('-none'))) {
              targetElement.classList.add(className); console.log(`[SM ApplyClass] Added class '${className}' to`, targetElement);
         } else if (className && className.endsWith('-none')) { /* console.log(`[SM ApplyClass] '${className}' is none class, not adding.`); */ }
    },
    async _injectFontStyle(fontFamilyName, isInitial = false) {
         // ... (keep implementation from v11) ...
         let dynamicStyleElement = document.getElementById('dynamic-font-style'); let attempt = 0; const maxAttempts = 5, retryDelay = 50;
         while (!dynamicStyleElement && isInitial && attempt < maxAttempts) { attempt++; console.warn(`[SM] #dynamic-font-style attempt ${attempt}...`); await new Promise(r => setTimeout(r, retryDelay)); dynamicStyleElement = document.getElementById('dynamic-font-style'); }
         if (!dynamicStyleElement) { console.error("[SM] #dynamic-font-style missing!"); if(!window._dynFontAlertShown && typeof showAlert==='function'){showAlert('Font system init error.','error'); window._dynFontAlertShown=true;} return; }
         const fontDataGlobal = window._INLINE_FONTS_DATA; if (!Array.isArray(fontDataGlobal) || !fontFamilyName) { dynamicStyleElement.textContent='/* Font data invalid */'; return; }
         const targetL = fontFamilyName.toLowerCase(); const family = fontDataGlobal.find(f=>f.familyName?.toLowerCase()===targetL||f.displayName?.toLowerCase()===targetL); if (!family?.variants?.length) { dynamicStyleElement.textContent=`/* Font ${fontFamilyName} not found */`; return; }
         // Find best match logic (keep existing priority: exact -> weight -> normal -> any)
         const targetWeight = this._currentSettings?.fontWeight || '400'; const targetStyle = 'normal'; // Assume normal for now
         let bestMatch = family.variants.find(v => v.file?.startsWith('data:') && String(v.weight||400) === String(targetWeight) && (v.style||'normal') === targetStyle)
                      || family.variants.find(v => v.file?.startsWith('data:') && String(v.weight||400) === String(targetWeight))
                      || family.variants.find(v => v.file?.startsWith('data:') && String(v.weight||400) === '400' && (v.style||'normal') === 'normal')
                      || family.variants.find(v => v.file?.startsWith('data:'));
         if (bestMatch) { let rule=`/* Font: ${family.displayName} */\n@font-face{font-family:"${family.familyName}";src:url(${bestMatch.file}) format("${bestMatch.format||'woff2'}");font-weight:${bestMatch.weight||400};font-style:${bestMatch.style||'normal'};font-display:swap;}`; dynamicStyleElement.textContent=rule; void document.body.offsetHeight; console.log(`[SM] Injected ${family.familyName} (weight ${bestMatch.weight || 400})`); }
         else { dynamicStyleElement.textContent=`/* No Base64 for ${fontFamilyName} */`; console.warn(`[SM] No Base64 variant found for ${fontFamilyName}.`); }
    },

    // --- Core Methods ---
    _triggerSettingsUpdate() {
        this.saveCurrentSettings();
        this._listeners.forEach(listener => listener(this._currentSettings));
        this._updateSizeIndicator();
        this._updateCSSCode();
    },
    _updateSizeIndicator() {
        requestAnimationFrame(() => { // Use rAF for potentially better timing
             const logoEl = document.querySelector('.logo-text'); const widthIndicator = document.getElementById('logoWidth'); const heightIndicator = document.getElementById('logoHeight');
             if (!logoEl || !widthIndicator || !heightIndicator) return;
             try { const rect = logoEl.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) { widthIndicator.textContent = Math.round(rect.width); heightIndicator.textContent = Math.round(rect.height); } } catch (e) { console.error("[SM] Error updating size indicator:", e); }
        });
    },
    _updateCSSCode() {
        const cssCodeArea = document.getElementById('cssCode');
        if(cssCodeArea) { cssCodeArea.value = this._generateCSSCode(); }
    },
    _generateCSSCode() {
        console.log("[SM] Generating CSS Code...");
        const logoElement = document.querySelector('.logo-text'); const previewContainer = document.getElementById('previewContainer');
        const borderElement = document.querySelector('.logo-container.dynamic-border') || document.querySelector('.logo-container'); // Target container for border
        let errorMsg = '';
        if (!logoElement) errorMsg += '.logo-text missing. '; if (!previewContainer) errorMsg += '#previewContainer missing. '; if (!borderElement) console.warn("[SM CSS Gen] Border target .logo-container missing.");
        if (!logoElement || !previewContainer) { console.error(`[SM CSS Gen Error] ${errorMsg}`); return `// Error: Missing elements. ${errorMsg}`; }
        console.log("[SM CSS Gen] Elements found.");
        try {
             const logoStyle = window.getComputedStyle(logoElement); const containerStyle = window.getComputedStyle(previewContainer);
             const borderComputedStyle = window.getComputedStyle(borderElement); const rootStyle = window.getComputedStyle(document.documentElement);
             const cssVars = ['--animation-duration', '--gradient-direction', '--dynamic-border-color', '--bg-gradient-direction']; // Key variables to include
             let css = `:root {\n`; cssVars.forEach(v => { const val = rootStyle.getPropertyValue(v).trim(); if (val) css += `  ${v}: ${val};\n`; }); css += `}\n\n`;
             // Container
             css += `.logo-container { /* Basic container - adjust as needed */\n  display: flex; justify-content: center; align-items: center; width: 100%; min-height: 150px;\n`;
             const bgTypeSetting = this._currentSettings.backgroundType || 'bg-solid';
             if (bgTypeSetting === 'bg-solid') { css += `  background-color: ${this._currentSettings.backgroundColor || '#000000'};\n`; }
             else if (bgTypeSetting.includes('gradient')) { const grad = previewContainer.style.backgroundImage || containerStyle.backgroundImage; if (grad && grad !== 'none') css += `  background-image: ${grad};\n`; }
             else if (bgTypeSetting !== 'bg-transparent') { css += `  /* Background applied via class: ${bgTypeSetting} */\n  /* Base color was: ${containerStyle.backgroundColor} */\n`; }
             else { css += `  background-color: transparent;\n`; }
             if (containerStyle.opacity !== '1') css += `  opacity: ${containerStyle.opacity};\n`;
             // Add border style if applied to container
              const borderStyleValue = borderComputedStyle.borderTopStyle;
              if (borderStyleValue && borderStyleValue !== 'none' && borderElement.classList.contains('dynamic-border')) {
                  css += `  border-style: ${borderStyleValue};\n`; css += `  border-width: ${borderComputedStyle.borderTopWidth};\n`; css += `  border-color: var(--dynamic-border-color, ${this._currentSettings.borderColorPicker || '#fff'});\n`;
                  if (borderComputedStyle.borderRadius !== '0px') css += ` border-radius: ${borderComputedStyle.borderRadius};\n`; // Include border-radius if set
              }
             css += `}\n\n`;
             // Logo Text
             css += `.logo-text {\n`; const primaryFont = logoStyle.fontFamily.split(',')[0].trim().replace(/['"]/g, ''); css += `  font-family: "${primaryFont}", sans-serif;\n`;
             css += `  font-size: ${logoStyle.fontSize};\n`; css += `  font-weight: ${logoStyle.fontWeight};\n`;
             if(logoStyle.letterSpacing !== 'normal') css += `  letter-spacing: ${logoStyle.letterSpacing};\n`; if(logoStyle.textTransform !== 'none') css += `  text-transform: ${logoStyle.textTransform};\n`;
             css += `  text-align: ${logoStyle.textAlign};\n`;
             if (this._currentSettings.textColorMode === 'gradient') { const grad = logoElement.style.backgroundImage || logoStyle.backgroundImage; if (grad && grad !== 'none') css += `  background-image: ${grad};\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;\n  -webkit-text-fill-color: transparent;\n`; else css += `  color: #FFFFFF; /* Fallback */\n`; }
             else { css += `  color: ${logoStyle.color};\n`; }
             if (logoStyle.textShadow && logoStyle.textShadow !== 'none') css += `  text-shadow: ${logoStyle.textShadow};\n`;
              // Note: Border applied to container above, not text directly unless effect requires it
             if (logoStyle.transform && logoStyle.transform !== 'none') css += `  transform: ${logoStyle.transform};\n`;
             if (logoStyle.animationName && logoStyle.animationName !== 'none') { css += `  animation: ${logoStyle.animationName} var(--animation-duration) ${logoStyle.animationTimingFunction} ${logoStyle.animationIterationCount};\n`; }
             css += `}\n\n`;
             // Include keyframes if animation active?
             const animClass = Array.from(logoElement.classList).find(c => c.startsWith('anim-') && c !== 'anim-none');
             if (animClass && typeof window.getActiveAnimationKeyframes === 'function') {
                 const keyframes = window.getActiveAnimationKeyframes(animClass.replace('anim-',''));
                 if(keyframes) css += `${keyframes}\n\n`;
             }
              console.log("[SM] CSS Generation successful."); return css;
        } catch (e) { console.error("Error generating CSS:", e); return `/* Error generating CSS: ${e.message} */`; }
    },
    _initializeUIComponentsState() {
        console.log('[SM] Initializing UI component states...');
        this._handleColorModeChange(this._currentSettings.textColorMode);
        this._handleGradientPresetChange(this._currentSettings.gradientPreset);
        this._handleBackgroundTypeChange(this._currentSettings.backgroundType);
        this._handleBackgroundGradientChange(this._currentSettings.backgroundGradientPreset);
        this._updateFontPreview(this._currentSettings.fontFamily);
        this._updateRangeValueDisplays();
        this._setupResetButton(); // Ensure reset button listener is attached
        console.log('[SM] UI component states initialized.');
    },
    _updateFontPreview(font) {
        const previewSpan = document.getElementById("fontPreview");
        if(previewSpan && font) { previewSpan.style.fontFamily = `"${font}", sans-serif`; }
    },
    _setupResetButton() { // Added logging
         const resetBtn = document.getElementById('resetBtn'); if (!resetBtn || resetBtn.dataset.listenerAttached) return;
         const resetConfirmModal = document.getElementById('resetConfirmModal'); const resetModalCancel = document.getElementById('resetModalCancel'); const resetModalConfirm = document.getElementById('resetModalConfirm');
         if (!resetConfirmModal || !resetModalCancel || !resetModalConfirm) { console.warn('[SM] Reset modal elements missing.'); return; }
         resetBtn.addEventListener('click', () => { console.log('[SM] Reset button clicked -> showing modal.'); resetConfirmModal.style.display = 'flex'; resetConfirmModal.classList.add('active'); });
         resetModalCancel.addEventListener('click', () => { console.log('[SM] Reset modal cancelled.'); resetConfirmModal.style.display = 'none'; resetConfirmModal.classList.remove('active'); });
         resetModalConfirm.addEventListener('click', () => { const resetType = document.querySelector('input[name="reset-type"]:checked')?.value || 'all'; console.log(`[SM] Reset modal confirmed. Type: ${resetType}`); this.resetSettings(resetType); resetConfirmModal.style.display = 'none'; resetConfirmModal.classList.remove('active'); });
         resetConfirmModal.addEventListener('click', e => { if (e.target === resetConfirmModal) { console.log('[SM] Reset modal closed via overlay.'); resetConfirmModal.style.display = 'none'; resetConfirmModal.classList.remove('active'); }});
         document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && resetConfirmModal.classList.contains('active')) { console.log('[SM] Reset modal closed via Escape.'); resetConfirmModal.style.display = 'none'; resetConfirmModal.classList.remove('active'); }});
         resetBtn.dataset.listenerAttached = 'true'; console.log('[SM] Reset button listeners attached.');
    },
    resetSettings(resetType = 'all') { // Added logging
         console.log(`[SM] Resetting settings (type: ${resetType}). Applying defaults...`);
         const defaults = this.getDefaults(); let settingsToApply;
         const textKeys = ['logoText', 'fontFamily', 'fontSize', 'letterSpacing', 'textCase', 'fontWeight'];
         const styleKeys = ['textColorMode', 'solidColorPicker', 'gradientPreset', 'color1', 'color2', 'useColor3', 'color3', 'textShadow', 'borderColorPicker', 'borderStyle', 'textAlign', 'rotation', 'animationDirection'];
         const backgroundKeys = ['backgroundType', 'backgroundColor', 'bgOpacity', 'backgroundGradientPreset', 'bgColor1', 'bgColor2', 'bgGradientDirection'];
         if (resetType === 'all') { settingsToApply = { ...defaults }; }
         else { settingsToApply = { ...this._currentSettings }; if (resetType === 'text') { textKeys.forEach(key => { if(defaults.hasOwnProperty(key)) settingsToApply[key] = defaults[key]; }); } else if (resetType === 'style') { styleKeys.forEach(key => { if(defaults.hasOwnProperty(key)) settingsToApply[key] = defaults[key]; }); backgroundKeys.forEach(key => { if(defaults.hasOwnProperty(key)) settingsToApply[key] = defaults[key]; }); } }
         this.applySettings(settingsToApply, true).then(() => { console.log('[SM] Settings reset applied successfully.'); if(typeof notifyResetSuccess === 'function') notifyResetSuccess(resetType); }).catch(err => { console.error("[SM] Error applying reset settings:", err); if(typeof showAlert === 'function') showAlert("Failed to apply reset settings.", "error"); });
    },
    async applySettings(settings, forceUIUpdate = false, isInitialLoad = false) {
        // ... (keep implementation from v12, ensure logging is present) ...
         console.log(`[SM] Applying settings (forceUI: ${forceUIUpdate}, initial: ${isInitialLoad})`);
         const settingsToApply = typeof settings === 'object' && settings !== null ? settings : this._currentSettings;
         this._currentSettings = { ...DEFAULT_SETTINGS, ...settingsToApply };
         console.log('[SM] Applying Settings Object:', JSON.stringify(this._currentSettings));
         Object.entries(this._currentSettings).forEach(([key, value]) => {
              const element = document.getElementById(key); if (!element) return;
              try { const cV=(element.type==='checkbox')?element.checked:element.value; const nV=(element.type==='checkbox')?!!value:String(value??''); if(forceUIUpdate||isInitialLoad||String(cV)!==nV){ if(element.type==='checkbox'){element.checked=nV;}else{element.value=nV;} if(forceUIUpdate&&!isInitialLoad){ const eT=(element.nodeName==='SELECT'||element.type==='checkbox'||element.type==='color')?'change':'input'; element.dispatchEvent(new Event(eT,{bubbles:true}));}}} catch (e) { console.warn(`[SM Apply UI] Error applying UI for ${key}:`, e); }
         });
         if (isInitialLoad || forceUIUpdate) { // Only force style application if needed
             console.log('[SM Apply Styles] Applying visual styles from settings...');
             const logoEl = document.querySelector('.logo-text'); const logoContainer = document.querySelector('.logo-container'); const previewContainer = document.getElementById('previewContainer');
             if (!logoEl || !previewContainer || !logoContainer) { console.error("[SM Apply Styles] Critical elements missing!"); return; }
             logoEl.textContent = this._currentSettings.logoText; logoEl.setAttribute('data-text', this._currentSettings.logoText);
             logoEl.style.fontFamily = `"${this._currentSettings.fontFamily}", sans-serif`; logoEl.style.fontSize = `${this._currentSettings.fontSize}px`;
             logoEl.style.letterSpacing = `${this._currentSettings.letterSpacing}em`; logoEl.style.textTransform = this._currentSettings.textCase;
             logoEl.style.fontWeight = this._currentSettings.fontWeight; logoEl.style.textAlign = this._currentSettings.textAlign; logoEl.style.transform = `rotate(${this._currentSettings.rotation}deg)`;
             this._handleColorModeChange(this._currentSettings.textColorMode);
             this._applyClassFromSelect(logoEl, this._currentSettings.textShadow, 'text-glow-');
             logoContainer.classList.toggle('dynamic-border', this._currentSettings.borderStyle !== 'border-none');
             this._applyClassFromSelect(logoContainer, this._currentSettings.borderStyle, 'border-');
             document.documentElement.style.setProperty('--dynamic-border-color', this._currentSettings.borderColorPicker);
             this._applyClassFromSelect(logoEl, this._currentSettings.textAnimation, 'anim-');
             this._applyAnimationSpeed(this._currentSettings.animationSpeed);
             this._handleBackgroundTypeChange(this._currentSettings.backgroundType);
             previewContainer.style.opacity = this._currentSettings.bgOpacity;
             this._applyClassFromSelect(previewContainer, this._currentSettings.previewSize, 'preview-size-');
             await this._injectFontStyle(this._currentSettings.fontFamily, isInitialLoad);
             this._updateRangeValueDisplays();
             console.log('[SM Apply Styles] Visual styles applied.');
         }
         this._triggerSettingsUpdate(); // Always save, update CSS text area, notify listeners
         console.log('[SM] applySettings complete.');
    },
    _updateRangeValueDisplays() {
        const rangeConfigs = [ { id: 'letterSpacing', unit: 'em'}, { id: 'rotation', unit: 'deg'}, { id: 'animationSpeed', unit: 'x'}, { id: 'animationDirection', unit: 'deg'}, { id: 'bgOpacity', unit: ''}, { id: 'exportQuality', unit: '%'}, { id: 'exportFrameRate', unit: ' FPS'}, { id: 'bgGradientDirection', unit: 'deg'} ];
        rangeConfigs.forEach(config => { const input = document.getElementById(config.id); const display = input?.parentElement?.querySelector('.range-value-display'); if(input && display) { display.textContent = input.value + config.unit; } });
    },
    loadSavedSettings() {
        try { const saved = localStorage.getItem('logomakerSettings'); if (saved) { const loaded = JSON.parse(saved); this._currentSettings = { ...DEFAULT_SETTINGS, ...loaded }; console.log('[SM] Loaded settings from localStorage.'); } else { this._currentSettings = { ...DEFAULT_SETTINGS }; console.log('[SM] No saved settings found, using defaults.'); } }
        catch (err) { console.error('[SM] Error loading settings:', err); this._currentSettings = { ...DEFAULT_SETTINGS }; }
    },
    saveCurrentSettings() {
        try { localStorage.setItem('logomakerSettings', JSON.stringify(this._currentSettings)); /* console.log('[SM] Settings saved.'); */ }
        catch (err) { console.error('[SM] Error saving settings:', err); showAlert('Failed to save settings.', 'error'); }
    },
    addSettingsChangeListener(listener) { if (typeof listener === 'function' && !this._listeners.includes(listener)) this._listeners.push(listener); },
    removeSettingsChangeListener(listener) { const i = this._listeners.indexOf(listener); if (i !== -1) this._listeners.splice(i, 1); },
};
window.SettingsManager = SettingsManager; export default SettingsManager;
console.log("[SettingsManager] Module loaded (v13).");