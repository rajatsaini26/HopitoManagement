const express = require('express');
const { pool } = require('../config/db'); 
require('dotenv').config();

const router = express.Router();
// API to recharge a card
router.post('/recharge', async (req, res) => {
    const { card, recharge, userID } = req.body;

    try {
        // Validate input
        if (!card || recharge == null || recharge <= 0 || !userID) {
            return res.status(400).json({ error: 'Check Values' });
        }

        // Check if the card exists
        const checkCardQuery = 'SELECT balance FROM customer WHERE card = ?';
        const [rows] = await pool.query(checkCardQuery, [card]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Card not found.' });
        }

        const currentBalance = rows[0].balance;
        const newBalance = currentBalance + recharge;

        // Update the balance in the customer table
        const updateBalanceQuery = 'UPDATE customer SET balance = ? WHERE card = ?';
        await pool.query(updateBalanceQuery, [newBalance, card]);

        // Record the transaction in the transaction table
        const insertTransactionQuery = 'INSERT INTO transaction (card, amount, userID, date, type) VALUES (?, ?, ?, NOW(), ?)';
        const [transactionResult] = await pool.query(insertTransactionQuery, [card, recharge, userID, 'recharge']);

        // Record the transaction history
        const insertHistoryQuery = 'INSERT INTO transactionhistory (card, transaction_id, amount, date, type, created_at, updated_at) VALUES (?, ?, ?, NOW(), ?, NOW(), NOW())';
        await pool.query(insertHistoryQuery, [card, transactionResult.insertId, recharge, 'recharge']);

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
        if (!card || !game_id) {
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
        const checkCardQuery = 'SELECT balance FROM customer WHERE card = ?';
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
        const updateBalanceQuery = 'UPDATE customer SET balance = ? WHERE card = ?';
        await pool.query(updateBalanceQuery, [newBalance, card]);

        // Record the transaction
        const insertTransactionQuery = 'INSERT INTO transaction (card, amount, userID, date, type, game_id) VALUES (?, ?, ?, NOW(), ?, ?)';
        const [transactionResult] = await pool.query(insertTransactionQuery, [card, deduct, userID, 'deduction', game_id]);

        // Record the transaction history
        const insertHistoryQuery = 'INSERT INTO transactionhistory (card, transaction_id, amount, date, game_id, type, created_at, updated_at) VALUES (?, ?, ?, NOW(), ?, ?, NOW(), NOW())';
        await pool.query(insertHistoryQuery, [card, transactionResult.insertId, deduct, game_id, 'deduction']);

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

// API to issue a card to a customer
router.post('/issue', async (req, res) => {
    const { mobile, name, balance, card, userID } = req.body;

    try {
        // Validate input
        if (!mobile || !name || !card || balance == null || balance < 0) {
            return res.status(400).json({ error: 'Valid mobile, name, card, and initial balance are required.' });
        }

        // Check if the card already exists
        const checkCardQuery = 'SELECT id FROM customer WHERE card = ?';
        const [existingCard] = await pool.query(checkCardQuery, [card]);

        if (existingCard.length > 0) {
            return res.status(400).json({ error: 'Card already issued to another customer.' });
        }

        // Insert the new customer
        const insertCustomerQuery = 'INSERT INTO customer (mobile, name, balance, card, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())';
        const [result] = await pool.query(insertCustomerQuery, [mobile, name, balance, card]);

        // Record the transaction
        const insertTransactionQuery = 'INSERT INTO transaction (card, amount, userID, date, type) VALUES (?, ?, ?, NOW(), ?)';
        const [transactionResult] = await pool.query(insertTransactionQuery, [card, balance, userID, 'issue']);

        // Record the transaction history
        const insertHistoryQuery = 'INSERT INTO transactionhistory (card, transaction_id, amount, date, type, created_at, updated_at) VALUES (?, ?, ?, NOW(), ?, NOW(), NOW())';
        await pool.query(insertHistoryQuery, [card, transactionResult.insertId, balance, 'issue']);

        res.status(201).json({
            message: 'Card issued successfully.',
            customer_id: result.insertId
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
});

// API to run a Python script
app.post('/scanner', (req, res) => {
    const input = req.body; // Capture input from the client

    // Spawn a Python process
    const pythonProcess = spawn('python', ['../config/scanner.py', JSON.stringify(input)]);

    let scriptOutput = '';
    let errorOutput = '';

    // Capture Python script's stdout
    pythonProcess.stdout.on('data', (data) => {
        scriptOutput += data.toString();
    });

    // Capture Python script's stderr
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    // Handle process close event
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(200).json({ success: true, output: scriptOutput });
        } else {
            res.status(500).json({ success: false, error: errorOutput || 'Unknown error occurred.' });
        }
    });
});

module.exports = router;
