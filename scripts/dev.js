/**
 * scripts/dev.js
 * Development Watcher for Logomaker (v1.2 - Conditional Font Rebuild)
 * ---------------------------------
 * Watches source files (HTML, CSS, JS, Fonts) and automatically restarts
 * the build & serve process (`node scripts/build.js --serve`).
 * Only forces font artifact regeneration if font files are changed.
 * Uses Node.js built-in modules (`fs`, `child_process`).
 *
 * Usage: Run from project root -> `node scripts/dev.js`
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// --- Configuration ---

// Files/Directories to watch (relative to project root)
const WATCH_TARGETS = [
    'index.html', // Watch the main HTML file
    'js',         // Watch the entire JS directory recursively
    'css',        // Watch the entire CSS directory recursively
    'fonts'       // Watch the fonts source directory recursively
];

// Command to run for building and serving
const BUILD_COMMAND = 'node';
// Base arguments for the build script (change if testing portable mode)
const BASE_BUILD_ARGS = ['scripts/build.js', '--serve'];
// To watch the PORTABLE build instead, use:
// const BASE_BUILD_ARGS = ['scripts/build.js', '--serve', '--portable'];

// Argument to pass to build.js when font regeneration is NOT needed
const SKIP_CLEAN_ARG = '--skip-font-clean';

// Delay after detecting a change before triggering a rebuild
const DEBOUNCE_DELAY = 500; // milliseconds

// --- Script State ---

const projectRoot = path.resolve(__dirname, '..');
let buildProcess = null;    // Holds the current running build/serve process
let debounceTimeout = null; // Timer for debouncing file changes
let needsFontRebuild = true; // Flag to track if fonts need rebuilding (true initially)
let watchers = [];          // Array to hold file system watcher instances

// --- Logging Helpers ---
const log = (msg) => console.log(`[DEV] ${msg}`);
const logWarn = (msg) => console.warn(`[DEV] [WARN] ${msg}`);
const logError = (msg, err) => console.error(`[DEV] [ERROR] ${msg}`, err || '');
const logAction = (msg) => console.log(`\n✨ ${msg} ✨`);
const logSuccess = (msg) => console.log(`[DEV] ✅ ${msg}`);

// --- Process Management ---

/**
 * Attempts to gracefully kill the currently running build process.
 * Uses taskkill on Windows, kill with SIGTERM/SIGKILL on Unix-like.
 * Executes a callback function once the process is confirmed (or assumed) stopped.
 * @param {function} [callback] - Optional function to call after process termination attempt.
 */
function killCurrentProcess(callback) {
    if (!buildProcess || buildProcess.killed) {
        buildProcess = null;
        if (callback) process.nextTick(callback); // Ensure async callback if no process
        return;
    }

    log(`Stopping previous build/serve process (PID: ${buildProcess.pid})...`);
    const pid = buildProcess.pid;
    let killed = false;

    // Cleanup function called on exit or timeout
    const killCleanup = () => {
        if (!killed) {
            killed = true;
            // Ensure the reference is cleared even if exit event didn't fire reliably
            if (buildProcess && buildProcess.pid === pid) {
                 buildProcess = null;
            }
            log('Previous process stop attempt finished.');
            if (callback) process.nextTick(callback); // Proceed with next action
        }
    };

    // Listen for the actual exit event
    buildProcess.once('exit', (code, signal) => {
         log(`Previous process exited (Code: ${code}, Signal: ${signal})`);
        killCleanup();
    });

    // Attempt termination
    try {
        if (process.platform === 'win32') {
            // /F forces termination, /T kills child processes
            spawn('taskkill', ['/PID', pid, '/F', '/T'], { detached: true, stdio: 'ignore' })
                .on('error', (err) => {
                    logWarn(`taskkill command failed (PID: ${pid}): ${err.message}. Fallback might be needed.`);
                    // Fallback: try node's default kill (less effective on Windows for trees)
                     try { if(buildProcess && !buildProcess.killed) buildProcess.kill('SIGTERM'); } catch (e) {}
                });
        } else {
            // On Unix, send SIGTERM to the process group first, then the process itself
             try { process.kill(-pid, 'SIGTERM'); } // Kill group
             catch (e) {
                  try { process.kill(pid, 'SIGTERM'); } catch (e2) {} // Kill process if group failed
            }
        }
    } catch (e) {
        logWarn(`Error sending initial termination signal (PID: ${pid}): ${e.message}.`);
        // If initial kill fails, might need SIGKILL later in timeout
    }

    // Failsafe: Force kill if it doesn't exit after a timeout
    setTimeout(() => {
        if (!killed && buildProcess && buildProcess.pid === pid && !buildProcess.killed) {
            logWarn(`Force killing process ${pid} via SIGKILL (timeout).`);
             try { process.kill(pid, 'SIGKILL'); } catch (e) { logError(`Force kill failed for PID ${pid}:`, e); }
        }
        // Ensure cleanup runs even if SIGKILL fails or process already exited
        killCleanup();
    }, 3000); // 3 second timeout
}

/**
 * Starts the build and serve process (`node scripts/build.js --serve`).
 * Adds the `--skip-font-clean` argument if `forceFontRebuild` is false.
 * @param {boolean} [forceFontRebuild=false] - Whether to force font artifact regeneration.
 */
