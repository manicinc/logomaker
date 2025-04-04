/**
 * Enhanced Font Manager with Improved Caching, Loading Feedback, and Load All option
 * v2.0 - Fixed internal methods visibility and added bulk loading capability
 * 
 * Exports:
 * - initializeFonts(): Promise<boolean>         - Initialize the font system
 * - getFontDataAsync(family): Promise<Object>   - Get font data, loading chunks if needed
 * - getFontDataByName(family): Object|null      - Sync check for loaded font data
 * - preloadFontData(family): Promise<Object>    - Preload a specific font
 * - loadAllFonts(): Promise<Object>             - Load all fonts at once (heavy)
 * - LOADING_STARTED_EVENT: string               - Event name for loading start
 * - LOADING_COMPLETE_EVENT: string              - Event name for loading complete
 * - LOADING_PROGRESS_EVENT: string              - Event name for loading progress
 */

// --- Module-level variables ---
/** @type {Array<Object>|null} Complete font data cache (used in inline/traditional modes) */
let _fontDataCache = null;
/** @type {Array<Object>|null} Lightweight font index (metadata only, used in chunked mode) */
let _fontIndex = null;
/** @type {Map<string, Array<Object>>} Cache for loaded font data chunks (key: chunkId, value: array of font objects) */
let _loadedFontChunks = new Map();
/** @type {boolean} Flag indicating if the manager is operating in chunked loading mode */
let _isChunkedMode = false;
/** @type {Map<string, Promise<Array<Object>|null>>} Tracks in-progress chunk loads to prevent duplicate fetches */
let _pendingFontLoads = new Map();
/** @type {Set<string>} Tracks injected @font-face rules to prevent duplicates. Format: `${familyName}-${fontWeight}-${fontStyle}` */
let _injectedFontFaces = new Set();
/** @type {CSSStyleSheet|null} Reference to the dynamic stylesheet for injecting rules */
let _dynamicStyleSheet = null;

// --- Cache Constants ---
/** @const {string} Prefix for all cache keys to prevent collision with other apps */
const CACHE_PREFIX = 'logomaker_font_';
/** @const {string} Key for the font index cache */
const FONT_INDEX_CACHE_KEY = `${CACHE_PREFIX}index_v1`;
/** @const {string} Prefix for font chunk cache keys */
const FONT_CHUNK_CACHE_PREFIX = `${CACHE_PREFIX}chunk_`;
/** @const {string} Key for frequently used fonts cache */
const FREQUENT_FONTS_CACHE_KEY = `${CACHE_PREFIX}frequent_v1`;
/** @const {number} Cache time-to-live in milliseconds (24 hours) */
const CACHE_TTL = 24 * 60 * 60 * 1000;
/** @const {number} Maximum number of fonts to track as frequently used */
const MAX_FREQUENT_FONTS = 10;

// --- Constants ---
/** @const {string} Relative path to the directory containing font chunk files */
const CHUNK_PATH = './font-chunks';
/** @const {string} Event dispatched when font initialization begins */
const LOADING_STARTED_EVENT = 'logomaker:font-loading-started';
/** @const {string} Event dispatched when font initialization completes (successfully or with fallbacks/errors) */
const LOADING_COMPLETE_EVENT = 'logomaker:font-loading-complete';
/** @const {string} Event dispatched to indicate loading progress */
const LOADING_PROGRESS_EVENT = 'logomaker:font-loading-progress';
/** @const {string} ID of the <style> tag used for dynamic @font-face injection */
const DYNAMIC_STYLE_ID = 'dynamic-font-style';
/** @const {number} Default number of retries for network fetches */
const DEFAULT_FETCH_RETRIES = 3;
/** @const {number} Initial delay in ms before retrying a failed fetch */
const INITIAL_FETCH_RETRY_DELAY = 500;
/** @const {Array<string>} List of essential fonts to preload first */
const ESSENTIAL_FONTS = ['Orbitron', 'Audiowide', 'Russo One', 'Press Start 2P', 'Arial'];

// --- Font Loading Cache Helper Functions ---

// --- Add these near the top of fontManager.js ---
const DB_NAME = 'logomakerFontDB';
const DB_VERSION = 1;
const STORE_NAME = 'fontCacheStore';
let dbPromise = null; // To hold the promise for the database connection

/**
 * Opens the IndexedDB database.
 * @returns {Promise<IDBPDatabase>} A promise that resolves with the DB instance.
 * @private
 */
function _openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('[FontMan DB] Database error:', event.target.error);
        reject(new Error('IndexedDB error: ' + event.target.error?.message));
      };

      request.onsuccess = (event) => {
        console.info('[FontMan DB] Database opened successfully.');
        resolve(event.target.result);
      };

      request.onupgradeneeded = (event) => {
        console.info('[FontMan DB] Database upgrade needed.');
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          console.info(`[FontMan DB] Object store '${STORE_NAME}' created.`);
        }
      };
    });
  }
  return dbPromise;
}

/**
 * Gets an object store transaction.
 * @param {IDBPDatabase} db - The database instance.
 * @param {'readonly'|'readwrite'} mode - Transaction mode.
 * @returns {IDBObjectStore} The object store instance.
 * @private
 */
function _getDBStore(db, mode) {
  const transaction = db.transaction(STORE_NAME, mode);
  return transaction.objectStore(STORE_NAME);
}

/**
 * Saves data to the IndexedDB store.
 * @param {string} key - The cache key.
 * @param {*} value - The data to store.
 * @returns {Promise<void>}
 * @private
 */
async function _saveToDBStore(key, value) {
  try {
    const db = await _openDB();
    const store = _getDBStore(db, 'readwrite');
    const data = {
      key: key,
      value: value,
      timestamp: Date.now()
    };
    const request = store.put(data);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.info(`[FontMan DB] Saved data for key: ${key}`);
        resolve();
      };
      request.onerror = (event) => {
        console.error(`[FontMan DB] Error saving data for key ${key}:`, event.target.error);
        // Attempt cleanup if quota likely exceeded
        if (event.target.error?.name === 'QuotaExceededError') {
           console.warn('[FontMan DB] Quota likely exceeded. Attempting cleanup...');
           _cleanupDBStore(key).then(resolve).catch(reject); // Try cleaning then resolve/reject
        } else {
           reject(new Error('DB save error: ' + event.target.error?.message));
        }
      };
    });
  } catch (error) {
    console.error(`[FontMan DB] Failed to open DB for saving key ${key}:`, error);
    // Don't reject here, maybe log and continue without caching
  }
}


