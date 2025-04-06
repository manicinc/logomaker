/**
 * gifUtils.js - v2.0 - Enhanced GIF generation utilities
 * 
 * This module provides utilities for generating animated GIFs from sequences of frames.
 * Features include:
 * - Primary method: Uses gif.js library if available for direct GIF generation
 * - Fallback: Creates a ZIP archive of PNG frames when GIF generation isn't possible
 * - Support for transparent backgrounds
 * - Progress reporting
 * - Cancellation support
 */

// Import the enhanced ZIP utilities
import { createZip, downloadZipBlob } from './zipUtils.js';

/**
 * Main function: Creates an animated GIF from frames using best available method
 * 
 * @param {Array<Blob>} frames - Array of PNG image blobs
 * @param {Object} options - Configuration options
 * @param {number} [options.width=800] - Output width in pixels
 * @param {number} [options.height=400] - Output height in pixels
 * @param {number} [options.delay=100] - Delay between frames in milliseconds
 * @param {number} [options.quality=10] - GIF quality (lower is better, 1-30)
 * @param {number} [options.repeat=0] - Repeat count (0 = infinite loop)
 * @param {boolean} [options.transparent=false] - Generate with transparent background
 * @param {string} [options.filenameBase='animation'] - Base name for output files
 * @param {Function} [options.onProgress] - Progress callback function
 * @param {string} [options.exportFormat='auto'] - Force format: 'gif', 'zip', 'individual', or 'auto'
 * @returns {Promise<{success: boolean, blob: Blob, filename: string, type: string}>}
 */
