/**
 * zipUtils.js - v2.0 - Enhanced and fixed ZIP creation utilities
 * 
 * This module provides robust ZIP creation with multiple fallback methods:
 * 1. JSZip (if available) - Fully compressed ZIP with proper headers
 * 2. Simple ZIP - Cross-platform compatible basic ZIP without compression
 * 3. Direct Downloads - Individual file downloads as last resort
 * 
 * IMPROVEMENTS:
 * - Fixed Windows compatibility issues
 * - Enhanced error handling and reporting
 * - Better progress tracking and cancellation
 * - Improved cross-browser compatibility
 * - More detailed logging
 */

// --- Configuration ---
const JSZIP_COMPRESSION_LEVEL = 6; // 0-9 (0 = store, 9 = best but slow)
const DIRECT_DOWNLOAD_DELAY_MS = 350; // Delay between direct downloads
const DIRECT_DOWNLOAD_CONFIRM_THRESHOLD = 10; // Ask for confirmation above this number

// --- Core ZIP Creation Functions ---

/**
 * Main function: Creates a ZIP file with fallbacks
 * Prefers JSZip, falls back to simple uncompressed ZIP, then direct downloads.
 * 
 * @param {Array<{blob: Blob, name: string}>} files - Array of file objects with blob and name
 * @param {string} zipFilename - Desired ZIP filename
 * @param {function} progressCallbackUI - Callback for progress updates
 * @returns {Promise<{success: boolean, method: string}>} - Result object
 */
export async function createZip(files, zipFilename, progressCallbackUI) {
    console.log(`[ZipUtils v2.0] Starting createZip for ${files?.length || 0} files. Target: ${zipFilename}`);
    
    // Validate inputs
    if (!Array.isArray(files) || files.length === 0) {
        console.error('[ZipUtils] No files provided for ZIP creation');
        return { success: false, method: 'none', error: 'No files provided' };
    }
    
    // Safe progress callback
    const updateProgress = (value) => {
        if (progressCallbackUI) {
            try {
                progressCallbackUI(value);
            } catch (e) {
                console.warn('[ZipUtils] Progress callback error:', e);
            }
        }
    };

    // Check if export was cancelled (assuming global flag)
    const checkCancelled = () => {
        if (typeof window !== 'undefined' && window.exportCancelled) {
            throw new Error("Export cancelled by user");
        }
    };

    // --- 1. Attempt JSZip ---
    const JSZip = getJSZipInstance();
    if (JSZip) {
        console.log('[ZipUtils] JSZip detected. Trying JSZip method...');
        updateProgress('Compressing with JSZip...');
        
        try {
            checkCancelled();
            const result = await createZipWithJSZip(files, zipFilename, JSZip, updateProgress);
            if (result.success) {
                console.log('[ZipUtils] JSZip method successful.');
                updateProgress(100);
                return { success: true, method: 'jszip', filename: result.filename };
            } else {
                console.warn('[ZipUtils] JSZip failed. Trying Fallback 1...');
                updateProgress('JSZip failed. Trying simple ZIP...');
            }
        } catch (jszipError) {
            if (jszipError.message.includes("cancelled")) {
                console.log('[ZipUtils] JSZip cancelled.');
                updateProgress('Cancelled');
                return { success: false, method: 'cancelled', error: 'Operation cancelled' };
            }
            console.error('[ZipUtils] JSZip error:', jszipError);
            updateProgress('JSZip error. Trying simple ZIP...');
        }
    } else {
        console.log('[ZipUtils] JSZip not detected. Trying Simple ZIP...');
        updateProgress('JSZip unavailable. Trying simple ZIP...');
    }

    // --- 2. Fallback: Simple Uncompressed ZIP ---
    console.log('[ZipUtils] Attempting Simple Uncompressed ZIP method...');
    updateProgress('Creating simple ZIP package...');
    
    try {
        checkCancelled();
        const simpleProgressHandler = (percent) => {
            updateProgress(percent < 99 ? `Packaging: ${percent}%` : 'Finalizing ZIP...');
        };
        
        const zipResult = await createSimpleUncompressedZip(files, simpleProgressHandler);
        
        if (zipResult && zipResult.blob instanceof Blob && zipResult.blob.size > 22) {
            console.log('[ZipUtils] Simple ZIP created successfully.');
            updateProgress('Downloading Simple ZIP...');
            
            await downloadZipBlob(zipResult.blob, zipFilename);
            updateProgress(100);
            return { success: true, method: 'simple-zip', filename: zipFilename };
        } else {
            console.warn('[ZipUtils] Simple ZIP failed to create valid blob. Trying direct downloads...');
            updateProgress('Simple ZIP failed. Trying direct downloads...');
        }
    } catch (simpleZipError) {
        if (simpleZipError.message.includes("cancelled")) {
            console.log('[ZipUtils] Simple ZIP cancelled.');
            updateProgress('Cancelled');
            return { success: false, method: 'cancelled', error: 'Operation cancelled' };
        }
        console.error('[ZipUtils] Simple ZIP error:', simpleZipError);
        updateProgress('Simple ZIP error. Trying direct downloads...');
    }

    // --- 3. Final Fallback: Direct Downloads ---
    console.log('[ZipUtils] Attempting Direct Download fallback...');
    try {
        checkCancelled();
        const fallbackSuccess = await downloadFilesDirectly(files, updateProgress);
        console.log(`[ZipUtils] Direct Download fallback result: ${fallbackSuccess}`);
        
        updateProgress(fallbackSuccess ? 'Individual downloads started.' : 'All methods failed.');
        return {
            success: fallbackSuccess,
            method: 'direct-downloads',
            message: fallbackSuccess ? 
                `Initiated ${files.length} direct downloads` : 
                'Failed to download files'
        };
    } catch (fallbackError) {
        if (fallbackError.message.includes("cancelled")) {
            return { success: false, method: 'cancelled', error: 'Operation cancelled' };
        }
        console.error('[ZipUtils] Direct Download fallback critical error:', fallbackError);
        updateProgress('All export methods failed!');
        
        if (typeof showAlert === 'function') {
            showAlert(`Export failed: ${fallbackError.message}`, 'error');
        }
        return { success: false, method: 'failed', error: fallbackError.message };
    }
}

