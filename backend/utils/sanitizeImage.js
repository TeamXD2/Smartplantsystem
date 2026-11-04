const sharp = require('sharp');

// Makes the copy of a photo that is shown to the public.
//
// A phone photo carries hidden metadata (EXIF): the GPS position it was taken at, the
// camera, the time. The public copy is decoded and encoded again, which drops all of it,
// so a visitor who saves a photo cannot read where a plant whose location is Hidden
// really grows. The original upload is kept untouched in the private bucket.
//
// The orientation is applied to the pixels first (rotate()), otherwise a portrait photo
// would turn sideways once its EXIF orientation tag is gone. Colour is converted to
// sRGB, which every browser shows correctly. Re-encoding also means a file that only
// looks like an image (a hostile file with a valid first few bytes) never reaches the public.

const MAX_BYTES = 5 * 1024 * 1024; // the public bucket's file size limit
// Refuses "decompression bombs": a tiny file that expands to a gigantic bitmap.
const MAX_PIXELS = 40 * 1000 * 1000;
const QUALITIES = [90, 80, 70, 60];

class ImageRejectedError extends Error {}

async function encode(buffer, type, quality) {
  const image = sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).rotate();
  if (type === 'image/jpeg') return image.jpeg({ quality }).toBuffer();
  if (type === 'image/webp') return image.webp({ quality }).toBuffer();
  return image.png({ compressionLevel: 9 }).toBuffer();
}

// buffer: the uploaded file, type: its real type from detectImageType().
// Returns { buffer, contentType } or throws ImageRejectedError with a message that is safe to show.
async function sanitizeImage(buffer, type) {
  // PNG has no quality setting, so it is encoded once.
  const qualities = type === 'image/png' ? [0] : QUALITIES;
  try {
    for (const quality of qualities) {
      const out = await encode(buffer, type, quality);
      if (out.length <= MAX_BYTES) {
        return { buffer: out, contentType: type };
      }
    }
  } catch {
    throw new ImageRejectedError('The image could not be read. Try another photo.');
  }
  throw new ImageRejectedError('The image is too large once processed. Try a smaller photo.');
}

module.exports = { sanitizeImage, ImageRejectedError };
