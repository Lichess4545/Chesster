//------------------------------------------------------------------------------
// Heltour related facilities
//------------------------------------------------------------------------------

const url = require('url');
const http = require("./http.js");

function findPairing(heltourConfig, schedulingConfig, white, black) {
    var options = url.parse(heltourConfig.base_endpoint + "find_pairing/");
    options.params = {
        'white': schedule.white,
        'black': schedule.black
    };
    options.headers = {
        'Authorization': 'Token ' + heltourConfig.token
    };
    return http.fetchURLIntoJSON(options);
}

// Update the schedule
function updateSchedule(heltourConfig, schedulingConfig, schedule) {
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



module.exports.updateSchedule = updateSchedule;
