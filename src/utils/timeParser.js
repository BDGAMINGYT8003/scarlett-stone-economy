/**
 * Parses a time string into milliseconds.
 * Supports: s (seconds), m (minutes), h (hours), d (days), w (weeks), mo/month (months), y/year (years).
 * Example: "2h 30m" -> 9000000
 * @param {string} timeStr
 * @returns {number|null} Milliseconds or null if invalid
 */
function parseDuration(timeStr) {
    if (!timeStr) return null;

    const regex = /(\d+)\s*([a-zA-Z]+)/g;
    let totalMs = 0;
    let match;
    let found = false;

    while ((match = regex.exec(timeStr)) !== null) {
        found = true;
        const amount = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 's':
            case 'sec':
            case 'seconds':
                totalMs += amount * 1000;
                break;
            case 'm':
            case 'min':
            case 'mins':
            case 'minutes':
                totalMs += amount * 60 * 1000;
                break;
            case 'h':
            case 'hr':
            case 'hrs':
            case 'hours':
                totalMs += amount * 60 * 60 * 1000;
                break;
            case 'd':
            case 'day':
            case 'days':
                totalMs += amount * 24 * 60 * 60 * 1000;
                break;
            case 'w':
            case 'wk':
            case 'wks':
            case 'weeks':
                totalMs += amount * 7 * 24 * 60 * 60 * 1000;
                break;
            case 'mo':
            case 'mos':
            case 'month':
            case 'months':
                totalMs += amount * 30 * 24 * 60 * 60 * 1000; // Approx 30 days
                break;
            case 'y':
            case 'yr':
            case 'yrs':
            case 'year':
            case 'years':
                totalMs += amount * 365 * 24 * 60 * 60 * 1000; // Approx 365 days
                break;
            default:
                // Unknown unit, ignore or could invalidate
                break;
        }
    }

    return found ? totalMs : null;
}

module.exports = { parseDuration };
