/**
 * scripts/dev.js (v3.8 - Smarter font regen check + Type Check)
 * Manages the local development environment.
 * - Checks if font outputs exist AND if inline-fonts-data.js is correct type (URL-based)
 * before initial build to avoid unnecessary/incorrect regen skipping.
 * - Runs build on start and on change (using build.js).
 * - Default: Builds 'deploy' target, serves 'dist/github-pages'.
 * - With --portable flag: Builds 'portable' target, serves 'dist/portable'.
 * - Serves the appropriate build output directory.
 * - Attempts robust server restarts and opens browser.
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const chokidar = require('chokidar');
const net = require('net');

// --- Configuration ---
const projectRoot = path.resolve(__dirname, '..');
const WATCH_TARGETS_DEV = [ /* ... keep as is ... */ ];
const IGNORE_PATTERNS_WATCHER = [ /* ... keep as is ... */ ];
const BUILD_SCRIPT_PATH = path.resolve(__dirname, 'build.js');
// Paths to generated font files (relative to projectRoot)
const FONT_JSON_PATH = path.join(projectRoot, 'fonts.json');
const INLINE_FONTS_JS_PATH = path.join(projectRoot, 'inline-fonts-data.js');
const GENERATED_CSS_PATH = path.join(projectRoot, 'css', 'generated-font-classes.css');

const NODE_COMMAND = 'node';
const SERVER_COMMAND = 'npx';
const BASE_SERVER_ARGS = [ /* ... keep as is ... */ ];
const DEFAULT_DEV_PORT = 3000;
const SKIP_FONT_REGEN_ARG = '--skip-font-regen';
const DEBOUNCE_DELAY = 500;
const SERVER_KILL_DELAY = 500;

// --- Script State ---
let serverProcess = null;
let watcher = null;
let debounceTimeout = null;
let isProcessingChange = false;
let needsFontRebuild = true; // <<<--- MODIFIED: Default to TRUE, check will set to false if OK
let currentPort = DEFAULT_DEV_PORT;
let isPortableMode = false;

// --- Argument Parsing --- (Keep as is)
process.argv.slice(2).forEach(arg => { /* ... keep as is ... */ });


// --- Logging Helpers ---
const log = (msg) => console.log(`[DEV] ${msg}`);
const logWarn = (msg) => console.warn(`[DEV] [WARN] ${msg}`);
const logError = (msg, err) => console.error(`[DEV] [ERROR] ${msg}`, err || '');
const logAction = (msg) => console.log(`\n✨ ${msg} ✨`);
const logSuccess = (msg) => console.log(`[DEV] ✅ ${msg}`);
const logInfo = (msg) => console.log(`[DEV INFO] ${msg}`);
const logTrace = (msg) => console.log(`[DEV TRACE] ${msg}`);

// --- Port Check ---
async function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => resolve(err.code === 'EADDRINUSE'));
        server.once('listening', () => server.close(() => resolve(false)));
        server.listen(port, '0.0.0.0'); // Listen on all interfaces for broader check
    });
}

// --- Process Management (Returns Promise) ---
async function killProcess(procRef, name) {
    let proc = procRef; if (!proc || proc.killed) { return Promise.resolve(); }
    const pid = proc.pid; log(`Attempting to stop ${name} process (PID: ${pid})...`);
    return new Promise((resolve) => {
        let killed = false;
        const timeout = setTimeout(() => {
            if (!killed) {
                logWarn(`Force killing ${name} PID ${pid} via SIGKILL (timeout).`);
                try {
                    if (process.platform === 'win32') {
                        spawn('taskkill', ['/PID', pid, '/F', '/T'], { detached: true, stdio: 'ignore' }).unref();
                    } else {
                        process.kill(pid, 'SIGKILL');
                    }
                } catch (e) {
                    logError(`Force kill failed for ${name} PID ${pid}:`, e);
                }
                killed = true;
                resolve(); // Resolve even if force kill failed, don't hang
            }
        }, 3000); // 3 second timeout before force kill

        proc.once('exit', (code, signal) => {
            clearTimeout(timeout);
            if (!killed) {
                logInfo(`${name} process PID ${pid} exited gracefully (Code: ${code}, Signal: ${signal}).`);
                killed = true;
                resolve();
            }
        });

        proc.once('error', (err) => {
            logWarn(`Error from ${name} PID ${pid} during kill attempt: ${err.message}`);
            clearTimeout(timeout);
            if (!killed) {
                killed = true;
                resolve(); // Resolve even on error to avoid hanging
            }
        });

        try {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/PID', pid, '/T'], { detached: true, stdio: 'ignore' }).unref();
            } else {
                process.kill(pid, 'SIGTERM'); // Standard SIGTERM for POSIX
            }
        } catch (e) {
            logWarn(`Initial termination signal failed for ${name} PID ${pid}: ${e.message}. Timeout may force kill.`);
        }
    });
}


