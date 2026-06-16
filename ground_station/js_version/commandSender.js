/**
 * commandSender.js
 * Memvalidasi dan mengirim perintah ke Raspberry Pi via serial.
 * Menggantikan command_sender.py
 */

const VALID_COMMANDS = ['ARM', 'DISARM', 'PLAN'];

class CommandSender {
  /**
   * @param {import('./serialManager')} serialManager - Instance SerialManager
   */
  constructor(serialManager) {
    this.serialManager = serialManager;
  }

  /**
   * Mengirim command ke serial port.
   * @param {string} command - Nama command: 'ARM', 'DISARM', atau 'PLAN'
   * @returns {boolean} - true jika command valid dan berhasil dikirim
   */
  send(command) {
    if (!VALID_COMMANDS.includes(command)) {
      console.warn(`[CommandSender] Command tidak valid: ${command}`);
      return false;
    }

    const msg = JSON.stringify({ type: 'command', command });
    this.serialManager.send(msg);
    console.log(`[CommandSender] Mengirim: ${msg}`);
    return true;
  }
}

module.exports = CommandSender;
