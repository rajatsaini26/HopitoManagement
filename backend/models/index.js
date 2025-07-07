const sequelize = require('../config/db').sequelize;
const Admin = require('./Admin');
const Customer = require('./Customer');
const Employee = require('./Employee');
const Games = require('./Games');
const Transaction = require('./Transaction');
const TransactionHistory = require('./TransactionHistory');
const Sessions = require('./Sessions');

// Customer associations
Customer.hasMany(Transaction, { foreignKey: 'customer_id', as: 'transactions' });
Customer.hasMany(TransactionHistory, { foreignKey: 'customer_id', as: 'transactionHistory' });
Customer.hasMany(Sessions, { foreignKey: 'customer_id', as: 'sessions' });

// Employee associations
Employee.hasMany(Transaction, { foreignKey: 'emp_id', as: 'transactions' });
Employee.hasMany(TransactionHistory, { foreignKey: 'emp_id', as: 'transactionHistory' });
Employee.hasMany(Sessions, { foreignKey: 'emp_id', as: 'sessions' });

// Additional employee associations for session tracking
Employee.hasMany(Sessions, { foreignKey: 'started_by', as: 'sessionsStarted' });
Employee.hasMany(Sessions, { foreignKey: 'ended_by', as: 'sessionsEnded' });

// Games associations
Games.hasMany(Transaction, { foreignKey: 'game_id', as: 'transactions' });
Games.hasMany(TransactionHistory, { foreignKey: 'game_id', as: 'transactionHistory' });
Games.hasMany(Sessions, { foreignKey: 'game_id', as: 'sessions' });

// Transaction associations
Transaction.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Transaction.belongsTo(Employee, { foreignKey: 'emp_id', as: 'employee' });
Transaction.belongsTo(Games, { foreignKey: 'game_id', as: 'game' });
Transaction.hasOne(TransactionHistory, { foreignKey: 'transaction_id', as: 'history' });

// TransactionHistory associations
TransactionHistory.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
TransactionHistory.belongsTo(Employee, { foreignKey: 'emp_id', as: 'employee' });
TransactionHistory.belongsTo(Games, { foreignKey: 'game_id', as: 'game' });
TransactionHistory.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });

// Sessions associations
Sessions.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Sessions.belongsTo(Games, { foreignKey: 'game_id', as: 'game' });
Sessions.belongsTo(Employee, { foreignKey: 'emp_id', as: 'employee' });
Sessions.belongsTo(Employee, { foreignKey: 'started_by', as: 'StartedBy' });
Sessions.belongsTo(Employee, { foreignKey: 'ended_by', as: 'EndedBy' });

// Many-to-many associations for complex queries
Customer.belongsToMany(Games, { 
    through: Sessions, 
    foreignKey: 'customer_id', 
    otherKey: 'game_id',
    as: 'PlayedGames'
});

Games.belongsToMany(Customer, { 
    through: Sessions, 
    foreignKey: 'game_id', 
    otherKey: 'customer_id',
    as: 'Players'
});

Employee.belongsToMany(Games, { 
    through: Sessions, 
    foreignKey: 'emp_id', 
    otherKey: 'game_id',
    as: 'ManagedGames'
});

// Export all models with proper associations
module.exports = {
    sequelize,
    Admin,
    Customer,
    Employee,
    Games,
    Transaction,
    TransactionHistory,
    Sessions,
    
    // Helper function to sync all models
    syncAllModels: async function(force = false) {
        try {
            await sequelize.sync({ force });
            console.log('All models synchronized successfully');
        } catch (error) {
            console.error('Error synchronizing models:', error);
            throw error;
        }
    },
    
    // Helper function to test associations
    testAssociations: async function() {
        try {
            // Test customer with sessions
            const customerWithSessions = await Customer.findOne({
                include: [
                    { model: Sessions, as: 'sessions' },
                    { model: Games, as: 'PlayedGames' }
                ]
            });
            
            // Test employee with all related data
            const employeeWithData = await Employee.findOne({
                include: [
                    { model: Sessions, as: 'sessions' },
                    { model: Sessions, as: 'sessionsStarted' },
                    { model: Sessions, as: 'sessionsEnded' },
                    { model: Games, as: 'ManagedGames' }
                ]
            });
            
            // Test game with players
            const gameWithPlayers = await Games.findOne({
                include: [
                    { model: Sessions, as: 'sessions' },
                    { model: Customer, as: 'Players' }
                ]
            });
            
            console.log('All associations working correctly');
            return { customerWithSessions, employeeWithData, gameWithPlayers };
            
        } catch (error) {
            console.error('Error testing associations:', error);
            throw error;
        }
    }
};