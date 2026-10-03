const QRCode = require('qrcode');
const crypto = require('crypto');

// Generates a unique code string like "SFC-A1B2C3D4"
function generateQrCodeString() {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `SFC-${randomPart}`;
}

// Generates a QR code image (as a base64 data URL) for a given qr_code string.
// The mobile/web app prints or displays this image; scanning it just reads
// back the qr_code string, which is then looked up in the `plants` table.
async function generateQrCodeImage(qrCodeString) {
  return QRCode.toDataURL(qrCodeString);
}

module.exports = { generateQrCodeString, generateQrCodeImage };
