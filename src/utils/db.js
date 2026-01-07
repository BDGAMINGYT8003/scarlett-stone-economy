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
        god_mode_expires_at INTEGER DEFAULT 0,
        prestige INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        xp INTEGER DEFAULT 0
    )
`).run();

// Migrations
const columns = [
    'daily_streak', 'job_id', 'shifts_completed_today', 'total_shifts_completed',
    'last_shift_timestamp', 'promotions', 'is_premium', 'beg_count', 'search_count',
    'crime_count', 'postmemes_count', 'work_earnings', 'slots_wins', 'highlow_wins',
    'snakeeyes_wins', 'rob_coins', 'patreon_months', 'used_2025_last_day',
    'premium_expires_at', 'selected_title', 'commands_ran', 'items_used', 'shared_coins',
    'plants_harvested', 'slots_won_amount', 'slots_lost_amount', 'slots_played',
    'snakeeyes_won_amount', 'snakeeyes_lost_amount', 'snakeeyes_played',
    'god_mode_expires_at', 'prestige', 'level', 'xp'
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

db.prepare(`
    CREATE TABLE IF NOT EXISTS currency_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        type TEXT,
        amount INTEGER,
        balance_after INTEGER,
        timestamp INTEGER,
        items TEXT DEFAULT '[]'
    )
`).run();

// Migration for items column
try { db.prepare(`ALTER TABLE currency_logs ADD COLUMN items TEXT DEFAULT '[]'`).run(); } catch (e) {}

db.prepare(`
    CREATE TABLE IF NOT EXISTS friends (
        user1 TEXT,
        user2 TEXT,
        since INTEGER,
        PRIMARY KEY (user1, user2)
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

const addXp = (userId, amount) => {
    const user = getUser(userId);
    let newXp = (user.xp || 0) + amount;
    let currentLevel = user.level || 0;

    let required = Math.ceil(80 + (currentLevel * 0.05));

    while (newXp >= required) {
        newXp -= required;
        currentLevel++;
        required = Math.ceil(80 + (currentLevel * 0.05));
    }

    db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXp, currentLevel, userId);
};

const addPrestige = (userId) => {
    getUser(userId);
    db.prepare('UPDATE users SET prestige = prestige + 1 WHERE id = ?').run(userId);
};

