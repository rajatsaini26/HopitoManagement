const express = require('express');
const { pool } = require('../config/db');
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");
const xss = require("xss");
require('dotenv').config();

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

// Admin/Manager role check middleware
const requireAdminRole = (req, res, next) => {
  // This would typically check the user's role from session or JWT
  // For now, we'll add a placeholder - implement based on your auth system
  if (!req.session.userRole || !['Admin', 'Manager'].includes(req.session.userRole)) {
    return res.status(403).json({ 
      error: "Insufficient permissions", 
      code: "INSUFFICIENT_PERMISSIONS" 
    });
  }
  next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return xss(validator.escape(value));
    }
    return value;
  };

  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      req.body[key] = sanitizeValue(req.body[key]);
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      req.query[key] = sanitizeValue(req.query[key]);
    });
  }

  next();
};

// Database transaction wrapper
const withTransaction = async (callback) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
router.post('/add', requireSession, requireAdminRole, sanitizeInput, async (req, res) => {
  const { name, charge, session, discount } = req.body;
  
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
      data: { name, charge }
    };

    const result = await withTransaction(async (connection) => {
      // Check if game with same name already exists
      const checkExistingQuery = "SELECT GameID FROM Games WHERE GameName = ?";
      const [existingGames] = await connection.execute(checkExistingQuery, [name]);
      
      if (existingGames.length > 0) {
        throw new Error("Game with this name already exists");
      }

      // Insert new game
      const insertQuery = `
        INSERT INTO Games (GameName, Charge, SessionTime, Discount, created_at, updated_at) 
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `;
      const [insertResult] = await connection.execute(insertQuery, [
        name, 
        parseFloat(charge), 
        session ? parseInt(session) : null, 
        discount ? parseFloat(discount) : null
      ]);

      return insertResult;
    });

    res.status(201).json({
      message: 'Game added successfully.',
      gameId: result.insertId,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error adding game:', error.message);
    res.status(error.message.includes("already exists") ? 409 : 500).json({ 
      error: error.message || 'An unexpected error occurred.',
      success: false
    });
  }
});

