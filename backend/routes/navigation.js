const express = require('express');
const router = express.Router();
const validator = require("validator");
const xss = require("xss");

// Session validation middleware (copied from other files for self-containment)
const requireSession = (req, res, next) => {
  if (!req.session || !req.session.id) {
    return res.status(401).json({
      error: "Session required",
      code: "SESSION_REQUIRED"
    });
  }
  next();
};

// Input sanitization middleware (copied from other files for self-containment)
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return xss(validator.escape(value.trim()));
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = {};
    Object.keys(obj).forEach(key => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return;
      }
      sanitized[key] = Array.isArray(obj[key])
        ? obj[key].map(sanitizeValue)
        : sanitizeValue(obj[key]);
    });
    return sanitized;
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);

  next();
};

// Define routes accessible by different roles
const routesByRole = {
  employee: [
    // // Auth routes (employee specific)
    // '/auth/emp',         // Get own details
    // '/auth/update',      // Update own details
    // '/auth/update_pass', // Change own password
    // '/auth/validatePin', // Validate PIN for operations
    // '/auth/logout',      // Logout

    // // Card routes (employee specific - assuming they can perform these actions)
    // '/card/recharge',        // Recharge customer cards
    // '/card/start-session',   // Start game sessions (deduct balance)
    // '/card/check-card',      // Check card details
    // '/card/transactions/:card', // View specific card's transaction history
    // '/card/details/:card',   // View specific card's details (masked for sensitive info)

    // // Games routes (employee specific)
    // '/games/gamedetails',      // Get details of a specific game
    // '/games/gameList',         // Get list of all games
    // '/games/start-game-signal', // Signal start of arcade game
    // '/games/stop-game-signal'   // Signal stop of arcade game
    '/scan',
    '/recharge',
    '/add'
  ],
  manager: [
    // Auth routes
    // '/auth/emp',
    // '/auth/update',
    // '/auth/update_pass',
    // '/auth/validatePin',
    // '/auth/logout',

    // // Card routes
    // '/card/issue',           // Issue new cards
    // '/card/recharge',
    // '/card/start-session',
    // '/card/check-card',
    // '/card/transactions/:card',
    // '/card/update/:card',    // Update card details
    // '/card/status/:card',    // Change card status (block/unblock)
    // '/card/details/:card',

    // Games routes
    // '/games/add',              // Add new games
    // '/games/update',           // Update game details
    // '/games/delete',           // Delete games
    // '/games/gamedetails',
    // '/games/gameList',
    // '/games/stats',            // Get game statistics
    // '/games/bulk-update',      // Bulk update games
    // '/games/start-game-signal',
    // '/games/stop-game-signal',

    '/admin',
    '/admin/reports',
    '/admin/emps',
    '/admin/updateEmp',
    '/admin/games',
    '/admin/addgames',
    '/admin/updategame',
    '/admin/history',
    '/admin/transactions',
    'register'
  ],
  admin: [
    '/admin/transactions',

    '/admin',
    '/admin/reports',
    '/admin/emps',
    '/admin/updateEmp',
    '/admin/games',
    '/admin/addgames',
    '/admin/updategame',
    '/admin/history',
    '/register'
  ]
};

// Endpoint to dynamically get routes based on user role
router.get('/checkRoutes', requireSession, sanitizeInput, (req, res) => {
  const role = req.session && req.session.userRole; // Get role from session
  const routes = routesByRole[role] || [];
  res.status(200).json({ routes, role, sessionId: req.session.id });
});

module.exports = router;
