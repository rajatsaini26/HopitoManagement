const express = require('express');
const { Op } = require('sequelize'); // Import Op for Sequelize queries
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");
const xss = require("xss");
require('dotenv').config();

// Import models
const { Games, Sessions, Customer, Employee } = require('../models'); // Import necessary models
const sequelize = require('../config/db').sequelize; // Import sequelize instance for transactions

const router = express.Router();

// Rate limiting middleware
const gameRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs for game operations
  message: { error: "Too many game requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting and security headers
router.use(gameRateLimit);
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

// Input sanitization middleware
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

// Game validation helper
const validateGameData = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate || data.name !== undefined) {
    if (!data.name || !validator.isLength(data.name, { min: 2, max: 100 })) {
      errors.push("Game name must be between 2 and 100 characters");
    }
  }

  if (!isUpdate || data.charge !== undefined) {
    if (data.charge == null || !validator.isNumeric(data.charge.toString()) || parseFloat(data.charge) < 0) {
      errors.push("Valid charge amount is required");
    }
  }

  if (data.session !== undefined && data.session !== null) {
    if (!validator.isNumeric(data.session.toString()) || parseInt(data.session) < 0) {
      errors.push("Valid session time is required");
    }
  }

  if (data.discount !== undefined && data.discount !== null) {
    if (!validator.isNumeric(data.discount.toString()) || parseFloat(data.discount) < 0 || parseFloat(data.discount) > 100) {
      errors.push("Discount must be between 0 and 100");
    }
  }

  return errors;
};

// Add Game
router.post('/add', requireSession, requireRole(['Admin', 'Manager']), sanitizeInput, async (req, res) => {
  const { game_name, charge, session_time, discount, description } = req.body; // Align with Games model fields

  try {
    // Validate input
    const validationErrors = validateGameData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors
      });
    }

    // Store operation in session for audit
    req.session.lastOperation = {
      type: 'game_add',
      timestamp: new Date().toISOString(),
      data: { game_name, charge },
      userID: req.session.userID
    };

    // Check if game with same name already exists
    const existingGame = await Games.findOne({ where: { game_name } });
    if (existingGame) {
      return res.status(409).json({ error: "Game with this name already exists", success: false });
    }

    // Create new game using the Games model
    const newGame = await Games.create({
      game_name,
      charge: parseFloat(charge),
      session_time: session_time ? parseInt(session_time) : null,
      discount: discount ? parseFloat(discount) : 0,
      description: description || null,
      status: 'active' // Default status
    });

    res.status(201).json({
      message: 'Game added successfully.',
      gameId: newGame.id,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error adding game:', error.message);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred.',
      success: false
    });
  }
});

// Update Game
router.put('/update', requireSession, requireRole(['Admin', 'Manager']), sanitizeInput, async (req, res) => {
  const { id, game_name, charge, session_time, discount, status, description } = req.body; // Align with Games model fields

  try {
    // Validate ID
    if (!id || !validator.isNumeric(id.toString())) {
      return res.status(400).json({ error: 'Valid Game ID is required.' });
    }

    // Validate that at least one field is provided for update
    if (game_name === undefined && charge === undefined && session_time === undefined && discount === undefined && status === undefined && description === undefined) {
      return res.status(400).json({
        error: 'At least one field is required to update.'
      });
    }

    // Validate provided fields
    const validationErrors = validateGameData(req.body, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'game_update',
      timestamp: new Date().toISOString(),
      gameId: id,
      userID: req.session.userID
    };

    // Find the game to update
    const game = await Games.findByPk(id);
    if (!game) {
      return res.status(404).json({ error: "Game not found", success: false });
    }

    // Check for duplicate name if name is being updated
    if (game_name !== undefined && game_name !== game.game_name) {
      const existingGameWithName = await Games.findOne({ where: { game_name, id: { [Op.ne]: id } } });
      if (existingGameWithName) {
        return res.status(409).json({ error: "Another game with this name already exists", success: false });
      }
    }

    // Build update object
    const updateFields = {};
    if (game_name !== undefined) updateFields.game_name = game_name;
    if (charge !== undefined) updateFields.charge = parseFloat(charge);
    if (session_time !== undefined) updateFields.session_time = session_time ? parseInt(session_time) : null;
    if (discount !== undefined) updateFields.discount = discount ? parseFloat(discount) : 0;
    if (status !== undefined && ['active', 'inactive', 'maintenance'].includes(status)) updateFields.status = status;
    if (description !== undefined) updateFields.description = description;

    // Perform the update
    await game.update(updateFields);

    res.status(200).json({
      message: 'Game updated successfully.',
      gameId: game.id,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error updating game:', error.message);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred.',
      success: false
    });
  }
});

