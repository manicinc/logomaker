/**
 * RendererCore.js
 * ====================================================
 * Centralized rendering pipeline for SVG, PNG and GIF exports.
 * This ensures consistency across all export formats.
 */

import { getFinalTextStyles } from '../captureTextStyles.js';
import { getCurrentStyleConfig } from '../styleSync.js';

/** 
 * Centralized function to generate an SVG blob with all styles
 * @param {Object} options - Export options
 * @returns {Promise<Blob>} - SVG blob with embedded styles
 */
export async function generateSVGBlob(options = {}) {
    console.log("[Renderer Core] Generating SVG blob with options:", options);
    try {
        const currentSettings = window.SettingsManager?.getCurrentSettings?.() || {};
        const defaults = {
            width: parseInt(currentSettings.exportWidth || '800'),
            height: parseInt(currentSettings.exportHeight || '400'),
            text: currentSettings.logoText || 'Logo',
            includeBackground: true,
            transparentBackground: currentSettings.exportTransparent || false,
        };
        const config = { ...defaults, ...options };
        if(config.width <= 0 || config.height <= 0) throw new Error("Invalid SVG dimensions");

        // Capture all styles
        const styles = getFinalTextStyles();
        if (!styles) throw new Error('Failed to capture styles');
        console.log("[Renderer Core] Styles captured:", JSON.stringify(styles));

        // Build SVG string
        let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">\n`;

        // Defs (Gradients, Filters, Background Gradient)
        svg += `<defs>\n`;
        const gradientDef = createGradientDef(styles); if (gradientDef) svg += `\t${gradientDef}\n`;
        const filterDef = createFilterDef(styles); if (filterDef) svg += `\t${filterDef}\n`;
        let bgGradientId = null;
        if (config.includeBackground && !config.transparentBackground && styles.backgroundTypeClass?.includes('gradient')) {
            bgGradientId = 'svgBgGradient';
            const bgC1 = normalizeColor(currentSettings.bgColor1 || '#3a1c71'); const bgC2 = normalizeColor(currentSettings.bgColor2 || '#ffaf7b'); const bgDir = parseInt(currentSettings.bgGradientDirection || '90');
            const x2_bg = (bgDir === 0 || bgDir === 180) ? "0%" : "100%"; const y2_bg = (bgDir === 90 || bgDir === 270) ? "0%" : "100%";
            svg += `\t<linearGradient id="${bgGradientId}" x1="0%" y1="0%" x2="${x2_bg}" y2="${y2_bg}">\n\t\t<stop offset="0%" stop-color="${bgC1}"/>\n\t\t<stop offset="100%" stop-color="${bgC2}"/>\n\t</linearGradient>\n`;
        }
        svg += `</defs>\n`;
        console.log("[Renderer Core] Defs generated.");

        // Embedded Styles (<style> with CDATA)
        const embeddedCSS = await generateEmbeddedCSS(styles);
        if (embeddedCSS && embeddedCSS.trim() !== '/* Embedded CSS */') {
            svg += `<style type="text/css"><![CDATA[${embeddedCSS}]]></style>\n`;
            console.log("[Renderer Core] Styles embedded.");
        } else { console.log("[Renderer Core] No embedded CSS needed or generated."); }

        // Background Rect (ORDER: Before Text)
        if (config.includeBackground && !config.transparentBackground) {
            let bgFill = 'none';
            if (styles.backgroundTypeClass === 'bg-solid') bgFill = normalizeColor(styles.backgroundColor || '#000');
            else if (bgGradientId) bgFill = `url(#${bgGradientId})`;
            else if (styles.backgroundTypeClass && styles.backgroundTypeClass !== 'bg-transparent') bgFill = normalizeColor(styles.backgroundColor) || '#10121a'; // Fallback

            if (bgFill !== 'none' && bgFill !== 'rgba(0,0,0,0)') { // Don't add rect if transparent
                svg += `<rect width="100%" height="100%" fill="${bgFill}" opacity="${styles.backgroundOpacity || '1'}"/>\n`;
                console.log(`[Renderer Core] Background rect added with fill: ${bgFill}`);
            } else { console.log("[Renderer Core] Background rect skipped (transparent or none)."); }
        } else { console.log("[Renderer Core] Background skipped (transparent export option)."); }

        // Text Element (ORDER: After Background)
        const textElement = _applyCapturedStylesToSVGText(styles.textContent, styles);
        svg += textElement + "\n";
        console.log("[Renderer Core] Text element generated.");

        // Close SVG
        svg += `</svg>`;
        console.log("[Renderer Core] SVG string generation complete.");

        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        return blob;

    } catch (error) {
        console.error('[Renderer Core] SVG Generation Failed:', error);
        throw new Error('SVG Generation Failed: ' + (error.message || 'Unknown error'));
    }
}

