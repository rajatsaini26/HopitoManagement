const { pool } = require('../config/db'); // Assuming your MySQL config is in 'config/db'

async function generateUserID() {
    try {
        // Use the promise API directly for the query
        const query = `
            UPDATE counter
            SET seq = seq + 1
            WHERE id = 'employeeID';
        `;

        // Perform the query and wait for the result
        const [updateResults] = await pool.query(query);

        // Check if the update affected any rows
        if (updateResults.affectedRows === 0) {
            throw new Error('No rows updated. Ensure that the counter table has the correct entry for employeeID.');
        }

        // Now fetch the new sequence value
        const [rows] = await pool.query('SELECT seq FROM counter WHERE id = "employeeID";');

        if (rows.length > 0) {
            const newUserID = rows[0].seq;
            return newUserID; // Return the new user ID
        } else {
            throw new Error('Counter for employeeID not found in database.');
        }
    } catch (err) {
        console.error('Error generating userID:', err);
        throw err; // Propagate the error
    }
}

module.exports = { generateUserID };
