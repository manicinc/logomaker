/**
 * zipUtils.js
 * Simple alternative to JSZip for creating ZIP files directly
 * Fallback mechanism for when JSZip is not available
 */

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