// Update Game
router.put('/update', requireSession, requireAdminRole, sanitizeInput, async (req, res) => {
  const { id, name, charge, session, discount } = req.body;

  try {
    // Validate ID
    if (!id || !validator.isNumeric(id.toString())) {
      return res.status(400).json({ error: 'Valid Game ID is required.' });
    }

    // Validate that at least one field is provided for update
    if (name === undefined && charge === undefined && session === undefined && discount === undefined) {
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
      gameId: id
    };

    const result = await withTransaction(async (connection) => {
      // Check if game exists
      const checkGameQuery = "SELECT GameID FROM Games WHERE GameID = ? FOR UPDATE";
      const [gameExists] = await connection.execute(checkGameQuery, [id]);
      
      if (gameExists.length === 0) {
        throw new Error("Game not found");
      }

      // Build dynamic update query
      const updates = [];
      const values = [];

      if (name !== undefined) {
        // Check if another game with same name exists
        const checkNameQuery = "SELECT GameID FROM Games WHERE GameName = ? AND GameID != ?";
        const [nameExists] = await connection.execute(checkNameQuery, [name, id]);
        
        if (nameExists.length > 0) {
          throw new Error("Another game with this name already exists");
        }
        
        updates.push('GameName = ?');
        values.push(name);
      }

      if (charge !== undefined) {
        updates.push('Charge = ?');
        values.push(parseFloat(charge));
      }

      if (session !== undefined) {
        updates.push('SessionTime = ?');
        values.push(session ? parseInt(session) : null);
      }

      if (discount !== undefined) {
        updates.push('Discount = ?');
        values.push(discount ? parseFloat(discount) : null);
      }

      // Add updated_at timestamp
      updates.push('updated_at = NOW()');
      values.push(id); // For WHERE clause

      const updateQuery = `UPDATE Games SET ${updates.join(', ')} WHERE GameID = ?`;
      const [updateResult] = await connection.execute(updateQuery, values);

      return updateResult;
    });

    res.status(200).json({
      message: 'Game updated successfully.',
      affectedRows: result.affectedRows,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error updating game:', error.message);
    res.status(error.message.includes("not found") ? 404 : 
              error.message.includes("already exists") ? 409 : 500).json({ 
      error: error.message || 'An unexpected error occurred.',
      success: false
    });
  }
});

// Delete Game
router.delete('/delete', requireSession, requireAdminRole, sanitizeInput, async (req, res) => {
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
      gameId: id
    };

    const result = await withTransaction(async (connection) => {
      // Check if game exists and if it's being used in any transactions
      const checkUsageQuery = `
        SELECT COUNT(*) as transactionCount 
        FROM Transactions 
        WHERE GameID = ?
      `;
      const [usageResult] = await connection.execute(checkUsageQuery, [id]);
      
      if (usageResult[0].transactionCount > 0) {
        throw new Error("Cannot delete game that has transaction history");
      }

      // Delete the game
      const deleteQuery = 'DELETE FROM Games WHERE GameID = ?';
      const [deleteResult] = await connection.execute(deleteQuery, [id]);

      if (deleteResult.affectedRows === 0) {
        throw new Error("Game not found");
      }

      return deleteResult;
    });

    res.status(200).json({
      message: 'Game deleted successfully.',
      affectedRows: result.affectedRows,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error deleting game:', error.message);
    res.status(error.message.includes("not found") ? 404 : 
              error.message.includes("transaction history") ? 409 : 500).json({ 
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

    // Use prepared statement for security
    const getGameQuery = `
      SELECT GameID, GameName, Charge, SessionTime, Discount, created_at, updated_at 
      FROM Games 
      WHERE GameID = ?
    `;
    const [gameResult] = await pool.execute(getGameQuery, [id]);

    if (gameResult.length === 0) {
      return res.status(404).json({ 
        error: 'Game not found.',
        success: false
      });
    }

    const game = gameResult[0];

    res.status(200).json({
      message: 'Game found successfully.',
      game: {
        GameID: game.GameID,
        Name: game.GameName,
        Charge: game.Charge,
        Session: game.SessionTime,
        Discount: game.Discount,
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
    const allowedSortFields = ['GameName', 'Charge', 'SessionTime', 'Discount', 'created_at', 'updated_at'];
    const sortField = sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'GameName';
    const sortDirection = sortOrder && ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
    
    // Build search condition
    let searchCondition = '';
    let queryParams = [];
    
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      searchCondition = 'WHERE GameName LIKE ?';
      queryParams.push(searchTerm);
    }
    
    // Store operation in session for audit
    req.session.lastOperation = {
      type: 'game_list_view',
      timestamp: new Date().toISOString(),
      filters: { page: pageNum, limit: limitNum, search: search || null }
    };

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM Games ${searchCondition}`;
    const [countResult] = await pool.execute(countQuery, queryParams);
    const totalGames = countResult[0].total;
    
    // Get games with pagination and sorting
    const gamesQuery = `
      SELECT GameID, GameName, Charge, SessionTime, Discount, created_at, updated_at 
      FROM Games 
      ${searchCondition}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;
    
    // Add pagination parameters to query params
    const finalParams = [...queryParams, limitNum, offset];
    const [gamesResult] = await pool.execute(gamesQuery, finalParams);

    // Format the response data
    const games = gamesResult.map(game => ({
      GameID: game.GameID,
      Name: game.GameName,
      Charge: parseFloat(game.Charge),
      Session: game.SessionTime,
      Discount: game.Discount ? parseFloat(game.Discount) : null,
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
router.get('/stats', requireSession, requireAdminRole, async (req, res) => {
  try {
    // Store operation in session
    req.session.lastOperation = {
      type: 'game_stats_view',
      timestamp: new Date().toISOString()
    };

    const statsQuery = `
      SELECT 
        COUNT(*) as totalGames,
        AVG(Charge) as averageCharge,
        MIN(Charge) as minCharge,
        MAX(Charge) as maxCharge,
        SUM(CASE WHEN Discount IS NOT NULL AND Discount > 0 THEN 1 ELSE 0 END) as gamesWithDiscount,
        AVG(CASE WHEN SessionTime IS NOT NULL THEN SessionTime END) as averageSessionTime
      FROM Games
    `;
    
    const [statsResult] = await pool.execute(statsQuery);
    const stats = statsResult[0];

    res.status(200).json({
      message: 'Game statistics retrieved successfully.',
      stats: {
        totalGames: stats.totalGames,
        averageCharge: stats.averageCharge ? parseFloat(stats.averageCharge).toFixed(2) : null,
        minCharge: stats.minCharge ? parseFloat(stats.minCharge) : null,
        maxCharge: stats.maxCharge ? parseFloat(stats.maxCharge) : null,
        gamesWithDiscount: stats.gamesWithDiscount,
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
router.patch('/bulk-update', requireSession, requireAdminRole, sanitizeInput, async (req, res) => {
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
      updateCount: gameIds.length
    };

    const result = await withTransaction(async (connection) => {
      // Verify all games exist
      const placeholders = gameIds.map(() => '?').join(',');
      const checkQuery = `SELECT GameID FROM Games WHERE GameID IN (${placeholders})`;
      const [existingGames] = await connection.execute(checkQuery, gameIds);
      
      if (existingGames.length !== gameIds.length) {
        throw new Error("One or more games not found");
      }

      // Build dynamic update query
      const updateFields = [];
      const values = [];

      if (updates.charge !== undefined) {
        updateFields.push('Charge = ?');
        values.push(parseFloat(updates.charge));
      }

      if (updates.session !== undefined) {
        updateFields.push('SessionTime = ?');
        values.push(updates.session ? parseInt(updates.session) : null);
      }

      if (updates.discount !== undefined) {
        updateFields.push('Discount = ?');
        values.push(updates.discount ? parseFloat(updates.discount) : null);
      }

      if (updateFields.length === 0) {
        throw new Error("No valid fields provided for update");
      }

      // Add updated_at timestamp
      updateFields.push('updated_at = NOW()');

      // Execute bulk update
      const updateQuery = `
        UPDATE Games 
        SET ${updateFields.join(', ')} 
        WHERE GameID IN (${placeholders})
      `;
      
      const [updateResult] = await connection.execute(updateQuery, [...values, ...gameIds]);
      return updateResult;
    });

    res.status(200).json({
      message: `${result.affectedRows} games updated successfully.`,
      affectedRows: result.affectedRows,
      sessionId: req.session.id,
      success: true
    });

  } catch (error) {
    console.error('Error in bulk update:', error.message);
    res.status(error.message.includes("not found") ? 404 : 500).json({ 
      error: error.message || 'An unexpected error occurred during bulk update.',
      success: false
    });
  }
});

// Export the router
module.exports = router;