import os
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import psycopg2
from psycopg2 import sql

def must_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return val

PORT = int(must_env("PORT"))
DB_HOST = must_env("DB_HOST")
DB_PORT = int(must_env("DB_PORT"))
DB_NAME = must_env("DB_NAME")
DB_USER = must_env("DB_USER")
DB_PASSWORD = must_env("DB_PASSWORD")

conn = None

def connect_db():
    global conn
    while True:
        try:
            conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
            )
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS counter (
                        id INT PRIMARY KEY,
                        count INT NOT NULL
                    )
                    """
                )
                cur.execute("INSERT INTO counter (id, count) VALUES (1, 0) ON CONFLICT (id) DO NOTHING")
            print("Connected to Postgres and ensured schema.", flush=True)
            return
        except Exception as e:
            print(f"DB connect/init failed: {e}", flush=True)
            time.sleep(2)

def get_count() -> int:
    global conn
    for attempt in range(2):
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT count FROM counter WHERE id=1")
                row = cur.fetchone()
                return int(row[0]) if row else 0
        except Exception:
            connect_db()
    return 0

def inc_count() -> int:
    global conn
    for attempt in range(2):
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE counter SET count = count + 1 WHERE id=1 RETURNING count")
                row = cur.fetchone()
                return int(row[0]) if row else get_count()
        except Exception:
            connect_db()
    return get_count()

class PingPongHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        if self.path == "/pingpong":
            c = inc_count()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"pong {c}".encode("utf-8"))
        elif self.path == "/count":
            c = get_count()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f"{{\"count\": {c}}}".encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

connect_db()
print(f"Ping-pong server started on port {PORT}", flush=True)
HTTPServer(("", PORT), PingPongHandler).serve_forever()
