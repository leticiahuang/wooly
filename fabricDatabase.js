/**
 * Fabric Blend Quality Score System
 * ----------------------------------
 * Score = clamp(0..100, 100 * (w_b*B + w_s*S - P))
 * 
 * Where:
 * - B = weighted base quality
 * - S = saturation bonus (diminishing returns)
 * - P = superlinear penalty for "bad" fabrics
 */

// ---------------------------
// 1) Base fabric quality map (0.0 to 1.0)
// ---------------------------
const FABRIC_Q = {
  // Premium naturals
  "cashmere": 0.95,
  "merino": 0.90,
  "wool": 0.85,
  "silk": 0.88,

  // Plant naturals
  "linen": 0.82,
  "flax": 0.82,
  "hemp": 0.80,
  "cotton": 0.72,
  "organic cotton": 0.75,

  // Regenerated cellulose
  "viscose": 0.62,
  "rayon": 0.62,
  "lyocell": 0.73,
  "tencel": 0.73,
  "modal": 0.70,

  // Synthetics
  "nylon": 0.58,
  "polyamide": 0.58,
  "polyester": 0.45,
  "acrylic": 0.30,

  // Stretch
  "elastane": 0.35,
  "spandex": 0.35,

  // Recycled
  "recycled polyester": 0.43,
  "recycled cotton": 0.68
};

// ---------------------------
// 2) GOOD / BAD fabric sets
// ---------------------------
const GOOD_FABRICS = new Set([
  "cashmere", "merino", "wool", "silk", "linen", "flax", "hemp", "cotton",
  "organic cotton", "lyocell", "tencel", "modal", "viscose", "rayon", "recycled cotton"
]);

const BAD_BASE_FABRICS = new Set(["polyester", "acrylic"]);

const ELASTANE_NAMES = new Set(["elastane", "spandex"]);

// ---------------------------
// 3) Scoring parameters
// ---------------------------
const SCORING_PARAMS = {
  w_b: 0.75,                    // base weight
  w_s: 0.35,                    // saturation bonus weight
  alpha: 1.00,                  // penalty strength
  gamma: 1.80,                  // penalty exponent (>1 = harsh growth)
  beta: 2.00,                   // saturation speed
  elastane_bad_threshold: 0.10, // if elastane/spandex > 10%, treat as "bad"
  unknown_fabric_q: 0.40        // fallback quality if fabric unknown
};

// ---------------------------
// 4) Helper functions
// ---------------------------
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function normalizeBlend(blend) {
  /**
   * Takes an object {fabric: fraction} and normalizes to sum to 1.0
   * Input can use percentages (0-100) or fractions (0-1)
   */
  const entries = Object.entries(blend);
  let total = entries.reduce((sum, [_, v]) => sum + v, 0);

  if (total <= 0) {
    throw new Error("Blend has no positive percentages.");
  }

  // If values are percentages (sum > 1), convert to fractions
  if (total > 1.5) {
    total = entries.reduce((sum, [_, v]) => sum + v, 0);
    return Object.fromEntries(entries.map(([k, v]) => [k.toLowerCase(), v / total]));
  }

  return Object.fromEntries(entries.map(([k, v]) => [k.toLowerCase(), v / total]));
}

function getQ(fabric) {
  const key = fabric.toLowerCase();
  return FABRIC_Q[key] !== undefined ? FABRIC_Q[key] : SCORING_PARAMS.unknown_fabric_q;
}

function isBad(fabric, fraction) {
  /**
   * Returns true if this fabric is considered "bad" in the context of the blend.
   * - polyester, acrylic => always bad
   * - elastane/spandex => bad only if fraction > threshold
   */
  const key = fabric.toLowerCase();

  if (BAD_BASE_FABRICS.has(key)) {
    return true;
  }

  if (ELASTANE_NAMES.has(key) && fraction > SCORING_PARAMS.elastane_bad_threshold) {
    return true;
  }

  return false;
}

// ---------------------------
// 5) Core scoring components
// ---------------------------
function computeBaseQuality(blend) {
  /**
   * B = sum(w_i * q_i) for each fabric i
   */
  let B = 0;
  for (const [fabric, fraction] of Object.entries(blend)) {
    B += fraction * getQ(fabric);
  }
  return B;
}

