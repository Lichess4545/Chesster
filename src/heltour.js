//------------------------------------------------------------------------------
// Heltour related facilities
//------------------------------------------------------------------------------

const url = require('url');
const http = require("./http.js");

function findPairing(heltourConfig, white, black) {
    var options = url.parse(heltourConfig.base_endpoint + "find_pairing/");
    options.parameters = {
        'white': white,
        'black': black
    };
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

// Update the result
function updateResult(heltourConfig, result) {
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


module.exports.findPairing = findPairing;
module.exports.updateSchedule = updateSchedule;
module.exports.updateResult = updateResult;
