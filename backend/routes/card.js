const express = require("express");
const { Op } = require('sequelize'); // Import Op for Sequelize queries
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");
const xss = require("xss");
const { sensitiveRateLimit } = require('../middleware/rateLimit'); // Keep custom rate limit if needed
require("dotenv").config();

// Import models
const { Customer, Employee, Games, Transaction, TransactionHistory, Sessions } = require("../models"); // Import all necessary models
const sequelize = require('../config/db').sequelize; // Import sequelize instance for transactions

const router = express.Router();

// Rate limiting middleware - Different limits for different operations
const cardRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many card requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for financial operations
const financialRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit financial operations
  message: { error: "Too many financial requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});


// Apply rate limiting and security headers to all routes in this file
router.use(cardRateLimit);
router.use(helmet());

// Session validation middleware
const requireSession = (req, res, next) => {
  if (!req.session || !req.session.id) {
    return res.status(401).json({
      error: "Session required",
      code: "SESSION_REQUIRED"
    });
  }
  next();
};

// Role-based access control middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // Ensure req.session and req.session.userRole exist before checking
    if (!req.session || !req.session.userRole || !allowedRoles.includes(req.session.userRole)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
        requiredRoles: allowedRoles
      });
    }
    next();
  };
};

// Enhanced input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // First escape HTML entities, then apply XSS protection
      return xss(validator.escape(value.trim()));
    }
    if (typeof value === 'number') {
      return value;
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
};


