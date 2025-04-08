/**
 * build.js v3.9 - Clean build script, no base href injection.
 * Relies on relative paths in templates.
 * Intended for use with dev.js v3.5+ (which serves the output locally)
 * and potentially for the portable build target.
 *
 * WARNING: The output of the 'deploy' target from THIS script is NOT directly
 * suitable for deployment to a subdirectory (like GitHub Pages /repo-name/)
 * because it lacks the <base href> tag. A separate build step or script
 * version (like v3.7) is needed for the actual deployment build.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// --- Configuration ---
const projectRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

// Parse arguments robustly
let target = args.find(a => a.startsWith('--target='))?.split('=')[1] || 'deploy';
let skipFontRegen = args.includes('--skip-font-regen');

// Validate target
if (!['deploy', 'portable'].includes(target)) {
    console.warn(`[Build] Invalid target '${target}', defaulting to 'deploy'.`);
    target = 'deploy';
}

const distDir = path.join(projectRoot, 'dist', target === 'deploy' ? 'github-pages' : 'portable');
const FONT_DIR_NAME = 'fonts'; // Source font directory relative to projectRoot
const FONT_CHUNKS_DIR = 'font-chunks'; // Relative to projectRoot

// --- Logging Helpers ---
const logBuild = (msg) => console.log(`[Build:${target}] ${msg}`);
const logBuildWarn = (msg) => console.warn(`[Build:${target}] [WARN] ${msg}`);
const logBuildError = (msg, err) => console.error(`[Build:${target}] [ERROR] ${msg}`, err || '');
const logBuildSuccess = (msg) => console.log(`[Build:${target}] ✅ ${msg}`);
const logBuildInfo = (msg) => console.log(`[Build:${target} INFO] ${msg}`);


// --- Helper Function: Safely Copy Directories ---
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        logBuildWarn(`Source directory not found, skipping copy: ${src}`);
        return;
    }
    try {
        fs.mkdirSync(dest, { recursive: true }); // Ensure destination exists
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                // Skip common excluded dirs and avoid infinite recursion
                if (entry.name === '.git' || entry.name === 'node_modules' || srcPath === dest) continue;
                copyDirRecursive(srcPath, destPath); // Recurse
            } else if (!/^(\.DS_Store|Thumbs\.db|~|\.gitkeep)$/i.test(entry.name)) { // Skip common junk files
                fs.copyFileSync(srcPath, destPath);
            }
        }
    } catch (error) {
         logBuildError(`Failed during recursive copy from ${src} to ${dest}`, error);
         throw error; // Stop build on copy failure
     }
}

// --- Main Build Logic (Self-executing async function) ---
(async () => {
    try {
        logBuild(`--- Starting Build: Target='${target}' ---`);

        // 1. Clean Output Directory
        logBuild(`Cleaning output directory: ${distDir}`);
        fs.rmSync(distDir, { recursive: true, force: true });
        fs.mkdirSync(distDir, { recursive: true });
        logBuildSuccess(`Cleaned and created ${distDir}`);

        // 2. Font Generation (Conditional)
        if (!skipFontRegen) {
            logBuildInfo('Regenerating font assets...');
            const fontGenScript = path.join(__dirname, 'generate-fonts-json.js');
            const fontArgs = target === 'portable' ? ['--base64'] : []; // Base64 only for portable
            const fontResult = spawnSync('node', [fontGenScript, ...fontArgs], {
                stdio: 'inherit', // Show output directly
                cwd: projectRoot,
                shell: process.platform === 'win32' // Use shell on Windows for node
            });
            if (fontResult.status !== 0) {
                const errMsg = fontResult.error || `Font generation script exited with code ${fontResult.status}`;
                throw new Error(`Font generation failed: ${errMsg}`);
            }
            logBuildSuccess('Font assets generated successfully.');
        } else {
            logBuildInfo('Skipping font regeneration.');
            // Add checks here if needed for existence of generated files when skipping
        }

        // 3. Process and Copy HTML Template
        const templateFile = target === 'deploy' ? 'index.template.html' : 'index-portable.template.html';
        const htmlSrc = path.join(projectRoot, templateFile);
        const htmlDest = path.join(distDir, 'index.html'); // Final name is always index.html

        if (!fs.existsSync(htmlSrc)) throw new Error(`Required template file missing: ${htmlSrc}`);
        logBuildInfo(`Copying template ${templateFile} to ${htmlDest}...`);
        fs.copyFileSync(htmlSrc, htmlDest);
        // --- ENSURE NO BASE HREF INJECTION OCCURS IN THIS VERSION ---
        logBuildSuccess(`Copied ${templateFile} as index.html.`);

        // 4. Copy Core Assets (CSS, JS, Assets)
        logBuildInfo('Copying core asset directories (css, js, assets)...');
        for (const dir of ['css', 'js', 'assets']) {
            const src = path.join(projectRoot, dir);
            const dest = path.join(distDir, dir);
            logBuildInfo(`Copying ${dir}...`);
            copyDirRecursive(src, dest);
             // Verify generated CSS is copied (important)
             if (dir === 'css' && !fs.existsSync(path.join(dest, 'generated-font-classes.css'))) {
                 logBuildWarn(`Generated CSS file not found in destination ${dest} after copy!`);
             }
        }
        logBuildSuccess('Core asset directories copied.');

        // 5. Copy Root Files (e.g., LICENSE)
        logBuildInfo('Copying root files...');
        for (const file of ['LICENSE']) { // Keep minimal, adjust if needed
            const filePath = path.join(projectRoot, file);
            const filePathMd = path.join(projectRoot, `${file}.md`);
            const sourceFile = fs.existsSync(filePath) ? filePath : fs.existsSync(filePathMd) ? filePathMd : null;
            if (sourceFile) {
                logBuildInfo(`Copying ${path.basename(sourceFile)}...`);
                fs.copyFileSync(sourceFile, path.join(distDir, path.basename(sourceFile)));
            } else { logBuildWarn(`Root file ${file}(.md) not found, skipping.`); }
        }

        // 6. Target-Specific Asset Handling
        logBuildInfo(`Performing ${target}-specific steps...`);
        if (target === 'deploy') {
            const fontsJsonPath = path.join(projectRoot, 'fonts.json');
            const inlineFontsJsPath = path.join(projectRoot, 'inline-fonts-data.js');

            if (!fs.existsSync(inlineFontsJsPath)) throw new Error(`inline-fonts-data.js (with URLs) missing. Run font generation first.`);
            if (!fs.existsSync(fontsJsonPath)) throw new Error(`fonts.json missing. Run font generation first.`);

            // Run split-fonts.js
            logBuildInfo('Running font chunking script...');
            const splitResult = spawnSync('node', [path.join(__dirname, 'split-fonts.js')], { stdio: 'inherit', cwd: projectRoot, shell: process.platform === 'win32' });
            if (splitResult.status !== 0) throw new Error('Font chunking script failed');

            // Copy chunks, source fonts, metadata, .nojekyll
            logBuildInfo('Copying deploy-specific assets (chunks, fonts, metadata)...');
            copyDirRecursive(path.join(projectRoot, FONT_CHUNKS_DIR), path.join(distDir, FONT_CHUNKS_DIR));
            copyDirRecursive(path.join(projectRoot, FONT_DIR_NAME), path.join(distDir, FONT_DIR_NAME)); // Need source fonts for URL loading
            fs.copyFileSync(fontsJsonPath, path.join(distDir, 'fonts.json'));
            fs.writeFileSync(path.join(distDir, '.nojekyll'), ''); // For GitHub Pages
            logBuildSuccess('Deploy-specific assets processed.');

        } else if (target === 'portable') {
            const inlineFontsJsPath = path.join(projectRoot, 'inline-fonts-data.js'); // Needs Base64 data
            if (!fs.existsSync(inlineFontsJsPath)) throw new Error(`inline-fonts-data.js missing for portable build. Ensure 'generate-fonts --base64' ran.`);
            logBuildInfo(`Copying inline-fonts-data.js for portable build...`);
            fs.copyFileSync(inlineFontsJsPath, path.join(distDir, 'inline-fonts-data.js'));
            logBuildSuccess('Portable-specific assets processed.');
        }

        // Final Success Message
        logBuildSuccess(`Build succeeded for target '${target}': ${distDir}`);

    } catch (e) {
        logBuildError(`Build failed for target '${target}': ${e.message}`);
        if (e.stack) { console.error(e.stack); }
        process.exit(1); // Exit with error code
    }
})();