/**
 * misc.js
 * ============================================================
 * Contains miscellaneous utility functions:
 * - Theme Toggle
 * - Size Indicator Update
 * - Keyframes Extraction
 * - Share Modal Setup & Opening
 * - Throttle Utility
 * - Tooltip Setup (Placeholder)
 */

// Ensure SettingsManager is imported for functions that need it
import SettingsManager from './settingsManager.js';
// Import notification functions if needed locally (or rely on main.js providing them)
import { showToast, showAlert } from './notificationsDropInAlerts.js'; // Assuming export

console.log("[Misc v9] Module loaded.");

// --- Utility Functions ---

/**
 * Basic throttling function.
 * @param {Function} func - Function to throttle.
 * @param {number} limit - Throttle limit in milliseconds.
 * @returns {Function} Throttled function.
 */
export function throttle(func, limit) { // EXPORTED
    let inThrottle;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/** Updates the width/height display */
export function updateSizeIndicator() { // EXPORTED
    requestAnimationFrame(() => {
        const logoText = document.querySelector('.logo-text');
        const widthIndicator = document.getElementById('logoWidth');
        const heightIndicator = document.getElementById('logoHeight');
        if (!logoText || !widthIndicator || !heightIndicator) return;
        try {
            const rect = logoText.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                widthIndicator.textContent = Math.round(rect.width);
                heightIndicator.textContent = Math.round(rect.height);
            }
        } catch (e) {
            console.error("[Misc] Error updating size indicator:", e);
        }
    });
}

/** Theme Toggle Setup - Called by main.js */
export function setupThemeToggle() { // EXPORTED
    console.log('[Theme] setupThemeToggle running...');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (!themeToggleBtn) {
        console.warn("[Theme] Toggle button #themeToggleBtn not found.");
        return;
    }
    // Prevent duplicate listeners if called again
    if (themeToggleBtn.dataset.themeListenerAttached === 'true') return;

    const sunIcon = themeToggleBtn.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn.querySelector('.moon-icon');
    const themeToggleText = themeToggleBtn.querySelector('.theme-toggle-text'); // Optional text element
    const themeStorageKey = 'logomakerThemePreference_v1'; // Keep versioning consistent
    let savedTheme = localStorage.getItem(themeStorageKey);
    let systemPrefersLight = window.matchMedia?.('(prefers-color-scheme: light)')?.matches;
    let initialTheme;

    console.log(`[Theme] Saved theme ('${themeStorageKey}'):`, savedTheme);
    console.log(`[Theme] System prefers light:`, systemPrefersLight);

    if (savedTheme === 'light' || savedTheme === 'dark') {
        initialTheme = savedTheme;
        console.log(`[Theme] Using saved theme: ${initialTheme}`);
    } else {
        initialTheme = systemPrefersLight ? 'light' : 'dark';
        console.log(`[Theme] Using system preference: ${initialTheme}`);
    }

    const applyTheme = (theme) => { // Removed isInitial logic, save on every apply
        const isLight = theme === 'light';
        console.log(`[Theme] Applying theme: ${theme}.`);
        document.body.classList.toggle('light-mode', isLight);
        if (sunIcon) sunIcon.style.display = isLight ? 'none' : 'inline-block';
        if (moonIcon) moonIcon.style.display = isLight ? 'inline-block' : 'none';
        const nextThemeName = isLight ? 'Dark' : 'Light';
        if (themeToggleText) themeToggleText.textContent = nextThemeName; // Update accessible text if exists
        themeToggleBtn?.setAttribute('title', `Switch to ${nextThemeName} Mode`);
        themeToggleBtn?.setAttribute('aria-label', `Switch to ${nextThemeName} Mode`);
        localStorage.setItem(themeStorageKey, theme); // Always save the applied theme
        console.log(`[Theme] Saved preference: ${theme}`);
    };

    themeToggleBtn.addEventListener('click', () => {
        const current = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        const newTheme = current === 'light' ? 'dark' : 'light';
        console.log(`[Theme] Toggle clicked! Changing to ${newTheme}`);
        applyTheme(newTheme);
    });

    // Apply initial theme without saving it again if it came from storage
    applyTheme(initialTheme);
    localStorage.setItem(themeStorageKey, initialTheme); // Ensure initial state is saved too

    // System preference listener
    try {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        const systemChangeListener = (e) => {
            const prefersLight = e.matches;
            console.log(`[Theme] System preference changed. Prefers light: ${prefersLight}`);
            // Only apply if NO preference is saved in localStorage
            if (!localStorage.getItem(themeStorageKey)) {
                console.log("[Theme] Applying system theme change (no saved preference).");
                applyTheme(prefersLight ? 'light' : 'dark');
            } else {
                console.log("[Theme] Ignoring system theme change (user preference saved).");
            }
        };
        // Use addEventListener for modern browsers
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', systemChangeListener);
        } else if (mediaQuery.addListener) { // Deprecated fallback
            mediaQuery.addListener(systemChangeListener);
        }
    } catch (e) {
        console.warn("[Theme] System preference listener failed:", e);
    }
    themeToggleBtn.dataset.themeListenerAttached = 'true'; // Mark as attached
    console.log('[Theme] Toggle Initialized.');
}

