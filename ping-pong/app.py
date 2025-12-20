# app.py
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8081))

counter = 0

class PingPongHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global counter
        if self.path == "/pingpong":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"pong {counter}".encode("utf-8"))
            counter += 1
        else:
            self.send_response(404)
            self.end_headers()

print(f"Ping-pong server started on port {PORT}", flush=True)

server = HTTPServer(("", PORT), PingPongHandler)
server.serve_forever()
