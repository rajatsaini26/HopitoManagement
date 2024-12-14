const pool = require('../config/db');

const Employee = {
    async findByMobile(mobile) {
        const [result] = await pool.query('SELECT * FROM Employee WHERE mobile = ?', [mobile]);
        return result.length > 0 ? result[0] : null;
    },

    async findById(employeeId) {
        const [result] = await pool.query('SELECT * FROM Employee WHERE id = ?', [employeeId]);
        return result.length > 0 ? result[0] : null;
    },

    async create({ mobile, name, address, userID, password, otp }) {
        const query = `
            INSERT INTO Employee (mobile, name, address, userID, password, otp) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const values = [mobile, name, address, userID, password, otp];
        await pool.query(query, values);
    },

    async update(employeeId, { name, address }) {
        const query = `
            UPDATE Employee 
            SET name = ?, address = ? 
            WHERE id = ?
        `;
        await pool.query(query, [name, address, employeeId]);
    },

};

module.exports = Employee;
