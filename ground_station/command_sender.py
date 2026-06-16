import json

class CommandSender:
    def __init__(self, serial_manager):
        self.serial_manager = serial_manager

    def send_command(self, cmd_str: str):
        if cmd_str in ["ARM", "DISARM", "PLAN"]:
            msg = {
                "type": "command",
                "command": cmd_str
            }
            json_str = json.dumps(msg)
            self.serial_manager.send(json_str)
            return True
        return False