/**
 * Converts an SVG blob to a PNG blob - used by both PNG export and GIF frames
 * @param {Blob} svgBlob - SVG blob to convert
 * @param {Object} options - Conversion options
 * @returns {Promise<Blob>} - PNG blob
 */
export function convertSVGtoPNG(svgBlob, options = {}) {
    return new Promise((resolve, reject) => {
        const { width = 800, height = 400, quality = 0.95 } = options;
        
        // Create URL from SVG blob
        const url = URL.createObjectURL(svgBlob);
        
        // Load SVG into image
        const img = new Image();
        img.onload = () => {
            try {
                // Create canvas for rendering
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // Draw white background if not transparent
                if (!options.transparentBackground) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                }
                
                // Draw SVG onto canvas
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob
                canvas.toBlob(
                    blob => {
                        URL.revokeObjectURL(url);
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to convert canvas to blob'));
                        }
                    },
                    'image/png',
                    quality
                );
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(new Error('Canvas conversion failed: ' + err.message));
            }
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load SVG image'));
        };
        
        img.src = url;
    });
}

/**
 * Generate animation frames for GIF export using the SVG pipeline
 * @param {Object} options - Frame generation options
 * @returns {Promise<Array<Blob>>} - Array of PNG frame blobs
 */
export async function generateAnimationFrames(options = {}) {
    const { width=800, height=400, frameCount=15, transparent=false } = options;
    
    console.log(`[Renderer Core] Generating ${frameCount} animation frames`);
    const frames = [];
    
    // Get animation data
    const logoElement = document.querySelector('.logo-text');
    if (!logoElement) throw new Error("Animation frame generation error: .logo-text element not found");
    
    const animClass = Array.from(logoElement.classList).find(cls => cls.startsWith('anim-'));
    const animDuration = getAnimationDuration(); // Get from CSS var
    
    // Save initial state
    const originalStyles = {
        transform: logoElement.style.transform,
        backgroundImage: logoElement.style.backgroundImage,
        animation: logoElement.style.animation,
        animationPlayState: logoElement.style.animationPlayState,
        animationDelay: logoElement.style.animationDelay
    };
    
    // Generate each frame
    for (let i = 0; i < frameCount; i++) {
        try {
            // Calculate animation progress for this frame
            const progress = i / frameCount;
            
            // Apply animation state to DOM (will be captured by SVG generator)
            applyAnimationState(logoElement, animClass, progress, animDuration);
            
            // Wait for style changes to take effect
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Generate SVG for this animation state
            const svgBlob = await generateSVGBlob({
                width, 
                height,
                transparentBackground: transparent
            });
            
            // Convert to PNG for GIF frames
            const pngBlob = await convertSVGtoPNG(svgBlob, {
                width, 
                height,
                transparentBackground: transparent,
                quality: 1 // Max quality for animation frames
            });
            
            frames.push(pngBlob);
            
            if (options.onProgress) {
                options.onProgress((i + 1) / frameCount, `Generating frame ${i + 1}/${frameCount}`);
            }
            
        } catch (error) {
            console.error(`[Renderer Core] Error generating frame ${i+1}:`, error);
        }
    }
    
    // Restore original state
    Object.assign(logoElement.style, originalStyles);
    
    return frames;
}

