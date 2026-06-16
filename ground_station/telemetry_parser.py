class TelemetryParser:
    def __init__(self):
        self.latest_telemetry = {}

    def parse(self, data: dict):
        if data.get("type") == "telemetry":
            self.latest_telemetry = data
            return True
        return False

    def get_latest(self):
        return self.latest_telemetry
