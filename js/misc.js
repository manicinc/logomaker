/**
 * misc.js
 * =========================================
 * Contains miscellaneous utility functions: Theme Toggle, Size Indicator, Keyframes, Share Modal Setup.
 */

// Import SettingsManager needed for Share URL generation
import SettingsManager from './settingsManager.js'; // Adjust path if needed

console.log("[Misc v8] Module loaded.");

/** Updates the width/height display */
function updateSizeIndicator() {
    requestAnimationFrame(() => {
         const logoText = document.querySelector('.logo-text'); const widthIndicator = document.getElementById('logoWidth'); const heightIndicator = document.getElementById('logoHeight');
         if (!logoText || !widthIndicator || !heightIndicator) return;
         try { const rect = logoText.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) { widthIndicator.textContent = Math.round(rect.width); heightIndicator.textContent = Math.round(rect.height); } } catch (e) { console.error("[Misc] Error updating size indicator:", e); }
    });
}
window.updateSizeIndicator = updateSizeIndicator;
document.addEventListener('DOMContentLoaded', () => { setTimeout(updateSizeIndicator, 250); });

/** Theme Toggle */
function setupThemeToggle() {
    console.log('[Theme] setupThemeToggle running...');
    const themeToggleBtn = document.getElementById('themeToggleBtn'); if (!themeToggleBtn) { console.warn("[Theme] Toggle button #themeToggleBtn not found."); return; }
    const sunIcon = themeToggleBtn.querySelector('.sun-icon'); const moonIcon = themeToggleBtn.querySelector('.moon-icon'); const themeToggleText = themeToggleBtn.querySelector('.theme-toggle-text');
    const themeStorageKey = 'logomakerThemePreference_v1'; let savedTheme = localStorage.getItem(themeStorageKey);
    let systemPrefersLight = window.matchMedia?.('(prefers-color-scheme: light)')?.matches; let initialTheme;
    console.log(`[Theme] Saved theme ('${themeStorageKey}'):`, savedTheme); console.log(`[Theme] System prefers light:`, systemPrefersLight);
    if (savedTheme === 'light' || savedTheme === 'dark') { initialTheme = savedTheme; console.log(`[Theme] Using saved theme: ${initialTheme}`); }
    else { initialTheme = systemPrefersLight ? 'light' : 'dark'; console.log(`[Theme] Using system preference: ${initialTheme}`); }
    const applyTheme = (theme, isInitial = false) => {
        const isLight = theme === 'light'; console.log(`[Theme] Applying theme: ${theme}. Initial: ${isInitial}`);
        document.body.classList.toggle('light-mode', isLight);
        if (sunIcon) sunIcon.style.display = isLight ? 'none' : 'inline-block'; if (moonIcon) moonIcon.style.display = isLight ? 'inline-block' : 'none';
        const nextThemeName = isLight ? 'Dark' : 'Light'; if (themeToggleText) themeToggleText.textContent = nextThemeName;
        themeToggleBtn?.setAttribute('title', `Switch to ${nextThemeName} Mode`); themeToggleBtn?.setAttribute('aria-label', `Switch to ${nextThemeName} Mode`);
        if (!isInitial || !savedTheme) { localStorage.setItem(themeStorageKey, theme); console.log(`[Theme] Saved preference: ${theme}`); }
    };
    themeToggleBtn.addEventListener('click', () => { const current = document.body.classList.contains('light-mode') ? 'light' : 'dark'; const newTheme = current === 'light' ? 'dark' : 'light'; console.log(`[Theme] Toggle clicked! Changing to ${newTheme}`); applyTheme(newTheme, false); });
    applyTheme(initialTheme, true);
    try { window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => { const pref = e.matches; console.log(`[Theme] System pref changed. Prefers light: ${pref}`); if (!localStorage.getItem(themeStorageKey)) { console.log("[Theme] Applying system change."); applyTheme(pref ? 'light' : 'dark', false); } else { console.log("[Theme] Ignoring system change due to saved pref."); } }); } catch (e) { console.warn("[Theme] System preference listener failed:", e); }
    console.log('[Theme] Toggle Initialized.');
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', setupThemeToggle); } else { setupThemeToggle(); }

