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
        maxScore: 40,
        primary: '#FCA5A5',
        secondary: '#FCA5A5',
        light: '#FCA5A5',
        gradient: 'linear-gradient(135deg, #FCA5A5, #FCA5A5)',
        glow: 'rgba(252, 165, 165, 0.7)',
        textColor: '#FCA5A5'
    },
    medium: {
        name: 'medium',
        label: 'Moderate',
        minScore: 40,
        maxScore: 65,
        primary: '#ffe386',
        secondary: '#ffe386',
        light: '#ffe386',
        gradient: 'linear-gradient(135deg, #ffe386, #ffe386)',
        glow: 'rgba(255, 227, 134, 0.7)',
        textColor: '#ffe386'
    },
    lightGreen: {
        name: 'lightGreen',
        label: 'Good',
        minScore: 65,
        maxScore: 85,
        primary: '#BBF7D0',
        secondary: '#BBF7D0',
        light: '#BBF7D0',
        gradient: 'linear-gradient(135deg, #BBF7D0, #BBF7D0)',
        glow: 'rgba(187, 247, 208, 0.7)',
        textColor: '#BBF7D0'
    },
    darkGreen: {
        name: 'darkGreen',
        label: 'Excellent',
        minScore: 85,
        maxScore: 100,
        primary: '#22C55E',
        secondary: '#22C55E',
        light: '#22C55E',
        gradient: 'linear-gradient(135deg, #22C55E, #22C55E)',
        glow: 'rgba(34, 197, 94, 0.7)',
        textColor: '#22C55E'
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

    if (clampedScore <= 40) {
        return SCORE_COLORS.red;
    } else if (clampedScore <= 65) {
        return SCORE_COLORS.medium;
    } else if (clampedScore <= 85) {
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
        { min: 0, max: 40, ...SCORE_COLORS.red },
        { min: 40, max: 65, ...SCORE_COLORS.medium },
        { min: 65, max: 85, ...SCORE_COLORS.lightGreen },
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
