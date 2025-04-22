// authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Owner registration
router.post('/register/owner', authController.registerOwner);

// Login for both owner and admin
router.post('/login', authController.login);

// Forget password - Send OTP
router.post('/forget-password', authController.forgetPassword);

// Reset password with OTP
router.post('/reset-password', authController.resetPassword);

module.exports = router;