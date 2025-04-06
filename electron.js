// electron.js - Electron Main Process (v1.4 - Disable GPU, Add 'ready' listener)
const { app, BrowserWindow, Menu, shell, dialog } = require('electron'); // Keep dialog for potential errors
const path = require('path');
const fs = require('fs'); // Keep fs for file checks

// ** Try disabling GPU acceleration early **
// This MUST be called before the 'ready' event
try {
    app.disableHardwareAcceleration();
    console.log('[DEBUG] Hardware acceleration DISABLED.'); // Use console for earliest possible log
} catch (e) {
    // This might happen if called too early in some edge cases, but usually safe here.
    console.error('[DEBUG] Error attempting to disable hardware acceleration:', e);
}
// ** End Disable GPU **

// Require other modules AFTER potential app modifications
const { autoUpdater } = require('electron-updater');
const logger = require('electron-log'); // Assumes `npm install --save-dev electron-log` was run

// --- Configuration ---
const CONFIG_FILE_NAME = 'logomaker-config.json';
let configFilePath = null; // Will be set after 'ready'

// --- Configure Logging ---
try {
    // Basic setup, can be configured further via package.json or log.transports
    logger.transports.file.level = 'info';
    logger.transports.console.level = 'info'; // Log info to console as well
    autoUpdater.logger = logger;
    autoUpdater.logger.transports.file.level = 'info';
    logger.info('Logging configured (initial). Log file path depends on OS.');
} catch(logError) {
    console.error("Failed to configure electron-log:", logError);
    logger.info = console.info; logger.warn = console.warn; logger.error = console.error;
}

// --- Global Variables ---
let mainWindow;
const isDev = !app.isPackaged; // Check if the app is packaged or running from source
let skippedVersion = null; // Will be loaded after 'ready'
logger.info(`Running in ${isDev ? 'development' : 'production'} mode.`);

// --- Config Helper Functions --- (Keep as before)
function readConfig() {
    if (!configFilePath) { // Ensure path is set
        logger.error("Config file path not set before readConfig called.");
        return { skippedVersion: null };
    }
    try {
        if (fs.existsSync(configFilePath)) {
            const configData = fs.readFileSync(configFilePath, 'utf-8');
            const config = JSON.parse(configData);
            skippedVersion = config.skippedVersion || null;
            logger.info(`Loaded config: Skipped version = ${skippedVersion}`);
            return config;
        }
         logger.info('Config file not found, using defaults.');
    } catch (error) {
        logger.error('Error reading config file:', error);
        skippedVersion = null;
    }
    return { skippedVersion: null };
}

function writeConfig(configData) {
     if (!configFilePath) { // Ensure path is set
        logger.error("Config file path not set before writeConfig called.");
        return;
    }
    try {
        // Ensure userData directory exists
        const userDataPath = app.getPath('userData');
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }
        fs.writeFileSync(configFilePath, JSON.stringify(configData, null, 2), 'utf-8');
        skippedVersion = configData.skippedVersion || null;
        logger.info(`Wrote config: ${JSON.stringify(configData)}`);
    } catch (error) {
        logger.error('Error writing config file:', error);
    }
}

// --- Main Window Creation ---
function createWindow() {
    logger.info('[createWindow] Called.'); // Changed log prefix
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false, // Keep for file://
        },
        icon: path.join(__dirname, 'assets', 'icon.png') // Ensure this path is correct
    });
    logger.info('[createWindow] BrowserWindow created.');

    const startPath = path.join(__dirname, 'dist', 'portable', 'index.html');
    logger.info(`[createWindow] Attempting to load: file://${startPath}`);

    if (!fs.existsSync(startPath)) {
        logger.error(`[createWindow] ERROR: startPath does not exist! Path: ${startPath}`);
        dialog.showErrorBox('Error', `Cannot load the application.\nRequired file not found:\n${startPath}\n\nPlease run 'npm run build:portable' first.`);
        app.quit();
        return;
    }

    mainWindow.loadFile(startPath)
        .then(() => logger.info(`[createWindow] Window loaded successfully: ${startPath}`))
        .catch(err => logger.error(`[createWindow] FAILED to load window URL: ${err}`));

    if (isDev) {
        logger.info('[createWindow] Opening DevTools in dev mode.');
        mainWindow.webContents.openDevTools();
    }

    // --- Check for Updates on Startup ---
    mainWindow.webContents.once('did-finish-load', () => {
        logger.info('[createWindow] Window finished loading.');
        if (!isDev) {
           logger.info('[createWindow] Initiating background update check...');
           try {
               autoUpdater.checkForUpdates(); // Just check
           } catch (error) { logger.error('[createWindow] Error initiating update check:', error); }
        } else { logger.info(`[createWindow] Skipping update check in development mode.`); }
    });

    mainWindow.on('closed', () => {
        logger.info('[createWindow] Main window closed.');
        mainWindow = null;
    });
}