// Enhanced validation helpers
const validateCardData = (data, isUpdate = false) => {
  const errors = [];

  // Mobile validation
  if (!isUpdate || data.mobile !== undefined) {
    if (!data.mobile || !validator.isMobilePhone(data.mobile.toString(), 'any', { strictMode: false })) {
      errors.push("Valid mobile number is required (10-15 digits)");
    }
  }

  // Name validation with enhanced checks
  if (!isUpdate || data.name !== undefined) {
    if (!data.name || !validator.isLength(data.name, { min: 2, max: 50 })) {
      errors.push("Name must be between 2 and 50 characters");
    }
    if (data.name && !validator.matches(data.name, /^[a-zA-Z\s.'-]+$/)) {
      errors.push("Name contains invalid characters");
    }
  }

  // Balance validation (only for initial balance in create, not for updates directly here)
  if (!isUpdate || data.initialBalance !== undefined) { // Changed from 'balance' to 'initialBalance' for new card issue
    if (data.initialBalance == null || !validator.isFloat(data.initialBalance.toString(), { min: 0 })) {
      errors.push("Valid initial balance amount is required (minimum 0)");
    }
    if (data.initialBalance && parseFloat(data.initialBalance) > 50000) {
      errors.push("Initial balance cannot exceed ₹50,000");
    }
  }

  // Card number validation
  if (!isUpdate || data.card !== undefined) {
    if (!data.card || !validator.isLength(data.card.toString(), { min: 6, max: 20 })) {
      errors.push("Card number must be between 6 and 20 characters");
    }
    if (data.card && !validator.isAlphanumeric(data.card.toString())) {
      errors.push("Card number must contain only letters and numbers");
    }
  }

  // User ID validation (for employee performing action)
  if (!isUpdate || data.empId !== undefined) { // Changed from 'userID' to 'empId'
    if (!data.empId || !validator.isNumeric(data.empId.toString())) {
      errors.push("Valid employee ID is required");
    }
  }

  // PIN validation (for employee authentication)
  if (!isUpdate || data.pin !== undefined) {
    if (!data.pin || !validator.isLength(data.pin.toString(), { min: 4, max: 6 })) {
      errors.push("PIN must be between 4 and 6 characters");
    }
    if (data.pin && !validator.isNumeric(data.pin.toString())) {
      errors.push("PIN must contain only numbers");
    }
  }

  // Address validation
  if (!isUpdate || data.address !== undefined) {
    if (!data.address || !validator.isLength(data.address, { min: 10, max: 200 })) {
      errors.push("Address must be between 10 and 200 characters");
    }
  }

  // Payment method validation
  if (!isUpdate || data.type !== undefined) { // Changed from 'method' to 'type' as per Transaction model
    if (!data.type || !['cash', 'online'].includes(data.type.toLowerCase())) { // Transaction model uses 'cash' or 'online'
      errors.push("Payment method must be CASH or ONLINE");
    }
  }

  // UTR validation for online payments
  if (data.type && data.type.toLowerCase() === 'online') {
    if (!data.utr || !validator.isLength(data.utr, { min: 10, max: 25 })) {
      errors.push("Valid UTR (10-25 characters) is required for online payments");
    }
    if (data.utr && !validator.isAlphanumeric(data.utr)) {
      errors.push("UTR must contain only letters and numbers");
    }
  }

  return errors;
};

// Recharge amount validation
const validateRechargeData = (data) => {
  const errors = [];

  if (!data.card || !validator.isAlphanumeric(data.card.toString())) {
    errors.push("Valid card number is required");
  }

  if (data.recharge == null || !validator.isFloat(data.recharge.toString(), { min: 1, max: 10000 })) {
    errors.push("Recharge amount must be between ₹1 and ₹10,000");
  }

  if (!data.empId || !validator.isNumeric(data.empId.toString())) { // Changed from 'userID' to 'empId'
    errors.push("Valid employee ID is required");
  }

  if (!data.type || !['cash', 'online'].includes(data.type.toLowerCase())) { // Changed from 'method' to 'type'
    errors.push("Valid payment method is required (CASH or ONLINE)");
  }

  if (!data.pin || !validator.isNumeric(data.pin.toString()) || !validator.isLength(data.pin.toString(), { min: 4, max: 6 })) {
    errors.push("Valid 4-6 digit PIN is required");
  }

  if (data.type && data.type.toLowerCase() === 'online') {
    if (!data.utr || !validator.isLength(data.utr, { min: 10, max: 25 })) {
      errors.push("Valid UTR is required for online payments");
    }
  }

  return errors;
};

// API to issue a card to a Customer
router.post("/issue", requireSession, requireRole(['Admin', 'Manager']), sanitizeInput, async (req, res) => {
  const { mobile, name, initialBalance, card, empId, pin, address, type, utr } = req.body; // Changed 'balance' to 'initialBalance', 'userID' to 'empId', 'method' to 'type'

  try {
    // Validate input data
    const validationErrors = validateCardData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors,
        code: "VALIDATION_ERROR"
      });
    }

    // Store operation in session for audit trail
    req.session.lastOperation = {
      type: 'card_issue',
      timestamp: new Date().toISOString(),
      userID: req.session.userID, // Use session's userID for audit
      card: card,
      amount: parseFloat(initialBalance)
    };

    // Employee authentication with PIN
    const employee = await Employee.findOne({ where: { userID: empId, status: 'active' } }); // Use userID for Employee model
    if (!employee) {
        return res.status(404).json({ error: "Employee not found or inactive", code: "EMPLOYEE_NOT_FOUND" });
    }
    const isPinValid = await Employee.verifyOTP(employee.mobile, pin); // Use Employee's verifyOTP method
    if (!isPinValid) {
        req.session.securityIncidents = req.session.securityIncidents || [];
        req.session.securityIncidents.push({
            type: 'invalid_pin_card_issue',
            timestamp: new Date().toISOString(),
            userID: empId,
            attemptedCard: card
        });
        return res.status(401).json({ error: "Invalid PIN. Card issuance not authorized.", code: "INVALID_PIN" });
    }

    // Check if card number already exists
    const existingCard = await Customer.findOne({ where: { card } }); // Use Customer model
    if (existingCard) {
        return res.status(409).json({ error: "Card number already exists in the system", code: "DUPLICATE_CARD" });
    }

    // Check if mobile number already has a card
    const existingMobile = await Customer.findOne({ where: { mobile } }); // Use Customer model
    if (existingMobile) {
        return res.status(409).json({ error: "Mobile number already has a card registered", code: "DUPLICATE_MOBILE" });
    }

    // Use Customer.createNewCard method for creating customer and logging transaction
    const newCustomer = await Customer.createNewCard({
        name,
        card,
        initialBalance: parseFloat(initialBalance),
        empId: employee.id, // Pass internal employee ID to model method
        type: type.toLowerCase(),
        phone: mobile,
        email: null, // Assuming no email for now, or add to request body
        address // Pass address
    });

    res.status(201).json({
      status: 1001,
      message: "Card issued successfully",
      data: {
        customerId: newCustomer.id,
        card: newCustomer.card,
        initialBalance: parseFloat(newCustomer.balance),
        issuedBy: employee.userID, // Return employee's public userID
        issuedAt: newCustomer.created_at,
        customerName: newCustomer.name
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Card issuance error:", {
      error: error.message,
      userID: empId,
      card: card,
      timestamp: new Date().toISOString()
    });

    const statusCode = error.message.includes("Invalid PIN") ? 401 :
                      error.message.includes("already exists") || error.message.includes("already registered") ? 409 :
                      error.message.includes("not found") ? 404 : 500;

    res.status(statusCode).json({
      error: error.message || "Card issuance failed",
      code: "CARD_ISSUE_ERROR",
      success: false
    });
  }
});

