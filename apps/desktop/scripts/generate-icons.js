const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      const cx = width / 2;
      const cy = height / 2;
      const rx = Math.abs(x - cx);
      const ry = Math.abs(y - cy);
      const cornerR = width * 0.22;
      const straightW = cx - cornerR;
      const straightH = cy - cornerR;

      let inside = false;
      if (rx <= straightW && ry <= cy) inside = true;
      else if (ry <= straightH && rx <= cx) inside = true;
      else {
        const dx = rx - straightW;
        const dy = ry - straightH;
        if (dx * dx + dy * dy <= cornerR * cornerR) inside = true;
      }

      if (inside) {
        // Modern tech gradient: Deep Cyan-Blue (#0284c7) to Sky Blue (#38bdf8)
        const t = (x + y) / (width + height);
        let r = Math.round(2 + t * 50);
        let g = Math.round(132 + t * 55);
        let b = Math.round(199 + t * 45);

        // Center white monogram "B" shape
        const inBVertical = x >= width * 0.32 && x <= width * 0.42 && y >= height * 0.25 && y <= height * 0.75;
        const inBTopBar = x >= width * 0.32 && x <= width * 0.62 && y >= height * 0.25 && y <= height * 0.35;
        const inBMidBar = x >= width * 0.32 && x <= width * 0.58 && y >= height * 0.45 && y <= height * 0.55;
        const inBBotBar = x >= width * 0.32 && x <= width * 0.62 && y >= height * 0.65 && y <= height * 0.75;
        const inBTopCurve = x >= width * 0.55 && x <= width * 0.65 && y >= height * 0.28 && y <= height * 0.52;
        const inBBotCurve = x >= width * 0.55 && x <= width * 0.65 && y >= height * 0.48 && y <= height * 0.72;

        if (inBVertical || inBTopBar || inBMidBar || inBBotBar || inBTopCurve || inBBotCurve) {
          r = 255;
          g = 255;
          b = 255;
        }

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', deflated);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function createIcoFromPng(pngBuffer) {
  // 6 bytes header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(1, 4); // 1 image

  // 16 bytes directory entry
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width: 0 = 256
  entry.writeUInt8(0, 1); // height: 0 = 256
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // size of image data
  entry.writeUInt32LE(22, 12); // offset: 6 + 16 = 22

  return Buffer.concat([header, entry, pngBuffer]);
}

const assetsDir = path.join(__dirname, '..', 'src', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const png = createPng(256, 256);
const ico = createIcoFromPng(png);

fs.writeFileSync(path.join(assetsDir, 'icon.png'), png);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico);

console.log('Generated icon.png and icon.ico successfully');
