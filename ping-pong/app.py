# app.py
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8081))
DATA_DIR = os.environ.get("DATA_DIR", "/data")
COUNT_FILE = os.environ.get("COUNT_FILE", os.path.join(DATA_DIR, "pingpong-count.txt"))

os.makedirs(DATA_DIR, exist_ok=True)

def read_count():
    try:
        with open(COUNT_FILE, "r") as f:
            return int(f.read().strip() or 0)
    except (FileNotFoundError, ValueError):
        return 0

def write_count(value: int):
    with open(COUNT_FILE, "w") as f:
        f.write(str(value))

class PingPongHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/pingpong":
            cnt = read_count() + 1
            write_count(cnt)
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"pong {cnt}".encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

print(f"Ping-pong server started on port {PORT}", flush=True)

server = HTTPServer(("", PORT), PingPongHandler)
server.serve_forever()
