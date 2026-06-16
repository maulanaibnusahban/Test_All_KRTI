import json
import time
import random

class TelemetryGenerator:
    def __init__(self, uart_manager):
        self.uart_manager = uart_manager
        self.running = False
        
        # Initial dummy state
        self.roll = 10.0
        self.pitch = 0.0
        self.yaw = 180.0
        self.lat = -7.123456
        self.lon = 110.654321
        self.alt = 120.0
        self.rel_alt = 25.0
        self.vx = 1.0
        self.vy = 0.2
        self.vz = -0.1
        self.gps_fix = 3
        self.sat = 14
        self.battery = 16.8
        self.battery_pct = 100
        self.armed = True
        self.mode = "GUIDED"

    def start(self):
        self.running = True
        while self.running:
            self.update_state()
            self.send_telemetry()
            time.sleep(0.450) # 450 ms

    def stop(self):
        self.running = False

    def update_state(self):
        # Simulate movement
        self.roll += random.uniform(-1, 1)
        self.pitch += random.uniform(-0.5, 0.5)
        self.yaw = (self.yaw + random.uniform(-2, 2)) % 360
        self.lat += random.uniform(-0.00001, 0.00001)
        self.lon += random.uniform(-0.00001, 0.00001)
        self.alt += random.uniform(-0.2, 0.2)
        self.rel_alt += random.uniform(-0.2, 0.2)
        
        # Battery drain
        if self.battery_pct > 0:
            self.battery_pct -= random.uniform(0.01, 0.05)
            self.battery = 14.0 + (self.battery_pct / 100.0) * 2.8

    def send_telemetry(self):
        data = {
            "type": "telemetry",
            "roll": round(self.roll, 2),
            "pitch": round(self.pitch, 2),
            "yaw": round(self.yaw, 2),
            "lat": round(self.lat, 6),
            "lon": round(self.lon, 6),
            "alt": round(self.alt, 2),
            "rel_alt": round(self.rel_alt, 2),
            "vx": round(self.vx, 2),
            "vy": round(self.vy, 2),
            "vz": round(self.vz, 2),
            "gps_fix": self.gps_fix,
            "sat": self.sat,
            "battery": round(self.battery, 2),
            "battery_pct": int(self.battery_pct),
            "armed": self.armed,
            "mode": self.mode
        }
        json_str = json.dumps(data)
        self.uart_manager.send_line(json_str)
