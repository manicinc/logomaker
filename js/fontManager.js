/**
 * Enhanced Font Manager with Improved Caching, Loading Feedback, and Load All option
 * v2.1 - Added detailed logging to _injectFontFaceRules
 * Exports: initializeFonts, getFontDataAsync, getFontDataByName, preloadFontData, loadAllFonts, event names
 */

// --- Module-level variables ---
let _fontDataCache = null; // Complete data cache (inline/traditional)
let _fontIndex = null; // Lightweight index (chunked mode)
let _loadedFontChunks = new Map(); // Cache for loaded chunks [chunkId, fonts[]]
let _isChunkedMode = false; // Operating mode flag
let _pendingFontLoads = new Map(); // Tracks in-progress chunk loads [chunkId, Promise]
let _injectedFontFaces = new Set(); // Tracks injected rules to prevent duplicates [familyName-weight-style]
let _dynamicStyleSheet = null; // Reference to the dynamic <style> sheet

// --- Constants ---
const CACHE_PREFIX = 'logomaker_font_';
const FONT_INDEX_CACHE_KEY = `${CACHE_PREFIX}index_v1`;
const FONT_CHUNK_CACHE_PREFIX = `${CACHE_PREFIX}chunk_`;
const FREQUENT_FONTS_CACHE_KEY = `${CACHE_PREFIX}frequent_v1`;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_FREQUENT_FONTS = 10;
const CHUNK_PATH = './font-chunks'; // Relative path to chunk dir
const LOADING_STARTED_EVENT = 'logomaker:font-loading-started';
const LOADING_COMPLETE_EVENT = 'logomaker:font-loading-complete';
const LOADING_PROGRESS_EVENT = 'logomaker:font-loading-progress';
const DYNAMIC_STYLE_ID = 'dynamic-font-style';
const DEFAULT_FETCH_RETRIES = 2; // Reduced retries slightly
const INITIAL_FETCH_RETRY_DELAY = 300;
const ESSENTIAL_FONTS = ['Orbitron', 'Audiowide', 'Russo One', 'Press Start 2P', 'Arial']; // Fonts to preload

// --- IndexedDB Setup ---
const DB_NAME = 'logomakerFontDB';
const DB_VERSION = 1;
const STORE_NAME = 'fontCacheStore';
let dbPromise = null;

function _openDB() { /* ... Keep function code from previous full version ... */
    if(!dbPromise){dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onerror=event=>{console.error('[FontMan DB] DB error:',event.target.error);reject(new Error('IndexedDB error: '+event.target.error?.message))};request.onsuccess=event=>{console.info('[FontMan DB] DB opened successfully.');resolve(event.target.result)};request.onupgradeneeded=event=>{console.info('[FontMan DB] DB upgrade needed.');const db=event.target.result;if(!db.objectStoreNames.contains(STORE_NAME)){db.createObjectStore(STORE_NAME,{keyPath:'key'});console.info(`[FontMan DB] Store '${STORE_NAME}' created.`)}}})}return dbPromise;
}
function _getDBStore(db, mode) { /* ... Keep function code from previous full version ... */
     const transaction=db.transaction(STORE_NAME,mode);return transaction.objectStore(STORE_NAME);
 }
async function _saveToDBStore(key, value) { /* ... Keep function code from previous full version ... */
    try{const db=await _openDB();const store=_getDBStore(db,'readwrite');const data={key:key,value:value,timestamp:Date.now()};const request=store.put(data);return new Promise((resolve,reject)=>{request.onsuccess=()=>{console.info(`[FontMan DB] Saved key: ${key}`);resolve()};request.onerror=event=>{console.error(`[FontMan DB] Error saving key ${key}:`,event.target.error);if(event.target.error?.name==='QuotaExceededError'){console.warn('[FontMan DB] Quota exceeded? Cleanup...');_cleanupDBStore(key).then(resolve).catch(reject)}else{reject(new Error('DB save error: '+event.target.error?.message))}}})}catch(error){console.error(`[FontMan DB] Failed DB open for save key ${key}:`,error)}
}
async function _loadFromDBStore(key) { /* ... Keep function code from previous full version ... */
     try{const db=await _openDB();const store=_getDBStore(db,'readonly');const request=store.get(key);return new Promise((resolve,reject)=>{request.onsuccess=event=>{const data=event.target.result;if(data&&data.timestamp&&(Date.now()-data.timestamp<CACHE_TTL)){console.info(`[FontMan DB] Using cached data for ${key}`);resolve(data.value)}else{if(data){console.info(`[FontMan DB] Cache expired for ${key}`);_deleteFromDBStore(key).catch(e=>console.warn(`[FontMan DB] Failed delete expired ${key}:`,e))}resolve(null)}};request.onerror=event=>{console.error(`[FontMan DB] Error loading key ${key}:`,event.target.error);resolve(null)}})}catch(error){console.error(`[FontMan DB] Failed DB open for load key ${key}:`,error);return null}
 }
