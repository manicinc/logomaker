/**
 * fontManager.js
 * ================================================
 * Manages the loading, caching, and selection of fonts for Logomaker.
 *
 * Core Responsibilities:
 * 1.  Determines the font data source based on availability:
 * - Prioritizes pre-loaded inline data (`window._INLINE_FONTS_DATA`) for portability.
 * - Attempts to fetch external `fonts.json` if inline data is missing (for server environments).
 * - Falls back to a minimal set of system/web fonts if loading fails.
 * 2.  Populates the font selection dropdown (`#fontFamily`) with available fonts.
 * 3.  Provides a mechanism (`getFontDataByName`) to retrieve detailed font information (including variants and potential license/embed data) for other modules like SettingsManager and RendererCore.
 * 4.  Must be initialized successfully (`initializeFonts`) before SettingsManager, as settings depend on the available font list.
 * 5.  Exposes `getFontDataByName` globally (`window.getFontDataByName`) for wider accessibility, especially for font embedding during SVG export.
 */

// --- Constants ---

// Fallback fonts used ONLY if loading from inline data and external JSON fails.
const SYSTEM_FONTS_FALLBACK = [
    { value: 'Arial', text: 'Arial' }, { value: 'Verdana', text: 'Verdana' },
    { value: 'Tahoma', text: 'Tahoma' }, { value: 'Times New Roman', text: 'Times New Roman' },
    { value: 'Georgia', text: 'Georgia' }, { value: 'Courier New', text: 'Courier New' }
];
// Common web-safe fonts included in fallbacks. Ensure names match expected values if defined elsewhere.
const WEB_FONTS_FALLBACK = [
    { value: 'Orbitron', text: 'Orbitron' }, { value: 'Audiowide', text: 'Audiowide' },
    { value: 'Russo One', text: 'Russo One' }, { value: 'Press Start 2P', text: 'Press Start 2P' }
];

// Module-level cache for the loaded font data array. Avoids redundant loading.
let _fontDataCache = null;

/**
 * Loads font data asynchronously, determining the best available source.
 * Loading Priority:
 * 1. Check internal cache (`_fontDataCache`).
 * 2. Check globally defined inline data (`window._INLINE_FONTS_DATA`).
 * 3. Attempt to fetch `fonts.json` from common locations.
 * 4. Generate and use a minimal fallback list if all else fails.
 *
 * @private
 * @async
 * @returns {Promise<Array<object>>} A promise that resolves with the array of font data objects.
 * Each object should contain at least `displayName`, `familyName`, and `variants`.
 */
async function _loadFontData() {
    // 1. Return immediately if data is already cached
    if (_fontDataCache) {
        console.log('[FontMan] Using cached font data.');
        return _fontDataCache;
    }

    console.log('[FontMan] Loading font data (cache empty)...');

    // 2. Prioritize globally defined inline font data (for portability/offline use)
    // This data is expected to be loaded via `<script src="./inline-fonts-data.js"></script>` before this module runs.
    if (Array.isArray(window._INLINE_FONTS_DATA) && window._INLINE_FONTS_DATA.length > 0) {
        console.log(`[FontMan] Using inline font data found on window object (${window._INLINE_FONTS_DATA.length} fonts).`);
        _fontDataCache = window._INLINE_FONTS_DATA; // Cache it
        return _fontDataCache;
    }

    // 3. Attempt to fetch from external JSON file if inline data wasn't found
    // This supports running from a local server where fonts might be served externally.
    console.warn('[FontMan] Inline font data not found or empty. Attempting to fetch fonts.json...');
    const pathsToTry = ['./fonts/fonts.json', './fonts.json', 'fonts.json']; // Common relative paths
    for (const path of pathsToTry) {
        try {
            console.log(`[FontMan] Trying fetch: ${path}`);
            // Fetch with 'no-cache' to avoid issues with stale data during development/updates
            const response = await fetch(path, { cache: 'no-cache' });
            if (response.ok) {
                const jsonData = await response.json();
                // The JSON might be an array directly, or nested under a 'fonts' key.
                const fontArray = jsonData?.fonts || (Array.isArray(jsonData) ? jsonData : null);

                if (Array.isArray(fontArray) && fontArray.length > 0) {
                    console.log(`[FontMan] Successfully loaded and parsed font data from ${path} (${fontArray.length} fonts).`);
                    _fontDataCache = fontArray; // Cache the fetched data
                    // Optionally assign to window object as well, mirroring the inline data approach
                    window._INLINE_FONTS_DATA = fontArray;
                    return _fontDataCache;
                } else {
                    // Found the file, but content was invalid or empty
                    console.warn(`[FontMan] Data found at ${path} but is empty or not a valid font array.`);
                }
            } else {
                // Log HTTP errors other than 404 (which is expected if file doesn't exist)
                if (response.status !== 404) {
                     console.warn(`[FontMan] Fetch failed for ${path}: ${response.status} ${response.statusText}`);
                }
            }
        } catch (err) {
            // Log network errors or JSON parsing errors
            console.warn(`[FontMan] Failed to fetch or parse ${path}:`, err.message);
        }
    }

    // 4. Use minimal fallbacks if all loading methods failed
    console.error('[FontMan] Failed to load font data from all sources (inline/fetch). Using minimal fallback fonts.');
    // Create a basic structure for fallback fonts compatible with the rest of the system
    _fontDataCache = [
        ...WEB_FONTS_FALLBACK.map(f => ({
            displayName: f.text, // User-facing name
            familyName: f.value, // CSS family name
            isFallback: true, // Flag indicating it's a fallback
            variants: [{ weight: 400, style: 'normal' }] // Assume basic variant
        })),
        ...SYSTEM_FONTS_FALLBACK.map(f => ({
            displayName: f.text,
            familyName: f.value,
            isFallback: true,
            variants: [{ weight: 400, style: 'normal' }]
        }))
    ];
    // Also assign fallbacks to window object for consistency if needed elsewhere
    window._INLINE_FONTS_DATA = _fontDataCache;
    return _fontDataCache;
}