/**
 * Detects if JSZip library is available in the environment
 * @returns {Function|null} JSZip constructor or null if not available
 * @private
 */
function getJSZipInstance() {
    // Check window global scope
    if (typeof window !== 'undefined') {
        if (typeof window.JSZip === 'function') return window.JSZip;
        if (typeof window.jszip === 'function') return window.jszip;
    }
    
    // Check module scope (if running in Node/module environment)
    if (typeof JSZip === 'function') return JSZip;
    if (typeof jszip === 'function') return jszip;
    
    // Not found
    return null;
}

/**
 * Creates a ZIP file using JSZip library and triggers download
 * @param {Array<{blob: Blob, name: string}>} files - Array of file objects
 * @param {string} zipFilename - Desired ZIP filename
 * @param {Function} JSZipConstructor - JSZip constructor
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<{success: boolean, filename: string}>} Result object
 * @private
 */
async function createZipWithJSZip(files, zipFilename, JSZipConstructor, progressCallback) {
    console.log('[ZipUtils] Creating ZIP using JSZip...');
    
    try {
        const zip = new JSZipConstructor();
        let validFilesCount = 0;

        // Add each file to the zip
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check for cancellation during file processing
            if (typeof window !== 'undefined' && window.exportCancelled) {
                throw new Error("Export cancelled during JSZip file addition");
            }
            
            // Validate file object
            if (file && file.blob instanceof Blob && typeof file.name === 'string' && file.name.trim() !== '') {
                // Sanitize filename and ensure proper slashes for cross-platform compatibility
                const safeName = sanitizeFilename(file.name);
                zip.file(safeName, file.blob, { binary: true });
                validFilesCount++;
                
                // Optional incremental progress during file addition
                if (progressCallback && i % 10 === 0) {
                    try {
                        progressCallback(`Adding files to ZIP: ${Math.round((i / files.length) * 50)}%`);
                    } catch(e) {
                        /* ignore callback error */
                    }
                }
            } else {
                console.warn(`[ZipUtils] Skipping invalid file entry at index ${i}:`, file);
            }
        }

        // Verify we have files to process
        if (validFilesCount === 0) {
            throw new Error("No valid files for JSZip archive");
        }

        // Generate the ZIP blob
        console.log(`[ZipUtils] Added ${validFilesCount} files. Generating ZIP blob...`);
        progressCallback("Compressing files...");
        
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/zip',
            compression: "DEFLATE",
            compressionOptions: { level: JSZIP_COMPRESSION_LEVEL },
            streamFiles: true
        }, (metadata) => {
            // Progress during ZIP generation
            if (progressCallback && metadata.percent) {
                const percent = Math.round(50 + (metadata.percent / 2)); // 50-100% range
                // Reduce update frequency
                if (percent % 5 === 0 || percent >= 95) {
                    try {
                        progressCallback(`Compressing: ${percent}%`);
                    } catch(e) {
                        /* ignore callback error */
                    }
                }
            }
            
            // Check for cancellation during ZIP generation
            if (typeof window !== 'undefined' && window.exportCancelled) {
                throw new Error("Export cancelled during JSZip generation");
            }
        });

        // Download the ZIP blob
        console.log('[ZipUtils] ZIP blob generated. Size:', zipBlob.size);
        await downloadZipBlob(zipBlob, zipFilename);
        return { success: true, filename: zipFilename };

    } catch (error) {
        console.error("[ZipUtils] JSZip creation failed:", error);
        
        // Re-throw cancellation errors
        if (error.message.includes("cancelled")) {
            throw error;
        }
        
        return { success: false, error: error.message };
    }
}

