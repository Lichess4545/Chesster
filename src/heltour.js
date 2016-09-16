//------------------------------------------------------------------------------
// Heltour related facilities
//------------------------------------------------------------------------------
const _ = require('lodash');
const url = require('url');
const http = require("./http.js");
const Q = require("q");
const format = require('string-format')
const winston = require("winston");
format.extend(String.prototype)

//------------------------------------------------------------------------------
function heltourRequest(heltourConfig, endpoint) {
    var request = url.parse("{}{}/".format(heltourConfig.baseEndpoint, endpoint));
    request.headers = {
        'Authorization': 'Token ' + heltourConfig.token
    };
    return request;
}

/* 
 * takes an optional leagueTag, rather than using the league 
 * specified in heltour config so you can choose all leagues 
 * or one in particular.
 */
function findPairing(heltourConfig, white, black, leagueTag) {
    var request = heltourRequest(heltourConfig, "find_pairing");
    request.parameters = {
        'white': white,
        'black': black
    };
    if(!_.isNil(leagueTag)){
        request.parameters.league = leagueTag;
    }

    return http.fetchURLIntoJSON(request);
}

/*
 * Note that this method is similar to the one above and they are probably
 * candidates to be refactored together, but this one supports the
 * refreshCurrentSchedules which gets all of the pairings for the league
 *
 * I wasn't sure how to merge the two concepts into a coherent API
 */
function getAllPairings(heltourConfig, leagueTag) {
    var request = heltourRequest(heltourConfig, "find_pairing");
    request.parameters = {};
    var deferred = Q.defer();
    if (!_.isNil(leagueTag)) {
        request.parameters.league = leagueTag;
    } else {
        deferred.reject("leagueTag is a required parameter for heltour.getAllPairings");
        return deferred.promise;
    }

    http.fetchURLIntoJSON(request).then(function(response) {
        var pairings = response['json'];
        if (!_.isNil(pairings.error)) {
            winston.error("[{}] - Error getting pairings: {}".format(leagueTag, pairings.error));
            deferred.reject(pairings.error);
        } else {
            if (!_.isNil(pairings.pairings)) {
                deferred.resolve(pairings.pairings);
            } else {
                winston.error("Error getting pairings for {}".format(leagueTag));
                deferred.reject("No Pairings");
            }
        }
    }).catch(function(error) {
        deferred.reject(error);
    });
    return deferred.promise;
}

// Update the schedule
function updateSchedule(heltourConfig, schedule) {
    var request = heltourRequest(heltourConfig, "update_pairing");
    request.method = "POST";
    request.bodyParameters = {
        'league': heltourConfig.leagueTag,
        'white': schedule.white,
        'black': schedule.black,
        'datetime': schedule.date.format()
    };

    return http.fetchURLIntoJSON(request);
}

// Update the pairing with a result or link
function updatePairing(heltourConfig, result) {
    return findPairing(heltourConfig, result.white.name, result.black.name).then(function(response) {
        var pairingResult = response['json'];
        var pairings = pairingResult['pairings'];
        if (pairings.length < 1) {
            return {
                "error": "no_pairing"
            };
        } else if (pairings.length > 1) {
            return {
                "error": "ambiguous"
            };
        }
        var pairing = pairings[0];
        var request = heltourRequest(heltourConfig, "update_pairing");
        request.method = "POST";
        request.bodyParameters = {
            'league': heltourConfig.leagueTag,
            'white': result.white.name,
            'black': result.black.name
        };
        if (result.result) {
            request.bodyParameters['result'] = result.result;
        }
        if (result.gamelink) {
            request.bodyParameters['game_link'] = result.gamelink;
        }

        return http.fetchURLIntoJSON(request).then(function(response) {
            var newResult = response['json'];
            newResult['gamelinkChanged'] = pairing['game_link'] !== result['gamelink'];
            newResult['resultChanged'] = pairing['result'] !== result['result'];
            newResult['result'] = result['result'];
            if (newResult['reversed']) {
                newResult['white'] = result['black'];
                newResult['black'] = result['white'];
            } else {
                newResult['white'] = result['white'];
                newResult['black'] = result['black'];
            }
            return newResult;
        
        });
    });
}

function getRoster(heltourConfig, leagueTag) {
    var deferred = Q.defer();
    var request = heltourRequest(heltourConfig, "get_roster");
    request.parameters = {};
    if (!_.isNil(leagueTag)) {
        request.parameters.league = leagueTag;
    } else {
        deferred.reject("leagueTag is a required parameter for heltour.getRoster");
        return deferred.promise;
    }
    http.fetchURLIntoJSON(request).then(function(result) {
        var roster = result['json'];
        if (!_.isNil(roster.error)) {
            winston.error("Error getting rosters: {}".format(roster.error));
            deferred.reject(roster.error);
        } else {
            deferred.resolve(roster);
        }
    }).catch(function(error) {
        winston.error("Unable to getRoster: {}".format(error));
        deferred.reject(error);
    });
    return deferred.promise;
}

function getPrivateURL(heltourConfig, page, user){
    var request = heltourRequest(heltourConfig, "get_private_url");
    request.parameters = {
        'league': heltourConfig.leagueTag,
        'page': page,
        'user': user
    };
    return fetchJSONandHandleErrors(request);
}

function assignAlternate(heltourConfig, round, team, board, player){
    var request = heltourRequest(heltourConfig, "assign_alternate");
    request.method = "POST";
    request.bodyParameters = {
        "league": heltourConfig.leagueTag,
        "round": round,
        "team": team,
        "board": board,
        "player": player
    };
    return fetchJSONandHandleErrors(request);
}

function getLeagueModerators(heltourConfig){
    var request = heltourRequest(heltourConfig, "get_league_moderators");
    request.parameters = {
        "league": heltourConfig.leagueTag
    };
    return fetchJSONandHandleErrors(request).then(function(json){
        return json["moderators"];
    });
}

function fetchJSONandHandleErrors(request){
    return http.fetchURLIntoJSON(request).then(function(response){
        if(response["json"]["error"]){
            throw new Error(response["json"]["error"]);
        }
        return response["json"];
    });
}

module.exports.assignAlternate = assignAlternate;
module.exports.getPrivateURL = getPrivateURL;
module.exports.findPairing = findPairing;
module.exports.getAllPairings = getAllPairings;
module.exports.updateSchedule = updateSchedule;
module.exports.updatePairing = updatePairing;
module.exports.getRoster = getRoster;
module.exports.getLeagueModerators = getLeagueModerators;
