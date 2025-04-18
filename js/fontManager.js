/**
 * Enhanced Font Manager with Improved Caching, Loading Feedback, and Load All option
 * v2.2 - Hybrid Chunk Support (Chunks contain url + dataUrl)
 * - Prefers URL for @font-face injection for performance.
 * - Simplified getFontDataAsync (no merge needed).
 * Exports: initializeFonts, getFontDataAsync, getFontDataByName, preloadFontData, loadAllFonts, event names
 */

// --- Module-level variables ---
let _fontDataCache = null; // Cache for inline mode OR fully loaded traditional mode
let _fontIndex = null;
let _loadedFontChunks = new Map();
let _isChunkedMode = false;
let _pendingFontLoads = new Map();
let _injectedFontFaces = new Set();
let _dynamicStyleSheet = null;

// --- Constants ---
const CACHE_PREFIX = 'logomaker_font_';
const FONT_INDEX_CACHE_KEY = `${CACHE_PREFIX}index_v1`;
const FONT_CHUNK_CACHE_PREFIX = `${CACHE_PREFIX}chunk_`;
const FREQUENT_FONTS_CACHE_KEY = `${CACHE_PREFIX}frequent_v1`;
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_FREQUENT_FONTS = 10;
const CHUNK_PATH = './font-chunks';
const LOADING_STARTED_EVENT = 'logomaker:font-loading-started';
const LOADING_COMPLETE_EVENT = 'logomaker:font-loading-complete';
const LOADING_PROGRESS_EVENT = 'logomaker:font-loading-progress';
const DYNAMIC_STYLE_ID = 'dynamic-font-style';
const DEFAULT_FETCH_RETRIES = 2;
const INITIAL_FETCH_RETRY_DELAY = 300;
const ESSENTIAL_FONTS = ['Orbitron', 'Audiowide', 'Russo One', 'Press Start 2P', 'Arial'];

// --- IndexedDB Setup ---
const DB_NAME = 'logomakerFontDB'; const DB_VERSION = 1; const STORE_NAME = 'fontCacheStore';
let dbPromise = null;
function _openDB() { if(!dbPromise){dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onerror=e=>{console.error('[FontMan DB] Error:',e.target.error);reject(new Error('DB error'))};r.onsuccess=e=>{resolve(e.target.result)};r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:'key'})}})}return dbPromise }
function _getDBStore(db, mode) { return db.transaction(STORE_NAME,mode).objectStore(STORE_NAME) }
async function _saveToDBStore(key, value) { try{const db=await _openDB();const s=_getDBStore(db,'readwrite');const d={key,value,timestamp:Date.now()};const r=s.put(d);return new Promise((res,rej)=>{r.onsuccess=res;r.onerror=e=>{console.error(`DB Save Error ${key}:`,e.target.error);if(e.target.error?.name==='QuotaExceededError'){_cleanupDBStore(key).then(res).catch(rej)}else{rej(e.target.error)}}})}catch(e){console.error(`DB Save Fail ${key}:`,e)} }
async function _loadFromDBStore(key) { try{const db=await _openDB();const s=_getDBStore(db,'readonly');const r=s.get(key);return new Promise(res=>{r.onsuccess=e=>{const d=e.target.result;if(d&&d.timestamp&&(Date.now()-d.timestamp<CACHE_TTL)){res(d.value)}else{if(d)_deleteFromDBStore(key).catch(()=>{});res(null)}};r.onerror=e=>{console.error(`DB Load Error ${key}:`,e.target.error);res(null)}})}catch(e){console.error(`DB Load Fail ${key}:`,e);return null} }
async function _deleteFromDBStore(key) { try{const db=await _openDB();const s=_getDBStore(db,'readwrite');const r=s.delete(key);return new Promise((res,rej)=>{r.onsuccess=res;r.onerror=e=>{rej(e.target.error)}})}catch(e){} }
async function _cleanupDBStore(keyToKeep) { console.warn('[FontMan DB] Running cache cleanup...'); let deletedCount = 0; try { const db = await _openDB(); const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME); const req = store.openCursor(); return new Promise((resolve, reject) => { req.onsuccess = e => { const cursor = e.target.result; if (cursor) { const data = cursor.value; if (data.key !== keyToKeep && (!data.timestamp || (Date.now() - data.timestamp >= CACHE_TTL))) { cursor.delete(); deletedCount++; } cursor.continue(); } else { console.info(`[FontMan DB] Cleanup done. Deleted ${deletedCount} items.`); resolve(); } }; req.onerror = e => { reject(e.target.error); }; }); } catch (err) { console.error('[FontMan DB] Cleanup DB open error:', err); } }

