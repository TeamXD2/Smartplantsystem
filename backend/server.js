const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(`Missing in .env: ${missingEnv.join(', ')} - refusing to start`);
  process.exit(1);
}

const authRoutes = require('./routes/authRoutes');
const plantRoutes = require('./routes/plantRoutes');
const requestRoutes = require('./routes/requestRoutes');
const publicRoutes = require('./routes/publicRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);         // Admin account management
app.use('/api/plants', plantRoutes);
app.use('/api/requests', requestRoutes);   // Edit/delete approval workflow
app.use('/api/public', publicRoutes);      // No-login Park Visitor access

app.get('/', (req, res) => {
  res.json({ message: 'Biodiversity System API is running' });
});

// Return JSON for errors (e.g. multer file too large / wrong type) instead of Express's HTML page
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Only image files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
