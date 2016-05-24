//------------------------------------------------------------------------------
// HTTP helpers
//------------------------------------------------------------------------------
const http = require('http');
var Q = require("q");

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
        console.error(JSON.stringify(e));
        deferred.reject("failed to get a response from url: " + url);
    });
    return deferred.promise;
}
function fetchURLIntoJSON(url){
    var deferred = Q.defer();
    fetchURL(url).then(function(result) {
        var json = JSON.parse(result['body']);
        if (json) {
            result['json'] = json;
            deferred.resolve(result);
        } else {
            deferred.reject("body was not a valid json object: " + url);
        }
    }, function(error) {
        deferred.reject(error);
    });
    return deferred.promise;
}


module.exports.fetchURL = fetchURL;
module.exports.fetchURLIntoJSON = fetchURLIntoJSON;
