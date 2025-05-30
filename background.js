// background.js - LaTeX From Web Extension Background Script

// Cross-browser compatibility
const browser = chrome || browser;

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation
    browser.storage.sync.set({
      extensionEnabled: true,
      installDate: new Date().toISOString()
    });
    
    // Open welcome/tutorial page
    browser.tabs.create({
      url: 'https://en.wikipedia.org/wiki/Quadratic_formula',
      active: true
    });
    
    // Show notification
    if (browser.notifications) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'LaTeX From Web Installed!',
        message: 'Hover over any math equation to copy its LaTeX code. Click the extension icon to toggle on/off.'
      });
    }
  }
});

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStats') {
    // Return current stats
    browser.storage.local.get(null, (result) => {
      const today = new Date().toDateString();
      const todayKey = `stats_${today}`;
      sendResponse({
        copiedToday: result[todayKey] || 0,
        sitesVisited: Object.keys(result.sitesVisited || {}).length
      });
    });
    return true; // Keep message channel open
  }
});

// Clean up old stats (keep only last 30 days)
if (browser.runtime.onStartup) {
  browser.runtime.onStartup.addListener(() => {
    browser.storage.local.get(null, (result) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const keysToRemove = [];
      Object.keys(result).forEach(key => {
        if (key.startsWith('stats_')) {
          const dateStr = key.replace('stats_', '');
          const date = new Date(dateStr);
          if (date < thirtyDaysAgo) {
            keysToRemove.push(key);
          }
        }
      });
      
      if (keysToRemove.length > 0) {
        browser.storage.local.remove(keysToRemove);
      }
    });
  });
}
