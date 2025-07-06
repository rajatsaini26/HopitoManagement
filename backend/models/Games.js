const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

const Games = sequelize.define('Games', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    game_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    session_time: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Session time in minutes'
    },
    charge: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Charge per session'
    },
    discount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        validate: { 
            min: 0, 
            max: 100 
        },
        comment: 'Discount percentage'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
        defaultValue: 'active'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'games',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Static methods for game management
Games.getActiveGames = async function() {
    return await this.findAll({
        where: { status: 'active' },
        order: [['game_name', 'ASC']]
    });
};

Games.calculateSessionCost = async function(gameId, sessionTime = null) {
    const game = await this.findByPk(gameId);
    if (!game) return null;

    const time = sessionTime || game.session_time;
    const baseCharge = parseFloat(game.charge);
    const discount = game.discount || 0;
    
    const totalCharge = baseCharge * (time / game.session_time);
    const discountAmount = (totalCharge * discount) / 100;
    const finalCharge = totalCharge - discountAmount;

    return {
        game_name: game.game_name,
        session_time: time,
        base_charge: baseCharge,
        total_charge: totalCharge,
        discount_percent: discount,
        discount_amount: discountAmount,
        final_charge: finalCharge
    };
};

Games.updateGameStatus = async function(gameId, status) {
    const game = await this.findByPk(gameId);
    if (game) {
        await game.update({ status });
        return game;
    }
    return null;
};

module.exports = Games;