// --- localStorage Cache Helpers ---
function _loadFromCache(key) { try{const c=localStorage.getItem(key);if(c){const d=JSON.parse(c);if(d?.timestamp&&(Date.now()-d.timestamp<CACHE_TTL))return d.value}}catch(e){} return null; }
function _saveToCache(key, value) { try{localStorage.setItem(key,JSON.stringify({timestamp:Date.now(),value}))}catch(e){console.warn(`LS Save Fail ${key}:`,e);_cleanupOldCaches(key,value)} }
function _cleanupOldCaches(keyToSave, valueToSave) { try { for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key?.startsWith(CACHE_PREFIX)) { try { const data = JSON.parse(localStorage.getItem(key)); if (!data?.timestamp || (Date.now() - data.timestamp >= CACHE_TTL)) { localStorage.removeItem(key); } } catch (parseErr) { localStorage.removeItem(key); } } } localStorage.setItem(keyToSave, JSON.stringify({ timestamp: Date.now(), value: valueToSave })); } catch (storageErr) { console.error(`LS Cleanup/Save Fail ${keyToSave}:`, storageErr); } }
function _trackFontUsage(fontFamily) { try { const freq = _loadFromCache(FREQUENT_FONTS_CACHE_KEY) || {}; freq[fontFamily] = (freq[fontFamily] || 0) + 1; const entries = Object.entries(freq); if (entries.length > MAX_FREQUENT_FONTS) { const pruned = Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_FREQUENT_FONTS)); _saveToCache(FREQUENT_FONTS_CACHE_KEY, pruned); } else { _saveToCache(FREQUENT_FONTS_CACHE_KEY, freq); } } catch (e) {} }
function _getFrequentFonts() { try { const freq = _loadFromCache(FREQUENT_FONTS_CACHE_KEY) || {}; return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(e => e[0]); } catch (e) { return []; } }

// --- UI Update Functions ---
/** @private Populates the font dropdown */
async function _populateFontDropdown(fonts) { /* ... Keep function code from previous full version ... */
    if(!fonts||!Array.isArray(fonts)||fonts.length===0){console.warn('[FontMan] Cannot populate dropdown: No fonts.');return}const dropdown=document.getElementById('fontFamily');if(!dropdown){console.warn('[FontMan] Cannot populate dropdown: #fontFamily missing.');return}try{while(dropdown.options.length>1&&dropdown.options[0].disabled){dropdown.remove(1)}if(dropdown.options.length>0&&!dropdown.options[0].disabled){dropdown.options.length=0}console.info(`[FontMan] Populating dropdown with ${fonts.length} fonts...`);const sortedFonts=[...fonts].sort((a,b)=>(a.displayName||a.familyName).localeCompare(b.displayName||b.familyName));const fragment=document.createDocumentFragment();sortedFonts.forEach(font=>{const option=document.createElement('option');option.value=font.familyName||'';option.textContent=font.displayName||font.familyName||'Unknown Font';fragment.appendChild(option)});if(dropdown.options.length>0&&dropdown.options[0].disabled){dropdown.options[0].textContent=`${fonts.length} Fonts Available`}dropdown.appendChild(fragment);console.info(`[FontMan] Dropdown populated with ${fonts.length} options.`);if(dropdown.options.length>0){const defaultFont='Orbitron';const defaultOption=Array.from(dropdown.options).find(opt=>opt.value===defaultFont);if(defaultOption){dropdown.value=defaultFont;console.info(`[FontMan] Set dropdown default: ${defaultFont}`)}else{for(let i=0;i<dropdown.options.length;i++){if(!dropdown.options[i].disabled){dropdown.selectedIndex=i;break}}}}
}catch(error){console.error('[FontMan] Error populating dropdown:',error);throw error}
 }
