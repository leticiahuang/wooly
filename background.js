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

// Parse material composition from text
function parseComposition(text) {
  if (!text) return null;
  
  const materials = [];
  
  // Common patterns: "100% Cotton", "Cotton 100%", "50% Polyester, 50% Cotton"
  const percentPattern = /(\d+)%?\s*([a-zA-Z\s]+)|([a-zA-Z\s]+)\s*(\d+)%/gi;
  
  let match;
  while ((match = percentPattern.exec(text)) !== null) {
    const percentage = match[1] || match[4];
    const material = (match[2] || match[3]).trim().toLowerCase();
    
    if (percentage && material) {
      materials.push({
        name: material,
        percentage: parseInt(percentage)
      });
    }
  }
  
  return materials.length > 0 ? materials : null;
}

// Function to scrape composition by injecting a script into the product page
async function scrapeCompositionInTab(url) {
  try {
    // Create a new tab (hidden) to load the product page
    const tab = await chrome.tabs.create({ url: url, active: false });
    
    // Wait for the page to load
    await new Promise(resolve => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 2000); // Wait extra time for dynamic content
        }
      });
    });
    
    // Inject script to extract composition
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try multiple selectors for Zara's composition section
        const selectors = [
          '.product-detail-info__composition',
          '.product-detail-extra-info__composition',
          '[data-qa-anchor="product-detail-info__composition"]',
          '.expandable-text__inner-content',
          '.product-detail-view__composition',
          '[class*="composition"]',
          '[class*="material"]'
        ];
        
        let compositionText = null;
        
        // Try to click the "Composition, care and origin" tab if it exists
        const tabs = document.querySelectorAll('[class*="tab"], button[class*="accordion"]');
        for (const tab of tabs) {
          if (/composition|material|fabric|care/i.test(tab.textContent)) {
            tab.click();
            break;
          }
        }
        
        // Wait a moment for content to appear after clicking
        setTimeout(() => {}, 500);
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent.trim();
            // Check if it contains percentage or material keywords
            if (text && (text.includes('%') || /cotton|polyester|viscose|wool|silk|linen|acrylic|nylon|elastane|spandex/i.test(text))) {
              compositionText = text;
              break;
            }
          }
          if (compositionText) break;
        }
        
        // Fallback: look in all text content
        if (!compositionText) {
          const allText = document.body.textContent;
          const compositionMatch = allText.match(/(?:composition|material|fabric)[\s:]+([^.]+(?:\d+%[^.]+)+)/i);
          if (compositionMatch) {
            compositionText = compositionMatch[1];
          }
        }
        
        return compositionText;
      }
    });
    
    // Close the tab
    await chrome.tabs.remove(tab.id);
    
    if (results && results[0] && results[0].result) {
      const compositionText = results[0].result;
      const materials = parseComposition(compositionText);
      
      return {
        raw: compositionText,
        materials: materials
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error in scrapeCompositionInTab:', error);
    return null;
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeComposition') {
    // Handle async scraping
    scrapeCompositionInTab(request.url)
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('Scraping error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  }
  
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