async function _deleteFromDBStore(key) { /* ... Keep function code from previous full version ... */
    try{const db=await _openDB();const store=_getDBStore(db,'readwrite');const request=store.delete(key);return new Promise((resolve,reject)=>{request.onsuccess=()=>{console.info(`[FontMan DB] Deleted key: ${key}`);resolve()};request.onerror=event=>{console.error(`[FontMan DB] Error deleting key ${key}:`,event.target.error);reject(new Error('DB delete error: '+event.target.error?.message))}})}catch(error){console.error(`[FontMan DB] Failed DB open for delete key ${key}:`,error)}
}
async function _cleanupDBStore(keyToKeep) { /* ... Keep function code from previous full version ... */
     console.warn('[FontMan DB] Running cache cleanup...');let deletedCount=0;try{const db=await _openDB();const transaction=db.transaction(STORE_NAME,'readwrite');const store=transaction.objectStore(STORE_NAME);const request=store.openCursor();return new Promise((resolve,reject)=>{request.onsuccess=event=>{const cursor=event.target.result;if(cursor){const data=cursor.value;if(data.key!==keyToKeep&&(!data.timestamp||(Date.now()-data.timestamp>=CACHE_TTL))){console.info(`[FontMan DB] Cleaning key: ${data.key}`);cursor.delete();deletedCount++}cursor.continue()}else{console.info(`[FontMan DB] Cleanup done. Deleted ${deletedCount} items.`);resolve()}};request.onerror=event=>{console.error('[FontMan DB] Cursor cleanup error:',event.target.error);reject(event.target.error)}})}catch(error){console.error('[FontMan DB] Failed DB open for cleanup:',error)}
 }

// --- localStorage Cache Helpers (for index and frequency) ---
function _loadFromCache(key) { /* ... Keep function code from previous full version ... */
     try{const cached=localStorage.getItem(key);if(cached){const data=JSON.parse(cached);if(data?.timestamp&&(Date.now()-data.timestamp<CACHE_TTL)){console.info(`[FontMan] Using localStorage cache for ${key}`);return data.value}else{console.info(`[FontMan] localStorage cache expired for ${key}`)}}}catch(e){console.warn(`[FontMan] localStorage load failed for ${key}:`,e)}return null;
 }
function _saveToCache(key, value) { /* ... Keep function code from previous full version ... */
    try{const data={timestamp:Date.now(),value:value};localStorage.setItem(key,JSON.stringify(data));console.info(`[FontMan] Saved to localStorage: ${key}`)}catch(e){console.warn(`[FontMan] localStorage save failed for ${key}:`,e);_cleanupOldCaches(key,value)}
}
function _cleanupOldCaches(keyToSave, valueToSave) { /* ... Keep function code from previous full version ... */
     try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(CACHE_PREFIX)){try{const data=JSON.parse(localStorage.getItem(key));if(data?.timestamp&&(Date.now()-data.timestamp>=CACHE_TTL)){localStorage.removeItem(key);console.info(`[FontMan] Removed expired localStorage: ${key}`)}}catch(parseErr){localStorage.removeItem(key)}}}localStorage.setItem(keyToSave,JSON.stringify({timestamp:Date.now(),value:valueToSave}));console.info(`[FontMan] Saved to localStorage after cleanup: ${keyToSave}`)}catch(storageErr){console.warn(`[FontMan] Still cannot save localStorage, removing chunks:`,storageErr);const chunkCaches=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(FONT_CHUNK_CACHE_PREFIX)&&key!==keyToSave){try{const data=JSON.parse(localStorage.getItem(key));if(data?.timestamp){chunkCaches.push({key,timestamp:data.timestamp})}}catch(e){}}}chunkCaches.sort((a,b)=>a.timestamp-b.timestamp);for(const cache of chunkCaches){localStorage.removeItem(cache.key);console.info(`[FontMan] Removed old chunk localStorage: ${cache.key}`);try{localStorage.setItem(keyToSave,JSON.stringify({timestamp:Date.now(),value:valueToSave}));console.info(`[FontMan] Saved after removing chunk cache`);return}catch(e){console.warn(`[FontMan] Still not enough space...`)}}console.error(`[FontMan] Failed localStorage save after removing all chunks`)}
 }