const resetProfileForPrestige = (userId) => {
    // Reset specific columns for prestige
    // Keep: prestige (incremented), stats, inventory, friends, bank_capacity (notes/permanent)
    // Lose: balance, bank, level, xp, job_id, promotions, daily_streak?, god_mode?, premium?
    // Prompt: "What you LOSE: All coins... All unlocked levels... Your current job... Any bank space from leveling... Active items"
    // Prompt: "What you KEEP: Inventory, Friends, Work history, Daily streak, Max bank storage from Notes, Command history, Badges"

    // We treat 'bank_capacity' column as the 'from Notes' capacity because `deposit` uses `getEffectiveBankCapacity` now.
    // So we DON'T reset `bank_capacity`.

    // Reset Level/XP/Money
    // Reset Job
    // Reset active items (not explicitly stored in `users` except maybe premium? Prompt says "Any active items", "What you KEEP: ... Badges").
    // Premium is distinct from "active items" usually (it's a status). "Premium status" is usually kept?
    // Prompt lists "Active items" under LOSE.
    // Prompt doesn't list Premium under KEEP or LOSE explicitly, but typically Premium is a paid status/subscription.
    // "What you LOSE: ... Any active items on your account."
    // I will assume this means consumable buffs like alcohol, horseshoe, etc. which we currently don't track in `users` table except via... wait, we DON'T track them yet in `users` table. `use.js` handles them via... memory? No, that would be bad.
    // I haven't seen `alcohol_expires` column.
    // I will skip "active items" reset if columns don't exist, assuming they aren't implemented persistantly yet or handled elsewhere.

    db.prepare(`
        UPDATE users SET
            balance = 0,
            bank = 0,
            level = 0,
            xp = 0,
            job_id = NULL,
            promotions = 0
        WHERE id = ?
    `).run(userId);

    // Note: 'daily_streak' is KEPT per prompt.
    // 'bank_capacity' is KEPT per prompt strategy.
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

const getEffectiveBankCapacity = (userId) => {
    const user = getUser(userId);
    const baseCapacity = user.bank_capacity || 0; // Permanent capacity (Notes + Initial 5000)
    const level = user.level || 0;
    const prestige = user.prestige || 0;

    // Formula derived: LevelBonus = 900 + (Level * (100 + (Prestige * 10)))
    // This satisfies "Level 1 = 1000" (if base 0) but we have baseCapacity.
    // Prompt says "Implement a new system where leveling up grants total bank storage... Level 1 = 1000...".
    // This implies the level contribution *itself* is that amount.
    // Or does it mean *Total* is that?
    // "At Level 1, you gain 1,000 max bank storage".
    // This phrasing usually means "Add 1000 to total".
    // "Level 2, you gain 1,100".
    // If it means cumulative addition: L1=+1000, L2=+1100. Total added = 2100.
    // If it means "Total from levels is 1100 at Level 2", then the formula is simpler.
    // Given "gain bank space slightly faster", cumulative makes sense for "faster".
    // Let's go with Cumulative Sum.
    // Sum of arithmetic progression?
    // Per Level Gain = 1000 + (Level-1)*100?
    // L1 gain 1000. L2 gain 1100. L3 gain 1200.
    // Total Level Capacity = Sum(1000 + (i-1)*100) for i=1 to Level.
    // This is `Level * 1000 + 100 * (Level * (Level - 1)) / 2`.
    // With Prestige: "gain bank space slightly faster".
    // Maybe base gain increases? `1000 + (Prestige * 50)`?
    // Let's use: Gain at Level L = `(1000 + (Prestige * 10)) + ((L-1) * 100)`.
    // Total = Sum.
    // To implement `getEffectiveBankCapacity` efficiently without looping:
    // Arithmetic Series Sum: n/2 * (2a + (n-1)d)
    // n = Level. a = (1000 + Prestige*10). d = 100.

    if (level === 0) return baseCapacity;

    const a = 1000 + (prestige * 10);
    const d = 100;
    const n = level;

    const levelCapacity = (n / 2) * (2 * a + (n - 1) * d);

    return baseCapacity + Math.floor(levelCapacity);
};

// Stat Increment Methods
const incrementStat = (userId, stat, amount = 1) => {
    getUser(userId);
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

// Currency Log Methods
const logTransaction = (userId, type, details) => {
    let amount = 0;
    let items = [];

    if (typeof details === 'number') {
        amount = details;
    } else if (typeof details === 'object' && details !== null) {
        amount = details.amount || 0;
        if (Array.isArray(details.items)) {
            items = details.items;
        }
    }

    const user = getUser(userId);
    const balanceAfter = user.balance ?? 0;
    const itemsJson = JSON.stringify(items);

    try {
        db.prepare('INSERT INTO currency_logs (user_id, type, amount, balance_after, timestamp, items) VALUES (?, ?, ?, ?, ?, ?)').run(userId, type, amount, balanceAfter, Date.now(), itemsJson);
    } catch (e) {
        console.error('Failed to log transaction:', e);
    }

    db.prepare(`
        DELETE FROM currency_logs
        WHERE user_id = ?
        AND id NOT IN (
            SELECT id FROM currency_logs
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 500
        )
    `).run(userId, userId);
};

const getCurrencyLogs = (userId) => {
    return db.prepare('SELECT * FROM currency_logs WHERE user_id = ? ORDER BY timestamp DESC').all(userId);
};

// Friends Methods
const addFriend = (u1, u2) => {
    const [user1, user2] = [u1, u2].sort();
    db.prepare('INSERT OR IGNORE INTO friends (user1, user2, since) VALUES (?, ?, ?)').run(user1, user2, Date.now());
};

const removeFriend = (u1, u2) => {
    const [user1, user2] = [u1, u2].sort();
    db.prepare('DELETE FROM friends WHERE user1 = ? AND user2 = ?').run(user1, user2);
};

const getFriends = (userId) => {
    return db.prepare('SELECT * FROM friends WHERE user1 = ? OR user2 = ?').all(userId, userId);
};

const isFriend = (u1, u2) => {
    const [user1, user2] = [u1, u2].sort();
    const res = db.prepare('SELECT 1 FROM friends WHERE user1 = ? AND user2 = ?').get(user1, user2);
    return !!res;
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
    getEffectiveBankCapacity,
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
    logTransaction,
    getCurrencyLogs,
    addFriend,
    removeFriend,
    getFriends,
    isFriend,
    addItem,
    removeItem,
    getInventory,
    getItemCount,
    calculateNetWorth,
    getAchievements,
    setAchievement,
    getTitles,
    addTitle,
    setTitle,
    addXp,
    addPrestige,
    resetProfileForPrestige,
    setLevel: (userId, level) => {
        getUser(userId);
        db.prepare('UPDATE users SET level = ?, xp = 0 WHERE id = ?').run(level, userId);
    }
};
