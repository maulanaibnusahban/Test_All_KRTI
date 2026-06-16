import time
import threading
import os
import sys

from uart_manager import UartManager
from telemetry_generator import TelemetryGenerator
from photo_sender import PhotoSender
from command_receiver import CommandReceiver

def print_menu():
    print("\n" + "="*20)
    print("PHOTO MENU")
    print("1. Send Photo 1")
    print("2. Send Photo 2")
    print("3. Send Photo 3")
    print("0. Exit")
    print("="*20)

def main():
    print("Starting Raspberry Pi UAV Subsystem...")
    
    # Initialize UART Manager (adjust port if needed, e.g., /dev/ttyS0 or /dev/ttyAMA0)
    # Using COM for testing if on Windows, but default for Pi is /dev/serial0
    port = "/dev/serial0"
    if len(sys.argv) > 1:
        port = sys.argv[1]
        
    uart_manager = UartManager(port=port, baudrate=115200)
    if not uart_manager.connect():
        print("Failed to start due to UART error.")
        return

    # Start Telemetry Generator
    telemetry = TelemetryGenerator(uart_manager)
    t_telemetry = threading.Thread(target=telemetry.start, daemon=True)
    t_telemetry.start()

    # Start Command Receiver
    command_rx = CommandReceiver(uart_manager)
    t_command = threading.Thread(target=command_rx.start, daemon=True)
    t_command.start()

    photo_sender = PhotoSender(uart_manager)

    # Ensure photos directory exists
    os.makedirs("photos", exist_ok=True)
    # create dummy text files if they don't exist
    for i in range(1, 4):
        path = f"photos/photo{i}.jpg"
        if not os.path.exists(path):
            print(f"Warning: {path} not found. Please place valid JPEGs in the photos directory.")

    try:
        while True:
            print_menu()
            choice = input("Select an option: ")
            
            if choice == "1":
                photo_sender.send_photo("IMG001", "photos/photo1.jpg")
            elif choice == "2":
                photo_sender.send_photo("IMG002", "photos/photo2.jpg")
            elif choice == "3":
                photo_sender.send_photo("IMG003", "photos/photo3.jpg")
            elif choice == "0":
                print("Exiting...")
                break
            else:
                print("Invalid choice.")
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
    finally:
        telemetry.stop()
        command_rx.stop()
        uart_manager.disconnect()
        print("Subsystem stopped.")

if __name__ == "__main__":
    main()
