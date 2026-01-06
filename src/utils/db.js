const Database = require('better-sqlite3');
const db = new Database('economy.db');
const itemsConfig = require('../config/items.json');

// Initialize tables
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 0,
        bank INTEGER DEFAULT 0,
        bank_capacity INTEGER DEFAULT 5000,
        daily_last_claimed INTEGER DEFAULT 0,
        weekly_last_claimed INTEGER DEFAULT 0,
        monthly_last_claimed INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        job_id TEXT DEFAULT NULL,
        shifts_completed_today INTEGER DEFAULT 0,
        total_shifts_completed INTEGER DEFAULT 0,
        last_shift_timestamp INTEGER DEFAULT 0,
        promotions INTEGER DEFAULT 0,
        is_premium INTEGER DEFAULT 0,
        beg_count INTEGER DEFAULT 0,
        search_count INTEGER DEFAULT 0,
        crime_count INTEGER DEFAULT 0,
        postmemes_count INTEGER DEFAULT 0,
        work_earnings INTEGER DEFAULT 0,
        slots_wins INTEGER DEFAULT 0,
        highlow_wins INTEGER DEFAULT 0,
        snakeeyes_wins INTEGER DEFAULT 0,
        rob_coins INTEGER DEFAULT 0,
        patreon_months INTEGER DEFAULT 0,
        used_2025_last_day INTEGER DEFAULT 0,
        unlocked_badges TEXT DEFAULT '[]',
        premium_expires_at INTEGER DEFAULT 0,
        premium_duration_text TEXT DEFAULT NULL,
        selected_title TEXT DEFAULT NULL,
        commands_ran INTEGER DEFAULT 0,
        items_used INTEGER DEFAULT 0,
        shared_coins INTEGER DEFAULT 0,
        plants_harvested INTEGER DEFAULT 0,
        slots_won_amount INTEGER DEFAULT 0,
        slots_lost_amount INTEGER DEFAULT 0,
        slots_played INTEGER DEFAULT 0,
        snakeeyes_won_amount INTEGER DEFAULT 0,
        snakeeyes_lost_amount INTEGER DEFAULT 0,
        snakeeyes_played INTEGER DEFAULT 0,
        god_mode_expires_at INTEGER DEFAULT 0
    )
`).run();

// Migrations for existing DB
const columns = [
    'daily_streak', 'job_id', 'shifts_completed_today', 'total_shifts_completed',
    'last_shift_timestamp', 'promotions', 'is_premium', 'beg_count', 'search_count',
    'crime_count', 'postmemes_count', 'work_earnings', 'slots_wins', 'highlow_wins',
    'snakeeyes_wins', 'rob_coins', 'patreon_months', 'used_2025_last_day',
    'premium_expires_at', 'selected_title', 'commands_ran', 'items_used', 'shared_coins',
    'plants_harvested', 'slots_won_amount', 'slots_lost_amount', 'slots_played',
    'snakeeyes_won_amount', 'snakeeyes_lost_amount', 'snakeeyes_played',
    'god_mode_expires_at'
];

columns.forEach(col => {
    try { db.prepare(`ALTER TABLE users ADD COLUMN ${col} INTEGER DEFAULT 0`).run(); } catch (e) {}
});

// Separate migration for text columns
try { db.prepare(`ALTER TABLE users ADD COLUMN unlocked_badges TEXT DEFAULT '[]'`).run(); } catch (e) {}
try { db.prepare(`ALTER TABLE users ADD COLUMN premium_duration_text TEXT DEFAULT NULL`).run(); } catch (e) {}
try { db.prepare(`ALTER TABLE users ADD COLUMN selected_title TEXT DEFAULT NULL`).run(); } catch (e) {}

db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (
        user_id TEXT,
        item_id TEXT,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, item_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS unlocked_titles (
        user_id TEXT,
        title_id TEXT,
        PRIMARY KEY (user_id, title_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS achievements (
        user_id TEXT,
        achievement_id TEXT,
        completed INTEGER DEFAULT 0,
        progress INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, achievement_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS user_job_stats (
        user_id TEXT,
        job_id TEXT,
        stars INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, job_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS command_usage (
        user_id TEXT,
        command_name TEXT,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, command_name)
    )
`).run();

// User Methods
const getUser = (userId) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT INTO users (id) VALUES (?)').run(userId);
        return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }
    return user;
};

// Premium Methods
const isPremium = (userId) => {
    const user = getUser(userId);
    if (user.is_premium) return true;
    if (user.premium_expires_at > Date.now()) return true;
    return false;
};

const setPremium = (userId, status) => {
    getUser(userId);
    if (!status) {
        db.prepare('UPDATE users SET is_premium = 0, premium_expires_at = 0, premium_duration_text = NULL WHERE id = ?').run(userId);
    } else {
        db.prepare('UPDATE users SET is_premium = 1 WHERE id = ?').run(userId);
    }
};

