#define LORA_BAUD 115200
#define PC_BAUD 115200

#define LORA_RX_PIN 16
#define LORA_TX_PIN 17

void setup() {
  // Serial for Laptop USB
  Serial.begin(PC_BAUD);
  
  // Serial2 for LoRa E220
  Serial2.begin(LORA_BAUD, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);

  // Note: M0 and M1 should be wired to GND for Normal mode.
}

void loop() {
  // Non-blocking bridge: Laptop -> LoRa
  if (Serial.available()) {
    Serial2.write(Serial.read());
  }

  // Non-blocking bridge: LoRa -> Laptop
  if (Serial2.available()) {
    Serial.write(Serial2.read());
  }
}
