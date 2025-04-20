// scripts/clear-cache.js
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Configuration ---
// Try to read app name from package.json -> build -> productName or name
let appName = 'Logomaker'; // Fallback app name
try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        // Prefer productName used by electron-builder, fallback to package name
        appName = pkg?.build?.productName || pkg?.name || appName;
    } else {
         console.warn('[ClearCache] Warning: package.json not found at expected location.');
    }
} catch (e) {
    console.warn('[ClearCache] Warning: Could not read app name from package.json, using default:', appName, e);
}
console.log(`[ClearCache] Attempting to clear cache for application name: "${appName}"`);

// --- Helper Function to Remove Directory ---
function removeDirectoryRecursive(dirPath) {
    if (fs.existsSync(dirPath)) {
        try {
            console.log(`[ClearCache] Attempting removal of: ${dirPath}`);
            // Use fs.rmSync for Node v14.14+ (recommended)
            if (typeof fs.rmSync === 'function') {
                 fs.rmSync(dirPath, { recursive: true, force: true });
            } else {
                 // Fallback for older Node versions (less robust)
                 fs.rmdirSync(dirPath, { recursive: true });
            }
            console.log(`[ClearCache] Successfully removed ${dirPath}`);
            return true; // Indicate success
        } catch (err) {
            // Log error but don't halt the overall process, as cache clearing is best-effort
            console.error(`[ClearCache] Error removing directory ${dirPath}. It might be in use or permissions are needed.`, err.code || err.message);
            return false; // Indicate failure
        }
    } else {
        console.log(`[ClearCache] Directory not found, skipping removal: ${dirPath}`);
        return false; // Indicate directory wasn't found
    }
}

// --- Determine Cache Paths Based on OS ---
let cachePaths = [];
const platform = os.platform();
const homeDir = os.homedir();

try {
    switch (platform) {
        case 'darwin': // macOS
            const libraryDir = path.join(homeDir, 'Library');
            cachePaths.push(path.join(libraryDir, 'Application Support', appName, 'Cache')); // Main cache
            cachePaths.push(path.join(libraryDir, 'Caches', appName)); // Secondary cache location
            cachePaths.push(path.join(libraryDir, 'Application Support', appName, 'GPUCache')); // GPU Cache
            break;

        case 'win32': // Windows
            const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
            const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
            cachePaths.push(path.join(appData, appName, 'Cache')); // Roaming cache
            cachePaths.push(path.join(appData, appName, 'GPUCache')); // Roaming GPUCache
            cachePaths.push(path.join(localAppData, appName, 'Cache')); // Local cache
            break;

        case 'linux': // Linux
            const configDir = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
            const cacheDir = process.env.XDG_CACHE_HOME || path.join(homeDir, '.cache');
            cachePaths.push(path.join(configDir, appName, 'Cache')); // Config-based cache
            cachePaths.push(path.join(configDir, appName, 'GPUCache')); // Config-based GPUCache
            cachePaths.push(path.join(cacheDir, appName)); // Cache-based location
            break;

        default:
            console.warn(`[ClearCache] Unsupported platform detected: ${platform}. Cache cannot be automatically cleared.`);
            // Exit gracefully, don't cause build failure
            process.exit(0);
    }
} catch (pathError) {
     console.error('[ClearCache] Error determining cache paths:', pathError);
     process.exit(0); // Exit gracefully on path errors
}


// --- Attempt to Remove Identified Cache Directories ---
console.log(`[ClearCache] Platform: ${platform}. Identified potential cache paths:`, cachePaths.filter(p => !!p)); // Filter out null/empty paths if any logic error occurred

let clearedAny = false;
cachePaths.forEach(cachePath => {
    if (cachePath) { // Ensure path is valid
       clearedAny = removeDirectoryRecursive(cachePath) || clearedAny;
    }
});

if (!clearedAny) {
     console.log(`[ClearCache] No relevant cache directories were found or successfully removed for "${appName}". This might be normal on first run.`);
} else {
     console.log(`[ClearCache] Cache clearing process finished.`);
}

// Script completes successfully even if directories weren't found or couldn't be removed.