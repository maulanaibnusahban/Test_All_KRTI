import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

class DashboardServer:
    def __init__(self, ground_station, host='0.0.0.0', port=8080):
        self.ground_station = ground_station
        self.host = host
        self.port = port
        self.server = None
        self.thread = None

    def start(self):
        # We need a reference to ground station in the handler
        gs = self.ground_station
        
        class APIHandler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=os.path.join(os.path.dirname(__file__), '..', 'web'), **kwargs)

            def do_GET(self):
                if self.path == '/api/telemetry':
                    self.send_json(gs.telemetry_parser.get_latest())
                elif self.path == '/api/photo':
                    self.send_json(gs.photo_receiver.get_latest_photo() or {})
                elif self.path == '/api/logs':
                    logs = []
                    while not gs.log_queue.empty():
                        logs.append(gs.log_queue.get())
                    self.send_json({"logs": logs})
                elif self.path.startswith('/photos/'):
                    # Serve received photos
                    photo_file = self.path.replace('/photos/', '')
                    photo_path = os.path.join(gs.photo_receiver.save_dir, photo_file)
                    if os.path.exists(photo_path):
                        self.send_response(200)
                        self.send_header('Content-type', 'image/jpeg')
                        self.end_headers()
                        with open(photo_path, 'rb') as f:
                            self.wfile.write(f.read())
                    else:
                        self.send_error(404, "Photo not found")
                else:
                    super().do_GET()

            def do_POST(self):
                if self.path == '/api/command':
                    content_length = int(self.headers['Content-Length'])
                    post_data = self.rfile.read(content_length)
                    try:
                        req = json.loads(post_data)
                        cmd = req.get("command")
                        if cmd:
                            success = gs.command_sender.send_command(cmd)
                            if success:
                                gs.log_queue.put(f"[TX] {json.dumps({'type':'command', 'command':cmd})}")
                                self.send_json({"status": "success"})
                            else:
                                self.send_error(400, "Invalid command")
                        else:
                            self.send_error(400, "Missing command")
                    except Exception as e:
                        self.send_error(400, "Invalid JSON")
                elif self.path == '/api/connect':
                    content_length = int(self.headers['Content-Length'])
                    post_data = self.rfile.read(content_length)
                    try:
                        req = json.loads(post_data)
                        port = req.get("port")
                        baudrate = req.get("baudrate", 115200)
                        success, msg = gs.connect_serial(port, baudrate)
                        self.send_json({"status": "success" if success else "error", "message": msg})
                    except Exception as e:
                        self.send_error(400, "Invalid JSON")
                elif self.path == '/api/disconnect':
                    gs.disconnect_serial()
                    self.send_json({"status": "success"})
                else:
                    self.send_error(404, "Not Found")

            def send_json(self, data):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())

        self.server = HTTPServer((self.host, self.port), APIHandler)
        print(f"Dashboard server running at http://{self.host}:{self.port}")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