/**
 * Loads data from the IndexedDB store.
 * @param {string} key - The cache key.
 * @returns {Promise<*|null>} The cached data or null.
 * @private
 */
async function _loadFromDBStore(key) {
  try {
    const db = await _openDB();
    const store = _getDBStore(db, 'readonly');
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const data = event.target.result;
        if (data && data.timestamp && (Date.now() - data.timestamp < CACHE_TTL)) {
          console.info(`[FontMan DB] Using cached data for ${key}`);
          resolve(data.value);
        } else {
          if (data) {
             console.info(`[FontMan DB] Cached data expired for ${key}`);
             // Optionally delete expired item here asynchronously
             _deleteFromDBStore(key).catch(e => console.warn(`[FontMan DB] Failed to delete expired key ${key}:`, e));
          }
          resolve(null); // Not found or expired
        }
      };
      request.onerror = (event) => {
        console.error(`[FontMan DB] Error loading data for key ${key}:`, event.target.error);
        // Resolve with null, don't block the app
        resolve(null);
      };
    });
  } catch (error) {
    console.error(`[FontMan DB] Failed to open DB for loading key ${key}:`, error);
    return null; // Return null if DB open fails
  }
}

/**
 * Deletes data from the IndexedDB store.
 * @param {string} key - The cache key.
 * @returns {Promise<void>}
 * @private
 */
async function _deleteFromDBStore(key) {
   try {
      const db = await _openDB();
      const store = _getDBStore(db, 'readwrite');
      const request = store.delete(key);
       return new Promise((resolve, reject) => {
          request.onsuccess = () => {
            console.info(`[FontMan DB] Deleted key: ${key}`);
            resolve();
          };
          request.onerror = (event) => {
             console.error(`[FontMan DB] Error deleting key ${key}:`, event.target.error);
             reject(new Error('DB delete error: ' + event.target.error?.message));
          }
       });
   } catch (error) {
      console.error(`[FontMan DB] Failed to open DB for deleting key ${key}:`, error);
      // Don't reject, just log
   }
}

/**
 * Cleans up old/expired items from the cache store.
 * Can be called proactively or when quota errors occur.
 * @param {string} [keyToKeep] - Optional key to avoid deleting immediately.
 * @returns {Promise<void>}
 * @private
 */
async function _cleanupDBStore(keyToKeep) {
    console.warn('[FontMan DB] Running cache cleanup...');
    let deletedCount = 0;
    try {
        const db = await _openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const data = cursor.value;
                    // Delete if expired OR if it's not the essential index/current item and we need space
                    // Basic TTL check for now:
                    if (data.key !== keyToKeep && (!data.timestamp || (Date.now() - data.timestamp >= CACHE_TTL))) {
                        console.info(`[FontMan DB] Cleaning up expired/old key: ${data.key}`);
                        cursor.delete();
                        deletedCount++;
                    }
                    cursor.continue();
                } else {
                    // End of cursor
                    console.info(`[FontMan DB] Cleanup finished. Deleted ${deletedCount} items.`);
                    resolve();
                }
            };
             request.onerror = (event) => {
                 console.error('[FontMan DB] Error during cursor cleanup:', event.target.error);
                 reject(event.target.error);
             };
        });

    } catch (error) {
        console.error('[FontMan DB] Failed to open DB for cleanup:', error);
    }
}

/**
 * Load cached font data from localStorage
 * @param {string} key - The cache key to load
 * @returns {*|null} The cached data or null if not found or expired
 * @private
 */
function _loadFromCache(key) {
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            const data = JSON.parse(cached);
            if (data && data.timestamp && (Date.now() - data.timestamp < CACHE_TTL)) {
                console.info(`[FontMan] Using cached data for ${key}`);
                return data.value;
            } else {
                console.info(`[FontMan] Cached data expired for ${key}`);
            }
        }
    } catch (e) {
        console.warn(`[FontMan] Cache load failed for ${key}:`, e);
    }
    return null;
}

/**
 * Save data to localStorage cache with timestamp
 * @param {string} key - The cache key
 * @param {*} value - The data to cache
 * @private
 */
function _saveToCache(key, value) {
    try {
        const data = {
            timestamp: Date.now(),
            value: value
        };
        localStorage.setItem(key, JSON.stringify(data));
        console.info(`[FontMan] Saved to cache: ${key}`);
    } catch (e) {
        console.warn(`[FontMan] Cache save failed for ${key}:`, e);
        // If storage quota is exceeded, try clearing old caches
        _cleanupOldCaches(key, value);
    }
}

/**
 * Clean up old caches to make room for new data
 * @param {string} keyToSave - The key we're trying to save
 * @param {*} valueToSave - The value we're trying to save
 * @private
 */
function _cleanupOldCaches(keyToSave, valueToSave) {
    try {
        // First, remove any expired caches
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && data.timestamp && (Date.now() - data.timestamp >= CACHE_TTL)) {
                        localStorage.removeItem(key);
                        console.info(`[FontMan] Removed expired cache: ${key}`);
                    }
                } catch (parseErr) {
                    // If we can't parse it, it's likely corrupted - remove it
                    localStorage.removeItem(key);
                }
            }
        }
        
        // Try saving again
        localStorage.setItem(keyToSave, JSON.stringify({
            timestamp: Date.now(),
            value: valueToSave
        }));
        console.info(`[FontMan] Saved to cache after cleanup: ${keyToSave}`);
    } catch (storageErr) {
        // If we still can't save, remove chunk caches one by one until we can
        console.warn(`[FontMan] Still cannot save cache after cleanup, removing chunks:`, storageErr);
        
        // Find and sort chunk caches by timestamp (oldest first)
        const chunkCaches = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(FONT_CHUNK_CACHE_PREFIX) && key !== keyToSave) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && data.timestamp) {
                        chunkCaches.push({ key, timestamp: data.timestamp });
                    }
                } catch (e) { /* Skip invalid entries */ }
            }
        }
        
        // Sort by timestamp (oldest first)
        chunkCaches.sort((a, b) => a.timestamp - b.timestamp);
        
        // Remove oldest chunk caches until we can save
        for (const cache of chunkCaches) {
            localStorage.removeItem(cache.key);
            console.info(`[FontMan] Removed old chunk cache: ${cache.key}`);
            
            try {
                localStorage.setItem(keyToSave, JSON.stringify({
                    timestamp: Date.now(),
                    value: valueToSave
                }));
                console.info(`[FontMan] Successfully saved after removing chunk cache`);
                return; // Success!
            } catch (e) {
                // Continue to next chunk
                console.warn(`[FontMan] Still not enough space, continuing cleanup...`);
            }
        }
        
        console.error(`[FontMan] Failed to save cache even after removing all chunks`);
    }
}

