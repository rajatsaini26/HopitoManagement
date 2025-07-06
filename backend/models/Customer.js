const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

const Customer = sequelize.define('Customer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    card: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'blocked'),
        defaultValue: 'active'
    }
}, {
    tableName: 'customer',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Static methods to maintain the same interface
Customer.findByCard = async function(card) {
    const customer = await this.findOne({ where: { card } });
    return customer;
};

Customer.createCustomer = async function({ name, card, balance = 0, phone = null, email = null }) {
    return await this.create({
        name,
        card,
        balance,
        phone,
        email
    });
};

// Main business logic: Update balance and create transaction records
Customer.updateBalance = async function(customerId, amount, empId, type = 'cash', transactionType = 'recharge') {
    const transaction = await sequelize.transaction();
    
    try {
        // Find customer
        const customer = await this.findByPk(customerId, { transaction });
        if (!customer) {
            throw new Error('Customer not found');
        }

        // Update customer balance
        const newBalance = parseFloat(customer.balance) + parseFloat(amount);
        await customer.update({ balance: newBalance }, { transaction });

        // Create transaction record
        const Transaction = require('./Transaction');
        const transactionRecord = await Transaction.create({
            customer_id: customerId,
            card: customer.card,
            amount: amount,
            emp_id: empId,
            type: type,
            transaction_type: transactionType,
            balance_before: customer.balance,
            balance_after: newBalance
        }, { transaction });

        // Create transaction history record
        const TransactionHistory = require('./TransactionHistory');
        await TransactionHistory.create({
            customer_id: customerId,
            card: customer.card,
            amount: amount,
            emp_id: empId,
            type: type,
            transaction_type: transactionType,
            balance_before: customer.balance,
            balance_after: newBalance,
            transaction_id: transactionRecord.id
        }, { transaction });

        await transaction.commit();
        return customer;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

// Method to handle new card creation with initial balance
Customer.createNewCard = async function({ name, card, initialBalance, empId, type = 'cash', phone = null, email = null }) {
    const transaction = await sequelize.transaction();
    
    try {
        // Create customer
        const customer = await this.create({
            name,
            card,
            balance: initialBalance,
            phone,
            email
        }, { transaction });

        // Create transaction record for new card
        const Transaction = require('./Transaction');
        const transactionRecord = await Transaction.create({
            customer_id: customer.id,
            card: card,
            amount: initialBalance,
            emp_id: empId,
            type: type,
            transaction_type: 'new_card',
            balance_before: 0,
            balance_after: initialBalance
        }, { transaction });

        // Create transaction history record
        const TransactionHistory = require('./TransactionHistory');
        await TransactionHistory.create({
            customer_id: customer.id,
            card: card,
            amount: initialBalance,
            emp_id: empId,
            type: type,
            transaction_type: 'new_card',
            balance_before: 0,
            balance_after: initialBalance,
            transaction_id: transactionRecord.id
        }, { transaction });

        await transaction.commit();
        return customer;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

// Get customer transaction history
Customer.getTransactionHistory = async function(customerId, limit = 50) {
    const TransactionHistory = require('./TransactionHistory');
    return await TransactionHistory.findAll({
        where: { customer_id: customerId },
        order: [['created_at', 'DESC']],
        limit: limit
    });
};

module.exports = Customer;