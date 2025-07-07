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
        defaultValue: 0.00,
        validate: {
            min: 0 // Prevent negative balances at model level
        }
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

        // Check for negative balance if this is a deduction
        const newBalance = parseFloat(customer.balance) + parseFloat(amount);
        if (newBalance < 0) {
            throw new Error(`Insufficient balance. Current: ${customer.balance}, Required: ${Math.abs(amount)}`);
        }

        // Update customer balance
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

// Enhanced game session method with proper validation
Customer.startGameSession = async function(customerId, gameId, empId, sessionTime = null) {
    const transaction = await sequelize.transaction();
    
    try {
        // Find customer
        const customer = await this.findByPk(customerId, { transaction });
        if (!customer) {
            throw new Error('Customer not found');
        }

        // Check customer status
        if (customer.status !== 'active') {
            throw new Error('Customer account is not active');
        }

        // Get game details and calculate cost
        const Games = require('./Games');
        const game = await Games.findByPk(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        if (game.status !== 'active') {
            throw new Error('Game is not available');
        }

        const costDetails = await Games.calculateSessionCost(gameId, sessionTime);
        
        // Check if customer has sufficient balance
        if (parseFloat(customer.balance) < parseFloat(costDetails.final_charge)) {
            throw new Error(`Insufficient balance. Required: ${costDetails.final_charge}, Available: ${customer.balance}`);
        }

        // Start session using Sessions model
        const Sessions = require('./Sessions');
        const sessionResult = await Sessions.startSession({
            customer_id: customerId,
            game_id: gameId,
            emp_id: empId,
            card: customer.card,
            planned_duration: sessionTime || game.session_time
        });

        await transaction.commit();
        return sessionResult;
        
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

// Get customer session history
Customer.getSessionHistory = async function(customerId, limit = 50) {
    const Sessions = require('./Sessions');
    return await Sessions.getSessionHistory(customerId, limit);
};

// Get customer's current active sessions
Customer.getActiveSessions = async function(customerId) {
    const Sessions = require('./Sessions');
    return await Sessions.findAll({
        where: { 
            customer_id: customerId,
            status: 'active'
        },
        include: [
            {
                model: sequelize.models.Games,
                attributes: ['game_name']
            },
            {
                model: sequelize.models.Employee,
                attributes: ['name', 'userID']
            }
        ],
        order: [['start_time', 'ASC']]
    });
};

// Check if customer can afford a game session
Customer.canAffordGame = async function(customerId, gameId, sessionTime = null) {
    const customer = await this.findByPk(customerId);
    if (!customer) return false;

    const Games = require('./Games');
    const costDetails = await Games.calculateSessionCost(gameId, sessionTime);
    
    return parseFloat(customer.balance) >= parseFloat(costDetails.final_charge);
};

// Get customer statistics
Customer.getCustomerStats = async function(customerId) {
    const Sessions = require('./Sessions');
    const TransactionHistory = require('./TransactionHistory');
    
    // Get total sessions
    const totalSessions = await Sessions.count({
        where: { customer_id: customerId }
    });

    // Get total spent
    const totalSpent = await TransactionHistory.sum('amount', {
        where: { 
            customer_id: customerId,
            transaction_type: 'game_session'
        }
    });

    // Get total recharged
    const totalRecharged = await TransactionHistory.sum('amount', {
        where: { 
            customer_id: customerId,
            transaction_type: ['recharge', 'new_card']
        }
    });

    // Get favorite game
    const favoriteGame = await Sessions.findOne({
        where: { customer_id: customerId },
        attributes: [
            'game_id',
            [sequelize.fn('COUNT', sequelize.col('game_id')), 'game_count']
        ],
        include: [
            {
                model: sequelize.models.Games,
                attributes: ['game_name']
            }
        ],
        group: ['game_id', 'Game.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('game_id')), 'DESC']],
        limit: 1
    });

    return {
        total_sessions: totalSessions || 0,
        total_spent: totalSpent || 0,
        total_recharged: totalRecharged || 0,
        favorite_game: favoriteGame ? favoriteGame.Game.game_name : null
    };
};

// Validate balance before operations
Customer.validateBalance = async function(customerId, requiredAmount) {
    const customer = await this.findByPk(customerId);
    if (!customer) {
        throw new Error('Customer not found');
    }

    if (parseFloat(customer.balance) < parseFloat(requiredAmount)) {
        throw new Error(`Insufficient balance. Required: ${requiredAmount}, Available: ${customer.balance}`);
    }

    return true;
};

module.exports = Customer;