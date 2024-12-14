const express = require('express');
const { pool } = require('../config/db'); // Assuming your MySQL config is in 'config/db'

require('dotenv').config();

const router = express.Router();

// Register Game
// NOTE METHOD -POST ,   BODY-> ID, NAME, CHARGE, SESSION 

router.post('/add', async (req, res) => {
    const { name, charge, session } = req.body;

    try {
        if ((!name || charge == null )&& !session ) {
            return res.status(400).json({ error: 'Game name and charge are required.' });
        }

        if (typeof charge !== 'number') {
            return res.status(400).json({ error: 'Charge must be a number.' });
        }

        const query = 'INSERT INTO games (Name, Charge, session_time) VALUES (?, ?, ?)';
        const [results] = await pool.query(query, [name, charge, session]); // No need for .promise() here

        res.status(201).json({
            message: 'Game added successfully.',
            gameId: results.insertId,
            time: session/1000
        });
    } catch (error) {
        console.error('Error adding game:', error);
        res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
    }
});

// Update Game
// NOTE METHOD - PUT,   BODY-> ID & updating field 
router.put('/update', async (req, res) => {
    const { id, name, charge, session } = req.body; // Get the game ID and new details from the request body

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
            updates.push('Name = ?');
            values.push(name);
        }
        if(session){
            updates.push('session_time=?');
            values.push(session);
        }
        if (charge != null) {
            updates.push('Charge = ?');
            values.push(charge);
        }

        // Add the game ID to the values for the WHERE clause
        values.push(id);

        const query = `UPDATE games SET ${updates.join(', ')} WHERE GameID = ?`;
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


module.exports = router;