/**
 * Creates a simple uncompressed ZIP file without external dependencies
 * Fixed for cross-platform compatibility, especially Windows
 * 
 * @param {Array<{blob: Blob, name: string}>} files - Array of file objects
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<{blob: Blob, finalFilename: string}>} ZIP blob and filename
 */
export async function createSimpleUncompressedZip(files, progressCallback) {
    console.log("[ZipUtils] Creating cross-platform compatible uncompressed ZIP...");
    
    if (!Array.isArray(files) || files.length === 0) {
        console.error('[ZipUtils] No files array provided for createSimpleUncompressedZip');
        return null;
    }

    // ZIP file structure constants (magic numbers)
    const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
    const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
    const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

    // Utility functions for writing to buffers
    const writeUint16LE = (value, buffer, offset) => new DataView(buffer).setUint16(offset, value, true);
    const writeUint32LE = (value, buffer, offset) => new DataView(buffer).setUint32(offset, value, true);

    // Get DOS-formatted date & time
    const getDOSDateTime = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = Math.floor(date.getSeconds() / 2);
        
        if (year < 1980) return 0x2100; // DOS epoch starts at 1980
        
        const dosTime = (hours << 11) | (minutes << 5) | seconds;
        const dosDate = ((year - 1980) << 9) | (month << 5) | day;
        
        return (dosDate << 16) | dosTime;
    };

    // Convert Blob to Uint8Array
    const blobToUint8Array = async (blob) => {
        if (!(blob instanceof Blob)) {
            throw new Error("Input is not a Blob");
        }
        try {
            const buffer = await blob.arrayBuffer();
            return new Uint8Array(buffer);
        } catch (e) {
            console.error("[ZipUtils] Error reading blob to ArrayBuffer:", e);
            throw new Error(`Failed to read blob data: ${e.message}`);
        }
    };

    // Collection variables
    const zipParts = []; // Will hold all Uint8Array parts
    const centralDirectoryHeaders = []; // Holds data needed for central directory
    let currentOffset = 0;
    const textEncoder = new TextEncoder(); // For filename encoding
    let processedFileCount = 0;
    let totalBytesProcessed = 0;
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
        // Check for cancellation during loop
        if (typeof window !== 'undefined' && window.exportCancelled) {
            throw new Error("Export cancelled during ZIP creation");
        }
        
        const file = files[i];
        const fileInfo = `(${i + 1}/${files.length})`;
        
        // Validate file entry
        if (!file || !(file.blob instanceof Blob) || typeof file.name !== 'string' || file.name.trim() === '') {
            console.warn(`[ZipUtils] ${fileInfo} Skipping invalid file entry:`, file);
            continue;
        }
        
        // Progress update (if callback provided)
        if (progressCallback) {
            const percentDone = Math.round(i * 100 / files.length);
            try {
                progressCallback(percentDone);
            } catch (e) {
                /* ignore callback errors */
            }
        }
        
        try {
            // Sanitize and standardize filename
            // IMPORTANT: This ensures Windows compatibility by using forward slashes
            let filename = sanitizeFilename(file.name);
            
            // Read blob content as Uint8Array
            console.log(`[ZipUtils] ${fileInfo} Reading blob: "${filename}"`);
            const fileData = await blobToUint8Array(file.blob);
            const fileSize = fileData.length;
            totalBytesProcessed += fileSize;
            
            // Encode filename as UTF-8 bytes
            const filenameBytes = textEncoder.encode(filename);
            if (filenameBytes.length > 65535) {
                console.warn(`[ZipUtils] Filename too long (${filenameBytes.length} bytes), truncating: ${filename}`);
                // Truncation would be needed here if implementing
                throw new Error("Filename too long for ZIP format (>65535 bytes)");
            }
            
            // ZIP entry constants
            const crc32 = 0; // Not calculating CRC for simplicity/speed
            const dosDateTime = getDOSDateTime();
            const compressionMethod = 0; // 0 = Stored (no compression)
            const generalPurposeFlag = 0; // No encryption, no data descriptors
            const versionNeeded = 10; // Version 1.0
            const versionMadeBy = 20; // Version 2.0 (DOS compatibility)
            
            // --- 1. Write Local File Header ---
            const localHeaderSize = 30 + filenameBytes.length;
            const localHeaderBuffer = new ArrayBuffer(30);
            const localHeader = new Uint8Array(localHeaderBuffer);
            
            // Write header fields
            writeUint32LE(LOCAL_FILE_HEADER_SIGNATURE, localHeaderBuffer, 0);
            writeUint16LE(versionNeeded, localHeaderBuffer, 4);
            writeUint16LE(generalPurposeFlag, localHeaderBuffer, 6);
            writeUint16LE(compressionMethod, localHeaderBuffer, 8);
            writeUint32LE(dosDateTime, localHeaderBuffer, 10);
            writeUint32LE(crc32, localHeaderBuffer, 14);
            writeUint32LE(fileSize, localHeaderBuffer, 18); // Compressed size
            writeUint32LE(fileSize, localHeaderBuffer, 22); // Uncompressed size
            writeUint16LE(filenameBytes.length, localHeaderBuffer, 26);
            writeUint16LE(0, localHeaderBuffer, 28); // Extra field length
            
            // Add header, filename, and content to ZIP
            zipParts.push(localHeader);
            zipParts.push(filenameBytes);
            zipParts.push(fileData);
            
            // --- 2. Prepare Central Directory Header ---
            const centralHeaderSize = 46 + filenameBytes.length;
            const centralHeaderBuffer = new ArrayBuffer(46);
            
            writeUint32LE(CENTRAL_DIRECTORY_HEADER_SIGNATURE, centralHeaderBuffer, 0);
            writeUint16LE(versionMadeBy, centralHeaderBuffer, 4);
            writeUint16LE(versionNeeded, centralHeaderBuffer, 6);
            writeUint16LE(generalPurposeFlag, centralHeaderBuffer, 8);
            writeUint16LE(compressionMethod, centralHeaderBuffer, 10);
            writeUint32LE(dosDateTime, centralHeaderBuffer, 12);
            writeUint32LE(crc32, centralHeaderBuffer, 16);
            writeUint32LE(fileSize, centralHeaderBuffer, 20); // Compressed
            writeUint32LE(fileSize, centralHeaderBuffer, 24); // Uncompressed
            writeUint16LE(filenameBytes.length, centralHeaderBuffer, 28);
            writeUint16LE(0, centralHeaderBuffer, 30); // Extra field length
            writeUint16LE(0, centralHeaderBuffer, 32); // Comment length
            writeUint16LE(0, centralHeaderBuffer, 34); // Disk # start
            writeUint16LE(0, centralHeaderBuffer, 36); // Internal attributes
            writeUint32LE(0, centralHeaderBuffer, 38); // External attributes
            writeUint32LE(currentOffset, centralHeaderBuffer, 42); // Relative offset of local header
            
            // Store central directory info for later
            centralDirectoryHeaders.push({
                buffer: centralHeaderBuffer,
                filenameBytes: filenameBytes,
                offset: currentOffset
            });
            
            // Update offset for next entry
            currentOffset += localHeaderSize + fileSize;
            processedFileCount++;
            
        } catch (fileError) {
            console.error(`[ZipUtils] Error processing file "${file.name}":`, fileError);
            // Continue with other files unless cancelled
            if (fileError.message.includes("cancelled")) throw fileError;
        }
    }
    
    // Verify we processed at least one file
    if (processedFileCount === 0) {
        console.error("[ZipUtils] No valid files processed for ZIP");
        return null;
    }
    
    // --- 3. Write Central Directory ---
    const centralDirStartOffset = currentOffset;
    let centralDirSize = 0;
    
    console.log(`[ZipUtils] Writing Central Directory at offset ${centralDirStartOffset}...`);
    
    centralDirectoryHeaders.forEach(header => {
        const headerBytes = new Uint8Array(header.buffer);
        zipParts.push(headerBytes);
        zipParts.push(header.filenameBytes);
        centralDirSize += headerBytes.length + header.filenameBytes.length;
    });
    
    // --- 4. Write End of Central Directory Record ---
    console.log(`[ZipUtils] Writing EOCD Record. CD Size: ${centralDirSize}, Files: ${processedFileCount}`);
    const eocdBuffer = new ArrayBuffer(22);
    
    writeUint32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, eocdBuffer, 0);
    writeUint16LE(0, eocdBuffer, 4); // Disk number
    writeUint16LE(0, eocdBuffer, 6); // Disk with CD
    writeUint16LE(processedFileCount, eocdBuffer, 8); // Number of entries on disk
    writeUint16LE(processedFileCount, eocdBuffer, 10); // Total entries
    writeUint32LE(centralDirSize, eocdBuffer, 12); // Size of central directory
    writeUint32LE(centralDirStartOffset, eocdBuffer, 16); // Offset of central directory
    writeUint16LE(0, eocdBuffer, 20); // Comment length
    
    zipParts.push(new Uint8Array(eocdBuffer));
    
    // --- 5. Create final ZIP blob ---
    try {
        const zipBlob = new Blob(zipParts, { type: 'application/zip' });
        console.log(`[ZipUtils] ZIP blob created successfully. Size: ${zipBlob.size} bytes`);
        
        if (progressCallback) {
            try {
                progressCallback(100); // Final progress
            } catch(e) {
                /* ignore callback error */
            }
        }
        
        // Return the blob and suggested filename
        return {
            blob: zipBlob,
            finalFilename: 'archive.zip'
        };
    } catch (blobError) {
        console.error("[ZipUtils] Error creating final ZIP blob:", blobError);
        return null;
    }
}

