# UAV Telemetry, Command, and Photo Transfer System

## 1. Project Overview
This project provides a robust, modular foundation for a UAV communication system utilizing a Raspberry Pi 5, ESP32 microcontrollers, and LoRa E220 modules. It handles bi-directional JSON line protocol communication for telemetry, command and control, and image transfer. This foundation is designed for future Pixhawk MAVLink integration.

## 2. System Architecture
- **Raspberry Pi 5 (Drone Subsystem):** Acts as the brains on the drone. Generates dummy telemetry, compresses images using OpenCV (base64 chunking), and parses incoming commands.
- **ESP32 Drone (Bridge):** Simple bridge relaying UART from Raspberry Pi to the LoRa Module.
- **ESP32 Ground (Bridge):** Simple bridge relaying LoRa packets to the Ground Station Laptop via USB Serial.
- **Ground Station (Laptop):** Python backend that reads serial data, reassembles photo chunks, serves API endpoints, and a modern HTML/CSS/JS frontend dashboard.

## 3. Hardware Wiring

**ESP32 Drone & LoRa E220:**
- ESP32 TX2 (Pin 17) -> LoRa RX
- ESP32 RX2 (Pin 16) -> LoRa TX
- LoRa M0 -> GND
- LoRa M1 -> GND
- Raspberry Pi TX -> ESP32 RX (Pin 3)
- Raspberry Pi RX -> ESP32 TX (Pin 1)

**ESP32 Ground & LoRa E220:**
- ESP32 TX2 (Pin 17) -> LoRa RX
- ESP32 RX2 (Pin 16) -> LoRa TX
- LoRa M0 -> GND
- LoRa M1 -> GND
- USB Serial directly to PC.

## 4. Communication Flow
`Raspberry Pi <-> UART (115200) <-> ESP32 <-> LoRa (4.8k) <-> LoRa (4.8k) <-> ESP32 <-> USB Serial (115200) <-> Ground Station`
Data is formatted exclusively in JSON Lines (`\n` terminated).

## 5. LoRa Configuration
- Module: E220-400T22D
- Mode: Normal (M0=GND, M1=GND)
- Baudrate: 115200
- Air Rate: 4.8 kbps
- Packet Size: 200 bytes
- Power: 22 dBm

## 6. Raspberry Pi Setup
1. Ensure Python 3 is installed.
2. Install OpenCV and PySerial: `pip install opencv-python pyserial`
3. Run the subsystem: `python3 raspberry_pi/main.py /dev/serial0` (adjust port if needed)

## 7. ESP32 Upload Guide
1. Open Arduino IDE.
2. Upload `esp32_drone.ino` to the ESP32 on the drone.
3. Upload `esp32_ground.ino` to the ESP32 on the ground.
(Make sure `Serial2` pins match your specific board variant if it differs from 16/17).

## 8. Ground Station Setup
1. Install requirements: `pip install pyserial`
2. Run ground station: `python ground_station/ground_station.py`

## 9. Dashboard Usage
1. Open a browser to `http://localhost:8080/`.
2. Enter your COM port (e.g., `COM3` on Windows or `/dev/ttyUSB0` on Linux) and click Connect.
3. Observe telemetry updating in real-time, click ARM/DISARM/PLAN to send commands, and watch for incoming photos.

## 10. Telemetry Protocol
Sent every 450ms:
```json
{"type":"telemetry","roll":12.5,"pitch":1.2,"yaw":180.2,"lat":-7.123456,"lon":110.654321,"alt":120.5,"rel_alt":25.5,"vx":1.2,"vy":0.3,"vz":-0.2,"gps_fix":3,"sat":14,"battery":15.8,"battery_pct":87,"armed":true,"mode":"GUIDED"}
```

## 11. Photo Transfer Protocol
1. **Metadata:** `{"type":"photo_start","photo_id":"IMG001","lat":-7.1,"lon":110.6,"timestamp":"2026-06-15 15:00:00","size":3072,"total_chunks":96}`
2. **Chunks:** `{"type":"photo_chunk","photo_id":"IMG001","index":1,"total":96,"data":"/9j/4AAQSk..."}`
3. **End:** `{"type":"photo_end","photo_id":"IMG001"}`

## 12. Command Protocol
`{"type":"command","command":"ARM"}`

## 13. Troubleshooting
- **No Data in Dashboard:** Verify the COM Port is correct. Check if the LoRa M0/M1 pins are grounded. Ensure the Pi UART is enabled in `raspi-config`.
- **Photo Not Displaying:** The chunk size must be small enough so the serialized JSON string fits within the LoRa packet limit safely.

## 14. Development Roadmap
- Phase 1: Base simulation and LoRa bridging (Complete)
- Phase 2: Implement Checksum/CRC for dropped packets
- Phase 3: Optimize base64 overhead by using raw binary interleaving

## 15. Future Pixhawk MAVLink
The `telemetry_generator.py` and `command_receiver.py` are modular. In the future, replace the dummy functions with PyMAVLink logic to read/write real MAVLink messages over a secondary UART connected to the Pixhawk. The JSON transmission logic remains unchanged.
