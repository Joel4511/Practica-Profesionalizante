require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const db = require("./db");
const { setSessionCookie, clearSessionCookie, requireAuth, requireRole } = require("./auth");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
}

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "..", "public");
const slots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];
const repairStatuses = new Set(["RECIBIDO", "EN_DIAGNOSTICO", "EN_REPARACION", "ESPERANDO_REPUESTO", "LISTO_PARA_RETIRAR", "FINALIZADO"]);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use(express.static(publicDir));

const clean = value => String(value || "").trim();
const emailValue = value => clean(value).toLowerCase();
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(clean(value));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function clientForUser(userId) {
  const result = await db.query("SELECT * FROM clients WHERE user_id = $1", [userId]);
  return result.rows[0];
}

app.get("/api/health", asyncRoute(async (_req, res) => {
  await db.query("SELECT 1");
  res.json({ status: "ok", service: "TGT" });
}));

app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const name = clean(req.body.name);
  const email = emailValue(req.body.email);
  const phone = clean(req.body.phone);
  const address = clean(req.body.address);
  const password = String(req.body.password || "");
  if (!name || !email || !phone || !address || password.length < 8) {
    return res.status(400).json({ error: "Completá todos los datos. La contraseña debe tener al menos 8 caracteres." });
  }

  const existing = await db.query(
    `SELECT email FROM users WHERE email = $1
     UNION
     SELECT email FROM clients WHERE email = $1
     LIMIT 1`,
    [email]
  );
  if (existing.rowCount) {
    return res.status(409).json({ error: "Ya tenés una cuenta creada con ese Gmail. Iniciá sesión para continuar." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await db.pool.connect();
  try {
    await connection.query("BEGIN");
    const userResult = await connection.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'CLIENT') RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );
    const user = userResult.rows[0];
    const clientResult = await connection.query(
      `INSERT INTO clients (user_id, name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [user.id, name, email, phone, address]
    );
    await connection.query("COMMIT");
    setSessionCookie(res, user);
    res.status(201).json({ user: { ...user, clientId: clientResult.rows[0].id } });
  } catch (error) {
    await connection.query("ROLLBACK");
    if (error.code === "23505") return res.status(409).json({ error: "Ya tenés una cuenta creada con ese Gmail. Iniciá sesión para continuar." });
    throw error;
  } finally {
    connection.release();
  }
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const email = emailValue(req.body.email);
  const password = String(req.body.password || "");
  const result = await db.query("SELECT id, name, email, role, password_hash FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Email o contraseña incorrectos." });
  }
  setSessionCookie(res, user);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

app.post("/api/tracking", asyncRoute(async (req, res) => {
  const orderId = Number(req.body.order);
  const phone = clean(req.body.phone).replace(/\D/g, "");
  if (!orderId || !phone) return res.status(400).json({ error: "Ingresá la orden y el teléfono." });
  const result = await db.query(
    `SELECT r.id, r.device, r.model, r.issue, r.status, r.received_date AS date,
            r.estimated_delivery_date AS delivery_date
     FROM repairs r JOIN clients c ON c.id = r.client_id
     WHERE r.id = $1 AND REGEXP_REPLACE(c.phone, '\\D', '', 'g') = $2`,
    [orderId, phone]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "No encontramos una reparación con esos datos." });
  res.json({ repair: result.rows[0] });
}));

app.get("/api/auth/me", requireAuth, asyncRoute(async (req, res) => {
  const result = await db.query("SELECT id, name, email, role FROM users WHERE id = $1", [req.user.sub]);
  if (!result.rows[0]) return res.status(401).json({ error: "Sesión inválida" });
  const user = result.rows[0];
  if (user.role === "CLIENT") {
    const client = await clientForUser(user.id);
    return res.json({ user, client });
  }
  res.json({ user });
}));

app.get("/api/availability", requireAuth, asyncRoute(async (req, res) => {
  const date = clean(req.query.date);
  const excludeId = Number(req.query.excludeId) || 0;
  if (!validDate(date)) return res.status(400).json({ error: "Fecha inválida" });
  const result = await db.query(
    `SELECT TO_CHAR(appointment_time, 'HH24:MI') AS time
     FROM appointments
     WHERE appointment_date = $1 AND status <> 'CANCELADO' AND id <> $2`,
    [date, excludeId]
  );
  const busy = new Set(result.rows.map(row => row.time));
  res.json({ slots: slots.map(time => ({ time, available: !busy.has(time) })) });
}));

app.get("/api/client/dashboard", requireAuth, requireRole("CLIENT"), asyncRoute(async (req, res) => {
  const client = await clientForUser(req.user.sub);
  if (!client) return res.status(404).json({ error: "Perfil de cliente no encontrado" });
  const [appointments, repairs] = await Promise.all([
    db.query(
      `SELECT id, appointment_date AS date, TO_CHAR(appointment_time, 'HH24:MI') AS time,
              device, model, serial_number AS serial, problem, status
       FROM appointments WHERE client_id = $1 ORDER BY appointment_date DESC, appointment_time DESC`,
      [client.id]
    ),
    db.query(
      `SELECT id, device, model, serial_number AS serial, issue, technical_work AS work,
              price, status, received_date AS date, estimated_delivery_date AS delivery_date,
              completed_date
       FROM repairs WHERE client_id = $1 ORDER BY id DESC`,
      [client.id]
    )
  ]);
  res.json({ client, appointments: appointments.rows, repairs: repairs.rows });
}));

app.put("/api/client/profile", requireAuth, requireRole("CLIENT"), asyncRoute(async (req, res) => {
  const name = clean(req.body.name);
  const phone = clean(req.body.phone);
  const address = clean(req.body.address);
  if (!name || !phone || !address) return res.status(400).json({ error: "Completá todos los datos." });
  const connection = await db.pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2", [name, req.user.sub]);
    const result = await connection.query(
      `UPDATE clients SET name = $1, phone = $2, address = $3, updated_at = NOW()
       WHERE user_id = $4 RETURNING *`,
      [name, phone, address, req.user.sub]
    );
    await connection.query("COMMIT");
    res.json({ client: result.rows[0] });
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}));

app.post("/api/client/appointments", requireAuth, requireRole("CLIENT"), asyncRoute(async (req, res) => {
  const client = await clientForUser(req.user.sub);
  const date = clean(req.body.date);
  const time = clean(req.body.time);
  const device = clean(req.body.device);
  const model = clean(req.body.model);
  const serial = clean(req.body.serial);
  const problem = clean(req.body.problem);
  if (!client || !validDate(date) || !slots.includes(time) || !device || !model || !problem) {
    return res.status(400).json({ error: "Revisá los datos del turno." });
  }
  try {
    const result = await db.query(
      `INSERT INTO appointments
       (client_id, appointment_date, appointment_time, device, model, serial_number, problem, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'SOLICITADO')
       RETURNING id`,
      [client.id, date, time, device, model, serial || null, problem]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ese horario ya fue reservado." });
    throw error;
  }
}));

app.delete("/api/client/appointments/:id", requireAuth, requireRole("CLIENT"), asyncRoute(async (req, res) => {
  const client = await clientForUser(req.user.sub);
  const result = await db.query(
    `UPDATE appointments SET status = 'CANCELADO', updated_at = NOW()
     WHERE id = $1 AND client_id = $2 AND appointment_date >= CURRENT_DATE
     RETURNING id`,
    [req.params.id, client.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Turno no encontrado o no cancelable." });
  res.status(204).end();
}));

app.get("/api/admin/dashboard", requireAuth, requireRole("ADMIN"), asyncRoute(async (_req, res) => {
  const [clients, appointments, repairs] = await Promise.all([
    db.query("SELECT id, name, email, phone, address FROM clients ORDER BY name"),
    db.query(
      `SELECT a.id, a.client_id, c.name AS client_name, c.phone, a.appointment_date AS date,
              TO_CHAR(a.appointment_time, 'HH24:MI') AS time, a.device, a.model,
              a.serial_number AS serial, a.problem, a.status
       FROM appointments a JOIN clients c ON c.id = a.client_id
       ORDER BY a.appointment_date, a.appointment_time`
    ),
    db.query(
      `SELECT r.id, r.client_id, c.name AS client_name, r.device, r.model,
              r.serial_number AS serial, r.issue, r.technical_work AS work, r.price,
              r.status, r.received_date AS date, r.estimated_delivery_date AS delivery_date,
              r.completed_date
       FROM repairs r JOIN clients c ON c.id = r.client_id ORDER BY r.id DESC`
    )
  ]);
  res.json({ clients: clients.rows, appointments: appointments.rows, repairs: repairs.rows });
}));

app.post("/api/admin/clients", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const values = [clean(req.body.name), emailValue(req.body.email), clean(req.body.phone), clean(req.body.address)];
  if (values.some(value => !value)) return res.status(400).json({ error: "Completá todos los datos." });
  const result = await db.query(
    "INSERT INTO clients (name, email, phone, address) VALUES ($1, $2, $3, $4) RETURNING id",
    values
  );
  res.status(201).json({ id: result.rows[0].id });
}));

app.put("/api/admin/clients/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const values = [clean(req.body.name), emailValue(req.body.email), clean(req.body.phone), clean(req.body.address), req.params.id];
  const result = await db.query(
    `UPDATE clients SET name = $1, email = $2, phone = $3, address = $4, updated_at = NOW()
     WHERE id = $5 RETURNING id`,
    values
  );
  if (!result.rowCount) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json({ id: result.rows[0].id });
}));

app.delete("/api/admin/clients/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const connection = await db.pool.connect();
  try {
    await connection.query("BEGIN");
    const client = await connection.query("SELECT id, user_id FROM clients WHERE id = $1", [req.params.id]);
    if (!client.rowCount) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ error: "Cliente no encontrado." });
    }
    const userId = client.rows[0].user_id;
    await connection.query("DELETE FROM appointments WHERE client_id = $1", [req.params.id]);
    await connection.query("DELETE FROM repairs WHERE client_id = $1", [req.params.id]);
    await connection.query("DELETE FROM clients WHERE id = $1", [req.params.id]);
    if (userId) await connection.query("DELETE FROM users WHERE id = $1 AND role = 'CLIENT'", [userId]);
    await connection.query("COMMIT");
    res.status(204).end();
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}));

app.put("/api/admin/appointments/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const date = clean(req.body.date);
  const time = clean(req.body.time);
  const status = clean(req.body.status || "CONFIRMADO");
  if (!validDate(date) || !slots.includes(time) || !["SOLICITADO", "CONFIRMADO", "CANCELADO"].includes(status)) {
    return res.status(400).json({ error: "Datos de turno inválidos." });
  }
  try {
    const result = await db.query(
      `UPDATE appointments SET appointment_date = $1, appointment_time = $2, problem = $3,
       status = $4, updated_at = NOW() WHERE id = $5 RETURNING id`,
      [date, time, clean(req.body.problem), status, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Turno no encontrado" });
    res.json({ id: result.rows[0].id });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ese horario ya fue reservado." });
    throw error;
  }
}));

app.post("/api/admin/appointments", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const clientId = Number(req.body.clientId);
  const date = clean(req.body.date);
  const time = clean(req.body.time);
  const problem = clean(req.body.problem);
  if (!clientId || !validDate(date) || !slots.includes(time) || !problem) {
    return res.status(400).json({ error: "Datos de turno inválidos." });
  }
  try {
    const result = await db.query(
      `INSERT INTO appointments (client_id, appointment_date, appointment_time, problem, status)
       VALUES ($1, $2, $3, $4, 'CONFIRMADO') RETURNING id`,
      [clientId, date, time, problem]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ese horario ya fue reservado." });
    throw error;
  }
}));

app.post("/api/admin/repairs", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const clientId = Number(req.body.clientId);
  const device = clean(req.body.device);
  const model = clean(req.body.model);
  const issue = clean(req.body.issue);
  if (!clientId || !device || !model || !issue) return res.status(400).json({ error: "Completá los datos obligatorios." });
  const result = await db.query(
    `INSERT INTO repairs
     (client_id, device, model, serial_number, issue, price, status, estimated_delivery_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [clientId, device, model, clean(req.body.serial) || null, issue, Number(req.body.price) || 0,
      repairStatuses.has(req.body.status) ? req.body.status : "RECIBIDO", req.body.deliveryDate || null]
  );
  res.status(201).json({ id: result.rows[0].id });
}));

