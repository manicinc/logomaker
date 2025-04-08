/**
 * scripts/dev.js (v3.5 - Serve Built Deploy Dir, Fix Restarts, Open Browser)
 * Manages the local development environment.
 * - Runs 'deploy' build on start and on change (using build.js v3.9 - NO base href).
 * - Serves the 'dist/github-pages' directory.
 * - Attempts to robustly kill old server and wait for port before starting new one.
 * - Opens browser automatically.
 * WARNING: The build output created/served here is NOT configured for /logomaker/ deployment path.
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const chokidar = require('chokidar');
const net = require('net');

// --- Configuration ---
const projectRoot = path.resolve(__dirname, '..');
const WATCH_TARGETS_DEV = [
    'index.template.html', 'index-portable.template.html',
    'js/**/*.js', 'css/**/*.css', 'assets/**/*', 'fonts/**/*.*'
];
const IGNORE_PATTERNS_WATCHER = [
    /(^|[\\\/])\../, 'node_modules/**', 'dist/**', 'scripts/**',
    'font-chunks/**', 'inline-fonts-data.js', 'fonts.json',
    /css[\\\/]generated-font-classes\.css$/,
    'logomaker-portable.html', 'release/**', '*.log', '**/*.tmp', '**/*~',
];
const BUILD_SCRIPT_PATH = path.resolve(__dirname, 'build.js');
const FONT_SCRIPT_PATH = path.resolve(__dirname, 'generate-fonts-json.js'); // Although build.js calls this
const NODE_COMMAND = 'node';
const DEPLOY_TARGET = 'deploy'; // Dev mode simulates deploy build output structure
const DIST_DIR_TO_SERVE = path.join(projectRoot, 'dist', 'github-pages'); // Serve the deploy output
const SERVER_COMMAND = 'npx';
// --- Args including '-o' and pointing to DIST_DIR_TO_SERVE ---
const SERVER_ARGS = ['http-server', DIST_DIR_TO_SERVE, '-p', '', '--cors', '-c-1', '-o'];
const DEFAULT_DEV_PORT = 3000;
const SKIP_FONT_REGEN_ARG = '--skip-font-regen';
const DEBOUNCE_DELAY = 500;
const SERVER_KILL_DELAY = 500; // ms delay after kill attempt

// --- Script State ---
let serverProcess = null;
let watcher = null;
let debounceTimeout = null;
let isProcessingChange = false;
let needsFontRebuild = true; // Assume initial font gen is needed by build.js
let currentMode = 'dev'; // Fixed for this script
let currentPort = DEFAULT_DEV_PORT;
let buildCounter = 0;

// --- Argument Parsing ---
process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--port=')) {
        const p = parseInt(arg.split('=')[1], 10);
        if (!isNaN(p) && p > 0 && p < 65536) { currentPort = p; console.log(`[INFO] Using custom port: ${p}`); }
        else { console.warn(`[WARN] Invalid port: ${arg}. Using default ${DEFAULT_DEV_PORT}.`); }
    }
});

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
        server.listen(port, '0.0.0.0');
    });
}

// --- Process Management (Returns Promise) ---
async function killProcess(procRef, name) {
    let proc = procRef; if (!proc || proc.killed) { return Promise.resolve(); }
    const pid = proc.pid; log(`Attempting to stop ${name} process (PID: ${pid})...`);
    return new Promise((resolve) => {
        let killed = false; const timeout = setTimeout(() => { if (!killed) { logWarn(`Force killing ${name} PID ${pid} via SIGKILL (timeout).`); try { if (process.platform === 'win32') { spawn('taskkill', ['/PID', pid, '/F', '/T'], { detached: true, stdio: 'ignore' }); } else { process.kill(pid, 'SIGKILL'); } } catch (e) { logError(`Force kill failed for ${name} PID ${pid}:`, e); } killed = true; resolve(); } }, 3000);
        proc.once('exit', (code, signal) => { clearTimeout(timeout); if (!killed) { logInfo(`${name} process PID ${pid} exited (Code: ${code}, Sig: ${signal}).`); killed = true; resolve(); } });
        proc.once('error', (err) => { logWarn(`Error from ${name} PID ${pid} during kill: ${err.message}`); clearTimeout(timeout); if (!killed) { killed = true; resolve(); } });
        try { if (process.platform === 'win32') { process.kill(pid, 'SIGTERM');} else { process.kill(pid, 'SIGTERM'); } } catch (e) { logWarn(`Initial SIGTERM failed for ${name} PID ${pid}: ${e.message}. Timeout will force kill.`); }
    });
}

