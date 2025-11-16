// authRoutes.js
const express = require('express');
const passport = require('passport');
const requireRole = require('../middleware/requireRole');
const { ensureAuth } = require('../helpers/auth'); // JWT middleware
const router = express.Router();

const {
  test,
  registerUser,
  loginUser,
  googleCallback,
  logoutUser,
  getAllUsers,
  updateUserRole,
  deleteUser,
  getProfile,
  changePassword,
  updateThemePreference, // ✅ added import
} = require('../controllers/authController');

// -------------------- Basic Routes --------------------
router.get('/', test);
router.post('/register', registerUser);
router.post('/login', loginUser);

// -------------------- Profile Route --------------------
router.get('/profile', getProfile);

// -------------------- Change Password --------------------
router.post('/change-password', ensureAuth, changePassword);

// -------------------- Theme Preference (Dark Mode) --------------------
router.put('/theme', ensureAuth, updateThemePreference); // ✅ new route

// -------------------- Logout --------------------
router.post('/logout', logoutUser);

// -------------------- Google OAuth2 Routes --------------------
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: 'http://localhost:5173/login',
    session: false,
  }),
  googleCallback
);

// -------------------- Admin-only Routes --------------------
router.get('/admin/users', ensureAuth, requireRole('admin'), getAllUsers);
router.put('/admin/users/:id/role', ensureAuth, requireRole('admin'), updateUserRole);
router.delete('/admin/users/:id', ensureAuth, requireRole('admin'), deleteUser);

module.exports = router;
