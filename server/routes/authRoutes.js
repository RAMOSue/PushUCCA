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
  verifyEmail,
  resendVerificationCode,
  googleCallback,
  logoutUser,
  getAllUsers,
  updateUserRole,
  updateUserDivision,
  deleteUser,
  getProfile,
  changePassword,
  updateThemePreference,
} = require('../controllers/authController');

// ========== BASIC ROUTES ==========
router.get('/', test);

// ========== REGISTRATION & EMAIL VERIFICATION ==========
// Step 1: Register user (creates account and sends verification code)
router.post('/register', registerUser);

// Step 2: Verify email with verification code
router.post('/verify-email', verifyEmail);

// Resend verification code
router.post('/resend-verification', resendVerificationCode);

// ========== LOGIN ==========
router.post('/login', loginUser);

// ========== PROFILE & ACCOUNT ==========
router.get('/profile', ensureAuth, getProfile);
router.post('/change-password', ensureAuth, changePassword);
router.put('/theme', ensureAuth, updateThemePreference);

// ========== LOGOUT ==========
router.post('/logout', logoutUser);

// ========== GOOGLE OAUTH2 ==========
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
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`,
    session: false,
  }),
  googleCallback
);

// ========== ADMIN ROUTES ==========
router.get('/admin/users', ensureAuth, requireRole('admin'), getAllUsers);
router.put('/admin/users/:id/role', ensureAuth, requireRole('admin'), updateUserRole);
router.put('/admin/users/:id/division', ensureAuth, requireRole('admin'), updateUserDivision);
router.delete('/admin/users/:id', ensureAuth, requireRole('admin'), deleteUser);

// ========== STAFF ROUTES ==========
// Get all borrowers/performers (for staff to select in performance scheduling)
router.get('/borrowers', ensureAuth, getAllUsers);

module.exports = router;
