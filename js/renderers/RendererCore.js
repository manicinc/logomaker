/**
 * RendererCore.js (v2.7 - Unified Export)
 * ============================================================
 * Central rendering pipeline for PNG, SVG, and frames exports.
 * Ensures the entire #previewContainer area (with background,
 * border radius, etc.) is captured consistently in both PNG & SVG.
 *
 * Exports:
 *  - generateSVGBlob(options)
 *  - convertSVGtoPNG(svgBlob, options)
 *  - generateAnimationFrames(options)
 *  - generateConsistentPreview(options, previewImg, loadingElement, exportType)
 *
 * Usage:
 *  This module is used by other code (PNGRenderer, SVGRenderer, GIFRenderer)
 *  or UI logic to generate final exports. 
 */

// import style capture & animation info
import { captureAdvancedStyles } from '../captureTextStyles.js';
import { extractSVGAnimationDetails } from '../utils/svgAnimationInfo.js';

// If needed, attach a global fallback
console.log("[RendererCore v2.7] Loading...");

// -----------------------------------------------------------------------
// 1. Generic Helpers
// -----------------------------------------------------------------------

export function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        if (!(blob instanceof Blob)) {
            return reject(new Error("Invalid input, expected a Blob."));
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(blob);
    });
}

function escapeSVGAttribute(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
}

function escapeXML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
}

function parseAnimationDuration(durationStr) {
    if (!durationStr || typeof durationStr !== 'string') return 0;
    const trimmed = durationStr.trim();
    const val = parseFloat(trimmed);
    if (isNaN(val)) return 0;
    if (trimmed.endsWith('ms')) return val;
    if (trimmed.endsWith('s')) return val * 1000;
    return val * 1000; // default
}

/**
 * Basic transform normalizer: rotate(30deg)->rotate(30)
 */
function normalizeCSSTransformForSVG(cssTransform) {
    if (!cssTransform || cssTransform === 'none') return '';
    // quick check for rotate(...) in deg
    const rotMatch = cssTransform.match(/rotate\(\s*(-?[\d.]+)deg\)/i);
    if (rotMatch) {
        const angle = parseFloat(rotMatch[1]) || 0;
        return `rotate(${angle})`; // remove "deg"
    }
    // For matrix(...) or scale(...), we can pass as-is, just remove commas:
    let noComma = cssTransform.replace(/,\s*/g, ' ');
    console.warn(`[RendererCore] Passing raw transform: ${cssTransform} => ${noComma}`);
    return noComma;
}

function extractOpacityFromColor(colorStr) {
    if (!colorStr || !colorStr.startsWith('rgba')) return 1;
    // e.g. rgba(255,0,0,0.5)
    const m = colorStr.match(/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)/);
    if (!m) return 1;
    const alpha = parseFloat(m[1]);
    return isNaN(alpha) ? 1 : Math.max(0, Math.min(1, alpha));
}

// -----------------------------------------------------------------------
// 3. Key SVG Sub-Builders
// -----------------------------------------------------------------------

function createTextGradientDef(styles, gradientId) {
    if (!styles.color || styles.color.mode!=='gradient' || !styles.color.gradient) return '';
    const {colors, direction} = styles.color.gradient;
    if (!colors || colors.length<2) return '';
    const c1 = normalizeColor(colors[0], 'text gradient c1');
    const c2 = normalizeColor(colors[1], 'text gradient c2');
    if (!c1 && !c2) return '';
    // Optional 3rd color
    let c3 = null;
    if (colors[2]) c3 = normalizeColor(colors[2], 'text gradient c3');

    const angleDeg = parseFloat(direction||'180')||180;
    // Convert to svg coords
    const angleRad = (angleDeg - 90) * Math.PI/180;
    const x1 = (0.5 - 0.5*Math.cos(angleRad)).toFixed(4);
    const y1 = (0.5 - 0.5*Math.sin(angleRad)).toFixed(4);
    const x2 = (0.5 + 0.5*Math.cos(angleRad)).toFixed(4);
    const y2 = (0.5 + 0.5*Math.sin(angleRad)).toFixed(4);

    let stops = `<stop offset="0%" stop-color="${c1||'#000'}" stop-opacity="${extractOpacityFromColor(colors[0]).toFixed(3)}"/>`;
    if (c3) {
        stops += `<stop offset="50%" stop-color="${c2||'#000'}" stop-opacity="${extractOpacityFromColor(colors[1]).toFixed(3)}"/>`;
        stops += `<stop offset="100%" stop-color="${c3}" stop-opacity="${extractOpacityFromColor(c3).toFixed(3)}"/>`;
    } else {
        stops += `<stop offset="100%" stop-color="${c2||'#000'}" stop-opacity="${extractOpacityFromColor(colors[1]).toFixed(3)}"/>`;
    }

    return `<linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">${stops}</linearGradient>`;
}