/**
 * Track font usage frequency to prioritize loading common fonts
 * @param {string} fontFamily - The font family name to track
 * @private
 */
function _trackFontUsage(fontFamily) {
    if (!fontFamily) return;
    
    try {
        // Get current frequency data
        const frequentFonts = _loadFromCache(FREQUENT_FONTS_CACHE_KEY) || {};
        
        // Update count for this font
        frequentFonts[fontFamily] = (frequentFonts[fontFamily] || 0) + 1;
        
        // If we have too many fonts, keep only the most frequently used ones
        const fontEntries = Object.entries(frequentFonts);
        if (fontEntries.length > MAX_FREQUENT_FONTS) {
            // Sort by frequency (highest first) and take only the most frequent
            const mostFrequent = fontEntries
                .sort((a, b) => b[1] - a[1])
                .slice(0, MAX_FREQUENT_FONTS);
            
            // Rebuild the object
            const prunedFrequent = {};
            for (const [font, count] of mostFrequent) {
                prunedFrequent[font] = count;
            }
            
            _saveToCache(FREQUENT_FONTS_CACHE_KEY, prunedFrequent);
        } else {
            // Just save the updated frequencies
            _saveToCache(FREQUENT_FONTS_CACHE_KEY, frequentFonts);
        }
    } catch (e) {
        console.warn(`[FontMan] Failed to track font usage:`, e);
        // Non-critical, can continue
    }
}

/**
 * Get frequently used fonts for prioritized loading
 * @returns {Array<string>} Array of font family names
 * @private
 */
function _getFrequentFonts() {
    try {
        const frequentFonts = _loadFromCache(FREQUENT_FONTS_CACHE_KEY) || {};
        
        // Sort by frequency (highest first)
        return Object.entries(frequentFonts)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
    } catch (e) {
        console.warn(`[FontMan] Failed to get frequent fonts:`, e);
        return [];
    }
}

/**
 * Populates the font dropdown with available fonts
 * @param {Array<Object>} fonts - Array of font objects
 * @returns {Promise<void>}
 * @private
 */
