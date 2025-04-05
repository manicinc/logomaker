/**
 * scripts/dev.js (v1.6 - Functional Version)
 * Development Watcher for Logomaker - Manages Both Build & Server
 * Uses Node's built-in `fs.watch`. Assumes `scripts/build.js` is correctly implemented.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// --- Configuration ---
const projectRoot = path.resolve(__dirname, '..');
const WATCH_TARGETS = ['index.html', 'js', 'css', 'fonts'];
const GENERATED_CSS_FILENAME = 'generated-font-classes.css';
const GENERATED_CSS_RELPATH = path.join('css', GENERATED_CSS_FILENAME);
const IGNORE_PATTERNS_IN_CALLBACK = [
    path.join('dist', ''), path.join('node_modules', ''), path.join('.git', ''),
    path.join('scripts', ''), path.join('font-chunks', ''),
    'inline-fonts-data.js', 'fonts.json', GENERATED_CSS_RELPATH,
    'logomaker-portable.html', '.DS_Store', 'Thumbs.db', 'desktop.ini', '___', '~$'
];
const BUILD_COMMAND = 'node';
const BASE_BUILD_ARGS = ['scripts/build.js']; // Assumes build.js is fixed!
const TARGET_TO_SERVE = 'deploy'; // Default, change if needed
const BUILD_TARGET_ARG = `--target=${TARGET_TO_SERVE}`;
const SERVER_COMMAND = 'npx';
const SERVER_PORT = 3000;
const SERVER_ARGS = ['http-server', '', '-p', SERVER_PORT, '-o', '--cors', '-c-1'];
const SKIP_FONT_REGEN_ARG = '--skip-font-regen';
const DEBOUNCE_DELAY = 500;

// --- Script State ---
let buildProcess = null;
let serverProcess = null;
let debounceTimeout = null;
let needsFontRebuild = true;
let watchers = [];
let isHandlingChange = false;

// --- Determine Serve Path ---
const GITHUB_PAGES_SUBDIR = 'github-pages';
const PORTABLE_SUBDIR = 'portable';
const servePath = path.resolve(projectRoot, 'dist', TARGET_TO_SERVE === 'deploy' ? GITHUB_PAGES_SUBDIR : PORTABLE_SUBDIR);

// --- Logging Helpers ---
const log = (msg) => console.log(`[DEV] ${msg}`);
const logWarn = (msg) => console.warn(`[DEV] [WARN] ${msg}`);
const logError = (msg, err) => console.error(`[DEV] [ERROR] ${msg}`, err || '');
const logAction = (msg) => console.log(`\n✨ ${msg} ✨`);
const logSuccess = (msg) => console.log(`[DEV] ✅ ${msg}`);
const logInfo = (msg) => console.log(`[DEV INFO] ${msg}`);
const logTrace = (msg) => console.log(`[DEV TRACE] ${msg}`);

// --- Process Management ---
function killProcess(proc, name, callback) {
    if (!proc || proc.killed) { if (callback) process.nextTick(callback); return; }
    const pid = proc.pid;
    log(`Stopping ${name} process (PID: ${pid})...`);
    let killed = false;
    const killCleanup = () => {
        if (!killed) {
            killed = true;
            if (name === 'Build' && buildProcess && buildProcess.pid === pid) buildProcess = null;
            if (name === 'Server' && serverProcess && serverProcess.pid === pid) serverProcess = null;
            if (callback) process.nextTick(callback);
        }
    };
    proc.once('exit', killCleanup);
    proc.once('error', (err) => { logWarn(`Error emitted by ${name} (PID: ${pid}) during kill: ${err.message}`); killCleanup(); });
    try {
        if (process.platform === 'win32') { spawn('taskkill', ['/PID', pid, '/F', '/T'], { detached: true, stdio: 'ignore' }).on('error', () => { try { if (proc && !proc.killed) proc.kill('SIGTERM'); } catch (e) {} }); }
        else { try { process.kill(-pid, 'SIGTERM'); } catch (e) { try { if (proc && !proc.killed) process.kill(pid, 'SIGTERM'); } catch (e2) {} } }
    } catch (e) { logWarn(`Error sending SIGTERM to ${name} (PID: ${pid}): ${e.message}.`); }
    setTimeout(() => {
        if (!killed && proc && !proc.killed) {
            logWarn(`Force killing ${name} process ${pid} via SIGKILL (timeout).`);
            try { if (process.platform === 'win32') { spawn('taskkill', ['/PID', pid, '/F', '/T'], { detached: true, stdio: 'ignore' }); } else { process.kill(pid, 'SIGKILL'); } }
            catch (e) { logError(`Force kill failed for ${name} (PID ${pid}):`, e); }
        }
        killCleanup();
    }, 3000);
}

function killAllProcesses(callback) {
    logInfo('Stopping all managed processes...');
    killProcess(serverProcess, 'Server', () => {
        killProcess(buildProcess, 'Build', () => {
            logInfo("All managed processes stop attempts initiated.");
            if (callback) callback();
        });
    });
}

function startServer() {
    if (serverProcess && !serverProcess.killed) { logWarn("Server already running."); return; }
    logAction(`>>> Starting server for target: ${TARGET_TO_SERVE}...`);
    logInfo(`>>> Serving directory: ${servePath}`);
    if (!fs.existsSync(servePath)) { logError(`Cannot start server: Directory not found: ${servePath}`); return; }
    const finalServerArgs = [...SERVER_ARGS]; finalServerArgs[1] = servePath;
    logInfo(`>>> Spawning Server: ${SERVER_COMMAND} ${finalServerArgs.join(' ')}`);
    try {
        serverProcess = spawn(SERVER_COMMAND, finalServerArgs, { stdio: 'inherit', shell: true, cwd: projectRoot });
        const pid = serverProcess.pid; if (!pid) throw new Error("Spawned server process has no PID.");
        logSuccess(`>>> Spawned server process (PID: ${pid}) - Access at http://localhost:${SERVER_PORT}`);
        serverProcess.on('error', (err) => { logError(`>>> Server (PID: ${pid}) error:`, err); if (serverProcess && serverProcess.pid === pid) serverProcess = null; });
        serverProcess.on('close', (code, signal) => { logWarn(`>>> Server (PID: ${pid}) exited (Code: ${code}, Signal: ${signal})`); if (serverProcess && serverProcess.pid === pid) serverProcess = null; });
    } catch (e) { logError(">>> Error spawning server process:", e); serverProcess = null; }
}

function startBuild(forceFontRebuild = false) {
    killProcess(buildProcess, 'Build', () => { // Kill previous build first
        if (buildProcess && !buildProcess.killed) { logWarn("Build already in progress after kill attempt. Skipping trigger."); return; }

        const shouldBuildFonts = forceFontRebuild || needsFontRebuild;
        const buildArgs = [...BASE_BUILD_ARGS, BUILD_TARGET_ARG];
        logInfo(`startBuild called. forceFontRebuild=${forceFontRebuild}, needsFontRebuild=${needsFontRebuild}, calculated shouldBuildFonts=${shouldBuildFonts}`);
        if (!shouldBuildFonts) { buildArgs.push(SKIP_FONT_REGEN_ARG); logAction(`Starting build (${TARGET_TO_SERVE} target, Skipping Font Regen)... (${new Date().toLocaleTimeString()})`); }
        else { logAction(`Starting build (${TARGET_TO_SERVE} target, Forcing Font Regen)... (${new Date().toLocaleTimeString()})`); }
        logInfo(`Spawning Build: ${BUILD_COMMAND} ${buildArgs.join(' ')} (NO shell, piping stdio)`);

        try {
            // Spawn build.js WITHOUT shell, pipe stdio to capture its output
            buildProcess = spawn(BUILD_COMMAND, buildArgs, { stdio: 'pipe', cwd: projectRoot });
            const pid = buildProcess.pid; if (!pid) throw new Error("Spawned build process has no PID.");
            log(`Spawned build process (PID: ${pid})`);

            let buildStderr = ''; // Capture stderr
            if (buildProcess.stdout) { buildProcess.stdout.on('data', (data) => log(`[Build ${pid} OUT] ${data.toString().trim()}`)); }
            else { logWarn(`[Build ${pid}] No stdout stream available.`); }
            if (buildProcess.stderr) { buildProcess.stderr.on('data', (data) => { buildStderr += data.toString(); logError(`[Build ${pid} ERR] ${data.toString().trim()}`); }); }
            else { logWarn(`[Build ${pid}] No stderr stream available.`); }

            buildProcess.on('error', (err) => { logError(`Build process (PID: ${pid}) SPAWN error:`, err); if (buildProcess && buildProcess.pid === pid) buildProcess = null; logWarn("Setting needsFontRebuild=true due to build process SPAWN error."); needsFontRebuild = true; });
            buildProcess.on('close', (code, signal) => {
                const currentPid = pid;
                logInfo(`Build process (PID: ${currentPid}) exited (Code: ${code}, Signal: ${signal}).`);
                if (buildStderr.includes('[DEV] Initializing development environment')) { logError("!!! BUILD SCRIPT IS STILL RUNNING DEV LOGIC !!!"); } // Check added

                if (buildProcess && buildProcess.pid === currentPid) { buildProcess = null; }
                else if (buildProcess) { logWarn(`Newer build active. Ignoring close for PID ${currentPid}.`); return; }

                if (code === 0) { // Build SUCCESSFUL
                    if (shouldBuildFonts) { logInfo("Build OK (font regen). Resetting needsFontRebuild=false."); needsFontRebuild = false; }
                    else { logInfo(`Build OK (no font regen). needsFontRebuild=${needsFontRebuild}.`); }
                    logSuccess(`Build successful for ${TARGET_TO_SERVE}. Restarting server...`);
                    killProcess(serverProcess, 'Server', () => { logInfo("Starting server..."); startServer(); }); // Restart server
                } else { // Build FAILED
                    logError(`Build failed (Code: ${code}, Signal: ${signal}). Server not started/restarted.`);
                    if (buildStderr.toLowerCase().includes('permission denied')) { logError("Permission error detected in build."); }
                    if (code !== 0) { logWarn("Setting needsFontRebuild=true due to build failure."); needsFontRebuild = true; }
                }
            });
        } catch (spawnError) { logError(`Error spawning build:`, spawnError); buildProcess = null; logWarn("Setting needsFontRebuild=true (spawn error)."); needsFontRebuild = true; }
    });
}

// --- File Watching ---
function handleFileChange(eventType, targetDirAbs, filename) {
    logTrace(`handleFileChange: event='${eventType}', dir='${path.basename(targetDirAbs)}', file='${filename || 'N/A'}'`);
    if (isHandlingChange) { logTrace("Skipping: Already handling change."); return; }
    isHandlingChange = true;
    const changedItemAbs = filename ? path.join(targetDirAbs, filename) : targetDirAbs;
    const relativePath = path.relative(projectRoot, changedItemAbs);
    if (filename && filename === GENERATED_CSS_FILENAME && relativePath === GENERATED_CSS_RELPATH) { logTrace(`Ignoring event explicitly for generated CSS file: ${relativePath}`); isHandlingChange = false; return; }
    const lowerRelativePath = relativePath.toLowerCase();
    if (IGNORE_PATTERNS_IN_CALLBACK.some(pattern => { const p = pattern.toLowerCase(); return lowerRelativePath === p || lowerRelativePath.startsWith(p + path.sep); })) { logTrace(`Ignoring change in "${relativePath}" due to pattern match.`); isHandlingChange = false; return; }
    const fontsDirAbs = path.resolve(projectRoot, 'fonts');
    const isFontChange = changedItemAbs.startsWith(fontsDirAbs + path.sep);
    log(`Change detected: ${eventType} in "${relativePath}" (isFontChange: ${isFontChange})`);
    if (isFontChange) { if (!needsFontRebuild) { logWarn("Font dir change! Font rebuild required."); } needsFontRebuild = true; }
    logInfo(`needsFontRebuild state = ${needsFontRebuild}`);
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => { logInfo(`Debounce timeout -> Calling startBuild.`); startBuild(false); isHandlingChange = false; }, DEBOUNCE_DELAY);
}

function setupWatchers() {
    log('Setting up file watchers using fs.watch...');
    let targetsProcessed = 0;
    watchers.forEach(w => { try { w.close(); } catch (e) {} }); watchers = [];
    WATCH_TARGETS.forEach(target => {
        const targetPathAbs = path.resolve(projectRoot, target);
        if (!fs.existsSync(targetPathAbs)) { logWarn(`Watch target not found: "${target}", skipping.`); return; }
        try {
            const isDir = fs.statSync(targetPathAbs).isDirectory();
            const relativeTargetPath = path.relative(projectRoot, targetPathAbs);
            log(`Watching: "${relativeTargetPath}" ${isDir ? '(Recursive)' : ''}`);
            const watcher = fs.watch(targetPathAbs, { recursive: isDir }, (eventType, filename) => handleFileChange(eventType, targetPathAbs, filename));
            watcher.on('error', (err) => logError(`Watcher error for "${relativeTargetPath}":`, err));
            watchers.push(watcher); targetsProcessed++;
        } catch (error) { logError(`Failed to watch "${target}":`, error); }
    });
    if (targetsProcessed > 0) { logSuccess(`Watcher active on ${targetsProcessed} target(s). Note: fs.watch reliability varies.`); }
    else { logError("No watchers started. Exiting."); process.exit(1); }
}

// --- Initial Run & Cleanup ---
function cleanup() {
    log('\nShutting down...');
    process.off('SIGINT', cleanup); process.off('SIGTERM', cleanup);
    if (watchers.length > 0) { logInfo(`Closing ${watchers.length} watchers...`); watchers.forEach(w => { try { w.close(); } catch (e) {} }); watchers = []; logInfo("Watchers closed."); } else { logInfo("No active watchers."); }
    if(debounceTimeout) { clearTimeout(debounceTimeout); logInfo("Cleared debounce timer."); }
    killAllProcesses(() => { logSuccess("Cleanup complete. Exiting."); process.exit(0); });
    setTimeout(() => { logWarn("Forcing exit after cleanup timeout."); process.exit(1); }, 5000);
}
process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);

// --- Start the Development Process ---
log("Initializing development environment (Build -> Serve)...");
log(`Configured to serve target: '${TARGET_TO_SERVE}' from path: '${servePath}'`);
setupWatchers(); // Setup watchers first
startBuild(true); // Run initial build (forcing font regen)
log('Ready! Waiting for file changes...');
log(`Will serve '${TARGET_TO_SERVE}' target from '${servePath}' on port ${SERVER_PORT} after successful builds.`);
log('Press CTRL+C in this terminal to stop.');