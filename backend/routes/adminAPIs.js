const express = require('express');
const { pool } = require('../config/db');
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");
const xss = require("xss");
require('dotenv').config();

const router = express.Router();

// Rate limiting middleware for admin operations
const adminRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs for admin operations
    message: { error: "Too many admin requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting and security headers
router.use(adminRateLimit);
router.use(helmet());

// Session validation middleware
const requireSession = (req, res, next) => {
    if (!req.session || !req.session.id) {
        return res.status(401).json({ 
            success: false,
            error: "Session required", 
            code: "SESSION_REQUIRED" 
        });
    }
    next();
};

// Admin role validation middleware
const requireAdminRole = (req, res, next) => {
    if (!req.session.userRole || req.session.userRole !== 'Admin') {
        return res.status(403).json({
            success: false,
            error: "Admin access required",
            code: "ADMIN_ACCESS_REQUIRED"
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

// Validation helpers
const validateFilterInput = (filter) => {
    const validFilters = ["today", "monthly", "6months", "yearly"];
    return validFilters.includes(filter);
};

const validateTransactionQuery = (data) => {
    const errors = [];
    
    if (data.cardID && !validator.isAlphanumeric(data.cardID.replace(/[^a-zA-Z0-9]/g, ''))) {
        errors.push("Invalid CardID format");
    }
    
    if (data.empID && !validator.isNumeric(data.empID.toString())) {
        errors.push("EmployeeID must be numeric");
    }
    
    return errors;
};

const getDateRange = (filter) => {
    const now = new Date();
    let startDate, endDate;

    switch (filter) {
        case "today":
            const today = now.toISOString().split("T")[0];
            startDate = `${today} 00:00:00`;
            endDate = `${today} 23:59:59`;
            break;
        case "monthly":
            const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
            startDate = `${startOfMonth} 00:00:00`;
            endDate = `${endOfMonth} 23:59:59`;
            break;
        case "6months":
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            startDate = `${sixMonthsAgo.toISOString().split("T")[0]} 00:00:00`;
            endDate = `${now.toISOString().split("T")[0]} 23:59:59`;
            break;
        case "yearly":
            const startOfYear = `${now.getFullYear()}-01-01`;
            const endOfYear = `${now.getFullYear()}-12-31`;
            startDate = `${startOfYear} 00:00:00`;
            endDate = `${endOfYear} 23:59:59`;
            break;
        default:
            throw new Error("Invalid filter");
    }

    return { startDate, endDate };
};

// API to fetch transaction history
router.get("/transactions", requireSession, requireAdminRole, sanitizeInput, async (req, res) => {
    const filter = req.query.filter || "today";

    try {
        // Validate filter input
        if (!validateFilterInput(filter)) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid filter parameter",
                validOptions: ["today", "monthly", "6months", "yearly"]
            });
        }

        // Store operation in session for audit
        req.session.lastOperation = {
            type: 'transaction_history_view',
            timestamp: new Date().toISOString(),
            filter: filter,
            userID: req.session.userID
        };

        const result = await withTransaction(async (connection) => {
            // Get the start and end dates based on the filter
            const { startDate, endDate } = getDateRange(filter);
            
            // SQL query with parameterized inputs
            const query = `
                SELECT 
                    TransactionID, 
                    CardID, 
                    Amount, 
                    Type, 
                    EmployeeID, 
                    GameID, 
                    Remarks, 
                    Method,
                    TransactionTime, 
                    CONVERT_TZ(TransactionTime, '+00:00', 'Asia/Kolkata') AS FormattedTransactionTime 
                FROM Transactions
                WHERE TransactionTime BETWEEN ? AND ?
                ORDER BY TransactionTime DESC
                LIMIT 1000
            `;

            // Execute the query
            const [transactions] = await connection.execute(query, [startDate, endDate]);
            return transactions;
        });

        res.status(200).json({ 
            success: true, 
            data: result,
            filter: filter,
            sessionId: req.session.id
        });

    } catch (error) {
        console.error("Transaction history query error:", error.message);
        res.status(500).json({ 
            success: false, 
            error: "Database query error", 
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// API to fetch specific transaction history by CardID or EmployeeID
router.get("/history", requireSession, requireAdminRole, sanitizeInput, async (req, res) => {
    let { cardID, empID } = req.query;

    try {
        // Convert empty strings to undefined and trim
        cardID = cardID?.trim() || undefined;
        empID = empID?.trim() || undefined;

        // Ensure at least one filter is provided
        if (!cardID && !empID) {
            return res.status(400).json({ 
                success: false, 
                error: "Please provide either CardID or EmployeeID." 
            });
        }

        // Validate input
        const validationErrors = validateTransactionQuery({ cardID, empID });
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                success: false,
                error: "Validation failed", 
                details: validationErrors 
            });
        }

        // Store operation in session for audit
        req.session.lastOperation = {
            type: 'specific_transaction_history_view',
            timestamp: new Date().toISOString(),
            cardID: cardID,
            empID: empID,
            userID: req.session.userID
        };

        const result = await withTransaction(async (connection) => {
            // Build dynamic query with proper parameterization
            let query = `
                SELECT 
                    TransactionID, 
                    CardID, 
                    Amount, 
                    Type, 
                    EmployeeID, 
                    GameID, 
                    Remarks, 
                    Method,
                    TransactionTime, 
                    CONVERT_TZ(TransactionTime, '+00:00', 'Asia/Kolkata') AS FormattedTransactionTime 
                FROM Transactions
            `;

            const params = [];
            const conditions = [];

            // Add filters dynamically
            if (cardID) {
                conditions.push("CardID = ?");
                params.push(cardID);
            }
            if (empID) {
                conditions.push("EmployeeID = ?");
                params.push(empID);
            }

            // Apply WHERE conditions
            if (conditions.length > 0) {
                query += " WHERE " + conditions.join(" OR "); // Use OR so it works with either
            }

            query += " ORDER BY TransactionTime DESC LIMIT 500"; // Add reasonable limit

            // Execute the query
            const [transactions] = await connection.execute(query, params);
            return transactions;
        });

        res.status(200).json({ 
            success: true, 
            data: result,
            filters: { cardID, empID },
            sessionId: req.session.id
        });

    } catch (error) {
        console.error("History query error:", error.message);
        res.status(500).json({ 
            success: false, 
            error: "Database query error", 
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// API to get employee list
router.get("/emp_list", requireSession, requireAdminRole, sanitizeInput, async (req, res) => {
    try {
        // Store operation in session for audit
        req.session.lastOperation = {
            type: 'employee_list_view',
            timestamp: new Date().toISOString(),
            userID: req.session.userID
        };

        const result = await withTransaction(async (connection) => {
            // Query with explicit field selection (avoid SELECT *)
            const query = `
                SELECT 
                    id, 
                    userID, 
                    mobile, 
                    name, 
                    address, 
                    role, 
                    created_at, 
                    updated_at 
                FROM Employee 
                ORDER BY created_at DESC
            `;
            
            const [empList] = await connection.execute(query);
            return empList;
        });

        if (!result || result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No employees found",
                status: "10003",
                employees: [],
                sessionId: req.session.id
            });
        }

        return res.status(200).json({
            success: true,
            message: "Employee list retrieved successfully",
            status: "10001",
            employees: result,
            count: result.length,
            sessionId: req.session.id
        });

    } catch (error) {
        console.error("Error retrieving employees:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: "10005",
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// API to get transaction statistics (bonus endpoint for admin dashboard)
router.get("/stats", requireSession, requireAdminRole, sanitizeInput, async (req, res) => {
    const filter = req.query.filter || "today";

    try {
        // Validate filter input
        if (!validateFilterInput(filter)) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid filter parameter",
                validOptions: ["today", "monthly", "6months", "yearly"]
            });
        }

        // Store operation in session for audit
        req.session.lastOperation = {
            type: 'transaction_stats_view',
            timestamp: new Date().toISOString(),
            filter: filter,
            userID: req.session.userID
        };

        const result = await withTransaction(async (connection) => {
            const { startDate, endDate } = getDateRange(filter);
            
            const statsQuery = `
                SELECT 
                    COUNT(*) as totalTransactions,
                    SUM(CASE WHEN Amount > 0 THEN Amount ELSE 0 END) as totalCredits,
                    SUM(CASE WHEN Amount < 0 THEN ABS(Amount) ELSE 0 END) as totalDebits,
                    SUM(Amount) as netAmount,
                    COUNT(DISTINCT CardID) as uniqueCards,
                    COUNT(DISTINCT EmployeeID) as activeEmployees
                FROM Transactions
                WHERE TransactionTime BETWEEN ? AND ?
            `;

            const [stats] = await connection.execute(statsQuery, [startDate, endDate]);
            return stats[0];
        });

        res.status(200).json({
            success: true,
            data: result,
            filter: filter,
            sessionId: req.session.id
        });

    } catch (error) {
        console.error("Stats query error:", error.message);
        res.status(500).json({
            success: false,
            error: "Database query error",
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;