var moment = require("moment");
var fuzzy_match = require("./fuzzy_match");
var GoogleSpreadsheet = require("google-spreadsheet");

var ISO_TUESDAY = 2;
var DATE_FORMATS = [
    "YYYYMMDD HHmm",
    "YYYYMMDD Hmm",
    "HHmm DDMMYYYY"
];
var WORDS_TO_IGNORE = [
    "",
    "-",
    "–",
    "at",
    "on",
    "gmt",
    "rescheduled",
    "reschedule",
    "reschedule:",
    "to",
    "v",
    "vs",
    "vs.",
    "versus",
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sun",
    "mon",
    "tues",
    "wed",
    "thu",
    "thur",
    "thurs",
    "fri",
    "sat",

    // TODO: yes, this is oddly specific - but unless he changes his username ....
    "steveharwell"
];

// Make an attempt to parse a scheduling string. 
//
// first parameter is the string to parse
// second parameter is an options dict specifying the round extrema options
function parse_scheduling(string, options) {
    // Only going to deal with lowercase
    string = string.toLowerCase();

    // Remove punctionation.
    string = string.replace(/[@\.,\(\)]/g, ' ');

    // Split it up
    var parts = string.split(" ");

    // Filter it to remove all the noise
    var filtered_parts = [];
    parts.forEach(function(part) {
        // Remove all lone 
        if (WORDS_TO_IGNORE.indexOf(part) != -1) {
            return;
        }
        filtered_parts.push(part);
    });
    if (filtered_parts.length < 3) {
        throw new Error("Unable to parse scheduling string: " + string);
    }

    // Now build up some possible strings and try a bunch of patterns
    // to find a date in our range.
    var extrema = get_round_extrema(options);
    date_string = filtered_parts.slice(2).join(" ");
    var date_strings = [];
    date_strings.push(date_string)
    var now = moment.utc();
    year = now.year();
    month = now.month()+1;
    date_strings.push("" + year + "/" + date_string);
    date_strings.push("" + year + "/" + month + "/" + date_string);

    var dates = [];
    date_strings.forEach(function(date_string) {
        DATE_FORMATS.forEach(function(format) {
            var date = moment.utc(date_string, format);
            if (!date.isValid()) {
                return;
            }
            if (date.isBefore(extrema[0]) || date.isAfter(extrema[1])) {
                return;
            }
            dates.push(date);
        });
    });
    if (dates.length < 1) {
        throw new Error("Couldn't parse date: " + date_strings[0]);
    }

    // strip out any punctuation from the usernames
    var white = filtered_parts[0].replace(/[@\.,\(\):]/g, '');
    var black = filtered_parts[1].replace(/[@\.,\(\):]/g, '');
    // return the result
    return {
        white: white,
        black: black,
        date: dates[0]
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

// Update the schedule
function update_schedule(white, black, date, callback) {
    var doc = new GoogleSpreadsheet('1FJZursRrWBmV7o3xQd_JzYEoB310ZJA79r8fGQUL1S4');
    var pairings_sheet = undefined;
    doc.getInfo(function(err, info) {
        info.worksheets.forEach(function(sheet) {
            if (sheet.title.toLowerCase().indexOf("round") != -1) {
                pairings_sheet = sheet;
            }
        });
        pairings_sheet.getRows({
            offset: 0,
            limit: 80,
            query: '(white == ' + white + ' and black == ' + black + ') or (white == ' + black + ' and black == ' + white + ')'
        }, function( err, rows ){
            rows[0].timemmddhhmm = date.format("MM/DD @ HH:mm");
            rows[0].save(function(err) {
                console.log(err);
                callback();
            });
        });
    });
}

module.exports.get_round_extrema = get_round_extrema;
module.exports.parse_scheduling = parse_scheduling;
module.exports.update_schedule = update_schedule;