async function _populateFontDropdown(fonts) {
    if (!fonts || !Array.isArray(fonts) || fonts.length === 0) {
        console.warn('[FontMan] Cannot populate dropdown: No valid fonts array provided.');
        return;
    }
    
    const dropdown = document.getElementById('fontFamily');
    if (!dropdown) {
        console.warn('[FontMan] Cannot populate dropdown: #fontFamily element not found.');
        return;
    }

    try {
        // Clear existing options except the first one (if it's a placeholder)
        while (dropdown.options.length > 1 && dropdown.options[0].disabled) {
            dropdown.remove(1);
        }
        // If no placeholder exists, remove all
        if (dropdown.options.length > 0 && !dropdown.options[0].disabled) {
            dropdown.options.length = 0;
        }

        console.info(`[FontMan] Populating dropdown with ${fonts.length} fonts...`);
        
        // Sort fonts by displayName for better usability
        const sortedFonts = [...fonts].sort((a, b) => 
            (a.displayName || a.familyName).localeCompare(b.displayName || b.familyName)
        );

        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Add fonts to the fragment
        sortedFonts.forEach(font => {
            const option = document.createElement('option');
            option.value = font.familyName || ''; // Use familyName as value
            option.textContent = font.displayName || font.familyName || 'Unknown Font';
            fragment.appendChild(option);
        });
        
        // Replace placeholder text if it exists
        if (dropdown.options.length > 0 && dropdown.options[0].disabled) {
            dropdown.options[0].textContent = `${fonts.length} Fonts Available`;
        }
        
        // Add the fragment to the dropdown
        dropdown.appendChild(fragment);
        
        console.info(`[FontMan] Dropdown populated with ${fonts.length} font options.`);
        
        // Set dropdown to the default font if available
        if (dropdown.options.length > 0) {
            const defaultFont = 'Orbitron'; // Matches DEFAULT_SETTINGS.fontFamily
            const defaultOption = Array.from(dropdown.options).find(opt => opt.value === defaultFont);
            
            if (defaultOption) {
                dropdown.value = defaultFont;
                console.info(`[FontMan] Set dropdown to default font: ${defaultFont}`);
            } else {
                // If default font not found, use the first non-disabled option
                for (let i = 0; i < dropdown.options.length; i++) {
                    if (!dropdown.options[i].disabled) {
                        dropdown.selectedIndex = i;
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error('[FontMan] Error populating font dropdown:', error);
        throw error; // Re-throw to be handled by caller
    }
}

/**
 * Populates the dropdown with fallback system fonts
 * @returns {Promise<void>}
 * @private
 */
async function _populateFontDropdownWithFallbacks() {
    const fallbackFonts = [
        { familyName: 'Arial', displayName: 'Arial (System)' },
        { familyName: 'Verdana', displayName: 'Verdana (System)' },
        { familyName: 'Helvetica', displayName: 'Helvetica (System)' },
        { familyName: 'Times New Roman', displayName: 'Times New Roman (System)' },
        { familyName: 'Courier New', displayName: 'Courier New (System)' },
        { familyName: 'Georgia', displayName: 'Georgia (System)' },
        { familyName: 'Tahoma', displayName: 'Tahoma (System)' },
        { familyName: 'Impact', displayName: 'Impact (System)' }
    ];

    console.warn('[FontMan] Using system fallback fonts only.');
    await _populateFontDropdown(fallbackFonts);
}

/**
 * Dispatch a progress event to inform the UI about ongoing font loading
 * @param {number} percent - Loading progress percentage (0-100)
 * @param {string} message - Status message to display
 * @private
 */
function _dispatchProgressEvent(percent, message) {
    window.dispatchEvent(new CustomEvent(LOADING_PROGRESS_EVENT, {
        detail: {
            percent: percent,
            message: message
        }
    }));
    console.info(`[FontMan] Progress: ${percent}% - ${message}`);
}

// --- Core Font Data Retrieval & Loading ---

/**
 * Loads a specific font chunk JSON file using fetch with retry. Caches the result.
 * @param {string} chunkId - The identifier of the chunk (e.g., 'a-f').
 * @returns {Promise<Array<Object>|null>} A promise resolving to the array of font objects within the chunk, or null on failure.
 * @private
 */
async function _loadFontChunk(chunkId) {
    // Return cached data if already loaded successfully
    if (_loadedFontChunks.has(chunkId) && _loadedFontChunks.get(chunkId).length > 0) {
        console.info(`[FontMan] DEBUG: Using cached data for chunk '${chunkId}'.`);
        return _loadedFontChunks.get(chunkId);
    }
    // If cached as empty array (previous error), maybe retry
    
    // Check localStorage cache
    // const cacheKey = `${FONT_CHUNK_CACHE_PREFIX}${chunkId}_v1`;
    // const cachedChunk = _loadFromCache(cacheKey);
    // if (cachedChunk) {
    //     _loadedFontChunks.set(chunkId, cachedChunk);
    //     console.info(`[FontMan] Using cached chunk '${chunkId}' from localStorage.`);
    //     return cachedChunk;
    // }
    // indexeddb
    const cacheKey = `${FONT_CHUNK_CACHE_PREFIX}${chunkId}_v1`;
    // Use await for DB load
    const cachedChunk = await _loadFromDBStore(cacheKey);
    if (cachedChunk) {
        _loadedFontChunks.set(chunkId, cachedChunk);
        console.info(`[FontMan] Using cached chunk '${chunkId}' from IndexedDB.`);
        return cachedChunk;
    }

    console.info(`[FontMan] INFO: Loading font chunk file: ${chunkId}.json`);
    const url = `${CHUNK_PATH}/${chunkId}.json`;


    try {
        const response = await _fetchWithRetry(url, {}, 3, 500);
        const chunkData = await response.json();
        const fontsInChunk = chunkData?.fonts || (Array.isArray(chunkData) ? chunkData : null);
        if (!Array.isArray(fontsInChunk)) {
            throw new Error(`Invalid data format in chunk ${chunkId}.json`);
        }

        _loadedFontChunks.set(chunkId, fontsInChunk);

        // Use await for DB save
        await _saveToDBStore(cacheKey, fontsInChunk);

        console.info(`[FontMan] INFO: Loaded and cached chunk ${chunkId} to IndexedDB.`);
        return fontsInChunk;
    } catch (err) {
       // ... (error handling) ...
        console.error(`[FontMan] ERROR: Failed to load or parse chunk ${chunkId} from ${url}:`, err);
        _loadedFontChunks.set(chunkId, []); // Cache empty array on error to prevent repeated failed attempts
        // Re-throw the error so calling functions (like getFontDataAsync) know it failed
        throw err;
    }
}

/**
 * Injects @font-face CSS rules into the dynamic stylesheet if they haven't been added already.
 * Uses `font-display: swap` and tries to determine format more robustly.
 * @param {Object} fontData - The full font data object containing the `variants` array.
 * @private
 */
function _injectFontFaceRules(fontData) {
    // Re-verify stylesheet availability before injecting
    if (!_dynamicStyleSheet) {
        const styleEl = document.getElementById(DYNAMIC_STYLE_ID);
        _dynamicStyleSheet = styleEl?.sheet; // Try to get it again
        if (!_dynamicStyleSheet) {
             console.error(`[FontMan Inject] Cannot inject font face for ${fontData?.familyName}: Dynamic stylesheet unavailable.`);
             return; // Cannot proceed without stylesheet
        }
    }

    if (!fontData || !Array.isArray(fontData.variants)) {
        // console.warn(`[FontMan Inject] Invalid font data provided for ${fontData?.familyName}`);
        return;
    }

    const familyName = fontData.familyName;
    if (!familyName) return; // Need a name

    fontData.variants.forEach(variant => {
        const weight = variant.weight || '400';
        const style = variant.style || 'normal';
        // Use dataUrl first (preferred for inline/portable), then url
        const fontUrl = variant.dataUrl || variant.url; // For clarity

        if (!fontUrl) {
            // console.warn(`[FontMan Inject] No url/dataUrl for variant ${familyName} ${weight} ${style}.`);
            return; // Skip if no source
        }

        const faceKey = `${familyName}-${weight}-${style}`;
        if (_injectedFontFaces.has(faceKey)) {
            return; // Skip if already injected
        }

        // Determine format (more robustly)
        let format = 'woff2'; // Default assumption
        if (typeof fontUrl === 'string') {
            // Check common file extensions
            if (fontUrl.endsWith('.woff2')) format = 'woff2';
            else if (fontUrl.endsWith('.woff')) format = 'woff';
            else if (fontUrl.endsWith('.ttf')) format = 'truetype';
            else if (fontUrl.endsWith('.otf')) format = 'opentype';
            // Extract format from data URI if possible
            else if (fontUrl.startsWith('data:')) {
                const match = fontUrl.match(/^data:font\/([\w+-]+);/); // Matches data:font/woff2; etc.
                if (match && match[1]) {
                    format = match[1].toLowerCase(); // e.g., 'woff2', 'woff', 'truetype'
                } else {
                    const typeMatch = fontUrl.match(/^data:application\/font-([\w+-]+);/); // Matches data:application/font-woff; etc.
                    if (typeMatch && typeMatch[1]) {
                        format = typeMatch[1].toLowerCase();
                    }
                }
            }
        }
        // console.log(`[FontMan Inject] Determined format for ${faceKey}: ${format}`); // Debug format detection

        // Construct rule using determined format
        // Ensure quotes around familyName and src URL
        const rule = `
           @font-face {
               font-family: "${familyName}";
               src: url("${fontUrl}") format("${format}");
               font-weight: ${weight};
               font-style: ${style};
               font-display: swap;
           }
       `;

       try {
           // Insert rule at the end of the sheet
           _dynamicStyleSheet.insertRule(rule, _dynamicStyleSheet.cssRules.length);
           _injectedFontFaces.add(faceKey); // Mark as injected *after* success
           console.info(`[FontMan] INFO: Injected @font-face for: ${faceKey}`);
       } catch (e) {
           console.error(`[FontMan] ERROR: Failed to inject CSS rule for ${faceKey}:`, e, `Rule: ${rule.substring(0, 100)}...`);
       }
    });
}

/**
 * Determines the chunk ID for a given font family name based on its first character.
 * @param {string} familyName - The font family name.
 * @returns {string} The chunk ID (e.g., 'a-f', 'g-m', 'n-z', '0-9', 'symbols').
 * @private
 */
function _getChunkId(familyName) {
    if (!familyName) return 'symbols'; // Default chunk for safety

    const firstChar = familyName.trim().charAt(0).toLowerCase();

    if (firstChar >= 'a' && firstChar <= 'f') return 'a-f';
    if (firstChar >= 'g' && firstChar <= 'm') return 'g-m';
    if (firstChar >= 'n' && firstChar <= 'z') return 'n-z';
    if (firstChar >= '0' && firstChar <= '9') return '0-9'; // Handle fonts starting with numbers

    return 'symbols'; // Fallback for symbols or other characters
}

/**
 * Fetches a resource with retry logic for network resilience.
 * @param {string} url - The URL to fetch.
 * @param {RequestInit} [options] - Fetch options.
 * @param {number} [retries=DEFAULT_FETCH_RETRIES] - Maximum number of retry attempts.
 * @param {number} [initialDelay=INITIAL_FETCH_RETRY_DELAY] - Initial delay in ms before the first retry.
 * @returns {Promise<Response>} The fetch Response object.
 * @private
 */
async function _fetchWithRetry(url, options, retries = DEFAULT_FETCH_RETRIES, initialDelay = INITIAL_FETCH_RETRY_DELAY) {
    let delay = initialDelay;
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // Decide if error is worth retrying (e.g., network errors, 5xx server errors)
                // Simple approach: retry on any !response.ok except maybe 4xx client errors?
                if (response.status >= 400 && response.status < 500) {
                     throw new Error(`Client Error ${response.status}: ${response.statusText || 'Bad Request'}`); // Don't retry client errors
                }
                throw new Error(`HTTP Error ${response.status}: ${response.statusText || 'Fetch Failed'}`); // Generic error for retry
            }
            // Success
            if (i > 0) console.info(`[FontMan] INFO: Fetch successful for ${url} on retry attempt ${i}.`);
            return response;
        } catch (error) {
            if (i === retries) {
                console.error(`[FontMan] ERROR: Fetch failed for ${url} after ${retries} retries.`, error);
                throw error; // Final attempt failed, re-throw
            }
            console.warn(`[FontMan] WARN: Fetch failed for ${url} (attempt ${i + 1}/${retries + 1}), retrying in ${delay}ms...`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
    // Should not be reachable due to throw in the loop, but satisfies linting
    throw new Error(`[FontMan] ERROR: Fetch failed unexpectedly for ${url}`);
}

// --- Initialization ---

/**
 * Initializes the font system, determining the best loading strategy based on the environment.
 * Dispatches events ('logomaker:font-loading-started', 'logomaker:font-loading-complete')
 * to signal loading status to the UI.
 * @returns {Promise<boolean>} True if initialization used primary strategies (inline, chunked, traditional), 
 *                             false if only fallbacks were used or a critical error occurred.
 */
async function initializeFonts() {
    console.info('[FontMan] INFO: Initializing font system...');
    window.dispatchEvent(new CustomEvent(LOADING_STARTED_EVENT));

    // Ensure the dynamic stylesheet exists and get a reference to its sheet object
    try {
        const styleEl = document.getElementById(DYNAMIC_STYLE_ID);
        if (!styleEl || !(styleEl instanceof HTMLStyleElement)) {
            throw new Error(`Required <style id="${DYNAMIC_STYLE_ID}"> element not found or invalid.`);
        }
        // Accessing the sheet might fail transiently or due to security restrictions in edge cases
        _dynamicStyleSheet = styleEl.sheet;
        if (!_dynamicStyleSheet) {
            // Attempt a brief delay and retry access, common fix for timing issues
            await new Promise(resolve => setTimeout(resolve, 50));
            _dynamicStyleSheet = styleEl.sheet;
            if (!_dynamicStyleSheet) throw new Error(`Could not access CSSStyleSheet for #${DYNAMIC_STYLE_ID}.`);
        }
        console.info(`[FontMan] DEBUG: Found dynamic stylesheet: #${DYNAMIC_STYLE_ID}`);
    } catch (styleSheetError) {
        console.error('[FontMan] CRITICAL: Failed to access dynamic stylesheet.', styleSheetError);
        // Cannot inject fonts without the stylesheet, trigger failure event
        window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT, {
             detail: { success: false, mode: 'error', error: `Stylesheet Error: ${styleSheetError.message}` }
        }));
        return false; // Critical failure
    }

    // Pre-check for font dropdown element
    const dropdown = document.getElementById('fontFamily');
    if (!dropdown) {
        console.error("[FontMan] CRITICAL: #fontFamily dropdown element not found in DOM!");
        window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT, { 
            detail: { success: false, mode: 'error', error: 'Dropdown missing' }
        }));
        return false; // Critical failure
    }

    // Dispatch initial progress event
    _dispatchProgressEvent(10, 'Starting font system initialization...');

    try {
        // Try to use cached font index first for fastest startup
        _fontIndex = _loadFromCache(FONT_INDEX_CACHE_KEY);
        if (_fontIndex && Array.isArray(_fontIndex) && _fontIndex.length > 0) {
            console.info(`[FontMan] INFO: Using cached font index (${_fontIndex.length} fonts). Mode: cached`);
            _isChunkedMode = true;
            
            _dispatchProgressEvent(30, `Loading font index from cache (${_fontIndex.length} fonts)...`);
            
            await _populateFontDropdown(_fontIndex);
            
            _dispatchProgressEvent(60, 'Preloading essential fonts...');
            
            // Preload essential fonts concurrently
            const preloadPromises = [];
            const essentialFonts = [...ESSENTIAL_FONTS, ..._getFrequentFonts()];
            for (const font of essentialFonts) {
                if (dropdown.querySelector(`option[value="${font}"]`)) {
                    console.info(`[FontMan] Preloading essential font: ${font}`);
                    const preloadPromise = preloadFontData(font)
                        .catch(e => console.warn(`[FontMan] Preload failed for ${font}:`, e));
                    preloadPromises.push(preloadPromise);
                }
            }
            
            // Wait for essential preloads but don't block on errors
            await Promise.allSettled(preloadPromises);
            
            _dispatchProgressEvent(100, `Font system initialized with ${_fontIndex.length} fonts from cache`);
            
            window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT, {
                detail: { success: true, mode: 'cached', fontCount: _fontIndex.length }
            }));
            return true;
        }
        
        // STRATEGY 1: Embedded Data (Offline/Portable Mode)
        if (Array.isArray(window._INLINE_FONTS_DATA) && window._INLINE_FONTS_DATA.length > 0) {
            console.info(`[FontMan] INFO: Using pre-loaded inline font data (${window._INLINE_FONTS_DATA.length} fonts). Mode: inline`);
            _fontDataCache = window._INLINE_FONTS_DATA;
            
            _dispatchProgressEvent(50, `Loading ${_fontDataCache.length} embedded fonts...`);
            
            await _populateFontDropdown(_fontDataCache);
            
            _dispatchProgressEvent(100, `Font system initialized with ${_fontDataCache.length} embedded fonts`);
            
            window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT, {
                 detail: { success: true, mode: 'inline', fontCount: _fontDataCache.length }
            }));
            return true;
        }
        console.info('[FontMan] DEBUG: No inline font data found.');
        
        _dispatchProgressEvent(20, 'Attempting chunked font loading...');

        // STRATEGY 2: Chunked Loading (Optimized Web Mode)
        try {
            console.info(`[FontMan] DEBUG: Attempting chunked loading from ${CHUNK_PATH}/index.json`);
            
            const indexResponse = await _fetchWithRetry(`${CHUNK_PATH}/index.json`);
            
            _dispatchProgressEvent(40, 'Parsing font index data...');
            
            _fontIndex = await indexResponse.json(); // Throws on parse error

            if (!Array.isArray(_fontIndex)) throw new Error("Font index is not a valid array.");

            _isChunkedMode = true;
            console.info(`[FontMan] INFO: Loaded font index (${_fontIndex.length} fonts). Mode: chunked`);
            
            // Cache the index for future use
            _saveToCache(FONT_INDEX_CACHE_KEY, _fontIndex);
            
            _dispatchProgressEvent(60, `Populating font dropdown with ${_fontIndex.length} fonts...`);
            
            await _populateFontDropdown(_fontIndex);
            
            _dispatchProgressEvent(80, 'Preloading essential fonts...');

            // Preload essential fonts in the background after dropdown is populated
            const defaultFontFamily = dropdown.value;
            const essentialFonts = new Set([
                defaultFontFamily, 
                ...ESSENTIAL_FONTS.filter(font => dropdown.querySelector(`option[value="${font}"]`)),
                ..._getFrequentFonts().slice(0, 3) // Just preload top 3 frequent fonts
            ]);
            
            // Preload concurrently but don't wait for completion
            for (const font of essentialFonts) {
                if (font) {
                    console.info(`[FontMan] Proactively preloading font: ${font}`);
                    preloadFontData(font).catch(e => 
                        console.warn(`[FontMan] Preload failed for '${font}':`, e.message)
                    );
                }
            }
            
            _dispatchProgressEvent(100, `Font system initialized with ${_fontIndex.length} indexed fonts`);

            window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT, {
                 detail: { success: true, mode: 'chunked', fontCount: _fontIndex.length }
            }));
            return true;
        } catch (chunkIndexError) {
            console.warn('[FontMan] WARN: Chunked loading failed. Index fetch/parse error:', chunkIndexError.message);
            _dispatchProgressEvent(50, 'Chunked loading failed, trying alternative method...');
            // Continue to next strategy
        }

    // STRATEGY 3: Traditional JSON Loading (Local Dev Fallback)
    try {
        console.info('[FontMan] DEBUG: Attempting traditional loading from ./fonts.json');
        
        // Try multiple paths for fonts.json
        let response = null;
        const possiblePaths = ['./fonts.json', '/fonts.json', '../fonts.json'];
        
        for (const path of possiblePaths) {
            try {
                console.info(`[FontMan] Trying to fetch from: ${path}`);
                response = await _fetchWithRetry(path);
                if (response.ok) {
                    console.info(`[FontMan] Successfully loaded fonts.json from: ${path}`);
                    break;
                }
            } catch (pathError) {
                console.warn(`[FontMan] Failed to load from ${path}:`, pathError.message);
            }
        }
        
        if (!response || !response.ok) {
            throw new Error("Could not find fonts.json at any standard path");
        }
        
        _dispatchProgressEvent(70, 'Parsing font data...');
        
        const data = await response.json(); // Throws on parse error
        const fontArray = data?.fonts || (Array.isArray(data) ? data : null);

        if (Array.isArray(fontArray) && fontArray.length > 0) {
            console.info(`[FontMan] INFO: Loaded traditional fonts.json (${fontArray.length} fonts). Mode: traditional`);
            _fontDataCache = fontArray;
            
            _dispatchProgressEvent(80, `Populating font dropdown with ${fontArray.length} fonts...`);
            
            await _populateFontDropdown(_fontDataCache);
            
            _dispatchProgressEvent(100, `Font system initialized with ${fontArray.length} fonts from JSON`);
            
            window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT, {
                detail: { success: true, mode: 'traditional', fontCount: fontArray.length }
            }));
            return true;
        } else {
            console.warn('[FontMan] WARN: fonts.json loaded but contained no valid font array.');
        }
    } catch (jsonError) {
        console.warn('[FontMan] WARN: Traditional fonts.json loading failed:', jsonError.message);
        _dispatchProgressEvent(90, 'All primary strategies failed, falling back to system fonts...');
        // Continue to fallback
}
        // STRATEGY 4: System Font Fallbacks (Last Resort)
        console.warn('[FontMan] WARN: All primary font loading strategies failed. Using system fallbacks. Mode: fallback');
        await _populateFontDropdownWithFallbacks();
        
        _dispatchProgressEvent(100, 'Using system fonts due to loading failure');
        
        window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT, {
             detail: { success: false, mode: 'fallback' } // Indicate success:false, but app continues
        }));
        return false; // Indicate main font loading failed

    } catch (error) {
        console.error('[FontMan] CRITICAL: Unhandled error during initialization:', error);
        _dispatchProgressEvent(100, 'Font initialization critically failed.');
        
        // Attempt to populate with fallbacks even after critical error
        try { 
            await _populateFontDropdownWithFallbacks(); 
        } catch (fbError) { 
            /* Ignore fallback error */ 
        }
        
        window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT, {
             detail: { success: false, mode: 'error', error: error.message }
        }));
        return false; // Critical failure
    }
}