/** @private Populates dropdown with system fallbacks */
async function _populateFontDropdownWithFallbacks() { /* ... Keep function code from previous full version ... */
    const fallbackFonts=[{familyName:'Arial',displayName:'Arial(System)',variants:[{w:'400',s:'normal'},{w:'700',s:'normal'}]},{familyName:'Verdana',displayName:'Verdana(System)',variants:[{w:'400',s:'normal'},{w:'700',s:'normal'}]},{familyName:'Helvetica',displayName:'Helvetica(System)',variants:[{w:'400',s:'normal'},{w:'700',s:'normal'}]},{familyName:'Times New Roman',displayName:'Times New Roman(System)',variants:[{w:'400',s:'normal'},{w:'700',s:'normal'}]},{familyName:'Courier New',displayName:'Courier New(System)',variants:[{w:'400',s:'normal'},{w:'700',s:'normal'}]},{familyName:'Georgia',displayName:'Georgia(System)',variants:[{w:'400',s:'normal'},{w:'700',s:'normal'}]},{familyName:'Tahoma',displayName:'Tahoma(System)',variants:[{w:'400',s:'normal'},{w:'700',s:'normal'}]},{familyName:'Impact',displayName:'Impact(System)',variants:[{w:'400',s:'normal'}]}];console.warn('[FontMan] Using system fallback fonts.');if(!_fontDataCache){_fontDataCache=fallbackFonts}else{for(const fb of fallbackFonts){if(!_fontDataCache.some(f=>f.familyName===fb.familyName)){_fontDataCache.push(fb)}}}await _populateFontDropdown(fallbackFonts);
}
/** @private Dispatches progress events */
function _dispatchProgressEvent(percent, message) { /* ... Keep function code from previous full version ... */
    window.dispatchEvent(new CustomEvent(LOADING_PROGRESS_EVENT,{detail:{percent:percent,message:message}}));console.info(`[FontMan] Progress: ${percent}% - ${message}`);
}

// --- Core Font Data Retrieval & Loading ---


// --- Core Font Data Retrieval & Loading ---

// --- Core Font Data Retrieval & Loading ---

async function _loadFontChunk(chunkId) {
    if (_loadedFontChunks.has(chunkId) && _loadedFontChunks.get(chunkId).length > 0) { return _loadedFontChunks.get(chunkId); }
    const cacheKey = `${FONT_CHUNK_CACHE_PREFIX}${chunkId}_v1`;
    const cachedChunk = await _loadFromDBStore(cacheKey);
    if (cachedChunk) { _loadedFontChunks.set(chunkId, cachedChunk); console.info(`[FontMan] Using IndexedDB cache chunk '${chunkId}'.`); return cachedChunk; }
    console.info(`[FontMan] INFO: Loading font chunk: ${chunkId}.json`);
    const url = `${CHUNK_PATH}/${chunkId}.json`;
    try {
        const response = await _fetchWithRetry(url, {}, DEFAULT_FETCH_RETRIES, INITIAL_FETCH_RETRY_DELAY);
        const chunkData = await response.json();
        const fontsInChunk = chunkData?.fonts || (Array.isArray(chunkData) ? chunkData : null);
        if (!Array.isArray(fontsInChunk)) { throw new Error(`Invalid data format in ${chunkId}.json`); }
        _loadedFontChunks.set(chunkId, fontsInChunk);
        await _saveToDBStore(cacheKey, fontsInChunk);
        console.info(`[FontMan] INFO: Loaded & cached chunk ${chunkId} to IndexedDB.`);
        return fontsInChunk;
    } catch (err) { console.error(`[FontMan] ERROR: Failed load/parse chunk ${chunkId} from ${url}:`, err); _loadedFontChunks.set(chunkId, []); throw err; }
}

