/**
 * scripts/split-fonts.js
 * A utility to split the monolithic inline-fonts-data.js into smaller chunks
 * for optimized loading on GitHub Pages
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CHUNK_DIR = 'font-chunks'; // Output directory
const SOURCE_JS = 'inline-fonts-data.js'; // Source file
const CHUNKS = ['a-f', 'g-m', 'n-z', '0-9']; // Chunk names

console.log('Font Chunking Utility');
console.log('=====================');

// Ensure output directory exists
if (!fs.existsSync(CHUNK_DIR)) {
    fs.mkdirSync(CHUNK_DIR, { recursive: true });
    console.log(`Created output directory: ${CHUNK_DIR}`);
}

// Extract font data from inline-fonts-data.js
let fontsData = [];
try {
    const jsContent = fs.readFileSync(SOURCE_JS, 'utf8');
    // Extract the array from window._INLINE_FONTS_DATA = [...]
    const match = jsContent.match(/window\._INLINE_FONTS_DATA\s*=\s*(?:window\._INLINE_FONTS_DATA\s*\|\|\s*)?(.*);/s);
    if (match && match[1]) {
        // Parse the JSON array - careful with this approach
        const jsonStr = match[1].trim();
        try {
            fontsData = eval(`(${jsonStr})`); // Using eval for simplicity, consider a safer approach
            console.log(`Successfully extracted ${fontsData.length} fonts from ${SOURCE_JS}`);
        } catch (parseError) {
            console.error(`Failed to parse font data: ${parseError.message}`);
            process.exit(1);
        }
    } else {
        throw new Error('Could not find font data array in the source file');
    }
} catch (err) {
    console.error(`Error reading/parsing ${SOURCE_JS}: ${err.message}`);
    process.exit(1);
}

// Organize fonts into chunks
const fontChunks = {};
CHUNKS.forEach(chunk => fontChunks[chunk] = []);

// Function to determine chunk for a font
function getChunkForFont(font) {
    if (!font || !font.familyName) return 'a-f'; // Default
    
    const firstChar = font.familyName.charAt(0).toLowerCase();
    
    if (/[a-f]/.test(firstChar)) return 'a-f';
    if (/[g-m]/.test(firstChar)) return 'g-m';
    if (/[n-z]/.test(firstChar)) return 'n-z';
    if (/[0-9]/.test(firstChar)) return '0-9';
    
    return 'a-f'; // Default fallback
}

// Categorize fonts into chunks
fontsData.forEach(font => {
    const chunk = getChunkForFont(font);
    fontChunks[chunk].push(font);
});

// Create index JSON (with minimal info, no variants/files)
const fontIndex = fontsData.map(font => ({
    familyName: font.familyName,
    displayName: font.displayName || font.familyName,
    // Metadata that won't change per chunk
    formats: font.formats,
    hasDefaultFont: font.hasDefaultFont,
    fontCount: font.fontCount,
    totalSize: font.totalSize
}));

// Write index file
fs.writeFileSync(
    path.join(CHUNK_DIR, 'index.json'),
    JSON.stringify(fontIndex, null, 2)
);
console.log(`Created index.json with metadata for ${fontIndex.length} fonts`);

// Write chunk files
Object.entries(fontChunks).forEach(([chunkName, fonts]) => {
    const chunkPath = path.join(CHUNK_DIR, `${chunkName}.json`);
    fs.writeFileSync(
        chunkPath,
        JSON.stringify({ fonts }, null, 2)
    );
    console.log(`Created ${chunkName}.json with ${fonts.length} fonts, size: ${(fs.statSync(chunkPath).size / 1024 / 1024).toFixed(2)} MB`);
});

console.log('Font chunking complete! Font chunks are ready for optimized loading.');