function _trackFontUsage(fontFamily) { /* ... Keep function code from previous full version ... */
     if(!fontFamily)return;try{const frequentFonts=_loadFromCache(FREQUENT_FONTS_CACHE_KEY)||{};frequentFonts[fontFamily]=(frequentFonts[fontFamily]||0)+1;const fontEntries=Object.entries(frequentFonts);if(fontEntries.length>MAX_FREQUENT_FONTS){const mostFrequent=fontEntries.sort((a,b)=>b[1]-a[1]).slice(0,MAX_FREQUENT_FONTS);const prunedFrequent={};for(const[font,count]of mostFrequent){prunedFrequent[font]=count}_saveToCache(FREQUENT_FONTS_CACHE_KEY,prunedFrequent)}else{_saveToCache(FREQUENT_FONTS_CACHE_KEY,frequentFonts)}}catch(e){console.warn(`[FontMan] Failed track usage:`,e)}
 }
function _getFrequentFonts() { /* ... Keep function code from previous full version ... */
     try{const frequentFonts=_loadFromCache(FREQUENT_FONTS_CACHE_KEY)||{};return Object.entries(frequentFonts).sort((a,b)=>b[1]-a[1]).map(entry=>entry[0])}catch(e){console.warn(`[FontMan] Failed get frequent:`,e);return[]}
 }

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

/** @private Loads font chunk JSON file with retry and caching */
async function _loadFontChunk(chunkId) { /* ... Keep function code from previous full version ... */
    if(_loadedFontChunks.has(chunkId)&&_loadedFontChunks.get(chunkId).length>0){console.info(`[FontMan] DEBUG: Using memory cache chunk '${chunkId}'.`);return _loadedFontChunks.get(chunkId)}const cacheKey=`${FONT_CHUNK_CACHE_PREFIX}${chunkId}_v1`;const cachedChunk=await _loadFromDBStore(cacheKey);if(cachedChunk){_loadedFontChunks.set(chunkId,cachedChunk);console.info(`[FontMan] Using IndexedDB cache chunk '${chunkId}'.`);return cachedChunk}console.info(`[FontMan] INFO: Loading font chunk: ${chunkId}.json`);const url=`${CHUNK_PATH}/${chunkId}.json`;try{const response=await _fetchWithRetry(url,{},DEFAULT_FETCH_RETRIES,INITIAL_FETCH_RETRY_DELAY);const chunkData=await response.json();const fontsInChunk=chunkData?.fonts||(Array.isArray(chunkData)?chunkData:null);if(!Array.isArray(fontsInChunk)){throw new Error(`Invalid data format in ${chunkId}.json`)}_loadedFontChunks.set(chunkId,fontsInChunk);await _saveToDBStore(cacheKey,fontsInChunk);console.info(`[FontMan] INFO: Loaded & cached chunk ${chunkId} to IndexedDB.`);return fontsInChunk}catch(err){console.error(`[FontMan] ERROR: Failed load/parse chunk ${chunkId} from ${url}:`,err);_loadedFontChunks.set(chunkId,[]);throw err}
}

/**
 * Injects @font-face CSS rules into the dynamic stylesheet if they haven't been added already.
 * Includes detailed logging for debugging.
 * @param {Object} fontData - The full font data object containing the `variants` array.
 * @private
 */
