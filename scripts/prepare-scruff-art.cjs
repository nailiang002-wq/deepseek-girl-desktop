const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const {alphaGrid, registerPose} = require('./prepare-flash-art.cjs');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets', 'scruff');
const groups = {
  flash: ['maid', 'hoodie', 'pajamas', 'winter-puffer', 'winter-cape'],
  pro: ['pro', 'pro-winter-puffer', 'pro-winter-cape'],
};
const poses = ['lift', 'land'];
const flashFit = {width: 320, height: 424, artHeight: 384, groundPadding: 18};
const proFit = {width: 384, height: 576, artHeight: 512, centerX: 206, centerBand: [.075, .182], groundPadding: 29};

async function main() {
  const reports = path.join(root, '.cache', 'scruff');
  await fs.mkdir(reports, {recursive: true});
  for (const [form, outfits] of Object.entries(groups)) {
    const source = path.join(assets, 'source', `${form}.png`);
    const cells = await alphaGrid(source, outfits.length, poses.length);
    const fit = form === 'pro' ? proFit : flashFit;
    const preview = [];

    for (const [index, region] of cells.entries()) {
      const outfit = outfits[index % outfits.length];
      const pose = poses[Math.floor(index / outfits.length)];
      const frame = await registerPose(source, region, fit);
      await sharp(frame).webp({quality: 93, alphaQuality: 100}).toFile(path.join(assets, `${outfit}-${pose}.webp`));
      preview.push({input: frame, top: Math.floor(index / outfits.length) * fit.height, left: index % outfits.length * fit.width});
    }

    await sharp({create: {width: fit.width * outfits.length, height: fit.height * poses.length, channels: 3, background: '#edf4fb'}})
      .composite(preview).png().toFile(path.join(reports, `${form}-preview.png`));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
