/**
 * DATABASE LAYER
 * ----------------------------------------------------------------
 * A small file-backed JSON store that behaves like a set of database
 * tables (users, products, cart_items, wishlist_items, addresses,
 * orders). Each collection is a JSON file under /db/data.
 *
 * Every record has an `id` (uuid) and foreign keys are plain id
 * fields (e.g. cart_items.userId -> users.id), mirroring how the
 * same schema would look in a real SQL database. This file is the
 * ONLY place that touches disk - swapping this for Postgres/MySQL/
 * SQLite later only means rewriting this module; every route file
 * keeps working unchanged because they only call these functions.
 * ----------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TABLES = ['users', 'products', 'cart_items', 'wishlist_items', 'addresses', 'orders'];

function filePath(table) {
  return path.join(DATA_DIR, `${table}.json`);
}

function readTable(table) {
  const fp = filePath(table);
  if (!fs.existsSync(fp)) return [];
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`[db] failed to read ${table}, resetting to empty`, e);
    return [];
  }
}

function writeTable(table, rows) {
  fs.writeFileSync(filePath(table), JSON.stringify(rows, null, 2));
}

function uuid() {
  return crypto.randomUUID();
}

const db = {
  uuid,

  all(table) {
    return readTable(table);
  },

  find(table, predicate) {
    return readTable(table).find(predicate) || null;
  },

  filter(table, predicate) {
    return readTable(table).filter(predicate);
  },

  getById(table, id) {
    return readTable(table).find((r) => r.id === id) || null;
  },

  insert(table, record) {
    const rows = readTable(table);
    const row = { id: uuid(), createdAt: new Date().toISOString(), ...record };
    rows.push(row);
    writeTable(table, rows);
    return row;
  },

  update(table, id, patch) {
    const rows = readTable(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...patch, updatedAt: new Date().toISOString() };
    writeTable(table, rows);
    return rows[idx];
  },

  remove(table, id) {
    const rows = readTable(table);
    const next = rows.filter((r) => r.id !== id);
    writeTable(table, next);
    return next.length !== rows.length;
  },

  removeWhere(table, predicate) {
    const rows = readTable(table);
    const next = rows.filter((r) => !predicate(r));
    writeTable(table, next);
    return rows.length - next.length;
  }
};

// ensure every table file exists on first boot
TABLES.forEach((t) => {
  if (!fs.existsSync(filePath(t))) writeTable(t, []);
});

module.exports = db;