function _injectFontFaceRules(fontData) {
    // Re-verify stylesheet availability before injecting
    if (!_dynamicStyleSheet) {
        const styleEl = document.getElementById(DYNAMIC_STYLE_ID);
        // Robust check for sheet access
        try { _dynamicStyleSheet = styleEl?.sheet; } catch (e) { console.error(`[Inject Rule] Error accessing stylesheet for ${DYNAMIC_STYLE_ID}:`, e); }

        if (!_dynamicStyleSheet) {
            console.error(`[Inject Rule] CRITICAL: Cannot inject for ${fontData?.familyName}: Dynamic stylesheet unavailable or inaccessible.`);
            return; // Cannot proceed
        }
    }

    if (!fontData || !Array.isArray(fontData.variants)) {
        console.warn(`[Inject Rule] Invalid font data for ${fontData?.familyName}, skipping injection.`);
        return;
    }

    const familyName = fontData.familyName;
    if (!familyName) {
         console.warn(`[Inject Rule] Skipping injection - missing familyName in fontData.`);
         return;
    }

    console.log(`[Inject Rule] Processing variants for: "${familyName}"`);

    fontData.variants.forEach(variant => {
        // Validate variant object structure minimally
        if (!variant || typeof variant !== 'object') {
             console.warn(`[Inject Rule] Invalid variant object found for ${familyName}. Skipping.`);
             return;
        }

        const weight = variant.weight || '400';
        const style = variant.style || 'normal';
        // ** Crucial Check: Use dataUrl (portable) OR url (deploy/dev) **
        const fontUrl = variant.dataUrl || variant.url;

        // ** If NEITHER url nor dataUrl exists, SKIP **
        if (!fontUrl) {
            console.warn(`[Inject Rule] SKIP Variant: No url/dataUrl property found for ${familyName} ${weight} ${style}. Check generate-fonts-json.js output.`);
            return; // Cannot inject without a source
        }

        const faceKey = `${familyName}-${weight}-${style}`;
        // console.log(`[Inject Rule] Checking variant: ${faceKey}`); // Verbose: Log variant check

        // ** Check if this exact variant face was already injected **
        if (_injectedFontFaces.has(faceKey)) {
            // console.log(`[Inject Rule] SKIP Variant: ${faceKey} already injected.`); // Verbose: Log skip reason
            return; // Skip if already injected
        }

        // Determine format string for CSS
        let format = 'woff2'; // Default assumption
        const sourceFormat = variant.format; // Use the format from the data if available

        if (sourceFormat) {
             switch(sourceFormat.toLowerCase()) {
                 case 'woff': format = 'woff'; break;
                 case 'woff2': format = 'woff2'; break;
                 case 'truetype': case 'ttf': format = 'truetype'; break;
                 case 'opentype': case 'otf': format = 'opentype'; break;
                 case 'embedded-opentype': case 'eot': format = 'embedded-opentype'; break;
                 default: format = sourceFormat; // Use original if specific but unknown
             }
        } else if (typeof fontUrl === 'string') { // Fallback: Guess from URL if format missing in data
            if (fontUrl.endsWith('.woff2')) format = 'woff2';
            else if (fontUrl.endsWith('.woff')) format = 'woff';
            else if (fontUrl.endsWith('.ttf')) format = 'truetype';
            else if (fontUrl.endsWith('.otf')) format = 'opentype';
            else if (fontUrl.endsWith('.eot')) format = 'embedded-opentype';
            else if (fontUrl.startsWith('data:')) { /* ... (keep data URI format detection logic) ... */
                const mimeMatch = fontUrl.match(/^data:(font|application)\/([\w+-]+);/); if (mimeMatch && mimeMatch[2]) { switch(mimeMatch[2].toLowerCase()) { case 'woff': format = 'woff'; break; case 'woff2': format = 'woff2'; break; case 'truetype': case 'ttf': format = 'truetype'; break; case 'opentype': case 'otf': format = 'opentype'; break; case 'vnd.ms-fontobject': format = 'embedded-opentype'; break; default: format = mimeMatch[2].toLowerCase(); } }
            }
        }
        // console.log(`[Inject Rule]   - Format determined: ${format}`); // Verbose: Log detected format

        // Construct the @font-face rule string
        // Ensure font family name is quoted
        const rule = `
            @font-face {
                font-family: "${familyName}";
                src: url("${fontUrl}") format("${format}");
                font-weight: ${weight};
                font-style: ${style};
                font-display: swap; /* Use swap for better perceived performance */
            }
        `;
        // console.log(`[Inject Rule]   - Generated Rule Snippet: ${rule.substring(0, 120).replace(/\s+/g, ' ')}...`); // Verbose

        // Inject the rule into the dynamic stylesheet
        try {
            _dynamicStyleSheet.insertRule(rule, _dynamicStyleSheet.cssRules.length);
            _injectedFontFaces.add(faceKey); // Mark as successfully injected
            console.log(`[Inject Rule]   - SUCCESS: Injected @font-face for: ${faceKey}`);
        } catch (e) {
            // Log specific errors during CSS rule insertion
            console.error(`[Inject Rule]   - ERROR: Failed to inject CSS rule for ${faceKey}:`, e.message);
            // console.error(`[Inject Rule]   - Failing Rule: ${rule}`); // Uncomment for deep CSS debugging
        }
    }); // End forEach variant
     // console.log(`[Inject Rule] Finished processing variants for: "${familyName}"`); // Verbose
}

