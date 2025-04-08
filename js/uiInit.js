// js/ui-init.js (v1.1 - Added Enhanced License Display)
// Handles misc UI initializations like info notice, copyright, license display, etc.

// --- Info Notice Logic (Self-contained IIFE - handles its own timing) ---
(function() {
    function initInfoNotice() {
        const infoNotice = document.getElementById('info-notice');
        const hideNoticeBtn = document.getElementById('hideNoticeBtn');
        const infoButton = document.getElementById('infoButton');
        const infoTabs = infoNotice?.querySelectorAll('.info-tab');
        const infoContents = infoNotice?.querySelectorAll('.info-content');

        if (!infoNotice || !hideNoticeBtn || !infoButton || !infoTabs || !infoContents) {
            console.warn('[UI Init] Info notice elements missing.'); return;
        }

        const noticeStorageKey = 'logomakerHasSeenNotice_v2';
        const hasSeenNotice = localStorage.getItem(noticeStorageKey);

        // Logic to show/hide notice based on localStorage
        if (hasSeenNotice) {
            infoNotice.style.display = 'none';
            infoButton.classList.add('info-button-visible');
            infoButton.setAttribute('aria-expanded', 'false');
        } else {
            infoNotice.style.display = 'block';
            infoButton.classList.remove('info-button-visible');
            infoButton.setAttribute('aria-expanded', 'true');
            // Activate first tab
            const firstTab = infoNotice.querySelector('.info-tab');
            const firstContent = infoNotice.querySelector('.info-content');
            if (firstTab && !firstTab.classList.contains('active')) {
                infoTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
                infoContents.forEach(c => c.classList.remove('active'));
                firstTab.classList.add('active'); firstTab.setAttribute('aria-selected', 'true');
                if (firstContent) firstContent.classList.add('active');
            } else if (firstTab) {
                firstTab.setAttribute('aria-selected', 'true');
            }
        }

        // Hide button logic
        hideNoticeBtn.onclick = () => {
            infoNotice.classList.add('info-notice-hidden');
            localStorage.setItem(noticeStorageKey, 'true');
            setTimeout(() => {
                infoNotice.style.display = 'none'; infoButton.classList.add('info-button-visible');
                infoButton.setAttribute('aria-expanded', 'false'); infoNotice.classList.remove('info-notice-hidden');
            }, 300); // Match CSS transition if any
        };

        // Info button toggle logic
        infoButton.onclick = () => {
            const isVisible = infoNotice.style.display === 'block';
            if (isVisible) { hideNoticeBtn.onclick(); }
            else {
                infoNotice.style.display = 'block'; infoNotice.classList.remove('info-notice-hidden');
                infoButton.classList.remove('info-button-visible'); infoButton.setAttribute('aria-expanded', 'true');
            }
        };

        // Info Tabs click logic
        infoTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.dataset.infotab;
                infoTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
                infoContents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
                const contentEl = document.getElementById(`${targetId}-info`);
                if (contentEl) contentEl.classList.add('active');
            });
        });
        console.log("[UI Init] Info Notice setup complete.");
    }
    // Run info notice setup after DOM is ready
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initInfoNotice); }
    else { initInfoNotice(); }
})(); // End of IIFE for info notice


