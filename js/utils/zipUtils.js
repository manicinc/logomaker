/**
 * zipUtils.js - Enhanced version with robust ZIP creation and fallbacks
 * Handles ZIP creation for animation frames export in Logomaker
 */

/**
 * Creates a ZIP file containing the provided files and triggers download
 * @param {Array<{blob: Blob, name: string}>} files - Array of file objects
 * @param {string} zipFilename - Name for the ZIP file
 */
export async function createZip(files, zipFilename) {
    console.log('[ZipUtils] Creating ZIP with', files.length, 'files');
    
    // Try to detect JSZip in different ways
    const jsZip = getJSZipInstance();
    
    if (jsZip) {
      try {
        // Use JSZip if available
        const result = await createZipWithJSZip(files, zipFilename, jsZip);
        return result;
      } catch (error) {
        console.error('[ZipUtils] JSZip creation failed:', error);
        console.log('[ZipUtils] Falling back to direct downloads');
        await downloadFilesDirectly(files);
        return true;
      }
    } else {
      console.log('[ZipUtils] JSZip not available, using direct downloads');
      // Otherwise fall back to direct downloads
      await downloadFilesDirectly(files);
      return true;
    }
  }
  
  /**
   * Tries to get JSZip from various possible locations
   * @returns {Object|null} JSZip object or null if not available
   */
  function getJSZipInstance() {
    // Check global JSZip
    if (typeof JSZip !== 'undefined') return JSZip;
    
    // Check window.JSZip
    if (typeof window !== 'undefined' && window.JSZip) return window.JSZip;
    
    // Check if it's in a different case (jszip, Jszip, etc)
    if (typeof jszip !== 'undefined') return jszip;
    if (typeof window !== 'undefined' && window.jszip) return window.jszip;
    
    // Not found
    return null;
  }
  
  /**
   * Creates a ZIP file using JSZip
   * @param {Array<{blob: Blob, name: string}>} files - Array of file objects
   * @param {string} zipFilename - Name for the ZIP file
   * @param {Object} JSZipInstance - The JSZip constructor
   */
  async function createZipWithJSZip(files, zipFilename, JSZipInstance) {
    try {
      console.log('[ZipUtils] Creating ZIP using JSZip');
      // Create a new JSZip instance
      const zip = new JSZipInstance();
      
      // Add all files to the ZIP
      files.forEach(file => {
        console.log('[ZipUtils] Adding file to ZIP:', file.name);
        zip.file(file.name, file.blob);
      });
      
      // Generate the ZIP file with progress
      console.log('[ZipUtils] Generating ZIP blob...');
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: "DEFLATE",
        compressionOptions: {
          level: 6 // Balanced between size and speed
        }
      }, (metadata) => {
        // Update progress if there's a UI element for it
        const progress = metadata.percent.toFixed(0);
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator && loadingIndicator.querySelector) {
          const progressEl = loadingIndicator.querySelector('.export-progress');
          if (progressEl) {
            progressEl.textContent = `Creating ZIP: ${progress}%`;
          }
        }
      });
      
      console.log('[ZipUtils] ZIP blob created, size:', zipBlob.size, 'bytes');
      
      // Download the ZIP
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      console.log('[ZipUtils] ZIP download triggered successfully');
      return true;
    } catch (error) {
      console.error("[ZipUtils] JSZip creation error:", error);
      throw error;
    }
  }
  
  /**
   * Downloads files one by one as a fallback
   * @param {Array<{blob: Blob, name: string}>} files - Array of file objects
   */
  export async function downloadFilesDirectly(files) {
    // Notify the user about multiple downloads
    if (typeof showAlert === 'function') {
      showAlert(`ZIP creation failed. You will receive ${files.length} separate download prompts for the animation frames.`, 'warning');
    } else {
      alert(`ZIP creation failed. You will receive ${files.length} separate download prompts for the animation frames.`);
    }
    
    console.log('[ZipUtils] Downloading', files.length, 'files directly');
    
    // Download HTML preview and info text first if they exist
    const htmlFile = files.find(file => file.name.endsWith('.html'));
    const infoFile = files.find(file => file.name.endsWith('.txt'));
    
    const priorityFiles = [];
    if (htmlFile) priorityFiles.push(htmlFile);
    if (infoFile) priorityFiles.push(infoFile);
    
    // Then get all PNG files
    const pngFiles = files.filter(file => 
      file.name.endsWith('.png') && 
      !priorityFiles.includes(file)
    );
    
    // Download priority files first
    for (const file of priorityFiles) {
      await downloadSingleFile(file);
      // Short delay between downloads
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Ask user if they want to download all the PNG frames
    let downloadAll = true;
    if (pngFiles.length > 5) {
      downloadAll = confirm(`Do you want to download all ${pngFiles.length} image frames? Click Cancel to download just the first and last frames instead.`);
    }
    
    // Download PNG files
    if (downloadAll) {
      // Download all frames with progress updates
      for (let i = 0; i < pngFiles.length; i++) {
        const file = pngFiles[i];
        console.log(`[ZipUtils] Downloading file ${i+1}/${pngFiles.length}: ${file.name}`);
        
        // Update loading indicator if available
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator && loadingIndicator.querySelector) {
          const progressEl = loadingIndicator.querySelector('.export-progress');
          if (progressEl) {
            progressEl.textContent = `Downloading frame ${i+1}/${pngFiles.length}`;
          }
        }
        
        await downloadSingleFile(file);
        
        // Short delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      // Download just first and last frame
      if (pngFiles.length > 0) {
        await downloadSingleFile(pngFiles[0]);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (pngFiles.length > 1) {
          await downloadSingleFile(pngFiles[pngFiles.length - 1]);
        }
      }
    }
    
    console.log('[ZipUtils] All downloads completed');
    return true;
  }
  
  /**
   * Download a single file
   * @param {Object} file - File object with blob and name
   */
  async function downloadSingleFile(file) {
    return new Promise((resolve) => {
      // Create a download link
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up after a short delay
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve();
      }, 100);
    });
  }
  
  /**
   * Check if JSZip is available
   * @returns {boolean} True if JSZip is available
   */
  export function isJSZipAvailable() {
    return getJSZipInstance() !== null;
  }
  
  /**
   * Get estimated ZIP size based on file sizes
   * @param {Array<{blob: Blob, name: string}>} files - Array of file objects
   * @returns {string} Estimated size in KB or MB
   */
  export function getEstimatedZipSize(files) {
    // Sum up all file sizes
    const totalBytes = files.reduce((sum, file) => sum + file.blob.size, 0);
    
    // Apply rough compression estimate (ZIP typically compresses by ~30-60%)
    const estimatedCompressedBytes = totalBytes * 0.7; // Assuming 30% compression
    
    // Format size
    if (estimatedCompressedBytes < 1024 * 1024) {
      return `${Math.round(estimatedCompressedBytes / 1024)} KB`;
    } else {
      return `${(estimatedCompressedBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  // ADD to the bottom of zipUtils.js - a minimal ZIP implementation
/**
 * Create a basic ZIP file with no external dependencies
 * @param {Array<{blob: Blob, name: string}>} files - Files to include
 * @param {string} filename - Output filename
 */
export async function createBasicZip(files, filename) {
  // Warning: This is a very basic ZIP implementation
  // It won't handle compression but will create a valid ZIP structure
  
  console.log("[BasicZip] Creating ZIP with", files.length, "files");
  
  // Constants for ZIP format
  const LOCAL_FILE_HEADER_SIGNATURE = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
  const CENTRAL_DIRECTORY_SIGNATURE = new Uint8Array([0x50, 0x4B, 0x01, 0x02]);
  const END_OF_CENTRAL_DIR_SIGNATURE = new Uint8Array([0x50, 0x4B, 0x05, 0x06]);
  
  // Helpers
  const textEncoder = new TextEncoder();
  function encodeString(str) {
    return textEncoder.encode(str);
  }
  
  function writeUint16LE(value) {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setUint16(0, value, true);
    return new Uint8Array(buffer);
  }
  
  function writeUint32LE(value) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, value, true);
    return new Uint8Array(buffer);
  }
  
  // Create parts for the ZIP
  const localFileHeaders = [];
  const fileData = [];
  const centralDirectoryHeaders = [];
  let offset = 0;
  
  // Process each file
  for (const file of files) {
    const filenameBytes = encodeString(file.name);
    const fileContent = await file.blob.arrayBuffer().then(buf => new Uint8Array(buf));
    const fileSize = fileContent.length;
    
    // Local file header
    const localHeader = new Uint8Array([
      ...LOCAL_FILE_HEADER_SIGNATURE,              // Signature
      ...writeUint16LE(10),                        // Version needed
      ...writeUint16LE(0),                         // Flags
      ...writeUint16LE(0),                         // Compression method (0 = stored)
      ...writeUint16LE(0),                         // Modification time
      ...writeUint16LE(0),                         // Modification date
      ...writeUint32LE(0),                         // CRC-32 (not calculated)
      ...writeUint32LE(fileSize),                  // Compressed size
      ...writeUint32LE(fileSize),                  // Uncompressed size
      ...writeUint16LE(filenameBytes.length),      // Filename length
      ...writeUint16LE(0),                         // Extra field length
      ...filenameBytes                             // Filename
    ]);
    
    // Store header and update offset
    localFileHeaders.push(localHeader);
    fileData.push(fileContent);
    
    // Central directory header
    const centralDirHeader = new Uint8Array([
      ...CENTRAL_DIRECTORY_SIGNATURE,              // Signature
      ...writeUint16LE(0),                         // Version made by
      ...writeUint16LE(10),                        // Version needed
      ...writeUint16LE(0),                         // Flags
      ...writeUint16LE(0),                         // Compression method
      ...writeUint16LE(0),                         // Modification time
      ...writeUint16LE(0),                         // Modification date
      ...writeUint32LE(0),                         // CRC-32
      ...writeUint32LE(fileSize),                  // Compressed size
      ...writeUint32LE(fileSize),                  // Uncompressed size
      ...writeUint16LE(filenameBytes.length),      // Filename length
      ...writeUint16LE(0),                         // Extra field length
      ...writeUint16LE(0),                         // File comment length
      ...writeUint16LE(0),                         // Disk number
      ...writeUint16LE(0),                         // Internal attributes
      ...writeUint32LE(0),                         // External attributes
      ...writeUint32LE(offset),                    // Local header offset
      ...filenameBytes                             // Filename
    ]);
    
    centralDirectoryHeaders.push(centralDirHeader);
    offset += localHeader.length + fileContent.length;
  }
  
  // End of central directory record
  const centralDirSize = centralDirectoryHeaders.reduce((sum, header) => sum + header.length, 0);
  const endOfCentralDir = new Uint8Array([
    ...END_OF_CENTRAL_DIR_SIGNATURE,               // Signature
    ...writeUint16LE(0),                           // Disk number
    ...writeUint16LE(0),                           // Disk with central directory
    ...writeUint16LE(files.length),                // Number of entries (this disk)
    ...writeUint16LE(files.length),                // Number of entries (total)
    ...writeUint32LE(centralDirSize),              // Central directory size
    ...writeUint32LE(offset),                      // Central directory offset
    ...writeUint16LE(0)                            // Comment length
  ]);
  
  // Combine all parts into a single array
  const zipParts = [];
  for (let i = 0; i < files.length; i++) {
    zipParts.push(localFileHeaders[i]);
    zipParts.push(fileData[i]);
  }
  
  centralDirectoryHeaders.forEach(header => zipParts.push(header));
  zipParts.push(endOfCentralDir);
  
  // Create the final ZIP blob
  const blob = new Blob(zipParts, { type: 'application/zip' });
  
  // Download the ZIP
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  
  return true;
}

/**
 * Simple ZIP Creation Utility for Browser-based ZIP Package Generation
 * Supports creating ZIP files without external libraries
 */

// ZIP Local File Header signature
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
// ZIP Central Directory File Header signature
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
// ZIP End of Central Directory signature
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

/**
 * Convert number to little-endian 4-byte array
 * @param {number} num - Number to convert
 * @returns {Uint8Array} Little-endian byte representation
 */
function numberToLittleEndian4Bytes(num) {
    const arr = new Uint8Array(4);
    arr[0] = num & 0xFF;
    arr[1] = (num >> 8) & 0xFF;
    arr[2] = (num >> 16) & 0xFF;
    arr[3] = (num >> 24) & 0xFF;
    return arr;
}

/**
 * Convert number to little-endian 2-byte array
 * @param {number} num - Number to convert
 * @returns {Uint8Array} Little-endian byte representation
 */
function numberToLittleEndian2Bytes(num) {
    const arr = new Uint8Array(2);
    arr[0] = num & 0xFF;
    arr[1] = (num >> 8) & 0xFF;
    return arr;
}

/**
 * Get current timestamp for ZIP file
 * @returns {number} DOS-style date/time
 */
function getDOSDateTime() {
    const date = new Date();
    const year = date.getFullYear() - 1980; // DOS year starts from 1980
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds() / 2; // DOS seconds are stored in 2-second intervals

    return (
        (year << 25) | 
        (month << 21) | 
        (day << 16) | 
        (hours << 11) | 
        (minutes << 5) | 
        seconds
    );
}

/**
 * Calculate CRC32 checksum for a Uint8Array
 * @param {Uint8Array} data - Data to checksum
 * @returns {number} CRC32 checksum
 */
function calculateCRC32(data) {
    const table = new Uint32Array(256);
    
    // Generate CRC32 lookup table
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    
    let crc = 0xFFFFFFFF;
    
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }
    
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Convert a Blob to Uint8Array
 * @param {Blob} blob - Blob to convert
 * @returns {Promise<Uint8Array>} Converted blob data
 */
function blobToUint8Array(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const arrayBuffer = reader.result;
            resolve(new Uint8Array(arrayBuffer));
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
}

/**
 * Create a simple ZIP file from an array of files
 * @param {Array<{name: string, blob: Blob}>} files - Files to zip
 * @returns {Promise<Blob>} ZIP file blob
 */
export async function createSimpleZip(files, zipFilename = 'archive.zip') {
    // Validate inputs
    if (!files || files.length === 0) {
        throw new Error('No files provided for ZIP creation');
    }

    // Prepare central directory and local file headers
    const centralDirectoryHeaders = [];
    const localFileHeaders = [];
    let totalSize = 0;
    
    // Process each file
    const processedFiles = await Promise.all(files.map(async (file, index) => {
        const fileData = await blobToUint8Array(file.blob);
        const filename = file.name.replace(/\\/g, '/');
        const crc32 = calculateCRC32(fileData);
        
        // Create local file header
        const localHeader = new Uint8Array([
            ...numberToLittleEndian4Bytes(LOCAL_FILE_HEADER_SIGNATURE), // Signature
            0x14, 0x00, // Version needed to extract
            0x00, 0x00, // General Purpose Flag
            0x00, 0x00, // Compression Method (0 = no compression)
            ...numberToLittleEndian4Bytes(getDOSDateTime()), // Last Modified Time
            ...numberToLittleEndian4Bytes(crc32), // CRC-32
            ...numberToLittleEndian4Bytes(fileData.length), // Compressed Size
            ...numberToLittleEndian4Bytes(fileData.length), // Uncompressed Size
            ...numberToLittleEndian2Bytes(filename.length), // Filename Length
            0x00, 0x00, // Extra Field Length
        ]);
        
        // Add filename to local header
        const filenameBytes = new TextEncoder().encode(filename);
        const localHeaderWithFilename = new Uint8Array([
            ...localHeader,
            ...filenameBytes
        ]);
        
        // Create central directory file header
        const centralHeader = new Uint8Array([
            ...numberToLittleEndian4Bytes(CENTRAL_DIRECTORY_HEADER_SIGNATURE), // Signature
            0x14, 0x00, // Version Made By
            0x14, 0x00, // Version Needed to Extract
            0x00, 0x00, // General Purpose Flag
            0x00, 0x00, // Compression Method
            ...numberToLittleEndian4Bytes(getDOSDateTime()), // Last Modified Time
            ...numberToLittleEndian4Bytes(crc32), // CRC-32
            ...numberToLittleEndian4Bytes(fileData.length), // Compressed Size
            ...numberToLittleEndian4Bytes(fileData.length), // Uncompressed Size
            ...numberToLittleEndian2Bytes(filename.length), // Filename Length
            0x00, 0x00, // Extra Field Length
            0x00, 0x00, // File Comment Length
            0x00, 0x00, // Disk Number Start
            0x00, 0x00, // Internal File Attributes
            0x00, 0x00, 0x00, 0x00, // External File Attributes
            ...numberToLittleEndian4Bytes(totalSize) // Relative Offset of Local Header
        ]);
        
        // Add filename to central header
        const centralHeaderWithFilename = new Uint8Array([
            ...centralHeader,
            ...filenameBytes
        ]);
        
        // Calculate total size for next iteration
        const completeFileSize = localHeaderWithFilename.length + fileData.length;
        totalSize += completeFileSize;
        
        return {
            localHeader: localHeaderWithFilename,
            centralHeader: centralHeaderWithFilename,
            fileData,
            index
        };
    }));
    
    // Prepare end of central directory record
    const centralDirectorySize = processedFiles.reduce((sum, file) => sum + file.centralHeader.length, 0);
    const centralDirectoryOffset = processedFiles.reduce((sum, file) => sum + file.localHeader.length + file.fileData.length, 0);
    
    const endOfCentralDirectoryRecord = new Uint8Array([
        ...numberToLittleEndian4Bytes(END_OF_CENTRAL_DIRECTORY_SIGNATURE), // Signature
        0x00, 0x00, // Number of this Disk
        0x00, 0x00, // Disk where Central Directory starts
        ...numberToLittleEndian2Bytes(processedFiles.length), // Number of Central Directory Records on this Disk
        ...numberToLittleEndian2Bytes(processedFiles.length), // Total Number of Central Directory Records
        ...numberToLittleEndian4Bytes(centralDirectorySize), // Size of Central Directory
        ...numberToLittleEndian4Bytes(centralDirectoryOffset), // Offset of Central Directory
        0x00, 0x00, // ZIP file comment length
    ]);
    
    // Combine all parts
    const zipParts = [];
    processedFiles.forEach(file => {
        zipParts.push(file.localHeader, file.fileData);
    });
    
    processedFiles.forEach(file => {
        zipParts.push(file.centralHeader);
    });
    
    zipParts.push(endOfCentralDirectoryRecord);
    
    // Create final ZIP blob
    const zipBlob = new Blob(zipParts, { type: 'application/zip' });
    
    return zipBlob;
}

// Fallback download function if no global download utility exists
export function downloadZipBlob(blob, filename = 'archive.zip') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
}