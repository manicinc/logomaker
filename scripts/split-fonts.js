/**
 * scripts/split-fonts.js (v1.5 - Greedy Regex & Final JSON Check)
 * Splits inline-fonts-data.js into chunks for the 'deploy' target.
 * Reads the version of inline-fonts-data.js generated WITHOUT base64 (contains URLs).
 * Creates index.json (metadata) and chunk files (*.json) containing variant objects with URLs.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CHUNK_DIR = 'font-chunks'; // Output directory relative to project root
const SOURCE_JS = 'inline-fonts-data.js'; // Source file (SHOULD contain URLs for deploy target)
const CHUNKS = ['a-f', 'g-m', 'n-z', '0-9', 'symbols'];
const PROJECT_ROOT = process.cwd();

console.log('Font Chunking Utility (for Deploy Target)');
console.log('========================================');

const chunkOutputDir = path.resolve(PROJECT_ROOT, CHUNK_DIR);
const sourceJsPath = path.resolve(PROJECT_ROOT, SOURCE_JS);

// --- Clean and Create Output Directory ---
try {
    console.log(`Cleaning chunk output directory: ${chunkOutputDir}`);
    if (fs.existsSync(chunkOutputDir)) {
        fs.rmSync(chunkOutputDir, { recursive: true, force: true });
        console.log('Previous chunk directory removed.');
    }
    fs.mkdirSync(chunkOutputDir, { recursive: true });
    console.log(`Created clean chunk output directory: ${chunkOutputDir}`);
} catch (cleanError) {
    console.error(`❌ ERROR: Failed to clean/create chunk output directory ${chunkOutputDir}:`, cleanError);
    process.exit(1);
}

// --- Extract font data array ---
let fontsData = [];
let sourceMetadata = {};
let jsContent = '';

try {
    console.log(`Reading source file: ${sourceJsPath}`);
    if (!fs.existsSync(sourceJsPath)) { throw new Error(`Source file not found: ${sourceJsPath}`); }
    jsContent = fs.readFileSync(sourceJsPath, 'utf8');
    console.log(`Read ${jsContent.length} characters from source file.`);
    if (!jsContent || jsContent.trim().length === 0) { throw new Error(`Source file is empty: ${sourceJsPath}`); }

    // Extract JSON string using Regex (Greedy approach)
    console.log(`Extracting JSON object from ${SOURCE_JS}...`);
    const match = jsContent.match(/(?:window\._INLINE_FONTS_DATA\s*=\s*)({[\s\S]*});?/m);
    if (!match || !match[1]) { throw new Error('Could not extract font data structure using regex.'); }
    const jsonStr = match[1];

    // Parse the extracted JSON string
    console.log(`Parsing extracted JSON...`);
    // console.log(`DEBUG: Tail of extracted string: ...${jsonStr.slice(-100)}`); // Keep for debugging if needed
    let parsedData = JSON.parse(jsonStr);
    console.log(`JSON parse successful.`);

    // Validate the parsed structure
    if (!parsedData || !Array.isArray(parsedData.fonts)) { throw new Error('Invalid data structure (missing "fonts" array).'); }
    if (!parsedData.metadata) { console.warn("Warning: Parsed data missing 'metadata' block."); }
    if (parsedData.metadata?.base64Included === true) { console.warn("Warning: Splitting data that appears to include Base64 - ensure generate-fonts was run WITHOUT --base64 for deploy target."); }

    // Success
    fontsData = parsedData.fonts;
    sourceMetadata = parsedData.metadata || {}; // Keep metadata if present
    console.log(`Successfully extracted ${fontsData.length} fonts from ${SOURCE_JS}`);

} catch (err) {
    console.error(`\n❌ ERROR during data extraction/parsing in split-fonts.js: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
}

// --- Categorization and Writing ---
if (!Array.isArray(fontsData)) { console.error("Critical error: fontsData is not an array."); process.exit(1); }
if (fontsData.length === 0) { console.warn("Warning: Extracted font data array is empty. Chunk files will be empty."); }
else { console.log(`Processing ${fontsData.length} fonts into chunks...`); }

const fontChunks = {};
CHUNKS.forEach(chunk => fontChunks[chunk] = []);

// Function to determine chunk based on first letter of familyName
function getChunkForFont(font) {
    if (!font?.familyName) { console.warn(`Font missing familyName, assigning to 'symbols'.`); return 'symbols'; }
    const firstChar = font.familyName.trim().charAt(0).toLowerCase();
    if (firstChar >= 'a' && firstChar <= 'f') return 'a-f';
    if (firstChar >= 'g' && firstChar <= 'm') return 'g-m';
    if (firstChar >= 'n' && firstChar <= 'z') return 'n-z';
    if (firstChar >= '0' && firstChar <= '9') return '0-9';
    return 'symbols';
}

// Categorize fonts into respective chunks
console.log("Categorizing fonts...");
let categorizedCount = 0;
fontsData.forEach((font, index) => {
    if (!font?.familyName) { console.warn(`Skipping font index ${index} (missing familyName).`); return; }
    // *** VERIFICATION STEP ***
    // Check if variant objects have the 'url' property as expected for deploy build
    if (!font.variants || font.variants.length === 0 || !font.variants.every(v => v && typeof v.url === 'string')) {
         console.warn(`[WARNING] Font "${font.familyName}" is missing 'url' property in one or more variants in the source data read by split-fonts.js! This shouldn't happen after fixing generate-fonts-json.js. Skipping categorization for this font.`);
         return; // Skip this font if data is bad
    }
    // *** END VERIFICATION ***

    const chunk = getChunkForFont(font);
    if (fontChunks[chunk]) {
        fontChunks[chunk].push(font);
        categorizedCount++;
    } else {
        console.error(`Internal error: Calculated chunk "${chunk}" invalid. Assigning "${font.familyName}" to 'symbols'.`);
        fontChunks['symbols'].push(font); // Add to symbols as fallback
        categorizedCount++;
    }
});
console.log(`Categorized ${categorizedCount} fonts.`);
if (categorizedCount !== fontsData.length) { console.warn(`Mismatch: ${categorizedCount} categorized vs ${fontsData.length} total (some may have been skipped due to missing URL).`); }


// --- Create index.json (metadata only for dropdown) ---
console.log("Creating font index file (index.json)...");
const fontIndex = fontsData
    .filter(font => font?.familyName) // Ensure familyName exists
    .map(font => ({ // Map to simpler structure
        familyName: font.familyName,
        displayName: font.displayName || font.familyName,
        formats: font.formats,
        hasDefaultFont: font.hasDefaultFont,
        fontCount: font.fontCount,
        // Optionally include other non-variant metadata if needed by UI immediately
    }));

const indexJsonPath = path.join(chunkOutputDir, 'index.json');
try {
    fs.writeFileSync(indexJsonPath, JSON.stringify(fontIndex, null, 2), 'utf-8');
    console.log(`Created ${path.relative(PROJECT_ROOT, indexJsonPath)} with metadata for ${fontIndex.length} fonts`);
    if (fontIndex.length !== fontsData.length) { console.warn(`Index file count ${fontIndex.length} differs from source ${fontsData.length}.`); }
} catch (writeError) { console.error(`Failed to write ${indexJsonPath}:`, writeError); process.exit(1); }


// --- Write individual chunk files ---
console.log("Writing chunk files (*.json)...");
let totalChunkSize = 0; let totalFontsWrittenToChunks = 0;
Object.entries(fontChunks).forEach(([chunkName, fontsInChunk]) => {
    const chunkPath = path.join(chunkOutputDir, `${chunkName}.json`);
    totalFontsWrittenToChunks += fontsInChunk.length;
    try {
        // Write the chunk data (contains full variant objects including URLs)
        fs.writeFileSync(chunkPath, JSON.stringify({ fonts: fontsInChunk }, null, 2), 'utf-8');
        if (fontsInChunk.length > 0) {
            const stats = fs.statSync(chunkPath);
            totalChunkSize += stats.size;
            console.log(`Created ${path.relative(PROJECT_ROOT, chunkPath)} with ${fontsInChunk.length} fonts, size: ${(stats.size / 1024 / 1024).toFixed(3)} MB`);
        } else {
            console.log(`Created empty chunk file: ${path.relative(PROJECT_ROOT, chunkPath)}`);
        }
    } catch (writeError) {
        console.error(`Failed to write chunk file ${chunkPath}:`, writeError);
    }
});
console.log(`Wrote ${totalFontsWrittenToChunks} font entries across chunk files.`);
if (totalFontsWrittenToChunks !== categorizedCount) { console.warn(`Mismatch! Fonts categorized ${categorizedCount} vs written to chunks ${totalFontsWrittenToChunks}.`); }

console.log(`Total size of font data chunks: ${(totalChunkSize / 1024 / 1024).toFixed(3)} MB`);
console.log('Font chunking complete!');

// Exit cleanly (removed force exit 0 unless strictly needed)
process.exit(0);