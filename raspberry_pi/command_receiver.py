import json
import threading
import time

class CommandReceiver:
    def __init__(self, uart_manager):
        self.uart_manager = uart_manager
        self.running = False

    def start(self):
        self.running = True
        while self.running:
            line = self.uart_manager.read_line()
            if line:
                try:
                    data = json.loads(line)
                    if data.get("type") == "command":
                        cmd = data.get("command", "UNKNOWN")
                        print(f"\n>> Received Command: {cmd}\n")
                except json.JSONDecodeError:
                    # Ignore malformed or non-JSON data from the UART
                    pass
            time.sleep(0.01)

    def stop(self):
        self.running = False
