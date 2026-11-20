const { timingSafeEqual } = require("node:crypto");
const { preguntasChat, responderChat } = require("../public/chat-respuestas");
const db = require("./db");

async function webhookTelegram(req, res) {
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secreto) return res.sendStatus(503);

  const recibido = Buffer.from(req.get("X-Telegram-Bot-Api-Secret-Token") || "");
  const esperado = Buffer.from(secreto);
  if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    return res.sendStatus(403);
  }

  const mensaje = req.body?.message;
  if (mensaje?.chat?.type !== "private" || !Number.isSafeInteger(mensaje.chat.id)) {
    return res.sendStatus(204);
  }

  let texto = typeof mensaje.text === "string"
    ? responderChat(mensaje.text)
    : "Mandame una pregunta por escrito sobre turnos, reparaciones o contacto.";

  // El mismo número de orden y teléfono que usa el formulario público permiten
  // consultar el estado desde Telegram sin exponer datos de otros clientes.
  const consulta = typeof mensaje.text === "string"
    ? mensaje.text.match(/^\s*(?:estado|seguimiento)\s+#?(\d+)\s+([\d+() .-]{6,30})\s*$/i)
    : null;
  if (consulta) {
    const telefono = consulta[2].replace(/\D/g, "");
    const resultado = await db.query(
      `SELECT r.id, r.device, r.model, r.status, r.estimated_delivery_date AS delivery_date
       FROM repairs r JOIN clients c ON c.id = r.client_id
       WHERE r.id = $1 AND REGEXP_REPLACE(c.phone, '\\D', '', 'g') = $2`,
      [consulta[1], telefono]
    );
    const reparacion = resultado.rows[0];
    texto = reparacion
      ? `Orden #${reparacion.id}: ${reparacion.device} ${reparacion.model}. Estado: ${reparacion.status.replaceAll("_", " ").toLowerCase()}.${reparacion.delivery_date ? ` Entrega estimada: ${new Date(`${reparacion.delivery_date}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC" })}.` : ""}`
      : "No encontramos una reparación con esos datos. Revisá el número de orden y el teléfono registrado en el taller.";
  }

  if (/^\/(?:start|help)(?:@\w+)?(?:\s|$)/i.test(mensaje.text || "")) {
    texto += " Para consultar el estado, escribí: estado NÚMERO_DE_ORDEN TELÉFONO.";
  }

  return res.json({
    method: "sendMessage",
    chat_id: mensaje.chat.id,
    text: texto,
    reply_markup: {
      keyboard: preguntasChat.map(pregunta => [{ text: pregunta }]),
      resize_keyboard: true,
      is_persistent: false,
    },
  });
}

module.exports = { webhookTelegram };
