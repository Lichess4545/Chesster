//------------------------------------------------------------------------------
// Heltour related facilities
//------------------------------------------------------------------------------
const _ = require('lodash');
const url = require('url');
const http = require("./http.js");

/* 
 * takes an optional league_tag, rather than using the league 
 * specified in heltour config so you can choose all leagues 
 * or one in particular.
 */
function findPairing(heltourConfig, white, black, league_tag) {
    var options = url.parse(heltourConfig.base_endpoint + "find_pairing/");
    options.parameters = {
        'white': white,
        'black': black
    };
    if(!_.isNil(league_tag)){
        options.parameters.league = league_tag;
    }

    options.headers = {
        'Authorization': 'Token ' + heltourConfig.token
    };
    return http.fetchURLIntoJSON(options);
}

// Update the schedule
function updateSchedule(heltourConfig, schedule) {
    var options = url.parse(heltourConfig.base_endpoint + "update_pairing/");
    options.method = "POST";
    options.bodyParameters = {
        'league': heltourConfig.league_tag,
        'white': schedule.white,
        'black': schedule.black,
        'datetime': schedule.date.format()
    };
    options.headers = {
        'Authorization': 'Token ' + heltourConfig.token
    };

    return http.fetchURLIntoJSON(options);
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
        var options = url.parse(heltourConfig.base_endpoint + "update_pairing/");
        options.method = "POST";
        options.bodyParameters = {
            'league': heltourConfig.league_tag,
            'white': result.white.name,
            'black': result.black.name
        };
        if (result.result) {
            options.bodyParameters['result'] = result.result;
        }
        if (result.gamelink) {
            options.bodyParameters['game_link'] = result.gamelink;
        }
        options.headers = {
            'Authorization': 'Token ' + heltourConfig.token
        };


        return http.fetchURLIntoJSON(options).then(function(response) {
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

function getPrivateURL(heltourConfig, page, user){
    var options = url.parse(heltourConfig.base_endpoint + "get_private_url/");
    options.parameters = {
        'league': heltourConfig.league_tag,
        'page': page,
        'user': user
    };

    options.headers = {
        'Authorization': 'Token ' + heltourConfig.token
    };
    return http.fetchURLIntoJSON(options).then(function(response){
        if(response["json"]["error"]){
            throw new Error(response["json"]["error"]);
        }
        return response["json"];
    });
}

module.exports.getPrivateURL = getPrivateURL;
module.exports.findPairing = findPairing;
module.exports.updateSchedule = updateSchedule;
module.exports.updatePairing = updatePairing;