// Delete Game
router.delete('/delete', requireSession, requireRole(['Admin', 'Manager']), sanitizeInput, async (req, res) => {
  const { id } = req.body;

  try {
    // Validate input
    if (!id || !validator.isNumeric(id.toString())) {
      return res.status(400).json({ error: 'Valid Game ID is required.' });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'game_delete',
      timestamp: new Date().toISOString(),
      gameId: id,
      userID: req.session.userID
    };

    // Check if game exists
    const game = await Games.findByPk(id);
    if (!game) {
      return res.status(404).json({ error: "Game not found", success: false });
    }

    // Check if game is being used in any sessions
    const sessionCount = await Sessions.count({ where: { game_id: id } });
    if (sessionCount > 0) {
      return res.status(409).json({ error: "Cannot delete game that has associated sessions", success: false });
    }

    // Delete the game
    await game.destroy();

    res.status(200).json({
      message: 'Game deleted successfully.',
      gameId: id,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error deleting game:', error.message);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred.',
      success: false
    });
  }
});

// Get Game Details
router.get('/gamedetails', requireSession, sanitizeInput, async (req, res) => {
  const { id } = req.query;

  try {
    // Validate input
    if (!id || !validator.isNumeric(id.toString())) {
      return res.status(400).json({ error: 'Valid Game ID is required.' });
    }

    const game = await Games.findByPk(id);

    if (!game) {
      return res.status(404).json({
        error: 'Game not found.',
        success: false
      });
    }

    res.status(200).json({
      message: 'Game found successfully.',
      game: {
        GameID: game.id,
        Name: game.game_name,
        Charge: parseFloat(game.charge),
        Session: game.session_time,
        Discount: parseFloat(game.discount),
        Status: game.status,
        Description: game.description,
        CreatedAt: game.created_at,
        UpdatedAt: game.updated_at
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error fetching game details:', error.message);
    res.status(500).json({
      error: 'An unexpected error occurred.',
      success: false
    });
  }
});

// Get Game List
router.get("/gameList", requireSession, sanitizeInput, async (req, res) => {
  try {
    const { page, limit, search, sortBy, sortOrder } = req.query;

    // Validate and sanitize pagination parameters
    const pageNum = page && validator.isNumeric(page.toString()) ? parseInt(page) : 1;
    const limitNum = limit && validator.isNumeric(limit.toString()) ? Math.min(parseInt(limit), 100) : 10; // Max 100 items per page
    const offset = (pageNum - 1) * limitNum;

    // Validate sort parameters
    const allowedSortFields = ['game_name', 'charge', 'session_time', 'discount', 'status', 'created_at', 'updated_at'];
    const sortField = sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'game_name';
    const sortDirection = sortOrder && ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    // Build search condition
    let whereClause = {};
    if (search && search.trim() !== '') {
      whereClause.game_name = { [Op.like]: `%${search.trim()}%` };
    }

    // Store operation in session for audit
    req.session.lastOperation = {
      type: 'game_list_view',
      timestamp: new Date().toISOString(),
      filters: { page: pageNum, limit: limitNum, search: search || null },
      userID: req.session.userID
    };

    // Get total count for pagination
    const totalGames = await Games.count({ where: whereClause });

    // Get games with pagination and sorting
    const gamesResult = await Games.findAll({
      where: whereClause,
      attributes: ['id', 'game_name', 'charge', 'session_time', 'discount', 'status', 'description', 'created_at', 'updated_at'],
      order: [[sortField, sortDirection]],
      limit: limitNum,
      offset: offset
    });

    // Format the response data
    const games = gamesResult.map(game => ({
      GameID: game.id,
      Name: game.game_name,
      Charge: parseFloat(game.charge),
      Session: game.session_time,
      Discount: parseFloat(game.discount),
      Status: game.status,
      Description: game.description,
      CreatedAt: game.created_at,
      UpdatedAt: game.updated_at
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalGames / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      message: 'Games retrieved successfully.',
      data: {
        games,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalGames,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage
        },
        filters: {
          search: search || null,
          sortBy: sortField,
          sortOrder: sortDirection
        }
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error fetching game list:', error.message);
    res.status(500).json({
      error: 'An unexpected error occurred while fetching games.',
      success: false
    });
  }
});

// Get Game Statistics (additional utility route)
router.get('/stats', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    // Store operation in session
    req.session.lastOperation = {
      type: 'game_stats_view',
      timestamp: new Date().toISOString(),
      userID: req.session.userID
    };

    const stats = await Games.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalGames'],
        [sequelize.fn('AVG', sequelize.col('charge')), 'averageCharge'],
        [sequelize.fn('MIN', sequelize.col('charge')), 'minCharge'],
        [sequelize.fn('MAX', sequelize.col('charge')), 'maxCharge'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN discount IS NOT NULL AND discount > 0 THEN 1 ELSE 0 END')), 'gamesWithDiscount'],
        [sequelize.fn('AVG', sequelize.col('session_time')), 'averageSessionTime']
      ],
      raw: true // To get plain data
    });

    res.status(200).json({
      message: 'Game statistics retrieved successfully.',
      stats: {
        totalGames: parseInt(stats.totalGames),
        averageCharge: stats.averageCharge ? parseFloat(stats.averageCharge).toFixed(2) : null,
        minCharge: stats.minCharge ? parseFloat(stats.minCharge) : null,
        maxCharge: stats.maxCharge ? parseFloat(stats.maxCharge) : null,
        gamesWithDiscount: parseInt(stats.gamesWithDiscount),
        averageSessionTime: stats.averageSessionTime ? parseFloat(stats.averageSessionTime).toFixed(1) : null
      },
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error fetching game statistics:', error.message);
    res.status(500).json({
      error: 'An unexpected error occurred while fetching statistics.',
      success: false
    });
  }
});

// Bulk Update Games (advanced feature)
router.patch('/bulk-update', requireSession, requireRole(['Admin', 'Manager']), sanitizeInput, async (req, res) => {
  const { gameIds, updates } = req.body;

  try {
    // Validate input
    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ error: 'Valid array of Game IDs is required.' });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Updates object is required.' });
    }

    // Validate all game IDs are numeric
    const invalidIds = gameIds.filter(id => !validator.isNumeric(id.toString()));
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: 'All Game IDs must be valid numbers.' });
    }

    // Limit bulk operations to prevent abuse
    if (gameIds.length > 50) {
      return res.status(400).json({ error: 'Bulk update limited to 50 games at once.' });
    }

    // Validate update data
    const validationErrors = validateGameData(updates, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: 'game_bulk_update',
      timestamp: new Date().toISOString(),
      gameIds: gameIds,
      updateCount: gameIds.length,
      userID: req.session.userID
    };

    // Verify all games exist
    const existingGames = await Games.findAll({
      where: {
        id: { [Op.in]: gameIds }
      },
      attributes: ['id']
    });

    if (existingGames.length !== gameIds.length) {
      const foundIds = new Set(existingGames.map(g => g.id));
      const missingIds = gameIds.filter(id => !foundIds.has(parseInt(id)));
      return res.status(404).json({ error: `One or more games not found: ${missingIds.join(', ')}`, success: false });
    }

    // Build update object
    const updateFields = {};
    if (updates.charge !== undefined) updateFields.charge = parseFloat(updates.charge);
    if (updates.session !== undefined) updateFields.session_time = updates.session ? parseInt(updates.session) : null;
    if (updates.discount !== undefined) updateFields.discount = updates.discount ? parseFloat(updates.discount) : 0;
    if (updates.status !== undefined && ['active', 'inactive', 'maintenance'].includes(updates.status)) updateFields.status = updates.status;
    if (updates.description !== undefined) updateFields.description = updates.description;


    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update", success: false });
    }

    // Perform bulk update
    const [affectedRows] = await Games.update(updateFields, {
      where: {
        id: { [Op.in]: gameIds }
      }
    });

    res.status(200).json({
      message: `${affectedRows} games updated successfully.`,
      affectedRows: affectedRows,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error in bulk update:', error.message);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred during bulk update.',
      success: false
    });
  }
});

