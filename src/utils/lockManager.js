// In-memory set to track active user interactions (like search buttons)
// Map<userId, expireTimestamp>
const activeLocks = new Map();

const acquireLock = (userId) => {
    const now = Date.now();
    if (activeLocks.has(userId)) {
        const expireTime = activeLocks.get(userId);
        if (now < expireTime) {
            return false; // Locked
        }
    }
    // Lock for 30 seconds by default as a safety net
    activeLocks.set(userId, now + 30000);
    return true;
};

const releaseLock = (userId) => {
    activeLocks.delete(userId);
};

module.exports = {
    acquireLock,
    releaseLock
};
