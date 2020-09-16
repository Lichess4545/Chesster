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
            queryInterface.addIndex(
                'Subscriptions',
                ['requester', 'source', 'event', 'target', 'league'],
                {
                    indexName: 'eventUnique',
                    indicesType: 'UNIQUE'
                }
            )
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
            queryInterface.removeIndex(
                'Subscriptions',
                ['requester', 'source', 'event', 'target']
            )
        ]);
    }
};