// API to recharge a card
router.post("/recharge", requireSession, requireRole(['Admin', 'Manager', 'Cashier']), financialRateLimit, sanitizeInput, async (req, res) => {
  const { card, recharge, empId, type, pin, utr } = req.body; // Changed 'userID' to 'empId', 'method' to 'type'

  try {
    // Validate recharge data
    const validationErrors = validateRechargeData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors,
        code: "VALIDATION_ERROR"
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'card_recharge',
      timestamp: new Date().toISOString(),
      userID: req.session.userID,
      card: card,
      amount: parseFloat(recharge)
    };

    // Employee authentication with PIN
    const employee = await Employee.findOne({ where: { userID: empId, status: 'active' } }); // Use userID for Employee model
    if (!employee) {
        return res.status(404).json({ error: "Employee not found or inactive", code: "EMPLOYEE_NOT_FOUND" });
    }
    const isPinValid = await Employee.verifyOTP(employee.mobile, pin); // Use Employee's verifyOTP method
    if (!isPinValid) {
        req.session.securityIncidents = req.session.securityIncidents || [];
        req.session.securityIncidents.push({
            type: 'invalid_pin_recharge',
            timestamp: new Date().toISOString(),
            userID: empId,
            card: card
        });
        return res.status(401).json({ error: "Invalid employee credentials or PIN", code: "INVALID_PIN" });
    }

    // Find customer by card to get customer_id
    const customer = await Customer.findByCard(card); // Use Customer.findByCard
    if (!customer || customer.status !== 'active') {
        return res.status(404).json({ error: "Card not found or inactive", code: "CARD_NOT_FOUND" });
    }

    const currentBalance = parseFloat(customer.balance);
    const rechargeAmount = parseFloat(recharge);
    const newBalance = currentBalance + rechargeAmount;

    // Check maximum balance limit
    if (newBalance > 50000) {
        return res.status(400).json({ error: "Recharge would exceed maximum balance limit of ₹50,000", code: "BALANCE_EXCEEDS_LIMIT" });
    }

    // Use Customer.updateBalance method for updating balance and logging transaction
    const updatedCustomer = await Customer.updateBalance(
        customer.id, // Pass internal customer ID
        rechargeAmount,
        employee.id, // Pass internal employee ID
        type.toLowerCase(),
        'recharge'
    );

    res.status(200).json({
      status: 1001,
      message: "Card recharged successfully",
      data: {
        card: card,
        rechargeAmount: rechargeAmount,
        previousBalance: currentBalance,
        newBalance: parseFloat(updatedCustomer.balance),
        customerName: updatedCustomer.name,
        rechargedBy: employee.userID,
        rechargedAt: updatedCustomer.updated_at
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Recharge error:", {
      error: error.message,
      userID: empId,
      card: card,
      amount: recharge,
      timestamp: new Date().toISOString()
    });

    const statusCode = error.message.includes("Invalid") ? 401 :
                      error.message.includes("not found") ? 404 :
                      error.message.includes("exceed") ? 400 : 500;

    res.status(statusCode).json({
      error: error.message || "Recharge failed",
      code: "RECHARGE_ERROR",
      success: false
    });
  }
});

