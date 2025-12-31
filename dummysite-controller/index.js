// Minimal in-cluster controller for DummySite CRD
// Watches DummySite resources and creates ConfigMap + Deployment + Service

const fs = require("fs");
const https = require("https");

const K8S_HOST =
  process.env.KUBERNETES_SERVICE_HOST || "kubernetes.default.svc";
const K8S_PORT = process.env.KUBERNETES_SERVICE_PORT || "443";
const BASE_URL = `https://${K8S_HOST}:${K8S_PORT}`;
const SA_PATH = "/var/run/secrets/kubernetes.io/serviceaccount";
const TOKEN = fs.readFileSync(`${SA_PATH}/token`, "utf8");
const CA = fs.readFileSync(`${SA_PATH}/ca.crt`);

function k8sRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      method: String(method || "GET").toUpperCase(),
      hostname: K8S_HOST,
      port: K8S_PORT,
      path,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      ca: CA,
      rejectUnauthorized: true,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const status = res.statusCode || 0;
        if (status >= 200 && status < 300) {
          try {
            resolve(JSON.parse(data || "{}"));
          } catch {
            resolve({});
          }
        } else {
          reject(new Error(`K8s ${method} ${path} failed: ${status} ${data}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function streamWatch(path, onEvent, onError) {
  const options = {
    method: "GET",
    hostname: K8S_HOST,
    port: K8S_PORT,
    path,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
    },
    ca: CA,
    rejectUnauthorized: true,
  };
  const req = https.request(options, (res) => {
    const status = res.statusCode || 0;
    let buf = "";
    res.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          onEvent(evt);
        } catch (e) {
          // ignore parse errors on partial lines
        }
      }
    });
    res.on("end", () => {
      const msg =
        status >= 200 && status < 300
          ? "watch stream ended"
          : `watch stream ended with status ${status}`;
      onError && onError(new Error(msg));
    });
  });
  req.on("error", (err) => onError && onError(err));
  req.end();
}

// We avoid fetching content in the controller; instead, an initContainer
// fetches the HTML inside the Deployment using curl with proxy envs.

function cmName(name) {
  return `dummysite-${name}`;
}
function appLabel(name) {
  return `dummysite-${name}`;
}

// No ConfigMap needed with initContainer + emptyDir approach

function proxyEnv() {
  const env = [];
  if (process.env.HTTP_PROXY)
    env.push({ name: "HTTP_PROXY", value: process.env.HTTP_PROXY });
  if (process.env.HTTPS_PROXY)
    env.push({ name: "HTTPS_PROXY", value: process.env.HTTPS_PROXY });
  if (process.env.NO_PROXY)
    env.push({ name: "NO_PROXY", value: process.env.NO_PROXY });
  return env;
}

async function ensureDeployment(ns, name, url) {
  const depName = appLabel(name);
  const payload = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: depName },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: depName } },
      template: {
        metadata: { labels: { app: depName } },
        spec: {
          initContainers: [
            {
              name: "fetch-html",
              image: "curlimages/curl:8.8.0",
              env: [{ name: "URL", value: url }, ...proxyEnv()],
              command: ["sh", "-c"],
              args: [
                'set -e; echo "Fetching $URL"; curl -fsSL "$URL" -o /workdir/index.html',
              ],
              volumeMounts: [{ name: "site", mountPath: "/workdir" }],
            },
          ],
          containers: [
            {
              name: "nginx",
              image: "nginx:1.25-alpine",
              ports: [{ containerPort: 80 }],
              volumeMounts: [
                { name: "site", mountPath: "/usr/share/nginx/html" },
              ],
            },
          ],
          volumes: [
            {
              name: "site",
              emptyDir: {},
            },
          ],
        },
      },
    },
  };
  try {
    const existing = await k8sRequest(
      "get",
      `/apis/apps/v1/namespaces/${ns}/deployments/${depName}`
    );
    payload.metadata.resourceVersion =
      existing.metadata && existing.metadata.resourceVersion;
    await k8sRequest(
      "put",
      `/apis/apps/v1/namespaces/${ns}/deployments/${depName}`,
      payload
    );
  } catch (e) {
    if (String(e.message).includes("404")) {
      await k8sRequest(
        "post",
        `/apis/apps/v1/namespaces/${ns}/deployments`,
        payload
      );
    } else {
      throw e;
    }
  }
}

async function ensureService(ns, name) {
  const svcName = appLabel(name);
  const payload = {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name: svcName },
    spec: {
      type: "ClusterIP",
      selector: { app: svcName },
      ports: [{ port: 80, targetPort: 80 }],
    },
  };
  try {
    await k8sRequest("get", `/api/v1/namespaces/${ns}/services/${svcName}`);
    // Service exists; leave as-is to avoid immutable field conflicts
  } catch (e) {
    if (String(e.message).includes("404")) {
      await k8sRequest("post", `/api/v1/namespaces/${ns}/services`, payload);
    } else {
      throw e;
    }
  }
}

async function deleteResources(ns, name) {
  const depName = appLabel(name);
  const cm = cmName(name);
  const del = async (path) => {
    try {
      await k8sRequest("delete", path);
    } catch (e) {
      /* ignore */
    }
  };
  await del(`/apis/apps/v1/namespaces/${ns}/deployments/${depName}`);
  await del(`/api/v1/namespaces/${ns}/services/${depName}`);
  await del(`/api/v1/namespaces/${ns}/configmaps/${cm}`);
}

async function reconcileAdded(obj) {
  const ns = obj.metadata.namespace || "default";
  const name = obj.metadata.name;
  const url = obj.spec && obj.spec.website_url;
  if (!url) return;
  console.log(`DummySite added: ${ns}/${name} -> ${url}`);
  try {
    await ensureDeployment(ns, name, url);
    await ensureService(ns, name);
    console.log(`Provisioned dummysite ${ns}/${name}`);
  } catch (e) {
    console.error(`Failed to provision ${ns}/${name}:`, e.message);
  }
}

async function reconcileModified(obj) {
  // Treat as re-sync: update ConfigMap with new content if URL changed
  await reconcileAdded(obj);
}

async function reconcileDeleted(obj) {
  const ns = obj.metadata.namespace || "default";
  const name = obj.metadata.name;
  console.log(`DummySite deleted: ${ns}/${name}`);
  await deleteResources(ns, name);
}

let lastRV = "0";
let backoffMs = 1000;

async function listExisting() {
  try {
    const list = await k8sRequest("get", "/apis/stable.dwk/v1/dummysites");
    const items = list.items || [];
    console.log(`Found ${items.length} existing DummySite(s), reconciling...`);
    for (const obj of items) await reconcileAdded(obj);
    if (list.metadata && list.metadata.resourceVersion) {
      lastRV = String(list.metadata.resourceVersion);
    }
  } catch (e) {
    console.error("List error:", e.message);
  }
}

function startWatch() {
  const qs = `watch=true&timeoutSeconds=300&allowWatchBookmarks=true${
    lastRV ? `&resourceVersion=${encodeURIComponent(lastRV)}` : ""
  }`;
  const path = `/apis/stable.dwk/v1/dummysites?${qs}`;
  streamWatch(
    path,
    (evt) => {
      const type = evt.type;
      const obj = evt.object || {};
      if (obj && obj.metadata && obj.metadata.resourceVersion) {
        lastRV = String(obj.metadata.resourceVersion);
      }
      if (type === "BOOKMARK") return; // rv advance only
      if (type === "ADDED") reconcileAdded(obj);
      else if (type === "MODIFIED") reconcileModified(obj);
      else if (type === "DELETED") reconcileDeleted(obj);
    },
    (err) => {
      console.error("Watch error:", err.message);
      backoffMs = Math.min(backoffMs * 2, 30000);
      setTimeout(() => startWatch(), backoffMs);
    }
  );
}

async function main() {
  console.log("Starting DummySite controller...");
  await listExisting();
  startWatch();
}

main();
