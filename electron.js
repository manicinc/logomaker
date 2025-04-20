// electron.js - Revamped Electron Main Process (v2.1)
// Features: Structured code, clear dev mode toggle, refined menus, robust loading
// Change: "Toggle Developer Tools" is now *always* available in the View menu.

// --- Core Electron Modules ---
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// --- Essential Modules (Load Safely) ---
let autoUpdater;
try {
    console.log('[Main] Loading electron-updater...');
    autoUpdater = require('electron-updater').autoUpdater;
    console.log('[Main] electron-updater loaded successfully.');
} catch (error) {
    console.error('[Main] [WARN] Failed to load electron-updater:', error.message);
    autoUpdater = null; // Set to null to easily check later
}

let logger;
try {
    console.log('[Main] Loading electron-log...');
    logger = require('electron-log');
    // Configure logging paths and levels
    logger.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs', 'main.log');
    logger.transports.file.level = 'info';
    logger.transports.console.level = 'info'; // Or 'debug' for more verbosity
    console.log = logger.log; // Optional: Redirect console.log to electron-log
    console.error = logger.error;
    console.warn = logger.warn;
    console.info = logger.info;
    console.debug = logger.debug;

    // Configure autoUpdater logging IF it loaded
    if (autoUpdater) {
        autoUpdater.logger = logger;
        autoUpdater.logger.transports.file.level = 'info';
        logger.info('[Main] electron-log configured and assigned to autoUpdater.');
    } else {
        logger.info('[Main] electron-log configured.');
    }

} catch (error) {
    console.error('[Main] [WARN] Failed to load or configure electron-log:', error.message);
    // Fallback to basic console logging if electron-log fails
    logger = console; // Use standard console as a fallback logger object
}

// --- Application Constants ---
const APP_NAME = app.getName(); // Or set explicitly: 'Logomaker';
const IS_MAC = process.platform === 'darwin';

// ** Development Mode Toggle **
// This flag controls features like the dedicated "Developer" menu and auto-update checks.
// It's true if the app is not packaged OR if NODE_ENV is explicitly not 'production'.
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
// You can uncomment the line below to FORCE production behavior (hides Dev menu, enables updates)
// const isDev = false;

const PORTABLE_CONTENT_PATH = path.join(__dirname, 'dist', 'portable');
const INDEX_HTML_PATH = path.join(PORTABLE_CONTENT_PATH, 'index.html');
const PRELOAD_SCRIPT_PATH = path.join(__dirname, 'preload.js');
const APP_ICON_PATH = path.join(__dirname, 'assets', 'icon.png'); // Adjust if needed (e.g., .ico for win)

const CONFIG_FILE_NAME = 'logomaker-config.json';
let configFilePath = null; // Set after 'ready'

// --- Global Variables ---
let mainWindow = null;
let skippedVersion = null; // Loaded from config

// --- GPU Acceleration ---
// Disable early for potential rendering issues. Comment out if not needed.
try {
    logger.info('[Main] Attempting to disable hardware acceleration...');
    app.disableHardwareAcceleration();
    logger.info('[Main] Hardware acceleration DISABLED.');
} catch (e) {
    logger.error('[Main] Error disabling hardware acceleration:', e);
}

logger.info(`[Main] Application starting...`);
logger.info(`[Main] Mode: ${isDev ? 'Development' : 'Production'}`);
logger.info(`[Main] Platform: ${process.platform}`);

// --- Configuration Management --- (Functions remain the same as previous version)
function getConfigFilePath() {
    if (!configFilePath) {
        try {
            const userDataPath = app.getPath('userData');
            if (!fs.existsSync(userDataPath)) {
                fs.mkdirSync(userDataPath, { recursive: true });
                logger.info(`[Config] Created userData directory: ${userDataPath}`);
            }
            configFilePath = path.join(userDataPath, CONFIG_FILE_NAME);
            logger.info(`[Config] Config file path set: ${configFilePath}`);
        } catch (error) {
            logger.error('[Config] Error getting/creating userData path:', error);
            return null;
        }
    }
    return configFilePath;
}

function readConfig() {
    const filePath = getConfigFilePath();
    if (!filePath) return { skippedVersion: null };
    try {
        if (fs.existsSync(filePath)) {
            const configData = fs.readFileSync(filePath, 'utf-8');
            const config = JSON.parse(configData);
            skippedVersion = config.skippedVersion || null;
            logger.info(`[Config] Loaded config. Skipped version = ${skippedVersion}`);
            return config;
        }
        logger.info('[Config] Config file not found, using defaults.');
    } catch (error) {
        logger.error('[Config] Error reading config file:', error);
        skippedVersion = null;
    }
    return { skippedVersion: null };
}

