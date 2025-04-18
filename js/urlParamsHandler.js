/**
 * urlParamsHandler.js - Fixed version
 * 
 * Handles loading settings from URL parameters and provides URL generation for sharing.
 */

// Make sure we have access to the required modules
import SettingsManager from './settingsManager.js';
import { showToast, showAlert } from './notificationsDropInAlerts.js';

console.log('[URLParams] Initializing URL parameters handler...');

// Function to initialize parameters - will be called after fully loaded
function initUrlParamsHandler() {
    console.log('[URLParams] Processing URL parameters...');
    
    // First check if we have URL parameters to process
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.toString()) {
        console.log('[URLParams] Found URL parameters:', urlParams.toString());
        loadSettingsFromURL(urlParams);
    } else {
        console.log('[URLParams] No URL parameters found.');
    }
}

/**
 * Loads settings from URL parameters and applies them
 */
function loadSettingsFromURL(urlParams) {
    // Ensure SettingsManager is initialized
    if (!SettingsManager || !SettingsManager._isInitialized) {
        console.warn('[URLParams] SettingsManager not ready, waiting...');
        // Try again after a short delay
        setTimeout(() => loadSettingsFromURL(urlParams), 300);
        return;
    }
    
    // Get current and default settings as base
    const currentSettings = SettingsManager.getCurrentSettings();
    const defaults = SettingsManager.getDefaults();
    
    // Create a new settings object starting with current settings
    const newSettings = { ...currentSettings };
    let changesMade = false;
    
    // Process all parameters
    for (const [key, value] of urlParams.entries()) {
        // Skip empty values
        if (!value) continue;
        
        // Check if this is a valid setting key
        if (newSettings.hasOwnProperty(key)) {
            changesMade = true;
            
            // Handle different types of settings
            if (key === 'useColor3' || key === 'exportTransparent' || key === 'aspectRatioLock') {
                // Boolean values are stored as "1" or "0" in URL
                newSettings[key] = value === '1' || value === 'true';
                console.log(`[URLParams] Set boolean ${key} = ${newSettings[key]}`);
            } 
            else if (key.toLowerCase().includes('color') && !value.startsWith('#')) {
                // Color values have # stripped for URL length, add it back
                newSettings[key] = `#${value}`;
                console.log(`[URLParams] Set color ${key} = ${newSettings[key]}`);
            }
            else if (['fontSize', 'exportWidth', 'exportHeight', 'exportQuality', 'exportFrames', 
                      'exportFrameRate', 'borderWidth', 'borderPadding', 'fontWeight'].includes(key)) {
                // Number values
                newSettings[key] = String(parseInt(value, 10));
                console.log(`[URLParams] Set numeric ${key} = ${newSettings[key]}`);
            }
            else if (['letterSpacing', 'animationSpeed', 'bgOpacity', 'textOpacity', 'rotation', 
                      'animationDirection', 'bgGradientDirection'].includes(key)) {
                // Float values
                newSettings[key] = String(parseFloat(value));
                console.log(`[URLParams] Set float ${key} = ${newSettings[key]}`);
            }
            else {
                // String values
                newSettings[key] = value;
                console.log(`[URLParams] Set string ${key} = ${newSettings[key]}`);
            }
        } else {
            console.warn(`[URLParams] Unknown parameter: ${key}`);
        }
    }
    
    // Only apply if we made changes
    if (changesMade) {
        console.log('[URLParams] Applying settings from URL parameters');
        
        // Apply the settings with UI update
        SettingsManager.applySettings(newSettings, true)
            .then(() => {
                // Notify the user
                setTimeout(() => {
                    if (typeof showToast === 'function') {
                        showToast({
                            message: 'Settings loaded from shared URL! 🔄',
                            type: 'info',
                            duration: 4000
                        });
                    } else if (typeof showAlert === 'function') {
                        showAlert('Settings loaded from shared URL!', 'info');
                    }
                }, 1000); // Slight delay for better UX
            })
            .catch(err => {
                console.error('[URLParams] Error applying settings:', err);
            });
    } else {
        console.log('[URLParams] No settings changes from URL parameters');
    }
}

/**
 * Generates a URL with current settings
 * This is a utility function that can be called from other modules if needed
 */
export function generateShareURL() {
    if (!SettingsManager._isInitialized) {
        console.error("[URLParams] SettingsManager not ready to generate URL.");
        return null;
    }
    
    try {
        const baseUrl = window.location.origin + window.location.pathname;
        const currentSettings = SettingsManager.getCurrentSettings();
        const defaults = SettingsManager.getDefaults();
            
        const params = new URLSearchParams();
        
        // Relevant settings keys to include in URL
        const relevantKeys = [
            'logoText', 'fontFamily', 'fontSize', 'letterSpacing', 'textCase', 'fontWeight',
            'textColorMode', 'solidColorPicker', 'gradientPreset', 'color1', 'color2', 
            'useColor3', 'color3', 'animationDirection',
            'textShadow', 'borderColorPicker', 'borderStyle', 'textAlign', 'rotation',
            'textAnimation', 'animationSpeed',
            'backgroundType', 'backgroundColor', 'bgOpacity', 'backgroundGradientPreset', 
            'bgColor1', 'bgColor2', 'bgGradientDirection'
        ];

        // Add parameters that differ from defaults
        relevantKeys.forEach(key => {
            if (currentSettings.hasOwnProperty(key) && 
                currentSettings[key] !== undefined && 
                currentSettings[key] !== null) {
                
                // Only add if different from default or if key is essential
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
                }
            }
        });

        return `${baseUrl}?${params.toString()}`;
    } catch (err) {
        console.error("[URLParams] Error generating URL:", err);
        return null;
    }
}

// Set up an event to run after the SettingsManager is initialized
document.addEventListener('logomaker-settings-applied', initUrlParamsHandler, { once: true });

// Also add a direct initialization after a delay as fallback
setTimeout(() => {
    if (!document.querySelector('.logomaker-initialized')) {
        console.log('[URLParams] Fallback initialization after timeout');
        initUrlParamsHandler();
    }
}, 1500);

// Expose the URL generation function globally
window.generateShareURL = generateShareURL;

console.log('[URLParams] URL parameters handler initialized');