/**
 * scripts/build.js (v3.2 - Fixed CSS Path Check & Copy, Removed Portapack)
 * Performs the build steps for Logomaker.
 * Copies generated CSS from css/ to dist/css/.
 * Contains NO development watcher or server code.
 * Removed external dependency 'portapack'.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process'); // Using sync for build steps

console.log('Starting Build Script...');

// --- Configuration & Argument Parsing ---
const projectRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let target = 'deploy'; // Default target
let skipFontRegen = false;

args.forEach(arg => {
    if (arg.startsWith('--target=')) {
        target = arg.split('=')[1] || 'deploy';
        if (target !== 'deploy' && target !== 'portable') {
            console.warn(`Unknown target '${target}', defaulting to 'deploy'.`);
            target = 'deploy';
        }
    } else if (arg === '--skip-font-regen') {
        skipFontRegen = true;
    }
});

console.log(`Build Target: ${target}`);
console.log(`Skip Font Regen: ${skipFontRegen}`);

const distBaseDir = path.join(projectRoot, 'dist');
const GITHUB_PAGES_SUBDIR = 'github-pages';
const PORTABLE_SUBDIR = 'portable';
const targetSubDir = target === 'deploy' ? GITHUB_PAGES_SUBDIR : PORTABLE_SUBDIR;
const distDir = path.join(distBaseDir, targetSubDir);
const FONT_DIR_NAME = 'fonts'; // Define font directory name constant

// --- Helper Function ---
function copyDirRecursive(source, destination) {
    if (!fs.existsSync(source)) { console.warn(`Source directory not found, skipping copy: ${source}`); return; }
    fs.mkdirSync(destination, { recursive: true });
    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
            // Skip directories like .git, node_modules, or the destination itself if nested accidentally
            if (entry.name === '.git' || entry.name === 'node_modules' || srcPath === destination) continue;
            copyDirRecursive(srcPath, destPath);
        } else {
            // Skip temporary or system files
            if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db' || entry.name.startsWith('~')) continue;
            try {
                fs.copyFileSync(srcPath, destPath);
            } catch (copyError) {
                console.error(`Failed to copy ${entry.name} from ${source} to ${destination}:`, copyError);
                throw copyError; // Make copy errors fatal for the build
            }
        }
    }
}

// --- Build Steps ---
try {
    // 1. Clean previous build directory
    console.log(`Cleaning target directory: ${distDir}`);
    if (fs.existsSync(distDir)) { fs.rmSync(distDir, { recursive: true, force: true }); }
    fs.mkdirSync(distDir, { recursive: true });
    console.log('Target directory cleaned and created.');

    // Define paths for generated files (used in checks and copies)
    const generatedCssSourceFilename = 'generated-font-classes.css';
    const generatedCssSourcePath = path.join(projectRoot, 'css', generatedCssSourceFilename);
    const fontsJsonPath = path.join(projectRoot, 'fonts.json');
    const inlineFontsJsPath = path.join(projectRoot, 'inline-fonts-data.js');

    // 2. Generate Font Assets (if not skipped)
    if (!skipFontRegen) {
        console.log('Running generate-fonts-json.js...');
        // Portable target requires base64 data according to docs
        const fontArgs = (target === 'portable') ? ['--base64'] : [];
        const fontGenCmd = 'node';
        const fontGenScript = path.join(__dirname, 'generate-fonts-json.js');
        console.log(`Executing: ${fontGenCmd} ${fontGenScript} ${fontArgs.join(' ')}`);
        const fontGenResult = spawnSync(fontGenCmd, [fontGenScript, ...fontArgs], { stdio: 'inherit', encoding: 'utf-8', cwd: projectRoot });
        if (fontGenResult.status !== 0 || fontGenResult.error) { throw new Error(`generate-fonts-json.js failed. Status: ${fontGenResult.status}, Error: ${fontGenResult.error || 'Unknown error'}`); }
        console.log('Font assets generated successfully.');
    } else {
        console.log('Skipping font regeneration.');
        // Check if essential generated files exist if skipping (warn if missing)
        if (!fs.existsSync(generatedCssSourcePath)) { console.warn(`WARNING: Skipping font regen, but '${generatedCssSourceFilename}' not found at project root's css directory!`); }
        if (!fs.existsSync(fontsJsonPath)) { console.warn("WARNING: Skipping font regen, but 'fonts.json' not found at project root!"); }
        if (target === 'portable' && !fs.existsSync(inlineFontsJsPath)) { console.warn("WARNING: Skipping font regen for portable target, but 'inline-fonts-data.js' not found!"); }
    }

    // 3. Process & Copy Assets (HTML, CSS, JS, etc.)
    console.log('Processing and copying assets...');

    // Copy root files identified from ls and README/docs
    // Adjust this list based on your actual project files
    const rootFilesToCopy = ['index.html', 'LICENSE.md', 'README.md']; // Add 'favicon.ico', 'preview.png', etc. if needed
    rootFilesToCopy.forEach(file => {
        const sourcePath = path.join(projectRoot, file);
        const destPath = path.join(distDir, file);
        if (fs.existsSync(sourcePath)) {
            console.log(`Copying ${file}...`);
            fs.copyFileSync(sourcePath, destPath);
        } else {
            console.warn(`Asset not found, skipping copy: ${file}`);
        }
    });

    // Copy CSS directory (includes source CSS files AND the generated file if present)
    const cssSourceDir = path.join(projectRoot, 'css');
    const cssDestDir = path.join(distDir, 'css');
    console.log(`Copying SOURCE CSS directory from ${cssSourceDir} to ${cssDestDir}...`);
    copyDirRecursive(cssSourceDir, cssDestDir);

    // --- Verification Step for Generated CSS (Post-Copy) ---
    // Verify the generated CSS file *exists in the destination* after the copy
    const generatedCssDestPath = path.join(cssDestDir, generatedCssSourceFilename);
    if (!fs.existsSync(generatedCssDestPath)) {
        // This check should only fail if generation failed AND skipFontRegen was true,
        // OR if copyDirRecursive failed silently (unlikely with the error handling).
         console.warn(`WARNING: Generated CSS file not found at destination ${generatedCssDestPath} after copying css directory.`);
         if (!skipFontRegen) {
             // If we were supposed to generate it, this indicates a deeper problem.
            throw new Error(`Build inconsistency: Font generation ran, but ${generatedCssDestPath} is missing post-copy. Check generate-fonts-json.js and copy logic.`);
         }
    }
    // --- End Verification ---

    // Copy JS directory
    const jsSourceDir = path.join(projectRoot, 'js');
    const jsDestDir = path.join(distDir, 'js');
    console.log(`Copying JS from ${jsSourceDir} to ${jsDestDir}...`);
    copyDirRecursive(jsSourceDir, jsDestDir);

    // 4. Handle Target-Specific Steps based on docs
    if (target === 'deploy') {
        console.log('Performing deploy-specific steps (chunking)...');

        // Ensure inline-fonts-data.js exists before running split-fonts
        if (!skipFontRegen && !fs.existsSync(inlineFontsJsPath)) {
           // This can happen if generate-fonts-json failed silently or didn't run when expected
           throw new Error(`Required file 'inline-fonts-data.js' not found at project root. Cannot run split-fonts.js.`);
        } else if (skipFontRegen && !fs.existsSync(inlineFontsJsPath)) {
            console.warn(`WARNING: Skipping font regen, and 'inline-fonts-data.js' not found at project root. Chunk splitting might fail or use old data.`);
            // Allow build to continue but warn heavily
        }

        // Only run split if the source file exists
        if (fs.existsSync(inlineFontsJsPath)) {
           console.log('Running split-fonts.js...');
           const splitCmd = 'node';
           const splitScript = path.join(__dirname, 'split-fonts.js');
           console.log(`Executing: ${splitCmd} ${splitScript}`);
           const splitResult = spawnSync(splitCmd, [splitScript], { stdio: 'inherit', cwd: projectRoot });
           if (splitResult.status !== 0 || splitResult.error) { throw new Error(`split-fonts.js failed. Status: ${splitResult.status}, Error: ${splitResult.error || 'Unknown error'}`); }
        } else {
           console.warn(`Skipping split-fonts.js because ${inlineFontsJsPath} was not found.`);
        }


        // Copy font chunks (if they exist after splitting)
        const chunkSourceDir = path.join(projectRoot, 'font-chunks');
        if (fs.existsSync(chunkSourceDir)) {
            const chunkDestDir = path.join(distDir, 'font-chunks');
            console.log(`Copying font chunks from ${chunkSourceDir} to ${chunkDestDir}...`);
            copyDirRecursive(chunkSourceDir, chunkDestDir);
        } else {
            console.warn("Font chunks directory not found after split script ran (or was skipped). Skipping copy.");
        }


        // Copy source fonts directory (actual .woff2 etc files are needed for non-base64 builds)
        const fontSourceDir = path.join(projectRoot, FONT_DIR_NAME); // Use constant
        const fontDestDir = path.join(distDir, FONT_DIR_NAME); // Use constant
        console.log(`Copying source fonts from ${fontSourceDir} to ${fontDestDir}...`);
        copyDirRecursive(fontSourceDir, fontDestDir);

        // Copy fonts.json (needed by deploy target according to docs - expected at root)
        const fontsJsonDest = path.join(distDir, 'fonts.json');
        if (fs.existsSync(fontsJsonPath)) {
             console.log(`Copying fonts.json...`);
             fs.copyFileSync(fontsJsonPath, fontsJsonDest);
        } else {
            // This is critical for deploy target to function with fontManager
            console.error(`ERROR: fonts.json not found at ${fontsJsonPath}! Deploy build requires this.`);
            throw new Error("fonts.json missing");
        }

    } else if (target === 'portable') {
        console.log('Performing portable-specific steps (embedding)...');
        // Ensure generate-fonts used --base64 if not skipped
        if (!skipFontRegen && !args.includes('--base64')) {
           // Make this an error for portable build, as base64 is required
           throw new Error("Portable target build requires base64 font data. Run build without --skip-font-regen or ensure generate-fonts-json.js was run with --base64.");
        }

        // Copy inline-fonts-data.js (should contain base64 data)
        const inlineJsDest = path.join(distDir, 'inline-fonts-data.js');
        if (fs.existsSync(inlineFontsJsPath)) {
            console.log("Copying inline-fonts-data.js for portable build...");
            fs.copyFileSync(inlineFontsJsPath, inlineJsDest);
        } else {
            // This is critical for portable build to function
            console.error(`ERROR: inline-fonts-data.js not found at ${inlineFontsJsPath}! Portable build requires this.`);
            throw new Error("inline-fonts-data.js missing");
        }

        // --- REMOVED PORTAPACK ---
        console.log("--- NOTE: 'portapack' step removed due to no-external-dependency requirement. ---");
        console.log("--- Portable build output is now a directory containing all assets. ---");
        console.log("--- You can zip the 'dist/portable' directory for distribution. ---");
        // --- END REMOVAL ---
    }

    console.log(`\n✅ Build successful for target '${target}'! Output in: ${distDir}`);

} catch (error) {
    console.error('\n❌ Build Failed!');
    console.error(error.message || error); // Log the error message
    process.exit(1); // Exit with error code
}