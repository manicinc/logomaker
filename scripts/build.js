/**
 * scripts/build.js (v3.1 - Fixed CSS Copying)
 * Performs the build steps for Logomaker.
 * Copies generated CSS from root to dist.
 * Contains NO development watcher or server code.
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

// --- Helper Function ---
function copyDirRecursive(source, destination) {
    if (!fs.existsSync(source)) { console.warn(`Source directory not found, skipping copy: ${source}`); return; }
    fs.mkdirSync(destination, { recursive: true });
    const entries = fs.readdirSync(source, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '.git' || entry.name === 'node_modules') continue; // Skip unwanted dirs
            copyDirRecursive(srcPath, destPath);
        } else {
            if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue; // Skip system files
            try { fs.copyFileSync(srcPath, destPath); }
            catch (copyError) { console.error(`Failed to copy ${srcPath} to ${destPath}:`, copyError); throw copyError; } // Make copy errors fatal
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
        // Check if essential generated files exist if skipping
        // Check for generated CSS at ROOT now
        if (!fs.existsSync(path.join(projectRoot, 'generated-font-classes.css'))) { console.warn("WARNING: Skipping font regen, but 'generated-font-classes.css' not found at project root!"); }
        // Check for fonts.json at ROOT now
        if (!fs.existsSync(path.join(projectRoot, 'fonts.json'))) { console.warn("WARNING: Skipping font regen, but 'fonts.json' not found at project root!"); }
        if (target === 'portable' && !fs.existsSync(path.join(projectRoot, 'inline-fonts-data.js'))) { console.warn("WARNING: Skipping font regen for portable target, but 'inline-fonts-data.js' not found!"); }
    }

    // 3. Process & Copy Assets (HTML, CSS, JS, etc.)
    console.log('Processing and copying assets...');

    // Copy root files identified from ls and README/docs
    const rootFilesToCopy = ['index.html', 'LICENSE.md', 'README.md', 'preview.png', 'architecture.md', 'fontmanager.md']; // Add favicon.ico if needed
    rootFilesToCopy.forEach(file => {
        const sourcePath = path.join(projectRoot, file);
        const destPath = path.join(distDir, file);
        if (fs.existsSync(sourcePath)) { console.log(`Copying ${file}...`); fs.copyFileSync(sourcePath, destPath); }
        else { console.warn(`Asset not found, skipping copy: ${file}`); }
    });

    // Copy CSS directory (includes source CSS files)
    const cssSourceDir = path.join(projectRoot, 'css');
    const cssDestDir = path.join(distDir, 'css');
    console.log(`Copying SOURCE CSS from ${cssSourceDir} to ${cssDestDir}...`);
    copyDirRecursive(cssSourceDir, cssDestDir);

    // <<< --- FIX APPLIED HERE --- >>>
    // Copy the generated CSS file from the project root to the dist CSS directory
    const generatedCssSourcePath = path.join(projectRoot, 'generated-font-classes.css');
    const generatedCssDestPath = path.join(distDir, 'css', 'generated-font-classes.css');
    if (fs.existsSync(generatedCssSourcePath)) {
        console.log(`Copying generated CSS from ${generatedCssSourcePath} to ${generatedCssDestPath}...`);
        try {
            // Ensure the destination directory exists (it should after copyDirRecursive)
            fs.mkdirSync(path.dirname(generatedCssDestPath), { recursive: true });
            fs.copyFileSync(generatedCssSourcePath, generatedCssDestPath);
        } catch (copyError) {
            console.error(`Failed to copy generated-font-classes.css:`, copyError);
            throw copyError; // Make this error fatal for the build
        }
    } else {
        console.warn(`WARNING: Generated CSS file not found at ${generatedCssSourcePath}. Build might be incomplete if font regen was expected.`);
        // If font regeneration was supposed to run but the file is missing, it's a critical error
        if (!skipFontRegen) {
             throw new Error(`generate-fonts-json.js was supposed to run, but ${generatedCssSourcePath} is missing! Check generate-fonts-json.js script.`);
        }
    }
    // <<< --- END FIX --- >>>

    // Copy JS directory
    const jsSourceDir = path.join(projectRoot, 'js');
    const jsDestDir = path.join(distDir, 'js');
    console.log(`Copying JS from ${jsSourceDir} to ${jsDestDir}...`);
    copyDirRecursive(jsSourceDir, jsDestDir);

    // 4. Handle Target-Specific Steps based on docs
    if (target === 'deploy') {
        console.log('Performing deploy-specific steps (chunking)...');

        // Run split-fonts.js
        console.log('Running split-fonts.js...');
        const splitCmd = 'node';
        const splitScript = path.join(__dirname, 'split-fonts.js');
        console.log(`Executing: ${splitCmd} ${splitScript}`);
        const splitResult = spawnSync(splitCmd, [splitScript], { stdio: 'inherit', cwd: projectRoot });
        if (splitResult.status !== 0 || splitResult.error) { throw new Error(`split-fonts.js failed. Status: ${splitResult.status}, Error: ${splitResult.error || 'Unknown error'}`); }

        // Copy font chunks
        const chunkSourceDir = path.join(projectRoot, 'font-chunks');
        const chunkDestDir = path.join(distDir, 'font-chunks');
        console.log(`Copying font chunks from ${chunkSourceDir} to ${chunkDestDir}...`);
        copyDirRecursive(chunkSourceDir, chunkDestDir);

        // Copy fonts directory (actual .woff2 etc files are needed for non-base64 builds)
        const fontSourceDir = path.join(projectRoot, 'fonts');
        const fontDestDir = path.join(distDir, 'fonts');
        console.log(`Copying source fonts from ${fontSourceDir} to ${fontDestDir}...`);
        copyDirRecursive(fontSourceDir, fontDestDir);

        // Copy fonts.json (needed by deploy target according to docs - now expected at root)
        const fontsJsonSource = path.join(projectRoot, 'fonts.json'); // Expect at root
        const fontsJsonDest = path.join(distDir, 'fonts.json');
        if (fs.existsSync(fontsJsonSource)) { console.log(`Copying fonts.json...`); fs.copyFileSync(fontsJsonSource, fontsJsonDest); }
        else { console.error(`ERROR: fonts.json not found at ${fontsJsonSource}! Deploy build requires this.`); throw new Error("fonts.json missing"); }

    } else if (target === 'portable') {
        console.log('Performing portable-specific steps (embedding)...');
        // Ensure generate-fonts used --base64 if not skipped
        if (!skipFontRegen && !args.includes('--base64')) { console.warn("Portable target build usually requires base64 font data (run generate-fonts with --base64).");}

        // Copy inline-fonts-data.js (should contain base64 data)
        const inlineJsSource = path.join(projectRoot, 'inline-fonts-data.js');
        const inlineJsDest = path.join(distDir, 'inline-fonts-data.js');
        if (fs.existsSync(inlineJsSource)) { console.log("Copying inline-fonts-data.js for portable build..."); fs.copyFileSync(inlineJsSource, inlineJsDest); }
        else { console.error(`ERROR: inline-fonts-data.js not found at ${inlineJsSource}! Portable build requires this.`); throw new Error("inline-fonts-data.js missing"); }

        // Attempt to run portapack (as described in README)
        console.log("Attempting to create single file with npx portapack (if installed)...");
        const portapackArgs = ['portapack', '--root', distDir, '--entry', 'index.html', '--output', path.join(distDir, 'logomaker-portable.html'), '--inline-js', '--inline-css'];
        console.log(`Running: npx ${portapackArgs.join(' ')}`);
        const portapackResult = spawnSync('npx', portapackArgs, { stdio: 'inherit', shell: true, cwd: projectRoot }); // shell: true often needed for npx
        if (portapackResult.status !== 0) { console.warn("--- WARNING: 'npx portapack' failed or not found. Single-file build may not be created. Ensure 'portapack' dev dependency is installed ('npm install -D portapack') ---"); }
        else { console.log("Portapack completed successfully."); /* Optional: Clean up separate assets */ }
    }

    console.log(`\n✅ Build successful for target '${target}'! Output in: ${distDir}`);

} catch (error) {
    console.error('\n❌ Build Failed!');
    console.error(error);
    process.exit(1); // Exit with error code
}