const http = require("http");
const { Pool } = require("pg");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

const PORT = parseInt(mustEnv("PORT"), 10);
const TODO_MAX_LEN = parseInt(process.env.TODO_MAX_LEN || "140", 10);
const DB_HOST = mustEnv("DB_HOST");
const DB_PORT = parseInt(mustEnv("DB_PORT"), 10);
const DB_NAME = mustEnv("DB_NAME");
const DB_USER = mustEnv("DB_USER");
const DB_PASSWORD = mustEnv("DB_PASSWORD");

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 10000,
});

async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS todos (id SERIAL PRIMARY KEY, text VARCHAR(140) NOT NULL)"
    );
  } finally {
    client.release();
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
    (async () => {
      try {
        const { rows } = await pool.query(
          "SELECT id, text FROM todos ORDER BY id ASC"
        );
        logEvent("todos_list", { count: rows.length });
        return send(res, 200, { todos: rows });
      } catch (e) {
        logEvent("db_error", { op: "list", message: e && e.message });
        return send(res, 500, { error: "db error" });
      }
    })();
    return;
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
      (async () => {
        try {
          await pool.query("INSERT INTO todos (text) VALUES ($1)", [text]);
          const { rows } = await pool.query(
            "SELECT COUNT(*) AS count FROM todos"
          );
          logEvent("todo_accept", { length: len });
          return send(res, 201, {
            ok: true,
            count: parseInt(rows[0].count, 10),
          });
        } catch (e) {
          logEvent("db_error", { op: "insert", message: e && e.message });
          return send(res, 500, { error: "db error" });
        }
      })();
    });
  }
  if (req.method === "GET" && req.url === "/healthz") {
    logEvent("healthz");
    return send(res, 200, { ok: true });
  }
  if (req.method === "GET" && req.url === "/ready") {
    (async () => {
      try {
        await pool.query("SELECT 1");
        logEvent("ready_ok");
        return send(res, 200, { ready: true });
      } catch (e) {
        logEvent("ready_fail", { message: e && e.message });
        return send(res, 503, { ready: false });
      }
    })();
    return;
  }
  logEvent("not_found", { path: req.url });
  send(res, 404, "Not Found\n");
});

ensureSchema()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`todo-backend listening on ${PORT}`);
    });
  })
  .catch((e) => {
    console.error("Failed to init DB schema:", e);
    process.exit(1);
  });
