import time
import json
import threading
from queue import Queue

from serial_manager import SerialManager
from telemetry_parser import TelemetryParser
from photo_receiver import PhotoReceiver
from command_sender import CommandSender
from dashboard_server import DashboardServer

class GroundStation:
    def __init__(self):
        self.serial_manager = SerialManager()
        self.telemetry_parser = TelemetryParser()
        self.photo_receiver = PhotoReceiver()
        self.command_sender = CommandSender(self.serial_manager)
        self.dashboard_server = DashboardServer(self)
        
        self.log_queue = Queue()
        self.running = False

    def connect_serial(self, port, baudrate):
        return self.serial_manager.connect(port, baudrate)

    def disconnect_serial(self):
        self.serial_manager.disconnect()

    def start(self):
        self.running = True
        self.dashboard_server.start()
        
        print("Ground Station started. Waiting for connections...")
        
        try:
            while self.running:
                if self.serial_manager.is_connected() and not self.serial_manager.rx_queue.empty():
                    line = self.serial_manager.rx_queue.get()
                    self.log_queue.put(f"[RX] {line}")
                    
                    try:
                        data = json.loads(line)
                        msg_type = data.get("type")
                        
                        if msg_type == "telemetry":
                            self.telemetry_parser.parse(data)
                        elif msg_type in ["photo_start", "photo_chunk", "photo_end"]:
                            self.photo_receiver.parse(data)
                    except json.JSONDecodeError:
                        pass # Ignore malformed json
                        
                time.sleep(0.01)
        except KeyboardInterrupt:
            print("\nShutting down Ground Station...")
        finally:
            self.stop()

    def stop(self):
        self.running = False
        self.serial_manager.disconnect()
        self.dashboard_server.stop()

if __name__ == "__main__":
    gs = GroundStation()
    gs.start()