// New API to signal the start of a game session
router.post('/start-game-signal', requireSession, requireRole(['Admin', 'Manager', 'Employee', 'Cashier']), sanitizeInput, async (req, res) => {
  const { customerCard, gameId, empId, plannedDuration } = req.body;

  try {
    // Basic validation for required fields
    if (!customerCard || !gameId || !empId) {
      return res.status(400).json({ error: "Customer card, game ID, and employee ID are required.", code: "VALIDATION_ERROR" });
    }
    if (!validator.isAlphanumeric(customerCard.toString())) {
      return res.status(400).json({ error: "Invalid customer card format.", code: "VALIDATION_ERROR" });
    }
    if (!validator.isNumeric(gameId.toString())) {
      return res.status(400).json({ error: "Invalid game ID format.", code: "VALIDATION_ERROR" });
    }
    if (!validator.isNumeric(empId.toString())) {
      return res.status(400).json({ error: "Invalid employee ID format.", code: "VALIDATION_ERROR" });
    }
    if (plannedDuration !== undefined && (!validator.isNumeric(plannedDuration.toString()) || parseInt(plannedDuration) <= 0)) {
        return res.status(400).json({ error: "Planned duration must be a positive number in minutes.", code: "VALIDATION_ERROR" });
    }

    // Store operation in session for audit
    req.session.lastOperation = {
      type: 'game_session_start_signal',
      timestamp: new Date().toISOString(),
      customerCard,
      gameId,
      empId: req.session.userID // Log the employee from session
    };

    // Fetch customer and employee internal IDs
    const customer = await Customer.findByCard(customerCard);
    if (!customer) {
      return res.status(404).json({ error: "Customer card not found.", success: false, code: "CUSTOMER_NOT_FOUND" });
    }
    const employee = await Employee.findOne({ where: { userID: empId } });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found.", success: false, code: "EMPLOYEE_NOT_FOUND" });
    }

    // Call the Sessions model's startSession method
    const session = await Sessions.startSession({
      customer_id: customer.id,
      game_id: parseInt(gameId),
      emp_id: employee.id, // Use internal employee ID
      card: customerCard,
      planned_duration: plannedDuration ? parseInt(plannedDuration) : undefined, // Let model default if not provided
      payment_method: 'card_balance' // Assuming payment from card balance for arcade games
    });

    res.status(200).json({
      message: "Game session started successfully.",
      sessionId: session.id,
      customerName: session.customer.name,
      gameName: session.game.game_name,
      startTime: session.start_time,
      finalCharge: parseFloat(session.final_charge),
      currentBalance: parseFloat(session.customer.balance),
      success: true
    });

  } catch (error) {
    console.error('Error starting game session:', error.message);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred while starting the game session.',
      success: false
    });
  }
});

