const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "3000", 10);
const LOG_DIR = process.env.LOG_DIR || "/var/log/app";
const LOG_FILE = process.env.LOG_FILE || path.join(LOG_DIR, "log.txt");

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/status") {
    fs.readFile(LOG_FILE, "utf8", (err, data) => {
      if (err) {
        if (err.code === "ENOENT") {
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("(no log yet)\n");
        } else {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Error reading log file\n");
        }
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`Reader HTTP server listening on port ${PORT}`);
  console.log(`Serving log file from: ${LOG_FILE}`);
});
