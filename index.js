/* eslint-disable no-await-in-loop */
const { program } = require("commander");
const { lookup } = require("mrmime");
const { readdirSync, mkdirSync, existsSync } = require("fs");
const exifr = require("exifr");
const sharp = require("sharp");

const imageMimes = ["image/jpeg", "image/png"];
program
  .requiredOption("-d, --directory <string>", "directory to convert the files")
  .option("-q, --quality <number>", "starting quality", 80)
  .option("-x, --x-size <number>", "size of the X axis")
  .option("-y, --y-size <number>", "size of the Y axis");

program.parse(process.argv);

const { directory, xSize: xSizeStr, ySize: ySizeStr } = program.opts();
const xSize = !Number.isNaN(xSizeStr) ? +xSizeStr : undefined;
const ySize = !Number.isNaN(ySizeStr) ? +ySizeStr : undefined;

async function main() {
  // Create converted folder
  const isConvertedExist = existsSync(`${directory}/converted`);
  if (!isConvertedExist) {
    mkdirSync(`${directory}/converted`);
  }

  // Read all the files
  const files = readdirSync(directory);

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const originalFile = `${directory}/${file}`;
    const mime = lookup(originalFile);
    const isUnconvertedImage = imageMimes.includes(mime);
    if (!isUnconvertedImage) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const convertedFile = `${directory}/converted/${i}.webp`;

    let buf = await sharp(originalFile).toBuffer();
    const stat = await exifr.parse(originalFile);

    // Rotates
    if (stat && stat.Orientation) {
      const rotateMatch = stat.Orientation.match(/\d+/);
      if (rotateMatch) {
        const rotate = +rotateMatch[0];
        buf = await sharp(buf).rotate(rotate).toBuffer();
      }
    }

    // Resize
    if (xSize && ySize) {
      const { width, height } = await sharp(buf).metadata();
      const xRatio = xSize ? (xSize / width).toFixed(2) : Infinity;
      const yRatio = ySize ? (ySize / height).toFixed(2) : Infinity;
      const isXGreater = xRatio >= yRatio;
      buf = isXGreater
        ? await sharp(buf).resize(undefined, ySize).toBuffer()
        : await sharp(buf).resize(xSize).toBuffer();

      const { width: wAfter, height: hAfter } = await sharp(buf).metadata();
      const xSide = Math.round((xSize - wAfter) / 2);
      const ySide = Math.round((ySize - hAfter) / 2);

      buf = await sharp(buf)
        .png()
        .extend({
          top: ySide,
          bottom: ySide,
          left: xSide,
          right: xSide,
          background: { r: 1, g: 1, b: 1, alpha: 0 },
        })
        .toBuffer();
    }

    // Convert to webp
    buf = await sharp(buf)
      .webp({
        quality: 80,
      })
      .toBuffer();

    await sharp(buf).toFile(convertedFile);
  }
}

(async () => {
  await main();
})();
