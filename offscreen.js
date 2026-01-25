// Offscreen document script for parsing HTML in the background
// This runs invisibly without creating any visible tabs or windows

// FABRIC_Q keys - the canonical fabric names we recognize
// Two-word entries MUST come before single-word to match correctly
const fabricQKeys = [
    'recycled polyester', 'organic cotton', 'recycled cotton',
    'cashmere', 'merino', 'wool', 'silk', 'linen', 'flax', 'hemp', 'cotton',
    'viscose', 'rayon', 'lyocell', 'tencel', 'modal',
    'nylon', 'polyamide', 'polyester', 'acrylic',
    'elastane', 'spandex'
];

// Blacklist of words that are NOT materials (labels, headers, etc.)
const nonMaterials = [
    'composition', 'material', 'materials', 'fabric', 'fabrics', 'content',
    'care', 'washing', 'instructions', 'made', 'origin', 'country', 'shell',
    'lining', 'outer', 'inner', 'main', 'body', 'exterior', 'interior'
];

// Parse material composition from text - normalizes to FABRIC_Q keys
function parseComposition(text) {
    if (!text) return null;

    const rawMaterials = [];

    // Clean up the text
    const cleanText = text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ');

    // Pattern 1: "60% Cotton" or "60 % Cotton" or "60% Compact Cotton"
    const pattern1 = /(\d+)\s*%\s*([a-zA-Z][a-zA-Z\s]{1,25})/gi;
    let match;
    while ((match = pattern1.exec(cleanText)) !== null) {
        const percentage = parseInt(match[1]);
        const material = match[2].trim().toLowerCase().replace(/[,\.\s]+$/, '');

        if (percentage > 0 && percentage <= 100) {
            // Skip if it's a non-material word (label, header, etc.)
            const isBlacklisted = nonMaterials.some(nm => material.includes(nm));
            if (isBlacklisted) continue;

            rawMaterials.push({ name: material, percentage });
        }
    }

    // Pattern 2: "Cotton 60%" or "Cotton: 60%"
    const pattern2 = /([a-zA-Z][a-zA-Z\s]{1,25})[:\s]+(\d+)\s*%/gi;
    while ((match = pattern2.exec(cleanText)) !== null) {
        const material = match[1].trim().toLowerCase().replace(/[,\.\s]+$/, '');
        const percentage = parseInt(match[2]);

        if (percentage > 0 && percentage <= 100) {
            // Skip if it's a non-material word
            const isBlacklisted = nonMaterials.some(nm => material.includes(nm));
            if (isBlacklisted) continue;

            rawMaterials.push({ name: material, percentage });
        }
    }

    // Normalize materials to FABRIC_Q keys and combine percentages
    // Maps normalized fabric name -> total percentage
    const normalizedMap = new Map();

    for (const mat of rawMaterials) {
        const materialName = mat.name;
        let matchedFabric = null;

        // Try to find a matching FABRIC_Q key
        // Check two-word matches first (e.g., "organic cotton" before "cotton")
        for (const fabricKey of fabricQKeys) {
            if (materialName === fabricKey) {
                // Exact match - use as is
                matchedFabric = fabricKey;
                break;
            }
            if (materialName.includes(fabricKey)) {
                // e.g., "compact cotton" contains "cotton"
                // But "organic cotton" should match "organic cotton" not "cotton"
                // Since fabricQKeys has two-word entries first, this works correctly
                matchedFabric = fabricKey;
                break;
            }
        }

        if (matchedFabric) {
            // Add to existing percentage or create new entry
            const existing = normalizedMap.get(matchedFabric) || 0;
            normalizedMap.set(matchedFabric, existing + mat.percentage);
        }
    }

    // Convert map back to materials array
    const materials = [];
    for (const [name, percentage] of normalizedMap) {
        materials.push({ name, percentage: Math.min(percentage, 100) }); // Cap at 100%
    }

    // Sort by percentage (highest first)
    materials.sort((a, b) => b.percentage - a.percentage);

    return materials.length > 0 ? materials : null;
}

