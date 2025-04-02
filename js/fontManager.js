/**
 * fontManager.js (v6 - Fixed Font Data Access)
 * ================================================
 * Loads font data, populates dropdown, resolves when done.
 * Fixed: Added proper global font data access for SVG export.
 */

// Minimal fallback fonts if loading fails or no data is found
const SYSTEM_FONTS_FALLBACK = [
    { value: 'Arial', text: 'Arial' }, { value: 'Verdana', text: 'Verdana' },
    { value: 'Tahoma', text: 'Tahoma' }, { value: 'Times New Roman', text: 'Times New Roman' },
    { value: 'Georgia', text: 'Georgia' }, { value: 'Courier New', text: 'Courier New' }
];
// Preferred web fonts (ensure these match names in your data if possible)
const WEB_FONTS_FALLBACK = [
    { value: 'Orbitron', text: 'Orbitron' }, { value: 'Audiowide', text: 'Audiowide' },
    { value: 'Russo One', text: 'Russo One' }, { value: 'Press Start 2P', text: 'Press Start 2P' }
];
let _fontDataCache = null; // Cache loaded font data

/**
 * Loads font data from inline script or fetches from JSON file.
 * @returns {Promise<Array>} A promise resolving with the font data array.
 * @private
 */
async function _loadFontData() {
    if (_fontDataCache) return _fontDataCache; // Return cached data if available

    console.log('[FontMan] Loading font data...');

    // 1. Prioritize inline data (for single-file builds)
    if (Array.isArray(window._INLINE_FONTS_DATA) && window._INLINE_FONTS_DATA.length > 0) {
        console.log('[FontMan] Using inline font data.');
        _fontDataCache = window._INLINE_FONTS_DATA;
        return _fontDataCache;
    }

    // 2. Attempt to fetch from standard JSON locations
    console.warn('[FontMan] Inline font data not found or empty. Attempting to fetch fonts.json...');
    const pathsToTry = ['./fonts/fonts.json', './fonts.json', 'fonts.json']; // Possible locations
    for (const path of pathsToTry) {
        try {
            const response = await fetch(path, { cache: 'no-cache' }); // Prevent stale cache
            if (response.ok) {
                const jsonData = await response.json();
                // Expecting { metadata: ..., fonts: [...] } or just [...]
                const fontArray = jsonData?.fonts || (Array.isArray(jsonData) ? jsonData : null);

                if (Array.isArray(fontArray) && fontArray.length > 0) {
                    console.log(`[FontMan] Successfully loaded font data from ${path}`);
                    _fontDataCache = fontArray;
                    window._INLINE_FONTS_DATA = fontArray; // Cache globally for potential later use
                    return _fontDataCache;
                } else {
                     console.warn(`[FontMan] Data found at ${path} but is empty or invalid format.`);
                }
            }
        } catch (err) {
            console.warn(`[FontMan] Failed to fetch or parse ${path}:`, err.message);
            // Ignore fetch errors and try the next path
        }
    }

    // 3. Use minimal fallbacks if all loading methods fail
    console.error('[FontMan] Failed to load font data from all sources. Using minimal fallback fonts.');
    // Combine web and system fallbacks, marking them as such
    _fontDataCache = [
        ...WEB_FONTS_FALLBACK.map(f => ({ displayName: f.text, familyName: f.value, isFallback: true, variants: [{ weight: 400, style: 'normal' }] })),
        ...SYSTEM_FONTS_FALLBACK.map(f => ({ displayName: f.text, familyName: f.value, isFallback: true, variants: [{ weight: 400, style: 'normal' }] }))
    ];
    return _fontDataCache;
}

/**
 * Populates the font family dropdown menu.
 * @param {Array} fonts - The array of font family objects.
 * @returns {Promise<void>} Resolves when the dropdown is populated.
 * @private
 */