/**
 * Downloads individual files directly as a fallback method
 * @param {Array<{blob: Blob, name: string}>} files - Files to download
 * @param {Function} updateStatusCallback - Status update callback
 * @returns {Promise<boolean>} Success indicator
 */
export async function downloadFilesDirectly(files, updateStatusCallback) {
    console.warn('[ZipUtils] Initiating direct file downloads fallback.');
    
    if (!Array.isArray(files) || files.length === 0) {
        console.warn('[ZipUtils] No files to download directly.');
        return false;
    }
    
    // Prepare confirmation message
    const message = `Automatic ZIP creation failed. ${files.length} file(s) will be downloaded individually.\n` +
                   'Check browser settings if downloads are blocked.' +
                   (files.length > DIRECT_DOWNLOAD_CONFIRM_THRESHOLD ? 
                    `\n\nDownload all ${files.length} files now?` : '');
    
    // Update UI if callback provided
    if (typeof updateStatusCallback === 'function') {
        updateStatusCallback('ZIP Failed. Preparing individual downloads...');
    }
    
    // Ask for confirmation for larger download counts
    let confirmed = true;
    if (files.length > DIRECT_DOWNLOAD_CONFIRM_THRESHOLD) {
        confirmed = confirm(message);
    } else {
        alert(message);
    }
    
    if (!confirmed) {
        console.log('[ZipUtils] User cancelled direct downloads.');
        if (typeof updateStatusCallback === 'function') {
            updateStatusCallback('Direct downloads cancelled by user.');
        }
        if (typeof showAlert === 'function') {
            showAlert('Downloads cancelled.', 'info');
        }
        return false;
    }
    
    // Start downloads
    console.log('[ZipUtils] Starting direct downloads...');
    let downloadsInitiated = 0;
    
    // Prioritize certain file types to download first
    const priorityFiles = files.filter(f => f && (
        f.name.endsWith('.html') || 
        f.name.endsWith('.txt')
    ));
    const otherFiles = files.filter(f => f && !priorityFiles.includes(f));
    const downloadQueue = [...priorityFiles, ...otherFiles];
    
    // Download each file with a delay between
    for (let i = 0; i < downloadQueue.length; i++) {
        const file = downloadQueue[i];
        
        // Validate file entry
        if (!file || !(file.blob instanceof Blob) || !file.name) {
            continue;
        }
        
        // Check for cancellation
        if (typeof window !== 'undefined' && window.exportCancelled) {
            console.log('[ZipUtils] Cancellation detected during direct downloads.');
            if (typeof updateStatusCallback === 'function') {
                updateStatusCallback('Export cancelled during direct downloads.');
            }
            return downloadsInitiated > 0;
        }
        
        // Update status
        console.log(`[ZipUtils] Downloading ${i+1}/${downloadQueue.length}: ${file.name}`);
        if (typeof updateStatusCallback === 'function') {
            updateStatusCallback(`Downloading ${i+1}/${downloadQueue.length}: ${file.name}`);
        }
        
        // Download the file
        try {
            await downloadZipBlob(file.blob, file.name);
            downloadsInitiated++;
        } catch (dlError) {
            console.error(`[ZipUtils] Error downloading ${file.name}:`, dlError);
            
            // Ask user if they want to continue after an error
            const continueDl = confirm(`Failed to download "${file.name}".\nContinue with remaining files?`);
            if (!continueDl) {
                console.log('[ZipUtils] User stopped downloads after error.');
                if (typeof updateStatusCallback === 'function') {
                    updateStatusCallback('Downloads stopped by user after error.');
                }
                return downloadsInitiated > 0;
            }
        }
        
        // Add a small delay between downloads to avoid browser throttling
        await new Promise(resolve => setTimeout(resolve, DIRECT_DOWNLOAD_DELAY_MS));
    }
    
    // Report final status
    console.log(`[ZipUtils] Completed ${downloadsInitiated} direct downloads.`);
    if (typeof updateStatusCallback === 'function') {
        updateStatusCallback(`Completed ${downloadsInitiated} individual downloads.`);
    }
    if (typeof showAlert === 'function' && downloadsInitiated > 0) {
        showAlert(`${downloadsInitiated} files downloaded successfully.`, 'info');
    }
    
    return downloadsInitiated > 0;
}

