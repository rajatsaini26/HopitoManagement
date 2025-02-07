const { pool } = require('../config/db'); // Assuming your MySQL config is in 'config/db'

async function generateUserID() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction(); // Start a transaction

        // Increment the sequence
        const updateQuery = `
            UPDATE counter
            SET seq = seq + 1
            WHERE id = 'employeeID';
        `;
        const [updateResults] = await connection.query(updateQuery);

        // Check if the update affected any rows
        if (updateResults.affectedRows === 0) {
            throw new Error('No rows updated. Ensure that the counter table has the correct entry for employeeID.');
        }

        // Now fetch the new sequence value
        const [rows] = await connection.query('SELECT seq FROM counter WHERE id = "employeeID";');

        if (rows.length > 0) {
            const newUserID = rows[0].seq;
            await connection.commit(); // Commit the transaction
            return newUserID; // Return the new user ID
        } else {
            throw new Error('Counter for employeeID not found in database.');
        }
    } catch (err) {
        await connection.rollback(); // Rollback the transaction on error
        console.error('Error generating userID:', err);
        throw err; // Propagate the error
    } finally {
        connection.release(); // Release the connection back to the pool
    }
}

module.exports = { generateUserID };