export async function generateGIF(frames, options = {}) {
    // Default options
    const {
        width = 800,
        height = 400,
        delay = 100,
        quality = 10,
        repeat = 0,
        transparent = false,
        filenameBase = 'animation',
        onProgress = null,
        exportFormat = 'auto' // 'auto', 'gif', 'zip', or 'individual'
    } = options;

    // Validate input frames
    if (!Array.isArray(frames) || frames.length === 0) {
        throw new Error('No frames provided for GIF generation');
    }
    
    // Validate that frames are PNG blobs
    const validFrames = frames.filter(f => f instanceof Blob);
    if (validFrames.length === 0) {
        throw new Error('No valid Blob frames found for GIF generation');
    }
    
    // Warn about non-PNG frames
    if (validFrames.length !== frames.length) {
        console.warn(`[GIF Utils] ${frames.length - validFrames.length} invalid frames were filtered out`);
    }
    
    // Helper for progress updates
    const updateProgress = (msg) => {
        if (typeof onProgress === 'function') {
            try {
                onProgress(msg);
            } catch (e) {
                console.warn('[GIF Utils] Progress callback error:', e);
            }
        }
    };
    
    // Determine strategy based on availability and preferences
    const gifLibraryAvailable = typeof GIFEncoder !== 'undefined';
    let useGif = gifLibraryAvailable;
    
    // Override based on exportFormat option
    if (exportFormat === 'gif') {
        if (!gifLibraryAvailable) {
            console.warn('[GIF Utils] GIF generation requested but library unavailable, falling back to ZIP');
        }
        useGif = gifLibraryAvailable;
    } else if (exportFormat === 'zip') {
        useGif = false;
    } else if (exportFormat === 'individual') {
        // Will handle this special case separately
        useGif = false;
    }
    
    try {
        // --- Approach 1: Direct GIF generation ---
        if (useGif) {
            updateProgress('Generating GIF...');
            console.log('[GIF Utils] Attempting GIF generation with gif.js...');
            
            const gifResult = await generateAnimatedGIFWithLibrary(validFrames, {
                width, height, delay, quality, repeat, transparent,
                onProgress: (progress) => updateProgress(`Generating GIF: ${progress}`)
            });
            
            if (gifResult && gifResult.blob instanceof Blob) {
                const gifFilename = `${filenameBase}.gif`;
                return {
                    success: true,
                    blob: gifResult.blob,
                    filename: gifFilename,
                    type: 'gif'
                };
            }
            
            // If we reach here, GIF generation failed
            console.warn('[GIF Utils] GIF generation failed, falling back to ZIP');
        }
        
        // --- Approach 2: ZIP package of frames ---
        if (exportFormat !== 'individual') {
            updateProgress('Creating ZIP package of frames...');
            console.log('[GIF Utils] Creating ZIP package of animation frames...');
            
            // Prepare files for ZIP
            const filesToZip = validFrames.map((blob, index) => ({
                blob,
                name: `${filenameBase}-frame-${String(index).padStart(3, '0')}.png`
            }));
            
            // Add HTML preview file
            const previewHTML = createAnimationPreviewHTML(filenameBase, validFrames.length, width, height, delay);
            filesToZip.push({
                blob: new Blob([previewHTML], { type: 'text/html' }),
                name: `${filenameBase}-preview.html`
            });
            
            // Add simple text info file
            const infoText = createAnimationInfoText(filenameBase, validFrames.length, width, height, delay);
            filesToZip.push({
                blob: new Blob([infoText], { type: 'text/plain' }),
                name: `${filenameBase}-info.txt`
            });
            
            // Create and download ZIP
            const zipFilename = `${filenameBase}-frames.zip`;
            const zipResult = await createZip(filesToZip, zipFilename, 
                (progress) => updateProgress(`Creating ZIP: ${progress}`)
            );
            
            if (zipResult.success) {
                return {
                    success: true,
                    filename: zipFilename,
                    type: 'zip'
                };
            }
            
            // If ZIP fails and user didn't specifically request it, try individual files
            if (exportFormat === 'auto') {
                console.warn('[GIF Utils] ZIP creation failed, falling back to individual files');
                // Fall through to individual files approach
            } else {
                // User specifically wanted ZIP, so we report failure
                throw new Error(`ZIP creation failed: ${zipResult.error || 'Unknown error'}`);
            }
        }
        
        // --- Approach 3: Individual file downloads ---
        updateProgress('Preparing individual file downloads...');
        console.log('[GIF Utils] Starting individual file downloads...');
        
        // Confirmation for large numbers of files
        if (validFrames.length > 10) {
            const confirmed = confirm(`Are you sure you want to download ${validFrames.length} individual PNG files?`);
            if (!confirmed) {
                throw new Error('User cancelled individual file downloads');
            }
        }
        
        // Download frames one by one
        let downloadedCount = 0;
        for (let i = 0; i < validFrames.length; i++) {
            // Check for cancellation
            if (typeof window !== 'undefined' && window.exportCancelled) {
                throw new Error('Export cancelled by user');
            }
            
            updateProgress(`Downloading frame ${i+1}/${validFrames.length}...`);
            
            try {
                const fileName = `${filenameBase}-frame-${String(i).padStart(3, '0')}.png`;
                await downloadZipBlob(validFrames[i], fileName);
                downloadedCount++;
                
                // Small delay between downloads to avoid browser throttling
                if (i < validFrames.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (downloadError) {
                console.error(`[GIF Utils] Error downloading frame ${i}:`, downloadError);
                // Continue with other frames
            }
        }
        
        // Also download the HTML preview if multiple frames downloaded
        if (downloadedCount > 1) {
            try {
                const previewHTML = createAnimationPreviewHTML(filenameBase, validFrames.length, width, height, delay);
                const previewBlob = new Blob([previewHTML], { type: 'text/html' });
                await downloadZipBlob(previewBlob, `${filenameBase}-preview.html`);
            } catch (previewError) {
                console.error('[GIF Utils] Error downloading preview HTML:', previewError);
            }
        }
        
        return {
            success: downloadedCount > 0,
            downloadedCount,
            type: 'individual'
        };
        
    } catch (error) {
        console.error('[GIF Utils] Error during GIF/ZIP generation:', error);
        throw error; // Re-throw to allow caller to handle
    }
}

/**
 * Generates an animated GIF using the gif.js library
 * 
 * @param {Array<Blob>} frameBlobs - PNG image blobs
 * @param {Object} options - Configuration options
 * @returns {Promise<{blob: Blob}>} - GIF blob result
 * @private
 */
async function generateAnimatedGIFWithLibrary(frameBlobs, options) {
    const { width, height, delay, quality = 10, repeat = 0, transparent = false, onProgress } = options;
    
    // Check if GIF library is available
    if (typeof GIFEncoder === 'undefined') {
        console.warn('[GIF Utils] GIFEncoder library not found');
        return null;
    }
    
    // Update progress
    const updateProgress = (msg) => {
        if (typeof onProgress === 'function') {
            try {
                onProgress(msg);
            } catch (e) {
                /* ignore errors */
            }
        }
    };
    
    console.log(`[GIF Utils] Generating GIF (${width}x${height}, ${frameBlobs.length} frames, ${delay}ms delay)`);
    updateProgress('Initializing GIF generation...');
    
    try {
        // Create and configure GIF encoder
        const encoder = new GIFEncoder();
        encoder.setRepeat(repeat);
        encoder.setDelay(delay);
        encoder.setQuality(quality);
        
        // Handle transparency if requested
        if (transparent) {
            // Note: transparency handling in GIF is complex and often imperfect
            encoder.setTransparent(0x00000000); // RGBA transparent value
        }
        
        encoder.start();
        
        // Create canvas for frame rendering
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
            throw new Error('Failed to get 2D canvas context for GIF generation');
        }
        
        // Process each frame
        for (let i = 0; i < frameBlobs.length; i++) {
            // Check for cancellation
            if (typeof window !== 'undefined' && window.exportCancelled) {
                throw new Error('Export cancelled during GIF generation');
            }
            
            updateProgress(`Processing frame ${i+1}/${frameBlobs.length} (${Math.round((i/frameBlobs.length)*100)}%)`);
            
            try {
                // Load frame into an image
                const img = await createImageBitmap(frameBlobs[i]);
                
                // Clear canvas (important for transparency)
                ctx.clearRect(0, 0, width, height);
                
                // Draw frame on canvas
                ctx.drawImage(img, 0, 0, width, height);
                
                // Add frame to GIF
                encoder.addFrame(ctx);
                
                // Release bitmap memory
                img.close();
            } catch (frameError) {
                console.error(`[GIF Utils] Error processing frame ${i}:`, frameError);
                // Skip this frame and continue with others
            }
        }
        
        // Finish GIF encoding
        updateProgress('Finalizing GIF...');
        encoder.finish();
        
        // Get binary GIF data and create blob
        const gifData = encoder.stream().getData();
        const gifBlob = new Blob([gifData], { type: 'image/gif' });
        
        console.log(`[GIF Utils] GIF generated successfully. Size: ${gifBlob.size} bytes`);
        return { blob: gifBlob };
        
    } catch (gifError) {
        console.error('[GIF Utils] GIF generation error:', gifError);
        // Re-throw cancellation errors
        if (gifError.message.includes('cancelled')) {
            throw gifError;
        }
        return null;
    }
}

/**
 * Creates an HTML file to preview the animation frames
 * @param {string} filenameBase - Base name for frame filenames
 * @param {number} frameCount - Number of frames
 * @param {number} width - Animation width
 * @param {number} height - Animation height
 * @param {number} delay - Frame delay in ms
 * @returns {string} - HTML document as string
 * @private
 */
function createAnimationPreviewHTML(filenameBase, frameCount, width, height, delay) {
    const fps = Math.round(1000 / delay);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Animation Preview: ${filenameBase}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        .preview-container {
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 20px;
            margin: 20px 0;
        }
        .animation-preview {
            position: relative;
            width: ${width}px;
            height: ${height}px;
            max-width: 100%;
            margin: 0 auto;
            background-image: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
                             linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), 
                             linear-gradient(45deg, transparent 75%, #f0f0f0 75%), 
                             linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
            border: 1px solid #ddd;
            overflow: hidden;
        }
        .animation-preview img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: none;
        }
        .controls {
            margin: 15px 0;
            text-align: center;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        button {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: #2980b9;
        }
        button:disabled {
            background-color: #95a5a6;
            cursor: not-allowed;
        }
        .speed-control {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-left: 10px;
        }
        .speed-control input {
            width: 150px;
        }
        .speed-display {
            min-width: 60px;
            text-align: left;
        }
        .info-panel {
            background-color: #f1f8ff;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .info-panel h2 {
            margin-top: 0;
            color: #2c3e50;
        }
        .info-panel p {
            margin: 5px 0;
        }
        .frame-info {
            font-family: monospace;
            background-color: #f0f0f0;
            padding: 5px 10px;
            border-radius: 4px;
            margin: 5px 0;
        }
        @media (max-width: ${width + 40}px) {
            .animation-preview {
                width: 100%;
                height: auto;
                aspect-ratio: ${width} / ${height};
            }
        }
    </style>
</head>
<body>
    <h1>Animation Preview: ${filenameBase}</h1>
    
    <div class="preview-container">
        <div class="animation-preview" id="previewContainer">
            <!-- Frames will be loaded by JavaScript -->
        </div>
        
        <div class="controls">
            <button id="playBtn">Play</button>
            <button id="pauseBtn" disabled>Pause</button>
            <button id="nextFrameBtn">Next Frame</button>
            
            <div class="speed-control">
                <label for="speedSlider">Speed:</label>
                <input type="range" id="speedSlider" min="1" max="60" value="${fps}">
                <span class="speed-display" id="fpsDisplay">${fps} FPS</span>
            </div>
        </div>
        
        <div id="frameInfo" class="frame-info">Frame: 0/${frameCount-1}</div>
    </div>
    
    <div class="info-panel">
        <h2>Animation Information</h2>
        <p><strong>Total Frames:</strong> ${frameCount}</p>
        <p><strong>Dimensions:</strong> ${width}×${height} pixels</p>
        <p><strong>Default Speed:</strong> ${fps} FPS (${delay}ms delay)</p>
        <p><strong>Filename Pattern:</strong> ${filenameBase}-frame-###.png</p>
    </div>

    <script>
        // Configuration
        const frameCount = ${frameCount};
        const frameBaseName = "${filenameBase}-frame-";
        const frameExtension = ".png";
        
        // State variables
        let currentFrame = 0;
        let animationInterval = null;
        let isPlaying = false;
        let fps = ${fps};
        let frameDelay = ${delay};
        let framesLoaded = 0;
        let frameElements = [];

        // DOM elements
        const previewContainer = document.getElementById('previewContainer');
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const nextFrameBtn = document.getElementById('nextFrameBtn');
        const speedSlider = document.getElementById('speedSlider');
        const fpsDisplay = document.getElementById('fpsDisplay');
        const frameInfo = document.getElementById('frameInfo');

        // Initialize: preload image frames
        function initializePreview() {
            // Create image elements
            for (let i = 0; i < frameCount; i++) {
                const paddedIndex = String(i).padStart(3, '0');
                const img = document.createElement('img');
                img.src = \`\${frameBaseName}\${paddedIndex}\${frameExtension}\`;
                img.alt = \`Frame \${i}\`;
                img.style.display = 'none';
                previewContainer.appendChild(img);
                frameElements.push(img);
                
                // Track loaded frames
                img.onload = () => {
                    framesLoaded++;
                    // Auto-start when first frame is loaded
                    if (framesLoaded === 1) {
                        showFrame(0); // Show first frame when it loads
                    }
                    // Auto-play when all frames are loaded
                    if (framesLoaded === frameCount && frameCount > 1) {
                        playAnimation();
                    }
                };
                
                img.onerror = () => {
                    console.error(\`Could not load frame \${i}\`);
                    // This may happen if the HTML preview is opened without the frame images
                    img.alt = 'Frame not found!';
                };
            }
        }

        // Display a specific frame
        function showFrame(index) {
            // Hide all frames
            frameElements.forEach(img => img.style.display = 'none');
            
            // Show the requested frame
            if (frameElements[index]) {
                frameElements[index].style.display = 'block';
                currentFrame = index;
                frameInfo.textContent = \`Frame: \${index}/\${frameCount-1}\`;
            }
        }

        // Start the animation
        function playAnimation() {
            if (isPlaying) return;
            
            isPlaying = true;
            frameDelay = 1000 / fps;
            
            // Update button states
            playBtn.disabled = true;
            pauseBtn.disabled = false;
            
            // Start the animation loop
            animationInterval = setInterval(() => {
                currentFrame = (currentFrame + 1) % frameCount;
                showFrame(currentFrame);
            }, frameDelay);
        }

        // Pause the animation
        function pauseAnimation() {
            if (!isPlaying) return;
            
            clearInterval(animationInterval);
            animationInterval = null;
            isPlaying = false;
            
            // Update button states
            playBtn.disabled = false;
            pauseBtn.disabled = true;
        }

        // Show next frame (when paused)
        function showNextFrame() {
            if (isPlaying) return;
            
            currentFrame = (currentFrame + 1) % frameCount;
            showFrame(currentFrame);
        }

        // Update animation speed
        function updateSpeed() {
            fps = parseInt(speedSlider.value);
            frameDelay = 1000 / fps;
            fpsDisplay.textContent = \`\${fps} FPS\`;
            
            // Restart animation with new speed if playing
            if (isPlaying) {
                clearInterval(animationInterval);
                animationInterval = setInterval(() => {
                    currentFrame = (currentFrame + 1) % frameCount;
                    showFrame(currentFrame);
                }, frameDelay);
            }
        }

        // Event listeners
        playBtn.addEventListener('click', playAnimation);
        pauseBtn.addEventListener('click', pauseAnimation);
        nextFrameBtn.addEventListener('click', showNextFrame);
        speedSlider.addEventListener('input', updateSpeed);

        // Initialize the preview
        initializePreview();
    </script>
</body>
</html>`;
}

/**
 * Creates a simple info text file about the animation
 * @param {string} filenameBase - Base name for frame filenames
 * @param {number} frameCount - Number of frames
 * @param {number} width - Animation width
 * @param {number} height - Animation height
 * @param {number} delay - Frame delay in ms
 * @returns {string} - Info text content
 * @private
 */
function createAnimationInfoText(filenameBase, frameCount, width, height, delay) {
    const fps = Math.round(1000 / delay);
    const date = new Date().toISOString().split('T')[0];
    
    return `ANIMATION EXPORT INFORMATION
============================

Export Date: ${date}
Filename Base: ${filenameBase}
Frame Count: ${frameCount}
Dimensions: ${width}x${height} pixels
Frame Rate: ${fps} FPS (${delay}ms delay)

USAGE INSTRUCTIONS
-----------------
1. To view the animation, open the included HTML preview file in any browser
2. To create a GIF, you can use online tools such as:
   - ezgif.com
   - gifmaker.me
   - giphy.com/create/gifmaker
3. For video creation, import the PNG sequence into:
   - Adobe Premiere Pro
   - After Effects
   - DaVinci Resolve
   - FFmpeg (command line)

FRAME NAMING CONVENTION
----------------------
${filenameBase}-frame-000.png
${filenameBase}-frame-001.png
...and so on

For technical support, contact the tool developer.
`;
}

/**
 * Converts a Blob to a data URL
 * @param {Blob} blob - Input blob
 * @returns {Promise<string>} - Data URL
 */
export function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Export the generateAnimatedGIFFromFrames function for backward compatibility
export const generateAnimatedGIFFromFrames = generateAnimatedGIFWithLibrary;