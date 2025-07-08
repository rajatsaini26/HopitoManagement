const express = require('express');
const { Op, literal, fn, col } = require('sequelize'); // Import Op, literal, fn, col from sequelize
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");
const xss = require("xss");
require('dotenv').config();

// Import models
const { TransactionHistory, Employee, Customer, Games, Sessions } = require('../models'); // Assuming index.js exports all models

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
    // Check if the session exists and userRole is defined, and if it's not 'Admin'
    if (!req.session || !req.session.userRole || req.session.userRole !== 'admin') {
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
            startDate = new Date(now.setHours(0, 0, 0, 0));
            endDate = new Date(now.setHours(23, 59, 59, 999));
            break;
        case "monthly":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case "6months":
            startDate = new Date(now.setMonth(now.getMonth() - 6));
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            break;
        case "yearly":
            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
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

        const { startDate, endDate } = getDateRange(filter);

        // Use TransactionHistory model to fetch data
        const transactions = await TransactionHistory.findAll({
            where: {
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: [
                ['id', 'TransactionID'],
                ['card', 'CardID'],
                'amount',
                ['type', 'Method'], // Assuming 'type' in model maps to 'Method' in old schema
                ['emp_id', 'EmployeeID'],
                ['game_id', 'GameID'],
                ['notes', 'Remarks'], // Assuming 'notes' in model maps to 'Remarks' in old schema
                ['transaction_type', 'Type'], // Assuming 'transaction_type' in model maps to 'Type' in old schema
                ['created_at', 'TransactionTime'],
                [literal("CONVERT_TZ(TransactionHistory.created_at, '+00:00', 'Asia/Kolkata')"), 'FormattedTransactionTime']
            ],
            order: [['created_at', 'DESC']],
            limit: 1000,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name']
                },
                {
                    model: Employee,
                    as: 'employee',
                    attributes: ['name']
                },
                {
                    model: Games,
                    as: 'game',
                    attributes: ['game_name'],
                    required: false
                },
                {
                    model: Sessions,
                    as: 'session',
                    attributes: ['id', 'status'],
                    required: false
                }
            ]
        });

        res.status(200).json({
            success: true,
            data: transactions,
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

        const whereClause = {};
        if (cardID) {
            whereClause.card = cardID;
        }
        if (empID) {
            whereClause.emp_id = empID;
        }

        const transactions = await TransactionHistory.findAll({
            where: {
                [Op.or]: [whereClause] // Use Op.or for either cardID or empID
            },
            attributes: [
                ['id', 'TransactionID'],
                ['card', 'CardID'],
                'amount',
                ['type', 'Method'],
                ['emp_id', 'EmployeeID'],
                ['game_id', 'GameID'],
                ['notes', 'Remarks'],
                ['transaction_type', 'Type'],
                ['created_at', 'TransactionTime'],
                [literal("CONVERT_TZ(TransactionHistory.created_at, '+00:00', 'Asia/Kolkata')"), 'FormattedTransactionTime']
            ],
            order: [['created_at', 'DESC']],
            limit: 500,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name']
                },
                {
                    model: Employee,
                    as: 'employee',
                    attributes: ['name']
                },
                {
                    model: Games,
                    as: 'game',
                    attributes: ['game_name'],
                    required: false
                },
                {
                    model: Sessions,
                    as: 'session',
                    attributes: ['id', 'status'],
                    required: false
                }
            ]
        });

        res.status(200).json({
            success: true,
            data: transactions,
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

        const empList = await Employee.findAll({
            attributes: [
                'id',
                'userID',
                'mobile',
                'name',
                'address',
                'role',
                'created_at',
                'updated_at'
            ],
            order: [['created_at', 'DESC']]
        });

        if (!empList || empList.length === 0) {
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
            employees: empList,
            count: empList.length,
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

        const { startDate, endDate } = getDateRange(filter);

        const stats = await TransactionHistory.findOne({
            attributes: [
                [fn('COUNT', col('id')), 'totalTransactions'],
                [fn('SUM', literal('CASE WHEN amount > 0 THEN amount ELSE 0 END')), 'totalCredits'],
                [fn('SUM', literal('CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END')), 'totalDebits'],
                [fn('SUM', col('amount')), 'netAmount'],
                [fn('COUNT', fn('DISTINCT', col('card'))), 'uniqueCards'],
                [fn('COUNT', fn('DISTINCT', col('emp_id'))), 'activeEmployees']
            ],
            where: {
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            raw: true // To get plain data rather than Sequelize instances
        });

        res.status(200).json({
            success: true,
            data: stats,
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