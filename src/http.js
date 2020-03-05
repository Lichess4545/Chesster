//------------------------------------------------------------------------------
// HTTP helpers
//------------------------------------------------------------------------------
const _http = require('http');
const _https = require('https');
const querystring = require('querystring');
const Q = require("q");
const winston = require("winston");
const _ = require("lodash");

function fetchURL(options) {
    var deferred = Q.defer();
    var http = _http;
    if (_.isString(options)) {
        if (_.startsWith(options, "https:")) {
            http = _https;
        }
    } else {
        if (_.isEqual(options.protocol, "https:")) {
            http = _https;
        }
    }

    if (options.parameters) {
        options.path += "?" + querystring.stringify(options.parameters);
    }
    var bodyParameters = null;
    if (options.bodyParameters) {
        bodyParameters = querystring.stringify(options.bodyParameters);
        options.headers = options.headers || {};
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.byteLength(bodyParameters);
    }
    var req = http.request(options, (res) => {
        var body = "";
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', () => {
            deferred.resolve({'response': res, "body": body});
        });
    }).on('error', (e) => {
        winston.error(JSON.stringify(e));
        deferred.reject("failed to get a response from url: " + options.href);
    });
    if (bodyParameters) {
        req.write(bodyParameters);
    }
    req.end();
    return deferred.promise;
}
function fetchURLIntoJSON(options) {
    var deferred = Q.defer();
    fetchURL(options).then(function (result) {
        try {
            var json = JSON.parse(result['body']);
            if (json) {
                result['json'] = json;
                deferred.resolve(result);
            } else {
                winston.error("[HTTP] Options: " + JSON.stringify(options));
                winston.error("[HTTP] Body: " + result["body"]);
                winston.error("[HTTP] Status Code: " + result["response"]["statusCode"]);
                winston.error("[HTTP] Status Message: " + result["response"]["statusMessage"]);
                deferred.reject("body was not a valid json object: " + JSON.stringify(result["body"]));
            }
        } catch (e) {
            winston.error("[HTTP] Options: " + JSON.stringify(options));
            winston.error("[HTTP] Exception: " + e);
            winston.error("[HTTP] Stack: " + e.stack);
            winston.error("[HTTP] Body: " + result["body"]);
            winston.error("[HTTP] Status Code: " + result["response"]["statusCode"]);
            winston.error("[HTTP] Status Message: " + result["response"]["statusMessage"]);
            deferred.reject(e);
        }
    }, function (error) {
        deferred.reject(error);
    });
    return deferred.promise;
}


module.exports.fetchURL = fetchURL;
module.exports.fetchURLIntoJSON = fetchURLIntoJSON;
