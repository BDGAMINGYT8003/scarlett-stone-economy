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
        promotions INTEGER DEFAULT 0
    )
`).run();

// Migrations for existing DB
try { db.prepare('ALTER TABLE users ADD COLUMN daily_streak INTEGER DEFAULT 0').run(); } catch (e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN job_id TEXT DEFAULT NULL').run(); } catch (e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN shifts_completed_today INTEGER DEFAULT 0').run(); } catch (e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN total_shifts_completed INTEGER DEFAULT 0').run(); } catch (e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN last_shift_timestamp INTEGER DEFAULT 0').run(); } catch (e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN promotions INTEGER DEFAULT 0').run(); } catch (e) {}

db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (
        user_id TEXT,
        item_id TEXT,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, item_id)
    )
`).run();

const getUser = (userId) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT INTO users (id) VALUES (?)').run(userId);
        return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }
    return user;
};

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
    addBalance,
    removeBalance,
    addBank,
    removeBank,
    increaseBankCapacity,
    setLastClaimed,
    setStreak,
    setJob,
    removeJob,
    addShift,
    addPromotion,
    resetDailyShifts,
    getAllUsersWithJobs,
    addItem,
    removeItem,
    getInventory,
    getItemCount,
    calculateNetWorth
};
