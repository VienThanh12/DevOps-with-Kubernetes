const { randomUUID } = require("crypto");

// 1. Generate random string ONCE at startup
const randomString = randomUUID();

console.log(`Application started. Random string: ${randomString}`);

// 2. Print every 5 seconds with timestamp
setInterval(() => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp}: ${randomString}`);
}, 5000);
