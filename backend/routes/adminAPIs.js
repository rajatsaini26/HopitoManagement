const express = require('express');
const { pool } = require('../config/db');
require('dotenv').config();

const router = express.Router();

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
router.get("/transactions", async (req, res) => {
    const filter = req.query.filter || "today";

    // Validate filter input
    const validFilters = ["today", "monthly", "6months", "yearly"];
    if (!validFilters.includes(filter)) {
        return res.status(400).json({ success: false, error: "Invalid filter parameter" });
    }

    try {
        // Get the start and end dates based on the filter
        const { startDate, endDate } = getDateRange(filter);
        // SQL query
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
        `;

        // Execute the query
        const [transactions] = await pool.execute(query, [startDate, endDate]);

        res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ success: false, error: "Database query error", details: error.message });
    }
});

router.get("/history", async (req, res) => {
    const { cardID, empID } = req.query;

    // Validate input (at least one filter must be provided)
    if (!cardID || !empID) {
        return res.status(400).json({ success: false, error: "Please provide either CardID or EmployeeID." });
    }
    console.log(cardID, empID);
    try {
        // Build dynamic query based on provided parameters
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

        if (cardID) {
            conditions.push("CardID = ?");
            params.push(cardID);
        }
        if (empID) {
            conditions.push("EmployeeID = ?");
            params.push(empID);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY TransactionTime DESC";

        // Execute the query
        const [transactions] = await pool.execute(query, params);

        res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ success: false, error: "Database query error", details: error.message });
    }
});


router.get("/emp_list", async (req, res) => {
    try {
        const [empList] = await pool.query("SELECT * FROM Employee");
        console.log(empList);

        if (!empList || empList.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No employees found",
                status: "10003",
                employees: [],
            });
        }

        return res.status(200).json({
            success: true,
            message: "Employee list retrieved successfully",
            status: "10001",
            employees: empList,
        });

    } catch (error) {
        console.error("Error retrieving employees:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: "10005",
        });
    }
});


module.exports = router;