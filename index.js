import https from 'https';
import fs from 'fs';
import sharp from 'sharp';
import tesseract from 'tesseract.js';

process.addListener('unhandledRejection', error => { throw error; });
process.addListener('uncaughtException', error => { throw error; });

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

  let left;
  let right;
  let top;
  let bottom;
  for (let y = 0; y < metadata.height; y++) {
    for (let x = 0; x < metadata.width; x++) {
      const offset = metadata.channels * (metadata.width * y + x);
      const r1 = buffer[offset] === 17;
      const g1 = buffer[offset + 1] === 10;
      const b1 = buffer[offset + 2] === 64;
      const r2 = buffer[offset + 3] === 17;
      const g2 = buffer[offset + 4] === 10;
      const b2 = buffer[offset + 5] === 64;
      if (r1 && g1 && b1 && r2 && g2 && b2) {
        if (left === undefined || x < left) {
          left = x;
        }

        if (right === undefined || x > right) {
          right = x;
        }

        if (top === undefined || y < top) {
          top = y;
        }

        if (bottom === undefined || y > bottom) {
          bottom = y;
        }
      }
    }
  }

  // Crop off the rocket by only taking the top half of the countdown region
  const width = right - left;
  const height = bottom - top;
  const region = { left, top: top + ~~(height * .2), width: ~~(width * .9), height: ~~(height * .35) };
  await fs.promises.writeFile('extract.png', await image.extract(region).negate().png().toBuffer());

  console.log('Countdown extracted', region);

  const worker = tesseract.createWorker({ logger: console.log });
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  await worker.setParameters({ tessedit_char_whitelist: ':0123456789', tessedit_pageseg_mode: tesseract.PSM.SINGLE_LINE });
  const result = await worker.recognize('extract.png');
  await worker.terminate();

  const text = result.data.text.replace(/\s/g, '').replace(/^:/, '');
  const stamp = new Date().toLocaleString('en-US', { timeZone: 'Europe/Prague', hour12: false, hour: '2-digit', minute: '2-digit' });
  await fs.promises.writeFile('countdown.now', text + ' @ ' + stamp);

  console.log('Recognized text', text);
}()
