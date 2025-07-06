const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

const Admin = sequelize.define('Admin', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'admin'
    }
}, {
    tableName: 'admin',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Business logic methods for admin operations
Admin.getDailyTotals = async function() {
    const query = `
        SELECT DATE(created_at) AS date, 
               SUM(amount) AS total_amount,
               COUNT(*) AS transaction_count
        FROM transactionHistory 
        WHERE DATE(created_at) = CURDATE()
        GROUP BY DATE(created_at)
    `;
    const [results] = await sequelize.query(query);
    return results;
};

Admin.getEmployeePerformance = async function() {
    const query = `
        SELECT e.name, e.id as employee_id,
               COUNT(th.id) AS transactions_count, 
               SUM(th.amount) AS total_amount,
               DATE(th.created_at) AS date
        FROM employees e 
        LEFT JOIN transactionHistory th ON e.id = th.emp_id 
        WHERE DATE(th.created_at) = CURDATE()
        GROUP BY e.id, e.name, DATE(th.created_at)
        ORDER BY total_amount DESC
    `;
    const [results] = await sequelize.query(query);
    return results;
};

Admin.getCustomerOverview = async function() {
    const query = `
        SELECT COUNT(*) AS total_customers, 
               SUM(balance) AS total_balance,
               AVG(balance) AS avg_balance
        FROM customer
    `;
    const [results] = await sequelize.query(query);
    return results.length > 0 ? results[0] : null;
};

Admin.getTransactionSummary = async function(startDate, endDate) {
    const query = `
        SELECT 
            type,
            transaction_type,
            COUNT(*) as count,
            SUM(amount) as total_amount
        FROM transactionHistory 
        WHERE created_at BETWEEN ? AND ?
        GROUP BY type, transaction_type
        ORDER BY total_amount DESC
    `;
    const [results] = await sequelize.query(query, {
        replacements: [startDate, endDate]
    });
    return results;
};

module.exports = Admin;