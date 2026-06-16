/**
 * telemetryParser.js
 * Menyimpan data telemetry terbaru yang diterima dari serial port.
 * Menggantikan telemetry_parser.py
 */

class TelemetryParser {
  constructor() {
    /** @type {Object|null} Data telemetry terakhir yang diterima */
    this.latestTelemetry = null;
  }

  /**
   * Mem-parsing objek JSON yang sudah di-parse.
   * @param {Object} data - Objek JSON dari serial
   * @returns {boolean} - true jika data adalah telemetry yang valid
   */
  parse(data) {
    if (data && data.type === 'telemetry') {
      this.latestTelemetry = data;
      return true;
    }
    return false;
  }

  /**
   * Mengembalikan data telemetry terakhir.
   * @returns {Object|null}
   */
  getLatest() {
    return this.latestTelemetry;
  }
}

module.exports = TelemetryParser;
