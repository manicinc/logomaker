/**
 * scripts/split-fonts.js (v1.1 - Fixed Parsing Logic)
 * A utility to split the monolithic inline-fonts-data.js into smaller chunks
 * for optimized loading on GitHub Pages.
 * Correctly parses the object structure {metadata:..., fonts:[...]}
 * and uses JSON.parse instead of eval.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CHUNK_DIR = 'font-chunks'; // Output directory
const SOURCE_JS = 'inline-fonts-data.js'; // Source file (contains window._INLINE_FONTS_DATA = {metadata:..., fonts:[...]})
const CHUNKS = ['a-f', 'g-m', 'n-z', '0-9']; // Chunk names
const PROJECT_ROOT = process.cwd(); // Use cwd for reliable root path

console.log('Font Chunking Utility');
console.log('=====================');

const chunkOutputDir = path.resolve(PROJECT_ROOT, CHUNK_DIR);
const sourceJsPath = path.resolve(PROJECT_ROOT, SOURCE_JS);

// Ensure output directory exists
if (!fs.existsSync(chunkOutputDir)) {
    fs.mkdirSync(chunkOutputDir, { recursive: true });
    console.log(`Created output directory: ${chunkOutputDir}`);
}

// Extract font data array from inline-fonts-data.js
let fontsData = []; // This should end up being the array
try {
    if (!fs.existsSync(sourceJsPath)) {
        throw new Error(`Source file not found: ${sourceJsPath}`);
    }
    const jsContent = fs.readFileSync(sourceJsPath, 'utf8');

    // Extract the JSON Object part after the assignment using a non-greedy match
    // Assumes the structure is window._INLINE_FONTS_DATA = { ... };
    const match = jsContent.match(/window\._INLINE_FONTS_DATA\s*=\s*(?:window\._INLINE_FONTS_DATA\s*\|\|\s*)?({[\s\S]*});/);

    if (match && match[1]) {
        const jsonStr = match[1]; // The captured JSON object string
        try {
            // Use safer JSON.parse instead of eval
            const parsedData = JSON.parse(jsonStr);

            // Check if the parsed data has the expected '.fonts' array property
            if (parsedData && Array.isArray(parsedData.fonts)) {
                fontsData = parsedData.fonts; // Assign the inner array
                console.log(`Successfully extracted ${fontsData.length} fonts from ${SOURCE_JS}`);
            } else {
                console.error('Parsed data from inline-fonts-data.js did not contain a valid "fonts" array.');
                console.error('Expected structure: { metadata: {...}, fonts: [...] }');
                // Log structure found if possible (careful with large objects)
                if (parsedData) {
                    console.error(`Actual keys found: ${Object.keys(parsedData).join(', ')}`);
                }
                throw new Error('Invalid data structure in inline-fonts-data.js');
            }
        } catch (parseError) {
            console.error(`Failed to parse JSON data extracted from ${SOURCE_JS}: ${parseError.message}`);
            // Log a snippet of the string that failed to parse for debugging
            console.error(`JSON string snippet (approx first 300 chars): ${jsonStr.substring(0, 300)}...`);
            process.exit(1);
        }
    } else {
        // Let the user know if the regex didn't find the expected assignment
        console.error(`Could not find 'window._INLINE_FONTS_DATA = { ... };' assignment in ${SOURCE_JS}`);
        console.error(`Check the format of ${SOURCE_JS}. Regex might need adjustment.`);
        throw new Error('Could not extract font data structure from source file.');
    }
} catch (err) {
    // Catch errors from file reading or the initial checks
    console.error(`Error reading or processing ${SOURCE_JS}: ${err.message}`);
    process.exit(1);
}

// Check if fontsData is actually an array now before proceeding
if (!Array.isArray(fontsData)) {
     console.error("Critical error: fontsData is not an array after extraction. Cannot proceed.");
     process.exit(1);
}

// --- Rest of the script remains largely the same ---

// Organize fonts into chunks
const fontChunks = {};
CHUNKS.forEach(chunk => fontChunks[chunk] = []);

// Function to determine chunk for a font
function getChunkForFont(font) {
    // Use displayName for chunking? Or familyName? Assuming familyName for consistency.
    // Ensure font and font.familyName exist before trying to access properties.
    if (!font || typeof font.familyName !== 'string' || font.familyName.length === 0) {
        console.warn(`Font missing familyName, assigning to default chunk: ${JSON.stringify(font)}`);
        return 'a-f'; // Default for unexpected data
    }

    const firstChar = font.familyName.charAt(0).toLowerCase();

    if (/[a-f]/.test(firstChar)) return 'a-f';
    if (/[g-m]/.test(firstChar)) return 'g-m';
    if (/[n-z]/.test(firstChar)) return 'n-z';
    if (/[0-9]/.test(firstChar)) return '0-9'; // For font names starting with numbers

    // Fallback if first char is symbol or something else unexpected
    console.warn(`Font family "${font.familyName}" starts with unexpected char, assigning to default chunk.`);
    return 'a-f';
}

// Categorize fonts into chunks
fontsData.forEach(font => { // This should work now
    const chunk = getChunkForFont(font);
    // Make sure the target chunk exists (should always unless CHUNKS array is wrong)
    if (fontChunks[chunk]) {
        fontChunks[chunk].push(font);
    } else {
         console.error(`Internal error: Calculated chunk "${chunk}" does not exist in fontChunks map.`);
    }
});

// Create index JSON (with minimal info, no variants/files)
// Ensure fontsData is the array here
const fontIndex = fontsData.map(font => ({
    familyName: font.familyName,
    displayName: font.displayName || font.familyName, // Use displayName if available
    // Include metadata relevant for the UI list, keep it small
    formats: font.formats,
    hasDefaultFont: font.hasDefault, // Make sure property name matches generate-fonts-json ('hasDefault' was used there)
    fontCount: font.count,      // Make sure property name matches generate-fonts-json ('count' was used there)
    // totalSize: font.size // Probably not needed for index, keep it smaller
}));

// Write index file
const indexJsonPath = path.join(chunkOutputDir, 'index.json');
try {
    fs.writeFileSync(
        indexJsonPath,
        JSON.stringify(fontIndex, null, 2), // Pretty print for readability
        'utf-8'
    );
    console.log(`Created ${indexJsonPath} with metadata for ${fontIndex.length} fonts`);
} catch (writeError) {
     console.error(`Failed to write ${indexJsonPath}:`, writeError);
     process.exit(1);
}


// Write chunk files
let totalChunkSize = 0;
Object.entries(fontChunks).forEach(([chunkName, fontsInChunk]) => {
    const chunkPath = path.join(chunkOutputDir, `${chunkName}.json`);
    try {
        // Structure for chunk file: { fonts: [...] }
        fs.writeFileSync(
            chunkPath,
            JSON.stringify({ fonts: fontsInChunk }, null, 2), // Pretty print chunks too
            'utf-8'
        );
        const stats = fs.statSync(chunkPath);
        totalChunkSize += stats.size;
        console.log(`Created ${chunkName}.json with ${fontsInChunk.length} fonts, size: ${(stats.size / 1024 / 1024).toFixed(3)} MB`);
    } catch (writeError) {
        console.error(`Failed to write ${chunkPath}:`, writeError);
        // Continue trying to write other chunks? Or exit? Let's continue for now.
    }
});

console.log(`Total size of font data chunks: ${(totalChunkSize / 1024 / 1024).toFixed(3)} MB`);
console.log('Font chunking complete! Font chunks are ready for optimized loading.');