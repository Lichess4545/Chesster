//------------------------------------------------------------------------------
// Lichess helpers
//------------------------------------------------------------------------------
var http = require("./http.js");
var moment = require("moment");
var Q = require("q");
// TODO: sequelize-cli requires us to call this models.js or models/index.js
//       this name conflicts with the parameter that we pass in after getting
//       the lock, so I'd like to (by convention) always refer to this as db.
var db = require("./models.js");

var MILISECOND = 1;
var SECONDS = 1000 * MILISECOND;
var MINUTES = 60 * SECONDS;

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
    var lastRequest = moment.utc();
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
            if (isJSON)  {
                promise = http.fetchURLIntoJSON(url);
            } else {
                promise = http.fetchURL(url);
            }
            promise.then(function(result) {
                if (result.response.statusCode == 429) {
                    requestDelay = 60 * SECONDS;
                    console.log("Last request status was a 429 - we will wait 60 seconds before our next request");
                }
                deferred.resolve(result);

                setTimeout(processRequest, requestDelay);
            }, function(error) {
                console.error("Request failed: " + JSON.stringify(error));
                setTimeout(processRequest, requestDelay);
                deferred.reject(error);
            });
        } else {
            setTimeout(processRequest, requestDelay);
        }
    }
    processRequest();
    return makeRequest;
})();

function getPlayerByName(name, isBackground){
    var url = "http://en.lichess.org/api/user/" + name;
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
    var _playerRatings = {};
    var _playerIsInQueue = {};

    //--------------------------------------------------------------------------
    // Update the rating from lichess - storing it in the database.
    //--------------------------------------------------------------------------
    function _updateRating(name, isBackground) {
        _playerIsInQueue[name] = true;
        return getPlayerByName(name, isBackground).then(function(result) {
            _playerIsInQueue[name] = undefined;
            var rating = result.json.perfs.classical.rating;
            var doneWithDB = Q.defer();
            // Get the writable lock for the database.
            return db.lock(doneWithDB.promise).then(function(models) {
                return models.LichessRating.findOrCreate({
                    where: { lichessUserName: name }
                }).then(function(lichessRatings) {
                    lichessRating = lichessRatings[0];
                    lichessRating.set('rating', rating);
                    lichessRating.set('lastCheckedAt', moment.utc().format());
                    lichessRating.save().then(function() {
                        console.log("Got updated rating for {name}: {rating}".format({
                            name: name,
                            rating: rating
                        }));
                        doneWithDB.resolve();
                    }).catch(function(error) {
                        doneWithDB.reject();
                    });
                    return rating;
                });
            });
        }).catch(function(error) {
            doneWithDB.reject();
        });
    }

    //--------------------------------------------------------------------------
    // Get the player rating. Always return the most recent rating from the
    // database, unless they don't have it. Then go get it and return it.
    //--------------------------------------------------------------------------
    function getPlayerRating(name){
        var name = name.toLowerCase();

        var doneWithDB = Q.defer();
        // Get the writable lock for the database.
        return db.lock(doneWithDB.promise).then(function(models) {
            // Ensure we have a record.
            return models.LichessRating.findOrCreate({
                where: { lichessUserName: name }
            }).then(function(lichessRating) {
                doneWithDB.resolve();
                lichessRating = lichessRating[0];

                var _30MinsAgo = moment.utc().subtract(30, 'minutes');
                var lastCheckedAt = lichessRating.get('lastCheckedAt');
                if (lastCheckedAt) {
                    lastCheckedAt = moment.utc(lastCheckedAt);
                }
                var promise;
                var isInQueue = _playerIsInQueue[name];
                var rating = lichessRating.get('rating');

                // Only update the rating if it's older than 30 minutes
                // or if we don't have one a rating
                // TODO: Replace this with _.isInteger
                if (rating === null || typeof rating === 'undefined')  {
                    // If we don't have a rating, use the foreground queue
                    promise = _updateRating(name, false);
                } else if (!isInQueue && (!lastCheckedAt || lastCheckedAt.isBefore(_30MinsAgo))) {
                    // If the rating is just out of date, use the background queue
                    promise = _updateRating(name, true);
                }

                if (rating !== null && typeof rating !== 'undefined')  {
                    // Return the cached rating if we have it.
                    return lichessRating.get('rating');
                } else {
                    // Otherwise wait until we get it
                    return promise;
                }
            }).catch(function(error) {
                console.error("Error querying for rating: " + error);
            });
        });
    }
    return {
        getPlayerRating: getPlayerRating,
    };
})();

module.exports.getPlayerRating = ratingFunctions.getPlayerRating
module.exports.getPlayerByName = getPlayerByName
