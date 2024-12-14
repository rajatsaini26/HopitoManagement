const pool = require('../config/db');

const Admin = {
    async getDailyTotals() {
        const query = `
            SELECT DATE(timestamp) AS date, SUM(amount) AS total_amount 
            FROM Transaction 
            GROUP BY DATE(timestamp)
        `;
        const [result] = await pool.query(query);
        return result;
    },

    async getEmployeePerformance() {
        const query = `
            SELECT e.name, COUNT(t.id) AS transactions_count, SUM(t.amount) AS total_amount 
            FROM Employee e 
            LEFT JOIN Transaction t ON e.id = t.employee_id 
            GROUP BY e.id
        `;
        const [result] = await pool.query(query);
        return result;
    },

    async getCustomerOverview() {
        const query = `
            SELECT COUNT(*) AS total_customers, SUM(balance) AS total_balance 
            FROM Customer
        `;
        const [result] = await pool.query(query);
        return result.length > 0 ? result[0] : null;
    },
};

module.exports = Admin;