function createFilterDef(styles, filterId) {
    if (!styles.textEffect || !styles.textEffect.type || styles.textEffect.type==='none') return '';
    const {type,color,blur,dx,dy,opacity} = styles.textEffect;
    const normalizedColor = normalizeColor(color,'filter');
    if (!normalizedColor) return '';
    const safeBlur = Math.max(0, blur||0);
    const safeOpacity = Math.max(0, Math.min(1, opacity||1));

    if (type==='shadow' && safeBlur<0.5) {
        // simple dropShadow
        return `<filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
  <feDropShadow dx="${dx||0}" dy="${dy||0}" stdDeviation="0.1" flood-color="${normalizedColor}" flood-opacity="${safeOpacity}"/>
</filter>`;
    } else {
        // glow or blurred shadow
        return `<filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="${safeBlur.toFixed(2)}" result="blur"/>
  <feOffset dx="${dx||0}" dy="${dy||0}" in="blur" result="offsetBlur"/>
  <feFlood flood-color="${normalizedColor}" flood-opacity="${safeOpacity}" result="flood"/>
  <feComposite in="flood" in2="offsetBlur" operator="in" result="coloredBlur"/>
  <feMerge>
    <feMergeNode in="coloredBlur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>`;
    }
}

function createBackgroundGradientDef(styles, id) {
    if (!styles.background?.gradient) return '';
    const { colors, direction } = styles.background.gradient;
    if (!colors || colors.length<2) return '';
    const c1 = normalizeColor(colors[0],'bg gradient1');
    const c2 = normalizeColor(colors[1],'bg gradient2');
    if (!c1 && !c2) return '';

    const angleDeg = parseFloat(direction||'180')||180;
    const angleRad = (angleDeg - 90) * Math.PI/180;
    const x1 = (0.5 - 0.5*Math.cos(angleRad)).toFixed(4);
    const y1 = (0.5 - 0.5*Math.sin(angleRad)).toFixed(4);
    const x2 = (0.5 + 0.5*Math.cos(angleRad)).toFixed(4);
    const y2 = (0.5 + 0.5*Math.sin(angleRad)).toFixed(4);

    const s1op = extractOpacityFromColor(colors[0]).toFixed(3);
    const s2op = extractOpacityFromColor(colors[1]).toFixed(3);
    const stops = `<stop offset="0%" stop-color="${c1||'#000'}" stop-opacity="${s1op}"/>
                   <stop offset="100%" stop-color="${c2||'#000'}" stop-opacity="${s2op}"/>`;

    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">${stops}</linearGradient>`;
}


// -----------------------------------------------------------------------
// 4. Core Export: generateSVGBlob
// -----------------------------------------------------------------------
/**
 * generateSVGBlob(options)
 * Main function that captures the entire #previewContainer bounding box,
 * background & border radius included, then re-creates that in an <svg>.
 *
 * @param {object} options - e.g. { width, height, transparentBackground, animationMetadata }
 * @returns {Promise<Blob>}
 */
