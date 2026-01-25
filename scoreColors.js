// Score-based color mapping for button indicators
// Maps sustainability scores to color ratings for grid display

/**
 * Color definitions for each score range
 * These can be used for both CSS classes and direct styling
 */
const SCORE_COLORS = {
    red: {
        name: 'red',
        label: 'Poor',
        minScore: 0,
        maxScore: 39,
        primary: '#F44336',
        secondary: '#EF5350',
        light: '#E57373',
        gradient: 'linear-gradient(135deg, #F44336, #EF5350)',
        glow: 'rgba(244, 67, 54, 0.7)',
        textColor: '#F44336'
    },
    medium: {
        name: 'medium',
        label: 'Moderate',
        minScore: 40,
        maxScore: 64,
        primary: '#FF9800',
        secondary: '#FFB74D',
        light: '#FFCC80',
        gradient: 'linear-gradient(135deg, #FF9800, #FFB74D)',
        glow: 'rgba(255, 152, 0, 0.7)',
        textColor: '#F57C00'
    },
    lightGreen: {
        name: 'lightGreen',
        label: 'Good',
        minScore: 65,
        maxScore: 84,
        primary: '#8BC34A',
        secondary: '#AED581',
        light: '#C5E1A5',
        gradient: 'linear-gradient(135deg, #8BC34A, #AED581)',
        glow: 'rgba(139, 195, 74, 0.7)',
        textColor: '#7CB342'
    },
    darkGreen: {
        name: 'darkGreen',
        label: 'Excellent',
        minScore: 85,
        maxScore: 100,
        primary: '#2E7D32',
        secondary: '#43A047',
        light: '#66BB6A',
        gradient: 'linear-gradient(135deg, #2E7D32, #43A047)',
        glow: 'rgba(46, 125, 50, 0.7)',
        textColor: '#2E7D32'
    }
};

/**
 * Get color configuration based on a sustainability score
 * @param {number} score - The sustainability score (0-100)
 * @returns {Object} Color configuration object with all color properties
 */
function getColorFromScore(score) {
    // Clamp score to valid range
    const clampedScore = Math.max(0, Math.min(100, score));

    if (clampedScore < 40) {
        return SCORE_COLORS.red;
    } else if (clampedScore < 65) {
        return SCORE_COLORS.medium;
    } else if (clampedScore < 85) {
        return SCORE_COLORS.lightGreen;
    } else {
        return SCORE_COLORS.darkGreen;
    }
}

/**
 * Get CSS class name based on score
 * @param {number} score - The sustainability score (0-100)
 * @returns {string} CSS class name suffix (e.g., 'red', 'medium', 'lightGreen', 'darkGreen')
 */
function getColorClassFromScore(score) {
    const colorConfig = getColorFromScore(score);
    return colorConfig.name;
}

/**
 * Get label text based on score
 * @param {number} score - The sustainability score (0-100)
 * @returns {string} Human-readable label (e.g., 'Poor', 'Moderate', 'Good', 'Excellent')
 */
function getLabelFromScore(score) {
    const colorConfig = getColorFromScore(score);
    return colorConfig.label;
}

/**
 * Apply color styling directly to an element based on score
 * @param {HTMLElement} element - The DOM element to style
 * @param {number} score - The sustainability score (0-100)
 * @param {Object} options - Optional styling options
 * @param {boolean} options.useGradient - Use gradient background (default: true)
 * @param {boolean} options.addGlow - Add glow effect (default: true)
 */
function applyScoreColor(element, score, options = {}) {
    const { useGradient = true, addGlow = true } = options;
    const colorConfig = getColorFromScore(score);

    if (useGradient) {
        element.style.background = colorConfig.gradient;
    } else {
        element.style.backgroundColor = colorConfig.primary;
    }

    if (addGlow) {
        element.style.boxShadow = `0 0 10px ${colorConfig.glow}`;
    }

    return colorConfig;
}

/**
 * Get all score ranges and their colors for display purposes
 * @returns {Array} Array of score range objects
 */
function getScoreRanges() {
    return [
        { min: 0, max: 39, ...SCORE_COLORS.red },
        { min: 40, max: 64, ...SCORE_COLORS.medium },
        { min: 65, max: 84, ...SCORE_COLORS.lightGreen },
        { min: 85, max: 100, ...SCORE_COLORS.darkGreen }
    ];
}

// Export for use in other scripts
if (typeof module !== 'undefined') {
    module.exports = {
        SCORE_COLORS,
        getColorFromScore,
        getColorClassFromScore,
        getLabelFromScore,
        applyScoreColor,
        getScoreRanges
    };
}

if (typeof window !== 'undefined') {
    window.scoreColors = {
        SCORE_COLORS,
        getColorFromScore,
        getColorClassFromScore,
        getLabelFromScore,
        applyScoreColor,
        getScoreRanges
    };
}
