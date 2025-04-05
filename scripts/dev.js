/**
 * scripts/dev.js
 * Development Watcher for Logomaker (v1.1 - Fixed logSuccess)
 * ---------------------------------
 * Watches source files (HTML, CSS, JS) and automatically restarts the
 * build & serve process (`node scripts/build.js --serve`) on changes.
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
    'index.html',
    'js',
    'css',
    // 'fonts' // Uncomment to watch font source changes
];

// Command to run (change BUILD_ARGS if you need to test portable build)
const BUILD_COMMAND = 'node';
const BUILD_ARGS = ['scripts/build.js', '--serve'];
// To watch the PORTABLE build instead, use:
// const BUILD_ARGS = ['scripts/build.js', '--serve', '--portable'];

const DEBOUNCE_DELAY = 500; // milliseconds

// --- Script ---

const projectRoot = path.resolve(__dirname, '..');
let buildProcess = null;
let debounceTimeout = null;
let watchers = [];

// --- Logging ---
const log = (msg) => console.log(`[DEV] ${msg}`);
const logWarn = (msg) => console.warn(`[DEV] [WARN] ${msg}`);
const logError = (msg, err) => console.error(`[DEV] [ERROR] ${msg}`, err || '');
const logAction = (msg) => console.log(`\n✨ ${msg} ✨`);
// <<< --- ADD THIS LINE --- >>>
const logSuccess = (msg) => console.log(`[DEV] ✅ ${msg}`);
// <<< --- END ADDED LINE --- >>>


// --- Process Management ---

function killCurrentProcess(callback) {
    if (!buildProcess || buildProcess.killed) {
        buildProcess = null;
        if (callback) process.nextTick(callback);
        return;
    }

    log('Stopping previous build/serve process...');
    const pid = buildProcess.pid;
    let killed = false;

    const killCleanup = () => {
        if (!killed) {
            killed = true;
            buildProcess = null;
            log('Previous process stopped.');
            if (callback) process.nextTick(callback);
        }
    };

    buildProcess.once('exit', killCleanup);

    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/PID', pid, '/F', '/T'], { detached: true, stdio: 'ignore' })
                .on('error', (err) => {
                    logWarn(`taskkill failed (PID: ${pid}): ${err.message}. Trying process.kill...`);
                    try { process.kill(pid, 'SIGTERM'); } catch (e) { /* Ignore */ }
                });
        } else {
             try { process.kill(-pid, 'SIGTERM'); } catch (e) { process.kill(pid, 'SIGTERM'); }
        }
    } catch (e) {
        logWarn(`Error sending SIGTERM (PID: ${pid}): ${e.message}. Trying SIGKILL.`);
         try { process.kill(pid, 'SIGKILL'); } catch (killErr) { logError(`Failed to kill process ${pid}:`, killErr)}
    }

    setTimeout(() => {
        if (!killed) {
            logWarn(`Force killing process ${pid} (timeout).`);
             try { process.kill(pid, 'SIGKILL'); } catch (e) { logError(`Force kill failed for PID ${pid}:`, e); }
            killCleanup();
        }
    }, 3000);
}


function startBuildServe() {
    logAction(`Starting build & serve... (${new Date().toLocaleTimeString()})`);

    killCurrentProcess(() => {
        try {
            buildProcess = spawn(BUILD_COMMAND, BUILD_ARGS, {
                stdio: 'inherit',
                shell: true,
                cwd: projectRoot,
                detached: process.platform !== 'win32'
            });

            log(`Spawned build process (PID: ${buildProcess.pid})`);

            buildProcess.on('error', (err) => {
                logError(`Build process error:`, err);
            });

            buildProcess.on('close', (code) => {
                log(`Build process exited (Code: ${code})`);
                if (buildProcess && buildProcess.pid === pid) {
                     buildProcess = null;
                }
            });
             const pid = buildProcess.pid; // Store pid after spawning

        } catch (spawnError) {
            logError(`Failed to spawn build process:`, spawnError);
             buildProcess = null;
        }
    });
}

// --- File Watching ---

function setupWatchers() {
    log('Setting up file watchers...');
    WATCH_TARGETS.forEach(target => {
        const targetPath = path.resolve(projectRoot, target);
        if (!fs.existsSync(targetPath)) {
            logWarn(`Watch target not found: "${target}", skipping.`);
            return;
        }

        log(`Watching: "${path.relative(projectRoot, targetPath)}"`);
        try {
            const watcher = fs.watch(targetPath, { recursive: true }, (eventType, filename) => {
                const fullPath = filename ? path.join(targetPath, filename) : targetPath;
                const relativePath = path.relative(projectRoot, fullPath);

                if (relativePath.startsWith('dist') ||
                    relativePath.startsWith('node_modules') ||
                    relativePath.startsWith('.git') ||
                    relativePath.endsWith('___') ||
                    relativePath.endsWith('~')) {
                    return;
                }

                log(`Change detected: ${eventType} in "${relativePath}"`);
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(startBuildServe, DEBOUNCE_DELAY);
            });

            watcher.on('error', (err) => {
                 logError(`Watcher error for "${targetPath}":`, err);
            });
            watchers.push(watcher);

        } catch (error) {
            logError(`Failed to set up watch for "${targetPath}":`, error);
        }
    });
    if (watchers.length > 0) {
         logSuccess(`Watcher active on ${watchers.length} target(s).`); // <-- This line caused the error
    } else {
         logError("No watchers could be set up. Exiting.");
         process.exit(1);
    }
}

// --- Initial Run & Cleanup ---

function cleanup() {
    log('\nShutting down...');
     watchers.forEach(watcher => watcher.close());
     watchers = [];
    killCurrentProcess(() => {
         log("Cleanup complete. Exiting.");
        process.exit(0);
    });
     setTimeout(() => {
          logWarn("Forcing exit after cleanup timeout.");
          process.exit(1);
     }, 5000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// --- Start ---
startBuildServe();
setupWatchers();
log('Ready! Waiting for file changes...');
log('Press CTRL+C to stop.');