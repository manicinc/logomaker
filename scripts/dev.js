/**
 * scripts/dev.js (v2.4 - Added spawn logging)
 * Uses package.json, chokidar, http-server
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const chokidar = require('chokidar'); // Use chokidar

// --- Configuration ---
const projectRoot = path.resolve(__dirname, '..');
const WATCH_TARGETS_DEV = [ // Paths relative to projectRoot for chokidar
    'index.html',
    'js/**/*.js',
    'css/**/*.css',
    'fonts/**/*.*' // Watch all files within fonts recursively
];
const GENERATED_CSS_FILENAME = 'generated-font-classes.css';
// More robust ignore patterns for chokidar
const IGNORE_PATTERNS_WATCHER = [
    /(^|[\\\/])\../, // Hidden files/dirs (handles both slashes)
    'node_modules/**', // Ignore node_modules using glob pattern
    'dist/**',
    'scripts/**',
    'font-chunks/**',
    'inline-fonts-data.js',
    'fonts.json',
    // Explicitly ignore the generated CSS file using a pattern that should match both slash types
    /css[\\\/]generated-font-classes\.css$/,
    'logomaker-portable.html',
    '**/*.tmp',
    '**/*~',
];
const BUILD_COMMAND = 'node';
const BASE_BUILD_ARGS = ['scripts/build.js'];
const TARGET_TO_BUILD = 'deploy';
const BUILD_TARGET_ARG = `--target=${TARGET_TO_BUILD}`;
const SERVER_COMMAND = 'npx'; // Or just 'http-server' if PATH is set
const SERVER_ARGS = ['http-server', '', '-p', '', '-o', '--cors', '-c-1'];
const DEFAULT_DEV_PORT = 3000;
const DEFAULT_PROD_PREVIEW_PORT = 3001;
const SKIP_FONT_REGEN_ARG = '--skip-font-regen';
const DEBOUNCE_DELAY = 500; // milliseconds

// --- Script State ---
let buildProcess = null;
let serverProcess = null;
let watcherInstance = null;
let debounceTimeout = null;
let needsFontRebuild = true; // Start true for initial build
let isHandlingChange = false;
let currentMode = 'dev';
let currentPort = DEFAULT_DEV_PORT;
let buildCounter = 0; // To track build attempts

// --- Argument Parsing ---
const args = process.argv.slice(2);
args.forEach(arg => {
    if (arg === '--mode=prod-preview') { currentMode = 'prod-preview'; currentPort = DEFAULT_PROD_PREVIEW_PORT; console.log("[INFO] Running in Production Preview mode."); }
    else if (arg.startsWith('--port=')) { const p=parseInt(arg.split('=')[1],10); if(!isNaN(p)&&p>0&&p<65536){currentPort=p; console.log(`[INFO] Using custom port: ${p}`);} else {console.warn(`[WARN] Invalid port: ${arg}. Using default.`);} }
});

// --- Determine Serve Path ---
const GITHUB_PAGES_SUBDIR = 'github-pages'; const PORTABLE_SUBDIR = 'portable';
const serveSubDir = TARGET_TO_BUILD === 'deploy' ? GITHUB_PAGES_SUBDIR : PORTABLE_SUBDIR;
const servePath = path.resolve(projectRoot, 'dist', serveSubDir);

// --- Logging Helpers ---
const log = (msg) => console.log(`[${currentMode.toUpperCase()}] ${msg}`);
const logWarn = (msg) => console.warn(`[${currentMode.toUpperCase()}] [WARN] ${msg}`);
const logError = (msg, err) => console.error(`[${currentMode.toUpperCase()}] [ERROR] ${msg}`, err || '');
const logAction = (msg) => console.log(`\n✨ ${msg} ✨`);
const logSuccess = (msg) => console.log(`[${currentMode.toUpperCase()}] ✅ ${msg}`);
const logInfo = (msg) => console.log(`[${currentMode.toUpperCase()} INFO] ${msg}`);
const logTrace = (msg) => console.log(`[${currentMode.toUpperCase()} TRACE] ${msg}`);


