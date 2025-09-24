const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');

function readDb() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = {
  get: (key) => {
    const db = readDb();
    return db[key];
  },
  set: (key, value) => {
    const db = readDb();
    db[key] = value;
    writeDb(db);
  },
  add: (key, value) => {
    const db = readDb();
    if (!db[key]) {
      db[key] = 0;
    }
    db[key] += value;
    writeDb(db);
  },
  subtract: (key, value) => {
    const db = readDb();
    if (!db[key]) {
      db[key] = 0;
    }
    db[key] -= value;
    writeDb(db);
  },
};