/**
 * Asynchronously retrieves font data for a specific font family name.
 * Handles fetching chunks and injecting @font-face rules if operating in chunked mode.
 * Tracks font usage for frequency-based optimization.
 * @param {string} familyName - The case-insensitive font family name.
 * @returns {Promise<Object|null>} A promise resolving to the full font data object (including variants with dataUrls) or null if not found/loadable.
 */
async function getFontDataAsync(familyName) {
    if (!familyName) {
        console.warn('[FontMan] WARN: getFontDataAsync called with null/empty familyName.');
        return null;
    }
    const lowerFamilyName = familyName.toLowerCase();

    // Track this request for frequency analysis
    _trackFontUsage(familyName);

    /** @type {Object|null} */
    let fontData = null;

    // --- Check Caches First ---
    // Case 1: Full data already in main cache (inline or traditional mode)
    if (_fontDataCache) {
        fontData = _fontDataCache.find(f => f && f.familyName?.toLowerCase() === lowerFamilyName);
        if (fontData) {
             console.info(`[FontMan] DEBUG: Found '${familyName}' in full cache.`);
             _injectFontFaceRules(fontData); // Ensure injection if needed
             return fontData;
        }
    }

    // Case 2: Check if data exists in already loaded chunks (chunked mode)
    if (_isChunkedMode) {
        const chunkId = _getChunkId(familyName);
        const loadedChunk = _loadedFontChunks.get(chunkId);
        if (loadedChunk) {
            fontData = loadedChunk.find(f => f.familyName?.toLowerCase() === lowerFamilyName);
            if (fontData) {
                console.info(`[FontMan] DEBUG: Found '${familyName}' in loaded chunk '${chunkId}'.`);
                _injectFontFaceRules(fontData); // Ensure injection
                return fontData;
            }
        }
    }

    // --- Load if Necessary (Chunked Mode Only) ---
    if (_isChunkedMode && _fontIndex) {
        // Verify font exists in the index before attempting to load chunk
        const fontInfoFromIndex = _fontIndex.find(f => f.familyName?.toLowerCase() === lowerFamilyName);
        if (!fontInfoFromIndex) {
             console.warn(`[FontMan] WARN: Font '${familyName}' not found in index. Cannot load.`);
             return null;
        }

        const chunkId = _getChunkId(familyName);

        // Check if chunk is currently being loaded
        if (_pendingFontLoads.has(chunkId)) {
            console.info(`[FontMan] DEBUG: Waiting for pending load of chunk '${chunkId}' for font '${familyName}'.`);
            try {
                await _pendingFontLoads.get(chunkId); // Wait for the existing load promise
                // After waiting, the chunk should be in _loadedFontChunks, re-check
                const chunk = _loadedFontChunks.get(chunkId);
                fontData = chunk?.find(f => f.familyName?.toLowerCase() === lowerFamilyName) || null;
            } catch(loadError) {
                 console.error(`[FontMan] ERROR: Pending load for chunk '${chunkId}' failed.`, loadError);
                 return null; // Load failed
            }

        } else if (!_loadedFontChunks.has(chunkId)) {
            // Chunk not loaded and not pending, initiate load
            console.info(`[FontMan] INFO: Initiating load of chunk '${chunkId}' for font '${familyName}'.`);
            const loadPromise = _loadFontChunk(chunkId); // Returns promise
            _pendingFontLoads.set(chunkId, loadPromise);

            try {
                const newlyLoadedChunk = await loadPromise;
                _pendingFontLoads.delete(chunkId); // Remove pending status
                fontData = newlyLoadedChunk?.find(f => f.familyName?.toLowerCase() === lowerFamilyName) || null;
            } catch (loadError) {
                console.error(`[FontMan] ERROR: Failed to load chunk '${chunkId}' for '${familyName}'.`, loadError);
                 _pendingFontLoads.delete(chunkId); // Ensure removed on error
                return null; // Load failed
            }
        }
        // At this point, fontData should be populated if found in the loaded chunk

        if (fontData) {
            _injectFontFaceRules(fontData);
            return fontData;
        } else {
             // This case might happen if chunk loaded successfully but font wasn't in it (data inconsistency?)
             console.warn(`[FontMan] WARN: Chunk '${chunkId}' loaded, but font '${familyName}' not found within it.`);
             return null;
        }
    }

    // If not in chunked mode or not found after checking caches/loading
    console.warn(`[FontMan] WARN: Font '${familyName}' not found through any available mechanism.`);
    return null;
}