// Check Port and Kill Tracked Process if Necessary
async function checkPortAndKill(port) {
    if (await isPortInUse(port)) {
        logWarn(`Port ${port} is in use. Attempting kill of tracked server process...`);
        if (serverProcess) {
            await killProcess(serverProcess, 'Server');
            serverProcess = null; // Clear reference after kill attempt
            logInfo(`Waiting ${SERVER_KILL_DELAY}ms for port ${port} to free up after kill attempt...`);
            await new Promise(resolve => setTimeout(resolve, SERVER_KILL_DELAY));
            if (await isPortInUse(port)) {
                logError(`Port ${port} STILL in use after kill attempt. Manual intervention may be required.`);
                return false;
            }
             logSuccess(`Port ${port} appears to be free now.`);
        } else {
            logError(`Cannot auto-kill process on port ${port} - no server process is currently tracked by this script. Waiting...`);
            logInfo(`Waiting ${SERVER_KILL_DELAY * 2}ms for port ${port} to potentially free up...`);
            await new Promise(resolve => setTimeout(resolve, SERVER_KILL_DELAY * 2)); // Wait a bit longer if not tracked
            if (await isPortInUse(port)) {
                logError(`Port ${port} is still in use. Please stop the other process manually.`);
                return false;
            }
        }
    }
    return true;
}

// --- HTTP Server (Async with Kill Wait) ---
async function startHttpServer() {
    const directoryToServe = isPortableMode
        ? path.join(projectRoot, 'dist', 'portable')
        : path.join(projectRoot, 'dist', 'github-pages'); // Default to deploy output
    const port = currentPort;

    const portIsFree = await checkPortAndKill(port);
    if (!portIsFree) {
        logError("Cannot start server: Port busy.");
        return;
    }
    serverProcess = null;

    logAction(`>>> Starting http-server...`);
    logInfo(`>>> Serving directory: ${directoryToServe}`);

    // Use index.html as entry point for both modes in dev server context
    const indexFile = 'index.html';
    const fullIndexPath = path.join(directoryToServe, indexFile);

    if (!fs.existsSync(directoryToServe) || !fs.existsSync(fullIndexPath)) {
        logError(`Cannot start: Directory '${directoryToServe}' or entry file '${indexFile}' not found. Run build first.`);
        return;
    }

    // Construct server arguments dynamically - always open index.html
    const finalServerArgs = ['http-server', directoryToServe, '-p', String(port), '--cors', '-c-1', '-o', indexFile];
    logInfo(`>>> Spawning: ${SERVER_COMMAND} ${finalServerArgs.join(' ')}`);

    try {
        const spawnOptions = { stdio: 'inherit', cwd: projectRoot, shell: process.platform === 'win32', detached: process.platform !== 'win32' };
        const spawned = spawn(SERVER_COMMAND, finalServerArgs, spawnOptions);
        serverProcess = spawned;

        if (!spawned || !spawned.pid) {
            serverProcess = null;
            throw new Error("Spawned server process has no PID.");
        }

        logSuccess(`>>> Spawned server (PID: ${spawned.pid}) - Serving on http://localhost:${port}/${indexFile}`);

        spawned.on('error', (err) => {
            logError(`>>> Server (PID: ${spawned?.pid}) error:`, err);
            if (err.code === 'EADDRINUSE') {
                logError(`Port ${port} conflict detected by server process!`);
            }
            if (serverProcess && serverProcess.pid === spawned?.pid) {
                serverProcess = null;
            }
        });
        spawned.on('close', (code, signal) => {
              if (serverProcess && serverProcess.pid === spawned?.pid) {
                   logWarn(`>>> Tracked server (PID: ${spawned.pid}) exited (Code: ${code}, Signal: ${signal})`);
                   serverProcess = null;
              } else if (!serverProcess && code !== null) {
                   logWarn(`>>> Untracked server process (PID: ${spawned?.pid}) exited (Code: ${code}, Signal: ${signal})`);
              }
        });
    } catch (e) {
        logError(">>> CRITICAL ERROR spawning http-server:", e);
        serverProcess = null;
    }
}

