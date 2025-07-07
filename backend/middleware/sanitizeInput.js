const xss = require('xss');
const validator = require('validator'); // Make sure you have 'validator' installed: npm install validator

function sanitizeInput(req, res, next) {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // First escape HTML entities, then apply XSS protection
      return xss(validator.escape(value.trim()));
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = {};
    Object.keys(obj).forEach(key => {
      // Validate key names to prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return;
      }
      sanitized[key] = Array.isArray(obj[key])
        ? obj[key].map(sanitizeValue)
        : sanitizeValue(obj[key]);
    });
    return sanitized;
  };

  // Sanitize body, query, and params
  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);

  next();
}

module.exports = sanitizeInput;