/** Animation Keyframes - Gets CSS text for @keyframes */
const FALLBACK_KEYFRAMES = { // Keep fallbacks updated with effects.css
    'pulse': `@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.9}}`,
    'bounce': `@keyframes bounce{0%,100%{transform:translateY(0);animation-timing-function:cubic-bezier(0.5,0,0.5,1)}50%{transform:translateY(-15px);animation-timing-function:cubic-bezier(0.5,0,0.5,1)}}`,
    'shake': `@keyframes shake{0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-4px) rotate(-0.5deg)}20%,40%,60%,80%{transform:translateX(4px) rotate(0.5deg)}}`,
    'float': `@keyframes float{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-15px) rotate(1deg)}}`,
    'rotate': `@keyframes rotate{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`,
    'wave': `@keyframes wave{0%,100%{transform:skewX(0) skewY(0)}25%{transform:skewX(5deg) skewY(1deg)}75%{transform:skewX(-5deg) skewY(-1deg)}}`,
    'glitch-1': `@keyframes glitch-1{0%,100%{clip-path:inset(50% 0 30% 0);transform:translate(-4px,1px) scaleY(1.02)}20%{clip-path:inset(10% 0 80% 0);transform:translate(3px,-2px) scaleY(0.98)}40%{clip-path:inset(70% 0 5% 0);transform:translate(-3px,2px) scaleY(1.01)}60%{clip-path:inset(45% 0 45% 0);transform:translate(4px,-1px) scaleY(0.99)}80%{clip-path:inset(85% 0 10% 0);transform:translate(-2px,1px) scaleY(1.03)}}`,
    'glitch-2': `@keyframes glitch-2{0%,100%{clip-path:inset(40% 0 50% 0);transform:translate(3px,-1px) scaleY(0.98)}20%{clip-path:inset(90% 0 5% 0);transform:translate(-4px,2px) scaleY(1.02)}40%{clip-path:inset(15% 0 70% 0);transform:translate(2px,-2px) scaleY(0.99)}60%{clip-path:inset(60% 0 30% 0);transform:translate(-3px,1px) scaleY(1.01)}80%{clip-path:inset(5% 0 80% 0);transform:translate(3px,-1px) scaleY(1.03)}}`,
    'fadeInOut': `@keyframes fadeInOut{0%,100%{opacity:0.3}50%{opacity:1}}`,
    'subtleRotate3D': `@keyframes subtleRotate3D{0%,100%{transform:perspective(500px) rotateX(0deg) rotateY(0deg)}50%{transform:perspective(500px) rotateX(8deg) rotateY(12deg) translateZ(10px)}}`,
    'flicker': `@keyframes flicker{0%,18%,22%,25%,53%,57%,100%{opacity:1;text-shadow:inherit}20%,24%,55%{opacity:0.6;text-shadow:none}}`,
    'typing': `@keyframes typing{from{width:0}to{width:100%}}`,
    'caretBlink': `@keyframes caretBlink{50%{border-color:transparent}}`,
    'textRevealClip': `@keyframes textRevealClip{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}`,
    'blurInOut': `@keyframes blurInOut{0%,100%{filter:blur(5px);opacity:0}50%{filter:blur(0);opacity:1}}`,
    'zoomInOut': `@keyframes zoomInOut{0%,100%{transform:scale(0.8);opacity:0}50%{transform:scale(1);opacity:1}}`
};
export function getActiveAnimationKeyframes(animationName) { // EXPORTED
    if (!animationName || typeof animationName !== 'string' || animationName === 'none') return null;
    // Normalize name (remove anim- prefix if present)
    const keyframeName = animationName.startsWith('anim-') ? animationName.substring(5) : animationName;
    if (!keyframeName || keyframeName === 'none') return null;

    console.log(`[Misc] Searching for @keyframes rule: '${keyframeName}'`);
    try {
        for (const sheet of document.styleSheets) {
            if (sheet.disabled || (!sheet.href && !sheet.ownerNode)) continue;
            let rules;
            try { rules = sheet.cssRules || sheet.rules; if (!rules) continue; } catch (e) { continue; } // Skip inaccessible sheets

            for (const rule of rules) {
                // Check for direct @keyframes rule
                if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === keyframeName) {
                    console.log(`[Misc] Found @keyframes '${keyframeName}' in stylesheet: ${sheet.href || 'Inline/Embedded'}`);
                    return rule.cssText;
                }
                // TODO: Potentially search inside @media or @supports rules if needed
            }
        }
    } catch (error) {
        console.error('[Misc] Error searching stylesheets for keyframes:', error);
    }

    // Use fallback if not found in stylesheets
    if (FALLBACK_KEYFRAMES[keyframeName]) {
        console.warn(`[Misc] Keyframes '${keyframeName}' not found in CSS. Using fallback definition.`);
        return FALLBACK_KEYFRAMES[keyframeName];
    }

    console.warn(`[Misc] No keyframes rule found or fallback defined for animation: '${keyframeName}'`);
    return null;
}

