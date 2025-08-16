const express = require('express'); 
const dotenv = require('dotenv').config();
const cors = require('cors');
const passport = require('passport');
require('./passport'); // Import passport config
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const app = express();
const pool = require('./db');

// ✅ Connect to PostgreSQL
pool.connect()
  .then(client => {
    console.log('✅ Database connected successfully');
    client.release();
  })
  .catch(err => {
    console.error('❌ Failed to connect to the database:', err.message);
  });

// ✅ CORS Configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'], // ✅ allow both
  credentials: true,
}));

// ✅ Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

// ✅ Serve static uploads (for images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Serve QR codes publicly
app.use('/qr_codes', express.static(path.join(__dirname, 'public', 'qr_codes')));

// ✅ Session + Passport
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // secure: true only if you're using https
}));
app.use(passport.initialize());
app.use(passport.session());

// ✅ Routes
const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const borrowRoutes = require('./routes/borrowRoutes');
const reportRoutes = require('./routes/reportRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/reports', reportRoutes);

// ✅ Test endpoint
app.get('/api', (req, res) => {
  res.json({ message: 'API is working' });
});

// ✅ Start server
const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`🚀 Server is running on port ${port}`));
