const rateLimit = require('express-rate-limit');

const sensitiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, //TODO - 10 or 5 // limit each IP to 100 requests per windowMs for sensitive operations
  message: 'Too many requests, try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { sensitiveRateLimit };
