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


export function openShareModal() {
    console.log('[Share] Opening Share Modal...');
    
    // Get modal elements
    const shareUrlModal = document.getElementById('shareUrlModal');
    const shareUrlInput = document.getElementById('shareUrlInput');
    const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
    const copyBtnText = copyShareUrlBtn?.querySelector('span');
    const qrCodeDisplay = document.getElementById('qrCodeDisplay');
    const downloadQrCodeBtn = document.getElementById('downloadQrCode');
    
    // Social sharing elements
    const shareTwitter = document.getElementById('shareTwitter');
    const shareFacebook = document.getElementById('shareFacebook');
    const shareEmail = document.getElementById('shareEmail');
    
    // Ensure elements exist
    if (!shareUrlModal || !shareUrlInput || !copyShareUrlBtn) {
        console.error("[Share] Cannot open modal, elements not found (setupShareUrlModal likely failed).");
        if(typeof showAlert === 'function') {
            showAlert("Cannot open share dialog: UI elements missing.", "error");
        }
        return;
    }
    
    // FIXED: Check SettingsManager using both import and window fallback
    const settingsManager = window.SettingsManager;
    if (!settingsManager || typeof settingsManager.getCurrentSettings !== 'function') {
        console.error("[Share] SettingsManager not available to generate URL.");
        if(typeof showAlert === 'function') {
            showAlert("Cannot generate share URL: Settings Manager error.", "error");
        }
        shareUrlInput.value = "Error: Settings unavailable";
        return;
    }

    // Generate URL with proper error handling
    let generatedUrl = '';
    try {
        const baseUrl = window.location.origin + window.location.pathname;
        const currentSettings = settingsManager.getCurrentSettings();
        const defaults = typeof settingsManager.getDefaults === 'function' 
            ? settingsManager.getDefaults() 
            : {};
            
        // FIXED: Create params with more robust handling
        const params = new URLSearchParams();
        
        // Relevant settings keys to include in URL
        const relevantKeys = [
            'logoText', 'fontFamily', 'fontSize', 'letterSpacing', 'textCase', 'fontWeight',
            'textColorMode', 'solidColorPicker', 'gradientPreset', 'color1', 'color2', 'useColor3', 'color3', 'animationDirection',
            'textShadow', 'borderColorPicker', 'borderStyle', 'textAlign', 'rotation',
            'textAnimation', 'animationSpeed',
            'backgroundType', 'backgroundColor', 'bgOpacity', 'backgroundGradientPreset', 'bgColor1', 'bgColor2', 'bgGradientDirection'
        ];

        // FIXED: More robust parameter generation with type handling
        let paramsAdded = 0;
        relevantKeys.forEach(key => {
            if (currentSettings.hasOwnProperty(key) && 
                currentSettings[key] !== undefined && 
                currentSettings[key] !== null) {
                
                // Only add if different from default or if key is essential (like logoText)
                const isEssential = ['logoText', 'fontFamily'].includes(key);
                const isDifferentFromDefault = 
                    !defaults.hasOwnProperty(key) || 
                    String(currentSettings[key]) !== String(defaults[key]);
                
                if (isEssential || isDifferentFromDefault) {
                    let value = currentSettings[key];
                    
                    // Handle different value types
                    if (typeof value === 'boolean') {
                        value = value ? '1' : '0';
                    } else if (typeof value === 'number') {
                        value = String(value);
                    } else if (typeof value === 'string' && value.startsWith('#')) {
                        // Remove # from color codes to shorten URL
                        value = value.substring(1);
                    }
                    
                    params.append(key, value);
                    paramsAdded++;
                }
            }
        });
        
        // FIXED: Ensure we have at least some parameters
        if (paramsAdded === 0) {
            // Add at least logoText if nothing else
            const logoText = currentSettings.logoText || 'Manic';
            params.append('logoText', logoText);
        }

        generatedUrl = `${baseUrl}?${params.toString()}`;
        shareUrlInput.value = generatedUrl;
        console.log(`[Share] Generated URL (${generatedUrl.length} chars): ${generatedUrl}`);

    } catch (err) {
        console.error("[Share] Error generating share URL:", err);
        shareUrlInput.value = "Error generating URL.";
        generatedUrl = '';
    }

    // Update social links & QR
    if (generatedUrl) {
        const encodedUrl = encodeURIComponent(generatedUrl);
        const shareText = encodeURIComponent("Check out this logo I designed with Logomaker by Manic!");
        const shareTitle = encodeURIComponent("Logomaker Design");

        // Update social sharing buttons
        if (shareTwitter) {
            shareTwitter.href = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${shareText}`;
        }
        if (shareFacebook) {
            shareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        }
        if (shareEmail) {
            const subject = shareTitle;
            const body = `${shareText}\n\n${generatedUrl}`;
            shareEmail.href = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
        }

        // Generate QR Code
        if (qrCodeDisplay) {
            qrCodeDisplay.innerHTML = '<div class="qr-placeholder">Generating QR...</div>';
            if (downloadQrCodeBtn) downloadQrCodeBtn.disabled = true;
            
            // Check if QRCode library is available
            if (typeof QRCode === 'undefined') {
                console.warn('[Share] QRCode library not found.');
                qrCodeDisplay.innerHTML = '<div class="qr-placeholder" style="font-size: 0.8em; color: #888;">QR Code library not loaded.</div>';
            } else {
                try {
                    qrCodeDisplay.innerHTML = ''; // Clear placeholder
                    new QRCode(qrCodeDisplay, {
                        text: generatedUrl,
                        width: 160,
                        height: 160,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.M
                    });
                    if (downloadQrCodeBtn) downloadQrCodeBtn.disabled = false;
                    console.log('[Share] QR Code generated.');
                } catch (qrError) {
                    console.error('[Share] QR generation failed:', qrError);
                    qrCodeDisplay.innerHTML = '<div class="qr-placeholder">QR Generation Failed</div>';
                }
            }
        }
    } else {
        // Disable links/QR if URL generation failed
        if (qrCodeDisplay) {
            qrCodeDisplay.innerHTML = '<div class="qr-placeholder">URL Generation Failed</div>';
        }
        if (downloadQrCodeBtn) downloadQrCodeBtn.disabled = true;
    }

    // Show modal
    shareUrlModal.style.display = 'flex';
    shareUrlModal.classList.add('active');
}

/** Share URL Modal Logic */

/** Sets up listeners and elements for the Share Modal */
function setupShareUrlModal() {
    console.log('[Share] Initializing Share URL Modal logic...');
    
    // Get modal elements
    const shareUrlModal = document.getElementById('shareUrlModal');
    const shareUrlInput = document.getElementById('shareUrlInput');
    const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
    const copyBtnText = copyShareUrlBtn?.querySelector('span');
    const shareModalClose = document.getElementById('shareModalClose');
    const shareModalCancel = document.getElementById('shareModalCancel');
    const qrCodeDisplay = document.getElementById('qrCodeDisplay');
    const downloadQrCodeBtn = document.getElementById('downloadQrCode');
    
    // Check for essential elements
    if (!shareUrlModal || !shareUrlInput || !copyShareUrlBtn) {
        console.warn('[Share] Setup failed: One or more Share URL modal elements are missing.');
        return;
    }

    // Modal close function
    const closeShareModal = () => {
        shareUrlModal.style.display = 'none';
        shareUrlModal.classList.remove('active');
        console.log('[Share] Modal closed.');
        
        // Reset copy button text when modal closes
        if (copyBtnText) copyBtnText.textContent = 'Copy';
    };

    // Attach event listeners
    shareModalClose?.addEventListener('click', closeShareModal);
    shareModalCancel?.addEventListener('click', closeShareModal);
    
    // Close when clicking outside
    shareUrlModal?.addEventListener('click', (e) => {
        if (e.target === shareUrlModal) closeShareModal();
    });
    
    // FIXED: Copy button functionality
    copyShareUrlBtn?.addEventListener('click', () => {
        const textToCopy = shareUrlInput.value;
        
        // Skip empty text
        if (!textToCopy || textToCopy.includes('Error:')) {
            if (typeof showAlert === 'function') {
                showAlert('Nothing to copy: URL generation failed', 'error');
            }
            return;
        }
        
        // Use clipboard API with fallback
        const copyText = () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(textToCopy)
                    .then(() => true)
                    .catch(err => {
                        console.error('[Share] Clipboard API error:', err);
                        return false;
                    });
            } else {
                // Fallback for browsers without clipboard API
                try {
                    shareUrlInput.select();
                    shareUrlInput.setSelectionRange(0, 99999);
                    const success = document.execCommand('copy');
                    if (success) {
                        return Promise.resolve(true);
                    } else {
                        return Promise.resolve(false);
                    }
                } catch (err) {
                    console.error('[Share] execCommand copy error:', err);
                    return Promise.resolve(false);
                }
            }
        };
        
        // Execute copy and show feedback
        copyText().then(success => {
            if (success) {
                // Update button text for feedback
                if (copyBtnText) {
                    copyBtnText.textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtnText.textContent = 'Copy';
                    }, 2000);
                }
                
                // Show toast notification
                if (typeof showToast === 'function') {
                    showToast({
                        message: 'Share URL copied to clipboard! ✓',
                        type: 'success',
                        duration: 2000
                    });
                }
                console.log('[Share] URL copied successfully');
            } else {
                // Show error
                if (typeof showAlert === 'function') {
                    showAlert('Failed to copy URL to clipboard', 'error');
                }
                console.error('[Share] Copy failed');
            }
        });
    });

    // QR code download button
    downloadQrCodeBtn?.addEventListener('click', () => {
        try {
            // Find QR code canvas
            const canvas = qrCodeDisplay.querySelector('canvas');
            if (!canvas) {
                console.error('[Share] QR canvas not found');
                return;
            }
            
            // Convert to image and download
            const dataURL = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataURL;
            a.download = 'logomaker-qr.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            console.log('[Share] QR downloaded');
            
            // Show notification
            if (typeof showToast === 'function') {
                showToast({
                    message: 'QR Code downloaded!',
                    type: 'success',
                    duration: 2000
                });
            }
        } catch (err) {
            console.error('[Share] QR download error:', err);
            if (typeof showAlert === 'function') {
                showAlert('QR download failed', 'error');
            }
        }
    });

    console.log('[Share] Share URL Modal setup complete.');
}

// Initialize Share URL Modal Logic on Load
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', setupShareUrlModal); }
else { setupShareUrlModal(); }

// Expose handler globally for main.js binding
window.handleShareUrlClick = () => { const shareBtn = document.getElementById('shareUrlBtn'); shareBtn?.click(); }; // Simple trigger

console.log("[Misc v6] Utilities ready.");