// --- Function to initialize other UI elements AFTER DOM is ready ---
function initializeMiscUI() {
    console.log("[UI Init] Running initializeMiscUI...");

    // GitHub stars fetch
    fetch('https://api.github.com/repos/manicinc/logomaker')
        .then(response => response.ok ? response.json() : Promise.reject('Network error'))
        .then(data => {
            const starCount = document.getElementById('github-star-count');
            if (starCount && data.stargazers_count !== undefined) {
                starCount.textContent = data.stargazers_count > 999 ? (data.stargazers_count / 1000).toFixed(1) + 'k' : data.stargazers_count;
            } else if (!starCount) {
                console.warn("[UI Init] GitHub star count element (#github-star-count) missing.");
            }
        })
        .catch(err => console.warn('Could not fetch GitHub stars:', err));

    // Set current year in footer copyright
    try {
        const currentYear = new Date().getFullYear();
        const startYear = 2024; // Or your project's start year
        const copyrightEl = document.getElementById('copyright-year');
        if (copyrightEl) { // Check if element exists
            copyrightEl.textContent = currentYear > startYear ? `-${String(currentYear).slice(-2)}` : '';
        } else {
            console.warn("[UI Init] Copyright year element (#copyright-year) missing.");
        }
    } catch (e) {
        console.error("[UI Init] Error setting copyright year:", e);
    }

    const clearLocalStorageButton = document.getElementById('clearLocalStorageBtn');
    const clearFontCacheButton = document.getElementById('clearFontCacheBtn');

    if (clearLocalStorageButton) {
        clearLocalStorageButton.addEventListener('click', () => {
            if (confirm('Clear all saved Logomaker UI settings?\n\nThis will reset your colors, selected fonts, effects, etc., to default on next refresh.')) {
                try {
                    console.log("Clearing localStorage keys starting with:", 'logomaker'); // Use your actual prefix if different
                    // Be specific to avoid clearing other sites' data if prefix is generic
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        // Add specific keys you know you use
                        if (key === 'logomakerSettings' || key === 'logomakerHasSeenNotice_v2' || key === 'logomakerThemePreference_v1' || key === 'logomaker_font_frequent_v1') {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => {
                        localStorage.removeItem(key);
                        console.log(`Removed localStorage item: ${key}`);
                    });

                    // Use global notification functions if they exist
                    if (typeof showToast === 'function') {
                        showToast({ message: 'Saved settings cleared! Refresh page to see defaults.', type: 'success' });
                    } else {
                         alert('Saved settings cleared! Please refresh the page.');
                    }
                } catch (e) {
                    console.error("Error clearing localStorage:", e);
                     if (typeof showAlert === 'function') {
                        showAlert('Failed to clear settings from localStorage.', 'error');
                     } else {
                        alert('Failed to clear settings.');
                     }
                }
            }
        });
         console.log('[UI Init] Clear localStorage listener attached.');
    } else {
         console.warn('[UI Init] Clear localStorage button (#clearLocalStorageBtn) missing.');
    }

    if (clearFontCacheButton) {
        clearFontCacheButton.addEventListener('click', async () => { // Make async
            if (confirm('Clear cached font data (IndexedDB)?\n\nThis might fix font loading issues but requires re-downloading font chunks later.')) {
                // Check if the clearing function exists (it should be added to fontManager.js)
                if (typeof window.clearFontCacheDB === 'function') {
                    try {
                         console.log("Attempting to clear font cache DB...");
                         await window.clearFontCacheDB(); // Call the function exposed by fontManager
                          if (typeof showToast === 'function') {
                              showToast({ message: 'Font cache cleared! Refresh recommended.', type: 'success' });
                          } else {
                              alert('Font cache cleared! Please refresh the page.');
                          }
                    } catch (e) {
                        console.error("Error clearing font cache DB:", e);
                        if (typeof showAlert === 'function') {
                           showAlert('Failed to clear font cache IndexedDB.', 'error');
                        } else {
                           alert('Failed to clear font cache.');
                        }
                    }
                } else {
                    console.error("clearFontCacheDB function not found on window. Was fontManager.js updated?");
                    if (typeof showAlert === 'function') {
                       showAlert('Error: Font cache clearing function not available.', 'error');
                    } else {
                       alert('Error: Font cache clearing function not available.');
                    }
                }
            }
        });
         console.log('[UI Init] Clear Font Cache listener attached.');
    } else {
         console.warn('[UI Init] Clear Font Cache button (#clearFontCacheBtn) missing.');
    }
    // --- END NEW: Cache Clearing Button Listeners ---

    // Modal Accessibility Observers
    try {
        const modalOverlays = document.querySelectorAll('.modal-overlay');
        if (modalOverlays.length > 0) {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                        const targetElement = mutation.target;
                        if (targetElement instanceof HTMLElement) {
                           const isVisible = targetElement.style.display !== 'none' && !targetElement.classList.contains('hidden');
                           const ariaHiddenValue = !isVisible;
                           if (targetElement.getAttribute('aria-hidden') !== String(ariaHiddenValue)) {
                               targetElement.setAttribute('aria-hidden', String(ariaHiddenValue));
                           }
                        }
                    }
                });
            });
            modalOverlays.forEach(overlay => {
                 if (overlay instanceof HTMLElement) {
                     const isInitiallyVisible = overlay.style.display !== 'none' && !overlay.classList.contains('hidden');
                     overlay.setAttribute('aria-hidden', String(!isInitiallyVisible));
                     observer.observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });
                 }
            });
            console.log(`[Accessibility] ARIA observers attached to ${modalOverlays.length} modal overlays.`);
        } else {
             console.log("[Accessibility] No modal overlays found to attach observers.");
        }
    } catch (error) {
        console.error("[Accessibility] Error setting up modal ARIA handling:", error);
    }

    // --- Font License Toggle Listener ---
    // This listener handles the expand/collapse action of the button.
    const licenseToggleButton = document.getElementById('fontLicenseToggle');
    const licenseFullTextDiv = document.getElementById('fontLicenseFullText');
    if (licenseToggleButton && licenseFullTextDiv) {
        licenseToggleButton.addEventListener('click', () => {
            const isExpanded = licenseToggleButton.getAttribute('aria-expanded') === 'true';
            licenseToggleButton.setAttribute('aria-expanded', String(!isExpanded));
            licenseFullTextDiv.hidden = isExpanded; // Toggle visibility using hidden attribute
            licenseToggleButton.classList.toggle('expanded', !isExpanded); // For styling arrow etc.
        });
        console.log('[UI Init] Font license toggle listener attached.');
    } else {
        console.warn('[UI Init] License toggle button or text div missing. Expansion will not work.');
    }
    // --- End Font License Toggle Listener ---

    console.log("[UI Init] initializeMiscUI complete.");
}

