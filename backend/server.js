const express = require('express');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(`Missing in .env: ${missingEnv.join(', ')} - refusing to start`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  const message = 'JWT_SECRET should be at least 32 random characters';
  if (process.env.NODE_ENV === 'production') {
    console.error(`${message} - refusing to start`);
    process.exit(1);
  }
  console.warn(`[security] ${message}. This is only a warning outside production.`);
}

const authRoutes = require('./routes/authRoutes');
const plantRoutes = require('./routes/plantRoutes');
const requestRoutes = require('./routes/requestRoutes');
const publicRoutes = require('./routes/publicRoutes');
const userRoutes = require('./routes/userRoutes');
const setupRoutes = require('./routes/setupRoutes');

const app = express();

app.disable('x-powered-by');

// Behind a reverse proxy / hosting platform every request would otherwise look
// like it comes from the proxy, which breaks the per-IP rate limits. Set
// TRUST_PROXY to the number of proxies in front of the backend (usually 1).
if (/^\d+$/.test(process.env.TRUST_PROXY || '')) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store'
  });
  next();
});

// Browsers only let the web app call this API from an origin listed here.
// (CORS is a browser rule: the mobile app, Postman and curl are not affected.)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // No Origin header = not a browser page (mobile app, Postman, curl).
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  maxAge: 600
}));

app.use(express.json({ limit: '100kb' }));

// The public endpoints need no login, so they get a per-IP limit to make
// scraping the whole catalog or guessing QR codes slow.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);         // Admin account management
app.use('/api/plants', plantRoutes);
app.use('/api/requests', requestRoutes);   // Edit/delete approval workflow
app.use('/api/public', publicLimiter, publicRoutes);      // No-login Park Visitor access
app.use('/api/setup', publicLimiter, setupRoutes);        // One-time first Admin creation (closed once an Admin exists)

app.get('/', (req, res) => {
  res.json({ message: 'Biodiversity System API is running' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Return JSON for errors (e.g. multer file too large / wrong type, malformed JSON)
// instead of Express's HTML page
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Only image files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Browser requests allowed from: ${allowedOrigins.join(', ')}`);
});
