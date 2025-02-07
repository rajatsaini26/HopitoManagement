const express = require('express');
const { pool } = require('../config/db'); // Assuming your MySQL config is in 'config/db'

require('dotenv').config();

const router = express.Router();

// Register Game
// NOTE METHOD -POST ,   BODY-> ID, NAME, CHARGE, SESSION, discount 

router.post('/add', async (req, res) => {
    const { name, charge, session, discount } = req.body;
    console.log(req.body);
    try {
        if (!name || charge == null  ) {
            return res.status(400).json({ error: 'Game name and charge are required.' });
        }

        const query = 'INSERT INTO Games (GameName, Charge, SessionTime, Discount) VALUES (?, ?, ?, ?)';
        const [results] = await pool.query(query, [name, charge, session, discount ]); // No need for .promise() here

        res.status(201).json({
            message: 'Game added successfully.',
            gameId: results.insertId,
            time: session
        });
    } catch (error) {
        console.error('Error adding game:', error);
        res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
    }
});

// Update Game
// NOTE METHOD - PUT,   BODY-> ID & updating field 
router.put('/update', async (req, res) => {
    const { id, name, charge, session,discount } = req.body; // Get the game ID and new details from the request body

    try {
        // Validate input
        if (!id) {
            return res.status(400).json({ error: 'Game ID is required.' });
        }

        if (!name && charge == null && !session) {
            return res.status(400).json({ error: 'At least one field (name or charge) is required to update.' });
        }

        // Build the update query dynamically based on provided fields
        const updates = [];
        const values = [];

        if (name) {
            updates.push('GameName = ?');
            values.push(name);
        }
        if(session){
            updates.push('SessionTime=?');
            values.push(session);
        }
        if (charge != null) {
            updates.push('Charge = ?');
            values.push(charge);
        }
        if (discount != null) {
            updates.push('Discount = ?');
            values.push(discount);
        }

        // Add the game ID to the values for the WHERE clause
        values.push(id);

        const query = `UPDATE Games SET ${updates.join(', ')} WHERE GameID = ?`;
        const [results] = await pool.query(query, values);

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Game not found.' });
        }

        res.status(200).json({
            message: 'Game updated successfully.',
            affectedRows: results.affectedRows
        });
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
    }
});

// Delete Game
// NOTE METHOD - DELETE, BODY-> id
router.delete('/delete', async (req, res) => {
    const { id } = req.body; // Get the game ID from the request body

    try {
        // Validate input
        if (!id) {
            return res.status(400).json({ error: 'Game ID is required.' });
        }

        const query = 'DELETE FROM games WHERE GameID = ?';
        const [results] = await pool.query(query, [id]);

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Game not found.' });
        }

        res.status(200).json({
            message: 'Game deleted successfully.',
            affectedRows: results.affectedRows
        });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
    }
});

router.get('/gamedetails', async (req, res) => {
    const { id } = req.query;
    try {
        if (!id || id == null  ) {
            return res.status(400).json({ error: 'Game ID are required.' });
        }
        const results = await pool.query('SELECT * FROM Games WHERE GameID=?',[id]); // No need for .promise() here
        const game = results[0][0]; // ✅ Accessing the first element correctly
        console.log(game);
        res.status(200).json({
            message: 'Game found.',
            GameID: game.GameID,
            Name: game.GameName,
            Charge: game.Charge,
            Session: game.SessionTime,
            Discount: game.Discount
        });
    } catch (error) {
        console.error('Error adding game:', error);
        res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
    }
});

router.get("/gameList", async (req, res) => {
    try {
        const [gameList] = await pool.query("SELECT * FROM Games");
        console.log(gameList);

        if (!gameList || gameList.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No Games found",
                status: "10003",
                employees: [],
            });
        }

        return res.status(200).json({
            success: true,
            message: "Game list retrieved successfully",
            status: "10001",
            games: gameList,
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
