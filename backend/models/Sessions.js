const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

const Sessions = sequelize.define('Sessions', {
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
    game_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'games',
            key: 'id'
        }
    },
    emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'employees',
            key: 'id'
        }
    },
    card: {
        type: DataTypes.STRING,
        allowNull: false
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: true
    },
    planned_duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Planned session duration in minutes'
    },
    actual_duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Actual session duration in minutes'
    },
    base_charge: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Base charge for the session'
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
    final_charge: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Final charge after discount'
    },
    status: {
        type: DataTypes.ENUM('active', 'completed', 'cancelled', 'paused'),
        defaultValue: 'active'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Employee tracking fields
    started_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'employees',
            key: 'id'
        },
        comment: 'Employee who started the session'
    },
    ended_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'employees',
            key: 'id'
        },
        comment: 'Employee who ended the session'
    },
    payment_method: {
        type: DataTypes.ENUM('cash', 'online', 'card_balance'),
        defaultValue: 'card_balance',
        comment: 'Payment method used'
    },
    refund_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Refund amount if session cancelled'
    }
}, {
    tableName: 'sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['customer_id', 'status'], name: 'idx_customer_status' 
        },
        {
            fields: ['game_id', 'status'],  name: 'idx_game_status'
        },
        {
            fields: ['emp_id', 'created_at'], name: 'idx_emp_createdat' 
        },
        {
            fields: ['start_time', 'end_time'],  name: 'idx_start_endday'
        }
    ]
});

// Enhanced session management methods
Sessions.startSession = async function({ customer_id, game_id, emp_id, card, planned_duration, payment_method = 'card_balance' }) {
    const ValidationUtils = require('../utils/validations');
    const Games = require('./Games');
    const Customer = require('./Customer');
    
    const transaction = await sequelize.transaction();
    
    try {
        // Validate inputs
        ValidationUtils.validateRequiredFields(
            { customer_id, game_id, emp_id, card, planned_duration },
            ['customer_id', 'game_id', 'emp_id', 'card', 'planned_duration']
        );
        ValidationUtils.validateSessionTime(planned_duration);
        ValidationUtils.validateCard(card);

        // Get and validate game
        const game = await Games.findByPk(game_id);
        ValidationUtils.validateGameAvailability(game);
        
        // Get and validate customer
        const customer = await Customer.findByPk(customer_id, { transaction });
        ValidationUtils.validateCustomerStatus(customer);
        
        // Get and validate employee
        const Employee = require('./Employee');
        const employee = await Employee.findByPk(emp_id);
        ValidationUtils.validateEmployeeStatus(employee);
        
        // Calculate charges
        const costDetails = await Games.calculateSessionCost(game_id, planned_duration);
        
        // Validate customer balance
        ValidationUtils.validateBalance(customer, costDetails.final_charge);
        
        // Check for active sessions (optional business rule)
        const hasActiveSessions = await ValidationUtils.hasActiveSessions(customer_id, Sessions);
        if (hasActiveSessions) {
            // You can decide whether to allow multiple active sessions
            console.warn(`Customer ${customer_id} has active sessions`);
        }
        
        // Create session
        const session = await this.create({
            customer_id,
            game_id,
            emp_id,
            card,
            planned_duration,
            base_charge: costDetails.base_charge,
            discount_applied: costDetails.discount_percent,
            discount_amount: costDetails.discount_amount,
            final_charge: costDetails.final_charge,
            started_by: emp_id,
            payment_method
        }, { transaction });
        
        // Deduct amount from customer balance
        const balanceBefore = parseFloat(customer.balance);
        const newBalance = balanceBefore - parseFloat(costDetails.final_charge);
        
        // Additional validation for negative balance
        if (newBalance < 0) {
            throw new Error(`Operation would result in negative balance: ${newBalance}`);
        }
        
        await customer.update({ balance: newBalance }, { transaction });
        
        // Create transaction records
        const Transaction = require('./Transaction');
        const TransactionHistory = require('./TransactionHistory');
        
        const transactionData = {
            customer_id,
            card,
            amount: -Math.abs(costDetails.final_charge), // Negative for deduction
            emp_id,
            type: payment_method === 'online' ? 'online' : 'cash',
            transaction_type: 'game_session',
            balance_before: balanceBefore,
            balance_after: newBalance,
            game_id,
            session_time: planned_duration,
            status: 'completed'
        };
        
        const transactionRecord = await Transaction.create(transactionData, { transaction });
        
        await TransactionHistory.create({
            ...transactionData,
            transaction_id: transactionRecord.id,
            notes: `Game session started for ${game.game_name} (${planned_duration} minutes)`
        }, { transaction });
        
        await transaction.commit();
        
        // Return session with related data
        return await this.findByPk(session.id, {
            include: [
                { 
                    model: sequelize.models.Customer, 
                    attributes: ['name', 'card', 'balance'] 
                },
                { 
                    model: sequelize.models.Games, 
                    attributes: ['game_name', 'session_time', 'charge'] 
                },
                { 
                    model: sequelize.models.Employee, 
                    attributes: ['name', 'userID'],
                    as: 'StartedBy'
                }
            ]
        });
        
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to start session: ${error.message}`);
    }
};

Sessions.endSession = async function(sessionId, emp_id, actualDuration = null) {
    const ValidationUtils = require('../utils/validations');
    const transaction = await sequelize.transaction();
    
    try {
        const session = await this.findByPk(sessionId, { transaction });
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (session.status !== 'active') {
            throw new Error(`Session is ${session.status}, cannot end`);
        }
        
        // Validate employee
        const Employee = require('./Employee');
        const employee = await Employee.findByPk(emp_id);
        ValidationUtils.validateEmployeeStatus(employee);
        
        const endTime = new Date();
        const duration = actualDuration || Math.floor((endTime - session.start_time) / 60000); // minutes
        
        await session.update({
            end_time: endTime,
            actual_duration: duration,
            status: 'completed',
            ended_by: emp_id
        }, { transaction });
        
        await transaction.commit();
        return session;
        
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to end session: ${error.message}`);
    }
};

