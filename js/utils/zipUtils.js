/**
 * zipUtils.js - v1.1 - Enhanced ZIP creation with JSZip preference and fallback.
 * Handles ZIP creation for animation frames export in Logomaker.
 * Includes dependency-free fallback for basic ZIP creation (no compression, no CRC32).
 */

// --- Configuration ---
const JSZIP_COMPRESSION_LEVEL = 6; // 0-9 (0 = store, 9 = best but slow)

// --- Helper Functions ---

/**
 * Tries to get the JSZip constructor/class from various possible locations.
 * @returns {Object|null} JSZip class/constructor or null if not found.
 */
function getJSZipInstance() {
    // Check standard locations first
    if (typeof window !== 'undefined') {
        if (typeof window.JSZip === 'function') return window.JSZip;
        if (typeof window.jszip === 'function') return window.jszip; // Handle lowercase case
    }
    // Check global scope as fallback
    if (typeof JSZip === 'function') return JSZip;
    if (typeof jszip === 'function') return jszip;

    // Not found
    return null;
}

/**
 * Downloads a Blob object by creating a temporary link.
 * @param {Blob} blob - The Blob to download.
 * @param {string} filename - The desired filename for the download.
 */
export function downloadZipBlob(blob, filename = 'archive.zip') {
    if (!blob || !(blob instanceof Blob)) {
        console.error('[ZipUtils Download] Invalid Blob provided for download.');
        return;
    }
    if (!filename || typeof filename !== 'string') {
        filename = 'archive.zip';
    }
    console.log(`[ZipUtils Download] Triggering download for '${filename}', size: ${(blob.size / 1024).toFixed(1)} KB`);
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up the object URL after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 250);
         console.log('[ZipUtils Download] Download link clicked.');
    } catch (err) {
        console.error('[ZipUtils Download] Error triggering download:', err);
        // Optionally notify the user via showAlert if available
        if (typeof showAlert === 'function') {
             showAlert(`Download failed: ${err.message}`, 'error');
        }
    }
}


/**
 * Creates a ZIP file using JSZip library.
 * @param {Array<{blob: Blob, name: string}>} files - Array of file objects { blob, name }.
 * @param {string} zipFilename - Desired name for the output ZIP file.
 * @param {Object} JSZipConstructor - The JSZip constructor function.
 * @param {function(number):void} [progressCallback] - Optional callback for progress (0-100).
 * @returns {Promise<boolean>} Promise resolving true on success, false on failure (triggers fallback).
 */
async function createZipWithJSZip(files, zipFilename, JSZipConstructor, progressCallback) {
    console.log('[ZipUtils JSZip] Attempting ZIP creation using JSZip...');
    try {
        const zip = new JSZipConstructor();

        // Add files to the zip
        files.forEach(file => {
            if (file.blob instanceof Blob && typeof file.name === 'string') {
                zip.file(file.name, file.blob);
            } else {
                 console.warn('[ZipUtils JSZip] Skipping invalid file entry:', file);
            }
        });

        console.log('[ZipUtils JSZip] Generating ZIP blob...');
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: "DEFLATE",
            compressionOptions: {
                level: JSZIP_COMPRESSION_LEVEL
            },
            streamFiles: true // Helps with memory for many/large files
        }, (metadata) => {
            // Call the external progress callback if provided
            if (typeof progressCallback === 'function') {
                const percent = metadata.percent ? metadata.percent.toFixed(0) : 0;
                // Avoid flooding caller with updates
                if (percent % 5 === 0 || percent == 100) {
                    try {
                         progressCallback(parseInt(percent));
                    } catch(cbError) {
                         console.warn('[ZipUtils JSZip] Progress callback error:', cbError);
                    }
                }
            }
            // Check for cancellation flag if passed/accessible
            // if (window.exportCancelled) { throw new Error("Export cancelled during JSZip generation"); }
        });

        console.log('[ZipUtils JSZip] ZIP blob generated successfully. Size:', zipBlob.size);
        downloadZipBlob(zipBlob, zipFilename); // Trigger download directly
        return true; // Indicate success

    } catch (error) {
        console.error("[ZipUtils JSZip] JSZip creation failed:", error);
        return false; // Indicate failure to trigger fallback
    }
}

// --- Dependency-Free Fallback ZIP Creation (No Compression, No CRC32) ---

// Constants for manual ZIP format
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

// Helper to write Uint16 Little Endian
function writeUint16LE(value, buffer, offset) {
    new DataView(buffer).setUint16(offset, value, true);
}
// Helper to write Uint32 Little Endian
function writeUint32LE(value, buffer, offset) {
    new DataView(buffer).setUint32(offset, value, true);
}

