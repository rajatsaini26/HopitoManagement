const pool = require('../config/db');

const TransactionHistory = {
    async getByCustomerId(customerId) {
        const query = `
            SELECT t.id, t.amount, t.type, t.timestamp, e.name AS employee_name 
            FROM Transaction t 
            JOIN Employee e ON t.employee_id = e.id 
            WHERE t.card IN (SELECT card FROM Customer WHERE id = ?) 
            ORDER BY t.timestamp DESC
        `;
        const [result] = await pool.query(query, [customerId]);
        return result;
    },

    async getAll() {
        const query = `
            SELECT t.id, t.card, t.amount, t.type, t.timestamp, e.name AS employee_name 
            FROM Transaction t 
            JOIN Employee e ON t.employee_id = e.id 
            ORDER BY t.timestamp DESC
        `;
        const [result] = await pool.query(query);
        return result;
    },
};

module.exports = TransactionHistory;
