// Popup script
document.addEventListener('DOMContentLoaded', () => {
  // Load settings
  chrome.storage.sync.get(['enabled', 'showNotifications', 'ratedCount'], (data) => {
    document.getElementById('enableToggle').checked = data.enabled !== false;
    document.getElementById('notifyToggle').checked = data.showNotifications !== false;
    document.getElementById('ratedCount').textContent = data.ratedCount || 0;
  });
  
  // Enable toggle
  document.getElementById('enableToggle').addEventListener('change', (e) => {
    chrome.storage.sync.set({ enabled: e.target.checked });
    
    // Reload content scripts if toggled
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });
  
  // Notifications toggle
  document.getElementById('notifyToggle').addEventListener('change', (e) => {
    chrome.storage.sync.set({ showNotifications: e.target.checked });
  });
});