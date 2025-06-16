const rateLimit = require('express-rate-limit');

const sensitiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10,
  message: 'Too many requests, try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { sensitiveRateLimit };
