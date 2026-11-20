require("dotenv").config();

async function configurarWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token || "") || !/^[A-Za-z0-9_-]{32,256}$/.test(secreto || "")) {
    throw new Error("Faltan TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET válidos.");
  }

  let sitio;
  try {
    sitio = new URL(process.argv[2]);
  } catch {
    throw new Error("Indicá la URL pública en HTTPS del sitio.");
  }
  if (sitio.protocol !== "https:" || sitio.username || sitio.password) {
    throw new Error("Indicá la URL pública en HTTPS del sitio.");
  }
  const url = new URL("/api/telegram/webhook", sitio).href;
  const prueba = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": secreto,
    },
    body: "{}",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  }).catch(() => { throw new Error("No se pudo verificar la ruta del webhook en Vercel."); });
  if (prueba.status !== 204) {
    throw new Error(`La ruta del webhook no está lista (HTTP ${prueba.status}). Revisá el deploy y TELEGRAM_WEBHOOK_SECRET.`);
  }

  async function telegram(metodo, datos) {
    const respuesta = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
      signal: AbortSignal.timeout(10000),
    }).catch(() => { throw new Error(`No se pudo contactar a Telegram para ${metodo}.`); });
    const resultado = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !resultado.ok) {
      throw new Error(`Telegram rechazó ${metodo} (HTTP ${respuesta.status}).`);
    }
    return resultado.result;
  }

  const bot = await telegram("getMe", {});
  await telegram("setWebhook", { url, secret_token: secreto, allowed_updates: ["message"] });
  const webhook = await telegram("getWebhookInfo", {});
  if (webhook.url !== url) throw new Error("Telegram devolvió otra URL de webhook.");
  console.log(`Webhook configurado para @${bot.username} en ${url}`);
}

configurarWebhook().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
