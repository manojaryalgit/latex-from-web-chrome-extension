// popup.js - Modern LaTeX Extension Popup Controller

// Cross-browser compatibility
const browser = chrome || browser;

class PopupController {
  constructor() {
    this.isEnabled = true;
    this.stats = { copiedToday: 0, sitesVisited: 0 };
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupMessageListener();
    this.updateUI();
    this.loadStats();
  }

  async loadSettings() {
    try {
      const result = await browser.storage.sync.get(['extensionEnabled', 'stats']);
      this.isEnabled = result.extensionEnabled !== false; // default to true
      this.stats = result.stats || { copiedToday: 0, sitesVisited: 0 };
    } catch (error) {
      this.isEnabled = true;
    }
  }

  async saveSettings() {
    try {
      await browser.storage.sync.set({
        extensionEnabled: this.isEnabled,
        stats: this.stats
      });
    } catch (error) {
      // Fallback to local storage if sync fails
      try {
        await browser.storage.local.set({
          extensionEnabled: this.isEnabled,
          stats: this.stats
        });
      } catch (localError) {
        // Silent fail for cross-browser compatibility
      }
    }
  }

  setupEventListeners() {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const testBtn = document.getElementById('testBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    toggleSwitch?.addEventListener('click', () => this.toggleExtension());
    testBtn?.addEventListener('click', () => this.openTestPage());
    settingsBtn?.addEventListener('click', () => this.openSettings());

    document.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && e.target === toggleSwitch) {
        e.preventDefault();
        this.toggleExtension();
      }
    });
  }

  async toggleExtension() {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const status = document.getElementById('status');

    toggleSwitch.style.pointerEvents = 'none';
    toggleSwitch.style.opacity = '0.7';

    this.isEnabled = !this.isEnabled;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleExtension',
          enabled: this.isEnabled
        });
      }
    } catch (error) {
      // Content script not ready - silent fail
    }

    await this.saveSettings();

    setTimeout(() => {
      this.updateUI();
      toggleSwitch.style.pointerEvents = 'auto';
      toggleSwitch.style.opacity = '1';
    }, 150);
  }

  updateUI() {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const status = document.getElementById('status');
    const statusText = document.getElementById('statusText');

    if (this.isEnabled) {
      toggleSwitch.classList.add('active');
      status.classList.add('active');
      statusText.textContent = 'Active';
    } else {
      toggleSwitch.classList.remove('active');
      status.classList.remove('active');
      statusText.textContent = 'Disabled';
    }

    document.getElementById('copiedCount').textContent = this.stats.copiedToday;
    document.getElementById('sitesCount').textContent = this.stats.sitesVisited;
  }

  async loadStats() {
    try {
      const today = new Date().toDateString();
      const result = await chrome.storage.local.get([`stats_${today}`, 'sitesVisited']);
      this.stats.copiedToday = result[`stats_${today}`] || 0;
      this.stats.sitesVisited = Object.keys(result.sitesVisited || {}).length;
      this.updateUI();
    } catch (error) {
      // Stats not available - silent fail
    }
  }

  async openTestPage() {
    const testBtn = document.getElementById('testBtn');
    const originalText = testBtn.innerHTML;

    testBtn.innerHTML = '<span class="pulse">🔄</span> Opening...';
    testBtn.disabled = true;

    try {
      await chrome.tabs.create({
        url: 'https://en.wikipedia.org/wiki/Quadratic_formula',
        active: true
      });

      setTimeout(() => window.close(), 100);
    } catch (error) {
      testBtn.innerHTML = '<span>❌</span> Error';
      setTimeout(() => {
        testBtn.innerHTML = originalText;
        testBtn.disabled = false;
      }, 2000);
    }
  }

  async openSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const originalText = settingsBtn.innerHTML;

    settingsBtn.innerHTML = 'Coming Soon...';
    settingsBtn.disabled = true;

    setTimeout(() => {
      settingsBtn.innerHTML = originalText;
      settingsBtn.disabled = false;
    }, 1500);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateStats') {
        this.stats.copiedToday = message.copiedToday || this.stats.copiedToday;
        this.updateUI();
      }
    });
  }
}

// Instantiate only once
let popupController = null;

document.addEventListener('DOMContentLoaded', () => {
  popupController = new PopupController();
});

// Only refresh stats, don't reinitialize controller
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && popupController) {
    popupController.loadStats();
  }
});
