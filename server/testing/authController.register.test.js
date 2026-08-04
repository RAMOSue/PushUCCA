const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret';

const mockPool = {
  query: async (...args) => {
    const [queryText] = args;
    if (queryText.includes('SELECT * FROM users WHERE email')) {
      return { rows: [] };
    }
    if (queryText.includes('INSERT INTO users')) {
      return { rows: [{ id: 42, name: 'Test User', email: 'test@gmail.com', role: 'borrower', phone: '09123456789', is_verified: true }] };
    }
    if (queryText.includes('UPDATE users')) {
      return { rowCount: 1 };
    }
    return { rows: [] };
  },
};

const mockAuth = {
  hashPassword: async () => 'hashed-password',
  comparePassword: async () => true,
};

const mockVerificationService = {
  createVerificationToken: async () => ({ code: '123456' }),
  verifyEmailCode: async () => ({ success: true, userId: 42 }),
};

const mockEmailService = {
  sendVerificationEmail: async () => {},
};

const mockNotificationController = {
  resendPendingForUser: async () => {},
};

const controllerPath = require.resolve('../controllers/authController', { paths: [__dirname] });
const dbPath = require.resolve('../db', { paths: [__dirname] });
const authPath = require.resolve('../helpers/auth', { paths: [__dirname] });
const verificationPath = require.resolve('../services/verificationService', { paths: [__dirname] });
const emailPath = require.resolve('../utils/emailService', { paths: [__dirname] });
const notificationPath = require.resolve('../controllers/notificationController', { paths: [__dirname] });

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPool };
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: mockAuth };
require.cache[verificationPath] = { id: verificationPath, filename: verificationPath, loaded: true, exports: mockVerificationService };
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: mockEmailService };
require.cache[notificationPath] = { id: notificationPath, filename: notificationPath, loaded: true, exports: mockNotificationController };
delete require.cache[controllerPath];
const authController = require('../controllers/authController');

test('registerUser returns a token and logged-in user payload for new accounts', async () => {
  const req = {
    body: {
      name: 'Test User',
      email: 'test@gmail.com',
      password: 'Password1!',
      phone: '09123456789',
    },
  };

  const res = {
    cookie: () => {},
    status: () => res,
    json: (payload) => {
      res.payload = payload;
      return payload;
    },
  };

  const originalStatus = res.status;
  res.status = (code) => ({
    ...res,
    statusCode: code,
    json: (payload) => {
      res.payload = payload;
      return payload;
    },
  });

  await authController.registerUser(req, res);

  assert.ok(res.payload?.token, 'expected a token in the registration response');
  assert.ok(res.payload?.user, 'expected a user payload in the registration response');
  assert.equal(res.payload.user.email, 'test@gmail.com');
  assert.equal(res.payload.user.is_verified, true);
});
