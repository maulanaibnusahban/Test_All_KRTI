import os
import base64

class PhotoReceiver:
    def __init__(self, save_dir="received_photos"):
        self.save_dir = save_dir
        self.current_photo_id = None
        self.chunks = {}
        self.metadata = {}
        self.latest_photo_info = None

        os.makedirs(self.save_dir, exist_ok=True)

    def parse(self, data: dict):
        msg_type = data.get("type")
        
        if msg_type == "photo_start":
            self.current_photo_id = data.get("photo_id")
            self.chunks = {}
            self.metadata = data
            print(f"Receiving photo {self.current_photo_id}...")
            return True
            
        elif msg_type == "photo_chunk":
            photo_id = data.get("photo_id")
            if photo_id == self.current_photo_id:
                index = data.get("index")
                chunk_data = data.get("data")
                self.chunks[index] = chunk_data
            return True
            
        elif msg_type == "photo_end":
            photo_id = data.get("photo_id")
            if photo_id == self.current_photo_id:
                self._assemble_and_save()
            return True
            
        return False

    def _assemble_and_save(self):
        try:
            total_chunks = self.metadata.get("total_chunks", 0)
            b64_str = ""
            for i in range(1, total_chunks + 1):
                if i in self.chunks:
                    b64_str += self.chunks[i]
                else:
                    print(f"Warning: Missing chunk {i}")

            img_bytes = base64.b64decode(b64_str)
            
            filename = f"{self.current_photo_id}.jpg"
            filepath = os.path.join(self.save_dir, filename)
            
            with open(filepath, "wb") as f:
                f.write(img_bytes)
                
            print(f"Saved photo to {filepath}")
            
            self.latest_photo_info = {
                "photo_id": self.current_photo_id,
                "path": f"/photos/{filename}",
                "lat": self.metadata.get("lat"),
                "lon": self.metadata.get("lon"),
                "timestamp": self.metadata.get("timestamp")
            }
            
        except Exception as e:
            print(f"Error saving photo: {e}")

    def get_latest_photo(self):
        return self.latest_photo_info
