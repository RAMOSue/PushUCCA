const express = require('express');
const passport = require('passport');
const requireRole = require('../middleware/requireRole'); 
const router = express.Router();
const {
  test,
  registerUser,
  loginUser,
  getProfile,
  googleCallback,
  logoutUser,
  getAllUsers,
  updateUserRole
} = require('../controllers/authController');

// Basic Routes
router.get('/', test);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', getProfile);
router.post('/logout', logoutUser);

// Google OAuth2 Routes
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account', // ✅ Forces account selection
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

// ✅ Admin-only Routes
router.get('/admin/users', requireRole('admin'), getAllUsers);
router.put('/admin/users/:id/role', requireRole('admin'), updateUserRole);


module.exports = router;
