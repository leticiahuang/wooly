// Material ratings and information
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

  // Semi-synthetic (yellow)
  'viscose': {
    rating: 'yellow',
    score: 4,
    category: 'Semi-synthetic',
    impact: 'Moderate environmental impact',
    details: 'Made from wood pulp but uses harmful chemicals in production, can contribute to deforestation',
    alternatives: ['Tencel/Lyocell', 'Organic cotton']
  },
  'rayon': {
    rating: 'yellow',
    score: 4,
    category: 'Semi-synthetic',
    impact: 'Moderate environmental impact',
    details: 'Similar to viscose, chemical-intensive process, deforestation concerns',
    alternatives: ['Tencel/Lyocell', 'Modal']
  },
  'modal': {
    rating: 'yellow',
    score: 5,
    category: 'Semi-synthetic',
    impact: 'Lower-moderate impact',
    details: 'More eco-friendly than viscose, made from beech trees, but still uses chemicals',
    alternatives: ['Tencel/Lyocell']
  },

  // Natural fibers (mostly green/yellow)
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
    details: 'No synthetic pesticides, better soil health, lower water use than conventional',
    alternatives: []
  },
  'linen': {
    rating: 'green',
    score: 9,
    category: 'Natural',
    impact: 'Very low environmental impact',
    details: 'Made from flax, requires minimal water and pesticides, biodegradable, durable',
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
    details: 'Natural, renewable, biodegradable. Concerns: animal welfare and methane emissions',
    alternatives: ['Organic wool', 'Recycled wool']
  },
  'silk': {
    rating: 'yellow',
    score: 6,
    category: 'Natural',
    impact: 'Moderate impact',
    details: 'Natural but production can harm silkworms, energy-intensive processing',
    alternatives: ['Peace silk', 'Tencel']
  },

  // Innovative/Eco fibers (green)
  'tencel': {
    rating: 'green',
    score: 9,
    category: 'Eco-friendly',
    impact: 'Very low environmental impact',
    details: 'Made from sustainably sourced wood, closed-loop process recycles water and chemicals',
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
  'recycled polyester': {
    rating: 'yellow',
    score: 6,
    category: 'Recycled',
    impact: 'Lower impact than virgin polyester',
    details: 'Reduces petroleum use and waste, but still sheds microplastics',
    alternatives: ['Tencel', 'Organic cotton']
  },
  'recycled cotton': {
    rating: 'green',
    score: 8,
    category: 'Recycled',
    impact: 'Low environmental impact',
    details: 'Reduces waste and resource use, no new pesticides or water needed',
    alternatives: []
  }
};

// Function to analyze material composition
function analyzeMaterials(materialsText) {
  if (!materialsText) return null;

  const text = materialsText.toLowerCase();
  const foundMaterials = [];
  let totalScore = 0;
  let worstRating = 'green';

  // Search for each material in the text
  for (const [material, data] of Object.entries(FABRIC_DATABASE)) {
    if (text.includes(material)) {
      foundMaterials.push({ name: material, ...data });
      totalScore += data.score;

      // Determine worst rating
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

// Function to calculate score from percentage inputs
// Takes any number of percentages and converts to decimals
function calculateScore(...percentages) {
  // Convert percentages to decimals
  const decimals = percentages.map(percent => percent / 100);

  // TODO: Add scoring logic here

  return decimals;
}

// Export for use in other scripts
if (typeof module !== 'undefined') module.exports = { FABRIC_DATABASE, analyzeMaterials, calculateScore };
if (typeof window !== 'undefined') window.fabricDB = { FABRIC_DATABASE, analyzeMaterials, calculateScore };