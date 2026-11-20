const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_POSTGRES_URL;
if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL o DATABASE_POSTGRES_URL en el entorno.");
}

const poolConfig = {
  connectionString: databaseUrl,
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
