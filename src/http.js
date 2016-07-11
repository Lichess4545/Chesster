//------------------------------------------------------------------------------
// HTTP helpers
//------------------------------------------------------------------------------
const http = require('http');
var Q = require("q");
var winston = require("winston");

function fetchURL(url){
    var deferred = Q.defer();
    http.get(url, (res) => {
        var body = "";
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', () => {
            deferred.resolve({'response': res, "body": body});
        });
    }).on('error', (e) => {
        winston.error(JSON.stringify(e));
        deferred.reject("failed to get a response from url: " + url);
    });
    return deferred.promise;
}
function fetchURLIntoJSON(url){
    var deferred = Q.defer();
    fetchURL(url).then(function(result) {
        try {
            var json = JSON.parse(result['body']);
            if (json) {
                result['json'] = json;
                deferred.resolve(result);
            } else {
                deferred.reject("body was not a valid json object: " + url);
            }
        } catch (e) {
            winston.error("[HTTP] Exception: " + e);
            winston.error("[HTTP] Stack: " + e.stack);
            winston.error("[HTTP] Body: " + result['body']);
            deferred.reject(e);
        }
    }, function(error) {
        deferred.reject(error);
    });
    return deferred.promise;
}


module.exports.fetchURL = fetchURL;
module.exports.fetchURLIntoJSON = fetchURLIntoJSON;
