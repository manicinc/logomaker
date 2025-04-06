/**
 * Enhanced Loading Overlay for Logomaker
 * 
 * This implementation adds a progress bar and improved status messages
 * to the loading overlay.
 */

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('loading-overlay');
    const statusElement = document.getElementById('loading-status');
    const progressBar = document.getElementById('loading-progress-bar');
    
    if (!overlay || !statusElement) {
        console.error("CRITICAL: Loading overlay elements not found!");
        return;
    }
    
    console.log("Loading overlay script attached.");
    
    let hideTimeout = null;
    
    const updateStatus = (message) => {
        if (statusElement) statusElement.textContent = message;
    };
    
    const updateProgress = (percent) => {
        if (progressBar) {
            progressBar.style.width = percent + '%';
            progressBar.setAttribute('aria-valuenow', percent);
        }
    };
    
    const hideOverlay = (delay = 1500) => {
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            if (overlay) overlay.classList.add('hidden');
        }, delay);
    };
    
    // Listen for font loading events
    window.addEventListener('logomaker:font-loading-started', () => {
        console.log('UI: Font loading started event received.');
        updateStatus('Initializing font library...');
        updateProgress(10);
        overlay.classList.remove('hidden');
    }, { once: false });
    
    window.addEventListener('logomaker:font-loading-progress', (event) => {
        const { percent, message } = event.detail || {};
        if (typeof percent === 'number') updateProgress(percent);
        if (message) updateStatus(message);
        console.log(`UI: Font loading progress: ${percent}% - ${message}`);
    }, { once: false });
    
    window.addEventListener('logomaker:font-loading-complete', (event) => {
        console.log('UI: Font loading complete event received.', event.detail);
        const { success, mode, fontCount, error } = event.detail || {};
        
        updateProgress(100);
        
        let statusMsg = 'Font loading finished.';
        let hideDelay = 1500;
        
        if (success) {
            if (mode === 'chunked') {
                statusMsg = `Optimized loading ready (${fontCount || 0} fonts indexed).`;
            } else if (mode === 'inline') {
                statusMsg = `Portable mode ready (${fontCount || 0} fonts embedded).`;
            } else if (mode === 'traditional') {
                statusMsg = `Loaded ${fontCount || 0} fonts from JSON.`;
            } else if (mode === 'cached') {
                statusMsg = `Ready! Using ${fontCount || 0} cached fonts.`;
            } else {
                statusMsg = `Fonts loaded (${fontCount || 'unknown'} fonts).`;
            }
        } else {
            if (mode === 'fallback') {
                statusMsg = 'Using system fonts (loading issue).';
            } else {
                statusMsg = `Font loading error: ${error || 'Unknown'}. Using fallbacks.`;
            }
            hideDelay = mode === 'error' ? 4000 : 3000;
        }
        
        updateStatus(statusMsg);
        hideOverlay(hideDelay);
    }, { once: false });
    
    // Timeout safety
    setTimeout(() => {
        if (overlay && !overlay.classList.contains('hidden')) {
            console.warn("Font loading seems stuck or events missed, hiding overlay.");
            updateStatus("Initialization taking longer than expected...");
            updateProgress(90); // Show high percentage even though we don't know the actual progress
            hideOverlay(2000);
        }
    }, 15000); // 15 seconds timeout
    
    updateStatus('Initializing application interface...');
    updateProgress(5); // Starting progress
});