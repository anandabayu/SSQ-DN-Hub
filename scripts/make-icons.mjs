/**
 * Generates the app icons from public/logo.png.
 *
 *   node scripts/make-icons.mjs
 *
 * The logo is a wide shield, but icons are square, so each one is contained in
 * a square canvas with a little breathing room rather than stretched.
 *
 * Browser icons keep a transparent background so they sit on light and dark
 * browser chrome alike. The Apple touch icon does not: iOS composites it onto
 * a white tile, and this logo's dark interior would disappear — so that one
 * gets the app's own background colour baked in.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const source = path.join(projectRoot, "public/logo.png");
const appDir = path.join(projectRoot, "src/app");

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
/** Matches --color-ink in globals.css. */
const INK = { r: 0x14, g: 0x12, b: 0x1a, alpha: 1 };

async function square(size, padding, background) {
  const inner = size - padding * 2;

  const logo = await sharp(source)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

// Browser tab / bookmarks. A single large PNG; browsers downscale it.
await sharp(await square(512, 24, TRANSPARENT)).toFile(
  path.join(appDir, "icon.png"),
);

// iOS home screen. Opaque, and Apple's own guidance is no transparency.
await sharp(await square(180, 14, INK)).toFile(
  path.join(appDir, "apple-icon.png"),
);

for (const file of ["icon.png", "apple-icon.png"]) {
  const meta = await sharp(path.join(appDir, file)).metadata();
  console.log(
    `${file.padEnd(16)} ${meta.width}x${meta.height}  alpha=${meta.hasAlpha}`,
  );
}