// Extract composition from parsed HTML document
// Only returns the first populated section (e.g., MAIN FABRIC under OUTER SHELL, not DETAILS)
function extractComposition(doc) {
    // Priority order - most specific Zara selectors first
    const selectors = [
        // Zara-specific composition containers
        '.product-detail-extra-info__section:has(.product-detail-extra-info__title)',
        '.structured-component-text-block-subtitle',
        '.structured-component-text-block-paragraph',
        '.product-detail-info__composition',
        '.product-detail-extra-info__composition',
        '.expandable-text__inner-content',
        // Generic fallbacks (less reliable)
        '[class*="composition"]'
    ];

    let bestMatch = null;
    let bestMatchScore = 0;

    for (const selector of selectors) {
        try {
            const elements = doc.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent.trim();

                // Skip if no meaningful content
                if (!text || text.length < 10) continue;

                // Must have percentage signs to be composition data
                if (!text.includes('%')) continue;

                // Score based on how much composition-like content it has
                const percentMatches = (text.match(/\d+\s*%/g) || []).length;
                const hasFabricWords = /cotton|polyester|viscose|wool|silk|linen|elastane|nylon/i.test(text);
                const hasCompositionHeader = /composition|outer shell|main fabric/i.test(text);

                let score = percentMatches;
                if (hasFabricWords) score += 5;
                if (hasCompositionHeader) score += 10;

                // Prefer shorter, more focused text (less noise)
                if (text.length < 500) score += 3;
                if (text.length < 200) score += 2;

                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatch = text;
                }
            }
        } catch (e) {
            // Selector might not be supported, continue to next
            continue;
        }
    }

    if (bestMatch) {
        console.log('Raw composition text found:', bestMatch.substring(0, 200));
        return extractAllSectionsNormalized(bestMatch);
    }

    return null;
}

// Extract ALL sections with fabric data and return them for normalized processing
// Each section is weighted equally (1/n where n = number of sections with fabric data)
function extractAllSectionsNormalized(text) {
    if (!text) return null;

    console.log('Extracting all sections from:', text.substring(0, 300));

    // Split text into lines for processing
    const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);

    console.log('Lines found:', lines.length, lines.slice(0, 10));

    // Helper: check if a line looks like a section header
    // Headers are typically: ALL CAPS, short, no percentage signs, no fabric pattern
    function isLikelyHeader(line) {
        // Skip empty or very short lines
        if (!line || line.length < 2) return false;

        // If line contains percentage, it's fabric data not a header
        if (line.includes('%')) return false;

        // If line contains typical fabric percentage pattern, not a header
        if (/\d+\s*%/.test(line)) return false;

        // ALL CAPS lines (with possible punctuation like & , :) are likely headers
        // e.g., "OUTER SHELL", "LINING", "COMPOSITION, CARE & ORIGIN"
        const isAllCaps = /^[A-Z][A-Z\s,&:\-\.]+$/.test(line) && line.length >= 3 && line.length <= 50;
        if (isAllCaps) return true;

        // Lines that are very short and contain only letters/spaces (potential subsection headers)
        // e.g., "Body", "Sleeves" - but be careful not to match "wool", "silk"
        const isShortPotentialHeader = line.length <= 20 && /^[A-Za-z\s]+$/.test(line) && !line.includes('%');
        if (isShortPotentialHeader) {
            // Check if it could be a fabric name (lowercase typically or contains fabric words)
            const lowerLine = line.toLowerCase();
            const fabricWords = ['cotton', 'polyester', 'wool', 'silk', 'linen', 'viscose', 'nylon', 'cashmere', 'elastane', 'spandex', 'acrylic', 'modal', 'lyocell', 'hemp', 'rayon'];
            const isFabricWord = fabricWords.some(fw => lowerLine.includes(fw));
            if (isFabricWord) return false;

            // If it's title case or all caps and doesn't contain fabric words, likely a header
            const isCapitalized = line[0] === line[0].toUpperCase();
            return isCapitalized && line.length >= 3;
        }

        return false;
    }

    // Collect all sections with their content
    const sections = [];
    let currentSectionLines = [];
    let currentHeader = null;

    for (const line of lines) {
        if (isLikelyHeader(line)) {
            // Save previous section if it had content
            if (currentSectionLines.length > 0) {
                sections.push({ header: currentHeader, lines: [...currentSectionLines] });
                console.log('Saved section:', currentHeader, 'with', currentSectionLines.length, 'lines');
            }
            // Start a new section
            currentHeader = line;
            currentSectionLines = [];
        } else {
            // Add line to current section
            currentSectionLines.push(line);
        }
    }

    // Don't forget the last section
    if (currentSectionLines.length > 0) {
        sections.push({ header: currentHeader, lines: [...currentSectionLines] });
        console.log('Saved final section:', currentHeader, 'with', currentSectionLines.length, 'lines');
    }

    console.log('Total sections found:', sections.length);

    // Filter to only sections that have percentage data (fabric composition)
    const fabricSections = [];
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const sectionText = section.lines.join(' ');
        const hasPercentage = /\d+\s*%/.test(sectionText);

        console.log(`Section ${i} [${section.header}]:`, sectionText.substring(0, 100), '| Has %:', hasPercentage);

        if (hasPercentage) {
            fabricSections.push({ header: section.header, text: sectionText });
        }
    }

    console.log('Fabric sections found:', fabricSections.length);

    if (fabricSections.length === 0) {
        // Fallback: if no sections with percentages found, check if original text has any
        if (text.includes('%')) {
            const percentLines = lines.filter(l => l.includes('%'));
            if (percentLines.length > 0) {
                console.log('Fallback: using percentage lines directly');
                return { sections: [{ header: null, text: percentLines.join(' ') }], count: 1 };
            }
        }
        console.log('No fabric composition found');
        return null;
    }

    console.log('✓ Returning all fabric sections for normalization:', fabricSections.map(s => s.header));
    return { sections: fabricSections, count: fabricSections.length };
}