// Check Port and Kill Tracked Process if Necessary
async function checkPortAndKill(port) {
    if (await isPortInUse(port)) {
        logWarn(`Port ${port} is in use. Attempting kill...`);
        if (serverProcess) { await killProcess(serverProcess, 'Server'); serverProcess = null; }
        else { logError(`Cannot auto-kill process on port ${port} - no process tracked. Waiting...`); }
        logInfo(`Waiting ${SERVER_KILL_DELAY}ms for port ${port} to free up...`);
        await new Promise(resolve => setTimeout(resolve, SERVER_KILL_DELAY));
        if (await isPortInUse(port)) { logError(`Port ${port} STILL in use. Manual intervention may be required.`); return false; }
    } return true;
}

// --- HTTP Server (Async with Kill Wait) ---
async function startHttpServer() {
    const directory = DIST_DIR_TO_SERVE; const port = currentPort;
    const portIsFree = await checkPortAndKill(port);
    if (!portIsFree) { logError("Cannot start server: Port busy."); return; }
    serverProcess = null; // Ensure cleared

    logAction(`>>> Starting http-server...`); logInfo(`>>> Serving directory: ${directory}`);
    if (!fs.existsSync(directory) || !fs.existsSync(path.join(directory, 'index.html'))) { logError(`Cannot start: Dir ${directory} or index.html not found. Run build first.`); return; }

    const finalServerArgs = [...SERVER_ARGS]; finalServerArgs[3] = String(port);
    logInfo(`>>> Spawning: ${SERVER_COMMAND} ${finalServerArgs.join(' ')}`);
    try {
        const spawnOptions = { stdio: 'inherit', cwd: projectRoot, shell: process.platform === 'win32', detached: process.platform !== 'win32' };
        const spawned = spawn(SERVER_COMMAND, finalServerArgs, spawnOptions); serverProcess = spawned;
        if (!spawned || !spawned.pid) { serverProcess = null; throw new Error("Spawned server has no PID."); }
        logSuccess(`>>> Spawned server (PID: ${spawned.pid}) - Opening http://localhost:${port}`); // Browser opens root
        spawned.on('error', (err) => { logError(`>>> Server (PID: ${spawned?.pid}) error:`, err); if (err.code === 'EADDRINUSE') { logError(`Port ${port} conflict!`); } if (serverProcess && serverProcess.pid === spawned?.pid) serverProcess = null; });
        spawned.on('close', (code, signal) => { if (serverProcess && serverProcess.pid === spawned?.pid) { logWarn(`>>> Server (PID: ${spawned.pid}) exited (Code: ${code}, Sig: ${signal})`); serverProcess = null; } });
    } catch (e) { logError(">>> CRITICAL ERROR spawning server:", e); serverProcess = null; }
}

// --- Build Execution (Sync, always runs deploy target) ---
function runBuild(skipFontRegen = false) {
    // No need to track buildProcess globally if using spawnSync
    logAction(`>>> Starting Build (Target: ${DEPLOY_TARGET})...`);
    const buildArgs = [`--target=${DEPLOY_TARGET}`];
    let performFontRegen = !skipFontRegen && needsFontRebuild; // Decide based on flag and state

    if (skipFontRegen || !needsFontRebuild) {
        buildArgs.push(SKIP_FONT_REGEN_ARG); logInfo("Build will skip font regeneration.");
        performFontRegen = false; // Ensure flag matches action
    } else {
        logInfo("Build includes font regeneration.");
        // needsFontRebuild = true; // Not needed, will be reset on success
    }

    const result = spawnSync(NODE_COMMAND, [BUILD_SCRIPT_PATH, ...buildArgs], {
        stdio: 'inherit', cwd: projectRoot, shell: process.platform === 'win32'
    });

    if (result.status === 0 && !result.error) {
        logSuccess('Build complete.');
        if (performFontRegen) { // Only reset if fonts were ACTUALLY generated this run
            needsFontRebuild = false;
            logInfo("[State] Reset needsFontRebuild=false.");
        }
        return true; // Success
    } else {
        logError('Build failed.', result.error || `Exit code: ${result.status}`);
        needsFontRebuild = true; // Always set true on failure
        logWarn("[State] Set needsFontRebuild=true (build failure).");
        return false; // Failure
    }
}

