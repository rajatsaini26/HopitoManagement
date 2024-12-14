const mysql = require('mysql2');
require('dotenv').config();

// Create the connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test and log connection status
const connectDB = async () => {
    try {
        const connection = await pool.promise().getConnection(); // Use promise-based connection
        console.log('MySQL Connected');
        connection.release(); // Release the connection back to the pool
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

// Export both the pool and connectDB function
module.exports = {
    connectDB,
    pool: pool.promise(), // Export the promise-based pool for queries
};
