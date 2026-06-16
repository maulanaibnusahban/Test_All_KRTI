import serial
import threading
import time
from queue import Queue

class SerialManager:
    def __init__(self):
        self.serial = None
        self.running = False
        self.rx_queue = Queue()
        self.tx_queue = Queue()
        self.port = ""
        self.baudrate = 115200

    def connect(self, port, baudrate):
        self.port = port
        self.baudrate = baudrate
        try:
            self.serial = serial.Serial(self.port, self.baudrate, timeout=1)
            self.running = True
            
            self.rx_thread = threading.Thread(target=self._read_loop, daemon=True)
            self.tx_thread = threading.Thread(target=self._write_loop, daemon=True)
            
            self.rx_thread.start()
            self.tx_thread.start()
            return True, "Connected"
        except Exception as e:
            return False, str(e)

    def disconnect(self):
        self.running = False
        if self.serial and self.serial.is_open:
            self.serial.close()

    def is_connected(self):
        return self.running and self.serial and self.serial.is_open

    def send(self, data: str):
        if self.is_connected():
            if not data.endswith('\n'):
                data += '\n'
            self.tx_queue.put(data)

    def _read_loop(self):
        while self.running and self.serial and self.serial.is_open:
            try:
                if self.serial.in_waiting > 0:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        self.rx_queue.put(line)
            except Exception as e:
                print(f"Serial read error: {e}")
                self.running = False
            time.sleep(0.01)

    def _write_loop(self):
        while self.running and self.serial and self.serial.is_open:
            try:
                if not self.tx_queue.empty():
                    data = self.tx_queue.get()
                    self.serial.write(data.encode('utf-8'))
            except Exception as e:
                print(f"Serial write error: {e}")
                self.running = False
            time.sleep(0.01)
