// Background service worker
console.log('Fabric Rating Extension background worker loaded');

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Fabric Rating Extension installed');
  
  // Set default settings
  chrome.storage.sync.set({
    enabled: true,
    showNotifications: true
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeMaterial') {
    // Material analysis logic could be moved here if needed
    sendResponse({ success: true });
  }
  
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['enabled', 'showNotifications'], (data) => {
      sendResponse(data);
    });
    return true; // Will respond asynchronously
  }
  
  return false;
});