/**
 * Injects @font-face CSS rules. Prefers URL for src, uses dataUrl as fallback only.
 * @param {Object} fontData - Font data containing variants with url and potentially dataUrl.
 * @private
 */
function _injectFontFaceRules(fontData) {
    if (!_dynamicStyleSheet) { try { _dynamicStyleSheet = document.getElementById(DYNAMIC_STYLE_ID)?.sheet; } catch (e) { console.error(`[Inject Rule] Error accessing stylesheet:`, e); } }
    if (!_dynamicStyleSheet) { console.error(`[Inject Rule] CRITICAL: Cannot inject for ${fontData?.familyName}: Stylesheet unavailable.`); return; }
    if (!fontData || !Array.isArray(fontData.variants) || !fontData.familyName) { console.warn(`[Inject Rule] Invalid font data for injection: ${fontData?.familyName}`); return; }
    const familyName = fontData.familyName;

    // console.log(`[Inject Rule v2.2] Processing variants for: "${familyName}"`); // Less verbose

    fontData.variants.forEach(variant => {
        if (!variant || typeof variant !== 'object') { return; }
        const weight = variant.weight || '400'; const style = variant.style || 'normal';

        // *** Prefer URL for browser loading, use dataUrl as fallback ***
        const fontUrlSrc = variant.url || variant.dataUrl;
        const using = variant.url ? 'URL' : (variant.dataUrl ? 'DataURL' : 'NONE');

        if (!fontUrlSrc) { console.warn(`[Inject Rule v2.2] SKIP Variant: NEITHER url NOR dataUrl property found for ${familyName} ${weight} ${style}.`); return; }

        const faceKey = `${familyName}-${weight}-${style}`;
        if (_injectedFontFaces.has(faceKey)) { return; } // Skip if already injected

        // Determine format string for CSS
        let format = 'woff2'; const sourceFormat = variant.format;
        if (sourceFormat) { switch(sourceFormat.toLowerCase()){ case 'woff':format='woff';break; case 'woff2':format='woff2';break; case 'truetype':case 'ttf':format='truetype';break; case 'opentype':case 'otf':format='opentype';break; case 'embedded-opentype':case 'eot':format='embedded-opentype';break; default:format=sourceFormat; } }
        else if (typeof fontUrlSrc === 'string') { if (fontUrlSrc.endsWith('.woff2')) format = 'woff2'; else if (fontUrlSrc.endsWith('.woff')) format = 'woff'; else if (fontUrlSrc.endsWith('.ttf')) format = 'truetype'; else if (fontUrlSrc.endsWith('.otf')) format = 'opentype'; else if (fontUrlSrc.endsWith('.eot')) format = 'embedded-opentype'; else if (fontUrlSrc.startsWith('data:')) { const m=fontUrlSrc.match(/^data:(?:font|application)\/([\w+-]+);/); if(m&&m[1]){ switch(m[1].toLowerCase()){ case 'woff':format='woff';break; case 'woff2':format='woff2';break; case 'truetype':case 'ttf':format='truetype';break; case 'opentype':case 'otf':format='opentype';break; case 'vnd.ms-fontobject':format='embedded-opentype';break; default:format=m[1].toLowerCase();}} } }

        const rule = `@font-face {font-family: "${familyName}"; src: url("${fontUrlSrc}") format("${format}"); font-weight: ${weight}; font-style: ${style}; font-display: swap;}`;

        try {
            _dynamicStyleSheet.insertRule(rule, _dynamicStyleSheet.cssRules.length);
            _injectedFontFaces.add(faceKey);
            // console.log(`[Inject Rule v2.2]  - SUCCESS: Injected @font-face for: ${faceKey} (using ${using})`); // Less verbose
        } catch (e) { console.error(`[Inject Rule v2.2]  - ERROR: Failed to inject CSS rule for ${faceKey}:`, e.message); }
    });
}