/**
 * Apply animation state for a specific progress point
 * @param {HTMLElement} element - Element to animate
 * @param {string} animClass - Animation class
 * @param {number} progress - Progress from 0 to 1
 * @param {number} duration - Animation duration in ms
 */
function applyAnimationState(element, animClass, progress, duration) {
    if (!animClass || animClass === 'anim-none') {
        // If no animation class but has gradient, handle rotation
        if (element.style.backgroundImage?.includes('linear-gradient')) {
            rotateGradient(element, progress);
        }
        return;
    }
    
    // For CSS animations
    element.style.animation = 'none';
    void element.offsetWidth; // Force reflow
    
    // Re-add animation class if not present
    if (!element.classList.contains(animClass)) {
        element.classList.add(animClass);
    }
    
    // Set animation parameters to "freeze" at current progress
    element.style.animationDuration = `${duration}ms`;
    element.style.animationDelay = `-${progress * duration}ms`;
    element.style.animationPlayState = 'paused';
    element.style.animationIterationCount = 'infinite';
    
    void element.offsetWidth; // Force reflow for styles to apply
}

/**
 * Helper to rotate gradient for animation frames
 */
function rotateGradient(element, progress) {
    const originalGradient = element.style.backgroundImage || 
                            window.getComputedStyle(element).backgroundImage;
    
    if (!originalGradient.includes('linear-gradient')) return;
    
    // Parse current angle
    const angleMatch = originalGradient.match(/linear-gradient\(([^,]+),/);
    let baseAngle = 45;
    if (angleMatch && angleMatch[1].includes('deg')) {
        baseAngle = parseFloat(angleMatch[1]);
    }
    
    // Extract color stops
    const colorStops = originalGradient.match(/#[0-9a-fA-F]{6,8}|rgba?\([^)]+\)/g) || [];
    
    // Calculate new angle based on progress
    const newAngle = (baseAngle + (progress * 360)) % 360;
    
    // Create and apply new gradient
    const newGradient = `linear-gradient(${newAngle}deg, ${colorStops.join(', ')})`;
    element.style.backgroundImage = newGradient;
    
    // Ensure text properties are set
    if (element.classList.contains('logo-text')) {
        element.style.backgroundClip = 'text';
        element.style.webkitBackgroundClip = 'text';
        element.style.color = 'transparent';
        element.style.webkitTextFillColor = 'transparent';
    }
}

/**
 * Helper to get animation duration from CSS variables
 * @returns {number} Duration in milliseconds
 */
function getAnimationDuration() {
    try {
        const rootStyle = window.getComputedStyle(document.documentElement);
        const durationStr = rootStyle.getPropertyValue('--animation-duration').trim();
        if (durationStr) {
            const seconds = parseFloat(durationStr.replace('s', ''));
            if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
        }
    } catch (e) {
        console.warn("[Renderer Core] Error getting animation duration:", e);
    }
    return 2000; // Default 2s
}

// Import these helper functions from SVGRenderer or redefine them here
// Redefining to make this module self-contained
function normalizeColor(color) {
    if (!color || color === 'transparent' || color === 'none') return 'rgba(0,0,0,0)';
    if (color.startsWith('rgb')) return color;

    // Simple hex handling
    if (color.startsWith('#')) {
        let hex = color.substring(1);
        try {
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length === 6) {
                const r = parseInt(hex.substring(0,2), 16);
                const g = parseInt(hex.substring(2,4), 16);
                const b = parseInt(hex.substring(4,6), 16);
                return `rgb(${r},${g},${b})`;
            }
        } catch (e) {
            return 'rgb(0,0,0)'; // Fallback to black
        }
    }

    // Use computed style for named colors
    try {
        const temp = document.createElement('div');
        temp.style.color = color;
        document.body.appendChild(temp);
        const computed = getComputedStyle(temp).color;
        document.body.removeChild(temp);
        return computed || 'rgb(0,0,0)';
    } catch (e) {
        return 'rgb(0,0,0)';
    }
}

function getStrokeDasharray(borderStyle, borderWidth) {
    const w = parseFloat(borderWidth) || 1;
    switch (borderStyle) {
        case 'dashed': return `${w * 3}, ${w * 2}`;
        case 'dotted': return `${w}, ${w * 2}`;
        default: return null; // solid, none, etc.
    }
}

function createGradientDef(styles) {
    if (styles.colorMode !== 'gradient') {
        return '';
    }
    
    // Implement gradient creation for SVG
    // (simplified implementation - expand as needed)
    const colors = styles.gradientColors || {
        c1: '#ff0000',
        c2: '#0000ff'
    };
    
    return `<linearGradient id="svgTextGradient" gradientUnits="objectBoundingBox" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${colors.c1}"/>
        <stop offset="100%" stop-color="${colors.c2}"/>
    </linearGradient>`;
}

function createFilterDef(styles) {
    // Implement filter creation for SVG effects
    // (simplified implementation - expand as needed)
    if (!styles.textGlowClass && !styles.textShadow) {
        return '';
    }
    
    return `<filter id="svgTextEffect" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
        <feOffset dx="2" dy="2" in="blur" result="offsetBlur"/>
        <feFlood flood-color="#000000" flood-opacity="0.5" result="shadowColor"/>
        <feComposite in="shadowColor" in2="offsetBlur" operator="in" result="shadowBlur"/>
        <feMerge>
            <feMergeNode in="shadowBlur"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    </filter>`;
}

function _applyCapturedStylesToSVGText(textContent, styles) {
    if (!styles) {
        console.warn('[Renderer Core] No styles provided for text, using fallback.');
        return `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="60" fill="red">${textContent || 'No Text'}</text>`;
    }

    // Core text element with styling attributes
    let svgText = `<text x="50%" y="50%" text-anchor="${styles.textAnchor || 'middle'}" dominant-baseline="${styles.dominantBaseline || 'middle'}" `;
    
    // Font styling
    svgText += `font-family="${styles.fontFamily ? styles.fontFamily.replace(/"/g, "'") : 'sans-serif'}" `;
    svgText += `font-size="${styles.fontSize || '60px'}" `;
    if (styles.fontWeight) svgText += `font-weight="${styles.fontWeight}" `;
    if (styles.letterSpacing) svgText += `letter-spacing="${styles.letterSpacing}" `;
    
    // Fill/color
    if (styles.colorMode === 'gradient') {
        svgText += `fill="url(#svgTextGradient)" `;
    } else {
        svgText += `fill="${normalizeColor(styles.fill || '#000000')}" `;
    }
    
    // Effects
    if (styles.textGlowClass || styles.textShadow) {
        svgText += `filter="url(#svgTextEffect)" `;
    }
    
    // Transform
    if (styles.transform && styles.transform !== 'none') {
        svgText += `transform="${styles.transform}" `;
    }
    
    // Animation class
    if (styles.animationClass && styles.animationClass !== 'anim-none') {
        svgText += `class="animated-logo-text ${styles.animationClass}" `;
    }
    
    // Content and closing tag
    const escapedText = (textContent || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // For animations that benefit from SMIL, add animateTransform element
    if (styles.animationClass === 'anim-rotate') {
        // Close opening tag
        svgText += `>${escapedText}`;
        // Add SMIL animation
        svgText += `<animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 50% 50%" to="360 50% 50%" dur="${styles.animationDuration || '2s'}" repeatCount="indefinite"/>`;
        // Close text element
        svgText += `</text>`;
    } else if (styles.animationClass === 'anim-bounce') {
        // Close opening tag
        svgText += `>${escapedText}`;
        // Add SMIL animation
        svgText += `<animateTransform attributeName="transform" attributeType="XML" type="translate" values="0,0; 0,-10; 0,0" dur="${styles.animationDuration || '2s'}" repeatCount="indefinite"/>`;
        // Close text element
        svgText += `</text>`;
    } else {
        // Standard closing with content
        svgText += `>${escapedText}</text>`;
    }
    
    return svgText;
}

async function generateEmbeddedCSS(styles) {
    let css = `\n/* Embedded CSS */\n`;
    let fontEmbedded = false;

    // Embed font
    if (styles.fontFamily && typeof window.getFontDataByName === 'function') {
        try {
            console.log(`[Renderer Core] Attempting to embed font: ${styles.fontFamily}`);
            const fontData = window.getFontDataByName(styles.fontFamily);
            
            if (fontData?.variants?.length) {
                const targetWeight = styles.fontWeight || '400';
                const targetStyle = styles.fontStyle || 'normal';
                
                // Find best matching variant
                let bestMatch = fontData.variants.find(v => 
                    v.file?.startsWith('data:') && 
                    String(v.weight) === targetWeight &&
                    v.style === targetStyle
                );
                
                // Fallbacks if exact match not found
                if (!bestMatch) bestMatch = fontData.variants.find(v => 
                    v.file?.startsWith('data:') && 
                    String(v.weight) === '400'
                );
                
                if (!bestMatch) bestMatch = fontData.variants.find(v => 
                    v.file?.startsWith('data:')
                );
                
                if (bestMatch?.file) {
                    css += `@font-face {\n`;
                    css += `  font-family: "${styles.fontFamily}";\n`;
                    css += `  src: url("${bestMatch.file}") format("${bestMatch.format || 'woff2'}");\n`;
                    css += `  font-weight: ${bestMatch.weight || 400};\n`;
                    css += `  font-style: ${bestMatch.style || 'normal'};\n`;
                    css += `}\n`;
                    fontEmbedded = true;
                    console.log(`[Renderer Core] Successfully embedded font: ${styles.fontFamily}`);
                }
            }
        } catch (e) {
            console.error(`[Renderer Core] Error embedding font:`, e);
        }
    }

    // Add text styling
    const textSelector = (styles.animationClass && styles.animationClass !== 'anim-none') ? 
        'text.animated-logo-text' : 'text';
    
    css += `${textSelector} {\n`;
    if (!fontEmbedded) {
        css += `  font-family: sans-serif; /* Fallback font */\n`;
    }
    
    // Add properties for animations
    if (styles.animationClass && styles.animationClass !== 'anim-none') {
        css += `  transform-origin: 50% 50%;\n`;
        css += `  transform-box: fill-box;\n`;
    }
    css += `}\n`;
    
    // Add animation keyframes
    if (styles.animationClass && styles.animationClass !== 'anim-none') {
        const animName = styles.animationClass.replace('anim-', '');
        
        // Try to get keyframes from DOM
        let keyframesCss = null;
        if (typeof window.getActiveAnimationKeyframes === 'function') {
            keyframesCss = window.getActiveAnimationKeyframes(animName);
        }
        
        if (keyframesCss) {
            css += `\n/* Animation: ${animName} */\n`;
            css += keyframesCss + '\n';
            
            // Add class-specific animation properties
            css += `.animated-logo-text.anim-${animName} {\n`;
            css += `  animation: ${animName} ${styles.animationDuration || '2s'} infinite;\n`;
            css += `}\n`;
        }
    }
    
    return css;
}

/**
 * Generate a consistent preview for ALL exporters
 * @param {Object} options - Preview generation options
 * @param {HTMLImageElement} previewImg - The image element to update
 * @param {HTMLElement} loadingElement - Loading indicator element
 * @param {string} exportType - Type of exporter ('svg', 'png', or 'gif')
 * @returns {Promise} - Resolves when preview is generated
 */
export function generateConsistentPreview(options, previewImg, loadingElement, exportType = 'svg') {
    // Show loading state
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
    if (previewImg) {
        previewImg.style.display = 'none';
    }
    
    // Extract options with defaults
    const {
        width = 400,
        height = 300,
        quality = 0.95,
        transparentBackground = false,
        frameCount = 10 // Only used for GIF
    } = options;
    
    return new Promise(async (resolve, reject) => {
        try {
            // For GIF animations, handle separately
            if (exportType === 'gif') {
                // Generate animation frames
                const frames = await generateAnimationFrames({
                    width,
                    height,
                    frameCount,
                    transparent: transparentBackground
                });
                
                if (!frames || frames.length === 0) {
                    throw new Error("Failed to generate animation frames");
                }
                
                // Convert all frames to data URLs
                const dataUrls = [];
                for (const blob of frames) {
                    if (blob?.size > 0) {
                        const dataUrl = await blobToDataURL(blob);
                        dataUrls.push(dataUrl);
                    }
                }
                
                // Hide loading and resolve with frame data URLs
                if (loadingElement) loadingElement.style.display = 'none';
                if (previewImg) {
                    previewImg.style.display = 'block';
                    previewImg.src = dataUrls[0] || "";
                }
                
                resolve({
                    dataUrls,
                    blob: frames[0] // Return first frame blob as well
                });
                return;
            }
            
            // For static exports (SVG and PNG)
            
            // First generate the SVG
            const svgBlob = await generateSVGBlob({
                width,
                height,
                transparentBackground
            });
            
            // For PNG, convert the SVG to PNG
            let finalBlob = svgBlob;
            if (exportType === 'png') {
                finalBlob = await convertSVGtoPNG(svgBlob, {
                    width,
                    height,
                    quality,
                    transparentBackground
                });
            }
            
            // Create a preview URL
            const url = URL.createObjectURL(finalBlob);
            
            // Update the preview image
            if (previewImg) {
                previewImg.onload = () => {
                    URL.revokeObjectURL(url);
                    if (loadingElement) loadingElement.style.display = 'none';
                    previewImg.style.display = 'block';
                };
                previewImg.onerror = (e) => {
                    console.error("Preview image load error:", e);
                    URL.revokeObjectURL(url);
                    if (loadingElement) loadingElement.style.display = 'none';
                    previewImg.style.display = 'block';
                    previewImg.src = exportType === 'png' 
                        ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
                        : 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Crect%20fill%3D%22%23ff0000%22%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3Ctext%20fill%3D%22white%22%20x%3D%2250%22%20y%3D%2250%22%20text-anchor%3D%22middle%22%3EError%3C%2Ftext%3E%3C%2Fsvg%3E';
                    reject(new Error("Failed to load preview image"));
                };
                previewImg.src = url;
            } else {
                URL.revokeObjectURL(url);
                if (loadingElement) loadingElement.style.display = 'none';
            }
            
            // Resolve with the blob
            resolve({ blob: finalBlob });
        } catch (error) {
            console.error(`[Preview Generator] Error generating ${exportType} preview:`, error);
            if (loadingElement) loadingElement.style.display = 'none';
            if (previewImg) {
                previewImg.style.display = 'block';
                previewImg.src = exportType === 'png' 
                    ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
                    : 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Crect%20fill%3D%22%23ff0000%22%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3Ctext%20fill%3D%22white%22%20x%3D%2250%22%20y%3D%2250%22%20text-anchor%3D%22middle%22%3EError%3C%2Ftext%3E%3C%2Fsvg%3E';
            }
            reject(error);
        }
    });
}

/**
 * Helper function to convert blob to data URL
 */
function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}