/**
 * Populates the font family dropdown select element (`#fontFamily`)
 * with options based on the provided font data. Handles cases where
 * fonts fail to load by populating with system fallbacks.
 *
 * @private
 * @param {Array<object>} fonts - The array of font data objects to populate the dropdown with.
 * @returns {Promise<void>} A promise that resolves once the dropdown population is complete.
 */
function _populateFontDropdown(fonts) {
    return new Promise((resolve) => {
        const dropdown = document.getElementById('fontFamily');
        // Critical check: Ensure the dropdown element exists in the DOM
        if (!dropdown) {
            console.error('[FontMan] CRITICAL ERROR: Cannot populate dropdown - #fontFamily element not found in DOM!');
            // Resolve anyway so initialization can potentially continue with fallbacks,
            // but log the critical failure.
            return resolve();
        }

        // Preserve current selection if dropdown is re-populated (e.g., during HMR)
        const currentValue = dropdown.value;
        dropdown.innerHTML = ''; // Clear existing options (e.g., "Loading...")

        // Check if valid font data was provided
        if (fonts && Array.isArray(fonts) && fonts.length > 0) {
            console.log(`[FontMan] Populating dropdown with ${fonts.length} font families.`);
            fonts.forEach(font => {
                // Validate essential properties for each font entry
                if (!font?.displayName || !font.familyName) {
                    console.warn(`[FontMan] Skipping invalid font entry during dropdown population:`, font);
                    return; // Skip this invalid font
                }

                // Create <option> element
                const option = document.createElement('option');
                option.value = font.familyName; // Use the CSS font-family name as the value
                option.textContent = font.displayName; // Display the user-friendly name
                // Append "(Fallback)" text if it's from the fallback list
                if (font.isFallback) {
                    option.textContent += " (Fallback)";
                }
                dropdown.appendChild(option);
            });
        } else {
            // If no fonts loaded at all, populate with minimal system fallbacks
            console.warn('[FontMan] No valid font data provided. Populating dropdown with system fallback fonts.');
            SYSTEM_FONTS_FALLBACK.forEach(font => {
                const option = document.createElement('option');
                option.value = font.value;
                option.textContent = font.text + " (System)"; // Indicate it's a system font
                dropdown.appendChild(option);
            });
        }

        // Attempt to restore the previously selected value, or set a sensible default
        if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
             dropdown.value = currentValue; // Restore previous selection
             console.log(`[FontMan] Restored previous font selection: ${currentValue}`);
        } else {
            // Set a default font preference (e.g., Orbitron > Audiowide > first option)
            const defaultOption = dropdown.querySelector('option[value="Orbitron"]')
                               || dropdown.querySelector('option[value="Audiowide"]')
                               || dropdown.options[0]; // Fallback to the very first option
            if (defaultOption) {
                dropdown.value = defaultOption.value;
            }
        }
        console.log(`[FontMan] Dropdown populated. Final selected font: ${dropdown.value}`);
        resolve(); // Signal completion
    });
}

/**
 * Initializes the font management system.
 * This involves loading the font data (from inline, fetch, or fallback)
 * and then populating the font selection dropdown.
 * This function is crucial and **MUST complete successfully before `SettingsManager.init()` is called**,
 * as the settings manager relies on the populated font list.
 *
 * @export
 * @async
 * @returns {Promise<boolean>} A promise resolving with `true` if initialization
 * (loading and populating) was successful, or `false` if errors occurred (though
 * fallbacks may still have been applied).
 */
