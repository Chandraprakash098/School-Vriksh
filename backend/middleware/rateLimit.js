const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 payment requests per window
  message: 'Too many payment requests from this IP, please try again later.',
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many payment requests, please try again later.',
    });
  },
});

module.exports = { paymentRateLimiter };