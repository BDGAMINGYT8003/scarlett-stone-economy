module.exports = (input, maxAmount) => {
    if (!input) return 0;
    input = input.toString().toLowerCase().replace(/,/g, '');

    if (input === 'all' || input === 'max') {
        return maxAmount;
    }

    if (input.endsWith('%')) {
        const percentage = parseFloat(input.slice(0, -1));
        if (isNaN(percentage)) return 0;
        return Math.floor(maxAmount * (percentage / 100));
    }

    const multipliers = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
    const lastChar = input.slice(-1);

    if (multipliers[lastChar]) {
        const number = parseFloat(input.slice(0, -1));
        if (isNaN(number)) return 0;
        return Math.floor(number * multipliers[lastChar]);
    }

    const number = parseFloat(input);
    return isNaN(number) ? 0 : Math.floor(number);
};
