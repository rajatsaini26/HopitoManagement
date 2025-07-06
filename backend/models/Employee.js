const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

const Employee = sequelize.define('Employee', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    mobile: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isNumeric: true,
            len: [10, 15] // Mobile number length validation
        }
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    userID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    otp: {
        type: DataTypes.STRING(6),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended'),
        defaultValue: 'active'
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'employee'
    }
}, {
    tableName: 'employees', // Updated to match your database table name
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Static methods to maintain the same interface
Employee.findByMobile = async function(mobile) {
    const employee = await this.findOne({ where: { mobile } });
    return employee;
};

Employee.findById = async function(employeeId) {
    const employee = await this.findByPk(employeeId);
    return employee;
};

Employee.createEmployee = async function({ mobile, name, address, userID, password, otp }) {
    return await this.create({
        mobile,
        name,
        address,
        userID,
        password,
        otp
    });
};

Employee.updateEmployee = async function(employeeId, { name, address }) {
    const employee = await this.findByPk(employeeId);
    if (employee) {
        await employee.update({ name, address });
        return employee;
    }
    return null;
};

// Additional methods for employee management
Employee.updateOTP = async function(employeeId, otp) {
    const employee = await this.findByPk(employeeId);
    if (employee) {
        await employee.update({ otp });
        return employee;
    }
    return null;
};

Employee.verifyOTP = async function(mobile, otp) {
    const employee = await this.findOne({ 
        where: { mobile, otp } 
    });
    return employee;
};

Employee.changePassword = async function(employeeId, newPassword) {
    const employee = await this.findByPk(employeeId);
    if (employee) {
        await employee.update({ password: newPassword, otp: null });
        return employee;
    }
    return null;
};

Employee.getEmployeeTransactions = async function(employeeId, limit = 50) {
    const TransactionHistory = require('./TransactionHistory');
    return await TransactionHistory.findAll({
        where: { emp_id: employeeId },
        order: [['created_at', 'DESC']],
        limit: limit
    });
};

module.exports = Employee;