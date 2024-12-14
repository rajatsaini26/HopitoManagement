const pool = require('../config/db');

const Transaction = {
    async create({ card, amount, employeeId, type }) {
        const query = `
            INSERT INTO Transaction (card, amount, employee_id, type, timestamp) 
            VALUES (?, ?, ?, ?, NOW())
        `;
        const values = [card, amount, employeeId, type];
        await pool.query(query, values);
    },

    async findByEmployeeId(employeeId) {
        const query = `SELECT * FROM Transaction WHERE employee_id = ? ORDER BY timestamp DESC`;
        const [result] = await pool.query(query, [employeeId]);
        return result;
    },

    async findByCard(card) {
        const query = `SELECT * FROM Transaction WHERE card = ? ORDER BY timestamp DESC`;
        const [result] = await pool.query(query, [card]);
        return result;
    },
};

module.exports = Transaction;