/**
 * Synchronously retrieves font data ONLY from already loaded caches.
 * Does NOT trigger dynamic loading. Use `getFontDataAsync` for that.
 * Primarily useful for quick checks or compatibility with non-async code.
 * @param {string} familyName - The case-insensitive font family name.
 * @returns {Object|null} The font data object if readily available in cache, otherwise null.
 */
function getFontDataByName(familyName) {
    if (!familyName) return null;
    const lowerFamilyName = familyName.toLowerCase();

    // Check full cache (_fontDataCache covers inline and traditional modes)
    if (_fontDataCache) {
        const font = _fontDataCache.find(f => f && f.familyName?.toLowerCase() === lowerFamilyName);
        if (font && font.variants) return font; // Ensure it has variants (full data)
    }

    // Check loaded chunks (chunked mode)
    if (_isChunkedMode) {
        const chunkId = _getChunkId(familyName);
        const chunk = _loadedFontChunks.get(chunkId);
        if (chunk) {
             const font = chunk.find(f => f.familyName?.toLowerCase() === lowerFamilyName);
             if (font && font.variants) return font; // Ensure full data
        }
    }

    // Final check on window._INLINE_FONTS_DATA (should be redundant if _fontDataCache is set correctly)
    if (!_fontDataCache && Array.isArray(window._INLINE_FONTS_DATA)) {
        const font = window._INLINE_FONTS_DATA.find(f =>
            f && f.familyName?.toLowerCase() === lowerFamilyName
        );
         if (font && font.variants) return font;
    }

    return null; // Not found in readily available caches
}