async function initializeFonts() {
    console.log('[FontMan] initializeFonts() sequence started...');
    // Defensively check for the dropdown element early
    const dropdown = document.getElementById('fontFamily');
    if (!dropdown) {
        console.error("[FontMan] Cannot initialize: #fontFamily dropdown not found in the DOM at init time.");
        if (typeof showAlert === 'function') showAlert("Font selection unavailable (UI Error).", "error");
        return false; // Indicate critical failure early
    }

    try {
        // Step 1: Load font data (waits for data source)
        const fontData = await _loadFontData();
        // Step 2: Populate the dropdown with the loaded data (waits for DOM update)
        await _populateFontDropdown(fontData);

        console.log('[FontMan] Font system initialization sequence complete.');
        window._FONTS_LOADED = true; // Set global flag indicating success/completion
        return true; // Indicate overall success

    } catch (err) {
        console.error('[FontMan] CRITICAL Error during font system initialization:', err);
        window._FONT_LOAD_ERROR = err.message || 'Unknown error'; // Store error globally for debugging

        // Attempt to populate with fallbacks even if loading failed mid-way
        try {
            console.warn('[FontMan] Attempting fallback dropdown population due to error...');
            await _populateFontDropdown([]); // Pass empty array to force fallback population
        } catch (populateError) {
            // Log if even the fallback population failed (should be rare)
            console.error('[FontMan] Fallback dropdown population also failed:', populateError);
        }

        // Notify the user of the failure
        const alertFunc = typeof showAlert === 'function' ? showAlert : console.error; // Use alert or fallback log
        alertFunc(`Font initialization failed: ${err.message || 'Unknown error'}. Using fallback fonts.`, 'error');
        return false; // Indicate that initialization encountered errors
    }
}

/**
 * Retrieves the complete data object for a specific font family, searching
 * by its CSS `font-family` name. Used primarily for accessing variant details,
 * license information, or embedded font data (Base64) needed for export.
 *
 * This function relies on the internal `_fontDataCache`, which is populated by `initializeFonts`.
 * It also checks `window._INLINE_FONTS_DATA` as a backup if the cache isn't ready.
 *
 * @export
 * @param {string} familyName - The CSS `font-family` name to search for (e.g., "Orbitron", "PalatinoLTStd"). Case-insensitive.
 * @returns {object | null} The complete font data object (including `displayName`, `familyName`, `variants` array, potentially `licenseText`, etc.) if found, otherwise `null`.
 */
function getFontDataByName(familyName) {
    // console.log(`[FontMan API] getFontDataByName called for: ${familyName}`); // Can be noisy

    // Ensure the font cache is populated. If not, try the global inline data as a fallback.
    // This might happen if called before initializeFonts fully completes or if cache fails.
    if (!_fontDataCache) {
        console.warn('[FontMan API] Font data cache (_fontDataCache) not ready. Checking window._INLINE_FONTS_DATA...');
        if (Array.isArray(window._INLINE_FONTS_DATA) && window._INLINE_FONTS_DATA.length > 0) {
            _fontDataCache = window._INLINE_FONTS_DATA; // Use the global data if available
            console.log('[FontMan API] Using global _INLINE_FONTS_DATA as fallback cache.');
        } else {
            console.error('[FontMan API] Font data cache is empty and no inline data found. Cannot find font.');
            return null; // Cannot proceed without data
        }
    }

    // Validate input
    if (!familyName || typeof familyName !== 'string') {
        console.warn('[FontMan API] Invalid or missing familyName provided:', familyName);
        return null;
    }

    // Perform case-insensitive search on the familyName
    const familyNameLower = familyName.toLowerCase();
    const foundFont = _fontDataCache.find(font =>
        font && typeof font.familyName === 'string' && font.familyName.toLowerCase() === familyNameLower
    );

    // Log results for debugging if needed
    // console.log(`[FontMan API] Searching for "${familyNameLower}" in cache (${_fontDataCache.length} items). Found: ${!!foundFont}`);
    if (!foundFont) {
         console.log(`[FontMan API] Font NOT FOUND in cache: ${familyName} (Searched for: ${familyNameLower})`);
    }

    return foundFont || null; // Return the found font object or null
}

// --- Global Exposure & Module Exports ---

// Expose getFontDataByName globally for accessibility from other scripts/modules
// (e.g., captureTextStyles, potentially RendererCore if needed directly).
// This is crucial for the font embedding process during SVG export.
window.getFontDataByName = getFontDataByName;
console.log('[FontMan] getFontDataByName function exposed globally on window object.');

// Export key functions for use as ES Modules
export {
    initializeFonts, // The main initialization function
    getFontDataByName // Also export for module consumers
};

console.log('[FontManage] package setup complete.');