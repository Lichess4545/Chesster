//------------------------------------------------------------------------------
// Heltour related facilities
//------------------------------------------------------------------------------
const _ = require('lodash');
const url = require('url');
const http = require("./http.js");
const Q = require("q");
const format = require('string-format');
const winston = require("winston");
format.extend(String.prototype);

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
            newResult['gamelink'] = result['gamelink'];
            newResult['gamelinkChanged'] = newResult['game_link_changed'];
            newResult['resultChanged'] = newResult['result_changed'];
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

function getUserMap(heltourConfig) {
    var deferred = Q.defer();
    var request = heltourRequest(heltourConfig, "get_slack_user_map");
    request.parameters = {};
    http.fetchURLIntoJSON(request).then(function(result) {
        deferred.resolve(result['json'].users);
    }).catch(function(error) {
        winston.error("Unable to getSlackUserMap: {}".format(error));
        deferred.reject(error);
    });
    return deferred.promise;
}

function linkSlack(heltourConfig, user_id, display_name) {
    var deferred = Q.defer();
    var request = heltourRequest(heltourConfig, "link_slack");
    request.parameters = { user_id: user_id, display_name: display_name };
    http.fetchURLIntoJSON(request).then(function(result) {
        deferred.resolve(result['json']);
    }).catch(function(error) {
        winston.error("Unable to linkSlack: {}".format(error));
        deferred.reject(error);
    });
    return deferred.promise;
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

function setAvailability(heltourConfig, playerName, available, roundNumber){
    var request = heltourRequest(heltourConfig, "set_availability");
    request.method = "POST";
    request.bodyParameters = {
        "league": heltourConfig.leagueTag,
        "player": playerName,
        "round": roundNumber,
        "available": available
    };
    return fetchJSONandHandleErrors(request);
}

function sendGameWarning(heltourConfig, white, black, reason) {
    var request = heltourRequest(heltourConfig, "game_warning");
    request.method = "POST";
    request.bodyParameters = {
        'league': heltourConfig.leagueTag,
        'white': white,
        'black': black,
        'reason': reason
    };
    return http.fetchURLIntoJSON(request);
}

function playerContact(heltourConfig, sender, recip) {
    var request = heltourRequest(heltourConfig, "player_contact");
    request.method = "POST";
    request.bodyParameters = {
        'sender': sender,
        'recip': recip
    };
    return http.fetchURLIntoJSON(request);
}

function fetchJSONandHandleErrors(request){
    return http.fetchURLIntoJSON(request).then(function(response){
        if(response["json"]["error"]){
            throw new Error(response["json"]["error"]);
        }
        return response["json"];
    });
}

function HeltourError(code){
    this.code = code;
    this.name = 'HeltourError';
    this.stack = (new Error()).stack;
}

/* GET Requests */
module.exports.findPairing = findPairing;
module.exports.getAllPairings = getAllPairings;
module.exports.getLeagueModerators = getLeagueModerators;

/* POST Requests */
module.exports.updateSchedule = updateSchedule;
module.exports.updatePairing = updatePairing;
module.exports.getRoster = getRoster;
module.exports.getUserMap = getUserMap;
module.exports.linkSlack = linkSlack;
module.exports.assignAlternate = assignAlternate;
module.exports.setAvailability = setAvailability;
module.exports.sendGameWarning = sendGameWarning;
module.exports.playerContact = playerContact;

module.exports.HeltourError = HeltourError;
