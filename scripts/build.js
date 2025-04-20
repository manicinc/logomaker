/**
 * build.js v3.11 - Hybrid Chunk/Inline Builds. FIXED FOR PORTABLE TARGET.
 * Generates chunks with URLs+DataUrls for deploy, copies chunks+fonts for portable.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// --- Configuration ---
const projectRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let target = args.find(a => a.startsWith('--target='))?.split('=')[1] || 'deploy';
let skipFontRegen = args.includes('--skip-font-regen');
if (!['deploy', 'portable'].includes(target)) {
    console.warn(`[Build] Invalid target '${target}', defaulting to 'deploy'.`);
    target = 'deploy';
}
const distDir = path.join(projectRoot, 'dist', target === 'deploy' ? 'github-pages' : 'portable');
const FONT_DIR_NAME = 'fonts'; // Source dir at root for actual font files
const FONT_CHUNKS_DIR = 'font-chunks'; // Source/Output dir at root for chunks

// --- Logging Helpers ---
const logBuild = (msg) => console.log(`[Build:${target}] ${msg}`);
const logBuildWarn = (msg) => console.warn(`[Build:${target}] [WARN] ${msg}`);
const logBuildError = (msg, err) => console.error(`[Build:${target}] [ERROR] ${msg}`, err || '');
const logBuildSuccess = (msg) => console.log(`[Build:${target}] ✅ ${msg}`);
const logBuildInfo = (msg) => console.log(`[Build:${target} INFO] ${msg}`);

// --- Helper Function: copyDirRecursive ---
function copyDirRecursive(src, dest) {
    // ... (keep existing copyDirRecursive function - no changes needed here) ...
    if (!fs.existsSync(src)) { logBuildWarn(`Source directory not found, skipping copy: ${src}`); return; }
    try {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const srcPath = path.join(src, entry.name); const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) { if (entry.name === '.git' || entry.name === 'node_modules' || srcPath === dest) continue; copyDirRecursive(srcPath, destPath); }
            else if (!/^(\.DS_Store|Thumbs\.db|~|\.gitkeep)$/i.test(entry.name)) { fs.copyFileSync(srcPath, destPath); }
        }
    } catch (error) { logBuildError(`Failed during recursive copy from ${src} to ${dest}`, error); throw error; }
}

// Helper function needed for CHECK 3 (keep as is)
function _getChunkIdForBuildCheck(familyName) {
    if (!familyName) return 'symbols'; const firstChar = familyName.trim().charAt(0).toLowerCase();
    if (firstChar >= 'a' && firstChar <= 'f') return 'a-f'; if (firstChar >= 'g' && firstChar <= 'm') return 'g-m';
    if (firstChar >= 'n' && firstChar <= 'z') return 'n-z'; if (firstChar >= '0' && firstChar <= '9') return '0-9';
    return 'symbols';
}


// --- Main Build Logic ---
(async () => {
    try {
        logBuild(`--- Starting Build: Target='${target}' ---`);

        // 1. Clean Output Directory
        logBuild(`Cleaning output directory: ${distDir}`);
        fs.rmSync(distDir, { recursive: true, force: true });
        fs.mkdirSync(distDir, { recursive: true });
        logBuildSuccess(`Cleaned and created ${distDir}`);

        // 2. Font Generation (Conditional)
        const fontGenScript = path.join(__dirname, 'generate-fonts-json.js');
        const inlineFontsJsPath = path.join(projectRoot, 'inline-fonts-data.js'); // Input for splitter
        const fontsJsonPath = path.join(projectRoot, 'fonts.json'); // Contains only URLs
        const generatedCssPath = path.join(projectRoot, 'css', 'generated-font-classes.css');
        const rootChunkDir = path.join(projectRoot, FONT_CHUNKS_DIR); // Output dir for splitter

        if (!skipFontRegen) {
            // Generate data suitable for splitting (needs URLs, metadata flag false)
            // REMOVED conditional --base64 flag. Always generate for splitting.
            const fontArgs = [];
            logBuildInfo(`Regenerating font assets using 'generate-fonts-json.js ${fontArgs.join(' ')}'...`);

            // Delete potentially stale root files BEFORE generation
            if (fs.existsSync(inlineFontsJsPath)) fs.rmSync(inlineFontsJsPath);
            if (fs.existsSync(fontsJsonPath)) fs.rmSync(fontsJsonPath);
            if (fs.existsSync(generatedCssPath)) fs.rmSync(generatedCssPath);
            // Clean root chunks dir BEFORE splitting runs below
            if (fs.existsSync(rootChunkDir)) { logBuildInfo(`Cleaning root ${FONT_CHUNKS_DIR} directory before potential regeneration...`); fs.rmSync(rootChunkDir, { recursive: true, force: true }); }


            const fontResult = spawnSync('node', [fontGenScript, ...fontArgs], { stdio: 'inherit', cwd: projectRoot, shell: process.platform === 'win32' });
            if (fontResult.status !== 0) { throw new Error(`Font generation script failed (Exit code: ${fontResult.status}).`); }
            logBuildSuccess('Font assets generated successfully.');

            // CHECK 1: Verify generator output files exist
            if (!fs.existsSync(inlineFontsJsPath)) throw new Error(`[BUILD CHECK FAILED] generate-fonts-json.js did NOT create ${inlineFontsJsPath}`);
            if (!fs.existsSync(fontsJsonPath)) logBuildWarn(`[BUILD CHECK WARN] generate-fonts-json.js did NOT create ${fontsJsonPath}`);
            if (!fs.existsSync(generatedCssPath)) logBuildWarn(`[BUILD CHECK WARN] generate-fonts-json.js did NOT create ${generatedCssPath}`);
            logBuildInfo('[BUILD CHECK PASSED] Font generator output files exist.');

        } else {
            logBuildInfo('Skipping font regeneration.');
            // Checks if prerequisites for *splitting* exist if skipping generation
            if (!fs.existsSync(inlineFontsJsPath)) throw new Error(`Cannot skip font regen: Required input for split ${inlineFontsJsPath} is missing.`);
            // Chunks must exist from previous run if skipping
            if (!fs.existsSync(rootChunkDir)) throw new Error(`Cannot skip font regen: Required chunk directory ${rootChunkDir} is missing.`);
        }

        // --- MOVED: Run/Verify Font Splitting for BOTH targets (if not skipped) ---
        logBuildInfo('Ensuring font chunks are generated/verified...');

        // CHECK 2: Verify input for split-fonts.js (expects metadata.base64Included=false)
        logBuildInfo(`Verifying input file for split-fonts: ${inlineFontsJsPath}`);
        if (!fs.existsSync(inlineFontsJsPath)) throw new Error(`[BUILD CHECK FAILED] Cannot run/verify split-fonts: Input file ${inlineFontsJsPath} missing!`);
        try {
            const content = fs.readFileSync(inlineFontsJsPath, 'utf8');
            const match = content.match(/(?:window\._INLINE_FONTS_DATA\s*=\s*)({[\s\S]*});?/m);
            if (!match || !match[1]) throw new Error(`Could not extract data structure from ${inlineFontsJsPath}`);
            const data = JSON.parse(match[1]);
            // Check metadata flag confirms it was generated for splitting
            if (data?.metadata?.base64Included === true) { throw new Error(`Input ${inlineFontsJsPath} has metadata base64Included=true! Expected false for splitting.`); }
             // Check first variant has URL AND dataUrl (or null) - From generator v1.9+
            if (!data?.fonts?.length || !data.fonts[0]?.variants?.length || typeof data.fonts[0].variants[0].url !== 'string') { logBuildWarn(`[BUILD CHECK WARN] Input ${inlineFontsJsPath} variants seem invalid or missing 'url'.`); }
            if (!data?.fonts?.length || !data.fonts[0]?.variants?.length || typeof data.fonts[0].variants[0].dataUrl === 'undefined') { logBuildWarn(`[BUILD CHECK WARN] Input ${inlineFontsJsPath} variants seem invalid or missing 'dataUrl'.`); }

            logBuildInfo(`[BUILD CHECK PASSED] Input ${inlineFontsJsPath} looks correct type for splitting (metadata flag false, url/dataUrl likely present).`);
        } catch (e) { throw new Error(`[BUILD CHECK FAILED] Error validating ${inlineFontsJsPath} before split: ${e.message}`); }


        // Run split-fonts.js if fonts were regenerated
        if (!skipFontRegen) {
            logBuildInfo('Running font chunking script (split-fonts.js)...');
            const splitScript = path.join(__dirname, 'split-fonts.js');
            const splitResult = spawnSync('node', [splitScript], { stdio: 'inherit', cwd: projectRoot, shell: process.platform === 'win32' });
            if (splitResult.status !== 0) { throw new Error(`Font chunking script (split-fonts.js) failed (Exit code: ${splitResult.status}). Check its logs.`); }
            logBuildInfo('Font chunking script completed successfully.');
        } else {
            logBuildInfo('Skipping split-fonts.js execution as font regen was skipped.');
            // We already checked above that rootChunkDir exists if skipping.
        }

        // CHECK 3: Verify splitter output exists
        logBuildInfo('Verifying split-fonts.js output directory and files...');
        const chunkIndexOutputPath = path.join(rootChunkDir, 'index.json');
        const chunkG_MOutputPath = path.join(rootChunkDir, 'g-m.json'); // Example chunk file
         try {
             if (!fs.existsSync(rootChunkDir)) throw new Error(`Output directory ${rootChunkDir} missing.`);
             if (!fs.existsSync(chunkIndexOutputPath)) throw new Error(`Output ${chunkIndexOutputPath} missing.`);
             const indexContent = fs.readFileSync(chunkIndexOutputPath, 'utf8'); const indexData = JSON.parse(indexContent);
             if (!Array.isArray(indexData) || indexData.length === 0) { throw new Error(`Output ${chunkIndexOutputPath} is empty or invalid.`); }
             logBuildInfo(`[BUILD CHECK PASSED] Output ${path.basename(chunkIndexOutputPath)} looks valid (${indexData.length} entries).`);

             if (!fs.existsSync(chunkG_MOutputPath)) throw new Error(`Example output chunk ${chunkG_MOutputPath} missing.`); // Should exist even if empty
             const chunkContent = fs.readFileSync(chunkG_MOutputPath, 'utf8'); const chunkData = JSON.parse(chunkContent);
             if (!chunkData?.fonts || !Array.isArray(chunkData.fonts)) throw new Error(`Output ${chunkG_MOutputPath} invalid structure.`);
             // Check first variant has dataUrl (string or null) - Splitter should include this
              if (chunkData.fonts.length > 0 && typeof chunkData.fonts[0]?.variants?.[0]?.dataUrl === 'undefined') { logBuildWarn(`[BUILD CHECK WARN] Output ${chunkG_MOutputPath} variants missing 'dataUrl'. Expected hybrid chunk.`); }
              else if (chunkData.fonts.length > 0) { logBuildInfo(`[BUILD CHECK PASSED] Output ${path.basename(chunkG_MOutputPath)} looks valid (${chunkData.fonts.length} fonts, includes url+dataUrl).`); }
              else { logBuildInfo(`[BUILD CHECK OK] Output ${path.basename(chunkG_MOutputPath)} is empty (as expected?).`); }

         } catch(e) { throw new Error(`[BUILD CHECK FAILED] Error validating output chunk/index files in ${rootChunkDir}: ${e.message}`); }
        logBuildSuccess('Font chunks generated/verified.');
        // --- END MOVED SECTION ---


        // 3. Copy HTML Template
        const templateFile = target === 'deploy' ? 'index.template.html' : 'index-portable.template.html';
        const htmlSrc = path.join(projectRoot, templateFile);
        const htmlDest = path.join(distDir, 'index.html');
        if (!fs.existsSync(htmlSrc)) throw new Error(`Required template file missing: ${htmlSrc}`);
        logBuildInfo(`Copying template ${templateFile} to ${htmlDest}...`);
        fs.copyFileSync(htmlSrc, htmlDest);
        logBuildSuccess(`Copied ${templateFile} as index.html.`);

        // 4. Copy Core Assets (CSS, JS, Assets)
        logBuildInfo('Copying core asset directories (css, js, assets)...');
        for (const dir of ['css', 'js', 'assets']) {
            // ... (keep existing core asset copying logic - no changes needed here) ...
            const src = path.join(projectRoot, dir); const dest = path.join(distDir, dir);
            logBuildInfo(`Copying ${dir}...`); copyDirRecursive(src, dest);
            if (dir === 'css' && !fs.existsSync(path.join(dest, 'generated-font-classes.css'))) { logBuildWarn(`Generated CSS file not found in destination ${dest} after copy!`); }
        }
        logBuildSuccess('Core asset directories copied.');

        // 5. Copy Root Files (LICENSE etc)
         logBuildInfo('Copying root files...');
        for (const file of ['LICENSE']) {
             // ... (keep existing root file copying logic - no changes needed here) ...
            const filePath = path.join(projectRoot, file); const filePathMd = path.join(projectRoot, `${file}.md`);
            const sourceFile = fs.existsSync(filePath) ? filePath : fs.existsSync(filePathMd) ? filePathMd : null;
            if (sourceFile) { logBuildInfo(`Copying ${path.basename(sourceFile)}...`); fs.copyFileSync(sourceFile, path.join(distDir, path.basename(sourceFile))); }
            else { logBuildWarn(`Root file ${file}(.md) not found, skipping.`); }
        }

        // 6. Target-Specific Asset Handling
        logBuildInfo(`Performing ${target}-specific steps...`);

        if (target === 'deploy') {
            // Deploy target needs chunks, source fonts (for URLs), and URL metadata json

            logBuildInfo('Copying deploy-specific assets (chunks, fonts, metadata) to dist...');
            const destChunkDir = path.join(distDir, FONT_CHUNKS_DIR);
            logBuildInfo(`Copying ${FONT_CHUNKS_DIR}...`);
            copyDirRecursive(rootChunkDir, destChunkDir); // Copy generated chunks (hybrid)

            const sourceFontDir = path.join(projectRoot, FONT_DIR_NAME);
            const destFontDir = path.join(distDir, FONT_DIR_NAME);
            if (!fs.existsSync(sourceFontDir)) throw new Error(`Source font directory missing: ${sourceFontDir}`);
            logBuildInfo(`Copying ${FONT_DIR_NAME}...`);
            copyDirRecursive(sourceFontDir, destFontDir); // Copy font files (for URL access)

            const destFontsJson = path.join(distDir, 'fonts.json');
            if (!fs.existsSync(fontsJsonPath)) throw new Error(`Source fonts.json missing: ${fontsJsonPath}`);
            logBuildInfo(`Copying fonts.json...`);
            fs.copyFileSync(fontsJsonPath, destFontsJson); // Copy URL-based metadata

            fs.writeFileSync(path.join(distDir, '.nojekyll'), ''); // For GitHub Pages
            logBuildSuccess('Deploy-specific assets processed.');

        } else if (target === 'portable') {
            // Portable target needs chunks and the source fonts (for relative URL access within Electron)
            // Optionally include inline data as a fallback.

            logBuildInfo('Copying portable-specific assets (chunks, fonts, optional inline data) to dist...');

            // Copy Chunks (Required for primary loading strategy that failed previously)
            const destChunkDir = path.join(distDir, FONT_CHUNKS_DIR);
            logBuildInfo(`Copying ${FONT_CHUNKS_DIR} directory...`);
            copyDirRecursive(rootChunkDir, destChunkDir); // Copy generated chunks

            // Copy Source Fonts (Required if chunks reference ../fonts/ via url)
            const sourceFontDir = path.join(projectRoot, FONT_DIR_NAME);
            const destFontDir = path.join(distDir, FONT_DIR_NAME);
            if (!fs.existsSync(sourceFontDir)) {
                logBuildWarn(`Source font directory missing: ${sourceFontDir}. Font URLs might fail unless chunks use dataUrls.`);
            } else {
                logBuildInfo(`Copying ${FONT_DIR_NAME} directory...`);
                copyDirRecursive(sourceFontDir, destFontDir); // Copy actual font files
            }

            // Copy Inline Data (Optional fallback - useful if fontManager supports it)
            const destInlineFontsJs = path.join(distDir, path.basename(inlineFontsJsPath));
             if (fs.existsSync(inlineFontsJsPath)) {
                 logBuildInfo(`Copying optional fallback ${path.basename(inlineFontsJsPath)}...`);
                 fs.copyFileSync(inlineFontsJsPath, destInlineFontsJs);
             } else {
                 logBuildWarn(`Optional fallback ${path.basename(inlineFontsJsPath)} not found, skipping copy.`);
             }

            logBuildSuccess('Portable-specific assets processed.');
        }

        logBuildSuccess(`Build succeeded for target '${target}': ${distDir}`);

    } catch (e) {
        logBuildError(`Build failed for target '${target}': ${e.message}`);
        if (e.stack) { console.error(e.stack); }
        process.exit(1);
    }
})(); // End build logic