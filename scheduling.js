var moment = require("moment");
var fuzzy_match = require("fuzzy_match");

var ISO_TUESDAY = 2;

// Make an attempt to parse a scheduling string. 
//
// first parameter is the string to parse
// second parameter is an options dict specifying the round extrema options
function parse_scheduling(string, options) {
    var parts = string.split(" ");
    var filtered_parts = [];
    parts.forEach(function(part) {
        // Remove all lone 
        if (part == "@") {
            continue;
        }
        if (part == "GMT") {
            continue;
        }
        filtered_parts.push(part);
    });
    if (parts != 4) {
        throw Error("Unable to parse scheduling string: " + string);
    }

    return {
    };
}

// Calculate the extrema of the current round.
function get_round_extrema(options) {
    options = options || {};
    if (!options.containing_date) {
        round_start = moment.utc();
    } else {
        round_start = moment(options.containing_date).clone();
    }

    while (round_start.isoWeekday() != ISO_TUESDAY) {
        round_start.subtract(1, 'days');
    }
    round_start.hour(0).minute(0).second(0);
    round_end = round_start.clone().add(7, 'days');
    if (options.offset_hours) {
        round_start.subtract(options.offset_hours, 'hours');
        round_end.subtract(options.offset_hours, 'hours');
    }
    return [round_start, round_end];
}

module.exports.get_round_extrema = get_round_extrema;
module.exports.parse_scheduling = parse_scheduling;