/** Animation Keyframes */
const FALLBACK_KEYFRAMES = { 'pulse': `@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.9}}`, 'bounce': `@keyframes bounce{0%,20%,50%,80%,100%{transform:translateY(0)}40%{transform:translateY(-15px)}60%{transform:translateY(-8px)}}`, 'shake': `@keyframes shake{0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-4px)}20%,40%,60%,80%{transform:translateX(4px)}}`, 'float': `@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`, 'rotate': `@keyframes rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`, 'wave': `@keyframes wave{0%,100%{transform:skew(0deg,0deg)}50%{transform:skew(4deg,2deg)}}`, 'glitch': `@keyframes glitch-1{0%,100%{clip-path:inset(45% 0 45% 0);transform:translate(-2px,1px) scale(1.01)}25%{clip-path:inset(10% 0 70% 0);transform:translate(2px,-1px) scale(.99)}50%{clip-path:inset(75% 0 15% 0);transform:translate(-2px,-1px) scale(1.02)}75%{clip-path:inset(30% 0 60% 0);transform:translate(2px,1px) scale(.98)}}`, 'flicker': `@keyframes flicker{0%,100%{opacity:1}50%{opacity:.5}}`, 'fade': `@keyframes fade{0%,100%{opacity:.2}50%{opacity:1}}` };
function getActiveAnimationKeyframes(animationName) {
    if (!animationName || typeof animationName !== 'string' || animationName === 'none') return null;
    const keyframeName = animationName.startsWith('anim-') ? animationName.substring(5) : animationName; if (!keyframeName || keyframeName === 'none') return null;
    console.log(`[Misc] Searching for @keyframes rule: '${keyframeName}'`);
    try {
        const styleSheets = Array.from(document.styleSheets);
        for (const sheet of styleSheets) {
             if (sheet.disabled || (!sheet.href && !sheet.ownerNode)) continue; let canAccessRules = false; try { if (sheet.cssRules || sheet.rules) canAccessRules = true; } catch (e) {}
             if (canAccessRules) {
                 const rules = sheet.cssRules || sheet.rules;
                 for (const rule of rules) {
                      let foundRule = null; if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === keyframeName) foundRule = rule;
                      else if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) { try { for (const nestedRule of rule.cssRules) { if (nestedRule.type === CSSRule.KEYFRAMES_RULE && nestedRule.name === keyframeName) { foundRule = nestedRule; break; } } } catch(nestedErr) {} }
                      if (foundRule) { console.log(`[Misc] Found @keyframes '${keyframeName}' in stylesheet: ${sheet.href || 'Inline/Embedded'}`); return foundRule.cssText; }
                 }
             }
        }
    } catch (error) { console.error('[Misc] Error searching stylesheets:', error); }
    if (FALLBACK_KEYFRAMES[keyframeName]) { console.warn(`[Misc] Keyframes '${keyframeName}' not found in CSS. Using fallback.`); return FALLBACK_KEYFRAMES[keyframeName]; }
    console.warn(`[Misc] No keyframes rule found or fallback defined for: '${keyframeName}'`); return null;
}
window.getActiveAnimationKeyframes = getActiveAnimationKeyframes;


// --- Share URL Functionality ---

// Keep track of modal elements scoped to this module
let shareUrlModal, shareUrlInput, copyShareUrlBtn, copyBtnText, shareModalClose, shareModalCancel, qrCodeDisplay, downloadQrCodeBtn;
let shareTwitter, shareFacebook, shareEmail, shareWhatsapp, shareLinkedin, sharePinterest; // Social links