function _getChunkId(familyName) {
    if (!familyName) return 'symbols'; const firstChar = familyName.trim().charAt(0).toLowerCase();
    if (firstChar >= 'a' && firstChar <= 'f') return 'a-f'; if (firstChar >= 'g' && firstChar <= 'm') return 'g-m';
    if (firstChar >= 'n' && firstChar <= 'z') return 'n-z'; if (firstChar >= '0' && firstChar <= '9') return '0-9';
    return 'symbols';
}
async function _fetchWithRetry(url, options, retries = DEFAULT_FETCH_RETRIES, initialDelay = INITIAL_FETCH_RETRY_DELAY) { let delay=initialDelay;for(let i=0;i<=retries;i++){try{const r=await fetch(url,options);if(!r.ok){if(r.status>=400&&r.status<500)throw new Error(`Client ${r.status}`);throw new Error(`HTTP ${r.status}`)}return r}catch(e){if(i===retries)throw e;await new Promise(res=>setTimeout(res,delay));delay*=2}}throw new Error(`Workspace failed: ${url}`); }

// --- Initialization ---

/**
 * Initializes the font system. Determines loading strategy (inline, cached index, chunked, traditional, fallback).
 * @returns {Promise<boolean>} True if initialized with custom fonts, false if only fallbacks used or critical error.
 */
async function initializeFonts() { /* ... Keep function code from previous full version ... */
    console.info('[FontMan] INFO: Initializing font system...');window.dispatchEvent(new CustomEvent(LOADING_STARTED_EVENT));try{const styleEl=document.getElementById(DYNAMIC_STYLE_ID);if(!styleEl||!(styleEl instanceof HTMLStyleElement)){throw new Error(`Missing <style id="${DYNAMIC_STYLE_ID}">`)}_dynamicStyleSheet=styleEl.sheet;if(!_dynamicStyleSheet){await new Promise(resolve=>setTimeout(resolve,50));_dynamicStyleSheet=styleEl.sheet;if(!_dynamicStyleSheet)throw new Error(`Cannot access sheet for #${DYNAMIC_STYLE_ID}`)}}catch(styleSheetError){console.error('[FontMan] CRITICAL: Stylesheet access failed.',styleSheetError);window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT,{detail:{success:false,mode:'error',error:`Stylesheet Error: ${styleSheetError.message}`}}));return false}const dropdown=document.getElementById('fontFamily');if(!dropdown){console.error("[FontMan] CRITICAL: #fontFamily dropdown missing!");window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT,{detail:{success:false,mode:'error',error:'Dropdown missing'}}));return false}_dispatchProgressEvent(10,'Starting font system...');try{_fontIndex=_loadFromCache(FONT_INDEX_CACHE_KEY);if(_fontIndex&&Array.isArray(_fontIndex)&&_fontIndex.length>0){console.info(`[FontMan] INFO: Using cached index (${_fontIndex.length} fonts). Mode: cached`);_isChunkedMode=true;_dispatchProgressEvent(30,`Loading index from cache(${_fontIndex.length})...`);await _populateFontDropdown(_fontIndex);_dispatchProgressEvent(60,'Preloading essential...');const preloadPromises=[];const essentialFonts=[...ESSENTIAL_FONTS,..._getFrequentFonts()];for(const font of essentialFonts){if(dropdown.querySelector(`option[value="${font}"]`)){console.info(`[FontMan] Preloading essential:${font}`);preloadPromises.push(preloadFontData(font).catch(e=>console.warn(`[FontMan] Preload failed ${font}:`,e)))}}await Promise.allSettled(preloadPromises);_dispatchProgressEvent(100,`Init ok with ${_fontIndex.length} from cache`);window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT,{detail:{success:true,mode:'cached',fontCount:_fontIndex.length}}));return true}if(Array.isArray(window._INLINE_FONTS_DATA)&&window._INLINE_FONTS_DATA.length>0){console.info(`[FontMan] INFO: Using inline data(${window._INLINE_FONTS_DATA.length}). Mode: inline`);_fontDataCache=window._INLINE_FONTS_DATA;_dispatchProgressEvent(50,`Loading ${_fontDataCache.length} embedded...`);await _populateFontDropdown(_fontDataCache);_dispatchProgressEvent(100,`Init ok with ${_fontDataCache.length} embedded`);window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT,{detail:{success:true,mode:'inline',fontCount:_fontDataCache.length}}));return true}console.info('[FontMan] DEBUG: No inline data found.');_dispatchProgressEvent(20,'Attempting chunked loading...');try{console.info(`[FontMan] DEBUG: Fetching ${CHUNK_PATH}/index.json`);const indexResponse=await _fetchWithRetry(`${CHUNK_PATH}/index.json`);_dispatchProgressEvent(40,'Parsing index...');_fontIndex=await indexResponse.json();if(!Array.isArray(_fontIndex))throw new Error("Invalid index.");_isChunkedMode=true;console.info(`[FontMan] INFO: Loaded index(${_fontIndex.length}). Mode: chunked`);_saveToCache(FONT_INDEX_CACHE_KEY,_fontIndex);_dispatchProgressEvent(60,`Populating dropdown(${_fontIndex.length})...`);await _populateFontDropdown(_fontIndex);_dispatchProgressEvent(80,'Preloading essential...');const defaultFontFamily=dropdown.value;const essentialFonts=new Set([defaultFontFamily,...ESSENTIAL_FONTS.filter(f=>dropdown.querySelector(`option[value="${f}"]`)),..._getFrequentFonts().slice(0,3)]);for(const font of essentialFonts){if(font){console.info(`[FontMan] Proactive preload:${font}`);preloadFontData(font).catch(e=>console.warn(`[FontMan] Preload fail '${font}':`,e.message))}}_dispatchProgressEvent(100,`Init ok with ${_fontIndex.length} indexed`);window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT,{detail:{success:true,mode:'chunked',fontCount:_fontIndex.length}}));return true}catch(chunkIndexError){console.warn('[FontMan] WARN: Chunked load failed:',chunkIndexError.message);_dispatchProgressEvent(50,'Chunked failed, trying JSON...')}}catch(error){console.error('[FontMan] CRITICAL: Unhandled init error:',error);_dispatchProgressEvent(100,'Init critically failed.');try{await _populateFontDropdownWithFallbacks()}catch(fbError){}window.dispatchEvent(new CustomEvent(LOADING_COMPLETE_EVENT,{detail:{success:false,mode:'error',error:error.message}}));return false}
}