Sessions.cancelSession = async function(sessionId, emp_id, refundAmount = null, reason = null) {
    const ValidationUtils = require('../utils/validations');
    const transaction = await sequelize.transaction();
    
    try {
        const session = await this.findByPk(sessionId, { transaction });
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (session.status === 'completed') {
            throw new Error('Cannot cancel completed session');
        }
        
        // Validate employee
        const Employee = require('./Employee');
        const employee = await Employee.findByPk(emp_id);
        ValidationUtils.validateEmployeeStatus(employee);
        
        // Calculate refund amount if not provided
        if (refundAmount === null) {
            const sessionDuration = Math.floor((new Date() - session.start_time) / 60000);
            const remainingTime = Math.max(0, session.planned_duration - sessionDuration);
            refundAmount = (remainingTime / session.planned_duration) * parseFloat(session.final_charge);
        }
        
        // Validate refund amount
        if (refundAmount > 0) {
            ValidationUtils.validateAmount(refundAmount);
        }
        
        // Update session status
        await session.update({ 
            status: 'cancelled',
            end_time: new Date(),
            ended_by: emp_id,
            refund_amount: refundAmount,
            notes: reason || 'Session cancelled'
        }, { transaction });
        
        // Process refund if applicable
        if (refundAmount > 0) {
            const Customer = require('./Customer');
            const customer = await Customer.findByPk(session.customer_id, { transaction });
            
            if (customer) {
                const balanceBefore = parseFloat(customer.balance);
                const newBalance = balanceBefore + parseFloat(refundAmount);
                await customer.update({ balance: newBalance }, { transaction });
                
                // Create refund transaction
                const Transaction = require('./Transaction');
                const TransactionHistory = require('./TransactionHistory');
                
                const refundData = {
                    customer_id: session.customer_id,
                    card: session.card,
                    amount: Math.abs(refundAmount), // Positive for refund
                    emp_id: emp_id,
                    type: session.payment_method === 'online' ? 'online' : 'cash',
                    transaction_type: 'refund',
                    balance_before: balanceBefore,
                    balance_after: newBalance,
                    game_id: session.game_id,
                    session_time: session.planned_duration,
                    status: 'completed'
                };
                
                const refundTransaction = await Transaction.create(refundData, { transaction });
                
                await TransactionHistory.create({
                    ...refundData,
                    transaction_id: refundTransaction.id,
                    notes: `Refund for cancelled session #${sessionId}. Reason: ${reason || 'N/A'}`
                }, { transaction });
            }
        }
        
        await transaction.commit();
        return session;
        
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to cancel session: ${error.message}`);
    }
};

Sessions.pauseSession = async function(sessionId, emp_id) {
    const ValidationUtils = require('../utils/validations');
    
    try {
        const session = await this.findByPk(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (session.status !== 'active') {
            throw new Error(`Session is ${session.status}, cannot pause`);
        }
        
        // Validate employee
        const Employee = require('./Employee');
        const employee = await Employee.findByPk(emp_id);
        ValidationUtils.validateEmployeeStatus(employee);
        
        await session.update({ 
            status: 'paused',
            notes: `Session paused by ${employee.name} at ${new Date().toISOString()}`
        });
        
        return session;
        
    } catch (error) {
        throw new Error(`Failed to pause session: ${error.message}`);
    }
};

Sessions.resumeSession = async function(sessionId, emp_id) {
    const ValidationUtils = require('../utils/validations');
    
    try {
        const session = await this.findByPk(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (session.status !== 'paused') {
            throw new Error(`Session is ${session.status}, cannot resume`);
        }
        
        // Validate employee
        const Employee = require('./Employee');
        const employee = await Employee.findByPk(emp_id);
        ValidationUtils.validateEmployeeStatus(employee);
        
        await session.update({ 
            status: 'active',
            notes: `Session resumed by ${employee.name} at ${new Date().toISOString()}`
        });
        
        return session;
        
    } catch (error) {
        throw new Error(`Failed to resume session: ${error.message}`);
    }
};

// Query methods with enhanced filtering
Sessions.getActiveSessions = async function(gameId = null, empId = null) {
    const whereClause = { status: 'active' };
    if (gameId) whereClause.game_id = gameId;
    if (empId) whereClause.emp_id = empId;
    
    return await this.findAll({
        where: whereClause,
        include: [
            { 
                model: sequelize.models.Customer, 
                attributes: ['name', 'card', 'balance'] 
            },
            { 
                model: sequelize.models.Games, 
                attributes: ['game_name', 'session_time'] 
            },
            { 
                model: sequelize.models.Employee, 
                attributes: ['name', 'userID'],
                as: 'StartedBy'
            }
        ],
        order: [['start_time', 'ASC']]
    });
};

Sessions.getSessionHistory = async function(customer_id, limit = 50, status = null) {
    const whereClause = { customer_id };
    if (status) whereClause.status = status;
    
    return await this.findAll({
        where: whereClause,
        include: [
            { 
                model: sequelize.models.Games, 
                attributes: ['game_name', 'session_time', 'charge'] 
            },
            { 
                model: sequelize.models.Employee, 
                attributes: ['name', 'userID'],
                as: 'StartedBy'
            },
            { 
                model: sequelize.models.Employee, 
                attributes: ['name', 'userID'],
                as: 'EndedBy',
                required: false
            }
        ],
        order: [['start_time', 'DESC']],
        limit
    });
};

Sessions.getEmployeeSessions = async function(emp_id, limit = 50, dateRange = null) {
    const whereClause = { emp_id };
    
    if (dateRange && dateRange.start && dateRange.end) {
        whereClause.created_at = {
            [sequelize.Op.between]: [dateRange.start, dateRange.end]
        };
    }
    
    return await this.findAll({
        where: whereClause,
        include: [
            { 
                model: sequelize.models.Customer, 
                attributes: ['name', 'card'] 
            },
            { 
                model: sequelize.models.Games, 
                attributes: ['game_name', 'session_time'] 
            }
        ],
        order: [['start_time', 'DESC']],
        limit
    });
};

Sessions.getDailyStats = async function(date = new Date()) {
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
        attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('final_charge')), 'total_revenue'],
            [sequelize.fn('AVG', sequelize.col('actual_duration')), 'avg_duration'],
            [sequelize.fn('SUM', sequelize.col('refund_amount')), 'total_refunds']
        ],
        group: ['status']
    });
};

Sessions.getGamePopularity = async function(startDate, endDate) {
    return await this.findAll({
        where: {
            created_at: {
                [sequelize.Op.between]: [startDate, endDate]
            }
        },
        include: [
            { 
                model: sequelize.models.Games, 
                attributes: ['game_name', 'session_time', 'charge'] 
            }
        ],
        attributes: [
            'game_id',
            [sequelize.fn('COUNT', sequelize.col('Sessions.id')), 'session_count'],
            [sequelize.fn('SUM', sequelize.col('final_charge')), 'total_revenue'],
            [sequelize.fn('AVG', sequelize.col('actual_duration')), 'avg_duration'],
            [sequelize.fn('SUM', sequelize.col('refund_amount')), 'total_refunds']
        ],
        group: ['game_id', 'Game.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('Sessions.id')), 'DESC']]
    });
};

module.exports = Sessions;