// --- Process Management ---
function killProcess(procRef, name, callback) {
    let proc = procRef; // Work with the reference
    if (!proc || proc.killed) { if (callback) process.nextTick(callback); return; }

    const pid = proc.pid;
    log(`Stopping ${name} process (PID: ${pid})...`);
    let killed = false;

    const killCleanup = () => {
        if (!killed) {
            killed = true;
            // Clear the global reference ONLY if it still matches the PID we tried to kill
            if (name === 'Build' && buildProcess && buildProcess.pid === pid) buildProcess = null;
            if (name === 'Server' && serverProcess && serverProcess.pid === pid) serverProcess = null;
            logInfo(`${name} process ${pid} stop attempt finished.`);
            if (callback) process.nextTick(callback);
        }
    };

    proc.once('exit', killCleanup);
    proc.once('error', (err) => { logWarn(`Error from ${name} (PID: ${pid}) during kill: ${err.message}`); killCleanup(); });

    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/PID', pid, '/F', '/T'], { detached: true, stdio: 'ignore' })
                 .on('error', (err) => { logWarn(`taskkill failed for ${name} PID ${pid}: ${err.message}. Trying SIGTERM...`); try { if(proc && !proc.killed) process.kill(pid, 'SIGTERM'); } catch (e) {} });
        } else {
           try { if(proc && !proc.killed) process.kill(-pid, 'SIGTERM'); } // Kill group first
           catch(e) { logWarn(`Group kill failed for ${name} PID -${pid}, trying single PID ${pid}...`); try { if(proc && !proc.killed) process.kill(pid, 'SIGTERM'); } catch(e2) {} }
        }
    } catch (e) { logWarn(`Error sending SIGTERM to ${name} (PID: ${pid}): ${e.message}.`); }

    setTimeout(() => {
        if (!killed && proc && !proc.killed) {
            logWarn(`Force killing ${name} process ${pid} via SIGKILL (timeout).`);
            try {
                if (process.platform === 'win32') { spawn('taskkill', ['/PID', pid, '/F', '/T'], { detached: true, stdio: 'ignore' }); }
                else { if(proc && !proc.killed) process.kill(pid, 'SIGKILL'); }
            } catch (e) { logError(`Force kill failed for ${name} (PID ${pid}):`, e); }
            setTimeout(killCleanup, 100); // Ensure cleanup runs
        } else { killCleanup(); } // Already dead or gone
    }, 3000); // 3 sec timeout
}


// --- HTTP Server using http-server ---
function startHttpServer(directory, port, callback) {
    killProcess(serverProcess, 'Server', () => { // Use the generic killProcess
        logAction(`>>> Starting http-server...`);
        logInfo(`>>> Serving directory: ${directory}`);
        if (!fs.existsSync(directory)) { logError(`Cannot start: Dir not found: ${directory}`); if (callback) callback(new Error(`Dir ${directory} not found.`)); return; }

        const finalServerArgs = [...SERVER_ARGS]; finalServerArgs[1] = directory; finalServerArgs[3] = String(port);
        logInfo(`>>> Spawning: ${SERVER_COMMAND} ${finalServerArgs.join(' ')}`);

        try {
            const spawnOptions = { stdio: 'inherit', cwd: projectRoot, shell: process.platform === 'win32', detached: process.platform !== 'win32' };
            const spawned = spawn(SERVER_COMMAND, finalServerArgs, spawnOptions);
            serverProcess = spawned; // Assign to global reference

            if (!spawned.pid) throw new Error("Spawned server has no PID.");
            logSuccess(`>>> Spawned server (PID: ${spawned.pid}) - Access at http://localhost:${port}`);

            spawned.on('error', (err) => {
                 logError(`>>> Server (PID: ${spawned.pid}) spawn error:`, err);
                 if (err.message.includes('EADDRINUSE')) { logError(`Port ${port} in use.`); }
                 if (serverProcess && serverProcess.pid === spawned.pid) serverProcess = null;
                 if (callback) callback(err);
            });
            spawned.on('close', (code, signal) => {
                // Only log warning if it was the currently tracked process exiting unexpectedly
                if (serverProcess && serverProcess.pid === spawned.pid) {
                    logWarn(`>>> Server (PID: ${spawned.pid}) exited unexpectedly (Code: ${code}, Sig: ${signal})`);
                    serverProcess = null; // Clear the reference
                } else {
                    logInfo(`>>> Server (PID: ${spawned.pid}) exited (Code: ${code}, Sig: ${signal}) - Likely intentional stop or replaced.`);
                }
            });
            // Assume http-server starts quickly or errors out fast (like EADDRINUSE)
            if (callback) setTimeout(() => callback(null), 500); // Assume success shortly after spawn

        } catch (e) { logError(">>> Error spawning server:", e); serverProcess = null; if (callback) callback(e); }
    });
}