export async function generateSVGBlob(options = {}) {
    console.log("[RendererCore] generateSVGBlob() with options:", options);
    // 1) Capture current styles from #previewContainer and .logo-container, .logo-text, etc.
    const styles = captureAdvancedStyles();
    if (!styles) {
        throw new Error("Failed to capture advanced styles. Aborting SVG generation.");
    }

    // 2) Determine final export size (width & height)
    let targetW = parseInt(options.width || styles.exportConfig?.width || '800');
    let targetH = parseInt(options.height || styles.exportConfig?.height || '400');
    targetW = Math.max(1, targetW);
    targetH = Math.max(1, targetH);

    // 3) Possibly correct aspect ratio if you want to keep #previewContainer's AR
    const originalAR = (styles.originalDimensions?.aspectRatio) || (targetW / targetH);
    let finalW = targetW, finalH = Math.round(finalW / originalAR);
    if (finalH>targetH) { finalH=targetH; finalW=Math.round(finalH*originalAR); }

    // 4) Create config
    const config = {
        width: finalW,
        height: finalH,
        transparentBackground: !!options.transparentBackground,
        includeBackground: true,
        animationMetadata: options.animationMetadata || extractSVGAnimationDetails(),
        text: styles.textContent?.finalText || 'Logo' // fallback
    };

    // 5) Build the <svg> string
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}" xmlns:xlink="http://www.w3.org/1999/xlink">\n`;

    // 5a) <defs>
    svg += `<defs>\n`;

    // - text gradient
    let textGradientId=null;
    if (styles.color?.mode==='gradient') {
        textGradientId = 'svgTextGradient';
        const def = createTextGradientDef(styles, textGradientId);
        if (def) svg += def + '\n'; else textGradientId=null;
    }

    // - text filter
    let textFilterId=null;
    if (styles.textEffect?.type && styles.textEffect.type!=='none') {
        textFilterId = 'svgTextEffect';
        const fdef = createFilterDef(styles, textFilterId);
        if (fdef) svg += fdef + '\n'; else textFilterId=null;
    }

    // - background gradient
    let bgGradientId=null;
    if (!config.transparentBackground && styles.background?.type.includes('gradient')) {
        bgGradientId = 'svgBgGradient';
        const bgdef = createBackgroundGradientDef(styles, bgGradientId);
        if (bgdef) svg += bgdef + '\n'; else bgGradientId=null;
    }

    // close <defs>
    svg += `</defs>\n`;

    // 5b) <style> inline CSS
    // For embedded fonts or animation keyframes
    const embeddedCSS = generateEmbeddedCSS(styles, config.animationMetadata);
    if (embeddedCSS) {
        svg += `<style type="text/css"><![CDATA[\n${embeddedCSS}\n]]></style>\n`;
    }

    // 6) Draw the background rect
    if (!config.transparentBackground && config.includeBackground) {
        const bgColor = normalizeColor(styles.background?.color || '#000','bg');
        const bgOp = parseFloat(styles.background?.opacity||'1');
        let fillSpec='none';
        if (bgGradientId) {
            fillSpec=`url(#${bgGradientId})`;
        } else if (bgColor) {
            fillSpec=bgColor;
        }
        const finalBgOp = Math.max(0, Math.min(1, bgOp));
        if (fillSpec!=='none') {
            svg+=`<rect width="100%" height="100%" fill="${fillSpec}"`;
            if (finalBgOp<1) svg+=` opacity="${finalBgOp.toFixed(3)}"`;
            svg+=`/>\n`;
        }
    }

    // 7) We respect container opacity
    const containerOpacity = parseFloat(styles.containerOpacity||'1');
    const finalContainerOp = Math.max(0, Math.min(1, containerOpacity));
    svg += `<g id="previewContainer-group" opacity="${finalContainerOp.toFixed(3)}">\n`;

    // 8) If there's a visible container border, draw it
    // We unify that with the border radius & padding approach used in captureAdvancedStyles
    // But here's simpler approach: We treat the entire bounding box as the container
    const borderInfo = styles.border;
    let strokeW=0; 
    let strokeColor=null; 
    if (borderInfo && borderInfo.style && borderInfo.style!=='none') {
        strokeColor = normalizeColor(borderInfo.color,'container border');
        strokeW = parseFloat(borderInfo.width||'0');
    }
    // border radius
    let rx=0, ry=0;
    if (styles.borderRadius) {
        // if "50%" => we can approximate a circle
        if (styles.borderRadius.includes('50%')) {
            rx= config.width/2;
            ry= config.height/2;
        } else {
            // parse numeric
            const match = styles.borderRadius.match(/(\d+)(px|%)?/);
            if (match) {
                rx= parseFloat(match[1])||0;
                ry=rx;
            }
        }
    }

    // We skip "padding" concept for the entire container. We'll just have the text inside a group with transform or separate logic below if desired
    // For now, we simply draw a rect for the border if valid
    if (strokeColor && strokeW>0) {
        const strokeOp = extractOpacityFromColor(strokeColor);
        svg+=`  <rect x="0" y="0" width="${config.width}" height="${config.height}" rx="${rx}" ry="${ry}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}"`;
        if (strokeOp<1) svg+=` stroke-opacity="${strokeOp.toFixed(3)}"`;
        if (borderInfo.dasharray) svg+=` stroke-dasharray="${borderInfo.dasharray}"`;
        // If border has a glow effect and we want to reuse the text filter, we do so if textEffect.type==='glow'
        if (borderInfo.isGlow && styles.textEffect?.type==='glow' && textFilterId) {
            svg+=` filter="url(#${textFilterId})"`;
        }
        svg+=`/>\n`;
    }

    // 9) We'll nest a sub-SVG for .logo-text if needed. 
    // But typically we just place text at "50%, 50%" with transform.
    // We'll rely on the final text element
    svg+= generateTextElement(styles, textGradientId, textFilterId, config);

    // close group
    svg+=`</g>\n`;
    // close svg
    svg+=`</svg>`;

    const blob = new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
    console.log(`[RendererCore] generateSVGBlob success => ${ (blob.size/1024).toFixed(1) } KB`);
    return blob;
}

