//------------------------------------------------------------------------------
// Lichess API helpers
//------------------------------------------------------------------------------
const http = require("./http.js");
const moment = require('moment-timezone');
const Q = require("q");
const _ = require("lodash");
const winston = require("winston");
// TODO: sequelize-cli requires us to call this models.js or models/index.js
//       this name conflicts with the parameter that we pass in after getting
//       the lock, so I'd like to (by convention) always refer to this as db.
const db = require("./models.js");

var MILISECOND = 1;
var SECONDS = 1000 * MILISECOND;

//------------------------------------------------------------------------------
// A lichess API queue.
//
// Provides two queues, a background queue and main queue. Use the main queue
// for any processing in response to a user message, as the main queue takes
// priority.
//
// Use the background queue for any background updating, like player ratings.
//
// Also attempts to rate limit itself according to the lichess API guidelines
// a max of one request every 2 seconds (this is actually a bit slower), and
// it will wait a minute if it receives a 429.
//------------------------------------------------------------------------------
var makeRequest = (function() {
    // The background queue will be processed when there is nothing else to process
    var backgroundQueue = [];
    // The mainQueue will be processed first.
    var mainQueue = [];
    function makeRequest(url, isJSON, isBackground) {
        var deferred = Q.defer();
        if (isBackground) {
            backgroundQueue.push([url, isJSON, deferred]);
        } else {
            mainQueue.push([url, isJSON, deferred]);
        }
        return deferred.promise;
    }
    function processRequest() {
        var request = null;
        // The default delay between requests is 2 seconds
        var requestDelay = 2 * SECONDS;
        if (mainQueue.length > 0 || backgroundQueue.length > 0) {
            winston.info("[LICHESS] {} requests in mainQueue {} requests in backgroundQueue".format(
                mainQueue.length,
                backgroundQueue.length
            ));
        }
        if (mainQueue.length > 0) {
            request = mainQueue.shift();
        } else if (backgroundQueue.length > 0) {
            request = backgroundQueue.shift();
        }
        if (request) {
            var url = request[0];
            var isJSON = request[1];
            var deferred = request[2];
            var promise = null;
            try {
                promise = http.fetchURL(url);
                promise.then(function(result) {
                    try {
                        if (result.response.statusCode === 429) {
                            requestDelay = 60 * SECONDS;
                            winston.info("[LICHESS] Last request status was a 429 - we will wait 60 seconds before our next request");
                        } else {
                            if (mainQueue.length > 0) {
                                requestDelay = 2 * SECONDS;
                            } else {
                                // Back off a bit if we only have background requests.
                                requestDelay = 4 * SECONDS;
                            }
                            if (isJSON)  {
                                var json = JSON.parse(result['body']);
                                if (json) {
                                    result['json'] = json;
                                    deferred.resolve(result);
                                } else {
                                    winston.error("[LICHESS] Asked for JSON - but didn't get it");
                                    winston.error("[LICHESS] " + JSON.stringify(result));
                                    deferred.reject("Not JSON");
                                }
                            } else {
                                deferred.resolve(result);
                            }
                        }
                        setTimeout(processRequest, requestDelay);
                    } catch (e) {
                        winston.error("[LICHESS] Exception: " + e);
                        winston.error("[LICHESS] Stack: " + e.stack);
                        winston.error("[LICHESS] URL: " + url);
                        deferred.reject(e);
                        setTimeout(processRequest, requestDelay);
                    }
                }, function(error) {
                    winston.error("[LICHESS] Request failed: " + JSON.stringify(error));
                    setTimeout(processRequest, requestDelay);
                    deferred.reject(error);
                });
            } catch (e) {
                winston.error("[LICHESS] Exception: " + e);
                winston.error("[LICHESS] Stack: " + e.stack);
                deferred.reject(e);
                setTimeout(processRequest, requestDelay);
            }
        } else {
            setTimeout(processRequest, requestDelay);
        }
    }
    processRequest();
    return makeRequest;
}());

function getPlayerByName(name, isBackground){
    var url = "https://lichess.org/api/user/" + name;
    return makeRequest(url, true, isBackground);
}

//------------------------------------------------------------------------------
// Get a player rating, but only ping lichess once every 30 minutes for each
// player.  It's supposed to be a classical rating, so it probably won't update
// that often in a 30 minutes period. Besides, this function is not intended
// for people to show off their latest rating.  If they wan to do that they
// can type it in themselves.
//------------------------------------------------------------------------------
var ratingFunctions = (function() {
    //promises are added and replaced with each new call
    //promises may be used more than once because multiple requests may be out
    //for a single rating request
    //for each request of a player rating that is already in the queue,
    //we return the existing promise
    var _playerPromises = {};
    
    //--------------------------------------------------------------------------
    // Update the rating from lichess - storing it in the database.
    //--------------------------------------------------------------------------
    function _updateRating(name, isBackground) {
        //store the promise for reuse
        _playerPromises[name] = getPlayerByName(name, isBackground).then(function(result) {
            _playerPromises[name] = undefined;
            var rating = result.json.perfs.classical.rating;
            // Get the writable lock for the database.
            return db.lock().then(function(unlock) {
                return db.LichessRating.findOrCreate({
                    where: { lichessUserName: name }
                }).then(function(lichessRatings) {
                    var lichessRating = lichessRatings[0];
                    lichessRating.set('rating', rating);
                    lichessRating.set('lastCheckedAt', moment.utc().format());
                    lichessRating.save().then(function() {
                        winston.info("Got updated rating for {name}: {rating}".format({
                            name: name,
                            rating: rating
                        }));
                        unlock.resolve();
                    }).catch(function() {
                        unlock.resolve();
                    });
                    return rating;
                });
            });
        }).catch(function(error) {
            winston.error("Error getting player by name: " + error);
        });
        return _playerPromises[name];
    }

    //--------------------------------------------------------------------------
    // Get the player rating. Always return the most recent rating from the
    // database, unless they don't have it. Then go get it and return it.
    //--------------------------------------------------------------------------
    function getPlayerRating(name, isBackground){
        name = name.toLowerCase();

        // Get the writable lock for the database.
        return db.lock().then(function(unlock) {
            // Ensure we have a record.
            return db.LichessRating.findOrCreate({
                where: { lichessUserName: name }
            }).then(function(lichessRating) {
                unlock.resolve();
                lichessRating = lichessRating[0];

                var promise;

                //if a promise exists, then the player is already queued
                var isInQueue = !_.isNil(_playerPromises[name]);
                var rating = lichessRating.get('rating');

                // Only update the rating if we don't have one - we won't update
                // ratings that are out of date via this mechanism anymore.
                // the website will do that and we will just ingest the ratings
                // given to us by the website everytime we refresh.
                if (_.isNil(rating))  {
                    // If we don't have a rating, use whatever queue they asked for.
                    promise = _updateRating(name, isBackground);
                }else if(isInQueue){
                    // player rating is already incoming. wait for it.
                    promise = _playerPromises[name];
                }

                if (!_.isNil(rating))  {
                    // Return the cached rating if we have it.
                    return lichessRating.get('rating');
                } else {
                    // Otherwise wait until we get it
                    return promise;
                }
            }).catch(function(error) {
                winston.error("Error querying for rating: " + error);
            });
        });
    }
    return {
        getPlayerRating: getPlayerRating
    };
}());

module.exports.getPlayerRating = ratingFunctions.getPlayerRating;
module.exports.getPlayerByName = getPlayerByName;
