const http = require("http");
let natsConnect = null;
let natsStringCodec = null;

function mustEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

const PORT = parseInt(mustEnv("PORT"), 10);
const TODO_MAX_LEN = parseInt(process.env.TODO_MAX_LEN || "140", 10);

const NATS_URL = process.env.NATS_URL || null;
const NATS_SUBJECT = process.env.NATS_SUBJECT || "todos.events";
let nc = null;
let sc = null;

const todos = [];
let nextId = 1;

// No database; keep simple in-memory store.

async function setupNats() {
  if (!NATS_URL) {
    console.warn("NATS disabled: NATS_URL not set");
    return;
  }
  try {
    if (!natsConnect || !natsStringCodec) {
      try {
        const nats = require("nats");
        natsConnect = nats.connect;
        natsStringCodec = nats.StringCodec;
      } catch (e) {
        console.error(
          "nats module not available; skipping NATS setup:",
          e && e.message
        );
        return;
      }
    }
    nc = await natsConnect({ servers: NATS_URL });
    sc = natsStringCodec();
    console.log(`Connected to NATS at ${NATS_URL}`);
    (async () => {
      try {
        const err = await nc.closed();
        if (err) console.error("NATS connection closed:", err.message || err);
      } catch (e) {
        // ignore
      }
    })();
  } catch (e) {
    console.error("Failed to connect to NATS:", e && e.message);
  }
}

function publishEvent(type, payload = {}) {
  try {
    if (!nc || !sc) return;
    const msg = { type, payload, ts: new Date().toISOString() };
    nc.publish(NATS_SUBJECT, sc.encode(JSON.stringify(msg)));
  } catch (e) {
    console.error("NATS publish error:", e && e.message);
  }
}

function send(res, code, body, headers = {}) {
  const buf =
    typeof body === "string"
      ? Buffer.from(body, "utf8")
      : Buffer.from(JSON.stringify(body), "utf8");
  res.writeHead(code, {
    "Content-Type":
      typeof body === "string"
        ? "text/plain; charset=utf-8"
        : "application/json",
    "Content-Length": buf.length,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    ...headers,
  });
  res.end(buf);
}

function logEvent(type, payload = {}) {
  const entry = {
    ts: new Date().toISOString(),
    type,
    ...payload,
  };
  try {
    console.log(JSON.stringify(entry));
  } catch {
    console.log(String(type));
  }
}

function parseBody(req, cb) {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    if (ct.includes("application/json")) {
      try {
        const json = JSON.parse(data || "{}");
        cb(null, json);
      } catch (e) {
        cb(new Error("invalid json"));
      }
    } else {
      cb(null, data);
    }
  });
  req.on("error", (err) => cb(err));
}

const server = http.createServer((req, res) => {
  logEvent("request", { method: req.method, path: req.url });
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "300",
    });
    return res.end();
  }
  if (req.method === "GET" && req.url === "/todos") {
    logEvent("todos_list", { count: todos.length });
    return send(res, 200, { todos });
  }
  if (req.method === "PUT" && /^\/todos\/\d+$/.test(req.url)) {
    const m = req.url.match(/^\/todos\/(\d+)$/);
    const id = parseInt(m[1], 10);
    return parseBody(req, (err, body) => {
      if (err) return send(res, 400, "invalid body\n");
      const done = body && typeof body.done === "boolean" ? body.done : null;
      if (done === null) {
        logEvent("todo_update_reject", { id, reason: "missing_done" });
        return send(res, 400, {
          error: "Body must include boolean field 'done'",
        });
      }
      const idx = todos.findIndex((t) => t.id === id);
      if (idx === -1) {
        logEvent("todo_update_not_found", { id });
        return send(res, 404, { error: "todo not found" });
      }
      todos[idx].done = done;
      logEvent("todo_update", { id, done });
      publishEvent("todo_updated", todos[idx]);
      return send(res, 200, { todo: todos[idx] });
    });
  }
  if (req.method === "POST" && req.url === "/todos") {
    return parseBody(req, (err, body) => {
      if (err) return send(res, 400, "invalid body\n");
      let text;
      if (typeof body === "string") {
        text = body.trim();
      } else if (body && typeof body.text === "string") {
        text = body.text.trim();
      }
      const len = (text || "").length;
      if (!text || len === 0 || len > TODO_MAX_LEN) {
        logEvent("todo_reject", {
          reason: "length",
          length: len,
          limit: TODO_MAX_LEN,
        });
        return send(res, 400, {
          error: `Todo must be 1..${TODO_MAX_LEN} chars`,
        });
      }
      const created = { id: nextId++, text, done: false };
      todos.push(created);
      logEvent("todo_accept", { length: len });
      publishEvent("todo_created", created);
      return send(res, 201, {
        ok: true,
        count: todos.length,
      });
    });
  }
  if (req.method === "GET" && req.url === "/healthz") {
    logEvent("healthz");
    return send(res, 200, { ok: true });
  }
  if (req.method === "GET" && req.url === "/ready") {
    logEvent("ready_ok");
    return send(res, 200, { ready: true });
  }
  logEvent("not_found", { path: req.url });
  send(res, 404, "Not Found\n");
});

setupNats().finally(() => {
  server.listen(PORT, () => {
    console.log(`todo-backend listening on ${PORT}`);
  });
});