function writeConfig(configData) {
    const filePath = getConfigFilePath();
     if (!filePath) {
         logger.error("[Config] Cannot write config, file path not available.");
         return;
     }
    try {
        fs.writeFileSync(filePath, JSON.stringify(configData, null, 2), 'utf-8');
        skippedVersion = configData.skippedVersion || null;
        logger.info(`[Config] Wrote config: ${JSON.stringify(configData)}`);
    } catch (error) {
        logger.error('[Config] Error writing config file:', error);
    }
}

// --- Main Window Management --- (Functions remain the same as previous version)
function createWindow() {
    logger.info('[Window] Creating main window...');

    if (!fs.existsSync(INDEX_HTML_PATH)) {
        logger.error(`[Window] FATAL: index.html not found at expected path: ${INDEX_HTML_PATH}`);
        dialog.showErrorBox('Application Error', `Cannot load the application.\nRequired file not found:\n${INDEX_HTML_PATH}\n\nPlease ensure the application was built correctly (run 'npm run build:portable').`);
        app.quit(); return;
    }
     if (!fs.existsSync(PRELOAD_SCRIPT_PATH)) {
         logger.error(`[Window] FATAL: preload.js not found at expected path: ${PRELOAD_SCRIPT_PATH}`);
         dialog.showErrorBox('Application Error', `Critical preload script missing.`);
         app.quit(); return;
     }

    mainWindow = new BrowserWindow({
        width: 1280, height: 800,
        minWidth: 900, minHeight: 600,
        title: APP_NAME,
        icon: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
        show: false,
        webPreferences: {
            preload: PRELOAD_SCRIPT_PATH,
            contextIsolation: true, nodeIntegration: false, spellcheck: true,
            // webSecurity: false // KEEPING THIS IS A SECURITY RISK IF LOADING REMOTE CONTENT. Needed for file:// usually.
        },
    });
    logger.info('[Window] BrowserWindow instance created.');

    logger.info(`[Window] Loading URL: file://${INDEX_HTML_PATH}`);
    mainWindow.loadFile(INDEX_HTML_PATH)
        .then(() => { logger.info('[Window] Content loaded successfully.'); })
        .catch(err => {
            logger.error(`[Window] FAILED to load content URL: ${err}`);
            dialog.showErrorBox('Load Error', `Failed to load the application's main page.\nError: ${err.message}`);
            app.quit();
        });

    mainWindow.once('ready-to-show', () => {
        logger.info('[Window] Window ready to show.');
        mainWindow.show();
        // Open DevTools automatically ONLY in dev mode, but the menu item is always there.
        if (isDev) {
           logger.info('[Window] Opening DevTools automatically in development mode.');
            mainWindow.webContents.openDevTools();
        }
    });

    mainWindow.on('closed', () => {
        logger.info('[Window] Main window closed.');
        mainWindow = null;
    });

     mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
            logger.info(`[Security] Opening external link in browser: ${url}`)
            shell.openExternal(url);
        } else {
             logger.warn(`[Security] Denied opening potentially unsafe URL: ${url}`);
        }
         return { action: 'deny' }; // Prevent Electron from opening its own window
    });
}