// Find where the first section ends (before next section header or significant gap)
function findEndOfFirstSection(text, startIndex) {
    const sectionHeaders = [
        'outer shell', 'body', 'shell', 'lining', 'details',
        'filling', 'padding', 'trim', 'collar', 'hood'
    ];

    let endIndex = text.length;

    for (const header of sectionHeaders) {
        const headerIndex = text.toLowerCase().indexOf(header, startIndex + 10);
        if (headerIndex !== -1 && headerIndex < endIndex) {
            endIndex = headerIndex;
        }
    }

    return endIndex;
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

        const compositionData = extractComposition(doc);

        if (compositionData && compositionData.sections && compositionData.sections.length > 0) {
            // Calculate weight per section (equal weight for each section)
            const sectionWeight = 1 / compositionData.count;
            console.log(`Processing ${compositionData.count} sections, each with weight ${(sectionWeight * 100).toFixed(1)}%`);

            // Combine materials from all sections with their weighted percentages
            const combinedMaterials = new Map(); // fabric name -> weighted percentage

            for (const section of compositionData.sections) {
                console.log(`Processing section: ${section.header}`);
                const sectionMaterials = parseComposition(section.text);

                if (sectionMaterials) {
                    for (const mat of sectionMaterials) {
                        // Apply section weight to the material percentage
                        const weightedPercentage = mat.percentage * sectionWeight;
                        const existing = combinedMaterials.get(mat.name) || 0;
                        combinedMaterials.set(mat.name, existing + weightedPercentage);
                        console.log(`  ${mat.name}: ${mat.percentage}% × ${(sectionWeight * 100).toFixed(1)}% = ${weightedPercentage.toFixed(2)}% (total: ${(existing + weightedPercentage).toFixed(2)}%)`);
                    }
                }
            }

            // Convert to array and normalize to exactly 100%
            const materials = [];
            let totalPercentage = 0;
            for (const [name, percentage] of combinedMaterials) {
                materials.push({ name, percentage });
                totalPercentage += percentage;
            }

            // Normalize if total is not 100% (should be close, but normalize for precision)
            if (totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.1) {
                console.log(`Normalizing from ${totalPercentage.toFixed(2)}% to 100%`);
                const normalizationFactor = 100 / totalPercentage;
                for (const mat of materials) {
                    mat.percentage = Math.round(mat.percentage * normalizationFactor * 10) / 10; // Round to 1 decimal
                }
            } else {
                // Round to 1 decimal place
                for (const mat of materials) {
                    mat.percentage = Math.round(mat.percentage * 10) / 10;
                }
            }

            // Sort by percentage (highest first)
            materials.sort((a, b) => b.percentage - a.percentage);

            console.log('Final normalized materials:', materials);

            // Create raw text showing what sections were processed
            const rawText = compositionData.sections.map(s => `[${s.header || 'MAIN'}] ${s.text}`).join(' | ');

            return { raw: rawText, materials, sectionCount: compositionData.count };
        }

        return null;
    } catch (error) {
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
