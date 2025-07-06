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
    session_time: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Session time in minutes for game transactions'
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
        defaultValue: 'completed'
    }
}, {
    tableName: 'transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Custom methods
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
    session_time = null
}) {
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
        session_time
    });
};

Transaction.findByEmployeeId = async function(empId) {
    return await this.findAll({
        where: { emp_id: empId },
        order: [['created_at', 'DESC']],
        include: [
            {
                model: sequelize.models.Customer,
                attributes: ['name', 'card']
            },
            {
                model: sequelize.models.Games,
                attributes: ['game_name'],
                required: false
            }
        ]
    });
};

Transaction.findByCard = async function(card) {
    return await this.findAll({
        where: { card },
        order: [['created_at', 'DESC']],
        include: [
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID']
            }
        ]
    });
};

Transaction.findByCustomerId = async function(customerId) {
    return await this.findAll({
        where: { customer_id: customerId },
        order: [['created_at', 'DESC']],
        include: [
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
        order: [['created_at', 'DESC']]
    });
};

module.exports = Transaction;