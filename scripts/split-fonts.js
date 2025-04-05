/**
 * scripts/split-fonts.js (v1.5 - Greedy Regex & Final JSON Check)
 * Splits inline-fonts-data.js into chunks.
 * Automatically cleans the output directory before generation.
 * Attempts to fix JSON parsing issue with greedy regex and tail logging.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CHUNK_DIR = 'font-chunks'; // Output directory relative to project root
const SOURCE_JS = 'inline-fonts-data.js'; // Source file
const CHUNKS = ['a-f', 'g-m', 'n-z', '0-9', 'symbols'];
const PROJECT_ROOT = process.cwd();

console.log('Font Chunking Utility');
console.log('=====================');

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
    console.error(`❌ ERROR: Failed to clean or create chunk output directory ${chunkOutputDir}:`, cleanError);
    process.exit(1); // Cannot proceed if we can't manage the output dir
}
// --- End Cleanup ---


// --- Extract font data array ---
let fontsData = [];
let sourceMetadata = {};
let jsContent = '';

try {
    // --- Step 1: Check if source file exists ---
    if (!fs.existsSync(sourceJsPath)) {
        throw new Error(`Source file not found: ${sourceJsPath}`);
    }
    console.log(`DEBUG: Found source file: ${sourceJsPath}`);

    // --- Step 2: Read file content ---
    try {
        jsContent = fs.readFileSync(sourceJsPath, 'utf8');
        console.log(`DEBUG: Read ${jsContent.length} characters from source file.`);
        if (!jsContent || jsContent.trim().length === 0) {
            throw new Error(`Source file is empty: ${sourceJsPath}`);
        }
    } catch (readError) {
        throw new Error(`Failed to read source file ${sourceJsPath}: ${readError.message}`);
    }

    // --- Step 3: Extract JSON string using Regex (MODIFIED TO BE GREEDY) ---
    console.log(`DEBUG: Attempting to extract JSON object with greedy regex...`);
    // Made the main {[\s\S]*} capture GREEDY, assuming it's the last main block ending in };
    const match = jsContent.match(/(?:window\._INLINE_FONTS_DATA\s*=\s*)(?:.*?)({[\s\S]*});?/m);


    if (!match || !match[1]) {
        console.error(`Could not find 'window._INLINE_FONTS_DATA = { ... };' or similar assignment in ${SOURCE_JS}`);
        console.error(`Check the format of ${SOURCE_JS}. Regex might need adjustment.`);
        console.error(`Source file beginning (first 500 chars):\n${jsContent.substring(0, 500)}...`);
        throw new Error('Could not extract font data structure using regex.');
    }
    console.log(`DEBUG: Greedy regex match successful.`);
    const jsonStr = match[1];

    // --- Step 4: Parse the extracted JSON string ---
    let parsedData;
    try {
        console.log(`DEBUG: Attempting to JSON.parse extracted string...`);
        // *** ADDED CHECK: Log the very end of the string to see if it's truncated ***
        console.log(`DEBUG: Tail of extracted string (last 100 chars): ...${jsonStr.slice(-100)}`);
        // ****************************************************************************
        parsedData = JSON.parse(jsonStr);
        console.log(`DEBUG: JSON.parse successful.`);
    } catch (parseError) {
        console.error(`Failed to parse JSON data extracted from ${SOURCE_JS}: ${parseError.message}`);
        const snippetLength = 500; const errorPos = parseError.message.match(/position (\d+)/);
        let startIndex = 0; if (errorPos && errorPos[1]) { startIndex = Math.max(0, parseInt(errorPos[1], 10) - snippetLength / 2); }
        console.error(`JSON string snippet around error (approx ${snippetLength} chars):\n...${jsonStr.substring(startIndex, startIndex + snippetLength)}...`);
        throw new Error(`JSON parsing failed: ${parseError.message}`); // Re-throw specific parse error
    }

    // --- Step 5: Validate the parsed structure ---
    if (!parsedData || !Array.isArray(parsedData.fonts)) {
        console.error('Parsed data from inline-fonts-data.js did not contain a valid "fonts" array.');
        console.error('Expected structure: { metadata: {...}, fonts: [...] }');
        if (parsedData) {
            console.error(`Actual keys found: ${Object.keys(parsedData).join(', ')}`);
        } else {
            console.error('Parsed data was null or undefined.');
        }
        throw new Error('Invalid data structure in parsed object (missing "fonts" array).');
    }

    // --- Success ---
    fontsData = parsedData.fonts;
    sourceMetadata = parsedData.metadata || {};
    console.log(`Successfully extracted ${fontsData.length} fonts and metadata from ${SOURCE_JS}`);

} catch (err) {
    // Catch errors from any step above
    console.error(`\n❌ ERROR during data extraction in split-fonts.js: ${err.message}`);
    // Log stack trace for better debugging location
    console.error(err.stack);
    process.exit(1); // Exit script with error code
}
// --- End Extract ---


// --- Categorization and Writing ---
if (!Array.isArray(fontsData)) {
     console.error("Critical error: fontsData is not an array. Cannot proceed.");
     process.exit(1);
}
if (fontsData.length === 0) {
    console.warn("Warning: Extracted font data array is empty. Chunk files will be empty.");
} else {
    console.log(`DEBUG: Processing ${fontsData.length} fonts.`);
}

const fontChunks = {};
CHUNKS.forEach(chunk => fontChunks[chunk] = []);

function getChunkForFont(font) {
    if (!font || typeof font.familyName !== 'string' || font.familyName.length === 0) {
        console.warn(`Font invalid familyName, assigning to 'symbols': ${JSON.stringify(font)}`);
        return 'symbols';
    }
    const firstChar = font.familyName.trim().charAt(0).toLowerCase();
    if (firstChar >= 'a' && firstChar <= 'f') return 'a-f';
    if (firstChar >= 'g' && firstChar <= 'm') return 'g-m';
    if (firstChar >= 'n' && firstChar <= 'z') return 'n-z';
    if (firstChar >= '0' && firstChar <= '9') return '0-9';
    return 'symbols';
}

console.log("DEBUG: Categorizing fonts into chunks...");
let categorizedCount = 0;
fontsData.forEach((font, index) => {
    if (!font || !font.familyName) {
        console.warn(`DEBUG: Skipping font index ${index} due to missing familyName.`);
        return;
    }
    const chunk = getChunkForFont(font);
    if (['GiddyupStd', 'ItcFeniceStd', 'LetterGothicStd', 'PompeijanaLtStd', 'TimesNewRomanMtStd', 'WilkeLtStd'].includes(font.familyName)) {
        console.log(`>>>>> DEBUG: Assigning problematic font "${font.familyName}" to chunk: ${chunk}`);
    }
    if (fontChunks[chunk]) {
        fontChunks[chunk].push(font);
        categorizedCount++;
    } else {
         console.error(`DEBUG: Internal error: Calculated chunk "${chunk}" for font "${font.familyName}" does not exist. Assigning to 'symbols'.`);
         fontChunks['symbols'].push(font);
         categorizedCount++;
    }
});
console.log(`DEBUG: Categorized ${categorizedCount} fonts.`);
if (categorizedCount !== fontsData.length) {
    console.warn(`DEBUG: Mismatch: ${categorizedCount} categorized vs ${fontsData.length} total.`);
}


console.log("DEBUG: Creating index.json...");
const fontIndex = fontsData.map(font => {
    if (!font || !font.familyName) return null;
    return {
        familyName: font.familyName,
        displayName: font.displayName || font.familyName,
        formats: font.formats,
        hasDefaultFont: font.hasDefaultFont,
        fontCount: font.fontCount,
    };
}).filter(f => f !== null);

const indexJsonPath = path.join(chunkOutputDir, 'index.json');
try {
    fs.writeFileSync(indexJsonPath, JSON.stringify(fontIndex, null, 2), 'utf-8');
    console.log(`Created ${path.relative(PROJECT_ROOT, indexJsonPath)} with metadata for ${fontIndex.length} fonts`);
     if (fontIndex.length !== fontsData.length) {
        console.warn(`DEBUG: Index file contains ${fontIndex.length} vs source ${fontsData.length}.`);
    }
} catch (writeError) {
     console.error(`Failed to write ${indexJsonPath}:`, writeError);
     process.exit(1);
}


console.log("DEBUG: Writing chunk files...");
let totalChunkSize = 0; let totalFontsWrittenToChunks = 0;
Object.entries(fontChunks).forEach(([chunkName, fontsInChunk]) => {
    const chunkPath = path.join(chunkOutputDir, `${chunkName}.json`);
    totalFontsWrittenToChunks += fontsInChunk.length;
    const problematicFontsInChunk = fontsInChunk.filter(f => ['GiddyupStd', 'ItcFeniceStd', 'LetterGothicStd', 'PompeijanaLtStd', 'TimesNewRomanMtStd', 'WilkeLtStd'].includes(f.familyName));
    if (problematicFontsInChunk.length > 0) {
        console.log(`>>>>> DEBUG: Writing chunk "${chunkName}" which includes: ${problematicFontsInChunk.map(f => f.familyName).join(', ')}`);
    }
    try {
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
console.log(`DEBUG: Wrote ${totalFontsWrittenToChunks} font entries across chunk files.`);
if (totalFontsWrittenToChunks !== fontsData.length) {
     console.warn(`DEBUG: Mismatch! Source ${fontsData.length} vs chunks ${totalFontsWrittenToChunks}.`);
}

console.log(`Total size of font data chunks: ${(totalChunkSize / 1024 / 1024).toFixed(3)} MB`);
console.log('Font chunking complete!');

// --- Force Exit Code 0 --- <<< ADDED HERE
process.exit(0);
// --- End Force Exit ---