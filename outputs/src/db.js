const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en el archivo .env");
}

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
};

const globalForDb = global;
const pool = globalForDb.tgtPool || new Pool(poolConfig);
globalForDb.tgtPool = pool;

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
