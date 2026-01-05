const EMOJIS = {
    emptyHead: '<:PROGRESS_BAR_EMPTY_HEAD:1457840149793870087>',
    emptyBetween: '<:PROGRESS_BAR_EMPTY_BETWEEN:1457840152046207110>',
    emptyLast: '<:PROGRESS_BAR_EMPTY_LAST:1457840154180845741>',
    fullHead: '<a:PROGRESS_BAR_FULL_HEAD:1457840155993047273>',
    fullBetween: '<a:PROGRESS_BAR_FULL_BETWEEN:1457840157771436173>',
    fullLast: '<a:PROGRESS_BAR_FULL_LAST:1457840160107397312>',
    halfHead: '<a:PROGRESS_BAR_HALF_HEAD:1457840162200359063>',
    halfBetween: '<a:PROGRESS_BAR_HALF_BETWEEN:1457840164612341913>',
    halfLast: '<a:PROGRESS_BAR_HALF_LAST:1457840166445125723>'
};

/**
 * Generates a progress bar string using custom emojis.
 * @param {number} current Current value
 * @param {number} max Max value
 * @param {number} size Number of segments (default 5)
 * @returns {string} The progress bar string
 */
function getProgressBar(current, max, size = 5) {
    const percentage = Math.min(Math.max(current / max, 0), 1);
    const progress = percentage * size;
    const filledSegments = Math.floor(progress);
    const hasHalf = (progress - filledSegments) >= 0.5;

    let bar = '';

    // Head
    if (filledSegments > 0) {
        bar += EMOJIS.fullHead;
    } else if (hasHalf && filledSegments === 0) { // Should not happen if size >= 1 but for safety
        // Logic check: if 0 full segments but has half, it means we are in the first segment
        // Wait, HEAD is the first segment.
        // If progress is 0.6 -> filled=0, hasHalf=true. First segment is half.
        // But do we have Half Head? Yes.
        bar += EMOJIS.halfHead;
    } else {
        bar += EMOJIS.emptyHead;
    }

    // Between
    for (let i = 1; i < size - 1; i++) {
        if (i < filledSegments) {
            bar += EMOJIS.fullBetween;
        } else if (i === filledSegments && hasHalf) {
            bar += EMOJIS.halfBetween;
        } else {
            bar += EMOJIS.emptyBetween;
        }
    }

    // Last
    if (size > 1) {
        if (filledSegments >= size) { // Full bar
            bar += EMOJIS.fullLast;
        } else if (filledSegments === size - 1 && hasHalf) {
            bar += EMOJIS.halfLast;
        } else {
            bar += EMOJIS.emptyLast;
        }
    }

    return bar;
}

module.exports = { getProgressBar };