/** @private Determines the chunk ID for a font family */
function _getChunkId(familyName) { /* ... Keep function code from previous full version ... */
     if(!familyName)return'symbols';const firstChar=familyName.trim().charAt(0).toLowerCase();if(firstChar>='a'&&firstChar<='f')return'a-f';if(firstChar>='g'&&firstChar<='m')return'g-m';if(firstChar>='n'&&firstChar<='z')return'n-z';if(firstChar>='0'&&firstChar<='9')return'0-9';return'symbols';
 }

/** @private Fetches URL with retry logic */
async function _fetchWithRetry(url, options, retries = DEFAULT_FETCH_RETRIES, initialDelay = INITIAL_FETCH_RETRY_DELAY) { /* ... Keep function code from previous full version ... */
    let delay=initialDelay;for(let i=0;i<=retries;i++){try{const response=await fetch(url,options);if(!response.ok){if(response.status>=400&&response.status<500){throw new Error(`Client Error ${response.status}`)}throw new Error(`HTTP Error ${response.status}`)}if(i>0)console.info(`[FontMan] Fetch ok for ${url} on retry ${i}.`);return response}catch(error){if(i===retries){console.error(`[FontMan] Fetch failed for ${url} after ${retries} retries.`,error);throw error}console.warn(`[FontMan] Fetch fail ${url}(${i+1}/${retries+1}), retry in ${delay}ms...`,error.message);await new Promise(resolve=>setTimeout(resolve,delay));delay*=2}}throw new Error(`[FontMan] Fetch failed unexpectedly for ${url}`);
}

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
 * Handles fetching chunks and injecting @font-face rules if operating in chunked mode.
 * Includes logging to check variant data integrity after loading/finding in chunk.
 * @param {string} familyName - The case-insensitive font family name.
 * @returns {Promise<Object|null>} A promise resolving to the full font data object or null.
 */
