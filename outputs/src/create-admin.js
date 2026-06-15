require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool } = require("./db");

async function createAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Completá ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD en .env");
  }
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, LOWER($2), $3, 'ADMIN')
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'ADMIN', updated_at = NOW()`,
    [ADMIN_NAME.trim(), ADMIN_EMAIL.trim(), passwordHash]
  );
  console.log(`Administrador TGT creado: ${ADMIN_EMAIL}`);
  await pool.end();
}

createAdmin().catch(error => {
  console.error("Error al crear administrador:", error.message);
  process.exit(1);
});