const addPremiumDuration = (userId, ms, durationText) => {
    const user = getUser(userId);
    let currentExpiry = user.premium_expires_at || Date.now();
    if (currentExpiry < Date.now()) currentExpiry = Date.now();

    const newExpiry = currentExpiry + ms;

    db.prepare('UPDATE users SET premium_expires_at = ?, premium_duration_text = ? WHERE id = ?').run(newExpiry, durationText, userId);
};

const getExpiredPremiumUsers = () => {
    const now = Date.now();
    return db.prepare('SELECT * FROM users WHERE premium_expires_at > 0 AND premium_expires_at < ?').all(now);
};

// God Mode Methods
const setGodMode = (userId, durationMs) => {
    getUser(userId);
    // If durationMs is 0 or null, we treat as permanent (conceptually), but storing 0 might imply "not active" in expiration logic.
    // So for permanent, we can store a very large number or -1.
    // Let's stick to "omitted = permanent".
    // If permanent, set to MAX_INTEGER (or similar).
    // SQLite MAX INTEGER: 9223372036854775807.
    // JS Date max: 8640000000000000.

    let expiresAt = -1; // Permanent
    if (durationMs) {
        expiresAt = Date.now() + durationMs;
    }

    db.prepare('UPDATE users SET god_mode_expires_at = ? WHERE id = ?').run(expiresAt, userId);
};

const isGodMode = (userId) => {
    const user = getUser(userId);
    if (!user.god_mode_expires_at) return false; // 0 or null

    if (user.god_mode_expires_at === -1) return true; // Permanent
    if (user.god_mode_expires_at > Date.now()) return true; // Active

    return false;
};

// Economy Methods
const addBalance = (userId, amount) => {
    getUser(userId);
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
};

const removeBalance = (userId, amount) => {
    getUser(userId);
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId);
};

const addBank = (userId, amount) => {
    getUser(userId);
    db.prepare('UPDATE users SET bank = bank + ? WHERE id = ?').run(amount, userId);
};

const removeBank = (userId, amount) => {
    getUser(userId);
    db.prepare('UPDATE users SET bank = bank - ? WHERE id = ?').run(amount, userId);
};

const increaseBankCapacity = (userId, amount) => {
    getUser(userId);
    db.prepare('UPDATE users SET bank_capacity = bank_capacity + ? WHERE id = ?').run(amount, userId);
};

// Stat Increment Methods
const incrementStat = (userId, stat, amount = 1) => {
    getUser(userId);
    // Allow extended stats
    const validStats = [
        'beg_count', 'search_count', 'crime_count', 'postmemes_count',
        'work_earnings', 'slots_wins', 'highlow_wins', 'snakeeyes_wins',
        'rob_coins', 'patreon_months', 'used_2025_last_day',
        'commands_ran', 'items_used', 'shared_coins', 'plants_harvested',
        'slots_won_amount', 'slots_lost_amount', 'slots_played',
        'snakeeyes_won_amount', 'snakeeyes_lost_amount', 'snakeeyes_played'
    ];
    if (validStats.includes(stat)) {
        db.prepare(`UPDATE users SET ${stat} = ${stat} + ? WHERE id = ?`).run(amount, userId);
    }
};

const setStat = (userId, stat, value) => {
    getUser(userId);
    const validStats = ['used_2025_last_day', 'patreon_months', 'selected_title'];
    if (validStats.includes(stat)) {
        db.prepare(`UPDATE users SET ${stat} = ? WHERE id = ?`).run(value, userId);
    }
}

// Achievement Methods
const getAchievements = (userId) => {
    return db.prepare('SELECT * FROM achievements WHERE user_id = ?').all(userId);
};

const setAchievement = (userId, achievementId, completed, progress) => {
    const existing = db.prepare('SELECT * FROM achievements WHERE user_id = ? AND achievement_id = ?').get(userId, achievementId);
    if (existing) {
        db.prepare('UPDATE achievements SET completed = ?, progress = ? WHERE user_id = ? AND achievement_id = ?').run(completed ? 1 : 0, progress, userId, achievementId);
    } else {
        db.prepare('INSERT INTO achievements (user_id, achievement_id, completed, progress) VALUES (?, ?, ?, ?)').run(userId, achievementId, completed ? 1 : 0, progress);
    }
};

// Title Methods
const getTitles = (userId) => {
    const titles = db.prepare('SELECT title_id FROM unlocked_titles WHERE user_id = ?').all(userId);
    return titles.map(t => t.title_id);
};

const addTitle = (userId, titleId) => {
    const existing = db.prepare('SELECT * FROM unlocked_titles WHERE user_id = ? AND title_id = ?').get(userId, titleId);
    if (!existing) {
        db.prepare('INSERT INTO unlocked_titles (user_id, title_id) VALUES (?, ?)').run(userId, titleId);
    }
};

const setTitle = (userId, titleId) => {
    // Verify ownership first logic should be in command/manager, but DB just updates
    setStat(userId, 'selected_title', titleId);
};

const getUnlockedBadges = (userId) => {
    const user = getUser(userId);
    try {
        return JSON.parse(user.unlocked_badges || '[]');
    } catch (e) {
        return [];
    }
};

