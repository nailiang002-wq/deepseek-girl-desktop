const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const {poses} = require('../assets/flash-redraw/timelines.json');

const root = path.resolve(__dirname, '..');
const artRoot = path.join(root, 'assets', 'flash-redraw');
const outfits = ['maid', 'hoodie', 'pajamas', 'winter-puffer', 'winter-cape'];
const width = 320;
const height = 424;
const artHeight = 392;

function transparentCanvas(canvasWidth, canvasHeight) {
  return {width: canvasWidth, height: canvasHeight, channels: 4, background: '#00000000'};
}

async function alphaGrid(filename, columns, rows) {
  const {data, info} = await sharp(filename).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const columnInk = Array(info.width).fill(0);
  const rowInk = Array(info.height).fill(0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 112) continue;
      columnInk[x]++;
      rowInk[y]++;
    }
  }

  function cuts(ink, count) {
    const stride = ink.length / count;
    return [0, ...Array.from({length: count - 1}, (_, index) => {
      const expected = Math.round(stride * (index + 1));
      const radius = Math.round(stride * .2);
      let best = expected;
      let bestScore = Infinity;
      for (let position = expected - radius; position <= expected + radius; position++) {
        const score = ink[position - 1] + ink[position] + ink[position + 1] + Math.abs(position - expected) * .025;
        if (score < bestScore) { best = position; bestScore = score; }
      }
      return best;
    }), ink.length];
  }

  const xs = cuts(columnInk, columns);
  const ys = cuts(rowInk, rows);
  return Array.from({length: columns * rows}, (_, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {left: xs[col], top: ys[row], width: xs[col + 1] - xs[col], height: ys[row + 1] - ys[row]};
  });
}

function keepSilhouette(data, width, height) {
  const size = width * height;
  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  let largest = new Int32Array();

  for (let seed = 0; seed < size; seed++) {
    if (visited[seed] || data[seed * 4 + 3] < 48) continue;
    queue[0] = seed;
    visited[seed] = 1;
    let count = 1;
    for (let head = 0; head < count; head++) {
      const position = queue[head];
      const x = position % width;
      const y = Math.floor(position / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
          const neighbor = position + dx + width * dy;
          if (visited[neighbor] || data[neighbor * 4 + 3] < 48) continue;
          visited[neighbor] = 1;
          queue[count++] = neighbor;
        }
      }
    }
    if (count > largest.length) largest = queue.slice(0, count);
  }

  const main = new Uint8Array(size);
  for (const index of largest) main[index] = 1;
  for (let i = 0; i < size; i++) {
    if (main[i]) continue;
    const alpha = data[i * 4 + 3];
    const x = i % width;
    const smoothEdge = alpha >= 8 && alpha < 48 && (main[i - width] || main[i + width] || (x > 0 && main[i - 1]) || (x < width - 1 && main[i + 1]));
    if (!smoothEdge) data.fill(0, i * 4, i * 4 + 4);
  }
}

async function registerPose(filename, region, fit = {}) {
  const canvasWidth = fit.width ?? width;
  const canvasHeight = fit.height ?? height;
  const poseHeight = fit.artHeight ?? artHeight;
  const centerX = fit.centerX ?? canvasWidth / 2;
  const [bandStart, bandEnd] = fit.centerBand ?? [.19, .38];
  const groundPadding = fit.groundPadding ?? 14;
  const {data, info} = await sharp(filename).extract(region).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  keepSilhouette(data, info.width, info.height);
  const bounds = {left: info.width, right: 0, top: info.height, bottom: 0};
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 110) continue;
      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y);
      bounds.bottom = Math.max(bounds.bottom, y);
    }
  }
  const bodyHeight = bounds.bottom - bounds.top + 1;
  if (bodyHeight < region.height * .55) throw Error(`Missing or clipped pose in ${filename} (${region.left}, ${region.top})`);

  // Align on the upper hair silhouette. Gestures and props can change the total width.
  const centers = [];
  for (let y = bounds.top + Math.round(bodyHeight * bandStart); y <= bounds.top + Math.round(bodyHeight * bandEnd); y++) {
    let left = info.width;
    let right = 0;
    for (let x = bounds.left; x <= bounds.right; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 180) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    if (right > left) centers.push((left + right) / 2);
  }
  centers.sort((a, b) => a - b);
  const center = centers[Math.floor(centers.length / 2)];
  const scale = poseHeight / bodyHeight;
  const left = Math.max(0, bounds.left - 2);
  const top = Math.max(0, bounds.top - 2);
  const cropWidth = Math.min(info.width - left, bounds.right - left + 3);
  const cropHeight = Math.min(info.height - top, bounds.bottom - top + 3);
  const processed = await sharp(data, {raw: {width: info.width, height: info.height, channels: 4}})
    .extract({left, top, width: cropWidth, height: cropHeight})
    .resize(Math.round(cropWidth * scale), Math.round(cropHeight * scale), {fit: 'fill'}).png().toBuffer();
  return sharp({create: transparentCanvas(canvasWidth, canvasHeight)}).composite([{
    input: processed,
    left: Math.round(centerX - (center - left) * scale),
    top: Math.round(canvasHeight - groundPadding - poseHeight - (bounds.top - top) * scale)
  }]).png().toBuffer();
}

async function main() {
  const design = path.join(artRoot, 'design.png');
  const standstillRegions = await alphaGrid(design, outfits.length, 1);
  const preview = [];
  const contact = [];
  for (const [outfitIndex, outfit] of outfits.entries()) {
    const source = path.join(artRoot, 'source', `${outfit}.png`);
    const regions = await alphaGrid(source, 3, 3);
    const frames = [await registerPose(design, standstillRegions[outfitIndex])];
    for (const region of regions) frames.push(await registerPose(source, region));
    const destination = path.join(artRoot, outfit);
    await fs.mkdir(destination, {recursive: true});
    const atlas = [];
    for (const [index, frame] of frames.entries()) {
      await sharp(frame).webp({quality: 92, alphaQuality: 100}).toFile(path.join(destination, `${poses[index]}.webp`));
      atlas.push({input: frame, top: 0, left: index * width});
      contact.push({input: await sharp(frame).resize(128, 170).png().toBuffer(), left: index * 128, top: outfitIndex * 170});
    }
    await sharp({create: transparentCanvas(width * frames.length, height)}).composite(atlas)
      .webp({quality: 91, alphaQuality: 100}).toFile(path.join(destination, 'strip.webp'));
    preview.push({input: frames[0], left: outfitIndex * width, top: 0});
  }

  const reports = path.join(root, '.cache', 'flash-redraw');
  await fs.mkdir(reports, {recursive: true});
  await sharp({create: {...transparentCanvas(width * outfits.length, height), background: '#edf4fb'}})
    .composite(preview).png().toFile(path.join(reports, 'wardrobe.png'));
  await sharp({create: {...transparentCanvas(128 * poses.length, 170 * outfits.length), background: '#edf4fb'}})
    .composite(contact).png().toFile(path.join(reports, 'poses.png'));
  console.log(`Prepared ${outfits.length} full-body outfits, ${poses.length} poses each.`);
}

module.exports = {alphaGrid, registerPose};
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
