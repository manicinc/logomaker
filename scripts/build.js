/**
 * scripts/build.js (v2.4 - Conditional Font Clean)
 *
 * Builds Logomaker targets or serves locally.
 * Always cleans previous font artifacts before build/serve UNLESS --skip-font-clean is passed.
 * This version is required by dev.js v1.2+
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// --- Configuration ---
const OUTPUT_DIR = 'dist';
const GITHUB_PAGES_SUBDIR = 'github-pages';
const PORTABLE_SUBDIR = 'portable';
const FONT_CHUNKS_DIR = 'font-chunks';
const INLINE_DATA_FILE = 'inline-fonts-data.js';
const FONTS_JSON_FILE = 'fonts.json';
const PORTABLE_BUNDLE_HTML = 'logomaker-portable.html';
const GENERATED_CSS_FILE = 'generated-font-classes.css'; // Added for cleanup

// Paths
const PROJECT_ROOT = process.cwd();
const OUTPUT_BASE_PATH = path.resolve(PROJECT_ROOT, OUTPUT_DIR);
const DEPLOY_TARGET_PATH = path.resolve(OUTPUT_BASE_PATH, GITHUB_PAGES_SUBDIR);
const PORTABLE_TARGET_PATH = path.resolve(OUTPUT_BASE_PATH, PORTABLE_SUBDIR);
const FONT_CHUNKS_PATH = path.resolve(PROJECT_ROOT, FONT_CHUNKS_DIR);
const INLINE_DATA_PATH = path.resolve(PROJECT_ROOT, INLINE_DATA_FILE);
const FONTS_JSON_PATH = path.resolve(PROJECT_ROOT, FONTS_JSON_FILE);
const GENERATED_CSS_PATH = path.resolve(PROJECT_ROOT, 'css', GENERATED_CSS_FILE); // Added path

const FILES_TO_EXCLUDE_FROM_COPY = [
    'node_modules', '.git', '.github', 'dist', 'scripts',
    FONT_CHUNKS_DIR, INLINE_DATA_FILE, FONTS_JSON_FILE, PORTABLE_BUNDLE_HTML, GENERATED_CSS_PATH, // Exclude generated CSS from root copy
    '.gitignore', 'package.json', 'package-lock.json', '.DS_Store',
    'Thumbs.db', 'desktop.ini', 'README.md',
];

// --- Argument Parsing ---
const args = process.argv.slice(2);
const serveMode = args.includes('--serve');
const targetArg = args.find(arg => arg.startsWith('--target='));
const buildTarget = targetArg ? targetArg.split('=')[1] : null;
const servePortable = serveMode && args.includes('--portable');
const skipFontClean = args.includes('--skip-font-clean'); // <<< Check for the new flag

const buildDeploy = !targetArg || targetArg === '--target=deploy';
const buildPortable = !targetArg || targetArg === '--target=portable';

// --- Helper Functions ---
function logInfo(message) { console.log(`[INFO] ${message}`); }
function logWarn(message) { console.warn(`[WARN] ${message}`); }
function logError(message, error) { console.error(`[ERROR] ${message}`, error || ''); process.exitCode = 1; }
function logSuccess(message) { console.log(`✅ ${message}`); }
function logStep(message) { console.log(`\n⚙️  ${message}...`); }

// Recursive Copy (remains the same)
function copyRecursiveSync(src, dest, exclude = []) {
    // ... (keep existing copyRecursiveSync code) ...
    const exists = fs.existsSync(src);
    if (!exists) {
        logWarn(`Source path "${src}" does not exist. Skipping copy.`);
        return;
    }
    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();
    const relativeSrc = path.relative(PROJECT_ROOT, src) || '.';

    if (exclude.some(pattern => {
        // Handle file paths and directory paths correctly
        const relativePath = relativeSrc.replace(/\\/g, '/'); // Normalize slashes for comparison
        const patternPath = pattern.replace(/\\/g, '/');
        return relativePath === patternPath || (isDirectory && relativePath.startsWith(patternPath + '/'));
    })) {
        return; // Skip excluded
    }


    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(child => copyRecursiveSync(path.join(src, child), path.join(dest, child), exclude));
    } else {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        try { fs.copyFileSync(src, dest); }
        catch (copyError) { logError(`Failed to copy file from "${src}" to "${dest}".`, copyError); }
    }
}

// Run Command (remains the same)
function runCommand(command, description) {
    logInfo(`> Executing: ${command} (${description})`);
    try {
        execSync(command, { stdio: 'inherit', cwd: PROJECT_ROOT });
        return true;
    } catch (error) {
        logError(`${description} failed.`);
        return false;
    }
}

// Ensure Generated File (remains the same)
function ensureGeneratedFile(filePath, generationCommand, description) {
    const fileName = path.basename(filePath);
    if (!fs.existsSync(filePath)) {
        logWarn(`Required ${fileName} not found. Generating...`);
        if (!runCommand(generationCommand, description)) {
            logError(`Failed to generate ${fileName}. Aborting subsequent steps.`);
            return false;
        }
        if (!fs.existsSync(filePath)) {
             logError(`Generation command ran but ${fileName} still not found. Aborting.`);
             return false;
        }
         logInfo(` > ${fileName} generated successfully.`);
    } else {
         logInfo(` > Found existing ${fileName}.`);
    }
    return true;
}

// Clean Root Font Artifacts (NOW CHECKS THE FLAG)
function cleanRootFontArtifacts() {
    // <<< --- CHECK THE FLAG --- >>>
    if (skipFontClean) {
        logInfo("Skipping font artifact cleanup (--skip-font-clean specified).");
        return; // Exit the function if flag is present
    }
    // <<< --- END CHECK --- >>>

    logStep("Cleaning previous font artifacts (inline data, chunks, json, generated css)");
    let cleaned = false;
    try {
        if (fs.existsSync(FONT_CHUNKS_PATH)) {
            fs.rmSync(FONT_CHUNKS_PATH, { recursive: true, force: true });
            cleaned = true;
        }
        if (fs.existsSync(INLINE_DATA_PATH)) {
            fs.unlinkSync(INLINE_DATA_PATH);
            cleaned = true;
        }
        if (fs.existsSync(FONTS_JSON_PATH)) {
            fs.unlinkSync(FONTS_JSON_PATH);
            cleaned = true;
        }
        // Also clean generated CSS
        if (fs.existsSync(GENERATED_CSS_PATH)) { // Use defined path
            fs.unlinkSync(GENERATED_CSS_PATH);
            cleaned = true;
        }
        if (cleaned) {
            logSuccess("Cleaned temporary root font artifacts.");
        } else {
            logInfo("No previous font artifacts found to clean.");
        }
    } catch(cleanErr){
        logWarn("Could not clean all root font artifacts.", cleanErr);
    }
}

// --- Build Target Functions ---
// (Build target functions remain the same - they rely on ensureGeneratedFile
// which will now only run generation if cleanRootFontArtifacts actually deleted stuff)
function buildDeployTarget() {
    logStep(`Building Deploy Target (Optimized) ${skipFontClean ? '(Skipping Font Regen)' : '(Regenerating Fonts)'}`);
    // ... (keep existing buildDeployTarget logic) ...
    if (!ensureGeneratedFile(INLINE_DATA_PATH, 'node scripts/generate-fonts-json.js --base64', 'Generate Base64 Font Data')) return false;
    if (!ensureGeneratedFile(FONT_CHUNKS_PATH, 'node scripts/split-fonts.js', 'Split Fonts into Chunks')) return false;
    if (!ensureGeneratedFile(GENERATED_CSS_PATH, 'echo "CSS gen happens in generate-fonts-json" && exit 0', 'Check/Generate Font CSS')) {
         logWarn("Generate script should create generated-font-classes.css");
         // Allow continuing even if CSS isn't strictly checked here, generate-fonts-json handles it
    }


    logInfo(`Copying application files to "${GITHUB_PAGES_SUBDIR}"...`);
    // Ensure generated CSS is NOT excluded during copy TO dist
    const deployExcludes = FILES_TO_EXCLUDE_FROM_COPY.filter(f => f !== GENERATED_CSS_PATH);
    copyRecursiveSync(PROJECT_ROOT, DEPLOY_TARGET_PATH, deployExcludes);

    logInfo(`Copying font chunks to "${GITHUB_PAGES_SUBDIR}"...`);
    copyRecursiveSync(FONT_CHUNKS_PATH, path.join(DEPLOY_TARGET_PATH, FONT_CHUNKS_DIR), []);


    logInfo(`Modifying index.html in "${GITHUB_PAGES_SUBDIR}" for chunked loading...`);
    const indexHtmlPath = path.join(DEPLOY_TARGET_PATH, 'index.html');
    try {
        if (!fs.existsSync(indexHtmlPath)) throw new Error("index.html not found");
        let indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
        const inlineScriptRegex = /<script\s+src=["']\.\/(inline-fonts-data\.js)["'](?:\s+defer)?\s*><\/script>/i;
        if (inlineScriptRegex.test(indexHtmlContent)) {
             indexHtmlContent = indexHtmlContent.replace(inlineScriptRegex, ``);
             fs.writeFileSync(indexHtmlPath, indexHtmlContent, 'utf8');
             logSuccess(`Removed inline data script from ${GITHUB_PAGES_SUBDIR}/index.html.`);
        } else {
            logWarn(`Inline data script already removed or not found in ${GITHUB_PAGES_SUBDIR}/index.html.`);
        }
        // Ensure generated CSS is linked (it should be copied with core files)
        const cssLinkRegex = /<link\s+rel=["']stylesheet["']\s+href=["']\.\/css\/(generated-font-classes\.css)["']\s*>/i;
         if (!cssLinkRegex.test(indexHtmlContent)) {
             logWarn(`Link for ${GENERATED_CSS_FILE} not found in ${GITHUB_PAGES_SUBDIR}/index.html. Make sure it's in the source index.html.`);
         }

    } catch (error) {
        logError(`Failed to modify index.html in "${GITHUB_PAGES_SUBDIR}".`, error);
        return false;
    }

    logSuccess("Deploy Target build complete.");
    return true;
}

function buildPortableTarget() {
    logStep(`Building Portable Target (Offline/Embedded) ${skipFontClean ? '(Skipping Font Regen)' : '(Regenerating Fonts)'}`);
    // ... (keep existing buildPortableTarget logic) ...
    if (!ensureGeneratedFile(INLINE_DATA_PATH, 'node scripts/generate-fonts-json.js --base64', 'Generate Base64 Font Data')) return false;
     if (!ensureGeneratedFile(GENERATED_CSS_PATH, 'echo "CSS gen happens in generate-fonts-json" && exit 0', 'Check/Generate Font CSS')) {
         logWarn("Generate script should create generated-font-classes.css");
     }

    logInfo(`Copying application files to "${PORTABLE_SUBDIR}"...`);
     // Ensure generated CSS and inline data are NOT excluded during copy TO dist/portable
    const portableExcludes = FILES_TO_EXCLUDE_FROM_COPY.filter(f => f !== INLINE_DATA_FILE && f !== GENERATED_CSS_PATH);
    copyRecursiveSync(PROJECT_ROOT, PORTABLE_TARGET_PATH, portableExcludes);

    logInfo("Attempting PortaPack bundling (optional)...");
    // ...(PortaPack logic remains the same)...
    try {
        execSync('npx portapack --version', { stdio: 'pipe' });
        const inputHtml = path.resolve(PORTABLE_TARGET_PATH, 'index.html');
        const outputHtml = path.resolve(PORTABLE_TARGET_PATH, PORTABLE_BUNDLE_HTML);
        if (!fs.existsSync(inputHtml)) { logError(`PortaPack input not found: ${inputHtml}`); }
        else {
            const portapackCmd = `npx portapack -i "${inputHtml}" -o "${outputHtml}" --no-embed-preview --minify`;
            if(runCommand(portapackCmd, `Bundle with PortaPack`)){ logSuccess(`Created single portable file: ${PORTABLE_BUNDLE_HTML}`); }
            else { logWarn(`PortaPack bundling failed. Using multi-file output in "${PORTABLE_SUBDIR}".`); }
        }
    } catch (error) {
        logInfo(`PortaPack not found or failed. Skipping single-file bundle.`);
    }


    logSuccess("Portable Target build complete.");
    return true;
}

// --- Serve Function --- (remains the same)
function serveTarget(targetPath, mode) {
    // ... (keep existing serveTarget code) ...
    logStep(`Serving ${mode} version locally (NO CACHING)`);
    logInfo(`Target directory: ${targetPath}`);
    if (!fs.existsSync(targetPath)) {
        logError(`Serve failed: Directory not found: ${targetPath}`);
        logInfo(`(Build target first: node scripts/build.js --target=${mode === 'Optimized (Chunked)' ? 'deploy' : 'portable'})`);
        return;
    }
    const port = 3000;
    logInfo(`Attempting to start server on http://localhost:${port}`);
    logInfo("Caching disabled via '-c-1'. Use Ctrl+C to stop.");
    try {
        const serverProcess = spawn('npx', ['http-server', targetPath, '-p', port, '-o', '--cors', '-c-1'], {
            stdio: 'inherit', shell: true
        });
        serverProcess.on('error', (err) => { logError(`Failed to start http-server. Is Node.js/npx available?`, err); });
        serverProcess.on('close', (code) => { logInfo(`Server stopped (code: ${code}).`); });
    } catch (error) { logError('Failed to spawn http-server process.', error); }
}


// --- Main Execution Logic ---
console.log('=========================================================');
console.log('🚀 Logomaker Build Script (v2.4 - Conditional Font Clean)'); // Updated version
console.log('=========================================================');

// === Serve Mode ===
if (serveMode) {
    logInfo(`Mode: Serve ${skipFontClean ? '(--skip-font-clean specified)' : ''}`);
    // <<< Cleanup is now conditional based on --skip-font-clean flag >>>
    cleanRootFontArtifacts(); // Function now checks the flag internally

    if (servePortable) {
        logInfo("Target: Portable Mode");
        if (buildPortableTarget()) { // Will regenerate fonts ONLY if clean ran
            serveTarget(PORTABLE_TARGET_PATH, 'Portable (Embedded)');
        } else { logError("Build failed during serve prep."); }
    } else {
        logInfo("Target: Optimized Mode");
        if (buildDeployTarget()) { // Will regenerate fonts ONLY if clean ran
            serveTarget(DEPLOY_TARGET_PATH, 'Optimized (Chunked)');
        } else { logError("Build failed during serve prep."); }
    }
}
// === Build Mode ===
else {
    logInfo(`Mode: Build ${skipFontClean ? '(--skip-font-clean specified)' : ''}`);
    logInfo(`Build target(s): ${buildTarget || 'BOTH'}`);

    logStep("Cleaning previous output directory");
    if (fs.existsSync(OUTPUT_BASE_PATH)) fs.rmSync(OUTPUT_BASE_PATH, { recursive: true, force: true });
    fs.mkdirSync(OUTPUT_BASE_PATH, { recursive: true });
    logSuccess("Cleaned output directory.");

    // <<< Cleanup is now conditional based on --skip-font-clean flag >>>
    cleanRootFontArtifacts(); // Function now checks the flag internally

    // Build targets
    if (buildDeploy) {
        if (!buildDeployTarget()) { /* Error logged */ }
    }
    if (buildPortable) {
        if (!buildPortableTarget()) { /* Error logged */ }
    }

    // Final summary (remains the same)
    console.log('\n=========================================================');
    if (process.exitCode === 1) { logError('❌ Build finished with errors.'); }
    else {
        logSuccess('✅ Build Finished!');
        if (buildDeploy) console.log(`   Optimized build output: ${DEPLOY_TARGET_PATH}`);
        if (buildPortable) {
            console.log(`   Portable build output:  ${PORTABLE_TARGET_PATH}`);
            if (fs.existsSync(path.join(PORTABLE_TARGET_PATH, PORTABLE_BUNDLE_HTML))) {
                console.log(`   Single-file bundle:   ${path.join(PORTABLE_TARGET_PATH, PORTABLE_BUNDLE_HTML)}`);
            }
        }
    }
    console.log('=========================================================');
}