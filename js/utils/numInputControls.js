/**
 * numberInputControls.js
 * Adds up/down arrow controls to number inputs
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize number input controls
    initNumberInputControls();
});

/**
 * Sets up up/down arrow controls for number inputs
 */
function initNumberInputControls() {
    // Find all number inputs
    const numberInputs = document.querySelectorAll('input[type="number"]');
    
    numberInputs.forEach(input => {
        // Skip inputs that already have controls or should be skipped
        if (input.closest('.number-input-wrapper') || input.dataset.noArrows) {
            return;
        }
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'number-input-wrapper';
        
        // Insert wrapper before input
        input.parentNode.insertBefore(wrapper, input);
        
        // Move input inside wrapper
        wrapper.appendChild(input);
        
        // Create controls container
        const controls = document.createElement('div');
        controls.className = 'number-controls';
        
        // Create up button
        const upBtn = document.createElement('button');
        upBtn.className = 'number-control-btn';
        upBtn.innerHTML = '▲';
        upBtn.title = 'Increase';
        upBtn.type = 'button';
        
        // Create down button
        const downBtn = document.createElement('button');
        downBtn.className = 'number-control-btn';
        downBtn.innerHTML = '▼';
        downBtn.title = 'Decrease';
        downBtn.type = 'button';
        
        // Add buttons to controls
        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        
        // Add controls to wrapper
        wrapper.appendChild(controls);
        
        // Get step value
        const step = parseFloat(input.step) || 1;
        
        // Add event listeners for up button
        upBtn.addEventListener('click', () => {
            const currentValue = parseFloat(input.value) || 0;
            const max = parseFloat(input.max);
            let newValue = currentValue + step;
            
            // Respect max if set
            if (!isNaN(max) && newValue > max) {
                newValue = max;
            }
            
            input.value = newValue;
            
            // Trigger change and input events
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        
        // Add event listeners for down button
        downBtn.addEventListener('click', () => {
            const currentValue = parseFloat(input.value) || 0;
            const min = parseFloat(input.min);
            let newValue = currentValue - step;
            
            // Respect min if set
            if (!isNaN(min) && newValue < min) {
                newValue = min;
            }
            
            input.value = newValue;
            
            // Trigger change and input events
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
    
    console.log('[NumberInputControls] Added arrow controls to', numberInputs.length, 'number inputs');
}

// Make function globally available
window.initNumberInputControls = initNumberInputControls;