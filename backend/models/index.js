const sequelize = require('../config/db').sequelize;
const Admin = require('./Admin');
const Customer = require('./Customer');
const Employee = require('./Employee');
const Games = require('./Games');
const Transaction = require('./Transaction');
const TransactionHistory = require('./TransactionHistory'); // ❌ MISSING - You need to import this

// Associations
// Customer associations
Customer.hasMany(Transaction, { foreignKey: 'customer_id' });
Customer.hasMany(TransactionHistory, { foreignKey: 'customer_id' });

// Employee associations
Employee.hasMany(Transaction, { foreignKey: 'emp_id' });
Employee.hasMany(TransactionHistory, { foreignKey: 'emp_id' });

// Games associations
Games.hasMany(Transaction, { foreignKey: 'game_id' });
Games.hasMany(TransactionHistory, { foreignKey: 'game_id' });

// Transaction associations
Transaction.belongsTo(Customer, { foreignKey: 'customer_id' });
Transaction.belongsTo(Employee, { foreignKey: 'emp_id' });
Transaction.belongsTo(Games, { foreignKey: 'game_id' });
Transaction.hasOne(TransactionHistory, { foreignKey: 'transaction_id' }); // ✅ ADDED - Transaction can have one history record

// TransactionHistory associations
TransactionHistory.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
TransactionHistory.belongsTo(Employee, { foreignKey: 'emp_id', as: 'employee' });
TransactionHistory.belongsTo(Games, { foreignKey: 'game_id', as: 'game' });
TransactionHistory.belongsTo(Transaction, { foreignKey: 'transaction_id' });

module.exports = {
  sequelize,
  Admin,
  Customer,
  Employee,
  Games,
  Transaction,
  TransactionHistory // ❌ MISSING - You need to export this
};