/** Internal function to open and populate the Share modal */
export function openShareModal() {
    console.log('[Share] Opening Share Modal...');
    // Ensure modal elements are available
    if (!shareUrlModal || !shareUrlInput || !copyShareUrlBtn /* || etc */ ) {
         console.error("[Share] Cannot open modal, elements not found (setupShareUrlModal likely failed).");
         if(typeof showAlert === 'function') showAlert("Cannot open share dialog: UI elements missing.", "error");
         return;
    }
    // Use imported SettingsManager directly
    if (!SettingsManager || typeof SettingsManager.getCurrentSettings !== 'function') {
         console.error("[Share] SettingsManager (imported) not available to generate URL.");
         if(typeof showAlert === 'function') showAlert("Cannot generate share URL: Settings Manager error.", "error");
         shareUrlInput.value = "Error: Settings unavailable";
         return;
    }

    // 1. Generate URL
    let generatedUrl = '';
    try {
        const baseUrl = window.location.origin + window.location.pathname;
        const currentSettings = SettingsManager.getCurrentSettings();
        const defaults = typeof SettingsManager.getDefaults === 'function' ? SettingsManager.getDefaults() : {};
        const params = new URLSearchParams();
        const relevantKeys = [ /* ... keys ... */
             'logoText', 'fontFamily', 'fontSize', 'letterSpacing', 'textCase', 'fontWeight',
             'textColorMode', 'solidColorPicker', 'gradientPreset', 'color1', 'color2', 'useColor3', 'color3', 'animationDirection',
             'textShadow', 'borderColorPicker', 'borderStyle', 'textAlign', 'rotation',
             'textAnimation', 'animationSpeed',
             'backgroundType', 'backgroundColor', 'bgOpacity', 'backgroundGradientPreset', 'bgColor1', 'bgColor2', 'bgGradientDirection'
         ];

        relevantKeys.forEach(key => {
            if (currentSettings.hasOwnProperty(key) && currentSettings[key] !== undefined && currentSettings[key] !== null && (!defaults.hasOwnProperty(key) || currentSettings[key] !== defaults[key])) {
                 let value = currentSettings[key];
                 if (typeof value === 'boolean') value = value ? '1' : '0';
                 if (key.toLowerCase().includes('color') && typeof value === 'string' && value.startsWith('#')) { value = value.substring(1); }
                 params.append(key, value);
            }
        });

        generatedUrl = `${baseUrl}?${params.toString()}`;
        shareUrlInput.value = generatedUrl;
        console.log(`[Share] Generated URL (${generatedUrl.length} chars): ${generatedUrl}`);

    } catch (err) {
         console.error("[Share] Error generating share URL:", err);
         shareUrlInput.value = "Error generating URL.";
         generatedUrl = '';
    }

    // 2. Update Social Links & QR (Check elements exist)
    if (generatedUrl) {
         const encodedUrl = encodeURIComponent(generatedUrl);
         const shareText = encodeURIComponent("Check out this logo I designed with Logomaker by Manic!");
         const shareTitle = encodeURIComponent("Logomaker Design");

         if(shareTwitter) shareTwitter.href = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${shareText}`;
         if(shareFacebook) shareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
         // ... update other social links ...

         // 3. Generate QR Code
         if (qrCodeDisplay) {
             qrCodeDisplay.innerHTML = '<div class="qr-placeholder">Generating QR...</div>';
             if (downloadQrCodeBtn) downloadQrCodeBtn.disabled = true;
             if (typeof QRCode === 'undefined') {
                 console.warn('[Share] QRCode library not found.');
                 qrCodeDisplay.innerHTML = '<div class="qr-placeholder" style="font-size: 0.8em; color: #888;">QR Code library not loaded.</div>';
             } else { /* ... QR Generation logic ... */
                  try {
                       qrCodeDisplay.innerHTML = ''; // Clear placeholder
                       new QRCode(qrCodeDisplay, { text: generatedUrl, width: 160, height: 160, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.M });
                       if (downloadQrCodeBtn) downloadQrCodeBtn.disabled = false;
                       console.log('[Share] QR Code generated.');
                  } catch (qrError) { /* ... error handling ... */ }
             }
         }
    } else { /* ... disable links/QR ... */ }

    // 4. Show Modal
    shareUrlModal.style.display = 'flex';
    shareUrlModal.classList.add('active');
}


/** Share URL Modal Logic */

/** Sets up listeners and elements for the Share Modal */
function setupShareUrlModal() {
    console.log('[Share] Initializing Share URL Modal logic...');
    // Assign elements to module-scoped variables
    shareUrlModal = document.getElementById('shareUrlModal');
    shareUrlInput = document.getElementById('shareUrlInput');
    copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
    copyBtnText = copyShareUrlBtn?.querySelector('span');
    shareModalClose = document.getElementById('shareModalClose');
    shareModalCancel = document.getElementById('shareModalCancel');
    qrCodeDisplay = document.getElementById('qrCodeDisplay');
    downloadQrCodeBtn = document.getElementById('downloadQrCode');
    shareTwitter = document.getElementById('shareTwitter');
    shareFacebook = document.getElementById('shareFacebook');
    shareEmail = document.getElementById('shareEmail');
    shareWhatsapp = document.getElementById('shareWhatsapp');
    shareLinkedin = document.getElementById('shareLinkedin');
    sharePinterest = document.getElementById('sharePinterest');


    if (!shareUrlModal || !shareUrlInput /* || etc */ ) {
        console.warn('[Share] Setup failed: One or more Share URL modal elements are missing.');
        return; // Don't attach listeners if elements missing
    }

    const closeShareModal = () => { /* ... close logic ... */
         shareUrlModal.style.display = 'none';
         shareUrlModal.classList.remove('active');
         console.log('[Share] Modal closed.');
     };

    // Attach listeners for controls *inside* the modal
    shareModalClose?.addEventListener('click', closeShareModal);
    shareModalCancel?.addEventListener('click', closeShareModal);
    shareUrlModal?.addEventListener('click', (e) => { if (e.target === shareUrlModal) closeShareModal(); });
    copyShareUrlBtn?.addEventListener('click', () => { /* ... copy logic using navigator.clipboard ... */ });
    downloadQrCodeBtn?.addEventListener('click', () => { /* ... QR download logic ... */ });

    // Note: The main #shareUrlBtn listener is now attached in main.js

    console.log('[Share] Share URL Modal setup complete.');
}

// Initialize Share URL Modal Logic on Load
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', setupShareUrlModal); }
else { setupShareUrlModal(); }

// Expose handler globally for main.js binding
window.handleShareUrlClick = () => { const shareBtn = document.getElementById('shareUrlBtn'); shareBtn?.click(); }; // Simple trigger

console.log("[Misc v6] Utilities ready.");