const setUnlockedBadges = (userId, badges) => {
    getUser(userId);
    db.prepare('UPDATE users SET unlocked_badges = ? WHERE id = ?').run(JSON.stringify(badges), userId);
};

// Reward Methods
const setLastClaimed = (userId, type, timestamp) => {
    getUser(userId);
    db.prepare(`UPDATE users SET ${type}_last_claimed = ? WHERE id = ?`).run(timestamp, userId);
};

const setStreak = (userId, streak) => {
    getUser(userId);
    db.prepare('UPDATE users SET daily_streak = ? WHERE id = ?').run(streak, userId);
};

// Job Methods
const setJob = (userId, jobId) => {
    getUser(userId);
    db.prepare('UPDATE users SET job_id = ? WHERE id = ?').run(jobId, userId);
};

const removeJob = (userId) => {
    getUser(userId);
    db.prepare('UPDATE users SET job_id = NULL, shifts_completed_today = 0 WHERE id = ?').run(userId);
};

const addShift = (userId, timestamp) => {
    getUser(userId);
    db.prepare('UPDATE users SET shifts_completed_today = shifts_completed_today + 1, total_shifts_completed = total_shifts_completed + 1, last_shift_timestamp = ? WHERE id = ?').run(timestamp, userId);
};

const addPromotion = (userId) => {
    getUser(userId);
    db.prepare('UPDATE users SET promotions = promotions + 1 WHERE id = ?').run(userId);
};

const resetDailyShifts = (userId) => {
    getUser(userId);
    db.prepare('UPDATE users SET shifts_completed_today = 0 WHERE id = ?').run(userId);
};

const getAllUsersWithJobs = () => {
    return db.prepare('SELECT * FROM users WHERE job_id IS NOT NULL').all();
};

const getTotalWorkStars = (userId) => {
    try {
        const result = db.prepare('SELECT SUM(stars) as total FROM user_job_stats WHERE user_id = ?').get(userId);
        return result ? result.total || 0 : 0;
    } catch (e) {
        return 0;
    }
};

const getAllUserJobStars = (userId) => {
    try {
        return db.prepare('SELECT * FROM user_job_stats WHERE user_id = ?').all(userId);
    } catch (e) {
        return [];
    }
};

const incrementCommandUsage = (userId, commandName) => {
    const existing = db.prepare('SELECT count FROM command_usage WHERE user_id = ? AND command_name = ?').get(userId, commandName);
    if (existing) {
        db.prepare('UPDATE command_usage SET count = count + 1 WHERE user_id = ? AND command_name = ?').run(userId, commandName);
    } else {
        db.prepare('INSERT INTO command_usage (user_id, command_name, count) VALUES (?, ?, 1)').run(userId, commandName);
    }
};

const getFavoriteCommand = (userId) => {
    try {
        const result = db.prepare('SELECT command_name, count FROM command_usage WHERE user_id = ? ORDER BY count DESC LIMIT 1').get(userId);
        return result ? result.command_name : 'None';
    } catch (e) {
        return 'None';
    }
};

// Inventory Methods
const addItem = (userId, itemId, quantity) => {
    const current = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    if (current) {
        db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?').run(quantity, userId, itemId);
    } else {
        db.prepare('INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)').run(userId, itemId, quantity);
    }
};

const removeItem = (userId, itemId, quantity) => {
    const current = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    if (!current) return false;

    if (current.quantity <= quantity) {
        db.prepare('DELETE FROM inventory WHERE user_id = ? AND item_id = ?').run(userId, itemId);
    } else {
        db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE user_id = ? AND item_id = ?').run(quantity, userId, itemId);
    }
    return true;
};

const getInventory = (userId) => {
    return db.prepare('SELECT * FROM inventory WHERE user_id = ?').all(userId);
};

const getItemCount = (userId, itemId) => {
    const item = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    return item ? item.quantity : 0;
};

const calculateNetWorth = (userId) => {
    const user = getUser(userId);
    const inventory = getInventory(userId);
    let invValue = 0;

    for (const invItem of inventory) {
        const itemData = itemsConfig.find(i => i.id === invItem.item_id);
        if (itemData) {
            invValue += (itemData.net_value * invItem.quantity);
        }
    }

    return (user.balance ?? 0) + (user.bank ?? 0) + invValue;
};

module.exports = {
    getUser,
    isPremium,
    setPremium,
    addPremiumDuration,
    getExpiredPremiumUsers,
    setGodMode,
    isGodMode,
    addBalance,
    removeBalance,
    addBank,
    removeBank,
    increaseBankCapacity,
    incrementStat,
    setStat,
    getUnlockedBadges,
    setUnlockedBadges,
    setLastClaimed,
    setStreak,
    setJob,
    removeJob,
    addShift,
    addPromotion,
    resetDailyShifts,
    getAllUsersWithJobs,
    getTotalWorkStars,
    getAllUserJobStars,
    incrementCommandUsage,
    getFavoriteCommand,
    addItem,
    removeItem,
    getInventory,
    getItemCount,
    calculateNetWorth,
    getAchievements,
    setAchievement,
    getTitles,
    addTitle,
    setTitle
};