/**
 * Asynchronously retrieves font data for a specific font family name.
 * Handles fetching chunks (now containing url+dataUrl) and injecting @font-face rules.
 * Data returned contains BOTH url and dataUrl (if generated successfully).
 */
async function getFontDataAsync(familyName) {
    if (!familyName) { return null; }
    const lowerFamilyName = familyName.toLowerCase();
    _trackFontUsage(familyName);

    let fontData = null;
    let source = 'unknown';

    // Check caches first
    if (_fontDataCache) { fontData = _fontDataCache.find(f => f?.familyName?.toLowerCase() === lowerFamilyName); if (fontData) source = 'inlineOrFullCache'; }
    if (!fontData && _isChunkedMode) { const chunkId = _getChunkId(familyName); const loadedChunk = _loadedFontChunks.get(chunkId); if (loadedChunk) { fontData = loadedChunk.find(f => f.familyName?.toLowerCase() === lowerFamilyName); if (fontData) source = 'chunkMemoryCache'; } }

    // Load if necessary (Chunked Mode Only)
    if (!fontData && _isChunkedMode && _fontIndex) {
        const fontInfoFromIndex = _fontIndex.find(f => f.familyName?.toLowerCase() === lowerFamilyName);
        if (!fontInfoFromIndex) { console.warn(`[FontMan] WARN: Font '${familyName}' not in index.`); return null; }
        const chunkId = _getChunkId(familyName);

        if (_pendingFontLoads.has(chunkId)) {
             // console.info(`[FontMan] DEBUG: Waiting pending load chunk '${chunkId}' for '${familyName}'.`); // Less verbose
             try { await _pendingFontLoads.get(chunkId); const chunk = _loadedFontChunks.get(chunkId); fontData = chunk?.find(f => f.familyName?.toLowerCase() === lowerFamilyName) || null; if(fontData) source = 'chunkLoadPending'; }
             catch(loadError) { console.error(`[FontMan] ERROR: Pending load chunk '${chunkId}' failed.`, loadError); return null; }
        } else if (!_loadedFontChunks.has(chunkId)) {
            console.info(`[FontMan] INFO: Initiating load chunk '${chunkId}' for '${familyName}'.`);
            const loadPromise = _loadFontChunk(chunkId); _pendingFontLoads.set(chunkId, loadPromise);
            try { const newlyLoadedChunk = await loadPromise; fontData = newlyLoadedChunk?.find(f => f.familyName?.toLowerCase() === lowerFamilyName) || null; if(fontData) source = 'chunkLoadNew'; }
            catch (loadError) { console.error(`[FontMan] ERROR: Failed load chunk '${chunkId}' for '${familyName}'.`, loadError); return null; }
            finally { _pendingFontLoads.delete(chunkId); }
        } else {
             const chunk = _loadedFontChunks.get(chunkId); fontData = chunk?.find(f => f.familyName?.toLowerCase() === lowerFamilyName) || null; if (fontData) source = 'chunkMemoryCacheRace';
        }
    }

    // Process Found Data
    if (fontData) {
        // console.log(`[FontMan DEBUG getFontDataAsync] Found '${familyName}' (source: ${source}). Variants check (first):`, JSON.stringify(fontData?.variants?.slice(0, 1), null, 2)); // Less verbose
        _injectFontFaceRules(fontData); // Inject rules (prefers URL)
        return fontData; // Return the full data with both url and dataUrl
    } else {
        console.warn(`[FontMan] WARN: Font '${familyName}' not found after checking all sources.`);
        return null;
    }
}

