// models/Transaction.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    customer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customer',
            key: 'id'
        }
    },
    card: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'employees',
            key: 'id'
        }
    },
    type: {
        type: DataTypes.ENUM('cash', 'online'),
        allowNull: false,
        defaultValue: 'cash'
    },
    transaction_type: {
        type: DataTypes.ENUM('recharge', 'new_card', 'game_session', 'refund'),
        allowNull: false,
        defaultValue: 'recharge'
    },
    balance_before: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    balance_after: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    game_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'games',
            key: 'id'
        }
    },
    session_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'sessions',
            key: 'id'
        },
        comment: 'Reference to session for game transactions'
    },
    session_time: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Session time in minutes for game transactions'
    },
    discount_applied: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Discount percentage applied'
    },
    discount_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Actual discount amount in currency'
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
        defaultValue: 'completed'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['customer_id', 'transaction_type'], name: 'idx_customer_trans_type' 
        },
        {
            fields: ['emp_id', 'created_at'], name: 'idx_emp_createdat' 
        },
        {
            fields: ['type', 'status'], name: 'idx_type_status'
        },
    ]
});

// Enhanced transaction creation with validation
Transaction.createTransaction = async function({
    customer_id,
    card,
    amount,
    emp_id,
    type = 'cash',
    transaction_type = 'recharge',
    balance_before = 0,
    balance_after,
    game_id = null,
    session_id = null,
    session_time = null,
    discount_applied = 0,
    discount_amount = 0,
    notes = null
}) {
    const ValidationUtils = require('../utils/validations'); //

    // Validate required fields
    ValidationUtils.validateRequiredFields( //
        { customer_id, card, amount, emp_id, balance_after }, //
        ['customer_id', 'card', 'amount', 'emp_id', 'balance_after'] //
    );

    // Validate amount
    ValidationUtils.validateAmount(amount); //

    // Validate balance consistency
    const expectedBalance = parseFloat(balance_before) + parseFloat(amount);
    if (Math.abs(expectedBalance - parseFloat(balance_after)) > 0.01) {
        throw new Error('Balance calculation mismatch');
    }

    return await this.create({
        customer_id,
        card,
        amount,
        emp_id,
        type,
        transaction_type,
        balance_before,
        balance_after,
        game_id,
        session_id,
        session_time,
        discount_applied,
        discount_amount,
        notes
    });
};

// Enhanced query methods with session support
Transaction.findByEmployeeId = async function(empId, limit = 50) {
    return await this.findAll({
        where: { emp_id: empId },
        order: [['created_at', 'DESC']],
        limit,
        include: [
            {
                model: sequelize.models.Customer,
                attributes: ['name', 'card']
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false
            },
            {
                model: sequelize.models.Sessions,
                attributes: ['id', 'status', 'start_time', 'end_time'],
                required: false
            }
        ]
    });
};

Transaction.findByCard = async function(card, limit = 50) {
    return await this.findAll({
        where: { card },
        order: [['created_at', 'DESC']],
        limit,
        include: [
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID']
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false
            },
            {
                model: sequelize.models.Sessions,
                attributes: ['id', 'status', 'start_time', 'end_time'],
                required: false
            }
        ]
    });
};

Transaction.findByCustomerId = async function(customerId, limit = 50) {
    return await this.findAll({
        where: { customer_id: customerId },
        order: [['created_at', 'DESC']],
        limit,
        include: [
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID']
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false
            },
            {
                model: sequelize.models.Sessions,
                attributes: ['id', 'status', 'start_time', 'end_time'],
                required: false
            }
        ]
    });
};

Transaction.findBySessionId = async function(sessionId) {
    return await this.findAll({
        where: { session_id: sessionId },
        order: [['created_at', 'ASC']],
        include: [
            {
                model: sequelize.models.Customer,
                attributes: ['name', 'card']
            },
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID']
            }
        ]
    });
};

Transaction.getDailyTransactions = async function(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.findAll({
        where: {
            created_at: {
                [sequelize.Op.between]: [startOfDay, endOfDay]
            }
        },
        order: [['created_at', 'DESC']],
        include: [
            {
                model: sequelize.models.Customer,
                attributes: ['name', 'card']
            },
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID']
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false
            }
        ]
    });
};

Transaction.getTransactionStats = async function(startDate, endDate) {
    return await this.findAll({
        where: {
            created_at: {
                [sequelize.Op.between]: [startDate, endDate]
            }
        },
        attributes: [
            'transaction_type',
            'type',
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
            [sequelize.fn('AVG', sequelize.col('amount')), 'avg_amount'],
            [sequelize.fn('SUM', sequelize.col('discount_amount')), 'total_discount']
        ],
        group: ['transaction_type', 'type', 'status']
    });
};

Transaction.getEmployeeStats = async function(empId, startDate, endDate) {
    return await this.findAll({
        where: {
            emp_id: empId,
            created_at: {
                [sequelize.Op.between]: [startDate, endDate]
            }
        },
        attributes: [
            'transaction_type',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
            [sequelize.fn('SUM', sequelize.col('discount_amount')), 'total_discount']
        ],
        group: ['transaction_type']
    });
};

// Method to handle session-related transactions
Transaction.createSessionTransaction = async function(sessionData, transactionType = 'game_session') {
    const {
        customer_id,
        card,
        amount,
        emp_id,
        type,
        balance_before,
        balance_after,
        game_id,
        session_id,
        session_time,
        discount_applied,
        discount_amount,
        notes
    } = sessionData;

    return await this.createTransaction({
        customer_id,
        card,
        amount,
        emp_id,
        type,
        transaction_type: transactionType,
        balance_before,
        balance_after,
        game_id,
        session_id,
        session_time,
        discount_applied,
        discount_amount,
        notes
    });
};

// Method to process refund transactions
Transaction.processRefund = async function(originalTransactionId, refundAmount, empId, reason = null) {
    const transaction = await sequelize.transaction();

    try {
        // Get original transaction
        const originalTransaction = await this.findByPk(originalTransactionId, { transaction });
        if (!originalTransaction) {
            throw new Error('Original transaction not found');
        }

        if (originalTransaction.status !== 'completed') {
            throw new Error('Cannot refund non-completed transaction');
        }

        // Get customer and update balance
        const Customer = require('./Customer');
        const customer = await Customer.findByPk(originalTransaction.customer_id, { transaction });

        const balanceBefore = parseFloat(customer.balance);
        const newBalance = balanceBefore + parseFloat(refundAmount);

        await customer.update({ balance: newBalance }, { transaction });

        // Create refund transaction
        const refundTransaction = await this.create({
            customer_id: originalTransaction.customer_id,
            card: originalTransaction.card,
            amount: Math.abs(refundAmount), // Positive for refund
            emp_id: empId,
            type: originalTransaction.type,
            transaction_type: 'refund',
            balance_before: balanceBefore,
            balance_after: newBalance,
            game_id: originalTransaction.game_id,
            session_id: originalTransaction.session_id,
            session_time: originalTransaction.session_time,
            notes: reason || `Refund for transaction #${originalTransactionId}`
        }, { transaction });

        await transaction.commit();
        return refundTransaction;

    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to process refund: ${error.message}`);
    }
};

module.exports = Transaction;