// --- Build Execution ---
function startBuild(forceFontRebuild = false) {
   // Prevent starting a new build if one is already running
   if (buildProcess && !buildProcess.killed) {
       logWarn(`Build already in progress (PID: ${buildProcess.pid}). Skipping trigger.`);
       return;
   }

   killProcess(buildProcess, 'Build', () => { // Kill any *previous* defunct build process first
       // Ensure buildProcess is null before starting new one
       buildProcess = null;

       buildCounter++; // Increment build counter
       const currentBuildNum = buildCounter;

       let shouldBuildFonts = currentMode === 'prod-preview' || forceFontRebuild || needsFontRebuild;
       const buildArgs = [...BASE_BUILD_ARGS, BUILD_TARGET_ARG];
       logInfo(`[Build #${currentBuildNum}] Start trigger: force=${forceFontRebuild}, needs=${needsFontRebuild}, should=${shouldBuildFonts}`);

       if (!shouldBuildFonts) { buildArgs.push(SKIP_FONT_REGEN_ARG); logAction(`[Build #${currentBuildNum}] Starting (Skip Font Regen)... (${new Date().toLocaleTimeString()})`); }
       else { logAction(`[Build #${currentBuildNum}] Starting (${forceFontRebuild ? 'Force' : 'Include'} Font Regen)... (${new Date().toLocaleTimeString()})`); }

       const cmd = BUILD_COMMAND;
       const args = buildArgs;
       logInfo(`[Build #${currentBuildNum}] Preparing to spawn: ${cmd} ${args.join(' ')}`); // <-- LOG BEFORE SPAWN

       try {
           const spawnOptions = { stdio: 'pipe', cwd: projectRoot };
           const spawned = spawn(cmd, args, spawnOptions);
           // *** Check for immediate errors after spawn attempt ***
           if (!spawned || !spawned.pid) {
               // Handle case where spawn itself failed immediately (e.g., command not found)
               buildProcess = null; // Ensure it's null
               throw new Error(`Failed to spawn build process. Command: ${cmd} ${args.join(' ')}`);
           }
           // *** End Check ***

           buildProcess = spawned; // Assign to global reference *after* successful spawn
           const pid = spawned.pid;
           log(`[Build #${currentBuildNum}] Spawned successfully (PID: ${pid})`); // <-- LOG AFTER SPAWN

           // --- Attach listeners ---
           let buildOutput = ''; let buildErrOutput = '';
            if (spawned.stdout) { spawned.stdout.on('data', (data) => { process.stdout.write(`[Build ${pid} OUT] ${data}`); buildOutput += data; }); }
            if (spawned.stderr) { spawned.stderr.on('data', (data) => { process.stderr.write(`[Build ${pid} ERR] ${data}`); buildErrOutput += data; }); }

           spawned.on('error', (err) => {
               logError(`[Build #${currentBuildNum} / PID ${pid}] SPAWN error event:`, err); // Log the actual error event
               if (buildProcess && buildProcess.pid === pid) buildProcess = null; // Clear if it's the current one
               needsFontRebuild = true; logWarn("[State] Set needsFontRebuild=true (spawn error event).");
           });

           spawned.on('close', (code, signal) => {
               logInfo(`[Build #${currentBuildNum} / PID ${pid}] Exited (Code: ${code}, Sig: ${signal}).`);

               // --- State Management: Only clear buildProcess if this *specific* build finished ---
               if (buildProcess && buildProcess.pid === pid) {
                   buildProcess = null; // This build finished, clear the global reference
                   logInfo(`[State] Cleared tracked build PID ${pid}.`);
               } else if (buildProcess) {
                   logWarn(`[State] Close event for old PID ${pid}, but newer build ${buildProcess.pid} is active. Ignoring.`);
                   return; // Don't modify state based on an old process finishing
               } else {
                   logInfo(`[State] Close event for PID ${pid}, but no build process was tracked. State clean.`);
               }
               // --- End State Management ---

               if (code === 0) { // SUCCESS
                   logSuccess(`[Build #${currentBuildNum}] OK: ${TARGET_TO_BUILD}.`);
                   // *** Reset needsFontRebuild ONLY if this successful build included font regen ***
                   if (shouldBuildFonts) {
                       needsFontRebuild = false;
                       logInfo("[State] Reset needsFontRebuild=false (successful font regen).");
                   } else {
                       logInfo(`[State] Build OK (no font regen). needsFontRebuild remains ${needsFontRebuild}.`);
                   }
                   // --- Start/Restart Server ---
                   if (currentMode === 'dev') { logInfo("Restarting dev server..."); } else { logInfo("Starting/Updating preview server..."); }
                   startHttpServer(servePath, currentPort, (err) => { if (err) logError("Server start/restart failed.", err); });
                   // --- End Server ---
               } else { // FAILURE
                   logError(`[Build #${currentBuildNum}] FAILED (Code: ${code}, Sig: ${signal}). Server not started/restarted.`);
                   // *** Set needsFontRebuild on ANY build failure ***
                   if (!needsFontRebuild) { // Only log/set if it wasn't already true
                       needsFontRebuild = true;
                       logWarn("[State] Set needsFontRebuild=true (build failure).");
                   }
                   // Log specific errors if helpful
                   if (buildErrOutput.toLowerCase().includes('permission denied')) logError("-> Permission error detected.");
                   if (buildErrOutput.includes('split-fonts.js failed')) logError("-> Chunk splitting failed.");
               }
           });
           // --- End listeners ---

       } catch (spawnError) {
            // This catch block handles errors during the spawn() call itself
           logError(`[Build #${currentBuildNum}] Error during spawn attempt:`, spawnError);
           buildProcess = null; // Ensure cleared
           needsFontRebuild = true;
           logWarn("[State] Set needsFontRebuild=true (spawn error).");
       }
   });
}


