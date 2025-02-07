const express = require('express');
const { pool } = require('../config/db'); 
const { generateUserID } = require('../utils/generateUserID');
require('dotenv').config();

const router = express.Router();

// API to issue a card to a Customer
router.post('/issue', async (req, res) => {
    const { mobile, name, balance, card, userID, pin , address, method} = req.body;
    try {
        // Validate input
        if (!mobile || !name || !card || balance == null || balance < 0 || !userID || !pin || !address ||!method) {
            return res.status(400).json({ error: 'Valid mobile, name, card, initial balance, and PIN are required.' });
        }

        // Validate OTP from Employee table
        const checkOtpQuery = 'SELECT otp FROM Employee WHERE userID = ?';
        const [otpRows] = await pool.query(checkOtpQuery, [userID]);

        if (otpRows.length === 0 || otpRows[0].otp !== pin) {
            return res.status(401).json({ error: 'Invalid PIN. Issuance not authorized.' });
        }

        // Check if the card already exists
        const checkCardQuery = 'SELECT id FROM Customer WHERE card = ?';
        const [existingCard] = await pool.query(checkCardQuery, [card]);
        if (existingCard.length > 0) {
            return res.status(400).json({ error: 'Card already issued to another Customer.' });
        }

        // Insert the new Customer
        const insertCustomerQuery = 'INSERT INTO Customer (mobile, name, balance, card, created_at, updated_at, address) VALUES (?, ?, ?, ?, NOW(), NOW(), ?)';
        const [result] = await pool.query(insertCustomerQuery, [mobile, name, balance, card, address]);

        // Record the transaction
        const insertTransactionQuery = 'INSERT INTO Transactions (CardID, Amount, EmployeeID,TransactionTime ,Type, Remarks, Method) VALUES (?, ?, ?, NOW(), ?, ?,?)';
        const [transactionResult] = await pool.query(insertTransactionQuery, [card, balance, userID, 'credit', 'New Card', method]);

        res.status(201).json({
            status: 1001,
            message: 'Card issued successfully.',
            Customer_id: result.insertId
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
});

// API to recharge a card
router.post('/recharge', async (req, res) => {
    const { card, recharge, userID, method, pin } = req.body;
    try {
        if (!card || recharge == null || recharge < 0 || !userID || !method || !pin) {
            console.log("Validation Failed");
            return res.status(400).json({ error: 'Check Values and Method' });
        }

        // Validate OTP from Employee table
        const checkOtpQuery = 'SELECT otp FROM Employee WHERE userID = ?';
        const [otpRows] = await pool.query(checkOtpQuery, [userID]);
        if (otpRows.length === 0 || otpRows[0].otp !== pin) {
            return res.status(401).json({ error: 'Invalid OTP. Recharge not authorized.' });
        }

        // Check if the card exists
        const checkCardQuery = 'SELECT balance FROM Customer WHERE card = ?';
        const [cardRows] = await pool.query(checkCardQuery, [card]);
        if (cardRows.length === 0) {
            return res.status(404).json({ error: 'Card not found.' });
        }

        const currentBalance = parseInt(cardRows[0].balance, 10); // Parse as an integer
        const rechargeAmount = parseInt(recharge, 10);            // Assuming rechargeAmount is the input
        const newBalance = currentBalance + rechargeAmount;       // Perform addition
        // Update the balance in the Customer table
        const updateBalanceQuery = 'UPDATE Customer SET balance = ? WHERE card = ?';
        await pool.query(updateBalanceQuery, [newBalance, card]);

        // Record the transaction
        const insertTransactionQuery = 'INSERT INTO Transactions (CardID, Amount, EmployeeID,TransactionTime ,Type, Remarks, Method) VALUES (?, ?, ?, NOW(), ?, ?, ?)';
        const [transactionResult] = await pool.query(insertTransactionQuery, [card, rechargeAmount, userID, 'credit', 'Recharge', method]);

        // Send response back to the client
        res.status(200).json({
            status: "1001",
            message: 'Card recharged successfully.',
            card,
            recharge_amount: recharge,
            new_balance: newBalance
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// API to deduct balance from a card
router.post('/deduct', async (req, res) => {
    const { card, userID, game_id } = req.body;

    try {
        if (!card || !game_id || !userID) {
            return res.status(400).json({ error: 'Card and Game ID are required.' });
        }

        // Retrieve the charge amount for the game
        const getGameChargeQuery = 'SELECT Charge FROM games WHERE id = ?';
        const [gameRows] = await pool.query(getGameChargeQuery, [game_id]);

        if (gameRows.length === 0) {
            return res.status(404).json({ error: 'Game not found.' });
        }

        const deduct = gameRows[0].Charge;

        // Check if the card exists
        const checkCardQuery = 'SELECT balance FROM Customer WHERE card = ?';
        const [rows] = await pool.query(checkCardQuery, [card]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Card not found.' });
        }

        const currentBalance = rows[0].balance;
        if (currentBalance < deduct) {
            return res.status(400).json({ error: 'Insufficient balance.' });
        }

        const newBalance = currentBalance - deduct;

        // Update the balance
        const updateBalanceQuery = 'UPDATE Customer SET balance = ? WHERE card = ?';
        await pool.query(updateBalanceQuery, [newBalance, card]);

        // Record the transaction
        const insertTransactionQuery = 'INSERT INTO transaction (card, amount, userID, date, type, game_id) VALUES (?, ?, ?, NOW(), ?, ?)';
        const [transactionResult] = await pool.query(insertTransactionQuery, [card, deduct, userID, 'deduction', game_id]);

        // Record the transaction history
        const insertHistoryQuery = 'INSERT INTO transactionhistory (card, transaction_id, amount, date, game_id, type, created_at, updated_at) VALUES (?, ?, ?, NOW(), ?, ?, NOW(), NOW())';
        await pool.query(insertHistoryQuery, [card, transactionResult.insertId, deduct, game_id, 'deduction']);
        console.log("deduction success!");

        res.status(200).json({
            status: "1001",
            message: 'Card deducted successfully.',
            card,
            charge_deduction: deduct,
            balance: newBalance
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// API to check if a card exists
router.post('/check-card', async (req, res) => {
    const { card } = req.body;

    try {
        // Validate input
        if (!card) {
            return res.status(400).json({ error: 'Card number is required.' });
        }

        // Query to check if the card exists in the Customer table
        const checkCardQuery = 'SELECT id, balance, created_at FROM Customer WHERE card = ?';
        const [rows] = await pool.query(checkCardQuery, [card]);

        if (rows.length == 0) {
            // Card does not exist
            return res.status(202).json({ 
                status:"1003",
                route:"AddCard",
                message: 'Card not found in the system.' 
            });
        }
        console.log("checked success!");

        // Card exists, return the Customer details
        const Customer = rows[0];
        res.status(200).json({
            status: '1001',
            route: "RechargeScreen",
            message: 'Card already exists.',
            Customer_id: Customer.id,
            balance: Customer.balance,
            created_at: Customer.created_at
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


module.exports = router;
