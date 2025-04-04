/**
 * tabs.js - Sets up responsive tab navigation. (v1.1 - Added Export & Logging)
 */

// Export the function for use in main.js
export function setupTabNavigation() { // <--- ADD export HERE
  const tabs = document.querySelectorAll('.tabs .tab'); // More specific selector
  const tabContent = document.querySelectorAll('.controls-wrapper > .tab-content'); // Target direct children
  console.log(`[Tabs] Initializing setup... Found ${tabs.length} tabs and ${tabContent.length} content panels.`);

  if (!tabs.length || !tabContent.length) {
      console.warn("[Tabs] No tabs or tab content elements found. Aborting setup.");
      return;
  }

  tabs.forEach(tab => {
      if (tab.dataset.tabListenerAttached === 'true') return; // Avoid duplicate listeners

      tab.addEventListener('click', function(event) {
          event.preventDefault(); // Prevent potential default anchor behavior if using <a> tags later
          console.log(`[Tabs] Clicked: ${this.id} (data-tab: ${this.dataset.tab})`);

          // Deactivate others
          tabs.forEach(t => t.classList.remove('active'));
          tabContent.forEach(content => content.classList.remove('active'));
          console.log(`[Tabs] Deactivated all tabs and content.`);

          // Activate clicked tab and corresponding content
          this.classList.add('active');
          const targetContentId = `${this.dataset.tab}-tab`; // e.g., "text-tab"
          const targetContent = document.getElementById(targetContentId);

          if (targetContent) {
              targetContent.classList.add('active');
              console.log(`[Tabs] Activated tab content: #${targetContentId}`);

              // Scroll into view on mobile
              if (window.innerWidth <= 768) {
                  console.log(`[Tabs] Mobile detected, scrolling to #${targetContentId}`);
                  setTimeout(() => {
                      targetContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
              }
          } else {
              console.error(`[Tabs] Target content panel '#${targetContentId}' not found! Check HTML IDs.`);
          }

          // Update active tab indicator (if using one)
          // updateActiveTabIndicator(this);
      });

      tab.dataset.tabListenerAttached = 'true'; // Mark listener as attached
  });

  // --- Initialize correct active tab/content on load ---
  // Find the currently active tab button based on its class
  let activeTab = document.querySelector('.tabs .tab.active');

  // If no tab button has the active class initially, activate the first one
  if (!activeTab && tabs.length > 0) {
      console.log("[Tabs] No active tab found on init, activating first tab and content.");
      tabs[0].classList.add('active'); // Activate first button
      activeTab = tabs[0]; // Update activeTab reference
  }

  // Ensure the corresponding content panel is active
  if (activeTab) {
      const activeContentId = `${activeTab.dataset.tab}-tab`;
      const activeContent = document.getElementById(activeContentId);
      // Deactivate all content first
      tabContent.forEach(content => content.classList.remove('active'));
      // Activate the correct one
      if (activeContent) {
          activeContent.classList.add('active');
          console.log(`[Tabs] Initial active tab: #${activeTab.id}, Content: #${activeContentId}`);
      } else {
          console.error(`[Tabs] Initial active tab content '#${activeContentId}' not found!`);
      }
      // Update indicator if needed
      // updateActiveTabIndicator(activeTab);
  } else {
      console.warn("[Tabs] No active tab determined on init.");
  }

  console.log("[Tabs] Setup complete.");
}

// --- Active Tab Indicator Logic (Keep if you have the .active-tab-indicator element) ---
/*
function updateActiveTabIndicator(activeTab) {
  const indicator = document.querySelector('.active-tab-indicator');
  if (!indicator || !activeTab) return;
  const tabRect = activeTab.getBoundingClientRect();
  const tabsContainer = activeTab.closest('.tabs'); // Find the closest parent with class 'tabs'
  if (!tabsContainer) return;
  const containerRect = tabsContainer.getBoundingClientRect();
  indicator.style.width = tabRect.width + 'px';
  indicator.style.left = (tabRect.left - containerRect.left + tabsContainer.scrollLeft) + 'px'; // Account for scroll
}
*/