// --- File Watching ---
function setupWatcher() {
    if (watcher) return; log('Setting up file watchers using chokidar...');
    const watchPaths = WATCH_TARGETS_DEV.map(p => path.join(projectRoot, p));
    try {
        watcher = chokidar.watch(watchPaths, { ignored: IGNORE_PATTERNS_WATCHER, persistent: true, ignoreInitial: true, atomic: true, awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 } });
        const handleChange = async (eventPath) => {
            const relativePath = path.relative(projectRoot, eventPath); logTrace(`Chokidar event: path='${relativePath}'`);
            if (isProcessingChange) { logTrace(`Skipping change - already processing.`); return; }
            isProcessingChange = true; log(`Change detected: "${relativePath}"`);

            const isFontChange = relativePath.startsWith('fonts' + path.sep);
            if (isFontChange && !needsFontRebuild) { logWarn("Font change! Marking for font rebuild."); needsFontRebuild = true; } // Mark if fonts change

            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(async () => {
                logInfo(`Debounce expired -> Triggering build & server restart...`);
                // Run build, skip font regen ONLY if needsFontRebuild is false
                const buildOk = runBuild(!needsFontRebuild);

                if (buildOk) { await startHttpServer(); } // Await server restart
                else { logError("Build failed, server not restarted."); }
                isProcessingChange = false;
            }, DEBOUNCE_DELAY);
        };
        watcher.on('add', handleChange).on('change', handleChange).on('unlink', handleChange)
               .on('error', error => logError(`Watcher error: ${error}`))
               .on('ready', () => logSuccess(`Watcher ready.`));
    } catch (watcherError) { logError("CRITICAL ERROR setting up watcher:", watcherError); logWarn("File watching will not function."); }
}

// --- Cleanup ---
async function cleanup() {
    log('\nShutting down...');
    process.off('SIGINT', cleanup); process.off('SIGTERM', cleanup);
    if(debounceTimeout) { clearTimeout(debounceTimeout); logInfo("Cleared debounce timer."); }
    try {
        if (watcher) { await watcher.close(); logInfo("Watcher closed."); }
        await killProcess(serverProcess, 'Server'); // Wait for server kill
        logSuccess("Cleanup complete. Exit."); process.exit(0);
    } catch(err) { logError("Error during cleanup:", err); process.exit(1); }
    setTimeout(() => { logWarn("Cleanup timeout reached. Forcing exit."); process.exit(1); }, 5000);
}
process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);

// --- Start the Process ---
async function main() {
    // Check/Kill port before doing anything else
    const portIsFree = await checkPortAndKill(currentPort);
    if (!portIsFree) { logError(`Initial port check failed. Port ${currentPort} seems blocked. Exiting.`); process.exit(1); }

    log(`Initializing Logomaker environment [DEV_SERVE_DIST] mode...`);
    log(`Building DEPLOY target and serving: ${DIST_DIR_TO_SERVE}`);
    log(`Server Port: ${currentPort}`);
    logWarn("WARNING: This dev mode builds & serves output created for deployment.");
    logWarn("Ensure build.js does NOT add base href for local preview to work.");
    logWarn("The deployed GitHub Pages site WILL be broken with this setup's output.");
    log("---------------------------------------------------------------------");

    log("Running initial build...");
    const initialBuildOk = runBuild(false); // Run initial full deploy build (includes fonts)

    if (initialBuildOk) {
        log("Initial build successful. Starting server and watchers...");
        await startHttpServer(); // Start server serving build output dir
        setupWatcher(); // <<<< CALL IS CORRECT HERE (SINGULAR)
        log('Ready! Watching files...'); log('Press CTRL+C to stop.');
    } else {
        logError("Initial build failed. Server and watchers not started.");
        process.exit(1);
    }
}

// Execute main function
main().catch(err => {
    logError("Unhandled error during startup:", err);
    process.exit(1);
});