// New API to signal the stop of a game session
router.post('/stop-game-signal', requireSession, requireRole(['Admin', 'Manager', 'Employee', 'Cashier']), sanitizeInput, async (req, res) => {
  const { sessionId, empId, actualDuration } = req.body;

  try {
    // Basic validation for required fields
    if (!sessionId || !empId) {
      return res.status(400).json({ error: "Session ID and employee ID are required.", code: "VALIDATION_ERROR" });
    }
    if (!validator.isNumeric(sessionId.toString())) {
      return res.status(400).json({ error: "Invalid session ID format.", code: "VALIDATION_ERROR" });
    }
    if (!validator.isNumeric(empId.toString())) {
      return res.status(400).json({ error: "Invalid employee ID format.", code: "VALIDATION_ERROR" });
    }
    if (actualDuration !== undefined && (!validator.isNumeric(actualDuration.toString()) || parseInt(actualDuration) < 0)) {
        return res.status(400).json({ error: "Actual duration must be a non-negative number in minutes.", code: "VALIDATION_ERROR" });
    }

    // Store operation in session for audit
    req.session.lastOperation = {
      type: 'game_session_stop_signal',
      timestamp: new Date().toISOString(),
      sessionId,
      empId: req.session.userID // Log the employee from session
    };

    // Fetch employee internal ID
    const employee = await Employee.findOne({ where: { userID: empId } });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found.", success: false, code: "EMPLOYEE_NOT_FOUND" });
    }

    // Call the Sessions model's endSession method
    const session = await Sessions.endSession(
      parseInt(sessionId),
      employee.id, // Use internal employee ID
      actualDuration ? parseInt(actualDuration) : null
    );

    res.status(200).json({
      message: "Game session ended successfully.",
      sessionId: session.id,
      status: session.status,
      endTime: session.end_time,
      actualDuration: session.actual_duration,
      success: true
    });

  } catch (error) {
    console.error('Error ending game session:', error.message);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred while ending the game session.',
      success: false
    });
  }
});


// Export the router
module.exports = router;
