// In-memory set to track active user interactions (like search buttons)
// Map<userId, expireTimestamp>
const activeLocks = new Map();

const acquireLock = (userId, duration = 60000) => {
    const now = Date.now();
    if (activeLocks.has(userId)) {
        const expireTime = activeLocks.get(userId);
        if (now < expireTime) {
            return false; // Locked
        }
    }
    // Lock for duration (default 60 seconds) to allow collector to finish cleanly before auto-expiry
    activeLocks.set(userId, now + duration);
    return true;
};

const releaseLock = (userId) => {
    activeLocks.delete(userId);
};

module.exports = {
    acquireLock,
    releaseLock
};
