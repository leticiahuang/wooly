// Offscreen document script for parsing HTML in the background
// This runs invisibly without creating any visible tabs or windows

// Known material names to filter valid matches
const knownMaterials = [
    'cotton', 'polyester', 'nylon', 'wool', 'silk', 'linen', 'hemp',
    'viscose', 'rayon', 'modal', 'tencel', 'lyocell', 'spandex', 'elastane',
    'acrylic', 'cashmere', 'leather', 'suede', 'denim', 'fleece', 'velvet',
    'satin', 'chiffon', 'tweed', 'corduroy', 'jersey', 'organza', 'lace',
    'recycled polyester', 'organic cotton', 'recycled cotton', 'bamboo',
    'merino', 'polyamide', 'flax'
];

// Blacklist of words that are NOT materials (labels, headers, etc.)
const nonMaterials = [
    'composition', 'material', 'materials', 'fabric', 'fabrics', 'content',
    'care', 'washing', 'instructions', 'made', 'origin', 'country', 'shell',
    'lining', 'outer', 'inner', 'main', 'body', 'exterior', 'interior'
];

// Parse material composition from text
function parseComposition(text) {
    if (!text) return null;

    const materials = [];
    const seen = new Set();

    // Clean up the text
    const cleanText = text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ');

    // Pattern 1: "60% Cotton" or "60 % Cotton"
    const pattern1 = /(\d+)\s*%\s*([a-zA-Z][a-zA-Z\s]{1,25})/gi;
    let match;
    while ((match = pattern1.exec(cleanText)) !== null) {
        const percentage = parseInt(match[1]);
        const material = match[2].trim().toLowerCase().replace(/[,\.\s]+$/, '');
        const key = material.split(/\s+/)[0];

        if (percentage > 0 && percentage <= 100 && !seen.has(key)) {
            // Skip if it's a non-material word (label, header, etc.)
            const isBlacklisted = nonMaterials.some(nm => material.includes(nm) || nm.includes(key));
            if (isBlacklisted) continue;

            // Check if it's a known material
            const isKnown = knownMaterials.some(m => material.includes(m) || m.includes(key));
            if (isKnown) {
                materials.push({ name: material, percentage });
                seen.add(key);
            }
        }
    }

    // Pattern 2: "Cotton 60%" or "Cotton: 60%"
    const pattern2 = /([a-zA-Z][a-zA-Z\s]{1,25})[:\s]+(\d+)\s*%/gi;
    while ((match = pattern2.exec(cleanText)) !== null) {
        const material = match[1].trim().toLowerCase().replace(/[,\.\s]+$/, '');
        const percentage = parseInt(match[2]);
        const key = material.split(/\s+/)[0];

        if (percentage > 0 && percentage <= 100 && !seen.has(key)) {
            // Skip if it's a non-material word
            const isBlacklisted = nonMaterials.some(nm => material.includes(nm) || nm.includes(key));
            if (isBlacklisted) continue;

            const isKnown = knownMaterials.some(m => material.includes(m) || m.includes(key));
            if (isKnown) {
                materials.push({ name: material, percentage });
                seen.add(key);
            }
        }
    }

    // Sort by percentage (highest first)
    materials.sort((a, b) => b.percentage - a.percentage);

    return materials.length > 0 ? materials : null;
}

// Extract composition from parsed HTML document
function extractComposition(doc) {
    const selectors = [
        '.product-detail-info__composition',
        '.product-detail-extra-info__composition',
        '.expandable-text__inner-content',
        '[class*="composition"]',
        '[class*="material"]'
    ];

    for (const selector of selectors) {
        const elements = doc.querySelectorAll(selector);
        for (const el of elements) {
            const text = el.textContent.trim();
            if (text && (text.includes('%') || /cotton|polyester|viscose|wool|silk|linen/i.test(text))) {
                return text;
            }
        }
    }

    return null;
}

function extractAmazonFabricType(doc) {
    const rows = doc.querySelectorAll('.product-facts-detail');
    for (const row of rows) {
      const labelEl = row.querySelector('.a-col-left .a-color-base');
      const valueEl = row.querySelector('.a-col-right .a-color-base');
      const label = labelEl?.textContent?.trim()?.toLowerCase();
      const value = valueEl?.textContent?.trim();
  
      if (!label || !value) continue;
  
      if (label === 'fabric type' || label.includes('fabric')) {
        return value; // e.g. "100% Cotton"
      }
    }
    return null;
  }

// Fetch and parse a URL
async function scrapeUrl(url) {
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 1) Amazon-specific: try to extract "Fabric type" from Product Details
        const hostname = new URL(url).hostname;
        if (hostname.includes('amazon.')) {
        const fabricText = extractAmazonFabricType(doc);
        if (fabricText) {
            const materials = parseComposition(fabricText);
            return { raw: fabricText, materials };
        }
        }

        // 2) Generic fallback for other sites (and for Amazon if fabric not found)
        const compositionText = extractComposition(doc);

        if (compositionText) {
        const materials = parseComposition(compositionText);
        return { raw: compositionText, materials };
        }

        return null;
    }

    catch (error) {
        console.error('Offscreen scrape error:', error);
        return null;
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrapeUrl') {
        scrapeUrl(message.url)
            .then(data => {
                sendResponse({ success: true, data });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // Will respond asynchronously
    }
});

console.log('Offscreen scraper ready');
