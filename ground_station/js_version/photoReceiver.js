/**
 * photoReceiver.js
 * ================
 * Menerima foto dari Raspberry Pi menggunakan protokol BINARY STRUCT.
 *
 * Protokol campuran pada saluran serial:
 *   [1] JSON  "photo_start" → mulai mode binary, simpan metadata
 *   [2] BINARY packets      → format identik send_image/raspberypi.py
 *   [3] JSON  "photo_end"   → kembali ke mode JSON normal, simpan foto
 *
 * Format Binary Packet (little-endian, 10-byte header + payload):
 *   Offset  Tipe    Nama
 *   0       uint16  image_id
 *   2       uint16  seq       (0-based)
 *   4       uint16  total
 *   6       uint16  size      (ukuran payload)
 *   8       uint16  crc       (CRC-16/CCITT dari header_no_crc + payload)
 *   10      bytes   payload   (raw JPEG bytes)
 *
 * photoReceiver.js dipasangkan dengan serialManager.js:
 *   - Saat menerima "photo_start" → serialManager memanggil startBinaryMode(total)
 *   - Saat binary selesai → serialManager memanggil handleBinaryPacket(buf) berulang kali
 *   - Saat "photo_end" diterima → assembleAndSave() dipanggil
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const HEADER_SIZE = 10; // bytes: 5 × uint16 little-endian

// ─── CRC-16/CCITT (identik dengan Python di photo_sender.py) ─────────────
function crc16(data) {
  let crc = 0xFFFF;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc;
}

// ─────────────────────────────────────────────────────────────────────────────

class PhotoReceiver {
  /**
   * @param {string} saveDir - Direktori untuk menyimpan foto yang diterima
   */
  constructor(saveDir = 'received_photos') {
    this.saveDir = saveDir;

    // State foto yang sedang diterima
    this.inBinaryMode   = false;   // true saat sedang menerima binary packets
    this.metadata       = null;    // data dari photo_start JSON
    this.chunks         = {};      // { seq: Buffer(payload) }
    this.receivedCount  = 0;
    this.totalExpected  = 0;
    this.rawBuffer      = Buffer.alloc(0); // buffer byte stream mentah dari serial

    // Info foto terakhir yang berhasil disimpan (untuk dashboard)
    this.latestPhotoInfo = null;

    if (!fs.existsSync(this.saveDir)) {
      fs.mkdirSync(this.saveDir, { recursive: true });
    }
  }

  // ─── Dipanggil oleh server.js untuk masing-masing event ─────────────────

  /**
   * Dipanggil saat JSON "photo_start" diterima.
   * @param {Object} data - Objek dari JSON.parse
   */
  onPhotoStart(data) {
    console.log(`\n[PhotoReceiver] ▶ photo_start: ID=${data.photo_id}, total=${data.total} paket`);
    this.metadata      = data;
    this.totalExpected = data.total;
    this.chunks        = {};
    this.receivedCount = 0;
    this.rawBuffer     = Buffer.alloc(0);
    this.inBinaryMode  = true;
  }

  /**
   * Dipanggil saat JSON "photo_end" diterima.
   * @param {Object} data - Objek dari JSON.parse
   */
  onPhotoEnd(data) {
    console.log(`[PhotoReceiver] ■ photo_end: ID=${data.photo_id}`);
    this.inBinaryMode = false;
    this._assembleAndSave();
  }

  /**
   * Dipanggil oleh serialManager dengan byte-byte mentah yang masuk
   * SAAT inBinaryMode === true. Menerima stream bytes dan memproses paket.
   * @param {Buffer} newBytes - Bytes baru dari serial port
   */
  feedBinaryBytes(newBytes) {
    // Tambahkan ke buffer akumulasi
    this.rawBuffer = Buffer.concat([this.rawBuffer, newBytes]);

    // Proses paket-paket selama buffer memuat setidaknya 1 header lengkap
    while (this.rawBuffer.length >= HEADER_SIZE) {
      // Baca header saja dulu untuk tahu ukuran payload
      const imageId = this.rawBuffer.readUInt16LE(0);
      const seq     = this.rawBuffer.readUInt16LE(2);
      const total   = this.rawBuffer.readUInt16LE(4);
      const size    = this.rawBuffer.readUInt16LE(6);
      const crcRecv = this.rawBuffer.readUInt16LE(8);

      const packetSize = HEADER_SIZE + size;

      // Tunggu sampai buffer memiliki 1 paket penuh
      if (this.rawBuffer.length < packetSize) break;

      const payload    = this.rawBuffer.slice(HEADER_SIZE, packetSize);
      const hdrNoCrc   = this.rawBuffer.slice(0, 8); // 4 × uint16 sebelum CRC field
      const crcCalc    = crc16(Buffer.concat([hdrNoCrc, payload]));

      if (crcCalc !== crcRecv) {
        console.warn(`[PhotoReceiver] CRC ERROR seq=${seq} | recv=${crcRecv.toString(16)} calc=${crcCalc.toString(16)} — paket dibuang`);
      } else {
        // Simpan payload berdasarkan seq number
        this.chunks[seq] = Buffer.from(payload);
        this.receivedCount++;

        if (seq % 10 === 0 || seq === total - 1) {
          console.log(`[PhotoReceiver] Paket ${seq + 1}/${total} ✓`);
        }
      }

      // Geser buffer — hapus paket yang sudah diproses
      this.rawBuffer = this.rawBuffer.slice(packetSize);
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _assembleAndSave() {
    if (!this.metadata) {
      console.error('[PhotoReceiver] Tidak ada metadata, foto tidak bisa disimpan.');
      return;
    }

    const total = this.totalExpected;
    const parts = [];

    for (let seq = 0; seq < total; seq++) {
      if (this.chunks[seq]) {
        parts.push(this.chunks[seq]);
      } else {
        console.warn(`[PhotoReceiver] Chunk seq=${seq} hilang! Foto mungkin rusak.`);
      }
    }

    const imgBuffer  = Buffer.concat(parts);
    const photoId    = this.metadata.photo_id;
    const filename   = `${photoId}.jpg`;
    const filepath   = path.join(this.saveDir, filename);

    try {
      fs.writeFileSync(filepath, imgBuffer);
      console.log(`[PhotoReceiver] ✓ Foto disimpan: ${filepath} (${imgBuffer.length} bytes)\n`);

      this.latestPhotoInfo = {
        photo_id : photoId,
        path     : `/photos/${filename}`,
        lat      : this.metadata.lat,
        lon      : this.metadata.lon,
        timestamp: this.metadata.timestamp,
      };
    } catch (err) {
      console.error('[PhotoReceiver] Gagal menyimpan:', err.message);
    }
  }

  // ─── Public getter ────────────────────────────────────────────────────────

  /** @returns {Object|null} Info foto terakhir untuk ditampilkan di dashboard */
  getLatestPhoto() {
    return this.latestPhotoInfo;
  }

  /** @returns {boolean} Apakah sedang dalam mode binary */
  isInBinaryMode() {
    return this.inBinaryMode;
  }
}

module.exports = PhotoReceiver;