// Get DOS Date/Time for ZIP headers
function getDOSDateTime() {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2); // DOS resolution is 2 seconds

    if (year < 1980) return 0x2100; // Default if date is before 1980

    const dosTime = (hours << 11) | (minutes << 5) | seconds;
    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    return (dosDate << 16) | dosTime;
}

// Helper to convert Blob to Uint8Array
function blobToUint8Array(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(new Uint8Array(reader.result));
            } else {
                 reject(new Error("FileReader did not return ArrayBuffer"));
            }
        };
        reader.onerror = (event) => reject(new Error(`FileReader error: ${event?.target?.error || 'Unknown'}`));
        reader.readAsArrayBuffer(blob);
    });
}

/**
 * Creates a very basic, uncompressed ZIP file blob without external dependencies.
 * Skips CRC32 calculation for performance.
 * @param {Array<{blob: Blob, name: string}>} files - Array of file objects { blob, name }.
 * @returns {Promise<Blob>} Promise resolving with the generated ZIP Blob.
 */
export async function createSimpleUncompressedZip(files) {
    console.warn("[ZipUtils Simple] Creating UNCOMPRESSED ZIP (No CRC32) as fallback...");
    if (!files || files.length === 0) throw new Error('No files provided for simple ZIP creation');

    const zipParts = [];
    const centralDirectoryHeaders = [];
    let currentOffset = 0;
    const textEncoder = new TextEncoder();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!(file.blob instanceof Blob) || typeof file.name !== 'string') {
            console.warn(`[ZipUtils Simple] Skipping invalid file entry at index ${i}:`, file);
            continue;
        }

        const fileData = await blobToUint8Array(file.blob);
        const filename = file.name.replace(/\\/g, '/'); // Sanitize path separators
        const filenameBytes = textEncoder.encode(filename);
        const fileSize = fileData.length;
        const crc32 = 0; // Set CRC32 to 0 for uncompressed data (performance)
        const dosDateTime = getDOSDateTime();

        // --- Local File Header (30 bytes + filename length) ---
        const localHeaderBuffer = new ArrayBuffer(30);
        const localHeaderView = new DataView(localHeaderBuffer);
        writeUint32LE(LOCAL_FILE_HEADER_SIGNATURE, localHeaderBuffer, 0);  // Signature
        writeUint16LE(20, localHeaderBuffer, 4);   // Version needed (2.0 for DEFLATE/Stored)
        writeUint16LE(0, localHeaderBuffer, 6);    // General Purpose Flag (Bit 3=0 => sizes/CRC are in header)
        writeUint16LE(0, localHeaderBuffer, 8);    // Compression Method (0 = Stored)
        writeUint32LE(dosDateTime, localHeaderBuffer, 10); // Last Mod Time/Date
        writeUint32LE(crc32, localHeaderBuffer, 14); // CRC-32 (0)
        writeUint32LE(fileSize, localHeaderBuffer, 18); // Compressed Size (same as uncompressed)
        writeUint32LE(fileSize, localHeaderBuffer, 22); // Uncompressed Size
        writeUint16LE(filenameBytes.length, localHeaderBuffer, 26); // Filename Length
        writeUint16LE(0, localHeaderBuffer, 28);   // Extra Field Length

        zipParts.push(new Uint8Array(localHeaderBuffer)); // Add header part
        zipParts.push(filenameBytes); // Add filename part
        zipParts.push(fileData);      // Add file data part

        // --- Central Directory Header (46 bytes + filename length) ---
        const centralHeaderBuffer = new ArrayBuffer(46);
        const centralHeaderView = new DataView(centralHeaderBuffer);
        writeUint32LE(CENTRAL_DIRECTORY_HEADER_SIGNATURE, centralHeaderBuffer, 0); // Signature
        writeUint16LE(20, centralHeaderBuffer, 4);    // Version Made By
        writeUint16LE(20, centralHeaderBuffer, 6);    // Version Needed
        writeUint16LE(0, centralHeaderBuffer, 8);     // General Purpose Flag
        writeUint16LE(0, centralHeaderBuffer, 10);    // Compression Method
        writeUint32LE(dosDateTime, centralHeaderBuffer, 12); // Last Mod Time/Date
        writeUint32LE(crc32, centralHeaderBuffer, 16); // CRC-32 (0)
        writeUint32LE(fileSize, centralHeaderBuffer, 20); // Compressed Size
        writeUint32LE(fileSize, centralHeaderBuffer, 24); // Uncompressed Size
        writeUint16LE(filenameBytes.length, centralHeaderBuffer, 28); // Filename Length
        writeUint16LE(0, centralHeaderBuffer, 30);    // Extra Field Length
        writeUint16LE(0, centralHeaderBuffer, 32);    // File Comment Length
        writeUint16LE(0, centralHeaderBuffer, 34);    // Disk Number Start
        writeUint16LE(0, centralHeaderBuffer, 36);    // Internal Attributes
        writeUint32LE(0, centralHeaderBuffer, 38);    // External Attributes
        writeUint32LE(currentOffset, centralHeaderBuffer, 42); // Relative Offset of Local Header

        const centralHeaderFull = new Uint8Array(46 + filenameBytes.length);
        centralHeaderFull.set(new Uint8Array(centralHeaderBuffer));
        centralHeaderFull.set(filenameBytes, 46);
        centralDirectoryHeaders.push(centralHeaderFull); // Store full central header

        // Update offset for the next local file header
        currentOffset += 30 + filenameBytes.length + fileSize;
    }

    // --- End of Central Directory Record (22 bytes) ---
    const centralDirSize = centralDirectoryHeaders.reduce((sum, h) => sum + h.length, 0);
    const centralDirOffset = currentOffset; // Offset is where CD starts

    const eocdBuffer = new ArrayBuffer(22);
    const eocdView = new DataView(eocdBuffer);
    writeUint32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, eocdBuffer, 0); // Signature
    writeUint16LE(0, eocdBuffer, 4);  // Disk number
    writeUint16LE(0, eocdBuffer, 6);  // Disk where CD starts
    writeUint16LE(centralDirectoryHeaders.length, eocdBuffer, 8);  // Entries on this disk
    writeUint16LE(centralDirectoryHeaders.length, eocdBuffer, 10); // Total entries
    writeUint32LE(centralDirSize, eocdBuffer, 12); // Size of Central Directory
    writeUint32LE(centralDirOffset, eocdBuffer, 16); // Offset of Central Directory
    writeUint16LE(0, eocdBuffer, 20); // Comment length

    // Add central directory headers and EOCD record to the parts
    centralDirectoryHeaders.forEach(h => zipParts.push(h));
    zipParts.push(new Uint8Array(eocdBuffer));

    // Create the final Blob
    console.log("[ZipUtils Simple] Assembling final Blob...");
    const zipBlob = new Blob(zipParts, { type: 'application/zip' });
    console.log("[ZipUtils Simple] Blob assembled, size:", zipBlob.size);
    return zipBlob;
}

