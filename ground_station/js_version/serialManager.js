/**
 * serialManager.js
 * ================
 * Mengelola koneksi USB Serial ke ESP32 Ground dengan dua mode baca:
 *
 *   MODE JSON   (default)
 *     Menggunakan ReadlineParser — data dipotong per '\n'.
 *     Digunakan untuk telemetri dan command.
 *
 *   MODE BINARY (saat foto sedang diterima)
 *     ReadlineParser di-bypass, raw bytes dibaca langsung dan
 *     diteruskan ke PhotoReceiver.feedBinaryBytes().
 *     Mode ini aktif antara JSON "photo_start" dan "photo_end".
 *
 * Event yang di-emit:
 *   'json'  (data: Object)   → JSON sudah di-parse, siap digunakan
 *   'disconnected'           → port tertutup tak terduga
 */

'use strict';

const { SerialPort }     = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { EventEmitter }   = require('events');

class SerialManager extends EventEmitter {
  constructor() {
    super();
    this.port        = null;
    this.parser      = null;
    this.connected   = false;

    // Referensi ke PhotoReceiver agar bytes binary bisa langsung diteruskan
    this.photoReceiver = null;
  }

  /**
   * Pasangkan PhotoReceiver sebelum connect().
   * @param {import('./photoReceiver')} photoReceiver
   */
  setPhotoReceiver(photoReceiver) {
    this.photoReceiver = photoReceiver;
  }

  // ─── Koneksi ──────────────────────────────────────────────────────────────

  /**
   * Membuka koneksi ke serial port.
   * @param {string} portPath - COM port (e.g., 'COM3' atau '/dev/ttyUSB0')
   * @param {number} baudRate
   * @returns {Promise<string>}
   */
  connect(portPath, baudRate = 115200) {
    return new Promise((resolve, reject) => {
      if (this.connected) this.disconnect();

      this.port = new SerialPort({ path: portPath, baudRate }, (err) => {
        if (err) {
          this.connected = false;
          return reject(`Gagal membuka port: ${err.message}`);
        }

        this._setupParsers();

        this.port.on('error', (err) => {
          console.error('[SerialManager] Port error:', err.message);
          this.connected = false;
          this.emit('disconnected');
        });

        this.port.on('close', () => {
          this.connected = false;
          this.emit('disconnected');
        });

        this.connected = true;
        resolve(`Terhubung ke ${portPath} @ ${baudRate} baud`);
      });
    });
  }

  /**
   * Menutup koneksi serial port.
   */
  disconnect() {
    if (this.port && this.port.isOpen) {
      this.port.close();
    }
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }

  // ─── Pengiriman Data ──────────────────────────────────────────────────────

  /**
   * Mengirim satu baris JSON ke serial port (diakhiri '\n').
   * @param {string} jsonString
   */
  send(jsonString) {
    if (!this.isConnected()) {
      console.warn('[SerialManager] Tidak terhubung, data tidak dikirim.');
      return;
    }
    const line = jsonString.endsWith('\n') ? jsonString : jsonString + '\n';
    this.port.write(line, (err) => {
      if (err) console.error('[SerialManager] Write error:', err.message);
    });
  }

  // ─── Setup Parser (Dual Mode) ─────────────────────────────────────────────

  /**
   * Memasang ReadlineParser ke port untuk mode JSON.
   * Setiap baris yang masuk akan di-parse sebagai JSON lalu di-emit sebagai 'json'.
   * Jika PhotoReceiver dalam binary mode, raw bytes diteruskan ke feedBinaryBytes().
   * @private
   */
  _setupParsers() {
    // ── ReadlineParser untuk JSON lines ──────────────────────────────────
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

    this.parser.on('data', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Coba parse sebagai JSON
      let data;
      try {
        data = JSON.parse(trimmed);
      } catch (_) {
        // Bukan JSON — mungkin noise atau data binary yang lolos readline
        // (bisa terjadi jika ada byte 0x0A di dalam binary packet)
        // Abaikan saja
        return;
      }

      // Emit JSON yang sudah di-parse ke server.js
      this.emit('json', data);
    });

    // ── Raw byte listener untuk binary photo data ─────────────────────────
    // Node.js SerialPort bisa punya lebih dari satu listener.
    // Listener ini SELALU aktif, tapi hanya meneruskan bytes ke photoReceiver
    // saat inBinaryMode === true.
    this.port.on('data', (rawChunk) => {
      if (
        this.photoReceiver &&
        this.photoReceiver.isInBinaryMode()
      ) {
        // Teruskan bytes mentah ke PhotoReceiver untuk diproses
        this.photoReceiver.feedBinaryBytes(rawChunk);
      }
    });
  }
}

module.exports = SerialManager;
