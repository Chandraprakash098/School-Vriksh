// authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Owner registration
router.post('/register/owner', authController.registerOwner);

// Login for both owner and admin
router.post('/login', authController.login);

module.exports = router;