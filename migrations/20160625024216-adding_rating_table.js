'use strict';

module.exports = {
    up: function (queryInterface, Sequelize) {
        /*
            Add altering commands here.
            Return a promise to correctly handle asynchronicity.

            Example:
            return queryInterface.createTable('users', { id: Sequelize.INTEGER });
        */
        return queryInterface.createTable('LichessRatings', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            lichessUserName: Sequelize.STRING, // Comes from lichess
            rating: {
                type: Sequelize.INTEGER, allowNull: true
            },
            lastCheckedAt: {
                type: Sequelize.DATE, allowNull: true
            },
            // These two are automatically added to a model by sequelize
            createdAt: {
                type: Sequelize.DATE, allowNull: true
            },
            updatedAt: {
                type: Sequelize.DATE, allowNull: true
            }
        });
    },

    down: function (queryInterface, Sequelize) {
        /*
            Add reverting commands here.
            Return a promise to correctly handle asynchronicity.

            Example:
            return queryInterface.dropTable('users');
        */
        return queryInterface.dropTable('LichessRatings');
    }
};
