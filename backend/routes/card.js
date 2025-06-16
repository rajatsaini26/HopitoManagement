const express = require("express");
const { pool } = require("../config/db");
const { generateUserID } = require("../utils/generateUserID");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");
const xss = require("xss");
const { sensitiveRateLimit } = require('../middleware/rateLimit');
require("dotenv").config();

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


// Apply rate limiting and security headers
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
    if (!req.session.userRole || !allowedRoles.includes(req.session.userRole)) {
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

// Database transaction wrapper with enhanced error handling
const withTransaction = async (callback) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    // Log transaction errors for monitoring
    console.error('Transaction failed:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    throw error;
  } finally {
    connection.release();
  }
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
  
  // Balance validation
  if (!isUpdate || data.balance !== undefined) {
    if (data.balance == null || !validator.isFloat(data.balance.toString(), { min: 0 })) {
      errors.push("Valid balance amount is required (minimum 0)");
    }
    if (data.balance && parseFloat(data.balance) > 50000) {
      errors.push("Balance cannot exceed ₹50,000");
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
  
  // User ID validation
  if (!isUpdate || data.userID !== undefined) {
    if (!data.userID || !validator.isNumeric(data.userID.toString())) {
      errors.push("Valid employee user ID is required");
    }
  }
  
  // PIN validation
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
  if (!isUpdate || data.method !== undefined) {
    if (!data.method || !['CASH', 'ONLINE', 'CARD'].includes(data.method.toUpperCase())) {
      errors.push("Payment method must be CASH, ONLINE, or CARD");
    }
  }
  
  // UTR validation for online payments
  if (data.method && data.method.toUpperCase() === 'ONLINE') {
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
  
  if (!data.userID || !validator.isNumeric(data.userID.toString())) {
    errors.push("Valid employee ID is required");
  }
  
  if (!data.method || !['CASH', 'ONLINE', 'CARD'].includes(data.method.toUpperCase())) {
    errors.push("Valid payment method is required");
  }
  
  if (!data.pin || !validator.isNumeric(data.pin.toString()) || !validator.isLength(data.pin.toString(), { min: 4, max: 6 })) {
    errors.push("Valid 4-6 digit PIN is required");
  }
  
  if (data.method && data.method.toUpperCase() === 'ONLINE') {
    if (!data.utr || !validator.isLength(data.utr, { min: 10, max: 25 })) {
      errors.push("Valid UTR is required for online payments");
    }
  }
  
  return errors;
};

// API to issue a card to a Customer
router.post("/issue", requireSession, requireRole(['Admin', 'Manager']), sanitizeInput, async (req, res) => {
  const { mobile, name, balance, card, userID, pin, address, method, utr } = req.body;

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
      userID: userID,
      card: card,
      amount: parseFloat(balance)
    };

    const result = await withTransaction(async (connection) => {
      // Validate employee and PIN with role check
      const checkEmployeeQuery = `
        SELECT otp, role, status 
        FROM Employee 
        WHERE userID = ? AND status = 'active' 
        FOR UPDATE
      `;
      const [employeeRows] = await connection.execute(checkEmployeeQuery, [userID]);

      if (employeeRows.length === 0) {
        throw new Error("Employee not found or inactive");
      }

      if (employeeRows[0].otp !== pin) {
        // Log security incident
        req.session.securityIncidents = req.session.securityIncidents || [];
        req.session.securityIncidents.push({
          type: 'invalid_pin_card_issue',
          timestamp: new Date().toISOString(),
          userID: userID,
          attemptedCard: card
        });
        throw new Error("Invalid PIN. Card issuance not authorized.");
      }

      // Check if card number already exists
      const checkCardQuery = "SELECT id, card FROM Customer WHERE card = ? FOR UPDATE";
      const [existingCard] = await connection.execute(checkCardQuery, [card]);
      
      if (existingCard.length > 0) {
        throw new Error("Card number already exists in the system");
      }

      // Check if mobile number already has a card
      const checkMobileQuery = "SELECT id, card FROM Customer WHERE mobile = ? FOR UPDATE";
      const [existingMobile] = await connection.execute(checkMobileQuery, [mobile]);
      
      if (existingMobile.length > 0) {
        throw new Error("Mobile number already has a card registered");
      }

      // Insert new customer with all required fields
      const insertCustomerQuery = `
        INSERT INTO Customer (
          mobile, name, balance, card, address, 
          created_at, updated_at, status, issued_by
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), 'active', ?)
      `;
      const [customerResult] = await connection.execute(insertCustomerQuery, [
        mobile, name, parseFloat(balance), card, address, userID
      ]);

      // Record the initial transaction
      const insertTransactionQuery = `
        INSERT INTO Transactions (
          CardID, Amount, EmployeeID, TransactionTime, 
          Type, Remarks, Method, UTR, Status
        ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, 'completed')
      `;
      await connection.execute(insertTransactionQuery, [
        card, parseFloat(balance), userID, "credit", 
        "New Card Issuance", method.toUpperCase(), utr || null
      ]);

      return { customerId: customerResult.insertId, balance: parseFloat(balance) };
    });

    res.status(201).json({
      status: 1001,
      message: "Card issued successfully",
      data: {
        customerId: result.customerId,
        card: card,
        initialBalance: result.balance,
        issuedBy: userID,
        issuedAt: new Date().toISOString()
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Card issuance error:", {
      error: error.message,
      userID: userID,
      card: card,
      timestamp: new Date().toISOString()
    });

    const statusCode = error.message.includes("Invalid PIN") ? 401 :
                      error.message.includes("already exists") ? 409 :
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
  const { card, recharge, userID, method, pin, utr } = req.body;
  
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
      userID: userID,
      card: card,
      amount: parseFloat(recharge)
    };

    const result = await withTransaction(async (connection) => {
      // Validate employee and PIN
      const checkEmployeeQuery = `
        SELECT otp, role, status 
        FROM Employee 
        WHERE userID = ? AND status = 'active' 
        FOR UPDATE
      `;
      const [employeeRows] = await connection.execute(checkEmployeeQuery, [userID]);
      
      if (employeeRows.length === 0 || employeeRows[0].otp !== pin) {
        // Log security incident
        req.session.securityIncidents = req.session.securityIncidents || [];
        req.session.securityIncidents.push({
          type: 'invalid_pin_recharge',
          timestamp: new Date().toISOString(),
          userID: userID,
          card: card
        });
        throw new Error("Invalid employee credentials or PIN");
      }

      // Check card exists and get current balance
      const checkCardQuery = `
        SELECT id, balance, status, name 
        FROM Customer 
        WHERE card = ? AND status = 'active' 
        FOR UPDATE
      `;
      const [cardRows] = await connection.execute(checkCardQuery, [card]);
      
      if (cardRows.length === 0) {
        throw new Error("Card not found or inactive");
      }

      const currentBalance = parseFloat(cardRows[0].balance);
      const rechargeAmount = parseFloat(recharge);
      const newBalance = currentBalance + rechargeAmount;

      // Check maximum balance limit
      if (newBalance > 50000) {
        throw new Error("Recharge would exceed maximum balance limit of ₹50,000");
      }

      // Update customer balance
      const updateBalanceQuery = `
        UPDATE Customer 
        SET balance = ?, updated_at = NOW(), last_recharge = NOW() 
        WHERE card = ?
      `;
      await connection.execute(updateBalanceQuery, [newBalance, card]);

      // Record transaction
      const insertTransactionQuery = `
        INSERT INTO Transactions (
          CardID, Amount, EmployeeID, TransactionTime, 
          Type, Remarks, Method, UTR, Status, PreviousBalance, NewBalance
        ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, 'completed', ?, ?)
      `;
      await connection.execute(insertTransactionQuery, [
        card, rechargeAmount, userID, "credit", 
        "Card Recharge", method.toUpperCase(), utr || null, 
        currentBalance, newBalance
      ]);

      return { 
        newBalance, 
        rechargeAmount, 
        customerName: cardRows[0].name,
        previousBalance: currentBalance
      };
    });

    res.status(200).json({
      status: 1001,
      message: "Card recharged successfully",
      data: {
        card: card,
        rechargeAmount: result.rechargeAmount,
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
        customerName: result.customerName,
        rechargedBy: userID,
        rechargedAt: new Date().toISOString()
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Recharge error:", {
      error: error.message,
      userID: userID,
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

// API to deduct balance from a card
router.post("/deduct", requireSession, requireRole(['Admin', 'Manager', 'Cashier']), financialRateLimit, sanitizeInput, async (req, res) => {
  const { card, userID, game_id } = req.body;

  try {
    // Validation
    const errors = [];
    
    if (!card || !validator.isAlphanumeric(card.toString())) {
      errors.push("Valid card number is required");
    }
    
    if (!game_id || !validator.isNumeric(game_id.toString())) {
      errors.push("Valid game ID is required");
    }
    
    if (!userID || !validator.isNumeric(userID.toString())) {
      errors.push("Valid employee ID is required");
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
      type: 'card_deduction',
      timestamp: new Date().toISOString(),
      userID: userID,
      card: card,
      gameId: game_id
    };

    const result = await withTransaction(async (connection) => {
      // Get game details and charges
      const getGameQuery = `
        SELECT GameID, GameName, Charge, Discount, SessionTime 
        FROM Games 
        WHERE GameID = ? AND status = 'active'
      `;
      const [gameRows] = await connection.execute(getGameQuery, [game_id]);

      if (gameRows.length === 0) {
        throw new Error("Game not found or inactive");
      }

      const game = gameRows[0];
      let deductAmount = parseFloat(game.Charge);
      
      // Apply discount if available
      if (game.Discount && game.Discount > 0) {
        const discountAmount = (deductAmount * parseFloat(game.Discount)) / 100;
        deductAmount = deductAmount - discountAmount;
      }

      // Check card and balance
      const checkCardQuery = `
        SELECT id, balance, status, name 
        FROM Customer 
        WHERE card = ? AND status = 'active' 
        FOR UPDATE
      `;
      const [cardRows] = await connection.execute(checkCardQuery, [card]);

      if (cardRows.length === 0) {
        throw new Error("Card not found or inactive");
      }

      const currentBalance = parseFloat(cardRows[0].balance);
      
      if (currentBalance < deductAmount) {
        throw new Error(`Insufficient balance. Required: ₹${deductAmount}, Available: ₹${currentBalance}`);
      }

      const newBalance = currentBalance - deductAmount;

      // Update customer balance
      const updateBalanceQuery = `
        UPDATE Customer 
        SET balance = ?, updated_at = NOW(), last_transaction = NOW() 
        WHERE card = ?
      `;
      await connection.execute(updateBalanceQuery, [newBalance, card]);

      // Record transaction
      const insertTransactionQuery = `
        INSERT INTO Transactions (
          CardID, Amount, EmployeeID, TransactionTime, 
          Type, Remarks, GameID, Status, PreviousBalance, NewBalance
        ) VALUES (?, ?, ?, NOW(), ?, ?, ?, 'completed', ?, ?)
      `;
      await connection.execute(insertTransactionQuery, [
        card, deductAmount, userID, "debit", 
        `Game: ${game.GameName}`, game_id, currentBalance, newBalance
      ]);

      return { 
        newBalance, 
        deductAmount, 
        gameName: game.GameName,
        customerName: cardRows[0].name,
        previousBalance: currentBalance,
        discountApplied: game.Discount || 0
      };
    });

    res.status(200).json({
      status: 1001,
      message: "Amount deducted successfully",
      data: {
        card: card,
        gameName: result.gameName,
        chargeDeducted: result.deductAmount,
        previousBalance: result.previousBalance,
        currentBalance: result.newBalance,
        customerName: result.customerName,
        discountApplied: result.discountApplied,
        processedBy: userID,
        processedAt: new Date().toISOString()
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Deduction error:", {
      error: error.message,
      userID: userID,
      card: card,
      gameId: game_id,
      timestamp: new Date().toISOString()
    });

    const statusCode = error.message.includes("not found") ? 404 :
                      error.message.includes("Insufficient") ? 400 : 500;

    res.status(statusCode).json({ 
      error: error.message || "Deduction failed",
      code: "DEDUCTION_ERROR",
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

    // Query card details with status check
    const checkCardQuery = `
      SELECT id, balance, created_at, name, mobile, address, status, last_transaction
      FROM Customer 
      WHERE card = ? AND status = 'active'
    `;
    const [rows] = await pool.execute(checkCardQuery, [card]);
    
    if (rows.length === 0) {
      return res.status(202).json({
        status: 1003,
        route: "AddCard",
        message: "Card not found in the system or inactive",
        sessionId: req.session.id,
        success: false
      });
    }

    const customer = rows[0];
    
    // Mask sensitive information based on role
    let responseData = {
      customerId: customer.id,
      customerName: customer.name,
      balance: parseFloat(customer.balance),
      createdAt: customer.created_at,
      lastTransaction: customer.last_transaction,
      status: customer.status
    };

    // Role-based data access control
    if (['Admin', 'Manager'].includes(role)) {
      // Full access for admin and manager
      responseData.customerMobile = customer.mobile;
      responseData.customerAddress = customer.address;
    } else {
      // Masked data for other roles
      let maskedMobile = customer.mobile.toString();
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

    // Build query conditions
    let conditions = ['t.CardID = ?'];
    let queryParams = [card];

    if (type && ['credit', 'debit'].includes(type.toLowerCase())) {
      conditions.push('t.Type = ?');
      queryParams.push(type.toLowerCase());
    }

    if (startDate && validator.isISO8601(startDate)) {
      conditions.push('t.TransactionTime >= ?');
      queryParams.push(startDate);
    }

    if (endDate && validator.isISO8601(endDate)) {
      conditions.push('t.TransactionTime <= ?');
      queryParams.push(endDate);
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'transaction_history',
      timestamp: new Date().toISOString(),
      card: card
    };

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM Transactions t 
      WHERE ${conditions.join(' AND ')}
    `;
    const [countResult] = await pool.execute(countQuery, queryParams);
    const totalTransactions = countResult[0].total;

    // Get transactions with details
    const transactionsQuery = `
      SELECT 
        t.TransactionID, t.Amount, t.Type, t.TransactionTime, 
        t.Remarks, t.Method, t.UTR, t.Status, t.PreviousBalance, t.NewBalance,
        e.name as EmployeeName, g.GameName
      FROM Transactions t
      LEFT JOIN Employee e ON t.EmployeeID = e.userID
      LEFT JOIN Games g ON t.GameID = g.GameID
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.TransactionTime DESC
      LIMIT ? OFFSET ?
    `;

    const [transactions] = await pool.execute(transactionsQuery, [...queryParams, limitNum, offset]);

    // Format response
    const formattedTransactions = transactions.map(txn => ({
      transactionId: txn.TransactionID,
      amount: parseFloat(txn.Amount),
      type: txn.Type,
      timestamp: txn.TransactionTime,
      remarks: txn.Remarks,
      method: txn.Method,
      utr: txn.UTR,
      status: txn.Status,
      previousBalance: txn.PreviousBalance ? parseFloat(txn.PreviousBalance) : null,
      newBalance: txn.NewBalance ? parseFloat(txn.NewBalance) : null,
      employeeName: txn.EmployeeName,
      gameName: txn.GameName
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
  const { name, mobile, address, status, pin, userID } = req.body;

  try {
    // Validate card parameter
    if (!card || !validator.isAlphanumeric(card)) {
      return res.status(400).json({ 
        error: "Valid card number is required",
        code: "VALIDATION_ERROR"
      });
    }

    // Validate employee PIN for authorization
    if (!userID || !pin) {
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
      userID: userID,
      card: card
    };

    const result = await withTransaction(async (connection) => {
      // Validate employee and PIN
      const checkEmployeeQuery = `
        SELECT otp, role, status, name as emp_name
        FROM Employee 
        WHERE userID = ? AND status = 'active' 
        FOR UPDATE
      `;
      const [employeeRows] = await connection.execute(checkEmployeeQuery, [userID]);

      if (employeeRows.length === 0 || employeeRows[0].otp !== pin) {
        // Log security incident
        req.session.securityIncidents = req.session.securityIncidents || [];
        req.session.securityIncidents.push({
          type: 'invalid_pin_card_update',
          timestamp: new Date().toISOString(),
          userID: userID,
          card: card
        });
        throw new Error("Invalid employee credentials or PIN");
      }

      // Check if card exists
      const checkCardQuery = `
        SELECT id, name, mobile, address, status 
        FROM Customer 
        WHERE card = ? 
        FOR UPDATE
      `;
      const [cardRows] = await connection.execute(checkCardQuery, [card]);
      
      if (cardRows.length === 0) {
        throw new Error("Card not found in the system");
      }

      const currentData = cardRows[0];
      
      // Build update query dynamically based on provided fields
      const updateFields = [];
      const updateValues = [];
      
      if (name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(name);
      }
      
      if (mobile !== undefined) {
        // Check if new mobile number is already registered to another card
        const checkMobileQuery = "SELECT card FROM Customer WHERE mobile = ? AND card != ?";
        const [existingMobile] = await connection.execute(checkMobileQuery, [mobile, card]);
        
        if (existingMobile.length > 0) {
          throw new Error("Mobile number already registered to another card");
        }
        
        updateFields.push('mobile = ?');
        updateValues.push(mobile);
      }
      
      if (address !== undefined) {
        updateFields.push('address = ?');
        updateValues.push(address);
      }
      
      if (status !== undefined && ['active', 'inactive', 'blocked'].includes(status)) {
        updateFields.push('status = ?');
        updateValues.push(status);
      }
      
      if (updateFields.length === 0) {
        throw new Error("No valid fields provided for update");
      }
      
      updateFields.push('updated_at = NOW()');
      updateValues.push(card);

      // Execute update
      const updateQuery = `
        UPDATE Customer 
        SET ${updateFields.join(', ')} 
        WHERE card = ?
      `;
      await connection.execute(updateQuery, updateValues);

      // Log the update action
      const insertAuditQuery = `
        INSERT INTO CardAuditLog (
          CardID, Action, EmployeeID, ActionTime, 
          OldData, NewData, Remarks
        ) VALUES (?, ?, ?, NOW(), ?, ?, ?)
      `;
      await connection.execute(insertAuditQuery, [
        card, 'UPDATE', userID, 
        JSON.stringify(currentData), 
        JSON.stringify(req.body), 
        `Card details updated by ${employeeRows[0].emp_name}`
      ]);

      return { 
        updatedFields: updateFields.filter(f => f !== 'updated_at = NOW()'),
        employeeName: employeeRows[0].emp_name
      };
    });

    res.status(200).json({
      status: 1001,
      message: "Card details updated successfully",
      data: {
        card: card,
        updatedFields: result.updatedFields,
        updatedBy: userID,
        updatedAt: new Date().toISOString()
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Card update error:", {
      error: error.message,
      userID: userID,
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
  const { status, reason, userID, pin } = req.body;

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

    if (!userID || !pin) {
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
      userID: userID,
      card: card,
      newStatus: status
    };

    const result = await withTransaction(async (connection) => {
      // Validate employee and PIN
      const checkEmployeeQuery = `
        SELECT otp, role, status as emp_status, name 
        FROM Employee 
        WHERE userID = ? AND status = 'active' 
        FOR UPDATE
      `;
      const [employeeRows] = await connection.execute(checkEmployeeQuery, [userID]);

      if (employeeRows.length === 0 || employeeRows[0].otp !== pin) {
        // Log security incident
        req.session.securityIncidents = req.session.securityIncidents || [];
        req.session.securityIncidents.push({
          type: 'invalid_pin_status_change',
          timestamp: new Date().toISOString(),
          userID: userID,
          card: card,
          attemptedStatus: status
        });
        throw new Error("Invalid employee credentials or PIN");
      }

      // Check current card status
      const checkCardQuery = `
        SELECT id, status, name, balance 
        FROM Customer 
        WHERE card = ? 
        FOR UPDATE
      `;
      const [cardRows] = await connection.execute(checkCardQuery, [card]);
      
      if (cardRows.length === 0) {
        throw new Error("Card not found in the system");
      }

      const currentStatus = cardRows[0].status;
      
      if (currentStatus === status) {
        throw new Error(`Card is already ${status}`);
      }

      // Update card status
      const updateStatusQuery = `
        UPDATE Customer 
        SET status = ?, updated_at = NOW() 
        WHERE card = ?
      `;
      await connection.execute(updateStatusQuery, [status, card]);

      // Log status change in audit trail
      const insertStatusLogQuery = `
        INSERT INTO CardStatusLog (
          CardID, OldStatus, NewStatus, EmployeeID, 
          ChangeTime, Reason, ActionType
        ) VALUES (?, ?, ?, ?, NOW(), ?, ?)
      `;
      await connection.execute(insertStatusLogQuery, [
        card, currentStatus, status, userID, reason, 'STATUS_CHANGE'
      ]);

      // If blocking card, also log security event
      if (status === 'blocked') {
        req.session.securityEvents = req.session.securityEvents || [];
        req.session.securityEvents.push({
          type: 'card_blocked',
          timestamp: new Date().toISOString(),
          card: card,
          reason: reason,
          blockedBy: userID
        });
      }

      return { 
        oldStatus: currentStatus,
        customerName: cardRows[0].name,
        balance: parseFloat(cardRows[0].balance),
        employeeName: employeeRows[0].name
      };
    });

    res.status(200).json({
      status: 1001,
      message: `Card ${status === 'blocked' ? 'blocked' : status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: {
        card: card,
        oldStatus: result.oldStatus,
        newStatus: status,
        customerName: result.customerName,
        currentBalance: result.balance,
        reason: reason,
        changedBy: userID,
        changedAt: new Date().toISOString()
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error("Status change error:", {
      error: error.message,
      userID: userID,
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

    // Get card details
    const cardDetailsQuery = `
      SELECT 
        id, card, name, mobile, address, balance, status,
        created_at, updated_at, last_transaction, last_recharge,
        issued_by
      FROM Customer 
      WHERE card = ?
    `;
    const [cardRows] = await pool.execute(cardDetailsQuery, [card]);
    
    if (cardRows.length === 0) {
      return res.status(404).json({
        error: "Card not found in the system",
        code: "CARD_NOT_FOUND",
        success: false
      });
    }

    const customer = cardRows[0];
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
      lastTransaction: customer.last_transaction,
      lastRecharge: customer.last_recharge
    };

    // Include sensitive data based on role
    if (['Admin', 'Manager'].includes(userRole)) {
      responseData.customerMobile = customer.mobile;
      responseData.customerAddress = customer.address;
      responseData.issuedBy = customer.issued_by;
    } else {
      // Mask mobile for lower privilege roles
      let maskedMobile = customer.mobile.toString();
      if (maskedMobile.length > 6) {
        maskedMobile = maskedMobile.substring(0, 3) + 
                     "*".repeat(maskedMobile.length - 6) + 
                     maskedMobile.substring(maskedMobile.length - 3);
      }
      responseData.customerMobile = maskedMobile;
    }

    // Include recent transactions if requested (Admin/Manager only)
    if (include_transactions === 'true' && ['Admin', 'Manager'].includes(userRole)) {
      const recentTransactionsQuery = `
        SELECT 
          TransactionID, Amount, Type, TransactionTime, 
          Remarks, Method, Status
        FROM Transactions 
        WHERE CardID = ? 
        ORDER BY TransactionTime DESC 
        LIMIT 10
      `;
      const [transactions] = await pool.execute(recentTransactionsQuery, [card]);
      
      responseData.recentTransactions = transactions.map(txn => ({
        id: txn.TransactionID,
        amount: parseFloat(txn.Amount),
        type: txn.Type,
        timestamp: txn.TransactionTime,
        remarks: txn.Remarks,
        method: txn.Method,
        status: txn.Status
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
    const securitySummary = {
      sessionId: req.session.id,
      userRole: req.session.userRole,
      sessionStartTime: req.session.startTime || new Date().toISOString(),
      lastOperation: req.session.lastOperation || null,
      securityIncidents: req.session.securityIncidents || [],
      securityEvents: req.session.securityEvents || [],
      operationCount: req.session.operationCount || 0
    };

    // Increment operation count
    req.session.operationCount = (req.session.operationCount || 0) + 1;

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
router.delete("/security/clear-logs", requireSession, requireRole(['Admin']), async (req, res) => {
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