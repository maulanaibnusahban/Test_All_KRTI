/**
 * server.js  –  UAV Ground Station (Node.js)
 * ============================================
 * Entry point utama. Menggantikan ground_station.py + dashboard_server.py.
 *
 * Tugas:
 *  - Meng-serve folder web/ sebagai static files (Dashboard HTML/CSS/JS)
 *  - Menyediakan REST API untuk Dashboard:
 *      GET  /api/telemetry   → data telemetry terbaru
 *      GET  /api/photo       → info foto terbaru
 *      GET  /api/logs        → log komunikasi (FIFO queue)
 *      GET  /api/status      → status koneksi serial
 *      GET  /photos/:file    → file foto JPG yang diterima
 *      POST /api/connect     → membuka koneksi serial
 *      POST /api/disconnect  → menutup koneksi serial
 *      POST /api/command     → mengirim command ARM/DISARM/PLAN
 *
 * Cara menjalankan:
 *   node server.js
 *
 * Kemudian buka: http://localhost:8080
 */

'use strict';

const express    = require('express');
const path       = require('path');
const fs         = require('fs');

const SerialManager   = require('./serialManager');
const TelemetryParser = require('./telemetryParser');
const PhotoReceiver   = require('./photoReceiver');
const CommandSender   = require('./commandSender');

// ─── Konfigurasi ────────────────────────────────────────────────────────────
const PORT           = 8080;
const WEB_DIR        = path.resolve(__dirname, '../../web');
const PHOTOS_DIR     = path.resolve(__dirname, '../received_photos');
const MAX_LOG_LINES  = 500; // maksimum baris log yang disimpan di memori

// ─── Inisialisasi Modul ──────────────────────────────────────────────────────
const app           = express();
const serialManager = new SerialManager();
const telemetry     = new TelemetryParser();
const photoReceiver = new PhotoReceiver(PHOTOS_DIR);
const cmdSender     = new CommandSender(serialManager);

/** Circular log buffer – menyimpan baris [RX] dan [TX] */
const logBuffer = [];

function addLog(entry) {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift(); // buang entri paling lama
  }
}

// ─── Event: Data Masuk dari Serial ──────────────────────────────────────────
serialManager.on('data', (line) => {
  // Tambahkan ke log
  addLog(`[RX] ${line}`);

  // Parse JSON dengan aman
  let data;
  try {
    data = JSON.parse(line);
  } catch (_) {
    // Bukan JSON yang valid — abaikan saja
    return;
  }

  const type = data.type;

  if (type === 'telemetry') {
    telemetry.parse(data);
  } else if (['photo_start', 'photo_chunk', 'photo_end'].includes(type)) {
    photoReceiver.parse(data);
  }
});

serialManager.on('disconnected', () => {
  addLog('[SYS] Serial port terputus');
  console.log('[Server] Serial port terputus.');
});

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());

// Serve Dashboard (folder web/)
if (fs.existsSync(WEB_DIR)) {
  app.use(express.static(WEB_DIR));
} else {
  console.warn(`[Server] Folder web/ tidak ditemukan di: ${WEB_DIR}`);
}

// Serve foto yang sudah diterima
app.use('/photos', express.static(PHOTOS_DIR));

// ─── API Routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/status
 * Mengembalikan status koneksi serial.
 */
app.get('/api/status', (req, res) => {
  res.json({ connected: serialManager.isConnected() });
});

/**
 * GET /api/telemetry
 * Mengembalikan data telemetry terbaru.
 */
app.get('/api/telemetry', (req, res) => {
  res.json(telemetry.getLatest() || {});
});

/**
 * GET /api/photo
 * Mengembalikan info foto terakhir yang berhasil diterima.
 */
app.get('/api/photo', (req, res) => {
  res.json(photoReceiver.getLatestPhoto() || {});
});

/**
 * GET /api/logs
 * Mengembalikan semua log yang tersimpan di buffer.
 * Dashboard mengambil seluruh log, bukan hanya yang baru.
 */
app.get('/api/logs', (req, res) => {
  res.json({ logs: [...logBuffer] });
});

/**
 * POST /api/connect
 * Body: { "port": "COM3", "baudrate": 115200 }
 * Membuka koneksi ke serial port.
 */
app.post('/api/connect', async (req, res) => {
  const { port, baudrate = 115200 } = req.body;

  if (!port) {
    return res.status(400).json({ status: 'error', message: 'Port tidak boleh kosong.' });
  }

  try {
    const msg = await serialManager.connect(port, Number(baudrate));
    addLog(`[SYS] ${msg}`);
    console.log(`[Server] ${msg}`);
    res.json({ status: 'success', message: msg });
  } catch (err) {
    console.error('[Server] Connect error:', err);
    res.status(500).json({ status: 'error', message: String(err) });
  }
});

/**
 * POST /api/disconnect
 * Menutup koneksi serial port.
 */
app.post('/api/disconnect', (req, res) => {
  serialManager.disconnect();
  addLog('[SYS] Serial port ditutup oleh pengguna.');
  res.json({ status: 'success' });
});

/**
 * POST /api/command
 * Body: { "command": "ARM" }
 * Mengirim command ke UAV.
 */
app.post('/api/command', (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ status: 'error', message: 'Field command diperlukan.' });
  }

  if (!serialManager.isConnected()) {
    return res.status(503).json({ status: 'error', message: 'Serial belum terhubung.' });
  }

  const ok = cmdSender.send(command);
  if (ok) {
    const txLog = `[TX] ${JSON.stringify({ type: 'command', command })}`;
    addLog(txLog);
    res.json({ status: 'success' });
  } else {
    res.status(400).json({ status: 'error', message: `Command tidak valid: ${command}` });
  }
});

// ─── Jalankan Server ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║        UAV Ground Station  –  Node.js        ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Dashboard : http://localhost:${PORT}           ║`);
  console.log(`║  Web Dir   : ${WEB_DIR.slice(-30).padEnd(30)} ║`);
  console.log(`║  Photos    : ${PHOTOS_DIR.slice(-30).padEnd(30)} ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('\nMenunggu koneksi serial dari Dashboard...\n');
});