/**
 * Synchronously retrieves font data ONLY from already loaded caches.
 * Returns data including url and dataUrl if available in cache.
 */
function getFontDataByName(familyName) {
    if (!familyName) return null;
    const lowerFamilyName = familyName.toLowerCase();

    // Check full cache (from inline)
    if (_fontDataCache) { const font = _fontDataCache.find(f => f?.familyName?.toLowerCase() === lowerFamilyName); if (font?.variants?.length > 0 && (font.variants[0].url || font.variants[0].dataUrl)) { return font; } }
    // Check loaded chunk cache
    if (_isChunkedMode) { const chunkId = _getChunkId(familyName); const chunk = _loadedFontChunks.get(chunkId); if (chunk) { const font = chunk.find(f => f.familyName?.toLowerCase() === lowerFamilyName); if (font?.variants?.length > 0 && (font.variants[0].url || font.variants[0].dataUrl)) { return font; } } }
    // console.log(`[FontMan DEBUG getFontDataByName] Font '${familyName}' not found in any sync cache.`); // Less verbose
    return null;
}

/** Initiates loading for a specific font's data (preloading). */
async function preloadFontData(familyName) { /* ... Keep function code from previous full version ... */
     console.info(`[FontMan] INFO: Preload requested: ${familyName}`);return await getFontDataAsync(familyName);
 }

