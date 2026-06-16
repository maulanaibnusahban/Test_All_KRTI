import cv2
import base64
import json
import math
import time
import os
import datetime

CHUNK_SIZE = 240
JPEG_QUALITY = 30
RESIZE_W = 160
RESIZE_H = 120

class PhotoSender:
    def __init__(self, uart_manager):
        self.uart_manager = uart_manager

    def load_and_compress(self, path: str) -> bytes:
        img = cv2.imread(path)
        if img is None:
            raise FileNotFoundError(f"Gagal membuka gambar: {path}")

        img = cv2.resize(img, (RESIZE_W, RESIZE_H))

        ok, buf = cv2.imencode(
            ".jpg", img,
            [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
        )
        if not ok:
            raise RuntimeError("Gagal encode JPEG")

        return buf.tobytes()

    def send_photo(self, photo_id: str, path: str):
        try:
            print(f"Loading and compressing {path}...")
            jpeg_bytes = self.load_and_compress(path)
            
            # Encode Base64
            b64_bytes = base64.b64encode(jpeg_bytes)
            b64_str = b64_bytes.decode('utf-8')
            
            # Remove any newlines just in case
            b64_str = b64_str.replace('\n', '')
            
            total_chunks = math.ceil(len(b64_str) / CHUNK_SIZE)
            
            # Send metadata
            metadata = {
                "type": "photo_start",
                "photo_id": photo_id,
                "lat": -7.123456,
                "lon": 110.654321,
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "size": len(jpeg_bytes),
                "total_chunks": total_chunks
            }
            self.uart_manager.send_line(json.dumps(metadata))
            time.sleep(0.5) # Give ground station time to prep
            
            print(f"Sending {total_chunks} chunks...")
            for i in range(total_chunks):
                chunk_data = b64_str[i * CHUNK_SIZE : (i + 1) * CHUNK_SIZE]
                chunk_msg = {
                    "type": "photo_chunk",
                    "photo_id": photo_id,
                    "index": i + 1,
                    "total": total_chunks,
                    "data": chunk_data
                }
                
                self.uart_manager.send_line(json.dumps(chunk_msg))
                # Small delay to prevent overwhelming LoRa
                time.sleep(0.3)
                
            # Send end message
            end_msg = {
                "type": "photo_end",
                "photo_id": photo_id
            }
            self.uart_manager.send_line(json.dumps(end_msg))
            print(f"Photo {photo_id} sent successfully!")
            
        except Exception as e:
            print(f"Error sending photo: {e}")
