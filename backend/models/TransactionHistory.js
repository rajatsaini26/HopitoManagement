const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

const TransactionHistory = sequelize.define('TransactionHistory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    transaction_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'transactions',
            key: 'id'
        }
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
    session_time: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Session time in minutes for game transactions'
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
    tableName: 'transactionHistory',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Static methods for transaction history queries
TransactionHistory.getByCustomerId = async function(customerId, limit = 50) {
    return await this.findAll({
        where: { customer_id: customerId },
        order: [['created_at', 'DESC']],
        limit: limit,
        include: [
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID'],
                as: 'employee'
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false,
                as: 'game'
            }
        ]
    });
};

TransactionHistory.getAll = async function(limit = 100, offset = 0) {
    return await this.findAll({
        order: [['created_at', 'DESC']],
        limit: limit,
        offset: offset,
        include: [
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID'],
                as: 'employee'
            },
            {
                model: sequelize.models.Customer,
                attributes: ['name'],
                as: 'customer'
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false,
                as: 'game'
            }
        ]
    });
};

TransactionHistory.getByEmployeeId = async function(empId, limit = 50) {
    return await this.findAll({
        where: { emp_id: empId },
        order: [['created_at', 'DESC']],
        limit: limit,
        include: [
            {
                model: sequelize.models.Customer,
                attributes: ['name', 'card'],
                as: 'customer'
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false,
                as: 'game'
            }
        ]
    });
};

TransactionHistory.getByCard = async function(card, limit = 50) {
    return await this.findAll({
        where: { card },
        order: [['created_at', 'DESC']],
        limit: limit,
        include: [
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID'],
                as: 'employee'
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false,
                as: 'game'
            }
        ]
    });
};

TransactionHistory.getByDateRange = async function(startDate, endDate, limit = 100) {
    return await this.findAll({
        where: {
            created_at: {
                [sequelize.Op.between]: [startDate, endDate]
            }
        },
        order: [['created_at', 'DESC']],
        limit: limit,
        include: [
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID'],
                as: 'employee'
            },
            {
                model: sequelize.models.Customer,
                attributes: ['name'],
                as: 'customer'
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false,
                as: 'game'
            }
        ]
    });
};

TransactionHistory.getDailySummary = async function(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const summary = await this.findAll({
        where: {
            created_at: {
                [sequelize.Op.between]: [startOfDay, endOfDay]
            }
        },
        attributes: [
            'type',
            'transaction_type',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
        ],
        group: ['type', 'transaction_type']
    });

    return summary;
};

module.exports = TransactionHistory;