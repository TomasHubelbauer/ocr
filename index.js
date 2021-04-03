import https from 'https';
import fs from 'fs';
import sharp from 'sharp';
import tesseract from 'tesseract.js';

void async function () {
  try {
    await fs.promises.access('live_user_ludwig-1920x1080.jpg');
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream('live_user_ludwig-1920x1080.jpg');
      const request = https.get('https://static-cdn.jtvnw.net/previews-ttv/live_user_ludwig-1920x1080.jpg', response => {
        response.pipe(stream);
        stream.on('finish', resolve);
      });

      request.on('error', reject);
    });

    console.log('Preview downloaded');
  }

  const image = sharp('live_user_ludwig-1920x1080.jpg');
  const metadata = await image.metadata();
  const buffer = await image.raw().toBuffer();

  let minX;
  let maxX;
  let minY;
  let maxY;
  for (let y = 0; y < metadata.height; y++) {
    for (let x = 0; x < metadata.width; x++) {
      const offset = metadata.channels * (metadata.width * y + x);
      const r = buffer[offset];
      const g = buffer[offset + 1];
      const b = buffer[offset + 2];
      if (r === 17 && g === 10 && b === 64) {
        if (minX === undefined || x < minX) {
          minX = x;
        }

        if (maxX === undefined || x > maxX) {
          maxX = x;
        }

        if (minY === undefined || y < minY) {
          minY = y;
        }

        if (maxY === undefined || y > maxY) {
          maxY = y;
        }
      }
    }
  }

  const region = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  const extract = await image.extract(region);
  await fs.promises.writeFile('extract.png', await extract.png().toBuffer());

  console.log('Countdown extracted', region);

  const result = await tesseract.recognize('extract.png', 'eng', { logger: console.log });

  // Remove the misrecognized one that comes up before the actual countdown text
  const text = result.data.text.slice('1'.length);
  await fs.promises.writeFile('countdown.now', text);

  console.log('Recognized text', text);
}()
