/**
 * Sets up responsive tab navigation for mobile devices
 */
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab');
    const tabContent = document.querySelectorAll('.tab-content');
    console.log("SET THOSE TABS UP BOY");
    // Skip if we already set this up or no tabs found
    if (!tabs.length) return;
    
    // Enhanced tab switching with visual feedback
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        this.classList.add('active');
        
        // Hide all tab content
        tabContent.forEach(content => {
          content.classList.remove('active');
        });
        
        // Show corresponding tab content
        const tabId = this.getAttribute('data-tab');
        const targetTab = document.getElementById(`${tabId}-tab`);
        
        if (targetTab) {
          targetTab.classList.add('active');
          
          // Scroll to the tab content on mobile
          if (window.innerWidth <= 768) {
            setTimeout(() => {
              targetTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
          }
        }
        
        // Update tab active indicator on mobile
        updateActiveTabIndicator(this);
      });
    });
    
    // Initialize active tab indicator
    function updateActiveTabIndicator(activeTab) {
      const indicator = document.querySelector('.active-tab-indicator');
      if (!indicator) return;
      
      // Position indicator under the active tab
      const tabRect = activeTab.getBoundingClientRect();
      const tabsContainer = document.querySelector('.tabs');
      const containerRect = tabsContainer.getBoundingClientRect();
      
      indicator.style.width = tabRect.width + 'px';
      indicator.style.left = (tabRect.left - containerRect.left) + 'px';
    }
    
    // Initialize with first tab
    if (tabs.length > 0) {
      updateActiveTabIndicator(tabs[0]);
    }
  }
  