/**
 * Creates the <text> element (and optional transform).
 * 
 * @param {object} styles - from captureAdvancedStyles
 * @param {string|null} textGradId 
 * @param {string|null} filterId 
 * @param {object} config - includes { width, height, animationMetadata, text... }
 * @returns {string} The <text> (or possibly g + text) snippet
 */
function generateTextElement(styles, textGradId, filterId, config) {
    if (!styles.font) {
        console.warn("[RendererCore] No font data in styles => skipping text element.");
        return '';
    }
    // text content
    const text = styles.textContent?.transformedText || config.text || 'Logo';
    const escapedTxt = escapeXML(text);

    // alignment
    let xPos='50%'; 
    let textAnchor= (styles.textAlign==='left'?'start':(styles.textAlign==='right'?'end':'middle'));
    if (textAnchor==='start') xPos='5%';
    else if (textAnchor==='end') xPos='95%';

    // vertical is always middle
    // we do dominant-baseline="middle" & y="50%"
    const fontSizeRaw = parseFloat(styles.font.size||'80')||80;
    const letterSpacing = styles.font.letterSpacing;
    const fontWeight = styles.font.weight||'400';
    const fontStyle = styles.font.style||'normal';
    const fontFamily = styles.font.family||'sans-serif';
    const textOpacity = parseFloat(styles.opacity||'1');
    // color or gradient
    let fillAttr='none';
    let fillOp=1;
    if (styles.color?.mode==='gradient' && textGradId) {
        fillAttr=`url(#${textGradId})`;
    } else {
        const c = normalizeColor(styles.color?.value||'#fff','text');
        if (c) {
            fillAttr=c;
            fillOp= extractOpacityFromColor(c);
        }
    }
    const finalTextOp = Math.max(0, Math.min(1, textOpacity*fillOp));

    // stroke?
    let strokeSnippet='';
    if (styles.stroke?.isTextStroke) {
        const sc = normalizeColor(styles.stroke.color,'text stroke');
        let sw = parseFloat(styles.stroke.width||'0');
        if (sc && sw>0) {
            const stOp= extractOpacityFromColor(sc);
            strokeSnippet = ` stroke="${sc}" stroke-width="${sw}"${stOp<1? ` stroke-opacity="${stOp.toFixed(3)}"`:''}`;
        }
    }

    // transform?
    let transformStr='';
    if (styles.transform?.cssValue) {
        const n = normalizeCSSTransformForSVG(styles.transform.cssValue);
        if (n) transformStr = n;
    }

    // animation class if any
    const animClass = styles.animation?.class||'';
    let classAttr = '';
    if (animClass && animClass!=='anim-none') {
        classAttr=` class="${animClass}"`;
    }

    let textEl=`<text x="${xPos}" y="50%" dominant-baseline="middle" text-anchor="${textAnchor}"`;
    textEl+=` font-size="${fontSizeRaw.toFixed(1)}px" font-family="${escapeSVGAttribute(fontFamily)}"`;
    if (fontWeight!=='400') textEl+=` font-weight="${fontWeight}"`;
    if (fontStyle!=='normal') textEl+=` font-style="${fontStyle}"`;
    if (letterSpacing && letterSpacing!=='normal') textEl+=` letter-spacing="${letterSpacing}"`;

    if (fillAttr!=='none') {
        textEl+=` fill="${fillAttr}"`;
    } else {
        textEl+=` fill="none"`;
    }
    if (finalTextOp<1) {
        textEl+=` opacity="${finalTextOp.toFixed(3)}"`;
    }
    if (filterId) {
        textEl+=` filter="url(#${filterId})"`;
    }
    textEl+= strokeSnippet;
    if (transformStr) {
        textEl+=` transform="${escapeSVGAttribute(transformStr)}"`;
    }
    textEl+=classAttr;
    textEl+=`>${escapedTxt}</text>\n`;

    return textEl;
}