// --- Build Execution (Sync, uses mode to select target) ---
// Takes the 'needsFontRebuild' state as input
function runBuild(forceFontRegen = false) {
    const buildTarget = isPortableMode ? 'portable' : 'deploy';
    logAction(`>>> Starting Build (Target: ${buildTarget})...`);

    const buildArgs = [`--target=${buildTarget}`];
    let performFontRegen = forceFontRegen; // Decide based on input state

    if (!performFontRegen) {
        buildArgs.push(SKIP_FONT_REGEN_ARG);
        logInfo("Build will skip font regeneration (based on dev script state).");
    } else {
        logInfo("Build includes font regeneration (based on dev script state).");
    }

    const result = spawnSync(NODE_COMMAND, [BUILD_SCRIPT_PATH, ...buildArgs], {
        stdio: 'inherit', cwd: projectRoot, shell: process.platform === 'win32'
    });

    if (result.status === 0 && !result.error) {
        logSuccess('Build complete.');
        // **No longer managing needsFontRebuild here** - dev script handles it
        return true; // Success
    } else {
        logError('Build failed.', result.error || `Exit code: ${result.status}`);
        // Don't change needsFontRebuild on failure
        return false; // Failure
    }
}

// --- File Watching ---
function setupWatcher() {
    if (watcher) return; // Already watching
    log('Setting up file watchers using chokidar...');
    const watchPaths = WATCH_TARGETS_DEV.map(p => path.join(projectRoot, p));
    try {
        watcher = chokidar.watch(watchPaths, {
            ignored: IGNORE_PATTERNS_WATCHER,
            persistent: true,
            ignoreInitial: true,
            atomic: true,
            awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
        });

        const handleChange = async (eventPath) => {
            const relativePath = path.relative(projectRoot, eventPath);
            logTrace(`Chokidar event: path='${relativePath}'`);
            if (isProcessingChange) {
                logTrace(`Skipping change event for "${relativePath}" - already processing.`);
                return;
            }
            isProcessingChange = true;
            log(`Change detected: "${relativePath}"`);

            // *** Check if the change REQUIRES font regeneration ***
            // This includes source fonts OR the templates that might use them
            const isFontRelatedChange = relativePath.startsWith(path.join('fonts') + path.sep)
                                     || relativePath.endsWith('.template.html');

            let triggerFontRegen = false; // Assume no regen needed for this specific change
            if (isFontRelatedChange) {
                logWarn("Font file or template change detected! Forcing font rebuild on next build.");
                triggerFontRegen = true; // Mark for this specific run
                needsFontRebuild = true; // Keep state for potential future restarts
            } else {
                 // If it's not a font-related change, we respect the *current* state
                 // which might have been set to true previously but not acted upon,
                 // or might be false if fonts are up-to-date.
                 // However, for a non-font change, we generally DON'T want to force regen.
                 // The build script will be called with --skip-font-regen if triggerFontRegen is false.
                 logInfo("Non-font related change detected. Font regeneration will be skipped unless previously marked as needed.");
                 // We let runBuild decide based on the triggerFontRegen flag passed below
            }

            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(async () => {
                logInfo(`Debounce expired -> Triggering build & server restart...`);
                try {
                    // Run build, explicitly passing if this change triggered a font regen need
                    const buildOk = runBuild(triggerFontRegen);

                    // *** Reset needsFontRebuild ONLY if a regen was PERFORMED and SUCCEEDED ***
                    if (buildOk && triggerFontRegen) {
                         logInfo("[State] Reset needsFontRebuild=false after successful font regeneration.");
                         needsFontRebuild = false; // Fonts are now up-to-date
                    } else if (buildOk && !triggerFontRegen) {
                         logInfo("[State] Build successful, no font regeneration performed.");
                         // needsFontRebuild remains unchanged (might be true or false from previous state)
                    }


                    if (buildOk) {
                         await startHttpServer(); // Restart server
                    } else {
                         logError("Build failed, server not restarted.");
                         // If build failed, keep needsFontRebuild=true if it was set,
                         // so the next attempt tries again.
                    }
                } catch (buildRestartError) {
                    logError("Error during debounced build/restart:", buildRestartError);
                } finally {
                    isProcessingChange = false;
                    logInfo("Ready for next change.");
                }
            }, DEBOUNCE_DELAY);
        };

        watcher
            .on('add', handleChange)
            .on('change', handleChange)
            .on('unlink', handleChange)
            .on('error', error => logError(`Watcher error: ${error}`))
            .on('ready', () => logSuccess(`Watcher ready. Watching ${watchPaths.length} patterns.`));

    } catch (watcherError) {
        logError("CRITICAL ERROR setting up file watcher:", watcherError);
        logWarn("File watching will not function.");
    }
}