/**
 * Initiates loading for a specific font's data, primarily useful for preloading.
 * @param {string} familyName - The case-insensitive font family name.
 * @returns {Promise<Object|null>} A promise resolving to the font data or null if failed.
 */
async function preloadFontData(familyName) {
    console.info(`[FontMan] INFO: Preload requested for font: ${familyName}`);
    // Simply call getFontDataAsync which handles loading if necessary
    return await getFontDataAsync(familyName);
}

/**
 * Preloads all available fonts in the current mode (chunked, inline, traditional).
 * WARNING: This can be VERY heavy (100+ MB) in chunked mode!
 * @returns {Promise<{total: number, loaded: number, failed: number}>} Stats about the load process
 */
async function loadAllFonts() {
    console.info('[FontMan] INFO: Loading ALL FONTS requested (this may be heavy!)');
    
    if (_isChunkedMode && !_fontIndex) {
        console.error('[FontMan] ERROR: Cannot load all fonts in chunked mode without font index.');
        return { total: 0, loaded: 0, failed: 0 };
    }
    
    // Status updates to UI
    _dispatchProgressEvent(0, 'Starting full font library load (this may take a while)...');
    
    // Track all chunks to load in chunked mode
    if (_isChunkedMode) {
        const allChunks = ['a-f', 'g-m', 'n-z', '0-9', 'symbols'];
        let loadedChunks = 0;
        const totalChunks = allChunks.length;
        
        // Load all chunks concurrently
        const chunkPromises = allChunks.map(async chunkId => {
            try {
                if (!_loadedFontChunks.has(chunkId)) {
                    await _loadFontChunk(chunkId);
                }
                loadedChunks++;
                _dispatchProgressEvent(
                    Math.round((loadedChunks / totalChunks) * 100),
                    `Loaded font chunk ${loadedChunks}/${totalChunks}`
                );
                return true;
            } catch (error) {
                console.error(`[FontMan] Failed to load chunk ${chunkId}:`, error);
                return false;
            }
        });
        
        const results = await Promise.allSettled(chunkPromises);
        const loadedCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
        
        // Apply all font-face rules for all fonts we have in chunks
        let fontCount = 0;
        let fontFaceCount = 0;
        
        _loadedFontChunks.forEach(fonts => {
            fontCount += fonts.length;
            fonts.forEach(font => {
                _injectFontFaceRules(font);
                fontFaceCount += (font.variants?.length || 0);
            });
        });
        
        _dispatchProgressEvent(100, `Completed loading ${fontCount} fonts with ${fontFaceCount} variants!`);
        
        return {
            total: totalChunks,
            loaded: loadedCount,
            failed: totalChunks - loadedCount
        };
    }
    
    // For other modes (inline/traditional), we already have all the data, just need to inject
    if (_fontDataCache) {
        const totalFonts = _fontDataCache.length;
        let injectedCount = 0;
        let errorCount = 0;
        
        // Process in small batches to avoid UI freeze
        const BATCH_SIZE = 20;
        for (let i = 0; i < totalFonts; i += BATCH_SIZE) {
            const batch = _fontDataCache.slice(i, i + BATCH_SIZE);
            
            // Process batch
            batch.forEach(font => {
                try {
                    _injectFontFaceRules(font);
                    injectedCount++;
                } catch (e) {
                    errorCount++;
                    console.warn(`[FontMan] Failed to inject font faces for ${font.familyName}:`, e);
                }
            });
            
            // Update progress
            _dispatchProgressEvent(
                Math.round(((i + batch.length) / totalFonts) * 100),
                `Processed ${i + batch.length}/${totalFonts} fonts...`
            );
            
            // Give UI a chance to update
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        _dispatchProgressEvent(100, `Completed processing all ${totalFonts} fonts!`);
        
        return {
            total: totalFonts,
            loaded: injectedCount,
            failed: errorCount
        };
    }
    
    // No fonts available
    _dispatchProgressEvent(100, 'No fonts available to load in current mode.');
    return { total: 0, loaded: 0, failed: 0 };
}

// --- Export Public API ---
// Export the critical functions for use by other modules
export {
    initializeFonts,
    getFontDataAsync,
    getFontDataByName,
    preloadFontData,
    loadAllFonts,
    LOADING_STARTED_EVENT,
    LOADING_COMPLETE_EVENT,
    LOADING_PROGRESS_EVENT
};

// For backward compatibility with inline scripts
// Expose the key functions globally
window.getFontDataAsync = getFontDataAsync;
window.getFontDataByName = getFontDataByName;
window.getActiveAnimationKeyframes = window.getActiveAnimationKeyframes; // Preserve if exists
window.loadAllFonts = loadAllFonts; // Expose the loadAllFonts function globally