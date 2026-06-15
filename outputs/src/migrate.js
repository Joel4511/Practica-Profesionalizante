require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "database", "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Base de datos TGT actualizada correctamente.");
  await pool.end();
}

migrate().catch(error => {
  console.error("Error al migrar:", error.message);
  process.exit(1);
});
