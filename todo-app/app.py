import os
import json
import time
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 9000))
DATA_DIR = os.environ.get("DATA_DIR", "./data")
IMAGE_URL = os.environ.get("IMAGE_URL", "https://picsum.photos/1200")
IMAGE_FILE = os.path.join(DATA_DIR, "todo-image.jpg")
META_FILE = os.path.join(DATA_DIR, "todo-image-meta.json")
IMAGE_TTL_MIN = int(os.environ.get("IMAGE_TTL_MIN", "10"))
IMAGE_TTL_MS = IMAGE_TTL_MIN * 60 * 1000
IMAGE_FETCH_DISABLED = os.environ.get("IMAGE_FETCH_DISABLED", "true").lower() == "true"
TODO_BACKEND_URL = os.environ.get("TODO_BACKEND_URL", "http://todo-backend-svc:2345")

os.makedirs(DATA_DIR, exist_ok=True)

# Todos are managed by the external todo-backend service

HTML_TEMPLATE = """<!doctype html>
<html>
<head>
    <meta charset="utf-8">
        <title>The Project App v2</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: system-ui, Arial, sans-serif; margin: 2rem; }
        .container { max-width: 640px; margin: auto; }
                header { margin-bottom: 1rem; }
                input { padding: .5rem; width: 70%; }
        button { padding: .5rem 1rem; }
        ul { margin-top: 1rem; }
                img { max-width: 100%; display: block; margin-top: 1rem; }
                .error { color: #b00020; }
                .section { margin-top: 1.5rem; }
                .footer { margin-top: 2rem; font-size: .9rem; color: #555; }
    </style>
</head>
<body>
    <div class="container">
                <header>
                    <h1>The Project App</h1>
                    <img id="bannerImg" src="/image" alt="Banner image" />
                </header>

                <div class="section">
                    <input id="todoInput" type="text" placeholder="Enter a new todo (max 140 chars)" maxlength="140" />
                    <button id="sendBtn" onclick="addTodo()" disabled>Create todo</button>
                    <p id="counter">0 / 140</p>
                    <p id="err" class="error" style="display:none;">Todo must be 140 characters or less.</p>
                </div>

                <div class="section">
                    <h2>Todo</h2>
                    <ul id="todoList"></ul>
                </div>

                <div class="section">
                    <h2>Done</h2>
                    <ul id="doneList"></ul>
                </div>
                <div class="section">
                    <p id="todosStatus" style="color:#555"></p>
                </div>

                <div class="section">
                    <h2>Image</h2>
                    <p>Random image (cached for %%TTL%% minutes):</p>
                    <img id="todoImg" src="/image" alt="Random image" />
                    <div>
                        <input type="file" id="fileInput" accept="image/*" />
                        <button id="uploadBtn">Upload</button>
                    </div>
                </div>

                <div class="footer">
                    <a href="https://devopswithkubernetes.com" target="_blank" rel="noopener noreferrer">DevOps with Kubernetes 2025</a> — University of Helsinki
                </div>
    </div>

<script>
const input = document.getElementById("todoInput");
const counter = document.getElementById("counter");
const err = document.getElementById("err");
const sendBtn = document.getElementById("sendBtn");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const img = document.getElementById("todoImg");
                const statusEl = document.getElementById("todosStatus");
                todoList.innerHTML = pending.length
                    ? pending.map(t => (`<li>${escapeHtml(t.text)} <button onclick="markDone(${t.id})">Mark as done</button></li>`)).join("")
                    : `<li>(No pending todos)</li>`;
                doneList.innerHTML = done.length
                    ? done.map(t => (`<li>${escapeHtml(t.text)}</li>`)).join("")
                    : `<li>(No completed todos)</li>`;
                statusEl.textContent = `Loaded ${todos.length} todos`;
});

function addTodo() {
    if (!input.value) return;
    const text = input.value;
    fetch("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    }).then(res => {
        if (!res.ok) throw new Error("Failed to add");
        input.value = "";
        counter.textContent = "0 / 140";
        sendBtn.disabled = true;
        loadTodos();
    }).catch(() => alert("Failed to add todo"));
}

uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) { alert("Choose an image first"); return; }
    const buf = await file.arrayBuffer();
    const res = await fetch("/image", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: buf,
    });
    if (res.ok) {
        alert("Image uploaded");
        img.src = "/image?ts=" + Date.now();
    } else {
        alert("Upload failed");
    }
});

async function loadTodos() {
    try {
        const res = await fetch("/todos");
                const data = await res.json();
                const todos = Array.isArray(data.todos) ? data.todos : [];
                const todoList = document.getElementById("todoList");
                const doneList = document.getElementById("doneList");
                const pending = todos.filter(t => !t.done);
                const done = todos.filter(t => !!t.done);
                todoList.innerHTML = pending.map(t => (
                    `<li>${escapeHtml(t.text)} <button onclick="markDone(${t.id})">Mark as done</button></li>`
                )).join("");
                doneList.innerHTML = done.map(t => (
                    `<li>${escapeHtml(t.text)}</li>`
                )).join("");
    } catch (e) {
        // ignore
    }
}

function markDone(id) {
    fetch(`/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true })
    }).then(res => {
        if (!res.ok) throw new Error("Failed to update");
        loadTodos();
    }).catch(() => alert("Failed to mark as done"));
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/\'/g, '&#39;');
}
loadTodos();
</script>
</body>
</html>
"""

INDEX_HTML = HTML_TEMPLATE.replace("%%TTL%%", str(IMAGE_TTL_MIN))


class TodoHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/":
            body = INDEX_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/todos":
            self.proxy_todos_get()
        elif self.path.startswith("/image"):
            self.handle_image_get()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/image":
            self.handle_image_post()
        elif self.path == "/todos":
            self.proxy_todos_post()
        else:
            self.send_response(404)
            self.end_headers()

    def do_PUT(self):
        # Proxy PUT /todos/<id> to backend
        if self.path.startswith("/todos/"):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length) if length > 0 else b""
                ct = self.headers.get("Content-Type", "application/json")
                url = f"{TODO_BACKEND_URL}{self.path}"
                req = urllib.request.Request(url, data=body, method="PUT")
                req.add_header("Content-Type", ct)
                with urllib.request.urlopen(req, timeout=3) as resp:
                    data = resp.read()
                    code = resp.getcode() or 200
                    ct2 = resp.headers.get("Content-Type", "application/json")
                    self.send_response(code)
                    self.send_header("Content-Type", ct2)
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
            except Exception:
                self.send_response(502)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    # Image handlers
    def handle_image_get(self):
        meta = load_meta()
        has_image = os.path.exists(IMAGE_FILE)
        now = int(time.time() * 1000)
        expired = (now - meta.get("lastFetch", 0)) >= IMAGE_TTL_MS
        if not has_image:
            try:
                if not IMAGE_FETCH_DISABLED:
                    fetch_image()
            except Exception:
                pass
            return serve_image(self)
        if not expired:
            return serve_image(self)
        if not meta.get("servedAfterExpiry", False):
            meta["servedAfterExpiry"] = True
            save_meta(meta)
            return serve_image(self)
        try:
            if not IMAGE_FETCH_DISABLED:
                fetch_image()
        except Exception:
            pass
        return serve_image(self)

    def handle_image_post(self):
        content_type = self.headers.get("Content-Type", "image/jpeg")
        length = int(self.headers.get("Content-Length", "0"))
        max_bytes = int(os.environ.get("IMAGE_UPLOAD_MAX_BYTES", "10485760"))
        if length <= 0 or length > max_bytes:
            self.send_response(413)
            self.end_headers()
            return
        tmp = IMAGE_FILE + ".upload"
        try:
            body = self.rfile.read(length)
            with open(tmp, "wb") as f:
                f.write(body)
            os.replace(tmp, IMAGE_FILE)
            save_meta({
                "lastFetch": int(time.time() * 1000),
                "servedAfterExpiry": False,
                "contentType": content_type,
            })
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Image uploaded\n")
        except Exception:
            try:
                os.remove(tmp)
            except Exception:
                pass
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"Failed to save image\n")

    # Proxy /todos to backend
    def proxy_todos_get(self):
        try:
            req = urllib.request.Request(f"{TODO_BACKEND_URL}/todos", method="GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = resp.read()
                ct = resp.headers.get("Content-Type", "application/json")
                self.send_response(200)
                self.send_header("Content-Type", ct)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except Exception:
            self.send_response(502)
            self.end_headers()

    def proxy_todos_post(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length > 0 else b""
            ct = self.headers.get("Content-Type", "application/json")
            req = urllib.request.Request(f"{TODO_BACKEND_URL}/todos", data=body, method="POST")
            req.add_header("Content-Type", ct)
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = resp.read()
                code = resp.getcode() or 200
                ct2 = resp.headers.get("Content-Type", "application/json")
                self.send_response(code)
                self.send_header("Content-Type", ct2)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except Exception:
            self.send_response(502)
            self.end_headers()


# Helpers for image caching
def load_meta():
    try:
        with open(META_FILE, "r") as f:
            meta = json.load(f)
        return {
            "lastFetch": int(meta.get("lastFetch", 0)),
            "servedAfterExpiry": bool(meta.get("servedAfterExpiry", False)),
            "contentType": meta.get("contentType", "image/jpeg"),
        }
    except Exception:
        return {"lastFetch": 0, "servedAfterExpiry": False, "contentType": "image/jpeg"}

def save_meta(meta):
    try:
        with open(META_FILE, "w") as f:
            json.dump(meta, f)
    except Exception:
        pass

def fetch_image():
    # Simple urllib-based fetch; respects system proxy settings
    req = urllib.request.Request(IMAGE_URL, method="GET")
    with urllib.request.urlopen(req, timeout=5) as resp:
        content = resp.read()
        with open(IMAGE_FILE, "wb") as f:
            f.write(content)
        save_meta({
            "lastFetch": int(time.time() * 1000),
            "servedAfterExpiry": False,
            "contentType": resp.headers.get("Content-Type", "image/jpeg"),
        })

def serve_image(handler: BaseHTTPRequestHandler):
    try:
        with open(IMAGE_FILE, "rb") as f:
            body = f.read()
        meta = load_meta()
        handler.send_response(200)
        handler.send_header("Content-Type", meta.get("contentType", "image/jpeg"))
        handler.send_header("Content-Length", str(len(body)))
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
        handler.wfile.write(body)
    except Exception:
        svg = (
            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"400\">"
            "<rect width=\"100%\" height=\"100%\" fill=\"#eee\"/>"
            "<text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"24\" fill=\"#666\">No image cached</text></svg>"
        ).encode("utf-8")
        handler.send_response(200)
        handler.send_header("Content-Type", "image/svg+xml")
        handler.send_header("Content-Length", str(len(svg)))
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
        handler.wfile.write(svg)


if __name__ == "__main__":
    print(f"Todo app server started on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), TodoHandler).serve_forever()
