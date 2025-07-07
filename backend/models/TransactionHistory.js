// models/TransactionHistory.js
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
    tableName: 'transactionHistory',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['customer_id', 'transaction_type']
        },
        {
            fields: ['emp_id', 'created_at']
        },
        {
            fields: ['transaction_id']
        },
        {
            fields: ['created_at', 'status']
        }
    ]
});

// Enhanced creation method with validation
TransactionHistory.createEntry = async function(data) {
    const ValidationUtils = require('../utils/validations'); //

    // Validate required fields
    ValidationUtils.validateRequiredFields( //
        data, //
        ['transaction_id', 'customer_id', 'card', 'amount', 'emp_id', 'balance_after'] //
    );

    return await this.create(data);
};

// Enhanced query methods with session support
TransactionHistory.getByCustomerId = async function(customerId, limit = 50, transactionType = null) {
    const whereClause = { customer_id: customerId };
    if (transactionType) {
        whereClause.transaction_type = transactionType;
    }

    return await this.findAll({
        where: whereClause,
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
            },
            {
                model: sequelize.models.Sessions,
                attributes: ['id', 'status', 'start_time', 'end_time', 'planned_duration', 'actual_duration'],
                required: false,
                as: 'session'
            }
        ]
    });
};

TransactionHistory.getAll = async function(limit = 100, offset = 0, filters = {}) {
    const whereClause = {};

    // Apply filters
    if (filters.transaction_type) {
        whereClause.transaction_type = filters.transaction_type;
    }
    if (filters.type) {
        whereClause.type = filters.type;
    }
    if (filters.status) {
        whereClause.status = filters.status;
    }
    if (filters.emp_id) {
        whereClause.emp_id = filters.emp_id;
    }
    if (filters.game_id) {
        whereClause.game_id = filters.game_id;
    }

    return await this.findAll({
        where: whereClause,
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
            },
            {
                model: sequelize.models.Sessions,
                attributes: ['id', 'status', 'start_time', 'end_time'],
                required: false,
                as: 'session'
            }
        ]
    });
};

TransactionHistory.getByEmployeeId = async function(empId, limit = 50, dateRange = null) {
    const whereClause = { emp_id: empId };

    if (dateRange && dateRange.start && dateRange.end) {
        whereClause.created_at = {
            [sequelize.Op.between]: [dateRange.start, dateRange.end]
        };
    }

    return await this.findAll({
        where: whereClause,
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
            },
            {
                model: sequelize.models.Sessions,
                attributes: ['id', 'status', 'start_time', 'end_time'],
                required: false,
                as: 'session'
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
            },
            {
                model: sequelize.models.Sessions,
                attributes: ['id', 'status', 'start_time', 'end_time'],
                required: false,
                as: 'session'
            }
        ]
    });
};

TransactionHistory.getBySessionId = async function(sessionId) {
    return await this.findAll({
        where: { session_id: sessionId },
        order: [['created_at', 'ASC']],
        include: [
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID'],
                as: 'employee'
            },
            {
                model: sequelize.models.Customer,
                attributes: ['name', 'card'],
                as: 'customer'
            }
        ]
    });
};

TransactionHistory.getByDateRange = async function(startDate, endDate, limit = 100, filters = {}) {
    const whereClause = {
        created_at: {
            [sequelize.Op.between]: [startDate, endDate]
        }
    };

    // Apply additional filters
    if (filters.transaction_type) {
        whereClause.transaction_type = filters.transaction_type;
    }
    if (filters.type) {
        whereClause.type = filters.type;
    }
    if (filters.status) {
        whereClause.status = filters.status;
    }

    return await this.findAll({
        where: whereClause,
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
            },
            {
                model: sequelize.models.Sessions,
                attributes: ['id', 'status', 'start_time', 'end_time'],
                required: false,
                as: 'session'
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
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
            [sequelize.fn('AVG', sequelize.col('amount')), 'avg_amount'],
            [sequelize.fn('SUM', sequelize.col('discount_amount')), 'total_discount']
        ],
        group: ['type', 'transaction_type', 'status']
    });

    return summary;
};

TransactionHistory.getRevenueSummary = async function(startDate, endDate) {
    return await this.findAll({
        where: {
            created_at: {
                [sequelize.Op.between]: [startDate, endDate]
            }
        },
        attributes: [
            'transaction_type',
            [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
            [sequelize.fn('SUM', sequelize.col('discount_amount')), 'total_discount'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'transaction_count']
        ],
        group: ['transaction_type']
    });
};

TransactionHistory.getGameRevenue = async function(startDate, endDate) {
    return await this.findAll({
        where: {
            created_at: {
                [sequelize.Op.between]: [startDate, endDate]
            },
            transaction_type: 'game_session'
        },
        include: [
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                as: 'game'
            }
        ],
        attributes: [
            'game_id',
            [sequelize.fn('SUM', sequelize.col('amount')), 'total_revenue'],
            [sequelize.fn('SUM', sequelize.col('discount_amount')), 'total_discount'],
            [sequelize.fn('COUNT', sequelize.col('TransactionHistory.id')), 'session_count'],
            [sequelize.fn('AVG', sequelize.col('session_time')), 'avg_session_time']
        ],
        group: ['game_id', 'game.id'],
        order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });
};

TransactionHistory.getEmployeeRevenue = async function(empId, startDate, endDate) {
    return await this.findAll({
        where: {
            emp_id: empId,
            created_at: {
                [sequelize.Op.between]: [startDate, endDate]
            }
        },
        attributes: [
            'transaction_type',
            [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
            [sequelize.fn('SUM', sequelize.col('discount_amount')), 'total_discount'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'transaction_count']
        ],
        group: ['transaction_type']
    });
};

TransactionHistory.getCustomerStats = async function(customerId, startDate, endDate) {
    return await this.findAll({
        where: {
            customer_id: customerId,
            created_at: {
                [sequelize.Op.between]: [startDate, endDate]
            }
        },
        attributes: [
            'transaction_type',
            [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
            [sequelize.fn('SUM', sequelize.col('discount_amount')), 'total_discount'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'transaction_count'],
            [sequelize.fn('SUM', sequelize.col('session_time')), 'total_session_time']
        ],
        group: ['transaction_type']
    });
};

// Method to create session transaction history
TransactionHistory.createSessionHistory = async function(sessionData, transactionId) {
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

    return await this.create({
        transaction_id: transactionId,
        customer_id,
        card,
        amount,
        emp_id,
        type,
        transaction_type: 'game_session',
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

module.exports = TransactionHistory;