async function getFontDataAsync(familyName) {
    if (!familyName) {
        console.warn('[FontMan] WARN: getFontDataAsync called with null/empty familyName.');
        return null;
    }
    const lowerFamilyName = familyName.toLowerCase();

    _trackFontUsage(familyName); // Track usage

    let fontData = null;

    // --- Check Caches First ---
    // 1. Full cache (inline/traditional mode)
    if (_fontDataCache) {
        fontData = _fontDataCache.find(f => f && f.familyName?.toLowerCase() === lowerFamilyName);
        if (fontData) {
            console.info(`[FontMan] DEBUG: Found '${familyName}' in full _fontDataCache.`);
             // --- >>> DEBUG LOG BEFORE INJECT <<< ---
             console.log(`[FontMan DEBUG getFontDataAsync] Found in Full Cache - fontData object (variants check):`, JSON.stringify(fontData?.variants?.slice(0, 2), null, 2)); // Log first 2 variants
            _injectFontFaceRules(fontData);
            return fontData;
        }
    }

    // 2. Loaded chunks cache (chunked mode)
    if (_isChunkedMode) {
        const chunkId = _getChunkId(familyName);
        const loadedChunk = _loadedFontChunks.get(chunkId);
        if (loadedChunk) {
            fontData = loadedChunk.find(f => f.familyName?.toLowerCase() === lowerFamilyName);
            if (fontData) {
                console.info(`[FontMan] DEBUG: Found '${familyName}' in loaded chunk cache '${chunkId}'.`);
                // --- >>> DEBUG LOG BEFORE INJECT <<< ---
                console.log(`[FontMan DEBUG getFontDataAsync] Found in Chunk Cache - fontData object (variants check):`, JSON.stringify(fontData?.variants?.slice(0, 2), null, 2)); // Log first 2 variants
                _injectFontFaceRules(fontData);
                return fontData;
            }
        }
    }

    // --- Load if Necessary (Chunked Mode Only) ---
    if (_isChunkedMode && _fontIndex) {
        const fontInfoFromIndex = _fontIndex.find(f => f.familyName?.toLowerCase() === lowerFamilyName);
        if (!fontInfoFromIndex) { console.warn(`[FontMan] WARN: Font '${familyName}' not in index.`); return null; }

        const chunkId = _getChunkId(familyName);

        // Check if chunk is currently being loaded by another request
        if (_pendingFontLoads.has(chunkId)) {
            console.info(`[FontMan] DEBUG: Waiting pending load chunk '${chunkId}' for '${familyName}'.`);
            try {
                await _pendingFontLoads.get(chunkId); // Wait for existing promise
                const chunk = _loadedFontChunks.get(chunkId); // Get data loaded by the other process
                fontData = chunk?.find(f => f.familyName?.toLowerCase() === lowerFamilyName) || null;
            } catch(loadError) { console.error(`[FontMan] ERROR: Pending load chunk '${chunkId}' failed.`, loadError); return null; }
        } else if (!_loadedFontChunks.has(chunkId)) {
            // Chunk not loaded and not pending, initiate load
            console.info(`[FontMan] INFO: Initiating load chunk '${chunkId}' for '${familyName}'.`);
            const loadPromise = _loadFontChunk(chunkId);
            _pendingFontLoads.set(chunkId, loadPromise);
            try {
                const newlyLoadedChunk = await loadPromise;
                fontData = newlyLoadedChunk?.find(f => f.familyName?.toLowerCase() === lowerFamilyName) || null;
            } catch (loadError) { console.error(`[FontMan] ERROR: Failed load chunk '${chunkId}' for '${familyName}'.`, loadError); return null; }
            finally { _pendingFontLoads.delete(chunkId); }
        }
        // At this point, fontData should be populated if found in the loaded chunk

        // --- >>> DEBUG LOG BEFORE INJECT <<< ---
        // Log the retrieved fontData *after* loading/finding it in the chunk, before injecting
        if (fontData) {
             console.log(`[FontMan DEBUG getFontDataAsync] Found after Load - fontData object (variants check):`, JSON.stringify(fontData?.variants?.slice(0, 2), null, 2)); // Log first 2 variants
        } else {
             console.warn(`[FontMan DEBUG getFontDataAsync] Font '${familyName}' NOT found within loaded/pending chunk '${chunkId}'.`);
        }
        // --- >>> END DEBUG LOG <<< ---


        if (fontData) {
            _injectFontFaceRules(fontData); // Pass the potentially modified/corrupted object
            return fontData;
        } else {
            console.warn(`[FontMan] WARN: Chunk '${chunkId}' loaded, but font '${familyName}' not found within it.`);
            return null;
        }
    }

    // Fallback if none of the above found the font
    console.warn(`[FontMan] WARN: Font '${familyName}' not found.`);
    return null;
}

/**
 * Synchronously retrieves font data ONLY from already loaded caches. Does NOT trigger loading.
 * @param {string} familyName - The case-insensitive font family name.
 * @returns {Object|null} The font data object if readily available in cache, otherwise null.
 */
function getFontDataByName(familyName) { /* ... Keep function code from previous full version ... */
    if(!familyName)return null;const lowerFamilyName=familyName.toLowerCase();if(_fontDataCache){const font=_fontDataCache.find(f=>f?.familyName?.toLowerCase()===lowerFamilyName);if(font?.variants)return font}if(_isChunkedMode){const chunkId=_getChunkId(familyName);const chunk=_loadedFontChunks.get(chunkId);if(chunk){const font=chunk.find(f=>f.familyName?.toLowerCase()===lowerFamilyName);if(font?.variants)return font}}if(!_fontDataCache&&Array.isArray(window._INLINE_FONTS_DATA)){const font=window._INLINE_FONTS_DATA.find(f=>f?.familyName?.toLowerCase()===lowerFamilyName);if(font?.variants)return font}return null;
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