// --- Fallback: Direct Downloads ---

/**
 * Downloads files individually as a fallback if ZIP creation fails.
 * @param {Array<{blob: Blob, name: string}>} files - Array of file objects { blob, name }.
 * @returns {Promise<boolean>} Always resolves true after attempting downloads.
 */
async function downloadFilesDirectly(files) {
    console.warn('[ZipUtils Fallback] Initiating direct file downloads.');
    if (typeof showAlert === 'function') {
        showAlert(`Automatic ZIP creation failed. You may receive multiple download prompts (${files.length} files). Please check your browser settings if downloads are blocked.`, 'warning');
    } else {
        alert(`Automatic ZIP creation failed. You will receive ${files.length} separate download prompts.`);
    }

    // Prioritize HTML/TXT files
    const priorityFiles = files.filter(f => f.name.endsWith('.html') || f.name.endsWith('.txt'));
    const otherFiles = files.filter(f => !priorityFiles.includes(f));

    const downloadQueue = [...priorityFiles, ...otherFiles];

    // Ask user confirmation for large number of files
    let confirmed = true;
    const fileThreshold = 10; // Ask if more than 10 files
    if (downloadQueue.length > fileThreshold) {
        confirmed = confirm(`ZIP failed. Download all ${downloadQueue.length} files individually? (Click Cancel to skip)`);
    }

    if (!confirmed) {
        console.log('[ZipUtils Fallback] User cancelled direct downloads.');
        if (typeof showAlert === 'function') showAlert('Direct downloads skipped by user.', 'info');
        return true; // Indicate fallback process finished (by cancellation)
    }

    // Download with delays
    for (let i = 0; i < downloadQueue.length; i++) {
        const file = downloadQueue[i];
        console.log(`[ZipUtils Fallback] Downloading file ${i + 1}/${downloadQueue.length}: ${file.name}`);
        // Update UI progress if possible
         const progressTextElement = document.getElementById('gifExporterModalProgressText');
         if (progressTextElement) {
              progressTextElement.textContent = `Fallback: Downloading file ${i + 1}/${downloadQueue.length}...`;
         }

        try {
             await downloadSingleFile(file); // Use separate helper
        } catch (dlError) {
             console.error(`[ZipUtils Fallback] Error downloading ${file.name}:`, dlError);
             // Optionally inform user about specific file failure
             if (typeof showAlert === 'function') showAlert(`Failed to download ${file.name}. You may need to try exporting again.`, 'error');
             // Decide whether to continue or stop on error
             // continue; // Continue with next file
             return true; // Stop fallback on first error? Return true as process "finished"
        }

        // Short delay between downloads to avoid browser blocking issues
        await new Promise(resolve => setTimeout(resolve, 350)); // 350ms delay
    }

    console.log('[ZipUtils Fallback] All direct downloads attempted.');
     if (typeof showAlert === 'function') showAlert('Direct downloads initiated. Check your downloads folder.', 'info');
    return true; // Indicate fallback process finished
}

