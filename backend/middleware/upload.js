const multer = require('multer');

// Extension comes from the checked mimetype, never from the client's filename,
// so nobody can upload "evil.html" disguised as an image.
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

// Photos are kept in memory (req.file.buffer) only long enough to be sent
// to Supabase Storage by the controller - nothing is written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per photo
  fileFilter: (req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

module.exports = upload;
module.exports.MIME_TO_EXT = MIME_TO_EXT;
