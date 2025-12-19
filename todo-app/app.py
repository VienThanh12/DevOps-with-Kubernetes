# app.py
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

# Read the port from the environment variable, default to 8080
PORT = int(os.environ.get("PORT", 9000))

class TodoHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Todo app is running")

print(f"Server started in port {PORT}", flush=True)

# Start the server
server = HTTPServer(('', PORT), TodoHandler)
server.serve_forever()
