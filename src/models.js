'use strict';

//------------------------------------------------------------------------------
// Models for our locally stored data
//------------------------------------------------------------------------------
const Sequelize = require('sequelize');
const Q = require('q');
const winston = require("winston");


var exports = (function() {
    //--------------------------------------------------------------------------
    function defineModels(sequelize) {
        module.exports.LichessRating = sequelize.define('LichessRating', {
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
            }
        });
        module.exports.Subscription = sequelize.define('Subscription', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            requester: {
                type: Sequelize.STRING, unique: "eventUnique"
            },
            source: {
                type: Sequelize.STRING, unique: "eventUnique"
            },
            event: {
                type: Sequelize.STRING, unique: "eventUnique"
            },
            target: {
                type: Sequelize.STRING, unique: "eventUnique"
            },
            league: {
                type: Sequelize.STRING, unique: "eventUnique"
            }
        });
    }

    //--------------------------------------------------------------------------
    // Connection function that ensures we have a connection and the models
    // are defined.
    //
    // Parameters: config - the config option that contains the database
    //                      information.
    //--------------------------------------------------------------------------
    function connect(config) {
        var sequelize = new Sequelize(config.database, config.username, config.password, config);
        return sequelize.authenticate().then(function() {
            defineModels(sequelize);
        }).catch(function(error) {
            winston.error("Unable to connect to database: " + error);
            throw error;
        });
    }
    return {
        connect: connect
    };
}());

module.exports = exports;
