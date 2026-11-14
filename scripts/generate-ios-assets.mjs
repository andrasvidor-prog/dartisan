import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public/icons/dartisan.svg'));
const assets = path.join(root, 'ios/App/App/Assets.xcassets');
const background = '#0b0d11';

await sharp(source, { density: 192 })
  .resize(1024, 1024)
  .flatten({ background })
  .png()
  .toFile(path.join(assets, 'AppIcon.appiconset/AppIcon-512@2x.png'));

const mark = await sharp(source, { density: 192 })
  .resize(560, 560)
  .flatten({ background })
  .png()
  .toBuffer();

const splashPath = path.join(assets, 'Splash.imageset');
await sharp({
  create: { width: 2732, height: 2732, channels: 3, background },
})
  .composite([{ input: mark, left: 1086, top: 1086 }])
  .png()
  .toFile(path.join(splashPath, 'splash-2732x2732.png'));

await copyFile(path.join(splashPath, 'splash-2732x2732.png'), path.join(splashPath, 'splash-2732x2732-1.png'));
await copyFile(path.join(splashPath, 'splash-2732x2732.png'), path.join(splashPath, 'splash-2732x2732-2.png'));
