const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const randomString = randomUUID();
const PORT = parseInt(process.env.PORT || "3000", 10);
const DATA_DIR = process.env.DATA_DIR || "/data";
const COUNT_FILE =
  process.env.COUNT_FILE || path.join(DATA_DIR, "pingpong-count.txt");

console.log(`Log output started. Random string: ${randomString}`);
console.log(`Reading count from: ${COUNT_FILE}`);

function readCount() {
  try {
    const raw = fs.readFileSync(COUNT_FILE, "utf8").trim();
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
  } catch (e) {
    return 0;
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/status") {
    const payload = {
      timestamp: new Date().toISOString(),
      randomString,
      pingPongCount: readCount(),
    };
    const body = JSON.stringify(payload);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});
