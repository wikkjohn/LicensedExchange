/**
 * Ad configuration for Licensed Business Exchange
 * Replace networkCode and adUnitPaths with your own Google Ad Manager setup
 */
window.AD_CONFIG = {
  networkCode: "YOUR_NETWORK_CODE", // e.g., "12345678"
  gptLibraryUrl: "https://www.googletagservices.com/tag/js/gpt.js",
  options: {
    collapseEmptyDivs: true,
    singleRequest: true
  },
  slots: [
    // Top leaderboard in header
    {
      name: "header_leaderboard",
      adUnitPath: "/YOUR_NETWORK_CODE/header_leaderboard",
      sizes: [[728, 90], [320, 50]], // responsive
      divId: "ad-header-leaderboard"
    },
    // Banner below hero
    {
      name: "hero_banner",
      adUnitPath: "/YOUR_NETWORK_CODE/hero_banner",
      sizes: [[970, 90], [728, 90]],
      divId: "ad-hero-banner",
      collapseEmptyDiv: true
    },
    // Sidebar ads (300x250)
    {
      name: "sidebar_top",
      adUnitPath: "/YOUR_NETWORK_CODE/sidebar_top",
      sizes: [[300, 250]],
      divId: "ad-sidebar-top"
    },
    {
      name: "sidebar_middle",
      adUnitPath: "/YOUR_NETWORK_CODE/sidebar_middle",
      sizes: [[300, 250]],
      divId: "ad-sidebar-middle"
    },
    {
      name: "sidebar_bottom",
      adUnitPath: "/YOUR_NETWORK_CODE/sidebar_bottom",
      sizes: [[300, 250]],
      divId: "ad-sidebar-bottom"
    }
  ]
};

/**
 * Initialize Google Publisher Tags (GPT)
 * Call this function after the DOM is ready
 */
function initAds() {
  // Create googletag queue if not exists
  window.googletag = window.googletag || { cmd: [] };

  // Load GPT library
  const gptScript = document.createElement("script");
  gptScript.async = true;
  gptScript.src = window.AD_CONFIG.gptLibraryUrl;
  document.head.appendChild(gptScript);

  // Setup ads after GPT loads
  window.googletag.cmd.push(function() {
    const cfg = window.AD_CONFIG;
    const pubads = googletag.pubads();

    // Set options
    if (cfg.options.collapseEmptyDivs) {
      pubads.collapseEmptyDivs();
    }

    // Define slots
    cfg.slots.forEach(function(slot) {
      // Only define if div exists on page
      if (!document.getElementById(slot.divId)) return;

      const gptSlot = googletag.defineSlot(slot.adUnitPath, slot.sizes, slot.divId);
      if (!gptSlot) return;

      gptSlot.addService(pubads);

      if (slot.collapseEmptyDiv) {
        gptSlot.setCollapseEmptyDiv(true, true);
      }
    });

    if (cfg.options.singleRequest) {
      pubads.enableSingleRequest();
    }

    googletag.enableServices();

    // Display slots that exist in DOM
    cfg.slots.forEach(function(slot) {
      if (document.getElementById(slot.divId)) {
        googletag.display(slot.divId);
      }
    });
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAds);
} else {
  initAds();
}