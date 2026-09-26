// Postgres pool + schema. With DATABASE_URL (Render) it uses real Postgres;
// without it (local dev / tests) it falls back to an in-memory Postgres (pg-mem).
const pg = require('pg');

let pool;
const DATABASE_URL = process.env.DATABASE_URL;
if (DATABASE_URL) {
  pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: /render\.com|neon\.tech/.test(DATABASE_URL) ? { rejectUnauthorized: false } : undefined
  });
} else {
  const { newDb } = require('pg-mem');
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  pool = new Pool();
  // pg-mem persists for the process lifetime only.
  if (!process.env.SILENT_MEM) console.log('No DATABASE_URL — using in-memory Postgres (pg-mem). Data resets on restart.');
}

const q = async (sql, params) => pool.query(sql, params);

async function migrate() {
  await q(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at BIGINT DEFAULT 0
  )`);
  await q(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    occasion TEXT DEFAULT '',
    style TEXT DEFAULT '',
    budget TEXT DEFAULT '',
    img TEXT DEFAULT '',
    images JSONB DEFAULT '[]'::jsonb,
    price INT DEFAULT 0,
    stock INT DEFAULT 1,
    active BOOLEAN DEFAULT TRUE
  )`);
  await q(`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT DEFAULT 0,
    user_email TEXT DEFAULT '',
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    addr TEXT DEFAULT '',
    city TEXT DEFAULT '',
    zip TEXT DEFAULT '',
    item TEXT DEFAULT '',
    img TEXT DEFAULT '',
    product_id INT DEFAULT 0,
    start_date TEXT DEFAULT '',
    end_date TEXT DEFAULT '',
    qty INT DEFAULT 1,
    size TEXT DEFAULT '',
    occasion TEXT DEFAULT '',
    dates TEXT DEFAULT '',
    total INT DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    refund INT DEFAULT 0,
    created_at BIGINT DEFAULT 0
  )`);
  await q(`CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    user_id INT DEFAULT 0,
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    type TEXT DEFAULT 'site',
    item_id INT DEFAULT 0,
    rating INT DEFAULT 5,
    text TEXT DEFAULT '',
    created_at BIGINT DEFAULT 0
  )`);
  await q(`CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    body TEXT DEFAULT '',
    time BIGINT DEFAULT 0,
    read_by JSONB DEFAULT '[]'::jsonb
  )`);
  await q(`CREATE TABLE IF NOT EXISTS boards (key TEXT PRIMARY KEY, value JSONB)`);
}

module.exports = { q, migrate };