function startBuildServe(forceFontRebuild = false) {
    const effectiveForceFontRebuild = forceFontRebuild || needsFontRebuild; // Check explicit flag OR tracked state
    const buildArgs = [...BASE_BUILD_ARGS]; // Copy base arguments

    if (!effectiveForceFontRebuild) {
        buildArgs.push(SKIP_CLEAN_ARG); // Add skip flag if NOT rebuilding fonts
        logAction(`Starting build & serve (Skipping Font Regen)... (${new Date().toLocaleTimeString()})`);
    } else {
        logAction(`Starting build & serve (Forcing Font Regen)... (${new Date().toLocaleTimeString()})`);
    }

    // Ensure previous process is fully stopped before starting new one
    killCurrentProcess(() => {
        try {
            // Spawn the build script
            buildProcess = spawn(BUILD_COMMAND, buildArgs, { // Use the dynamically determined args
                stdio: 'inherit', // Show build/server output in this terminal
                shell: true,      // Often needed for 'node' command, esp. on Windows
                cwd: projectRoot, // Ensure it runs from the project root directory
            });

             if (!buildProcess || !buildProcess.pid) {
                 throw new Error("Failed to get valid process object after spawn.");
             }
            const pid = buildProcess.pid; // Store pid for reliable tracking
            log(`Spawned build process (PID: ${pid})`);

            buildProcess.on('error', (err) => {
                // This usually means the command itself couldn't be found/executed
                logError(`Failed to start build process:`, err);
                 buildProcess = null; // Clear the reference on spawn error
            });

            buildProcess.on('close', (code) => {
                log(`Build process (PID: ${pid}) exited (Code: ${code})`);
                // Only clear the reference if it's the *same* process that closed
                if (buildProcess && buildProcess.pid === pid) {
                     buildProcess = null;
                     if (code === 0) {
                         // If the build was successful, reset the flag
                         // so the *next* change doesn't force font rebuild unless it's a font file
                         needsFontRebuild = false;
                         log("Build successful, font rebuild flag reset.");
                     } else {
                         // If build failed, assume fonts might still need rebuild next time
                         needsFontRebuild = true;
                          logWarn("Build failed, font rebuild flag remains set.");
                     }
                }
            });

        } catch (spawnError) {
            logError(`Error spawning build process:`, spawnError);
             buildProcess = null;
        }
    });
}

// --- File Watching ---

/**
 * Sets up watchers for the specified targets.
 */
function setupWatchers() {
    log('Setting up file watchers...');
    WATCH_TARGETS.forEach(target => {
        const targetPath = path.resolve(projectRoot, target);
        if (!fs.existsSync(targetPath)) {
            logWarn(`Watch target not found: "${target}", skipping.`);
            return;
        }

        // Determine if the target is the fonts directory
        const isFontsDir = path.relative(projectRoot, targetPath) === 'fonts';
        log(`Watching: "${path.relative(projectRoot, targetPath)}" ${isFontsDir ? '(Triggers Font Regen)' : ''}`);

        try {
            const watcher = fs.watch(targetPath, { recursive: true }, (eventType, filename) => {
                // Construct the approximate full path of the changed file/directory
                const changedItemPath = filename ? path.join(targetPath, filename) : targetPath;
                const relativePath = path.relative(projectRoot, changedItemPath);

                // Basic ignore patterns (fs.watch can be noisy)
                if (relativePath.startsWith('dist') ||
                    relativePath.includes('node_modules') ||
                    relativePath.includes('.git') ||
                    relativePath.endsWith('___') || // Editor temporary files
                    relativePath.endsWith('~') ||
                    relativePath.includes('generated-font-classes.css')) { // Ignore generated CSS
                    return;
                }

                log(`Change detected: ${eventType} in "${relativePath}"`);

                // Decide if a font rebuild is needed
                const isFontChange = relativePath.startsWith('fonts' + path.sep) || relativePath === 'fonts';
                if (isFontChange) {
                     logWarn("Change in fonts directory detected! Forcing font rebuild on next trigger.");
                    needsFontRebuild = true; // Set flag to force rebuild
                }

                // Trigger the rebuild (debounced)
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    // Pass the current state of the flag to startBuildServe
                    startBuildServe(needsFontRebuild);
                }, DEBOUNCE_DELAY);
            });

            watcher.on('error', (err) => {
                 logError(`Watcher error for "${targetPath}":`, err);
                 // Consider attempting to restart the specific watcher if feasible
            });
            watchers.push(watcher);

        } catch (error) {
            logError(`Failed to set up watch for "${targetPath}":`, error);
             if (error.code === 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
                 logWarn('Recursive watch might not be fully supported on this platform. Consider using the `chokidar` package.');
             }
        }
    });

    if (watchers.length > 0) {
         logSuccess(`Watcher active on ${watchers.length} target(s).`);
    } else {
         logError("No valid watch targets found or watchers could be set up. Exiting.");
         process.exit(1);
    }
}

// --- Initial Run & Cleanup ---

/**
 * Gracefully shuts down watchers and the build process.
 */
function cleanup() {
    log('\nShutting down watcher and server...');
     watchers.forEach(watcher => {
          try { watcher.close(); } catch (e) {} // Close individual watchers
     });
     watchers = []; // Clear watcher references
    log("Watchers closed.");
    killCurrentProcess(() => { // Kill the running build/serve process
         log("Cleanup complete. Exiting.");
        process.exit(0); // Exit gracefully
    });
     // Failsafe exit if cleanup hangs
     setTimeout(() => {
          logWarn("Forcing exit after cleanup timeout.");
          process.exit(1);
     }, 5000); // 5 seconds timeout
}

// Set up signal handlers for graceful shutdown
process.on('SIGINT', cleanup); // Catches Ctrl+C
process.on('SIGTERM', cleanup); // Catches standard termination signal

// --- Start the Development Process ---
log("Initializing development environment...");
startBuildServe(true); // Initial run - explicitly force font rebuild
setupWatchers();      // Setup watchers AFTER initial build starts
log('Ready! Waiting for file changes...');
log('Press CTRL+C to stop.');