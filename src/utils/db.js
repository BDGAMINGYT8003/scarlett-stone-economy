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
        monthly_last_claimed INTEGER DEFAULT 0
    )
`).run();

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
    addItem,
    removeItem,
    getInventory,
    getItemCount,
    calculateNetWorth
};
