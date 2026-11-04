require('dotenv').config();

// The web app addresses that may call this API from a browser (CORS_ORIGINS, comma-separated).
// Used by the CORS rule in server.js and by the Origin check for cookie sessions
// (middleware/auth.js), so both always agree.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

module.exports = { allowedOrigins };
