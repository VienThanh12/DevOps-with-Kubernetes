const { connect, StringCodec } = require("nats");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const NATS_URL = mustEnv("NATS_URL");
const NATS_SUBJECT = process.env.NATS_SUBJECT || "todos.events";
const QUEUE_GROUP = process.env.NATS_QUEUE || "broadcaster";
const EXTERNAL_TYPE = (process.env.EXTERNAL_TYPE || "generic").toLowerCase();
let WEBHOOK_URL = process.env.WEBHOOK_URL || null; // required for generic/discord
const WEBHOOK_USER = process.env.WEBHOOK_USER || "bot";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || null; // required for telegram
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || null; // required for telegram
const WEBHOOK_TIMEOUT_MS = parseInt(
  process.env.WEBHOOK_TIMEOUT_MS || "5000",
  10
);

const sc = StringCodec();

function log(type, payload = {}) {
  const entry = { ts: new Date().toISOString(), type, ...payload };
  try {
    console.log(JSON.stringify(entry));
  } catch {
    console.log(String(type));
  }
}

function toMessageText(evt) {
  const { type, payload } = evt || {};
  if (type === "todo_created") {
    const id = payload && payload.id;
    return `A todo was created${id ? ` (id ${id})` : ""}`;
  }
  if (type === "todo_updated") {
    const id = payload && payload.id;
    const done = payload && payload.done;
    return `Todo updated${id ? ` (id ${id})` : ""}: done ${done}`;
  }
  return `Todo event: ${type || "unknown"}`;
}

async function sendToExternal(evt) {
  if (EXTERNAL_TYPE === "none") {
    // logging-only mode for staging; skip external forwarding
    return;
  }
  const messageText = toMessageText(evt);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  let res;
  if (EXTERNAL_TYPE === "generic") {
    if (!WEBHOOK_URL)
      throw new Error("Missing WEBHOOK_URL for generic provider");
    const payload = { user: WEBHOOK_USER, message: messageText };
    res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(t));
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Webhook error: ${res.status} ${res.statusText} ${body}`);
    }
    return;
  }
  if (EXTERNAL_TYPE === "discord") {
    if (!WEBHOOK_URL)
      throw new Error("Missing WEBHOOK_URL for discord provider");
    const payload = { content: messageText, username: WEBHOOK_USER };
    res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(t));
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Discord webhook error: ${res.status} ${res.statusText} ${body}`
      );
    }
    return;
  }
  if (EXTERNAL_TYPE === "telegram") {
    if (!TELEGRAM_TOKEN)
      throw new Error("Missing TELEGRAM_TOKEN for telegram provider");
    if (!TELEGRAM_CHAT_ID)
      throw new Error("Missing TELEGRAM_CHAT_ID for telegram provider");
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const payload = { chat_id: TELEGRAM_CHAT_ID, text: messageText };
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(t));
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Telegram API error: ${res.status} ${res.statusText} ${body}`
      );
    }
    const json = await res.json().catch(() => ({}));
    if (!json.ok) throw new Error("Telegram API returned not ok");
    return;
  }
  clearTimeout(t);
  throw new Error(`Unsupported EXTERNAL_TYPE: ${EXTERNAL_TYPE}`);
}

async function start() {
  // summarize provider config without secrets
  log("broadcaster_start", {
    NATS_URL,
    NATS_SUBJECT,
    QUEUE_GROUP,
    EXTERNAL_TYPE,
    hasWebhookUrl: !!WEBHOOK_URL,
    hasTelegramToken: !!TELEGRAM_TOKEN,
    hasTelegramChatId: !!TELEGRAM_CHAT_ID,
  });
  while (true) {
    try {
      const nc = await connect({ servers: NATS_URL });
      log("nats_connected", { server: NATS_URL });
      nc.closed()
        .then((err) => {
          if (err)
            log("nats_closed_error", { message: err.message || String(err) });
          else log("nats_closed");
        })
        .catch(() => {});

      const sub = nc.subscribe(NATS_SUBJECT, { queue: QUEUE_GROUP });
      log("nats_subscribed", { subject: NATS_SUBJECT, queue: QUEUE_GROUP });

      for await (const m of sub) {
        try {
          const data = sc.decode(m.data);
          const evt = JSON.parse(data);
          log("event_received", { type: evt.type });
          await sendToExternal(evt);
          log("webhook_sent", { type: evt.type });
        } catch (e) {
          log("event_error", { message: e && e.message });
          // drop on error to avoid duplicates; at-most-once semantics
        }
      }

      const err = await nc.closed();
      log("nats_connection_ended", { message: err && err.message });
    } catch (e) {
      log("nats_connect_error", { message: e && e.message });
    }

    // backoff before retrying connection
    await new Promise((r) => setTimeout(r, 5000));
  }
}

start().catch((e) => {
  log("fatal_start_error", { message: e && e.message });
});