// --- Cleanup ---
async function cleanup() {
    log('\nShutting down...');
    process.off('SIGINT', cleanup);
    process.off('SIGTERM', cleanup);

    if(debounceTimeout) { clearTimeout(debounceTimeout); logInfo("Cleared debounce timer."); }

    try {
        if (watcher) {
             logInfo("Closing file watcher...");
             await watcher.close();
             logInfo("Watcher closed.");
         }
        await killProcess(serverProcess, 'Server');
        logSuccess("Cleanup complete. Exiting.");
        process.exit(0);
    } catch(err) {
        logError("Error during cleanup:", err);
        process.exit(1);
    }
    setTimeout(() => {
        logWarn("Cleanup timeout reached. Forcing exit.");
        process.exit(1);
    }, 5000).unref();
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// --- Start the Process ---
async function main() {
    const portIsFree = await checkPortAndKill(currentPort);
    if (!portIsFree) { /* ... */ process.exit(1); }

    const modeString = isPortableMode ? 'PORTABLE' : 'DEPLOY_BUILD_SERVE';
    const serveDir = isPortableMode ? path.join(projectRoot, 'dist', 'portable') : path.join(projectRoot, 'dist', 'github-pages');
    const buildTargetDesc = isPortableMode ? 'PORTABLE' : 'DEPLOY';

    log(`Initializing Logomaker environment [${modeString}] mode...`);
    log(`Building ${buildTargetDesc} target and serving: ${serveDir}`);
    log(`Server Port: ${currentPort}`);
    if (!isPortableMode) { /* ... warnings ... */ }
    else { /* ... info ... */ }
    log("---------------------------------------------------------------------");

    // *** MODIFIED Font File Check ***
    logInfo("Checking for existing font output files...");
    const fontsJsonExists = fs.existsSync(FONT_JSON_PATH);
    const inlineJsExists = fs.existsSync(INLINE_FONTS_JS_PATH);
    const generatedCssExists = fs.existsSync(GENERATED_CSS_PATH);

    let allowSkipRegen = false; // Assume regen is needed by default

    if (fontsJsonExists && inlineJsExists && generatedCssExists) {
        logSuccess("Found existing font output files (fonts.json, inline-fonts-data.js, generated-font-classes.css).");

        let isCorrectType = true;
        // If running default dev mode (which runs 'deploy' build), check the type of inline-fonts-data.js
        if (!isPortableMode) {
            logInfo(`Checking type of existing ${path.basename(INLINE_FONTS_JS_PATH)} for deploy build...`);
            try {
                const content = fs.readFileSync(INLINE_FONTS_JS_PATH, 'utf8');
                // Basic check for the structure and metadata flag
                const match = content.match(/(?:window\._INLINE_FONTS_DATA\s*=\s*)({[\s\S]*});?/m);
                if (!match || !match[1]) {
                     throw new Error('Could not extract _INLINE_FONTS_DATA object.');
                }
                const data = JSON.parse(match[1]);
                // ** The critical check **
                if (data?.metadata?.base64Included === true) {
                    logWarn(`Existing ${path.basename(INLINE_FONTS_JS_PATH)} contains Base64 data, but 'deploy' build needs URLs.`);
                    isCorrectType = false; // Cannot skip, type is wrong for split-fonts.js
                } else if (data?.metadata?.base64Included === false) {
                    logSuccess(`Existing ${path.basename(INLINE_FONTS_JS_PATH)} appears correct type (URLs/base64Included=false).`);
                    isCorrectType = true;
                } else {
                     logWarn(`Could not determine type from ${path.basename(INLINE_FONTS_JS_PATH)} metadata. Assuming incorrect type.`);
                     isCorrectType = false; // Regenerate if unsure
                }
            } catch (e) {
                logWarn(`Could not read/parse existing ${path.basename(INLINE_FONTS_JS_PATH)} to check type. Will regenerate. Error: ${e.message}`);
                isCorrectType = false; // Regenerate if file is unreadable/invalid
            }
        } else {
            // If running in portable mode (--portable flag passed to dev.js),
            // we only care that the file exists, type check isn't relevant for skipping *generator*.
             logInfo(`Running in portable mode, skipping type check for initial build.`);
             isCorrectType = true;
        }

        // Only allow skipping if all files exist AND the type is correct for the build mode
        if (isCorrectType) {
            logInfo("Initial build will skip font regeneration.");
            allowSkipRegen = true;
        } else {
            logWarn("Existing font output files are wrong type or unreadable. Initial build WILL regenerate fonts.");
            allowSkipRegen = false;
        }

    } else {
        logWarn("One or more font output files missing. Initial build WILL regenerate fonts.");
        logInfo(`Missing: ${!fontsJsonExists ? 'fonts.json ' : ''}${!inlineJsExists ? 'inline-fonts-data.js ' : ''}${!generatedCssExists ? 'generated-font-classes.css' : ''}`);
        allowSkipRegen = false; // Cannot skip if files are missing
    }

    // Set the state for the build call
    needsFontRebuild = !allowSkipRegen;
    logInfo(`Initial 'needsFontRebuild' state set to: ${needsFontRebuild}`);
    log("---------------------------------------------------------------------");


    log("Running initial build...");
    // Pass the determined 'needsFontRebuild' state to the initial build
    const initialBuildOk = runBuild(needsFontRebuild); // runBuild expects TRUE to force regen

    // Update needsFontRebuild state AFTER initial build for subsequent watcher changes
    if (initialBuildOk && needsFontRebuild) {
        logInfo("[State] Reset needsFontRebuild=false after successful initial font regeneration.");
        needsFontRebuild = false; // Fonts are now up-to-date
    } else if (initialBuildOk && !needsFontRebuild) {
         logInfo("[State] Initial build successful, font regeneration was skipped.");
         needsFontRebuild = false; // State remains false (or becomes false)
    }
    // If build failed, needsFontRebuild retains its value before the build call

    if (initialBuildOk) {
        log("Initial build successful. Starting server and file watchers...");
        await startHttpServer();
        setupWatcher(); // setupWatcher uses the updated 'needsFontRebuild' state
        log('Ready! Watching files for changes...');
        log('Press CTRL+C to stop the server and watchers.');
    } else {
        logError("Initial build failed. Server and watchers not started.");
        process.exit(1);
    }
}

// Execute main function
main().catch(err => {
    logError("Unhandled error during startup sequence:", err);
    process.exit(1);
});