/**
 * Downloads a Blob by creating a temporary link
 * @param {Blob} blob - The Blob to download
 * @param {string} filename - Desired filename
 * @returns {Promise<void>}
 */
export function downloadZipBlob(blob, filename = 'archive.zip') {
    return new Promise((resolve, reject) => {
        if (!blob || !(blob instanceof Blob)) {
            return reject(new Error('Invalid Blob provided for download'));
        }
        
        // Ensure valid filename
        filename = (typeof filename === 'string' && filename) ? filename : 'archive.zip';
        console.log(`[ZipUtils] Initiating download: '${filename}', Size: ${(blob.size / 1024).toFixed(1)} KB`);
        
        try {
            // Create temporary URL and link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            
            // Trigger download
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up the URL object after download starts
            setTimeout(() => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.warn('[ZipUtils] Error revoking Object URL:', e);
                }
            }, 500);
            
            console.log('[ZipUtils] Download link clicked successfully');
            resolve();
        } catch (err) {
            console.error('[ZipUtils] Error triggering download:', err);
            if (typeof showAlert === 'function') {
                showAlert(`Download failed: ${err.message}`, 'error');
            }
            reject(err);
        }
    });
}

/**
 * Sanitizes filenames for cross-platform compatibility
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename safe for all platforms
 * @private
 */
