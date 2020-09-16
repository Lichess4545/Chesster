'use strict';

var Q = require("q");

module.exports = {
    up: function (queryInterface, Sequelize) {
        /*
            Add altering commands here.
            Return a promise to correctly handle asynchronicity.

            Example:
            return queryInterface.createTable('users', { id: Sequelize.INTEGER });
        */
        return Q.all([
            queryInterface.createTable('Subscriptions', {
                id: {
                    type: Sequelize.INTEGER,
                    autoIncrement: true,
                    primaryKey: true
                },
                requester: {
                    type: Sequelize.STRING
                },
                source: {
                    type: Sequelize.STRING
                },
                event: {
                    type: Sequelize.STRING
                },
                target: {
                    type: Sequelize.STRING
                },
                league: {
                    type: Sequelize.STRING
                },
                // These two are automatically added to a model by sequelize
                createdAt: {
                    type: Sequelize.DATE, allowNull: true
                },
                updatedAt: {
                    type: Sequelize.DATE, allowNull: true
                }
            })
        ]);
    },

    down: function (queryInterface, Sequelize) {
        /*
            Add reverting commands here.
            Return a promise to correctly handle asynchronicity.

            Example:
            return queryInterface.dropTable('users');
        */
        return Q.all([
            queryInterface.dropTable('Subscriptions')
        ]);
    }
};