// --- Application Menu Setup ---
function setupMenu() {
    logger.info('[Menu] Setting up application menu...');

    const template = [
        // {App Menu} (macOS only)
        ...(IS_MAC ? [{
            label: APP_NAME,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { label: 'Check for Updates...', click: manualCheckForUpdates, enabled: !!autoUpdater },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        // {File Menu}
        {
            label: 'File',
            submenu: [
                IS_MAC ? { role: 'close' } : { role: 'quit' } // Standard Quit/Close
            ]
        },
        // {Edit Menu}
        { role: 'editMenu' }, // Standard Edit menu
        // {View Menu}
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                // --- Toggle Developer Tools - ALWAYS AVAILABLE ---
                {
                    label: 'Toggle Developer Tools',
                    accelerator: IS_MAC ? 'Cmd+Alt+I' : 'Ctrl+Shift+I',
                    click: () => { mainWindow?.webContents.toggleDevTools(); }
                },
                // ---------------------------------------------
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
         // --- Developer Menu (ONLY SHOWN IN DEV MODE) ---
         ...(isDev ? [{
             label: 'Developer',
             submenu: [
                  { // Included Toggle DevTools here too for convenience during dev
                     label: 'Toggle Developer Tools',
                     accelerator: IS_MAC ? 'Cmd+Alt+I' : 'Ctrl+Shift+I',
                     click: () => { mainWindow?.webContents.toggleDevTools(); }
                  },
                 { type: 'separator' },
                 {
                    label: 'Show Config File',
                    click: () => {
                        const filePath = getConfigFilePath();
                        if (filePath && fs.existsSync(filePath)) { shell.showItemInFolder(filePath); }
                        else { dialog.showMessageBox({ type: 'info', message: 'Config file not found or path not set.' }); }
                    }
                 },
                  {
                    label: 'Show Logs Folder',
                    click: () => {
                        try {
                            const logDir = path.dirname(logger.transports.file.resolvePath());
                             if(fs.existsSync(logDir)) { shell.openPath(logDir); }
                             else { dialog.showMessageBox({ type: 'warning', message: 'Logs directory not found.' }); }
                        } catch (e) {
                             logger.error("Error opening log directory:", e);
                             dialog.showMessageBox({ type: 'error', message: 'Could not determine or open logs directory.' });
                        }
                    }
                 },
                 // Add other dev-specific actions here
             ]
         }] : []), // End conditional Developer Menu
        // {Window Menu}
        { role: 'windowMenu' }, // Standard Window menu
        // {Help Menu}
        {
            role: 'help',
            submenu: [
                { label: 'Check for Updates...', click: manualCheckForUpdates, enabled: !!autoUpdater },
                { type: 'separator' },
                { label: 'Learn More (GitHub)', click: () => { shell.openExternal('https://github.com/manicinc/logomaker') } },
                { label: 'Report Issue', click: () => { shell.openExternal('https://github.com/manicinc/logomaker/issues') } }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    logger.info('[Menu] Application menu set.');
}

// --- Auto Updater Logic --- (Functions remain the same as previous version)
function setupAutoUpdater() {
    if (!autoUpdater) {
        logger.warn('[Updater] AutoUpdater module not loaded, skipping setup.');
        return;
    }
    logger.info('[Updater] Setting up auto-updater event listeners...');
    // ... (event listeners: checking-for-update, update-not-available, error, download-progress, update-available, update-downloaded) ...
    // (Keep the detailed listeners from the previous version)
    autoUpdater.on('checking-for-update', () => { logger.info('[Updater] Checking for update...'); });
    autoUpdater.on('update-not-available', (info) => { logger.info(`[Updater] Update not available. Current version: ${info.version}`); });
    autoUpdater.on('error', (err) => { logger.error('[Updater] Error: ' + (err.message || err)); });
    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + progressObj.percent.toFixed(2) + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        logger.info(`[Updater] ${log_message}`);
    });
    autoUpdater.on('update-available', (info) => {
        logger.info(`[Updater] Update available: ${info.version}. Currently skipping: ${skippedVersion}`);
        if (skippedVersion && skippedVersion === info.version) {
            logger.info(`[Updater] Update ${info.version} is available but skipped by user. Ignoring.`); return;
        }
        logger.info(`[Updater] Update ${info.version} not skipped. Prompting user to download...`);
        dialog.showMessageBox({
            type: 'info', title: 'Update Available', message: `A new version (${info.version}) is available. Download now?`,
            buttons: ['Download', 'Later', `Skip ${info.version}`], defaultId: 0, cancelId: 1
        }).then(({ response }) => {
            if (response === 0) { logger.info('[Updater] User chose to download. Starting download...'); dialog.showMessageBox({ title: 'Downloading Update', message: `Downloading update ${info.version}... Please wait.`, buttons: [] }); autoUpdater.downloadUpdate(); }
            else if (response === 2) { logger.info(`[Updater] User chose to skip version ${info.version}.`); writeConfig({ skippedVersion: info.version }); }
            else { logger.info('[Updater] User chose to download later.'); }
        }).catch(err => logger.error('[Updater] Error showing update available dialog:', err));
    });
     autoUpdater.on('update-downloaded', (info) => {
        logger.info(`[Updater] Update downloaded: ${info.version}`);
        dialog.showMessageBox({
            type: 'info', title: 'Update Ready', message: `Version ${info.version} downloaded. Restart the application to install?`,
            buttons: ['Restart Now', 'Later'], defaultId: 0, cancelId: 1
        }).then(({ response }) => {
            if (response === 0) { logger.info('[Updater] User chose to restart. Quitting and installing...'); autoUpdater.quitAndInstall(); }
            else { logger.info('[Updater] User chose to install update later.'); }
        }).catch(err => logger.error('[Updater] Error showing update downloaded dialog:', err));
    });

     // Initial check runs only if NOT in dev mode AND updater is available
     if (!isDev && autoUpdater) {
         mainWindow?.webContents.once('did-finish-load', () => {
             logger.info('[Updater] Window loaded, initiating background update check...');
             setTimeout(() => {
                 try { autoUpdater.checkForUpdates(); }
                 catch (error) { logger.error('[Updater] Error initiating initial update check:', error); }
             }, 5000); // 5-second delay
         });
     }
}

function manualCheckForUpdates() {
     logger.info('[Updater] Manual update check requested.');
     if (!autoUpdater) { dialog.showMessageBox({ type: 'error', title: 'Updater Not Available', message: 'The auto-update feature could not be loaded.' }); return; }
     if (isDev) { dialog.showMessageBox({ type: 'info', title: 'Development Mode', message: 'Update checking is disabled in development mode.' }); return; }
     try {
        dialog.showMessageBox({ type: 'info', title: 'Checking for Updates', message: 'Checking for available updates...', buttons: ['OK'] });
         autoUpdater.checkForUpdates()
            .then(updateCheckResult => {
                const updateInfo = updateCheckResult?.updateInfo;
                if (!updateInfo || !updateInfo.version || updateCheckResult.cancellationToken) { // Check for cancellation token too
                     logger.info('[Updater] Manual check: No update found or check cancelled.');
                     // Show only if update-not-available didn't fire (might be redundant)
                     dialog.showMessageBox({ type: 'info', title: 'No Updates', message: 'You are running the latest version.' });
                 } else {
                     logger.info(`[Updater] Manual check found version: ${updateInfo.version}`);
                     // update-available listener handles the rest
                 }
            })
            .catch(err => {
                logger.error('[Updater] Manual update check failed:', err);
                dialog.showErrorBox('Update Check Error', `Failed to check for updates: ${err.message}`);
            });
     } catch (error) {
         logger.error('[Updater] Error initiating manual update check:', error);
         dialog.showErrorBox('Update Check Error', `An error occurred while checking for updates: ${error.message}`);
     }
}

// --- Application Lifecycle Events --- (Handlers remain the same as previous version)
app.on('window-all-closed', () => {
    logger.info('[App] All windows closed.');
    if (!IS_MAC) { logger.info('[App] Quitting application (non-macOS).'); app.quit(); }
});
app.on('activate', () => {
    logger.info('[App] Activate event (macOS).');
    if (BrowserWindow.getAllWindows().length === 0) { createWindow(); }
});
app.on('ready', () => {
    logger.info('>>> [App] Event: "ready" <<<');
     readConfig(); setupMenu(); createWindow(); setupAutoUpdater();
});
app.on('before-quit', () => { logger.info('[App] Event: "before-quit". Cleaning up...'); });

// --- Security Measures --- (Handlers remain the same as previous version)
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (!parsedUrl.protocol.startsWith('file:')) {
             logger.warn(`[Security] Blocked navigation attempt to non-file URL: ${navigationUrl}`);
            event.preventDefault();
        }
    });
    contents.setWindowOpenHandler(({ url }) => {
         if (url.startsWith('http') || url.startsWith('mailto:')) {
             logger.info(`[Security] Opening allowed URL externally: ${url}`)
             shell.openExternal(url);
         } else {
             logger.warn(`[Security] Denied request to open non-http(s)/mailto URL: ${url}`);
         }
         return { action: 'deny' };
    });
});

// --- Global Error Handling --- (Handlers remain the same as previous version)
process.on('uncaughtException', (error, origin) => {
    logger.error('!!!!!!!!!!! UNCAUGHT EXCEPTION !!!!!!!!!!!');
    logger.error(`Origin: ${origin}`); logger.error(error);
    logger.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    try { dialog.showErrorBox('Unhandled Error', `A critical error occurred:\n\n${error.message}\n\nThe application needs to close.`); } catch (e) {}
    process.exit(1); // Force exit
});
process.on('unhandledRejection', (reason, promise) => {
     logger.error('!!!!!!!!!!! UNHANDLED REJECTION !!!!!!!!!!!');
     logger.error('Promise:', promise); logger.error('Reason:', reason);
     logger.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
});

// --- IPC Handlers ---
// Add any IPC handlers needed for communication between main and renderer processes here
// Example: ipcMain.handle('some-async-action', async (event, arg) => { /* ... return result */ });