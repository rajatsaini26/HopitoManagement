const mysql = require('mysql2');
require('dotenv').config();

// Create the connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3307, // Specify port if it's not the default
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test and log connection status
const connectDB = async () => {
    try {
        const connection = await pool.promise().getConnection();
        console.log('MySQL Connected');
        connection.release();
    } catch (error) {
        console.error(`Error in db: ${error.message}`);
        console.error(error.stack);  // Log the full error stack for debugging
        process.exit(1); // Exit if there's an error
    }
};


// Export both the pool and connectDB function
module.exports = {
    connectDB,
    pool: pool.promise(), // Export the promise-based pool for queries
};