// --- Run initializeMiscUI after DOM is ready ---
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeMiscUI); }
else { initializeMiscUI(); }


// --- >>> NEW/UPDATED Font License Display Logic <<< ---
// This attaches to the font dropdown change event to UPDATE the license display content.
document.addEventListener('DOMContentLoaded', () => {
    // Delay slightly to ensure font dropdown and fontManager are likely initialized
    setTimeout(() => {
        const fontSelect = document.getElementById('fontFamily');
        const licenseContainer = document.getElementById('fontLicenseContainer'); // Overall container
        const licenseToggleButton = document.getElementById('fontLicenseToggle'); // The button
        const licenseSummarySpan = document.getElementById('fontLicenseSummary'); // Text inside button
        const licenseFullTextDiv = document.getElementById('fontLicenseFullText'); // Div holding the <pre>
        const licenseContentCode = document.getElementById('fontLicenseContent'); // The <code> inside <pre>
        const licenseLinkContainer = document.getElementById('fontLicenseLinkContainer'); // <p> holding the link
        const licenseFileLink = document.getElementById('fontLicenseFileLink'); // <a> tag for link

        // Check for essential elements needed for this feature
        if (!fontSelect || !licenseContainer || !licenseToggleButton || !licenseSummarySpan || !licenseFullTextDiv || !licenseContentCode || !licenseLinkContainer || !licenseFileLink) {
            console.warn("[License Display] Setup failed: One or more license UI elements are missing in the HTML.");
            // Hide container if essential parts are missing
            if(licenseContainer) licenseContainer.classList.add('hidden');
            return;
        }

        // Helper function to guess license type (simple version based on keywords)
        const guessLicenseType = (text, filename) => {
            const lowerText = text?.toLowerCase() || '';
            const lowerFilename = filename?.toLowerCase() || '';
            if (lowerText.includes('sil open font license') || lowerFilename.includes('ofl')) return 'OFL';
            if (lowerText.includes('apache license')) return 'Apache';
            if (lowerText.includes('mit license')) return 'MIT';
            if (lowerText.includes('ubuntu font licence')) return 'Ubuntu';
            // Add more common license checks here if needed (e.g., CC-BY, specific commercial licenses)
            return null; // Unknown type
        };

        // Function to update the display area based on selected font
        const updateLicenseDisplay = async () => {
            const selectedFontName = fontSelect.value;
            let licenseText = null;
            let licenseFilename = null;
            let fontData = null;

            // Reset and hide the license section before fetching new data
            licenseContainer.classList.add('hidden');       // Hide overall container
            licenseFullTextDiv.hidden = true;               // Collapse text area
            licenseToggleButton.setAttribute('aria-expanded', 'false'); // Reset accessibility state
            licenseToggleButton.classList.remove('expanded'); // Reset visual state
            licenseSummarySpan.textContent = "License Information"; // Reset button text
            licenseContentCode.textContent = "";            // Clear previous full text
            licenseLinkContainer.style.display = 'none';    // Hide file link

            if (!selectedFontName) return; // No font selected

            // Ensure fontManager's function is available
            if (typeof window.getFontDataAsync !== 'function') {
                 console.warn("[License Display] window.getFontDataAsync not found.");
                 return;
            }

            // Fetch font data asynchronously
            try {
                console.log(`[License Display] Getting data for: ${selectedFontName}`);
                fontData = await window.getFontDataAsync(selectedFontName);

                if (fontData) {
                    licenseText = fontData.licenseText; // Available in portable build
                    licenseFilename = fontData.licenseFile; // Relative path, potentially available in both
                } else {
                     console.warn(`[License Display] No font data returned for ${selectedFontName}`);
                }

            } catch (err) {
                console.error("[License Display] Error getting font data:", err);
                return; // Exit on error, container remains hidden
            }

            const hasLicenseText = !!licenseText && licenseText.trim() !== '';
            const hasLicenseFile = !!licenseFilename && licenseFilename.trim() !== '';

            // Only show the license section if we have either text or a filename
            if (hasLicenseText || hasLicenseFile) {
                console.log(`[License Display] Found license info for ${selectedFontName}. Text: ${hasLicenseText}, File: ${hasLicenseFile}`);
                licenseContainer.classList.remove('hidden'); // Show the container

                // Determine summary text for the button
                const filenamePart = licenseFilename.substring(licenseFilename.lastIndexOf('/') + 1);
                summaryText = `View License (${filenamePart})`;
                const guessedType = guessLicenseType(licenseText, licenseFilename);
                if (guessedType) {
                    summaryText = `View ${guessedType} License`;
                } else if (hasLicenseFile) {
                    // If type unknown but file exists, use filename
                    summaryText = `View License (${path.basename(licenseFilename)})`; // Requires 'path' or manual basename extraction
                    // Basic basename fallback:
                    // const filenamePart = licenseFilename.substring(licenseFilename.lastIndexOf('/') + 1);
                    // summaryText = `View License (${filenamePart})`;
                }
                licenseSummarySpan.textContent = summaryText;

                // Populate the hidden full text area (prefer text if available)
                if (hasLicenseText) {
                     licenseContentCode.textContent = licenseText;
                } else {
                     // If only filename exists (e.g., deploy build), put placeholder
                     licenseContentCode.textContent = `License details should be in the linked file:\n${licenseFilename}`;
                }

                 // Populate and show the link if file path exists
                 if (hasLicenseFile) {
                     // Construct URL relative to the HTML file's location
                     // Assumes 'fonts' dir is at the same level or below where index.html is served
                     licenseFileLink.href = `./${licenseFilename}`; // e.g., ./fonts/Orbitron/license.txt
                     licenseLinkContainer.style.display = 'block'; // Show the paragraph containing the link
                 }

            } else {
                // No license info found, container remains hidden (already set above)
                console.log(`[License Display] No license info found for ${selectedFontName}`);
            }
        };

        // Attach listener to font select dropdown change event
        if (fontSelect) {
            fontSelect.addEventListener('change', updateLicenseDisplay);
            // Initial display update for the default selected font on load
            console.log("[License Display] Performing initial license display check.");
            updateLicenseDisplay();
        } else {
             console.error("[License Display] Cannot attach listener: #fontFamily dropdown missing.");
        }

    }, 750); // Delay slightly more to be very sure settings/font managers are ready
});