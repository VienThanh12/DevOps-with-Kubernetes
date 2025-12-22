const http = require("http");

const PORT = parseInt(process.env.PORT || "3000", 10);

/** In-memory store */
const todos = [];

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
    return send(res, 200, { todos });
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
      if (!text || text.length === 0 || text.length > 140) {
        return send(res, 400, { error: "Todo must be 1..140 chars" });
      }
      todos.push(text);
      return send(res, 201, { ok: true, count: todos.length });
    });
  }
  if (req.method === "GET" && req.url === "/healthz") {
    return send(res, 200, { ok: true });
  }
  send(res, 404, "Not Found\n");
});

server.listen(PORT, () => {
  console.log(`todo-backend listening on ${PORT}`);
});
