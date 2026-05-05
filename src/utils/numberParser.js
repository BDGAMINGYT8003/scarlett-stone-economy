const MAX_SQLITE_INTEGER = 9_007_199_254_740_991; // Number.MAX_SAFE_INTEGER

const clampToSafeInteger = (value) => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(Math.floor(value), MAX_SQLITE_INTEGER);
};

module.exports = (input, maxAmount = 0) => {
    if (input === null || input === undefined) return 0;

    const normalizedMax = clampToSafeInteger(Number(maxAmount));
    const value = input.toString().trim().toLowerCase().replace(/,/g, '');

    if (!value) return 0;

    if (value === 'all' || value === 'max') {
        return normalizedMax;
    }

    const percentMatch = value.match(/^(\d+(?:\.\d+)?)%$/);
    if (percentMatch) {
        const percentage = Number(percentMatch[1]);
        return clampToSafeInteger(normalizedMax * (percentage / 100));
    }

    const multiplierMatch = value.match(/^(\d+(?:\.\d+)?)([kmbt])$/);
    if (multiplierMatch) {
        const multipliers = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
        return clampToSafeInteger(Number(multiplierMatch[1]) * multipliers[multiplierMatch[2]]);
    }

    const numberMatch = value.match(/^(\d+(?:\.\d+)?)$/);
    if (!numberMatch) return 0;

    return clampToSafeInteger(Number(numberMatch[1]));
};
