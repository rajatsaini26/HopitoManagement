require('dotenv').config();
const { Sequelize } = require('sequelize');

// Sequelize ORM instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    // logging: false, // Disable logging in production
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      freezeTableName: true,
      timestamps: true
    }
  }
);

// Test DB connection
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connection established via Sequelize.');
  } catch (err) {
    console.error('❌ Unable to connect to the DB:', err.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