function _populateFontDropdown(fonts) {
    return new Promise((resolve) => {
        const dropdown = document.getElementById('fontFamily');
        if (!dropdown) {
            console.error('[FontMan] Critical: #fontFamily dropdown element not found in DOM.');
            // Still resolve, but signal the issue occurred before this point
            return resolve();
        }

        const currentValue = dropdown.value; // Remember the current selection if any
        dropdown.innerHTML = ''; // Clear existing options (like "Loading...")

        if (fonts && fonts.length > 0) {
            console.log(`[FontMan] Populating dropdown with ${fonts.length} font families.`);
            fonts.forEach(font => {
                // Basic validation for each font object
                if (!font?.displayName || !font.familyName) {
                     console.warn(`[FontMan] Skipping invalid font entry:`, font);
                     return; // Skip invalid entries
                }
                const option = document.createElement('option');
                option.value = font.familyName; // Use familyName for CSS
                option.textContent = font.displayName; // Show user-friendly name
                if (font.isFallback) {
                     option.textContent += " (Fallback)";
                }
                dropdown.appendChild(option);
            });
        } else {
            // If no fonts loaded at all, use minimal system fallbacks
            console.warn('[FontMan] No font data provided to populate dropdown. Using system fallbacks.');
            SYSTEM_FONTS_FALLBACK.forEach(font => {
                const option = document.createElement('option');
                option.value = font.value;
                option.textContent = font.text + " (System)";
                dropdown.appendChild(option);
            });
        }

        // Try to restore previous selection or set a default
        if (dropdown.querySelector(`option[value="${currentValue}"]`)) {
            dropdown.value = currentValue;
        } else {
            // Try to select Orbitron, then Audiowide, then first option as default
            const defaultOption = dropdown.querySelector('option[value="Orbitron"]')
                               || dropdown.querySelector('option[value="Audiowide"]')
                               || dropdown.options[0];
            if (defaultOption) {
                dropdown.value = defaultOption.value;
            }
        }
        console.log(`[FontMan] Dropdown populated. Selected: ${dropdown.value}`);
        resolve();
    });
}

/**
 * Initializes the font system: Loads data and populates the dropdown.
 * This function MUST be called before SettingsManager initializes.
 * @returns {Promise<boolean>} Resolves with true if successful, false otherwise.
 */
export async function initializeFonts() {
    console.log('[FontMan] initializeFonts() sequence started...');
    // Ensure the dropdown exists *before* trying to load/populate
    const dropdown = document.getElementById('fontFamily');
     if (!dropdown) {
         console.error("[FontMan] Cannot initialize: #fontFamily dropdown not found in the DOM.");
         // Attempt to notify user if possible
         if (typeof showAlert === 'function') showAlert("Font selection unavailable (UI Error).", "error");
         return false; // Indicate failure
     }

    try {
        const fontData = await _loadFontData(); // Wait for data loading
        await _populateFontDropdown(fontData); // Wait for dropdown population
        console.log('[FontMan] Font system initialization complete.');
        window._FONTS_LOADED = true; // Set global flag
        return true; // Indicate success
    } catch (err) {
        console.error('[FontMan] Font system initialization failed:', err);
        window._FONT_LOAD_ERROR = err.message || 'Unknown error'; // Store error globally if needed

        // Attempt fallback population even on error
        try {
            await _populateFontDropdown([]); // Populate with fallbacks
        } catch (populateError) {
            console.error('[FontMan] Fallback dropdown population also failed:', populateError);
        }

        // Notify user of the failure
        const alertFunc = typeof showAlert === 'function' ? showAlert : console.error;
        alertFunc(`Font initialization failed: ${err.message}. Using fallback fonts.`, 'error');
        return false; // Indicate failure
    }
}

/**
 * Retrieves the full data object for a specific font by its familyName.
 * FIXED: Properly exposed globally for SVG export.
 * @param {string} familyName - The font familyName (e.g., "Orbitron", "AachenStd") to search for.
 * @returns {object | null} The font data object (including variants) if found, otherwise null.
 */
function getFontDataByName(familyName) {
    console.log(`[FontMan API] getFontDataByName called for: ${familyName}`);
    
    if (!_fontDataCache) {
        console.warn('[FontMan API] Font data cache not ready. Call initializeFonts first.');
        // Try to access global data as fallback
        if (Array.isArray(window._INLINE_FONTS_DATA) && window._INLINE_FONTS_DATA.length > 0) {
            _fontDataCache = window._INLINE_FONTS_DATA;
            console.log('[FontMan API] Using global _INLINE_FONTS_DATA as fallback.');
        } else {
            return null;
        }
    }
    
    if (!familyName || typeof familyName !== 'string') {
        console.warn('[FontMan API] Invalid familyName provided to getFontDataByName:', familyName);
        return null;
    }

    // Case-insensitive search
    const familyNameLower = familyName.toLowerCase();

    const foundFont = _fontDataCache.find(font =>
        font && typeof font.familyName === 'string' && font.familyName.toLowerCase() === familyNameLower
    );

    // Log search results
    console.log(`[FontMan API] Searching for "${familyNameLower}" in cache (${_fontDataCache?.length} items).`);
    if (foundFont) {
        console.log(`[FontMan API] Font found: ${foundFont.familyName}, variants: ${foundFont.variants?.length || 0}`);
    } else {
        console.log(`[FontMan API] Font NOT FOUND: ${familyNameLower}`);
    }

    return foundFont || null; // Return the found font object or null
}

// CRITICAL FIX: Properly expose the function globally
window.getFontDataByName = getFontDataByName;

export { getFontDataByName };

console.log('[FontManager] Module loaded with fixed font data access.');