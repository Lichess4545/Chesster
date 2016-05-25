//------------------------------------------------------------------------------
// Lichess helpers
//------------------------------------------------------------------------------
var http = require("./http.js");
var moment = require("moment");
var Q = require("q");

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
            console.log("Making lichess request: " + url);
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

// TODO: eventually cache these results.
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
var getPlayerRating = (function() {
    var _playerRatings = {};
    var _playerRatingsLastUpdated = {};
    var _playerRatingPromises = {};
    function getPlayerRating(name, isBackground){
        // If this is a background request, then re-use an existing promise
        if (isBackground) {
            var promise = _playerRatingPromises[name.toLowerCase()];
            if (promise) {
                return promise;
            }
        }

        // If we have updated recently, just return this rating.
        var _30MinsAgo = moment.utc().subtract(30, 'minutes');
        var lastUpdated = _playerRatingsLastUpdated[name.toLowerCase()];
        if (lastUpdated && lastUpdated.isAfter(_30MinsAgo)) {
            return Q.fcall(function() { return _playerRatings[name.toLowerCase()]; });
        } else {
            // Else, 
            var background = "";
            if (isBackground) {
                background = " [in the background]";
            }
            console.log("Requesting rating update for " + name + background);
            var promise = getPlayerByName(name, isBackground).then(function(result) {
                var rating = result.json.perfs.classical.rating;
                _playerRatings[name.toLowerCase()] = rating;
                _playerRatingsLastUpdated[name.toLowerCase()] = moment.utc();
                return rating;
            });
            _playerRatingPromises[name.toLowerCase()] = promise;
            return promise;
        }
    }
    return getPlayerRating;
})();



module.exports.getPlayerRating = getPlayerRating
module.exports.getPlayerByName = getPlayerByName
