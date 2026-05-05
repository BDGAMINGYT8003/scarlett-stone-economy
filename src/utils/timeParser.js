/**
 * Parses a time string into milliseconds.
 * Supports: s (seconds), m (minutes), h (hours), d (days), w (weeks), mo/month (months), y/year (years).
 * Example: "2h 30m" -> 9000000
 * @param {string} timeStr
 * @returns {number|null} Milliseconds or null if invalid
 */
function parseDuration(timeStr) {
    if (!timeStr) return null;

    const input = timeStr.toString().trim();
    if (!input) return null;

    const tokenRegex = /(\d+)\s*([a-zA-Z]+)/g;
    let totalMs = 0;
    let match;
    let cursor = 0;
    let found = false;

    while ((match = tokenRegex.exec(input)) !== null) {
        if (input.slice(cursor, match.index).trim() !== '') return null;

        found = true;
        cursor = tokenRegex.lastIndex;

        const amount = Number(match[1]);
        const unit = match[2].toLowerCase();
        let multiplier = 0;

        switch (unit) {
            case 's':
            case 'sec':
            case 'secs':
            case 'second':
            case 'seconds':
                multiplier = 1000;
                break;
            case 'm':
            case 'min':
            case 'mins':
            case 'minute':
            case 'minutes':
                multiplier = 60 * 1000;
                break;
            case 'h':
            case 'hr':
            case 'hrs':
            case 'hour':
            case 'hours':
                multiplier = 60 * 60 * 1000;
                break;
            case 'd':
            case 'day':
            case 'days':
                multiplier = 24 * 60 * 60 * 1000;
                break;
            case 'w':
            case 'wk':
            case 'wks':
            case 'week':
            case 'weeks':
                multiplier = 7 * 24 * 60 * 60 * 1000;
                break;
            case 'mo':
            case 'mos':
            case 'month':
            case 'months':
                multiplier = 30 * 24 * 60 * 60 * 1000;
                break;
            case 'y':
            case 'yr':
            case 'yrs':
            case 'year':
            case 'years':
                multiplier = 365 * 24 * 60 * 60 * 1000;
                break;
            default:
                return null;
        }

        totalMs += amount * multiplier;
        if (!Number.isFinite(totalMs) || totalMs <= 0) return null;
    }

    if (!found || input.slice(cursor).trim() !== '') return null;

    return totalMs;
}

module.exports = { parseDuration };
