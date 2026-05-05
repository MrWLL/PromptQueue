import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const inputPath = path.join(repoRoot, 'media', 'promptqueue-marketplace.svg');
const outputPath = path.join(repoRoot, 'media', 'promptqueue-marketplace.png');

await sharp(inputPath)
  .resize(256, 256, { fit: 'contain' })
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Wrote ${outputPath}`);
