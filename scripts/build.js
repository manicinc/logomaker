/**
 * scripts/build.js (v3.5 - Clarify Base64, Ensure font files for deploy)
 * Performs the build steps for Logomaker.
 * Copies the correct HTML template based on the build target.
 * Copies source font files for the 'deploy' target to allow serving via URL.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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
const FONT_DIR_NAME = 'fonts'; // Source font directory name

// --- Helper Function ---
function copyDirRecursive(source, destination) {
    if (!fs.existsSync(source)) { console.warn(`Source directory not found, skipping copy: ${source}`); return; }
    fs.mkdirSync(destination, { recursive: true });
    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
            if (entry.name === '.git' || entry.name === 'node_modules' || srcPath === destination) continue;
            copyDirRecursive(srcPath, destPath);
        } else {
            if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db' || entry.name.startsWith('~')) continue;
            try {
                fs.copyFileSync(srcPath, destPath);
            } catch (copyError) {
                console.error(`Failed to copy ${entry.name} from ${source} to ${destination}:`, copyError);
                throw copyError;
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

    // Define paths for generated files
    const generatedCssSourceFilename = 'generated-font-classes.css';
    const generatedCssSourcePath = path.join(projectRoot, 'css', generatedCssSourceFilename);
    const fontsJsonPath = path.join(projectRoot, 'fonts.json');
    const inlineFontsJsPath = path.join(projectRoot, 'inline-fonts-data.js');

    // Define paths for HTML templates
    const deployTemplatePath = path.join(projectRoot, 'index.template.html');
    const portableTemplatePath = path.join(projectRoot, 'index-portable.template.html');
    const finalHtmlPath = path.join(distDir, 'index.html');

    // 2. Generate Font Assets (if not skipped)
    if (!skipFontRegen) {
        console.log('Running generate-fonts-json.js...');
        // --- CLARIFICATION: --base64 is ONLY used for the 'portable' target ---
        // The 'deploy' target generates metadata with URLs, not embedded data,
        // relying on the server to provide the actual font files.
        const fontArgs = (target === 'portable') ? ['--base64'] : [];
        const fontGenCmd = 'node';
        const fontGenScript = path.join(__dirname, 'generate-fonts-json.js');
        console.log(`Executing: ${fontGenCmd} ${fontGenScript} ${fontArgs.join(' ')}`);
        const fontGenResult = spawnSync(fontGenCmd, [fontGenScript, ...fontArgs], { stdio: 'inherit', encoding: 'utf-8', cwd: projectRoot });
        if (fontGenResult.status !== 0 || fontGenResult.error) { throw new Error(`generate-fonts-json.js failed. Status: ${fontGenResult.status}, Error: ${fontGenResult.error || 'Unknown error'}`); }
        console.log('Font assets generated successfully.');
    } else {
        console.log('Skipping font regeneration.');
        // Add checks for required files if skipping regen
        if (!fs.existsSync(generatedCssSourcePath)) { console.warn(`WARNING: Skipping font regen, but '${generatedCssSourceFilename}' not found!`); }
        if (target === 'deploy' && !fs.existsSync(fontsJsonPath)) { console.warn("WARNING: Skipping font regen, but 'fonts.json' not found! Deploy might fail."); }
        // Ensure inlineFontsJsPath exists if needed by deploy target (for split-fonts) even when skipping regen
        if (target === 'deploy' && !fs.existsSync(inlineFontsJsPath)) { console.warn("WARNING: Skipping font regen, but 'inline-fonts-data.js' not found! Deploy (chunk split) might fail."); }
        if (target === 'portable' && !fs.existsSync(inlineFontsJsPath)) { console.warn("WARNING: Skipping font regen for portable target, but 'inline-fonts-data.js' not found! Build might fail."); }
    }

    // 3. Process & Copy Assets (HTML, CSS, JS, etc.)
    console.log('Processing and copying assets...');

    // Conditional HTML Copy
    let sourceHtmlPath = '';
    if (target === 'portable') {
        sourceHtmlPath = portableTemplatePath;
        if (!fs.existsSync(sourceHtmlPath)) { throw new Error(`Portable HTML template not found at ${sourceHtmlPath}`); }
        console.log(`Copying PORTABLE HTML template (${path.basename(sourceHtmlPath)}) to ${finalHtmlPath}...`);
    } else { // Default to deploy
        sourceHtmlPath = deployTemplatePath;
        if (!fs.existsSync(sourceHtmlPath)) { throw new Error(`Deploy HTML template not found at ${sourceHtmlPath}`); }
        console.log(`Copying DEPLOY HTML template (${path.basename(sourceHtmlPath)}) to ${finalHtmlPath}...`);
    }
    try {
        fs.copyFileSync(sourceHtmlPath, finalHtmlPath);
        console.log('HTML file copied successfully.');
    } catch (htmlCopyError) {
        console.error(`Failed to copy HTML template from ${sourceHtmlPath} to ${finalHtmlPath}:`, htmlCopyError);
        throw htmlCopyError;
    }

    // Copy other root files
    const rootFilesToCopy = ['LICENSE.md', 'README.md'];
    rootFilesToCopy.forEach(file => { /* ... (copy logic as before) ... */ });

    // Copy CSS directory
    const cssSourceDir = path.join(projectRoot, 'css');
    const cssDestDir = path.join(distDir, 'css');
    console.log(`Copying SOURCE CSS directory from ${cssSourceDir} to ${cssDestDir}...`);
    copyDirRecursive(cssSourceDir, cssDestDir);

    // Verify generated CSS file exists in destination
    const generatedCssDestPath = path.join(cssDestDir, generatedCssSourceFilename);
    if (!fs.existsSync(generatedCssDestPath)) { /* ... (warning/error as before) ... */ }

    // Copy JS directory
    const jsSourceDir = path.join(projectRoot, 'js');
    const jsDestDir = path.join(distDir, 'js');
    console.log(`Copying JS from ${jsSourceDir} to ${jsDestDir}...`);
    copyDirRecursive(jsSourceDir, jsDestDir);

    // Copy Assets directory
    const assetsSourceDir = path.join(projectRoot, 'assets');
    const assetsDestDir = path.join(distDir, 'assets');
     if (fs.existsSync(assetsSourceDir)) {
        console.log(`Copying ASSETS from ${assetsSourceDir} to ${assetsDestDir}...`);
        copyDirRecursive(assetsSourceDir, assetsDestDir);
    }

    // 4. Handle Target-Specific Steps (Post-Asset Copy)
    if (target === 'deploy') {
        console.log('Performing deploy-specific steps (chunking and font file copy)...');

        // Deploy target needs inline-fonts-data.js (with URLs) as input for split-fonts
        if (!fs.existsSync(inlineFontsJsPath)) {
           const errorMsg = `'inline-fonts-data.js' not found at project root after font generation. Cannot run split-fonts.js.`;
           console.error(`ERROR: ${errorMsg}`);
           throw new Error(errorMsg);
        }

        // Run split-fonts.js to create chunks (containing URLs)
        console.log('Running split-fonts.js...');
        const splitCmd = 'node';
        const splitScript = path.join(__dirname, 'split-fonts.js');
        console.log(`Executing: ${splitCmd} ${splitScript}`);
        const splitResult = spawnSync(splitCmd, [splitScript], { stdio: 'inherit', cwd: projectRoot });
        if (splitResult.status !== 0 || splitResult.error) {
           throw new Error(`split-fonts.js failed. Status: ${splitResult.status}, Error: ${splitResult.error || 'Unknown error'}`);
        }

        // Copy the generated font chunks
        const chunkSourceDir = path.join(projectRoot, 'font-chunks');
        if (fs.existsSync(chunkSourceDir)) {
            const chunkDestDir = path.join(distDir, 'font-chunks');
            console.log(`Copying font chunks from ${chunkSourceDir} to ${chunkDestDir}...`);
            copyDirRecursive(chunkSourceDir, chunkDestDir);
        } else {
            console.warn("Font chunks directory not found after split script. Skipping copy.");
        }

        // --- >>> ADDED: Copy source font files for deploy target <<< ---
        // The deploy target uses URLs in its @font-face rules (via chunks),
        // so the actual font files need to be served by the web server.
        const fontSourceDir = path.join(projectRoot, FONT_DIR_NAME);
        const fontDestDir = path.join(distDir, FONT_DIR_NAME); // Output to e.g., dist/github-pages/fonts/
         if (fs.existsSync(fontSourceDir)) {
             console.log(`Copying SOURCE fonts directory from ${fontSourceDir} to ${fontDestDir} for deploy target...`);
             copyDirRecursive(fontSourceDir, fontDestDir);
         } else {
              console.warn(`Source font directory ${fontSourceDir} not found, deploy target may not load fonts via URL.`);
         }
        // --- >>> END ADDED FONT COPY <<< ---

        // Copy fonts.json (metadata needed by deploy target)
        const fontsJsonDest = path.join(distDir, 'fonts.json');
        if (fs.existsSync(fontsJsonPath)) {
             console.log(`Copying fonts.json...`);
             fs.copyFileSync(fontsJsonPath, fontsJsonDest);
        } else {
             console.error(`ERROR: fonts.json not found at ${fontsJsonPath}! Deploy build requires this.`);
             throw new Error("fonts.json missing");
        }

    } else if (target === 'portable') {
        console.log('Performing portable-specific steps (embedding)...');

        // Check for inline-fonts-data.js (which MUST have Base64 for portable)
        if (!fs.existsSync(inlineFontsJsPath)) {
            console.error(`ERROR: Required input file 'inline-fonts-data.js' not found at ${inlineFontsJsPath}!`);
            console.error("Ensure 'scripts/generate-fonts-json.js --base64' ran successfully.");
            throw new Error("inline-fonts-data.js missing for portable build.");
        } else {
             console.log(`Found required '${path.basename(inlineFontsJsPath)}'. Proceeding with portable build.`);
        }

        // Copy inline-fonts-data.js to the distribution directory
        const inlineJsDest = path.join(distDir, 'inline-fonts-data.js');
        console.log(`Copying '${path.basename(inlineFontsJsPath)}' for portable build...`);
        fs.copyFileSync(inlineFontsJsPath, inlineJsDest);

        console.log("--- NOTE: 'portapack' step removed. Output is a directory. ---");
    }

    console.log(`\n✅ Build successful for target '${target}'! Output in: ${distDir}`);

} catch (error) {
    console.error('\n❌ Build Failed!');
    console.error(error.message || error); // Log the error message
    process.exit(1); // Exit with error code
}