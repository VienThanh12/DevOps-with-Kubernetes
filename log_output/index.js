const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const randomString = randomUUID();
const logDir = process.env.LOG_DIR || "/var/log/app";
const logFile = process.env.LOG_FILE || path.join(logDir, "log.txt");

fs.mkdirSync(logDir, { recursive: true });
console.log(`Writer started. Random string: ${randomString}`);
console.log(`Writing to: ${logFile}`);

setInterval(() => {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${randomString}\n`;
  fs.appendFile(logFile, line, (err) => {
    if (err) {
      console.error("Failed to append log:", err);
    }
  });
}, 5000);

// Keep process alive
setInterval(() => {}, 1 << 30);