/**
 * Generates inlined <style> text with embedded font-face (if present) and possibly keyframes from styles.animation.
 * @param {object} styles 
 * @param {object|null} animationMetadata
 * @returns {string|null} Entire <style> text or null if empty
 */// In RendererCore.js

/**
 * Generates inlined <style> text with embedded font-face (if present) and possibly keyframes from styles.animation.
 * @param {object} styles
 * @param {object|null} animationMetadata
 * @returns {string|null} Entire <style> text or null if empty
 */
function generateEmbeddedCSS(styles, animationMetadata) {
    let css = "/* Embedded CSS from Logomaker's RendererCore (v2.1 - Keyframe Fallbacks) */\n";
    let hasContent = false;

    // 1) Font-Face (Keep existing logic)
    const fontEmbed = styles.font?.embedData;
    if (fontEmbed && fontEmbed.file && fontEmbed.file.startsWith('data:font')) {
        const primaryName = (styles.font.family || 'Sans').split(',')[0].replace(/['"]/g, '');
        css += `@font-face {\n`;
        css += `  font-family: "${primaryName}";\n`;
        const formatHint = fontEmbed.format ? ` format('${fontEmbed.format}')` : '';
        css += `  src: url(${fontEmbed.file})${formatHint};\n`;
        css += `  font-weight: ${fontEmbed.weight || '400'};\n`;
        css += `  font-style: ${fontEmbed.style || 'normal'};\n`;
        css += `  font-display: swap;\n`;
        css += `}\n\n`;
        hasContent = true;
    }

    // 2) Animation Keyframes & class
    if (animationMetadata && animationMetadata.name !== 'none') {
        // Attempt to get existing or fallback keyframes
        let keyframes = null;
        // First, try the potentially globally attached function (if it exists)
        if (typeof window.getAnimationKeyframes === 'function') {
             try { keyframes = window.getAnimationKeyframes(animationMetadata.name); } catch {}
        }
        // If that failed, try the hardcoded fallbacks
        if (!keyframes) {
             const FALLBACK_KEYFRAMES = {
                 pulse: `@keyframes pulse { 0%,100% { transform: scale(1); opacity:1;} 50% { transform: scale(1.08);opacity:0.9;} }`,
                 bounce: `@keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-15px); } 60% { transform: translateY(-8px); } }`, // Use correct bounce
                 shake: `@keyframes shake { 0%,100%{transform:translateX(0)} 10%,30%,50%,70%,90%{transform:translateX(-4px) rotate(-0.5deg)} 20%,40%,60%,80%{transform:translateX(4px) rotate(0.5deg)} }`,
                 float: `@keyframes float { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-15px) rotate(1deg)} }`,
                 rotate: `@keyframes rotate { 0%{transform:rotate(0deg)}100%{transform:rotate(360deg)} }`,
                 wave: `@keyframes wave { 0%,100%{transform:skewX(0) skewY(0)} 25%{transform:skewX(5deg) skewY(1deg)} 75%{transform:skewX(-5deg) skewY(-1deg)} }`,
                 fade: `@keyframes fadeInOut { 0%,100%{opacity:0.3;} 50%{opacity:1;} }`, // Corrected name
                 flicker: `@keyframes flicker { 0%,18%,22%,25%,53%,57%,100%{opacity:1;text-shadow:inherit;} 20%,24%,55%{opacity:0.6;text-shadow:none;} }`
                 // Add other keyframes from effects.css if needed
             };
             keyframes = FALLBACK_KEYFRAMES[animationMetadata.name];
             if (keyframes) {
                // Ensure the keyframe name matches exactly
                keyframes = keyframes.replace(/@keyframes\s+\w+/, `@keyframes ${animationMetadata.name}`);
                console.log(`[RendererCore] Using hardcoded keyframes for '${animationMetadata.name}'.`);
             }
        }

        if (!keyframes) {
            console.warn(`[RendererCore] No keyframes found or generated for '${animationMetadata.name}'. Animation may not show in final SVG.`);
        } else {
            css += `/* Keyframes for ${animationMetadata.name} */\n${keyframes}\n\n`;
            hasContent = true;
        }

        // The animation class
        if (animationMetadata.class) {
            css += `.${animationMetadata.class} {\n`;
            css += `  animation-name: ${animationMetadata.name};\n`;
            css += `  animation-duration: ${animationMetadata.duration};\n`;
            css += `  animation-timing-function: ${animationMetadata.timingFunction};\n`;
            css += `  animation-iteration-count: ${animationMetadata.iterationCount};\n`;
            if (animationMetadata.delay && animationMetadata.delay !== '0s') css += `  animation-delay: ${animationMetadata.delay};\n`;
            if (animationMetadata.direction && animationMetadata.direction !== 'normal') css += `  animation-direction: ${animationMetadata.direction};\n`;
            if (animationMetadata.fillMode && animationMetadata.fillMode !== 'none') css += `  animation-fill-mode: ${animationMetadata.fillMode};\n`;
            css += `}\n`;
            hasContent = true;
        }
    }

    if (!hasContent) return null;
    return css;
}


// -----------------------------------------------------------------------
// 5. convertSVGtoPNG
// -----------------------------------------------------------------------
/**
 * convertSVGtoPNG
 * Renders the given SVG blob to a PNG using HTMLImageElement + canvas.
 *
 * @param {Blob} svgBlob
 * @param {object} options - { width, height, transparentBackground, quality }
 */
export async function convertSVGtoPNG(svgBlob, options={}) {
    const targetWidth = parseInt(options.width||'800');
    const targetHeight = parseInt(options.height||'400');
    const quality = parseFloat(options.quality||'0.95');

    return new Promise((resolve,reject)=>{
        if (!(svgBlob instanceof Blob)) {
            return reject(new Error("convertSVGtoPNG: invalid svgBlob"));
        }
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
            try {
                const natW= img.naturalWidth, natH= img.naturalHeight;
                // unify approach => scale to target while preserving AR
                let finalW= targetWidth;
                let finalH= Math.round(finalW * (natH/natW));
                if (finalH> targetHeight) {
                    finalH= targetHeight;
                    finalW= Math.round(finalH*(natW/natH));
                }
                const canvas= document.createElement('canvas');
                canvas.width= finalW; canvas.height= finalH;
                const ctx= canvas.getContext('2d');
                if (!ctx) throw new Error("No 2D context available");
                ctx.clearRect(0,0,finalW,finalH);
                ctx.drawImage(img,0,0,finalW, finalH);
                canvas.toBlob( blob=>{
                    URL.revokeObjectURL(url);
                    if (!blob) return reject(new Error("Canvas toBlob returned null"));
                    resolve(blob);
                }, 'image/png', quality);
            } catch(e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };
        img.onerror = e => {
            URL.revokeObjectURL(url);
            reject(new Error("convertSVGtoPNG: image load error => invalid SVG?"));
        };
        img.src= url;
    });
}

// -----------------------------------------------------------------------
// 6. generateAnimationFrames
// -----------------------------------------------------------------------
/**
 * Generates a sequence of PNG frames for an animated preview
 * capturing different progress states in the animation.
 * @param {object} options
 *  - width,height
 *  - frameCount
 *  - transparent
 *  - onProgress callback
 * @returns {Promise<Blob[]>} array of PNG blobs
 */
export async function generateAnimationFrames(options={}) {
    const width= parseInt(options.width||800);
    const height= parseInt(options.height||400);
    const frameCount= Math.max(1, Math.min(options.frameCount||15, 120));
    const transparent= !!options.transparent;
    const onProgress= options.onProgress;

    console.log(`[RendererCore] Generating ${frameCount} frames at ${width}x${height}, transparent=${transparent}`);
    // Check for an actual animation
    const baseAnim = extractSVGAnimationDetails();
    if (!baseAnim || baseAnim.name==='none') {
        console.warn("[RendererCore] No real animation found => generating 1 static frame");
        const oneFrameBlob = await generateSVGBlob({ width, height, transparentBackground:transparent });
        const png = await convertSVGtoPNG(oneFrameBlob,{ width, height, transparentBackground:transparent });
        if (onProgress) onProgress(1, "1 static frame done");
        return [png];
    }

    const frames=[];
    for (let i=0; i<frameCount; i++) {
        const progress= (frameCount<=1)?0 : i/(frameCount);
        try {
            if (onProgress) {
                const pc = Math.round((i/frameCount)*100);
                onProgress(pc/100,`Generating frame ${i+1}/${frameCount}...`);
            }
            const perAnim= {...baseAnim, progress};
            const svgBlob= await generateSVGBlob({width,height, transparentBackground:transparent, animationMetadata:perAnim});
            const png= await convertSVGtoPNG(svgBlob,{ width, height, transparentBackground:transparent });
            frames.push(png);
        } catch(e) {
            console.error(`[RendererCore] Frame ${i+1} generation failed:`, e);
            throw e;
        }
    }
    if (onProgress) onProgress(1,`${frames.length} frames generated`);
    return frames;
}

// -----------------------------------------------------------------------
// 7. generateConsistentPreview
// -----------------------------------------------------------------------
/**
 * Generates a (SVG or PNG) preview for UI usage. Updates an <img> with dataURL.
 * @param {object} options
 * @param {HTMLImageElement} previewImg
 * @param {HTMLElement} loadingEl
 * @param {string} [exportType='svg'] - 'svg','png','gif'
 * @returns {Promise<{ blob:Blob, dataUrl: string, frames?: Blob[] }>}
 */
export function generateConsistentPreview(options, previewImg, loadingEl, exportType='svg') {
    if (loadingEl) loadingEl.style.display='flex';
    if (previewImg) { previewImg.style.display='none'; previewImg.src=''; previewImg.alt="Generating preview...";}

    return new Promise(async (resolve,reject)=>{
        try {
            let result={ blob:null, dataUrl:null };
            const w= options.width||400;
            const h= options.height||300;
            const transparent= options.transparentBackground||false;

            if (exportType==='gif') {
                // We'll generate frames but only do minimal count for preview
                const framesCount= Math.min(options.frameCount||15,10);
                const frames= await generateAnimationFrames({
                    width:w,height:h,frameCount:framesCount,transparent,
                    onProgress: (prog,msg)=>{
                        if (loadingEl) {
                            const pEl= loadingEl.querySelector('.progress-text')||loadingEl;
                            pEl.textContent= msg || `Generating GIF preview... ${Math.round(prog*100)}%`;
                        }
                    }
                });
                if (!frames.length) throw new Error("No frames generated");
                result.blob= frames[0];
                result.frames= frames; // we only show the first as a static preview
                result.dataUrl= await blobToDataURL(frames[0]);
            } else {
                const svgBlob= await generateSVGBlob({ width:w, height:h, transparentBackground:transparent });
                if (exportType==='png') {
                    result.blob= await convertSVGtoPNG(svgBlob, { width:w, height:h, transparentBackground:transparent });
                } else {
                    // just show the SVG directly
                    result.blob= svgBlob;
                }
                result.dataUrl= await blobToDataURL(result.blob);
            }

            // assign to <img>
            if (previewImg && result.dataUrl) {
                previewImg.onload= ()=>{
                    if (loadingEl) loadingEl.style.display='none';
                    previewImg.style.display='block';
                    previewImg.alt=`${exportType.toUpperCase()} Preview`;
                };
                previewImg.onerror= ()=>{
                    if (loadingEl) loadingEl.style.display='none';
                    previewImg.style.display='block';
                    previewImg.alt=`${exportType.toUpperCase()} preview failed to load.`;
                };
                previewImg.src= result.dataUrl;
            } else if (loadingEl) {
                loadingEl.style.display='none';
            }

            resolve(result);

        } catch(e) {
            console.error("[RendererCore] generateConsistentPreview error:", e);
            if (loadingEl) {
                loadingEl.style.display='flex';
                (loadingEl.querySelector('.progress-text')||loadingEl).textContent="Preview Failed";
            }
            if (previewImg) { previewImg.style.display='none'; previewImg.alt="Preview Failed"; }
            reject(e);
        }
    });
}

console.log("[RendererCore v2.7] Module loaded successfully.");
