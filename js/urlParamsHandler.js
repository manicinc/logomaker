/**
 * urlParamsHandler.js
 * Handles URL parameters to load and share settings
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize URL parameters handling
    initUrlParamsHandler();
    
    // Add share button to the export actions
    // addShareButton();
});

/**
 * Initializes URL parameters handling
 */
function initUrlParamsHandler() {
    // Check if URL has parameters
    const queryParams = new URLSearchParams(window.location.search);
    
    // If we have settings parameter, try to load it
    if (queryParams.has('settings')) {
        try {
            const settingsParam = queryParams.get('settings');
            const decodedSettings = JSON.parse(decodeURIComponent(settingsParam));
            
            console.log('[URLParams] Loading settings from URL parameters');
            
            // Apply settings if SettingsManager is available
            if (window.SettingsManager && typeof window.SettingsManager.applySettings === 'function') {
                window.SettingsManager.applySettings(decodedSettings, true);
                
                // Show success notification
                if (typeof window.showToast === 'function') {
                    window.showToast({
                        message: 'Logo settings loaded from shared URL',
                        type: 'success',
                        title: 'Settings Loaded'
                    });
                }
            } else {
                console.error('[URLParams] SettingsManager not available to apply settings');
            }
        } catch (error) {
            console.error('[URLParams] Error parsing settings from URL:', error);
            
            // Show error notification
            if (typeof window.showToast === 'function') {
                window.showToast({
                    message: 'Failed to load settings from URL',
                    type: 'error',
                    title: 'Error'
                });
            }
        }
    }
}

// We have this in the UI now instead of dynamic
// /**
//  * Adds share button to the export actions
//  */
// function addShareButton() {
//     const exportActionsContainer = document.querySelector('.export-actions');
//     if (!exportActionsContainer) {
//         console.warn('[URLParams] Export actions container not found');
//         return;
//     }
    
//     // Create share button
//     const shareButton = document.createElement('button');
//     shareButton.id = 'shareSettingsBtn';
//     shareButton.title = 'Generate shareable URL with current settings';
//     shareButton.innerHTML = `
//         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//             <circle cx="18" cy="5" r="3"></circle>
//             <circle cx="6" cy="12" r="3"></circle>
//             <circle cx="18" cy="19" r="3"></circle>
//             <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
//             <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
//         </svg>
//         Share URL
//     `;
    
//     // Add styles to match other buttons
//     shareButton.style.background = 'linear-gradient(45deg, #8e44ad, #9b59b6)';
//     shareButton.style.color = 'white';
//     shareButton.style.border = 'none';
    
//     // Add click event
//     shareButton.addEventListener('click', generateShareableUrl);
    
//     // Add button to container
//     exportActionsContainer.appendChild(shareButton);
    
//     console.log('[URLParams] Share button added');
// }

/**
 * Generates a shareable URL with current settings
 */
function generateShareableUrl() {
    // Check if SettingsManager is available
    if (!window.SettingsManager || typeof window.SettingsManager.getCurrentSettings !== 'function') {
        console.error('[URLParams] SettingsManager not available');
        
        if (typeof window.showAlert === 'function') {
            window.showAlert('Cannot generate shareable URL: Settings manager not available', 'error');
        }
        return;
    }
    
    try {
        // Get current settings
        const currentSettings = window.SettingsManager.getCurrentSettings();
        
        // Create URL with settings
        const settingsParam = encodeURIComponent(JSON.stringify(currentSettings));
        const baseUrl = window.location.href.split('?')[0]; // Remove existing query params
        const shareableUrl = `${baseUrl}?settings=${settingsParam}`;
        
        // Check URL length (browsers have limits)
        if (shareableUrl.length > 2000) {
            console.warn('[URLParams] Generated URL is very long:', shareableUrl.length, 'characters');
            if (typeof window.showAlert === 'function') {
                window.showAlert('The generated URL is very long and may not work in all browsers', 'warning');
            }
        }
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareableUrl)
            .then(() => {
                if (typeof window.showToast === 'function') {
                    window.showToast({
                        message: 'Shareable URL copied to clipboard',
                        type: 'success',
                        title: 'URL Copied'
                    });
                } else {
                    alert('Shareable URL copied to clipboard');
                }
                console.log('[URLParams] Shareable URL copied to clipboard');
            })
            .catch(err => {
                console.error('[URLParams] Failed to copy URL to clipboard:', err);
                
                // Show URL in dialog if copy fails
                if (typeof window.showModal === 'function') {
                    window.showModal({
                        title: 'Shareable URL',
                        message: 'Copy this URL to share your logo settings:\n\n' + shareableUrl,
                        type: 'info'
                    });
                } else {
                    prompt('Copy this URL to share your logo settings:', shareableUrl);
                }
            });
    } catch (error) {
        console.error('[URLParams] Error generating shareable URL:', error);
        
        if (typeof window.showAlert === 'function') {
            window.showAlert('Failed to generate shareable URL: ' + error.message, 'error');
        }
    }
}

// Make functions globally available
window.initUrlParamsHandler = initUrlParamsHandler;
window.generateShareableUrl = generateShareableUrl;