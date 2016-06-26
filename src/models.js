'use strict'

//------------------------------------------------------------------------------
// Models for our locally stored data
//------------------------------------------------------------------------------
var Sequelize = require('sequelize');
var Q = require('q');
var AsyncLock = require('async-lock');


var exports = (function() {
    var _models = {};
    var _lockQueue = [];
    var _lock = new AsyncLock();

    //--------------------------------------------------------------------------
    // A lock that we can use to ensure that any writing to the database is 
    // finished before another writer starts.
    //
    // Parameters: donePromise - the promise object that will be resolved when
    //             the querying is done such that the next person may start their
    //             query.
    //--------------------------------------------------------------------------
    function lock(donePromise) {
        var lockDeferred = Q.defer();
        _lock.acquire("chesster", function() {
            lockDeferred.resolve(_models);
            return donePromise;
        });
        return lockDeferred.promise;
    }

    //--------------------------------------------------------------------------
    function defineModels(sequelize) {
        var LichessRating = sequelize.define('LichessRating', {
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
        return {
            LichessRating: LichessRating
        };
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
        var deferred = Q.defer();
        return sequelize.authenticate().then(function() {
            _models = defineModels(sequelize);
            deferred.resolve(_models);
        }).catch(function(error) {
            console.error("Unable to connect to database: " + error);
            deferred.reject(error);
        });
        return deferred.promise;
    }
    return {
        connect: connect,
        lock: lock
    };
})();

module.exports = exports
