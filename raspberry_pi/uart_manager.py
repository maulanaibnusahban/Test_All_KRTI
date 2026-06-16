import serial
import time
import threading

class UartManager:
    def __init__(self, port="/dev/ttyAMA0", baudrate=115200):
        self.port = port
        self.baudrate = baudrate
        self.serial = None
        self.lock = threading.Lock()
        self.running = False

    def connect(self):
        try:
            self.serial = serial.Serial(self.port, self.baudrate, timeout=1)
            self.running = True
            print(f"Connected to {self.port} at {self.baudrate}")
            return True
        except serial.SerialException as e:
            print(f"Error connecting to UART: {e}")
            return False

    def disconnect(self):
        self.running = False
        if self.serial and self.serial.is_open:
            self.serial.close()

    def send_line(self, data: str):
        if not self.serial or not self.serial.is_open:
            return False
        with self.lock:
            try:
                # Ensure data ends with \n
                if not data.endswith('\n'):
                    data += '\n'
                self.serial.write(data.encode('utf-8'))
                return True
            except Exception as e:
                print(f"Error sending data: {e}")
                return False

    def read_line(self) -> str:
        if not self.serial or not self.serial.is_open:
            return ""
        try:
            if self.serial.in_waiting > 0:
                line = self.serial.readline()
                return line.decode('utf-8', errors='ignore').strip()
        except Exception as e:
            print(f"Error reading data: {e}")
        return ""
