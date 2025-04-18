/**
 * scripts/split-fonts.js (v1.7 - Hybrid Chunk Data)
 * Splits inline-fonts-data.js into chunks for the 'deploy' target.
 * Reads inline-fonts-data.js (expects variants to have BOTH url and dataUrl from generator v1.9+).
 * Creates index.json (metadata) and chunk files (*.json) containing variant objects with BOTH url and dataUrl.
 * Includes generic verification.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CHUNK_DIR = 'font-chunks';
const SOURCE_JS = 'inline-fonts-data.js'; // Source file (should contain URLs + dataUrls generated WITHOUT --base64 flag meta)
const CHUNKS = ['a-f', 'g-m', 'n-z', '0-9', 'symbols'];
const PROJECT_ROOT = process.cwd();

console.log('Font Chunking Utility (Hybrid Data for Deploy Target)');
console.log('===================================================');

const chunkOutputDir = path.resolve(PROJECT_ROOT, CHUNK_DIR);
const sourceJsPath = path.resolve(PROJECT_ROOT, SOURCE_JS);

// --- Clean and Create Output Directory ---
try {
    console.log(`Cleaning chunk output directory: ${chunkOutputDir}`);
    if (fs.existsSync(chunkOutputDir)) { fs.rmSync(chunkOutputDir, { recursive: true, force: true }); console.log('Previous chunk directory removed.'); }
    fs.mkdirSync(chunkOutputDir, { recursive: true });
    console.log(`Created clean chunk output directory: ${chunkOutputDir}`);
} catch (cleanError) { console.error(`❌ ERROR: Failed to clean/create chunk output directory ${chunkOutputDir}:`, cleanError); process.exit(1); }

// --- Extract font data array ---
let fontsData = [];
let sourceMetadata = {};
try {
    console.log(`Reading source file: ${sourceJsPath}`);
    if (!fs.existsSync(sourceJsPath)) { throw new Error(`Source file not found: ${sourceJsPath}`); }
    const jsContent = fs.readFileSync(sourceJsPath, 'utf8');
    console.log(`Read ${jsContent.length} characters from source file.`);
    if (!jsContent || jsContent.trim().length === 0) { throw new Error(`Source file is empty: ${sourceJsPath}`); }

    console.log(`Extracting JSON object from ${SOURCE_JS}...`);
    const match = jsContent.match(/(?:window\._INLINE_FONTS_DATA\s*=\s*)({[\s\S]*});?/m);
    if (!match || !match[1]) { throw new Error('Could not extract font data structure using regex.'); }
    const jsonStr = match[1];

    console.log(`Parsing extracted JSON...`);
    let parsedData = JSON.parse(jsonStr);
    console.log(`JSON parse successful.`);

    if (!parsedData || !Array.isArray(parsedData.fonts)) { throw new Error('Invalid data structure (missing "fonts" array).'); }
    if (!parsedData.metadata) { console.warn("Warning: Parsed data missing 'metadata' block."); }
    // Check metadata flag confirms it was generated for this purpose (WITHOUT --base64 flag)
    if (parsedData.metadata?.base64Included === true) {
         console.error(`❌ ERROR: Input '${SOURCE_JS}' METADATA indicates Base64 mode ('base64Included' is true).`);
         console.error(`❌        This script requires the version whose metadata was generated WITHOUT '--base64'.`);
         process.exit(1);
     } else {
         console.log(`[Info] Input file metadata confirms base64Included=false (correct type for splitting).`);
     }
     // Optional deeper check: Verify first font variant actually has url AND dataUrl (or null)
     if (parsedData.fonts[0]?.variants[0] && (typeof parsedData.fonts[0].variants[0].url !== 'string' || typeof parsedData.fonts[0].variants[0].dataUrl === 'undefined')) {
        console.warn(`[Warn] Input file's first variant might be missing 'url' or 'dataUrl'. Expected hybrid structure.`);
     }


    fontsData = parsedData.fonts;
    sourceMetadata = parsedData.metadata || {};
    console.log(`Successfully extracted ${fontsData.length} fonts from ${SOURCE_JS}`);

} catch (err) { console.error(`\n❌ ERROR during data extraction/parsing in split-fonts.js: ${err.message}\n`, err.stack); process.exit(1); }

// --- Categorization and Tracking ---
if (!Array.isArray(fontsData)) { console.error("Critical error: fontsData is not an array."); process.exit(1); }
if (fontsData.length === 0) { console.warn("Warning: Extracted font data array is empty. Chunk files will be empty."); }
else { console.log(`Processing ${fontsData.length} fonts into chunks...`); }

const fontChunks = {};
CHUNKS.forEach(chunk => fontChunks[chunk] = []);
const categorizedFonts = new Map();
function getChunkForFont(font) {
    if (!font?.familyName) { console.warn(`Font missing familyName, assigning to 'symbols'.`); return 'symbols'; }
    const firstChar = font.familyName.trim().charAt(0).toLowerCase();
    if (firstChar >= 'a' && firstChar <= 'f') return 'a-f'; if (firstChar >= 'g' && firstChar <= 'm') return 'g-m';
    if (firstChar >= 'n' && firstChar <= 'z') return 'n-z'; if (firstChar >= '0' && firstChar <= '9') return '0-9';
    return 'symbols';
}

console.log("Categorizing fonts...");
let skippedCount = 0;
fontsData.forEach((font, index) => {
    if (!font?.familyName) { console.warn(`[Splitter DEBUG] Skipping font index ${index} (missing familyName).`); skippedCount++; return; }
    const currentFamilyName = font.familyName;

    // SIMPLIFIED VALIDATION: Check if variants exist and have a URL (required baseline)
    let hasValidVariants = true;
    if (!font.variants || font.variants.length === 0) { console.warn(`[Splitter WARNING] Font "${currentFamilyName}" has no variants array or is empty. Skipping.`); hasValidVariants = false; }
    else if (!font.variants.some(v => v && typeof v.url === 'string')) { console.warn(`[Splitter WARNING] Font "${currentFamilyName}" has NO variants with a 'url' property. Skipping.`); hasValidVariants = false; }

    if (!hasValidVariants) { console.warn(`[Splitter WARNING] Skipping categorization for "${currentFamilyName}" due to invalid variant data.`); skippedCount++; return; }

    const chunkName = getChunkForFont(font);
    if (fontChunks[chunkName]) { fontChunks[chunkName].push(font); categorizedFonts.set(currentFamilyName, chunkName); }
    else { console.error(`[Splitter ERROR] Internal error: Calculated chunk "${chunkName}" invalid. Assigning "${currentFamilyName}" to 'symbols'.`); fontChunks['symbols'].push(font); categorizedFonts.set(currentFamilyName, 'symbols'); skippedCount++; }
});
const categorizedCount = categorizedFonts.size;
console.log(`Categorized ${categorizedCount} valid fonts (skipped ${skippedCount}).`);


// --- Create index.json ---
console.log("Creating font index file (index.json)...");
const fontIndex = fontsData
    .filter(font => font?.familyName && categorizedFonts.has(font.familyName))
    .map(font => ({ familyName: font.familyName, displayName: font.displayName || font.familyName, formats: font.formats, hasDefaultFont: font.hasDefaultFont, fontCount: font.count, }));
const indexJsonPath = path.join(chunkOutputDir, 'index.json');
try { fs.writeFileSync(indexJsonPath, JSON.stringify(fontIndex, null, 2), 'utf-8'); console.log(`Created ${path.relative(PROJECT_ROOT, indexJsonPath)} with metadata for ${fontIndex.length} fonts`); }
catch (writeError) { console.error(`Failed to write ${indexJsonPath}:`, writeError); process.exit(1); }


// --- Write individual chunk files (now contain url and dataUrl) ---
console.log("Writing chunk files (*.json)...");
let totalChunkSize = 0; let totalFontsWrittenToChunks = 0; const writtenChunkPaths = {};
Object.entries(fontChunks).forEach(([chunkName, fontsInChunk]) => {
    const chunkPath = path.join(chunkOutputDir, `${chunkName}.json`); writtenChunkPaths[chunkName] = chunkPath; totalFontsWrittenToChunks += fontsInChunk.length;
    try {
        fs.writeFileSync(chunkPath, JSON.stringify({ fonts: fontsInChunk }, null, 2), 'utf-8');
        if (fontsInChunk.length > 0) { const stats = fs.statSync(chunkPath); totalChunkSize += stats.size; console.log(`Created ${path.relative(PROJECT_ROOT, chunkPath)} with ${fontsInChunk.length} fonts, size: ${(stats.size / 1024 / 1024).toFixed(3)} MB`); }
        else { console.log(`Created empty chunk file: ${path.relative(PROJECT_ROOT, chunkPath)}`); }
    } catch (writeError) { console.error(`Failed to write chunk file ${chunkPath}:`, writeError); }
});
console.log(`Wrote ${totalFontsWrittenToChunks} font entries across chunk files.`);
if (totalFontsWrittenToChunks !== categorizedCount) { console.warn(`Mismatch! Fonts categorized ${categorizedCount} vs written to chunks ${totalFontsWrittenToChunks}.`); }

// --- Verification Step ---
console.log("Verifying all categorized fonts were written to chunks...");
let missingCount = 0; const chunkCache = {};
for (const [familyName, expectedChunkName] of categorizedFonts.entries()) {
    const chunkPath = writtenChunkPaths[expectedChunkName]; if (!chunkPath) { console.error(`[Splitter VERIFY] ERROR: No chunk path for chunk "${expectedChunkName}" (Font: ${familyName})`); missingCount++; continue; }
    try {
        if (!chunkCache[expectedChunkName]) { if (fs.existsSync(chunkPath)) { const content = fs.readFileSync(chunkPath, 'utf-8'); chunkCache[expectedChunkName] = JSON.parse(content); } else { console.error(`[Splitter VERIFY] ERROR: Chunk file does not exist: ${chunkPath} (Font: ${familyName})`); chunkCache[expectedChunkName] = { fonts: [] }; } }
        const chunkData = chunkCache[expectedChunkName]; if (!chunkData?.fonts?.some(f => f.familyName === familyName)) { console.error(`[Splitter VERIFY] FAILED: Font "${familyName}" NOT FOUND in written chunk file "${expectedChunkName}.json"!`); missingCount++; }
    } catch (verifyError) { console.error(`[Splitter VERIFY] ERROR reading/parsing chunk "${expectedChunkName}.json" for font "${familyName}":`, verifyError); missingCount++; delete chunkCache[expectedChunkName]; }
}

if (missingCount > 0) { console.error(`\n❌ Verification FAILED: ${missingCount} categorized font(s) were NOT found in their respective output chunk files! Check logs above.`); process.exit(1); }
else { console.log(`\n✅ Verification SUCCESS: All ${categorizedCount} categorized fonts were found in their output chunk files.`); console.log(`Total size of font data chunks: ${(totalChunkSize / 1024 / 1024).toFixed(3)} MB`); console.log('Font chunking complete!'); process.exit(0); }