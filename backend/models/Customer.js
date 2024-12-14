const pool = require('../config/db');

const Customer = {
    async findByCard(card) {
        const [result] = await pool.query('SELECT * FROM Customer WHERE card = ?', [card]);
        return result.length > 0 ? result[0] : null;
    },

    // async findById(customerId) {
    //     const [result] = await pool.query('SELECT * FROM Customer WHERE id = ?', [customerId]);
    //     return result.length > 0 ? result[0] : null;
    // },

    async create({ name, card, balance }) {
        const query = `
            INSERT INTO Customer (name, card, balance) 
            VALUES (?, ?, ?)
        `;
        const values = [name, card, balance];
        await pool.query(query, values);
    },

    async updateBalance(customerId, amount) {
        const query = `
            UPDATE Customer 
            SET balance = balance + ? 
            WHERE id = ?
        `;
        await pool.query(query, [amount, customerId]);
    },

};

module.exports = Customer;