function computeSaturationBonus(blend) {
  /**
   * S = sum over GOOD fabrics of: w_i * (1 - exp(-beta * w_i))
   * This gives diminishing returns for adding more of the same good fabric.
   */
  const beta = SCORING_PARAMS.beta;
  let S = 0;

  for (const [fabric, fraction] of Object.entries(blend)) {
    if (GOOD_FABRICS.has(fabric.toLowerCase())) {
      S += fraction * (1 - Math.exp(-beta * fraction));
    }
  }

  return S;
}

function computePenalty(blend) {
  /**
   * P = alpha * sum over BAD fabrics of: w_i^gamma
   * Superlinear penalty means more bad fabric hurts disproportionately.
   */
  const { alpha, gamma } = SCORING_PARAMS;
  let P = 0;

  for (const [fabric, fraction] of Object.entries(blend)) {
    if (isBad(fabric, fraction)) {
      P += Math.pow(fraction, gamma);
    }
  }

  return alpha * P;
}

// ---------------------------
// 6) Main scoring function
// ---------------------------
function calculateBlendScore(materials) {
  /**
   * Calculate the fabric blend quality score.
   * 
   * @param {Array} materials - Array of {name: string, percentage: number}
   * @returns {number} Score from 0 to 100
   * 
   * Formula: Score = clamp(0..100, 100 * (w_b*B + w_s*S - P))
   */
  if (!materials || materials.length === 0) {
    return 50; // Default score for unknown
  }

  // Convert materials array to blend object
  const blend = {};
  for (const mat of materials) {
    const name = mat.name.toLowerCase().trim();
    const percentage = mat.percentage || 0;
    blend[name] = percentage / 100; // Convert to fraction
  }

  // Normalize blend to sum to 1.0
  let normalizedBlend;
  try {
    normalizedBlend = normalizeBlend(blend);
  } catch (e) {
    return 50; // Default on error
  }

  // Compute components
  const B = computeBaseQuality(normalizedBlend);
  const S = computeSaturationBonus(normalizedBlend);
  const P = computePenalty(normalizedBlend);

  // Final score
  const { w_b, w_s } = SCORING_PARAMS;
  const rawScore = 100 * (w_b * B + w_s * S - P);
  const finalScore = Math.round(clamp(rawScore, 0, 100));

  console.log(`Blend score: B=${B.toFixed(3)}, S=${S.toFixed(3)}, P=${P.toFixed(3)} => ${finalScore}`);

  return finalScore;
}

