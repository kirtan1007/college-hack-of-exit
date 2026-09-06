const express = require('express');
const router = express.Router();
const { login, logout, verifyToken } = require('../controllers/authController');
const { protectAdmin } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/logout', logout);
router.get('/verify', protectAdmin, verifyToken);

module.exports = router;
