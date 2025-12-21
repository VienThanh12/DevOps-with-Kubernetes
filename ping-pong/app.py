import os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8081))

COUNT = 0

class PingPongHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        global COUNT
        if self.path == "/pingpong":
            COUNT += 1
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"pong {COUNT}".encode("utf-8"))
        elif self.path == "/count":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f"{{\"count\": {COUNT}}}".encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

print(f"Ping-pong server started on port {PORT}", flush=True)

HTTPServer(("", PORT), PingPongHandler).serve_forever()
