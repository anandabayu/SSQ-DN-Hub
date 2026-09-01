/**
 * Turns a logo on a solid white background into a trimmed, transparent PNG.
 *
 *   node scripts/make-logo.mjs <source-image> [output]
 *
 * Why a flood fill rather than "make every white pixel transparent": the word
 * STREAM in this logo is itself near-white. Keying out white globally would
 * punch holes straight through the lettering. Filling inward from the border
 * only removes background that is actually connected to the outside.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const [, , sourceArg, outputArg] = process.argv;

if (!sourceArg) {
  console.error("Usage: node scripts/make-logo.mjs <source-image> [output]");
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(sourceArg);
const output = path.resolve(outputArg ?? path.join(projectRoot, "public/logo.png"));

/** A pixel counts as background if every channel is this close to 255. */
const BACKGROUND_TOLERANCE = 18;
/** Pixels lighter than this, sitting against the background, get feathered. */
const FEATHER_FLOOR = 200;

const image = sharp(source).ensureAlpha();
const { data, info } = await image
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const at = (x, y) => (y * width + x) * channels;

// Background is either near-white, or already transparent — some exports
// arrive with the alpha already cut, and only need trimming.
const isBackground = (i, tolerance) =>
  data[i + 3] === 0 ||
  (255 - data[i] <= tolerance &&
    255 - data[i + 1] <= tolerance &&
    255 - data[i + 2] <= tolerance);

// ---------------------------------------------------------------------------
// Flood fill inward from every border pixel.
// ---------------------------------------------------------------------------
const background = new Uint8Array(width * height);
const stack = [];

const push = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = y * width + x;
  if (background[p]) return;
  if (!isBackground(at(x, y), BACKGROUND_TOLERANCE)) return;
  background[p] = 1;
  stack.push(x, y);
};

for (let x = 0; x < width; x++) {
  push(x, 0);
  push(x, height - 1);
}
for (let y = 0; y < height; y++) {
  push(0, y);
  push(width - 1, y);
}

while (stack.length) {
  const y = stack.pop();
  const x = stack.pop();
  push(x + 1, y);
  push(x - 1, y);
  push(x, y + 1);
  push(x, y - 1);
}

// ---------------------------------------------------------------------------
// Apply transparency, feathering the boundary so no white halo is left behind
// by the source image's anti-aliasing.
// ---------------------------------------------------------------------------
let cleared = 0;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = y * width + x;
    const i = at(x, y);

    if (background[p]) {
      data[i + 3] = 0;
      cleared++;
      continue;
    }

    const touchesBackground =
      (x > 0 && background[p - 1]) ||
      (x < width - 1 && background[p + 1]) ||
      (y > 0 && background[p - width]) ||
      (y < height - 1 && background[p + width]);

    if (!touchesBackground) continue;

    // How far this edge pixel is from pure white, as partial opacity.
    const lightest = Math.max(data[i], data[i + 1], data[i + 2]);
    if (lightest <= FEATHER_FLOOR) continue;

    const opacity = (255 - lightest) / (255 - FEATHER_FLOOR);
    data[i + 3] = Math.round(data[i + 3] * Math.min(1, opacity));
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png()
  // Drops the empty margin the source image carries, so the shield fills the
  // box it is given rather than floating in whitespace.
  .trim()
  .toFile(output);

const result = await sharp(output).metadata();

console.log(`source   ${width}x${height}  ${source}`);
console.log(`output   ${result.width}x${result.height}  ${output}`);
console.log(
  `cleared  ${cleared} background pixels (${((cleared / (width * height)) * 100).toFixed(1)}%)`,
);
