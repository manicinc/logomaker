/**
 * urlParamsHandler.js - Fixed version
 * 
 * Handles loading settings from URL parameters and provides URL generation for sharing.
 * Fixes include:
 * 1. Proper handling of all parameter types (colors, numbers, booleans)
 * 2. Notification to the user when settings are loaded from URL
 * 3. Better integration with SettingsManager
 */

// Ensure this runs after DOM is ready but before user interaction
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initUrlParamsHandler, 100); // Small delay to ensure SettingsManager is ready
});

function initUrlParamsHandler() {
    console.log('[URLParams] Initializing URL parameters handler...');
    
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
    // Ensure SettingsManager is available
    const settingsManager = window.SettingsManager;
    if (!settingsManager || typeof settingsManager.getCurrentSettings !== 'function') {
        console.error('[URLParams] SettingsManager not available, cannot load settings from URL');
        return;
    }
    
    // Get current and default settings as base
    const currentSettings = settingsManager.getCurrentSettings();
    const defaults = typeof settingsManager.getDefaults === 'function' 
        ? settingsManager.getDefaults() 
        : {}; 
    
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
            if (key === 'useColor3' || key === 'exportTransparent') {
                // Boolean values are stored as "1" or "0" in URL
                newSettings[key] = value === '1' || value === 'true';
                console.log(`[URLParams] Set boolean ${key} = ${newSettings[key]}`);
            } 
            else if (key.toLowerCase().includes('color') && !value.startsWith('#')) {
                // Color values have # stripped for URL length, add it back
                newSettings[key] = `#${value}`;
                console.log(`[URLParams] Set color ${key} = ${newSettings[key]}`);
            }
            else if (['fontSize', 'exportWidth', 'exportHeight', 'exportQuality', 'exportFrames', 'exportFrameRate'].includes(key)) {
                // Number values
                newSettings[key] = String(parseInt(value, 10));
                console.log(`[URLParams] Set numeric ${key} = ${newSettings[key]}`);
            }
            else if (['letterSpacing', 'animationSpeed', 'bgOpacity'].includes(key)) {
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
        settingsManager.applySettings(newSettings, true);
        
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
    } else {
        console.log('[URLParams] No settings changes from URL parameters');
    }
}

/**
 * Generates a URL with current settings
 * This is a utility function that can be called from other modules if needed
 */
export function generateShareURL() {
    const settingsManager = window.SettingsManager;
    if (!settingsManager || typeof settingsManager.getCurrentSettings !== 'function') {
        console.error("[URLParams] SettingsManager not available to generate URL.");
        return null;
    }
    
    try {
        const baseUrl = window.location.origin + window.location.pathname;
        const currentSettings = settingsManager.getCurrentSettings();
        const defaults = typeof settingsManager.getDefaults === 'function' 
            ? settingsManager.getDefaults() 
            : {};
            
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

// Expose the URL generation function globally
window.generateShareURL = generateShareURL;

console.log('[URLParams] URL parameters handler initialized');