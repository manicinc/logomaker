// Add this function to enhance number inputs with +/- buttons
function enhanceNumberInputs() {
    const numberInputs = document.querySelectorAll('input[type="number"]');
    
    numberInputs.forEach(input => {
      const container = document.createElement('div');
      container.className = 'number-input-container';
      
      const decrementBtn = document.createElement('button');
      decrementBtn.className = 'number-btn decrement';
      decrementBtn.innerHTML = '−';
      decrementBtn.type = 'button';
      
      const incrementBtn = document.createElement('button');
      incrementBtn.className = 'number-btn increment';
      incrementBtn.innerHTML = '+';
      incrementBtn.type = 'button';
      
      // Insert the input into our container
      input.parentNode.insertBefore(container, input);
      container.appendChild(decrementBtn);
      container.appendChild(input);
      container.appendChild(incrementBtn);
      
      // Add event listeners
      decrementBtn.addEventListener('click', () => {
        const step = parseFloat(input.step) || 1;
        input.value = (parseFloat(input.value) || 0) - step;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      
      incrementBtn.addEventListener('click', () => {
        const step = parseFloat(input.step) || 1;
        input.value = (parseFloat(input.value) || 0) + step;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }
  
  // Call this after the DOM is loaded
  document.addEventListener('DOMContentLoaded', enhanceNumberInputs);