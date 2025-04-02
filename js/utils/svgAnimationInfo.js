/**
 * svgAnimationInfo.js
 * Adds informational box about SVG animations
 */

document.addEventListener('DOMContentLoaded', function() {
    // Add SVG animation info to animation tab
    addSvgAnimationInfo();
});

/**
 * Adds SVG animation info box to the animation tab
 */
function addSvgAnimationInfo() {
    const animationTab = document.getElementById('animation-tab');
    if (!animationTab) {
        console.warn('[SVGAnimationInfo] Animation tab not found');
        return;
    }
    
    // Create info box
    const infoBox = document.createElement('div');
    infoBox.className = 'svg-animation-info';
    infoBox.innerHTML = `
        <div class="svg-animation-info-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
        </div>
        <div class="svg-animation-info-content">
            SVG exports include both CSS animations and styles. When you export as SVG, the animation will play when opened directly in browsers that support SVG animations.
        </div>
    `;
    
    // Add to tab content
    const infoTextElement = animationTab.querySelector('.info-text');
    if (infoTextElement) {
        infoTextElement.parentNode.insertBefore(infoBox, infoTextElement);
    } else {
        animationTab.appendChild(infoBox);
    }
    
    console.log('[SVGAnimationInfo] Added SVG animation info to animation tab');
}

// Make function globally available
window.addSvgAnimationInfo = addSvgAnimationInfo;