// --- Share URL Functionality ---

/** Opens the Share Modal and populates it with the current configuration URL */
export function openShareModal() { // EXPORTED
    console.log('[Share] openShareModal called...');

    const shareUrlModal = document.getElementById('shareUrlModal');
    const shareUrlInput = document.getElementById('shareUrlInput');
    const qrCodeDisplay = document.getElementById('qrCodeDisplay');
    const downloadQrCodeBtn = document.getElementById('downloadQrCode');
    const shareTwitter = document.getElementById('shareTwitter');
    const shareFacebook = document.getElementById('shareFacebook');
    const shareEmail = document.getElementById('shareEmail');

    if (!shareUrlModal || !shareUrlInput) {
        console.error("[Share] Cannot open modal, core elements not found.");
        showAlert("Cannot open share dialog: UI elements missing.", "error");
        return;
    }

    // Use the imported SettingsManager
    if (!SettingsManager || typeof SettingsManager.getCurrentSettings !== 'function') {
        console.error("[Share] SettingsManager not available.");
        showAlert("Cannot generate share URL: Settings Manager error.", "error");
        shareUrlInput.value = "Error: Settings unavailable";
        return;
    }

    // --- Generate URL ---
    let generatedUrl = '';
    try {
        const baseUrl = window.location.origin + window.location.pathname;
        const currentSettings = SettingsManager.getCurrentSettings();
        const defaults = SettingsManager.getDefaults();
        const params = new URLSearchParams();

        // Define keys relevant for sharing visual appearance
        const relevantKeys = [
            'logoText', 'fontFamily', 'fontSize', 'letterSpacing', 'textCase', 'fontWeight',
            'textColorMode', 'solidColorPicker', 'gradientPreset', 'color1', 'color2', 'useColor3', 'color3', 'animationDirection',
            'textShadow', 'borderColorPicker', 'borderStyle', 'textAlign', 'rotation',
            'textAnimation', 'animationSpeed',
            'backgroundType', 'backgroundColor', 'bgOpacity', 'backgroundGradientPreset', 'bgColor1', 'bgColor2', 'bgGradientDirection'
            // Exclude export settings like exportWidth, exportQuality etc.
        ];

        relevantKeys.forEach(key => {
            if (currentSettings.hasOwnProperty(key) && currentSettings[key] !== undefined && currentSettings[key] !== null) {
                const isEssential = ['logoText', 'fontFamily'].includes(key); // Always include these
                const isDifferentFromDefault = !defaults.hasOwnProperty(key) || String(currentSettings[key]) !== String(defaults[key]);

                if (isEssential || isDifferentFromDefault) {
                    let value = currentSettings[key];
                    if (typeof value === 'boolean') value = value ? '1' : '0';
                    else if (typeof value === 'string' && value.startsWith('#')) value = value.substring(1); // Remove # from colors
                    params.append(key, value);
                }
            }
        });

        // Ensure at least logoText is present if all else is default
        if (!params.has('logoText')) params.append('logoText', currentSettings.logoText || 'Logo');

        generatedUrl = `${baseUrl}?${params.toString()}`;
        shareUrlInput.value = generatedUrl;
        console.log(`[Share] Generated URL (${generatedUrl.length} chars)`);

    } catch (err) {
        console.error("[Share] Error generating share URL:", err);
        shareUrlInput.value = "Error generating URL.";
        generatedUrl = ''; // Ensure URL is empty on error
    }

    // --- Update Social Links & QR Code ---
    if (generatedUrl) {
        const encodedUrl = encodeURIComponent(generatedUrl);
        const shareText = encodeURIComponent("Check out this logo I designed with Logomaker by Manic!");
        const shareTitle = encodeURIComponent("Logomaker Design");

        if (shareTwitter) shareTwitter.href = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${shareText}`;
        if (shareFacebook) shareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        if (shareEmail) shareEmail.href = `mailto:?subject=${shareTitle}&body=${encodeURIComponent(shareText + '\n\n' + generatedUrl)}`;

        // Generate QR Code (requires QRCode library loaded globally or imported)
        if (qrCodeDisplay) {
            qrCodeDisplay.innerHTML = '<div class="qr-placeholder">Generating QR...</div>';
            if (downloadQrCodeBtn) downloadQrCodeBtn.disabled = true;

            if (typeof QRCode === 'undefined') { // Check if library exists
                console.warn('[Share] QRCode library not found. Cannot generate QR code.');
                qrCodeDisplay.innerHTML = '<div class="qr-placeholder" style="font-size: 0.8em; color: #888;">QR Code library not loaded.</div>';
            } else {
                // Use timeout to ensure modal is visible before QR gen attempts DOM manipulation
                setTimeout(() => {
                    try {
                        qrCodeDisplay.innerHTML = ''; // Clear placeholder
                        new QRCode(qrCodeDisplay, {
                            text: generatedUrl, width: 160, height: 160,
                            colorDark: "#000000", colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.M
                        });
                        if (downloadQrCodeBtn) downloadQrCodeBtn.disabled = false;
                        console.log('[Share] QR Code generated.');
                    } catch (qrError) {
                        console.error('[Share] QR generation failed:', qrError);
                        qrCodeDisplay.innerHTML = '<div class="qr-placeholder">QR Generation Failed</div>';
                        if (downloadQrCodeBtn) downloadQrCodeBtn.disabled = true;
                    }
                }, 50); // Small delay
            }
        }
    } else {
        // Disable sharing options if URL generation failed
        if (shareTwitter) shareTwitter.removeAttribute('href');
        if (shareFacebook) shareFacebook.removeAttribute('href');
        if (shareEmail) shareEmail.removeAttribute('href');
        if (qrCodeDisplay) qrCodeDisplay.innerHTML = '<div class="qr-placeholder">URL Error</div>';
        if (downloadQrCodeBtn) downloadQrCodeBtn.disabled = true;
    }

    // Show modal
    shareUrlModal.style.display = 'flex';
    requestAnimationFrame(() => { shareUrlModal.classList.add('active'); });
    console.log('[Share] Modal Opened.');
}

/** Sets up listeners and elements for the Share Modal - Called by main.js */
function setupShareUrlModal() { // Renamed, NOT exported directly, called internally or by main if needed
    console.log('[Share] Initializing Share URL Modal setup...');

    const shareUrlModal = document.getElementById('shareUrlModal');
    const shareUrlInput = document.getElementById('shareUrlInput');
    const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
    const copyBtnText = copyShareUrlBtn?.querySelector('span');
    const shareModalClose = document.getElementById('shareModalClose');
    const shareModalCancel = document.getElementById('shareModalCancel');
    const qrCodeDisplay = document.getElementById('qrCodeDisplay'); // Needed for download btn listener
    const downloadQrCodeBtn = document.getElementById('downloadQrCode');

    if (!shareUrlModal || !shareUrlInput || !copyShareUrlBtn || !shareModalClose || !shareModalCancel || !downloadQrCodeBtn) {
        console.warn('[Share] Setup failed: One or more required Share URL modal elements are missing.');
        return; // Don't attach listeners if elements are missing
    }

    // --- Prevent duplicate listener attachment ---
    if (shareUrlModal.dataset.shareListenersAttached === 'true') {
         console.log('[Share] Listeners already attached.');
         return;
    }

    const closeShareModal = () => {
        shareUrlModal.style.display = 'none';
        shareUrlModal.classList.remove('active');
        if (copyBtnText) copyBtnText.textContent = 'Copy'; // Reset button text
    };

    shareModalClose.addEventListener('click', closeShareModal);
    shareModalCancel.addEventListener('click', closeShareModal);
    shareUrlModal.addEventListener('click', (e) => { if (e.target === shareUrlModal) closeShareModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && shareUrlModal.classList.contains('active')) closeShareModal(); });

    // Copy button functionality
    copyShareUrlBtn.addEventListener('click', () => {
        const textToCopy = shareUrlInput.value;
        if (!textToCopy || textToCopy.includes('Error')) {
            showAlert('Nothing to copy: URL generation failed', 'error'); return;
        }
        navigator.clipboard.writeText(textToCopy).then(() => {
            if (copyBtnText) { copyBtnText.textContent = 'Copied!'; setTimeout(() => { copyBtnText.textContent = 'Copy'; }, 2000); }
            showToast({ message: 'Share URL copied! ✓', type: 'success', duration: 2000 });
            console.log('[Share] URL copied successfully');
        }).catch(err => {
            console.error('[Share] Clipboard API error:', err);
            showAlert('Failed to copy URL. Check browser permissions or console.', 'error');
        });
    });

    // QR code download button
    downloadQrCodeBtn.addEventListener('click', () => {
        try {
            const canvas = qrCodeDisplay?.querySelector('canvas'); // QR code library generates a canvas
            if (!canvas) throw new Error('QR canvas element not found');
            const dataURL = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataURL;
            a.download = 'logomaker-share-qr.png';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            console.log('[Share] QR downloaded');
            showToast({ message: 'QR Code downloaded!', type: 'success', duration: 2000 });
        } catch (err) {
            console.error('[Share] QR download error:', err);
            showAlert(`QR download failed: ${err.message}`, 'error');
        }
    });

    shareUrlModal.dataset.shareListenersAttached = 'true'; // Mark as initialized
    console.log('[Share] Share URL Modal setup complete.');
}

// Initialize Share Modal listeners on DOM ready
// This ensures elements exist before attaching listeners.
// main.js should import and call openShareModal, not setupShareUrlModal directly.
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', setupShareUrlModal); }
else { setupShareUrlModal(); }


// --- Tooltip Setup (Placeholder) ---
export function setupTooltips() { // EXPORTED
    console.log("[Misc] Placeholder: Tooltip setup would go here.");
    // Add actual tooltip initialization logic (e.g., using Tippy.js or custom solution)
     // Example: document.querySelectorAll('.tooltip-trigger').forEach(...)
}

// JavaScript for copy/export functionality
document.getElementById('copyGeneratedCSS').addEventListener('click', function() {
    const generatedCSS = document.getElementById('generatedCSSCode').textContent;
    navigator.clipboard.writeText(generatedCSS).then(() => {
      // Show success message
      const btn = this;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="icon-check"></i> Copied!';
      setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    });
  });
  
  document.getElementById('exportGeneratedCSS').addEventListener('click', function() {
    const generatedCSS = document.getElementById('generatedCSSCode').textContent;
    const blob = new Blob([generatedCSS], {type: 'text/css'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logomaker-styles.css';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });


console.log("[Misc] Utilities initialized/exposed.");

// Removed: window.updateSizeIndicator = updateSizeIndicator;
// Removed: window.getActiveAnimationKeyframes = getActiveAnimationKeyframes;
// Removed: window.handleShareUrlClick = ...;