/**
 * Helper to download a single file using createObjectURL.
 * @param {{blob: Blob, name: string}} file - The file object.
 */
async function downloadSingleFile(file) {
    return new Promise((resolve, reject) => {
        try {
            downloadZipBlob(file.blob, file.name); // Reuse the export helper
            // Resolve slightly after click to allow download to initiate
             setTimeout(resolve, 100);
         } catch(err) {
             reject(err);
         }
    });
}

// --- Main Exported Function ---

/**
 * Creates a ZIP file containing the provided files.
 * Prefers using JSZip if available, falls back to simple uncompressed ZIP,
 * and finally falls back to downloading files individually.
 * @param {Array<{blob: Blob, name: string}>} files - Array of file objects { blob, name }.
 * @param {string} zipFilename - Desired name for the output ZIP file.
 * @param {function(number):void} [progressCallbackUI] - Optional callback for UI progress (0-100).
 * @returns {Promise<boolean>} Promise resolving true if download was initiated (either ZIP or fallback), false otherwise.
 */
export async function createZip(files, zipFilename, progressCallbackUI) {
    console.log(`[ZipUtils] createZip called for ${files.length} files. Filename: ${zipFilename}`);
    const JSZip = getJSZipInstance();

    if (JSZip) {
        console.log('[ZipUtils] JSZip detected. Attempting JSZip creation...');
        const success = await createZipWithJSZip(files, zipFilename, JSZip, (percent) => {
            // Call the UI progress callback if it exists
             if (typeof progressCallbackUI === 'function') {
                 try {
                      progressCallbackUI(percent);
                 } catch (e) { console.warn("UI Progress callback error:", e); }
             }
        });

        if (success) {
            console.log('[ZipUtils] JSZip creation and download successful.');
            return true;
        } else {
            console.warn('[ZipUtils] JSZip creation failed. Attempting simple uncompressed ZIP fallback...');
            // Fall through to simple ZIP if JSZip failed but didn't throw catastrophically
        }
    } else {
        console.log('[ZipUtils] JSZip not detected. Attempting simple uncompressed ZIP fallback...');
    }

    // --- Fallback 1: Simple Uncompressed ZIP ---
    try {
        const simpleZipBlob = await createSimpleUncompressedZip(files);
        if (simpleZipBlob) {
            console.log('[ZipUtils] Simple uncompressed ZIP created successfully.');
            downloadZipBlob(simpleZipBlob, zipFilename);
            return true; // Indicate success
        } else {
            throw new Error("Simple ZIP creation returned no blob.");
        }
    } catch (simpleZipError) {
        console.error('[ZipUtils] Simple uncompressed ZIP creation failed:', simpleZipError);
        console.warn('[ZipUtils] Falling back to downloading files individually.');
        // Fall through to direct downloads
    }

    // --- Fallback 2: Direct Downloads ---
    try {
        // This function now handles user notification and download triggers
        await downloadFilesDirectly(files);
        return true; // Indicate direct downloads were attempted
    } catch (fallbackError) {
        console.error('[ZipUtils] Direct download fallback failed catastrophically:', fallbackError);
         if (typeof showAlert === 'function') showAlert(`Critical error during export fallback: ${fallbackError.message}`, 'error');
        return false; // Indicate complete failure
    }
}

// --- Utility Exports ---

/**
 * Check if JSZip library is likely available.
 * @returns {boolean} True if JSZip seems available.
 */
export function isJSZipAvailable() {
    return getJSZipInstance() !== null;
}

/**
 * Get estimated ZIP size based on raw file sizes (simple approximation).
 * @param {Array<{blob: Blob}>} files - Array of file objects.
 * @returns {string} Estimated size string (e.g., "1.2 MB").
 */
export function getEstimatedZipSize(files) {
    if (!files || files.length === 0) return "0 KB";
    const totalBytes = files.reduce((sum, file) => sum + (file?.blob?.size || 0), 0);

    // Simple guess: Assume ~10-20% reduction if JSZip is used, otherwise ~0% for simple zip.
    const compressionFactor = isJSZipAvailable() ? 0.85 : 1.0;
    const estimatedBytes = totalBytes * compressionFactor;

    if (estimatedBytes < 1024) return `${Math.round(estimatedBytes)} B`;
    if (estimatedBytes < 1024 * 1024) return `${Math.round(estimatedBytes / 1024)} KB`;
    return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
}

console.log('[ZipUtils v1.1] Module Loaded.');