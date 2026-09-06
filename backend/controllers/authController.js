const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Please provide username and password' });
  }

  try {
    const admin = await AdminUser.findOne({ username });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET || 'supersecretjwtkeyforhacktheexit',
      { expiresIn: '12h' }
    );

    // Set cookie
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    return res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      admin: { username: admin.username }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

const logout = (req, res) => {
  res.clearCookie('adminToken');
  return res.json({ success: true, message: 'Logged out successfully' });
};

const verifyToken = (req, res) => {
  // If request hits here, protectAdmin middleware passed, so they are logged in
  return res.json({ success: true, admin: req.admin });
};

module.exports = { login, logout, verifyToken };
