const pool = require('../db');
const { hashPassword, comparePassword } = require('../helpers/auth');
const jwt = require('jsonwebtoken');

// ✅ TEST
const test = (req, res) => {
  res.json('test is working');
};

// ✅ REGISTER
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name) return res.json({ error: 'Name is required' });
    if (!password || password.length < 6) {
      return res.json({ error: 'Password must be at least 6 characters' });
    }

    const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.json({ error: 'Email is already taken' });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await pool.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, hashedPassword, 'borrower', phone]
    );

    res.json(newUser.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ LOGIN
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userQuery.rows.length === 0) {
      return res.json({ error: 'No user found' });
    }

    const user = userQuery.rows[0];

    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.json({ error: 'Incorrect password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ GOOGLE OAUTH CALLBACK
const googleCallback = async (req, res) => {
  const { name, email } = req.user;

  try {
    let userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    let user;
    if (userQuery.rows.length === 0) {
      const newUser = await pool.query(
        'INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING *',
        [name, email, 'borrower']
      );
      user = newUser.rows[0];
    } else {
      user = userQuery.rows[0];
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect('http://localhost:5173/dashboard');
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.redirect('http://localhost:5173/login?error=Google login failed');
  }
};

// ✅ GET PROFILE
const getProfile = (req, res) => {
  const { token } = req.cookies;

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, {}, (err, user) => {
      if (err) return res.json(null);
      res.json(user);
    });
  } else {
    res.json(null);
  }
};

// ✅ LOGOUT
const logoutUser = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};

// ✅ Get all users (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role FROM users ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching users:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ Update user role
const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const allowedRoles = ['borrower', 'staff', 'admin'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role specified" });
  }

  try {
    const result = await pool.query(
      "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role",
      [role, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "Role updated", user: result.rows[0] });
  } catch (err) {
    console.error("Error updating role:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


// ✅ EXPORT CONTROLLERS
module.exports = {
  test,
  registerUser,
  loginUser,
  getProfile,
  googleCallback,
  logoutUser,
  getAllUsers,       // ✅ new
  updateUserRole,
};
