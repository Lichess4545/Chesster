'use strict';

//------------------------------------------------------------------------------
// Models for our locally stored data
//------------------------------------------------------------------------------
const Sequelize = require('sequelize');
const Q = require('q');
const AsyncLock = require('async-lock');
const winston = require("winston");


var exports = (function() {
    var _lock = new AsyncLock();

    //--------------------------------------------------------------------------
    // A lock that we can use to ensure that any writing to the database is 
    // finished before another writer starts.
    //
    // A donePromise will be passed into the deferred, this donePromise should
    // always be resolved when you are done with the database.
    //--------------------------------------------------------------------------
    function lock() {
        var lockDeferred = Q.defer();
        _lock.acquire("chesster", function() {
            var unlock = Q.defer();
            lockDeferred.resolve(unlock);
            return unlock.promise;
        }).catch(function(err) {
            winston.error(JSON.stringify(err));
            lockDeferred.reject(err);
        });
        return lockDeferred.promise;
    }

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
        });
    }
    return {
        connect: connect,
        lock: lock
    };
}());

module.exports = exports;
