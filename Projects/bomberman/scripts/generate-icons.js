'use strict';

// Erzeugt PNG-Icons für die PWA ohne externe Abhängigkeiten
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32Table() {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
}
const CRC_TABLE = crc32Table();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function makeBombIcon(size) {
  // PNG-Signatur
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR (Breite, Höhe, BitDepth=8, ColorType=2=RGB)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;

  // Pixel zeichnen: Bombe auf dunklem Hintergrund
  const cx = size / 2, cy = size * 0.55;
  const radius = size * 0.32;
  const rows = [];

  for (let y = 0; y < size; y++) {
    rows.push(0); // Filter: None
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const fuse_x = cx + radius * 0.6;
      const fuse_y = cy - radius;

      if (dist < radius) {
        // Bomben-Körper: fast schwarz mit leichtem Glanz
        const glanz = dist < radius * 0.3 && x < cx && y < cy;
        rows.push(glanz ? 80 : 30, glanz ? 80 : 30, glanz ? 90 : 30);
      } else if (
        Math.abs(x - fuse_x) < size * 0.04 &&
        y > cy - radius * 1.5 && y < cy - radius * 0.8
      ) {
        // Zündschnur: braun
        rows.push(139, 90, 43);
      } else if (
        Math.abs(x - (fuse_x + (y - (cy - radius * 1.5)) * 0.5)) < size * 0.04 &&
        y > cy - radius * 2.2 && y < cy - radius * 1.5
      ) {
        // Funke: gelb-orange
        const t = (y - (cy - radius * 2.2)) / (radius * 0.7);
        rows.push(255, Math.floor(200 - t * 100), 0);
      } else {
        // Hintergrund: dunkles Blau-Lila
        rows.push(25, 20, 50);
      }
    }
  }

  const raw = Buffer.from(rows);
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);
}

const publicDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), makeBombIcon(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), makeBombIcon(512));
console.log('Icons erstellt: icon-192.png, icon-512.png');
