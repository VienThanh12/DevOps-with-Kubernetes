const http = require("http");
const { randomUUID } = require("crypto");

const randomString = randomUUID();
console.log(`Application started. Random string: ${randomString}`);

setInterval(() => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp}: ${randomString}`);
}, 5000);

const PORT = parseInt(process.env.PORT || "3000", 10);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/status") {
    const payload = {
      timestamp: new Date().toISOString(),
      randomString,
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
