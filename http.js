//------------------------------------------------------------------------------
// HTTP helpers
//------------------------------------------------------------------------------
const http = require('http');
var Q = require("q");

function fetchURLIntoJSON(url){
    var deferred = Q.defer();
    http.get(url, (res) => {
        var body = "";
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', () => {
            if(body != ""){
                var json = JSON.parse(body);
                if(json){
                    deferred.resolve(json);
                }else{
                    deferred.reject("body was not a valid JSON object");
                }
            }else{
                deferred.reject("body was empty from url: " + url);
            }
        });
    }).on('error', (e) => {
        console.error(JSON.stringify(e));
        defer.reject("failed to get a response from url: " + url);
    });
    return deferred.promise;
}


module.exports.fetchURLIntoJSON = fetchURLIntoJSON;
