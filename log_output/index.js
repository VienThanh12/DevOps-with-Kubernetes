const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");

const randomString = randomUUID();
const PORT = parseInt(process.env.PORT || "3000", 10);
const DATA_DIR = process.env.DATA_DIR || "/data";
const PING_PONG_URL =
  process.env.PING_PONG_URL || "http://ping-pong-svc:8081/pingpong";
const IMAGE_URL = "https://picsum.photos/1200";
const IMAGE_HOST = new URL(IMAGE_URL).hostname;
const IMAGE_FILE = process.env.IMAGE_FILE || path.join(DATA_DIR, "image.jpg");
const META_FILE =
  process.env.META_FILE || path.join(DATA_DIR, "image-meta.json");
const IMAGE_TTL_MIN = parseInt(process.env.IMAGE_TTL_MIN || "10", 10);
const IMAGE_TTL_MS = IMAGE_TTL_MIN * 60 * 1000;
const IMAGE_FETCH_DISABLED =
  (process.env.IMAGE_FETCH_DISABLED || "false").toLowerCase() === "true";
const IMAGE_FETCH_TIMEOUT_MS = parseInt(
  process.env.IMAGE_FETCH_TIMEOUT_MS || "5000",
  10
);
const IMAGE_RETRY_MS = parseInt(process.env.IMAGE_RETRY_MS || "30000", 10);
const IMAGE_USE_CURL = (process.env.IMAGE_USE_CURL || "auto").toLowerCase(); // auto|true|false
const CONFIG_DIR = process.env.CONFIG_DIR || "/config";
const MESSAGE = process.env.MESSAGE || "";
const INFO_FILE = path.join(CONFIG_DIR, "information.txt");
let infoFileContent = "";
try {
  infoFileContent = fs.readFileSync(INFO_FILE, "utf8");
} catch {}
function parseNoProxy() {
  const np = process.env.NO_PROXY || process.env.no_proxy || "";
  return np
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hostMatches(entry, host) {
  if (entry === "*") return true;
  if (entry === host) return true;
  // Match domain suffix: .example.com matches foo.example.com
  if (entry.startsWith(".")) {
    return host.endsWith(entry);
  }
  // Treat bare domain as suffix too
  return host === entry || host.endsWith(`.${entry}`);
}

function shouldBypassProxyForHost(host) {
  const entries = parseNoProxy();
  return entries.some((e) => hostMatches(e, host));
}

// Prefer IPv4 to reduce DNS/IPv6 issues in some clusters
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

console.log(`Log output started. Random string: ${randomString}`);
console.log(`Fetching ping-pong via: ${PING_PONG_URL}`);
console.log(`Image cache: ${IMAGE_FILE} (TTL ${IMAGE_TTL_MIN} min)`);
if (MESSAGE) {
  console.log(`env variable: MESSAGE=${MESSAGE}`);
}
if (infoFileContent) {
  console.log(`file content: ${infoFileContent.trim()}`);
} else {
  console.log("information.txt not found or empty");
}
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {}

function fetchPingPong(cb) {
  try {
    const url = new URL(PING_PONG_URL);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.get(PING_PONG_URL, (resp) => {
      let buf = "";
      resp.on("data", (d) => (buf += String(d)));
      resp.on("end", () => {
        const m = buf.match(/pong\s+(\d+)/i);
        const count = m ? parseInt(m[1], 10) || 0 : 0;
        cb(null, { text: buf, count });
      });
    });
    req.on("error", (err) => cb(err));
    req.setTimeout(3000, () => req.destroy(new Error("timeout")));
  } catch (e) {
    cb(e);
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/status") {
    fetchPingPong((err, data) => {
      const payload = {
        timestamp: new Date().toISOString(),
        randomString,
        pingPongCount: err ? 0 : data.count,
        message: MESSAGE,
        informationFile: infoFileContent,
      };
      const body = JSON.stringify(payload);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
    });
  } else if (req.method === "GET" && req.url === "/pingpong") {
    fetchPingPong((err, data) => {
      if (err) {
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Failed to reach ping-pong service\n");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(data.text);
    });
  } else if (req.method === "GET" && req.url === "/image") {
    serveCachedImageWithTTL(req, res);
  } else if (req.method === "POST" && req.url === "/image") {
    saveUploadedImage(req, res);
  } else if (req.method === "GET" && req.url === "/shutdown") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Shutting down\n");
    setTimeout(() => process.exit(0), 100);
  } else if (req.method === "GET" && req.url === "/") {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Log Output</title>
<style>body{font-family:sans-serif;margin:2rem}img{max-width:100%}</style></head>
<body>
  <h1>Log Output</h1>
  <p>Random string: ${randomString}</p>
  <p>MESSAGE: ${MESSAGE || "(none)"}</p>
  <pre>${(infoFileContent || "").trim()}</pre>
  <p><a href="/status">JSON status</a> | <a href="/pingpong">Ping-pong</a></p>

  <h1> <b> The project App </b></h1>
  <img src="/image" alt="Random image" />
  <p> DevOps with Kubernetes 2025 </p>
</body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server listening on 0.0.0.0:${PORT}`);
});

function loadMeta() {
  try {
    const raw = fs.readFileSync(META_FILE, "utf8");
    const meta = JSON.parse(raw);
    return {
      lastFetch: typeof meta.lastFetch === "number" ? meta.lastFetch : 0,
      servedAfterExpiry: !!meta.servedAfterExpiry,
    };
  } catch {
    return { lastFetch: 0, servedAfterExpiry: false };
  }
}

function saveMeta(meta) {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(meta), "utf8");
  } catch (e) {
    console.error("Failed to write meta:", e);
  }
}

let fetchInProgress = false;
function getWithRedirects(url, cb, redirects = 0) {
  const MAX_REDIRECTS = 5;
  const req = https.get(url, (resp) => {
    const code = resp.statusCode || 0;
    const loc = resp.headers.location;
    if (code >= 300 && code < 400 && loc) {
      // Follow redirects
      if (redirects >= MAX_REDIRECTS) {
        resp.resume();
        return cb(new Error("Too many redirects"));
      }
      resp.resume();
      const nextUrl = new URL(loc, url).toString();
      return getWithRedirects(nextUrl, cb, redirects + 1);
    }
    if (code >= 400) {
      resp.resume();
      return cb(new Error(`Image fetch failed: ${code}`));
    }
    cb(null, resp);
  });
  req.on("error", (err) => cb(err));
  req.setTimeout(IMAGE_FETCH_TIMEOUT_MS, () => {
    req.destroy(new Error("Image fetch timeout"));
  });
}

function fetchAndStoreImage(cb) {
  if (IMAGE_FETCH_DISABLED) {
    return cb(new Error("Image fetch disabled"));
  }
  if (fetchInProgress) return cb(null, false);
  fetchInProgress = true;
  const proxyEnvPresent = !!(
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.https_proxy
  );
  const bypass = shouldBypassProxyForHost(IMAGE_HOST);
  const useCurl =
    IMAGE_USE_CURL === "true" ||
    (IMAGE_USE_CURL === "auto" && proxyEnvPresent && !bypass);
  if (useCurl) {
    return fetchImageViaCurl(
      IMAGE_URL,
      IMAGE_FILE,
      bypass ? IMAGE_HOST : null,
      (err, contentType) => {
        fetchInProgress = false;
        if (err) {
          scheduleImageRetry();
          return cb(err);
        }
        const meta = {
          lastFetch: Date.now(),
          servedAfterExpiry: false,
          contentType: contentType || "image/jpeg",
        };
        saveMeta(meta);
        cb(null, true);
      }
    );
  }
  getWithRedirects(IMAGE_URL, (err, resp) => {
    if (err) {
      fetchInProgress = false;
      scheduleImageRetry();
      return cb(err);
    }
    const file = fs.createWriteStream(IMAGE_FILE);
    resp.pipe(file);
    file.on("finish", () => {
      file.close(() => {
        const meta = {
          lastFetch: Date.now(),
          servedAfterExpiry: false,
          contentType: resp.headers["content-type"] || "image/jpeg",
        };
        saveMeta(meta);
        fetchInProgress = false;
        cb(null, true);
      });
    });
    resp.on("error", (e) => {
      fetchInProgress = false;
      try {
        file.close();
      } catch {}
      fs.unlink(IMAGE_FILE, () => {});
      scheduleImageRetry();
      cb(e);
    });
  });
}

function fetchImageViaCurl(url, dest, noproxyHost, cb) {
  const timeoutSec = Math.ceil(IMAGE_FETCH_TIMEOUT_MS / 1000);
  const args = ["-L", "-sS", "--max-time", String(timeoutSec), "-o", dest];
  if (noproxyHost) {
    args.push("--noproxy", noproxyHost);
  }
  args.push(url);
  const child = spawn("curl", args, { env: process.env });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += String(d)));
  child.on("error", (err) => cb(err));
  child.on("close", (code) => {
    if (code !== 0) {
      return cb(new Error(stderr || `curl exited with code ${code}`));
    }
    // We don't have content-type; default to JPEG
    cb(null, "image/jpeg");
  });
}

function scheduleImageRetry() {
  if (IMAGE_FETCH_DISABLED) return;
  if (fetchInProgress) return;
  setTimeout(() => {
    if (!fs.existsSync(IMAGE_FILE)) {
      console.log("Retrying image fetch...");
      fetchAndStoreImage(() => {});
    }
  }, IMAGE_RETRY_MS);
}

function serveImage(res) {
  try {
    const stat = fs.statSync(IMAGE_FILE);
    const meta = loadMeta();
    res.writeHead(200, {
      "Content-Type": meta.contentType || "image/jpeg",
      "Content-Length": stat.size,
      "Cache-Control": "no-store",
    });
    fs.createReadStream(IMAGE_FILE).pipe(res);
  } catch (e) {
    // Serve a simple placeholder SVG if no cached image exists
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#666">No image cached</text></svg>`;
    const buf = Buffer.from(svg, "utf8");
    res.writeHead(200, {
      "Content-Type": "image/svg+xml",
      "Content-Length": buf.length,
      "Cache-Control": "no-store",
    });
    res.end(buf);
  }
}

function serveCachedImageWithTTL(req, res) {
  const now = Date.now();
  const meta = loadMeta();
  const hasImage = fs.existsSync(IMAGE_FILE);

  if (IMAGE_FETCH_DISABLED) {
    // Do not attempt network; serve cached or placeholder
    return serveImage(res);
  }

  const expired = now - meta.lastFetch >= IMAGE_TTL_MS;
  if (!hasImage) {
    return fetchAndStoreImage((err) => {
      if (err) {
        console.error(err);
        // Serve placeholder and retry in background
        return serveImage(res);
      }
      serveImage(res);
    });
  }

  if (!expired) {
    // Within TTL, serve cached
    return serveImage(res);
  }

  if (!meta.servedAfterExpiry) {
    // Serve old once after expiry, then mark flag
    meta.servedAfterExpiry = true;
    saveMeta(meta);
    return serveImage(res);
  }

  // Fetch a new image, reset flag
  fetchAndStoreImage((err) => {
    if (err) {
      console.error(err);
      // On failure, serve old image
      return serveImage(res);
    }
    serveImage(res);
  });
}

function saveUploadedImage(req, res) {
  const limit = parseInt(process.env.IMAGE_UPLOAD_MAX_BYTES || "10485760", 10); // 10MB default
  const tmpFile = IMAGE_FILE + ".upload";
  const ws = fs.createWriteStream(tmpFile);
  let bytes = 0;
  const contentType = req.headers["content-type"] || "image/jpeg";

  req.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > limit) {
      req.destroy(new Error("Upload too large"));
    }
  });
  req.pipe(ws);
  ws.on("finish", () => {
    try {
      fs.renameSync(tmpFile, IMAGE_FILE);
      const meta = {
        lastFetch: Date.now(),
        servedAfterExpiry: false,
        contentType,
      };
      saveMeta(meta);
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Image uploaded\n");
    } catch (e) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
      res.writeHead(500);
      res.end("Failed to save image\n");
    }
  });
  ws.on("error", (e) => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    res.writeHead(400);
    res.end("Upload failed\n");
  });
}