// --- Application Lifecycle ---

// *** Using explicit 'ready' listener for primary setup ***
app.on('ready', () => {
    logger.info('>>> App explicit "ready" event fired <<<');
    // Now it's safe to get paths and read config
    try {
        const userDataPath = app.getPath('userData');
        configFilePath = path.join(userDataPath, CONFIG_FILE_NAME); // Set the global path now
        logger.info(`User data path: ${userDataPath}`);
        logger.info(`Config file path: ${configFilePath}`);
        readConfig(); // Load config now
    } catch(e) {
        logger.error("Error setting paths or reading config after ready:", e);
    }

    // Proceed with window creation etc.
    createWindow();
    setupMenu();
});

// Keep whenReady() as well, good practice, but avoid duplicate calls
app.whenReady().then(() => {
    logger.info('>>> App whenReady() promise resolved <<<');
    // createWindow() and setupMenu() are called by the 'ready' listener now.
    // We just log that the promise resolved.
}).catch(err => {
    logger.error('Error during app.whenReady() promise:', err);
});

app.on('activate', () => { // Keep activate listener for macOS
    logger.info('App activate event.');
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    logger.info('All windows closed.');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


// --- Auto Updater Event Handling ---
autoUpdater.on('checking-for-update', () => { logger.info('Checking for update...'); });
// REMOVED: update-not-available listener here (handled in manual check context)
autoUpdater.on('error', (err) => { logger.error('Error in auto-updater: ' + (err.message || err)); });
autoUpdater.on('download-progress', (progressObj) => { /* ... */ });

// *** NEW: Handle update availability ***
autoUpdater.on('update-available', (info) => {
    logger.info(`Update available: ${info.version}. Currently skipping: ${skippedVersion}`);
    // Check against the stored skipped version
    if (skippedVersion && skippedVersion === info.version) {
        logger.info(`Update ${info.version} is available, but user has skipped it. Ignoring.`);
        return; // Do nothing, don't download
    }
    // If not skipped, proceed to download
    logger.info(`Update ${info.version} not skipped. Starting download...`);
    dialog.showMessageBox({ title: 'Update Found', message: `Downloading update ${info.version}...`, buttons: [] }); // Inform user
    autoUpdater.downloadUpdate();
});

// *** MODIFIED 'update-downloaded' HANDLER ***
autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded.', info);
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded. Restart now to install?`,
        buttons: ['Restart Now', 'Later', 'Skip This Version'], // <<< Added Skip button
        defaultId: 0,
        cancelId: 1 // "Later" is the cancel action
    }).then(({ response }) => {
        if (response === 0) { // Restart Now
            logger.info('User chose to restart. Quitting and installing update...');
            autoUpdater.quitAndInstall();
        } else if (response === 2) { // <<< Handle Skip This Version
            logger.info(`User chose to skip version ${info.version}.`);
            writeConfig({ skippedVersion: info.version }); // Store the skipped version
        } else { // Later or closed dialog
            logger.info('User chose to install update later.');
        }
    }).catch(err => { logger.error('Error showing update downloaded dialog:', err); });
});
// *** END MODIFIED HANDLER ***


// --- Application Menu ---
function setupMenu() {
    const template = [
        // ... (Keep File, Edit, View, Window menus as before) ...
        { // Modify Help menu
            role: 'help',
            submenu: [
                 {
                     label: 'Check for Updates...', // <<< Add manual check item
                     click: () => { manualCheckForUpdates(); } // Call the function
                 },
                 { type: 'separator' },
                 { label: 'Learn More (GitHub)', click: async () => { await shell.openExternal('https://github.com/manicinc/logomaker') } }
             ]
        }
    ];
     // Add App menu for macOS
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { label: 'Check for Updates...', click: () => { manualCheckForUpdates(); } }, // Add here too for macOS convention
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// --- Security Considerations --- (Keep these)
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl); if (!parsedUrl.protocol.startsWith('file:')) { logger.warn(`Blocked navigation to non-file URL: ${navigationUrl}`); event.preventDefault(); }
    });
    contents.setWindowOpenHandler(({ url }) => { logger.warn(`Blocked new window for URL: ${url}`); return { action: 'deny' }; });
});

// Catch unhandled exceptions
process.on('uncaughtException', (error, origin) => {
    logger.error('!!!!!!!!!!! UNCAUGHT EXCEPTION !!!!!!!!!!!');
    logger.error('Origin:', origin);
    logger.error(error);
    logger.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    // Attempt graceful exit
    try { const { dialog } = require('electron'); dialog.showErrorBox('Unhandled Error', `A critical error occurred:\n\n${error.message}\n\nThe application will now close.`); } catch(e){}
    app.quit();
});