/** Preloads all available fonts (can be VERY heavy). */
async function loadAllFonts() { /* ... Keep function code from previous full version ... */
     console.info('[FontMan] INFO: Loading ALL FONTS requested...');if(_isChunkedMode&&!_fontIndex){console.error('[FontMan] ERROR: Cannot load all - chunked mode missing index.');return{total:0,loaded:0,failed:0}}_dispatchProgressEvent(0,'Starting full library load...');if(_isChunkedMode){const allChunks=['a-f','g-m','n-z','0-9','symbols'];let loadedChunks=0;const totalChunks=allChunks.length;const chunkPromises=allChunks.map(async chunkId=>{try{if(!_loadedFontChunks.has(chunkId)){await _loadFontChunk(chunkId)}loadedChunks++;_dispatchProgressEvent(Math.round((loadedChunks/totalChunks)*100),`Loaded chunk ${loadedChunks}/${totalChunks}`);return true}catch(error){console.error(`[FontMan] Failed load chunk ${chunkId}:`,error);return false}});const results=await Promise.allSettled(chunkPromises);const loadedCount=results.filter(r=>r.status==='fulfilled'&&r.value).length;let fontCount=0;let fontFaceCount=0;_loadedFontChunks.forEach(fonts=>{fontCount+=fonts.length;fonts.forEach(font=>{_injectFontFaceRules(font);fontFaceCount+=(font.variants?.length||0)})});_dispatchProgressEvent(100,`Completed loading ${fontCount} fonts (${fontFaceCount} variants)!`);return{total:totalChunks,loaded:loadedCount,failed:totalChunks-loadedCount}}if(_fontDataCache){const totalFonts=_fontDataCache.length;let injectedCount=0;let errorCount=0;const BATCH_SIZE=20;for(let i=0;i<totalFonts;i+=BATCH_SIZE){const batch=_fontDataCache.slice(i,i+BATCH_SIZE);batch.forEach(font=>{try{_injectFontFaceRules(font);injectedCount++}catch(e){errorCount++;console.warn(`[FontMan] Inject fail ${font.familyName}:`,e)}});_dispatchProgressEvent(Math.round(((i+batch.length)/totalFonts)*100),`Processed ${i+batch.length}/${totalFonts}...`);await new Promise(resolve=>setTimeout(resolve,0))}_dispatchProgressEvent(100,`Completed processing ${totalFonts} fonts!`);return{total:totalFonts,loaded:injectedCount,failed:errorCount}}_dispatchProgressEvent(100,'No fonts available.');return{total:0,loaded:0,failed:0};
 }

 // --- Add this function inside js/fontManager.js ---

/**
 * Clears all data from the font cache IndexedDB object store.
 * @returns {Promise<void>}
 */
async function clearFontCacheDB() {
    console.warn('[FontMan DB] Attempting to CLEAR font cache store...');
    try {
        const db = await _openDB(); // Ensure DB is open
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear(); // Clear all entries in the store

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                console.log(`[FontMan DB] Store '${STORE_NAME}' cleared successfully.`);
                // Also clear the in-memory chunk cache
                _loadedFontChunks.clear();
                _fontIndex = null; // Clear in-memory index too
                 _pendingFontLoads.clear(); // Clear pending loads
                 localStorage.removeItem(FONT_INDEX_CACHE_KEY); // Clear localStorage index cache
                console.log('[FontMan] In-memory font cache/index cleared.');
                resolve();
            };
            request.onerror = (event) => {
                console.error('[FontMan DB] Error clearing store:', event.target.error);
                reject(new Error('DB clear error: ' + event.target.error?.message));
            };
             transaction.oncomplete = () => {
                 console.log("[FontMan DB] Clear transaction completed.");
             };
             transaction.onerror = (event) => {
                  console.error("[FontMan DB] Clear transaction error:", event.target.error);
                  // Reject might already have happened via request.onerror
             };
        });
    } catch (error) {
        console.error('[FontMan DB] Failed to open DB for clearing:', error);
        throw error; // Re-throw error
    }
}

// --- Export Public API ---
export {
    initializeFonts, getFontDataAsync, getFontDataByName, preloadFontData, loadAllFonts,
    LOADING_STARTED_EVENT, LOADING_COMPLETE_EVENT, LOADING_PROGRESS_EVENT, clearFontCacheDB
};

// --- Expose Globally (for compatibility/ease of access) ---
window.clearFontCacheDB = clearFontCacheDB;
window.getFontDataAsync = getFontDataAsync;
window.getFontDataByName = getFontDataByName;
// Keep if needed: window.getActiveAnimationKeyframes = window.getActiveAnimationKeyframes;
window.loadAllFonts = loadAllFonts;