// ---------------------------
// Legacy compatibility layer
// ---------------------------
const FABRIC_DATABASE = {
  // Synthetic materials (mostly red/yellow)
  'polyester': {
    rating: 'red',
    score: 2,
    category: 'Synthetic',
    impact: 'High environmental impact',
    details: 'Derived from petroleum, releases microplastics when washed, not biodegradable',
    alternatives: ['Organic cotton', 'Tencel', 'Linen']
  },
  'acrylic': {
    rating: 'red',
    score: 1,
    category: 'Synthetic',
    impact: 'Very high environmental impact',
    details: 'Petroleum-based, sheds microplastics heavily, energy-intensive production',
    alternatives: ['Wool', 'Cotton', 'Hemp']
  },
  'nylon': {
    rating: 'red',
    score: 2,
    category: 'Synthetic',
    impact: 'High environmental impact',
    details: 'Petroleum-based, requires significant energy, releases microplastics',
    alternatives: ['Silk', 'Organic cotton']
  },
  'spandex': {
    rating: 'yellow',
    score: 3,
    category: 'Synthetic',
    impact: 'Moderate impact',
    details: 'Often necessary for stretch, but petroleum-based and not biodegradable',
    alternatives: ['Natural rubber blends']
  },
  'elastane': {
    rating: 'yellow',
    score: 3,
    category: 'Synthetic',
    impact: 'Moderate impact',
    details: 'Similar to spandex, petroleum-based but often needed in small amounts',
    alternatives: ['Natural rubber blends']
  },
  'viscose': {
    rating: 'yellow',
    score: 4,
    category: 'Semi-synthetic',
    impact: 'Moderate environmental impact',
    details: 'Made from wood pulp but uses harmful chemicals in production',
    alternatives: ['Tencel/Lyocell', 'Organic cotton']
  },
  'rayon': {
    rating: 'yellow',
    score: 4,
    category: 'Semi-synthetic',
    impact: 'Moderate environmental impact',
    details: 'Similar to viscose, chemical-intensive process',
    alternatives: ['Tencel/Lyocell', 'Modal']
  },
  'modal': {
    rating: 'yellow',
    score: 5,
    category: 'Semi-synthetic',
    impact: 'Lower-moderate impact',
    details: 'More eco-friendly than viscose, made from beech trees',
    alternatives: ['Tencel/Lyocell']
  },
  'cotton': {
    rating: 'yellow',
    score: 5,
    category: 'Natural',
    impact: 'Moderate impact (conventional)',
    details: 'Natural but conventional cotton uses pesticides and lots of water',
    alternatives: ['Organic cotton', 'Hemp', 'Linen']
  },
  'organic cotton': {
    rating: 'green',
    score: 8,
    category: 'Natural',
    impact: 'Low environmental impact',
    details: 'No synthetic pesticides, better soil health, lower water use',
    alternatives: []
  },
  'linen': {
    rating: 'green',
    score: 9,
    category: 'Natural',
    impact: 'Very low environmental impact',
    details: 'Made from flax, requires minimal water and pesticides, biodegradable',
    alternatives: []
  },
  'hemp': {
    rating: 'green',
    score: 9,
    category: 'Natural',
    impact: 'Very low environmental impact',
    details: 'Requires little water, no pesticides, enriches soil, biodegradable',
    alternatives: []
  },
  'wool': {
    rating: 'green',
    score: 7,
    category: 'Natural',
    impact: 'Low-moderate impact',
    details: 'Natural, renewable, biodegradable. Concerns: animal welfare',
    alternatives: ['Organic wool', 'Recycled wool']
  },
  'silk': {
    rating: 'yellow',
    score: 6,
    category: 'Natural',
    impact: 'Moderate impact',
    details: 'Natural but production can harm silkworms',
    alternatives: ['Peace silk', 'Tencel']
  },
  'tencel': {
    rating: 'green',
    score: 9,
    category: 'Eco-friendly',
    impact: 'Very low environmental impact',
    details: 'Made from sustainably sourced wood, closed-loop process',
    alternatives: []
  },
  'lyocell': {
    rating: 'green',
    score: 9,
    category: 'Eco-friendly',
    impact: 'Very low environmental impact',
    details: 'Similar to Tencel, eco-friendly production from wood pulp',
    alternatives: []
  },
  'cashmere': {
    rating: 'green',
    score: 9,
    category: 'Premium Natural',
    impact: 'Low impact if sustainably sourced',
    details: 'Luxurious natural fiber, biodegradable',
    alternatives: []
  },
  'merino': {
    rating: 'green',
    score: 8,
    category: 'Premium Natural',
    impact: 'Low-moderate impact',
    details: 'High quality wool, temperature regulating',
    alternatives: []
  },
  'recycled polyester': {
    rating: 'yellow',
    score: 6,
    category: 'Recycled',
    impact: 'Lower impact than virgin polyester',
    details: 'Reduces petroleum use, but still sheds microplastics',
    alternatives: ['Tencel', 'Organic cotton']
  },
  'recycled cotton': {
    rating: 'green',
    score: 8,
    category: 'Recycled',
    impact: 'Low environmental impact',
    details: 'Reduces waste and resource use',
    alternatives: []
  }
};

// Legacy analysis function (for backward compatibility)
function analyzeMaterials(materialsText) {
  if (!materialsText) return null;

  const text = materialsText.toLowerCase();
  const foundMaterials = [];
  let totalScore = 0;
  let worstRating = 'green';

  for (const [material, data] of Object.entries(FABRIC_DATABASE)) {
    if (text.includes(material)) {
      foundMaterials.push({ name: material, ...data });
      totalScore += data.score;

      if (data.rating === 'red') worstRating = 'red';
      else if (data.rating === 'yellow' && worstRating !== 'red') worstRating = 'yellow';
    }
  }

  if (foundMaterials.length === 0) return null;

  const avgScore = totalScore / foundMaterials.length;

  return {
    materials: foundMaterials,
    overallRating: worstRating,
    avgScore: avgScore,
    composition: materialsText
  };
}

// Export for use in other scripts
if (typeof module !== 'undefined') {
  module.exports = {
    FABRIC_DATABASE,
    FABRIC_Q,
    SCORING_PARAMS,
    analyzeMaterials,
    calculateBlendScore,
    computeBaseQuality,
    computeSaturationBonus,
    computePenalty
  };
}

if (typeof window !== 'undefined') {
  window.fabricDB = {
    FABRIC_DATABASE,
    FABRIC_Q,
    SCORING_PARAMS,
    analyzeMaterials,
    calculateBlendScore,
    computeBaseQuality,
    computeSaturationBonus,
    computePenalty
  };
}