// API to start a game session (deduct balance from a card)
router.post("/start-session", requireSession, requireRole(['Admin', 'Manager', 'Cashier']), financialRateLimit, sanitizeInput, async (req, res) => {
  const { card, empId, game_id, sessionTime } = req.body; // Added sessionTime for flexibility

  try {
    // Validation
    const errors = [];

    if (!card || !validator.isAlphanumeric(card.toString())) {
      errors.push("Valid card number is required");
    }

    if (!game_id || !validator.isNumeric(game_id.toString())) {
      errors.push("Valid game ID is required");
    }

    if (!empId || !validator.isNumeric(empId.toString())) {
      errors.push("Valid employee ID is required");
    }

    if (sessionTime !== undefined && (!validator.isNumeric(sessionTime.toString()) || parseInt(sessionTime) <= 0)) {
        errors.push("Session time must be a positive number in minutes if provided.");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
        code: "VALIDATION_ERROR"
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'game_session_start',
      timestamp: new Date().toISOString(),
      userID: req.session.userID,
      card: card,
      gameId: game_id,
      sessionTime: sessionTime
    };

    // Find customer by card to get customer_id
    const customer = await Customer.findByCard(card); // Use Customer.findByCard
    if (!customer || customer.status !== 'active') {
        return res.status(404).json({ error: "Card not found or inactive", code: "CARD_NOT_FOUND" });
    }

    // Find employee by userID to get empId for the session
    const employee = await Employee.findOne({ where: { userID: empId, status: 'active' } }); // Use userID for Employee model
    if (!employee) {
        return res.status(404).json({ error: "Employee not found or inactive", code: "EMPLOYEE_NOT_FOUND" });
    }

    // Use Customer.startGameSession method to handle session creation and balance deduction
    const sessionDetails = await Customer.startGameSession(
        customer.id, // Pass internal customer ID
        game_id,
        employee.id, // Pass internal employee ID
        sessionTime ? parseInt(sessionTime) : undefined // Pass sessionTime if provided
    );

    res.status(200).json({
      status: 1001,
      message: "Game session started successfully",
      data: {
        sessionId: sessionDetails.id,
        customerName: sessionDetails.customer.name,
        gameName: sessionDetails.game.game_name,
        plannedDuration: sessionDetails.planned_duration,
        finalCharge: parseFloat(sessionDetails.final_charge),
        currentBalance: parseFloat(sessionDetails.customer.balance),
        startedBy: sessionDetails.StartedBy.name,
        startTime: sessionDetails.start_time
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Start session error:", {
      error: error.message,
      userID: empId,
      card: card,
      gameId: game_id,
      timestamp: new Date().toISOString()
    });

    const statusCode = error.message.includes("not found") ? 404 :
                      error.message.includes("Insufficient") ? 400 :
                      error.message.includes("not active") || error.message.includes("not available") ? 400 : 500;

    res.status(statusCode).json({
      error: error.message || "Failed to start game session",
      code: "START_SESSION_ERROR",
      success: false
    });
  }
});


// API to check if a card exists and get details
router.post("/check-card", requireSession, sanitizeInput, async (req, res) => {
  const { card, role } = req.body;

  try {
    // Validation
    if (!card || !validator.isLength(card.toString(), { min: 6, max: 20 }) || !validator.isAlphanumeric(card.toString())) {
      return res.status(400).json({
        error: "Valid card number is required (6-20 alphanumeric characters)",
        code: "VALIDATION_ERROR"
      });
    }

    if (!role || !['Admin', 'Manager', 'Employee', 'Cashier'].includes(role)) {
      return res.status(400).json({
        error: "Valid role is required",
        code: "VALIDATION_ERROR"
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'card_lookup',
      timestamp: new Date().toISOString(),
      card: card,
      role: role
    };

    // Use Customer.findByCard to get customer details
    const customer = await Customer.findByCard(card);

    if (!customer || customer.status !== 'active') {
      return res.status(202).json({
        status: 1003,
        route: "AddCard",
        message: "Card not found in the system or inactive",
        sessionId: req.session.id,
        success: false
      });
    }

    // Mask sensitive information based on role
    let responseData = {
      customerId: customer.id,
      customerName: customer.name,
      balance: parseFloat(customer.balance),
      createdAt: customer.created_at,
      lastTransaction: customer.updated_at, // No explicit last_transaction field, use updated_at
      status: customer.status
    };

    // Role-based data access control
    if (['Admin', 'Manager'].includes(role)) {
      // Full access for admin and manager
      responseData.customerMobile = customer.phone; // Use 'phone' from Customer model
      responseData.customerAddress = customer.address; // Use 'address' from Customer model
    } else {
      // Masked data for other roles
      let maskedMobile = customer.phone?.toString() || '';
      if (maskedMobile.length > 6) {
        maskedMobile = maskedMobile.substring(0, 3) +
                     "*".repeat(maskedMobile.length - 6) +
                     maskedMobile.substring(maskedMobile.length - 3);
      }
      responseData.customerMobile = maskedMobile;
      // Don't include address for lower privilege roles
    }

    // Determine route based on role
    const routeMap = {
      'Admin': 'AdminDashboard',
      'Manager': 'ManagerDashboard',
      'Employee': 'RechargeScreen',
      'Cashier': 'RechargeScreen'
    };

    res.status(200).json({
      status: 1001,
      route: routeMap[role] || 'RechargeScreen',
      message: "Card found successfully",
      data: responseData,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Check card error:", {
      error: error.message,
      card: card,
      role: role,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: "Unable to process card lookup",
      code: "LOOKUP_ERROR",
      success: false
    });
  }
});

// Get card transaction history
router.get("/transactions/:card", requireSession, requireRole(['Admin', 'Manager', 'Cashier']), sanitizeInput, async (req, res) => {
  const { card } = req.params;
  const { page, limit, type, startDate, endDate } = req.query;

  try {
    // Validate card parameter
    if (!card || !validator.isAlphanumeric(card)) {
      return res.status(400).json({
        error: "Valid card number is required",
        code: "VALIDATION_ERROR"
      });
    }

    // Pagination parameters
    const pageNum = page && validator.isNumeric(page.toString()) ? parseInt(page) : 1;
    const limitNum = limit && validator.isNumeric(limit.toString()) ? Math.min(parseInt(limit), 100) : 20;
    const offset = (pageNum - 1) * limitNum;

    // Find customer by card to get customer_id
    const customer = await Customer.findByCard(card); // Use Customer.findByCard
    if (!customer) {
        return res.status(404).json({ error: "Card not found.", code: "CARD_NOT_FOUND" });
    }

    // Build query conditions for TransactionHistory model
    const whereClause = { customer_id: customer.id };
    if (type && ['recharge', 'new_card', 'game_session', 'refund'].includes(type.toLowerCase())) { // Align with TransactionHistory transaction_type enum
      whereClause.transaction_type = type.toLowerCase();
    }

    // Date range filtering
    if (startDate && validator.isISO8601(startDate) && endDate && validator.isISO8601(endDate)) {
        whereClause.created_at = {
            [Op.between]: [new Date(startDate), new Date(endDate)]
        };
    } else if (startDate && validator.isISO8601(startDate)) {
        whereClause.created_at = {
            [Op.gte]: new Date(startDate)
        };
    } else if (endDate && validator.isISO8601(endDate)) {
        whereClause.created_at = {
            [Op.lte]: new Date(endDate)
        };
    }


    // Store operation in session
    req.session.lastOperation = {
      type: 'transaction_history',
      timestamp: new Date().toISOString(),
      card: card
    };

    // Get total count using TransactionHistory model
    const totalTransactions = await TransactionHistory.count({ where: whereClause });

    // Get transactions with details using TransactionHistory model
    const transactions = await TransactionHistory.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: limitNum,
        offset: offset,
        include: [
            {
                model: Employee,
                as: 'employee', // Alias defined in associations
                attributes: ['name', 'userID']
            },
            {
                model: Games,
                as: 'game', // Alias defined in associations
                attributes: ['game_name'],
                required: false
            },
            {
                model: Sessions,
                as: 'session', // Alias defined in associations
                attributes: ['id', 'status', 'start_time', 'end_time'],
                required: false
            }
        ]
    });

    // Format response
    const formattedTransactions = transactions.map(txn => ({
      transactionId: txn.id, // Use 'id' from model
      amount: parseFloat(txn.amount),
      type: txn.transaction_type, // Use 'transaction_type'
      timestamp: txn.created_at,
      remarks: txn.notes, // Use 'notes' for remarks
      method: txn.type, // Use 'type' for payment method
      status: txn.status,
      previousBalance: parseFloat(txn.balance_before),
      newBalance: parseFloat(txn.balance_after),
      employeeName: txn.employee ? txn.employee.name : null,
      gameName: txn.game ? txn.game.game_name : null,
      sessionId: txn.session_id,
      sessionStatus: txn.session ? txn.session.status : null
    }));

    const totalPages = Math.ceil(totalTransactions / limitNum);

    res.status(200).json({
      message: "Transaction history retrieved successfully",
      data: {
        transactions: formattedTransactions,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalTransactions,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Transaction history error:", {
      error: error.message,
      card: card,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: "Failed to retrieve transaction history",
      code: "HISTORY_ERROR",
      success: false
    });
  }
});

// API to update card details (Admin/Manager only)
router.put("/update/:card", requireSession, requireRole(['Admin', 'Manager']), sanitizeInput, async (req, res) => {
  const { card } = req.params;
  const { name, mobile, address, status, pin, empId } = req.body; // Changed 'userID' to 'empId'

  try {
    // Validate card parameter
    if (!card || !validator.isAlphanumeric(card)) {
      return res.status(400).json({
        error: "Valid card number is required",
        code: "VALIDATION_ERROR"
      });
    }

    // Validate employee credentials for authorization
    if (!empId || !pin) {
      return res.status(400).json({
        error: "Employee credentials required for card updates",
        code: "AUTHORIZATION_REQUIRED"
      });
    }

    // Validate update data (using existing validation function with isUpdate flag)
    const validationErrors = validateCardData(req.body, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors,
        code: "VALIDATION_ERROR"
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'card_update',
      timestamp: new Date().toISOString(),
      userID: req.session.userID,
      card: card
    };

    // Employee authentication with PIN
    const employee = await Employee.findOne({ where: { userID: empId, status: 'active' } }); // Use userID for Employee model
    if (!employee) {
        return res.status(404).json({ error: "Employee not found or inactive", code: "EMPLOYEE_NOT_FOUND" });
    }
    const isPinValid = await Employee.verifyOTP(employee.mobile, pin); // Use Employee's verifyOTP method
    if (!isPinValid) {
        req.session.securityIncidents = req.session.securityIncidents || [];
        req.session.securityIncidents.push({
            type: 'invalid_pin_card_update',
            timestamp: new Date().toISOString(),
            userID: empId,
            card: card
        });
        return res.status(401).json({ error: "Invalid employee credentials or PIN", code: "INVALID_PIN" });
    }

    // Find customer to update
    const customer = await Customer.findByCard(card); // Use Customer.findByCard
    if (!customer) {
        return res.status(404).json({ error: "Card not found in the system", code: "CARD_NOT_FOUND" });
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (mobile !== undefined) {
        // Check for duplicate mobile only if mobile is being updated
        const existingMobile = await Customer.findOne({ where: { phone: mobile, id: { [Op.ne]: customer.id } } });
        if (existingMobile) {
            return res.status(409).json({ error: "Mobile number already registered to another card", code: "DUPLICATE_MOBILE" });
        }
        updateFields.phone = mobile; // Use 'phone' for mobile in Customer model
    }
    if (address !== undefined) updateFields.address = address;
    if (status !== undefined && ['active', 'inactive', 'blocked'].includes(status)) {
      updateFields.status = status;
    }

    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ error: "No valid fields provided for update", code: "NO_FIELDS_PROVIDED" });
    }

    // Perform the update using the Customer model
    const [updatedRowsCount] = await Customer.update(updateFields, { where: { card } });

    if (updatedRowsCount === 0) {
        throw new Error("Failed to update card details, possibly no changes or card not found.");
    }

    // Reload the customer to get updated data for response
    const updatedCustomer = await Customer.findByCard(card);

    // TODO: Implement CardAuditLog equivalent using TransactionHistory or a new model if needed.
    // For now, logging to console as per the spirit of audit logging.
    console.log(`Card ${card} updated by Employee ${employee.name} (ID: ${empId}). Old data: ${JSON.stringify(customer.toJSON())}, New data: ${JSON.stringify(updatedCustomer.toJSON())}`);


    res.status(200).json({
      status: 1001,
      message: "Card details updated successfully",
      data: {
        card: updatedCustomer.card,
        updatedFields: Object.keys(updateFields),
        updatedBy: employee.userID,
        updatedAt: updatedCustomer.updated_at,
        newDetails: {
            name: updatedCustomer.name,
            mobile: updatedCustomer.phone,
            address: updatedCustomer.address,
            status: updatedCustomer.status
        }
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Card update error:", {
      error: error.message,
      userID: empId,
      card: card,
      timestamp: new Date().toISOString()
    });

    const statusCode = error.message.includes("Invalid") ? 401 :
                      error.message.includes("not found") ? 404 :
                      error.message.includes("already registered") ? 409 : 500;

    res.status(statusCode).json({
      error: error.message || "Card update failed",
      code: "UPDATE_ERROR",
      success: false
    });
  }
});

// API to block/unblock a card
router.patch("/status/:card", requireSession, requireRole(['Admin', 'Manager']), sensitiveRateLimit, sanitizeInput, async (req, res) => {
  const { card } = req.params;
  const { status, reason, empId, pin } = req.body; // Changed 'userID' to 'empId'

  try {
    // Validation
    if (!card || !validator.isAlphanumeric(card)) {
      return res.status(400).json({
        error: "Valid card number is required",
        code: "VALIDATION_ERROR"
      });
    }

    if (!status || !['active', 'blocked', 'inactive'].includes(status)) {
      return res.status(400).json({
        error: "Valid status is required (active, blocked, inactive)",
        code: "VALIDATION_ERROR"
      });
    }

    if (!empId || !pin) {
      return res.status(400).json({
        error: "Employee credentials required for status changes",
        code: "AUTHORIZATION_REQUIRED"
      });
    }

    if (!reason || !validator.isLength(reason, { min: 5, max: 200 })) {
      return res.status(400).json({
        error: "Reason for status change is required (5-200 characters)",
        code: "VALIDATION_ERROR"
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'card_status_change',
      timestamp: new Date().toISOString(),
      userID: req.session.userID,
      card: card,
      newStatus: status
    };

    // Employee authentication with PIN
    const employee = await Employee.findOne({ where: { userID: empId, status: 'active' } }); // Use userID for Employee model
    if (!employee) {
        return res.status(404).json({ error: "Employee not found or inactive", code: "EMPLOYEE_NOT_FOUND" });
    }
    const isPinValid = await Employee.verifyOTP(employee.mobile, pin); // Use Employee's verifyOTP method
    if (!isPinValid) {
        req.session.securityIncidents = req.session.securityIncidents || [];
        req.session.securityIncidents.push({
            type: 'invalid_pin_status_change',
            timestamp: new Date().toISOString(),
            userID: empId,
            card: card,
            attemptedStatus: status
        });
        return res.status(401).json({ error: "Invalid employee credentials or PIN", code: "INVALID_PIN" });
    }

    // Find customer and update status using Customer model
    const customer = await Customer.findByCard(card); // Use Customer.findByCard
    if (!customer) {
        return res.status(404).json({ error: "Card not found in the system", code: "CARD_NOT_FOUND" });
    }

    const currentStatus = customer.status;

    if (currentStatus === status) {
        return res.status(400).json({ error: `Card is already ${status}`, code: "STATUS_UNCHANGED" });
    }

    // Update customer status
    await customer.update({ status: status }); // Direct update on the instance

    // Log status change in audit trail (using TransactionHistory or a new dedicated audit model)
    // For now, logging to console to represent the audit.
    console.log(`Card ${card} status changed from ${currentStatus} to ${status} by Employee ${employee.name} (ID: ${empId}). Reason: ${reason}`);

    // If blocking card, also log security event
    if (status === 'blocked') {
      req.session.securityEvents = req.session.securityEvents || [];
      req.session.securityEvents.push({
        type: 'card_blocked',
        timestamp: new Date().toISOString(),
        card: card,
        reason: reason,
        blockedBy: empId
      });
    }

    res.status(200).json({
      status: 1001,
      message: `Card ${status === 'blocked' ? 'blocked' : status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: {
        card: card,
        oldStatus: currentStatus,
        newStatus: status,
        customerName: customer.name,
        currentBalance: parseFloat(customer.balance),
        reason: reason,
        changedBy: employee.userID,
        changedAt: customer.updated_at
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Status change error:", {
      error: error.message,
      userID: empId,
      card: card,
      newStatus: status,
      timestamp: new Date().toISOString()
    });

    const statusCode = error.message.includes("Invalid") ? 401 :
                      error.message.includes("not found") ? 404 :
                      error.message.includes("already") ? 400 : 500;

    res.status(statusCode).json({
      error: error.message || "Status change failed",
      code: "STATUS_CHANGE_ERROR",
      success: false
    });
  }
});

// API to get card details (with role-based data access)
router.get("/details/:card", requireSession, requireRole(['Admin', 'Manager', 'Cashier']), sanitizeInput, async (req, res) => {
  const { card } = req.params;
  const { include_transactions } = req.query;

  try {
    // Validate card parameter
    if (!card || !validator.isAlphanumeric(card)) {
      return res.status(400).json({
        error: "Valid card number is required",
        code: "VALIDATION_ERROR"
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'card_details_lookup',
      timestamp: new Date().toISOString(),
      card: card,
      role: req.session.userRole
    };

    // Get card details using Customer model
    const customer = await Customer.findByCard(card); // Use Customer.findByCard

    if (!customer) {
      return res.status(404).json({
        error: "Card not found in the system",
        code: "CARD_NOT_FOUND",
        success: false
      });
    }

    const userRole = req.session.userRole;

    // Role-based data filtering
    let responseData = {
      customerId: customer.id,
      card: customer.card,
      customerName: customer.name,
      balance: parseFloat(customer.balance),
      status: customer.status,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
      lastTransaction: customer.updated_at, // Use updated_at as last transaction timestamp
      lastRecharge: null // No direct field for this, would need aggregate from TransactionHistory
    };

    // Include sensitive data based on role
    if (['Admin', 'Manager'].includes(userRole)) {
      responseData.customerMobile = customer.phone; // Use 'phone' from Customer model
      responseData.customerAddress = customer.address; // Use 'address' from Customer model
      // `issuedBy` needs to be derived if stored as a link to employee ID, not directly on Customer model
      // For now, it's not directly available from customer model for security/privacy.
    } else {
      // Mask mobile for lower privilege roles
      let maskedMobile = customer.phone?.toString() || '';
      if (maskedMobile.length > 6) {
        maskedMobile = maskedMobile.substring(0, 3) +
                     "*".repeat(maskedMobile.length - 6) +
                     maskedMobile.substring(maskedMobile.length - 3);
      }
      responseData.customerMobile = maskedMobile;
    }

    // Include recent transactions if requested (Admin/Manager only)
    if (include_transactions === 'true' && ['Admin', 'Manager'].includes(userRole)) {
      const recentTransactions = await TransactionHistory.findAll({ // Use TransactionHistory model
        where: { customer_id: customer.id },
        order: [['created_at', 'DESC']],
        limit: 10,
        attributes: [
            'id', 'amount', 'transaction_type', 'created_at',
            'notes', 'type', 'status', 'balance_before', 'balance_after'
        ]
      });

      responseData.recentTransactions = recentTransactions.map(txn => ({
        id: txn.id,
        amount: parseFloat(txn.amount),
        type: txn.transaction_type, // transaction_type enum
        timestamp: txn.created_at,
        remarks: txn.notes, // notes field
        method: txn.type, // payment type
        status: txn.status,
        previousBalance: parseFloat(txn.balance_before),
        newBalance: parseFloat(txn.balance_after)
      }));
    }

    res.status(200).json({
      status: 1001,
      message: "Card details retrieved successfully",
      data: responseData,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Card details error:", {
      error: error.message,
      card: card,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: "Failed to retrieve card details",
      code: "DETAILS_ERROR",
      success: false
    });
  }
});

// API to get session security summary (Admin only)
router.get("/security/session-summary", requireSession, requireRole(['Admin']), async (req, res) => {
  try {
    // Ensure all session properties are initialized to prevent undefined errors
    req.session.startTime = req.session.startTime || new Date().toISOString();
    req.session.lastOperation = req.session.lastOperation || null;
    req.session.securityIncidents = req.session.securityIncidents || [];
    req.session.securityEvents = req.session.securityEvents || [];
    req.session.operationCount = (req.session.operationCount || 0) + 1; // Increment here

    const securitySummary = {
      sessionId: req.session.id,
      userRole: req.session.userRole,
      sessionStartTime: req.session.startTime,
      lastOperation: req.session.lastOperation,
      securityIncidents: req.session.securityIncidents,
      securityEvents: req.session.securityEvents,
      operationCount: req.session.operationCount
    };


    res.status(200).json({
      status: 1001,
      message: "Security summary retrieved successfully",
      data: securitySummary,
      success: true
    });

  } catch (error) {
    console.error("Security summary error:", {
      error: error.message,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: "Failed to retrieve security summary",
      code: "SECURITY_ERROR",
      success: false
    });
  }
});

// API to clear session security logs (Admin only)
router.delete("/security/clear-logs", requireSession, requireRole(['Admin']), sanitizeInput, async (req, res) => {
  try {
    const clearedData = {
      incidentsCleared: (req.session.securityIncidents || []).length,
      eventsCleared: (req.session.securityEvents || []).length
    };

    // Clear security logs from session
    req.session.securityIncidents = [];
    req.session.securityEvents = [];

    res.status(200).json({
      status: 1001,
      message: "Security logs cleared successfully",
      data: clearedData,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Clear logs error:", {
      error: error.message,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: "Failed to clear security logs",
      code: "CLEAR_LOGS_ERROR",
      success: false
    });
  }
});

// Health check endpoint with session validation
router.get("/health", (req, res) => {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    sessionActive: !!(req.session && req.session.id),
    sessionId: req.session?.id || null,
    userRole: req.session?.userRole || null
  };

  res.status(200).json({
    status: 1001,
    message: "Card service is healthy",
    data: healthData,
    success: true
  });
});

module.exports = router;