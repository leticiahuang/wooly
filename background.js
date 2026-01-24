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

/**
 * Parse material composition using Gemini API
 * We send panelText (primary) and panelHtml (optional, capped) for context.
 */
async function parseCompositionWithGemini({ panelText, panelHtml }) {
  try {
    const { geminiApiKey } = 'AIzaSyBnVIlloNnbM3O4zOZrbZ8PMNKIA9yWrlE';

    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return null;
    }

    const htmlSnippet = panelHtml ? panelHtml.slice(0, 8000) : "";

    const prompt = `Extract the clothing material composition from the text below.

Return STRICT JSON only (no backticks) in this exact structure:
{
  "materials": [
    {"name": "cotton", "percentage": 80},
    {"name": "polyester", "percentage": 20}
  ],
  "raw": "the original composition text you used"
}

If no composition is present, return null.

TEXT:
${panelText}

(HTML for context, if helpful):
${htmlSnippet}`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' +
        encodeURIComponent(geminiApiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    console.log('Gemini response:', data);

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return null;
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      console.error('No response from Gemini');
      return null;
    }

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Gemini might return "null" literally
      if (responseText.trim().toLowerCase() === "null") return null;
      console.error('Could not extract JSON from Gemini response:', responseText);
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error parsing composition with Gemini:', error);
    return null;
  }
}

/**
 * Injected function for Zara:
 * - clicks the "Composition/Materials/Care" control
 * - waits for the drawer role="dialog" to be visible
 * - extracts the materials panel (data-observer-key="materials") when available
 * Returns { ok, panelText, panelHtml, error? }
 */
async function extractZaraPanelInPage() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function isVisible(el) {
    if (!el) return false;
    // offsetParent null can be false for fixed elements; so also check bounding rect
    const rect = el.getBoundingClientRect?.();
    const hasBox = rect && (rect.width > 0 || rect.height > 0);
    const style = window.getComputedStyle(el);
    const notHidden = style && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
    return (el.offsetParent !== null || hasBox) && notHidden;
  }

 function findOpenButton() {
  return document.querySelector(
    'button.product-detail-actions__action-button[data-qa-action="show-extra-detail"]'
  );
}

  async function waitForDialog(timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const dialog =
        document.querySelector('[role="dialog"][aria-label*="Composition"]') ||
        document.querySelector('[role="dialog"][aria-label*="composition"]') ||
        document.querySelector('.product-detail-actions-extra-detail-modal [role="dialog"]') ||
        document.querySelector('.product-detail-actions-extra-detail-modal');

      if (dialog && isVisible(dialog)) return dialog;
      await sleep(100);
    }
    return null;
  }

  async function waitForMaterialsSection(dialog, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const materials =
        dialog.querySelector('[data-observer-key="materials"]') ||
        dialog.querySelector('[data-observer-key="recycledMaterials"]') ||
        dialog.querySelector('[class*="materials"]') ||
        dialog.querySelector('[class*="composition"]');

      if (materials && materials.textContent.trim().length > 0) return materials;
      await sleep(100);
    }
    return null;
  }

  // 1) click open button (if any)
  const btn = findOpenButton();
  if (btn) {
    console.log('Zara: clicking composition open button');
    btn.click();
    // let animations / state updates begin
    await sleep(350);
  }

  // 2) wait for dialog/drawer
  const dialog = await waitForDialog();
  if (!dialog) {
    return { ok: false, error: 'Could not find composition dialog/drawer' };
  }

  // 3) wait for materials section inside dialog
  const materialsEl = await waitForMaterialsSection(dialog);
  const targetEl = materialsEl || dialog;

  const panelHtml = targetEl.outerHTML || '';
  const panelText = (targetEl.innerText || targetEl.textContent || '').trim();

  if (!panelText) {
    return { ok: false, error: 'Found dialog but no readable composition text' };
  }

  return { ok: true, panelHtml, panelText };
}

/**
 * Generic click-to-reveal fallback (non-Zara)
 * Not as reliable as per-site adapters, but better than nothing.
 */
async function extractGenericCompositionInPage() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Try clicking something that looks like composition/materials
  const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
  const opener = candidates.find(el => /composition|materials|fabric|care|details/i.test((el.innerText || el.textContent || '').trim()));
  if (opener) {
    opener.click();
    await sleep(350);
  }

  const likely = Array.from(document.querySelectorAll('[class*="composition"], [class*="material"], [data-test*="composition"], [data-testid*="composition"]'));
  let best = null;

  for (const el of likely) {
    const text = (el.innerText || el.textContent || '').trim();
    if (!text) continue;
    if (text.includes('%') || /cotton|polyester|viscose|wool|silk|linen|acrylic|nylon|polyamide|elastane|spandex/i.test(text)) {
      best = el;
      break;
    }
  }

  if (!best) return { ok: false, error: 'No composition-like element found' };

  return {
    ok: true,
    panelHtml: best.outerHTML || '',
    panelText: (best.innerText || best.textContent || '').trim()
  };
}

/**
 * Function to scrape composition by opening product page in background tab and injecting extraction script
 */
async function scrapeCompositionInTab(url) {
  let tabId = null;

  try {
    // Create a new tab (inactive) to load the product page
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;

    // Wait for the page to load completely
    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Extra time for JS hydration
          setTimeout(resolve, 2000);
        }
      });
    });

    const isZara = /(^|\.)zara\./i.test(new URL(url).hostname);

    // Inject script to extract panel text/html
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: isZara ? extractZaraPanelInPage : extractGenericCompositionInPage
    });

    // Close the tab ASAP
    await chrome.tabs.remove(tabId);
    tabId = null;

    const r = results?.[0]?.result;
    if (!r || !r.ok) {
      console.warn('Panel extraction failed:', r?.error || 'unknown');
      return null;
    }

    // Send ONLY the panel content to Gemini
    const compositionData = await parseCompositionWithGemini({
      panelText: r.panelText,
      panelHtml: r.panelHtml
    });

    return compositionData;
  } catch (error) {
    console.error('Error in scrapeCompositionInTab:', error);
    return null;
  } finally {
    // Safety cleanup if something threw before we removed the tab
    if (tabId != null) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeComposition') {
    scrapeCompositionInTab(request.url)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => {
        console.error('Scraping error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // async
  }

  if (request.action === 'analyzeMaterial') {
    sendResponse({ success: true });
  }

  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['enabled', 'showNotifications'], (data) => {
      sendResponse(data);
    });
    return true;
  }

  return false;
});