app.patch("/api/admin/repairs/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const status = clean(req.body.status);
  if (status && !repairStatuses.has(status)) return res.status(400).json({ error: "Estado inválido." });
  const connection = await db.pool.connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query(
      `UPDATE repairs SET
         status = COALESCE($1, status),
         estimated_delivery_date = COALESCE($2, estimated_delivery_date),
         technical_work = COALESCE($3, technical_work),
         completed_date = CASE WHEN $1 = 'FINALIZADO' THEN COALESCE(completed_date, CURRENT_DATE) ELSE completed_date END,
         updated_at = NOW()
       WHERE id = $4 RETURNING id, client_id`,
      [status || null, req.body.deliveryDate || null, clean(req.body.work) || null, req.params.id]
    );
    if (!result.rowCount) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ error: "Reparación no encontrada" });
    }
    if (status === "FINALIZADO") {
      await connection.query(
        `UPDATE appointments SET status = 'CANCELADO', updated_at = NOW()
         WHERE client_id = $1 AND appointment_date >= CURRENT_DATE AND status <> 'CANCELADO'`,
        [result.rows[0].client_id]
      );
    }
    await connection.query("COMMIT");
    res.json({ id: result.rows[0].id });
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}));

app.use("/api", (_req, res) => res.status(404).json({ error: "Ruta no encontrada" }));
app.get("*path", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Ocurrió un error interno." });
});

if (require.main === module) {
  app.listen(port, () => console.log(`TGT disponible en http://localhost:${port}`));
}

module.exports = app;