// --- File Watching (DEV MODE ONLY using chokidar) ---
function setupWatchers() {
    if (currentMode !== 'dev') return;
    log('Setting up file watchers using chokidar...');
    if (watcherInstance) { watcherInstance.close().catch(e => logWarn(`Watcher close err: ${e.message}`)); }

    const watchPaths = WATCH_TARGETS_DEV.map(p => path.join(projectRoot, p));

    try { // Add try-catch around chokidar setup
        watcherInstance = chokidar.watch(watchPaths, {
            ignored: IGNORE_PATTERNS_WATCHER, // Pass the array of strings and RegExp
            persistent: true, ignoreInitial: true, atomic: true,
            awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
        });

        const handleChange = (eventPath) => {
            const relativePath = path.relative(projectRoot, eventPath);
            logTrace(`Chokidar event: path='${relativePath}'`);

            // *** Add check: Do not process event if a build is currently running ***
            if (buildProcess && !buildProcess.killed) {
                logTrace(`Ignoring change event for "${relativePath}" - build process (PID: ${buildProcess.pid}) active.`);
                return;
            }

            // Debounce Check
            if (isHandlingChange) {
                logTrace(`Skipping change event for "${relativePath}" - already processing.`);
                clearTimeout(debounceTimeout); // Reset timer
                debounceTimeout = setTimeout(() => { logInfo(`Debounce expired after burst -> Trigger build.`); startBuild(false); isHandlingChange = false; }, DEBOUNCE_DELAY);
                return;
            }

            // The previous TypeError check is removed as chokidar handles ignores.

            isHandlingChange = true; // Start handling
            log(`Change detected: "${relativePath}"`);

            // *** Refined needsFontRebuild logic inside handler ***
            const isFontChange = relativePath.startsWith('fonts' + path.sep);
            if (isFontChange) {
                if (!needsFontRebuild) { logWarn("Font change detected! Marking for font rebuild."); }
                needsFontRebuild = true; // Mark for rebuild on next build trigger
            } else {
                logInfo(`Non-font change. needsFontRebuild status remains ${needsFontRebuild}.`);
            }

            clearTimeout(debounceTimeout); // Debounce
            debounceTimeout = setTimeout(() => {
                logInfo(`Debounce expired -> Triggering build.`);
                startBuild(false); // startBuild will use the potentially updated needsFontRebuild state
                isHandlingChange = false;
            }, DEBOUNCE_DELAY);
        };

        watcherInstance
            .on('add', handleChange).on('change', handleChange).on('unlink', handleChange)
            .on('error', error => logError(`Watcher error: ${error}`))
            .on('ready', () => logSuccess(`Watcher ready.`)); // This log IS appearing

    } catch (watcherError) {
        logError("CRITICAL ERROR setting up chokidar watcher:", watcherError);
        logWarn("File watching will not function.");
    }
}

// --- Initial Run & Cleanup ---
function cleanup() {
    log('\nShutting down...');
    process.off('SIGINT', cleanup); process.off('SIGTERM', cleanup);
    const watcherPromise = (currentMode === 'dev' && watcherInstance) ? watcherInstance.close().then(()=>logInfo("Watcher closed.")).catch(e=>logWarn(`Watcher close err: ${e.message}`)) : Promise.resolve(logInfo("No watcher active."));
    if(debounceTimeout) { clearTimeout(debounceTimeout); logInfo("Cleared debounce timer."); }
    // Chain cleanup: Watcher -> Server -> Build
    watcherPromise.then(() => { killProcess(serverProcess, 'Server', () => { killProcess(buildProcess, 'Build', () => { logSuccess("Cleanup complete. Exit."); process.exit(0); }); }); });
    setTimeout(() => { logWarn("Force exit after timeout."); process.exit(1); }, 5000);
}
process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);

// --- Start the Process ---
log(`Initializing Logomaker environment in [${currentMode.toUpperCase()}] mode...`);
log(`Build Target: '${TARGET_TO_BUILD}' -> Output Dir: '${servePath}'`); log(`Server Port: ${currentPort}`);
if (currentMode === 'dev') {
   log("Performing initial build...");
   setupWatchers(); // Setup watchers first
   startBuild(true); // Then trigger the initial build
   log('Ready! Server starts after build. Watching files...'); log('Press CTRL+C to stop.');
} else { // prod-preview mode
   log("Performing production build...");
   startBuild(true); // Trigger build, server starts on success
   log(`Build output served from ${servePath}`); log('Run `npm run dev` for development mode.'); log('Press CTRL+C to stop.');
}