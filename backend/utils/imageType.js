// Works out what an uploaded file really is from its first bytes, instead of
// trusting the type the client claims. A file that says "image/png" but is
// really HTML or an executable is refused.
//
// Only the file *type* is checked here. The photo itself is stored exactly as
// uploaded: EXIF metadata (including GPS) is deliberately kept.

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  // WebP: "RIFF" <4 bytes size> "WEBP"
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

module.exports = { detectImageType };