function sanitizeFilename(filename) {
    if (typeof filename !== 'string') return 'file.bin';
    
    // 1. Normalize slashes for paths (important for Windows compatibility)
    let safeName = filename.replace(/\\/g, '/');
    
    // 2. Remove invalid characters (control chars, <>:"/\|?*...)
    safeName = safeName.replace(/[<>:"\\|?*\x00-\x1F]/g, '_');
    
    // 3. Limit length (extremely long filenames can cause issues)
    if (safeName.length > 240) {
        // Get extension
        const lastDotIndex = safeName.lastIndexOf('.');
        const ext = lastDotIndex > 0 ? safeName.slice(lastDotIndex) : '';
        // Truncate name while preserving extension
        safeName = safeName.slice(0, 240 - ext.length) + ext;
    }
    
    // 4. Ensure name doesn't start or end with dots/spaces
    safeName = safeName.replace(/^[\s.]+|[\s.]+$/g, '');
    
    // 5. If filename is now empty, provide a default
    if (safeName === '') {
        safeName = 'file.bin';
    }
    
    return safeName;
}

/**
 * Checks if JSZip library is available
 * @returns {boolean} True if JSZip is available
 */
export function isJSZipAvailable() {
    return getJSZipInstance() !== null;
}

// Log availability on module load
console.log('[ZipUtils v2.0] Module Loaded. JSZip available:', isJSZipAvailable());